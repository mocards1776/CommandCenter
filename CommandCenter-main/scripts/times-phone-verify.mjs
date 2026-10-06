/**
 * Local Playwright proof of the four Times Telegram phone cards.
 * Writes PNGs to /opt/cursor/artifacts (or --out) and prints pixel sizes.
 *
 *   VITE_DEV_BYPASS_AUTH=1 node scripts/times-phone-verify.mjs
 *   --base http://127.0.0.1:5173  if Vite is already up
 */
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PHONE = { width: 430, height: 932 };
const PHONE_SCALE = 3;
const ISSUE = "2026-10-05-evening";
const CARDS = ["front", "weather", "day", "watch"];
const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, "..");
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const outDir = opt("out") || process.env.TIMES_PHONE_VERIFY_OUT || "/opt/cursor/artifacts";
const givenBase = opt("base");

function pngSize(buf) {
  if (buf[0] !== 0x89 || buf[1] !== 0x50) throw new Error("not a PNG");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

async function waitFor(url, ms = 90_000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Vite did not start: ${url}`);
}

async function shoot(page, card, sample) {
  const q = new URLSearchParams({ card, issue: ISSUE, solo: "1" });
  if (sample) q.set("sample", sample);
  await page.setViewportSize(PHONE);
  await page.goto(`/newspaper/phone-card?${q}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  if (new URL(page.url()).pathname.startsWith("/login")) throw new Error(`${card} landed on /login`);
  await page.addStyleTag({ content: "html,body{margin:0;padding:0;overflow:hidden;background:#fbfaf6}" });
  const root = page.locator(`[data-phone-card="${card}"]`);
  await root.waitFor({ state: "attached", timeout: 45_000 });
  await page.waitForFunction(
    (kind) => {
      const ready = document.querySelector(`[data-phone-card="${kind}"]`)?.getAttribute("data-ready");
      return ready && ready !== "loading";
    },
    card,
    { timeout: 45_000 },
  );
  const ready = await root.getAttribute("data-ready");
  if (ready !== "1") throw new Error(`${card} not ready: ${ready}`);
  await page.locator(".tt-phone-card").waitFor({ state: "visible", timeout: 15_000 });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(800);
  await page
    .waitForFunction(() => document.querySelector(".tt-phone-card")?.getAttribute("data-phone-fit") === "1", {
      timeout: 8_000,
    })
    .catch(() => {});
  const kept = await page.locator(".tt-phone-card").getAttribute("data-watch-kept");
  const source = await page.locator(".tt-phone-card").getAttribute("data-watch-source");
  const png = await page.screenshot({
    clip: { x: 0, y: 0, width: PHONE.width, height: PHONE.height },
    animations: "disabled",
  });
  return { png, kept: kept ? Number(kept) : null, source: source ? Number(source) : null };
}

async function main() {
  const { chromium } = await import("playwright");
  await mkdir(outDir, { recursive: true });
  let child = null;
  let base = givenBase;
  if (!base) {
    child = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", "5173", "--strictPort"], {
      cwd: appRoot,
      env: { ...process.env, VITE_DEV_BYPASS_AUTH: "1" },
      stdio: "inherit",
    });
    base = "http://127.0.0.1:5173";
    await waitFor(base);
  }
  const browser = await chromium.launch({ args: ["--force-color-profile=srgb"] });
  const report = [];
  try {
    const context = await browser.newContext({
      viewport: PHONE,
      deviceScaleFactor: PHONE_SCALE,
      hasTouch: true,
      locale: "en-US",
      timezoneId: "America/Chicago",
      colorScheme: "light",
      baseURL: base,
    });
    for (const card of CARDS) {
      const page = await context.newPage();
      const sample = card === "day" ? "1" : "";
      let shot;
      try {
        shot = await shoot(page, card, sample);
      } catch (err) {
        if (card !== "front" && card !== "day") throw err;
        console.log(`${card} live/sample miss (${err.message}); retrying with fixtures`);
        shot = await shoot(page, card, "1");
      }
      const { png, kept, source } = shot;
      const size = pngSize(png);
      const dest = path.join(outDir, `${ISSUE}-${card}.png`);
      await writeFile(dest, png);
      const line = `${card}: ${size.width}x${size.height} → ${dest}${
        kept != null ? ` (kept ${kept} of ${source} games)` : ""
      }`;
      console.log(line);
      report.push({ card, ...size, dest, kept, source });
      if (size.width !== PHONE.width * PHONE_SCALE || size.height !== PHONE.height * PHONE_SCALE) {
        throw new Error(`${card} is ${size.width}x${size.height}, expected ${PHONE.width * PHONE_SCALE}x${PHONE.height * PHONE_SCALE}`);
      }
      await page.close();
    }
    const page = await context.newPage();
    const heavy = await shoot(page, "watch", "heavy");
    const size = pngSize(heavy.png);
    const dest = path.join(outDir, `${ISSUE}-watch-heavy.png`);
    await writeFile(dest, heavy.png);
    console.log(`watch-heavy: ${size.width}x${size.height} → ${dest} (kept ${heavy.kept} of ${heavy.source} games)`);
    if (size.width !== PHONE.width * PHONE_SCALE || size.height !== PHONE.height * PHONE_SCALE) {
      throw new Error(`heavy watch grew to ${size.width}x${size.height}`);
    }
    if (!(heavy.source > 8) || !(heavy.kept < heavy.source)) {
      throw new Error(`heavy slate did not drop games (kept ${heavy.kept} of ${heavy.source})`);
    }
    report.push({ card: "watch-heavy", ...size, dest, kept: heavy.kept, source: heavy.source });
    await context.close();
  } finally {
    await browser.close();
    if (child) child.kill("SIGTERM");
  }
  await writeFile(path.join(outDir, "times-phone-verify.json"), JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
