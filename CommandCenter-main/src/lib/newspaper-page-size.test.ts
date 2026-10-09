/**
 * Run with: node --experimental-strip-types src/lib/newspaper-page-size.test.ts
 * from CommandCenter-main/.
 */
import { PAGE_H_MAX, PAGE_H_MIN, PAGE_W, pageGeometry } from "./newspaper-page-size.ts";

function same(a: unknown, b: unknown, msg = "") {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`FAIL ${msg}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
}
function ok(cond: unknown, msg = "") {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}
const assert = { deepEqual: same, equal: same, ok };

// iPad Pro 13" portrait, Safari: the broadsheet scales to the width and fills the window.
{
  const g = pageGeometry(1032, 1262);
  assert.equal(g.scale, 0.8062);
  assert.equal(g.height, 1565);
  assert.ok(PAGE_W * g.scale <= 1032 && g.height * g.scale <= 1262);
}

// Home Screen app: a little taller page at the same scale.
assert.equal(pageGeometry(1032, 1332).height, 1652);

// Landscape: one page, scaled to the height, never wider than the screen.
{
  const g = pageGeometry(1376, 896);
  assert.equal(g.height, PAGE_H_MIN);
  assert.ok(g.scale < 1 && g.scale > 0.6);
  assert.ok(g.height * g.scale <= 896);
  assert.ok(PAGE_W * g.scale <= 1376);
}

// Narrow window: width-bound, page height capped.
{
  const g = pageGeometry(390, 760);
  assert.equal(g.height, PAGE_H_MAX);
  assert.ok(PAGE_W * g.scale <= 390);
  assert.ok(g.height * g.scale <= 760);
}

// Same window, same page: nothing in the copy can change it.
assert.deepEqual(pageGeometry(1032, 1218), pageGeometry(1032, 1218));

assert.deepEqual(pageGeometry(0, 0), { height: PAGE_H_MIN, scale: 1 });

console.log("newspaper-page-size ok");
