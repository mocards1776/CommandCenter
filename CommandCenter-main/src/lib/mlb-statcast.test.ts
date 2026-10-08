/**
 * Run with: node --experimental-strip-types src/lib/mlb-statcast.test.ts
 * from CommandCenter-main/.
 */
import {
  breakSide,
  formatOneDecimal,
  formatSpinRate,
  formatXba,
  hardnessLabel,
  mapLivePitches,
  mapLivePlay,
  mergeLivePitches,
  num,
  parseBattedBall,
  parsePitchStatcast,
  pitchRowStats,
  pitchTypeName,
  releasePoint,
  spinAxisClock,
  statcastHitChips,
  statcastPitchChips,
  trajectoryLabel,
  type MlbLivePitch,
  type RawLivePitchEvent,
} from "./mlb-statcast.ts";

const assert = {
  equal(actual: unknown, expected: unknown, msg?: string) {
    if (actual !== expected) {
      throw new Error(`${msg ?? "assert.equal"}: expected ${String(expected)}, got ${String(actual)}`);
    }
  },
  ok(v: unknown, msg?: string) {
    if (!v) throw new Error(msg ?? "assert.ok");
  },
  close(actual: number | null | undefined, expected: number, tol: number, msg?: string) {
    if (actual == null || Math.abs(actual - expected) > tol) {
      throw new Error(`${msg ?? "assert.close"}: expected ${expected}±${tol}, got ${String(actual)}`);
    }
  },
  deepEqual(actual: unknown, expected: unknown, msg?: string) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) throw new Error(`${msg ?? "assert.deepEqual"}: expected ${e}, got ${a}`);
  },
};

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

// Real in-play pitch from the 2026-10-07 LAD@ATL feed (gamePk 849822).
const IN_PLAY: RawLivePitchEvent = {
  isPitch: true,
  pitchNumber: 4,
  details: {
    call: { code: "X", description: "In play, out(s)" },
    description: "In play, out(s)",
    type: { code: "FF", description: "Four-Seam Fastball" },
    isInPlay: true,
    isStrike: false,
    isBall: false,
  },
  pitchData: {
    startSpeed: 94.2,
    endSpeed: 85.5,
    strikeZoneTop: 3.096,
    strikeZoneBottom: 1.563,
    coordinates: {
      aY: 31.785929032125146,
      aZ: -13.75641819051376,
      pX: 0.5266625835557889,
      pZ: 2.8499271980403638,
      vX0: 8.341475084937935,
      vY0: -136.87260673064264,
      vZ0: -4.3522305401928705,
      x0: -1.3421469076769088,
      y0: 50.00044812536512,
      z0: 5.410750475014173,
      aX: -17.81150235860532,
    },
    breaks: {
      breakVertical: -14.2,
      breakVerticalInduced: 16.8,
      breakHorizontal: 15.2,
      spinRate: 2462,
      spinDirection: 224,
    },
    zone: 3,
    extension: 6.774048465106844,
  },
  hitData: {
    launchSpeed: 95.8,
    launchAngle: 30.0,
    totalDistance: 359.0,
    trajectory: "fly_ball",
    hardness: "medium",
    location: "9",
  },
};

const CALLED: RawLivePitchEvent = {
  isPitch: true,
  pitchNumber: 2,
  details: {
    call: { code: "C", description: "Called Strike" },
    type: { code: "KC", description: "Knuckle Curve" },
    isStrike: true,
  },
  pitchData: {
    startSpeed: 81.3,
    coordinates: { pX: -0.4, pZ: 1.9 },
    breaks: { spinRate: 2788, spinDirection: 21, breakHorizontal: -9.7, breakVerticalInduced: -15.6 },
    zone: 7,
  },
};

test("num accepts finite numbers and numeric strings only", () => {
  assert.equal(num(94.2), 94.2);
  assert.equal(num("2462"), 2462);
  assert.equal(num(null), null);
  assert.equal(num(""), null);
  assert.equal(num("abc"), null);
  assert.equal(num(Number.NaN), null);
});

test("parsePitchStatcast reads pitchData + breaks + hitData", () => {
  const sc = parsePitchStatcast(IN_PLAY)!;
  assert.equal(sc.startSpeed, 94.2);
  assert.equal(sc.endSpeed, 85.5);
  assert.equal(sc.spinRate, 2462);
  assert.equal(sc.spinDirection, 224);
  assert.equal(sc.breakHorizontal, 15.2);
  assert.equal(sc.breakVertical, -14.2);
  assert.equal(sc.breakVerticalInduced, 16.8);
  assert.close(sc.extension, 6.77, 0.01);
  assert.equal(sc.zone, 3);
  assert.equal(sc.hit!.launchSpeed, 95.8);
  assert.equal(sc.hit!.launchAngle, 30);
  assert.equal(sc.hit!.totalDistance, 359);
  assert.equal(sc.hit!.trajectory, "fly_ball");
  assert.equal(sc.hit!.hardness, "medium");
  assert.equal(sc.hit!.xba, null, "live feed has no xBA");
});

test("parsePitchStatcast: empty pitch → null; non-contact → hit null", () => {
  assert.equal(parsePitchStatcast({ isPitch: true, details: {} }), null);
  assert.equal(parsePitchStatcast(null), null);
  const sc = parsePitchStatcast(CALLED)!;
  assert.equal(sc.hit, null);
  assert.equal(sc.endSpeed, null);
  assert.equal(sc.extension, null);
  assert.equal(sc.release, null, "no trajectory → no release point");
});

test("releasePoint derives a plausible RHP release from the trajectory", () => {
  const r = releasePoint(IN_PLAY.pitchData!.coordinates, IN_PLAY.pitchData!.extension)!;
  assert.close(r.height, 5.53, 0.05);
  assert.close(r.side, 1.57, 0.05);
  assert.equal(releasePoint(IN_PLAY.pitchData!.coordinates, null), null);
  assert.equal(releasePoint({ x0: 1 }, 6.5), null);
  assert.equal(releasePoint(IN_PLAY.pitchData!.coordinates, 20), null, "implausible extension");
});

test("parseBattedBall: xBA only when the feed carries it; empty → null", () => {
  assert.equal(parseBattedBall(undefined), null);
  assert.equal(parseBattedBall({}), null);
  assert.close(parseBattedBall({ launchSpeed: 101, xba: 0.62 })!.xba, 0.62, 1e-9);
  assert.close(parseBattedBall({ hitProbability: 45 })!.xba, 0.45, 1e-9, "percent form");
  assert.equal(parseBattedBall({ launchSpeed: 88, xba: 170 })!.xba, null, "out of range ignored");
  assert.equal(parseBattedBall({ location: 8 })!.location, "8");
});

test("mapLivePitches keeps pitches without coordinates (list-only)", () => {
  const noCoords: RawLivePitchEvent = {
    isPitch: true,
    pitchNumber: 3,
    details: { call: { code: "V", description: "Automatic Ball" } },
  };
  const action: RawLivePitchEvent = { isPitch: false, details: { description: "Mound visit." } };
  const out = mapLivePitches({ playEvents: [CALLED, action, noCoords, IN_PLAY] });
  assert.deepEqual(
    out.map((p) => p.number),
    [2, 3, 4],
  );
  assert.equal(out[1]!.pX, null);
  assert.equal(out[1]!.pZ, null);
  assert.equal(out[1]!.statcast, null);
  assert.equal(out[0]!.call, "S");
  assert.equal(out[2]!.call, "X");
  assert.equal(out[2]!.pitchType, "Four-Seam Fastball");
  assert.equal(out[2]!.pitchCode, "FF");
  assert.equal(out[2]!.zoneTop, 3.096);
  assert.equal(out[0]!.zoneTop, 3.5, "default zone top");
});

test("mapLivePlay reads matchup hands and at-bat", () => {
  const play = mapLivePlay({
    about: { atBatIndex: 41, isComplete: true },
    matchup: { batter: { id: 1 }, pitcher: { id: 2 }, batSide: { code: "L" }, pitchHand: { code: "R" } },
    playEvents: [IN_PLAY],
  })!;
  assert.equal(play.atBatIndex, 41);
  assert.equal(play.isComplete, true);
  assert.equal(play.batSide, "L");
  assert.equal(play.pitchHand, "R");
  assert.equal(play.pitches.length, 1);
  assert.equal(mapLivePlay(null), null);
  assert.equal(mapLivePlay({ matchup: { batSide: { code: "S" } } })!.batSide, null);
});

const P = (n: number, speed: number, type = "Sinker", extra: Partial<MlbLivePitch> = {}): MlbLivePitch => ({
  number: n,
  pX: 0,
  pZ: 2.5,
  call: "B",
  callLabel: "Ball",
  pitchType: type,
  speed,
  zoneTop: 3.5,
  zoneBottom: 1.5,
  ...extra,
});

test("mergeLivePitches: same at-bat unions by number, rich wins", () => {
  const base = [P(1, 94), P(2, 73, "Curveball"), P(3, 95)];
  const sc = parsePitchStatcast(CALLED);
  const rich = [P(1, 94, "Sinker", { statcast: sc }), P(2, 73, "Curveball", { statcast: sc })];
  const out = mergeLivePitches(base, rich);
  assert.deepEqual(
    out.map((p) => p.number),
    [1, 2, 3],
  );
  assert.ok(out[0]!.statcast, "rich pitch used");
  assert.equal(out[2]!.statcast, undefined, "base-only newer pitch kept");
});

test("mergeLivePitches: different at-bat / empty / missing rich", () => {
  const base = [P(1, 94), P(2, 73, "Curveball")];
  const newAb = [P(1, 88, "Slider")];
  assert.deepEqual(
    mergeLivePitches(base, newAb).map((p) => p.speed),
    [88],
    "different at-bat → rich",
  );
  assert.equal(mergeLivePitches(base, []).length, 0, "fresh at-bat with no pitches");
  assert.equal(mergeLivePitches(base, null).length, 2, "no rich → base");
  assert.equal(mergeLivePitches(base, undefined).length, 2);
  assert.equal(mergeLivePitches([], newAb).length, 1);
});

test("spinAxisClock: 180° = 12:00, RHP four-seam ≈ 1:30, curve ≈ 6:45", () => {
  assert.equal(spinAxisClock(180), "12:00");
  assert.equal(spinAxisClock(224), "1:30");
  assert.equal(spinAxisClock(213), "1:00");
  assert.equal(spinAxisClock(21), "6:45");
  assert.equal(spinAxisClock(155), "11:15");
  assert.equal(spinAxisClock(0), "6:00");
  assert.equal(spinAxisClock(359), "6:00");
  assert.equal(spinAxisClock(null), null);
});

test("number formatting", () => {
  assert.equal(formatSpinRate(2462), "2,462");
  assert.equal(formatSpinRate(0), null);
  assert.equal(formatSpinRate(undefined), null);
  assert.equal(formatOneDecimal(-14.2), "\u221214.2");
  assert.equal(formatOneDecimal(16.84), "16.8");
  assert.equal(formatOneDecimal(-0.04), "0.0");
  assert.equal(formatOneDecimal(null), null);
  assert.equal(formatXba(0.312), ".312");
  assert.equal(formatXba(1), "1.000");
  assert.equal(formatXba(null), null);
  assert.equal(trajectoryLabel("fly_ball"), "Fly ball");
  assert.equal(trajectoryLabel("popup"), "Pop up");
  assert.equal(trajectoryLabel("weird_new_kind"), "Weird new kind");
  assert.equal(trajectoryLabel(""), null);
  assert.equal(hardnessLabel("hard"), "Hard");
  assert.equal(hardnessLabel(null), null);
});

test("breakSide uses the feed sign + pitcher hand", () => {
  assert.equal(breakSide(15.2, "R"), "arm", "RHP four-seam runs arm side");
  assert.equal(breakSide(-7.7, "R"), "glove", "RHP slider");
  assert.equal(breakSide(-18.7, "L"), "arm", "LHP changeup");
  assert.equal(breakSide(13.1, "L"), "glove", "LHP sweeper");
  assert.equal(breakSide(0.2, "R"), null, "negligible");
  assert.equal(breakSide(10, null), null);
});

test("pitchTypeName: full name from feed, else from code", () => {
  assert.equal(pitchTypeName({ pitchType: "Four-Seam Fastball", pitchCode: "FF" }), "Four-Seam Fastball");
  assert.equal(pitchTypeName({ pitchType: "ST", pitchCode: null }), "Sweeper");
  assert.equal(pitchTypeName({ pitchType: null, pitchCode: "CH" }), "Changeup");
  assert.equal(pitchTypeName({ pitchType: null, pitchCode: null }), null);
});

test("statcastPitchChips: full pitch → ordered chips with units", () => {
  const chips = statcastPitchChips(parsePitchStatcast(IN_PLAY), "R");
  assert.deepEqual(
    chips.map((c) => c.key),
    ["spin", "axis", "ivb", "hb", "vb", "ext", "release", "zone"],
  );
  const by = Object.fromEntries(chips.map((c) => [c.key, c]));
  assert.equal(by.spin!.value, "2,462");
  assert.equal(by.spin!.unit, "rpm");
  assert.equal(by.axis!.value, "1:30");
  assert.equal(by.axis!.sub, "224°");
  assert.equal(by.ivb!.value, "16.8");
  assert.equal(by.hb!.value, "15.2");
  assert.equal(by.hb!.sub, "arm side");
  assert.equal(by.vb!.value, "\u221214.2");
  assert.equal(by.ext!.value, "6.8");
  assert.equal(by.release!.value, "5.5");
  assert.equal(by.release!.sub, "1.6 ft side");
  assert.equal(by.zone!.value, "3");
  assert.equal(by.zone!.sub, "in zone");
});

test("statcastPitchChips hides missing fields (no dashes)", () => {
  const chips = statcastPitchChips(parsePitchStatcast(CALLED), null);
  assert.deepEqual(
    chips.map((c) => c.key),
    ["spin", "axis", "ivb", "hb", "zone"],
  );
  assert.equal(chips.find((c) => c.key === "hb")!.sub, undefined, "no hand → no side");
  assert.equal(chips.find((c) => c.key === "zone")!.value, "7");
  assert.ok(chips.every((c) => c.value && c.value !== "—"));
  assert.equal(statcastPitchChips(null).length, 0);
  const outside = statcastPitchChips({ ...parsePitchStatcast(CALLED)!, zone: 13 });
  assert.equal(outside.find((c) => c.key === "zone")!.sub, "outside");
});

test("statcastHitChips: in-play pitch → EV, LA, distance, trajectory, contact", () => {
  const hit = parsePitchStatcast(IN_PLAY)!.hit;
  const chips = statcastHitChips(hit);
  assert.deepEqual(
    chips.map((c) => [c.key, c.value, c.unit ?? ""]),
    [
      ["ev", "95.8", "mph"],
      ["la", "30°", ""],
      ["dist", "359", "ft"],
      ["traj", "Fly ball", ""],
      ["hard", "Medium", ""],
    ],
  );
  assert.equal(statcastHitChips(null).length, 0);
  const withXba = statcastHitChips({ ...hit!, xba: 0.21 });
  assert.equal(withXba[withXba.length - 1]!.value, ".210");
  const bunt = statcastHitChips({ launchSpeed: 40, launchAngle: -20, totalDistance: 0, trajectory: null, hardness: null, location: null, xba: null });
  assert.deepEqual(
    bunt.map((c) => c.key),
    ["ev", "la"],
    "zero distance hidden",
  );
});

test("pitchRowStats: compact row line, missing bits dropped", () => {
  assert.deepEqual(pitchRowStats(parsePitchStatcast(IN_PLAY)), ["2,462 rpm", "IVB 16.8\u2033", "HB 15.2\u2033"]);
  assert.deepEqual(pitchRowStats(parsePitchStatcast({ isPitch: true, pitchData: { breaks: { spinRate: 2100 } } })), [
    "2,100 rpm",
  ]);
  assert.deepEqual(pitchRowStats(null), []);
});

console.log(`\n${passed} tests passed`);
