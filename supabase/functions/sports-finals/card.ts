/**
 * Post-game card model from an ESPN summary.
 *
 * Same feed the NFL and CFB game pages use (`summary?event=`). The graphic
 * keeps the page's final score, records, linescore, team stats, box leaders,
 * win-probability series, and each club's division or conference table.
 * It does not include the live field.
 */
import {
  fetchNhlThreeStarsWithRetry,
  starLine,
  type NhlLandingStar,
} from "./nhl-stars.ts";
import { oddsFromSummary, type FinalOdds } from "./odds.ts";
import { mapMlbWinProbability, mlbPlayRefs } from "./mlb-win-probability.ts";
import { mlbPlayoffFromSummary, type SeriesGame } from "./series.ts";
import { loadCardStandings, type StandingTable } from "./standings.ts";
import {
  mapCfbWinProbability,
  type CfbWinProbPlayRef,
  type CfbWinProbPoint,
} from "./win-probability.ts";

export const SUMMARY_PATH: Record<string, string> = {
  nfl: "football/nfl",
  cfb: "football/college-football",
  mlb: "baseball/mlb",
  nhl: "hockey/nhl",
};

const STAT_PREFERENCE = [
  "Total Yards",
  "Passing",
  "Rushing",
  "1st Downs",
  "3rd down efficiency",
  "Turnovers",
  "Possession",
  "Yards per Play",
  "Sacks-Yards Lost",
  "Penalties",
  "Red Zone (Made-Att)",
  "4th down efficiency",
];

const GROUP_PREFERENCE = ["passing", "rushing", "receiving", "kicking", "defense", "defensive"];

const LEADER_COLS: Record<string, string[]> = {
  passing: ["C/ATT", "YDS", "TD", "INT"],
  rushing: ["CAR", "YDS", "TD", "LONG"],
  receiving: ["REC", "YDS", "TD", "TGTS"],
  kicking: ["FG", "PCT", "LONG", "PTS"],
  defense: ["TOT", "SACKS", "TFL", "PD"],
  defensive: ["TOT", "SACKS", "TFL", "PD"],
};

const SPORT_LABEL: Record<string, string> = {
  nfl: "NFL",
  cfb: "College football",
  mlb: "MLB",
  nhl: "NHL",
};

export type FinalSide = {
  teamId: string;
  abbrev: string;
  name: string;
  record: string | null;
  score: number | null;
  color: string;
  alternateColor: string | null;
  logoUrl: string | null;
  logoData: string | null;
  linescores: (number | null)[];
  rank: number | null;
  /** MLB R-H-E. Null for other sports. */
  hits: number | null;
  errors: number | null;
};

export type FinalStat = {
  label: string;
  away: string;
  home: string;
  awayLeads: boolean;
  homeLeads: boolean;
  /** Away share of the bar, 0–100. Null when the values are not numeric. */
  awayShare: number | null;
};

export type FinalLeader = {
  group: string;
  groupLabel: string;
  teamAbbrev: string;
  name: string;
  line: string;
  /** Caption-only sentence. The graphic still draws `line`. */
  highlight?: string | null;
  highlightScore?: number;
  photoUrl?: string | null;
  photoData?: string | null;
};

export type FinalStar = {
  star: 1 | 2 | 3;
  name: string;
  teamAbbrev: string;
  line: string;
  position: string | null;
  sweaterNo: string | null;
  goals: number | null;
  assists: number | null;
  points: number | null;
  savePctg: number | null;
  gaa: number | null;
  photoUrl: string | null;
  photoData: string | null;
};

export type FinalPlayer = {
  name: string;
  teamAbbrev: string;
  line: string;
  photoUrl: string | null;
  photoData: string | null;
};

export type MlbBoxRow = {
  name: string;
  pos: string;
  cells: string[];
  photoUrl?: string | null;
  note?: string | null;
  record?: string | null;
};

export type MlbDecision = {
  role: "W" | "L" | "S";
  name: string;
  teamAbbrev: string;
  record: string | null;
  line: string;
  photoUrl: string | null;
  photoData: string | null;
};

export type MlbBoxSide = {
  abbrev: string;
  labels: string[];
  rows: MlbBoxRow[];
};

export type MlbBox = {
  batting: { away: MlbBoxSide; home: MlbBoxSide };
  pitching: { away: MlbBoxSide; home: MlbBoxSide };
};

export type FinalCard = {
  sport: string;
  sportLabel: string;
  eventId: string;
  statusLabel: string;
  final: boolean;
  /** MLB postseason only. Regular-season cards stay false. */
  playoff: boolean;
  /** ESPN series copy, e.g. "MIL leads series 2-0 · Game 2 of 5". */
  seriesLine: string | null;
  /** Standing only, e.g. "MIL leads series 2-0". */
  seriesStanding: string | null;
  /** "Best of 5" / "Best of 7" from ESPN totalCompetitions. */
  seriesBestOf: string | null;
  /** "Game 2 of 5" when ESPN has a game number. */
  seriesGameLabel: string | null;
  /** Playoff series games (completed + upcoming) from ESPN seasonseries. */
  seriesGames: SeriesGame[];
  venue: string | null;
  headline: string | null;
  away: FinalSide;
  home: FinalSide;
  periods: string[];
  stats: FinalStat[];
  leaders: FinalLeader[];
  /** Official NHL Three Stars. Empty until NHL.com posts them. */
  threeStars: FinalStar[];
  goalies: FinalPlayer[];
  /** MLB batting + pitching lines. Null for other sports. */
  mlbBox: MlbBox | null;
  winProbability: CfbWinProbPoint[];
  /** Division / conference tables for the two clubs. Empty when ESPN has none. */
  standings: StandingTable[];
  /** Kickoff (or game) ISO from ESPN. Null when the summary omits it. */
  date: string | null;
  /** Pregame spread / ML from ESPN pickcenter. Null when ESPN has no line. */
  odds: FinalOdds | null;
  /** ISO when the alert graphic is rendered / sent. Footer uses this, not kickoff. */
  sentAt: string | null;
  /** "Game 1 of 2" among this league’s games that Chicago calendar day. */
  daySlot: string | null;
  attendance: number | null;
  duration: string | null;
  weather: string | null;
  /** MLB official pitcher decisions. Empty for other sports. */
  mlbDecisions: MlbDecision[];
  path: string;
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

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

export function gamePath(sport: string, eventId: string): string {
  switch (sport) {
    case "mlb":
      return `/sports/mlb/game/${eventId}?solo=1`;
    case "nfl":
      return `/sports/nfl/game/${eventId}?solo=1`;
    case "nhl":
      return `/sports/nhl/game/${eventId}?solo=1`;
    case "cfb":
      return `/sports/cfb/game/${eventId}?solo=1`;
    case "soccer":
      return `/sports/soccer/game/${eventId}?solo=1`;
    default:
      return "/sports?solo=1";
  }
}

const CHICAGO = "America/Chicago";

/** Chicago stamp for an ISO instant. Used for send time (footer) or any clock. */
export function formatFinalsTimestamp(iso: string | null | undefined, fallback: Date = new Date()): string {
  const parsed = iso ? new Date(iso) : null;
  const date = parsed && !Number.isNaN(parsed.getTime()) ? parsed : fallback;
  const stamped = date.toLocaleString("en-US", {
    timeZone: CHICAGO,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  return stamped.replace(/\sC[DS]T$/, " CT");
}

/** Kickoff / first pitch for the venue strip — not the alert footer. */
export function formatGameStart(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const day = date.toLocaleDateString("en-US", {
    timeZone: CHICAGO,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = date.toLocaleTimeString("en-US", {
    timeZone: CHICAGO,
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day}, ${time} CT`;
}

export function formatGameStartLong(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const day = date.toLocaleDateString("en-US", {
    timeZone: CHICAGO,
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const time = date.toLocaleTimeString("en-US", {
    timeZone: CHICAGO,
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day} at ${time}`;
}

export function chicagoYmd(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: CHICAGO }).replace(/-/g, "");
}

export function daySlotLabel(index: number, total: number): string | null {
  if (!Number.isInteger(index) || !Number.isInteger(total) || index < 1 || total < 1) return null;
  return `Game ${index} of ${total}`;
}

export function formatWeatherLine(weather: Rec): string | null {
  const temp = str(weather.temp) || str(weather.temperature);
  const cond = str(weather.condition) || str(weather.displayValue);
  const wind = str(weather.wind) || str(weather.windSpeed);
  const parts = [
    temp ? (/°/.test(temp) ? temp : `${temp}°`) : null,
    cond || null,
    wind && !/^0(\.0)?\s*mph/i.test(wind) && !/none/i.test(wind) ? wind : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export function daySlotFromScoreboard(raw: unknown, eventId: string, ymd: string): string | null {
  const events = arr(rec(raw).events)
    .map((item) => {
      const row = rec(item);
      const id = str(row.id);
      const date = str(row.date) || str(rec(arr(row.competitions)[0]).date);
      return { id, date };
    })
    .filter((row) => row.id && row.date && chicagoYmd(new Date(row.date)) === ymd)
    .sort((a, b) => a.date.localeCompare(b.date));
  const index = events.findIndex((row) => row.id === eventId);
  if (index < 0) return null;
  return daySlotLabel(index + 1, events.length);
}

const SPORT_TAG: Record<string, string> = {
  nfl: "NFL",
  cfb: "CFB",
  mlb: "MLB",
  nhl: "NHL",
};

const SINGULAR_NICKNAMES =
  /\b(sox|jazz|lightning|avalanche|wild|heat|magic|thunder|united|city|fc)\b/i;

function teamTakesPluralVerb(name: string): boolean {
  const last = name.trim().split(/\s+/).pop() ?? "";
  if (SINGULAR_NICKNAMES.test(last)) return false;
  return /s$/i.test(last);
}

function conjugate(name: string, plural: string, singular: string): string {
  return teamTakesPluralVerb(name) ? plural : singular;
}

function beatVerb(sport: string, winner: string): string {
  if (sport === "nhl") return conjugate(winner, "beat", "beats");
  return conjugate(winner, "defeat", "defeats");
}

function resultSides(card: FinalCard): { winner: FinalSide; loser: FinalSide } | null {
  const away = card.away.score;
  const home = card.home.score;
  if (away == null || home == null || away === home) return null;
  return away > home ? { winner: card.away, loser: card.home } : { winner: card.home, loser: card.away };
}

function scorePair(winner: number, loser: number): string {
  return `${winner}-${loser}`;
}

function resultLine(card: FinalCard): string {
  const sides = resultSides(card);
  if (!sides) {
    const away = card.away.score ?? "–";
    const home = card.home.score ?? "–";
    if (card.away.score != null && card.home.score != null && card.away.score === card.home.score) {
      return `${card.away.name} and ${card.home.name} tie ${away}-${home}.`;
    }
    return `${card.away.name} ${away}, ${card.home.name} ${home}.`;
  }
  const verb = beatVerb(card.sport, sides.winner.name);
  return `${sides.winner.name} ${verb} ${sides.loser.name} ${scorePair(sides.winner.score!, sides.loser.score!)}.`;
}

function recordMoveLine(card: FinalCard): string | null {
  if (card.playoff) return card.seriesLine;
  const sides = resultSides(card);
  if (sides) {
    if (!sides.winner.record || !sides.loser.record) return null;
    const move = conjugate(sides.winner.name, "move", "moves");
    const fall = conjugate(sides.loser.name, "fall", "falls");
    return `${sides.winner.name} ${move} to ${sides.winner.record}, ${sides.loser.name} ${fall} to ${sides.loser.record}.`;
  }
  if (!card.away.record || !card.home.record) return null;
  const awayMove = conjugate(card.away.name, "move", "moves");
  const homeMove = conjugate(card.home.name, "move", "moves");
  return `${card.away.name} ${awayMove} to ${card.away.record}, ${card.home.name} ${homeMove} to ${card.home.record}.`;
}

function statAt(labels: string[], stats: string[], keys: string[]): string {
  for (const key of keys) {
    const idx = labels.findIndex((label) => label.toUpperCase() === key.toUpperCase());
    if (idx >= 0 && stats[idx]) return stats[idx];
  }
  return "";
}

function numAt(labels: string[], stats: string[], keys: string[]): number | null {
  const raw = statAt(labels, stats, keys).replace(/,/g, "");
  if (!raw) return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

function yardsFromLine(line: string): number | null {
  const match = /(\d+)\s*YDS\b/i.exec(line);
  return match ? Number(match[1]) : null;
}

function tdFromLine(line: string): number | null {
  const match = /(\d+)\s*TD\b/i.exec(line);
  return match ? Number(match[1]) : null;
}

export function highlightFromBox(
  group: string,
  labels: string[],
  stats: string[],
  player: string,
): { text: string; score: number } | null {
  const name = player.trim();
  if (!name) return null;
  const yds = numAt(labels, stats, ["YDS", "YARDS"]) ?? yardsFromLine(stats.join(" "));
  const td = numAt(labels, stats, ["TD", "TDS"]) ?? tdFromLine(stats.join(" "));

  if (group === "passing" || /pass/i.test(group)) {
    if (yds == null || yds < 1) return null;
    const text =
      td && td >= 2
        ? `${name} threw for ${yds} yards and ${td} touchdowns.`
        : `${name} threw for ${yds} yards.`;
    return { text, score: yds + (td ?? 0) * 40 };
  }
  if (group === "rushing" || /rush/i.test(group)) {
    if (yds == null || yds < 40) return null;
    const text =
      td && td >= 2
        ? `${name} rushed for ${yds} yards and ${td} touchdowns.`
        : `${name} rushed for ${yds} yards.`;
    return { text, score: yds * 1.4 + (td ?? 0) * 50 };
  }
  if (group === "receiving" || /receiv/i.test(group)) {
    if (yds == null || yds < 80) return null;
    const text =
      td && td >= 2
        ? `${name} had ${yds} receiving yards and ${td} touchdowns.`
        : `${name} had ${yds} receiving yards.`;
    return { text, score: yds * 1.2 + (td ?? 0) * 45 };
  }

  const goals = numAt(labels, stats, ["G", "GOALS"]);
  const assists = numAt(labels, stats, ["A", "ASSISTS"]);
  const points = numAt(labels, stats, ["P", "PTS", "POINTS"]) ?? (goals != null || assists != null ? (goals ?? 0) + (assists ?? 0) : null);
  if (/skat|forward|defense|scoring/i.test(group)) {
    if (goals && goals >= 2) return { text: `${name} scored ${goals} goals.`, score: goals * 80 + (assists ?? 0) * 30 };
    if (points && points >= 2) return { text: `${name} had ${points} points.`, score: points * 50 };
    if (goals && goals >= 1) return { text: `${name} scored.`, score: 40 };
  }
  if (/goal/i.test(group)) {
    const saves = numAt(labels, stats, ["SV", "SAVES", "SVS"]);
    if (saves && saves >= 20) return { text: `${name} made ${saves} saves.`, score: saves };
  }

  if (/pitch/i.test(group)) {
    const punchouts = numAt(labels, stats, ["K", "SO", "STRIKEOUTS"]);
    const innings = statAt(labels, stats, ["IP", "INNINGS"]);
    if (punchouts && punchouts >= 6) return { text: `${name} struck out ${punchouts}.`, score: punchouts * 15 };
    if (innings) return { text: `${name} pitched ${innings} innings.`, score: 20 };
  }
  if (/batt|hitt|hitting/i.test(group)) {
    const homers = numAt(labels, stats, ["HR", "HRUNS"]);
    const hits = numAt(labels, stats, ["H", "HITS"]);
    const rbi = numAt(labels, stats, ["RBI"]);
    if (homers && homers >= 2) return { text: `${name} hit ${homers} home runs.`, score: homers * 60 };
    if (homers === 1) return { text: `${name} hit a home run.`, score: 60 };
    if (hits && hits >= 3) return { text: `${name} had ${hits} hits.`, score: hits * 20 };
    if (rbi && rbi >= 3) return { text: `${name} drove in ${rbi}.`, score: rbi * 18 };
  }
  return null;
}

export function narrativeHighlight(card: FinalCard): string | null {
  let best: { text: string; score: number } | null = null;
  for (const row of card.leaders) {
    const fromCard =
      row.highlight && row.highlightScore != null
        ? { text: row.highlight, score: row.highlightScore }
        : null;
    const parsed = fromCard ?? highlightFromLine(row);
    if (!parsed) continue;
    if (!best || parsed.score > best.score) best = parsed;
  }
  return best?.text ?? null;
}

function highlightFromLine(row: FinalLeader): { text: string; score: number } | null {
  const yds = yardsFromLine(row.line);
  const td = tdFromLine(row.line);
  if (row.group === "passing" && yds != null) {
    return highlightFromBox(row.group, ["YDS", "TD"], [String(yds), td != null ? String(td) : ""], row.name);
  }
  if (row.group === "rushing" && yds != null) {
    return highlightFromBox(row.group, ["YDS", "TD"], [String(yds), td != null ? String(td) : ""], row.name);
  }
  if (row.group === "receiving" && yds != null) {
    return highlightFromBox(row.group, ["YDS", "TD"], [String(yds), td != null ? String(td) : ""], row.name);
  }
  return highlightFromBox(row.group, [], [], row.name);
}

export function finalCaption(card: FinalCard, _origin?: string): string {
  const tag = SPORT_TAG[card.sport] ?? card.sportLabel.toUpperCase();
  const lines = [`FINAL · ${tag}`, resultLine(card)];
  const records = recordMoveLine(card);
  if (records) lines.push(records);
  const highlight = narrativeHighlight(card);
  if (highlight) lines.push(highlight);
  return lines.join("\n").slice(0, 1000);
}

function espnLogoLeague(sport: string | undefined): string | null {
  if (sport === "cfb") return "ncaa";
  if (sport === "nfl" || sport === "mlb" || sport === "nhl") return sport;
  return null;
}

/** ESPN `dark` rel is the light mark for navy cards. Fall back to 500-dark. */
export function pickCardLogoHref(team: Rec, sport?: string): string | null {
  const logos = arr(team.logos)
    .map((row) => rec(row))
    .filter((logo) => str(logo.href).startsWith("https://"));
  const scored = logos.map((logo) => {
    const rel = arr(logo.rel).map((item) => str(item).toLowerCase());
    let score = 0;
    if (rel.includes("dark") && !rel.includes("scoreboard")) score += 12;
    else if (rel.includes("dark")) score += 6;
    else if (rel.includes("default")) score += 2;
    if (rel.includes("full")) score += 1;
    return { href: str(logo.href), score };
  });
  scored.sort((a, b) => b.score - a.score);
  let picked = scored[0]?.href || (str(team.logo).startsWith("https://") ? str(team.logo) : "");
  if (!picked) {
    const league = espnLogoLeague(sport);
    const slug = (str(team.abbreviation) || str(team.id)).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (league && slug) picked = `https://a.espncdn.com/i/teamlogos/${league}/500-dark/${slug}.png`;
  }
  if (!picked) return null;
  return picked.replace(/\/i\/teamlogos\/([a-z]+)\/500\//i, "/i/teamlogos/$1/500-dark/");
}

/**
 * Inning / period runs. ESPN summaries often send `{ displayValue }` without
 * `value`. Fixtures and some feeds send bare numbers, including `0`.
 */
export function parseLinescores(raw: unknown): (number | null)[] {
  return arr(raw).map((row) => {
    if (typeof row === "number" && Number.isFinite(row)) return row;
    const direct = num(row);
    if (direct != null) return direct;
    const line = rec(row);
    return num(line.value) ?? num(line.displayValue) ?? num(line.runs);
  });
}

function recordOf(comp: Rec): string | null {
  const rows = arr(comp.records ?? comp.record).map(rec);
  const total = rows.find((row) => str(row.type) === "total") ?? rows[0];
  if (!total) return null;
  return str(total.summary) || str(total.displayValue) || null;
}

function rankOf(comp: Rec): number | null {
  const rank = num(rec(comp.curatedRank).current);
  if (rank == null || rank < 1 || rank > 25) return null;
  return rank;
}

function sideFrom(comp: Rec, sport: string): FinalSide {
  const team = rec(comp.team);
  const display = str(team.displayName);
  const short = str(team.shortDisplayName) || str(team.name) || str(team.abbreviation) || "Team";
  return {
    teamId: str(team.id),
    abbrev: str(team.abbreviation) || "—",
    name: display.length > 0 && display.length <= 32 ? display : short,
    record: recordOf(comp),
    score: num(comp.score),
    color: str(team.color) || "334155",
    alternateColor: str(team.alternateColor) || null,
    logoUrl: pickCardLogoHref(team, sport),
    logoData: null,
    linescores: parseLinescores(comp.linescores),
    rank: rankOf(comp),
    hits: num(comp.hits),
    errors: num(comp.errors),
  };
}

function periodHeaders(sport: string, count: number): string[] {
  const n = Math.max(count, sport === "nfl" || sport === "cfb" ? 4 : count, 1);
  return Array.from({ length: n }, (_, i) => {
    if (sport === "nfl" || sport === "cfb") {
      if (i < 4) return `Q${i + 1}`;
      return n === 5 ? "OT" : `OT${i - 3}`;
    }
    if (sport === "nhl" && i >= 3) return n === 4 ? "OT" : `OT${i - 2}`;
    return String(i + 1);
  });
}

/** Magnitude for a comparison bar. Mirrors the CFB game page. */
export function statMagnitude(label: string, value: string): number | null {
  const text = value.trim();
  const clock = /^(\d+):(\d{2})$/.exec(text);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const slash = /^(\d+)\s*\/\s*(\d+)$/.exec(text);
  if (slash) {
    const made = Number(slash[1]);
    const att = Number(slash[2]);
    if (/comp|efficienc|red zone/i.test(label)) return att > 0 ? made / att : 0;
    return made;
  }
  const dash = /^(\d+)\s*-\s*(\d+)$/.exec(text);
  if (dash) {
    const made = Number(dash[1]);
    const other = Number(dash[2]);
    if (/efficienc|red zone/i.test(label)) return other > 0 ? made / other : 0;
    if (/penalt/i.test(label)) return other;
    return made;
  }
  const n = Number.parseFloat(text.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function pickStats(awayAbbrev: string, homeAbbrev: string, raw: Rec): FinalStat[] {
  const byLabel = new Map<string, { away?: string; home?: string }>();
  for (const side of arr(rec(raw.boxscore).teams)) {
    const team = rec(side);
    const abbrev = str(rec(team.team).abbreviation);
    const which = abbrev === awayAbbrev ? "away" : abbrev === homeAbbrev ? "home" : null;
    if (!which) continue;
    for (const stat of arr(team.statistics)) {
      const row = rec(stat);
      const label = str(row.label) || str(row.abbreviation) || str(row.name);
      const value = str(row.displayValue);
      if (!label || !value || value === "—") continue;
      const slot = byLabel.get(label) ?? {};
      slot[which] = value;
      byLabel.set(label, slot);
    }
  }
  const ordered: string[] = [];
  for (const label of STAT_PREFERENCE) {
    if (byLabel.has(label)) ordered.push(label);
  }
  for (const label of byLabel.keys()) {
    if (ordered.includes(label)) continue;
    if (/1st downs from|passing 1st|rushing 1st|total drives|total plays/i.test(label)) continue;
    ordered.push(label);
  }
  return ordered.slice(0, 6).map((label) => {
    const slot = byLabel.get(label)!;
    const away = slot.away ?? "—";
    const home = slot.home ?? "—";
    const awayMag = statMagnitude(label, away);
    const homeMag = statMagnitude(label, home);
    const numeric = awayMag != null && homeMag != null;
    const lower = /penalt|turnover|fumble|interception/i.test(label);
    const awayLeads = Boolean(numeric && awayMag !== homeMag && (lower ? awayMag! < homeMag! : awayMag! > homeMag!));
    const homeLeads = Boolean(numeric && awayMag !== homeMag && !awayLeads);
    const total = numeric ? Math.abs(awayMag!) + Math.abs(homeMag!) : 0;
    // Bar length is the amount. Bold type marks who won the category, including
    // when fewer turnovers is better — same reading as the game page.
    const awayShare =
      numeric && total > 0 ? (Math.abs(awayMag!) / total) * 100 : numeric ? 50 : null;
    return { label, away, home, awayLeads, homeLeads, awayShare };
  });
}

function leaderLine(group: string, labels: string[], stats: string[]): string {
  const want = LEADER_COLS[group] ?? labels.slice(0, 4);
  const parts: string[] = [];
  for (const key of want) {
    const idx = labels.findIndex((label) => label.toUpperCase() === key.toUpperCase());
    if (idx < 0 || !stats[idx]) continue;
    const bare = key === "C/ATT" || key === "CAR" || key === "REC" || key === "FG";
    parts.push(bare ? stats[idx] : `${stats[idx]} ${key}`);
  }
  if (parts.length) return parts.join(" · ");
  return stats.slice(0, 3).filter(Boolean).join(" · ");
}

function titleGroup(name: string): string {
  return name
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function pickLeaders(raw: Rec, sport: string): FinalLeader[] {
  const groups = new Map<string, { label: string; rows: FinalLeader[] }>();
  for (const side of arr(rec(raw.boxscore).players)) {
    const abbrev = str(rec(rec(side).team).abbreviation) || "—";
    for (const group of arr(rec(side).statistics)) {
      const block = rec(group);
      const name = str(block.name).toLowerCase();
      if (!name) continue;
      const labels = arr(block.labels).map((label) => str(label));
      const athlete = arr(block.athletes)[0];
      if (!athlete) continue;
      const person = rec(rec(athlete).athlete);
      const player = str(person.shortName) || str(person.displayName);
      if (!player) continue;
      const stats = arr(rec(athlete).stats).map((stat) => str(stat));
      const line = leaderLine(name, labels, stats);
      if (!line) continue;
      const hint = highlightFromBox(name, labels, stats, player);
      const slot = groups.get(name) ?? { label: titleGroup(str(block.name) || name), rows: [] };
      slot.rows.push({
        group: name,
        groupLabel: slot.label,
        teamAbbrev: abbrev,
        name: player,
        line,
        highlight: hint?.text ?? null,
        highlightScore: hint?.score,
        photoUrl: headshotHref(person, sport),
        photoData: null,
      });
      groups.set(name, slot);
    }
  }
  const ordered = [
    ...GROUP_PREFERENCE.filter((name) => groups.has(name)),
    ...[...groups.keys()].filter((name) => !GROUP_PREFERENCE.includes(name)),
  ].slice(0, 3);
  return ordered.flatMap((name) => groups.get(name)?.rows ?? []);
}

function espnHeadshotLeague(sport: string | undefined): string | null {
  if (sport === "cfb") return "college-football";
  if (sport === "nfl" || sport === "mlb" || sport === "nhl") return sport;
  return null;
}

function headshotHref(person: Rec, sport?: string): string | null {
  const nested = str(rec(person.headshot).href);
  if (nested.startsWith("https://")) return nested;
  const direct = str(person.headshot);
  if (direct.startsWith("https://")) return direct;
  const id = str(person.id);
  const league = espnHeadshotLeague(sport);
  if (id && league) return `https://a.espncdn.com/i/headshots/${league}/players/full/${id}.png`;
  return null;
}

function statCell(labels: string[], stats: string[], ...keys: string[]): string {
  for (const key of keys) {
    const idx = labels.findIndex((label) => label.toUpperCase() === key.toUpperCase());
    if (idx >= 0 && stats[idx]) return stats[idx];
  }
  return "";
}

function pickGoalies(raw: Rec, sport: string): FinalPlayer[] {
  const out: FinalPlayer[] = [];
  for (const side of arr(rec(raw.boxscore).players)) {
    const abbrev = str(rec(rec(side).team).abbreviation) || "—";
    for (const group of arr(rec(side).statistics)) {
      const block = rec(group);
      if (str(block.name).toLowerCase() !== "goalies" && str(block.type).toLowerCase() !== "goalies") {
        continue;
      }
      const labels = arr(block.labels).map((label) => str(label));
      for (const athlete of arr(block.athletes)) {
        const person = rec(rec(athlete).athlete);
        const player = str(person.shortName) || str(person.displayName);
        if (!player) continue;
        const stats = arr(rec(athlete).stats).map((stat) => str(stat));
        const ga = statCell(labels, stats, "GA");
        const sa = statCell(labels, stats, "SA");
        const sv = statCell(labels, stats, "SV");
        const pct = statCell(labels, stats, "SV%");
        const line = [
          sv && sa ? `${sv}/${sa} SV` : sv ? `${sv} SV` : null,
          ga ? `${ga} GA` : null,
          pct ? `${pct} SV%` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        if (!line) continue;
        out.push({
          name: player,
          teamAbbrev: abbrev,
          line,
          photoUrl: headshotHref(person, sport),
          photoData: null,
        });
      }
    }
  }
  return out;
}

const MLB_BAT_COLS = ["AB", "R", "H", "RBI", "HR", "BB", "K"];
const MLB_PITCH_COLS = ["IP", "H", "R", "ER", "BB", "K"];

function mlbGroupKind(block: Rec): "batting" | "pitching" | null {
  const type = str(block.type).toLowerCase() || str(block.name).toLowerCase();
  if (type === "batting" || type === "hitting") return "batting";
  if (type === "pitching") return "pitching";
  const labels = arr(block.labels).map((label) => str(label).toUpperCase());
  if (labels.includes("AB") || labels.includes("H-AB") || labels.includes("RBI")) return "batting";
  if (labels.includes("IP") && labels.includes("ER")) return "pitching";
  return null;
}

function pickMlbSide(raw: Rec, abbrev: string, kind: "batting" | "pitching", sport = "mlb"): MlbBoxSide {
  const want = kind === "batting" ? MLB_BAT_COLS : MLB_PITCH_COLS;
  const empty: MlbBoxSide = { abbrev, labels: want, rows: [] };
  for (const side of arr(rec(raw.boxscore).players)) {
    if (str(rec(rec(side).team).abbreviation) !== abbrev) continue;
    for (const group of arr(rec(side).statistics)) {
      const block = rec(group);
      if (mlbGroupKind(block) !== kind) continue;
      const labels = arr(block.labels).map((label) => str(label));
      const rows: MlbBoxRow[] = [];
      for (const athlete of arr(block.athletes)) {
        const row = rec(athlete);
        const person = rec(row.athlete);
        const player = str(person.shortName) || str(person.displayName);
        if (!player) continue;
        const stats = arr(row.stats).map((stat) => str(stat));
        const cells = want.map((key) => statCell(labels, stats, key) || "–");
        const played = cells.some((cell) => cell !== "–" && cell !== "0" && cell !== "0.0");
        const starter = row.starter === true;
        if (!played && !starter) continue;
        const decisionText = arr(row.notes)
          .map((note) => str(rec(note).text))
          .find((text) => /^(W|L|SV|S|H|BS)\b/i.test(text));
        const parsed = decisionText ? parsePitchingDecision(decisionText) : null;
        rows.push({
          name: player,
          pos: str(rec(row.position).abbreviation) || str(rec(person.position).abbreviation),
          cells,
          photoUrl: headshotHref(person, sport),
          note: parsed?.role ?? (decisionText ? decisionText.split(/[,\s]/)[0]!.toUpperCase() : null),
          record: parsed?.record ?? null,
        });
      }
      if (rows.length) return { abbrev, labels: want, rows };
    }
  }
  return empty;
}

export function parsePitchingDecision(text: string): { role: "W" | "L" | "S"; record: string | null } | null {
  const match = /^(W|L|SV|S)\b(.*)$/i.exec(text.trim());
  if (!match) return null;
  const token = match[1]!.toUpperCase();
  const role: "W" | "L" | "S" = token === "W" ? "W" : token === "L" ? "L" : "S";
  const bits = match[2]!
    .replace(/^[\s,]+/, "")
    .split(/\s*,\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (role === "S") {
    const n = bits.find((bit) => /^\d+$/.test(bit));
    return { role, record: n ? `0-0-${n} SV` : null };
  }
  return { role, record: bits.find((bit) => /^\d+-\d+/.test(bit)) ?? null };
}

function pitcherDecisionLine(side: MlbBoxSide, row: MlbBoxRow): string {
  return ["IP", "H", "ER", "K", "BB"]
    .map((key) => {
      const value = mlbCellText(side, row, key);
      return value ? `${value} ${key}` : null;
    })
    .filter(Boolean)
    .join(" · ");
}

export function pickMlbDecisions(box: MlbBox): MlbDecision[] {
  const found: MlbDecision[] = [];
  for (const side of [box.pitching.away, box.pitching.home]) {
    for (const row of side.rows) {
      const parsed = parsePitchingDecision(row.note ?? "");
      if (!parsed) continue;
      found.push({
        role: parsed.role,
        name: row.name,
        teamAbbrev: side.abbrev,
        record: row.record ?? parsed.record,
        line: pitcherDecisionLine(side, row),
        photoUrl: row.photoUrl ?? null,
        photoData: null,
      });
    }
  }
  return (["W", "L", "S"] as const)
    .map((role) => found.find((row) => row.role === role))
    .filter((row): row is MlbDecision => Boolean(row));
}

export function pickMlbBox(raw: Rec, awayAbbrev: string, homeAbbrev: string): MlbBox {
  return {
    batting: {
      away: pickMlbSide(raw, awayAbbrev, "batting", "mlb"),
      home: pickMlbSide(raw, homeAbbrev, "batting", "mlb"),
    },
    pitching: {
      away: pickMlbSide(raw, awayAbbrev, "pitching", "mlb"),
      home: pickMlbSide(raw, homeAbbrev, "pitching", "mlb"),
    },
  };
}

function mlbBoxHasRows(box: MlbBox | null): boolean {
  if (!box) return false;
  return [box.batting.away, box.batting.home, box.pitching.away, box.pitching.home].some(
    (side) => side.rows.length > 0,
  );
}

function mlbCellNum(side: MlbBoxSide, row: MlbBoxRow, key: string): number {
  const at = side.labels.indexOf(key);
  if (at < 0) return 0;
  const n = Number.parseFloat(row.cells[at] ?? "");
  return Number.isFinite(n) ? n : 0;
}

function mlbCellText(side: MlbBoxSide, row: MlbBoxRow, key: string): string {
  const at = side.labels.indexOf(key);
  if (at < 0) return "";
  const raw = row.cells[at] ?? "";
  return !raw || raw === "–" ? "" : raw;
}

/** Compact playoff-card strip: top batters + pitching lines, not the full box. */
export function pickMlbPerformers(box: MlbBox): FinalLeader[] {
  const bats: { row: MlbBoxRow; side: MlbBoxSide; score: number }[] = [];
  for (const side of [box.batting.away, box.batting.home]) {
    for (const row of side.rows) {
      const hr = mlbCellNum(side, row, "HR");
      const h = mlbCellNum(side, row, "H");
      const rbi = mlbCellNum(side, row, "RBI");
      const r = mlbCellNum(side, row, "R");
      const score = hr * 60 + rbi * 14 + h * 12 + r * 8;
      if (score <= 0) continue;
      bats.push({ row, side, score });
    }
  }
  const pits: { row: MlbBoxRow; side: MlbBoxSide; score: number }[] = [];
  for (const side of [box.pitching.away, box.pitching.home]) {
    for (const row of side.rows) {
      const k = mlbCellNum(side, row, "K");
      const ip = mlbCellNum(side, row, "IP");
      const er = mlbCellNum(side, row, "ER");
      if (ip <= 0 && k <= 0) continue;
      pits.push({ row, side, score: k * 10 + ip * 8 - er * 6 + (row.note === "W" ? 20 : 0) });
    }
  }
  bats.sort((a, b) => b.score - a.score);
  pits.sort((a, b) => b.score - a.score);
  const pickedBats: typeof bats = [];
  for (const item of bats) {
    if (pickedBats.length >= 2) break;
    if (pickedBats.some((row) => row.side.abbrev === item.side.abbrev)) continue;
    pickedBats.push(item);
  }
  if (!pickedBats.length && bats[0]) pickedBats.push(bats[0]);
  const pickedPits: typeof pits = [];
  for (const item of pits) {
    if (pickedPits.length >= 2) break;
    if (pickedPits.some((row) => row.side.abbrev === item.side.abbrev)) continue;
    pickedPits.push(item);
  }
  const toLeader = (
    item: { row: MlbBoxRow; side: MlbBoxSide; score: number },
    group: "batting" | "pitching",
  ): FinalLeader => {
    const hint = highlightFromBox(group, item.side.labels, item.row.cells, item.row.name);
    const line =
      group === "batting"
        ? [
            mlbCellNum(item.side, item.row, "HR")
              ? `${mlbCellText(item.side, item.row, "HR")} HR`
              : null,
            mlbCellText(item.side, item.row, "H")
              ? `${mlbCellText(item.side, item.row, "H")} H`
              : null,
            mlbCellText(item.side, item.row, "RBI")
              ? `${mlbCellText(item.side, item.row, "RBI")} RBI`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")
        : [
            item.row.note,
            mlbCellText(item.side, item.row, "IP")
              ? `${mlbCellText(item.side, item.row, "IP")} IP`
              : null,
            mlbCellText(item.side, item.row, "K") ? `${mlbCellText(item.side, item.row, "K")} K` : null,
          ]
            .filter(Boolean)
            .join(" · ");
    return {
      group,
      groupLabel: group === "batting" ? "Batting" : "Pitching",
      teamAbbrev: item.side.abbrev,
      name: item.row.name,
      line,
      highlight: hint?.text,
      highlightScore: hint?.score ?? item.score,
      photoUrl: item.row.photoUrl ?? null,
      photoData: null,
    };
  };
  return [...pickedBats.map((row) => toLeader(row, "batting")), ...pickedPits.map((row) => toLeader(row, "pitching"))];
}

function leadersFromMlbBox(box: MlbBox): FinalLeader[] {
  const out: FinalLeader[] = [];
  for (const side of [box.batting.away, box.batting.home]) {
    const hrAt = side.labels.indexOf("HR");
    const hAt = side.labels.indexOf("H");
    const rbiAt = side.labels.indexOf("RBI");
    for (const row of side.rows) {
      const hint = highlightFromBox(
        "batting",
        side.labels,
        row.cells,
        row.name,
      );
      if (!hint) continue;
      out.push({
        group: "batting",
        groupLabel: "Batting",
        teamAbbrev: side.abbrev,
        name: row.name,
        line: [
          hrAt >= 0 && row.cells[hrAt] && row.cells[hrAt] !== "0" ? `${row.cells[hrAt]} HR` : null,
          hAt >= 0 ? `${row.cells[hAt]} H` : null,
          rbiAt >= 0 ? `${row.cells[rbiAt]} RBI` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        highlight: hint.text,
        highlightScore: hint.score,
      });
    }
  }
  for (const side of [box.pitching.away, box.pitching.home]) {
    const kAt = side.labels.indexOf("K");
    const ipAt = side.labels.indexOf("IP");
    for (const row of side.rows) {
      const hint = highlightFromBox("pitching", side.labels, row.cells, row.name);
      if (!hint) continue;
      out.push({
        group: "pitching",
        groupLabel: "Pitching",
        teamAbbrev: side.abbrev,
        name: row.name,
        line: [ipAt >= 0 ? `${row.cells[ipAt]} IP` : null, kAt >= 0 ? `${row.cells[kAt]} K` : null]
          .filter(Boolean)
          .join(" · "),
        highlight: hint.text,
        highlightScore: hint.score,
      });
    }
  }
  return out;
}

export function starsFromLanding(stars: NhlLandingStar[]): FinalStar[] {
  return stars.map((star) => ({
    star: star.star,
    name: star.name,
    teamAbbrev: star.teamAbbrev,
    line: starLine(star),
    position: star.position,
    sweaterNo: star.sweaterNo,
    goals: star.goals,
    assists: star.assists,
    points: star.points,
    savePctg: star.savePctg,
    gaa: star.goalsAgainstAverage,
    photoUrl: star.headshot,
    photoData: null,
  }));
}

function playRefs(raw: Rec): CfbWinProbPlayRef[] {
  const drives = rec(raw.drives);
  const lists = [...arr(drives.previous), ...(drives.current ? [drives.current] : [])];
  const refs: CfbWinProbPlayRef[] = [];
  for (const drive of lists) {
    for (const play of arr(rec(drive).plays)) {
      const row = rec(play);
      const id = str(row.id);
      if (!id) continue;
      const periodObj = rec(row.period);
      const period = num(periodObj.number) ?? num(row.period);
      const clock = str(rec(row.clock).displayValue) || str(row.clock) || null;
      refs.push({ id, period, clock });
    }
  }
  return refs;
}

export function cardFromSummary(sport: string, eventId: string, raw: unknown): FinalCard {
  const body = rec(raw);
  const comp = rec(arr(rec(body.header).competitions)[0]);
  const competitors = arr(comp.competitors).map(rec);
  const awayComp = competitors.find((row) => str(row.homeAway) === "away");
  const homeComp = competitors.find((row) => str(row.homeAway) === "home");
  if (!awayComp || !homeComp) throw new Error("Summary is missing away or home");
  const away = sideFrom(awayComp, sport);
  const home = sideFrom(homeComp, sport);
  const status = rec(rec(comp.status).type);
  const state = str(status.state);
  const final = state === "post" || status.completed === true;
  const statusLabel = str(status.shortDetail) || str(status.detail) || (final ? "Final" : "Live");
  const periodCount = Math.max(away.linescores.length, home.linescores.length);
  const gameInfo = rec(body.gameInfo);
  const venue = str(rec(gameInfo.venue).fullName) || str(rec(comp.venue).fullName) || null;
  const headline = str(rec(body.article).headline) || null;
  const date = str(comp.date) || str(rec(body.header).date) || null;
  const playoff = mlbPlayoffFromSummary(sport, body, comp);
  const mlbBox = sport === "mlb" ? pickMlbBox(body, away.abbrev, home.abbrev) : null;
  const leaders = pickLeaders(body, sport);
  if (sport === "mlb" && mlbBoxHasRows(mlbBox)) {
    const performers = pickMlbPerformers(mlbBox!);
    if (performers.length) leaders.splice(0, leaders.length, ...performers);
    else if (!leaders.length) leaders.push(...leadersFromMlbBox(mlbBox!));
  }
  return {
    sport,
    sportLabel: SPORT_LABEL[sport] ?? sport.toUpperCase(),
    eventId,
    statusLabel,
    final,
    playoff: playoff.playoff,
    seriesLine: playoff.seriesLine,
    seriesStanding: playoff.seriesStanding,
    seriesBestOf: playoff.seriesBestOf,
    seriesGameLabel: playoff.seriesGameLabel,
    seriesGames: playoff.seriesGames,
    venue,
    headline: headline ? headline.replace(/\s+/g, " ").slice(0, 180) : null,
    away,
    home,
    periods: periodHeaders(sport, periodCount),
    stats: sport === "mlb" ? [] : pickStats(away.abbrev, home.abbrev, body),
    leaders,
    threeStars: [],
    goalies: sport === "nhl" ? pickGoalies(body, sport) : [],
    mlbBox: mlbBoxHasRows(mlbBox) ? mlbBox : null,
    mlbDecisions: sport === "mlb" && mlbBoxHasRows(mlbBox) ? pickMlbDecisions(mlbBox!) : [],
    standings: [],
    date,
    sentAt: null,
    daySlot: null,
    attendance: num(gameInfo.attendance) ?? num(comp.attendance),
    duration: str(gameInfo.gameDuration) || str(comp.gameDuration) || null,
    weather: formatWeatherLine(rec(gameInfo.weather)) || formatWeatherLine(rec(comp.weather)),
    odds: oddsFromSummary(body, away, home, final),
    // Football: 15:00 quarters. Baseball: inning/half mapper.
    // ESPN hockey probabilities are unsupported (400) and NHL.com has no WP
    // series on landing / play-by-play / right-rail. Do not invent a chart.
    winProbability:
      sport === "nfl" || sport === "cfb"
        ? mapCfbWinProbability(
            arr(body.winprobability).map((row) => {
              const item = rec(row);
              return {
                homeWinPercentage: num(item.homeWinPercentage) ?? undefined,
                tiePercentage: num(item.tiePercentage) ?? undefined,
                playId: str(item.playId) || undefined,
              };
            }),
            playRefs(body),
          )
        : sport === "mlb"
          ? mapMlbWinProbability(
              arr(body.winprobability).map((row) => {
                const item = rec(row);
                return {
                  homeWinPercentage: num(item.homeWinPercentage) ?? undefined,
                  tiePercentage: num(item.tiePercentage) ?? undefined,
                  playId: str(item.playId) || undefined,
                };
              }),
              mlbPlayRefs(body),
            )
          : [],
    path: gamePath(sport, eventId),
  };
}

export async function fetchSummary(sport: string, eventId: string): Promise<unknown> {
  const path = SUMMARY_PATH[sport];
  if (!path) throw new Error(`No summary feed for ${sport}`);
  if (!/^\d{5,16}$/.test(eventId)) throw new Error("Bad event id");
  const hosts = [
    "https://site.web.api.espn.com/apis/site/v2/sports",
    "https://site.api.espn.com/apis/site/v2/sports",
  ];
  const headers = { Accept: "application/json", "User-Agent": "CommandCenterSportsFinals" };
  let lastStatus = 0;
  for (const host of hosts) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch(`${host}/${path}/summary?event=${eventId}`, {
        headers,
        signal: controller.signal,
      });
      if (res.ok) return res.json();
      lastStatus = res.status;
    } catch {
      /* next host */
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`ESPN summary ${lastStatus}`);
}

const ESPN_HEADERS = { Accept: "application/json", "User-Agent": "CommandCenterSportsFinals" };

export async function fetchDaySlot(sport: string, eventId: string, gameIso: string | null): Promise<string | null> {
  const path = SUMMARY_PATH[sport];
  if (!path || !eventId) return null;
  const gameDate = gameIso ? new Date(gameIso) : new Date();
  const ymd = chicagoYmd(Number.isNaN(gameDate.getTime()) ? new Date() : gameDate);
  const dated = sport === "mlb" || sport === "nhl";
  const hosts = [
    "https://site.web.api.espn.com/apis/site/v2/sports",
    "https://site.api.espn.com/apis/site/v2/sports",
  ];
  for (const host of hosts) {
    try {
      const url = dated ? `${host}/${path}/scoreboard?dates=${ymd}` : `${host}/${path}/scoreboard`;
      const res = await fetch(url, { headers: ESPN_HEADERS, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) continue;
      const slot = daySlotFromScoreboard(await res.json(), eventId, ymd);
      if (slot) return slot;
    } catch {
      /* next host */
    }
  }
  return null;
}

/** MLB Stats API weather for the W/L/S strip. Not the Times ESPN fetch. */
export async function fetchMlbWeatherLine(dateIso: string | null, venue: string | null): Promise<string | null> {
  if (!dateIso || !venue) return null;
  const day = new Date(dateIso);
  if (Number.isNaN(day.getTime())) return null;
  const ymd = day.toLocaleDateString("en-CA", { timeZone: CHICAGO });
  try {
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${encodeURIComponent(ymd)}&hydrate=weather`,
      { headers: ESPN_HEADERS, signal: AbortSignal.timeout(8_000) },
    );
    if (!res.ok) return null;
    const body = rec(await res.json());
    const want = venue.toLowerCase();
    for (const dateRow of arr(body.dates)) {
      for (const game of arr(rec(dateRow).games)) {
        const name = str(rec(rec(game).venue).name);
        if (name && name.toLowerCase() === want) return formatWeatherLine(rec(rec(game).weather));
      }
    }
  } catch {
    return null;
  }
  return null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x4000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x4000));
  }
  return btoa(bin);
}

const IMAGE_UA = "CommandCenterSportsFinals";

function imageMime(bytes: Uint8Array): string | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 && bytes[9] === 0x45) return "image/webp";
  return null;
}

async function fetchImageDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "image/png,image/jpeg,image/webp,image/*", "User-Agent": IMAGE_UA },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length < 32 || bytes.length > 1_500_000) return null;
    const mime = imageMime(bytes);
    if (!mime) return null;
    return `data:${mime};base64,${bytesToBase64(bytes)}`;
  } catch {
    return null;
  }
}

/** resvg cannot fetch remote hrefs. Inline ESPN marks / headshots first. */
export async function fetchLogoDataUri(url: string | null): Promise<string | null> {
  if (!url || !url.startsWith("https://")) return null;
  const data = await fetchImageDataUri(url);
  if (data) return data;
  if (/\/500-dark\//i.test(url)) return fetchImageDataUri(url.replace(/\/500-dark\//i, "/500/"));
  return null;
}

async function hydratePhotos(card: FinalCard): Promise<void> {
  const urls = [
    ...card.threeStars.map((row) => row.photoUrl),
    ...card.goalies.map((row) => row.photoUrl),
    ...card.leaders.map((row) => row.photoUrl ?? null),
    ...card.mlbDecisions.map((row) => row.photoUrl),
  ].filter((url): url is string => Boolean(url));
  const unique = [...new Set(urls)];
  const fetched = await Promise.all(unique.map((url) => fetchLogoDataUri(url)));
  const byUrl = new Map(unique.map((url, i) => [url, fetched[i] ?? null]));
  for (const row of card.threeStars) row.photoData = row.photoUrl ? byUrl.get(row.photoUrl) ?? null : null;
  for (const row of card.goalies) row.photoData = row.photoUrl ? byUrl.get(row.photoUrl) ?? null : null;
  for (const row of card.leaders) row.photoData = row.photoUrl ? byUrl.get(row.photoUrl) ?? null : null;
  for (const row of card.mlbDecisions) row.photoData = row.photoUrl ? byUrl.get(row.photoUrl) ?? null : null;
}

/** Logos + key-performer headshots for a card already built from a summary. */
export async function hydrateFinalCardArt(card: FinalCard): Promise<FinalCard> {
  const [away, home] = await Promise.all([
    fetchLogoDataUri(card.away.logoUrl),
    fetchLogoDataUri(card.home.logoUrl),
  ]);
  card.away.logoData = away;
  card.home.logoData = home;
  await hydratePhotos(card);
  return card;
}

export async function loadFinalCard(
  sport: string,
  eventId: string,
  opts: { waitForStars?: boolean } = {},
): Promise<FinalCard> {
  const card = cardFromSummary(sport, eventId, await fetchSummary(sport, eventId));
  const skipStandings = card.playoff && card.sport === "mlb";
  const [standings, stars, daySlot, weather] = await Promise.all([
    skipStandings ? Promise.resolve([]) : loadCardStandings(sport, card.away, card.home),
    sport === "nhl"
      ? fetchNhlThreeStarsWithRetry(
          { date: card.date, awayAbbrev: card.away.abbrev, homeAbbrev: card.home.abbrev },
          { wait: Boolean(opts.waitForStars) },
        )
      : Promise.resolve([]),
    fetchDaySlot(sport, eventId, card.date),
    sport === "mlb" && !card.weather ? fetchMlbWeatherLine(card.date, card.venue) : Promise.resolve(null),
  ]);
  card.standings = standings;
  card.threeStars = starsFromLanding(stars);
  card.daySlot = daySlot;
  if (weather) card.weather = weather;
  card.sentAt = new Date().toISOString();
  await hydrateFinalCardArt(card);
  return card;
}
