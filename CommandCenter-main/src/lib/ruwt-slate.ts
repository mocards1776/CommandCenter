/**
 * Live vs Today's Top split over an already-ranked RUWT slate.
 *
 * Pure partitioning only — never re-scores. Each bucket keeps the relative
 * order of the input, so RUWT ranking (rankRuwt*) stays the single source of
 * truth for ordering within Live and within Today's Top.
 */

export type RuwtSlateGameStatus = { live: boolean; final: boolean };

export type RuwtSlateEntry = { game: RuwtSlateGameStatus };

/**
 * In progress right now. MLB counts Warmup as live (abstractGameState "Live");
 * ESPN sports count state "in" (halftime, intermissions, delays included).
 */
export function isRuwtLive(entry: RuwtSlateEntry): boolean {
  return entry.game.live && !entry.game.final;
}

/** Scheduled for today and not yet started. */
export function isRuwtUpcoming(entry: RuwtSlateEntry): boolean {
  return !entry.game.live && !entry.game.final;
}

export function isRuwtFinal(entry: RuwtSlateEntry): boolean {
  return entry.game.final;
}

export type RuwtSlatePartition<T extends RuwtSlateEntry> = {
  /** In-progress games, RUWT order. Drives the global score-tab strip. */
  live: T[];
  /** Not-yet-started games, RUWT order (favorites / ranked bumps preserved). */
  upcoming: T[];
  /** Finished today, RUWT order. */
  finals: T[];
};

export function partitionRuwtSlate<T extends RuwtSlateEntry>(
  ranked: readonly T[],
): RuwtSlatePartition<T> {
  const live: T[] = [];
  const upcoming: T[] = [];
  const finals: T[] = [];
  for (const item of ranked) {
    if (isRuwtFinal(item)) finals.push(item);
    else if (item.game.live) live.push(item);
    else upcoming.push(item);
  }
  return { live, upcoming, finals };
}

export type RuwtTodaysTop<T> = { items: T[]; mode: "upcoming" | "finals" };

/**
 * Today's Top: best not-yet-started games. Once nothing is left to start,
 * falls back to today's best finals so the section isn't empty late at night.
 */
export function ruwtTodaysTop<T extends RuwtSlateEntry>(
  partition: RuwtSlatePartition<T>,
  limit = 6,
): RuwtTodaysTop<T> {
  if (partition.upcoming.length > 0) {
    return { items: partition.upcoming.slice(0, limit), mode: "upcoming" };
  }
  return { items: partition.finals.slice(0, limit), mode: "finals" };
}

const GENERIC_REASONS = new Set(["live", "upcoming", "final"]);

/** Ranking reasons worth showing on a card ("Your #1 team", "Both teams ranked"…). */
export function ruwtWhyReasons(reasons: readonly string[] | null | undefined, max = 2): string[] {
  const out: string[] = [];
  for (const r of reasons ?? []) {
    const t = r.trim();
    if (!t || GENERIC_REASONS.has(t.toLowerCase()) || out.includes(t)) continue;
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}
