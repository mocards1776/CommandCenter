import { supabase } from "./supabase";
import { fetchMlbTeamGeneralManager, fetchMlbTeamManager } from "./mlb";

/** A favorite franchise or tour the dashboard can show. */
export type SportsFavorite = {
  key: string;
  name: string;
  shortName: string;
  sport: string;
  league: string;
  /** ESPN path under /apis/site/v2/sports/ — team id or scoreboard. */
  espnPath: string;
  kind: "team" | "tour";
  /** Hex without #, from the franchise when known. */
  color?: string;
  /** Official MLB Stats API team id when available (Cardinals = 138). */
  mlbTeamId?: number;
};

export type SportsLayout = {
  /** Favorite keys in display order. */
  order: string[];
  /** Keys the user hid from the board. */
  hidden: string[];
  /** Optional player pins for later expansion. */
  pinnedPlayers: { id: string; name: string; teamKey: string }[];
};

export type TeamSnapshot = {
  key: string;
  name: string;
  shortName: string;
  abbreviation: string;
  logo: string | null;
  color: string | null;
  record: string | null;
  standing: string | null;
  nextGame: GameChip | null;
  lastGame: GameChip | null;
};

export type GameChip = {
  label: string;
  detail: string | null;
  when: string | null;
  won: boolean | null;
  live?: boolean;
};

export type TourSnapshot = {
  key: string;
  name: string;
  eventName: string | null;
  status: string | null;
  leaders: { name: string; score: string; detail: string | null }[];
};

export type StandingRow = {
  rank: string;
  team: string;
  teamId: string | null;
  record: string;
  gb: string;
  pct: string;
  isMe: boolean;
};

export type ScheduleGame = {
  id: string;
  when: string | null;
  label: string;
  detail: string | null;
  status: string;
  won: boolean | null;
  live: boolean;
  /** e.g. "Liberatore vs Skenes" */
  pitchers?: string | null;
  myPitcher?: string | null;
  oppPitcher?: string | null;
  myPitcherId?: number | null;
  oppPitcherId?: number | null;
  opponentTeamId?: number | null;
};

export type RosterPlayer = {
  id: string;
  name: string;
  number: string | null;
  position: string | null;
  batsThrows?: string | null;
};

export type LeaderStat = {
  id?: string;
  name: string;
  line: string;
};

export type TeamDetail = {
  key: string;
  name: string;
  shortName: string;
  logo: string | null;
  color: string | null;
  record: string | null;
  standing: string | null;
  playoffOdds: string | null;
  wildCardOdds: string | null;
  manager: { id: number; name: string; title: string } | null;
  generalManager: { name: string; title: string } | null;
  division: StandingRow[];
  upcoming: ScheduleGame[];
  recent: ScheduleGame[];
  roster: RosterPlayer[];
  hittingLeaders: LeaderStat[];
  pitchingLeaders: LeaderStat[];
  teamHitting: { label: string; value: string }[];
  teamPitching: { label: string; value: string }[];
  source: "mlb" | "espn";
};

const LAYOUT_KEY = "sports-layout-v1";
const ESPN = "https://site.api.espn.com/apis/site/v2/sports";
const MLB = "https://statsapi.mlb.com/api/v1";

/** Default board — your teams, front of the store. */
export const DEFAULT_FAVORITES: SportsFavorite[] = [
  {
    key: "mlb-stl",
    name: "St. Louis Cardinals",
    shortName: "Cardinals",
    sport: "Baseball",
    league: "MLB",
    espnPath: "baseball/mlb/teams/24",
    mlbTeamId: 138,
    kind: "team",
    color: "be0a14",
  },
  {
    key: "nhl-stl",
    name: "St. Louis Blues",
    shortName: "Blues",
    sport: "Hockey",
    league: "NHL",
    espnPath: "hockey/nhl/teams/19",
    kind: "team",
    color: "002f87",
  },
  {
    key: "cfb-mizzou",
    name: "Mizzou Football",
    shortName: "Mizzou FB",
    sport: "Football",
    league: "NCAA",
    espnPath: "football/college-football/teams/142",
    kind: "team",
    color: "f1b82d",
  },
  {
    key: "cbb-mizzou",
    name: "Mizzou Basketball",
    shortName: "Mizzou BB",
    sport: "Basketball",
    league: "NCAA",
    espnPath: "basketball/mens-college-basketball/teams/142",
    kind: "team",
    color: "f1b82d",
  },
  {
    key: "nfl-det",
    name: "Detroit Lions",
    shortName: "Lions",
    sport: "Football",
    league: "NFL",
    espnPath: "football/nfl/teams/8",
    kind: "team",
    color: "0076b6",
  },
  {
    key: "nfl-kc",
    name: "Kansas City Chiefs",
    shortName: "Chiefs",
    sport: "Football",
    league: "NFL",
    espnPath: "football/nfl/teams/12",
    kind: "team",
    color: "e31837",
  },
  {
    key: "eng-wrexham",
    name: "Wrexham",
    shortName: "Wrexham",
    sport: "Soccer",
    league: "EFL Championship",
    espnPath: "soccer/eng.2/teams/352",
    kind: "team",
    color: "c8102e",
  },
  {
    key: "eng-wolves",
    name: "Wolverhampton",
    shortName: "Wolves",
    sport: "Soccer",
    league: "Premier League",
    espnPath: "soccer/eng.1/teams/380",
    kind: "team",
    color: "fdb913",
  },
  {
    key: "eng-arsenal",
    name: "Arsenal",
    shortName: "Arsenal",
    sport: "Soccer",
    league: "Premier League",
    espnPath: "soccer/eng.1/teams/359",
    kind: "team",
    color: "ef0107",
  },
  {
    key: "pga-tour",
    name: "PGA Tour",
    shortName: "PGA",
    sport: "Golf",
    league: "PGA Tour",
    espnPath: "golf/pga/scoreboard",
    kind: "tour",
    color: "024731",
  },
];

/** ESPN team ids for MLB logos/odds when opening non-favorite clubs. */
const MLB_TEAM_META: Record<
  number,
  { abbrev: string; name: string; shortName: string; espnId: string; color: string }
> = {
  108: { abbrev: "LAA", name: "Los Angeles Angels", shortName: "Angels", espnId: "3", color: "ba0021" },
  109: { abbrev: "AZ", name: "Arizona Diamondbacks", shortName: "D-backs", espnId: "29", color: "a71930" },
  110: { abbrev: "BAL", name: "Baltimore Orioles", shortName: "Orioles", espnId: "1", color: "df4601" },
  111: { abbrev: "BOS", name: "Boston Red Sox", shortName: "Red Sox", espnId: "2", color: "bd3039" },
  112: { abbrev: "CHC", name: "Chicago Cubs", shortName: "Cubs", espnId: "16", color: "0e3386" },
  113: { abbrev: "CIN", name: "Cincinnati Reds", shortName: "Reds", espnId: "17", color: "c6011f" },
  114: { abbrev: "CLE", name: "Cleveland Guardians", shortName: "Guardians", espnId: "5", color: "e31937" },
  115: { abbrev: "COL", name: "Colorado Rockies", shortName: "Rockies", espnId: "27", color: "33006f" },
  116: { abbrev: "DET", name: "Detroit Tigers", shortName: "Tigers", espnId: "6", color: "0c2340" },
  117: { abbrev: "HOU", name: "Houston Astros", shortName: "Astros", espnId: "18", color: "002d62" },
  118: { abbrev: "KC", name: "Kansas City Royals", shortName: "Royals", espnId: "7", color: "004687" },
  119: { abbrev: "LAD", name: "Los Angeles Dodgers", shortName: "Dodgers", espnId: "19", color: "005a9c" },
  120: { abbrev: "WSH", name: "Washington Nationals", shortName: "Nationals", espnId: "20", color: "ab0003" },
  121: { abbrev: "NYM", name: "New York Mets", shortName: "Mets", espnId: "21", color: "002d72" },
  133: { abbrev: "ATH", name: "Athletics", shortName: "Athletics", espnId: "11", color: "003831" },
  134: { abbrev: "PIT", name: "Pittsburgh Pirates", shortName: "Pirates", espnId: "23", color: "27251f" },
  135: { abbrev: "SD", name: "San Diego Padres", shortName: "Padres", espnId: "25", color: "2f241d" },
  136: { abbrev: "SEA", name: "Seattle Mariners", shortName: "Mariners", espnId: "12", color: "005c5c" },
  137: { abbrev: "SF", name: "San Francisco Giants", shortName: "Giants", espnId: "26", color: "fd5a1e" },
  138: { abbrev: "STL", name: "St. Louis Cardinals", shortName: "Cardinals", espnId: "24", color: "be0a14" },
  139: { abbrev: "TB", name: "Tampa Bay Rays", shortName: "Rays", espnId: "30", color: "8fbce6" },
  140: { abbrev: "TEX", name: "Texas Rangers", shortName: "Rangers", espnId: "13", color: "003278" },
  141: { abbrev: "TOR", name: "Toronto Blue Jays", shortName: "Blue Jays", espnId: "14", color: "134a8e" },
  142: { abbrev: "MIN", name: "Minnesota Twins", shortName: "Twins", espnId: "9", color: "002b5c" },
  143: { abbrev: "PHI", name: "Philadelphia Phillies", shortName: "Phillies", espnId: "22", color: "e81828" },
  144: { abbrev: "ATL", name: "Atlanta Braves", shortName: "Braves", espnId: "15", color: "ce1141" },
  145: { abbrev: "CWS", name: "Chicago White Sox", shortName: "White Sox", espnId: "4", color: "27251f" },
  146: { abbrev: "MIA", name: "Miami Marlins", shortName: "Marlins", espnId: "28", color: "00a3e0" },
  147: { abbrev: "NYY", name: "New York Yankees", shortName: "Yankees", espnId: "10", color: "0c2340" },
  158: { abbrev: "MIL", name: "Milwaukee Brewers", shortName: "Brewers", espnId: "8", color: "12284b" },
};

export function mlbTeamFavorite(teamId: number): SportsFavorite | undefined {
  const meta = MLB_TEAM_META[teamId];
  if (!meta) return undefined;
  return {
    key: teamId === 138 ? "mlb-stl" : `mlb-${teamId}`,
    name: meta.name,
    shortName: meta.shortName,
    sport: "Baseball",
    league: "MLB",
    espnPath: `baseball/mlb/teams/${meta.espnId}`,
    mlbTeamId: teamId,
    kind: "team",
    color: meta.color,
  };
}

export function favoriteByKey(key: string): SportsFavorite | undefined {
  const known = DEFAULT_FAVORITES.find((f) => f.key === key);
  if (known) return known;
  const m = /^mlb-(\d+)$/.exec(key);
  if (m) return mlbTeamFavorite(Number(m[1]));
  return undefined;
}

export function loadSportsLayout(): SportsLayout {
  const defaults: SportsLayout = {
    order: DEFAULT_FAVORITES.map((f) => f.key),
    hidden: [],
    pinnedPlayers: [],
  };
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<SportsLayout>;
    const known = new Set(DEFAULT_FAVORITES.map((f) => f.key));
    const order = (parsed.order ?? defaults.order).filter((k) => known.has(k));
    for (const k of defaults.order) if (!order.includes(k)) order.push(k);
    return {
      order,
      hidden: (parsed.hidden ?? []).filter((k) => known.has(k)),
      pinnedPlayers: Array.isArray(parsed.pinnedPlayers) ? parsed.pinnedPlayers : [],
    };
  } catch {
    return defaults;
  }
}

export function saveSportsLayout(layout: SportsLayout): void {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
}

export function visibleFavorites(layout: SportsLayout): SportsFavorite[] {
  const byKey = new Map(DEFAULT_FAVORITES.map((f) => [f.key, f]));
  const hidden = new Set(layout.hidden);
  return layout.order
    .map((k) => byKey.get(k))
    .filter((f): f is SportsFavorite => f != null && !hidden.has(f.key));
}

async function espnGet(path: string): Promise<unknown> {
  const clean = path.replace(/^\/+/, "");
  try {
    const ctl = new AbortController();
    const t = window.setTimeout(() => ctl.abort(), 12000);
    const res = await fetch(`${ESPN}/${clean}`, {
      signal: ctl.signal,
      headers: { Accept: "application/json" },
    }).finally(() => window.clearTimeout(t));
    if (res.ok) return await res.json();
  } catch {
    // fall through to edge proxy
  }

  const { data, error } = await supabase.functions.invoke("sports", {
    body: { path: clean },
  });
  if (error) throw new Error(error.message);
  if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
    throw new Error(String((data as { error: string }).error));
  }
  return data;
}

async function mlbGet(path: string): Promise<unknown> {
  const clean = path.replace(/^\/+/, "");
  const ctl = new AbortController();
  const t = window.setTimeout(() => ctl.abort(), 12000);
  const res = await fetch(`${MLB}/${clean}`, {
    signal: ctl.signal,
    headers: { Accept: "application/json" },
  }).finally(() => window.clearTimeout(t));
  if (!res.ok) throw new Error(`MLB ${res.status}`);
  return res.json();
}

function pickLogo(logos: { href?: string; rel?: string[] }[] | undefined): string | null {
  if (!Array.isArray(logos) || logos.length === 0) return null;
  const full = logos.find((l) => l.rel?.includes("full"));
  return (full ?? logos[0])?.href ?? null;
}

/** ESPN sometimes returns score as a string, sometimes as { displayValue, value }. */
function scoreText(score: unknown): string {
  if (score == null) return "";
  if (typeof score === "string" || typeof score === "number") return String(score);
  if (typeof score === "object") {
    const o = score as { displayValue?: unknown; value?: unknown };
    if (o.displayValue != null) return String(o.displayValue);
    if (o.value != null) return String(o.value);
  }
  return "";
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

function fmtDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso.includes("T") ? iso : `${iso}T12:00:00`).toLocaleDateString("en-US", {
      timeZone: "America/Chicago",
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return null;
  }
}

function currentSeason(): number {
  // MLB/NHL/NBA seasons that span years: before July, prior year can still matter
  // for spring sports; for late summer use current year.
  return new Date().getFullYear();
}

type EspnComp = {
  competitors?: {
    homeAway?: string;
    score?: unknown;
    winner?: boolean;
    team?: { abbreviation?: string; displayName?: string; id?: string };
  }[];
  status?: {
    type?: {
      state?: string;
      completed?: boolean;
      shortDetail?: string;
      detail?: string;
      description?: string;
    };
  };
};

function competitionChip(comp: EspnComp | null, myId: string): GameChip | null {
  if (!comp?.competitors?.length) return null;
  const mine = comp.competitors.find((c) => String(c.team?.id) === String(myId));
  const opp = comp.competitors.find((c) => String(c.team?.id) !== String(myId));
  if (!mine || !opp) return null;
  const ha = mine.homeAway === "home" ? "vs" : "@";
  const oppName = opp.team?.abbreviation || opp.team?.displayName || "OPP";
  const state = comp.status?.type?.state;
  const done = Boolean(comp.status?.type?.completed || state === "post");
  const live = state === "in";
  if (done) {
    const ms = scoreText(mine.score);
    const os = scoreText(opp.score);
    return {
      label: `${ha} ${oppName}`,
      detail: ms && os ? `${ms}–${os}` : null,
      when: comp.status?.type?.shortDetail ?? null,
      won: typeof mine.winner === "boolean" ? mine.winner : null,
    };
  }
  return {
    label: `${ha} ${oppName}`,
    detail: comp.status?.type?.shortDetail ?? comp.status?.type?.detail ?? null,
    when: null,
    won: null,
    live,
  };
}

export async function fetchTeamSnapshot(fav: SportsFavorite): Promise<TeamSnapshot> {
  const teamId = fav.espnPath.split("/").pop() ?? "";
  const raw = (await espnGet(fav.espnPath)) as {
    team?: {
      id?: string;
      displayName?: string;
      shortDisplayName?: string;
      abbreviation?: string;
      color?: string;
      logos?: { href?: string; rel?: string[] }[];
      record?: { items?: { summary?: string; description?: string; type?: string }[] };
      standingSummary?: string;
      nextEvent?: {
        name?: string;
        date?: string;
        competitions?: EspnComp[];
      }[];
    };
  };

  const t = raw.team ?? {};
  const records = t.record?.items ?? [];
  const overall =
    records.find((r) => r.type === "total" || /overall/i.test(r.description ?? "")) ?? records[0];

  let nextGame: GameChip | null = null;
  const next = t.nextEvent?.[0];
  if (next?.competitions?.[0]) {
    nextGame = competitionChip(next.competitions[0], teamId);
    if (nextGame) nextGame.when = fmtWhen(next.date) ?? nextGame.when;
  }

  let lastGame: GameChip | null = null;
  try {
    const sched = (await espnGet(`${fav.espnPath}/schedule`)) as {
      events?: { date?: string; competitions?: EspnComp[] }[];
    };
    const events = [...(sched.events ?? [])].reverse();
    for (const ev of events) {
      const comp = ev.competitions?.[0];
      if (!comp?.status?.type?.completed && comp?.status?.type?.state !== "post") continue;
      lastGame = competitionChip(comp, teamId);
      if (lastGame) {
        lastGame.when = fmtWhen(ev.date) ?? lastGame.when;
        break;
      }
    }
  } catch {
    // schedule is optional
  }

  return {
    key: fav.key,
    name: t.displayName ?? fav.name,
    shortName: t.shortDisplayName ?? fav.shortName,
    abbreviation: t.abbreviation ?? "",
    logo: pickLogo(t.logos),
    color: t.color ?? fav.color ?? null,
    record: overall?.summary ?? null,
    standing: t.standingSummary ?? null,
    nextGame,
    lastGame,
  };
}

export async function fetchTourSnapshot(fav: SportsFavorite): Promise<TourSnapshot> {
  const raw = (await espnGet(fav.espnPath)) as {
    events?: {
      name?: string;
      status?: string;
      competitions?: {
        status?: { type?: { description?: string; detail?: string } };
        competitors?: {
          athlete?: { displayName?: string };
          score?: unknown;
          status?: { type?: { description?: string } };
        }[];
      }[];
    }[];
  };

  const event = raw.events?.[0];
  const comp = event?.competitions?.[0];
  const leaders = (comp?.competitors ?? []).slice(0, 5).map((c) => ({
    name: c.athlete?.displayName ?? "—",
    score: scoreText(c.score) || "—",
    detail: c.status?.type?.description ?? null,
  }));

  return {
    key: fav.key,
    name: fav.name,
    eventName: event?.name ?? null,
    status: comp?.status?.type?.detail ?? comp?.status?.type?.description ?? event?.status ?? null,
    leaders,
  };
}

function espnSportRoot(espnPath: string): string {
  // baseball/mlb/teams/24 → baseball/mlb
  const parts = espnPath.split("/");
  const i = parts.indexOf("teams");
  return i > 0 ? parts.slice(0, i).join("/") : parts.slice(0, 2).join("/");
}

async function fetchEspnPlayoffOdds(
  fav: SportsFavorite,
  espnTeamId: string,
): Promise<{ playoff: string | null; wildCard: string | null; standing: string | null }> {
  try {
    const root = espnSportRoot(fav.espnPath);
    const res = await fetch(`https://site.api.espn.com/apis/v2/sports/${root}/standings`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return { playoff: null, wildCard: null, standing: null };
    const d = (await res.json()) as {
      children?: {
        name?: string;
        standings?: {
          entries?: {
            team?: { id?: string; displayName?: string };
            stats?: { name?: string; displayValue?: string }[];
          }[];
        };
      }[];
    };
    for (const child of d.children ?? []) {
      for (const e of child.standings?.entries ?? []) {
        if (String(e.team?.id) !== String(espnTeamId)) continue;
        const stat = (n: string) => e.stats?.find((s) => s.name === n)?.displayValue ?? null;
        const rank = stat("rank") ?? stat("playoffSeed");
        const div = shortDiv(child.name);
        return {
          playoff: stat("playoffPercent"),
          wildCard: stat("wildCardPercent"),
          standing: rank ? `${rank}${/^\d+$/.test(rank) ? ordinalSuffix(Number(rank)) : ""} in ${div}` : null,
        };
      }
    }
  } catch {
    // optional
  }
  return { playoff: null, wildCard: null, standing: null };
}

async function fetchEspnTeamDetail(fav: SportsFavorite): Promise<TeamDetail> {
  const espnTeamId = fav.espnPath.split("/").pop() ?? "";
  const snap = await fetchTeamSnapshot(fav);
  const odds = await fetchEspnPlayoffOdds(fav, espnTeamId);

  // Schedule
  const upcoming: ScheduleGame[] = [];
  const recent: ScheduleGame[] = [];
  try {
    const sched = (await espnGet(`${fav.espnPath}/schedule`)) as {
      events?: {
        id?: string;
        date?: string;
        competitions?: EspnComp[];
      }[];
    };
    for (const ev of sched.events ?? []) {
      const chip = competitionChip(ev.competitions?.[0] ?? null, espnTeamId);
      if (!chip) continue;
      const row: ScheduleGame = {
        id: String(ev.id ?? `${ev.date}-${chip.label}`),
        when: fmtWhen(ev.date),
        label: chip.label,
        detail: chip.detail,
        status: chip.live ? "Live" : chip.won != null ? (chip.won ? "Win" : "Loss") : "Scheduled",
        won: chip.won,
        live: Boolean(chip.live),
      };
      const state = ev.competitions?.[0]?.status?.type?.state;
      const done = ev.competitions?.[0]?.status?.type?.completed || state === "post";
      if (done) recent.push(row);
      else upcoming.push(row);
    }
    recent.reverse();
  } catch {
    // optional
  }

  // Roster
  const roster: RosterPlayer[] = [];
  try {
    const raw = (await espnGet(`${fav.espnPath}/roster`)) as {
      athletes?: {
        position?: string;
        items?: {
          id?: string;
          displayName?: string;
          jersey?: string;
          position?: { abbreviation?: string };
        }[];
      }[];
    };
    for (const group of raw.athletes ?? []) {
      for (const a of group.items ?? []) {
        roster.push({
          id: String(a.id ?? a.displayName),
          name: a.displayName ?? "—",
          number: a.jersey ?? null,
          position: a.position?.abbreviation ?? group.position ?? null,
        });
      }
    }
  } catch {
    // optional
  }

  // Division standings from ESPN v2 when possible
  const division: StandingRow[] = [];
  try {
    const root = espnSportRoot(fav.espnPath);
    const res = await fetch(`https://site.api.espn.com/apis/v2/sports/${root}/standings`, {
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const d = (await res.json()) as {
        children?: {
          name?: string;
          standings?: {
            entries?: {
              team?: { id?: string; displayName?: string; shortDisplayName?: string };
              stats?: { name?: string; displayValue?: string }[];
            }[];
          };
        }[];
      };
      for (const child of d.children ?? []) {
        const entries = child.standings?.entries ?? [];
        const mine = entries.some((e) => String(e.team?.id) === String(espnTeamId));
        if (!mine) continue;
        for (const e of entries) {
          const stat = (n: string) => e.stats?.find((s) => s.name === n)?.displayValue ?? "";
          division.push({
            rank: stat("rank") || String(division.length + 1),
            team: e.team?.shortDisplayName || e.team?.displayName || "—",
            teamId: e.team?.id ? String(e.team.id) : null,
            record: stat("overall") || `${stat("wins")}-${stat("losses")}`,
            gb: stat("gamesBehind") || "—",
            pct: stat("winPercent") || "",
            isMe: String(e.team?.id) === String(espnTeamId),
          });
        }
        break;
      }
    }
  } catch {
    // optional
  }

  return {
    key: fav.key,
    name: snap.name,
    shortName: snap.shortName,
    logo: snap.logo,
    color: snap.color,
    record: snap.record,
    standing: odds.standing ?? snap.standing,
    playoffOdds: odds.playoff,
    wildCardOdds: odds.wildCard,
    manager: null,
    generalManager: null,
    division,
    upcoming: upcoming.slice(0, 12),
    recent: recent.slice(0, 8),
    roster,
    hittingLeaders: [],
    pitchingLeaders: [],
    teamHitting: [],
    teamPitching: [],
    source: "espn",
  };
}

async function fetchMlbTeamDetail(fav: SportsFavorite): Promise<TeamDetail> {
  const teamId = fav.mlbTeamId!;
  const season = currentSeason();
  const espnTeamId = fav.espnPath.split("/").pop() ?? "24";

  // Logo/color from ESPN (MLB API logos are less convenient).
  const snap = await fetchTeamSnapshot(fav).catch(() => null);
  const odds = await fetchEspnPlayoffOdds(fav, espnTeamId);

  const [
    standingsRaw,
    rosterRaw,
    scheduleRaw,
    hitTeam,
    pitchTeam,
    hitLeaders,
    pitchLeaders,
    manager,
    generalManager,
  ] = await Promise.all([
    mlbGet(
      `standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason&hydrate=division`,
    ),
    mlbGet(`teams/${teamId}/roster?rosterType=active`),
    mlbGet(
      `schedule?teamId=${teamId}&sportId=1&startDate=${season}-03-01&endDate=${season}-11-15&hydrate=probablePitcher,team`,
    ),
    mlbGet(`teams/${teamId}/stats?season=${season}&group=hitting&stats=season`),
    mlbGet(`teams/${teamId}/stats?season=${season}&group=pitching&stats=season`),
    mlbGet(
      `stats?stats=season&group=hitting&season=${season}&sportIds=1&teamIds=${teamId}&playerPool=all&limit=40&sortStat=ops&order=desc`,
    ),
    mlbGet(
      `stats?stats=season&group=pitching&season=${season}&sportIds=1&teamIds=${teamId}&playerPool=all&limit=40&sortStat=era&order=asc`,
    ),
    fetchMlbTeamManager(teamId).catch(() => null),
    fetchMlbTeamGeneralManager(teamId).catch(() => null),
  ]);

  // Division standings (NL Central)
  const division: StandingRow[] = [];
  let myRecord: string | null = snap?.record ?? null;
  let myStanding: string | null = snap?.standing ?? null;
  for (const block of (standingsRaw as { records?: unknown[] }).records ?? []) {
    const rec = block as {
      division?: { name?: string };
      teamRecords?: {
        team?: { id?: number; name?: string };
        wins?: number;
        losses?: number;
        divisionRank?: string;
        gamesBack?: string;
        winningPercentage?: string;
      }[];
    };
    const rows = rec.teamRecords ?? [];
    if (!rows.some((r) => r.team?.id === teamId)) continue;
    for (const r of rows) {
      const isMe = r.team?.id === teamId;
      if (isMe) {
        myRecord = `${r.wins}-${r.losses}`;
        myStanding = `${r.divisionRank}${ordinalSuffix(Number(r.divisionRank))} in ${shortDiv(rec.division?.name)}`;
      }
      division.push({
        rank: String(r.divisionRank ?? ""),
        team: (r.team?.name ?? "—").replace("St. Louis ", "").replace("Chicago ", "C. "),
        teamId: r.team?.id != null ? String(r.team.id) : null,
        record: `${r.wins}-${r.losses}`,
        gb: r.gamesBack === "0.0" || r.gamesBack === "-" ? "—" : String(r.gamesBack ?? "—"),
        pct: r.winningPercentage ?? "",
        isMe,
      });
    }
    break;
  }

  const roster: RosterPlayer[] = (
    (rosterRaw as { roster?: unknown[] }).roster ?? []
  ).map((p) => {
    const row = p as {
      person?: { id?: number; fullName?: string };
      jerseyNumber?: string;
      position?: { abbreviation?: string };
    };
    return {
      id: String(row.person?.id ?? row.person?.fullName),
      name: row.person?.fullName ?? "—",
      number: row.jerseyNumber ?? null,
      position: row.position?.abbreviation ?? null,
    };
  });

  const upcoming: ScheduleGame[] = [];
  const recent: ScheduleGame[] = [];
  for (const day of (scheduleRaw as { dates?: unknown[] }).dates ?? []) {
    const d = day as { date?: string; games?: unknown[] };
    for (const g of d.games ?? []) {
      const game = g as {
        gamePk?: number;
        gameDate?: string;
        status?: { detailedState?: string; abstractGameState?: string };
        teams?: {
          away?: {
            team?: { id?: number; name?: string };
            score?: number;
            isWinner?: boolean;
            probablePitcher?: { id?: number; fullName?: string; lastName?: string };
          };
          home?: {
            team?: { id?: number; name?: string };
            score?: number;
            isWinner?: boolean;
            probablePitcher?: { id?: number; fullName?: string; lastName?: string };
          };
        };
      };
      const home = game.teams?.home;
      const away = game.teams?.away;
      const meHome = home?.team?.id === teamId;
      const mine = meHome ? home : away;
      const opp = meHome ? away : home;
      const ha = meHome ? "vs" : "@";
      const oppName = (opp?.team?.name ?? "OPP")
        .replace("St. Louis ", "")
        .replace(/^(New York|Los Angeles|Chicago|Toronto|Kansas City|Tampa Bay|San Francisco|San Diego|Arizona) /, (m) => {
          const map: Record<string, string> = {
            "New York ": "NY ",
            "Los Angeles ": "LA ",
            "Chicago ": "C. ",
            "Toronto ": "Tor. ",
            "Kansas City ": "KC ",
            "Tampa Bay ": "TB ",
            "San Francisco ": "SF ",
            "San Diego ": "SD ",
            "Arizona ": "Ari. ",
          };
          return map[m] ?? m;
        });
      const state = game.status?.abstractGameState;
      const detailed = game.status?.detailedState ?? "";
      const live = state === "Live";
      const done = state === "Final";
      const label = `${ha} ${oppName}`;
      const detail =
        mine?.score != null && opp?.score != null ? `${mine.score}–${opp.score}` : null;
      const myPitcher =
        mine?.probablePitcher?.fullName ??
        mine?.probablePitcher?.lastName ??
        null;
      const oppPitcher =
        opp?.probablePitcher?.fullName ??
        opp?.probablePitcher?.lastName ??
        null;
      const myShort =
        mine?.probablePitcher?.lastName ||
        mine?.probablePitcher?.fullName?.split(" ").pop() ||
        null;
      const oppShort =
        opp?.probablePitcher?.lastName ||
        opp?.probablePitcher?.fullName?.split(" ").pop() ||
        null;
      const pitchers =
        !done && (myShort || oppShort)
          ? `${myShort ?? "TBD"} vs ${oppShort ?? "TBD"}`
          : null;
      const row: ScheduleGame = {
        id: String(game.gamePk ?? game.gameDate),
        when: fmtWhen(game.gameDate) ?? fmtDay(d.date),
        label,
        detail: live ? detailed : detail,
        status: live ? "Live" : done ? (mine?.isWinner ? "Win" : "Loss") : detailed || "Scheduled",
        won: done ? Boolean(mine?.isWinner) : null,
        live,
        pitchers,
        myPitcher: !done ? myPitcher : null,
        oppPitcher: !done ? oppPitcher : null,
        myPitcherId: !done ? mine?.probablePitcher?.id ?? null : null,
        oppPitcherId: !done ? opp?.probablePitcher?.id ?? null : null,
        opponentTeamId: opp?.team?.id ?? null,
      };
      if (done) recent.push(row);
      else upcoming.push(row);
    }
  }
  recent.reverse();

  const teamHitting = pickTeamStatLines(hitTeam, [
    ["runs", "R"],
    ["homeRuns", "HR"],
    ["avg", "AVG"],
    ["obp", "OBP"],
    ["slg", "SLG"],
    ["ops", "OPS"],
  ]);
  const teamPitching = pickTeamStatLines(pitchTeam, [
    ["era", "ERA"],
    ["whip", "WHIP"],
    ["strikeOuts", "SO"],
    ["saves", "SV"],
    ["wins", "W"],
    ["inningsPitched", "IP"],
  ]);

  const hittingLeaders = mlbLeaders(hitLeaders, (s) => {
    const ab = Number(s.atBats ?? 0);
    if (ab < 50) return null;
    return `${s.avg ?? "—"} AVG · ${s.homeRuns ?? 0} HR · ${s.ops ?? "—"} OPS`;
  }).slice(0, 6);

  const pitchingLeaders = mlbLeaders(pitchLeaders, (s) => {
    const ip = parseFloat(String(s.inningsPitched ?? 0));
    if (ip < 20) return null;
    return `${s.era ?? "—"} ERA · ${s.strikeOuts ?? 0} SO · ${s.inningsPitched ?? "—"} IP`;
  }).slice(0, 6);

  return {
    key: fav.key,
    name: snap?.name ?? fav.name,
    shortName: snap?.shortName ?? fav.shortName,
    logo: snap?.logo ?? null,
    color: snap?.color ?? fav.color ?? null,
    record: myRecord,
    standing: odds.standing ?? myStanding,
    playoffOdds: odds.playoff,
    wildCardOdds: odds.wildCard,
    manager: manager
      ? { id: manager.id, name: manager.name, title: manager.title }
      : null,
    generalManager: generalManager
      ? { name: generalManager.name, title: generalManager.title }
      : null,
    division,
    upcoming: upcoming.slice(0, 15),
    recent: recent.slice(0, 10),
    roster,
    hittingLeaders,
    pitchingLeaders,
    teamHitting,
    teamPitching,
    source: "mlb",
  };
}

function pickTeamStatLines(
  raw: unknown,
  keys: [string, string][],
): { label: string; value: string }[] {
  const splits =
    (raw as { stats?: { splits?: { stat?: Record<string, unknown> }[] }[] }).stats?.[0]?.splits ??
    [];
  const stat = splits[0]?.stat ?? {};
  return keys
    .filter(([k]) => stat[k] != null)
    .map(([k, label]) => ({ label, value: String(stat[k]) }));
}

function mlbLeaders(
  raw: unknown,
  line: (stat: Record<string, unknown>) => string | null,
): LeaderStat[] {
  const splits =
    (raw as {
      stats?: {
        splits?: { player?: { id?: number; fullName?: string }; stat?: Record<string, unknown> }[];
      }[];
    }).stats?.[0]?.splits ?? [];
  const out: LeaderStat[] = [];
  for (const s of splits) {
    const text = line(s.stat ?? {});
    if (!text) continue;
    out.push({
      id: s.player?.id != null ? String(s.player.id) : undefined,
      name: s.player?.fullName ?? "—",
      line: text,
    });
  }
  return out;
}

function shortDiv(name?: string): string {
  if (!name) return "division";
  return name
    .replace("National League ", "NL ")
    .replace("American League ", "AL ")
    .replace("Central", "Cent")
    .replace("East", "East")
    .replace("West", "West");
}

function ordinalSuffix(n: number): string {
  if (!Number.isFinite(n)) return "";
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

export async function fetchTeamDetail(fav: SportsFavorite): Promise<TeamDetail> {
  if (fav.mlbTeamId) return fetchMlbTeamDetail(fav);
  return fetchEspnTeamDetail(fav);
}

/** Seed the favorites table so the board has a durable home in Supabase. */
export async function ensureFavoriteTeamsSeeded(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("favorite_sports_teams")
    .select("id, team_name")
    .eq("user_id", userId);
  if (error) throw error;
  const have = new Set((data ?? []).map((r) => r.team_name.toLowerCase()));
  const missing = DEFAULT_FAVORITES.filter(
    (f) => f.kind === "team" && !have.has(f.name.toLowerCase()),
  );
  if (missing.length === 0) return;
  const { error: insErr } = await supabase.from("favorite_sports_teams").insert(
    missing.map((f) => ({
      user_id: userId,
      team_name: f.name,
      league: f.league,
      sport: f.sport,
    })),
  );
  if (insErr) throw insErr;
}
