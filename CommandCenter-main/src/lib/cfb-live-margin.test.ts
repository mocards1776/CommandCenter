/**
 * Run with: node --experimental-strip-types src/lib/cfb-live-margin.test.ts
 * from CommandCenter-main/.
 *
 * Board weights below are the non-margin terms in scoreCfbRuwtGame.
 * SEC interest is the conference floor (4) times 3, per school.
 * A bare one-score game in another sport is live 40 + one-score 28 = 68.
 */
import {
  CFB_GOTW_TWO_SCORE_CREDIT,
  cfbGotwTwoScoreEase,
  cfbIsGameOfTheWeekMatchup,
  cfbRecordLosses,
  cfbTwoScoreBucketPoints,
  cfbUndefeatedOrEquivalentStakes,
  type CfbGameOfTheWeekInput,
} from "./cfb-live-margin.ts";

const assert = {
  equal(actual: unknown, expected: unknown, message?: string) {
    if (actual !== expected) {
      throw new Error(message ?? `expected ${String(expected)}, got ${String(actual)}`);
    }
  },
  ok(cond: unknown, message: string) {
    if (!cond) throw new Error(message);
  },
};

const LIVE = 40;
const ONE_SCORE = 28;
const WITHIN_A_KICK = 6;
const RED_ZONE = 18;
const FOURTH_QUARTER = 18;
const RANKED_MATCHUP_TOP10 = 40;
const RANKED_TEAM_TOP10 = 34;
const TOP_FPI = 12;
const NATIONAL_TV = 8;
const MARQUEE = 14;
const SEC_SIDE = 4 * 3;
const RANKED_THREE_SCORE = -10;
const UNRANKED_THREE_SCORE = -14;
const UNRANKED_DECIDED = -20;
const ONE_SCORE_OTHER_SPORT = 68;

const gotwInput: CfbGameOfTheWeekInput = {
  bothRanked: true,
  bothSec: true,
  bothTopFpi: true,
  nationalMarquee: true,
  awayRecord: "5-0",
  homeRecord: "4-0",
};

assert.equal(cfbRecordLosses("5-0"), 0);
assert.equal(cfbRecordLosses("4-1"), 1);
assert.equal(cfbRecordLosses("4-0-1"), 0);
assert.equal(cfbRecordLosses(" 3-2 "), 2);
assert.equal(cfbRecordLosses(null), null);
assert.equal(cfbRecordLosses(""), null);
assert.equal(cfbRecordLosses("no record"), null);

assert.ok(cfbUndefeatedOrEquivalentStakes("5-0", "4-0"), "both undefeated");
assert.ok(cfbUndefeatedOrEquivalentStakes("6-0", "5-1"), "one loss is equivalent stakes");
assert.ok(cfbUndefeatedOrEquivalentStakes("7-1", "7-1"), "two one-loss teams still qualify");
assert.ok(cfbUndefeatedOrEquivalentStakes("0-0", "0-0"), "an opener is undefeated");
assert.ok(!cfbUndefeatedOrEquivalentStakes("5-0", "3-2"), "two losses is not equivalent");
assert.ok(!cfbUndefeatedOrEquivalentStakes("5-0", null), "a missing record is not stakes");

assert.ok(cfbIsGameOfTheWeekMatchup(gotwInput), "full profile is a game of the week");
for (const drop of [
  "bothRanked",
  "bothSec",
  "bothTopFpi",
  "nationalMarquee",
] as const) {
  assert.ok(
    !cfbIsGameOfTheWeekMatchup({ ...gotwInput, [drop]: false }),
    `missing ${drop} is not a game of the week`,
  );
}
assert.ok(
  !cfbIsGameOfTheWeekMatchup({ ...gotwInput, awayRecord: "4-2" }),
  "a two-loss side is not a game of the week",
);

// 14 points is Tight: a +10 bonus, not a penalty. The ease is added on top.
assert.equal(cfbTwoScoreBucketPoints(14), 10);
assert.equal(cfbTwoScoreBucketPoints(16), -3);
assert.equal(cfbGotwTwoScoreEase(14, true), CFB_GOTW_TWO_SCORE_CREDIT - 10);
assert.equal(cfbGotwTwoScoreEase(9, true), CFB_GOTW_TWO_SCORE_CREDIT - 10);
assert.equal(cfbGotwTwoScoreEase(16, true), CFB_GOTW_TWO_SCORE_CREDIT - -3);
assert.equal(10 + cfbGotwTwoScoreEase(14, true), CFB_GOTW_TWO_SCORE_CREDIT);
assert.equal(-3 + cfbGotwTwoScoreEase(16, true), CFB_GOTW_TWO_SCORE_CREDIT);
assert.ok(CFB_GOTW_TWO_SCORE_CREDIT < ONE_SCORE, "two-score credit stays under a one-score bonus");

assert.equal(cfbGotwTwoScoreEase(14, false), 0);
assert.equal(cfbGotwTwoScoreEase(8, true), 0, "one-score games keep their own bonus");
assert.equal(cfbGotwTwoScoreEase(3, true), 0);
assert.equal(cfbGotwTwoScoreEase(17, true), 0, "three scores get no ease");
assert.equal(cfbGotwTwoScoreEase(21, true), 0);
assert.equal(cfbGotwTwoScoreEase(28, true), 0);
assert.equal(cfbGotwTwoScoreEase(35, true), 0);

const secInterest = SEC_SIDE * 2;
const gotwQuality = RANKED_MATCHUP_TOP10 + TOP_FPI + NATIONAL_TV + MARQUEE + secInterest;
const twoScoreGotw = LIVE + CFB_GOTW_TWO_SCORE_CREDIT + gotwQuality;
const sameGameOneScore = LIVE + ONE_SCORE + gotwQuality;
const lesserOneScore =
  LIVE + ONE_SCORE + WITHIN_A_KICK + RED_ZONE + RANKED_TEAM_TOP10 + secInterest;
const lesserOneScoreFourth = lesserOneScore + FOURTH_QUARTER;
const withoutEase = LIVE + cfbTwoScoreBucketPoints(14) + gotwQuality;
const threeScoreGotw = LIVE + RANKED_THREE_SCORE + gotwQuality;
const unrankedThreeScore = LIVE + UNRANKED_THREE_SCORE + secInterest;
const unrankedDecided = LIVE + UNRANKED_DECIDED + secInterest;

assert.ok(
  twoScoreGotw > lesserOneScore,
  `two-score game of the week ${twoScoreGotw} should sit above a lesser one-score game ${lesserOneScore}`,
);
assert.ok(
  sameGameOneScore > twoScoreGotw,
  `a one-score version of the same game ${sameGameOneScore} should still lead the two-score ${twoScoreGotw}`,
);
assert.ok(
  twoScoreGotw < lesserOneScoreFourth,
  `a 2nd-quarter two-score game of the week ${twoScoreGotw} should still trail a 4th-quarter one-score ${lesserOneScoreFourth}`,
);
assert.ok(
  withoutEase < lesserOneScore,
  `without the ease a 14-point marquee ${withoutEase} still loses to the lesser one-score ${lesserOneScore}`,
);
assert.ok(
  threeScoreGotw < lesserOneScore,
  `a three-score marquee ${threeScoreGotw} should lose to a lesser one-score game ${lesserOneScore}`,
);
assert.ok(
  unrankedThreeScore < ONE_SCORE_OTHER_SPORT,
  `an unranked three-score SEC game ${unrankedThreeScore} should lose to a one-score game in any sport ${ONE_SCORE_OTHER_SPORT}`,
);
assert.ok(
  unrankedDecided < ONE_SCORE_OTHER_SPORT,
  `an unranked decided game ${unrankedDecided} should lose to a one-score game in any sport ${ONE_SCORE_OTHER_SPORT}`,
);

console.log("cfb-live-margin: ok");
console.log(
  JSON.stringify({
    twoScoreGotw,
    lesserOneScore,
    sameGameOneScore,
    lesserOneScoreFourth,
    withoutEase,
    threeScoreGotw,
    unrankedThreeScore,
    unrankedDecided,
    oneScoreOtherSport: ONE_SCORE_OTHER_SPORT,
  }),
);
