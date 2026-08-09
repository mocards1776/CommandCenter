/** MLB Stats API helpers — scoreboard, standings, leaders, player cards. */

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
};

export type MlbScoreSide = {
  teamId: number;
  name: string;
  abbrev: string;
  score: number | null;
  record: string | null;
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
  teamId: number | null;
  teamName: string | null;
  teamAbbrev: string | null;
  primaryColor: string | null;
  headshot: string;
  actionShot: string;
  hitting: MlbPlayerStatLine[];
  pitching: MlbPlayerStatLine[];
  season: number;
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

export function mlbActionShot(playerId: number | string): string {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:action:hero:current.jpg/r_max,c_fill,g_auto,w_800,h_1000,q_auto:best/v1/people/${playerId}/action/hero/current`;
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
    hydrate: "linescore,team",
  })) as {
    dates?: {
      games?: {
        gamePk?: number;
        gameDate?: string;
        status?: { detailedState?: string; abstractGameState?: string };
        linescore?: { currentInningOrdinal?: string; inningState?: string };
        teams?: {
          away?: {
            score?: number;
            team?: { id?: number; name?: string; abbreviation?: string; teamName?: string };
            leagueRecord?: { wins?: number; losses?: number };
          };
          home?: {
            score?: number;
            team?: { id?: number; name?: string; abbreviation?: string; teamName?: string };
            leagueRecord?: { wins?: number; losses?: number };
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
    ): MlbScoreSide => ({
      teamId: s?.team?.id ?? 0,
      name: s?.team?.name ?? "—",
      abbrev: teamAbbrev(s?.team),
      score: s?.score ?? null,
      record:
        s?.leagueRecord?.wins != null
          ? `${s.leagueRecord.wins}-${s.leagueRecord.losses ?? 0}`
          : null,
    });
    return {
      id: String(g.gamePk ?? g.gameDate),
      status: g.status?.detailedState ?? abstract,
      abstractState: abstract,
      live,
      final,
      inning: inn,
      away: side(g.teams?.away),
      home: side(g.teams?.home),
      when: fmtWhen(g.gameDate),
    };
  });
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

export async function fetchMlbPlayer(playerId: number | string): Promise<MlbPlayerCard> {
  const season = currentSeason();
  const id = Number(playerId);
  const raw = (await mlbGet(`people/${id}`, {
    hydrate: `currentTeam,stats(group=[hitting,pitching],type=[season],season=${season})`,
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
      currentTeam?: { id?: number; name?: string; abbreviation?: string };
      stats?: {
        group?: { displayName?: string };
        splits?: { stat?: Record<string, unknown> }[];
      }[];
    }[];
  };

  const p = raw.people?.[0];
  if (!p) throw new Error("Player not found");

  let hitting: MlbPlayerStatLine[] = [];
  let pitching: MlbPlayerStatLine[] = [];
  for (const s of p.stats ?? []) {
    const group = (s.group?.displayName ?? "").toLowerCase();
    const stat = s.splits?.[0]?.stat;
    if (group.includes("hitting")) {
      hitting = pickStats(stat, [
        ["avg", "AVG"],
        ["homeRuns", "HR"],
        ["rbi", "RBI"],
        ["ops", "OPS"],
        ["obp", "OBP"],
        ["slg", "SLG"],
        ["hits", "H"],
        ["runs", "R"],
        ["stolenBases", "SB"],
        ["strikeOuts", "SO"],
      ]);
    }
    if (group.includes("pitching")) {
      pitching = pickStats(stat, [
        ["era", "ERA"],
        ["wins", "W"],
        ["losses", "L"],
        ["strikeOuts", "SO"],
        ["whip", "WHIP"],
        ["saves", "SV"],
        ["inningsPitched", "IP"],
        ["holds", "HLD"],
        ["baseOnBalls", "BB"],
      ]);
    }
  }

  const place = [p.birthCity, p.birthStateProvince, p.birthCountry].filter(Boolean).join(", ");
  const teamId = p.currentTeam?.id ?? null;

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
    teamId,
    teamName: p.currentTeam?.name ?? null,
    teamAbbrev: p.currentTeam?.abbreviation ?? null,
    primaryColor: teamId != null ? TEAM_COLORS[teamId] ?? "d9515c" : "d9515c",
    headshot: mlbHeadshot(p.id ?? id, 426),
    actionShot: mlbActionShot(p.id ?? id),
    hitting,
    pitching,
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
