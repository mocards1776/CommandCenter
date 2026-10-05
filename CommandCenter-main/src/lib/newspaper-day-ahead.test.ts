/**
 * Run with: node --experimental-strip-types src/lib/newspaper-day-ahead.test.ts
 * from CommandCenter-main/. Sample events are made up.
 */
import { buildEdition } from "./newspaper-sections.ts";
import {
  clockLabel,
  countLine,
  durationLabel,
  insertDayAhead,
  layoutDay,
  normalizeEvents,
  normalizeUpcoming,
  scheduleDateFor,
  spanLabel,
  toMinutes,
  upcomingLines,
  type DayEvent,
} from "./newspaper-day-ahead.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const ev = (start: string | null, end: string | null, title: string, kind: "work" | "family" = "work"): DayEvent => ({
  start,
  end,
  all_day: start == null,
  title,
  kind,
  location: null,
});

assert(scheduleDateFor("2026-10-05-morning") === "2026-10-05", "morning edition prints its own date");
assert(scheduleDateFor("2026-10-05-evening") === "2026-10-05", "evening edition reprints the same day");
assert(scheduleDateFor("nonsense") === null, "bad id has no date");

assert(toMinutes("07:30") === 450 && toMinutes("7:05") === 425, "clock parses");
assert(toMinutes("24:00") === 1440 && toMinutes("24:30") === null && toMinutes("9am") === null, "clock rejects junk");

const cleaned = normalizeEvents([
  { start: "09:00", end: "10:00", all_day: false, title: "  Sample   standup ", kind: "work", location: "" },
  { start: null, end: null, all_day: true, title: "Sample holiday", kind: "family", location: null },
  { start: "bad", end: "10:00", title: "No clock means all day", kind: "family" },
  { title: "" },
  "junk",
]);
assert(cleaned.length === 3, "drops untitled and malformed rows");
assert(cleaned[0]!.title === "Sample standup" && cleaned[0]!.location === null, "tidies title and blank location");
assert(cleaned[2]!.all_day && cleaned[2]!.start === null, "an unreadable start files as all-day");
assert(normalizeEvents(null).length === 0, "non-array is empty");

// Overlaps go side by side.
const busy = layoutDay([
  ev("09:00", "10:00", "Sample A"),
  ev("09:30", "10:30", "Sample B"),
  ev("09:45", "10:15", "Sample C", "family"),
  ev("10:30", "11:00", "Sample D"),
  ev("13:00", null, "Sample open-ended", "family"),
  ev(null, null, "Sample all-day", "family"),
]);
const at = (t: string) => busy.timed.find((p) => p.event.title === t)!;
assert(at("Sample A").cols === 3 && at("Sample B").cols === 3 && at("Sample C").cols === 3, "three-way overlap shares width");
assert(new Set([at("Sample A").col, at("Sample B").col, at("Sample C").col]).size === 3, "each overlap gets its own column");
assert(at("Sample D").cols === 1 && at("Sample D").col === 0, "the next event after the run is full width");
assert(at("Sample open-ended").openEnded && at("Sample open-ended").end === 13 * 60 + 30, "no end draws 30 minutes");
assert(busy.allDay.length === 1 && busy.allDay[0]!.title === "Sample all-day", "all-day goes to the banner");
assert(busy.firstUp?.event.title === "Sample A", "first up is the earliest timed event");
assert(busy.railStart === 6 * 60 && busy.railEnd === 22 * 60, "default rail is 6 a.m. to 10 p.m.");
assert(busy.open[0]!.start === 360 && busy.open[0]!.end === 540, "open from 6 to 9");
assert(busy.open.some((o) => o.start === 660 && o.end === 780), "open from 11 to 1");
assert(busy.bookedMinutes === 120 + 30, "booked counts merged busy time (9–11 plus 1–1:30)");
assert(countLine(busy.counts) === "6 events · 3 work · 3 family · 1 all-day", "count line");

// The rail grows for early and late events; past-midnight ends stop at midnight.
const long = layoutDay([ev("05:15", "06:00", "Sample early"), ev("22:30", "01:00", "Sample late", "family")]);
assert(long.railStart === 5 * 60, "rail starts at 5 for a 5:15 event");
assert(long.railEnd === 24 * 60, "rail runs to midnight for a late event");
assert(long.timed.find((p) => p.event.title === "Sample late")!.end === 1440, "an end before the start stops at midnight");

const empty = layoutDay([]);
assert(empty.timed.length === 0 && empty.firstUp === null, "empty day has nothing timed");
assert(countLine(empty.counts) === "Nothing on the books", "empty count line");
assert(countLine(layoutDay([ev("09:00", "10:00", "Sample one")]).counts) === "1 event · 1 work", "singular count line");

assert(clockLabel(450) === "7:30 a.m." && clockLabel(720) === "noon" && clockLabel(1260) === "9 p.m.", "clock labels");
assert(clockLabel(1290, { short: true }) === "9:30p", "short clock");
assert(spanLabel(450, 540) === "7:30–9 a.m.", "same-half span drops the first a.m.");
assert(spanLabel(660, 780) === "11 a.m.–1 p.m.", "span across noon keeps both");
assert(spanLabel(660, 720) === "11 a.m.–noon", "span to noon");
assert(durationLabel(45) === "45 min" && durationLabel(150) === "2½ hr" && durationLabel(80) === "1 hr 20 min", "durations");

// Coming Up: the next five days as filed, in order, nothing on or before the schedule's date.
const coming = normalizeUpcoming(
  [
    { date: "2026-10-08", events: [{ start: "09:00", end: "10:00", title: "Sample review", kind: "work" }] },
    { date: "2026-10-06", events: [] },
    { date: "2026-10-05", events: [{ title: "Today does not repeat", kind: "work" }] },
    { date: "2026-10-04", events: [] },
    { date: "2026-10-06", events: [{ title: "Duplicate date dropped", kind: "work" }] },
    { date: "Oct 9", events: [] },
    { date: "2026-10-07", events: "junk" },
    { date: "2026-10-09", events: [] },
    { date: "2026-10-10", events: [] },
    { date: "2026-10-11", events: [] },
  ],
  "2026-10-05",
);
assert(coming.map((d) => d.date).join() === "2026-10-06,2026-10-07,2026-10-08,2026-10-09,2026-10-10", "five days, in order, after today");
assert(coming[0]!.events.length === 0 && coming[1]!.events.length === 0, "first filing wins; bad events are empty");
assert(coming[2]!.events[0]!.title === "Sample review", "events normalized");
assert(normalizeUpcoming(null, "2026-10-05").length === 0, "non-array upcoming is empty");

const lines = upcomingLines([
  ev("15:00", "16:00", "Sample C"),
  ev("08:00", "09:00", "Sample A", "family"),
  ev(null, null, "Sample all-day"),
  ev("12:00", "13:00", "Sample B"),
  ev("18:00", null, "Sample D", "family"),
  ev("19:00", null, "Sample E"),
]);
assert(lines.shown.map((e) => e.title).join() === "Sample all-day,Sample A,Sample B,Sample C", "all-day first, then by clock, four max");
assert(lines.more === 2, "+2 more");
assert(upcomingLines([ev("09:00", null, "Sample")]).more === 0, "no +more when it fits");

// Slotting the page in: right before the viewing guide, in every edition.
for (const press of ["2026-10-05-morning", "2026-10-05-midday", "2026-10-05-evening"]) {
  const built = buildEdition({ stories: [], clubs: [], edition: press });
  assert(insertDayAhead(built, null) === built, `${press}: no schedule, edition untouched`);
  const watchAt = built.pages.findIndex((p) => p.kind === "favorites-watch");
  const watch = built.pages[watchAt]!;
  const withDay = insertDayAhead(built, {
    date: scheduleDateFor(press)!,
    events: [ev("09:00", "10:00", "Sample")],
    upcoming: [{ date: "2026-10-06", events: [] }],
  });
  const a = withDay.pages.filter((p) => p.section === "A");
  const day = withDay.pages[watchAt]!;
  const guide = withDay.pages[watchAt + 1]!;
  assert(day.kind === "favorites-day" && day.folio === watch.folio, `${press}: the day takes the guide's folio`);
  assert(day.kind === "favorites-day" && day.upcoming.length === 1, `${press}: the page carries Coming Up`);
  assert(guide.kind === "favorites-watch" && guide.folio === `A${watch.sectionPage + 1}`, `${press}: the guide moves back one`);
  assert(a[a.length - 1]!.kind === "favorites-watch", `${press}: the guide stays last in Section A`);
  assert(a.every((p) => p.sectionCount === a.length), `${press}: Section A counts the new page`);
  assert(a.map((p) => p.folio).join() === a.map((_, i) => `A${i + 1}`).join(), `${press}: Section A folios run in order`);
  assert(withDay.pages[0]!.folio === "A1" && withDay.pages[1]!.folio === "A2", `${press}: A1 and A2 never move`);
  assert(withDay.sections[0]!.pages === built.sections[0]!.pages + 1, `${press}: section A grows by one`);
  for (const s of withDay.sections.slice(1)) {
    const before = built.sections.find((b) => b.code === s.code)!;
    assert(s.index === before.index + 1, `${press}: ${s.code} shifts by one`);
    assert(withDay.pages[s.index]!.folio === `${s.code}1`, `${press}: ${s.code} still opens on ${s.code}1`);
  }
  assert(withDay.pages.length === built.pages.length + 1, `${press}: exactly one page added`);
}

console.log("newspaper-day-ahead ok");
