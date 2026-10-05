/**
 * Run with: node --experimental-strip-types src/lib/newspaper-sport-desk.test.ts
 * from CommandCenter-main/.
 */
import type { GameWrapCard } from "./newspaper-sports.ts";
import {
  attachRelatedGameCopy,
  groupSportRecaps,
  isSecCard,
  isSportFiller,
  orderSportRecaps,
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

console.log("newspaper-sport-desk ok");
