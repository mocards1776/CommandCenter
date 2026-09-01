import { supabase } from "./supabase";
import { mlbHeadshot } from "./mlb";

/** Map StatsAPI / ESPN abbrevs → Baseball-Reference team codes. */
const TO_BBREF: Record<string, string> = {
  AZ: "ARI",
  ARI: "ARI",
  CWS: "CHW",
  CHW: "CHW",
  WSH: "WSN",
  WSN: "WSN",
  TB: "TBR",
  TBR: "TBR",
  KC: "KCR",
  KCR: "KCR",
  SD: "SDP",
  SDP: "SDP",
  SF: "SFG",
  SFG: "SFG",
  ATH: "ATH",
  OAK: "ATH",
};

export function mlbToBbrefAbbrev(abbrev: string | null | undefined): string | null {
  if (!abbrev) return null;
  const key = abbrev.toUpperCase();
  return TO_BBREF[key] ?? key;
}

export type MlbTeamBbrefSummary = {
  url: string;
  salariesUrl: string | null;
  scheduleUrl: string | null;
  season: number;
  abbrev: string;
  record: string | null;
  standing: string | null;
  playoffOdds: {
    postseason: string | null;
    worldSeries: string | null;
    text: string | null;
  } | null;
  manager: { name: string; record: string | null } | null;
  president: string | null;
  farmDirector: string | null;
  scoutingDirector: string | null;
  ballpark: string | null;
  attendance: string | null;
  parkFactors: {
    multiYear: { batting: number; pitching: number } | null;
    oneYear: { batting: number; pitching: number } | null;
    note: string;
  };
  pythagorean: {
    record: string | null;
    runsScored: number | null;
    runsAllowed: number | null;
  };
};

export type MlbTeamPayrollRow = {
  name: string;
  age: string | null;
  experience: string | null;
  serviceTime: string | null;
  acquired: string | null;
  contractStatus: string | null;
  salary: string | null;
  salaryAmount: number | null;
  bbrefId: string | null;
  playerId: number | null;
};

export type MlbTeamPayroll = {
  url: string;
  abbrev: string;
  season: string;
  payrollTotal: number;
  payrollTotalDisplay: string | null;
  rows: MlbTeamPayrollRow[];
};

export type MlbTeamLeaderEntry = {
  id: number;
  name: string;
  shortName: string;
  value: string;
  position: string | null;
  number: string | null;
};

export type MlbTeamLeaderCard = {
  group: "hitting" | "pitching" | "fielding";
  category: string;
  abbrev: string;
  leaders: MlbTeamLeaderEntry[];
};

export async function fetchMlbTeamBbrefSummary(
  abbrev: string,
  season = new Date().getFullYear(),
): Promise<MlbTeamBbrefSummary | null> {
  const bb = mlbToBbrefAbbrev(abbrev);
  if (!bb) return null;
  try {
    const { data, error } = await supabase.functions.invoke("sports", {
      body: { action: "teamBbrefSummary", abbrev: bb, season },
    });
    if (error) throw error;
    const payload = data as (Partial<MlbTeamBbrefSummary> & { error?: string }) | null;
    if (!payload || payload.error) return null;
    return {
      url: payload.url ?? "",
      salariesUrl: payload.salariesUrl ?? null,
      scheduleUrl: payload.scheduleUrl ?? null,
      season: payload.season ?? season,
      abbrev: payload.abbrev ?? bb,
      record: payload.record ?? null,
      standing: payload.standing ?? null,
      playoffOdds: payload.playoffOdds
        ? {
            postseason: payload.playoffOdds.postseason ?? null,
            worldSeries: payload.playoffOdds.worldSeries ?? null,
            text: payload.playoffOdds.text ?? null,
          }
        : null,
      manager: payload.manager ?? null,
      president: payload.president ?? null,
      farmDirector: payload.farmDirector ?? null,
      scoutingDirector: payload.scoutingDirector ?? null,
      ballpark: payload.ballpark ?? null,
      attendance: payload.attendance ?? null,
      parkFactors: payload.parkFactors ?? {
        multiYear: null,
        oneYear: null,
        note: "Over 100 favors batters, under 100 favors pitchers.",
      },
      pythagorean: payload.pythagorean ?? {
        record: null,
        runsScored: null,
        runsAllowed: null,
      },
    };
  } catch {
    return null;
  }
}

export async function fetchMlbTeamPayroll(abbrev: string): Promise<MlbTeamPayroll | null> {
  const bb = mlbToBbrefAbbrev(abbrev);
  if (!bb) return null;
  try {
    const { data, error } = await supabase.functions.invoke("sports", {
      body: { action: "teamPayroll", abbrev: bb },
    });
    if (error) throw error;
    const payload = data as (Partial<MlbTeamPayroll> & { error?: string; rows?: MlbTeamPayrollRow[] }) | null;
    if (!payload || payload.error || !payload.url) return null;
    return {
      url: payload.url,
      abbrev: payload.abbrev ?? bb,
      season: payload.season ?? String(new Date().getFullYear()),
      payrollTotal: payload.payrollTotal ?? 0,
      payrollTotalDisplay: payload.payrollTotalDisplay ?? null,
      rows: (payload.rows ?? []).map((r) => ({ ...r, playerId: r.playerId ?? null })),
    };
  } catch {
    return null;
  }
}

function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return full;
  return `${parts[0]![0]}. ${parts[parts.length - 1]}`;
}

function formatStatValue(raw: unknown, kind: "avg" | "count" | "era" | "ip"): string {
  if (raw == null || raw === "") return "—";
  if (kind === "avg") {
    const n = Number(raw);
    if (!Number.isFinite(n)) return String(raw);
    return n.toFixed(3).replace(/^0/, "");
  }
  if (kind === "era") {
    const n = Number(raw);
    return Number.isFinite(n) ? n.toFixed(2) : String(raw);
  }
  return String(raw);
}

type RosterMeta = { position: string | null; number: string | null };

async function loadRosterMeta(teamId: number): Promise<Map<number, RosterMeta>> {
  const map = new Map<number, RosterMeta>();
  try {
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=active`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return map;
    const raw = (await res.json()) as {
      roster?: {
        person?: { id?: number };
        jerseyNumber?: string;
        position?: { abbreviation?: string };
      }[];
    };
    for (const r of raw.roster ?? []) {
      if (r.person?.id == null) continue;
      map.set(r.person.id, {
        position: r.position?.abbreviation ?? null,
        number: r.jerseyNumber ?? null,
      });
    }
  } catch {
    /* optional */
  }
  return map;
}

async function topStatLeaders(
  teamId: number,
  season: number,
  group: "hitting" | "pitching" | "fielding",
  sortStat: string,
  order: "asc" | "desc",
  category: string,
  abbrev: string,
  format: (stat: Record<string, unknown>) => string | null,
  roster: Map<number, RosterMeta>,
  minGate?: (stat: Record<string, unknown>) => boolean,
): Promise<MlbTeamLeaderCard | null> {
  const url =
    `https://statsapi.mlb.com/api/v1/stats?stats=season&group=${group}&season=${season}` +
    `&teamIds=${teamId}&sportIds=1&playerPool=all&limit=40&order=${order}&sortStat=${sortStat}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const raw = (await res.json()) as {
      stats?: {
        splits?: {
          player?: { id?: number; fullName?: string };
          stat?: Record<string, unknown>;
        }[];
      }[];
    };
    const leaders: MlbTeamLeaderEntry[] = [];
    for (const s of raw.stats?.[0]?.splits ?? []) {
      if (!s.player?.id || !s.player.fullName) continue;
      if (minGate && !minGate(s.stat ?? {})) continue;
      const value = format(s.stat ?? {});
      if (!value) continue;
      const meta = roster.get(s.player.id);
      leaders.push({
        id: s.player.id,
        name: s.player.fullName,
        shortName: shortName(s.player.fullName),
        value,
        position: meta?.position ?? null,
        number: meta?.number ?? null,
      });
      if (leaders.length >= 4) break;
    }
    if (!leaders.length) return null;
    return { group, category, abbrev, leaders };
  } catch {
    return null;
  }
}

/** Pic-2 style team leader cards (hitting / pitching / fielding). */
export async function fetchMlbTeamLeaderCards(
  teamId: number,
  season = new Date().getFullYear(),
): Promise<MlbTeamLeaderCard[]> {
  const roster = await loadRosterMeta(teamId);
  const minAb = (s: Record<string, unknown>) => Number(s.atBats ?? 0) >= 50;
  const minIp = (s: Record<string, unknown>) => parseFloat(String(s.inningsPitched ?? 0)) >= 10;
  const minInn = (s: Record<string, unknown>) => Number(s.innings ?? s.games ?? 0) >= 10;

  const specs: Array<Promise<MlbTeamLeaderCard | null>> = [
    topStatLeaders(teamId, season, "hitting", "ops", "desc", "OPS", "OPS", (s) => formatStatValue(s.ops, "avg"), roster, minAb),
    topStatLeaders(teamId, season, "hitting", "avg", "desc", "Batting Average", "AVG", (s) => formatStatValue(s.avg, "avg"), roster, minAb),
    topStatLeaders(teamId, season, "hitting", "homeRuns", "desc", "Home Runs", "HR", (s) => formatStatValue(s.homeRuns, "count"), roster, minAb),
    topStatLeaders(teamId, season, "hitting", "rbi", "desc", "Runs Batted In", "RBI", (s) => formatStatValue(s.rbi, "count"), roster, minAb),
    topStatLeaders(teamId, season, "hitting", "runs", "desc", "Runs", "R", (s) => formatStatValue(s.runs, "count"), roster, minAb),
    topStatLeaders(teamId, season, "hitting", "hits", "desc", "Hits", "H", (s) => formatStatValue(s.hits, "count"), roster, minAb),
    topStatLeaders(teamId, season, "pitching", "era", "asc", "ERA", "ERA", (s) => formatStatValue(s.era, "era"), roster, minIp),
    topStatLeaders(teamId, season, "pitching", "whip", "asc", "WHIP", "WHIP", (s) => formatStatValue(s.whip, "era"), roster, minIp),
    topStatLeaders(teamId, season, "pitching", "strikeOuts", "desc", "Strikeouts", "SO", (s) => formatStatValue(s.strikeOuts, "count"), roster, minIp),
    topStatLeaders(teamId, season, "pitching", "wins", "desc", "Wins", "W", (s) => formatStatValue(s.wins, "count"), roster, minIp),
    topStatLeaders(teamId, season, "pitching", "saves", "desc", "Saves", "SV", (s) => formatStatValue(s.saves, "count"), roster, () => true),
    topStatLeaders(teamId, season, "pitching", "inningsPitched", "desc", "Innings", "IP", (s) => formatStatValue(s.inningsPitched, "ip"), roster, minIp),
    topStatLeaders(teamId, season, "fielding", "fielding", "desc", "Fielding %", "FLD%", (s) => formatStatValue(s.fielding, "avg"), roster, minInn),
    topStatLeaders(teamId, season, "fielding", "assists", "desc", "Assists", "A", (s) => formatStatValue(s.assists, "count"), roster, minInn),
    topStatLeaders(teamId, season, "fielding", "putOuts", "desc", "Putouts", "PO", (s) => formatStatValue(s.putOuts, "count"), roster, minInn),
    topStatLeaders(teamId, season, "fielding", "doublePlays", "desc", "Double Plays", "DP", (s) => formatStatValue(s.doublePlays, "count"), roster, minInn),
    topStatLeaders(teamId, season, "fielding", "errors", "asc", "Errors", "E", (s) => formatStatValue(s.errors, "count"), roster, minInn),
    topStatLeaders(teamId, season, "fielding", "chances", "desc", "Chances", "TC", (s) => formatStatValue(s.chances, "count"), roster, minInn),
  ];

  const settled = await Promise.all(specs);
  return settled.filter((c): c is MlbTeamLeaderCard => Boolean(c?.leaders.length));
}

export function leaderHeadshot(playerId: number): string {
  return mlbHeadshot(playerId, 426);
}

export type MlbTeamWinTrendHonor = "WC" | "DIV" | "LCS" | "WS";

export type MlbTeamWinTrendPoint = {
  season: number;
  wins: number;
  losses: number;
  honors: MlbTeamWinTrendHonor[];
};

export type MlbTeamStatRank = {
  label: string;
  rank: number;
  of: number;
};

type TeamSeasonStats = {
  teamId: number;
  hitting: Record<string, unknown>;
  pitching: Record<string, unknown>;
  runsScored: number | null;
  runsAllowed: number | null;
};

const HITTING_RANK_SPECS: { key: string; label: string; order: "asc" | "desc" }[] = [
  { key: "runs", label: "R", order: "desc" },
  { key: "homeRuns", label: "HR", order: "desc" },
  { key: "avg", label: "AVG", order: "desc" },
  { key: "obp", label: "OBP", order: "desc" },
  { key: "slg", label: "SLG", order: "desc" },
  { key: "ops", label: "OPS", order: "desc" },
];

const PITCHING_RANK_SPECS: { key: string; label: string; order: "asc" | "desc" }[] = [
  { key: "era", label: "ERA", order: "asc" },
  { key: "whip", label: "WHIP", order: "asc" },
  { key: "strikeOuts", label: "SO", order: "desc" },
  { key: "saves", label: "SV", order: "desc" },
  { key: "wins", label: "W", order: "desc" },
  { key: "inningsPitched", label: "IP", order: "desc" },
];

function numStat(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

async function fetchTeamSeasonStats(teamId: number, season: number): Promise<TeamSeasonStats | null> {
  try {
    const [hitRes, pitchRes] = await Promise.all([
      fetch(
        `https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?season=${season}&group=hitting&stats=season`,
        { headers: { Accept: "application/json" } },
      ),
      fetch(
        `https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?season=${season}&group=pitching&stats=season`,
        { headers: { Accept: "application/json" } },
      ),
    ]);
    if (!hitRes.ok || !pitchRes.ok) return null;
    const hitRaw = (await hitRes.json()) as {
      stats?: { splits?: { stat?: Record<string, unknown> }[] }[];
    };
    const pitchRaw = (await pitchRes.json()) as {
      stats?: { splits?: { stat?: Record<string, unknown> }[] }[];
    };
    return {
      teamId,
      hitting: hitRaw.stats?.[0]?.splits?.[0]?.stat ?? {},
      pitching: pitchRaw.stats?.[0]?.splits?.[0]?.stat ?? {},
      runsScored: null,
      runsAllowed: null,
    };
  } catch {
    return null;
  }
}

async function loadLeagueTeamStats(season: number): Promise<TeamSeasonStats[]> {
  const standRes = await fetch(
    `https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason`,
    { headers: { Accept: "application/json" } },
  );
  if (!standRes.ok) return [];
  const standRaw = (await standRes.json()) as {
    records?: {
      teamRecords?: {
        team?: { id?: number };
        runsScored?: number;
        runsAllowed?: number;
      }[];
    }[];
  };
  const teamRows: { id: number; runsScored: number | null; runsAllowed: number | null }[] = [];
  for (const div of standRaw.records ?? []) {
    for (const row of div.teamRecords ?? []) {
      if (!row.team?.id) continue;
      teamRows.push({
        id: row.team.id,
        runsScored: row.runsScored ?? null,
        runsAllowed: row.runsAllowed ?? null,
      });
    }
  }
  const stats = await Promise.all(teamRows.map((t) => fetchTeamSeasonStats(t.id, season)));
  return stats
    .map((s, i) => {
      if (!s) return null;
      const row = teamRows[i]!;
      return {
        ...s,
        runsScored: row.runsScored,
        runsAllowed: row.runsAllowed,
      };
    })
    .filter((s): s is TeamSeasonStats => Boolean(s));
}

function rankTeams(
  rows: TeamSeasonStats[],
  read: (row: TeamSeasonStats) => number | null,
  order: "asc" | "desc",
): Map<number, number> {
  const scored = rows
    .map((row) => ({ teamId: row.teamId, value: read(row) }))
    .filter((r): r is { teamId: number; value: number } => r.value != null);
  scored.sort((a, b) => (order === "desc" ? b.value - a.value : a.value - b.value));
  const out = new Map<number, number>();
  for (let i = 0; i < scored.length; i++) {
    const { teamId, value } = scored[i]!;
    let rank = i + 1;
    for (let j = i - 1; j >= 0; j--) {
      if (scored[j]!.value === value) rank = j + 1;
      else break;
    }
    out.set(teamId, rank);
  }
  return out;
}

/** MLB-wide team stat ranks (30 teams) for the team stats grid. */
export async function fetchMlbTeamStatLeagueRanks(
  teamId: number,
  season = new Date().getFullYear(),
): Promise<MlbTeamStatRank[]> {
  const rows = await loadLeagueTeamStats(season);
  if (!rows.length) return [];
  const of = rows.length;
  const ranks: MlbTeamStatRank[] = [];

  const rRank = rankTeams(rows, (row) => row.runsScored, "desc");
  if (rRank.has(teamId)) ranks.push({ label: "R", rank: rRank.get(teamId)!, of });

  for (const spec of HITTING_RANK_SPECS) {
    if (spec.label === "R") continue;
    const map = rankTeams(rows, (row) => numStat(row.hitting[spec.key]), spec.order);
    if (map.has(teamId)) ranks.push({ label: spec.label, rank: map.get(teamId)!, of });
  }
  for (const spec of PITCHING_RANK_SPECS) {
    const map = rankTeams(rows, (row) => numStat(row.pitching[spec.key]), spec.order);
    if (map.has(teamId)) ranks.push({ label: spec.label, rank: map.get(teamId)!, of });
  }
  return ranks;
}

async function postseasonHonors(teamId: number, season: number): Promise<MlbTeamWinTrendHonor[]> {
  const honors: MlbTeamWinTrendHonor[] = [];
  try {
    const standRes = await fetch(
      `https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason`,
      { headers: { Accept: "application/json" } },
    );
    if (standRes.ok) {
      const standRaw = (await standRes.json()) as {
        records?: {
          teamRecords?: {
            team?: { id?: number };
            divisionChamp?: boolean;
            divisionLeader?: boolean;
            hasWildcard?: boolean;
            clinchIndicator?: string;
            wildCardRank?: string;
          }[];
        }[];
      };
      for (const div of standRaw.records ?? []) {
        for (const row of div.teamRecords ?? []) {
          if (row.team?.id !== teamId) continue;
          const ind = (row.clinchIndicator ?? "").toLowerCase();
          const wcRank = String(row.wildCardRank ?? "").trim();
          if (row.divisionChamp || ind === "z") honors.push("DIV");
          else if (ind === "w" || /^[123]$/.test(wcRank)) honors.push("WC");
        }
      }
    }
  } catch {
    /* optional */
  }

  const seriesWin = async (gameType: "L" | "W", tag: MlbTeamWinTrendHonor) => {
    try {
      const res = await fetch(
        `https://statsapi.mlb.com/api/v1/schedule?season=${season}&sportId=1&gameTypes=${gameType}&teamId=${teamId}`,
        { headers: { Accept: "application/json" } },
      );
      if (!res.ok) return;
      const raw = (await res.json()) as {
        dates?: {
          games?: {
            status?: { abstractGameState?: string };
            seriesDescription?: string;
            gameNumber?: number;
            gamesInSeries?: number;
            teams?: {
              away?: { team?: { id?: number }; isWinner?: boolean };
              home?: { team?: { id?: number }; isWinner?: boolean };
            };
          }[];
        }[];
      };
      for (const dt of raw.dates ?? []) {
        for (const g of dt.games ?? []) {
          if (g.status?.abstractGameState !== "Final") continue;
          const away = g.teams?.away;
          const home = g.teams?.home;
          const side =
            away?.team?.id === teamId ? away : home?.team?.id === teamId ? home : null;
          if (!side?.isWinner) continue;
          if (gameType === "L" && /championship/i.test(g.seriesDescription ?? "")) {
            if (g.gameNumber === g.gamesInSeries) honors.push(tag);
          }
          if (gameType === "W") honors.push(tag);
        }
      }
    } catch {
      /* optional */
    }
  };

  await seriesWin("L", "LCS");
  await seriesWin("W", "WS");
  return [...new Set(honors)];
}

/** Last N completed regular seasons for the team bar chart (excludes in-progress year). */
export async function fetchMlbTeamWinTrend(
  teamId: number,
  seasons = 5,
): Promise<MlbTeamWinTrendPoint[]> {
  const end = new Date().getFullYear() - 1;
  const years = Array.from({ length: seasons }, (_, i) => end - seasons + 1 + i);
  const points = await Promise.all(
    years.map(async (season) => {
      try {
        const res = await fetch(
          `https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason`,
          { headers: { Accept: "application/json" } },
        );
        if (!res.ok) return null;
        const raw = (await res.json()) as {
          records?: {
            teamRecords?: {
              wins?: number;
              losses?: number;
              team?: { id?: number };
            }[];
          }[];
        };
        for (const div of raw.records ?? []) {
          for (const row of div.teamRecords ?? []) {
            if (row.team?.id === teamId && row.wins != null) {
              const honors = await postseasonHonors(teamId, season);
              return {
                season,
                wins: row.wins,
                losses: row.losses ?? 0,
                honors,
              } satisfies MlbTeamWinTrendPoint;
            }
          }
        }
      } catch {
        /* optional season */
      }
      return null;
    }),
  );
  return points.filter((p): p is MlbTeamWinTrendPoint => Boolean(p));
}

export type MlbRecordChip = {
  label: string;
  record: string;
  pct: string | null;
};

export type MlbTeamRecordSplits = {
  teamId: number;
  season: number;
  streak: string | null;
  recent: MlbRecordChip[];
  venue: MlbRecordChip[];
  timing: MlbRecordChip[];
  situational: MlbRecordChip[];
  vsArm: MlbRecordChip[];
  months: MlbRecordChip[];
  divisions: MlbRecordChip[];
  leagues: MlbRecordChip[];
};

function wlPct(wins: number, losses: number): string | null {
  const g = wins + losses;
  if (!g) return null;
  return (wins / g).toFixed(3).replace(/^0/, "");
}

function wlRecord(wins: number, losses: number): string {
  return `${wins}-${losses}`;
}

function formFromResults(results: boolean[], n: number): MlbRecordChip | null {
  const slice = results.slice(-n);
  if (!slice.length) return null;
  const wins = slice.filter(Boolean).length;
  const losses = slice.length - wins;
  return {
    label: `Last ${n}`,
    record: wlRecord(wins, losses),
    pct: wlPct(wins, losses),
  };
}

function monthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  if (!y || !m) return yyyyMm;
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
}

function shortDivLabel(name: string): string {
  return name
    .replace(/^National League\s+/i, "NL ")
    .replace(/^American League\s+/i, "AL ")
    .replace(/\s+Division$/i, "");
}

/** Season record splits: recent form, home/away, month, day/night, etc. */
export async function fetchMlbTeamRecordSplits(
  teamId: number,
  season = new Date().getFullYear(),
): Promise<MlbTeamRecordSplits> {
  const empty: MlbTeamRecordSplits = {
    teamId,
    season,
    streak: null,
    recent: [],
    venue: [],
    timing: [],
    situational: [],
    vsArm: [],
    months: [],
    divisions: [],
    leagues: [],
  };

  const [schedRes, standRes] = await Promise.all([
    fetch(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${teamId}&startDate=${season}-03-01&endDate=${season}-11-15&gameType=R`,
      { headers: { Accept: "application/json" } },
    ),
    fetch(
      `https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason`,
      { headers: { Accept: "application/json" } },
    ),
  ]);

  const resultsChrono: boolean[] = [];
  const byMonth = new Map<string, { wins: number; losses: number }>();

  if (schedRes.ok) {
    const sched = (await schedRes.json()) as {
      dates?: {
        games?: {
          officialDate?: string;
          status?: { abstractGameState?: string };
          teams?: {
            away?: { team?: { id?: number }; isWinner?: boolean };
            home?: { team?: { id?: number }; isWinner?: boolean };
          };
        }[];
      }[];
    };
    const rows: { date: string; won: boolean }[] = [];
    for (const day of sched.dates ?? []) {
      for (const g of day.games ?? []) {
        if (g.status?.abstractGameState !== "Final") continue;
        const home = g.teams?.home;
        const away = g.teams?.away;
        if (!home || !away) continue;
        const us = home.team?.id === teamId ? home : away;
        if (us.team?.id !== teamId || us.isWinner == null) continue;
        const date = g.officialDate ?? "";
        rows.push({ date, won: Boolean(us.isWinner) });
      }
    }
    rows.sort((a, b) => a.date.localeCompare(b.date));
    for (const r of rows) {
      resultsChrono.push(r.won);
      const mk = r.date.slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(mk)) continue;
      const bucket = byMonth.get(mk) ?? { wins: 0, losses: 0 };
      if (r.won) bucket.wins += 1;
      else bucket.losses += 1;
      byMonth.set(mk, bucket);
    }
  }

  const recent = [5, 10, 20, 30]
    .map((n) => formFromResults(resultsChrono, n))
    .filter((x): x is MlbRecordChip => Boolean(x));

  const months = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mk, wl]) => ({
      label: monthLabel(mk),
      record: wlRecord(wl.wins, wl.losses),
      pct: wlPct(wl.wins, wl.losses),
    }));

  let streak: string | null = null;
  const venue: MlbRecordChip[] = [];
  const timing: MlbRecordChip[] = [];
  const situational: MlbRecordChip[] = [];
  const vsArm: MlbRecordChip[] = [];
  const divisions: MlbRecordChip[] = [];
  const leagues: MlbRecordChip[] = [];

  if (standRes.ok) {
    const stand = (await standRes.json()) as {
      records?: {
        teamRecords?: {
          team?: { id?: number };
          streak?: { streakCode?: string };
          records?: {
            splitRecords?: { type?: string; wins?: number; losses?: number; pct?: string }[];
            divisionRecords?: {
              wins?: number;
              losses?: number;
              pct?: string;
              division?: { name?: string };
            }[];
            leagueRecords?: {
              wins?: number;
              losses?: number;
              pct?: string;
              league?: { name?: string };
            }[];
          };
        }[];
      }[];
    };

    outer: for (const block of stand.records ?? []) {
      for (const row of block.teamRecords ?? []) {
        if (row.team?.id !== teamId) continue;
        streak = row.streak?.streakCode ?? null;
        const splits = row.records?.splitRecords ?? [];
        const pick = (type: string, label: string, bucket: MlbRecordChip[]) => {
          const s = splits.find((x) => x.type === type);
          if (!s || (s.wins ?? 0) + (s.losses ?? 0) === 0) return;
          bucket.push({
            label,
            record: wlRecord(s.wins ?? 0, s.losses ?? 0),
            pct: s.pct ?? wlPct(s.wins ?? 0, s.losses ?? 0),
          });
        };
        pick("home", "Home", venue);
        pick("away", "Away", venue);
        pick("day", "Day", timing);
        pick("night", "Night", timing);
        pick("oneRun", "1-run", situational);
        pick("extraInning", "Extras", situational);
        pick("winners", "vs .500+", situational);
        pick("left", "vs LHP", vsArm);
        pick("right", "vs RHP", vsArm);

        for (const d of row.records?.divisionRecords ?? []) {
          const name = d.division?.name;
          if (!name || (d.wins ?? 0) + (d.losses ?? 0) === 0) continue;
          divisions.push({
            label: shortDivLabel(name),
            record: wlRecord(d.wins ?? 0, d.losses ?? 0),
            pct: d.pct ?? wlPct(d.wins ?? 0, d.losses ?? 0),
          });
        }
        for (const l of row.records?.leagueRecords ?? []) {
          const name = l.league?.name;
          if (!name || (l.wins ?? 0) + (l.losses ?? 0) === 0) continue;
          leagues.push({
            label: /american/i.test(name) ? "vs AL" : /national/i.test(name) ? "vs NL" : name,
            record: wlRecord(l.wins ?? 0, l.losses ?? 0),
            pct: l.pct ?? wlPct(l.wins ?? 0, l.losses ?? 0),
          });
        }
        break outer;
      }
    }
  }

  return {
    ...empty,
    streak,
    recent,
    venue,
    timing,
    situational,
    vsArm,
    months,
    divisions,
    leagues,
  };
}
