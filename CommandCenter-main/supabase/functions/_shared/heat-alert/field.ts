/**
 * Yard-line geometry shared with NflFieldMap.
 * ESPN `situation.yardLine` is yards from the home end zone.
 * The field paints away on the left and home on the right, so ball % = 100 - yardLine.
 * Away offense drives right; home offense drives left.
 */

/** Inside the opponent's 20. Away attacks the home goal line (yardLine → 0). */
export function spotIsRedZone(
  yardLine: number | null | undefined,
  homeHasBall: boolean,
  awayHasBall: boolean,
): boolean {
  if (yardLine == null || !Number.isFinite(yardLine)) return false;
  if (awayHasBall) return yardLine <= 20;
  if (homeHasBall) return yardLine >= 80;
  return false;
}

export function fieldBallPct(yardLine: number | null | undefined): number | null {
  if (yardLine == null || !Number.isFinite(yardLine)) return null;
  return Math.max(0, Math.min(100, 100 - yardLine));
}

export function yardsToGo(text: string | null | undefined): number | null {
  if (!text) return null;
  if (/\bgoal\b/i.test(text)) return null;
  const match = text.match(/&\s*(\d+)/i);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export type FootballMarks = {
  ballPct: number | null;
  firstDownPct: number | null;
  toGainLeft: number | null;
  toGainWidth: number | null;
  facingRight: boolean;
  facingLeft: boolean;
  homeHasBall: boolean;
  awayHasBall: boolean;
  driveStartPct: number | null;
};

export function footballMarks(input: {
  yardLine: number | null;
  possessionTeamId: string | null;
  awayId: string;
  homeId: string;
  downDistanceText: string | null;
  driveStartYardLine?: number | null;
}): FootballMarks {
  const poss = input.possessionTeamId;
  const homeHasBall = poss != null && String(poss) === String(input.homeId);
  const awayHasBall = poss != null && String(poss) === String(input.awayId);
  const facingRight = awayHasBall;
  const facingLeft = homeHasBall;
  const raw = fieldBallPct(input.yardLine);
  const ballPct = raw == null ? null : Math.max(0, Math.min(100, raw));
  const toGo = yardsToGo(input.downDistanceText);
  const goal = Boolean(input.downDistanceText && /\bgoal\b/i.test(input.downDistanceText));

  let firstDownPct: number | null = null;
  if (ballPct != null && (homeHasBall || awayHasBall)) {
    if (goal) firstDownPct = facingRight ? 100 : 0;
    else if (toGo != null) {
      firstDownPct = facingRight
        ? Math.max(0, Math.min(100, ballPct + toGo))
        : Math.max(0, Math.min(100, ballPct - toGo));
    }
  }

  const toGainLeft = ballPct != null && firstDownPct != null ? Math.min(ballPct, firstDownPct) : null;
  const toGainWidth =
    ballPct != null && firstDownPct != null ? Math.abs(firstDownPct - ballPct) : null;
  const start = input.driveStartYardLine ?? null;
  const driveStartPct = start != null && start > 0 && start < 100 ? fieldBallPct(start) : null;

  return {
    ballPct,
    firstDownPct,
    toGainLeft,
    toGainWidth,
    facingRight,
    facingLeft,
    homeHasBall,
    awayHasBall,
    driveStartPct,
  };
}
