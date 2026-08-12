import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Withings OAuth + activity/weight sync.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   WITHINGS_CLIENT_ID
//   WITHINGS_CLIENT_SECRET
//   WITHINGS_REDIRECT_URI  — must match the Partner Hub callback, e.g.
//                            https://your-app.vercel.app/health
//
// Deploy: supabase functions deploy withings

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const WITHINGS_AUTH = "https://account.withings.com/oauth2_user/authorize2";
const WITHINGS_API = "https://wbsapi.withings.net";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function formBody(data: Record<string, string>) {
  return new URLSearchParams(data).toString();
}

type ConnRow = {
  user_id: string;
  provider: string;
  status: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  provider_user_id: string | null;
  detail: Record<string, unknown>;
  connected_at: string | null;
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

function clientCreds() {
  const clientId = Deno.env.get("WITHINGS_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("WITHINGS_CLIENT_SECRET") ?? "";
  const redirectUri = Deno.env.get("WITHINGS_REDIRECT_URI") ?? "";
  return { clientId, clientSecret, redirectUri };
}

async function withingsTokenRequest(body: Record<string, string>) {
  const res = await fetch(`${WITHINGS_API}/v2/oauth2`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody(body),
  });
  const data = await res.json();
  if (data.status !== 0) {
    throw new Error(data.error || `Withings token error ${data.status}`);
  }
  return data.body as {
    userid: number | string;
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope?: string;
  };
}

async function ensureAccessToken(admin: ReturnType<typeof adminClient>, userId: string, conn: ConnRow) {
  const { clientId, clientSecret } = clientCreds();
  if (!conn.access_token || !conn.refresh_token) {
    throw new Error("Withings is not connected");
  }

  const expiresAt = conn.expires_at ? new Date(conn.expires_at).getTime() : 0;
  if (expiresAt - 60_000 > Date.now()) {
    return conn.access_token;
  }

  const body = await withingsTokenRequest({
    action: "requesttoken",
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: conn.refresh_token,
  });

  const expires = new Date(Date.now() + body.expires_in * 1000).toISOString();
  await admin.from("health_connections").upsert({
    user_id: userId,
    provider: "withings",
    status: "connected",
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: expires,
    provider_user_id: String(body.userid ?? conn.provider_user_id ?? ""),
    connected_at: conn.connected_at ?? new Date().toISOString(),
    detail: { ...(conn.detail ?? {}), scope: body.scope ?? null },
  });

  return body.access_token;
}

async function withingsPost(accessToken: string, path: string, fields: Record<string, string>) {
  const res = await fetch(`${WITHINGS_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formBody(fields),
  });
  const data = await res.json();
  if (data.status !== 0) {
    throw new Error(data.error || `Withings API error ${data.status}`);
  }
  return data.body;
}

function ymdDaysAgo(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
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

  const { clientId, clientSecret, redirectUri } = clientCreds();

  if (action === "status") {
    const { data } = await admin
      .from("health_connections")
      .select("status, provider_user_id, connected_at, updated_at, detail, expires_at")
      .eq("user_id", userId)
      .eq("provider", "withings")
      .maybeSingle();

    const { data: sync } = await admin
      .from("integration_sync")
      .select("synced_at, detail")
      .eq("user_id", userId)
      .eq("service", "withings")
      .maybeSingle();

    return json({
      configured: Boolean(clientId && clientSecret && redirectUri),
      connected: data?.status === "connected",
      status: data?.status ?? "disconnected",
      provider_user_id: data?.provider_user_id ?? null,
      connected_at: data?.connected_at ?? null,
      synced_at: sync?.synced_at ?? null,
      detail: sync?.detail ?? {},
    });
  }

  if (action === "authorize") {
    if (!clientId || !clientSecret || !redirectUri) {
      return json(
        {
          error:
            "Withings is not configured. Add WITHINGS_CLIENT_ID, WITHINGS_CLIENT_SECRET, and WITHINGS_REDIRECT_URI under Edge Functions → Secrets.",
        },
        400,
      );
    }

    const state = crypto.randomUUID();
    const { data: existing } = await admin
      .from("health_connections")
      .select("detail, status, connected_at")
      .eq("user_id", userId)
      .eq("provider", "withings")
      .maybeSingle();

    await admin.from("health_connections").upsert({
      user_id: userId,
      provider: "withings",
      status: existing?.status === "connected" ? "connected" : "disconnected",
      connected_at: existing?.connected_at ?? null,
      detail: { ...(existing?.detail ?? {}), oauth_state: state },
    });

    const url = new URL(WITHINGS_AUTH);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", "user.info,user.metrics,user.activity");
    url.searchParams.set("redirect_uri", redirectUri);

    return json({ url: url.toString(), state });
  }

  if (action === "callback") {
    if (!clientId || !clientSecret || !redirectUri) {
      return json({ error: "Withings is not configured on the server" }, 400);
    }
    const code = String(payload.code ?? "");
    const state = String(payload.state ?? "");
    if (!code || !state) return json({ error: "Missing code or state" }, 400);

    const { data: existing } = await admin
      .from("health_connections")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", "withings")
      .maybeSingle();

    const expected = (existing?.detail as Record<string, unknown> | null)?.oauth_state;
    if (!expected || expected !== state) {
      return json({ error: "Invalid OAuth state — try Connect again" }, 400);
    }

    try {
      const body = await withingsTokenRequest({
        action: "requesttoken",
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      });

      const now = new Date().toISOString();
      const detail = { ...(existing?.detail ?? {}) };
      delete detail.oauth_state;

      await admin.from("health_connections").upsert({
        user_id: userId,
        provider: "withings",
        status: "connected",
        access_token: body.access_token,
        refresh_token: body.refresh_token,
        expires_at: new Date(Date.now() + body.expires_in * 1000).toISOString(),
        provider_user_id: String(body.userid),
        connected_at: now,
        detail: { ...detail, scope: body.scope ?? null },
      });

      await admin.from("integration_sync").upsert({
        user_id: userId,
        service: "withings",
        synced_at: null,
        detail: { connected: true, provider_user_id: String(body.userid) },
      });

      return json({ ok: true, provider_user_id: String(body.userid) });
    } catch (err) {
      await admin.from("health_connections").upsert({
        user_id: userId,
        provider: "withings",
        status: "error",
        detail: {
          ...(existing?.detail ?? {}),
          last_error: err instanceof Error ? err.message : String(err),
        },
      });
      return json({ error: err instanceof Error ? err.message : String(err) }, 400);
    }
  }

  if (action === "disconnect") {
    await admin.from("health_connections").upsert({
      user_id: userId,
      provider: "withings",
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
      service: "withings",
      synced_at: null,
      detail: { connected: false },
    });
    return json({ ok: true });
  }

  if (action === "sync") {
    const { data: conn } = await admin
      .from("health_connections")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", "withings")
      .maybeSingle();

    if (!conn || conn.status !== "connected") {
      return json({ error: "Connect Withings first" }, 400);
    }

    try {
      const token = await ensureAccessToken(admin, userId, conn as ConnRow);
      const start = ymdDaysAgo(30);
      const end = ymdDaysAgo(0);

      const activity = await withingsPost(token, "/v2/measure", {
        action: "getactivity",
        startdateymd: start,
        enddateymd: end,
        data_fields: "steps,distance,calories,totalcalories",
      });

      const meas = await withingsPost(token, "/measure", {
        action: "getmeas",
        meastypes: "1,6", // weight kg, body fat %
        category: "1",
        startdate: String(Math.floor(Date.now() / 1000) - 30 * 86400),
        enddate: String(Math.floor(Date.now() / 1000)),
      });

      type MetricRow = {
        user_id: string;
        metric_date: string;
        metric_type: string;
        value: number;
        unit: string;
        source: string;
        external_id: string;
        recorded_at?: string;
      };

      const rows: MetricRow[] = [];

      for (const day of activity?.activities ?? []) {
        const date = String(day.date);
        if (day.steps != null) {
          rows.push({
            user_id: userId,
            metric_date: date,
            metric_type: "steps",
            value: Number(day.steps),
            unit: "count",
            source: "withings",
            external_id: `activity:steps:${date}`,
          });
        }
        if (day.calories != null) {
          rows.push({
            user_id: userId,
            metric_date: date,
            metric_type: "active_calories",
            value: Number(day.calories),
            unit: "kcal",
            source: "withings",
            external_id: `activity:active_calories:${date}`,
          });
        }
        if (day.totalcalories != null) {
          rows.push({
            user_id: userId,
            metric_date: date,
            metric_type: "total_calories",
            value: Number(day.totalcalories),
            unit: "kcal",
            source: "withings",
            external_id: `activity:total_calories:${date}`,
          });
        }
        if (day.distance != null) {
          rows.push({
            user_id: userId,
            metric_date: date,
            metric_type: "distance_m",
            value: Number(day.distance),
            unit: "m",
            source: "withings",
            external_id: `activity:distance:${date}`,
          });
        }
      }

      for (const grp of meas?.measuregrps ?? []) {
        const recorded = new Date((grp.date ?? 0) * 1000);
        const date = recorded.toISOString().slice(0, 10);
        for (const m of grp.measures ?? []) {
          const value = Number(m.value) * Math.pow(10, Number(m.unit ?? 0));
          if (m.type === 1) {
            rows.push({
              user_id: userId,
              metric_date: date,
              metric_type: "weight_kg",
              value,
              unit: "kg",
              source: "withings",
              external_id: `meas:weight:${grp.grpid ?? date}`,
              recorded_at: recorded.toISOString(),
            });
          } else if (m.type === 6) {
            rows.push({
              user_id: userId,
              metric_date: date,
              metric_type: "body_fat_pct",
              value,
              unit: "%",
              source: "withings",
              external_id: `meas:fat:${grp.grpid ?? date}`,
              recorded_at: recorded.toISOString(),
            });
          }
        }
      }

      // One row per (day, type, source). Later readings win.
      const byKey = new Map<string, MetricRow>();
      for (const row of rows) {
        byKey.set(`${row.metric_date}:${row.metric_type}`, row);
      }
      const deduped = [...byKey.values()];

      if (deduped.length) {
        const { error } = await admin.from("health_metrics").upsert(deduped, {
          onConflict: "user_id,metric_date,metric_type,source",
          ignoreDuplicates: false,
        });
        if (error) throw error;
      }

      const now = new Date().toISOString();
      await admin.from("integration_sync").upsert({
        user_id: userId,
        service: "withings",
        synced_at: now,
        detail: {
          connected: true,
          metrics_upserted: deduped.length,
          range: { start, end },
        },
      });

      return json({ ok: true, metrics_upserted: deduped.length, synced_at: now });
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : String(err) }, 400);
    }
  }

  return json({ error: `Unknown action '${action}'` }, 400);
});
