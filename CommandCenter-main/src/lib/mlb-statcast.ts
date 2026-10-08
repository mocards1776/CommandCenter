/**
 * Statcast-style pitch + batted-ball data from the MLB StatsAPI live feed
 * (`liveData.plays.currentPlay.playEvents[]`), for the live strike-zone panel.
 * Pure helpers — no React, no fetch. Unit-tested with
 * node --experimental-strip-types src/lib/mlb-statcast.test.ts
 *
 * Feed fields used: pitchData.{startSpeed,endSpeed,extension,zone,
 * coordinates.{pX,pZ,x0,y0,z0,vX0,vY0,vZ0,aX,aY,aZ},breaks.{spinRate,
 * spinDirection,breakHorizontal,breakVertical,breakVerticalInduced}} and
 * hitData.{launchSpeed,launchAngle,totalDistance,trajectory,hardness,location}.
 * The live feed has no xBA or release-point fields; xBA is read only if a
 * future feed adds it, and the release point is derived from the trajectory.
 */

export type MlbPitchCall = "B" | "S" | "X" | "O";

export type MlbBattedBall = {
  launchSpeed: number | null;
  launchAngle: number | null;
  totalDistance: number | null;
  /** StatsAPI slug: ground_ball, line_drive, fly_ball, popup, bunt_grounder… */
  trajectory: string | null;
  /** soft / medium / hard */
  hardness: string | null;
  /** Fielder position number the ball went to ("8" = CF). */
  location: string | null;
  /** Expected batting average — only if the feed carries it (it usually doesn't). */
  xba: number | null;
};

export type MlbPitchStatcast = {
  startSpeed: number | null;
  endSpeed: number | null;
  spinRate: number | null;
  /** Spin axis in degrees (180 = pure backspin, i.e. 12:00). */
  spinDirection: number | null;
  /** Inches; > 0 is toward a RHP's arm side (a LHP's glove side). */
  breakHorizontal: number | null;
  /** Inches, total vertical break including gravity (negative = drop). */
  breakVertical: number | null;
  /** Inches, induced vertical break (gravity removed). */
  breakVerticalInduced: number | null;
  /** Feet in front of the rubber at release. */
  extension: number | null;
  /** Gameday zone: 1–9 in the zone, 11–14 outside. */
  zone: number | null;
  /** Derived from the pitch trajectory at the extension point (feet). */
  release: { height: number; side: number } | null;
  hit: MlbBattedBall | null;
};

/** A pitch in the current PA with optional Statcast detail. */
export type MlbLivePitch = {
  number: number;
  pX: number | null;
  pZ: number | null;
  call: MlbPitchCall;
  callLabel: string;
  /** StatsAPI type description ("Four-Seam Fastball"), else code. */
  pitchType: string | null;
  pitchCode?: string | null;
  speed: number | null;
  zoneTop: number;
  zoneBottom: number;
  statcast?: MlbPitchStatcast | null;
};

export type MlbLivePlay = {
  atBatIndex: number | null;
  isComplete: boolean;
  batterId: number | null;
  pitcherId: number | null;
  batSide: "L" | "R" | null;
  pitchHand: "L" | "R" | null;
  pitches: MlbLivePitch[];
};

type Num = number | null | undefined;

export type RawLivePitchEvent = {
  isPitch?: boolean;
  pitchNumber?: number;
  details?: {
    call?: { code?: string; description?: string };
    description?: string;
    type?: { code?: string; description?: string };
    isBall?: boolean;
    isStrike?: boolean;
    isInPlay?: boolean;
  };
  pitchData?: {
    startSpeed?: Num;
    endSpeed?: Num;
    strikeZoneTop?: Num;
    strikeZoneBottom?: Num;
    extension?: Num;
    zone?: Num;
    coordinates?: {
      pX?: Num;
      pZ?: Num;
      x0?: Num;
      y0?: Num;
      z0?: Num;
      vX0?: Num;
      vY0?: Num;
      vZ0?: Num;
      aX?: Num;
      aY?: Num;
      aZ?: Num;
    };
    breaks?: {
      spinRate?: Num;
      spinDirection?: Num;
      breakHorizontal?: Num;
      breakVertical?: Num;
      breakVerticalInduced?: Num;
    };
  };
  hitData?: {
    launchSpeed?: Num;
    launchAngle?: Num;
    totalDistance?: Num;
    trajectory?: string | null;
    hardness?: string | null;
    location?: string | number | null;
    xba?: Num;
    estimatedBAUsingSpeedAngle?: Num;
    hitProbability?: Num;
  };
};

export type RawLivePlay = {
  atBatIndex?: number;
  about?: { atBatIndex?: number; isComplete?: boolean };
  matchup?: {
    batter?: { id?: number };
    pitcher?: { id?: number };
    batSide?: { code?: string };
    pitchHand?: { code?: string };
  };
  playEvents?: RawLivePitchEvent[];
};

type RawPitchCoords = NonNullable<NonNullable<RawLivePitchEvent["pitchData"]>["coordinates"]>;

/** Finite number or null (strings like "94.2" are accepted). */
export function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Distance from the rubber to the back of home plate, feet. */
const RUBBER_TO_PLATE_FT = 60.5;

/**
 * Release point (height, side — feet, catcher's view side as an absolute
 * value) from the 9-parameter trajectory, evaluated where the pitcher let go
 * (y = 60.5 − extension). Null when the trajectory or extension is missing
 * or the result is implausible.
 */
export function releasePoint(
  coords: RawPitchCoords | null | undefined,
  extension: Num,
): { height: number; side: number } | null {
  const c = coords ?? {};
  const x0 = num(c.x0);
  const y0 = num(c.y0);
  const z0 = num(c.z0);
  const vX0 = num(c.vX0);
  const vY0 = num(c.vY0);
  const vZ0 = num(c.vZ0);
  const aX = num(c.aX) ?? 0;
  const aY = num(c.aY) ?? 0;
  const aZ = num(c.aZ) ?? 0;
  const ext = num(extension);
  if (x0 == null || y0 == null || z0 == null || vX0 == null || vY0 == null || vZ0 == null || ext == null) {
    return null;
  }
  if (ext < 3 || ext > 9 || vY0 >= 0) return null;
  const yr = RUBBER_TO_PLATE_FT - ext;
  // 0.5·aY·t² + vY0·t + (y0 − yr) = 0, root just before t = 0.
  const A = 0.5 * aY;
  const B = vY0;
  const C = y0 - yr;
  let t: number;
  if (Math.abs(A) < 1e-9) {
    t = -C / B;
  } else {
    const disc = B * B - 4 * A * C;
    if (disc < 0) return null;
    const r1 = (-B + Math.sqrt(disc)) / (2 * A);
    const r2 = (-B - Math.sqrt(disc)) / (2 * A);
    const cands = [r1, r2].filter((r) => r <= 0 && r > -0.5);
    if (cands.length === 0) return null;
    t = Math.max(...cands);
  }
  const x = x0 + vX0 * t + 0.5 * aX * t * t;
  const z = z0 + vZ0 * t + 0.5 * aZ * t * t;
  if (!Number.isFinite(x) || !Number.isFinite(z) || z < 2 || z > 8 || Math.abs(x) > 5) return null;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return { height: r2(z), side: r2(Math.abs(x)) };
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

/** xBA if the feed ever carries it (0–1); otherwise null. */
function readXba(hd: RawLivePitchEvent["hitData"]): number | null {
  for (const v of [hd?.xba, hd?.estimatedBAUsingSpeedAngle, hd?.hitProbability]) {
    const n = num(v);
    if (n == null) continue;
    const frac = n > 1 && n <= 100 ? n / 100 : n;
    if (frac >= 0 && frac <= 1) return frac;
  }
  return null;
}

export function parseBattedBall(hd: RawLivePitchEvent["hitData"]): MlbBattedBall | null {
  if (!hd) return null;
  const out: MlbBattedBall = {
    launchSpeed: num(hd.launchSpeed),
    launchAngle: num(hd.launchAngle),
    totalDistance: num(hd.totalDistance),
    trajectory: str(hd.trajectory),
    hardness: str(hd.hardness),
    location: str(hd.location),
    xba: readXba(hd),
  };
  const any = Object.values(out).some((v) => v != null);
  return any ? out : null;
}

/** Statcast detail for one pitch event; null when the feed has none of it. */
export function parsePitchStatcast(ev: RawLivePitchEvent | null | undefined): MlbPitchStatcast | null {
  if (!ev) return null;
  const pd = ev.pitchData ?? {};
  const br = pd.breaks ?? {};
  const out: MlbPitchStatcast = {
    startSpeed: num(pd.startSpeed),
    endSpeed: num(pd.endSpeed),
    spinRate: num(br.spinRate),
    spinDirection: num(br.spinDirection),
    breakHorizontal: num(br.breakHorizontal),
    breakVertical: num(br.breakVertical),
    breakVerticalInduced: num(br.breakVerticalInduced),
    extension: num(pd.extension),
    zone: num(pd.zone),
    release: releasePoint(pd.coordinates, pd.extension),
    hit: parseBattedBall(ev.hitData),
  };
  const any = Object.values(out).some((v) => v != null);
  return any ? out : null;
}

export function pitchCallKind(ev: RawLivePitchEvent): MlbPitchCall {
  const code = (ev.details?.call?.code ?? "").toUpperCase();
  if (code === "B" || ev.details?.isBall) return "B";
  if (code === "X" || ev.details?.isInPlay) return "X";
  if (["S", "C", "F", "T", "W", "M"].includes(code) || ev.details?.isStrike) return "S";
  return "O";
}

function hand(code: string | null | undefined): "L" | "R" | null {
  const c = (code ?? "").trim().toUpperCase();
  return c === "L" || c === "R" ? c : null;
}

/** All pitches of a play (with or without plate coordinates), in order. */
export function mapLivePitches(play: RawLivePlay | null | undefined): MlbLivePitch[] {
  const out: MlbLivePitch[] = [];
  for (const ev of play?.playEvents ?? []) {
    if (!ev?.isPitch) continue;
    const pd = ev.pitchData ?? {};
    out.push({
      number: Number(ev.pitchNumber ?? out.length + 1),
      pX: num(pd.coordinates?.pX),
      pZ: num(pd.coordinates?.pZ),
      call: pitchCallKind(ev),
      callLabel: ev.details?.call?.description || ev.details?.description || "Pitch",
      pitchType: ev.details?.type?.description ?? ev.details?.type?.code ?? null,
      pitchCode: ev.details?.type?.code ?? null,
      speed: num(pd.startSpeed),
      zoneTop: num(pd.strikeZoneTop) ?? 3.5,
      zoneBottom: num(pd.strikeZoneBottom) ?? 1.5,
      statcast: parsePitchStatcast(ev),
    });
  }
  return out;
}

export function mapLivePlay(play: RawLivePlay | null | undefined): MlbLivePlay | null {
  if (!play) return null;
  return {
    atBatIndex: num(play.about?.atBatIndex ?? play.atBatIndex),
    isComplete: Boolean(play.about?.isComplete),
    batterId: num(play.matchup?.batter?.id),
    pitcherId: num(play.matchup?.pitcher?.id),
    batSide: hand(play.matchup?.batSide?.code),
    pitchHand: hand(play.matchup?.pitchHand?.code),
    pitches: mapLivePitches(play),
  };
}

function samePitch(a: MlbLivePitch, b: MlbLivePitch): boolean {
  const sa = a.speed;
  const sb = b.speed;
  const speedOk = sa == null || sb == null || Math.abs(sa - sb) < 0.05;
  const typeOk = !a.pitchType || !b.pitchType || a.pitchType === b.pitchType;
  return speedOk && typeOk;
}

/**
 * Current-PA pitches from the boxscore poll (`base`) merged with the richer,
 * faster Statcast poll (`rich`) of the same feed. Same at-bat (overlapping
 * pitch numbers agree) → union by pitch number, preferring the rich pitch.
 * Different at-bat, or the rich poll shows a fresh at-bat with no pitches →
 * the rich poll wins (it refreshes more often). No rich data → base.
 */
export function mergeLivePitches(
  base: readonly MlbLivePitch[],
  rich: readonly MlbLivePitch[] | null | undefined,
): MlbLivePitch[] {
  if (!rich) return [...base];
  // Rich poll loaded and the (new) at-bat has no pitches yet.
  if (rich.length === 0) return [];
  if (base.length === 0) return [...rich];
  const richBy = new Map(rich.map((p) => [p.number, p]));
  const overlap = base.filter((p) => richBy.has(p.number));
  const sameAtBat = overlap.length > 0 && overlap.every((p) => samePitch(p, richBy.get(p.number)!));
  if (!sameAtBat) return [...rich];
  const byNum = new Map<number, MlbLivePitch>();
  for (const p of base) byNum.set(p.number, p);
  for (const p of rich) byNum.set(p.number, p);
  return [...byNum.values()].sort((a, b) => a.number - b.number);
}

/* ---------- formatting ---------- */

/** Spin axis degrees → clock tilt ("1:30"), rounded to 15 minutes. 180° = 12:00. */
export function spinAxisClock(deg: Num): string | null {
  const d = num(deg);
  if (d == null) return null;
  const totalMin = Math.round(((((d / 30 + 6) % 12) + 12) % 12) * 60 / 15) * 15;
  const h = Math.floor(totalMin / 60) % 12;
  const m = totalMin % 60;
  return `${h === 0 ? 12 : h}:${String(m).padStart(2, "0")}`;
}

/** 2462 → "2,462". */
export function formatSpinRate(rpm: Num): string | null {
  const n = num(rpm);
  if (n == null || n <= 0) return null;
  return Math.round(n).toLocaleString("en-US");
}

/** One decimal, true minus sign: -14.2 → "−14.2". */
export function formatOneDecimal(n: Num): string | null {
  const v = num(n);
  if (v == null) return null;
  const s = (Math.round(Math.abs(v) * 10) / 10).toFixed(1);
  return v < 0 && s !== "0.0" ? `\u2212${s}` : s;
}

/** Horizontal break magnitude + side for the pitcher's hand. */
export function breakSide(breakHorizontal: Num, pitchHand: "L" | "R" | null | undefined): "arm" | "glove" | null {
  const b = num(breakHorizontal);
  if (b == null || !pitchHand || Math.abs(b) < 0.5) return null;
  const toRhpArm = b > 0;
  return (pitchHand === "R") === toRhpArm ? "arm" : "glove";
}

const TRAJECTORY_LABEL: Record<string, string> = {
  ground_ball: "Ground ball",
  line_drive: "Line drive",
  fly_ball: "Fly ball",
  popup: "Pop up",
  bunt_grounder: "Bunt",
  bunt_popup: "Bunt pop up",
  bunt_line_drive: "Bunt liner",
};

export function trajectoryLabel(t: string | null | undefined): string | null {
  const k = (t ?? "").trim().toLowerCase();
  if (!k) return null;
  if (TRAJECTORY_LABEL[k]) return TRAJECTORY_LABEL[k]!;
  const words = k.replace(/[_-]+/g, " ").trim();
  return words ? words[0]!.toUpperCase() + words.slice(1) : null;
}

export function hardnessLabel(h: string | null | undefined): string | null {
  const k = (h ?? "").trim().toLowerCase();
  if (!k) return null;
  return k[0]!.toUpperCase() + k.slice(1);
}

/** 0.312 → ".312"; 1 → "1.000". */
export function formatXba(x: Num): string | null {
  const v = num(x);
  if (v == null || v < 0 || v > 1) return null;
  const s = v.toFixed(3);
  return v < 1 ? s.replace(/^0/, "") : s;
}

const PITCH_NAMES: Record<string, string> = {
  FF: "Four-Seam Fastball",
  FT: "Two-Seam Fastball",
  FA: "Fastball",
  SI: "Sinker",
  FC: "Cutter",
  SL: "Slider",
  ST: "Sweeper",
  SV: "Slurve",
  CU: "Curveball",
  KC: "Knuckle Curve",
  CS: "Slow Curve",
  CH: "Changeup",
  FS: "Splitter",
  FO: "Forkball",
  SC: "Screwball",
  KN: "Knuckleball",
  EP: "Eephus",
  PO: "Pitchout",
};

/** Full pitch-type name: feed description, else from the code. */
export function pitchTypeName(p: Pick<MlbLivePitch, "pitchType" | "pitchCode">): string | null {
  const t = (p.pitchType ?? "").trim();
  if (t && !/^[A-Z]{1,3}$/.test(t)) return t;
  const code = (p.pitchCode ?? t).trim().toUpperCase();
  return PITCH_NAMES[code] ?? (t || null);
}

export type StatChip = {
  key: string;
  label: string;
  value: string;
  unit?: string;
  sub?: string;
};

/** Pitch Statcast chips for the latest-pitch card; missing fields are omitted. */
export function statcastPitchChips(
  sc: MlbPitchStatcast | null | undefined,
  pitchHand?: "L" | "R" | null,
): StatChip[] {
  if (!sc) return [];
  const chips: StatChip[] = [];
  const spin = formatSpinRate(sc.spinRate);
  if (spin) chips.push({ key: "spin", label: "Spin", value: spin, unit: "rpm" });
  const clock = spinAxisClock(sc.spinDirection);
  if (clock) {
    chips.push({ key: "axis", label: "Spin axis", value: clock, sub: `${Math.round(sc.spinDirection!)}°` });
  }
  const ivb = formatOneDecimal(sc.breakVerticalInduced);
  if (ivb) chips.push({ key: "ivb", label: "IVB", value: ivb, unit: "in" });
  if (sc.breakHorizontal != null) {
    const side = breakSide(sc.breakHorizontal, pitchHand);
    chips.push({
      key: "hb",
      label: "H-Break",
      value: formatOneDecimal(Math.abs(sc.breakHorizontal))!,
      unit: "in",
      sub: side ? `${side} side` : undefined,
    });
  }
  const vb = formatOneDecimal(sc.breakVertical);
  if (vb) chips.push({ key: "vb", label: "V-Break", value: vb, unit: "in" });
  const ext = formatOneDecimal(sc.extension);
  if (ext) chips.push({ key: "ext", label: "Extension", value: ext, unit: "ft" });
  if (sc.release) {
    chips.push({
      key: "release",
      label: "Release",
      value: formatOneDecimal(sc.release.height)!,
      unit: "ft",
      sub: `${formatOneDecimal(sc.release.side)} ft side`,
    });
  }
  if (sc.zone != null && sc.zone >= 1 && sc.zone <= 14) {
    chips.push({
      key: "zone",
      label: "Zone",
      value: String(Math.round(sc.zone)),
      sub: sc.zone <= 9 ? "in zone" : "outside",
    });
  }
  return chips;
}

/** Batted-ball chips (exit velo, launch angle, distance…); empty without contact data. */
export function statcastHitChips(hit: MlbBattedBall | null | undefined): StatChip[] {
  if (!hit) return [];
  const chips: StatChip[] = [];
  const ev = formatOneDecimal(hit.launchSpeed);
  if (ev) chips.push({ key: "ev", label: "Exit velo", value: ev, unit: "mph" });
  if (hit.launchAngle != null) {
    chips.push({ key: "la", label: "Launch", value: `${Math.round(hit.launchAngle)}°` });
  }
  if (hit.totalDistance != null && hit.totalDistance > 0) {
    chips.push({ key: "dist", label: "Distance", value: String(Math.round(hit.totalDistance)), unit: "ft" });
  }
  const traj = trajectoryLabel(hit.trajectory);
  if (traj) chips.push({ key: "traj", label: "Trajectory", value: traj });
  const hard = hardnessLabel(hit.hardness);
  if (hard) chips.push({ key: "hard", label: "Contact", value: hard });
  const xba = formatXba(hit.xba);
  if (xba) chips.push({ key: "xba", label: "xBA", value: xba });
  return chips;
}

/** Compact per-row stat line: "2,462 rpm · IVB 16.8 · HB 15.2" (missing bits dropped). */
export function pitchRowStats(sc: MlbPitchStatcast | null | undefined): string[] {
  if (!sc) return [];
  const parts: string[] = [];
  const spin = formatSpinRate(sc.spinRate);
  if (spin) parts.push(`${spin} rpm`);
  const ivb = formatOneDecimal(sc.breakVerticalInduced);
  if (ivb) parts.push(`IVB ${ivb}\u2033`);
  if (sc.breakHorizontal != null) parts.push(`HB ${formatOneDecimal(Math.abs(sc.breakHorizontal))}\u2033`);
  return parts;
}
