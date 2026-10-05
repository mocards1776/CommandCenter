/**
 * Election Day ear for A1. Day count is the edition dateline (America/Chicago),
 * never the viewer's clock, so a back issue stays accurate.
 */

/** Next Election Day as a Central calendar date. Change this for 2028, etc. */
export const ELECTION_DAY = "2026-11-03";

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

const AP_MONTH: Record<number, string> = {
  1: "Jan.",
  2: "Feb.",
  3: "March",
  4: "April",
  5: "May",
  6: "June",
  7: "July",
  8: "Aug.",
  9: "Sept.",
  10: "Oct.",
  11: "Nov.",
  12: "Dec.",
};

function utcDayNumber(ymd: string): number | null {
  const match = YMD.exec(ymd);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000;
}

/** Whole calendar days from the edition dateline to Election Day. */
export function daysUntilElection(editionDay: string, electionDay = ELECTION_DAY): number | null {
  const from = utcDayNumber(editionDay);
  const to = utcDayNumber(electionDay);
  if (from == null || to == null) return null;
  return to - from;
}

export type ElectionEarState = { kind: "countdown"; days: number } | { kind: "today" };

/** Countdown before the day, election-day copy on it, hidden after. */
export function electionEar(editionDay: string, electionDay = ELECTION_DAY): ElectionEarState | null {
  const days = daysUntilElection(editionDay, electionDay);
  if (days == null || days < 0) return null;
  if (days === 0) return { kind: "today" };
  return { kind: "countdown", days };
}

/** "Tuesday, Nov. 3, 2026" — AP month form, derived from the date constant. */
export function electionDayLabel(electionDay = ELECTION_DAY): string {
  const match = YMD.exec(electionDay);
  if (!match) return electionDay;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(date);
  return `${weekday}, ${AP_MONTH[month]} ${day}, ${year}`;
}

export const ELECTION_DAY_TODAY = "ELECTION DAY · Polls close 7 p.m.";
