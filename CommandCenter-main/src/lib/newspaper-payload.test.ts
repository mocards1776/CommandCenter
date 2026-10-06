/**
 * Run with: node --experimental-strip-types src/lib/newspaper-payload.test.ts
 */
import {
  HEAVY_DESK_NAMES,
  ISSUE_QUERY_COLUMNS,
  ISSUE_SHELL_COLUMNS,
  heavyDesksForPage,
  heavyDesksForReader,
  isHeavyDesk,
  mergeQueries,
  pickQueriesNamed,
  queryDeskName,
  splitQueries,
} from "./newspaper-payload.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

assert(ISSUE_SHELL_COLUMNS.includes("stories") && !ISSUE_SHELL_COLUMNS.includes("queries"), "shell skips queries");
assert(ISSUE_QUERY_COLUMNS.includes("queries") && !ISSUE_QUERY_COLUMNS.includes("stories"), "desk fetch skips stories");
assert(ISSUE_SHELL_COLUMNS.includes("printed_at"), "shell keeps the print clock");

const queries = [
  { key: ["2026-10-05-evening", "tt-weather-marshfield"], data: { temp: 62 } },
  { key: ["2026-10-05-evening", "tt-wrap-bodies", "cards"], data: { bodies: "x".repeat(100) } },
  { key: ["2026-10-05-evening", "tt-board", "paths"], data: { mlb: {} } },
  { key: ["2026-10-05-evening", "tt-league-news", "paths"], data: [] },
  { key: ["2026-10-05-evening", "tt-watch", "2026-10-05"], data: [] },
];

assert(queryDeskName(queries[0]!) === "tt-weather-marshfield", "reads the desk name");
assert(isHeavyDesk("tt-wrap-bodies") && isHeavyDesk("tt-board") && isHeavyDesk("tt-league-news"), "the three heavy desks");
assert(!isHeavyDesk("tt-weather-marshfield") && !isHeavyDesk("tt-watch"), "weather and watch stay on the first paint");

const { light, heavy } = splitQueries(queries);
assert(
  light.map((q) => queryDeskName(q)).join(",") === "tt-weather-marshfield,tt-watch",
  "light desks are weather and watch",
);
assert(
  heavy.map((q) => queryDeskName(q)).sort().join(",") === [...HEAVY_DESK_NAMES].sort().join(","),
  "heavy desks are wrap bodies, board, league news",
);

const merged = mergeQueries(light, heavy);
assert(merged.length === 5, "merge keeps every desk");
assert(
  mergeQueries(light, [{ key: ["2026-10-05-evening", "tt-watch", "2026-10-05"], data: [1] }])[1]?.data,
  "later write wins for the same key",
);

assert(heavyDesksForPage({ kind: "favorites-front" }).includes("tt-board"), "A1 asks for the board so the lead recap can print");
assert(heavyDesksForPage({ kind: "sport-front" }).includes("tt-board"), "a sport front asks for the board");
assert(heavyDesksForPage({ kind: "favorites-continue" }).includes("tt-board"), "a jump folio may need a recap box");
assert(heavyDesksForReader().includes("tt-wrap-bodies"), "the reader asks for wrap bodies");
assert(pickQueriesNamed(queries, ["tt-board"]).length === 1, "pick one named desk");

console.log("newspaper-payload ok");
