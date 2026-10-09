/**
 * Run with: node --experimental-strip-types src/lib/newspaper-window.test.ts
 * from CommandCenter-main/.
 */
import type { GameWrapCard } from "./newspaper-sports.ts";
import { buildEdition, type ClubDesk } from "./newspaper-sections.ts";
import { paperImgAttrs } from "./newspaper-img-attrs.ts";
import {
  PAGE_WINDOW,
  mountedPageIndexes,
  pageShouldMount,
  readerFolioIndex,
} from "./newspaper-window.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(PAGE_WINDOW === 2, "the reader keeps two folios on either side of the current page");

assert(JSON.stringify(mountedPageIndexes(0, 40)) === JSON.stringify([0, 1, 2]), "A1's window is A1 and the next two");
assert(
  JSON.stringify(mountedPageIndexes(8, 40)) === JSON.stringify([6, 7, 8, 9, 10]),
  "a middle page mounts five sheets",
);
assert(mountedPageIndexes(8, 40).length === 5, "current ±2 is five pages when the book is long enough");
assert(
  JSON.stringify(mountedPageIndexes(39, 40)) === JSON.stringify([37, 38, 39]),
  "the last page clamps the window",
);
assert(JSON.stringify(mountedPageIndexes(0, 1)) === JSON.stringify([0]), "a one-page edition mounts that page");
assert(JSON.stringify(mountedPageIndexes(-4, 10)) === JSON.stringify([0, 1, 2]), "a negative index clamps to A1");
assert(JSON.stringify(mountedPageIndexes(99, 10)) === JSON.stringify([7, 8, 9]), "an index past the end clamps to the last page");
assert(mountedPageIndexes(0, 0).length === 0, "an empty book mounts nothing");

assert(pageShouldMount(0, 0, false) && !pageShouldMount(1, 0, false), "A1 mounts alone before the first paint settles");
assert(!pageShouldMount(2, 0, false), "neighbors are not built until A1 has painted");
assert(
  pageShouldMount(0, 0, true) && pageShouldMount(1, 0, true) && pageShouldMount(2, 0, true) && !pageShouldMount(3, 0, true),
  "after A1 paints, the front window is current ±2",
);
assert(
  [5, 6, 7, 8, 9].every((index) => pageShouldMount(index, 7, false)) && !pageShouldMount(4, 7, false),
  "leaving A1 mounts the window immediately, even before the settle flag",
);
assert(!pageShouldMount(20, 7, true), "a far sheet stays a placeholder");

const lazy = paperImgAttrs();
const eager = paperImgAttrs(true);
assert(lazy.loading === "lazy" && lazy.decoding === "async" && lazy.fetchPriority === undefined, "logos and later photos stay lazy");
assert(eager.loading === "eager" && eager.decoding === "async" && eager.fetchPriority === "high", "the A1 lead photo stays eager");

function impliedSport(key: string | undefined): { sportLabel: string; leaguePath: string } {
  if (key?.startsWith("mlb-")) return { sportLabel: "MLB", leaguePath: "baseball/mlb" };
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
  stories: [
    card({
      id: "news-injury",
      headline: "Chiefs list Kelce as questionable for Sunday",
      favoriteKey: "nfl-kc",
      followed: true,
      teamName: "Chiefs",
      when: "2026-09-29T18:00:00Z",
      dek: "Kansas City will not decide until Friday.",
      body: "Kansas City listed Travis Kelce as questionable with a knee. The club plays Sunday. ".repeat(2),
    }),
    card({
      id: "news-cards",
      headline: "Cardinals add a bat for the winter",
      favoriteKey: "mlb-stl",
      followed: true,
      teamName: "Cardinals",
      sportLabel: "MLB",
      leaguePath: "baseball/mlb",
      when: "2026-09-30T10:00:00Z",
      body: "St. Louis spent the offseason meeting on a corner bat. ".repeat(3),
    }),
  ],
  clubs: [chiefs, cards],
  edition: "2026-09-30",
});

assert(paper.pages.length > 5, "the fixture prints more than a five-page window");
const nfl1 = paper.pages.findIndex((page) => page.folio === "NFL1");
assert(nfl1 > 2, "NFL starts after A1's own neighbors");
const five = mountedPageIndexes(nfl1, paper.pages.length);
assert(five.length === 5, "the sample window mounts five pages");
assert(!five.includes(0), "this window does not include A1");

const full = readerFolioIndex(paper);
const windowed = readerFolioIndex(paper, five);
assert(JSON.stringify(full) === JSON.stringify(windowed), "Inside Today, section numbers, and jumps match with 5 pages mounted");

const nflPages = full.sectionPages.filter((page) => page.section === "NFL");
const nflCount = nflPages[0]?.sectionCount ?? 0;
const mountedNfl = five.filter((index) => paper.pages[index]?.section === "NFL").length;
assert(nflCount > mountedNfl, "the NFL section is larger than the pages of it inside the window");
assert(
  nflPages.every((page) => page.sectionCount === nflCount && page.sectionPage >= 1),
  "every NFL folio keeps the full section count",
);
const insideNfl = full.insideToday.find((section) => section.code === "NFL");
assert(insideNfl?.pages === nflCount, "Inside Today page count is the whole NFL section");
assert(insideNfl?.folio === "NFL1", "Inside Today still jumps to the section front");
assert(full.sectionPages.some((page) => page.folio === "A1" && page.sectionPage === 1), "A1's section number is counted even when A1 is unmounted");
assert(
  full.sectionPages.length === paper.pages.length,
  "folio numbers cover the book, not the mounted slice",
);

const slicedCounts = new Map<string, number>();
for (const index of five) {
  const section = paper.pages[index]!.section;
  slicedCounts.set(section, (slicedCounts.get(section) ?? 0) + 1);
}
assert(
  [...slicedCounts.entries()].some(([section, count]) => {
    const printed = full.sectionPages.find((page) => page.section === section)?.sectionCount;
    return printed !== count;
  }),
  "counting only the mounted sheets would change a section's page count",
);

console.log("newspaper-window ok");
