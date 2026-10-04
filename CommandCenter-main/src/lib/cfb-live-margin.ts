/**
 * Live RUWT margin ease for a college-football game of the week.
 *
 * A 9–14 point game is already labeled Tight and scored as a +10 bonus.
 * That is not a penalty. It is just much smaller than a one-score game
 * (+28), and a lesser one-score game can stack a red zone and a kick on
 * top. For a true game of the week, bring every two-score margin (9–16)
 * up to the same closeness credit, still under the one-score bonus.
 * Three scores (17+) are unchanged.
 */

/** Closeness credit after the ease. One-score remains +28. */
export const CFB_GOTW_TWO_SCORE_CREDIT = 24;

/**
 * Leader win chance at or above this is effectively over.
 * ESPN's 99.9 sits here. 98.6 is the same game. A one-score game at 89 is not.
 */
export const CFB_DECIDED_WIN_PCT = 97;

/**
 * Two scores with no win probability, and the clock at or under this in the
 * 4th (or OT). 2:36 is inside. A one-score game at 4:00 is not this case.
 */
export const CFB_DECIDED_CLOCK_SEC = 3 * 60;

/**
 * Ceiling once a live game is effectively over.
 * A one-score game is 68. A two-score game that is still a game is live 40 + tight 10 = 50.
 * 49 sits under both, so rank, FPI, and a favorite slider cannot put a decided game first.
 */
export const CFB_DECIDED_LIVE_CAP = 49;

export type CfbGameOfTheWeekInput = {
  bothRanked: boolean;
  bothSec: boolean;
  bothTopFpi: boolean;
  /** ABC / CBS / NBC / FOX — the window that also earns Marquee. */
  nationalMarquee: boolean;
  awayRecord: string | null;
  homeRecord: string | null;
};

/** Losses from an ESPN overall record ("5-0", "4-1", "4-0-1"). */
export function cfbRecordLosses(record: string | null | undefined): number | null {
  if (record == null) return null;
  const match = record.trim().match(/^(\d+)\s*-\s*(\d+)/);
  if (!match) return null;
  const losses = Number(match[2]);
  return Number.isFinite(losses) ? losses : null;
}

/**
 * Undefeated, or the same October stakes: each side has at most one loss.
 * A missing record is not stakes. Two losses is a different game.
 */
export function cfbUndefeatedOrEquivalentStakes(
  awayRecord: string | null | undefined,
  homeRecord: string | null | undefined,
): boolean {
  const away = cfbRecordLosses(awayRecord);
  const home = cfbRecordLosses(homeRecord);
  if (away == null || home == null) return false;
  return away <= 1 && home <= 1;
}

/** Ranked SEC clash, undefeated-or-equivalent, top FPI, national marquee window. */
export function cfbIsGameOfTheWeekMatchup(input: CfbGameOfTheWeekInput): boolean {
  return (
    input.bothRanked &&
    input.bothSec &&
    input.bothTopFpi &&
    input.nationalMarquee &&
    cfbUndefeatedOrEquivalentStakes(input.awayRecord, input.homeRecord)
  );
}

/**
 * Points the ordinary margin bucket already applied for a two-score lead.
 * 9–14 is the Tight bonus. 15–16 sits in the ranked soft drag (−3).
 * Game of the week implies both teams are ranked, so the unranked drag is unused.
 */
export function cfbTwoScoreBucketPoints(diff: number): number {
  if (diff <= 14) return 10;
  return -3;
}

/**
 * Extra live points that land a two-score game of the week on
 * CFB_GOTW_TWO_SCORE_CREDIT. Zero for one-score games (they already have
 * the full bonus) and for three-score-or-worse games.
 */
export function cfbGotwTwoScoreEase(diff: number, gameOfTheWeek: boolean): number {
  if (!gameOfTheWeek || diff <= 8 || diff > 16) return 0;
  return CFB_GOTW_TWO_SCORE_CREDIT - cfbTwoScoreBucketPoints(diff);
}

/**
 * A side at or inside this FPI is still a national game.
 * Best FPI past it, with nobody ranked, is the FPI-100s slate.
 */
export const CFB_SITUATION_FPI_LINE = 40;

/**
 * Quarter from the scoreboard period, then the clock line.
 * 5 is overtime. Null means the quarter is not on the row.
 */
export function cfbLiveQuarter(input: {
  period: number | null | undefined;
  detail: string;
  inOt: boolean;
}): 1 | 2 | 3 | 4 | 5 | null {
  if (input.inOt) return 5;
  const period = input.period ?? null;
  if (period === 1 || period === 2 || period === 3 || period === 4) return period;
  if (period != null && period >= 5) return 5;
  if (/\b4th\b/.test(input.detail)) return 4;
  if (/\b3rd\b/.test(input.detail)) return 3;
  if (/\b2nd\b/.test(input.detail)) return 2;
  if (/\b1st\b/.test(input.detail)) return 1;
  return null;
}

/**
 * Red zone, upset, and the other situation extras are not a flat bonus.
 * They count once the game is out of the first half, or the slate is ranked,
 * on a national window, or has a top-40 FPI side.
 * An early unranked FPI-100s game keeps the one-score credit. The extras
 * can still be named on the chip line; they do not add points.
 */
export function cfbSituationExtrasCount(input: {
  quarter: 1 | 2 | 3 | 4 | 5 | null;
  ranked: boolean;
  bestFpi: number | null;
  nationalMarquee: boolean;
}): boolean {
  if (input.quarter !== 1 && input.quarter !== 2) return true;
  if (input.ranked || input.nationalMarquee) return true;
  if (input.bestFpi != null && input.bestFpi <= CFB_SITUATION_FPI_LINE) return true;
  return false;
}

/** Higher of the two side win chances. Percents are 0–100. Missing sides are ignored. */
export function cfbLeaderWinPct(
  homeWinPct: number | null | undefined,
  awayWinPct: number | null | undefined,
): number | null {
  const vals = [homeWinPct, awayWinPct].filter(
    (n): n is number => typeof n === "number" && Number.isFinite(n),
  );
  if (!vals.length) return null;
  return Math.max(...vals);
}

/**
 * Win chance for the 97% line.
 * The RUWT bar is the probabilities feed. That number wins when ESPN published it.
 * The scoreboard last play is only the fallback: extra points and kickoffs often
 * omit it while the bar still shows 99%. A missing bar does not invent a chance.
 */
export function cfbRankingWinPct(
  barLeaderPct: number | null | undefined,
  lastPlayLeaderPct: number | null | undefined,
): number | null {
  if (typeof barLeaderPct === "number" && Number.isFinite(barLeaderPct)) return barLeaderPct;
  if (typeof lastPlayLeaderPct === "number" && Number.isFinite(lastPlayLeaderPct)) {
    return lastPlayLeaderPct;
  }
  return null;
}

/**
 * True when this margin is no longer a live game.
 * A published leader win chance at or above CFB_DECIDED_WIN_PCT wins over the clock:
 * 99% with time left is over, and 70% with two minutes left is not.
 * With no win chance, only a two-score lead (9–16) late and under CFB_DECIDED_CLOCK_SEC.
 * Three scores (17+) stay on the blowout path. One score without a win chance stays in doubt.
 */
export function cfbEffectivelyDecided(input: {
  diff: number | null;
  late: boolean;
  clockSec: number | null;
  leaderWinPct: number | null;
}): boolean {
  const wp = input.leaderWinPct;
  if (wp != null && Number.isFinite(wp)) return wp >= CFB_DECIDED_WIN_PCT;
  if (input.diff == null || input.diff < 9 || input.diff > 16) return false;
  if (!input.late) return false;
  if (input.clockSec == null || input.clockSec > CFB_DECIDED_CLOCK_SEC) return false;
  return true;
}
