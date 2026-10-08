/**
 * Run with: node --experimental-strip-types src/lib/mlb-batter-box.test.ts
 * from CommandCenter-main/.
 */
import { batterBoxSide, matchupSide, normalizeHand, shortPlayerName } from "./mlb-batter-box.ts";

const assert = {
  equal(actual: unknown, expected: unknown, msg?: string) {
    if (actual !== expected) {
      throw new Error(`${msg ?? "assert.equal"}: expected ${String(expected)}, got ${String(actual)}`);
    }
  },
};
let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

test("normalizeHand accepts batSide / pitchHand forms", () => {
  assert.equal(normalizeHand("R"), "R");
  assert.equal(normalizeHand("l"), "L");
  assert.equal(normalizeHand("RHP"), "R");
  assert.equal(normalizeHand("LHP"), "L");
  assert.equal(normalizeHand(" Left "), "L");
  assert.equal(normalizeHand("S"), null, "season switch code is not a side");
  assert.equal(normalizeHand(""), null);
  assert.equal(normalizeHand(null), null);
  assert.equal(normalizeHand(undefined), null);
});

test("batterBoxSide: catcher's view puts RHB left, LHB right", () => {
  assert.equal(batterBoxSide("R"), "left");
  assert.equal(batterBoxSide("L"), "right");
  // Switch hitter batting lefty this PA: matchup.batSide.code is "L".
  assert.equal(batterBoxSide("L"), "right");
  assert.equal(batterBoxSide("S"), null, "unknown actual side hides the capsule");
  assert.equal(batterBoxSide(null), null);
  assert.equal(batterBoxSide("?"), null);
});

test("matchupSide", () => {
  assert.equal(matchupSide("R", "R"), "same side");
  assert.equal(matchupSide("L", "LHP"), "same side");
  assert.equal(matchupSide("L", "R"), "opposite side");
  assert.equal(matchupSide("R", null), null);
  assert.equal(matchupSide("S", "R"), null);
});

test("shortPlayerName", () => {
  assert.equal(shortPlayerName("Teoscar Hernández"), "T. Hernández");
  assert.equal(shortPlayerName("Vladimir Guerrero Jr."), "V. Guerrero Jr.");
  assert.equal(shortPlayerName("Ichiro"), "Ichiro");
  assert.equal(shortPlayerName("  "), null);
  assert.equal(shortPlayerName(null), null);
});

console.log(`\n${passed} tests passed`);
