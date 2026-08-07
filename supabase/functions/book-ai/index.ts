import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
// Unpinned deliberately: an invented version pin fails the deploy outright,
// which is worse than tracking the current SDK.
import Anthropic from "npm:@anthropic-ai/sdk";

// Two AI features over the reading library, both driven by the user's own
// Anthropic key:
//
//   mode "recommend" — reads the library (ratings, tags, recent reads) and
//     suggests books to read next. No tools; structured output, so the result
//     always parses.
//   mode "search"    — natural-language book search ("college football books
//     that have audiobooks"), answered with web search.
//
// The two are deliberately configured differently. Web search results carry
// citations, and citations are rejected alongside output_config.format — so
// the search path asks for a JSON block in the prompt and parses it
// tolerantly, rather than using structured outputs and 400ing.

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "claude-opus-5";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

type Suggestion = {
  title: string;
  author: string;
  year: string;
  reason: string;
};

const SUGGESTION_SCHEMA = {
  type: "object",
  properties: {
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          author: { type: "string" },
          // A string, not an integer: "unknown" has to be expressible, and a
          // nullable integer is the shakier schema construct here.
          year: { type: "string" },
          reason: { type: "string" },
        },
        required: ["title", "author", "year", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["recommendations"],
  additionalProperties: false,
};

/** Pull the first JSON object out of a reply that may also contain prose. */
function extractJson(text: string): Suggestion[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  try {
    const parsed = JSON.parse(candidate);
    const list = Array.isArray(parsed) ? parsed : parsed?.recommendations;
    if (!Array.isArray(list)) return [];
    return list
      .filter((r) => r && typeof r.title === "string")
      .map((r) => ({
        title: String(r.title),
        author: String(r.author ?? ""),
        year: String(r.year ?? ""),
        reason: String(r.reason ?? ""),
      }));
  } catch {
    return [];
  }
}

/** Compact the library into something worth spending tokens on. */
function digest(
  books: { title: string; authors: string | null; star_rating: number | null; tags: string[] | null; status: string; finished_at: string | null }[],
) {
  const loved = books
    .filter((b) => (b.star_rating ?? 0) >= 4.5)
    .sort((a, b) => (b.star_rating ?? 0) - (a.star_rating ?? 0))
    .slice(0, 50);

  const recent = books
    .filter((b) => b.status === "read" && b.finished_at)
    .sort((a, b) => (b.finished_at ?? "").localeCompare(a.finished_at ?? ""))
    .slice(0, 20);

  const tagCounts = new Map<string, number>();
  for (const b of books) for (const t of b.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([t, n]) => `${t} (${n})`);

  const line = (b: { title: string; authors: string | null; star_rating: number | null }) =>
    `${b.title}${b.authors ? ` — ${b.authors}` : ""}${b.star_rating ? ` [${b.star_rating}★]` : ""}`;

  return [
    `Library size: ${books.length} books.`,
    topTags.length ? `Most-used tags: ${topTags.join(", ")}.` : "",
    loved.length ? `\nRated 4.5+:\n${loved.map(line).join("\n")}` : "",
    recent.length ? `\nFinished most recently:\n${recent.map(line).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return json(
      {
        error:
          "No Anthropic key on the server. Add ANTHROPIC_API_KEY under Edge Functions → Secrets in Supabase (not Vercel).",
      },
      400,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  // Identify with the caller's own token; read with the service role scoped to
  // that id. A user id from the request body is never trusted.
  const asUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: userData, error: userErr } = await asUser.auth.getUser();
  if (userErr || !userData.user) return json({ error: "Not signed in" }, 401);
  const userId = userData.user.id;

  let mode = "recommend";
  let query = "";
  try {
    const body = await req.json();
    if (body?.mode === "search") mode = "search";
    query = String(body?.query ?? "").slice(0, 500);
  } catch {
    // defaults are fine
  }
  if (mode === "search" && !query.trim()) return json({ error: "Ask me something." }, 400);

  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: books, error } = await admin
    .from("books")
    .select("title,authors,star_rating,tags,status,finished_at")
    .eq("user_id", userId);
  if (error) return json({ error: error.message }, 500);

  const client = new Anthropic({ apiKey });
  const taste = digest(books ?? []);

  // Server-side fallback is the documented default for this model, but it is a
  // beta parameter — if the API rejects it, the request is worth more than the
  // fallback, so retry once without it rather than failing the user's click.
  async function ask(params: Record<string, unknown>) {
    const withFallback = {
      ...params,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    };
    try {
      const stream = client.beta.messages.stream(withFallback as never);
      return await stream.finalMessage();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/fallback|beta/i.test(msg)) throw e;
      const stream = client.beta.messages.stream(params as never);
      return await stream.finalMessage();
    }
  }

  try {
    let message;

    if (mode === "recommend") {
      message = await ask({
        model: MODEL,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        output_config: {
          effort: "medium",
          format: { type: "json_schema", schema: SUGGESTION_SCHEMA },
        },
        system:
          "You recommend books to a specific reader based on their library. " +
          "Recommend books they do NOT already own — the list below is what they have. " +
          "Favour specific, well-matched picks over famous ones they have obviously heard of. " +
          "Each reason is one sentence naming the book in their library it follows from.",
        messages: [
          {
            role: "user",
            content: `Here is my reading history.\n\n${taste}\n\nRecommend 8 books I should read next.`,
          },
        ],
      });
    } else {
      message = await ask({
        model: MODEL,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }],
        system:
          "You find books matching a reader's description, searching the web when the " +
          "answer depends on current information (what is in print, what has an audiobook, " +
          "what came out recently). Answer with a ```json fenced block and nothing else: " +
          '{"recommendations":[{"title":"","author":"","year":"","reason":""}]}. ' +
          "Up to 10 entries; each reason is one sentence on why it matches the request.",
        messages: [
          {
            role: "user",
            content:
              `Find books matching: ${query}\n\n` +
              `For context, my taste:\n${taste.slice(0, 2000)}`,
          },
        ],
      });
    }

    // A refusal is a successful HTTP 200 with empty or partial content — read
    // stop_reason before touching content.
    if (message.stop_reason === "refusal") {
      return json({ error: "Claude declined that one. Try rephrasing.", recommendations: [] });
    }

    const text = (message.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n");

    const recommendations =
      mode === "recommend"
        ? ((message as { parsed_output?: { recommendations?: Suggestion[] } }).parsed_output
            ?.recommendations ?? extractJson(text))
        : extractJson(text);

    return json({ recommendations, model: message.model, mode });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // The two failures worth naming precisely; everything else passes through.
    if (/401|authentication/i.test(msg)) {
      return json({ error: "Anthropic rejected the key. Check ANTHROPIC_API_KEY." }, 400);
    }
    if (/429|rate.?limit/i.test(msg)) {
      return json({ error: "Anthropic rate limit hit. Try again shortly." }, 429);
    }
    return json({ error: msg }, 502);
  }
});
