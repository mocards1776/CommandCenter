/**
 * Same split as AppleScoreCluster / appleClockParts: "2:00 - 2nd" → period + clock.
 * Kept here so the PNG does not import the browser app.
 */

export type ClockParts = {
  period: string | null;
  clock: string | null;
  line: string;
};

export function clockParts(detail: string | null | undefined): ClockParts {
  const text = (detail ?? "").replace(/\s+/g, " ").trim();
  if (!text) return { period: null, clock: null, line: "" };
  const clockFirst = text.match(/^(\d{1,2}:\d{2})\s*[-–—]\s*(.+)$/);
  if (clockFirst) {
    const period = tidyPeriod(clockFirst[2] ?? "");
    const clock = clockFirst[1] ?? "";
    return {
      period: period || null,
      clock,
      line: period ? `${period} ${clock}` : clock,
    };
  }
  const line = tidyPeriod(text);
  return { period: null, clock: null, line };
}

export function isBreakStatus(detail: string | null | undefined): boolean {
  const text = (detail ?? "").replace(/\s+/g, " ").trim();
  if (!text) return false;
  return /^(end of\b|end\s+\d|halftime\b|ht\b|intermission\b|middle\b|\d+(?:st|nd|rd|th)\s+intermission\b)/i.test(
    text,
  );
}

function tidyPeriod(raw: string): string {
  return raw
    .replace(/\bquarter\b/gi, "")
    .replace(/\b(\d+)(st|nd|rd|th)\b/gi, (_, n: string, suf: string) => `${n}${suf.toLowerCase()}`)
    .replace(/\s+/g, " ")
    .trim();
}
