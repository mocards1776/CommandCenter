/**
 * Pre-game start label for RUWT-style cards. Always Central time with a
 * plain "CT" suffix so a card never shows a raw status word ("Scheduled",
 * "STATUS_SCHEDULED", "Pre-Game") where the kickoff should be.
 */

const CHICAGO = "America/Chicago";

/** Feed status words that carry no start-time information. */
const STATUS_WORD = /^(status_)?(scheduled|pre[-\s]?game|pre|preview|tbd|tba)$/i;

export type StartLabelParts = {
  /** "1:45 PM CT", or the cleaned fallback / "TBD" when no usable ISO. */
  label: string;
  /** "Tomorrow", "Wed" or "Oct 21" when the game is not on today's Chicago date. */
  date: string | null;
};

function chicagoDay(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: CHICAGO });
}

function dayIndex(day: string): number {
  // "YYYY-MM-DD" in Chicago → whole days since epoch (zone-free compare).
  return Math.round(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) / 86_400_000);
}

export function isStatusWord(text: string | null | undefined): boolean {
  return STATUS_WORD.test((text ?? "").trim());
}

/** Strip a zone suffix ("7:00 PM CDT" → "7:00 PM") and status-only words. */
export function cleanStartFallback(fallback: string | null | undefined): string | null {
  const text = (fallback ?? "").replace(/\s+[A-Z]{2,4}T$/, "").trim();
  if (!text || isStatusWord(text)) return null;
  return text;
}

export function centralStartParts(
  iso: string | null | undefined,
  fallback?: string | null,
  now: Date = new Date(),
): StartLabelParts {
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      const time = d.toLocaleTimeString("en-US", {
        timeZone: CHICAGO,
        hour: "numeric",
        minute: "2-digit",
      });
      const gameDay = chicagoDay(d);
      const today = chicagoDay(now);
      let date: string | null = null;
      if (gameDay !== today) {
        const delta = dayIndex(gameDay) - dayIndex(today);
        if (delta === 1) date = "Tomorrow";
        else if (delta > 1 && delta < 7) {
          date = d.toLocaleDateString("en-US", { timeZone: CHICAGO, weekday: "short" });
        } else {
          date = d.toLocaleDateString("en-US", { timeZone: CHICAGO, month: "short", day: "numeric" });
        }
      }
      return { label: `${time} CT`, date };
    }
  }
  return { label: cleanStartFallback(fallback) ?? "TBD", date: null };
}

/** Single-line form: "1:45 PM CT" (the date note is left to the card). */
export function centralStartLabel(
  iso: string | null | undefined,
  fallback?: string | null,
  now?: Date,
): string {
  return centralStartParts(iso, fallback, now).label;
}
