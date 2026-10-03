/**
 * Pure parsers for CFB team pages: season rates, leaders, SOS, CFP, rivalries.
 * Numbers come from ESPN payloads — missing fields stay null.
 */

export type CfbSeasonStatLine = {
  ppg: string | null;
  oppPpg: string | null;
  ypg: string | null;
  oppYpg: string | null;
  gamesPlayed: number | null;
};

export type CfbLeaderKey = "pass" | "rush" | "rec";

export type CfbTeamLeaderChip = {
  key: CfbLeaderKey;
  label: string;
  athleteId: string | null;
  name: string;
  headshot: string | null;
  position: string | null;
  line: string;
};

export type CfbFormMark = "W" | "L" | "T";

export type CfbGameWrapLeader = {
  key: CfbLeaderKey;
  name: string;
  athleteId: string | null;
  line: string;
};

export type CfbGameWrapPlay = {
  id: string;
  text: string;
  teamId: string | null;
  teamAbbrev: string | null;
  quarter: string | null;
  clock: string | null;
};

export type CfbGameWrap = {
  leaders: CfbGameWrapLeader[];
  plays: CfbGameWrapPlay[];
  yards: string | null;
  oppYards: string | null;
};

type StatNode = {
  name?: string;
  displayValue?: string;
  value?: number;
};

type StatCategory = {
  name?: string;
  stats?: StatNode[];
};

const LEADER_SPECS: { name: string; key: CfbLeaderKey; label: string }[] = [
  { name: "passingLeader", key: "pass", label: "Pass" },
  { name: "rushingLeader", key: "rush", label: "Rush" },
  { name: "receivingLeader", key: "rec", label: "Rec" },
];

const WRAP_LEADER_SPECS: { name: string; key: CfbLeaderKey }[] = [
  { name: "passingYards", key: "pass" },
  { name: "rushingYards", key: "rush" },
  { name: "receivingYards", key: "rec" },
];

/** Famous series. Key is the two ESPN team ids, lower first. */
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

function rivalryKey(a: string | number, b: string | number): string {
  const left = Number(a);
  const right = Number(b);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return "";
  return left < right ? `${left}-${right}` : `${right}-${left}`;
}

export function cfbRivalryName(
  teamId: string | number,
  oppId: string | number | null | undefined,
): string | null {
  if (oppId == null || oppId === "") return null;
  return RIVALRIES[rivalryKey(teamId, oppId)] ?? null;
}

export function cfbResultsFromFinals(
  games: { final: boolean; won: boolean | null }[],
): CfbFormMark[] {
  const marks: CfbFormMark[] = [];
  for (const g of games) {
    if (!g.final) continue;
    if (g.won === true) marks.push("W");
    else if (g.won === false) marks.push("L");
    else marks.push("T");
  }
  return marks;
}

/** ESPN-style streak from the end of the result list, e.g. L1 or W3. Ties break it. */
export function cfbStreakLabel(marks: CfbFormMark[]): string | null {
  if (!marks.length) return null;
  const last = marks[marks.length - 1];
  if (!last || last === "T") return null;
  let n = 0;
  for (let i = marks.length - 1; i >= 0; i--) {
    if (marks[i] !== last) break;
    n += 1;
  }
  return n > 0 ? `${last}${n}` : null;
}

function findStat(
  cats: StatCategory[] | undefined,
  category: string,
  stat: string,
): StatNode | null {
  const cat = (cats ?? []).find((c) => (c.name ?? "").toLowerCase() === category.toLowerCase());
  const node = (cat?.stats ?? []).find((s) => (s.name ?? "").toLowerCase() === stat.toLowerCase());
  return node ?? null;
}

function statNumber(node: StatNode | null): number | null {
  if (!node) return null;
  if (typeof node.value === "number" && Number.isFinite(node.value)) return node.value;
  if (typeof node.displayValue === "string" && node.displayValue.trim()) {
    const n = Number(node.displayValue.replace(/,/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function statText(node: StatNode | null): string | null {
  if (!node) return null;
  const text = node.displayValue?.trim();
  return text ? text : null;
}

function perGame(total: number | null, games: number | null): string | null {
  if (total == null || games == null || games <= 0) return null;
  return (total / games).toFixed(1);
}

export function parseCfbSeasonStats(results: {
  stats?: { categories?: StatCategory[] };
  opponent?: StatCategory[];
} | null): CfbSeasonStatLine {
  const empty: CfbSeasonStatLine = {
    ppg: null,
    oppPpg: null,
    ypg: null,
    oppYpg: null,
    gamesPlayed: null,
  };
  if (!results) return empty;
  const off = results.stats?.categories;
  const def = results.opponent;
  const games = statNumber(findStat(off, "general", "gamesPlayed"));
  const ppg =
    statText(findStat(off, "scoring", "totalPointsPerGame")) ??
    perGame(statNumber(findStat(off, "scoring", "totalPoints")), games);
  const oppPpg =
    statText(findStat(def, "scoring", "totalPointsPerGame")) ??
    perGame(statNumber(findStat(def, "scoring", "totalPoints")), games);
  const ypg =
    perGame(statNumber(findStat(off, "rushing", "totalYards")), games) ??
    statText(findStat(off, "passing", "yardsPerGame"));
  const oppYpg =
    perGame(statNumber(findStat(def, "rushing", "totalYards")), games) ??
    statText(findStat(def, "passing", "yardsPerGame"));
  return {
    ppg,
    oppPpg,
    ypg,
    oppYpg,
    gamesPlayed: games,
  };
}

type LeaderAthlete = {
  id?: string | number;
  displayName?: string;
  headshot?: { href?: string };
  position?: { abbreviation?: string };
};

type LeaderRow = {
  displayValue?: string;
  athlete?: LeaderAthlete;
  team?: { id?: string | number };
};

export function parseCfbTeamLeaders(
  raw: {
    leaders?: {
      categories?: { name?: string; leaders?: LeaderRow[] }[];
    };
  } | null,
  teamId: string,
): CfbTeamLeaderChip[] {
  if (!raw) return [];
  const want = teamId.trim();
  const out: CfbTeamLeaderChip[] = [];
  const categories = raw.leaders?.categories ?? [];
  for (const spec of LEADER_SPECS) {
    const cat = categories.find((c) => c.name === spec.name);
    const row = (cat?.leaders ?? []).find((r) => String(r.team?.id ?? "") === want);
    const athlete = row?.athlete;
    const line = row?.displayValue?.trim();
    if (!athlete?.displayName || !line) continue;
    out.push({
      key: spec.key,
      label: spec.label,
      athleteId: athlete.id != null ? String(athlete.id) : null,
      name: athlete.displayName,
      headshot: athlete.headshot?.href ?? null,
      position: athlete.position?.abbreviation ?? null,
      line,
    });
  }
  return out;
}

export function powerIndexStatIndex(
  categories: { name?: string; names?: string[] }[] | undefined,
  category: string,
  stat: string,
): number {
  const cat = (categories ?? []).find((c) => c.name === category);
  const idx = (cat?.names ?? []).indexOf(stat);
  return idx;
}

export function readRankValue(values: unknown[] | undefined, index: number): number | null {
  if (index < 0 || !values) return null;
  const raw = values[index];
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return null;
  return Math.round(raw);
}

function teamIdFromRef(team: { id?: string | number; $ref?: string } | undefined): number | null {
  if (!team) return null;
  if (team.id != null && String(team.id).trim()) {
    const n = Number(team.id);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const match = String(team.$ref ?? "").match(/\/teams\/(\d+)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

/** Latest CFP committee week. Ignores AP and other polls. */
export function parseCfbCfpWeekRanks(raw: {
  type?: string;
  ranks?: { current?: number; team?: { id?: string | number; $ref?: string } }[];
} | null): Map<number, number> {
  const map = new Map<number, number>();
  if (!raw) return map;
  if (raw.type && raw.type !== "cfp") return map;
  for (const row of raw.ranks ?? []) {
    const id = teamIdFromRef(row.team);
    const rank = row.current;
    if (!id || typeof rank !== "number" || rank < 1 || rank > 25) continue;
    map.set(id, rank);
  }
  return map;
}

/** Latest week $ref on the CFP ranking resource (rankings/21). */
export function latestCfpWeekRef(
  indexItems: { $ref?: string }[] | undefined,
  rankingMeta: { type?: string; rankings?: { $ref?: string }[] } | null,
): string | null {
  const listed = (indexItems ?? []).some((item) => /\/rankings\/21(?:\?|$)/.test(item.$ref ?? ""));
  if (!listed && rankingMeta?.type !== "cfp") return null;
  if (rankingMeta?.type && rankingMeta.type !== "cfp") return null;
  const weeks = rankingMeta?.rankings ?? [];
  const last = weeks[weeks.length - 1]?.$ref;
  return last?.trim() ? last : null;
}

function simplifyPlay(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function mapCfbGameWrap(
  raw: {
    leaders?: {
      team?: { id?: string | number };
      leaders?: {
        name?: string;
        leaders?: {
          displayValue?: string;
          athlete?: { id?: string | number; displayName?: string };
        }[];
      }[];
    }[];
    scoringPlays?: {
      id?: string | number;
      text?: string;
      period?: { number?: number };
      clock?: { displayValue?: string };
      team?: { id?: string | number; abbreviation?: string };
    }[];
    boxscore?: {
      teams?: {
        team?: { id?: string | number; abbreviation?: string };
        statistics?: { name?: string; label?: string; displayValue?: string }[];
      }[];
    };
  } | null,
  teamId: string,
): CfbGameWrap {
  const empty: CfbGameWrap = { leaders: [], plays: [], yards: null, oppYards: null };
  if (!raw) return empty;
  const want = String(teamId);
  const block = (raw.leaders ?? []).find((b) => String(b.team?.id ?? "") === want);
  const leaders: CfbGameWrapLeader[] = [];
  for (const spec of WRAP_LEADER_SPECS) {
    const cat = (block?.leaders ?? []).find((c) => c.name === spec.name);
    const top = cat?.leaders?.[0];
    const name = top?.athlete?.displayName?.trim();
    const line = top?.displayValue?.trim();
    if (!name || !line) continue;
    leaders.push({
      key: spec.key,
      name,
      athleteId: top?.athlete?.id != null ? String(top.athlete.id) : null,
      line,
    });
  }

  const plays: CfbGameWrapPlay[] = [];
  for (const play of raw.scoringPlays ?? []) {
    const text = simplifyPlay(play.text ?? "");
    if (!text) continue;
    const quarterN = play.period?.number;
    plays.push({
      id: play.id != null ? String(play.id) : `${plays.length}`,
      text,
      teamId: play.team?.id != null ? String(play.team.id) : null,
      teamAbbrev: play.team?.abbreviation?.toUpperCase() ?? null,
      quarter: quarterN != null ? (quarterN > 4 ? `OT${quarterN - 4}` : `Q${quarterN}`) : null,
      clock: play.clock?.displayValue ?? null,
    });
  }

  let yards: string | null = null;
  let oppYards: string | null = null;
  for (const side of raw.boxscore?.teams ?? []) {
    const stat = (side.statistics ?? []).find((s) => {
      const name = (s.name ?? "").toLowerCase();
      const label = (s.label ?? "").toLowerCase();
      return name === "totalyards" || label === "total yards";
    });
    const value = stat?.displayValue?.trim();
    if (!value) continue;
    if (String(side.team?.id ?? "") === want) yards = value;
    else oppYards = value;
  }

  const shown = plays.length > 5 ? plays.slice(-5) : plays;
  return { leaders, plays: shown, yards, oppYards };
}
