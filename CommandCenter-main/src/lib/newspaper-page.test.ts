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
  PAGE_TARGET_H,
  assertPagesFilled,
  assertPagesFitCanvas,
  estimateA1Height,
  estimateInsideRecapHeight,
  estimateMatchupScheduleHeight,
  estimateNewsStoryHeight,
  estimateScheduleHeight,
  estimateScoreGridHeight,
  estimateSportFrontHeight,
  packSportNewsPages,
  pageExceedsCanvas,
  pageHasBlankBand,
  planRecapsScorePages,
  planSchedulePages,
} from "./newspaper-page.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

assert(PAGE_CANVAS.width === 1040 && PAGE_CANVAS.height === 1480, "compose target is 1040×1480");
assert(PAGE_TARGET_H === 1480 && PAGE_SOFT_CAP_H === 1650, "soft cap is 1650");
assert(PAGE_CANVAS.height / PAGE_CANVAS.width > 1.4 && PAGE_CANVAS.height / PAGE_CANVAS.width < 1.45, "page ratio ~1.42");
assert(!pageExceedsCanvas(PAGE_TARGET_H), "the target itself fits");
assert(!pageExceedsCanvas(PAGE_SOFT_CAP_H), "the soft cap itself fits");
assert(pageExceedsCanvas(PAGE_SOFT_CAP_H + 1), "one pixel over the cap is a miss");

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
  assertPagesFitCanvas([{ folio: "NFL7", heightPx: PAGE_SOFT_CAP_H + 40 }]);
  throw new Error("FAIL: overflow guard should throw");
} catch (err) {
  assert(err instanceof Error && /NFL7/.test(err.message), "overflow guard names the tall folio");
}

const nflDesk = planRecapsScorePages(9);
assert(nflDesk.length === 1 && nflDesk[0]!.count === 9 && nflDesk[0]!.wraps, "a 9-final NFL board stays on the recaps desk");
const nflWeek = planRecapsScorePages(16);
assert(nflWeek.length >= 2 && nflWeek[0]!.count < 16, "a 16-final NFL week flows leftover boxes to the next folio");
assert(nflWeek.reduce((n, p) => n + p.count, 0) === 16, "split NFL recaps pages keep every final");
const cfbDesk = planRecapsScorePages(50);
assert(cfbDesk.length >= 2, "a 50-game CFB board flows to another recaps folio");
assert(cfbDesk[0]!.wraps && cfbDesk.slice(1).every((p) => !p.wraps), "only the first recaps folio keeps the wraps");
assert(
  cfbDesk.reduce((n, p) => n + p.count, 0) === 50,
  "split recaps pages keep every final",
);

const shortNews = { body: "A short league note. ".repeat(8), photo: null };
const longNews = { body: "A feature that runs long. ".repeat(220), photo: "https://example.com/p.jpg" };
assert(packSportNewsPages([shortNews, shortNews]).length === 1, "two short news items share a folio");
assert(packSportNewsPages([longNews, longNews]).length === 2, "two long features each get a folio");
assert(estimateNewsStoryHeight(longNews) > estimateNewsStoryHeight(shortNews), "a photo feature estimates taller");

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
