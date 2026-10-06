/**
 * Run with: node --experimental-strip-types src/lib/newspaper-page.test.ts
 * from CommandCenter-main/.
 */
import {
  PAGE_BODY_PX,
  PAGE_CANVAS,
  PAGE_CHROME_PX,
  PAGE_FOOT_SLACK_PX,
  PAGE_INTERNAL_GAP_PX,
  PAGE_SOFT_CAP_H,
  assertPagesFilled,
  assertPagesFitCanvas,
  estimateA1Height,
  estimateInsideRecapHeight,
  estimateMatchupScheduleHeight,
  estimateScheduleHeight,
  estimateScoreGridHeight,
  estimateSportFrontHeight,
  frontPageLeftover,
  pageExceedsCanvas,
  pageExceedsSoftCap,
  pageHasBlankBand,
  planSchedulePages,
} from "./newspaper-page.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

assert(PAGE_CANVAS.width === 1040 && PAGE_CANVAS.height === 1480, "locked canvas is 1040×1480");
assert(PAGE_SOFT_CAP_H === 1650, "soft cap is 1650 so a wrap is not cut mid-thought");
assert(PAGE_CANVAS.height / PAGE_CANVAS.width > 1.4 && PAGE_CANVAS.height / PAGE_CANVAS.width < 1.45, "page ratio ~1.42");
assert(!pageExceedsCanvas(PAGE_CANVAS.height), "the canvas itself fits");
assert(pageExceedsCanvas(PAGE_CANVAS.height + 1), "one pixel over the target is a compose miss");
assert(!pageExceedsSoftCap(1600), "1600 is a modest grow past 1480");
assert(pageExceedsSoftCap(PAGE_SOFT_CAP_H + 1), "anything past 1650 must start a new folio");
assert(
  frontPageLeftover([{ id: "lead" }], [
    { id: "lead", favoriteKey: "cfb-mizzou" },
    { id: "a", favoriteKey: "cfb-mizzou" },
    { id: "b", favoriteKey: "eng-wrexham" },
    { id: "c", favoriteKey: "mlb-stl" },
    { id: "wire", favoriteKey: "" },
  ]).map((c) => c.id).join() === "a,b",
  "front leftover is unused favorite wraps, max 2",
);

const week5 = [
  { day: "2026-10-08", id: "tnf" },
  ...Array.from({ length: 13 }, (_, i) => ({ day: "2026-10-11", id: `sun-${i}` })),
  { day: "2026-10-12", id: "mnf" },
];
assert(week5.length === 15, "TNF + 13 Sunday + MNF");
const weekH = estimateScheduleHeight(week5);
assert(weekH <= PAGE_BODY_PX, `Week 5 compact slate fits the body (${weekH} <= ${PAGE_BODY_PX})`);
assert(!pageExceedsCanvas(188 + weekH), "Week 5 folio stays on the canvas");
const weekPages = planSchedulePages(week5);
assert(weekPages.length === 1 && weekPages[0]!.length === 15, "Week 5 stays on one folio");

const packed = planSchedulePages(
  Array.from({ length: 96 }, (_, i) => ({
    day: `2026-10-${String(8 + Math.floor(i / 12)).padStart(2, "0")}`,
    id: `g-${i}`,
  })),
);
assert(packed.length >= 2, "an oversized slate splits onto a second folio");
assert(
  packed.every((page) => page.length && estimateScheduleHeight(page) <= PAGE_BODY_PX),
  "every split folio still fits",
);
assert(
  packed.flat().map((g) => g.id).join() ===
    Array.from({ length: 96 }, (_, i) => `g-${i}`).join(),
  "split pages stay chronological",
);

const frontH = estimateSportFrontHeight({ railGames: 15, extraStories: 2 });
assert(frontH <= PAGE_BODY_PX, `NFL1 with a 15-game rail fits (${frontH} <= ${PAGE_BODY_PX})`);
assert(!pageExceedsCanvas(PAGE_CHROME_PX + frontH), "NFL1 folio stays on the canvas");
const dumpedFront = PAGE_CHROME_PX + estimateSportFrontHeight({ railGames: 15, extraStories: 18 });
assert(pageExceedsSoftCap(dumpedFront), "dumping the section's leftover stories overflows 1650 and must paginate");

const a1H = estimateA1Height({ railItems: 2, hasLeadPhoto: true, fillRows: 3 });
assert(a1H <= PAGE_BODY_PX, `A1 with photo, two rail wraps, and a kickoff fill fits (${a1H} <= ${PAGE_BODY_PX})`);

const a4H = estimateInsideRecapHeight({ grafs: 6, condensedBox: false });
assert(a4H <= PAGE_BODY_PX, `A4 recap without a full box fits (${a4H} <= ${PAGE_BODY_PX})`);

const nfl2H = estimateScoreGridHeight(12, 3);
assert(nfl2H <= PAGE_BODY_PX, `NFL2 12-game board fits (${nfl2H} <= ${PAGE_BODY_PX})`);

assert(
  pageExceedsCanvas(PAGE_CHROME_PX + estimateMatchupScheduleHeight(week5)),
  "the old 2-column matchup cards would overflow — compact rows are required",
);

const composed = [
  { folio: "A1", heightPx: PAGE_CHROME_PX + a1H },
  { folio: "A4", heightPx: PAGE_CHROME_PX + a4H },
  { folio: "NFL1", heightPx: PAGE_CHROME_PX + frontH },
  { folio: "NFL2", heightPx: PAGE_CHROME_PX + nfl2H },
  { folio: "NFL7", heightPx: PAGE_CHROME_PX + weekH },
];
assertPagesFitCanvas(composed);

try {
  assertPagesFitCanvas([{ folio: "NFL7", heightPx: PAGE_CANVAS.height + 40 }]);
  throw new Error("FAIL: overflow guard should throw");
} catch (err) {
  assert(err instanceof Error && /NFL7/.test(err.message), "overflow guard names the tall folio");
}

assert(!pageHasBlankBand({ contentBottomPx: PAGE_CANVAS.height - 40 }), "40px of foot slack is packed");
assert(
  pageHasBlankBand({ contentBottomPx: PAGE_CANVAS.height - (PAGE_FOOT_SLACK_PX + 1) }),
  "more than 60px above the footer is a blank band",
);
assert(
  pageHasBlankBand({ contentBottomPx: PAGE_CANVAS.height, internalGapsPx: [PAGE_INTERNAL_GAP_PX + 1] }),
  "an internal hole over 80px is a blank band",
);
assertPagesFilled([
  { folio: "A1", contentBottomPx: PAGE_CANVAS.height - 20 },
  { folio: "NFL1", contentBottomPx: PAGE_CANVAS.height - 10, internalGapsPx: [24] },
  { folio: "NFL7", contentBottomPx: PAGE_CANVAS.height - 8, internalGapsPx: [12, 16] },
]);
try {
  assertPagesFilled([{ folio: "NFL7", contentBottomPx: PAGE_CANVAS.height - 200 }]);
  throw new Error("FAIL: blank-space guard should throw");
} catch (err) {
  assert(err instanceof Error && /NFL7/.test(err.message), "blank-space guard names the sparse folio");
}

console.log("newspaper-page ok");
