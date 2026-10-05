/**
 * Run with: node --experimental-strip-types src/lib/newspaper-box.test.ts
 * from CommandCenter-main/.
 */
import {
  applyTableStandings,
  basketballStandingsSpec,
  dedupeBoxGames,
  dropBogusSameSlot,
  formatFixtureWhen,
  gameDay,
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

console.log("newspaper-box ok");
