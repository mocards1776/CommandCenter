import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { fetchPushBoards } from "../sports-push/boards.ts";
import { dramaInput, gameKey, gamePhase, liveDrama, type PushGame } from "../sports-push/live-drama.ts";
import { alertReplyMarkup } from "../_shared/telegram-markup.ts";
import { finalCaption, loadFinalCard, SUMMARY_PATH } from "./card.ts";
import { rasterizeSvg } from "./png.ts";
import {
  buildEveningPreview,
  claimPreview,
  deliverPreview,
  markPreviewSent,
  previewJsonMeta,
  releasePreview,
  renderEveningPreviewPng,
} from "./preview.ts";
import { previewCaption } from "./preview-slate.ts";
import {
  parseChatIds,
  parseFavoriteTokens,
  parseScope,
  parseSports,
  shouldSendFinal,
  type FavoriteToken,
  type WatchSnap,
} from "./select.ts";
import { renderFinalSvg } from "./svg.ts";
import { sendTelegramPhoto } from "./telegram.ts";

/**
 * Telegram final-score photos for @FinalsAndStats_bot.
 *
 * The game-detail React view is the wrong share target: Tailwind cannot be
 * rasterized here. This function builds a post-game card from the same ESPN
 * summary (score, records, linescore, team stats, box leaders, win-probability
 * series, pregame odds) and sends it with sendPhoto (high-quality JPEG when
 * we can encode one; PNG if it still fits the 10MB photo cap). The live field stays off
 * the graphic; the in-app NFL/CFB pages also hide it after the whistle.
 *
 * Secrets (never commit the token):
 *   TELEGRAM_FINALS_BOT_TOKEN
 *   TELEGRAM_FINALS_CRON_SECRET   (falls back to SPORTS_PUSH_CRON_SECRET)
 *   TELEGRAM_FINALS_CHAT_IDS      allowlist, default 857547432
 *   TELEGRAM_FINALS_SCOPE         favorites,ruwt | all
 *   TELEGRAM_FINALS_SPORTS        default nfl,cfb,mlb,nhl when unset
 *   TELEGRAM_FINALS_FAVORITES     nfl:11,cfb:333 or nfl:CLE — overrides push favorites
 *   SPORTS_FINALS_ORIGIN          game links; falls back to SPORTS_PUSH_ORIGIN
 *
 * Sweep: POST { "action": "sweep" } with header x-sports-finals-cron.
 * Test:  POST { "action": "send", "sport": "nfl", "eventId": "401872964" }.
 * PNG:   POST { "action": "render", "sport": "nfl", "eventId": "401872964" }.
 * Evening preview (RUWT Today's Top, ~5pm CT):
 *   POST { "action": "evening-preview" }
 *   POST { "action": "evening-preview", "dryRun": true }
 *   POST { "action": "evening-preview", "render": true }  → PNG
 */

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sports-finals-cron, x-sports-push-cron",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_SENDS = 2;

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

function authorized(req: Request): boolean {
  const token = bearer(req);
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (token && service && token === service) return true;
  const expected = [Deno.env.get("TELEGRAM_FINALS_CRON_SECRET") ?? "", Deno.env.get("SPORTS_PUSH_CRON_SECRET") ?? ""]
    .map((value) => value.trim())
    .filter(Boolean);
  const got = (req.headers.get("x-sports-finals-cron") ?? req.headers.get("x-sports-push-cron") ?? "").trim();
  return Boolean(got && expected.some((value) => value === got));
}

function origin(): string {
  const raw =
    Deno.env.get("SPORTS_FINALS_ORIGIN")?.trim() ||
    Deno.env.get("SPORTS_PUSH_ORIGIN")?.trim() ||
    "https://command-center-flax-gamma.vercel.app";
  return raw.replace(/\/$/, "");
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

type Claim = "ok" | "dup" | "error";

async function claim(db: SupabaseClient, key: string, sport: string, eventId: string): Promise<Claim> {
  const { error } = await db.from("sports_finals_sent").insert({
    game_key: key,
    sport,
    event_id: eventId,
  });
  if (!error) return "ok";
  if (String(error.code) === "23505" || /duplicate/i.test(error.message)) return "dup";
  console.error("finals claim", error.message);
  return "error";
}

async function release(db: SupabaseClient, key: string): Promise<void> {
  await db.from("sports_finals_sent").delete().eq("game_key", key);
}

async function favorites(db: SupabaseClient): Promise<FavoriteToken[]> {
  const raw = Deno.env.get("TELEGRAM_FINALS_FAVORITES");
  if (raw && raw.trim()) return parseFavoriteTokens(raw);
  const { data, error } = await db.from("sports_push_subscriptions").select("favorite_alerts, favorites");
  if (error) {
    console.error("finals favorites", error.message);
    return [];
  }
  const out: FavoriteToken[] = [];
  for (const row of data ?? []) {
    if (!row.favorite_alerts || !Array.isArray(row.favorites)) continue;
    for (const fav of row.favorites) {
      if (!fav || typeof fav !== "object") continue;
      const rec = fav as Record<string, unknown>;
      const sport = String(rec.sport ?? "").toLowerCase();
      const teamId = String(rec.teamId ?? "").replace(/\D/g, "");
      if (!sport || !teamId) continue;
      out.push({ sport, token: teamId });
    }
  }
  return out;
}

async function deliver(game: PushGame, chats: string[], token: string): Promise<{ caption: string; bytes: number }> {
  const card = await loadFinalCard(game.sport, game.id, { waitForStars: true });
  if (!card.final) throw new Error(`${game.sport}:${game.id} is not final`);
  const png = await rasterizeSvg(renderFinalSvg(card));
  const caption = finalCaption(card, origin());
  const replyMarkup = alertReplyMarkup(origin(), card.path);
  for (const chatId of chats) {
    await sendTelegramPhoto(token, chatId, png, caption, replyMarkup);
  }
  return { caption, bytes: png.byteLength };
}

async function sweep(db: SupabaseClient, dryRun: boolean): Promise<Response> {
  const sports = parseSports(Deno.env.get("TELEGRAM_FINALS_SPORTS"));
  const scope = parseScope(Deno.env.get("TELEGRAM_FINALS_SCOPE"));
  const chats = parseChatIds(Deno.env.get("TELEGRAM_FINALS_CHAT_IDS"));
  const token = Deno.env.get("TELEGRAM_FINALS_BOT_TOKEN")?.trim() ?? "";
  if (!dryRun && !token) return json({ error: "TELEGRAM_FINALS_BOT_TOKEN is not set" }, 503);
  if (!dryRun && !chats.length) return json({ error: "TELEGRAM_FINALS_CHAT_IDS is empty" }, 503);

  const [games, favs] = await Promise.all([fetchPushBoards(), favorites(db)]);
  const tracked = games.filter((game) => sports.includes(game.sport));
  const keys = tracked.map(gameKey);
  const prev = new Map<string, WatchSnap>();
  const sent = new Set<string>();
  for (let i = 0; i < keys.length; i += 100) {
    const chunk = keys.slice(i, i + 100);
    if (!chunk.length) continue;
    const [watchRes, sentRes] = await Promise.all([
      db.from("sports_finals_watch").select("game_key, phase, ever_hot").in("game_key", chunk),
      db.from("sports_finals_sent").select("game_key").in("game_key", chunk),
    ]);
    if (watchRes.error) return json({ error: watchRes.error.message }, 500);
    if (sentRes.error) return json({ error: sentRes.error.message }, 500);
    for (const row of watchRes.data ?? []) {
      const phase = String(row.phase);
      if (phase !== "pregame" && phase !== "live" && phase !== "final") continue;
      prev.set(String(row.game_key), { phase, everHot: Boolean(row.ever_hot) });
    }
    for (const row of sentRes.data ?? []) sent.add(String(row.game_key));
  }

  let baselined = 0;
  let fired = 0;
  let delivered = 0;
  let deferred = 0;
  const preview: { game: string; captionHint: string }[] = [];
  const errors: { game: string; error: string }[] = [];
  const nowIso = new Date().toISOString();

  for (const game of tracked) {
    const key = gameKey(game);
    const before = prev.get(key) ?? null;
    if (!before) baselined += 1;
    const phase = gamePhase(game);
    const input = dramaInput(game);
    const hot = input ? liveDrama(input).hot : false;
    const everHot = Boolean(before?.everHot) || hot;
    const want = shouldSendFinal({
      scope,
      favorites: favs,
      sport: game.sport,
      away: { id: game.away.id, abbrev: game.away.abbrev },
      home: { id: game.home.id, abbrev: game.home.abbrev },
      prev: before,
      nextPhase: phase,
      everHot,
      alreadySent: sent.has(key),
    });

    let phaseToStore = phase;
    const cap = dryRun ? 20 : MAX_SENDS;
    if (want && before) {
      if (fired >= cap) {
        phaseToStore = before.phase;
        deferred += 1;
      } else if (dryRun) {
        fired += 1;
        preview.push({
          game: key,
          captionHint: `${game.away.abbrev} ${game.away.score ?? "–"}–${game.home.abbrev} ${game.home.score ?? "–"}`,
        });
      } else {
        const claimed = await claim(db, key, game.sport, game.id);
        if (claimed === "error") {
          phaseToStore = before.phase;
          errors.push({ game: key, error: "claim failed" });
        } else if (claimed === "dup") {
          fired += 1;
        } else {
          try {
            await deliver(game, chats, token);
            fired += 1;
            delivered += 1;
          } catch (err) {
            await release(db, key);
            phaseToStore = before.phase;
            const message = err instanceof Error ? err.message : "send failed";
            errors.push({ game: key, error: message });
            console.error("finals send", key, message);
          }
        }
      }
    }

    if (dryRun) continue;
    const { error } = await db.from("sports_finals_watch").upsert(
      {
        game_key: key,
        phase: phaseToStore,
        ever_hot: everHot,
        updated_at: nowIso,
      },
      { onConflict: "game_key" },
    );
    if (error) console.error("finals watch", error.message);
  }

  if (!dryRun) {
    await db.from("sports_finals_watch").delete().lt("updated_at", daysAgo(4));
    await db.from("sports_finals_sent").delete().lt("sent_at", daysAgo(21));
  }

  return json({
    ok: errors.length === 0,
    games: tracked.length,
    sports,
    scope,
    favorites: favs.length,
    chats: chats.length,
    baselined,
    fired,
    delivered,
    deferred,
    dryRun,
    preview: dryRun ? preview : undefined,
    errors: errors.length ? errors : undefined,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!authorized(req)) return json({ error: "Not authorized" }, 401);

  let body: Record<string, unknown> = {};
  try {
    const text = await req.text();
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const action = String(body.action ?? "");

  if (action === "render" || action === "send") {
    const sport = String(body.sport ?? "").toLowerCase();
    const eventId = String(body.eventId ?? "").replace(/\D/g, "");
    if (!SUMMARY_PATH[sport] || !eventId) {
      return json({ error: "sport and eventId are required" }, 400);
    }
    try {
      const card = await loadFinalCard(sport, eventId, { waitForStars: action === "send" });
      if (action === "send" && body.allowLive !== true && !card.final) {
        return json({ error: "Game is not final" }, 409);
      }
      const png = await rasterizeSvg(renderFinalSvg(card));
      const caption = finalCaption(card, origin());
      const replyMarkup = alertReplyMarkup(origin(), card.path);
      const meta = {
        sport,
        eventId,
        status: card.statusLabel,
        caption,
        bytes: png.byteLength,
        winProbability: card.winProbability.length,
        stats: card.stats.map((stat) => stat.label),
        leaders: card.leaders.length,
      };
      if (action === "render") {
        return new Response(png, {
          headers: { ...CORS, "Content-Type": "image/png", "Cache-Control": "no-store" },
        });
      }
      if (body.dryRun === true) return json({ ok: true, dryRun: true, ...meta });
      const token = Deno.env.get("TELEGRAM_FINALS_BOT_TOKEN")?.trim() ?? "";
      if (!token) return json({ error: "TELEGRAM_FINALS_BOT_TOKEN is not set" }, 503);
      let chats = parseChatIds(Deno.env.get("TELEGRAM_FINALS_CHAT_IDS"));
      if (body.chatId != null && String(body.chatId).trim()) {
        const chatId = String(body.chatId).trim();
        if (!chats.includes(chatId)) return json({ error: "chat_id is not on the finals allowlist" }, 403);
        chats = [chatId];
      }
      if (!chats.length) return json({ error: "TELEGRAM_FINALS_CHAT_IDS is empty" }, 503);
      for (const chatId of chats) await sendTelegramPhoto(token, chatId, png, caption, replyMarkup);
      if (body.record !== false) {
        const db = admin();
        if (db) {
          await db.from("sports_finals_sent").upsert(
            { game_key: `${sport}:${eventId}`, sport, event_id: eventId, sent_at: new Date().toISOString() },
            { onConflict: "game_key" },
          );
        }
      }
      return json({ ok: true, chats, ...meta });
    } catch (err) {
      const message = err instanceof Error ? err.message : "render failed";
      console.error("finals", action, message);
      return json({ error: message }, 500);
    }
  }

  if (action === "sweep") {
    const db = admin();
    if (!db) return json({ error: "Supabase service role is not available" }, 500);
    try {
      return await sweep(db, body.dryRun === true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "sweep failed";
      console.error("finals sweep", message);
      return json({ error: message }, 500);
    }
  }

  if (action === "evening-preview" || action === "preview") {
    try {
      const build = await buildEveningPreview();
      const meta = previewJsonMeta(build);
      if (build.skipped === "empty") {
        return json({ ok: true, dryRun: body.dryRun === true, ...meta });
      }
      if (body.render === true) {
        const png = await renderEveningPreviewPng(build.display, build.chicagoDate);
        return new Response(png, {
          headers: { ...CORS, "Content-Type": "image/png", "Cache-Control": "no-store" },
        });
      }
      if (body.dryRun === true) {
        return json({
          ok: true,
          dryRun: true,
          caption: previewCaption(build.display, build.chicagoDate),
          ...meta,
        });
      }
      const token = Deno.env.get("TELEGRAM_FINALS_BOT_TOKEN")?.trim() ?? "";
      if (!token) return json({ error: "TELEGRAM_FINALS_BOT_TOKEN is not set" }, 503);
      let chats = parseChatIds(Deno.env.get("TELEGRAM_FINALS_CHAT_IDS"));
      if (body.chatId != null && String(body.chatId).trim()) {
        const chatId = String(body.chatId).trim();
        if (!chats.includes(chatId)) return json({ error: "chat_id is not on the finals allowlist" }, 403);
        chats = [chatId];
      }
      if (!chats.length) return json({ error: "TELEGRAM_FINALS_CHAT_IDS is empty" }, 503);
      const db = admin();
      if (!db) return json({ error: "Supabase service role is not available" }, 500);
      const claimed = await claimPreview(db, build.chicagoDate);
      if (claimed === "dup") return json({ ok: true, alreadySent: true, ...meta });
      if (claimed === "error") return json({ error: "preview claim failed" }, 500);
      try {
        const sent = await deliverPreview(build.display, build.chicagoDate, chats, token, origin());
        await markPreviewSent(
          db,
          build.chicagoDate,
          build.display.map((g) => g.id),
          sent.bytes,
        );
        return json({ ok: true, chats, caption: sent.caption, bytes: sent.bytes, ...meta });
      } catch (err) {
        await releasePreview(db, build.chicagoDate);
        throw err;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "evening preview failed";
      console.error("finals evening-preview", message);
      return json({ error: message }, 500);
    }
  }

  return json({ error: "Unknown action" }, 400);
});
