/**
 * Pure helpers for the live MLB strike-zone pitch plot (sports game detail).
 * No React, no fetch — unit-tested with node --experimental-strip-types.
 *
 * Coordinates are MLB StatsAPI `pitchData.coordinates.pX / pZ` in feet,
 * catcher's view: pX > 0 is the catcher's right (right side of the plot),
 * pZ is height above the plate. Zone top / bottom come from
 * `pitchData.strikeZoneTop / strikeZoneBottom` per batter.
 */

/** Plate half-width (8.5 in) plus a baseball radius (~1.45 in), in feet. */
export const ZONE_HALF_WIDTH_FT = 0.83;
export const DEFAULT_ZONE_TOP_FT = 3.5;
export const DEFAULT_ZONE_BOTTOM_FT = 1.5;

/**
 * Margin around the 3×3 zone inside the plot box, as a fraction of the zone's
 * own width / height. Pitches further out are pinned to the plot edge.
 */
export const PLOT_MARGIN_X = 0.28;
export const PLOT_MARGIN_Y = 0.22;
/** Pinned (off-chart) pitches stop this far inside the plot edge so the dot isn't cut off. */
export const PLOT_EDGE_PAD = 0.04;

export type PitchZoneInput = {
  pX: number | null | undefined;
  pZ: number | null | undefined;
  zoneTop?: number | null;
  zoneBottom?: number | null;
};

export type PitchZonePosition = {
  /** 0–100, percent of the plot box width from the left edge. */
  leftPct: number;
  /** 0–100, percent of the plot box height from the top edge. */
  topPct: number;
  /** Inside the rulebook zone (ball-radius inclusive). */
  inZone: boolean;
  /** Pitch was beyond the plot margin and pinned to its edge. */
  clamped: boolean;
};

const clampRange = (n: number, pad: number) => (n < pad ? pad : n > 1 - pad ? 1 - pad : n);

function zoneBounds(top: number | null | undefined, bottom: number | null | undefined) {
  const t = Number(top);
  const b = Number(bottom);
  if (Number.isFinite(t) && Number.isFinite(b) && t - b > 0.5 && t < 6 && b > 0) {
    return { top: t, bottom: b };
  }
  return { top: DEFAULT_ZONE_TOP_FT, bottom: DEFAULT_ZONE_BOTTOM_FT };
}

/**
 * Plate location → percent position in a plot box whose middle
 * 1 / (1 + 2·margin) is the strike zone. Returns null without coordinates.
 */
export function pitchZonePosition(
  input: PitchZoneInput,
  opts: { marginX?: number; marginY?: number; halfWidth?: number; edgePad?: number } = {},
): PitchZonePosition | null {
  const pX = input.pX;
  const pZ = input.pZ;
  if (pX == null || pZ == null || !Number.isFinite(pX) || !Number.isFinite(pZ)) return null;
  const mx = opts.marginX ?? PLOT_MARGIN_X;
  const my = opts.marginY ?? PLOT_MARGIN_Y;
  const half = opts.halfWidth ?? ZONE_HALF_WIDTH_FT;
  const pad = Math.min(Math.max(opts.edgePad ?? PLOT_EDGE_PAD, 0), 0.45);
  const { top, bottom } = zoneBounds(input.zoneTop, input.zoneBottom);

  // Zone-normalised: 0..1 spans the zone edge to edge.
  const u = (pX + half) / (2 * half);
  const v = (top - pZ) / (top - bottom);
  const inZone = u >= 0 && u <= 1 && v >= 0 && v <= 1;

  const rawX = (u + mx) / (1 + 2 * mx);
  const rawY = (v + my) / (1 + 2 * my);
  const x = clampRange(rawX, pad);
  const y = clampRange(rawY, pad);
  const round = (n: number) => Math.round(n * 1000) / 10;
  return {
    leftPct: round(x),
    topPct: round(y),
    inZone,
    clamped: x !== rawX || y !== rawY,
  };
}

/** Where the 3×3 grid sits inside the plot box (percent insets). */
export function zoneInsetPct(
  opts: { marginX?: number; marginY?: number } = {},
): { x: number; y: number } {
  const mx = opts.marginX ?? PLOT_MARGIN_X;
  const my = opts.marginY ?? PLOT_MARGIN_Y;
  return {
    x: Math.round((mx / (1 + 2 * mx)) * 1000) / 10,
    y: Math.round((my / (1 + 2 * my)) * 1000) / 10,
  };
}

/**
 * Minimum center-to-center gap between two pitch dots, as a fraction of the
 * plot box width. The dot is 18px on a 15.5rem plot (20px on 17–18rem), so
 * this is about one dot diameter at every breakpoint.
 */
export const DOT_MIN_SEP = 0.074;

export type DotPoint = { leftPct: number; topPct: number };

/**
 * Nudge overlapping pitch dots apart so every number stays readable.
 *
 * Simple pairwise collision relaxation in a square space (x and y both in plot
 * widths, so a 20px gap is the same horizontally and vertically). Each dot
 * stays within `maxShift` of its true location and inside the plot edge pad.
 * Exactly coincident dots split vertically (the earlier pitch moves up); a
 * larger stack fans out around the true spot.
 * Deterministic and input order is preserved, so the latest pitch keeps the
 * highest z-index.
 */
export function relaxPitchDots<T extends DotPoint>(
  points: readonly T[],
  opts: {
    /** Plot box width ÷ height. */
    aspect: number;
    minSep?: number;
    maxShift?: number;
    edgePad?: number;
    iterations?: number;
  },
): Array<T & { shifted: boolean }> {
  const aspect = Number.isFinite(opts.aspect) && opts.aspect > 0 ? opts.aspect : 1;
  const minSep = opts.minSep ?? DOT_MIN_SEP;
  const maxShift = opts.maxShift ?? minSep;
  const pad = Math.min(Math.max(opts.edgePad ?? PLOT_EDGE_PAD, 0), 0.45);
  const iterations = opts.iterations ?? 80;

  const ox = points.map((p) => p.leftPct / 100);
  const oy = points.map((p) => p.topPct / 100 / aspect);
  const x = [...ox];
  const y = [...oy];
  const minX = pad;
  const maxX = 1 - pad;
  const minY = pad / aspect;
  const maxY = (1 - pad) / aspect;
  const eps = 1e-6;

  // Pre-split exact stacks onto a tiny regular polygon (first pitch on top,
  // i.e. up) so relaxation fans them out evenly instead of along one line.
  const stackOf = x.map((_, k) => {
    for (let m = 0; m < k; m++) if (Math.abs(ox[m] - ox[k]) < eps && Math.abs(oy[m] - oy[k]) < eps) return m;
    return k;
  });
  const stacks = new Map<number, number[]>();
  stackOf.forEach((root, k) => stacks.set(root, [...(stacks.get(root) ?? []), k]));
  for (const members of stacks.values()) {
    if (members.length < 2) continue;
    members.forEach((k, m) => {
      const a = -Math.PI / 2 + (2 * Math.PI * m) / members.length;
      x[k] += Math.cos(a) * 1e-4;
      y[k] += Math.sin(a) * 1e-4;
    });
  }

  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (let i = 0; i < x.length; i++) {
      for (let j = i + 1; j < x.length; j++) {
        let dx = x[j] - x[i];
        let dy = y[j] - y[i];
        const d = Math.hypot(dx, dy);
        if (d >= minSep - eps) continue;
        if (d < eps) {
          dx = 0;
          dy = 1;
        } else {
          dx /= d;
          dy /= d;
        }
        const push = (minSep - d) / 2;
        x[i] -= dx * push;
        y[i] -= dy * push;
        x[j] += dx * push;
        y[j] += dy * push;
        moved = true;
      }
    }
    for (let k = 0; k < x.length; k++) {
      let sx = x[k] - ox[k];
      let sy = y[k] - oy[k];
      const s = Math.hypot(sx, sy);
      if (s > maxShift) {
        sx *= maxShift / s;
        sy *= maxShift / s;
      }
      x[k] = Math.min(Math.max(ox[k] + sx, minX), maxX);
      y[k] = Math.min(Math.max(oy[k] + sy, minY), maxY);
    }
    if (!moved) break;
  }

  const round = (n: number) => Math.round(n * 1000) / 10;
  return points.map((p, k) => {
    const leftPct = x[k] === ox[k] ? p.leftPct : round(x[k]);
    const topPct = y[k] === oy[k] ? p.topPct : round(y[k] * aspect);
    return { ...p, leftPct, topPct, shifted: leftPct !== p.leftPct || topPct !== p.topPct };
  });
}

export type PitchResult = "ball" | "called" | "swinging" | "foul" | "inplay" | "other";

/**
 * StatsAPI `details.call.code` → plot result bucket.
 * Ball: B, *B (in dirt), I (intentional), P (pitchout), V (auto ball), H (HBP).
 * Called strike: C, A (auto strike / pitch-clock).
 * Swinging: S, W (blocked), M (missed bunt), Q (swinging pitchout).
 * Foul: F, T (foul tip), L (foul bunt), R (foul pitchout), O (foul tip bunt).
 * In play: X, D (no out), E (runs).
 */
export function pitchResultFromCall(
  code: string | null | undefined,
  flags: { isBall?: boolean; isStrike?: boolean; isInPlay?: boolean; description?: string | null } = {},
): PitchResult {
  const c = (code ?? "").trim().toUpperCase();
  if (c === "X" || c === "D" || c === "E") return "inplay";
  if (c === "B" || c === "*B" || c === "I" || c === "P" || c === "V" || c === "H") return "ball";
  if (c === "C" || c === "A") return "called";
  if (c === "S" || c === "W" || c === "M" || c === "Q") return "swinging";
  if (c === "F" || c === "T" || c === "L" || c === "R" || c === "O") return "foul";

  const d = (flags.description ?? "").toLowerCase();
  if (flags.isInPlay || /in play/.test(d)) return "inplay";
  if (/foul/.test(d)) return "foul";
  if (/swinging|missed bunt/.test(d)) return "swinging";
  if (/called strike|automatic strike/.test(d)) return "called";
  if (flags.isBall || /\bball\b|hit by pitch|intent|pitch ?out/.test(d)) return "ball";
  if (flags.isStrike) return "called";
  return "other";
}

export type PitchResultStyle = {
  /** Dot fill. */
  fill: string;
  /** Number color on the dot. */
  text: string;
  /** Short legend label. */
  label: string;
};

export const PITCH_RESULT_STYLES: Record<PitchResult, PitchResultStyle> = {
  ball: { fill: "#34d399", text: "#05261a", label: "Ball" },
  called: { fill: "#ef4444", text: "#ffffff", label: "Called K" },
  swinging: { fill: "#f97316", text: "#2a1003", label: "Swinging K" },
  foul: { fill: "#facc15", text: "#2a2103", label: "Foul" },
  inplay: { fill: "#f8fafc", text: "#1d4ed8", label: "In play" },
  other: { fill: "#94a3b8", text: "#0f172a", label: "Other" },
};

export function pitchResultStyle(result: PitchResult): PitchResultStyle {
  return PITCH_RESULT_STYLES[result] ?? PITCH_RESULT_STYLES.other;
}

/** Legend order shown under the zone. */
export const PITCH_LEGEND: PitchResult[] = ["ball", "called", "swinging", "foul", "inplay"];

/** "87.4" → "87"; null/NaN → "—". */
export function formatPitchMph(speed: number | null | undefined): string {
  return speed != null && Number.isFinite(speed) ? String(Math.round(speed)) : "—";
}

/**
 * Result bucket for a pitch already mapped by `fetchMlbBoxscore` (MlbPitchPlot):
 * its label is StatsAPI `details.call.description` (falls back to
 * `details.description`) and `call` is the coarse B / S / X / O kind.
 */
export function pitchResultFromPlot(p: { call?: string | null; callLabel?: string | null }): PitchResult {
  const call = (p.call ?? "").toUpperCase();
  return pitchResultFromCall(null, {
    description: p.callLabel ?? null,
    isBall: call === "B",
    isInPlay: call === "X",
    isStrike: call === "S",
  });
}

/** StatsAPI `details.type.description` → `details.type.code`. */
const PITCH_TYPE_CODES: Record<string, string> = {
  "four-seam fastball": "FF",
  "two-seam fastball": "FT",
  fastball: "FA",
  sinker: "SI",
  cutter: "FC",
  slider: "SL",
  sweeper: "ST",
  slurve: "SV",
  curveball: "CU",
  "knuckle curve": "KC",
  "slow curve": "CS",
  changeup: "CH",
  splitter: "FS",
  "split-finger": "FS",
  forkball: "FO",
  screwball: "SC",
  knuckleball: "KN",
  eephus: "EP",
  "pitch out": "PO",
  pitchout: "PO",
  "intentional ball": "IN",
  "automatic ball": "AB",
  "automatic strike": "AS",
  other: "UN",
};

/**
 * Short pitch-type code ("SL", "FF") from the mapped pitch type, which is the
 * StatsAPI type description when present, else the raw code.
 */
export function pitchTypeCode(type: string | null | undefined): string | null {
  const t = (type ?? "").trim();
  if (!t) return null;
  if (/^[A-Z]{1,3}$/.test(t)) return t;
  const known = PITCH_TYPE_CODES[t.toLowerCase()];
  if (known) return known;
  const initials = t
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return initials.slice(0, 2) || null;
}
