import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
// @deno-types="./front.bundle.d.ts"
import { frontStories, type FrontStory } from "./front.bundle.js";

/**
 * Thompson Times "edition ready" alerts on @ThompsonTimes_bot.
 *
 * Cron (times-telegram-alerts) calls this every 5 minutes with the anon key,
 * the same way thompson-times-press calls newspaper-press. Each run looks for
 * issues that went `ready` within WINDOW_HOURS and have no row in
 * public.times_telegram_alerts, claims the row, then sends one message per
 * chat in TIMES_TELEGRAM_CHAT_IDS. The claim makes every edition alert once,
 * even if two runs overlap or a run is retried. Older issues never alert.
 *
 * A specific issue (`{"issue_id": "..."}`) may be sent only with the
 * x-times-telegram-admin header matching TIMES_TELEGRAM_ADMIN_SECRET. It still
 * claims first, so it never re-sends an edition that already alerted.
 *
 * Secrets: TIMES_TELEGRAM_BOT_TOKEN, TIMES_TELEGRAM_CHAT_IDS,
 * TIMES_TELEGRAM_ADMIN_SECRET (optional). Never the Sports App bots.
 */

const APP_ORIGIN = "https://command-center-flax-gamma.vercel.app";
/** The Times itself; /times.html is the Home Screen launcher and only redirects when standalone. */
const PAPER_URL = `${APP_ORIGIN}/newspaper?solo=1`;
/** Only issues that went ready this recently alert. Keeps a first run from backfilling. */
const WINDOW_HOURS = 6;
/** A claim with no successful send may be retried after this long. */
const RETRY_AFTER_MS = 10 * 60_000;
const MAX_ATTEMPTS = 3;

const SLOT_LABEL: Record<string, string> = {
  morning: "Morning Edition",
  midday: "Midday Edition",
  evening: "Evening Edition",
};

/** AP style, the way a masthead dateline reads. */
const AP_MONTHS = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];

type IssueRow = { id: string; status: string; printed_at: string; stories: unknown };
type AlertRow = { issue_id: string; claimed_at: string; sent_at: string | null; attempts: number };
type SendResult = { chat: string; ok: boolean; message_id?: number; error?: string };

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** "2026-10-05-morning" → "Monday Morning Edition" and "Oct. 5". */
export function editionTitle(id: string): { title: string; date: string } {
  const m = /^(\d{4}-\d{2}-\d{2})-(\w+)$/.exec(id);
  if (!m) return { title: "New Edition", date: "" };
  const d = new Date(`${m[1]}T12:00:00Z`);
  const weekday = d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  const date = `${AP_MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  return { title: `${weekday} ${SLOT_LABEL[m[2]] ?? "Edition"}`, date };
}

/** A1's lead plus up to two more front stories, as the paper sets them. */
function frontFor(issue: IssueRow): FrontStory[] {
  try {
    return frontStories(Array.isArray(issue.stories) ? issue.stories : [], issue.id);
  } catch (err) {
    console.error("times-telegram: front failed", issue.id, err instanceof Error ? err.message : String(err));
    return [];
  }
}

export function alertText(issueId: string, front: FrontStory[]): string {
  const { title, date } = editionTitle(issueId);
  const lines = [`📰 <b>Thompson Times</b>`, `<i>${escapeHtml(title)}${date ? ` · ${escapeHtml(date)}` : ""}</i>`];
  const [lead, ...rest] = front;
  if (lead) {
    lines.push("", `<b>${escapeHtml(clip(lead.headline, 200))}</b>`);
    if (rest.length) {
      lines.push("", "Also on the front:");
      for (const story of rest.slice(0, 2)) lines.push(`• ${escapeHtml(clip(story.headline, 140))}`);
    }
  } else {
    lines.push("", "The new edition is off the press.");
  }
  return lines.join("\n");
}

function replyMarkup() {
  return { inline_keyboard: [[{ text: "Read the paper", web_app: { url: PAPER_URL } }]] };
}

async function sendAll(token: string, chats: string[], text: string): Promise<SendResult[]> {
  const results: SendResult[] = [];
  for (const chat of chats) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chat,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: replyMarkup(),
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; result?: { message_id?: number }; description?: string }
        | null;
      if (body?.ok) results.push({ chat, ok: true, message_id: body.result?.message_id });
      else results.push({ chat, ok: false, error: body?.description ?? `HTTP ${res.status}` });
    } catch (err) {
      results.push({ chat, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}

/** Take the alert row for this issue. False when another run has it or it already went out. */
async function claim(db: SupabaseClient, issueId: string): Promise<boolean> {
  const { data: inserted, error } = await db
    .from("times_telegram_alerts")
    .upsert({ issue_id: issueId }, { onConflict: "issue_id", ignoreDuplicates: true })
    .select("issue_id");
  if (error) throw new Error(error.message);
  if (inserted?.length) return true;

  const { data: row } = await db
    .from("times_telegram_alerts")
    .select("issue_id, claimed_at, sent_at, attempts")
    .eq("issue_id", issueId)
    .maybeSingle<AlertRow>();
  if (!row || row.sent_at || row.attempts >= MAX_ATTEMPTS) return false;
  if (Date.now() - new Date(row.claimed_at).getTime() < RETRY_AFTER_MS) return false;
  // Re-take a failed claim only if nobody else did since we read it.
  const { data: retaken } = await db
    .from("times_telegram_alerts")
    .update({ claimed_at: new Date().toISOString(), attempts: row.attempts + 1 })
    .eq("issue_id", issueId)
    .eq("claimed_at", row.claimed_at)
    .is("sent_at", null)
    .select("issue_id");
  return Boolean(retaken?.length);
}

async function alertIssue(db: SupabaseClient, token: string, chats: string[], issue: IssueRow) {
  if (!(await claim(db, issue.id))) return { id: issue.id, skipped: true };
  const front = frontFor(issue);
  const text = alertText(issue.id, front);
  const results = await sendAll(token, chats, text);
  const sent = results.some((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  const { error } = await db
    .from("times_telegram_alerts")
    .update({
      sent_at: sent ? new Date().toISOString() : null,
      headline: front[0]?.headline ?? null,
      chats: results.map((r) => ({ chat: r.chat, ok: r.ok, message_id: r.message_id ?? null })),
      error: failed.length ? failed.map((r) => `${r.chat}: ${r.error}`).join("; ").slice(0, 500) : null,
    })
    .eq("issue_id", issue.id);
  if (error) console.error("times-telegram: record failed", issue.id, error.message);
  return {
    id: issue.id,
    sent,
    headline: front[0]?.headline ?? null,
    results: results.map((r) => ({ ok: r.ok, message_id: r.message_id ?? null, error: r.error ?? null })),
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Expected POST", { status: 405 });

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const token = Deno.env.get("TIMES_TELEGRAM_BOT_TOKEN");
  const chats = (Deno.env.get("TIMES_TELEGRAM_CHAT_IDS") ?? "")
    .split(/[\s,]+/)
    .map((c) => c.trim())
    .filter(Boolean);
  if (!url || !key) return Response.json({ ok: false, error: "Missing Supabase env" }, { status: 500 });
  if (!token || !chats.length) return Response.json({ ok: false, error: "Missing Times Telegram env" }, { status: 500 });

  let body: { issue_id?: unknown } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    body = {};
  }

  const db = createClient(url, key, { auth: { persistSession: false } });
  try {
    let issues: IssueRow[];
    if (typeof body.issue_id === "string" && body.issue_id) {
      const admin = Deno.env.get("TIMES_TELEGRAM_ADMIN_SECRET");
      if (!admin || req.headers.get("x-times-telegram-admin") !== admin) {
        return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
      }
      const { data, error } = await db
        .from("newspaper_issues")
        .select("id, status, printed_at, stories")
        .eq("id", body.issue_id)
        .eq("status", "ready")
        .maybeSingle<IssueRow>();
      if (error) throw new Error(error.message);
      if (!data) return Response.json({ ok: false, error: "No ready issue with that id" }, { status: 404 });
      issues = [data];
    } else {
      const since = new Date(Date.now() - WINDOW_HOURS * 3_600_000).toISOString();
      const { data: recent, error } = await db
        .from("newspaper_issues")
        .select("id, printed_at")
        .eq("status", "ready")
        .gte("printed_at", since)
        .order("printed_at", { ascending: true })
        .limit(5);
      if (error) throw new Error(error.message);
      const ids = (recent ?? []).map((r) => r.id as string);
      if (!ids.length) return Response.json({ ok: true, alerts: [] });
      const { data: done } = await db
        .from("times_telegram_alerts")
        .select("issue_id, sent_at, attempts")
        .in("issue_id", ids);
      const finished = new Set(
        (done ?? []).filter((r) => r.sent_at || r.attempts >= MAX_ATTEMPTS).map((r) => r.issue_id as string),
      );
      const pending = ids.filter((id) => !finished.has(id));
      if (!pending.length) return Response.json({ ok: true, alerts: [] });
      const { data, error: storiesError } = await db
        .from("newspaper_issues")
        .select("id, status, printed_at, stories")
        .in("id", pending)
        .eq("status", "ready")
        .order("printed_at", { ascending: true });
      if (storiesError) throw new Error(storiesError.message);
      issues = (data ?? []) as IssueRow[];
    }

    const alerts = [];
    for (const issue of issues) alerts.push(await alertIssue(db, token, chats, issue));
    return Response.json({ ok: true, alerts });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("times-telegram:", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
