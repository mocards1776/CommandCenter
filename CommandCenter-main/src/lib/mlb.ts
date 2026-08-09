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
  venue: string | null;
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
  hitting: MlbPlayerStatLine[];
  pitching: MlbPlayerStatLine[];
  careerHitting: MlbPlayerStatLine[];
  careerPitching: MlbPlayerStatLine[];
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

/** Crisp SVG team mark — use on scoreboards / standings. */
export function mlbTeamLogo(teamId: number | string): string {
  return `https://www.mlbstatic.com/team-logos/${teamId}.svg`;
}

export function mlbActionShot(playerId: number | string): string {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:action:hero:current.jpg/r_max,c_fill,g_auto,w_800,h_1000,q_auto:best/v1/people/${playerId}/action/hero/current`;
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
      games?: {
        gamePk?: number;
        gameDate?: string;
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
            probablePitcher?: { fullName?: string };
          };
          home?: {
            score?: number;
            team?: { id?: number; name?: string; abbreviation?: string; teamName?: string };
            leagueRecord?: { wins?: number; losses?: number };
            probablePitcher?: { fullName?: string };
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
      venue: g.venue?.name ?? null,
    };
  });
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

export async function fetchTeamCurrentGame(teamId: number): Promise<MlbScoreGame | null> {
  const date = chicagoToday();
  const board = await fetchMlbScoreboard(date);
  const today = board.filter((g) => g.away.teamId === teamId || g.home.teamId === teamId);
  if (today.length) return pickHeroGame(today);

  const season = currentSeason();
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
    const dayBoard = await fetchMlbScoreboard(day.date);
    const hit = dayBoard.find((g) => g.id === String(pk));
    if (hit) return hit;
  }

  // Fall back to most recent final so the team drawer always has a hero card
  const past = (await mlbGet("schedule", {
    sportId: "1",
    teamId: String(teamId),
    startDate: `${season}-03-01`,
    endDate: date,
    hydrate: "linescore,team,probablePitcher,venue",
  })) as { dates?: { date?: string; games?: { gamePk?: number; status?: { abstractGameState?: string } }[] }[] };

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

export async function fetchPlayerContract(playerName: string): Promise<MlbPlayerContract | null> {
  try {
    const { data, error } = await supabase.functions.invoke("sports", {
      body: { action: "contract", name: playerName },
    });
    if (error) throw error;
    if (!data || (data as { error?: string }).error) return null;
    const d = data as {
      contractStatus?: string | null;
      currentSalary?: MlbPlayerContract["currentSalary"];
      salaryHistory?: MlbPlayerContract["salaryHistory"];
      acquisition?: string[];
      url?: string;
      source?: string;
      aav?: string | null;
      totalValue?: string | null;
    };
    return {
      contractStatus: d.contractStatus ?? null,
      currentSalary: d.currentSalary ?? null,
      salaryHistory: d.salaryHistory ?? [],
      acquisition: d.acquisition ?? [],
      url: d.url ?? null,
      source: d.source ?? "spotrac",
      aav: d.aav ?? null,
      totalValue: d.totalValue ?? null,
    };
  } catch {
    return null;
  }
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
      else hitting = pickStats(stat, HIT_KEYS);
    }
    if (group.includes("pitching")) {
      if (type.includes("career")) careerPitching = pickStats(stat, PITCH_KEYS);
      else pitching = pickStats(stat, PITCH_KEYS);
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
    hitting,
    pitching,
    careerHitting,
    careerPitching,
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

async function fetchManagerContractNote(name: string): Promise<string | null> {
  try {
    const { data } = await supabase.functions.invoke("sports", {
      body: { action: "contract", name },
    });
    if (!data || (data as { error?: string }).error) return null;
    const d = data as { contractStatus?: string | null };
    return d.contractStatus ?? null;
  } catch {
    return null;
  }
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
        })) as {
          roster?: {
            job?: string;
            title?: string;
            person?: { id?: number; fullName?: string };
          }[];
        };
        const mgr = (coaches.roster ?? []).find((c) => {
          const job = (c.job || c.title || "").trim();
          return job === "Manager";
        });
        if (!mgr?.person?.id || !mgr.person.fullName) return;
        const st = standingByTeam.get(team.id);
        const wins = st?.wins ?? 0;
        const losses = st?.losses ?? 0;
        const gp = wins + losses;
        const winPct = gp > 0 ? wins / gp : 0.5;
        const gbNum = st?.gb === "—" || !st?.gb ? 0 : parseFloat(st.gb) || 0;
        const playoff =
          st?.playoff != null ? parseFloat(String(st.playoff).replace("%", "")) : null;
        // Heat: losing + out of race + deep GB. Contract detail loaded on manager page.
        const score =
          (1 - winPct) * 45 +
          Math.min(gbNum, 25) * 1.6 +
          (playoff != null ? (100 - playoff) * 0.25 : 20) +
          (st?.rank && Number(st.rank) >= 4 ? 6 : 0);
        managers.push({
          id: mgr.person.id,
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
          contractNote: null,
          hotSeatScore: Math.round(score * 10) / 10,
          headshot: mlbHeadshot(mgr.person.id, 213),
          primaryColor: TEAM_COLORS[team.id] ?? "d9515c",
        });
      } catch {
        // skip team
      }
    }),
  );

  managers.sort((a, b) => b.hotSeatScore - a.hotSeatScore);
  return managers.map((m, i) => ({ ...m, hotSeatRank: i + 1 }));
}

async function fetchWikipediaExtract(name: string): Promise<string | null> {
  try {
    const title = name.trim().replace(/\s+/g, "_");
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { extract?: string; type?: string };
    if (data.type === "disambiguation") return null;
    return data.extract?.trim() || null;
  } catch {
    return null;
  }
}

export async function fetchMlbManagerDetail(managerId: number | string): Promise<MlbManagerDetail> {
  const id = Number(managerId);
  const all = await fetchMlbManagers();
  const base = all.find((m) => m.id === id);
  if (!base) throw new Error("Manager not found");

  const season = currentSeason();
  const [person, contractNote, wikiExtract, txRaw] = await Promise.all([
    mlbGet(`people/${id}`, {
      hydrate: "currentTeam,education,stats(group=[hitting],type=[yearByYear])",
    }) as Promise<{
      people?: {
        fullName?: string;
        birthDate?: string;
        currentAge?: number;
        birthCity?: string;
        birthStateProvince?: string;
        birthCountry?: string;
        education?: { colleges?: { name?: string }[]; highschools?: { name?: string }[] };
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
    fetchWikipediaExtract(base.name),
    mlbGet("transactions", {
      playerId: String(id),
      startDate: "1990-01-01",
      endDate: `${season}-12-31`,
    }).catch(() => ({ transactions: [] })) as Promise<{
      transactions?: { date?: string; typeDesc?: string; description?: string }[];
    }>,
  ]);

  const p = person.people?.[0];
  const place = [p?.birthCity, p?.birthStateProvince, p?.birthCountry].filter(Boolean).join(", ");
  const school =
    p?.education?.colleges?.[0]?.name ?? p?.education?.highschools?.[0]?.name ?? null;

  let hotSeatScore = base.hotSeatScore;
  if (contractNote && /through 202[89]|2029|2030|extension/i.test(contractNote)) {
    hotSeatScore = Math.max(0, hotSeatScore - 8);
  }
  if (contractNote && /2026|lame.?duck|final year/i.test(contractNote) && base.winPct < 0.48) {
    hotSeatScore += 10;
  }

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

  // Team hire / managerial markers from the club's transaction feed (best-effort).
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
        /manager|hired|named|promoted/i.test(desc)
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
    base.hotSeatRank <= 5 ? "Blazing" : base.hotSeatRank <= 12 ? "Warm" : base.hotSeatRank <= 20 ? "Cool" : "Safe";

  const careerNotes: string[] = [
    wikiExtract ?? `${base.name} is the manager of the ${base.teamName}.`,
    `Current record: ${base.record} (${(base.winPct * 100).toFixed(1)}% · ${base.gb} GB).`,
    base.divisionRank != null ? `Division rank: ${base.divisionRank}.` : "",
    base.playoffOdds != null ? `Playoff odds: ${base.playoffOdds.toFixed(1)}%.` : "",
    contractNote ? `Contract: ${contractNote}.` : "Contract terms not published.",
    school ? `School: ${school}.` : "",
    place ? `Born: ${place}.` : "",
    `Hot seat: #${base.hotSeatRank} of 30 — ${heatLabel} (score ${Math.round(hotSeatScore * 10) / 10}).`,
    playingCareer.length
      ? `MLB playing career: ${playingCareer.length} season${playingCareer.length === 1 ? "" : "s"} on record.`
      : "No MLB playing seasons on record (coach/manager track).",
  ].filter(Boolean);

  return {
    ...base,
    contractNote,
    hotSeatScore: Math.round(hotSeatScore * 10) / 10,
    age: p?.currentAge ?? ageFromBirthDate(p?.birthDate),
    birthDate: p?.birthDate ?? null,
    birthPlace: place || null,
    bio: wikiExtract ?? contractNote,
    careerNotes,
    school,
    wikiExtract,
    timeline: timeline.slice(-24),
    playingCareer,
  };
}
