/**
 * Run with: node --experimental-strip-types src/lib/newspaper-athletic-fulltext.test.ts
 */
import { applyAthleticFulltext, athleticArticleUrl, normalizeAthleticUrl } from "./newspaper-athletic-fulltext.ts";
import type { GameWrapCard } from "./newspaper-sports.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const prose =
  "The Cardinals added a starter before the deadline. The deal is pending a physical, and the club has not set a debut. Both the contract and the roster spot were confirmed by people involved in the talks.";

function card(partial: Partial<GameWrapCard>): GameWrapCard {
  return {
    id: "athletic-1",
    favoriteKey: "",
    teamName: "MLB",
    teamHref: "https://www.nytimes.com/athletic/1",
    sportLabel: "MLB",
    leaguePath: "baseball/mlb",
    headline: "A note",
    dek: "Excerpt only.",
    body: "Excerpt only.",
    scoreLine: null,
    when: null,
    won: null,
    gameHref: "https://www.nytimes.com/athletic/123/cardinals",
    wrapHref: "https://www.nytimes.com/athletic/123/cardinals?utm=rss",
    feedUrl: null,
    gameId: null,
    stats: [],
    leaders: [],
    teamStats: [],
    division: [],
    caption: "The Athletic",
    ...partial,
  };
}

const athletic = card({});
const other = card({
  id: "news-1",
  caption: "ESPN",
  wrapHref: "https://www.espn.com/mlb/story/1",
  gameHref: "https://www.espn.com/mlb/story/1",
  body: "ESPN body.",
});

assert(
  normalizeAthleticUrl("https://www.nytimes.com/athletic/123/cardinals?utm=rss") ===
    "https://www.nytimes.com/athletic/123/cardinals",
  "query strings are stripped",
);
assert(athleticArticleUrl(other) === null, "a non-Athletic link is not a full-text key");
const same = applyAthleticFulltext([athletic, other], []);
assert(same[0] === athletic && same[1] === other, "an empty table does not copy the cards");

const filled = applyAthleticFulltext([athletic, other], [
  { url: "https://www.nytimes.com/athletic/123/cardinals", body: prose },
]);
assert(filled[0]!.body === prose, "stored Athletic prose replaces the excerpt");
assert(filled[1] === other, "other cards stay put");
assert(
  applyAthleticFulltext([athletic], [{ url: "https://www.nytimes.com/athletic/123/cardinals", body: "Too short." }])[0] ===
    athletic,
  "a scrap of stored text is ignored",
);

console.log("newspaper-athletic-fulltext ok");
