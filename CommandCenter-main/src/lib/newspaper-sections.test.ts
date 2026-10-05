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
  isColumnStory,
  isDeskStory,
  isHoldoverGame,
  isPreviewStory,
  MIN_SECTION_PAGES,
  sortComingUp,
  sourceStoryId,
  staleNamedPackage,
  storyBodyForJump,
  type ClubDesk,
} from "./newspaper-sections.ts";
import { sampleNationalDesk } from "./newspaper-national.ts";

assert(favoriteDeskWeight("mlb-stl") === 100, "Cardinals are home desk");
assert(favoriteDeskWeight("nhl-stl") === 100, "Blues are home desk");
assert(favoriteDeskWeight("cfb-mizzou") === 100, "Mizzou is home desk");
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
assert(folios.includes("NFL4") && folios.includes("NFL5"), "NFL has schedule + form pages");
assert(folios.includes("MLB1") && folios.includes("MLB5"), "MLB has a full five-page desk");

const a = paper.pages[0];
assert(a?.kind === "favorites-front" && a.lead?.id === "news-cards", "Cardinals desk weight leads Section A over Chiefs copy");
assert(
  a?.kind === "favorites-front" && a.news.some((story) => story.id === "news-injury"),
  "Tuesday's Chiefs story still runs",
);
const formPage = paper.pages.find((page) => page.kind === "favorites-form");
assert(
  formPage?.kind === "favorites-form" && formPage.clubs[0]?.key === "mlb-stl",
  "club-form pages list Cardinals before Chiefs",
);
assert(a?.kind === "favorites-front" && a.news.every((story) => story.id !== "wire-nfl-weekend"), "weekend score stays off A1 fresh list");
assert(a?.kind === "favorites-front", "A1 is the favorites front");
assert(
  !a?.jumpFolio,
  "A1 no longer invents a next-page jump — clubs desk is a labeled trail",
);

const nfl = paper.pages.find((page) => page.folio === "NFL1");
assert(nfl?.kind === "sport-front" && nfl.focus === "recaps", "NFL1 is the football recaps page");
if (nfl?.kind === "sport-front") {
  assert(nfl.upcoming.some((game) => game.label === "at Ravens"), "the section carries the upcoming schedule");
  assert(!nfl.upcoming.some((game) => /dolphins/i.test(game.label)), "last weekend is not the schedule");
  assert(nfl.clubs[0]?.division.some((row) => row.me && row.team === "Chiefs"), "standings mark your club");
  assert(nfl.clubs[0]?.stats.some((stat) => stat.label === "PF"), "season stats run with the table");
  assert(nfl.articles.every((article) => article.card.id !== "news-injury"), "a followed club's story runs in Section A, not NFL");
  assert(nfl.articles.every((article) => article.card.id !== "wire-nfl-weekend"), "weekend recap is too old for a fresh midweek desk");
}
const nflSched = paper.pages.find((page) => page.folio === "NFL2");
assert(nflSched?.kind === "sport-front" && nflSched.focus === "schedule", "NFL2 is the schedule page");
const nflNews = paper.pages.find((page) => page.folio === "NFL3");
assert(nflNews?.kind === "sport-front" && nflNews.focus === "news", "NFL3 is the football news page");
const nflTeams = paper.pages.find((page) => page.folio === "NFL4");
assert(nflTeams?.kind === "sport-front" && nflTeams.focus === "teams", "NFL4 is the all-teams page");
const nflForm = paper.pages.find((page) => page.folio === "NFL5");
assert(nflForm?.kind === "sport-front" && nflForm.focus === "form", "NFL5 is the club form page");

const mlb = paper.pages.find((page) => page.folio === "MLB1");
assert(
  mlb?.kind === "sport-front" && mlb.articles.every((article) => article.card.id !== "news-cards"),
  "Cardinals copy stays out of the MLB section",
);
assert(
  paper.pages.every((page) => page.kind !== "sport-inside" || (page.primary.id !== "news-cards" && page.secondary?.id !== "news-cards")),
  "no MLB story page carries a Cardinals story",
);
const mlbPlayoffs = paper.pages.find((page) => page.folio === "MLB5");
assert(mlbPlayoffs?.kind === "sport-front" && mlbPlayoffs.focus === "playoffs", "MLB5 is the playoff tree page");
assert((paper.sections.find((s) => s.code === "NFL")?.pages ?? 0) >= MIN_SECTION_PAGES, "NFL section always has at least five pages");
assert((paper.sections.find((s) => s.code === "A")?.pages ?? 0) >= MIN_SECTION_PAGES, "A always has at least five pages");
assert((paper.sections.find((s) => s.code === "MLB")?.pages ?? 0) >= MIN_SECTION_PAGES, "MLB always has at least five pages");
assert(!paper.pages.some((page) => page.folio === "NFL6"), "no league copy, no NFL story page");
assert(paper.pages.some((page) => page.kind === "favorites-form"), "Section A pads with club-form pages");

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
assert(withLeague.pages.some((page) => page.folio === "NFL6"), "league story copy gets an inside page after the desk pages");
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
const nflWithLeague = withLeague.pages.find((page) => page.kind === "sport-front" && page.section === "NFL" && page.focus === "news");
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
assert(
  withJump.pages[1]?.kind === "favorites-clubs",
  "A2 stays the clubs desk between the tease and the jump",
);

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

const nflPlayers = withDesks.pages.find((page) => page.folio === "NFL6");
assert(nflPlayers?.kind === "sport-front" && nflPlayers.focus === "players", "a sport with followed players gets NFL6");
assert(!deskFolios.includes("MLB6"), "no players page without followed players in the league");
assert(!buildEdition({ stories: [lionsNote], clubs: [lionsClub], edition }).pages.some((p) => p.kind === "missouri"), "no desk, no section");

const offPaper = buildEdition({ stories: [chiefsNote], clubs: [chiefs], edition, offseason: ["football/nfl"] });
const offDesks = offPaper.pages.filter((p) => p.kind === "sport-front" && p.path === "football/nfl");
assert(
  offDesks.map((p) => (p.kind === "sport-front" ? `${p.folio}:${p.focus}` : "")).join(",") ===
    "NFL1:news,NFL2:opener,NFL3:teams",
  "an offseason section runs news, the countdown and last season's tables",
);
assert(
  offDesks.every((p) => p.kind === "sport-front" && p.offseason),
  "offseason desks know they are between seasons",
);
const offTurn = offDesks[0]?.kind === "sport-front" ? offDesks[0].turn : null;
assert(offTurn?.folio === "NFL2" && offTurn.focus === "opener", "the front turns to the countdown");
const offLast = offDesks[2]?.kind === "sport-front" ? offDesks[2].turn : undefined;
assert(offLast === null, "the last desk has no turn line");

const bluesPreview = card({
  id: "news-blues-preview",
  favoriteKey: "nhl-stl",
  headline: "Stars host the Blues to start 2026 season",
  body: "St. Louis Blues (0-0-0) at Dallas Stars (0-0-0). BOTTOM LINE: The Stars open the season at home. ".repeat(6),
  when: "2026-09-29T20:00:00Z",
});
const cardsColumn = card({
  id: "news-cards-column",
  favoriteKey: "mlb-stl",
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
assert(eveningNfl?.kind === "sport-front" && eveningNfl.focus === "teams", "afternoon sports open on the table");
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
const athleticPage = spiked.pages.find((page) => page.kind === "sport-front" && page.section === "NHL" && page.focus === "news");
assert(
  athleticPage?.kind === "sport-front" && athleticPage.articles.some((article) => article.card.id === "athletic-1"),
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
  assert(nflFocuses.indexOf("leaders") === nflFocuses.indexOf("teams") + (press.endsWith("morning") ? 1 : 2), `${press}: leaders sit by the standings`);
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
assert(
  sundayNflRecaps?.kind === "sport-front" && sundayNflRecaps.articles.length >= 14,
  "the recaps desk lists every in-window NFL final",
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
assert(firstNfl?.kind === "sport-front" && firstNfl.focus === "recaps", "morning sport sections open on recaps");
assert(
  recapsPage?.kind === "sport-front" && recapsPage.articles[0]?.card.id === "wire-nfl-kc-lead",
  "the favorite-team game leads the NFL recaps desk",
);
assert(
  recapsPage?.kind === "sport-front" && recapsPage.articles.some((a) => a.card.id === "wire-nfl-ind-lead"),
  "the rest of Sunday's wraps still run",
);
assert(
  !JSON.stringify(recapsFirst.pages.filter((p) => p.section === "NFL")).includes("league-highlights"),
  "video clips are spiked from the NFL section",
);
const newsPage = recapsFirst.pages.find((p) => p.kind === "sport-front" && p.section === "NFL" && p.focus === "news");
assert(
  newsPage?.kind === "sport-front" && newsPage.articles.length <= 8 && newsPage.articles.length >= 6,
  `news is capped ~6–8, got ${newsPage && newsPage.kind === "sport-front" ? newsPage.articles.length : 0}`,
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

const coming = sortComingUp([
  { id: "mizzou-bb", when: "Tue, Nov 3", startIso: "2026-11-03T05:00:00Z" },
  { id: "sixers", when: "Mon, Oct 5, 6:00 PM", startIso: "2026-10-05T23:00:00Z" },
  { id: "blues", when: "Tue, Oct 6, 7:00 PM", startIso: "2026-10-07T00:00:00Z" },
  { id: "mizzou-fb", when: "Sat, Oct 10, 11:00 AM", startIso: "2026-10-10T16:00:00Z" },
  { id: "same-day-open", when: "Tue, Oct 6", startIso: "2026-10-06T05:00:00Z" },
]);
assert(
  coming.map((g) => g.id).join(",") === "sixers,blues,same-day-open,mizzou-fb,mizzou-bb",
  `Coming Up is chronological, date-only last that day: ${coming.map((g) => g.id).join(",")}`,
);
assert(comingUpHasClock("Mon, Oct 5, 6:00 PM") && !comingUpHasClock("Tue, Nov 3"), "clock vs date-only");

console.log("newspaper-sections ok");
