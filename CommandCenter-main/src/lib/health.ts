import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, requireUserId } from "./supabase";
import { todayStr, shiftDay } from "./utils";
import type {
  CalorieEntry,
  CalorieEntryInsert,
  HealthMetric,
  HealthSettings,
  MealType,
} from "@/types";

const keys = {
  settings: ["health", "settings"] as const,
  calories: (day: string) => ["health", "calories", day] as const,
  metrics: (day: string) => ["health", "metrics", day] as const,
  withings: ["health", "withings"] as const,
  apple: ["health", "apple"] as const,
};

export type WithingsStatus = {
  configured: boolean;
  connected: boolean;
  status: string;
  provider_user_id: string | null;
  connected_at: string | null;
  synced_at: string | null;
  detail: Record<string, unknown>;
  error?: string;
};

export type AppleHealthStatus = {
  live_api: boolean;
  note: string;
  connected: boolean;
  status: string;
  connected_at: string | null;
  synced_at: string | null;
  detail: Record<string, unknown>;
  error?: string;
};

async function edge<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T & { error?: string }>(name, { body });
  if (error) {
    const msg = error.message || `Edge function ${name} failed`;
    throw new Error(msg);
  }
  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(String(data.error));
  }
  return data as T;
}

export async function fetchHealthSettings(): Promise<HealthSettings> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("health_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;

  const { data: created, error: insertErr } = await supabase
    .from("health_settings")
    .insert({ user_id: userId, daily_calorie_goal: 2000 })
    .select()
    .single();
  if (insertErr) throw insertErr;
  return created;
}

export function useHealthSettings() {
  return useQuery({ queryKey: keys.settings, queryFn: fetchHealthSettings });
}

export function useUpdateCalorieGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (daily_calorie_goal: number) => {
      const userId = await requireUserId();
      const { data, error } = await supabase
        .from("health_settings")
        .upsert({ user_id: userId, daily_calorie_goal })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.settings }),
  });
}

export async function fetchCalorieEntries(day: string): Promise<CalorieEntry[]> {
  const { data, error } = await supabase
    .from("calorie_entries")
    .select("*")
    .eq("logged_date", day)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export function useCalorieEntries(day = todayStr()) {
  return useQuery({
    queryKey: keys.calories(day),
    queryFn: () => fetchCalorieEntries(day),
  });
}

export function useAddCalorieEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      entry: Omit<CalorieEntryInsert, "user_id" | "id" | "created_at" | "source"> & {
        meal_type?: MealType;
      },
    ) => {
      const userId = await requireUserId();
      const { data, error } = await supabase
        .from("calorie_entries")
        .insert({
          user_id: userId,
          logged_date: entry.logged_date,
          meal_type: entry.meal_type ?? "snack",
          name: entry.name.trim(),
          calories: entry.calories,
          protein_g: entry.protein_g ?? null,
          carbs_g: entry.carbs_g ?? null,
          fat_g: entry.fat_g ?? null,
          note: entry.note ?? null,
          source: "manual",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: keys.calories(row.logged_date) });
    },
  });
}

export function useDeleteCalorieEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, day }: { id: string; day: string }) => {
      const { error } = await supabase.from("calorie_entries").delete().eq("id", id);
      if (error) throw error;
      return day;
    },
    onSuccess: (day) => {
      void qc.invalidateQueries({ queryKey: keys.calories(day) });
    },
  });
}

export async function fetchHealthMetrics(day: string): Promise<HealthMetric[]> {
  const { data, error } = await supabase
    .from("health_metrics")
    .select("*")
    .eq("metric_date", day)
    .order("metric_type");
  if (error) throw error;
  return data ?? [];
}

export function useHealthMetrics(day = todayStr()) {
  return useQuery({
    queryKey: keys.metrics(day),
    queryFn: () => fetchHealthMetrics(day),
  });
}

export function useWithingsStatus() {
  return useQuery({
    queryKey: keys.withings,
    queryFn: () => edge<WithingsStatus>("withings", { action: "status" }),
    staleTime: 30_000,
  });
}

export function useAppleHealthStatus() {
  return useQuery({
    queryKey: keys.apple,
    queryFn: () => edge<AppleHealthStatus>("apple-health", { action: "status" }),
    staleTime: 30_000,
  });
}

export async function startWithingsOAuth(): Promise<string> {
  const res = await edge<{ url: string }>("withings", { action: "authorize" });
  if (!res.url) throw new Error("No authorize URL returned");
  return res.url;
}

export async function completeWithingsOAuth(code: string, state: string) {
  return edge<{ ok: boolean }>("withings", { action: "callback", code, state });
}

export async function syncWithings() {
  return edge<{ ok: boolean; metrics_upserted: number }>("withings", { action: "sync" });
}

export async function disconnectWithings() {
  return edge<{ ok: boolean }>("withings", { action: "disconnect" });
}

export async function disconnectAppleHealth() {
  return edge<{ ok: boolean }>("apple-health", { action: "disconnect" });
}

export type AppleImportPayload = {
  metrics?: Array<{
    metric_date: string;
    metric_type: string;
    value: number;
    unit: string;
    external_id?: string;
    recorded_at?: string;
  }>;
  calories?: Array<{
    logged_date: string;
    name: string;
    calories: number;
    meal_type?: MealType;
    external_id?: string;
  }>;
};

export async function importAppleHealth(payload: AppleImportPayload) {
  return edge<{
    ok: boolean;
    metrics_upserted: number;
    calories_upserted: number;
  }>("apple-health", { action: "import", ...payload });
}

/** Map common Health Auto Export / Quantity type names into our schema. */
const APPLE_TYPE_MAP: Record<
  string,
  { metric_type: string; unit: string; kind: "metric" | "dietary" }
> = {
  HKQuantityTypeIdentifierStepCount: { metric_type: "steps", unit: "count", kind: "metric" },
  stepCount: { metric_type: "steps", unit: "count", kind: "metric" },
  steps: { metric_type: "steps", unit: "count", kind: "metric" },
  HKQuantityTypeIdentifierActiveEnergyBurned: {
    metric_type: "active_calories",
    unit: "kcal",
    kind: "metric",
  },
  activeEnergy: { metric_type: "active_calories", unit: "kcal", kind: "metric" },
  activeEnergyBurned: { metric_type: "active_calories", unit: "kcal", kind: "metric" },
  HKQuantityTypeIdentifierBasalEnergyBurned: {
    metric_type: "total_calories",
    unit: "kcal",
    kind: "metric",
  },
  HKQuantityTypeIdentifierDietaryEnergyConsumed: {
    metric_type: "dietary",
    unit: "kcal",
    kind: "dietary",
  },
  dietaryEnergy: { metric_type: "dietary", unit: "kcal", kind: "dietary" },
  HKQuantityTypeIdentifierBodyMass: { metric_type: "weight_kg", unit: "kg", kind: "metric" },
  bodyMass: { metric_type: "weight_kg", unit: "kg", kind: "metric" },
  HKQuantityTypeIdentifierBodyFatPercentage: {
    metric_type: "body_fat_pct",
    unit: "%",
    kind: "metric",
  },
  HKQuantityTypeIdentifierDistanceWalkingRunning: {
    metric_type: "distance_m",
    unit: "m",
    kind: "metric",
  },
  HKQuantityTypeIdentifierHeartRate: { metric_type: "heart_rate", unit: "bpm", kind: "metric" },
};

function toYmd(raw: string): string | null {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

function lbToKg(v: number) {
  return v * 0.45359237;
}

/**
 * Parse Health Auto Export JSON or a slim custom dump into import rows.
 * Supports shapes like:
 *   [{ date, stepCount, activeEnergy, … }]
 *   { data: [ { type, date, qty/value, … } ] }
 *   { metrics: [...], calories: [...] }  (already our shape)
 */
export function parseAppleHealthJson(text: string): AppleImportPayload {
  const parsed = JSON.parse(text) as unknown;
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const obj = parsed as AppleImportPayload & { data?: unknown[] };
    if (Array.isArray(obj.metrics) || Array.isArray(obj.calories)) {
      return { metrics: obj.metrics ?? [], calories: obj.calories ?? [] };
    }
    if (Array.isArray(obj.data)) {
      return aggregateLooseRecords(obj.data);
    }
  }
  if (Array.isArray(parsed)) {
    return aggregateLooseRecords(parsed);
  }
  throw new Error("Unrecognized Apple Health JSON shape");
}

function aggregateLooseRecords(rows: unknown[]): AppleImportPayload {
  const metricAgg = new Map<string, { value: number; unit: string; metric_type: string }>();
  const calories: NonNullable<AppleImportPayload["calories"]> = [];

  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;

    // Day-summary objects from Health Auto Export automations.
    const day = toYmd(String(row.date ?? row.Date ?? row.startDate ?? row.endDate ?? ""));
    if (day) {
      for (const [key, map] of Object.entries(APPLE_TYPE_MAP)) {
        if (!(key in row)) continue;
        const value = Number(row[key]);
        if (!Number.isFinite(value)) continue;
        if (map.kind === "dietary") {
          calories.push({
            logged_date: day,
            name: "Dietary energy (Apple Health)",
            calories: Math.round(value),
            meal_type: "snack",
            external_id: `apple:dietary:${day}`,
          });
        } else {
          const k = `${day}:${map.metric_type}`;
          const prev = metricAgg.get(k);
          const nextVal =
            map.metric_type === "weight_kg" || map.metric_type === "heart_rate"
              ? value
              : (prev?.value ?? 0) + value;
          metricAgg.set(k, { value: nextVal, unit: map.unit, metric_type: map.metric_type });
        }
      }
    }

    const typeKey = String(row.type ?? row.name ?? row.qtyType ?? "");
    const mapped = APPLE_TYPE_MAP[typeKey];
    if (!mapped) continue;
    const date = toYmd(String(row.date ?? row.startDate ?? row.end ?? ""));
    if (!date) continue;
    let value = Number(row.qty ?? row.value ?? row.amount ?? row.calories);
    if (!Number.isFinite(value)) continue;
    const unit = String(row.units ?? row.unit ?? mapped.unit).toLowerCase();
    if (mapped.metric_type === "weight_kg" && (unit === "lb" || unit === "lbs")) {
      value = lbToKg(value);
    }
    if (mapped.kind === "dietary") {
      calories.push({
        logged_date: date,
        name: String(row.sourceName ?? row.name ?? "Dietary energy"),
        calories: Math.round(value),
        meal_type: "snack",
        external_id: `apple:dietary:${date}:${Math.round(value)}:${String(row.id ?? "")}`,
      });
      continue;
    }
    const k = `${date}:${mapped.metric_type}`;
    const prev = metricAgg.get(k);
    const nextVal =
      mapped.metric_type === "weight_kg" || mapped.metric_type === "heart_rate"
        ? value
        : (prev?.value ?? 0) + value;
    metricAgg.set(k, { value: nextVal, unit: mapped.unit, metric_type: mapped.metric_type });
  }

  const metrics = [...metricAgg.entries()].map(([k, v]) => {
    const [metric_date, metric_type] = k.split(":");
    return {
      metric_date,
      metric_type,
      value: v.value,
      unit: v.unit,
      external_id: `apple:${metric_type}:${metric_date}`,
    };
  });

  return { metrics, calories };
}

/**
 * Lightweight export.xml parse. Full multi-GB exports will choke the browser —
 * prefer Health Auto Export JSON for large histories. We only keep the last
 * `days` of matching quantity samples.
 */
export function parseAppleHealthXml(xmlText: string, days = 45): AppleImportPayload {
  if (xmlText.length > 40_000_000) {
    throw new Error("export.xml is too large for browser import — use Health Auto Export JSON");
  }
  const cutoff = shiftDay(todayStr(), -(days - 1));
  const re =
    /<Record\b([^>]*?)\/>|<Record\b([^>]*)>(?:[\s\S]*?)<\/Record>/gi;
  const loose: unknown[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(xmlText))) {
    const attrs = match[1] || match[2] || "";
    const type = /type="([^"]+)"/.exec(attrs)?.[1];
    if (!type || !APPLE_TYPE_MAP[type]) continue;
    const startDate = /startDate="([^"]+)"/.exec(attrs)?.[1] ?? "";
    const value = Number(/value="([^"]+)"/.exec(attrs)?.[1]);
    const unit = /unit="([^"]+)"/.exec(attrs)?.[1] ?? "";
    const day = toYmd(startDate);
    if (!day || day < cutoff || !Number.isFinite(value)) continue;
    loose.push({ type, date: day, qty: value, unit, startDate });
    if (loose.length > 20_000) break;
  }
  return aggregateLooseRecords(loose);
}

export { keys as healthKeys };
