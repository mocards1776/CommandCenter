/**
 * Run with: node --experimental-strip-types src/lib/newspaper-fit.test.ts
 * from CommandCenter-main/.
 */
import { HARD_PAGE_H, SOFT_PAGE_H, unzoomedPx } from "./newspaper-fit.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

assert(SOFT_PAGE_H === 1480, "soft pack target stays 1480");
assert(HARD_PAGE_H === 1650, "hard pack cap stays 1650");
assert(unzoomedPx(768, 768 / 1032) - 1032 < 0.5, "iPad width-only zoom maps back to 1032 sheet px");
assert(unzoomedPx(1032, 1) === 1032, "desktop fit=1 is already sheet px");
assert(Math.abs(unzoomedPx(1480 * 0.744186, 0.744186) - 1480) < 0.5, "soft target is the same at iPad zoom");
assert(Math.abs(unzoomedPx(1480, 1) - 1480) < 0.5, "soft target is the same at desktop zoom");

console.log("newspaper-fit ok");
