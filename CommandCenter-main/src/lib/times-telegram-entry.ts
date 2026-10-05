/**
 * The Times front for the edition-ready Telegram alert.
 * Bundled by scripts/bundle-times-telegram.mjs into
 * supabase/functions/times-telegram/front.bundle.js.
 *
 * Runs the same buildEdition the paper runs, so the alert leads with the
 * story A1 leads with (editor's front first, then the rule desk's order).
 */
import { buildEdition, type FavoritesFrontPage } from "./newspaper-sections";
import type { GameWrapCard } from "./newspaper-sports";

export type FrontStory = { id: string; headline: string; teamName: string | null };

function slim(card: GameWrapCard | null | undefined): FrontStory | null {
  const headline = String(card?.headline ?? "").replace(/\s+/g, " ").trim();
  if (!card || !headline) return null;
  return { id: card.id, headline, teamName: card.teamName ?? null };
}

/** A1's lead, second and third stories, in the order the front runs them. */
export function frontStories(stories: unknown[], edition: string): FrontStory[] {
  const paper = buildEdition({ stories: stories as GameWrapCard[], clubs: [], edition });
  const front = paper.pages.find((p) => p.kind === "favorites-front") as FavoritesFrontPage | undefined;
  if (!front) return [];
  return [front.lead, front.second, front.third].map(slim).filter((s): s is FrontStory => Boolean(s));
}
