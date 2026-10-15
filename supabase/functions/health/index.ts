import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  authorized,
  parseIngest,
  pickHealthUserId,
  resolveIngestSecret,
  type FoodWrite,
  type WeightWrite,
} from "./ingest.ts";

/**
 * Bot write path for the Health app.
 *
 * POST JSON food entries and weigh-ins. Auth is header
 * x-health-secret matches HEALTH_INGEST_SECRET, or the ingest_secret row in
 * health_config when that env var is unset. An Authorization bearer equal
 * to the service role key is also accepted. Deploy with --no-verify-jwt so
 * the secret header is enough (the gateway still wants the anon apikey).
 *
 * Rows are written with the service role and attached to HEALTH_USER_ID,
 * or to the only profile when that secret is unset.
 *
 * Secret (never commit the value):
 *   HEALTH_INGEST_SECRET, or public.health_config key ingest_secret
 * Optional:
 *   HEALTH_USER_ID
 */

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-health-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function bearer(req: Request): string {
  return (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
}

function restConfig(): { url: string; key: string } {
  const url = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  return { url, key };
}

async function rest(path: string, init: RequestInit): Promise<Response> {
  const { url, key } = restConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("Authorization", `Bearer ${key}`);
  headers.set("Content-Type", "application/json");
  return fetch(`${url}/rest/v1/${path}`, { ...init, headers });
}

async function loadStoredIngestSecret(): Promise<string> {
  const res = await rest("health_config?select=value&key=eq.ingest_secret&limit=1", { method: "GET" });
  if (!res.ok) return "";
  const rows = (await res.json()) as { value?: unknown }[];
  const value = rows[0]?.value;
  return typeof value === "string" ? value : "";
}

async function resolveUserId(): Promise<string> {
  const pinned = Deno.env.get("HEALTH_USER_ID") ?? null;
  if ((pinned ?? "").trim()) return pickHealthUserId(pinned, []);
  const res = await rest("profiles?select=id&limit=5", { method: "GET" });
  if (!res.ok) throw new Error(`Could not read profiles (${res.status})`);
  const rows = (await res.json()) as { id?: string }[];
  const ids = rows.map((row) => row.id).filter((id): id is string => Boolean(id));
  return pickHealthUserId(null, ids);
}

async function writeFoods(userId: string, foods: FoodWrite[]): Promise<unknown[]> {
  const written: unknown[] = [];
  const keyed = foods.filter((row) => row.source_key);
  const plain = foods.filter((row) => !row.source_key);
  if (keyed.length) {
    const res = await rest("health_food_log?on_conflict=user_id,source_key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(keyed.map((row) => ({ ...row, user_id: userId }))),
    });
    if (!res.ok) throw new Error(`Food upsert failed: ${await res.text()}`);
    written.push(...((await res.json()) as unknown[]));
  }
  if (plain.length) {
    const res = await rest("health_food_log", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(plain.map((row) => ({ ...row, user_id: userId }))),
    });
    if (!res.ok) throw new Error(`Food insert failed: ${await res.text()}`);
    written.push(...((await res.json()) as unknown[]));
  }
  return written;
}

async function writeWeights(userId: string, weights: WeightWrite[]): Promise<unknown[]> {
  if (!weights.length) return [];
  const res = await rest("health_weights?on_conflict=user_id,weighed_on", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(weights.map((row) => ({ ...row, user_id: userId }))),
  });
  if (!res.ok) throw new Error(`Weight upsert failed: ${await res.text()}`);
  return (await res.json()) as unknown[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST JSON only" }, 405);

  const envSecret = Deno.env.get("HEALTH_INGEST_SECRET") ?? "";
  const storedSecret = envSecret.trim() ? "" : await loadStoredIngestSecret();
  const ok = authorized({
    secretHeader: req.headers.get("x-health-secret") ?? "",
    bearer: bearer(req),
    expectedSecret: resolveIngestSecret(envSecret, storedSecret),
    serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  });
  if (!ok) return json({ error: "Not authorized" }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body must be JSON" }, 400);
  }

  let plan;
  try {
    plan = parseIngest(body);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Bad request" }, 400);
  }

  try {
    const userId = await resolveUserId();
    const [foods, weights] = await Promise.all([
      writeFoods(userId, plan.foods),
      writeWeights(userId, plan.weights),
    ]);
    return json({ ok: true, user_id: userId, foods, weights });
  } catch (err) {
    console.error("health ingest", err);
    return json({ error: err instanceof Error ? err.message : "Write failed" }, 500);
  }
});
