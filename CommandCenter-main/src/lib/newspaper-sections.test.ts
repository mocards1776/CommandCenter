/**
 * Run with: node --experimental-strip-types src/lib/newspaper-sections.test.ts
 * from CommandCenter-main/.
 */
import type { GameWrapCard } from "./newspaper-sports.ts";
import { editionCovers, editionCoversResult, isResultCopy } from "./newspaper.ts";
import { buildEdition, isDeskStory, type ClubDesk } from "./newspaper-sections.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function card(partial: Partial<GameWrapCard> & Pick<GameWrapCard, "id" | "headline">): GameWrapCard {
  return {
    favoriteKey: "",
    teamName: "",
    teamHref: "/",
    sportLabel: "NFL",
    leaguePath: "football/nfl",
    dek: null,
    body: null,
    scoreLine: null,
    when: null,
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

assert(!editionCovers("2026-09-27T20:00:00Z", edition), "Sunday afternoon is not Wednesday's news");
assert(!editionCovers("2026-09-28T00:30:00Z", edition), "Sunday night football is a previous paper");
assert(editionCovers("2026-09-29T23:30:00Z", edition), "Tuesday night belongs in Wednesday's edition");
assert(!editionCovers("Sun, Sep 27", edition), "a display string is not a dateline");
assert(
  !editionCoversResult("2026-09-28T21:16:48Z", "2026-09-29"),
  "a Monday afternoon rewrite of Sunday is not Tuesday's result",
);
assert(
  editionCoversResult("2026-09-29T03:30:00Z", "2026-09-29"),
  "Monday night's final is Tuesday's result",
);
assert(
  !isResultCopy({ headline: "Chiefs list Kelce as questionable for Sunday" }),
  "an injury note is news",
);
assert(
  isResultCopy({ headline: "Lions post 31 points for record-setting third time to start 2026" }),
  "a points recap is a result",
);
assert(
  isResultCopy({ headline: "Chiefs' Mahomes perfect on play-action passes in win vs. Dolphins" }),
  "a win story is a result",
);

const weekend = card({
  id: "wire-nfl-weekend",
  headline: "Chiefs beat Dolphins",
  favoriteKey: "nfl-kc",
  followed: true,
  teamName: "Chiefs",
  status: "Final",
  scoreLine: "KC 24 · MIA 10",
  when: "2026-09-27T20:00:00Z",
  body: "Kansas City scored twice in the first half and then ran the clock. ".repeat(3),
});

const tuesday = card({
  id: "news-injury",
  headline: "Chiefs list Kelce as questionable for Sunday",
  favoriteKey: "nfl-kc",
  followed: true,
  teamName: "Chiefs",
  when: "2026-09-29T18:00:00Z",
  dek: "Kansas City will not decide until Friday.",
  body: "Kansas City listed Travis Kelce as questionable with a knee. The club plays Sunday. ".repeat(2),
});

const scheduled = card({
  id: "wire-nfl-next",
  headline: "Chiefs at Ravens",
  favoriteKey: "nfl-kc",
  followed: true,
  status: "7:20 PM ET",
  scoreLine: "KC at BAL",
  when: "2026-10-05T23:20:00Z",
});

const cardinals = card({
  id: "news-cards",
  headline: "Cardinals add a bat for the winter",
  favoriteKey: "mlb-stl",
  followed: true,
  teamName: "Cardinals",
  sportLabel: "MLB",
  leaguePath: "baseball/mlb",
  when: "2026-09-30T15:00:00Z",
  body: "St. Louis spent the offseason meeting on a corner bat. ".repeat(3),
});

assert(!isDeskStory(scheduled), "a future kickoff is a schedule line, not an article");
assert(isDeskStory(tuesday), "a story that names the club is copy");
assert(isDeskStory(weekend), "a final is copy when the date says it is");

const chiefs: ClubDesk = {
  key: "nfl-kc",
  shortName: "Chiefs",
  logo: null,
  leaguePath: "football/nfl",
  record: "2-1",
  standing: "1st in AFC West",
  division: [
    { rank: "1", team: "Chiefs", record: "2-1", gb: "-", me: true },
    { rank: "2", team: "Chargers", record: "2-1", gb: "-", me: false },
  ],
  stats: [{ label: "PF", value: "78" }],
  leaders: [{ name: "Mahomes", line: "8 TD", href: "/sports/nfl/player/1" }],
  upcoming: [{ id: "kc-next", label: "at Ravens", when: "Sun 7:20 PM", detail: "Week 5" }],
};

const cards: ClubDesk = {
  key: "mlb-stl",
  shortName: "Cardinals",
  logo: null,
  leaguePath: "baseball/mlb",
  record: "78-84",
  standing: "3rd in NL Central",
  division: [{ rank: "3", team: "Cardinals", record: "78-84", gb: "8", me: true }],
  stats: [{ label: "AVG", value: ".248" }],
  leaders: [],
  upcoming: [],
};

const paper = buildEdition({
  stories: [weekend, tuesday, scheduled, cardinals],
  clubs: [chiefs, cards],
  edition,
});

const folios = paper.pages.map((page) => page.folio);
assert(folios[0] === "A1", "section A opens the paper");
assert(!folios.some((folio) => folio.startsWith("A") && folio !== "A1"), "section A does not reprint the stories");
assert(folios.includes("NFL1") && folios.includes("MLB1"), "each sport still has a section");

const a = paper.pages[0];
assert(a?.kind === "favorites-front" && a.lead?.id === "news-cards", "the newest story leads, not Sunday's score");
assert(
  a?.kind === "favorites-front" && a.news.some((story) => story.id === "news-injury"),
  "Tuesday's Chiefs story still runs",
);
assert(a?.kind === "favorites-front" && a.news.every((story) => story.id !== "wire-nfl-weekend"), "weekend score stays off A1");
assert(a?.kind === "favorites-front" && a.jumpFolio?.startsWith("MLB"), `the front jumps into the sport, got ${a.jumpFolio}`);

const nfl = paper.pages.find((page) => page.folio === "NFL1");
assert(nfl?.kind === "sport-front", "NFL1 is the football desk");
if (nfl?.kind === "sport-front") {
  assert(nfl.upcoming.some((game) => game.label === "at Ravens"), "the section carries the upcoming schedule");
  assert(!nfl.upcoming.some((game) => /dolphins/i.test(game.label)), "last weekend is not the schedule");
  assert(nfl.clubs[0]?.division.some((row) => row.me && row.team === "Chiefs"), "standings mark your club");
  assert(nfl.clubs[0]?.stats.some((stat) => stat.label === "PF"), "season stats run with the table");
  assert(nfl.articles.every((article) => article.card.id !== "wire-nfl-weekend"), "Sunday's score is not an NFL story");
  assert(nfl.articles.some((article) => article.card.id === "news-injury"), "Tuesday's article is the football news");
}

const mlb = paper.pages.find((page) => page.folio === "MLB1");
assert(mlb?.kind === "sport-front" && mlb.articles.some((article) => article.card.id === "news-cards"), "baseball keeps its own news");

const sundayRewrite = card({
  id: "news-lions-sunday",
  headline: "Lions post 31 points for record-setting third time to start 2026",
  favoriteKey: "nfl-det",
  followed: true,
  teamName: "Lions",
  when: "2026-09-28T21:16:48Z",
  body: "Detroit put up another 30 on Sunday evening and the offense never looked back. ".repeat(2),
});
const mondayNews = card({
  id: "news-kelce",
  headline: "Chiefs list Kelce as questionable for Sunday",
  favoriteKey: "nfl-kc",
  followed: true,
  teamName: "Chiefs",
  when: "2026-09-28T20:26:00Z",
  body: "Kansas City will make the call on Friday. Travis Kelce is the only name on the report. ".repeat(2),
});
const mondayNight = card({
  id: "wire-nfl-mnf",
  headline: "Chiefs beat the Ravens on Monday night",
  favoriteKey: "nfl-kc",
  followed: true,
  teamName: "Chiefs",
  status: "Final",
  scoreLine: "KC 27 · BAL 20",
  when: "2026-09-29T03:30:00Z",
  body: "Kansas City closed it in the fourth quarter. ".repeat(3),
});
const tuesdayPaper = buildEdition({
  stories: [sundayRewrite, mondayNews, mondayNight],
  clubs: [chiefs],
  edition: "2026-09-29",
});
const tuesdayNfl = tuesdayPaper.pages.find((page) => page.folio === "NFL1");
assert(tuesdayNfl?.kind === "sport-front", "Tuesday still opens a football section");
if (tuesdayNfl?.kind === "sport-front") {
  const ids = tuesdayNfl.articles.map((article) => article.card.id);
  assert(!ids.includes("news-lions-sunday"), "Sunday's rewrite does not run on Tuesday");
  assert(ids.includes("news-kelce"), "Monday's injury note is Tuesday's news");
  assert(ids.includes("wire-nfl-mnf"), "Monday night's final is Tuesday's result");
}

console.log("newspaper-sections ok");
