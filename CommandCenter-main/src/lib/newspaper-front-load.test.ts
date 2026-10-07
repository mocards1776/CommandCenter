/**
 * Run with: node --experimental-strip-types src/lib/newspaper-front-load.test.ts
 * from CommandCenter-main/.
 */
import {
  FRONT_STORY_CAP,
  consumeIssueShellStream,
  frontPrefixLength,
  frontPrefixReady,
  scanJsonValue,
} from "./newspaper-front-load.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function story(id: string, editorFront?: number) {
  return {
    id,
    headline: `Copy for ${id} with a "quote"`,
    ...(editorFront != null ? { editorFront } : {}),
  };
}

const liveShaped = [
  story("wire-0"),
  story("second", 1),
  ...Array.from({ length: 24 }, (_, i) => story(`pad-${i}`)),
  story("lead", 0),
  ...Array.from({ length: 11 }, (_, i) => story(`mid-${i}`)),
  story("third", 2),
  ...Array.from({ length: 80 }, (_, i) => story(`tail-${i}`)),
];

const prefix = frontPrefixLength(liveShaped);
assert(prefix === 39, `A1 prefix ends on the third slot, got ${prefix}`);
assert(frontPrefixReady(liveShaped.slice(0, prefix)), "the prefix itself is ready to paint");
assert(!frontPrefixReady(liveShaped), "the full folio is not treated as the prefix");
assert(!frontPrefixReady(liveShaped.slice(0, 10)), "ten unstamped stories do not paint yet");
assert(frontPrefixLength(liveShaped.slice(0, 10)) === 10, "a short file stays whole");

const cap = Array.from({ length: FRONT_STORY_CAP + 5 }, (_, i) => story(`c-${i}`));
assert(frontPrefixLength(cap) === FRONT_STORY_CAP, "unstamped copy paints at the cap");

assert(scanJsonValue('{"a":1}', 0) === '{"a":1}'.length, "scans one object");
assert(scanJsonValue('{"a":"x\\"y"} ,', 0) === '{"a":"x\\"y"}'.length, "scans a string with an escaped quote");

const storiesJson = JSON.stringify(liveShaped);
const prefixInner = JSON.stringify(liveShaped.slice(0, prefix)).slice(1, -1);
const full = `{"version":1,"status":"ready","stories":${storiesJson},"printed_at":"2026-10-07T11:46:25.886Z"}`;
const arrayStart = full.indexOf("[");
const cut = arrayStart + 1 + prefixInner.length;
const chunks = [full.slice(0, cut), full.slice(cut)];
assert(chunks[1]?.startsWith(","), "the rest of the folio is a later chunk");

let pullsBeforeFront = 0;
let frontCount = 0;
async function* paced() {
  for (const chunk of chunks) {
    if (frontCount === 0) pullsBeforeFront++;
    yield chunk;
  }
}

const seen: unknown[][] = [];
const shell = await consumeIssueShellStream(paced(), async (stories) => {
  frontCount++;
  seen.push(stories);
  assert(pullsBeforeFront < chunks.length, "front paints before the last chunk is required");
});

assert(frontCount === 1, "onFront runs once");
assert(seen[0]?.length === prefix, "onFront receives the A1 prefix");
assert(shell?.stories.length === liveShaped.length, "the returned issue still has the whole folio");
assert(shell?.printedAt === "2026-10-07T11:46:25.886Z", "printed_at survives the stream");
assert(shell?.status === "ready" && shell.version === 1, "ready version 1");

const held = await consumeIssueShellStream(
  (async function* () {
    yield JSON.stringify({ version: 1, status: "printing", stories: [story("a", 0)], printed_at: "t" });
  })(),
  () => {
    throw new Error("a printing row must not paint");
  },
);
assert(held == null, "printing status is not an openable shell");

console.log("newspaper-front-load ok");
