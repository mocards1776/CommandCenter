/**
 * Run with: node --experimental-strip-types src/lib/newspaper-phone-cards.test.ts
 * from CommandCenter-main/.
 */
import {
  isPhoneCardKind,
  phoneCardDate,
  phoneCardEditionLabel,
  phoneFrontRank,
  phoneFrontStories,
  phoneWatchPriority,
  PHONE_CARD_PX,
  PHONE_CARD_SIZE,
  PHONE_FIT_BOTTOM,
  rankPhoneWatchGames,
  sampleDaySchedule,
  sampleFrontStories,
  sampleHeavyWatchGames,
  sampleWatchGames,
  trimPhoneDayFit,
  trimPhoneFrontFit,
  trimPhoneWatchFit,
  trimPhoneWeatherFit,
} from "./newspaper-phone-cards.ts";
import { isWatchPreseasonLowTier, sampleWatchSlateLight, type WatchGame } from "./newspaper-watch-page.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

assert(PHONE_CARD_SIZE.width === 430 && PHONE_CARD_SIZE.height === 932, "phone CSS size is 430×932");
assert(PHONE_CARD_PX.width === 1290 && PHONE_CARD_PX.height === 2796, "phone PNG is 1290×2796 at 3x");
assert(PHONE_FIT_BOTTOM === 915, "last ink must sit at or above 915 CSS px");

assert(isPhoneCardKind("front") && isPhoneCardKind("weather") && isPhoneCardKind("day") && isPhoneCardKind("watch"), "known cards");
assert(!isPhoneCardKind("a1") && !isPhoneCardKind(""), "unknown cards are rejected");
assert(phoneCardDate("2026-10-05-evening") === "2026-10-05", "issue id yields its Central date");
assert(phoneCardDate("nonsense") === new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" }), "bad id falls back to today");
assert(phoneCardEditionLabel("2026-10-05-morning") === "Morning Edition", "morning label");
assert(phoneCardEditionLabel("2026-10-05-midday") === "Midday Edition", "midday label");
assert(phoneCardEditionLabel("2026-10-05-evening") === "Evening Edition", "evening label");
assert(phoneCardEditionLabel("") === "Edition", "missing issue is a generic edition");

const day = sampleDaySchedule("2026-10-05");
assert(day.date === "2026-10-05" && day.events.length >= 4, "sample day has events");
assert(day.events.some((e) => e.title === "Lunch with Dad"), "harness fixture includes Lunch with Dad");
assert(day.upcoming?.some((d) => d.events.some((e) => /Dentist/.test(e.title))), "harness fixture includes Dentist — Maya");
assert(day.events.some((e) => e.kind === "work") && day.events.some((e) => e.kind === "family"), "sample mixes work and family");
assert((day.upcoming ?? []).length === 5 && day.upcoming?.[0]?.date === "2026-10-06", "sample Coming Up is the next five days");

const watch = sampleWatchGames();
assert(watch.length >= 3 && watch[0]!.heat >= watch[1]!.heat, "sample watch is hottest first");
assert(watch.every((g) => g.away.abbrev && g.home.abbrev), "sample games have both clubs");

const heavy = sampleHeavyWatchGames("2026-10-05");
assert(heavy.length > watch.length, "heavy slate has more games than the short sample");
const ranked = rankPhoneWatchGames(heavy);
assert(
  ranked.every((g, i) => i === 0 || phoneWatchPriority(ranked[i - 1]!) <= phoneWatchPriority(g)),
  "phone watch stays in priority order",
);
const lastReal = ranked.findLastIndex((g) => !g.preseason && !isWatchPreseasonLowTier(g));
const firstPre = ranked.findIndex((g) => Boolean(g.preseason) || isWatchPreseasonLowTier(g));
assert(firstPre === -1 || lastReal < 0 || firstPre > lastReal, "preseason games rank after real games");

const light = sampleWatchSlateLight("2026-10-05").map((g) =>
  g.id === "nba-ny-phi" ? { ...g, final: true, live: false } : g.id === "mlb-nyy-tb" ? { ...g, live: true, final: false } : g,
);
const gotd = rankPhoneWatchGames(light)[0];
assert(gotd?.id === "mlb-cws-cle" || gotd?.id === "mlb-nyy-tb", `Game of the Day is ALDS, not preseason (${gotd?.id})`);
assert(!gotd?.preseason, "Game of the Day is not a preseason box");

const knicks = light.find((g) => g.id === "nba-ny-phi") as WatchGame;
const yanks = light.find((g) => g.id === "mlb-nyy-tb") as WatchGame;
assert(knicks && yanks && knicks.favorite && knicks.preseason && knicks.final, "Knicks-76ers fixture is a favorite preseason final");
assert(yanks.live && /ALDS/i.test(`${yanks.series ?? ""} ${yanks.printReason ?? ""}`), "Yankees-Rays fixture is a live ALDS game");
assert(rankPhoneWatchGames([knicks, yanks])[0]!.id === "mlb-nyy-tb", "live ALDS outranks a finished favorite preseason game");
assert(phoneWatchPriority(knicks) > phoneWatchPriority(yanks), "preseason finals are the first games the card drops");

assert(trimPhoneWatchFit({ keepRest: 3 })?.keepRest === 2, "watch drops the lowest-priority leftover");
assert(trimPhoneWatchFit({ keepRest: 0 }) === null, "watch keeps the feature game");
assert(trimPhoneDayFit({ comingDays: 2, rundown: 4, allDay: 1 })?.comingDays === 1, "day ahead drops Coming Up first");
assert(trimPhoneDayFit({ comingDays: 0, rundown: 2, allDay: 1 })?.rundown === 1, "then later rundown rows");
assert(trimPhoneFrontFit({ stories: 3, showDek: true, showPhoto: true, lastDek: true })?.lastDek === false, "front drops the last dek before a story");
assert(trimPhoneFrontFit({ stories: 3, showDek: true, showPhoto: true, lastDek: false })?.stories === 2, "front then drops the lowest story");
assert(trimPhoneWeatherFit({ showAlmanac: true, showToday: true, days: 7, showHourly: true })?.showAlmanac === false, "weather drops almanac first");

const front = sampleFrontStories();
assert(front.length >= 6 && /Missouri/.test(front[0]!.headline), "sample front is the Oct 5 evening A1 shape");
assert(front[0]!.photo && (front[0]!.photoWidth ?? 0) >= 1, "sample lead has a photo at native width");
assert(front.every((s) => s.dek), "sample headlines carry short deks");

const sixersNote = {
  id: "news-76ers-sit",
  favoriteKey: "nba-phi",
  teamName: "76ers",
  teamHref: "",
  sportLabel: "NBA",
  leaguePath: "basketball/nba",
  headline: "James, Embiid, Maxey sit out 76ers'preseason opener vs. Knicks",
  dek: null,
  body: "LeBron James, Joel Embiid and Tyrese Maxey will sit out the 76ers' preseason opener against the Knicks on Monday night. The rest of the rotation is in.",
  scoreLine: null,
  when: "2026-10-05T21:19:12Z",
  won: null,
  gameHref: null,
  wrapHref: null,
  feedUrl: null,
  gameId: null,
  stats: [],
  leaders: [],
  teamStats: [],
  division: [],
  photo: "https://example.com/lebron.jpg",
  photoWidth: 600,
  followed: true,
  preseason: false,
  status: "Final",
};
const mizzouWrap = {
  ...sixersNote,
  id: "wire-college-football-401856708",
  favoriteKey: "cfb-mizzou",
  teamName: "Mizzou FB",
  sportLabel: "CFB",
  leaguePath: "football/college-football",
  headline: "No. 25 Missouri trounces No. 8 Florida 45-17 to snap 9-game skid against Top 25 opponents",
  dek: null,
  body: "Austin Simmons threw for 340 yards and two touchdowns, Jamal Roberts ran for 211 yards and three more scores, and No. 25 Missouri trounced eighth-ranked Florida 45-17 on Saturday.",
  scoreLine: "MIZ 45 · FLA 17",
  when: "2026-10-03T19:50Z",
  won: true,
  photo: "https://example.com/mizzou.jpg",
  photoWidth: 576,
  holdover: true,
  status: "Final",
};
assert(phoneFrontRank(mizzouWrap) < phoneFrontRank(sixersNote), "a favorite-team result outranks a preseason sit-out");
const ordered = phoneFrontStories([sixersNote, mizzouWrap], "2026-10-05-evening");
assert(ordered[0]?.id === "wire-college-football-401856708", "phone lead is the Mizzou wrap, not the 76ers note with a photo");
assert(
  !ordered.some((s) => s.id === "news-76ers-sit"),
  "phone front stays on the printed A1 and does not add a 76ers sit-out",
);
const middayPhone = phoneFrontStories(
  [
    {
      ...sixersNote,
      id: "box-nba-401898999",
      headline: "Knicks 97, 76ers 120",
      dek: "Times box wrap",
      body: "Philadelphia 76ers beat New York Knicks 120-97 in preseason play. ".repeat(8),
      scoreLine: "NY 97 · PHI 120",
      wrapKind: "box",
      caption: "Times box wrap",
    },
    {
      ...mizzouWrap,
      id: "news-cowboys-midday",
      favoriteKey: "nfl-dal",
      teamName: "Cowboys",
      sportLabel: "NFL",
      leaguePath: "football/nfl",
      headline: "Cowboys get healthy ahead of Tampa Bay",
      scoreLine: null,
      won: null,
      holdover: false,
      photo: null,
      when: "2026-10-06T15:00:00Z",
      status: null,
    },
  ],
  "2026-10-06-midday",
);
assert(middayPhone[0]?.id !== "box-nba-401898999", "Telegram A1 list does not lead with 76ers");
assert(middayPhone[0]?.id === "news-cowboys-midday", "Telegram A1 list matches the paper Cowboys lead");

console.log("newspaper-phone-cards ok");
