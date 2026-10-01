/**
 * The club's season sheet for ESPN leagues: team numbers and the leader in
 * each category, with names and headshots from the roster.
 */

export type SheetLeader = {
  category: string;
  id: string;
  name: string;
  position: string | null;
  headshot: string | null;
  line: string;
};

export type ClubSheet = {
  season: string;
  stats: { label: string; value: string }[];
  leaders: SheetLeader[];
};

const SITE = "https://site.web.api.espn.com/apis/site/v2/sports";
const CORE = "https://sports.core.api.espn.com/v2/sports";

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const STAT_PICKS: Record<string, [string, string, string][]> = {
  football: [
    ["scoring", "totalPointsPerGame", "Pts/G"],
    ["passing", "yardsPerGame", "Yds/G"],
    ["passing", "passingYardsPerGame", "Pass/G"],
    ["rushing", "rushingYardsPerGame", "Rush/G"],
    ["miscellaneous", "thirdDownConvPct", "3rd %"],
    ["miscellaneous", "redzoneTouchdownPct", "RZ TD %"],
    ["defensive", "sacks", "Sacks"],
    ["miscellaneous", "turnOverDifferential", "TO +/-"],
  ],
  hockey: [
    ["offensive", "goals", "Goals"],
    ["defensive", "avgGoalsAgainst", "GA/G"],
    ["offensive", "shotsTotal", "Shots"],
    ["offensive", "shootingPct", "Sh %"],
    ["defensive", "savePct", "Sv %"],
    ["offensive", "powerPlayGoals", "PPG"],
    ["offensive", "faceoffPercent", "FO %"],
    ["penalties", "penaltyMinutes", "PIM"],
  ],
};

const CATEGORY_LABELS: Record<string, string> = {
  passingLeader: "Passing",
  rushingLeader: "Rushing",
  receivingLeader: "Receiving",
  totalTackles: "Tackles",
  sacks: "Sacks",
  interceptions: "Interceptions",
  goals: "Goals",
  assists: "Assists",
  points: "Points",
  plusMinus: "Plus/minus",
  avgGoalsAgainst: "Goals-against avg.",
  savePct: "Save pct.",
  wins: "Wins",
};

const SKIP_CATEGORIES =
  /^(passingYards|rushingYards|receivingYards|passingTouchdowns|rushingTouchdowns|receivingTouchdowns|receptions|quarterbackRating|penaltyMinutes|plusMinus|shutouts)$/;

type RosterAthlete = {
  id?: string;
  displayName?: string;
  headshot?: { href?: string };
  position?: { abbreviation?: string };
};

function rosterMap(data: { athletes?: unknown[] } | null): Map<string, RosterAthlete> {
  const out = new Map<string, RosterAthlete>();
  for (const entry of data?.athletes ?? []) {
    const group = entry as { items?: RosterAthlete[] } & RosterAthlete;
    for (const a of group.items ?? [group]) if (a.id) out.set(String(a.id), a);
  }
  return out;
}

type CoreLeaders = {
  categories?: {
    name?: string;
    displayName?: string;
    abbreviation?: string;
    leaders?: { displayValue?: string; athlete?: { $ref?: string } }[];
  }[];
};

/** ESPN files the NHL season under the year it ends; football under the year it starts. */
function seasonsToTry(sport: string, day: string): number[] {
  const [y, m] = day.split("-").map(Number) as [number, number];
  if (sport === "hockey") {
    const s = m >= 7 ? y + 1 : y;
    return [s, s - 1];
  }
  const s = m >= 3 ? y : y - 1;
  return [s, s - 1];
}

function seasonLabel(sport: string, season: number): string {
  return sport === "hockey" ? `${season - 1}-${String(season).slice(2)}` : String(season);
}

export async function fetchClubSheet(espnPath: string, day: string): Promise<ClubSheet | null> {
  const m = espnPath.match(/^([a-z]+)\/([a-z-]+)\/teams\/(\d+)/);
  if (!m) return null;
  const [, sport, league, teamId] = m as unknown as [string, string, string, string];
  if (!STAT_PICKS[sport]) return null;
  const [statsRaw, roster] = await Promise.all([
    getJson<{ results?: { stats?: { categories?: { name?: string; stats?: { name?: string; displayValue?: string }[] }[] } } }>(
      `${SITE}/${sport}/${league}/teams/${teamId}/statistics`,
    ),
    getJson<{ athletes?: unknown[] }>(`${SITE}/${sport}/${league}/teams/${teamId}/roster`),
  ]);
  let leadersRaw: CoreLeaders | null = null;
  let season = 0;
  for (const s of seasonsToTry(sport, day)) {
    leadersRaw = await getJson<CoreLeaders>(`${CORE}/${sport}/leagues/${league}/seasons/${s}/types/2/teams/${teamId}/leaders`);
    if (leadersRaw?.categories?.some((c) => c.leaders?.length)) {
      season = s;
      break;
    }
  }
  const cats = statsRaw?.results?.stats?.categories ?? [];
  const stats = STAT_PICKS[sport]!
    .map(([cat, name, label]) => {
      const v = cats.find((c) => c.name === cat)?.stats?.find((s) => s.name === name)?.displayValue;
      return v != null && v !== "" ? { label, value: v } : null;
    })
    .filter((s): s is { label: string; value: string } => Boolean(s));
  const people = rosterMap(roster);
  const leaders: SheetLeader[] = [];
  const seen = new Set<string>();
  for (const c of leadersRaw?.categories ?? []) {
    if (!c.name || SKIP_CATEGORIES.test(c.name) || seen.has(c.name)) continue;
    const top = c.leaders?.[0];
    const id = top?.athlete?.$ref?.match(/athletes\/(\d+)/)?.[1];
    const who = id ? people.get(id) : undefined;
    if (!id || !who?.displayName || !top?.displayValue) continue;
    seen.add(c.name);
    leaders.push({
      category: CATEGORY_LABELS[c.name] ?? c.displayName?.replace(/\s*Leader$/i, "") ?? c.name,
      id,
      name: who.displayName,
      position: who.position?.abbreviation ?? null,
      headshot: who.headshot?.href ?? null,
      line: /^[\d.+-]+$/.test(top.displayValue) ? `${top.displayValue} ${c.abbreviation ?? ""}`.trim() : top.displayValue,
    });
    if (leaders.length >= 6) break;
  }
  if (!stats.length && !leaders.length) return null;
  return { season: season ? seasonLabel(sport, season) : "", stats, leaders };
}
