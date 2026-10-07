/**
 * Live MLB scoreboard chrome. Trailing-team fade is finals-only.
 * Sports game detail — not Telegram / newspaper cards.
 */

export function mlbFinalWinnerFlags(input: {
  pregame: boolean;
  live: boolean;
  awayRuns: number;
  homeRuns: number;
}): { awayWins: boolean; homeWins: boolean } {
  const final = !input.pregame && !input.live;
  if (!final) return { awayWins: false, homeWins: false };
  return {
    awayWins: input.awayRuns > input.homeRuns,
    homeWins: input.homeRuns > input.awayRuns,
  };
}

/** Header nest never prints “EMPTY” — the diamond graphic covers vacant bags. */
export function isEmptyBasesLabel(label: string | null | undefined): boolean {
  return (label ?? "").trim().toLowerCase() === "empty";
}

function inningOrdinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const mod10 = n % 10;
  if (mod10 === 1) return `${n}st`;
  if (mod10 === 2) return `${n}nd`;
  if (mod10 === 3) return `${n}rd`;
  return `${n}th`;
}

/**
 * Hero-nest inning label: "Top 3rd", "Bottom 3rd", "Mid 3rd", "End 3rd",
 * "Top 10th". Accepts MLB StatsAPI (`Top 3rd`, `Bottom 3rd`, `Middle 3rd`,
 * `End 3rd`) and ESPN-style (`Bot 3rd`, `Mid 3rd`, `Top of the 3rd`) copy.
 * Anything without a half + inning number (Warmup, Delayed, Final) → null.
 */
export function mlbInningLabel(detail: string | null | undefined): string | null {
  const text = (detail ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!text) return null;
  const m = text.match(
    /^(top|t|bottom|bot|b|middle|mid|m|end|e)\.?(?:\s+of)?(?:\s+the)?\s*(\d{1,2})(?:st|nd|rd|th)?\b/,
  );
  if (!m) return null;
  const n = Number(m[2]);
  if (!Number.isFinite(n) || n < 1) return null;
  const half = m[1];
  const word = /^t/.test(half)
    ? "Top"
    : /^b/.test(half)
      ? "Bottom"
      : /^m/.test(half)
        ? "Mid"
        : "End";
  return `${word} ${inningOrdinal(n)}`;
}
