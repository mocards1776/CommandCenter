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
  isResultCopy,
  msUntilNextPress,
  pressEdition,
  splitStoryCopy,
} from "./newspaper.ts";
import {
  buildEdition,
  isDeskStory,
  isPreviewStory,
  MIN_SECTION_PAGES,
  type ClubDesk,
} from "./newspaper-sections.ts";

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
assert(nfl?.kind === "sport-front" && nfl.focus === "news", "NFL1 is the football news page");
if (nfl?.kind === "sport-front") {
  assert(nfl.upcoming.some((game) => game.label === "at Ravens"), "the section carries the upcoming schedule");
  assert(!nfl.upcoming.some((game) => /dolphins/i.test(game.label)), "last weekend is not the schedule");
  assert(nfl.clubs[0]?.division.some((row) => row.me && row.team === "Chiefs"), "standings mark your club");
  assert(nfl.clubs[0]?.stats.some((stat) => stat.label === "PF"), "season stats run with the table");
  assert(nfl.articles.every((article) => article.card.id !== "news-injury"), "a followed club's story runs in Section A, not NFL");
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
  when: "2026-09-30T14:00:00Z",
  body: "Around the league, clubs shuffled the practice report and the waiver wire. ".repeat(8),
});
const leagueShort = card({
  id: "league-wire-2",
  headline: "Bills sign a punter",
  teamName: "Bills",
  when: "2026-09-30T13:00:00Z",
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
  when: "2026-09-30T12:00:00Z",
  body: "The Arsenal manager spoke for twenty minutes. ".repeat(12),
});
const arsenalLeague = card({
  id: "league-arsenal",
  headline: "Arsenal and Chelsea split the points",
  teamName: "League",
  sportLabel: "EPL",
  leaguePath: "soccer/eng.1",
  when: "2026-09-30T12:00:00Z",
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
const tuesdayFront = tuesdayPaper.pages[0];
if (tuesdayFront?.kind === "favorites-front") {
  const ids = tuesdayFront.news.map((story) => story.id);
  assert(ids.includes("news-kelce"), "Monday's injury note is Tuesday's news");
  assert(ids.includes("wire-nfl-mnf"), "Monday night's final is Tuesday's result");
}
const tuesdayA = tuesdayPaper.pages[0];
assert(
  tuesdayA?.kind === "favorites-front" &&
    tuesdayA.news.every((story) => story.id !== "news-lions-sunday"),
  "Sunday's rewrite does not lead Tuesday's favorites front",
);

// Same-day club notes: Lions copy outranks Chiefs on the favorites desk.
const lionsNote = card({
  id: "news-lions-note",
  headline: "Lions elevate a practice-squad receiver",
  favoriteKey: "nfl-det",
  followed: true,
  teamName: "Lions",
  when: "2026-09-30T16:00:00Z",
  body: "Detroit signed the receiver and will see if he sticks on game day. ".repeat(2),
});
const chiefsNote = card({
  id: "news-chiefs-note",
  headline: "Chiefs shuffle the practice report",
  favoriteKey: "nfl-kc",
  followed: true,
  teamName: "Chiefs",
  when: "2026-09-30T16:05:00Z",
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
  when: "2026-09-30T17:00:00Z",
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
    [quietFront.lead, quietFront.second, quietFront.third].some((c) => c?.id === "news-cards-finale"),
  "a club whose season just ended still makes the Section A front",
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
assert(moPages.length === 3 && moPages[0]!.folio === "MO1", "Missouri files its own section");
assert(
  deskFolios.indexOf("MO1") > deskFolios.indexOf("A1") && deskFolios.indexOf("MO1") < deskFolios.indexOf("NFL1"),
  "Missouri runs between Section A and sports",
);
assert(
  moPages[0]?.kind === "missouri" && moPages[0].listen.length === 1 && moPages[1]?.kind === "missouri" && !moPages[1].listen.length,
  "only the Missouri front carries the listen rail",
);
assert(withDesks.sections.some((s) => s.code === "MO"), "Missouri gets a section tab");
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
  when: "2026-09-29T12:00:00Z",
});
const cardsColumn = card({
  id: "news-cards-column",
  favoriteKey: "mlb-stl",
  headline: "Hochman: Gorman, Baez and Bohm and the Cardinals' infield",
  body: "The Cardinals have choices to make at third base this winter. ".repeat(12),
  when: "2026-09-29T12:00:00Z",
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
assert(at("2026-10-01T22:30:00Z").id === "2026-10-01-evening" && at("2026-10-01T22:30:00Z").next === "6 a.m.", "5 p.m. is the evening edition");
const untilNoon = msUntilNextPress(new Date("2026-10-01T11:30:00Z"));
assert(untilNoon > 5 * 3_600_000 && untilNoon < 6 * 3_600_000, "the morning paper holds until noon");

console.log("newspaper-sections ok");
