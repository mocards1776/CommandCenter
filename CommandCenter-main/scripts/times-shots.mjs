/**
 * Thompson Times image alert runner: screenshots the printed A1 (same page as
 * the iPad Pro 13" paper) plus weather, The Day Ahead, and Best Games to Watch
 * from that same paper and hands the PNGs to times-telegram-shots, which sends
 * them on @ThompsonTimes_bot (front first, with caption + Mini App button).
 *
 * One page geometry only: iPad Pro 13" (1032×1376 CSS). No 430×932 phone crop
 * and no fit-to-phone pass. Width/scale fit math on the paper is untouched
 * (--tt-page-w 1032; on this viewport fit is 1).
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
 */
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const APP = (process.env.TIMES_APP_ORIGIN || "https://command-center-flax-gamma.vercel.app").replace(/\/$/, "");
const SUPABASE_URL = (process.env.TIMES_SUPABASE_URL || "https://esdgrgulaxnewmhjuyzh.supabase.co").replace(/\/$/, "");
const SHOTS_URL = `${SUPABASE_URL}/functions/v1/times-telegram-shots`;
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];
const AUDIENCE = "times-telegram-shots";
/** iPad Pro 13" CSS size — the only page geometry. Alert images are this page. */
const IPAD = { width: 1032, height: 1376 };
const IPAD_SCALE = 2;
const PAPER_EXTRAS = [
  { name: "weather", sel: ".wx, .wsj-weather" },
  { name: "day", sel: ".tt-day, .tt-day-empty" },
  { name: "watch", sel: ".tt-watch" },
];

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

/** Printed paper — same route, size, and layout as Josh's iPad Pro 13". */
async function openPaper(context, issueId) {
  const page = await context.newPage();
  page.on("pageerror", (err) => log("paper error:", err.message));
  await page.setViewportSize(IPAD);
  await pinClock(page, issueId);
  await page.goto(`${APP}/newspaper?solo=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  if (new URL(page.url()).pathname.startsWith("/login")) throw new Error("Session was not accepted (landed on /login)");
  await page.waitForFunction(
    () => document.querySelector("[data-times-ready]")?.getAttribute("data-times-ready") === "1",
    { timeout: 50_000 },
  );
  await page.locator(".wsj-front").waitFor({ state: "visible", timeout: 20_000 });
  await settle(page, ".wsj-front");
  return page;
}

async function shotViewport(page) {
  return page.screenshot({
    clip: { x: 0, y: 0, width: IPAD.width, height: IPAD.height },
    animations: "disabled",
  });
}

async function goFolioWith(page, sel) {
  const idx = await page.evaluate((needle) => {
    const pages = [...document.querySelectorAll(".wsj-page")];
    return pages.findIndex((node) => node.querySelector(needle));
  }, sel);
  if (idx < 0) return false;
  await page.evaluate((i) => {
    const pager = document.querySelector(".wsj-pager");
    if (pager) pager.scrollTo({ left: i * pager.clientWidth, behavior: "instant" });
  }, idx);
  await page.waitForTimeout(400);
  return true;
}

async function shoot(claim) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ args: ["--force-color-profile=srgb"] });
  try {
    const blocked = [];
    const init = sessionInit(claim);
    const ipad = await browser.newContext({
      viewport: IPAD,
      deviceScaleFactor: IPAD_SCALE,
      hasTouch: true,
      locale: "en-US",
      timezoneId: "America/Chicago",
      colorScheme: "light",
      userAgent:
        "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    });
    await harden(ipad, blocked);
    await ipad.addInitScript(init.script, init.arg);
    const page = await openPaper(ipad, claim.issue_id);
    const lead = await page.locator(".wsj-front .wsj-story.lead h2, .wsj-front .lead h2, .wsj-front h2").first().textContent().catch(() => "");
    log("A1 lead:", (lead || "").replace(/\s+/g, " ").trim().slice(0, 160));
    const frontPng = await shotViewport(page);
    log(`A1 ${frontPng.length} bytes at ${IPAD.width}x${IPAD.height} css (no phone fit)`);
    const extras = { weatherPng: null, dayPng: null, watchPng: null };
    for (const extra of PAPER_EXTRAS) {
      try {
        if (!(await goFolioWith(page, extra.sel))) {
          log(`${extra.name} skipped: folio not on the paper`);
          continue;
        }
        await settle(page, extra.sel);
        extras[`${extra.name}Png`] = await shotViewport(page);
        log(`${extra.name} ${extras[`${extra.name}Png`].length} bytes at ${IPAD.width}x${IPAD.height} css`);
      } catch (err) {
        log(`${extra.name} not shot:`, err.message);
      }
    }
    await page.close();
    await ipad.close();
    if (blocked.length) log("blocked writes:", [...new Set(blocked)].join(", "));
    if (!frontPng) throw new Error("front A1 missing");
    return { frontPng, weatherPng: extras.weatherPng, dayPng: extras.dayPng, watchPng: extras.watchPng };
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
