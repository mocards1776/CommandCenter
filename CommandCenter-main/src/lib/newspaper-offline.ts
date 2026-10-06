/**
 * Times offline: service worker shell, per-user edition files, sharp images.
 *
 * iOS will not download a new edition while the Home Screen app is fully
 * closed. The best available behavior is: cache this edition now, and while
 * the Times is open or visible, watch for the next press and prefetch it.
 */

import {
  estimateStoryImageWidth,
  STORY_IMAGE_INSET_BELOW_PX,
  upgradeStoryImageUrl,
} from "./newspaper-images.ts";
import { clearLocalIssues, readLocalIssue, writeLocalIssue, type PrintedIssue } from "./newspaper-issue.ts";

export const TIMES_IMAGE_CACHE = "tt-images-v1";
export const TIMES_SHELL_CACHE = "tt-shell-v1";
export const TIMES_POLL_MS = 120_000;

const HTTP = /^https?:\/\//i;
const IMAGE_HINT =
  /\.(?:jpe?g|png|webp|gif|avif)(?:$|\?)/i.test.bind(/\.(?:jpe?g|png|webp|gif|avif)(?:$|\?)/i);
const IMAGE_HOST = /bloximages|espncdn|mlstatic|cloudinary|imagn|sportshub|gstatic|googleapis|nba\.com|nhl\.com|mlbstatic/i;

function isImageUrl(value: string): boolean {
  return HTTP.test(value) && (IMAGE_HINT(value) || IMAGE_HOST.test(value));
}

/** Only the upgraded original — never a thumbnail or a downscaled resize. */
export function isSharpOriginalUrl(raw: string | null | undefined): boolean {
  const url = (raw ?? "").trim();
  if (!url || !HTTP.test(url)) return false;
  if (/[?&](?:resize|w|width)=(\d{1,3})\b/i.test(url)) {
    const n = Number(RegExp.$1);
    if (Number.isFinite(n) && n < STORY_IMAGE_INSET_BELOW_PX) return false;
  }
  if (/\/resize\/(\d{1,3})(?:x\d+)?(?:\/|$)/i.test(url)) return false;
  const width = estimateStoryImageWidth(url);
  if (width != null && width < STORY_IMAGE_INSET_BELOW_PX) return false;
  return true;
}

export function collectEditionImageUrls(issue: PrintedIssue): string[] {
  const out = new Set<string>();
  walk(issue.stories, out, 0);
  walk(issue.queries, out, 0);
  walk(issue.companions ?? null, out, 0);
  return [...out];
}

function walk(value: unknown, out: Set<string>, depth: number) {
  if (value == null || depth > 8) return;
  if (typeof value === "string") {
    if (!isImageUrl(value)) return;
    const upgraded = upgradeStoryImageUrl(value) ?? value;
    if (isSharpOriginalUrl(upgraded)) out.add(upgraded);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walk(item, out, depth + 1);
    return;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) walk(item, out, depth + 1);
  }
}

export async function registerTimesWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

export async function cacheTimesShell(urls: string[]): Promise<void> {
  if (typeof caches === "undefined" || !urls.length) return;
  const cache = await caches.open(TIMES_SHELL_CACHE);
  await Promise.all(
    urls.map(async (url) => {
      try {
        const hit = await cache.match(url);
        if (hit) return;
        await cache.add(url);
      } catch {
        /* a missing hashed file must not block the paper */
      }
    }),
  );
}

export async function prefetchEditionImages(urls: string[]): Promise<void> {
  if (typeof caches === "undefined") return;
  const sharp = [...new Set(urls.map((url) => upgradeStoryImageUrl(url) ?? url).filter(isSharpOriginalUrl))];
  if (!sharp.length) return;
  const cache = await caches.open(TIMES_IMAGE_CACHE);
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return;
  await Promise.all(
    sharp.map(async (url) => {
      try {
        if (await cache.match(url)) return;
        const res = await fetch(url, { mode: "no-cors", credentials: "omit" });
        /* opaque no-cors still occupies the cache so the next open is warm */
        await cache.put(url, res);
      } catch {
        /* first paint already has the <img>; a miss retries on the next open */
      }
    }),
  );
}

export function timesShellUrlsFromPerformance(): string[] {
  if (typeof performance === "undefined") return [];
  const origin = typeof location === "undefined" ? "" : location.origin;
  return performance
    .getEntriesByType("resource")
    .flatMap((entry) => {
      const url = entry.name;
      if (!url) return [];
      try {
        const parsed = new URL(url);
        const font = /fonts\.(?:googleapis|gstatic)\.com$/i.test(parsed.hostname);
        const local =
          parsed.origin === origin &&
          (/\.(?:js|css|woff2?)$/i.test(parsed.pathname) ||
            parsed.pathname === "/times-precache.json" ||
            parsed.pathname === "/times.html" ||
            parsed.pathname.startsWith("/newspaper"));
        return font || local ? [url] : [];
      } catch {
        return [];
      }
    });
}

export async function clearTimesOffline(userId?: string | null): Promise<void> {
  await clearLocalIssues(userId ?? null);
  if (typeof caches === "undefined") return;
  try {
    await caches.delete(TIMES_IMAGE_CACHE);
  } catch {
    /* private mode */
  }
}

/** Download one edition (stories, desks, sharp art) into this user's cache. */
export async function prefetchFiledEdition(id: string, userId: string | null): Promise<PrintedIssue | null> {
  const local = await readLocalIssue(id, userId);
  if (local) {
    void prefetchEditionImages(collectEditionImageUrls(local));
    return local;
  }
  const { readRemoteIssueShell, readRemoteQueries } = await import("./newspaper-issue-remote.ts");
  const shell = await readRemoteIssueShell(id).catch(() => null);
  if (!shell) return null;
  const queries = await readRemoteQueries(id).catch(() => null);
  const issue: PrintedIssue = { ...shell, queries: queries ?? [] };
  await writeLocalIssue(issue, userId);
  void prefetchEditionImages(collectEditionImageUrls(issue));
  return issue;
}

export async function postTimesPrecache(urls: string[]): Promise<void> {
  const worker = typeof navigator !== "undefined" ? navigator.serviceWorker?.controller : null;
  if (!worker || !urls.length) return;
  worker.postMessage({ type: "tt-precache", urls });
}
