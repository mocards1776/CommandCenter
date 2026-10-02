/**
 * Run with: node --experimental-strip-types src/lib/newspaper-editor.test.ts
 * from CommandCenter-main/.
 */
import type { GameWrapCard } from "./newspaper-sports.ts";
import { fileEditionStories } from "./newspaper.ts";
import { buildEdition, type FavoritesFrontPage } from "./newspaper-sections.ts";
import {
  clearEditorStamps,
  editEdition,
  editorRequest,
  readEditorDesk,
  stampEditorDesk,
} from "./newspaper-editor.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function card(partial: Partial<GameWrapCard> & Pick<GameWrapCard, "id" | "headline">): GameWrapCard {
  return {
    favoriteKey: "",
    teamName: "",
    teamHref: "/",
    sportLabel: "MLB",
    leaguePath: "baseball/mlb",
    dek: null,
    body: null,
    scoreLine: null,
    when: "2026-09-30T04:00:00Z",
    won: null,
    gameHref: null,
    wrapHref: null,
    feedUrl: null,
    gameId: null,
    stats: [],
    leaders: [],
    teamStats: [],
    division: [],
    ...partial,
  };
}

const edition = "2026-09-30";
const copy = (lead: string) => `${lead} `.repeat(Math.ceil(480 / (lead.length + 1)));

const cardsNote = card({
  id: "news-cards-note",
  headline: "Cardinals reliever has season-ending surgery",
  favoriteKey: "mlb-stl",
  teamName: "Cardinals",
  body: copy("The Cardinals said the reliever will be ready for spring training."),
});
const bluesCamp = card({
  id: "news-blues-camp",
  headline: "Blues open training camp with new defensive pairs",
  favoriteKey: "nhl-stl",
  teamName: "Blues",
  leaguePath: "hockey/nhl",
  sportLabel: "NHL",
  body: copy("The Blues skated for the first time this fall in Maryland Heights."),
});
const lionsWin = card({
  id: "news-lions-win",
  headline: "Lions beat the Packers in overtime",
  favoriteKey: "nfl-det",
  teamName: "Lions",
  leaguePath: "football/nfl",
  sportLabel: "NFL",
  body: copy("Detroit won it on a field goal in overtime at Lambeau Field."),
});
const noHitter = card({
  id: "league-no-hitter",
  headline: "Skenes throws first no-hitter of the postseason",
  dek: "Pittsburgh's ace finished the job in the ninth.",
  status: "Final",
  postseason: true,
  body: copy("Paul Skenes threw a no-hitter in the wild-card round on Tuesday night."),
});
const junk = card({
  id: "league-junk",
  headline: "10 things we learned from the wild-card round",
  body: copy("A slideshow of thoughts from around the league."),
});

const stories = [cardsNote, bluesCamp, lionsWin, noHitter, junk];
const front = (stories: GameWrapCard[]) =>
  buildEdition({ stories, clubs: [], edition }).pages.find((p) => p.kind === "favorites-front") as FavoritesFrontPage;

// The request is the rule desk's budget, clipped.
const request = editorRequest(stories, edition);
assert(request.edition === edition, "request carries the edition");
assert(request.candidates.length === stories.length, "every runnable story is a candidate");
assert(request.candidates[0]!.ruleRank === 0, "candidates arrive in rule order");
assert(request.candidates.every((c) => (c.snippet?.length ?? 0) <= 320), "snippets, not bodies");
assert(request.candidates.find((c) => c.id === "news-cards-note")?.desk === "home", "Cardinals are the home desk");
assert(request.candidates.find((c) => c.id === "news-lions-win")?.desk === "followed", "Lions are followed");
assert(request.candidates.find((c) => c.id === "league-no-hitter")?.desk === "league", "a no-hitter is league copy");
assert(request.candidates.find((c) => c.id === "league-no-hitter")?.league === "MLB", "league code rides along");
assert(editorRequest(stories, edition, 2).candidates.length === 2, "the budget is capped");

// The answer is held to the budget.
const ids = request.candidates.map((c) => c.id);
assert(readEditorDesk(null, ids) === null, "no answer, no desk");
assert(readEditorDesk({ lead: "nope", order: ["also-nope"] }, ids) === null, "unknown ids only, no desk");
const desk = readEditorDesk(
  {
    lead: "league-no-hitter",
    second: "news-cards-note",
    third: "news-lions-win",
    order: ["league-no-hitter", "made-up", "news-blues-camp", "news-cards-note"],
    spike: ["league-junk", "league-no-hitter", "made-up"],
    rationale: "A postseason no-hitter is the biggest story in baseball.",
  },
  ids,
)!;
assert(desk.order[0] === "league-no-hitter", "the lead leads");
assert(desk.order.slice(0, 3).join() === "league-no-hitter,news-cards-note,news-lions-win", "front in order");
assert(!desk.order.includes("made-up"), "invented ids drop");
assert(desk.spike.join() === "league-junk", "the lead cannot be spiked, invented spikes drop");
assert(!desk.order.includes("league-junk"), "a spiked story is out of the order");
assert(desk.order.length === ids.length - 1, "unplaced stories keep their place behind the picks");
const greedy = readEditorDesk({ lead: ids[0], order: [], spike: ids, rationale: "" }, ids)!;
assert(greedy.spike.length <= Math.floor(ids.length / 2), "the editor cannot spike the paper away");

// The rule desk's paper, for comparison.
const baseline = front(stories);
assert(baseline.lead?.favoriteKey === "mlb-stl" || baseline.lead?.favoriteKey === "nhl-stl", "home desk leads by rule");

// With the editor's stamps, the big league story leads and the junk is gone.
const stamped = stampEditorDesk(stories, desk);
const edited = buildEdition({ stories: stamped, clubs: [], edition });
const editedFront = edited.pages.find((p) => p.kind === "favorites-front") as FavoritesFrontPage;
assert(editedFront.lead?.id === "league-no-hitter", "the editor can lead with league news");
assert(editedFront.second?.id === "news-cards-note", "the editor's second runs second");
assert(editedFront.third?.id === "news-lions-win", "the editor's third runs third");
assert(edited.favoriteFolioByStory["league-no-hitter"] === "A1", "the league lead is on A1");
const mlb = edited.pages.find((p) => p.kind === "sport-front" && p.focus === "news");
assert(
  mlb?.kind === "sport-front" && !mlb.articles.some((a) => a.card.id === "league-junk"),
  "a spiked story never reaches the sport section",
);
assert(
  mlb?.kind === "sport-front" && mlb.articles.some((a) => a.card.id === "league-no-hitter"),
  "the league lead still runs in its section",
);

// A front pick with no copy does not leave a bare photo on A1.
const thinLead = stampEditorDesk(
  [...stories, card({ id: "league-thin", headline: "Thin item", body: "Short." })],
  { order: ["league-thin", "news-cards-note", "news-lions-win"], spike: [], rationale: "" },
);
assert(front(thinLead).lead?.id !== "league-thin", "a thin pick does not lead");

// When the editor fails, the paper is the rule desk's, unchanged.
const failed = await editEdition(stamped, edition, async () => {
  throw new Error("xAI 500");
});
assert(failed.desk === null, "no desk on failure");
assert(failed.stories.every((c) => c.editorRank == null && !c.editorSpiked), "failure clears stale stamps");
assert(JSON.stringify(front(failed.stories)) === JSON.stringify(baseline), "failure leaves the rule desk's front");
const garbage = await editEdition(stories, edition, async () => ({ lead: 42 }));
assert(garbage.desk === null && JSON.stringify(front(garbage.stories)) === JSON.stringify(baseline), "garbage falls back");
const few = await editEdition(stories.slice(0, 2), edition, async () => {
  throw new Error("should not be asked");
});
assert(few.desk === null, "a thin budget is not worth a call");

// A good answer round-trips through editEdition.
let asked = 0;
const ok = await editEdition(stories, edition, async (req) => {
  asked += 1;
  assert(req.candidates.length === stories.length, "the editor sees the budget");
  return { lead: "league-no-hitter", second: "news-cards-note", third: "news-lions-win", order: [], spike: ["league-junk"], rationale: "x" };
});
assert(asked === 1, "one call per press");
assert(ok.stories.find((c) => c.id === "league-no-hitter")?.editorRank === 0, "the lead is stamped");
assert(ok.stories.find((c) => c.id === "league-junk")?.editorSpiked === true, "the spike is stamped");

// Last edition's stamps do not ride into the next one.
const carried = fileEditionStories({
  fresh: [],
  carried: [{ ...cardsNote, editorRank: 0 }, { ...junk, editorSpiked: true }],
  readKeys: new Set(),
  pressId: "2026-09-30-midday",
});
assert(carried.length === 2, "unread copy carries");
assert(carried.every((c) => c.editorRank == null && !c.editorSpiked), "a holdover is not still the lead");
assert(clearEditorStamps([cardsNote])[0] === cardsNote, "clean copy is left alone");

console.log("newspaper-editor ok");
