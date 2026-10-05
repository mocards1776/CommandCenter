/**
 * Run with: node --experimental-strip-types src/lib/newspaper-saved.test.ts
 * from CommandCenter-main/.
 */
import type { GameWrapCard } from "./newspaper-sports.ts";
import { cardFromSaved, snapshotFromCard, type SavedArticle } from "./newspaper-saved.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const card: GameWrapCard = {
  id: "news-cards-note",
  favoriteKey: "mlb-stl",
  teamName: "Cardinals",
  teamHref: "/mlb/stl",
  sportLabel: "MLB",
  leaguePath: "baseball/mlb",
  headline: "Cardinals reliever has season-ending surgery",
  dek: "A bullpen arm is done for the year.",
  body: "Derrick Everidge | Post-Dispatch St. Louis placed the right-hander on the sixty-day IL. ".repeat(3),
  scoreLine: null,
  when: "2026-10-05T16:00:00Z",
  won: null,
  gameHref: null,
  wrapHref: "https://www.stltoday.com/sports/cardinals/surgery",
  feedUrl: null,
  gameId: null,
  stats: [],
  leaders: [],
  teamStats: [],
  division: [],
  photo: "https://example.com/arm.jpg",
};

const snap = snapshotFromCard(card, "2026-10-05-evening");
assert(snap.storyId === "news-cards-note", "snapshot keeps the story id");
assert(snap.headline === card.headline, "headline");
assert(snap.dek === card.dek, "dek");
assert(snap.body === card.body, "body");
assert(snap.url === card.wrapHref, "url");
assert(snap.image === card.photo, "image");
assert(snap.section === "MLB", "section");
assert(snap.editionDate === "2026-10-05", "edition date from the press id");
assert(snap.source?.toLowerCase().includes("post-dispatch") || snap.byline?.includes("Everidge"), "byline or source");

const row: SavedArticle = {
  id: "row-1",
  savedAt: "2026-10-05T20:00:00Z",
  ...snap,
};
const back = cardFromSaved(row);
assert(back.id === card.id, "reader card keeps the story id");
assert(back.headline === card.headline, "reader headline");
assert(back.body === card.body, "reader body survives the edition");
assert(back.wrapHref === card.wrapHref, "reader url");
assert(back.photo === card.photo, "reader image");
assert(back.sportLabel === "MLB", "reader section");

console.log("newspaper-saved ok");
