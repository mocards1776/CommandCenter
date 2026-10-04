/**
 * Post-game card model from an ESPN summary.
 *
 * Same feed the NFL and CFB game pages use (`summary?event=`). The graphic
 * keeps the page's final score, records, linescore, team stats, box leaders,
 * win-probability series, and each club's division or conference table.
 * It does not include the live field.
 */
import { oddsFromSummary, type FinalOdds } from "./odds.ts";
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
};

export type FinalCard = {
  sport: string;
  sportLabel: string;
  eventId: string;
  statusLabel: string;
  final: boolean;
  venue: string | null;
  headline: string | null;
  away: FinalSide;
  home: FinalSide;
  periods: string[];
  stats: FinalStat[];
  leaders: FinalLeader[];
  winProbability: CfbWinProbPoint[];
  /** Division / conference tables for the two clubs. Empty when ESPN has none. */
  standings: StandingTable[];
  /** Kickoff (or game) ISO from ESPN. Null when the summary omits it. */
  date: string | null;
  /** Pregame spread / ML from ESPN pickcenter. Null when ESPN has no line. */
  odds: FinalOdds | null;
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

/** Kickoff / game time in CT. Falls back to `fallback` (usually send time). */
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

function scoreLine(card: FinalCard): string {
  const away = `${card.away.name} ${card.away.score ?? "–"}`;
  const home = `${card.home.name} ${card.home.score ?? "–"}`;
  return `${away}, ${home}`;
}

function recordLine(card: FinalCard): string | null {
  if (!card.away.record && !card.home.record) return null;
  const away = card.away.record ? `${card.away.abbrev} ${card.away.record}` : card.away.abbrev;
  const home = card.home.record ? `${card.home.abbrev} ${card.home.record}` : card.home.abbrev;
  return `${away} · ${home}`;
}

function leaderCaptionLines(card: FinalCard): string[] {
  const groups = new Map<string, string[]>();
  for (const row of card.leaders) {
    const slot = groups.get(row.groupLabel) ?? [];
    slot.push(`${row.teamAbbrev} ${row.name} ${row.line}`);
    groups.set(row.groupLabel, slot);
  }
  const lines: string[] = [];
  for (const [label, rows] of groups) {
    for (const row of rows) lines.push(`${label}: ${row}`);
  }
  return lines.slice(0, 6);
}

export function finalCaption(card: FinalCard, origin: string): string {
  const root = origin.replace(/\/$/, "");
  const head = /^final\b/i.test(card.statusLabel) ? "Final" : card.statusLabel || "Final";
  const lines = [`${head}: ${scoreLine(card)}`];
  const records = recordLine(card);
  if (records) lines.push(records);
  if (card.odds?.upsetLine) lines.push(card.odds.upsetLine);
  if (card.odds?.captionLine) lines.push(card.odds.captionLine);
  const leaders = leaderCaptionLines(card);
  if (leaders.length) {
    lines.push("");
    lines.push(...leaders);
  }
  lines.push("");
  lines.push(`Open game: ${root}${card.path}`);
  return lines.join("\n").slice(0, 1000);
}

function logoHref(team: Rec): string | null {
  for (const row of arr(team.logos)) {
    const logo = rec(row);
    const href = str(logo.href);
    const rel = arr(logo.rel).map((item) => str(item));
    if (href.startsWith("https://") && rel.includes("default")) return href;
  }
  for (const row of arr(team.logos)) {
    const href = str(rec(row).href);
    if (href.startsWith("https://")) return href;
  }
  const direct = str(team.logo);
  return direct.startsWith("https://") ? direct : null;
}

function linescores(comp: Rec): (number | null)[] {
  return arr(comp.linescores).map((row) => {
    const line = rec(row);
    return num(line.value) ?? num(line.displayValue);
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

function sideFrom(comp: Rec): FinalSide {
  const team = rec(comp.team);
  const display = str(team.displayName);
  const short = str(team.shortDisplayName) || str(team.name) || str(team.abbreviation) || "Team";
  return {
    teamId: str(team.id),
    abbrev: str(team.abbreviation) || "—",
    name: display.length > 0 && display.length <= 22 ? display : short,
    record: recordOf(comp),
    score: num(comp.score),
    color: str(team.color) || "334155",
    alternateColor: str(team.alternateColor) || null,
    logoUrl: logoHref(team),
    logoData: null,
    linescores: linescores(comp),
    rank: rankOf(comp),
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

function pickLeaders(raw: Rec): FinalLeader[] {
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
      const slot = groups.get(name) ?? { label: titleGroup(str(block.name) || name), rows: [] };
      slot.rows.push({ group: name, groupLabel: slot.label, teamAbbrev: abbrev, name: player, line });
      groups.set(name, slot);
    }
  }
  const ordered = [
    ...GROUP_PREFERENCE.filter((name) => groups.has(name)),
    ...[...groups.keys()].filter((name) => !GROUP_PREFERENCE.includes(name)),
  ].slice(0, 3);
  return ordered.flatMap((name) => groups.get(name)?.rows ?? []);
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
  const away = sideFrom(awayComp);
  const home = sideFrom(homeComp);
  const status = rec(rec(comp.status).type);
  const state = str(status.state);
  const final = state === "post" || status.completed === true;
  const statusLabel = str(status.shortDetail) || str(status.detail) || (final ? "Final" : "Live");
  const periodCount = Math.max(away.linescores.length, home.linescores.length);
  const venue =
    str(rec(rec(body.gameInfo).venue).fullName) || str(rec(comp.venue).fullName) || null;
  const headline = str(rec(body.article).headline) || null;
  const date = str(comp.date) || str(rec(body.header).date) || null;
  return {
    sport,
    sportLabel: SPORT_LABEL[sport] ?? sport.toUpperCase(),
    eventId,
    statusLabel,
    final,
    venue,
    headline: headline ? headline.replace(/\s+/g, " ").slice(0, 180) : null,
    away,
    home,
    periods: periodHeaders(sport, periodCount),
    stats: pickStats(away.abbrev, home.abbrev, body),
    leaders: pickLeaders(body),
    standings: [],
    date,
    odds: oddsFromSummary(body, away, home, final),
    winProbability: mapCfbWinProbability(
      arr(body.winprobability).map((row) => {
        const item = rec(row);
        return {
          homeWinPercentage: num(item.homeWinPercentage) ?? undefined,
          tiePercentage: num(item.tiePercentage) ?? undefined,
          playId: str(item.playId) || undefined,
        };
      }),
      playRefs(body),
    ),
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

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x4000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x4000));
  }
  return btoa(bin);
}

export async function fetchLogoDataUri(url: string | null): Promise<string | null> {
  if (!url || !url.startsWith("https://")) return null;
  try {
    const res = await fetch(url, { headers: { Accept: "image/png,image/*" } });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length < 32 || bytes.length > 1_500_000) return null;
    const mime = bytes[0] === 0x89 && bytes[1] === 0x50 ? "image/png" : "image/jpeg";
    return `data:${mime};base64,${bytesToBase64(bytes)}`;
  } catch {
    return null;
  }
}

export async function loadFinalCard(sport: string, eventId: string): Promise<FinalCard> {
  const card = cardFromSummary(sport, eventId, await fetchSummary(sport, eventId));
  const [away, home, standings] = await Promise.all([
    fetchLogoDataUri(card.away.logoUrl),
    fetchLogoDataUri(card.home.logoUrl),
    loadCardStandings(sport, card.away, card.home),
  ]);
  card.away.logoData = away;
  card.home.logoData = home;
  card.standings = standings;
  return card;
}
