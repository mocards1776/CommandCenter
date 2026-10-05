/**
 * Run with:
 *   node --experimental-strip-types supabase/functions/sports-finals/sports-finals.test.ts
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { cardFromSummary, finalCaption, formatFinalsTimestamp, highlightFromBox, pickCardLogoHref, pickMlbPerformers, starsFromLanding, statMagnitude } from "./card.ts";
import { mapMlbWinProbability, mlbInningLabels, mlbPlayRefs, mlbWinProbDomain } from "./mlb-win-probability.ts";
import { mapThreeStars } from "./nhl-stars.ts";
import { formatBestOf, formatPlayoffSeriesLine, mlbPlayoffFromSummary } from "./series.ts";
import { alertReplyMarkup } from "../_shared/telegram-markup.ts";
import { oddsFromSummary, parseDetails, spreadOutcome } from "./odds.ts";
import {
  DEFAULT_FINALS_CHAT_ID,
  parseChatIds,
  parseFavoriteTokens,
  parseScope,
  parseSports,
  shouldSendFinal,
} from "./select.ts";
import { tablesFromStandings, windowRows, shortGroupTitle } from "./standings.ts";
import {
  FINALS_ALERT_TARGET_HEIGHT,
  FINALS_ALERT_WIDTH,
  STANDINGS_GROUP_DY,
  STANDINGS_TITLE_DY,
  distinctTeamPaints,
  paintColor,
  renderFinalSvg,
} from "./svg.ts";
import { mapCfbWinProbability as edgeMap, plotCfbWinProbability as edgePlot } from "./win-probability.ts";

const appModuleUrl = [
  new URL("../../../CommandCenter-main/src/lib/cfb-win-probability.ts", import.meta.url),
  new URL("../../../src/lib/cfb-win-probability.ts", import.meta.url),
].find((url) => existsSync(fileURLToPath(url)));
if (!appModuleUrl) throw new Error("game-page win-probability module not found");
const { mapCfbWinProbability: appMap, plotCfbWinProbability: appPlot } = await import(appModuleUrl.href);

const series = [
  { homeWinPercentage: 0.45, tiePercentage: 0, playId: "a" },
  { homeWinPercentage: 0.62, playId: "b" },
  { homeWinPercentage: 1, playId: "c" },
  { homeWinPercentage: 0.2, playId: "ot" },
];
const plays = [
  { id: "a", period: 1, clock: "15:00" },
  { id: "b", period: 2, clock: "8:00" },
  { id: "c", period: 4, clock: "0:12" },
  { id: "ot", period: 5, clock: "4:00" },
];
assert.deepEqual(edgeMap(series, plays), appMap(series, plays));
assert.equal(edgeMap(undefined, []).length, 0);
{
  const live = edgeMap(series.slice(0, 2), plays.slice(0, 2));
  assert.deepEqual(edgePlot(live), appPlot(live));
  assert.ok(edgePlot(live)?.future, "live WP leaves remaining regulation unfilled");
  assert.ok(edgePlot(live) && !edgePlot(live)!.area.includes("L100 "), "home fill stops at last play");
}

{
  const mlbSeries = [
    { homeWinPercentage: 0.55, playId: "t1a" },
    { homeWinPercentage: 0.52, playId: "t1b" },
    { homeWinPercentage: 0.48, playId: "b1" },
    { homeWinPercentage: 0.41, playId: "t9" },
    { homeWinPercentage: 1, playId: "b9" },
    { homeWinPercentage: 0.62, playId: "t10" },
  ];
  const mlbPlays = [
    { id: "t1a", inning: 1, half: "top" as const },
    { id: "t1b", inning: 1, half: "top" as const },
    { id: "b1", inning: 1, half: "bottom" as const },
    { id: "t9", inning: 9, half: "top" as const },
    { id: "b9", inning: 9, half: "bottom" as const },
    { id: "t10", inning: 10, half: "top" as const },
  ];
  const mapped = mapMlbWinProbability(mlbSeries, mlbPlays);
  assert.equal(mapped.length, 6);
  assert.ok(mapped[0]!.elapsedSec < mapped[1]!.elapsedSec);
  assert.ok(mapped[0]!.elapsedSec < 1);
  assert.ok(mapped[2]!.elapsedSec >= 1 && mapped[2]!.elapsedSec < 2);
  assert.ok(mapped[4]!.elapsedSec >= 17);
  const domain = mlbWinProbDomain(mapped);
  assert.ok(domain > 18);
  assert.deepEqual(mlbInningLabels(18).map((row) => row.label), ["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
  assert.ok(mlbInningLabels(domain).some((row) => row.label === "EX"));
  assert.equal(mlbPlayRefs({ plays: [{ id: "x", period: { number: 4, type: "Bottom" } }] })[0]?.half, "bottom");
}
assert.ok(
  pickCardLogoHref({
    logos: [
      { href: "https://a.espncdn.com/i/teamlogos/mlb/500/sd.png", rel: ["full", "default"] },
      { href: "https://a.espncdn.com/i/teamlogos/mlb/500-dark/sd.png", rel: ["full", "dark"] },
    ],
  })?.includes("500-dark/sd.png"),
);

assert.deepEqual(parseScope(undefined), { favorites: true, ruwt: true, all: false });
assert.deepEqual(parseScope("all"), { favorites: false, ruwt: false, all: true });
assert.deepEqual(parseScope("favorites"), { favorites: true, ruwt: false, all: false });
assert.deepEqual(parseSports(undefined), ["nfl", "cfb", "mlb", "nhl"]);
assert.deepEqual(parseSports(""), ["nfl", "cfb", "mlb", "nhl"]);
assert.deepEqual(parseSports("nhl,soccer,mlb"), ["nhl", "mlb"]);
assert.deepEqual(parseSports("nfl,cfb"), ["nfl", "cfb"]);
assert.deepEqual(parseFavoriteTokens("nfl:CLE, cfb:333, nba:1"), [
  { sport: "nfl", token: "cle" },
  { sport: "cfb", token: "333" },
]);
assert.deepEqual(parseChatIds(undefined), [DEFAULT_FINALS_CHAT_ID]);
assert.deepEqual(parseChatIds("857547432, 99"), ["857547432"]);

const fav = [{ sport: "nfl", token: "cle" }];
const base = {
  scope: { favorites: true, ruwt: true, all: false },
  favorites: fav,
  sport: "nfl",
  away: { id: "23", abbrev: "PIT" },
  home: { id: "5", abbrev: "CLE" },
  everHot: false,
  alreadySent: false,
};
assert.equal(
  shouldSendFinal({ ...base, prev: null, nextPhase: "final" }),
  false,
  "first sight is a baseline",
);
assert.equal(
  shouldSendFinal({ ...base, prev: { phase: "live", everHot: false }, nextPhase: "final" }),
  true,
  "favorite final fires",
);
assert.equal(
  shouldSendFinal({
    ...base,
    favorites: [],
    prev: { phase: "live", everHot: true },
    nextPhase: "final",
    everHot: true,
  }),
  true,
  "ruwt final fires when the game was hot",
);
assert.equal(
  shouldSendFinal({
    ...base,
    favorites: [],
    prev: { phase: "live", everHot: false },
    nextPhase: "final",
    everHot: false,
  }),
  false,
);
assert.equal(
  shouldSendFinal({
    ...base,
    prev: { phase: "live", everHot: false },
    nextPhase: "final",
    alreadySent: true,
  }),
  false,
);
assert.equal(
  shouldSendFinal({
    ...base,
    scope: { favorites: false, ruwt: false, all: true },
    favorites: [],
    prev: { phase: "pregame", everHot: false },
    nextPhase: "final",
  }),
  true,
);
assert.equal(
  shouldSendFinal({
    ...base,
    sport: "nhl",
    favorites: [{ sport: "nhl", token: "stl" }],
    away: { id: "1", abbrev: "BOS" },
    home: { id: "19", abbrev: "STL" },
    prev: { phase: "live", everHot: false },
    nextPhase: "final",
  }),
  true,
  "NHL favorite final fires the same way as football",
);
assert.equal(
  shouldSendFinal({
    ...base,
    sport: "mlb",
    favorites: [{ sport: "mlb", token: "stl" }],
    away: { id: "16", abbrev: "CHC" },
    home: { id: "24", abbrev: "STL" },
    prev: { phase: "live", everHot: false },
    nextPhase: "final",
  }),
  true,
  "MLB favorite final fires the same way as football",
);

assert.equal(statMagnitude("3rd down efficiency", "4-13"), 4 / 13);
assert.equal(statMagnitude("Possession", "31:11"), 31 * 60 + 11);

const card = cardFromSummary("nfl", "401872964", {
  header: {
    competitions: [
      {
        status: { type: { state: "post", completed: true, shortDetail: "Final" } },
        date: "2026-10-02T00:15Z",
        venue: { fullName: "Huntington Bank Field" },
        competitors: [
          {
            homeAway: "away",
            score: "24",
            record: [{ type: "total", displayValue: "2-2" }],
            linescores: [{ displayValue: "7" }, { displayValue: "3" }, { displayValue: "0" }, { displayValue: "14" }],
            team: { id: "23", abbreviation: "PIT", displayName: "Pittsburgh Steelers", color: "000000", alternateColor: "ffb612" },
          },
          {
            homeAway: "home",
            score: "27",
            record: [{ type: "total", summary: "3-1" }],
            linescores: [{ value: 0 }, { value: 21 }, { value: 0 }, { value: 6 }],
            curatedRank: { current: 99 },
            team: { id: "5", abbreviation: "CLE", shortDisplayName: "Browns", color: "472a08", alternateColor: "ff3c00" },
          },
        ],
      },
    ],
  },
  article: { headline: "Browns outlast Steelers in Cleveland" },
  boxscore: {
    teams: [
      {
        team: { abbreviation: "PIT" },
        statistics: [
          { label: "Total Yards", displayValue: "361" },
          { label: "Turnovers", displayValue: "2" },
          { label: "Possession", displayValue: "31:11" },
        ],
      },
      {
        team: { abbreviation: "CLE" },
        statistics: [
          { label: "Total Yards", displayValue: "372" },
          { label: "Turnovers", displayValue: "1" },
          { label: "Possession", displayValue: "28:49" },
        ],
      },
    ],
    players: [
      {
        team: { abbreviation: "PIT" },
        statistics: [
          {
            name: "passing",
            labels: ["C/ATT", "YDS", "TD", "INT"],
            athletes: [{ athlete: { displayName: "Aaron Rodgers" }, stats: ["22/40", "299", "3", "2"] }],
          },
        ],
      },
      {
        team: { abbreviation: "CLE" },
        statistics: [
          {
            name: "passing",
            labels: ["C/ATT", "YDS", "TD", "INT"],
            athletes: [{ athlete: { displayName: "Joe Flacco" }, stats: ["18/25", "220", "2", "0"] }],
          },
        ],
      },
    ],
  },
  drives: {
    previous: [
      {
        plays: [
          { id: "a", period: { number: 1 }, clock: { displayValue: "12:00" } },
          { id: "b", period: { number: 4 }, clock: { displayValue: "0:08" } },
        ],
      },
    ],
  },
  pickcenter: [
    {
      details: "PIT -2.5",
      spread: 2.5,
      overUnder: 38.5,
      provider: { name: "DraftKings" },
      awayTeamOdds: { favorite: true, moneyLine: -148 },
      homeTeamOdds: { favorite: false, moneyLine: 124 },
      pointSpread: {
        away: { close: { line: "-2.5" } },
        home: { close: { line: "+2.5" } },
      },
    },
  ],
  winprobability: [
    { homeWinPercentage: 0.42, tiePercentage: 0, playId: "a" },
    { homeWinPercentage: 1, tiePercentage: 0, playId: "b" },
  ],
});

assert.equal(card.final, true);
assert.equal(card.away.score, 24);
assert.equal(card.home.score, 27);
assert.equal(card.away.record, "2-2");
assert.equal(card.home.record, "3-1");
assert.equal(card.home.rank, null);
assert.deepEqual(card.away.linescores, [7, 3, 0, 14]);
assert.equal(card.stats[0]?.label, "Total Yards");
assert.equal(card.stats.find((stat) => stat.label === "Turnovers")?.homeLeads, true);
assert.equal(card.leaders.length, 2);
assert.match(card.leaders[0]!.line, /22\/40/);
assert.equal(card.winProbability.length, 2);
assert.equal(card.path, "/sports/nfl/game/401872964?solo=1");
assert.deepEqual(card.standings, []);
assert.equal(card.date, "2026-10-02T00:15Z");
assert.equal(card.odds?.details, "PIT -2.5");
assert.equal(card.odds?.favoriteAbbrev, "PIT");
assert.equal(card.odds?.favoriteSpread, -2.5);
assert.equal(card.odds?.spreadResult, "not covered");
assert.equal(card.odds?.underdogWon, true);
assert.equal(card.odds?.noteworthyUpset, false);
assert.match(card.odds?.graphicLine ?? "", /PIT -2\.5 did not cover/);
assert.match(card.odds?.captionLine ?? "", /CLE \+124/);

const nflTree = {
  name: "National Football League",
  children: [
    {
      name: "American Football Conference",
      children: [
        {
          name: "AFC North",
          standings: {
            entries: [
              { team: { id: "5", abbreviation: "CLE", shortDisplayName: "Browns" }, stats: [{ name: "overall", displayValue: "3-1" }, { name: "gamesBehind", displayValue: "-" }] },
              { team: { id: "33", abbreviation: "BAL", shortDisplayName: "Ravens" }, stats: [{ name: "overall", displayValue: "2-2" }, { name: "gamesBehind", displayValue: "1" }] },
              { team: { id: "4", abbreviation: "CIN", shortDisplayName: "Bengals" }, stats: [{ name: "overall", displayValue: "2-2" }, { name: "gamesBehind", displayValue: "1" }] },
              { team: { id: "23", abbreviation: "PIT", shortDisplayName: "Steelers" }, stats: [{ name: "overall", displayValue: "2-2" }, { name: "gamesBehind", displayValue: "1" }] },
            ],
          },
        },
        {
          name: "AFC West",
          standings: {
            entries: [
              { team: { id: "12", abbreviation: "KC", shortDisplayName: "Chiefs" }, stats: [{ name: "overall", displayValue: "3-1" }, { name: "gamesBehind", displayValue: "-" }] },
            ],
          },
        },
      ],
    },
  ],
};
const afcNorth = tablesFromStandings("nfl", nflTree, { teamId: "23", abbrev: "PIT" }, { teamId: "5", abbrev: "CLE" });
assert.equal(afcNorth.length, 1);
assert.equal(afcNorth[0]!.title, "AFC North");
assert.equal(afcNorth[0]!.extraLabel, "GB");
assert.deepEqual(afcNorth[0]!.rows.map((row) => row.abbrev), ["CLE", "BAL", "CIN", "PIT"]);
assert.equal(afcNorth[0]!.total, 4);
assert.deepEqual(afcNorth[0]!.rows.map((row) => row.rank), [1, 2, 3, 4]);
const splitDiv = tablesFromStandings("nfl", nflTree, { teamId: "23", abbrev: "PIT" }, { teamId: "12", abbrev: "KC" });
assert.equal(splitDiv.length, 2);
assert.deepEqual(splitDiv.map((table) => table.title), ["AFC North", "AFC West"]);
assert.equal(shortGroupTitle("National League Central"), "NL Central");
assert.equal(shortGroupTitle("Southeastern Conference"), "SEC");
const longRows = Array.from({ length: 16 }, (_, i) => ({
  teamId: String(i + 1),
  abbrev: `T${i + 1}`,
  name: `Team ${i + 1}`,
  record: "1-0",
  extra: "0-0",
  rank: i + 1,
}));
assert.deepEqual(
  windowRows(longRows, ["3", "14"], 8).map((row) => row.teamId),
  ["2", "3", "4", "5", "13", "14", "15", "16"],
);
card.standings = afcNorth;
const caption = finalCaption(card, "https://command-center-flax-gamma.vercel.app/");
assert.match(caption, /^FINAL · NFL\nBrowns defeat Pittsburgh Steelers 27-24\./);
assert.match(caption, /Browns move to 3-1, Pittsburgh Steelers fall to 2-2\./);
assert.match(caption, /Aaron Rodgers threw for 299 yards/);
assert.doesNotMatch(caption, /Open game:|Odds:|Passing:|Underdog/);
assert.ok(caption.length <= 1000);
const finalsMarkup = alertReplyMarkup("https://command-center-flax-gamma.vercel.app/", card.path);
const finalsButtons = JSON.parse(finalsMarkup ?? "null") as {
  inline_keyboard: { text: string; url?: string; web_app?: { url: string } }[][];
} | null;
assert.ok(finalsButtons);
assert.equal(finalsButtons.inline_keyboard[0]![0]!.text, "Open game");
assert.equal(finalsButtons.inline_keyboard[0]![1]!.text, "RUWT board");
assert.equal(finalsButtons.inline_keyboard[0]![0]!.url, undefined);
assert.equal(
  finalsButtons.inline_keyboard[0]![0]!.web_app?.url,
  "https://command-center-flax-gamma.vercel.app/sports/nfl/game/401872964?solo=1",
);
assert.equal(
  finalsButtons.inline_keyboard[0]![1]!.web_app?.url,
  "https://command-center-flax-gamma.vercel.app/sports/ruwt?solo=1",
);
assert.equal(
  highlightFromBox("passing", ["C/ATT", "YDS", "TD", "INT"], ["22/40", "350", "3", "0"], "Josh Allen")?.text,
  "Josh Allen threw for 350 yards and 3 touchdowns.",
);

assert.equal(paintColor("000000", "ffb612"), "#ffb612");
assert.equal(paintColor("472a08", "ff3c00"), "#ff3c00");
assert.equal(paintColor("ba0c2f", "a8adb4"), "#ba0c2f");
{
  const paints = distinctTeamPaints("2f241d", "ffc425", "13294b", "ffc72c");
  assert.notEqual(paints.away.toLowerCase(), paints.home.toLowerCase(), "Padres and Brewers WP paints must differ");
}
assert.ok(Math.abs((card.stats.find((stat) => stat.label === "Turnovers")?.awayShare ?? 0) - 200 / 3) < 0.01);

const svg = renderFinalSvg(card);
assert.match(svg, />24</);
assert.match(svg, />27</);
assert.match(svg, /Win probability/);
assert.match(svg, /Standings/);
assert.match(svg, /AFC North/);
const standingsTitleY = Number(/<text[^>]*y="(\d+(?:\.\d+)?)"[^>]*>Standings<\/text>/.exec(svg)?.[1] ?? 0);
const groupLabelY = Number(/<text[^>]*y="(\d+(?:\.\d+)?)"[^>]*>AFC North<\/text>/.exec(svg)?.[1] ?? 0);
assert.ok(standingsTitleY > 0 && groupLabelY > 0, "Standings title and group label must both render");
assert.ok(
  groupLabelY - standingsTitleY >= STANDINGS_GROUP_DY - STANDINGS_TITLE_DY,
  `Standings title and group label overlap: title y=${standingsTitleY} group y=${groupLabelY}`,
);
assert.match(svg, /Team stats/);
assert.match(svg, /Box leaders/);
assert.match(svg, /Aaron Rodgers/);
assert.match(svg, /Total Yards/);
assert.match(svg, /Huntington Bank Field/);
assert.match(svg, />2-2</);
assert.match(svg, />3-1</);
assert.match(svg, /Thu, Oct 1, 7:15 PM CT/);
assert.match(svg, /PIT -2\.5 did not cover/);
assert.match(svg, /opacity="0\.38"/);
assert.doesNotMatch(svg, /Finals and Stats/);
assert.doesNotMatch(svg, /Last play|yard line|Field map|chains/i);
assert.equal((svg.match(/<image /g) ?? []).length, 0);
assert.match(svg, new RegExp(`width="${FINALS_ALERT_WIDTH}"`));
const fullHeight = Number(/<svg [^>]*height="(\d+(?:\.\d+)?)"/.exec(svg)?.[1] ?? 0);
assert.ok(
  fullHeight > 700 && fullHeight <= FINALS_ALERT_TARGET_HEIGHT + 40,
  `Telegram card should stay in the 1080×${FINALS_ALERT_TARGET_HEIGHT} slot, got ${fullHeight}`,
);

const wideWp = renderFinalSvg({ ...card, standings: [] });
assert.match(wideWp, /Win probability/);
assert.doesNotMatch(wideWp, /Standings|AFC North/);

const quiet = cardFromSummary("cfb", "1", {
  header: {
    competitions: [
      {
        status: { type: { state: "post", shortDetail: "Final" } },
        competitors: [
          { homeAway: "away", score: "14", team: { id: "1", abbreviation: "VAN", displayName: "Vanderbilt" } },
          {
            homeAway: "home",
            score: "38",
            curatedRank: { current: 4 },
            team: { id: "2", abbreviation: "UGA", displayName: "Georgia Bulldogs" },
          },
        ],
      },
    ],
  },
});
assert.equal(quiet.winProbability.length, 0);
assert.equal(quiet.home.rank, 4);
const quietSvg = renderFinalSvg(quiet);
assert.doesNotMatch(quietSvg, /Win probability/);
assert.doesNotMatch(quietSvg, /Standings/);
assert.match(quietSvg, /#4 Georgia Bulldogs|#4 UGA/);

const nhlCard = cardFromSummary("nhl", "401812345", {
  header: {
    competitions: [
      {
        status: { type: { state: "post", completed: true, shortDetail: "Final" } },
        venue: { fullName: "Enterprise Center" },
        competitors: [
          { homeAway: "away", score: "2", record: [{ type: "total", summary: "2-1-0" }], team: { id: "1", abbreviation: "BOS", displayName: "Boston Bruins" } },
          { homeAway: "home", score: "3", record: [{ type: "total", summary: "2-0-1" }], team: { id: "19", abbreviation: "STL", displayName: "St. Louis Blues" } },
        ],
      },
    ],
  },
});
nhlCard.standings = tablesFromStandings(
  "nhl",
  {
    name: "National Hockey League",
    children: [
      {
        name: "Eastern Conference",
        children: [
          {
            name: "Atlantic Division",
            standings: {
              entries: [
                { team: { id: "1", abbreviation: "BOS" }, stats: [{ name: "wins", displayValue: "2" }, { name: "losses", displayValue: "1" }, { name: "otLosses", displayValue: "0" }, { name: "points", displayValue: "4" }] },
              ],
            },
          },
        ],
      },
      {
        name: "Western Conference",
        children: [
          {
            name: "Central Division",
            standings: {
              entries: [
                { team: { id: "19", abbreviation: "STL" }, stats: [{ name: "wins", displayValue: "2" }, { name: "losses", displayValue: "0" }, { name: "otLosses", displayValue: "1" }, { name: "points", displayValue: "5" }] },
              ],
            },
          },
        ],
      },
    ],
  },
  nhlCard.away,
  nhlCard.home,
);
assert.equal(nhlCard.winProbability.length, 0);
assert.equal(nhlCard.standings.length, 2);
const nhlCaption = finalCaption(nhlCard);
assert.match(nhlCaption, /^FINAL · NHL\nSt\. Louis Blues beat Boston Bruins 3-2\./);
assert.match(nhlCaption, /St\. Louis Blues move to 2-0-1, Boston Bruins fall to 2-1-0\./);
assert.doesNotMatch(nhlCaption, /Open game:|Odds:|skaters:/i);
const mlbCaption = finalCaption(
  cardFromSummary("mlb", "401581234", {
    header: {
      competitions: [
        {
          status: { type: { state: "post", completed: true, shortDetail: "Final" } },
          competitors: [
            { homeAway: "away", score: "3", record: [{ type: "total", summary: "83-79" }], team: { id: "16", abbreviation: "CHC", displayName: "Chicago Cubs" } },
            { homeAway: "home", score: "5", record: [{ type: "total", summary: "78-84" }], team: { id: "24", abbreviation: "STL", displayName: "St. Louis Cardinals" } },
          ],
        },
      ],
    },
    boxscore: {
      players: [
        {
          team: { abbreviation: "STL" },
          statistics: [
            {
              name: "batting",
              labels: ["H", "HR", "RBI"],
              athletes: [{ athlete: { displayName: "Nolan Arenado" }, stats: ["3", "1", "2"] }],
            },
          ],
        },
      ],
    },
  }),
);
assert.match(mlbCaption, /^FINAL · MLB\nSt\. Louis Cardinals defeat Chicago Cubs 5-3\./);
assert.match(mlbCaption, /St\. Louis Cardinals move to 78-84, Chicago Cubs fall to 83-79\./);
assert.match(mlbCaption, /Nolan Arenado hit a home run\./);
const nhlSvg = renderFinalSvg(nhlCard);
assert.doesNotMatch(nhlSvg, /Win probability/);
assert.match(nhlSvg, /Standings/);
assert.match(nhlSvg, /Atlantic/);
assert.match(nhlSvg, /Central/);
assert.match(nhlSvg, />2-1-0</);
assert.match(nhlSvg, /PTS/);
assert.match(nhlSvg, />4</);
assert.match(nhlSvg, />5</);
assert.match(nhlSvg, / CT</);

assert.deepEqual(parseDetails("GB -2.5"), { abbrev: "GB", line: -2.5 });
assert.equal(spreadOutcome(-2.5, 17, 14), "covered");
assert.equal(spreadOutcome(-3, 20, 17), "push");
assert.equal(spreadOutcome(-2.5, 24, 27), "not covered");
assert.equal(formatFinalsTimestamp("2026-10-04T17:00Z"), "Sun, Oct 4, 12:00 PM CT");

const covered = oddsFromSummary(
  {
    pickcenter: [
      {
        details: "GB -2.5",
        awayTeamOdds: { favorite: true, moneyLine: -148 },
        homeTeamOdds: { favorite: false, moneyLine: 124 },
        pointSpread: { away: { close: { line: "-2.5" } }, home: { close: { line: "+2.5" } } },
      },
    ],
  },
  { abbrev: "GB", score: 17 },
  { abbrev: "TB", score: 14 },
  true,
);
assert.equal(covered?.spreadResult, "covered");
assert.equal(covered?.underdogWon, false);
assert.match(covered?.graphicLine ?? "", /GB -2\.5 covered/);

const upset = oddsFromSummary(
  {
    pickcenter: [
      {
        details: "KC -7.5",
        awayTeamOdds: { favorite: true, moneyLine: -320 },
        homeTeamOdds: { favorite: false, moneyLine: 260 },
        pointSpread: { away: { close: { line: "-7.5" } }, home: { close: { line: "+7.5" } } },
      },
    ],
  },
  { abbrev: "KC", score: 14 },
  { abbrev: "LV", score: 21 },
  true,
);
assert.equal(upset?.noteworthyUpset, true);
assert.match(upset?.upsetLine ?? "", /Upset: LV \+260 beat KC/);

assert.equal(
  oddsFromSummary({}, { abbrev: "GB", score: 17 }, { abbrev: "TB", score: 14 }, true),
  null,
);

const missingOddsSvg = renderFinalSvg(quiet);
assert.doesNotMatch(missingOddsSvg, /covered|did not cover|O\/U/);
assert.match(missingOddsSvg, / CT</);

assert.equal(
  formatPlayoffSeriesLine({
    playoff: true,
    summary: "MIL lead series 2-0",
    gameNumber: 2,
    totalGames: 5,
  }),
  "MIL leads series 2-0 · Game 2 of 5",
);
assert.equal(
  formatPlayoffSeriesLine({ playoff: false, summary: "VGK leads series 1-0" }),
  null,
  "regular-season series is not a playoff line",
);
assert.equal(formatBestOf(5), "Best of 5");
assert.equal(formatBestOf(7), "Best of 7");
assert.equal(formatBestOf(2), null);

const mlbPlayoff = cardFromSummary("mlb", "401908003", {
  header: {
    id: "401908003",
    season: { year: 2026, type: 3 },
    competitions: [
      {
        status: { type: { state: "post", completed: true, shortDetail: "Final" } },
        date: "2026-10-05T00:00Z",
        venue: { fullName: "American Family Field" },
        notes: [{ headline: "NLDS - Game 2" }],
        competitors: [
          {
            homeAway: "away",
            score: "3",
            record: [{ type: "total", summary: "91-71" }],
            linescores: Array.from({ length: 9 }, (_, i) => ({ value: i === 0 || i === 4 || i === 6 ? 1 : 0 })),
            hits: 5,
            errors: 2,
            team: {
              id: "25",
              abbreviation: "SD",
              displayName: "San Diego Padres",
              color: "2f241d",
              alternateColor: "ffc425",
              logos: [
                { href: "https://a.espncdn.com/i/teamlogos/mlb/500/sd.png", rel: ["full", "default"] },
                { href: "https://a.espncdn.com/i/teamlogos/mlb/500-dark/sd.png", rel: ["full", "dark"] },
              ],
            },
          },
          {
            homeAway: "home",
            score: "4",
            record: [{ type: "total", summary: "103-59" }],
            linescores: Array.from({ length: 9 }, (_, i) => ({ value: i === 6 || i === 8 ? (i === 8 ? 2 : 1) : 0 })),
            hits: 5,
            errors: 3,
            team: { id: "8", abbreviation: "MIL", displayName: "Milwaukee Brewers", color: "0a2351", alternateColor: "b6922e" },
          },
        ],
      },
    ],
  },
  seasonseries: [
    {
      type: "playoff",
      title: "Playoff Series",
      summary: "MIL leads series 2-0",
      totalCompetitions: 5,
      events: [
        {
          id: "401908002",
          date: "2026-10-04T00:30:00Z",
          status: "post",
          statusType: { state: "post", completed: true },
          competitors: [
            { homeAway: "away", score: "2", winner: false, team: { abbreviation: "SD" } },
            { homeAway: "home", score: "3", winner: true, team: { abbreviation: "MIL" } },
          ],
        },
        {
          id: "401908003",
          date: "2026-10-04T20:00:00Z",
          status: "post",
          statusType: { state: "post", completed: true },
          competitors: [
            { homeAway: "away", score: "3", winner: false, team: { abbreviation: "SD" } },
            { homeAway: "home", score: "4", winner: true, team: { abbreviation: "MIL" } },
          ],
        },
        {
          id: "401908004",
          date: "2026-10-07T01:30:00Z",
          status: "pre",
          statusType: { state: "pre", completed: false },
          competitors: [
            { homeAway: "away", team: { abbreviation: "MIL" } },
            { homeAway: "home", team: { abbreviation: "SD" } },
          ],
        },
        {
          id: "401908005",
          date: "2026-10-08T02:00:00Z",
          status: "pre",
          statusType: { state: "pre", completed: false },
          competitors: [
            { homeAway: "away", team: { abbreviation: "MIL" } },
            { homeAway: "home", team: { abbreviation: "SD" } },
          ],
        },
        {
          id: "401908006",
          date: "2026-10-09T20:30:00Z",
          status: "pre",
          statusType: { state: "pre", completed: false },
          competitors: [
            { homeAway: "away", team: { abbreviation: "SD" } },
            { homeAway: "home", team: { abbreviation: "MIL" } },
          ],
        },
      ],
    },
    { type: "season", summary: "SD wins series 4-2" },
  ],
  boxscore: {
    players: [
      {
        team: { abbreviation: "SD" },
        statistics: [
          {
            type: "batting",
            labels: ["AB", "R", "H", "RBI", "HR", "BB", "K"],
            athletes: [
              { starter: true, athlete: { shortName: "F. Tatis Jr.", position: { abbreviation: "RF" } }, stats: ["5", "1", "0", "0", "0", "0", "1"] },
              { starter: true, athlete: { shortName: "M. Machado", position: { abbreviation: "3B" } }, stats: ["4", "0", "1", "1", "0", "0", "1"] },
            ],
          },
          {
            type: "pitching",
            labels: ["IP", "H", "R", "ER", "BB", "K"],
            athletes: [{ starter: true, athlete: { shortName: "M. King" }, stats: ["5.0", "3", "1", "1", "0", "6"] }],
          },
        ],
      },
      {
        team: { abbreviation: "MIL" },
        statistics: [
          {
            type: "batting",
            labels: ["AB", "R", "H", "RBI", "HR", "BB", "K"],
            athletes: [
              { starter: true, athlete: { shortName: "J. Chourio", position: { abbreviation: "CF" } }, stats: ["4", "0", "1", "2", "0", "0", "0"] },
            ],
          },
          {
            type: "pitching",
            labels: ["IP", "H", "R", "ER", "BB", "K"],
            athletes: [{ starter: true, athlete: { shortName: "L. Henderson" }, stats: ["5.0", "2", "2", "1", "3", "4"] }],
          },
        ],
      },
    ],
  },
  plays: [
    { id: "t1", period: { number: 1, type: "Top" } },
    { id: "b3", period: { number: 3, type: "Bottom" } },
    { id: "t9", period: { number: 9, type: "Top" } },
    { id: "b9", period: { number: 9, type: "Bottom" } },
  ],
  winprobability: [
    { homeWinPercentage: 0.67, playId: "t1" },
    { homeWinPercentage: 0.51, playId: "b3" },
    { homeWinPercentage: 0.44, playId: "t9" },
    { homeWinPercentage: 1, playId: "b9" },
  ],
});
assert.equal(mlbPlayoff.playoff, true);
assert.match(mlbPlayoff.seriesLine ?? "", /MIL leads series 2-0 · Game 2 of 5/);
assert.equal(mlbPlayoff.seriesStanding, "MIL leads series 2-0");
assert.equal(mlbPlayoff.seriesBestOf, "Best of 5");
assert.equal(mlbPlayoff.seriesGameLabel, "Game 2 of 5");
assert.ok(mlbPlayoff.mlbBox?.batting.home.rows.length);
assert.equal(mlbPlayoffFromSummary("mlb", { header: { season: { type: 3 } }, seasonseries: [{ type: "playoff", summary: "MIL leads series 2-0", totalCompetitions: 5 }] }, {}).playoff, true);
{
  const mixed = mlbPlayoffFromSummary(
    "mlb",
    {
      header: { id: "401908003", season: { type: 3 } },
      seasonseries: [
        {
          type: "playoff",
          events: [
            {
              id: "401908002",
              date: "2026-10-04T00:30:00Z",
              status: "post",
              statusType: { completed: true, state: "post" },
              competitors: [
                { homeAway: "away", score: "2", winner: false, team: { abbreviation: "SD" } },
                { homeAway: "home", score: "3", winner: true, team: { abbreviation: "MIL" } },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "401908003",
      series: [{ type: "playoff", events: [{ id: "401908002", $ref: "http://stub" }] }],
    },
  );
  assert.equal(mixed.seriesGames[0]?.winnerAbbrev, "MIL");
  assert.equal(mixed.seriesGames[0]?.awayScore, 2);
}
mlbPlayoff.standings = tablesFromStandings(
  "mlb",
  {
    children: [
      {
        name: "NL Central",
        standings: {
          entries: [{ team: { id: "8", abbreviation: "MIL" }, stats: [{ name: "overall", displayValue: "103-59" }] }],
        },
      },
    ],
  },
  mlbPlayoff.away,
  mlbPlayoff.home,
);
const mlbPlayoffCaption = finalCaption(mlbPlayoff);
assert.match(mlbPlayoffCaption, /Milwaukee Brewers defeat San Diego Padres 4-3/);
assert.match(mlbPlayoffCaption, /MIL leads series 2-0/);
assert.doesNotMatch(mlbPlayoffCaption, /103-59|91-71|move to/);
const mlbPlayoffSvg = renderFinalSvg(mlbPlayoff);
assert.match(mlbPlayoffSvg, /MIL leads series 2-0/);
assert.match(mlbPlayoffSvg, /Box score/);
assert.match(mlbPlayoffSvg, /J\. Chourio|F\. Tatis Jr\./);
assert.match(mlbPlayoffSvg, /L\. Henderson|M\. King/);
assert.doesNotMatch(mlbPlayoffSvg, /Standings|NL Central/);
assert.match(mlbPlayoffSvg, /Win probability/);
assert.doesNotMatch(mlbPlayoffSvg, />Q1<|>Q2<|>Q3<|>Q4</);
assert.match(mlbPlayoffSvg, /Key performers/);
assert.match(mlbPlayoffSvg, /Best of 5/);
assert.match(mlbPlayoffSvg, /Game 2 of 5/);
assert.match(mlbPlayoffSvg, />Series · Best of 5</);
assert.match(mlbPlayoffSvg, />G1</);
assert.match(mlbPlayoffSvg, />G3</);
assert.match(mlbPlayoffSvg, /MIL 3–2|MIL 4–3/);
{
  const boxY = Number(/y="(\d+(?:\.\d+)?)"[^>]*>Box score</.exec(mlbPlayoffSvg)?.[1] ?? 0);
  const seriesY = Number(/y="(\d+(?:\.\d+)?)"[^>]*>Series · Best of 5</.exec(mlbPlayoffSvg)?.[1] ?? 0);
  assert.ok(boxY > 0 && seriesY > boxY, `series slate should sit under the box (box y=${boxY}, series y=${seriesY})`);
}
assert.doesNotMatch(mlbPlayoffSvg, /logoHalo|<ellipse/);
assert.equal(mlbPlayoff.seriesGames.length, 5);
assert.equal(mlbPlayoff.seriesGames[1]?.current, true);
assert.doesNotMatch(mlbPlayoffSvg, />103-59<|>91-71</);
assert.match(mlbPlayoffSvg, new RegExp(`width="${FINALS_ALERT_WIDTH}"`));
const mlbH = Number(/<svg [^>]*height="(\d+(?:\.\d+)?)"/.exec(mlbPlayoffSvg)?.[1] ?? 0);
assert.ok(mlbH > 700 && mlbH <= FINALS_ALERT_TARGET_HEIGHT + 400, `MLB playoff card height ${mlbH}`);
assert.equal(mlbPlayoff.winProbability.length, 4);
assert.ok(mlbPlayoff.winProbability[0]!.elapsedSec < 2, "first MLB WP point sits in the first inning");
assert.ok(mlbPlayoff.winProbability.at(-1)!.elapsedSec > 16, "last MLB WP point sits in the ninth");
assert.match(mlbPlayoff.away.logoUrl ?? "", /500-dark\/sd/);
assert.equal(mlbPlayoff.away.hits, 5);
assert.equal(mlbPlayoff.home.errors, 3);
assert.ok(pickMlbPerformers(mlbPlayoff.mlbBox!).length >= 2);

const stars = mapThreeStars([
  { star: 1, playerId: 1, teamAbbrev: "VGK", name: { default: "M. Marner" }, position: "R", goals: 1, assists: 0, points: 1, headshot: "https://example.com/a.png" },
  { star: 3, playerId: 3, teamAbbrev: "VAN", name: { default: "E. Pettersson" }, position: "C", goals: 0, assists: 1, points: 1 },
  { star: 2, playerId: 2, teamAbbrev: "VGK", name: { default: "V. Olofsson" }, position: "L", goals: 1, assists: 0, points: 1 },
]);
assert.deepEqual(stars.map((s) => s.star), [1, 2, 3]);
nhlCard.threeStars = starsFromLanding(stars);
nhlCard.goalies = [
  { name: "A. Hill", teamAbbrev: "VGK", line: "18/20 SV · 2 GA", photoUrl: null, photoData: null },
  { name: "K. Lankinen", teamAbbrev: "VAN", line: "25/28 SV · 3 GA", photoUrl: null, photoData: null },
];
const nhlStarsSvg = renderFinalSvg(nhlCard);
assert.match(nhlStarsSvg, /Three Stars/);
assert.match(nhlStarsSvg, /1ST STAR/);
assert.match(nhlStarsSvg, /2ND STAR/);
assert.match(nhlStarsSvg, /3RD STAR/);
assert.match(nhlStarsSvg, /NHL official/);
assert.match(nhlStarsSvg, /M\. Marner/);
assert.match(nhlStarsSvg, /Goalies/);
assert.match(nhlStarsSvg, /A\. Hill/);
assert.doesNotMatch(nhlStarsSvg, /Box leaders/);
assert.doesNotMatch(nhlStarsSvg, /Win probability/);
assert.doesNotMatch(nhlStarsSvg, /<ellipse/);
assert.equal(nhlCard.winProbability.length, 0, "ESPN/NHL.com still ship no hockey WP series");

nhlCard.stats = [
  { label: "Shots", away: "28", home: "31", awayLeads: false, homeLeads: true, awayShare: 47 },
];
nhlCard.away.logoData = "data:image/png;base64,aaa";
nhlCard.home.logoData = "data:image/png;base64,bbb";
const logoSvg = renderFinalSvg(nhlCard);
assert.match(logoSvg, /Team stats/);
assert.match(logoSvg, /data:image\/png;base64,aaa/);
assert.match(logoSvg, /data:image\/png;base64,bbb/);

console.log("sports-finals.test.ts ok");
