/**
 * Run with: node --experimental-strip-types src/lib/sports-board.test.ts
 * from CommandCenter-main/.
 */
import type { GameChip, SportsFavorite, TeamSnapshot } from "./sports.ts";
import {
  BOARD_TIER,
  chipDayOffset,
  isoDayOffset,
  rankBoardFavorites,
  teamBoardTier,
} from "./sports-board.ts";

const assert = {
  equal(actual: unknown, expected: unknown) {
    if (actual !== expected) throw new Error(`expected ${String(expected)}, got ${String(actual)}`);
  },
  deepEqual(actual: unknown, expected: unknown) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) throw new Error(`expected ${b}, got ${a}`);
  },
};

// Sat Oct 3 2026, 7:30 PM Central.
const NOW = new Date("2026-10-04T00:30:00Z");

const chip = (when: string | null, extra: Partial<GameChip> = {}): GameChip => ({
  label: "vs OPP",
  detail: null,
  when,
  won: null,
  ...extra,
});

const snap = (key: string, lastGame: GameChip | null, nextGame: GameChip | null): TeamSnapshot => ({
  key,
  name: key,
  shortName: key,
  abbreviation: key,
  logo: null,
  color: null,
  record: null,
  standing: null,
  lastGame,
  nextGame,
});

const fav = (key: string): SportsFavorite => ({
  key,
  name: key,
  shortName: key,
  sport: "x",
  league: "x",
  espnPath: `x/${key}`,
  kind: "team",
});

assert.equal(chipDayOffset(chip("Sat, Oct 3, 7:00 PM"), NOW), 0);
assert.equal(chipDayOffset(chip("Mon, Oct 5"), NOW), 2);
assert.equal(chipDayOffset(chip("Sun, Sep 27, 2:10 PM"), NOW), -6);
assert.equal(chipDayOffset(chip("Thu, Jan 1"), NOW), 90);
assert.equal(chipDayOffset(chip(null), NOW), null);

assert.equal(isoDayOffset("2026-09-27", NOW), -6);
assert.equal(isoDayOffset("2026-10-03", NOW), 0);

const cardinals = snap("mlb-stl", chip("Sun, Sep 27, 2:10 PM", { won: false }), null);
const blues = snap("nhl-stl", null, chip("Sat, Oct 3, 7:00 PM", { live: true }));
const lions = snap("nfl-det", chip("Sun, Sep 27, 12:00 PM"), chip("Sun, Oct 4, 12:00 PM"));
const wolves = snap("eng-wolves", chip("Sat, Sep 26"), chip("Sat, Oct 17"));
const bluesTonight = snap("nhl-stl", null, chip("Sat, Oct 3, 7:00 PM"));

assert.equal(teamBoardTier(cardinals, NOW), BOARD_TIER.offseason);
assert.equal(teamBoardTier(blues, NOW), BOARD_TIER.live);
assert.equal(teamBoardTier(bluesTonight, NOW), BOARD_TIER.today);
assert.equal(teamBoardTier(lions, NOW), BOARD_TIER.soon);
assert.equal(teamBoardTier(wolves, NOW), BOARD_TIER.inSeason);
assert.equal(teamBoardTier(undefined, NOW), BOARD_TIER.unknown);

const snaps = new Map([cardinals, blues, lions, wolves].map((s) => [s.key, s]));
const ranked = rankBoardFavorites(
  ["mlb-stl", "nhl-stl", "eng-wolves", "nfl-det"].map(fav),
  (f) => teamBoardTier(snaps.get(f.key), NOW),
);
assert.deepEqual(
  ranked.map((f) => f.key),
  ["nhl-stl", "nfl-det", "eng-wolves", "mlb-stl"],
);

const tied = rankBoardFavorites(["a", "b", "c"].map(fav), () => BOARD_TIER.inSeason);
assert.deepEqual(
  tied.map((f) => f.key),
  ["a", "b", "c"],
);

console.log("sports-board: ok");
