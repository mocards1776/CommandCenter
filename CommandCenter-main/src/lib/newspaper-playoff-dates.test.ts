/**
 * Run with: node --experimental-strip-types src/lib/newspaper-playoff-dates.test.ts
 * from CommandCenter-main/.
 */
import {
  formatPlayoffClock,
  formatPlayoffDate,
  formatSeriesGameLine,
  playoffGameStamp,
} from "./newspaper-playoff-dates.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

assert(formatPlayoffDate("2026-10-06") === "Tue 10/6", "upcoming date is weekday + short date");
assert(formatPlayoffDate("2026-10-03") === "Sat 10/3", "finished date is weekday + short date");
assert(formatPlayoffClock("7:00 PM CDT") === "7:00 PM CT", "CDT becomes CT");
assert(formatPlayoffClock("7:00 PM CST") === "7:00 PM CT", "CST becomes CT");
assert(playoffGameStamp({ date: "2026-10-06", when: "7:00 PM CDT" }) === "Tue 10/6 · 7:00 PM CT", "upcoming stamp");

assert(
  formatSeriesGameLine(
    { gameNumber: 3, date: "2026-10-06", when: "7:00 PM CDT", final: false, live: false },
    "NYY",
    "TB",
  ) === "G3 Tue 10/6 · 7:00 PM CT",
  "upcoming series game prints date and CT",
);
assert(
  formatSeriesGameLine(
    {
      gameNumber: 1,
      date: "2026-10-03",
      when: "7:00 PM CDT",
      final: true,
      live: false,
      awayScore: 0,
      homeScore: 1,
    },
    "NYY",
    "TB",
  ) === "G1 Sat 10/3 · NYY 0, TB 1",
  "final series game prints date and score",
);

console.log("newspaper-playoff-dates ok");
