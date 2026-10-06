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
  recapIsFull,
  recapIsScoreOnly,
  recapIsScoreStub,
  recapPhotoKind,
  recapDropLead,
  recapCardGraf,
  recapCardSource,
  recapDeskGraf,
  recapIsTeaserLead,
  recapScoreCardGraf,
  recapKicker,
  recapTeamNick,
  recapPrintStory,
  recapPullQuote,
  recapShouldDropCap,
  recapSportFamily,
  stripRecapScoreStubs,
  splitApDateline,
  type RecapGamePack,
  type RecapLeader,
} from "./newspaper-recap.ts";
import {
  compactScoringByPeriod,
  flattenScoringRows,
  pitchingDecisionCode,
  printEspnBoxHtml,
  printRecapFillHtml,
  printScoringMode,
  printTeamStatRows,
  type EspnBox,
} from "./newspaper-agate.ts";
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
assert(recapIsScoreStub("Final: LAC 23 · SEA 30."), "the banner score stub is not a graf");
assert(recapIsScoreOnly("Final: LAC 23 · SEA 30."), "Final: score is score-only");
assert(
  stripRecapScoreStubs("Kenneth Walker ran for two scores. Final: LAC 23 · SEA 30.") ===
    "Kenneth Walker ran for two scores.",
  "the Final stub drops so the recap sentence stays",
);
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

const twoGrafs = recapCardGraf(
  "MILWAUKEE -- — Jackson Chourio hit a two-run single in the tenth. The Brewers walked off the Padres.\n\nSan Diego had led since the fourth and left the bases loaded.",
);
assert(twoGrafs.dateline === "MILWAUKEE", "card graf keeps the city");
assert(twoGrafs.body.includes("walked off"), "first paragraph stays");
assert(twoGrafs.body.includes("San Diego had led"), "a short first paragraph pulls the next");
assert(twoGrafs.body.endsWith("."), "card graf ends on a sentence");
const thinLead = recapCardGraf(
  "LONDON -- — Sip some tea, score some touchdowns.\n\nJonathan Taylor ran for two touchdowns and Daniel Jones added a rushing score as the Colts beat the Commanders on Sunday.",
);
assert(thinLead.body.includes("Sip some tea"), "the kicker fragment stays");
assert(thinLead.body.includes("Jonathan Taylor"), "a one-sentence lead pulls the next graf");
assert(recapIsTeaserLead("Sip some tea, score some touchdowns."), "a one-line kicker is a teaser");
assert(recapIsTeaserLead("An ugly win left the Green Bay Packers dissatisfied."), "a mood dek is a teaser");
assert(!recapIsTeaserLead("Jonathan Taylor ran for two touchdowns and Daniel Jones added a rushing score as the Colts beat the Commanders on Sunday."), "a recap sentence is not a teaser");
const deskTea = recapDeskGraf(
  "LONDON -- — Sip some tea, score some touchdowns.\n\nJonathan Taylor ran for two touchdowns and Daniel Jones added a rushing score as the Colts beat the Commanders on Sunday. Indianapolis scored on its first three drives.",
);
assert(!/Sip some tea/i.test(deskTea.body), "desk graf drops the kicker");
assert(deskTea.body.includes("Jonathan Taylor"), "desk graf keeps the recap");
assert(deskTea.body.includes("first three drives"), "desk graf runs 2–4 sentences");
const deskUgly = recapDeskGraf(
  "An ugly win left the Green Bay Packers dissatisfied.",
  "Jordan Love threw for 245 yards and two scores as Green Bay held off the Cowboys. The Packers scored on their first two second-half drives. Dallas turned it over at midfield late.",
);
assert(!/ugly win/i.test(deskUgly.body), "desk graf does not print the one-line dek");
assert(deskUgly.body.includes("Jordan Love"), "a teaser-only story uses the box wrap");
assert((deskUgly.body.match(/[.!?]/g) ?? []).length >= 2, "desk fallback is at least two sentences");
const cardTea = recapScoreCardGraf(
  "Sip some tea, score some touchdowns.",
  "Jonathan Taylor ran for two touchdowns and Daniel Jones added a rushing score as the Colts beat the Commanders on Sunday. Indianapolis scored on its first three drives.",
);
assert(!/Sip some tea/i.test(cardTea), "a score card drops the one-line dek");
assert(cardTea.includes("Jonathan Taylor"), "a score card uses the story body");
const cardMaye = recapScoreCardGraf("Drake Maye didn't have to be perfect…", "Drake Maye shook off two first-half turnovers and threw three touchdown passes. New England held off Buffalo 29-26.");
assert(!/didn't have to be perfect/i.test(cardMaye) || cardMaye.includes("three touchdown"), "Maye teaser yields a real graf");
const cardUgly = recapScoreCardGraf(
  "An ugly win left the Green Bay Packers dissatisfied.",
  "Jordan Love threw for 245 yards and two scores as Green Bay held off Tampa Bay. The Packers scored on their first two second-half drives.",
);
assert(!/ugly win/i.test(cardUgly), "a score card drops the mood dek");
assert(cardUgly.includes("Jordan Love"), "a score card uses the story body for a mood dek");
const longGraf = recapCardGraf(
  "KANSAS CITY -- — Patrick Mahomes threw for 285 yards and two touchdowns on Sunday night as the Kansas City Chiefs held off the Las Vegas Raiders in a four-quarter scrap at Arrowhead Stadium.\n\nLas Vegas had led since the second quarter and left points on the field.",
);
assert(longGraf.body.includes("Patrick Mahomes"), "a full first paragraph stays");
assert(!/Las Vegas had led/.test(longGraf.body), "a 25-word first paragraph does not pull the next");
const longFirst = recapCardGraf(
  "LONDON -- — Jonathan Taylor ran for two touchdowns. Daniel Jones added a rushing score. The Colts won a third-string snap in London. A late field goal sealed it after the Commanders turned the ball over.",
  120,
);
assert(longFirst.body.endsWith("."), `card graf cuts on a sentence, got ${longFirst.body}`);
assert(!/turned the ball/.test(longFirst.body), "card graf does not run past the cap");
assert(!/third-strin[^g]/.test(longFirst.body), "card graf does not stop mid-word");
assert(recapCardGraf("Jazz 109, Nuggets 97.").body === "", "score-only card graf is omitted");
const stubGraf = recapCardGraf(
  "Kenneth Walker III ran for 107 yards and two touchdowns as Seattle held off the Chargers. Final: LAC 23 · SEA 30.\n\nJustin Herbert threw for 254 yards but Los Angeles stalled in the red zone twice in the fourth quarter. The Seahawks iced it with a late field goal.",
);
assert(!/Final:/.test(stubGraf.body), "card graf drops the Final stub");
assert(stubGraf.body.includes("Kenneth Walker"), "card graf keeps the recap lead");
assert(stubGraf.body.includes("red zone") || stubGraf.body.includes("field goal"), "a thin lead pulls the next sentences");

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
  recapPullQuote(
    'LAS VEGAS — The Chiefs won. “I think you have to stay with it, but it’s not always going to be pretty,” Mahomes said. Reid trusted him.',
  ) === "“I think you have to stay with it, but it’s not always going to be pretty.”",
  "pull quote takes a spoken line from later in the wrap",
);
assert(recapPullQuote("The Chiefs won 30-27.") === null, "a wrap without a quote does not invent one");

const fill = printRecapFillHtml(
  box,
  {
    quote: "“I think you have to stay with it.”",
    nextUp: "Next: Chargers on Oct. 18",
    standings: [
      { team: "Chiefs", record: "4-0", me: true },
      { team: "Chargers", record: "3-1" },
    ],
    related: ["Mahomes on the close one in Las Vegas"],
  },
  "card",
);
assert(fill.includes("J. Taylor 20 yd run"), "fill leads with the scoring summary");
assert(fill.includes("Total yards"), "fill sets team stats after scoring");
assert(fill.indexOf("Scoring") < fill.indexOf("Team stats"), "scoring comes before team stats");
assert(fill.indexOf("Team stats") < fill.indexOf("I think you have to stay"), "a pull quote follows the tables");
assert(fill.indexOf("stay with it") < fill.indexOf("Chargers on Oct. 18"), "next game follows the quote");
assert(fill.includes("Chiefs") && fill.includes("4-0"), "standings snippet is in the fill");
assert(fill.includes("Mahomes on the close one"), "related headlines close the leftover");

const chiefsScoring = [
  {
    label: "First quarter",
    plays: [
      { side: "away" as const, team: "BAL", clock: "8:12", tag: "TD", lead: ["H. Henry 2 yd pass"], detail: [], score: "7-0" },
      { side: "home" as const, team: "KC", clock: "3:04", tag: "TD", lead: ["P. Mahomes 6 yd run"], detail: [], score: "7-7" },
    ],
  },
  {
    label: "Second quarter",
    plays: [{ side: "home" as const, team: "KC", clock: "0:18", tag: "FG", lead: ["H. Butker 41 yd FG"], detail: [], score: "7-10" }],
  },
  {
    label: "Third quarter",
    plays: [{ side: "away" as const, team: "BAL", clock: "9:40", tag: "TD", lead: ["D. Henry 3 yd run"], detail: [], score: "14-10" }],
  },
  {
    label: "Fourth quarter",
    plays: [
      { side: "home" as const, team: "KC", clock: "14:50", tag: "TD", lead: ["X. Worthy 8 yd pass"], detail: [], score: "14-17" },
      { side: "away" as const, team: "BAL", clock: "2:11", tag: "TD", lead: ["L. Jackson 1 yd run"], detail: [], score: "21-17" },
      { side: "home" as const, team: "KC", clock: "0:22", tag: "TD", lead: ["T. Kelce 7 yd pass"], detail: [], score: "21-24" },
      { side: "away" as const, team: "BAL", clock: "0:04", tag: "TD", lead: ["Z. Flowers 31 yd pass"], detail: [], score: "27-24" },
      { side: "home" as const, team: "KC", clock: "0:00", tag: "FG", lead: ["H. Butker 44 yd FG"], detail: [], score: "27-30" },
    ],
  },
];
const compact = compactScoringByPeriod(chiefsScoring);
assert(compact.length === 4, "compact scoring is one line per quarter");
assert(compact[3]?.score === "27-30", "compact scoring ends on the final, not a mid-quarter line");
assert(flattenScoringRows(chiefsScoring).length === 9, "play-by-play keeps every scoring play");
assert(printScoringMode(9, 4) === "compact", "a long card uses the by-quarter summary");
assert(printScoringMode(3, 2) === "full", "a short card can set every play");
assert(printScoringMode(0, 0) === "link", "no plays is not a table");
const longFill = printRecapFillHtml({ ...box, scoring: chiefsScoring }, {}, "card");
assert(longFill.includes("27-30"), "print fill ends on the final score");
assert(longFill.includes("Full scoring in Full story"), "a truncated table points to the full story");
assert(!/14:50/.test(longFill), "compact print does not stop on a mid-fourth score");

const nhlStats = [
  { label: "Shots on goal", away: "28", home: "31" },
  { label: "Power plays", away: "1-3", home: "0-2" },
  { label: "Shorthanded goals", away: "0", home: "0", sub: true },
  { label: "Faceoffs won", away: "32 (54%)", home: "27 (46%)" },
  { label: "Hits", away: "22", home: "18" },
  { label: "Blocked shots", away: "14", home: "11" },
  { label: "Giveaways", away: "8", home: "6" },
  { label: "Takeaways", away: "5", home: "7" },
  { label: "Penalty minutes", away: "8", home: "6" },
];
const nhlBox = { ...box, game: { ...box.game, path: "hockey/nhl" }, teamStats: nhlStats };
const pageStats = printTeamStatRows(nhlBox, "page");
assert(pageStats.truncated && pageStats.rows.length <= 8, "a long page table yields leftover to Full story");
assert(pageStats.rows.some((r) => r.label === "Shots on goal"), "trimmed stats keep the lead numbers");
const nhlFill = printRecapFillHtml(nhlBox, {}, "page");
assert(nhlFill.includes("Full team stats in Full story"), "print points leftover team stats at Full story");
assert(!nhlFill.includes("Penalty minutes"), "print does not set every NHL team-stat row on the page");
const cardStats = printTeamStatRows(nhlBox, "card");
assert(cardStats.rows.length <= 4 && cardStats.truncated, "a card keeps the key hockey numbers");

assert(recapTeamNick("Los Angeles Dodgers") === "Dodgers", "city drops off the kicker");
assert(recapTeamNick("Milwaukee Brewers") === "Brewers", "Brewers nickname");
assert(recapTeamNick("Vegas Golden Knights") === "Golden Knights", "Knights keep Golden");
assert(recapTeamNick("Dodgers") === "Dodgers", "a nickname stays");
const dodgersWin = {
  ...rebuilt,
  league: "MLB",
  away: { ...rebuilt.away, short: "Dodgers", winner: false, score: "2" },
  home: { ...rebuilt.home, short: "Braves", winner: true, score: "3" },
};
assert(
  recapKicker({ sportLabel: "MLB", teamName: "Los Angeles Dodgers" }, dodgersWin) === "MLB · Braves",
  "kicker names the winner, not the losing club the story was filed under",
);
assert(
  recapKicker({ sportLabel: "NHL", teamName: "Vancouver Canucks" }, {
    ...rebuilt,
    league: "NHL",
    away: { ...rebuilt.away, short: "Golden Knights", winner: true },
    home: { ...rebuilt.home, short: "Canucks", winner: false },
  }) === "NHL · Golden Knights",
  "a Vegas win is not labeled Canucks",
);
const injuryCard = recapCardSource(
  {
    headline: "Bengals WR Tee Higgins day-to-day with adductor injury, coach saying",
    body: "Higgins is considered day-to-day with an adductor issue he suffered toward the end of Sunday's 22-17 loss.",
  },
  {
    recap: {
      headline: "Jaguars hold off Bengals 22-17",
      html: "<p>JACKSONVILLE -- — Trevor Lawrence threw two touchdown passes and the Jaguars held off the Bengals 22-17 on Sunday.</p>",
    },
  },
);
assert(injuryCard.headline.includes("Jaguars"), "the card hed is the game recap, not the injury note");
assert(injuryCard.body.includes("Trevor Lawrence"), "the card graf is the AP/ESPN game story");

console.log("newspaper-recap ok");
