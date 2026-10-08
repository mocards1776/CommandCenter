/**
 * Print one Thompson Times edition into flat page images.
 *
 * WebKit, iPad Pro 13" (1032x1376 CSS, devicePixelRatio 2), the same
 * --tt-page-w 1032 width-only sheet as scripts/times-shots.mjs. Every folio
 * is captured at full height after its images and fonts have loaded.
 * Nothing is sent to Telegram and the press is not run.
 *
 *   node scripts/times-shots.mjs --flat --issue 2026-10-07-evening
 *   node scripts/times-flat-print.mjs --issue 2026-10-07-evening
 *
 * Auth for a person at the machine: TIMES_SESSION_FILE (default
 * /tmp/tt-measure/session.json) plus TIMES_LAYOUT_FILE, or TIMES_SESSION_JSON.
 * The GitHub Actions job does not use a session secret. It asks
 * times-telegram-shots for a short-lived session (action "session") with the
 * same GitHub OIDC token the Telegram shots already use.
 * Supabase URL and the publishable key come from TIMES_SUPABASE_FILE, the
 * environment, or /tmp/tt-measure/vite.env. TIMES_APP_ORIGIN defaults to production.
 *
 * A sheet is not shot until it has content, its height has held for more than
 * one frame, its images have decoded, and fonts are ready. A short or mostly
 * blank shot is retried. The manifest is uploaded only when every page passes.
 * Otherwise any published manifest for that edition is removed and the reader
 * stays on the live paper.
 *
 * Page images are addressed on the app origin (/times-flat/...) so Vercel's
 * CDN caches them. Storage objects use a year-long immutable cache header.
 * The manifest itself stays a small JSON object on Supabase.
 *
 * Images go to the public times-flat bucket. Editions older than 7 calendar
 * days (America/Chicago) are deleted at the end of the run.
 */
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const APP = (process.env.TIMES_APP_ORIGIN || "https://command-center-flax-gamma.vercel.app").replace(/\/$/, "");
const IPAD13 = { width: 1032, height: 1376 };
const PAGE_W = 1032;
const DPR = 2;
const BUCKET = "times-flat";
const RETENTION_DAYS = 7;
/** Header-only shells from this press land around 200 CSS px. Real inside pages start above this. */
export const MIN_CSS_HEIGHT = 480;
/** Share of sampled pixels that are near-white or clear. Above this, the page is blank. */
export const MAX_BLANK_RATIO = 0.9;
const PAGE_TRIES = 3;
const SHEET_WAIT_MS = 18_000;
const IMAGE_CACHE = "public, max-age=31536000, immutable";
const MANIFEST_CACHE = "public, max-age=60";
const SESSION_FILE = process.env.TIMES_SESSION_FILE || "/tmp/tt-measure/session.json";
const LAYOUT_FILE = process.env.TIMES_LAYOUT_FILE || "/tmp/tt-measure/layout.json";

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

function log(...parts) {
  console.log(`[times-flat ${new Date().toISOString()}]`, ...parts);
}

function chicagoToday(now = new Date()) {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

function addDays(iso, delta) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function editionDate(issueId) {
  const match = /^(\d{4}-\d{2}-\d{2})-(morning|midday|evening)$/.exec(issueId);
  return match ? match[1] : null;
}

function pressIdAt(now) {
  const day = now.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const hour =
    Number(
      new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hourCycle: "h23" })
        .formatToParts(now)
        .find((p) => p.type === "hour")?.value,
    ) % 24;
  if (hour >= 17) return `${day}-evening`;
  if (hour >= 12) return `${day}-midday`;
  if (hour >= 6) return `${day}-morning`;
  const prev = addDays(day, -1);
  return `${prev}-evening`;
}

function instantFor(issueId) {
  const match = /^(\d{4})-(\d{2})-(\d{2})-(morning|midday|evening)$/.exec(issueId);
  if (!match) return null;
  const hour = { morning: 7, midday: 13, evening: 18 }[match[4]];
  for (const offset of [5, 6]) {
    const t = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), hour + offset));
    if (pressIdAt(t) === issueId) return t;
  }
  return null;
}

async function readEnvFile(file) {
  try {
    const text = await readFile(file, "utf8");
    const out = {};
    for (const line of text.split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m) out[m[1]] = m[2];
    }
    return out;
  } catch {
    return {};
  }
}

async function supabaseConfig() {
  if (process.env.TIMES_SUPABASE_FILE) {
    try {
      const parsed = JSON.parse(await readFile(process.env.TIMES_SUPABASE_FILE, "utf8"));
      const url = String(parsed.url || "").replace(/\/$/, "");
      const key = String(parsed.key || "");
      if (url && key) return { url, key };
    } catch {
      /* fall through to the env file */
    }
  }
  const file = await readEnvFile("/tmp/tt-measure/vite.env");
  const url = (process.env.TIMES_SUPABASE_URL || process.env.VITE_SUPABASE_URL || file.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.TIMES_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || file.VITE_SUPABASE_ANON_KEY || "";
  if (!url || !key) throw new Error("Missing Supabase URL or publishable key");
  return { url, key };
}

/** Lossless WebP (VP8L) width and height. Returns null for any other container. */
export function webpSize(buf) {
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

export function judgePage(page) {
  const cssHeight = Number(page?.cssHeight) || 0;
  const blankRatio = Number(page?.blankRatio);
  if (cssHeight < MIN_CSS_HEIGHT) return { ok: false, reason: `short ${Math.round(cssHeight)}` };
  if (Number.isFinite(blankRatio) && blankRatio > MAX_BLANK_RATIO) {
    return { ok: false, reason: `blank ${blankRatio.toFixed(2)}` };
  }
  if (page?.seam) return { ok: false, reason: `seam y ${page.seam.y}` };
  return { ok: true, reason: "ok" };
}

/**
 * A stitch seam is a 1 CSS px (1–3 device rows) full-width line: near-uniform,
 * dark, and different from the rows just outside the run. Photo blacks and
 * rules that are not uniform across the whole sheet do not match. Edge rows
 * are ignored. Returns `{ y, rows }` in device pixels, or null.
 */
export function findSeam(canvas, width, height) {
  if (!width || !height || height < 3) return null;
  const pixels = width * height;
  if (canvas.length < pixels * 3) return null;
  const channels = canvas.length >= pixels * 4 ? 4 : 3;
  const step = Math.max(1, Math.floor(width / 480));
  const dark = new Uint8Array(height);
  for (let y = 0; y < height; y++) {
    let n = 0;
    let darkN = 0;
    let min = 255;
    let max = 0;
    const row = y * width * channels;
    for (let x = 0; x < width; x += step) {
      const o = row + x * channels;
      const r = canvas[o];
      const g = canvas[o + 1];
      const b = canvas[o + 2];
      const l = (r + g + b) / 3;
      if (l < min) min = l;
      if (l > max) max = l;
      n += 1;
      if (r < 40 && g < 40 && b < 48) darkN += 1;
    }
    if (n && darkN / n >= 0.98 && max - min <= 12 && (min + max) / 2 < 36) dark[y] = 1;
  }
  const differs = (a, b) => {
    let n = 0;
    let diff = 0;
    let sumA = 0;
    let sumB = 0;
    for (let x = 0; x < width; x += step) {
      const oa = (a * width + x) * channels;
      const ob = (b * width + x) * channels;
      const la = (canvas[oa] + canvas[oa + 1] + canvas[oa + 2]) / 3;
      const lb = (canvas[ob] + canvas[ob + 1] + canvas[ob + 2]) / 3;
      n += 1;
      sumA += la;
      sumB += lb;
      if (Math.abs(la - lb) > 24) diff += 1;
    }
    // A photo can share the line's darkness in part of the row. The line still
    // differs when its mean is far from the neighbor and most samples disagree.
    return n > 0 && Math.abs(sumA - sumB) / n >= 24 && diff / n >= 0.45;
  };
  for (let y = 0; y < height; ) {
    if (!dark[y]) {
      y += 1;
      continue;
    }
    let end = y;
    while (end + 1 < height && dark[end + 1]) end += 1;
    const rows = end - y + 1;
    const above = y - 1;
    const below = end + 1;
    if (rows <= 3 && above >= 0 && below < height && !dark[above] && !dark[below] && differs(y, above) && differs(end, below)) {
      return { y, rows };
    }
    y = end + 1;
  }
  return null;
}

function blankRatio(canvas, width, height) {
  let white = 0;
  let n = 0;
  const step = 8;
  for (let y = 0; y < height; y += step) {
    const row = y * width * 4;
    for (let x = 0; x < width; x += step) {
      const o = row + x * 4;
      n += 1;
      const a = canvas[o + 3];
      if (a < 16 || (canvas[o] >= 248 && canvas[o + 1] >= 248 && canvas[o + 2] >= 248)) white += 1;
    }
  }
  return n ? white / n : 1;
}

/** Drop a tall unpainted tail. A real page keeps its last ink row. */
function cropWhiteTail(canvas, width, height) {
  const step = 4;
  let bottom = -1;
  for (let y = height - 1; y >= 0; y -= 1) {
    const row = y * width * 4;
    let ink = 0;
    let n = 0;
    for (let x = 0; x < width; x += step) {
      const o = row + x * 4;
      n += 1;
      if (canvas[o + 3] > 16 && (canvas[o] < 248 || canvas[o + 1] < 248 || canvas[o + 2] < 248)) ink += 1;
    }
    if (n && ink / n > 0.004) {
      bottom = y;
      break;
    }
  }
  if (bottom < 0) return { buffer: canvas, height: 1 };
  const keep = Math.min(height, bottom + 1 + 8);
  if (height - keep < 80) return { buffer: canvas, height };
  const next = Buffer.alloc(width * keep * 4);
  canvas.copy(next, 0, 0, width * keep * 4);
  return { buffer: next, height: keep };
}

function fitHotspots(spots, sheetCss, contentCss) {
  if (!sheetCss || !contentCss || Math.abs(sheetCss - contentCss) < 1) return spots;
  const scale = sheetCss / contentCss;
  const out = [];
  for (const spot of spots) {
    const y = spot.y * scale;
    const h = spot.h * scale;
    if (y >= 1 || y + h <= 0) continue;
    const top = Math.max(0, y);
    const bottom = Math.min(1, y + h);
    out.push({ ...spot, y: top, h: bottom - top });
  }
  return out;
}

async function loadSession(config) {
  let session;
  if (process.env.TIMES_SESSION_JSON) session = JSON.parse(process.env.TIMES_SESSION_JSON);
  else session = JSON.parse(await readFile(SESSION_FILE, "utf8"));
  const left = (session.expires_at || 0) - Date.now() / 1000;
  // A full book can take most of an hour. Refresh before the token gets short.
  if (left < 2700 && session.refresh_token) {
    const res = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.access_token) throw new Error(`session refresh failed: ${res.status}`);
    session = {
      access_token: body.access_token,
      refresh_token: body.refresh_token,
      expires_in: body.expires_in,
      expires_at: body.expires_at ?? Math.floor(Date.now() / 1000) + (body.expires_in || 3600),
      token_type: body.token_type || "bearer",
      user: body.user,
    };
    if (!process.env.TIMES_SESSION_JSON) await writeFile(SESSION_FILE, JSON.stringify(session), { mode: 0o600 });
    log("refreshed session");
  }
  let layout = {};
  try {
    layout = JSON.parse(await readFile(LAYOUT_FILE, "utf8"));
  } catch {
    layout = {};
  }
  return { session, layout };
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    const extra = (process.env.NODE_PATH || "").split(path.delimiter).filter(Boolean);
    const candidates = [
      ...extra.map((dir) => path.join(dir, "playwright", "index.mjs")),
      "/tmp/tt-measure/node_modules/playwright/index.mjs",
    ];
    let last = "playwright is not installed";
    for (const file of candidates) {
      try {
        return await import(pathToFileURL(file).href);
      } catch (err) {
        last = err.message;
      }
    }
    throw new Error(last);
  }
}

function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.LD_LIBRARY_PATH;
    const child = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", ...args], { stdio: "inherit", env });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`))));
  });
}

function pngSize(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

async function encodeWebp(pngPath, webpPath) {
  await ffmpeg(["-y", "-i", pngPath, "-c:v", "libwebp", "-lossless", "1", "-compression_level", "6", webpPath]);
}

async function rawSize(file) {
  const { width, height } = pngSize(await readFile(file));
  return { width, height };
}

/**
 * One shot of the whole sheet. Slicing the folio and stitching the clips
 * pasted the last slice's top edge — two device rows of the navy page
 * background — over the copy, one viewport above the bottom. The viewport
 * grows until the folio holds the sheet, then the sheet rect is captured
 * once. Width stays 1032 CSS px so the width-only fit does not change.
 */
async function sheetBox(page, index) {
  return page.evaluate(async (i) => {
    const pager = document.querySelector(".newspaper-edition");
    const leaf = document.querySelectorAll(".wsj-page")[i];
    const sheet = leaf?.querySelector(".wsj-sheet");
    if (!leaf || !sheet) return null;
    if (pager) pager.scrollTo({ left: i * pager.clientWidth, behavior: "instant" });
    leaf.scrollTop = 0;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const s = sheet.getBoundingClientRect();
    return {
      x: s.x,
      y: s.y,
      w: s.width,
      h: s.height,
      viewW: window.innerWidth,
      viewH: window.innerHeight,
      leafH: leaf.clientHeight,
      sheetH: sheet.offsetHeight,
      sheetW: sheet.offsetWidth,
    };
  }, index);
}

function clipInside(box) {
  const x = Math.max(0, box.x);
  const y = Math.max(0, box.y);
  const width = Math.min(box.w, box.viewW - x);
  const height = Math.min(box.h, box.viewH - y);
  const full = width >= box.w - 1 && height >= box.h - 1;
  return { x, y, width, height, full };
}

async function captureSheet(page, index, pngPath) {
  await page.setViewportSize({ width: IPAD13.width, height: IPAD13.height });
  const geom = await sheetBox(page, index);
  if (!geom || geom.sheetH < 40 || geom.sheetW < 40) return null;
  const chrome = Math.max(0, geom.viewH - geom.leafH);
  const viewH = Math.min(16000, Math.max(IPAD13.height, Math.ceil(geom.sheetH + chrome + 32)));
  await page.setViewportSize({ width: IPAD13.width, height: viewH });
  try {
    let box = await sheetBox(page, index);
    if (!box || box.w < 40 || box.h < 40) return null;
    let clip = clipInside(box);
    if (!clip.full || box.sheetH > box.leafH + 2) {
      const need = Math.min(16000, Math.ceil(box.y + box.h + chrome + 32));
      await page.setViewportSize({ width: IPAD13.width, height: Math.max(viewH, need) });
      box = await sheetBox(page, index);
      if (!box || box.w < 40 || box.h < 40) return null;
      clip = clipInside(box);
    }
    if (!clip.full || clip.width < 40 || clip.height < 40) return null;
    await page.screenshot({
      path: pngPath,
      animations: "disabled",
      type: "png",
      clip: { x: clip.x, y: clip.y, width: clip.width, height: clip.height },
      timeout: 30_000,
    });
  } finally {
    await page.setViewportSize({ width: IPAD13.width, height: IPAD13.height });
  }
  const { width, height } = await rawSize(pngPath);
  const scale = width / geom.sheetW;
  const rawOut = `${pngPath}.raw`;
  await ffmpeg(["-y", "-i", pngPath, "-f", "rawvideo", "-pix_fmt", "rgba", rawOut]);
  const pixels = await readFile(rawOut);
  await unlink(rawOut).catch(() => {});
  const seam = findSeam(pixels, width, height);
  return {
    width,
    height,
    cssWidth: geom.sheetW,
    cssHeight: height / scale,
    sheetCssHeight: geom.sheetH,
    blankRatio: blankRatio(pixels, width, height),
    seam,
  };
}

function authHeaders(config, token, extra = {}) {
  return {
    apikey: config.key,
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

async function uploadObject(config, token, objectPath, bytes, contentType, cacheControl) {
  const res = await fetch(`${config.url}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: "POST",
    headers: authHeaders(config, token, {
      "Content-Type": contentType,
      "x-upsert": "true",
      "cache-control": cacheControl,
    }),
    body: bytes,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`upload ${objectPath} ${res.status} ${text.slice(0, 180)}`);
  }
}

async function listPrefix(config, token, prefix) {
  const rows = [];
  for (let offset = 0; offset < 5000; offset += 100) {
    const res = await fetch(`${config.url}/storage/v1/object/list/${BUCKET}`, {
      method: "POST",
      headers: authHeaders(config, token, { "Content-Type": "application/json" }),
      body: JSON.stringify({ prefix, limit: 100, offset, sortBy: { column: "name", order: "asc" } }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`list ${res.status}`);
    if (!Array.isArray(body) || !body.length) break;
    rows.push(...body);
    if (body.length < 100) break;
  }
  return rows;
}

async function removePrefixes(config, token, prefixes) {
  if (!prefixes.length) return;
  const res = await fetch(`${config.url}/storage/v1/object/${BUCKET}`, {
    method: "DELETE",
    headers: authHeaders(config, token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ prefixes }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`delete ${res.status} ${text.slice(0, 180)}`);
  }
}

async function prune(config, token) {
  const today = chicagoToday();
  const keepFrom = addDays(today, -(RETENTION_DAYS - 1));
  const top = await listPrefix(config, token, "");
  let removed = 0;
  for (const row of top) {
    const name = String(row.name || "");
    const day = editionDate(name);
    if (!day || day >= keepFrom) continue;
    const files = await listPrefix(config, token, `${name}/`);
    const prefixes = files.filter((f) => f.id).map((f) => `${name}/${f.name}`);
    if (prefixes.length) {
      await removePrefixes(config, token, prefixes);
      removed += prefixes.length;
      log("pruned", name, prefixes.length, "files");
    }
  }
  log("retention", `keep dateline >= ${keepFrom}`, "removed", removed);
}

async function harden(context) {
  const supa = (await supabaseConfig()).url;
  await context.route("**/*", (route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();
    if (url.startsWith(supa) && url.includes("/rest/v1/") && method !== "GET" && method !== "HEAD") return route.abort();
    if (url.startsWith(supa) && /\/functions\/v1\/(newspaper-press|newspaper-editor|times-telegram)/.test(url)) return route.abort();
    return route.continue();
  });
}

function sessionInit(projectRef, session, layout) {
  return {
    script: ({ key, session, layout }) => {
      try {
        localStorage.setItem(key, JSON.stringify(session));
        localStorage.setItem("sports-layout-v1", JSON.stringify(layout));
        localStorage.setItem("newspaper-solo", "1");
        sessionStorage.setItem("newspaper-solo", "1");
      } catch {}
    },
    arg: { key: `sb-${projectRef}-auth-token`, session, layout },
  };
}

async function reveal(page) {
  await page
    .waitForFunction(() => {
      const sheet = document.querySelector(".wsj-page .wsj-sheet");
      return !!sheet && sheet.childElementCount > 0 && sheet.getBoundingClientRect().height > 80;
    }, { timeout: 70_000 })
    .catch(() => {});
  const start = Date.now();
  let last = -1;
  let quiet = Date.now();
  while (Date.now() - start < 28_000) {
    const h = await page.evaluate(() => document.querySelector(".wsj-page .wsj-sheet")?.offsetHeight || 0);
    if (h !== last) {
      last = h;
      quiet = Date.now();
    }
    const ready = await page.evaluate(
      () => document.querySelector("[data-times-ready]")?.getAttribute("data-times-ready") === "1",
    );
    if (h > 200 && ready && Date.now() - quiet > 1500) break;
    if (h > 200 && Date.now() - quiet > 4000) break;
    await page.waitForTimeout(250);
  }
  await page.evaluate(() => {
    document.querySelectorAll(".tt-hold").forEach((el) => {
      el.style.display = "none";
    });
    const pager = document.querySelector(".newspaper-edition");
    if (pager) pager.style.visibility = "visible";
  });
}

/**
 * Non-empty sheet, fonts ready, every image decoded, and the same height
 * across three animation frames and two polls. A short shell keeps waiting
 * until the budget runs out so a late table can still land.
 */
async function waitForSheet(page, index, budgetMs) {
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  const start = Date.now();
  let lastH = -1;
  let stablePolls = 0;
  let last = null;
  while (Date.now() - start < budgetMs) {
    const snap = await page.evaluate(async (i) => {
      const leaf = document.querySelectorAll(".wsj-page")[i];
      const sheet = leaf?.querySelector(".wsj-sheet");
      if (!sheet || sheet.childElementCount === 0) {
        return { empty: true, h: 0, stable: false, pending: 0, text: 0 };
      }
      const imgs = [...sheet.querySelectorAll("img")];
      const pending = imgs.filter((img) => !img.complete).length;
      const h1 = sheet.offsetHeight;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const h2 = sheet.offsetHeight;
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const h3 = sheet.offsetHeight;
      const text = (sheet.innerText || "").replace(/\s+/g, " ").trim().length;
      return {
        empty: false,
        h: h3,
        stable: h1 > 0 && h1 === h2 && h2 === h3,
        pending,
        text,
      };
    }, index);
    last = snap;
    if (!snap.empty && snap.stable && snap.pending === 0 && snap.text >= 24 && snap.h === lastH) stablePolls += 1;
    else if (!snap.empty && snap.stable && snap.pending === 0 && snap.text >= 24) stablePolls = 1;
    else stablePolls = 0;
    lastH = snap.h || 0;
    if (
      !snap.empty &&
      snap.stable &&
      snap.pending === 0 &&
      snap.text >= 24 &&
      snap.h >= MIN_CSS_HEIGHT &&
      stablePolls >= 2
    ) {
      return { ok: true, ...snap };
    }
    await page.waitForTimeout(200);
  }
  return { ok: false, ...(last || { empty: true, h: 0, stable: false, pending: 0, text: 0 }) };
}

async function waitQuiet(page, index) {
  let last = -1;
  let quiet = Date.now();
  const start = Date.now();
  while (Date.now() - start < 2_000) {
    const h = await page.evaluate(
      (i) => document.querySelectorAll(".wsj-page")[i]?.querySelector(".wsj-sheet")?.offsetHeight || 0,
      index,
    );
    if (h !== last) {
      last = h;
      quiet = Date.now();
    }
    if (h > 80 && Date.now() - quiet > 700) return;
    await page.waitForTimeout(200);
  }
}

async function primePage(page, index) {
  await page.evaluate((i) => {
    const leaf = document.querySelectorAll(".wsj-page")[i];
    const folio = leaf?.getAttribute("data-folio");
    if (folio) location.hash = `#${folio}`;
  }, index);
  await page
    .waitForFunction(
      (i) => {
        const sheet = document.querySelectorAll(".wsj-page")[i]?.querySelector(".wsj-sheet");
        return !!sheet && sheet.childElementCount > 0 && sheet.getBoundingClientRect().height > 80;
      },
      index,
      { timeout: 25_000 },
    )
    .catch(() => {});
  await page.evaluate(async (i) => {
    const pager = document.querySelector(".newspaper-edition");
    const leaf = pager?.querySelectorAll(".wsj-page")[i];
    if (!leaf) return;
    if (pager) pager.scrollTo({ left: i * pager.clientWidth, behavior: "instant" });
    leaf.scrollTop = 0;
    const imgs = [...leaf.querySelectorAll("img")];
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise((resolve) => {
            img.loading = "eager";
            const src = img.getAttribute("src");
            if (src && (!img.complete || img.naturalWidth === 0)) img.src = src;
            if (img.complete && (img.naturalWidth > 0 || img.getAttribute("src") == null)) {
              resolve();
              return;
            }
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
            setTimeout(done, 8000);
          }),
      ),
    );
    // Walk the folio so lazy art below the first screen actually requests.
    const max = leaf.scrollHeight;
    for (let y = 0; y < max; y += 900) leaf.scrollTop = y;
    leaf.scrollTop = 0;
    await document.fonts?.ready;
  }, index);
  await page.evaluate(async (i) => {
    const leaf = document.querySelectorAll(".wsj-page")[i];
    if (!leaf) return;
    const imgs = [...leaf.querySelectorAll("img")];
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete && img.naturalWidth > 0) {
              resolve();
              return;
            }
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
            setTimeout(done, 4000);
          }),
      ),
    );
  }, index);
  await waitQuiet(page, index);
}

async function hotspots(page, index) {
  return page.evaluate((i) => {
    const leaf = document.querySelectorAll(".wsj-page")[i];
    const sheet = leaf?.querySelector(".wsj-sheet");
    if (!sheet) return [];
    const box = sheet.getBoundingClientRect();
    if (!box.width || !box.height) return [];
    const out = [];
    for (const el of sheet.querySelectorAll("a[href], button, [data-tt-goto]")) {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      const hrefAttr = el.getAttribute("href");
      const href = hrefAttr && !hrefAttr.startsWith("javascript:") ? hrefAttr : null;
      const text = (el.innerText || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 140);
      const stamped = el.getAttribute("data-tt-goto");
      const found = (text.match(/\b([A-Z]{1,4}\d{1,2})\b/) || [])[1] || null;
      const folio = stamped || (found && /^[A-Z]{1,4}\d{1,2}$/.test(found) ? found : null);
      if (!href && !folio) continue;
      out.push({
        x: (r.left - box.left) / box.width,
        y: (r.top - box.top) / box.height,
        w: r.width / box.width,
        h: r.height / box.height,
        href,
        folio,
        label: text,
      });
    }
    return out;
  }, index);
}

export async function printFlatEdition() {
  const issueId = opt("issue") || process.env.ISSUE_ID;
  if (!editionDate(issueId || "")) throw new Error("--issue 2026-10-07-evening is required");
  const outDir = opt("out") || process.env.TIMES_FLAT_OUT || path.resolve("times-flat-out", issueId);
  const config = await supabaseConfig();
  const { session, layout } = await loadSession(config);
  const projectRef = new URL(config.url).hostname.split(".")[0];
  await mkdir(outDir, { recursive: true });

  const { webkit } = await loadPlaywright();
  const browser = await webkit.launch();
  const shots = [];
  try {
    const context = await browser.newContext({
      viewport: IPAD13,
      deviceScaleFactor: DPR,
      isMobile: true,
      hasTouch: true,
      locale: "en-US",
      timezoneId: "America/Chicago",
      colorScheme: "light",
      userAgent:
        "Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1",
    });
    await harden(context);
    const init = sessionInit(projectRef, session, layout);
    await context.addInitScript(init.script, init.arg);
    const page = await context.newPage();
    const at = instantFor(issueId);
    if (at && pressIdAt(new Date()) !== issueId) {
      log("pinning clock", at.toISOString());
      await page.clock.setFixedTime(at);
    }
    await page.goto(`${APP}/newspaper?solo=1&edition=${encodeURIComponent(issueId)}`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    if (new URL(page.url()).pathname.startsWith("/login")) throw new Error("landed on /login");
    await reveal(page);
    let folioCount = 0;
    {
      let last = "";
      let quiet = Date.now();
      const start = Date.now();
      while (Date.now() - start < 45_000) {
        const snap = await page.evaluate(() => String(document.querySelectorAll(".wsj-page").length));
        if (snap !== last) {
          last = snap;
          quiet = Date.now();
          log("settling", snap, "folios");
        }
        const n = Number(snap);
        if (n > 3 && Date.now() - quiet > 8_000) break;
        await page.waitForTimeout(400);
      }
      folioCount = Number(last) || 0;
    }
    log("folio count settled", folioCount);
    const leaves = await page.evaluate(() =>
      [...document.querySelectorAll(".wsj-page")].map((el) => ({
        folio: el.getAttribute("data-folio") || "",
        kind: el.getAttribute("data-kind") || "",
      })),
    );
    if (!leaves.length) throw new Error("no folios");
    log("folios", leaves.length);
    await deleteManifest(config, session.access_token, issueId);

    const printedAt = new Date().toISOString();
    const version = String(Date.parse(printedAt));
    const report = [];
    for (let i = 0; i < leaves.length; i++) {
      const leaf = leaves[i];
      const pngPath = path.join(outDir, `${leaf.folio}.png`);
      const webpPath = path.join(outDir, `${leaf.folio}.webp`);
      let shot = null;
      let spots = [];
      let reason = "no sheet";
      for (let attempt = 1; attempt <= PAGE_TRIES; attempt++) {
        if (attempt > 1) log("retry", leaf.folio, attempt, reason);
        await primePage(page, i);
        const ready = await waitForSheet(page, i, SHEET_WAIT_MS);
        log(
          "sheet",
          leaf.folio,
          "attempt",
          attempt,
          "css",
          Math.round(ready.h || 0),
          ready.stable ? "stable" : "moving",
          "images",
          ready.pending || 0,
          ready.ok ? "content" : "shell",
        );
        shot = await captureSheet(page, i, pngPath);
        if (!shot) {
          reason = "no sheet";
          continue;
        }
        spots = fitHotspots(await hotspots(page, i), shot.sheetCssHeight, shot.cssHeight);
        const verdict = judgePage(shot);
        reason = verdict.reason;
        if (verdict.ok) break;
      }
      const verdict = shot ? judgePage(shot) : { ok: false, reason };
      const cssHeight = shot ? Math.round(shot.cssHeight) : 0;
      report.push({
        folio: leaf.folio,
        cssHeight,
        blankRatio: shot ? shot.blankRatio : 1,
        ok: verdict.ok,
        reason: verdict.reason,
      });
      log(
        "HEIGHT",
        leaf.folio,
        `css ${cssHeight}`,
        shot ? `${shot.width}x${shot.height}` : "no-shot",
        `blank ${shot ? shot.blankRatio.toFixed(2) : "1.00"}`,
        verdict.ok ? "ok" : `FAIL ${verdict.reason}`,
      );
      if (!verdict.ok || !shot) continue;
      await encodeWebp(pngPath, webpPath);
      const webp = await readFile(webpPath);
      const row = {
        folio: leaf.folio,
        kind: leaf.kind,
        index: shots.length,
        section: (/^([A-Z]+)/.exec(leaf.folio) || [])[1] || leaf.folio,
        file: webpPath,
        bytes: webp.length,
        width: shot.width,
        height: shot.height,
        cssWidth: shot.cssWidth,
        cssHeight: shot.cssHeight,
        hotspots: spots,
      };
      shots.push(row);
      const tokenNow = session.access_token;
      await uploadObject(config, tokenNow, `${issueId}/${leaf.folio}.webp`, webp, "image/webp", IMAGE_CACHE);
      if (leaf.folio === "A1") log("A1 on storage for the Telegram alert");
      if (i !== 0) await unlink(pngPath).catch(() => {});
    }
    await page.close();
    await context.close();
    const heightLines = report.map(
      (row) =>
        `${row.folio}\tcss ${row.cssHeight}\tblank ${row.blankRatio.toFixed(2)}\t${row.ok ? "ok" : `FAIL ${row.reason}`}`,
    );
    await writeFile(path.join(outDir, "heights.txt"), `${heightLines.join("\n")}\n`);
    log(`page heights (${report.length}):\n${heightLines.join("\n")}`);
    const failures = report.filter((row) => !row.ok);
    const token = session.access_token;
    if (failures.length || shots.length !== leaves.length) {
      await deleteManifest(config, token, issueId);
      await prune(config, token).catch((err) => log("prune", err.message));
      const why = failures.map((row) => `${row.folio}:${row.reason}`).join(", ");
      throw new Error(`manifest withheld (${failures.length} pages): ${why}`);
    }
    const manifest = {
      issueId,
      printedAt,
      geometry: { cssWidth: PAGE_W, cssViewportHeight: IPAD13.height, dpr: DPR, pageW: PAGE_W },
      pages: shots.map((shot) => ({
        folio: shot.folio,
        kind: shot.kind,
        index: shot.index,
        section: shot.section,
        url: `/times-flat/${issueId}/${shot.folio}.webp?v=${version}`,
        width: shot.width,
        height: shot.height,
        cssWidth: shot.cssWidth,
        cssHeight: shot.cssHeight,
        bytes: shot.bytes,
        hotspots: shot.hotspots,
      })),
    };
    const manifestPath = path.join(outDir, "manifest.json");
    await writeFile(manifestPath, JSON.stringify(manifest));
    await uploadObject(config, token, `${issueId}/manifest.json`, await readFile(manifestPath), "application/json", MANIFEST_CACHE);
    const total = shots.reduce((sum, shot) => sum + shot.bytes, 0);
    log("uploaded", issueId, shots.length, "pages", total, "bytes");
    log("manifest", `${config.url}/storage/v1/object/public/${BUCKET}/${issueId}/manifest.json`);
    await prune(config, token);
    return manifest;
  } finally {
    await browser.close();
  }
}

async function deleteManifest(config, token, issueId) {
  const res = await fetch(`${config.url}/storage/v1/object/${BUCKET}`, {
    method: "DELETE",
    headers: authHeaders(config, token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ prefixes: [`${issueId}/manifest.json`] }),
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    log("manifest delete", res.status, text.slice(0, 160));
    return;
  }
  log("cleared manifest", issueId);
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) {
  printFlatEdition().catch((err) => {
    console.error(`[times-flat] ${err.message}`);
    process.exit(1);
  });
}
