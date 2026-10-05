/**
 * Times-only fill for MLB bracket placeholders. Sports App `mlb.ts` stays
 * untouched; the paper substitutes real WC winners for "AL Low/High TBD".
 */
import type { MlbPlayoffSeries, MlbPlayoffSide, MlbPlayoffTree } from "./mlb.ts";

function seriesWinner(series: MlbPlayoffSeries): MlbPlayoffSide | null {
  if (series.away.placeholder || series.home.placeholder) return null;
  const need = Math.ceil(series.gamesInSeries / 2);
  if (series.completed || series.away.wins >= need || series.home.wins >= need) {
    return series.away.wins >= series.home.wins ? series.away : series.home;
  }
  return null;
}

function isTbdSide(side: MlbPlayoffSide): boolean {
  if (side.placeholder) return true;
  return /^(AL|NL)\s*(Low|High)$/i.test(side.abbrev) || /\bTBD\b/i.test(side.abbrev) || /\bTBD\b/i.test(side.name);
}

function asSeed(side: MlbPlayoffSide): MlbPlayoffSide {
  return { ...side, wins: 0, placeholder: false };
}

export function fillMlbPlayoffPlaceholders(tree: MlbPlayoffTree): MlbPlayoffTree {
  const wc = tree.rounds.find((round) => round.id === "wc")?.series ?? [];
  const winners = {
    AL: wc.filter((s) => s.league === "AL").map(seriesWinner).filter((s): s is MlbPlayoffSide => Boolean(s)),
    NL: wc.filter((s) => s.league === "NL").map(seriesWinner).filter((s): s is MlbPlayoffSide => Boolean(s)),
  };

  return {
    ...tree,
    rounds: tree.rounds.map((round) => {
      if (round.id !== "ds") return round;
      return {
        ...round,
        series: round.series.map((series) => {
          const pool = series.league === "AL" || series.league === "NL" ? [...winners[series.league]] : [];
          const taken = new Set([series.away.teamId, series.home.teamId].filter((id): id is number => id != null));
          const nextUnused = (): MlbPlayoffSide | null => {
            const i = pool.findIndex((side) => side.teamId != null && !taken.has(side.teamId));
            if (i < 0) return null;
            const [side] = pool.splice(i, 1);
            if (side?.teamId != null) taken.add(side.teamId);
            return side ?? null;
          };
          const fill = (side: MlbPlayoffSide): MlbPlayoffSide => {
            if (!isTbdSide(side)) return side;
            const winner = nextUnused();
            return winner ? { ...asSeed(winner), wins: side.wins } : side;
          };
          return { ...series, away: fill(series.away), home: fill(series.home) };
        }),
      };
    }),
  };
}
