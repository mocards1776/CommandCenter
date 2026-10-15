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

export type IngestPlan = {
  foods: FoodWrite[];
  weights: WeightWrite[];
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

function kindOf(row: Record<string, unknown>): string {
  return (text(row.type) || text(row.kind)).toLowerCase();
}

/**
 * Accept one food, one weigh-in, or a batch of both.
 * `type` / `kind` is `food` or `weight`.
 */
export function parseIngest(body: unknown): IngestPlan {
  const row = asRecord(body);
  if (!row) throw new Error("JSON body must be an object");

  const foods: FoodWrite[] = [];
  const weights: WeightWrite[] = [];

  if (Array.isArray(row.foods)) {
    for (const entry of row.foods) foods.push(foodFrom(entry));
  }
  if (Array.isArray(row.weights)) {
    for (const entry of row.weights) weights.push(weightFrom(entry));
  }

  const kind = kindOf(row);
  if (kind === "food" || kind === "meal") foods.push(foodFrom(row));
  else if (kind === "weight" || kind === "weigh-in" || kind === "weighin") weights.push(weightFrom(row));
  else if (!Array.isArray(row.foods) && !Array.isArray(row.weights)) {
    throw new Error('Set type to "food" or "weight", or send foods and weights arrays');
  }

  if (foods.length === 0 && weights.length === 0) {
    throw new Error("No food entries or weigh-ins in the body");
  }
  if (foods.length + weights.length > 200) throw new Error("Too many rows in one post");
  return { foods, weights };
}
