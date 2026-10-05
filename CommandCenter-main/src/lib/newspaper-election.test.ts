/**
 * Run with: node --experimental-strip-types src/lib/newspaper-election.test.ts
 * from CommandCenter-main/.
 */
import {
  daysUntilElection,
  ELECTION_DAY,
  electionDayLabel,
  electionEar,
} from "./newspaper-election.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

assert(ELECTION_DAY === "2026-11-03", "Election Day is one Central date constant");
assert(daysUntilElection("2026-11-02") === 1, "Nov 2 is 1 day to Election Day");
assert(daysUntilElection("2026-11-03") === 0, "Nov 3 is Election Day");
assert(daysUntilElection("2026-11-04") === -1, "Nov 4 is the day after");

const monday = electionEar("2026-11-02");
assert(monday?.kind === "countdown" && monday.days === 1, "Nov 2 shows 1 day");
assert(electionEar("2026-11-03")?.kind === "today", "Nov 3 is election day");
assert(electionEar("2026-11-04") === null, "Nov 4 hides the ear");
assert(electionEar("2026-11-05") === null, "later editions stay hidden");

assert(daysUntilElection("2026-10-05") === 29, "Oct 5 morning paper is 29 days out");
const archived = electionEar("2026-10-05");
assert(archived?.kind === "countdown" && archived.days === 29, "archived Oct 5 keeps 29, not the viewer's clock");

assert(daysUntilElection("not-a-day") === null, "rejects a bad dateline");
assert(electionEar("2026-11-03-evening") === null, "a press id is not a dateline");
assert(electionDayLabel() === "Tuesday, Nov. 3, 2026", "label is AP style from the constant");
assert(electionDayLabel("2028-11-07") === "Tuesday, Nov. 7, 2028", "a later Election Day formats from the same helper");

console.log("newspaper-election ok");
