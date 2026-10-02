/** NHL via ESPN site API — scoreboard, standings, teams, games, players. */

import { parseEspnBroadcasts, type GameBroadcast } from "./game-broadcasts";
import { espnBirthDate, espnBirthPlace, formatSportsDateLong } from "./utils";

const ESPN = "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl";
const ESPN_WEB = "https://site.web.api.espn.com/apis/common/v3/sports/hockey/nhl";
const CORE = "https://sports.core.api.espn.com/v2/sports/hockey/leagues/nhl";

export function chicagoTodayNhl(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

function chicagoDateFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

/**
 * ESPN NHL season id is the year the season ends (2027 = 2026-27).
 * The new season opens mid-September — stay on the upcoming/current year from Sep 1.
 */
export function nhlSeasonYear(d = new Date()): number {
  const y = d.getFullYear();
  const m = d.getMonth();
  if (m >= 8) return y + 1; // Sep–Dec → season ending next calendar year
  return y;
}

export function nhlHeadshot(playerId: string | number, size = "full"): string {
  return `https://a.espncdn.com/i/headshots/nhl/players/${size}/${playerId}.png`;
}

export function nhlTeamLogo(abbrevOrId: string): string {
  return `https://a.espncdn.com/i/teamlogos/nhl/500/${abbrevOrId.toLowerCase()}.png`;
}

export const NHL_TEAMS: { id: number; name: string; abbrev: string }[] = [
  { id: 25, name: "Anaheim Ducks", abbrev: "ANA" },
  { id: 1, name: "Boston Bruins", abbrev: "BOS" },
  { id: 2, name: "Buffalo Sabres", abbrev: "BUF" },
  { id: 3, name: "Calgary Flames", abbrev: "CGY" },
  { id: 7, name: "Carolina Hurricanes", abbrev: "CAR" },
  { id: 4, name: "Chicago Blackhawks", abbrev: "CHI" },
  { id: 17, name: "Colorado Avalanche", abbrev: "COL" },
  { id: 29, name: "Columbus Blue Jackets", abbrev: "CBJ" },
  { id: 9, name: "Dallas Stars", abbrev: "DAL" },
  { id: 5, name: "Detroit Red Wings", abbrev: "DET" },
  { id: 6, name: "Edmonton Oilers", abbrev: "EDM" },
  { id: 26, name: "Florida Panthers", abbrev: "FLA" },
  { id: 8, name: "Los Angeles Kings", abbrev: "LA" },
  { id: 30, name: "Minnesota Wild", abbrev: "MIN" },
  { id: 10, name: "Montreal Canadiens", abbrev: "MTL" },
  { id: 27, name: "Nashville Predators", abbrev: "NSH" },
  { id: 11, name: "New Jersey Devils", abbrev: "NJ" },
  { id: 12, name: "New York Islanders", abbrev: "NYI" },
  { id: 13, name: "New York Rangers", abbrev: "NYR" },
  { id: 14, name: "Ottawa Senators", abbrev: "OTT" },
  { id: 15, name: "Philadelphia Flyers", abbrev: "PHI" },
  { id: 16, name: "Pittsburgh Penguins", abbrev: "PIT" },
  { id: 18, name: "San Jose Sharks", abbrev: "SJ" },
  { id: 124292, name: "Seattle Kraken", abbrev: "SEA" },
  { id: 19, name: "St. Louis Blues", abbrev: "STL" },
  { id: 20, name: "Tampa Bay Lightning", abbrev: "TB" },
  { id: 21, name: "Toronto Maple Leafs", abbrev: "TOR" },
  { id: 129764, name: "Utah Mammoth", abbrev: "UTA" },
  { id: 22, name: "Vancouver Canucks", abbrev: "VAN" },
  { id: 37, name: "Vegas Golden Knights", abbrev: "VGK" },
  { id: 23, name: "Washington Capitals", abbrev: "WSH" },
  { id: 28, name: "Winnipeg Jets", abbrev: "WPG" },
];

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return (await res.json()) as T;
}

export type NhlScoreSide = {
  teamId: number;
  name: string;
  abbrev: string;
  score: number | null;
  record: string | null;
  logo: string | null;
  color: string;
  linescores: number[];
};

export type NhlScoreGame = {
  id: string;
  status: string;
  shortDetail: string | null;
  live: boolean;
  final: boolean;
  away: NhlScoreSide;
  home: NhlScoreSide;
  when: string | null;
  whenShort: string | null;
  venue: string | null;
  date: string | null;
  /** Kickoff as an ISO instant. */
  startIso?: string | null;
  broadcasts: GameBroadcast[];
};

export type NhlScoredGame = NhlScoreGame & {
  score: number;
  reasons: string[];
};

type EspnCompetitor = {
  homeAway?: string;
  score?: string | number;
  team?: {
    id?: string;
    displayName?: string;
    abbreviation?: string;
    color?: string;
    logos?: { href?: string }[];
    logo?: string;
  };
  records?: { type?: string; name?: string; summary?: string }[];
  linescores?: { displayValue?: string; value?: number }[];
};

type EspnEvent = {
  id?: string;
  date?: string;
  name?: string;
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
    competitors?: EspnCompetitor[];
  }[];
};

function sideFromCompetitor(c: EspnCompetitor): NhlScoreSide {
  const team = c.team ?? {};
  const record =
    c.records?.find((r) => r.type === "total" || r.name === "overall")?.summary ??
    c.records?.[0]?.summary ??
    null;
  const linescores = (c.linescores ?? [])
    .map((l) => Number(l.displayValue ?? l.value))
    .filter((n) => Number.isFinite(n));
  const scoreRaw = c.score;
  const score =
    scoreRaw == null || scoreRaw === ""
      ? null
      : Number.isFinite(Number(scoreRaw))
        ? Number(scoreRaw)
        : null;
  return {
    teamId: Number(team.id ?? 0),
    name: team.displayName ?? "Team",
    abbrev: team.abbreviation ?? "—",
    score,
    record,
    logo: team.logos?.[0]?.href ?? team.logo ?? (team.abbreviation ? nhlTeamLogo(team.abbreviation) : null),
    color: (team.color ?? "002f87").replace(/^#/, ""),
    linescores,
  };
}

function mapScoreEvent(event: EspnEvent): NhlScoreGame | null {
  const comp = event.competitions?.[0];
  if (!comp) return null;
  const status = comp.status?.type;
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
    status: status?.description ?? status?.name ?? (live ? "Live" : final ? "Final" : "Scheduled"),
    shortDetail: status?.shortDetail ?? status?.detail ?? null,
    live,
    final,
    away: sideFromCompetitor(away),
    home: sideFromCompetitor(home),
    when: final || live ? (status?.shortDetail ?? when) : when,
    whenShort: live || final ? (status?.shortDetail ?? null) : whenShort,
    venue: comp.venue?.fullName ?? null,
    date: chicagoDateFromIso(event.date),
    startIso: event.date ?? null,
    broadcasts: parseEspnBroadcasts(comp.geoBroadcasts, comp.broadcasts),
  };
}

export async function fetchNhlScoreboard(dates?: string): Promise<NhlScoreGame[]> {
  const url = dates ? `${ESPN}/scoreboard?dates=${dates}` : `${ESPN}/scoreboard`;
  const raw = await getJson<{ events?: EspnEvent[] }>(url);
  return (raw.events ?? []).map(mapScoreEvent).filter((g): g is NhlScoreGame => Boolean(g?.id));
}

export function pickNhlHeroGame(games: NhlScoreGame[]): NhlScoreGame | null {
  return games.find((g) => g.live) ?? games.find((g) => !g.final) ?? games[0] ?? null;
}

export type NhlRuwtContext = {
  teamInterest: Record<string, number>;
  /** Favorite player team ids — boosts matchups involving those clubs. */
  watchTeamIds?: Set<string>;
};

/** Drama + interest score for RUWT (parallel to NFL / soccer). */
export function scoreNhlRuwtGame(
  g: NhlScoreGame,
  ctx?: NhlRuwtContext,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const detail = `${g.shortDetail ?? ""} ${g.status ?? ""}`.toLowerCase();
  const inOt = /\bot\b|overtime|shootout|\bso\b/.test(detail);

  if (g.live) {
    score += 40;
    reasons.push("Live");
    const diff = Math.abs((g.away.score ?? 0) - (g.home.score ?? 0));
    if (diff <= 1) {
      score += 28;
      reasons.push("One-goal game");
    } else if (diff <= 2) {
      score += 14;
      reasons.push("Tight");
    }
    if (inOt) {
      score += 18;
      reasons.push("Overtime");
    } else if (/\b3rd\b/.test(detail) && diff <= 1) {
      score += 12;
      reasons.push("Late & close");
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
  }

  const unique: string[] = [];
  for (const r of reasons) if (!unique.includes(r)) unique.push(r);
  return { score: Math.max(0, score), reasons: unique.slice(0, 5) };
}

export function rankNhlRuwtGames(
  games: NhlScoreGame[],
  ctx?: NhlRuwtContext,
  limit = 20,
): NhlScoredGame[] {
  return [...games]
    .map((g) => {
      const { score, reasons } = scoreNhlRuwtGame(g, ctx);
      return { ...g, score, reasons };
    })
    .sort((a, b) => b.score - a.score || Number(b.id) - Number(a.id))
    .slice(0, limit);
}

export type NhlStandingRow = {
  teamId: string;
  name: string;
  abbrev: string;
  logo: string | null;
  record: string;
  points: string;
  diff: string;
  gp: string;
};

export type NhlStandingGroup = {
  name: string;
  seasonLabel: string | null;
  rows: NhlStandingRow[];
};

type StandingsPayload = {
  seasons?: { year?: number; displayName?: string }[];
  children?: {
    name?: string;
    standings?: {
      entries?: {
        team?: {
          id?: string;
          displayName?: string;
          abbreviation?: string;
          logos?: { href?: string }[];
        };
        stats?: { name?: string; displayValue?: string }[];
      }[];
    };
  }[];
};

function mapStandings(raw: StandingsPayload, seasonLabel: string | null): NhlStandingGroup[] {
  return (raw.children ?? []).map((child) => ({
    name: child.name ?? "Conference",
    seasonLabel,
    rows: (child.standings?.entries ?? []).map((e) => {
      const stat = (n: string) => e.stats?.find((s) => s.name === n)?.displayValue ?? "";
      const wins = stat("wins") || "0";
      const losses = stat("losses") || "0";
      const otl = stat("otLosses") || stat("overtimeLosses") || "0";
      const team = e.team ?? {};
      return {
        teamId: String(team.id ?? ""),
        name: team.displayName ?? "Team",
        abbrev: team.abbreviation ?? "—",
        logo: team.logos?.[0]?.href ?? (team.abbreviation ? nhlTeamLogo(team.abbreviation) : null),
        record: `${wins}-${losses}-${otl}`,
        points: stat("points") || "0",
        diff: stat("pointDifferential") || stat("differential") || "0",
        gp: stat("gamesPlayed") || "0",
      };
    }),
  }));
}

export async function fetchNhlStandings(): Promise<NhlStandingGroup[]> {
  const season = nhlSeasonYear();
  const current = await getJson<StandingsPayload>(
    `https://site.api.espn.com/apis/v2/sports/hockey/nhl/standings?season=${season}`,
  );
  const label =
    current.seasons?.find((s) => s.year === season)?.displayName ??
    current.seasons?.[0]?.displayName ??
    `${season - 1}-${String(season).slice(2)}`;
  return mapStandings(current, label);
}

export type NhlScoringLeader = {
  id: string;
  name: string;
  goals: string;
  assists: string;
  points: string;
  seasonLabel: string | null;
};

export async function fetchNhlScoringLeaders(limit = 10): Promise<NhlScoringLeader[]> {
  const season = nhlSeasonYear();
  const url =
    `${ESPN_WEB}/statistics/byathlete?region=us&lang=en&contentorigin=espn` +
    `&isqualified=false&page=1&limit=${limit}&sort=offensive.points%3Adesc&season=${season}&seasontype=2`;
  const raw = await getJson<{
    requestedSeason?: { displayName?: string };
    athletes?: {
      athlete?: { id?: string; displayName?: string };
      categories?: { name?: string; totals?: string[] }[];
    }[];
  }>(url).catch(() => null);
  const rows: NhlScoringLeader[] = [];
  for (const row of raw?.athletes ?? []) {
    const id = row.athlete?.id;
    if (!id) continue;
    const off = row.categories?.find((c) => c.name === "offensive");
    const totals = off?.totals ?? [];
    rows.push({
      id: String(id),
      name: row.athlete?.displayName ?? "Player",
      goals: totals[0] ?? "—",
      assists: totals[1] ?? "—",
      points: totals[2] ?? "0",
      seasonLabel: raw?.requestedSeason?.displayName ?? `${season - 1}-${String(season).slice(2)}`,
    });
  }
  // Early-season boards may be all zeroes — still show the 2026-27 slate, not last year.
  return rows.slice(0, limit);
}

export type NhlBoxRow = {
  id: string;
  name: string;
  stats: { label: string; value: string }[];
};

export type NhlBoxGroup = {
  teamAbbrev: string;
  teamId: string;
  name: string;
  rows: NhlBoxRow[];
};

export type NhlScoringPlay = {
  id: string;
  text: string;
  period: string | null;
  clock: string | null;
  awayScore: number | null;
  homeScore: number | null;
  teamId: string | null;
  strength: string | null;
  athletes: { id: string; name: string; role: string }[];
};

export type NhlGameLeader = {
  category: string;
  teamAbbrev: string;
  id: string;
  name: string;
  value: string;
};

export type NhlGameDetail = NhlScoreGame & {
  teamStats: { label: string; away: string; home: string }[];
  boxGroups: NhlBoxGroup[];
  scoringPlays: NhlScoringPlay[];
  leaders: NhlGameLeader[];
  article: { headline: string; description: string | null; storyHtml: string | null } | null;
  oddsLine: string | null;
  lastFive: {
    teamId: number;
    teamAbbrev: string;
    results: { label: string; result: string; score: string | null }[];
  }[];
  venueDetail: string | null;
  goalieStarters: {
    away: { id: string; name: string } | null;
    home: { id: string; name: string } | null;
  };
};

function sanitizeNhlStoryHtml(html: string | null | undefined): string | null {
  if (!html?.trim()) return null;
  return html
    .replace(/<\/?hl(\d)>/gi, (_, n: string) => {
      const level = Math.min(5, Math.max(2, Number(n) || 2));
      return _.startsWith("</") ? `</h${level}>` : `<h${level}>`;
    })
    .replace(/<\/?photo[^>]*>/gi, "")
    .replace(/<\/?image[^>]*>/gi, "")
    .trim();
}

const SKATER_COLS = ["G", "A", "+/-", "S", "SOG", "TOI", "PIM", "HT", "BS"];
const GOALIE_COLS = ["SV", "SV%", "GA", "SA", "TOI"];

function pickCols(
  labels: string[],
  values: string[],
  want: string[],
): { label: string; value: string }[] {
  return want
    .map((label) => {
      const i = labels.indexOf(label);
      if (i < 0) return null;
      return { label, value: values[i] ?? "—" };
    })
    .filter((x): x is { label: string; value: string } => Boolean(x));
}

function statNum(stats: { label: string; value: string }[], label: string): number {
  const raw = stats.find((s) => s.label === label)?.value ?? "";
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export async function fetchNhlGameDetail(eventId: string): Promise<NhlGameDetail> {
  const raw = await getJson<{
    header?: { competitions?: EspnEvent["competitions"]; id?: string };
    boxscore?: {
      teams?: {
        homeAway?: string;
        team?: { abbreviation?: string; id?: string };
        statistics?: { name?: string; displayValue?: string; label?: string }[];
      }[];
      players?: {
        team?: { id?: string; abbreviation?: string };
        statistics?: {
          name?: string;
          labels?: string[];
          athletes?: { athlete?: { id?: string; displayName?: string }; stats?: string[] }[];
        }[];
      }[];
    };
    plays?: {
      id?: string;
      text?: string;
      scoringPlay?: boolean;
      awayScore?: number;
      homeScore?: number;
      period?: { displayValue?: string };
      clock?: { displayValue?: string };
      team?: { id?: string };
      strength?: { text?: string; abbreviation?: string };
      participants?: {
        type?: string;
        athlete?: { id?: string; displayName?: string };
      }[];
    }[];
    leaders?: {
      team?: { abbreviation?: string };
      leaders?: {
        displayName?: string;
        leaders?: {
          displayValue?: string;
          athlete?: { id?: string; displayName?: string };
        }[];
      }[];
    }[];
    article?: { headline?: string; description?: string; story?: string };
    pickcenter?: { details?: string; overUnder?: number; spread?: number }[];
    odds?: { details?: string; overUnder?: number }[];
    lastFiveGames?: {
      team?: { id?: string; abbreviation?: string };
      events?: {
        opponent?: { abbreviation?: string; displayName?: string };
        result?: string;
        score?: string;
      }[];
    }[];
    gameInfo?: {
      venue?: { fullName?: string; address?: { city?: string; state?: string } };
    };
    broadcasts?: {
      market?: { type?: string } | string;
      media?: { shortName?: string; name?: string; logo?: string; darkLogo?: string };
      isNational?: boolean;
    }[];
    goalies?: {
      away?: { athlete?: { id?: string; displayName?: string }; starter?: boolean }[];
      home?: { athlete?: { id?: string; displayName?: string }; starter?: boolean }[];
      team?: { homeAway?: string };
    };
  }>(`${ESPN}/summary?event=${encodeURIComponent(eventId)}`);

  const headerEvent: EspnEvent = {
    id: eventId,
    competitions: raw.header?.competitions,
  };
  let base = mapScoreEvent(headerEvent);
  if (!base) throw new Error("NHL game missing competitors");

  // Prefer scoreboard broadcasts; fall back to summary broadcast list.
  if (!base.broadcasts.length && raw.broadcasts?.length) {
    const named = raw.broadcasts.map((b) => {
      const market =
        typeof b.market === "string"
          ? b.market
          : b.market?.type ?? (b.isNational ? "national" : null);
      const name = b.media?.shortName ?? b.media?.name ?? "";
      return { market: market ?? undefined, names: name ? [name] : [] };
    });
    base = {
      ...base,
      broadcasts: parseEspnBroadcasts(
        raw.broadcasts.map((b) => ({
          market: typeof b.market === "object" ? b.market : { type: b.isNational ? "National" : undefined },
          media: b.media,
        })),
        named,
      ),
    };
  }

  const awayTeam = raw.boxscore?.teams?.find((t) => t.homeAway === "away");
  const homeTeam = raw.boxscore?.teams?.find((t) => t.homeAway === "home");
  const awayMap = new Map(
    (awayTeam?.statistics ?? []).map((s) => [s.name ?? s.label ?? "", s.displayValue ?? "—"]),
  );
  const homeMap = new Map(
    (homeTeam?.statistics ?? []).map((s) => [s.name ?? s.label ?? "", s.displayValue ?? "—"]),
  );
  const teamStatKeys: { name: string; label: string }[] = [
    { name: "shotsTotal", label: "Shots" },
    { name: "powerPlayGoals", label: "PP goals" },
    { name: "powerPlayOpportunities", label: "PP chances" },
    { name: "faceoffPercent", label: "Faceoff %" },
    { name: "hits", label: "Hits" },
    { name: "blockedShots", label: "Blocks" },
    { name: "takeaways", label: "Takeaways" },
    { name: "giveaways", label: "Giveaways" },
    { name: "penaltyMinutes", label: "PIM" },
  ];
  const teamStats = teamStatKeys
    .filter((k) => awayMap.has(k.name) || homeMap.has(k.name))
    .map((k) => ({
      label: k.label,
      away: awayMap.get(k.name) ?? "—",
      home: homeMap.get(k.name) ?? "—",
    }));

  const boxGroups: NhlBoxGroup[] = [];
  for (const side of raw.boxscore?.players ?? []) {
    const abbrev = side.team?.abbreviation ?? "—";
    const teamId = String(side.team?.id ?? "");
    for (const group of side.statistics ?? []) {
      const name = (group.name ?? "").toLowerCase();
      if (name !== "forwards" && name !== "defenses" && name !== "goalies") continue;
      const labels = group.labels ?? [];
      const want = name === "goalies" ? GOALIE_COLS : SKATER_COLS;
      const rows = (group.athletes ?? [])
        .map((a) => {
          const id = String(a.athlete?.id ?? "");
          if (!id) return null;
          return {
            id,
            name: a.athlete?.displayName ?? "Player",
            stats: pickCols(labels, a.stats ?? [], want),
          };
        })
        .filter((r): r is NhlBoxRow => Boolean(r));
      if (name !== "goalies") {
        rows.sort(
          (a, b) =>
            statNum(b.stats, "G") +
            statNum(b.stats, "A") -
            (statNum(a.stats, "G") + statNum(a.stats, "A")) ||
            statNum(b.stats, "G") - statNum(a.stats, "G"),
        );
      }
      if (rows.length) {
        boxGroups.push({
          teamAbbrev: abbrev,
          teamId,
          name: name === "defenses" ? "Defense" : name === "goalies" ? "Goalies" : "Forwards",
          rows,
        });
      }
    }
  }

  const scoringPlays: NhlScoringPlay[] = (raw.plays ?? [])
    .filter((p) => p.scoringPlay)
    .map((p) => ({
      id: String(p.id ?? Math.random()),
      text: (p.text ?? "").replace(/\s+/g, " ").trim(),
      period: p.period?.displayValue ?? null,
      clock: p.clock?.displayValue ?? null,
      awayScore: typeof p.awayScore === "number" ? p.awayScore : null,
      homeScore: typeof p.homeScore === "number" ? p.homeScore : null,
      teamId: p.team?.id ?? null,
      strength: p.strength?.text && !/even/i.test(p.strength.text) ? p.strength.text : null,
      athletes: (p.participants ?? [])
        .map((part) => ({
          id: String(part.athlete?.id ?? ""),
          name: part.athlete?.displayName ?? "",
          role: part.type ?? "",
        }))
        .filter((a) => a.id && a.name),
    }));

  const leaders: NhlGameLeader[] = [];
  for (const block of raw.leaders ?? []) {
    const abbrev = block.team?.abbreviation ?? "";
    for (const cat of block.leaders ?? []) {
      if (!/goals|assists|points|saves/i.test(cat.displayName ?? "")) continue;
      const top = cat.leaders?.[0];
      if (!top?.athlete?.id) continue;
      leaders.push({
        category: cat.displayName ?? "Stat",
        teamAbbrev: abbrev,
        id: String(top.athlete.id),
        name: top.athlete.displayName ?? "Player",
        value: top.displayValue ?? "—",
      });
    }
  }

  const pick = raw.pickcenter?.[0] ?? raw.odds?.[0];
  const oddsLine = pick?.details
    ? `${pick.details}${pick.overUnder != null ? ` · O/U ${pick.overUnder}` : ""}`
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
      ? [raw.gameInfo.venue.address.city, raw.gameInfo.venue.address.state].filter(Boolean).join(", ")
      : null,
  ].filter(Boolean);

  const pickStarter = (
    list: { athlete?: { id?: string; displayName?: string }; starter?: boolean }[] | undefined,
  ) => {
    const starter = list?.find((g) => g.starter) ?? list?.[0];
    if (!starter?.athlete?.id) return null;
    return { id: String(starter.athlete.id), name: starter.athlete.displayName ?? "Goalie" };
  };
  const goaliesRaw = raw.goalies;
  let awayGoalie = pickStarter(goaliesRaw?.away);
  let homeGoalie = pickStarter(goaliesRaw?.home);
  // Some payloads nest by team.homeAway instead of away/home keys.
  if (!awayGoalie || !homeGoalie) {
    const asList = Array.isArray(goaliesRaw) ? goaliesRaw : [];
    for (const block of asList as {
      team?: { homeAway?: string };
      athletes?: { athlete?: { id?: string; displayName?: string }; starter?: boolean }[];
    }[]) {
      const starter = pickStarter(block.athletes);
      if (!starter) continue;
      if (block.team?.homeAway === "away") awayGoalie = awayGoalie ?? starter;
      if (block.team?.homeAway === "home") homeGoalie = homeGoalie ?? starter;
    }
  }

  return {
    ...base,
    teamStats,
    boxGroups,
    scoringPlays,
    leaders,
    article: raw.article?.headline
      ? {
          headline: raw.article.headline,
          description: raw.article.description ?? null,
          storyHtml: sanitizeNhlStoryHtml(raw.article.story),
        }
      : null,
    oddsLine,
    lastFive,
    venueDetail: venueBits.length ? venueBits.join(" · ") : null,
    goalieStarters: { away: awayGoalie, home: homeGoalie },
  };
}

export type NhlStatLine = { label: string; value: string };
export type NhlStatCategory = { name: string; stats: NhlStatLine[] };
export type NhlSeasonSplit = { season: string; categories: NhlStatCategory[] };
export type NhlGameLogRow = {
  eventId: string | null;
  date: string | null;
  opponent: string;
  atVs: string | null;
  result: string;
  stats: NhlStatLine[];
};
export type NhlPlayerNews = {
  headline: string;
  description: string;
  image: string | null;
  href: string | null;
};
export type NhlTeamStop = {
  teamId: string | null;
  teamName: string;
  teamLogo: string | null;
  seasons: string | null;
};

export type NhlPlayerProfile = {
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
  /** YYYY-MM-DD */
  birthDate: string | null;
  birthPlace: string | null;
  shoots: string | null;
  experience: string | null;
  experienceYears: number | null;
  draft: string | null;
  status: string | null;
  seasonLabel: string | null;
  seasonStats: NhlStatLine[];
  seasonSplits: NhlSeasonSplit[];
  careerRows: { season: string; teamId: string | null; teamName: string | null; stats: NhlStatLine[] }[];
  careerLabels: string[];
  gameLog: NhlGameLogRow[];
  gameLogLabels: string[];
  teamHistory: NhlTeamStop[];
  news: NhlPlayerNews[];
};

type CareerStatsPayload = {
  teams?: Record<
    string,
    { id?: string; displayName?: string; abbreviation?: string; logos?: { href?: string }[] }
  >;
  categories?: {
    displayName?: string;
    labels?: string[];
    totals?: string[];
    statistics?: {
      teamId?: string;
      season?: { displayName?: string; year?: number };
      stats?: string[];
    }[];
  }[];
};

function linesFrom(labels: string[], values: string[]): NhlStatLine[] {
  return labels.map((label, i) => ({ label, value: values[i] ?? "—" }));
}

function athleteIdFromRef(ref: string | undefined): string | null {
  const m = /athletes\/(\d+)/.exec(ref ?? "");
  return m?.[1] ?? null;
}

export async function fetchNhlPlayerProfile(playerId: string): Promise<NhlPlayerProfile> {
  const id = String(playerId);
  const [athleteRes, overviewRes, careerRes, gameLogRes, coreRes] = await Promise.all([
    getJson<{ athlete?: Record<string, unknown> }>(`${ESPN_WEB}/athletes/${id}`),
    getJson<Record<string, unknown>>(`${ESPN_WEB}/athletes/${id}/overview`).catch(
      () => ({}) as Record<string, unknown>,
    ),
    getJson<CareerStatsPayload>(`${ESPN_WEB}/athletes/${id}/stats`).catch(() => null),
    getJson<Record<string, unknown>>(`${ESPN_WEB}/athletes/${id}/gamelog`).catch(() => null),
    getJson<Record<string, unknown>>(`${CORE}/athletes/${id}?lang=en&region=us`).catch(
      () => ({}) as Record<string, unknown>,
    ),
  ]);

  const a = { ...coreRes, ...(athleteRes.athlete ?? {}) } as Record<string, unknown>;
  const experienceYears = (a.experience as { years?: number } | undefined)?.years;
  const team = (a.team ?? {}) as {
    id?: string;
    displayName?: string;
    abbreviation?: string;
    color?: string;
    logos?: { href?: string }[];
  };
  const position = (a.position ?? {}) as { abbreviation?: string; displayName?: string };
  const handRaw = a.hand as { displayValue?: string; abbreviation?: string } | string | undefined;
  const shoots =
    typeof handRaw === "string"
      ? handRaw
      : (handRaw?.displayValue ?? handRaw?.abbreviation ?? null);
  const statusObj = a.status as { name?: string; type?: string } | undefined;

  const statistics = overviewRes.statistics as
    | {
        displayName?: string;
        labels?: string[];
        splits?: { displayName?: string; stats?: string[] }[];
      }
    | undefined;
  const labels = statistics?.labels ?? [];
  const regular =
    statistics?.splits?.find((s) => /regular/i.test(s.displayName ?? "")) ?? statistics?.splits?.[0];
  const careerSplit = statistics?.splits?.find((s) => /career/i.test(s.displayName ?? ""));
  const seasonLabel = statistics?.displayName?.replace(/\s+General$/i, "") ?? null;
  const seasonStats = regular ? linesFrom(labels, regular.stats ?? []).slice(0, 8) : [];
  const summary = (
    (a.statsSummary as { statistics?: { abbreviation?: string; displayValue?: string }[] } | undefined)
      ?.statistics ?? []
  ).map((s) => ({ label: s.abbreviation ?? "Stat", value: s.displayValue ?? "—" }));
  const keyStats = seasonStats.length ? seasonStats : summary.slice(0, 8);

  const seasonSplits: NhlSeasonSplit[] = [];
  if (regular && labels.length) {
    seasonSplits.push({
      season: seasonLabel ?? regular.displayName ?? "Season",
      categories: [{ name: "Season", stats: linesFrom(labels, regular.stats ?? []) }],
    });
  }
  if (careerSplit && labels.length) {
    seasonSplits.push({
      season: "Career",
      categories: [{ name: "Career", stats: linesFrom(labels, careerSplit.stats ?? []) }],
    });
  }

  const careerCat = careerRes?.categories?.[0];
  const careerLabels = careerCat?.labels ?? [];
  const teamById = new Map<string, { name: string; logo: string | null }>();
  for (const t of Object.values(careerRes?.teams ?? {})) {
    if (!t.id) continue;
    teamById.set(String(t.id), {
      name: t.displayName ?? t.abbreviation ?? "Team",
      logo: t.logos?.[0]?.href ?? (t.abbreviation ? nhlTeamLogo(t.abbreviation) : null),
    });
  }
  const careerRows = (careerCat?.statistics ?? [])
    .map((row) => ({
      season: row.season?.displayName ?? String(row.season?.year ?? "—"),
      teamId: row.teamId ? String(row.teamId) : null,
      teamName: row.teamId ? (teamById.get(String(row.teamId))?.name ?? null) : null,
      stats: linesFrom(careerLabels, row.stats ?? []),
      year: row.season?.year ?? 0,
    }))
    .sort((a, b) => b.year - a.year);

  const teamHistory: NhlTeamStop[] = [];
  const chronological = [...careerRows].sort((a, b) => a.year - b.year);
  for (const row of chronological) {
    const last = teamHistory[teamHistory.length - 1];
    if (last && last.teamId === row.teamId) {
      const start = last.seasons?.split("–")[0]?.trim() ?? row.season;
      last.seasons = start === row.season ? row.season : `${start} – ${row.season}`;
    } else {
      const meta = row.teamId ? teamById.get(row.teamId) : undefined;
      teamHistory.push({
        teamId: row.teamId,
        teamName: row.teamName ?? meta?.name ?? "Team",
        teamLogo: meta?.logo ?? null,
        seasons: row.season,
      });
    }
  }
  teamHistory.reverse();

  const eventMeta = (gameLogRes?.events ?? {}) as Record<
    string,
    {
      gameDate?: string;
      atVs?: string;
      gameResult?: string;
      score?: string;
      opponent?: { abbreviation?: string; displayName?: string };
    }
  >;
  const seasonTypes =
    (gameLogRes?.seasonTypes as {
      displayName?: string;
      categories?: { events?: { eventId?: string; stats?: string[] }[] }[];
    }[]) ?? [];
  const logLabels = (gameLogRes?.labels as string[] | undefined) ?? [];
  const regularType =
    seasonTypes.find((s) => /regular/i.test(s.displayName ?? "")) ?? seasonTypes[0];
  const logEvents = (regularType?.categories ?? []).flatMap((c) => c.events ?? []);
  const gameLog: NhlGameLogRow[] = logEvents.map((ev) => {
    const meta = eventMeta[String(ev.eventId ?? "")] ?? {};
    const result = `${meta.gameResult ?? ""} ${meta.score ?? ""}`.trim() || "—";
    return {
      eventId: ev.eventId != null ? String(ev.eventId) : null,
      date: meta.gameDate ?? null,
      opponent: meta.opponent?.abbreviation ?? meta.opponent?.displayName ?? "—",
      atVs: meta.atVs ?? null,
      result,
      stats: linesFrom(logLabels, ev.stats ?? []),
    };
  });
  if (gameLog.length > 1) {
    const first = Date.parse(gameLog[0]?.date ?? "");
    const last = Date.parse(gameLog[gameLog.length - 1]?.date ?? "");
    if (Number.isFinite(first) && Number.isFinite(last) && first < last) gameLog.reverse();
  }

  const newsRaw = (overviewRes.news ?? []) as {
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
    number: (a.displayJersey as string | undefined)?.replace(/^#/, "") ??
      (a.jersey != null ? String(a.jersey) : null),
    position: position.abbreviation ?? null,
    positionName: position.displayName ?? null,
    teamId: team.id ?? null,
    teamName: team.displayName ?? null,
    teamAbbrev: team.abbreviation ?? null,
    teamColor: team.color ?? null,
    teamLogo: team.logos?.[0]?.href ?? (team.abbreviation ? nhlTeamLogo(team.abbreviation) : null),
    headshot: (a.headshot as { href?: string } | undefined)?.href ?? nhlHeadshot(id),
    height: (a.displayHeight as string | undefined) ?? null,
    weight: (a.displayWeight as string | undefined) ?? null,
    age: typeof a.age === "number" ? a.age : null,
    dob: (a.displayDOB as string | undefined) ?? null,
    birthDate: espnBirthDate(a.dateOfBirth, a.displayDOB),
    birthPlace: espnBirthPlace(a.birthPlace, a.displayBirthPlace),
    shoots,
    experience: (a.displayExperience as string | undefined) ?? null,
    experienceYears: typeof experienceYears === "number" ? experienceYears : null,
    draft: (a.displayDraft as string | undefined) ?? null,
    status: statusObj?.name ?? statusObj?.type ?? null,
    seasonLabel,
    seasonStats: keyStats,
    seasonSplits,
    careerRows,
    careerLabels,
    gameLog,
    gameLogLabels: logLabels,
    teamHistory,
    news,
  };
}

export type NhlRosterPlayer = {
  id: string;
  name: string;
  number: string | null;
  position: string | null;
  group: string;
  headshot: string | null;
};

export type NhlScheduleItem = {
  id: string;
  date: string | null;
  label: string;
  detail: string | null;
  state: "pre" | "in" | "post";
};

export type NhlTeamPage = {
  id: string;
  name: string;
  shortName: string;
  abbrev: string;
  color: string;
  logo: string | null;
  record: string | null;
  standing: string | null;
  seasonLabel: string | null;
  venueName: string | null;
  venueCity: string | null;
  coachName: string | null;
  nextEvent: { id: string; name: string; date: string | null } | null;
  statGroups: { name: string; stats: NhlStatLine[] }[];
  playerTables: { name: string; labels: string[]; rows: { id: string; name: string; stats: string[] }[] }[];
  roster: NhlRosterPlayer[];
  schedule: NhlScheduleItem[];
};

const TEAM_STAT_KEEP: Record<string, string[]> = {
  offensive: ["Goals", "Assists", "Points", "Shots", "G", "A", "PTS", "S"],
  defensive: ["Goals Against Average", "Save Percentage", "Saves", "GAA", "SV%", "SV"],
  general: ["Games Played", "Plus/Minus Rating", "GP", "+/-"],
  penalties: ["Penalty Minutes", "PIM"],
};

export async function fetchNhlTeamPage(teamId: string): Promise<NhlTeamPage> {
  const id = String(teamId);
  const season = nhlSeasonYear();
  type RosterJson = {
    coach?: { firstName?: string; lastName?: string }[];
    athletes?: {
      position?: string;
      items?: {
        id?: string;
        displayName?: string;
        jersey?: string;
        position?: { abbreviation?: string };
        headshot?: { href?: string };
      }[];
    }[];
  };
  type TeamStatsJson = {
    requestedSeason?: { year?: number; displayName?: string };
    results?: {
      stats?: {
        categories?: {
          name?: string;
          displayName?: string;
          stats?: { displayName?: string; displayValue?: string; abbreviation?: string }[];
        }[];
      };
    };
  };
  type LeadersJson = {
    categories?: {
      name?: string;
      abbreviation?: string;
      displayName?: string;
      leaders?: { displayValue?: string; athlete?: { $ref?: string } }[];
    }[];
  };
  const [teamRes, rosterRes, statsRes, leadersRes, scheduleRes] = await Promise.all([
    getJson<{
      team?: {
        id?: string;
        displayName?: string;
        shortDisplayName?: string;
        abbreviation?: string;
        color?: string;
        standingSummary?: string;
        logos?: { href?: string }[];
        record?: { items?: { summary?: string; type?: string }[] };
        franchise?: { venue?: { fullName?: string; address?: { city?: string; state?: string } } };
        nextEvent?: { id?: string; name?: string; date?: string; shortName?: string }[];
      };
    }>(`${ESPN}/teams/${id}`),
    getJson<RosterJson>(`${ESPN}/teams/${id}/roster`).catch((): RosterJson => ({ athletes: [] })),
    getJson<TeamStatsJson>(`${ESPN}/teams/${id}/statistics`).catch((): TeamStatsJson => ({})),
    getJson<LeadersJson>(`${CORE}/seasons/${season}/types/2/teams/${id}/leaders`).catch(async () =>
      getJson<LeadersJson>(`${CORE}/seasons/${season - 1}/types/2/teams/${id}/leaders`).catch(
        (): LeadersJson => ({ categories: [] }),
      ),
    ),
    getJson<{
      events?: {
        id?: string;
        date?: string;
        shortName?: string;
        name?: string;
        competitions?: {
          status?: { type?: { state?: string; shortDetail?: string; completed?: boolean } };
          competitors?: { score?: string; homeAway?: string; team?: { abbreviation?: string } }[];
        }[];
      }[];
    }>(`${ESPN}/teams/${id}/schedule`).catch(() => ({ events: [] })),
  ]);

  const t = teamRes.team ?? {};
  const roster: NhlRosterPlayer[] = [];
  const names = new Map<string, string>();
  for (const group of rosterRes.athletes ?? []) {
    const groupName = group.position || "Roster";
    for (const a of group.items ?? []) {
      const pid = String(a.id ?? "");
      if (!pid) continue;
      names.set(pid, a.displayName ?? "Player");
      roster.push({
        id: pid,
        name: a.displayName ?? "Player",
        number: a.jersey ?? null,
        position: a.position?.abbreviation ?? null,
        group: groupName,
        headshot: a.headshot?.href ?? nhlHeadshot(pid),
      });
    }
  }
  const coach = rosterRes.coach?.[0];
  const coachName = coach ? [coach.firstName, coach.lastName].filter(Boolean).join(" ") : null;
  const venue = t.franchise?.venue;
  const venueCity = [venue?.address?.city, venue?.address?.state].filter(Boolean).join(", ") || null;
  const next = t.nextEvent?.[0];
  const record =
    t.record?.items?.find((r) => r.type === "total")?.summary ?? t.record?.items?.[0]?.summary ?? null;

  const statGroups: NhlTeamPage["statGroups"] = [];
  const seasonLabel = statsRes.requestedSeason?.displayName ?? null;
  for (const cat of statsRes.results?.stats?.categories ?? []) {
    const keep = TEAM_STAT_KEEP[cat.name ?? ""] ?? [];
    const stats = (cat.stats ?? [])
      .filter((s) => !keep.length || keep.includes(s.displayName ?? "") || keep.includes(s.abbreviation ?? ""))
      .slice(0, 6)
      .map((s) => ({
        label: s.abbreviation || s.displayName || "Stat",
        value: s.displayValue ?? "—",
      }))
      .filter((s) => s.value && s.value !== "0:00");
    if (stats.length) statGroups.push({ name: cat.displayName ?? cat.name ?? "Stats", stats });
  }

  const byAthlete = new Map<string, { id: string; values: Record<string, string> }>();
  const fillLeaders = (payload: LeadersJson) => {
    byAthlete.clear();
    for (const cat of payload.categories ?? []) {
      const key = cat.abbreviation || cat.name || "";
      if (!key) continue;
      for (const leader of (cat.leaders ?? []).slice(0, 18)) {
        const aid = athleteIdFromRef(leader.athlete?.$ref);
        if (!aid) continue;
        const row = byAthlete.get(aid) ?? { id: aid, values: {} };
        row.values[key] = leader.displayValue ?? "—";
        byAthlete.set(aid, row);
      }
    }
  };
  fillLeaders(leadersRes);
  if (![...byAthlete.values()].some((r) => r.values.PTS && r.values.PTS !== "0")) {
    const prior = await getJson<LeadersJson>(
      `${CORE}/seasons/${season - 1}/types/2/teams/${id}/leaders`,
    ).catch(() => null);
    if (prior) fillLeaders(prior);
  }
  const missing = [...byAthlete.keys()].filter((pid) => !names.has(pid)).slice(0, 16);
  await Promise.all(
    missing.map(async (pid) => {
      try {
        const body = await getJson<{ athlete?: { displayName?: string } }>(`${ESPN_WEB}/athletes/${pid}`);
        if (body.athlete?.displayName) names.set(pid, body.athlete.displayName);
      } catch {
        /* name stays unresolved */
      }
    }),
  );

  const skaterRows = [...byAthlete.values()]
    .filter((r) => r.values.PTS || r.values.G || r.values.A)
    .sort((a, b) => Number(b.values.PTS ?? 0) - Number(a.values.PTS ?? 0))
    .slice(0, 15)
    .map((r) => ({
      id: r.id,
      name: names.get(r.id) ?? "Player",
      stats: [r.values.G ?? "—", r.values.A ?? "—", r.values.PTS ?? "—", r.values["+/-"] ?? "—", r.values.PIM ?? "—"],
    }));
  const goalieRows = [...byAthlete.values()]
    .filter((r) => r.values.GAA || r.values["SV%"] || r.values.W)
    .sort((a, b) => Number(a.values.GAA ?? 99) - Number(b.values.GAA ?? 99))
    .slice(0, 4)
    .map((r) => ({
      id: r.id,
      name: names.get(r.id) ?? "Goalie",
      stats: [r.values.W ?? "—", r.values.GAA ?? "—", r.values["SV%"] ?? "—", r.values.SO ?? "—"],
    }));
  const playerTables: NhlTeamPage["playerTables"] = [];
  if (skaterRows.length) {
    playerTables.push({ name: "Skaters", labels: ["G", "A", "PTS", "+/-", "PIM"], rows: skaterRows });
  }
  if (goalieRows.length) {
    playerTables.push({ name: "Goalies", labels: ["W", "GAA", "SV%", "SO"], rows: goalieRows });
  }

  const schedule: NhlScheduleItem[] = (scheduleRes.events ?? []).map((ev) => {
    const comp = ev.competitions?.[0];
    const stateRaw = comp?.status?.type?.state;
    const state: NhlScheduleItem["state"] =
      stateRaw === "in" ? "in" : stateRaw === "post" || comp?.status?.type?.completed ? "post" : "pre";
    const bits = (comp?.competitors ?? []).map((c) => {
      const ab = c.team?.abbreviation ?? "";
      const score = c.score != null && state !== "pre" ? c.score : "";
      return score ? `${ab} ${score}` : ab;
    });
    return {
      id: String(ev.id ?? ""),
      date: ev.date ?? null,
      label: ev.shortName || ev.name || bits.join(" · ") || "Game",
      detail: comp?.status?.type?.shortDetail ?? null,
      state,
    };
  });

  return {
    id,
    name: t.displayName ?? "NHL team",
    shortName: t.shortDisplayName ?? t.abbreviation ?? "NHL",
    abbrev: t.abbreviation ?? "NHL",
    color: (t.color ?? "002f87").replace(/^#/, ""),
    logo: t.logos?.[0]?.href ?? (t.abbreviation ? nhlTeamLogo(t.abbreviation) : null),
    record,
    standing: t.standingSummary ?? null,
    seasonLabel,
    venueName: venue?.fullName ?? null,
    venueCity,
    coachName,
    nextEvent: next?.id
      ? { id: String(next.id), name: next.shortName || next.name || "Next game", date: next.date ?? null }
      : null,
    statGroups,
    playerTables,
    roster,
    schedule,
  };
}
