/**
 * Run with: node --experimental-strip-types src/lib/mlb-score-ui.test.ts
 * from CommandCenter-main/.
 */
import { isEmptyBasesLabel, mlbFinalWinnerFlags, mlbInningLabel } from "./mlb-score-ui.ts";

const assert = {
  equal(actual: unknown, expected: unknown, msg?: string) {
    if (actual !== expected) {
      throw new Error(`${msg ?? "assert.equal"}: expected ${String(expected)}, got ${String(actual)}`);
    }
  },
};

const liveTrail = mlbFinalWinnerFlags({
  pregame: false,
  live: true,
  awayRuns: 1,
  homeRuns: 5,
});
assert.equal(liveTrail.awayWins, false, "live trailing away is not faded");
assert.equal(liveTrail.homeWins, false, "live leading home is not a final winner");

const finalHome = mlbFinalWinnerFlags({
  pregame: false,
  live: false,
  awayRuns: 1,
  homeRuns: 5,
});
assert.equal(finalHome.awayWins, false, "final loser is not awayWins");
assert.equal(finalHome.homeWins, true, "final home win fades the visitor");

const finalAway = mlbFinalWinnerFlags({
  pregame: false,
  live: false,
  awayRuns: 4,
  homeRuns: 2,
});
assert.equal(finalAway.awayWins, true, "final away win");
assert.equal(finalAway.homeWins, false, "final away win does not mark home");

const preview = mlbFinalWinnerFlags({
  pregame: true,
  live: false,
  awayRuns: 0,
  homeRuns: 0,
});
assert.equal(preview.awayWins, false, "preview does not fade");
assert.equal(preview.homeWins, false, "preview does not fade home");

const warmup = mlbFinalWinnerFlags({
  pregame: false,
  live: true,
  awayRuns: 0,
  homeRuns: 1,
});
assert.equal(warmup.awayWins, false, "warmup/in-progress is not a final fade");
assert.equal(warmup.homeWins, false, "warmup/in-progress home lead is not faded");

assert.equal(isEmptyBasesLabel("Empty"), true);
assert.equal(isEmptyBasesLabel("EMPTY"), true);
assert.equal(isEmptyBasesLabel("Loaded"), false);
assert.equal(isEmptyBasesLabel("1st"), false);
assert.equal(isEmptyBasesLabel(null), false);

assert.equal(mlbInningLabel("Top 3rd"), "Top 3rd");
assert.equal(mlbInningLabel("Bottom 3rd"), "Bottom 3rd");
assert.equal(mlbInningLabel("Bot 3rd"), "Bottom 3rd", "ESPN Bot → Bottom");
assert.equal(mlbInningLabel("Middle 3rd"), "Mid 3rd", "StatsAPI Middle → Mid");
assert.equal(mlbInningLabel("Mid 7th"), "Mid 7th");
assert.equal(mlbInningLabel("End 3rd"), "End 3rd");
assert.equal(mlbInningLabel("End of 8th"), "End 8th");
assert.equal(mlbInningLabel("TOP 2ND"), "Top 2nd");
assert.equal(mlbInningLabel("Top of the 9th"), "Top 9th");
assert.equal(mlbInningLabel("Top 10th"), "Top 10th", "extras");
assert.equal(mlbInningLabel("Bottom 11th"), "Bottom 11th");
assert.equal(mlbInningLabel("Top 12th"), "Top 12th");
assert.equal(mlbInningLabel("Bottom 21st"), "Bottom 21st");
assert.equal(mlbInningLabel("Top 1"), "Top 1st");
assert.equal(mlbInningLabel("Warmup"), null);
assert.equal(mlbInningLabel("In Progress"), null);
assert.equal(mlbInningLabel("Final"), null);
assert.equal(mlbInningLabel(""), null);
assert.equal(mlbInningLabel(null), null);

console.log("mlb-score-ui: ok");
