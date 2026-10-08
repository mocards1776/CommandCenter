import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { plotCfbWinProbability as edgePlot } from "../win-probability.ts";
import { clockParts, isBreakStatus } from "./clock.ts";
import { formatHeatTimestamp, heatAlertCaption, situationLine } from "./copy.ts";
import { alertReplyMarkup } from "../telegram-markup.ts";
import { applyHeatSummary, heatStatMagnitude, pickHeatStats } from "./fetch-game.ts";
import { driveCapsuleSpan, fieldBallPct, footballMarks, layoutPlayDots, spotIsRedZone } from "./field.ts";
import { mlbHeroNest, mlbInningLabel, runnersShorthand } from "./mlb-hero.ts";
import { renderHeatAlertSvg } from "./svg.ts";
import { parseChatAllowlist, resolveChatTargets } from "./telegram.ts";
import type { HeatAlertCard } from "./types.ts";

const appModuleUrl = [
  new URL("../../../../CommandCenter-main/src/lib/cfb-win-probability.ts", import.meta.url),
  new URL("../../../../src/lib/cfb-win-probability.ts", import.meta.url),
].find((url) => existsSync(fileURLToPath(url)));
if (!appModuleUrl) throw new Error("game-page win-probability module not found");
const { plotCfbWinProbability: appPlot, mapCfbWinProbability: appMap } = await import(appModuleUrl.href);

test("yard line matches the app field map", () => {
  assert.equal(fieldBallPct(40), 60);
  assert.equal(fieldBallPct(0), 100);
  assert.equal(fieldBallPct(100), 0);
  assert.equal(fieldBallPct(null), null);
});

test("away offense's line to gain moves toward the home end zone", () => {
  const marks = footballMarks({
    yardLine: 40,
    possessionTeamId: "11",
    awayId: "11",
    homeId: "28",
    downDistanceText: "1st & 10 at WSH 40",
  });
  assert.equal(marks.ballPct, 60);
  assert.equal(marks.facingRight, true);
  assert.equal(marks.firstDownPct, 70);
  assert.equal(marks.awayHasBall, true);
  assert.equal(marks.capsule, null);
});

test("1st and 10 at the home 15 puts the sticks on the home 25", () => {
  const marks = footballMarks({
    yardLine: 15,
    possessionTeamId: "13",
    awayId: "12",
    homeId: "13",
    downDistanceText: "1st & 10 at LV 15",
    driveStartYardLine: 15,
  });
  assert.equal(marks.ballPct, 85);
  assert.equal(marks.facingLeft, true);
  assert.equal(marks.firstDownPct, 75);
  assert.equal(marks.driveStartPct, 85);
  assert.deepEqual(marks.capsule, { leftPct: 85, widthPct: 1.5 });
});

test("home offense's line to gain moves toward the away end zone", () => {
  const marks = footballMarks({
    yardLine: 34,
    possessionTeamId: "28",
    awayId: "11",
    homeId: "28",
    downDistanceText: "2nd & 7 at WSH 34",
    driveStartYardLine: 20,
  });
  assert.equal(marks.facingLeft, true);
  assert.equal(marks.firstDownPct, 59);
  assert.equal(marks.driveStartPct, 80);
  assert.deepEqual(marks.capsule, { leftPct: 66, widthPct: 14 });
});

test("capsule spans drive start to the LOS and keeps a short tail on a new drive", () => {
  const longDrive = driveCapsuleSpan(19, 60, false, true);
  assert.deepEqual(longDrive, { leftPct: 19, widthPct: 41 });
  const newDrive = driveCapsuleSpan(85, 85, false, true);
  assert.deepEqual(newDrive, { leftPct: 85, widthPct: 1.5 });
  const awayNew = driveCapsuleSpan(20, 20, true, false);
  assert.deepEqual(awayNew, { leftPct: 18.5, widthPct: 1.5 });
  assert.equal(driveCapsuleSpan(null, 50, true, false), null);
});

test("current-drive dots stack a goal-line cluster and skip a separate snap", () => {
  const stacked = layoutPlayDots([40, 40, 40]);
  assert.equal(stacked.length, 3);
  assert.equal(new Set(stacked.map((dot) => dot.pct)).size, 1);
  assert.notEqual(stacked[0]?.y, stacked[1]?.y);
  const apart = layoutPlayDots([20, 80]);
  assert.equal(apart.length, 2);
  assert.notEqual(apart[0]?.pct, apart[1]?.pct);
});

test("red zone follows the goal the offense is attacking", () => {
  assert.equal(spotIsRedZone(89, true, false), true);
  assert.equal(spotIsRedZone(15, false, true), true);
  assert.equal(spotIsRedZone(67, false, true), false);
  assert.equal(spotIsRedZone(50, true, false), false);
});

test("clock split matches the game-header nest", () => {
  assert.equal(clockParts("2:00 - 2nd").period, "2nd");
  assert.equal(clockParts("2:00 - 2nd").clock, "2:00");
  assert.equal(clockParts("Halftime").period, null);
  assert.equal(isBreakStatus("Halftime"), true);
  assert.equal(isBreakStatus("2:00 - 2nd"), false);
});

const sample: HeatAlertCard = {
  sport: "nfl",
  gameId: "401872965",
  live: true,
  final: false,
  detail: "2:00 - 2nd",
  when: null,
  away: {
    id: "11",
    abbrev: "IND",
    name: "Colts",
    score: 7,
    record: "3-0",
    linescores: [0, 7, null, null],
    color: "#003b75",
    alternateColor: "#ffffff",
    logoHref: null,
  },
  home: {
    id: "28",
    abbrev: "WSH",
    name: "Commanders",
    score: 6,
    record: "2-1",
    linescores: [3, 3, null, null],
    color: "#5a1414",
    alternateColor: "#ffb612",
    logoHref: null,
  },
  venue: "Northwest Stadium",
  date: "2026-10-04T17:00:00Z",
  periodLabels: ["Q1", "Q2", "Q3", "Q4"],
  football: {
    downDistanceText: "1st & 10 at WSH 40",
    yardLine: 40,
    possessionTeamId: "28",
    lastPlayText: "Two-Minute Warning",
    driveStartYardLine: 81,
    playYardLines: [55, 48],
    redZone: false,
  },
  ice: null,
  diamond: null,
  homeWinPct: 55.4,
  winProbability: [
    { playId: "a", homeWinPct: 48.2, tiePct: 0, elapsedSec: 0, period: 1 },
    { playId: "b", homeWinPct: 41.6, tiePct: 0, elapsedSec: 880, period: 1 },
    { playId: "c", homeWinPct: 55.4, tiePct: 0, elapsedSec: 1680, period: 2 },
  ],
  stats: [
    { label: "Yards", away: "188", home: "142", awayLeads: true, homeLeads: false, awayShare: 57 },
    { label: "Passing", away: "121", home: "98", awayLeads: true, homeLeads: false, awayShare: 55.3 },
    { label: "Rushing", away: "67", home: "44", awayLeads: true, homeLeads: false, awayShare: 60.4 },
    { label: "1st Downs", away: "9", home: "8", awayLeads: true, homeLeads: false, awayShare: 52.9 },
    { label: "3rd Down", away: "3/7", home: "2/6", awayLeads: true, homeLeads: false, awayShare: 56.2 },
    { label: "Turnovers", away: "0", home: "1", awayLeads: true, homeLeads: false, awayShare: 0 },
    { label: "Possession", away: "14:22", home: "15:38", awayLeads: false, homeLeads: true, awayShare: 47.9 },
  ],
  gamePath: "/sports/nfl/game/401872965?solo=1",
};

test("situation line is the down and the ball, not the heat reason", () => {
  assert.equal(situationLine(sample), "1st & 10 at WSH 40  ·  WSH ball");
});

test("caption keeps RUWT copy and leaves links off the text", () => {
  const caption = heatAlertCaption("One-score game");
  assert.equal(caption, "One-score game");
  assert.equal(heatAlertCaption("  "), "");
  assert.doesNotMatch(caption, /Open game|command-center|https:\/\//);
});

test("inline keyboard puts Open game and RUWT board on one Mini App row", () => {
  const markup = alertReplyMarkup(
    "https://command-center-flax-gamma.vercel.app/",
    "/sports/nfl/game/1?solo=1",
  );
  assert.ok(markup);
  const parsed = JSON.parse(markup!) as {
    inline_keyboard: { text: string; url?: string; web_app?: { url: string } }[][];
  };
  assert.equal(parsed.inline_keyboard.length, 1);
  assert.deepEqual(
    parsed.inline_keyboard[0]!.map((button) => button.text),
    ["Open game", "RUWT board"],
  );
  assert.equal(parsed.inline_keyboard[0]![0]!.url, undefined);
  assert.equal(
    parsed.inline_keyboard[0]![0]!.web_app?.url,
    "https://command-center-flax-gamma.vercel.app/sports/nfl/game/1?solo=1",
  );
  assert.equal(parsed.inline_keyboard[0]![1]!.url, undefined);
  assert.equal(
    parsed.inline_keyboard[0]![1]!.web_app?.url,
    "https://command-center-flax-gamma.vercel.app/sports/ruwt?solo=1",
  );
});

test("chat allowlist rejects ids that were not configured", () => {
  assert.deepEqual(parseChatAllowlist(" 42, -1005\n42 "), ["42", "-1005"]);
  assert.deepEqual(parseChatAllowlist("not-a-chat"), []);
  const open = resolveChatTargets(["42"], null);
  assert.equal(open.ok && open.ids[0], "42");
  const denied = resolveChatTargets(["42"], "99");
  assert.equal(denied.ok, false);
  const empty = resolveChatTargets([], null);
  assert.equal(empty.ok, false);
});

test("portrait svg matches the finals photo slot and score hierarchy", () => {
  const svg = renderHeatAlertSvg(sample);
  assert.match(svg, /width="1080"/);
  assert.match(svg, /height="1350"/);
  assert.match(svg, />HEAT</);
  assert.match(svg, />NFL/);
  assert.match(svg, />2ND</);
  assert.match(svg, />2:00</);
  assert.match(svg, />IND</);
  assert.match(svg, />WSH</);
  assert.match(svg, />3-0</);
  assert.match(svg, />Q1</);
  assert.match(svg, /1st &amp; 10 at WSH 40/);
  assert.match(svg, /id="grass"/);
  assert.match(svg, /#ffe500/);
  assert.match(svg, /id="driveCapsule"/);
  assert.match(svg, /id="losBall"/);
  assert.doesNotMatch(svg, /#2f9bff/);
  assert.doesNotMatch(svg, /r="7"/);
  assert.doesNotMatch(svg, /width="12" height="12" fill="#ffffff" transform="rotate/);
  assert.match(svg, /Northwest Stadium/);
  assert.match(svg, /CT</);
  assert.match(svg, /Win probability/);
  assert.match(svg, /id="wpHist"/);
  assert.match(svg, /stroke-dasharray="8 7"/);
  assert.match(svg, />Yards</);
  assert.match(svg, />Passing</);
  assert.match(svg, />3rd Down</);
  assert.match(svg, />Possession</);
  assert.match(svg, />Team stats</);
  assert.doesNotMatch(svg, /unsplash|stock/i);
  const grass = /id="grassClip"><rect[^>]+height="(\d+(?:\.\d+)?)"/.exec(svg);
  assert.ok(grass, "grass clip is present");
  assert.ok(Number(grass![1]) <= 180, `field grass should stay compact, got ${grass![1]}`);
  const clip = /id="wpHist"><rect[^>]+width="(\d+(?:\.\d+)?)"/.exec(svg);
  assert.ok(clip, "historical WP clip is present");
  assert.ok(Number(clip![1]) < 900, `live WP must not fill the future, clip ${clip![1]}`);
});

test("live WP plot matches the game-page clip and does not paint unused future", () => {
  const points = appMap(
    [
      { playId: "a", homeWinPercentage: 0.48 },
      { playId: "b", homeWinPercentage: 0.41 },
      { playId: "c", homeWinPercentage: 0.55 },
    ],
    [
      { id: "a", period: 1, clock: "15:00" },
      { id: "b", period: 1, clock: "0:20" },
      { id: "c", period: 2, clock: "2:00" },
    ],
  );
  const edge = edgePlot(points);
  const app = appPlot(points);
  assert.deepEqual(edge, app);
  assert.ok(edge?.future, "Q2 still has remaining regulation");
  assert.ok(edge && !edge.area.includes("L100 "), "home fill stops at the last play");
});

test("Apple-style stat pick prefers the compact football rows", () => {
  const rows = pickHeatStats("nfl", "KC", "LV", {
    boxscore: {
      teams: [
        {
          team: { abbreviation: "KC" },
          statistics: [
            { label: "Total Yards", displayValue: "301" },
            { label: "Passing", displayValue: "141" },
            { label: "Rushing", displayValue: "160" },
            { label: "1st Downs", displayValue: "13" },
            { label: "3rd down efficiency", displayValue: "4/10" },
            { label: "Turnovers", displayValue: "0" },
            { label: "Possession", displayValue: "20:21" },
            { label: "Total Plays", displayValue: "44" },
          ],
        },
        {
          team: { abbreviation: "LV" },
          statistics: [
            { label: "Total Yards", displayValue: "254" },
            { label: "Passing", displayValue: "211" },
            { label: "Rushing", displayValue: "43" },
            { label: "1st Downs", displayValue: "17" },
            { label: "3rd down efficiency", displayValue: "3/9" },
            { label: "Turnovers", displayValue: "0" },
            { label: "Possession", displayValue: "24:39" },
            { label: "Total Plays", displayValue: "49" },
          ],
        },
      ],
    },
  });
  assert.deepEqual(rows.map((row) => row.label), [
    "Yards",
    "Passing",
    "Rushing",
    "1st Downs",
    "3rd Down",
    "Turnovers",
    "Possession",
  ]);
  assert.equal(rows[0]?.away, "301");
  assert.equal(rows[0]?.home, "254");
  assert.equal(rows[0]?.awayLeads, true);
  assert.ok((rows[2]?.awayShare ?? 0) > 70, "rushing bar leans KC");
  assert.equal(heatStatMagnitude("Possession", "20:21"), 20 * 60 + 21);
});

test("summary applies the ESPN WP series and box score", () => {
  const next = applyHeatSummary(sample, {
    winprobability: [
      { playId: "p1", homeWinPercentage: 0.42, tiePercentage: 0 },
      { playId: "p2", homeWinPercentage: 0.61, tiePercentage: 0 },
    ],
    drives: {
      previous: [
        {
          plays: [
            { id: "p1", period: { number: 1 }, clock: { displayValue: "10:00" } },
            { id: "p2", period: { number: 2 }, clock: { displayValue: "8:00" } },
          ],
        },
      ],
    },
    boxscore: {
      teams: [
        { team: { abbreviation: "IND" }, statistics: [{ label: "Total Yards", displayValue: "210" }] },
        { team: { abbreviation: "WSH" }, statistics: [{ label: "Total Yards", displayValue: "180" }] },
      ],
    },
  });
  assert.equal(next.winProbability.length, 2);
  assert.equal(next.winProbability[1]?.homeWinPct, 61);
  assert.equal(next.homeWinPct, 61);
  assert.equal(next.stats[0]?.label, "Yards");
  assert.equal(next.stats[0]?.away, "210");
});

test("CT stamp matches the finals footer", () => {
  assert.equal(formatHeatTimestamp("2026-10-04T17:00Z"), "Sun, Oct 4, 12:00 PM CT");
});

const mlbLive: HeatAlertCard = {
  ...sample,
  sport: "mlb",
  gameId: "401696444",
  detail: "Top 4th",
  venue: "Progressive Field",
  periodLabels: ["1", "2", "3", "4"],
  football: null,
  diamond: {
    balls: 0,
    strikes: 2,
    outs: 0,
    onFirst: false,
    onSecond: false,
    onThird: false,
    batter: "Andrew Benintendi",
    pitcher: "Gavin Williams",
  },
  homeWinPct: 58.4,
  winProbability: [],
  stats: [{ label: "Hits", away: "4", home: "6", awayLeads: false, homeLeads: true, awayShare: 40 }],
  away: { ...sample.away, abbrev: "CHW", name: "White Sox", score: 1, record: "84-78", linescores: [0, 0, 0, 1], color: "#27251f" },
  home: { ...sample.home, abbrev: "CLE", name: "Guardians", score: 2, record: "85-77", linescores: [2, 0, 0, 0], color: "#00385d" },
  gamePath: "/sports/mlb/game/401696444?solo=1",
};

test("MLB nest uses count, outs, and runners instead of repeating the inning", () => {
  assert.equal(runnersShorthand({ balls: 0, strikes: 0, outs: 0, onFirst: true, onSecond: true, onThird: true }), "Loaded");
  assert.equal(runnersShorthand({ balls: 0, strikes: 0, outs: 0, onFirst: true, onSecond: false, onThird: true }), "Corners");
  assert.equal(runnersShorthand({ balls: 0, strikes: 0, outs: 0, onFirst: false, onSecond: true, onThird: false }), "2nd");
  const nest = mlbHeroNest({
    live: true,
    final: false,
    detail: "Top 4th",
    diamond: mlbLive.diamond,
    homeWinPct: 58.4,
    awayAbbrev: "CHW",
    homeAbbrev: "CLE",
  });
  assert.equal(nest.primary, "0-2");
  assert.equal(nest.secondary, "0 outs");
  assert.equal(nest.runners, "Empty");
  assert.equal(nest.winChip, "CLE 58.4%");
  assert.equal(nest.liveCount, true);
  assert.equal(situationLine(mlbLive), "Top 4th");
});

test("MLB heat SVG fills the score nest and drops the empty black plate", () => {
  const svg = renderHeatAlertSvg(mlbLive);
  assert.match(svg, />MLB/);
  assert.match(svg, />0-2</);
  assert.match(svg, />0 OUTS</);
  assert.match(svg, />EMPTY</);
  assert.match(svg, />CLE 58.4%</);
  assert.match(svg, />Top 4th</);
  assert.doesNotMatch(svg, /fill="#050505"/);
  assert.equal((svg.match(/>Top 4th</g) || []).length, 2, "inning on top of the nest and on the situation bar");
});

const appMlbUiUrl = [
  new URL("../../../../CommandCenter-main/src/lib/mlb-score-ui.ts", import.meta.url),
  new URL("../../../../src/lib/mlb-score-ui.ts", import.meta.url),
].find((url) => existsSync(fileURLToPath(url)));
if (!appMlbUiUrl) throw new Error("game-page mlb-score-ui module not found");
const { mlbInningLabel: appInningLabel } = await import(appMlbUiUrl.href);

test("MLB inning label wording matches the app hero", () => {
  const cases: Array<[string | null, string | null]> = [
    ["Top 3rd", "Top 3rd"],
    ["Bot 3rd", "Bottom 3rd"],
    ["Bottom 3rd", "Bottom 3rd"],
    ["Mid 3rd", "Mid 3rd"],
    ["Middle 3rd", "Mid 3rd"],
    ["Middle of 5th Inning", "Mid 5th"],
    ["End 3rd", "End 3rd"],
    ["End of the 7th", "End 7th"],
    ["Top of the 1st", "Top 1st"],
    ["Top 10th", "Top 10th"],
    ["Bot 11th", "Bottom 11th"],
    ["Top 12th", "Top 12th"],
    ["  top   2nd ", "Top 2nd"],
    ["Final", null],
    ["Final/10", null],
    ["Warmup", null],
    ["Delayed", null],
    ["7:05 PM ET", null],
    ["", null],
    [null, null],
  ];
  for (const [detail, want] of cases) {
    assert.equal(mlbInningLabel(detail), want, String(detail));
    assert.equal(mlbInningLabel(detail), appInningLabel(detail), `app parity: ${detail}`);
  }
});

function nestInning(svg: string, label: string): boolean {
  return svg.includes(`y="128" text-anchor="middle" fill="#f7f4ee" font-family="Libre Franklin" font-size="28" font-weight="700" letter-spacing="0.6">${label}</text>`);
}

test("MLB heat SVG puts the inning on top of the nest, above outs and count", () => {
  const top = renderHeatAlertSvg(mlbLive);
  assert.ok(nestInning(top, "Top 4th"));
  assert.ok(top.indexOf(">Top 4th<") < top.indexOf(">0 OUTS<"), "inning sits before the outs line");
  const bottom = renderHeatAlertSvg({ ...mlbLive, detail: "Bot 4th", diamond: { ...mlbLive.diamond!, outs: 1 } });
  assert.ok(nestInning(bottom, "Bottom 4th"));
  assert.match(bottom, />1 OUT</);
  assert.match(bottom, />Bot 4th</, "situation bar keeps the feed copy");
  assert.ok(nestInning(renderHeatAlertSvg({ ...mlbLive, detail: "Mid 4th" }), "Mid 4th"));
  assert.ok(nestInning(renderHeatAlertSvg({ ...mlbLive, detail: "Top 10th" }), "Top 10th"));
});

test("MLB heat SVG drops the inning line on finals, pregame, and break duplicates", () => {
  const final = renderHeatAlertSvg({ ...mlbLive, live: false, final: true, detail: "Final" });
  assert.doesNotMatch(final, /y="128"/);
  const pre = renderHeatAlertSvg({ ...mlbLive, live: false, final: false, detail: "Top 1st", when: "7:10 PM" });
  assert.doesNotMatch(pre, /y="128"/);
  const brk = renderHeatAlertSvg({ ...mlbLive, detail: "Middle 4th" });
  assert.doesNotMatch(brk, /y="128"/, "break slot already names the inning");
  assert.match(brk, /font-size="68" font-weight="700">Mid 4th</);
  assert.doesNotMatch(brk, /Barlow Condensed" font-size="\d+" font-weight="700">Middle 4th</);
});
