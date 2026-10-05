/**
 * Run with: node --experimental-strip-types src/lib/newspaper-editions.test.ts
 * from CommandCenter-main/.
 */
import {
  backEditionNote,
  editionPickerLabel,
  filterRecentFiledIssues,
  isIssueWithinLookback,
  resolveEditionParam,
} from "./newspaper-editions.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const morning = { id: "2026-10-05-morning", printedAt: "2026-10-05T11:02:00.000Z" }; // 6:02 a.m. CT
const midday = { id: "2026-10-05-midday", printedAt: "2026-10-05T17:01:00.000Z" }; // 12:01 p.m. CT
const evening = { id: "2026-10-05-evening", printedAt: "2026-10-05T22:03:00.000Z" }; // 5:03 p.m. CT
const ydayEvening = { id: "2026-10-04-evening", printedAt: "2026-10-04T22:00:00.000Z" };
const oldMorning = { id: "2026-10-03-morning", printedAt: "2026-10-03T11:00:00.000Z" };

const afternoon = Date.parse("2026-10-05T21:30:00.000Z"); // 4:30 p.m. CT — last night's evening still in
const night = Date.parse("2026-10-05T23:30:00.000Z"); // 6:30 p.m. CT

const recent = filterRecentFiledIssues([oldMorning, ydayEvening, morning, midday, evening], afternoon);
assert(recent.map((r) => r.id).join(",") === "2026-10-05-midday,2026-10-05-morning,2026-10-04-evening", "newest first, last 24h only");
assert(!recent.some((r) => r.id === oldMorning.id), "drops an issue older than 24 hours");
assert(isIssueWithinLookback(morning, night), "morning is still readable at night");
assert(!isIssueWithinLookback(ydayEvening, night), "yesterday's evening drops once 24 hours have passed");
assert(!isIssueWithinLookback(oldMorning, night), "two-day-old morning is closed");
assert(!isIssueWithinLookback({ id: "not-an-issue", printedAt: evening.printedAt }, night), "rejects a bad id");

assert(resolveEditionParam("2026-10-05-morning", recent) === "2026-10-05-morning", "honors a stand id");
assert(resolveEditionParam("2026-10-03-morning", recent) === "2026-10-05-midday", "ignores an older ?edition=");
assert(resolveEditionParam(null, recent) === "2026-10-05-midday", "defaults to the latest");
assert(resolveEditionParam("2026-10-05-morning", []) === null, "empty stand has no selection");

assert(editionPickerLabel("2026-10-05-morning", recent) === "Morning", "same-day slot is just the name");
assert(editionPickerLabel("2026-10-04-evening", recent) === "Sun. Evening", "yesterday gets a weekday");
assert(backEditionNote("2026-10-05-morning", morning.printedAt) === "You are reading the Morning Edition, printed 6:02 a.m.", "folio note uses the print clock");

const justMorning = filterRecentFiledIssues([morning], Date.parse("2026-10-05T14:00:00.000Z"));
assert(editionPickerLabel("2026-10-05-morning", justMorning) === "Morning", "one day on the stand needs no weekday");

console.log("newspaper-editions ok");
