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

const cardsFinal = card({
  id: "wire-401",
  headline: "Cardinals beat Cubs 5-3 behind Gray",
  favoriteKey: "mlb-stl",
  teamName: "Cardinals",
  status: "Final",
  scoreLine: "CHC 3 · STL 5",
  gameId: "401",
  body: copy("Sonny Gray struck out nine as St. Louis won at Busch Stadium."),
});
const bluesWrap = card({
  id: "recap-402",
  headline: "Blues fall to Stars in preseason",
  favoriteKey: "nhl-stl",
  teamName: "Blues",
  leaguePath: "hockey/nhl",
  scoreLine: "STL 1 DAL 3",
  status: "Final",
  gameId: "402",
});

const stories = [cardsNote, bluesCamp, lionsWin, noHitter, junk, cardsFinal, bluesWrap];
const front = (stories: GameWrapCard[]) =>
  buildEdition({ stories, clubs: [], edition }).pages.find((p) => p.kind === "favorites-front") as FavoritesFrontPage;

// The request is the rule desk's news budget, clipped. Wraps ride along as context only.
const request = editorRequest(stories, edition);
assert(request.edition === edition, "request carries the edition");
assert(request.candidates.length === 5, "every runnable news story is a candidate");
assert(request.candidates.every((c) => !/^(wire|recap|recent|wrap)-/.test(c.id)), "no game wrap is in the news budget");
assert(request.games.map((g) => g.id).sort().join() === "recap-402,wire-401", "game wraps arrive as context");
assert(request.games.find((g) => g.id === "wire-401")?.hasCopy === true, "a written wrap can front");
assert(request.games.find((g) => g.id === "recap-402")?.hasCopy === false, "a bare recap cannot");
assert(request.candidates[0]!.ruleRank === 0, "candidates arrive in rule order");
assert(request.candidates.every((c) => (c.snippet?.length ?? 0) <= 320), "snippets, not bodies");
assert(request.candidates.find((c) => c.id === "news-cards-note")?.desk === "home", "Cardinals are the home desk");
assert(request.candidates.find((c) => c.id === "news-lions-win")?.desk === "followed", "Lions are followed");
assert(request.candidates.find((c) => c.id === "league-no-hitter")?.desk === "league", "a no-hitter is league copy");
assert(request.candidates.find((c) => c.id === "league-no-hitter")?.league === "MLB", "league code rides along");
const capped = editorRequest(stories, edition, 2);
assert(capped.candidates.length === 2 && capped.games.length === 2, "the cap is on news; wraps never eat it");

// The answer is held to the budget.
const ids = request.candidates.map((c) => c.id);
const gameIds = request.games.map((g) => g.id);
assert(readEditorDesk(null, ids, gameIds) === null, "no answer, no desk");
assert(readEditorDesk({ front: ["nope"], order: ["also-nope"] }, ids, gameIds) === null, "unknown ids only, no desk");
const desk = readEditorDesk(
  {
    front: ["league-no-hitter", "wire-401", "news-lions-win", "news-cards-note"],
    order: ["league-no-hitter", "made-up", "wire-401", "news-blues-camp", "news-cards-note"],
    spike: ["league-junk", "league-no-hitter", "made-up", "recap-402"],
    rationale: "A postseason no-hitter is the biggest story in baseball.",
  },
  ids,
  gameIds,
)!;
assert(desk.front.join() === "league-no-hitter,wire-401,news-lions-win", "three front slots, news or games");
assert(desk.order[0] === "league-no-hitter", "the editor's news order");
assert(!desk.order.includes("made-up") && !desk.order.includes("wire-401"), "invented ids and games are not ordered");
assert(desk.spike.join() === "league-junk", "fronts, games and invented ids cannot be spiked");
assert(!desk.order.includes("league-junk"), "a spiked story is out of the order");
assert(desk.order.length === ids.length - 1, "unplaced news keeps its place behind the picks");
const greedy = readEditorDesk({ front: [], order: [], spike: ids, rationale: "" }, ids, gameIds)!;
assert(greedy.spike.length <= Math.floor(ids.length / 2), "the editor cannot spike the paper away");

// The rule desk's paper, for comparison.
const baseline = front(stories);
assert(baseline.lead?.favoriteKey === "mlb-stl" || baseline.lead?.favoriteKey === "nhl-stl", "home desk leads by rule");

// With the editor's stamps, the big league story leads, the final runs second, the junk is gone.
const stamped = stampEditorDesk(stories, desk);
assert(stamped.find((c) => c.id === "wire-401")?.editorRank == null, "a wrap is never ranked");
const edited = buildEdition({ stories: stamped, clubs: [], edition });
const editedFront = edited.pages.find((p) => p.kind === "favorites-front") as FavoritesFrontPage;
assert(editedFront.lead?.id === "league-no-hitter", "the editor can lead with league news");
assert(editedFront.second?.id === "wire-401", "the editor can front last night's final");
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

// News reorders inside its own slots; the wraps hold the rule desk's places.
const order = ["news-blues-camp", "news-cards-note", "news-lions-win", "league-no-hitter"];
const reordered = stampEditorDesk(stories, { front: [], order, spike: [], rationale: "" });
const ruleIds = buildEdition({ stories, clubs: [], edition }).pages
  .filter((p): p is FavoritesFrontPage => p.kind === "favorites-front")[0]!.news.map((c) => c.id);
const editedIds = buildEdition({ stories: reordered, clubs: [], edition }).pages
  .filter((p): p is FavoritesFrontPage => p.kind === "favorites-front")[0]!.news.map((c) => c.id);
ruleIds.forEach((id, i) => {
  if (/^(wire|recap)-/.test(id)) assert(editedIds[i] === id, `wrap ${id} keeps its slot`);
});
const newsOnly = editedIds.filter((id) => id.startsWith("news-"));
assert(newsOnly.join() === "news-blues-camp,news-cards-note,news-lions-win", "news runs in the editor's order");

// A front pick with no copy does not leave a bare photo on A1.
const thinLead = stampEditorDesk(
  [...stories, card({ id: "league-thin", headline: "Thin item", body: "Short." })],
  { front: ["league-thin"], order: [], spike: [], rationale: "" },
);
assert(front(thinLead).lead?.id !== "league-thin", "a thin pick does not lead");

// When the editor fails, the paper is the rule desk's, unchanged.
const failed = await editEdition(stamped, edition, async () => {
  throw new Error("xAI 500");
});
assert(failed.desk === null, "no desk on failure");
assert(
  failed.stories.every((c) => c.editorRank == null && c.editorFront == null && !c.editorSpiked),
  "failure clears stale stamps",
);
assert(JSON.stringify(front(failed.stories)) === JSON.stringify(baseline), "failure leaves the rule desk's front");
const garbage = await editEdition(stories, edition, async () => ({ front: 42 }));
assert(garbage.desk === null && JSON.stringify(front(garbage.stories)) === JSON.stringify(baseline), "garbage falls back");
const few = await editEdition([cardsNote, cardsFinal, bluesWrap], edition, async () => {
  throw new Error("should not be asked");
});
assert(few.desk === null, "wraps alone are not worth a call");

// A good answer round-trips through editEdition.
let asked = 0;
const ok = await editEdition(stories, edition, async (req) => {
  asked += 1;
  assert(req.candidates.length === 5 && req.games.length === 2, "the editor sees the budget and the games");
  return { front: ["league-no-hitter"], order: [], spike: ["league-junk"], rationale: "x" };
});
assert(asked === 1, "one call per press");
assert(ok.stories.find((c) => c.id === "league-no-hitter")?.editorFront === 0, "the lead is stamped");
assert(ok.stories.find((c) => c.id === "league-junk")?.editorSpiked === true, "the spike is stamped");
assert(front(ok.stories).lead?.id === "league-no-hitter", "an editor lead with the rest left to the desk");

// Last edition's stamps do not ride into the next one.
const carried = fileEditionStories({
  fresh: [],
  carried: [{ ...cardsNote, editorRank: 0, editorFront: 0 }, { ...junk, editorSpiked: true }],
  readKeys: new Set(),
  pressId: "2026-09-30-midday",
});
assert(carried.length === 2, "unread copy carries");
assert(carried.every((c) => c.editorRank == null && c.editorFront == null && !c.editorSpiked), "a holdover is not still the lead");
assert(clearEditorStamps([cardsNote])[0] === cardsNote, "clean copy is left alone");

console.log("newspaper-editor ok");
