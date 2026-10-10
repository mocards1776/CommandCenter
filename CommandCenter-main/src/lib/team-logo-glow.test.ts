/**
 * Run with: node --experimental-strip-types src/lib/team-logo-glow.test.ts
 * from CommandCenter-main/.
 */
import {
  rgbToHsl,
  parseHex,
  contrastRatio,
  teamGlowColor,
  readEspnTeamColors,
  logoGlowBackground,
  isPlateColor,
} from "./team-logo-glow.ts";

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
const hue = (hex: string) => rgbToHsl(parseHex(hex)!)[0];
const card = parseHex("07101d")!;

function clearsLogo(glow: string, logo: string) {
  const g = parseHex(glow)!;
  const mark = parseHex(logo)!;
  assert.ok(contrastRatio(g, mark) >= 2.4, `${glow} vs ${logo}`);
  assert.ok(contrastRatio(g, card) >= 1.7, `${glow} on card`);
  assert.ok(!isPlateColor(g), `${glow} is a plate`);
  assert.ok(lightness(glow) >= 0.42, glow);
}

test("bright primary that is not the logo can pass through", () => {
  assert.equal(teamGlowColor("ce1141", "000000", "111111"), "ce1141");
});

test("primary matching the logo yields a lighter tint, not the mark", () => {
  const glow = teamGlowColor("ce1141");
  assert.ok(glow !== "ce1141", glow);
  assert.ok(!isPlateColor(parseHex(glow)), glow);
  assert.ok(lightness(glow) > lightness("ce1141") + 0.12, glow);
  assert.ok(Math.abs(hue(glow) - hue("ce1141")) < 8, glow);
});

test("dark primary uses a saturated alternate, not cream or white", () => {
  assert.equal(teamGlowColor("231f20", "fcd116"), "fcd116", "Iowa gold");
  const wash = teamGlowColor("33006f", "e8d3a2");
  assert.ok(wash !== "e8d3a2", "cream alternate is not the glow");
  clearsLogo(wash, "33006f");
  assert.ok(Math.abs(hue(wash) - hue("33006f")) < 12, `${wash} stays purple`);
  const usu = teamGlowColor("0f2439", "ffffff");
  assert.ok(usu !== "ffffff", usu);
  clearsLogo(usu, "0f2439");
  assert.ok(Math.abs(hue(usu) - hue("0f2439")) < 12, `${usu} stays navy`);
});

test("crimson logo does not sit on the same crimson", () => {
  const glow = teamGlowColor("a60f2d", "4d4d4d");
  assert.ok(glow !== "a60f2d", glow);
  clearsLogo(glow, "a60f2d");
});

test("near-white primary uses a real alternate instead of a white halo", () => {
  assert.equal(teamGlowColor("ffffff", "ffcd00"), "ffcd00");
  const glow = teamGlowColor("ffffff");
  assert.ok(lightness(glow) < 0.75, glow);
  assert.ok(!isPlateColor(parseHex(glow)), glow);
});

test("near-black with no alternate is a visible neutral", () => {
  const glow = teamGlowColor("000000");
  assert.ok(lightness(glow) >= 0.5, glow);
  assert.ok(rgbToHsl(parseHex(glow)!)[1] < 0.08, glow);
  assert.ok(!glow.startsWith("d9"), glow);
});

test("navy keeps its hue when lifted", () => {
  const glow = teamGlowColor("0c2340");
  const [h] = rgbToHsl(parseHex(glow)!);
  const [src] = rgbToHsl(parseHex("0c2340")!);
  assert.ok(Math.abs(h - src) < 8, `${glow} hue`);
  clearsLogo(glow, "0c2340");
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
