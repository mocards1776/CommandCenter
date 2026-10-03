import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { fetchPushBoards } from "./boards.ts";
import {
  crossingAlerts,
  dramaInput,
  favoriteFinalNote,
  favoriteSide,
  favoriteStartNote,
  gameKey,
  gamePhase,
  heatNote,
  liveDrama,
  type AlertKind,
  type PhaseSnapshot,
  type PushFavorite,
  type PushGame,
  type PushNote,
} from "./live-drama.ts";

/**
 * Sports PWA web push.
 *
 * Subscribe / prefs: signed-in user JWT (verified here; deploy with
 * --no-verify-jwt so the cron sweep can call in).
 * Sweep: Authorization bearer equals SUPABASE_SERVICE_ROLE_KEY, or header
 * x-sports-push-cron equals SPORTS_PUSH_CRON_SECRET.
 *
 * Secrets (Supabase → Edge Functions → Secrets), never committed:
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…)
 *   SPORTS_PUSH_CRON_SECRET
 *   SPORTS_PUSH_ORIGIN  (https://command-center-flax-gamma.vercel.app)
 *
 * Generate a key pair locally:
 *   npx web-push generate-vapid-keys
 */

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sports-push-cron",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BADGE_PATH = "/icon-mlb-192.png";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function admin(): SupabaseClient | null {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function bearer(req: Request): string {
  return (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
}

function sweepAuthorized(req: Request): boolean {
  const token = bearer(req);
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (token && service && token === service) return true;
  const expected = Deno.env.get("SPORTS_PUSH_CRON_SECRET") ?? "";
  const got = req.headers.get("x-sports-push-cron") ?? "";
  return Boolean(expected && got && got === expected);
}

async function userId(req: Request): Promise<string | null> {
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const token = bearer(req);
  if (!url || !anon || !token) return null;
  const client = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

function vapid(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY")?.trim() ?? "";
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY")?.trim() ?? "";
  const subject = Deno.env.get("VAPID_SUBJECT")?.trim() || "mailto:sports@commandcenter.local";
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

function origin(): string {
  const raw = Deno.env.get("SPORTS_PUSH_ORIGIN")?.trim() || "https://command-center-flax-gamma.vercel.app";
  return raw.replace(/\/$/, "");
}

function parseFavorites(raw: unknown): PushFavorite[] {
  if (!Array.isArray(raw)) return [];
  const out: PushFavorite[] = [];
  for (const row of raw.slice(0, 40)) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const key = String(rec.key ?? "").slice(0, 80);
    const sport = String(rec.sport ?? "").toLowerCase().slice(0, 16);
    const teamId = String(rec.teamId ?? "").replace(/\D/g, "").slice(0, 12);
    const shortName = String(rec.shortName ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
    if (!key || !/^[a-z0-9.-]+$/.test(sport) || !teamId || !shortName) continue;
    out.push({ key, sport, teamId, shortName });
  }
  return out;
}

function parseSubscription(raw: unknown): { endpoint: string; p256dh: string; auth: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const endpoint = String(rec.endpoint ?? "");
  const keys = rec.keys as Record<string, unknown> | undefined;
  const p256dh = String(keys?.p256dh ?? "");
  const authKey = String(keys?.auth ?? "");
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 2000) return null;
  if (p256dh.length < 8 || p256dh.length > 200 || authKey.length < 8 || authKey.length > 200) return null;
  return { endpoint, p256dh, auth: authKey };
}

type SubRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  heat_alerts: boolean;
  favorite_alerts: boolean;
  favorites: unknown;
};

type WebPush = {
  setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
  sendNotification: (
    sub: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string,
    options?: { TTL?: number; urgency?: string },
  ) => Promise<{ statusCode?: number }>;
};

let vapidReady = false;

async function webPush(): Promise<WebPush | null> {
  const keys = vapid();
  if (!keys) return null;
  const mod = (await import("npm:web-push@3.6.7")) as { default?: WebPush } & WebPush;
  const lib = mod.default ?? mod;
  if (!vapidReady) {
    lib.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
    vapidReady = true;
  }
  return lib;
}

function absoluteNote(note: PushNote): PushNote {
  const root = origin();
  const icon = note.icon && /^https?:/i.test(note.icon) ? note.icon : `${root}${BADGE_PATH}`;
  const url = note.url.startsWith("http") ? note.url : `${root}${note.url}`;
  return { ...note, icon, url };
}

async function sendOne(lib: WebPush, sub: SubRow, note: PushNote): Promise<"ok" | "gone" | "fail"> {
  const payload = absoluteNote(note);
  try {
    const res = await lib.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: payload.icon,
        badge: `${origin()}${BADGE_PATH}`,
        tag: payload.tag,
        url: payload.url,
      }),
      { TTL: 60 * 60 * 2, urgency: "high" },
    );
    const code = res?.statusCode ?? 201;
    if (code === 404 || code === 410) return "gone";
    return "ok";
  } catch (err) {
    const code = (err as { statusCode?: number })?.statusCode;
    if (code === 404 || code === 410) return "gone";
    console.error("push send failed", code ?? err);
    return "fail";
  }
}

async function claim(db: SupabaseClient, game: string, reason: AlertKind): Promise<boolean> {
  const { error } = await db.from("sports_push_sent").insert({ game_key: game, reason });
  if (!error) return true;
  if (String(error.code) === "23505" || /duplicate/i.test(error.message)) return false;
  console.error("claim failed", error.message);
  return false;
}

async function release(db: SupabaseClient, game: string, reason: AlertKind): Promise<void> {
  await db.from("sports_push_sent").delete().eq("game_key", game).eq("reason", reason);
}

function noteFor(
  kind: AlertKind,
  game: PushGame,
  fav: PushFavorite | null,
): PushNote | null {
  if (kind === "heat") {
    const input = dramaInput(game);
    if (!input) return null;
    return heatNote(game, liveDrama(input));
  }
  if (!fav) return null;
  if (kind === "favorite-start") return favoriteStartNote(game, fav);
  return favoriteFinalNote(game, fav);
}

async function sweep(db: SupabaseClient, dryRun: boolean): Promise<Response> {
  const [games, subsRes] = await Promise.all([
    fetchPushBoards(),
    db
      .from("sports_push_subscriptions")
      .select("id, endpoint, p256dh, auth, heat_alerts, favorite_alerts, favorites"),
  ]);
  if (subsRes.error) return json({ error: subsRes.error.message }, 500);
  const subs = (subsRes.data ?? []) as SubRow[];

  const keys = games.map(gameKey);
  const prev = new Map<string, PhaseSnapshot>();
  for (let i = 0; i < keys.length; i += 100) {
    const chunk = keys.slice(i, i + 100);
    if (!chunk.length) continue;
    const { data, error } = await db
      .from("sports_push_game_state")
      .select("game_key, phase, hot")
      .in("game_key", chunk);
    if (error) return json({ error: error.message }, 500);
    for (const row of data ?? []) {
      prev.set(String(row.game_key), {
        phase: row.phase as PhaseSnapshot["phase"],
        hot: Boolean(row.hot),
      });
    }
  }

  const lib = dryRun ? null : await webPush();
  if (!dryRun && !lib) {
    return json(
      { error: "VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are not set on the sports-push function" },
      503,
    );
  }

  let baselined = 0;
  let fired = 0;
  let delivered = 0;
  const preview: { game: string; kind: AlertKind; title: string; body: string }[] = [];
  const gone = new Set<string>();
  const nowIso = new Date().toISOString();

  for (const game of games) {
    const key = gameKey(game);
    const input = dramaInput(game);
    const drama = input ? liveDrama(input) : { score: 0, hot: false, why: "", reasons: [] };
    const next: PhaseSnapshot = { phase: gamePhase(game), hot: drama.hot && game.live && !game.final };
    const before = prev.get(key) ?? null;
    const kinds = crossingAlerts(before, next);
    if (!before) baselined += 1;

    let persist = !dryRun;
    for (const kind of kinds) {
      const targets = recipients(subs, kind, game);
      if (dryRun) {
        const sample = noteFor(kind, game, targets[0]?.fav ?? null);
        if (sample) preview.push({ game: key, kind, title: sample.title, body: sample.body });
        continue;
      }
      const claimed = await claim(db, key, kind);
      if (!claimed) continue;
      fired += 1;
      if (!targets.length || !lib) continue;
      let ok = 0;
      for (const target of targets) {
        const note = noteFor(kind, game, target.fav);
        if (!note) continue;
        const result = await sendOne(lib, target.sub, note);
        if (result === "gone") gone.add(target.sub.id);
        if (result === "ok") {
          ok += 1;
          delivered += 1;
        }
      }
      // Keep the previous phase so the next sweep still sees the cross.
      if (ok === 0) {
        await release(db, key, kind);
        persist = false;
      }
    }

    if (!persist) continue;
    const { error: upErr } = await db.from("sports_push_game_state").upsert(
      {
        game_key: key,
        phase: next.phase,
        hot: next.hot,
        drama_score: drama.score,
        updated_at: nowIso,
      },
      { onConflict: "game_key" },
    );
    if (upErr) console.error("state upsert", upErr.message);
  }

  if (!dryRun) {
    if (gone.size) {
      await db.from("sports_push_subscriptions").delete().in("id", [...gone]);
    }
    await db.from("sports_push_game_state").delete().lt("updated_at", daysAgo(3));
    await db.from("sports_push_sent").delete().lt("sent_at", daysAgo(10));
  }

  return json({
    ok: true,
    games: games.length,
    subscriptions: subs.length,
    baselined,
    fired,
    delivered,
    dryRun,
    preview: dryRun ? preview.slice(0, 40) : undefined,
  });
}

function recipients(
  subs: SubRow[],
  kind: AlertKind,
  game: PushGame,
): { sub: SubRow; fav: PushFavorite | null }[] {
  const out: { sub: SubRow; fav: PushFavorite | null }[] = [];
  for (const sub of subs) {
    if (kind === "heat") {
      if (sub.heat_alerts) out.push({ sub, fav: null });
      continue;
    }
    if (!sub.favorite_alerts) continue;
    const fav = parseFavorites(sub.favorites).find((f) => favoriteSide(game, f));
    if (fav) out.push({ sub, fav });
  }
  return out;
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const action = String(body.action ?? "");
  const db = admin();
  if (!db) return json({ error: "Supabase service role is not available" }, 500);

  if (action === "vapid-public-key") {
    const keys = vapid();
    if (!keys) return json({ error: "VAPID public key is not configured", publicKey: null }, 200);
    return json({ publicKey: keys.publicKey });
  }

  if (action === "sweep") {
    if (!sweepAuthorized(req)) return json({ error: "Not authorized to sweep" }, 401);
    return sweep(db, body.dryRun === true);
  }

  const uid = await userId(req);
  if (!uid) return json({ error: "Sign in required" }, 401);

  if (action === "status") {
    const { data, error } = await db
      .from("sports_push_subscriptions")
      .select("heat_alerts, favorite_alerts")
      .eq("user_id", uid);
    if (error) return json({ error: error.message }, 500);
    const rows = data ?? [];
    return json({
      subscribed: rows.length > 0,
      heatAlerts: rows.length ? rows.some((r) => r.heat_alerts) : true,
      favoriteAlerts: rows.some((r) => r.favorite_alerts),
      vapidConfigured: Boolean(vapid()),
    });
  }

  if (action === "unsubscribe") {
    const { error } = await db.from("sports_push_subscriptions").delete().eq("user_id", uid);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  const heatAlerts = body.heatAlerts !== false;
  const favoriteAlerts = body.favoriteAlerts === true;
  const favorites = parseFavorites(body.favorites);

  if (action === "prefs") {
    const { error } = await db
      .from("sports_push_subscriptions")
      .update({
        heat_alerts: heatAlerts,
        favorite_alerts: favoriteAlerts,
        favorites,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", uid);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, heatAlerts, favoriteAlerts });
  }

  if (action === "subscribe") {
    const sub = parseSubscription(body.subscription);
    if (!sub) return json({ error: "Subscription is missing endpoint or keys" }, 400);
    const { error } = await db.from("sports_push_subscriptions").upsert(
      {
        user_id: uid,
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
        heat_alerts: heatAlerts,
        favorite_alerts: favoriteAlerts,
        favorites,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, heatAlerts, favoriteAlerts });
  }

  return json({ error: "Unknown action" }, 400);
});
