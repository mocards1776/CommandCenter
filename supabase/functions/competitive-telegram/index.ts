import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { competitiveCaption, loadTciLogoDataUri, sd30SampleCard } from "./card.ts";
import { rasterizeSvg } from "./png.ts";
import { renderCompetitiveSvg } from "./svg.ts";
import { parseChatIds, sendTelegramPhoto } from "./telegram.ts";

/**
 * Competitive Telegram card renderer for Thompson Communications.
 *
 * SVG → PNG → JPEG q≈95, then sendPhoto. Same path as sports-finals.
 * Do not screenshot the Times site.
 *
 * Secrets (never commit the token):
 *   TELEGRAM_COMPETITIVE_BOT_TOKEN
 *   TELEGRAM_COMPETITIVE_CRON_SECRET
 *   TELEGRAM_COMPETITIVE_CHAT_IDS
 *
 * POST { "action": "render" }             → JPEG (SD-30 sample)
 * POST { "action": "render", "format": "png" | "svg" }
 * POST { "action": "send" }               → sendPhoto
 * POST { "action": "send", "dryRun": true }
 */

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-competitive-telegram-cron",
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

function authorized(req: Request): boolean {
  const token = bearer(req);
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (token && service && token === service) return true;
  const expected = (Deno.env.get("TELEGRAM_COMPETITIVE_CRON_SECRET") ?? "").trim();
  const got = (req.headers.get("x-competitive-telegram-cron") ?? "").trim();
  return Boolean(got && expected && got === expected);
}

async function buildCard() {
  const logo = await loadTciLogoDataUri();
  return sd30SampleCard(logo);
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

  const action = String(body.action ?? "render");
  if (action !== "render" && action !== "send") return json({ error: "Unknown action" }, 400);

  try {
    const card = await buildCard();
    const svg = renderCompetitiveSvg(card);
    const caption = competitiveCaption(card);
    const format = String(body.format ?? (action === "render" ? "jpeg" : "jpeg")).toLowerCase();

    if (action === "render" && format === "svg") {
      return new Response(svg, {
        headers: { ...CORS, "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
      });
    }

    const png = await rasterizeSvg(svg);
    if (action === "render" && format === "png") {
      return new Response(png, {
        headers: { ...CORS, "Content-Type": "image/png", "Cache-Control": "no-store" },
      });
    }

    if (action === "render") {
      const { pngToJpeg } = await import("./telegram-jpeg.ts");
      const jpeg = pngToJpeg(png, 95);
      return new Response(jpeg, {
        headers: { ...CORS, "Content-Type": "image/jpeg", "Cache-Control": "no-store" },
      });
    }

    const meta = {
      race: card.race,
      market: card.market,
      buyers: card.buyers.map((row) => ({
        name: row.name,
        spend: row.spend,
        grp: row.grp,
        cpp: row.cpp,
      })),
      caption,
      bytes: png.byteLength,
    };
    if (body.dryRun === true) return json({ ok: true, dryRun: true, ...meta });

    const token = Deno.env.get("TELEGRAM_COMPETITIVE_BOT_TOKEN")?.trim() ?? "";
    if (!token) return json({ error: "TELEGRAM_COMPETITIVE_BOT_TOKEN is not set" }, 503);
    const chats = parseChatIds(Deno.env.get("TELEGRAM_COMPETITIVE_CHAT_IDS"));
    if (!chats.length) return json({ error: "TELEGRAM_COMPETITIVE_CHAT_IDS is empty" }, 503);
    for (const chatId of chats) await sendTelegramPhoto(token, chatId, png, caption);
    return json({ ok: true, chats, ...meta });
  } catch (err) {
    const message = err instanceof Error ? err.message : "render failed";
    console.error("competitive-telegram", action, message);
    return json({ error: message }, 500);
  }
});
