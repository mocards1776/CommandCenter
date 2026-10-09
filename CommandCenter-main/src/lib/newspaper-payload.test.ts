/**
 * Run with: node --experimental-strip-types src/lib/newspaper-payload.test.ts
 */
import { ISSUE_QUERY_COLUMNS, ISSUE_SHELL_COLUMNS, mergeQueries, queryDeskName } from "./newspaper-payload.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

assert(ISSUE_SHELL_COLUMNS.includes("stories") && !ISSUE_SHELL_COLUMNS.includes("queries"), "shell skips queries");
assert(ISSUE_QUERY_COLUMNS.includes("queries") && !ISSUE_QUERY_COLUMNS.includes("stories"), "desk fetch skips stories");
assert(ISSUE_SHELL_COLUMNS.includes("printed_at"), "shell keeps the print clock");

const queries = [
  { key: ["2026-10-05-evening", "tt-weather-marshfield"], data: { temp: 62 } },
  { key: ["2026-10-05-evening", "tt-board", "paths"], data: { mlb: {} } },
  { key: ["2026-10-05-evening", "tt-watch", "2026-10-05"], data: [] },
];

assert(queryDeskName(queries[0]!) === "tt-weather-marshfield", "reads the desk name");
assert(mergeQueries(queries.slice(0, 1), queries.slice(1)).length === 3, "merge keeps every desk");
assert(
  mergeQueries(queries, [{ key: ["2026-10-05-evening", "tt-watch", "2026-10-05"], data: [1] }])[2]?.data,
  "later write wins for the same key",
);

console.log("newspaper-payload ok");
