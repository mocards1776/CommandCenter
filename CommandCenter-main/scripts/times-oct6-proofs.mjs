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

const ONLY = arg("--only", "");
const ALL_FOLIOS = [
  { hash: "A1", file: "2026-10-06-morning_A1_768x1024.png", wait: /Stephen A|Cowboys|MoScout|Wilson Targeted/i },
  { hash: "A2", file: "2026-10-06-morning_A2_weather_768x1024.png", wait: /Marshfield|feels|wind|Today/i },
  { hash: "A3", file: "2026-10-06-morning_A3_768x1024.png", wait: /Blues|Missouri|Mizzou|Central|Chiefs|Cowboys|rain/i },
  { hash: "A7", file: "2026-10-06-morning_A7_form_768x1024.png", wait: /Pts\/G|RZ|Sacks|Goals|form|Missouri|Blues/i },
  { hash: "A9", file: "2026-10-06-morning_A9_watch_768x1024.png", wait: /WATCH|Tonight|viewing|must/i },
  { hash: "B1", file: "2026-10-06-morning_B1_national_768x1024.png", wait: /Hasan|Hastert|National/i },
  { hash: "MLB1", file: "2026-10-06-morning_MLB1_768x1024.png", wait: /Rays|Yankees|ALDS|White Sox/i },
  { hash: "NFL1", file: "2026-10-06-morning_NFL1_768x1024.png", wait: /Patriots|Kincaid|Giants|Cardinals/i },
  { hash: "NFL2", file: "2026-10-06-morning_NFL2_768x1024.png", wait: /Chiefs|Raiders|Mahomes/i },
  { hash: "CFB1", file: "2026-10-06-morning_CFB1_768x1024.png", wait: /Missouri|Mizzou|SEC|college/i },
];
const FOLIOS = ONLY ? ALL_FOLIOS.filter((f) => f.hash === ONLY) : ALL_FOLIOS;

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
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem("newspaper-solo", "1");
    });
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

    await page.goto(`http://127.0.0.1:${port}/newspaper?solo=1&edition=${ISSUE_ID}`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await page
      .waitForFunction(
        () => {
          const ready = document.querySelector(".newspaper-root")?.getAttribute("data-times-ready") === "1";
          const text = document.body?.innerText || "";
          return ready && /Thompson Times|Cowboys|Stephen A|Marshfield/i.test(text);
        },
        { timeout: 90_000 },
      )
      .catch(async () => {
        const flags = await page.evaluate(() => ({
          ready: document.querySelector(".newspaper-root")?.getAttribute("data-times-ready"),
          body: document.body?.innerText?.slice(0, 400),
        }));
        console.log("ready wait failed", flags);
      });
    await new Promise((r) => setTimeout(r, 2000));
    let currentIdx = 0;

    for (const folio of FOLIOS) {
      const target = await page.evaluate((hash) => {
        const sheets = [...document.querySelectorAll(".wsj-page")];
        return sheets.findIndex(
          (node) => (node.getAttribute("aria-label") || "").replace(/^Page\s+/, "") === hash,
        );
      }, folio.hash);
      const delta = target - currentIdx;
      for (let i = 0; i < Math.abs(delta); i++) {
        await page.keyboard.press(delta > 0 ? "ArrowRight" : "ArrowLeft");
        await new Promise((r) => setTimeout(r, 80));
      }
      currentIdx = target;
      await new Promise((r) => setTimeout(r, 400));
      await page.evaluate((hash) => {
        const sheets = [...document.querySelectorAll(".wsj-page")];
        for (const sheet of sheets) {
          const label = (sheet.getAttribute("aria-label") || "").replace(/^Page\s+/, "");
          sheet.style.display = label === hash ? "flex" : "none";
        }
      }, folio.hash);
      await page
        .waitForFunction(
          (hash) => {
            const pager = document.querySelector(".wsj-pager");
            if (!pager) return false;
            const hit = [...pager.querySelectorAll(".wsj-page")].find((node) => {
              const r = node.getBoundingClientRect();
              return r.left > -40 && r.left < pager.clientWidth * 0.55;
            });
            const label = hit?.getAttribute("aria-label")?.replace(/^Page\s+/, "") ?? "";
            return label === hash;
          },
          { timeout: 15_000 },
          folio.hash,
        )
        .catch(() => {});
      await new Promise((r) => setTimeout(r, 800));
      const dest = path.join(outDir, folio.file);
      await page.screenshot({ path: dest, clip: { x: 0, y: 0, width: 768, height: 1024 } });
      const text = await page.evaluate(() => document.body?.innerText || "");
      const visible = await page.evaluate(() => {
        const pager = document.querySelector(".wsj-pager");
        const hit = pager
          ? [...pager.querySelectorAll(".wsj-page")].find((node) => {
              const r = node.getBoundingClientRect();
              return r.left > -40 && r.left < pager.clientWidth * 0.55;
            })
          : null;
        return hit?.getAttribute("aria-label") ?? "";
      });
      const hit = folio.wait.test(text);
      const junk = /Join Washington Examiner|Laura Ingraham|Hegseth ['‘]s|1% rain/.test(text);
      notes.push({
        folio: folio.hash,
        visible,
        file: dest,
        matched: hit,
        junk,
        snippet: text.slice(0, 220).replace(/\s+/g, " "),
      });
      await page.evaluate(() => {
        for (const sheet of document.querySelectorAll(".wsj-page")) sheet.style.display = "";
      });
      console.log(folio.hash, "visible", visible, dest, "matched", hit, "junk", junk);
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
