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
  /** In-progress games, RUWT order. First choice for the global score-tab strip. */
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

export type ScoredSlateEntry = RuwtSlateEntry & { id: string; score: number };

export type ScoreStripSource = "live" | "upcoming" | "finals" | "empty";

/**
 * Pinned board favorite → `sport:teamId` for the score strip.
 * MLB uses the MLB team id; other leagues use the ESPN id in `espnPath`.
 */
export function ruwtPinnedTeamKey(fav: {
  kind: string;
  league?: string | null;
  sport?: string | null;
  mlbTeamId?: number | null;
  espnPath?: string | null;
}): string | null {
  if (fav.kind !== "team") return null;
  const espn = fav.espnPath?.match(/\/teams\/(\d+)/)?.[1];
  if (fav.league === "MLB") return fav.mlbTeamId != null ? `mlb:${fav.mlbTeamId}` : null;
  if (fav.league === "NHL" && espn) return `nhl:${espn}`;
  if (fav.league === "NFL" && espn) return `nfl:${espn}`;
  if (fav.sport === "Football" && fav.league === "NCAA" && espn) return `cfb:${espn}`;
  if (fav.sport === "Soccer" && espn) return `soccer:${espn}`;
  return null;
}

export function scoreStripTeamKeys(
  sport: string,
  awayId: string | number,
  homeId: string | number,
): [string, string] {
  return [`${sport}:${awayId}`, `${sport}:${homeId}`];
}

/** RUWT interest slider (>0) or a pinned favorite club. */
export function isScoreStripFavorite(
  teamKeys: readonly string[],
  interest: Readonly<Record<string, number>> | null | undefined,
  pinned: ReadonlySet<string>,
): boolean {
  for (const key of teamKeys) {
    if (pinned.has(key)) return true;
    const id = key.slice(key.indexOf(":") + 1);
    if ((interest?.[id] ?? 0) > 0) return true;
  }
  return false;
}

/**
 * Global score-tab strip.
 * 1. Any game still live → those live games only, in live RUWT heat order.
 *    Finals and upcoming stay off the ribbon so they don't mix with heat.
 * 2. Nothing live, games still to start → Today's Top (upcoming), same order.
 * 3. Slate is all final → Today's Top order of those finals. Live heat flattens
 *    decided games, so this does not re-sort finals by heat, favorites, or yesterday.
 * Empty only when the slate has no games.
 */
export function scoreStripItems<T extends ScoredSlateEntry>(
  partition: RuwtSlatePartition<T>,
): { source: ScoreStripSource; items: T[] } {
  if (partition.live.length > 0) {
    return { source: "live", items: partition.live.slice() };
  }
  if (partition.upcoming.length > 0) {
    return {
      source: "upcoming",
      items: ruwtTodaysTop(partition, partition.upcoming.length).items,
    };
  }
  const items = ruwtTodaysTop(partition, partition.finals.length).items;
  return { source: items.length > 0 ? "finals" : "empty", items };
}

const GENERIC_REASONS = new Set(["live", "upcoming", "final", "live now"]);

/**
 * Drama chips on a RUWT card. "Live" is dropped because the section already
 * says the game is live. Order otherwise matches the scorer.
 */
export function ruwtCardReasons(reasons: readonly string[] | null | undefined): string[] {
  const out: string[] = [];
  for (const raw of reasons ?? []) {
    const t = raw.trim();
    if (!t || GENERIC_REASONS.has(t.toLowerCase()) || out.includes(t)) continue;
    out.push(t);
  }
  return out;
}

/** First chip to drop when the reason line would wrap. */
export function withoutClosestUpset(reasons: readonly string[]): string[] {
  return reasons.filter((reason) => reason.toLowerCase() !== "closest upset");
}

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
