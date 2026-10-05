/**
 * Run with: node --experimental-strip-types src/lib/newspaper-watch.test.ts
 * from CommandCenter-main/.
 */
import {
  asPrintGame,
  assignWatchTiers,
  composeWatchPage,
  pickWatchGames,
  printClock,
  printNetworks,
  printReason,
  sampleWatchSlate,
  sampleWatchSlateLight,
  timesTeamInterest,
  watchBlockId,
  watchClockState,
  watchContext,
  watchDensityOf,
  watchFavoriteLabel,
  watchSeriesDisplay,
  watchSlotBucket,
  watchLeagueColor,
  watchLeagueLabel,
  watchTeamShort,
  WATCH_LEAGUE_COLOR,
  WATCH_PAGE_GAMES,
  type WatchGame,
} from "./newspaper-watch-page.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const game = (partial: Partial<WatchGame> & Pick<WatchGame, "id" | "heat">): WatchGame => ({
  league: "MLB",
  competition: null,
  away: { name: "Away", abbrev: "AWY", logo: null, record: "1-0" },
  home: { name: "Home", abbrev: "HOM", logo: null, record: "1-0" },
  when: "2026-10-05T17:00:00.000Z",
  status: null,
  live: false,
  venue: null,
  tv: [],
  reasons: [],
  ...partial,
});

assert(WATCH_PAGE_GAMES === 40, "printed page holds about 40 games");

const slate = sampleWatchSlate("2026-10-05");
assert(slate.length >= 30 && slate.length <= 40, `sample slate is a full page (${slate.length})`);
assert(slate[0]!.heat >= slate[1]!.heat, "sample is hottest first so the hero is game of the day");
assert(
  slate.every((g) => !/live/i.test(g.printReason ?? "")),
  "printed reasons never say Live",
);
assert(
  slate.every((g) => Boolean(g.away.logo || g.away.abbrev) && Boolean(g.home.logo || g.home.abbrev)),
  "dense sample never ships a nameless side",
);

const page = composeWatchPage(slate);
assert(page.feature, "page has a game of the day");
assert(page.feature!.id === slate[0]!.id, "hero is the hottest game");
assert(page.density === "dense", "a 30-plus slate is dense");
assert(
  page.slots.every((s) => s.listings.every((g) => g.id !== page.feature!.id)),
  "hero is excluded from its time slot",
);
assert(page.slots.length >= 5, "sample covers several Central kickoff times");
assert(
  page.slots.every((s) => s.listings.length > 0),
  "every printed slot has at least one full card",
);

const listed = page.slots.flatMap((s) => s.listings);
for (let i = 1; i < listed.length; i++) {
  const prev = listed[i - 1]!;
  const next = listed[i]!;
  assert(String(prev.when ?? "") <= String(next.when ?? ""), "slots stay in kickoff order");
}

const light = sampleWatchSlateLight("2026-10-05");
assert(light.length === 12, `Monday fixture is 12 games (${light.length})`);
assert(light.some((g) => g.away.abbrev === "CWS" && g.home.abbrev === "CLE"), "ALDS White Sox at Guardians");
assert(light.some((g) => g.away.abbrev === "ATL" && g.home.abbrev === "NO" && g.league === "NFL"), "MNF ATL at NO");
assert(light.filter((g) => g.league === "NHL").length === 4, "four NHL games");
assert(light.filter((g) => g.league === "NBA" && g.preseason).length === 5, "five NBA preseason games");
assert(light.filter((g) => g.league === "MLB").length === 2, "two MLB playoff games");
const lightPage = composeWatchPage(light);
assert(lightPage.density === "light", "Monday fixture is a light day");
assert(lightPage.slots.every((s) => s.listings.every((g) => g.away.name && g.home.name)), "no bare MEM–ATL rows");
assert(lightPage.feature?.away.starter && lightPage.feature.home.starter, "hero carries probable pitchers");

const tiers = assignWatchTiers(slate);
const must = slate.filter((g) => tiers.get(g.id) === "must");
const worth = slate.filter((g) => tiers.get(g.id) === "worth");
const around = slate.filter((g) => tiers.get(g.id) === "around");
assert(must.length === 5, "a full slate prints five must-watch games (hero + four)");
assert(worth.length === 10, "next ten are worth it");
assert(around.length === slate.length - 15, "the rest are on-if-you're-around");
assert(
  must.every((g) => g.heat >= worth[0]!.heat) && worth.every((g) => g.heat >= around[0]!.heat),
  "tiers follow that day's heat rank, not a fixed cutoff",
);

const short = assignWatchTiers([game({ id: "a", heat: 9 }), game({ id: "b", heat: 8 }), game({ id: "c", heat: 7 })]);
assert([...short.values()].every((t) => t === "must"), "a short slate is all must-watch");

assert(watchBlockId("2026-10-05T16:00:00.000Z") === "morning", "10 a.m. CT is Morning");
assert(watchBlockId("2026-10-05T17:30:00.000Z") === "noon", "12:30 p.m. CT is Noon");
assert(watchBlockId("2026-10-05T20:00:00.000Z") === "afternoon", "3 p.m. CT is Afternoon");
assert(watchBlockId("2026-10-05T23:30:00.000Z") === "prime", "6:30 p.m. CT is Prime Time");
assert(watchBlockId("2026-10-06T03:00:00.000Z") === "late", "10 p.m. CT is Late");
assert(watchBlockId(null) === "late", "unknown kickoff sits in Late");

assert(printClock("2026-10-05T17:00:00.000Z") === "12 PM", "noon prints as 12 PM, not Live");
assert(!/live/i.test(printClock("2026-10-05T23:15:00.000Z")), "printed clock never says Live");

assert(
  printNetworks(["ESPN", "ABC", "FS1"]).map((n) => n.name).join(",") === "ESPN,ABC",
  "at most two networks",
);
assert(
  printNetworks(["Apple TV+", "Peacock"]).every((n) => n.streaming),
  "streaming-only networks are marked",
);
assert(printNetworks(["Paramount+"])[0]?.name === "Para+", "Paramount+ shortens to Para+");
assert(printNetworks(["USA Network"])[0]?.name === "USA", "USA Network shortens to USA");
assert(printNetworks([]).length === 0, "unknown stays blank");
assert(printNetworks(["Mystery Regional Sports"]).length === 0, "long unknown RSNs are omitted, not invented");
assert(printNetworks(["NESN"])[0]?.name === "NESN", "NESN is a known regional");
assert(printNetworks(["NBA TV"])[0]?.name === "NBA TV", "NBA TV prints as a small-caps network");
assert(printNetworks(["NBA League Pass"])[0]?.streaming, "League Pass is marked streaming");
assert(printNetworks(["ERADM"]).length === 0, "ESPN market codes are dropped");
assert(printNetworks(["ESPN", "ERADM"]).map((n) => n.name).join() === "ESPN", "codes do not crowd out real networks");
assert(printNetworks(["Prime Video"])[0]?.name === "Prime Video", "Prime Video prints as Prime Video");
assert(printNetworks(["ABCDZ"]).length === 0, "unknown all-caps codes stay off the page");

assert(printReason(game({ id: "r1", heat: 10, reasons: ["Playoff Game 3"] })) === "Playoff Game 3", "playoff reason");
assert(
  printReason(
    game({
      id: "r2",
      heat: 10,
      away: { name: "Oregon", abbrev: "ORE", logo: null, record: null, rank: 3 },
      home: { name: "Ohio State", abbrev: "OSU", logo: null, record: null, rank: 1 },
      reasons: ["Ranked matchup"],
    }),
  ) === "Top-10 clash",
  "two top-10 teams print as a clash",
);
assert(printReason(game({ id: "r3", heat: 10, reasons: ["Iron Bowl"] })) === "Iron Bowl", "named rivalry");
assert(
  printReason(game({ id: "r4", heat: 10, reasons: ["Live now", "Upcoming"] }), "Cardinals") === "Cardinals",
  "favorite-team reason after skipping live copy",
);
assert(printReason(game({ id: "r5", heat: 10, reasons: ["Live", "Upcoming"] })) === null, "no invented reason");
assert(
  printReason(game({ id: "r6", heat: 10, reasons: [], series: "CLE leads 2-0" })) === "CLE leads 2-0",
  "series line is a printed reason",
);
assert(
  printReason(game({ id: "r7", heat: 10, reasons: ["Playoff series"], series: "CLE leads 1-0" })) === "CLE leads 1-0",
  "generic Playoff series yields to the actual series state",
);
assert(
  printReason(game({ id: "r8", heat: 10, reasons: ["ALDS"], series: "CLE leads 1-0" })) === "ALDS · CLE leads 1-0",
  "ALDS plus a lead prints as ALDS · CLE leads 1-0",
);
assert(printReason(game({ id: "r9", heat: 10, reasons: ["Playoff series"] })) !== "Playoff series", "bare Playoff series is not printed");
assert(watchSeriesDisplay(game({ id: "s1", heat: 10, reasons: ["ALDS Game 1"] })) === "ALDS Game 1", "ALDS Game 1 from a reason");
assert(watchSeriesDisplay(game({ id: "s2", heat: 10, league: "NBA", preseason: true, series: "PHI leads 1-0" })) === null, "preseason has no series line");

assert(watchTeamShort({ name: "Chicago White Sox", abbrev: "CWS", logo: null, record: null }) === "White Sox", "White Sox nickname");
assert(watchTeamShort({ name: "New York Yankees", abbrev: "NYY", logo: null, record: null }) === "Yankees", "Yankees nickname");
assert(watchTeamShort({ name: "Missouri", abbrev: "MIZ", logo: null, record: null }) === "Missouri", "CFB stays as-is");
assert(watchTeamShort({ name: "Toronto Maple Leafs", abbrev: "TOR", logo: null, record: null }) === "Maple Leafs", "two-word nick");
assert(watchTeamShort({ name: "Long Name", short: "Short", abbrev: "X", logo: null, record: null }) === "Short", "stored short wins");

assert(watchContext(game({ id: "c1", heat: 5, league: "NBA", preseason: true, reasons: [] })) === "Preseason", "preseason context");
assert(watchContext(game({ id: "c2", heat: 5, reasons: [], competition: "Premier League", league: "Soccer" })) === "Premier League", "soccer competition");
assert(watchClockState(game({ id: "live", heat: 5, live: true, status: "Bot 5th" })).kind === "live", "live state");
assert(watchClockState(game({ id: "fin", heat: 5, final: true, status: "Final" })).kind === "final", "final state");
assert(watchDensityOf(12) === "light" && watchDensityOf(20) === "full" && watchDensityOf(30) === "dense", "density bands");
assert(watchSlotBucket("7:15 PM", "light") === "7:15 PM", "light days keep the exact kickoff");
assert(watchSlotBucket("7:15 PM", "dense") === "7 PM", "dense days bucket :15 with the hour");
assert(watchSlotBucket("7:30 PM", "dense") === "7 PM", "dense :30 joins the hour");
assert(watchSlotBucket("12:10 PM", "dense") === "12 PM", "dense noon-ish games share 12 PM");
assert(page.slots.length <= 16, `dense page groups kickoffs (${page.slots.length} slots)`);

const keptFinals = pickWatchGames(
  [
    game({ id: "done", heat: 99, final: true }),
    game({ id: "on", heat: 10 }),
  ],
  40,
);
assert(keptFinals.map((g) => g.id).join() === "done,on", "finals stay on today's page");

const heatPick = pickWatchGames(
  [game({ id: "cool", heat: 10, when: "2026-10-05T12:00:00.000Z" }), game({ id: "hot", heat: 80, when: "2026-10-05T23:00:00.000Z" })],
  1,
);
assert(heatPick[0]!.id === "hot", "heat, not kickoff, chooses who makes the page");

const live = asPrintGame({
  live: true,
  inning: "Bot 8th",
  situation: { batter: 1 },
  away: { score: 1, name: "A" },
  home: { score: 0, name: "B" },
}) as {
  live: boolean;
  inning: string | null;
  situation: unknown;
  away: { score: unknown };
  home: { score: unknown };
};
assert(!live.live && live.inning == null && live.situation == null, "print scoring drops the live clock");
assert(live.away.score == null && live.home.score == null, "print scoring drops the live scoreline");
assert(asPrintGame({ live: false, away: { score: 3 } }).away.score === 3, "pregame games keep their fields");

const desk = timesTeamInterest([
  { league: "MLB", sport: "Baseball", espnPath: "baseball/mlb/teams/24", mlbTeamId: 138, shortName: "Cardinals" },
  { league: "NFL", sport: "Football", espnPath: "football/nfl/teams/8", shortName: "Lions" },
  { league: "NFL", sport: "Football", espnPath: "football/nfl/teams/12", shortName: "Chiefs" },
  { league: "NHL", sport: "Hockey", espnPath: "hockey/nhl/teams/19", shortName: "Blues" },
  { league: "NCAA", sport: "Football", espnPath: "football/college-football/teams/142", shortName: "Mizzou FB" },
  { league: "Premier League", sport: "Soccer", espnPath: "soccer/eng.1/teams/359", shortName: "Arsenal" },
  { league: "NBA", sport: "Basketball", espnPath: "basketball/nba/teams/20", shortName: "76ers" },
]);
assert(desk.mlb["138"] === 10, "Cardinals use the MLB id, not the ESPN path id");
assert(desk.nfl["8"] === 10 && desk.nfl["12"] === 10, "Lions and Chiefs from the Times desk");
assert(desk.nhl["19"] === 10, "Blues from the Times desk");
assert(desk.cfb["142"] === 10, "Mizzou from the Times desk");
assert(desk.soccer["359"] === 10, "Arsenal from the Times desk");
assert(desk.nba["20"] === 10, "Sixers from the Times desk");
assert(!("24" in desk.mlb), "ESPN MLB path id is not the interest key");
assert(
  watchFavoriteLabel(
    game({
      id: "nhl-phi-tb",
      league: "NHL",
      heat: 10,
      away: { name: "Philadelphia Flyers", abbrev: "PHI", logo: null, record: "0-1-2", teamId: "15" },
      home: { name: "Tampa Bay Lightning", abbrev: "TB", logo: null, record: "1-1-0", teamId: "20" },
    }),
    desk.byId,
  ) === null,
  "NHL Lightning id 20 is not the Sixers",
);
assert(
  watchFavoriteLabel(
    game({
      id: "nba-ny-phi",
      league: "NBA",
      heat: 10,
      away: { name: "New York Knicks", abbrev: "NY", logo: null, record: null, teamId: "18" },
      home: { name: "Philadelphia 76ers", abbrev: "PHI", logo: null, record: null, teamId: "20" },
    }),
    desk.byId,
  ) === "76ers",
  "NBA team 20 is the Sixers",
);
assert(
  watchFavoriteLabel(
    game({
      id: "nhl-phi-name",
      league: "NHL",
      heat: 5,
      away: { name: "Philadelphia Flyers", abbrev: "PHI", logo: null, record: null },
      home: { name: "Tampa Bay Lightning", abbrev: "TB", logo: null, record: null },
      reasons: ["Philadelphia"],
    }),
    desk.byId,
  ) === null,
  "city name is not a favorite match",
);

assert(watchLeagueLabel(game({ id: "nba-lab", heat: 5, league: "NBA" })) === "NBA", "NBA league label");
assert(watchLeagueLabel(game({ id: "wnba-lab", heat: 5, league: "WNBA" })) === "WNBA", "WNBA league label");
assert(WATCH_LEAGUE_COLOR.NBA && WATCH_LEAGUE_COLOR.WNBA, "NBA and WNBA have colors");
assert(watchLeagueColor("NBA") === WATCH_LEAGUE_COLOR.NBA, "NBA color map");

const preseasonOnly = assignWatchTiers([
  game({ id: "nba-pre-a", heat: 90, league: "NBA", preseason: true }),
  game({ id: "nba-pre-b", heat: 80, league: "NBA", preseason: true }),
  game({ id: "mlb-hot", heat: 40 }),
]);
assert(preseasonOnly.get("nba-pre-a") === "around" && preseasonOnly.get("nba-pre-b") === "around", "NBA preseason is always the lowest tier");
assert(preseasonOnly.get("mlb-hot") === "must", "a real game still takes the must-watch slot");

const manySoccer: WatchGame[] = [game({ id: "hero-fold", heat: 99, when: "2026-10-05T23:00:00.000Z" })];
for (let i = 0; i < 12; i++) {
  manySoccer.push(
    game({
      id: `soccer-fold-${i}`,
      league: "Soccer",
      heat: 20 - i,
      when: `2026-10-05T14:0${i % 6}:00.000Z`,
      away: { name: i % 2 ? "Brentford" : "Napoli", abbrev: "X", logo: null, record: null },
      home: { name: i % 2 ? "Fulham" : "Roma", abbrev: "Y", logo: null, record: null },
      tv: i % 2 ? ["USA"] : ["Para+"],
    }),
  );
}
const soccerPage = composeWatchPage(manySoccer);
assert(
  soccerPage.slots.flatMap((s) => s.listings).length === 12,
  "every soccer match stays a card — no Also-on fold",
);

assert(!page.slots.some((s) => s.listings.some((g) => String(g.clock) === String(g.heat))), "heat number is not printed as the clock");
assert(!/now/i.test(page.slots.map((s) => s.clock).join()), "no live Now block");

console.log("newspaper-watch ok");
