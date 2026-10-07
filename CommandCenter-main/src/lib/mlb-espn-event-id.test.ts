/**
 * Run with: node --experimental-strip-types src/lib/mlb-espn-event-id.test.ts
 * from CommandCenter-main/.
 */
import { looksLikeEspnMlbEventId } from "./mlb-espn-event-id.ts";

const assert = {
  equal(actual: unknown, expected: unknown, msg?: string) {
    if (actual !== expected) {
      throw new Error(`${msg ?? "assert.equal"}: expected ${String(expected)}, got ${String(actual)}`);
    }
  },
};

assert.equal(looksLikeEspnMlbEventId("401908004"), true, "Padres ESPN event id");
assert.equal(looksLikeEspnMlbEventId("401908015"), true, "Dodgers ESPN event id");
assert.equal(looksLikeEspnMlbEventId("849826"), false, "MLB Stats gamePk");
assert.equal(looksLikeEspnMlbEventId("747148"), false, "shorter MLB gamePk");
assert.equal(looksLikeEspnMlbEventId(""), false, "empty");
assert.equal(looksLikeEspnMlbEventId(null), false, "null");

console.log("mlb-espn-event-id.test.ts: ok");
