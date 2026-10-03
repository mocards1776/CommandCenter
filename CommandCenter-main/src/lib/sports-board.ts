/** Teams board ordering: surface clubs that are playing now over finished seasons. */

import type { GameChip, SportsFavorite, TeamSnapshot, TourSnapshot } from "./sports";

export const BOARD_TIER = {
  live: 0,
  today: 1,
  soon: 2,
  inSeason: 3,
  unknown: 4,
  offseason: 5,
} as const;

export type BoardTier = (typeof BOARD_TIER)[keyof typeof BOARD_TIER];

const SOON_DAYS = 3;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DAY_MS = 86_400_000;

function chicagoToday(now: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get("year"), m: get("month") - 1, d: get("day") };
}

/**
 * Days from today (Central) to a chip's `when` label, e.g. "Sat, Oct 3, 7:00 PM".
 * Labels carry no year, so pick the year that lands closest to today.
 */
export function chipDayOffset(chip: GameChip | null, now = new Date()): number | null {
  const match = chip?.when?.match(/\b([A-Za-z]{3})[a-z]*\.? (\d{1,2})\b/);
  if (!match) return null;
  const month = MONTHS.indexOf(match[1]!.toLowerCase());
  const day = Number(match[2]);
  if (month < 0 || !day) return null;
  const today = chicagoToday(now);
  const base = Date.UTC(today.y, today.m, today.d);
  let best: number | null = null;
  for (const y of [today.y - 1, today.y, today.y + 1]) {
    const diff = Math.round((Date.UTC(y, month, day) - base) / DAY_MS);
    if (best == null || Math.abs(diff) < Math.abs(best)) best = diff;
  }
  return best;
}

export function teamBoardTier(snap: TeamSnapshot | null | undefined, now = new Date()): BoardTier {
  if (!snap) return BOARD_TIER.unknown;
  if (snap.nextGame?.live || snap.lastGame?.live) return BOARD_TIER.live;
  const next = chipDayOffset(snap.nextGame, now);
  const last = chipDayOffset(snap.lastGame, now);
  if (next === 0 || last === 0) return BOARD_TIER.today;
  if (snap.nextGame) {
    if (next != null && next > 0 && next <= SOON_DAYS) return BOARD_TIER.soon;
    return BOARD_TIER.inSeason;
  }
  return BOARD_TIER.offseason;
}

export function tourBoardTier(snap: TourSnapshot | null | undefined): BoardTier {
  if (!snap) return BOARD_TIER.unknown;
  if (/in progress/i.test(snap.status ?? "")) return BOARD_TIER.live;
  return snap.eventName ? BOARD_TIER.inSeason : BOARD_TIER.unknown;
}

/** Days from today (Central) to a `YYYY-MM-DD` date. */
export function isoDayOffset(iso: string | null | undefined, now = new Date()): number | null {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const today = chicagoToday(now);
  const target = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Math.round((target - Date.UTC(today.y, today.m, today.d)) / DAY_MS);
}

/** Stable sort: relevance tier first, the user's saved order breaks ties. */
export function rankBoardFavorites(
  favorites: SportsFavorite[],
  tierFor: (fav: SportsFavorite) => BoardTier,
): SportsFavorite[] {
  return favorites
    .map((fav, index) => ({ fav, index, tier: tierFor(fav) }))
    .sort((a, b) => a.tier - b.tier || a.index - b.index)
    .map((row) => row.fav);
}
