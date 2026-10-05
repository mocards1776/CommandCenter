/**
 * Run with: node --experimental-strip-types src/lib/newspaper-box-leaders.test.ts
 * from CommandCenter-main/.
 */
import {
  formatLeaderStat,
  isLeaderBoxLine,
  leaderDeskSize,
  leaderLineFromEspn,
  leaderNoteFromBox,
} from "./newspaper-box.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

assert(isLeaderBoxLine("2-7, 2 HR, 2 RBI, 2 R, K"), "a batting box line is a box line");
assert(isLeaderBoxLine("1.0 IP, 0 ER, 0 H"), "a pitching box line is a box line");
assert(!isLeaderBoxLine("4"), "a counting total is not a box line");
assert(!isLeaderBoxLine(".500"), "an average is not a box line");
assert(!isLeaderBoxLine("0.00"), "ERA text is not a box line");
assert(!isLeaderBoxLine("1268"), "passing yards are not a box line");

assert(formatLeaderStat("homeRuns Home Runs HR", 4, "2-7, 2 HR") === "4", "HR uses the category value");
assert(formatLeaderStat("ERA Earned Run Average", 0, "1.0 IP, 0 ER") === "0.00", "ERA is two decimals");
assert(formatLeaderStat("strikeouts Strikeouts K", 14, "12.0 IP, 14 K") === "14", "K uses the category value");
assert(formatLeaderStat("avg Batting Average AVG", 0.5, "4-8, 2B, RBI") === ".500", "AVG is a leading-dot average");
assert(formatLeaderStat("RBIs Runs Batted In", 6, "5-12, 6 RBI") === "6", "RBI uses the category value");
assert(formatLeaderStat("runs Runs R", 5, "4-16, 5 R") === "5", "runs uses the category value");
assert(formatLeaderStat("OPS On-Base-Plus-Slugging", 1.25, "5-12, 2 HR") === "1.250", "OPS is three decimals");
assert(formatLeaderStat("passingYards Passing Yards", 1268, "1268") === "1268", "NFL keeps a clean displayValue");
assert(formatLeaderStat("avgGoalsAgainst GAA", 1, "1.00") === "1.00", "GAA stays two decimals");

assert(leaderNoteFromBox("ERA", "1.0 IP, 0 ER, 0 H") === "1.0 IP", "ERA carries innings");
assert(leaderNoteFromBox("strikeouts", "12.0 IP, ER, 4 H, 14 K") === "12.0 IP", "K carries innings");
assert(leaderNoteFromBox("homeRuns", "2-7, 2 HR") == null, "a batting count has no IP note");

const hr = leaderLineFromEspn("homeRuns Home Runs", { displayValue: "2-7, 2 HR, 2 RBI", value: 2 });
assert(hr.line === "2" && !hr.note, "a mixed-up HR row prints the value only");
const era = leaderLineFromEspn("ERA", { displayValue: "1.0 IP, 0 ER, 0 H", value: 0 });
assert(era.line === "0.00" && era.note === "1.0 IP", "ERA prints 0.00 and the innings");

assert(leaderDeskSize("football/nfl").rows === 10, "NFL leaders print a top ten");
assert(leaderDeskSize("football/nfl").categories === 12, "NFL leaders fill the page with more categories");
assert(leaderDeskSize("baseball/mlb").rows === 8, "MLB leaders print more than five");

console.log("newspaper-box-leaders ok");
