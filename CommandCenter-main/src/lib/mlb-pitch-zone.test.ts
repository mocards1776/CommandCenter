/**
 * Run with: node --experimental-strip-types src/lib/mlb-pitch-zone.test.ts
 * from CommandCenter-main/.
 */
import {
  DOT_MIN_SEP,
  DEFAULT_ZONE_BOTTOM_FT,
  DEFAULT_ZONE_TOP_FT,
  formatPitchMph,
  PITCH_LEGEND,
  PITCH_RESULT_STYLES,
  PLOT_MARGIN_X,
  PLOT_EDGE_PAD,
  PLOT_MARGIN_Y,
  pitchResultFromCall,
  pitchResultFromPlot,
  pitchTypeCode,
  pitchResultStyle,
  pitchZonePosition,
  relaxPitchDots,
  ZONE_HALF_WIDTH_FT,
  zoneInsetPct,
} from "./mlb-pitch-zone.ts";

const assert = {
  equal(actual: unknown, expected: unknown, msg?: string) {
    if (actual !== expected) {
      throw new Error(`${msg ?? "assert.equal"}: expected ${String(expected)}, got ${String(actual)}`);
    }
  },
  notEqual(actual: unknown, expected: unknown, msg?: string) {
    if (actual === expected) throw new Error(`${msg ?? "assert.notEqual"}: both ${String(actual)}`);
  },
  ok(cond: unknown, msg?: string) {
    if (!cond) throw new Error(msg ?? "assert.ok");
  },
  match(value: string, re: RegExp, msg?: string) {
    if (!re.test(value)) throw new Error(`${msg ?? "assert.match"}: ${value} !~ ${re}`);
  },
  deepEqual(actual: unknown, expected: unknown, msg?: string) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`${msg ?? "assert.deepEqual"}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
    }
  },
};

const near = (a: number, b: number, eps = 0.15, msg?: string) =>
  assert.ok(Math.abs(a - b) <= eps, `${msg ?? ""} expected ${a} ≈ ${b}`);

// --- coordinate → position -------------------------------------------------
const zone = { zoneTop: 3.4, zoneBottom: 1.6 };
const inset = zoneInsetPct();
near(inset.x, (PLOT_MARGIN_X / (1 + 2 * PLOT_MARGIN_X)) * 100, 0.1, "inset x");
near(inset.y, (PLOT_MARGIN_Y / (1 + 2 * PLOT_MARGIN_Y)) * 100, 0.1, "inset y");

// Dead center of the zone → center of the plot.
const center = pitchZonePosition({ pX: 0, pZ: 2.5, ...zone })!;
near(center.leftPct, 50, 0.1, "center x");
near(center.topPct, 50, 0.1, "center y");
assert.equal(center.inZone, true);
assert.equal(center.clamped, false);

// Zone corners land exactly on the grid's inset edges.
const topLeft = pitchZonePosition({ pX: -ZONE_HALF_WIDTH_FT, pZ: 3.4, ...zone })!;
near(topLeft.leftPct, inset.x, 0.15, "top-left x");
near(topLeft.topPct, inset.y, 0.15, "top-left y");
assert.equal(topLeft.inZone, true);
const bottomRight = pitchZonePosition({ pX: ZONE_HALF_WIDTH_FT, pZ: 1.6, ...zone })!;
near(bottomRight.leftPct, 100 - inset.x, 0.15, "bottom-right x");
near(bottomRight.topPct, 100 - inset.y, 0.15, "bottom-right y");

// Catcher's view: positive pX is plot-right; higher pZ is plot-up.
const right = pitchZonePosition({ pX: 0.5, pZ: 2.5, ...zone })!;
const left = pitchZonePosition({ pX: -0.5, pZ: 2.5, ...zone })!;
assert.ok(right.leftPct > 50 && left.leftPct < 50, "pX sign → left/right");
const high = pitchZonePosition({ pX: 0, pZ: 3.2, ...zone })!;
const low = pitchZonePosition({ pX: 0, pZ: 1.8, ...zone })!;
assert.ok(high.topPct < low.topPct, "higher pitch sits higher on the plot");

// Just off the plate: outside the zone but still inside the margin (not clamped).
const offPlate = pitchZonePosition({ pX: 1.1, pZ: 2.5, ...zone })!;
assert.equal(offPlate.inZone, false);
assert.equal(offPlate.clamped, false);
assert.ok(offPlate.leftPct > 100 - inset.x && offPlate.leftPct < 100, "off plate inside margin");

// Way outside (bounced / sailed) → pinned to the plot edge, flagged clamped.
const dirt = pitchZonePosition({ pX: -3, pZ: -0.5, ...zone })!;
assert.equal(dirt.leftPct, PLOT_EDGE_PAD * 100);
assert.equal(dirt.topPct, 100 - PLOT_EDGE_PAD * 100);
assert.equal(dirt.clamped, true);
assert.equal(dirt.inZone, false);

// Real LAD–ATL 2026-10-07 pitch: FS ball at pX 1.146, pZ 1.359 (zone 3.128 / 1.579).
const fs = pitchZonePosition({ pX: 1.1462769601040508, pZ: 1.3594399156150367, zoneTop: 3.128, zoneBottom: 1.579 })!;
assert.equal(fs.inZone, false, "low-away splitter is a ball");
assert.ok(fs.leftPct > 100 - inset.x && fs.topPct > 100 - inset.y, "low and to catcher's right");

// Missing / bad zone bounds fall back to defaults; missing coords → null.
const fallback = pitchZonePosition({ pX: 0, pZ: (DEFAULT_ZONE_TOP_FT + DEFAULT_ZONE_BOTTOM_FT) / 2, zoneTop: 0, zoneBottom: 0 })!;
near(fallback.topPct, 50, 0.1, "default zone center");
assert.equal(pitchZonePosition({ pX: null, pZ: 2 }), null);
assert.equal(pitchZonePosition({ pX: 0.1, pZ: Number.NaN }), null);

const dirtNoPad = pitchZonePosition({ pX: 4, pZ: 7, ...zone }, { edgePad: 0 })!;
assert.equal(dirtNoPad.leftPct, 100);
assert.equal(dirtNoPad.topPct, 0);

// Custom margins are honored.
const noMargin = pitchZonePosition({ pX: -ZONE_HALF_WIDTH_FT, pZ: 3.4, ...zone }, { marginX: 0, marginY: 0, edgePad: 0 })!;
near(noMargin.leftPct, 0, 0.1);
near(noMargin.topPct, 0, 0.1);

// --- result → color -------------------------------------------------------
assert.equal(pitchResultFromCall("B"), "ball");
assert.equal(pitchResultFromCall("*B"), "ball");
assert.equal(pitchResultFromCall("I"), "ball");
assert.equal(pitchResultFromCall("H"), "ball");
assert.equal(pitchResultFromCall("C"), "called");
assert.equal(pitchResultFromCall("A"), "called");
assert.equal(pitchResultFromCall("S"), "swinging");
assert.equal(pitchResultFromCall("W"), "swinging");
assert.equal(pitchResultFromCall("M"), "swinging");
assert.equal(pitchResultFromCall("F"), "foul");
assert.equal(pitchResultFromCall("T"), "foul");
assert.equal(pitchResultFromCall("L"), "foul");
assert.equal(pitchResultFromCall("X"), "inplay");
assert.equal(pitchResultFromCall("D"), "inplay");
assert.equal(pitchResultFromCall("E"), "inplay");
assert.equal(pitchResultFromCall("x"), "inplay", "case-insensitive");
// Unknown codes fall back to flags / description.
assert.equal(pitchResultFromCall(null, { description: "Swinging Strike (Blocked)" }), "swinging");
assert.equal(pitchResultFromCall("", { description: "Foul Tip" }), "foul");
assert.equal(pitchResultFromCall("?", { isInPlay: true }), "inplay");
assert.equal(pitchResultFromCall(undefined, { isBall: true }), "ball");
assert.equal(pitchResultFromCall(undefined, { isStrike: true }), "called");
assert.equal(pitchResultFromCall(undefined), "other");

// Every legend bucket has a distinct dot color; strikes are red-family but not equal.
const fills = PITCH_LEGEND.map((r) => pitchResultStyle(r).fill.toLowerCase());
assert.equal(new Set(fills).size, fills.length, "legend colors are distinct");
assert.equal(pitchResultStyle("called").fill, "#ef4444");
assert.notEqual(pitchResultStyle("swinging").fill, pitchResultStyle("called").fill);
assert.equal(pitchResultStyle("foul").fill, PITCH_RESULT_STYLES.foul.fill);
assert.deepEqual(PITCH_LEGEND, ["ball", "called", "swinging", "foul", "inplay"]);
for (const r of PITCH_LEGEND) {
  const s = pitchResultStyle(r);
  assert.match(s.fill, /^#[0-9a-f]{6}$/i);
  assert.match(s.text, /^#[0-9a-f]{6}$/i);
  assert.ok(s.label.length > 0);
}

// Mapped MlbPitchPlot (label + coarse call) → bucket.
assert.equal(pitchResultFromPlot({ call: "B", callLabel: "Ball In Dirt" }), "ball");
assert.equal(pitchResultFromPlot({ call: "B", callLabel: "Hit By Pitch" }), "ball");
assert.equal(pitchResultFromPlot({ call: "B", callLabel: "Pitchout" }), "ball");
assert.equal(pitchResultFromPlot({ call: "S", callLabel: "Called Strike" }), "called");
assert.equal(pitchResultFromPlot({ call: "S", callLabel: "Automatic Strike" }), "called");
assert.equal(pitchResultFromPlot({ call: "S", callLabel: "Swinging Strike (Blocked)" }), "swinging");
assert.equal(pitchResultFromPlot({ call: "S", callLabel: "Missed Bunt" }), "swinging");
assert.equal(pitchResultFromPlot({ call: "S", callLabel: "Foul Tip" }), "foul");
assert.equal(pitchResultFromPlot({ call: "S", callLabel: "Foul Bunt" }), "foul");
assert.equal(pitchResultFromPlot({ call: "X", callLabel: "In play, run(s)" }), "inplay");
assert.equal(pitchResultFromPlot({ call: "X", callLabel: "Pitch" }), "inplay");
assert.equal(pitchResultFromPlot({ call: "S", callLabel: "Pitch" }), "called");
assert.equal(pitchResultFromPlot({ call: "O", callLabel: "Pitch" }), "other");

// Pitch type description → code.
assert.equal(pitchTypeCode("Four-Seam Fastball"), "FF");
assert.equal(pitchTypeCode("Slider"), "SL");
assert.equal(pitchTypeCode("Splitter"), "FS");
assert.equal(pitchTypeCode("Knuckle Curve"), "KC");
assert.equal(pitchTypeCode("Sweeper"), "ST");
assert.equal(pitchTypeCode("SL"), "SL", "raw code passes through");
assert.equal(pitchTypeCode("Mystery Pitch"), "MP", "unknown → initials");
assert.equal(pitchTypeCode(null), null);

// --- mph -------------------------------------------------------------------
assert.equal(formatPitchMph(87.4), "87");
assert.equal(formatPitchMph(96.6), "97");
assert.equal(formatPitchMph(null), "—");


// --- dot collision relaxation ---------------------------------------------
{
  const aspect = (1 + 2 * PLOT_MARGIN_X) / ((1 + 2 * PLOT_MARGIN_Y) * 0.92);
  // Distance in plot widths (same scale both axes).
  const gap = (a: { leftPct: number; topPct: number }, b: { leftPct: number; topPct: number }) =>
    Math.hypot((a.leftPct - b.leftPct) / 100, (a.topPct - b.topPct) / 100 / aspect);
  const tol = 0.003; // rounding to 0.1%

  // Far-apart dots are untouched.
  const apart = relaxPitchDots(
    [
      { leftPct: 30, topPct: 30, n: 1 },
      { leftPct: 70, topPct: 70, n: 2 },
    ],
    { aspect },
  );
  assert.equal(apart[0].leftPct, 30);
  assert.equal(apart[0].topPct, 30);
  assert.equal(apart[1].leftPct, 70);
  assert.equal(apart[0].shifted, false);
  assert.equal(apart[1].shifted, false);
  assert.equal(apart[1].n, 2, "extra fields carried through");

  // Two dots pinned at the same right-edge spot (the clustered 1 and 6 case).
  const edge = pitchZonePosition({ pX: 2.4, pZ: 2.6, zoneTop: 3.4, zoneBottom: 1.6 })!;
  const edge2 = pitchZonePosition({ pX: 2.1, pZ: 2.55, zoneTop: 3.4, zoneBottom: 1.6 })!;
  const pinned = relaxPitchDots([edge, edge2], { aspect });
  assert.ok(gap(pinned[0], pinned[1]) >= DOT_MIN_SEP - tol, `edge pair separated (${gap(pinned[0], pinned[1])})`);
  for (const p of pinned) {
    assert.ok(p.leftPct <= 100 - PLOT_EDGE_PAD * 100 + 0.05, "stays inside right pad");
  }
  assert.ok(pinned[0].topPct < pinned[1].topPct, "earlier coincident dot moves up");

  // Partial overlap: pushed apart along the line between them, each shift bounded.
  const near = [
    { leftPct: 50, topPct: 50 },
    { leftPct: 53, topPct: 51 },
  ];
  const nearOut = relaxPitchDots(near, { aspect });
  assert.ok(gap(nearOut[0], nearOut[1]) >= DOT_MIN_SEP - tol, "overlap resolved");
  assert.ok(nearOut[0].leftPct < 50 && nearOut[1].leftPct > 53, "pushed apart horizontally");
  for (let k = 0; k < near.length; k++) {
    assert.ok(gap(near[k], nearOut[k]) <= DOT_MIN_SEP + tol, "within maxShift of true spot");
  }

  // Five coincident pitches all end up readable and near the true spot.
  const five = Array.from({ length: 5 }, () => ({ leftPct: 48, topPct: 52 }));
  const fiveOut = relaxPitchDots(five, { aspect });
  for (let i = 0; i < fiveOut.length; i++) {
    assert.ok(gap(five[i], fiveOut[i]) <= DOT_MIN_SEP + tol, `dot ${i} within maxShift`);
    for (let j = i + 1; j < fiveOut.length; j++) {
      assert.ok(gap(fiveOut[i], fiveOut[j]) >= DOT_MIN_SEP * 0.9, `dots ${i},${j} readable (${gap(fiveOut[i], fiveOut[j])})`);
    }
  }

  // Deterministic, order preserved (latest stays last → top z-index).
  assert.deepEqual(relaxPitchDots(five, { aspect }), fiveOut);
  assert.equal(relaxPitchDots([], { aspect }).length, 0);

  // A tight maxShift caps movement even if overlap remains.
  const capped = relaxPitchDots(
    [
      { leftPct: 50, topPct: 50 },
      { leftPct: 50, topPct: 50 },
    ],
    { aspect, maxShift: 0.01 },
  );
  assert.ok(gap({ leftPct: 50, topPct: 50 }, capped[0]) <= 0.01 + tol, "maxShift honoured");
}

console.log("mlb-pitch-zone tests passed");
