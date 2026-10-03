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
