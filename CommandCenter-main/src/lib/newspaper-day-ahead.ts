/**
 * "The Day Ahead": the reader's calendar for the edition's date, printed as an
 * hour-by-hour timetable in Section A, right before the viewing guide.
 *
 * One schedule per America/Chicago date lives in public.times_day_schedule. The
 * assistant files it each morning; the midday and evening editions reprint the
 * same day's schedule. With no row for the date, the page is left out entirely.
 *
 * The page is set client-side after buildEdition, so the scheduled press and its
 * bundle never change. Pure helpers only here (no Supabase), so tests run in node.
 */
import type { EditionPage, EditionSection } from "./newspaper-sections.ts";

export type DayKind = "work" | "family";

export type DayEvent = {
  /** "HH:MM", 24-hour, Central. Null for all-day items. */
  start: string | null;
  end: string | null;
  all_day: boolean;
  title: string;
  kind: DayKind;
  location: string | null;
};

/** One of the next days, as filed the morning of the schedule (printed, not live). */
export type DayUpcoming = { date: string; events: DayEvent[] };

export type DaySchedule = { date: string; events: DayEvent[]; upcoming?: DayUpcoming[] };

/** Coming Up prints this many days after the schedule's own date. */
export const UPCOMING_DAYS = 5;
/** Events printed per Coming Up day before "+N more". */
export const UPCOMING_PER_DAY = 4;

/** The timetable page. Section A, folio set when it is slotted in. */
export type FavoritesDayPage = {
  kind: "favorites-day";
  folio: string;
  section: string;
  sectionTitle: string;
  sectionPage: number;
  sectionCount: number;
  jumpFolio?: string;
  date: string;
  events: DayEvent[];
  upcoming: DayUpcoming[];
};

/** "2026-10-05-morning" → "2026-10-05". Every edition of a day prints that day's schedule. */
export function scheduleDateFor(pressId: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})(?:-|$)/.exec(pressId);
  return m ? m[1] : null;
}

/** Minutes after midnight for "H:MM" / "HH:MM" (24:00 allowed as the end of the day). */
export function toMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59 || (h === 24 && min > 0)) return null;
  return h * 60 + min;
}

/** Keep only well-formed events; anything malformed is dropped rather than printed wrong. */
export function normalizeEvents(raw: unknown): DayEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: DayEvent[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const e = item as Record<string, unknown>;
    const title = typeof e.title === "string" ? e.title.replace(/\s+/g, " ").trim() : "";
    if (!title) continue;
    const kind: DayKind = e.kind === "family" ? "family" : "work";
    const location = typeof e.location === "string" && e.location.trim() ? e.location.trim() : null;
    const start = typeof e.start === "string" && toMinutes(e.start) != null ? e.start.trim() : null;
    const end = typeof e.end === "string" && toMinutes(e.end) != null ? e.end.trim() : null;
    const allDay = e.all_day === true || start == null;
    out.push({ start: allDay ? null : start, end: allDay ? null : end, all_day: allDay, title, kind, location });
  }
  return out;
}

/**
 * The Coming Up block: well-formed days after `after`, in date order, at most UPCOMING_DAYS,
 * one entry per date (a repeated date keeps its first filing).
 */
export function normalizeUpcoming(raw: unknown, after: string): DayUpcoming[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: DayUpcoming[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const d = item as Record<string, unknown>;
    const date = typeof d.date === "string" ? d.date.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date <= after || seen.has(date)) continue;
    seen.add(date);
    out.push({ date, events: normalizeEvents(d.events) });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date)).slice(0, UPCOMING_DAYS);
}

/** A Coming Up day in print order: all-day first, then by clock; the rest counted as "+N more". */
export function upcomingLines(events: DayEvent[], max = UPCOMING_PER_DAY): { shown: DayEvent[]; more: number } {
  const sorted = [...events].sort((a, b) => {
    const am = a.all_day ? -1 : toMinutes(a.start) ?? -1;
    const bm = b.all_day ? -1 : toMinutes(b.start) ?? -1;
    return am - bm;
  });
  return { shown: sorted.slice(0, max), more: Math.max(0, sorted.length - max) };
}

/** A timed event placed on the rail. */
export type PlacedEvent = {
  event: DayEvent;
  start: number;
  end: number;
  /** No end time was given; the block is drawn at a nominal length. */
  openEnded: boolean;
  col: number;
  cols: number;
};

export type OpenBlock = { start: number; end: number };

export type DayLayout = {
  /** Rail bounds in minutes (whole hours). */
  railStart: number;
  railEnd: number;
  allDay: DayEvent[];
  timed: PlacedEvent[];
  open: OpenBlock[];
  firstUp: PlacedEvent | null;
  counts: { total: number; work: number; family: number; allDay: number };
  bookedMinutes: number;
};

export const RAIL_FIRST_HOUR = 6;
export const RAIL_LAST_HOUR = 22;
/** Drawn length for an event with no end time. */
const NOMINAL_MINUTES = 30;
/** Gaps shorter than this are not worth calling open. */
export const MIN_OPEN_MINUTES = 45;

export function layoutDay(events: DayEvent[]): DayLayout {
  const allDay = events.filter((e) => e.all_day || toMinutes(e.start) == null);
  const timedRaw = events
    .filter((e) => !e.all_day && toMinutes(e.start) != null)
    .map((event) => {
      const start = toMinutes(event.start)!;
      const given = toMinutes(event.end);
      // An end at or before the start runs past midnight; the printed day stops at 24:00.
      const end = given == null ? Math.min(1440, start + NOMINAL_MINUTES) : given > start ? given : 1440;
      return { event, start, end: Math.max(end, start + 15), openEnded: given == null };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end || a.event.title.localeCompare(b.event.title));

  // Side by side: each run of overlapping events shares its width, greedy columns inside the run.
  const timed: PlacedEvent[] = [];
  let cluster: PlacedEvent[] = [];
  let colEnds: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const cols = Math.max(1, colEnds.length);
    for (const p of cluster) p.cols = cols;
    timed.push(...cluster);
    cluster = [];
    colEnds = [];
  };
  for (const item of timedRaw) {
    if (cluster.length && item.start >= clusterEnd) flush();
    let col = colEnds.findIndex((end) => end <= item.start);
    if (col < 0) {
      col = colEnds.length;
      colEnds.push(item.end);
    } else {
      colEnds[col] = item.end;
    }
    cluster.push({ ...item, col, cols: 1 });
    clusterEnd = cluster.length === 1 ? item.end : Math.max(clusterEnd, item.end);
  }
  if (cluster.length) flush();

  const firstStart = timed.length ? Math.min(...timed.map((p) => p.start)) : Infinity;
  const lastEnd = timed.length ? Math.max(...timed.map((p) => p.end)) : -Infinity;
  const railStart = Math.max(0, Math.min(RAIL_FIRST_HOUR, Math.floor(firstStart / 60)) * 60);
  const railEnd = Math.min(1440, Math.max(RAIL_LAST_HOUR, Math.ceil(lastEnd / 60)) * 60);

  // Open time: the stretches of the rail no event covers.
  const open: OpenBlock[] = [];
  let cursor = railStart;
  let booked = 0;
  const merged: OpenBlock[] = [];
  for (const p of [...timed].sort((a, b) => a.start - b.start)) {
    const last = merged[merged.length - 1];
    if (last && p.start <= last.end) last.end = Math.max(last.end, p.end);
    else merged.push({ start: p.start, end: p.end });
  }
  for (const busy of merged) {
    if (busy.start - cursor >= MIN_OPEN_MINUTES) open.push({ start: cursor, end: busy.start });
    cursor = Math.max(cursor, busy.end);
    booked += busy.end - busy.start;
  }
  if (railEnd - cursor >= MIN_OPEN_MINUTES) open.push({ start: cursor, end: railEnd });

  const work = events.filter((e) => e.kind === "work").length;
  return {
    railStart,
    railEnd,
    allDay,
    timed,
    open,
    firstUp: timed.length ? [...timed].sort((a, b) => a.start - b.start || a.col - b.col)[0]! : null,
    counts: { total: events.length, work, family: events.length - work, allDay: allDay.length },
    bookedMinutes: booked,
  };
}

/** "6 events · 3 work · 3 family". */
export function countLine(counts: DayLayout["counts"]): string {
  if (!counts.total) return "Nothing on the books";
  const parts = [`${counts.total} ${counts.total === 1 ? "event" : "events"}`];
  if (counts.work) parts.push(`${counts.work} work`);
  if (counts.family) parts.push(`${counts.family} family`);
  if (counts.allDay) parts.push(`${counts.allDay} all-day`);
  return parts.join(" · ");
}

/** Newspaper clock: "7:30 a.m.", "noon", "9 p.m.". */
export function clockLabel(minutes: number, opts: { short?: boolean } = {}): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  if (m === 0) return "midnight";
  if (m === 720) return "noon";
  const h24 = Math.floor(m / 60);
  const min = m % 60;
  const h = h24 % 12 || 12;
  const ampm = opts.short ? (h24 < 12 ? "a" : "p") : h24 < 12 ? "a.m." : "p.m.";
  return `${h}${min ? `:${String(min).padStart(2, "0")}` : ""}${opts.short ? ampm : ` ${ampm}`}`;
}

/** "7:30–9 a.m.", "11 a.m.–1 p.m." */
export function spanLabel(start: number, end: number, openEnded = false): string {
  if (openEnded) return clockLabel(start);
  const sameHalf = (start < 720) === (end < 720) && end !== 720 && start !== 720 && end % 1440 !== 0;
  const a = clockLabel(start);
  const b = clockLabel(end);
  return sameHalf ? `${a.replace(/ [ap]\.m\.$/, "")}–${b}` : `${a}–${b}`;
}

/** "1 hr 30 min", "45 min", "2½ hr". */
export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!rest) return `${h} hr`;
  if (rest === 30) return `${h}½ hr`;
  return `${h} hr ${rest} min`;
}

/**
 * Slot the timetable in right before the viewing guide (the last page of Section A),
 * renumbering the guide and Section A's page counts and shifting later sections.
 * No schedule, no guide: the edition comes back untouched.
 */
export function insertDayAhead<
  E extends { pages: (EditionPage | FavoritesDayPage)[]; sections: EditionSection[] },
>(edition: E, schedule: DaySchedule | null): E {
  if (!schedule) return edition;
  const at = edition.pages.findIndex((p) => p.kind === "favorites-watch");
  if (at < 0) return edition;
  const watch = edition.pages[at]!;
  const n = watch.sectionPage;
  const count = watch.sectionCount + 1;
  const day: FavoritesDayPage = {
    kind: "favorites-day",
    folio: `${watch.section}${n}`,
    section: watch.section,
    sectionTitle: watch.sectionTitle,
    sectionPage: n,
    sectionCount: count,
    date: schedule.date,
    events: schedule.events,
    upcoming: schedule.upcoming ?? [],
  };
  const pages = edition.pages.flatMap((page, i) => {
    if (page.section !== watch.section) return [page];
    if (i === at) return [day, { ...page, folio: `${watch.section}${n + 1}`, sectionPage: n + 1, sectionCount: count }];
    return [{ ...page, sectionCount: count }];
  });
  const sections = edition.sections.map((s) =>
    s.code === watch.section ? { ...s, pages: s.pages + 1 } : s.index > at ? { ...s, index: s.index + 1 } : s,
  );
  return { ...edition, pages, sections };
}
