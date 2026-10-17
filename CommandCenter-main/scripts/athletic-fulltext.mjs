/**
 * Pull a few Athletic article bodies into public.times_athletic_fulltext.
 * Not part of the press, and nothing schedules it.
 *
 * Off unless ATHLETIC_FULLTEXT=on. Exits before Chrome if the 1-minute load
 * is at or above the CPU count, or if chrome / chromium / playwright is
 * already running. One non-headless Chrome, about 15 seconds on each page,
 * at most 15 articles (club-named first). Stops on the first DataDome block.
 * No retries. Hard stop at 6 minutes, and the browser is always closed.
 *
 * Run once by hand, from CommandCenter-main:
 *
 *   ATHLETIC_FULLTEXT=on \
 *   SUPABASE_URL="https://PROJECT.supabase.co" \
 *   SUPABASE_SERVICE_ROLE_KEY="..." \
 *   xvfb-run -a node scripts/athletic-fulltext.mjs
 *
 * Chrome is /usr/bin/google-chrome. playwright-core is a devDependency
 * (npm install in CommandCenter-main). It does not download a browser.
 *
 * Cron line to add later. Do not install it now:
 *
 *   15 16 * * * cd /path/to/CommandCenter-main && ATHLETIC_FULLTEXT=on SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." xvfb-run -a node scripts/athletic-fulltext.mjs >> /var/log/athletic-fulltext.log 2>&1
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";

const LIMIT_MS = 6 * 60 * 1000;
const PAGE_WAIT_MS = 15_000;
const MAX_ARTICLES = 15;
const FEEDS = [
  "https://www.nytimes.com/athletic/rss/nfl/",
  "https://www.nytimes.com/athletic/rss/college-football/",
  "https://www.nytimes.com/athletic/rss/mlb/",
  "https://www.nytimes.com/athletic/rss/nba/",
  "https://www.nytimes.com/athletic/rss/college-basketball/",
  "https://www.nytimes.com/athletic/rss/nhl/",
  "https://www.nytimes.com/athletic/rss/premier-league/",
  "https://www.nytimes.com/athletic/rss/soccer/",
  "https://rss.app/feeds/HJaMzlWvefjQfs5f.xml",
];
const CLUBS = [
  "cardinals",
  "blues",
  "mizzou",
  "missouri state",
  "lions",
  "chiefs",
  "cowboys",
  "76ers",
  "sixers",
  "wrexham",
  "wolves",
  "arsenal",
];

export function oneMinuteLoad(uptimeText) {
  const match = /load averages?: ([0-9.]+)/.exec(uptimeText);
  return match ? Number(match[1]) : Number.NaN;
}

export function loadIsHigh(load, cpus) {
  return !Number.isFinite(load) || load >= Math.max(1, cpus);
}

export function normalizeAthleticUrl(raw) {
  if (!raw || !/^https?:\/\//i.test(raw)) return null;
  if (!/(?:theathletic\.com|nytimes\.com\/athletic\/)/i.test(raw)) return null;
  try {
    const url = new URL(raw.trim());
    url.hash = "";
    url.search = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function namesClub(text) {
  const hay = text.toLowerCase();
  return CLUBS.some((club) => hay.includes(club));
}

/** Club-named items first, then the rest. At most `limit`. */
export function pickAthleticArticles(items, limit = MAX_ARTICLES) {
  const seen = new Set();
  const club = [];
  const rest = [];
  for (const item of items) {
    const url = normalizeAthleticUrl(item.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const row = { url, title: item.title ?? "" };
    if (namesClub(`${row.title} ${item.snippet ?? ""}`)) club.push(row);
    else rest.push(row);
  }
  return [...club, ...rest].slice(0, limit);
}

export function isDataDomeBlock(html) {
  return /datadome|captcha-delivery|geo\.captcha-delivery|please verify you are a human/i.test(html);
}

function decode(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block, name) {
  const match = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(block);
  return match ? decode(match[1]) : "";
}

export function rssArticles(xml) {
  const out = [];
  for (const block of xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? []) {
    const link = tag(block, "link") || /<link[^>]+href="([^"]+)"/i.exec(block)?.[1] || "";
    const title = tag(block, "title");
    if (!title || !link) continue;
    out.push({ title, url: link, snippet: tag(block, "description") });
  }
  return out;
}

function browserAlreadyRunning() {
  try {
    const out = execFileSync("pgrep", ["-af", "chrome|chromium|playwright"], { encoding: "utf8" });
    return out
      .split("\n")
      .some((line) => /google-chrome|chromium|playwright/i.test(line) && !/\bpgrep\b/.test(line));
  } catch {
    return false;
  }
}

async function fetchFeeds(deadline) {
  const items = [];
  for (const url of FEEDS) {
    if (Date.now() >= deadline) break;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ThompsonTimes/1.0)" },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) continue;
      items.push(...rssArticles(await res.text()));
    } catch {
      /* one feed failing leaves the others */
    }
  }
  return items;
}

async function saveBody(url, body) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  const res = await fetch(`${base}/rest/v1/times_athletic_fulltext`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({ url, body, fetched_at: new Date().toISOString() }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`save ${res.status}`);
}

async function main() {
  if (process.env.ATHLETIC_FULLTEXT !== "on") {
    console.error("athletic-fulltext: ATHLETIC_FULLTEXT=on is required. Exiting.");
    return;
  }
  const uptime = execFileSync("uptime", { encoding: "utf8" });
  const load = oneMinuteLoad(uptime);
  const cpus = os.cpus().length;
  if (loadIsHigh(load, cpus)) {
    console.error(`athletic-fulltext: load ${load} on ${cpus} cpus is high. Exiting.`);
    return;
  }
  if (browserAlreadyRunning()) {
    console.error("athletic-fulltext: chrome or playwright is already running. Exiting.");
    return;
  }

  const deadline = Date.now() + LIMIT_MS;
  const { chromium } = await import("playwright-core");
  let browser = null;
  const close = async () => {
    const current = browser;
    browser = null;
    if (!current) return;
    try {
      await current.close();
    } catch {
      /* already closed */
    }
  };
  const timer = setTimeout(() => {
    console.error("athletic-fulltext: 6 minute limit. Closing the browser.");
    void close().finally(() => process.exit(0));
  }, LIMIT_MS);
  timer.unref?.();

  try {
    const picked = pickAthleticArticles(await fetchFeeds(deadline));
    if (!picked.length) {
      console.error("athletic-fulltext: no article URLs. Exiting.");
      return;
    }
    browser = await chromium.launch({
      executablePath: "/usr/bin/google-chrome",
      headless: false,
      args: ["--disable-blink-features=AutomationControlled"],
    });
    const page = await browser.newPage();
    let saved = 0;
    for (const item of picked) {
      if (Date.now() + PAGE_WAIT_MS + 5_000 >= deadline) break;
      try {
        await page.goto(item.url, { waitUntil: "domcontentloaded", timeout: 20_000 });
        await page.waitForTimeout(PAGE_WAIT_MS);
        const html = await page.content();
        if (isDataDomeBlock(html)) {
          console.error("athletic-fulltext: DataDome block. Stopping.");
          break;
        }
        const body = await page.evaluate(() => {
          const root =
            document.querySelector("article") ||
            document.querySelector("[data-testid='article-body']") ||
            document.querySelector(".article-content");
          if (!root) return "";
          return [...root.querySelectorAll("p")]
            .map((node) => node.innerText.replace(/\s+/g, " ").trim())
            .filter((text) => text.length > 40)
            .join("\n\n");
        });
        if (!body || body.length < 400) continue;
        await saveBody(item.url, body);
        saved += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`athletic-fulltext: skip ${item.url} (${message})`);
      }
    }
    console.error(`athletic-fulltext: saved ${saved}.`);
  } finally {
    clearTimeout(timer);
    await close();
  }
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entry && entry === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`athletic-fulltext: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
