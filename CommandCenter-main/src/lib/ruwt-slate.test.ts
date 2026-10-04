/**
 * Run with: node --experimental-strip-types src/lib/ruwt-slate.test.ts
 * from CommandCenter-main/.
 */
import {
  isRuwtLive,
  isRuwtUpcoming,
  isScoreStripFavorite,
  partitionRuwtSlate,
  ruwtPinnedTeamKey,
  ruwtTodaysTop,
  ruwtCardReasons,
  ruwtWhyReasons,
  withoutClosestUpset,
  scoreStripItems,
  scoreStripTeamKeys,
} from "./ruwt-slate.ts";

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

type Item = { id: string; score: number; game: { live: boolean; final: boolean } };
const item = (id: string, score: number, state: "pre" | "in" | "post"): Item => ({
  id,
  score,
  game: { live: state === "in", final: state === "post" },
});

// Already ranked by RUWT (score desc): a ranked CFB pregame outranks some live games.
const ranked: Item[] = [
  item("cfb-uga-bama", 120, "pre"),
  item("nhl-stl-chi", 95, "in"),
  item("mlb-final", 90, "post"),
  item("cfb-lsu-ole", 88, "pre"),
  item("nfl-det-gb", 70, "in"),
  item("soccer-wolves", 40, "pre"),
  item("mlb-blowout", 10, "in"),
];

const split = partitionRuwtSlate(ranked);
assert.deepEqual(
  split.live.map((i) => i.id),
  ["nhl-stl-chi", "nfl-det-gb", "mlb-blowout"],
);
assert.deepEqual(
  split.upcoming.map((i) => i.id),
  ["cfb-uga-bama", "cfb-lsu-ole", "soccer-wolves"],
);
assert.deepEqual(
  split.finals.map((i) => i.id),
  ["mlb-final"],
);
assert.equal(split.live.length + split.upcoming.length + split.finals.length, ranked.length);

// Partition never mutates or reorders the ranked input.
assert.deepEqual(
  ranked.map((i) => i.id),
  ["cfb-uga-bama", "nhl-stl-chi", "mlb-final", "cfb-lsu-ole", "nfl-det-gb", "soccer-wolves", "mlb-blowout"],
);

// A feed that flags both live and final counts as final, never live.
const odd = { game: { live: true, final: true } };
assert.equal(isRuwtLive(odd), false);
assert.equal(isRuwtUpcoming(odd), false);
assert.deepEqual(partitionRuwtSlate([odd]).live, []);

const top = ruwtTodaysTop(split, 2);
assert.equal(top.mode, "upcoming");
assert.deepEqual(
  top.items.map((i) => i.id),
  ["cfb-uga-bama", "cfb-lsu-ole"],
);

// Nothing left to start: Today's Top falls back to today's best finals.
const late = partitionRuwtSlate([item("nhl-live", 50, "in"), item("a", 30, "post"), item("b", 20, "post")]);
const lateTop = ruwtTodaysTop(late);
assert.equal(lateTop.mode, "finals");
assert.deepEqual(
  lateTop.items.map((i) => i.id),
  ["a", "b"],
);

assert.deepEqual(partitionRuwtSlate([]), { live: [], upcoming: [], finals: [] });

assert.deepEqual(
  ruwtWhyReasons(["Upcoming", "Your #1 team", "Both teams ranked", "SEC"]),
  ["Your #1 team", "Both teams ranked"],
);
assert.deepEqual(ruwtWhyReasons(["Live", "live", " "]), []);
assert.deepEqual(ruwtWhyReasons(undefined), []);

// Score strip: live wins, and an empty live list does not hide the strip.
const stripLive = scoreStripItems(split);
assert.equal(stripLive.source, "live");
assert.deepEqual(
  stripLive.items.map((i) => i.id),
  ["nhl-stl-chi", "nfl-det-gb", "mlb-blowout"],
);

const quiet = partitionRuwtSlate([
  item("cfb-uga-bama", 120, "pre"),
  item("mlb-final", 90, "post"),
  item("cfb-lsu-ole", 88, "pre"),
]);
const stripTop = scoreStripItems(quiet);
assert.equal(stripTop.source, "upcoming");
assert.deepEqual(
  stripTop.items.map((i) => i.id),
  ruwtTodaysTop(quiet, quiet.upcoming.length).items.map((i) => i.id),
);
assert.equal(stripTop.items.some((i) => i.id === "mlb-final"), false);

// Slate is all final: Today's Top order (partition order). Not live heat,
// and not a favorites / yesterday re-sort — heat flattens decided games.
const night = partitionRuwtSlate([
  item("nhl-today-other", 80, "post"),
  item("nhl-today-fav", 15, "post"),
  item("mlb-today-low", 5, "post"),
]);
const stripFinals = scoreStripItems(night);
assert.equal(stripFinals.source, "finals");
assert.deepEqual(
  stripFinals.items.map((i) => i.id),
  ruwtTodaysTop(night, night.finals.length).items.map((i) => i.id),
);
assert.deepEqual(
  stripFinals.items.map((i) => i.id),
  ["nhl-today-other", "nhl-today-fav", "mlb-today-low"],
);

// A live game keeps finals off the ribbon even when finals outscore it.
const mixed = partitionRuwtSlate([
  item("mlb-final-hot", 200, "post"),
  item("nhl-live", 40, "in"),
  item("cfb-later", 90, "pre"),
]);
const stripMixed = scoreStripItems(mixed);
assert.equal(stripMixed.source, "live");
assert.deepEqual(
  stripMixed.items.map((i) => i.id),
  ["nhl-live"],
);

assert.equal(scoreStripItems(partitionRuwtSlate([])).source, "empty");
assert.deepEqual(scoreStripItems(partitionRuwtSlate([])).items, []);

assert.equal(ruwtPinnedTeamKey({ kind: "tour", league: "PGA Tour", espnPath: "golf/pga/scoreboard" }), null);
assert.equal(
  ruwtPinnedTeamKey({
    kind: "team",
    league: "NHL",
    sport: "Hockey",
    espnPath: "hockey/nhl/teams/19",
  }),
  "nhl:19",
);
assert.equal(
  ruwtPinnedTeamKey({
    kind: "team",
    league: "MLB",
    sport: "Baseball",
    mlbTeamId: 138,
    espnPath: "baseball/mlb/teams/24",
  }),
  "mlb:138",
);
assert.deepEqual(scoreStripTeamKeys("nhl", 19, 9), ["nhl:19", "nhl:9"]);
const pinned = new Set(["nhl:19"]);
assert.equal(isScoreStripFavorite(["nhl:19", "nhl:9"], {}, pinned), true);
assert.equal(isScoreStripFavorite(["nhl:9", "nhl:25"], { "9": 6 }, new Set()), true);
assert.equal(isScoreStripFavorite(["nhl:9", "nhl:25"], { "9": 0 }, new Set()), false);

assert.deepEqual(
  ruwtCardReasons(["Live", "One-score game", "3rd quarter", "Red zone", "Ranked team", "Closest upset"]),
  ["One-score game", "3rd quarter", "Red zone", "Ranked team", "Closest upset"],
);
assert.deepEqual(
  withoutClosestUpset(["One-score game", "Closest upset", "Ranked team"]),
  ["One-score game", "Ranked team"],
);

console.log("ruwt-slate: ok");
