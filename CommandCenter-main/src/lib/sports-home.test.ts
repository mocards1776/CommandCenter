/**
 * Run with: node --experimental-strip-types src/lib/sports-home.test.ts
 * from CommandCenter-main/.
 */
import { sportsHomeRedirect } from "./sports-home.ts";

const assert = {
  equal(actual: unknown, expected: unknown, msg?: string) {
    if (actual !== expected) throw new Error(`${msg ?? "equal"}: expected ${String(expected)}, got ${String(actual)}`);
  },
};
let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

test("bare sports home and the solo launcher open RUWT", () => {
  assert.equal(sportsHomeRedirect(""), "/sports/ruwt");
  assert.equal(sportsHomeRedirect("solo=1"), "/sports/ruwt?solo=1");
});

test("team, golf, and the teams board stay put", () => {
  assert.equal(sportsHomeRedirect("solo=1&team=mlb-stl"), null);
  assert.equal(sportsHomeRedirect("solo=1&golf=1"), null);
  assert.equal(sportsHomeRedirect("solo=1&teams=1"), null);
});

console.log(`\n${passed} tests passed`);
