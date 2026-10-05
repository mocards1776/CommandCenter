/**
 * Team filter, chat allowlist, and short captions for Blues goal clips.
 *
 * HIGHLIGHTS_TEAM_IDS accepts NHL/ESPN abbreviations (STL) or numeric ids (19).
 * Empty / unset defaults to the Blues.
 */

export const DEFAULT_HIGHLIGHTS_CHAT_ID = "857547432";
export const DEFAULT_TEAM_TOKEN = "STL";
export const DEFAULT_LOOKBACK_HOURS = 72;
export const DEFAULT_MAX_SENDS = 6;

/** ESPN two-letter codes where NHL uses three. */
const NHL_TO_ESPN_ABBREV: Record<string, string> = {
  LAK: "LA",
  NJD: "NJ",
  SJS: "SJ",
  TBL: "TB",
};

const ESPN_TO_NHL_ABBREV: Record<string, string> = {
  LA: "LAK",
  NJ: "NJD",
  SJ: "SJS",
  TB: "TBL",
};

/** NHL team id → club-schedule abbreviation. Blues is 19 on NHL and ESPN. */
const ID_TO_NHL_ABBREV: Record<string, string> = {
  "1": "NJD",
  "2": "NYI",
  "3": "NYR",
  "4": "PHI",
  "5": "PIT",
  "6": "BOS",
  "7": "BUF",
  "8": "MTL",
  "9": "OTT",
  "10": "TOR",
  "12": "CAR",
  "13": "FLA",
  "14": "TBL",
  "15": "WSH",
  "16": "CHI",
  "17": "DET",
  "18": "NSH",
  "19": "STL",
  "20": "CGY",
  "21": "COL",
  "22": "EDM",
  "23": "VAN",
  "24": "ANA",
  "25": "DAL",
  "26": "LAK",
  "28": "SJS",
  "29": "CBJ",
  "30": "MIN",
  "52": "WPG",
  "54": "VGK",
  "55": "SEA",
  "68": "UTA",
};

const NICK: Record<string, string> = {
  ANA: "Ducks",
  BOS: "Bruins",
  BUF: "Sabres",
  CGY: "Flames",
  CAR: "Hurricanes",
  CHI: "Blackhawks",
  COL: "Avalanche",
  CBJ: "Blue Jackets",
  DAL: "Stars",
  DET: "Red Wings",
  EDM: "Oilers",
  FLA: "Panthers",
  LA: "Kings",
  LAK: "Kings",
  MIN: "Wild",
  MTL: "Canadiens",
  NSH: "Predators",
  NJ: "Devils",
  NJD: "Devils",
  NYI: "Islanders",
  NYR: "Rangers",
  OTT: "Senators",
  PHI: "Flyers",
  PIT: "Penguins",
  SJ: "Sharks",
  SJS: "Sharks",
  SEA: "Kraken",
  STL: "Blues",
  TB: "Lightning",
  TBL: "Lightning",
  TOR: "Maple Leafs",
  UTA: "Mammoth",
  VAN: "Canucks",
  VGK: "Golden Knights",
  WSH: "Capitals",
  WPG: "Jets",
};

export type TeamFilter = {
  /** NHL club-schedule abbreviations (STL, SJS). */
  nhlAbbrevs: string[];
  espnAbbrevs: string[];
  ids: string[];
};

export function canonEspnAbbrev(abbrev: string | null | undefined): string {
  const up = (abbrev ?? "").toUpperCase();
  return NHL_TO_ESPN_ABBREV[up] ?? up;
}

export function canonNhlAbbrev(abbrev: string | null | undefined): string {
  const up = (abbrev ?? "").toUpperCase();
  return ESPN_TO_NHL_ABBREV[up] ?? up;
}

export function teamNick(abbrev: string | null | undefined, fallback?: string | null): string {
  const up = (abbrev ?? "").toUpperCase();
  return NICK[up] || fallback?.trim() || up || "Team";
}

export function parseChatIds(raw: string | undefined | null): string[] {
  if (raw == null || raw.trim() === "") return [DEFAULT_HIGHLIGHTS_CHAT_ID];
  const ids: string[] = [];
  for (const part of raw.split(/[\s,]+/)) {
    const id = part.trim();
    if (!/^-?\d{5,20}$/.test(id) || ids.includes(id)) continue;
    ids.push(id);
  }
  return ids.length ? ids : [DEFAULT_HIGHLIGHTS_CHAT_ID];
}

export function parseTeamFilter(raw: string | undefined | null): TeamFilter {
  const text = raw == null || raw.trim() === "" ? DEFAULT_TEAM_TOKEN : raw;
  const nhlAbbrevs: string[] = [];
  const espnAbbrevs: string[] = [];
  const ids: string[] = [];
  const addAbbrev = (token: string) => {
    const nhl = canonNhlAbbrev(token);
    const espn = canonEspnAbbrev(token);
    if (nhl && !nhlAbbrevs.includes(nhl)) nhlAbbrevs.push(nhl);
    if (espn && !espnAbbrevs.includes(espn)) espnAbbrevs.push(espn);
  };
  for (const part of text.split(/[\s,]+/)) {
    const token = part.trim().replace(/^(nhl|espn):/i, "");
    if (!token) continue;
    if (/^\d{1,8}$/.test(token)) {
      if (!ids.includes(token)) ids.push(token);
      const mapped = ID_TO_NHL_ABBREV[token];
      if (mapped) addAbbrev(mapped);
      continue;
    }
    if (/^[A-Za-z]{2,4}$/.test(token)) addAbbrev(token.toUpperCase());
  }
  if (!nhlAbbrevs.length && !ids.length) addAbbrev(DEFAULT_TEAM_TOKEN);
  return { nhlAbbrevs, espnAbbrevs, ids };
}

export function lookbackHours(raw: string | undefined | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LOOKBACK_HOURS;
  return Math.min(Math.round(n), 24 * 14);
}

export function maxSends(raw: string | undefined | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_MAX_SENDS;
  return Math.min(Math.round(n), 20);
}

export function teamMatchesFilter(
  filter: TeamFilter,
  opts: { abbrev?: string | null; teamId?: string | number | null },
): boolean {
  const abbrev = (opts.abbrev ?? "").toUpperCase();
  if (abbrev) {
    if (filter.nhlAbbrevs.includes(canonNhlAbbrev(abbrev))) return true;
    if (filter.espnAbbrevs.includes(canonEspnAbbrev(abbrev))) return true;
  }
  const id = opts.teamId != null ? String(opts.teamId) : "";
  return Boolean(id && filter.ids.includes(id));
}

export type GameSides = {
  awayAbbrev: string;
  homeAbbrev: string;
  awayId: string;
  homeId: string;
};

/** One scoring row from landing and/or play-by-play. Playing in the game is not enough. */
export type ScoringClipInput = {
  teamAbbrev?: string | null;
  eventOwnerTeamId?: string | number | null;
  scorerTeamId?: string | number | null;
  goalModifier?: string | null;
  situationCode?: string | null;
  isHome?: boolean | null;
  highlightClip?: string | number | null;
};

export type ScoringReject =
  | "no-highlight"
  | "unknown-team"
  | "owner-mismatch"
  | "not-scoring-team"
  | "empty-net"
  | "own-goal";

export type ScoringDecision =
  | { ok: true; teamAbbrev: string; teamId: string; clipId: string }
  | { ok: false; reason: ScoringReject };

function digits(value: string | number | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
}

function abbrevForTeamId(game: GameSides, id: string): string {
  if (!id) return "";
  if (id === game.awayId) return canonNhlAbbrev(game.awayAbbrev);
  if (id === game.homeId) return canonNhlAbbrev(game.homeAbbrev);
  return ID_TO_NHL_ABBREV[id] ?? "";
}

function teamIdForAbbrev(game: GameSides, abbrev: string): string {
  const nhl = canonNhlAbbrev(abbrev);
  if (!nhl) return "";
  if (nhl === canonNhlAbbrev(game.awayAbbrev)) return game.awayId;
  if (nhl === canonNhlAbbrev(game.homeAbbrev)) return game.homeId;
  return "";
}

/** goalModifier "empty-net", or the defending goalie digit is 0 in situationCode. */
export function isEmptyNetGoal(
  goalModifier: string | null | undefined,
  situationCode: string | null | undefined,
  scoringIsHome: boolean | null,
): boolean {
  const modifier = (goalModifier ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (modifier === "empty-net" || modifier === "emptynet" || (modifier.includes("empty") && modifier.includes("net"))) {
    return true;
  }
  const code = (situationCode ?? "").trim();
  if (!/^\d{4}$/.test(code)) return false;
  // away goalie, away skaters, home skaters, home goalie. 1 = in net, 0 = pulled.
  if (scoringIsHome === true) return code[0] === "0";
  if (scoringIsHome === false) return code[3] === "0";
  return false;
}

export function isOwnGoal(opts: {
  goalModifier?: string | null;
  eventOwnerTeamId?: string | null;
  scorerTeamId?: string | null;
}): boolean {
  const modifier = (opts.goalModifier ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (modifier === "own-goal" || modifier === "owngoal" || modifier.includes("own-goal") || modifier.includes("own goal")) {
    return true;
  }
  const owner = opts.eventOwnerTeamId ?? "";
  const scorerTeam = opts.scorerTeamId ?? "";
  return Boolean(owner && scorerTeam && owner !== scorerTeam);
}

/**
 * Positive highlight: the filtered club is the team that was awarded the goal,
 * the clip is that play's highlightClip, and it is not an empty-net or own goal.
 * Opponent goals in the same game are rejected. discreteClip is not a substitute.
 */
export function acceptScoringHighlight(
  filter: TeamFilter,
  game: GameSides,
  goal: ScoringClipInput,
): ScoringDecision {
  const clipId = digits(goal.highlightClip);
  if (!clipId) return { ok: false, reason: "no-highlight" };

  const listedAbbrev = canonNhlAbbrev(goal.teamAbbrev);
  const ownerId = digits(goal.eventOwnerTeamId);
  const ownerAbbrev = abbrevForTeamId(game, ownerId);
  if (ownerAbbrev && listedAbbrev && ownerAbbrev !== listedAbbrev) {
    return { ok: false, reason: "owner-mismatch" };
  }

  const scoringAbbrev = ownerAbbrev || listedAbbrev;
  const scoringId = ownerId || teamIdForAbbrev(game, scoringAbbrev);
  if (!scoringAbbrev && !scoringId) return { ok: false, reason: "unknown-team" };
  if (!teamMatchesFilter(filter, { abbrev: scoringAbbrev || null, teamId: scoringId || null })) {
    return { ok: false, reason: "not-scoring-team" };
  }

  const isHome =
    typeof goal.isHome === "boolean"
      ? goal.isHome
      : scoringAbbrev
        ? scoringAbbrev === canonNhlAbbrev(game.homeAbbrev)
        : scoringId
          ? scoringId === game.homeId
          : null;
  if (isEmptyNetGoal(goal.goalModifier, goal.situationCode, isHome)) {
    return { ok: false, reason: "empty-net" };
  }
  const scorerTeamId = digits(goal.scorerTeamId);
  if (isOwnGoal({ goalModifier: goal.goalModifier, eventOwnerTeamId: ownerId || scoringId, scorerTeamId })) {
    return { ok: false, reason: "own-goal" };
  }

  const teamAbbrev = scoringAbbrev || abbrevForTeamId(game, scoringId);
  return { ok: true, teamAbbrev, teamId: scoringId, clipId };
}

export function highlightCaption(opts: {
  teamAbbrev: string;
  teamName?: string | null;
  scorer: string;
  opponentAbbrev: string;
}): string {
  const team = teamNick(opts.teamAbbrev, opts.teamName);
  const scorer = opts.scorer.trim() || "Player";
  const opp = canonEspnAbbrev(opts.opponentAbbrev) || "OPP";
  return `${team} score — ${scorer} vs ${opp}`.slice(0, 1024);
}

/**
 * ESPN game page in the Mini App. Finals play the wrap in the hero on this
 * route; there is no separate wrap path.
 */
export function nhlGamePath(espnEventId: string | null | undefined): string | null {
  const id = (espnEventId ?? "").replace(/\D/g, "");
  if (!id) return null;
  return `/sports/nhl/game/${id}?solo=1`;
}

export type WrapKind = "nhl-recap" | "nhl-condensed";

/** Right-rail ids. Recap wins over the longer condensed game. French recap is ignored. */
export function pickRailWrap(
  gameVideo: { threeMinRecap?: unknown; condensedGame?: unknown } | null | undefined,
): { kind: WrapKind; clipId: string } | null {
  const id = (value: unknown) =>
    digits(typeof value === "number" || typeof value === "string" ? value : null);
  const recap = id(gameVideo?.threeMinRecap);
  if (recap) return { kind: "nhl-recap", clipId: recap };
  const condensed = id(gameVideo?.condensedGame);
  if (condensed) return { kind: "nhl-condensed", clipId: condensed };
  return null;
}

export function wrapHighlightId(kind: WrapKind, clipId: string | number): string {
  const id = digits(clipId);
  return kind === "nhl-condensed" ? `nhl-condensed-${id}` : `nhl-recap-${id}`;
}

export function wrapCaption(opts: {
  teamAbbrev: string;
  teamName?: string | null;
  opponentAbbrev: string;
  kind: WrapKind;
}): string {
  const team = teamNick(opts.teamAbbrev, opts.teamName);
  const opp = canonEspnAbbrev(opts.opponentAbbrev) || "OPP";
  const label = opts.kind === "nhl-condensed" ? "condensed wrap" : "wrap";
  return `${team} ${label} vs ${opp}`.slice(0, 1024);
}

export function highlightId(clipId: string | number): string {
  return `nhl-${clipId}`;
}

export function parseClockSeconds(clock: string | null | undefined): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec((clock ?? "").trim());
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}
