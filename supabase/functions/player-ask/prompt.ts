export const SPORTS = ["mlb", "nfl", "nhl", "cfb"] as const;
export type AskSport = (typeof SPORTS)[number];

export type AskStat = { label: string; value: string };

export type AskContext = {
  name: string;
  team: string | null;
  position: string | null;
  bio: string;
  seasonLabel: string | null;
  seasonStats: AskStat[];
  recentGames: string[];
};

export type AskSource = { url: string; title: string | null };

const BIO_MAX = 3500;
const STATS_MAX = 24;
const GAMES_MAX = 8;
const LINE_MAX = 240;
const QUESTION_MAX = 500;

function clip(raw: unknown, max: number): string {
  return String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function isAskSport(value: unknown): value is AskSport {
  return typeof value === "string" && (SPORTS as readonly string[]).includes(value);
}

export function sanitizeQuestion(raw: unknown): string {
  return String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, QUESTION_MAX);
}

export function sanitizePlayerId(raw: unknown): string {
  const id = String(raw ?? "").trim();
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) return "";
  return id;
}

export function sanitizeContext(raw: unknown): AskContext {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const statsIn = Array.isArray(src.seasonStats) ? src.seasonStats : [];
  const gamesIn = Array.isArray(src.recentGames) ? src.recentGames : [];
  const seasonStats: AskStat[] = [];
  for (const row of statsIn) {
    if (seasonStats.length >= STATS_MAX) break;
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const label = clip(item.label, 24);
    const value = clip(item.value, 32);
    if (!label || !value) continue;
    seasonStats.push({ label, value });
  }
  const recentGames: string[] = [];
  for (const line of gamesIn) {
    if (recentGames.length >= GAMES_MAX) break;
    const text = clip(line, LINE_MAX);
    if (text) recentGames.push(text);
  }
  return {
    name: clip(src.name, 80),
    team: clip(src.team, 80) || null,
    position: clip(src.position, 40) || null,
    bio: clip(src.bio, BIO_MAX),
    seasonLabel: clip(src.seasonLabel, 40) || null,
    seasonStats,
    recentGames,
  };
}

export function buildUserPrompt(question: string, ctx: AskContext): string {
  const who = [ctx.name || "Unknown player", ctx.team, ctx.position].filter(Boolean).join(" · ");
  const stats =
    ctx.seasonStats.length > 0
      ? ctx.seasonStats.map((s) => `${s.label} ${s.value}`).join(", ")
      : "Not in the app packet.";
  const games =
    ctx.recentGames.length > 0 ? ctx.recentGames.map((g) => `- ${g}`).join("\n") : "Not in the app packet.";
  return [
    `Player: ${who}`,
    ctx.seasonLabel ? `Season: ${ctx.seasonLabel}` : "",
    "",
    "Bio from the app:",
    ctx.bio || "Not in the app packet.",
    "",
    "Current-season stats from the app:",
    stats,
    "",
    "Recent games from the app:",
    games,
    "",
    `Question: ${question}`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export const ASK_SYSTEM =
  "You answer one question about a single athlete for a personal sports app. " +
  "Treat the bio, current-season stats, and recent games in the user message as the facts on hand. " +
  "Use web search for news, injuries, trades, roster moves, and anything those facts do not cover. " +
  "When the app's numbers and a web page disagree, prefer the app's stats and say the page differs. " +
  "Be concise: a few sentences, or a short paragraph. " +
  "If you are not sure, say so. Do not invent a stat, date, or injury.";

function pushSource(out: AskSource[], seen: Set<string>, url: unknown, title?: unknown) {
  if (typeof url !== "string") return;
  const clean = url.trim();
  if (!/^https?:\/\//i.test(clean) || seen.has(clean)) return;
  seen.add(clean);
  const label = typeof title === "string" ? title.replace(/\s+/g, " ").trim().slice(0, 180) : "";
  out.push({ url: clean, title: label || null });
}

/** Pull citation URLs off an xAI Responses payload. */
export function citationsFrom(data: Record<string, unknown>): AskSource[] {
  const out: AskSource[] = [];
  const seen = new Set<string>();

  const top = data.citations;
  if (Array.isArray(top)) {
    for (const item of top) {
      if (typeof item === "string") pushSource(out, seen, item);
      else if (item && typeof item === "object") {
        const row = item as Record<string, unknown>;
        pushSource(out, seen, row.url ?? row.uri ?? row.href, row.title);
      }
    }
  }

  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const row = node as Record<string, unknown>;
    const annotations = row.annotations;
    if (Array.isArray(annotations)) {
      for (const note of annotations) {
        if (!note || typeof note !== "object") continue;
        const ann = note as Record<string, unknown>;
        pushSource(out, seen, ann.url ?? ann.uri, ann.title);
      }
    }
    if (Array.isArray(row.content)) {
      for (const child of row.content) walk(child);
    }
  };

  if (Array.isArray(data.output)) {
    for (const item of data.output) walk(item);
  }

  return out.slice(0, 12);
}

/** Plain text from an xAI Responses API payload. */
export function responseText(data: Record<string, unknown>): string {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }
  const parts: string[] = [];
  const output = data.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      if (!item || typeof item !== "object") continue;
      const block = item as Record<string, unknown>;
      if (typeof block.text === "string") parts.push(block.text);
      const content = block.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          if (!c || typeof c !== "object") continue;
          const chunk = c as Record<string, unknown>;
          if (typeof chunk.text === "string") parts.push(chunk.text);
        }
      }
    }
  }
  return parts.join("\n").trim();
}
