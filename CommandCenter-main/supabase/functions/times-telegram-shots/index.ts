import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.9.6";
import { alertText, editionTitle, frontFor, replyMarkup } from "../times-telegram/alert.ts";

/**
 * Thompson Times image alert: the front page (A1) and the weather report,
 * screenshotted by the GitHub Actions runner (.github/workflows/times-telegram-shots.yml,
 * script CommandCenter-main/scripts/times-shots.mjs) and sent by this function.
 *
 *   peek   → is an edition waiting for its image alert? (records the runner heartbeat)
 *   claim  → claim it in public.times_telegram_alerts and mint a short-lived session for
 *            the household desk's user so the runner can open the paper behind the login
 *   send   → multipart front + weather PNGs: photo 1 carries the caption and the
 *            web_app "Read the paper" button, photo 2 is the weather
 *   logout → revoke the minted session once the pictures are taken
 *   release→ the runner failed; let times-telegram send the text alert right away
 *
 * verify_jwt is off because the runner holds no Supabase key. Every call must
 * prove itself instead: a GitHub Actions OIDC token minted for this repo's main-branch
 * workflow (header x-github-oidc, audience "times-telegram-shots"), or the
 * TIMES_TELEGRAM_ADMIN_SECRET (header x-times-telegram-admin) for manual tests.
 * Admin calls with `test: true` never touch the alert ledger.
 */

const REPO = "mocards1776/CommandCenter";
const WORKFLOW_REF = `${REPO}/.github/workflows/times-telegram-shots.yml@refs/heads/main`;
const OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const OIDC_AUDIENCE = "times-telegram-shots";
const JWKS = createRemoteJWKSet(new URL(`${OIDC_ISSUER}/.well-known/jwks`));

/** Same window as the text alert: older editions never alert. */
const WINDOW_HOURS = 6;
/** A claim with no send may be taken again after this long. */
const RETRY_AFTER_MS = 10 * 60_000;
const MAX_PHOTO_BYTES = 9_500_000;

type Caller = "runner" | "admin";
type IssueRow = { id: string; status: string; printed_at: string; stories: unknown };

async function whoIs(req: Request): Promise<Caller | null> {
  const admin = Deno.env.get("TIMES_TELEGRAM_ADMIN_SECRET");
  const given = req.headers.get("x-times-telegram-admin");
  if (admin && given && given === admin) return "admin";
  const oidc = req.headers.get("x-github-oidc");
  if (!oidc) return null;
  try {
    const { payload } = await jwtVerify(oidc, JWKS, { issuer: OIDC_ISSUER, audience: OIDC_AUDIENCE });
    if (payload.repository !== REPO) return null;
    if (payload.ref !== "refs/heads/main") return null;
    if (payload.workflow_ref !== WORKFLOW_REF) return null;
    return "runner";
  } catch (err) {
    console.error("times-telegram-shots: oidc rejected", err instanceof Error ? err.message : String(err));
    return null;
  }
}

function chatIds(): string[] {
  return (Deno.env.get("TIMES_TELEGRAM_CHAT_IDS") ?? "")
    .split(/[\s,]+/)
    .map((c) => c.trim())
    .filter(Boolean);
}

/** Ready editions inside the window that have not alerted and are not being worked. */
async function pendingIssue(db: SupabaseClient): Promise<string | null> {
  const since = new Date(Date.now() - WINDOW_HOURS * 3_600_000).toISOString();
  const { data: recent, error } = await db
    .from("newspaper_issues")
    .select("id, printed_at")
    .eq("status", "ready")
    .gte("printed_at", since)
    .order("printed_at", { ascending: false })
    .limit(5);
  if (error) throw new Error(error.message);
  const ids = (recent ?? []).map((r) => r.id as string);
  if (!ids.length) return null;
  const { data: rows } = await db
    .from("times_telegram_alerts")
    .select("issue_id, claimed_at, sent_at, attempts")
    .in("issue_id", ids);
  const byId = new Map((rows ?? []).map((r) => [r.issue_id as string, r]));
  // Newest first: if two editions are waiting, the reader wants today's front.
  for (const id of ids) {
    const row = byId.get(id);
    if (!row) return id;
  }
  return null;
}

/** Insert the ledger row; false if any run (text or image) already has it. */
async function claimIssue(db: SupabaseClient, issueId: string): Promise<boolean> {
  const { data, error } = await db
    .from("times_telegram_alerts")
    .upsert({ issue_id: issueId, mode: "image" }, { onConflict: "issue_id", ignoreDuplicates: true })
    .select("issue_id");
  if (error) throw new Error(error.message);
  return Boolean(data?.length);
}

/** A session for the household desk's reader, minted without sending any email. */
async function mintSession(db: SupabaseClient, url: string) {
  const { data: desk, error } = await db
    .from("newspaper_desk")
    .select("user_id, fav_order, hidden")
    .eq("id", "household")
    .maybeSingle();
  if (error || !desk?.user_id) throw new Error("No household desk user");
  const { data: who, error: userError } = await db.auth.admin.getUserById(desk.user_id);
  const email = who?.user?.email;
  if (userError || !email) throw new Error("Desk user has no email");
  const { data: link, error: linkError } = await db.auth.admin.generateLink({ type: "magiclink", email });
  const hashed = link?.properties?.hashed_token;
  if (linkError || !hashed) throw new Error(linkError?.message ?? "No magic link");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!anonKey) throw new Error("Missing anon key");
  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: verified, error: verifyError } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: hashed });
  if (verifyError || !verified.session) throw new Error(verifyError?.message ?? "No session");
  return {
    session: verified.session,
    layout: { order: desk.fav_order ?? [], hidden: desk.hidden ?? [], pinnedPlayers: [] },
  };
}

async function telegramPhoto(
  token: string,
  chat: string,
  photo: Blob,
  name: string,
  caption?: string,
  markup?: unknown,
): Promise<{ ok: boolean; message_id?: number; error?: string }> {
  const form = new FormData();
  form.set("chat_id", chat);
  form.set("photo", photo, name);
  if (caption) {
    form.set("caption", caption);
    form.set("parse_mode", "HTML");
  }
  if (markup) form.set("reply_markup", JSON.stringify(markup));
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    const body = (await res.json().catch(() => null)) as
      | { ok?: boolean; result?: { message_id?: number }; description?: string }
      | null;
    if (body?.ok) return { ok: true, message_id: body.result?.message_id };
    return { ok: false, error: body?.description ?? `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Expected POST", { status: 405 });
  const caller = await whoIs(req);
  if (!caller) return json({ ok: false, error: "Unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const token = Deno.env.get("TIMES_TELEGRAM_BOT_TOKEN");
  const chats = chatIds();
  if (!url || !key) return json({ ok: false, error: "Missing Supabase env" }, 500);
  if (!token || !chats.length) return json({ ok: false, error: "Missing Times Telegram env" }, 500);
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const multipart = (req.headers.get("content-type") ?? "").includes("multipart/form-data");
  let form: FormData | null = null;
  let body: Record<string, unknown> = {};
  try {
    if (multipart) form = await req.formData();
    else body = ((await req.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "Bad body" }, 400);
  }
  const field = (name: string) => (form ? form.get(name) : body[name]);
  const action = String(field("action") ?? "");
  const test = caller === "admin" && (field("test") === true || field("test") === "true");
  const askedId = typeof field("issue_id") === "string" ? String(field("issue_id")) : "";
  if (askedId && caller !== "admin" && action !== "send" && action !== "release") {
    return json({ ok: false, error: "Only admin may name an issue" }, 403);
  }

  try {
    if (action === "peek") {
      if (caller === "runner") {
        await db
          .from("times_telegram_runner")
          .upsert({ id: "github-actions", last_poll_at: new Date().toISOString() }, { onConflict: "id" });
      }
      return json({ ok: true, issue_id: askedId || (await pendingIssue(db)) });
    }

    if (action === "claim") {
      const issueId = askedId || (await pendingIssue(db));
      if (!issueId) return json({ ok: true, issue_id: null });
      const { data: issue } = await db
        .from("newspaper_issues")
        .select("id, status, printed_at")
        .eq("id", issueId)
        .eq("status", "ready")
        .maybeSingle();
      if (!issue) return json({ ok: false, error: "No ready issue with that id" }, 404);
      if (!test && !(await claimIssue(db, issueId))) return json({ ok: true, issue_id: null, taken: true });
      try {
        const { session, layout } = await mintSession(db, url);
        return json({ ok: true, issue_id: issueId, printed_at: issue.printed_at, session, layout });
      } catch (err) {
        // Without a session there is no picture; hand the edition back to the text alert.
        if (!test) await releaseIssue(db, issueId, `session: ${err instanceof Error ? err.message : String(err)}`);
        throw err;
      }
    }

    if (action === "logout") {
      const jwt = String(field("access_token") ?? "");
      if (!jwt) return json({ ok: false, error: "access_token required" }, 400);
      const { error } = await db.auth.admin.signOut(jwt, "local");
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "release") {
      if (!askedId) return json({ ok: false, error: "issue_id required" }, 400);
      if (!test) await releaseIssue(db, askedId, String(field("error") ?? "runner failed").slice(0, 300));
      return json({ ok: true });
    }

    if (action === "send") {
      if (!askedId) return json({ ok: false, error: "issue_id required" }, 400);
      const front = form?.get("front");
      const weather = form?.get("weather");
      if (!(front instanceof Blob) || !front.size) return json({ ok: false, error: "front image required" }, 400);
      if (front.size > MAX_PHOTO_BYTES || (weather instanceof Blob && weather.size > MAX_PHOTO_BYTES)) {
        return json({ ok: false, error: "image too large" }, 413);
      }
      if (!test) {
        const { data: row } = await db
          .from("times_telegram_alerts")
          .select("issue_id, sent_at, mode")
          .eq("issue_id", askedId)
          .maybeSingle();
        if (!row || row.sent_at || row.mode !== "image") return json({ ok: true, skipped: true });
      }
      const { data: issue } = await db
        .from("newspaper_issues")
        .select("id, status, printed_at, stories")
        .eq("id", askedId)
        .maybeSingle<IssueRow>();
      if (!issue) return json({ ok: false, error: "No issue" }, 404);
      const front3 = frontFor(issue);
      const caption = alertText(issue.id, front3);
      const { date } = editionTitle(issue.id);
      const results = [];
      for (const chat of chats) {
        const first = await telegramPhoto(token, chat, front, `${issue.id}-front.png`, caption, replyMarkup());
        const second =
          first.ok && weather instanceof Blob && weather.size
            ? await telegramPhoto(token, chat, weather, `${issue.id}-weather.png`, `Weather · Marshfield, Mo. · ${date}`)
            : null;
        results.push({ chat, front: first, weather: second });
      }
      const sent = results.some((r) => r.front.ok);
      const failed = results.filter((r) => !r.front.ok || (r.weather && !r.weather.ok));
      if (!test) {
        await db
          .from("times_telegram_alerts")
          .update({
            sent_at: sent ? new Date().toISOString() : null,
            headline: front3[0]?.headline ?? null,
            chats: results.map((r) => ({
              chat: r.chat,
              ok: r.front.ok,
              message_id: r.front.message_id ?? null,
              weather_message_id: r.weather?.message_id ?? null,
            })),
            error: failed.length
              ? failed.map((r) => `${r.chat}: ${r.front.error ?? r.weather?.error ?? ""}`).join("; ").slice(0, 500)
              : null,
            // A failed image send goes back to the text alert on its next sweep.
            ...(sent ? {} : { claimed_at: new Date(Date.now() - RETRY_AFTER_MS - 60_000).toISOString(), mode: "text" }),
          })
          .eq("issue_id", issue.id);
      }
      return json({
        ok: true,
        sent,
        issue_id: issue.id,
        headline: front3[0]?.headline ?? null,
        results: results.map((r) => ({
          front: { ok: r.front.ok, message_id: r.front.message_id ?? null, error: r.front.error ?? null },
          weather: r.weather ? { ok: r.weather.ok, message_id: r.weather.message_id ?? null, error: r.weather.error ?? null } : null,
        })),
      });
    }

    return json({ ok: false, error: "Unknown action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("times-telegram-shots:", message);
    return json({ ok: false, error: message }, 500);
  }
});

/** Hand an unsent edition back to times-telegram: its next sweep retakes the claim and sends text. */
async function releaseIssue(db: SupabaseClient, issueId: string, reason: string) {
  await db
    .from("times_telegram_alerts")
    .update({
      mode: "text",
      error: `image: ${reason}`.slice(0, 500),
      claimed_at: new Date(Date.now() - RETRY_AFTER_MS - 60_000).toISOString(),
    })
    .eq("issue_id", issueId)
    .is("sent_at", null);
}

