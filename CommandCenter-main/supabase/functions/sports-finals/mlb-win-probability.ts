/**
 * Baseball win-probability join for sports-finals.
 *
 * ESPN ships `winprobability` for MLB (playId + homeWinPercentage). Plays have
 * `period.number` + `period.type` Top/Bottom and no football clock, so the
 * shared 15:00-quarter mapper must not be reused here.
 *
 * X-axis unit is a half-inning. Regulation is 18 halves (Top 1 … Bot 9).
 * Extra innings extend the domain. Percentages are ESPN's; only the time
 * coordinate is derived from inning/half + sequence inside that half.
 */
import { espnRateToPct, type CfbWinProbPoint } from "./win-probability.ts";

export const MLB_REGULATION_HALVES = 18;

export type MlbWinProbPlayRef = {
  id: string;
  inning: number | null;
  half: "top" | "bottom" | null;
};

type EspnWinProbRow = {
  homeWinPercentage?: number;
  tiePercentage?: number;
  playId?: string;
};

type Rec = Record<string, unknown>;

function rec(value: unknown): Rec {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Rec) : {};
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

export function parseMlbHalf(period: unknown, display?: string | null): {
  inning: number | null;
  half: "top" | "bottom" | null;
} {
  const obj = rec(period);
  const inning = num(obj.number) ?? (typeof period === "number" ? period : null);
  const type = str(obj.type).toLowerCase();
  const text = `${type} ${display ?? ""} ${str(obj.displayValue)}`.toLowerCase();
  const half = /bottom|bot\b/.test(text) ? "bottom" : /top/.test(text) ? "top" : null;
  return { inning: inning != null && inning >= 1 ? inning : null, half };
}

export function mlbPlayRefs(raw: unknown): MlbWinProbPlayRef[] {
  const body = rec(raw);
  const list = Array.isArray(body.plays) ? body.plays : arr(rec(body.plays).items);
  const refs: MlbWinProbPlayRef[] = [];
  for (const play of list) {
    const row = rec(play);
    const id = str(row.id);
    if (!id) continue;
    const parsed = parseMlbHalf(row.period, str(row.text));
    refs.push({ id, inning: parsed.inning, half: parsed.half });
  }
  return refs;
}

export function mlbHalfIndex(inning: number, half: "top" | "bottom" | null): number {
  return (inning - 1) * 2 + (half === "bottom" ? 1 : 0);
}

function assignMlbElapsed(
  drafts: { inning: number | null; half: "top" | "bottom" | null }[],
): number[] {
  const n = drafts.length;
  const out: (number | null)[] = Array.from({ length: n }, () => null);
  const groups = new Map<number, number[]>();
  drafts.forEach((d, i) => {
    if (d.inning == null) return;
    const idx = mlbHalfIndex(d.inning, d.half);
    const bucket = groups.get(idx) ?? [];
    bucket.push(i);
    groups.set(idx, bucket);
  });
  for (const [halfIdx, ids] of groups) {
    ids.forEach((i, k) => {
      out[i] = halfIdx + (k + 0.5) / ids.length;
    });
  }
  let i = 0;
  while (i < n) {
    if (out[i] != null) {
      i += 1;
      continue;
    }
    const start = i;
    while (i < n && out[i] == null) i += 1;
    const slots = i - start;
    const left = start > 0 && out[start - 1] != null ? out[start - 1]! : 0;
    const right = i < n && out[i] != null ? out[i]! : Math.max(left, MLB_REGULATION_HALVES);
    for (let k = 0; k < slots; k++) {
      out[start + k] = left + ((k + 1) * (right - left)) / (slots + 1);
    }
  }
  const nums = out.map((t, idx) =>
    t == null ? (n === 1 ? 0 : (idx / Math.max(1, n - 1)) * MLB_REGULATION_HALVES) : t,
  );
  for (let j = 1; j < nums.length; j++) {
    if (nums[j]! < nums[j - 1]!) nums[j] = nums[j - 1]!;
  }
  return nums;
}

/**
 * Join ESPN's baseball `winprobability` array to play innings.
 * Series order is kept. Inning/half come from the play; the percentages
 * themselves are never invented.
 */
export function mapMlbWinProbability(
  series: EspnWinProbRow[] | null | undefined,
  plays: MlbWinProbPlayRef[] | null | undefined,
): CfbWinProbPoint[] {
  if (!series?.length) return [];
  const byId = new Map((plays ?? []).map((p) => [String(p.id), p]));
  const drafts: {
    playId: string;
    homeWinPct: number;
    tiePct: number;
    inning: number | null;
    half: "top" | "bottom" | null;
  }[] = [];
  series.forEach((row, index) => {
    const home = espnRateToPct(row.homeWinPercentage);
    if (home == null) return;
    const playId = row.playId != null && String(row.playId) ? String(row.playId) : `play-${index}`;
    const play = byId.get(playId);
    drafts.push({
      playId,
      homeWinPct: home,
      tiePct: espnRateToPct(row.tiePercentage) ?? 0,
      inning: play?.inning ?? null,
      half: play?.half ?? null,
    });
  });
  if (!drafts.length) return [];
  const elapsed = assignMlbElapsed(drafts);
  return drafts.map((d, i) => ({
    playId: d.playId,
    homeWinPct: d.homeWinPct,
    tiePct: d.tiePct,
    elapsedSec: elapsed[i] ?? 0,
    period: d.inning,
  }));
}

export function mlbWinProbDomain(points: CfbWinProbPoint[]): number {
  const maxT = points.reduce((m, p) => Math.max(m, p.elapsedSec), 0);
  return Math.max(MLB_REGULATION_HALVES, maxT);
}

export function mlbInningTicks(domain: number): number[] {
  const ticks: number[] = [];
  for (let half = 2; half < domain; half += 2) ticks.push(half);
  return ticks;
}

export function mlbInningLabels(domain: number): { at: number; label: string }[] {
  const labels: { at: number; label: string }[] = [];
  const regulation = Math.min(9, Math.floor(domain / 2));
  for (let inn = 1; inn <= regulation; inn++) {
    labels.push({ at: (inn - 1) * 2 + 1, label: String(inn) });
  }
  if (domain > MLB_REGULATION_HALVES + 0.05) {
    labels.push({ at: (MLB_REGULATION_HALVES + domain) / 2, label: "EX" });
  }
  return labels;
}
