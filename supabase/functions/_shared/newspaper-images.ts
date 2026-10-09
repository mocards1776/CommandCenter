/**
 * Story-art URLs for the Thompson Times.
 *
 * TownNews/BLOX (stltoday and other Lee papers) and most wire CDNs ship a
 * thumbnail with resize=/w=/srcset hints. The paper upgrades that to the
 * large original, then picks the widest candidate from RSS media tags.
 */

export const STORY_IMAGE_TARGET_PX = 1600;
export const STORY_IMAGE_INSET_BELOW_PX = 800;

/** 2× the 80px coach portrait. Matches ESPN's headshot combiner ratio. */
const ESPN_HEADSHOT_W = 160;
const ESPN_HEADSHOT_H = 116;
/**
 * 2× the 64px `.wsj-logo.xl` crest (A1's largest standard logo).
 * Watch and phone crests are 48px. The 148px coach tile is softer than 2×.
 */
const ESPN_LOGO_PX = 128;

const ESPN_HEADSHOT_PATH = /^\/i\/headshots\/[^/]+\/players\/full\/\d+\.png$/i;
const ESPN_LOGO_PATH = /^\/i\/teamlogos\/.+\.png$/i;

export type StoryImageCandidate = {
  url: string;
  width?: number | null;
};

const HTTP = /^https?:\/\//i;

function trimUrl(raw: string | null | undefined): string | null {
  const url = (raw ?? "").trim();
  return url && HTTP.test(url) ? url : null;
}

function isBloxHost(host: string): boolean {
  return /bloximages|townnews|tncms|lee\.net|stltoday/i.test(host);
}

function decodeOnce(url: string): string {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}

/** Stored feed URLs sometimes keep a literal `&amp;` in the query. */
function decodeAmp(url: string): string {
  return url.replace(/&amp;/gi, "&");
}

function espnHost(hostname: string): boolean {
  return /(?:^|\.)a\.espncdn\.com$/i.test(hostname);
}

/** Combiner URL for an ESPN headshot or team logo, or null when it is neither. */
function canonicalEspnThumb(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (!espnHost(parsed.hostname)) return null;
  let path = parsed.pathname;
  if (path === "/combiner/i") {
    const img = parsed.searchParams.get("img") ?? "";
    if (!img.startsWith("/")) return null;
    path = img;
  }
  const head = ESPN_HEADSHOT_PATH.test(path);
  const logo = !head && ESPN_LOGO_PATH.test(path);
  if (!head && !logo) return null;
  const w = head ? ESPN_HEADSHOT_W : ESPN_LOGO_PX;
  const h = head ? ESPN_HEADSHOT_H : ESPN_LOGO_PX;
  return `https://a.espncdn.com/combiner/i?img=${path}&w=${w}&h=${h}`;
}

/** ESPN combiner thumb of a headshot (`/players/full/`) or team logo. Any w/h. */
export function isEspnThumbUrl(raw: string | null | undefined): boolean {
  const url = (raw ?? "").trim();
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (!espnHost(parsed.hostname) || parsed.pathname !== "/combiner/i") return false;
    const img = parsed.searchParams.get("img") ?? "";
    return ESPN_HEADSHOT_PATH.test(img) || ESPN_LOGO_PATH.test(img);
  } catch {
    return false;
  }
}

/** Same string when it is not an ESPN headshot or logo. */
export function espnThumbUrl(raw: string | null | undefined): string | null {
  const url = trimUrl(raw);
  if (!url) return null;
  return canonicalEspnThumb(url) ?? url;
}

function parseResizeWidth(value: string | null | undefined): number | null {
  if (!value) return null;
  const first = decodeOnce(value).split(/[x,]/i)[0]?.trim() ?? "";
  const n = Number(first);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Width hinted on the URL itself (query, path /resize/, Cloudinary w_). */
export function estimateStoryImageWidth(raw: string | null | undefined): number | null {
  const url = trimUrl(raw);
  if (!url) return null;
  const decoded = decodeOnce(url);
  const query = decoded.match(/[?&](?:resize|w|width)=([^&]+)/i);
  if (query) {
    const w = parseResizeWidth(query[1]);
    if (w) return w;
  }
  const pathResize = decoded.match(/\/resize\/(\d{1,5})(?:x\d{1,5})?(?:\/|$)/i);
  if (pathResize) {
    const w = Number(pathResize[1]);
    if (Number.isFinite(w) && w > 0) return w;
  }
  const cloud = decoded.match(/(?:^|[,/])w_(\d+)(?=,|\/|$)/i);
  if (cloud) {
    const w = Number(cloud[1]);
    if (Number.isFinite(w) && w > 0) return w;
  }
  return null;
}

/**
 * Rewrite a thumbnail URL to the large original.
 * BLOX: drop resize=/w= and turn `.preview` into `.image`.
 * Other CDNs: bump a small w=/width= (or Cloudinary w_16) to 1600.
 */
export function upgradeStoryImageUrl(raw: string | null | undefined): string | null {
  const src = trimUrl(raw);
  if (!src) return null;
  let url = decodeAmp(decodeOnce(src));
  const espn = canonicalEspnThumb(url);
  if (espn) return espn;

  url = url.replace(/\.preview(\.(?:jpe?g|png|webp|gif))(?=[?#]|$)/i, ".image$1");
  url = url.replace(/\/preview(\.(?:jpe?g|png|webp|gif))(?=[?#]|$)/i, "/image$1");
  url = url.replace(/\/resize\/\d{1,5}(?:x\d{1,5})?(?=\/|$)/gi, "");

  url = url.replace(/(^|[,/])w_(\d+)(?=,|\/|$)/g, (full, pre: string, n: string) => {
    const width = Number(n);
    if (Number.isFinite(width) && width > 0 && width < 200) return `${pre}w_${STORY_IMAGE_TARGET_PX}`;
    return full;
  });

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  const blox = isBloxHost(parsed.hostname) || /bloximages|tncms/i.test(parsed.pathname);
  const params = parsed.searchParams;
  if (params.has("resize")) {
    const w = parseResizeWidth(params.get("resize"));
    if (w == null || w < STORY_IMAGE_TARGET_PX) {
      if (blox || (w != null && w < STORY_IMAGE_INSET_BELOW_PX)) params.delete("resize");
      else params.set("resize", String(STORY_IMAGE_TARGET_PX));
    }
  }
  for (const key of ["w", "width"]) {
    if (!params.has(key)) continue;
    const n = Number(params.get(key));
    if (!Number.isFinite(n) || n <= 0 || n >= STORY_IMAGE_TARGET_PX) continue;
    if (blox) params.delete(key);
    else params.set(key, String(STORY_IMAGE_TARGET_PX));
  }
  if (blox) {
    for (const key of ["h", "height"]) {
      if (params.has(key) && !params.has("w") && !params.has("width") && !params.has("resize")) {
        params.delete(key);
      }
    }
  }

  return parsed.toString();
}

const espnThumbCache = new WeakMap<object, unknown>();

/** Replace ESPN headshot and logo URLs anywhere in printed or live desk data. */
export function rewriteEspnThumbs<T>(value: T): T {
  if (typeof value === "string") return (canonicalEspnThumb(value) ?? value) as T;
  if (value == null || typeof value !== "object") return value;
  const hit = espnThumbCache.get(value);
  if (hit !== undefined) return hit as T;
  const next = walkEspnThumbs(value);
  espnThumbCache.set(value, next);
  return next as T;
}

function walkEspnThumbs(value: unknown): unknown {
  if (typeof value === "string") {
    const next = canonicalEspnThumb(value);
    return next && next !== value ? next : value;
  }
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((item) => {
      const next = walkEspnThumbs(item);
      if (next !== item) changed = true;
      return next;
    });
    return changed ? out : value;
  }
  if (!value || typeof value !== "object") return value;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;
  let changed = false;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    const next = walkEspnThumbs(item);
    if (next !== item) changed = true;
    out[key] = next;
  }
  return changed ? out : value;
}

/**
 * Try the upgraded URL first, then the stored URL (with `&amp;` decoded).
 * BLOX tries the stored `.preview` (or a filed `.image`'s `.preview` twin)
 * first, then the `.image`.
 */
export function storyImageCandidates(raw: string | null | undefined): { src: string; fallback: string | null } {
  const stored = decodeAmp((raw ?? "").trim());
  if (!stored || !HTTP.test(stored)) return { src: stored, fallback: null };
  let host = "";
  try {
    host = new URL(stored).hostname;
  } catch {
    host = "";
  }
  const upgraded = upgradeStoryImageUrl(stored) ?? stored;
  if (isBloxHost(host) || /bloximages|tncms/i.test(stored)) {
    // BLOX `.image` can 404 (stltoday) while `.preview` loads: preview first.
    const preview = stored.replace(/\.image(\.(?:jpe?g|png|webp|gif))(?=[?#]|$)/i, ".preview$1");
    if (preview !== stored) return { src: preview, fallback: stored };
    return { src: stored, fallback: upgraded !== stored ? upgraded : null };
  }
  if (upgraded !== stored) return { src: upgraded, fallback: stored };
  return { src: stored, fallback: null };
}

export function isNarrowStoryImage(
  raw: string | null | undefined,
  minWidth = STORY_IMAGE_INSET_BELOW_PX,
): boolean {
  const w = estimateStoryImageWidth(raw);
  return w != null && w < minWidth;
}

export function srcsetCandidates(srcset: string | null | undefined): StoryImageCandidate[] {
  if (!srcset) return [];
  const out: StoryImageCandidate[] = [];
  for (const part of srcset.split(",")) {
    const bits = part.trim().split(/\s+/);
    const url = bits[0];
    if (!url) continue;
    const wMark = bits.find((b) => /^\d+w$/i.test(b));
    const dens = bits.find((b) => /^\d+(?:\.\d+)?x$/i.test(b));
    const stated = wMark
      ? Number(wMark.replace(/\D/g, ""))
      : dens
        ? Math.round(Number(dens.replace(/x$/i, "")) * 1000)
        : estimateStoryImageWidth(url);
    out.push({ url, width: stated && Number.isFinite(stated) ? stated : null });
  }
  return out;
}

/**
 * Prefer the widest media:content / enclosure / srcset candidate, then upgrade
 * that URL. A candidate with no stated width is treated as a large original.
 */
export function pickBestStoryImage(
  candidates: Array<string | null | undefined | StoryImageCandidate>,
): string | null {
  const seen = new Set<string>();
  const rows: { upgraded: string; width: number }[] = [];
  for (const c of candidates) {
    const raw = typeof c === "string" || c == null ? c : c.url;
    const url = trimUrl(raw ?? null);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const upgraded = upgradeStoryImageUrl(url) ?? url;
    const stated = typeof c === "object" && c ? c.width : null;
    const fromUrl = estimateStoryImageWidth(url);
    const width =
      stated && stated > 0 ? stated : fromUrl && fromUrl > 0 ? fromUrl : STORY_IMAGE_TARGET_PX;
    rows.push({ upgraded, width });
  }
  if (!rows.length) return null;
  rows.sort((a, b) => b.width - a.width);
  return rows[0]!.upgraded;
}
