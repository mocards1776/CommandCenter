/**
 * 768×1024 labeled proofs for the 2026-10-06-morning fixture.
 *
 *   node scripts/times-oct6-proofs.mjs --dist dist --out /opt/cursor/artifacts
 */
import { createServer } from "node:http";
import { mkdir } from "node:fs/promises";
import { existsSync, createReadStream, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const args = process.argv.slice(2);
const dist = path.resolve(root, arg("--dist", "dist"));
const outDir = path.resolve(arg("--out", "/opt/cursor/artifacts"));
const port = Number(arg("--port", "4188"));
const ISSUE_ID = "2026-10-06-morning";

const FOLIOS = [
  { hash: "A1", file: "2026-10-06-morning_A1_768x1024.png", wait: /Stephen A|Cowboys|MoScout|Wilson Targeted/i },
  { hash: "A3", file: "2026-10-06-morning_A3_768x1024.png", wait: /Blues|Missouri|Mizzou|RZ|Central/i },
  { hash: "A9", file: "2026-10-06-morning_A9_watch_768x1024.png", wait: /WATCH|Tonight|viewing/i },
  { hash: "B1", file: "2026-10-06-morning_B1_national_768x1024.png", wait: /Hasan|Hastert|National/i },
  { hash: "MLB1", file: "2026-10-06-morning_MLB1_768x1024.png", wait: /Rays|Yankees|ALDS|White Sox/i },
  { hash: "NFL1", file: "2026-10-06-morning_NFL1_768x1024.png", wait: /Patriots|Kincaid|Giants|Cardinals/i },
  { hash: "NFL2", file: "2026-10-06-morning_NFL2_768x1024.png", wait: /Chiefs|Raiders|Mahomes/i },
  { hash: "CFB1", file: "2026-10-06-morning_CFB1_768x1024.png", wait: /Missouri|Mizzou|SEC|college/i },
];

function arg(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

function mime(ext) {
  return (
    {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".woff2": "font/woff2",
      ".json": "application/json",
    }[ext] || "application/octet-stream"
  );
}

function loadFixture() {
  const issuePath = "/tmp/tt-fixture/newspaper_issue.json";
  const nationalPath = "/tmp/tt-fixture/national_news.json";
  const issue = JSON.parse(readFileSync(issuePath, "utf8"));
  const nationalRow = JSON.parse(readFileSync(nationalPath, "utf8"))[0];
  return { issue, nationalRow };
}

function serveDist() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
      let rel = decodeURIComponent(url.pathname);
      if (rel === "/" || !path.extname(rel)) rel = "/index.html";
      const abs = path.join(dist, rel);
      if (!abs.startsWith(dist) || !existsSync(abs) || !statSync(abs).isFile()) {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        createReadStream(path.join(dist, "index.html")).pipe(res);
        return;
      }
      res.writeHead(200, { "content-type": mime(path.extname(abs)) });
      createReadStream(abs).pipe(res);
    });
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

function selectKind(select) {
  const cols = decodeURIComponent(select || "");
  if (cols.includes("queries") && cols.includes("stories")) return "full";
  if (cols.includes("queries")) return "queries";
  if (cols.includes("stories")) return "shell";
  if (cols.includes("printed_at") && !cols.includes("stories")) return "list";
  return "full";
}

async function main() {
  if (!existsSync(path.join(dist, "index.html"))) throw new Error(`No build at ${dist}`);
  const { issue, nationalRow } = loadFixture();
  const planted = {
    ...issue,
    companions: { national: nationalRow },
  };
  const server = await serveDist();
  const browser = await puppeteer.launch({
    executablePath: "/usr/local/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  await mkdir(outDir, { recursive: true });
  const notes = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 768, height: 1024, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument(
      (payload) => {
        localStorage.setItem("newspaper-solo", "1");
        globalThis.__TT_PROOF_ISSUE__ = payload;
      },
      planted,
    );
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
            user: { id: "proof-user" },
          }),
        });
        return;
      }
      if (url.includes("times_national_news")) {
        await req.respond({
          status: 200,
          contentType: "application/json",
          headers: { ...cors, "content-range": "0-0/1" },
          body: JSON.stringify(nationalRow),
        });
        return;
      }
      if (url.includes("newspaper_issues")) {
        const kind = selectKind(new URL(url).searchParams.get("select") || "");
        const body =
          kind === "list"
            ? JSON.stringify([{ id: ISSUE_ID, printed_at: issue.printed_at }])
            : kind === "shell"
              ? JSON.stringify({
                  id: issue.id,
                  version: issue.version,
                  status: issue.status,
                  printed_at: issue.printed_at,
                  stories: issue.stories,
                })
              : kind === "queries"
                ? JSON.stringify({ version: issue.version, status: issue.status, queries: issue.queries })
                : JSON.stringify(issue);
        await req.respond({
          status: 200,
          contentType: "application/json",
          headers: { ...cors, "content-range": "0-0/1" },
          body,
        });
        return;
      }
      if (url.includes("fonts.googleapis.com") || url.includes("fonts.gstatic.com")) {
        await req.respond({
          status: 200,
          headers: cors,
          contentType: url.includes("gstatic") ? "font/woff2" : "text/css",
          body: url.includes("gstatic") ? "" : "/* proof */",
        });
        return;
      }
      if (url.includes("supabase.co") || url.includes("/rest/v1/") || url.includes("espn.com") || url.includes("site.api")) {
        await req.respond({ status: 200, contentType: "application/json", headers: cors, body: "[]" });
        return;
      }
      await req.continue();
    });
    page.on("pageerror", (err) => console.log("PAGEERROR", err.message));

    for (const folio of FOLIOS) {
      await page.goto(`http://127.0.0.1:${port}/newspaper?solo=1&edition=${ISSUE_ID}#${folio.hash}`, {
        waitUntil: "domcontentloaded",
        timeout: 120_000,
      });
      await page
        .waitForFunction(
          () => document.querySelector(".newspaper-root")?.getAttribute("data-times-ready") === "1",
          { timeout: 90_000 },
        )
        .catch(() => {});
      await page.evaluate((hash) => {
        window.location.hash = hash;
      }, folio.hash);
      await new Promise((r) => setTimeout(r, 2500));
      const dest = path.join(outDir, folio.file);
      await page.screenshot({ path: dest, clip: { x: 0, y: 0, width: 768, height: 1024 } });
      const text = await page.evaluate(() => document.body?.innerText || "");
      const hit = folio.wait.test(text);
      const junk = /Join Washington Examiner|Laura Ingraham|Hegseth ['‘]s|1% rain/.test(text);
      notes.push({ folio: folio.hash, file: dest, matched: hit, junk });
      console.log(folio.hash, dest, "matched", hit, "junk", junk);
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(JSON.stringify({ issue: ISSUE_ID, notes }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
