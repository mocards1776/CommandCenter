/**
 * Thompson Times image alert runner: screenshots four iPhone cards (front, weather,
 * The Day Ahead, Best Games to Watch) at the locked phone size and hands the PNGs
 * to times-telegram-shots, which sends them on @ThompsonTimes_bot (front first,
 * with caption + Mini App button).
 *
 * Run by .github/workflows/times-telegram-shots.yml (auth: GitHub Actions OIDC, no secrets).
 * Manual test from a machine holding the admin secret:
 *   TIMES_TELEGRAM_ADMIN_SECRET=… node scripts/times-shots.mjs --issue 2026-10-04-evening --test --out ./shots
 * Add --no-send to only write the PNGs. --peek only asks whether an edition is waiting
 * (and, from the workflow, records the runner heartbeat) and writes issue=<id> to $GITHUB_OUTPUT.
 * --peek --issue <id> is used when times-telegram dispatches this workflow for a specific edition.
 *
 * The browser is read-only: every write to Supabase REST and every call to the press or
 * editor functions is aborted, so opening the paper here can never change the desk or an issue.
 * Day Ahead and watch cards are skipped when there is no schedule row / no games.
 * The printed iPad paper (width-only fit at 1032) is never opened or resized here.
 */
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const APP = (process.env.TIMES_APP_ORIGIN || "https://command-center-flax-gamma.vercel.app").replace(/\/$/, "");
const SUPABASE_URL = (process.env.TIMES_SUPABASE_URL || "https://esdgrgulaxnewmhjuyzh.supabase.co").replace(/\/$/, "");
const SHOTS_URL = `${SUPABASE_URL}/functions/v1/times-telegram-shots`;
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];
const AUDIENCE = "times-telegram-shots";
/** Portrait iPhone CSS size; every alert image is clipped to this at 3x (1290×2796 px). */
const PHONE = { width: 430, height: 932 };
const PHONE_SCALE = 3;
const PHONE_CARDS = ["front", "weather", "day", "watch"];

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

function sessionInit(claim) {
  return {
    script: ({ key, session, layout }) => {
      try {
        localStorage.setItem(key, JSON.stringify(session));
        localStorage.setItem("sports-layout-v1", JSON.stringify(layout));
        localStorage.setItem("newspaper-solo", "1");
        sessionStorage.setItem("newspaper-solo", "1");
      } catch {}
    },
    arg: { key: `sb-${PROJECT_REF}-auth-token`, session: claim.session, layout: claim.layout },
  };
}

async function harden(context, blocked) {
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
}

async function pinClock(page, issueId) {
  if (pressIdAt(new Date()) === issueId) return;
  const at = instantFor(issueId);
  if (!at) throw new Error(`Cannot place ${issueId} on the clock`);
  log("pinning clock to", at.toISOString(), "for", issueId);
  await page.clock.setFixedTime(at);
}

/** Phone cards: dedicated route, hard-clipped to 430×932 CSS at 3x. Skip when empty/error. */
async function shootPhoneCard(context, issueId, card) {
  const page = await context.newPage();
  page.on("pageerror", (err) => log(`${card} page error:`, err.message));
  try {
    await page.setViewportSize(PHONE);
    await page.addInitScript(() => {
      document.documentElement.style.margin = "0";
      document.documentElement.style.padding = "0";
    });
    await pinClock(page, issueId);
    await page.goto(`${APP}/newspaper/phone-card?card=${card}&issue=${encodeURIComponent(issueId)}&solo=1`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    if (new URL(page.url()).pathname.startsWith("/login")) throw new Error("Session was not accepted (landed on /login)");
    await page.addStyleTag({ content: "html,body{margin:0;padding:0;overflow:hidden;background:#fbfaf6}" });
    const root = page.locator(`[data-phone-card="${card}"]`);
    await root.waitFor({ state: "attached", timeout: 45_000 });
    await page.waitForFunction(
      (kind) => {
        const ready = document.querySelector(`[data-phone-card="${kind}"]`)?.getAttribute("data-ready");
        return ready && ready !== "loading";
      },
      card,
      { timeout: 45_000 },
    );
    const ready = await root.getAttribute("data-ready");
    if (ready !== "1") {
      log(`${card} skipped: ${ready ?? "missing"}`);
      return null;
    }
    const body = page.locator(".tt-phone-card");
    await body.waitFor({ state: "visible", timeout: 15_000 });
    await settle(page, ".tt-phone-card");
    await page
      .waitForFunction(() => document.querySelector(".tt-phone-card")?.getAttribute("data-phone-fit") === "1", {
        timeout: 8_000,
      })
      .catch(() => log(`${card} fit wait timed out; clipping anyway`));
    const png = await page.screenshot({
      clip: { x: 0, y: 0, width: PHONE.width, height: PHONE.height },
      animations: "disabled",
    });
    log(`${card} ${png.length} bytes, clipped ${PHONE.width}x${PHONE.height} css @${PHONE_SCALE}x`);
    return png;
  } catch (err) {
    log(`${card} not shot:`, err.message);
    return null;
  } finally {
    await page.close();
  }
}

async function shoot(claim) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ args: ["--force-color-profile=srgb"] });
  try {
    const blocked = [];
    const init = sessionInit(claim);
    const phone = await browser.newContext({
      viewport: PHONE,
      deviceScaleFactor: PHONE_SCALE,
      hasTouch: true,
      locale: "en-US",
      timezoneId: "America/Chicago",
      colorScheme: "light",
    });
    await harden(phone, blocked);
    await phone.addInitScript(init.script, init.arg);
    const extras = {};
    for (const card of PHONE_CARDS) {
      extras[`${card}Png`] = await shootPhoneCard(phone, claim.issue_id, card);
    }
    await phone.close();
    if (blocked.length) log("blocked writes:", [...new Set(blocked)].join(", "));
    if (!extras.frontPng) throw new Error("front card missing");
    return { frontPng: extras.frontPng, weatherPng: extras.weatherPng, dayPng: extras.dayPng, watchPng: extras.watchPng };
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
  if (flag("peek")) {
    const peek = await call({ action: "peek", ...(asked ? { issue_id: asked } : {}) });
    // Workflow gate: only install a browser when an edition is waiting.
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `issue=${peek.issue_id ?? ""}\n`);
    log(peek.issue_id ? `edition waiting: ${peek.issue_id}` : "no edition waiting");
    return;
  }
  if (!asked) {
    const peek = await call({ action: "peek" });
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
  const extras = [
    ["weather", shots.weatherPng],
    ["day", shots.dayPng],
    ["watch", shots.watchPng],
  ];
  for (const [name, png] of extras) {
    if (!png) continue;
    const dest = path.join(outDir, `${claim.issue_id}-${name}.png`);
    await writeFile(dest, png);
    log("wrote", dest);
  }
  if (!send) return;

  const form = new FormData();
  form.set("action", "send");
  form.set("issue_id", claim.issue_id);
  if (test) form.set("test", "true");
  form.set("front", new Blob([shots.frontPng], { type: "image/png" }), `${claim.issue_id}-front.png`);
  for (const [name, png] of extras) {
    if (png) form.set(name, new Blob([png], { type: "image/png" }), `${claim.issue_id}-${name}.png`);
  }
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
