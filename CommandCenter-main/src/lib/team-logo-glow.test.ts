/**
 * Run with: node --experimental-strip-types src/lib/team-logo-glow.test.ts
 * from CommandCenter-main/.
 */
import {
  parseHex,
  teamGlowColor,
  readEspnTeamColors,
  logoGlowBackground,
  halfWashBackground,
  anchoredWashBackground,
  teamWashColor,
  endZoneOutlineColor,
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

test("a real primary that contrasts with a different logo passes through", () => {
  assert.equal(teamGlowColor("ce1141", "000000", "111111"), "ce1141");
});

test("matching primary stays the real color when there is no alternate", () => {
  assert.equal(teamGlowColor("ce1141"), "ce1141");
  assert.equal(teamGlowColor("0c2340"), "0c2340");
  assert.equal(teamGlowColor("33006f"), "33006f");
});

test("dark primary uses the real alternate, not a generated tint", () => {
  assert.equal(teamGlowColor("231f20", "fcd116"), "fcd116", "Iowa gold");
  assert.equal(teamGlowColor("33006f", "e8d3a2"), "e8d3a2", "Washington gold");
  assert.equal(teamGlowColor("0f2439", "ffffff"), "0f2439", "white alternate is a plate");
});

test("neither real color is replaced with a tint", () => {
  const glow = teamGlowColor("a60f2d", "4d4d4d");
  assert.ok(glow === "a60f2d" || glow === "4d4d4d", glow);
});

test("near-white primary uses a real alternate instead of a white halo", () => {
  assert.equal(teamGlowColor("ffffff", "ffcd00"), "ffcd00");
  assert.equal(teamGlowColor("ffffff"), "ffffff");
  assert.ok(isPlateColor(parseHex("ffffff")));
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

test("half wash matches the game-detail header", () => {
  const away = halfWashBackground(teamGlowColor("231f20", "fcd116"), "left");
  const home = halfWashBackground(teamGlowColor("33006f", "e8d3a2"), "right");
  assert.equal(away, "radial-gradient(ellipse at 20% 45%, #fcd11688, transparent 58%)");
  assert.equal(home, "radial-gradient(ellipse at 80% 45%, #e8d3a288, transparent 58%)");
});

test("glow background fades out", () => {
  const bg = logoGlowBackground(teamGlowColor("231f20", "fcd116"));
  assert.ok(bg.includes("rgba(252,209,22,"), bg);
  assert.ok(bg.endsWith("0) 100%)"), bg);
});

test("Missouri reads black and gold: gold wash, black end zone with a gold rule", () => {
  assert.equal(teamGlowColor("f1b82d", "000000"), "000000", "end zone stays black");
  assert.equal(teamWashColor("f1b82d", "000000"), "f1b82d", "wash is gold, not invisible black");
  assert.equal(endZoneOutlineColor("f1b82d", "000000"), "f1b82d", "gold outline");
});

test("Iowa, Washington and Texas A&M washes are unchanged", () => {
  assert.equal(teamWashColor("231f20", "fcd116"), "fcd116", "Iowa gold");
  assert.equal(endZoneOutlineColor("231f20", "fcd116"), null, "Iowa gold end zone needs no rule");
  assert.equal(teamWashColor("33006f", "e8d3a2"), "e8d3a2", "Washington gold");
  assert.equal(teamWashColor("500000", "ffffff"), "500000", "A&M maroon, never a white plate");
  assert.equal(endZoneOutlineColor("500000", "ffffff"), null, "no white plate outline");
});

test("anchored wash centers on the logo", () => {
  const bg = anchoredWashBackground("f1b82d", { x: 52.4, y: 88 }, 600);
  assert.ok(bg.startsWith("radial-gradient(216px 156px at 52px 88px, #f1b82d88"), bg);
  assert.ok(bg.endsWith("transparent 100%)"), bg);
  const narrow = anchoredWashBackground("f1b82d", { x: 30, y: 40 }, 200);
  assert.ok(narrow.startsWith("radial-gradient(120px 86px at 30px 40px"), narrow);
});

console.log(`\n${passed} tests passed`);
