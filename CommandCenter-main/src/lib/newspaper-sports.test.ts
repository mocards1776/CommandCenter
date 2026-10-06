/**
 * Run with: node --experimental-strip-types src/lib/newspaper-sports.test.ts
 * from CommandCenter-main/.
 *
 * Matching lives in newspaper-favorite-match so this file never loads sports.ts
 * (supabase / import.meta.env).
 */
import {
  favoriteKeyFitsPath,
  hayHasName,
  storyMatchesFavorite,
  type FavoriteIdentity,
} from "./newspaper-favorite-match.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function fav(partial: Pick<FavoriteIdentity, "key" | "name" | "shortName"> & Partial<FavoriteIdentity>): FavoriteIdentity {
  return {
    espnPath: "",
    kind: "team",
    ...partial,
  };
}

const STL = fav({ key: "mlb-stl", name: "St. Louis Cardinals", shortName: "Cardinals" });
const MOST = fav({ key: "cfb-missouri-state", name: "Missouri State Football", shortName: "MOST FB" });
const LIONS = fav({ key: "nfl-det", name: "Detroit Lions", shortName: "Lions" });
const WOLVES = fav({ key: "eng-wolves", name: "Wolverhampton", shortName: "Wolves" });

assert(hayHasName("the arizona cardinals lost", "cardinals"), "word-boundary still finds Cardinals");
assert(!hayHasName("arizonacardinals", "cardinals"), "concatenated Cardinals is not a match");
assert(favoriteKeyFitsPath("mlb-stl", "baseball/mlb"), "STL Cards fit MLB");
assert(!favoriteKeyFitsPath("mlb-stl", "football/nfl"), "STL Cards do not fit NFL");
assert(!favoriteKeyFitsPath("cfb-missouri-state", "football/nfl"), "Missouri State does not fit NFL");
assert(!favoriteKeyFitsPath("eng-wolves", "basketball/nba"), "Wolves do not fit the NBA");
assert(!favoriteKeyFitsPath("nfl-det", "football/college-football"), "Lions do not fit CFB");

assert(
  !storyMatchesFavorite(
    {
      headline: "Ben Johnson: Tyson Bagent will start at QB for Bears vs. Packers",
      teamName: "Bears",
      sportLabel: "NFL",
      leaguePath: "football/nfl",
    },
    MOST,
  ),
  "Chicago Bears are not Missouri State",
);
assert(
  !storyMatchesFavorite(
    {
      headline: "Giants beat Cardinals 36-24",
      teamName: "Cardinals",
      sportLabel: "NFL",
      leaguePath: "football/nfl",
      recapGame: {
        away: { id: "22", abbrev: "ARI", name: "Arizona Cardinals", short: "Cardinals" },
        home: { id: "19", abbrev: "NYG", name: "New York Giants", short: "Giants" },
      },
    },
    STL,
  ),
  "Arizona Cardinals are not St. Louis",
);
assert(
  storyMatchesFavorite(
    {
      headline: "Cardinals add a bat for the winter",
      teamName: "St. Louis Cardinals",
      sportLabel: "MLB",
      leaguePath: "baseball/mlb",
    },
    STL,
  ),
  "St. Louis Cardinals still match MLB",
);
assert(
  !storyMatchesFavorite(
    { headline: "Nittany Lions roll in Happy Valley", leaguePath: "football/college-football" },
    LIONS,
  ),
  "Penn State is not Detroit",
);
assert(
  storyMatchesFavorite(
    {
      headline: "Lions hold off the Packers",
      teamName: "Detroit Lions",
      sportLabel: "NFL",
      leaguePath: "football/nfl",
    },
    LIONS,
  ),
  "Detroit Lions still match NFL",
);
assert(
  !storyMatchesFavorite(
    {
      headline: "Timberwolves beat the 76ers",
      teamName: "Minnesota Timberwolves",
      sportLabel: "NBA",
      leaguePath: "basketball/nba",
    },
    WOLVES,
  ),
  "Minnesota is not Wolverhampton",
);
assert(
  storyMatchesFavorite(
    {
      headline: "Wolves hold off Arsenal",
      teamName: "Wolverhampton",
      sportLabel: "EPL",
      leaguePath: "soccer/eng.1",
    },
    WOLVES,
  ),
  "Wolverhampton still matches",
);
assert(
  !storyMatchesFavorite(
    { headline: "Kansas City Royals walk off the Sox", sportLabel: "MLB", leaguePath: "baseball/mlb" },
    STL,
  ),
  "Royals are not the Cardinals",
);

console.log("newspaper-sports ok");
