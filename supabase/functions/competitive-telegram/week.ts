/**
 * Almanac Tuesday–Monday week split for competitive Telegram captions.
 *
 * Port of thompsonalmanac `src/lib/flight-weighting-shared.ts` so weekly
 * spend/GRP here cannot drift from the Almanac site. Canonical weeks start
 * Tuesday (anchorDay 2). Spend and GRP are split across every calendar day
 * from flight_start through flight_end, inclusive, with the saved
 * weekday/weekend weighting (default 18% per weekday, 5% per weekend day),
 * then rolled up into the Tuesday week those days fall in.
 *
 * Date math is UTC on YYYY-MM-DD so isolate TZ cannot shift the week.
 */

export type FlightWeighting = { weekdayPct: number; weekendPct: number };

export const DEFAULT_FLIGHT_WEIGHTING: FlightWeighting = { weekdayPct: 18, weekendPct: 5 };

export type DaySplit = { date: string; spend: number; grp: number };

export type WeekAmountSplit = {
  weekOf: string;
  flightStart: string;
  flightEnd: string;
  spend: number;
  grp: number;
};

export type FlightDateProblem = "missing" | "inverted";

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseYmd(iso: string): Date | null {
  const match = YMD.exec(iso.trim());
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addIsoDays(iso: string, days: number): string {
  const date = parseYmd(iso);
  if (!date) return iso;
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

function weekStartFor(date: Date, anchorDay = 2): Date {
  const day = date.getUTCDay();
  const diff = (day - anchorDay + 7) % 7;
  const start = new Date(date);
  start.setUTCDate(date.getUTCDate() - diff);
  return start;
}

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/** Tuesday (default) that starts the Almanac week containing `dateStr`. */
export function canonicalWeekOf(dateStr: string, anchorDay = 2): string {
  const date = parseYmd(dateStr);
  if (!date) return dateStr;
  return toIso(weekStartFor(date, anchorDay));
}

/** Inclusive Tue–Mon window for a canonical week start. */
export function canonicalWeekWindow(weekOf: string): { start: string; end: string } {
  return { start: weekOf, end: addIsoDays(weekOf, 6) };
}

export function classifyFlightDates(
  flightStart: string | null | undefined,
  flightEnd: string | null | undefined,
): FlightDateProblem | null {
  if (!flightStart || !flightEnd) return "missing";
  if (flightEnd < flightStart) return "inverted";
  return null;
}

export function splitFlightByDay(
  flightStart: string,
  flightEnd: string,
  totalSpend: number,
  totalGrp: number,
  weighting: FlightWeighting = DEFAULT_FLIGHT_WEIGHTING,
): DaySplit[] {
  const start = parseYmd(flightStart);
  const end = parseYmd(flightEnd);
  if (!start || !end || end < start) return [];

  const days: Date[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    days.push(new Date(cursor));
  }

  const shares = days.map((day) => (isWeekend(day) ? weighting.weekendPct : weighting.weekdayPct));
  const totalShare = shares.reduce((sum, share) => sum + share, 0);
  if (totalShare <= 0) return [];

  const result: DaySplit[] = [];
  let spendUsed = 0;
  let grpUsed = 0;
  days.forEach((day, i) => {
    const isLast = i === days.length - 1;
    const spend = isLast ? totalSpend - spendUsed : Math.round((totalSpend * shares[i]!) / totalShare);
    const grp = isLast ? totalGrp - grpUsed : Math.round((totalGrp * shares[i]!) / totalShare);
    spendUsed += spend;
    grpUsed += grp;
    result.push({ date: toIso(day), spend, grp });
  });
  return result;
}

/**
 * Weighted overlap of a flight with canonical Tuesday weeks.
 * Missing or inverted dates return an empty week list — callers omit them
 * from "this week" (Almanac counts those in full only for race-to-date).
 */
export function allocateFlightByWeek(
  flightStart: string | null | undefined,
  flightEnd: string | null | undefined,
  amounts: { spend: number; grp: number },
  weighting: FlightWeighting = DEFAULT_FLIGHT_WEIGHTING,
  anchorDay = 2,
): { weeks: WeekAmountSplit[]; problem: FlightDateProblem | null } {
  const start = String(flightStart ?? "").trim();
  const end = String(flightEnd ?? "").trim() || start;
  const problem = classifyFlightDates(start, end);
  if (problem) return { weeks: [], problem };
  const days = splitFlightByDay(start, end, amounts.spend, amounts.grp, weighting);
  const byWeek = new Map<string, DaySplit[]>();
  for (const day of days) {
    const weekOf = canonicalWeekOf(day.date, anchorDay);
    const list = byWeek.get(weekOf);
    if (list) list.push(day);
    else byWeek.set(weekOf, [day]);
  }
  const weeks = [...byWeek.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekOf, weekDays]) => ({
      weekOf,
      flightStart: weekDays[0]!.date,
      flightEnd: weekDays[weekDays.length - 1]!.date,
      spend: weekDays.reduce((sum, day) => sum + day.spend, 0),
      grp: weekDays.reduce((sum, day) => sum + day.grp, 0),
    }));
  return { weeks, problem: null };
}

/** Amount of a flight that lands in `weekOf` (Tuesday ISO). */
export function weekSliceOfFlight(
  flightStart: string | null | undefined,
  flightEnd: string | null | undefined,
  amounts: { spend: number; grp: number },
  weekOf: string,
): { spend: number; grp: number } {
  const { weeks } = allocateFlightByWeek(flightStart, flightEnd, amounts);
  const slice = weeks.find((week) => week.weekOf === weekOf);
  return { spend: slice?.spend ?? 0, grp: slice?.grp ?? 0 };
}
