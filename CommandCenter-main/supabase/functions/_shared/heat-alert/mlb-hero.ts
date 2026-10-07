/**
 * Shared MLB score-nest copy for the heat-alert SVG and the in-app hero.
 * Baseball has no clock between the tall scores — the live count is the
 * equivalent, with outs + a runners shorthand underneath. Live games also
 * get an inning line ("Top 3rd", "Bottom 3rd", "Mid 3rd", "End 3rd") on top
 * of the nest via `mlbInningLabel`; the situation bar keeps its own copy.
 */

import { formatWinPct, cfbWinProbLeader } from "../win-probability.ts";
import { isBreakStatus } from "./clock.ts";
import type { DiamondSpot } from "./types.ts";

export type MlbHeroDiamond = Pick<
  DiamondSpot,
  "balls" | "strikes" | "outs" | "onFirst" | "onSecond" | "onThird"
>;

export type MlbHeroInput = {
  live: boolean;
  final: boolean;
  detail?: string | null;
  when?: string | null;
  diamond: MlbHeroDiamond | null;
  homeWinPct?: number | null;
  awayAbbrev?: string | null;
  homeAbbrev?: string | null;
};

export type MlbHeroNest = {
  /** Count "0-2" on a live pitch, otherwise Final / first-pitch / break copy. */
  primary: string;
  secondary: string | null;
  runners: string | null;
  winChip: string | null;
  /** Primary is balls-strikes — render it like a clock numeral. */
  liveCount: boolean;
};

function inningOrdinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const mod10 = n % 10;
  if (mod10 === 1) return `${n}st`;
  if (mod10 === 2) return `${n}nd`;
  if (mod10 === 3) return `${n}rd`;
  return `${n}th`;
}

/**
 * Hero-nest inning label: "Top 3rd", "Bottom 3rd", "Mid 3rd", "End 3rd",
 * "Top 10th". Accepts MLB StatsAPI (`Top 3rd`, `Bottom 3rd`, `Middle 3rd`,
 * `End 3rd`) and ESPN-style (`Bot 3rd`, `Mid 3rd`, `Top of the 3rd`) copy.
 * Anything without a half + inning number (Warmup, Delayed, Final) → null.
 * Port of `mlbInningLabel` in CommandCenter-main/src/lib/mlb-score-ui.ts —
 * edge code can't import the web src; heat-alert.test.ts checks parity.
 */
export function mlbInningLabel(detail: string | null | undefined): string | null {
  const text = (detail ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!text) return null;
  const m = text.match(
    /^(top|t|bottom|bot|b|middle|mid|m|end|e)\.?(?:\s+of)?(?:\s+the)?\s*(\d{1,2})(?:st|nd|rd|th)?\b/,
  );
  if (!m) return null;
  const n = Number(m[2]);
  if (!Number.isFinite(n) || n < 1) return null;
  const half = m[1];
  const word = /^t/.test(half)
    ? "Top"
    : /^b/.test(half)
      ? "Bottom"
      : /^m/.test(half)
        ? "Mid"
        : "End";
  return `${word} ${inningOrdinal(n)}`;
}

export function runnersShorthand(spot: MlbHeroDiamond): string {
  const { onFirst: first, onSecond: second, onThird: third } = spot;
  if (first && second && third) return "Loaded";
  if (!first && !second && !third) return "Empty";
  if (first && third && !second) return "Corners";
  return [first ? "1st" : null, second ? "2nd" : null, third ? "3rd" : null]
    .filter((bag): bag is string => Boolean(bag))
    .join(" & ");
}

export function mlbWinChip(input: {
  homeWinPct?: number | null;
  awayAbbrev?: string | null;
  homeAbbrev?: string | null;
}): string | null {
  const pct = input.homeWinPct;
  if (pct == null || !Number.isFinite(pct)) return null;
  const away = (input.awayAbbrev || "").trim();
  const home = (input.homeAbbrev || "").trim();
  if (!away || !home) return `${formatWinPct(pct)}%`;
  const leader = cfbWinProbLeader(
    pct,
    { abbrev: away, color: "334155" },
    { abbrev: home, color: "334155" },
  );
  if (leader.even) return `EVEN ${formatWinPct(leader.pct)}%`;
  return `${leader.abbrev} ${formatWinPct(leader.pct)}%`;
}

export function mlbHeroNest(input: MlbHeroInput): MlbHeroNest {
  const winChip = mlbWinChip(input);
  const diamond = input.diamond;

  if (input.live && diamond && !isBreakStatus(input.detail)) {
    const outs = diamond.outs;
    return {
      primary: `${diamond.balls}-${diamond.strikes}`,
      secondary: `${outs} out${outs === 1 ? "" : "s"}`,
      runners: runnersShorthand(diamond),
      winChip,
      liveCount: true,
    };
  }

  if (input.final) {
    return {
      primary: "Final",
      secondary: null,
      runners: null,
      winChip,
      liveCount: false,
    };
  }

  if (!input.live) {
    return {
      primary: (input.when || "").trim() || "TBD",
      secondary: "First pitch",
      runners: null,
      winChip: null,
      liveCount: false,
    };
  }

  const line = (input.detail || "Live").replace(/\s+/g, " ").trim();
  return {
    primary: line,
    secondary: null,
    runners: diamond ? runnersShorthand(diamond) : null,
    winChip,
    liveCount: false,
  };
}
