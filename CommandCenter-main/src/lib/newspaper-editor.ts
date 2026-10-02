/**
 * The AI editor. Once per press, after the copy is filed and before the paper is
 * laid out, Grok reads the top of the news budget and says what fronts the
 * paper, how the news runs, and what gets spiked. Its answer is stamped onto
 * the filed stories, so every device that opens the edition sets the same front.
 *
 * Game wraps (wire finals, recaps, club wraps) are not the editor's to rank or
 * spike: the rule desk files one for every game. The editor sees them only as
 * context, so it can weigh a big league story against last night's results.
 * Box scores, schedules, standings, leaders, weather and agate never pass through here.
 *
 * Anything wrong with the answer — no answer, bad JSON, ids it was never shown —
 * and the edition runs on the rule desk exactly as before.
 */
import { favoriteDeskWeight, withoutEditorStamps } from "./newspaper.ts";
import { cleanStoryCopy } from "./newspaper-copy.ts";
import { storySource } from "./newspaper-source.ts";
import {
  editorCandidates,
  isPreviewStory,
  isRecapStory,
  sportSectionId,
  storyRank,
} from "./newspaper-sections.ts";
import type { GameWrapCard } from "./newspaper-sports";

/** News stories the editor ranks. Game wraps ride along as context and never count. */
export const EDITOR_NEWS_BUDGET = 24;
/** Wraps shown as context, so a busy slate cannot crowd the request. */
export const EDITOR_GAME_CONTEXT = 16;
/** Below this much news there is nothing to edit; the rule desk sets it. */
export const EDITOR_MIN_NEWS = 3;
const FRONT_SLOTS = 3;
const DEK_CHARS = 200;
const SNIPPET_CHARS = 320;

export type EditorCandidate = {
  id: string;
  headline: string;
  dek: string | null;
  snippet: string | null;
  /** Followed club key, or null for league copy. */
  favoriteKey: string | null;
  /** "home" (Cardinals/Blues/Mizzou), "followed", or "league". */
  desk: "home" | "followed" | "league";
  league: string | null;
  status: string | null;
  source: string | null;
  when: string | null;
  final: boolean;
  recap: boolean;
  preview: boolean;
  postseason: boolean;
  holdover: boolean;
  /** The rule desk's order (0 is its first) and score. */
  ruleRank: number;
  ruleScore: number;
};

/** A game's wrap, as context: enough to know what happened, not copy to rank. */
export type EditorGame = {
  id: string;
  headline: string;
  score: string | null;
  favoriteKey: string | null;
  desk: EditorCandidate["desk"];
  league: string | null;
  status: string | null;
  postseason: boolean;
  /** Whether the wrap has enough copy to front the paper. */
  hasCopy: boolean;
};

export type EditorRequest = {
  edition: string;
  candidates: EditorCandidate[];
  games: EditorGame[];
};

export type EditorDesk = {
  /** A1 lead, second, third — news or game ids. Empty slots are the rule desk's. */
  front: string[];
  /** News ids, best first. Wraps keep the rule desk's places. */
  order: string[];
  /** News ids that do not run. */
  spike: string[];
  rationale: string;
  model?: string | null;
};

function clip(text: string | null | undefined, max: number): string | null {
  const clean = cleanStoryCopy(text).text.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

function deskOf(card: GameWrapCard): EditorCandidate["desk"] {
  if (!card.favoriteKey && !card.followed) return "league";
  return card.favoriteKey && favoriteDeskWeight(card.favoriteKey) >= 100 ? "home" : "followed";
}

const leagueOf = (card: GameWrapCard) => (card.leaguePath ? sportSectionId(card.leaguePath).code : null);

export function editorRequest(
  stories: GameWrapCard[],
  edition: string,
  limit = EDITOR_NEWS_BUDGET,
  gameLimit = EDITOR_GAME_CONTEXT,
): EditorRequest {
  const { news, games } = editorCandidates(stories, edition, limit, gameLimit);
  const candidates = news.map((card, i): EditorCandidate => {
    const dek = clip(card.dek, DEK_CHARS);
    const body = clip(card.body, SNIPPET_CHARS);
    return {
      id: card.id,
      headline: card.headline,
      dek,
      snippet: body && body !== dek ? body : null,
      favoriteKey: card.favoriteKey || null,
      desk: deskOf(card),
      league: leagueOf(card),
      status: card.status ?? null,
      source: storySource(card) ?? null,
      when: card.when,
      final: Boolean(card.status && /final/i.test(card.status)),
      recap: isRecapStory(card),
      preview: isPreviewStory(card),
      postseason: Boolean(card.postseason),
      holdover: Boolean(card.holdover),
      ruleRank: i,
      ruleScore: storyRank(card, edition),
    };
  });
  const context = games.map(
    (card): EditorGame => ({
      id: card.id,
      headline: card.headline,
      score: card.scoreLine,
      favoriteKey: card.favoriteKey || null,
      desk: deskOf(card),
      league: leagueOf(card),
      status: card.status ?? null,
      postseason: Boolean(card.postseason),
      hasCopy: cleanStoryCopy(card.body).text.length >= 400,
    }),
  );
  return { edition, candidates, games: context };
}

const ids = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

/**
 * Hold the editor to the budget it was shown. Unknown ids drop, duplicates drop,
 * it may front a game but never rank or spike one, a front story cannot be
 * spiked, and it cannot spike the paper down to nothing. Null means the answer
 * is unusable and the rule desk sets the paper.
 */
export function readEditorDesk(raw: unknown, newsIds: string[], gameIds: string[] = []): EditorDesk | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const news = new Set(newsIds);
  const frontable = new Set([...newsIds, ...gameIds]);
  const front: string[] = [];
  for (const id of ids(rec.front)) {
    if (front.length < FRONT_SLOTS && frontable.has(id) && !front.includes(id)) front.push(id);
  }
  const fronted = new Set(front);
  let spike = [...new Set(ids(rec.spike))].filter((id) => news.has(id) && !fronted.has(id));
  // A spike-happy answer is a bad answer, not an empty paper.
  const maxSpike = Math.max(0, Math.min(Math.floor(newsIds.length / 2), newsIds.length - 2));
  if (spike.length > maxSpike) spike = spike.slice(0, maxSpike);
  const spiked = new Set(spike);
  const order: string[] = [];
  for (const id of ids(rec.order)) {
    if (news.has(id) && !spiked.has(id) && !order.includes(id)) order.push(id);
  }
  if (!front.length && !order.length && !spike.length) return null;
  // News the editor neither placed nor spiked keeps the rule desk's order behind its picks.
  for (const id of newsIds) {
    if (!spiked.has(id) && !order.includes(id)) order.push(id);
  }
  const rationale = typeof rec.rationale === "string" ? rec.rationale.trim().slice(0, 400) : "";
  const model = typeof rec.model === "string" ? rec.model : null;
  return { front, order, spike, rationale, model };
}

export function clearEditorStamps<T extends GameWrapCard>(stories: T[]): T[] {
  return stories.map((card) =>
    card.editorRank == null && card.editorFront == null && !card.editorSpiked ? card : withoutEditorStamps(card),
  );
}

export function stampEditorDesk<T extends GameWrapCard>(stories: T[], desk: EditorDesk | null): T[] {
  const clean = clearEditorStamps(stories);
  if (!desk) return clean;
  const rank = new Map(desk.order.map((id, i) => [id, i]));
  const front = new Map(desk.front.map((id, i) => [id, i]));
  const spiked = new Set(desk.spike);
  return clean.map((card) => {
    if (spiked.has(card.id)) return { ...card, editorSpiked: true };
    const r = rank.get(card.id);
    const f = front.get(card.id);
    if (r == null && f == null) return card;
    return { ...card, ...(r != null ? { editorRank: r } : {}), ...(f != null ? { editorFront: f } : {}) };
  });
}

/**
 * Run the editor over a filed edition. `ask` posts the request to the
 * newspaper-editor edge function; any failure leaves the rule desk's paper.
 */
export async function editEdition<T extends GameWrapCard>(
  stories: T[],
  edition: string,
  ask: (request: EditorRequest) => Promise<unknown>,
): Promise<{ stories: T[]; desk: EditorDesk | null }> {
  const clean = clearEditorStamps(stories);
  const request = editorRequest(clean, edition);
  if (request.candidates.length < EDITOR_MIN_NEWS) return { stories: clean, desk: null };
  let raw: unknown = null;
  try {
    raw = await ask(request);
  } catch {
    return { stories: clean, desk: null };
  }
  const desk = readEditorDesk(
    raw,
    request.candidates.map((c) => c.id),
    request.games.map((g) => g.id),
  );
  return { stories: stampEditorDesk(clean, desk), desk };
}
