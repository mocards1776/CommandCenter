// @ts-nocheck — compose.bundle.js is generated ESM with no declarations.
/**
 * Stage-14 extract-file must take one small slice per hop.
 * Imports the rebuilt compose.bundle.js (source uses extensionless paths).
 * Run with: node --experimental-strip-types src/lib/newspaper-press-extract-file.test.ts
 */
const env = globalThis as typeof globalThis & { __TT_ENV?: { url: string; key: string } };
env.__TT_ENV = { url: "http://localhost", key: "anon" };

const { EXTRACT_FILE_PER_HOP, pressStep } = await import(
  "../../supabase/functions/newspaper-press/compose.bundle.js"
);

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function card(i: number) {
  return {
    id: `news-file-${i}`,
    headline: `Desk brief ${i} on the waiver wire`,
    favoriteKey: "",
    teamName: "",
    teamHref: "/",
    sportLabel: "NFL",
    leaguePath: "football/nfl",
    dek: "A short dek that needs a clean pass.",
    body: "The club stayed in the mix after a late score. ".repeat(8),
    scoreLine: null,
    when: null,
    won: null,
    gameHref: null,
    wrapHref: null,
    feedUrl: null,
    gameId: null,
    stats: [],
    leaders: [],
    teamStats: [],
    division: [],
  };
}

assert(EXTRACT_FILE_PER_HOP >= 5 && EXTRACT_FILE_PER_HOP <= 8, "extract-file batch stays in the 5–8 range");

const raw = Array.from({ length: 40 }, (_, i) => card(i));
const step = await pressStep(
  {
    pressId: "2026-10-07-morning",
    day: "2026-10-07",
    favs: [],
    layout: { order: [], hidden: [], pinnedPlayers: [] },
    userId: null,
  },
  { stage: 14, raw, extractUrls: [], extracts: {}, extractFileCursor: 0, fresh: [] },
);

assert(!step.done, "extract-file of 40 cards is not one hop");
assert(step.bag.stage === 14, "stays on stage 14 until the queue is empty");
assert(step.bag.extractFileCursor === EXTRACT_FILE_PER_HOP, `one hop advances by ${EXTRACT_FILE_PER_HOP}`);
assert(
  step.bag.fresh.length === EXTRACT_FILE_PER_HOP,
  "fresh only grows by the extract-file slice",
);

const last = await pressStep(
  {
    pressId: "2026-10-07-morning",
    day: "2026-10-07",
    favs: [],
    layout: { order: [], hidden: [], pinnedPlayers: [] },
    userId: null,
  },
  { stage: 14, raw: raw.slice(0, 4), extractUrls: [], extracts: {}, extractFileCursor: 0, fresh: [] },
);
assert(!last.done && last.bag.stage === 15, "a short queue finishes extract-file and yields stage 15");
assert(last.bag.extractFileCursor == null, "extract-file cursors drop at stage 15");

console.log("newspaper-press-extract-file ok");
