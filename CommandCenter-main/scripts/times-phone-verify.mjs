/**
 * Local Playwright proof of the four Times Telegram phone cards.
 * Writes PNGs to /opt/cursor/artifacts (or --out) and prints pixel sizes.
 *
 * Real path (what the production runner shoots): no ?sample=.
 * Day Ahead is skipped when times_day_schedule has no row — same as times-shots.mjs.
 * `?sample=1` is a test-harness only extra shot (day-harness.png).
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

async function openCard(page, card, sample) {
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
  return root.getAttribute("data-ready");
}

async function facts(page, card) {
  return page.evaluate((kind) => {
    const cardEl = document.querySelector(".tt-phone-card");
    const credit = document.querySelector(".tt-phone-credit");
    const rain = document.body.innerText.includes("Chance of rain");
    const art = document.querySelector(".tt-phone-front-art");
    const creditBox = credit?.getBoundingClientRect();
    return {
      kind,
      ready: document.querySelector(`[data-phone-card="${kind}"]`)?.getAttribute("data-ready"),
      stories: cardEl?.getAttribute("data-front-stories"),
      photo: cardEl?.getAttribute("data-front-photo"),
      artNatural: art instanceof HTMLImageElement ? art.naturalWidth : null,
      artCss: art instanceof HTMLElement ? Math.round(art.getBoundingClientRect().width) : null,
      wxDays: cardEl?.getAttribute("data-wx-days"),
      wxRain: cardEl?.getAttribute("data-wx-rain"),
      rainLegend: rain,
      creditText: credit?.textContent?.trim() ?? null,
      creditBottom: creditBox ? Math.round(creditBox.bottom) : null,
      creditTop: creditBox ? Math.round(creditBox.top) : null,
      gotd: cardEl?.getAttribute("data-gotd"),
      gotdPreseason: cardEl?.getAttribute("data-gotd-preseason"),
      kept: cardEl?.getAttribute("data-watch-kept"),
      source: cardEl?.getAttribute("data-watch-source"),
      dayTitle: document.body.innerText.includes("Lunch with Dad"),
    };
  }, card);
}

async function shoot(page, card, sample) {
  const ready = await openCard(page, card, sample);
  if (ready !== "1") return { ready, png: null, kept: null, source: null, facts: await facts(page, card) };
  await page.locator(".tt-phone-card").waitFor({ state: "visible", timeout: 15_000 });
  await page.evaluate(() => document.fonts?.ready);
  await page
    .waitForFunction(() => [...document.querySelectorAll("img")].every((img) => img.complete), { timeout: 20_000 })
    .catch(() => {});
  await page.waitForTimeout(800);
  await page
    .waitForFunction(() => document.querySelector(".tt-phone-card")?.getAttribute("data-phone-fit") === "1", {
      timeout: 8_000,
    })
    .catch(() => {});
  const kept = await page.locator(".tt-phone-card").getAttribute("data-watch-kept");
  const source = await page.locator(".tt-phone-card").getAttribute("data-watch-source");
  const info = await facts(page, card);
  const png = await page.screenshot({
    clip: { x: 0, y: 0, width: PHONE.width, height: PHONE.height },
    animations: "disabled",
  });
  return { ready, png, kept: kept ? Number(kept) : null, source: source ? Number(source) : null, facts: info };
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
      const shot = await shoot(page, card, "");
      if (card === "day") {
        if (shot.ready === "1") {
          throw new Error("Day Ahead rendered on the real path — fixture leaked (times_day_schedule should be empty)");
        }
        if (shot.facts.dayTitle) throw new Error("Lunch with Dad appeared without ?sample=1");
        console.log(`day: skipped (ready=${shot.ready}) — no schedule row; fixture not used`);
        report.push({ card, skipped: true, ready: shot.ready, dest: null });
        await page.close();
        continue;
      }
      if (shot.ready !== "1" || !shot.png) throw new Error(`${card} not ready: ${shot.ready}`);
      const size = pngSize(shot.png);
      const dest = path.join(outDir, `${ISSUE}-${card}.png`);
      await writeFile(dest, shot.png);
      const extra =
        card === "watch"
          ? ` (kept ${shot.kept} of ${shot.source}; GOTD ${shot.facts.gotd}${shot.facts.gotdPreseason === "1" ? " PRESEASON" : ""})`
          : card === "front"
            ? ` (stories=${shot.facts.stories} photo=${shot.facts.photo} art ${shot.facts.artCss}css/${shot.facts.artNatural}nat)`
            : card === "weather"
              ? ` (days=${shot.facts.wxDays} rainLegend=${shot.facts.rainLegend} creditBottom=${shot.facts.creditBottom})`
              : "";
      console.log(`${card}: ${size.width}x${size.height} → ${dest}${extra}`);
      report.push({ card, ...size, dest, kept: shot.kept, source: shot.source, ...shot.facts });
      if (size.width !== PHONE.width * PHONE_SCALE || size.height !== PHONE.height * PHONE_SCALE) {
        throw new Error(`${card} is ${size.width}x${size.height}, expected ${PHONE.width * PHONE_SCALE}x${PHONE.height * PHONE_SCALE}`);
      }
      if (card === "front") {
        if (Number(shot.facts.stories) < 4) throw new Error(`front only showed ${shot.facts.stories} stories`);
        if (shot.facts.photo !== "1") throw new Error("front is missing the lead photo");
        if (shot.facts.artCss && shot.facts.artNatural && shot.facts.artCss > shot.facts.artNatural + 1) {
          throw new Error(`lead photo CSS-upscaled ${shot.facts.artCss} > native ${shot.facts.artNatural}`);
        }
      }
      if (card === "weather") {
        if (shot.facts.creditBottom == null || shot.facts.creditBottom > PHONE.height + 1) {
          throw new Error(`weather credit clipped (bottom ${shot.facts.creditBottom})`);
        }
        if (shot.facts.wxRain === "0" && shot.facts.rainLegend) {
          throw new Error("Chance of rain legend shown with no rain series");
        }
        const headerDays = Number(shot.facts.wxDays);
        if (!(headerDays >= 1)) throw new Error("weather forecast has no days");
      }
      if (card === "watch" && shot.facts.gotdPreseason === "1") {
        throw new Error(`Game of the Day is a preseason game (${shot.facts.gotd})`);
      }
      await page.close();
    }
    const harnessPage = await context.newPage();
    const harness = await shoot(harnessPage, "day", "1");
    if (harness.ready !== "1" || !harness.png) throw new Error(`day harness not ready: ${harness.ready}`);
    if (!harness.facts.dayTitle) throw new Error("day harness missing Lunch with Dad");
    const harnessSize = pngSize(harness.png);
    const harnessDest = path.join(outDir, `${ISSUE}-day-harness.png`);
    await writeFile(harnessDest, harness.png);
    console.log(`day-harness: ${harnessSize.width}x${harnessSize.height} → ${harnessDest} (TEST HARNESS ONLY)`);
    report.push({ card: "day-harness", ...harnessSize, dest: harnessDest, harnessOnly: true });
    await harnessPage.close();

    const page = await context.newPage();
    const heavy = await shoot(page, "watch", "heavy");
    if (!heavy.png) throw new Error("heavy watch not ready");
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
    report.push({ card: "watch-heavy", ...size, dest, kept: heavy.kept, source: heavy.source, ...heavy.facts });
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
