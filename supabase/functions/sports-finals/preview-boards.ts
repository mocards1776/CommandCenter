/**
 * Evening-preview boards. ESPN + MLB Stats API only — not the Times
 * newspaper-watch fetchers (those stay Times-owned).
 *
 * MLB uses statsapi so team ids are MLB ids (Cardinals = 138). Other
 * leagues use ESPN ids, matching rankRuwtNfl/Nhl/Cfb/Soccer.
 */
import {
  applyCfbInterestFloors,
  rankRuwtCfbGames,
  rankRuwtGames,
  rankRuwtNflGames,
  rankRuwtNhlGames,
  rankRuwtSoccerGames,
  type CfbScoreGame,
  type MlbScoreGame,
  type NflScoreGame,
  type NhlScoreGame,
  type SoccerScoreGame,
} from "./ruwt-rank.ts";
import { fetchSummary } from "./card.ts";
import {
  DEFAULT_PREVIEW_INTEREST,
  decoratePreviewGame,
  lastName,
  nextChicagoYmd,
  previewGamePath,
  type PreviewGame,
  type PreviewLeague,
  type PreviewSide,
  type PreviewSport,
} from "./preview-slate.ts";

const MLB = "https://statsapi.mlb.com/api/v1";

const MLB_ESPN_ID: Record<number, string> = {
  108: "3", 109: "29", 110: "1", 111: "2", 112: "16", 113: "17", 114: "5",
  115: "27", 116: "6", 117: "18", 118: "7", 119: "19", 120: "20", 121: "21",
  133: "11", 134: "23", 135: "25", 136: "12", 137: "26", 138: "24", 139: "30",
  140: "13", 141: "14", 142: "9", 143: "22", 144: "15", 145: "4", 146: "28",
  147: "10", 158: "8",
};

const RIVALRIES: Record<string, string> = {
  "150-153": "Victory Bell",
  "152-153": "Rivalry",
  "153-258": "South's Oldest",
  "2-333": "Iron Bowl",
  "130-194": "The Game",
  "201-251": "Red River",
  "57-61": "Florida–Georgia",
  "30-87": "Rivalry",
  "349-2426": "Army–Navy",
  "145-344": "Egg Bowl",
  "99-245": "Rivalry",
  "127-130": "Rivalry",
  "194-213": "Rivalry",
  "135-275": "Paul Bunyan's Axe",
  "66-2294": "Cy-Hawk",
  "2305-2306": "Sunflower",
  "239-2628": "Revivalry",
  "2483-264": "Rivalry",
  "52-2390": "Rivalry",
  "59-228": "Rivalry",
  "258-259": "Commonwealth Cup",
  "96-97": "Governor's Cup",
  "221-277": "Backyard Brawl",
  "8-99": "Golden Boot",
  "8-142": "Battle Line",
  "228-2579": "Palmetto Bowl",
  "333-2633": "Third Saturday",
  "61-2633": "Rivalry",
  "57-2633": "Rivalry",
  "52-57": "Rivalry",
  "245-251": "Lone Star",
  "150-152": "Rivalry",
  "24-25": "Rivalry",
  "26-25": "Rivalry",
  "84-2509": "Old Oaken Bucket",
  "356-77": "Rivalry",
  "158-275": "Freedom Trophy",
  "142-96": "Rivalry",
  "333-99": "Rivalry",
  "61-57": "Florida–Georgia",
};

type RawTeam = {
  id?: string | number;
  abbreviation?: string;
  displayName?: string;
  shortDisplayName?: string;
  color?: string;
  logo?: string;
  logos?: { href?: string }[];
};

type RawProbable = {
  displayName?: string;
  athlete?: { displayName?: string; shortName?: string; lastName?: string };
  starter?: boolean;
};

type RawCompetitor = {
  homeAway?: string;
  score?: string | number;
  curatedRank?: { current?: number };
  records?: { type?: string; name?: string; summary?: string }[];
  team?: RawTeam;
  probables?: RawProbable[];
};

type RawBroadcast = {
  names?: string[];
  media?: { shortName?: string; name?: string };
};

type RawStatus = {
  period?: number;
  type?: {
    state?: string;
    completed?: boolean;
    shortDetail?: string;
    detail?: string;
  };
};

type RawOdds = {
  details?: string;
  spread?: number | { displayValue?: string };
  overUnder?: number;
};

type RawEvent = {
  id?: string | number;
  date?: string;
  status?: RawStatus;
  competitions?: {
    id?: string | number;
    date?: string;
    status?: RawStatus;
    venue?: { fullName?: string };
    competitors?: RawCompetitor[];
    geoBroadcasts?: RawBroadcast[];
    broadcasts?: RawBroadcast[];
    odds?: RawOdds[];
    series?: { summary?: string | null };
    notes?: { headline?: string | null }[];
  }[];
};

export type BoardRow = {
  sport: PreviewSport;
  league: PreviewLeague;
  competition: string | null;
  id: string;
  live: boolean;
  final: boolean;
  startIso: string | null;
  tv: string[];
  seriesLine: string | null;
  path: string;
  away: PreviewSide;
  home: PreviewSide;
  mlb?: MlbScoreGame;
  nfl?: NflScoreGame;
  nhl?: NhlScoreGame;
  cfb?: CfbScoreGame;
  soccer?: SoccerScoreGame;
  goalieAway: string | null;
  goalieHome: string | null;
  oddsLine: string | null;
};

function pollRank(raw: number | undefined): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 1 || raw > 25) return null;
  return raw;
}

function broadcastNames(rows: RawBroadcast[] | undefined): string[] {
  const out: string[] = [];
  const push = (name: string | undefined) => {
    const label = (name ?? "").replace(/\s+/g, " ").trim();
    if (!label || label.length > 40) return;
    if (out.some((have) => have.toLowerCase() === label.toLowerCase())) return;
    out.push(label);
  };
  for (const row of rows ?? []) {
    push(row.media?.shortName || row.media?.name);
    for (const name of row.names ?? []) push(name);
  }
  return out.slice(0, 4);
}

function espnLogo(sport: string, id: string, raw?: RawTeam): string | null {
  const href = raw?.logos?.[0]?.href || raw?.logo;
  if (href && /^https?:/i.test(href) && !/\.svg(\?|$)/i.test(href)) return href;
  if (!id) return null;
  const folder = sport === "cfb" ? "ncaa" : sport;
  return `https://a.espncdn.com/i/teamlogos/${folder}/500/${id}.png`;
}

function probableFromCompetitor(c: RawCompetitor | undefined): string | null {
  const row = c?.probables?.[0];
  return lastName(row?.athlete?.shortName || row?.athlete?.lastName || row?.athlete?.displayName || row?.displayName);
}

function shortOddsLine(raw: RawOdds[] | undefined): string | null {
  const row = raw?.[0];
  if (!row) return null;
  const details = (row.details ?? "").replace(/\s+/g, " ").trim();
  if (details && details.length <= 16 && !/^even$/i.test(details)) return details;
  return null;
}

function mlbLogo(teamId: number): string | null {
  const espn = MLB_ESPN_ID[teamId];
  if (!espn) return `https://a.espncdn.com/i/teamlogos/mlb/500/${teamId}.png`;
  return `https://a.espncdn.com/i/teamlogos/mlb/500/${espn}.png`;
}

function rivalryName(a: string | number, b: string | number): string | null {
  const left = Number(a);
  const right = Number(b);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
  const key = left < right ? `${left}-${right}` : `${right}-${left}`;
  return RIVALRIES[key] ?? null;
}

function sideFromCompetitor(c: RawCompetitor | undefined, sport: string): PreviewSide | null {
  const team = c?.team;
  const id = team?.id != null ? String(team.id) : "";
  if (!id) return null;
  const record =
    c?.records?.find((r) => r.type === "total" || r.name === "overall")?.summary ??
    c?.records?.[0]?.summary ??
    null;
  return {
    teamId: id,
    name: team?.shortDisplayName || team?.displayName || team?.abbreviation || "Team",
    abbrev: team?.abbreviation || "—",
    logo: espnLogo(sport, id, team),
    record,
    rank: pollRank(c?.curatedRank?.current),
    color: team?.color ? `#${String(team.color).replace(/^#/, "")}` : null,
  };
}

function cfbOdds(raw: RawOdds[] | undefined, homeId: number): CfbScoreGame["odds"] {
  const row = raw?.[0];
  if (!row) return null;
  const spreadRaw = row.spread;
  const spread =
    typeof spreadRaw === "number"
      ? spreadRaw
      : spreadRaw?.displayValue != null
        ? Number(spreadRaw.displayValue)
        : null;
  const details = row.details ?? null;
  const favoriteTeamId =
    spread != null && Number.isFinite(spread) && spread !== 0 ? (spread < 0 ? homeId : null) : null;
  return {
    details,
    spread: spread != null && Number.isFinite(spread) ? spread : null,
    favoriteTeamId,
  };
}

const ESPN_HOSTS = [
  "https://site.web.api.espn.com/apis/site/v2/sports",
  "https://site.api.espn.com/apis/site/v2/sports",
];

async function espnBoard(path: string, dates?: string): Promise<RawEvent[]> {
  const qs = dates ? `?dates=${dates}` : "";
  const headers = { Accept: "application/json", "User-Agent": "CommandCenterSportsFinals" };
  for (const host of ESPN_HOSTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch(`${host}/${path}/scoreboard${qs}`, {
        headers,
        signal: controller.signal,
      });
      if (!res.ok) continue;
      const raw = (await res.json()) as { events?: RawEvent[] };
      return raw.events ?? [];
    } catch {
      /* next host */
    } finally {
      clearTimeout(timer);
    }
  }
  return [];
}

function mapEspn(
  sport: PreviewSport,
  league: PreviewLeague,
  event: RawEvent,
  competition: string | null,
): BoardRow | null {
  const comp = event.competitions?.[0];
  if (!comp) return null;
  const status = comp.status?.type ?? event.status?.type;
  const state = status?.state ?? "";
  const away = sideFromCompetitor((comp.competitors ?? []).find((c) => c.homeAway === "away"), sport);
  const home = sideFromCompetitor((comp.competitors ?? []).find((c) => c.homeAway === "home"), sport);
  const id = String(event.id ?? comp.id ?? "");
  if (!id || !away || !home) return null;
  const live = state === "in";
  const final = state === "post" || status?.completed === true;
  const startIso = event.date || comp.date || null;
  const tv = broadcastNames([...(comp.geoBroadcasts ?? []), ...(comp.broadcasts ?? [])]);
  const seriesLine = comp.series?.summary?.trim() || comp.notes?.[0]?.headline?.trim() || null;
  const detail = (status?.shortDetail || status?.detail || "").trim();
  const scoreNum = (raw: string | number | undefined) => {
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  const awayScore = scoreNum((comp.competitors ?? []).find((c) => c.homeAway === "away")?.score);
  const homeScore = scoreNum((comp.competitors ?? []).find((c) => c.homeAway === "home")?.score);

  const row: BoardRow = {
    sport,
    league,
    competition,
    id,
    live,
    final,
    startIso,
    tv,
    seriesLine,
    path: previewGamePath(sport, id),
    away,
    home,
    goalieAway: sport === "nhl" ? probableFromCompetitor((comp.competitors ?? []).find((c) => c.homeAway === "away")) : null,
    goalieHome: sport === "nhl" ? probableFromCompetitor((comp.competitors ?? []).find((c) => c.homeAway === "home")) : null,
    oddsLine: sport === "nfl" || sport === "cfb" ? shortOddsLine(comp.odds) : null,
  };

  if (sport === "nfl") {
    row.nfl = {
      id,
      live,
      final,
      shortDetail: detail,
      status: detail,
      homeWinPct: null,
      away: { teamId: away.teamId, abbrev: away.abbrev, score: awayScore },
      home: { teamId: home.teamId, abbrev: home.abbrev, score: homeScore },
      situation: null,
    };
  } else if (sport === "nhl") {
    row.nhl = {
      id,
      live,
      final,
      shortDetail: detail,
      status: detail,
      away: { teamId: away.teamId, abbrev: away.abbrev, score: awayScore },
      home: { teamId: home.teamId, abbrev: home.abbrev, score: homeScore },
    };
  } else if (sport === "cfb") {
    const homeId = Number(home.teamId);
    row.cfb = {
      id,
      live,
      final,
      status: detail,
      shortDetail: detail,
      period: typeof comp.status?.period === "number" ? comp.status.period : null,
      broadcasts: tv.map((name) => ({ name })),
      away: {
        teamId: Number(away.teamId),
        abbrev: away.abbrev,
        score: awayScore,
        record: away.record,
        rank: away.rank ?? null,
        fpiRank: null,
      },
      home: {
        teamId: homeId,
        abbrev: home.abbrev,
        score: homeScore,
        record: home.record,
        rank: home.rank ?? null,
        fpiRank: null,
      },
      situation: null,
      odds: cfbOdds(comp.odds, homeId),
    };
  } else if (sport === "soccer") {
    row.soccer = {
      id,
      live,
      final,
      pregame: !live && !final,
      leagueSlug: competition === "Premier League" ? "eng.1" : "eng.2",
      away: { teamId: away.teamId, abbrev: away.abbrev, score: awayScore == null ? null : String(awayScore) },
      home: { teamId: home.teamId, abbrev: home.abbrev, score: homeScore == null ? null : String(homeScore) },
    };
  }
  return row;
}

async function fetchMlbDay(day: string): Promise<BoardRow[]> {
  const url = `${MLB}/schedule?sportId=1&date=${encodeURIComponent(day)}&hydrate=linescore,team,probablePitcher,venue,broadcasts(all),seriesStatus`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "CommandCenterSportsFinalsPreview" },
    });
    if (!res.ok) return [];
    const raw = (await res.json()) as {
      dates?: {
        games?: {
          gamePk?: number;
          gameDate?: string;
          officialDate?: string;
          gameType?: string;
          seriesGameNumber?: number;
          seriesStatus?: { shortDescription?: string | null; gameNumber?: number | null };
          status?: { detailedState?: string; abstractGameState?: string };
          broadcasts?: { type?: string; name?: string; callSign?: string; language?: string; isNational?: boolean }[];
          linescore?: { teams?: { away?: { runs?: number }; home?: { runs?: number } } };
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
    return games
      .map((g): BoardRow | null => {
        const abstract = g.status?.abstractGameState ?? "";
        const live = abstract === "Live";
        const final = abstract === "Final";
        const side = (s: NonNullable<typeof g.teams>["away"], runs: number | undefined) => {
          const teamId = s?.team?.id ?? 0;
          const record =
            s?.leagueRecord?.wins != null ? `${s.leagueRecord.wins}-${s.leagueRecord.losses ?? 0}` : null;
          return {
            teamId,
            name: s?.team?.teamName || s?.team?.name || "—",
            abbrev: s?.team?.abbreviation || "—",
            score: runs ?? s?.score ?? null,
            record,
            probablePitcher: s?.probablePitcher?.fullName ?? null,
            probablePitcherId: s?.probablePitcher?.id ?? null,
          };
        };
        const away = side(g.teams?.away, g.linescore?.teams?.away?.runs);
        const home = side(g.teams?.home, g.linescore?.teams?.home?.runs);
        const id = String(g.gamePk ?? "");
        if (!id || !away.teamId || !home.teamId) return null;
        const tv = (g.broadcasts ?? [])
          .filter((b) => /^TV$/i.test(b.type ?? "") && (!b.language || /^en/i.test(b.language)))
          .map((b) => (b.name || b.callSign || "").trim())
          .filter(Boolean);
        if (!tv.some((n) => /mlb\.?\s*tv/i.test(n))) tv.unshift("MLB.TV");
        const gameNum = g.seriesStatus?.gameNumber ?? g.seriesGameNumber;
        const playoff = /[FDLW]/.test(g.gameType ?? "");
        const seriesLine =
          g.seriesStatus?.shortDescription?.trim() ||
          (playoff && gameNum ? `Playoff Gm ${gameNum}` : null);
        const mlb: MlbScoreGame = {
          id,
          live,
          final,
          inning: null,
          officialDate: g.officialDate ?? day,
          away,
          home,
          situation: null,
        };
        return {
          sport: "mlb",
          league: "MLB",
          competition: null,
          id,
          live,
          final,
          startIso: g.gameDate ?? null,
          tv,
          seriesLine,
          path: previewGamePath("mlb", id),
          away: {
            teamId: String(away.teamId),
            name: away.name,
            abbrev: away.abbrev,
            logo: mlbLogo(away.teamId),
            record: away.record,
            color: away.teamId === 138 ? "#be0a14" : null,
          },
          home: {
            teamId: String(home.teamId),
            name: home.name,
            abbrev: home.abbrev,
            logo: mlbLogo(home.teamId),
            record: home.record,
          },
          mlb,
          goalieAway: null,
          goalieHome: null,
          oddsLine: null,
        };
      })
      .filter((row): row is BoardRow => row != null);
  } catch {
    return [];
  }
}

async function boardOrEmpty(label: string, task: Promise<BoardRow[]>): Promise<BoardRow[]> {
  try {
    return await task;
  } catch (err) {
    console.warn(`evening preview ${label} board failed`, err);
    return [];
  }
}

export async function fetchPreviewBoards(now = new Date()): Promise<BoardRow[]> {
  const today = now.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const tomorrow = nextChicagoYmd(today);
  const todayYmd = today.replace(/-/g, "");
  const tomorrowYmd = tomorrow.replace(/-/g, "");

  const mapDays = (sport: PreviewSport, league: PreviewLeague, path: string, competition: string | null) =>
    Promise.all([espnBoard(path, todayYmd), espnBoard(path, tomorrowYmd)]).then((chunks) =>
      chunks.flat().map((event) => mapEspn(sport, league, event, competition)).filter((row): row is BoardRow => row != null),
    );

  const [mlb, nfl, nhl, cfb, pl, champ] = await Promise.all([
    boardOrEmpty("MLB", Promise.all([fetchMlbDay(today), fetchMlbDay(tomorrow)]).then((rows) => rows.flat())),
    boardOrEmpty(
      "NFL",
      espnBoard("football/nfl").then((events) =>
        events.map((event) => mapEspn("nfl", "NFL", event, null)).filter((row): row is BoardRow => row != null),
      ),
    ),
    boardOrEmpty("NHL", mapDays("nhl", "NHL", "hockey/nhl", null)),
    boardOrEmpty(
      "CFB",
      espnBoard("football/college-football").then((events) =>
        events.map((event) => mapEspn("cfb", "CFB", event, null)).filter((row): row is BoardRow => row != null),
      ),
    ),
    boardOrEmpty("PL", mapDays("soccer", "Soccer", "soccer/eng.1", "Premier League")),
    boardOrEmpty("EFL", mapDays("soccer", "Soccer", "soccer/eng.2", "Championship")),
  ]);

  const seen = new Set<string>();
  const out: BoardRow[] = [];
  for (const row of [...mlb, ...nfl, ...nhl, ...cfb, ...pl, ...champ]) {
    const key = `${row.sport}:${row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

export function rankPreviewBoards(rows: BoardRow[]): PreviewGame[] {
  const interest = {
    mlb: DEFAULT_PREVIEW_INTEREST.mlb,
    nfl: DEFAULT_PREVIEW_INTEREST.nfl,
    nhl: DEFAULT_PREVIEW_INTEREST.nhl,
    cfb: applyCfbInterestFloors(DEFAULT_PREVIEW_INTEREST.cfb),
    soccer: DEFAULT_PREVIEW_INTEREST.soccer,
  };

  const mlb = rows.filter((r) => r.mlb);
  const nfl = rows.filter((r) => r.nfl);
  const nhl = rows.filter((r) => r.nhl);
  const cfb = rows.filter((r) => r.cfb);
  const soccer = rows.filter((r) => r.soccer);

  const byKey = new Map(rows.map((r) => [`${r.sport}:${r.id}`, r]));
  const out: PreviewGame[] = [];

  const push = (
    sport: PreviewSport,
    scored: { id: string; score: number; reasons: string[] },
    extraReasons: string[] = [],
  ) => {
    const row = byKey.get(`${sport}:${scored.id}`);
    if (!row) return;
    const reasons = [...extraReasons, ...scored.reasons].filter(Boolean);
    out.push(
      decoratePreviewGame({
        id: `${sport}-${row.id}`,
        sport,
        league: row.league,
        competition: row.competition,
        away: row.away,
        home: row.home,
        startIso: row.startIso,
        live: row.live,
        final: row.final,
        heat: scored.score,
        reasons,
        tv: row.tv,
        seriesLine: row.seriesLine,
        path: row.path,
        probableAway: lastName(row.mlb?.away.probablePitcher) ?? row.goalieAway,
        probableHome: lastName(row.mlb?.home.probablePitcher) ?? row.goalieHome,
        oddsLine: row.oddsLine,
      }),
    );
  };

  for (const g of rankRuwtGames(
    mlb.map((r) => r.mlb!),
    { teamInterest: interest.mlb, watchPlayerIds: new Set(), watchManagerIds: new Set() },
    30,
  )) {
    push("mlb", g);
  }
  for (const g of rankRuwtNflGames(nfl.map((r) => r.nfl!), interest.nfl, 24)) {
    push("nfl", g);
  }
  for (const g of rankRuwtNhlGames(nhl.map((r) => r.nhl!), interest.nhl, 24)) {
    const row = byKey.get(`nhl:${g.id}`);
    push("nhl", g, row?.seriesLine ? [row.seriesLine] : []);
  }
  for (const g of rankRuwtCfbGames(cfb.map((r) => r.cfb!), interest.cfb, 24)) {
    const row = byKey.get(`cfb:${g.id}`);
    const rivalry = row ? rivalryName(row.away.teamId, row.home.teamId) : null;
    push("cfb", g, rivalry ? [rivalry] : []);
  }
  for (const g of rankRuwtSoccerGames(soccer.map((r) => r.soccer!), interest.soccer, 24)) {
    push("soccer", g);
  }
  return out;
}

function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function athleteLastName(row: unknown): string | null {
  const item = rec(row);
  const athlete = rec(item.athlete);
  return lastName(
    (typeof athlete.shortName === "string" && athlete.shortName) ||
      (typeof athlete.lastName === "string" && athlete.lastName) ||
      (typeof athlete.displayName === "string" && athlete.displayName) ||
      (typeof item.displayName === "string" && item.displayName) ||
      null,
  );
}

function pickStarterName(list: unknown): string | null {
  const rows = arr(list);
  const starter = rows.find((row) => rec(row).starter === true) ?? rows[0];
  return athleteLastName(starter);
}

export function goaliesFromSummary(raw: unknown): { away: string | null; home: string | null } {
  const body = rec(raw);
  const goalies = rec(body.goalies);
  let away = pickStarterName(goalies.away);
  let home = pickStarterName(goalies.home);
  if (!away || !home) {
    for (const block of arr(body.goalies)) {
      const row = rec(block);
      const side = rec(row.team).homeAway;
      const name = pickStarterName(row.athletes) ?? athleteLastName(row);
      if (side === "away") away = away ?? name;
      if (side === "home") home = home ?? name;
    }
  }
  if (!away || !home) {
    const comps = arr(rec(arr(rec(body.header).competitions)[0]).competitors);
    for (const c of comps) {
      const row = rec(c);
      const name = pickStarterName(row.probables);
      if (row.homeAway === "away") away = away ?? name;
      if (row.homeAway === "home") home = home ?? name;
    }
  }
  return { away, home };
}

function previewEventId(game: PreviewGame): string {
  const prefix = `${game.sport}-`;
  return game.id.startsWith(prefix) ? game.id.slice(prefix.length) : game.id;
}

/** Scoreboard rarely lists NHL starters. Pull them from the summary for the picked slate only. */
export async function hydratePreviewStarters(games: PreviewGame[]): Promise<void> {
  await Promise.all(
    games.map(async (game) => {
      if (game.sport !== "nhl") return;
      if (game.probableAway && game.probableHome) return;
      try {
        const starters = goaliesFromSummary(await fetchSummary("nhl", previewEventId(game)));
        game.probableAway = game.probableAway ?? starters.away;
        game.probableHome = game.probableHome ?? starters.home;
      } catch {
        /* omit — records still fill the row */
      }
    }),
  );
}
