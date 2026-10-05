/**
 * Run with: node --experimental-strip-types src/lib/newspaper-recap.test.ts
 * from CommandCenter-main/.
 */
import {
  boxGameFromPack,
  mlbTeamColor,
  packFromBoxGame,
  pickRecapLeaders,
  recapIsFull,
  recapPhotoKind,
  recapSportFamily,
  type RecapGamePack,
  type RecapLeader,
} from "./newspaper-recap.ts";
import { periodLabels, type BoxGame, type BoxSide } from "./newspaper-box.ts";
import { ESPN_BOX_PATHS } from "./newspaper-agate.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

assert(recapPhotoKind(null) === "none", "no photo is skipped");
assert(recapPhotoKind("https://img/x.jpg", 640) === "inset", "under 800 is inset");
assert(recapPhotoKind("https://img/x.jpg", 1200) === "wide", "a wide cut stretches");
assert(recapPhotoKind("https://img/x.jpg") === "wide", "unknown width stays wide");
assert(recapPhotoKind("https://img/x.jpg", 0) === "wide", "a zero width is treated as unknown");

assert(recapIsFull({ followed: true }), "a followed club is full");
assert(recapIsFull({ favoriteKey: "nfl-det" }), "a favorite key is full");
assert(recapIsFull({ ranked: true }), "a ranked game is full");
assert(recapIsFull({ postseason: true }), "a postseason game is full");
assert(!recapIsFull({}), "a random desk wrap is compact");

assert(recapSportFamily("baseball/mlb") === "baseball", "MLB family");
assert(recapSportFamily("hockey/nhl") === "hockey", "NHL family");
assert(recapSportFamily("basketball/nba") === "basketball", "NBA family");
assert(recapSportFamily("football/college-football") === "football", "CFB family");
assert(mlbTeamColor("STL") === "#C41E3A", "Cardinals red");
assert(mlbTeamColor("chc") === "#0E3386", "Cubs blue");

const football: RecapLeader[] = [
  { label: "Passing Yards", name: "A. Simmons", line: "23/30, 340 YDS, 2 TD", headshot: "p.jpg", team: "MIZ", id: "1", href: null },
  { label: "Rushing Yards", name: "J. Roberts", line: "24 CAR, 211 YDS, 3 TD", headshot: "r.jpg", team: "MIZ", id: "2", href: null },
  { label: "Receiving Yards", name: "C. Lee", line: "8 REC, 110 YDS", headshot: "c.jpg", team: "MIZ", id: "3", href: null },
  { label: "Tackles", name: "D. Safety", line: "12 TOT", headshot: null, team: "FLA", id: "4", href: null },
];
const fb = pickRecapLeaders("football/college-football", football);
assert(fb.map((l) => l.label).join(",") === "Pass,Rush,Rec", fb.map((l) => l.label).join(","));
assert(fb[0]?.name === "A. Simmons", "pass chip");

const nba = pickRecapLeaders("basketball/nba", [
  { label: "Points", name: "J. Embiid", line: "28 PTS", headshot: null, team: "PHI", id: "1", href: null },
  { label: "Rebounds", name: "P. George", line: "11 REB", headshot: null, team: "PHI", id: "2", href: null },
  { label: "Assists", name: "T. Maxey", line: "9 AST", headshot: null, team: "PHI", id: "3", href: null },
]);
assert(nba.map((l) => l.label).join(",") === "Points,Rebounds,Assists", nba.map((l) => l.label).join(","));

const nhl = pickRecapLeaders("hockey/nhl", [
  { label: "Points", name: "R. Thomas", line: "1 G, 2 A", headshot: "t.jpg", team: "STL", id: "1", href: null },
  { label: "Saves", name: "J. Binnington", line: "28 SV", headshot: "b.jpg", team: "STL", id: "2", href: null },
  { label: "Goals", name: "P. Buchnevich", line: "2 G", headshot: null, team: "STL", id: "3", href: null },
]);
assert(nhl[0]?.label === "Points" && nhl[1]?.label === "Goals" && nhl[2]?.label === "Goalie", nhl.map((l) => l.label).join(","));
const nhlGoalies = pickRecapLeaders(
  "hockey/nhl",
  [{ label: "Points", name: "K. Connor", line: "3 PTS", headshot: null, team: "WPG", id: "1", href: null }],
  [
    { label: "W", person: { id: "2", name: "S. Skinner", line: "33 SV", headshot: "s.jpg" } },
    { label: "L", person: { id: "3", name: "J. Gibson", line: "24 SV", headshot: "g.jpg" } },
  ],
);
assert(nhlGoalies.some((l) => l.label === "Goalie" && l.name === "S. Skinner"), "winning goalie is the Goalie chip");

const mlb = pickRecapLeaders(
  "baseball/mlb",
  [{ label: "Batting", name: "N. Arenado", line: "3-4, HR, 2 RBI", headshot: "a.jpg", team: "STL", id: "4", href: null }],
  [
    { label: "W", person: { id: "1", name: "S. Gray", line: "6 IP, 2 ER", headshot: "g.jpg" } },
    { label: "L", person: { id: "2", name: "S. Imanaga", line: "5 IP, 4 ER", headshot: "i.jpg" } },
    { label: "S", person: { id: "3", name: "R. Helsley", line: "1 IP", headshot: "h.jpg" } },
  ],
);
assert(mlb[0]?.label === "Winner" && mlb[0]?.name === "S. Gray", "winning pitcher");
assert(mlb.map((l) => l.label).join(",") === "Winner,Loser,Save", "save takes the third chip");
const mlbHit = pickRecapLeaders(
  "baseball/mlb",
  [{ label: "Batting", name: "N. Arenado", line: "3-4, HR, 2 RBI", headshot: "a.jpg", team: "STL", id: "4", href: null }],
  [
    { label: "W", person: { id: "1", name: "S. Gray", line: "6 IP, 2 ER", headshot: "g.jpg" } },
    { label: "L", person: { id: "2", name: "S. Imanaga", line: "5 IP, 4 ER", headshot: "i.jpg" } },
  ],
);
assert(mlbHit[2]?.name === "N. Arenado" && mlbHit[2]?.label === "Hit", "no save: the hitter is the third chip");

const side = (abbrev: string, color: string | null, extra: Partial<BoxSide> = {}): BoxSide => ({
  id: abbrev,
  name: abbrev,
  short: abbrev,
  abbrev,
  logo: null,
  color,
  score: "4",
  hits: "8",
  errors: "0",
  record: "80-82",
  winner: abbrev === "STL",
  rank: null,
  lines: [0, 1, 0, 2],
  ...extra,
});

const game: BoxGame = {
  id: "mlb-1",
  path: "baseball/mlb",
  league: "MLB",
  day: "2026-10-04",
  startIso: null,
  status: "Final",
  final: true,
  live: false,
  venue: "Busch Stadium",
  round: null,
  series: null,
  periods: ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
  away: side("CHC", null),
  home: side("STL", null),
  decisions: [{ label: "W", person: { id: "1", name: "S. Gray", line: "6 IP", headshot: "g.jpg" } }],
  probables: { away: null, home: null },
  leaders: [],
  scoring: [],
  recap: null,
  broadcasts: [],
  gamePk: 1,
  espnEventId: null,
  href: null,
};

const pack = packFromBoxGame(game);
assert(pack.home.color === "#C41E3A", "Cardinals color fills in from the abbrev");
assert(pack.away.color === "#0E3386", "Cubs color fills in");
assert(pack.leaders[0]?.name === "S. Gray", "decision becomes a chip");
assert(pack.periods.length === 9, "MLB innings stay on the pack");

const rebuilt = boxGameFromPack(pack, "401");
assert(rebuilt.espnEventId === "401", "event id rides along");
assert(rebuilt.away.hits === "8", "R/H/E survives the round trip");

const stored: RecapGamePack = {
  path: "football/nfl",
  league: "NFL",
  venue: "Ford Field",
  status: "Final",
  final: true,
  live: false,
  periods: ["1", "2", "3", "4"],
  away: {
    id: "8",
    name: "Detroit Lions",
    short: "Lions",
    abbrev: "DET",
    logo: "det.png",
    color: "#0076B6",
    score: "26",
    record: "4-1",
    winner: false,
    hits: null,
    errors: null,
    lines: [3, 3, 10, 10],
  },
  home: {
    id: "29",
    name: "Carolina Panthers",
    short: "Panthers",
    abbrev: "CAR",
    logo: "car.png",
    color: "#0085CA",
    score: "32",
    record: "3-2",
    winner: true,
    hits: null,
    errors: null,
    lines: [0, 13, 3, 16],
  },
  leaders: football,
};
const fromStored = boxGameFromPack(stored);
assert(fromStored.home.score === "32", "stored pack becomes a box game");
assert(fromStored.periods.join("") === "1234", "quarters");

assert(periodLabels("baseball/mlb", 9).join(",") === "1,2,3,4,5,6,7,8,9", "MLB innings");
assert(periodLabels("baseball/mlb", 11).includes("11"), "MLB extras");
assert(periodLabels("hockey/nhl", 4).join(",") === "1,2,3,OT", "NHL OT");
assert(periodLabels("hockey/nhl", 5).includes("SO"), "NHL shootout");
assert(periodLabels("basketball/nba", 5).includes("OT"), "NBA OT");
assert(periodLabels("football/nfl", 4).join(",") === "1,2,3,4", "NFL quarters");
assert(ESPN_BOX_PATHS.has("basketball/nba") && ESPN_BOX_PATHS.has("baseball/mlb") && ESPN_BOX_PATHS.has("football/college-football"), "every desk sport has an ESPN box");

console.log("newspaper-recap ok");
