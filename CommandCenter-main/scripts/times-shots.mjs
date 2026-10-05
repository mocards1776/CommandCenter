/**
 * Thompson Times image alert runner: screenshots the edition's front page (A1)
 * and the weather report as they render on a 13-inch iPad, then hands both PNGs
 * to the times-telegram-shots edge function, which sends them on @ThompsonTimes_bot.
 *
 * Run by .github/workflows/times-telegram-shots.yml (auth: GitHub Actions OIDC, no secrets).
 * Manual test from a machine holding the admin secret:
 *   TIMES_TELEGRAM_ADMIN_SECRET=… node scripts/times-shots.mjs --issue 2026-10-04-evening --test --out ./shots
 * Add --no-send to only write the PNGs. --peek only asks whether an edition is waiting
 * (and, from the workflow, records the runner heartbeat) and writes issue=<id> to $GITHUB_OUTPUT.
 *
 * The browser is read-only: every write to Supabase REST and every call to the press or
 * editor functions is aborted, so opening the paper here can never change the desk or an issue.
 */
import { chromium } from "playwright";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const APP = (process.env.TIMES_APP_ORIGIN || "https://command-center-flax-gamma.vercel.app").replace(/\/$/, "");
const SUPABASE_URL = (process.env.TIMES_SUPABASE_URL || "https://esdgrgulaxnewmhjuyzh.supabase.co").replace(/\/$/, "");
const SHOTS_URL = `${SUPABASE_URL}/functions/v1/times-telegram-shots`;
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];
const AUDIENCE = "times-telegram-shots";
/** iPad Pro 13-inch, portrait, in CSS pixels; rendered at 2x. */
const VIEW = { width: 1032, height: 1376 };
const SCALE = 2;
/** Taller than this (CSS px) and the front is cut to its top, so Telegram's 2560px cap keeps it legible. */
const FRONT_MAX_H = 1720;

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const asked = opt("issue");
const test = flag("test");
const send = !flag("no-send");
const outDir = opt("out") || process.env.TIMES_SHOTS_OUT || "times-shots";

function log(...parts) {
  console.log(`[times-shots ${new Date().toISOString()}]`, ...parts);
}

async function authHeaders() {
  const admin = process.env.TIMES_TELEGRAM_ADMIN_SECRET;
  if (admin) return { "x-times-telegram-admin": admin };
  const reqUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const reqToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!reqUrl || !reqToken) throw new Error("No OIDC (needs permissions: id-token: write) and no admin secret");
  const res = await fetch(`${reqUrl}&audience=${encodeURIComponent(AUDIENCE)}`, {
    headers: { Authorization: `Bearer ${reqToken}` },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.value) throw new Error(`OIDC token request failed: ${res.status}`);
  return { "x-github-oidc": body.value };
}

async function call(payload) {
  const res = await fetch(SHOTS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) throw new Error(`${payload.action}: ${body?.error ?? res.status}`);
  return body;
}

/** The edition the stand shows at `now` (mirrors pressEdition in src/lib/newspaper.ts). */
function pressIdAt(now) {
  const day = now.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hourCycle: "h23" })
      .formatToParts(now)
      .find((p) => p.type === "hour")?.value,
  ) % 24;
  if (hour >= 17) return `${day}-evening`;
  if (hour >= 12) return `${day}-midday`;
  if (hour >= 6) return `${day}-morning`;
  const prev = new Date(Date.UTC(...day.split("-").map((n, i) => (i === 1 ? Number(n) - 1 : Number(n)))));
  prev.setUTCDate(prev.getUTCDate() - 1);
  return `${prev.toISOString().slice(0, 10)}-evening`;
}

/** An instant an hour after the edition's press time, Central (DST-safe). */
function instantFor(issueId) {
  const m = /^(\d{4})-(\d{2})-(\d{2})-(morning|midday|evening)$/.exec(issueId);
  if (!m) return null;
  const hour = { morning: 7, midday: 13, evening: 18 }[m[4]];
  for (const offset of [5, 6]) {
    const t = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hour + offset));
    if (pressIdAt(t) === issueId) return t;
  }
  return null;
}

async function settle(page, scope) {
  await page.evaluate(() => document.fonts?.ready);
  await page
    .waitForFunction(
      (sel) => {
        const root = document.querySelector(sel);
        if (!root) return false;
        return [...root.querySelectorAll("img")].every((img) => img.complete);
      },
      scope,
      { timeout: 20_000 },
    )
    .catch(() => log("images still loading in", scope));
  await page.waitForTimeout(1_200);
}

async function shoot(claim) {
  const browser = await chromium.launch({ args: ["--force-color-profile=srgb"] });
  try {
    const context = await browser.newContext({
      viewport: VIEW,
      deviceScaleFactor: SCALE,
      hasTouch: true,
      locale: "en-US",
      timezoneId: "America/Chicago",
      colorScheme: "light",
    });
    const blocked = [];
    await context.route("**/*", (route) => {
      const req = route.request();
      const url = req.url();
      const method = req.method();
      const supa = url.startsWith(SUPABASE_URL);
      if (supa && url.includes("/rest/v1/") && method !== "GET" && method !== "HEAD") {
        blocked.push(`${method} ${new URL(url).pathname}`);
        return route.abort();
      }
      if (supa && /\/functions\/v1\/(newspaper-press|newspaper-editor)/.test(url)) {
        blocked.push(`${method} ${new URL(url).pathname}`);
        return route.abort();
      }
      return route.continue();
    });
    await context.addInitScript(
      ({ key, session, layout }) => {
        try {
          localStorage.setItem(key, JSON.stringify(session));
          localStorage.setItem("sports-layout-v1", JSON.stringify(layout));
          localStorage.setItem("newspaper-solo", "1");
          sessionStorage.setItem("newspaper-solo", "1");
        } catch {}
      },
      { key: `sb-${PROJECT_REF}-auth-token`, session: claim.session, layout: claim.layout },
    );
    const page = await context.newPage();
    page.on("pageerror", (err) => log("page error:", err.message));

    // The stand opens whatever edition the clock says; pin the clock if the alert is for another.
    if (pressIdAt(new Date()) !== claim.issue_id) {
      const at = instantFor(claim.issue_id);
      if (!at) throw new Error(`Cannot place ${claim.issue_id} on the clock`);
      log("pinning clock to", at.toISOString(), "for", claim.issue_id);
      await page.clock.setFixedTime(at);
    }

    await page.goto(`${APP}/newspaper?solo=1#A1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    if (new URL(page.url()).pathname.startsWith("/login")) throw new Error("Session was not accepted (landed on /login)");
    const front = page.locator('section.wsj-page[aria-label="Page A1"] .wsj-sheet');
    await front.locator(".wsj-body").first().waitFor({ state: "visible", timeout: 90_000 });
    await settle(page, 'section.wsj-page[aria-label="Page A1"]');

    // Let the whole sheet lay out, then cut to the top if it runs long.
    const sheetH = await front.evaluate((el) => Math.ceil(el.getBoundingClientRect().height));
    await page.setViewportSize({ width: VIEW.width, height: Math.max(VIEW.height, sheetH + 200) });
    await page.waitForTimeout(600);
    const box = await front.boundingBox();
    if (!box) throw new Error("Front sheet has no box");
    const frontPng = await page.screenshot({
      clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, FRONT_MAX_H) },
      animations: "disabled",
    });
    log(`front ${Math.round(box.width)}x${Math.round(box.height)} css, kept ${Math.min(box.height, FRONT_MAX_H)}`);

    // The weather report runs on the clubs page (A2).
    let weatherPng = null;
    const wx = page.locator("section.wsj-page .wx").first();
    await page.evaluate(() => {
      const target = [...document.querySelectorAll("section.wsj-page")].find((s) => s.querySelector(".wx"));
      target?.scrollIntoView({ behavior: "instant", inline: "start", block: "nearest" });
    });
    try {
      await wx.waitFor({ state: "visible", timeout: 45_000 });
      await page.waitForFunction(
        () => (document.querySelector("section.wsj-page .wx")?.textContent ?? "").replace(/\s+/g, "").length > 60,
        null,
        { timeout: 45_000 },
      );
      await settle(page, "section.wsj-page .wx");
      weatherPng = await wx.screenshot({ animations: "disabled" });
    } catch (err) {
      log("weather not shot:", err.message);
    }
    if (blocked.length) log("blocked writes:", [...new Set(blocked)].join(", "));
    return { frontPng, weatherPng };
  } finally {
    await browser.close();
  }
}

/** Revoke the minted session as soon as the pictures are taken. */
async function logout(session) {
  if (!session?.access_token) return;
  await call({ action: "logout", access_token: session.access_token }).catch((err) => log("logout:", err.message));
}

async function main() {
  if (!asked) {
    const peek = await call({ action: "peek" });
    if (flag("peek")) {
      // Workflow gate: only install a browser when an edition is waiting.
      if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `issue=${peek.issue_id ?? ""}\n`);
      log(peek.issue_id ? `edition waiting: ${peek.issue_id}` : "no edition waiting");
      return;
    }
    if (!peek.issue_id) {
      log("no edition waiting");
      return;
    }
    log("edition waiting:", peek.issue_id);
  }
  const claim = await call({ action: "claim", ...(asked ? { issue_id: asked } : {}), ...(test ? { test: true } : {}) });
  if (!claim.issue_id) {
    log("nothing to claim", claim.taken ? "(already taken)" : "");
    return;
  }
  log("claimed", claim.issue_id, test ? "(test)" : "");
  let shots;
  try {
    shots = await shoot(claim);
  } catch (err) {
    log("render failed:", err.message);
    if (!test) await call({ action: "release", issue_id: claim.issue_id, error: `render: ${err.message}` }).catch(() => null);
    throw err;
  } finally {
    await logout(claim.session);
  }

  await mkdir(outDir, { recursive: true });
  const frontPath = path.join(outDir, `${claim.issue_id}-front.png`);
  await writeFile(frontPath, shots.frontPng);
  log("wrote", frontPath);
  if (shots.weatherPng) {
    const wxPath = path.join(outDir, `${claim.issue_id}-weather.png`);
    await writeFile(wxPath, shots.weatherPng);
    log("wrote", wxPath);
  }
  if (!send) return;

  const form = new FormData();
  form.set("action", "send");
  form.set("issue_id", claim.issue_id);
  if (test) form.set("test", "true");
  form.set("front", new Blob([shots.frontPng], { type: "image/png" }), `${claim.issue_id}-front.png`);
  if (shots.weatherPng) form.set("weather", new Blob([shots.weatherPng], { type: "image/png" }), `${claim.issue_id}-weather.png`);
  const res = await fetch(SHOTS_URL, { method: "POST", headers: await authHeaders(), body: form });
  const body = await res.json().catch(() => null);
  log("send:", JSON.stringify(body));
  if (!res.ok || !body?.ok) throw new Error(`send failed: ${body?.error ?? res.status}`);
  if (!body.skipped && !body.sent) throw new Error("Telegram refused the image alert");
}

main().catch((err) => {
  console.error(`[times-shots] ${err.message}`);
  process.exit(1);
});
