/**
 * Run with: node --experimental-strip-types src/lib/field-play-dots.test.ts
 * from CommandCenter-main/.
 */
import { layoutDrivePlayDots } from "./field-play-dots.ts";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

const same = layoutDrivePlayDots([40, 40, 40]);
assert(same.length === 3, "each snap is a dot");
assert(same.every((dot) => dot.pct === 60), "40 yards from home is 60% across the field");
assert(new Set(same.map((dot) => dot.y)).size === 3, "same-yard snaps stack");
assert(same.every((dot) => dot.x === 0), "three snaps fit in one column");

const apart = layoutDrivePlayDots([20, 40]);
assert(apart[0]?.y === 0 && apart[1]?.y === 0, "plays a few yards apart stay on the midline");
assert(apart[0]?.pct !== apart[1]?.pct, "separated plays keep their own yard");

const stuffed = layoutDrivePlayDots([30, 30, 30, 30, 30, 30]);
assert(new Set(stuffed.map((dot) => dot.x)).size === 2, "a sixth snap opens a second column");
assert(stuffed.filter((dot) => dot.x < 0).length === 5, "the first column holds five");

const skipped = layoutDrivePlayDots([Number.NaN, 25]);
assert(skipped.length === 1 && skipped[0]?.pct === 75, "a missing yard is not plotted");

console.log("field-play-dots.test.ts ok");
