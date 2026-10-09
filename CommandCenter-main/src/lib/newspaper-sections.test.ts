/**
 * Run with: node --experimental-strip-types src/lib/newspaper-sections.test.ts
 * from CommandCenter-main/.
 */
import type { GameWrapCard } from "./newspaper-sports.ts";
import {
  editionCovers,
  editionCoversResult,
  editionDay,
  favoriteDeskWeight,
  fileEditionStories,
  gameWrapCovers,
  isGameWrapStory,
  isResultCopy,
  msUntilNextPress,
  pressEdition,
  previousSaturday,
  splitStoryCopy,
  wireBoardDays,
} from "./newspaper.ts";
import { cleanStoryCopy, isNavSoup, isPeripheralClubStory, killedSource } from "./newspaper-copy.ts";
import { rankStandings } from "./newspaper-box.ts";
import {
  buildEdition,
  comingUpHasClock,
  dedupeStories,
  editorFront,
  essentialsFromDesks,
  HISTORIC_NATIONAL_STATUS,
  insertCoachesFocus,
  isColumnStory,
  isDeskStory,
  isGameRecapCopy,
  isSingleGameRecap,
  isHistoricNationalEvent,
  isHistoricNationalStory,
  isHoldoverGame,
  isMajorStory,
  isPreviewStory,
  isBettingPreview,
  a1ComingUp,
  cannotLeadFront,
  isA1Muted,
  isStaleA1Result,
  isFavoriteGameResult,
  isFavoriteStory,
  isMoScoutCard,
  isSectionAStory,
  mayFrontA1,
  latestClubResultDay,
  pickFrontUnderLead,
  stampFavoriteKeys,
  storyRank,
  sameSectionAStory,
  paginateEditionDesks,
  orderSportSections,
  SECTION_A_TITLE,
  sortComingUp,
  sourceStoryId,
  sportInSeason,
  sportSectionFocuses,
  sportSectionId,
  staleNamedPackage,
  storyBodyForJump,
  type ClubDesk,
} from "./newspaper-sections.ts";
import { sampleNationalDesk } from "./newspaper-national.ts";
import { isInjuryNote } from "./newspaper-sport-desk.ts";

assert(favoriteDeskWeight("mlb-stl") === 100, "Cardinals are home desk");
assert(favoriteDeskWeight("nhl-stl") === 100, "Blues are home desk");
assert(favoriteDeskWeight("cfb-mizzou") === 100, "Mizzou is home desk");
assert(favoriteDeskWeight("nfl-dal") === 45, "Cowboys stay a Section A followed club");
assert(favoriteDeskWeight("nba-phi") < favoriteDeskWeight("nfl-dal"), "76ers do not share the Cowboys desk weight");
assert(
  favoriteDeskWeight("nfl-det") > favoriteDeskWeight("nfl-kc"),
  "Lions outrank Chiefs",
);
assert(
  favoriteDeskWeight("nfl-kc") > favoriteDeskWeight("eng-arsenal"),
  "Chiefs outrank soccer",
);
const split = splitStoryCopy(
  "First sentence ends here. Second sentence keeps going with more copy for the jump. ".repeat(20),
  200,
);
assert(split.teaser.length > 0 && split.rest.length > 0, "long copy splits for a real jump");
assert(
  split.teaser.length + split.rest.length >= 200,
  "split keeps substantially all of the original copy",
);

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function impliedSport(key: string | undefined): { sportLabel: string; leaguePath: string } {
  if (key?.startsWith("mlb-")) return { sportLabel: "MLB", leaguePath: "baseball/mlb" };
  if (key?.startsWith("nhl-")) return { sportLabel: "NHL", leaguePath: "hockey/nhl" };
  if (key?.startsWith("cfb-")) return { sportLabel: "CFB", leaguePath: "football/college-football" };
  if (key?.startsWith("cbb-")) return { sportLabel: "CBB", leaguePath: "basketball/mens-college-basketball" };
  if (key?.startsWith("nba-")) return { sportLabel: "NBA", leaguePath: "basketball/nba" };
  if (key?.startsWith("eng-")) return { sportLabel: "EPL", leaguePath: "soccer/eng.1" };
  return { sportLabel: "NFL", leaguePath: "football/nfl" };
}

function card(partial: Partial<GameWrapCard> & Pick<GameWrapCard, "id" | "headline">): GameWrapCard {
  return {
    favoriteKey: "",
    teamName: "",
    teamHref: "/",
    ...impliedSport(partial.favoriteKey),
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
assert(!editionCovers("2026-09-29T16:00:00Z", edition), "late morning the day before is outside 18 hours");
assert(editionCovers("2026-09-29T17:30:00Z", edition), "afternoon the day before is inside the morning press");
assert(editionCovers("2026-09-29T23:30:00Z", edition), "Tuesday night belongs in Wednesday's edition");
assert(editionCovers("2026-09-30T10:30:00Z", edition), "the hour before the morning press still belongs");
assert(!editionCovers("2026-09-30T12:00:00Z", edition), "after the morning press is the next edition");
assert(!editionCovers("Sun, Sep 27", edition), "a display string is not a dateline");
assert(
  editionCoversResult("2026-09-28T21:16:48Z", "2026-09-29"),
  "a Monday afternoon story is inside Tuesday morning's 18 hours",
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
assert(
  isResultCopy({ headline: "No. 25 Missouri trounces No. 8 Florida 45-17 to snap 9-game skid" }),
  "a trounces + score hed is a result",
);
assert(
  isResultCopy({ headline: "Chourio's 2-run single with 2 outs in 9th lifts Brewers over Padres" }),
  "a walk-off lift is a result",
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
  when: "2026-09-30T10:00:00Z",
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
assert(
  paper.pages.some((p) => p.kind === "sport-front" && p.section === "NFL" && p.focus === "schedule"),
  "NFL still has a schedule page after empty recaps/news drop",
);
assert(
  !paper.pages.some((p) => p.kind === "sport-front" && p.section === "NFL" && p.focus === "form"),
  "NFL club form prints on the standings page, not a folio of its own",
);
assert(folios.includes("MLB1") && folios.includes("MLB2"), "MLB still opens a section");

const a = paper.pages[0];
assert(a?.kind === "favorites-front" && a.lead?.id === "news-cards", "Cardinals desk weight leads Section A over Chiefs copy");
assert(
  a?.kind === "favorites-front" && a.news.some((story) => story.id === "news-injury"),
  "Tuesday's Chiefs story still runs",
);
const formPage = paper.pages.find((page) => page.kind === "favorites-form");
assert(
  formPage?.kind === "favorites-form" && formPage.clubs[0]?.key === "mlb-stl",
  "Section A club form lists Cardinals before Chiefs",
);
assert(
  !paper.pages.some((page) => page.kind === "favorites-clubs" && page.weatherPart === "outlook"),
  "the weather prints on one page; there is no outlook folio",
);
assert(a?.kind === "favorites-front" && a.news.every((story) => story.id !== "wire-nfl-weekend"), "weekend score stays off A1 fresh list");
assert(a?.kind === "favorites-front", "A1 is the favorites front");
assert(
  !a?.jumpFolio,
  "A1 no longer invents a next-page jump — clubs desk is a labeled trail",
);

const nfl = paper.pages.find((page) => page.folio === "NFL1");
assert(nfl?.kind === "sport-front" && nfl.focus === "front", "NFL1 is the football section front");
if (nfl?.kind === "sport-front") {
  assert(nfl.upcoming.some((game) => game.label === "at Ravens"), "the section carries the upcoming schedule");
  assert(!nfl.upcoming.some((game) => /dolphins/i.test(game.label)), "last weekend is not the schedule");
  assert(nfl.clubs[0]?.division.some((row) => row.me && row.team === "Chiefs"), "standings mark your club");
  assert(nfl.clubs[0]?.stats.some((stat) => stat.label === "PF"), "season stats run with the table");
  assert(nfl.articles.some((article) => article.card.id === "news-injury"), "the NFL front still carries the followed club");
  assert(nfl.articles.every((article) => article.card.id !== "wire-nfl-weekend"), "weekend recap is too old for a fresh midweek desk");
}
assert(
  !paper.pages.some((page) => page.kind === "sport-front" && page.section === "NFL" && page.focus === "recaps"),
  "an empty NFL recaps desk is dropped",
);
assert(
  !paper.pages.some((page) => page.kind === "sport-front" && page.section === "NFL" && page.focus === "news"),
  "an empty NFL news desk is dropped after the front consumes the club note",
);
const nflTeams = paper.pages.find((page) => page.kind === "sport-front" && page.section === "NFL" && page.focus === "teams");
assert(nflTeams?.kind === "sport-front", "standings sit with the reference pages");
const nflSched = paper.pages.find((page) => page.kind === "sport-front" && page.section === "NFL" && page.focus === "schedule");
assert(nflSched?.kind === "sport-front", "the schedule is at the back of the section");
assert(
  nflTeams && nflSched && nflSched.sectionPage > nflTeams.sectionPage,
  "standings, then the schedule",
);

const mlb = paper.pages.find((page) => page.folio === "MLB1");
assert(
  mlb?.kind === "sport-front" && mlb.articles.some((article) => article.card.id === "news-cards"),
  "Cardinals copy still leads the MLB section",
);
const mlbPlayoffs = paper.pages.find((page) => page.kind === "sport-front" && page.section === "MLB" && page.focus === "playoffs");
assert(mlbPlayoffs?.kind === "sport-front", "MLB still prints the playoff tree");
assert((paper.sections.find((s) => s.code === "NFL")?.pages ?? 0) >= 3, "NFL keeps a front and the reference desks");
assert(
  (paper.sections.find((s) => s.code === "A")?.pages ?? 0) >= 4,
  "A has a front, weather, club form, and the watch page — no empty cream pads",
);
assert((paper.sections.find((s) => s.code === "MLB")?.pages ?? 0) >= 4, "MLB keeps a front and the reference desks");
assert(
  paper.pages.some((page) => page.kind === "sport-inside" && page.section === "NFL" && page.primary.id === "news-injury") ||
    paper.pages.some((page) => page.kind === "sport-front" && page.section === "NFL" && page.articles.some((a) => a.card.id === "news-injury")),
  "the Chiefs note still has an NFL home",
);
assert(
  paper.pages.filter((page) => page.kind === "favorites-form").length === 1,
  "Section A prints club form on one page of team boxes",
);

const leagueWire = card({
  id: "league-wire-1",
  headline: "NFL notebook: injuries and Waivers across the league",
  favoriteKey: "",
  followed: false,
  teamName: "League",
  sportLabel: "NFL",
  leaguePath: "football/nfl",
  when: "2026-09-30T09:00:00Z",
  body: "Around the league, clubs shuffled the practice report and the waiver wire. ".repeat(8),
});
const leagueShort = card({
  id: "league-wire-2",
  headline: "Bills sign a punter",
  teamName: "Bills",
  when: "2026-09-30T08:30:00Z",
  body: "Buffalo added depth.",
});
const arsenalNews = card({
  id: "news-arsenal",
  headline: "Arteta on the international break",
  favoriteKey: "eng-arsenal",
  followed: true,
  teamName: "Arsenal",
  sportLabel: "EPL",
  leaguePath: "soccer/eng.1",
  when: "2026-09-30T08:00:00Z",
  body: "The Arsenal manager spoke for twenty minutes. ".repeat(12),
});
const arsenalLeague = card({
  id: "league-arsenal",
  headline: "Arsenal and Chelsea split the points",
  teamName: "League",
  sportLabel: "EPL",
  leaguePath: "soccer/eng.1",
  when: "2026-09-30T08:00:00Z",
});
assert(isDeskStory(leagueWire), "league wire is desk copy for sport sections");
const withLeague = buildEdition({
  stories: [weekend, tuesday, scheduled, cardinals, leagueWire, leagueShort, arsenalNews, arsenalLeague],
  clubs: [chiefs, cards],
  edition,
});
assert(
  withLeague.pages.some((page) => page.kind === "sport-inside" && page.section === "NFL"),
  "league story copy gets an inside page after the desk pages",
);
assert(
  withLeague.pages.every(
    (page) => page.kind !== "sport-inside" || (page.primary.id !== "league-wire-2" && page.secondary?.id !== "league-wire-2"),
  ),
  "a one-line item is a brief, never a story page",
);
const allCards = JSON.stringify(withLeague.pages);
assert(!allCards.includes("news-arsenal") && !allCards.includes("league-arsenal"), "Arsenal carries no news");
const aLead = withLeague.pages[0];
assert(
  aLead?.kind === "favorites-front" && aLead.news.every((story) => story.id !== "league-wire-1"),
  "league wire stays off the favorites front",
);
const nflWithLeague = withLeague.pages.filter((page) => page.kind === "sport-front" && page.section === "NFL");
assert(
  nflWithLeague.some((page) => page.kind === "sport-front" && page.articles.some((article) => article.card.id === "league-wire-1")),
  "league wire still runs in the NFL section",
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
assert((tuesdayPaper.sections.find((s) => s.code === "NFL")?.pages ?? 0) >= 3, "Tuesday NFL still has a front and reference desks");
const tuesdayNfl = tuesdayPaper.pages.find((page) => page.folio === "NFL1");
assert(tuesdayNfl?.kind === "sport-front", "Tuesday still opens a football section");
const tuesdayFront = tuesdayPaper.pages[0];
if (tuesdayFront?.kind === "favorites-front") {
  const ids = tuesdayFront.news.map((story) => story.id);
  assert(ids.includes("news-kelce"), "Monday's injury note is Tuesday's news");
  assert(ids.includes("wire-nfl-mnf"), "Monday night's final is Tuesday's result");
}
const tuesdayA = tuesdayPaper.pages[0];
assert(
  tuesdayA?.kind === "favorites-front" &&
    tuesdayA.news.some((story) => story.id === "news-lions-sunday"),
  "Monday afternoon's Lions story is still inside Tuesday morning's 18 hours",
);

// Same-day club notes: Lions copy outranks Chiefs on the favorites desk.
const lionsNote = card({
  id: "news-lions-note",
  headline: "Lions elevate a practice-squad receiver",
  favoriteKey: "nfl-det",
  followed: true,
  teamName: "Lions",
  when: "2026-09-30T10:30:00Z",
  body: "Detroit signed the receiver and will see if he sticks on game day. ".repeat(2),
});
const chiefsNote = card({
  id: "news-chiefs-note",
  headline: "Chiefs shuffle the practice report",
  favoriteKey: "nfl-kc",
  followed: true,
  teamName: "Chiefs",
  when: "2026-09-30T10:15:00Z",
  body: "Kansas City listed two starters as limited for Wednesday. ".repeat(2),
});
const lionsClub: ClubDesk = {
  key: "nfl-det",
  shortName: "Lions",
  logo: null,
  leaguePath: "football/nfl",
  record: "3-0",
  standing: "1st in NFC North",
  division: [],
  stats: [],
  leaders: [],
  upcoming: [],
};
const deskOrder = buildEdition({
  stories: [chiefsNote, lionsNote],
  clubs: [chiefs, lionsClub],
  edition,
});
const deskFront = deskOrder.pages[0];
assert(
  deskFront?.kind === "favorites-front" && deskFront.lead?.id === "news-lions-note",
  "Lions lead Chiefs when both filed the same afternoon",
);

const longLead = card({
  id: "news-long-lead",
  headline: "Cardinals map a winter of roster decisions",
  favoriteKey: "mlb-stl",
  followed: true,
  teamName: "Cardinals",
  sportLabel: "MLB",
  leaguePath: "baseball/mlb",
  when: "2026-09-30T10:45:00Z",
  body: "St. Louis spent the afternoon in meetings that stretched past dusk. ".repeat(40),
});
const withJump = buildEdition({
  stories: [longLead, lionsNote],
  clubs: [cards, lionsClub],
  edition,
});
const jumpFront = withJump.pages[0];
assert(
  jumpFront?.kind === "favorites-front" && Boolean(jumpFront.leadContinue),
  "a long lead gets a real continuation folio",
);
const cont = withJump.pages.find((page) => page.kind === "favorites-continue");
assert(cont?.kind === "favorites-continue", "continuation page is filed after the clubs desk");
if (cont?.kind === "favorites-continue") {
  assert(cont.continuedFrom === "A1", "continuation cites the front");
  assert(cont.jumps[0]!.rest.length > 80, "continuation carries the rest of the body");
  assert(cont.jumps[0]!.card.id === "news-long-lead", "the lead's jump comes first");
  assert(
    jumpFront?.kind === "favorites-front" && jumpFront.leadContinue === cont.folio,
    "front jump lands on the continuation folio",
  );
}
assert(withJump.pages[1]?.kind === "favorites-clubs", "A2 is the weather page");
assert(cont?.folio === "A3", "the A1 jump continues on A3, right after the weather");

const twice = buildEdition({
  stories: [lionsNote, { ...lionsNote, id: "wrap-lions-note" }],
  clubs: [lionsClub],
  edition,
});
const twiceFront = twice.pages[0];
assert(
  twiceFront?.kind === "favorites-front" && twiceFront.second?.headline !== twiceFront.lead?.headline,
  "the front never runs the same story twice",
);

const seasonFinale = card({
  id: "news-cards-finale",
  headline: "Brewers beat Cardinals 6-4 in the season finale",
  favoriteKey: "mlb-stl",
  followed: true,
  teamName: "Cardinals",
  sportLabel: "MLB",
  leaguePath: "baseball/mlb",
  when: "2026-09-27T21:00:00Z",
  body: "MILWAUKEE -- The Cardinals closed the year in Milwaukee. ".repeat(12),
});
const quietClub = buildEdition({
  stories: [lionsNote, seasonFinale],
  clubs: [cards, lionsClub],
  edition,
});
const quietFront = quietClub.pages[0];
assert(
  quietFront?.kind === "favorites-front" &&
    ![quietFront.lead, quietFront.second, quietFront.third].some((c) => c?.id === "news-cards-finale") &&
    !JSON.stringify(quietClub.pages).includes("news-cards-finale"),
  "last week's finale stays out of this edition",
);

const moItem = (i: number) => ({
  id: `mo-${i}`,
  source: "Missouri Independent",
  headline: `Statehouse story number ${i}`,
  url: `https://missouriindependent.com/${i}`,
  kind: "story" as const,
  photo: null,
  dek: null,
  when: null,
});
const withDesks = buildEdition({
  stories: [cardinals, lionsNote],
  clubs: [cards, chiefs, lionsClub],
  edition,
  playerPaths: ["football/nfl"],
  missouri: { scout: null, items: Array.from({ length: 30 }, (_, i) => moItem(i)), listen: [moItem(99)] },
});
const deskFolios = withDesks.pages.map((page) => page.folio);
const moPages = withDesks.pages.filter((page) => page.kind === "missouri");
assert(moPages.length === 3 && moPages[0]!.folio === "B1", "Missouri files as section B");
assert(
  deskFolios.indexOf("B1") > deskFolios.indexOf("A1") && deskFolios.indexOf("B1") < deskFolios.indexOf("NFL1"),
  "Missouri runs between Section A and sports",
);
assert(
  moPages[0]?.kind === "missouri" && moPages[0].listen.length === 1 && moPages[1]?.kind === "missouri" && !moPages[1].listen.length,
  "only the Missouri front carries the listen rail",
);
assert(withDesks.sections.some((s) => s.code === "B" && s.folio === "B1"), "Missouri gets section B");
assert(!withDesks.pages.some((p) => p.kind === "national"), "no national row, no National News section");

const withNational = buildEdition({
  stories: [cardinals, lionsNote],
  clubs: [cards, chiefs, lionsClub],
  edition,
  missouri: { scout: null, items: [moItem(1)], listen: [] },
  national: sampleNationalDesk("2026-09-30-morning"),
});
const natPages = withNational.pages.filter((p) => p.kind === "national");
assert(natPages.length >= 2 && natPages[0]!.folio === "B1" && natPages[1]!.folio === "B2", "National News files as B1 then B2");
assert(natPages[0]!.stories[0]!.id === "cl-1", "B1 opens on the desk lead");
assert(natPages.every((p) => p.kind === "national" && p.stories.length >= 1), "every national folio has a lead story");
assert(
  natPages.reduce((n, p) => n + (p.kind === "national" ? p.stories.length : 0), 0) === 14,
  "height packing keeps every national story",
);
assert(natPages[0]!.jumpFolio === "B2", "B1 turns to B2");
assert(
  withNational.pages.find((p) => p.kind === "missouri")?.folio === "C1",
  "Missouri yields B to National News and becomes C",
);
const natAt = withNational.pages.findIndex((p) => p.kind === "national");
const moAt = withNational.pages.findIndex((p) => p.kind === "missouri");
const nflAt = withNational.pages.findIndex((p) => p.folio === "NFL1");
assert(natAt > 0 && natAt < moAt && moAt < nflAt, "A, then National, then Missouri, then sports");
assert(withNational.sections.some((s) => s.code === "B" && s.title === "National News" && s.pages === natPages.length), "section list names National News");
assert(
  withNational.sections.find((s) => s.code === "B")?.stories === 14,
  "section B counts every national story",
);
const shortNational = buildEdition({
  stories: [cardinals, lionsNote],
  clubs: [cards, chiefs, lionsClub],
  edition,
  national: { ...sampleNationalDesk("2026-09-30-morning"), stories: sampleNationalDesk("2026-09-30-morning").stories.slice(0, 8) },
});
assert(shortNational.pages.filter((p) => p.kind === "national").length >= 1, "a shorter desk still prints National News");
assert(!buildEdition({ stories: [lionsNote], clubs: [lionsClub], edition }).pages.some((p) => p.kind === "national"), "empty national hides");

const nflPlayers = withDesks.pages.find((page) => page.kind === "sport-front" && page.section === "NFL" && page.focus === "players");
assert(nflPlayers?.kind === "sport-front", "a sport with followed players gets a players desk");
assert(
  !withDesks.pages.some((page) => page.kind === "sport-front" && page.section === "MLB" && page.focus === "players"),
  "no players page without followed players in the league",
);
assert(!buildEdition({ stories: [lionsNote], clubs: [lionsClub], edition }).pages.some((p) => p.kind === "missouri"), "no desk, no section");

const offPaper = buildEdition({ stories: [chiefsNote], clubs: [chiefs], edition, offseason: ["football/nfl"] });
const offDesks = offPaper.pages.filter((p) => p.kind === "sport-front" && p.path === "football/nfl");
assert(
  offDesks.map((p) => (p.kind === "sport-front" ? `${p.folio}:${p.focus}` : "")).join(",") ===
    "NFL1:front,NFL2:opener,NFL3:teams",
  "an offseason section runs a front, the countdown and last season's tables — no empty news folio",
);
assert(
  offDesks.every((p) => p.kind === "sport-front" && p.offseason),
  "offseason desks know they are between seasons",
);
const offTurn = offDesks[0]?.kind === "sport-front" ? offDesks[0].turn : null;
assert(offTurn?.folio === "NFL2" && offTurn.focus === "opener", "the front turns to the countdown");
const offTail = offDesks.at(-1);
assert(offTail?.kind === "sport-front" && offTail.turn === null, "the last desk has no turn line");
const offWrapOnly = buildEdition({
  stories: [
    card({
      id: "wrap-off-only",
      headline: "Chiefs close the books",
      favoriteKey: "nfl-kc",
      followed: true,
      sportLabel: "NFL",
      leaguePath: "football/nfl",
      status: "Final",
      scoreLine: "KC 30 · LV 27",
      gameId: "off-only",
      when: "2026-09-29T20:15:00Z",
      body: "Kansas City finished the season in Las Vegas. ".repeat(8),
    }),
  ],
  clubs: [chiefs],
  edition,
  offseason: ["football/nfl"],
});
assert(
  !offWrapOnly.pages.some((p) => p.kind === "sport-front" && p.section === "NFL" && p.focus === "news"),
  "offseason with no leftover notes does not print an empty news folio",
);

const bluesPreview = card({
  id: "news-blues-preview",
  favoriteKey: "nhl-stl",
  teamName: "Blues",
  sportLabel: "NHL",
  leaguePath: "hockey/nhl",
  headline: "Stars host the Blues to start 2026 season",
  body: "St. Louis Blues (0-0-0) at Dallas Stars (0-0-0). BOTTOM LINE: The Stars open the season at home. ".repeat(6),
  when: "2026-09-29T20:00:00Z",
});
const cardsColumn = card({
  id: "news-cards-column",
  favoriteKey: "mlb-stl",
  teamName: "Cardinals",
  sportLabel: "MLB",
  leaguePath: "baseball/mlb",
  headline: "Hochman: Gorman, Baez and Bohm and the Cardinals' infield",
  body: "The Cardinals have choices to make at third base this winter. ".repeat(12),
  when: "2026-09-29T20:00:00Z",
});
assert(isPreviewStory(bluesPreview) && !isPreviewStory(cardsColumn), "a wire preview is a preview; a column is not");
const previewFront = buildEdition({ stories: [bluesPreview, cardsColumn], clubs: [], edition }).pages.find(
  (p) => p.folio === "A1",
);
assert(
  previewFront?.kind === "favorites-front" && previewFront.lead?.id === "news-cards-column",
  "a preview of tomorrow's game never leads the front",
);

const at = (iso: string) => pressEdition(new Date(iso));
assert(at("2026-10-01T10:30:00Z").id === "2026-09-30-evening", "before 6 a.m. you still hold last night's paper");
assert(editionDay(new Date("2026-10-01T10:30:00Z")) === "2026-09-30", "the dateline rolls at the morning press");
assert(at("2026-10-01T11:30:00Z").id === "2026-10-01-morning" && at("2026-10-01T11:30:00Z").label === "Morning Edition", "6 a.m. is the morning edition");
assert(at("2026-10-01T17:30:00Z").id === "2026-10-01-midday" && at("2026-10-01T17:30:00Z").next === "5 p.m.", "noon is the midday edition");
assert(at("2026-10-02T20:16:00Z").id === "2026-10-02-midday" && at("2026-10-02T20:16:00Z").label === "Midday Edition", "mid-afternoon Central is still the midday edition");
assert(at("2026-10-01T22:30:00Z").id === "2026-10-01-evening" && at("2026-10-01T22:30:00Z").next === "6 a.m.", "5 p.m. is the evening edition");
const untilNoon = msUntilNextPress(new Date("2026-10-01T11:30:00Z"));
assert(untilNoon > 5 * 3_600_000 && untilNoon < 6 * 3_600_000, "the morning paper holds until noon");

const evening = "2026-09-30-evening";
const eveningPaper = buildEdition({
  stories: [
    card({
      id: "league-evening",
      headline: "Around the league on Wednesday afternoon",
      leaguePath: "football/nfl",
      when: "2026-09-30T18:00:00Z",
      body: "Clubs shuffled the report. ".repeat(8),
    }),
  ],
  clubs: [chiefs],
  edition: evening,
  missouri: { scout: null, items: [moItem(1)], listen: [] },
});
assert(eveningPaper.pages[0]?.kind === "favorites-front", "noon and evening still open on Section A");
assert(
  eveningPaper.pages.some((page) => page.kind === "missouri" && page.folio === "B1"),
  "Missouri is section B in the afternoon paper",
);
const eveningNfl = eveningPaper.pages.find((page) => page.folio === "NFL1");
assert(eveningNfl?.kind === "sport-front" && eveningNfl.focus === "front", "afternoon sports still open on a section front");
assert(
  !eveningPaper.pages.some((page) => page.kind === "sport-inside"),
  "afternoon sports stay on stats and graphics",
);

const filed = fileEditionStories({
  fresh: [
    card({ id: "fresh", headline: "Just filed", when: "2026-09-30T04:00:00Z", wrapHref: "https://example.com/fresh" }),
    card({ id: "seen", headline: "Already on screen", when: "2026-09-30T04:00:00Z", wrapHref: "https://example.com/seen" }),
    card({ id: "old-fresh", headline: "Last week", when: "2026-09-20T04:00:00Z", wrapHref: "https://example.com/old" }),
  ],
  carried: [
    card({ id: "kept", headline: "Unread from noon", when: "2026-09-29T20:00:00Z", wrapHref: "https://example.com/kept" }),
    card({ id: "stale", headline: "Unread from last week", when: "2026-09-20T04:00:00Z", wrapHref: "https://example.com/stale" }),
    card({ id: "read-carry", headline: "Read at noon", when: "2026-09-30T04:00:00Z", wrapHref: "https://example.com/read-carry" }),
  ],
  readKeys: new Set(["https://example.com/seen", "https://example.com/read-carry"]),
  pressId: edition,
});
assert(filed.some((story) => story.id === "fresh"), "a story inside 18 hours is filed");
assert(!filed.some((story) => story.id === "seen"), "a story already on screen stays out");
assert(!filed.some((story) => story.id === "old-fresh"), "last week does not file as fresh");
assert(filed.some((story) => story.id === "kept" && story.holdover), "an unread story carries into the next edition");
const heldWrap = card({
  id: "recap-held",
  headline: "Blues lose 6-1",
  holdover: true,
  body: "Dallas scored six. The Blues scored one. ".repeat(20),
  editorFront: 0,
});
const heldNews = card({
  id: "news-held",
  headline: "Cardinals note",
  holdover: true,
  favoriteKey: "mlb-stl",
  body: "The Cardinals named a pitcher. ".repeat(20),
  editorFront: 1,
});
assert(isHoldoverGame(heldWrap), "a carried recap is a holdover game");
assert(!isHoldoverGame(heldNews), "holdover news is not a holdover game");
assert(
  editorFront([heldWrap, heldNews]).map((c) => c.id).join() === "news-held",
  "editorFront drops a holdover wrap and keeps holdover news",
);
assert(!filed.some((story) => story.id === "stale"), "an unread story older than a day and a half does not carry");
assert(!filed.some((story) => story.id === "read-carry"), "a read story does not carry");

const yardbarker =
  "Home Quizzes My Quiz Activity MY FAVORITES Add Sports/Teams SPORTS NFL NFL Home Arizona Cardinals Atlanta Falcons Baltimore Ravens Buffalo Bills Carolina Panthers Chicago Bears Cincinnati Bengals Cleveland Browns Dallas Cowboys Denver Broncos Detroit Lions";
assert(isNavSoup(yardbarker), "a site menu is not a story");
assert(
  !isNavSoup("The St. Louis Cardinals closed the book on their August 3 trade with the Arizona Diamondbacks on Thursday."),
  "a sentence is the story",
);
assert(!isNavSoup("Quick Friday update. ".repeat(12)), "a punctuated roundup is copy");
const menuStory = card({
  id: "menu",
  headline: "Cardinals complete a trade",
  dek: "The Cardinals named the player to be named later.",
  body: yardbarker,
});
assert(!storyBodyForJump(menuStory).toLowerCase().includes("quiz"), "the front does not print the menu");
assert(storyBodyForJump(menuStory).includes("player to be named later"), "the dek stands in for a menu");

assert(killedSource("https://www.yardbarker.com/mlb/cardinals"), "Yardbarker is not a source");
assert(killedSource("https://viralsportsnews.com/cardinals-trade"), "Viral Sports News is not a source");
assert(!killedSource("https://www.stltoday.com/sports/cardinals"), "the Post-Dispatch stays");

const lifted = cleanStoryCopy(
  "Matthew DeFranks | Post-Dispatch By the most important measures, the Blues top line was at the top of the NHL.",
);
assert(lifted.author === "Matthew DeFranks", "the author moves onto the credit line");
assert(lifted.text.startsWith("By the most important measures"), "the drop cap starts on the story");

const cut = cleanStoryCopy(
  "The Cardinals named right-hander Brian Curley. MORE MUST-READS: Chad Tracy seems to have lost a locker.",
);
assert(cut.text.startsWith("The Cardinals named right-hander Brian Curley"), "the story stops before the must-reads");
assert(!/must-reads/i.test(cut.text), "a must-read rail is not the story");

const spliced = cleanStoryCopy(
  "Jiříček has a long way to go. WE ASKED OUR REPORTERS what one NHL rule they would change Lauren Morales-Jones and Jorge Ribas It’s nice to hear. Now, it’s time to find out if Jiříček can back it up.",
);
assert(!/asked our reporters/i.test(spliced.text), "an Athletic module is not part of the story");
assert(spliced.text.includes("Now, it’s time to find out"), "the story resumes after the module");
const links = cleanStoryCopy("Crochet struck out Spencer Jones. Key links: Mega-preview | Bracket | Schedule Jump.");
assert(links.text === "Crochet struck out Spencer Jones.", "an ESPN link rail is cut");

const wednesdayPackage = card({
  id: "league-wc",
  headline: "2026 MLB wild-card series Day 2: Takeaways, analysis",
  dek: "Three teams sealed their spots in the division series on Wednesday. Relive all the action.",
  leaguePath: "baseball/mlb",
  when: "2026-10-02T02:00:00Z",
  body: "A refreshed package of Wednesday’s games. ".repeat(20),
});
assert(
  staleNamedPackage(wednesdayPackage, "2026-10-02-morning"),
  "a Wednesday takeaways package does not run in Friday’s morning edition",
);
assert(
  !buildEdition({
    stories: [wednesdayPackage],
    clubs: [cards],
    edition: "2026-10-02",
  }).pages.some((page) => JSON.stringify(page).includes("wild-card")),
  "the stale package never gets a folio",
);
const secFirst = rankStandings([
  { name: "American", columns: ["W"], rows: [] },
  { name: "Big Ten", columns: ["W"], rows: [] },
  { name: "SEC", columns: ["W"], rows: [] },
  { name: "ACC", columns: ["W"], rows: [] },
]);
assert(secFirst.map((g) => g.name).join(",") === "SEC,Big Ten,ACC,American", "the SEC table prints first");

assert(
  isPeripheralClubStory({
    headline: "Perryville youth, family treated to on-field experience",
    dek: "Hunter Rogers met Cardinals catcher Leo Bernal.",
    teamName: "Cardinals",
  }),
  "a fan feature that never names the club is not a Cardinals story",
);
assert(
  !isPeripheralClubStory({
    headline: "Cardinals catcher Leo Bernal signs a ball for a Perryville youth",
    teamName: "Cardinals",
  }),
  "a story that names the club stays",
);

const wrapAndRss = dedupeStories([
  card({
    id: "wire-college-football-401856708",
    headline: "No. 25 Missouri trounces No. 8 Florida 45-17 to snap 9-game skid against Top 25 opponents",
    favoriteKey: "cfb-mizzou",
    followed: true,
    teamName: "Mizzou FB",
    sportLabel: "CFB",
    leaguePath: "football/college-football",
    gameId: "401856708",
    wrapKind: "espn",
    status: "Final",
    scoreLine: "MIZ 45 · FLA 17",
    wrapHref: "https://www.espn.com/college-football/game/_/gameId/401856708",
    body: "Missouri scored early and kept scoring in Columbia. ".repeat(20),
  }),
  card({
    id: "wrap-stltoday-mizzou-ap",
    headline: "Mizzou snaps skid, beats Florida 45-17 in Homecoming",
    favoriteKey: "cfb-mizzou",
    teamName: "Mizzou FB",
    sportLabel: "CFB",
    leaguePath: "football/college-football",
    wrapHref: "https://www.stltoday.com/sports/college/mizzou/article_ap-florida.html",
    feedUrl: "https://www.stltoday.com/search/?f=rss&c=sports/college/mizzou*",
    body: "The Associated Press recap of Missouri 45, Florida 17. ".repeat(16),
  }),
  card({
    id: "wrap-stltoday-hochman",
    headline: "Hochman: How 2 runs catapulted Mizzou’s Jamal Roberts among best RBs in SEC",
    favoriteKey: "cfb-mizzou",
    teamName: "Mizzou FB",
    sportLabel: "CFB",
    leaguePath: "football/college-football",
    wrapHref: "https://www.stltoday.com/sports/column/benjamin-hochman/article_b13e.html",
    feedUrl: "https://www.stltoday.com/search/?f=rss&c=sports/college/mizzou*",
    body: "Benjamin Hochman on Jamal Roberts after the Florida game. ".repeat(16),
  }),
]);
assert(isColumnStory({
  id: "col",
  headline: "Hochman: a column",
  favoriteKey: "",
  teamName: "",
  teamHref: "/",
  sportLabel: "CFB",
  leaguePath: null,
  dek: null,
  body: null,
  scoreLine: null,
  when: null,
  won: null,
  gameHref: null,
  wrapHref: "https://www.stltoday.com/sports/column/benjamin-hochman/x.html",
  feedUrl: null,
  gameId: null,
  stats: [],
  leaders: [],
  teamStats: [],
  division: [],
}), "a Hochman URL is a column");
assert(
  wrapAndRss.length === 2 && wrapAndRss.some((c) => c.id === "wire-college-football-401856708") && wrapAndRss.some((c) => c.id === "wrap-stltoday-hochman"),
  "one Mizzou-Florida recap stays; the Hochman column is a separate piece",
);
assert(!wrapAndRss.some((c) => c.id === "wrap-stltoday-mizzou-ap"), "the AP recap of the same game is spiked");

const sameUrl = dedupeStories([
  card({
    id: "news-1",
    headline: "Chiefs list Thornton as doubtful",
    favoriteKey: "nfl-kc",
    wrapHref: "https://www.espn.com/nfl/story/_/id/50104571/chiefs-thornton",
    body: "Kansas City will be without Tyquan Thornton. ".repeat(12),
  }),
  card({
    id: "news-1-dup",
    headline: "Chiefs WR Thornton doubtful vs. the next opponent",
    favoriteKey: "nfl-kc",
    wrapHref: "https://www.espn.com/nfl/story/_/id/50104571/chiefs-thornton?utm_source=rss",
    body: "A shorter ESPN rewrite of the Thornton note. ".repeat(8),
  }),
]);
assert(sameUrl.length === 1 && sameUrl[0]!.id === "news-1", "the same ESPN URL files once");

const jumpOnly = buildEdition({
  stories: [
    card({
      id: "wire-cfb-one",
      headline: "Missouri trounces Florida 45-17 to snap a long skid",
      favoriteKey: "cfb-mizzou",
      followed: true,
      teamName: "Mizzou",
      sportLabel: "CFB",
      leaguePath: "football/college-football",
      gameId: "401856708",
      wrapKind: "espn",
      status: "Final",
      scoreLine: "MIZ 45 · FLA 17",
      when: "2026-09-29T20:00:00Z",
      body: "Missouri scored in every quarter in Columbia on Saturday. ".repeat(30),
    }),
    card({
      id: "rss-cfb-same",
      headline: "Mizzou beats Florida 45-17 and snaps the skid",
      favoriteKey: "cfb-mizzou",
      followed: true,
      teamName: "Mizzou",
      sportLabel: "CFB",
      leaguePath: "football/college-football",
      when: "2026-09-29T22:00:00Z",
      wrapHref: "https://www.stltoday.com/sports/college/mizzou/ap-recap.html",
      body: "The Associated Press recap of the same Saturday night. ".repeat(24),
    }),
  ],
  clubs: [cards],
  edition,
});
const aIds = jumpOnly.pages
  .filter((p) => p.section === "A")
  .flatMap((p) => {
    if (p.kind === "favorites-front") return [p.lead, p.second, p.third, ...p.briefs];
    if (p.kind === "favorites-inside") return [p.primary, p.secondary, ...p.briefs];
    if (p.kind === "favorites-continue") return p.jumps.map((j) => j.card);
    return [];
  })
  .filter(Boolean)
  .map((c) => c!.id);
assert(aIds.filter((id) => id === "rss-cfb-same").length === 0, "the same game does not reprint as a second Section A story");
assert(aIds.includes("wire-cfb-one"), "the wrap still runs in Section A");

// Real 2026-10-05 duplicates: wrap + highlight clip + second write-up of the same game.
const cowboysWrap = card({
  id: "wire-nfl-401872967",
  headline: "Cowboys beat the Texans",
  favoriteKey: "nfl-dal",
  followed: true,
  teamName: "Cowboys",
  sportLabel: "NFL",
  leaguePath: "football/nfl",
  gameId: "401872967",
  wrapKind: "espn",
  status: "Final",
  scoreLine: "DAL 27 · HOU 24",
  wrapHref: "https://www.espn.com/nfl/game/_/gameId/401872967",
  when: "2026-10-04T20:15:00Z",
  body: "Dallas came back in Houston. ".repeat(20),
});
const cowboysHighlights = card({
  id: "news-50103615",
  headline: "Dallas Cowboys vs. Houston Texans: Game Highlights",
  favoriteKey: "nfl-dal",
  followed: true,
  teamName: "Cowboys",
  sportLabel: "NFL",
  leaguePath: "football/nfl",
  status: "Media",
  wrapHref: "https://www.espn.com/video/clip/_/id/50103615/game-highlights",
  when: "2026-10-04T23:00:00Z",
  body: "Video highlights of Cowboys-Texans. ".repeat(8),
});
const cowboysBounce = card({
  id: "news-50105829",
  headline: "Cowboys bounce back with 'exhilarating' win over Texans",
  favoriteKey: "nfl-dal",
  followed: true,
  teamName: "Cowboys",
  sportLabel: "NFL",
  leaguePath: "football/nfl",
  status: "Media",
  wrapHref: "https://www.espn.com/video/clip/_/id/50105829/cowboys-bounce-back-exhilarating-win-texans",
  when: "2026-10-04T23:10:00Z",
  body: "Dallas flipped the script after the Rio loss. ".repeat(8),
});
const cowboysFlip = card({
  id: "news-50105860",
  headline: "Cowboys flip script after Rio loss with key win over Texans",
  favoriteKey: "nfl-dal",
  followed: true,
  teamName: "Cowboys",
  sportLabel: "NFL",
  leaguePath: "football/nfl",
  status: "Story",
  wrapHref: "https://www.espn.com/nfl/story/_/id/50105860/dallas-cowboys-ceedee-lamb-dak-texans",
  when: "2026-10-05T08:00:00Z",
  body: "CeeDee Lamb and Dak Prescott beat Houston. ".repeat(16),
});
const cowboysLamb = card({
  id: "news-50104876",
  headline: "CeeDee Lamb's 17 catches, go-ahead score power Cowboys",
  favoriteKey: "nfl-dal",
  followed: true,
  teamName: "Cowboys",
  sportLabel: "NFL",
  leaguePath: "football/nfl",
  status: "HeadlineNews",
  wrapHref: "https://www.espn.com/nfl/story/_/id/50104876/ceedee-lamb-17-catches-go-ahead-score-power-c",
  body: "Lamb caught 17 passes and scored the go-ahead touchdown against Houston. ".repeat(12),
});
const cowboysTakeaways = card({
  id: "wrap-athletic-cowboys-texans",
  headline: "Did CeeDee Lamb's historic day save the Cowboys' and sink the Texans' seasons?",
  favoriteKey: "nfl-dal",
  teamName: "Cowboys",
  sportLabel: "NFL",
  leaguePath: "football/nfl",
  wrapHref: "https://www.nytimes.com/athletic/7659243/2026/10/04/cowboys-texans-result-nfl-week-4-takeaways/",
  body: "The Athletic takeaways from Cowboys-Texans. ".repeat(16),
});
const cowboysMeeting = card({
  id: "news-50095892",
  headline: "Brian Schottenheimer owned up to Rio mistakes in Cowboys meeting",
  favoriteKey: "nfl-dal",
  followed: true,
  teamName: "Cowboys",
  sportLabel: "NFL",
  leaguePath: "football/nfl",
  status: "HeadlineNews",
  wrapHref: "https://www.espn.com/nfl/story/_/id/50095892/brian-schottenheimer-owned-rio-mistakes-cowbo",
  body: "The coach addressed last week's loss in the team meeting. ".repeat(12),
});
assert(isGameRecapCopy(cowboysHighlights) && isGameRecapCopy(cowboysBounce), "highlights and a win-over write-up are recaps");
assert(!isGameRecapCopy(cowboysMeeting), "a team-meeting note is not the game recap");
const cowboysOnce = dedupeStories([
  cowboysWrap,
  cowboysHighlights,
  cowboysBounce,
  cowboysFlip,
  cowboysLamb,
  cowboysTakeaways,
  cowboysMeeting,
]);
assert(cowboysOnce.some((c) => c.id === "wire-nfl-401872967"), "the full Cowboys recap stays");
assert(
  cowboysOnce.filter((c) =>
    ["news-50103615", "news-50105829", "news-50105860", "news-50104876", "wrap-athletic-cowboys-texans"].includes(c.id),
  ).length === 0,
  "Cowboys-Texans highlights, bounce-back clip, flip-script story, Lamb write-up and Athletic takeaways collapse into the wrap",
);
assert(cowboysOnce.some((c) => c.id === "news-50095892"), "the Rio meeting note is a different story");

const weekComebacks = card({
  id: "news-50100800",
  headline: "How the Rams, Cowboys, Patriots pulled Week 4 comebacks to save their seasons",
  favoriteKey: "nfl-dal",
  followed: true,
  teamName: "Cowboys",
  sportLabel: "NFL",
  leaguePath: "football/nfl",
  status: "Story",
  wrapHref: "https://www.espn.com/nfl/story/_/id/50100800/week-4-rams-cowboys-patriots-comeback-wins-sa",
  when: "2026-10-05T12:00:00Z",
  body: "Three clubs came back from double-digit holes in Week 4. ".repeat(16),
  photo: "https://a.espncdn.com/rams.jpg",
});
assert(!isGameRecapCopy(weekComebacks), "a week-wide comeback roundup is not one game's recap");
assert(!isSingleGameRecap(weekComebacks), "the week-wide roundup does not wear a single game's score banner");
assert(isSingleGameRecap(cowboysWrap), "the full Cowboys wrap still wears recap chrome");
assert(isSingleGameRecap(cowboysFlip), "a win-over write-up still wears recap chrome");

const lionsWrap = card({
  id: "wire-nfl-401872978",
  headline: "Panthers beat the Lions",
  favoriteKey: "nfl-det",
  followed: true,
  teamName: "Lions",
  sportLabel: "NFL",
  leaguePath: "football/nfl",
  gameId: "401872978",
  wrapKind: "espn",
  status: "Final",
  scoreLine: "CAR 27 · DET 24",
  body: "Carolina held on in Detroit. ".repeat(20),
});
const lionsClip = card({
  id: "news-50107279",
  headline: "Panthers hold off Lions in a SNF thriller",
  favoriteKey: "nfl-det",
  followed: true,
  teamName: "Lions",
  sportLabel: "NFL",
  status: "Media",
  body: "Short clip of the Sunday night finish. ".repeat(8),
});
const lionsDefeat = card({
  id: "news-50107710",
  headline: "Tetairoa McMillan, Bryce Young star as Panthers defeat Lions",
  favoriteKey: "nfl-det",
  followed: true,
  teamName: "Lions",
  sportLabel: "NFL",
  status: "HeadlineNews",
  body: "Young and McMillan beat Detroit in prime time. ".repeat(16),
});
const lionsBet = card({
  id: "news-50053980",
  headline: "How to bet Lions-Panthers on 'SNF': Analysis, tips and top prop plays",
  favoriteKey: "nfl-det",
  followed: true,
  teamName: "Lions",
  sportLabel: "NFL",
  status: "Story",
  body: "Betting lines for Sunday night. ".repeat(12),
});
const lionsOnce = dedupeStories([lionsWrap, lionsClip, lionsDefeat, lionsBet]);
assert(lionsOnce.some((c) => c.id === "wire-nfl-401872978") && !lionsOnce.some((c) => c.id === "news-50107279" || c.id === "news-50107710"), "Lions-Panthers files once");
assert(lionsOnce.some((c) => c.id === "news-50053980"), "the betting note is not the recap");
assert(isBettingPreview(lionsBet) && cannotLeadFront(lionsBet, [lionsWrap, lionsDefeat, lionsBet]), "betting tips never lead A1");
assert(!cannotLeadFront(lionsDefeat, [lionsWrap, lionsDefeat, lionsBet]), "the defeat recap may lead");
{
  const stamped = [lionsBet, lionsDefeat, lionsWrap].map((c, i) =>
    i === 0 ? { ...c, editorFront: 0 } : i === 1 ? { ...c, editorFront: 1 } : c,
  );
  const front = editorFront(stamped);
  assert(front[0]?.id !== "news-50053980", "editor betting lead is swapped off A1");
  assert(front.some((c) => c.id === "news-50107710" || c.id === "wire-nfl-401872978"), "matchup recap takes the lead slot");
}

const thorntonNote = card({
  id: "news-thornton",
  headline: "Sources: Chiefs WR Tyquan Thornton expected back in 12-16 weeks",
  dek: null,
  favoriteKey: "nfl-kc",
  followed: true,
  teamName: "Chiefs",
  sportLabel: "NFL",
  leaguePath: "football/nfl",
  status: "Story",
  editorFront: 0,
  listRank: 0,
  body: "Kansas City expects Thornton back in 12 to 16 weeks after the injury. ".repeat(16),
});
const mizzouFinal = card({
  id: "wire-cfb-mizzou-florida",
  headline: "No. 25 Missouri trounces No. 8 Florida 45-17 to snap 9-game skid",
  dek: "The Tigers scored 45 and ended a nine-game losing streak in Gainesville.",
  favoriteKey: "cfb-mizzou",
  followed: true,
  teamName: "Missouri",
  sportLabel: "College Football",
  leaguePath: "football/college-football",
  status: "Final",
  scoreLine: "MIZ 45 · FLA 17",
  when: "2026-10-05T03:30:00Z",
  editorFront: 1,
  body: "Missouri beat Florida 45-17 in Gainesville and snapped a nine-game losing streak. ".repeat(16),
});
assert(isInjuryNote(thorntonNote), "Thornton hed is an injury note");
assert(isFavoriteGameResult(mizzouFinal), "Mizzou 45-17 is a favorite-team result");
assert(!isFavoriteGameResult(thorntonNote), "an injury note is not a game result");
assert(cannotLeadFront(thorntonNote, [thorntonNote, mizzouFinal]), "an injury note cannot lead over a favorite result");
{
  const moNote = card({
    id: "mo-bailey",
    headline: "Bailey Jumps Back In - HRCC's Committees",
    sportLabel: "Missouri",
    body: "A Missouri scout note. ".repeat(20),
  });
  assert(cannotLeadFront(moNote, [moNote, mizzouFinal]), "a statehouse note cannot lead over Mizzou's result");
  const moPaper = buildEdition({
    stories: [moNote, mizzouFinal],
    clubs: [],
    edition: "2026-10-05-evening",
  });
  const moA1 = moPaper.pages.find((p) => p.kind === "favorites-front");
  assert(
    moA1?.kind === "favorites-front" && moA1.lead?.id === "wire-cfb-mizzou-florida",
    "A1 leads with Mizzou, not the Missouri newsletter",
  );
}
assert(!cannotLeadFront(mizzouFinal, [thorntonNote, mizzouFinal]), "the Mizzou recap may lead");
assert(
  storyRank(mizzouFinal, "2026-10-05-evening") > storyRank(thorntonNote, "2026-10-05-evening"),
  "Mizzou's result outranks a Chiefs injury note",
);
{
  const front = editorFront([thorntonNote, mizzouFinal]);
  assert(front[0]?.id === "wire-cfb-mizzou-florida", "editor injury lead is swapped for the Mizzou result");
}
{
  const evening = buildEdition({
    stories: [thorntonNote, mizzouFinal],
    clubs: [],
    edition: "2026-10-05-evening",
  });
  const a1 = evening.pages.find((p) => p.kind === "favorites-front");
  assert(
    a1?.kind === "favorites-front" && a1.lead?.id === "wire-cfb-mizzou-florida",
    `A1 leads with Mizzou, not Thornton (got ${a1 && a1.kind === "favorites-front" ? a1.lead?.headline : "no front"})`,
  );
}
{
  const filed = { ...mizzouFinal, favoriteKey: "", followed: false };
  const stamped = stampFavoriteKeys([filed], [
    { key: "cfb-mizzou", shortName: "Mizzou", logo: null, leaguePath: "football/college-football", record: "4-1", standing: "8th in SEC", division: [], stats: [], leaders: [], upcoming: [] },
  ]);
  assert(stamped[0]?.favoriteKey === "cfb-mizzou", "a filed Mizzou recap gets its home-desk key back");
  const paper = buildEdition({
    stories: [thorntonNote, filed],
    clubs: [
      { key: "cfb-mizzou", shortName: "Mizzou", logo: null, leaguePath: "football/college-football", record: "4-1", standing: "8th in SEC", division: [], stats: [], leaders: [], upcoming: [] },
    ],
    edition: "2026-10-05-evening",
  });
  const a1 = paper.pages.find((p) => p.kind === "favorites-front");
  assert(
    a1?.kind === "favorites-front" && a1.lead?.id === "wire-cfb-mizzou-florida",
    "A1 still leads with Mizzou when the filed row lost favoriteKey",
  );
}
{
  const giants = card({
    id: "wire-nfl-401872966",
    headline: "Winston throws 3 TD passes and Banks' pick-6 seals Giants' 36-24 win over Cardinals",
    favoriteKey: "mlb-stl",
    followed: true,
    teamName: "Giants",
    sportLabel: "NFL",
    leaguePath: "football/nfl",
    status: "Final",
    scoreLine: "ARI 24  ·  NYG 36",
    photo: "https://example.com/giants.jpg",
    body: "New York beat Arizona. ".repeat(12),
  });
  const chiefsWrap = card({
    id: "wire-nfl-401872976",
    headline: "Chiefs beat the Raiders 30-27 to move to 4-0 behind Patrick Mahomes",
    favoriteKey: "nfl-kc",
    followed: true,
    teamName: "Chiefs",
    sportLabel: "NFL",
    leaguePath: "football/nfl",
    status: "Final",
    scoreLine: "KC 30  ·  LV 27",
    photo: "https://example.com/chiefs.jpg",
    body: "Kansas City held off Las Vegas. ".repeat(12),
  });
  const mizzouLead = card({
    id: "wire-cfb-mizzou-florida",
    headline: "No. 25 Missouri trounces No. 8 Florida 45-17",
    favoriteKey: "cfb-mizzou",
    followed: true,
    teamName: "Mizzou",
    sportLabel: "College Football",
    leaguePath: "football/college-football",
    status: "Final",
    scoreLine: "MIZ 45 · FLA 17",
    photo: "https://example.com/miz.jpg",
    body: "Missouri snapped the skid. ".repeat(12),
  });
  const clubs: ClubDesk[] = [
    { key: "mlb-stl", shortName: "Cardinals", logo: null, leaguePath: "baseball/mlb", record: "83-79", standing: "NL Central", division: [], stats: [], leaders: [], upcoming: [] },
    { key: "nfl-kc", shortName: "Chiefs", logo: null, leaguePath: "football/nfl", record: "4-0", standing: "AFC West", division: [], stats: [], leaders: [], upcoming: [] },
    { key: "cfb-mizzou", shortName: "Mizzou", logo: null, leaguePath: "football/college-football", record: "4-1", standing: "8th in SEC", division: [], stats: [], leaders: [], upcoming: [] },
  ];
  const unstamped = stampFavoriteKeys([giants], clubs);
  assert(unstamped[0]?.favoriteKey === "", "an NFL Giants–Cardinals wrap does not keep the baseball desk");
  assert(unstamped[0]?.followed === false, "a cross-league stamp is not a followed story");
  assert(!isFavoriteStory(unstamped[0]!), "a stripped Giants wrap is not a favorite story");
  assert(!isFavoriteGameResult(unstamped[0]!), "a stripped Giants wrap is not a favorite result");
  const under = pickFrontUnderLead([mizzouLead, giants, chiefsWrap], mizzouLead);
  assert(under?.id === "wire-nfl-401872976", `A1 under the lead is the Chiefs result, not Giants–Arizona (got ${under?.headline ?? "none"})`);
}
{
  const bluesSat = card({
    id: "wire-nhl-401892439",
    headline: "Necas and Roy score quick goals as the Avalanche rout the Blues 6-1",
    favoriteKey: "nhl-stl",
    followed: true,
    teamName: "Blues",
    sportLabel: "NHL",
    leaguePath: "hockey/nhl",
    status: "Final",
    scoreLine: "STL 1  ·  COL 6",
    when: "2026-10-04T01:00:00Z",
    photo: "https://example.com/blues.jpg",
    body: "Colorado beat St. Louis on Saturday. ".repeat(12),
  });
  const chiefsSun = card({
    id: "wire-nfl-401872976",
    headline: "Chiefs beat the Raiders 30-27 to move to 4-0 behind Patrick Mahomes",
    favoriteKey: "nfl-kc",
    followed: true,
    teamName: "Chiefs",
    sportLabel: "NFL",
    leaguePath: "football/nfl",
    status: "Final",
    scoreLine: "KC 30  ·  LV 27",
    when: "2026-10-04T20:25:00Z",
    won: true,
    photo: "https://example.com/chiefs.jpg",
    body: "Kansas City held off Las Vegas on Sunday. ".repeat(12),
  });
  const cowboysSun = card({
    id: "wire-nfl-401872980",
    headline: "CeeDee Lamb's late TD caps a wild Cowboys rally to beat winless Texans 34-30",
    favoriteKey: "nfl-dal",
    followed: true,
    teamName: "Cowboys",
    sportLabel: "NFL",
    leaguePath: "football/nfl",
    status: "Final",
    scoreLine: "DAL 34  ·  HOU 30",
    when: "2026-10-04T20:00:00Z",
    won: true,
    photo: "https://example.com/cowboys.jpg",
    body: "Dallas rallied in Houston on Sunday. ".repeat(12),
  });
  const mizzouLead = card({
    id: "wire-cfb-mizzou-florida",
    headline: "No. 25 Missouri trounces No. 8 Florida 45-17",
    favoriteKey: "cfb-mizzou",
    followed: true,
    teamName: "Mizzou",
    sportLabel: "College Football",
    leaguePath: "football/college-football",
    status: "Final",
    scoreLine: "MIZ 45 · FLA 17",
    when: "2026-10-03T19:50:00Z",
    photo: "https://example.com/miz.jpg",
    body: "Missouri snapped the skid. ".repeat(12),
  });
  assert(latestClubResultDay([bluesSat, chiefsSun, cowboysSun]) === "2026-10-04", "Sunday is the latest club game day");
  const lionsSun = card({
    id: "box-football/nfl-401872978",
    headline: "Young, McMillan connect for 2 TDs to lead Panthers past Lions 32-26",
    favoriteKey: "nfl-det",
    followed: true,
    teamName: "Lions",
    sportLabel: "NFL",
    leaguePath: "football/nfl",
    status: "Final",
    scoreLine: "DET 26  ·  CAR 32",
    when: "2026-10-05T00:20:00Z",
    won: false,
    photo: "https://example.com/lions.jpg",
    body: "Carolina held off Detroit on Sunday night. ".repeat(12),
  });
  const under = pickFrontUnderLead([mizzouLead, bluesSat, chiefsSun, cowboysSun, lionsSun], mizzouLead);
  assert(under?.id === "wire-nfl-401872976", `A1 under the lead is Sunday's Chiefs win, not Saturday's Blues or a Sunday loss (got ${under?.headline ?? "none"})`);
  const onlySaturday = pickFrontUnderLead([mizzouLead, bluesSat], mizzouLead);
  assert(onlySaturday?.id === "wire-nhl-401892439", "a Saturday club result may run when it is the freshest game day");
}


const chiefsHighlights = card({
  id: "news-50105678",
  headline: "Kansas City Chiefs vs Las Vegas Raiders: Game Highlights",
  favoriteKey: "nfl-kc",
  followed: true,
  teamName: "Chiefs",
  sportLabel: "NFL",
  status: "Media",
  body: "Highlights from Allegiant Stadium. ".repeat(8),
});
const chiefsTakeaways = card({
  id: "wrap-athletic-chiefs",
  headline: "Are the Chiefs the AFC's team to beat after edging the Raiders to stay undefeated?",
  favoriteKey: "nfl-kc",
  teamName: "Chiefs",
  sportLabel: "NFL",
  wrapHref: "https://www.nytimes.com/athletic/7659261/2026/10/04/chiefs-raiders-nfl-2026-score-result-takeaways/",
  body: "The Athletic on the Chiefs staying unbeaten. ".repeat(16),
});
const chiefsHill = card({
  id: "news-50109680",
  headline: "Tyreek Hill could sign with new team soon, agent says",
  favoriteKey: "nfl-kc",
  followed: true,
  teamName: "Chiefs",
  sportLabel: "NFL",
  status: "HeadlineNews",
  body: "Hill is a free-agent story, not the Raiders recap. ".repeat(12),
});
const chiefsOnce = dedupeStories([chiefsHighlights, chiefsTakeaways, chiefsHill]);
assert(chiefsOnce.length === 2 && chiefsOnce.some((c) => c.id === "wrap-athletic-chiefs") && chiefsOnce.some((c) => c.id === "news-50109680"), "Chiefs-Raiders recaps collapse; Hill signing stays");

const bluesHighlights = card({
  id: "news-50096947",
  headline: "St. Louis Blues vs. Colorado Avalanche: Game Highlights",
  favoriteKey: "nhl-stl",
  followed: true,
  teamName: "Blues",
  sportLabel: "NHL",
  leaguePath: "hockey/nhl",
  status: "Media",
  body: "Highlight package from Denver. ".repeat(8),
});
const bluesWrap = card({
  id: "wrap-stltoday-blues",
  headline: "Blues crushed 6-1 by Avalanche in first loss of the season",
  favoriteKey: "nhl-stl",
  teamName: "Blues",
  sportLabel: "NHL",
  leaguePath: "hockey/nhl",
  wrapHref: "https://www.stltoday.com/sports/professional/nhl/blues/article_b7c963f6.html",
  body: "Colorado scored six and St. Louis scored one. ".repeat(16),
});
const bluesOnce = dedupeStories([bluesHighlights, bluesWrap]);
assert(bluesOnce.length === 1 && bluesOnce[0]!.id === "wrap-stltoday-blues", "Blues-Avalanche files the full recap once");

const mizzouNet = card({
  id: "mo-wuufpw",
  headline: "Mizzou breaks through with memorable Homecoming win over No. 8 Florida",
  sportLabel: "Missouri",
  teamName: "Missourinet",
  wrapHref: "https://www.missourinet.com/2026/10/05/mizzou-breaks-through-with-memorable-homecoming-win-over-no-8-florida/",
  body: "The Tigers scored 35 straight after a 10-10 tie. ".repeat(12),
});
const mizzouHighlights = card({
  id: "news-50094160",
  headline: "Florida Gators vs. Missouri Tigers: Game Highlights",
  favoriteKey: "cfb-mizzou",
  followed: true,
  teamName: "Mizzou FB",
  sportLabel: "NCAA",
  leaguePath: "football/college-football",
  status: "Media",
  body: "Highlight clip from Memorial Stadium. ".repeat(8),
});
const mizzouGame = dedupeStories([
  wrapAndRss[0]!,
  mizzouHighlights,
  mizzouNet,
  wrapAndRss.find((c) => c.id === "wrap-stltoday-hochman")!,
]);
assert(mizzouGame.some((c) => c.id === "wire-college-football-401856708"), "the ESPN Mizzou wrap stays");
assert(!mizzouGame.some((c) => c.id === "news-50094160" || c.id === "mo-wuufpw"), "the highlight clip and the Missourinet rewrite drop");
assert(mizzouGame.some((c) => c.id === "wrap-stltoday-hochman"), "Hochman stays a separate column");
assert(
  sameSectionAStory(cowboysHighlights, cowboysBounce),
  "a highlight package and a win-over story are the same Cowboys-Texans game",
);

const cowboysPaper = buildEdition({
  stories: [
    cowboysWrap,
    cowboysHighlights,
    cowboysBounce,
    cowboysFlip,
    card({
      id: "wire-nfl-ind-other",
      headline: "Colts beat the Commanders",
      sportLabel: "NFL",
      leaguePath: "football/nfl",
      status: "Final",
      scoreLine: "IND 30 · WSH 13",
      gameId: "401-ind-other",
      when: "2026-10-04T17:00:00Z",
      body: "Indianapolis scored early. ".repeat(8),
    }),
  ],
  clubs: [chiefs],
  edition: "2026-10-05-morning",
});
const cowboysA = cowboysPaper.pages
  .filter((p) => p.section === "A")
  .flatMap((p) => {
    if (p.kind === "favorites-front") return [p.lead, p.second, p.third, ...p.briefs];
    if (p.kind === "favorites-inside") return [p.primary, p.secondary, ...p.briefs];
    if (p.kind === "favorites-continue") return p.jumps.map((j) => j.card);
    return [];
  })
  .filter(Boolean)
  .map((c) => c!.id);
assert(cowboysA.includes("wire-nfl-401872967"), "Section A keeps the full Cowboys recap");
assert(!cowboysA.includes("news-50103615") && !cowboysA.includes("news-50105829"), "Section A does not reprint the clip");
assert(
  JSON.stringify(cowboysPaper.pages.filter((p) => p.section === "NFL")).includes("wire-nfl-401872967"),
  "the Cowboys recap still leads the NFL front",
);

const oneTrade = dedupeStories([
  card({
    id: "espn-trade",
    headline: "St. Louis Cardinals complete trade and name the pitcher to be named later",
    body: "ESPN account of the Brian Curley trade. ".repeat(12),
    wrapHref: "https://www.espn.com/mlb/story/curley",
    favoriteKey: "mlb-stl",
    teamName: "Cardinals",
  }),
  card({
    id: "pd-trade",
    headline: "Cardinals complete trade, name the pitcher to be named later",
    body: "Post-Dispatch account of the Brian Curley trade, with the club's own words. ".repeat(12),
    wrapHref: "https://www.stltoday.com/sports/cardinals-curley",
    favoriteKey: "mlb-stl",
    teamName: "Cardinals",
  }),
  card({
    id: "yb-trade",
    headline: "Cardinals complete trade naming the pitcher to be named later",
    body: "Another wire account of the Brian Curley trade. ".repeat(8),
    wrapHref: "https://www.yardbarker.com/mlb/curley",
    favoriteKey: "mlb-stl",
    teamName: "Cardinals",
  }),
]);
assert(oneTrade.length === 1 && oneTrade[0]?.id === "pd-trade", "one trade story, and the Post-Dispatch files it");

const spiked = buildEdition({
  stories: [
    card({
      id: "junk",
      headline: "Cardinals complete a trade with Arizona",
      favoriteKey: "mlb-stl",
      teamName: "Cardinals",
      leaguePath: "baseball/mlb",
      when: "2026-09-30T04:00:00Z",
      body: "The Cardinals named a player to be named later. ".repeat(20),
      wrapHref: "https://www.yardbarker.com/cardinals",
    }),
    card({
      id: "perry",
      headline: "Perryville youth, family treated to on-field experience",
      dek: "A Cardinals catcher signed a foul ball.",
      favoriteKey: "mlb-stl",
      teamName: "Cardinals",
      leaguePath: "baseball/mlb",
      when: "2026-09-30T04:00:00Z",
      body: "The family walked onto the field after the game. ".repeat(16),
      wrapHref: "https://www.semissourian.com/perryville",
    }),
    card({
      id: "athletic-1",
      headline: "How the Blues top line changes the math",
      caption: "The Athletic",
      leaguePath: "hockey/nhl",
      teamName: "NHL",
      when: "2026-09-30T04:00:00Z",
      body: "The Athletic on the line that carried St. Louis.",
      feedUrl: "https://www.nytimes.com/athletic/rss/nhl/",
      wrapHref: "https://www.nytimes.com/athletic/blues-line",
    }),
  ],
  clubs: [],
  edition,
});
assert(!spiked.favoriteFolioByStory.junk, "a killed host never gets a folio");
assert(!spiked.favoriteFolioByStory.perry, "a fan feature never leads the club");
assert(
  spiked.pages.some(
    (page) =>
      ((page.kind === "sport-front" && page.section === "NHL" && page.articles.some((article) => article.card.id === "athletic-1")) ||
        (page.kind === "sport-inside" && page.section === "NHL" && (page.primary.id === "athletic-1" || page.secondary?.id === "athletic-1"))),
  ),
  "The Athletic runs in the sport section",
);

// League leaders: a desk in every sport section that has a list on file, in every edition.
const leaderClub: ClubDesk = { ...cards, key: "nfl-det", shortName: "Lions", leaguePath: "football/nfl" };
const focusesOf = (ed: ReturnType<typeof buildEdition>, code: string) =>
  ed.pages.flatMap((p) => (p.kind === "sport-front" && p.section === code ? [p.focus] : []));
for (const press of ["2026-09-30-morning", "2026-09-30-midday", "2026-09-30-evening"]) {
  const withLeaders = buildEdition({ stories: [], clubs: [leaderClub], edition: press, leaderPaths: ["football/nfl"] });
  const nflFocuses = focusesOf(withLeaders, "NFL");
  assert(nflFocuses.includes("leaders"), `${press}: the NFL section runs a leaders desk`);
  assert(nflFocuses[0] === "front", `${press}: the section opens on a front`);
  assert(nflFocuses.indexOf("leaders") > nflFocuses.indexOf("teams"), `${press}: leaders sit with the reference pages`);
  assert(nflFocuses.indexOf("teams") > nflFocuses.indexOf("news"), `${press}: standings follow the news`);
  assert(nflFocuses.at(-1) === "schedule" || nflFocuses.at(-2) === "schedule", `${press}: the schedule is at the back`);
  const without = buildEdition({ stories: [], clubs: [leaderClub], edition: press });
  assert(!focusesOf(without, "NFL").includes("leaders"), `${press}: no list, no leaders desk`);
  assert(focusesOf(without, "NFL").length === nflFocuses.length - 1, `${press}: the leaders desk adds exactly one page`);

  // The viewing guide closes Section A, before Missouri and the sport sections.
  const a = withLeaders.pages.filter((p) => p.section === "A");
  assert(a.at(-1)?.kind === "favorites-watch", `${press}: the viewing guide is the last page of Section A`);
  assert(a.filter((p) => p.kind === "favorites-watch").length === 1, `${press}: one viewing guide`);
  const watchAt = withLeaders.pages.findIndex((p) => p.kind === "favorites-watch");
  assert(withLeaders.pages[watchAt + 1]?.section !== "A", `${press}: Section B or the sports follow the guide`);
  assert(withLeaders.sections[0]!.pages === a.length, `${press}: Section A counts the guide`);
}

assert(previousSaturday("2026-10-05") === "2026-10-03", "Monday's previous Saturday is the 3rd");
assert(previousSaturday("2026-10-10") === "2026-10-03", "Saturday morning still looks at last Saturday");
assert(previousSaturday("2026-10-04") === "2026-10-03", "Sunday looks at Saturday");
assert(
  gameWrapCovers("2026-10-03T16:00:00Z", "2026-10-05-morning", "football/college-football"),
  "Saturday CFB kickoff is in Monday morning's game window",
);
assert(
  gameWrapCovers("2026-10-04T20:00:00Z", "2026-10-05-morning", "football/nfl"),
  "Sunday NFL is in Monday morning's game window",
);
assert(
  gameWrapCovers("2026-10-04T20:15:00Z", "2026-10-05-evening", "football/nfl"),
  "Sunday NFL is still in Monday evening's game window",
);
assert(
  gameWrapCovers("2026-10-04T20:15:00Z", "2026-10-06-morning", "football/nfl"),
  "Sunday NFL lands in Tuesday morning's paper",
);
assert(
  !gameWrapCovers("2026-10-03T16:00:00Z", "2026-10-07-morning", "football/nfl"),
  "Saturday NFL is not in Wednesday morning",
);
assert(
  gameWrapCovers("2026-10-03T16:00:00Z", "2026-10-07-morning", "football/college-football"),
  "Saturday CFB stays in Wednesday morning's college window",
);
assert(
  wireBoardDays("2026-10-05", "2026-10-05-morning", "football/nfl").join() === "2026-10-03,2026-10-04,2026-10-05",
  "Monday morning NFL boards include Saturday",
);
assert(isGameWrapStory({ id: "wire-nfl-1" }), "a wire id is a game wrap");
assert(isGameWrapStory({ id: "box-football/college-football-401856708" }), "a board recap id is a game wrap");
{
  const boardMizzou = card({
    id: "box-football/college-football-401856708",
    headline: "No. 25 Missouri trounces No. 8 Florida 45-17 to snap 9-game skid against Top 25 opponents",
    favoriteKey: "cfb-mizzou",
    followed: true,
    teamName: "Missouri",
    sportLabel: "College Football",
    leaguePath: "football/college-football",
    status: "Final",
    scoreLine: "FLA 17 · MIZ 45",
    when: "2026-10-04T19:30:00Z",
    body: "Missouri beat Florida 45-17 in Gainesville and snapped a nine-game losing streak. ".repeat(16),
    photo: "https://example.com/mizzou.jpg",
  });
  const sixers = card({
    id: "league-sixers-pre",
    headline: "James, Embiid, Maxey sit out 76ers’ preseason opener vs. Knicks",
    sportLabel: "Nba",
    leaguePath: "basketball/nba",
    when: "2026-10-05T23:00:00Z",
    body: "The 76ers sat their stars in a preseason opener. ".repeat(20),
    editorFront: 0,
  });
  const boardPaper = buildEdition({
    stories: [sixers, boardMizzou],
    clubs: [
      { key: "cfb-mizzou", shortName: "Mizzou", logo: null, leaguePath: "football/college-football", record: "4-1", standing: "8th in SEC", division: [], stats: [], leaders: [], upcoming: [] },
    ],
    edition: "2026-10-05-evening",
  });
  const boardA1 = boardPaper.pages.find((p) => p.kind === "favorites-front");
  assert(
    boardA1?.kind === "favorites-front" && boardA1.lead?.id === "box-football/college-football-401856708",
    `A1 leads with the board's Mizzou recap, not a preseason sit-out (got ${boardA1 && boardA1.kind === "favorites-front" ? boardA1.lead?.headline : "no front"})`,
  );
  const uga = card({
    id: "wire-cfb-uga",
    headline: "No. 5 Georgia holds off Vanderbilt",
    teamName: "Georgia",
    sportLabel: "College Football",
    leaguePath: "football/college-football",
    status: "Final",
    scoreLine: "VAN 14 · UGA 24",
    when: "2026-10-04T23:30:00Z",
    body: "Georgia held off Vanderbilt in Athens. ".repeat(16),
    photo: "https://example.com/uga.jpg",
    sec: true,
  });
  const cfbPointerPaper = buildEdition({
    stories: [boardMizzou, uga],
    clubs: [
      { key: "cfb-mizzou", shortName: "Mizzou", logo: null, leaguePath: "football/college-football", record: "4-1", standing: "8th in SEC", division: [], stats: [], leaders: [], upcoming: [] },
    ],
    edition: "2026-10-05-evening",
  });
  const cfb1 = cfbPointerPaper.pages.find((p) => p.kind === "sport-front" && p.section === "CFB" && p.focus === "front");
  assert(
    cfb1?.kind === "sport-front" && cfb1.articles[0]?.card.id === "wire-cfb-uga",
    `CFB1 opens on the next-best wrap, not the A1 Mizzou reprint (got ${cfb1 && cfb1.kind === "sport-front" ? cfb1.articles[0]?.card.id : "no CFB front"})`,
  );
}

const satCfb = card({
  id: "wire-cfb-miz",
  headline: "Missouri beats Florida",
  favoriteKey: "cfb-mizzou",
  followed: true,
  teamName: "Mizzou",
  sportLabel: "CFB",
  leaguePath: "football/college-football",
  status: "Final",
  scoreLine: "FLA 17 · MIZ 24",
  gameId: "sat-cfb",
  when: "2026-10-03T16:00:00Z",
  body: "Missouri scored in the fourth quarter in Gainesville. ".repeat(20),
});
const mondayNfl = card({
  id: "wire-nfl-kc",
  headline: "Chiefs beat the Raiders",
  favoriteKey: "nfl-kc",
  followed: true,
  teamName: "Chiefs",
  sportLabel: "NFL",
  leaguePath: "football/nfl",
  status: "Final",
  scoreLine: "KC 30 · LV 27",
  gameId: "sun-nfl",
  when: "2026-10-04T20:15:00Z",
  body: "Kansas City won in Las Vegas on Sunday night. ".repeat(20),
});
const mondayCardsNews = card({
  id: "news-cards-oct5",
  headline: "Cardinals name a spring starter",
  favoriteKey: "mlb-stl",
  followed: true,
  teamName: "Cardinals",
  when: "2026-10-05T09:00:00Z",
  body: "St. Louis listed its first spring rotation on Monday morning. ".repeat(8),
});
const mondayFiled = fileEditionStories({
  fresh: [satCfb, mondayNfl, mondayCardsNews],
  carried: [],
  readKeys: new Set(),
  pressId: "2026-10-05-morning",
});
assert(mondayFiled.some((c) => c.id === "wire-cfb-miz" && c.holdover), "Saturday CFB files on Monday as a holdover wrap");
assert(mondayFiled.some((c) => c.id === "wire-nfl-kc" && !c.holdover), "Sunday NFL files as fresh on Monday");
assert(mondayFiled.some((c) => c.id === "news-cards-oct5"), "Monday news still files on the 18-hour clock");

const mondayPaper = buildEdition({
  stories: mondayFiled,
  clubs: [chiefs],
  edition: "2026-10-05-morning",
});
const mondayA1 = mondayPaper.pages.find((p) => p.kind === "favorites-front");
assert(
  mondayA1?.kind === "favorites-front" &&
    [mondayA1.lead, mondayA1.second, mondayA1.third].every((c) => c?.id !== "wire-cfb-miz"),
  "a Saturday holdover wrap never fronts A1",
);
assert(
  mondayA1?.kind === "favorites-front" && mondayA1.lead?.id !== "wire-cfb-miz",
  "fresh news or Sunday's final takes A1 instead",
);

const leagueFinal = card({
  id: "wire-nfl-ind-wsh",
  headline: "Colts beat the Commanders",
  sportLabel: "NFL",
  leaguePath: "football/nfl",
  status: "Final",
  scoreLine: "IND 30 · WSH 13",
  gameId: "401-ind",
  when: "2026-10-04T17:00:00Z",
  body: "Indianapolis scored early and held on in Washington. ".repeat(20),
});
assert(isDeskStory(leagueFinal), "a league wire final files without a followed club");
const sundayNflPaper = buildEdition({
  stories: [leagueFinal, ...Array.from({ length: 13 }, (_, i) =>
    card({
      id: `wire-nfl-sun-${i}`,
      headline: `Sunday final ${i}`,
      sportLabel: "NFL",
      leaguePath: "football/nfl",
      status: "Final",
      scoreLine: `AA ${10 + i} · BB ${7 + i}`,
      gameId: `401-sun-${i}`,
      when: "2026-10-04T18:00:00Z",
      body: `The visiting club won game ${i} on Sunday afternoon. `.repeat(20),
    }),
  )],
  clubs: [chiefs],
  edition: "2026-10-05-morning",
});
const sundayNflInside = sundayNflPaper.pages.filter((p) => p.kind === "sport-inside" && p.section === "NFL");
assert(sundayNflInside.length > 3, "NFL inside pages grow with Sunday's slate instead of stopping at six wraps");
const sundayNflRecaps = sundayNflPaper.pages.find((p) => p.kind === "sport-front" && p.section === "NFL" && p.focus === "recaps");
const sundayNflFront = sundayNflPaper.pages.find((p) => p.kind === "sport-front" && p.section === "NFL" && p.focus === "front");
const sundayNflListed = new Set([
  ...(sundayNflFront?.kind === "sport-front" ? sundayNflFront.articles.map((a) => a.card.id) : []),
  ...(sundayNflRecaps?.kind === "sport-front" ? sundayNflRecaps.articles.map((a) => a.card.id) : []),
]);
assert(sundayNflListed.size >= 14, "Sunday's finals fill the NFL front and recaps without dropping games");
assert(
  !sundayNflRecaps ||
    (sundayNflRecaps.kind === "sport-front" &&
      sundayNflFront?.kind === "sport-front" &&
      sundayNflRecaps.articles.every((a) => !sundayNflFront.articles.some((f) => f.card.id === a.card.id))),
  "recaps do not reprint the front's wraps",
);

const favoriteWrap = card({
  id: "wire-nfl-kc-lead",
  headline: "Chiefs beat the Raiders",
  favoriteKey: "nfl-kc",
  followed: true,
  sportLabel: "NFL",
  leaguePath: "football/nfl",
  status: "Final",
  scoreLine: "KC 30 · LV 27",
  gameId: "fav-kc",
  when: "2026-10-04T20:15:00Z",
  body: "Kansas City won in Las Vegas. ".repeat(8),
});
const otherWrap = card({
  id: "wire-nfl-ind-lead",
  headline: "Colts beat the Commanders",
  sportLabel: "NFL",
  leaguePath: "football/nfl",
  status: "Final",
  scoreLine: "IND 30 · WSH 13",
  gameId: "oth-ind",
  when: "2026-10-04T17:00:00Z",
  body: "Indianapolis scored early. ".repeat(8),
});
const videoJunk = card({
  id: "league-highlights",
  headline: "Game Highlights: Colts at Commanders",
  sportLabel: "NFL",
  leaguePath: "football/nfl",
  status: "Video",
  when: "2026-10-04T23:00:00Z",
  wrapHref: "https://www.espn.com/video/clip?id=99",
});
const newsTopics = [
  "Jets shuffle the practice report",
  "Bears sign a veteran tackle",
  "Eagles add a returner",
  "Cowboys list their quarterback as limited",
  "Packers elevate a practice-squad guard",
  "Ravens sign a kicker",
  "Steelers shuffle the backfield",
  "Bengals list a receiver as questionable",
  "Browns add a safety",
  "Titans waive a linebacker",
  "Colts sign a tight end",
  "Texans elevate a corner",
];
const newsFlood = newsTopics.map((headline, i) =>
  card({
    id: `league-news-${i}`,
    headline,
    sportLabel: "NFL",
    leaguePath: "football/nfl",
    when: "2026-10-05T08:00:00Z",
    body: `${headline}. The club made the move Monday morning. `.repeat(4),
  }),
);
const recapsFirst = buildEdition({
  stories: [otherWrap, favoriteWrap, videoJunk, ...newsFlood],
  clubs: [chiefs],
  edition: "2026-10-05-morning",
});
const recapsPage = recapsFirst.pages.find((p) => p.kind === "sport-front" && p.section === "NFL" && p.focus === "recaps");
const firstNfl = recapsFirst.pages.find((p) => p.kind === "sport-front" && p.section === "NFL");
assert(firstNfl?.kind === "sport-front" && firstNfl.focus === "front", "morning sport sections open on a section front");
assert(
  firstNfl?.kind === "sport-front" && firstNfl.articles[0]?.card.id === "wire-nfl-kc-lead",
  "the favorite-team recap leads the NFL front",
);
assert(
  !recapsPage || (recapsPage.kind === "sport-front" && recapsPage.articles.every((a) => a.card.id !== "wire-nfl-kc-lead")),
  "the favorite-team recap does not reprint on the NFL recaps desk",
);
assert(
  recapsFirst.pages.some((p) => p.kind === "favorites-front" && [p.lead, p.second, p.third].some((c) => c?.id === "wire-nfl-kc-lead")),
  "the Chiefs recap still runs in Section A",
);
assert(
  firstNfl?.kind === "sport-front" && firstNfl.articles.length <= 6,
  "the section front holds up to six stories so a short CFB1 can fill to ~1480",
);
assert(
  recapsFirst.pages.some(
    (p) =>
      p.kind === "sport-front" &&
      p.section === "NFL" &&
      p.articles.some((a) => a.card.id === "wire-nfl-ind-lead"),
  ),
  "Sunday's other wrap still sits on the NFL front or is consumed into recaps",
);
assert(
  !JSON.stringify(recapsFirst.pages.filter((p) => p.section === "NFL")).includes("league-highlights"),
  "video clips are spiked from the NFL section",
);
const newsPage = recapsFirst.pages.find((p) => p.kind === "sport-front" && p.section === "NFL" && p.focus === "news");
assert(
  newsPage?.kind === "sport-front" && newsPage.articles.length <= 8 && newsPage.articles.length >= 1,
  `leftover news after the front is capped at 8, got ${newsPage && newsPage.kind === "sport-front" ? newsPage.articles.length : 0}`,
);

assert(sourceStoryId(card({ id: "news-4012345", headline: "x" })) === "4012345", "news- prefix is the ESPN id");
assert(sourceStoryId(card({ id: "league-4012345", headline: "x" })) === "4012345", "league- prefix is the same id");
assert(
  sourceStoryId(
    card({ id: "other", headline: "x", wrapHref: "https://www.espn.com/college-football/story/_/id/4012345/act" }),
  ) === "4012345",
  "espn story URL is the source id",
);

const collegeAct = dedupeStories([
  card({
    id: "league-4012345",
    headline: "Protect College Sports Act heads to the House",
    body: "Basketball coaches weighed in on the House bill. ".repeat(6),
    leaguePath: "basketball/mens-college-basketball",
    wrapHref: "https://www.espn.com/mens-college-basketball/story/_/id/4012345/act",
  }),
  card({
    id: "news-4012345",
    headline: "Protect College Sports Act heads to the House",
    body: "Football coaches and SEC programs backed the House bill. ".repeat(8),
    leaguePath: "football/college-football",
    favoriteKey: "cfb-mizzou",
    followed: true,
    wrapHref: "https://www.espn.com/college-football/story/_/id/4012345/act",
  }),
]);
assert(collegeAct.length === 1, "one ESPN id files once");
assert(collegeAct[0]?.leaguePath === "football/college-football", "the better-fit section keeps the College Sports Act");

const draftTwice = dedupeStories([
  card({
    id: "news-5550001",
    headline: "2027 NFL draft: Ohio State prospects to watch",
    body: "A look at the Buckeyes on the board. ".repeat(8),
    leaguePath: "football/college-football",
    wrapHref: "https://www.espn.com/college-football/story/_/id/5550001/draft",
  }),
  card({
    id: "league-5550001",
    headline: "2027 NFL draft: Ohio State prospects to watch",
    body: "A look at the Buckeyes on the board. ".repeat(8),
    leaguePath: "football/nfl",
    wrapHref: "https://www.espn.com/nfl/story/_/id/5550001/draft",
  }),
]);
assert(draftTwice.length === 1, "the same draft wrap does not run twice");

assert(
  sportSectionFocuses({ path: "baseball/mlb" }).join() === "front,recaps,news,teams,playoffs,schedule",
  "regular-season MLB keeps standings and the bracket at the back",
);
assert(
  sportSectionFocuses({ path: "baseball/mlb", postseason: true }).join() === "front,recaps,news,playoffs",
  "postseason MLB drops regular-season standings; the bracket replaces them and carries the schedule",
);
assert(
  sportSectionFocuses({ path: "hockey/nhl", postseason: true }).includes("teams") === false,
  "NHL playoffs drop the regular-season table",
);
assert(sportSectionFocuses({ path: "football/nfl" })[0] === "front", "every in-season section opens on a front");

const mlbPost = buildEdition({
  stories: [],
  clubs: [cards],
  edition: "2026-10-05-morning",
  postseasonPaths: ["baseball/mlb"],
});
assert(
  !mlbPost.pages.some((p) => p.kind === "sport-front" && p.section === "MLB" && p.focus === "teams"),
  "an October MLB section does not print the 162-game table",
);
assert(
  mlbPost.pages.some((p) => p.kind === "sport-front" && p.section === "MLB" && p.focus === "playoffs"),
  "the Postseason Picture still runs",
);
const mlbPostFront = mlbPost.pages.find((p) => p.kind === "sport-front" && p.section === "MLB");
assert(mlbPostFront?.kind === "sport-front" && mlbPostFront.focus === "front", "October MLB still opens on a front");

const coming = sortComingUp([
  { id: "mizzou-bb", when: "Tue, Nov 3", startIso: "2026-11-03T05:00:00Z" },
  { id: "sixers", when: "Mon, Oct 5, 6:00 PM", startIso: "2026-10-05T23:00:00Z" },
  { id: "blues", when: "Tue, Oct 6, 7:00 PM", startIso: "2026-10-07T00:00:00Z" },
  { id: "mizzou-fb", when: "Sat, Oct 10, 11:00 AM", startIso: "2026-10-10T16:00:00Z" },
  { id: "same-day-open", when: "Tue, Oct 6", startIso: "2026-10-06T05:00:00Z" },
]);
assert(
  coming.map((g) => g.id).join(",") === "sixers,same-day-open,blues,mizzou-fb,mizzou-bb",
  `Coming Up is chronological by start time: ${coming.map((g) => g.id).join(",")}`,
);
const comingPriority = sortComingUp([
  { id: "lions", when: "Tue, Oct 6, 7:00 PM", startIso: "2026-10-07T00:00:00Z", favoriteKey: "nfl-det" },
  { id: "chiefs", when: "Tue, Oct 6, 7:00 PM", startIso: "2026-10-07T00:00:00Z", favoriteKey: "nfl-kc" },
]);
assert(
  comingPriority.map((g) => g.id).join(",") === "lions,chiefs",
  "same kickoff sorts by team priority (Lions before Chiefs)",
);
const comingJosh = sortComingUp([
  { id: "mizzou-fb", when: "Sat, Oct 10, 11:00 AM", startIso: "2026-10-10T16:00:00Z", favoriteKey: "cfb-mizzou" },
  { id: "mizzou-bb", when: "Tue, Nov 3", startIso: "2026-11-03T05:00:00Z", favoriteKey: "cbb-mizzou" },
  { id: "blues", when: "Tue, Oct 6, 7:00 PM", startIso: "2026-10-07T00:00:00Z", favoriteKey: "nhl-stl" },
]);
assert(
  comingJosh.map((g) => g.id).join(",") === "blues,mizzou-fb,mizzou-bb",
  `A1 Coming Up is Blues Oct 6, then Mizzou FB Oct 10, then BB Nov 3 (got ${comingJosh.map((g) => g.id).join(",")})`,
);
const comingNoIso = sortComingUp(
  [
    { id: "mizzou-fb", when: "Sat, Oct 10, 11:00 AM CT", favoriteKey: "cfb-mizzou" },
    { id: "mizzou-bb", when: "Tue, Nov 3", favoriteKey: "cbb-mizzou" },
    { id: "blues", when: "Tue, Oct 6, 7:00 PM CT", favoriteKey: "nhl-stl" },
  ],
  Date.parse("2026-10-06T12:00:00-05:00"),
);
assert(
  comingNoIso.map((g) => g.id).join(",") === "blues,mizzou-fb,mizzou-bb",
  `Coming Up without startIso still sorts by Chicago clock (got ${comingNoIso.map((g) => g.id).join(",")})`,
);
assert(comingUpHasClock("Mon, Oct 5, 6:00 PM") && !comingUpHasClock("Tue, Nov 3"), "clock vs date-only");
const comingOpp = sortComingUp(
  [
    { id: "oct10", when: "Sat, Oct 10, 11:00 AM", startIso: "2026-10-10T16:00:00Z" },
    { id: "nov3", when: "Tue, Nov 3", startIso: "2026-11-03T05:00:00Z" },
    { id: "ark", when: "@ ARK Sat Oct 31", startIso: null },
    { id: "oct8", when: "Thu, Oct 8", startIso: "2026-10-08T16:00:00Z" },
  ],
  Date.parse("2026-10-05T12:00:00-05:00"),
);
assert(
  comingOpp.map((g) => g.id).join(",") === "oct8,oct10,ark,nov3",
  `Coming Up strips @ ARK and sorts: ${comingOpp.map((g) => g.id).join(",")}`,
);

const oct = "2026-10-05";
assert(sportInSeason("soccer/eng.1", oct) && sportInSeason("soccer/eng.2", oct), "October is soccer season");
assert(sportInSeason("football/nfl", oct) && sportInSeason("baseball/mlb", oct), "October is NFL and MLB");
assert(sportInSeason("hockey/nhl", oct), "October is NHL");
assert(!sportInSeason("basketball/nba", oct), "NBA preseason in early October is out of season");
assert(!sportInSeason("basketball/mens-college-basketball", oct), "CBB has not opened in early October");
assert(sportInSeason("basketball/nba", "2026-10-22"), "late October is NBA regular season");
const seasonal = orderSportSections(
  [
    "baseball/mlb",
    "football/nfl",
    "football/college-football",
    "hockey/nhl",
    "basketball/nba",
    "basketball/mens-college-basketball",
    "soccer/eng.1",
    "soccer/eng.2",
  ].map(sportSectionId),
  oct,
);
assert(
  seasonal.map((s) => s.code).join(",") === "MLB,NFL,CFB,NHL,EPL,EFL,NBA,CBB",
  `Oct 5 puts soccer ahead of NBA/CBB: ${seasonal.map((s) => s.code).join(",")}`,
);

const seasonPaper = buildEdition({
  stories: [
    tuesday,
    card({
      id: "news-nba-camp",
      headline: "76ers open camp in Philadelphia",
      favoriteKey: "nba-phi",
      followed: true,
      sportLabel: "NBA",
      leaguePath: "basketball/nba",
      when: "2026-10-04T18:00:00Z",
      body: "Philadelphia opened camp with a short practice and a longer meeting. ".repeat(8),
    }),
    card({
      id: "news-epl-note",
      headline: "Arsenal hold firm at the top",
      favoriteKey: "eng-arsenal",
      followed: true,
      sportLabel: "EPL",
      leaguePath: "soccer/eng.1",
      when: "2026-10-04T18:00:00Z",
      body: "Arsenal beat a rival and kept first place in the table. ".repeat(8),
    }),
  ],
  clubs: [
    chiefs,
    cards,
    {
      key: "nba-phi",
      shortName: "76ers",
      logo: null,
      leaguePath: "basketball/nba",
      record: "0-0",
      standing: null,
      division: [],
      stats: [],
      leaders: [],
      upcoming: [],
    },
    {
      key: "eng-arsenal",
      shortName: "Arsenal",
      logo: null,
      leaguePath: "soccer/eng.1",
      record: "7-1-1",
      standing: "1st",
      division: [],
      stats: [],
      leaders: [],
      upcoming: [],
    },
  ],
  edition: "2026-10-05-morning",
});
const sportCodes = seasonPaper.sections.filter((s) => !["A", "B", "C"].includes(s.code)).map((s) => s.code);
assert(sportCodes.indexOf("EPL") < sportCodes.indexOf("NBA"), "the pager lists EPL before NBA in October");
assert(seasonPaper.pages.findIndex((p) => p.section === "EPL") < seasonPaper.pages.findIndex((p) => p.section === "NBA"), "EPL pages come before NBA");
assert(seasonPaper.sections[0]?.title === SECTION_A_TITLE, "Section A is labeled The Essentials");
assert(seasonPaper.pages.filter((p) => p.section === "A").every((p) => p.sectionTitle === SECTION_A_TITLE), "A pages say The Essentials");

const nationalLead = {
  id: "nat-lead",
  headline: "House passes the funding bill after an all-night vote",
  summary: "The chamber cleared the stopgap before dawn.",
  body: "The House passed a stopgap funding bill after an all-night session. ".repeat(8),
  url: "https://example.com/funding",
  source: "AP",
  credit: "AP",
  outlets: ["AP"],
  publishedAt: "2026-10-05T10:00:00Z",
  imageUrl: null,
  imageCredit: null,
};
const EVERY_DESK = ["Fox News", "WSJ", "New York Post", "Washington Examiner", "National Review", "AP", "Reuters"];
const attempt = {
  id: "nat-attempt",
  headline: "Trump survives assassination attempt at Pennsylvania rally",
  summary: "The former president was rushed from the stage after gunfire. Every national desk led with it.",
  body: "Gunfire rang out at a campaign rally in Pennsylvania. Secret Service rushed the former president from the stage. ".repeat(8),
  url: "https://example.com/attempt",
  source: "Fox News",
  credit: "Fox News, WSJ, AP",
  outlets: EVERY_DESK,
  publishedAt: "2026-10-05T10:00:00Z",
  imageUrl: null,
  imageCredit: null,
};
const war = {
  ...attempt,
  id: "nat-war",
  headline: "Russia launches a full-scale invasion of Ukraine",
  summary: "Columns crossed the border before dawn. Kyiv said a war has begun.",
  url: "https://example.com/war",
};
const flood = {
  ...attempt,
  id: "nat-flood",
  headline: "Catastrophic flood swallows the lower Mississippi",
  summary: "Towns from Cairo to New Orleans went under overnight.",
  url: "https://example.com/flood",
};
const confirmedDesk = {
  issueId: "2026-10-05-morning",
  day: "2026-10-05",
  edition: "morning" as const,
  label: "Morning",
  stories: [nationalLead, attempt],
  sources: [],
  editor: { model: "grok-4.6", fallback: false, rationale: "The attempt is the only historic story." },
  printedAt: "2026-10-05T11:00:00Z",
};
const fallbackDesk = { ...confirmedDesk, editor: { model: null, fallback: true, rationale: "" }, stories: [attempt] };
const thinCoverage = { ...attempt, outlets: ["AP", "Fox News"] };
assert(isHistoricNationalEvent(attempt.headline), "an assassination attempt is historic");
assert(isHistoricNationalEvent(war.headline), "a war starting is historic");
assert(isHistoricNationalEvent("Supreme Court overturns Roe in landmark ruling"), "a landmark Court ruling is historic");
assert(isHistoricNationalEvent("Stock market crash wipes out two trillion"), "a market crash is historic");
assert(isHistoricNationalEvent("Category 5 hurricane flattens the Gulf Coast"), "a huge disaster is historic");
assert(isHistoricNationalEvent("President resigns and leaves office at noon"), "a president leaving office is historic");
assert(isHistoricNationalEvent("Terrorist attack kills dozens in downtown Manhattan"), "a major terror attack is historic");
assert(!isHistoricNationalEvent(nationalLead.headline), "a funding bill is not historic");
assert(!isHistoricNationalEvent("Justices take up a challenge to a federal firearms rule"), "granting cert is not historic");
assert(isHistoricNationalStory(attempt, confirmedDesk), "historic + every desk + editor confirmation clears the gate");
assert(!isHistoricNationalStory(nationalLead, confirmedDesk), "ordinary national news fails the event test");
assert(!isHistoricNationalStory(thinCoverage, confirmedDesk), "historic copy without near-universal coverage stays in B");
assert(!isHistoricNationalStory(attempt, fallbackDesk), "historic copy without editor confirmation stays in B");
const moScout = {
  id: "mo-scout-1",
  source: "Missouri Scout",
  headline: "Kehoe signs the education bill",
  url: "https://example.com/scout",
  kind: "story" as const,
  photo: null,
  dek: "The governor signed the package in Jefferson City.",
  when: "2026-10-05T14:00:00Z",
};
const extras = essentialsFromDesks(confirmedDesk, { scout: moScout, items: [moScout], listen: [] });
assert(!extras.some((c) => c.id === "nat-lead"), "a funding bill stays in National News");
assert(
  extras.some((c) => c.id === "nat-attempt" && c.status === HISTORIC_NATIONAL_STATUS && isSectionAStory(c)),
  "a historic national story that every desk led with may run in Section A",
);
assert(extras.some((c) => c.id === "mo-scout-1" && isSectionAStory(c)), "MoScout qualifies for Section A");
const sampleExtras = essentialsFromDesks(sampleNationalDesk("2026-10-05-morning"), { scout: moScout, items: [moScout], listen: [] });
assert(
  sampleExtras.every((c) => c.sportLabel !== "National"),
  "a typical national slate puts zero national stories in Section A",
);
const capped = essentialsFromDesks(
  { ...confirmedDesk, stories: [attempt, war, flood] },
  { scout: null, items: [], listen: [] },
);
assert(capped.filter((c) => c.sportLabel === "National").length === 2, "even a historic day caps Section A at two national stories");
const withEssentials = buildEdition({
  stories: [tuesday, ...extras],
  clubs: [chiefs],
  edition: "2026-10-05-morning",
  national: confirmedDesk,
  missouri: { scout: moScout, items: [moScout], listen: [] },
});
assert(withEssentials.pages.some((p) => p.kind === "national"), "National pages stay in their section");
assert(withEssentials.pages.some((p) => p.kind === "missouri"), "Missouri pages stay in their section");
const aFront = withEssentials.pages.find((p) => p.kind === "favorites-front");
assert(
  aFront?.kind === "favorites-front" &&
    [aFront.lead, aFront.second, aFront.third, ...aFront.news].some((c) => c && (c.id === "nat-attempt" || c.id === "mo-scout-1")),
  "Section A may run a historic national story or Missouri, not the ordinary national lead",
);
assert(
  aFront?.kind === "favorites-front" &&
    [aFront.lead, aFront.second, aFront.third, ...aFront.news].every((c) => !c || c.id !== "nat-lead"),
  "the funding bill never reaches A1",
);

assert(
  insertCoachesFocus(["front", "recaps", "news", "teams", "form", "schedule"], true).join(",") ===
    "front,recaps,coaches,news,teams,form,schedule",
  "coaches sit after wraps, before the reference desks",
);
assert(
  insertCoachesFocus(["teams", "form", "schedule", "news"], true).join(",") ===
    "coaches,teams,form,schedule,news",
  "without wraps, coaches lead the reference desks",
);
assert(insertCoachesFocus(["recaps", "schedule"], false).join(",") === "recaps,schedule", "no flag, no coaches desk");

const mizzouCfb: ClubDesk = {
  key: "cfb-mizzou",
  shortName: "Missouri",
  logo: null,
  leaguePath: "football/college-football",
  record: "4-1",
  standing: "7th in SEC",
  division: [],
  stats: [],
  leaders: [],
  upcoming: [],
};
const mondayCfb = buildEdition({
  stories: [],
  clubs: [mizzouCfb],
  edition: "2026-10-05-morning",
  coachPaths: ["football/college-football"],
});
const mondayFocus = mondayCfb.pages
  .filter((p) => p.kind === "sport-front" && p.section === "CFB")
  .map((p) => (p.kind === "sport-front" ? p.focus : ""));
assert(mondayFocus[0] === "front", "Monday CFB still opens on the section front");
assert(!mondayFocus.includes("recaps"), "an empty wraps desk does not print");
assert(mondayFocus.includes("coaches"), "Favorite Coaches prints on Monday");
assert(mondayFocus.indexOf("coaches") < mondayFocus.indexOf("schedule"), "coaches print before the schedule");
assert(mondayFocus.indexOf("coaches") < mondayFocus.indexOf("teams"), "coaches print before standings");

const mondayDesk = buildEdition({
  stories: [],
  clubs: [mizzouCfb],
  edition: "2026-10-05-midday",
  coachPaths: ["football/college-football"],
});
const deskFocus = mondayDesk.pages
  .filter((p) => p.kind === "sport-front" && p.section === "CFB")
  .map((p) => (p.kind === "sport-front" ? p.focus : ""));
assert(deskFocus.includes("coaches"), "Monday midday still prints the coaches desk");
assert(deskFocus.indexOf("coaches") < deskFocus.indexOf("teams"), "midday coaches sit before standings");

assert(
  !buildEdition({
    stories: [],
    clubs: [mizzouCfb],
    edition: "2026-10-06-morning",
    coachPaths: ["football/college-football"],
  }).pages.some((p) => p.kind === "sport-front" && p.focus === "coaches"),
  "Tuesday skips the weekly coaches page",
);
assert(
  !buildEdition({
    stories: [],
    clubs: [mizzouCfb],
    edition: "2026-10-05-morning",
  }).pages.some((p) => p.kind === "sport-front" && p.focus === "coaches"),
  "no coaches on file, no coaches page",
);

const packersInjury = card({
  id: "league-packers-surgery",
  headline: "Packers RB to have season-ending surgery",
  dek: "Green Bay lost a starter for the year.",
  sportLabel: "NFL",
  leaguePath: "football/nfl",
  when: "2026-10-05T18:00:00Z",
  body: "The Packers said their running back will have season-ending surgery. ".repeat(6),
});
const broncosInjury = card({
  id: "league-broncos-ankle",
  headline: "Broncos WR doubtful with ankle injury",
  sportLabel: "NFL",
  leaguePath: "football/nfl",
  when: "2026-10-05T18:30:00Z",
  body: "Denver listed the receiver as doubtful. ".repeat(6),
});
assert(!isMajorStory(packersInjury), "a non-favorite injury is not major");
assert(!isSectionAStory(packersInjury), "Packers injury stays out of Section A");
assert(!isSectionAStory(broncosInjury), "Broncos injury stays out of Section A");

const chiefsFinal = card({
  id: "wire-nfl-kc-vegas",
  headline: "Chiefs beat the Raiders 30-27",
  favoriteKey: "nfl-kc",
  followed: true,
  teamName: "Chiefs",
  sportLabel: "NFL",
  leaguePath: "football/nfl",
  status: "Final",
  scoreLine: "KC 30 · LV 27",
  gameId: "401772901",
  when: "2026-10-04T20:15:00Z",
  body: "Patrick Mahomes led Kansas City back in Las Vegas. ".repeat(12),
});
const cowboysFinal = card({
  id: "wire-nfl-dal-hou",
  headline: "Cowboys hold off the Texans 34-30",
  favoriteKey: "nfl-dal",
  followed: true,
  teamName: "Cowboys",
  sportLabel: "NFL",
  leaguePath: "football/nfl",
  status: "Final",
  scoreLine: "DAL 34 · HOU 30",
  gameId: "401772902",
  when: "2026-10-04T17:00:00Z",
  body: "Dak Prescott threw for three scores in Houston. ".repeat(12),
});
const lionsFinal = card({
  id: "wire-nfl-det-car",
  headline: "Panthers hold off Lions in a SNF thriller",
  favoriteKey: "nfl-det",
  followed: true,
  teamName: "Lions",
  sportLabel: "NFL",
  leaguePath: "football/nfl",
  status: "Final",
  scoreLine: "CAR 32 · DET 26",
  gameId: "401772903",
  when: "2026-10-05T00:20:00Z",
  body: "Detroit came up short in Carolina on Sunday night. ".repeat(12),
});
assert(isSectionAStory(chiefsFinal) && isSectionAStory(cowboysFinal) && isSectionAStory(lionsFinal), "favorite finals belong in A");

const tuesdayFavorites = buildEdition({
  stories: [chiefsFinal, cowboysFinal, lionsFinal, packersInjury, broncosInjury],
  clubs: [chiefs],
  edition: "2026-10-06-morning",
});
const tuesdayEssentials = tuesdayFavorites.pages.filter((p) => p.section === "A");
const tuesdayAIds = JSON.stringify(tuesdayEssentials);
assert(tuesdayAIds.includes("wire-nfl-kc-vegas"), "Chiefs recap prints in Section A on Tuesday morning");
assert(tuesdayAIds.includes("wire-nfl-dal-hou"), "Cowboys recap prints in Section A on Tuesday morning");
assert(tuesdayAIds.includes("wire-nfl-det-car"), "Lions recap prints in Section A on Tuesday morning");
assert(!tuesdayAIds.includes("league-packers-surgery"), "Packers injury does not fill Section A");
assert(!tuesdayAIds.includes("league-broncos-ankle"), "Broncos injury does not fill Section A");
const tuesdayNflFront = tuesdayFavorites.pages.find((p) => p.kind === "sport-front" && p.section === "NFL" && p.focus === "front");
assert(
  tuesdayNflFront?.kind === "sport-front" && tuesdayNflFront.articles.every((a) => a.card.id !== "wire-nfl-kc-vegas"),
  "the full Chiefs recap stays in A and does not reprint on NFL1",
);
assert(
  tuesdayNflFront?.kind === "sport-front" && tuesdayNflFront.articles.some((a) => a.card.id === "league-packers-surgery"),
  "non-favorite injury runs in the NFL section",
);

const eveningFiled = fileEditionStories({
  fresh: [chiefsFinal, cowboysFinal, lionsFinal],
  carried: [],
  readKeys: new Set(),
  pressId: "2026-10-05-evening",
});
assert(eveningFiled.some((c) => c.id === "wire-nfl-kc-vegas"), "Monday evening still files Sunday's Chiefs final");
assert(eveningFiled.some((c) => c.id === "wire-nfl-dal-hou"), "Monday evening still files Sunday's Cowboys final");

const cfbEdition = buildEdition({
  stories: [
    card({
      id: "wire-cfb-miz",
      headline: "Mizzou 45, South Carolina 17",
      favoriteKey: "cfb-mizzou",
      followed: true,
      teamName: "Missouri",
      sportLabel: "College Football",
      leaguePath: "football/college-football",
      when: "2026-10-04T23:00:00Z",
      body: "Missouri rolled in Columbia. ".repeat(20),
    }),
  ],
  clubs: [mizzouCfb],
  edition: "2026-10-05-evening",
});
const cfbPaged = paginateEditionDesks(cfbEdition, {
  "football/college-football": Array.from({ length: 12 }, () => ({ rows: Array.from({ length: 14 }) })),
});
const cfbTeams = cfbPaged.pages.filter((p) => p.kind === "sport-front" && p.section === "CFB" && p.focus === "teams");
assert(cfbTeams.length === 2, "twelve CFB tables set in three columns fill two standings folios");
assert(
  cfbTeams.every((p) => p.kind === "sport-front" && (p.standSlice?.count ?? 0) <= 8),
  "each CFB standings folio holds what its columns hold",
);
const cfbFollowedOnly = paginateEditionDesks(cfbEdition, {
  "football/college-football": Array.from({ length: 2 }, () => ({ rows: Array.from({ length: 14 }) })),
});
const cfbFollowedTeams = cfbFollowedOnly.pages.filter(
  (p) => p.kind === "sport-front" && p.section === "CFB" && p.focus === "teams",
);
assert(cfbFollowedTeams.length === 1, "two followed CFB tables stay on one folio");
const cfbNone = paginateEditionDesks(cfbEdition, { "football/college-football": [] });
const cfbNoneTeams = cfbNone.pages.filter((p) => p.kind === "sport-front" && p.focus === "teams");
assert(
  cfbNoneTeams.length === 1 && cfbNoneTeams.every((p) => p.kind === "sport-front" && p.standSlice?.count === 0),
  "with no tables on file, the standings folio carries only the club form",
);

const copy = (s: string) => s.repeat(8);
const bearsWire = card({
  id: "league-50110486",
  headline: "Ben Johnson: Tyson Bagent will start at QB for Bears vs. Packers",
  dek: "Chicago turns to Bagent with Williams sidelined.",
  favoriteKey: "cfb-missouri-state",
  followed: true,
  teamName: "Bears",
  sportLabel: "NFL",
  leaguePath: "football/nfl",
  when: "2026-10-06T10:00:00Z",
  body: copy("The Bears will start Tyson Bagent against Green Bay. "),
});
const chiefsHillReturn = card({
  id: "news-50110299",
  headline: "Tyreek Hill to return to the Chiefs, agent says",
  dek: "Kansas City is back in play for the receiver.",
  favoriteKey: "nfl-kc",
  followed: true,
  teamName: "Chiefs",
  sportLabel: "NFL",
  leaguePath: "football/nfl",
  when: "2026-10-05T22:41:21Z",
  body: copy("Tyreek Hill is expected to return to Kansas City. "),
});
const moScoutToday = card({
  id: "mo-1x9ok2o",
  headline: "Mizzou notebook: the Tuesday brief",
  teamName: "Missouri Scout",
  sportLabel: "Missouri",
  when: "2026-10-06T11:00:00Z",
  wrapHref: "https://www.missouriscout.com/tuesday",
  body: copy("Missouri Scout files the day's Columbia notes. "),
});
const arizonaGiants = card({
  id: "wire-nfl-401872966",
  headline: "Giants beat Cardinals 36-24",
  dek: "Arizona fell on the road in New York.",
  favoriteKey: "mlb-stl",
  followed: true,
  teamName: "Cardinals",
  sportLabel: "NFL",
  leaguePath: "football/nfl",
  status: "Final",
  scoreLine: "NYG 36 · ARI 24",
  gameId: "401872966",
  when: "2026-10-06T03:00:00Z",
  body: copy("The New York Giants beat the Arizona Cardinals 36-24 on Sunday. "),
});
const mostCfb: ClubDesk = {
  key: "cfb-missouri-state",
  shortName: "MOST FB",
  logo: null,
  leaguePath: "football/college-football",
  record: "3-2",
  standing: "CUSA",
  division: [],
  stats: [],
  leaders: [],
  upcoming: [],
};
assert(isMoScoutCard(moScoutToday), "Missouri Scout files as MoScout");
assert(mayFrontA1(chiefsHillReturn, "2026-10-06-morning"), "Chiefs news may occupy A1");
assert(!mayFrontA1({ ...bearsWire, favoriteKey: "", followed: false }, "2026-10-06-morning"), "Bears copy may not occupy A1");
const stampedOct6 = stampFavoriteKeys(
  [bearsWire, chiefsHillReturn, moScoutToday, arizonaGiants],
  [chiefs, cards, mostCfb],
);
assert(!stampedOct6.find((c) => c.id === "league-50110486")?.favoriteKey, "NFL Bears drop the Missouri State stamp");
assert(stampedOct6.find((c) => c.id === "news-50110299")?.favoriteKey === "nfl-kc", "Chiefs keep the NFL desk");
assert(!stampedOct6.find((c) => c.id === "wire-nfl-401872966")?.favoriteKey, "Arizona Cardinals drop the St. Louis stamp");

const oct6Morning = buildEdition({
  stories: [bearsWire, chiefsHillReturn, moScoutToday, arizonaGiants],
  clubs: [chiefs, cards, mostCfb],
  edition: "2026-10-06-morning",
});
const oct6A1 = oct6Morning.pages.find((p) => p.kind === "favorites-front");
assert(oct6A1?.kind === "favorites-front", "Oct 6 morning still has A1");
assert(oct6A1?.kind === "favorites-front" && oct6A1.lead?.id === "news-50110299", `A1 lead is the Chiefs, not the Bears (got ${oct6A1 && oct6A1.kind === "favorites-front" ? oct6A1.lead?.id : "none"})`);
const oct6A1Ids = oct6A1?.kind === "favorites-front"
  ? [oct6A1.lead, oct6A1.second, oct6A1.third].map((c) => c?.id)
  : [];
assert(oct6A1Ids.includes("mo-1x9ok2o"), `today's MoScout is guaranteed an A1 slot (got ${oct6A1Ids.join(",")})`);
assert(!oct6A1Ids.includes("league-50110486"), "Bears vs Packers never occupies a big A1 slot");
assert(!oct6A1Ids.includes("wire-nfl-401872966"), "Arizona-Giants never occupies a big A1 slot");
const oct6AJson = JSON.stringify(oct6Morning.pages.filter((p) => p.section === "A"));
assert(!oct6AJson.includes("wire-nfl-401872966"), "Arizona-Giants is not a Section A full recap");
const oct6Nfl = oct6Morning.pages.filter((p) => p.kind === "sport-front" && p.section === "NFL");
assert(
  oct6Nfl.some((p) => p.kind === "sport-front" && p.articles.some((a) => a.card.id === "wire-nfl-401872966")),
  "Arizona-Giants lands on the NFL desk as a compact recap",
);

const tyreekTwin = card({
  id: "news-50112189",
  headline: "Tyreek Hill may return to Kansas City",
  favoriteKey: "nfl-kc",
  followed: true,
  teamName: "Chiefs",
  sportLabel: "NFL",
  leaguePath: "football/nfl",
  when: "2026-10-05T22:41:21Z",
  body: copy("Nate Taylor on how Tyreek Hill's return timing couldn't be better. "),
});
const twoHill = buildEdition({
  stories: [chiefsHillReturn, tyreekTwin, moScoutToday],
  clubs: [chiefs],
  edition: "2026-10-06-morning",
});
const twoHillA1 = twoHill.pages.find((p) => p.kind === "favorites-front");
const twoHillIds =
  twoHillA1?.kind === "favorites-front" ? [twoHillA1.lead, twoHillA1.second, twoHillA1.third].map((c) => c?.id) : [];
assert(
  !(twoHillIds.includes("news-50110299") && twoHillIds.includes("news-50112189")),
  "A1 does not print both Tyreek Hill packages",
);
const chourioA = card({
  id: "league-50105344",
  headline: "Jackson Chourio walk-off single lifts Brewers to 2-0 NLDS edge",
  sportLabel: "MLB",
  leaguePath: "baseball/mlb",
  when: "2026-10-06T03:00:00Z",
  body: copy("Jackson Chourio walked off the Padres in Milwaukee. "),
});
const chourioB = card({
  id: "athletic-chourio",
  headline: "Jackson Chourio joins rare company with a walk-off that will live on in October lore",
  sportLabel: "MLB",
  leaguePath: "baseball/mlb",
  when: "2026-10-06T03:10:00Z",
  body: copy("The Athletic on Chourio's October walk-off. "),
});
const aldsA = card({
  id: "league-alds-3a",
  headline: "How to watch ALDS Game 3: Rays at Yankees",
  sportLabel: "MLB",
  leaguePath: "baseball/mlb",
  when: "2026-10-06T03:20:00Z",
  body: copy("Game 3 of the ALDS is Tuesday night in the Bronx. "),
});
const aldsB = card({
  id: "league-alds-3b",
  headline: "ALDS Game 3 preview: Yankees face elimination",
  sportLabel: "MLB",
  leaguePath: "baseball/mlb",
  when: "2026-10-06T03:30:00Z",
  body: copy("New York hosts Tampa Bay in ALDS Game 3. "),
});
const mlbDup = buildEdition({
  stories: [chourioA, chourioB, aldsA, aldsB],
  clubs: [cards],
  edition: "2026-10-06-morning",
});
const mlbJson = JSON.stringify(mlbDup.pages.filter((p) => p.kind === "sport-front" && p.section === "MLB"));
assert(
  !(mlbJson.includes("league-50105344") && mlbJson.includes("athletic-chourio")),
  "MLB does not print both Chourio walk-off packages",
);
assert(
  !(mlbJson.includes("league-alds-3a") && mlbJson.includes("league-alds-3b")),
  "MLB does not list ALDS Game 3 twice",
);

const sixersBox = card({
  id: "box-nba-401898999",
  headline: "Knicks 97, 76ers 120",
  favoriteKey: "nba-phi",
  followed: true,
  teamName: "76ers",
  sportLabel: "NBA",
  leaguePath: "basketball/nba",
  status: "Final",
  scoreLine: "NY 97 · PHI 120",
  wrapKind: "box",
  caption: "Times box wrap",
  when: "2026-10-06T02:00:00Z",
  body: copy("Philadelphia 76ers beat New York Knicks 120-97 in preseason play. "),
  editorFront: 0,
});
const cowboysNote = card({
  id: "news-cowboys-midday",
  headline: "Cowboys get healthy ahead of Tampa Bay",
  favoriteKey: "nfl-dal",
  followed: true,
  teamName: "Cowboys",
  sportLabel: "NFL",
  leaguePath: "football/nfl",
  when: "2026-10-06T15:00:00Z",
  body: copy("Dallas listed several starters as full participants on Tuesday. "),
});
assert(isA1Muted(sixersBox, "2026-10-06-midday"), "a 76ers box wrap is muted for A1");
assert(!mayFrontA1(sixersBox, "2026-10-06-midday"), "76ers may not occupy A1");
assert(cannotLeadFront(sixersBox, [sixersBox, cowboysNote, moScoutToday]), "76ers never open the paper");
assert(mayFrontA1(cowboysNote, "2026-10-06-midday"), "Cowboys news may occupy A1");
const knicksWire = card({
  id: "league-knicks-kat",
  headline: "Stephen A. sounds off on James Dolan, Knicks for their handling of KAT negotiations",
  teamName: "New York Knicks",
  sportLabel: "Nba",
  leaguePath: "basketball/nba",
  when: "2026-10-06T15:22:05Z",
  body: copy("Stephen A. Smith criticized the Knicks' talks with Karl-Anthony Towns. "),
});
assert(isA1Muted(knicksWire, "2026-10-06-midday"), "non-favorite NBA stays off A1");
const middaySixers = buildEdition({
  stories: [sixersBox, cowboysNote, moScoutToday, knicksWire],
  clubs: [
    { key: "nba-phi", shortName: "76ers", logo: null, leaguePath: "basketball/nba", record: "0-0", standing: null, division: [], stats: [], leaders: [], upcoming: [] },
    { key: "nfl-dal", shortName: "Cowboys", logo: null, leaguePath: "football/nfl", record: "3-2", standing: null, division: [], stats: [], leaders: [], upcoming: [] },
  ],
  edition: "2026-10-06-midday",
});
const middayA1 = middaySixers.pages.find((p) => p.kind === "favorites-front");
const middayIds =
  middayA1?.kind === "favorites-front" ? [middayA1.lead, middayA1.second, middayA1.third].map((c) => c?.id) : [];
assert(
  middayA1?.kind === "favorites-front" && middayA1.lead?.id !== "box-nba-401898999",
  `A1 does not lead with the 76ers box wrap (got ${middayA1 && middayA1.kind === "favorites-front" ? middayA1.lead?.id : "none"})`,
);
assert(!middayIds.includes("box-nba-401898999"), "76ers box wrap never occupies an A1 slot");
assert(
  middayA1?.kind === "favorites-front" &&
    !middayA1.briefs.some((c) => c.id === "box-nba-401898999") &&
    !middayA1.news.some((c) => c.id === "box-nba-401898999"),
  "76ers is not on the A1 page as a brief or under-story",
);
assert(!middayIds.includes("league-knicks-kat"), "non-favorite NBA never occupies an A1 slot");
assert(middayIds.includes("news-cowboys-midday") || middayIds.includes("mo-1x9ok2o"), "Cowboys or today's MoScout take the front");
assert(
  a1ComingUp([
    { id: "sixers", favoriteKey: "nba-phi" },
    { id: "cowboys", favoriteKey: "nfl-dal" },
  ]).map((g) => g.id).join(",") === "cowboys",
  "A1 Coming Up drops the 76ers",
);

const mizzouSatBox = card({
  id: "box-football/college-football-401856708",
  headline: "No. 25 Missouri trounces No. 8 Florida 45-17 to snap 9-game skid against Top 25 opponents",
  favoriteKey: "cfb-mizzou",
  followed: true,
  teamName: "Missouri",
  sportLabel: "College Football",
  leaguePath: "football/college-football",
  status: "Final",
  scoreLine: "MIZ 45 · FLA 17",
  wrapKind: "box",
  caption: "Times box wrap",
  when: "2026-10-03T19:50:00Z",
  body: copy("Austin Simmons threw for 340 yards and two touchdowns as Missouri trounced Florida 45-17 on Saturday. "),
});
const mizzouSatUndated = { ...mizzouSatBox, id: "wire-college-football-401856708", when: null };
const lionsSunBox = card({
  id: "box-football/nfl-401872978",
  headline: "Young, McMillan connect for 2 TDs to lead Panthers past Lions 32-26",
  favoriteKey: "nfl-det",
  followed: true,
  teamName: "Lions",
  sportLabel: "NFL",
  leaguePath: "football/nfl",
  status: "Final",
  scoreLine: "DET 26 · CAR 32",
  wrapKind: "box",
  when: "2026-10-05T00:20:00Z",
  body: copy("Carolina held off Detroit on Sunday night. "),
});
const tuesdayMizzouFinal = card({
  id: "box-cfb-mizzou-today",
  headline: "Missouri holds off Vanderbilt 27-24",
  favoriteKey: "cfb-mizzou",
  followed: true,
  teamName: "Missouri",
  sportLabel: "College Football",
  leaguePath: "football/college-football",
  status: "Final",
  scoreLine: "MIZ 27 · VAN 24",
  when: "2026-10-06T16:00:00Z",
  body: copy("Missouri won in Columbia on Tuesday. "),
});
assert(isStaleA1Result(mizzouSatBox, "2026-10-06-midday"), "Saturday CFB is stale on Tuesday midday");
assert(isStaleA1Result(mizzouSatBox, "2026-10-06-morning"), "Saturday CFB is stale on Tuesday morning");
assert(!isStaleA1Result(mizzouSatBox, "2026-10-05-evening"), "Saturday CFB may still front Monday evening");
assert(!isStaleA1Result(mizzouSatBox, "2026-10-05-morning"), "Saturday CFB may still front Monday morning");
assert(isStaleA1Result(mizzouSatUndated, "2026-10-06-midday"), "undated CFB that reads as Saturday is stale after Monday");
assert(!isStaleA1Result(mizzouSatUndated, "2026-10-05-evening"), "undated Saturday CFB may still front Monday");
assert(isStaleA1Result(lionsSunBox, "2026-10-06-midday"), "Sunday NFL is stale on Tuesday A1");
assert(
  !isStaleA1Result(
    card({
      id: "wire-nfl-mnf-tue",
      headline: "Chiefs beat the Raiders on Monday night",
      favoriteKey: "nfl-kc",
      followed: true,
      teamName: "Chiefs",
      status: "Final",
      scoreLine: "KC 30 · LV 27",
      when: "2026-10-06T03:30:00Z",
      body: copy("Kansas City closed it in the fourth quarter. "),
    }),
    "2026-10-06-midday",
  ),
  "Monday night may still front Tuesday",
);
assert(!isStaleA1Result(tuesdayMizzouFinal, "2026-10-06-midday"), "a current-day favorite wrap may still front");
assert(!isStaleA1Result(moScoutToday, "2026-10-06-midday"), "today's MoScout is not a stale game result");
assert(!isStaleA1Result(cowboysNote, "2026-10-06-midday"), "current-day club news is not a stale game result");
assert(isA1Muted(mizzouSatBox, "2026-10-06-midday"), "Saturday Mizzou wrap is muted for Tuesday A1");
assert(!mayFrontA1(mizzouSatBox, "2026-10-06-midday"), "Saturday Mizzou may not occupy Tuesday A1");
assert(mayFrontA1(mizzouSatBox, "2026-10-05-evening"), "Saturday Mizzou may occupy Monday A1");
assert(mayFrontA1(tuesdayMizzouFinal, "2026-10-06-midday"), "Tuesday's Mizzou result may occupy A1");
assert(
  !cannotLeadFront(moScoutToday, [mizzouSatBox, lionsSunBox, moScoutToday, cowboysNote], "2026-10-06-midday"),
  "stale leftovers do not block today's MoScout from the front",
);
const tuesdayStale = buildEdition({
  stories: [mizzouSatBox, lionsSunBox, cowboysNote, moScoutToday],
  clubs: [
    { key: "cfb-mizzou", shortName: "Mizzou", logo: null, leaguePath: "football/college-football", record: "4-1", standing: "8th in SEC", division: [], stats: [], leaders: [], upcoming: [] },
    { key: "nfl-det", shortName: "Lions", logo: null, leaguePath: "football/nfl", record: "3-2", standing: null, division: [], stats: [], leaders: [], upcoming: [] },
    { key: "nfl-dal", shortName: "Cowboys", logo: null, leaguePath: "football/nfl", record: "3-2", standing: null, division: [], stats: [], leaders: [], upcoming: [] },
  ],
  edition: "2026-10-06-midday",
});
const tuesdayStaleA1 = tuesdayStale.pages.find((p) => p.kind === "favorites-front");
const tuesdayStaleIds =
  tuesdayStaleA1?.kind === "favorites-front"
    ? [tuesdayStaleA1.lead, tuesdayStaleA1.second, tuesdayStaleA1.third].map((c) => c?.id)
    : [];
assert(
  tuesdayStaleA1?.kind === "favorites-front" && tuesdayStaleA1.lead?.id !== "box-football/college-football-401856708",
  `Tuesday midday does not lead with Saturday CFB (got ${tuesdayStaleA1 && tuesdayStaleA1.kind === "favorites-front" ? tuesdayStaleA1.lead?.id : "none"})`,
);
assert(!tuesdayStaleIds.includes("box-football/college-football-401856708"), "Saturday Mizzou never occupies a Tuesday A1 slot");
assert(!tuesdayStaleIds.includes("box-football/nfl-401872978"), "Sunday Lions never occupy a Tuesday A1 slot");
assert(
  tuesdayStaleA1?.kind === "favorites-front" &&
    !tuesdayStaleA1.briefs.some((c) => c.id === "box-football/college-football-401856708" || c.id === "box-football/nfl-401872978") &&
    !tuesdayStaleA1.news.some((c) => c.id === "box-football/college-football-401856708" || c.id === "box-football/nfl-401872978"),
  "stale prior-day results are not A1 briefs or under-stories",
);
assert(
  tuesdayStaleIds.includes("news-cowboys-midday") || tuesdayStaleIds.includes("mo-1x9ok2o"),
  `current-day Cowboys news or MoScout take the Tuesday front (got ${tuesdayStaleIds.join(",")})`,
);
assert(
  a1ComingUp([
    { id: "blues", favoriteKey: "nhl-stl", when: "Tue, Oct 6, 7:00 PM" },
    { id: "cowboys", favoriteKey: "nfl-dal", when: "Thu, Oct 8, 7:15 PM" },
    { id: "mizzou-sat", favoriteKey: "cfb-mizzou" },
  ]).map((g) => g.id).join(",") === "blues,cowboys,mizzou-sat",
  "A1 Coming Up keeps tonight's Blues and Thursday's Cowboys",
);

console.log("newspaper-sections ok");
