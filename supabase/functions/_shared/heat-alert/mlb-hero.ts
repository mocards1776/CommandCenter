/**
 * Shared MLB live-hero model for the heat-alert SVG and the in-app instrument.
 * Count is lamps (B/S/O), runners are a diamond — not a cramped text stack.
 * The inning is a single chip, never the thing between the tall scores.
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

export type MlbCountLamps = {
  balls: number;
  strikes: number;
  outs: number;
};

export type MlbHeroInstrument = {
  livePlay: boolean;
  lamps: MlbCountLamps | null;
  onFirst: boolean;
  onSecond: boolean;
  onThird: boolean;
  inning: string | null;
  winChip: string | null;
  homeShare: number | null;
  /** Pregame / final / break word when lamps are off. */
  status: string | null;
  statusHint: string | null;
};

export function runnersShorthand(spot: MlbHeroDiamond): string {
  const { onFirst: first, onSecond: second, onThird: third } = spot;
  if (first && second && third) return "Loaded";
  if (!first && !second && !third) return "Empty";
  if (first && third && !second) return "Corners";
  return [first ? "1st" : null, second ? "2nd" : null, third ? "3rd" : null]
    .filter((bag): bag is string => Boolean(bag))
    .join(" & ");
}

export function mlbCountLamps(spot: MlbHeroDiamond): MlbCountLamps {
  return {
    balls: Math.max(0, Math.min(3, Math.floor(spot.balls))),
    strikes: Math.max(0, Math.min(2, Math.floor(spot.strikes))),
    outs: Math.max(0, Math.min(3, Math.floor(spot.outs))),
  };
}

export function mlbInningChip(detail: string | null | undefined): string | null {
  const text = (detail ?? "").replace(/\s+/g, " ").trim();
  if (!text || /^final$/i.test(text) || /^live$/i.test(text)) return null;
  return text;
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

export function mlbPlaybugLabel(hero: MlbHeroInstrument): string {
  if (!hero.lamps) return hero.status || "MLB";
  const { balls, strikes, outs } = hero.lamps;
  const bags = [
    hero.onFirst ? "first" : null,
    hero.onSecond ? "second" : null,
    hero.onThird ? "third" : null,
  ].filter((bag): bag is string => Boolean(bag));
  const runners = bags.length ? `runners on ${bags.join(" and ")}` : "bases empty";
  return `${balls} and ${strikes}, ${outs} out${outs === 1 ? "" : "s"}, ${runners}`;
}

export function mlbHeroInstrument(input: MlbHeroInput): MlbHeroInstrument {
  const winChip = mlbWinChip(input);
  const homeShare =
    input.homeWinPct != null && Number.isFinite(input.homeWinPct)
      ? Math.max(0, Math.min(100, input.homeWinPct))
      : null;
  const diamond = input.diamond;
  const inning = mlbInningChip(input.detail);

  if (input.live && diamond && !isBreakStatus(input.detail)) {
    return {
      livePlay: true,
      lamps: mlbCountLamps(diamond),
      onFirst: diamond.onFirst,
      onSecond: diamond.onSecond,
      onThird: diamond.onThird,
      inning,
      winChip,
      homeShare,
      status: null,
      statusHint: null,
    };
  }

  if (input.final) {
    return {
      livePlay: false,
      lamps: null,
      onFirst: false,
      onSecond: false,
      onThird: false,
      inning: null,
      winChip,
      homeShare,
      status: "Final",
      statusHint: null,
    };
  }

  if (!input.live) {
    return {
      livePlay: false,
      lamps: null,
      onFirst: false,
      onSecond: false,
      onThird: false,
      inning: null,
      winChip: null,
      homeShare: null,
      status: (input.when || "").trim() || "TBD",
      statusHint: "First pitch",
    };
  }

  return {
    livePlay: Boolean(diamond),
    lamps: diamond ? mlbCountLamps(diamond) : null,
    onFirst: Boolean(diamond?.onFirst),
    onSecond: Boolean(diamond?.onSecond),
    onThird: Boolean(diamond?.onThird),
    inning: inning || (input.detail || "Live").replace(/\s+/g, " ").trim(),
    winChip,
    homeShare,
    status: diamond ? null : (input.detail || "Live").replace(/\s+/g, " ").trim(),
    statusHint: null,
  };
}
