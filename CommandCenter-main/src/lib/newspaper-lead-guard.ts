/**
 * A1 / Telegram alert lead bans for Thompson Times.
 * Betting sheets and previews of already-final games never open the front.
 *
 * NOTE: The live compose.bundle and newspaper-sections.ts on this branch also
 * inline these rules; this module is the extracted helper surface for review.
 * Prefer the inlined versions in newspaper-sections.ts once that file is on
 * this branch (same logic).
 */
import type { GameWrapCard } from "./newspaper-sports";

export function isBettingPreview(card: GameWrapCard): boolean {
  const head = `${card.headline} ${card.dek ?? ""}`;
  return /\bhow to bet\b|\bprop plays?\b|\bbetting (?:lines?|tips?|preview|odds)\b|\bagainst the spread\b|\bpicks and props\b|\btop prop\b|\bmoneyline\b|\bover\/under\b|\b(odds|spreads?) to (?:bet|know|watch)\b/i.test(
    head,
  );
}
