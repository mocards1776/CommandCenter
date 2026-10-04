/**
 * Division / conference tables for the finals graphic.
 *
 * ESPN v2 standings (`…/standings?level=3`) is the same tree the sports app
 * and newspaper already walk. This module only picks the smallest group that
 * contains each club — AFC North, NL Central, Big Ten — and never throws.
 */
export const STANDINGS_PATH: Record<string, string> = {
  nfl: "football/nfl",
  cfb: "football/college-football",
  mlb: "baseball/mlb",
  nhl: "hockey/nhl",
};

export type StandingRow = {
  teamId: string;
  abbrev: string;
  name: string;
  record: string;
  extra: string;
  rank: number;
};

export type StandingTable = {
  title: string;
  extraLabel: string;
  rows: StandingRow[];
  /** Clubs in the full group before a long conference was trimmed. */
  total: number;
};

type Rec = Record<string, unknown>;

function rec(value: unknown): Rec {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Rec) : {};
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function stat(stats: unknown[], ...names: string[]): string {
  const want = names.map((name) => name.toLowerCase());
  for (const row of stats) {
    const item = rec(row);
    const keys = [str(item.name), str(item.abbreviation), str(item.type)].map((key) => key.toLowerCase());
    if (keys.some((key) => want.includes(key))) {
      const shown = str(item.displayValue) || str(item.summary);
      if (shown && shown !== "—") return shown;
    }
  }
  return "";
}

export function shortGroupTitle(name: string): string {
  return name
    .replace(/^\d{4}(-\d{2})?\s+/, "")
    .replace(/\bAmerican Football Conference\b/i, "AFC")
    .replace(/\bNational Football Conference\b/i, "NFC")
    .replace(/\bAmerican League\b/i, "AL")
    .replace(/\bNational League\b/i, "NL")
    .replace(/\bEastern Conference\b/i, "East")
    .replace(/\bWestern Conference\b/i, "West")
    .replace(/\bSoutheastern Conference\b/i, "SEC")
    .replace(/\bAtlantic Coast Conference\b/i, "ACC")
    .replace(/\bConference USA\b/i, "C-USA")
    .replace(/\bAmerican Conference\b/i, "American")
    .replace(/\bMid-American Conference\b/i, "MAC")
    .replace(/\bMountain West Conference\b/i, "MW")
    .replace(/\bSun Belt Conference\b/i, "Sun Belt")
    .replace(/\bFBS Independents\b/i, "Independents")
    .replace(/\bConference\b/g, "")
    .replace(/\bDivision\b/g, "")
    .replace(/\s{2,}/g, " ")
    .trim() || name;
}

function extraLabelFor(sport: string): string {
  if (sport === "nhl") return "PTS";
  if (sport === "cfb") return "CONF";
  return "GB";
}

function rowFromEntry(sport: string, entry: Rec): StandingRow | null {
  const team = rec(entry.team);
  const id = str(team.id);
  const abbrev = str(team.abbreviation).toUpperCase();
  if (!id && !abbrev) return null;
  const stats = arr(entry.stats);
  const overall = stat(stats, "overall", "total");
  const wins = stat(stats, "wins", "w");
  const losses = stat(stats, "losses", "l");
  const otl = stat(stats, "otLosses", "overtimeLosses", "OTL");
  let record = overall.replace(/,.*$/, "").trim();
  if (sport === "nhl") {
    record = wins && losses ? `${wins}-${losses}-${otl || "0"}` : record;
  } else if (!record && wins && losses) {
    record = `${wins}-${losses}`;
  }
  if (!record) record = "—";
  let extra = "";
  if (sport === "nhl") extra = stat(stats, "points", "PTS");
  else if (sport === "cfb") extra = stat(stats, "vs. Conf.", "vs Conf", "CONF", "vs. Conf");
  else extra = stat(stats, "gamesBehind", "GB", "divisionGamesBehind");
  if (extra === "-" || extra === "—") extra = "–";
  return {
    teamId: id,
    abbrev: abbrev || "—",
    name: str(team.shortDisplayName) || str(team.displayName) || abbrev || "Team",
    record,
    extra,
    rank: 0,
  };
}

type Group = { title: string; rows: StandingRow[] };

function collectGroups(node: unknown, sport: string, out: Group[]): void {
  const body = rec(node);
  const title = str(body.name) || str(body.shortName) || str(body.abbreviation) || "Standings";
  const rows = arr(rec(body.standings).entries)
    .map((entry) => rowFromEntry(sport, rec(entry)))
    .filter((row): row is StandingRow => Boolean(row));
  if (rows.length) {
    out.push({
      title,
      rows: rows.map((row, i) => ({ ...row, rank: i + 1 })),
    });
  }
  for (const child of arr(body.children)) collectGroups(child, sport, out);
}

function sameTeam(row: StandingRow, teamId: string, abbrev: string): boolean {
  if (teamId && row.teamId && teamId === row.teamId) return true;
  return Boolean(abbrev) && row.abbrev.toUpperCase() === abbrev.toUpperCase();
}

function groupHas(group: Group, teamId: string, abbrev: string): boolean {
  return group.rows.some((row) => sameTeam(row, teamId, abbrev));
}

/** Keep both clubs and the teams around them when a conference is too long. */
export function windowRows(rows: StandingRow[], focus: StandingRow["teamId"][], max: number): StandingRow[] {
  if (rows.length <= max) return rows;
  const hits = focus
    .map((id) => rows.findIndex((row) => row.teamId === id || row.abbrev === id))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b);
  if (!hits.length) return rows.slice(0, max);
  if (hits.length === 1 || hits[hits.length - 1]! - hits[0]! + 1 <= max) {
    const mid = hits.length === 1 ? hits[0]! : Math.floor((hits[0]! + hits[hits.length - 1]!) / 2);
    let start = Math.max(0, mid - Math.floor(max / 2));
    start = Math.min(start, rows.length - max);
    return rows.slice(start, start + max);
  }
  const half = Math.max(3, Math.floor(max / 2));
  const left = rows.slice(Math.max(0, hits[0]! - 1), Math.max(0, hits[0]! - 1) + half);
  const rightStart = Math.min(rows.length - (max - left.length), hits[hits.length - 1]! - 1);
  const right = rows.slice(Math.max(0, rightStart), Math.max(0, rightStart) + (max - left.length));
  const seen = new Set<string>();
  return [...left, ...right].filter((row) => {
    const key = row.teamId || row.abbrev;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function tablesFromStandings(
  sport: string,
  raw: unknown,
  away: { teamId: string; abbrev: string },
  home: { teamId: string; abbrev: string },
  maxRows = 8,
): StandingTable[] {
  const groups: Group[] = [];
  collectGroups(raw, sport, groups);
  const awayGroups = groups.filter((group) => groupHas(group, away.teamId, away.abbrev));
  const homeGroups = groups.filter((group) => groupHas(group, home.teamId, home.abbrev));
  // Smallest table that still names the club (division over conference over league).
  awayGroups.sort((a, b) => a.rows.length - b.rows.length);
  homeGroups.sort((a, b) => a.rows.length - b.rows.length);
  const picked: Group[] = [];
  if (awayGroups[0]) picked.push(awayGroups[0]);
  const homeGroup = homeGroups[0];
  if (homeGroup && !picked.some((group) => group.title === homeGroup.title && group.rows.length === homeGroup.rows.length)) {
    picked.push(homeGroup);
  }
  const extraLabel = extraLabelFor(sport);
  const cap = picked.length > 1 ? Math.min(5, maxRows) : maxRows;
  return picked.map((group) => {
    const focus = [away.teamId, home.teamId, away.abbrev, home.abbrev].filter(Boolean);
    const rows = windowRows(group.rows, focus, cap);
    return {
      title: shortGroupTitle(group.title),
      extraLabel,
      rows,
      total: group.rows.length,
    };
  });
}

function nhlSeasonYear(d = new Date()): number {
  const y = d.getFullYear();
  return d.getMonth() >= 8 ? y + 1 : y;
}

async function fetchJson(url: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "CommandCenterSportsFinals" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchStandingsTree(sport: string): Promise<unknown | null> {
  const path = STANDINGS_PATH[sport];
  if (!path) return null;
  const query = sport === "nhl" ? `level=3&season=${nhlSeasonYear()}` : "level=3";
  const hosts = [
    "https://site.web.api.espn.com/apis/v2/sports",
    "https://site.api.espn.com/apis/v2/sports",
  ];
  for (const host of hosts) {
    const data = await fetchJson(`${host}/${path}/standings?${query}`);
    if (data) return data;
  }
  return null;
}

export async function loadCardStandings(
  sport: string,
  away: { teamId: string; abbrev: string },
  home: { teamId: string; abbrev: string },
): Promise<StandingTable[]> {
  const tree = await fetchStandingsTree(sport);
  if (!tree) return [];
  try {
    return tablesFromStandings(sport, tree, away, home);
  } catch {
    return [];
  }
}
