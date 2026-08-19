/** NFL via ESPN site API — scoreboard, live field, plays, players, RUWT. */

import { parseEspnBroadcasts, type GameBroadcast } from "./game-broadcasts";
import { supabase } from "./supabase";
import { formatSportsDateLong } from "./utils";

const ESPN = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";
const ESPN_WEB = "https://site.web.api.espn.com/apis/common/v3/sports/football/nfl";

function chicagoDateFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

export function chicagoTodayNfl(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

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
  /** Chicago calendar date (YYYY-MM-DD) for the kickoff. */
  date: string | null;
  broadcasts: GameBroadcast[];
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

export type NflBoxPlayerRow = {
  id: string;
  name: string;
  stats: string[];
};

export type NflBoxStatGroup = {
  teamAbbrev: string;
  name: string;
  labels: string[];
  athletes: NflBoxPlayerRow[];
};

export type NflTeamGameStat = {
  teamAbbrev: string;
  label: string;
  value: string;
};

export type NflGameDetail = NflScoreGame & {
  drives: NflDrive[];
  recentPlays: NflPlay[];
  scoringPlays: { id: string; text: string; clock: string | null; teamAbbrev: string | null }[];
  leaders: NflBoxLeader[];
  boxGroups: NflBoxStatGroup[];
  teamStats: NflTeamGameStat[];
  article: { headline: string; description: string | null; storyHtml: string | null } | null;
};

export type NflPlayerProfile = {
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
  dob: string | null;
  birthPlace: string | null;
  college: string | null;
  experience: string | null;
  draft: string | null;
  /** Long-form bio when ESPN provides one. */
  bio: string | null;
  status: string | null;
  seasonStats: { label: string; value: string }[];
  statCategories: { name: string; stats: { label: string; value: string }[] }[];
  recentGames: { label: string; result: string; line: string }[];
  news: { headline: string; description: string; image: string | null; href: string | null }[];
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
  sit:
    | {
        downDistanceText?: string;
        possessionText?: string;
        yardLine?: number;
        isRedZone?: boolean;
        possession?: string;
        lastPlay?: { text?: string; team?: { id?: string } };
        homeTimeouts?: number;
        awayTimeouts?: number;
      }
    | null
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
    broadcasts?: { market?: string; names?: string[] }[];
    geoBroadcasts?: {
      market?: { type?: string };
      media?: { shortName?: string; name?: string; logo?: string; darkLogo?: string };
    }[];
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
    whenDate && !Number.isNaN(whenDate.getTime()) ? formatSportsDateLong(whenDate) : null;
  const whenShort =
    whenDate && !Number.isNaN(whenDate.getTime())
      ? whenDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      : null;

  return {
    id: String(event.id ?? comp.id ?? ""),
    status:
      status?.description ?? status?.name ?? (live ? "Live" : final ? "Final" : "Scheduled"),
    shortDetail: status?.shortDetail ?? status?.detail ?? null,
    live,
    final,
    away: sideFromCompetitor(away),
    home: sideFromCompetitor(home),
    when: final || live ? (status?.shortDetail ?? when) : when,
    whenShort: live || final ? (status?.shortDetail ?? null) : whenShort,
    venue: comp.venue?.fullName ?? null,
    situation: mapSituation(comp.situation, live),
    homeWinPct: null,
    date: chicagoDateFromIso(event.date),
    broadcasts: parseEspnBroadcasts(comp.geoBroadcasts, comp.broadcasts),
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
  const boxGroups: NflBoxStatGroup[] = [];
  for (const side of raw.boxscore?.players ?? []) {
    const abbrev = side.team?.abbreviation ?? "—";
    for (const group of side.statistics ?? []) {
      const gname = group.name ?? "stats";
      const labels = group.labels ?? [];
      const athletes: NflBoxPlayerRow[] = [];
      for (const row of group.athletes ?? []) {
        const id = row.athlete?.id;
        if (!id) continue;
        athletes.push({
          id: String(id),
          name: row.athlete?.displayName ?? "—",
          stats: row.stats ?? [],
        });
        if (athletes.length <= 3) {
          leaders.push({
            id: String(id),
            name: row.athlete?.displayName ?? "—",
            teamAbbrev: abbrev,
            group: gname,
            line: (row.stats ?? []).slice(0, 4).join(" · "),
          });
        }
      }
      if (athletes.length) {
        boxGroups.push({
          teamAbbrev: abbrev,
          name: gname,
          labels,
          athletes,
        });
      }
    }
  }

  const teamStats: NflTeamGameStat[] = [];
  for (const side of raw.boxscore?.teams ?? []) {
    const abbrev = side.team?.abbreviation ?? "—";
    for (const s of side.statistics ?? []) {
      const label = s.label ?? s.abbreviation ?? s.name ?? "Stat";
      const value = s.displayValue ?? "—";
      if (!value || value === "—") continue;
      teamStats.push({ teamAbbrev: abbrev, label, value });
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
    boxGroups,
    teamStats,
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
  const [athleteRes, overviewRes, coreRes] = await Promise.all([
    fetch(`${ESPN_WEB}/athletes/${id}`, { headers: { Accept: "application/json" } }),
    fetch(`${ESPN_WEB}/athletes/${id}/overview`, { headers: { Accept: "application/json" } }),
    fetch(
      `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/athletes/${id}?lang=en&region=us`,
      { headers: { Accept: "application/json" } },
    ).catch(() => null),
  ]);
  if (!athleteRes.ok) throw new Error(`NFL player ${athleteRes.status}`);
  const raw = (await athleteRes.json()) as { athlete?: Record<string, unknown> };
  const overview = overviewRes.ok ? ((await overviewRes.json()) as Record<string, unknown>) : {};
  const core = coreRes && coreRes.ok ? ((await coreRes.json()) as Record<string, unknown>) : {};
  const a = { ...core, ...(raw.athlete ?? {}) } as Record<string, unknown>;
  const team = (a.team ?? {}) as {
    id?: string;
    displayName?: string;
    abbreviation?: string;
    color?: string;
    logos?: { href?: string }[];
  };
  const position = (a.position ?? {}) as { abbreviation?: string; displayName?: string };
  const college = (a.college as { name?: string } | undefined)?.name ?? null;
  const draft = a.displayDraft != null ? String(a.displayDraft) : null;
  const birthPlace =
    (a.displayBirthPlace as string | undefined)?.trim() ||
    (() => {
      const bp = a.birthPlace as { city?: string; state?: string; country?: string } | undefined;
      return bp ? [bp.city, bp.state?.trim(), bp.country].filter(Boolean).join(", ") : null;
    })();

  const bio =
    (typeof a.bio === "string" && a.bio.trim()) ||
    (typeof a.description === "string" && a.description.trim()) ||
    (typeof overview.description === "string" && String(overview.description).trim()) ||
    null;
  const status =
    (a.injuries as { status?: string; longComment?: string }[] | undefined)?.[0]?.status ||
    (a.status as { name?: string; type?: string } | undefined)?.type ||
    (a.status as { name?: string } | undefined)?.name ||
    null;

  const summaryStats = (
    (a.statsSummary as { statistics?: { shortDisplayName?: string; displayValue?: string }[] })
      ?.statistics ?? []
  ).map((s) => ({ label: s.shortDisplayName ?? "Stat", value: s.displayValue ?? "—" }));

  const statistics = overview.statistics as
    | {
        labels?: string[];
        categories?: { name?: string; displayName?: string; count?: number }[];
        splits?: { stats?: string[] }[];
      }
    | undefined;
  const labels = statistics?.labels ?? [];
  const values = statistics?.splits?.[0]?.stats ?? [];
  const catsMeta = statistics?.categories ?? [];
  let offset = 0;
  const statCategories: NflPlayerProfile["statCategories"] = [];
  for (const cat of catsMeta) {
    const count = cat.count ?? 0;
    const sliceLabels = labels.slice(offset, offset + count);
    const sliceValues = values.slice(offset, offset + count);
    offset += count;
    statCategories.push({
      name: cat.displayName ?? cat.name ?? "Stats",
      stats: sliceLabels.map((label, i) => ({ label, value: sliceValues[i] ?? "—" })),
    });
  }

  const seasonStats =
    summaryStats.length > 0 ? summaryStats : (statCategories[0]?.stats.slice(0, 8) ?? []);

  const gameLog = overview.gameLog as
    | {
        events?: {
          week?: number;
          atVs?: string;
          opponent?: { abbreviation?: string };
          score?: string;
          gameResult?: string;
          stats?: string[];
        }[];
      }
    | undefined;
  const recentGames: NflPlayerProfile["recentGames"] = (gameLog?.events ?? []).slice(0, 8).map((g) => ({
    label: `Wk ${g.week ?? "—"} ${g.atVs ?? ""} ${g.opponent?.abbreviation ?? ""}`.trim(),
    result: `${g.gameResult ?? ""} ${g.score ?? ""}`.trim() || "—",
    line: (g.stats ?? []).slice(0, 5).join(" · "),
  }));

  const newsRaw = (overview.news ?? []) as {
    headline?: string;
    description?: string;
    images?: { url?: string }[];
    links?: { web?: { href?: string } };
  }[];
  const news = (Array.isArray(newsRaw) ? newsRaw : [])
    .slice(0, 8)
    .map((n) => ({
      headline: n.headline ?? "",
      description: n.description ?? "",
      image: n.images?.[0]?.url ?? null,
      href: n.links?.web?.href ?? null,
    }))
    .filter((n) => n.headline);

  return {
    id,
    name: String(a.displayName ?? a.fullName ?? "Player"),
    number: (a.displayJersey as string | undefined) ?? (a.jersey != null ? String(a.jersey) : null),
    position: position.abbreviation ?? null,
    positionName: position.displayName ?? null,
    teamId: team.id ?? null,
    teamName: team.displayName ?? null,
    teamAbbrev: team.abbreviation ?? null,
    teamColor: team.color ?? null,
    teamLogo: team.logos?.[0]?.href ?? (team.abbreviation ? nflTeamLogo(team.abbreviation) : null),
    headshot: (a.headshot as { href?: string } | undefined)?.href ?? nflHeadshot(id),
    height: (a.displayHeight as string | undefined) ?? null,
    weight: (a.displayWeight as string | undefined) ?? null,
    age: typeof a.age === "number" ? a.age : null,
    dob: (a.displayDOB as string | undefined) ?? null,
    birthPlace,
    college,
    experience: (a.displayExperience as string | undefined) ?? null,
    draft,
    bio,
    status: status ? String(status) : null,
    seasonStats,
    statCategories,
    recentGames,
    news,
  };
}

export type NflTeamPage = {
  id: string;
  name: string;
  shortName: string;
  abbrev: string;
  color: string;
  logo: string | null;
  record: string | null;
  standing: string | null;
  venueName: string | null;
  venueCity: string | null;
  venueImage: string | null;
  coachName: string | null;
  coachId: string | null;
  coachExperience: number | null;
  nextEvent: { id: string; name: string; date: string | null } | null;
  statGroups: { name: string; stats: { label: string; value: string }[] }[];
  /** ESPN-style player tables (Passing / Rushing / Receiving / Defense). */
  playerTables: {
    name: string;
    labels: string[];
    rows: { id: string; name: string; stats: string[] }[];
  }[];
  roster: {
    id: string;
    name: string;
    number: string | null;
    position: string | null;
    headshot: string | null;
  }[];
};

export async function fetchNflTeamPage(teamId: string): Promise<NflTeamPage> {
  const id = String(teamId);
  const season =
    new Date().getMonth() >= 7 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  const priorSeason = season - 1;
  const playerStatsUrl = (yr: number) =>
    `https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=false&page=1&limit=50&sort=passing.passingYards%3Adesc&season=${yr}&seasontype=2&team=${id}`;
  const [teamRes, rosterRes, statsRes, standingsRes, playerStatsRes] = await Promise.all([
    fetch(`${ESPN}/teams/${id}`, { headers: { Accept: "application/json" } }),
    fetch(`${ESPN}/teams/${id}/roster`, { headers: { Accept: "application/json" } }),
    fetch(`${ESPN}/teams/${id}/statistics?season=${season}`, { headers: { Accept: "application/json" } }),
    fetch("https://site.api.espn.com/apis/v2/sports/football/nfl/standings", {
      headers: { Accept: "application/json" },
    }),
    fetch(playerStatsUrl(season), { headers: { Accept: "application/json" } }).catch(() => null),
  ]);
  if (!teamRes.ok) throw new Error(`NFL team ${teamRes.status}`);
  const teamJson = (await teamRes.json()) as {
    team?: {
      id?: string;
      displayName?: string;
      shortDisplayName?: string;
      abbreviation?: string;
      color?: string;
      logos?: { href?: string }[];
      record?: { items?: { type?: string; summary?: string }[] };
      franchise?: {
        venue?: {
          fullName?: string;
          address?: { city?: string; state?: string };
          images?: { href?: string; rel?: string[] }[];
        };
      };
      nextEvent?: { id?: string; name?: string; date?: string }[];
    };
  };
  const t = teamJson.team ?? {};
  const venue = t.franchise?.venue;
  const venueImage =
    venue?.images?.find((i) => i.rel?.includes("day") && !i.rel?.includes("interior"))?.href ??
    venue?.images?.[0]?.href ??
    null;

  let coachName: string | null = null;
  let coachId: string | null = null;
  let coachExperience: number | null = null;
  const rosterPlayers: NflTeamPage["roster"] = [];
  if (rosterRes.ok) {
    const rosterJson = (await rosterRes.json()) as {
      coach?: { id?: string; firstName?: string; lastName?: string; experience?: number }[];
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
    const coach = rosterJson.coach?.[0];
    if (coach) {
      coachId = coach.id != null ? String(coach.id) : null;
      coachName = [coach.firstName, coach.lastName].filter(Boolean).join(" ") || null;
      coachExperience = typeof coach.experience === "number" ? coach.experience : null;
    }
    for (const group of rosterJson.athletes ?? []) {
      for (const a of group.items ?? []) {
        rosterPlayers.push({
          id: String(a.id ?? a.displayName),
          name: a.displayName ?? "—",
          number: a.jersey ?? null,
          position: a.position?.abbreviation ?? null,
          headshot: a.headshot?.href ?? (a.id ? nflHeadshot(a.id, 200) : null),
        });
      }
    }
  }

  const statGroups: NflTeamPage["statGroups"] = [];
  if (statsRes.ok) {
    const statsJson = (await statsRes.json()) as {
      results?: {
        stats?: {
          categories?: {
            displayName?: string;
            stats?: { shortDisplayName?: string; abbreviation?: string; displayValue?: string }[];
          }[];
        };
      };
    };
    for (const cat of statsJson.results?.stats?.categories ?? []) {
      statGroups.push({
        name: cat.displayName ?? "Stats",
        stats: (cat.stats ?? []).slice(0, 10).map((s) => ({
          label: s.shortDisplayName ?? s.abbreviation ?? "—",
          value: s.displayValue ?? "—",
        })),
      });
    }
  }

  let standing: string | null = null;
  if (standingsRes.ok) {
    const standings = (await standingsRes.json()) as {
      children?: {
        name?: string;
        children?: {
          name?: string;
          standings?: {
            entries?: { team?: { id?: string }; stats?: { name?: string; displayValue?: string }[] }[];
          };
        }[];
        standings?: {
          entries?: { team?: { id?: string }; stats?: { name?: string; displayValue?: string }[] }[];
        };
      }[];
    };
    outer: for (const conf of standings.children ?? []) {
      const divisions = conf.children?.length ? conf.children : [conf];
      for (const div of divisions) {
        for (const entry of div.standings?.entries ?? []) {
          if (String(entry.team?.id) !== id) continue;
          const get = (n: string) => entry.stats?.find((s) => s.name === n)?.displayValue;
          const rank = get("playoffSeed") || get("rank");
          standing = [rank ? `#${rank}` : null, div.name ?? conf.name].filter(Boolean).join(" · ");
          break outer;
        }
      }
    }
  }

  const overall = (t.record?.items ?? []).find((r) => r.type === "total")?.summary ?? null;
  const next = t.nextEvent?.[0];

  const playerTables: NflTeamPage["playerTables"] = [];
  type PlayerStatsPayload = {
    categories?: { name?: string; displayName?: string; labels?: string[]; names?: string[] }[];
    athletes?: {
      athlete?: { id?: string; displayName?: string };
      categories?: { name?: string; totals?: string[] }[];
    }[];
  };
  let playerJson: PlayerStatsPayload | null = null;
  if (playerStatsRes && playerStatsRes.ok) {
    playerJson = (await playerStatsRes.json()) as PlayerStatsPayload;
  }
  if (!(playerJson?.athletes?.length)) {
    try {
      const fallback = await fetch(playerStatsUrl(priorSeason), {
        headers: { Accept: "application/json" },
      });
      if (fallback.ok) {
        playerJson = (await fallback.json()) as PlayerStatsPayload;
      }
    } catch {
      /* optional */
    }
  }
  if (playerJson?.athletes?.length) {
    try {
      const glossary = playerJson.categories ?? [];
      const tableSpecs: {
        key: string;
        title: string;
        labelKeys: string[];
        /** Index within selected labels used for sorting / min filter. */
        sortLabel: string;
      }[] = [
        {
          key: "passing",
          title: "Passing",
          labelKeys: ["CMP", "ATT", "YDS", "TD", "INT", "RTG"],
          sortLabel: "YDS",
        },
        {
          key: "rushing",
          title: "Rushing",
          labelKeys: ["CAR", "YDS", "AVG", "TD", "LNG"],
          sortLabel: "YDS",
        },
        {
          key: "receiving",
          title: "Receiving",
          labelKeys: ["REC", "YDS", "AVG", "TD", "LNG"],
          sortLabel: "YDS",
        },
        {
          key: "defensive",
          title: "Defense",
          labelKeys: ["SOLO", "AST", "TOT", "SACK", "TFL", "PD"],
          sortLabel: "TOT",
        },
      ];
      for (const spec of tableSpecs) {
        const catMeta = glossary.find((c) => c.name === spec.key);
        const allLabels = catMeta?.labels ?? [];
        const idxs = spec.labelKeys
          .map((lab) => allLabels.findIndex((l) => l.toUpperCase() === lab.toUpperCase()))
          .filter((i) => i >= 0);
        const labels = idxs.length ? idxs.map((i) => allLabels[i]!) : spec.labelKeys;
        const sortPos = Math.max(
          0,
          labels.findIndex((l) => l.toUpperCase() === spec.sortLabel.toUpperCase()),
        );
        const rows: NflTeamPage["playerTables"][number]["rows"] = [];
        for (const row of playerJson.athletes ?? []) {
          const ath = row.athlete;
          if (!ath?.id || !ath.displayName) continue;
          const cat = (row.categories ?? []).find((c) => c.name === spec.key);
          const totals = cat?.totals ?? [];
          if (!totals.length) continue;
          const primaryRaw = idxs.length ? totals[idxs[sortPos] ?? idxs[0]!] : totals[sortPos];
          const primary = parseFloat(String(primaryRaw ?? "0").replace(/,/g, ""));
          if (!(primary > 0)) continue;
          const stats = (idxs.length ? idxs : spec.labelKeys.map((_, i) => i)).map(
            (i) => totals[i] ?? "—",
          );
          rows.push({ id: String(ath.id), name: ath.displayName, stats });
        }
        rows.sort((a, b) => {
          const av = parseFloat(String(a.stats[sortPos] ?? "0").replace(/,/g, "")) || 0;
          const bv = parseFloat(String(b.stats[sortPos] ?? "0").replace(/,/g, "")) || 0;
          return bv - av;
        });
        if (rows.length) {
          playerTables.push({ name: spec.title, labels, rows: rows.slice(0, 12) });
        }
      }
    } catch {
      /* optional */
    }
  }

  return {
    id,
    name: t.displayName ?? "Team",
    shortName: t.shortDisplayName ?? t.abbreviation ?? "Team",
    abbrev: t.abbreviation ?? "—",
    color: (t.color ?? "333333").replace(/^#/, ""),
    logo: t.logos?.[0]?.href ?? nflTeamLogo(t.abbreviation ?? "nfl"),
    record: overall,
    standing,
    venueName: venue?.fullName ?? null,
    venueCity: venue?.address
      ? [venue.address.city, venue.address.state].filter(Boolean).join(", ")
      : null,
    venueImage,
    coachName,
    coachId,
    coachExperience,
    nextEvent: next?.id
      ? { id: String(next.id), name: next.name ?? "Next game", date: next.date ?? null }
      : null,
    statGroups,
    playerTables,
    roster: rosterPlayers,
  };
}

export type NflCoach = {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  teamAbbrev: string;
  teamColor: string;
  logo: string | null;
  headshot: string | null;
  experience: number;
  record: string | null;
  wins: number;
  losses: number;
  ties: number;
  winPct: number | null;
  pointDiff: number | null;
  hotSeatScore: number;
  hotSeatRank: number;
  firedOddsAmerican: string | null;
  firedOddsPct: number | null;
  kalshiUrl: string | null;
  factors: { label: string; points: number; detail: string }[];
};

const KALSHI_NFL_TEAM_HINTS: { hint: string; abbrev: string }[] = [
  { hint: "arizona", abbrev: "ARI" },
  { hint: "atlanta", abbrev: "ATL" },
  { hint: "baltimore", abbrev: "BAL" },
  { hint: "buffalo", abbrev: "BUF" },
  { hint: "carolina", abbrev: "CAR" },
  { hint: "chicago", abbrev: "CHI" },
  { hint: "cincinnati", abbrev: "CIN" },
  { hint: "cleveland", abbrev: "CLE" },
  { hint: "dallas", abbrev: "DAL" },
  { hint: "denver", abbrev: "DEN" },
  { hint: "detroit", abbrev: "DET" },
  { hint: "green bay", abbrev: "GB" },
  { hint: "houston", abbrev: "HOU" },
  { hint: "indianapolis", abbrev: "IND" },
  { hint: "jacksonville", abbrev: "JAX" },
  { hint: "kansas city", abbrev: "KC" },
  { hint: "las vegas", abbrev: "LV" },
  { hint: "los angeles c", abbrev: "LAC" },
  { hint: "los angeles r", abbrev: "LAR" },
  { hint: "miami", abbrev: "MIA" },
  { hint: "minnesota", abbrev: "MIN" },
  { hint: "new england", abbrev: "NE" },
  { hint: "new orleans", abbrev: "NO" },
  { hint: "new york g", abbrev: "NYG" },
  { hint: "new york j", abbrev: "NYJ" },
  { hint: "philadelphia", abbrev: "PHI" },
  { hint: "pittsburgh", abbrev: "PIT" },
  { hint: "san francisco", abbrev: "SF" },
  { hint: "seattle", abbrev: "SEA" },
  { hint: "tampa bay", abbrev: "TB" },
  { hint: "tennessee", abbrev: "TEN" },
  { hint: "washington", abbrev: "WSH" },
];

function nflAbbrevFromKalshiSubtitle(subtitle: string | null | undefined): string | null {
  const raw = (subtitle ?? "").replace(/^:+\s*/, "").trim().toLowerCase();
  if (!raw) return null;
  // Prefer longer / more specific hints first (Los Angeles C vs R, New York J vs G).
  const sorted = [...KALSHI_NFL_TEAM_HINTS].sort((a, b) => b.hint.length - a.hint.length);
  for (const row of sorted) {
    if (raw.includes(row.hint) || row.hint.includes(raw)) return row.abbrev;
  }
  // City-only leftovers
  if (raw === "los angeles") return null;
  if (raw === "new york") return null;
  return null;
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

type KalshiCoachMarket = {
  name: string;
  teamAbbrev: string | null;
  teamHint: string | null;
  impliedPct: number;
  american: string;
  ticker: string;
  url: string;
};

/** Kalshi “coach out before Sep 1” markets — primary NFL hot-seat signal. */
export async function fetchNflCoachFiredOdds(): Promise<KalshiCoachMarket[]> {
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
      body: { action: "nflCoachFiredOdds" },
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
          body: JSON.stringify({ action: "nflCoachFiredOdds" }),
        });
        if (res.ok) {
          const data = (await res.json()) as { items?: EdgeItem[]; error?: string };
          if (!data.error && data.items?.length) items = data.items;
        }
      }
    } catch {
      /* fall through to direct (often CORS-blocked in browser) */
    }
  }

  if (!items.length) {
    // Direct Kalshi — works in Node / some environments; browsers usually get 403.
    try {
      const res = await fetch(
        "https://api.elections.kalshi.com/trade-api/v2/markets?limit=50&status=open&series_ticker=KXCOACHOUTNFL",
        { headers: { Accept: "application/json" } },
      );
      if (res.ok) {
        const data = (await res.json()) as {
          markets?: {
            title?: string;
            subtitle?: string;
            ticker?: string;
            yes_sub_title?: string | null;
            no_sub_title?: string | null;
            yes_bid_dollars?: string | null;
            yes_ask_dollars?: string | null;
            last_price_dollars?: string | null;
            custom_strike?: { Coach?: string; Team?: string } | null;
          }[];
        };
        for (const m of data.markets ?? []) {
          const name =
            (m.custom_strike?.Coach ?? m.yes_sub_title ?? m.no_sub_title ?? "").trim() || "";
          if (!name || /field|any other/i.test(name)) continue;
          const bid = dollarProb(m.yes_bid_dollars);
          const ask = dollarProb(m.yes_ask_dollars);
          const last = dollarProb(m.last_price_dollars);
          let p: number | null = null;
          if (bid != null && ask != null && (bid > 0 || ask > 0)) p = (bid + ask) / 2;
          else p = (ask && ask > 0 ? ask : null) ?? (bid && bid > 0 ? bid : null) ?? last;
          if (p == null || p <= 0) continue;
          const subtitle = (m.subtitle ?? "").replace(/^:+\s*/, "").trim();
          items.push({
            name,
            teamHint: subtitle || null,
            oddsAmerican: americanFromProb(p),
            impliedPct: Math.round(p * 1000) / 10,
            ticker: m.ticker ?? "",
            url: `https://kalshi.com/markets/${(m.ticker ?? "").toLowerCase()}`,
          });
        }
      }
    } catch {
      /* */
    }
  }

  const out: KalshiCoachMarket[] = [];
  for (const m of items) {
    const name = (m.name ?? "").trim();
    if (!name) continue;
    const pct = typeof m.impliedPct === "number" ? m.impliedPct : null;
    if (pct == null || !Number.isFinite(pct) || pct <= 0) continue;
    const hint = m.teamHint ?? null;
    const p = Math.max(0.01, Math.min(0.99, pct > 1 ? pct / 100 : pct));
    out.push({
      name,
      teamAbbrev: nflAbbrevFromKalshiSubtitle(hint),
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

/**
 * NFL hot seat — ranked by Kalshi coach-out %, with ESPN team records for context.
 * ESPN roster.coach is unreliable (scrambled HCs), so Kalshi is the source of truth for who
 * coaches which team.
 */
export async function fetchNflCoaches(): Promise<NflCoach[]> {
  type TeamRow = {
    id: string;
    displayName: string;
    abbreviation: string;
    color: string;
    logo: string | null;
    recordSummary: string | null;
    wins: number;
    losses: number;
    ties: number;
    pointDiff: number;
  };

  const byAbbrev = new Map<string, TeamRow>();

  try {
    const teamsRes = await fetch(`${ESPN}/teams?limit=32`, {
      headers: { Accept: "application/json" },
    });
    if (teamsRes.ok) {
      const teamsJson = (await teamsRes.json()) as {
        sports?: {
          leagues?: {
            teams?: {
              team?: {
                id?: string;
                displayName?: string;
                abbreviation?: string;
                color?: string;
                logos?: { href?: string }[];
                record?: {
                  items?: {
                    type?: string;
                    summary?: string;
                    stats?: { name?: string; value?: number }[];
                  }[];
                };
              };
            }[];
          }[];
        }[];
      };
      for (const row of teamsJson.sports?.[0]?.leagues?.[0]?.teams ?? []) {
        const team = row.team;
        if (!team?.id || !team.abbreviation) continue;
        const total = (team.record?.items ?? []).find((r) => r.type === "total");
        const stat = (n: string) => total?.stats?.find((s) => s.name === n)?.value ?? 0;
        byAbbrev.set(team.abbreviation.toUpperCase(), {
          id: String(team.id),
          displayName: team.displayName ?? "Team",
          abbreviation: team.abbreviation,
          color: (team.color ?? "333").replace(/^#/, ""),
          logo: team.logos?.[0]?.href ?? nflTeamLogo(team.abbreviation),
          recordSummary: total?.summary ?? null,
          wins: Number(stat("wins")) || 0,
          losses: Number(stat("losses")) || 0,
          ties: Number(stat("ties")) || 0,
          pointDiff: Number(stat("pointDifferential")) || 0,
        });
      }
    }
  } catch {
    /* Kalshi-only still works */
  }

  if (!byAbbrev.size) {
    for (const t of NFL_TEAMS) {
      byAbbrev.set(t.abbrev, {
        id: String(t.id),
        displayName: t.name,
        abbreviation: t.abbrev,
        color: "333",
        logo: nflTeamLogo(t.abbrev),
        recordSummary: null,
        wins: 0,
        losses: 0,
        ties: 0,
        pointDiff: 0,
      });
    }
  }

  const kalshi = await fetchNflCoachFiredOdds();
  if (!kalshi.length) {
    throw new Error(
      "Couldn't load Kalshi coach markets. Check network / sports function deploy.",
    );
  }

  const coaches: Omit<NflCoach, "hotSeatRank">[] = [];
  for (const m of kalshi) {
    const team =
      (m.teamAbbrev ? byAbbrev.get(m.teamAbbrev) : null) ??
      [...byAbbrev.values()].find((t) =>
        (m.teamHint ?? "").toLowerCase().includes(t.displayName.toLowerCase().split(" ").slice(-1)[0] ?? "___"),
      ) ??
      null;
    const games = team ? team.wins + team.losses + team.ties : 0;
    const winPct = games > 0 && team ? team.wins / games : null;
    const marketPct = m.impliedPct;
    // Kalshi dominates — mirror MLB hot seat weighting.
    const marketPts = Math.round(marketPct * 0.85 * 10) / 10;
    const factors: NflCoach["factors"] = [
      {
        label: "Kalshi %",
        points: marketPts,
        detail: `Kalshi ~${marketPct.toFixed(1)}% coach-out → +${marketPts} heat`,
      },
    ];
    let score = 20 + marketPts;
    if (winPct != null && team) {
      if (winPct < 0.35) {
        score += 8;
        factors.push({ label: "Poor record", points: 8, detail: team.recordSummary ?? "" });
      } else if (winPct >= 0.6) {
        score -= 6;
        factors.push({ label: "Winning club", points: -6, detail: team.recordSummary ?? "" });
      }
    }
    const id =
      m.ticker.replace(/^KXCOACHOUTNFL-[^-]+-/, "") ||
      m.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    coaches.push({
      id,
      name: m.name,
      teamId: team?.id ?? "0",
      teamName: team?.displayName ?? m.teamHint ?? "NFL",
      teamAbbrev: team?.abbreviation ?? m.teamAbbrev ?? "—",
      teamColor: team?.color ?? "333",
      logo: team?.logo ?? (m.teamAbbrev ? nflTeamLogo(m.teamAbbrev) : null),
      headshot: null,
      experience: 0,
      record: team?.recordSummary ?? null,
      wins: team?.wins ?? 0,
      losses: team?.losses ?? 0,
      ties: team?.ties ?? 0,
      winPct,
      pointDiff: team?.pointDiff ?? null,
      hotSeatScore: Math.max(0, Math.min(100, Math.round(score))),
      firedOddsAmerican: m.american,
      firedOddsPct: marketPct,
      kalshiUrl: m.url,
      factors,
    });
  }

  coaches.sort((a, b) => {
    const ap = a.firedOddsPct ?? -1;
    const bp = b.firedOddsPct ?? -1;
    if (ap !== bp) return bp - ap;
    return b.hotSeatScore - a.hotSeatScore || a.name.localeCompare(b.name);
  });
  return coaches.map((c, i) => ({ ...c, hotSeatRank: i + 1 }));
}

export type NflCoachProfile = NflCoach & {
  bio: string | null;
  careerHighlights: string[];
};

export async function fetchNflCoachProfile(coachId: string): Promise<NflCoachProfile> {
  const all = await fetchNflCoaches();
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
            /football|nfl/i.test(it.sport ?? "nfl") &&
            (it.displayName ?? "").toLowerCase().includes(base.name.split(" ").slice(-1)[0]!.toLowerCase()),
        ) ??
        (data.items ?? []).find((it) =>
          (it.displayName ?? "").toLowerCase() === base.name.toLowerCase(),
        );
      if (hit?.headshot?.href) headshot = hit.headshot.href;
      if (hit?.description) bio = hit.description;
    }
  } catch {
    /* optional */
  }

  const careerHighlights = [
    base.firedOddsPct != null
      ? `Kalshi coach-out: ${base.firedOddsPct.toFixed(1)}% (${base.firedOddsAmerican})`
      : null,
    base.record ? `Team record: ${base.record}` : null,
    base.pointDiff != null ? `Point differential: ${base.pointDiff > 0 ? "+" : ""}${base.pointDiff}` : null,
  ].filter(Boolean) as string[];

  return {
    ...base,
    headshot,
    bio:
      bio ??
      `${base.name} is the head coach of the ${base.teamName}. Hot seat ranking is driven by Kalshi coach-out markets.`,
    careerHighlights,
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
  /** Favorite player/coach team ids — boosts matchups involving those clubs. */
  watchTeamIds?: Set<string>;
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

    const watchTeams = ctx.watchTeamIds;
    if (watchTeams?.size) {
      const awayWatched = watchTeams.has(String(g.away.teamId));
      const homeWatched = watchTeams.has(String(g.home.teamId));
      if (awayWatched || homeWatched) {
        score += awayWatched && homeWatched ? 26 : 18;
        reasons.push(
          awayWatched && homeWatched ? "Favorite players both sides" : "Favorite player team",
        );
      }
    }
    if (ctx.watchPlayerIds.size) {
      // Reserved for future athlete-id matching on box scores / PBP.
      void ctx.watchPlayerIds;
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
