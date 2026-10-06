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
