import { centralStartLabel, centralStartParts, cleanStartFallback, isStatusWord } from "./start-label.ts";

const assert = {
  equal(actual: unknown, expected: unknown) {
    if (actual !== expected) throw new Error(`${String(actual)} !== ${String(expected)}`);
  },
};

// 2026-10-13 18:45Z is 1:45 PM CDT.
const now = new Date("2026-10-13T14:00:00Z");

// ISO wins over any status text, always Central.
assert.equal(centralStartLabel("2026-10-13T18:45Z", "Scheduled", now), "1:45 PM CT");
assert.equal(centralStartLabel("2026-10-13T18:45Z", "STATUS_SCHEDULED", now), "1:45 PM CT");
assert.equal(centralStartLabel("2026-10-14T00:00Z", "Pre-Game", now), "7:00 PM CT");
// Winter: CST.
assert.equal(centralStartLabel("2027-01-10T01:00Z", null, now), "7:00 PM CT");

// Today → no date note.
assert.equal(centralStartParts("2026-10-13T18:45Z", null, now).date, null);
// Late Central evening is still today even though it is past midnight UTC.
assert.equal(centralStartParts("2026-10-14T02:10Z", null, now).date, null);
// Tomorrow / this week / further out.
assert.equal(centralStartParts("2026-10-14T18:45Z", null, now).date, "Tomorrow");
assert.equal(centralStartParts("2026-10-16T18:45Z", null, now).date, "Fri");
assert.equal(centralStartParts("2026-10-21T18:45Z", null, now).date, "Oct 21");

// No ISO: status-only words collapse to TBD, real times survive without zone.
assert.equal(centralStartLabel(null, "Scheduled", now), "TBD");
assert.equal(centralStartLabel(undefined, "STATUS_SCHEDULED", now), "TBD");
assert.equal(centralStartLabel(null, "Pre-Game", now), "TBD");
assert.equal(centralStartLabel(null, "Preview", now), "TBD");
assert.equal(centralStartLabel("not-a-date", "7:00 PM CDT", now), "7:00 PM");
assert.equal(centralStartLabel(null, "", now), "TBD");
assert.equal(centralStartParts(null, "Scheduled", now).date, null);

assert.equal(isStatusWord("Scheduled"), true);
assert.equal(isStatusWord("STATUS_PRE"), true);
assert.equal(isStatusWord("Postponed"), false);
assert.equal(isStatusWord("1:45 PM"), false);
assert.equal(cleanStartFallback("Postponed"), "Postponed");
assert.equal(cleanStartFallback("1:45 PM EDT"), "1:45 PM");
assert.equal(cleanStartFallback("  "), null);

console.log("start-label ok");
