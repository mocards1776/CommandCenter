/**
 * Run with: node --experimental-strip-types src/lib/newspaper-page-canvas.test.ts
 * from CommandCenter-main/.
 */
import {
  PAGE_CANVAS_H,
  PAGE_CANVAS_W,
  chooseOverflowCuts,
  measureSheetOverflow,
} from "./newspaper-page-canvas.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

assert(PAGE_CANVAS_W === 1040 && PAGE_CANVAS_H === 1480, "Josh's sheet is 1040×1480");
assert(measureSheetOverflow(1480) === 0, "a page that matches the canvas does not overflow");
assert(measureSheetOverflow(1480.4) === 1, "a hair over the canvas counts");
assert(measureSheetOverflow(1600) === 120, "taller copy reports the extra pixels");
assert(measureSheetOverflow(1200) === 0, "a short page is not overflow");

const cuts = chooseOverflowCuts(
  [
    { id: "lead", priority: 1, height: 400 },
    { id: "game-late", priority: 80, height: 40 },
    { id: "game-mid", priority: 50, height: 40 },
    { id: "game-early", priority: 20, height: 40 },
  ],
  70,
);
assert(cuts[0] === "game-late", `lowest-priority game drops first: ${cuts.join(",")}`);
assert(cuts.includes("game-mid") && !cuts.includes("lead"), "lead stays; later games go");
assert(chooseOverflowCuts([{ id: "a", priority: 9, height: 10 }], 0).length === 0, "no overflow, no cuts");

console.log("newspaper-page-canvas.test.ts: ok");
