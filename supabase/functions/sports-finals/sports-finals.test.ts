/**
 * Run with:
 *   node --experimental-strip-types supabase/functions/sports-finals/sports-finals.test.ts
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { cardFromSummary, finalCaption, statMagnitude } from "./card.ts";
import {
  DEFAULT_FINALS_CHAT_ID,
  parseChatIds,
  parseFavoriteTokens,
  parseScope,
  parseSports,
  shouldSendFinal,
} from "./select.ts";
import { FINALS_ALERT_WIDTH, paintColor, renderFinalSvg } from "./svg.ts";
import { mapCfbWinProbability as edgeMap } from "./win-probability.ts";

const appModuleUrl = [
  new URL("../../../CommandCenter-main/src/lib/cfb-win-probability.ts", import.meta.url),
  new URL("../../../src/lib/cfb-win-probability.ts", import.meta.url),
].find((url) => existsSync(fileURLToPath(url)));
if (!appModuleUrl) throw new Error("game-page win-probability module not found");
const { mapCfbWinProbability: appMap } = await import(appModuleUrl.href);

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

assert.deepEqual(parseScope(undefined), { favorites: true, ruwt: true, all: false });
assert.deepEqual(parseScope("all"), { favorites: false, ruwt: false, all: true });
assert.deepEqual(parseScope("favorites"), { favorites: true, ruwt: false, all: false });
assert.deepEqual(parseSports(undefined), ["nfl", "cfb"]);
assert.deepEqual(parseSports("nhl,soccer,mlb"), ["nhl", "mlb"]);
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

assert.equal(statMagnitude("3rd down efficiency", "4-13"), 4 / 13);
assert.equal(statMagnitude("Possession", "31:11"), 31 * 60 + 11);

const card = cardFromSummary("nfl", "401872964", {
  header: {
    competitions: [
      {
        status: { type: { state: "post", completed: true, shortDetail: "Final" } },
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
assert.equal(
  finalCaption(card, "https://command-center-flax-gamma.vercel.app/"),
  "Final\nOpen game: https://command-center-flax-gamma.vercel.app/sports/nfl/game/401872964?solo=1",
);

assert.equal(paintColor("000000", "ffb612"), "#ffb612");
assert.equal(paintColor("472a08", "ff3c00"), "#ff3c00");
assert.equal(paintColor("ba0c2f", "a8adb4"), "#ba0c2f");
assert.ok(Math.abs((card.stats.find((stat) => stat.label === "Turnovers")?.awayShare ?? 0) - 200 / 3) < 0.01);

const svg = renderFinalSvg(card);
assert.match(svg, />24</);
assert.match(svg, />27</);
assert.match(svg, /Win probability/);
assert.match(svg, /Team stats/);
assert.match(svg, /Box leaders/);
assert.match(svg, /Aaron Rodgers/);
assert.match(svg, /Total Yards/);
assert.match(svg, /Huntington Bank Field/);
assert.doesNotMatch(svg, /Last play|yard line|Field map|chains/i);
assert.equal((svg.match(/<image /g) ?? []).length, 0);
assert.match(svg, new RegExp(`width="${FINALS_ALERT_WIDTH}"`));
const fullHeight = Number(/<svg [^>]*height="(\d+(?:\.\d+)?)"/.exec(svg)?.[1] ?? 0);
assert.ok(fullHeight > 700 && fullHeight <= 1550, `Telegram card should stay near heat-alert height, got ${fullHeight}`);

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
assert.match(quietSvg, /#4 Georgia Bulldogs|#4 UGA/);

console.log("sports-finals.test.ts ok");
