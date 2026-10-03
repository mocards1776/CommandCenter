/**
 * Run with: node --experimental-strip-types src/lib/board-top-games.test.ts
 * from CommandCenter-main/.
 */
import {
  BOARD_TOP_TARGET,
  boardFavoriteTeamKeys,
  boardGameIsFavorite,
  selectBoardTopGames,
} from "./board-top-games.ts";

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

type Item = {
  id: string;
  sport: string;
  score: number;
  game: {
    live: boolean;
    final: boolean;
    away: { teamId: number };
    home: { teamId: number };
  };
};

function item(
  id: string,
  score: number,
  state: "pre" | "in" | "post",
  away: number,
  home: number,
  sport = "cfb",
): Item {
  return {
    id,
    sport,
    score,
    game: {
      live: state === "in",
      final: state === "post",
      away: { teamId: away },
      home: { teamId: home },
    },
  };
}

const mizzou = item("mizzou", 15, "pre", 142, 99);
const most = item("most", 12, "in", 2623, 50);
const cards = item("cards", 5, "post", 138, 140, "mlb");
const hot = [200, 100, 90, 80, 70, 60, 50, 40, 10].map((score, i) =>
  item(`heat-${score}`, score, i === 0 ? "pre" : "in", 1000 + i, 2000 + i),
);

const favs = new Set(["cfb:142", "cfb:2623", "mlb:138"]);
const isFav = (g: Item) => boardGameIsFavorite(g, favs);

const picked = selectBoardTopGames([cards, mizzou, most, ...hot], isFav);
assert.equal(picked.length, BOARD_TOP_TARGET);
assert.equal(picked.filter(isFav).length, 3);
assert.equal(picked.some((g) => g.id === "heat-60"), false);
assert.equal(picked.some((g) => g.id === "heat-10"), false);
assert.deepEqual(
  picked.map((g) => g.id),
  ["most", "heat-100", "heat-90", "heat-80", "heat-70", "mizzou", "heat-200", "cards"],
);

// A favorite that also leads the heat list is included once.
const once = selectBoardTopGames([item("mizzou-live", 400, "in", 142, 8), ...hot], isFav, 4);
assert.deepEqual(
  once.map((g) => g.id),
  ["mizzou-live", "heat-100", "heat-90", "heat-200"],
);

// Favorites past the target stay. Heat does not replace them.
const manyFavs = Array.from({ length: 10 }, (_, i) => item(`fav-${i}`, i, "in", 142, i));
const crowded = selectBoardTopGames([...hot, ...manyFavs], isFav, 8);
assert.equal(crowded.length, 10);
assert.equal(crowded.every(isFav), true);

// No favorites playing: the hottest games, not the whole slate.
const heatOnly = selectBoardTopGames(hot, () => false, 3);
assert.deepEqual(
  heatOnly.map((g) => g.id),
  ["heat-100", "heat-90", "heat-200"],
);

// Input order does not decide the fill.
const shuffled = selectBoardTopGames([hot[8]!, hot[0]!, hot[4]!], () => false, 2);
assert.deepEqual(
  shuffled.map((g) => g.id),
  ["heat-70", "heat-200"],
);

const keys = boardFavoriteTeamKeys([
  {
    kind: "team",
    league: "NCAA",
    sport: "Football",
    espnPath: "football/college-football/teams/142",
  },
  {
    kind: "team",
    league: "MLB",
    sport: "Baseball",
    mlbTeamId: 138,
    espnPath: "baseball/mlb/teams/24",
  },
  { kind: "tour", league: "PGA Tour", espnPath: "golf/pga/scoreboard" },
]);
assert.equal(keys.has("cfb:142"), true);
assert.equal(keys.has("mlb:138"), true);
assert.equal(keys.has("mlb:24"), false);
assert.equal(keys.size, 2);

console.log("board-top-games: ok");
