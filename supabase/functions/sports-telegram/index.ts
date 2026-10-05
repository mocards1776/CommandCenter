import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { heatAlertCaption } from "../_shared/heat-alert/copy.ts";
import { HeatAlertLookupError, loadHeatAlertCard } from "../_shared/heat-alert/fetch-game.ts";
import { embedLogos } from "../_shared/heat-alert/logos.ts";
import { renderHeatAlertSvg } from "../_shared/heat-alert/svg.ts";
import { parseChatAllowlist, resolveChatTargets, sendTelegramPhoto } from "../_shared/heat-alert/telegram.ts";
import { alertReplyMarkup } from "../_shared/telegram-markup.ts";
import { bytesToBase64 } from "../_shared/heat-alert/binary.ts";
import { rasterizeHeatAlert } from "./raster.ts";

/**
 * Tall RUWT heat-alert photos.
 *
 * Render does not need Telegram. Send calls sendPhoto for chats listed in
 * TELEGRAM_CHAT_IDS. Heat copy is the caller's `reason` (RUWT owns that line).
 * Open game and RUWT board are inline keyboard URL buttons, not caption links.
 *
 * Auth: Authorization bearer equals SUPABASE_SERVICE_ROLE_KEY, or header
 * x-sports-telegram-secret equals SPORTS_TELEGRAM_SECRET.
 * Deploy with --no-verify-jwt so the sports-push sweep can call in.
 *
 * Secrets (never commit):
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_CHAT_IDS          comma-separated numeric chat ids
 *   SPORTS_TELEGRAM_SECRET     optional, for manual curl without the service role
 *   SPORTS_PUSH_ORIGIN         open-game link origin
 */

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sports-telegram-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

function authorized(req: Request): boolean {
  const token = bearer(req);
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (token && service && token === service) return true;
  const expected = Deno.env.get("SPORTS_TELEGRAM_SECRET") ?? "";
  const got = req.headers.get("x-sports-telegram-secret") ?? "";
  return Boolean(expected && got && got === expected);
}

function origin(): string {
  return (
    Deno.env.get("SPORTS_PUSH_ORIGIN")?.trim() ||
    Deno.env.get("HEAT_ALERT_ORIGIN")?.trim() ||
    "https://command-center-flax-gamma.vercel.app"
  );
}

type Job = {
  action: "render" | "send";
  sport: string | null;
  gameId: string | null;
  reason: string | null;
  chatId: string | null;
  format: "png" | "json";
};

async function readJob(req: Request): Promise<Job> {
  const url = new URL(req.url);
  let body: Record<string, unknown> = {};
  if (req.method === "POST") {
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }
  }
  const pick = (key: string): string | null => {
    const fromBody = body[key];
    const raw = typeof fromBody === "string" ? fromBody : url.searchParams.get(key);
    const text = (raw ?? "").trim();
    return text || null;
  };
  const action = pick("action") === "send" ? "send" : "render";
  const format = pick("format") === "json" ? "json" : "png";
  return {
    action,
    sport: pick("sport"),
    gameId: pick("gameId") ?? pick("game"),
    reason: pick("reason"),
    chatId: pick("chatId"),
    format,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "GET or POST" }, 405);
  if (!authorized(req)) return json({ error: "Not authorized" }, 401);

  const job = await readJob(req);
  if (req.method === "GET" && job.action === "send") {
    return json({ error: "Sending a photo requires POST" }, 405);
  }

  let card;
  try {
    card = await loadHeatAlertCard({ sport: job.sport, gameId: job.gameId });
  } catch (err) {
    const message = err instanceof HeatAlertLookupError ? err.message : "Could not load that game";
    const status = err instanceof HeatAlertLookupError ? 404 : 502;
    return json({ error: message }, status);
  }

  const caption = heatAlertCaption(job.reason);
  const replyMarkup = alertReplyMarkup(origin(), card.gamePath);
  let png: Uint8Array;
  try {
    const withLogos = await embedLogos(card);
    png = await rasterizeHeatAlert(renderHeatAlertSvg(withLogos));
  } catch (err) {
    console.error("heat alert raster", err);
    return json({ error: "Could not render the alert photo" }, 500);
  }

  if (job.action === "render") {
    if (job.format === "json") {
      return json({
        ok: true,
        sport: card.sport,
        gameId: card.gameId,
        detail: card.detail,
        caption,
        width: 1080,
        height: 1350,
        pngBase64: bytesToBase64(png),
      });
    }
    return new Response(png, {
      status: 200,
      headers: {
        ...CORS,
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
        "X-Heat-Game": `${card.sport}:${card.gameId}`,
      },
    });
  }

  const token = Deno.env.get("TELEGRAM_BOT_TOKEN")?.trim() ?? "";
  if (!token) return json({ error: "TELEGRAM_BOT_TOKEN is not set" }, 503);
  const allow = parseChatAllowlist(
    Deno.env.get("TELEGRAM_CHAT_IDS") ?? Deno.env.get("TELEGRAM_CHAT_ID") ?? "",
  );
  const targets = resolveChatTargets(allow, job.chatId);
  if (!targets.ok) return json({ error: targets.error }, allow.length ? 403 : 503);

  const chats = await sendTelegramPhoto({
    token,
    png,
    caption,
    chatIds: targets.ids,
    filename: `${card.sport}-${card.gameId}.png`,
    replyMarkup,
  });
  const sent = chats.filter((row) => row.ok).length;
  return json(
    {
      ok: sent > 0,
      sport: card.sport,
      gameId: card.gameId,
      detail: card.detail,
      caption,
      chats,
    },
    sent > 0 ? 200 : 502,
  );
});
