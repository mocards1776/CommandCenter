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
  birthPlace: string | null;
  mlbDebut: string | null;
  draftYear: number | null;
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
};

function currentSeason(): number {
  return new Date().getFullYear();
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
  innings: { num: number; away: number | null; home: number | null }[];
  away: MlbBoxscoreSide;
  home: MlbBoxscoreSide;
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
        datetime?: { dateTime?: string };
        venue?: { name?: string };
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
  return {
    gamePk: Number(pk),
    status: live?.gameData?.status?.detailedState ?? "Final",
    when: fmtWhen(live?.gameData?.datetime?.dateTime),
    venue: live?.gameData?.venue?.name ?? null,
    innings: (ls?.innings ?? []).map((i) => ({
      num: i.num ?? 0,
      away: i.away?.runs ?? null,
      home: i.home?.runs ?? null,
    })),
    away: mapBoxSide(box.teams?.away, live?.gameData?.teams?.away, ls?.teams?.away),
    home: mapBoxSide(box.teams?.home, live?.gameData?.teams?.home, ls?.teams?.home),
  };
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

export async function fetchMlbPlayerTransactions(playerId: number): Promise<MlbTransaction[]> {
  const season = currentSeason();
  const raw = (await mlbGet("transactions", {
    playerId: String(playerId),
    startDate: `01/01/${season - 12}`,
    endDate: `12/31/${season}`,
  })) as {
    transactions?: {
      date?: string;
      typeDesc?: string;
      typeCode?: string;
      description?: string;
    }[];
  };
  const interesting = /Drafted|Traded|Signed|Claimed|Selected|Purchase|Free Agent|Rule 5|Waivers/i;
  return (raw.transactions ?? [])
    .filter((t) => interesting.test(`${t.typeDesc ?? ""} ${t.description ?? ""}`))
    .map((t) => ({
      date: t.date ?? "",
      type: t.typeDesc || t.typeCode || "Transaction",
      description: t.description ?? "",
    }));
}

export async function fetchPlayerContract(playerName: string): Promise<MlbPlayerContract | null> {
  try {
    const { data, error } = await supabase.functions.invoke("sports", {
      body: { action: "bbref", name: playerName },
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
    };
    return {
      contractStatus: d.contractStatus ?? null,
      currentSalary: d.currentSalary ?? null,
      salaryHistory: d.salaryHistory ?? [],
      acquisition: d.acquisition ?? [],
      url: d.url ?? null,
      source: d.source ?? "baseball-reference",
    };
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
      birthCity?: string;
      birthStateProvince?: string;
      birthCountry?: string;
      mlbDebutDate?: string;
      draftYear?: number;
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
  const school = college?.name
    ? college.name
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
    birthPlace: place || null,
    mlbDebut: p.mlbDebutDate ?? null,
    draftYear: p.draftYear ?? null,
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
