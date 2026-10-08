/**
 * Run with: node CommandCenter-main/scripts/times-flat-print.test.mjs
 * The stub gate: a ~200 CSS px shell is not a page, a real short page is.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { findSeam, judgePage, MIN_CSS_HEIGHT, webpSize } from "./times-flat-print.mjs";

const short = judgePage({ cssHeight: 208, blankRatio: 0.24 });
assert.equal(short.ok, false);
assert.match(short.reason, /short 208/);

const real = judgePage({ cssHeight: 615, blankRatio: 0.64 });
assert.equal(real.ok, true);

const blank = judgePage({ cssHeight: 1652, blankRatio: 0.95 });
assert.equal(blank.ok, false);
assert.match(blank.reason, /blank/);

assert.equal(MIN_CSS_HEIGHT, 480);
assert.equal(judgePage({ cssHeight: 479, blankRatio: 0.1 }).ok, false);
assert.equal(judgePage({ cssHeight: 480, blankRatio: 0.9 }).ok, true);

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
assert.equal(judgePage({ cssHeight: 1650, blankRatio: 0.2, seam }).ok, false);
assert.match(judgePage({ cssHeight: 1650, blankRatio: 0.2, seam }).reason, /seam y 10/);

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
