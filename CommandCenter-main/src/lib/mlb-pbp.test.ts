/**
 * Run with: node --experimental-strip-types src/lib/mlb-pbp.test.ts
 * from CommandCenter-main/.
 */
import {
  clampFieldPoint,
  FIELD_HOME,
  flightArcHeight,
  formatHeatValue,
  heatZoneGrid,
  mapLiveFeedToPbp,
  mapPlayHit,
  mapPlayPitches,
  mapSprayToField,
  pitchCallKind,
  pitchChipKind,
  pitchTypeLabel,
  playHeadline,
  resolvePbpView,
  shouldRenderPbpFieldMap,
  shortPbpName,
  sprayToFeet,
  type MlbHeatZoneCell,
  type MlbLiveFeedRaw,
  type MlbPbpPlay,
  type MlbPbpState,
} from "./mlb-pbp.ts";

const assert = {
  equal(actual: unknown, expected: unknown, msg?: string) {
    if (actual !== expected) {
      throw new Error(`${msg ?? "assert.equal"}: expected ${String(expected)}, got ${String(actual)}`);
    }
  },
  ok(cond: unknown, message: string) {
    if (!cond) throw new Error(message);
  },
  approx(actual: number, expected: number, tol: number, msg: string) {
    if (Math.abs(actual - expected) > tol) {
      throw new Error(`${msg}: expected ~${expected} ±${tol}, got ${actual}`);
    }
  },
};

assert.equal(shortPbpName("Cody Bellinger"), "C. Bellinger");
assert.equal(shortPbpName("Jazz Chisholm Jr."), "J. Chisholm Jr.");

const foul: Parameters<typeof pitchCallKind>[0] = {
  isPitch: true,
  details: { call: { code: "F", description: "Foul" }, isStrike: true, type: { code: "FF" } },
};
assert.equal(pitchCallKind(foul), "S");
assert.equal(pitchCallKind({ details: { isBall: true } }), "B");
assert.equal(pitchCallKind({ details: { isInPlay: true, call: { code: "X" } } }), "X");

const play = {
  playEvents: [
    {
      isPitch: true,
      pitchNumber: 1,
      details: {
        call: { code: "B", description: "Ball" },
        isBall: true,
        type: { code: "SI", description: "Sinker" },
      },
      pitchData: { startSpeed: 94.2, coordinates: { pX: -0.4, pZ: 2.1 } },
    },
    {
      isPitch: true,
      pitchNumber: 2,
      details: {
        call: { code: "X", description: "In play, out(s)" },
        isInPlay: true,
        type: { code: "FF", description: "Four-Seam Fastball" },
      },
      pitchData: { startSpeed: 96.9 },
      hitData: {
        launchSpeed: 81.4,
        launchAngle: 62,
        totalDistance: 167,
        trajectory: "popup",
        coordinates: { coordX: 143.69, coordY: 137.18 },
      },
    },
  ],
};
const pitches = mapPlayPitches(play);
assert.equal(pitches.length, 2);
assert.equal(pitches[0]!.call, "B");
assert.equal(pitches[1]!.call, "X");
assert.equal(pitchTypeLabel(pitches[1]!), "FOUR-SEAM FB");
assert.equal(pitchChipKind("X"), "inplay");
assert.equal(pitchChipKind("B"), "ball");

const hit = mapPlayHit(play);
assert.ok(hit, "in-play event should yield hit coords");
assert.approx(hit!.coordX, 143.69, 0.01, "coordX");
assert.equal(hit!.trajectory, "popup");

// Spray: home near origin feet; CF has +Y; LF −X; RF +X.
const homeFt = sprayToFeet(126.31, 202.94);
assert.approx(homeFt.x, 0, 8, "home X near plate");
assert.approx(homeFt.y, 0, 16, "home Y near plate");

const lf = mapSprayToField(56.81, 82.33); // 336 ft LF fly
const rf = mapSprayToField(203.66, 70.11); // 372 ft RF HR
const cf = mapSprayToField(109.46, 82.65);
assert.ok(lf.x < FIELD_HOME.x, "LF landing is left of home");
assert.ok(rf.x > FIELD_HOME.x, "RF landing is right of home");
assert.ok(cf.y < FIELD_HOME.y - 40, "CF landing is toward the outfield");
assert.ok(lf.y < FIELD_HOME.y, "LF is not behind the plate");

const clamped = clampFieldPoint({ x: -40, y: 900 });
assert.ok(clamped.x >= 18 && clamped.y <= 300, "field points stay on the diamond");

assert.ok(flightArcHeight({ coordX: 0, coordY: 0, launchSpeed: 80, launchAngle: 70, totalDistance: 100, trajectory: "popup" }) >
  flightArcHeight({ coordX: 0, coordY: 0, launchSpeed: 90, launchAngle: -10, totalDistance: 10, trajectory: "ground_ball" }),
  "popup arcs higher than a grounder");

const zones: MlbHeatZoneCell[] = [
  { zone: "05", value: ".540", temp: "hot" },
  { zone: "1", value: ".059", temp: "cold" },
];
const grid = heatZoneGrid(zones);
assert.equal(grid.length, 9);
assert.equal(grid[0]!.zone, "01");
assert.equal(grid[0]!.value, ".059");
assert.equal(grid[4]!.value, ".540");
assert.equal(grid[8]!.value, "—");
assert.equal(formatHeatValue(".540"), ".540");
assert.equal(formatHeatValue("0.222"), ".222");
assert.equal(formatHeatValue(""), "—");

const feed: MlbLiveFeedRaw = {
  gamePk: 849839,
  gameData: {
    status: { detailedState: "In Progress", abstractGameState: "Live" },
    teams: {
      away: { id: 147, name: "Yankees", abbreviation: "NYY" },
      home: { id: 139, name: "Rays", abbreviation: "TB" },
    },
  },
  liveData: {
    linescore: {
      currentInningOrdinal: "5th",
      inningState: "Top",
      balls: 0,
      strikes: 1,
      outs: 2,
      innings: [
        { num: 1, away: { runs: 0 }, home: { runs: 1 } },
        { num: 4, away: { runs: 1 }, home: { runs: 0 } },
      ],
      teams: {
        away: { runs: 1, hits: 2, errors: 3 },
        home: { runs: 1, hits: 4, errors: 0 },
      },
      offense: {
        first: { id: 1, fullName: "Ben Rice" },
        second: null,
        third: { id: 2, fullName: "Austin Wells" },
      },
    },
    plays: {
      allPlays: [
        {
          about: { atBatIndex: 37, inning: 5, halfInning: "top", isComplete: true },
          result: {
            event: "Pop Out",
            eventType: "pop_out",
            description: "George Lombard Jr. pops out to second baseman.",
          },
          count: { balls: 0, strikes: 0, outs: 2 },
          matchup: { batter: { id: 9, fullName: "George Lombard Jr." } },
          playEvents: [
            {
              isPitch: true,
              pitchNumber: 1,
              details: { isInPlay: true, call: { code: "X", description: "In play, out(s)" }, type: { code: "FF" } },
              hitData: {
                trajectory: "popup",
                coordinates: { coordX: 143.69, coordY: 137.18 },
              },
            },
          ],
        },
        {
          about: { atBatIndex: 38, inning: 5, halfInning: "top", isComplete: false },
          result: {},
          count: { balls: 0, strikes: 1, outs: 2 },
          matchup: {
            batter: { id: 641355, fullName: "Cody Bellinger" },
            pitcher: { id: 5, fullName: "Cam Booser" },
            batSide: { code: "L" },
          },
          playEvents: [
            {
              isPitch: true,
              pitchNumber: 1,
              details: { isStrike: true, call: { code: "F", description: "Foul" }, type: { code: "FF" } },
              pitchData: { startSpeed: 96.9, coordinates: { pX: 0.16, pZ: 3.8 } },
            },
          ],
        },
      ],
      currentPlay: {
        about: { atBatIndex: 38, inning: 5, halfInning: "top", isComplete: false },
        result: {},
        count: { balls: 0, strikes: 1, outs: 2 },
        matchup: {
          batter: { id: 641355, fullName: "Cody Bellinger" },
          pitcher: { id: 5, fullName: "Cam Booser" },
          batSide: { code: "L" },
        },
        playEvents: [
          {
            isPitch: true,
            pitchNumber: 1,
            details: { isStrike: true, call: { code: "F", description: "Foul" }, type: { code: "FF" } },
            pitchData: { startSpeed: 96.9, coordinates: { pX: 0.16, pZ: 3.8 } },
          },
        ],
      },
    },
  },
};

const state = mapLiveFeedToPbp(feed);
assert.ok(state, "maps a live feed");
assert.equal(state!.live, true);
assert.equal(state!.away.abbrev, "NYY");
assert.equal(state!.current?.batter?.id, 641355);
assert.equal(state!.current?.batSide, "L");
assert.equal(state!.lastComplete?.event, "Pop Out");
assert.ok(state!.lastComplete?.hit, "completed popup keeps spray coords");
assert.equal(state!.runners.length, 2);
assert.equal(state!.runners[0]!.base, 1);
assert.equal(resolvePbpView(state), "batter", "pitches in current PA → batter view");
assert.equal(playHeadline(state!.current, "batter"), "NOW AT BAT");
assert.equal(playHeadline(state!.lastComplete, "play"), "Pop Out");

const betweenPitches: MlbPbpState = {
  ...state!,
  current: {
    ...(state!.current as MlbPbpPlay),
    pitches: [],
    isComplete: false,
  },
};
assert.equal(resolvePbpView(betweenPitches), "play", "0-pitch new PA still shows last play");
assert.equal(resolvePbpView(betweenPitches, "batter"), "batter", "explicit prefer wins");
assert.equal(shouldRenderPbpFieldMap(state!.lastComplete), false, "hide untrusted LAST PLAY map");

console.log("mlb-pbp: ok");
