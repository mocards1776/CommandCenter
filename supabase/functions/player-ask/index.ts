import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { isAskOwner } from "./owner.ts";
import {
  ASK_SYSTEM,
  buildUserPrompt,
  citationsFrom,
  isAskSport,
  responseText,
  sanitizeContext,
  sanitizePlayerId,
  sanitizeQuestion,
} from "./prompt.ts";

// Ask a question about one player. The browser sends the bio, current-season
// stats, and recent games already on the page. This function adds xAI web
// search, then stores the answer. XAI_API_KEY stays in Edge Function secrets.

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Current Grok with documented web search. Low reasoning keeps a question cheap. */
const MODEL = "grok-4.7";
const XAI_BASE = "https://api.x.ai/v1";
const MAX_OUTPUT_TOKENS = 400;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: "Supabase env is not configured." }, 500);
  }

  const asUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await asUser.auth.getUser();
  if (userErr || !userData.user) return json({ error: "Not signed in" }, 401);
  if (!isAskOwner(userData.user)) {
    return json({ error: "Only Josh can ask new questions." }, 403);
  }

  let body: Record<string, unknown> = {};
  try {
    const parsed = await req.json();
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "Expected a JSON body." }, 400);
  }

  const sport = body.sport;
  const playerId = sanitizePlayerId(body.playerId);
  const question = sanitizeQuestion(body.question);
  if (!isAskSport(sport)) return json({ error: "Unknown sport." }, 400);
  if (!playerId) return json({ error: "Missing player." }, 400);
  if (!question) return json({ error: "Ask a question." }, 400);

  const apiKey = Deno.env.get("XAI_API_KEY");
  if (!apiKey) {
    return json(
      { error: "No xAI key on the server. XAI_API_KEY is set under Edge Functions → Secrets." },
      500,
    );
  }

  const context = sanitizeContext(body.context);
  const userPrompt = buildUserPrompt(question, context);

  let payload: Record<string, unknown>;
  try {
    const res = await fetch(`${XAI_BASE}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        store: false,
        max_output_tokens: MAX_OUTPUT_TOKENS,
        reasoning: { effort: "low" },
        // Sources render under the answer; keep the prose free of [[1]](url) marks.
        include: ["no_inline_citations"],
        tools: [{ type: "web_search", enable_image_search: false }],
        input: [
          { role: "system", content: ASK_SYSTEM },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    const raw = await res.text();
    if (!res.ok) {
      const detail = raw.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]").slice(0, 280);
      if (res.status === 401) return json({ error: "xAI rejected the key. Check XAI_API_KEY." }, 502);
      if (res.status === 429) return json({ error: "xAI rate limit hit. Try again shortly." }, 429);
      return json({ error: `xAI ${res.status}: ${detail}` }, 502);
    }
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    const message = err instanceof Error ? err.message : "xAI request failed";
    return json({ error: message.slice(0, 280) }, 502);
  }

  const answer = responseText(payload).slice(0, 8000);
  if (!answer) return json({ error: "Grok returned an empty answer. Try rephrasing." }, 502);
  const sources = citationsFrom(payload);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: row, error: insertErr } = await admin
    .from("player_ai_answers")
    .insert({
      player_id: playerId,
      sport,
      question,
      answer,
      sources,
      asked_by: userData.user.id,
    })
    .select("id, player_id, sport, question, answer, sources, asked_at")
    .single();

  if (insertErr || !row) {
    return json({ error: insertErr?.message ?? "Could not save the answer." }, 500);
  }

  return json({ answer: row, model: MODEL });
});
