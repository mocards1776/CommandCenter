/**
 * Run with: node --experimental-strip-types src/lib/newspaper-fit.test.ts
 * from CommandCenter-main/.
 */
import {
  HARD_PAGE_H,
  SOFT_PAGE_H,
  hideCssForPlan,
  fitMeasureNeeded,
  pageFit,
  plansEqual,
  scaledFitBox,
  sheetLayoutHeight,
  sheetNeedsTransformFit,
  unzoomedPx,
} from "./newspaper-fit.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

assert(SOFT_PAGE_H === 1480, "soft pack target stays 1480");
assert(HARD_PAGE_H === 1650, "hard pack cap stays 1650");
assert(pageFit(768, 1032) === 768 / 1032, "iPad 768 fit is width-only min(1, w/1032)");
assert(pageFit(1032, 1032) === 1, "13-inch portrait is true size");
assert(!fitMeasureNeeded(1008, 1008, 768 / 1032, 768 / 1032), "unchanged iPad sheet height does not clear transform");
assert(!fitMeasureNeeded(1008, 40, 1, 1), "an empty remount must not lock the wrapper shut");
assert(fitMeasureNeeded(1008, 1400, 1, 1), "a taller sheet still remeasures");
assert(fitMeasureNeeded(0, 1008, -1, 1), "the first real height is measured");
assert(pageFit(1400, 1032) === 1, "wider screens do not upscale");
assert(sheetLayoutHeight({ offsetHeight: 800, scrollHeight: 2929 }) === 2929, "wrapper tracks the full sheet, not a stale clip");
assert(scaledFitBox(1032, 1600, 768 / 1032).width === 768, "transform wrapper width is the visual sheet");
assert(
  Math.abs(scaledFitBox(1032, 1600, 768 / 1032).height - 1600 * (768 / 1032)) < 0.01,
  "transform wrapper height is sheet H × fit — no extra white scroll",
);
assert(
  sheetNeedsTransformFit("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)", { maxTouchPoints: 5, platform: "iPad" }),
  "iPad uses the height-corrected scale path",
);
assert(
  sheetNeedsTransformFit("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", {
    maxTouchPoints: 5,
    platform: "MacIntel",
  }),
  "iPadOS desktop UA uses the scale path",
);
assert(
  !sheetNeedsTransformFit("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120", {
    maxTouchPoints: 0,
    platform: "Win32",
    zoomShrinksLayout: true,
    supportsZoom: true,
  }),
  "desktop Chrome keeps CSS zoom",
);
assert(
  sheetNeedsTransformFit("Mozilla/5.0", { zoomShrinksLayout: false }),
  "a zoom that does not shrink layout uses transform",
);
assert(unzoomedPx(768, 768 / 1032) - 1032 < 0.5, "iPad width-only zoom maps back to 1032 sheet px");
assert(unzoomedPx(1032, 1) === 1032, "desktop fit=1 is already sheet px");
assert(Math.abs(unzoomedPx(1480 * 0.744186, 0.744186) - 1480) < 0.5, "soft target is the same at iPad zoom");
assert(Math.abs(unzoomedPx(1480, 1) - 1480) < 0.5, "soft target is the same at desktop zoom");
assert(
  plansEqual(
    { hide: [":nth-child(2)", ":nth-child(1)"], cuts: { a: "x" } },
    { hide: [":nth-child(1)", ":nth-child(2)"], cuts: { a: "x" } },
  ),
  "fit plans compare hide order-insensitively",
);
assert(
  !plansEqual({ hide: ["f1"], cuts: {} }, { hide: ["f1", "f2"], cuts: {} }),
  "fit plans differ when hide lists differ",
);
assert(
  hideCssForPlan("s1", { hide: [":nth-child(3)"], cuts: {} }) ===
    `[data-tt-sheet="s1"] > :nth-child(3){display:none!important}`,
  "hide CSS targets the sheet by nth-child path, not by mutating live nodes",
);

console.log("newspaper-fit ok");
