/**
 * Sports-only MLB play-by-play mapping.
 *
 * Reads the Stats API live feed (already used by the game page boxscore) and
 * batter hot/cold zones. Does not touch ESPN summary hosts the newspaper uses,
 * RUWT heat ranking, or sports-finals Telegram cards.
 */

const MLB = "https://statsapi.mlb.com/api/v1";
const MLB_LIVE = "https://statsapi.mlb.com/api/v1.1";

/** Savant/MLB spray-chart home plate (feet-ish units, Y down toward the plate). */
export const SPRAY_HOME = { x: 125.42, y: 198.27 };
/** Empirically ~2.5 ft per spray unit (336 ft LF fly ≈ 135 units from home). */
export const SPRAY_FEET_PER_UNIT = 2.495;

export type MlbPbpPitchCall = "B" | "S" | "X" | "O";

export type MlbPbpPitch = {
  number: number;
  call: MlbPbpPitchCall;
  callLabel: string;
  pitchType: string | null;
  pitchCode: string | null;
  speed: number | null;
  pX: number | null;
  pZ: number | null;
};

export type MlbPbpHit = {
  coordX: number;
  coordY: number;
  launchSpeed: number | null;
  launchAngle: number | null;
  totalDistance: number | null;
  trajectory: string | null;
};

export type MlbPbpPerson = {
  id: number;
  name: string;
  shortName: string;
  teamId: number | null;
};

export type MlbPbpRunner = {
  id: number;
  name: string;
  shortName: string;
  base: 1 | 2 | 3;
};

export type MlbPbpPlay = {
  atBatIndex: number;
  event: string | null;
  eventType: string | null;
  description: string | null;
  isComplete: boolean;
  isInPlay: boolean;
  batter: MlbPbpPerson | null;
  pitcher: MlbPbpPerson | null;
  batSide: "L" | "R" | "S" | null;
  pitches: MlbPbpPitch[];
  hit: MlbPbpHit | null;
  balls: number;
  strikes: number;
  outs: number;
  inning: number;
  half: "top" | "bottom";
};

export type MlbPbpSide = {
  teamId: number;
  abbrev: string;
  name: string;
  runs: number;
  hits: number;
  errors: number;
};

export type MlbPbpState = {
  gamePk: number;
  live: boolean;
  final: boolean;
  inningLabel: string;
  balls: number;
  strikes: number;
  outs: number;
  runners: MlbPbpRunner[];
  current: MlbPbpPlay | null;
  lastComplete: MlbPbpPlay | null;
  away: MlbPbpSide;
  home: MlbPbpSide;
  innings: { num: number; away: number | null; home: number | null }[];
};

export type MlbHeatTemp = "hot" | "warm" | "lukewarm" | "cool" | "cold";

export type MlbHeatZoneCell = {
  zone: string;
  value: string;
  temp: MlbHeatTemp;
};

export type MlbPbpView = "batter" | "play";

export type FieldPoint = { x: number; y: number };

/** SVG viewBox for the 2D diamond (home at bottom). */
export const FIELD_VB = { w: 320, h: 300 };
export const FIELD_HOME: FieldPoint = { x: 160, y: 258 };

type LivePerson = { id?: number; fullName?: string; lastName?: string };
type LivePitchEvent = {
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
    startSpeed?: number;
    coordinates?: { pX?: number; pZ?: number };
  };
  hitData?: {
    launchSpeed?: number;
    launchAngle?: number;
    totalDistance?: number;
    trajectory?: string;
    coordinates?: { coordX?: number; coordY?: number };
  };
};

type LivePlayRaw = {
  atBatIndex?: number;
  result?: {
    event?: string;
    eventType?: string;
    description?: string;
  };
  about?: {
    atBatIndex?: number;
    inning?: number;
    halfInning?: string;
    isComplete?: boolean;
  };
  count?: { balls?: number; strikes?: number; outs?: number };
  matchup?: {
    batter?: LivePerson;
    pitcher?: LivePerson;
    batSide?: { code?: string };
  };
  playEvents?: LivePitchEvent[];
};

export type MlbLiveFeedRaw = {
  gamePk?: number;
  gameData?: {
    status?: { detailedState?: string; abstractGameState?: string };
    teams?: {
      away?: { id?: number; name?: string; abbreviation?: string };
      home?: { id?: number; name?: string; abbreviation?: string };
    };
  };
  liveData?: {
    linescore?: {
      currentInningOrdinal?: string;
      inningState?: string;
      balls?: number;
      strikes?: number;
      outs?: number;
      innings?: { num?: number; away?: { runs?: number }; home?: { runs?: number } }[];
      teams?: {
        away?: { runs?: number; hits?: number; errors?: number };
        home?: { runs?: number; hits?: number; errors?: number };
      };
      offense?: {
        batter?: LivePerson;
        first?: LivePerson | null;
        second?: LivePerson | null;
        third?: LivePerson | null;
      };
    };
    plays?: {
      currentPlay?: LivePlayRaw;
      allPlays?: LivePlayRaw[];
    };
  };
};

const NAME_SUFFIX = /^(jr|sr|ii|iii|iv|v)\.?$/i;

export function shortPbpName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return fullName;
  let last = parts[parts.length - 1]!;
  let used = 1;
  if (NAME_SUFFIX.test(last) && parts.length >= 3) {
    last = `${parts[parts.length - 2]} ${last}`;
    used = 2;
  }
  const first = parts[0]!;
  if (parts.length - used < 1) return fullName;
  return `${first[0]!.toUpperCase()}. ${last}`;
}

function person(raw: LivePerson | null | undefined, teamId: number | null = null): MlbPbpPerson | null {
  if (!raw || raw.id == null) return null;
  const name = raw.fullName || raw.lastName || "Player";
  return { id: raw.id, name, shortName: shortPbpName(name), teamId };
}

export function pitchCallKind(ev: LivePitchEvent): MlbPbpPitchCall {
  const code = (ev.details?.call?.code ?? "").toUpperCase();
  if (code === "B" || ev.details?.isBall) return "B";
  if (code === "X" || ev.details?.isInPlay) return "X";
  if (
    code === "S" ||
    code === "C" ||
    code === "F" ||
    code === "T" ||
    code === "W" ||
    code === "M" ||
    ev.details?.isStrike
  ) {
    return "S";
  }
  return "O";
}

export function mapPlayPitches(play: LivePlayRaw | null | undefined): MlbPbpPitch[] {
  const out: MlbPbpPitch[] = [];
  for (const ev of play?.playEvents ?? []) {
    if (!ev?.isPitch) continue;
    const coords = ev.pitchData?.coordinates;
    out.push({
      number: Number(ev.pitchNumber ?? out.length + 1),
      call: pitchCallKind(ev),
      callLabel: ev.details?.call?.description || ev.details?.description || "Pitch",
      pitchType: ev.details?.type?.description ?? null,
      pitchCode: ev.details?.type?.code ?? null,
      speed: ev.pitchData?.startSpeed ?? null,
      pX: coords?.pX ?? null,
      pZ: coords?.pZ ?? null,
    });
  }
  return out;
}

export function mapPlayHit(play: LivePlayRaw | null | undefined): MlbPbpHit | null {
  for (const ev of [...(play?.playEvents ?? [])].reverse()) {
    const hd = ev.hitData;
    const x = hd?.coordinates?.coordX;
    const y = hd?.coordinates?.coordY;
    if (!hd || x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    return {
      coordX: x,
      coordY: y,
      launchSpeed: hd.launchSpeed ?? null,
      launchAngle: hd.launchAngle ?? null,
      totalDistance: hd.totalDistance ?? null,
      trajectory: hd.trajectory ?? null,
    };
  }
  return null;
}

function mapPlay(raw: LivePlayRaw | null | undefined, batterTeamId: number | null): MlbPbpPlay | null {
  if (!raw) return null;
  const half = (raw.about?.halfInning ?? "top").toLowerCase() === "bottom" ? "bottom" : "top";
  const hit = mapPlayHit(raw);
  const pitches = mapPlayPitches(raw);
  return {
    atBatIndex: raw.about?.atBatIndex ?? raw.atBatIndex ?? -1,
    event: raw.result?.event ?? null,
    eventType: raw.result?.eventType ?? null,
    description: raw.result?.description ?? null,
    isComplete: Boolean(raw.about?.isComplete),
    isInPlay: Boolean(hit) || pitches.some((p) => p.call === "X"),
    batter: person(raw.matchup?.batter, batterTeamId),
    pitcher: person(raw.matchup?.pitcher),
    batSide: normalizeBatSide(raw.matchup?.batSide?.code),
    pitches,
    hit,
    balls: Number(raw.count?.balls ?? 0),
    strikes: Number(raw.count?.strikes ?? 0),
    outs: Number(raw.count?.outs ?? 0),
    inning: Number(raw.about?.inning ?? 0),
    half,
  };
}

function normalizeBatSide(code: string | null | undefined): "L" | "R" | "S" | null {
  const c = (code ?? "").toUpperCase();
  if (c === "L" || c === "R" || c === "S") return c;
  return null;
}

function mapSide(
  team: { id?: number; name?: string; abbreviation?: string } | undefined,
  ls: { runs?: number; hits?: number; errors?: number } | undefined,
): MlbPbpSide {
  return {
    teamId: team?.id ?? 0,
    abbrev: team?.abbreviation ?? "—",
    name: team?.name ?? "—",
    runs: Number(ls?.runs ?? 0),
    hits: Number(ls?.hits ?? 0),
    errors: Number(ls?.errors ?? 0),
  };
}

export function mapLiveFeedToPbp(raw: MlbLiveFeedRaw | null | undefined): MlbPbpState | null {
  if (!raw) return null;
  const status = raw.gameData?.status?.detailedState ?? "";
  const abstract = raw.gameData?.status?.abstractGameState ?? "";
  const live = abstract === "Live" || /in progress|manager challenge|delayed/i.test(status);
  const final = abstract === "Final" || /^final/i.test(status);
  const ls = raw.liveData?.linescore;
  const plays = raw.liveData?.plays;
  const all = plays?.allPlays ?? [];
  const away = mapSide(raw.gameData?.teams?.away, ls?.teams?.away);
  const home = mapSide(raw.gameData?.teams?.home, ls?.teams?.home);
  const currentRaw = plays?.currentPlay ?? all[all.length - 1] ?? null;
  const currentHalf = (currentRaw?.about?.halfInning ?? "top").toLowerCase() === "bottom" ? "bottom" : "top";
  const currentBatterTeam = currentHalf === "top" ? away.teamId : home.teamId;

  const current = mapPlay(currentRaw, currentBatterTeam);
  let lastComplete: MlbPbpPlay | null = null;
  for (let i = all.length - 1; i >= 0; i--) {
    const p = all[i]!;
    if (!p.about?.isComplete) continue;
    const half = (p.about.halfInning ?? "top").toLowerCase() === "bottom" ? "bottom" : "top";
    lastComplete = mapPlay(p, half === "top" ? away.teamId : home.teamId);
    break;
  }

  const runners: MlbPbpRunner[] = [];
  const bags: Array<readonly [1 | 2 | 3, LivePerson | null | undefined]> = [
    [1, ls?.offense?.first],
    [2, ls?.offense?.second],
    [3, ls?.offense?.third],
  ];
  for (const [base, who] of bags) {
    if (!who || who.id == null) continue;
    const name = who.fullName || who.lastName || "Runner";
    runners.push({ id: who.id, name, shortName: shortPbpName(name), base });
  }

  const inn =
    `${ls?.inningState ?? ""} ${ls?.currentInningOrdinal ?? ""}`.trim() ||
    (live ? "Live" : final ? "Final" : status);

  return {
    gamePk: raw.gamePk ?? 0,
    live,
    final,
    inningLabel: inn,
    balls: Number(ls?.balls ?? current?.balls ?? 0),
    strikes: Number(ls?.strikes ?? current?.strikes ?? 0),
    outs: Number(ls?.outs ?? current?.outs ?? 0),
    runners,
    current,
    lastComplete,
    away,
    home,
    innings: (ls?.innings ?? []).map((i) => ({
      num: i.num ?? 0,
      away: i.away?.runs ?? null,
      home: i.home?.runs ?? null,
    })),
  };
}

/**
 * Batter heat while a PA is underway; play result (field) after the PA ends
 * or before the next pitch of the following batter.
 */
/**
 * LAST PLAY spray/trajectory is hidden until landing matches the play
 * description (Josh: a flyout must not plot as a short infield path).
 */
export function shouldRenderPbpFieldMap(_play: MlbPbpPlay | null | undefined): boolean {
  return false;
}

export function resolvePbpView(state: MlbPbpState | null, prefer?: MlbPbpView | null): MlbPbpView {
  if (prefer === "batter" || prefer === "play") return prefer;
  if (!state) return "batter";
  const cur = state.current;
  const last = state.lastComplete;
  if (cur && !cur.isComplete && cur.pitches.length > 0) return "batter";
  if (last && (cur == null || cur.isComplete || cur.pitches.length === 0)) return "play";
  if (cur && !cur.isComplete) return "batter";
  if (last) return "play";
  return "batter";
}

export function playHeadline(play: MlbPbpPlay | null, view: MlbPbpView): string {
  if (view === "batter") return "NOW AT BAT";
  const ev = play?.event?.trim();
  return ev || "PLAY";
}

const PITCH_SHORT: Record<string, string> = {
  FF: "FOUR-SEAM FB",
  FA: "FOUR-SEAM FB",
  FT: "TWO-SEAM FB",
  SI: "SINKER",
  FC: "CUTTER",
  SL: "SLIDER",
  ST: "SWEEPER",
  SV: "SLURVE",
  CU: "CURVEBALL",
  KC: "KNuckle-CRV",
  CH: "CHANGEUP",
  FS: "SPLITTER",
  FO: "FORKBALL",
  KN: "KNUCKLE",
  EP: "EEPHUS",
};

export function pitchTypeLabel(pitch: MlbPbpPitch): string {
  if (pitch.pitchCode && PITCH_SHORT[pitch.pitchCode.toUpperCase()]) {
    return PITCH_SHORT[pitch.pitchCode.toUpperCase()]!;
  }
  const raw = (pitch.pitchType ?? "").trim();
  if (!raw) return "PITCH";
  return raw
    .replace(/four[- ]seam fastball/i, "FOUR-SEAM FB")
    .replace(/two[- ]seam fastball/i, "TWO-SEAM FB")
    .replace(/fastball/i, "FASTBALL")
    .toUpperCase();
}

export function pitchCallShort(pitch: MlbPbpPitch): string {
  const kind = pitchChipKind(pitch.call);
  if (kind === "inplay") return "IN PLAY";
  const label = (pitch.callLabel || "").toLowerCase();
  if (/foul/.test(label)) return "FOUL";
  if (/called strike/.test(label)) return "CALLED STRIKE";
  if (/swinging/.test(label)) return "SWINGING";
  if (/ball/.test(label)) return "BALL";
  if (/hit by pitch/.test(label)) return "HBP";
  return (pitch.callLabel || "PITCH").toUpperCase();
}

export function pitchChipKind(call: MlbPbpPitchCall): "ball" | "strike" | "inplay" | "other" {
  if (call === "B") return "ball";
  if (call === "X") return "inplay";
  if (call === "S") return "strike";
  return "other";
}

/** Catcher's-view 3×3 (zones 01–09). Outer zones 11–14 are omitted in the MVP grid. */
export const HEAT_ZONE_ORDER = ["01", "02", "03", "04", "05", "06", "07", "08", "09"] as const;

export function normalizeHeatTemp(raw: string | null | undefined): MlbHeatTemp {
  const t = (raw ?? "").toLowerCase();
  if (t === "hot" || t === "warm" || t === "lukewarm" || t === "cool" || t === "cold") return t;
  return "lukewarm";
}

export function formatHeatValue(raw: string | null | undefined): string {
  if (raw == null || raw === "" || raw === "—") return "—";
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0 && n <= 1) return n.toFixed(3).replace(/^0/, "");
  return String(raw);
}

export function heatZoneGrid(cells: MlbHeatZoneCell[] | null | undefined): MlbHeatZoneCell[] {
  const byZone = new Map((cells ?? []).map((c) => [c.zone.replace(/^0/, "").padStart(2, "0"), c]));
  return HEAT_ZONE_ORDER.map((zone) => {
    const hit = byZone.get(zone);
    return {
      zone,
      value: formatHeatValue(hit?.value),
      temp: hit ? normalizeHeatTemp(hit.temp) : "lukewarm",
    };
  });
}

export function sprayToFeet(coordX: number, coordY: number): { x: number; y: number } {
  return {
    x: (coordX - SPRAY_HOME.x) * SPRAY_FEET_PER_UNIT,
    y: (SPRAY_HOME.y - coordY) * SPRAY_FEET_PER_UNIT,
  };
}

/**
 * Map spray-chart coords onto the isometric SVG field.
 * +X is first-base / RF, +Y is toward center field.
 */
export function mapSprayToField(coordX: number, coordY: number): FieldPoint {
  const ft = sprayToFeet(coordX, coordY);
  const scaleX = 0.52;
  const scaleY = 0.46;
  return {
    x: FIELD_HOME.x + ft.x * scaleX,
    y: FIELD_HOME.y - ft.y * scaleY,
  };
}

export function clampFieldPoint(pt: FieldPoint): FieldPoint {
  return {
    x: Math.max(18, Math.min(FIELD_VB.w - 18, pt.x)),
    y: Math.max(16, Math.min(FIELD_VB.h - 12, pt.y)),
  };
}

/** Arc height in SVG units from launch angle / trajectory. */
export function flightArcHeight(hit: MlbPbpHit | null): number {
  if (!hit) return 28;
  const traj = (hit.trajectory ?? "").toLowerCase();
  if (traj === "ground_ball") return 8;
  if (traj === "line_drive") return 22;
  if (traj === "popup") return 72;
  const ang = hit.launchAngle;
  if (ang == null) return traj === "fly_ball" ? 48 : 28;
  if (ang < 0) return 6;
  if (ang < 15) return 16;
  if (ang < 30) return 34;
  if (ang < 50) return 52;
  return 70;
}

export function flightPathD(from: FieldPoint, to: FieldPoint, arc: number): string {
  const mx = (from.x + to.x) / 2;
  const my = Math.min(from.y, to.y) - arc;
  return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
}

async function mlbJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`MLB ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchMlbPlayByPlay(gamePk: number | string): Promise<MlbPbpState | null> {
  const pk = encodeURIComponent(String(gamePk));
  const raw = await mlbJson<MlbLiveFeedRaw>(`${MLB_LIVE}/game/${pk}/feed/live`);
  return mapLiveFeedToPbp(raw);
}

type HotColdSplit = {
  stat?: {
    name?: string;
    zones?: { zone?: string; temp?: string; value?: string }[];
  };
};

export async function fetchMlbBatterHeatZones(
  batterId: number,
  season = new Date().getFullYear(),
): Promise<MlbHeatZoneCell[]> {
  const url =
    `${MLB}/people/${batterId}/stats?stats=hotColdZones&group=hitting&season=${season}`;
  const raw = await mlbJson<{ stats?: { splits?: HotColdSplit[] }[] }>(url);
  const splits = raw.stats?.[0]?.splits ?? [];
  const avg =
    splits.find((s) => (s.stat?.name ?? "").toLowerCase() === "battingaverage") ??
    splits.find((s) => (s.stat?.name ?? "").toLowerCase() === "onbaseplusslugging");
  const cells: MlbHeatZoneCell[] = [];
  for (const z of avg?.stat?.zones ?? []) {
    const zone = String(z.zone ?? "").padStart(2, "0");
    if (!zone) continue;
    cells.push({
      zone,
      value: String(z.value ?? "—"),
      temp: normalizeHeatTemp(z.temp),
    });
  }
  return cells;
}

export function batterGameLine(
  boxBatters: { id: number; h: number; ab: number }[] | undefined,
  batterId: number | null | undefined,
): string | null {
  if (batterId == null || !boxBatters?.length) return null;
  const row = boxBatters.find((b) => b.id === batterId);
  if (!row) return null;
  return `${row.h}-${row.ab}`;
}
