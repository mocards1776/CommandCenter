/**
 * Run with: node CommandCenter-main/scripts/times-shots.peek.test.mjs
 * Guards the --peek/--issue argv so a dispatched run never falls through to claim.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = readFileSync(new URL("./times-shots.mjs", import.meta.url), "utf8");
assert.match(src, /if \(flag\("peek"\)\) \{/, `${fileURLToPath(import.meta.url)}: --peek must be handled before claim`);
assert.match(
  src,
  /action: "peek", \.\.\.\(asked \? \{ issue_id: asked \} : \{\}\)/,
  "peek must forward --issue so workflow_dispatch can name the edition",
);
assert.doesNotMatch(
  src,
  /if \(!asked\) \{\s*const peek = await call\(\{ action: "peek" \}\);\s*if \(flag\("peek"\)\)/,
  "old peek-inside-!asked path would skip --peek --issue and claim instead",
);
assert.match(src, /const PHONE = \{ width: 430, height: 932 \}/, "phone canvas is 430×932");
assert.match(
  src,
  /clip: \{ x: 0, y: 0, width: PHONE\.width, height: PHONE\.height \}/,
  "every phone shot is hard-clipped to the set size",
);
assert.doesNotMatch(src, /Math\.max\(PHONE\.height/, "viewport must not grow with card height");
assert.match(src, /\["front", "weather", "day", "watch"\]/, "four phone cards including front");
assert.doesNotMatch(src, /newspaper\?solo=1#A1/, "alert runner does not screenshot the iPad paper");
console.log("times-shots.peek ok");
