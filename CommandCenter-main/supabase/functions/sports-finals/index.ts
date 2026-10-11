import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { fetchPushBoards } from "../sports-push/boards.ts";
import { dramaInput, liveDrama, type PushGame } from "../sports-push/live-drama.ts";
import { alertReplyMarkup } from "../_shared/telegram-markup.ts";
import { finalCaption, loadFinalCard, SUMMARY_PATH, type FinalCard } from "./card.ts";
import {
  decideAlbum,
  emptyAlbumFavorites,
  loadAlbumFavorites,
  type AlbumFavorites,
} from "./favorites.ts";
import { fetchPower4Cfb, mergeFinalsBoards } from "./finals-boards.ts";
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
  type FavoriteToken,
  type WatchSnap,
} from "./select.ts";
import { renderFinalPage2Svg, renderFinalSvg } from "./svg.ts";
import {
  DELIVER_TIMEOUT_MS,
  deliverOnce,
  parseDeliverResponse,
  planSweep,
  runDeliveries,
  type DeliverOutcome,
} from "./sweep.ts";
import {
  loadPngToJpeg,
  prepareTelegramPhoto,
  sendPreparedAlbum,
  sendPreparedPhoto,
  sendTelegramAlbum,
  sendTelegramPhoto,
  type TelegramPhotoPayload,
} from "./telegram.ts";

/**
 * Telegram final-score photos for @FinalsAndStats_bot.
 *
 * The game-detail React view is the wrong share target: Tailwind cannot be
 * rasterized here. This function builds a post-game card from the same ESPN
 * summary (score, records, linescore, team stats, box leaders, win-probability
 * series, pregame odds) and sends it with sendPhoto (high-quality JPEG when
 * we can encode one; PNG if it still fits the 10MB photo cap). Games that
 * involve a Command Center favorite team or player send a two-page album
 * (scoreboard + detail). The live field stays off the graphic.
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
 *        Every NFL final and every Power 4 / Notre Dame college final sends;
 *        MLB, NHL, and other college games follow TELEGRAM_FINALS_SCOPE.
 *        The sweep posts each final to { "action": "deliver" } (its own
 *        request and CPU budget), which renders, claims, then sends.
 * Test:  POST { "action": "send", "sport": "nfl", "eventId": "401872964" }.
 * PNG:   POST { "action": "render", "sport": "nfl", "eventId": "401872964" }.
 *        POST { "action": "render", "page": 2, ... } for the album verso.
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

type PreparedFinal = {
  caption: string;
  replyMarkup: string | null;
  photos: TelegramPhotoPayload[];
  album: boolean;
  reason: string | null;
};

/** All the CPU work for one final (SVG → PNG → JPEG). Nothing is sent or claimed here. */
async function prepareFinal(card: FinalCard, board: AlbumFavorites): Promise<PreparedFinal> {
  const album = decideAlbum(card, board);
  const caption = finalCaption(card, origin());
  const replyMarkup = alertReplyMarkup(origin(), card.path);
  const encode = await loadPngToJpeg();
  const pages = [await rasterizeSvg(renderFinalSvg(card))];
  if (album.album) pages.push(await rasterizeSvg(renderFinalPage2Svg(card, album)));
  return {
    caption,
    replyMarkup,
    photos: pages.map((png) => prepareTelegramPhoto(png, encode)),
    album: album.album,
    reason: album.reason,
  };
}

async function sendPrepared(prepared: PreparedFinal, chats: string[], token: string): Promise<void> {
  for (const chatId of chats) {
    if (prepared.photos.length > 1) {
      await sendPreparedAlbum(token, chatId, prepared.photos, prepared.caption, prepared.replyMarkup);
    } else {
      await sendPreparedPhoto(token, chatId, prepared.photos[0]!, prepared.caption, prepared.replyMarkup);
    }
  }
}

/**
 * One sweep final, in its own request. Render first, then claim, then send:
 * a CPU kill during render leaves no sent row, so the next sweep retries.
 */
async function deliverFinal(db: SupabaseClient, sport: string, eventId: string): Promise<Response> {
  const chats = parseChatIds(Deno.env.get("TELEGRAM_FINALS_CHAT_IDS"));
  const token = Deno.env.get("TELEGRAM_FINALS_BOT_TOKEN")?.trim() ?? "";
  if (!token) return json({ status: "error", error: "TELEGRAM_FINALS_BOT_TOKEN is not set" }, 503);
  if (!chats.length) return json({ status: "error", error: "TELEGRAM_FINALS_CHAT_IDS is empty" }, 503);
  const key = `${sport}:${eventId}`;
  let board: AlbumFavorites = emptyAlbumFavorites();
  const result = await deliverOnce({
    alreadySent: async () => {
      const { data, error } = await db.from("sports_finals_sent").select("game_key").eq("game_key", key).maybeSingle();
      if (error) throw new Error(error.message);
      return Boolean(data);
    },
    load: async () => {
      const [card, favs] = await Promise.all([
        loadFinalCard(sport, eventId, { waitForStars: true }),
        loadAlbumFavorites(db),
      ]);
      board = favs;
      return card;
    },
    prepare: (card) => prepareFinal(card, board),
    claim: () => claim(db, key, sport, eventId),
    send: async (prepared) => {
      await sendPrepared(prepared, chats, token);
      return { pages: prepared.photos.length, album: prepared.album };
    },
    release: () => release(db, key),
  });
  switch (result.status) {
    case "sent":
      return json({ status: "sent", game: key, ...(result.value as object) });
    case "dup":
      return json({ status: "dup", game: key });
    case "not-final":
      return json({ status: "not-final", game: key }, 409);
    default:
      console.error("finals deliver", key, result.stage, result.error);
      return json({ status: "error", error: result.error }, result.stage === "send" ? 502 : 500);
  }
}

async function deliverViaWorker(game: PushGame): Promise<DeliverOutcome> {
  const base = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  if (!base) return { status: "retry", error: "SUPABASE_URL is not set" };
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (service) headers.Authorization = `Bearer ${service}`;
  const cron = (Deno.env.get("TELEGRAM_FINALS_CRON_SECRET") || Deno.env.get("SPORTS_PUSH_CRON_SECRET") || "").trim();
  if (cron) headers["x-sports-finals-cron"] = cron;
  const res = await fetch(`${base}/functions/v1/sports-finals`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "deliver", sport: game.sport, eventId: game.id }),
    signal: AbortSignal.timeout(DELIVER_TIMEOUT_MS),
  });
  return parseDeliverResponse(res.status, await res.text());
}

async function sweep(db: SupabaseClient, dryRun: boolean): Promise<Response> {
  const sports = parseSports(Deno.env.get("TELEGRAM_FINALS_SPORTS"));
  const scope = parseScope(Deno.env.get("TELEGRAM_FINALS_SCOPE"));
  const chats = parseChatIds(Deno.env.get("TELEGRAM_FINALS_CHAT_IDS"));
  const token = Deno.env.get("TELEGRAM_FINALS_BOT_TOKEN")?.trim() ?? "";
  if (!dryRun && !token) return json({ error: "TELEGRAM_FINALS_BOT_TOKEN is not set" }, 503);
  if (!dryRun && !chats.length) return json({ error: "TELEGRAM_FINALS_CHAT_IDS is empty" }, 503);

  const [pushGames, power4Games, favs] = await Promise.all([
    fetchPushBoards(),
    sports.includes("cfb") ? fetchPower4Cfb() : Promise.resolve([]),
    favorites(db),
  ]);
  const board = mergeFinalsBoards(pushGames, power4Games);
  const tracked = board.games.filter((game) => sports.includes(game.sport));
  const keys = tracked.map((game) => `${game.sport}:${game.id}`);
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

  const rows = planSweep({
    games: tracked,
    prev,
    sent,
    scope,
    favorites: favs,
    power4Cfb: board.power4,
    hot: (game) => {
      const input = dramaInput(game);
      return input ? liveDrama(input).hot : false;
    },
  });
  const baselined = rows.filter((row) => !row.before).length;
  const wanted = rows.filter((row) => row.want && row.before);

  if (dryRun) {
    return json({
      ok: true,
      games: tracked.length,
      power4Cfb: board.power4.size,
      sports,
      scope,
      favorites: favs.length,
      chats: chats.length,
      baselined,
      fired: wanted.length,
      dryRun,
      preview: wanted.slice(0, 20).map((row) => ({
        game: row.key,
        always: row.always,
        captionHint: `${row.game.away.abbrev} ${row.game.away.score ?? "–"}–${row.game.home.abbrev} ${row.game.home.score ?? "–"}`,
      })),
    });
  }

  const report = await runDeliveries(rows, deliverViaWorker);
  for (const row of report.errors) console.error("finals deliver", row.game, row.error);

  const nowIso = new Date().toISOString();
  const watchRows = rows.map((row) => ({
    game_key: row.key,
    phase: report.phases.get(row.key) ?? row.phase,
    ever_hot: row.everHot,
    updated_at: nowIso,
  }));
  for (let i = 0; i < watchRows.length; i += 500) {
    const { error } = await db
      .from("sports_finals_watch")
      .upsert(watchRows.slice(i, i + 500), { onConflict: "game_key" });
    if (error) console.error("finals watch", error.message);
  }

  await db.from("sports_finals_watch").delete().lt("updated_at", daysAgo(4));
  await db.from("sports_finals_sent").delete().lt("sent_at", daysAgo(21));

  return json({
    ok: report.errors.length === 0,
    games: tracked.length,
    power4Cfb: board.power4.size,
    sports,
    scope,
    favorites: favs.length,
    chats: chats.length,
    baselined,
    fired: report.delivered.length + report.dup.length,
    delivered: report.delivered.length,
    deferred: report.deferred.length,
    dryRun,
    errors: report.errors.length ? report.errors : undefined,
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
      const db = admin();
      const board = db ? await loadAlbumFavorites(db) : emptyAlbumFavorites();
      const forceAlbum = body.album === true ? true : body.album === false ? false : null;
      const album = forceAlbum === false ? { album: false, reason: null, teams: [], featured: [], teamPerformers: [] } : decideAlbum(card, board);
      const wantAlbum = forceAlbum === true || album.album;
      const page1 = await rasterizeSvg(renderFinalSvg(card));
      const page2 = wantAlbum
        ? await rasterizeSvg(renderFinalPage2Svg(card, album.album ? album : { ...album, album: true }))
        : null;
      const caption = finalCaption(card, origin());
      const replyMarkup = alertReplyMarkup(origin(), card.path);
      const wantPage = Number(body.page) === 2 ? 2 : 1;
      const png = wantPage === 2 && page2 ? page2 : page1;
      const meta = {
        sport,
        eventId,
        status: card.statusLabel,
        caption,
        bytes: page1.byteLength + (page2?.byteLength ?? 0),
        pages: wantAlbum ? 2 : 1,
        album: wantAlbum,
        albumReason: album.reason,
        featured: album.featured.map((row) => row.name),
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
      if (wantAlbum && page2) {
        for (const chatId of chats) await sendTelegramAlbum(token, chatId, [page1, page2], caption, replyMarkup);
      } else {
        for (const chatId of chats) await sendTelegramPhoto(token, chatId, page1, caption, replyMarkup);
      }
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

  if (action === "deliver") {
    const sport = String(body.sport ?? "").toLowerCase();
    const eventId = String(body.eventId ?? "").replace(/\D/g, "");
    if (!SUMMARY_PATH[sport] || !eventId) {
      return json({ status: "error", error: "sport and eventId are required" }, 400);
    }
    const db = admin();
    if (!db) return json({ status: "error", error: "Supabase service role is not available" }, 500);
    try {
      return await deliverFinal(db, sport, eventId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "deliver failed";
      console.error("finals deliver", sport, eventId, message);
      return json({ status: "error", error: message }, 500);
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
