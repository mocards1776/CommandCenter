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
assert.match(src, /\["weather", "day", "watch"\]/, "weather / day / watch stay phone cards");
assert.match(src, /\/newspaper\?solo=1/, "front shot opens the printed paper Josh reads");
assert.match(src, /const IPAD = \{ width: 768, height: 1024 \}/, "front captures the iPad viewport");
assert.match(src, /data-times-ready/, "front waits for the revealed A1");
assert.match(src, /fitA1ToPhone/, "iPad A1 is fitted onto the locked phone canvas");
assert.doesNotMatch(src, /sample=/, "production runner never passes the Day Ahead / front fixtures");

const editorPrompt = readFileSync(new URL("../../supabase/functions/newspaper-editor/index.ts", import.meta.url), "utf8");
assert.doesNotMatch(
  editorPrompt,
  /desk "followed":[^)]*76ers/,
  "the editor no longer lists 76ers as an A1 followed club",
);
assert.match(editorPrompt, /Never front the 76ers/, "the editor is told never to front 76ers");

console.log("times-shots.peek ok");
