/**
 * Apple Sports score rhythm: "12:02 - 4th" becomes "4th 12:02".
 * Labels without a clock (Final, Halftime, End of 3rd) stay as words.
 */
export function appleClockLine(detail: string | null | undefined): string {
  const text = (detail ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const clockFirst = text.match(/^(\d{1,2}:\d{2})\s*[-–—]\s*(.+)$/);
  if (clockFirst) {
    const period = tidyPeriod(clockFirst[2]);
    return period ? `${period} ${clockFirst[1]}` : clockFirst[1];
  }
  return tidyPeriod(text);
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
