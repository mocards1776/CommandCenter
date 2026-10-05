import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { gameReplyMarkup } from "../_shared/telegram-markup.ts";
import {
  collectGoalClips,
  fetchGoalClipsForGame,
  loadClubGame,
  resolveEspnEventId,
  sortClips,
  type GoalClip,
} from "./nhl-clips.ts";
import {
  lookbackHours,
  maxSends,
  nhlGamePath,
  parseChatIds,
  parseTeamFilter,
} from "./select.ts";
import { sendTelegramVideo } from "./telegram.ts";

/**
 * Telegram goal MP4s for @CommandCenterHighlights_bot.
 *
 * Source: NHL gamecenter landing clips resolved through Brightcove — the same
 * path the Sports app already uses. v1 is Blues-only unless HIGHLIGHTS_TEAM_IDS
 * lists more clubs. Each clip id is claimed in sports_highlights_sent so a
 * cron rerun never resends.
 *
 * Secrets (never commit the token):
 *   TELEGRAM_HIGHLIGHTS_BOT_TOKEN
 *   TELEGRAM_HIGHLIGHTS_CRON_SECRET  (falls back to SPORTS_PUSH_CRON_SECRET)
 *   TELEGRAM_HIGHLIGHTS_CHAT_IDS     allowlist, default 857547432
 *   HIGHLIGHTS_TEAM_IDS              STL or 19 — default STL
 *   HIGHLIGHTS_LOOKBACK_HOURS        default 72
 *   HIGHLIGHTS_MAX_SENDS             default 6
 *   SPORTS_HIGHLIGHTS_ORIGIN         game links; falls back to SPORTS_PUSH_ORIGIN
 *
 * Sweep: POST { "action": "sweep" } with header x-sports-highlights-cron.
 * Preview: POST { "action": "sweep", "dryRun": true }.
 * One clip: POST { "action": "send", "nhlGameId": "2026020020", "clipId": "6406147120112" }.
 * Local one-clip dry-run / send: scripts/highlights-send-one.ts
 */

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sports-highlights-cron, x-sports-push-cron",
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
  const expected = [
    Deno.env.get("TELEGRAM_HIGHLIGHTS_CRON_SECRET") ?? "",
    Deno.env.get("SPORTS_PUSH_CRON_SECRET") ?? "",
  ]
    .map((value) => value.trim())
    .filter(Boolean);
  const got = (
    req.headers.get("x-sports-highlights-cron") ??
    req.headers.get("x-sports-push-cron") ??
    ""
  ).trim();
  return Boolean(got && expected.some((value) => value === got));
}

function origin(): string {
  const raw =
    Deno.env.get("SPORTS_HIGHLIGHTS_ORIGIN")?.trim() ||
    Deno.env.get("SPORTS_PUSH_ORIGIN")?.trim() ||
    "https://command-center-flax-gamma.vercel.app";
  return raw.replace(/\/$/, "");
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

type Claim = "ok" | "dup" | "error";

async function claim(db: SupabaseClient, clip: GoalClip): Promise<Claim> {
  const { error } = await db.from("sports_highlights_sent").insert({
    highlight_id: clip.highlightId,
    source: "nhl",
    team_abbrev: clip.teamAbbrev,
    nhl_game_id: clip.nhlGameId,
    espn_event_id: clip.espnEventId,
    caption: clip.caption,
    sharing_url: clip.sharingUrl,
  });
  if (!error) return "ok";
  if (String(error.code) === "23505" || /duplicate/i.test(error.message)) return "dup";
  console.error("highlights claim", error.message);
  return "error";
}

async function release(db: SupabaseClient, highlightId: string): Promise<void> {
  await db.from("sports_highlights_sent").delete().eq("highlight_id", highlightId);
}

function previewRow(clip: GoalClip) {
  return {
    highlightId: clip.highlightId,
    caption: clip.caption,
    nhlGameId: clip.nhlGameId,
    espnEventId: clip.espnEventId,
    mp4: clip.mp4,
    durationSec: clip.durationSec,
  };
}

async function deliver(clip: GoalClip, chats: string[], token: string) {
  const results = await sendTelegramVideo({
    token,
    videoUrl: clip.mp4,
    caption: clip.caption,
    chatIds: chats,
    replyMarkup: gameReplyMarkup(origin(), nhlGamePath(clip.espnEventId)),
    durationSec: clip.durationSec,
    width: clip.width,
    height: clip.height,
  });
  const sent = results.filter((row) => row.ok).length;
  if (!sent) {
    const first = results.find((row) => row.error)?.error ?? "sendVideo failed";
    throw new Error(first);
  }
  return results;
}

async function alreadySent(db: SupabaseClient, ids: string[]): Promise<Set<string>> {
  const sent = new Set<string>();
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    if (!chunk.length) continue;
    const { data, error } = await db.from("sports_highlights_sent").select("highlight_id").in(
      "highlight_id",
      chunk,
    );
    if (error) throw new Error(error.message);
    for (const row of data ?? []) sent.add(String(row.highlight_id));
  }
  return sent;
}

async function sweep(db: SupabaseClient, dryRun: boolean, clips: GoalClip[]): Promise<Response> {
  const chats = parseChatIds(Deno.env.get("TELEGRAM_HIGHLIGHTS_CHAT_IDS"));
  const token = Deno.env.get("TELEGRAM_HIGHLIGHTS_BOT_TOKEN")?.trim() ?? "";
  const cap = dryRun ? 20 : maxSends(Deno.env.get("HIGHLIGHTS_MAX_SENDS"));
  if (!dryRun && !token) return json({ error: "TELEGRAM_HIGHLIGHTS_BOT_TOKEN is not set" }, 503);
  if (!dryRun && !chats.length) return json({ error: "TELEGRAM_HIGHLIGHTS_CHAT_IDS is empty" }, 503);

  const sent = await alreadySent(db, clips.map((clip) => clip.highlightId));
  let delivered = 0;
  let skipped = 0;
  let deferred = 0;
  const preview: ReturnType<typeof previewRow>[] = [];
  const errors: { highlightId: string; error: string }[] = [];

  for (const clip of clips) {
    if (sent.has(clip.highlightId)) {
      skipped += 1;
      continue;
    }
    if (delivered + preview.length >= cap) {
      deferred += 1;
      continue;
    }
    if (dryRun) {
      preview.push(previewRow(clip));
      continue;
    }
    const claimed = await claim(db, clip);
    if (claimed === "error") {
      errors.push({ highlightId: clip.highlightId, error: "claim failed" });
      continue;
    }
    if (claimed === "dup") {
      skipped += 1;
      continue;
    }
    try {
      await deliver(clip, chats, token);
      delivered += 1;
    } catch (err) {
      await release(db, clip.highlightId);
      const message = err instanceof Error ? err.message : "send failed";
      errors.push({ highlightId: clip.highlightId, error: message });
      console.error("highlights send", clip.highlightId, message);
    }
  }

  if (!dryRun) {
    await db.from("sports_highlights_sent").delete().lt("sent_at", daysAgo(45));
  }

  return json({
    ok: errors.length === 0,
    teams: parseTeamFilter(Deno.env.get("HIGHLIGHTS_TEAM_IDS")).nhlAbbrevs,
    lookbackHours: lookbackHours(Deno.env.get("HIGHLIGHTS_LOOKBACK_HOURS")),
    found: clips.length,
    skipped,
    delivered,
    deferred,
    dryRun,
    chats: chats.length,
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
  const action = String(body.action ?? "sweep");
  const dryRun = body.dryRun === true;
  const filter = parseTeamFilter(
    typeof body.teamIds === "string" ? body.teamIds : Deno.env.get("HIGHLIGHTS_TEAM_IDS"),
  );
  const hours = lookbackHours(
    body.lookbackHours != null
      ? String(body.lookbackHours)
      : Deno.env.get("HIGHLIGHTS_LOOKBACK_HOURS"),
  );

  try {
    if (action === "sweep" || action === "send") {
      const db = admin();
      if (!db) return json({ error: "Supabase service role is not available" }, 500);
      const nhlGameId = String(body.nhlGameId ?? "").replace(/\D/g, "");
      const clipId = String(body.clipId ?? body.highlightId ?? "").replace(/^nhl-/, "").replace(/\D/g, "");
      let clips: GoalClip[];
      if (nhlGameId) {
        const game = await loadClubGame(nhlGameId);
        if (!game) return json({ error: `NHL game ${nhlGameId} not found` }, 404);
        const espnEventId = await resolveEspnEventId(game);
        clips = await fetchGoalClipsForGame(game, filter, espnEventId);
      } else {
        clips = await collectGoalClips(filter, hours);
      }
      if (clipId) clips = clips.filter((clip) => clip.clipId === clipId);
      clips = sortClips(clips);
      if (action === "send" && dryRun) {
        return json({
          ok: true,
          dryRun: true,
          found: clips.length,
          clips: clips.map(previewRow),
        });
      }
      return await sweep(db, action === "sweep" && dryRun, clips);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "highlights failed";
    console.error("highlights", action, message);
    return json({ error: message }, 500);
  }

  return json({ error: "Unknown action" }, 400);
});
