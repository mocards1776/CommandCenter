/** Portrait heat-alert card. Sports App owns this shape; RUWT supplies the caption reason. */

import type { CfbWinProbPoint } from "../win-probability.ts";

export type HeatSport = "nfl" | "cfb" | "nhl" | "mlb" | "soccer";

export type HeatSide = {
  id: string;
  abbrev: string;
  name: string;
  score: number | null;
  record: string | null;
  linescores: (number | null)[];
  /** #rrggbb */
  color: string;
  /** ESPN alternate; used so near-black clubs still paint on the WP chart. */
  alternateColor?: string | null;
  /** https URL in the app preview, or a data URI once logos are inlined for PNG. */
  logoHref: string | null;
};

export type HeatStat = {
  label: string;
  away: string;
  home: string;
  awayLeads: boolean;
  homeLeads: boolean;
  /** Away share of the dual bar, 0–100. Null when the values are not numeric. */
  awayShare: number | null;
};

/** ESPN situation.yardLine is yards from the home end zone (0 home goal, 100 away goal). */
export type FootballSpot = {
  downDistanceText: string | null;
  yardLine: number | null;
  possessionTeamId: string | null;
  lastPlayText: string | null;
  /** Yards from the home end zone. Drawn only when strictly between the goal lines. */
  driveStartYardLine: number | null;
  /** Scrimmage spots on the current drive only, yards from the home end zone. */
  playYardLines?: number[];
  redZone: boolean;
};

export type IceSpot = {
  /** Feet from center ice when a play published a coordinate. */
  puckX: number | null;
  puckY: number | null;
};

export type DiamondSpot = {
  balls: number;
  strikes: number;
  outs: number;
  onFirst: boolean;
  onSecond: boolean;
  onThird: boolean;
  batter: string | null;
  pitcher: string | null;
};

export type HeatAlertCard = {
  sport: HeatSport;
  gameId: string;
  live: boolean;
  final: boolean;
  /** ESPN short detail, e.g. "2:00 - 2nd" or "Top 7th". */
  detail: string;
  /** Chicago kickoff label for a game that has not started. */
  when: string | null;
  away: HeatSide;
  home: HeatSide;
  venue: string | null;
  /** ISO kickoff / game time for the CT footer stamp. */
  date: string | null;
  periodLabels: string[];
  football: FootballSpot | null;
  ice: IceSpot | null;
  diamond: DiamondSpot | null;
  /** ESPN home-win series. Empty when the summary has not published one. */
  winProbability: CfbWinProbPoint[];
  /** Latest ESPN home win chance, 0–100. Used as a compact MLB hero chip. */
  homeWinPct: number | null;
  /** Compact team-stat rows for the Apple-style comparison. */
  stats: HeatStat[];
  /** Sports app path, including the solo query the push notes already use. */
  gamePath: string;
};

export const HEAT_ALERT_WIDTH = 1080;
/** Same Telegram photo slot as finals (~1080×1326–1360). */
export const HEAT_ALERT_HEIGHT = 1350;
