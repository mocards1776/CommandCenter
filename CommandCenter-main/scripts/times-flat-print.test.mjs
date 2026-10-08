/**
 * Run with: node CommandCenter-main/scripts/times-flat-print.test.mjs
 * The stub gate: a ~200 CSS px shell is not a page, a real short page is.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  A1_MIN_FIT,
  clipSize,
  continuationName,
  degradedWarning,
  findSeam,
  heightLine,
  MIN_FIT,
  NEAR_EMPTY_CSS,
  pageFit,
  planSheet,
  publishVerdict,
  renderSheet,
  judgePage,
  judgeSheet,
  layoutSheet,
  MIN_CSS_HEIGHT,
  PAGE_DEV_H,
  PAGE_DEV_W,
  paintFlatPage,
  remapHotspots,
  salvageSheet,
  buildFlatManifest,
  webpSize,
} from "./times-flat-print.mjs";

const parked = clipSize({ x: 2064, y: 61, w: 1032, h: 1406, viewW: 1032, viewH: 8000 });
assert.ok(parked.width < 40, "a folio to the right of the pager has no clip width");
assert.equal(Math.round(parked.height), 1406, "that same folio still has its full height");
const shown = clipSize({ x: 0, y: 61, w: 1032, h: 1406, viewW: 1032, viewH: 8000 });
assert.ok(shown.width >= 1032);
assert.equal(Math.round(shown.height), 1406);

const short = judgeSheet({ contentHeight: 208, capturedHeight: 208, blankRatio: 0.24 });
assert.equal(short.ok, false);
assert.match(short.reason, /short 208/);

const real = judgeSheet({ contentHeight: 615, capturedHeight: 615, blankRatio: 0.64 });
assert.equal(real.ok, true);

const clipped = judgeSheet({ contentHeight: 3641, capturedHeight: 1548, blankRatio: 0.2 });
assert.equal(clipped.ok, false);
assert.match(clipped.reason, /clipped 1548<3641/);

const past = judgeSheet({ contentHeight: 1800, capturedHeight: 1800, pastBottom: true, blankRatio: 0.2 });
assert.equal(past.ok, false);
assert.match(past.reason, /past bottom/);

const blank = judgeSheet({ contentHeight: 1652, capturedHeight: 1652, blankRatio: 0.95 });
assert.equal(blank.ok, false);
assert.match(blank.reason, /blank/);

assert.equal(MIN_CSS_HEIGHT, 480);
assert.equal(judgeSheet({ contentHeight: 479, capturedHeight: 479, blankRatio: 0.1 }).ok, false);
assert.equal(judgeSheet({ contentHeight: 480, capturedHeight: 480, blankRatio: 0.9 }).ok, true);

const screen = { width: PAGE_DEV_W, height: PAGE_DEV_H, blankRatio: 0.2 };
assert.equal(judgePage(screen).ok, true);
assert.equal(PAGE_DEV_W, 2064);
assert.equal(PAGE_DEV_H, 2752);
assert.equal(judgePage({ width: 2064, height: 3300, blankRatio: 0.2 }).ok, false);
assert.equal(judgePage({ ...screen, pastEdge: true }).ok, false);

const buf = Buffer.alloc(32);
buf.write("RIFF", 0);
buf.writeUInt32LE(100, 4);
buf.write("WEBP", 8);
buf.write("VP8L", 12);
buf.writeUInt32LE(50, 16);
buf[20] = 0x2f;
buf[21] = 15;
buf[22] = 136;
buf[23] = 57;
buf[24] = 3;
assert.deepEqual(webpSize(buf), { width: 2064, height: 3303 });
assert.equal(webpSize(Buffer.from("nope")), null);

function rgba(width, height, paint) {
  const buf = Buffer.alloc(width * height * 4, 255);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = paint(x, y);
      const o = (y * width + x) * 4;
      buf[o] = r;
      buf[o + 1] = g;
      buf[o + 2] = b;
    }
  }
  return buf;
}

const varied = (x, y) => [(x * 17 + y * 3) % 180, (x * 9 + 40) % 200, (y * 13 + x) % 160];
const seamed = rgba(64, 24, (x, y) => {
  if (y === 10) return [5, 11, 24];
  if (y === 11) return [8, 17, 36];
  return varied(x, y);
});
const seam = findSeam(seamed, 64, 24);
assert.deepEqual(seam, { y: 10, rows: 2 });
assert.equal(judgePage({ width: PAGE_DEV_W, height: PAGE_DEV_H, blankRatio: 0.2, seam }).ok, false);
assert.match(judgePage({ width: PAGE_DEV_W, height: PAGE_DEV_H, blankRatio: 0.2, seam }).reason, /seam y 10/);

const partial = rgba(100, 24, (x, y) => {
  if (y === 10) return [5, 11, 24];
  if (y === 11) return [8, 17, 36];
  if (x % 5 < 2) return [6, 12, 22];
  return [180, 160, 140];
});
assert.deepEqual(findSeam(partial, 100, 24), { y: 10, rows: 2 }, "a photo that is dark in part of the row still has a seam");

assert.equal(findSeam(rgba(64, 24, varied), 64, 24), null);
assert.equal(
  findSeam(rgba(64, 24, (x, y) => (y < 2 ? [5, 11, 24] : varied(x, y))), 64, 24),
  null,
  "the page's own top edge is not an interior seam",
);
assert.equal(
  findSeam(rgba(64, 24, (x, y) => (y >= 8 && y <= 14 ? [5, 11, 24] : varied(x, y))), 64, 24),
  null,
  "a thick dark band is a rule or a photo, not a 1px stitch",
);
assert.equal(
  findSeam(rgba(64, 24, (x, y) => (y === 10 ? (x < 8 ? [5, 11, 24] : varied(x, y)) : varied(x, y))), 64, 24),
  null,
  "a dark rule that does not span the sheet is not a seam",
);

const fits = layoutSheet(1000, [{ top: 20, bottom: 800 }], 1376);
assert.equal(fits.ok, true);
assert.equal(fits.pages.length, 1);
assert.deepEqual(fits.pages[0].slices, [{ srcTop: 0, srcBottom: 1000 }]);

const split = layoutSheet(
  2000,
  [
    { top: 40, bottom: 700 },
    { top: 780, bottom: 1900 },
  ],
  1376,
);
assert.equal(split.ok, true);
assert.equal(split.pages.length, 2);
assert.ok(split.pages[0].slices.at(-1).srcBottom <= 780.5, "the first page stops before the story that does not fit");
assert.ok(split.pages[1].slices[0].srcTop >= 700, "the second page starts at the next piece");

const lines = [];
for (let top = 40; top < 3000; top += 20) lines.push({ top, bottom: top + 18 });
const story = layoutSheet(3000, [{ top: 40, bottom: 3000, atoms: lines }], 1376);
assert.equal(story.ok, true);
assert.ok(story.pages.length >= 3);
for (const page of story.pages) {
  const span = page.slices.reduce((sum, slice) => sum + (slice.srcBottom - slice.srcTop), 0);
  assert.ok(span <= 1376.5, `page span ${span}`);
}
for (const line of lines) {
  const cut = story.pages.some((page) =>
    page.slices.some((slice) => slice.srcTop > line.top + 0.5 && slice.srcTop < line.bottom - 0.5),
  );
  assert.equal(cut, false, "a text line is not cut");
}

const rows = [];
for (let top = 50; top < 2400; top += 28) rows.push({ top, bottom: top + 24 });
const table = layoutSheet(2400, [{ top: 0, bottom: 2400, header: { top: 0, bottom: 40 }, atoms: rows }], 1376);
assert.equal(table.ok, true);
assert.ok(table.pages.length >= 2);
for (const page of table.pages.slice(1)) {
  assert.equal(page.slices[0].srcTop, 0);
  assert.equal(page.slices[0].srcBottom, 40);
}

const blocked = layoutSheet(2000, [{ top: 10, bottom: 2000 }], 1376);
assert.equal(blocked.ok, false);

const solid = [{ top: 0, bottom: 2000, sel: "article.tt-mo-story.xl.has-photo" }];
assert.equal(layoutSheet(2000, solid, 1376).ok, false);
const saved = salvageSheet(2000, solid, 1376);
assert.equal(saved.ok, true, saved.reason || "an unsplittable sheet still produces pages");
assert.equal(saved.pages.length, 1);
assert.equal(saved.pages[0].degraded, true);
assert.equal(saved.pages[0].fallback, "scale");
assert.equal(saved.pages[0].slices[0].srcTop, 0);
assert.equal(saved.pages[0].slices[0].srcBottom, 2000, "the whole block is scaled, not cropped");
assert.match(saved.pages[0].reason, /unsplittable at 0/);
assert.match(saved.pages[0].selector, /tt-mo-story/);
const manifest = buildFlatManifest({
  issueId: "2026-10-08-evening",
  printedAt: "2026-10-08T22:30:00.000Z",
  pages: saved.pages.map((page, index) => {
    const name = continuationName("B1", index);
    return {
      folio: name.folio,
      kind: "section",
      index,
      section: "B",
      url: `/times-flat/test/${name.file}.webp`,
      width: PAGE_DEV_W,
      height: PAGE_DEV_H,
      cssWidth: 1032,
      cssHeight: 1376,
      bytes: 10,
      hotspots: [],
      degraded: page.degraded,
      reason: page.reason,
      fallback: page.fallback,
    };
  }),
});
assert.equal(manifest.pages.length, 1, "the unsplittable sheet still writes a manifest");
assert.equal(manifest.pages[0].degraded, true);
assert.equal(manifest.pages[0].fallback, "scale");
assert.match(manifest.pages[0].reason, /article\.tt-mo-story\.xl\.has-photo/);
assert.equal(manifest.pages[0].cssWidth, 1032);
assert.equal(manifest.pages[0].cssHeight, 1376);

const nudged = salvageSheet(2000, [{ top: 10, bottom: 2000, sel: "article.blocked" }], 1376);
assert.equal(nudged.ok, true);
assert.equal(nudged.pages[0].slices.at(-1).srcBottom, 10, "a clean top still ends the page before the block");
const nudgedScale = nudged.pages.find((page) => page.fallback === "scale");
assert.equal(nudgedScale.slices[0].srcTop, 10);
assert.equal(nudgedScale.slices[0].srcBottom, 2000);
const moved = salvageSheet(
  2500,
  [
    { top: 0, bottom: 2500, atoms: [{ top: 0, bottom: 2500 }] },
    { top: 400, bottom: 2500, sel: "article.next" },
  ],
  1376,
);
assert.equal(moved.ok, true, moved.reason || "move");
assert.equal(moved.pages[0].fallback, "move");
assert.equal(moved.pages[0].degraded, true);
assert.equal(moved.pages[0].slices.at(-1).srcBottom, 400);
assert.equal(moved.pages[1].fallback, "scale");
assert.equal(moved.pages[1].degraded, true);
assert.ok(moved.pages[1].slices[0].srcBottom - moved.pages[1].slices[0].srcTop > 1376);

const cropped = salvageSheet(3000, [], 1376);
assert.equal(cropped.ok, true);
assert.equal(cropped.pages[0].fallback, "crop");
assert.equal(cropped.pages[0].slices[0].srcBottom - cropped.pages[0].slices[0].srcTop, 1376);

const srcW = 4;
const srcRows = 4000;
const src = Buffer.alloc(srcW * srcRows * 4);
for (let x = 0; x < srcW; x++) {
  src[x * 4] = 220;
  src[x * 4 + 3] = 255;
  const bottom = ((srcRows - 1) * srcW + x) * 4;
  src[bottom + 2] = 220;
  src[bottom + 3] = 255;
}
const scaled = paintFlatPage(src, srcW, srcRows, [{ srcTop: 0, srcBottom: 2000, fit: 1376 / 2000 }], 2);
assert.equal(scaled.pastEdge, false);
assert.equal(scaled.buffer.length, PAGE_DEV_W * PAGE_DEV_H * 4);
assert.equal(scaled.buffer[0], 220, "the top of the block is on the page");
const last = (PAGE_DEV_H - 1) * PAGE_DEV_W * 4;
assert.equal(scaled.buffer[last + 2], 220, "the bottom of the block is on the page");
const plain = Buffer.alloc(8 * 4);
plain[0] = 9;
plain[3] = 255;
const copied = paintFlatPage(plain, 8, 1, [{ srcTop: 0, srcBottom: 1 }], 1);
assert.equal(copied.buffer[0], 9, "a page without fit still copies one to one");

const columns = [];
for (let top = 166; top + 15 <= 1642; top += 22) {
  columns.push({ top, bottom: top + 14, left: 18, right: 490 });
  columns.push({ top: top + 1, bottom: top + 15, left: 520, right: 1000 });
}
const lead = layoutSheet(1642, [{ top: 166, bottom: 1642, sel: "article.tt-nat-story", atoms: columns }], 1376);
assert.equal(lead.ok, true, lead.reason || "a two-column lead cuts on the shared gap");
for (const line of columns) {
  const cut = lead.pages.some((page) =>
    page.slices.some((slice) => slice.srcTop > line.top + 2 && slice.srcTop < line.bottom - 2),
  );
  assert.equal(cut, false, "a column line is not cut");
}
const photo = { top: 400, bottom: 900, left: 18, right: 1000 };
const withPhoto = layoutSheet(
  1642,
  [{ top: 166, bottom: 1642, atoms: [photo, ...columns] }],
  1376,
);
assert.equal(withPhoto.ok, true, withPhoto.reason || "a lead with a wide photo still splits");
const throughPhoto = withPhoto.pages.some((page) =>
  page.slices.some((slice) => slice.srcTop > photo.top + 2 && slice.srcTop < photo.bottom - 2),
);
assert.equal(throughPhoto, false, "a wide photo is not cut");

assert.deepEqual(continuationName("A3", 0), { folio: "A3", file: "A3" });
assert.deepEqual(continuationName("A3", 1), { folio: "A3 cont.", file: "A3-2" });
assert.deepEqual(continuationName("A3", 2), { folio: "A3 cont. 2", file: "A3-3" });

const mapped = remapHotspots(
  [{ x: 0.1, y: 0.8, w: 0.2, h: 0.05, href: "/x", folio: "B1", label: "Blues" }],
  2000,
  split.pages,
);
const home = mapped.findIndex((spots) => spots.length === 1);
assert.ok(home > 0, "the hotspot moves onto the later page");
assert.ok(mapped[home][0].y < 1 && mapped[home][0].h > 0);

// ---- Salvage for every fit failure, guards, scaled hotspots ----

const covers = (pages, height) => {
  let y = 0;
  for (const page of pages) {
    for (const slice of page.slices.filter((item) => !item.header)) {
      assert.ok(Math.abs(slice.srcTop - y) <= 0.5, `rows ${y}..${slice.srcTop} are on no page`);
      y = slice.srcBottom;
    }
  }
  assert.ok(Math.abs(y - height) <= 0.5, `ends at ${y}, not ${height}`);
};

const runaway = salvageSheet(4000, [{ top: 0, bottom: 4000, sel: "article.runaway" }], 1376);
assert.equal(runaway.ok, true);
assert.ok(runaway.pages.every((page) => pageFit(page) >= MIN_FIT), "no page is scaled under the floor");
assert.ok(runaway.pages.slice(0, -1).every((page) => page.fallback === "crop"), "a block too tall to scale hard-breaks");
assert.equal(runaway.pages.at(-1).fallback, undefined, "its tail is a plain page, not scaled");
covers(runaway.pages, 4000);

const sliver = salvageSheet(
  3000,
  [
    { top: 0, bottom: 3000, atoms: [{ top: 0, bottom: 3000 }] },
    { top: 6, bottom: 3000, sel: "article.next" },
  ],
  1376,
);
assert.equal(sliver.ok, true);
assert.ok(!sliver.pages.some((page) => page.fallback === "move"), "a 6px page is not a move");
covers(sliver.pages, 3000);

const nearTop = salvageSheet(2000, [{ top: 3, bottom: 2000, sel: "article.near" }], 1376);
assert.equal(nearTop.pages[0].fallback, "scale");
assert.equal(nearTop.pages[0].slices[0].srcTop, 0, "the rows above a scaled block are kept");

const tallHeadRows = [];
for (let top = 1372; top < 4000; top += 28) tallHeadRows.push({ top, bottom: top + 24 });
const tallHead = [{ top: 0, bottom: 4000, header: { top: 0, bottom: 1370 }, atoms: tallHeadRows }];
assert.match(layoutSheet(4000, tallHead, 1376).reason, /header leaves no room/);
const noHead = salvageSheet(4000, tallHead, 1376);
assert.equal(noHead.ok, true, noHead.reason);
assert.ok(noHead.pages.some((page) => page.fallback === "no-header"));
assert.ok(noHead.pages.every((page) => page.slices.reduce((sum, s) => sum + s.srcBottom - s.srcTop, 0) <= 1376.5));

function inked(width, rows, blankFrom = Infinity) {
  const buf = Buffer.alloc(width * rows * 4);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const ink = y < blankFrom;
      buf[o] = ink ? 30 + ((x * 37 + y * 11) % 180) : 250;
      buf[o + 1] = ink ? 40 + ((x * 13 + y * 7) % 160) : 249;
      buf[o + 2] = ink ? 50 + ((y * 5) % 150) : 245;
      buf[o + 3] = 255;
    }
  }
  return buf;
}

function sheet({ content, captured = content, pieces = [], blankFrom, width = 8, ...rest }) {
  const rows = Math.round(captured * 2);
  return {
    width,
    height: rows,
    scale: 2,
    cssWidth: 1032,
    contentHeight: content,
    capturedHeight: captured,
    pieces,
    blankRatio: 0.2,
    buffer: inked(width, rows, blankFrom === undefined ? Infinity : blankFrom * 2),
    ...rest,
  };
}

assert.match(planSheet(null).reason, /no sheet/);
assert.match(planSheet({ reject: "offscreen" }).reason, /offscreen/);
assert.match(planSheet(sheet({ content: 300 })).reason, /short 300/);
assert.match(planSheet(sheet({ content: 2000, blankRatio: 0.95 })).reason, /blank/);
assert.match(planSheet(sheet({ content: 3641, captured: 300 })).reason, /clipped 300<3641/);

const clipPlan = planSheet(
  sheet({ content: 3641, captured: 1548, pieces: [{ top: 0, bottom: 700 }, { top: 720, bottom: 3641 }] }),
);
assert.equal(clipPlan.ok, true, clipPlan.reason);
assert.match(clipPlan.pages.at(-1).fallback, /clip/);
assert.match(clipPlan.pages.at(-1).reason, /clipped 1548<3641/);
covers(clipPlan.pages, 1548);

const wide = planSheet(
  sheet({
    content: 2400,
    pieces: [{ top: 0, bottom: 1200 }, { top: 1200, bottom: 2400 }],
    pastRight: true,
    pastBoxes: [{ sel: "table.box", top: 1500, bottom: 1700 }],
  }),
);
assert.equal(wide.ok, true);
assert.equal(wide.pages[0].degraded, undefined, "only the page holding the wide element is marked");
assert.equal(wide.pages[1].fallback, "crop-right");
assert.match(wide.pages[1].reason, /table\.box/);

const shrunkPlan = planSheet(
  sheet({
    content: 2400,
    pieces: [{ top: 0, bottom: 1200 }, { top: 1200, bottom: 2400 }],
    shrunk: [{ sel: "img.hero", fit: 0.8, top: 100, bottom: 400 }],
  }),
);
assert.equal(shrunkPlan.pages[0].fallback, "shrink");
assert.equal(shrunkPlan.pages[0].shrink, 0.8);
assert.equal(shrunkPlan.pages[1].degraded, undefined);

const seamPlan = planSheet(
  sheet({ content: 2400, pieces: [{ top: 0, bottom: 1200 }, { top: 1200, bottom: 2400 }], seam: { y: 3000, rows: 2 } }),
);
assert.equal(seamPlan.ok, true);
assert.equal(seamPlan.pages[1].fallback, "as-is");
assert.match(seamPlan.pages[1].reason, /seam y 3000/);

const gapPlan = planSheet(sheet({ content: 2000, pieces: [{ top: 0, bottom: 1000 }, { top: 1000, bottom: 2600 }] }));
assert.equal(gapPlan.ok, true, gapPlan.reason);
assert.equal(gapPlan.pages.at(-1).fallback, "as-is");
assert.match(gapPlan.pages.at(-1).reason, /gap at|past edge|unsplittable/);

const tenPx = planSheet(sheet({ content: 2000, pieces: [{ top: 10, bottom: 2000, sel: "article.blocked" }] }));
assert.equal(tenPx.ok, true, tenPx.reason);
assert.equal(tenPx.pages.length, 1, "the 10px page joins the scaled block");
assert.ok(tenPx.pages[0].slices[0].srcTop === 0 && tenPx.pages[0].slices.at(-1).srcBottom === 2000);
assert.match(tenPx.pages[0].fallback, /scale/);
assert.ok(pageFit(tenPx.pages[0]) >= MIN_FIT);

const tailPieces = [{ top: 0, bottom: 1350 }, { top: 1350, bottom: 1400 }];
const inkTail = planSheet(sheet({ content: 1400, pieces: tailPieces }));
assert.equal(inkTail.pages.length, 1, "a 50px tail with copy joins the page above");
assert.equal(inkTail.pages[0].fallback, "merge");
assert.ok(pageFit(inkTail.pages[0]) > 0.98);
const paperTail = planSheet(sheet({ content: 1400, pieces: tailPieces, blankFrom: 1350 }));
assert.equal(paperTail.pages.length, 1, "a bare-paper tail is dropped");
assert.equal(paperTail.pages[0].degraded, undefined);
assert.ok(NEAR_EMPTY_CSS >= 32);

const fitPage = { slices: [{ srcTop: 0, srcBottom: 2000, fit: 1376 / 2000 }], fit: 1376 / 2000 };
const fitSpots = remapHotspots(
  [
    { x: 0.5, y: 0.9, w: 0.4, h: 0.02, href: "/late", folio: null, label: "late" },
    { x: 0.1, y: 0.3, w: 0.2, h: 0.02, href: "/early", folio: null, label: "early" },
  ],
  2000,
  [fitPage],
);
assert.equal(fitSpots[0].length, 2, "a link low on a scaled page is kept");
const late = fitSpots[0].find((spot) => spot.href === "/late");
assert.ok(Math.abs(late.y - 0.9) < 1e-6, `late y ${late.y}`);
assert.ok(Math.abs(late.x - 0.5 * 0.688) < 1e-6 && Math.abs(late.w - 0.4 * 0.688) < 1e-6, "x and w scale too");
const early = fitSpots[0].find((spot) => spot.href === "/early");
assert.ok(Math.abs(early.y - 0.3) < 1e-6, `early y ${early.y}`);
const headed = remapHotspots(
  [{ x: 0.1, y: 1500 / 2000, w: 0.2, h: 0.01, href: "/row", folio: null, label: "row" }],
  2000,
  [{ slices: [{ srcTop: 0, srcBottom: 40, header: true }, { srcTop: 1000, srcBottom: 2000 }] }],
);
assert.ok(Math.abs(headed[0][0].y - 540 / 1376) < 1e-6, "a repeated header pushes the link down");
assert.equal(headed[0][0].x, 0.1, "an unscaled page keeps x");

const banded = Buffer.alloc(4 * 4800 * 4);
for (let y = 0; y < 4800; y++) {
  for (let x = 0; x < 4; x++) {
    const o = (y * 4 + x) * 4;
    banded[o] = y < 80 ? 10 : y < 2000 ? 99 : 200;
    banded[o + 3] = 255;
  }
}
const bandFit = 1376 / 1440;
const twoBand = paintFlatPage(
  banded,
  4,
  4800,
  [
    { srcTop: 0, srcBottom: 40, header: true, fit: bandFit },
    { srcTop: 1000, srcBottom: 2400, fit: bandFit },
  ],
  2,
);
assert.equal(twoBand.used, PAGE_DEV_H);
assert.equal(twoBand.buffer[0], 10, "the header is on top");
assert.equal(twoBand.buffer[(PAGE_DEV_H - 1) * PAGE_DEV_W * 4], 200, "the body ends the page");
for (let y = 0; y < PAGE_DEV_H; y++) {
  assert.notEqual(twoBand.buffer[y * PAGE_DEV_W * 4], 99, "rows between header and body are not painted");
}

function vp8l(width, height, bytes) {
  const buf = Buffer.alloc(bytes);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(bytes - 8, 4);
  buf.write("WEBP", 8);
  buf.write("VP8L", 12);
  buf.writeUInt32LE(bytes - 20, 16);
  buf[20] = 0x2f;
  const w = width - 1;
  const h = height - 1;
  buf[21] = w & 0xff;
  buf[22] = ((w >> 8) & 0x3f) | ((h & 3) << 6);
  buf[23] = (h >> 2) & 0xff;
  buf[24] = (h >> 10) & 0x0f;
  return buf;
}
assert.deepEqual(webpSize(vp8l(PAGE_DEV_W, PAGE_DEV_H, 64)), { width: PAGE_DEV_W, height: PAGE_DEV_H });

const outDir = mkdtempSync(path.join(tmpdir(), "times-flat-test-"));
const goodEncode = async () => vp8l(PAGE_DEV_W, PAGE_DEV_H, 20_000);
const said = [];
const say = (...parts) => said.push(parts.join(" "));

// An edition: a clean A1, an unsplittable B1, a clipped A4 with a link, and a missing A5.
const leaves = [
  { folio: "A1", kind: "front" },
  { folio: "A2", kind: "section" },
  { folio: "A3", kind: "section" },
  { folio: "A4", kind: "section" },
  { folio: "B1", kind: "section" },
  { folio: "B2", kind: "section" },
];
const sheets = {
  A1: sheet({ content: 1300, pieces: [{ top: 0, bottom: 1300 }] }),
  A2: sheet({ content: 1300, pieces: [{ top: 0, bottom: 1300 }] }),
  A3: sheet({ content: 2400, pieces: [{ top: 0, bottom: 1200 }, { top: 1200, bottom: 2400 }] }),
  A4: sheet({ content: 3641, captured: 1548, pieces: [{ top: 0, bottom: 700 }, { top: 720, bottom: 3641 }] }),
  B1: sheet({ content: 2000, pieces: [{ top: 0, bottom: 2000, sel: "article.tt-mo-story.xl" }] }),
  B2: sheet({ content: 1300, pieces: [{ top: 0, bottom: 1300 }] }),
};
const spotsFor = {
  B1: [{ x: 0.2, y: 0.9, w: 0.5, h: 0.03, href: "/story/b1", folio: null, label: "B1 story" }],
};

async function printEdition(sheetsByFolio, encode = goodEncode) {
  const report = [];
  const staged = [];
  for (const leaf of leaves) {
    const shot = sheetsByFolio[leaf.folio];
    const plan = shot?.buffer ? planSheet(shot) : { ok: false, reason: shot?.reject || "no sheet", pages: [] };
    if (!plan.ok) {
      report.push({ folio: leaf.folio, cssHeight: 0, blankRatio: 1, ok: false, reason: plan.reason });
      continue;
    }
    const done = await renderSheet({
      leaf,
      shot,
      plan,
      spots: spotsFor[leaf.folio] || [],
      outDir,
      firstIndex: staged.length,
      encode,
      say,
    });
    report.push(...done.report);
    staged.push(...done.staged);
  }
  return { report, staged, verdict: publishVerdict({ leaves, report, staged }) };
}

const edition = await printEdition(sheets);
assert.equal(edition.verdict.ok, true, edition.verdict.reasons.join("; "));
assert.equal(edition.verdict.degraded, 2, "A4 clip and B1 scale");
const b1 = edition.staged.find((page) => page.folio === "B1");
assert.equal(b1.fallback, "scale");
assert.ok(Math.abs(b1.hotspots[0].y - 0.9) < 1e-6, "the B1 link lands where the scaled story is");
assert.ok(Math.abs(b1.hotspots[0].w - 0.5 * b1.fit) < 1e-6);
const a4Last = edition.staged.filter((page) => page.folio.startsWith("A4")).at(-1);
assert.match(a4Last.fallback, /clip/);
const b1Line = said.find((line) => line.startsWith("PAGE B1 "));
assert.match(b1Line, /DEGRADED scale: unsplittable/, "the PAGE line does not say FAIL for a published page");
const b1Row = edition.report.find((row) => row.folio === "B1");
assert.match(heightLine(b1Row), /\tDEGRADED scale: unsplittable/, "heights.txt says DEGRADED too");
assert.match(heightLine(edition.report.find((row) => row.folio === "A1")), /\tok$/);
assert.match(degradedWarning("2026-10-08-evening", edition.staged), /^::warning title=Times flat print::2026-10-08-evening: 2 of \d+ pages degraded \(A4 cont\. clip, B1 scale\)$/);
assert.equal(degradedWarning("x", edition.staged.filter((page) => !page.degraded)), null);
const manifestOut = buildFlatManifest({ issueId: "t", printedAt: "t", pages: edition.staged });
assert.equal(manifestOut.pages.find((page) => page.folio === "B1").fit, 0.688);
assert.equal(manifestOut.pages.find((page) => page.folio === "A1").degraded, undefined);

const missingA5 = await printEdition({ ...sheets, B2: { reject: "offscreen" } });
assert.equal(missingA5.verdict.ok, false, "a missing sheet still withholds");
assert.match(missingA5.verdict.reasons.join(" "), /B2:offscreen/);
assert.match(missingA5.verdict.reasons.join(" "), /no page for B2/);

const badEncode = await printEdition(sheets, async () => vp8l(PAGE_DEV_W, 3303, 20_000));
assert.equal(badEncode.verdict.ok, false);
assert.match(badEncode.report[0].reason, /encoded 2064x3303/);
const tinyEncode = await printEdition(sheets, async () => vp8l(PAGE_DEV_W, PAGE_DEV_H, 300));
assert.equal(tinyEncode.verdict.ok, false);
assert.match(tinyEncode.report[0].reason, /encoded 300 bytes/);

const paperSheet = sheet({ content: 1300, pieces: [{ top: 0, bottom: 1300 }], width: PAGE_DEV_W });
paperSheet.buffer.fill(255);
const emptyPage = await printEdition({ ...sheets, A2: paperSheet });
assert.equal(emptyPage.verdict.ok, false, "an empty page never publishes");
assert.match(emptyPage.report.find((row) => row.folio === "A2").reason, /empty/);

const scaledFront = await printEdition({ ...sheets, A1: sheets.B1 });
assert.equal(scaledFront.verdict.ok, false, "A1 scaled withholds");
assert.match(scaledFront.verdict.reasons.join(" "), /front page A1 is scale/);

const page = (folio, extra = {}) => ({ folio, degraded: false, fit: 1, shrink: 1, bodyCss: 1300, ...extra });
const six = leaves.map((leaf) => page(leaf.folio));
const gate = (staged, report = staged.map((row) => ({ folio: row.folio, ok: true }))) =>
  publishVerdict({ leaves, report, staged });
assert.equal(gate(six).ok, true);
assert.equal(gate([page("A1", { degraded: true, fallback: "move" }), ...six.slice(1)]).ok, true, "A1 move publishes");
assert.equal(gate([page("A1", { degraded: true, fallback: "crop" }), ...six.slice(1)]).ok, false);
assert.equal(gate([...six, page("A1 cont.", { degraded: true, fallback: "clip" })]).ok, false);
assert.equal(gate([page("A1", { degraded: true, fallback: "merge", fit: 0.95 }), ...six.slice(1)]).ok, true);
assert.equal(gate([page("A1", { degraded: true, fallback: "shrink", shrink: A1_MIN_FIT - 0.1 }), ...six.slice(1)]).ok, false);
const two = six.map((row, index) => (index === 1 || index === 2 ? { ...row, degraded: true, fallback: "move" } : row));
assert.equal(gate(two).ok, true, "2 of 6 degraded is a third");
const three = six.map((row, index) => (index >= 1 && index <= 3 ? { ...row, degraded: true, fallback: "move" } : row));
assert.match(gate(three).reasons.join(" "), /3 of 6 pages degraded/);
assert.match(gate([...six.slice(0, 5), page("B2", { degraded: true, fallback: "scale", fit: 0.45 })]).reasons.join(" "), /scaled under 0\.5: B2/);
assert.match(gate([...six, page("B2 cont.", { bodyCss: 10 })]).reasons.join(" "), /near-empty: B2 cont\. 10px/);
assert.match(gate(six.slice(1)).reasons.join(" "), /no page for A1/);

const printer = readFileSync(new URL("./times-flat-print.mjs", import.meta.url), "utf8");
const loop = printer.slice(printer.indexOf("export async function printFlatEdition"));
assert.doesNotMatch(loop, /deleteManifest/, "a print never removes the edition's last good manifest");
assert.ok(
  loop.indexOf("publishVerdict({") > 0 && loop.indexOf("publishVerdict({") < loop.indexOf("for (const item of staged)"),
  "pages upload only after the gate",
);
assert.match(loop, /planSheet\(shot\)/, "every captured sheet goes through planSheet");
assert.match(loop, /captureSheet\(page, i, pngPath, \{ shrink: MIN_FIT \}\)/, "past-right gets a shrink capture");
assert.match(loop, /console\.log\(warning\)/, "a degraded edition emits the ::warning::");
assert.match(loop, /"degraded", total, "bytes"/, "the uploaded line counts degraded pages");
assert.doesNotMatch(
  printer,
  /unlock\(document\.querySelector\("\.newspaper-edition"\)/,
  "the pager stays a horizontal scrollport",
);
assert.match(printer, /stopped after the first 3 sheets failed/, "three dead sheets abort the run");

const shots = readFileSync(new URL("./times-shots.mjs", import.meta.url), "utf8");
assert.match(shots, /loadFlatA1Png/, "telegram send must look for the flat A1");
assert.match(shots, /MANIFEST_WAIT_MS = 30 \* 60 \* 1000/, "manifest wait is capped at 30 minutes");
assert.match(shots, /MANIFEST_POLL_MS = 30 \* 1000/, "manifest poll is about 30 seconds");
assert.match(shots, /using the chromium front/, "missing flat A1 keeps today's front");
assert.match(shots, /action: "hold"/, "the wait refreshes the image claim so text does not send twice");
assert.match(shots, /action: "session"/, "the printer mints through the existing shots function");
assert.doesNotMatch(shots, /FLAT_A1_WAIT_MS/, "the alert no longer gives up after a few minutes");
assert.doesNotMatch(shots, /TIMES_FLAT_SESSION/, "no hand-made session secret");

const workflow = readFileSync(new URL("../../.github/workflows/times-telegram-shots.yml", import.meta.url), "utf8");
assert.match(workflow, /group: times-telegram-shots-\$\{\{ github\.event\.inputs\.issue_id \|\| github\.run_id \}\}/);
assert.match(workflow, /group: times-flat-print/);
assert.match(workflow, /timeout-minutes: 50/, "shoot job covers the 30-minute wait plus the shots");
assert.match(workflow, /action: "session"|--mint/, "print job logs in with the shots OIDC mint");
assert.match(workflow, /id-token: write/);
assert.doesNotMatch(workflow, /TIMES_FLAT_SESSION/);
assert.doesNotMatch(workflow, /TIMES_SUPABASE_ANON_KEY/);
assert.equal(
  (workflow.match(/group: times-telegram-shots/g) ?? []).length,
  1,
  "only the shoot job wears the shots concurrency group",
);

console.log("times-flat-print ok");
