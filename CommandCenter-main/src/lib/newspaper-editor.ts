/**
 * The AI editor. Once per press, after the copy is filed and before the paper is
 * laid out, Grok reads the top of the budget and says what leads, what follows,
 * and what gets spiked. Its answer is stamped onto the filed stories, so every
 * device that opens the edition sets the same front. Box scores, schedules,
 * standings, weather and agate never pass through here.
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

export const EDITOR_CANDIDATES = 24;
/** Below this there is nothing to edit; the rule desk sets it. */
export const EDITOR_MIN_CANDIDATES = 4;
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
  /** The rule desk's order (0 is its lead) and score. */
  ruleRank: number;
  ruleScore: number;
};

export type EditorRequest = {
  edition: string;
  candidates: EditorCandidate[];
};

export type EditorDesk = {
  /** Every candidate id the editor placed, best first. The first three are the front. */
  order: string[];
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

export function editorRequest(stories: GameWrapCard[], edition: string, limit = EDITOR_CANDIDATES): EditorRequest {
  const candidates = editorCandidates(stories, edition, limit).map((card, i): EditorCandidate => {
    const dek = clip(card.dek, DEK_CHARS);
    const body = clip(card.body, SNIPPET_CHARS);
    return {
      id: card.id,
      headline: card.headline,
      dek,
      snippet: body && body !== dek ? body : null,
      favoriteKey: card.favoriteKey || null,
      desk: deskOf(card),
      league: card.leaguePath ? sportSectionId(card.leaguePath).code : null,
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
  return { edition, candidates };
}

const ids = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

/**
 * Hold the editor to the budget it was shown. Unknown ids drop, duplicates drop,
 * a story cannot both lead and be spiked, and the editor cannot spike the paper
 * down to nothing. Null means the answer is unusable and the rule desk sets it.
 */
export function readEditorDesk(raw: unknown, candidateIds: string[]): EditorDesk | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const known = new Set(candidateIds);
  const front = [rec.lead, rec.second, rec.third].filter((v): v is string => typeof v === "string");
  const order: string[] = [];
  for (const id of [...front, ...ids(rec.order)]) {
    if (known.has(id) && !order.includes(id)) order.push(id);
  }
  const placed = new Set(order.slice(0, 3));
  let spike = [...new Set(ids(rec.spike))].filter((id) => known.has(id) && !placed.has(id));
  // A spike-happy answer is a bad answer, not an empty paper.
  const maxSpike = Math.max(0, Math.min(Math.floor(candidateIds.length / 2), candidateIds.length - 3));
  if (spike.length > maxSpike) spike = spike.slice(0, maxSpike);
  const spiked = new Set(spike);
  const kept = order.filter((id) => !spiked.has(id));
  if (!kept.length) return null;
  // Whatever the editor neither placed nor spiked keeps the rule desk's order behind its picks.
  for (const id of candidateIds) {
    if (!spiked.has(id) && !kept.includes(id)) kept.push(id);
  }
  const rationale = typeof rec.rationale === "string" ? rec.rationale.trim().slice(0, 400) : "";
  const model = typeof rec.model === "string" ? rec.model : null;
  return { order: kept, spike, rationale, model };
}

export function clearEditorStamps<T extends GameWrapCard>(stories: T[]): T[] {
  return stories.map((card) => (card.editorRank == null && !card.editorSpiked ? card : withoutEditorStamps(card)));
}

export function stampEditorDesk<T extends GameWrapCard>(stories: T[], desk: EditorDesk | null): T[] {
  const clean = clearEditorStamps(stories);
  if (!desk) return clean;
  const rank = new Map(desk.order.map((id, i) => [id, i]));
  const spiked = new Set(desk.spike);
  return clean.map((card) => {
    if (spiked.has(card.id)) return { ...card, editorSpiked: true };
    const r = rank.get(card.id);
    return r == null ? card : { ...card, editorRank: r };
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
  if (request.candidates.length < EDITOR_MIN_CANDIDATES) return { stories: clean, desk: null };
  let raw: unknown = null;
  try {
    raw = await ask(request);
  } catch {
    return { stories: clean, desk: null };
  }
  const desk = readEditorDesk(raw, request.candidates.map((c) => c.id));
  return { stories: stampEditorDesk(clean, desk), desk };
}
