/**
 * Run with: node --experimental-strip-types src/lib/newspaper-sport-desk.test.ts
 * from CommandCenter-main/.
 */
import type { GameWrapCard } from "./newspaper-sports.ts";
import {
  attachRelatedGameCopy,
  groupSportRecaps,
  isInjuryNote,
  isSecCard,
  isSportFiller,
  orderSportRecaps,
  orderSportSectionFront,
  sportFillerReason,
  storyFitsSection,
} from "./newspaper-sport-desk.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
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

const wrap = card({
  id: "wire-nfl-kc",
  headline: "Chiefs beat the Raiders",
  scoreLine: "KC 30 · LV 27",
  gameId: "401772958",
  status: "Final",
  wrapKind: "espn",
  body: "Kansas City won in Las Vegas. ".repeat(8),
});
const athletic = card({
  id: "athletic-kc",
  headline: "What the Chiefs-Raiders tape said about Mahomes",
  caption: "The Athletic",
  gameId: "401772958",
  wrapHref: "https://www.nytimes.com/athletic/chiefs-raiders",
  body: "The Athletic on the Chiefs. ".repeat(10),
});
const video = card({
  id: "league-vid",
  headline: "Game Highlights: Chiefs vs Raiders",
  status: "Video",
  wrapHref: "https://www.espn.com/video/clip?id=1",
});
const fantasy = card({
  id: "league-fan",
  headline: "Week 5 fantasy sleepers and sit-em calls",
});
const podcast = card({
  id: "league-pod",
  headline: "Around the NFL podcast: Monday recap",
});
const listicle = card({
  id: "league-list",
  headline: "10 things we learned from Sunday",
});
const preview = card({
  id: "league-prev",
  headline: "Chiefs-Raiders preview: what to watch",
  gameId: "401772958",
  wrapHref: "https://www.espn.com/nfl/preview/_/gameId/401772958",
  status: "Preview",
});
const nhlLeak = card({
  id: "league-nhl",
  headline: "Blues win in overtime",
  leaguePath: "hockey/nhl",
});

assert(sportFillerReason(video) === "video", "video clips spike");
assert(sportFillerReason(fantasy) === "fantasy", "fantasy spikes");
assert(sportFillerReason(podcast) === "podcast", "podcasts spike");
assert(sportFillerReason(listicle) === "listicle", "listicles spike");
assert(sportFillerReason(preview, [wrap]) === "preview", "a preview of a played game spikes");
assert(!isSportFiller(wrap), "a game wrap is never filler");
assert(!storyFitsSection(nhlLeak, "football/nfl"), "wrong-sport copy stays out of NFL");

const attached = attachRelatedGameCopy([wrap, athletic, video]);
const kept = attached.find((c) => c.id === "wire-nfl-kc");
assert(kept?.related?.some((r) => r.id === "athletic-kc"), "Athletic feature hangs under the wrap");
assert(!attached.some((c) => c.id === "athletic-kc"), "the Athletic game feature is not a second story");

const miz = card({
  id: "wire-cfb-miz",
  headline: "Missouri beats Florida",
  favoriteKey: "cfb-mizzou",
  followed: true,
  leaguePath: "football/college-football",
  sportLabel: "CFB",
  sec: true,
  when: "2026-10-03T16:00:00Z",
});
const bama = card({
  id: "wire-cfb-ala",
  headline: "Alabama beats Mississippi State",
  leaguePath: "football/college-football",
  sportLabel: "CFB",
  sec: true,
  when: "2026-10-03T19:00:00Z",
});
const oregon = card({
  id: "wire-cfb-ore",
  headline: "Oregon beats Penn State",
  leaguePath: "football/college-football",
  sportLabel: "CFB",
  ranked: true,
  when: "2026-10-03T00:00:00Z",
});
const ordered = orderSportRecaps([oregon, bama, miz], "football/college-football");
assert(ordered[0]?.id === "wire-cfb-miz", "Mizzou leads CFB recaps");
assert(ordered[1]?.id === "wire-cfb-ala", "SEC games group after the favorite");
assert(ordered[2]?.id === "wire-cfb-ore", "top non-SEC follows the SEC block");

const bands = groupSportRecaps([oregon, bama, miz], "football/college-football");
assert(bands[0]?.title === "Your club" && bands[1]?.title === "SEC" && bands[2]?.title === "Around the country", bands.map((b) => b.title).join(","));

const chiefs = card({
  id: "wire-nfl-kc2",
  headline: "Chiefs win",
  favoriteKey: "nfl-kc",
  followed: true,
  when: "2026-10-04T20:00:00Z",
});
const playoff = card({
  id: "wire-nfl-wc",
  headline: "Packers advance",
  postseason: true,
  when: "2026-10-04T17:00:00Z",
});
const other = card({
  id: "wire-nfl-ind",
  headline: "Colts win",
  when: "2026-10-04T17:00:00Z",
});
const printedNfl = groupSportRecaps([playoff, other], "football/nfl");
assert(printedNfl[0]?.title === "Marquee" && printedNfl[0].cards.length === 1, "a printed marquee band counts one card");
assert(printedNfl[1]?.title === "The rest of the slate" && printedNfl[1].cards.length === 1, "the rest-of-slate band counts only what prints");

const nflOrder = orderSportRecaps([other, playoff, chiefs], "football/nfl");
assert(nflOrder[0]?.id === "wire-nfl-kc2", "favorite NFL game leads");
assert(nflOrder[1]?.id === "wire-nfl-wc", "playoff games are marquee");
assert(nflOrder[2]?.id === "wire-nfl-ind", "the rest of the slate follows");

const lions = card({
  id: "wire-nfl-det",
  headline: "Panthers beat Lions",
  favoriteKey: "nfl-det",
  leaguePath: "football/nfl",
  sportLabel: "NFL",
  sec: true,
});
assert(!isSecCard(lions), "an NFL club that shares an ESPN id with Arkansas is not SEC");
assert(isSecCard(miz), "Mizzou stays SEC");

const staleHold = card({
  id: "wire-nfl-old",
  headline: "Saturday leftover",
  holdover: true,
  scoreLine: "AA 10 · BB 7",
  when: "2026-10-03T16:00:00Z",
});
const lastNight = card({
  id: "wire-nfl-sun",
  headline: "Sunday night final",
  scoreLine: "KC 30 · LV 27",
  when: "2026-10-04T20:15:00Z",
  photo: "https://example.com/sun.jpg",
});
const editorNews = card({
  id: "league-news-lead",
  headline: "League names an MVP favorite",
  when: "2026-10-05T08:00:00Z",
  editorFront: 0,
  photo: "https://example.com/mvp.jpg",
});
const frontOrder = orderSportSectionFront(
  [staleHold, lastNight, editorNews],
  "football/nfl",
  "2026-10-05-morning",
);
assert(frontOrder[0]?.id === "league-news-lead", "an editor-fronted story still leads the section");
const wrapLead = orderSportSectionFront(
  [staleHold, lastNight],
  "football/nfl",
  "2026-10-05-morning",
);
assert(wrapLead[0]?.id === "wire-nfl-sun", "last night's wrap leads when the editor is quiet");
assert(
  !wrapLead.some((c) => c.id === "wire-nfl-old") || wrapLead[0]?.id !== "wire-nfl-old",
  "a holdover wrap never opens the section when a fresh game is on file",
);

const eaglesSurgery = card({
  id: "league-bigsby",
  headline: "Eagles RB Tank Bigsby to have surgery",
  when: "2026-10-05T18:00:00Z",
  editorFront: 0,
  body: "Philadelphia said Tank Bigsby will have surgery. ".repeat(4),
});
assert(isInjuryNote(eaglesSurgery), "a surgery note is injury news");
const injuryLead = orderSportSectionFront(
  [eaglesSurgery, lastNight],
  "football/nfl",
  "2026-10-05-evening",
);
assert(injuryLead[0]?.id === "wire-nfl-sun", "NFL1 leads with last night's result, not an injury");

console.log("newspaper-sport-desk ok");
