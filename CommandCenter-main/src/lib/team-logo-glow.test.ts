/**
 * Run with: node --experimental-strip-types src/lib/team-logo-glow.test.ts
 * from CommandCenter-main/.
 */
import { rgbToHsl, parseHex, teamGlowColor, readEspnTeamColors, logoGlowBackground } from "./team-logo-glow.ts";

const assert = {
  equal(actual: unknown, expected: unknown, msg?: string) {
    if (actual !== expected) throw new Error(`${msg ?? "equal"}: expected ${String(expected)}, got ${String(actual)}`);
  },
  ok(v: unknown, msg?: string) {
    if (!v) throw new Error(msg ?? "ok");
  },
};
let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}
const lightness = (hex: string) => rgbToHsl(parseHex(hex)!)[2];

test("bright primaries pass through", () => {
  assert.equal(teamGlowColor("ce1141"), "ce1141");
  assert.equal(teamGlowColor("#fd5a1e", "000000"), "fd5a1e");
});

test("dark primary uses a saturated alternate, not cream or white", () => {
  assert.equal(teamGlowColor("231f20", "fcd116"), "fcd116", "Iowa gold");
  assert.equal(teamGlowColor("000000", "ffffff"), teamGlowColor("000000"), "white alternate ignored");
  assert.ok(lightness(teamGlowColor("33006f", "e8d3a2")) >= 0.4, "Washington stays visible");
  assert.ok(teamGlowColor("33006f", "e8d3a2") !== "e8d3a2", "cream alternate is not the glow");
});

test("near-white primary uses a real alternate instead of a white halo", () => {
  assert.equal(teamGlowColor("ffffff", "ffcd00"), "ffcd00");
  const glow = teamGlowColor("ffffff");
  assert.ok(lightness(glow) < 0.75, glow);
});

test("near-black with no alternate is a visible neutral", () => {
  const glow = teamGlowColor("000000");
  assert.ok(lightness(glow) >= 0.4, glow);
  assert.ok(!glow.startsWith("d9"), glow);
});

test("navy keeps its hue when lifted", () => {
  const glow = teamGlowColor("0c2340");
  const [h] = rgbToHsl(parseHex(glow)!);
  const [src] = rgbToHsl(parseHex("0c2340")!);
  assert.ok(Math.abs(h - src) < 2, `${glow} hue`);
  assert.ok(lightness(glow) >= 0.4);
});

test("missing color falls back", () => {
  assert.equal(teamGlowColor(null, null), "d9515c");
});

test("readEspnTeamColors", () => {
  assert.equal(readEspnTeamColors("#33006F", "E8D3A2", "555555").color, "33006f");
  assert.equal(readEspnTeamColors("#33006F", "E8D3A2", "555555").alternateColor, "e8d3a2");
  assert.equal(readEspnTeamColors(undefined, "nope", "555555").color, "555555");
  assert.equal(readEspnTeamColors(undefined, "nope", "555555").alternateColor, null);
});

test("glow background fades out", () => {
  const bg = logoGlowBackground(teamGlowColor("231f20", "fcd116"));
  assert.ok(bg.includes("rgba(252,209,22,"), bg);
  assert.ok(bg.endsWith("0) 100%)"), bg);
});

console.log(`\n${passed} tests passed`);
