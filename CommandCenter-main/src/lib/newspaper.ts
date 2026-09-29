/** Helpers for the Thompson Times sports edition. */

const TZ = "America/Chicago";

/** The paper goes to press at 4:00 AM Central; before that you still hold yesterday's. */
export const EDITION_HOUR = 4;

/** Wall-clock hour (0-23) in Central time. */
function centralHour(now: Date): number {
  const hh = now.toLocaleString("en-US", {
    timeZone: TZ,
    hour: "2-digit",
    hour12: false,
  });
  return Number(hh) % 24;
}

function shiftDay(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/**
 * Which edition is on the stand. Central calendar date, except between midnight
 * and 4 AM you're still reading the previous day's paper — the same way a
 * morning daily doesn't reprint at 12:01.
 */
export function editionDay(now = new Date()): string {
  const today = now.toLocaleDateString("en-CA", { timeZone: TZ });
  return centralHour(now) < EDITION_HOUR ? shiftDay(today, -1) : today;
}

/** The night of games an edition covers: the day before its dateline. */
export function editionNewsDay(day = editionDay()): string {
  return shiftDay(day, -1);
}

/** Milliseconds until the next 4 AM Central press run, so an open app rolls itself over. */
export function msUntilNextEdition(now = new Date()): number {
  const day = editionDay(now);
  // Probe forward a minute at a time rather than doing offset math, so DST is
  // whatever the platform says it is.
  const step = 60_000;
  for (let t = now.getTime() + step; t < now.getTime() + 36 * 3_600_000; t += step) {
    if (editionDay(new Date(t)) !== day) return t - now.getTime();
  }
  return 6 * 3_600_000;
}

const ROMAN: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
  [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

/** Volume numerals, the way a broadsheet prints them. */
export function romanNumeral(n: number): string {
  let rest = Math.max(0, Math.floor(n));
  let out = "";
  for (const [value, glyph] of ROMAN) {
    while (rest >= value) {
      out += glyph;
      rest -= value;
    }
  }
  return out || "—";
}

/** Edition label: weekday + long date in Central time. */
export function editionDateLabel(day = editionDay()): string {
  const d = new Date(`${day}T12:00:00`);
  return d.toLocaleDateString("en-US", {
    timeZone: TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Compact dateline for masthead rules. */
export function editionDateline(day = editionDay()): string {
  const d = new Date(`${day}T12:00:00`);
  return d.toLocaleDateString("en-US", {
    timeZone: TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).toUpperCase();
}

/** Volume = calendar year; issue = day-of-year in Central time. */
export function editionIssue(day = editionDay()): { volume: number; issue: number } {
  const [y, m, d] = day.split("-").map(Number);
  const start = Date.UTC(y!, 0, 0);
  const now = Date.UTC(y!, m! - 1, d!);
  const issue = Math.floor((now - start) / 86_400_000);
  return { volume: y!, issue };
}

export function battingAverageLabel(avg: number): string {
  if (!Number.isFinite(avg) || avg <= 0) return ".000";
  const s = avg.toFixed(3);
  return s.startsWith("0") ? s.slice(1) : s;
}

export function moneyCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `$${(n / 1_000).toFixed(0)}k`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}
