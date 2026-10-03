/**
 * Run with: node --experimental-strip-types src/lib/ruwt-slate.test.ts
 * from CommandCenter-main/.
 */
import {
  isRuwtLive,
  isRuwtUpcoming,
  partitionRuwtSlate,
  ruwtTodaysTop,
  ruwtWhyReasons,
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

console.log("ruwt-slate: ok");
