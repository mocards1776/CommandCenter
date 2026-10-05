/**
 * Run with: node --experimental-strip-types src/lib/newspaper-document.test.ts
 * from CommandCenter-main/.
 */
import { queryNamed, REVEAL_CAP_MS } from "./newspaper-document.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

assert(REVEAL_CAP_MS >= 6_000 && REVEAL_CAP_MS <= 8_000, "reveal cap is 6–8 seconds");
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
