/**
 * Run with: node --experimental-strip-types src/lib/newspaper-press-bag.test.ts
 */
import {
  checkpointBag,
  deadBagKeys,
  DROP_AFTER_BOARD_DESKS,
  DROP_AFTER_FILE_DESKS,
  DROP_AFTER_GATHER,
  dropBagKeys,
  hopSignature,
} from "./newspaper-press-bag.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const fat = {
  stage: 14,
  queries: [{ key: ["2026-10-05-evening", "tt-wrap-bodies"], data: { body: "x".repeat(100) } }],
  board: { mlb: { results: [] } },
  leagueNews: [{ id: "n1" }],
  teamCards: [{ id: "c1" }],
  details: [{ id: "d1" }],
  wire: { games: [] },
  weather: { temp: 62 },
};

const slim = checkpointBag(fat);
assert(slim.stage === 14, "keeps the stage");
assert(!("queries" in slim), "drops already-flushed desks from the bag");
assert(!slim.details && !slim.wire && !slim.teamCards, "stage 14 drops gather sources already filed");
assert(JSON.stringify(slim).length < JSON.stringify(fat).length, "checkpoint is smaller than the fat bag");

assert(deadBagKeys(10).includes("wraps"), "file desks stay out of stage 10");
assert(!deadBagKeys(10).includes("details"), "stage 10 still gathers from details");
assert(deadBagKeys(11).includes("details") && deadBagKeys(11).includes("news"), "stage 11 has already merged club copy");
assert(deadBagKeys(12).includes("teamCards") && deadBagKeys(12).includes("leagueNews"), "stage 12 drops gather sources after they are filed");
assert(deadBagKeys(12).includes("pool") && deadBagKeys(12).includes("mergeStep"), "stage 12 drops merge cursors");
assert(!deadBagKeys(11).includes("teamCards"), "stage 11 still holds team cards until the merge files them");
assert(DROP_AFTER_GATHER.includes("snaps"), "snaps leave after they are filed");
assert(
  hopSignature({ stage: 11, mergeStep: "related-wraps", wrapCursor: 40 }).startsWith("11::related-wraps:40:"),
  "hop signature names the merge cursor",
);
assert(
  hopSignature({ stage: 11, mergeStep: "related-wraps", wrapCursor: 40 }) !==
    hopSignature({ stage: 11, mergeStep: "tag", tagCursor: 0 }),
  "different merge cursors get different signatures",
);
assert(hopSignature(null) === "0", "empty bag is stage 0");

const afterFile = dropBagKeys({ ...fat }, DROP_AFTER_FILE_DESKS);
assert(afterFile.weather === undefined && afterFile.teamCards, "file-desk drop keeps story sources");

const afterBoard = dropBagKeys({ ...fat, enriched: [{ id: "e" }] }, DROP_AFTER_BOARD_DESKS);
assert(afterBoard.board === undefined && afterBoard.enriched === undefined, "board-desk drop releases the scoreboard");
assert(afterBoard.leagueNews && afterBoard.teamCards, "board-desk drop keeps gatherStories inputs");

const afterGather = dropBagKeys({ ...fat, teamCards: [{ id: "c1" }] }, DROP_AFTER_GATHER);
assert(afterGather.teamCards === undefined && afterGather.leagueNews === undefined, "gather drop releases story sources");
assert(afterGather.stage === 14, "gather drop keeps the stage");

console.log("newspaper-press-bag ok");
