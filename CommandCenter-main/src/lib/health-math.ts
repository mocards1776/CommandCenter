/**
 * Health day math, targets, weight trend, and Withings CSV parsing.
 * Pure module — safe to run under node --experimental-strip-types.
 */

export const HEALTH_TZ = "America/Chicago";

/** Daily calorie band and protein target. */
export const KCAL_TARGET_LOW = 1850;
export const KCAL_TARGET_HIGH = 1900;
export const PROTEIN_TARGET_G = 150;

/** Goal line passes through this weight on this Chicago day, then −1 lb/week. */
export const GOAL_ANCHOR_DAY = "2026-10-14";
export const GOAL_ANCHOR_LB = 175;
export const GOAL_LB_PER_WEEK = 1;

export type FoodTotals = {
  kcal: number;
  protein: number;
};

export type CalorieBudget = {
  eaten: number;
  /** Signed room under the top of the band. Negative means over 1,900. */
  leftToHigh: number;
  /** Signed room under the floor. Negative means already past 1,850. */
  leftToLow: number;
  overHigh: number;
  inBand: boolean;
};

export type WeightSample = {
  day: string;
  lb: number;
};

export type WithingsRow = {
  day: string;
  weightLb: number;
  fat: number | null;
  bone: number | null;
  muscle: number | null;
  hydration: number | null;
};

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function foodTotals(rows: { kcal: number; protein_g: number }[]): FoodTotals {
  let kcal = 0;
  let protein = 0;
  for (const row of rows) {
    kcal += Number(row.kcal) || 0;
    protein += Number(row.protein_g) || 0;
  }
  return { kcal: round1(kcal), protein: round1(protein) };
}

export function calorieBudget(eaten: number): CalorieBudget {
  const leftToHigh = round1(KCAL_TARGET_HIGH - eaten);
  const leftToLow = round1(KCAL_TARGET_LOW - eaten);
  return {
    eaten: round1(eaten),
    leftToHigh,
    leftToLow,
    overHigh: round1(Math.max(0, eaten - KCAL_TARGET_HIGH)),
    inBand: eaten >= KCAL_TARGET_LOW && eaten <= KCAL_TARGET_HIGH,
  };
}

export function proteinLeft(eaten: number): number {
  return round1(PROTEIN_TARGET_G - eaten);
}

/** Whole days from `fromDay` to `toDay` (YYYY-MM-DD). Negative when `toDay` is earlier. */
export function daysBetween(fromDay: string, toDay: string): number {
  const a = Date.parse(`${fromDay}T00:00:00Z`);
  const b = Date.parse(`${toDay}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/**
 * 1 lb/week loss anchored at 175 lb on 2026-10-14.
 * Days before the anchor sit above 175; days after sit below.
 */
export function goalWeightLb(day: string): number {
  const days = daysBetween(GOAL_ANCHOR_DAY, day);
  return round1(GOAL_ANCHOR_LB - (days / 7) * GOAL_LB_PER_WEEK);
}

/**
 * Centered Gaussian smooth. `bandwidthDays` is the standard deviation.
 * A single sample is unchanged. Output aligns with `samples`.
 */
export function smoothWeights(samples: WeightSample[], bandwidthDays = 14): number[] {
  if (samples.length === 0) return [];
  const band = bandwidthDays <= 0 ? 1 : bandwidthDays;
  return samples.map((point) => {
    let weight = 0;
    let sum = 0;
    for (const other of samples) {
      const z = daysBetween(point.day, other.day) / band;
      const w = Math.exp(-0.5 * z * z);
      weight += w;
      sum += w * other.lb;
    }
    return weight === 0 ? point.lb : round1(sum / weight);
  });
}

/** Chart domain: all samples, at least through 12 weeks after today so the goal slope is visible. */
export function chartDayRange(samples: WeightSample[], today: string): { start: string; end: string } {
  const days = samples.map((s) => s.day);
  const start = days.length ? days.reduce((a, b) => (a < b ? a : b)) : GOAL_ANCHOR_DAY;
  const lastSample = days.length ? days.reduce((a, b) => (a > b ? a : b)) : today;
  const runway = addDays(today > lastSample ? today : lastSample, 84);
  const end = runway > lastSample ? runway : lastSample;
  return { start, end };
}

export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const utc = new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) + days));
  const mm = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(utc.getUTCDate()).padStart(2, "0");
  return `${utc.getUTCFullYear()}-${mm}-${dd}`;
}

/** Sample the goal line once per day across an inclusive range. */
export function goalSeries(start: string, end: string): WeightSample[] {
  const out: WeightSample[] = [];
  const span = daysBetween(start, end);
  for (let i = 0; i <= span; i++) {
    const day = addDays(start, i);
    out.push({ day, lb: goalWeightLb(day) });
  }
  return out;
}

function numOrNull(raw: string | undefined): number | null {
  if (raw == null) return null;
  const text = raw.trim();
  if (!text || text === "-" || text.toLowerCase() === "null") return null;
  const n = Number(text.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function normalizeHeader(cell: string): string {
  return cell
    .trim()
    .toLowerCase()
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Calendar day from a Withings cell.
 * Accepts YYYY-MM-DD, YYYY-MM-DD HH:MM:SS, and M/D/YYYY.
 */
export function parseWeightDay(raw: string): string | null {
  const text = raw.trim().replace(/^"|"$/g, "");
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.exec(text);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (us) {
    return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  }
  return null;
}

/** Sort key for a Withings timestamp. Date-only cells sort as midnight. */
function weightStampKey(raw: string): string {
  const text = raw.trim().replace(/^"|"$/g, "");
  const iso = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}(?::\d{2})?))?$/.exec(text);
  if (iso) return `${iso[1]}T${iso[2] ?? "00:00:00"}`;
  const day = parseWeightDay(text);
  return day ? `${day}T00:00:00` : "";
}

/**
 * Parse `data/health/withings_weight.csv`.
 * Headers may be `Weight (lb)` / `Fat mass (lb)` or the shorter names.
 * One row per calendar day: when a day has several stamps, the latest wins.
 */
export function parseWithingsCsv(csv: string): WithingsRow[] {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0] ?? "").map(normalizeHeader);
  const idx = (name: string) => header.findIndex((h) => h === name || h.startsWith(`${name} `));
  const dateIdx = idx("date");
  const weightIdx = header.findIndex((h) => h === "weight lb" || h === "weight");
  const fatIdx = idx("fat");
  const boneIdx = idx("bone");
  const muscleIdx = idx("muscle");
  const hydrationIdx = idx("hydration");
  if (dateIdx < 0 || weightIdx < 0) {
    throw new Error("Withings CSV needs Date and Weight lb columns");
  }
  const byDay = new Map<string, { stamp: string; row: WithingsRow }>();
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const rawDate = cells[dateIdx] ?? "";
    const day = parseWeightDay(rawDate);
    const weightLb = numOrNull(cells[weightIdx]);
    if (!day || weightLb == null) continue;
    const row: WithingsRow = {
      day,
      weightLb,
      fat: fatIdx >= 0 ? numOrNull(cells[fatIdx]) : null,
      bone: boneIdx >= 0 ? numOrNull(cells[boneIdx]) : null,
      muscle: muscleIdx >= 0 ? numOrNull(cells[muscleIdx]) : null,
      hydration: hydrationIdx >= 0 ? numOrNull(cells[hydrationIdx]) : null,
    };
    const stamp = weightStampKey(rawDate);
    const prev = byDay.get(day);
    if (!prev || stamp >= prev.stamp) byDay.set(day, { stamp, row });
  }
  return [...byDay.values()]
    .map((entry) => entry.row)
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(instant)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour) % 24,
    minute: Number(bag.minute),
    second: Number(bag.second),
  };
}

/**
 * Interpret a Chicago wall-clock time as a UTC instant.
 * `time` is HH:MM or HH:MM:SS. Seconds default to 0.
 */
export function chicagoWallTimeToUtc(day: string, time: string): Date {
  const parsedDay = parseWeightDay(day) ?? day;
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(time.trim());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parsedDay) || !match) {
    throw new Error("Expected a calendar day and HH:MM time");
  }
  const y = Number(parsedDay.slice(0, 4));
  const m = Number(parsedDay.slice(5, 7));
  const d = Number(parsedDay.slice(8, 10));
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? 0);
  const guess = new Date(Date.UTC(y, m - 1, d, hour, minute, second));
  const seen = zonedParts(guess, HEALTH_TZ);
  const seenUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, seen.second);
  const offset = seenUtc - guess.getTime();
  return new Date(guess.getTime() - offset);
}

/** Chicago calendar day for an instant, YYYY-MM-DD. */
export function chicagoDay(instant: Date): string {
  const parts = zonedParts(instant, HEALTH_TZ);
  const mm = String(parts.month).padStart(2, "0");
  const dd = String(parts.day).padStart(2, "0");
  return `${parts.year}-${mm}-${dd}`;
}
