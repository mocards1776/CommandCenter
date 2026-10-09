/**
 * Run with: node --experimental-strip-types src/lib/newspaper-document.test.ts
 * from CommandCenter-main/.
 */
import {
  COMPANION_WAIT_MS,
  ISSUE_POLL_MS,
  queryNamed,
  REVEAL_CAP_MS,
  sleep,
  withDeadline,
} from "./newspaper-document.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

assert(REVEAL_CAP_MS > 0 && REVEAL_CAP_MS <= 2_000, "the cover never waits on art for more than 2 seconds");
assert(COMPANION_WAIT_MS + REVEAL_CAP_MS < 5_000, "a slow companion plus the reveal cap stays under 5 seconds");
assert(ISSUE_POLL_MS >= 60_000 && ISSUE_POLL_MS <= 5 * 60_000, "visible poll is every few minutes");
assert((await withDeadline(Promise.resolve("ready"), 50, "cap")) === "ready", "withDeadline keeps a settled value");
assert((await withDeadline(sleep(80).then(() => "late"), 10, "cap")) === "cap", "withDeadline yields the fallback");
assert(
  queryNamed<{ temp: number }>(
    [{ key: ["2026-10-05-morning", "tt-weather-marshfield"], data: { temp: 62 } }],
    "tt-weather-marshfield",
  )?.temp === 62,
  "reads a named desk from the filed queries",
);
assert(
  queryNamed([{ key: ["2026-10-05-morning", "tt-watch"], data: [] }], "tt-weather-marshfield") === undefined,
  "missing desk is undefined, not today's live weather",
);

console.log("newspaper-document ok");
