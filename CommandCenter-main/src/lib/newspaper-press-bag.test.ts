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
assert(DROP_AFTER_GATHER.includes("snaps"), "snaps leave after they are filed");

const afterFile = dropBagKeys({ ...fat }, DROP_AFTER_FILE_DESKS);
assert(afterFile.weather === undefined && afterFile.teamCards, "file-desk drop keeps story sources");

const afterBoard = dropBagKeys({ ...fat, enriched: [{ id: "e" }] }, DROP_AFTER_BOARD_DESKS);
assert(afterBoard.board === undefined && afterBoard.enriched === undefined, "board-desk drop releases the scoreboard");
assert(afterBoard.leagueNews && afterBoard.teamCards, "board-desk drop keeps gatherStories inputs");

const afterGather = dropBagKeys({ ...fat, teamCards: [{ id: "c1" }] }, DROP_AFTER_GATHER);
assert(afterGather.teamCards === undefined && afterGather.leagueNews === undefined, "gather drop releases story sources");
assert(afterGather.stage === 14, "gather drop keeps the stage");

console.log("newspaper-press-bag ok");
