/** Portrait heat-alert card. Sports App owns this shape; RUWT supplies the caption reason. */

export type HeatSport = "nfl" | "cfb" | "nhl" | "mlb" | "soccer";

export type HeatSide = {
  id: string;
  abbrev: string;
  name: string;
  score: number | null;
  /** #rrggbb */
  color: string;
  /** https URL in the app preview, or a data URI once logos are inlined for PNG. */
  logoHref: string | null;
};

/** ESPN situation.yardLine is yards from the home end zone (0 home goal, 100 away goal). */
export type FootballSpot = {
  downDistanceText: string | null;
  yardLine: number | null;
  possessionTeamId: string | null;
  lastPlayText: string | null;
  /** Yards from the home end zone. Drawn only when strictly between the goal lines. */
  driveStartYardLine: number | null;
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
  football: FootballSpot | null;
  ice: IceSpot | null;
  diamond: DiamondSpot | null;
  /** Sports app path, including the solo query the push notes already use. */
  gamePath: string;
};

export const HEAT_ALERT_WIDTH = 1080;
export const HEAT_ALERT_HEIGHT = 1300;
