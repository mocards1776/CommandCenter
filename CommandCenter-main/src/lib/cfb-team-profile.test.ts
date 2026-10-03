/**
 * Run with: node --experimental-strip-types src/lib/cfb-team-profile.test.ts
 * from CommandCenter-main/.
 */
import {
  cfbResultsFromFinals,
  cfbRivalryName,
  cfbStreakLabel,
  latestCfpWeekRef,
  mapCfbGameWrap,
  parseCfbCfpWeekRanks,
  parseCfbSeasonStats,
  parseCfbTeamLeaders,
  powerIndexStatIndex,
  readRankValue,
} from "./cfb-team-profile.ts";

const assert = {
  equal(actual: unknown, expected: unknown) {
    if (actual !== expected) {
      throw new Error(`expected ${String(expected)}, got ${String(actual)}`);
    }
  },
  ok(cond: unknown, message: string) {
    if (!cond) throw new Error(message);
  },
};

assert.equal(cfbRivalryName(153, 150), "Victory Bell");
assert.equal(cfbRivalryName("333", "2"), "Iron Bowl");
assert.equal(cfbRivalryName(153, 152), "Rivalry");
assert.equal(cfbRivalryName(153, 87), null);
assert.equal(cfbRivalryName(153, null), null);

const marks = cfbResultsFromFinals([
  { final: true, won: true },
  { final: true, won: true },
  { final: true, won: false },
  { final: false, won: null },
]);
assert.equal(marks.join(""), "WWL");
assert.equal(cfbStreakLabel(marks), "L1");
assert.equal(cfbStreakLabel(["W", "W", "W"]), "W3");
assert.equal(cfbStreakLabel(["W", "T"]), null);

const stats = parseCfbSeasonStats({
  stats: {
    categories: [
      {
        name: "general",
        stats: [{ name: "gamesPlayed", value: 3, displayValue: "3" }],
      },
      {
        name: "scoring",
        stats: [{ name: "totalPointsPerGame", displayValue: "23.3", value: 23.3 }],
      },
      {
        name: "rushing",
        stats: [{ name: "totalYards", displayValue: "1,098", value: 1098 }],
      },
    ],
  },
  opponent: [
    {
      name: "scoring",
      stats: [{ name: "totalPointsPerGame", displayValue: "13.7", value: 13.7 }],
    },
    {
      name: "rushing",
      stats: [{ name: "totalYards", displayValue: "937", value: 937 }],
    },
  ],
});
assert.equal(stats.ppg, "23.3");
assert.equal(stats.oppPpg, "13.7");
assert.equal(stats.ypg, "366.0");
assert.equal(stats.oppYpg, "312.3");
assert.equal(stats.gamesPlayed, 3);
assert.equal(parseCfbSeasonStats(null).ppg, null);

const leaders = parseCfbTeamLeaders(
  {
    leaders: {
      categories: [
        {
          name: "passingLeader",
          leaders: [
            {
              displayValue: "611 YDS",
              team: { id: "99" },
              athlete: { id: "1", displayName: "Someone Else" },
            },
            {
              displayValue: "44/78, 611 YDS, 3 TD",
              team: { id: "153" },
              athlete: {
                id: "4592532",
                displayName: "Billy Edwards Jr.",
                position: { abbreviation: "QB" },
                headshot: { href: "https://example.com/edwards.png" },
              },
            },
          ],
        },
        {
          name: "rushingLeader",
          leaders: [
            {
              displayValue: "33 CAR, 215 YDS",
              team: { id: 153 },
              athlete: { id: "9", displayName: "Benjamin Hall", position: { abbreviation: "RB" } },
            },
          ],
        },
      ],
    },
  },
  "153",
);
assert.equal(leaders.length, 2);
assert.equal(leaders[0]?.name, "Billy Edwards Jr.");
assert.equal(leaders[0]?.key, "pass");
assert.equal(leaders[1]?.label, "Rush");

const sosIdx = powerIndexStatIndex(
  [{ name: "resume", names: ["fpirank", "accomplishmentrank", "avgsosrank"] }],
  "resume",
  "avgsosrank",
);
assert.equal(sosIdx, 2);
assert.equal(readRankValue([51, 49, 64], sosIdx), 64);
assert.equal(readRankValue([51, 49, null], sosIdx), null);

const cfp = parseCfbCfpWeekRanks({
  type: "cfp",
  ranks: [
    { current: 4, team: { $ref: "http://sports.core.api.espn.com/v2/teams/153?lang=en" } },
    { current: 99, team: { id: "333" } },
    { current: 1, team: { id: "333" } },
  ],
});
assert.equal(cfp.get(153), 4);
assert.equal(cfp.get(333), 1);
assert.equal(
  parseCfbCfpWeekRanks({ type: "ap", ranks: [{ current: 1, team: { id: "333" } }] }).size,
  0,
);

const weekRef = latestCfpWeekRef(
  [{ $ref: "http://sports.core.api.espn.com/v2/seasons/2024/rankings/21?lang=en" }],
  {
    type: "cfp",
    rankings: [
      { $ref: "http://example/weeks/11/rankings/21" },
      { $ref: "http://example/weeks/15/rankings/21" },
    ],
  },
);
assert.equal(weekRef, "http://example/weeks/15/rankings/21");
assert.equal(latestCfpWeekRef([{ $ref: "http://example/rankings/1" }], { type: "ap" }), null);

const wrap = mapCfbGameWrap(
  {
    leaders: [
      {
        team: { id: "153" },
        leaders: [
          {
            name: "passingYards",
            leaders: [{ displayValue: "16/28, 232 YDS", athlete: { id: "1", displayName: "Billy Edwards Jr." } }],
          },
          {
            name: "rushingYards",
            leaders: [{ displayValue: "11 CAR, 36 YDS", athlete: { displayName: "Benjamin Hall" } }],
          },
        ],
      },
    ],
    scoringPlays: [
      {
        id: "p1",
        text: "  Aeron Burrell 20 Yd Field Goal  ",
        period: { number: 1 },
        clock: { displayValue: "10:07" },
        team: { id: "153", abbreviation: "unc" },
      },
    ],
    boxscore: {
      teams: [
        {
          team: { id: "153", abbreviation: "UNC" },
          statistics: [{ name: "totalYards", displayValue: "366" }],
        },
        {
          team: { id: "2628", abbreviation: "TCU" },
          statistics: [{ name: "totalYards", label: "Total Yards", displayValue: "280" }],
        },
      ],
    },
  },
  "153",
);
assert.equal(wrap.leaders[0]?.line, "16/28, 232 YDS");
assert.equal(wrap.plays[0]?.text, "Aeron Burrell 20 Yd Field Goal");
assert.equal(wrap.plays[0]?.quarter, "Q1");
assert.equal(wrap.plays[0]?.teamAbbrev, "UNC");
assert.equal(wrap.yards, "366");
assert.equal(wrap.oppYards, "280");

console.log("cfb-team-profile: ok");
