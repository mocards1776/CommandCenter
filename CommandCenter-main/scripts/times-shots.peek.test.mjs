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
assert.doesNotMatch(src, /const PHONE = \{ width: 430, height: 932 \}/, "phone 430×932 canvas is gone");
assert.doesNotMatch(src, /fitA1ToPhone/, "no second layout that fits A1 onto a phone canvas");
assert.doesNotMatch(src, /\/newspaper\/phone-card/, "runner does not open the phone-card route");
assert.match(src, /const IPAD = \{ width: 1032, height: 1376 \}/, "alerts use the iPad Pro 13″ page");
assert.match(src, /\/newspaper\?solo=1/, "front shot opens the printed paper Josh reads");
assert.match(src, /data-times-ready/, "front waits for the revealed A1");
assert.match(src, /PAPER_EXTRAS/, "weather / day / watch come from the same iPad paper");
assert.doesNotMatch(src, /sample=/, "production runner never passes the Day Ahead / front fixtures");

const editorPrompt = readFileSync(new URL("../../supabase/functions/newspaper-editor/index.ts", import.meta.url), "utf8");
assert.doesNotMatch(
  editorPrompt,
  /desk "followed":[^)]*76ers/,
  "the editor no longer lists 76ers as an A1 followed club",
);
assert.match(editorPrompt, /Never front the 76ers/, "the editor is told never to front 76ers");

console.log("times-shots.peek ok");
