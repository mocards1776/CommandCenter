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
assert.match(src, /const IPAD13 = \{ width: 1032, height: 1376 \}/, "alert window is iPad Pro 13\" portrait");
assert.doesNotMatch(src, /430/, "no phone-fit canvas remains on the alert path");
assert.doesNotMatch(src, /fitA1ToPhone/, "A1 is not refit onto a second size");
assert.doesNotMatch(src, /phone-card/, "alert shots are paper sheets, not phone cards");
assert.match(src, /favorites-front/, "front shot is the printed A1 sheet");
assert.match(src, /favorites-clubs/, "weather shot is the iPad clubs sheet");
assert.match(src, /favorites-day/, "day shot is the iPad day sheet");
assert.match(src, /favorites-watch/, "watch shot is the iPad watch sheet");
assert.match(src, /\/newspaper\?solo=1/, "shots open the printed paper Josh reads");
assert.match(src, /data-times-ready/, "front waits for the revealed A1");
assert.match(src, /data-times-folios/, "inside sheets wait until the folio has filled");
assert.match(src, /sheet\.screenshot/, "height follows the sheet; stories are not clipped");
assert.doesNotMatch(src, /sample=/, "production runner never passes the Day Ahead / front fixtures");

const editorPrompt = readFileSync(new URL("../../supabase/functions/newspaper-editor/index.ts", import.meta.url), "utf8");
assert.doesNotMatch(
  editorPrompt,
  /desk "followed":[^)]*76ers/,
  "the editor no longer lists 76ers as an A1 followed club",
);
assert.match(editorPrompt, /Never front the 76ers/, "the editor is told never to front 76ers");

console.log("times-shots.peek ok");
