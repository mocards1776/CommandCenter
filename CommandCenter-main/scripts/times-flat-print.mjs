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
 * Auth: TIMES_SESSION_FILE (default /tmp/tt-measure/session.json) plus
 * TIMES_LAYOUT_FILE, or TIMES_SESSION_JSON. Supabase URL and the publishable
 * key come from the environment or /tmp/tt-measure/vite.env.
 * TIMES_APP_ORIGIN defaults to production.
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
  const file = await readEnvFile("/tmp/tt-measure/vite.env");
  const url = (process.env.TIMES_SUPABASE_URL || process.env.VITE_SUPABASE_URL || file.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.TIMES_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || file.VITE_SUPABASE_ANON_KEY || "";
  if (!url || !key) throw new Error("Missing Supabase URL or publishable key");
  return { url, key };
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

async function encodeWebp(pngPath, webpPath, lossless) {
  if (lossless) {
    await ffmpeg(["-y", "-i", pngPath, "-c:v", "libwebp", "-lossless", "1", "-compression_level", "6", webpPath]);
  } else {
    await ffmpeg(["-y", "-i", pngPath, "-c:v", "libwebp", "-q:v", "95", webpPath]);
  }
}

function authHeaders(config, token, extra = {}) {
  return {
    apikey: config.key,
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

async function uploadObject(config, token, objectPath, bytes, contentType) {
  const res = await fetch(`${config.url}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: "POST",
    headers: authHeaders(config, token, {
      "Content-Type": contentType,
      "x-upsert": "true",
      "cache-control": "public, max-age=86400",
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

async function waitQuiet(page, index) {
  let last = -1;
  let quiet = Date.now();
  const start = Date.now();
  while (Date.now() - start < 8_000) {
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
    const leaves = await page.evaluate(() =>
      [...document.querySelectorAll(".wsj-page")].map((el) => ({
        folio: el.getAttribute("data-folio") || "",
        kind: el.getAttribute("data-kind") || "",
      })),
    );
    if (!leaves.length) throw new Error("no folios");
    log("folios", leaves.length);

    let lossless = true;
    for (let i = 0; i < leaves.length; i++) {
      const leaf = leaves[i];
      await primePage(page, i);
      const sheet = page.locator(".wsj-page").nth(i).locator(".wsj-sheet");
      const box = await sheet.boundingBox();
      if (!box || box.height < 40) {
        log("skip", leaf.folio, "no sheet");
        continue;
      }
      const png = await sheet.screenshot({ animations: "disabled", type: "png" });
      const px = pngSize(png);
      const pngPath = path.join(outDir, `${leaf.folio}.png`);
      const webpPath = path.join(outDir, `${leaf.folio}.webp`);
      await writeFile(pngPath, png);
      if (i === 0) {
        const lossPath = path.join(outDir, `${leaf.folio}.lossless.webp`);
        await encodeWebp(pngPath, lossPath, true);
        const { size } = await import("node:fs/promises").then((fs) => fs.stat(lossPath));
        lossless = size <= 1_500_000;
        log("A1 lossless", size, "bytes;", lossless ? "using lossless" : "using webp q=95");
        if (lossless) {
          await writeFile(webpPath, await readFile(lossPath));
        } else {
          await encodeWebp(pngPath, webpPath, false);
        }
        await unlink(lossPath).catch(() => {});
      } else {
        await encodeWebp(pngPath, webpPath, lossless);
      }
      const webp = await readFile(webpPath);
      const spots = await hotspots(page, i);
      shots.push({
        folio: leaf.folio,
        kind: leaf.kind,
        index: shots.length,
        section: (/^([A-Z]+)/.exec(leaf.folio) || [])[1] || leaf.folio,
        file: webpPath,
        bytes: webp.length,
        width: px.width,
        height: px.height,
        cssWidth: Math.round(box.width),
        cssHeight: Math.round(box.height),
        hotspots: spots,
      });
      log(leaf.folio, `${px.width}x${px.height}px`, `${webp.length} bytes`, `${spots.length} links`, `css ${Math.round(box.width)}x${Math.round(box.height)}`);
      if (i !== 0) await unlink(pngPath).catch(() => {});
    }
    await page.close();
    await context.close();
  } finally {
    await browser.close();
  }

  if (!shots.length) throw new Error("captured no pages");
  const token = session.access_token;
  for (const shot of shots) {
    const bytes = await readFile(shot.file);
    await uploadObject(config, token, `${issueId}/${shot.folio}.webp`, bytes, "image/webp");
  }
  const manifest = {
    issueId,
    printedAt: new Date().toISOString(),
    geometry: { cssWidth: PAGE_W, cssViewportHeight: IPAD13.height, dpr: DPR, pageW: PAGE_W },
    pages: shots.map((shot) => ({
      folio: shot.folio,
      kind: shot.kind,
      index: shot.index,
      section: shot.section,
      url: `${config.url}/storage/v1/object/public/${BUCKET}/${issueId}/${shot.folio}.webp`,
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
  await uploadObject(config, token, `${issueId}/manifest.json`, await readFile(manifestPath), "application/json");
  const total = shots.reduce((sum, shot) => sum + shot.bytes, 0);
  log("uploaded", issueId, shots.length, "pages", total, "bytes");
  log("manifest", manifest.pages[0]?.url.replace(/\/A1\.webp$/, "/manifest.json"));
  await prune(config, token);
  return manifest;
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) {
  printFlatEdition().catch((err) => {
    console.error(`[times-flat] ${err.message}`);
    process.exit(1);
  });
}
