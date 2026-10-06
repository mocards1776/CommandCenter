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

function buildFixture() {
  const lead = {
    id: "lead-cards",
    favoriteKey: "stl-cardinals",
    teamName: "Cardinals",
    teamHref: "/sports/mlb",
    sportLabel: "MLB",
    leaguePath: "baseball/mlb",
    headline: "Cardinals take the night in extra innings",
    dek: "A walk-off keeps St. Louis alive.",
    body: "ST. LOUIS — The Cardinals won in the 10th on a single through the right side. ".repeat(12),
    scoreLine: "Cardinals 4, Brewers 3",
    when: "2026-10-05T01:12:00.000Z",
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
      favoriteKey: "stl-blues",
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
      favoriteKey: "mizzou",
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
  const packedStories = padObj({ rows: stories }, 814_000).rows;
  const queries = [
    { key: [ISSUE_ID, "tt-weather-marshfield"], data: { temp: 62, sky: "Clear" } },
    { key: [ISSUE_ID, "tt-watch", "2026-10-05"], data: [] },
    { key: [ISSUE_ID, "tt-wrap-bodies", "cards"], data: padObj({ bodies: [] }, 721_000) },
    { key: [ISSUE_ID, "tt-board", "paths"], data: padObj({ board: {} }, 365_000) },
    { key: [ISSUE_ID, "tt-league-news", "paths"], data: padObj({ items: [] }, 345_000) },
  ];
  return {
    id: ISSUE_ID,
    version: 1,
    status: "ready",
    printed_at: "2026-10-05T22:03:00.000Z",
    stories: packedStories,
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
  return profile.latency + (bytes / profile.download) * 1000;
}

function selectKind(select) {
  const cols = decodeURIComponent(select || "");
  if (cols.includes("queries") && cols.includes("stories")) return "full";
  if (cols.includes("queries")) return "queries";
  if (cols.includes("stories")) return "shell";
  if (cols.includes("printed_at") && !cols.includes("stories")) return "list";
  return "full";
}

async function runProfile(browser, fixture, profileName, profile, shot) {
  const page = await browser.newPage();
  await page.setViewport({ width: 768, height: 1024, deviceScaleFactor: 1 });
  await page.emulateNetworkConditions({
    offline: false,
    latency: profile.latency,
    download: profile.download,
    upload: profile.upload,
  });

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

  await page.setRequestInterception(true);
  page.on("request", async (req) => {
    const url = req.url();
    if (url.includes("/auth/v1/")) {
      await req.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ access_token: "dev", token_type: "bearer", user: { id: "measure-user" } }),
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
            headers: { "content-range": "0-0/1" },
            body,
          })
          .catch(() => {});
      }, delay);
      return;
    }
    if (url.includes("supabase.co") || url.includes("/rest/v1/")) {
      await req.respond({ status: 200, contentType: "application/json", body: "[]" });
      return;
    }
    await req.continue();
  });

  const started = Date.now();
  await page.goto(`http://127.0.0.1:${port}/newspaper?solo=1&edition=${ISSUE_ID}`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await page.waitForFunction(
    () => {
      const root = document.querySelector(".newspaper-root");
      const name = document.querySelector(".wsj-nameplate");
      const ready = root?.getAttribute("data-times-ready") === "1";
      const visible = name && getComputedStyle(name).visibility !== "hidden";
      return Boolean(ready && visible);
    },
    { timeout: 90_000 },
  );
  const firstPaint = Date.now() - started;
  if (shot) {
    const sheet = await page.$(".wsj-sheet") || await page.$(".newspaper-root");
    await mkdir(outDir, { recursive: true });
    const dest = path.join(outDir, `times_a1_${label}_768x1024.png`);
    await (sheet || page).screenshot({ path: dest });
  }
  await page.close();
  return { profile: profileName, firstA1PaintMs: firstPaint };
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
    results.push(await runProfile(browser, fixture, "fast-3g", PROFILES["fast-3g"], true));
    results.push(await runProfile(browser, fixture, "4g", PROFILES["4g"], false));
    // Warm: second open of the same profile (4G) after the first visit cached the shell.
    results.push({
      ...(await runProfile(browser, fixture, "4g-warm", PROFILES["4g"], false)),
      profile: "4g-warm",
    });
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
