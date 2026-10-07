/**
 * Run with: node --experimental-strip-types src/lib/playoff-series.test.ts
 * from CommandCenter-main/.
 */
import {
  formatPlayoffSeriesLine,
  mergeSeriesLines,
  playoffElimination,
  seriesLineFromEspn,
  seriesLineFromMlb,
} from "./playoff-series.ts";

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
  }
}

assertEqual(
  seriesLineFromEspn({
    series: {
      type: "playoff",
      summary: "LAD lead series 1-0",
      totalCompetitions: 5,
    },
    notes: [{ headline: "NLDS - Game 2" }],
  }),
  "LAD leads series 1-0 · Game 2 of 5",
  "ESPN lead plus game number",
);

assertEqual(
  seriesLineFromEspn({
    series: { type: "playoff", summary: "", totalCompetitions: 5 },
    notes: [{ headline: "NLDS - Game 1" }],
  }),
  "Game 1 of 5",
  "empty summary still has the game number",
);

assertEqual(
  seriesLineFromEspn({
    series: { type: "regular", summary: "Season series tied 1-1", totalCompetitions: 3 },
    notes: [{ headline: "Game 2" }],
  }),
  null,
  "regular-season series is not a playoff line",
);

assertEqual(
  seriesLineFromEspn({ notes: [{ headline: "NBA Canada Games 2026" }] }),
  null,
  "a note without a playoff series is omitted",
);

assertEqual(
  seriesLineFromMlb({
    gameType: "D",
    seriesGameNumber: 2,
    gamesInSeries: 5,
    seriesStatus: {
      result: "LAD leads 1-0",
      gameNumber: 2,
      totalGames: 5,
      wins: 1,
      losses: 0,
      isTied: false,
    },
  }),
  "LAD leads 1-0 · Game 2 of 5",
  "MLB division series result",
);

assertEqual(
  seriesLineFromMlb({
    gameType: "D",
    seriesGameNumber: 1,
    gamesInSeries: 5,
    seriesStatus: {
      result: null,
      shortDescription: "NLDS Game 1",
      gameNumber: 1,
      totalGames: 5,
      wins: 0,
      losses: 0,
      isTied: true,
    },
  }),
  "Game 1 of 5",
  "0-0 is not series tied",
);

assertEqual(
  seriesLineFromMlb({
    gameType: "R",
    seriesStatus: { result: "STL leads 4-2", gameNumber: 6, totalGames: 7 },
  }),
  null,
  "regular season stays blank",
);

assertEqual(
  formatPlayoffSeriesLine({
    playoff: true,
    isTied: true,
    wins: 1,
    losses: 1,
    gameNumber: 3,
    totalGames: 5,
  }),
  "Series tied 1-1 · Game 3 of 5",
  "tied counts when both sides have a win",
);

assertEqual(
  mergeSeriesLines("Game 2 of 5", "MIL leads series 2-1 · Game 2 of 5"),
  "MIL leads series 2-1 · Game 2 of 5",
  "a lead replaces a bare game number",
);
assertEqual(
  mergeSeriesLines("LAD leads 1-0 · Game 2 of 5", "Game 2 of 5"),
  "LAD leads 1-0 · Game 2 of 5",
  "an existing lead is kept",
);
assertEqual(mergeSeriesLines(null, null), null, "nothing to show");

assertEqual(
  playoffElimination({ seriesLine: "LAD leads 2-1 · Game 4 of 5" })?.facing,
  1,
  "ATL is out with a loss in a 2-1 best-of-five",
);
assertEqual(
  playoffElimination({ seriesLine: "CWS leads 2-0 · Game 3 of 5" })?.facing,
  1,
  "CLE is out with a loss in a 2-0 best-of-five",
);
assertEqual(
  playoffElimination({ seriesLine: "Series tied 2-2 · Game 5 of 5" })?.facing,
  2,
  "2-2 in a best of five is winner-take-all",
);
assertEqual(
  playoffElimination({ seriesLine: "Series tied 1-1 · Game 3 of 5" }),
  null,
  "1-1 in a best of five is not elimination yet",
);
assertEqual(
  playoffElimination({ seriesLine: "SEA leads 3-2 · Game 6 of 7" })?.facing,
  1,
  "a 3-2 best-of-seven is one-sided elimination",
);
assertEqual(
  playoffElimination({ seriesLine: "Game 7 of 7" })?.facing,
  2,
  "the last scheduled game is winner-take-all when the lead is missing",
);
assertEqual(
  playoffElimination({ seriesLine: "Game 1 of 5" }),
  null,
  "game 1 with no lead is not elimination",
);

console.log("playoff-series.test.ts ok");
