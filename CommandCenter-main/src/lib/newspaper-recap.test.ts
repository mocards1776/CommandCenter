/**
 * Run with: node --experimental-strip-types src/lib/newspaper-recap.test.ts
 * from CommandCenter-main/.
 */
import {
  boxGameFromPack,
  formatRecapWhen,
  mlbTeamColor,
  packFromBoxGame,
  pickRecapLeaders,
  preferClubRecapLeaders,
  recapIsFull,
  recapIsScoreOnly,
  recapPhotoKind,
  recapDropLead,
  recapPrintStory,
  recapShouldDropCap,
  recapSportFamily,
  splitApDateline,
  type RecapGamePack,
  type RecapLeader,
} from "./newspaper-recap.ts";
import { pitchingDecisionCode, printEspnBoxHtml, type EspnBox } from "./newspaper-agate.ts";
import { periodLabels, type BoxGame, type BoxSide } from "./newspaper-box.ts";
import { ESPN_BOX_PATHS } from "./newspaper-agate.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

assert(recapPhotoKind(null) === "none", "no photo is skipped");
assert(recapPhotoKind("https://img/x.jpg", 640) === "fit", "a small original is not stretched");
assert(recapPhotoKind("https://img/x.jpg", 350) === "fit", "a 350px cut stays at its sharp size");
assert(recapPhotoKind("https://img/x.jpg", 1200) === "wide", "a wide cut fills the column");
assert(recapPhotoKind("https://img/x.jpg") === "wide", "unknown width stays wide until measured");
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
const mlbSaveFromPool = pickRecapLeaders(
  "baseball/mlb",
  [
    { label: "Save", name: "R. Helsley", line: "1 IP", headshot: null, team: "STL", id: "3", href: null },
    { label: "Batting", name: "N. Arenado", line: "3-4", headshot: null, team: "STL", id: "4", href: null },
  ],
  [
    { label: "W", person: { id: "1", name: "S. Gray", line: "6 IP", headshot: null } },
    { label: "L", person: { id: "2", name: "S. Imanaga", line: "5 IP", headshot: null } },
  ],
);
assert(mlbSaveFromPool.map((l) => l.label).join(",") === "Winner,Loser,Save", "save from the leader pool still prints");
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

const london = splitApDateline("LONDON -- — Jonathan Taylor ran for two touchdowns.");
assert(london.dateline === "LONDON", `dateline city, got ${london.dateline}`);
assert(london.body.startsWith("Jonathan Taylor"), `body after the dash, got ${london.body}`);
assert(!/--/.test(london.body) && !london.body.startsWith("—"), "no leftover dashes on the body");
const milwaukee = splitApDateline("MILWAUKEE -- — Jackson Chourio hit a two-run single.");
assert(milwaukee.dateline === "MILWAUKEE" && milwaukee.body.startsWith("Jackson"), "Milwaukee dateline");

const when = formatRecapWhen("2026-10-04T13:30:00Z");
assert(/Sun\., Oct\. 4/.test(when), `friendly Central date, got ${when}`);
assert(/CT/.test(when) && !/GMT/.test(when), `Central clock, got ${when}`);
assert(/a\.m\.|p\.m\./.test(when), `a.m./p.m., got ${when}`);

assert(recapIsScoreOnly("Jazz 109, Nuggets 97."), "a score line is not a story");
assert(!recapShouldDropCap("Jazz 109, Nuggets 97."), "no drop cap on a one-line score");
assert(recapShouldDropCap("Taylor scored twice. Jones added a rushing touchdown. The Colts won."), "two sentences get a drop");
const mid = recapPrintStory("LONDON -- — Jonathan Taylor ran for two touchdowns. Daniel Jones also ran one in. The Colts won a third-string snap.", 80);
assert(mid.body.endsWith("."), `cut on a sentence, got ${mid.body}`);
assert(!/third-strin/.test(mid.body), "does not stop mid-word");
assert(mid.dateline === "LONDON", "print story keeps the city");
assert(recapPrintStory("Jazz 109, Nuggets 97.", 420).body === "", "score-only body is omitted");
const plugged = recapPrintStory(
  "LONDON -- — Taylor scored twice. The Colts won. ------ See AP’s full NFL coverage here",
  null,
);
assert(!/See AP/i.test(plugged.body) && plugged.body.endsWith("won."), `AP plug strips, got ${plugged.body}`);

const milwaukeeDrop = recapDropLead("MILWAUKEE", "MILWAUKEE — Jackson Chourio hit a two-run single.");
assert(milwaukeeDrop?.letter === "M", `drop is the dateline letter, got ${milwaukeeDrop?.letter}`);
assert(milwaukeeDrop?.datelineRest === "ILWAUKEE", `rest of the city, got ${milwaukeeDrop?.datelineRest}`);
assert(milwaukeeDrop?.body.startsWith("Jackson Chourio"), `word stays whole, got ${milwaukeeDrop?.body}`);
assert(!/MILWAUKEE/.test(milwaukeeDrop?.body ?? ""), "body does not repeat the dateline");
const noCity = recapDropLead(null, "Jackson Chourio hit a two-run single.");
assert(noCity?.letter === "J" && noCity.datelineRest === null && noCity.body.startsWith("ackson Chourio"), `no dateline drops the first word, got ${JSON.stringify(noCity)}`);

assert(pitchingDecisionCode("W, 1-0") === "W", "winning pitcher note");
assert(pitchingDecisionCode("L, 0-1, B, 1") === "L", "losing pitcher note");
assert(pitchingDecisionCode("S, 12") === "S", "save note");
assert(pitchingDecisionCode("H, 1") === null, "a hold is not a save");

const box: EspnBox = {
  game: rebuilt,
  pairs: [
    {
      key: "passing",
      label: "Passing",
      away: {
        title: "Colts",
        columns: ["C/ATT", "YDS", "TD"],
        rows: [{ id: "1", name: "D. Jones", cells: ["19/34", "143", "1"] }],
        totals: null,
      },
      home: {
        title: "Commanders",
        columns: ["C/ATT", "YDS", "TD"],
        rows: [{ id: "2", name: "M. Mariota", cells: ["12/21", "129", "1"] }],
        totals: null,
      },
    },
  ],
  teamStats: [{ label: "Total yards", away: "257", home: "317" }],
  scoring: [
    {
      label: "First quarter",
      plays: [
        {
          side: "away",
          team: "IND",
          clock: "8:12",
          tag: "TD",
          lead: ["J. Taylor 20 yd run"],
          detail: ["(J. Gay kick)"],
          score: "7-0",
        },
      ],
    },
  ],
  shots: null,
  stars: [],
  info: [],
};
const printed = printEspnBoxHtml(box);
assert(printed.includes("D. Jones") && printed.includes("19/34"), "passing table prints the line");
assert(printed.includes("J. Taylor 20 yd run"), "scoring lists the play");
assert(!/plays<\/|lines</i.test(printed) && !/\d+ plays/.test(printed) && !/\d+ \/ \d+ lines/.test(printed), "no count stubs");

assert(
  preferClubRecapLeaders(
    [
      { label: "Pass", name: "K. Cousins", line: "365 YDS", headshot: null, team: "LV", id: "14880", href: null },
      { label: "Rush", name: "K. Walker III", line: "177 YDS", headshot: null, team: "KC", id: "4567048", href: null },
    ],
    "KC",
  ).every((l) => l.team !== "LV"),
  "a Chiefs recap drops the Raiders passer",
);

console.log("newspaper-recap ok");
