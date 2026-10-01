/**
 * "Your players": every followed or tagged player, with the line from the
 * last game he played. MLB reads the Stats API game log (it ships a ready
 * summary such as "2-4 | HR, 3 RBI"); NFL, college football and the NHL read
 * ESPN's athlete game log.
 */

import { mlbHeadshotUrl } from "./newspaper-box.ts";

export type FollowedPlayer = {
  id: string;
  name: string;
  path: string;
  team: string | null;
  position: string | null;
  source: "favorite" | "tagged";
  /** MLB Stats API sport id; farm hands log games on their own level. */
  sportId?: number | null;
};

export type PlayerCell = { label: string; value: string };

export type PlayerNight = {
  player: FollowedPlayer;
  headshot: string | null;
  /** Edition-calendar day of the game (America/Chicago). */
  day: string | null;
  opponent: string | null;
  opponentLogo: string | null;
  homeAway: "vs" | "@" | null;
  result: string | null;
  line: string | null;
  cells: PlayerCell[];
  role: string | null;
};

const LEAGUE_PATHS: Record<string, string> = {
  mlb: "baseball/mlb",
  nfl: "football/nfl",
  cfb: "football/college-football",
  ncaaf: "football/college-football",
  nhl: "hockey/nhl",
};

export function playerPath(league: string | null | undefined, sport: string | null | undefined): string | null {
  const l = (league ?? "").toLowerCase();
  if (LEAGUE_PATHS[l]) return LEAGUE_PATHS[l];
  if ((sport ?? "").toLowerCase() === "baseball") return "baseball/mlb";
  return null;
}

export function playerPageHref(path: string, id: string): string | null {
  if (!id) return null;
  if (path === "baseball/mlb") return `/sports/mlb/player/${id}`;
  if (path === "football/nfl") return `/sports/nfl/player/${id}`;
  if (path === "football/college-football") return `/sports/cfb/player/${id}`;
  if (path === "hockey/nhl") return `/sports/nhl/player/${id}`;
  return null;
}

export function espnHeadshot(path: string, id: string): string | null {
  const slug = { "football/nfl": "nfl", "football/college-football": "college-football", "hockey/nhl": "nhl" }[path];
  if (!slug || !id) return null;
  return `https://a.espncdn.com/combiner/i?img=/i/headshots/${slug}/players/full/${id}.png&w=200&h=146`;
}

function chicagoDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso.length === 10 ? `${iso}T17:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type MlbSplit = {
  date?: string;
  isHome?: boolean;
  isWin?: boolean;
  opponent?: { id?: number; name?: string };
  stat?: Record<string, string | number>;
};

const MLB_HIT_CELLS: [string, string][] = [
  ["atBats", "AB"],
  ["runs", "R"],
  ["hits", "H"],
  ["homeRuns", "HR"],
  ["rbi", "RBI"],
  ["baseOnBalls", "BB"],
  ["strikeOuts", "K"],
  ["avg", "AVG"],
];
const MLB_PITCH_CELLS: [string, string][] = [
  ["inningsPitched", "IP"],
  ["hits", "H"],
  ["earnedRuns", "ER"],
  ["baseOnBalls", "BB"],
  ["strikeOuts", "K"],
  ["numberOfPitches", "P"],
  ["era", "ERA"],
];

async function mlbNight(player: FollowedPlayer, season: number): Promise<PlayerNight> {
  const sport = player.sportId && player.sportId !== 1 ? `&sportId=${player.sportId}` : "";
  const base = `https://statsapi.mlb.com/api/v1/people/${player.id}/stats?stats=gameLog&group=hitting,pitching&season=${season}${sport}`;
  const [regular, post] = await Promise.all([
    getJson<{ stats?: { group?: { displayName?: string }; splits?: MlbSplit[] }[] }>(base),
    sport ? Promise.resolve(null) : getJson<{ stats?: { group?: { displayName?: string }; splits?: MlbSplit[] }[] }>(`${base}&gameType=F,D,L,W`),
  ]);
  const all = [...(regular?.stats ?? []), ...(post?.stats ?? [])].flatMap((s) =>
    (s.splits ?? []).map((split) => ({ group: s.group?.displayName ?? "", split })),
  );
  const pitcher = /^(P|SP|RP|TWP)$/.test(player.position ?? "");
  all.sort(
    (a, b) =>
      String(b.split.date ?? "").localeCompare(String(a.split.date ?? "")) ||
      (pitcher ? (a.group === "pitching" ? -1 : 1) : a.group === "hitting" ? -1 : 1),
  );
  const last = all[0];
  const empty: PlayerNight = {
    player,
    headshot: mlbHeadshotUrl(player.id, 180),
    day: null,
    opponent: null,
    opponentLogo: null,
    homeAway: null,
    result: null,
    line: null,
    cells: [],
    role: null,
  };
  if (!last) return empty;
  const stat = last.split.stat ?? {};
  const spec = last.group === "pitching" ? MLB_PITCH_CELLS : MLB_HIT_CELLS;
  return {
    ...empty,
    day: chicagoDay(last.split.date),
    opponent: last.split.opponent?.name ?? null,
    opponentLogo: last.split.opponent?.id ? `https://www.mlbstatic.com/team-logos/${last.split.opponent.id}.svg` : null,
    homeAway: last.split.isHome ? "vs" : "@",
    result: last.split.isWin == null ? null : last.split.isWin ? "W" : "L",
    line: String(stat.summary ?? "").replace(/\s*\|\s*/g, ", ") || null,
    cells: spec.filter(([k]) => stat[k] != null).map(([k, label]) => ({ label, value: String(stat[k]) })),
    role: last.group === "pitching" ? "Pitching" : "Batting",
  };
}

type EspnLog = {
  names?: string[];
  labels?: string[];
  events?: Record<
    string,
    {
      gameDate?: string;
      atVs?: string;
      score?: string;
      gameResult?: string;
      opponent?: { displayName?: string; abbreviation?: string; logo?: string };
    }
  >;
  seasonTypes?: { categories?: { events?: { eventId?: string; stats?: string[] }[] }[] }[];
};

const NAMED: Record<string, (v: Record<string, string>) => string | null> = {
  pass: (v) =>
    Number(v.passingAttempts) > 0
      ? `${v.completions}/${v.passingAttempts}, ${v.passingYards} yds, ${v.passingTouchdowns} TD, ${v.interceptions} INT`
      : null,
  rush: (v) =>
    Number(v.rushingAttempts) > 0 ? `${v.rushingAttempts} car, ${v.rushingYards} yds${Number(v.rushingTouchdowns) ? `, ${v.rushingTouchdowns} TD` : ""}` : null,
  rec: (v) =>
    Number(v.receptions) > 0 ? `${v.receptions} rec, ${v.receivingYards} yds${Number(v.receivingTouchdowns) ? `, ${v.receivingTouchdowns} TD` : ""}` : null,
  tackles: (v) =>
    Number(v.totalTackles) > 0 ? `${v.totalTackles} tkl${Number(v.sacks) ? `, ${v.sacks} sk` : ""}` : null,
  kick: (v) => (Number(v.fieldGoalAttempts) > 0 ? `${v.fieldGoalsMade}/${v.fieldGoalAttempts} FG` : null),
  skater: (v) =>
    v.goals != null && v.assists != null ? `${v.goals} G, ${v.assists} A${v.shotsTotal ? `, ${v.shotsTotal} SOG` : ""}` : null,
  goalie: (v) => (v.saves != null ? `${v.saves} saves${v.goalsAgainst != null ? `, ${v.goalsAgainst} GA` : ""}` : null),
};

async function espnNight(player: FollowedPlayer): Promise<PlayerNight> {
  const data = await getJson<EspnLog>(
    `https://site.web.api.espn.com/apis/common/v3/sports/${player.path}/athletes/${player.id}/gamelog`,
  );
  const empty: PlayerNight = {
    player,
    headshot: espnHeadshot(player.path, player.id),
    day: null,
    opponent: null,
    opponentLogo: null,
    homeAway: null,
    result: null,
    line: null,
    cells: [],
    role: null,
  };
  if (!data?.events) return empty;
  const rows = (data.seasonTypes ?? []).flatMap((st) => (st.categories ?? []).flatMap((c) => c.events ?? []));
  const withDate = rows
    .map((r) => ({ row: r, ev: r.eventId ? data.events?.[r.eventId] : undefined }))
    .filter((r) => r.ev?.gameDate)
    .sort((a, b) => String(b.ev!.gameDate).localeCompare(String(a.ev!.gameDate)));
  const last = withDate[0];
  if (!last?.ev) return empty;
  const names = data.names ?? [];
  const labels = data.labels ?? [];
  const values: Record<string, string> = {};
  names.forEach((n, i) => {
    if (values[n] == null && last.row.stats?.[i] != null) values[n] = last.row.stats[i]!;
  });
  const line = Object.values(NAMED)
    .map((f) => f(values))
    .filter(Boolean)
    .slice(0, 2)
    .join("; ");
  const seen = new Set<string>();
  const cells: PlayerCell[] = [];
  labels.forEach((label, i) => {
    const value = last.row.stats?.[i];
    if (value == null || seen.has(label) || cells.length >= 8) return;
    seen.add(label);
    cells.push({ label, value });
  });
  const result = last.ev.gameResult ? `${last.ev.gameResult} ${last.ev.score ?? ""}`.trim() : null;
  return {
    ...empty,
    day: chicagoDay(last.ev.gameDate),
    opponent: last.ev.opponent?.displayName ?? last.ev.opponent?.abbreviation ?? null,
    opponentLogo: last.ev.opponent?.logo ?? null,
    homeAway: last.ev.atVs === "@" ? "@" : "vs",
    result,
    line: line || null,
    cells,
  };
}

export async function fetchPlayerNights(players: FollowedPlayer[], season: number): Promise<PlayerNight[]> {
  const out: PlayerNight[] = [];
  const queue = [...players];
  async function worker() {
    for (let p = queue.shift(); p; p = queue.shift()) {
      out.push(p.path === "baseball/mlb" ? await mlbNight(p, season) : await espnNight(p));
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  return out;
}

/** Played last night first, then the latest games, then the idle. */
export function rankNights(nights: PlayerNight[], newsDay: string): PlayerNight[] {
  return [...nights].sort((a, b) => {
    const ay = a.day === newsDay ? 1 : 0;
    const by = b.day === newsDay ? 1 : 0;
    if (ay !== by) return by - ay;
    return String(b.day ?? "").localeCompare(String(a.day ?? "")) || a.player.name.localeCompare(b.player.name);
  });
}
