/** MLB Stats API helpers — scoreboard, standings, leaders, player cards. */

import { supabase } from "./supabase";
import { formatSportsDateLong } from "./utils";
import { parseEspnBroadcasts, type GameBroadcast } from "./game-broadcasts";

const MLB = "https://statsapi.mlb.com/api/v1";
const ESPN_STANDINGS = "https://site.api.espn.com/apis/v2/sports/baseball/mlb/standings";

/** One pitch in the current PA — plate coords in feet (catcher's view). */
export type MlbPitchPlot = {
  number: number;
  pX: number;
  pZ: number;
  /** B = ball, S = strike/foul/whiff, X = in play, O = other */
  call: "B" | "S" | "X" | "O";
  callLabel: string;
  pitchType: string | null;
  speed: number | null;
  zoneTop: number;
  zoneBottom: number;
};

export type MlbLivePlayerCard = {
  id: number;
  name: string;
  shortName: string;
  number: string | null;
  position: string | null;
  /** Batter: "L"/"R"/"S". Pitcher: "LHP"/"RHP". */
  hand: string | null;
  teamAbbrev: string | null;
  wins: number | null;
  losses: number | null;
  era: string | null;
  avg: string | null;
  hr: number | null;
  rbi: number | null;
};

export type MlbLiveSituation = {
  balls: number;
  strikes: number;
  outs: number;
  batter: { id: number; name: string } | null;
  pitcher: { id: number; name: string } | null;
  onFirst: boolean;
  onSecond: boolean;
  onThird: boolean;
  /** Current PA pitch locations for the strike-zone plot. */
  pitches: MlbPitchPlot[];
  batterCard: MlbLivePlayerCard | null;
  pitcherCard: MlbLivePlayerCard | null;
};

export type MlbScoreGame = {
  id: string;
  status: string;
  abstractState: string;
  live: boolean;
  final: boolean;
  inning: string | null;
  away: MlbScoreSide;
  home: MlbScoreSide;
  when: string | null;
  /** Short clock/time label for pregame hero, e.g. "1:15 PM" */
  whenShort: string | null;
  venue: string | null;
  officialDate: string | null;
  gameDate: string | null;
  /** Present while the game is in progress. */
  situation: MlbLiveSituation | null;
  /** TV / stream networks (MLB.TV, locals, national). */
  broadcasts: GameBroadcast[];
};

export type MlbScoreSide = {
  teamId: number;
  name: string;
  abbrev: string;
  score: number | null;
  hits: number | null;
  errors: number | null;
  record: string | null;
  probablePitcher: string | null;
  probablePitcherId: number | null;
  /** Hex without # — team brand color for matchup chrome. */
  primaryColor: string;
};

export type MlbHighlight = {
  id: string;
  title: string;
  description: string | null;
  duration: string | null;
  thumb: string | null;
  url: string;
  date: string | null;
};

export type MlbStandingRow = {
  rank: string;
  teamId: number;
  team: string;
  abbrev: string;
  wins: number;
  losses: number;
  pct: string;
  gb: string;
  streak: string;
  playoffPercent: string | null;
  wildCardPercent: string | null;
  wcgb: string;
  l10: string;
  runDiff: number;
};

export type MlbDivisionTable = {
  name: string;
  shortName: string;
  rows: MlbStandingRow[];
};

export type MlbLeader = {
  rank: number;
  playerId: number;
  name: string;
  team: string;
  teamId: number | null;
  value: string;
};

export type MlbLeaderBoard = {
  key: string;
  label: string;
  group: "hitting" | "pitching";
  leaders: MlbLeader[];
};

export type MlbPlayerStatLine = { label: string; value: string };

export type MlbDraftInfo = {
  year: number | null;
  round: string | null;
  pick: number | null;
  team: string | null;
  school: string | null;
  signingBonus: string | null;
  /** e.g. "2024 · Rd 1, Pick 7 · St. Louis Cardinals" */
  display: string | null;
};

export type MlbSplitRow = {
  code: string;
  label: string;
  stats: MlbPlayerStatLine[];
};

export type MlbPlayerSeasonRow = {
  season: number;
  teamId: number | null;
  team: string;
  /** 1 = MLB; 11–16 = MiLB levels. */
  sportId: number;
  sportAbbrev: string;
  stats: MlbPlayerStatLine[];
};

export type MlbPlayerLevel = "mlb" | "minors";

export type MlbPlayerCard = {
  id: number;
  name: string;
  firstName: string;
  /** Prefer this over legal firstName when present (e.g. Andre vs Neil). */
  useName: string;
  lastName: string;
  number: string | null;
  position: string | null;
  positionName: string | null;
  bats: string | null;
  throws: string | null;
  height: string | null;
  weight: string | null;
  birthDate: string | null;
  /** Age in years — shown prominently on the card. */
  age: number | null;
  birthPlace: string | null;
  mlbDebut: string | null;
  draftYear: number | null;
  draft: MlbDraftInfo | null;
  school: string | null;
  teamId: number | null;
  teamName: string | null;
  teamAbbrev: string | null;
  /** Current club sport id (1 = MLB). */
  sportId: number | null;
  sportName: string | null;
  sportAbbrev: string | null;
  /** Default level to show — current club. */
  defaultLevel: MlbPlayerLevel;
  hasMlbStats: boolean;
  hasMinorsStats: boolean;
  primaryColor: string | null;
  headshot: string;
  actionShot: string;
  /** Wide hero backdrop (16:9 action crop). */
  heroBackdrop: string;
  hitting: MlbPlayerStatLine[];
  pitching: MlbPlayerStatLine[];
  /** Season lines by level (current season). */
  mlbHitting: MlbPlayerStatLine[];
  mlbPitching: MlbPlayerStatLine[];
  minorsHitting: MlbPlayerStatLine[];
  minorsPitching: MlbPlayerStatLine[];
  careerHitting: MlbPlayerStatLine[];
  careerPitching: MlbPlayerStatLine[];
  yearByYearHitting: MlbPlayerSeasonRow[];
  yearByYearPitching: MlbPlayerSeasonRow[];
  season: number;
};

export type MlbGameLogEntry = {
  date: string;
  gamePk: number;
  opponent: string;
  opponentId: number | null;
  isHome: boolean;
  isWin: boolean | null;
  summary: string;
  stats: MlbPlayerStatLine[];
};

export type HotSeatFactor = {
  key: string;
  label: string;
  points: number;
  detail: string;
};

export type MlbManagerSeasonRecord = {
  season: number;
  team: string;
  wins: number;
  losses: number;
  pct: string;
  gb: string;
  divisionRank: number | null;
  postWins: number;
  postLosses: number;
  comments: string;
};

export type MlbManagerStint = {
  team: string;
  start: number;
  end: number;
  wins: number;
  losses: number;
  pct: string;
  departure: string | null;
  departureUrl: string | null;
};

export type MlbManagerCareer = {
  wins: number;
  losses: number;
  pct: string;
  games: number;
  seasons: number;
  postWins: number;
  postLosses: number;
  divisionTitles: number;
  postseasonAppearances: number;
  worldSeriesAppearances: number;
  /** Years the skipper won (or appeared in) the World Series as manager. */
  worldSeriesYears: number[];
  managerOfYear: number;
  /** MoY seasons when known. */
  managerOfYearYears: number[];
};

export type MlbManagerRumor = {
  title: string;
  url: string;
  source: string;
  channel?: string;
};

export type MlbManagerContractTerm = {
  yearOf: number | null;
  of: number | null;
  throughYear: number | null;
  /** e.g. "Year 2 of 4 · through 2028" */
  label: string | null;
};

export type MlbManager = {
  id: number;
  name: string;
  teamId: number;
  teamName: string;
  teamAbbrev: string;
  record: string;
  /** "Team" for full-season skippers; "As manager" for interim stint W–L. */
  recordLabel: "Team" | "As manager";
  wins: number;
  losses: number;
  winPct: number;
  gb: string;
  playoffOdds: number | null;
  /** American odds to be next manager fired (Kalshi / sportsbooks), when available. */
  firedOddsAmerican: string | null;
  firedOddsPct: number | null;
  firedOddsUrl: string | null;
  /** Kalshi Manager of the Year implied % (safety signal). */
  motyOddsAmerican: string | null;
  motyOddsPct: number | null;
  motyOddsUrl: string | null;
  motyLeague: "AL" | "NL" | null;
  divisionRank: number | null;
  contractNote: string | null;
  /** Parsed "year X of Y" estimate when we can infer it. */
  contractTerm: MlbManagerContractTerm | null;
  /** Higher = hotter seat (more likely to be fired). */
  hotSeatScore: number;
  hotSeatRank: number;
  headshot: string;
  primaryColor: string;
  yearsWithTeam: number;
  heatFactors: HotSeatFactor[];
  /** MLB lists them as Interim Manager, or short/1-year leash. */
  isInterim: boolean;
  shortLeash: boolean;
};

export type MlbManagerDetail = MlbManager & {
  age: number | null;
  birthDate: string | null;
  birthPlace: string | null;
  bio: string | null;
  careerNotes: string[];
  school: string | null;
  wikiExtract: string | null;
  timeline: { date: string; text: string }[];
  playingCareer: { season: string; team: string; games: string; summary: string }[];
  seasonRecords: MlbManagerSeasonRecord[];
  stints: MlbManagerStint[];
  career: MlbManagerCareer | null;
  awards: { season: string; name: string }[];
  rumors: MlbManagerRumor[];
  bbrefUrl: string | null;
};

export type MlbTransaction = {
  date: string;
  type: string;
  description: string;
};

export type MlbPlayerContract = {
  contractStatus: string | null;
  currentSalary: { year: string; amount: number; display: string; team: string | null } | null;
  salaryHistory: { year: string; amount: number; display: string; team: string | null }[];
  acquisition: string[];
  url: string | null;
  source: string;
  aav?: string | null;
  totalValue?: string | null;
  /** MLB service time (YY.DDD) when scraped from BBRef. */
  serviceTime?: string | null;
  /** WAR from the same BBRef page as the contract scrape (fallback when extras is blank). */
  seasonWar?: number | null;
  careerWar?: number | null;
};

/** Prefer BBRef-style service time (3.029) over ESPN “5th Season” fluff. */
export function preferServiceTime(
  ...candidates: Array<string | null | undefined>
): string | null {
  const score = (s: string) => {
    const t = s.trim();
    if (/^\d+\.\d{1,3}$/.test(t)) return 4;
    if (/^\d+$/.test(t)) return 3;
    if (/\bseason\b/i.test(t)) return 1;
    return 2;
  };
  let best: string | null = null;
  let bestScore = -1;
  for (const c of candidates) {
    if (!c || !String(c).trim()) continue;
    const s = score(String(c));
    if (s > bestScore) {
      best = String(c).trim();
      bestScore = s;
    }
  }
  return best;
}

function currentSeason(): number {
  return new Date().getFullYear();
}

function ageFromBirthDate(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const born = new Date(`${birthDate}T12:00:00Z`);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const m = now.getUTCMonth() - born.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < born.getUTCDate())) age -= 1;
  return age;
}

export function teamPagePath(teamId: number | null | undefined): string {
  if (teamId == null || !Number.isFinite(teamId)) return "/sports/mlb?solo=1";
  // Sports board opens the team drawer for any mlb-{id} key (and legacy mlb-stl).
  if (teamId === 138) return "/sports?solo=1&team=mlb-stl";
  return `/sports?solo=1&team=mlb-${teamId}`;
}

/** ESPN scoreboard abbrev → MLB Stats API team id. */
const ESPN_ABBREV_TO_TEAM_ID: Record<string, number> = {
  LAA: 108,
  ARI: 109,
  AZ: 109,
  BAL: 110,
  BOS: 111,
  CHC: 112,
  CIN: 113,
  CLE: 114,
  COL: 115,
  DET: 116,
  HOU: 117,
  KC: 118,
  LAD: 119,
  WSH: 120,
  NYM: 121,
  ATH: 133,
  OAK: 133,
  PIT: 134,
  SD: 135,
  SEA: 136,
  SF: 137,
  STL: 138,
  TB: 139,
  TEX: 140,
  TOR: 141,
  MIN: 142,
  PHI: 143,
  ATL: 144,
  CHW: 145,
  CWS: 145,
  MIA: 146,
  NYY: 147,
  MIL: 158,
};

export function mlbTeamIdFromEspnAbbrev(abbrev: string | null | undefined): number | null {
  if (!abbrev) return null;
  return ESPN_ABBREV_TO_TEAM_ID[abbrev.toUpperCase()] ?? null;
}

/** True when abbrevs refer to the same club (AZ↔ARI, CWS↔CHW, etc.). */
export function mlbAbbrevsMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  const au = a.toUpperCase();
  const bu = b.toUpperCase();
  if (au === bu) return true;
  const idA = ESPN_ABBREV_TO_TEAM_ID[au];
  const idB = ESPN_ABBREV_TO_TEAM_ID[bu];
  return idA != null && idB != null && idA === idB;
}

export type RecapInline =
  | { kind: "text"; text: string }
  | { kind: "player"; text: string; playerId: number | null; espnId: string | null }
  | { kind: "team"; text: string; teamId: number | null }
  | { kind: "ext"; text: string; href: string };

/** Turn ESPN recap HTML into inline segments with player/team targets. */
export function parseEspnRecapHtml(
  html: string,
  nameToPlayerId: Map<string, number>,
): RecapInline[] {
  const parts: RecapInline[] = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  // Keep edge spaces — stripHtml used to .trim(), which glued "Name"+"hit" → "Namehit".
  const scrubApPromo = (text: string) =>
    text
      .replace(/\bSee AP['’]?s full MLB coverage here\.?/gi, "")
      .replace(/\bSee AP['’]?s full MLB coverage\.?/gi, "")
      .replace(/\bAP['’]?s full MLB coverage here\.?/gi, "");
  const pushText = (raw: string) => {
    const text = scrubApPromo(
      stripHtml(raw)
        .replace(/\u00a0/g, " ")
        .replace(/—\s*—/g, "—")
        .replace(/[ \t\f\v]+/g, " ")
        // Keep paragraph breaks from ESPN </p> → \n\n (stripHtml).
        .replace(/\n{3,}/g, "\n\n")
        .replace(/[^\S\n]+/g, " "),
    );
    if (text && /[^\s]/.test(text)) parts.push({ kind: "text", text });
  };
  while ((m = re.exec(html))) {
    if (m.index > last) pushText(html.slice(last, m.index));
    const href = m[1];
    const label = stripHtml(m[2]).replace(/\s+/g, " ").trim();
    const mlbComMatch =
      href.match(/mlb\.com\/player\/[^/?#]*-(\d+)/i) || href.match(/mlb\.com\/player\/(\d+)/i);
    const espnPlayerMatch = href.match(/\/mlb\/player\/_\/id\/(\d+)/i);
    const teamMatch = href.match(/\/mlb\/team\/_\/name\/([a-z0-9]+)\//i);
    if (mlbComMatch) {
      const key = normalizePersonName(label);
      const mlbId = Number(mlbComMatch[1]);
      parts.push({
        kind: "player",
        text: label,
        playerId: nameToPlayerId.get(key) ?? (Number.isFinite(mlbId) ? mlbId : null),
        espnId: null,
      });
    } else if (espnPlayerMatch) {
      const key = normalizePersonName(label);
      parts.push({
        kind: "player",
        text: label,
        // ESPN ids are not MLB people ids — only link when the box/index resolves the name.
        playerId: nameToPlayerId.get(key) ?? null,
        espnId: espnPlayerMatch[1],
      });
    } else if (teamMatch) {
      parts.push({
        kind: "team",
        text: label,
        teamId: mlbTeamIdFromEspnAbbrev(teamMatch[1]),
      });
    } else if (/apnews\.com\/hub\/mlb|See AP.?s? full MLB coverage/i.test(`${href} ${label}`)) {
      // Drop AP promo links — they shouldn't leave the reader.
      pushText("");
    } else if (/^https?:/i.test(href) && !/apnews\.com\/hub\/mlb/i.test(href)) {
      parts.push({ kind: "ext", text: label, href });
    } else {
      pushText(label);
    }
    last = m.index + m[0].length;
  }
  if (last < html.length) pushText(html.slice(last));
  return ensureRecapSegmentSpacing(parts);
}

/** Insert a space when adjacent segments would otherwise run together. */
export function ensureRecapSegmentSpacing(parts: RecapInline[]): RecapInline[] {
  if (parts.length < 2) return parts;
  const out: RecapInline[] = [];
  for (let i = 0; i < parts.length; i++) {
    const cur = parts[i];
    if (i === 0) {
      out.push(cur);
      continue;
    }
    const prev = out[out.length - 1];
    const prevText = prev.text;
    const curText = cur.text;
    if (!prevText || !curText) {
      out.push(cur);
      continue;
    }
    const left = prevText[prevText.length - 1];
    const right = curText[0];
    // Space after closing punctuation / letters before the next word or digit
    // (fixes "ball,Zac" / "Freelandpitched" / "Giants5-2").
    const needsSpace =
      !/\s/.test(left) &&
      !/\s/.test(right) &&
      !/^[.,;:!?)\]}'"]/.test(right) &&
      !/[(["']$/.test(left) &&
      (/[A-Za-z0-9)]$/.test(left) ||
        /[.,;:!?)]$/.test(left) ||
        /[A-Za-z0-9]/.test(right));
    if (needsSpace) {
      if (prev.kind === "text") {
        out[out.length - 1] = { ...prev, text: `${prevText} ` };
      } else if (cur.kind === "text") {
        out.push({ ...cur, text: ` ${curText}` });
        continue;
      } else {
        out.push({ kind: "text", text: " " });
      }
    }
    out.push(cur);
  }
  return out;
}

export function normalizePersonName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Map ASCII letters to common accented variants for regex name matching. */
const ACCENT_CHAR_CLASS: Partial<Record<string, string>> = {
  a: "aàáâãäåāăą",
  c: "cçćč",
  e: "eèéêëēėę",
  g: "gğ",
  i: "iìíîïīį",
  l: "lł",
  n: "nñń",
  o: "oòóôõöōő",
  s: "sśš",
  u: "uùúûüūű",
  y: "yýÿ",
  z: "zžźż",
};

function accentFlexibleNamePart(part: string): string {
  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...part]
    .map((ch) => {
      const cls = ACCENT_CHAR_CLASS[ch];
      if (cls) return `[${cls}]`;
      return escapeRe(ch);
    })
    .join("");
}

/** Build a regex fragment for a normalized name that still matches accented prose. */
function accentFlexibleNamePattern(normalizedName: string): string {
  return normalizedName
    .split(/\s+/)
    .filter(Boolean)
    .map(accentFlexibleNamePart)
    .join("[\\s.\\-]+");
}

export function buildPlayerNameIndex(
  players: { id: number; name: string }[],
  opts: { bareLastNames?: boolean } = {},
): Map<string, number> {
  const bareLastNames = opts.bareLastNames ?? true;
  const map = new Map<string, number>();
  for (const p of players) {
    map.set(normalizePersonName(p.name), p.id);
    const bits = p.name.split(/\s+/).filter(Boolean);
    if (bits.length >= 2) {
      map.set(normalizePersonName(`${bits[0][0]} ${bits[bits.length - 1]}`), p.id);
      if (bareLastNames) {
        map.set(normalizePersonName(bits[bits.length - 1]), p.id);
      }
    }
  }
  return map;
}

const NON_PLAYER_NAME_HINTS = new Set(
  [
    "st louis",
    "new york",
    "los angeles",
    "san francisco",
    "san diego",
    "kansas city",
    "tampa bay",
    "major league",
    "opening day",
    "world series",
    "all star",
    "home run",
    "spring training",
    "general manager",
    "national league",
    "american league",
  ].map(normalizePersonName),
);

/** Pull likely "First Last" mentions from article prose for MLB people search. */
export function extractPlayerNameCandidates(text: string, limit = 48): string[] {
  if (!text) return [];
  // Unicode letters so accented names (Rincón, Gastélum) are discovered.
  const matches =
    text.match(/\b[\p{Lu}][\p{L}]+(?:\s+[\p{Lu}][\p{L}.'-]+){1,2}\b/gu) ?? [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of matches) {
    const key = normalizePersonName(raw);
    if (key.length < 5 || seen.has(key) || NON_PLAYER_NAME_HINTS.has(key)) continue;
    seen.add(key);
    out.push(raw.replace(/\s+/g, " ").trim());
    if (out.length >= limit) break;
  }
  return out;
}

export async function fetchMlbTeamRoster(
  teamId: number,
  rosterType: "active" | "40Man" = "active",
): Promise<{ id: number; name: string }[]> {
  const raw = (await mlbGet(`teams/${teamId}/roster`, { rosterType })) as {
    roster?: { person?: { id?: number; fullName?: string } }[];
  };
  return (raw.roster ?? [])
    .map((r) => ({
      id: r.person?.id ?? 0,
      name: r.person?.fullName ?? "",
    }))
    .filter((p) => p.id && p.name);
}

/** Resolve bare "First Last" mentions via MLB people search (capped). */
export async function searchMlbPlayersByNames(
  names: string[],
  limit = 48,
): Promise<Map<string, number>> {
  const found = new Map<string, number>();
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))].slice(0, limit);
  const chunkSize = 8;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (name) => {
        try {
          const raw = (await mlbGet("people/search", { names: name })) as {
            people?: { id?: number; fullName?: string }[];
          };
          const want = normalizePersonName(name);
          const hit =
            (raw.people ?? []).find((p) => normalizePersonName(p.fullName ?? "") === want) ??
            (raw.people ?? []).find((p) => {
              const full = normalizePersonName(p.fullName ?? "");
              return full.endsWith(` ${want.split(" ").slice(-1)[0]}`) && full.startsWith(want.split(" ")[0]);
            });
          if (hit?.id && hit.fullName) {
            found.set(want, hit.id);
            found.set(normalizePersonName(hit.fullName), hit.id);
          }
        } catch {
          // ignore
        }
      }),
    );
  }
  return found;
}

/**
 * Wrap player names in article HTML with links to `/sports/mlb/player/:id`.
 * Longer names win so "Hunter Dobbins" matches before "Dobbins".
 */
export type PlayerWatchKind = "favorite" | "tagged";

/** Favorite takes precedence when a player is both favorited and tagged. */
export function playerWatchKind(
  playerId: number,
  favoriteIds?: Set<number> | null,
  taggedIds?: Set<number> | null,
): PlayerWatchKind | null {
  if (favoriteIds?.has(playerId)) return "favorite";
  if (taggedIds?.has(playerId)) return "tagged";
  return null;
}

export function linkifyMlbPlayersInHtml(
  html: string,
  nameToId: Map<string, number>,
  watchMarks?: Map<number, PlayerWatchKind> | Set<number>,
  favoriteNames?: Set<string> | null,
): string {
  if (!html || typeof DOMParser === "undefined") return html;

  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, "text/html");
  const root = doc.getElementById("root");
  if (!root) return html;

  const markFor = (id: number, nameHint?: string): PlayerWatchKind | null => {
    const byId = (() => {
      if (!watchMarks) return null;
      if (watchMarks instanceof Set) return watchMarks.has(id) ? ("favorite" as const) : null;
      return watchMarks.get(id) ?? null;
    })();
    if (byId === "favorite") return "favorite";
    // Name fallback: favorited under a different/stale player id still gets a star.
    if (nameHint && favoriteNames?.has(normalizePersonName(nameHint))) return "favorite";
    return byId;
  };

  const starSvg = () => {
    const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", "rss-player-watch__icon");
    const path = doc.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      "M12 2.5l2.9 6.1 6.6.7-4.9 4.5 1.4 6.5L12 16.9 5.99 20.3l1.4-6.5L2.5 9.3l6.6-.7L12 2.5z",
    );
    path.setAttribute("fill", "currentColor");
    svg.appendChild(path);
    return svg;
  };

  const makeWatchMark = (kind: PlayerWatchKind) => {
    const mark = doc.createElement("span");
    if (kind === "favorite") {
      mark.className = "rss-player-watch rss-player-watch--favorite";
      mark.title = "Favorite";
      mark.setAttribute("aria-label", "Favorite");
      mark.appendChild(starSvg());
    } else {
      mark.className = "rss-player-watch rss-player-watch--tagged";
      mark.title = "Tagged";
      mark.setAttribute("aria-label", "Tagged");
      // Hollow eye-like dot is too easy to confuse with a star — keep a clear tagged cue.
      mark.textContent = "◈";
    }
    return mark;
  };

  const appendWatchMarkToFrag = (frag: DocumentFragment, id: number, nameHint?: string) => {
    const kind = markFor(id, nameHint);
    if (!kind) return;
    frag.appendChild(makeWatchMark(kind));
  };

  const stripWatchMarksInside = (anchor: Element) => {
    anchor.querySelectorAll(":scope > .rss-player-watch").forEach((el) => el.remove());
    // Drop trailing spacer text left from a prior mark insert.
    let last = anchor.lastChild;
    while (last && last.nodeType === 3 && !/\S/.test(last.textContent ?? "")) {
      const prev = last.previousSibling;
      anchor.removeChild(last);
      last = prev;
    }
  };

  const insertWatchMarkAfter = (anchor: Element, id: number, nameHint?: string) => {
    const kind = markFor(id, nameHint);
    if (!kind) return;
    const mark = makeWatchMark(kind);
    // Leader/standings/results rows are CSS grids/flex rows. A sibling mark becomes
    // its own column and shoves the stat onto the next line (scroll "freak out").
    const boardCell = anchor.closest(
      ".mlb-leader-card__row, .mlb-leader-card__who, .mlb-standings-team-cell, .mlb-results-matchup, .mlb-results-pitchers",
    );
    if (boardCell) {
      stripWatchMarksInside(anchor);
      anchor.appendChild(doc.createTextNode("\u00a0"));
      anchor.appendChild(mark);
      return;
    }
    anchor.parentNode?.insertBefore(mark, anchor.nextSibling);
  };

  const stripAdjacentWatchMarks = (anchor: Element) => {
    let sib = anchor.nextSibling;
    while (sib) {
      const next = sib.nextSibling;
      if (sib.nodeType === 3 && !/\S/.test(sib.textContent ?? "")) {
        sib = next;
        continue;
      }
      if (
        sib.nodeType === 1 &&
        (sib as Element).classList?.contains("rss-player-watch")
      ) {
        sib.parentNode?.removeChild(sib);
        sib = next;
        continue;
      }
      break;
    }
  };

  // Always rewrite existing mlb.com / in-app player anchors to in-app pages.
  // ESPN /mlb/player/_/id/ links use ESPN ids — only rewrite when we can map the name.
  root.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href") ?? "";
    const mlbId =
      href.match(/mlb\.com\/player\/[^/?#]*-(\d+)/i)?.[1] ||
      href.match(/mlb\.com\/player\/(\d+)/i)?.[1] ||
      href.match(/\/sports\/mlb\/player\/(\d+)/i)?.[1];
    if (mlbId) {
      const id = Number(mlbId);
      if (!Number.isFinite(id)) return;
      a.setAttribute("href", `/sports/mlb/player/${id}`);
      a.classList.add("rss-player-link");
      a.removeAttribute("target");
      a.removeAttribute("rel");
      return;
    }
    if (/\/mlb\/player\/_\/id\/\d+/i.test(href)) {
      const label = normalizePersonName(a.textContent ?? "");
      const mapped = label ? nameToId.get(label) : undefined;
      if (mapped == null) return;
      a.setAttribute("href", `/sports/mlb/player/${mapped}`);
      a.classList.add("rss-player-link");
      a.removeAttribute("target");
      a.removeAttribute("rel");
    }
  });

  const names = [...nameToId.keys()]
    .filter((n) => n.length >= 3)
    .sort((a, b) => b.length - a.length);
  if (names.length) {
    const pattern = names.map(accentFlexibleNamePattern).join("|");
    const re = new RegExp(`\\b(?:${pattern})\\b`, "giu");

    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let node = walker.nextNode();
    while (node) {
      const parent = node.parentElement;
      if (parent && !["A", "SCRIPT", "STYLE", "CODE", "PRE"].includes(parent.tagName)) {
        textNodes.push(node as Text);
      }
      node = walker.nextNode();
    }

    for (const textNode of textNodes) {
      const value = textNode.nodeValue ?? "";
      if (!re.test(value)) {
        re.lastIndex = 0;
        continue;
      }
      re.lastIndex = 0;
      const frag = doc.createDocumentFragment();
      let last = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(value))) {
        if (m.index > last) frag.appendChild(doc.createTextNode(value.slice(last, m.index)));
        const matched = m[0];
        const id = nameToId.get(normalizePersonName(matched));
        if (id) {
          const a = doc.createElement("a");
          a.href = `/sports/mlb/player/${id}`;
          a.className = "rss-player-link";
          a.textContent = matched;
          frag.appendChild(a);
          appendWatchMarkToFrag(frag, id, matched);
        } else {
          frag.appendChild(doc.createTextNode(matched));
        }
        last = m.index + matched.length;
      }
      if (last < value.length) frag.appendChild(doc.createTextNode(value.slice(last)));
      textNode.parentNode?.replaceChild(frag, textNode);
    }
  }

  // Ensure every in-app player link has the correct favorite/tagged mark
  // (covers ESPN-prelinked names that skipped the text pass).
  root.querySelectorAll("a.rss-player-link").forEach((a) => {
    const href = a.getAttribute("href") ?? "";
    const id = Number(href.match(/\/sports\/mlb\/player\/(\d+)/i)?.[1]);
    if (!Number.isFinite(id) || id <= 0) return;
    stripAdjacentWatchMarks(a);
    insertWatchMarkAfter(a, id, a.textContent ?? undefined);
  });

  return root.innerHTML;
}

/** Resolve ESPN-linked names missing from the box score via MLB people search. */
export async function resolveMissingRecapPlayers(
  segments: RecapInline[],
): Promise<RecapInline[]> {
  const missing = [
    ...new Set(
      segments
        .filter((s): s is Extract<RecapInline, { kind: "player" }> => s.kind === "player" && s.playerId == null)
        .map((s) => s.text),
    ),
  ].slice(0, 12);
  if (!missing.length) return segments;
  const found = new Map<string, number>();
  await Promise.all(
    missing.map(async (name) => {
      try {
        const raw = (await mlbGet("people/search", { names: name })) as {
          people?: { id?: number; fullName?: string }[];
        };
        const hit =
          (raw.people ?? []).find(
            (p) => normalizePersonName(p.fullName ?? "") === normalizePersonName(name),
          ) ?? raw.people?.[0];
        if (hit?.id) found.set(normalizePersonName(name), hit.id);
      } catch {
        // ignore
      }
    }),
  );
  if (!found.size) return segments;
  return segments.map((s) =>
    s.kind === "player" && s.playerId == null
      ? { ...s, playerId: found.get(normalizePersonName(s.text)) ?? null }
      : s,
  );
}

export function chicagoToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

function chicagoHour(): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  const n = Number(hour);
  // Some engines emit "24" for midnight.
  return n === 24 ? 0 : n;
}

function addDaysIso(isoDate: string, delta: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function fmtWhenShort(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    const time = new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Chicago",
      hour: "numeric",
      minute: "2-digit",
    });
    // Always label Central so cards don't look "wrong" vs EDT article copy.
    const zone = new Date(iso)
      .toLocaleTimeString("en-US", {
        timeZone: "America/Chicago",
        timeZoneName: "short",
      })
      .split(" ")
      .pop();
    return zone ? `${time} ${zone}` : time;
  } catch {
    return null;
  }
}

async function mlbGet(path: string, params?: Record<string, string>): Promise<unknown> {
  const url = new URL(`${MLB}/${path.replace(/^\/+/, "")}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const ctl = new AbortController();
  const t = window.setTimeout(() => ctl.abort(), 14000);
  const res = await fetch(url.toString(), {
    signal: ctl.signal,
    headers: { Accept: "application/json" },
  }).finally(() => window.clearTimeout(t));
  if (!res.ok) throw new Error(`MLB ${res.status}`);
  return res.json();
}

/**
 * Primary headshot URL — real 67 mug first (404 when missing) so callers can
 * fall back to silo / generic. Prefer `PlayerHeadshot` or `mlbHeadshotFallbacks`.
 */
export function mlbHeadshot(playerId: number | string, size: 213 | 426 = 213): string {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/w_${size},q_auto:best/v1/people/${playerId}/headshot/67/current`;
}

/** Silhouette/action cut often present when the 67 headshot is missing for MiLB. */
export function mlbHeadshotSilo(playerId: number | string, size = 180): string {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/w_${size},q_auto:best/v1/people/${playerId}/headshot/silo/current`;
}

/** Last-resort CDN placeholder (always returns an image). */
export function mlbHeadshotGeneric(playerId: number | string, size: 213 | 426 = 213): string {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_${size},q_auto:best/v1/people/${playerId}/headshot/67/current`;
}

/** Ordered headshot candidates for <img onError> fallbacks.
 * MiLB mugshots often live under `/headshot/milb/` when the MLB 67 mug 404s —
 * try those before the generic blue placeholder.
 */
export function mlbHeadshotFallbacks(
  playerId: number | string,
  size: 213 | 426 = 213,
): string[] {
  const milb = `https://img.mlbstatic.com/mlb-photos/image/upload/c_fill,g_auto/w_${size === 426 ? 360 : 180}/v1/people/${playerId}/headshot/milb/current`;
  const milbSimple = `https://img.mlbstatic.com/mlb-photos/image/upload/w_${size},q_auto:best/v1/people/${playerId}/headshot/milb/current`;
  return [
    mlbHeadshot(playerId, size),
    milb,
    milbSimple,
    mlbHeadshotSilo(playerId, size === 426 ? 360 : 180),
    `https://img.mlbstatic.com/mlb-photos/image/upload/w_${size},q_auto:best/v1/people/${playerId}/headshot/83/current`,
    mlbHeadshotGeneric(playerId, size),
  ];
}

/**
 * Primary color team mark (bird-on-bat for STL, etc.).
 * Pair with a white disc (`TeamMark`) on dark backgrounds.
 */
export function mlbTeamLogo(teamId: number | string): string {
  return `https://www.mlbstatic.com/team-logos/team-primary-on-light/${teamId}.svg`;
}

export function mlbLeagueLogo(): string {
  return "https://www.mlbstatic.com/team-logos/league-on-light/1.svg";
}

/** Simpler cap mark — useful at very small sizes. */
export function mlbTeamCapLogo(teamId: number | string): string {
  return `https://www.mlbstatic.com/team-logos/team-cap-on-light/${teamId}.svg`;
}

export function mlbActionShot(playerId: number | string): string {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:action:hero:current.jpg/c_fill,g_auto,w_900,h_1100,q_auto:best/v1/people/${playerId}/action/hero/current`;
}

/** Wide action crop for card backdrops — faces/subjects stay in frame. */
export function mlbHeroBackdrop(playerId: number | string): string {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:action:hero:current.jpg/ar_16:9,c_fill,g_auto,w_1600,q_auto:best/v1/people/${playerId}/action/hero/current`;
}

export type MlbBoxscoreBatter = {
  id: number;
  name: string;
  position: string;
  /** Parent side for this box (avoids wrong-team lookup in Top Performers). */
  teamId: number;
  teamAbbrev: string;
  ab: number;
  r: number;
  h: number;
  rbi: number;
  hr: number;
  /** Season home-run total when available (for HR notes under the box). */
  seasonHr: number | null;
  bb: number;
  so: number;
  avg: string | null;
  obp: string | null;
  slg: string | null;
  /** Season RBI total when available. */
  seasonRbi: number | null;
  summary: string;
};

export type MlbBoxscorePitcher = {
  id: number;
  name: string;
  teamId: number;
  teamAbbrev: string;
  note: string | null;
  /** True when this pitcher started the game. */
  started: boolean;
  ip: string;
  h: number;
  r: number;
  er: number;
  bb: number;
  so: number;
  summary: string;
  /** Season pitching totals from the boxscore (when MLB includes them). */
  seasonWins: number | null;
  seasonLosses: number | null;
  seasonSaves: number | null;
  seasonEra: string | null;
};

export type MlbBoxscoreSide = {
  teamId: number;
  name: string;
  abbrev: string;
  runs: number;
  hits: number;
  errors: number;
  record: string | null;
  probablePitcher: string | null;
  probablePitcherId: number | null;
  primaryColor: string;
  batters: MlbBoxscoreBatter[];
  pitchers: MlbBoxscorePitcher[];
};

export type MlbBoxscore = {
  gamePk: number;
  status: string;
  /** True when the game has not started (Scheduled / Preview / Warmup). */
  pregame: boolean;
  /** True while abstract state is Live. */
  live: boolean;
  inning: string | null;
  when: string | null;
  whenShort: string | null;
  venue: string | null;
  attendance: number | null;
  gameDurationMinutes: number | null;
  weather: string | null;
  officialDate: string | null;
  innings: { num: number; away: number | null; home: number | null }[];
  away: MlbBoxscoreSide;
  home: MlbBoxscoreSide;
  situation: MlbLiveSituation | null;
};

export type MlbGameRecap = {
  espnEventId: string;
  headline: string;
  description: string | null;
  storyHtml: string;
  storyText: string;
  url: string;
  image: string | null;
};

export type MlbRecentBlock = {
  label: string;
  games: number;
  stats: MlbPlayerStatLine[];
};

type BoxPlayerRaw = {
  person?: { id?: number; fullName?: string; boxscoreName?: string };
  jerseyNumber?: string;
  position?: { abbreviation?: string };
  battingOrder?: string;
  stats?: {
    batting?: Record<string, unknown>;
    pitching?: Record<string, unknown>;
  };
  /** Season averages live here — game `stats.batting` has no AVG/OBP/SLG. */
  seasonStats?: {
    batting?: Record<string, unknown>;
    pitching?: Record<string, unknown>;
  };
};

type BoxTeamRaw = {
  team?: { id?: number; name?: string; abbreviation?: string };
  teamStats?: {
    batting?: { runs?: number; hits?: number };
    fielding?: { errors?: number };
  };
  batters?: number[];
  pitchers?: number[];
  players?: Record<string, BoxPlayerRaw>;
};

function mapBoxSide(
  raw: BoxTeamRaw | undefined,
  fallback: { id?: number; name?: string; abbreviation?: string } | undefined,
  rh: { runs?: number; hits?: number; errors?: number } | undefined,
): MlbBoxscoreSide {
  const team = raw?.team ?? fallback;
  const players = raw?.players ?? {};
  const sideTeamId = team?.id ?? 0;
  const sideAbbrev = team?.abbreviation ?? teamAbbrev(team);
  const batters = (raw?.batters ?? [])
    .map((id) => {
      const p = players[`ID${id}`];
      const b = p?.stats?.batting;
      const season = p?.seasonStats?.batting ?? {};
      if (!p || !b) return null;
      const avg = b.avg ?? season.avg;
      const obp = b.obp ?? season.obp;
      const slg = b.slg ?? season.slg;
      const seasonHrRaw = season.homeRuns;
      const seasonHr =
        seasonHrRaw != null && seasonHrRaw !== ""
          ? Number(seasonHrRaw)
          : null;
      const seasonRbiRaw = season.rbi;
      const seasonRbi =
        seasonRbiRaw != null && seasonRbiRaw !== ""
          ? Number(seasonRbiRaw)
          : null;
      return {
        id,
        name: p.person?.fullName ?? "—",
        position: p.position?.abbreviation ?? "",
        teamId: sideTeamId,
        teamAbbrev: sideAbbrev,
        ab: Number(b.atBats ?? 0),
        r: Number(b.runs ?? 0),
        h: Number(b.hits ?? 0),
        rbi: Number(b.rbi ?? 0),
        hr: Number(b.homeRuns ?? 0),
        seasonHr: Number.isFinite(seasonHr) ? seasonHr : null,
        bb: Number(b.baseOnBalls ?? 0),
        so: Number(b.strikeOuts ?? 0),
        avg: avg != null && avg !== "" ? String(avg) : null,
        obp: obp != null && obp !== "" ? String(obp) : null,
        slg: slg != null && slg !== "" ? String(slg) : null,
        seasonRbi: Number.isFinite(seasonRbi) ? seasonRbi : null,
        summary: String(b.summary ?? ""),
      } satisfies MlbBoxscoreBatter;
    })
    .filter((x): x is MlbBoxscoreBatter => x != null);

  const pitchers = (raw?.pitchers ?? [])
    .map((id) => {
      const p = players[`ID${id}`];
      const s = p?.stats?.pitching;
      if (!p || !s) return null;
      const season = p?.seasonStats?.pitching ?? {};
      const gsRaw = s.gamesStarted;
      const started =
        gsRaw === true ||
        gsRaw === 1 ||
        gsRaw === "1" ||
        Number(gsRaw) > 0;
      const readSeason = (key: string): number | null => {
        const v = season[key];
        if (v == null || v === "") return null;
        const n = typeof v === "number" ? v : Number(v);
        return Number.isFinite(n) ? n : null;
      };
      const eraRaw = season.era;
      return {
        id,
        name: p.person?.fullName ?? "—",
        teamId: sideTeamId,
        teamAbbrev: sideAbbrev,
        note: s.note ? String(s.note) : null,
        started,
        ip: String(s.inningsPitched ?? "0.0"),
        h: Number(s.hits ?? 0),
        r: Number(s.runs ?? 0),
        er: Number(s.earnedRuns ?? 0),
        bb: Number(s.baseOnBalls ?? 0),
        so: Number(s.strikeOuts ?? 0),
        summary: String(s.summary ?? ""),
        seasonWins: readSeason("wins"),
        seasonLosses: readSeason("losses"),
        seasonSaves: readSeason("saves"),
        seasonEra: eraRaw != null && eraRaw !== "" ? String(eraRaw) : null,
      } satisfies MlbBoxscorePitcher;
    })
    .filter((x): x is MlbBoxscorePitcher => x != null);

  return {
    teamId: sideTeamId,
    name: team?.name ?? "—",
    abbrev: sideAbbrev,
    runs: rh?.runs ?? Number(raw?.teamStats?.batting?.runs ?? 0),
    hits: rh?.hits ?? Number(raw?.teamStats?.batting?.hits ?? 0),
    errors: rh?.errors ?? Number(raw?.teamStats?.fielding?.errors ?? 0),
    record: null,
    probablePitcher: null,
    probablePitcherId: null,
    primaryColor: TEAM_COLORS[sideTeamId] ?? "d9515c",
    batters,
    pitchers,
  };
}

type LiveFeedPitchEvent = {
  isPitch?: boolean;
  pitchNumber?: number;
  details?: {
    call?: { code?: string; description?: string };
    description?: string;
    type?: { code?: string; description?: string };
    isBall?: boolean;
    isStrike?: boolean;
    isInPlay?: boolean;
  };
  pitchData?: {
    startSpeed?: number;
    strikeZoneTop?: number;
    strikeZoneBottom?: number;
    coordinates?: { pX?: number; pZ?: number };
  };
};

type LiveFeedCurrentPlay = {
  matchup?: {
    batter?: { id?: number; fullName?: string };
    pitcher?: { id?: number; fullName?: string };
    batSide?: { code?: string };
    pitchHand?: { code?: string };
  };
  playEvents?: LiveFeedPitchEvent[];
};

export async function fetchMlbBoxscore(gamePk: number | string): Promise<MlbBoxscore> {
  const pk = String(gamePk);
  const [box, live] = await Promise.all([
    mlbGet(`game/${pk}/boxscore`) as Promise<{ teams?: { away?: BoxTeamRaw; home?: BoxTeamRaw } }>,
    fetch(`https://statsapi.mlb.com/api/v1.1/game/${pk}/feed/live`, {
      headers: { Accept: "application/json" },
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null) as Promise<{
      gameData?: {
        status?: { detailedState?: string; abstractGameState?: string };
        datetime?: { dateTime?: string; officialDate?: string };
        venue?: { name?: string };
        weather?: { condition?: string; temp?: string; wind?: string };
        gameInfo?: { attendance?: number; gameDurationMinutes?: number };
        probablePitchers?: {
          away?: { id?: number; fullName?: string };
          home?: { id?: number; fullName?: string };
        };
        teams?: {
          away?: {
            id?: number;
            name?: string;
            abbreviation?: string;
            record?: { wins?: number; losses?: number; leagueRecord?: { wins?: number; losses?: number } };
          };
          home?: {
            id?: number;
            name?: string;
            abbreviation?: string;
            record?: { wins?: number; losses?: number; leagueRecord?: { wins?: number; losses?: number } };
          };
        };
      };
      liveData?: {
        linescore?: {
          currentInningOrdinal?: string;
          inningState?: string;
          balls?: number;
          strikes?: number;
          outs?: number;
          offense?: LinescoreOffense;
          defense?: LinescoreDefense;
          innings?: { num?: number; away?: { runs?: number }; home?: { runs?: number } }[];
          teams?: {
            away?: { runs?: number; hits?: number; errors?: number };
            home?: { runs?: number; hits?: number; errors?: number };
          };
        };
        plays?: { currentPlay?: LiveFeedCurrentPlay };
      };
    } | null>,
  ]);

  const ls = live?.liveData?.linescore;
  const weather = live?.gameData?.weather;
  const weatherLine = weather
    ? [weather.temp ? `${weather.temp}°` : null, weather.condition, weather.wind]
        .filter(Boolean)
        .join(" · ")
    : null;
  const status = live?.gameData?.status?.detailedState ?? "Final";
  const abstract = live?.gameData?.status?.abstractGameState ?? "";
  const pregame = /preview|scheduled|pre[- ]?game|warmup/i.test(`${status} ${abstract}`);
  const isLive = abstract === "Live" || /in progress|manager challenge|delayed/i.test(status);
  /** Warmup still surfaces batter/pitcher + empty zone like ESPN Live. */
  const trackAtBat = isLive || /warmup/i.test(status);
  const inn =
    (isLive || /warmup/i.test(status)) && ls
      ? `${ls.inningState ?? ""} ${ls.currentInningOrdinal ?? ""}`.trim() ||
        (/warmup/i.test(status) ? "Warmup" : null)
      : null;
  const away = mapBoxSide(box.teams?.away, live?.gameData?.teams?.away, ls?.teams?.away);
  const home = mapBoxSide(box.teams?.home, live?.gameData?.teams?.home, ls?.teams?.home);
  const sideRecord = (
    t: { record?: { wins?: number; losses?: number; leagueRecord?: { wins?: number; losses?: number } } } | undefined,
  ): string | null => {
    const lr = t?.record?.leagueRecord;
    const w = lr?.wins ?? t?.record?.wins;
    const l = lr?.losses ?? t?.record?.losses;
    return w != null && l != null ? `${w}-${l}` : null;
  };
  away.record = sideRecord(live?.gameData?.teams?.away);
  home.record = sideRecord(live?.gameData?.teams?.home);
  const probs = live?.gameData?.probablePitchers;
  away.probablePitcher = probs?.away?.fullName ?? null;
  away.probablePitcherId = probs?.away?.id ?? null;
  home.probablePitcher = probs?.home?.fullName ?? null;
  home.probablePitcherId = probs?.home?.id ?? null;
  const whenIso = live?.gameData?.datetime?.dateTime ?? null;
  const currentPlay = live?.liveData?.plays?.currentPlay;
  return {
    gamePk: Number(pk),
    status,
    pregame,
    live: isLive,
    inning: inn,
    when: fmtWhen(whenIso),
    whenShort: fmtWhenShort(whenIso),
    venue: live?.gameData?.venue?.name ?? null,
    attendance: live?.gameData?.gameInfo?.attendance ?? null,
    gameDurationMinutes: live?.gameData?.gameInfo?.gameDurationMinutes ?? null,
    weather: weatherLine || null,
    officialDate: live?.gameData?.datetime?.officialDate ?? null,
    innings: (ls?.innings ?? []).map((i) => ({
      num: i.num ?? 0,
      away: i.away?.runs ?? null,
      home: i.home?.runs ?? null,
    })),
    away,
    home,
    situation: mapLiveSituation(ls, trackAtBat, {
      currentPlay,
      awayRaw: box.teams?.away,
      homeRaw: box.teams?.home,
    }),
  };
}

/** Season line for a probable pitcher on the game preview. */
export type MlbPitcherSeasonLine = {
  id: number;
  name: string;
  shortName: string;
  number: string | null;
  hand: string | null;
  wins: number;
  losses: number;
  era: string;
  whip: string;
  ip: string;
  h: number;
  k: number;
  bb: number;
  hr: number;
};

/** Projected/confirmed lineup hitter with season batting line. */
export type MlbLineupHitter = {
  id: number;
  name: string;
  shortName: string;
  position: string;
  hits: number;
  atBats: number;
  hr: number;
  rbi: number;
  sb: number;
  avg: string;
};

export type MlbPreviewLeaderSide = {
  id: number;
  name: string;
  shortName: string;
  value: string;
  detail: string;
};

/** Head-to-head category leader (one player per side). */
export type MlbPreviewLeaderRow = {
  category: string;
  statLabel: string;
  away: MlbPreviewLeaderSide | null;
  home: MlbPreviewLeaderSide | null;
};

export type MlbGamePreview = {
  awayPitcher: MlbPitcherSeasonLine | null;
  homePitcher: MlbPitcherSeasonLine | null;
  awayLineup: MlbLineupHitter[];
  homeLineup: MlbLineupHitter[];
  battingLeaders: MlbPreviewLeaderRow[];
  pitchingLeaders: MlbPreviewLeaderRow[];
};

function shortPlayerName(
  fullName: string,
  opts?: { useName?: string | null; lastName?: string | null },
): string {
  const last = (opts?.lastName || "").trim();
  if (last) {
    const first = (opts?.useName || fullName.replace(last, "").trim().split(/\s+/)[0] || "").trim();
    if (!first) return last;
    return `${first[0]!.toUpperCase()}. ${last}`;
  }
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return fullName;
  return `${parts[0]![0]!.toUpperCase()}. ${parts[parts.length - 1]}`;
}

function numStat(stat: Record<string, unknown> | undefined, key: string): number {
  const v = stat?.[key];
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function strStat(stat: Record<string, unknown> | undefined, key: string, fallback = "—"): string {
  const v = stat?.[key];
  if (v == null || v === "") return fallback;
  return String(v);
}

type PeopleHydrateRaw = {
  people?: {
    id?: number;
    fullName?: string;
    useName?: string;
    firstName?: string;
    lastName?: string;
    primaryNumber?: string;
    pitchHand?: { code?: string };
    primaryPosition?: { abbreviation?: string };
    stats?: { splits?: { stat?: Record<string, unknown> }[] }[];
  }[];
};

async function fetchPeopleWithSeasonStats(
  ids: number[],
  group: "hitting" | "pitching",
): Promise<PeopleHydrateRaw["people"]> {
  const uniq = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
  if (!uniq.length) return [];
  const season = currentSeason();
  const raw = (await mlbGet("people", {
    personIds: uniq.join(","),
    hydrate: `stats(group=[${group}],type=[season],season=${season})`,
  })) as PeopleHydrateRaw;
  return raw.people ?? [];
}

function mapPitcherSeasonLine(
  p: NonNullable<PeopleHydrateRaw["people"]>[number],
): MlbPitcherSeasonLine {
  const stat = p.stats?.[0]?.splits?.[0]?.stat ?? {};
  const name = p.fullName || "Pitcher";
  const handCode = p.pitchHand?.code?.toUpperCase() || null;
  return {
    id: p.id ?? 0,
    name,
    shortName: shortPlayerName(name, { useName: p.useName, lastName: p.lastName }),
    number: p.primaryNumber ? String(p.primaryNumber) : null,
    hand: handCode ? `${handCode}HP` : null,
    wins: numStat(stat, "wins"),
    losses: numStat(stat, "losses"),
    era: strStat(stat, "era"),
    whip: strStat(stat, "whip"),
    ip: strStat(stat, "inningsPitched", "0.0"),
    h: numStat(stat, "hits"),
    k: numStat(stat, "strikeOuts"),
    bb: numStat(stat, "baseOnBalls"),
    hr: numStat(stat, "homeRuns"),
  };
}

/** Season lines for probable pitchers (hero / RUWT cards). */
export async function fetchPitcherSeasonLines(
  ids: number[],
): Promise<Map<number, MlbPitcherSeasonLine>> {
  const people = await fetchPeopleWithSeasonStats(ids, "pitching");
  const map = new Map<number, MlbPitcherSeasonLine>();
  for (const p of people ?? []) {
    if (p.id == null) continue;
    map.set(p.id, mapPitcherSeasonLine(p));
  }
  return map;
}

function mapLineupHitter(
  p: NonNullable<PeopleHydrateRaw["people"]>[number],
  fallbackPos: string,
): MlbLineupHitter {
  const stat = p.stats?.[0]?.splits?.[0]?.stat ?? {};
  const name = p.fullName || "Hitter";
  return {
    id: p.id ?? 0,
    name,
    shortName: shortPlayerName(name, { useName: p.useName, lastName: p.lastName }),
    position: p.primaryPosition?.abbreviation || fallbackPos || "—",
    hits: numStat(stat, "hits"),
    atBats: numStat(stat, "atBats"),
    hr: numStat(stat, "homeRuns"),
    rbi: numStat(stat, "rbi"),
    sb: numStat(stat, "stolenBases"),
    avg: strStat(stat, "avg", ".000"),
  };
}

async function fetchTeamCategoryLeader(
  teamId: number,
  group: "hitting" | "pitching",
  sortStat: string,
  order: "asc" | "desc",
  minQualifier: { key: string; min: number },
  format: (stat: Record<string, unknown>, player: { id: number; name: string; shortName: string }) => {
    value: string;
    detail: string;
  },
): Promise<MlbPreviewLeaderSide | null> {
  const season = currentSeason();
  try {
    const raw = (await mlbGet("stats", {
      stats: "season",
      group,
      season: String(season),
      sportIds: "1",
      teamIds: String(teamId),
      playerPool: "all",
      limit: "40",
      sortStat,
      order,
    })) as {
      stats?: {
        splits?: {
          player?: { id?: number; fullName?: string; useName?: string; lastName?: string };
          stat?: Record<string, unknown>;
        }[];
      }[];
    };
    for (const split of raw.stats?.[0]?.splits ?? []) {
      const stat = split.stat ?? {};
      if (numStat(stat, minQualifier.key) < minQualifier.min) continue;
      const id = split.player?.id ?? 0;
      if (!id) continue;
      const name = split.player?.fullName || "Player";
      const shortName = shortPlayerName(name, {
        useName: split.player?.useName,
        lastName: split.player?.lastName,
      });
      const formatted = format(stat, { id, name, shortName });
      return { id, name, shortName, value: formatted.value, detail: formatted.detail };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * ESPN-style preview payload: probable pitcher season lines, lineups with
 * season batting, and head-to-head batting/pitching category leaders.
 */
export async function fetchMlbGamePreview(gamePk: number | string): Promise<MlbGamePreview> {
  const pk = String(gamePk);
  const schedule = (await mlbGet("schedule", {
    gamePk: pk,
    hydrate: "probablePitcher,lineups,team",
  })) as {
    dates?: {
      games?: {
        teams?: {
          away?: { team?: { id?: number }; probablePitcher?: { id?: number; fullName?: string } };
          home?: { team?: { id?: number }; probablePitcher?: { id?: number; fullName?: string } };
        };
        lineups?: {
          awayPlayers?: {
            id?: number;
            primaryPosition?: { abbreviation?: string };
          }[];
          homePlayers?: {
            id?: number;
            primaryPosition?: { abbreviation?: string };
          }[];
        };
      }[];
    }[];
  };

  const game = schedule.dates?.[0]?.games?.[0];
  const awayTeamId = game?.teams?.away?.team?.id ?? 0;
  const homeTeamId = game?.teams?.home?.team?.id ?? 0;
  const awayPitcherId = game?.teams?.away?.probablePitcher?.id ?? null;
  const homePitcherId = game?.teams?.home?.probablePitcher?.id ?? null;
  const awayLineupRaw = game?.lineups?.awayPlayers ?? [];
  const homeLineupRaw = game?.lineups?.homePlayers ?? [];

  const pitcherIds = [awayPitcherId, homePitcherId].filter((id): id is number => id != null);
  const lineupIds = [...awayLineupRaw, ...homeLineupRaw]
    .map((p) => p.id)
    .filter((id): id is number => id != null);

  const [pitchers, hitters, ...leaderPairs] = await Promise.all([
    fetchPeopleWithSeasonStats(pitcherIds, "pitching"),
    fetchPeopleWithSeasonStats(lineupIds, "hitting"),
    // Batting leaders: HR, AVG, RBI, SB
    Promise.all([
      awayTeamId
        ? fetchTeamCategoryLeader(awayTeamId, "hitting", "homeRuns", "desc", { key: "atBats", min: 50 }, (s) => ({
            value: String(numStat(s, "homeRuns")),
            detail: `${strStat(s, "avg")} AVG · ${numStat(s, "rbi")} RBI`,
          }))
        : Promise.resolve(null),
      homeTeamId
        ? fetchTeamCategoryLeader(homeTeamId, "hitting", "homeRuns", "desc", { key: "atBats", min: 50 }, (s) => ({
            value: String(numStat(s, "homeRuns")),
            detail: `${strStat(s, "avg")} AVG · ${numStat(s, "rbi")} RBI`,
          }))
        : Promise.resolve(null),
    ]),
    Promise.all([
      awayTeamId
        ? fetchTeamCategoryLeader(awayTeamId, "hitting", "avg", "desc", { key: "atBats", min: 100 }, (s) => ({
            value: strStat(s, "avg"),
            detail: `${numStat(s, "homeRuns")} HR · ${numStat(s, "rbi")} RBI`,
          }))
        : Promise.resolve(null),
      homeTeamId
        ? fetchTeamCategoryLeader(homeTeamId, "hitting", "avg", "desc", { key: "atBats", min: 100 }, (s) => ({
            value: strStat(s, "avg"),
            detail: `${numStat(s, "homeRuns")} HR · ${numStat(s, "rbi")} RBI`,
          }))
        : Promise.resolve(null),
    ]),
    Promise.all([
      awayTeamId
        ? fetchTeamCategoryLeader(awayTeamId, "hitting", "rbi", "desc", { key: "atBats", min: 50 }, (s) => ({
            value: String(numStat(s, "rbi")),
            detail: `${numStat(s, "homeRuns")} HR · ${strStat(s, "avg")} AVG`,
          }))
        : Promise.resolve(null),
      homeTeamId
        ? fetchTeamCategoryLeader(homeTeamId, "hitting", "rbi", "desc", { key: "atBats", min: 50 }, (s) => ({
            value: String(numStat(s, "rbi")),
            detail: `${numStat(s, "homeRuns")} HR · ${strStat(s, "avg")} AVG`,
          }))
        : Promise.resolve(null),
    ]),
    Promise.all([
      awayTeamId
        ? fetchTeamCategoryLeader(awayTeamId, "hitting", "stolenBases", "desc", { key: "atBats", min: 30 }, (s) => ({
            value: String(numStat(s, "stolenBases")),
            detail: `${strStat(s, "avg")} AVG · ${numStat(s, "homeRuns")} HR`,
          }))
        : Promise.resolve(null),
      homeTeamId
        ? fetchTeamCategoryLeader(homeTeamId, "hitting", "stolenBases", "desc", { key: "atBats", min: 30 }, (s) => ({
            value: String(numStat(s, "stolenBases")),
            detail: `${strStat(s, "avg")} AVG · ${numStat(s, "homeRuns")} HR`,
          }))
        : Promise.resolve(null),
    ]),
    // Pitching leaders: ERA, SO, W, WHIP
    Promise.all([
      awayTeamId
        ? fetchTeamCategoryLeader(awayTeamId, "pitching", "era", "asc", { key: "inningsPitched", min: 40 }, (s) => ({
            value: strStat(s, "era"),
            detail: `${numStat(s, "strikeOuts")} SO · ${strStat(s, "inningsPitched")} IP`,
          }))
        : Promise.resolve(null),
      homeTeamId
        ? fetchTeamCategoryLeader(homeTeamId, "pitching", "era", "asc", { key: "inningsPitched", min: 40 }, (s) => ({
            value: strStat(s, "era"),
            detail: `${numStat(s, "strikeOuts")} SO · ${strStat(s, "inningsPitched")} IP`,
          }))
        : Promise.resolve(null),
    ]),
    Promise.all([
      awayTeamId
        ? fetchTeamCategoryLeader(awayTeamId, "pitching", "strikeOuts", "desc", { key: "inningsPitched", min: 20 }, (s) => ({
            value: String(numStat(s, "strikeOuts")),
            detail: `${strStat(s, "era")} ERA · ${strStat(s, "inningsPitched")} IP`,
          }))
        : Promise.resolve(null),
      homeTeamId
        ? fetchTeamCategoryLeader(homeTeamId, "pitching", "strikeOuts", "desc", { key: "inningsPitched", min: 20 }, (s) => ({
            value: String(numStat(s, "strikeOuts")),
            detail: `${strStat(s, "era")} ERA · ${strStat(s, "inningsPitched")} IP`,
          }))
        : Promise.resolve(null),
    ]),
    Promise.all([
      awayTeamId
        ? fetchTeamCategoryLeader(awayTeamId, "pitching", "wins", "desc", { key: "inningsPitched", min: 20 }, (s) => ({
            value: String(numStat(s, "wins")),
            detail: `${numStat(s, "wins")}-${numStat(s, "losses")} · ${strStat(s, "era")} ERA`,
          }))
        : Promise.resolve(null),
      homeTeamId
        ? fetchTeamCategoryLeader(homeTeamId, "pitching", "wins", "desc", { key: "inningsPitched", min: 20 }, (s) => ({
            value: String(numStat(s, "wins")),
            detail: `${numStat(s, "wins")}-${numStat(s, "losses")} · ${strStat(s, "era")} ERA`,
          }))
        : Promise.resolve(null),
    ]),
    Promise.all([
      awayTeamId
        ? fetchTeamCategoryLeader(awayTeamId, "pitching", "whip", "asc", { key: "inningsPitched", min: 40 }, (s) => ({
            value: strStat(s, "whip"),
            detail: `${strStat(s, "era")} ERA · ${numStat(s, "strikeOuts")} SO`,
          }))
        : Promise.resolve(null),
      homeTeamId
        ? fetchTeamCategoryLeader(homeTeamId, "pitching", "whip", "asc", { key: "inningsPitched", min: 40 }, (s) => ({
            value: strStat(s, "whip"),
            detail: `${strStat(s, "era")} ERA · ${numStat(s, "strikeOuts")} SO`,
          }))
        : Promise.resolve(null),
    ]),
  ]);

  const pitcherById = new Map((pitchers ?? []).map((p) => [p.id ?? 0, p]));
  const hitterById = new Map((hitters ?? []).map((p) => [p.id ?? 0, p]));

  const mapLineup = (
    rows: { id?: number; primaryPosition?: { abbreviation?: string } }[],
  ): MlbLineupHitter[] =>
    rows
      .map((row) => {
        const id = row.id;
        if (id == null) return null;
        const person = hitterById.get(id);
        if (!person) {
          return {
            id,
            name: "Player",
            shortName: "Player",
            position: row.primaryPosition?.abbreviation || "—",
            hits: 0,
            atBats: 0,
            hr: 0,
            rbi: 0,
            sb: 0,
            avg: ".000",
          } satisfies MlbLineupHitter;
        }
        return mapLineupHitter(person, row.primaryPosition?.abbreviation || "—");
      })
      .filter((x): x is MlbLineupHitter => x != null);

  const battingDefs: { category: string; statLabel: string }[] = [
    { category: "Home Runs", statLabel: "HR" },
    { category: "Batting Average", statLabel: "AVG" },
    { category: "RBI", statLabel: "RBI" },
    { category: "Stolen Bases", statLabel: "SB" },
  ];
  const pitchingDefs: { category: string; statLabel: string }[] = [
    { category: "ERA", statLabel: "ERA" },
    { category: "Strikeouts", statLabel: "SO" },
    { category: "Wins", statLabel: "W" },
    { category: "WHIP", statLabel: "WHIP" },
  ];

  const battingLeaders: MlbPreviewLeaderRow[] = battingDefs.map((def, i) => {
    const pair = leaderPairs[i] as [MlbPreviewLeaderSide | null, MlbPreviewLeaderSide | null];
    return { category: def.category, statLabel: def.statLabel, away: pair[0], home: pair[1] };
  });
  const pitchingLeaders: MlbPreviewLeaderRow[] = pitchingDefs.map((def, i) => {
    const pair = leaderPairs[i + 4] as [MlbPreviewLeaderSide | null, MlbPreviewLeaderSide | null];
    return { category: def.category, statLabel: def.statLabel, away: pair[0], home: pair[1] };
  });

  return {
    awayPitcher: awayPitcherId ? mapPitcherSeasonLine(pitcherById.get(awayPitcherId) ?? { id: awayPitcherId, fullName: game?.teams?.away?.probablePitcher?.fullName }) : null,
    homePitcher: homePitcherId ? mapPitcherSeasonLine(pitcherById.get(homePitcherId) ?? { id: homePitcherId, fullName: game?.teams?.home?.probablePitcher?.fullName }) : null,
    awayLineup: mapLineup(awayLineupRaw),
    homeLineup: mapLineup(homeLineupRaw),
    battingLeaders,
    pitchingLeaders,
  };
}

export type MlbBbrefPreviewSummary = {
  record: string | null;
  manager: string | null;
  gameNumber: string | null;
  standing: string | null;
  last10: string | null;
  last20: string | null;
  last30: string | null;
  home: string | null;
  away: string | null;
  extraInnings: string | null;
  vsRhp: string | null;
  vsLhp: string | null;
  oneRun: string | null;
};

export type MlbBbrefGamePreview = {
  url: string;
  awayAbbrev: string;
  homeAbbrev: string;
  awaySummary: MlbBbrefPreviewSummary;
  homeSummary: MlbBbrefPreviewSummary;
  seasonSeries: { date: string; result: string }[];
  awayBatters: Record<string, string>[];
  homeBatters: Record<string, string>[];
  awayPitchers: Record<string, string>[];
  homePitchers: Record<string, string>[];
};

function emptyBbrefSummary(): MlbBbrefPreviewSummary {
  return {
    record: null,
    manager: null,
    gameNumber: null,
    standing: null,
    last10: null,
    last20: null,
    last30: null,
    home: null,
    away: null,
    extraInnings: null,
    vsRhp: null,
    vsLhp: null,
    oneRun: null,
  };
}

function mapBbrefPreviewSummary(raw: unknown): MlbBbrefPreviewSummary {
  const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (k: string) => {
    const v = s[k];
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  return {
    record: str("record"),
    manager: str("manager"),
    gameNumber: str("gameNumber"),
    standing: str("standing"),
    last10: str("last10"),
    last20: str("last20"),
    last30: str("last30"),
    home: str("home"),
    away: str("away"),
    extraInnings: str("extraInnings"),
    vsRhp: str("vsRhp"),
    vsLhp: str("vsLhp"),
    oneRun: str("oneRun"),
  };
}

/** Baseball-Reference pregame preview tables via sports edge. */
export async function fetchBbrefGamePreview(opts: {
  homeAbbrev: string;
  awayAbbrev: string;
  date: string; // YYYY-MM-DD
}): Promise<MlbBbrefGamePreview | null> {
  const homeAbbrev = opts.homeAbbrev.trim().toUpperCase();
  const awayAbbrev = opts.awayAbbrev.trim().toUpperCase();
  const date = opts.date.trim();
  if (!homeAbbrev || !awayAbbrev || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const body = {
    action: "bbrefGamePreview",
    homeAbbrev,
    awayAbbrev,
    date,
  };

  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  let raw: unknown = null;
  if (base && key) {
    try {
      const ctl = new AbortController();
      const timer = window.setTimeout(() => ctl.abort(), 35_000);
      try {
        const res = await fetch(`${base}/functions/v1/sports`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
            apikey: key,
          },
          body: JSON.stringify(body),
          signal: ctl.signal,
        });
        if (res.ok) raw = await res.json();
      } finally {
        window.clearTimeout(timer);
      }
    } catch {
      /* fall through */
    }
  }

  if (!raw) {
    try {
      const { data } = await supabase.functions.invoke("sports", { body });
      raw = data;
    } catch {
      return null;
    }
  }

  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (d.error && !d.url) return null;

  const rows = (v: unknown): Record<string, string>[] =>
    Array.isArray(v)
      ? v.filter((r): r is Record<string, string> => Boolean(r) && typeof r === "object")
      : [];

  const series = Array.isArray(d.seasonSeries)
    ? d.seasonSeries
        .filter((r): r is { date?: string; result?: string } => Boolean(r) && typeof r === "object")
        .map((r) => ({ date: String(r.date ?? ""), result: String(r.result ?? "") }))
    : [];

  return {
    url: typeof d.url === "string" ? d.url : "",
    awayAbbrev: typeof d.awayAbbrev === "string" ? d.awayAbbrev : awayAbbrev,
    homeAbbrev: typeof d.homeAbbrev === "string" ? d.homeAbbrev : homeAbbrev,
    awaySummary: d.awaySummary ? mapBbrefPreviewSummary(d.awaySummary) : emptyBbrefSummary(),
    homeSummary: d.homeSummary ? mapBbrefPreviewSummary(d.homeSummary) : emptyBbrefSummary(),
    seasonSeries: series,
    awayBatters: rows(d.awayBatters),
    homeBatters: rows(d.homeBatters),
    awayPitchers: rows(d.awayPitchers),
    homePitchers: rows(d.homePitchers),
  };
}

function stripHtml(html: string): string {
  // Do not trim — callers that parse inline HTML need leading/trailing spaces
  // so linked names don't run into neighboring words.
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n");
}

/** Plain text from article HTML — used for player-name discovery in Dispatch. */
export function htmlToPlainText(html: string): string {
  return stripHtml(html).replace(/\s+/g, " ").trim();
}

/** Pull ESPN `gameId` from mlb recap / preview / game URLs. */
export function parseEspnGameIdFromUrl(url: string): string | null {
  const m = url.match(/gameId\/(\d+)/i) || url.match(/[?&]gameId=(\d+)/i);
  return m?.[1] ?? null;
}

/**
 * Map an ESPN event id → MLB Stats API `gamePk` via competition date + home/away teams.
 * Returns null when the summary or schedule lookup fails / no match.
 */
export async function resolveMlbGamePkFromEspnEvent(eventId: string): Promise<number | null> {
  if (!eventId) return null;
  try {
    const sum = await fetchEspnSiteJson<{
      header?: {
        competitions?: {
          date?: string;
          competitors?: { homeAway?: string; team?: { abbreviation?: string; id?: string } }[];
        }[];
      };
      competitions?: {
        date?: string;
        competitors?: { homeAway?: string; team?: { abbreviation?: string; id?: string } }[];
      }[];
    }>(`baseball/mlb/summary?event=${encodeURIComponent(eventId)}`);
    if (!sum) return null;
    const comp = sum.header?.competitions?.[0] ?? sum.competitions?.[0];
    const competitors = comp?.competitors ?? [];
    const homeAbbrev = competitors.find((c) => c.homeAway === "home")?.team?.abbreviation;
    const awayAbbrev = competitors.find((c) => c.homeAway === "away")?.team?.abbreviation;
    if (!comp?.date || !homeAbbrev || !awayAbbrev) return null;

    const date = new Date(comp.date).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

    const homeId = mlbTeamIdFromEspnAbbrev(homeAbbrev);
    const awayId = mlbTeamIdFromEspnAbbrev(awayAbbrev);
    const homeKey = homeAbbrev.toUpperCase();
    const awayKey = awayAbbrev.toUpperCase();

    const schedule = (await mlbGet("schedule", {
      sportId: "1",
      date,
      hydrate: "team",
    })) as {
      dates?: {
        games?: {
          gamePk?: number;
          teams?: {
            away?: { team?: { id?: number; abbreviation?: string } };
            home?: { team?: { id?: number; abbreviation?: string } };
          };
        }[];
      }[];
    };

    const games = schedule.dates?.[0]?.games ?? [];
    for (const g of games) {
      const hAbb = (g.teams?.home?.team?.abbreviation ?? "").toUpperCase();
      const aAbb = (g.teams?.away?.team?.abbreviation ?? "").toUpperCase();
      const hId = g.teams?.home?.team?.id;
      const aId = g.teams?.away?.team?.id;
      const abbrevMatch = hAbb === homeKey && aAbb === awayKey;
      const idMatch =
        homeId != null &&
        awayId != null &&
        hId === homeId &&
        aId === awayId;
      if ((abbrevMatch || idMatch) && g.gamePk != null) return g.gamePk;
    }
    return null;
  } catch {
    return null;
  }
}

/** Normalize MLB / ESPN abbrev aliases so CWS↔CHW, AZ↔ARI, etc. match. */
function mlbAbbrevAliases(abbrev: string): Set<string> {
  const u = abbrev.toUpperCase();
  const id = ESPN_ABBREV_TO_TEAM_ID[u];
  const out = new Set<string>([u]);
  if (id == null) return out;
  for (const [k, v] of Object.entries(ESPN_ABBREV_TO_TEAM_ID)) {
    if (v === id) out.add(k);
  }
  return out;
}

/**
 * ESPN site JSON — `site.web.api` is tried first (more reliable from some edges),
 * `site.api` is the fallback. For `summary` endpoints we keep checking hosts and
 * prefer whichever response carries the longer `article.story` (ESPN sometimes
 * serves a fuller story from one host and a stub from the other).
 */
async function fetchEspnSiteJson<T>(pathAfterSports: string): Promise<T | null> {
  const hosts = [
    "https://site.web.api.espn.com/apis/site/v2/sports",
    "https://site.api.espn.com/apis/site/v2/sports",
  ];
  const isSummary = /\/summary(?:[/?]|$)/.test(pathAfterSports);
  const path = pathAfterSports.replace(/^\/+/, "");

  let best: T | null = null;
  let bestStoryLen = -1;
  for (const host of hosts) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(`${host}/${path}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!res.ok) continue;
      const json = (await res.json()) as T;
      if (!isSummary) return json;

      const storyLen = stripHtml(
        (json as { article?: { story?: string } } | null)?.article?.story ?? "",
      ).trim().length;
      if (storyLen > bestStoryLen) {
        best = json;
        bestStoryLen = storyLen;
      }
      if (bestStoryLen >= 200) return best;
    } catch {
      /* next host */
    } finally {
      clearTimeout(timer);
    }
  }
  return best;
}

/** League-wide ESPN promo / fantasy copy — never treat as a game preview. */
export function isEspnGamePromoCopy(headline?: string | null, ...bodies: (string | null | undefined)[]): boolean {
  const blob = [headline, ...bodies].filter(Boolean).join(" ");
  return /fantasy baseball|optimize your fantasy|stay ahead of the game|rolling 10-day outlook|team hitting ratings|pitcher projections|draftkings|fanduel|betmgm|promo code/i.test(
    blob,
  );
}

type EspnStorySrc = {
  headline?: string;
  description?: string;
  story?: string;
  type?: string;
  links?: { web?: { href?: string } };
  images?: { url?: string }[];
};

type EspnGameSummary = {
  header?: {
    competitions?: {
      status?: { type?: { state?: string; description?: string; detail?: string } };
      competitors?: {
        homeAway?: string;
        team?: {
          id?: string;
          displayName?: string;
          abbreviation?: string;
        };
      }[];
    }[];
  };
  article?: EspnStorySrc;
  news?: { articles?: EspnStorySrc[] };
  predictor?: {
    homeTeam?: { gameProjection?: string };
    awayTeam?: { gameProjection?: string };
  };
  seasonseries?: {
    type?: string;
    summary?: string;
    events?: {
      id?: string;
      date?: string;
      status?: string;
      statusType?: { state?: string };
      competitors?: {
        homeAway?: string;
        score?: string | number;
        winner?: boolean;
        team?: { abbreviation?: string; displayName?: string; id?: string };
      }[];
      links?: { href?: string; text?: string }[];
    }[];
  }[];
  lastFiveGames?: {
    team?: { id?: string; abbreviation?: string };
    events?: {
      id?: string;
      atVs?: string;
      score?: string;
      gameResult?: string;
      gameDate?: string;
      opponent?: { abbreviation?: string; id?: string };
      opponentLogo?: string;
      links?: { href?: string; text?: string }[];
    }[];
  }[];
  boxscore?: {
    teams?: {
      team?: { id?: string; abbreviation?: string };
      statistics?: {
        name?: string;
        stats?: {
          name?: string;
          abbreviation?: string;
          shortDisplayName?: string;
          displayValue?: string;
        }[];
      }[];
    }[];
  };
  injuries?: {
    team?: { abbreviation?: string; id?: string };
    injuries?: {
      status?: string;
      athlete?: {
        displayName?: string;
        shortName?: string;
        position?: { abbreviation?: string };
      };
      type?: { description?: string };
      details?: { returnDate?: string };
    }[];
  }[];
};

/**
 * ESPN sometimes stubs a preview with a bare "Team (W-L) vs. Team (W-L)" line —
 * records-only, no actual preview copy. Treat that as hollow/empty.
 */
function isHollowEspnMatchupText(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  return /^[A-Za-z .]+\s*\(\d+-\d+\)\s+vs\.?\s+[A-Za-z .]+\s*\(\d+-\d+\)$/i.test(t);
}

function espnStoryBodyHtml(a: EspnStorySrc | undefined): string {
  const story = a?.story?.trim() || "";
  const desc = (a?.description ?? "").replace(/^—\s*/, "").trim();
  const storyText = stripHtml(story).trim();
  if (story && storyText.length >= 40 && !isHollowEspnMatchupText(storyText)) return story;
  if (desc.length >= 40 && !isHollowEspnMatchupText(desc)) return `<p>${desc}</p>`;
  return "";
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-token match so short abbrevs don't hit substrings (BAL⊂baseball, ATH⊂path). */
function textHasTeamToken(blob: string, token: string): boolean {
  const t = token.toLowerCase().trim();
  if (!t) return false;
  if (t.length <= 3) {
    return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(t)}(?:[^a-z0-9]|$)`, "i").test(blob);
  }
  return blob.includes(t);
}

function espnStoryMentionsMatchup(
  text: string,
  homeAbbrev: string,
  awayAbbrev: string,
  homeName?: string | null,
  awayName?: string | null,
): boolean {
  const blob = text.toLowerCase();
  const hits = (name: string | null | undefined, abbrev: string) => {
    const keys = [...mlbAbbrevAliases(abbrev)];
    if (name) {
      keys.push(name);
      const nick = name.split(/\s+/).slice(-1)[0];
      if (nick && nick.length >= 4) keys.push(nick);
    }
    return keys.some((k) => k && textHasTeamToken(blob, k));
  };
  return hits(homeName ?? null, homeAbbrev) && hits(awayName ?? null, awayAbbrev);
}

function espnStoryMatchupBlob(a: EspnStorySrc | undefined): string {
  if (!a) return "";
  return `${a.headline ?? ""} ${a.description ?? ""} ${a.story ?? ""}`;
}

function recapFromEspnStory(
  eventId: string,
  story: EspnStorySrc,
  kind: "preview" | "recap",
): MlbGameRecap {
  const html = espnStoryBodyHtml(story);
  const storyText = stripHtml(html).trim();
  return {
    espnEventId: eventId,
    headline: story.headline || (kind === "preview" ? "Game preview" : "Game wrap"),
    description: story.description ?? null,
    storyHtml: html,
    storyText,
    url:
      story.links?.web?.href ??
      `https://www.espn.com/mlb/${kind}/_/gameId/${eventId}`,
    image: story.images?.[0]?.url ?? null,
  };
}

/** ESPN game wrap / recap for an MLB game (matched by date + team ids/abbrevs). */
export async function fetchEspnGameRecap(
  officialDate: string | null | undefined,
  homeAbbrev: string,
  awayAbbrev: string,
  opts?: { espnEventId?: string | null },
): Promise<MlbGameRecap | null> {
  if (!officialDate && !opts?.espnEventId) return null;
  try {
    let eventId = opts?.espnEventId?.trim() || null;

    if (!eventId && officialDate) {
      const ymd = officialDate.replace(/-/g, "");
      const board = await fetchEspnSiteJson<{
        events?: {
          id?: string;
          competitions?: {
            competitors?: { homeAway?: string; team?: { abbreviation?: string } }[];
          }[];
        }[];
      }>(`baseball/mlb/scoreboard?dates=${ymd}`);
      const homeKeys = mlbAbbrevAliases(homeAbbrev);
      const awayKeys = mlbAbbrevAliases(awayAbbrev);
      const event = (board?.events ?? []).find((e) => {
        const comps = e.competitions?.[0]?.competitors ?? [];
        const h = comps.find((c) => c.homeAway === "home")?.team?.abbreviation?.toUpperCase();
        const a = comps.find((c) => c.homeAway === "away")?.team?.abbreviation?.toUpperCase();
        return Boolean(h && a && homeKeys.has(h) && awayKeys.has(a));
      });
      eventId = event?.id ?? null;
    }
    if (!eventId) return null;

    const sum = await fetchEspnSiteJson<EspnGameSummary>(
      `baseball/mlb/summary?event=${eventId}`,
    );
    if (!sum) return null;

    const comp = sum.header?.competitions?.[0];
    const competitors = comp?.competitors ?? [];
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");
    const homeName = home?.team?.displayName ?? null;
    const awayName = away?.team?.displayName ?? null;
    const state = (comp?.status?.type?.state ?? "").toLowerCase();
    const isPregame = state === "pre" || /scheduled|pregame|warmup/i.test(
      `${comp?.status?.type?.description ?? ""} ${comp?.status?.type?.detail ?? ""}`,
    );

    const usable = (a: EspnStorySrc | undefined, requireMatchup: boolean, minLen: number) => {
      if (!a) return false;
      if (/^media$/i.test(a.type ?? "")) return false;
      if (isEspnGamePromoCopy(a.headline, a.description, a.story)) return false;
      const html = espnStoryBodyHtml(a);
      const text = stripHtml(html).trim();
      // Typed "Preview" articles are held to the same bar as pregame — a short
      // stub isn't a real preview even if the caller passed a lower minLen.
      const effectiveMinLen = /^preview$/i.test(a.type ?? "") ? Math.max(minLen, 80) : minLen;
      if (text.length < effectiveMinLen) return false;
      // Always require this game's teams — ESPN's official article slot and the
      // news rail both reuse other clubs' wraps (Jo Adell / Guardians on LAD-COL).
      const matchupText = `${espnStoryMatchupBlob(a)} ${text}`;
      if (
        requireMatchup &&
        !espnStoryMentionsMatchup(matchupText, homeAbbrev, awayAbbrev, homeName, awayName)
      ) {
        return false;
      }
      return true;
    };

    // Official recap/preview only when it is actually about this matchup.
    // Pregame stubs are often just a bare matchup line, so require a real preview (>=80 chars).
    if (usable(sum.article, true, isPregame ? 80 : 40)) {
      return recapFromEspnStory(eventId, sum.article!, isPregame ? "preview" : "recap");
    }

    // Pregame news rails are league features / fantasy blurbs — never promote them
    // as this game's preview (BAL⊂baseball / ATH⊂path false positives used to leak).
    if (isPregame) return null;

    for (const a of sum.news?.articles ?? []) {
      if (usable(a, true, 80)) {
        return recapFromEspnStory(eventId, a, "recap");
      }
    }

    // Pregame without a written ESPN article: no preview card (probables/leaders still show).
    return null;
  } catch {
    return null;
  }
}

export type MlbEspnLastFiveGame = {
  result: string;
  atVs: string;
  opponent: string;
  /** MLB Stats API team id for the opponent (logo + link). */
  opponentTeamId: number | null;
  score: string;
  date: string;
  espnEventId: string | null;
  /** Resolved MLB gamePk when schedule lookup succeeds. */
  gamePk: number | null;
};

export type MlbEspnSeasonSeriesGame = {
  date: string;
  label: string;
  score: string;
  awayAbbrev: string;
  homeAbbrev: string;
  awayTeamId: number | null;
  homeTeamId: number | null;
  espnEventId: string | null;
  gamePk: number | null;
};

export type MlbEspnInjuryRow = {
  name: string;
  pos: string;
  status: string;
  returnDate: string | null;
};

export type MlbEspnTeamStatLine = {
  abbrev: string;
  teamId: number | null;
  avg: string;
  runs: string;
  hits: string;
  hr: string;
  obp: string;
  slg: string;
  era: string;
  whip: string;
  bb: string;
  k: string;
  oba: string;
  day: string;
};

export type MlbEspnGameExtras = {
  espnEventId: string;
  awayAbbrev: string | null;
  homeAbbrev: string | null;
  awayTeamId: number | null;
  homeTeamId: number | null;
  predictor: { awayPct: number; homePct: number } | null;
  lastFive: { abbrev: string; teamId: number | null; espnTeamId: string; games: MlbEspnLastFiveGame[] }[];
  seasonSeries: { summary: string; games: MlbEspnSeasonSeriesGame[] } | null;
  teamStats: MlbEspnTeamStatLine[];
  injuries: { abbrev: string; teamId: number | null; players: MlbEspnInjuryRow[] }[];
};

function espnStatValue(
  groups: NonNullable<NonNullable<EspnGameSummary["boxscore"]>["teams"]>[number]["statistics"],
  groupName: string,
  statName: string,
): string {
  const group = (groups ?? []).find((g) => (g.name ?? "").toLowerCase() === groupName.toLowerCase());
  const hit = (group?.stats ?? []).find((s) => s.name === statName);
  return hit?.displayValue?.trim() || "—";
}

function parseEspnGameExtrasFromSummary(
  sum: EspnGameSummary,
  eventId: string,
): MlbEspnGameExtras {
  const comp = sum.header?.competitions?.[0];
  const competitors = comp?.competitors ?? [];
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  const awayAbbrev = away?.team?.abbreviation?.toUpperCase() || null;
  const homeAbbrev = home?.team?.abbreviation?.toUpperCase() || null;
  const awayTeamId = mlbTeamIdFromEspnAbbrev(awayAbbrev);
  const homeTeamId = mlbTeamIdFromEspnAbbrev(homeAbbrev);

  const awayPct = Number(sum.predictor?.awayTeam?.gameProjection);
  const homePct = Number(sum.predictor?.homeTeam?.gameProjection);
  const predictor =
    Number.isFinite(awayPct) && Number.isFinite(homePct)
      ? { awayPct, homePct }
      : null;

  const lastFive = (sum.lastFiveGames ?? []).map((block) => {
    const abbrev = block.team?.abbreviation?.toUpperCase() || "—";
    return {
      abbrev,
      teamId: mlbTeamIdFromEspnAbbrev(abbrev),
      espnTeamId: String(block.team?.id ?? ""),
      games: (block.events ?? []).slice(0, 5).map((ev) => {
        const opponent = ev.opponent?.abbreviation?.toUpperCase() || "—";
        const espnEventId =
          ev.id?.trim() ||
          (ev.links ?? [])
            .map((l) => parseEspnGameIdFromUrl(l.href ?? ""))
            .find(Boolean) ||
          null;
        return {
          result: (ev.gameResult || "").toUpperCase(),
          atVs: ev.atVs === "@" ? "@" : "vs",
          opponent,
          opponentTeamId: mlbTeamIdFromEspnAbbrev(opponent),
          score: ev.score || "—",
          date: ev.gameDate ? formatSportsDateLong(ev.gameDate) || ev.gameDate.slice(0, 10) : "",
          espnEventId,
          gamePk: null as number | null,
        };
      }),
    };
  });

  const seriesBlock =
    (sum.seasonseries ?? []).find(
      (s) => s.summary && /season/i.test(s.type ?? "") && !/preseason/i.test(s.type ?? ""),
    ) ??
    (sum.seasonseries ?? []).find((s) => s.summary && !/preseason/i.test(s.type ?? "")) ??
    null;
  const seasonSeries = seriesBlock?.summary
    ? {
        summary: seriesBlock.summary,
        games: (seriesBlock.events ?? [])
          .filter((ev) => (ev.statusType?.state ?? ev.status) === "post" || ev.status === "post")
          .slice(-8)
          .reverse()
          .map((ev) => {
            const h = (ev.competitors ?? []).find((c) => c.homeAway === "home");
            const a = (ev.competitors ?? []).find((c) => c.homeAway === "away");
            const ha = (a?.team?.abbreviation || "?").toUpperCase();
            const hh = (h?.team?.abbreviation || "?").toUpperCase();
            const as = a?.score != null ? String(a.score) : "—";
            const hs = h?.score != null ? String(h.score) : "—";
            const espnEventId =
              ev.id?.trim() ||
              (ev.links ?? [])
                .map((l) => parseEspnGameIdFromUrl(l.href ?? ""))
                .find(Boolean) ||
              null;
            return {
              date: ev.date ? formatSportsDateLong(ev.date) || ev.date.slice(0, 10) : "",
              label: `${ha} @ ${hh}`,
              score: `${as}–${hs}`,
              awayAbbrev: ha,
              homeAbbrev: hh,
              awayTeamId: mlbTeamIdFromEspnAbbrev(ha),
              homeTeamId: mlbTeamIdFromEspnAbbrev(hh),
              espnEventId,
              gamePk: null as number | null,
            };
          }),
      }
    : null;

  const teamOrder = [awayAbbrev, homeAbbrev].filter(Boolean) as string[];
  const teamStats: MlbEspnTeamStatLine[] = [];
  for (const side of sum.boxscore?.teams ?? []) {
    const abbrev = side.team?.abbreviation?.toUpperCase() || "—";
    const stats = side.statistics;
    teamStats.push({
      abbrev,
      teamId: mlbTeamIdFromEspnAbbrev(abbrev),
      avg: espnStatValue(stats, "batting", "avg"),
      runs: espnStatValue(stats, "batting", "runs"),
      hits: espnStatValue(stats, "batting", "hits"),
      hr: espnStatValue(stats, "batting", "homeRuns"),
      obp: espnStatValue(stats, "batting", "onBasePct"),
      slg: espnStatValue(stats, "batting", "slugAvg"),
      era: espnStatValue(stats, "pitching", "ERA"),
      whip: espnStatValue(stats, "pitching", "WHIP"),
      bb: espnStatValue(stats, "pitching", "walks"),
      k: espnStatValue(stats, "pitching", "strikeouts"),
      oba: espnStatValue(stats, "pitching", "opponentAvg"),
      day: espnStatValue(stats, "records", "Day"),
    });
  }
  teamStats.sort((a, b) => {
    const ai = teamOrder.indexOf(a.abbrev);
    const bi = teamOrder.indexOf(b.abbrev);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });

  const injuries = (sum.injuries ?? []).map((block) => {
    const abbrev = block.team?.abbreviation?.toUpperCase() || "—";
    return {
      abbrev,
      teamId: mlbTeamIdFromEspnAbbrev(abbrev),
      players: (block.injuries ?? []).slice(0, 8).map((row) => ({
        name: row.athlete?.displayName || row.athlete?.shortName || "—",
        pos: row.athlete?.position?.abbreviation || "—",
        status: row.type?.description || row.status || "IL",
        returnDate: row.details?.returnDate
          ? formatSportsDateLong(row.details.returnDate) || row.details.returnDate.slice(0, 10)
          : null,
      })),
    };
  });

  return {
    espnEventId: eventId,
    awayAbbrev,
    homeAbbrev,
    awayTeamId,
    homeTeamId,
    predictor,
    lastFive,
    seasonSeries,
    teamStats,
    injuries,
  };
}

/** Chicago calendar date (YYYY-MM-DD) from an ISO / ESPN timestamp. */
function espnDateToCentralYmd(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      const m = iso.match(/^(\d{4}-\d{2}-\d{2})/);
      return m?.[1] ?? null;
    }
    const ymd = d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
    return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
  } catch {
    return null;
  }
}

type ScheduleGameRow = {
  gamePk?: number;
  teams?: {
    away?: { team?: { id?: number; abbreviation?: string } };
    home?: { team?: { id?: number; abbreviation?: string } };
  };
};

async function fetchMlbScheduleGamesForDate(ymd: string): Promise<ScheduleGameRow[]> {
  try {
    const schedule = (await mlbGet("schedule", {
      sportId: "1",
      date: ymd,
      hydrate: "team",
    })) as { dates?: { games?: ScheduleGameRow[] }[] };
    return schedule.dates?.[0]?.games ?? [];
  } catch {
    return [];
  }
}

function matchScheduleGamePk(
  games: ScheduleGameRow[],
  homeAbbrev: string,
  awayAbbrev: string,
): number | null {
  const homeKeys = mlbAbbrevAliases(homeAbbrev);
  const awayKeys = mlbAbbrevAliases(awayAbbrev);
  const homeId = mlbTeamIdFromEspnAbbrev(homeAbbrev);
  const awayId = mlbTeamIdFromEspnAbbrev(awayAbbrev);
  for (const g of games) {
    const hAbb = (g.teams?.home?.team?.abbreviation ?? "").toUpperCase();
    const aAbb = (g.teams?.away?.team?.abbreviation ?? "").toUpperCase();
    const hId = g.teams?.home?.team?.id;
    const aId = g.teams?.away?.team?.id;
    const abbrevMatch = homeKeys.has(hAbb) && awayKeys.has(aAbb);
    const idMatch =
      homeId != null && awayId != null && hId === homeId && aId === awayId;
    if ((abbrevMatch || idMatch) && g.gamePk != null) return g.gamePk;
  }
  return null;
}

/** Attach MLB `gamePk`s to last-five / series rows via schedule lookup (one fetch per date). */
async function hydrateEspnExtrasGamePks(
  extras: MlbEspnGameExtras,
  sum: EspnGameSummary,
): Promise<MlbEspnGameExtras> {
  type Need = {
    ymd: string;
    homeAbbrev: string;
    awayAbbrev: string;
    apply: (pk: number) => void;
  };
  const needs: Need[] = [];

  const seriesRaw = (sum.seasonseries ?? []).find(
    (s) => s.summary && /season/i.test(s.type ?? "") && !/preseason/i.test(s.type ?? ""),
  ) ??
    (sum.seasonseries ?? []).find((s) => s.summary && !/preseason/i.test(s.type ?? "")) ??
    null;
  const seriesIsoByEvent = new Map<string, string>();
  for (const ev of seriesRaw?.events ?? []) {
    if (ev.id && ev.date) seriesIsoByEvent.set(ev.id, ev.date);
  }

  if (extras.seasonSeries) {
    for (const g of extras.seasonSeries.games) {
      const iso = g.espnEventId ? seriesIsoByEvent.get(g.espnEventId) : null;
      const ymd = espnDateToCentralYmd(iso) || (g.date.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null);
      if (!ymd || !g.homeAbbrev || !g.awayAbbrev) continue;
      needs.push({
        ymd,
        homeAbbrev: g.homeAbbrev,
        awayAbbrev: g.awayAbbrev,
        apply: (pk) => {
          g.gamePk = pk;
        },
      });
    }
  }

  const lastFiveIso = new Map<string, string>();
  for (const block of sum.lastFiveGames ?? []) {
    for (const ev of block.events ?? []) {
      if (ev.id && ev.gameDate) lastFiveIso.set(ev.id, ev.gameDate);
    }
  }

  for (const block of extras.lastFive) {
    for (const g of block.games) {
      const iso = g.espnEventId ? lastFiveIso.get(g.espnEventId) : null;
      const ymd =
        espnDateToCentralYmd(iso) ||
        (g.date.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null);
      if (!ymd || !block.abbrev || !g.opponent) continue;
      const homeAbbrev = g.atVs === "@" ? g.opponent : block.abbrev;
      const awayAbbrev = g.atVs === "@" ? block.abbrev : g.opponent;
      needs.push({
        ymd,
        homeAbbrev,
        awayAbbrev,
        apply: (pk) => {
          g.gamePk = pk;
        },
      });
    }
  }

  const byDate = new Map<string, Need[]>();
  for (const n of needs) {
    const list = byDate.get(n.ymd) ?? [];
    list.push(n);
    byDate.set(n.ymd, list);
  }

  await Promise.all(
    [...byDate.entries()].map(async ([ymd, list]) => {
      const games = await fetchMlbScheduleGamesForDate(ymd);
      for (const n of list) {
        const pk = matchScheduleGamePk(games, n.homeAbbrev, n.awayAbbrev);
        if (pk != null) n.apply(pk);
      }
    }),
  );

  return extras;
}

/** ESPN matchup predictor, last 5, team stats, season series, injuries for a game page. */
export async function fetchEspnGameExtras(
  officialDate: string | null | undefined,
  homeAbbrev: string,
  awayAbbrev: string,
  opts?: { espnEventId?: string | null },
): Promise<MlbEspnGameExtras | null> {
  if (!officialDate && !opts?.espnEventId) return null;
  try {
    let eventId = opts?.espnEventId?.trim() || null;
    if (!eventId && officialDate) {
      const ymd = officialDate.replace(/-/g, "");
      const board = await fetchEspnSiteJson<{
        events?: {
          id?: string;
          competitions?: {
            competitors?: { homeAway?: string; team?: { abbreviation?: string } }[];
          }[];
        }[];
      }>(`baseball/mlb/scoreboard?dates=${ymd}`);
      const homeKeys = mlbAbbrevAliases(homeAbbrev);
      const awayKeys = mlbAbbrevAliases(awayAbbrev);
      const event = (board?.events ?? []).find((e) => {
        const comps = e.competitions?.[0]?.competitors ?? [];
        const h = comps.find((c) => c.homeAway === "home")?.team?.abbreviation?.toUpperCase();
        const a = comps.find((c) => c.homeAway === "away")?.team?.abbreviation?.toUpperCase();
        return Boolean(h && a && homeKeys.has(h) && awayKeys.has(a));
      });
      eventId = event?.id ?? null;
    }
    if (!eventId) return null;

    const sum = await fetchEspnSiteJson<EspnGameSummary>(
      `baseball/mlb/summary?event=${eventId}`,
    );
    if (!sum) return null;
    const extras = await hydrateEspnExtrasGamePks(
      parseEspnGameExtrasFromSummary(sum, eventId),
      sum,
    );
    const hasBits =
      extras.predictor ||
      extras.lastFive.some((b) => b.games.length > 0) ||
      extras.seasonSeries ||
      extras.teamStats.length > 0 ||
      extras.injuries.some((b) => b.players.length > 0);
    return hasBits ? extras : null;
  } catch {
    return null;
  }
}

export function formatGameDuration(minutes: number | null | undefined): string | null {
  if (minutes == null || !Number.isFinite(minutes)) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}` : `${m} min`;
}

function fmtWhen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Chicago",
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

function teamAbbrev(team: { abbreviation?: string; teamName?: string; name?: string } | undefined): string {
  return team?.abbreviation || team?.teamName || team?.name || "—";
}

type LinescorePerson = { id?: number; fullName?: string };
type LinescoreOffense = {
  batter?: LinescorePerson;
  pitcher?: LinescorePerson;
  first?: LinescorePerson | null;
  second?: LinescorePerson | null;
  third?: LinescorePerson | null;
};
type LinescoreDefense = {
  pitcher?: LinescorePerson;
  batter?: LinescorePerson;
};

function pitchCallKind(ev: LiveFeedPitchEvent): MlbPitchPlot["call"] {
  const code = (ev.details?.call?.code ?? "").toUpperCase();
  if (code === "B" || ev.details?.isBall) return "B";
  if (code === "X" || ev.details?.isInPlay) return "X";
  if (
    code === "S" ||
    code === "C" ||
    code === "F" ||
    code === "T" ||
    code === "W" ||
    code === "M" ||
    ev.details?.isStrike
  ) {
    return "S";
  }
  return "O";
}

function mapCurrentPitches(play: LiveFeedCurrentPlay | null | undefined): MlbPitchPlot[] {
  const out: MlbPitchPlot[] = [];
  for (const ev of play?.playEvents ?? []) {
    if (!ev?.isPitch) continue;
    const coords = ev.pitchData?.coordinates;
    const pX = coords?.pX;
    const pZ = coords?.pZ;
    if (pX == null || pZ == null || !Number.isFinite(pX) || !Number.isFinite(pZ)) continue;
    out.push({
      number: Number(ev.pitchNumber ?? out.length + 1),
      pX,
      pZ,
      call: pitchCallKind(ev),
      callLabel: ev.details?.call?.description || ev.details?.description || "Pitch",
      pitchType: ev.details?.type?.description ?? ev.details?.type?.code ?? null,
      speed: ev.pitchData?.startSpeed ?? null,
      zoneTop: ev.pitchData?.strikeZoneTop ?? 3.5,
      zoneBottom: ev.pitchData?.strikeZoneBottom ?? 1.5,
    });
  }
  return out;
}

function lookupBoxPlayer(
  awayRaw: BoxTeamRaw | undefined,
  homeRaw: BoxTeamRaw | undefined,
  playerId: number,
): { player: BoxPlayerRaw; abbrev: string } | null {
  const key = `ID${playerId}`;
  const awayP = awayRaw?.players?.[key];
  if (awayP) {
    return {
      player: awayP,
      abbrev: awayRaw?.team?.abbreviation ?? teamAbbrev(awayRaw?.team),
    };
  }
  const homeP = homeRaw?.players?.[key];
  if (homeP) {
    return {
      player: homeP,
      abbrev: homeRaw?.team?.abbreviation ?? teamAbbrev(homeRaw?.team),
    };
  }
  return null;
}

function buildLivePlayerCard(
  id: number,
  name: string,
  role: "batter" | "pitcher",
  handCode: string | null | undefined,
  awayRaw: BoxTeamRaw | undefined,
  homeRaw: BoxTeamRaw | undefined,
): MlbLivePlayerCard {
  const hit = lookupBoxPlayer(awayRaw, homeRaw, id);
  const seasonBat = hit?.player.seasonStats?.batting ?? {};
  const seasonPit = hit?.player.seasonStats?.pitching ?? {};
  const hand =
    role === "pitcher"
      ? handCode
        ? `${handCode.toUpperCase()}HP`
        : null
      : handCode
        ? handCode.toUpperCase()
        : null;
  return {
    id,
    name,
    shortName: shortPlayerName(name),
    number: hit?.player.jerseyNumber ? String(hit.player.jerseyNumber) : null,
    position:
      role === "pitcher"
        ? "P"
        : hit?.player.position?.abbreviation || null,
    hand,
    teamAbbrev: hit?.abbrev ?? null,
    wins: role === "pitcher" ? numStat(seasonPit, "wins") : null,
    losses: role === "pitcher" ? numStat(seasonPit, "losses") : null,
    era: role === "pitcher" ? strStat(seasonPit, "era") || null : null,
    avg: role === "batter" ? strStat(seasonBat, "avg") || null : null,
    hr: role === "batter" ? numStat(seasonBat, "homeRuns") : null,
    rbi: role === "batter" ? numStat(seasonBat, "rbi") : null,
  };
}

function mapLiveSituation(
  ls:
    | {
        balls?: number;
        strikes?: number;
        outs?: number;
        offense?: LinescoreOffense;
        defense?: LinescoreDefense;
      }
    | null
    | undefined,
  live: boolean,
  extras?: {
    currentPlay?: LiveFeedCurrentPlay | null;
    awayRaw?: BoxTeamRaw;
    homeRaw?: BoxTeamRaw;
  },
): MlbLiveSituation | null {
  if (!live || !ls) return null;
  const matchup = extras?.currentPlay?.matchup;
  const batter = ls.offense?.batter ?? matchup?.batter;
  const pitcher = ls.defense?.pitcher ?? ls.offense?.pitcher ?? matchup?.pitcher;
  const batterId = batter?.id;
  const pitcherId = pitcher?.id;
  const batterName = batter?.fullName ?? "Batter";
  const pitcherName = pitcher?.fullName ?? "Pitcher";
  return {
    balls: Number(ls.balls ?? 0),
    strikes: Number(ls.strikes ?? 0),
    outs: Number(ls.outs ?? 0),
    batter:
      batterId != null
        ? { id: batterId, name: batterName }
        : null,
    pitcher:
      pitcherId != null
        ? { id: pitcherId, name: pitcherName }
        : null,
    onFirst: Boolean(ls.offense?.first?.id),
    onSecond: Boolean(ls.offense?.second?.id),
    onThird: Boolean(ls.offense?.third?.id),
    pitches: mapCurrentPitches(extras?.currentPlay),
    batterCard:
      batterId != null
        ? buildLivePlayerCard(
            batterId,
            batterName,
            "batter",
            matchup?.batSide?.code,
            extras?.awayRaw,
            extras?.homeRaw,
          )
        : null,
    pitcherCard:
      pitcherId != null
        ? buildLivePlayerCard(
            pitcherId,
            pitcherName,
            "pitcher",
            matchup?.pitchHand?.code,
            extras?.awayRaw,
            extras?.homeRaw,
          )
        : null,
  };
}

/** Career H-AB / AVG for batter vs this pitcher, plus season AVG vs LHP/RHP. */
export async function fetchMlbLiveMatchupExtras(
  batterId: number,
  pitcherId: number,
  pitchHand: string | null | undefined,
): Promise<{
  vsPitcher: { hits: number; atBats: number; avg: string } | null;
  vsHandAvg: string | null;
  vsHandLabel: string | null;
}> {
  const handCode = (pitchHand || "").replace(/HP$/i, "").charAt(0).toUpperCase();
  const sitCode = handCode === "L" ? "vl" : handCode === "R" ? "vr" : null;

  const [vsRaw, splits] = await Promise.all([
    mlbGet(`people/${batterId}/stats`, {
      stats: "vsPlayerTotal",
      group: "hitting",
      opposingPlayerId: String(pitcherId),
    }).catch(() => null) as Promise<{
      stats?: { splits?: { stat?: Record<string, unknown> }[] }[];
    } | null>,
    sitCode
      ? fetchMlbPlayerSplits(batterId, "hitting").catch(() => [] as MlbSplitRow[])
      : Promise.resolve([] as MlbSplitRow[]),
  ]);

  const vsStat = vsRaw?.stats?.[0]?.splits?.[0]?.stat;
  const vsPitcher =
    vsStat && (numStat(vsStat, "atBats") > 0 || numStat(vsStat, "plateAppearances") > 0)
      ? {
          hits: numStat(vsStat, "hits"),
          atBats: numStat(vsStat, "atBats"),
          avg: strStat(vsStat, "avg", ".000"),
        }
      : null;

  const split = sitCode ? splits.find((s) => s.code === sitCode) : null;
  const vsHandAvg = split?.stats.find((s) => s.label === "AVG")?.value ?? null;

  return {
    vsPitcher,
    vsHandAvg,
    vsHandLabel: handCode === "L" ? "vs LHP" : handCode === "R" ? "vs RHP" : null,
  };
}

export async function fetchMlbScoreboard(date = chicagoToday()): Promise<MlbScoreGame[]> {
  const raw = (await mlbGet("schedule", {
    sportId: "1",
    date,
    hydrate: "linescore,team,probablePitcher,venue,broadcasts(all)",
  })) as {
    dates?: {
      date?: string;
      games?: {
        gamePk?: number;
        gameDate?: string;
        officialDate?: string;
        status?: { detailedState?: string; abstractGameState?: string };
        venue?: { name?: string };
        broadcasts?: {
          type?: string;
          name?: string;
          callSign?: string;
          language?: string;
          isNational?: boolean;
          homeAway?: string;
        }[];
        linescore?: {
          currentInningOrdinal?: string;
          inningState?: string;
          balls?: number;
          strikes?: number;
          outs?: number;
          offense?: LinescoreOffense;
          defense?: LinescoreDefense;
          teams?: {
            away?: { runs?: number; hits?: number; errors?: number };
            home?: { runs?: number; hits?: number; errors?: number };
          };
        };
        teams?: {
          away?: {
            score?: number;
            team?: { id?: number; name?: string; abbreviation?: string; teamName?: string };
            leagueRecord?: { wins?: number; losses?: number };
            probablePitcher?: { id?: number; fullName?: string };
          };
          home?: {
            score?: number;
            team?: { id?: number; name?: string; abbreviation?: string; teamName?: string };
            leagueRecord?: { wins?: number; losses?: number };
            probablePitcher?: { id?: number; fullName?: string };
          };
        };
      }[];
    }[];
  };

  const games = raw.dates?.[0]?.games ?? [];
  const mapped = games.map((g) => {
    const abstract = g.status?.abstractGameState ?? "";
    const live = abstract === "Live";
    const final = abstract === "Final";
    const inn =
      live && g.linescore
        ? `${g.linescore.inningState ?? ""} ${g.linescore.currentInningOrdinal ?? ""}`.trim()
        : null;
    const side = (
      s: NonNullable<typeof g.teams>["away"],
      rh: { runs?: number; hits?: number; errors?: number } | undefined,
    ): MlbScoreSide => {
      const teamId = s?.team?.id ?? 0;
      return {
        teamId,
        name: s?.team?.name ?? "—",
        abbrev: teamAbbrev(s?.team),
        score: rh?.runs ?? s?.score ?? null,
        hits: rh?.hits ?? null,
        errors: rh?.errors ?? null,
        record:
          s?.leagueRecord?.wins != null
            ? `${s.leagueRecord.wins}-${s.leagueRecord.losses ?? 0}`
            : null,
        probablePitcher: s?.probablePitcher?.fullName ?? null,
        probablePitcherId: s?.probablePitcher?.id ?? null,
        primaryColor: TEAM_COLORS[teamId] ?? "d9515c",
      };
    };
    const away = side(g.teams?.away, g.linescore?.teams?.away);
    const home = side(g.teams?.home, g.linescore?.teams?.home);
    const mlbTvNames = (g.broadcasts ?? [])
      .filter((b) => /^TV$/i.test(b.type ?? "") && (!b.language || /^en/i.test(b.language)))
      .map((b) => ({
        name: (b.name || b.callSign || "").trim(),
        market: b.isNational ? "national" : b.homeAway === "home" ? "home" : b.homeAway === "away" ? "away" : null,
      }))
      .filter((b) => b.name);
    // Prefer MLB.TV label when streaming is present but only locals listed.
    const hasMlbTv = mlbTvNames.some((b) => /mlb\.?\s*tv/i.test(b.name));
    const named = [
      ...(!hasMlbTv ? [{ market: "national", names: ["MLB.TV"] }] : []),
      ...mlbTvNames.map((b) => ({ market: b.market ?? undefined, names: [b.name] })),
    ];
    return {
      id: String(g.gamePk ?? g.gameDate),
      status: g.status?.detailedState ?? abstract,
      abstractState: abstract,
      live,
      final,
      inning: inn,
      away,
      home,
      when: fmtWhen(g.gameDate),
      whenShort: fmtWhenShort(g.gameDate),
      venue: g.venue?.name ?? null,
      officialDate: g.officialDate ?? raw.dates?.[0]?.date ?? null,
      gameDate: g.gameDate ?? null,
      situation: mapLiveSituation(g.linescore, live),
      broadcasts: parseEspnBroadcasts(undefined, named),
    } satisfies MlbScoreGame;
  });

  // Overlay ESPN logos (MLB.TV wordmark, etc.) when available.
  try {
    const ymd = date.replace(/-/g, "");
    const espn = (await fetchEspnSiteJson(`baseball/mlb/scoreboard?dates=${ymd}`)) as {
      events?: {
        shortName?: string;
        competitions?: {
          broadcasts?: { market?: string; names?: string[] }[];
          geoBroadcasts?: {
            market?: { type?: string };
            media?: { shortName?: string; name?: string; logo?: string; darkLogo?: string };
          }[];
          competitors?: { homeAway?: string; team?: { abbreviation?: string } }[];
        }[];
      }[];
    } | null;
    if (!espn) throw new Error("no espn board");
    const espnRows: { away: string; home: string; broadcasts: GameBroadcast[] }[] = [];
    for (const ev of espn.events ?? []) {
      const comp = ev.competitions?.[0];
      if (!comp) continue;
      const home = (comp.competitors ?? []).find((c) => c.homeAway === "home")?.team?.abbreviation;
      const away = (comp.competitors ?? []).find((c) => c.homeAway === "away")?.team?.abbreviation;
      if (!home || !away) continue;
      espnRows.push({
        away,
        home,
        broadcasts: parseEspnBroadcasts(comp.geoBroadcasts, comp.broadcasts),
      });
    }
    for (const g of mapped) {
      const espnBroadcasts = espnRows.find(
        (row) =>
          mlbAbbrevsMatch(row.away, g.away.abbrev) && mlbAbbrevsMatch(row.home, g.home.abbrev),
      )?.broadcasts;
      if (espnBroadcasts?.length) g.broadcasts = espnBroadcasts;
      // Always keep at least MLB.TV so the RUWT chip row is never empty for MLB.
      if (!g.broadcasts.length) {
        g.broadcasts = parseEspnBroadcasts(undefined, [{ market: "national", names: ["MLB.TV"] }]);
      }
    }
  } catch {
    /* keep MLB-derived broadcast names */
  }

  return mapped;
}

function teamInGame(g: MlbScoreGame, teamId: number): boolean {
  return g.away.teamId === teamId || g.home.teamId === teamId;
}

export type MlbGameInterest = {
  score: number;
  reasons: string[];
};

const CARDINALS_TEAM_ID = 138;

/** RUWT-style interest score — higher = more worth turning on. */
export function scoreGameInterest(g: MlbScoreGame): MlbGameInterest {
  const reasons: string[] = [];
  let score = 0;
  const away = g.away.score;
  const home = g.home.score;
  const hasScore = away != null && home != null;
  const diff = hasScore ? Math.abs(away - home) : null;
  const total = hasScore ? away + home : null;

  if (g.live) {
    score += 42;
    reasons.push("Live now");
  } else if (g.final) {
    score += 8;
  } else {
    score += 4;
  }

  if (teamInGame(g, CARDINALS_TEAM_ID)) {
    score += 18;
    reasons.push("Cardinals");
  }

  if (diff != null) {
    if (diff === 0) {
      score += 28;
      reasons.push("Tied");
    } else if (diff === 1) {
      score += 24;
      reasons.push("One-run game");
    } else if (diff === 2) {
      score += 14;
      reasons.push("Within two");
    } else if (diff <= 3) {
      score += 8;
      reasons.push("Tight");
    } else if (diff >= 7) {
      score -= 16;
      reasons.push("Blowout");
    } else if (diff >= 5) {
      score -= 8;
    }
  }

  const inn = (g.inning ?? "").toLowerCase();
  if (/extra|10th|11th|12th|13th|14th|15th/.test(inn)) {
    score += 32;
    reasons.push("Extras");
  } else if (/\b(7th|8th|9th)\b/.test(inn) || /mid\s*7|top\s*7|bot\s*7|end\s*7|mid\s*8|top\s*8|bot\s*8|end\s*8|mid\s*9|top\s*9|bot\s*9|end\s*9/.test(inn)) {
    score += 18;
    reasons.push("Late innings");
  }

  if (total != null && total >= 12) {
    score += 12;
    reasons.push("Slugfest");
  } else if (total != null && total >= 9) {
    score += 6;
    reasons.push("High scoring");
  }

  const parseRecord = (r: string | null): number | null => {
    if (!r) return null;
    const m = r.match(/^(\d+)-(\d+)/);
    if (!m) return null;
    const w = Number(m[1]);
    const l = Number(m[2]);
    if (!Number.isFinite(w) || !Number.isFinite(l) || w + l === 0) return null;
    return w / (w + l);
  };
  const aw = parseRecord(g.away.record);
  const hw = parseRecord(g.home.record);
  if (aw != null && hw != null && aw >= 0.55 && hw >= 0.55) {
    score += 10;
    reasons.push("Contenders");
  }

  if (g.final && diff === 1) {
    score += 10;
    if (!reasons.includes("One-run game")) reasons.push("One-run final");
  }

  return { score: Math.max(0, score), reasons: reasons.slice(0, 4) };
}

export type MlbScoredGame = MlbScoreGame & MlbGameInterest;

/** Rank slate by interest — live close games float to the top. */
export function rankBestGames(games: MlbScoreGame[], limit = 10): MlbScoredGame[] {
  return [...games]
    .map((g) => {
      const { score, reasons } = scoreGameInterest(g);
      return { ...g, score, reasons };
    })
    .sort((a, b) => b.score - a.score || Number(b.id) - Number(a.id))
    .slice(0, limit);
}

/** Live first by interest, else today's unfinished, else latest final. */
export function pickHeroGame(games: MlbScoreGame[]): MlbScoreGame | null {
  if (!games.length) return null;
  const live = games.filter((g) => g.live);
  if (live.length) return rankBestGames(live, 1)[0] ?? live[0];
  return (
    games.find((g) => !g.final && g.abstractState !== "Final") ??
    [...games].reverse().find((g) => g.final) ??
    games[0]
  );
}

/**
 * Featured team game:
 * - live always wins
 * - after a final, keep showing that final until 10:00 AM America/Chicago
 *   the next morning (including late evening the same night)
 * - then flip to the next scheduled/pregame matchup
 */
export async function fetchTeamCurrentGame(teamId: number): Promise<MlbScoreGame | null> {
  const date = chicagoToday();
  const hour = chicagoHour();
  const season = currentSeason();

  const boardToday = await fetchMlbScoreboard(date);
  const today = boardToday.filter((g) => teamInGame(g, teamId));
  const live = today.find((g) => g.live);
  if (live) return live;

  // Before 10am Central, hold yesterday's result — don't jump to tonight's
  // scheduled game just because the calendar day rolled over.
  if (hour < 10) {
    const yday = addDaysIso(date, -1);
    const boardY = await fetchMlbScoreboard(yday);
    const yFinal = [...boardY]
      .reverse()
      .find((g) => teamInGame(g, teamId) && g.final);
    if (yFinal) return yFinal;
  }

  // Same-day unfinished (scheduled / warmup / delayed) — e.g. DH game 2.
  const preview = today.find((g) => !g.final);
  if (preview) return preview;

  // Tonight's final stays featured until the morning cutoff above.
  const todayFinal = [...today].reverse().find((g) => g.final);
  if (todayFinal) return todayFinal;

  const upcoming = (await mlbGet("schedule", {
    sportId: "1",
    teamId: String(teamId),
    startDate: date,
    endDate: `${season}-11-15`,
    hydrate: "linescore,team,probablePitcher,venue",
  })) as { dates?: { date?: string; games?: { gamePk?: number }[] }[] };

  for (const day of upcoming.dates ?? []) {
    const pk = day.games?.[0]?.gamePk;
    if (!pk || !day.date) continue;
    // Skip today's already-finished slate when looking for the next pregame.
    if (day.date === date && today.every((g) => g.final)) continue;
    const dayBoard = await fetchMlbScoreboard(day.date);
    const hit = dayBoard.find((g) => g.id === String(pk) && !g.final);
    if (hit) return hit;
  }

  const past = (await mlbGet("schedule", {
    sportId: "1",
    teamId: String(teamId),
    startDate: `${season}-03-01`,
    endDate: date,
    hydrate: "linescore,team,probablePitcher,venue",
  })) as {
    dates?: {
      date?: string;
      games?: { gamePk?: number; status?: { abstractGameState?: string } }[];
    }[];
  };

  for (const day of [...(past.dates ?? [])].reverse()) {
    const g = [...(day.games ?? [])]
      .reverse()
      .find((x) => x.status?.abstractGameState === "Final" && x.gamePk);
    if (!g?.gamePk || !day.date) continue;
    const dayBoard = await fetchMlbScoreboard(day.date);
    const hit = dayBoard.find((x) => x.id === String(g.gamePk));
    if (hit) return hit;
  }
  return null;
}

function pickPlayback(
  playbacks: { name?: string; url?: string }[] | undefined,
): string | null {
  if (!playbacks?.length) return null;
  const prefer = ["mp4Avc", "highBit", "HTTP_CLOUD_WIRED_60", "HTTP_CLOUD_WIRED"];
  for (const name of prefer) {
    const hit = playbacks.find((p) => p.name === name && p.url);
    if (hit?.url) return hit.url;
  }
  return playbacks.find((p) => p.url && /\.mp4/i.test(p.url))?.url ?? null;
}

function highlightThumb(image: {
  templateUrl?: string;
  cuts?: { src?: string; width?: number }[];
} | undefined): string | null {
  if (!image) return null;
  const cut =
    image.cuts?.find((c) => (c.width ?? 0) >= 640) ??
    image.cuts?.[0];
  if (cut?.src) return cut.src;
  if (image.templateUrl) {
    return image.templateUrl.replace(
      "{formatInstructions}",
      "w_640,h_360,c_fill,g_auto,q_auto:best,f_jpg",
    );
  }
  return null;
}

export async function fetchMlbGameHighlights(gamePk: number | string): Promise<MlbHighlight[]> {
  const raw = (await mlbGet(`game/${gamePk}/content`)) as {
    highlights?: {
      highlights?: {
        items?: {
          type?: string;
          title?: string;
          headline?: string;
          description?: string;
          duration?: string;
          date?: string;
          playbacks?: { name?: string; url?: string }[];
          image?: { templateUrl?: string; cuts?: { src?: string; width?: number }[] };
          slug?: string;
          id?: string;
        }[];
      };
    };
  };
  const items = raw.highlights?.highlights?.items ?? [];
  const out: MlbHighlight[] = [];
  for (const v of items) {
    if (v.type !== "video") continue;
    const title = v.title || v.headline || "Highlight";
    // Skip ABS / automated ball-strike system clips.
    if (/\babs\b/i.test(title)) continue;
    const url = pickPlayback(v.playbacks);
    if (!url) continue;
    out.push({
      id: String(v.id ?? v.slug ?? v.title),
      title,
      description: v.description ?? null,
      duration: v.duration ?? null,
      thumb: highlightThumb(v.image),
      url,
      date: v.date ?? null,
    });
  }
  return out;
}

export async function fetchMlbPlayerHighlights(
  playerId: number,
  teamId: number | null,
  playerName: string,
): Promise<MlbHighlight[]> {
  if (!teamId) return [];
  const season = currentSeason();
  const end = chicagoToday();
  const start = `${season}-03-01`;
  const raw = (await mlbGet("schedule", {
    sportId: "1",
    teamId: String(teamId),
    startDate: start,
    endDate: end,
    hydrate: "game(content(highlights(highlights)))",
  })) as {
    dates?: {
      games?: {
        gamePk?: number;
        content?: {
          highlights?: {
            highlights?: {
              items?: {
                type?: string;
                title?: string;
                headline?: string;
                description?: string;
                duration?: string;
                date?: string;
                playbacks?: { name?: string; url?: string }[];
                image?: { templateUrl?: string; cuts?: { src?: string; width?: number }[] };
                slug?: string;
                id?: string;
                keywordsAll?: { value?: string; displayName?: string }[];
              }[];
            };
          };
        };
      }[];
    }[];
  };

  const needle = new RegExp(
    `${playerId}|${playerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
    "i",
  );
  const out: MlbHighlight[] = [];
  const seen = new Set<string>();
  for (const day of [...(raw.dates ?? [])].reverse()) {
    for (const g of [...(day.games ?? [])].reverse()) {
      for (const v of g.content?.highlights?.highlights?.items ?? []) {
        if (v.type !== "video") continue;
        const title = v.title || v.headline || "Highlight";
        if (/\babs\b/i.test(title)) continue;
        const blob = [
          title,
          v.headline,
          v.description,
          ...(v.keywordsAll ?? []).map((k) => `${k.value ?? ""} ${k.displayName ?? ""}`),
        ].join(" ");
        if (!needle.test(blob)) continue;
        const url = pickPlayback(v.playbacks);
        if (!url) continue;
        const id = String(v.id ?? v.slug ?? v.title);
        if (seen.has(id)) continue;
        seen.add(id);
        out.push({
          id,
          title,
          description: v.description ?? null,
          duration: v.duration ?? null,
          thumb: highlightThumb(v.image),
          url,
          date: v.date ?? null,
        });
        if (out.length >= 12) return out;
      }
    }
  }
  return out;
}

/** Prefix match — "Signed as Free Agent" ok; "Assigned" must NOT match "Signed". */
const ACQUISITION_TYPE =
  /^(Drafted|Trade|Traded|Signed|Claimed|Selected|Purchase|Purchased|Free Agent|Declared Free Agency|Rule 5|Waivers)/i;

function txPriority(type: string): number {
  if (/^trade/i.test(type)) return 0;
  if (/^draft/i.test(type)) return 1;
  if (/^sign/i.test(type)) return 2;
  if (/^selected|purchase|claim|rule\s*5|waiver|free agent|declared free agency/i.test(type)) return 3;
  return 9;
}

export async function fetchMlbPlayerTransactions(playerId: number): Promise<MlbTransaction[]> {
  const season = currentSeason();
  const raw = (await mlbGet("transactions", {
    playerId: String(playerId),
    startDate: `01/01/${season - 14}`,
    endDate: `12/31/${season}`,
  })) as {
    transactions?: {
      date?: string;
      typeDesc?: string;
      typeCode?: string;
      description?: string;
    }[];
  };
  return (raw.transactions ?? [])
    .filter((t) => ACQUISITION_TYPE.test((t.typeDesc || t.typeCode || "").trim()))
    .map((t) => ({
      date: t.date ?? "",
      type: t.typeDesc || t.typeCode || "Transaction",
      description: t.description ?? "",
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Team-name tokens used to detect “brought here” acquisitions. */
function acquisitionTeamHints(teamName?: string | null): string[] {
  const raw = (teamName ?? "").trim();
  if (!raw) return [];
  const withoutSt = raw.replace(/\bSt\.\s*/gi, "");
  const words = withoutSt.split(/\s+/).filter(Boolean);
  const hints = new Set<string>();
  for (const w of words) {
    if (w.length >= 3) hints.add(w);
  }
  // Nickname / last word is the strongest signal (Cardinals, Diamondbacks).
  const last = words[words.length - 1];
  if (last && last.length >= 3) hints.add(last);
  return [...hints];
}

function descriptionMatchesTeamHint(description: string, hints: string[]): boolean {
  if (!hints.length) return false;
  return hints.some((h) => new RegExp(`\\b${h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(description));
}

/** Extract the destination club from an MLB trade description. */
function tradeDestinationClub(description: string): string {
  const desc = description.trim();
  // Non-greedy so we stop at the first "to" (not "Player To Be Named Later").
  // Prefer the standard "traded … to TEAM for …" shape.
  const withFor = desc.match(/\btraded\b.+?\bto\b\s+(.+?)\s+for\b/i)?.[1]?.trim();
  if (withFor) return withFor;
  const withEnd = desc.match(/\btraded\b.+?\bto\b\s+(.+?)(?:\.|$)/i)?.[1]?.trim();
  return withEnd ?? "";
}

/** Signing/claim actor or "by TEAM" destination. */
function acquisitionActorClub(description: string): string {
  const desc = description.trim();
  const by = desc.match(/\b(?:claimed|selected|purchased).*?\bby\b\s+([^,.]+)/i)?.[1]?.trim();
  if (by) return by;
  const lead = desc.match(/^([^,.]+?)(?:\s+signed|\s+claimed|\s+selected|\s+purchased)/i)?.[1]?.trim();
  return lead ?? "";
}

/** Intra-org moves (call-up, option, IL) are still listed — they are not “how he arrived.” */
export function isIntraOrgTransaction(type: string, description: string): boolean {
  const blob = `${type} ${description}`;
  if (/selected the contract\b/i.test(description) && /\bfrom\b/i.test(description)) return true;
  return /recalled|optioned|assigned|transferred|outrighted|reinstated|activated|placed on|designated for assignment|invited to spring|sent to|returned to|rehab assignment/i.test(
    blob,
  );
}

/**
 * Curated “how he got here” story — the signing, draft, or trade that brought
 * the player into the current organization. Call-ups and other intra-org moves
 * stay on the transaction list but are not the arrival headline.
 *
 * Prefer draft over same-club signing (draft signees still get a “signed”
 * transaction that should not beat the draft line).
 */
export function buildAcquisitionStory(
  transactions: MlbTransaction[],
  extras: string[] = [],
  teamName?: string | null,
): { headline: string | null; lines: string[] } {
  const hints = acquisitionTeamHints(teamName);
  const byDateDesc = [...transactions].sort((a, b) => b.date.localeCompare(a.date));

  const acqPriority = (type: string): number => {
    if (/^trade/i.test(type)) return 40;
    if (/^draft/i.test(type)) return 30;
    if (/claim|purchase|rule\s*5|selected/i.test(type) && !/selected the contract/i.test(type))
      return 20;
    if (/^sign/i.test(type) || /signed as free agent/i.test(type)) return 10;
    return 0;
  };

  let currentTeamAcq: MlbTransaction | null = null;
  let currentScore = -1;
  for (const t of byDateDesc) {
    const type = t.type || "";
    const desc = t.description || "";
    if (isIntraOrgTransaction(type, desc)) continue;
    if (/^trade/i.test(type)) {
      const dest = tradeDestinationClub(desc);
      if (dest && descriptionMatchesTeamHint(dest, hints)) {
        const score = acqPriority(type);
        if (score > currentScore) {
          currentTeamAcq = t;
          currentScore = score;
        }
      }
      continue;
    }
    if (/^(signed|claimed|selected|purchase|draft)/i.test(type) || /signed as free agent/i.test(type)) {
      const actor = acquisitionActorClub(desc);
      if (
        (actor && descriptionMatchesTeamHint(actor, hints)) ||
        (!actor && descriptionMatchesTeamHint(desc, hints))
      ) {
        const score = acqPriority(type);
        if (score > currentScore) {
          currentTeamAcq = t;
          currentScore = score;
        }
      }
    }
  }

  const lines: string[] = [];
  for (const t of byDateDesc) {
    const line = `${t.date}: ${t.description}`;
    if (!lines.includes(line)) lines.push(line);
  }

  for (const extra of extras) {
    const cleaned = extra.trim();
    if (cleaned && !lines.some((l) => l.includes(cleaned) || cleaned.includes(l))) {
      lines.push(cleaned);
    }
  }

  const draftExtra =
    extras.map((e) => e.trim()).find((e) => /^drafted:/i.test(e)) ?? null;

  let headline: string | null = null;
  if (currentTeamAcq) {
    // Same-org draft signing → prefer the draft display line when we have one.
    if (
      draftExtra &&
      (/^sign/i.test(currentTeamAcq.type || "") || /signed as free agent/i.test(currentTeamAcq.type || ""))
    ) {
      headline = draftExtra;
    } else {
      headline = `${currentTeamAcq.date}: ${currentTeamAcq.description}`;
    }
  } else if (draftExtra && hints.length) {
    // Drafted by this club but no matching tx type — still an arrival.
    if (descriptionMatchesTeamHint(draftExtra, hints) || !hints.length) {
      headline = draftExtra;
    } else {
      headline = null;
    }
  } else if (hints.length) {
    headline = null;
  } else {
    const draft = byDateDesc.find((t) => /^draft/i.test(t.type));
    const signed = byDateDesc.find((t) => /^sign/i.test(t.type));
    const selected = byDateDesc.find((t) => /selected|purchase|claim|rule\s*5/i.test(t.type));
    const fallback = draft ?? (draftExtra ? null : signed) ?? selected ?? null;
    if (draftExtra && (!fallback || /^sign/i.test(fallback.type || ""))) {
      headline = draftExtra;
    } else if (fallback) {
      headline = `${fallback.date}: ${fallback.description}`;
    }
  }

  return { headline, lines: lines.slice(0, 16) };
}

function mapContractPayload(data: unknown): MlbPlayerContract | null {
  if (!data || typeof data !== "object") return null;
  // supabase-js occasionally nests the body; unwrap once.
  const root = data as Record<string, unknown>;
  const nested =
    root.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : root;
  const d = nested as {
    error?: string;
    contractStatus?: string | null;
    currentSalary?: MlbPlayerContract["currentSalary"];
    salaryHistory?: MlbPlayerContract["salaryHistory"];
    acquisition?: string[];
    url?: string;
    source?: string;
    aav?: string | null;
    totalValue?: string | null;
    serviceTime?: string | null;
    seasonWar?: number | null;
    careerWar?: number | null;
  };
  if (
    d.error &&
    !d.contractStatus &&
    !d.currentSalary &&
    !d.serviceTime &&
    !(d.salaryHistory?.length)
  ) {
    return null;
  }
  const hasAnything =
    Boolean(d.contractStatus) ||
    Boolean(d.currentSalary?.display) ||
    Boolean(d.totalValue) ||
    Boolean(d.aav) ||
    Boolean(d.serviceTime) ||
    d.seasonWar != null ||
    d.careerWar != null ||
    (d.salaryHistory?.length ?? 0) > 0;
  if (!hasAnything) return null;
  const asNum = (v: unknown): number | null => {
    if (v == null || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    contractStatus: d.contractStatus ?? null,
    currentSalary: d.currentSalary ?? null,
    salaryHistory: d.salaryHistory ?? [],
    acquisition: d.acquisition ?? [],
    url: d.url ?? null,
    source: d.source ?? "baseball-reference",
    aav: d.aav ?? null,
    totalValue: d.totalValue ?? null,
    serviceTime: d.serviceTime ?? null,
    seasonWar: asNum(d.seasonWar),
    careerWar: asNum(d.careerWar),
  };
}

/** Spotrac ids we already know — skip search entirely when BBRef blips. */
const SPOTRAC_PLAYER_HINTS: Record<string, string> = {
  "alec burleson": "https://www.spotrac.com/mlb/player/_/id/48426/alec-burleson",
  "andre pallante": "https://www.spotrac.com/mlb/player/_/id/30525/andre-pallante",
  "neil pallante": "https://www.spotrac.com/mlb/player/_/id/30525/andre-pallante",
  pallante: "https://www.spotrac.com/mlb/player/_/id/30525/andre-pallante",
  "blake snell": "https://www.spotrac.com/mlb/player/_/id/18356/blake-snell",
  "ivan herrera": "https://www.spotrac.com/mlb/player/_/id/20857/ivan-herrera",
  "iván herrera": "https://www.spotrac.com/mlb/player/_/id/20857/ivan-herrera",
  "jojo romero": "https://www.spotrac.com/mlb/player/_/id/20195/jojo-romero",
  "jordan walker": "https://www.spotrac.com/mlb/player/_/id/48376/jordan-walker",
  "kyle leahy": "https://www.spotrac.com/mlb/player/_/id/26606/kyle-leahy",
  "lars nootbaar": "https://www.spotrac.com/mlb/player/_/id/26276/lars-nootbaar",
  "masyn winn": "https://www.spotrac.com/mlb/player/_/id/48410/masyn-winn",
  "matthew liberatore": "https://www.spotrac.com/mlb/player/_/id/26039/matthew-liberatore",
  liberatore: "https://www.spotrac.com/mlb/player/_/id/26039/matthew-liberatore",
  "miles mikolas": "https://www.spotrac.com/mlb/player/_/id/11497/miles-mikolas",
  "nolan arenado": "https://www.spotrac.com/mlb/player/_/id/12643/nolan-arenado",
  "nolan gorman": "https://www.spotrac.com/mlb/player/_/id/26042/nolan-gorman",
  "pedro pages": "https://www.spotrac.com/mlb/player/_/id/31125/pedro-pages",
  "sonny gray": "https://www.spotrac.com/mlb/player/_/id/14331/sonny-gray",
  "willson contreras": "https://www.spotrac.com/mlb/player/_/id/18368/willson-contreras",
  "yohel pozo": "https://www.spotrac.com/mlb/player/_/id/70734/yohel-pozo",
  "victor scott ii": "https://www.spotrac.com/mlb/player/_/id/78741/victor-scott-ii",
  "thomas saggese": "https://www.spotrac.com/mlb/player/_/id/48501/thomas-saggese",
  "michael soroka": "https://www.spotrac.com/mlb/player/_/id/17596/michael-soroka",
  "mike soroka": "https://www.spotrac.com/mlb/player/_/id/17596/michael-soroka",
  soroka: "https://www.spotrac.com/mlb/player/_/id/17596/michael-soroka",
  "eury perez": "https://www.spotrac.com/mlb/player/_/id/31667/eury-perez",
  "eury pérez": "https://www.spotrac.com/mlb/player/_/id/31667/eury-perez",
};

function spotracHintForName(name: string): string | null {
  const key = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
  return SPOTRAC_PLAYER_HINTS[key] ?? null;
}

/** Build lookup names: prefer useName over legal firstName; skip ambiguous single tokens. */
export function contractLookupNames(input: {
  name: string;
  useName?: string;
  firstName?: string;
  lastName?: string;
}): string[] {
  const last = (input.lastName ?? "").trim();
  const use = (input.useName ?? "").trim();
  const first = (input.firstName ?? "").trim();
  const full = input.name.trim();
  const candidates = [
    full,
    use && last ? `${use} ${last}` : "",
    first && last ? `${first} ${last}` : "",
    // Last names only when distinctive enough to avoid "Lee"/"Cruz" collisions.
    last.length >= 5 ? last : "",
  ];
  return candidates.filter((n, i, arr) => {
    if (n.length < 3) return false;
    if (arr.indexOf(n) !== i) return false;
    // Never search bare first/use names ("Andre" → wrong player).
    if (!n.includes(" ") && n.toLowerCase() !== last.toLowerCase()) return false;
    return true;
  });
}

async function invokeSportsContract(body: Record<string, unknown>): Promise<MlbPlayerContract | null> {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  // Direct fetch first — supabase-js invoke has dropped bodies / hung in the browser.
  if (base && key) {
    try {
      const ctl = new AbortController();
      const timer = window.setTimeout(() => ctl.abort(), 35_000);
      try {
        const res = await fetch(`${base}/functions/v1/sports`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
            apikey: key,
          },
          body: JSON.stringify(body),
          signal: ctl.signal,
        });
        if (res.ok) {
          const mapped = mapContractPayload(await res.json());
          if (mapped) return mapped;
        }
      } finally {
        window.clearTimeout(timer);
      }
    } catch {
      /* fall through to supabase-js */
    }
  }

  try {
    const { data } = await supabase.functions.invoke("sports", { body });
    return mapContractPayload(data);
  } catch {
    return null;
  }
}

export function clearPlayerContractCache(playerName?: string): void {
  try {
    if (playerName) {
      const key = `mlb-contract-v3:${playerName.trim().toLowerCase()}`;
      sessionStorage.removeItem(key);
      sessionStorage.removeItem(`mlb-contract-v1:${playerName.trim().toLowerCase()}`);
      sessionStorage.removeItem(`mlb-contract-v2:${playerName.trim().toLowerCase()}`);
      return;
    }
    const doomed: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && /^mlb-contract-v\d+:/.test(k)) doomed.push(k);
    }
    doomed.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* private mode */
  }
}

export async function fetchPlayerContract(
  playerName: string,
  opts?: {
    url?: string | null;
    altNames?: string[];
    useName?: string;
    firstName?: string;
    lastName?: string;
    mlbId?: number | null;
  },
): Promise<MlbPlayerContract | null> {
  const names = contractLookupNames({
    name: playerName,
    useName: opts?.useName,
    firstName: opts?.firstName,
    lastName: opts?.lastName,
  });
  for (const alt of opts?.altNames ?? []) {
    const t = alt.trim();
    if (t.length >= 3 && !names.includes(t) && (t.includes(" ") || t.length >= 5)) names.push(t);
  }

  if (!names.length) return null;

  const mlbId =
    opts?.mlbId != null && Number.isFinite(Number(opts.mlbId)) && Number(opts.mlbId) > 0
      ? Number(opts.mlbId)
      : null;
  const cacheKey = `mlb-contract-v6:${names[0]!.toLowerCase()}${mlbId ? `:id${mlbId}` : ""}`;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as { at: number; data: MlbPlayerContract };
      // Require serviceTime in cache hits so older Spotrac-only payloads get refreshed.
      if (
        Date.now() - parsed.at < 24 * 60 * 60_000 &&
        parsed.data?.currentSalary?.display &&
        parsed.data?.serviceTime
      ) {
        return parsed.data;
      }
    }
  } catch {
    /* ignore cache */
  }

  const hint =
    (opts?.url && opts.url.trim()) ||
    spotracHintForName(playerName) ||
    names.map(spotracHintForName).find(Boolean) ||
    null;

  let lastError: Error | null = null;
  for (const name of names) {
    const attempts: Record<string, unknown>[] = [
      {
        action: "contract",
        name,
        ...(hint ? { url: hint } : {}),
        ...(mlbId != null ? { mlbId } : {}),
      },
      { action: "bbref", name, ...(mlbId != null ? { mlbId } : {}) },
    ];
    for (const body of attempts) {
      try {
        const mapped = await invokeSportsContract(body);
        if (mapped) {
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), data: mapped }));
          } catch {
            /* quota */
          }
          return mapped;
        }
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
      }
    }
  }
  if (lastError) throw lastError;
  // Throw so React Query retries instead of caching an empty success.
  throw new Error("No salary table came back from Baseball Reference / Spotrac yet");
}

export type MlbPlayerNewsNote = {
  source: "rotowire" | "rotoworld" | string;
  headline: string | null;
  story: string | null;
  description: string | null;
  published: string | null;
  url: string | null;
};

export type MlbPlayerBrief = {
  source: string;
  name: string;
  espnId: string | null;
  headline: string | null;
  story: string | null;
  description: string | null;
  published: string | null;
  news: { headline: string; description: string }[];
  url: string | null;
  /** RotoWire + RotoWorld blurbs when available (newest first). */
  notes: MlbPlayerNewsNote[];
};

function normalizePlayerBrief(
  payload: Partial<MlbPlayerBrief> & {
    error?: string;
    rotowire?: MlbPlayerNewsNote | null;
    rotoworld?: MlbPlayerNewsNote | null;
  },
  fallbackName: string,
): MlbPlayerBrief | null {
  if (payload.error) return null;
  const notes: MlbPlayerNewsNote[] = [];
  if (Array.isArray(payload.notes)) {
    for (const n of payload.notes) {
      if (!n || !(n.headline || n.story)) continue;
      notes.push({
        source: n.source || "rotowire",
        headline: n.headline ?? null,
        story: n.story ?? null,
        description: n.description ?? null,
        published: n.published ?? null,
        url: n.url ?? null,
      });
    }
  }
  // Always merge in rotowire + rotoworld (even when `notes` already has entries
  // from another source) so a player can carry blurbs from both services.
  if (payload.rotowire && (payload.rotowire.headline || payload.rotowire.story)) {
    notes.push({ ...payload.rotowire, source: payload.rotowire.source || "rotowire" });
  }
  if (payload.rotoworld && (payload.rotoworld.headline || payload.rotoworld.story)) {
    notes.push({ ...payload.rotoworld, source: payload.rotoworld.source || "rotoworld" });
  }
  if (!notes.length && (payload.headline || payload.story)) {
    notes.push({
      source: payload.source?.includes("rotoworld") && !payload.source.includes("rotowire")
        ? "rotoworld"
        : "rotowire",
      headline: payload.headline ?? null,
      story: payload.story ?? null,
      description: payload.description ?? null,
      published: payload.published ?? null,
      url: payload.url ?? null,
    });
  }

  const seen = new Set<string>();
  const dedupedNotes: MlbPlayerNewsNote[] = [];
  for (const n of notes) {
    // Cross-source: same blurb from RotoWire + RotoWorld should collapse.
    const key = (n.headline ?? n.story ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .slice(0, 120);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    dedupedNotes.push(n);
  }

  dedupedNotes.sort((a, b) => {
    const da = a.published ? Date.parse(a.published) : 0;
    const db = b.published ? Date.parse(b.published) : 0;
    return db - da;
  });
  // Player cards only surface the newest note — duplicate same-game blurbs
  // from RotoWire/RotoWorld are noise once the latest update lands.
  const newestNotes = dedupedNotes.slice(0, 1);

  if (!newestNotes.length && !(payload.news?.length)) return null;
  const primary = newestNotes[0];
  return {
    source: payload.source ?? (newestNotes.map((n) => n.source).join("+") || "rotowire"),
    name: payload.name ?? fallbackName,
    espnId: payload.espnId ?? null,
    headline: primary?.headline ?? payload.headline ?? null,
    story: primary?.story ?? payload.story ?? null,
    description: primary?.description ?? payload.description ?? null,
    published: primary?.published ?? payload.published ?? null,
    news: payload.news ?? [],
    url: primary?.url ?? payload.url ?? null,
    notes: newestNotes,
  };
}

/** First-name aliases we care about for RotoWorld name matching (James ↔ Jimmy ↔ Jim, etc). */
const ROTOWORLD_FIRST_NAME_ALIASES: Record<string, string[]> = {
  james: ["jimmy", "jim"],
  jimmy: ["james", "jim"],
  jim: ["james", "jimmy"],
};

function stripNameSuffix(name: string): string {
  return name.replace(/\s+(jr\.?|sr\.?|ii|iii|iv)\s*$/i, "").trim();
}

/**
 * Loose player-name match tolerant of RotoWorld's nickname quirks
 * (e.g. "Jimmy Crooks III" vs MLB's "James Crooks").
 */
export function rotoworldPlayerMatch(a: string, b: string): boolean {
  const an = stripNameSuffix(a).toLowerCase().trim();
  const bn = stripNameSuffix(b).toLowerCase().trim();
  if (!an || !bn) return false;
  if (an === bn) return true;
  const aParts = an.split(/\s+/).filter(Boolean);
  const bParts = bn.split(/\s+/).filter(Boolean);
  if (!aParts.length || !bParts.length) return false;
  const aLast = aParts[aParts.length - 1];
  const bLast = bParts[bParts.length - 1];
  if (aLast !== bLast) return false;
  const aFirst = aParts[0];
  const bFirst = bParts[0];
  if (aFirst === bFirst) return true;
  return (
    (ROTOWORLD_FIRST_NAME_ALIASES[aFirst] ?? []).includes(bFirst) ||
    (ROTOWORLD_FIRST_NAME_ALIASES[bFirst] ?? []).includes(aFirst)
  );
}

export type MlbRotoWorldBoardItem = MlbPlayerNewsNote & {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

let rotoWorldNewsCache: { items: MlbRotoWorldBoardItem[]; fetchedAt: number } | null = null;
const ROTOWORLD_NEWS_CACHE_MS = 2 * 60 * 1000;

/** RotoWorld's league-wide news feed (NBC Sports fantasy player-news page), cached 2 min. */
export async function fetchRotoWorldNews(): Promise<MlbRotoWorldBoardItem[]> {
  const now = Date.now();
  if (rotoWorldNewsCache && now - rotoWorldNewsCache.fetchedAt < ROTOWORLD_NEWS_CACHE_MS) {
    return rotoWorldNewsCache.items;
  }
  const data = await invokeSports<{ items?: MlbRotoWorldBoardItem[] }>({ action: "rotoWorldNews" });
  const items = Array.isArray(data?.items) ? data.items : [];
  rotoWorldNewsCache = { items, fetchedAt: now };
  return items;
}

/** Merge any RotoWorld feed items matching this player into `brief.notes` (deduped). */
export function mergeRotoWorldBoard(
  brief: MlbPlayerBrief,
  boardItems: MlbRotoWorldBoardItem[],
): MlbPlayerBrief {
  if (!boardItems.length) return brief;
  const matches = boardItems.filter((item) => {
    const itemName = (item.name ?? [item.firstName, item.lastName].filter(Boolean).join(" ")).trim();
    return itemName && rotoworldPlayerMatch(itemName, brief.name);
  });
  if (!matches.length) return brief;

  const notes = [...brief.notes];
  const seen = new Set(
    notes.map((n) =>
      (n.headline ?? n.story ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .slice(0, 120),
    ),
  );
  for (const item of matches) {
    const note: MlbPlayerNewsNote = {
      source: item.source || "rotoworld",
      headline: item.headline ?? null,
      story: item.story ?? null,
      description: item.description ?? null,
      published: item.published ?? null,
      url: item.url ?? null,
    };
    const key = (note.headline ?? note.story ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .slice(0, 120);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    notes.push(note);
  }
  notes.sort((a, b) => {
    const da = a.published ? Date.parse(a.published) : 0;
    const db = b.published ? Date.parse(b.published) : 0;
    return db - da;
  });
  const newest = notes.slice(0, 1);
  const primary = newest[0];
  return {
    ...brief,
    notes: newest,
    headline: primary?.headline ?? brief.headline,
    story: primary?.story ?? brief.story,
    description: primary?.description ?? brief.description,
    published: primary?.published ?? brief.published,
    url: primary?.url ?? brief.url,
  };
}

async function withRotoWorldBoard(brief: MlbPlayerBrief): Promise<MlbPlayerBrief> {
  try {
    const items = await fetchRotoWorldNews();
    return mergeRotoWorldBoard(brief, items);
  } catch {
    return brief;
  }
}

export async function fetchPlayerBrief(playerName: string): Promise<MlbPlayerBrief | null> {
  const name = playerName.trim();
  if (name.length < 3) return null;
  try {
    const { data, error } = await supabase.functions.invoke("sports", {
      body: { action: "playerBrief", name },
    });
    const payload = (data ?? null) as
      | (Partial<MlbPlayerBrief> & {
          error?: string;
          rotowire?: MlbPlayerNewsNote | null;
          rotoworld?: MlbPlayerNewsNote | null;
        })
      | null;
    if (payload) {
      const normalized = normalizePlayerBrief(payload, name);
      if (normalized) return await withRotoWorldBoard(normalized);
    }
    if (error && !payload) throw error;
  } catch {
    /* fall through to direct fetch */
  }

  // Browser fallback if the edge function is unavailable.
  try {
    const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (!base || !key) return null;
    const res = await fetch(`${base}/functions/v1/sports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        apikey: key,
      },
      body: JSON.stringify({ action: "playerBrief", name }),
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as Partial<MlbPlayerBrief> & {
      error?: string;
      rotowire?: MlbPlayerNewsNote | null;
      rotoworld?: MlbPlayerNewsNote | null;
    };
    const normalized = normalizePlayerBrief(payload, name);
    return normalized ? await withRotoWorldBoard(normalized) : null;
  } catch {
    return null;
  }
}

export function playerNewsSourceLabel(source: string | null | undefined): string {
  const s = (source ?? "").toLowerCase();
  if (s === "rotoworld") return "RotoWorld";
  if (s === "rotowire") return "RotoWire";
  if (s.includes("rotoworld") && s.includes("rotowire")) return "RotoWire · RotoWorld";
  if (s.includes("rotoworld")) return "RotoWorld";
  return "RotoWire";
}

const SPLIT_HIT_KEYS: [string, string][] = [
  ["gamesPlayed", "G"],
  ["atBats", "AB"],
  ["runs", "R"],
  ["hits", "H"],
  ["homeRuns", "HR"],
  ["rbi", "RBI"],
  ["baseOnBalls", "BB"],
  ["strikeOuts", "SO"],
  ["avg", "AVG"],
  ["obp", "OBP"],
  ["slg", "SLG"],
  ["ops", "OPS"],
];

const SPLIT_PITCH_KEYS: [string, string][] = [
  ["gamesPlayed", "G"],
  ["wins", "W"],
  ["losses", "L"],
  ["era", "ERA"],
  ["inningsPitched", "IP"],
  ["hits", "H"],
  ["runs", "R"],
  ["earnedRuns", "ER"],
  ["baseOnBalls", "BB"],
  ["strikeOuts", "SO"],
  ["homeRuns", "HR"],
  ["whip", "WHIP"],
];

export async function fetchMlbPlayerRecent(
  playerId: number | string,
  group: "hitting" | "pitching",
  games: 5 | 10,
  season = currentSeason(),
  sportId?: number | null,
): Promise<MlbRecentBlock | null> {
  const id = Number(playerId);
  const keys = group === "pitching" ? SPLIT_PITCH_KEYS : SPLIT_HIT_KEYS;
  try {
    const params: Record<string, string> = {
      stats: "lastXGames",
      group,
      season: String(season),
      limit: String(games),
      gameType: "R",
    };
    if (sportId != null && sportId > 0) params.sportId = String(sportId);
    const raw = (await mlbGet(`people/${id}/stats`, params)) as {
      stats?: { splits?: { stat?: Record<string, unknown> }[] }[];
    };
    const stat = raw.stats?.[0]?.splits?.[0]?.stat;
    const stats = pickStats(stat, keys);
    if (!stats.length) return null;
    const gPlayed = Number(stat?.gamesPlayed ?? games);
    return {
      label: `Last ${games}`,
      games: Number.isFinite(gPlayed) && gPlayed > 0 ? gPlayed : games,
      stats,
    };
  } catch {
    return null;
  }
}

type RankDef = { sortStat: string; label: string; order: "asc" | "desc"; statKey: string };

const HIT_RANK_DEFS: RankDef[] = [
  { sortStat: "homeRuns", label: "HR", order: "desc", statKey: "homeRuns" },
  { sortStat: "battingAverage", label: "AVG", order: "desc", statKey: "avg" },
  { sortStat: "ops", label: "OPS", order: "desc", statKey: "ops" },
  { sortStat: "rbi", label: "RBI", order: "desc", statKey: "rbi" },
  { sortStat: "stolenBases", label: "SB", order: "desc", statKey: "stolenBases" },
];

const PITCH_RANK_DEFS: RankDef[] = [
  { sortStat: "earnedRunAverage", label: "ERA", order: "asc", statKey: "era" },
  { sortStat: "strikeouts", label: "SO", order: "desc", statKey: "strikeOuts" },
  { sortStat: "wins", label: "W", order: "desc", statKey: "wins" },
  {
    sortStat: "walksAndHitsPerInningPitched",
    label: "WHIP",
    order: "asc",
    statKey: "whip",
  },
  { sortStat: "inningsPitched", label: "IP", order: "desc", statKey: "inningsPitched" },
];

export type MlbLeagueRank = {
  label: string;
  value: string;
  rank: number;
  of: number;
  /** ESPN-style display e.g. "Tied-55th" or "7th" */
  display: string;
};

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd", "th", "th", "th", "th", "th", "th"][Math.min(n % 10, 9)]}`;
}

async function rankForStat(
  playerId: number,
  group: "hitting" | "pitching",
  def: RankDef,
  season: number,
): Promise<MlbLeagueRank | null> {
  try {
    // Prefer full pool so bad / unqualified seasons still get a rank.
    const raw = (await mlbGet("stats", {
      stats: "season",
      group,
      season: String(season),
      sportId: "1",
      playerPool: "all",
      limit: "500",
      sortStat: def.sortStat,
      order: def.order,
    })) as {
      stats?: {
        splits?: {
          player?: { id?: number };
          stat?: Record<string, unknown>;
        }[];
      }[];
    };
    const splits = raw.stats?.[0]?.splits ?? [];
    const idx = splits.findIndex((s) => s.player?.id === playerId);
    if (idx < 0) return null;
    const value = splits[idx]?.stat?.[def.statKey];
    if (value == null || value === "") return null;
    const tied =
      (idx > 0 &&
        String(splits[idx - 1]?.stat?.[def.statKey] ?? "") === String(value)) ||
      (idx < splits.length - 1 &&
        String(splits[idx + 1]?.stat?.[def.statKey] ?? "") === String(value));
    // rank is first occurrence of this value
    let rank = idx + 1;
    for (let i = idx - 1; i >= 0; i--) {
      if (String(splits[i]?.stat?.[def.statKey] ?? "") === String(value)) rank = i + 1;
      else break;
    }
    const display = tied ? `Tied-${ordinal(rank)}` : ordinal(rank);
    return {
      label: def.label,
      value: String(value),
      rank,
      of: splits.length,
      display,
    };
  } catch {
    return null;
  }
}

/** Qualified MLB league ranks for key counting stats. */
export async function fetchMlbPlayerLeagueRanks(
  playerId: number | string,
  group: "hitting" | "pitching",
  season = currentSeason(),
): Promise<MlbLeagueRank[]> {
  const id = Number(playerId);
  const defs = group === "pitching" ? PITCH_RANK_DEFS : HIT_RANK_DEFS;
  const ranks = await Promise.all(defs.map((d) => rankForStat(id, group, d, season)));
  return ranks.filter((r): r is MlbLeagueRank => r != null);
}

/** Team-relative ranks for career-table leader styling. */
export async function fetchMlbPlayerTeamRanks(
  playerId: number | string,
  teamId: number,
  group: "hitting" | "pitching",
  season = currentSeason(),
): Promise<MlbLeagueRank[]> {
  const id = Number(playerId);
  if (!Number.isFinite(id) || !Number.isFinite(teamId) || teamId <= 0) return [];
  const defs = group === "pitching" ? PITCH_RANK_DEFS : HIT_RANK_DEFS;
  const ranks = await Promise.all(
    defs.map(async (def) => {
      try {
        const raw = (await mlbGet("stats", {
          stats: "season",
          group,
          season: String(season),
          sportId: "1",
          teamId: String(teamId),
          playerPool: "all",
          limit: "60",
          sortStat: def.sortStat,
          order: def.order,
        })) as {
          stats?: {
            splits?: {
              player?: { id?: number };
              stat?: Record<string, unknown>;
            }[];
          }[];
        };
        const splits = raw.stats?.[0]?.splits ?? [];
        const idx = splits.findIndex((s) => s.player?.id === id);
        if (idx < 0) return null;
        const value = splits[idx]?.stat?.[def.statKey];
        if (value == null || value === "") return null;
        return {
          label: def.label,
          value: String(value),
          rank: idx + 1,
          of: splits.length,
          display: ordinal(idx + 1),
        } satisfies MlbLeagueRank;
      } catch {
        return null;
      }
    }),
  );
  return ranks.filter((r): r is MlbLeagueRank => r != null);
}

export type MlbPlayerBio = {
  fullName: string | null;
  html: string;
  text: string;
  url: string;
};

/** Narrative bio from MLB.com “More Bio Info” modal. */
export async function fetchMlbPlayerBio(
  playerId: number | string,
  playerName: string,
): Promise<MlbPlayerBio | null> {
  const id = Number(playerId);
  if (!Number.isFinite(id) || id <= 0) return null;
  try {
    const { data, error } = await supabase.functions.invoke("sports", {
      body: { action: "playerBio", playerId: id, name: playerName },
    });
    if (error) throw error;
    const payload = data as (MlbPlayerBio & { error?: string; found?: boolean }) | null;
    if (!payload || payload.error || !payload.text) return null;
    return {
      fullName: payload.fullName ?? null,
      html: payload.html ?? "",
      text: payload.text,
      url: payload.url ?? `https://www.mlb.com/player/${id}`,
    };
  } catch {
    return null;
  }
}

export type MlbPlayerExtras = {
  serviceTime: string | null;
  seasonWar: number | null;
  careerWar: number | null;
  warRank: number | null;
  warOf: number | null;
  url: string | null;
};

function mapPlayerExtrasPayload(data: unknown): MlbPlayerExtras | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;
  const nested =
    root.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : root;
  const d = nested as Partial<MlbPlayerExtras> & { error?: string };
  const asNum = (v: unknown): number | null => {
    if (v == null || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const seasonWar = asNum(d.seasonWar);
  const careerWar = asNum(d.careerWar);
  const warRank = asNum(d.warRank);
  const warOf = asNum(d.warOf);
  const serviceTime =
    typeof d.serviceTime === "string" && d.serviceTime.trim() ? d.serviceTime.trim() : null;
  const hasBits = Boolean(serviceTime) || seasonWar != null || careerWar != null || warRank != null;
  if (!hasBits) return null;
  return {
    serviceTime,
    seasonWar,
    careerWar,
    warRank,
    warOf,
    url: typeof d.url === "string" ? d.url : null,
  };
}

/** ESPN "11th Season" style experience — fallback when BBRef service time is down. */
async function fetchEspnExperienceFallback(
  playerName: string,
  timeoutMs = 8_000,
): Promise<string | null> {
  try {
    const ctl = new AbortController();
    const timer = window.setTimeout(() => ctl.abort(), timeoutMs);
    try {
      return await fetchEspnExperienceFallbackInner(playerName, ctl.signal);
    } finally {
      window.clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

async function fetchEspnExperienceFallbackInner(
  playerName: string,
  signal: AbortSignal,
): Promise<string | null> {
  try {
    const searchUrl =
      "https://site.web.api.espn.com/apis/common/v3/search?region=us&lang=en&type=player&limit=8&query=" +
      encodeURIComponent(playerName.trim());
    const searchRes = await fetch(searchUrl, {
      headers: { Accept: "application/json" },
      signal,
    });
    if (!searchRes.ok) return null;
    const searchJson = (await searchRes.json()) as {
      items?: { id?: string; displayName?: string; league?: string; type?: string }[];
    };
    const want = playerName.trim().toLowerCase().replace(/\./g, "");
    const mlb = (searchJson.items ?? []).filter(
      (it) => String(it.league ?? "").toLowerCase() === "mlb" || it.type === "player",
    );
    const hit =
      mlb.find((it) => (it.displayName ?? "").toLowerCase().replace(/\./g, "") === want) ??
      mlb.find((it) =>
        (it.displayName ?? "")
          .toLowerCase()
          .replace(/\./g, "")
          .includes(want.split(/\s+/).slice(-1)[0] ?? ""),
      ) ??
      mlb[0];
    if (!hit?.id) return null;
    const athRes = await fetch(
      `https://site.web.api.espn.com/apis/common/v3/sports/baseball/mlb/athletes/${hit.id}`,
      { headers: { Accept: "application/json" }, signal },
    );
    if (!athRes.ok) return null;
    const ath = (await athRes.json()) as {
      athlete?: { displayExperience?: string };
      displayExperience?: string;
    };
    const exp = ath.athlete?.displayExperience ?? ath.displayExperience ?? null;
    return exp && exp.trim() ? exp.trim() : null;
  } catch {
    return null;
  }
}

/** Parse season/career WAR from a Baseball-Reference player HTML page. */
function parseBbrefWarFromHtml(
  html: string,
  isPitcher: boolean,
): { seasonWar: number | null; careerWar: number | null; urlHint: string | null } {
  const searchable = html.replace(/<!--([\s\S]*?)-->/g, "$1");
  const strip = (s: string) => s.replace(/<[^>]+>/g, "");
  const cellWar = (row: string, warStat: string): number | null => {
    const raw = row.match(new RegExp(`data-stat="${warStat}"[^>]*>([\\s\\S]*?)</t[dh]>`, "i"))?.[1];
    if (raw) {
      const text = strip(raw).replace(/,/g, "").trim();
      if (/^-?[0-9.]+$/.test(text)) {
        const n = Number(text);
        if (Number.isFinite(n)) return n;
      }
    }
    const csk = row.match(new RegExp(`data-stat="${warStat}"[^>]*\\bcsk="(-?[0-9.]+)"`, "i"))?.[1];
    if (csk && /^-?[0-9.]+$/.test(csk)) {
      const n = Number(csk);
      return Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
    }
    return null;
  };
  const tables: string[] = [];
  for (const id of [
    "players_value_batting",
    "players_value_pitching",
    "players_standard_batting",
    "players_standard_pitching",
  ]) {
    const m = searchable.match(
      new RegExp(`<table[^>]*\\bid="${id}"[^>]*>[\\s\\S]*?<\\/table>`, "i"),
    );
    if (m) tables.push(m[0]);
  }
  const slice = tables.join("\n") || searchable;
  const parseStat = (warStat: string) => {
    const year = new Date().getFullYear();
    const byYear = new Map<number, number>();
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let m: RegExpExecArray | null;
    while ((m = rowRe.exec(slice))) {
      const row = m[1];
      // Do NOT skip on bare colspan= — BBRef year rows use colspan on spacers.
      if (
        /thead|colhead|over_header|scope="col"|162\s*Game\s*Avg/i.test(row) ||
        /data-stat="year_id"[^>]*>\s*(?:<[^>]+>)?\s*Yrs\b/i.test(row) ||
        /\(\s*\d+\s*Yrs?\s*\)/i.test(row)
      ) {
        continue;
      }
      const yRaw =
        row.match(/data-stat="year_id"[^>]*\bcsk="(\d{4})"/i)?.[1] ??
        row.match(/data-stat="year_id"[^>]*>\s*(?:<a[^>]*>)?\s*(\d{4})/i)?.[1] ??
        row.match(/href="\/players\/gl\.fcgi[^"]*year=(\d{4})/i)?.[1];
      if (!yRaw) continue;
      const w = cellWar(row, warStat);
      if (w == null) continue;
      const y = Number(yRaw);
      if (!Number.isFinite(y)) continue;
      const prev = byYear.get(y);
      if (prev == null || Math.abs(w) >= Math.abs(prev)) byYear.set(y, w);
    }
    const seasonWar = byYear.has(year)
      ? byYear.get(year)!
      : byYear.size
        ? [...byYear.entries()].sort((a, b) => b[0] - a[0])[0]![1]
        : null;
    let careerWar: number | null = null;
    const foot = slice.match(/<tfoot>([\s\S]*?)<\/tfoot>/i)?.[1] ?? "";
    const footRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let fr: RegExpExecArray | null;
    while ((fr = footRe.exec(foot))) {
      if (!/\bYrs\b/i.test(fr[1])) continue;
      const w = cellWar(fr[1], warStat);
      if (w != null) {
        careerWar = w;
        break;
      }
    }
    if (careerWar == null && byYear.size) {
      careerWar = Math.round([...byYear.values()].reduce((a, b) => a + b, 0) * 10) / 10;
    }
    return { seasonWar, careerWar };
  };
  const primary = isPitcher ? "p_war" : "b_war";
  const secondary = isPitcher ? "b_war" : "p_war";
  let out = parseStat(primary);
  if (out.seasonWar == null && out.careerWar == null) out = parseStat(secondary);
  const urlHint =
    searchable.match(/canonical"\s+href="(https:\/\/www\.baseball-reference\.com\/players\/[^"]+)"/i)?.[1] ??
    null;
  return { ...out, urlHint };
}

/** Browser fallback when the sports edge returns service time but blank WAR.
 *  Direct BBRef fetches fail in the browser (CORS + Cloudflare). Re-hit the
 *  edge once more — FanGraphs fallback now runs server-side inside playerExtras.
 */
async function fetchWarViaEdgeRetry(
  name: string,
  opts?: { isPitcher?: boolean; mlbId?: number | null; teamAbbrev?: string | null },
): Promise<Pick<MlbPlayerExtras, "seasonWar" | "careerWar" | "url"> | null> {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!base || !key) return null;
  try {
    const ctl = new AbortController();
      const timer = window.setTimeout(() => ctl.abort(), 32_000);
    try {
      const res = await fetch(`${base}/functions/v1/sports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          apikey: key,
        },
        body: JSON.stringify({
          action: "playerWar",
          name,
          isPitcher: Boolean(opts?.isPitcher),
          mlbId: opts?.mlbId ?? null,
          teamAbbrev: opts?.teamAbbrev ?? null,
        }),
        signal: ctl.signal,
      });
      if (!res.ok) return null;
      const mapped = mapPlayerExtrasPayload(await res.json());
      if (!mapped || (mapped.seasonWar == null && mapped.careerWar == null)) return null;
      return {
        seasonWar: mapped.seasonWar,
        careerWar: mapped.careerWar,
        url: mapped.url,
      };
    } finally {
      window.clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

async function invokeSportsAction(
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<unknown | null> {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (base && key) {
    try {
      const ctl = new AbortController();
      const timer = window.setTimeout(() => ctl.abort(), timeoutMs);
      try {
        const res = await fetch(`${base}/functions/v1/sports`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
            apikey: key,
          },
          body: JSON.stringify(body),
          signal: ctl.signal,
        });
        if (res.ok) return await res.json();
      } finally {
        window.clearTimeout(timer);
      }
    } catch {
      /* timed out or network error */
    }
  }
  // Direct fetch failed — one capped supabase-js attempt (mobile PWAs).
  try {
    const result = await Promise.race([
      supabase.functions.invoke("sports", { body }),
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), timeoutMs)),
    ]);
    if (!result || typeof result !== "object" || !("data" in result)) return null;
    return (result as { data: unknown }).data ?? null;
  } catch {
    return null;
  }
}

/** FanGraphs team ids for WAR leader lookups (mirrors sports edge). */
const FANGRAPHS_TEAM_ID: Record<string, number> = {
  LAA: 1,
  BAL: 2,
  BOS: 3,
  CHW: 4,
  CWS: 4,
  CLE: 5,
  DET: 6,
  KC: 7,
  KCR: 7,
  MIN: 8,
  NYY: 9,
  OAK: 10,
  ATH: 10,
  SEA: 11,
  TB: 12,
  TBR: 12,
  TEX: 13,
  TOR: 14,
  AZ: 15,
  ARI: 15,
  ATL: 16,
  CHC: 17,
  CIN: 18,
  COL: 19,
  MIA: 20,
  HOU: 21,
  LAD: 22,
  MIL: 23,
  WSH: 24,
  WSN: 24,
  NYM: 25,
  PHI: 26,
  PIT: 27,
  STL: 28,
  SD: 29,
  SDP: 29,
  SF: 30,
  SFG: 30,
};

/** FanGraphs leaders + player stats — works in-browser (Access-Control-Allow-Origin: *). */
async function fetchFangraphsWarClient(opts: {
  name: string;
  isPitcher?: boolean;
  mlbId?: number | null;
  teamAbbrev?: string | null;
}): Promise<Pick<MlbPlayerExtras, "seasonWar" | "careerWar" | "url"> | null> {
  const yearNow = new Date().getFullYear();
  const stats = opts.isPitcher ? "pit" : "bat";
  const wantId = opts.mlbId != null && opts.mlbId > 0 ? Math.trunc(opts.mlbId) : null;
  const wantName = opts.name.trim().toLowerCase().replace(/\./g, "");
  const teamId =
    opts.teamAbbrev && FANGRAPHS_TEAM_ID[opts.teamAbbrev.toUpperCase()]
      ? FANGRAPHS_TEAM_ID[opts.teamAbbrev.toUpperCase()]!
      : 0;

  const loadPage = async (team: number, season: number, season1: number, pageitems = 80) => {
    const url =
      `https://www.fangraphs.com/api/leaders/major-league/data` +
      `?pos=all&stats=${stats}&lg=all&qual=0&type=8` +
      `&season=${season}&season1=${season1}&month=0&team=${team}` +
      `&pageitems=${pageitems}&pagenum=1&ind=0`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [] as Record<string, unknown>[];
    const text = await res.text();
    if (!text.startsWith("{")) return [];
    try {
      const json = JSON.parse(text) as { data?: Record<string, unknown>[] };
      return Array.isArray(json.data) ? json.data : [];
    } catch {
      return [];
    }
  };

  const matchRow = (rows: Record<string, unknown>[]) => {
    if (wantId != null) {
      const byId = rows.find((r) => Number(r.xMLBAMID) === wantId);
      if (byId) return byId;
    }
    return (
      rows.find((r) => {
        const n = String(r.PlayerName ?? r.PlayerNameRoute ?? "")
          .toLowerCase()
          .replace(/\./g, "")
          .trim();
        return n && (n === wantName || n.includes(wantName) || wantName.includes(n));
      }) ?? null
    );
  };

  const asWar = (row: Record<string, unknown> | null) => {
    if (!row || row.WAR == null || row.WAR === "") return null;
    const n = typeof row.WAR === "number" ? row.WAR : Number(row.WAR);
    return Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
  };

  let seasonRow: Record<string, unknown> | null = null;
  for (const y of [yearNow, yearNow - 1]) {
    if (teamId > 0) seasonRow = matchRow(await loadPage(teamId, y, y, 120));
    if (!seasonRow) seasonRow = matchRow(await loadPage(0, y, y, 500));
    if (seasonRow) break;
  }

  const seasonWar = asWar(seasonRow);
  const fgPlayerId = seasonRow?.playerid != null ? Number(seasonRow.playerid) : null;
  let careerWar: number | null = null;

  if (fgPlayerId != null && Number.isFinite(fgPlayerId)) {
    try {
      const pos = opts.isPitcher ? "P" : "OF";
      const res = await fetch(
        `https://www.fangraphs.com/api/players/stats?playerid=${fgPlayerId}&position=${pos}`,
        { headers: { Accept: "application/json" } },
      );
      if (res.ok) {
        const json = (await res.json()) as {
          data?: { WAR?: number; type?: number; AbbLevel?: string }[];
        };
        const total = (json.data ?? []).find((r) => r.type === -1 && r.AbbLevel === "MLB");
        if (total?.WAR != null) {
          const n = Number(total.WAR);
          if (Number.isFinite(n)) careerWar = Math.round(n * 10) / 10;
        }
      }
    } catch {
      /* optional */
    }
  }

  if (seasonWar == null && careerWar == null) return null;
  const route = String(seasonRow?.PlayerNameRoute ?? opts.name)
    .replace(/\s+/g, "-")
    .toLowerCase();
  return {
    seasonWar,
    careerWar,
    url:
      fgPlayerId != null
        ? `https://www.fangraphs.com/players/${encodeURIComponent(route)}/${fgPlayerId}/stats`
        : "https://www.fangraphs.com/",
  };
}

/** Browser-side BBRef daily WAR dump lookup when the sports edge returns blank. */
async function fetchWarFromBbrefDumpBrowser(
  opts?: { mlbId?: number | null; name?: string | null },
): Promise<Pick<MlbPlayerExtras, "seasonWar" | "careerWar" | "url"> | null> {
  const mlbId = opts?.mlbId != null && opts.mlbId > 0 ? Math.trunc(opts.mlbId) : null;
  const nameKey = (opts?.name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!mlbId && nameKey.length < 3) return null;

  const fetchText = async (url: string): Promise<string | null> => {
    try {
      const direct = await fetch(url, { headers: { Accept: "text/plain" } });
      if (direct.ok) return await direct.text();
    } catch {
      /* CORS / network — try allorigins */
    }
    try {
      const proxied = await fetch(
        `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      );
      if (proxied.ok) return await proxied.text();
    } catch {
      /* ignore */
    }
    return null;
  };

  const [bat, pit] = await Promise.all([
    fetchText("https://www.baseball-reference.com/data/war_daily_bat.txt"),
    fetchText("https://www.baseball-reference.com/data/war_daily_pitch.txt"),
  ]);
  if (!bat && !pit) return null;

  const byYear = new Map<number, number>();
  let playerId: string | null = null;
  const ingest = (text: string | null) => {
    if (!text) return;
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return;
    const header = lines[0]!.split(",");
    const iMlb = header.indexOf("mlb_ID");
    const iYear = header.indexOf("year_ID");
    const iWar = header.indexOf("WAR");
    const iName = header.indexOf("name_common");
    const iPid = header.indexOf("player_ID");
    if (iMlb < 0 || iYear < 0 || iWar < 0) return;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i]!.split(",");
      const id = Number(cols[iMlb]);
      const year = Number(cols[iYear]);
      const war = Number(cols[iWar]);
      if (!Number.isFinite(year) || !Number.isFinite(war)) continue;
      const rowName = (cols[iName] ?? "").trim().toLowerCase();
      const matchId = mlbId != null && id === mlbId;
      const matchName =
        !matchId &&
        nameKey.length >= 3 &&
        rowName.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim() === nameKey;
      if (!matchId && !matchName) continue;
      byYear.set(year, (byYear.get(year) ?? 0) + war);
      if (!playerId && cols[iPid]) playerId = cols[iPid]!;
    }
  };
  ingest(bat);
  ingest(pit);
  if (!byYear.size) return null;

  const year = new Date().getFullYear();
  const years = [...byYear.keys()].sort((a, b) => b - a);
  const seasonWar = byYear.has(year) ? byYear.get(year)! : byYear.get(years[0]!)!;
  const careerWar = [...byYear.values()].reduce((a, b) => a + b, 0);
  const letter = (playerId ?? "x")[0] ?? "x";
  return {
    seasonWar: Math.round(seasonWar * 10) / 10,
    careerWar: Math.round(careerWar * 10) / 10,
    url: playerId
      ? `https://www.baseball-reference.com/players/${letter}/${playerId}.shtml`
      : "https://www.baseball-reference.com/data/war_daily_bat.txt",
  };
}

/** Season + career WAR from BBRef daily dumps (fast sports edge action). */
export async function fetchMlbPlayerWar(
  playerName: string,
  opts?: { isPitcher?: boolean; mlbId?: number | null; teamAbbrev?: string | null },
): Promise<Pick<MlbPlayerExtras, "seasonWar" | "careerWar" | "url"> | null> {
  const name = playerName.trim();
  if (name.length < 3 && !(opts?.mlbId != null && opts.mlbId > 0)) return null;

  // FanGraphs is CORS-open and fast — don't block the card on a 50MB BBRef dump cold load.
  const fgP = fetchFangraphsWarClient({ name, ...opts }).catch(() => null);
  const warBody = {
    action: "playerWar",
    name,
    isPitcher: Boolean(opts?.isPitcher),
    mlbId: opts?.mlbId ?? null,
    teamAbbrev: opts?.teamAbbrev ?? null,
  };
  const edgeP = (async () => {
    const mapped = mapPlayerExtrasPayload(await invokeSportsAction(warBody, 32_000));
    if (!mapped || (mapped.seasonWar == null && mapped.careerWar == null)) return null;
    return {
      seasonWar: mapped.seasonWar,
      careerWar: mapped.careerWar,
      url: mapped.url,
    };
  })();

  const [fg, edge] = await Promise.all([fgP, edgeP]);
  const seasonWar = edge?.seasonWar ?? fg?.seasonWar ?? null;
  const careerWar = edge?.careerWar ?? fg?.careerWar ?? null;
  const url = edge?.url ?? fg?.url ?? null;
  if (seasonWar != null || careerWar != null) {
    return { seasonWar, careerWar, url };
  }
  const retry = await fetchWarViaEdgeRetry(name, opts);
  if (retry && (retry.seasonWar != null || retry.careerWar != null)) return retry;
  // Edge blank/timeout — read BBRef daily dumps in the browser (via CORS proxy).
  return fetchWarFromBbrefDumpBrowser({ mlbId: opts?.mlbId ?? null, name });
}

/** Service time + WAR rank from Baseball Reference (via sports edge). */
export async function fetchMlbPlayerExtras(
  playerName: string,
  opts?: { isPitcher?: boolean; mlbId?: number | null; teamAbbrev?: string | null },
): Promise<MlbPlayerExtras | null> {
  const name = playerName.trim();
  if (name.length < 3) return null;
  const extrasBody = {
    action: "playerExtras",
    name,
    isPitcher: Boolean(opts?.isPitcher),
    mlbId: opts?.mlbId ?? null,
    teamAbbrev: opts?.teamAbbrev ?? null,
  };

  let mapped = mapPlayerExtrasPayload(await invokeSportsAction(extrasBody, 28_000));

  if (mapped?.seasonWar == null && mapped?.careerWar == null) {
    const fg = await fetchFangraphsWarClient({ name, ...opts }).catch(() => null);
    if (fg && (fg.seasonWar != null || fg.careerWar != null)) {
      mapped = {
        serviceTime: mapped?.serviceTime ?? null,
        seasonWar: fg.seasonWar,
        careerWar: fg.careerWar,
        warRank: mapped?.warRank ?? null,
        warOf: mapped?.warOf ?? null,
        url: fg.url ?? mapped?.url ?? null,
      };
    }
  }

  // Don't poison the card with ESPN “5th Season” when BBRef service time is coming
  // from the contract scrape — only use ESPN if we still have nothing.
  if (!mapped?.serviceTime || /\bseason\b/i.test(mapped.serviceTime)) {
    if (!mapped?.serviceTime) {
      const exp = await fetchEspnExperienceFallback(name);
      if (exp) {
        mapped = {
          serviceTime: exp,
          seasonWar: mapped?.seasonWar ?? null,
          careerWar: mapped?.careerWar ?? null,
          warRank: mapped?.warRank ?? null,
          warOf: mapped?.warOf ?? null,
          url: mapped?.url ?? null,
        };
      }
    }
  }

  return mapped;
}

/** Lower-is-better rate stats when marking career highs. */
const CAREER_HIGH_LOWER_BETTER = new Set(["ERA", "WHIP", "AVG_ALLOWED"]);

export function careerHighLabels(
  rows: MlbPlayerSeasonRow[],
  labels: string[],
): Set<string> {
  const highs = new Set<string>();
  for (const label of labels) {
    let best: number | null = null;
    let bestKey: string | null = null;
    const lower = CAREER_HIGH_LOWER_BETTER.has(label);
    for (const row of rows) {
      const raw = row.stats.find((s) => s.label === label)?.value;
      if (raw == null || raw === "" || raw === "—") continue;
      const n = Number(String(raw).replace(/[^0-9.+-]/g, ""));
      if (!Number.isFinite(n)) continue;
      if (
        best == null ||
        (lower ? n < best : n > best) ||
        (n === best && bestKey != null && row.season > Number(bestKey.split(":")[0]))
      ) {
        best = n;
        bestKey = `${row.season}:${row.teamId ?? row.team}:${label}`;
      }
    }
    if (bestKey) highs.add(bestKey);
  }
  return highs;
}

/** Season situational splits (home/away, vs L/R, day/night). */
export async function fetchMlbPlayerSplits(
  playerId: number | string,
  group: "hitting" | "pitching",
  season = currentSeason(),
  sportId?: number | null,
): Promise<MlbSplitRow[]> {
  const id = Number(playerId);
  const params: Record<string, string> = {
    stats: "statSplits",
    group,
    season: String(season),
    sitCodes: "h,a,vl,vr,d,n",
  };
  if (sportId != null && sportId > 0) params.sportId = String(sportId);
  const raw = (await mlbGet(`people/${id}/stats`, params)) as {
    stats?: {
      splits?: {
        split?: { code?: string; description?: string };
        stat?: Record<string, unknown>;
      }[];
    }[];
  };

  const keys = group === "pitching" ? SPLIT_PITCH_KEYS : SPLIT_HIT_KEYS;
  const order = ["h", "a", "vl", "vr", "d", "n"];
  const rows: MlbSplitRow[] = [];
  for (const block of raw.stats ?? []) {
    for (const sp of block.splits ?? []) {
      const code = (sp.split?.code ?? "").toLowerCase();
      const label = sp.split?.description ?? code.toUpperCase();
      // Always emit every column (use "—") so vs L/R rows missing `runs` don't shift.
      const stats = keys.map(([k, lab]) => ({
        label: lab,
        value: sp.stat?.[k] != null && sp.stat[k] !== "" ? String(sp.stat[k]) : "—",
      }));
      rows.push({ code, label, stats });
    }
  }
  rows.sort((a, b) => {
    const ai = order.indexOf(a.code);
    const bi = order.indexOf(b.code);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  return rows;
}

/** ESPN draft line as fallback when MLB hydrate is empty. */
export async function fetchEspnDraftLine(playerName: string): Promise<string | null> {
  try {
    const searchUrl = new URL("https://site.api.espn.com/apis/common/v3/search");
    searchUrl.searchParams.set("query", playerName);
    searchUrl.searchParams.set("limit", "8");
    searchUrl.searchParams.set("type", "player");
    const searchRes = await fetch(searchUrl.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!searchRes.ok) return null;
    const search = (await searchRes.json()) as {
      items?: { id?: string; displayName?: string; type?: string }[];
    };
    const hit = (search.items ?? []).find(
      (i) =>
        i.type === "player" &&
        (i.displayName ?? "").toLowerCase() === playerName.toLowerCase(),
    ) ?? (search.items ?? []).find((i) => i.type === "player");
    if (!hit?.id) return null;

    const athleteRes = await fetch(
      `https://site.api.espn.com/apis/common/v3/sports/baseball/mlb/athletes/${hit.id}`,
      { headers: { Accept: "application/json" } },
    );
    if (!athleteRes.ok) return null;
    const athlete = (await athleteRes.json()) as {
      athlete?: { displayDraft?: string; fullName?: string };
      displayDraft?: string;
    };
    return athlete.athlete?.displayDraft ?? athlete.displayDraft ?? null;
  } catch {
    return null;
  }
}

async function fetchEspnPlayoffMap(): Promise<
  Map<string, { playoff: string | null; wildCard: string | null }>
> {
  const map = new Map<string, { playoff: string | null; wildCard: string | null }>();
  try {
    const res = await fetch(ESPN_STANDINGS, { headers: { Accept: "application/json" } });
    if (!res.ok) return map;
    const d = (await res.json()) as {
      children?: {
        standings?: {
          entries?: {
            team?: { displayName?: string; shortDisplayName?: string; abbreviation?: string };
            stats?: { name?: string; displayValue?: string }[];
          }[];
        };
      }[];
    };
    for (const child of d.children ?? []) {
      for (const e of child.standings?.entries ?? []) {
        const stat = (n: string) => e.stats?.find((s) => s.name === n)?.displayValue ?? null;
        const keys = [e.team?.displayName, e.team?.shortDisplayName, e.team?.abbreviation].filter(
          Boolean,
        ) as string[];
        const odds = { playoff: stat("playoffPercent"), wildCard: stat("wildCardPercent") };
        for (const k of keys) map.set(k.toLowerCase(), odds);
      }
    }
  } catch {
    // optional
  }
  return map;
}

function shortDivName(name?: string): string {
  if (!name) return "Division";
  const trimmed = name.trim();
  if (/^(AL|NL)\s+(East|Central|West)$/i.test(trimmed)) {
    const [, lg, div] = trimmed.match(/^(AL|NL)\s+(East|Central|West)$/i)!;
    return `${lg.toUpperCase()} ${div[0]!.toUpperCase()}${div.slice(1).toLowerCase()}`;
  }
  return trimmed
    .replace(/^National League\s+/i, "NL ")
    .replace(/^American League\s+/i, "AL ");
}

export async function fetchMlbStandings(): Promise<MlbDivisionTable[]> {
  const season = currentSeason();
  const [raw, oddsMap] = await Promise.all([
    mlbGet("standings", {
      leagueId: "103,104",
      season: String(season),
      standingsTypes: "regularSeason",
      hydrate: "division,team",
    }),
    fetchEspnPlayoffMap(),
  ]);

  const tables: MlbDivisionTable[] = [];
  for (const block of (raw as { records?: unknown[] }).records ?? []) {
    const rec = block as {
      division?: { name?: string; nameShort?: string };
      teamRecords?: {
        team?: { id?: number; name?: string; abbreviation?: string; teamName?: string };
        wins?: number;
        losses?: number;
        divisionRank?: string;
        gamesBack?: string;
        wildCardGamesBack?: string;
        winningPercentage?: string;
        streak?: { streakCode?: string };
        runsScored?: number;
        runsAllowed?: number;
        runDifferential?: number;
        records?: {
          splitRecords?: { type?: string; wins?: number; losses?: number; pct?: string }[];
        };
      }[];
    };
    const rows: MlbStandingRow[] = (rec.teamRecords ?? []).map((r) => {
      const name = r.team?.name ?? "—";
      const odds =
        oddsMap.get(name.toLowerCase()) ||
        oddsMap.get((r.team?.teamName ?? "").toLowerCase()) ||
        oddsMap.get((r.team?.abbreviation ?? "").toLowerCase());
      const wcgb = r.wildCardGamesBack;
      const lastTen = r.records?.splitRecords?.find((s) => s.type === "lastTen");
      const rs = r.runsScored ?? 0;
      const ra = r.runsAllowed ?? 0;
      return {
        rank: String(r.divisionRank ?? ""),
        teamId: r.team?.id ?? 0,
        team: name.replace(/^(St\. Louis|Chicago|New York|Los Angeles|Tampa Bay|Kansas City|San Francisco|San Diego|Toronto) /, ""),
        abbrev: r.team?.abbreviation ?? "",
        wins: r.wins ?? 0,
        losses: r.losses ?? 0,
        pct: r.winningPercentage ?? "",
        gb: r.gamesBack === "0.0" || r.gamesBack === "-" ? "—" : String(r.gamesBack ?? "—"),
        streak: r.streak?.streakCode ?? "",
        playoffPercent: odds?.playoff ?? null,
        wildCardPercent: odds?.wildCard ?? null,
        wcgb: !wcgb || wcgb === "-" || wcgb === "0" || wcgb === "0.0" ? "—" : String(wcgb),
        l10: lastTen ? `${lastTen.wins ?? 0}-${lastTen.losses ?? 0}` : "—",
        runDiff: r.runDifferential ?? rs - ra,
      };
    });
    tables.push({
      name: rec.division?.name ?? "Division",
      shortName: shortDivName(rec.division?.name ?? rec.division?.nameShort),
      rows,
    });
  }

  // AL East/Central/West then NL
  const order = ["AL East", "AL Central", "AL West", "NL East", "NL Central", "NL West"];
  tables.sort((a, b) => order.indexOf(a.shortName) - order.indexOf(b.shortName));
  return tables;
}

/** Current division leader (rank 1) for each of East/Central/West in a league. */
export function divisionLeaders(
  tables: MlbDivisionTable[],
  league: "AL" | "NL",
): Array<MlbStandingRow & { divisionLetter: "E" | "C" | "W" }> {
  const letters: Array<"E" | "C" | "W"> = ["E", "C", "W"];
  const names: Record<"E" | "C" | "W", string> = { E: "East", C: "Central", W: "West" };
  const leaders: Array<MlbStandingRow & { divisionLetter: "E" | "C" | "W" }> = [];
  for (const divisionLetter of letters) {
    const want = `${league} ${names[divisionLetter]}`.toLowerCase();
    const table = tables.find((t) => {
      const short = (t.shortName || "").toLowerCase();
      const full = (t.name || "").toLowerCase();
      return short === want || full.includes(want) || short.endsWith(names[divisionLetter].toLowerCase()) && short.startsWith(league.toLowerCase());
    });
    if (!table || table.rows.length === 0) continue;
    const leader = table.rows.find((r) => r.rank === "1") ?? table.rows[0];
    leaders.push({ ...leader, divisionLetter });
  }
  return leaders;
}

const LEADER_DEFS: { key: string; label: string; category: string; group: "hitting" | "pitching" }[] =
  [
    { key: "hr", label: "Home Runs", category: "homeRuns", group: "hitting" },
    { key: "avg", label: "Batting Avg", category: "battingAverage", group: "hitting" },
    { key: "rbi", label: "RBI", category: "rbi", group: "hitting" },
    { key: "ops", label: "OPS", category: "ops", group: "hitting" },
    { key: "sb", label: "Stolen Bases", category: "stolenBases", group: "hitting" },
    { key: "era", label: "ERA", category: "earnedRunAverage", group: "pitching" },
    { key: "k", label: "Strikeouts", category: "strikeouts", group: "pitching" },
    { key: "w", label: "Wins", category: "wins", group: "pitching" },
    { key: "sv", label: "Saves", category: "saves", group: "pitching" },
    { key: "whip", label: "WHIP", category: "walksAndHitsPerInningPitched", group: "pitching" },
  ];

export async function fetchMlbLeaders(
  limit = 8,
  opts?: { leagueId?: 103 | 104 },
): Promise<MlbLeaderBoard[]> {
  const season = String(currentSeason());
  const leagueId = opts?.leagueId;
  const boards = await Promise.all(
    LEADER_DEFS.map(async (def) => {
      try {
        const raw = (await mlbGet("stats/leaders", {
          leaderCategories: def.category,
          season,
          sportId: "1",
          statGroup: def.group,
          limit: String(limit),
          ...(leagueId != null ? { leagueId: String(leagueId) } : {}),
        })) as {
          leagueLeaders?: {
            leaders?: {
              rank?: number;
              value?: string;
              person?: { id?: number; fullName?: string };
              team?: { id?: number; name?: string };
            }[];
          }[];
        };
        const leaders = (raw.leagueLeaders?.[0]?.leaders ?? []).map((l) => ({
          rank: l.rank ?? 0,
          playerId: l.person?.id ?? 0,
          name: l.person?.fullName ?? "—",
          team: (l.team?.name ?? "").replace(
            /^(St\. Louis|Chicago|New York|Los Angeles|Tampa Bay|Kansas City|San Francisco|San Diego|Toronto) /,
            "",
          ),
          teamId: l.team?.id ?? null,
          value: String(l.value ?? "—"),
        }));
        return {
          key: leagueId != null ? `${def.key}-${leagueId}` : def.key,
          label: def.label,
          group: def.group,
          leaders,
        };
      } catch {
        return {
          key: leagueId != null ? `${def.key}-${leagueId}` : def.key,
          label: def.label,
          group: def.group,
          leaders: [] as MlbLeader[],
        };
      }
    }),
  );
  return boards.filter((b) => b.leaders.length > 0);
}

function pickStats(
  stat: Record<string, unknown> | undefined,
  keys: [string, string][],
): MlbPlayerStatLine[] {
  if (!stat) return [];
  return keys
    .filter(([k]) => stat[k] != null && stat[k] !== "")
    .map(([k, label]) => ({ label, value: String(stat[k]) }));
}

const TEAM_COLORS: Record<number, string> = {
  108: "ba0021", // LAA
  109: "a71930", // ARI
  110: "df4601", // BAL
  111: "bd3039", // BOS
  112: "0e3386", // CHC
  113: "c6011f", // CIN
  114: "e31937", // CLE
  115: "33006f", // COL
  116: "0c2340", // DET
  117: "002d62", // HOU
  118: "004687", // KC
  119: "005a9c", // LAD
  120: "ab0003", // WSH
  121: "002d72", // NYM
  133: "003831", // OAK/ATH
  134: "27251f", // PIT
  135: "2f241d", // SD
  136: "005c5c", // SEA
  137: "fd5a1e", // SF
  138: "be0a14", // STL
  139: "8fbce6", // TB
  140: "003278", // TEX
  141: "134a8e", // TOR
  142: "002b5c", // MIN
  143: "e81828", // PHI
  144: "ce1141", // ATL
  145: "27251f", // CWS
  146: "00a3e0", // MIA
  147: "0c2340", // NYY
  158: "12284b", // MIL
};

/** Hex color (no #) for team-accent leader cards. */
export function mlbTeamAccent(teamId: number | null | undefined): string {
  if (teamId == null) return "d9515c";
  return TEAM_COLORS[teamId] ?? "d9515c";
}

const HIT_KEYS: [string, string][] = [
  ["gamesPlayed", "G"],
  ["atBats", "AB"],
  ["avg", "AVG"],
  ["homeRuns", "HR"],
  ["rbi", "RBI"],
  ["stolenBases", "SB"],
  ["ops", "OPS"],
  ["obp", "OBP"],
  ["slg", "SLG"],
  ["hits", "H"],
  ["runs", "R"],
  ["doubles", "2B"],
  ["triples", "3B"],
  ["baseOnBalls", "BB"],
  ["strikeOuts", "SO"],
];

const PITCH_KEYS: [string, string][] = [
  ["gamesPlayed", "G"],
  ["gamesStarted", "GS"],
  ["wins", "W"],
  ["losses", "L"],
  ["era", "ERA"],
  ["inningsPitched", "IP"],
  ["strikeOuts", "SO"],
  ["whip", "WHIP"],
  ["saves", "SV"],
  ["holds", "HLD"],
  ["baseOnBalls", "BB"],
  ["hits", "H"],
  ["homeRuns", "HR"],
  ["earnedRuns", "ER"],
];

function formatDraft(d: {
  year?: string | number;
  pickRound?: string;
  pickNumber?: number;
  signingBonus?: string;
  school?: { name?: string };
  team?: { name?: string; abbreviation?: string };
} | null | undefined): MlbDraftInfo | null {
  if (!d) return null;
  const year =
    d.year != null && String(d.year).trim() !== ""
      ? Number(d.year)
      : null;
  const round = d.pickRound ? String(d.pickRound) : null;
  const pick = d.pickNumber != null ? Number(d.pickNumber) : null;
  const team = d.team?.name ?? d.team?.abbreviation ?? null;
  const school = d.school?.name ?? null;
  const bonusNum = d.signingBonus != null ? Number(d.signingBonus) : NaN;
  const signingBonus = Number.isFinite(bonusNum)
    ? `$${bonusNum.toLocaleString("en-US")}`
    : null;

  const parts: string[] = [];
  if (year != null && !Number.isNaN(year)) parts.push(String(year));
  if (round != null || pick != null) {
    const rd = round != null ? `Rd ${round}` : null;
    const pk = pick != null ? `Pick ${pick}` : null;
    parts.push([rd, pk].filter(Boolean).join(", "));
  }
  if (team) parts.push(team);
  const display = parts.length ? parts.join(" · ") : null;
  if (!display && !school) return null;

  return { year, round, pick, team, school, signingBonus, display };
}

const MILB_SPORT_IDS = [11, 12, 13, 14, 15, 16] as const;

async function fetchYearByYearForSport(
  playerId: number,
  group: "hitting" | "pitching",
  sportId: number,
): Promise<MlbPlayerSeasonRow[]> {
  try {
    const raw = (await mlbGet(`people/${playerId}/stats`, {
      stats: "yearByYear",
      group,
      sportId: String(sportId),
    })) as {
      stats?: {
        splits?: {
          season?: string;
          team?: { id?: number; name?: string; abbreviation?: string };
          sport?: { id?: number; abbreviation?: string; name?: string };
          stat?: Record<string, unknown>;
        }[];
      }[];
    };
    const keys = group === "pitching" ? PITCH_KEYS : HIT_KEYS;
    const rows: MlbPlayerSeasonRow[] = [];
    for (const s of raw.stats?.[0]?.splits ?? []) {
      const season = Number(s.season);
      if (!Number.isFinite(season)) continue;
      const stats = pickStats(s.stat, keys);
      if (!stats.length) continue;
      rows.push({
        season,
        teamId: s.team?.id ?? null,
        team: s.team?.abbreviation || s.team?.name || "—",
        sportId: s.sport?.id ?? sportId,
        sportAbbrev: s.sport?.abbreviation || (sportId === 1 ? "MLB" : "MiLB"),
        stats,
      });
    }
    return rows;
  } catch {
    return [];
  }
}

async function fetchYearByYearRows(
  playerId: number,
  group: "hitting" | "pitching",
  preferSportId?: number | null,
): Promise<MlbPlayerSeasonRow[]> {
  // Prefer current club sport + MLB first so MiLB cards populate even if later
  // league calls are slow/empty.
  const order = [
    preferSportId && preferSportId !== 1 ? preferSportId : null,
    1,
    ...MILB_SPORT_IDS.filter((sid) => sid !== preferSportId),
  ].filter((sid): sid is number => sid != null);

  const parts = await Promise.all(
    order.map((sid) => fetchYearByYearForSport(playerId, group, sid)),
  );
  const rows = parts.flat();
  rows.sort(
    (a, b) =>
      b.season - a.season ||
      a.sportId - b.sportId ||
      a.team.localeCompare(b.team),
  );
  return rows;
}

async function fetchSeasonStatLines(
  playerId: number,
  group: "hitting" | "pitching",
  season: number,
  sportId: number,
): Promise<MlbPlayerStatLine[]> {
  try {
    const raw = (await mlbGet(`people/${playerId}/stats`, {
      stats: "season",
      group,
      season: String(season),
      sportId: String(sportId),
    })) as {
      stats?: { splits?: { stat?: Record<string, unknown> }[] }[];
    };
    const keys = group === "pitching" ? PITCH_KEYS : HIT_KEYS;
    return pickStats(raw.stats?.[0]?.splits?.[0]?.stat, keys);
  } catch {
    return [];
  }
}

async function resolveTeamSport(
  teamId: number | null,
): Promise<{ sportId: number | null; sportName: string | null; sportAbbrev: string | null }> {
  if (teamId == null) return { sportId: null, sportName: null, sportAbbrev: null };
  try {
    const raw = (await mlbGet(`teams/${teamId}`, { hydrate: "sport" })) as {
      teams?: { sport?: { id?: number; name?: string; abbreviation?: string } }[];
    };
    const sport = raw.teams?.[0]?.sport;
    return {
      sportId: sport?.id ?? null,
      sportName: sport?.name ?? null,
      sportAbbrev: sport?.abbreviation ?? null,
    };
  } catch {
    return { sportId: null, sportName: null, sportAbbrev: null };
  }
}

export async function fetchMlbPlayer(playerId: number | string): Promise<MlbPlayerCard> {
  const season = currentSeason();
  const id = Number(playerId);
  const raw = (await mlbGet(`people/${id}`, {
    hydrate: `currentTeam,draft,education,stats(group=[hitting,pitching],type=[season,career],season=${season})`,
  })) as {
    people?: {
      id?: number;
      fullName?: string;
      firstName?: string;
      useName?: string;
      middleName?: string;
      lastName?: string;
      primaryNumber?: string;
      primaryPosition?: { abbreviation?: string; name?: string };
      batSide?: { code?: string; description?: string };
      pitchHand?: { code?: string; description?: string };
      height?: string;
      weight?: number;
      birthDate?: string;
      currentAge?: number;
      birthCity?: string;
      birthStateProvince?: string;
      birthCountry?: string;
      mlbDebutDate?: string;
      draftYear?: number;
      drafts?: {
        year?: string | number;
        pickRound?: string;
        pickNumber?: number;
        signingBonus?: string;
        school?: { name?: string };
        team?: { name?: string; abbreviation?: string };
      }[];
      education?: {
        highschools?: { name?: string; city?: string; state?: string }[];
        colleges?: { name?: string }[];
      };
      currentTeam?: {
        id?: number;
        name?: string;
        abbreviation?: string;
        sport?: { id?: number; name?: string; abbreviation?: string };
      };
      stats?: {
        group?: { displayName?: string };
        type?: { displayName?: string };
        splits?: { stat?: Record<string, unknown> }[];
      }[];
    }[];
  };

  const p = raw.people?.[0];
  if (!p) throw new Error("Player not found");

  let hitting: MlbPlayerStatLine[] = [];
  let pitching: MlbPlayerStatLine[] = [];
  let careerHitting: MlbPlayerStatLine[] = [];
  let careerPitching: MlbPlayerStatLine[] = [];

  for (const s of p.stats ?? []) {
    const group = (s.group?.displayName ?? "").toLowerCase();
    const type = (s.type?.displayName ?? "").toLowerCase();
    const stat = s.splits?.[0]?.stat;
    if (group.includes("hitting")) {
      if (type.includes("career")) careerHitting = pickStats(stat, HIT_KEYS);
      else if (type.includes("season") || !type.includes("year")) hitting = pickStats(stat, HIT_KEYS);
    }
    if (group.includes("pitching")) {
      if (type.includes("career")) careerPitching = pickStats(stat, PITCH_KEYS);
      else if (type.includes("season") || !type.includes("year")) pitching = pickStats(stat, PITCH_KEYS);
    }
  }

  const place = [p.birthCity, p.birthStateProvince, p.birthCountry].filter(Boolean).join(", ");
  const teamId = p.currentTeam?.id ?? null;
  const teamSport =
    p.currentTeam?.sport?.id != null
      ? {
          sportId: p.currentTeam.sport.id,
          sportName: p.currentTeam.sport.name ?? null,
          sportAbbrev: p.currentTeam.sport.abbreviation ?? null,
        }
      : await resolveTeamSport(teamId);

  const currentSportId = teamSport.sportId;
  const isMinorsNow = currentSportId != null && currentSportId !== 1;

  // Clear hydrate season lines when the player is on a MiLB club — those splits are
  // usually empty/MLB-scoped and would mask real affiliate stats.
  if (isMinorsNow) {
    hitting = [];
    pitching = [];
  }

  const [yearByYearHitting, yearByYearPitching, mlbHitting, mlbPitching, minorsHittingRaw, minorsPitchingRaw] =
    await Promise.all([
      fetchYearByYearRows(id, "hitting", currentSportId),
      fetchYearByYearRows(id, "pitching", currentSportId),
      hitting.length && !isMinorsNow
        ? Promise.resolve(hitting)
        : fetchSeasonStatLines(id, "hitting", season, 1),
      pitching.length && !isMinorsNow
        ? Promise.resolve(pitching)
        : fetchSeasonStatLines(id, "pitching", season, 1),
      isMinorsNow && currentSportId
        ? fetchSeasonStatLines(id, "hitting", season, currentSportId)
        : (async () => {
            for (const sid of MILB_SPORT_IDS) {
              const rows = await fetchSeasonStatLines(id, "hitting", season, sid);
              if (rows.length) return rows;
            }
            return [] as MlbPlayerStatLine[];
          })(),
      isMinorsNow && currentSportId
        ? fetchSeasonStatLines(id, "pitching", season, currentSportId)
        : (async () => {
            for (const sid of MILB_SPORT_IDS) {
              const rows = await fetchSeasonStatLines(id, "pitching", season, sid);
              if (rows.length) return rows;
            }
            return [] as MlbPlayerStatLine[];
          })(),
    ]);

  const minorsHitting = minorsHittingRaw;
  const minorsPitching = minorsPitchingRaw;

  // Level toggle only when the player has current-season lines in both.
  const hasMlbStats = mlbHitting.length > 0 || mlbPitching.length > 0;
  const hasMinorsStats = minorsHitting.length > 0 || minorsPitching.length > 0;

  const defaultLevel: MlbPlayerLevel = isMinorsNow
    ? "minors"
    : hasMlbStats || !hasMinorsStats
      ? "mlb"
      : "minors";

  // Surface current-level season lines as the primary strip.
  hitting = defaultLevel === "minors" ? minorsHitting : mlbHitting;
  pitching = defaultLevel === "minors" ? minorsPitching : mlbPitching;

  const hs = p.education?.highschools?.[0];
  const college = p.education?.colleges?.[0];
  let draft = formatDraft(p.drafts?.[0]);
  if (!draft && p.draftYear != null) {
    draft = {
      year: p.draftYear,
      round: null,
      pick: null,
      team: null,
      school: null,
      signingBonus: null,
      display: String(p.draftYear),
    };
  }
  // ESPN fills round/pick when MLB hydrate only has the year
  if (!draft?.round || draft.pick == null) {
    try {
      const espnLine = await fetchEspnDraftLine(p.fullName ?? "");
      if (espnLine) {
        // e.g. "2024: Rd 1, Pk 7 (STL)"
        const m = espnLine.match(
          /(\d{4})\s*:\s*Rd\s*([^,]+),\s*Pk\s*(\d+)\s*(?:\(([^)]+)\))?/i,
        );
        if (m) {
          const year = Number(m[1]);
          const round = m[2].trim();
          const pick = Number(m[3]);
          const team = m[4]?.trim() ?? draft?.team ?? null;
          const display = [String(year), `Rd ${round}, Pick ${pick}`, team]
            .filter(Boolean)
            .join(" · ");
          draft = {
            year,
            round,
            pick,
            team,
            school: draft?.school ?? null,
            signingBonus: draft?.signingBonus ?? null,
            display,
          };
        } else if (!draft?.display) {
          draft = {
            year: p.draftYear ?? null,
            round: null,
            pick: null,
            team: null,
            school: draft?.school ?? null,
            signingBonus: null,
            display: espnLine,
          };
        }
      }
    } catch {
      // optional
    }
  }

  const school = college?.name
    ? college.name
    : draft?.school
      ? draft.school
      : hs
        ? [hs.name, hs.city, hs.state].filter(Boolean).join(", ")
        : null;

  return {
    id: p.id ?? id,
    name: p.fullName ?? "—",
    firstName: p.firstName ?? "",
    useName: p.useName ?? p.middleName ?? p.firstName ?? "",
    lastName: p.lastName ?? "",
    number: p.primaryNumber ?? null,
    position: p.primaryPosition?.abbreviation ?? null,
    positionName: p.primaryPosition?.name ?? null,
    bats: p.batSide?.code ?? null,
    throws: p.pitchHand?.code ?? null,
    height: p.height ?? null,
    weight: p.weight != null ? String(p.weight) : null,
    birthDate: p.birthDate ?? null,
    age: p.currentAge ?? ageFromBirthDate(p.birthDate),
    birthPlace: place || null,
    mlbDebut: p.mlbDebutDate ?? null,
    draftYear: draft?.year ?? p.draftYear ?? null,
    draft,
    school,
    teamId,
    teamName: p.currentTeam?.name ?? null,
    teamAbbrev: p.currentTeam?.abbreviation ?? null,
    sportId: currentSportId,
    sportName: teamSport.sportName,
    sportAbbrev: teamSport.sportAbbrev,
    defaultLevel,
    hasMlbStats,
    hasMinorsStats,
    primaryColor: teamId != null ? TEAM_COLORS[teamId] ?? "d9515c" : "d9515c",
    headshot: mlbHeadshot(p.id ?? id, 426),
    actionShot: mlbActionShot(p.id ?? id),
    heroBackdrop: mlbHeroBackdrop(p.id ?? id),
    hitting,
    pitching,
    mlbHitting,
    mlbPitching,
    minorsHitting,
    minorsPitching,
    careerHitting,
    careerPitching,
    yearByYearHitting,
    yearByYearPitching,
    season,
  };
}

export type MlbPlayoffRow = {
  team: string;
  teamId: number;
  record: string;
  playoffPercent: string;
  wildCardPercent: string | null;
  division: string;
};

export function playoffOddsFromStandings(tables: MlbDivisionTable[]): MlbPlayoffRow[] {
  const rows: MlbPlayoffRow[] = [];
  for (const t of tables) {
    for (const r of t.rows) {
      if (!r.playoffPercent) continue;
      rows.push({
        team: r.team,
        teamId: r.teamId,
        record: `${r.wins}-${r.losses}`,
        playoffPercent: r.playoffPercent,
        wildCardPercent: r.wildCardPercent,
        division: t.shortName,
      });
    }
  }
  const num = (s: string) => parseFloat(s.replace("%", "")) || 0;
  rows.sort((a, b) => num(b.playoffPercent) - num(a.playoffPercent));
  return rows;
}

export type MlbWildCardRow = {
  rank: string;
  teamId: number;
  team: string;
  abbrev: string;
  wins: number;
  losses: number;
  pct: string;
  wcgb: string;
  l10: string;
  streak: string;
  runsScored: number;
  runsAllowed: number;
  runDiff: number;
};

/** NL or AL wild-card board from MLB Stats API. */
export async function fetchMlbWildCardStandings(
  leagueId: 103 | 104 = 104,
): Promise<MlbWildCardRow[]> {
  const season = currentSeason();
  const raw = (await mlbGet("standings", {
    leagueId: String(leagueId),
    season: String(season),
    standingsTypes: "wildCard",
    hydrate: "team",
  })) as {
    records?: {
      teamRecords?: {
        wildCardRank?: string;
        wildCardGamesBack?: string;
        wins?: number;
        losses?: number;
        leagueRecord?: { wins?: number; losses?: number; pct?: string };
        team?: { id?: number; name?: string; abbreviation?: string; teamName?: string };
        winningPercentage?: string;
        streak?: { streakCode?: string };
        runsScored?: number;
        runsAllowed?: number;
        runDifferential?: number;
        records?: {
          splitRecords?: { type?: string; wins?: number; losses?: number; pct?: string }[];
        };
      }[];
    }[];
  };

  const rows: MlbWildCardRow[] = [];
  for (const block of raw.records ?? []) {
    for (const r of block.teamRecords ?? []) {
      const name = r.team?.name ?? "—";
      const wcgb = r.wildCardGamesBack;
      const lastTen = r.records?.splitRecords?.find((s) => s.type === "lastTen");
      const rs = r.runsScored ?? 0;
      const ra = r.runsAllowed ?? 0;
      rows.push({
        rank: String(r.wildCardRank ?? ""),
        teamId: r.team?.id ?? 0,
        team: name.replace(
          /^(St\. Louis|Chicago|New York|Los Angeles|Tampa Bay|Kansas City|San Francisco|San Diego|Toronto) /,
          "",
        ),
        abbrev: r.team?.abbreviation ?? "",
        wins: r.wins ?? r.leagueRecord?.wins ?? 0,
        losses: r.losses ?? r.leagueRecord?.losses ?? 0,
        pct: r.winningPercentage ?? r.leagueRecord?.pct ?? "",
        wcgb: !wcgb || wcgb === "-" || wcgb === "0" || wcgb === "0.0" ? "—" : String(wcgb),
        l10: lastTen ? `${lastTen.wins ?? 0}-${lastTen.losses ?? 0}` : "—",
        streak: r.streak?.streakCode ?? "—",
        runsScored: rs,
        runsAllowed: ra,
        runDiff: r.runDifferential ?? rs - ra,
      });
    }
  }
  rows.sort((a, b) => Number(a.rank || 99) - Number(b.rank || 99));
  return rows;
}

/** Featured game plus the next unfinished Cardinals (or any team) matchup. */
export async function fetchTeamCurrentAndNextGames(teamId: number): Promise<{
  current: MlbScoreGame | null;
  next: MlbScoreGame | null;
}> {
  const current = await fetchTeamCurrentGame(teamId);
  const date = chicagoToday();
  const season = currentSeason();
  const raw = (await mlbGet("schedule", {
    sportId: "1",
    teamId: String(teamId),
    startDate: date,
    endDate: `${season}-11-15`,
    hydrate: "linescore,team,probablePitcher,venue",
  })) as {
    dates?: {
      date?: string;
      games?: {
        gamePk?: number;
        status?: { abstractGameState?: string };
      }[];
    }[];
  };

  let next: MlbScoreGame | null = null;
  for (const day of raw.dates ?? []) {
    if (!day.date) continue;
    for (const g of day.games ?? []) {
      if (!g.gamePk) continue;
      if (current && String(g.gamePk) === current.id) continue;
      if (g.status?.abstractGameState === "Final") continue;
      const board = await fetchMlbScoreboard(day.date);
      const hit = board.find((x) => x.id === String(g.gamePk) && !x.final);
      if (hit) {
        next = hit;
        break;
      }
    }
    if (next) break;
  }
  return { current, next };
}

export async function fetchMlbPlayerGameLog(
  playerId: number | string,
  group: "hitting" | "pitching",
  limit = 10,
  season = currentSeason(),
  sportId?: number | null,
): Promise<MlbGameLogEntry[]> {
  const id = Number(playerId);
  const keys = group === "pitching" ? SPLIT_PITCH_KEYS : SPLIT_HIT_KEYS;
  const params: Record<string, string> = {
    stats: "gameLog",
    group,
    season: String(season),
    gameType: "R",
  };
  if (sportId != null && sportId > 0) params.sportId = String(sportId);
  const raw = (await mlbGet(`people/${id}/stats`, params)) as {
    stats?: {
      splits?: {
        date?: string;
        isHome?: boolean;
        isWin?: boolean;
        opponent?: { id?: number; name?: string; abbreviation?: string };
        game?: { gamePk?: number };
        stat?: Record<string, unknown>;
      }[];
    }[];
  };
  const splits = raw.stats?.[0]?.splits ?? [];
  return splits
    .slice()
    .reverse()
    .slice(0, limit)
    .map((s) => {
      const oppName =
        s.opponent?.abbreviation ||
        (s.opponent?.name ?? "OPP").replace(
          /^(St\. Louis|New York|Los Angeles|Chicago|Tampa Bay|Kansas City|San Francisco|San Diego|Toronto) /,
          "",
        );
      return {
        date: s.date ?? "",
        gamePk: s.game?.gamePk ?? 0,
        opponent: oppName,
        opponentId: s.opponent?.id ?? null,
        isHome: Boolean(s.isHome),
        isWin: s.isWin ?? null,
        summary: String(s.stat?.summary ?? ""),
        stats: pickStats(s.stat, keys.slice(0, 8)),
      };
    });
}

export type MlbPerformanceSummary = {
  latestTitle: string;
  latestLine: string;
  recentTitle: string;
  recentLine: string;
  isPitcher: boolean;
  latestIsWin: boolean | null;
  spark: { label: string; good: boolean | null }[];
};

function fmtGameDateLabel(iso: string): string {
  if (!iso) return "Latest game";
  const label = formatSportsDateLong(iso);
  return label || iso;
}

function statValue(stats: MlbPlayerStatLine[], label: string): string | null {
  return stats.find((s) => s.label === label)?.value ?? null;
}

/** Template blurb from MLB stats — no LLM / tokens. */
export function buildPlayerPerformanceSummary(input: {
  isPitcher: boolean;
  latest: MlbGameLogEntry | null | undefined;
  last5: MlbRecentBlock | null | undefined;
}): MlbPerformanceSummary | null {
  const latest = input.latest;
  const last5 = input.last5;
  if (!latest && !last5) return null;

  let latestTitle = "That day";
  let latestLine = "No game log yet this season.";
  if (latest) {
    const when = fmtGameDateLabel(latest.date);
    const vs = `${latest.isHome ? "vs" : "@"} ${latest.opponent || "OPP"}`;
    latestTitle = when;
    if (latest.summary?.trim()) {
      latestLine = `${vs}: ${latest.summary.trim()}`;
    } else if (input.isPitcher) {
      const bits = [
        statValue(latest.stats, "IP") ? `${statValue(latest.stats, "IP")} IP` : null,
        statValue(latest.stats, "H") != null ? `${statValue(latest.stats, "H")} H` : null,
        statValue(latest.stats, "ER") != null ? `${statValue(latest.stats, "ER")} ER` : null,
        statValue(latest.stats, "BB") != null ? `${statValue(latest.stats, "BB")} BB` : null,
        statValue(latest.stats, "SO") != null ? `${statValue(latest.stats, "SO")} K` : null,
      ].filter(Boolean);
      latestLine = bits.length ? `${vs}: ${bits.join(", ")}` : `${vs}: line unavailable`;
    } else {
      const ab = statValue(latest.stats, "AB");
      const h = statValue(latest.stats, "H");
      const bits = [
        ab != null && h != null ? `${h}-for-${ab}` : null,
        statValue(latest.stats, "HR") && statValue(latest.stats, "HR") !== "0"
          ? `${statValue(latest.stats, "HR")} HR`
          : null,
        statValue(latest.stats, "RBI") && statValue(latest.stats, "RBI") !== "0"
          ? `${statValue(latest.stats, "RBI")} RBI`
          : null,
        statValue(latest.stats, "BB") && statValue(latest.stats, "BB") !== "0"
          ? `${statValue(latest.stats, "BB")} BB`
          : null,
        statValue(latest.stats, "SO") && statValue(latest.stats, "SO") !== "0"
          ? `${statValue(latest.stats, "SO")} K`
          : null,
      ].filter(Boolean);
      latestLine = bits.length ? `${vs}: ${bits.join(", ")}` : `${vs}: line unavailable`;
    }
  }

  let recentTitle = "Recent";
  let recentLine = "Recent form unavailable.";
  if (last5?.stats?.length) {
    const g = last5.games || 5;
    recentTitle = `Last ${g}`;
    if (input.isPitcher) {
      const bits = [
        statValue(last5.stats, "ERA") ? `${statValue(last5.stats, "ERA")} ERA` : null,
        statValue(last5.stats, "WHIP") ? `${statValue(last5.stats, "WHIP")} WHIP` : null,
        statValue(last5.stats, "IP") ? `${statValue(last5.stats, "IP")} IP` : null,
        statValue(last5.stats, "SO") ? `${statValue(last5.stats, "SO")} K` : null,
        statValue(last5.stats, "BB") != null ? `${statValue(last5.stats, "BB")} BB` : null,
      ].filter(Boolean);
      recentLine = bits.length
        ? `${bits.join(" · ")} over ${g} appearance${g === 1 ? "" : "s"}`
        : `Last ${g} appearances loaded`;
    } else {
      const bits = [
        statValue(last5.stats, "AVG") ? `${statValue(last5.stats, "AVG")} AVG` : null,
        (() => {
          const h = statValue(last5.stats, "H");
          const ab = statValue(last5.stats, "AB");
          return h != null && ab != null ? `${h}-for-${ab}` : null;
        })(),
        statValue(last5.stats, "HR") != null ? `${statValue(last5.stats, "HR")} HR` : null,
        statValue(last5.stats, "RBI") != null ? `${statValue(last5.stats, "RBI")} RBI` : null,
        statValue(last5.stats, "OPS") ? `${statValue(last5.stats, "OPS")} OPS` : null,
      ].filter(Boolean);
      recentLine = bits.length
        ? `${bits.join(" · ")} over ${g} game${g === 1 ? "" : "s"}`
        : `Last ${g} games loaded`;
    }
  }

  return {
    latestTitle,
    latestLine,
    recentTitle,
    recentLine,
    isPitcher: input.isPitcher,
    latestIsWin: latest?.isWin ?? null,
    spark: [],
  };
}

async function invokeSports<T extends Record<string, unknown>>(
  body: Record<string, unknown>,
): Promise<T | null> {
  const usable = (data: unknown): data is T =>
    Boolean(data) &&
    typeof data === "object" &&
    !(data as { error?: string }).error;

  try {
    const { data, error } = await supabase.functions.invoke("sports", { body });
    // supabase-js sometimes sets `error` on non-2xx even when the JSON body is fine.
    if (usable(data)) return data;
    if (error && !data) {
      /* fall through */
    }
  } catch {
    /* fall through to direct fetch */
  }
  try {
    const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (!base || !key) return null;
    const res = await fetch(`${base}/functions/v1/sports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        apikey: key,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as T & { error?: string };
    if (!usable(data)) return null;
    return data;
  } catch {
    return null;
  }
}

function isShortLeashContract(note: string | null | undefined): boolean {
  if (!note) return false;
  return /\b(1[\s-]?year|one[\s-]?year|1\s*yr\b|single[\s-]?year|interim)\b/i.test(note);
}

/** Public-reporting estimates when BBRef/Spotrac blurbs are thin. */
const KNOWN_MANAGER_CONTRACTS: Record<
  string,
  { note: string; startYear?: number; endYear?: number; totalYears?: number }
> = {
  "dave roberts": {
    note: "Leads the industry at roughly $8.1–8.3M per year on a four-year Dodgers extension through 2028.",
    startYear: 2025,
    endYear: 2028,
    totalYears: 4,
  },
  "craig counsell": {
    note: "Second-highest at $8M annually via a historic five-year, $40M Cubs deal through 2028.",
    startYear: 2024,
    endYear: 2028,
    totalYears: 5,
  },
  "alex cora": {
    note: "Earns about $7.3M annually on a Red Sox extension through the 2027 season.",
    startYear: 2025,
    endYear: 2027,
    totalYears: 3,
  },
  "torey lovullo": {
    note: "Makes roughly $5M per year on a multi-year Diamondbacks extension through 2026.",
    startYear: 2023,
    endYear: 2026,
    totalYears: 4,
  },
  "bruce bochy": {
    note: "Sits around $4.5M annually with the Rangers (deal runs through 2026).",
    startYear: 2023,
    endYear: 2026,
    totalYears: 4,
  },
  "aaron boone": {
    note: "Sits around $4.5M annually with the Yankees on a multi-year extension through 2027.",
    startYear: 2025,
    endYear: 2027,
    totalYears: 3,
  },
  "terry francona": {
    note: "Multi-year Reds deal reported around $4M+ annually; in the early years of the Cincinnati stint.",
    startYear: 2025,
    endYear: 2027,
    totalYears: 3,
  },
  "oliver marmol": {
    note: "Cardinals skipper on a club-friendly extension; roughly mid-tier AAV with years remaining through 2026.",
    startYear: 2024,
    endYear: 2026,
    totalYears: 3,
  },
  "rob thomson": {
    note: "Phillies manager on a multi-year extension after the 2022–23 title run; deal through 2026.",
    startYear: 2023,
    endYear: 2026,
    totalYears: 4,
  },
  "aj hinch": {
    note: "Astros manager under a multi-year Houston deal.",
    startYear: 2025,
    endYear: 2027,
    totalYears: 3,
  },
  "a.j. hinch": {
    note: "Astros manager under a multi-year Houston deal.",
    startYear: 2025,
    endYear: 2027,
    totalYears: 3,
  },
  "john schneider": {
    note: "Blue Jays skipper on a multi-year extension; still early in the Toronto deal.",
    startYear: 2024,
    endYear: 2027,
    totalYears: 4,
  },
  "brandon hyde": {
    note: "Orioles manager on a multi-year extension after the AL East turnaround.",
    startYear: 2023,
    endYear: 2026,
    totalYears: 4,
  },
  "stephen vogt": {
    note: "Guardians first-time skipper on an initial multi-year deal.",
    startYear: 2024,
    endYear: 2026,
    totalYears: 3,
  },
  "pat murphy": {
    note: "Brewers manager on a multi-year deal after succeeding Counsell.",
    startYear: 2024,
    endYear: 2026,
    totalYears: 3,
  },
  "matt quatraro": {
    note: "Royals manager on a multi-year Kansas City deal.",
    startYear: 2023,
    endYear: 2026,
    totalYears: 4,
  },
  "skip schumaker": {
    note: "Rangers skipper; contract terms vary by club reporting — treated as multi-year when listed.",
    startYear: 2026,
    endYear: 2027,
    totalYears: 2,
  },
};

function normalizeManagerKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function knownManagerContract(
  name: string,
): { note: string; startYear?: number; endYear?: number; totalYears?: number } | null {
  const key = normalizeManagerKey(name);
  return KNOWN_MANAGER_CONTRACTS[key] ?? null;
}

/** Infer "Year X of Y" from a free-text contract note + tenure. */
export function parseManagerContractTerm(
  note: string | null | undefined,
  season: number,
  yearsWithTeam: number,
  known?: { startYear?: number; endYear?: number; totalYears?: number } | null,
): MlbManagerContractTerm | null {
  const text = (note ?? "").trim();
  const yearsMatch = text.match(/(\d+)\s*-\s*year/i);
  const through = text.match(/through(?:\s+the)?\s+(20\d{2})/i);
  const finalYear = /\bfinal year\b/i.test(text);
  const interim = /\binterim\b/i.test(text);

  let totalYears =
    known?.totalYears ?? (yearsMatch ? Number(yearsMatch[1]) : null);
  let endYear =
    known?.endYear ?? (through ? Number(through[1]) : finalYear ? season : null);
  let startYear = known?.startYear ?? null;

  if (interim) {
    return {
      yearOf: 1,
      of: 1,
      throughYear: season,
      label: "Interim · year 1 of 1",
    };
  }

  if (startYear == null && endYear != null && totalYears != null) {
    startYear = endYear - totalYears + 1;
  }
  if (startYear == null && totalYears != null) {
    // Fall back: assume current tenure tracks the deal so far.
    startYear = season - Math.min(yearsWithTeam, totalYears) + 1;
  }
  if (startYear == null && yearsWithTeam > 0 && endYear != null) {
    startYear = Math.max(endYear - 9, season - yearsWithTeam + 1);
  }
  if (startYear == null && totalYears == null && endYear == null) {
    if (!text && !known) return null;
    return {
      yearOf: yearsWithTeam,
      of: null,
      throughYear: null,
      label: `Year ${yearsWithTeam} with club`,
    };
  }

  if (totalYears == null && startYear != null && endYear != null) {
    totalYears = endYear - startYear + 1;
  }
  if (endYear == null && startYear != null && totalYears != null) {
    endYear = startYear + totalYears - 1;
  }

  const yearOf =
    startYear != null
      ? Math.min(
          Math.max(1, season - startYear + 1),
          totalYears ?? Math.max(1, season - startYear + 1),
        )
      : yearsWithTeam;

  const parts: string[] = [];
  if (totalYears != null) parts.push(`Year ${yearOf} of ${totalYears}`);
  else parts.push(`Year ${yearOf}`);
  if (endYear != null) parts.push(`through ${endYear}`);

  return {
    yearOf,
    of: totalYears,
    throughYear: endYear,
    label: parts.join(" · "),
  };
}

function resolveManagerContractNote(
  name: string,
  scraped: string | null,
): { note: string | null; known: ReturnType<typeof knownManagerContract> } {
  const known = knownManagerContract(name);
  const scrapedTrim = scraped?.trim() || null;
  if (scrapedTrim && scrapedTrim.length >= 20) {
    // Prefer scraped when it's substantive; still keep known dates for year math.
    return { note: scrapedTrim, known };
  }
  if (known) return { note: known.note, known };
  return { note: scrapedTrim, known: null };
}

async function fetchManagerContractNote(name: string): Promise<string | null> {
  const data = await invokeSports<{ contractStatus?: string | null }>({
    action: "contract",
    name,
  });
  return data?.contractStatus ?? null;
}

type WikiCard = { extract: string | null; image: string | null };

function cleanWikiImage(url: string | null | undefined): string | null {
  if (!url) return null;
  // Drop tracking params; prefer full commons URL.
  return url.replace(/\?utm_source=.*$/, "").trim() || null;
}

async function fetchWikipediaCard(name: string): Promise<WikiCard> {
  const titles = [
    name.trim(),
    `${name.trim()} (baseball)`,
    `${name.trim()} (baseball manager)`,
  ];
  for (const title of titles) {
    try {
      // MediaWiki API is more reliable for pageimages than REST summary.
      const api = new URL("https://en.wikipedia.org/w/api.php");
      api.searchParams.set("action", "query");
      api.searchParams.set("titles", title);
      api.searchParams.set("prop", "pageimages|extracts");
      api.searchParams.set("exintro", "1");
      api.searchParams.set("explaintext", "1");
      api.searchParams.set("pithumbsize", "640");
      api.searchParams.set("pilicense", "any");
      api.searchParams.set("format", "json");
      api.searchParams.set("origin", "*");
      const res = await fetch(api.toString());
      if (!res.ok) continue;
      const data = (await res.json()) as {
        query?: {
          pages?: Record<
            string,
            {
              missing?: boolean;
              extract?: string;
              thumbnail?: { source?: string };
              original?: { source?: string };
            }
          >;
        };
      };
      const page = Object.values(data.query?.pages ?? {})[0];
      if (!page || page.missing) continue;
      const image = cleanWikiImage(page.original?.source ?? page.thumbnail?.source);
      const extract = page.extract?.trim() || null;
      if (image || extract) return { extract, image };
    } catch {
      /* try next title */
    }
  }
  // REST fallback
  try {
    const title = name.trim().replace(/\s+/g, "_");
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return { extract: null, image: null };
    const data = (await res.json()) as {
      extract?: string;
      type?: string;
      thumbnail?: { source?: string };
      originalimage?: { source?: string };
    };
    if (data.type === "disambiguation") return { extract: null, image: null };
    return {
      extract: data.extract?.trim() || null,
      image: cleanWikiImage(data.originalimage?.source ?? data.thumbnail?.source),
    };
  } catch {
    return { extract: null, image: null };
  }
}

async function fetchManagerPhotoMeta(name: string): Promise<{
  photo: string | null;
  interim: boolean;
  shortLeash: boolean;
  yearWins: number | null;
  yearLosses: number | null;
  contractNote: string | null;
}> {
  const data = await invokeSports<{
    photo?: string | null;
    interim?: boolean;
    shortLeash?: boolean;
    yearWins?: number | null;
    yearLosses?: number | null;
    contractNote?: string | null;
  }>({
    action: "managerPhoto",
    name,
  });
  return {
    photo: data?.photo ?? null,
    interim: Boolean(data?.interim),
    shortLeash: Boolean(data?.shortLeash),
    yearWins: typeof data?.yearWins === "number" ? data.yearWins : null,
    yearLosses: typeof data?.yearLosses === "number" ? data.yearLosses : null,
    contractNote: data?.contractNote?.trim() || null,
  };
}

async function fetchManagerPhoto(name: string): Promise<string | null> {
  return (await fetchManagerPhotoMeta(name)).photo;
}

export type MlbManagerFiredOdds = {
  source: string;
  checkedAt: string | null;
  items: {
    name: string;
    team?: string | null;
    oddsAmerican: string;
    impliedPct: number | null;
    source: string;
    url: string;
    ticker?: string;
  }[];
};

export type MlbManagerMotyOdds = {
  source: string;
  checkedAt: string | null;
  items: {
    name: string;
    league: "AL" | "NL";
    oddsAmerican: string;
    impliedPct: number;
    source: string;
    url: string;
    ticker?: string;
  }[];
};

function kalshiDollarProbClient(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n === 0) return 0;
  return Math.max(0.01, Math.min(0.99, n));
}

function kalshiAmericanClient(p: number): string {
  return p >= 0.5
    ? `-${Math.round((100 * p) / (1 - p))}`
    : `+${Math.round((100 * (1 - p)) / p)}`;
}

/** Browser/Node fallback when the sports edge is down — Kalshi is usually open. */
async function fetchKalshiManagerFiredOddsDirect(): Promise<MlbManagerFiredOdds["items"]> {
  try {
    const res = await fetch(
      "https://api.elections.kalshi.com/trade-api/v2/markets?limit=100&status=open&series_ticker=KXCOACHOUTMLB",
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      markets?: {
        ticker?: string;
        subtitle?: string;
        yes_bid_dollars?: string | null;
        yes_ask_dollars?: string | null;
        last_price_dollars?: string | null;
        yes_sub_title?: string | null;
        no_sub_title?: string | null;
        custom_strike?: { Coach?: string; Team?: string; Person?: string } | null;
      }[];
    };
    const items: MlbManagerFiredOdds["items"] = [];
    for (const m of data.markets ?? []) {
      const name = (
        m.custom_strike?.Coach ??
        m.custom_strike?.Person ??
        m.yes_sub_title ??
        m.no_sub_title ??
        ""
      ).trim();
      if (!name || /field|any other|tie|co-?winner/i.test(name)) continue;
      const bid = kalshiDollarProbClient(m.yes_bid_dollars);
      const ask = kalshiDollarProbClient(m.yes_ask_dollars);
      const last = kalshiDollarProbClient(m.last_price_dollars);
      let p: number | null = null;
      if (bid != null && ask != null && (bid > 0 || ask > 0)) p = (bid + ask) / 2;
      else p = (ask && ask > 0 ? ask : null) ?? (bid && bid > 0 ? bid : null) ?? (last && last > 0 ? last : null);
      if (p == null || p <= 0) continue;
      const subtitle = (m.subtitle ?? "").replace(/^:+\s*/, "").trim();
      items.push({
        name,
        team: m.custom_strike?.Team ?? (subtitle || null),
        oddsAmerican: kalshiAmericanClient(p),
        impliedPct: Math.round(p * 1000) / 10,
        source: "Kalshi",
        url: `https://kalshi.com/markets/${(m.ticker ?? "").toLowerCase()}`,
        ticker: m.ticker ?? "",
      });
    }
    items.sort((a, b) => (b.impliedPct ?? 0) - (a.impliedPct ?? 0));
    return items;
  } catch {
    return [];
  }
}

async function fetchKalshiManagerMotyOddsDirect(): Promise<MlbManagerMotyOdds["items"]> {
  const items: MlbManagerMotyOdds["items"] = [];
  for (const s of [
    { ticker: "KXMLBALMOTY", league: "AL" as const },
    { ticker: "KXMLBNLMOTY", league: "NL" as const },
  ]) {
    try {
      const res = await fetch(
        `https://api.elections.kalshi.com/trade-api/v2/markets?limit=50&status=open&series_ticker=${s.ticker}`,
        { headers: { Accept: "application/json" } },
      );
      if (!res.ok) continue;
      const data = (await res.json()) as {
        markets?: {
          ticker?: string;
          yes_bid_dollars?: string | null;
          yes_ask_dollars?: string | null;
          last_price_dollars?: string | null;
          yes_sub_title?: string | null;
          no_sub_title?: string | null;
          custom_strike?: { Person?: string; Coach?: string } | null;
        }[];
      };
      for (const m of data.markets ?? []) {
        const name = (
          m.custom_strike?.Person ??
          m.custom_strike?.Coach ??
          m.yes_sub_title ??
          m.no_sub_title ??
          ""
        ).trim();
        if (!name || /tie|co-?winner|field|any other/i.test(name)) continue;
        const bid = kalshiDollarProbClient(m.yes_bid_dollars);
        const ask = kalshiDollarProbClient(m.yes_ask_dollars);
        const last = kalshiDollarProbClient(m.last_price_dollars);
        let p: number | null = null;
        if (bid != null && ask != null && (bid > 0 || ask > 0)) p = (bid + ask) / 2;
        else
          p =
            (ask && ask > 0 ? ask : null) ??
            (bid && bid > 0 ? bid : null) ??
            (last && last > 0 ? last : null);
        if (p == null || p <= 0) continue;
        items.push({
          name,
          league: s.league,
          oddsAmerican: kalshiAmericanClient(p),
          impliedPct: Math.round(p * 1000) / 10,
          source: "Kalshi",
          url: `https://kalshi.com/markets/${(m.ticker ?? "").toLowerCase()}`,
          ticker: m.ticker ?? "",
        });
      }
    } catch {
      /* next */
    }
  }
  items.sort((a, b) => b.impliedPct - a.impliedPct);
  return items;
}

export async function fetchManagerFiredOdds(): Promise<MlbManagerFiredOdds> {
  const data = await invokeSports<{
    source?: string;
    checkedAt?: string;
    items?: MlbManagerFiredOdds["items"];
  }>({ action: "managerFiredOdds" });
  let items = data?.items ?? [];
  if (!items.length) items = await fetchKalshiManagerFiredOddsDirect();
  return {
    source: items.length ? (data?.source ?? "Kalshi") : "none",
    checkedAt: data?.checkedAt ?? new Date().toISOString(),
    items,
  };
}

export async function fetchManagerMotyOdds(): Promise<MlbManagerMotyOdds> {
  const data = await invokeSports<{
    source?: string;
    checkedAt?: string;
    items?: MlbManagerMotyOdds["items"];
  }>({ action: "managerMotyOdds" });
  let items = data?.items ?? [];
  if (!items.length) items = await fetchKalshiManagerMotyOddsDirect();
  return {
    source: items.length ? (data?.source ?? "Kalshi") : "none",
    checkedAt: data?.checkedAt ?? new Date().toISOString(),
    items,
  };
}

function matchFiredOdds(
  managerName: string,
  items: MlbManagerFiredOdds["items"],
): { american: string; pct: number | null; url: string | null } | null {
  const want = normalizePersonName(managerName);
  const last = want.split(" ").slice(-1)[0] ?? "";
  const hit =
    items.find((it) => normalizePersonName(it.name) === want) ??
    items.find((it) => {
      const n = normalizePersonName(it.name);
      return last.length >= 4 && (n.endsWith(last) || n.includes(want));
    });
  if (!hit) return null;
  return { american: hit.oddsAmerican, pct: hit.impliedPct, url: hit.url || null };
}

function matchMotyOdds(
  managerName: string,
  items: MlbManagerMotyOdds["items"],
  preferLeague?: "AL" | "NL" | null,
): { american: string; pct: number; url: string | null; league: "AL" | "NL" } | null {
  const want = normalizePersonName(managerName);
  const last = want.split(" ").slice(-1)[0] ?? "";
  const matches = items.filter((it) => {
    const n = normalizePersonName(it.name);
    return n === want || (last.length >= 4 && (n.endsWith(last) || n.includes(want)));
  });
  if (!matches.length) return null;
  const preferred =
    (preferLeague && matches.find((m) => m.league === preferLeague)) ||
    [...matches].sort((a, b) => b.impliedPct - a.impliedPct)[0]!;
  return {
    american: preferred.oddsAmerican,
    pct: preferred.impliedPct,
    url: preferred.url || null,
    league: preferred.league,
  };
}

/** AL clubs — used to pick the right Manager of the Year market. */
const AL_TEAM_IDS = new Set([
  108, // LAA
  110, // BAL
  111, // BOS
  114, // CLE
  116, // DET
  117, // HOU
  118, // KC
  133, // ATH/OAK
  136, // SEA
  139, // TB
  140, // TEX
  141, // TOR
  142, // MIN
  145, // CWS
  147, // NYY
]);

function leagueForTeamId(teamId: number): "AL" | "NL" | null {
  if (!teamId) return null;
  if (AL_TEAM_IDS.has(teamId)) return "AL";
  // Remaining MLB clubs are NL.
  if (TEAM_COLORS[teamId]) return "NL";
  return null;
}

function isGenericMlbHeadshot(url: string | null | undefined): boolean {
  if (!url) return true;
  return /people:generic:headshot|\/generic\//i.test(url) || !/^https?:/i.test(url);
}

type CoachMgr = {
  job?: string;
  title?: string;
  person?: { id?: number; fullName?: string };
};

function coachRole(c: CoachMgr): string {
  return `${c.job || ""} ${c.title || ""}`.trim();
}

function isInterimManagerRole(role: string): boolean {
  return /\binterim\b/i.test(role) && /\bmanager\b/i.test(role);
}

function pickTeamManager(roster: CoachMgr[]): CoachMgr | null {
  // When MLB still lists a fired skipper as "Manager" beside an "Interim Manager",
  // the interim is the one actually running the club.
  const interim = roster.find((c) => isInterimManagerRole(coachRole(c)) && c.person?.id);
  if (interim) return interim;
  const primary = roster.find((c) => {
    const job = (c.job || "").trim();
    const title = (c.title || "").trim();
    return job === "Manager" || title === "Manager";
  });
  if (primary?.person?.id) return primary;
  return null;
}

async function managerIdForTeamSeason(
  teamId: number,
  season: number,
): Promise<number | null> {
  try {
    const coaches = (await mlbGet(`teams/${teamId}/coaches`, {
      season: String(season),
    })) as { roster?: CoachMgr[] };
    return pickTeamManager(coaches.roster ?? [])?.person?.id ?? null;
  } catch {
    return null;
  }
}

async function teamStandingForSeason(
  teamId: number,
  teamAbbrev: string,
  season: number,
): Promise<MlbManagerSeasonRecord | null> {
  try {
    const raw = (await mlbGet("standings", {
      leagueId: "103,104",
      season: String(season),
      standingsTypes: "regularSeason",
    })) as {
      records?: {
        teamRecords?: {
          team?: { id?: number; abbreviation?: string; name?: string };
          wins?: number;
          losses?: number;
          winningPercentage?: string;
          gamesBack?: string;
          divisionRank?: string;
        }[];
      }[];
    };
    for (const block of raw.records ?? []) {
      for (const r of block.teamRecords ?? []) {
        if (r.team?.id !== teamId) continue;
        return {
          season,
          team: r.team?.abbreviation ?? teamAbbrev,
          wins: r.wins ?? 0,
          losses: r.losses ?? 0,
          pct: r.winningPercentage ?? ".000",
          gb: r.gamesBack === "0.0" || r.gamesBack === "-" ? "—" : String(r.gamesBack ?? "—"),
          divisionRank: r.divisionRank ? Number(r.divisionRank) : null,
          postWins: 0,
          postLosses: 0,
          comments: "",
        };
      }
    }
  } catch {
    /* */
  }
  return null;
}

async function fetchManagerSeasonRecords(
  managerId: number,
  teamId: number,
  teamAbbrev: string,
  season: number,
): Promise<MlbManagerSeasonRecord[]> {
  const out: MlbManagerSeasonRecord[] = [];
  for (let y = season; y >= season - 20; y--) {
    const id = await managerIdForTeamSeason(teamId, y);
    if (id !== managerId) break;
    const st = await teamStandingForSeason(teamId, teamAbbrev, y);
    if (st) out.push(st);
    else {
      out.push({
        season: y,
        team: teamAbbrev,
        wins: 0,
        losses: 0,
        pct: "—",
        gb: "—",
        divisionRank: null,
        postWins: 0,
        postLosses: 0,
        comments: "",
      });
    }
  }
  return out;
}

/**
 * Year-by-year managerial record across every club — walks seasons backward
 * and checks all 30 teams. Survives gaps (e.g. Skip Schumaker MIA → TEX) and
 * does not depend on the Baseball Reference edge function.
 */
async function fetchManagerSeasonsAcrossTeams(
  managerId: number,
  season: number,
): Promise<MlbManagerSeasonRecord[]> {
  const teamsRaw = (await mlbGet("teams", {
    sportId: "1",
    season: String(season),
  })) as { teams?: { id?: number; abbreviation?: string }[] };
  const teams = (teamsRaw.teams ?? []).filter(
    (t): t is { id: number; abbreviation?: string } => typeof t.id === "number",
  );
  if (!teams.length) return [];

  const out: MlbManagerSeasonRecord[] = [];
  let emptyStreak = 0;

  for (let y = season; y >= season - 24; y--) {
    const hits = await Promise.all(
      teams.map(async (t) => {
        const mid = await managerIdForTeamSeason(t.id, y);
        if (mid !== managerId) return null;
        return teamStandingForSeason(t.id, t.abbreviation ?? "—", y);
      }),
    );
    const st = hits.find((h) => h && h.wins + h.losses > 0) ?? null;
    if (st) {
      out.push(st);
      emptyStreak = 0;
    } else {
      emptyStreak += 1;
      // Allow a year or two off between jobs; stop after a long drought.
      if (emptyStreak >= 6 && out.length > 0) break;
    }
  }

  return out.sort((a, b) => b.season - a.season || a.team.localeCompare(b.team));
}

function mergeManagerSeasonRecords(
  ...lists: MlbManagerSeasonRecord[][]
): MlbManagerSeasonRecord[] {
  const byKey = new Map<string, MlbManagerSeasonRecord>();
  for (const list of lists) {
    for (const row of list) {
      if (row.wins + row.losses <= 0) continue;
      const key = `${row.season}:${row.team}`;
      const prev = byKey.get(key);
      if (!prev || row.wins + row.losses > prev.wins + prev.losses) {
        byKey.set(key, row);
      }
    }
  }
  return [...byKey.values()].sort(
    (a, b) => b.season - a.season || a.team.localeCompare(b.team),
  );
}

type BbrefManagerCareerPayload = {
  error?: string;
  url?: string;
  photo?: string | null;
  interim?: boolean;
  shortLeash?: boolean;
  seasons?: {
    season: number;
    team: string;
    wins: number;
    losses: number;
    pct: string;
    finish: number | null;
    postWins: number;
    postLosses: number;
    comments: string;
  }[];
  stints?: {
    team: string;
    start: number;
    end: number;
    wins: number;
    losses: number;
    pct: string;
    departure: string | null;
    departureUrl?: string | null;
  }[];
  career?: {
    wins: number;
    losses: number;
    pct: string;
    games: number;
    postWins: number;
    postLosses: number;
  } | null;
  divisionTitles?: number;
  postseasonAppearances?: number;
  worldSeriesAppearances?: number;
  worldSeriesYears?: number[];
  managerOfYearWins?: number;
};

/** AL/NL BBWAA Manager of the Year only — not Carolina, International, etc. */
export function isMlbManagerOfTheYearAward(name: string): boolean {
  const n = name.trim();
  return /^(AL|NL|American League|National League)(?:\s+BBWAA)?\s+Manager of the Year\b/i.test(n);
}

function cleanCareerSeasons(
  seasons: BbrefManagerCareerPayload["seasons"],
): NonNullable<BbrefManagerCareerPayload["seasons"]> {
  return (seasons ?? []).filter(
    (s) =>
      Number.isFinite(s.season) &&
      s.wins + s.losses > 0 &&
      !/^[A-Z]{2,3}$/.test(String(s.team || "").trim()),
  );
}

async function fetchManagerCareer(name: string): Promise<BbrefManagerCareerPayload | null> {
  const data = await invokeSports<BbrefManagerCareerPayload>({
    action: "managerCareer",
    name,
  });
  if (!data) return null;
  const seasons = cleanCareerSeasons(data.seasons);
  const career =
    data.career && data.career.wins + data.career.losses > 0
      ? data.career
      : seasons.length
        ? (() => {
            const wins = seasons.reduce((n, s) => n + s.wins, 0);
            const losses = seasons.reduce((n, s) => n + s.losses, 0);
            return {
              wins,
              losses,
              pct: wins + losses > 0 ? (wins / (wins + losses)).toFixed(3).replace(/^0/, "") : ".000",
              games: wins + losses,
              postWins: seasons.reduce((n, s) => n + s.postWins, 0),
              postLosses: seasons.reduce((n, s) => n + s.postLosses, 0),
            };
          })()
        : null;
  return {
    ...data,
    seasons,
    career,
    stints: (data.stints ?? []).filter((s) => s.wins + s.losses > 0),
  };
}

async function fetchManagerRumors(name?: string | null): Promise<{
  items: MlbManagerRumor[];
  checkedAt: string | null;
}> {
  const d = await invokeSports<{ items?: MlbManagerRumor[]; checkedAt?: string }>({
    action: "managerRumors",
    name: name ?? null,
  });
  if (!d) return { items: [], checkedAt: null };
  return { items: d.items ?? [], checkedAt: d.checkedAt ?? null };
}

/** League-wide hot-seat rumor digest (refresh ~daily). */
export async function fetchMlbManagerRumorsFeed(): Promise<{
  items: MlbManagerRumor[];
  checkedAt: string | null;
}> {
  return fetchManagerRumors(null);
}

function parseOddsPercent(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === "" || raw === "-" || raw === "—") return null;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/%/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function buildHotSeat(
  input: {
    winPct: number;
    gb: string;
    playoff: number | null;
    divisionRank: number | null;
    yearsWithTeam: number;
    contractNote?: string | null;
    rumorHeat?: number;
    interim?: boolean;
    shortLeash?: boolean;
    /** Kalshi (or book) implied % to be next manager fired. */
    firedOddsPct?: number | null;
    /** Kalshi Manager of the Year implied % — higher = safer seat. */
    motyOddsPct?: number | null;
  },
): { score: number; factors: HotSeatFactor[] } {
  const gbNum = input.gb === "—" || !input.gb ? 0 : parseFloat(input.gb) || 0;
  const factors: HotSeatFactor[] = [];
  const years = Math.max(1, input.yearsWithTeam || 1);
  const interim = Boolean(input.interim);
  const shortLeash = Boolean(input.shortLeash) || isShortLeashContract(input.contractNote);
  const precarious = interim || shortLeash;
  // Interim / 1-year deals get full pressure — no first-year cushion.
  // Otherwise first-year managers get a grace period; heat ramps by year 3–4.
  const tenureScale = precarious ? 1 : years <= 1 ? 0.55 : years === 2 ? 0.78 : 1;

  // Prediction markets dominate when available (no separate Kalshi section).
  const marketPct =
    input.firedOddsPct != null && Number.isFinite(input.firedOddsPct)
      ? Math.max(0, Math.min(99, input.firedOddsPct))
      : null;
  if (marketPct != null && marketPct > 0) {
    // Kalshi must dominate the board — a 75% next-fired favorite should never
    // sit at #7 behind interims stacking win%/GB/playoff points (~150 max).
    // 50% → 150 heat, 75% → 225 heat.
    const marketPts = Math.round(marketPct * 3 * 10) / 10;
    factors.push({
      key: "market",
      label: "Next fired",
      points: marketPts,
      detail: `Kalshi ~${marketPct.toFixed(1)}% next-fired → +${marketPts.toFixed(1)} heat (dominates ranking)`,
    });
  }

  const motyPct =
    input.motyOddsPct != null && Number.isFinite(input.motyOddsPct)
      ? Math.max(0, Math.min(99, input.motyOddsPct))
      : null;
  if (motyPct != null && motyPct > 0) {
    // MOTY favorites are safer — cut heat. 40% MOTY → −40, 70% → −70 (capped).
    const safetyPts = -Math.round(Math.min(70, motyPct) * 10) / 10;
    factors.push({
      key: "moty",
      label: "Mgr of Year",
      points: safetyPts,
      detail: `Kalshi ~${motyPct.toFixed(1)}% Manager of the Year → ${safetyPts.toFixed(1)} heat (safer seat)`,
    });
  }

  const losePtsRaw = (1 - (Number.isFinite(input.winPct) ? input.winPct : 0.5)) * 40;
  const losePts = Math.round(losePtsRaw * tenureScale * 10) / 10;
  factors.push({
    key: "winpct",
    label: "Win percentage",
    points: losePts,
    detail: `${((Number.isFinite(input.winPct) ? input.winPct : 0) * 100).toFixed(1)}% → ${losePts.toFixed(1)} heat (scaled for year ${years} tenure)`,
  });

  const gbPts = Math.round(Math.min(Math.max(gbNum, 0), 28) * 1.4 * tenureScale * 10) / 10;
  factors.push({
    key: "gb",
    label: "Games back",
    points: gbPts,
    detail: `${input.gb === "—" ? "Tied / leading" : `${input.gb} GB`} → ${gbPts.toFixed(1)} heat`,
  });

  const playoff = Number.isFinite(input.playoff as number) ? (input.playoff as number) : null;
  const playoffPts =
    playoff != null
      ? Math.round((100 - playoff) * 0.28 * tenureScale * 10) / 10
      : Math.round(16 * tenureScale * 10) / 10;
  factors.push({
    key: "playoff",
    label: "Playoff odds",
    points: Number.isFinite(playoffPts) ? playoffPts : 0,
    detail:
      playoff != null
        ? `${playoff.toFixed(1)}% → ${playoffPts.toFixed(1)} heat`
        : `Odds unavailable → ${playoffPts.toFixed(1)} heat default`,
  });

  const divPtsRaw =
    input.divisionRank != null && input.divisionRank >= 4
      ? 8
      : input.divisionRank === 3
        ? 3
        : 0;
  const divPts = Math.round(divPtsRaw * tenureScale * 10) / 10;
  factors.push({
    key: "division",
    label: "Division place",
    points: divPts,
    detail:
      input.divisionRank != null
        ? `${input.divisionRank}${ordinalSuffix(input.divisionRank)} in division → ${divPts.toFixed(1)} heat`
        : "Rank unknown",
  });

  if (precarious) {
    factors.push({
      key: "interim",
      label: interim ? "Interim manager" : "Short leash",
      points: 28,
      detail: interim
        ? "Interim skippers are always on the hottest seat → +28 heat"
        : "One-year / interim-style deal → +28 heat (no grace period)",
    });
  } else if (years <= 1) {
    factors.push({
      key: "tenure-grace",
      label: "First-year cushion",
      points: -12,
      detail: "Year-1 managers rarely sit on the hottest seats → −12 heat",
    });
  } else if (years === 2) {
    factors.push({
      key: "tenure-grace",
      label: "Second-year leash",
      points: -5,
      detail: "Still early in the seat → −5 heat",
    });
  } else if (years >= 3 && input.winPct < 0.5) {
    const tenurePts = Math.min(14, (years - 2) * 3.5);
    factors.push({
      key: "tenure-pressure",
      label: "Longer leash expired",
      points: Math.round(tenurePts * 10) / 10,
      detail: `Year ${years} with club under .500 → +${tenurePts.toFixed(1)} heat`,
    });
  } else {
    factors.push({
      key: "tenure",
      label: "Tenure",
      points: 0,
      detail: `Year ${years} with current club`,
    });
  }

  const note = input.contractNote ?? "";
  if (note && /through 202[89]|2029|2030|extension|club option/i.test(note)) {
    factors.push({
      key: "contract-safe",
      label: "Contract security",
      points: -9,
      detail: `${note} → −9 heat`,
    });
  } else if (note && /2026|final year|lame.?duck|expir/i.test(note) && input.winPct < 0.48) {
    factors.push({
      key: "contract-hot",
      label: "Lame-duck pressure",
      points: 10,
      detail: `${note} + poor record → +10 heat`,
    });
  } else if (note) {
    factors.push({
      key: "contract",
      label: "Contract",
      points: 0,
      detail: note,
    });
  }

  if (input.rumorHeat && input.rumorHeat > 0) {
    factors.push({
      key: "rumors",
      label: "Media / hot-seat chatter",
      points: input.rumorHeat,
      detail: `Recent hot-seat / firing rumor hits → +${input.rumorHeat.toFixed(1)} heat`,
    });
  }

  const total = factors.reduce((s, f) => s + (Number.isFinite(f.points) ? f.points : 0), 0);
  const score = Math.round(Math.max(0, total) * 10) / 10;
  return {
    score: Number.isFinite(score) ? score : 0,
    factors: factors.map((f) => ({
      ...f,
      points: Number.isFinite(f.points) ? f.points : 0,
    })),
  };
}

function ordinalSuffix(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return "th";
  return ["th", "st", "nd", "rd", "th", "th", "th", "th", "th", "th"][Math.min(n % 10, 9)];
}

/** All 30 MLB managers with a computed hot-seat ranking. */
let managersListCache: { at: number; data: MlbManager[] } | null = null;

export async function fetchMlbManagers(): Promise<MlbManager[]> {
  const now = Date.now();
  if (managersListCache && now - managersListCache.at < 180_000) {
    return managersListCache.data;
  }
  const season = currentSeason();
  const [teamsRaw, standings, firedOdds, motyOdds] = await Promise.all([
    mlbGet("teams", { sportId: "1", season: String(season) }) as Promise<{
      teams?: { id?: number; name?: string; abbreviation?: string }[];
    }>,
    fetchMlbStandings(),
    fetchManagerFiredOdds().catch(
      (): MlbManagerFiredOdds => ({ source: "none", checkedAt: null, items: [] }),
    ),
    fetchManagerMotyOdds().catch(
      (): MlbManagerMotyOdds => ({ source: "none", checkedAt: null, items: [] }),
    ),
  ]);

  const standingByTeam = new Map<
    number,
    { wins: number; losses: number; pct: string; gb: string; rank: string; playoff: string | null }
  >();
  for (const t of standings) {
    for (const r of t.rows) {
      standingByTeam.set(r.teamId, {
        wins: r.wins,
        losses: r.losses,
        pct: r.pct,
        gb: r.gb,
        rank: r.rank,
        playoff: r.playoffPercent,
      });
    }
  }

  const teams = teamsRaw.teams ?? [];
  const managers: Omit<MlbManager, "hotSeatRank">[] = [];

  await Promise.all(
    teams.map(async (team) => {
      if (!team.id) return;
      try {
        const coaches = (await mlbGet(`teams/${team.id}/coaches`, {
          season: String(season),
        })) as { roster?: CoachMgr[] };
        const mgr = pickTeamManager(coaches.roster ?? []);
        const mgrId = mgr?.person?.id;
        if (!mgrId || !mgr.person?.fullName) return;
        const role = coachRole(mgr);
        const mlbInterim = isInterimManagerRole(role);

        let yearsWithTeam = 1;
        // Parallel tenure probe (recent seasons) instead of serial year-by-year walks.
        const tenureYears = Array.from({ length: 8 }, (_, i) => season - 1 - i);
        const tenureHits = await Promise.all(
          tenureYears.map((y) => managerIdForTeamSeason(team.id!, y)),
        );
        for (const prev of tenureHits) {
          if (prev !== mgrId) break;
          yearsWithTeam += 1;
        }

        const st = standingByTeam.get(team.id);
        let wins = st?.wins ?? 0;
        let losses = st?.losses ?? 0;
        let recordLabel: MlbManager["recordLabel"] = "Team";

        const [wiki, photoMeta, spotracNote] = await Promise.all([
          fetchWikipediaCard(mgr.person.fullName),
          fetchManagerPhotoMeta(mgr.person.fullName),
          fetchManagerContractNote(mgr.person.fullName).catch(() => null),
        ]);

        const resolved = resolveManagerContractNote(
          mgr.person.fullName,
          photoMeta.contractNote || spotracNote || null,
        );
        const contractNote = resolved.note;
        const contractTerm = parseManagerContractTerm(
          contractNote,
          season,
          yearsWithTeam,
          resolved.known,
        );

        const interim = mlbInterim || photoMeta.interim;
        if (
          interim &&
          photoMeta.yearWins != null &&
          photoMeta.yearLosses != null &&
          photoMeta.yearWins + photoMeta.yearLosses > 0
        ) {
          wins = photoMeta.yearWins;
          losses = photoMeta.yearLosses;
          recordLabel = "As manager";
        }

        const gp = wins + losses;
        const winPct = gp > 0 ? wins / gp : 0.5;
        const playoff = parseOddsPercent(st?.playoff);

        // Prefer BBRef manager mugshots (real faces) over Wiki crops / MLB generics.
        const headshot =
          photoMeta.photo ||
          (!isGenericMlbHeadshot(wiki.image) && wiki.image) ||
          mlbHeadshot(mgrId, 213);

        const odds = matchFiredOdds(mgr.person.fullName, firedOdds.items);
        const moty = matchMotyOdds(
          mgr.person.fullName,
          motyOdds.items,
          leagueForTeamId(team.id),
        );

        const shortLeash =
          interim ||
          photoMeta.shortLeash ||
          isShortLeashContract(contractNote) ||
          (yearsWithTeam <= 1 && winPct < 0.42);

        const heat = buildHotSeat({
          winPct,
          gb: st?.gb ?? "—",
          playoff,
          divisionRank: st?.rank ? Number(st.rank) : null,
          yearsWithTeam,
          contractNote,
          interim,
          shortLeash,
          firedOddsPct: odds?.pct ?? null,
          motyOddsPct: moty?.pct ?? null,
        });

        managers.push({
          id: mgrId,
          name: mgr.person.fullName,
          teamId: team.id,
          teamName: team.name ?? "—",
          teamAbbrev: team.abbreviation ?? "—",
          record: `${wins}-${losses}`,
          recordLabel,
          wins,
          losses,
          winPct,
          gb: st?.gb ?? "—",
          playoffOdds: playoff,
          firedOddsAmerican: odds?.american ?? null,
          firedOddsPct: odds?.pct ?? null,
          firedOddsUrl: odds?.url ?? null,
          motyOddsAmerican: moty?.american ?? null,
          motyOddsPct: moty?.pct ?? null,
          motyOddsUrl: moty?.url ?? null,
          motyLeague: moty?.league ?? null,
          divisionRank: st?.rank ? Number(st.rank) : null,
          contractNote,
          contractTerm,
          hotSeatScore: heat.score,
          headshot,
          primaryColor: TEAM_COLORS[team.id] ?? "d9515c",
          yearsWithTeam,
          heatFactors: heat.factors,
          isInterim: interim,
          shortLeash,
        });
      } catch {
        // skip team
      }
    }),
  );

  // Kalshi next-fired % is the primary rank key when present — market favorite = #1.
  managers.sort((a, b) => {
    const aKalshi = a.firedOddsPct;
    const bKalshi = b.firedOddsPct;
    const aHas = aKalshi != null && Number.isFinite(aKalshi);
    const bHas = bKalshi != null && Number.isFinite(bKalshi);
    if (aHas && bHas && aKalshi !== bKalshi) return (bKalshi as number) - (aKalshi as number);
    if (aHas !== bHas) return aHas ? -1 : 1;
    return b.hotSeatScore - a.hotSeatScore;
  });
  const ranked = managers.map((m, i) => ({ ...m, hotSeatRank: i + 1 }));
  managersListCache = { at: Date.now(), data: ranked };
  return ranked;
}

/** Fast path for a single manager page — avoids rebuilding the full 30-team board. */
async function fetchMlbManagerBaseLite(managerId: number): Promise<MlbManager> {
  const season = currentSeason();
  const [person, standings, firedOdds, motyOdds] = await Promise.all([
    mlbGet(`people/${managerId}`, { hydrate: "currentTeam" }) as Promise<{
      people?: {
        id?: number;
        fullName?: string;
        currentTeam?: { id?: number; name?: string; abbreviation?: string };
      }[];
    }>,
    fetchMlbStandings(),
    fetchManagerFiredOdds().catch(
      (): MlbManagerFiredOdds => ({ source: "none", checkedAt: null, items: [] }),
    ),
    fetchManagerMotyOdds().catch(
      (): MlbManagerMotyOdds => ({ source: "none", checkedAt: null, items: [] }),
    ),
  ]);
  const p = person.people?.[0];
  if (!p?.fullName) throw new Error("Manager not found");
  let teamId = p.currentTeam?.id ?? 0;
  let teamName = p.currentTeam?.name ?? "—";
  let teamAbbrev = p.currentTeam?.abbreviation ?? "—";

  if (teamId) {
    try {
      const coaches = (await mlbGet(`teams/${teamId}/coaches`, {
        season: String(season),
      })) as { roster?: CoachMgr[] };
      const mgr = pickTeamManager(coaches.roster ?? []);
      if (mgr?.person?.id && mgr.person.id !== managerId) {
        // Person may have moved — keep currentTeam from people hydrate.
      }
    } catch {
      /* optional */
    }
  }

  const st = standings
    .flatMap((d) => d.rows.map((r) => ({ ...r, div: d })))
    .find((r) => r.teamId === teamId);
  const wins = st?.wins ?? 0;
  const losses = st?.losses ?? 0;
  const gp = wins + losses;
  const winPct = gp > 0 ? wins / gp : 0.5;
  const playoff = parseOddsPercent(st?.playoffPercent);
  const [wiki, photoMeta, spotracNote] = await Promise.all([
    fetchWikipediaCard(p.fullName),
    fetchManagerPhotoMeta(p.fullName),
    fetchManagerContractNote(p.fullName).catch(() => null),
  ]);
  const resolved = resolveManagerContractNote(
    p.fullName,
    photoMeta.contractNote || spotracNote || null,
  );
  const contractNote = resolved.note;
  const yearsWithTeam = 1;
  const contractTerm = parseManagerContractTerm(
    contractNote,
    season,
    yearsWithTeam,
    resolved.known,
  );
  const interim = photoMeta.interim;
  const odds = matchFiredOdds(p.fullName, firedOdds.items);
  const moty = matchMotyOdds(p.fullName, motyOdds.items, leagueForTeamId(teamId));
  const shortLeash =
    isShortLeashContract(contractNote) || interim || (yearsWithTeam <= 1 && winPct < 0.42);
  const heat = buildHotSeat({
    winPct,
    gb: st?.gb ?? "—",
    playoff,
    divisionRank: st?.rank != null ? Number(st.rank) : null,
    yearsWithTeam,
    contractNote,
    interim,
    shortLeash,
    firedOddsPct: odds?.pct ?? null,
    motyOddsPct: moty?.pct ?? null,
  });
  const headshot =
    photoMeta.photo ||
    (!isGenericMlbHeadshot(wiki.image) && wiki.image) ||
    mlbHeadshot(managerId, 213);
  return {
    id: managerId,
    name: p.fullName,
    teamId,
    teamName,
    teamAbbrev,
    record: `${wins}-${losses}`,
    recordLabel: interim ? "As manager" : "Team",
    wins,
    losses,
    winPct,
    gb: st?.gb ?? "—",
    playoffOdds: playoff,
    firedOddsAmerican: odds?.american ?? null,
    firedOddsPct: odds?.pct ?? null,
    firedOddsUrl: odds?.url ?? null,
    motyOddsAmerican: moty?.american ?? null,
    motyOddsPct: moty?.pct ?? null,
    motyOddsUrl: moty?.url ?? null,
    motyLeague: moty?.league ?? null,
    divisionRank: st?.rank != null ? Number(st.rank) : null,
    contractNote,
    contractTerm,
    hotSeatScore: heat.score,
    hotSeatRank: 0,
    headshot,
    primaryColor: "ba0c2f",
    yearsWithTeam,
    heatFactors: heat.factors,
    isInterim: interim,
    shortLeash,
  };
}

// NOTE: keep ranked return below for the original function body end.

export async function fetchMlbManagerDetail(managerId: number | string): Promise<MlbManagerDetail> {
  const id = Number(managerId);
  const cached = managersListCache?.data.find((m) => m.id === id);
  const base = cached ?? (await fetchMlbManagerBaseLite(id));
  if (!base) throw new Error("Manager not found");

  const season = currentSeason();
  // Career seasons: prefer BBRef, but always also scan MLB coaches across clubs
  // so prior years still show when the edge scrape is slow/blocked.
  const [person, scrapedContract, wiki, txRaw, fallbackRecords, careerRaw, rumorsRaw, mlbSeasons] =
    await Promise.all([
      mlbGet(`people/${id}`, {
        hydrate: "currentTeam,education,awards,stats(group=[hitting],type=[yearByYear])",
      }) as Promise<{
        people?: {
          fullName?: string;
          birthDate?: string;
          currentAge?: number;
          birthCity?: string;
          birthStateProvince?: string;
          birthCountry?: string;
          education?: { colleges?: { name?: string }[]; highschools?: { name?: string }[] };
          awards?: { season?: string | number; name?: string }[];
          stats?: {
            type?: { displayName?: string };
            group?: { displayName?: string };
            splits?: {
              season?: string;
              team?: { name?: string };
              stat?: { gamesPlayed?: number; summary?: string };
            }[];
          }[];
        }[];
      }>,
      fetchManagerContractNote(base.name),
      fetchWikipediaCard(base.name),
      mlbGet("transactions", {
        playerId: String(id),
        startDate: "1990-01-01",
        endDate: `${season}-12-31`,
      }).catch(() => ({ transactions: [] })) as Promise<{
        transactions?: { date?: string; typeDesc?: string; description?: string }[];
      }>,
      fetchManagerSeasonRecords(id, base.teamId, base.teamAbbrev, season),
      fetchManagerCareer(base.name),
      fetchManagerRumors(base.name),
      fetchManagerSeasonsAcrossTeams(id, season),
    ]);

  const p = person.people?.[0];
  const place = [p?.birthCity, p?.birthStateProvince, p?.birthCountry].filter(Boolean).join(", ");
  const school =
    p?.education?.colleges?.[0]?.name ?? p?.education?.highschools?.[0]?.name ?? null;

  const resolvedContract = resolveManagerContractNote(
    base.name,
    scrapedContract || base.contractNote,
  );
  const contractNote = resolvedContract.note;

  const bbSeasons = cleanCareerSeasons(careerRaw?.seasons).map((s) => ({
    season: s.season,
    team: s.team,
    wins: s.wins,
    losses: s.losses,
    pct: s.pct,
    gb: "—",
    divisionRank: s.finish,
    postWins: s.postWins,
    postLosses: s.postLosses,
    comments: s.comments || "",
  }));
  // Merge BBRef + MLB cross-team scan + current-club fallback so prior clubs
  // never disappear when one source is thin (Skip: MIA 2023–24 + TEX 2026).
  const seasonRecords = mergeManagerSeasonRecords(
    bbSeasons,
    mlbSeasons,
    fallbackRecords.filter((r) => r.wins + r.losses > 0),
  );

  // Overlay current-season GB from live standings when team matches.
  const currentRow = seasonRecords.find((r) => r.season === season);
  if (currentRow) currentRow.gb = base.gb;

  const managedYears = new Set(seasonRecords.map((s) => s.season));
  const awards = (p?.awards ?? [])
    .filter((a) => a.name && a.season)
    .map((a) => ({ season: String(a.season), name: String(a.name) }))
    .filter((a) => {
      const yr = Number(a.season);
      // Keep every MOTY (including Carolina / other MiLB) on the awards list.
      if (/manager of the year/i.test(a.name)) return true;
      if (/world series/i.test(a.name) && managedYears.has(yr)) return true;
      if (/pennant|championship series/i.test(a.name) && managedYears.has(yr)) return true;
      return false;
    });

  // Hero / résumé chips count AL/NL only — MiLB MOTY stay in the list below.
  const moyAwards = awards.filter((a) => isMlbManagerOfTheYearAward(a.name));
  const wsAwards = awards.filter((a) => /world series/i.test(a.name));

  let stints: MlbManagerStint[] = (careerRaw?.stints ?? [])
    .filter((s) => s.wins + s.losses > 0)
    .map((s) => ({
      team: s.team,
      start: s.start,
      end: s.end,
      wins: s.wins,
      losses: s.losses,
      pct: s.pct,
      departure: s.departure ?? null,
      departureUrl: s.departureUrl ?? null,
    }));
  if (!stints.length && seasonRecords.length) {
    // Build club stints from the merged year-by-year table when BBRef is down.
    const built: MlbManagerStint[] = [];
    const chronological = [...seasonRecords].sort((a, b) => a.season - b.season);
    for (const s of chronological) {
      const last = built[built.length - 1];
      if (last && last.team === s.team && s.season === last.end + 1) {
        last.end = s.season;
        last.wins += s.wins;
        last.losses += s.losses;
        const g = last.wins + last.losses;
        last.pct = g > 0 ? (last.wins / g).toFixed(3).replace(/^0/, "") : ".000";
      } else {
        built.push({
          team: s.team,
          start: s.season,
          end: s.season,
          wins: s.wins,
          losses: s.losses,
          pct: s.pct,
          departure: null,
          departureUrl: null,
        });
      }
    }
    stints = built;
  }

  const wsYearsFromCareer = (careerRaw?.worldSeriesYears ?? []).filter((y) =>
    Number.isFinite(y),
  );
  const wsYears = [
    ...new Set([
      ...wsYearsFromCareer,
      ...wsAwards.map((a) => Number(a.season)).filter((y) => Number.isFinite(y)),
    ]),
  ].sort((a, b) => a - b);
  const moyYears = [
    ...new Set(moyAwards.map((a) => Number(a.season)).filter((y) => Number.isFinite(y))),
  ].sort((a, b) => a - b);

  const careerTotals =
    careerRaw?.career && careerRaw.career.wins + careerRaw.career.losses > 0
      ? careerRaw.career
      : null;
  const career: MlbManagerCareer | null = careerTotals
    ? {
        wins: careerTotals.wins,
        losses: careerTotals.losses,
        pct: careerTotals.pct,
        games: careerTotals.games,
        seasons: seasonRecords.length,
        postWins: careerTotals.postWins,
        postLosses: careerTotals.postLosses,
        divisionTitles: careerRaw?.divisionTitles ?? 0,
        postseasonAppearances: careerRaw?.postseasonAppearances ?? 0,
        worldSeriesAppearances: Math.max(
          careerRaw?.worldSeriesAppearances ?? 0,
          wsYears.length,
          wsAwards.length,
        ),
        worldSeriesYears: wsYears,
        managerOfYear: Math.max(careerRaw?.managerOfYearWins ?? 0, moyAwards.length),
        managerOfYearYears: moyYears,
      }
    : seasonRecords.length
      ? {
          wins: seasonRecords.reduce((n, r) => n + r.wins, 0),
          losses: seasonRecords.reduce((n, r) => n + r.losses, 0),
          pct: (() => {
            const w = seasonRecords.reduce((n, r) => n + r.wins, 0);
            const l = seasonRecords.reduce((n, r) => n + r.losses, 0);
            return w + l > 0 ? (w / (w + l)).toFixed(3).replace(/^0/, "") : ".000";
          })(),
          games: seasonRecords.reduce((n, r) => n + r.wins + r.losses, 0),
          seasons: seasonRecords.length,
          postWins: seasonRecords.reduce((n, r) => n + r.postWins, 0),
          postLosses: seasonRecords.reduce((n, r) => n + r.postLosses, 0),
          divisionTitles: seasonRecords.filter((r) => r.divisionRank === 1).length,
          postseasonAppearances: seasonRecords.filter((r) => r.postWins + r.postLosses > 0)
            .length,
          worldSeriesAppearances: wsYears.length || wsAwards.length,
          worldSeriesYears: wsYears,
          managerOfYear: moyAwards.length,
          managerOfYearYears: moyYears,
        }
      : null;

  const rumorItems = rumorsRaw.items;
  const rumorHeat = Math.min(
    12,
    rumorItems.filter((r) => /hot seat|fired|dismiss|replace|axed|oust/i.test(r.title)).length *
      2.5,
  );

  const yearsWithTeam = Math.max(
    base.yearsWithTeam,
    seasonRecords.filter((r) =>
      new RegExp(base.teamAbbrev, "i").test(r.team) ||
      new RegExp(base.teamName.split(" ").pop() ?? "", "i").test(r.team),
    ).length,
    1,
  );
  const contractTerm = parseManagerContractTerm(
    contractNote,
    season,
    yearsWithTeam,
    resolvedContract.known,
  );

  const interimFromCareer =
    Boolean(careerRaw?.interim) ||
    seasonRecords.some((r) => /interim/i.test(r.comments)) ||
    (wiki.extract ? /\binterim manager\b/i.test(wiki.extract) : false);
  const isInterim = base.isInterim || interimFromCareer;
  const shortLeash =
    base.shortLeash ||
    isShortLeashContract(contractNote) ||
    isInterim ||
    Boolean(careerRaw?.shortLeash) ||
    (yearsWithTeam <= 1 && base.winPct < 0.42);

  const heat = buildHotSeat({
    winPct: base.winPct,
    gb: base.gb,
    playoff: base.playoffOdds,
    divisionRank: base.divisionRank,
    yearsWithTeam,
    contractNote,
    rumorHeat,
    interim: isInterim,
    shortLeash,
    firedOddsPct: base.firedOddsPct,
    motyOddsPct: base.motyOddsPct,
  });

  const playingCareer =
    (p?.stats ?? [])
      .flatMap((block) => block.splits ?? [])
      .filter((s) => s.season)
      .map((s) => ({
        season: String(s.season),
        team: s.team?.name ?? "—",
        games: s.stat?.gamesPlayed != null ? String(s.stat.gamesPlayed) : "—",
        summary: s.stat?.summary ?? "",
      }))
      .slice(-20) ?? [];

  const timeline = (txRaw.transactions ?? [])
    .filter((t) => t.date && t.description)
    .map((t) => ({
      date: t.date!,
      text: t.description!,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  try {
    const teamTx = (await mlbGet("transactions", {
      teamId: String(base.teamId),
      startDate: `${season - 12}-01-01`,
      endDate: `${season}-12-31`,
    })) as { transactions?: { date?: string; description?: string }[] };
    for (const t of teamTx.transactions ?? []) {
      const desc = t.description ?? "";
      if (
        t.date &&
        new RegExp(base.name.split(" ").pop() ?? base.name, "i").test(desc) &&
        /manager|hired|named|promoted|fired|dismiss/i.test(desc)
      ) {
        if (!timeline.some((x) => x.date === t.date && x.text === desc)) {
          timeline.push({ date: t.date, text: desc });
        }
      }
    }
    timeline.sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    // optional
  }

  const heatLabel =
    base.hotSeatRank <= 5
      ? "Blazing"
      : base.hotSeatRank <= 12
        ? "Warm"
        : base.hotSeatRank <= 20
          ? "Cool"
          : "Safe";

  const careerNotes: string[] = [
    wiki.extract ?? `${base.name} is the manager of the ${base.teamName}.`,
    career
      ? `Career managerial record: ${career.wins}-${career.losses} (${career.pct}) over ${career.seasons} season${career.seasons === 1 ? "" : "s"}.`
      : "",
    career && career.divisionTitles
      ? `Division titles: ${career.divisionTitles}.`
      : "",
    career && career.postseasonAppearances
      ? `Postseason appearances: ${career.postseasonAppearances} (${career.postWins}-${career.postLosses}).`
      : "",
    career && career.worldSeriesAppearances
      ? `World Series as manager: ${career.worldSeriesAppearances}.`
      : "",
    career && career.managerOfYear
      ? `Manager of the Year awards: ${career.managerOfYear}.`
      : "",
    stints.length > 1
      ? `Prior clubs: ${stints
          .slice(0, -1)
          .map((s) => `${s.team} (${s.start}–${s.end})`)
          .join("; ")}.`
      : "",
    `Current record: ${base.record} (${(base.winPct * 100).toFixed(1)}% · ${base.gb} GB).`,
    isInterim
      ? `${base.name} is listed as an interim / short-leash manager — hottest-seat pressure applies.`
      : shortLeash
        ? "Short contract leash: no first-year grace on the hot seat."
        : "",
    `${yearsWithTeam} season${yearsWithTeam === 1 ? "" : "s"} as ${base.teamName} manager.`,
    base.playoffOdds != null ? `Playoff odds: ${base.playoffOdds.toFixed(1)}%.` : "",
    contractNote ? `Contract: ${contractNote}.` : "Contract terms not published.",
    school ? `School: ${school}.` : "",
    place ? `Born: ${place}.` : "",
    `Hot seat: #${base.hotSeatRank} of 30 — ${heatLabel} (score ${heat.score.toFixed(1)}).`,
    playingCareer.length
      ? `MLB playing career: ${playingCareer.length} season${playingCareer.length === 1 ? "" : "s"} on record.`
      : "No MLB playing seasons on record (coach/manager track).",
  ].filter(Boolean);

  let headshot =
    careerRaw?.photo ||
    (base.headshot && !isGenericMlbHeadshot(base.headshot) ? base.headshot : null) ||
    (!isGenericMlbHeadshot(wiki.image) && wiki.image) ||
    null;
  if (!headshot || isGenericMlbHeadshot(headshot)) {
    const bbPhoto = await fetchManagerPhoto(base.name);
    if (bbPhoto) headshot = bbPhoto;
  }
  if (!headshot) headshot = mlbHeadshot(id, 426);

  // Always surface a season-by-season table — prefer BBRef all-clubs, else current-team scan.
  const finalSeasonRecords =
    seasonRecords.length > 0
      ? seasonRecords
      : (await fetchManagerSeasonRecords(id, base.teamId, base.teamAbbrev, season)).filter(
          (r) => r.wins + r.losses > 0,
        );

  return {
    ...base,
    yearsWithTeam,
    contractNote,
    contractTerm,
    isInterim,
    shortLeash,
    hotSeatScore: heat.score,
    heatFactors: heat.factors,
    headshot,
    age: p?.currentAge ?? ageFromBirthDate(p?.birthDate),
    birthDate: p?.birthDate ?? null,
    birthPlace: place || null,
    bio: wiki.extract ?? contractNote,
    careerNotes,
    school,
    wikiExtract: wiki.extract,
    timeline: timeline.slice(-24),
    playingCareer,
    seasonRecords: finalSeasonRecords,
    stints,
    career,
    awards,
    rumors: rumorItems,
    bbrefUrl: careerRaw?.url ?? null,
  };
}

export type FavoriteYesterdayLine = {
  playerId: string;
  playerName: string;
  teamName: string | null;
  position: string | null;
  date: string;
  summary: string;
  opponent: string;
  isHome: boolean;
  isWin: boolean | null;
  stats: MlbPlayerStatLine[];
  group: "hitting" | "pitching";
  played: boolean;
};

/** How each favorited player (non-manager) did in yesterday's games (America/Chicago). */
export async function fetchFavoritePlayersYesterday(
  favorites: {
    playerId: string;
    playerName: string;
    teamName?: string | null;
    position?: string | null;
  }[],
): Promise<{ date: string; lines: FavoriteYesterdayLine[] }> {
  const today = chicagoToday();
  const date = addDaysIso(today, -1);
  const season = Number(date.slice(0, 4));
  const players = favorites.filter(
    (f) => (f.position ?? "").toLowerCase() !== "manager",
  );

  const lines = (
    await Promise.all(
      players.map(async (f): Promise<FavoriteYesterdayLine | null> => {
        const isPitcher = /^(p|pitcher|sp|rp|cl)$/i.test(f.position ?? "");
        const groups: ("hitting" | "pitching")[] = isPitcher
          ? ["pitching", "hitting"]
          : ["hitting", "pitching"];
        for (const group of groups) {
          try {
            const log = await fetchMlbPlayerGameLog(f.playerId, group, 5, season);
            const game = log.find((g) => g.date === date);
            if (!game) continue;
            return {
              playerId: f.playerId,
              playerName: f.playerName,
              teamName: f.teamName ?? null,
              position: f.position ?? null,
              date,
              summary:
                game.summary ||
                `${game.stats.map((s) => `${s.label} ${s.value}`).join(" · ")}`,
              opponent: game.opponent,
              isHome: game.isHome,
              isWin: game.isWin,
              stats: game.stats.slice(0, 6),
              group,
              played: true,
            };
          } catch {
            /* try next group */
          }
        }
        // Kill hollow DNP stubs universally — only surface players who actually played.
        return null;
      }),
    )
  ).filter((l): l is FavoriteYesterdayLine => l != null);

  return { date, lines };
}

/** MLB.com club site slug for front-office / prospects pages. */
const MLB_CLUB_SLUG: Record<number, string> = {
  108: "angels",
  109: "dbacks",
  110: "orioles",
  111: "redsox",
  112: "cubs",
  113: "reds",
  114: "guardians",
  115: "rockies",
  116: "tigers",
  117: "astros",
  118: "royals",
  119: "dodgers",
  120: "nationals",
  121: "mets",
  133: "athletics",
  134: "pirates",
  135: "padres",
  136: "mariners",
  137: "giants",
  138: "cardinals",
  139: "rays",
  140: "rangers",
  141: "bluejays",
  142: "twins",
  143: "phillies",
  144: "braves",
  145: "whitesox",
  146: "marlins",
  147: "yankees",
  158: "brewers",
};

const MLB_TEAM_ABBREV: Record<number, string> = {
  108: "LAA",
  109: "AZ",
  110: "BAL",
  111: "BOS",
  112: "CHC",
  113: "CIN",
  114: "CLE",
  115: "COL",
  116: "DET",
  117: "HOU",
  118: "KC",
  119: "LAD",
  120: "WSH",
  121: "NYM",
  133: "OAK",
  134: "PIT",
  135: "SD",
  136: "SEA",
  137: "SF",
  138: "STL",
  139: "TB",
  140: "TEX",
  141: "TOR",
  142: "MIN",
  143: "PHI",
  144: "ATL",
  145: "CWS",
  146: "MIA",
  147: "NYY",
  158: "MIL",
};

export function mlbClubSlug(teamId: number): string | null {
  return MLB_CLUB_SLUG[teamId] ?? null;
}

export type MlbTeamExec = {
  title: string;
  name: string;
};

function scoreFrontOfficeTitle(title: string): number {
  const t = title.toLowerCase().replace(/\s+/g, " ").trim();
  if (
    /assistant|special assistant|florida|spring training|north port|advisor|legal|amateur|player development|executive assistant/.test(
      t,
    )
  ) {
    return 0;
  }
  if (t.includes("president of baseball operations") && t.includes("general manager")) return 100;
  if (t.includes("president of baseball operations")) return 98;
  if (t.includes("president, baseball operations") && t.includes("general manager")) return 97;
  if (t.includes("senior vice president") && t.includes("general manager")) return 94;
  if (t.includes("executive vice president") && t.includes("general manager")) return 93;
  if (t.includes("vice president") && t.includes("general manager")) return 90;
  if (t === "general manager") return 88;
  if (/\bgeneral manager\b/.test(t)) return 80;
  return 0;
}

/** Best-effort GM / President of Baseball Ops from the club front-office page. */
export async function fetchMlbTeamGeneralManager(
  teamId: number,
): Promise<MlbTeamExec | null> {
  const slug = mlbClubSlug(teamId);
  if (!slug) return null;
  try {
    const res = await fetch(`https://www.mlb.com/${slug}/team/front-office`, {
      headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return null;
    let html = await res.text();
    html = html
      .replace(/\\u003c/g, "<")
      .replace(/\\u003e/g, ">")
      .replace(/\\u0026/g, "&")
      .replace(/\\"/g, '"');
    html = html
      .replace(/&amp;/g, "&")
      .replace(/&#x27;/g, "'")
      .replace(/&apos;/g, "'");

    type Cand = { score: number; title: string; name: string };
    const cands: Cand[] = [];

    const rowRe =
      /<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;
    let m: RegExpExecArray | null;
    while ((m = rowRe.exec(html)) != null) {
      const left = m[1]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const right = m[2]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      for (const [title, name] of [
        [left, right],
        [right, left],
      ] as const) {
        const score = scoreFrontOfficeTitle(title);
        if (score > 0 && name && /^[A-ZÁÉÍÓÚ]/.test(name) && name.length < 60) {
          cands.push({ score, title, name });
        }
      }
    }

    const pRe =
      /(President of Baseball Operations[^:<]{0,60}|Executive Vice President\s*&\s*General Manager|Senior Vice President,?\s*General Manager|General Manager)\s*:\s*<strong[^>]*>\s*(?:<a[^>]*>)?\s*([^<]{2,60})/gi;
    while ((m = pRe.exec(html)) != null) {
      const title = m[1]!.replace(/\s+/g, " ").trim();
      const name = m[2]!.replace(/\s+/g, " ").trim();
      const score = scoreFrontOfficeTitle(title);
      if (score > 0) cands.push({ score, title, name });
    }

    cands.sort((a, b) => b.score - a.score);
    return cands[0] ? { title: cands[0].title, name: cands[0].name } : null;
  } catch {
    return null;
  }
}

export type MlbTeamManagerInfo = {
  id: number;
  name: string;
  title: string;
};

export async function fetchMlbTeamManager(
  teamId: number,
): Promise<MlbTeamManagerInfo | null> {
  try {
    const coaches = (await mlbGet(`teams/${teamId}/coaches`, {
      season: String(currentSeason()),
    })) as { roster?: CoachMgr[] };
    const mgr = pickTeamManager(coaches.roster ?? []);
    if (!mgr?.person?.id || !mgr.person.fullName) return null;
    return {
      id: mgr.person.id,
      name: mgr.person.fullName,
      title: (mgr.title || mgr.job || "Manager").trim(),
    };
  } catch {
    return null;
  }
}

export type MlbFarmAffiliate = {
  teamId: number;
  name: string;
  shortName: string;
  level: string;
  sportId: number;
};

export type MlbProspectSeed = {
  rank: number;
  name: string;
  position: string;
  pipelineNote?: string;
  /** Stable Stats API person id when name search is unreliable. */
  playerId?: number;
  /** Alternate search names (accents, short forms, Pipeline spelling). */
  aliases?: string[];
};

/** Pipeline-oriented Cardinals watch list (resolved against Stats API). */
export const CARDINALS_PROSPECT_SEEDS: MlbProspectSeed[] = [
  { rank: 1, name: "Rainiel Rodriguez", position: "C", playerId: 823787, pipelineNote: "MLB Pipeline" },
  { rank: 2, name: "Liam Doyle", position: "LHP", playerId: 824604, pipelineNote: "MLB Pipeline" },
  { rank: 3, name: "Joshua Baez", position: "OF", playerId: 695491, aliases: ["Joshua Báez"], pipelineNote: "MLB Pipeline" },
  { rank: 4, name: "Alexander Frias", position: "OF", playerId: 825484 },
  { rank: 5, name: "Tanner Franklin", position: "RHP", playerId: 815119 },
  { rank: 6, name: "Trevor Condon", position: "OF", playerId: 825891 },
  { rank: 7, name: "Leonardo Bernal", position: "C", playerId: 699024, aliases: ["Leo Bernal"] },
  { rank: 8, name: "Quinn Mathews", position: "LHP", playerId: 687273 },
  { rank: 9, name: "Brandon Clarke", position: "LHP", playerId: 700251 },
  { rank: 10, name: "Tegan Kuhns", position: "RHP", playerId: 815158 },
  { rank: 11, name: "Josiah Ragsdale", position: "OF", playerId: 828824 },
  { rank: 12, name: "Jurrangelo Cijntje", position: "RHP", playerId: 701388 },
  { rank: 13, name: "Yohiker Fajardo", position: "RHP", playerId: 823369, aliases: ["Yhoiker Fajardo"] },
  { rank: 14, name: "Tekoah Roby", position: "RHP", playerId: 694358 },
  {
    rank: 15,
    name: "Jesus Baez",
    position: "SS",
    playerId: 800305,
    aliases: ["Jesús Báez", "Jesús  Báez", "Jesus Báez"],
    pipelineNote: "MLB Pipeline",
  },
  { rank: 16, name: "Rocco Maniscalco", position: "SS", playerId: 836548 },
  { rank: 17, name: "Tai Peete", position: "OF", playerId: 806191 },
  { rank: 18, name: "Cooper Hjerpe", position: "LHP", playerId: 687309 },
  { rank: 19, name: "Yairo Padilla", position: "SS", playerId: 821107 },
  { rank: 20, name: "Sebastian Dos Santos", position: "SS", playerId: 829741 },
];

/** Live prospect ranks: org Pipeline and MLB Top-100 kept separate (never overwrite). */
export type MlbProspectRankMaps = {
  /** Club Pipeline ranks keyed by player id. */
  org: Map<number, number>;
  /** MLB Pipeline Top-100 ranks keyed by player id. */
  top100: Map<number, number>;
  /** Parent MLB club id for each org-ranked player (MiLB matchups span two orgs). */
  orgClubId: Map<number, number>;
};

export type MlbProspectRankPair = {
  orgRank: number | null;
  top100Rank: number | null;
  /** Parent MLB club id when orgRank came from that club's Pipeline list. */
  orgClubId?: number | null;
};

export function prospectRanksFor(
  maps: MlbProspectRankMaps | null | undefined,
  playerId: number,
): MlbProspectRankPair {
  return {
    orgRank: maps?.org?.get(playerId) ?? null,
    top100Rank: maps?.top100?.get(playerId) ?? null,
    orgClubId: maps?.orgClubId?.get(playerId) ?? null,
  };
}

/** Compact labels for hero / lineup chips. Prefer "STL #3" when org club is known. */
export function prospectRankLabels(pair: MlbProspectRankPair): string[] {
  const out: string[] = [];
  if (pair.orgRank != null && pair.orgRank > 0) {
    const abbr =
      pair.orgClubId != null ? MLB_TEAM_ABBREV[pair.orgClubId] ?? null : null;
    out.push(abbr ? `${abbr} #${pair.orgRank}` : `Org #${pair.orgRank}`);
  }
  if (pair.top100Rank != null && pair.top100Rank > 0) out.push(`Top 100 #${pair.top100Rank}`);
  return out;
}

async function loadPipelineSelectionSlugDirect(
  slug: string,
  limit: number,
): Promise<
  {
    rank: number;
    playerId: number;
    name: string | null;
    position: string | null;
  }[]
> {
  const query = `
    query PipelineSelection($slug: String!, $limit: Int) {
      getPlayerRankingsFromSelection(slug: $slug, limit: $limit) {
        rank
        playerEntity {
          position
          player {
            id
            fullName
            primaryPosition { abbreviation }
          }
        }
      }
    }
  `;
  try {
    const res = await fetch("https://data-graph.mlb.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Origin: typeof window !== "undefined" ? "https://www.mlb.com" : "https://www.mlb.com",
        Referer: "https://www.mlb.com/prospects",
      },
      body: JSON.stringify({ query, variables: { slug, limit } }),
    });
    if (!res.ok) return [];
    const payload = (await res.json()) as {
      data?: {
        getPlayerRankingsFromSelection?: {
          rank?: number | null;
          playerEntity?: {
            position?: string | null;
            player?: {
              id?: number | null;
              fullName?: string | null;
              primaryPosition?: { abbreviation?: string | null } | null;
            } | null;
          } | null;
        }[];
      };
    };
    const out: {
      rank: number;
      playerId: number;
      name: string | null;
      position: string | null;
    }[] = [];
    for (const row of payload.data?.getPlayerRankingsFromSelection ?? []) {
      const id = Number(row.playerEntity?.player?.id);
      const rank = Number(row.rank);
      if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(rank) || rank <= 0) continue;
      out.push({
        rank,
        playerId: id,
        name: row.playerEntity?.player?.fullName ?? null,
        position:
          row.playerEntity?.position ??
          row.playerEntity?.player?.primaryPosition?.abbreviation ??
          null,
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function loadPipelineSelectionSlug(
  slug: string,
  limit: number,
): Promise<
  {
    rank: number;
    playerId: number;
    name: string | null;
    position: string | null;
  }[]
> {
  // Browser CORS blocks data-graph.mlb.com — prefer the sports edge proxy.
  const proxied = await invokeSports<{
    rows?: {
      rank?: number;
      playerId?: number;
      name?: string | null;
      position?: string | null;
    }[];
  }>({ action: "pipelineSelection", slug, limit });
  if (proxied?.rows?.length) {
    return proxied.rows
      .map((r) => ({
        rank: Number(r.rank),
        playerId: Number(r.playerId),
        name: r.name ?? null,
        position: r.position ?? null,
      }))
      .filter(
        (r) =>
          Number.isFinite(r.rank) &&
          r.rank > 0 &&
          Number.isFinite(r.playerId) &&
          r.playerId > 0,
      );
  }
  return loadPipelineSelectionSlugDirect(slug, limit);
}

async function loadOrgRankMap(teamId: number, year: number): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  let orgId = teamId;
  if (!mlbClubSlug(orgId)) {
    try {
      const raw = (await mlbGet(`teams/${teamId}`)) as {
        teams?: { parentOrgId?: number }[];
      };
      const parent = Number(raw.teams?.[0]?.parentOrgId);
      if (Number.isFinite(parent) && parent > 0 && mlbClubSlug(parent)) orgId = parent;
    } catch {
      /* keep teamId */
    }
  }
  const club = mlbClubSlug(orgId);
  if (!club) return map;
  // Full org Top-30 (+ buffer) so AAA/AA/High-A/A matchups catch ranked prospects.
  for (const slug of [`sel-pr-${year}-${club}`, `sel-pr-${year - 1}-${club}`]) {
    const rows = await loadPipelineSelectionSlug(slug, 50);
    if (!rows.length) continue;
    for (const row of rows) map.set(row.playerId, row.rank);
    break;
  }
  return map;
}

async function loadTop100RankRows(
  year: number,
  limit = 100,
): Promise<
  {
    rank: number;
    playerId: number;
    name: string | null;
    position: string | null;
  }[]
> {
  for (const slug of [`sel-pr-${year}-top100`, `sel-pr-${year - 1}-top100`]) {
    const rows = await loadPipelineSelectionSlug(slug, limit);
    if (rows.length) return rows;
  }
  return [];
}

/**
 * Org Pipeline ranks for the given clubs + league Top-100.
 * Org and Top-100 stay in separate maps so both can be shown on a player.
 */
async function resolveMlbParentOrgId(teamId: number): Promise<number | null> {
  if (mlbClubSlug(teamId)) return teamId;
  try {
    const raw = (await mlbGet(`teams/${teamId}`)) as {
      teams?: { parentOrgId?: number }[];
    };
    const parent = Number(raw.teams?.[0]?.parentOrgId);
    if (Number.isFinite(parent) && parent > 0 && mlbClubSlug(parent)) return parent;
  } catch {
    /* ignore */
  }
  return null;
}

export async function fetchProspectRankMaps(opts?: {
  teamIds?: number[];
}): Promise<MlbProspectRankMaps> {
  const year = new Date().getFullYear();
  const teamIds = [...new Set((opts?.teamIds ?? [138]).filter((id) => Number.isFinite(id) && id > 0))];
  const org = new Map<number, number>();
  const orgClubId = new Map<number, number>();

  // Resolve every club to its MLB parent so MiLB games load BOTH orgs' Pipeline lists
  // (e.g. Memphis → STL and Durham → TB), not only Cardinals seeds.
  const parentOrgs = (
    await Promise.all(teamIds.map((id) => resolveMlbParentOrgId(id)))
  ).filter((id): id is number => id != null);
  const mlbOrgIds = [
    ...new Set([...teamIds, ...parentOrgs].filter((id) => Boolean(mlbClubSlug(id)))),
  ];

  await Promise.all(
    mlbOrgIds.map(async (mlbOrgId) => {
      const map = await loadOrgRankMap(mlbOrgId, year);
      for (const [playerId, rank] of map) {
        const prev = org.get(playerId);
        if (prev == null || rank < prev) {
          org.set(playerId, rank);
          orgClubId.set(playerId, mlbOrgId);
        }
      }
    }),
  );

  // Cardinals seeds fill gaps when GraphQL lags (STL MLB or any Cardinals affiliate).
  if (mlbOrgIds.includes(138)) {
    for (const seed of CARDINALS_PROSPECT_SEEDS) {
      if (seed.playerId && !org.has(seed.playerId)) {
        org.set(seed.playerId, seed.rank);
        orgClubId.set(seed.playerId, 138);
      }
    }
  }

  const top100 = new Map<number, number>();
  for (const row of await loadTop100RankRows(year, 100)) {
    top100.set(row.playerId, row.rank);
  }

  return { org, top100, orgClubId };
}

/** @deprecated Prefer fetchProspectRankMaps — kept for older call sites. */
export async function fetchCardinalsPipelineRankMap(): Promise<Map<number, number>> {
  const maps = await fetchProspectRankMaps({ teamIds: [138] });
  // Prefer Top-100 display number when present, else org (legacy single-number callers).
  const out = new Map<number, number>(maps.org);
  for (const [id, rank] of maps.top100) out.set(id, rank);
  return out;
}

export type MlbProspectCard = Omit<MlbProspectSeed, "playerId"> & {
  playerId: number | null;
  teamName: string | null;
  teamId: number | null;
  level: string | null;
};

async function resolveProspectPerson(
  playerId: number,
): Promise<{ teamName: string | null; teamId: number | null; level: string | null }> {
  try {
    const person = (await mlbGet(`people/${playerId}`, {
      hydrate: "currentTeam,currentTeam.sport",
    })) as {
      people?: {
        currentTeam?: {
          id?: number;
          name?: string;
          sport?: { name?: string };
        };
      }[];
    };
    const team = person.people?.[0]?.currentTeam;
  return {
    teamId: team?.id ?? null,
    teamName: team?.name ?? null,
    level: team?.sport?.name ?? null,
  };
  } catch {
    return { teamName: null, teamId: null, level: null };
  }
}

/** MLB Pipeline Top-100 list for the Prospects page. */
export async function fetchMlbTop100Prospects(limit = 100): Promise<MlbProspectCard[]> {
  const year = new Date().getFullYear();
  const rows = await loadTop100RankRows(year, limit);
  if (!rows.length) return [];

  const people = await fetchMlbPeopleByIds(rows.map((r) => r.playerId));
  return rows.map((row) => {
    const person = people.get(row.playerId);
    const orgId = person?.parentOrgId ?? person?.teamId ?? null;
    return {
      rank: row.rank,
      name: row.name ?? person?.name ?? `Player #${row.playerId}`,
      position: row.position ?? person?.position ?? "—",
      playerId: row.playerId,
      teamName: orgId ? teamNameFromId(orgId) ?? person?.teamName ?? null : person?.teamName ?? null,
      teamId: orgId,
      level: person?.sportName ?? null,
      pipelineNote: "MLB Top 100",
    } satisfies MlbProspectCard;
  });
}

export type MlbFarmSystemRow = {
  rank: number;
  teamId: number;
  teamName: string;
  abbrev: string;
  top100Count: number;
  bestRank: number | null;
};

function teamNameFromId(teamId: number): string | null {
  const names: Record<number, string> = {
    108: "Los Angeles Angels",
    109: "Arizona Diamondbacks",
    110: "Baltimore Orioles",
    111: "Boston Red Sox",
    112: "Chicago Cubs",
    113: "Cincinnati Reds",
    114: "Cleveland Guardians",
    115: "Colorado Rockies",
    116: "Detroit Tigers",
    117: "Houston Astros",
    118: "Kansas City Royals",
    119: "Los Angeles Dodgers",
    120: "Washington Nationals",
    121: "New York Mets",
    133: "Athletics",
    134: "Pittsburgh Pirates",
    135: "San Diego Padres",
    136: "Seattle Mariners",
    137: "San Francisco Giants",
    138: "St. Louis Cardinals",
    139: "Tampa Bay Rays",
    140: "Texas Rangers",
    141: "Toronto Blue Jays",
    142: "Minnesota Twins",
    143: "Philadelphia Phillies",
    144: "Atlanta Braves",
    145: "Chicago White Sox",
    146: "Miami Marlins",
    147: "New York Yankees",
    158: "Milwaukee Brewers",
  };
  return names[teamId] ?? null;
}

/**
 * Farm-system board derived from MLB Pipeline Top 100 occupancy.
 * Orgs ranked by Top-100 count, then by best (lowest) prospect rank.
 */
export async function fetchMlbFarmSystemRankings(): Promise<MlbFarmSystemRow[]> {
  const top = await fetchMlbTop100Prospects(100);
  const byOrg = new Map<
    number,
    { count: number; best: number; name: string }
  >();
  for (const p of top) {
    const orgId = p.teamId;
    if (orgId == null || !mlbClubSlug(orgId)) continue;
    const cur = byOrg.get(orgId) ?? {
      count: 0,
      best: 999,
      name: p.teamName || teamNameFromId(orgId) || `Team ${orgId}`,
    };
    cur.count += 1;
    cur.best = Math.min(cur.best, p.rank);
    if (p.teamName) cur.name = teamNameFromId(orgId) || p.teamName;
    byOrg.set(orgId, cur);
  }

  // Include clubs with zero Top-100 reps so every org has a farm rank slot.
  for (const teamId of Object.keys(MLB_TEAM_ABBREV).map(Number)) {
    if (byOrg.has(teamId)) continue;
    byOrg.set(teamId, {
      count: 0,
      best: 999,
      name: teamNameFromId(teamId) ?? `Team ${teamId}`,
    });
  }

  const sorted = [...byOrg.entries()].sort((a, b) => {
    if (b[1].count !== a[1].count) return b[1].count - a[1].count;
    return a[1].best - b[1].best || a[1].name.localeCompare(b[1].name);
  });

  return sorted.map(([teamId, info], i) => ({
    rank: i + 1,
    teamId,
    teamName: info.name,
    abbrev: MLB_TEAM_ABBREV[teamId] ?? String(teamId),
    top100Count: info.count,
    bestRank: info.count > 0 ? info.best : null,
  }));
}

export async function fetchCardinalsProspectWatch(): Promise<MlbProspectCard[]> {
  const searchNames = CARDINALS_PROSPECT_SEEDS.flatMap((p) => [p.name, ...(p.aliases ?? [])]);
  const [ids, ranks] = await Promise.all([
    searchMlbPlayersByNames(searchNames, 40),
    fetchProspectRankMaps({ teamIds: [138] }),
  ]);
  const out: MlbProspectCard[] = [];
  for (const seed of CARDINALS_PROSPECT_SEEDS) {
    let id =
      seed.playerId ??
      ids.get(normalizePersonName(seed.name)) ??
      null;
    if (id == null) {
      for (const alias of seed.aliases ?? []) {
        id = ids.get(normalizePersonName(alias)) ?? null;
        if (id != null) break;
      }
    }
    const team = id != null ? await resolveProspectPerson(id) : {
      teamName: null,
      teamId: null,
      level: null,
    };
    const orgRank = id != null ? ranks.org.get(id) ?? seed.rank : seed.rank;
    const top100Rank = id != null ? ranks.top100.get(id) ?? null : null;
    out.push({
      ...seed,
      rank: orgRank,
      playerId: id,
      teamName: team.teamName,
      teamId: team.teamId,
      level: team.level,
      pipelineNote: top100Rank != null ? `Top 100 #${top100Rank}` : seed.pipelineNote,
    });
  }
  out.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  return out;
}

export async function fetchCardinalsFarmAffiliates(): Promise<MlbFarmAffiliate[]> {
  const season = currentSeason();
  // Single-A and up only (skip Rookie / complex: 15, 16).
  const raw = (await mlbGet("teams", {
    sportIds: "11,12,13,14",
    season: String(season),
    hydrate: "sport",
  })) as {
    teams?: {
      id?: number;
      name?: string;
      teamName?: string;
      parentOrgId?: number;
      sport?: { id?: number; name?: string };
    }[];
  };
  const levelOrder = ["Triple-A", "Double-A", "High-A", "Single-A"];
  const affiliates = (raw.teams ?? [])
    .filter((t) => t.parentOrgId === 138 && t.id)
    .filter((t) => {
      const level = t.sport?.name ?? "";
      return !/rookie|complex|dsl|acl|fcl/i.test(level);
    })
    .map((t) => ({
      teamId: t.id!,
      name: t.name ?? "Affiliate",
      shortName: t.teamName ?? t.name ?? "Affiliate",
      level: t.sport?.name ?? "MiLB",
      sportId: t.sport?.id ?? 0,
    }));
  affiliates.sort((a, b) => {
    const ia = levelOrder.findIndex((l) => a.level.includes(l));
    const ib = levelOrder.findIndex((l) => b.level.includes(l));
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.name.localeCompare(b.name);
  });
  return affiliates;
}

export type MlbFarmRosterPlayer = {
  id: number;
  name: string;
  position: string | null;
  number: string | null;
};

export async function fetchFarmRoster(teamId: number): Promise<MlbFarmRosterPlayer[]> {
  const raw = (await mlbGet(`teams/${teamId}/roster`, { rosterType: "active" })) as {
    roster?: {
      person?: { id?: number; fullName?: string };
      jerseyNumber?: string;
      position?: { abbreviation?: string };
    }[];
  };
  return (raw.roster ?? [])
    .filter((r) => r.person?.id && r.person.fullName)
    .map((r) => ({
      id: r.person!.id!,
      name: r.person!.fullName!,
      position: r.position?.abbreviation ?? null,
      number: r.jerseyNumber ?? null,
    }));
}

export type MlbPersonLite = {
  id: number;
  name: string;
  firstName: string;
  lastName: string;
  position: string | null;
  number: string | null;
  teamId: number | null;
  teamName: string | null;
  /** MLB club when currentTeam is a farm affiliate. */
  parentOrgId: number | null;
  sportId: number | null;
  sportName: string | null;
};

/** Batch-resolve people ids → names/teams (for tagged prospect lists). */
export async function fetchMlbPeopleByIds(
  ids: Array<number | string>,
): Promise<Map<number, MlbPersonLite>> {
  const unique = [
    ...new Set(
      ids.map((id) => Number(id)).filter((n) => Number.isFinite(n) && n > 0),
    ),
  ].slice(0, 120);
  const out = new Map<number, MlbPersonLite>();
  if (!unique.length) return out;
  // Stats API accepts comma-separated personIds.
  const chunkSize = 40;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    try {
      const raw = (await mlbGet("people", {
        personIds: chunk.join(","),
        hydrate: "currentTeam,currentTeam.sport",
      })) as {
        people?: {
          id?: number;
          fullName?: string;
          firstName?: string;
          lastName?: string;
          primaryNumber?: string;
          primaryPosition?: { abbreviation?: string };
          currentTeam?: {
            id?: number;
            name?: string;
            parentOrgId?: number;
            sport?: { id?: number; name?: string };
          };
        }[];
      };
      for (const p of raw.people ?? []) {
        if (!p.id) continue;
        const teamId = p.currentTeam?.id ?? null;
        const parent = p.currentTeam?.parentOrgId ?? null;
        out.set(p.id, {
          id: p.id,
          name: p.fullName ?? `Player #${p.id}`,
          firstName: p.firstName ?? "",
          lastName: p.lastName ?? "",
          position: p.primaryPosition?.abbreviation ?? null,
          number: p.primaryNumber ?? null,
          teamId,
          teamName: p.currentTeam?.name ?? null,
          parentOrgId:
            parent && Number.isFinite(parent) && parent > 0
              ? parent
              : teamId && mlbClubSlug(teamId)
                ? teamId
                : parent ?? null,
          sportId: p.currentTeam?.sport?.id ?? null,
          sportName: p.currentTeam?.sport?.name ?? null,
        });
      }
    } catch {
      /* skip chunk */
    }
  }
  return out;
}

export type MlbScoutingReport = {
  playerId: number;
  playerName: string;
  pipelineRank: number | null;
  eta: string | null;
  position: string | null;
  gradesLine: string | null;
  grades: { label: string; value: string }[];
  paragraphs: string[];
  pipelineUrl: string;
};

/** MLB Pipeline grades + narrative. Returns null for vets / players without a report. */
export async function fetchMlbPipelineScoutingReport(
  playerId: number | string,
): Promise<MlbScoutingReport | null> {
  const id = Number(playerId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const data = await invokeSports<{
    found?: boolean;
    playerId?: number;
    playerName?: string;
    rank?: number | null;
    eta?: string | null;
    position?: string | null;
    gradesLine?: string | null;
    grades?: { label: string; value: string }[];
    paragraphs?: string[];
    pipelineUrl?: string;
  }>({ action: "pipelineScouting", playerId: id });
  if (!data?.found || !data.gradesLine) return null;
  return {
    playerId: data.playerId ?? id,
    playerName: data.playerName ?? "",
    pipelineRank: data.rank ?? null,
    eta: data.eta ?? null,
    position: data.position ?? null,
    gradesLine: data.gradesLine,
    grades: data.grades ?? [],
    paragraphs: data.paragraphs ?? [],
    pipelineUrl:
      data.pipelineUrl ??
      `https://www.mlb.com/prospects/${id}`,
  };
}

export type MlbFarmGameWrap = {
  gamePk: number;
  title: string;
  snippet: string;
  contentHtml: string;
  publishedAt: string;
  level: string;
  affiliateTeamId: number;
  officialDate: string;
  /** Away + home MLB team ids for list thumbnails. */
  logoTeamIds: number[];
  image: string | null;
};

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Box-score digests for Cardinals affiliates over the last N days. */
export async function fetchCardinalsFarmGameWraps(days = 5): Promise<MlbFarmGameWrap[]> {
  const affiliates = await fetchCardinalsFarmAffiliates();
  if (!affiliates.length) return [];

  const end = chicagoToday();
  const start = addDaysIso(end, -(Math.max(1, days) - 1));
  const affiliateIds = new Set(affiliates.map((a) => a.teamId));
  const levelByTeam = new Map(affiliates.map((a) => [a.teamId, a]));

  type SchedGame = {
    gamePk: number;
    officialDate: string;
    gameDate: string | null;
    status: string;
    abstract: string;
    awayName: string;
    homeName: string;
    awayAbbrev: string;
    homeAbbrev: string;
    awayId: number;
    homeId: number;
    awayScore: number | null;
    homeScore: number | null;
    sportId: number;
  };

  const games: SchedGame[] = [];
  const seen = new Set<number>();

  await Promise.all(
    affiliates.map(async (aff) => {
      if (!aff.sportId) return;
      try {
        const raw = (await mlbGet("schedule", {
          sportId: String(aff.sportId),
          teamId: String(aff.teamId),
          startDate: start,
          endDate: end,
          hydrate: "linescore,team,decisions",
        })) as {
          dates?: {
            date?: string;
            games?: {
              gamePk?: number;
              gameDate?: string;
              officialDate?: string;
              status?: { detailedState?: string; abstractGameState?: string };
              teams?: {
                away?: {
                  score?: number;
                  team?: { id?: number; name?: string; abbreviation?: string };
                };
                home?: {
                  score?: number;
                  team?: { id?: number; name?: string; abbreviation?: string };
                };
              };
              linescore?: {
                teams?: {
                  away?: { runs?: number };
                  home?: { runs?: number };
                };
              };
            }[];
          }[];
        };
        for (const day of raw.dates ?? []) {
          for (const g of day.games ?? []) {
            const pk = g.gamePk;
            if (!pk || seen.has(pk)) continue;
            const abstract = g.status?.abstractGameState ?? "";
            if (abstract !== "Final") continue;
            // Belt-and-suspenders: never surface Rookie / complex wraps.
            if (aff.sportId === 15 || aff.sportId === 16) continue;
            if (/rookie|complex|dsl|acl|fcl/i.test(aff.level)) continue;
            seen.add(pk);
            const away = g.teams?.away;
            const home = g.teams?.home;
            games.push({
              gamePk: pk,
              officialDate: g.officialDate ?? day.date ?? end,
              gameDate: g.gameDate ?? null,
              status: g.status?.detailedState ?? abstract,
              abstract,
              awayName: away?.team?.name ?? "Away",
              homeName: home?.team?.name ?? "Home",
              awayAbbrev: away?.team?.abbreviation ?? "AWAY",
              homeAbbrev: home?.team?.abbreviation ?? "HOME",
              awayId: away?.team?.id ?? 0,
              homeId: home?.team?.id ?? 0,
              awayScore: g.linescore?.teams?.away?.runs ?? away?.score ?? null,
              homeScore: g.linescore?.teams?.home?.runs ?? home?.score ?? null,
              sportId: aff.sportId,
            });
          }
        }
      } catch {
        /* skip affiliate day */
      }
    }),
  );

  games.sort((a, b) => {
    const da = a.gameDate ? Date.parse(a.gameDate) : Date.parse(a.officialDate);
    const db = b.gameDate ? Date.parse(b.gameDate) : Date.parse(b.officialDate);
    return db - da;
  });

  const limited = games.slice(0, 28);
  const wraps: MlbFarmGameWrap[] = [];

  const concurrency = 3;
  for (let i = 0; i < limited.length; i += concurrency) {
    const chunk = limited.slice(i, i + concurrency);
    const settled = await Promise.all(
      chunk.map(async (g) => {
        const affiliateTeamId = affiliateIds.has(g.awayId)
          ? g.awayId
          : affiliateIds.has(g.homeId)
            ? g.homeId
            : g.awayId;
        const aff = levelByTeam.get(affiliateTeamId);
        const level = aff?.level ?? "MiLB";
        const scoreLine =
          g.awayScore != null && g.homeScore != null
            ? `${g.awayAbbrev} ${g.awayScore}, ${g.homeAbbrev} ${g.homeScore}`
            : `${g.awayAbbrev} @ ${g.homeAbbrev}`;
        const title = `${level}: ${scoreLine}`;

        let snippet = `Final — ${g.awayName} at ${g.homeName}. Full box score.`;
        // Reader opens the live box via app:mlb-game — keep HTML as a short fallback only.
        let contentHtml = `<p><strong>${escHtml(level)}</strong> · ${escHtml(scoreLine)}</p><p>Open for the full box score.</p>`;

        try {
          const live = (await fetch(
            `https://statsapi.mlb.com/api/v1.1/game/${g.gamePk}/feed/live`,
            { headers: { Accept: "application/json" } },
          ).then((r) => (r.ok ? r.json() : null))) as {
            liveData?: {
              decisions?: {
                winner?: { fullName?: string };
                loser?: { fullName?: string };
                save?: { fullName?: string };
              };
            };
            gameData?: { venue?: { name?: string } };
          } | null;

          const box = (await mlbGet(`game/${g.gamePk}/boxscore`)) as {
            teams?: {
              away?: {
                teamStats?: { batting?: { runs?: number; hits?: number; errors?: number } };
              };
              home?: {
                teamStats?: { batting?: { runs?: number; hits?: number; errors?: number } };
              };
            };
          };

          const decisions = live?.liveData?.decisions;
          const wp = decisions?.winner?.fullName;
          const lp = decisions?.loser?.fullName;
          const sv = decisions?.save?.fullName;
          const venue = live?.gameData?.venue?.name;

          const awayBat = box.teams?.away?.teamStats?.batting;
          const homeBat = box.teams?.home?.teamStats?.batting;
          const rhes =
            awayBat && homeBat
              ? `${g.awayAbbrev} ${awayBat.runs ?? g.awayScore ?? "—"}-${awayBat.hits ?? "—"}-${awayBat.errors ?? "—"} · ${g.homeAbbrev} ${homeBat.runs ?? g.homeScore ?? "—"}-${homeBat.hits ?? "—"}-${homeBat.errors ?? "—"}`
              : scoreLine;

          const decisionsLine = [wp ? `WP ${wp}` : null, lp ? `LP ${lp}` : null, sv ? `SV ${sv}` : null]
            .filter(Boolean)
            .join(" · ");

          snippet = [rhes, decisionsLine, venue].filter(Boolean).join(" · ").slice(0, 280);
          contentHtml = `
            <p><strong>${escHtml(level)}</strong> · ${escHtml(rhes)}${venue ? ` · ${escHtml(venue)}` : ""}</p>
            ${decisionsLine ? `<p>${escHtml(decisionsLine)}</p>` : ""}
            <p><a href="/sports/mlb/game/${g.gamePk}">Full box score</a></p>
          `.trim();
        } catch {
          /* keep schedule fallback */
        }

        const publishedAt =
          g.gameDate ||
          `${g.officialDate}T23:00:00-05:00`;

        return {
          gamePk: g.gamePk,
          title,
          snippet,
          contentHtml,
          publishedAt,
          level,
          affiliateTeamId,
          officialDate: g.officialDate,
          logoTeamIds: [g.awayId, g.homeId].filter((id) => id > 0),
          image: mlbTeamLogo(affiliateTeamId),
        } satisfies MlbFarmGameWrap;
      }),
    );
    for (const w of settled) {
      if (w) wraps.push(w);
    }
  }

  wraps.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  return wraps;
}
