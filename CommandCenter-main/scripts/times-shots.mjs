/**
 * Thompson Times image alert runner: screenshots the printed iPad Pro 13"
 * sheets (A1, weather, The Day Ahead, Best Games to Watch) and hands the PNGs
 * to times-telegram-shots, which sends them on @ThompsonTimes_bot (front
 * first, with caption + Mini App button).
 *
 * One geometry: the 1032 CSS px sheet (--tt-page-w). Viewport is the iPad Pro
 * 13" portrait window so the locked width fit stays 1. Page height follows
 * the copy; stories are not clipped to a phone canvas. The scale formula is
 * untouched.
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
import { appendFile, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP = (process.env.TIMES_APP_ORIGIN || "https://command-center-flax-gamma.vercel.app").replace(/\/$/, "");
const SUPABASE_URL = (process.env.TIMES_SUPABASE_URL || "https://esdgrgulaxnewmhjuyzh.supabase.co").replace(/\/$/, "");
const SHOTS_URL = `${SUPABASE_URL}/functions/v1/times-telegram-shots`;
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];
const AUDIENCE = "times-telegram-shots";
/**
 * iPad Pro 13" portrait window. The sheet is --tt-page-w 1032; at this width
 * the locked fit is 1. Height of the window is the device; the shot is the
 * sheet, which may be taller. Do not introduce a second canvas.
 */
const IPAD13 = { width: 1032, height: 1376 };
/**
 * After the Chromium shots exist, wait until the flat manifest is published
 * so the alert's "Read the paper" button opens the flat edition. Poll about
 * every 30s. Cap is from the moment this wait starts, not from filing.
 */
export const MANIFEST_WAIT_MS = 30 * 60 * 1000;
export const MANIFEST_POLL_MS = 30 * 1000;
const FLAT_MIN_CSS = 480;
const TELEGRAM_PHOTO_MAX = 9_500_000;
const ALERT_KINDS = [
  ["weather", "favorites-clubs"],
  ["day", "favorites-day"],
  ["watch", "favorites-watch"],
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

/** Printed sheet at iPad Pro 13" width. Height is the copy; nothing is cropped. */
async function shootSheet(page, kind) {
  const ready = await page
    .waitForFunction(
      (name) => {
        const sheet = document.querySelector(`.wsj-page[data-kind="${name}"] .wsj-sheet`);
        return !!sheet && sheet.childElementCount > 0 && sheet.getBoundingClientRect().height > 80;
      },
      kind,
      { timeout: 20_000 },
    )
    .then(() => true)
    .catch(() => false);
  if (!ready) return null;
  const sheet = page.locator(`.wsj-page[data-kind="${kind}"] .wsj-sheet`).first();
  const box = await sheet.boundingBox();
  if (!box || box.height < 40) return null;
  await settle(page, `.wsj-page[data-kind="${kind}"] .wsj-sheet`);
  const png = await sheet.screenshot({ animations: "disabled" });
  log(`${kind} ${png.length} bytes, sheet ${Math.round(box.width)}x${Math.round(box.height)} css`);
  return png;
}

/** Open the paper once at iPad Pro 13" and shoot A1, then the inside alert sheets. */
async function shootPaper(context, issueId) {
  const page = await context.newPage();
  page.on("pageerror", (err) => log("paper page error:", err.message));
  try {
    await page.setViewportSize(IPAD13);
    await pinClock(page, issueId);
    await page.goto(`${APP}/newspaper?solo=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    if (new URL(page.url()).pathname.startsWith("/login")) throw new Error("Session was not accepted (landed on /login)");
    await page.waitForFunction(
      () => document.querySelector("[data-times-ready]")?.getAttribute("data-times-ready") === "1",
      { timeout: 50_000 },
    );
    await page.locator('.wsj-page[data-kind="favorites-front"] .wsj-sheet').waitFor({ state: "visible", timeout: 20_000 });
    const frontPng = await shootSheet(page, "favorites-front");
    if (!frontPng) throw new Error("front A1 missing");
    const lead = await page.locator(".wsj-front .wsj-story.lead h2, .wsj-front .lead h2, .wsj-front h2").first().textContent().catch(() => "");
    log("A1 lead:", (lead || "").replace(/\s+/g, " ").trim().slice(0, 160));
    await page
      .waitForFunction(
        () => document.querySelector("[data-times-folios]")?.getAttribute("data-times-folios") === "1",
        { timeout: 45_000 },
      )
      .catch(() => log("folio fill still running; shooting sheets that are mounted"));
    const extras = {};
    for (const [name, kind] of ALERT_KINDS) {
      extras[name] = await shootSheet(page, kind);
      if (!extras[name]) log(`${name} skipped: no ${kind} sheet`);
    }
    return { frontPng, weatherPng: extras.weather ?? null, dayPng: extras.day ?? null, watchPng: extras.watch ?? null };
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
    const ipad = await browser.newContext({
      viewport: IPAD13,
      deviceScaleFactor: 2,
      hasTouch: true,
      locale: "en-US",
      timezoneId: "America/Chicago",
      colorScheme: "light",
      userAgent:
        "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    });
    await harden(ipad, blocked);
    await ipad.addInitScript(init.script, init.arg);
    const shots = await shootPaper(ipad, claim.issue_id);
    await ipad.close();
    if (blocked.length) log("blocked writes:", [...new Set(blocked)].join(", "));
    return shots;
  } finally {
    await browser.close();
  }
}

/** Revoke the minted session as soon as the pictures are taken. */
async function logout(session) {
  if (!session?.access_token) return;
  await call({ action: "logout", access_token: session.access_token }).catch((err) => log("logout:", err.message));
}

function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.LD_LIBRARY_PATH;
    const child = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", ...args], { stdio: "inherit", env });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`))));
  });
}

/** Lossless WebP (VP8L) width and height. Same layout as times-flat-print.mjs. */
function webpSize(buf) {
  if (!buf || buf.length < 25) return null;
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  if (buf.toString("ascii", 12, 16) !== "VP8L") return null;
  if (buf[20] !== 0x2f) return null;
  const b0 = buf[21];
  const b1 = buf[22];
  const b2 = buf[23];
  const b3 = buf[24];
  const width = 1 + (((b1 & 0x3f) << 8) | b0);
  const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
  if (width < 2 || height < 2) return null;
  return { width, height };
}

async function webpToPng(bytes) {
  const dir = await mkdtemp(path.join(tmpdir(), "tt-a1-"));
  try {
    const src = path.join(dir, "A1.webp");
    const dest = path.join(dir, "A1.png");
    await writeFile(src, bytes);
    await ffmpeg(["-y", "-i", src, "-frames:v", "1", dest]);
    return await readFile(dest);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Whether the shoot job should keep polling, send the flat A1, or send
 * today's fallback. A published manifest wins even on the last poll.
 * @returns {"flat" | "fallback" | "wait"}
 */
export function manifestWaitDecision(elapsedMs, manifestReady, capMs = MANIFEST_WAIT_MS) {
  if (manifestReady) return "flat";
  if (elapsedMs >= capMs) return "fallback";
  return "wait";
}

async function flatManifestReady(issueId) {
  const url = `${SUPABASE_URL}/storage/v1/object/public/times-flat/${issueId}/manifest.json?t=${Date.now()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return false;
  const data = await res.json().catch(() => null);
  return Boolean(data && data.issueId === issueId && Array.isArray(data.pages) && data.pages.length > 0);
}

/** Keep the image claim fresh so the text alert does not send a second message while we wait. */
async function holdClaim(issueId) {
  try {
    await call({ action: "hold", issue_id: issueId });
  } catch (err) {
    log("hold claim:", err.message);
  }
}

/**
 * Poll until the flat manifest for this edition is public, or the cap passes.
 * Does not send. The caller sends exactly once after this returns.
 */
async function waitForFlatManifest(issueId) {
  const started = Date.now();
  while (true) {
    let ready = false;
    try {
      ready = await flatManifestReady(issueId);
    } catch (err) {
      log("flat manifest:", err.message);
    }
    const elapsed = Date.now() - started;
    const decision = manifestWaitDecision(elapsed, ready);
    if (decision === "flat") {
      log("flat manifest is up");
      return decision;
    }
    if (decision === "fallback") {
      log("flat manifest not published within 30 min; sending today's fallback");
      return decision;
    }
    await holdClaim(issueId);
    const left = MANIFEST_WAIT_MS - elapsed;
    await new Promise((resolve) => setTimeout(resolve, Math.min(MANIFEST_POLL_MS, Math.max(0, left))));
  }
}

/**
 * One fetch of the flat A1. A lossless PNG of that file is the same pixels as
 * the iPad page. Missing, short, or too large: the caller keeps the Chromium front.
 */
async function loadFlatA1Png(issueId) {
  const url = `${SUPABASE_URL}/storage/v1/object/public/times-flat/${issueId}/A1.webp?t=${Date.now()}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      log("flat A1 missing", res.status);
      return null;
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    const dim = webpSize(bytes);
    const cssH = dim ? dim.height / DPR_GUESS : 0;
    if (!dim || cssH < FLAT_MIN_CSS || bytes.length <= 80_000) {
      log("flat A1 not usable", bytes.length, dim ? `${dim.width}x${dim.height}` : "no-dim");
      return null;
    }
    const png = await webpToPng(bytes);
    if (png.length > TELEGRAM_PHOTO_MAX) {
      log("flat A1 png is over the Telegram photo limit; using the chromium front");
      return null;
    }
    log("flat A1", `${dim.width}x${dim.height}`, `${bytes.length} webp bytes`, `${png.length} png bytes`);
    return png;
  } catch (err) {
    log("flat A1 fetch:", err.message);
    return null;
  }
}

const DPR_GUESS = 2;

async function main() {
  // Flat pages for the iPad. Does not claim or send a Telegram alert.
  //   node scripts/times-shots.mjs --flat --issue 2026-10-07-evening
  if (flag("flat")) {
    const { printFlatEdition } = await import("./times-flat-print.mjs");
    await printFlatEdition();
    return;
  }
  if (flag("mint")) {
    if (!asked) throw new Error("--mint requires --issue");
    const minted = await call({ action: "session", issue_id: asked });
    const sessionFile = opt("session-file") || "times-flat-session.json";
    const layoutFile = opt("layout-file") || "times-flat-layout.json";
    const supabaseFile = opt("supabase-file") || "times-flat-supabase.json";
    await writeFile(sessionFile, JSON.stringify(minted.session), { mode: 0o600 });
    await writeFile(layoutFile, JSON.stringify(minted.layout ?? {}), { mode: 0o600 });
    await writeFile(
      supabaseFile,
      JSON.stringify({ url: minted.supabase_url, key: minted.supabase_anon_key }),
      { mode: 0o600 },
    );
    log("minted read session for", asked);
    return;
  }
  if (flag("logout")) {
    const sessionFile = opt("session-file") || "times-flat-session.json";
    const session = JSON.parse(await readFile(sessionFile, "utf8"));
    await call({ action: "logout", access_token: session.access_token });
    log("revoked read session");
    return;
  }
  if (flag("flat-peek")) {
    const peeked = asked ? { issue_id: asked } : await call({ action: "flat-peek" });
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `issue=${peeked.issue_id ?? ""}\n`);
    log(peeked.issue_id ? `flat print ${peeked.issue_id}` : "no edition to print");
    return;
  }
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
  // Text may retake a claim that sits for 10 minutes. Refresh it through the
  // chromium shots and the manifest wait so that path does not send as well.
  const holdTimer = setInterval(() => {
    void holdClaim(claim.issue_id);
  }, 60_000);
  if (typeof holdTimer.unref === "function") holdTimer.unref();
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
  let frontPng = shots.frontPng;
  let frontName = `${claim.issue_id}-front.png`;
  if (send) {
    await waitForFlatManifest(claim.issue_id);
    const flat = await loadFlatA1Png(claim.issue_id).catch((err) => {
      log("flat A1 skipped:", err.message);
      return null;
    });
    if (flat) {
      frontPng = flat;
      frontName = `${claim.issue_id}-A1.png`;
      log("telegram front is the flat A1");
    }
  }
  const frontPath = path.join(outDir, frontName);
  await writeFile(frontPath, frontPng);
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
  if (!send) {
    clearInterval(holdTimer);
    return;
  }

  const form = new FormData();
  form.set("action", "send");
  form.set("issue_id", claim.issue_id);
  if (test) form.set("test", "true");
  form.set("front", new Blob([frontPng], { type: "image/png" }), frontName);
  for (const [name, png] of extras) {
    if (png) form.set(name, new Blob([png], { type: "image/png" }), `${claim.issue_id}-${name}.png`);
  }
  const res = await fetch(SHOTS_URL, { method: "POST", headers: await authHeaders(), body: form });
  clearInterval(holdTimer);
  const body = await res.json().catch(() => null);
  log("send:", JSON.stringify(body));
  if (!res.ok || !body?.ok) throw new Error(`send failed: ${body?.error ?? res.status}`);
  if (!body.skipped && !body.sent) throw new Error("Telegram refused the image alert");
}

const entry = process.argv[1];
if (entry && path.resolve(entry) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`[times-shots] ${err.message}`);
    process.exit(1);
  });
}
