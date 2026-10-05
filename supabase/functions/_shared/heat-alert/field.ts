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
  capsule: DriveCapsule | null;
};

/** Glassy Apple Sports pill from the first snap of the drive to the LOS. */
export type DriveCapsule = {
  leftPct: number;
  widthPct: number;
};

/**
 * Continuous capsule from drive start → current LOS.
 * A brand-new drive (start ≈ ball) still gets a short tail behind the ball
 * so the pill reads, instead of collapsing to nothing.
 */
export function driveCapsuleSpan(
  driveStartPct: number | null,
  ballPct: number | null,
  facingRight = false,
  facingLeft = false,
): DriveCapsule | null {
  if (ballPct == null || driveStartPct == null) return null;
  const minW = 1.5;
  let left = Math.min(driveStartPct, ballPct);
  let right = Math.max(driveStartPct, ballPct);
  if (right - left < minW) {
    if (facingRight) {
      left = Math.max(0, ballPct - minW);
      right = Math.min(100, Math.max(left + minW, ballPct));
    } else if (facingLeft) {
      left = Math.max(0, Math.min(ballPct, 100 - minW));
      right = Math.min(100, left + minW);
    } else {
      left = Math.max(0, ballPct - minW / 2);
      right = Math.min(100, left + minW);
    }
  }
  return { leftPct: left, widthPct: right - left };
}

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
    capsule: driveCapsuleSpan(driveStartPct, ballPct, facingRight, facingLeft),
  };
}

export type PlayDot = { pct: number; x: number; y: number };

const CLUSTER_YARDS = 1.75;
const MAX_ROWS = 5;
/** Kept so existing snap-spot tests stay valid. The overlay no longer draws dots. */
const DOT_STEP = 16;

/**
 * Current-drive snaps only. The live overlay uses a capsule now; this layout
 * remains for tests and any caller that still wants stacked snap spots.
 */
export function layoutPlayDots(homeYardLines: number[]): PlayDot[] {
  const spots = homeYardLines
    .map((yard, i) => {
      if (typeof yard !== "number" || !Number.isFinite(yard)) return null;
      const pct = Math.max(0, Math.min(100, 100 - yard));
      return { pct, i };
    })
    .filter((spot): spot is { pct: number; i: number } => spot != null);

  const order = [...spots].sort((a, b) => a.pct - b.pct || a.i - b.i);
  const clusters: { pct: number; i: number }[][] = [];
  for (const spot of order) {
    const last = clusters[clusters.length - 1];
    const anchor = last?.[0];
    if (!last || !anchor || spot.pct - anchor.pct > CLUSTER_YARDS) clusters.push([spot]);
    else last.push(spot);
  }

  const laid: PlayDot[] = new Array(spots.length);
  for (const cluster of clusters) {
    const cols = Math.ceil(cluster.length / MAX_ROWS);
    cluster.forEach((spot, idx) => {
      const col = Math.floor(idx / MAX_ROWS);
      const row = idx % MAX_ROWS;
      const rowsHere = Math.min(MAX_ROWS, cluster.length - col * MAX_ROWS);
      const ySpan = (rowsHere - 1) * DOT_STEP;
      const xSpan = (cols - 1) * DOT_STEP;
      laid[spot.i] = {
        pct: spot.pct,
        x: col * DOT_STEP - xSpan / 2,
        y: row * DOT_STEP - ySpan / 2,
      };
    });
  }
  return laid.filter((dot): dot is PlayDot => dot != null);
}
