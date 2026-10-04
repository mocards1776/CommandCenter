export type AppleClockParts = {
  /** Quarter / period when the detail is "clock - period". */
  period: string | null;
  clock: string | null;
  /** Single-line form used on RUWT cards: "4th 12:02", or the original words. */
  line: string;
};

/**
 * Apple Sports score rhythm: "12:02 - 4th" splits into quarter + clock.
 * Labels without a clock (Final, Halftime, End of 3rd) stay as words.
 */
export function appleClockParts(detail: string | null | undefined): AppleClockParts {
  const text = (detail ?? "").replace(/\s+/g, " ").trim();
  if (!text) return { period: null, clock: null, line: "" };
  const clockFirst = text.match(/^(\d{1,2}:\d{2})\s*[-–—]\s*(.+)$/);
  if (clockFirst) {
    const period = tidyPeriod(clockFirst[2]);
    const clock = clockFirst[1];
    return {
      period: period || null,
      clock,
      line: period ? `${period} ${clock}` : clock,
    };
  }
  const line = tidyPeriod(text);
  return { period: null, clock: null, line };
}

export function appleClockLine(detail: string | null | undefined): string {
  return appleClockParts(detail).line;
}

/**
 * Period breaks have no running clock. "End of 1st", "Halftime",
 * "1st Intermission", and baseball "Middle 7th" / "End 7th" belong
 * in the status chip, not in the band between the score numerals.
 */
export function isBreakStatus(detail: string | null | undefined): boolean {
  const text = (detail ?? "").replace(/\s+/g, " ").trim();
  if (!text) return false;
  return /^(end of\b|end\s+\d|halftime\b|ht\b|intermission\b|middle\b|\d+(?:st|nd|rd|th)\s+intermission\b)/i.test(
    text,
  );
}

/**
 * Header status while a game is in progress.
 * A running clock or live words sit between the tall scores, so the header
 * just says Live. A period break stays in the header — that copy reads as a
 * third numeral when it is parked between the scores.
 */
export function liveScoreHeader(detail: string | null | undefined, fallback: string): string {
  const text = (detail ?? "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  if (isBreakStatus(text)) return text;
  return "Live";
}

function tidyPeriod(raw: string): string {
  return raw
    .replace(/\bquarter\b/gi, "")
    .replace(/\b(\d+)(st|nd|rd|th)\b/gi, (_, n: string, suf: string) => `${n}${suf.toLowerCase()}`)
    .replace(/\s+/g, " ")
    .trim();
}

/** Remaining timeouts ESPN already sent. Unknown or zero draws nothing. */
export function timeoutMarks(count: number | null | undefined): number {
  if (typeof count !== "number" || !Number.isFinite(count) || count <= 0) return 0;
  return Math.min(3, Math.floor(count));
}
