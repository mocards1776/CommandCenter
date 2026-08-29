/** College football via ESPN — scoreboard, RUWT, hot seat, player pages. */

import { parseEspnBroadcasts, type GameBroadcast } from "./game-broadcasts";
import { supabase } from "./supabase";
import { formatSportsDateLong } from "./utils";

const ESPN = "https://site.api.espn.com/apis/site/v2/sports/football/college-football";
const ESPN_WEB = "https://site.web.api.espn.com/apis/common/v3/sports/football/college-football";
const CORE =
  "https://sports.core.api.espn.com/v2/sports/football/leagues/college-football";

export function chicagoTodayCfb(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

export function cfbTeamLogo(teamId: string | number): string {
  return `https://a.espncdn.com/i/teamlogos/ncaa/500/${teamId}.png`;
}

export function cfbHeadshot(playerId: string | number, size = 350): string {
  return `https://a.espncdn.com/combiner/i?img=/i/headshots/college-football/players/full/${playerId}.png&w=${size}&h=${size}`;
}

/** Programs surfaced in RUWT interest + hot seat (FBS focus). */
export const CFB_FOCUS_TEAMS: { id: number; name: string; abbrev: string }[] = [
  { id: 142, name: "Missouri", abbrev: "MIZ" },
  { id: 333, name: "Alabama", abbrev: "ALA" },
  { id: 2, name: "Auburn", abbrev: "AUB" },
  { id: 8, name: "Arkansas", abbrev: "ARK" },
  { id: 57, name: "Florida", abbrev: "FLA" },
  { id: 61, name: "Georgia", abbrev: "UGA" },
  { id: 96, name: "Kentucky", abbrev: "UK" },
  { id: 99, name: "LSU", abbrev: "LSU" },
  { id: 145, name: "Ole Miss", abbrev: "MISS" },
  { id: 201, name: "Mississippi State", abbrev: "MSST" },
  { id: 263, name: "Tennessee", abbrev: "TENN" },
  { id: 245, name: "Texas A&M", abbrev: "TAMU" },
  { id: 228, name: "Texas", abbrev: "TEX" },
  { id: 251, name: "Texas Tech", abbrev: "TTU" },
  { id: 239, name: "Baylor", abbrev: "BAY" },
  { id: 262, name: "Oklahoma", abbrev: "OU" },
  { id: 2305, name: "Kansas State", abbrev: "KSU" },
  { id: 2306, name: "Kansas", abbrev: "KU" },
  { id: 52, name: "Florida State", abbrev: "FSU" },
  { id: 153, name: "North Carolina", abbrev: "UNC" },
  { id: 150, name: "Duke", abbrev: "DUKE" },
  { id: 258, name: "Virginia", abbrev: "UVA" },
  { id: 130, name: "Michigan", abbrev: "MICH" },
  { id: 194, name: "Ohio State", abbrev: "OSU" },
  { id: 213, name: "Penn State", abbrev: "PSU" },
  { id: 77, name: "Northwestern", abbrev: "NW" },
  { id: 356, name: "Illinois", abbrev: "ILL" },
  { id: 275, name: "Wisconsin", abbrev: "WIS" },
  { id: 2294, name: "Iowa", abbrev: "IOWA" },
  { id: 164, name: "Rutgers", abbrev: "RUT" },
  { id: 87, name: "Notre Dame", abbrev: "ND" },
  { id: 2483, name: "Oregon", abbrev: "ORE" },
  { id: 254, name: "Utah", abbrev: "UTAH" },
  { id: 30, name: "USC", abbrev: "USC" },
  { id: 26, name: "UCLA", abbrev: "UCLA" },
  { id: 9, name: "Arizona State", abbrev: "ASU" },
  { id: 12, name: "Arizona", abbrev: "ARIZ" },
  { id: 25, name: "California", abbrev: "CAL" },
  { id: 38, name: "Colorado", abbrev: "COLO" },
  { id: 59, name: "Georgia Tech", abbrev: "GT" },
  { id: 183, name: "Syracuse", abbrev: "SYR" },
  { id: 221, name: "Pitt", abbrev: "PITT" },
  { id: 103, name: "Boston College", abbrev: "BC" },
  { id: 152, name: "NC State", abbrev: "NCST" },
  { id: 154, name: "Wake Forest", abbrev: "WAKE" },
  { id: 2390, name: "Miami", abbrev: "MIA" },
  { id: 97, name: "Louisville", abbrev: "LOU" },
  { id: 235, name: "Memphis", abbrev: "MEM" },
  { id: 242, name: "Boise State", abbrev: "BOIS" },
];

export type CfbScoreSide = {
  teamId: number;
  name: string;
  abbrev: string;
  score: number | null;
  record: string | null;
  logo: string | null;
  color: string;
  /** Official poll rank (1–25 only). ESPN uses 99 as unranked sentinel. */
  rank: number | null;
  /** ESPN FPI ordinal across FBS (can be 26–130+). */
  fpiRank: number | null;
};

export type CfbLiveSituation = {
  downDistanceText: string | null;
  possessionText: string | null;
  yardLine: number | null;
  isRedZone: boolean;
  possessionTeamId: string | null;
  lastPlayText: string | null;
};

export type CfbScoreGame = {
  id: string;
  status: string;
  shortDetail: string | null;
  live: boolean;
  final: boolean;
  away: CfbScoreSide;
  home: CfbScoreSide;
  when: string | null;
  whenShort: string | null;
  venue: string | null;
  date: string | null;
  broadcasts: GameBroadcast[];
  /** ESPN period number (1–4 regulation, 5+ OT). */
  period: number | null;
  situation: CfbLiveSituation | null;
};

export type CfbScoredGame = CfbScoreGame & {
  score: number;
  reasons: string[];
};

export type CfbRuwtContext = {
  teamInterest: Record<string, number>;
  watchTeamIds?: Set<string>;
};

export type CfbCoach = {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  teamAbbrev: string;
  teamLogo: string | null;
  teamColor: string;
  headshot: string | null;
  recordSummary: string | null;
  wins: number;
  losses: number;
  winPct: number | null;
  hotSeatScore: number;
  hotSeatRank: number;
  firedOddsPct: number | null;
  firedOddsAmerican: string | null;
  kalshiUrl: string | null;
  factors: { label: string; points: number; detail: string }[];
};

export type CfbCoachProfile = CfbCoach & {
  bio: string | null;
  careerHighlights: string[];
};

export type CfbScoringPlay = {
  id: string;
  text: string;
  clock: string | null;
  teamAbbrev: string | null;
};

export type CfbBoxPlayerRow = {
  id: string;
  name: string;
  stats: string[];
};

export type CfbBoxStatGroup = {
  teamAbbrev: string;
  name: string;
  labels: string[];
  athletes: CfbBoxPlayerRow[];
};

export type CfbTeamGameStat = {
  teamAbbrev: string;
  label: string;
  value: string;
};

export type CfbGameDetail = CfbScoreGame & {
  scoringPlays: CfbScoringPlay[];
  boxGroups: CfbBoxStatGroup[];
  teamStats: CfbTeamGameStat[];
  article: {
    headline: string;
    description: string | null;
    storyHtml: string | null;
  } | null;
  /** Pregame extras from ESPN summary when box/article are empty. */
  oddsLine: string | null;
  predictor: { homeWinPct: number | null; awayWinPct: number | null } | null;
  lastFive: {
    teamId: number;
    teamAbbrev: string;
    results: { label: string; result: string; score: string | null }[];
  }[];
  venueDetail: string | null;
};

export type CfbPlayerProfile = {
  id: string;
  name: string;
  number: string | null;
  position: string | null;
  positionName: string | null;
  teamId: string | null;
  teamName: string | null;
  teamAbbrev: string | null;
  teamColor: string | null;
  teamLogo: string | null;
  headshot: string | null;
  height: string | null;
  weight: string | null;
  age: number | null;
  classYear: string | null;
  birthPlace: string | null;
  experience: string | null;
  bio: string | null;
  status: string | null;
  seasonStats: { label: string; value: string }[];
  statCategories: { name: string; stats: { label: string; value: string }[] }[];
  seasonSplits: {
    season: string;
    categories: { name: string; stats: { label: string; value: string }[] }[];
  }[];
  gameLogCategories: {
    name: string;
    labels: string[];
    rows: {
      eventId: string | null;
      date: string | null;
      week: number | null;
      opponent: string;
      atVs: string | null;
      result: string;
      score: string | null;
      stats: { label: string; value: string }[];
    }[];
  }[];
  recentGames: { label: string; result: string; line: string }[];
  news: { headline: string; description: string; image: string | null; href: string | null }[];
};

function parseScore(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function chicagoDateFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

/** Official Top 25 only — ESPN marks unranked teams as curatedRank=99. */
export function cfbPollRank(raw: number | null | undefined): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  if (raw < 1 || raw > 25) return null;
  return raw;
}

let fpiRankCache: { map: Map<number, number>; fetchedAt: number } | null = null;
const FPI_CACHE_MS = 30 * 60 * 1000;

/** ESPN Football Power Index ranks for all FBS teams (ordinal 1…N). */
export async function fetchCfbFpiRanks(): Promise<Map<number, number>> {
  const now = Date.now();
  if (fpiRankCache && now - fpiRankCache.fetchedAt < FPI_CACHE_MS) {
    return fpiRankCache.map;
  }
  const map = new Map<number, number>();
  try {
    const url =
      "https://site.web.api.espn.com/apis/fitt/v3/sports/football/college-football/powerindex?limit=200";
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`FPI ${res.status}`);
    const data = (await res.json()) as {
      teams?: {
        team?: { id?: string };
        categories?: { name?: string; values?: number[]; names?: string[] }[];
      }[];
    };
    for (const row of data.teams ?? []) {
      const id = Number(row.team?.id);
      if (!id) continue;
      const fpi = (row.categories ?? []).find((c) => c.name === "fpi");
      if (!fpi?.values?.length) continue;
      const names = fpi.names ?? [];
      const rankIdx = names.indexOf("fpirank");
      const rankVal = rankIdx >= 0 ? fpi.values[rankIdx] : fpi.values[1];
      if (typeof rankVal === "number" && rankVal > 0) {
        map.set(id, Math.round(rankVal));
      }
    }
  } catch {
    /* keep empty — UI falls back to poll-only */
  }
  fpiRankCache = { map, fetchedAt: now };
  return map;
}

function mapCfbSituation(
  sit:
    | {
        downDistanceText?: string;
        possessionText?: string;
        yardLine?: number;
        isRedZone?: boolean;
        possession?: string;
        lastPlay?: { text?: string; team?: { id?: string } };
      }
    | null
    | undefined,
  live: boolean,
): CfbLiveSituation | null {
  if (!live || !sit) return null;
  return {
    downDistanceText: sit.downDistanceText ?? null,
    possessionText: sit.possessionText ?? null,
    yardLine: typeof sit.yardLine === "number" ? sit.yardLine : null,
    isRedZone: Boolean(sit.isRedZone),
    possessionTeamId: sit.possession ?? sit.lastPlay?.team?.id ?? null,
    lastPlayText: sit.lastPlay?.text ?? null,
  };
}

type EspnEvent = {
  id?: string;
  date?: string;
  competitions?: {
    venue?: { fullName?: string };
    status?: {
      period?: number;
      type?: {
        state?: string;
        completed?: boolean;
        description?: string;
        detail?: string;
        shortDetail?: string;
      };
    };
    broadcasts?: { market?: string; names?: string[] }[];
    geoBroadcasts?: {
      market?: { type?: string };
      media?: { shortName?: string; name?: string; logo?: string; darkLogo?: string };
    }[];
    competitors?: {
      homeAway?: string;
      score?: unknown;
      curatedRank?: { current?: number };
      records?: { type?: string; summary?: string }[];
      team?: {
        id?: string;
        displayName?: string;
        shortDisplayName?: string;
        abbreviation?: string;
        color?: string;
        logos?: { href?: string }[];
      };
    }[];
    situation?: Parameters<typeof mapCfbSituation>[0];
  }[];
};

type EspnCompetitor = {
  homeAway?: string;
  score?: unknown;
  curatedRank?: { current?: number };
  records?: { type?: string; summary?: string }[];
  team?: {
    id?: string;
    displayName?: string;
    shortDisplayName?: string;
    abbreviation?: string;
    color?: string;
    logos?: { href?: string }[];
  };
};

function sideFromCompetitor(
  c: EspnCompetitor,
  fpiByTeam?: Map<number, number>,
): CfbScoreSide {
  const team = c.team ?? {};
  const abbrev = team.abbreviation ?? "—";
  const overall = (c.records ?? []).find((r) => r.type === "total")?.summary ?? null;
  const teamId = Number(team.id) || 0;
  return {
    teamId,
    name: team.displayName ?? team.shortDisplayName ?? abbrev,
    abbrev,
    score: parseScore(c.score),
    record: overall,
    logo: team.logos?.[0]?.href ?? cfbTeamLogo(team.id ?? 0),
    color: (team.color ?? "555555").replace(/^#/, ""),
    rank: cfbPollRank(c.curatedRank?.current),
    fpiRank: teamId && fpiByTeam ? (fpiByTeam.get(teamId) ?? null) : null,
  };
}

function mapCfbEvent(
  event: EspnEvent,
  fpiByTeam?: Map<number, number>,
): CfbScoreGame | null {
  const comp = event.competitions?.[0];
  if (!comp) return null;
  const awayC = comp.competitors?.find((c) => c.homeAway === "away");
  const homeC = comp.competitors?.find((c) => c.homeAway === "home");
  if (!awayC?.team?.id || !homeC?.team?.id) return null;
  const st = comp.status?.type;
  const live = st?.state === "in";
  const final = Boolean(st?.completed);
  const iso = event.date ?? null;
  const whenDate = iso ? new Date(iso) : null;
  const whenShort =
    whenDate && !Number.isNaN(whenDate.getTime())
      ? whenDate.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: "America/Chicago",
          timeZoneName: "short",
        })
      : null;
  const periodRaw = comp.status?.period;
  const period =
    typeof periodRaw === "number" && Number.isFinite(periodRaw) && periodRaw > 0
      ? periodRaw
      : null;
  return {
    id: String(event.id ?? comp.status?.type?.detail ?? Math.random()),
    status: st?.description ?? st?.detail ?? "Scheduled",
    shortDetail: st?.shortDetail ?? st?.detail ?? null,
    live,
    final,
    away: sideFromCompetitor(awayC, fpiByTeam),
    home: sideFromCompetitor(homeC, fpiByTeam),
    when: iso ? formatSportsDateLong(iso) : null,
    whenShort,
    venue: comp.venue?.fullName ?? null,
    date: chicagoDateFromIso(iso),
    broadcasts: parseEspnBroadcasts(comp.geoBroadcasts, comp.broadcasts),
    period,
    situation: mapCfbSituation(comp.situation, live),
  };
}

export async function fetchCfbScoreboard(dates?: string): Promise<CfbScoreGame[]> {
  const [fpiByTeam, boardRes] = await Promise.all([
    fetchCfbFpiRanks().catch(() => new Map<number, number>()),
    fetch(dates ? `${ESPN}/scoreboard?dates=${dates}` : `${ESPN}/scoreboard`, {
      headers: { Accept: "application/json" },
    }),
  ]);
  if (!boardRes.ok) throw new Error(`CFB scoreboard ${boardRes.status}`);
  const raw = (await boardRes.json()) as { events?: EspnEvent[] };
  return (raw.events ?? [])
    .map((e) => mapCfbEvent(e, fpiByTeam))
    .filter((g): g is CfbScoreGame => Boolean(g?.id));
}

export async function fetchCfbGameDetail(eventId: string): Promise<CfbGameDetail> {
  const [fpiByTeam, res] = await Promise.all([
    fetchCfbFpiRanks().catch(() => new Map<number, number>()),
    fetch(`${ESPN}/summary?event=${encodeURIComponent(eventId)}`, {
      headers: { Accept: "application/json" },
    }),
  ]);
  if (!res.ok) throw new Error(`CFB summary ${res.status}`);
  const raw = (await res.json()) as {
    header?: {
      competitions?: (NonNullable<EspnEvent["competitions"]>[number] & {
        date?: string;
      })[];
      id?: string;
    };
    scoringPlays?: {
      id?: string;
      text?: string;
      clock?: { displayValue?: string };
      team?: { abbreviation?: string };
    }[];
    boxscore?: {
      teams?: {
        team?: { abbreviation?: string };
        statistics?: {
          name?: string;
          displayValue?: string;
          label?: string;
          abbreviation?: string;
        }[];
      }[];
      players?: {
        team?: { abbreviation?: string };
        statistics?: {
          name?: string;
          labels?: string[];
          athletes?: {
            athlete?: { id?: string; displayName?: string };
            stats?: string[];
          }[];
        }[];
      }[];
    };
    article?: { headline?: string; description?: string; story?: string };
    news?:
      | { articles?: { headline?: string; description?: string; story?: string }[] }
      | { headline?: string; description?: string; story?: string }[];
    pickcenter?: {
      details?: string;
      overUnder?: number;
      spread?: number;
    }[];
    odds?: { details?: string; overUnder?: number }[];
    predictor?: {
      homeTeam?: { gameProjection?: { winPercentage?: string } };
      awayTeam?: { gameProjection?: { winPercentage?: string } };
    };
    lastFiveGames?: {
      team?: { id?: string; abbreviation?: string };
      events?: {
        id?: string;
        gameDate?: string;
        score?: string;
        result?: string;
        opponent?: { abbreviation?: string; displayName?: string };
      }[];
    }[];
    gameInfo?: {
      venue?: { fullName?: string; address?: { city?: string; state?: string } };
      weather?: { displayValue?: string; temperature?: number };
    };
  };

  const headerComp = raw.header?.competitions?.[0];
  let base = headerComp
    ? mapCfbEvent(
        {
          id: eventId,
          date: headerComp.date,
          competitions: raw.header?.competitions,
        },
        fpiByTeam,
      )
    : null;
  if (!base) {
    // Fallback: current week board (may miss older/future events).
    const board = await fetchCfbScoreboard().catch(() => [] as CfbScoreGame[]);
    base = board.find((g) => g.id === String(eventId)) ?? null;
  }
  if (!base) throw new Error("CFB game not found");

  const boxGroups: CfbBoxStatGroup[] = [];
  for (const side of raw.boxscore?.players ?? []) {
    const abbrev = side.team?.abbreviation ?? "—";
    for (const group of side.statistics ?? []) {
      const gname = group.name ?? "stats";
      const labels = group.labels ?? [];
      const athletes: CfbBoxPlayerRow[] = [];
      for (const row of group.athletes ?? []) {
        const id = row.athlete?.id;
        if (!id) continue;
        athletes.push({
          id: String(id),
          name: row.athlete?.displayName ?? "—",
          stats: row.stats ?? [],
        });
      }
      if (athletes.length) {
        boxGroups.push({ teamAbbrev: abbrev, name: gname, labels, athletes });
      }
    }
  }

  const teamStats: CfbTeamGameStat[] = [];
  for (const side of raw.boxscore?.teams ?? []) {
    const abbrev = side.team?.abbreviation ?? "—";
    for (const s of side.statistics ?? []) {
      const label = s.label ?? s.abbreviation ?? s.name ?? "Stat";
      const value = s.displayValue ?? "—";
      if (!value || value === "—") continue;
      teamStats.push({ teamAbbrev: abbrev, label, value });
    }
  }

  const newsArticles = Array.isArray(raw.news)
    ? raw.news
    : (raw.news?.articles ?? []);
  const articleRaw =
    raw.article ??
    newsArticles.find(
      (a) =>
        a.headline &&
        !/fantasy|dfs|waiver|promo|presented by/i.test(
          `${a.headline} ${a.description ?? ""}`,
        ),
    ) ??
    newsArticles[0];

  const pick = raw.pickcenter?.[0] ?? raw.odds?.[0];
  const oddsLine = pick?.details
    ? `${pick.details}${pick.overUnder != null ? ` · O/U ${pick.overUnder}` : ""}`
    : null;

  const winPct = (rawPct: string | undefined) => {
    if (!rawPct) return null;
    const n = Number(rawPct);
    if (!Number.isFinite(n)) return null;
    return n <= 1 ? Math.round(n * 100) : Math.round(n);
  };
  const predictor =
    raw.predictor?.homeTeam || raw.predictor?.awayTeam
      ? {
          homeWinPct: winPct(raw.predictor.homeTeam?.gameProjection?.winPercentage),
          awayWinPct: winPct(raw.predictor.awayTeam?.gameProjection?.winPercentage),
        }
      : null;

  const lastFive = (raw.lastFiveGames ?? []).map((side) => ({
    teamId: Number(side.team?.id) || 0,
    teamAbbrev: side.team?.abbreviation ?? "—",
    results: (side.events ?? []).slice(0, 5).map((e) => ({
      label: e.opponent?.abbreviation ?? e.opponent?.displayName ?? "Opp",
      result: e.result ?? "—",
      score: e.score ?? null,
    })),
  }));

  const venueBits = [
    raw.gameInfo?.venue?.fullName || base.venue,
    raw.gameInfo?.venue?.address
      ? [raw.gameInfo.venue.address.city, raw.gameInfo.venue.address.state]
          .filter(Boolean)
          .join(", ")
      : null,
    raw.gameInfo?.weather?.displayValue
      ? `${raw.gameInfo.weather.temperature ?? ""}${
          raw.gameInfo.weather.temperature != null ? "° " : ""
        }${raw.gameInfo.weather.displayValue}`.trim()
      : null,
  ].filter(Boolean);

  return {
    ...base,
    venue: base.venue ?? raw.gameInfo?.venue?.fullName ?? null,
    scoringPlays: (raw.scoringPlays ?? []).map((s) => ({
      id: String(s.id ?? Math.random()),
      text: s.text ?? "",
      clock: s.clock?.displayValue ?? null,
      teamAbbrev: s.team?.abbreviation ?? null,
    })),
    boxGroups,
    teamStats,
    article: articleRaw?.headline
      ? {
          headline: articleRaw.headline,
          description: articleRaw.description ?? null,
          storyHtml: articleRaw.story ?? null,
        }
      : null,
    oddsLine,
    predictor,
    lastFive,
    venueDetail: venueBits.length ? venueBits.join(" · ") : null,
  };
}

export type CfbTeamPage = {
  id: string;
  name: string;
  abbrev: string;
  color: string;
  logo: string | null;
  record: string | null;
  standing: string | null;
  fpiRank: number | null;
  nextEvent: { id: string; name: string; date: string | null } | null;
  roster: {
    id: string;
    name: string;
    number: string | null;
    position: string | null;
    headshot: string | null;
  }[];
  recent: CfbScoreGame[];
};

export async function fetchCfbTeamPage(teamId: string): Promise<CfbTeamPage> {
  const id = String(teamId);
  const [fpiByTeam, teamRes, rosterRes] = await Promise.all([
    fetchCfbFpiRanks().catch(() => new Map<number, number>()),
    fetch(`${ESPN}/teams/${id}`, { headers: { Accept: "application/json" } }),
    fetch(`${ESPN}/teams/${id}/roster`, { headers: { Accept: "application/json" } }),
  ]);
  if (!teamRes.ok) throw new Error(`CFB team ${teamRes.status}`);
  const teamJson = (await teamRes.json()) as {
    team?: {
      id?: string;
      displayName?: string;
      abbreviation?: string;
      color?: string;
      logos?: { href?: string }[];
      record?: { items?: { type?: string; summary?: string }[] };
      standingSummary?: string;
      nextEvent?: { id?: string; name?: string; date?: string }[];
    };
  };
  const t = teamJson.team ?? {};
  const roster: CfbTeamPage["roster"] = [];
  if (rosterRes.ok) {
    const rosterJson = (await rosterRes.json()) as {
      athletes?: {
        items?: {
          id?: string;
          displayName?: string;
          jersey?: string;
          position?: { abbreviation?: string };
          headshot?: { href?: string };
        }[];
      }[];
    };
    for (const group of rosterJson.athletes ?? []) {
      for (const a of group.items ?? []) {
        if (!a.id) continue;
        roster.push({
          id: String(a.id),
          name: a.displayName ?? "—",
          number: a.jersey ?? null,
          position: a.position?.abbreviation ?? null,
          headshot: a.headshot?.href ?? cfbHeadshot(a.id, 200),
        });
      }
    }
  }

  const recentBoard = await fetchCfbScoreboard().catch(() => [] as CfbScoreGame[]);
  const recent = recentBoard.filter(
    (g) => String(g.away.teamId) === id || String(g.home.teamId) === id,
  );

  const next = t.nextEvent?.[0];
  return {
    id,
    name: t.displayName ?? "Team",
    abbrev: (t.abbreviation ?? "—").toUpperCase(),
    color: (t.color ?? "555555").replace(/^#/, ""),
    logo: t.logos?.[0]?.href ?? cfbTeamLogo(id),
    record: (t.record?.items ?? []).find((r) => r.type === "total")?.summary ?? null,
    standing: t.standingSummary ?? null,
    fpiRank: fpiByTeam.get(Number(id)) ?? null,
    nextEvent: next?.id
      ? { id: String(next.id), name: next.name ?? "Next game", date: next.date ?? null }
      : null,
    roster,
    recent,
  };
}

type FbsTeamRow = {
  id: number;
  name: string;
  abbrev: string;
  color: string;
  logo: string | null;
};

async function fetchCoreJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** All FBS teams for a season (group 80). */
export async function fetchFbsTeams(season = new Date().getFullYear()): Promise<FbsTeamRow[]> {
  const listUrl = `${CORE}/seasons/${season}/types/2/groups/80/teams?limit=200`;
  const list = await fetchCoreJson<{ items?: { $ref?: string }[] }>(listUrl);
  const refs = list?.items?.map((i) => i.$ref).filter(Boolean) ?? [];
  const rows: FbsTeamRow[] = [];
  const chunkSize = 12;
  for (let i = 0; i < refs.length; i += chunkSize) {
    const chunk = refs.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (ref) => {
        const team = await fetchCoreJson<{
          id?: string;
          displayName?: string;
          abbreviation?: string;
          color?: string;
          logos?: { href?: string }[];
        }>(ref!);
        if (!team?.id || !team.abbreviation) return;
        rows.push({
          id: Number(team.id),
          name: team.displayName ?? team.abbreviation,
          abbrev: team.abbreviation.toUpperCase(),
          color: (team.color ?? "555555").replace(/^#/, ""),
          logo: team.logos?.[0]?.href ?? cfbTeamLogo(team.id),
        });
      }),
    );
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

function dollarProb(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n === 0) return 0;
  return Math.max(0.01, Math.min(0.99, n));
}

function americanFromProb(p: number): string {
  if (p >= 0.5) return `-${Math.round((100 * p) / (1 - p))}`;
  return `+${Math.round((100 * (1 - p)) / p)}`;
}

type KalshiCfbCoachMarket = {
  name: string;
  teamAbbrev: string | null;
  teamHint: string | null;
  impliedPct: number;
  american: string;
  ticker: string;
  url: string;
};

function cfbAbbrevFromKalshiTicker(ticker: string): string | null {
  const parts = ticker.split("-");
  const tail = parts[parts.length - 1]?.toUpperCase();
  return tail && /^[A-Z0-9]{2,6}$/.test(tail) ? tail : null;
}

function cfbAbbrevFromKalshiSubtitle(hint: string | null): string | null {
  if (!hint) return null;
  const cleaned = hint.replace(/^:+\s*/, "").trim();
  for (const t of CFB_FOCUS_TEAMS) {
    if (cleaned.toLowerCase().includes(t.name.toLowerCase())) return t.abbrev;
  }
  return null;
}

/** Kalshi “coach out before Sep 1” markets for college football. */
export async function fetchCfbCoachFiredOdds(): Promise<KalshiCfbCoachMarket[]> {
  type EdgeItem = {
    name?: string;
    teamHint?: string | null;
    oddsAmerican?: string;
    impliedPct?: number;
    ticker?: string;
    url?: string;
  };

  const usable = (data: unknown): data is { items?: EdgeItem[] } =>
    Boolean(data) &&
    typeof data === "object" &&
    Array.isArray((data as { items?: unknown }).items) &&
    !(data as { error?: string }).error;

  let items: EdgeItem[] = [];
  try {
    const { data } = await supabase.functions.invoke("sports", {
      body: { action: "cfbCoachFiredOdds" },
    });
    if (usable(data) && (data.items?.length ?? 0) > 0) {
      items = data.items ?? [];
    }
  } catch {
    /* fall through */
  }

  if (!items.length) {
    try {
      const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
      if (base && key) {
        const res = await fetch(`${base}/functions/v1/sports`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
            apikey: key,
          },
          body: JSON.stringify({ action: "cfbCoachFiredOdds" }),
        });
        if (res.ok) {
          const data = (await res.json()) as { items?: EdgeItem[]; error?: string };
          if (!data.error && data.items?.length) items = data.items;
        }
      }
    } catch {
      /* */
    }
  }

  const out: KalshiCfbCoachMarket[] = [];
  for (const m of items) {
    const name = (m.name ?? "").trim();
    if (!name) continue;
    const pct = typeof m.impliedPct === "number" ? m.impliedPct : null;
    if (pct == null || !Number.isFinite(pct) || pct <= 0) continue;
    const hint = m.teamHint ?? null;
    const p = Math.max(0.01, Math.min(0.99, pct > 1 ? pct / 100 : pct));
    out.push({
      name,
      teamAbbrev:
        cfbAbbrevFromKalshiTicker(m.ticker ?? "") ?? cfbAbbrevFromKalshiSubtitle(hint),
      teamHint: hint,
      impliedPct: pct > 1 ? pct : Math.round(pct * 1000) / 10,
      american: m.oddsAmerican || americanFromProb(p),
      ticker: m.ticker ?? "",
      url: m.url ?? "",
    });
  }
  out.sort((a, b) => b.impliedPct - a.impliedPct);
  return out;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R | null>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const chunk = items.slice(i, i + limit);
    const results = await Promise.all(chunk.map(fn));
    for (const r of results) if (r != null) out.push(r);
  }
  return out;
}

export function scoreCfbRuwtGame(g: CfbScoreGame, ctx?: CfbRuwtContext): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const diff =
    g.away.score != null && g.home.score != null
      ? Math.abs(g.away.score - g.home.score)
      : null;
  const detail = `${g.shortDetail ?? ""} ${g.status ?? ""}`.toLowerCase();
  const period = g.period;
  const inOt =
    (period != null && period >= 5) || /\bot\b|overtime/.test(detail);

  if (g.live) {
    score += 40;
    reasons.push("Live");
    // Drama from margin — without this every live game sits at flat 40.
    if (diff != null) {
      if (diff <= 3) {
        score += 28;
        reasons.push("One-score game");
      } else if (diff <= 8) {
        score += 14;
        reasons.push("Tight");
      } else if (diff >= 28) {
        score -= 20;
        reasons.push("Blowout");
      } else if (diff >= 21) {
        score -= 14;
        reasons.push("Blowout");
      } else if (diff >= 14) {
        score -= 8;
      }
    }
    if (inOt) {
      score += 32;
      reasons.push("Overtime");
    } else if (diff == null || diff <= 14) {
      // Late-game bump only when still watchable — don't cancel blowout drag.
      if (period === 4 || /\b4th\b/.test(detail)) {
        score += 18;
        reasons.push("4th quarter");
      } else if (period === 3 || /\b3rd\b/.test(detail)) {
        score += 8;
        reasons.push("3rd quarter");
      }
    }
    if (g.situation?.isRedZone && (diff == null || diff <= 14)) {
      score += 18;
      reasons.push("Red zone");
    }
    if (
      g.situation?.downDistanceText?.startsWith("4th") &&
      (diff == null || diff <= 14)
    ) {
      score += 12;
      reasons.push("4th down");
    }
  } else if (!g.final) {
    score += 8;
    reasons.push("Upcoming");
  } else {
    score += 2;
  }

  const awayRank = g.away.rank;
  const homeRank = g.home.rank;
  if (awayRank && homeRank && awayRank <= 25 && homeRank <= 25) {
    score += 28;
    reasons.push("Ranked matchup");
  } else if ((awayRank && awayRank <= 25) || (homeRank && homeRank <= 25)) {
    score += 16;
    reasons.push("Ranked team");
  } else {
    const af = g.away.fpiRank;
    const hf = g.home.fpiRank;
    if (af != null && hf != null && af <= 40 && hf <= 40) {
      score += 10;
      reasons.push("FPI quality");
    }
  }

  for (const side of [g.away, g.home]) {
    const interest = ctx?.teamInterest[String(side.teamId)] ?? 0;
    if (interest >= 7) {
      score += interest * 3;
      reasons.push(`${side.abbrev} interest ${interest}`);
    }
    if (ctx?.watchTeamIds?.has(String(side.teamId))) {
      score += 12;
      reasons.push(`Watch ${side.abbrev}`);
    }
  }

  if (g.final && diff != null && diff <= 7) {
    score += 10;
    reasons.push("Close final");
  }

  return { score: Math.max(0, score), reasons: [...new Set(reasons)].slice(0, 5) };
}

export function rankCfbRuwtGames(
  games: CfbScoreGame[],
  ctx?: CfbRuwtContext,
  limit = 24,
): CfbScoredGame[] {
  return [...games]
    .map((g) => {
      const { score, reasons } = scoreCfbRuwtGame(g, ctx);
      return { ...g, score, reasons };
    })
    .sort((a, b) => b.score - a.score || Number(b.id) - Number(a.id))
    .slice(0, limit);
}

async function fetchTeamCoachAndRecord(
  teamId: number,
  season: number,
): Promise<{
  coachId: string;
  coachName: string;
  wins: number;
  losses: number;
  recordSummary: string | null;
  teamName: string;
  teamAbbrev: string;
  teamColor: string;
  teamLogo: string | null;
} | null> {
  const team = await fetchCoreJson<{
    displayName?: string;
    abbreviation?: string;
    color?: string;
    logos?: { href?: string }[];
    record?: { $ref?: string };
    coaches?: { $ref?: string };
  }>(`${CORE}/seasons/${season}/teams/${teamId}?lang=en&region=us`);
  if (!team) return null;

  let wins = 0;
  let losses = 0;
  let recordSummary: string | null = null;
  const recordRef = team.record?.$ref;
  if (recordRef) {
    const rec = await fetchCoreJson<{
      items?: { stats?: { name?: string; value?: number }[]; summary?: string }[];
    }>(recordRef);
    const total = rec?.items?.find((i) => i.summary?.includes("-")) ?? rec?.items?.[0];
    recordSummary = total?.summary ?? null;
    for (const s of total?.stats ?? []) {
      if (s.name === "wins") wins = Number(s.value) || 0;
      if (s.name === "losses") losses = Number(s.value) || 0;
    }
  }

  const coachesRef = team.coaches?.$ref;
  if (!coachesRef) return null;
  const coachList = await fetchCoreJson<{ items?: { $ref?: string }[] }>(coachesRef);
  const coachRef = coachList?.items?.[0]?.$ref;
  if (!coachRef) return null;
  const coach = await fetchCoreJson<{ id?: string; firstName?: string; lastName?: string }>(
    coachRef,
  );
  if (!coach?.id) return null;
  const coachName = [coach.firstName, coach.lastName].filter(Boolean).join(" ").trim();
  if (!coachName) return null;

  return {
    coachId: String(coach.id),
    coachName,
    wins,
    losses,
    recordSummary,
    teamName: team.displayName ?? "Team",
    teamAbbrev: team.abbreviation ?? "—",
    teamColor: (team.color ?? "333333").replace(/^#/, ""),
    teamLogo: team.logos?.[0]?.href ?? cfbTeamLogo(teamId),
  };
}

function recordHeatFactors(
  wins: number,
  losses: number,
  recordSummary: string | null,
): { score: number; factors: CfbCoach["factors"] } {
  const games = wins + losses;
  const winPct = games > 0 ? wins / games : null;
  const factors: CfbCoach["factors"] = [];
  let score = 0;
  if (winPct != null) {
    if (winPct < 0.35) {
      score += 22;
      factors.push({ label: "Record", points: 22, detail: `Win % ${(winPct * 100).toFixed(0)}` });
    } else if (winPct < 0.5) {
      score += 12;
      factors.push({ label: "Record", points: 12, detail: `Win % ${(winPct * 100).toFixed(0)}` });
    } else if (winPct >= 0.75) {
      score -= 8;
      factors.push({ label: "Record", points: -8, detail: `Win % ${(winPct * 100).toFixed(0)}` });
    }
  }
  if (losses >= 4 && games > 0) {
    const pts = Math.min(12, losses * 2);
    score += pts;
    factors.push({ label: "Losses", points: pts, detail: `${losses} losses` });
  }
  if (recordSummary && !factors.length) {
    factors.push({ label: "Record", points: 0, detail: recordSummary });
  }
  return { score, factors };
}

/** CFB hot seat — Kalshi coach-out % when available, full FBS records for context. */
export async function fetchCfbCoaches(): Promise<CfbCoach[]> {
  const season = new Date().getFullYear();
  const fbsTeams = await fetchFbsTeams(season).catch(() =>
    CFB_FOCUS_TEAMS.map((t) => ({
      id: t.id,
      name: t.name,
      abbrev: t.abbrev,
      color: "555555",
      logo: cfbTeamLogo(t.id),
    })),
  );
  const byAbbrev = new Map(fbsTeams.map((t) => [t.abbrev.toUpperCase(), t]));
  const kalshi = await fetchCfbCoachFiredOdds().catch(() => [] as KalshiCfbCoachMarket[]);
  const coveredTeamIds = new Set<number>();
  const rows: Omit<CfbCoach, "hotSeatRank">[] = [];

  for (const m of kalshi) {
    const team =
      (m.teamAbbrev ? byAbbrev.get(m.teamAbbrev.toUpperCase()) : null) ??
      [...fbsTeams].find((t) =>
        (m.teamHint ?? "").toLowerCase().includes(t.name.toLowerCase()),
      ) ??
      null;
    if (team) coveredTeamIds.add(team.id);
    const pack = team ? await fetchTeamCoachAndRecord(team.id, season).catch(() => null) : null;
    const wins = pack?.wins ?? 0;
    const losses = pack?.losses ?? 0;
    const recordSummary = pack?.recordSummary ?? null;
    const winPct = wins + losses > 0 ? wins / (wins + losses) : null;
    const marketPct = m.impliedPct;
    const marketPts = Math.round(marketPct * 0.85 * 10) / 10;
    const factors: CfbCoach["factors"] = [
      {
        label: "Kalshi %",
        points: marketPts,
        detail: `Kalshi ~${marketPct.toFixed(1)}% coach-out → +${marketPts} heat`,
      },
    ];
    let score = 20 + marketPts;
    const recordAdj = recordHeatFactors(wins, losses, recordSummary);
    score += recordAdj.score;
    factors.push(...recordAdj.factors);
    const id =
      m.ticker.replace(/^KXCOACHOUTNCAAFB-[^-]+-/, "") ||
      m.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    rows.push({
      id,
      name: m.name,
      teamId: team ? String(team.id) : "0",
      teamName: team?.name ?? pack?.teamName ?? m.teamHint ?? "FBS",
      teamAbbrev: team?.abbrev ?? pack?.teamAbbrev ?? m.teamAbbrev ?? "—",
      teamLogo: team?.logo ?? pack?.teamLogo ?? null,
      teamColor: team?.color ?? pack?.teamColor ?? "333",
      headshot: null,
      recordSummary,
      wins,
      losses,
      winPct,
      hotSeatScore: Math.max(0, Math.min(100, Math.round(score))),
      firedOddsPct: marketPct,
      firedOddsAmerican: m.american,
      kalshiUrl: m.url,
      factors,
    });
  }

  const remaining = fbsTeams.filter((t) => !coveredTeamIds.has(t.id));
  const extras = await mapWithConcurrency(remaining, 10, async (team) => {
    const pack = await fetchTeamCoachAndRecord(team.id, season);
    if (!pack) return null;
    const games = pack.wins + pack.losses;
    const winPct = games > 0 ? pack.wins / games : null;
    const { score: recordScore, factors } = recordHeatFactors(
      pack.wins,
      pack.losses,
      pack.recordSummary,
    );
    let score = 15 + recordScore;
    if (score < 8 && games === 0) return null;
    return {
      id: pack.coachId,
      name: pack.coachName,
      teamId: String(team.id),
      teamName: pack.teamName,
      teamAbbrev: pack.teamAbbrev,
      teamLogo: pack.teamLogo,
      teamColor: pack.teamColor,
      headshot: null,
      recordSummary: pack.recordSummary,
      wins: pack.wins,
      losses: pack.losses,
      winPct,
      hotSeatScore: Math.round(score * 10) / 10,
      firedOddsPct: null,
      firedOddsAmerican: null,
      kalshiUrl: null,
      factors,
    } satisfies Omit<CfbCoach, "hotSeatRank">;
  });

  rows.push(...extras);

  rows.sort((a, b) => {
    const ap = a.firedOddsPct ?? -1;
    const bp = b.firedOddsPct ?? -1;
    if (ap !== bp) return bp - ap;
    return b.hotSeatScore - a.hotSeatScore || a.name.localeCompare(b.name);
  });
  return rows.map((r, i) => ({ ...r, hotSeatRank: i + 1 }));
}

export async function fetchCfbCoachProfile(coachId: string): Promise<CfbCoachProfile> {
  const all = await fetchCfbCoaches();
  const base =
    all.find((c) => c.id === coachId) ??
    all.find((c) => c.id.toLowerCase() === coachId.toLowerCase()) ??
    all.find((c) => c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") === coachId.toLowerCase());
  if (!base) throw new Error("Coach not found");

  let bio: string | null = null;
  let headshot: string | null = base.headshot;
  try {
    const search = await fetch(
      `https://site.web.api.espn.com/apis/common/v3/search?region=us&lang=en&limit=8&query=${encodeURIComponent(base.name)}`,
      { headers: { Accept: "application/json" } },
    );
    if (search.ok) {
      const data = (await search.json()) as {
        items?: {
          id?: string;
          displayName?: string;
          type?: string;
          sport?: string;
          headshot?: { href?: string };
          description?: string;
        }[];
      };
      const hit =
        (data.items ?? []).find(
          (it) =>
            /coach|person/i.test(it.type ?? "") &&
            /football|college/i.test(it.sport ?? "football") &&
            (it.displayName ?? "").toLowerCase().includes(base.name.split(" ").slice(-1)[0]!.toLowerCase()),
        ) ??
        (data.items ?? []).find((it) => /coach|person/i.test(it.type ?? ""));
      if (hit?.headshot?.href) headshot = hit.headshot.href;
      if (hit?.description?.trim()) bio = hit.description.trim();
    }
  } catch {
    /* */
  }

  const careerHighlights: string[] = [];
  if (base.recordSummary) careerHighlights.push(`Season record: ${base.recordSummary}`);
  if (base.firedOddsPct != null) {
    careerHighlights.push(`Kalshi coach-out implied: ${base.firedOddsPct.toFixed(1)}%`);
  }

  return { ...base, headshot, bio, careerHighlights };
}

type CfbGameLogEventMeta = {
  id?: string;
  week?: number;
  gameDate?: string;
  atVs?: string;
  gameResult?: string;
  score?: string;
  opponent?: { displayName?: string; abbreviation?: string };
};

function parseCfbGameLogEvents(raw: unknown): Record<string, CfbGameLogEventMeta> {
  if (!raw) return {};
  if (Array.isArray(raw)) {
    const out: Record<string, CfbGameLogEventMeta> = {};
    for (const ev of raw) {
      const id = String((ev as CfbGameLogEventMeta).id ?? "");
      if (id) out[id] = ev as CfbGameLogEventMeta;
    }
    return out;
  }
  if (typeof raw === "object") return raw as Record<string, CfbGameLogEventMeta>;
  return {};
}

function buildCfbStatCategories(
  labels: string[],
  values: string[],
  catsMeta: { name?: string; displayName?: string; count?: number }[],
): CfbPlayerProfile["statCategories"] {
  let offset = 0;
  const statCategories: CfbPlayerProfile["statCategories"] = [];
  for (const cat of catsMeta) {
    const count = cat.count ?? 0;
    statCategories.push({
      name: cat.displayName ?? cat.name ?? "Stats",
      stats: labels.slice(offset, offset + count).map((label, i) => ({
        label,
        value: values[offset + i] ?? "—",
      })),
    });
    offset += count;
  }
  return statCategories;
}

export async function fetchCfbPlayerProfile(playerId: string): Promise<CfbPlayerProfile> {
  const id = String(playerId);
  const [athleteRes, overviewRes] = await Promise.all([
    fetch(`${ESPN_WEB}/athletes/${id}`, { headers: { Accept: "application/json" } }),
    fetch(`${ESPN_WEB}/athletes/${id}/overview`, { headers: { Accept: "application/json" } }),
  ]);
  if (!athleteRes.ok) throw new Error(`CFB player ${athleteRes.status}`);
  const raw = (await athleteRes.json()) as { athlete?: Record<string, unknown> };
  const overview = overviewRes.ok ? ((await overviewRes.json()) as Record<string, unknown>) : {};
  const a = { ...(raw.athlete ?? {}) } as Record<string, unknown>;
  const team = (a.team ?? {}) as {
    id?: string;
    displayName?: string;
    abbreviation?: string;
    color?: string;
    logos?: { href?: string }[];
  };
  const position = (a.position ?? {}) as { abbreviation?: string; displayName?: string };
  const classYear =
    (a.displayExperience as string | undefined) ||
    (a.experience as { displayValue?: string } | undefined)?.displayValue ||
    null;
  const birthPlace =
    (a.displayBirthPlace as string | undefined)?.trim() ||
    (() => {
      const bp = a.birthPlace as { city?: string; state?: string; country?: string } | undefined;
      return bp ? [bp.city, bp.state?.trim(), bp.country].filter(Boolean).join(", ") : null;
    })();

  const statistics = overview.statistics as
    | {
        labels?: string[];
        categories?: { name?: string; displayName?: string; count?: number }[];
        splits?: { displayName?: string; type?: string; stats?: string[] }[];
      }
    | undefined;
  const labels = statistics?.labels ?? [];
  const values = statistics?.splits?.[0]?.stats ?? [];
  const catsMeta = statistics?.categories ?? [];
  const statCategories = buildCfbStatCategories(labels, values, catsMeta);
  const seasonSplits = (statistics?.splits ?? []).map((split, idx) => ({
    season: split.displayName ?? split.type ?? `Season ${idx + 1}`,
    categories: buildCfbStatCategories(labels, split.stats ?? [], catsMeta),
  }));

  const summaryStats = (
    (a.statsSummary as { statistics?: { shortDisplayName?: string; displayValue?: string }[] })
      ?.statistics ?? []
  ).map((s) => ({ label: s.shortDisplayName ?? "Stat", value: s.displayValue ?? "—" }));

  const gameLog = overview.gameLog as
    | {
        events?: unknown;
        statistics?: {
          displayName?: string;
          labels?: string[];
          events?: { eventId?: string; stats?: string[] }[];
        }[];
      }
    | undefined;
  const eventMeta = parseCfbGameLogEvents(gameLog?.events);
  const gameLogCategories: CfbPlayerProfile["gameLogCategories"] = (gameLog?.statistics ?? []).map(
    (block) => {
      const blockLabels = block.labels ?? labels;
      const rows = (block.events ?? []).map((ev) => {
        const meta = eventMeta[String(ev.eventId ?? "")] ?? {};
        const stats = ev.stats ?? [];
        const opponent =
          meta.opponent?.abbreviation ?? meta.opponent?.displayName ?? "—";
        const result = `${meta.gameResult ?? ""} ${meta.score ?? ""}`.trim() || "—";
        return {
          eventId: ev.eventId != null ? String(ev.eventId) : null,
          date: meta.gameDate ?? null,
          week: meta.week ?? null,
          opponent,
          atVs: meta.atVs ?? null,
          result,
          score: meta.score ?? null,
          stats: blockLabels.map((label, i) => ({
            label,
            value: stats[i] ?? "—",
          })),
        };
      });
      return {
        name: block.displayName ?? "Stats",
        labels: blockLabels,
        rows,
      };
    },
  );
  const recentGames: CfbPlayerProfile["recentGames"] = (gameLogCategories[0]?.rows ?? [])
    .slice(0, 8)
    .map((row) => ({
      label:
        row.week != null
          ? `Wk ${row.week} ${row.atVs ?? ""} ${row.opponent}`.trim()
          : row.opponent,
      result: row.result,
      line: row.stats
        .slice(0, 5)
        .map((s) => s.value)
        .join(" · "),
    }));

  const newsRaw = overview.news as
    | { headline?: string; description?: string; images?: { url?: string }[]; links?: { href?: string; web?: { href?: string } }[] }[]
    | undefined;

  const headshotHref =
    (a.headshot as { href?: string } | undefined)?.href ||
    (overview.headshot as { href?: string } | undefined)?.href ||
    null;

  return {
    id,
    name: String(a.displayName ?? a.fullName ?? "Player"),
    number: a.jersey != null ? String(a.jersey) : null,
    position: position.abbreviation ?? null,
    positionName: position.displayName ?? null,
    teamId: team.id ?? null,
    teamName: team.displayName ?? null,
    teamAbbrev: team.abbreviation ?? null,
    teamColor: (team.color ?? "d9515c").replace(/^#/, ""),
    teamLogo: team.logos?.[0]?.href ?? (team.id ? cfbTeamLogo(team.id) : null),
    headshot: headshotHref ?? cfbHeadshot(id),
    height: (a.displayHeight as string | undefined) ?? null,
    weight: a.displayWeight != null ? String(a.displayWeight) : null,
    age: typeof a.age === "number" ? a.age : null,
    classYear,
    birthPlace,
    experience: classYear,
    bio:
      (typeof a.bio === "string" && a.bio.trim()) ||
      (typeof overview.description === "string" && overview.description.trim()) ||
      null,
    status:
      (a.injuries as { status?: string }[] | undefined)?.[0]?.status ||
      (a.status as { name?: string } | undefined)?.name ||
      null,
    seasonStats: summaryStats.length ? summaryStats : (statCategories[0]?.stats.slice(0, 8) ?? []),
    statCategories,
    seasonSplits,
    gameLogCategories,
    recentGames,
    news: (newsRaw ?? []).slice(0, 8).map((n) => ({
      headline: n.headline ?? "",
      description: n.description ?? "",
      image: n.images?.[0]?.url ?? null,
      href: n.links?.[0]?.href ?? n.links?.[0]?.web?.href ?? null,
    })),
  };
}
