/**
 * Run with: node CommandCenter-main/scripts/times-flat-print.test.mjs
 * The stub gate: a ~200 CSS px shell is not a page, a real short page is.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  clipSize,
  continuationName,
  findSeam,
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

const printer = readFileSync(new URL("./times-flat-print.mjs", import.meta.url), "utf8");
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
