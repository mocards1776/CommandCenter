/**
 * Run with: node --experimental-strip-types src/lib/newspaper-sections.test.ts
 * from CommandCenter-main/.
 */
import type { GameWrapCard } from "./newspaper-sports.ts";
import { editionCovers, editionCoversResult, isResultCopy } from "./newspaper.ts";
import {
  buildEdition,
  isDeskStory,
  MIN_SECTION_PAGES,
  type ClubDesk,
} from "./newspaper-sections.ts";

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
assert(folios.includes("A2"), "section A has a clubs desk page");
assert(folios.includes("NFL1") && folios.includes("NFL2") && folios.includes("NFL3"), "NFL opens with desk pages");
assert(folios.includes("NFL4") && folios.includes("NFL5"), "NFL has schedule + form pages");
assert(folios.includes("MLB1") && folios.includes("MLB5"), "MLB has a full five-page desk");

const a = paper.pages[0];
assert(a?.kind === "favorites-front" && a.lead?.id === "news-cards", "the newest story leads, not Sunday's score");
assert(
  a?.kind === "favorites-front" && a.news.some((story) => story.id === "news-injury"),
  "Tuesday's Chiefs story still runs",
);
assert(a?.kind === "favorites-front" && a.news.every((story) => story.id !== "wire-nfl-weekend"), "weekend score stays off A1 fresh list");
assert(a?.kind === "favorites-front" && a.jumpFolio === "A2", `the front jumps to clubs desk, got ${a.jumpFolio}`);

const nfl = paper.pages.find((page) => page.folio === "NFL1");
assert(nfl?.kind === "sport-front" && nfl.focus === "news", "NFL1 is the football news page");
if (nfl?.kind === "sport-front") {
  assert(nfl.upcoming.some((game) => game.label === "at Ravens"), "the section carries the upcoming schedule");
  assert(!nfl.upcoming.some((game) => /dolphins/i.test(game.label)), "last weekend is not the schedule");
  assert(nfl.clubs[0]?.division.some((row) => row.me && row.team === "Chiefs"), "standings mark your club");
  assert(nfl.clubs[0]?.stats.some((stat) => stat.label === "PF"), "season stats run with the table");
  assert(nfl.articles.some((article) => article.card.id === "news-injury"), "Tuesday's article is the football news");
  assert(nfl.articles.every((article) => article.card.id !== "wire-nfl-weekend"), "weekend recap is too old for a fresh midweek desk");
}
const nflRecaps = paper.pages.find((page) => page.folio === "NFL2");
assert(nflRecaps?.kind === "sport-front" && nflRecaps.focus === "recaps", "NFL2 is the recaps page");
const nflTeams = paper.pages.find((page) => page.folio === "NFL3");
assert(nflTeams?.kind === "sport-front" && nflTeams.focus === "teams", "NFL3 is the all-teams page");
const nflSched = paper.pages.find((page) => page.folio === "NFL4");
assert(nflSched?.kind === "sport-front" && nflSched.focus === "schedule", "NFL4 is the schedule page");
const nflForm = paper.pages.find((page) => page.folio === "NFL5");
assert(nflForm?.kind === "sport-front" && nflForm.focus === "form", "NFL5 is the club form page");

const mlb = paper.pages.find((page) => page.folio === "MLB1");
assert(mlb?.kind === "sport-front" && mlb.articles.some((article) => article.card.id === "news-cards"), "baseball keeps its own news");
const mlbPlayoffs = paper.pages.find((page) => page.folio === "MLB5");
assert(mlbPlayoffs?.kind === "sport-front" && mlbPlayoffs.focus === "playoffs", "MLB5 is the playoff tree page");
assert((paper.sections.find((s) => s.code === "NFL")?.pages ?? 0) >= MIN_SECTION_PAGES, "NFL section always has at least five pages");
assert((paper.sections.find((s) => s.code === "A")?.pages ?? 0) >= MIN_SECTION_PAGES, "A always has at least five pages");
assert((paper.sections.find((s) => s.code === "MLB")?.pages ?? 0) >= MIN_SECTION_PAGES, "MLB always has at least five pages");
assert(paper.pages.some((page) => page.folio === "NFL6"), "NFL story copy gets its own inside page after the five desk pages");
assert(paper.pages.some((page) => page.kind === "favorites-form"), "Section A pads with club-form pages");

const leagueWire = card({
  id: "league-wire-1",
  headline: "NFL notebook: injuries and Waivers across the league",
  favoriteKey: "",
  followed: false,
  teamName: "League",
  sportLabel: "NFL",
  leaguePath: "football/nfl",
  when: "2026-09-30T14:00:00Z",
  body: "Around the league, clubs shuffled the practice report and the waiver wire. ".repeat(3),
});
assert(isDeskStory(leagueWire), "league wire is desk copy for sport sections");
const withLeague = buildEdition({
  stories: [weekend, tuesday, scheduled, cardinals, leagueWire],
  clubs: [chiefs, cards],
  edition,
});
const aLead = withLeague.pages[0];
assert(
  aLead?.kind === "favorites-front" && aLead.news.every((story) => story.id !== "league-wire-1"),
  "league wire stays off the favorites front",
);
const nflWithLeague = withLeague.pages.find((page) => page.folio === "NFL1");
assert(
  nflWithLeague?.kind === "sport-front" &&
    nflWithLeague.articles.some((article) => article.card.id === "league-wire-1"),
  "league wire fills the sport news page",
);

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
assert((tuesdayPaper.sections.find((s) => s.code === "NFL")?.pages ?? 0) >= MIN_SECTION_PAGES, "Tuesday NFL still has five pages");
const tuesdayNfl = tuesdayPaper.pages.find((page) => page.folio === "NFL1");
assert(tuesdayNfl?.kind === "sport-front", "Tuesday still opens a football section");
if (tuesdayNfl?.kind === "sport-front") {
  const ids = tuesdayNfl.articles.map((article) => article.card.id);
  assert(ids.includes("news-kelce"), "Monday's injury note is Tuesday's news");
  assert(ids.includes("wire-nfl-mnf"), "Monday night's final is Tuesday's result");
  // Two-day lookback from Tuesday still reaches Monday-night / late Sunday rewrite.
  assert(ids.includes("news-lions-sunday"), "late Sunday rewrite still packs Tuesday when in lookback");
}
const tuesdayA = tuesdayPaper.pages[0];
assert(
  tuesdayA?.kind === "favorites-front" &&
    tuesdayA.news.every((story) => story.id !== "news-lions-sunday"),
  "Sunday's rewrite does not lead Tuesday's favorites front",
);

console.log("newspaper-sections ok");
