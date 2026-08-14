/** NFL via ESPN site API — scoreboard, live field, plays, players, RUWT. */

import { formatSportsDateLong } from "./utils";

const ESPN = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";
const ESPN_WEB = "https://site.web.api.espn.com/apis/common/v3/sports/football/nfl";

export const NFL_TEAMS: { id: number; name: string; abbrev: string }[] = [
  { id: 22, name: "Cardinals", abbrev: "ARI" },
  { id: 1, name: "Falcons", abbrev: "ATL" },
  { id: 33, name: "Ravens", abbrev: "BAL" },
  { id: 2, name: "Bills", abbrev: "BUF" },
  { id: 29, name: "Panthers", abbrev: "CAR" },
  { id: 3, name: "Bears", abbrev: "CHI" },
  { id: 4, name: "Bengals", abbrev: "CIN" },
  { id: 5, name: "Browns", abbrev: "CLE" },
  { id: 6, name: "Cowboys", abbrev: "DAL" },
  { id: 7, name: "Broncos", abbrev: "DEN" },
  { id: 8, name: "Lions", abbrev: "DET" },
  { id: 9, name: "Packers", abbrev: "GB" },
  { id: 34, name: "Texans", abbrev: "HOU" },
  { id: 11, name: "Colts", abbrev: "IND" },
  { id: 30, name: "Jaguars", abbrev: "JAX" },
  { id: 12, name: "Chiefs", abbrev: "KC" },
  { id: 13, name: "Raiders", abbrev: "LV" },
  { id: 32, name: "Chargers", abbrev: "LAC" },
  { id: 14, name: "Rams", abbrev: "LAR" },
  { id: 15, name: "Dolphins", abbrev: "MIA" },
  { id: 16, name: "Vikings", abbrev: "MIN" },
  { id: 17, name: "Patriots", abbrev: "NE" },
  { id: 18, name: "Saints", abbrev: "NO" },
  { id: 19, name: "Giants", abbrev: "NYG" },
  { id: 20, name: "Jets", abbrev: "NYJ" },
  { id: 21, name: "Eagles", abbrev: "PHI" },
  { id: 23, name: "Steelers", abbrev: "PIT" },
  { id: 24, name: "49ers", abbrev: "SF" },
  { id: 25, name: "Seahawks", abbrev: "SEA" },
  { id: 26, name: "Buccaneers", abbrev: "TB" },
  { id: 27, name: "Titans", abbrev: "TEN" },
  { id: 28, name: "Commanders", abbrev: "WSH" },
];

export type NflLiveSituation = {
  downDistanceText: string | null;
  possessionText: string | null;
  yardLine: number | null;
  isRedZone: boolean;
  possessionTeamId: string | null;
  lastPlayText: string | null;
  homeTimeouts: number | null;
  awayTimeouts: number | null;
};

export type NflScoreSide = {
  teamId: number;
  name: string;
  abbrev: string;
  score: number | null;
  record: string | null;
  logo: string | null;
  color: string;
};

export type NflScoreGame = {
  id: string;
  status: string;
  shortDetail: string | null;
  live: boolean;
  final: boolean;
  away: NflScoreSide;
  home: NflScoreSide;
  when: string | null;
  whenShort: string | null;
  venue: string | null;
  situation: NflLiveSituation | null;
  /** 0–100 home win % when ESPN provides it. */
  homeWinPct: number | null;
};

export type NflScoredGame = NflScoreGame & {
  score: number;
  reasons: string[];
};

export type NflPlayAthlete = {
  id: string;
  name: string;
  shortName: string;
  position: string | null;
  teamId: string | null;
};

export type NflPlay = {
  id: string;
  text: string;
  shortDownDistanceText: string | null;
  clock: string | null;
  period: number | null;
  yardLine: number | null;
  yardsToEndzone: number | null;
  possessionTeamId: string | null;
  scoringPlay: boolean;
  yardage: number | null;
  athletes: NflPlayAthlete[];
};

export type NflDrive = {
  id: string;
  description: string | null;
  teamId: string | null;
  teamAbbrev: string | null;
  result: string | null;
  yards: number | null;
  plays: NflPlay[];
};

export type NflBoxLeader = {
  id: string;
  name: string;
  teamAbbrev: string;
  group: string;
  line: string;
};

export type NflGameDetail = NflScoreGame & {
  drives: NflDrive[];
  recentPlays: NflPlay[];
  scoringPlays: { id: string; text: string; clock: string | null; teamAbbrev: string | null }[];
  leaders: NflBoxLeader[];
  article: { headline: string; description: string | null; storyHtml: string | null } | null;
};

export type NflPlayerProfile = {
  id: string;
  name: string;
  number: string | null;
  position: string | null;
  teamId: string | null;
  teamName: string | null;
  teamAbbrev: string | null;
  headshot: string | null;
  height: string | null;
  weight: string | null;
  age: number | null;
  college: string | null;
  experience: string | null;
  seasonStats: { label: string; value: string }[];
};

export function nflHeadshot(playerId: string | number, size = 423): string {
  return `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${playerId}.png&w=${size}&h=${size}`;
}

export function nflTeamLogo(abbrev: string): string {
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${abbrev.toLowerCase()}.png`;
}

function parseScore(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function sideFromCompetitor(c: {
  homeAway?: string;
  score?: unknown;
  records?: { type?: string; summary?: string }[];
  team?: {
    id?: string;
    displayName?: string;
    shortDisplayName?: string;
    abbreviation?: string;
    color?: string;
    logos?: { href?: string }[];
  };
}): NflScoreSide {
  const team = c.team ?? {};
  const abbrev = team.abbreviation ?? "—";
  const overall = (c.records ?? []).find((r) => r.type === "total")?.summary ?? null;
  return {
    teamId: Number(team.id) || 0,
    name: team.displayName ?? team.shortDisplayName ?? abbrev,
    abbrev,
    score: parseScore(c.score),
    record: overall,
    logo: team.logos?.[0]?.href ?? nflTeamLogo(abbrev),
    color: (team.color ?? "555555").replace(/^#/, ""),
  };
}

function mapSituation(
  sit: {
    downDistanceText?: string;
    possessionText?: string;
    yardLine?: number;
    isRedZone?: boolean;
    possession?: string;
    lastPlay?: { text?: string; team?: { id?: string } };
    homeTimeouts?: number;
    awayTimeouts?: number;
  } | null
  | undefined,
  live: boolean,
): NflLiveSituation | null {
  if (!live || !sit) return null;
  return {
    downDistanceText: sit.downDistanceText ?? null,
    possessionText: sit.possessionText ?? null,
    yardLine: typeof sit.yardLine === "number" ? sit.yardLine : null,
    isRedZone: Boolean(sit.isRedZone),
    possessionTeamId: sit.possession ?? sit.lastPlay?.team?.id ?? null,
    lastPlayText: sit.lastPlay?.text ?? null,
    homeTimeouts: sit.homeTimeouts ?? null,
    awayTimeouts: sit.awayTimeouts ?? null,
  };
}

type EspnEvent = {
  id?: string;
  date?: string;
  shortName?: string;
  competitions?: {
    id?: string;
    venue?: { fullName?: string };
    status?: {
      type?: {
        state?: string;
        completed?: boolean;
        description?: string;
        detail?: string;
        shortDetail?: string;
        name?: string;
      };
    };
    competitors?: {
      homeAway?: string;
      score?: unknown;
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
    situation?: Parameters<typeof mapSituation>[0];
  }[];
  status?: { type?: { state?: string; completed?: boolean; description?: string; detail?: string; shortDetail?: string; name?: string } };
};

function mapEvent(event: EspnEvent): NflScoreGame | null {
  const comp = event.competitions?.[0];
  if (!comp) return null;
  const status = comp.status?.type ?? event.status?.type;
  const state = status?.state ?? "";
  const live = state === "in";
  const final = state === "post" || status?.completed === true;
  const home = (comp.competitors ?? []).find((c) => c.homeAway === "home");
  const away = (comp.competitors ?? []).find((c) => c.homeAway === "away");
  if (!home || !away) return null;

  const whenDate = event.date ? new Date(event.date) : null;
  const when =
    whenDate && !Number.isNaN(whenDate.getTime())
      ? formatSportsDateLong(whenDate)
      : null;
  const whenShort =
    whenDate && !Number.isNaN(whenDate.getTime())
      ? whenDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      : null;

  return {
    id: String(event.id ?? comp.id ?? ""),
    status: status?.description ?? status?.name ?? (live ? "Live" : final ? "Final" : "Scheduled"),
    shortDetail: status?.shortDetail ?? status?.detail ?? null,
    live,
    final,
    away: sideFromCompetitor(away),
    home: sideFromCompetitor(home),
    when: final || live ? status?.shortDetail ?? when : when,
    whenShort: live || final ? status?.shortDetail ?? null : whenShort,
    venue: comp.venue?.fullName ?? null,
    situation: mapSituation(comp.situation, live),
    homeWinPct: null,
  };
}

export async function fetchNflScoreboard(dates?: string): Promise<NflScoreGame[]> {
  const url = dates ? `${ESPN}/scoreboard?dates=${dates}` : `${ESPN}/scoreboard`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`NFL scoreboard ${res.status}`);
  const raw = (await res.json()) as { events?: EspnEvent[] };
  return (raw.events ?? []).map(mapEvent).filter((g): g is NflScoreGame => Boolean(g?.id));
}

function mapPlay(p: {
  id?: string;
  text?: string;
  shortDownDistanceText?: string;
  scoringPlay?: boolean;
  clock?: { displayValue?: string };
  period?: { number?: number };
  start?: {
    yardLine?: number;
    yardsToEndzone?: number;
    team?: { id?: string };
  };
  end?: {
    yardLine?: number;
    yardsToEndzone?: number;
    team?: { id?: string };
  };
  statYardage?: number;
  athletesInvolved?: {
    id?: string;
    displayName?: string;
    shortName?: string;
    position?: string;
    team?: { id?: string };
  }[];
  team?: { id?: string };
}): NflPlay {
  const end = p.end ?? p.start;
  return {
    id: String(p.id ?? Math.random()),
    text: p.text ?? "",
    shortDownDistanceText: p.shortDownDistanceText ?? null,
    clock: p.clock?.displayValue ?? null,
    period: p.period?.number ?? null,
    yardLine: end?.yardLine ?? null,
    yardsToEndzone: end?.yardsToEndzone ?? null,
    possessionTeamId: end?.team?.id ?? p.team?.id ?? p.start?.team?.id ?? null,
    scoringPlay: Boolean(p.scoringPlay),
    yardage: typeof p.statYardage === "number" ? p.statYardage : null,
    athletes: (p.athletesInvolved ?? []).map((a) => ({
      id: String(a.id ?? ""),
      name: a.displayName ?? "—",
      shortName: a.shortName ?? a.displayName ?? "—",
      position: a.position ?? null,
      teamId: a.team?.id ?? null,
    })),
  };
}

export async function fetchNflGameDetail(eventId: string): Promise<NflGameDetail> {
  const res = await fetch(`${ESPN}/summary?event=${encodeURIComponent(eventId)}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`NFL summary ${res.status}`);
  const raw = (await res.json()) as {
    header?: { competitions?: EspnEvent["competitions"]; id?: string };
    drives?: {
      current?: {
        id?: string;
        description?: string;
        team?: { id?: string; abbreviation?: string };
        result?: string;
        yards?: number;
        plays?: Parameters<typeof mapPlay>[0][];
      };
      previous?: {
        id?: string;
        description?: string;
        team?: { id?: string; abbreviation?: string };
        result?: string;
        yards?: number;
        plays?: Parameters<typeof mapPlay>[0][];
      }[];
    };
    scoringPlays?: {
      id?: string;
      text?: string;
      clock?: { displayValue?: string };
      team?: { abbreviation?: string };
    }[];
    boxscore?: {
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
    winprobability?: { homeWinPercentage?: number }[];
  };

  const headerComp = raw.header?.competitions?.[0];
  const board = await fetchNflScoreboard().catch(() => [] as NflScoreGame[]);
  let base = board.find((g) => g.id === String(eventId)) ?? null;
  if (!base && headerComp) {
    base = mapEvent({
      id: eventId,
      competitions: raw.header?.competitions,
    });
  }
  if (!base) throw new Error("NFL game not found");

  const winSeries = raw.winprobability ?? [];
  const lastWin = winSeries[winSeries.length - 1];
  if (lastWin?.homeWinPercentage != null) {
    base = { ...base, homeWinPct: Math.round(lastWin.homeWinPercentage * 1000) / 10 };
  }

  // Refresh situation from header if present
  if (headerComp?.situation && base.live) {
    base = { ...base, situation: mapSituation(headerComp.situation, true) };
  }

  const drivesRaw = [
    ...(raw.drives?.previous ?? []),
    ...(raw.drives?.current ? [raw.drives.current] : []),
  ];
  const drives: NflDrive[] = drivesRaw.map((d) => ({
    id: String(d.id ?? Math.random()),
    description: d.description ?? null,
    teamId: d.team?.id ?? null,
    teamAbbrev: d.team?.abbreviation ?? null,
    result: d.result ?? null,
    yards: typeof d.yards === "number" ? d.yards : null,
    plays: (d.plays ?? []).map(mapPlay),
  }));

  const recentPlays = drives
    .flatMap((d) => d.plays)
    .filter((p) => p.text)
    .slice(-40)
    .reverse();

  const leaders: NflBoxLeader[] = [];
  for (const side of raw.boxscore?.players ?? []) {
    const abbrev = side.team?.abbreviation ?? "—";
    for (const group of side.statistics ?? []) {
      const gname = group.name ?? "stats";
      for (const row of (group.athletes ?? []).slice(0, 3)) {
        const id = row.athlete?.id;
        if (!id) continue;
        leaders.push({
          id: String(id),
          name: row.athlete?.displayName ?? "—",
          teamAbbrev: abbrev,
          group: gname,
          line: (row.stats ?? []).slice(0, 4).join(" · "),
        });
      }
    }
  }

  return {
    ...base,
    drives,
    recentPlays,
    scoringPlays: (raw.scoringPlays ?? []).map((s) => ({
      id: String(s.id ?? Math.random()),
      text: s.text ?? "",
      clock: s.clock?.displayValue ?? null,
      teamAbbrev: s.team?.abbreviation ?? null,
    })),
    leaders,
    article: raw.article?.headline
      ? {
          headline: raw.article.headline,
          description: raw.article.description ?? null,
          storyHtml: raw.article.story ?? null,
        }
      : null,
  };
}

export async function fetchNflPlayerProfile(playerId: string): Promise<NflPlayerProfile> {
  const id = String(playerId);
  const res = await fetch(`${ESPN_WEB}/athletes/${id}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`NFL player ${res.status}`);
  const raw = (await res.json()) as {
    athlete?: {
      id?: string;
      displayName?: string;
      displayJersey?: string;
      jersey?: string;
      position?: { abbreviation?: string };
      team?: { id?: string; displayName?: string; abbreviation?: string };
      headshot?: { href?: string };
      displayHeight?: string;
      displayWeight?: string;
      age?: number;
      college?: { name?: string };
      displayExperience?: string;
      statsSummary?: {
        statistics?: { shortDisplayName?: string; displayValue?: string }[];
      };
    };
  };
  const a = raw.athlete ?? {};
  return {
    id,
    name: a.displayName ?? "Player",
    number: a.displayJersey ?? a.jersey ?? null,
    position: a.position?.abbreviation ?? null,
    teamId: a.team?.id ?? null,
    teamName: a.team?.displayName ?? null,
    teamAbbrev: a.team?.abbreviation ?? null,
    headshot: a.headshot?.href ?? nflHeadshot(id),
    height: a.displayHeight ?? null,
    weight: a.displayWeight ?? null,
    age: typeof a.age === "number" ? a.age : null,
    college: a.college?.name ?? null,
    experience: a.displayExperience ?? null,
    seasonStats: (a.statsSummary?.statistics ?? []).map((s) => ({
      label: s.shortDisplayName ?? "Stat",
      value: s.displayValue ?? "—",
    })),
  };
}

/**
 * ESPN `situation.yardLine` is yards from the home end zone (0 = home goal, 100 = away goal).
 * Field map paints away left → home right, so ball % = 100 - yardLine.
 */
export function fieldBallPctFromHomeYardLine(yardLine: number | null): number | null {
  if (yardLine == null || !Number.isFinite(yardLine)) return null;
  return Math.max(0, Math.min(100, 100 - yardLine));
}

export function pickNflHeroGame(games: NflScoreGame[]): NflScoreGame | null {
  const live = games.filter((g) => g.live);
  if (live.length) {
    return [...live].sort((a, b) => {
      const close = (g: NflScoreGame) =>
        Math.abs((g.away.score ?? 0) - (g.home.score ?? 0));
      return close(a) - close(b);
    })[0]!;
  }
  const upcoming = games.filter((g) => !g.final && !g.live);
  if (upcoming.length) return upcoming[0]!;
  return games.find((g) => g.final) ?? null;
}

export type NflRuwtContext = {
  teamInterest: Record<string, number>;
  watchPlayerIds: Set<string>;
};

/** Drama + interest score for RUWT (parallel to MLB). */
export function scoreNflRuwtGame(g: NflScoreGame, ctx?: NflRuwtContext): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (g.live) {
    score += 40;
    reasons.push("Live");
    const diff = Math.abs((g.away.score ?? 0) - (g.home.score ?? 0));
    if (diff <= 3) {
      score += 28;
      reasons.push("One-score game");
    } else if (diff <= 8) {
      score += 14;
      reasons.push("Tight");
    }
    if (g.situation?.isRedZone) {
      score += 18;
      reasons.push("Red zone");
    }
    if (g.situation?.downDistanceText?.startsWith("4th")) {
      score += 12;
      reasons.push("4th down");
    }
    if (g.homeWinPct != null && g.homeWinPct >= 35 && g.homeWinPct <= 65) {
      score += 10;
      reasons.push("Toss-up");
    }
  } else if (!g.final) {
    score += 12;
    reasons.push("Upcoming");
  } else {
    score += 2;
  }

  if (ctx) {
    const ai = ctx.teamInterest[String(g.away.teamId)] ?? 0;
    const hi = ctx.teamInterest[String(g.home.teamId)] ?? 0;
    const top = Math.max(ai, hi);
    if (top > 0) {
      score += Math.round(top * 4.2);
      if (top >= 9) reasons.push("Your #1 team");
      else if (top >= 7) reasons.push("High interest team");
      else if (top >= 4) reasons.push("On your board");
    }
    if (ai >= 5 && hi >= 5) {
      score += 12;
      reasons.push("Both teams ranked");
    }
  }

  const unique: string[] = [];
  for (const r of reasons) if (!unique.includes(r)) unique.push(r);
  return { score: Math.max(0, score), reasons: unique.slice(0, 5) };
}

export function rankNflRuwtGames(
  games: NflScoreGame[],
  ctx?: NflRuwtContext,
  limit = 20,
): NflScoredGame[] {
  return [...games]
    .map((g) => {
      const { score, reasons } = scoreNflRuwtGame(g, ctx);
      return { ...g, score, reasons };
    })
    .sort((a, b) => b.score - a.score || Number(b.id) - Number(a.id))
    .slice(0, limit);
}

export function parseEspnNflGameIdFromUrl(url: string): string | null {
  if (!/espn\.com\/nfl\//i.test(url) && !/synthetic:nfl-wraps/i.test(url)) {
    // still allow gameId if path looks like nfl
  }
  if (/espn\.com\/(?:nfl|football)\//i.test(url) || /\/nfl\//i.test(url)) {
    const m = url.match(/gameId\/(\d+)/i) || url.match(/[?&]gameId=(\d+)/i);
    return m?.[1] ?? null;
  }
  const m = url.match(/espn\.com\/nfl\/(?:recap|preview|game).*gameId\/(\d+)/i);
  return m?.[1] ?? null;
}
