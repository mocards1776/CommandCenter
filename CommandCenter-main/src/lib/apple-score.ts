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
