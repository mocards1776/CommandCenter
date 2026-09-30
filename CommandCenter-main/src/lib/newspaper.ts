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

/** Calendar day of an instant in Central time. Display strings are not dates. */
export function instantDay(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

/**
 * Whether a timestamp belongs in this edition. That is the dateline itself or
 * the night before it. Saturday's football is not Wednesday's news.
 */
export function editionCovers(iso: string | null | undefined, edition = editionDay()): boolean {
  if (!iso) return false;
  const day = instantDay(iso);
  if (!day) return false;
  return day === edition || day === editionNewsDay(edition);
}

/**
 * Wider window for packing section pages with articles and recaps. Front-page
 * lead copy still uses the tight edition window; inside pages may reach back.
 */
export function editionCoversRecent(
  iso: string | null | undefined,
  edition = editionDay(),
  lookbackDays = 5,
): boolean {
  if (!iso) return false;
  const day = instantDay(iso);
  if (!day) return false;
  let cursor = edition;
  for (let i = 0; i <= lookbackDays; i += 1) {
    if (day === cursor) return true;
    cursor = shiftDay(cursor, -1);
  }
  return false;
}

function centralHourOf(iso: string): { day: string; hour: number } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const day = d.toLocaleDateString("en-CA", { timeZone: TZ });
  const hh = d.toLocaleString("en-US", {
    timeZone: TZ,
    hour: "2-digit",
    hour12: false,
  });
  return { day, hour: Number(hh) % 24 };
}

/**
 * A final belongs only in the edition that covers the night it was played:
 * filed after 5 PM Central on the news day, through 10 AM Central on the
 * dateline. A Monday afternoon rewrite of Sunday stays in Monday's paper.
 */
export function editionCoversResult(iso: string | null | undefined, edition = editionDay()): boolean {
  if (!iso) return false;
  const clock = centralHourOf(iso);
  if (!clock) return false;
  const news = editionNewsDay(edition);
  if (clock.day === news && clock.hour >= 17) return true;
  if (clock.day === edition && clock.hour < 10) return true;
  return false;
}

/**
 * Game copy: a recap, a final with a score, or a headline that is the result.
 * A transaction, an injury note, or a preview is not.
 */
export function isResultCopy(input: {
  headline?: string | null;
  dek?: string | null;
  type?: string | null;
  status?: string | null;
  scoreLine?: string | null;
}): boolean {
  const kind = `${input.type ?? ""} ${input.status ?? ""}`.toLowerCase();
  if (/\brecap\b/.test(kind)) return true;
  if (
    input.status &&
    /final/i.test(input.status) &&
    input.scoreLine &&
    /\d/.test(input.scoreLine)
  ) {
    return true;
  }
  const hay = `${input.headline ?? ""} ${input.dek ?? ""}`.toLowerCase();
  return (
    /\bin (?:a |the )?(?:win|loss|defeat)\b/.test(hay) ||
    /\bwin (?:over|vs\.?|against)\b/.test(hay) ||
    /\b(?:beat|defeated|edged|routed|downed|topped) the\b/.test(hay) ||
    /\b(?:lifts|lifted)\b[^.]{0,48}\b(?:win|victory)\b/.test(hay) ||
    /\bposts? \d+ points\b/.test(hay) ||
    /\brecaps?\b/.test(hay) ||
    /\b\d{1,3}\s*[-–]\s*\d{1,3}\s+(?:win|loss|victory|defeat)\b/.test(hay)
  );
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

/**
 * How hard Section A should push a club. Home desk first, then Lions, Chiefs,
 * then soccer — matches the paper's real interest order.
 */
export function favoriteDeskWeight(key: string): number {
  if (key === "mlb-stl") return 100;
  if (key === "nhl-stl") return 100;
  if (key === "cfb-mizzou" || key === "cbb-mizzou") return 100;
  if (key === "nfl-det") return 70;
  if (key === "nfl-kc") return 50;
  if (key === "cfb-missouri-state" || key === "cbb-missouri-state") return 40;
  if (key === "eng-arsenal" || key === "eng-wrexham" || key === "eng-wolves") return 25;
  if (key.startsWith("eng-") || key.includes("soccer")) return 20;
  return 10;
}

/**
 * Split story copy so the front can tease and a later folio carries the rest.
 * Prefers paragraph, then sentence, then word boundaries.
 */
export function splitStoryCopy(
  text: string,
  teaserChars: number,
): { teaser: string; rest: string } {
  const raw = text.replace(/\s+/g, " ").trim();
  if (!raw) return { teaser: "", rest: "" };
  if (raw.length <= teaserChars) return { teaser: raw, rest: "" };

  const window = raw.slice(0, teaserChars + 80);
  const para = window.lastIndexOf("\n\n");
  const sentence = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("! "),
    window.lastIndexOf("? "),
  );
  const space = window.lastIndexOf(" ");
  let cut = teaserChars;
  if (para >= teaserChars * 0.45) cut = para;
  else if (sentence >= teaserChars * 0.55) cut = sentence + 1;
  else if (space >= teaserChars * 0.6) cut = space;

  const teaser = raw.slice(0, cut).trim();
  const rest = raw.slice(cut).trim();
  if (rest.length < 120) return { teaser: raw, rest: "" };
  return { teaser, rest };
}
