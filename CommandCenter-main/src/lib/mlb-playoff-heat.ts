/**
 * October MLB on the RUWT board is the postseason. Regular season is over,
 * so every game dated October or November is a playoff series game.
 *
 * Live and Today's Top share one score and only partition afterward.
 * The heavy series weight stays off the live path. Live gets a small nudge.
 *
 * Live close-game credit follows the same clock-ladder idea as NHL: a tie
 * or one-run in innings 1–3 keeps the chip but not late-game points. The
 * credit grows through the middle innings and is full in the 7th+ / extras.
 */

import { playoffElimination } from "./playoff-series.ts";

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

/** Full live close-game credits — applied only in the 7th+ and extras. */
export const MLB_TIE_CREDIT = 28;
export const MLB_ONE_RUN_CREDIT = 24;
export const MLB_WITHIN_TWO_CREDIT = 14;
export const MLB_TIGHT_CREDIT = 8;
export const MLB_BLOWOUT_PENALTY = -16;
export const MLB_BLOWOUT_MARGIN = 6;

/** One club out with a loss. Smaller before the middle innings. */
export const MLB_ELIM_EARLY = 10;
export const MLB_ELIM_LIVE = 22;
/** Both clubs out with a loss. Stronger than a one-sided elimination. */
export const MLB_WTA_EARLY = 14;
export const MLB_WTA_LIVE = 32;

export function mlbInningNumber(label: string | null | undefined): number | null {
  if (!label) return null;
  const text = label.toLowerCase();
  if (/\bextra/.test(text)) return 10;
  const match = text.match(/\b(\d+)(?:st|nd|rd|th)\b/);
  if (!match) return null;
  const inning = Number(match[1]);
  return Number.isFinite(inning) && inning >= 1 ? inning : null;
}

export function mlbInningIsExtras(label: string | null | undefined, inning = mlbInningNumber(label)): boolean {
  if (inning != null && inning >= 10) return true;
  return /extra|10th|11th|12th|13th|14th|15th|16th|17th|18th/.test((label ?? "").toLowerCase());
}

export function mlbInningIsLate(label: string | null | undefined, inning = mlbInningNumber(label)): boolean {
  if (mlbInningIsExtras(label, inning)) return false;
  if (inning != null && inning >= 7) return true;
  const text = (label ?? "").toLowerCase();
  return (
    /\b(7th|8th|9th)\b/.test(text) ||
    /mid\s*7|top\s*7|bot\s*7|end\s*7|mid\s*8|top\s*8|bot\s*8|end\s*8|mid\s*9|top\s*9|bot\s*9|end\s*9/.test(
      text,
    )
  );
}

/**
 * 0–1 scale for tie / close-game credit.
 * 1–3: little. 4: a step up. 5–6: middle. 7+ / extras: full.
 * An unreadable live inning stays on the early step so it cannot top the board.
 */
export function mlbCloseGameScale(inning: number | null, extras: boolean): number {
  if (extras || (inning != null && inning >= 10)) return 1;
  if (inning == null) return 0.15;
  if (inning >= 7) return 1;
  if (inning === 6) return 0.65;
  if (inning === 5) return 0.45;
  if (inning === 4) return 0.3;
  return 0.15;
}

export type MlbMarginHeat = {
  points: number;
  reason: string | null;
  blowout: boolean;
};

/** Live (or final) margin term. `scale` is 1 when the game is over. */
export function mlbMarginHeat(diff: number, scale: number): MlbMarginHeat {
  if (diff >= MLB_BLOWOUT_MARGIN) {
    return { points: MLB_BLOWOUT_PENALTY, reason: "Blowout", blowout: true };
  }
  if (diff >= 5) return { points: -8, reason: null, blowout: false };
  if (diff === 0) {
    return { points: Math.round(MLB_TIE_CREDIT * scale), reason: "Tied", blowout: false };
  }
  if (diff === 1) {
    return { points: Math.round(MLB_ONE_RUN_CREDIT * scale), reason: "One-run game", blowout: false };
  }
  if (diff === 2) {
    return { points: Math.round(MLB_WITHIN_TWO_CREDIT * scale), reason: "Within two", blowout: false };
  }
  if (diff === 3) {
    return { points: Math.round(MLB_TIGHT_CREDIT * scale), reason: "Tight", blowout: false };
  }
  return { points: 0, reason: null, blowout: false };
}

export function mlbLiveMarginHeat(
  diff: number,
  inning: number | null,
  extras: boolean,
): MlbMarginHeat {
  return mlbMarginHeat(diff, mlbCloseGameScale(inning, extras));
}

export type MlbEliminationHeat = {
  points: number;
  reason: string;
};

/**
 * Postseason elimination bump from the series line the card already shows.
 * Mid/late (4th+) live games get the larger step. Blowouts get none.
 */
export function mlbEliminationHeat(input: {
  seriesLine?: string | null;
  live: boolean;
  final: boolean;
  inning: number | null;
  blowout: boolean;
}): MlbEliminationHeat | null {
  if (input.blowout) return null;
  const state = playoffElimination({ seriesLine: input.seriesLine });
  if (!state) return null;
  const midLate = input.live && !input.final && input.inning != null && input.inning >= 4;
  const winnerTakeAll = state.facing === 2;
  return {
    points: winnerTakeAll
      ? midLate
        ? MLB_WTA_LIVE
        : MLB_WTA_EARLY
      : midLate
        ? MLB_ELIM_LIVE
        : MLB_ELIM_EARLY,
    reason: "Elimination",
  };
}
