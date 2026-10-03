import { appleClockLine, appleClockParts, timeoutMarks } from "./apple-score.ts";

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

assert.equal(timeoutMarks(null), 0);
assert.equal(timeoutMarks(undefined), 0);
assert.equal(timeoutMarks(0), 0);
assert.equal(timeoutMarks(2), 2);
assert.equal(timeoutMarks(3), 3);
assert.equal(timeoutMarks(9), 3);

console.log("apple-score ok");
