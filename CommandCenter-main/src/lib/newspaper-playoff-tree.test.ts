/**
 * Run with: node --experimental-strip-types src/lib/newspaper-playoff-tree.test.ts
 * from CommandCenter-main/.
 */
import type { MlbPlayoffSeries, MlbPlayoffSide, MlbPlayoffTree } from "./mlb.ts";
import { fillMlbPlayoffPlaceholders } from "./newspaper-playoff-tree.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function side(partial: Partial<MlbPlayoffSide> & Pick<MlbPlayoffSide, "abbrev">): MlbPlayoffSide {
  return {
    teamId: partial.teamId ?? null,
    name: partial.name ?? partial.abbrev,
    abbrev: partial.abbrev,
    wins: partial.wins ?? 0,
    placeholder: partial.placeholder ?? false,
  };
}

function series(partial: Partial<MlbPlayoffSeries> & Pick<MlbPlayoffSeries, "id" | "round" | "league">): MlbPlayoffSeries {
  return {
    label: partial.label ?? partial.id,
    slot: partial.slot ?? "",
    gamesInSeries: partial.gamesInSeries ?? 3,
    seriesStatus: partial.seriesStatus ?? null,
    completed: partial.completed ?? false,
    away: partial.away ?? side({ abbrev: "TBD", placeholder: true }),
    home: partial.home ?? side({ abbrev: "TBD", placeholder: true }),
    games: partial.games ?? [],
    ...partial,
  };
}

const tree: MlbPlayoffTree = {
  season: 2026,
  active: true,
  rounds: [
    {
      id: "wc",
      label: "Wild Card",
      series: [
        series({
          id: "al-wc-a",
          round: "wc",
          league: "AL",
          completed: true,
          gamesInSeries: 3,
          away: side({ teamId: 136, abbrev: "SEA", name: "Mariners", wins: 2 }),
          home: side({ teamId: 110, abbrev: "BAL", name: "Orioles", wins: 0 }),
        }),
      ],
    },
    {
      id: "ds",
      label: "Division Series",
      series: [
        series({
          id: "alds-a",
          round: "ds",
          league: "AL",
          gamesInSeries: 5,
          away: side({ abbrev: "AL Low", name: "AL Low", placeholder: true }),
          home: side({ teamId: 147, abbrev: "NYY", name: "Yankees" }),
        }),
      ],
    },
  ],
};

const filled = fillMlbPlayoffPlaceholders(tree);
const alds = filled.rounds.find((r) => r.id === "ds")?.series[0];
assert(alds?.away.abbrev === "SEA" && alds.away.placeholder === false, "AL Low fills from the WC winner");
assert(alds?.home.abbrev === "NYY", "the division host stays");

console.log("newspaper-playoff-tree ok");
