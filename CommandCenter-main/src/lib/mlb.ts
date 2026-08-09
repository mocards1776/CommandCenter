/** MLB Stats API helpers — scoreboard, standings, leaders, player cards. */

import { supabase } from "./supabase";

const MLB = "https://statsapi.mlb.com/api/v1";
const ESPN_STANDINGS = "https://site.api.espn.com/apis/v2/sports/baseball/mlb/standings";

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
  stats: MlbPlayerStatLine[];
};

export type MlbPlayerCard = {
  id: number;
  name: string;
  firstName: string;
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
  primaryColor: string | null;
  headshot: string;
  actionShot: string;
  /** Wide hero backdrop (16:9 action crop). */
  heroBackdrop: string;
  hitting: MlbPlayerStatLine[];
  pitching: MlbPlayerStatLine[];
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
  managerOfYear: number;
};

export type MlbManagerRumor = {
  title: string;
  url: string;
  source: string;
  channel?: string;
};

export type MlbManager = {
  id: number;
  name: string;
  teamId: number;
  teamName: string;
  teamAbbrev: string;
  record: string;
  wins: number;
  losses: number;
  winPct: number;
  gb: string;
  playoffOdds: number | null;
  divisionRank: number | null;
  contractNote: string | null;
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
};

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
  const pushText = (raw: string) => {
    const text = stripHtml(raw)
      .replace(/\u00a0/g, " ")
      .replace(/—\s*—/g, "—")
      .replace(/\s+/g, " ");
    if (text) parts.push({ kind: "text", text });
  };
  while ((m = re.exec(html))) {
    if (m.index > last) pushText(html.slice(last, m.index));
    const href = m[1];
    const label = stripHtml(m[2]).trim();
    const playerMatch = href.match(/\/mlb\/player\/_\/id\/(\d+)\//i);
    const teamMatch = href.match(/\/mlb\/team\/_\/name\/([a-z0-9]+)\//i);
    if (playerMatch) {
      const key = normalizePersonName(label);
      parts.push({
        kind: "player",
        text: label,
        playerId: nameToPlayerId.get(key) ?? null,
        espnId: playerMatch[1],
      });
    } else if (teamMatch) {
      parts.push({
        kind: "team",
        text: label,
        teamId: mlbTeamIdFromEspnAbbrev(teamMatch[1]),
      });
    } else if (/^https?:/i.test(href) && !/apnews\.com\/hub\/mlb/i.test(href)) {
      parts.push({ kind: "ext", text: label, href });
    } else {
      pushText(label);
    }
    last = m.index + m[0].length;
  }
  if (last < html.length) pushText(html.slice(last));
  return parts;
}

export function normalizePersonName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function buildPlayerNameIndex(
  players: { id: number; name: string }[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of players) {
    map.set(normalizePersonName(p.name), p.id);
    const bits = p.name.split(/\s+/);
    if (bits.length >= 2) {
      map.set(normalizePersonName(`${bits[0][0]} ${bits[bits.length - 1]}`), p.id);
      map.set(normalizePersonName(bits[bits.length - 1]), p.id);
    }
  }
  return map;
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

function chicagoToday(): string {
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
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Chicago",
      hour: "numeric",
      minute: "2-digit",
    });
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

export function mlbHeadshot(playerId: number | string, size: 213 | 426 = 213): string {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_${size},q_auto:best/v1/people/${playerId}/headshot/67/current`;
}

/**
 * Primary color team mark (bird-on-bat for STL, etc.).
 * Pair with a white disc (`TeamMark`) on dark backgrounds.
 */
export function mlbTeamLogo(teamId: number | string): string {
  return `https://www.mlbstatic.com/team-logos/team-primary-on-light/${teamId}.svg`;
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
  ab: number;
  r: number;
  h: number;
  rbi: number;
  bb: number;
  so: number;
  summary: string;
};

export type MlbBoxscorePitcher = {
  id: number;
  name: string;
  note: string | null;
  ip: string;
  h: number;
  r: number;
  er: number;
  bb: number;
  so: number;
  summary: string;
};

export type MlbBoxscoreSide = {
  teamId: number;
  name: string;
  abbrev: string;
  runs: number;
  hits: number;
  errors: number;
  batters: MlbBoxscoreBatter[];
  pitchers: MlbBoxscorePitcher[];
};

export type MlbBoxscore = {
  gamePk: number;
  status: string;
  when: string | null;
  venue: string | null;
  attendance: number | null;
  gameDurationMinutes: number | null;
  weather: string | null;
  officialDate: string | null;
  innings: { num: number; away: number | null; home: number | null }[];
  away: MlbBoxscoreSide;
  home: MlbBoxscoreSide;
};

export type MlbGameRecap = {
  espnEventId: string;
  headline: string;
  description: string | null;
  storyHtml: string;
  storyText: string;
  url: string;
};

export type MlbRecentBlock = {
  label: string;
  games: number;
  stats: MlbPlayerStatLine[];
};

type BoxTeamRaw = {
  team?: { id?: number; name?: string; abbreviation?: string };
  teamStats?: {
    batting?: { runs?: number; hits?: number };
    fielding?: { errors?: number };
  };
  batters?: number[];
  pitchers?: number[];
  players?: Record<
    string,
    {
      person?: { fullName?: string };
      position?: { abbreviation?: string };
      stats?: {
        batting?: Record<string, unknown>;
        pitching?: Record<string, unknown>;
      };
    }
  >;
};

function mapBoxSide(
  raw: BoxTeamRaw | undefined,
  fallback: { id?: number; name?: string; abbreviation?: string } | undefined,
  rh: { runs?: number; hits?: number; errors?: number } | undefined,
): MlbBoxscoreSide {
  const team = raw?.team ?? fallback;
  const players = raw?.players ?? {};
  const batters = (raw?.batters ?? [])
    .map((id) => {
      const p = players[`ID${id}`];
      const b = p?.stats?.batting;
      if (!p || !b) return null;
      return {
        id,
        name: p.person?.fullName ?? "—",
        position: p.position?.abbreviation ?? "",
        ab: Number(b.atBats ?? 0),
        r: Number(b.runs ?? 0),
        h: Number(b.hits ?? 0),
        rbi: Number(b.rbi ?? 0),
        bb: Number(b.baseOnBalls ?? 0),
        so: Number(b.strikeOuts ?? 0),
        summary: String(b.summary ?? ""),
      } satisfies MlbBoxscoreBatter;
    })
    .filter((x): x is MlbBoxscoreBatter => x != null);

  const pitchers = (raw?.pitchers ?? [])
    .map((id) => {
      const p = players[`ID${id}`];
      const s = p?.stats?.pitching;
      if (!p || !s) return null;
      return {
        id,
        name: p.person?.fullName ?? "—",
        note: s.note ? String(s.note) : null,
        ip: String(s.inningsPitched ?? "0.0"),
        h: Number(s.hits ?? 0),
        r: Number(s.runs ?? 0),
        er: Number(s.earnedRuns ?? 0),
        bb: Number(s.baseOnBalls ?? 0),
        so: Number(s.strikeOuts ?? 0),
        summary: String(s.summary ?? ""),
      } satisfies MlbBoxscorePitcher;
    })
    .filter((x): x is MlbBoxscorePitcher => x != null);

  return {
    teamId: team?.id ?? 0,
    name: team?.name ?? "—",
    abbrev: team?.abbreviation ?? teamAbbrev(team),
    runs: rh?.runs ?? Number(raw?.teamStats?.batting?.runs ?? 0),
    hits: rh?.hits ?? Number(raw?.teamStats?.batting?.hits ?? 0),
    errors: rh?.errors ?? Number(raw?.teamStats?.fielding?.errors ?? 0),
    batters,
    pitchers,
  };
}

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
        status?: { detailedState?: string };
        datetime?: { dateTime?: string; officialDate?: string };
        venue?: { name?: string };
        weather?: { condition?: string; temp?: string; wind?: string };
        gameInfo?: { attendance?: number; gameDurationMinutes?: number };
        teams?: {
          away?: { id?: number; name?: string; abbreviation?: string };
          home?: { id?: number; name?: string; abbreviation?: string };
        };
      };
      liveData?: {
        linescore?: {
          innings?: { num?: number; away?: { runs?: number }; home?: { runs?: number } }[];
          teams?: {
            away?: { runs?: number; hits?: number; errors?: number };
            home?: { runs?: number; hits?: number; errors?: number };
          };
        };
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
  return {
    gamePk: Number(pk),
    status: live?.gameData?.status?.detailedState ?? "Final",
    when: fmtWhen(live?.gameData?.datetime?.dateTime),
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
    away: mapBoxSide(box.teams?.away, live?.gameData?.teams?.away, ls?.teams?.away),
    home: mapBoxSide(box.teams?.home, live?.gameData?.teams?.home, ls?.teams?.home),
  };
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** ESPN game wrap / recap for an MLB game (matched by date + team abbrevs). */
export async function fetchEspnGameRecap(
  officialDate: string | null | undefined,
  homeAbbrev: string,
  awayAbbrev: string,
): Promise<MlbGameRecap | null> {
  if (!officialDate) return null;
  const ymd = officialDate.replace(/-/g, "");
  try {
    const boardRes = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${ymd}`,
      { headers: { Accept: "application/json" } },
    );
    if (!boardRes.ok) return null;
    const board = (await boardRes.json()) as {
      events?: {
        id?: string;
        competitions?: {
          competitors?: { homeAway?: string; team?: { abbreviation?: string } }[];
        }[];
      }[];
    };
    const home = homeAbbrev.toUpperCase();
    const away = awayAbbrev.toUpperCase();
    const event = (board.events ?? []).find((e) => {
      const comps = e.competitions?.[0]?.competitors ?? [];
      const h = comps.find((c) => c.homeAway === "home")?.team?.abbreviation?.toUpperCase();
      const a = comps.find((c) => c.homeAway === "away")?.team?.abbreviation?.toUpperCase();
      return h === home && a === away;
    });
    if (!event?.id) return null;

    const sumRes = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${event.id}`,
      { headers: { Accept: "application/json" } },
    );
    if (!sumRes.ok) return null;
    const sum = (await sumRes.json()) as {
      article?: {
        headline?: string;
        description?: string;
        story?: string;
        links?: { web?: { href?: string } };
      };
    };
    const article = sum.article;
    if (!article?.headline || !article.story) return null;
    return {
      espnEventId: event.id,
      headline: article.headline,
      description: article.description ?? null,
      storyHtml: article.story,
      storyText: stripHtml(article.story),
      url:
        article.links?.web?.href ??
        `https://www.espn.com/mlb/recap/_/gameId/${event.id}`,
    };
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

export async function fetchMlbScoreboard(date = chicagoToday()): Promise<MlbScoreGame[]> {
  const raw = (await mlbGet("schedule", {
    sportId: "1",
    date,
    hydrate: "linescore,team,probablePitcher,venue",
  })) as {
    dates?: {
      date?: string;
      games?: {
        gamePk?: number;
        gameDate?: string;
        officialDate?: string;
        status?: { detailedState?: string; abstractGameState?: string };
        venue?: { name?: string };
        linescore?: {
          currentInningOrdinal?: string;
          inningState?: string;
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
  return games.map((g) => {
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
    ): MlbScoreSide => ({
      teamId: s?.team?.id ?? 0,
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
    });
    return {
      id: String(g.gamePk ?? g.gameDate),
      status: g.status?.detailedState ?? abstract,
      abstractState: abstract,
      live,
      final,
      inning: inn,
      away: side(g.teams?.away, g.linescore?.teams?.away),
      home: side(g.teams?.home, g.linescore?.teams?.home),
      when: fmtWhen(g.gameDate),
      whenShort: fmtWhenShort(g.gameDate),
      venue: g.venue?.name ?? null,
      officialDate: g.officialDate ?? raw.dates?.[0]?.date ?? null,
      gameDate: g.gameDate ?? null,
    };
  });
}

function teamInGame(g: MlbScoreGame, teamId: number): boolean {
  return g.away.teamId === teamId || g.home.teamId === teamId;
}

/** Live first, else today's unfinished, else latest final. */
export function pickHeroGame(games: MlbScoreGame[]): MlbScoreGame | null {
  if (!games.length) return null;
  return (
    games.find((g) => g.live) ??
    games.find((g) => !g.final && g.abstractState !== "Final") ??
    [...games].reverse().find((g) => g.final) ??
    games[0]
  );
}

/**
 * Featured team game:
 * - live always wins
 * - after a final, keep showing that final until 10:00 AM America/Chicago
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

  if (hour < 10) {
    const yday = addDaysIso(date, -1);
    const boardY = await fetchMlbScoreboard(yday);
    const yFinal = [...boardY]
      .reverse()
      .find((g) => teamInGame(g, teamId) && g.final);
    if (yFinal) return yFinal;
    const todayFinal = [...today].reverse().find((g) => g.final);
    if (todayFinal) return todayFinal;
  }

  const preview = today.find((g) => !g.final);
  if (preview) return preview;

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
    const url = pickPlayback(v.playbacks);
    if (!url) continue;
    out.push({
      id: String(v.id ?? v.slug ?? v.title),
      title: v.title || v.headline || "Highlight",
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
        const blob = [
          v.title,
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
          title: v.title || v.headline || "Highlight",
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

/** Word-boundary match — "Assigned" must NOT match "Signed". */
const ACQUISITION_TYPE =
  /^(Drafted|Trade|Traded|Signed|Claimed|Selected|Purchase|Purchased|Free Agent|Rule 5|Waivers)$/i;

function txPriority(type: string): number {
  if (/^trade/i.test(type)) return 0;
  if (/^draft/i.test(type)) return 1;
  if (/^sign/i.test(type)) return 2;
  if (/^selected|purchase|claim|rule\s*5|waiver|free agent/i.test(type)) return 3;
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
    .sort((a, b) => {
      const pd = txPriority(a.type) - txPriority(b.type);
      if (pd !== 0) return pd;
      return b.date.localeCompare(a.date);
    });
}

/**
 * Curated “how he got here” story — trade to current club first,
 * then draft / original signing. Never bury the trade under minor-league assignments.
 */
export function buildAcquisitionStory(
  transactions: MlbTransaction[],
  extras: string[] = [],
  teamName?: string | null,
): { headline: string | null; lines: string[] } {
  const teamHint = (teamName ?? "").replace(/^St\.\s*/i, "").split(/\s+/)[0] || "";
  const trade =
    transactions.find(
      (t) =>
        /^trade/i.test(t.type) &&
        (!teamHint || new RegExp(teamHint, "i").test(t.description)),
    ) ?? transactions.find((t) => /^trade/i.test(t.type));
  const draft = transactions.find((t) => /^draft/i.test(t.type));
  const signed = transactions.find((t) => /^sign/i.test(t.type));
  const selected = transactions.find((t) => /selected|purchase|claim|rule\s*5/i.test(t.type));

  const lines: string[] = [];
  let headline: string | null = null;

  if (trade) {
    headline = `${trade.date}: ${trade.description}`;
    lines.push(headline);
  }
  if (draft) {
    const line = `${draft.date}: ${draft.description}`;
    if (!lines.includes(line)) lines.push(line);
    if (!headline) headline = line;
  }
  if (signed) {
    const line = `${signed.date}: ${signed.description}`;
    if (!lines.includes(line)) lines.push(line);
    if (!headline) headline = line;
  }
  if (selected) {
    const line = `${selected.date}: ${selected.description}`;
    if (!lines.includes(line)) lines.push(line);
  }

  for (const extra of extras) {
    const cleaned = extra.trim();
    if (cleaned && !lines.some((l) => l.includes(cleaned) || cleaned.includes(l))) {
      lines.push(cleaned);
    }
  }

  // Cap secondary noise
  return { headline, lines: lines.slice(0, 8) };
}

function mapContractPayload(data: unknown): MlbPlayerContract | null {
  if (!data || typeof data !== "object") return null;
  const d = data as {
    error?: string;
    contractStatus?: string | null;
    currentSalary?: MlbPlayerContract["currentSalary"];
    salaryHistory?: MlbPlayerContract["salaryHistory"];
    acquisition?: string[];
    url?: string;
    source?: string;
    aav?: string | null;
    totalValue?: string | null;
  };
  if (d.error && !d.contractStatus && !d.currentSalary) return null;
  const hasAnything =
    Boolean(d.contractStatus) ||
    Boolean(d.currentSalary?.display) ||
    Boolean(d.totalValue) ||
    Boolean(d.aav) ||
    (d.salaryHistory?.length ?? 0) > 0;
  if (!hasAnything) return null;
  return {
    contractStatus: d.contractStatus ?? null,
    currentSalary: d.currentSalary ?? null,
    salaryHistory: d.salaryHistory ?? [],
    acquisition: d.acquisition ?? [],
    url: d.url ?? null,
    source: d.source ?? "baseball-reference",
    aav: d.aav ?? null,
    totalValue: d.totalValue ?? null,
  };
}

export async function fetchPlayerContract(
  playerName: string,
  opts?: { url?: string | null },
): Promise<MlbPlayerContract | null> {
  const name = playerName.trim();
  if (name.length < 3) return null;

  // BBRef first — more reliable salary tables than Spotrac search from the edge.
  const attempts: { action: string; body: Record<string, unknown> }[] = [
    { action: "bbref", body: { action: "bbref", name } },
    {
      action: "contract",
      body: { action: "contract", name, ...(opts?.url ? { url: opts.url } : {}) },
    },
  ];

  let lastError: Error | null = null;
  for (const attempt of attempts) {
    try {
      const { data, error } = await supabase.functions.invoke("sports", {
        body: attempt.body,
      });
      if (error) {
        lastError = new Error(error.message || `${attempt.action} failed`);
        continue;
      }
      const mapped = mapContractPayload(data);
      if (mapped) return mapped;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  if (lastError) throw lastError;
  return null;
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
): Promise<MlbRecentBlock | null> {
  const id = Number(playerId);
  const keys = group === "pitching" ? SPLIT_PITCH_KEYS : SPLIT_HIT_KEYS;
  try {
    const raw = (await mlbGet(`people/${id}/stats`, {
      stats: "lastXGames",
      group,
      season: String(season),
      limit: String(games),
      gameType: "R",
    })) as {
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
    const raw = (await mlbGet("stats", {
      stats: "season",
      group,
      season: String(season),
      sportId: "1",
      playerPool: "qualified",
      limit: "400",
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

/** Season situational splits (home/away, vs L/R, day/night). */
export async function fetchMlbPlayerSplits(
  playerId: number | string,
  group: "hitting" | "pitching",
  season = currentSeason(),
): Promise<MlbSplitRow[]> {
  const id = Number(playerId);
  const raw = (await mlbGet(`people/${id}/stats`, {
    stats: "statSplits",
    group,
    season: String(season),
    sitCodes: "h,a,vl,vr,d,n",
  })) as {
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
      const stats = pickStats(sp.stat, keys);
      if (!stats.length) continue;
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
  return name
    .replace("National League ", "NL ")
    .replace("American League ", "AL ")
    .replace("Central", "Central")
    .replace("East", "East")
    .replace("West", "West");
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
        winningPercentage?: string;
        streak?: { streakCode?: string };
      }[];
    };
    const rows: MlbStandingRow[] = (rec.teamRecords ?? []).map((r) => {
      const name = r.team?.name ?? "—";
      const odds =
        oddsMap.get(name.toLowerCase()) ||
        oddsMap.get((r.team?.teamName ?? "").toLowerCase()) ||
        oddsMap.get((r.team?.abbreviation ?? "").toLowerCase());
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

export async function fetchMlbLeaders(limit = 8): Promise<MlbLeaderBoard[]> {
  const season = String(currentSeason());
  const boards = await Promise.all(
    LEADER_DEFS.map(async (def) => {
      try {
        const raw = (await mlbGet("stats/leaders", {
          leaderCategories: def.category,
          season,
          sportId: "1",
          statGroup: def.group,
          limit: String(limit),
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
        return { key: def.key, label: def.label, group: def.group, leaders };
      } catch {
        return { key: def.key, label: def.label, group: def.group, leaders: [] as MlbLeader[] };
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

async function fetchYearByYearRows(
  playerId: number,
  group: "hitting" | "pitching",
): Promise<MlbPlayerSeasonRow[]> {
  try {
    const raw = (await mlbGet(`people/${playerId}/stats`, {
      stats: "yearByYear",
      group,
      sportId: "1",
    })) as {
      stats?: {
        splits?: {
          season?: string;
          team?: { id?: number; name?: string; abbreviation?: string };
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
        stats,
      });
    }
    // Newest first for the table
    rows.sort((a, b) => b.season - a.season);
    return rows;
  } catch {
    return [];
  }
}

export async function fetchMlbPlayer(playerId: number | string): Promise<MlbPlayerCard> {
  const season = currentSeason();
  const id = Number(playerId);
  const [raw, yearByYearHitting, yearByYearPitching] = await Promise.all([
    mlbGet(`people/${id}`, {
      hydrate: `currentTeam,draft,education,stats(group=[hitting,pitching],type=[season,career],season=${season})`,
    }) as Promise<{
      people?: {
        id?: number;
        fullName?: string;
        firstName?: string;
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
        currentTeam?: { id?: number; name?: string; abbreviation?: string };
        stats?: {
          group?: { displayName?: string };
          type?: { displayName?: string };
          splits?: { stat?: Record<string, unknown> }[];
        }[];
      }[];
    }>,
    fetchYearByYearRows(id, "hitting"),
    fetchYearByYearRows(id, "pitching"),
  ]);

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
    primaryColor: teamId != null ? TEAM_COLORS[teamId] ?? "d9515c" : "d9515c",
    headshot: mlbHeadshot(p.id ?? id, 426),
    actionShot: mlbActionShot(p.id ?? id),
    heroBackdrop: mlbHeroBackdrop(p.id ?? id),
    hitting,
    pitching,
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

export async function fetchMlbPlayerGameLog(
  playerId: number | string,
  group: "hitting" | "pitching",
  limit = 10,
  season = currentSeason(),
): Promise<MlbGameLogEntry[]> {
  const id = Number(playerId);
  const keys = group === "pitching" ? SPLIT_PITCH_KEYS : SPLIT_HIT_KEYS;
  const raw = (await mlbGet(`people/${id}/stats`, {
    stats: "gameLog",
    group,
    season: String(season),
    gameType: "R",
  })) as {
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
}> {
  const data = await invokeSports<{
    photo?: string | null;
    interim?: boolean;
    shortLeash?: boolean;
  }>({
    action: "managerPhoto",
    name,
  });
  return {
    photo: data?.photo ?? null,
    interim: Boolean(data?.interim),
    shortLeash: Boolean(data?.shortLeash),
  };
}

async function fetchManagerPhoto(name: string): Promise<string | null> {
  return (await fetchManagerPhotoMeta(name)).photo;
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
  const primary = roster.find((c) => {
    const job = (c.job || "").trim();
    const title = (c.title || "").trim();
    return job === "Manager" || title === "Manager";
  });
  if (primary?.person?.id) return primary;
  return (
    roster.find((c) => isInterimManagerRole(coachRole(c)) && c.person?.id) ?? null
  );
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
  managerOfYearWins?: number;
};

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
export async function fetchMlbManagers(): Promise<MlbManager[]> {
  const season = currentSeason();
  const [teamsRaw, standings] = await Promise.all([
    mlbGet("teams", { sportId: "1", season: String(season) }) as Promise<{
      teams?: { id?: number; name?: string; abbreviation?: string }[];
    }>,
    fetchMlbStandings(),
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
        const isInterim = isInterimManagerRole(role);

        let yearsWithTeam = 1;
        for (let y = season - 1; y >= season - 20; y--) {
          const prev = await managerIdForTeamSeason(team.id, y);
          if (prev !== mgrId) break;
          yearsWithTeam += 1;
        }

        const st = standingByTeam.get(team.id);
        const wins = st?.wins ?? 0;
        const losses = st?.losses ?? 0;
        const gp = wins + losses;
        const winPct = gp > 0 ? wins / gp : 0.5;
        const playoff = parseOddsPercent(st?.playoff);

        // Keep the list light — avoid 30 parallel BBRef scrapes (they starve
        // managerCareer on the detail page). Detail fetches the real portrait.
        const [wiki, contractNote] = await Promise.all([
          fetchWikipediaCard(mgr.person.fullName),
          isInterim || yearsWithTeam <= 1
            ? fetchManagerContractNote(mgr.person.fullName)
            : Promise.resolve(null),
        ]);
        const headshot = wiki.image || mlbHeadshot(mgrId, 213);
        const interim = isInterim;
        // 1-year deals, explicit interim, or year-1 skippers deep under .500 = always hot.
        const shortLeash =
          interim ||
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
        });

        managers.push({
          id: mgrId,
          name: mgr.person.fullName,
          teamId: team.id,
          teamName: team.name ?? "—",
          teamAbbrev: team.abbreviation ?? "—",
          record: `${wins}-${losses}`,
          wins,
          losses,
          winPct,
          gb: st?.gb ?? "—",
          playoffOdds: playoff,
          divisionRank: st?.rank ? Number(st.rank) : null,
          contractNote,
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

  managers.sort((a, b) => b.hotSeatScore - a.hotSeatScore);
  return managers.map((m, i) => ({ ...m, hotSeatRank: i + 1 }));
}

export async function fetchMlbManagerDetail(managerId: number | string): Promise<MlbManagerDetail> {
  const id = Number(managerId);
  const all = await fetchMlbManagers();
  const base = all.find((m) => m.id === id);
  if (!base) throw new Error("Manager not found");

  const season = currentSeason();
  // Career seasons: prefer BBRef, but always also scan MLB coaches across clubs
  // so prior years still show when the edge scrape is slow/blocked.
  const [person, contractNote, wiki, txRaw, fallbackRecords, careerRaw, rumorsRaw, mlbSeasons] =
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
      if (/manager of the year/i.test(a.name)) return true;
      if (/world series/i.test(a.name) && managedYears.has(yr)) return true;
      if (/pennant|championship series/i.test(a.name) && managedYears.has(yr)) return true;
      return false;
    });

  const moyAwards = awards.filter((a) => /manager of the year/i.test(a.name));
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
          wsAwards.length,
        ),
        managerOfYear: Math.max(careerRaw?.managerOfYearWins ?? 0, moyAwards.length),
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
          worldSeriesAppearances: wsAwards.length,
          managerOfYear: moyAwards.length,
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
    (base.headshot && !base.headshot.includes("mlbstatic.com") ? base.headshot : null) ||
    wiki.image ||
    null;
  if (!headshot || headshot.includes("mlbstatic.com")) {
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

  const lines = await Promise.all(
    players.map(async (f) => {
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
            summary: game.summary || `${game.stats.map((s) => `${s.label} ${s.value}`).join(" · ")}`,
            opponent: game.opponent,
            isHome: game.isHome,
            isWin: game.isWin,
            stats: game.stats.slice(0, 6),
            group,
            played: true,
          } satisfies FavoriteYesterdayLine;
        } catch {
          /* try next group */
        }
      }
      return {
        playerId: f.playerId,
        playerName: f.playerName,
        teamName: f.teamName ?? null,
        position: f.position ?? null,
        date,
        summary: "Did not play",
        opponent: "—",
        isHome: true,
        isWin: null,
        stats: [],
        group: isPitcher ? "pitching" : "hitting",
        played: false,
      } satisfies FavoriteYesterdayLine;
    }),
  );

  return { date, lines };
}
