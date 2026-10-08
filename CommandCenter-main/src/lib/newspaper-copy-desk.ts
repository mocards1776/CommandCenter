/**
 * One copy pass per press, after the editor and before the story flush.
 * Races, the top watch games, and the front headlines go out in a single
 * grok-4.6 call. Renderers prefer this text and keep today's copy when the
 * call is off, empty, or late.
 *
 * NEWSPAPER_COPY=off skips the call. A missing key, a failed read, or a bad
 * answer files nothing.
 */
import { asRaceBriefsDesk, raceCode, raceHasActiveBuys, shiftYmd, type RaceBrief, type RaceBriefsDesk } from "./newspaper-races.ts";
import type { GameWrapCard } from "./newspaper-sports.ts";
import type { WatchGame } from "./newspaper-watch-page.ts";

export const COPY_MODEL = "grok-4.6";
const XAI_BASE = "https://api.x.ai/v1";
export const COPY_TIMEOUT_MS = 45_000;
const DEK_WORDS = 22;

export type CopyRace = { race: string; headline: string; copy: string };
export type CopyWatch = { id: string; why: string };
export type CopyDek = { id: string; dek: string };

export type TimesCopy = {
  races: CopyRace[];
  watch: CopyWatch[];
  deks: CopyDek[];
};

type DenoEnv = { env?: { get?: (name: string) => string | undefined } };

function denoEnv(name: string): string | undefined {
  try {
    const deno = (globalThis as { Deno?: DenoEnv }).Deno;
    const value = deno?.env?.get?.(name);
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  } catch {
    return undefined;
  }
}

export function copyDisabled(): boolean {
  return denoEnv("NEWSPAPER_COPY") === "off";
}

function tidy(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > max ? text.slice(0, max).trim() : text;
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function clipDek(value: unknown): string {
  const text = tidy(value, 180);
  if (!text || wordCount(text) > DEK_WORDS) return "";
  return text;
}

export function parseTimesCopy(raw: unknown): TimesCopy | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const races: CopyRace[] = [];
  const watch: CopyWatch[] = [];
  const deks: CopyDek[] = [];
  if (Array.isArray(row.races)) {
    for (const item of row.races) {
      if (!item || typeof item !== "object") continue;
      const race = item as Record<string, unknown>;
      const code = raceCode(typeof race.race === "string" ? race.race : "");
      const headline = tidy(race.headline, 180);
      const copy = tidy(race.copy, 900);
      if (!code || (!headline && !copy)) continue;
      races.push({ race: code, headline, copy });
    }
  }
  if (Array.isArray(row.watch)) {
    for (const item of row.watch) {
      if (!item || typeof item !== "object") continue;
      const game = item as Record<string, unknown>;
      const id = tidy(game.id, 80);
      const why = tidy(game.why, 280);
      if (!id || !why) continue;
      watch.push({ id, why });
    }
  }
  if (Array.isArray(row.deks)) {
    for (const item of row.deks) {
      if (!item || typeof item !== "object") continue;
      const dekRow = item as Record<string, unknown>;
      const id = tidy(dekRow.id, 80);
      const dek = clipDek(dekRow.dek);
      if (!id || !dek) continue;
      deks.push({ id, dek });
    }
  }
  if (!races.length && !watch.length && !deks.length) return null;
  return { races, watch, deks };
}

export function asTimesCopy(raw: unknown): TimesCopy | null {
  return parseTimesCopy(raw);
}

export function applyRaceCopy(desk: RaceBriefsDesk | null, copy: TimesCopy | null): RaceBriefsDesk | null {
  if (!desk || !copy?.races.length) return desk;
  const by = new Map(copy.races.map((race) => [raceCode(race.race), race]));
  return {
    ...desk,
    races: desk.races.map((race) => {
      const hit = by.get(raceCode(race.race));
      if (!hit) return race;
      return {
        ...race,
        headline: hit.headline || race.headline,
        copy: hit.copy || null,
      };
    }),
  };
}

export function applyWatchWhy(games: WatchGame[], copy: TimesCopy | null): WatchGame[] {
  if (!copy?.watch.length) return games;
  const by = new Map(copy.watch.map((row) => [row.id, row.why]));
  return games.map((game) => {
    const why = by.get(game.id);
    return why ? { ...game, why } : game;
  });
}

export function dekMap(copy: TimesCopy | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of copy?.deks ?? []) out[row.id] = row.dek;
  return out;
}

export function applyStoryDeks<T extends { id: string; dek?: string | null }>(stories: T[], copy: TimesCopy | null): T[] {
  const deks = dekMap(copy);
  if (!Object.keys(deks).length) return stories;
  return stories.map((card) => (deks[card.id] ? { ...card, dek: deks[card.id]! } : card));
}

export function watchForCopy(games: WatchGame[], limit = 6): WatchGame[] {
  return [...games].sort((a, b) => b.heat - a.heat || a.id.localeCompare(b.id)).slice(0, limit);
}

function spendFacts(race: RaceBrief): { side: string; amount: number }[] {
  const by = new Map<string, number>();
  for (const row of race.spend) {
    const side = row.side || "Unspecified";
    by.set(side, (by.get(side) ?? 0) + row.amount);
  }
  return [...by.entries()].map(([side, amount]) => ({ side, amount }));
}

export function raceFacts(race: RaceBrief): Record<string, unknown> {
  return {
    race: race.race,
    headline: race.headline,
    bullets: race.bullets,
    spendPartial: spendFacts(race),
    notes: race.notes.map((note) => note.text),
    fullBrief: raceCode(race.race) === "SD8" || raceCode(race.race) === "SD30" || raceHasActiveBuys(race),
  };
}

const SYSTEM = `You write the Thompson Times, a one-reader broadsheet for Josh in Marshfield, Missouri. This pass is copy only. Do not pick the front, do not add races, and do not invent facts.

You receive three lists that are already chosen:
- RACES: rows from the morning book. Use only the headline, bullets, notes, and spend figures in that row. Spend is partial (inbox only). If you mention money, call it partial. fullBrief true: write 2 to 4 sentences. fullBrief false: write one sentence. The Missouri Roundup (race MOROUNDUP) is 3 to 6 short sentences, one per bullet you were given, and nothing beyond those bullets.
- WATCH: up to six games. One sentence each on why it is worth turning on, using only the fields given (teams, league, series, line, print reason, heat). Do not invent a score, injury, or stakes.
- FRONT: up to three stories already chosen for A1. A dek is at most 20 words, under the headline, from the headline and the excerpt only.

Answer with races [{race, headline, copy}], watch [{id, why}], and deks [{id, dek}]. Use the race codes and ids you were given. Leave a list empty when you have nothing safe to say.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["races", "watch", "deks"],
  properties: {
    races: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["race", "headline", "copy"],
        properties: {
          race: { type: "string" },
          headline: { type: "string" },
          copy: { type: "string" },
        },
      },
    },
    watch: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "why"],
        properties: {
          id: { type: "string" },
          why: { type: "string" },
        },
      },
    },
    deks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "dek"],
        properties: {
          id: { type: "string" },
          dek: { type: "string" },
        },
      },
    },
  },
};

function responseText(data: Record<string, unknown>): string {
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text;
  const parts: string[] = [];
  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (!item || typeof item !== "object") continue;
      const block = item as Record<string, unknown>;
      if (typeof block.text === "string") parts.push(block.text);
      if (Array.isArray(block.content)) {
        for (const chunk of block.content) {
          if (!chunk || typeof chunk !== "object") continue;
          const row = chunk as Record<string, unknown>;
          if (typeof row.text === "string") parts.push(row.text);
        }
      }
    }
  }
  return parts.join("\n");
}

async function fetchRaceRows(editionDate: string): Promise<unknown[] | null> {
  const url = denoEnv("SUPABASE_URL");
  const key = denoEnv("SUPABASE_SERVICE_ROLE_KEY");
  const from = shiftYmd(editionDate, -2);
  if (!url || !key || !from) return null;
  const cols = "brief_date,race,headline,bullets,spend,links,notes,source,updated_at";
  try {
    const res = await fetch(
      `${url}/rest/v1/times_race_briefs?select=${cols}&brief_date=lte.${editionDate}&brief_date=gte.${from}&order=brief_date.desc`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

function frontFacts(stories: GameWrapCard[]): { id: string; headline: string; excerpt: string }[] {
  return [...stories]
    .filter((card) => card.editorFront != null && card.editorFront < 3 && card.headline)
    .sort((a, b) => a.editorFront! - b.editorFront!)
    .slice(0, 3)
    .map((card) => ({
      id: card.id,
      headline: card.headline,
      excerpt: (card.body || card.dek || "").replace(/\s+/g, " ").trim().slice(0, 600),
    }));
}

function watchFacts(games: WatchGame[]): Record<string, unknown>[] {
  return watchForCopy(games).map((game) => ({
    id: game.id,
    league: game.league,
    competition: game.competition,
    away: game.away.short || game.away.abbrev || game.away.name,
    home: game.home.short || game.home.abbrev || game.home.name,
    series: game.series,
    line: game.line,
    printReason: game.printReason,
    heat: game.heat,
    preseason: Boolean(game.preseason),
  }));
}

export async function askTimesCopy(input: {
  editionDate: string;
  races: RaceBrief[];
  watch: WatchGame[];
  front: GameWrapCard[];
}): Promise<TimesCopy | null> {
  if (copyDisabled()) return null;
  const apiKey = denoEnv("XAI_API_KEY");
  if (!apiKey) return null;
  const races = input.races.map(raceFacts);
  const watch = watchFacts(input.watch);
  const front = frontFacts(input.front);
  if (!races.length && !watch.length && !front.length) return null;
  try {
    const res = await fetch(`${XAI_BASE}/responses`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: COPY_MODEL,
        store: false,
        reasoning: { effort: "low" },
        max_output_tokens: 4000,
        input: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: JSON.stringify({ editionDate: input.editionDate, races, watch, front }),
          },
        ],
        text: { format: { type: "json_schema", name: "times_copy", schema: SCHEMA, strict: true } },
      }),
      signal: AbortSignal.timeout(COPY_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    const text = responseText(data).trim();
    const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)?.[1] ?? text;
    return parseTimesCopy(JSON.parse(fenced));
  } catch {
    return null;
  }
}

/** Race rows for the edition date (or the newest filing inside two days), then one copy call. */
export async function buildTimesCopy(input: {
  editionDate: string;
  watch: WatchGame[];
  front: GameWrapCard[];
}): Promise<TimesCopy | null> {
  if (copyDisabled()) return null;
  let races: RaceBrief[] = [];
  try {
    const rows = await fetchRaceRows(input.editionDate);
    races = rows ? (asRaceBriefsDesk(rows, input.editionDate)?.races ?? []) : [];
  } catch {
    races = [];
  }
  return askTimesCopy({ ...input, races });
}
