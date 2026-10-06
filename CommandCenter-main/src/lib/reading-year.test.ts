/**
 * Run with: node --experimental-strip-types src/lib/reading-year.test.ts
 * from CommandCenter-main/.
 */
import {
  lastDayOfMonth,
  monthRangeLabel,
  rolling12MonthStats,
  rollingMonthKeys,
  shiftMonth,
  type YearChartBook,
  type YearChartSession,
} from "./reading-year.ts";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
  }
}

assertEqual(shiftMonth("2026-10", -11), "2025-11", "shift back 11 months");
assertEqual(shiftMonth("2026-01", -1), "2025-12", "shift across year");
assertEqual(lastDayOfMonth("2026-02"), "2026-02-28", "Feb 2026");
assertEqual(lastDayOfMonth("2024-02"), "2024-02-29", "leap Feb");
assertEqual(monthRangeLabel("2026-03"), "March 2026", "long month label");

const keys = rollingMonthKeys("2026-10-06");
assertEqual(keys.length, 12, "always 12 months");
assertEqual(keys[0], "2025-11", "window starts 11 months back");
assertEqual(keys[11], "2026-10", "window ends on current month");

const empty = rolling12MonthStats([], [], "2026-10-06");
assertEqual(empty.months.length, 12, "empty series still has 12 months");
assert(
  empty.months.every((m) => m.booksFinished === 0 && m.pages === 0),
  "empty months are zero, not omitted",
);
assertEqual(empty.totalBooks, 0, "empty totals");
assertEqual(empty.from, "2025-11-01", "from");
assertEqual(empty.to, "2026-10-31", "to");

const books: YearChartBook[] = [
  {
    id: "a",
    status: "read",
    finished_at: "2026-03-12",
    page_count: 320,
    content_type: "book",
  },
  {
    id: "b",
    status: "read",
    finished_at: "2026-03-28",
    page_count: 400,
    content_type: "book",
  },
  {
    id: "mag",
    status: "read",
    finished_at: "2026-03-02",
    page_count: 84,
    content_type: "magazine",
  },
  {
    id: "dnf",
    status: "did-not-finish",
    finished_at: "2026-03-04",
    page_count: 200,
    content_type: "book",
  },
  {
    id: "old",
    status: "read",
    finished_at: "2024-01-01",
    page_count: 500,
    content_type: "book",
  },
  {
    id: "iso",
    status: "read",
    finished_at: "2026-07-09T18:00:00.000Z",
    page_count: 210,
    content_type: "book",
  },
  {
    id: "logged",
    status: "read",
    finished_at: "2026-09-20",
    page_count: 999,
    content_type: "book",
  },
];

const sessions: YearChartSession[] = [
  { session_date: "2026-03-01", pages_read: 40, book_id: "a" },
  { session_date: "2026-03-11", pages_read: 60, book_id: "a" },
  { session_date: "2026-03-20", pages_read: 15, book_id: "b" },
  { session_date: "2026-09-04", pages_read: 25, book_id: "logged" },
  { session_date: "2026-09-18", pages_read: 30, book_id: "logged" },
  { session_date: "2024-06-01", pages_read: 80, book_id: "old" },
];

const series = rolling12MonthStats(books, sessions, "2026-10-06");
const byKey = Object.fromEntries(series.months.map((m) => [m.key, m]));

assertEqual(byKey["2026-03"]?.booksFinished, 2, "two read books in March; magazine + DNF skipped");
assertEqual(byKey["2026-03"]?.pagesLogged, 115, "March session pages");
// a + b have sessions → no estimate. Magazine is finished with no sessions.
// DNF page_count is ignored.
assertEqual(byKey["2026-03"]?.pagesEstimated, 84, "estimate only read titles without any session");
assertEqual(byKey["2026-03"]?.pages, 115 + 84, "bar is logged + estimated");

assertEqual(byKey["2026-07"]?.booksFinished, 1, "ISO finished_at counts in July");
assertEqual(byKey["2026-07"]?.pagesEstimated, 210, "July estimate from page_count");

assertEqual(byKey["2026-09"]?.booksFinished, 1, "September finish");
assertEqual(byKey["2026-09"]?.pagesLogged, 55, "September sessions");
assertEqual(byKey["2026-09"]?.pagesEstimated, 0, "logged book is not estimated");

assertEqual(byKey["2026-10"]?.booksFinished, 0, "current empty month stays in the series");
assertEqual(byKey["2024-01"], undefined, "finish outside the window is dropped");
assertEqual(series.totalBooks, 4, "a + b + iso + logged");

assertEqual(series.months[0]?.tick, "Nov '25", "first tick shows the year");
assertEqual(series.months.find((m) => m.key === "2026-01")?.tick, "Jan '26", "January shows the new year");
assertEqual(series.months.find((m) => m.key === "2026-02")?.tick, "Feb", "other months stay short");

console.log("reading-year.test.ts ok");
