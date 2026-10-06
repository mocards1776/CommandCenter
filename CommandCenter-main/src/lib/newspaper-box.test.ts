/**
 * Run with: node --experimental-strip-types src/lib/newspaper-box.test.ts
 * from CommandCenter-main/.
 */
import {
  applyTableStandings,
  basketballStandingsSpec,
  dedupeBoxGames,
  dropBogusSameSlot,
  footballWeeksBoard,
  formatFixtureWhen,
  formatKickoffLine,
  gameClock,
  gameDay,
  looksLikeEspnZoneClock,
  shortBroadcast,
  slateKickoff,
  sportScoreBands,
  standingFromGroups,
  type BoxGame,
  type BoxSide,
  type StandGroup,
} from "./newspaper-box.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function assertEqual(got: unknown, want: unknown, msg: string) {
  if (got !== want) throw new Error(`FAIL: ${msg}\n  got:  ${JSON.stringify(got)}\n  want: ${JSON.stringify(want)}`);
}

function side(partial: Partial<BoxSide> & Pick<BoxSide, "id" | "abbrev">): BoxSide {
  return {
    name: partial.abbrev,
    short: partial.abbrev,
    logo: null,
    color: null,
    score: null,
    hits: null,
    errors: null,
    record: null,
    winner: false,
    rank: null,
    lines: [],
    ...partial,
  };
}

function game(partial: Partial<BoxGame> & Pick<BoxGame, "id">): BoxGame {
  return {
    path: "baseball/mlb",
    league: "MLB",
    day: "2026-10-04",
    startIso: "2026-10-04T16:00:00Z",
    status: "Scheduled",
    final: false,
    live: false,
    venue: "Guaranteed Rate Field",
    round: "AL Wild Card",
    series: null,
    periods: [],
    away: side({ id: "cws", abbrev: "CWS" }),
    home: side({ id: "cle", abbrev: "CLE" }),
    decisions: [],
    probables: { away: null, home: null },
    leaders: [],
    scoring: [],
    recap: null,
    broadcasts: [],
    gamePk: 1,
    espnEventId: "4010001",
    href: null,
    ...partial,
  };
}

const mlbDupes = dedupeBoxGames([
  game({ id: "espn-1", espnEventId: "4010001", gamePk: 1 }),
  game({ id: "mlb-1", espnEventId: "4010001", gamePk: 1 }),
  game({
    id: "espn-2",
    espnEventId: "4010002",
    gamePk: 2,
    away: side({ id: "lad", abbrev: "LAD" }),
    home: side({ id: "atl", abbrev: "ATL" }),
  }),
  game({
    id: "mlb-2",
    espnEventId: null,
    gamePk: null,
    away: side({ id: "lad", abbrev: "LAD" }),
    home: side({ id: "atl", abbrev: "ATL" }),
    startIso: "2026-10-04T16:00:00Z",
  }),
]);
assertEqual(mlbDupes.map((g) => g.id).join(","), "espn-1,espn-2", "MLB postseason rows collapse by event id and by teams+date");

const lakersDup = dropBogusSameSlot([
  game({
    id: "lal-sac",
    path: "basketball/nba",
    espnEventId: "4012001",
    startIso: "2026-10-05T02:00:00Z",
    venue: "Crypto.com Arena",
    away: side({ id: "13", abbrev: "LAL" }),
    home: side({ id: "23", abbrev: "SAC" }),
  }),
  game({
    id: "lal-gs",
    path: "basketball/nba",
    espnEventId: "4012002",
    startIso: "2026-10-05T02:00:00Z",
    venue: "Crypto.com Arena",
    away: side({ id: "13", abbrev: "LAL" }),
    home: side({ id: "9", abbrev: "GS" }),
  }),
]);
assertEqual(lakersDup.length, 1, "same Lakers tip at one venue is not two games");

const splitSquad = dropBogusSameSlot([
  game({
    id: "split-a",
    path: "basketball/nba",
    startIso: "2026-10-05T02:00:00Z",
    venue: "Crypto.com Arena",
    away: side({ id: "13", abbrev: "LAL" }),
    home: side({ id: "23", abbrev: "SAC" }),
  }),
  game({
    id: "split-b",
    path: "basketball/nba",
    startIso: "2026-10-05T02:00:00Z",
    venue: "Chase Center",
    away: side({ id: "13", abbrev: "LAL" }),
    home: side({ id: "9", abbrev: "GS" }),
  }),
]);
assertEqual(splitSquad.length, 2, "a genuine split-squad (two venues) stays");

const sec: StandGroup[] = [
  {
    name: "2026 Southeastern Conference",
    columns: ["Conf", "All"],
    rows: [
      { id: "333", name: "Alabama", abbrev: "ALA", logo: null, cells: ["2-0", "5-0"], bar: 1, clinch: null },
      { id: "61", name: "Georgia", abbrev: "UGA", logo: null, cells: ["2-0", "5-0"], bar: 1, clinch: null },
      { id: "57", name: "Florida", abbrev: "FLA", logo: null, cells: ["1-1", "4-1"], bar: 0.7, clinch: null },
      { id: "99", name: "LSU", abbrev: "LSU", logo: null, cells: ["1-1", "4-1"], bar: 0.7, clinch: null },
      { id: "96", name: "Kentucky", abbrev: "UK", logo: null, cells: ["1-1", "3-2"], bar: 0.6, clinch: null },
      { id: "238", name: "Vanderbilt", abbrev: "VAN", logo: null, cells: ["1-1", "3-2"], bar: 0.6, clinch: null },
      { id: "265", name: "Texas A&M", abbrev: "TA&M", logo: null, cells: ["1-1", "3-2"], bar: 0.5, clinch: null },
      { id: "142", name: "Missouri", abbrev: "MIZ", logo: null, cells: ["1-1", "4-1"], bar: 0.5, clinch: null },
    ],
  },
];
assertEqual(standingFromGroups(sec, "142"), "8th in SEC", "table place is 8th, not ESPN's 7th");
const snaps = applyTableStandings(
  [{ key: "cfb-mizzou", standing: "7th in SEC" }],
  { "football/college-football": sec },
  [{ key: "cfb-mizzou", espnPath: "football/college-football/teams/142" }],
);
assertEqual(snaps[0]?.standing, "8th in SEC", "the club strip uses the same table order");

const preseason = basketballStandingsSpec("basketball/nba", [
  {
    name: "Western Conference",
    entries: [
      {
        team: { id: "13", abbreviation: "LAL" },
        stats: [
          { type: "total", displayValue: "0-0" },
          { type: "vsconf", displayValue: "2-1" },
          { type: "overall", displayValue: "—" },
        ],
      },
    ],
  },
]);
assert(preseason && preseason !== "hide" && preseason.columns[0]?.label === "Preseason", "NBA preseason uses a Preseason column");

const hideEmpty = basketballStandingsSpec("basketball/nba", [
  {
    name: "Western Conference",
    entries: [{ team: { id: "13" }, stats: [{ type: "total", displayValue: "—" }, { type: "vsconf", displayValue: "—" }] }],
  },
]);
assertEqual(hideEmpty, "hide", "empty NBA table is hidden");

assert(
  /Sat Oct 10/.test(gameDay(game({ id: "epl", path: "soccer/eng.1", startIso: "2026-10-10T14:00:00Z", day: "2026-10-10" }))),
  "upcoming soccer prints the day",
);
assert(
  formatFixtureWhen("2026-10-10T14:00:00Z").startsWith("Sat Oct 10 ·"),
  `fixture clock is day + time, got ${formatFixtureWhen("2026-10-10T14:00:00Z")}`,
);

assert(formatKickoffLine("2026-10-10T16:00:00Z") === "Sat 11:00 AM", "CFB kickoff is weekday + CT, with minutes");
assert(looksLikeEspnZoneClock("10/10 - 12:00 PM EDT"), "ESPN date+EDT stamp is rejected");
assert(looksLikeEspnZoneClock("12:00 PM EDT"), "bare EDT stamp is rejected");
assert(!looksLikeEspnZoneClock("Final"), "Final is not an ESPN zone clock");
assertEqual(
  gameClock(
    game({
      id: "cfb-kick",
      path: "football/college-football",
      startIso: "2026-10-10T16:00:00Z",
      status: "10/10 - 12:00 PM EDT",
    }),
  ),
  "11:00 AM",
  "upcoming clock never prints ESPN EDT",
);
assertEqual(
  gameClock(
    game({
      id: "cfb-notz",
      path: "football/college-football",
      startIso: null,
      status: "10/10 - 12:00 PM EDT",
    }),
  ),
  "",
  "missing ISO does not fall back to the ESPN zone stamp",
);

function nflGame(
  id: string,
  day: string,
  startIso: string,
  away: string,
  home: string,
  extra: Partial<BoxGame> = {},
): BoxGame {
  return game({
    id,
    path: "football/nfl",
    league: "NFL",
    day,
    startIso,
    espnEventId: id,
    away: side({ id: away.toLowerCase(), abbrev: away }),
    home: side({ id: home.toLowerCase(), abbrev: home }),
    ...extra,
  });
}

const week4 = [
  nflGame("kc-lv", "2026-10-04", "2026-10-04T20:05:00Z", "KC", "LV", {
    final: true,
    status: "Final",
    away: side({ id: "kc", abbrev: "KC", score: "30", winner: true }),
    home: side({ id: "lv", abbrev: "LV", score: "27" }),
  }),
  nflGame("dal-hou", "2026-10-04", "2026-10-04T17:00:00Z", "DAL", "HOU", {
    final: true,
    status: "Final",
    away: side({ id: "dal", abbrev: "DAL", score: "34", winner: true }),
    home: side({ id: "hou", abbrev: "HOU", score: "30" }),
  }),
  nflGame("car-det", "2026-10-04", "2026-10-05T00:20:00Z", "CAR", "DET", {
    final: true,
    status: "Final",
    away: side({ id: "car", abbrev: "CAR", score: "32", winner: true }),
    home: side({ id: "det", abbrev: "DET", score: "26" }),
  }),
  nflGame("atl-no", "2026-10-05", "2026-10-06T00:15:00Z", "ATL", "NO", {
    final: false,
    status: "8:15 PM",
  }),
];
const week5 = [
  nflGame("dal-tb", "2026-10-08", "2026-10-09T00:15:00Z", "DAL", "TB"),
  nflGame("kc-jax", "2026-10-11", "2026-10-11T17:00:00Z", "KC", "JAX"),
  nflGame("det-kc-later", "2026-10-12", "2026-10-13T00:20:00Z", "DET", "KC"),
];

const mondayBoard = footballWeeksBoard({
  day: "2026-10-05",
  newsDay: "2026-10-04",
  week: 4,
  thisGames: week4,
  priorGames: [],
  nextGames: week5,
  college: false,
});
assert(mondayBoard.week?.some((g) => g.id === "kc-lv"), "KC is on the Week 4 board");
assert(mondayBoard.week?.some((g) => g.id === "car-det"), "DET is on the Week 4 board");
assert((mondayBoard.week?.length ?? 0) === 4, "the results week keeps every game, including MNF");
assert(mondayBoard.slate.every((g) => week5.some((n) => n.id === g.id)), "the slate is the next week");
assert(mondayBoard.slate.some((g) => g.id === "dal-tb"), "Thursday's Cowboys game is on the schedule");
assert(mondayBoard.slate[0]?.id === "dal-tb", "the schedule is chronological");
assert(mondayBoard.weekLabel === "Week 4", "Monday still labels last week's board");
assert(mondayBoard.slateWeekNumber === 5, "the upcoming week is 5");

const rolled = footballWeeksBoard({
  day: "2026-10-06",
  newsDay: "2026-10-05",
  week: 5,
  thisGames: week5,
  priorGames: week4.filter((g) => g.final),
  nextGames: [],
  college: false,
});
assert(rolled.week?.some((g) => g.id === "kc-lv"), "after ESPN rolls, last week's KC final still prints");
assert(rolled.slate.some((g) => g.id === "dal-tb"), "Week 5 is the schedule once ESPN rolls");

const bands = sportScoreBands("football/nfl", mondayBoard, "2026-10-05-evening");
assert(bands[0]?.games.some((g) => g.id === "kc-lv"), "NFL1's rail includes KC");
assert(bands[0]?.games.some((g) => g.id === "car-det"), "NFL1's rail includes DET");

assert(shortBroadcast("Prime Video") === "Prime", "Prime Video shortens to Prime");
assert(shortBroadcast("Amazon Prime") === "Prime", "Amazon Prime shortens to Prime");
assert(shortBroadcast("NFL Network") === "NFLN", "NFL Network shortens");
assert(shortBroadcast("CBS") === "CBS", "CBS stays");

const thu = slateKickoff({
  final: false,
  live: false,
  status: "Scheduled",
  startIso: "2026-10-09T00:15:00Z",
});
assert(/^Thu\s/.test(thu) && /\d{1,2}:\d{2}/.test(thu), `kickoff is weekday + clock (${thu})`);
assert(!/Oct/.test(thu), "slate kickoff drops the calendar date");

console.log("newspaper-box ok");
