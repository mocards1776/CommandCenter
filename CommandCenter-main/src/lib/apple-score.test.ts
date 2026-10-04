import { appleClockLine, appleClockParts, isBreakStatus, liveScoreHeader, timeoutMarks } from "./apple-score.ts";

const assert = {
  equal(actual: unknown, expected: unknown) {
    if (actual !== expected) throw new Error(`${String(actual)} !== ${String(expected)}`);
  },
};

assert.equal(appleClockLine("12:02 - 4th"), "4th 12:02");
assert.equal(appleClockLine("4:14 - 4th Quarter"), "4th 4:14");
assert.equal(appleClockLine("15:00 - 3RD"), "3rd 15:00");
assert.equal(appleClockLine("End of 3rd"), "End of 3rd");
assert.equal(appleClockLine("Final"), "Final");
assert.equal(appleClockLine("Halftime"), "Halftime");
assert.equal(appleClockLine("Top 7th"), "Top 7th");
assert.equal(appleClockLine("  "), "");
assert.equal(appleClockParts("1:59 - 2nd").period, "2nd");
assert.equal(appleClockParts("1:59 - 2nd").clock, "1:59");
assert.equal(appleClockParts("Halftime").period, null);
assert.equal(appleClockParts("Halftime").clock, null);
assert.equal(isBreakStatus("End of 1st"), true);
assert.equal(isBreakStatus("End of 1st Quarter"), true);
assert.equal(isBreakStatus("End of 1st Period"), true);
assert.equal(isBreakStatus("End 7th"), true);
assert.equal(isBreakStatus("Halftime"), true);
assert.equal(isBreakStatus("HT"), true);
assert.equal(isBreakStatus("1st Intermission"), true);
assert.equal(isBreakStatus("Intermission"), true);
assert.equal(isBreakStatus("Middle 7th"), true);
assert.equal(isBreakStatus("12:02 - 4th"), false);
assert.equal(isBreakStatus("Final"), false);
assert.equal(isBreakStatus("1:03 - 1st"), false);
assert.equal(isBreakStatus("Top 7th"), false);
assert.equal(isBreakStatus("Bottom 3rd"), false);
assert.equal(liveScoreHeader("12:34 - 1st", "Live"), "Live");
assert.equal(liveScoreHeader("End of 1st", "Live"), "End of 1st");
assert.equal(liveScoreHeader("1st Intermission", "Live"), "1st Intermission");
assert.equal(liveScoreHeader("Middle 7th", "Live"), "Middle 7th");
assert.equal(liveScoreHeader("Top 7th", "Live"), "Live");
assert.equal(liveScoreHeader("", "Live"), "Live");

assert.equal(timeoutMarks(null), 0);
assert.equal(timeoutMarks(undefined), 0);
assert.equal(timeoutMarks(0), 0);
assert.equal(timeoutMarks(2), 2);
assert.equal(timeoutMarks(3), 3);
assert.equal(timeoutMarks(9), 3);

console.log("apple-score ok");
