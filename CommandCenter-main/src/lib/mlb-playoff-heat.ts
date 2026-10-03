/**
 * October MLB on the RUWT board is the postseason. Regular season is over,
 * so every game dated October or November is a playoff series game.
 *
 * Live and Today's Top share one score and only partition afterward.
 * The heavy series weight stays off the live path. Live gets a small nudge.
 */

/** Today's Top / not-in-progress. Clears a typical other-sport pregame. */
export const MLB_PLAYOFF_SERIES_HEAT = 54;

/**
 * Live path only. Small enough that a blowout (including a late Cardinals
 * blowout) still finishes under a one-score NFL, NHL, or CFB game.
 */
export const MLB_PLAYOFF_LIVE_NUDGE = 4;

export type MlbPostseasonHeatInput = {
  live: boolean;
  final: boolean;
  officialDate?: string | null;
};

export type MlbPostseasonHeat = {
  points: number;
  reason: string;
};

/** Calendar month from the game date, or from Chicago "now" when the date is missing. */
export function mlbBoardMonth(
  officialDate: string | null | undefined,
  now = new Date(),
): number | null {
  const iso =
    officialDate && /^\d{4}-\d{2}-\d{2}$/.test(officialDate)
      ? officialDate
      : now.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const month = Number(iso.slice(5, 7));
  return month >= 1 && month <= 12 ? month : null;
}

/**
 * Postseason heat for one MLB game.
 * In progress (and not final) → nudge. Anything else in Oct/Nov → series weight.
 * A row flagged both live and final is a final, matching the RUWT partition.
 */
export function mlbPostseasonHeat(
  game: MlbPostseasonHeatInput,
  now = new Date(),
): MlbPostseasonHeat | null {
  const month = mlbBoardMonth(game.officialDate, now);
  if (month !== 10 && month !== 11) return null;
  if (game.live && !game.final) {
    return { points: MLB_PLAYOFF_LIVE_NUDGE, reason: "Playoffs" };
  }
  return { points: MLB_PLAYOFF_SERIES_HEAT, reason: "Playoff series" };
}
