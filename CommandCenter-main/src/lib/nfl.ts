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
  const [athleteRes, overviewRes] = await Promise.all([
    fetch(`${ESPN_WEB}/athletes/${id}`, { headers: { Accept: "application/json" } }),
    fetch(`${ESPN_WEB}/athletes/${id}/overview`, { headers: { Accept: "application/json" } }),
  ]);
  if (!athleteRes.ok) throw new Error(`NFL player ${athleteRes.status}`);
  const raw = (await athleteRes.json()) as { athlete?: Record<string, unknown> };
  const overview = overviewRes.ok ? ((await overviewRes.json()) as Record<string, unknown>) : {};
  const a = (raw.athlete ?? {}) as Record<string, unknown>;
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
  const [teamRes, rosterRes, statsRes, standingsRes] = await Promise.all([
    fetch(`${ESPN}/teams/${id}`, { headers: { Accept: "application/json" } }),
    fetch(`${ESPN}/teams/${id}/roster`, { headers: { Accept: "application/json" } }),
    fetch(`${ESPN}/teams/${id}/statistics?season=${season}`, { headers: { Accept: "application/json" } }),
    fetch("https://site.api.espn.com/apis/v2/sports/football/nfl/standings", {
      headers: { Accept: "application/json" },
    }),
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
  experience: number;
  record: string | null;
  wins: number;
  losses: number;
  ties: number;
  winPct: number | null;
  pointDiff: number | null;
  hotSeatScore: number;
  hotSeatRank: number;
  factors: { label: string; points: number; detail: string }[];
};

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

  const teams: TeamRow[] = [];

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
        if (!team?.id) continue;
        const total = (team.record?.items ?? []).find((r) => r.type === "total");
        const stat = (n: string) => total?.stats?.find((s) => s.name === n)?.value ?? 0;
        teams.push({
          id: String(team.id),
          displayName: team.displayName ?? "Team",
          abbreviation: team.abbreviation ?? "—",
          color: (team.color ?? "333").replace(/^#/, ""),
          logo: team.logos?.[0]?.href ?? nflTeamLogo(team.abbreviation ?? "nfl"),
          recordSummary: total?.summary ?? null,
          wins: Number(stat("wins")) || 0,
          losses: Number(stat("losses")) || 0,
          ties: Number(stat("ties")) || 0,
          pointDiff: Number(stat("pointDifferential")) || 0,
        });
      }
    }
  } catch {
    /* fall through to NFL_TEAMS */
  }

  if (!teams.length) {
    for (const t of NFL_TEAMS) {
      teams.push({
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

  const coaches: Omit<NflCoach, "hotSeatRank">[] = [];
  const concurrency = 4;
  for (let i = 0; i < teams.length; i += concurrency) {
    const chunk = teams.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (team) => {
        let coach: { id?: string; firstName?: string; lastName?: string; experience?: number } | null =
          null;
        try {
          const rosterRes = await fetch(`${ESPN}/teams/${team.id}/roster`, {
            headers: { Accept: "application/json" },
          });
          if (rosterRes.ok) {
            const roster = (await rosterRes.json()) as {
              coach?: { id?: string; firstName?: string; lastName?: string; experience?: number }[];
            };
            coach = roster.coach?.[0] ?? null;
          }
        } catch {
          /* try core API */
        }
        if (!coach?.id) {
          try {
            const core = (await (
              await fetch(
                `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/teams/${team.id}/coaches`,
                { headers: { Accept: "application/json" } },
              )
            ).json()) as { items?: { $ref?: string }[] };
            const ref = core.items?.[0]?.$ref;
            if (ref) {
              const href = ref.replace(/^http:/, "https:");
              const detail = (await (await fetch(href, { headers: { Accept: "application/json" } })).json()) as {
                id?: string | number;
                firstName?: string;
                lastName?: string;
                experience?: number;
              };
              if (detail?.id != null) {
                coach = {
                  id: String(detail.id),
                  firstName: detail.firstName,
                  lastName: detail.lastName,
                  experience: detail.experience,
                };
              }
            }
          } catch {
            /* skip team */
          }
        }
        if (!coach?.id) return;

        const games = team.wins + team.losses + team.ties;
        const winPct = games > 0 ? team.wins / games : null;
        const experience = typeof coach.experience === "number" ? coach.experience : 0;
        const factors: NflCoach["factors"] = [];
        let score = 40;
        if (experience <= 0) {
          score -= 18;
          factors.push({ label: "First year", points: -18, detail: "Grace period" });
        } else if (experience === 1) {
          score -= 10;
          factors.push({ label: "Year two", points: -10, detail: "Still settling" });
        } else if (experience >= 8) {
          score += 8;
          factors.push({ label: "Long tenure", points: 8, detail: `${experience} seasons` });
        }
        if (winPct != null) {
          if (winPct < 0.35) {
            score += 22;
            factors.push({ label: "Poor record", points: 22, detail: team.recordSummary ?? "" });
          } else if (winPct < 0.45) {
            score += 12;
            factors.push({ label: "Below .500", points: 12, detail: team.recordSummary ?? "" });
          } else if (winPct >= 0.6) {
            score -= 14;
            factors.push({ label: "Winning club", points: -14, detail: team.recordSummary ?? "" });
          }
        }
        if (team.pointDiff <= -60) {
          score += 14;
          factors.push({ label: "Point drain", points: 14, detail: String(team.pointDiff) });
        } else if (team.pointDiff >= 60) {
          score -= 10;
          factors.push({ label: "Point edge", points: -10, detail: `+${team.pointDiff}` });
        }
        coaches.push({
          id: String(coach.id),
          name: [coach.firstName, coach.lastName].filter(Boolean).join(" ") || "Head coach",
          teamId: team.id,
          teamName: team.displayName,
          teamAbbrev: team.abbreviation,
          teamColor: team.color,
          logo: team.logo,
          experience,
          record: team.recordSummary,
          wins: team.wins,
          losses: team.losses,
          ties: team.ties,
          winPct,
          pointDiff: team.pointDiff,
          hotSeatScore: Math.max(0, Math.min(100, Math.round(score))),
          factors,
        });
      }),
    );
  }

  if (!coaches.length) {
    throw new Error("Couldn't load NFL coaches — ESPN returned no head coaches.");
  }
  coaches.sort((a, b) => b.hotSeatScore - a.hotSeatScore || a.name.localeCompare(b.name));
  return coaches.map((c, i) => ({ ...c, hotSeatRank: i + 1 }));
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
