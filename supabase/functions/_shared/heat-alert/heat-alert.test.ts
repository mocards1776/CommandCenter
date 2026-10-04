import assert from "node:assert/strict";
import { test } from "node:test";
import { clockParts, isBreakStatus } from "./clock.ts";
import { heatAlertCaption, situationLine } from "./copy.ts";
import { fieldBallPct, footballMarks, layoutPlayDots, spotIsRedZone } from "./field.ts";
import { renderHeatAlertSvg } from "./svg.ts";
import { parseChatAllowlist, resolveChatTargets } from "./telegram.ts";
import type { HeatAlertCard } from "./types.ts";

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
    color: "#003b75",
    logoHref: null,
  },
  home: {
    id: "28",
    abbrev: "WSH",
    name: "Commanders",
    score: 6,
    color: "#5a1414",
    logoHref: null,
  },
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
  gamePath: "/sports/nfl/game/401872965?solo=1",
};

test("situation line is the down and the ball, not the heat reason", () => {
  assert.equal(situationLine(sample), "1st & 10 at WSH 40  ·  WSH ball");
});

test("caption keeps RUWT copy and adds the open-game link", () => {
  const caption = heatAlertCaption("One-score game", "https://example.test/sports/nfl/game/1?solo=1");
  assert.match(caption, /^One-score game\nOpen game: https:\/\/example\.test\/sports\/nfl\/game\/1/);
  assert.equal(heatAlertCaption("  ", "https://example.test/g"), "Open game: https://example.test/g");
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

test("portrait svg carries the scoreboard and the field, not a photo", () => {
  const svg = renderHeatAlertSvg(sample);
  assert.match(svg, /width="1080"/);
  assert.match(svg, /height="1300"/);
  assert.match(svg, />HEAT</);
  assert.match(svg, />NFL/);
  assert.match(svg, />2ND</);
  assert.match(svg, />2:00</);
  assert.match(svg, />IND</);
  assert.match(svg, />WSH</);
  assert.match(svg, /1st &amp; 10 at WSH 40/);
  assert.match(svg, /id="grass"/);
  assert.match(svg, /#ffe500/);
  assert.match(svg, /#2f9bff/);
  assert.match(svg, /<circle /);
  assert.doesNotMatch(svg, /unsplash|stock/i);
});
