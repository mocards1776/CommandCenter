/**
 * Agate for the Thompson Times reader: the table model every box score is set
 * in (MLB batting and pitching, NFL/CFB, NHL, and NBA player lines), plus the
 * ESPN game summary read into that model for every desk sport.
 */

import {
  espnGameHref,
  fetchEspnSummary,
  headshotOf,
  leagueCode,
  periodLabels,
  type AgateSide,
  type BoxGame,
  type BoxLeader,
  type BoxPerson,
  type BoxSide,
  type EspnAthlete,
} from "./newspaper-box.ts";

export type AgateRow = {
  id: string | null;
  name: string;
  /** Set ahead of the name, e.g. a star's rank. */
  lead?: string | null;
  note?: string | null;
  /** Indented under the starter, the way substitutes run. */
  sub?: boolean;
  cells: string[];
};

export type AgateTable = {
  title: string;
  columns: string[];
  rows: AgateRow[];
  totals: string[] | null;
};

/** One category for both clubs, set side by side on the same column widths. */
export type AgatePair = { key: string; label: string | null; away: AgateTable | null; home: AgateTable | null };

export type StatLine = { label: string; away: string; home: string; sub?: boolean };

export type NamePiece = string | { id: string; name: string };

export type ScoringPlay = {
  side: "away" | "home";
  team: string;
  clock: string;
  tag: string | null;
  lead: NamePiece[];
  detail: NamePiece[];
  score: string;
};

export type ScoringPeriod = { label: string; plays: ScoringPlay[] };

export type StarPick = { rank: number; person: BoxPerson; team: string | null };

export type PeriodShots = { periods: string[]; away: (number | null)[]; home: (number | null)[]; awayTotal: string; homeTotal: string };

export type EspnBox = {
  /** The game as the summary's header tells it, for stories the page couldn't match to a board game. */
  game: BoxGame;
  pairs: AgatePair[];
  teamStats: StatLine[];
  scoring: ScoringPeriod[];
  shots: PeriodShots | null;
  stars: StarPick[];
  info: { label: string; value: string }[];
};

/* ───────────────────────── column widths ───────────────────────── */

/**
 * Fixed widths (in em) for each stat column, measured across every table in a
 * pair so the two clubs' columns — and therefore their rules — line up.
 */
export function agateWidths(tables: (AgateTable | null | undefined)[]): string[] {
  const live = tables.filter((t): t is AgateTable => Boolean(t));
  const count = Math.max(0, ...live.map((t) => t.columns.length));
  return Array.from({ length: count }, (_, i) => {
    let head = 0;
    let cell = 0;
    for (const t of live) {
      head = Math.max(head, (t.columns[i] ?? "").length);
      for (const r of t.rows) cell = Math.max(cell, (r.cells[i] ?? "").length);
      cell = Math.max(cell, (t.totals?.[i] ?? "").length);
    }
    const em = Math.max(head * 0.64, cell * 0.58, 1.2) + 0.7;
    return `${em.toFixed(2)}em`;
  });
}

/** Narrowest a table can set before the names would be cut to nothing. */
export function agateMinWidth(widths: string[], nameEm = 8): string {
  const sum = widths.reduce((t, w) => t + Number.parseFloat(w), 0);
  return `${(sum + nameEm).toFixed(2)}em`;
}

/* ───────────────────────── MLB ───────────────────────── */

export function mlbBattingTable(side: AgateSide, team: BoxSide): AgateTable | null {
  if (!side.batters.length) return null;
  const tot = side.batters.reduce(
    (t, b) => ({ ab: t.ab + b.ab, r: t.r + b.r, h: t.h + b.h, rbi: t.rbi + b.rbi, bb: t.bb + b.bb, so: t.so + b.so }),
    { ab: 0, r: 0, h: 0, rbi: 0, bb: 0, so: 0 },
  );
  return {
    title: team.short,
    columns: ["AB", "R", "H", "BI", "BB", "SO", "Avg"],
    rows: side.batters.map((b) => ({
      id: b.id,
      name: b.name,
      note: b.pos.toLowerCase(),
      sub: b.sub,
      cells: [b.ab, b.r, b.h, b.rbi, b.bb, b.so].map(String).concat(b.avg ?? ""),
    })),
    totals: [tot.ab, tot.r, tot.h, tot.rbi, tot.bb, tot.so].map(String).concat(""),
  };
}

export function mlbPitchingTable(side: AgateSide, team: BoxSide): AgateTable | null {
  if (!side.pitchers.length) return null;
  return {
    title: team.short,
    columns: ["IP", "H", "R", "ER", "BB", "SO", "ERA"],
    rows: side.pitchers.map((p) => ({
      id: p.id,
      name: p.name,
      note: p.note,
      cells: [p.ip, p.h, p.r, p.er, p.bb, p.so].map(String).concat(p.era ?? ""),
    })),
    totals: null,
  };
}

/* ───────────────────────── ESPN summary ───────────────────────── */

type SumAthlete = EspnAthlete & {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  position?: { abbreviation?: string };
};

type SumTeam = {
  id?: string;
  abbreviation?: string;
  displayName?: string;
  shortDisplayName?: string;
  name?: string;
  color?: string;
  logo?: string;
  logos?: { href?: string }[];
};

type SumCompetitor = {
  homeAway?: string;
  winner?: boolean;
  score?: string;
  hits?: number;
  errors?: number;
  team?: SumTeam;
  linescores?: { displayValue?: string; value?: number }[];
  record?: { type?: string; summary?: string }[];
  statistics?: { name?: string; displayValue?: string }[];
};

type SumAthleteRow = {
  athlete?: SumAthlete;
  stats?: string[];
  notes?: { type?: string; text?: string }[];
};

type SumStatBlock = {
  name?: string;
  labels?: string[];
  totals?: string[];
  athletes?: SumAthleteRow[];
};

type SumPlay = {
  type?: { text?: string; abbreviation?: string };
  text?: string;
  awayScore?: number;
  homeScore?: number;
  period?: { number?: number; displayValue?: string };
  clock?: { displayValue?: string };
  team?: { id?: string; abbreviation?: string };
  scoringPlay?: boolean;
  scoringType?: { abbreviation?: string };
  strength?: { abbreviation?: string };
  participants?: { athlete?: SumAthlete; type?: string; ytdGoals?: number }[];
};

type SummaryRaw = {
  header?: {
    id?: string;
    competitions?: {
      date?: string;
      notes?: { headline?: string }[];
      series?: { summary?: string };
      status?: {
        type?: { completed?: boolean; state?: string; shortDetail?: string; detail?: string };
        featuredAthletes?: { name?: string; athlete?: SumAthlete; team?: { id?: string } }[];
      };
      competitors?: SumCompetitor[];
    }[];
  };
  gameInfo?: {
    venue?: { fullName?: string };
    attendance?: number;
    officials?: { displayName?: string; fullName?: string; position?: { displayName?: string } }[];
    weather?: { displayValue?: string; temperature?: number };
  };
  boxscore?: {
    teams?: { team?: SumTeam; homeAway?: string; statistics?: { name?: string; displayValue?: string }[] }[];
    players?: { team?: SumTeam; statistics?: SumStatBlock[] }[];
  };
  scoringPlays?: SumPlay[];
  plays?: SumPlay[];
  leaders?: {
    team?: SumTeam;
    leaders?: { name?: string; displayName?: string; leaders?: { displayValue?: string; athlete?: SumAthlete }[] }[];
  }[];
};

function agateName(a: SumAthlete | undefined): string {
  if (!a) return "—";
  if (a.shortName) return a.shortName;
  if (a.firstName && a.lastName) return `${a.firstName[0]}. ${a.lastName}`;
  return a.displayName || a.fullName || "—";
}

function summaryStat(c: SumCompetitor, name: string): string | null {
  const hit = c.statistics?.find((s) => s.name === name)?.displayValue;
  return hit && hit !== "--" ? hit : null;
}

function summarySide(c: SumCompetitor, periods: string[]): BoxSide {
  const t = c.team ?? {};
  return {
    id: t.id ?? null,
    name: t.displayName ?? "—",
    short: t.shortDisplayName ?? t.name ?? t.displayName ?? "—",
    abbrev: t.abbreviation ?? "—",
    logo: t.logos?.[0]?.href ?? t.logo ?? null,
    color: t.color ? `#${t.color}` : null,
    score: c.score ?? null,
    hits: c.hits != null ? String(c.hits) : summaryStat(c, "hits"),
    errors: c.errors != null ? String(c.errors) : summaryStat(c, "errors"),
    record: c.record?.find((r) => r.type === "total")?.summary ?? c.record?.[0]?.summary ?? null,
    winner: Boolean(c.winner),
    rank: null,
    lines: periods.map((_, i) => {
      const l = c.linescores?.[i];
      const v = typeof l?.value === "number" ? l.value : Number.parseFloat(l?.displayValue ?? "");
      return Number.isFinite(v) ? v : null;
    }),
  };
}

const LEADER_LABEL: Record<string, string> = {
  passingYards: "Pass",
  passingTouchdowns: "Pass",
  rushingYards: "Rush",
  receivingYards: "Rec",
  goals: "Goals",
  assists: "Assists",
  points: "Points",
  saves: "Goalie",
  savePercentage: "Goalie",
  rating: "Points",
  rebounds: "Rebounds",
  totalRebounds: "Rebounds",
  pointsPerGame: "Points",
  battingAverage: "Hit",
  homeRuns: "Hit",
  runsBattedIn: "Hit",
  wins: "Winner",
};

function summaryLeaders(data: SummaryRaw, winnerId: string | null): BoxLeader[] {
  const teams = [...(data.leaders ?? [])].sort(
    (a, b) => Number(b.team?.id === winnerId) - Number(a.team?.id === winnerId),
  );
  const out: BoxLeader[] = [];
  for (const t of teams) {
    for (const g of t.leaders ?? []) {
      const label = LEADER_LABEL[g.name ?? ""];
      const top = g.leaders?.[0];
      if (!label || !top?.athlete) continue;
      out.push({
        label,
        id: top.athlete.id ?? null,
        name: agateName(top.athlete),
        line: top.displayValue ?? null,
        headshot: headshotOf(top.athlete),
        team: t.team?.abbreviation ?? null,
      });
    }
  }
  return out.slice(0, 6);
}

function headerGame(path: string, data: SummaryRaw, eventId: string): BoxGame | null {
  const comp = data.header?.competitions?.[0];
  const awayC = comp?.competitors?.find((c) => c.homeAway === "away");
  const homeC = comp?.competitors?.find((c) => c.homeAway === "home");
  if (!comp || !awayC?.team || !homeC?.team) return null;
  const st = comp.status?.type;
  const final = Boolean(st?.completed);
  const live = !final && st?.state === "in";
  const count = Math.max(awayC.linescores?.length ?? 0, homeC.linescores?.length ?? 0);
  const periods = periodLabels(path, count);
  const away = summarySide(awayC, periods);
  const home = summarySide(homeC, periods);
  const abbrevOf = (id: string | undefined) => (id === away.id ? away.abbrev : id === home.id ? home.abbrev : "");
  const scoring = (data.plays ?? [])
    .filter((p) => p.scoringPlay && /goal/i.test(p.type?.text ?? ""))
    .map((p) => {
      const scorer = p.participants?.find((x) => x.type === "scorer")?.athlete;
      return { team: abbrevOf(p.team?.id), text: `${agateName(scorer)} ${p.clock?.displayValue ?? ""}`.trim() };
    });
  const winnerId = away.winner ? away.id : home.winner ? home.id : null;
  const featured = comp.status?.featuredAthletes ?? [];
  const decisions: BoxGame["decisions"] = [];
  const have = new Set<string>();
  for (const f of featured) {
    if (!f.athlete?.id && !f.athlete?.displayName) continue;
    const code = featuredDecisionLabel(f.name ?? "");
    if (!code || have.has(code)) continue;
    have.add(code);
    decisions.push({
      label: code,
      person: {
        id: f.athlete.id ?? null,
        name: f.athlete.displayName || agateName(f.athlete),
        line: null,
        headshot: headshotOf(f.athlete),
      },
    });
  }
  return {
    id: `${path}-${eventId}`,
    path,
    league: leagueCode(path),
    day: (comp.date ?? "").slice(0, 10),
    startIso: comp.date ?? null,
    status: st?.shortDetail || st?.detail || (final ? "Final" : "Scheduled"),
    final,
    live,
    venue: data.gameInfo?.venue?.fullName ?? null,
    round: comp.notes?.find((n) => n.headline)?.headline ?? null,
    series: comp.series?.summary ?? null,
    periods,
    away,
    home,
    decisions,
    probables: { away: null, home: null },
    leaders: summaryLeaders(data, winnerId),
    scoring: path.startsWith("hockey/") ? scoring : [],
    recap: null,
    broadcasts: [],
    gamePk: null,
    espnEventId: eventId,
    href: espnGameHref(path, eventId),
  };
}

/** A stat block cut down to the columns the paper prints, in its order. */
function featuredDecisionLabel(name: string): "W" | "L" | "S" | null {
  const n = name.replace(/[\s_-]/g, "");
  if (/save/i.test(n)) return "S";
  if (/winning/i.test(n)) return "W";
  if (/losing/i.test(n)) return "L";
  return null;
}

/** ESPN pitcher notes look like `W, 1-0`, `L, 0-1, B, 1`, `S, 12`. Holds stay off. */
export function pitchingDecisionCode(text: string | null | undefined): "W" | "L" | "S" | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  if (/^(?:S|SV|SAVE)\b/i.test(t) || /^save\b/i.test(t)) return "S";
  if (/^W\b/i.test(t)) return "W";
  if (/^L\b/i.test(t)) return "L";
  return null;
}

function blockTable(
  block: SumStatBlock | undefined,
  title: string,
  cols: { from: string; as?: string }[],
  opts: { limit?: number; note?: (a: SumAthlete, row: SumAthleteRow) => string | null; totals?: boolean } = {},
): AgateTable | null {
  if (!block?.athletes?.length) return null;
  const labels = block.labels ?? [];
  const idx = cols.map((c) => labels.indexOf(c.from));
  const pick = (stats: string[] | undefined) => idx.map((i) => (i >= 0 ? (stats?.[i] ?? "") : "")).map((v) => (v === "--" ? "" : v));
  const rows = block.athletes.slice(0, opts.limit ?? block.athletes.length).map((a) => ({
    id: a.athlete?.id ?? null,
    name: agateName(a.athlete),
    note: opts.note?.(a.athlete ?? {}, a) ?? null,
    cells: pick(a.stats),
  }));
  const showTotals = opts.totals !== false && (block.totals?.length ?? 0) > 0 && block.athletes.length > 1;
  return {
    title,
    columns: cols.map((c) => c.as ?? c.from),
    rows,
    totals: showTotals ? pick(block.totals) : null,
  };
}

const NFL_BLOCKS: { key: string; label: string; cols: { from: string; as?: string }[]; limit?: number }[] = [
  {
    key: "passing",
    label: "Passing",
    cols: [{ from: "C/ATT" }, { from: "YDS" }, { from: "TD" }, { from: "INT" }, { from: "SACKS", as: "SK" }, { from: "RTG" }],
  },
  { key: "rushing", label: "Rushing", cols: [{ from: "CAR" }, { from: "YDS" }, { from: "AVG" }, { from: "TD" }, { from: "LONG", as: "LG" }] },
  {
    key: "receiving",
    label: "Receiving",
    cols: [{ from: "REC" }, { from: "YDS" }, { from: "TD" }, { from: "LONG", as: "LG" }, { from: "TGTS", as: "TGT" }],
  },
  { key: "fumbles", label: "Fumbles", cols: [{ from: "FUM" }, { from: "LOST" }, { from: "REC" }] },
  {
    key: "defensive",
    label: "Defense",
    cols: [{ from: "TOT" }, { from: "SOLO" }, { from: "SACKS", as: "SK" }, { from: "TFL" }, { from: "PD" }, { from: "QB HTS", as: "QBH" }],
    limit: 8,
  },
  { key: "interceptions", label: "Interceptions", cols: [{ from: "INT" }, { from: "YDS" }, { from: "TD" }] },
  { key: "kicking", label: "Kicking", cols: [{ from: "FG" }, { from: "PCT" }, { from: "LONG", as: "LG" }, { from: "XP" }, { from: "PTS" }] },
  { key: "punting", label: "Punting", cols: [{ from: "NO" }, { from: "YDS" }, { from: "AVG" }, { from: "In 20", as: "I20" }, { from: "LONG", as: "LG" }] },
  { key: "kickReturns", label: "Kick returns", cols: [{ from: "NO" }, { from: "YDS" }, { from: "AVG" }, { from: "LONG", as: "LG" }, { from: "TD" }] },
  { key: "puntReturns", label: "Punt returns", cols: [{ from: "NO" }, { from: "YDS" }, { from: "AVG" }, { from: "LONG", as: "LG" }, { from: "TD" }] },
];

const NBA_TEAM_STATS: { name: string; label: string; sub?: boolean }[] = [
  { name: "fieldGoalsMade-fieldGoalsAttempted", label: "FG" },
  { name: "fieldGoalPct", label: "FG%" },
  { name: "threePointFieldGoalsMade-threePointFieldGoalsAttempted", label: "3PT" },
  { name: "threePointFieldGoalPct", label: "3P%", sub: true },
  { name: "freeThrowsMade-freeThrowsAttempted", label: "FT" },
  { name: "rebounds", label: "Rebounds" },
  { name: "offensiveRebounds", label: "Offensive", sub: true },
  { name: "defensiveRebounds", label: "Defensive", sub: true },
  { name: "assists", label: "Assists" },
  { name: "steals", label: "Steals" },
  { name: "blocks", label: "Blocks" },
  { name: "turnovers", label: "Turnovers" },
  { name: "totalTurnovers", label: "Turnovers" },
  { name: "points", label: "Points" },
];

function nbaPlayers(blocks: SumStatBlock[], title: string): AgateTable | null {
  const want = [
    { from: "MIN" },
    { from: "PTS" },
    { from: "REB" },
    { from: "AST" },
    { from: "FG" },
    { from: "3PT" },
  ];
  const rows: AgateRow[] = [];
  let columns: string[] = want.map((c) => c.from);
  for (const block of blocks) {
    if (!block.athletes?.length) continue;
    const labels = block.labels ?? [];
    if (!labels.includes("MIN") && !labels.includes("PTS")) continue;
    const idx = want.map((c) => labels.indexOf(c.from));
    if (idx.every((i) => i < 0)) continue;
    columns = want.map((c) => c.from);
    for (const a of block.athletes) {
      if (rows.some((r) => r.id && r.id === a.athlete?.id)) continue;
      const cells = idx.map((i) => (i >= 0 ? (a.stats?.[i] ?? "") : "")).map((v) => (v === "--" ? "" : v));
      if (cells.every((c) => !c)) continue;
      rows.push({
        id: a.athlete?.id ?? null,
        name: agateName(a.athlete),
        note: a.athlete?.position?.abbreviation?.toLowerCase() ?? null,
        sub: /bench/i.test(block.name ?? ""),
        cells,
      });
    }
  }
  if (!rows.length) return null;
  const tot = blocks.find((b) => b.totals?.length && (b.labels?.includes("PTS") || b.labels?.includes("MIN")));
  const totals = tot
    ? want.map((c) => {
        const i = (tot.labels ?? []).indexOf(c.from);
        return i >= 0 ? (tot.totals?.[i] ?? "") : "";
      })
    : null;
  return { title, columns, rows, totals };
}

function mlbBatters(blocks: SumStatBlock[], title: string): AgateTable | null {
  const block = blocks.find((b) => /batting|hitters/i.test(b.name ?? "")) ?? blocks.find((b) => (b.labels ?? []).includes("AB"));
  return blockTable(
    block,
    title,
    [
      { from: "AB" },
      { from: "R" },
      { from: "H" },
      { from: "RBI", as: "RBI" },
      { from: "BB" },
      { from: "K", as: "SO" },
      { from: "AVG", as: "AVG" },
    ],
    { note: (a) => a.position?.abbreviation?.toLowerCase() ?? null },
  );
}

function mlbPitchers(blocks: SumStatBlock[], title: string, decisions: Map<string, string>): AgateTable | null {
  const block = blocks.find((b) => /pitching|pitchers/i.test(b.name ?? "")) ?? blocks.find((b) => (b.labels ?? []).includes("IP"));
  return blockTable(
    block,
    title,
    [{ from: "IP" }, { from: "H" }, { from: "R" }, { from: "ER" }, { from: "BB" }, { from: "K", as: "SO" }],
    {
      totals: false,
      note: (a, row) => {
        const fromMap = a.id && decisions.get(a.id);
        const fromNote = (row.notes ?? [])
          .map((n) => pitchingDecisionCode(n.text))
          .find((c): c is "W" | "L" | "S" => Boolean(c));
        return fromMap || fromNote || null;
      },
    },
  );
}

function mlbScoring(data: SummaryRaw, game: BoxGame, people: Map<string, string>): ScoringPeriod[] {
  const plays = (data.scoringPlays?.length ? data.scoringPlays : data.plays ?? []).filter((p) => p.scoringPlay);
  const byInning = new Map<number, ScoringPlay[]>();
  for (const p of plays) {
    const n = p.period?.number ?? 0;
    const side = p.team?.id === game.home.id ? "home" : "away";
    const text = (p.text ?? "").trim();
    const kind = p.scoringType?.abbreviation || p.type?.abbreviation || null;
    const list = byInning.get(n) ?? [];
    list.push({
      side,
      team: (side === "home" ? game.home : game.away).abbrev,
      clock: p.period?.displayValue ?? (n ? `${n}` : ""),
      tag: kind && kind.length <= 4 ? kind : null,
      lead: linkNames(text, people),
      detail: [],
      score: `${p.awayScore ?? 0}-${p.homeScore ?? 0}`,
    });
    byInning.set(n, list);
  }
  return [...byInning.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([n, periodPlays]) => ({
      label: n ? `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}` : "Scoring",
      plays: periodPlays,
    }));
}

const NFL_TEAM_STATS: { name: string; label: string; sub?: boolean }[] = [
  { name: "firstDowns", label: "First downs" },
  { name: "thirdDownEff", label: "Third down" },
  { name: "fourthDownEff", label: "Fourth down" },
  { name: "totalOffensivePlays", label: "Total plays" },
  { name: "totalYards", label: "Total yards" },
  { name: "netPassingYards", label: "Passing" },
  { name: "completionAttempts", label: "Comp/Att", sub: true },
  { name: "sacksYardsLost", label: "Sacked–yds", sub: true },
  { name: "rushingYards", label: "Rushing" },
  { name: "rushingAttempts", label: "Attempts", sub: true },
  { name: "yardsPerRushAttempt", label: "Per rush", sub: true },
  { name: "redZoneAttempts", label: "Red zone" },
  { name: "totalPenaltiesYards", label: "Penalties–yds" },
  { name: "turnovers", label: "Turnovers" },
  { name: "fumblesLost", label: "Fumbles lost", sub: true },
  { name: "interceptions", label: "Int. thrown", sub: true },
  { name: "possessionTime", label: "Possession" },
];

function nhlTeamStats(get: (side: "away" | "home", name: string) => string): StatLine[] {
  const both = (label: string, fn: (s: "away" | "home") => string, sub?: boolean): StatLine => ({
    label,
    away: fn("away"),
    home: fn("home"),
    sub,
  });
  return [
    both("Shots on goal", (s) => get(s, "shotsTotal")),
    both("Power plays", (s) => {
      const g = get(s, "powerPlayGoals");
      const o = get(s, "powerPlayOpportunities");
      return g && o ? `${g}-${o}` : "";
    }),
    both("Shorthanded goals", (s) => get(s, "shortHandedGoals"), true),
    both("Faceoffs won", (s) => {
      const w = get(s, "faceoffsWon");
      const pct = get(s, "faceoffPercent");
      return w ? (pct ? `${w} (${Math.round(Number(pct))}%)` : w) : "";
    }),
    both("Hits", (s) => get(s, "hits")),
    both("Blocked shots", (s) => get(s, "blockedShots")),
    both("Giveaways", (s) => get(s, "giveaways")),
    both("Takeaways", (s) => get(s, "takeaways")),
    both("Penalty minutes", (s) => get(s, "penaltyMinutes")),
  ];
}

function sumColumn(rows: AgateRow[], i: number): string {
  return String(rows.reduce((t, r) => t + (Number.parseInt(r.cells[i] ?? "", 10) || 0), 0));
}

function nhlSkaters(blocks: SumStatBlock[], title: string): AgateTable | null {
  const cols = ["G", "A", "PTS", "+/-", "SOG", "HIT", "BS", "PIM", "TOI"];
  const rows: AgateRow[] = [];
  for (const block of blocks.filter((b) => /forwards|defenses|skaters/i.test(b.name ?? ""))) {
    const labels = block.labels ?? [];
    const at = (stats: string[] | undefined, label: string) => {
      const i = labels.indexOf(label);
      return i >= 0 ? (stats?.[i] ?? "") : "";
    };
    for (const a of block.athletes ?? []) {
      if (rows.some((r) => r.id === a.athlete?.id)) continue;
      const g = Number.parseInt(at(a.stats, "G"), 10) || 0;
      const ast = Number.parseInt(at(a.stats, "A"), 10) || 0;
      rows.push({
        id: a.athlete?.id ?? null,
        name: agateName(a.athlete),
        note: a.athlete?.position?.abbreviation?.toLowerCase() ?? null,
        cells: [
          String(g),
          String(ast),
          String(g + ast),
          at(a.stats, "+/-"),
          at(a.stats, "S"),
          at(a.stats, "HT"),
          at(a.stats, "BS"),
          at(a.stats, "PIM"),
          at(a.stats, "TOI"),
        ],
      });
    }
  }
  if (!rows.length) return null;
  const totals = cols.map((c, i) => (c === "+/-" || c === "TOI" ? "" : sumColumn(rows, i)));
  return { title, columns: cols, rows, totals };
}

function nhlGoalies(blocks: SumStatBlock[], title: string, decisions: Map<string, string>): AgateTable | null {
  const block = blocks.find((b) => /goalies/i.test(b.name ?? ""));
  return blockTable(
    block,
    title,
    [{ from: "SA" }, { from: "GA" }, { from: "SV" }, { from: "SV%" }, { from: "TOI" }],
    { totals: false, note: (a) => (a.id && decisions.get(a.id) ? `(${decisions.get(a.id)})` : null) },
  );
}

const ORDINAL = ["First", "Second", "Third", "Fourth"];

function periodName(path: string, n: number): string {
  const hockey = path.startsWith("hockey/");
  if (n <= (hockey ? 3 : 4)) return `${ORDINAL[n - 1]} ${hockey ? "period" : "quarter"}`;
  const extra = n - (hockey ? 3 : 4);
  if (hockey && extra >= 2) return "Shootout";
  return extra === 1 ? "Overtime" : `Overtime ${extra}`;
}

/** Splits copy into text and the box score's own people, so names can be clicked. */
export function linkNames(text: string, people: Map<string, string>): NamePiece[] {
  const names = [...people.keys()].filter((n) => n.length > 3).sort((a, b) => b.length - a.length);
  if (!names.length || !text) return [text];
  const re = new RegExp(`(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  const out: NamePiece[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    out.push({ id: people.get(m[0])!, name: m[0] });
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function nflScoring(data: SummaryRaw, path: string, game: BoxGame, people: Map<string, string>): ScoringPeriod[] {
  const byPeriod = new Map<number, ScoringPlay[]>();
  for (const p of data.scoringPlays ?? []) {
    const n = p.period?.number ?? 0;
    const side = p.team?.id === game.home.id ? "home" : "away";
    const text = (p.text ?? "").trim();
    const split = text.match(/^(.*?)\s*(\([^)]*\))\s*$/);
    const kind = p.scoringType?.abbreviation || p.type?.abbreviation || null;
    const list = byPeriod.get(n) ?? [];
    list.push({
      side,
      team: (side === "home" ? game.home : game.away).abbrev,
      clock: p.clock?.displayValue ?? "",
      tag: kind && kind.length <= 3 ? kind : null,
      lead: linkNames(split ? split[1]! : text, people),
      detail: split ? linkNames(split[2]!, people) : [],
      score: `${p.awayScore ?? 0}-${p.homeScore ?? 0}`,
    });
    byPeriod.set(n, list);
  }
  return [...byPeriod.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([n, plays]) => ({ label: periodName(path, n), plays }));
}

function nhlScoring(data: SummaryRaw, path: string, game: BoxGame): ScoringPeriod[] {
  const byPeriod = new Map<number, ScoringPlay[]>();
  for (const p of data.plays ?? []) {
    if (!p.scoringPlay || !/goal/i.test(p.type?.text ?? "")) continue;
    const n = p.period?.number ?? 0;
    const side = p.team?.id === game.home.id ? "home" : "away";
    const scorer = p.participants?.find((x) => x.type === "scorer");
    const assists = (p.participants ?? []).filter((x) => x.type === "assister" && x.athlete);
    const text = p.text ?? "";
    const strength = p.strength?.abbreviation ?? "";
    const tag = /empty.net/i.test(text)
      ? "EN"
      : strength === "power-play"
        ? "PP"
        : strength === "short-handed"
          ? "SH"
          : /penalty shot/i.test(text)
            ? "PS"
            : null;
    const shot = text.match(/Goal \(\d+\)\s*([^,]+)/)?.[1]?.trim() ?? null;
    const lead: NamePiece[] = scorer?.athlete?.id
      ? [{ id: scorer.athlete.id, name: scorer.athlete.displayName || agateName(scorer.athlete) }]
      : [text.replace(/\s+Goal.*$/, "") || "Goal"];
    if (scorer?.ytdGoals != null) lead.push(` (${scorer.ytdGoals})`);
    if (shot) lead.push(`, ${shot.toLowerCase()}`);
    const detail: NamePiece[] = [];
    if (assists.length) {
      detail.push("Assists: ");
      assists.forEach((a, i) => {
        if (i) detail.push(", ");
        const name = a.athlete!.displayName || agateName(a.athlete);
        detail.push(a.athlete!.id ? { id: a.athlete!.id, name } : name);
      });
    } else {
      detail.push("Unassisted");
    }
    const list = byPeriod.get(n) ?? [];
    list.push({
      side,
      team: (side === "home" ? game.home : game.away).abbrev,
      clock: p.clock?.displayValue ?? "",
      tag,
      lead,
      detail,
      score: `${p.awayScore ?? 0}-${p.homeScore ?? 0}`,
    });
    byPeriod.set(n, list);
  }
  return [...byPeriod.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([n, plays]) => ({ label: periodName(path, n), plays }));
}

function nhlShots(data: SummaryRaw, game: BoxGame, totals: { away: string; home: string }): PeriodShots | null {
  const counts = new Map<number, { away: number; home: number }>();
  for (const p of data.plays ?? []) {
    const kind = p.type?.text ?? "";
    if (kind !== "Shot" && kind !== "Goal") continue;
    const n = p.period?.number ?? 0;
    if (n < 1 || /SO|shootout/i.test(p.period?.displayValue ?? "")) continue;
    const c = counts.get(n) ?? { away: 0, home: 0 };
    if (p.team?.id === game.home.id) c.home += 1;
    else if (p.team?.id === game.away.id) c.away += 1;
    counts.set(n, c);
  }
  if (!counts.size) return null;
  const top = Math.max(3, ...counts.keys());
  const nums = Array.from({ length: top }, (_, i) => i + 1);
  return {
    periods: nums.map((n) => (n <= 3 ? String(n) : n === 4 ? "OT" : `${n - 3}OT`)),
    away: nums.map((n) => counts.get(n)?.away ?? null),
    home: nums.map((n) => counts.get(n)?.home ?? null),
    awayTotal: totals.away,
    homeTotal: totals.home,
  };
}

function collectPeople(blocks: SumStatBlock[]): Map<string, string> {
  const people = new Map<string, string>();
  for (const block of blocks) {
    for (const a of block.athletes ?? []) {
      const id = a.athlete?.id;
      if (!id) continue;
      for (const n of [a.athlete?.displayName, a.athlete?.fullName]) if (n) people.set(n, id);
    }
  }
  return people;
}

function boxInfo(data: SummaryRaw): { label: string; value: string }[] {
  const gi = data.gameInfo;
  const officials = (role: RegExp) =>
    (gi?.officials ?? [])
      .filter((o) => role.test(o.position?.displayName ?? ""))
      .map((o) => o.displayName || o.fullName || "")
      .filter(Boolean);
  const info: { label: string; value: string }[] = [];
  const refs = officials(/^referee$/i);
  if (refs.length) info.push({ label: refs.length > 1 ? "Referees" : "Referee", value: refs.join(", ") });
  const lines = officials(/linesm/i);
  if (lines.length) info.push({ label: "Linesmen", value: lines.join(", ") });
  if (gi?.weather?.displayValue) {
    info.push({ label: "Weather", value: `${gi.weather.temperature != null ? `${gi.weather.temperature}°, ` : ""}${gi.weather.displayValue}` });
  }
  if (gi?.venue?.fullName) info.push({ label: "Site", value: gi.venue.fullName });
  if (gi?.attendance) info.push({ label: "Att", value: gi.attendance.toLocaleString("en-US") });
  return info;
}

/** Box score off ESPN's game summary: lines, scoring, team stats and agate. */
export async function fetchEspnBox(path: string, eventId: string): Promise<EspnBox | null> {
  const data = await fetchEspnSummary<SummaryRaw>(path, eventId);
  if (!data) return null;
  const game = headerGame(path, data, eventId);
  if (!game) return null;
  const hockey = path.startsWith("hockey/");
  const baseball = path.startsWith("baseball/");
  const basketball = path.startsWith("basketball/");
  const players = data.boxscore?.players ?? [];
  const blocksOf = (side: BoxSide) => players.find((p) => p.team?.id === side.id)?.statistics ?? [];
  const awayBlocks = blocksOf(game.away);
  const homeBlocks = blocksOf(game.home);
  const people = collectPeople([...awayBlocks, ...homeBlocks]);

  const featured = data.header?.competitions?.[0]?.status?.featuredAthletes ?? [];
  const decisions = new Map<string, string>();
  for (const f of featured) {
    if (!f.athlete?.id) continue;
    const code = featuredDecisionLabel(f.name ?? "");
    if (!code) continue;
    decisions.set(
      f.athlete.id,
      code === "L" && hockey && game.periods.length > 3 ? "OTL" : code,
    );
  }
  for (const block of [...awayBlocks, ...homeBlocks]) {
    for (const a of block.athletes ?? []) {
      if (!a.athlete?.id || decisions.has(a.athlete.id)) continue;
      const code = (a.notes ?? []).map((n) => pitchingDecisionCode(n.text)).find((c): c is "W" | "L" | "S" => Boolean(c));
      if (code) decisions.set(a.athlete.id, code);
    }
  }
  const haveDecision = new Set(game.decisions.map((d) => d.label));
  for (const block of [...awayBlocks, ...homeBlocks]) {
    for (const a of block.athletes ?? []) {
      const code = (a.notes ?? []).map((n) => pitchingDecisionCode(n.text)).find((c): c is "W" | "L" | "S" => Boolean(c));
      if (!code || haveDecision.has(code) || !a.athlete) continue;
      haveDecision.add(code);
      game.decisions.push({
        label: code,
        person: {
          id: a.athlete.id ?? null,
          name: agateName(a.athlete),
          line: null,
          headshot: headshotOf(a.athlete),
        },
      });
    }
  }
  const abbrevOf = (id: string | undefined) => (id === game.away.id ? game.away.abbrev : id === game.home.id ? game.home.abbrev : null);
  const stars: StarPick[] = ["firstStar", "secondStar", "thirdStar"]
    .map((key, i): StarPick | null => {
      const f = featured.find((x) => x.name === key);
      if (!f?.athlete) return null;
      return {
        rank: i + 1,
        team: abbrevOf(f.team?.id),
        person: {
          id: f.athlete.id ?? null,
          name: f.athlete.displayName || agateName(f.athlete),
          line: null,
          headshot: headshotOf(f.athlete),
        },
      };
    })
    .filter((s): s is StarPick => s != null);

  const teamRaw = data.boxscore?.teams ?? [];
  const statOf = (side: "away" | "home", name: string) => {
    const id = game[side].id;
    const t = teamRaw.find((x) => x.team?.id === id) ?? teamRaw.find((x) => x.homeAway === side);
    return t?.statistics?.find((s) => s.name === name)?.displayValue ?? "";
  };
  if (baseball) {
    if (!game.away.hits) game.away.hits = statOf("away", "hits") || null;
    if (!game.home.hits) game.home.hits = statOf("home", "hits") || null;
    if (!game.away.errors) game.away.errors = statOf("away", "errors") || null;
    if (!game.home.errors) game.home.errors = statOf("home", "errors") || null;
  }
  const teamRows = hockey
    ? nhlTeamStats(statOf)
    : basketball
      ? NBA_TEAM_STATS.map((s) => ({ label: s.label, away: statOf("away", s.name), home: statOf("home", s.name), sub: s.sub }))
      : baseball
        ? []
        : NFL_TEAM_STATS.map((s) => ({ label: s.label, away: statOf("away", s.name), home: statOf("home", s.name), sub: s.sub }));
  const seenStat = new Set<string>();
  const teamStats = teamRows.filter((s) => {
    if (s.away === "" && s.home === "") return false;
    if (seenStat.has(s.label)) return false;
    seenStat.add(s.label);
    return true;
  });

  const pairs: AgatePair[] = hockey
    ? [
        { key: "skaters", label: null, away: nhlSkaters(awayBlocks, game.away.short), home: nhlSkaters(homeBlocks, game.home.short) },
        {
          key: "goalies",
          label: "Goaltending",
          away: nhlGoalies(awayBlocks, game.away.short, decisions),
          home: nhlGoalies(homeBlocks, game.home.short, decisions),
        },
      ]
    : baseball
      ? [
          { key: "batting", label: "Batting", away: mlbBatters(awayBlocks, game.away.short), home: mlbBatters(homeBlocks, game.home.short) },
          { key: "pitching", label: "Pitching", away: mlbPitchers(awayBlocks, game.away.short, decisions), home: mlbPitchers(homeBlocks, game.home.short, decisions) },
        ]
      : basketball
        ? [{ key: "players", label: null, away: nbaPlayers(awayBlocks, game.away.short), home: nbaPlayers(homeBlocks, game.home.short) }]
        : NFL_BLOCKS.map((b) => ({
            key: b.key,
            label: b.label,
            away: blockTable(awayBlocks.find((x) => x.name === b.key), game.away.short, b.cols, { limit: b.limit }),
            home: blockTable(homeBlocks.find((x) => x.name === b.key), game.home.short, b.cols, { limit: b.limit }),
          }));

  const scoring = hockey
    ? nhlScoring(data, path, game)
    : baseball
      ? mlbScoring(data, game, people)
      : nflScoring(data, path, game, people);

  return {
    game,
    pairs: pairs.filter((p) => p.away || p.home),
    teamStats,
    scoring,
    shots: hockey ? nhlShots(data, game, { away: statOf("away", "shotsTotal"), home: statOf("home", "shotsTotal") }) : null,
    stars,
    info: boxInfo(data),
  };
}

export const ESPN_BOX_PATHS = new Set([
  "football/nfl",
  "football/college-football",
  "hockey/nhl",
  "basketball/nba",
  "baseball/mlb",
]);

const KEY_STATS: Record<string, string[]> = {
  "football/nfl": ["Total yards", "Turnovers", "Third down", "Possession"],
  "football/college-football": ["Total yards", "Turnovers", "Third down", "Possession"],
  "hockey/nhl": ["Shots on goal", "Power plays", "Faceoffs won", "Hits"],
  "basketball/nba": ["Points", "Rebounds", "Assists", "Turnovers"],
};

/** The handful of team numbers the top box runs under the line. */
export function keyStats(box: EspnBox): StatLine[] {
  const want = KEY_STATS[box.game.path] ?? [];
  return want.map((label) => box.teamStats.find((s) => s.label === label)).filter((s): s is StatLine => Boolean(s));
}

/** Where to break the team stats into two columns without orphaning an indented line. */
export function statSplit(rows: StatLine[]): number {
  const mid = Math.ceil(rows.length / 2);
  for (let d = 0; d < rows.length; d++) {
    for (const at of [mid - d, mid + d]) {
      if (at > 0 && at < rows.length && !rows[at]?.sub) return at;
    }
  }
  return rows.length;
}

function escPrint(s: string): string {
  return s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]!));
}

function pieceText(pieces: NamePiece[]): string {
  return pieces.map((p) => (typeof p === "string" ? p : p.name)).join("");
}

function printTable(table: AgateTable): string {
  const head = `<tr><th class="n">${escPrint(table.title)}</th>${table.columns.map((c) => `<th>${escPrint(c)}</th>`).join("")}</tr>`;
  const rows = table.rows
    .map((r) => {
      const name = `${r.lead ? `<i class="lead">${escPrint(r.lead)}</i>` : ""}${escPrint(r.name)}${r.note ? `<i> ${escPrint(r.note)}</i>` : ""}`;
      return `<tr class="${r.sub ? "sub" : ""}"><td class="n">${name}</td>${r.cells.map((c) => `<td>${escPrint(c)}</td>`).join("")}</tr>`;
    })
    .join("");
  const foot = table.totals
    ? `<tfoot><tr class="tot"><td class="n">Totals</td>${table.totals.map((c) => `<td>${escPrint(c)}</td>`).join("")}</tr></tfoot>`
    : "";
  return `<table class="tt-print-agate"><thead>${head}</thead><tbody>${rows}</tbody>${foot}</table>`;
}

/**
 * Fully expanded newspaper box: scoring plays, team stats, and every
 * club's player table. Used by proofs and any print path — never a count stub.
 */
export function printEspnBoxHtml(box: EspnBox): string {
  const parts: string[] = [];
  if (box.scoring.length) {
    const periods = box.scoring
      .map((period) => {
        const plays = period.plays
          .map((play) => {
            const detail = play.detail.length ? ` <i>${escPrint(pieceText(play.detail))}</i>` : "";
            return `<tr><td class="n">${escPrint(play.team)}</td><td>${escPrint(play.clock)}</td><td class="n play">${escPrint(pieceText(play.lead))}${detail}</td><td>${play.tag ? escPrint(play.tag) : ""}</td><td>${escPrint(play.score)}</td></tr>`;
          })
          .join("");
        return `<tbody><tr class="per"><th colspan="5">${escPrint(period.label)}</th></tr>${plays}</tbody>`;
      })
      .join("");
    parts.push(
      `<div class="tt-print-group"><h4>Scoring</h4><table class="tt-print-agate plays"><thead><tr><th class="n">Team</th><th>Time</th><th class="n">Play</th><th></th><th>${escPrint(box.game.away.abbrev)}-${escPrint(box.game.home.abbrev)}</th></tr></thead>${periods}</table></div>`,
    );
  }
  if (box.teamStats.length) {
    const rows = box.teamStats
      .map(
        (s) =>
          `<tr class="${s.sub ? "sub" : ""}"><td class="n">${escPrint(s.label)}</td><td>${escPrint(s.away)}</td><td>${escPrint(s.home)}</td></tr>`,
      )
      .join("");
    parts.push(
      `<div class="tt-print-group"><h4>Team stats</h4><table class="tt-print-agate"><thead><tr><th class="n"></th><th>${escPrint(box.game.away.abbrev)}</th><th>${escPrint(box.game.home.abbrev)}</th></tr></thead><tbody>${rows}</tbody></table></div>`,
    );
  }
  if (box.shots) {
    const head = [...box.shots.periods, "T"].map((p) => `<th>${escPrint(p)}</th>`).join("");
    const away = [...box.shots.away.map((v) => (v == null ? "–" : String(v))), box.shots.awayTotal]
      .map((c) => `<td>${escPrint(c)}</td>`)
      .join("");
    const home = [...box.shots.home.map((v) => (v == null ? "–" : String(v))), box.shots.homeTotal]
      .map((c) => `<td>${escPrint(c)}</td>`)
      .join("");
    parts.push(
      `<div class="tt-print-group"><h4>Shots on goal</h4><table class="tt-print-agate"><thead><tr><th class="n"></th>${head}</tr></thead><tbody><tr><td class="n">${escPrint(box.game.away.short)}</td>${away}</tr><tr><td class="n">${escPrint(box.game.home.short)}</td>${home}</tr></tbody></table></div>`,
    );
  }
  for (const pair of box.pairs) {
    if (!pair.away && !pair.home) continue;
    const twins = [pair.away, pair.home].filter((t): t is AgateTable => Boolean(t)).map(printTable).join("");
    parts.push(`<div class="tt-print-group twins">${pair.label ? `<h4>${escPrint(pair.label)}</h4>` : ""}${twins}</div>`);
  }
  if (box.info.length) {
    parts.push(
      `<p class="tt-print-notes">${box.info.map((n) => `<i>${escPrint(n.label)}</i> ${escPrint(n.value)}.`).join(" ")}</p>`,
    );
  }
  return parts.join("");
}
