/** Central calendar day — same rule as todayStr() in utils, inlined so this
 *  helper can be unit-tested with node --experimental-strip-types. */
function centralToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

/** Book fields the rolling-year chart actually reads. */
export type YearChartBook = {
  id: string;
  status: string;
  finished_at: string | null;
  page_count: number | null;
  content_type?: string | null;
};

/** Session fields the rolling-year chart actually reads. */
export type YearChartSession = {
  session_date: string;
  pages_read: number;
  book_id?: string | null;
};

export type RollingMonthPoint = {
  /** YYYY-MM */
  key: string;
  /** Jan, Feb, … */
  month: string;
  /** 2026 */
  year: number;
  /** Three-letter tick, no year — year lives in the range subtitle. */
  tick: string;
  /** March 2026 */
  label: string;
  /** Books with status `read` and finished_at in this month (magazines excluded). */
  booksFinished: number;
  /** Sum of reading_sessions.pages_read in this month. */
  pagesLogged: number;
  /**
   * Fallback: page_count of finished titles that have no sessions at all.
   * Used when StoryGraph/import history predates session logging.
   */
  pagesEstimated: number;
  /** pagesLogged + pagesEstimated — the bar height. */
  pages: number;
};

export type RollingYearSeries = {
  months: RollingMonthPoint[];
  from: string;
  to: string;
  totalBooks: number;
  totalPages: number;
  totalLogged: number;
  totalEstimated: number;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function ymd(raw: string): string {
  return raw.slice(0, 10);
}

function monthKey(raw: string): string {
  return ymd(raw).slice(0, 7);
}

/** Shift a YYYY-MM key by `n` calendar months. */
export function shiftMonth(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y!, (m ?? 1) - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Last calendar day of YYYY-MM as YYYY-MM-DD. */
export function lastDayOfMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return `${ym}-28`;
  const d = new Date(Date.UTC(y, m, 0));
  return `${ym}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function monthRangeLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Twelve calendar months ending in the month that contains `today` (Central). */
export function rollingMonthKeys(today = centralToday()): string[] {
  const end = monthKey(today);
  const keys: string[] = [];
  for (let i = 11; i >= 0; i--) keys.push(shiftMonth(end, -i));
  return keys;
}

/**
 * Rolling last-12-calendar-month series for the reading home chart.
 *
 * Books finished: status `read` + finished_at in that month. Magazines are
 * excluded so the line matches “books,” not issues.
 *
 * Pages: sum of reading_sessions.pages_read by session_date (preferred).
 * When a finished title (status `read`) has no sessions at all — typical
 * of imported history — its page_count is added as an estimate so older
 * months are not a flat zero. A title that has any session is never
 * estimated. DNF / paused titles are not estimated.
 */
export function rolling12MonthStats(
  books: YearChartBook[],
  sessions: YearChartSession[],
  today = centralToday(),
): RollingYearSeries {
  const keys = rollingMonthKeys(today);
  const inWindow = new Set(keys);
  const booksFinished = new Map<string, number>(keys.map((k) => [k, 0]));
  const pagesLogged = new Map<string, number>(keys.map((k) => [k, 0]));
  const pagesEstimated = new Map<string, number>(keys.map((k) => [k, 0]));

  const bookHasSession = new Set<string>();
  for (const s of sessions) {
    const key = monthKey(s.session_date);
    if (!inWindow.has(key)) continue;
    pagesLogged.set(key, (pagesLogged.get(key) ?? 0) + (Number(s.pages_read) || 0));
    if (s.book_id) bookHasSession.add(s.book_id);
  }

  for (const b of books) {
    if (!b.finished_at) continue;
    const key = monthKey(b.finished_at);
    if (!inWindow.has(key)) continue;

    const isMagazine = b.content_type === "magazine";
    if (b.status === "read" && !isMagazine) {
      booksFinished.set(key, (booksFinished.get(key) ?? 0) + 1);
    }

    // Estimate only finished titles that never appeared in sessions —
    // otherwise we'd double-count pages already logged (possibly in a
    // different month than the finish date). Skip DNF / paused / to-read.
    if (
      b.status === "read" &&
      b.page_count &&
      b.page_count > 0 &&
      !bookHasSession.has(b.id)
    ) {
      pagesEstimated.set(key, (pagesEstimated.get(key) ?? 0) + b.page_count);
    }
  }

  const months: RollingMonthPoint[] = keys.map((key) => {
    const year = Number(key.slice(0, 4));
    const monthIdx = Number(key.slice(5, 7)) - 1;
    const month = MONTHS[monthIdx] ?? key;
    const logged = pagesLogged.get(key) ?? 0;
    const estimated = pagesEstimated.get(key) ?? 0;
    return {
      key,
      month,
      year,
      tick: month,
      label: monthRangeLabel(key),
      booksFinished: booksFinished.get(key) ?? 0,
      pagesLogged: logged,
      pagesEstimated: estimated,
      pages: logged + estimated,
    };
  });

  return {
    months,
    from: `${keys[0]}-01`,
    to: lastDayOfMonth(keys[keys.length - 1]!),
    totalBooks: months.reduce((n, m) => n + m.booksFinished, 0),
    totalPages: months.reduce((n, m) => n + m.pages, 0),
    totalLogged: months.reduce((n, m) => n + m.pagesLogged, 0),
    totalEstimated: months.reduce((n, m) => n + m.pagesEstimated, 0),
  };
}
