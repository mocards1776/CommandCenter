/**
 * Run with: node --experimental-strip-types src/lib/cfb-win-probability.test.ts
 * from CommandCenter-main/.
 */
import {
  CFB_REGULATION_SEC,
  cfbWinProbDomainSec,
  cfbWinProbLeader,
  espnRateToPct,
  formatWinPct,
  isLightTeamColor,
  mapCfbWinProbability,
  snapshotFromEspnProbability,
} from "./cfb-win-probability.ts";

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

const plays = [
  { id: "a", period: 1, clock: "15:00" },
  { id: "b", period: 2, clock: "7:26" },
  { id: "c", period: 4, clock: "0:00" },
  { id: "d", period: 5, clock: "0:00" },
];

const points = mapCfbWinProbability(
  [
    { playId: "a", homeWinPercentage: 0.2694, tiePercentage: 0 },
    { playId: "missing", homeWinPercentage: 0.5, tiePercentage: 0 },
    { playId: "b", homeWinPercentage: 0.1317, tiePercentage: 0 },
    { playId: "c", homeWinPercentage: 0.8683, tiePercentage: 0 },
    { playId: "d", homeWinPercentage: 0.42, tiePercentage: 0.01 },
    { playId: "skip", tiePercentage: 0 },
  ],
  plays,
);

assert.equal(points.length, 5);
assert.equal(points[0].elapsedSec, 0);
assert.equal(points[0].homeWinPct, 26.94);
assert.equal(points[2].playId, "b");
assert.equal(points[2].elapsedSec, 1354);
assert.equal(points[3].elapsedSec, CFB_REGULATION_SEC);
assert.ok(points[4].elapsedSec > CFB_REGULATION_SEC, "overtime sits past regulation");
assert.ok(points[1].elapsedSec > 0 && points[1].elapsedSec < 1354, "gap is interpolated");
for (let i = 1; i < points.length; i++) {
  assert.ok(points[i].elapsedSec >= points[i - 1].elapsedSec, "elapsed is monotonic");
}

assert.equal(mapCfbWinProbability(undefined, []).length, 0);
assert.equal(espnRateToPct(0.854), 85.4);
assert.equal(espnRateToPct(85.4), 85.4);
assert.equal(formatWinPct(86.83), "86.8");
assert.equal(formatWinPct(13.17), "13.2");

const snap = snapshotFromEspnProbability({
  homeWinPercentage: 0.1725,
  awayWinPercentage: 0.8275,
  tiePercentage: 0,
});
assert.equal(snap?.homeWinPct, 17.25);
assert.equal(snap?.awayWinPct, 82.75);
assert.equal(formatWinPct(snap!.awayWinPct), "82.8");

const leader = cfbWinProbLeader(
  86.83,
  { abbrev: "MSST", color: "5d1725", logo: null },
  { abbrev: "ALA", color: "9e1b32", logo: "https://example/ala.png" },
);
assert.equal(leader.abbrev, "ALA");
assert.equal(leader.logo, "https://example/ala.png");
assert.equal(formatWinPct(leader.pct), "86.8");

const awayLead = cfbWinProbLeader(
  17.25,
  { abbrev: "ALA", color: "9e1b32" },
  { abbrev: "MSST", color: "5d1725" },
  0,
  82.75,
);
assert.equal(awayLead.abbrev, "ALA");
assert.equal(formatWinPct(awayLead.pct), "82.8");

const even = cfbWinProbLeader(
  50,
  { abbrev: "ALA", color: "9e1b32" },
  { abbrev: "MSST", color: "5d1725" },
  0,
  50,
);
assert.equal(even.even, true);

assert.equal(isLightTeamColor("FFD700"), true);
assert.equal(isLightTeamColor("#9e1b32"), false);
assert.equal(cfbWinProbDomainSec(points.slice(0, 3)), CFB_REGULATION_SEC);
assert.ok(cfbWinProbDomainSec(points) > CFB_REGULATION_SEC, "domain grows in overtime");

console.log("cfb-win-probability.test.ts ok");
