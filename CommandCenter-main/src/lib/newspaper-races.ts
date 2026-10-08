/**
 * "Races We're Tracking": Missouri Senate briefs printed as their own Section A
 * page, right before The Day Ahead.
 *
 * One row per race per America/Chicago date lives in public.times_race_briefs.
 * Another desk files them before the 6 a.m. press. The reader queries the table
 * when the edition opens, the same way The Day Ahead and the Beez do, so the
 * scheduled press and its bundle never change.
 *
 * Prefer the edition's date. If that morning's rows are late, reprint the
 * newest brief_date inside the last two days and label it. With nothing on
 * file, the page is left out — no empty sheet, no placeholder.
 *
 * Pure helpers only here (no Supabase), so tests run in node.
 */
import { daysUntilElection, electionDayLabel } from "./newspaper-election.ts";
import type { EditionPage, EditionSection } from "./newspaper-sections.ts";

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

const AP_MONTH = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];

/** Designed sheet. Overflow continues; never stretch past the soft cap. */
export const RACES_SHEET_TARGET = 1480;
export const RACES_SHEET_CAP = 1650;
/** Mast + running head + sheet padding, subtracted from the sheet when packing. */
const SHEET_CHROME = 160;
const PAGE_HEAD = 118;
const PAGE_HEAD_CONTINUED = 88;

export type RaceSpend = {
  sponsor: string;
  side: string;
  station: string;
  market: string;
  amount: number;
  grps: number | null;
  cpp: number | null;
  flight_start: string | null;
  flight_end: string | null;
  is_new: boolean;
};

export type RaceLink = { label: string; url: string };

export type RaceNote = { source: string; text: string; url: string | null };

export type RaceBrief = {
  race: string;
  headline: string;
  bullets: string[];
  spend: RaceSpend[];
  links: RaceLink[];
  notes: RaceNote[];
  source: string | null;
  updated_at: string | null;
  /** Press copy, when the tt-copy row has a sentence for this race. */
  copy?: string | null;
};

/** One morning's slate, after the date fallback has already been applied. */
export type RaceBriefsDesk = {
  editionDate: string;
  briefDate: string;
  /** True when the edition date had no rows and a nearby morning was used. */
  stale: boolean;
  races: RaceBrief[];
};

export type FavoritesRacesPage = {
  kind: "favorites-races";
  folio: string;
  section: string;
  sectionTitle: string;
  sectionPage: number;
  sectionCount: number;
  jumpFolio?: string;
  editionDate: string;
  briefDate: string;
  stale: boolean;
  continued: boolean;
  races: RaceBrief[];
  /** Missouri Roundup box, printed under SD 8 / SD 30 on one sheet. */
  roundup?: RaceBrief | null;
  /** Name / date / status rows when the book is too long for a full brief each. */
  list?: RaceBrief[];
};

function asRecord(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
}

function str(raw: unknown): string {
  return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
}

function numOrNull(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() && Number.isFinite(Number(raw))) return Number(raw);
  return null;
}

function ymd(raw: unknown): string | null {
  const value = str(raw);
  return YMD.test(value) ? value : null;
}

/** Shift a YYYY-MM-DD by whole calendar days. */
export function shiftYmd(date: string, days: number): string | null {
  const match = YMD.exec(date);
  if (!match) return null;
  const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days);
  return new Date(utc).toISOString().slice(0, 10);
}

export function raceCode(race: string): string {
  return str(race).replace(/\s+/g, "").toUpperCase();
}

export function isMissouriRoundup(race: string): boolean {
  return raceCode(race) === "MOROUNDUP";
}

export function isSenateRace(race: string): boolean {
  return /^SD\d+$/.test(raceCode(race));
}

/** Amendment, proposition, and other statewide questions. Senate districts are not ballot measures. */
export function isBallotMeasure(race: string): boolean {
  const code = raceCode(race);
  if (!code || isSenateRace(code) || isMissouriRoundup(code)) return false;
  return /AMEND|PROP|ISSUE|MEASURE|BALLOT|^Q\d+$/.test(code);
}

/** "SD 8" from "SD8" / "sd 30". The roundup row prints as Missouri Roundup. */
export function raceLabel(race: string): string {
  if (isMissouriRoundup(race)) return "Missouri Roundup";
  const compact = str(race);
  const match = /^([A-Za-z]+)\s*(\d+)$/.exec(compact);
  if (!match) return compact;
  return `${match[1]!.toUpperCase()} ${Number(match[2])}`;
}

export function raceNumber(race: string): number {
  const match = /(\d+)/.exec(race);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function raceSortRank(race: string): number {
  if (isSenateRace(race)) return 0;
  if (isBallotMeasure(race)) return 1;
  if (isMissouriRoundup(race)) return 3;
  return 2;
}

/** Senate districts, then ballot measures, then everything else. */
export function sortRaceBriefs(races: RaceBrief[]): RaceBrief[] {
  return [...races].sort((a, b) => {
    const byKind = raceSortRank(a.race) - raceSortRank(b.race);
    if (byKind) return byKind;
    const byNum = raceNumber(a.race) - raceNumber(b.race);
    if (byNum) return byNum;
    return a.race.localeCompare(b.race);
  });
}

const FULL_BRIEF_CAP = 6;

export function raceHasActiveBuys(race: RaceBrief): boolean {
  return race.spend.length > 0;
}

/**
 * Full briefs for a short book. Past about six races, full briefs stay on
 * SD 8, SD 30, and any race with buys on file. The roundup is its own box.
 */
export function presentRaceBriefs(races: RaceBrief[]): {
  full: RaceBrief[];
  roundup: RaceBrief | null;
  list: RaceBrief[];
} {
  const ordered = sortRaceBriefs(races);
  const roundup = ordered.find((race) => isMissouriRoundup(race.race)) ?? null;
  const rest = ordered.filter((race) => !isMissouriRoundup(race.race));
  if (rest.length <= FULL_BRIEF_CAP) return { full: rest, roundup, list: [] };
  const full: RaceBrief[] = [];
  const list: RaceBrief[] = [];
  for (const race of rest) {
    const always = raceCode(race.race) === "SD8" || raceCode(race.race) === "SD30";
    if (always || raceHasActiveBuys(race)) full.push(race);
    else list.push(race);
  }
  return { full, roundup, list };
}

/** "Oct. 6" — AP month, no year. */
export function printDay(date: string | null | undefined): string {
  const value = ymd(date);
  if (!value) return str(date);
  const match = YMD.exec(value)!;
  return `${AP_MONTH[Number(match[2]) - 1]} ${Number(match[3])}`;
}

/** "Oct. 1–6" when the flight stays in one month, otherwise "Sept. 28–Oct. 11". */
export function flightLabel(start: string | null, end: string | null): string {
  const a = ymd(start);
  const b = ymd(end);
  if (!a && !b) return "—";
  if (a && !b) return printDay(a);
  if (!a && b) return printDay(b);
  const am = YMD.exec(a!)!;
  const bm = YMD.exec(b!)!;
  if (am[2] === bm[2] && am[1] === bm[1]) {
    return `${AP_MONTH[Number(am[2]) - 1]} ${Number(am[3])}–${Number(bm[3])}`;
  }
  return `${printDay(a)}–${printDay(b)}`;
}

export function money(amount: number): string {
  const n = Math.round(amount);
  const abs = Math.abs(n).toLocaleString("en-US");
  return n < 0 ? `−$${abs}` : `$${abs}`;
}

export function grpLabel(value: number | null): string {
  if (value == null) return "—";
  return Math.round(value).toLocaleString("en-US");
}

export function cppLabel(value: number | null): string {
  if (value == null) return "—";
  return money(value);
}

export function stationMarket(row: RaceSpend): string {
  if (row.station && row.market && row.station.toLowerCase() !== row.market.toLowerCase()) {
    return `${row.station} · ${row.market}`;
  }
  return row.station || row.market || "—";
}

export function spendTotals(rows: RaceSpend[]): { side: string; amount: number; grps: number }[] {
  const by = new Map<string, { amount: number; grps: number }>();
  for (const row of rows) {
    const key = row.side || "Unspecified";
    const cur = by.get(key) ?? { amount: 0, grps: 0 };
    cur.amount += row.amount;
    cur.grps += row.grps ?? 0;
    by.set(key, cur);
  }
  return [...by.entries()]
    .map(([side, tot]) => ({ side, amount: tot.amount, grps: tot.grps }))
    .sort((a, b) => b.amount - a.amount || a.side.localeCompare(b.side));
}

export function sortSpend(rows: RaceSpend[]): RaceSpend[] {
  return [...rows].sort((a, b) => b.amount - a.amount || a.sponsor.localeCompare(b.sponsor));
}

function asSpend(raw: unknown): RaceSpend | null {
  const row = asRecord(raw);
  if (!row) return null;
  const sponsor = str(row.sponsor);
  const amount = numOrNull(row.amount);
  if (!sponsor || amount == null) return null;
  return {
    sponsor,
    side: str(row.side),
    station: str(row.station),
    market: str(row.market),
    amount,
    grps: numOrNull(row.grps),
    cpp: numOrNull(row.cpp),
    flight_start: ymd(row.flight_start) ?? (str(row.flight_start) || null),
    flight_end: ymd(row.flight_end) ?? (str(row.flight_end) || null),
    is_new: row.is_new === true,
  };
}

function asLink(raw: unknown): RaceLink | null {
  const row = asRecord(raw);
  if (!row) return null;
  const url = str(row.url);
  const label = str(row.label) || url;
  if (!label || !/^https?:\/\//i.test(url)) return null;
  return { label, url };
}

function asNote(raw: unknown): RaceNote | null {
  const row = asRecord(raw);
  if (!row) return null;
  const text = str(row.text);
  if (!text) return null;
  const url = str(row.url);
  return {
    source: str(row.source) || "Note",
    text,
    url: /^https?:\/\//i.test(url) ? url : null,
  };
}

function asStrings(raw: unknown, cap: number): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const line = str(item);
    if (!line) continue;
    out.push(line);
    if (out.length >= cap) break;
  }
  return out;
}

export function asRaceBrief(raw: unknown): RaceBrief | null {
  const row = asRecord(raw);
  if (!row) return null;
  const race = str(row.race).replace(/\s+/g, "");
  if (!race) return null;
  const headline = str(row.headline);
  const spend = (Array.isArray(row.spend) ? row.spend : []).flatMap((item) => {
    const next = asSpend(item);
    return next ? [next] : [];
  });
  if (!headline && !spend.length) return null;
  return {
    race: race.toUpperCase(),
    headline,
    bullets: asStrings(row.bullets, 5),
    spend: sortSpend(spend),
    links: (Array.isArray(row.links) ? row.links : []).flatMap((item) => {
      const next = asLink(item);
      return next ? [next] : [];
    }),
    notes: (Array.isArray(row.notes) ? row.notes : []).flatMap((item) => {
      const next = asNote(item);
      return next ? [next] : [];
    }),
    source: str(row.source) || null,
    updated_at: str(row.updated_at) || null,
  };
}

/**
 * Newest brief_date to print: the edition's own date, or the latest filing
 * in [edition − 2 days, edition].
 */
export function pickBriefDate(dates: string[], editionDate: string): string | null {
  if (!YMD.test(editionDate)) return null;
  const clean = [...new Set(dates.map((d) => ymd(d)).filter((d): d is string => Boolean(d)))].sort();
  if (clean.includes(editionDate)) return editionDate;
  const from = shiftYmd(editionDate, -2);
  if (!from) return null;
  const window = clean.filter((d) => d >= from && d <= editionDate);
  return window.length ? window[window.length - 1]! : null;
}

export function asRaceBriefsDesk(raw: unknown, editionDate: string): RaceBriefsDesk | null {
  if (!YMD.test(editionDate) || !Array.isArray(raw)) return null;
  const dated: { date: string; brief: RaceBrief }[] = [];
  for (const item of raw) {
    const row = asRecord(item);
    if (!row) continue;
    const date = ymd(row.brief_date);
    const brief = asRaceBrief(row);
    if (!date || !brief) continue;
    dated.push({ date, brief });
  }
  const briefDate = pickBriefDate(
    dated.map((r) => r.date),
    editionDate,
  );
  if (!briefDate) return null;
  const races = sortRaceBriefs(dated.filter((r) => r.date === briefDate).map((r) => r.brief));
  if (!races.length) return null;
  return {
    editionDate,
    briefDate,
    stale: briefDate !== editionDate,
    races,
  };
}

/** Rough printed height of one race block on the 1032px sheet. Content-only — no min-height pad. */
export function estimateRaceHeight(race: RaceBrief): number {
  const hed = race.headline.length > 70 ? 78 : 58;
  const bullets = race.bullets.length ? 40 + race.bullets.length * 28 : 0;
  const spend = race.spend.length ? 78 + race.spend.length * 30 + (spendTotals(race.spend).length ? 34 : 0) : 0;
  const notes = race.notes.length ? 16 + race.notes.length * 28 : 0;
  const links = race.links.length ? 10 + race.links.length * 20 : 0;
  return 36 + hed + bullets + spend + notes + links;
}

/** Estimated sheet height for a packed folio: chrome + page head + each race. */
export function estimatePackedHeight(races: RaceBrief[], continued = false): number {
  const head = continued ? PAGE_HEAD_CONTINUED : PAGE_HEAD;
  return SHEET_CHROME + head + races.reduce((n, race) => n + estimateRaceHeight(race), 0);
}

export function packRacePages(races: RaceBrief[]): RaceBrief[][] {
  if (!races.length) return [];
  const cap = RACES_SHEET_CAP - SHEET_CHROME;
  const pages: RaceBrief[][] = [];
  let cur: RaceBrief[] = [];
  let used = PAGE_HEAD;
  for (const race of races) {
    const h = estimateRaceHeight(race);
    const nextHead = cur.length ? used : pages.length ? PAGE_HEAD_CONTINUED : PAGE_HEAD;
    if (cur.length && nextHead + h > cap) {
      pages.push(cur);
      cur = [race];
      used = PAGE_HEAD_CONTINUED + h;
      continue;
    }
    if (!cur.length) used = pages.length ? PAGE_HEAD_CONTINUED : PAGE_HEAD;
    cur.push(race);
    used += h;
  }
  if (cur.length) pages.push(cur);
  return pages;
}

export function countdownLine(editionDate: string): string | null {
  const days = daysUntilElection(editionDate);
  if (days == null || days < 0) return null;
  if (days === 0) return `Election Day · ${electionDayLabel()}`;
  const unit = days === 1 ? "day" : "days";
  return `${days} ${unit} to the ${electionDayLabel()} general election`;
}

export function creditLine(desk: Pick<RaceBriefsDesk, "races" | "briefDate">): string {
  const src = desk.races.map((r) => r.source).find(Boolean);
  const when = desk.races.map((r) => r.updated_at).find(Boolean);
  const parts = ["Missouri Senate desk"];
  if (src) parts.push(src);
  if (when) {
    const stamp = new Date(when);
    if (!Number.isNaN(stamp.getTime())) {
      const month = stamp.toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short" });
      const day = stamp.toLocaleDateString("en-US", { timeZone: "America/Chicago", day: "numeric" });
      const time = stamp.toLocaleTimeString("en-US", {
        timeZone: "America/Chicago",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      const apMonth = {
        Jan: "Jan.",
        Feb: "Feb.",
        Mar: "March",
        Apr: "April",
        May: "May",
        Jun: "June",
        Jul: "July",
        Aug: "Aug.",
        Sep: "Sept.",
        Oct: "Oct.",
        Nov: "Nov.",
        Dec: "Dec.",
      }[month] ?? month;
      const clock = time.replace(/\u202f/g, " ").replace(/\s*(AM|PM)/i, (_, ap: string) =>
        ap.toLowerCase().startsWith("a") ? " a.m." : " p.m.",
      );
      parts.push(`updated ${apMonth} ${day}, ${clock} CT`);
    }
  }
  return parts.join(" · ");
}

/**
 * Slot the races page(s) immediately before The Day Ahead when that page is
 * present, otherwise before the Beez or the viewing guide. Folios in Section A
 * after the insert shift by the number of new sheets. No races, edition untouched.
 */
export function insertRaceBriefs<
  E extends { pages: (EditionPage | FavoritesRacesPage)[]; sections: EditionSection[] },
>(edition: E, desk: RaceBriefsDesk | null): E {
  if (!desk?.races.length) return edition;
  const presented = presentRaceBriefs(desk.races);
  const packed = packRacePages(presented.full);
  const sheets = packed.length ? packed : presented.roundup || presented.list.length ? [[] as RaceBrief[]] : [];
  if (!sheets.length) return edition;
  const at = edition.pages.findIndex(
    (p) => p.kind === "favorites-day" || p.kind === "favorites-beez" || p.kind === "favorites-watch",
  );
  if (at < 0) return edition;
  const anchor = edition.pages[at]!;
  const n = anchor.sectionPage;
  const add = sheets.length;
  const count = anchor.sectionCount + add;
  let roundupAt = 0;
  sheets.forEach((races, k) => {
    if (races.some((race) => raceCode(race.race) === "SD8" || raceCode(race.race) === "SD30")) roundupAt = k;
  });
  const inserted: FavoritesRacesPage[] = sheets.map((races, k) => ({
    kind: "favorites-races",
    folio: `${anchor.section}${n + k}`,
    section: anchor.section,
    sectionTitle: anchor.sectionTitle,
    sectionPage: n + k,
    sectionCount: count,
    editionDate: desk.editionDate,
    briefDate: desk.briefDate,
    stale: desk.stale,
    continued: k > 0,
    races,
    ...(k === roundupAt && presented.roundup ? { roundup: presented.roundup } : {}),
    ...(k === 0 && presented.list.length ? { list: presented.list } : {}),
  }));
  const pages = edition.pages.flatMap((item, i) => {
    if (item.section !== anchor.section) return [item];
    if (i === at) {
      return [
        ...inserted,
        { ...item, folio: `${anchor.section}${n + add}`, sectionPage: n + add, sectionCount: count },
      ];
    }
    if (i > at) {
      return [
        {
          ...item,
          folio: `${item.section}${item.sectionPage + add}`,
          sectionPage: item.sectionPage + add,
          sectionCount: count,
        },
      ];
    }
    return [{ ...item, sectionCount: count }];
  });
  const sections = edition.sections.map((s) =>
    s.code === anchor.section
      ? { ...s, pages: s.pages + add }
      : s.index > at
        ? { ...s, index: s.index + add }
        : s,
  );
  return { ...edition, pages, sections };
}

/** Two-race fixture for proofs and tests. SAMPLE only in proof filenames, never here. */
export function sampleRaceBriefs(editionDate = "2026-10-06"): RaceBriefsDesk {
  return {
    editionDate,
    briefDate: editionDate,
    stale: false,
    races: sortRaceBriefs([
      {
        race: "SD30",
        headline: "Outside groups keep buying the Springfield air in the 30th",
        bullets: [
          "Independent expenditure TV is still the story: two PACs and the candidate committee are all in the same three-station rotation.",
          "New flights posted overnight on KOLR and KY3, both running through mid-October.",
          "MoScout notes the race remains the most expensive Senate contest in the Ozarks this cycle.",
        ],
        spend: sortSpend([
          {
            sponsor: "Forward PAC",
            side: "Support",
            station: "KYTV",
            market: "Springfield",
            amount: 210_500,
            grps: 1276,
            cpp: 165,
            flight_start: "2026-09-20",
            flight_end: "2026-10-10",
            is_new: false,
          },
          {
            sponsor: "Legio XIII PAC",
            side: "Oppose",
            station: "KOLR",
            market: "Springfield",
            amount: 188_000,
            grps: 1139,
            cpp: 165,
            flight_start: "2026-09-25",
            flight_end: "2026-10-08",
            is_new: true,
          },
          {
            sponsor: "Fogle for the 30th",
            side: "Support",
            station: "KY3",
            market: "Springfield",
            amount: 97_750,
            grps: 1303,
            cpp: 75,
            flight_start: "2026-10-01",
            flight_end: "2026-10-15",
            is_new: true,
          },
          {
            sponsor: "Forward PAC",
            side: "Support",
            station: "KODE",
            market: "Joplin",
            amount: 64_200,
            grps: 389,
            cpp: 165,
            flight_start: "2026-09-28",
            flight_end: "2026-10-11",
            is_new: false,
          },
          {
            sponsor: "Citizens for a Working Senate",
            side: "Oppose",
            station: "KOLR",
            market: "Springfield",
            amount: 52_800,
            grps: 320,
            cpp: 165,
            flight_start: "2026-10-03",
            flight_end: "2026-10-17",
            is_new: true,
          },
          {
            sponsor: "Missouri Jobs Alliance",
            side: "Support",
            station: "KYTV",
            market: "Springfield",
            amount: 41_250,
            grps: 250,
            cpp: 165,
            flight_start: "2026-09-10",
            flight_end: "2026-09-24",
            is_new: false,
          },
        ]),
        links: [
          { label: "MEC filings · SD 30", url: "https://mec.mo.gov/" },
          { label: "MoScout race file", url: "https://moscout.com/" },
        ],
        notes: [
          {
            source: "MoScout",
            text: "Springfield buyers are still treating this as a TV race. Radio and digital remain secondary.",
            url: "https://moscout.com/",
          },
          {
            source: "MEC",
            text: "Independent-expenditure reports filed this week cover the late-September flights now on air.",
            url: "https://mec.mo.gov/",
          },
        ],
        source: "MoScout / MEC",
        updated_at: "2026-10-06T10:28:00-05:00",
      },
      {
        race: "SD8",
        headline: "The 8th turns into a two-market buy as Joplin money shows up",
        bullets: [
          "Support still leads the booked points, but a new oppose flight on KOLR narrowed the gap overnight.",
          "Joplin stations are no longer an afterthought: three buys now sit on KSNF or KFJX.",
          "Both sides are advertising through the middle of October; nothing on file yet for the last two weeks.",
        ],
        spend: sortSpend([
          {
            sponsor: "Keep Missouri Working PAC",
            side: "Support",
            station: "KYTV",
            market: "Springfield",
            amount: 184_200,
            grps: 2456,
            cpp: 75,
            flight_start: "2026-09-22",
            flight_end: "2026-10-06",
            is_new: false,
          },
          {
            sponsor: "Senate Leadership Fund",
            side: "Oppose",
            station: "KOLR",
            market: "Springfield",
            amount: 156_800,
            grps: 1890,
            cpp: 83,
            flight_start: "2026-09-29",
            flight_end: "2026-10-12",
            is_new: true,
          },
          {
            sponsor: "Reed for Senate",
            side: "Support",
            station: "KOZL",
            market: "Springfield",
            amount: 92_400,
            grps: 1232,
            cpp: 75,
            flight_start: "2026-10-01",
            flight_end: "2026-10-14",
            is_new: true,
          },
          {
            sponsor: "Missouri Strong Future",
            side: "Oppose",
            station: "KFJX",
            market: "Joplin",
            amount: 71_250,
            grps: 475,
            cpp: 150,
            flight_start: "2026-09-15",
            flight_end: "2026-10-05",
            is_new: false,
          },
          {
            sponsor: "Keep Missouri Working PAC",
            side: "Support",
            station: "KSNF",
            market: "Joplin",
            amount: 48_600,
            grps: 324,
            cpp: 150,
            flight_start: "2026-10-02",
            flight_end: "2026-10-16",
            is_new: true,
          },
          {
            sponsor: "Local Jobs Alliance",
            side: "Support",
            station: "KYTV",
            market: "Springfield",
            amount: 36_900,
            grps: 492,
            cpp: 75,
            flight_start: "2026-09-08",
            flight_end: "2026-09-28",
            is_new: false,
          },
        ]),
        links: [
          { label: "MEC filings · SD 8", url: "https://mec.mo.gov/" },
          { label: "MoScout race file", url: "https://moscout.com/" },
        ],
        notes: [
          {
            source: "MoScout",
            text: "The Joplin add is the first time this desk has seen a true two-market map in the 8th.",
            url: "https://moscout.com/",
          },
          {
            source: "MEC",
            text: "Candidate committee media invoices match the KYTV and KOZL flights posted this morning.",
            url: "https://mec.mo.gov/",
          },
        ],
        source: "MoScout / MEC",
        updated_at: "2026-10-06T10:28:00-05:00",
      },
    ]),
  };
}

/** Extra races so a proof can force a second folio. */
export function sampleRaceBriefsOverflow(editionDate = "2026-10-06"): RaceBriefsDesk {
  const base = sampleRaceBriefs(editionDate);
  const extra: RaceBrief = {
    race: "SD16",
    headline: "A third Senate map joins the book with a short Joplin flight",
    bullets: [
      "One committee and one independent spend are on file, both new this week.",
      "Points are light next to the 8th and the 30th; the desk is watching for a Springfield add.",
      "No radio or cable on the ledger yet.",
    ],
    spend: sortSpend([
      {
        sponsor: "Ozark Majority PAC",
        side: "Support",
        station: "KSNF",
        market: "Joplin",
        amount: 88_400,
        grps: 590,
        cpp: 150,
        flight_start: "2026-10-02",
        flight_end: "2026-10-16",
        is_new: true,
      },
      {
        sponsor: "Working Families of Missouri",
        side: "Oppose",
        station: "KODE",
        market: "Joplin",
        amount: 61_200,
        grps: 408,
        cpp: 150,
        flight_start: "2026-10-04",
        flight_end: "2026-10-18",
        is_new: true,
      },
      {
        sponsor: "Ozark Majority PAC",
        side: "Support",
        station: "KYTV",
        market: "Springfield",
        amount: 54_750,
        grps: 730,
        cpp: 75,
        flight_start: "2026-10-05",
        flight_end: "2026-10-19",
        is_new: true,
      },
      {
        sponsor: "Senate Leadership Fund",
        side: "Oppose",
        station: "KOLR",
        market: "Springfield",
        amount: 47_100,
        grps: 568,
        cpp: 83,
        flight_start: "2026-09-30",
        flight_end: "2026-10-13",
        is_new: false,
      },
      {
        sponsor: "Local Jobs Alliance",
        side: "Support",
        station: "KOZL",
        market: "Springfield",
        amount: 29_800,
        grps: 397,
        cpp: 75,
        flight_start: "2026-10-01",
        flight_end: "2026-10-08",
        is_new: false,
      },
      {
        sponsor: "Missouri Strong Future",
        side: "Oppose",
        station: "KFJX",
        market: "Joplin",
        amount: 22_450,
        grps: 150,
        cpp: 150,
        flight_start: "2026-09-18",
        flight_end: "2026-10-02",
        is_new: false,
      },
    ]),
    links: [{ label: "MEC filings · SD 16", url: "https://mec.mo.gov/" }],
    notes: [
      { source: "MoScout", text: "Treat this as a watch item until Springfield points catch up.", url: null },
      { source: "MEC", text: "Both new IE reports landed after 4 p.m. CT yesterday.", url: null },
    ],
    source: "MoScout / MEC",
    updated_at: "2026-10-06T10:28:00-05:00",
  };
  return { ...base, races: sortRaceBriefs([...base.races, extra]) };
}
