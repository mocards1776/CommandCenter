import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// The Thompson Times AI editor. One call per press: the press (or a device
// setting the paper itself) sends the top of the news budget plus the night's
// game wraps as context; Grok sends back the front, the news order, and the
// spike. Game wraps are never ranked or spiked here. Layout, box scores, standings,
// schedules, weather and agate stay on the rule desk and never come here.
//
// Callers: newspaper-press with the service-role key, or a signed-in reader.
// Secret: XAI_API_KEY under Edge Functions → Secrets (shared with book-ai).

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "grok-4.6";
const XAI_BASE = "https://api.x.ai/v1";
const MAX_CANDIDATES = 30;
const MAX_GAMES = 20;

const SYSTEM = `You are the editor of the Thompson Times, a one-reader broadsheet printed three times a day (6 a.m. "morning", noon "midday", 5 p.m. "evening", Central time; the edition id ends in its slot) for Josh in Marshfield, Missouri.

Section A is not a favorite-teams sports page. It is the essentials — the stuff most important to him today. That includes:
- His clubs (desk "home": Cardinals, Blues, Mizzou football and basketball; desk "followed": Chiefs, Lions, Cowboys, Missouri State, Wrexham, Wolves, Arsenal). 76ers and other NBA fluff never occupy A1 — they stay on the NBA desk. NBA preseason and exhibition box wraps never front.
- MoScout and Missouri politics (desk "missouri").
- National news (desk "national") ONLY when the story is truly historic — major major. Not necessarily 9/11 type, but close. Think a presidential assassination attempt, a war starting, a major terror attack, a Supreme Court landmark ruling, a market crash, a huge natural disaster, or a president leaving office. Most days, zero national stories belong in Section A. On a truly historic day, at most one or two. A funding bill, a cabinet hearing, a campaign speech, the Court granting cert, a border bill, a Washington process lead, and every other ordinary national story stays in National News (Section B). When unsure, leave it in B. Do not spike a national story just because it does not belong on A; B already prints the national desk.
- The Day Ahead (his schedule and family) and the Beez already print as pages in A; you do not rank those.
Other teams (desk "league") appear in Section A only when the story is major news — a title or clincher, a no-hitter, a firing or hiring that reshapes a league, a major trade, a star lost for the season, a death, a decisive playoff result. Routine league wire stays in its sport section.

You get two lists.
- NEWS: the top of the news budget (team news, league news, The Athletic, and any National / Missouri essentials on the slate), already deduped, each with a headline, a short dek and snippet, club, league, status, source, flags, and where the mechanical ranker put it (ruleRank 0 = its first). The ranker over-weights the home clubs: a routine Cardinals note will beat the biggest story in baseball. Fix that without forgetting who the paper is for.
- GAMES: the game wraps (finals, recaps, club wraps). The desk files one for every game on its own. They are context so you can weigh the news against the results. Never order or spike a game, never ask for one, never invent one. A fresh game (holdover is not true) may be named in front. A holdover game is unread copy carried from a previous edition: it must not front, and it must never be described as "last night".

Answer:
- front: up to three ids, in order (lead, second, third), from NEWS or GAMES, for the stories that open A1. Lead is the most important thing this reader wants first today — a home-club result (Cardinals, Blues, Mizzou), a followed-club result that is actually a priority (Cowboys, Chiefs, Lions), a Missouri essential, a historic national story (almost never; confirm it is leading every outlet), or a genuinely big league story. Never front the 76ers, a Knicks–76ers box wrap, or any NBA preseason / exhibition game. In the morning that is usually last night's home-club result; at midday and evening the day's news matters more and there may be no fresh result. A title clincher, a no-hitter, a firing or hiring that reshapes a league, a major trade, a star's injury, a playoff elimination, or Missouri news outranks a routine home-club item. Do not front desk "national" unless the copy itself is one of those historic events and it has near-universal cross-outlet lead coverage. Default is to leave national stories off A1. Only front a game whose hasCopy is true. Prefer different clubs or events. Leave slots off (fewer than three ids, or none) when the desk's usual front is right.
- Real news over features: results, transactions, injuries, hirings and firings, elections, and statehouse news beat columns, previews, odds pieces, power rankings and listicles. A preview may front only when the game itself is the story (opening day, a decisive playoff game) and nothing that happened is bigger. Postseason beats regular season; a holdover news story (carried unread from the last edition) should rarely front. A holdover game must never front.
- order: every NEWS id you are not spiking, best first.
- spike: NEWS ids that should not run at all: aggregator and content-farm junk (Yardbarker, FanSided-style hot takes, "X things we learned" filler, slideshow and gambling-odds bait), "Day 2" / "relive Wednesday" packages and takeaways whose day has passed, stale previews of games already played, and near-duplicates of a better story. Do not spike real news just because it is minor; ranking it low is enough. When unsure, keep it.
- rationale: one or two plain sentences on why the lead leads.

Use only ids you were given. Judge from the copy given; do not invent facts.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["front", "order", "spike", "rationale"],
  properties: {
    front: { type: "array", items: { type: "string" } },
    order: { type: "array", items: { type: "string" } },
    spike: { type: "array", items: { type: "string" } },
    rationale: { type: "string" },
  },
};

type Candidate = Record<string, unknown> & { id: string; headline: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function clip(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Only the fields the editor reads, clipped, so a bad caller cannot run up the bill. */
function readCandidates(value: unknown): Candidate[] {
  if (!Array.isArray(value)) return [];
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = clip(r.id, 200);
    const headline = clip(r.headline, 240);
    if (!id || !headline || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      headline,
      dek: clip(r.dek, 220),
      snippet: clip(r.snippet, 340),
      desk: clip(r.desk, 12),
      club: clip(r.favoriteKey, 40),
      league: clip(r.league, 8),
      status: clip(r.status, 40),
      source: clip(r.source, 60),
      when: clip(r.when, 40),
      final: r.final === true,
      recap: r.recap === true,
      preview: r.preview === true,
      postseason: r.postseason === true,
      holdover: r.holdover === true,
      ruleRank: typeof r.ruleRank === "number" ? r.ruleRank : null,
    });
    if (out.length >= MAX_CANDIDATES) break;
  }
  return out;
}

/** Game wraps as context: what happened, not copy. */
function readGames(value: unknown): Candidate[] {
  if (!Array.isArray(value)) return [];
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = clip(r.id, 200);
    const headline = clip(r.headline, 200);
    if (!id || !headline || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      headline,
      score: clip(r.score, 60),
      desk: clip(r.desk, 12),
      club: clip(r.favoriteKey, 40),
      league: clip(r.league, 8),
      status: clip(r.status, 40),
      postseason: r.postseason === true,
      hasCopy: r.hasCopy === true,
      holdover: r.holdover === true,
    });
    if (out.length >= MAX_GAMES) break;
  }
  return out;
}

const lines = (rows: Candidate[]) =>
  rows.map((c) => JSON.stringify(Object.fromEntries(Object.entries(c).filter(([, v]) => v !== null && v !== false))));

function budgetText(edition: string, candidates: Candidate[], games: Candidate[]): string {
  return [
    `Edition: ${edition}`,
    `Now: ${new Date().toISOString()}`,
    "",
    `NEWS (${candidates.length} stories, one JSON object per line):`,
    ...lines(candidates),
    "",
    `GAMES (${games.length}, context only):`,
    ...(games.length ? lines(games) : ["(none)"]),
  ].join("\n");
}

function responseText(data: Record<string, unknown>): string {
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text;
  const parts: string[] = [];
  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (!item || typeof item !== "object") continue;
      const block = item as Record<string, unknown>;
      if (typeof block.text === "string") parts.push(block.text);
      if (Array.isArray(block.content)) {
        for (const c of block.content) {
          if (!c || typeof c !== "object") continue;
          const chunk = c as Record<string, unknown>;
          if (typeof chunk.text === "string") parts.push(chunk.text);
        }
      }
    }
  }
  return parts.join("\n");
}

async function askGrok(apiKey: string, user: string): Promise<{ desk: Record<string, unknown>; model: string }> {
  const res = await fetch(`${XAI_BASE}/responses`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      store: false,
      reasoning: { effort: "low" },
      max_output_tokens: 8000,
      input: [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
      text: { format: { type: "json_schema", name: "front_page", schema: SCHEMA, strict: true } },
    }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`xAI ${res.status}: ${raw.slice(0, 300)}`);
  const data = JSON.parse(raw) as Record<string, unknown>;
  const text = responseText(data).trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)?.[1] ?? text;
  const desk = JSON.parse(fenced) as Record<string, unknown>;
  if (!desk || typeof desk !== "object" || Array.isArray(desk)) throw new Error("Editor answer was not an object");
  return { desk, model: String(data.model ?? MODEL) };
}

/** The press calls with the service-role key; a reader's device calls with its session. */
async function authorized(req: Request): Promise<boolean> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (service && token === service) return true;
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) return false;
  const asUser = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await asUser.auth.getUser();
  return !error && Boolean(data.user);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);
  if (!(await authorized(req))) return json({ ok: false, error: "Not signed in" }, 401);

  const apiKey = Deno.env.get("XAI_API_KEY");
  if (!apiKey) return json({ ok: false, error: "No XAI_API_KEY on the server" }, 503);

  let edition = "";
  let candidates: Candidate[] = [];
  let games: Candidate[] = [];
  try {
    const body = (await req.json()) as { edition?: unknown; candidates?: unknown; games?: unknown };
    edition = clip(body?.edition, 40) ?? "";
    candidates = readCandidates(body?.candidates);
    games = readGames(body?.games);
  } catch {
    return json({ ok: false, error: "Expected JSON" }, 400);
  }
  if (candidates.length < 2) return json({ ok: false, error: "Nothing to edit" }, 400);

  try {
    const { desk, model } = await askGrok(apiKey, budgetText(edition, candidates, games));
    return json({ ok: true, desk: { ...desk, model } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = /xAI 429|rate.?limit/i.test(msg) ? 429 : 502;
    return json({ ok: false, error: msg.slice(0, 400) }, status);
  }
});
