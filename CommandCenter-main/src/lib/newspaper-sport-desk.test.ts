/**
 * Run with: node --experimental-strip-types src/lib/newspaper-sport-desk.test.ts
 * from CommandCenter-main/.
 */
import type { GameWrapCard } from "./newspaper-sports.ts";
import {
  attachRelatedGameCopy,
  favoriteKeyForGame,
  groupSportRecaps,
  isBoxStub,
  isInjuryNote,
  isSecCard,
  isSportFiller,
  isWrapLead,
  orderSportRecaps,
  isEflChampionshipStory,
  lastMatchCardFromChip,
  orderSportSectionFront,
  pickSectionFrontLead,
  sportFillerReason,
  relatedFitsSection,
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
assert(
  !storyFitsSection(
    card({
      id: "news-colts",
      headline: "Jonathan Taylor, Colts run past Commanders",
      leaguePath: null,
    }),
    "football/college-football",
  ),
  "an NFL note stays off the CFB recaps desk",
);
assert(
  !storyFitsSection(
    card({
      id: "news-walker",
      headline: "Should the Cardinals be concerned about Jordan Walker?",
      dek: "St. Louis Post-Dispatch",
      leaguePath: null,
    }),
    "football/college-football",
  ),
  "a Cardinals baseball note stays off CFB",
);
assert(
  storyFitsSection(
    card({
      id: "news-uga",
      headline: "Georgia holds off Vanderbilt in Athens",
      dek: "St. Louis Post-Dispatch",
      leaguePath: "football/college-football",
    }),
    "football/college-football",
  ),
  "a Post-Dispatch CFB note still belongs on the CFB desk",
);
assert(
  !storyFitsSection(
    card({
      id: "news-usmnt",
      headline: "State of Canada men's soccer as USMNT clash looms",
      leaguePath: null,
    }),
    "football/college-football",
  ),
  "a soccer World Cup note stays off CFB",
);
assert(
  !relatedFitsSection(
    { headline: "State of Canada men's soccer as USMNT clash looms", source: "The Athletic" },
    "football/college-football",
  ),
  "a soccer related note stays off CFB wraps",
);

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
assert(
  pickSectionFrontLead([miz, bama, oregon], [miz, bama, oregon], undefined, undefined, [miz])?.id === "wire-cfb-ala" ||
    pickSectionFrontLead(
      [
        { ...bama, photo: "https://example.com/b.jpg", body: "Alabama routed Mississippi State. ".repeat(20) },
        miz,
        oregon,
      ],
      [miz, bama, oregon],
      undefined,
      undefined,
      [miz],
    )?.id !== "wire-cfb-miz",
  "CFB1 does not reprint the A1 Mizzou wrap as its lead",
);
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
assert(frontOrder[0]?.id === "wire-nfl-sun", "last night's wrap leads the section over editor news");
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
assert(
  isInjuryNote(
    card({
      id: "news-thornton-hed",
      headline: "Sources: Chiefs WR Tyquan Thornton expected back in 12-16 weeks",
    }),
  ),
  "expected-back-in is still an injury note when the hed never says injury",
);
const injuryLead = orderSportSectionFront(
  [eaglesSurgery, lastNight],
  "football/nfl",
  "2026-10-05-evening",
);
assert(injuryLead[0]?.id === "wire-nfl-sun", "NFL1 leads with last night's result, not an injury");

const wvuShooting = card({
  id: "league-wvu",
  headline: "West Virginia football recruit Chris Wilson Jr. killed in shooting",
  leaguePath: "football/college-football",
  sportLabel: "CFB",
  editorFront: 0,
  photo: "https://example.com/wvu.jpg",
  when: "2026-10-05T12:00:00Z",
});
const mizWin = card({
  id: "wire-cfb-miz-win",
  headline: "Missouri beats No. 8 Florida 45-17",
  favoriteKey: "cfb-mizzou",
  followed: true,
  leaguePath: "football/college-football",
  sportLabel: "CFB",
  sec: true,
  scoreLine: "MIZ 45 · FLA 17",
  when: "2026-10-04T16:00:00Z",
  photo: "https://example.com/miz.jpg",
});
const cfbFront = orderSportSectionFront(
  [wvuShooting, mizWin],
  "football/college-football",
  "2026-10-05-evening",
);
assert(cfbFront[0]?.id === "wire-cfb-miz-win", "Mizzou's win leads CFB over a recruit shooting");

const messi = card({
  id: "league-messi",
  headline: "Messi, Ronaldo and Reyna headline a friendly",
  leaguePath: "",
  sportLabel: "EFL",
});
const wrexham = card({
  id: "wire-wrexham",
  headline: "Wrexham hold Wolves in the Championship",
  leaguePath: "soccer/eng.2",
  sportLabel: "EFL",
  scoreLine: "WXM 1 · WOL 1",
});
const canada = card({
  id: "league-can",
  headline: "State of Canada men's soccer as USMNT clash looms",
  leaguePath: "soccer/eng.2",
  sportLabel: "EFL",
});
assert(!storyFitsSection(messi, "soccer/eng.2"), "Messi/Ronaldo/Reyna is not Championship news");
assert(!isEflChampionshipStory(messi), "international stars are not EFL");
assert(!storyFitsSection(canada, "soccer/eng.2"), "a USMNT feature tagged eng.2 is still not EFL");
assert(storyFitsSection(wrexham, "soccer/eng.2"), "a Wrexham–Wolves wrap stays on EFL");

const holdoverAla = card({
  id: "wire-cfb-ala-hold",
  headline: "No. 7 Alabama routs Mississippi State 56-23",
  leaguePath: "football/college-football",
  sportLabel: "CFB",
  sec: true,
  holdover: true,
  scoreLine: "ALA 56 · MSST 23",
  when: "2026-10-03T16:00:00Z",
  photo: "https://example.com/ala.jpg",
});
const nebHbo = card({
  id: "league-neb-hbo",
  headline: "Is Nebraska's next QB a Manhunter?",
  leaguePath: "football/college-football",
  sportLabel: "CFB",
  editorFront: 0,
  photo: "https://example.com/neb.jpg",
  when: "2026-10-05T18:00:00Z",
});
const holdoverFront = orderSportSectionFront(
  [nebHbo, holdoverAla],
  "football/college-football",
  "2026-10-05-evening",
);
assert(holdoverFront[0]?.id === "wire-cfb-ala-hold", "a holdover ranked wrap still leads when the press marked every final holdover");

const marinersNews = card({
  id: "athletic-sea-surgery",
  headline: "Mariners' Cal Raleigh, Josh Naylor undergo surgeries",
  leaguePath: "baseball/mlb",
  sportLabel: "MLB",
  editorFront: 0,
  photo: "https://example.com/sea.jpg",
  when: "2026-10-05T18:00:00Z",
});
const chourioRecap = card({
  id: "league-50108019",
  headline: "Chourio's 2-run single with 2 outs in 9th lifts Brewers over Padres",
  leaguePath: "baseball/mlb",
  sportLabel: "MLB",
  status: "Recap",
  postseason: true,
  when: "2026-10-05T02:31:00Z",
  photo: "https://example.com/mil.jpg",
});
const mlbFront = orderSportSectionFront(
  [marinersNews, chourioRecap],
  "baseball/mlb",
  "2026-10-05-evening",
);
assert(mlbFront[0]?.id === "league-50108019", "an NLDS recap leads MLB over an offseason surgery feature");

const mizTrounces = card({
  id: "league-miz-ap",
  headline: "No. 25 Missouri trounces No. 8 Florida 45-17 to snap 9-game skid against Top 25 opponents",
  favoriteKey: "cfb-mizzou",
  followed: true,
  leaguePath: "football/college-football",
  sportLabel: "CFB",
  sec: true,
  when: "2026-10-04T16:00:00Z",
  photo: "https://example.com/miz-big.jpg",
  body: "Missouri scored early in Columbia and never let Florida back in. ".repeat(20),
});
const volsQb = card({
  id: "league-vols-qb",
  headline: "Vols QB Joey Aguilar named SEC offensive player of the week",
  leaguePath: "football/college-football",
  sportLabel: "CFB",
  editorFront: 0,
  photo: "https://example.com/vols.jpg",
  when: "2026-10-05T18:00:00Z",
  body: "Tennessee's quarterback threw for 300 yards. ".repeat(8),
});
assert(isWrapLead(mizTrounces), "a trounces + 45-17 hed is a wrap lead");
assert(!isWrapLead(volsQb), "a QB award is news, not a wrap");
const mizLeadsVols = orderSportSectionFront(
  [volsQb, mizTrounces],
  "football/college-football",
  "2026-10-05-evening",
);
assert(mizLeadsVols[0]?.id === "league-miz-ap", "Mizzou's recap leads CFB over a Vols QB note");

const whiteSoxStub = card({
  id: "box-cws",
  headline: "White Sox 4, Mariners 3",
  wrapKind: "box",
  leaguePath: "baseball/mlb",
  sportLabel: "MLB",
  scoreLine: "CWS 4 · SEA 3",
  when: "2026-10-05T20:00:00Z",
  body: "Chicago held on. Seattle left the tying run on.",
});
const nldsPhoto = card({
  id: "league-nlds-g2",
  headline: "Braves hold off Dodgers in NLDS Game 2",
  leaguePath: "baseball/mlb",
  sportLabel: "MLB",
  status: "Recap",
  postseason: true,
  holdover: true,
  when: "2026-10-05T02:10:00Z",
  photo: "https://example.com/atl.jpg",
  body: "Atlanta scored twice in the eighth and closed it out. ".repeat(16),
});
assert(isBoxStub(whiteSoxStub), "a Times box wrap is a stub");
const mlbPhotoLead = orderSportSectionFront(
  [whiteSoxStub, nldsPhoto],
  "baseball/mlb",
  "2026-10-05-evening",
);
assert(mlbPhotoLead[0]?.id === "league-nlds-g2", "a photo postseason recap leads over a box-wrap stub");

const longBoxNoArt = card({
  id: "box-miz-long",
  headline: "Missouri 45, Florida 17",
  wrapKind: "espn",
  favoriteKey: "cfb-mizzou",
  followed: true,
  leaguePath: "football/college-football",
  sportLabel: "CFB",
  scoreLine: "MIZ 45 · FLA 17",
  when: "2026-10-04T16:00:00Z",
  body: "Missouri scored early and never let Florida back in. ".repeat(12),
});
const photoAp = card({
  id: "ap-miz-photo",
  headline: "No. 25 Missouri trounces No. 8 Florida 45-17",
  favoriteKey: "cfb-mizzou",
  followed: true,
  leaguePath: "football/college-football",
  sportLabel: "CFB",
  scoreLine: "MIZ 45 · FLA 17",
  when: "2026-10-04T16:00:00Z",
  photo: "https://example.com/miz-wide.jpg",
  body: "Missouri jumped on Florida in Columbia.",
});
const photoBeatsBox = orderSportSectionFront(
  [longBoxNoArt, photoAp],
  "football/college-football",
  "2026-10-05-evening",
);
assert(photoBeatsBox[0]?.id === "ap-miz-photo", "a photo recap leads over a long box wrap with no cut");

const ndPhoto = card({
  id: "box-nd-photo",
  headline: "Notre Dame beats North Carolina 37-26",
  wrapKind: "espn",
  leaguePath: "football/college-football",
  sportLabel: "CFB",
  scoreLine: "ND 37 · UNC 26",
  when: "2026-10-04T16:00:00Z",
  photo: "https://a.espncdn.com/photo/nd.jpg",
  body: "Notre Dame won in the rain. ".repeat(10),
});
const mizNoArt = card({
  id: "ap-miz-plain",
  headline: "No. 25 Missouri trounces No. 8 Florida 45-17",
  favoriteKey: "cfb-mizzou",
  followed: true,
  leaguePath: "football/college-football",
  sportLabel: "CFB",
  scoreLine: "MIZ 45 · FLA 17",
  when: "2026-10-04T16:00:00Z",
  body: "Missouri scored early in Columbia and never let Florida back in. ".repeat(8),
});
const favBeatsOtherPhoto = orderSportSectionFront(
  [ndPhoto, mizNoArt],
  "football/college-football",
  "2026-10-05-evening",
);
assert(favBeatsOtherPhoto[0]?.id === "ap-miz-plain", "Mizzou still leads CFB when another wrap has the only photo");

const last = lastMatchCardFromChip({
  key: "eng-wrexham",
  name: "Wrexham AFC",
  shortName: "Wrexham",
  logo: "https://example.com/wrex.png",
  leaguePath: "soccer/eng.2",
  sportLabel: "EFL",
  last: { label: "@ Oxford", detail: "1–0", when: "Sat Oct 3", won: true },
});
assert(/Wrexham/i.test(last.headline) && /Oxford/i.test(last.headline), "last-match card names both clubs");
assert(last.photo === "https://example.com/wrex.png", "last-match card keeps the club crest");
assert((last.body?.length ?? 0) > 40, "last-match card has recap copy");

assert(
  favoriteKeyForGame(
    { away: { short: "Florida", name: "Florida Gators" }, home: { short: "Missouri", name: "Missouri Tigers" } },
    [{ key: "cfb-mizzou", shortName: "Mizzou" }],
  ) === "cfb-mizzou",
  "Missouri on the board stamps the Mizzou desk",
);
assert(
  favoriteKeyForGame(
    { away: { short: "Wrexham", name: "Wrexham AFC" }, home: { short: "Wolves", name: "Wolverhampton" } },
    [
      { key: "eng-wrexham", shortName: "Wrexham" },
      { key: "eng-wolves", shortName: "Wolves" },
    ],
  ) === "eng-wrexham",
  "a Wrexham final stamps the Championship desk",
);

console.log("newspaper-sport-desk ok");
