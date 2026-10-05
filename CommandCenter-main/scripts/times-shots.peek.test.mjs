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
console.log("times-shots.peek ok");
