import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Apple Health has no public web/REST API. HealthKit stays on-device.
// This function accepts structured imports (Health Auto Export JSON, or a
// browser-parsed summary from export.xml) and writes metrics / dietary energy.
//
// Deploy: supabase functions deploy apple-health

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

type MetricIn = {
  metric_date: string;
  metric_type:
    | "weight_kg"
    | "steps"
    | "active_calories"
    | "total_calories"
    | "heart_rate"
    | "body_fat_pct"
    | "distance_m";
  value: number;
  unit: string;
  external_id?: string;
  recorded_at?: string;
};

type CalorieIn = {
  logged_date: string;
  name: string;
  calories: number;
  meal_type?: "breakfast" | "lunch" | "dinner" | "snack";
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  external_id?: string;
  note?: string | null;
};

async function authedUser(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const asUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data, error } = await asUser.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function isYmd(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const user = await authedUser(req);
  if (!user) return json({ error: "Not signed in" }, 401);
  const userId = user.id;
  const admin = adminClient();

  let action = "status";
  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
    action = String(payload.action ?? "status");
  } catch {
    // defaults
  }

  if (action === "status") {
    const { data: conn } = await admin
      .from("health_connections")
      .select("status, connected_at, updated_at, detail")
      .eq("user_id", userId)
      .eq("provider", "apple_health")
      .maybeSingle();

    const { data: sync } = await admin
      .from("integration_sync")
      .select("synced_at, detail")
      .eq("user_id", userId)
      .eq("service", "apple_health")
      .maybeSingle();

    return json({
      live_api: false,
      note:
        "Apple does not offer a public HealthKit web API. Import via Health Auto Export JSON or a parsed export.xml summary.",
      connected: conn?.status === "connected",
      status: conn?.status ?? "disconnected",
      connected_at: conn?.connected_at ?? null,
      synced_at: sync?.synced_at ?? null,
      detail: sync?.detail ?? {},
    });
  }

  if (action === "disconnect") {
    await admin.from("health_connections").upsert({
      user_id: userId,
      provider: "apple_health",
      status: "disconnected",
      access_token: null,
      refresh_token: null,
      expires_at: null,
      provider_user_id: null,
      connected_at: null,
      detail: {},
    });
    await admin.from("integration_sync").upsert({
      user_id: userId,
      service: "apple_health",
      synced_at: null,
      detail: { connected: false },
    });
    return json({ ok: true });
  }

  if (action === "import") {
    const metrics = Array.isArray(payload.metrics) ? (payload.metrics as MetricIn[]) : [];
    const calories = Array.isArray(payload.calories) ? (payload.calories as CalorieIn[]) : [];

    if (!metrics.length && !calories.length) {
      return json({ error: "Provide metrics and/or calories arrays" }, 400);
    }
    if (metrics.length > 5000 || calories.length > 2000) {
      return json({ error: "Import too large — split into smaller batches" }, 400);
    }

    const allowedMetric = new Set([
      "weight_kg",
      "steps",
      "active_calories",
      "total_calories",
      "heart_rate",
      "body_fat_pct",
      "distance_m",
    ]);
    const allowedMeal = new Set(["breakfast", "lunch", "dinner", "snack"]);

    const metricRows = [];
    for (const m of metrics) {
      if (!m || !isYmd(String(m.metric_date)) || !allowedMetric.has(m.metric_type)) continue;
      const value = Number(m.value);
      if (!Number.isFinite(value)) continue;
      const external_id =
        m.external_id?.trim() ||
        `apple:${m.metric_type}:${m.metric_date}:${value}`;
      metricRows.push({
        user_id: userId,
        metric_date: m.metric_date,
        metric_type: m.metric_type,
        value,
        unit: String(m.unit || "count").slice(0, 32),
        source: "apple_health",
        external_id,
        recorded_at: m.recorded_at ?? null,
      });
    }

    const calorieRows = [];
    for (const c of calories) {
      if (!c || !isYmd(String(c.logged_date))) continue;
      const cal = Math.round(Number(c.calories));
      if (!Number.isFinite(cal) || cal < 0) continue;
      const name = String(c.name || "Apple Health").trim().slice(0, 200);
      if (!name) continue;
      const meal = allowedMeal.has(String(c.meal_type)) ? c.meal_type! : "snack";
      const external_id =
        c.external_id?.trim() ||
        `apple:cal:${c.logged_date}:${name}:${cal}`;
      calorieRows.push({
        user_id: userId,
        logged_date: c.logged_date,
        meal_type: meal,
        name,
        calories: cal,
        protein_g: c.protein_g ?? null,
        carbs_g: c.carbs_g ?? null,
        fat_g: c.fat_g ?? null,
        source: "apple_health",
        external_id,
        note: c.note ?? null,
      });
    }

    let metricsUpserted = 0;
    if (metricRows.length) {
      const byKey = new Map<string, (typeof metricRows)[number]>();
      for (const row of metricRows) {
        byKey.set(`${row.metric_date}:${row.metric_type}`, row);
      }
      const deduped = [...byKey.values()];
      const { error } = await admin.from("health_metrics").upsert(deduped, {
        onConflict: "user_id,metric_date,metric_type,source",
        ignoreDuplicates: false,
      });
      if (error) return json({ error: error.message }, 400);
      metricsUpserted = deduped.length;
    }

    if (calorieRows.length) {
      for (const row of calorieRows) {
        const { error: delErr } = await admin
          .from("calorie_entries")
          .delete()
          .eq("user_id", userId)
          .eq("source", "apple_health")
          .eq("external_id", row.external_id);
        if (delErr) return json({ error: delErr.message }, 400);
      }
      const { error } = await admin.from("calorie_entries").insert(calorieRows);
      if (error) return json({ error: error.message }, 400);
    }

    const now = new Date().toISOString();
    await admin.from("health_connections").upsert({
      user_id: userId,
      provider: "apple_health",
      status: "connected",
      connected_at: now,
      detail: { import: true },
    });
    await admin.from("integration_sync").upsert({
      user_id: userId,
      service: "apple_health",
      synced_at: now,
      detail: {
        connected: true,
        metrics_upserted: metricsUpserted,
        calories_upserted: calorieRows.length,
      },
    });

    return json({
      ok: true,
      metrics_upserted: metricsUpserted,
      calories_upserted: calorieRows.length,
      synced_at: now,
    });
  }

  return json({ error: `Unknown action '${action}'` }, 400);
});
