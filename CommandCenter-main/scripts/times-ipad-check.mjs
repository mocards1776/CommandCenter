/**
 * The Thompson Times on an iPad Pro 13", in WebKit, against a filed edition.
 *
 * Serves `dist`, answers Supabase REST from a local fixture (a filed
 * `newspaper_issues` row plus optional companions), and reports:
 *   - ms from navigation to the front page showing (`data-times-ready="1"`)
 *   - anything on A1 that moves, resizes, or changes text after it shows
 *   - per page: ink past the page box, or a page box past the screen
 *   - page turns: the longest frame while the pager glides to the next page
 *
 * Build first with a mock Supabase origin and the auth bypass:
 *   VITE_SUPABASE_URL=https://mock.supabase.test VITE_SUPABASE_ANON_KEY=x \
 *   VITE_DEV_BYPASS_AUTH=1 npx vite build
 *
 *   node scripts/times-ipad-check.mjs --issue path/to/issue.json \
 *     [--companions path/to/companions.json] [--out dir] [--pages 12] \
 *     [--now 2026-10-09T15:00:00Z] [--mode safari|app|landscape] \
 *     [--favorites mlb-stl,nhl-stl,...]
 *
 * Fixture files hold private edition data. Keep them out of git.
 */
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const dist = path.resolve(root, arg("--dist", "dist"));
const outDir = path.resolve(arg("--out", "/tmp/times-ipad-check"));
const issuePath = arg("--issue", "");
const companionsPath = arg("--companions", "");
const pageShots = Number(arg("--pages", "12"));
const nowIso = arg("--now", "");
const mode = arg("--mode", "safari");
/** Comma-separated favorite keys in desk order, as filed in `newspaper_desk.fav_order`. */
const favorites = arg("--favorites", "");
const port = Number(arg("--port", "4188"));
/** Home Wi-Fi: 40 ms round trip, ~25 Mbit/s of compressed JSON. */
const LATENCY_MS = Number(arg("--latency", "40"));
const BYTES_PER_MS = Number(arg("--bytes-per-ms", "3000"));

/**
 * iPad Pro 13" (M4) is 1032×1376 points. Safari with the separate tab bar
 * leaves roughly 1032×1262 for the page; the Home Screen app leaves the full
 * screen minus the status bar and home indicator.
 */
const MODES = {
  safari: { width: 1032, height: 1262 },
  app: { width: 1032, height: 1332 },
  landscape: { width: 1376, height: 940 },
};

if (!issuePath || !existsSync(issuePath)) {
  console.error("--issue <filed newspaper_issues row as JSON> is required");
  process.exit(2);
}
if (!existsSync(path.join(dist, "index.html"))) {
  console.error(`No build at ${dist}. Run vite build with the mock Supabase env first.`);
  process.exit(2);
}

const issue = JSON.parse(readFileSync(issuePath, "utf8"));
const companions = companionsPath && existsSync(companionsPath) ? JSON.parse(readFileSync(companionsPath, "utf8")) : {};
const issueRow = {
  id: issue.id,
  version: issue.version ?? 1,
  status: issue.status ?? "ready",
  stories: issue.stories,
  queries: issue.queries,
  printed_at: issue.printedAt ?? issue.printed_at,
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

function serve() {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    let file = path.join(dist, decodeURIComponent(url.pathname));
    if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) {
      file = path.join(dist, "index.html");
    }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

function pick(row, select) {
  if (!select || select === "*") return row;
  const out = {};
  for (const col of select.split(",").map((s) => s.trim()).filter(Boolean)) out[col] = row[col];
  return out;
}

function tableRows(table, params) {
  const eq = (col) => params.get(col)?.replace(/^eq\./, "");
  switch (table) {
    case "newspaper_issues": {
      const id = eq("id");
      if (id && id !== issueRow.id) return [];
      return [issueRow];
    }
    case "times_national_news":
      return companions.national && (!eq("issue_id") || eq("issue_id") === companions.national.issue_id)
        ? [companions.national]
        : [];
    case "times_day_schedule":
      return companions.day ? [companions.day] : [];
    case "times_beez":
      return companions.beez ? [companions.beez] : [];
    case "times_race_briefs":
      return companions.races ?? [];
    default:
      return [];
  }
}

let traceStart = Date.now();

async function mockSupabase(route) {
  const req = route.request();
  const url = new URL(req.url());
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const rest = url.pathname.match(/^\/rest\/v1\/([^/]+)/);
  if (!rest) {
    await route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
    return;
  }
  if (req.method() !== "GET") {
    await route.fulfill({ status: 201, contentType: "application/json", body: "[]" });
    return;
  }
  const rows = tableRows(rest[1], url.searchParams).map((row) => pick(row, url.searchParams.get("select")));
  const single = (req.headers()["accept"] ?? "").includes("vnd.pgrst.object");
  if (process.env.TT_TRACE) {
    console.error(`+${Date.now() - traceStart}ms mock`, rest[1], url.search.slice(0, 100), single ? "single" : "array", rows.length);
  }
  if (single && !rows.length) {
    await route.fulfill({ status: 406, contentType: "application/json", body: '{"code":"PGRST116"}' });
    return;
  }
  const body = JSON.stringify(single ? rows[0] : rows);
  await wait(LATENCY_MS + gzipSync(body).length / BYTES_PER_MS);
  await route.fulfill({ status: 200, contentType: "application/json", body });
}

/** Freeze the edition clock without faking timers. */
function clockScript(iso) {
  return `(() => {
    const shift = new Date(${JSON.stringify(iso)}).getTime() - Date.now();
    const Real = Date;
    class Shifted extends Real {
      constructor(...a) { a.length ? super(...a) : super(Real.now() + shift); }
      static now() { return Real.now() + shift; }
    }
    globalThis.Date = Shifted;
  })();`;
}

async function snapshotA1(page) {
  return page.evaluate(() => {
    const sheet = document.querySelector('.wsj-page[data-kind="favorites-front"] .wsj-sheet');
    if (!sheet) return null;
    const nodes = [...sheet.querySelectorAll("h1, h2, h3, p, img, figure, section, aside, li, table")];
    return {
      text: sheet.innerText.length,
      boxes: nodes.map((el) => {
        const r = el.getBoundingClientRect();
        return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height), (el.textContent ?? "").length];
      }),
    };
  });
}

function diffSnap(a, b) {
  if (!a || !b) return { moved: -1, note: "front page missing" };
  let moved = 0;
  const n = Math.min(a.boxes.length, b.boxes.length);
  for (let i = 0; i < n; i++) {
    const [x1, y1, w1, h1, t1] = a.boxes[i];
    const [x2, y2, w2, h2, t2] = b.boxes[i];
    if (Math.abs(x1 - x2) > 1 || Math.abs(y1 - y2) > 1 || Math.abs(w1 - w2) > 1 || Math.abs(h1 - h2) > 1 || t1 !== t2) moved++;
  }
  return { moved, added: b.boxes.length - a.boxes.length, textDelta: b.text - a.text };
}

/** Ink past the page box, and a page box past the screen, for the folio in view. */
async function pageFit(page) {
  return page.evaluate(() => {
    const pager = document.querySelector(".wsj-pager");
    if (!pager) return null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pages = [...pager.querySelectorAll(".wsj-page")];
    const live = pages.find((p) => {
      const r = p.getBoundingClientRect();
      return r.left > -5 && r.left < vw / 2;
    });
    if (!live) return null;
    const sheet = live.querySelector(".wsj-sheet");
    if (!sheet) return null;
    const box = sheet.getBoundingClientRect();
    const clipped = [];
    for (const el of sheet.querySelectorAll("*")) {
      if (el.closest("[data-tt-clip]")) continue;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const past = r.bottom - box.bottom > 2 || r.right - box.right > 2 || box.left - r.left > 2;
      if (past && el.children.length === 0 && (el.textContent ?? "").trim()) {
        clipped.push(`${el.tagName.toLowerCase()}.${[...el.classList].join(".")} "${(el.textContent ?? "").trim().slice(0, 40)}"`);
      }
    }
    return {
      folio: live.dataset.folio,
      kind: live.dataset.kind,
      sheet: [Math.round(box.left), Math.round(box.top), Math.round(box.width), Math.round(box.height)],
      offScreen: box.bottom - vh > 2 || box.right - vw > 2 || box.left < -2 || box.top < -2,
      scrolls: live.scrollHeight > live.clientHeight + 2,
      clipped: clipped.slice(0, 8),
      clippedCount: clipped.length,
    };
  });
}

/** Longest gap between frames while the pager turns one page. */
async function turnJank(page) {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const pager = document.querySelector(".wsj-pager");
        if (!pager) return resolve(null);
        const gaps = [];
        let last = performance.now();
        let stop = false;
        const tick = (t) => {
          gaps.push(t - last);
          last = t;
          if (!stop) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
        setTimeout(() => {
          stop = true;
          const sorted = [...gaps].sort((a, b) => b - a);
          resolve({ maxFrameMs: Math.round(sorted[0] ?? 0), over50: gaps.filter((g) => g > 50).length, frames: gaps.length });
        }, 1200);
      }),
  );
}

async function main() {
  const { webkit } = await import("playwright");
  await mkdir(outDir, { recursive: true });
  const server = await serve();
  const viewport = MODES[mode] ?? MODES.safari;
  const browser = await webkit.launch();
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    userAgent:
      "Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1",
  });
  if (nowIso) await context.addInitScript(clockScript(nowIso));
  if (favorites) {
    await context.addInitScript((order) => {
      localStorage.setItem("sports-layout-v1", JSON.stringify({ order, hidden: [], pinnedPlayers: [] }));
    }, favorites.split(","));
  }
  await context.route("https://mock.supabase.test/**", mockSupabase);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  const requests = {};
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (url.hostname === "localhost") return;
    const rest = url.pathname.match(/^\/(rest|functions)\/v1\/([^/?]+)/);
    const name = rest ? `${rest[1]}:${rest[2]}` : req.resourceType() === "image" ? "image" : url.hostname;
    requests[name] = (requests[name] ?? 0) + 1;
  });

  const t0 = Date.now();
  traceStart = t0;
  if (process.env.TT_TRACE) {
    page.on("console", (msg) => console.error(`+${Date.now() - t0}ms console`, msg.text().slice(0, 200)));
  }
  await page.goto(`http://localhost:${port}/newspaper`, { waitUntil: "commit" });
  let readyMs = null;
  try {
    await page.waitForFunction(
      () => document.querySelector("[data-times-ready]")?.getAttribute("data-times-ready") === "1",
      undefined,
      { timeout: 30_000, polling: 25 },
    );
    readyMs = Date.now() - t0;
  } catch {
    readyMs = null;
  }
  const at0 = await snapshotA1(page);
  await page.screenshot({ path: path.join(outDir, `${mode}-A1-at-ready.png`) });
  await page.waitForTimeout(2500);
  const at25 = await snapshotA1(page);
  await page.waitForTimeout(3500);
  const at6 = await snapshotA1(page);
  await page.screenshot({ path: path.join(outDir, `${mode}-A1-after-6s.png`) });

  const pages = [];
  const turns = [];
  const fit0 = await pageFit(page);
  if (fit0) pages.push(fit0);
  for (let i = 1; i < pageShots; i++) {
    const turn = await turnJank(page);
    turns.push(turn);
    await page.waitForTimeout(500);
    const fit = await pageFit(page);
    if (!fit) break;
    pages.push(fit);
    await page.screenshot({ path: path.join(outDir, `${mode}-${String(i + 1).padStart(2, "0")}-${fit.folio}.png`) });
  }

  const report = {
    mode,
    viewport,
    readyMs,
    afterReady: { "2.5s": diffSnap(at0, at25), "6s": diffSnap(at0, at6) },
    pages,
    turns,
    requests,
    errors: errors.slice(0, 10),
  };
  await writeFile(path.join(outDir, `${mode}-report.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, pages: pages.map((p) => ({ folio: p.folio, offScreen: p.offScreen, scrolls: p.scrolls, clipped: p.clippedCount })) }, null, 2));
  await browser.close();
  server.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
