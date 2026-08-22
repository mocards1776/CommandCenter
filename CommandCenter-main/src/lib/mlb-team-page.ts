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
    if (!payload || payload.error || !payload.url) return null;
    return {
      url: payload.url,
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

export type MlbTeamWinTrendPoint = {
  season: number;
  wins: number;
  losses: number;
};

/** Last N regular-season win totals for the team bar chart. */
export async function fetchMlbTeamWinTrend(
  teamId: number,
  seasons = 5,
): Promise<MlbTeamWinTrendPoint[]> {
  const end = new Date().getFullYear();
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
              return {
                season,
                wins: row.wins,
                losses: row.losses ?? 0,
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
