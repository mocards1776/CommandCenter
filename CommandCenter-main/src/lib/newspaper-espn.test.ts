/**
 * Run with: node --experimental-strip-types src/lib/newspaper-espn.test.ts
 * from CommandCenter-main/.
 */
import { isNewspaperCfbDeskGame, NEWSPAPER_CFB_SEC_IDS } from "./newspaper-espn.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

assert(NEWSPAPER_CFB_SEC_IDS.has("142"), "Missouri is SEC");
assert(NEWSPAPER_CFB_SEC_IDS.has("333"), "Alabama is SEC");
assert(
  isNewspaperCfbDeskGame({ awayId: "57", homeId: "142" }),
  "an SEC game files even if neither side is ranked",
);
assert(
  isNewspaperCfbDeskGame({ awayId: "9999", homeId: "87", awayRank: 12 }),
  "a ranked non-SEC game files",
);
assert(
  !isNewspaperCfbDeskGame({ awayId: "9999", homeId: "8888" }),
  "an unranked G5 game does not take a CFB wrap slot",
);
assert(
  isNewspaperCfbDeskGame({ awayId: "9999", homeId: "8888", favorite: true }),
  "a followed club still files",
);

console.log("newspaper-espn ok");
