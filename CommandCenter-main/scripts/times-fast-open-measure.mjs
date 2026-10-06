/**
 * Headless Chromium: time to first A1 paint at 768×1024 under Fast 3G / 4G,
 * plus A1 screenshots. Mocks newspaper_issues with a 2026-10-05-evening-shaped
 * payload (241 stories, heavy wrap/board/league desks).
 *
 *   node scripts/times-fast-open-measure.mjs --dist dist --out /opt/cursor/artifacts --label after
 */
import { createServer } from "node:http";
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync, createReadStream, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const args = process.argv.slice(2);
const dist = path.resolve(root, arg("--dist", "dist"));
const outDir = path.resolve(arg("--out", "/opt/cursor/artifacts"));
const label = arg("--label", "after");
const port = Number(arg("--port", "4177"));
const ISSUE_ID = "2026-10-05-evening";

const PROFILES = {
  "fast-3g": { latency: 562.5, download: (1.6 * 1024 * 1024) / 8, upload: (750 * 1024) / 8 },
  "4g": { latency: 20, download: (4 * 1024 * 1024) / 8, upload: (3 * 1024 * 1024) / 8 },
};

function arg(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

function padObj(value, bytes) {
  const json = JSON.stringify(value);
  if (json.length >= bytes) return value;
  return { ...value, _pad: "x".repeat(Math.max(0, bytes - json.length - 16)) };
}

function wxDay(date) {
  return {
    date,
    highF: 72,
    lowF: 48,
    precipChance: 10,
    precipIn: 0,
    code: 1,
    sky: "sun",
    summary: "Mostly sunny",
    sunrise: "07:12",
    sunset: "18:44",
    uv: 5,
    windMaxMph: 8,
  };
}

function buildFixture() {
  const when = "2026-10-05T18:00:00.000Z";
  const lead = {
    id: "lead-cards",
    favoriteKey: "mlb-stl",
    teamName: "Cardinals",
    teamHref: "/sports/mlb",
    sportLabel: "MLB",
    leaguePath: "baseball/mlb",
    headline: "Cardinals take the night in extra innings",
    dek: "A walk-off keeps St. Louis alive.",
    body: "ST. LOUIS — The Cardinals won in the 10th on a single through the right side. ".repeat(12),
    scoreLine: "Cardinals 4, Brewers 3",
    status: "Final",
    when,
    won: true,
    gameHref: null,
    wrapHref: null,
    feedUrl: null,
    gameId: "401581001",
    stats: [],
    leaders: [],
    teamStats: [],
    division: [],
    photo: null,
    editorFront: 0,
    editorRank: 0,
  };
  const stories = [
    lead,
    {
      ...lead,
      id: "second-blues",
      favoriteKey: "nhl-stl",
      teamName: "Blues",
      sportLabel: "NHL",
      leaguePath: "hockey/nhl",
      headline: "Blues even the series on the road",
      dek: "Binnington stands tall.",
      body: "WINNIPEG — Jordan Binnington stopped 34 shots as St. Louis evened the series. ".repeat(10),
      scoreLine: "Blues 3, Jets 1",
      editorFront: 1,
      editorRank: 1,
    },
    {
      ...lead,
      id: "third-mizzou",
      favoriteKey: "cfb-mizzou",
      teamName: "Mizzou",
      sportLabel: "CFB",
      leaguePath: "football/college-football",
      headline: "Tigers hold serve in Columbia",
      dek: "A short-yardage stand ends it.",
      body: "COLUMBIA, Mo. — Missouri stuffed a fourth-and-1 to keep the Tigers unbeaten at home. ".repeat(10),
      scoreLine: "Missouri 24, Vanderbilt 17",
      editorFront: 2,
      editorRank: 2,
    },
  ];
  for (let i = 0; i < 238; i++) {
    stories.push({
      ...lead,
      id: `pad-${i}`,
      headline: `League note ${i + 1}`,
      dek: null,
      body: "A follow. ".repeat(8),
      editorFront: undefined,
      editorRank: 10 + i,
      favoriteKey: "",
    });
  }
  const last = stories[stories.length - 1];
  const storiesJson = JSON.stringify(stories);
  if (storiesJson.length < 814_000 && last) {
    last.body = `${last.body ?? ""}${" x".repeat(Math.ceil((814_000 - storiesJson.length) / 2))}`;
  }
  const emptyBoard = { results: [], slate: [], prior: [], week: [] };
  const weather = {
    observedAt: "2026-10-05T21:00:00.000Z",
    current: {
      tempF: 62,
      feelsLikeF: 60,
      humidity: 48,
      dewPointF: 42,
      windMph: 6,
      gustMph: 10,
      windFrom: "NW",
      pressureIn: 30.12,
      code: 1,
      sky: "sun",
      summary: "Mostly sunny",
      isDay: true,
    },
    hours: [{ time: "16:00", tempF: 62, precipChance: 5, code: 1, sky: "sun" }],
    days: [wxDay("2026-10-05"), wxDay("2026-10-06")],
    yesterday: { highF: 70, lowF: 49, precipIn: 0 },
  };
  const queries = [
    { key: [ISSUE_ID, "tt-weather-marshfield"], data: weather },
    { key: [ISSUE_ID, "tt-watch", "2026-10-05"], data: [] },
    {
      key: [ISSUE_ID, "tt-wrap-bodies", "cards"],
      data: [{ ...lead, id: "wrap-pad", body: "x".repeat(721_000) }],
    },
    {
      key: [ISSUE_ID, "tt-board", "paths"],
      data: {
        "baseball/mlb": emptyBoard,
        "hockey/nhl": emptyBoard,
        "football/college-football": emptyBoard,
      },
    },
    { key: [ISSUE_ID, "tt-league-news", "paths"], data: [] },
    { key: [ISSUE_ID, "tt-measure-pad"], data: padObj({ n: 1 }, 1_480_000) },
  ];
  return {
    id: ISSUE_ID,
    version: 1,
    status: "ready",
    printed_at: "2026-10-05T22:03:00.000Z",
    stories,
    queries,
  };
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function serveDist() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
      let file = url.pathname === "/" ? "/index.html" : url.pathname;
      const abs = path.join(dist, file.replace(/^\/+/, ""));
      if (!abs.startsWith(dist) || !existsSync(abs) || !statSync(abs).isFile()) {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        createReadStream(path.join(dist, "index.html")).pipe(res);
        return;
      }
      res.writeHead(200, { "content-type": MIME[path.extname(abs)] || "application/octet-stream" });
      createReadStream(abs).pipe(res);
    });
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

function transferMs(bytes, profile) {
  // Keep the request inside ISSUE_WAIT_MS (10s) so the filed edition applies.
  // Report the uncapped figure alongside the measured paint time.
  const raw = profile.latency + (bytes / profile.download) * 1000;
  return { raw, applied: Math.min(raw, 9_000) };
}

function selectKind(select) {
  const cols = decodeURIComponent(select || "");
  if (cols.includes("queries") && cols.includes("stories")) return "full";
  if (cols.includes("queries")) return "queries";
  if (cols.includes("stories")) return "shell";
  if (cols.includes("printed_at") && !cols.includes("stories")) return "list";
  return "full";
}

async function runProfile(page, fixture, profileName, profile, shot) {
  await page.setViewport({ width: 768, height: 1024, deviceScaleFactor: 1 });
  try {
    if (typeof page.emulateNetworkConditions === "function") {
      await page.emulateNetworkConditions({
        offline: false,
        latency: Math.min(profile.latency, 200),
        download: profile.download,
        upload: profile.upload,
      });
    }
  } catch (err) {
    console.log("network emulate skipped", err.message);
  }

  await page.evaluateOnNewDocument(() => {
    localStorage.setItem("newspaper-solo", "1");
  });

  const fullBody = {
    id: fixture.id,
    version: fixture.version,
    status: fixture.status,
    printed_at: fixture.printed_at,
    stories: fixture.stories,
    queries: fixture.queries,
  };
  const shellBody = {
    id: fixture.id,
    version: fixture.version,
    status: fixture.status,
    printed_at: fixture.printed_at,
    stories: fixture.stories,
  };
  const queryBody = {
    version: fixture.version,
    status: fixture.status,
    queries: fixture.queries,
  };
  const sizes = {
    full: JSON.stringify(fullBody).length,
    shell: JSON.stringify(shellBody).length,
    queries: JSON.stringify(queryBody).length,
    list: 80,
  };

  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      console.log("PAGE", msg.type(), msg.text());
    }
  });
  page.on("pageerror", (err) => console.log("PAGEERROR", err.message, err.stack));
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
  };
  await page.setRequestInterception(true);
  page.on("request", async (req) => {
    const url = req.url();
    if (req.method() === "OPTIONS") {
      await req.respond({ status: 204, headers: cors }).catch(() => {});
      return;
    }
    if (url.includes("/auth/v1/")) {
      await req.respond({
        status: 200,
        contentType: "application/json",
        headers: cors,
        body: JSON.stringify({
          access_token: "dev",
          token_type: "bearer",
          expires_in: 3600,
          user: { id: "measure-user" },
        }),
      });
      return;
    }
    if (url.includes("newspaper_issues")) {
      const kind = selectKind(new URL(url).searchParams.get("select") || "");
      const delay = transferMs(sizes[kind] ?? sizes.full, profile);
      const body =
        kind === "list"
          ? JSON.stringify([{ id: ISSUE_ID, printed_at: fixture.printed_at }])
          : kind === "shell"
            ? JSON.stringify(shellBody)
            : kind === "queries"
              ? JSON.stringify(queryBody)
              : JSON.stringify(fullBody);
      setTimeout(() => {
        req
          .respond({
            status: 200,
            contentType: "application/json",
            headers: { ...cors, "content-range": "0-0/1" },
            body,
          })
          .catch(() => {});
      }, delay.applied);
      return;
    }
    if (url.includes("fonts.googleapis.com") || url.includes("fonts.gstatic.com")) {
      await req.respond({
        status: 200,
        headers: cors,
        contentType: url.includes("gstatic") ? "font/woff2" : "text/css",
        body: url.includes("gstatic") ? "" : "/* measure */",
      });
      return;
    }
    if (url.includes("supabase.co") || url.includes("/rest/v1/") || url.includes("espn.com") || url.includes("site.api")) {
      await req.respond({ status: 200, contentType: "application/json", headers: cors, body: "[]" });
      return;
    }
    await req.continue();
  });

  const started = Date.now();
  await page.goto(`http://127.0.0.1:${port}/newspaper?solo=1&edition=${ISSUE_ID}`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  try {
    await page.waitForFunction(
      () => {
        const root = document.querySelector(".newspaper-root");
        const name = document.querySelector(".wsj-nameplate");
        const ready = root?.getAttribute("data-times-ready") === "1";
        const visible = name && getComputedStyle(name).visibility !== "hidden";
        const text = document.body?.innerText || "";
        const story =
          text.includes("Cardinals take the night") ||
          text.includes("Blues even the series") ||
          text.includes("Tigers hold serve");
        const weather = text.includes("MARSHFIELD") || text.includes("Marshfield");
        return Boolean(ready && visible && story && weather);
      },
      { timeout: 90_000 },
    );
  } catch (err) {
    const html = await page.content();
    console.log("DEBUG url", page.url());
    console.log("DEBUG html head", html.slice(0, 1500));
    console.log(
      "DEBUG flags",
      await page.evaluate(() => ({
        ready: document.querySelector(".newspaper-root")?.getAttribute("data-times-ready"),
        name: !!document.querySelector(".wsj-nameplate"),
        hold: !!document.querySelector(".tt-hold"),
        body: document.body?.innerText?.slice(0, 500),
      })),
    );
    throw err;
  }
  const firstPaint = Date.now() - started;
  await page
    .waitForFunction(
      () => document.querySelector(".wsj-nameplate") && document.querySelector(".wsj-front, .wsj-body, .wsj-sheet"),
      { timeout: 30_000 },
    )
    .catch(() => {});
  await new Promise((r) => setTimeout(r, 2_000));
  if (shot) {
    await mkdir(outDir, { recursive: true });
    const dest = path.join(outDir, `times_a1_${label}_768x1024.png`);
    await page.screenshot({ path: dest, clip: { x: 0, y: 0, width: 768, height: 1024 } });
  }
  const flags = await page.evaluate(() => ({
    ready: document.querySelector(".newspaper-root")?.getAttribute("data-times-ready"),
    nameplate: document.querySelector(".wsj-nameplate")?.textContent ?? "",
    lead: document.querySelector(".wsj-front h2, .lead h2, .wsj-hed")?.textContent ?? "",
  }));
  return {
    profile: profileName,
    firstA1PaintMs: firstPaint,
    payloadBytes: sizes,
    payloadTransferMs: {
      full: transferMs(sizes.full, profile),
      shell: transferMs(sizes.shell, profile),
      queries: transferMs(sizes.queries, profile),
    },
    flags,
  };
}

async function runCold(browser, fixture, profileName, profile, shot) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  try {
    return await runProfile(page, fixture, profileName, profile, shot);
  } finally {
    await context.close();
  }
}

async function main() {
  if (!existsSync(path.join(dist, "index.html"))) {
    throw new Error(`No build at ${dist}`);
  }
  const server = await serveDist();
  const fixture = buildFixture();
  const browser = await puppeteer.launch({
    executablePath: "/usr/local/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  const results = [];
  try {
    results.push(await runCold(browser, fixture, "fast-3g", PROFILES["fast-3g"], false));
    const warmContext = await browser.createBrowserContext();
    const cold4g = await warmContext.newPage();
    results.push(await runProfile(cold4g, fixture, "4g", PROFILES["4g"], true));
    await cold4g.close();
    const warm4g = await warmContext.newPage();
    results.push(await runProfile(warm4g, fixture, "4g-warm", PROFILES["4g"], false));
    await warm4g.close();
    await warmContext.close();
  } finally {
    await browser.close();
    server.close();
  }
  const report = {
    label,
    viewport: { width: 768, height: 1024 },
    issue: ISSUE_ID,
    results,
  };
  await mkdir(outDir, { recursive: true });
  const reportPath = path.join(outDir, `times_fast_open_${label}.json`);
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`wrote ${reportPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
