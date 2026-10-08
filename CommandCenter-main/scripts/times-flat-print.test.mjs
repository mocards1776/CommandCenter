/**
 * Run with: node CommandCenter-main/scripts/times-flat-print.test.mjs
 * The stub gate: a ~200 CSS px shell is not a page, a real short page is.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { judgePage, MIN_CSS_HEIGHT, webpSize } from "./times-flat-print.mjs";

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

const shots = readFileSync(new URL("./times-shots.mjs", import.meta.url), "utf8");
assert.match(shots, /flatA1Png/, "telegram send must look for the flat A1");
assert.match(shots, /FLAT_A1_WAIT_MS = 3 \* 60 \* 1000/, "flat A1 wait stays inside a few minutes");
assert.match(shots, /using the chromium front/, "missing flat A1 keeps today's front");
assert.match(shots, /action: "session"/, "the printer mints through the existing shots function");
assert.doesNotMatch(shots, /TIMES_FLAT_SESSION/, "no hand-made session secret");

const workflow = readFileSync(new URL("../../.github/workflows/times-telegram-shots.yml", import.meta.url), "utf8");
assert.match(workflow, /group: times-telegram-shots/);
assert.match(workflow, /group: times-flat-print/);
assert.match(workflow, /action: "session"|--mint/, "print job logs in with the shots OIDC mint");
assert.match(workflow, /id-token: write/);
assert.doesNotMatch(workflow, /TIMES_FLAT_SESSION/);
assert.doesNotMatch(workflow, /TIMES_SUPABASE_ANON_KEY/);

console.log("times-flat-print ok");
