/**
 * Estimated forward lines and defense pairs for the NHL box score.
 *
 * Neither ESPN nor NHL publish in-game line combinations, so we infer them from
 * NHL shift charts: every stretch of 5v5 play where a team has exactly three
 * forwards and two defensemen on the ice credits that trio / pair with the
 * shared seconds, and the most-used non-overlapping combos become the lines.
 * Without shift data (pregame, API gaps) skaters are chunked by time on ice.
 */

import { canonNhlAbbrev, nhlWebJson, type NhlBoxRow } from "./nhl";

/** Jersey numbers per unit, best-used first. */
export type NhlShiftLines = { forwards: string[][]; defense: string[][] };

export type NhlSkaterUnit = {
  key: string;
  label: string;
  kind: "forwards" | "defense" | "extras";
  rows: NhlBoxRow[];
};

export type NhlLineSource = "shifts" | "toi";

type ShiftRow = {
  playerId?: number;
  teamAbbrev?: string;
  period?: number;
  startTime?: string;
  endTime?: string;
  typeCode?: number;
};

type BoxscorePlayer = { playerId?: number; sweaterNumber?: number; position?: string };
type BoxscoreSide = { forwards?: BoxscorePlayer[]; defense?: BoxscorePlayer[]; goalies?: BoxscorePlayer[] };
type BoxscoreJson = {
  awayTeam?: { abbrev?: string };
  homeTeam?: { abbrev?: string };
  playerByGameStats?: { awayTeam?: BoxscoreSide; homeTeam?: BoxscoreSide };
};

const SHIFT_TYPE = 517;
const MAX_FORWARD_LINES = 4;
const MAX_DEFENSE_PAIRS = 3;
const MIN_SHARED_SEC = 20;

function clockSec(raw: string | undefined): number | null {
  const [m, s] = (raw ?? "").split(":").map(Number);
  return Number.isFinite(m) && Number.isFinite(s) ? m! * 60 + s! : null;
}

type Shift = { pid: number; team: string; start: number; end: number };

function pickCombos(time: Map<string, number>, size: number, max: number): number[][] {
  const used = new Set<number>();
  const out: number[][] = [];
  for (const [key, sec] of [...time].sort((a, b) => b[1] - a[1])) {
    if (out.length >= max || sec < MIN_SHARED_SEC) break;
    const ids = key.split(",").map(Number);
    if (ids.length !== size || ids.some((id) => used.has(id))) continue;
    ids.forEach((id) => used.add(id));
    out.push(ids);
  }
  return out;
}

/** Keyed by ESPN-style team abbrev (LA, NJ, SJ, TB). Null when shift charts aren't published yet. */
export async function fetchNhlShiftLines(nhlGameId: number): Promise<Record<string, NhlShiftLines> | null> {
  const [shiftsRaw, box] = await Promise.all([
    nhlWebJson<{ data?: ShiftRow[] }>(`stats/shiftcharts/${nhlGameId}`),
    nhlWebJson<BoxscoreJson>(`v1/gamecenter/${nhlGameId}/boxscore`),
  ]);

  const role = new Map<number, { team: string; pos: "F" | "D" | "G"; jersey: string }>();
  const sides: [string, BoxscoreSide | undefined][] = [
    [canonNhlAbbrev(box.awayTeam?.abbrev), box.playerByGameStats?.awayTeam],
    [canonNhlAbbrev(box.homeTeam?.abbrev), box.playerByGameStats?.homeTeam],
  ];
  for (const [team, side] of sides) {
    const add = (list: BoxscorePlayer[] | undefined, pos: "F" | "D" | "G") => {
      for (const p of list ?? []) {
        if (p.playerId && p.sweaterNumber != null) {
          role.set(p.playerId, { team, pos, jersey: String(p.sweaterNumber) });
        }
      }
    };
    add(side?.forwards, "F");
    add(side?.defense, "D");
    add(side?.goalies, "G");
  }

  const byPeriod = new Map<number, Shift[]>();
  for (const s of shiftsRaw.data ?? []) {
    if (s.typeCode !== SHIFT_TYPE || !s.playerId || !s.period) continue;
    const start = clockSec(s.startTime);
    const end = clockSec(s.endTime);
    if (start == null || end == null || end <= start || !role.has(s.playerId)) continue;
    const list = byPeriod.get(s.period) ?? [];
    list.push({ pid: s.playerId, team: canonNhlAbbrev(s.teamAbbrev), start, end });
    byPeriod.set(s.period, list);
  }
  if (!byPeriod.size) return null;

  const teams = sides.map(([t]) => t);
  const trioTime = new Map(teams.map((t) => [t, new Map<string, number>()]));
  const pairTime = new Map(teams.map((t) => [t, new Map<string, number>()]));
  const bump = (m: Map<string, number>, ids: number[], sec: number) => {
    const key = [...ids].sort((a, b) => a - b).join(",");
    m.set(key, (m.get(key) ?? 0) + sec);
  };

  for (const shifts of byPeriod.values()) {
    const marks = [...new Set(shifts.flatMap((s) => [s.start, s.end]))].sort((a, b) => a - b);
    for (let i = 0; i < marks.length - 1; i++) {
      const from = marks[i]!;
      const to = marks[i + 1]!;
      const on = shifts.filter((s) => s.start <= from && s.end >= to);
      const units = teams.map((team) => {
        const mine = on.filter((s) => s.team === team);
        return {
          team,
          f: mine.filter((s) => role.get(s.pid)?.pos === "F").map((s) => s.pid),
          d: mine.filter((s) => role.get(s.pid)?.pos === "D").map((s) => s.pid),
        };
      });
      if (!units.every((u) => u.f.length + u.d.length === 5)) continue;
      for (const u of units) {
        if (u.f.length !== 3 || u.d.length !== 2) continue;
        bump(trioTime.get(u.team)!, u.f, to - from);
        bump(pairTime.get(u.team)!, u.d, to - from);
      }
    }
  }

  const jersey = (id: number) => role.get(id)!.jersey;
  const out: Record<string, NhlShiftLines> = {};
  for (const team of teams) {
    out[team] = {
      forwards: pickCombos(trioTime.get(team)!, 3, MAX_FORWARD_LINES).map((ids) => ids.map(jersey)),
      defense: pickCombos(pairTime.get(team)!, 2, MAX_DEFENSE_PAIRS).map((ids) => ids.map(jersey)),
    };
  }
  return out;
}

const WING_ORDER: Record<string, number> = { LW: 0, L: 0, C: 1, RW: 2, R: 2 };

/** LW · C · RW reading order, the center in the middle even when ESPN lists two Cs. */
function orderTrio(rows: NhlBoxRow[]): NhlBoxRow[] {
  const sorted = [...rows].sort(
    (a, b) => (WING_ORDER[a.position ?? ""] ?? 1) - (WING_ORDER[b.position ?? ""] ?? 1) || b.toiSec - a.toiSec,
  );
  const center = sorted.find((r) => r.position === "C");
  if (!center || sorted.length !== 3) return sorted;
  const wings = sorted.filter((r) => r !== center);
  return [wings[0]!, center, wings[1]!];
}

function unitToi(rows: NhlBoxRow[]): number {
  return rows.reduce((sum, r) => sum + r.toiSec, 0);
}

function buildUnits(
  rows: NhlBoxRow[],
  shiftUnits: string[][] | undefined,
  size: number,
  max: number,
): { units: NhlBoxRow[][]; extras: NhlBoxRow[] } {
  const byJersey = new Map(rows.filter((r) => r.jersey).map((r) => [r.jersey!, r]));
  const used = new Set<string>();
  const units: NhlBoxRow[][] = [];
  for (const jerseys of shiftUnits ?? []) {
    const unit = jerseys.map((j) => byJersey.get(j)).filter((r): r is NhlBoxRow => Boolean(r));
    if (unit.length !== jerseys.length || unit.some((r) => used.has(r.id))) continue;
    unit.forEach((r) => used.add(r.id));
    units.push(unit);
  }
  const rest = rows.filter((r) => !used.has(r.id)).sort((a, b) => b.toiSec - a.toiSec);
  while (units.length < max && rest.length) units.push(rest.splice(0, size));
  return { units: units.sort((a, b) => unitToi(b) - unitToi(a)), extras: rest };
}

/** Lines 1–4 then D pairs 1–3; anyone left over (13th forward, scratches with TOI) lands in Extras. */
export function groupNhlSkaters(
  forwards: NhlBoxRow[],
  defense: NhlBoxRow[],
  shiftLines: NhlShiftLines | null | undefined,
): { units: NhlSkaterUnit[]; source: NhlLineSource } {
  const f = buildUnits(forwards, shiftLines?.forwards, 3, MAX_FORWARD_LINES);
  const d = buildUnits(defense, shiftLines?.defense, 2, MAX_DEFENSE_PAIRS);
  const units: NhlSkaterUnit[] = [
    ...f.units.map((rows, i) => ({
      key: `f${i}`,
      label: `Line ${i + 1}`,
      kind: "forwards" as const,
      rows: orderTrio(rows),
    })),
    ...d.units.map((rows, i) => ({
      key: `d${i}`,
      label: `Pair ${i + 1}`,
      kind: "defense" as const,
      rows: [...rows].sort((a, b) => b.toiSec - a.toiSec),
    })),
  ];
  const extras = [...f.extras, ...d.extras];
  if (extras.length) units.push({ key: "x", label: "Extras", kind: "extras", rows: extras });
  const fromShifts = Boolean(shiftLines?.forwards.length || shiftLines?.defense.length);
  return { units, source: fromShifts ? "shifts" : "toi" };
}
