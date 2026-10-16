/**
 * Parse and authorize Health ingest posts.
 * No Deno globals — node tests import this file directly.
 */

export const HEALTH_TZ = "America/Chicago";

export type FoodWrite = {
  logged_at: string;
  log_date: string;
  item: string;
  kcal: number;
  protein_g: number;
  source_key: string | null;
};

export type WeightWrite = {
  weighed_on: string;
  weight_lb: number;
  fat: number | null;
  bone: number | null;
  muscle: number | null;
  hydration: number | null;
};

export type ExerciseWrite = {
  date: string;
  time: string;
  exercise: string;
  sets: number | null;
  reps: number | null;
  weight_lb: number | null;
  duration_min: number | null;
  kcal_burned: number | null;
  note: string | null;
};

export type IngestPlan = {
  foods: FoodWrite[];
  weights: WeightWrite[];
  exercises: ExerciseWrite[];
};

export function secretsMatch(got: string, expected: string): boolean {
  if (!expected || !got) return false;
  const a = new TextEncoder().encode(got);
  const b = new TextEncoder().encode(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/**
 * Platform secret wins. Otherwise the value stored in health_config.
 * Comparison of the request header stays in `authorized` (constant time).
 */
export function resolveIngestSecret(envSecret: string, storedSecret: string | null | undefined): string {
  const fromEnv = envSecret.trim();
  if (fromEnv) return fromEnv;
  return (storedSecret ?? "").trim();
}

export function authorized(opts: {
  secretHeader: string;
  bearer: string;
  expectedSecret: string;
  serviceRoleKey: string;
}): boolean {
  if (opts.expectedSecret && secretsMatch(opts.secretHeader.trim(), opts.expectedSecret.trim())) {
    return true;
  }
  if (opts.serviceRoleKey && secretsMatch(opts.bearer.trim(), opts.serviceRoleKey.trim())) {
    return true;
  }
  return false;
}

/** Prefer an explicit HEALTH_USER_ID. Otherwise the sole profile. */
export function pickHealthUserId(pinned: string | null, profileIds: string[]): string {
  const explicit = (pinned ?? "").trim();
  if (explicit) return explicit;
  if (profileIds.length === 1 && profileIds[0]) return profileIds[0];
  if (profileIds.length === 0) throw new Error("No profile to attach health rows to");
  throw new Error("Set HEALTH_USER_ID — more than one profile exists");
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

export function chicagoDay(instant: Date): string {
  const parts = zonedParts(instant, HEALTH_TZ);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function chicagoTime(instant: Date): string {
  const parts = zonedParts(instant, HEALTH_TZ);
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:${String(parts.second).padStart(2, "0")}`;
}

export function chicagoWallTimeToUtc(day: string, time: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("date must be YYYY-MM-DD");
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(time.trim());
  if (!match) throw new Error("time must be HH:MM");
  const y = Number(day.slice(0, 4));
  const m = Number(day.slice(5, 7));
  const d = Number(day.slice(8, 10));
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? 0);
  const guess = new Date(Date.UTC(y, m - 1, d, hour, minute, second));
  const seen = zonedParts(guess, HEALTH_TZ);
  const seenUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, seen.second);
  return new Date(guess.getTime() - (seenUtc - guess.getTime()));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function num(value: unknown, label: string): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : NaN;
  if (!Number.isFinite(n)) throw new Error(`${label} must be a number`);
  return n;
}

function optionalNum(value: unknown, label: string): number | null {
  if (value == null || value === "") return null;
  return num(value, label);
}

function foodFrom(raw: unknown): FoodWrite {
  const row = asRecord(raw);
  if (!row) throw new Error("food entry must be an object");
  const item = text(row.item) || text(row.name);
  if (!item) throw new Error("food entry needs item");
  if (item.length > 240) throw new Error("item is too long");
  const kcal = num(row.kcal ?? row.calories, "kcal");
  const protein = num(row.protein_g ?? row.protein, "protein_g");
  if (kcal < 0 || kcal > 20000) throw new Error("kcal is out of range");
  if (protein < 0 || protein > 1000) throw new Error("protein_g is out of range");

  let loggedAt: Date;
  const stamp = text(row.logged_at);
  if (stamp) {
    loggedAt = new Date(stamp);
    if (Number.isNaN(loggedAt.getTime())) throw new Error("logged_at is not a valid time");
  } else {
    const day = text(row.date) || text(row.log_date);
    const time = text(row.time) || "12:00";
    if (!day) throw new Error("food entry needs logged_at or date");
    loggedAt = chicagoWallTimeToUtc(day, time);
  }

  const source = text(row.source_key) || text(row.id);
  return {
    logged_at: loggedAt.toISOString(),
    log_date: chicagoDay(loggedAt),
    item,
    kcal,
    protein_g: protein,
    source_key: source || null,
  };
}

function weightFrom(raw: unknown): WeightWrite {
  const row = asRecord(raw);
  if (!row) throw new Error("weigh-in must be an object");
  const day = text(row.weighed_on) || text(row.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("weighed_on must be YYYY-MM-DD");
  const weight = num(row.weight_lb ?? row.weight, "weight_lb");
  if (weight <= 0 || weight > 800) throw new Error("weight_lb is out of range");
  return {
    weighed_on: day,
    weight_lb: weight,
    fat: optionalNum(row.fat, "fat"),
    bone: optionalNum(row.bone, "bone"),
    muscle: optionalNum(row.muscle, "muscle"),
    hydration: optionalNum(row.hydration, "hydration"),
  };
}

function optionalInt(value: unknown, label: string): number | null {
  const n = optionalNum(value, label);
  if (n == null) return null;
  if (!Number.isInteger(n)) throw new Error(`${label} must be a whole number`);
  return n;
}

function inRange(n: number | null, label: string, min: number, max: number): number | null {
  if (n != null && (n < min || n > max)) throw new Error(`${label} is out of range`);
  return n;
}

function validDay(day: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const utc = new Date(Date.UTC(y, m - 1, d));
  return utc.getUTCFullYear() === y && utc.getUTCMonth() === m - 1 && utc.getUTCDate() === d;
}

/**
 * Wall clock HH:MM or HH:MM:SS (America/Chicago) -> HH:MM:SS.
 */
function wallTime(raw: string): string {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(raw.trim());
  if (!match) throw new Error("time must be HH:MM");
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? 0);
  if (hour > 23 || minute > 59 || second > 59) throw new Error("time must be HH:MM");
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
}

function exerciseFrom(raw: unknown): ExerciseWrite {
  const row = asRecord(raw);
  if (!row) throw new Error("exercise entry must be an object");
  const exercise = text(row.exercise) || text(row.name);
  if (!exercise) throw new Error("exercise entry needs exercise");
  if (exercise.length > 120) throw new Error("exercise is too long");

  let day: string;
  let time: string;
  const stamp = text(row.logged_at);
  if (stamp) {
    const at = new Date(stamp);
    if (Number.isNaN(at.getTime())) throw new Error("logged_at is not a valid time");
    day = chicagoDay(at);
    time = chicagoTime(at);
  } else {
    day = text(row.date) || text(row.log_date);
    if (!day) throw new Error("exercise entry needs logged_at or date");
    if (!validDay(day)) throw new Error("date must be YYYY-MM-DD");
    time = wallTime(text(row.time) || "12:00");
  }

  const note = text(row.note);
  if (note.length > 500) throw new Error("note is too long");

  return {
    date: day,
    time,
    exercise,
    sets: inRange(optionalInt(row.sets, "sets"), "sets", 1, 1000),
    reps: inRange(optionalInt(row.reps, "reps"), "reps", 0, 100000),
    weight_lb: inRange(optionalNum(row.weight_lb ?? row.weight, "weight_lb"), "weight_lb", 0, 5000),
    duration_min: inRange(optionalNum(row.duration_min ?? row.duration, "duration_min"), "duration_min", 0, 1440),
    kcal_burned: inRange(
      optionalNum(row.kcal_burned ?? row.kcal ?? row.calories, "kcal_burned"),
      "kcal_burned",
      0,
      20000,
    ),
    note: note || null,
  };
}

function kindOf(row: Record<string, unknown>): string {
  return (text(row.type) || text(row.kind)).toLowerCase();
}

/**
 * Accept one food, one weigh-in, one exercise, or a batch of any.
 * `type` / `kind` is `food`, `weight`, or `exercise`.
 */
export function parseIngest(body: unknown): IngestPlan {
  const row = asRecord(body);
  if (!row) throw new Error("JSON body must be an object");

  const foods: FoodWrite[] = [];
  const weights: WeightWrite[] = [];
  const exercises: ExerciseWrite[] = [];

  if (Array.isArray(row.foods)) {
    for (const entry of row.foods) foods.push(foodFrom(entry));
  }
  if (Array.isArray(row.weights)) {
    for (const entry of row.weights) weights.push(weightFrom(entry));
  }
  if (Array.isArray(row.exercises)) {
    for (const entry of row.exercises) exercises.push(exerciseFrom(entry));
  }

  const kind = kindOf(row);
  if (kind === "food" || kind === "meal") foods.push(foodFrom(row));
  else if (kind === "weight" || kind === "weigh-in" || kind === "weighin") weights.push(weightFrom(row));
  else if (kind === "exercise" || kind === "workout") exercises.push(exerciseFrom(row));
  else if (!Array.isArray(row.foods) && !Array.isArray(row.weights) && !Array.isArray(row.exercises)) {
    throw new Error('Set type to "food", "weight", or "exercise", or send foods, weights, and exercises arrays');
  }

  if (foods.length === 0 && weights.length === 0 && exercises.length === 0) {
    throw new Error("No food entries, weigh-ins, or exercises in the body");
  }
  if (foods.length + weights.length + exercises.length > 200) throw new Error("Too many rows in one post");
  return { foods, weights, exercises };
}
