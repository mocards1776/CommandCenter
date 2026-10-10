/**
 * Run with: node --experimental-strip-types src/lib/nhl-win-probability.test.ts
 * from CommandCenter-main/.
 */
import {
  buildNhlWinProbability,
  nhlHomeWinPct,
  nhlWinProbFromScoreboard,
  parseNhlLiveClock,
  plotNhlWinProbability,
} from "./nhl-win-probability.ts";

const assert = {
  equal(actual: unknown, expected: unknown, msg?: string) {
    if (actual !== expected) throw new Error(`${msg ?? "equal"}: expected ${String(expected)}, got ${String(actual)}`);
  },
  ok(v: unknown, msg?: string) {
    if (!v) throw new Error(msg ?? "ok");
  },
};
let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

test("scoreboard clock", () => {
  assert.equal(parseNhlLiveClock("1:30 - 3rd")?.period, 3);
  assert.equal(parseNhlLiveClock("1:30 - 3rd")?.secondsLeftInPeriod, 90);
  assert.equal(parseNhlLiveClock("4:08 - 2nd")?.secondsLeftInPeriod, 248);
  assert.equal(parseNhlLiveClock("End of 1st")?.period, 1);
  assert.equal(parseNhlLiveClock("End of 1st")?.secondsLeftInPeriod, 0);
  assert.equal(parseNhlLiveClock("0:41 - OT")?.period, 4);
  assert.equal(parseNhlLiveClock("0:41 - OT")?.secondsLeftInPeriod, 41);
  assert.equal(parseNhlLiveClock("Shootout")?.period, 5);
  assert.equal(parseNhlLiveClock("Final"), null);
  assert.equal(parseNhlLiveClock("Final/OT"), null);
});

test("opening faceoff is a small home edge", () => {
  const pct = nhlHomeWinPct({
    awayScore: 0,
    homeScore: 0,
    period: 1,
    secondsLeftInPeriod: 20 * 60,
  });
  assert.ok(pct != null && pct > 51 && pct < 58, String(pct));
});

test("late lead is heavy, a tie in the third is not", () => {
  const lead = nhlHomeWinPct({
    awayScore: 1,
    homeScore: 3,
    period: 3,
    secondsLeftInPeriod: 3 * 60,
  });
  const tied = nhlHomeWinPct({
    awayScore: 2,
    homeScore: 2,
    period: 3,
    secondsLeftInPeriod: 60,
  });
  assert.ok(lead != null && lead > 90, String(lead));
  assert.ok(tied != null && tied > 50 && tied < 60, String(tied));
});

test("power play nudges a tie toward that team", () => {
  const even = nhlHomeWinPct({ awayScore: 1, homeScore: 1, period: 2, secondsLeftInPeriod: 10 * 60 })!;
  const homePp = nhlHomeWinPct({
    awayScore: 1,
    homeScore: 1,
    period: 2,
    secondsLeftInPeriod: 10 * 60,
    powerPlay: "home",
  })!;
  const awayPp = nhlHomeWinPct({
    awayScore: 1,
    homeScore: 1,
    period: 2,
    secondsLeftInPeriod: 10 * 60,
    powerPlay: "away",
  })!;
  assert.ok(homePp > even, `${homePp} > ${even}`);
  assert.ok(awayPp < even, `${awayPp} < ${even}`);
});

test("horn with a lead is decided", () => {
  assert.equal(
    nhlHomeWinPct({ awayScore: 2, homeScore: 4, period: 3, secondsLeftInPeriod: 0 }),
    99.5,
  );
  assert.equal(
    nhlHomeWinPct({ awayScore: 4, homeScore: 2, period: 3, secondsLeftInPeriod: 0 }),
    0.5,
  );
});

test("scoreboard bar hides without a live clock", () => {
  assert.equal(
    nhlWinProbFromScoreboard({
      live: true,
      shortDetail: "1:30 - 3rd",
      away: { score: 1 },
      home: { score: 2 },
    })?.homeWinPct != null,
    true,
  );
  assert.equal(
    nhlWinProbFromScoreboard({
      live: false,
      shortDetail: "Final",
      away: { score: 1 },
      home: { score: 2 },
    }),
    null,
  );
  assert.equal(
    nhlWinProbFromScoreboard({
      live: true,
      shortDetail: "Live",
      away: { score: 1 },
      home: { score: 2 },
    }),
    null,
  );
});

test("play series reaches the horn on a final", () => {
  const points = buildNhlWinProbability({
    live: false,
    final: true,
    awayScore: 1,
    homeScore: 2,
    plays: [
      { id: "a", period: 1, elapsedInPeriod: 0, awayScore: 0, homeScore: 0, powerPlay: null },
      { id: "b", period: 2, elapsedInPeriod: 400, awayScore: 1, homeScore: 1, powerPlay: "home" },
      { id: "c", period: 3, elapsedInPeriod: 800, awayScore: 1, homeScore: 2, powerPlay: null },
    ],
  });
  assert.ok(points.length >= 3, String(points.length));
  assert.equal(points[points.length - 1]!.homeWinPct, 99.5);
  assert.equal(points[points.length - 1]!.elapsedSec, 3600);
  const plot = plotNhlWinProbability(points);
  assert.ok(plot && !plot.future, "final chart fills the game");
});

test("empty plays and no clock produce no chart", () => {
  assert.equal(
    buildNhlWinProbability({
      plays: [],
      live: false,
      final: false,
      awayScore: null,
      homeScore: null,
    }).length,
    0,
  );
});

console.log(`\n${passed} tests passed`);
