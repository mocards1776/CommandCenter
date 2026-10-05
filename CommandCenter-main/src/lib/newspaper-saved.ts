/**
 * Saved Thompson Times stories. The snapshot lives past the edition rollover.
 */
import { cleanStoryCopy } from "./newspaper-copy.ts";
import { storySource } from "./newspaper-source.ts";
import type { GameWrapCard } from "./newspaper-sports.ts";

export type SavedArticle = {
  id: string;
  storyId: string;
  headline: string;
  dek: string | null;
  body: string | null;
  byline: string | null;
  source: string | null;
  url: string | null;
  image: string | null;
  section: string | null;
  editionDate: string | null;
  savedAt: string;
};

export type SavedSnapshot = Omit<SavedArticle, "id" | "savedAt">;

function editionDay(edition: string | null | undefined): string | null {
  const day = edition?.slice(0, 10) ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

function bylineOf(card: GameWrapCard): string | null {
  const author = cleanStoryCopy(card.body).author;
  const source = storySource(card) ?? card.dateline ?? null;
  if (author && source) return `${author} · ${source}`;
  return author || source || card.dateline || null;
}

export function snapshotFromCard(card: GameWrapCard, edition: string | null | undefined): SavedSnapshot {
  return {
    storyId: card.id,
    headline: card.headline,
    dek: card.dek,
    body: card.body,
    byline: bylineOf(card),
    source: storySource(card) ?? card.sportLabel ?? null,
    url: card.wrapHref ?? card.gameHref ?? card.feedUrl ?? null,
    image: card.photo ?? null,
    section: card.sportLabel || null,
    editionDate: editionDay(edition),
  };
}

export function cardFromSaved(row: SavedArticle): GameWrapCard {
  return {
    id: row.storyId,
    favoriteKey: "",
    teamName: row.source ?? "",
    teamHref: "",
    sportLabel: row.section || "Saved",
    leaguePath: null,
    headline: row.headline,
    dek: row.dek,
    body: row.body,
    scoreLine: null,
    when: row.editionDate,
    won: null,
    gameHref: null,
    wrapHref: row.url,
    feedUrl: null,
    gameId: null,
    stats: [],
    leaders: [],
    teamStats: [],
    division: [],
    photo: row.image,
    dateline: row.byline,
    caption: row.source,
  };
}
