/**
 * The Beez: Josh's adult rec hockey club, printed as its own Section A page
 * just before the viewing guide.
 *
 * One current row lives in public.times_beez. Every edition reprints it.
 * With no row (or a failed read), the page is left out and Section A looks
 * as it does today. The page is slotted in after buildEdition, the same way
 * The Day Ahead is, so the scheduled press never changes.
 *
 * Pure helpers only here (no Supabase), so tests run in node.
 */
import type { EditionPage, EditionSection } from "./newspaper-sections.ts";

const TZ = "America/Chicago";

export type BeezTeam = {
  name: string;
  rink: string | null;
  gp: number;
  w: number;
  l: number;
  t: number;
  otl: number;
  sol: number;
  pts: number;
  gf: number;
  ga: number;
  rank: number | null;
  of: number | null;
  streak: string | null;
};

export type BeezStanding = {
  team: string;
  gp: number;
  w: number;
  l: number;
  t: number;
  otl: number;
  otw: number;
  sol: number;
  pts: number;
  wpct: number | null;
  gf: number;
  ga: number;
  pim: number;
};

export type BeezSkater = {
  name: string;
  number: number | null;
  gp: number;
  g: number;
  a: number;
  p: number;
  pim: number;
  ppg: number | null;
  ptsg: number | null;
  is_josh: boolean;
};

/** Goalie rows may grow new columns; keep extras so the page can print them later. */
export type BeezGoalie = BeezSkater & Record<string, unknown>;

export type BeezLastGame = {
  date: string;
  time: string | null;
  game_no: number | null;
  stage: string | null;
  home: string;
  away: string;
  home_score: number | null;
  away_score: number | null;
  rink: string | null;
  periods: { home: number[]; away: number[] };
  shots: { home: number | null; away: number | null };
  pim: { home: number | null; away: number | null };
  referee: string | null;
  url: string | null;
};

export type BeezResult = {
  date: string;
  opponent: string;
  home_away: "home" | "away";
  beez: number | null;
  opp: number | null;
  result: "W" | "L" | "T" | null;
  rink: string | null;
  url: string | null;
};

export type BeezUpcoming = {
  date: string;
  time: string | null;
  opponent: string;
  home_away: "home" | "away";
  rink: string | null;
};

export type BeezDesk = {
  season: string | null;
  division: string | null;
  team: BeezTeam;
  standings: BeezStanding[];
  skaters: BeezSkater[];
  goalies: BeezGoalie[];
  last_game: BeezLastGame | null;
  results: BeezResult[];
  upcoming: BeezUpcoming[];
  source: string | null;
  updated_at: string | null;
};

export type BeezHeadline = {
  kicker: string;
  headline: string;
  dek: string;
};

/** The Beez page. Section A, folio set when it is slotted in. */
export type FavoritesBeezPage = {
  kind: "favorites-beez";
  folio: string;
  section: string;
  sectionTitle: string;
  sectionPage: number;
  sectionCount: number;
  jumpFolio?: string;
  desk: BeezDesk;
};

function asRecord(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
}

function str(raw: unknown): string {
  return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
}

function num(raw: unknown, fallback = 0): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() && Number.isFinite(Number(raw))) return Number(raw);
  return fallback;
}

function numOrNull(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() && Number.isFinite(Number(raw))) return Number(raw);
  return null;
}

function numList(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((n) => numOrNull(n)).filter((n): n is number => n != null);
}

function pair(raw: unknown): { home: number | null; away: number | null } {
  const obj = asRecord(raw);
  if (!obj) return { home: null, away: null };
  return { home: numOrNull(obj.home), away: numOrNull(obj.away) };
}

function isoDate(raw: unknown): string {
  const s = str(raw);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function homeAway(raw: unknown): "home" | "away" {
  return str(raw).toLowerCase() === "away" ? "away" : "home";
}

function resultMark(raw: unknown): "W" | "L" | "T" | null {
  const s = str(raw).toUpperCase();
  return s === "W" || s === "L" || s === "T" ? s : null;
}

function slimTeam(raw: unknown): BeezTeam {
  const o = asRecord(raw) ?? {};
  return {
    name: str(o.name) || "Beez",
    rink: str(o.rink) || null,
    gp: num(o.gp),
    w: num(o.w),
    l: num(o.l),
    t: num(o.t),
    otl: num(o.otl),
    sol: num(o.sol),
    pts: num(o.pts),
    gf: num(o.gf),
    ga: num(o.ga),
    rank: numOrNull(o.rank),
    of: numOrNull(o.of),
    streak: str(o.streak) || null,
  };
}

function slimStanding(raw: unknown): BeezStanding | null {
  const o = asRecord(raw);
  const team = o ? str(o.team) : "";
  if (!o || !team) return null;
  return {
    team,
    gp: num(o.gp),
    w: num(o.w),
    l: num(o.l),
    t: num(o.t),
    otl: num(o.otl),
    otw: num(o.otw),
    sol: num(o.sol),
    pts: num(o.pts),
    wpct: numOrNull(o.wpct),
    gf: num(o.gf),
    ga: num(o.ga),
    pim: num(o.pim),
  };
}

function slimSkater(raw: unknown): BeezSkater | null {
  const o = asRecord(raw);
  const name = o ? str(o.name) : "";
  if (!o || !name) return null;
  const pts = numOrNull(o.p);
  return {
    name,
    number: numOrNull(o.number),
    gp: num(o.gp),
    g: num(o.g),
    a: num(o.a),
    p: pts ?? num(o.g) + num(o.a),
    pim: num(o.pim),
    ppg: numOrNull(o.ppg),
    ptsg: numOrNull(o.ptsg),
    is_josh: o.is_josh === true,
  };
}

function slimGoalie(raw: unknown): BeezGoalie | null {
  const base = slimSkater(raw);
  const o = asRecord(raw);
  if (!base || !o) return null;
  return { ...o, ...base };
}

function slimLastGame(raw: unknown): BeezLastGame | null {
  const o = asRecord(raw);
  if (!o) return null;
  const home = str(o.home);
  const away = str(o.away);
  if (!home && !away) return null;
  const periods = asRecord(o.periods);
  return {
    date: isoDate(o.date),
    time: str(o.time) || null,
    game_no: numOrNull(o.game_no),
    stage: str(o.stage) || null,
    home,
    away,
    home_score: numOrNull(o.home_score),
    away_score: numOrNull(o.away_score),
    rink: str(o.rink) || null,
    periods: { home: numList(periods?.home), away: numList(periods?.away) },
    shots: pair(o.shots),
    pim: pair(o.pim),
    referee: str(o.referee) || null,
    url: str(o.url) || null,
  };
}

function slimResult(raw: unknown): BeezResult | null {
  const o = asRecord(raw);
  const opponent = o ? str(o.opponent) : "";
  if (!o || !opponent) return null;
  return {
    date: isoDate(o.date),
    opponent,
    home_away: homeAway(o.home_away),
    beez: numOrNull(o.beez),
    opp: numOrNull(o.opp),
    result: resultMark(o.result),
    rink: str(o.rink) || null,
    url: str(o.url) || null,
  };
}

function slimUpcoming(raw: unknown): BeezUpcoming | null {
  const o = asRecord(raw);
  const opponent = o ? str(o.opponent) : "";
  if (!o || !opponent) return null;
  return {
    date: isoDate(o.date),
    time: str(o.time) || null,
    opponent,
    home_away: homeAway(o.home_away),
    rink: str(o.rink) || null,
  };
}

/** A filed row, or null when the payload cannot be read as a desk. */
export function asBeezDesk(raw: unknown): BeezDesk | null {
  const o = asRecord(raw);
  if (!o) return null;
  return {
    season: str(o.season) || null,
    division: str(o.division) || null,
    team: slimTeam(o.team),
    standings: Array.isArray(o.standings) ? o.standings.flatMap((row) => slimStanding(row) ?? []) : [],
    skaters: Array.isArray(o.skaters) ? o.skaters.flatMap((row) => slimSkater(row) ?? []) : [],
    goalies: Array.isArray(o.goalies) ? o.goalies.flatMap((row) => slimGoalie(row) ?? []) : [],
    last_game: slimLastGame(o.last_game),
    results: Array.isArray(o.results) ? o.results.flatMap((row) => slimResult(row) ?? []) : [],
    upcoming: Array.isArray(o.upcoming) ? o.upcoming.flatMap((row) => slimUpcoming(row) ?? []) : [],
    source: str(o.source) || null,
    updated_at: typeof o.updated_at === "string" && o.updated_at.trim() ? o.updated_at.trim() : null,
  };
}

export function clubName(desk: BeezDesk): string {
  return desk.team.name || "Beez";
}

/** W-L, or W-L-T / W-L-OTL / W-L-T-OTL when those columns have games. */
export function hockeyRecord(team: Pick<BeezTeam, "w" | "l" | "t" | "otl" | "sol">): string {
  const parts = [String(team.w), String(team.l)];
  if (team.t) parts.push(String(team.t));
  if (team.otl) parts.push(String(team.otl));
  if (team.sol) parts.push(String(team.sol));
  return parts.join("-");
}

export function gamesPlayed(team: Pick<BeezTeam, "gp" | "w" | "l" | "t" | "otl" | "sol">): number {
  return team.gp || team.w + team.l + team.t + team.otl + team.sol;
}

function foldName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function namesMatch(a: string, b: string): boolean {
  const left = foldName(a);
  const right = foldName(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

export function isBeezRow(teamName: string, club: string): boolean {
  return namesMatch(teamName, club);
}

/** "8 p.m.", "7:30 a.m.", or TBA when the filed time is missing. */
export function clockOrTba(time: string | null | undefined): string {
  if (!time || !time.trim()) return "TBA";
  const t = time.trim();
  const m = /^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?$/i.exec(t);
  if (!m) return t;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h < 1 || h > 12 || min > 59) return t;
  const ap = m[3]!.toLowerCase() === "a" ? "a.m." : "p.m.";
  return min ? `${h}:${String(min).padStart(2, "0")} ${ap}` : `${h} ${ap}`;
}

const MONTHS = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];

/** "Sat., Oct. 11" from a YYYY-MM-DD, or the raw string if it is not a date. */
export function printDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date || "";
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  const wk = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  return `${wk}., ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function sourceLabel(source: string | null | undefined): string {
  const s = (source ?? "").trim();
  if (!s || /sportninja/i.test(s)) return "SportNinja";
  return s;
}

/** Agate stamp in Central time: "Oct. 5, 7:02 a.m. CT". */
export function updatedStamp(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const month = d.toLocaleDateString("en-US", { timeZone: TZ, month: "short" }).replace(/^\w+/, (m) => {
    const i = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(m);
    return i >= 0 ? MONTHS[i]! : m;
  });
  const day = d.toLocaleDateString("en-US", { timeZone: TZ, day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true });
  const clock = clockOrTba(time.replace(/\u202f/g, " "));
  return `${month} ${day}, ${clock} CT`;
}

export function creditLine(desk: BeezDesk): string {
  const src = `Source: ${sourceLabel(desk.source)}`;
  const when = updatedStamp(desk.updated_at);
  return when ? `${src} · updated ${when}` : src;
}

export function wpctLabel(wpct: number | null): string {
  if (wpct == null) return "—";
  const pct = wpct > 1 ? wpct / 100 : wpct;
  if (!Number.isFinite(pct)) return "—";
  return pct.toFixed(3).replace(/^0/, "");
}

type Decided = {
  opp: string;
  beez: number;
  oppScore: number;
  result: "W" | "L" | "T";
};

function fromLastGame(desk: BeezDesk): Decided | null {
  const game = desk.last_game;
  if (!game || game.home_score == null || game.away_score == null) return null;
  const name = clubName(desk);
  const home = namesMatch(game.home, name);
  const away = namesMatch(game.away, name);
  if (!home && !away) return null;
  const beez = home ? game.home_score : game.away_score;
  const oppScore = home ? game.away_score : game.home_score;
  const opp = home ? game.away : game.home;
  if (!opp) return null;
  const result: "W" | "L" | "T" = beez === oppScore ? "T" : beez > oppScore ? "W" : "L";
  return { opp, beez, oppScore, result };
}

function fromResult(row: BeezResult | undefined): Decided | null {
  if (!row || row.beez == null || row.opp == null) return null;
  const result = row.result ?? (row.beez === row.opp ? "T" : row.beez > row.opp ? "W" : "L");
  return { opp: row.opponent, beez: row.beez, oppScore: row.opp, result };
}

function scoreLead(name: string, game: Decided): string {
  const dash = `${Math.max(game.beez, game.oppScore)}–${Math.min(game.beez, game.oppScore)}`;
  if (game.result === "T") return `${name} and ${game.opp} skate to a ${game.beez}–${game.oppScore} draw`;
  const winner = game.result === "W" ? name : game.opp;
  const loser = game.result === "W" ? game.opp : name;
  if (game.beez === 0 || game.oppScore === 0) return `${winner} blanks ${loser} ${dash}`;
  const margin = Math.abs(game.beez - game.oppScore);
  if (game.result === "W") return `${name} ${margin === 1 ? "edge" : "top"} ${game.opp} ${game.beez}–${game.oppScore}`;
  return `${game.opp} ${margin === 1 ? "edges" : "tops"} ${name} ${game.oppScore}–${game.beez}`;
}

function recordTail(name: string, team: BeezTeam, result: Decided["result"] | null): string {
  if (!gamesPlayed(team)) return "";
  const rec = hockeyRecord(team);
  if (result === "W") return team.w === 1 ? `${name} pick up win No. 1, now ${rec}` : `${name} improve to ${rec}`;
  if (result === "L") return `${name} fall to ${rec}`;
  if (result === "T") return `${name} sit ${rec}`;
  return `${name} sit ${rec}`;
}

function kickerOf(desk: BeezDesk): string {
  const bits = [desk.season, desk.division].filter(Boolean);
  return bits.length ? bits.join(" · ") : "Adult Rec Hockey";
}

function dekOf(desk: BeezDesk, decided: Decided | null): string {
  const name = clubName(desk);
  const bits: string[] = [];
  if (desk.division && (desk.season || decided)) bits.push(desk.division);
  if (desk.team.rank != null && desk.team.of != null) bits.push(`No. ${desk.team.rank} of ${desk.team.of}`);
  else if (desk.team.rank != null) bits.push(`No. ${desk.team.rank}`);
  if (gamesPlayed(desk.team)) bits.push(`${desk.team.pts} ${desk.team.pts === 1 ? "pt" : "pts"}`);
  if (desk.team.streak) bits.push(desk.team.streak);
  if (desk.team.rink) bits.push(desk.team.rink);
  if (bits.length) return bits.join(" · ");
  if (desk.season) return `${name} · ${desk.season}`;
  return `${name} · adult rec hockey`;
}

/**
 * A rule-built hed from the filed row. No invented score, opponent, or record.
 * Last result plus the current ledger; an empty season says so.
 */
export function buildBeezHeadline(desk: BeezDesk): BeezHeadline {
  const name = clubName(desk);
  const kicker = kickerOf(desk);
  const decided = fromLastGame(desk) ?? fromResult(desk.results[0]);
  if (decided) {
    const lead = scoreLead(name, decided);
    const tail = recordTail(name, desk.team, decided.result);
    return { kicker, headline: tail ? `${lead}; ${tail}` : lead, dek: dekOf(desk, decided) };
  }
  if (gamesPlayed(desk.team)) {
    const rec = hockeyRecord(desk.team);
    const where = desk.division ? ` in ${desk.division}` : "";
    return { kicker, headline: `${name} sit ${rec}${where}`, dek: dekOf(desk, null) };
  }
  return {
    kicker,
    headline: `${name} await the first puck drop`,
    dek: dekOf(desk, null),
  };
}

/**
 * Slot the Beez page in right before the viewing guide (the last page of
 * Section A), renumbering the guide and Section A's page counts and shifting
 * later sections. No row, no guide: the edition comes back untouched.
 */
/** Made-up desk for tests and local renders. Not a live season. */
export function sampleBeezDesk(): BeezDesk {
  return {
    season: "Sample Rec Fall 2026",
    division: "Tin League",
    team: {
      name: "Beez",
      rink: "Sample Ice House",
      gp: 4,
      w: 0,
      l: 4,
      t: 0,
      otl: 0,
      sol: 0,
      pts: 0,
      gf: 5,
      ga: 16,
      rank: 8,
      of: 8,
      streak: "L4",
    },
    standings: [
      { team: "Icebox", gp: 4, w: 4, l: 0, t: 0, otl: 0, otw: 0, sol: 0, pts: 8, wpct: 1, gf: 18, ga: 4, pim: 18 },
      { team: "Harbor Club", gp: 4, w: 3, l: 1, t: 0, otl: 0, otw: 0, sol: 0, pts: 6, wpct: 0.75, gf: 14, ga: 8, pim: 22 },
      { team: "Northside", gp: 4, w: 2, l: 2, t: 0, otl: 0, otw: 0, sol: 0, pts: 4, wpct: 0.5, gf: 11, ga: 10, pim: 16 },
      { team: "Maple Rec", gp: 4, w: 1, l: 2, t: 1, otl: 0, otw: 0, sol: 0, pts: 3, wpct: 0.375, gf: 9, ga: 12, pim: 28 },
      { team: "Beez", gp: 4, w: 0, l: 4, t: 0, otl: 0, otw: 0, sol: 0, pts: 0, wpct: 0, gf: 5, ga: 16, pim: 24 },
    ],
    skaters: [
      { name: "A. Quill", number: 12, gp: 4, g: 2, a: 1, p: 3, pim: 2, ppg: 0.5, ptsg: 0.75, is_josh: false },
      { name: "Pat Harbor", number: 76, gp: 4, g: 1, a: 1, p: 2, pim: 4, ppg: 0.25, ptsg: 0.5, is_josh: true },
      { name: "R. Pike", number: 4, gp: 4, g: 1, a: 0, p: 1, pim: 6, ppg: 0.25, ptsg: 0.25, is_josh: false },
      { name: "M. Linden", number: 21, gp: 3, g: 0, a: 1, p: 1, pim: 0, ppg: 0, ptsg: 0.33, is_josh: false },
    ],
    goalies: [{ name: "C. Wells", number: 1, gp: 4, g: 0, a: 0, p: 0, pim: 0, ppg: null, ptsg: null, is_josh: false, gaa: 4.0, svpct: 0.872 }],
    last_game: {
      date: "2026-10-03",
      time: "8:00 PM",
      game_no: 4,
      stage: "Regular Season",
      home: "Beez",
      away: "Icebox",
      home_score: 0,
      away_score: 4,
      rink: "Sample Ice House",
      periods: { home: [0, 0, 0], away: [1, 1, 2] },
      shots: { home: 16, away: 31 },
      pim: { home: 8, away: 6 },
      referee: "A. Official",
      url: null,
    },
    results: [
      { date: "2026-10-03", opponent: "Icebox", home_away: "home", beez: 0, opp: 4, result: "L", rink: "Sample Ice House", url: null },
      { date: "2026-09-26", opponent: "Harbor Club", home_away: "away", beez: 2, opp: 5, result: "L", rink: "Harbor Rink", url: null },
      { date: "2026-09-19", opponent: "Northside", home_away: "home", beez: 1, opp: 3, result: "L", rink: "Sample Ice House", url: null },
      { date: "2026-09-12", opponent: "Maple Rec", home_away: "away", beez: 2, opp: 4, result: "L", rink: "Maple Gardens", url: null },
    ],
    upcoming: [
      { date: "2026-10-10", time: "8:15 PM", opponent: "Harbor Club", home_away: "away", rink: "Harbor Rink" },
      { date: "2026-10-17", time: null, opponent: "Northside", home_away: "home", rink: "Sample Ice House" },
      { date: "2026-10-24", time: "7:30 PM", opponent: "Maple Rec", home_away: "away", rink: null },
    ],
    source: "sportninja",
    updated_at: "2026-10-05T12:02:00Z",
  };
}

export function insertBeez<
  E extends { pages: (EditionPage | FavoritesBeezPage)[]; sections: EditionSection[] },
>(edition: E, desk: BeezDesk | null): E {
  if (!desk) return edition;
  const at = edition.pages.findIndex((p) => p.kind === "favorites-watch");
  if (at < 0) return edition;
  const watch = edition.pages[at]!;
  const n = watch.sectionPage;
  const count = watch.sectionCount + 1;
  const page: FavoritesBeezPage = {
    kind: "favorites-beez",
    folio: `${watch.section}${n}`,
    section: watch.section,
    sectionTitle: watch.sectionTitle,
    sectionPage: n,
    sectionCount: count,
    desk,
  };
  const pages = edition.pages.flatMap((item, i) => {
    if (item.section !== watch.section) return [item];
    if (i === at) return [page, { ...item, folio: `${watch.section}${n + 1}`, sectionPage: n + 1, sectionCount: count }];
    return [{ ...item, sectionCount: count }];
  });
  const sections = edition.sections.map((s) =>
    s.code === watch.section ? { ...s, pages: s.pages + 1 } : s.index > at ? { ...s, index: s.index + 1 } : s,
  );
  return { ...edition, pages, sections };
}
