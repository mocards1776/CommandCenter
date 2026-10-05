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
  timesTeamInterest,
  watchBlockId,
  WATCH_BLOCK_OVERFLOW,
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

const page = composeWatchPage(slate);
assert(page.feature, "page has a game of the day");
assert(page.feature!.id === slate[0]!.id, "hero is the hottest game");
assert(
  page.blocks.every((b) => b.listings.every((g) => g.id !== page.feature!.id)),
  "hero is excluded from its time block",
);
assert(page.blocks.length >= 4, "sample covers most Central-time blocks");

const listed = page.blocks.flatMap((b) => b.listings);
for (let i = 1; i < listed.length; i++) {
  const prev = listed[i - 1]!;
  const next = listed[i]!;
  if (watchBlockId(prev.when) !== watchBlockId(next.when)) continue;
  assert(String(prev.when ?? "") <= String(next.when ?? ""), "inside a block, kickoff order");
}

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
assert(printNetworks(["NESN"])[0]?.name === "NESN", "an already-short API name may print");

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

const finalsDropped = pickWatchGames(
  [
    game({ id: "done", heat: 99, final: true } as WatchGame & { final: boolean }),
    game({ id: "on", heat: 10 }),
  ],
  40,
);
assert(finalsDropped.map((g) => g.id).join() === "on", "finals stay off the page");

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
]);
assert(desk.mlb["138"] === 10, "Cardinals use the MLB id, not the ESPN path id");
assert(desk.nfl["8"] === 10 && desk.nfl["12"] === 10, "Lions and Chiefs from the Times desk");
assert(desk.nhl["19"] === 10, "Blues from the Times desk");
assert(desk.cfb["142"] === 10, "Mizzou from the Times desk");
assert(desk.soccer["359"] === 10, "Arsenal from the Times desk");
assert(!("24" in desk.mlb), "ESPN MLB path id is not the interest key");

const overflowGames: WatchGame[] = [game({ id: "hero-fold", heat: 99, when: "2026-10-05T23:00:00.000Z" })];
for (let i = 0; i < 20; i++) {
  overflowGames.push(
    game({
      id: `pad-${i}`,
      league: "MLB",
      heat: 80 - i,
      when: "2026-10-05T23:10:00.000Z",
    }),
  );
}
for (let i = 0; i < 12; i++) {
  overflowGames.push(
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
const overflow = composeWatchPage(overflowGames);
const morning = overflow.blocks.find((b) => b.id === "morning");
assert(morning, "soccer slate lands in Morning");
assert(morning!.listings.length <= WATCH_BLOCK_OVERFLOW, "overflowing soccer folds to the block cap");
assert(morning!.alsoOn.length > 0, "folded soccer becomes an Also on line");
assert(morning!.alsoOn[0]!.match.includes("–"), "Also on uses club names");
assert(!morning!.alsoOn.some((row) => /final/i.test(row.match)), "finals are not on the Also on line");

assert(!page.blocks.some((b) => b.listings.some((g) => String(g.clock) === String(g.heat))), "heat number is not printed as the clock");
assert(!/now/i.test(page.blocks.map((b) => b.label).join()), "no live Now block");

console.log("newspaper-watch ok");
