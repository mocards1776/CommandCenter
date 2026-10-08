/**
 * Run with: node --experimental-strip-types src/lib/mlb-team-glow.test.ts
 * from CommandCenter-main/.
 */
import {
  GLOW_LIFT_LIGHTNESS,
  GLOW_MIN_LIGHTNESS,
  hslToRgb,
  logoGlowBackground,
  MLB_GLOW_OVERRIDE,
  mlbGlowColor,
  parseHex,
  rgbToHsl,
} from "./mlb-team-glow.ts";

const assert = {
  equal(actual: unknown, expected: unknown, msg?: string) {
    if (actual !== expected) {
      throw new Error(`${msg ?? "assert.equal"}: expected ${String(expected)}, got ${String(actual)}`);
    }
  },
  ok(v: unknown, msg?: string) {
    if (!v) throw new Error(msg ?? "assert.ok");
  },
};
let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}
const lightness = (hex: string) => rgbToHsl(parseHex(hex)!)[2];
const hue = (hex: string) => rgbToHsl(parseHex(hex)!)[0];

test("parseHex", () => {
  assert.equal(JSON.stringify(parseHex("#0c2340")), JSON.stringify([12, 35, 64]));
  assert.equal(JSON.stringify(parseHex("fff")), JSON.stringify([255, 255, 255]));
  assert.equal(parseHex("nope"), null);
  assert.equal(parseHex(null), null);
});

test("hsl round-trip", () => {
  for (const hex of ["0c2340", "ce1141", "8fbce6", "33006f", "27251f"]) {
    const [h, s, l] = rgbToHsl(parseHex(hex)!);
    const back = hslToRgb(h, s, l).map((c) => Math.round(c));
    assert.equal(JSON.stringify(back), JSON.stringify(parseHex(hex)), hex);
  }
});

test("bright primaries pass through unchanged", () => {
  assert.equal(mlbGlowColor(144, "ce1141"), "ce1141", "ATL");
  assert.equal(mlbGlowColor(139, "8fbce6"), "8fbce6", "TB");
  assert.equal(mlbGlowColor(137, "fd5a1e"), "fd5a1e", "SF");
});

test("navy/black clubs use a brighter secondary", () => {
  assert.equal(mlbGlowColor(116, "0c2340"), MLB_GLOW_OVERRIDE[116], "DET orange");
  assert.equal(mlbGlowColor(158, "12284b"), "ffc52f", "MIL gold");
  assert.equal(mlbGlowColor(145, "27251f"), "c4ced4", "CWS silver");
  assert.equal(mlbGlowColor(135, "2f241d"), "ffc425", "SD gold");
});

test("other dark primaries are lifted, same hue", () => {
  for (const [id, hex] of [
    [147, "0c2340"],
    [119, "005a9c"],
    [115, "33006f"],
    [112, "0e3386"],
  ] as const) {
    const out = mlbGlowColor(id, hex);
    assert.ok(lightness(hex) < GLOW_MIN_LIGHTNESS, `${hex} is dark`);
    assert.ok(Math.abs(lightness(out) - GLOW_LIFT_LIGHTNESS) < 0.01, `${id} lifted to ~${GLOW_LIFT_LIGHTNESS}`);
    assert.ok(Math.abs(hue(out) - hue(hex)) < 2, `${id} keeps hue`);
  }
});

test("bad input falls back to the app red", () => {
  assert.equal(mlbGlowColor(null, null), "d9515c");
  assert.equal(mlbGlowColor(9999, "zzz"), "d9515c");
});

test("logoGlowBackground: concentrated radial, fades to transparent", () => {
  const bg = logoGlowBackground("ce1141");
  assert.ok(bg.startsWith("radial-gradient(circle closest-side"), bg);
  assert.ok(bg.includes("rgba(206,17,65,0.66) 0%"), bg);
  assert.ok(bg.endsWith("rgba(206,17,65,0) 100%)"), bg);
  assert.ok(logoGlowBackground("ce1141", 0.5).includes("rgba(206,17,65,0.33) 0%"));
  assert.ok(logoGlowBackground("nope").includes("rgba(217,81,92,"));
});

console.log(`\n${passed} tests passed`);
