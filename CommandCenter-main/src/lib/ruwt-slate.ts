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
 * 1. Live games, RUWT order, when any are in progress.
 * 2. Else today's upcoming (Today's Top source), RUWT order.
 * 3. Else recent finals: favorite clubs first, yesterday before today, then RUWT score.
 * Empty only when live, upcoming, and finals are all empty.
 */
export function scoreStripItems<T extends ScoredSlateEntry>(
  partition: RuwtSlatePartition<T>,
  opts?: {
    yesterdayFinals?: readonly T[];
    isFavorite?: (item: T) => boolean;
  },
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
  const items = orderRecentFinals(
    partition.finals,
    opts?.yesterdayFinals ?? [],
    opts?.isFavorite ?? (() => false),
  );
  return { source: items.length > 0 ? "finals" : "empty", items };
}

function orderRecentFinals<T extends ScoredSlateEntry>(
  today: readonly T[],
  yesterday: readonly T[],
  isFavorite: (item: T) => boolean,
): T[] {
  type Row = { item: T; recency: number; favorite: boolean };
  const rows = new Map<string, Row>();
  const add = (item: T, recency: number) => {
    const favorite = isFavorite(item);
    const prev = rows.get(item.id);
    if (!prev) {
      rows.set(item.id, { item, recency, favorite });
      return;
    }
    if (recency < prev.recency) {
      rows.set(item.id, { item, recency, favorite: favorite || prev.favorite });
    } else if (favorite) {
      prev.favorite = true;
    }
  };
  for (const item of yesterday) add(item, 0);
  for (const item of today) add(item, 1);
  return [...rows.values()]
    .sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      if (a.recency !== b.recency) return a.recency - b.recency;
      return b.item.score - a.item.score || a.item.id.localeCompare(b.item.id);
    })
    .map((row) => row.item);
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
