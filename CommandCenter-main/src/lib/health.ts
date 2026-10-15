import { supabase, requireUserId } from "./supabase";
import { chicagoWallTimeToUtc } from "./health-math";

export type HealthFoodLog = {
  id: string;
  user_id: string;
  logged_at: string;
  log_date: string;
  item: string;
  kcal: number;
  protein_g: number;
  source_key: string | null;
  created_at: string;
};

export type HealthSavedFood = {
  id: string;
  user_id: string;
  name: string;
  kcal: number;
  protein_g: number;
  sort_order: number;
};

export type HealthWeight = {
  id: string;
  user_id: string;
  weighed_on: string;
  weight_lb: number;
  fat: number | null;
  bone: number | null;
  muscle: number | null;
  hydration: number | null;
};

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function asFood(row: Record<string, unknown>): HealthFoodLog {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    logged_at: String(row.logged_at),
    log_date: String(row.log_date),
    item: String(row.item),
    kcal: num(row.kcal),
    protein_g: num(row.protein_g),
    source_key: row.source_key == null ? null : String(row.source_key),
    created_at: String(row.created_at),
  };
}

function asSaved(row: Record<string, unknown>): HealthSavedFood {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    name: String(row.name),
    kcal: num(row.kcal),
    protein_g: num(row.protein_g),
    sort_order: num(row.sort_order),
  };
}

function asWeight(row: Record<string, unknown>): HealthWeight {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    weighed_on: String(row.weighed_on),
    weight_lb: num(row.weight_lb),
    fat: numOrNull(row.fat),
    bone: numOrNull(row.bone),
    muscle: numOrNull(row.muscle),
    hydration: numOrNull(row.hydration),
  };
}

export async function fetchFoodLog(day: string): Promise<HealthFoodLog[]> {
  const { data, error } = await supabase
    .from("health_food_log")
    .select("id, user_id, logged_at, log_date, item, kcal, protein_g, source_key, created_at")
    .eq("log_date", day)
    .order("logged_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => asFood(row as Record<string, unknown>));
}

export async function fetchSavedFoods(): Promise<HealthSavedFood[]> {
  const { data, error } = await supabase
    .from("health_saved_foods")
    .select("id, user_id, name, kcal, protein_g, sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => asSaved(row as Record<string, unknown>));
}

export async function fetchWeights(): Promise<HealthWeight[]> {
  const { data, error } = await supabase
    .from("health_weights")
    .select("id, user_id, weighed_on, weight_lb, fat, bone, muscle, hydration")
    .order("weighed_on", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => asWeight(row as Record<string, unknown>));
}

export async function addFoodLog(input: {
  day: string;
  time: string;
  item: string;
  kcal: number;
  protein_g: number;
}): Promise<void> {
  const userId = await requireUserId();
  const loggedAt = chicagoWallTimeToUtc(input.day, input.time).toISOString();
  const { error } = await supabase.from("health_food_log").insert({
    user_id: userId,
    logged_at: loggedAt,
    log_date: input.day,
    item: input.item.trim(),
    kcal: input.kcal,
    protein_g: input.protein_g,
  });
  if (error) throw error;
}

export async function deleteFoodLog(id: string): Promise<void> {
  const { error } = await supabase.from("health_food_log").delete().eq("id", id);
  if (error) throw error;
}

export async function addSavedFood(input: {
  name: string;
  kcal: number;
  protein_g: number;
}): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from("health_saved_foods").upsert(
    {
      user_id: userId,
      name: input.name.trim(),
      kcal: input.kcal,
      protein_g: input.protein_g,
    },
    { onConflict: "user_id,name" },
  );
  if (error) throw error;
}

export async function deleteSavedFood(id: string): Promise<void> {
  const { error } = await supabase.from("health_saved_foods").delete().eq("id", id);
  if (error) throw error;
}

export async function addWeight(input: {
  weighed_on: string;
  weight_lb: number;
  fat?: number | null;
  bone?: number | null;
  muscle?: number | null;
  hydration?: number | null;
}): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from("health_weights").upsert(
    {
      user_id: userId,
      weighed_on: input.weighed_on,
      weight_lb: input.weight_lb,
      fat: input.fat ?? null,
      bone: input.bone ?? null,
      muscle: input.muscle ?? null,
      hydration: input.hydration ?? null,
    },
    { onConflict: "user_id,weighed_on" },
  );
  if (error) throw error;
}
