/**
 * Print one Thompson Times edition into flat page images.
 *
 * WebKit, iPad Pro 13" (1032x1376 CSS, devicePixelRatio 2), the same
 * --tt-page-w 1032 width-only sheet as scripts/times-shots.mjs. Every folio
 * is captured at full height after its images and fonts have loaded.
 * Nothing is sent to Telegram and the press is not run.
 *
 *   node scripts/times-shots.mjs --flat --issue 2026-10-07-evening
 *   node scripts/times-flat-print.mjs --issue 2026-10-07-evening
 *   node scripts/times-flat-print.mjs --issue 2026-10-07-evening --publish 2026-10-07-evening-test
 *
 * Auth for a person at the machine: TIMES_SESSION_FILE (default
 * /tmp/tt-measure/session.json) plus TIMES_LAYOUT_FILE, or TIMES_SESSION_JSON.
 * The GitHub Actions job does not use a session secret. It asks
 * times-telegram-shots for a short-lived session (action "session") with the
 * same GitHub OIDC token the Telegram shots already use.
 * Supabase URL and the publishable key come from TIMES_SUPABASE_FILE, the
 * environment, or /tmp/tt-measure/vite.env. TIMES_APP_ORIGIN defaults to production.
 *
 * A sheet is not shot until it has content, its height has held for more than
 * one frame, its images have decoded, and fonts are ready. A short or mostly
 * blank shot is retried. A sheet that still fails a fit check is salvaged
 * (see planSheet) and its pages are published marked degraded. A missing,
 * short, or blank sheet, or any publishVerdict guard, withholds the edition.
 * Nothing is uploaded until every page has passed, so a withheld print leaves
 * the edition's previous manifest and images as they were.
 *
 * Page images are addressed on the app origin (/times-flat/...) so Vercel's
 * CDN caches them. Storage objects use a year-long immutable cache header.
 * The manifest itself stays a small JSON object on Supabase.
 *
 * Images go to the public times-flat bucket. Editions older than 7 calendar
 * days (America/Chicago) are deleted at the end of the run.
 */
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const APP = (process.env.TIMES_APP_ORIGIN || "https://command-center-flax-gamma.vercel.app").replace(/\/$/, "");
const IPAD13 = { width: 1032, height: 1376 };
const PAGE_W = 1032;
const DPR = 2;
/** Every printed page is one iPad Pro 13" portrait screen. */
const PAGE_CSS_H = 1376;
export const PAGE_DEV_W = PAGE_W * DPR;
export const PAGE_DEV_H = PAGE_CSS_H * DPR;
const PAPER = [251, 250, 246, 255];
const BUCKET = "times-flat";
const RETENTION_DAYS = 7;
/** Header-only shells from this press land around 200 CSS px. Real inside pages start above this. */
export const MIN_CSS_HEIGHT = 480;
/** Share of sampled pixels that are near-white or clear. Above this, the page is blank. */
export const MAX_BLANK_RATIO = 0.9;
/** A page this blank inside its painted rows has nothing on it. */
export const EMPTY_PAGE_RATIO = 0.995;
/** Below this scale copy is unreadable. Salvage hard-breaks instead, and the gate refuses it. */
export const MIN_FIT = 0.5;
/** A page with less body than this is near-empty: dropped if it has no ink, else joined to a neighbour. */
export const NEAR_EMPTY_CSS = 64;
/** Salvage only carries a block to the next page when this page keeps at least this much. */
const MOVE_MIN_CSS = PAGE_CSS_H / 4;
/** More degraded pages than this share withholds the edition. */
export const MAX_DEGRADED_SHARE = 1 / 3;
/** A1 is also the Telegram front. A shrink or merge there must keep this much size. */
export const A1_MIN_FIT = 0.9;
/** A 2064×2752 lossless page with any copy is far above this. Blank paper encodes to ~300 bytes. */
export const MIN_WEBP_BYTES = 4_000;
const PAGE_TRIES = 3;
const SHEET_WAIT_MS = 18_000;
const IMAGE_CACHE = "public, max-age=31536000, immutable";
const MANIFEST_CACHE = "public, max-age=60";
const SESSION_FILE = process.env.TIMES_SESSION_FILE || "/tmp/tt-measure/session.json";
const LAYOUT_FILE = process.env.TIMES_LAYOUT_FILE || "/tmp/tt-measure/layout.json";

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

function log(...parts) {
  console.log(`[times-flat ${new Date().toISOString()}]`, ...parts);
}

function chicagoToday(now = new Date()) {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

function addDays(iso, delta) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function editionDate(issueId) {
  const match = /^(\d{4}-\d{2}-\d{2})-(morning|midday|evening)$/.exec(issueId);
  return match ? match[1] : null;
}

function pressIdAt(now) {
  const day = now.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const hour =
    Number(
      new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hourCycle: "h23" })
        .formatToParts(now)
        .find((p) => p.type === "hour")?.value,
    ) % 24;
  if (hour >= 17) return `${day}-evening`;
  if (hour >= 12) return `${day}-midday`;
  if (hour >= 6) return `${day}-morning`;
  const prev = addDays(day, -1);
  return `${prev}-evening`;
}

function instantFor(issueId) {
  const match = /^(\d{4})-(\d{2})-(\d{2})-(morning|midday|evening)$/.exec(issueId);
  if (!match) return null;
  const hour = { morning: 7, midday: 13, evening: 18 }[match[4]];
  for (const offset of [5, 6]) {
    const t = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), hour + offset));
    if (pressIdAt(t) === issueId) return t;
  }
  return null;
}

async function readEnvFile(file) {
  try {
    const text = await readFile(file, "utf8");
    const out = {};
    for (const line of text.split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m) out[m[1]] = m[2];
    }
    return out;
  } catch {
    return {};
  }
}

async function supabaseConfig() {
  if (process.env.TIMES_SUPABASE_FILE) {
    try {
      const parsed = JSON.parse(await readFile(process.env.TIMES_SUPABASE_FILE, "utf8"));
      const url = String(parsed.url || "").replace(/\/$/, "");
      const key = String(parsed.key || "");
      if (url && key) return { url, key };
    } catch {
      /* fall through to the env file */
    }
  }
  const file = await readEnvFile("/tmp/tt-measure/vite.env");
  const url = (process.env.TIMES_SUPABASE_URL || process.env.VITE_SUPABASE_URL || file.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.TIMES_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || file.VITE_SUPABASE_ANON_KEY || "";
  if (!url || !key) throw new Error("Missing Supabase URL or publishable key");
  return { url, key };
}

/** Lossless WebP (VP8L) width and height. Returns null for any other container. */
export function webpSize(buf) {
  if (!buf || buf.length < 25) return null;
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  if (buf.toString("ascii", 12, 16) !== "VP8L") return null;
  if (buf[20] !== 0x2f) return null;
  const b0 = buf[21];
  const b1 = buf[22];
  const b2 = buf[23];
  const b3 = buf[24];
  const width = 1 + (((b1 & 0x3f) << 8) | b0);
  const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
  if (width < 2 || height < 2) return null;
  return { width, height };
}

/**
 * Screenshot clip in CSS pixels. A folio that is still parked to the right of
 * the pager has its full height and almost no width — that is off-screen, not
 * a short capture.
 */
export function clipSize(geom) {
  const x = Math.max(0, Number(geom?.x) || 0);
  const y = Math.max(0, Number(geom?.y) || 0);
  const width = Math.min(Number(geom?.w) || 0, (Number(geom?.viewW) || 0) - x);
  const height = Math.min(Number(geom?.h) || 0, (Number(geom?.viewH) || 0) - y);
  return { x, y, width, height };
}

/** The full sheet, before it is split. A short capture or a stub never publishes. */
export function judgeSheet(sheet) {
  const content = Number(sheet?.contentHeight) || 0;
  const captured = Number(sheet?.capturedHeight) || 0;
  const blankRatio = Number(sheet?.blankRatio);
  if (content < MIN_CSS_HEIGHT) return { ok: false, reason: `short ${Math.round(content)}` };
  if (captured + 2 < content) return { ok: false, reason: `clipped ${Math.round(captured)}<${Math.round(content)}` };
  if (sheet?.pastBottom) return { ok: false, reason: "element past bottom" };
  if (sheet?.pastRight) return { ok: false, reason: "element past right" };
  if (Number.isFinite(blankRatio) && blankRatio > MAX_BLANK_RATIO) {
    return { ok: false, reason: `blank ${blankRatio.toFixed(2)}` };
  }
  if (sheet?.seam) return { ok: false, reason: `seam y ${sheet.seam.y}` };
  return { ok: true, reason: "ok" };
}

/** One output page: exactly one screen, seam-free, content inside the page. */
export function judgePage(page) {
  const blankRatio = Number(page?.blankRatio);
  if (page?.width !== PAGE_DEV_W || page?.height !== PAGE_DEV_H) {
    return { ok: false, reason: `size ${page?.width || 0}x${page?.height || 0}` };
  }
  if (page?.pastEdge) return { ok: false, reason: "past edge" };
  if (Number.isFinite(blankRatio) && blankRatio > MAX_BLANK_RATIO) {
    return { ok: false, reason: `blank ${blankRatio.toFixed(2)}` };
  }
  if (page?.seam) return { ok: false, reason: `seam y ${page.seam.y}` };
  return { ok: true, reason: "ok" };
}

function sliceSpan(slices) {
  return slices.reduce((sum, slice) => sum + (slice.srcBottom - slice.srcTop), 0);
}

/** A cut this close to a glyph edge is the leading, not the letter. */
const CUT_SLACK = 1.5;

function interiorHit(atoms, cut) {
  return atoms.some((atom) => atom.top < cut - CUT_SLACK && atom.bottom > cut + CUT_SLACK);
}

/**
 * Latest y in (start, limit] that does not pass through an atom.
 * One atom that spans the whole budget must not hide a gap between the others
 * (a two-column lead, or the hero sitting above a story).
 */
function bestCut(atoms, start, limit) {
  const candidates = [];
  for (const atom of atoms) {
    if (atom.bottom <= start + 0.5 || atom.top >= limit - 0.5) continue;
    if (atom.top > start + 8 && atom.top <= limit + 0.5) candidates.push(atom.top);
    if (atom.bottom > start + 8 && atom.bottom <= limit + 0.5) candidates.push(atom.bottom);
  }
  candidates.sort((a, b) => b - a);
  for (const cut of candidates) {
    if (!interiorHit(atoms, cut)) return cut;
  }
  return columnGap(atoms, start, limit);
}

/**
 * Two columns stagger their line boxes, so a full-width edge of one column
 * lands inside the other. A row both columns leave empty is still a clean cut.
 */
function columnGap(atoms, start, limit) {
  const placed = atoms.filter(
    (atom) => Number.isFinite(atom.left) && Number.isFinite(atom.right) && atom.right - atom.left > 1,
  );
  if (placed.length < 4) return null;
  const centers = placed.map((atom) => (atom.left + atom.right) / 2).sort((a, b) => a - b);
  const mid = centers[Math.floor(centers.length / 2)];
  const spansBoth = (atom) => atom.left < mid - 8 && atom.right > mid + 8;
  const wide = placed.filter(spansBoth);
  const lefts = placed.filter((atom) => !spansBoth(atom) && (atom.left + atom.right) / 2 < mid - 8);
  const rights = placed.filter((atom) => !spansBoth(atom) && (atom.left + atom.right) / 2 > mid + 8);
  if (lefts.length < 2 || rights.length < 2) return null;
  const clear = (y) =>
    !interiorHit(wide, y) &&
    !lefts.some((atom) => atom.top < y - CUT_SLACK && atom.bottom > y + CUT_SLACK) &&
    !rights.some((atom) => atom.top < y - CUT_SLACK && atom.bottom > y + CUT_SLACK);
  const edges = [];
  for (const atom of placed) {
    if (atom.bottom > start + 8 && atom.bottom <= limit + 0.5) edges.push(atom.bottom);
    if (atom.top > start + 8 && atom.top <= limit + 0.5) edges.push(atom.top);
  }
  edges.sort((a, b) => b - a);
  for (const y of edges) {
    if (clear(y)) return y;
  }
  // No shared gap. The nearest clean row above the block that crosses the
  // limit, so the page ends on whitespace instead of failing the book.
  const crossing = placed.filter((atom) => atom.top < limit && atom.bottom > limit - 0.5);
  const tops = crossing.map((atom) => atom.top).filter((top) => top > start + 8 && top <= limit + 0.5);
  tops.sort((a, b) => b - a);
  for (const y of tops) {
    if (clear(y)) return y;
  }
  return null;
}

function blockingAtoms(pieces, pageH) {
  const atoms = [];
  for (const piece of pieces) {
    const tall = piece.bottom - piece.top > pageH + 0.5;
    if (tall && piece.atoms?.length) {
      if (piece.header) atoms.push(piece.header);
      for (const atom of piece.atoms) atoms.push(atom);
    } else {
      atoms.push({ top: piece.top, bottom: piece.bottom });
    }
  }
  return atoms;
}

function headerAt(pieces, y) {
  for (const piece of pieces) {
    const header = piece.header;
    if (!header) continue;
    if (y >= header.bottom - 0.5 && y < piece.bottom - 0.5) return header;
  }
  return null;
}

function rangeCovered(pages, top, bottom) {
  let y = top;
  const slices = pages
    .flatMap((page) => page.slices)
    .sort((a, b) => a.srcTop - b.srcTop || a.srcBottom - b.srcBottom);
  for (const slice of slices) {
    if (slice.srcBottom <= y + 0.5) continue;
    if (slice.srcTop > y + 1) continue;
    y = Math.max(y, slice.srcBottom);
    if (y >= bottom - 0.5) return true;
  }
  return y >= bottom - 0.5;
}

/**
 * Split a sheet into page-height bands. Breaks fall in the gap between
 * pieces, or — when one piece is taller than a page — between its table
 * rows or text lines. A continuation of a table repeats the header.
 */
export function layoutSheet(contentH, pieces, pageH = PAGE_CSS_H) {
  const height = Number(contentH) || 0;
  const list = Array.isArray(pieces) ? pieces.filter((piece) => piece.bottom - piece.top > 0.5) : [];
  if (height < 1) return { ok: false, reason: "empty", pages: [] };
  if (height <= pageH + 0.5) {
    return { ok: true, pages: [{ slices: [{ srcTop: 0, srcBottom: height }] }] };
  }
  const atoms = blockingAtoms(list, pageH);
  const pages = [];
  let y = 0;
  let guard = 0;
  while (y < height - 0.5) {
    if (++guard > 80) return { ok: false, reason: "page loop", pages };
    const header = headerAt(list, y);
    const headerH = header ? header.bottom - header.top : 0;
    const budget = pageH - headerH;
    if (budget < 16) return { ok: false, reason: "header leaves no room", pages };
    if (height <= y + budget + 0.5) {
      const slices = [];
      if (header) slices.push({ srcTop: header.top, srcBottom: header.bottom, header: true });
      slices.push({ srcTop: y, srcBottom: height });
      if (sliceSpan(slices) > pageH + 0.5) return { ok: false, reason: "past edge", pages };
      pages.push({ slices });
      break;
    }
    const cut = bestCut(atoms, y, y + budget);
    if (cut == null || cut <= y + 4) {
      const piece = crossingPiece(list, y, y + budget);
      const sel = piece?.sel ? ` ${piece.sel}` : "";
      return { ok: false, reason: `unsplittable at ${Math.round(y)}${sel}`, pages, y };
    }
    const slices = [];
    if (header) slices.push({ srcTop: header.top, srcBottom: header.bottom, header: true });
    slices.push({ srcTop: y, srcBottom: cut });
    if (sliceSpan(slices) > pageH + 0.5) return { ok: false, reason: "past edge", pages };
    pages.push({ slices });
    y = cut;
  }
  for (const piece of list) {
    const targets =
      piece.bottom - piece.top > pageH + 0.5 && piece.atoms?.length
        ? piece.atoms
        : [{ top: piece.top, bottom: piece.bottom }];
    for (const atom of targets) {
      if (!rangeCovered(pages, atom.top, atom.bottom)) {
        return { ok: false, reason: `gap at ${Math.round(atom.top)}`, pages };
      }
    }
  }
  return { ok: true, pages };
}

function crossingPiece(pieces, y, limit) {
  return (
    pieces.find((item) => item.top < limit && item.bottom > limit - 0.5) ||
    pieces.find((item) => item.bottom > y + 8 && item.top < limit) ||
    null
  );
}

/**
 * Last resort after layoutSheet fails (unsplittable, past edge, gap, page
 * loop, or a table header taller than a page). Rows are never dropped:
 * (a) end this page at the top of the block that crosses the limit and start
 *     that block on the next page, when this page keeps at least a quarter;
 * (b) if that block alone is taller than a page, scale it uniformly into
 *     1032×1376 (fit on the slice; the bitmap stays 2064×2752), never below MIN_FIT;
 * (c) otherwise hard-break one page at 1376 and continue from there.
 * A header too tall to repeat is left off its continuation (no-header).
 * Every fallback page is degraded, with the layout reason and the fallback used.
 */
export function salvageSheet(contentH, pieces, pageH = PAGE_CSS_H) {
  const first = layoutSheet(contentH, pieces, pageH);
  if (first.ok) return first;
  const height = Number(contentH) || 0;
  const list = Array.isArray(pieces) ? pieces.filter((piece) => piece.bottom - piece.top > 0.5) : [];
  const pages = Number.isFinite(first.y) ? [...first.pages] : [];
  let y = Number.isFinite(first.y) ? first.y : 0;
  const atoms = blockingAtoms(list, pageH);
  // Every step advances more than 4 CSS px.
  const guardMax = Math.max(80, Math.ceil(height / 4) + 2);
  let guard = 0;
  // A block already hard-broken keeps breaking; its tail is not scaled.
  let broken = null;
  while (y < height - 0.5) {
    if (++guard > guardMax) return { ok: false, reason: "page loop", pages };
    let header = headerAt(list, y);
    let note = null;
    if (header && pageH - (header.bottom - header.top) < 16) {
      note = { degraded: true, fallback: "no-header", reason: `header leaves no room at ${Math.round(y)}` };
      header = null;
    }
    const budget = pageH - (header ? header.bottom - header.top : 0);
    const head = header ? [{ srcTop: header.top, srcBottom: header.bottom, header: true }] : [];
    if (height <= y + budget + 0.5) {
      pages.push({ slices: [...head, { srcTop: y, srcBottom: height }], ...note });
      y = height;
      break;
    }
    const cut = bestCut(atoms, y, y + budget);
    if (cut != null && cut > y + 4) {
      pages.push({ slices: [...head, { srcTop: y, srcBottom: cut }], ...note });
      y = cut;
      continue;
    }
    const limit = y + budget;
    const piece = crossingPiece(list, y, limit);
    const movable = list
      .filter((item) => item.top >= y + MOVE_MIN_CSS && item.top <= limit + 0.5 && item.bottom > limit - 0.5)
      .sort((a, b) => a.top - b.top)[0];
    const marked = movable || piece;
    const selector = marked?.sel || "";
    const reason = `unsplittable at ${Math.round(y)}${selector ? ` ${selector}` : ""}`;
    if (movable) {
      pages.push({
        slices: [...head, { srcTop: y, srcBottom: movable.top }],
        degraded: true,
        fallback: "move",
        reason,
        selector,
      });
      y = movable.top;
      continue;
    }
    if (piece) {
      const to = Math.min(height, piece.bottom);
      const span = to - y;
      const fit = pageH / span;
      if (span > pageH + 0.5 && fit >= MIN_FIT && piece !== broken) {
        pages.push({
          slices: [{ srcTop: y, srcBottom: to, fit }],
          degraded: true,
          fallback: "scale",
          reason,
          selector,
          fit,
        });
        y = to;
        continue;
      }
    }
    const cropBottom = Math.min(height, y + pageH);
    pages.push({
      slices: [{ srcTop: y, srcBottom: cropBottom }],
      degraded: true,
      fallback: "crop",
      reason,
      selector,
    });
    if (cropBottom <= y + 0.5) return { ok: false, reason, pages };
    broken = piece;
    y = cropBottom;
  }
  return { ok: y >= height - 0.5, pages, degraded: pages.some((page) => page.degraded) };
}

/** Scale a page is painted at. 1 unless salvage or a merge fitted it. */
export function pageFit(page) {
  const fit = Number(page?.fit) || Number(page?.slices?.find((slice) => Number(slice.fit) > 0)?.fit) || 1;
  return Math.min(1, fit);
}

function bodySpan(page) {
  return sliceSpan(page.slices.filter((slice) => !slice.header));
}

function degrade(page, fallback, reason) {
  const fallbacks = page.degraded && page.fallback ? page.fallback.split("+") : [];
  if (!fallbacks.includes(fallback)) fallbacks.push(fallback);
  const reasons = page.degraded && page.reason ? [page.reason] : [];
  if (reason && !reasons.includes(reason)) reasons.push(reason);
  return { ...page, degraded: true, fallback: fallbacks.join("+"), reason: reasons.join("; ") };
}

function joinSlices(slices) {
  const out = [];
  for (const slice of slices) {
    const { fit: _fit, ...plain } = slice;
    const prev = out.at(-1);
    if (prev && !prev.header && !plain.header && Math.abs(prev.srcBottom - plain.srcTop) <= 0.5) {
      prev.srcBottom = plain.srcBottom;
    } else {
      out.push(plain);
    }
  }
  return out;
}

/** The near-empty page's body joined onto a neighbour, fitted when the sum is over a page. */
function joinPages(target, tiny, tinyFirst, pageH) {
  const body = tiny.slices.filter((slice) => !slice.header);
  const slices = tinyFirst
    ? joinSlices([...tiny.slices, ...target.slices.filter((slice) => !slice.header)])
    : joinSlices([...target.slices, ...body]);
  const span = sliceSpan(slices);
  const fit = span > pageH + 0.5 ? pageH / span : 1;
  if (fit < MIN_FIT) return null;
  let page = { ...target, slices: fit < 1 ? slices.map((slice) => ({ ...slice, fit })) : slices };
  delete page.fit;
  if (fit < 1) page.fit = fit;
  if (tiny.degraded) page = degrade(page, tiny.fallback, tiny.reason);
  if (fit < 1) page = degrade(page, "merge", `near-empty ${Math.round(sliceSpan(body))}px page merged`);
  return { page, fit };
}

/**
 * A page with less than NEAR_EMPTY_CSS of body joins the page before or after
 * it. Joining without a fit wins; otherwise the larger fit, never below MIN_FIT.
 * A page that cannot join stays, and planSheet refuses the sheet.
 */
export function mergeNearEmpty(pages, pageH = PAGE_CSS_H) {
  const out = pages.map((page) => ({ ...page, slices: page.slices.map((slice) => ({ ...slice })) }));
  let i = 0;
  while (i < out.length && out.length > 1) {
    const tiny = out[i];
    if (bodySpan(tiny) >= NEAR_EMPTY_CSS) {
      i += 1;
      continue;
    }
    const intoPrev = i > 0 ? joinPages(out[i - 1], tiny, false, pageH) : null;
    const intoNext = i + 1 < out.length ? joinPages(out[i + 1], tiny, true, pageH) : null;
    const pick = [intoPrev, intoNext].filter(Boolean).sort((a, b) => b.fit - a.fit)[0];
    if (!pick) {
      i += 1;
      continue;
    }
    if (pick === intoPrev) {
      out.splice(i - 1, 2, pick.page);
    } else {
      out.splice(i, 2, pick.page);
    }
  }
  return out;
}

function clipPieces(pieces, limit) {
  const clamp = (box) => ({ ...box, bottom: Math.min(box.bottom, limit) });
  return (Array.isArray(pieces) ? pieces : [])
    .filter((piece) => piece.top < limit - 0.5)
    .map((piece) => ({
      ...clamp(piece),
      header: piece.header && piece.header.bottom <= limit ? piece.header : null,
      atoms: (piece.atoms || []).filter((atom) => atom.top < limit - 0.5).map(clamp),
    }));
}

/** True when every sampled pixel in these sheet rows matches the first one: bare paper, nothing lost if dropped. */
function inklessRows(shot, slices) {
  const { buffer, width, height, scale } = shot;
  if (!buffer || !(width > 0) || !(scale > 0)) return false;
  let ref = null;
  for (const slice of slices) {
    const top = Math.max(0, Math.floor(slice.srcTop * scale));
    const bottom = Math.min(height, Math.ceil(slice.srcBottom * scale));
    for (let y = top; y < bottom; y += 2) {
      for (let x = 0; x < width; x += 4) {
        const o = (y * width + x) * 4;
        if (o + 3 >= buffer.length) return false;
        if (!ref) ref = [buffer[o], buffer[o + 1], buffer[o + 2]];
        if (Math.abs(buffer[o] - ref[0]) > 6 || Math.abs(buffer[o + 1] - ref[1]) > 6 || Math.abs(buffer[o + 2] - ref[2]) > 6) {
          return false;
        }
      }
    }
  }
  return ref != null;
}

function overlaps(page, top, bottom) {
  return page.slices.some((slice) => !slice.header && slice.srcTop < bottom - 0.5 && slice.srcBottom > top + 0.5);
}

/**
 * Pages for one captured sheet, after the normal retries. Never throws.
 * Refused (ok false): no pixels, short, blank, or less than MIN_CSS_HEIGHT
 * captured; a page under MIN_FIT; a near-empty page with no neighbour to join.
 * Everything else publishes, degraded where it had to:
 *   clipped / past bottom — lay out the rows captured; last page "clip"
 *   unsplittable, past edge, gap, page loop, header — salvageSheet
 *   past right after the shrink capture — pages holding the element "crop-right"
 *   past right fixed by the shrink capture — pages holding it "shrink"
 *   stitch seam — the page holding it "as-is"
 */
export function planSheet(shot, pageH = PAGE_CSS_H) {
  const refuse = (reason) => ({ ok: false, reason, pages: [] });
  if (!shot?.buffer) return refuse(shot?.reject || "no sheet");
  const content = Number(shot.contentHeight) || 0;
  const captured = Number(shot.capturedHeight) || 0;
  const blank = Number(shot.blankRatio);
  if (content < MIN_CSS_HEIGHT) return refuse(`short ${Math.round(content)}`);
  if (Number.isFinite(blank) && blank > MAX_BLANK_RATIO) return refuse(`blank ${blank.toFixed(2)}`);
  const clipped = captured + 2 < content;
  const clipReason = `clipped ${Math.round(captured)}<${Math.round(content)}`;
  const usable = clipped ? captured : content;
  if (usable < MIN_CSS_HEIGHT) return refuse(clipReason);
  const pieces = clipped ? clipPieces(shot.pieces, usable) : shot.pieces;
  const first = layoutSheet(usable, pieces, pageH);
  let laid = first;
  if (!first.ok) {
    laid = salvageSheet(usable, pieces, pageH);
    if (!laid.ok) return refuse(`${first.reason}; salvage ${laid.reason}`);
  }
  let pages = laid.pages.map((page) => ({ ...page, slices: page.slices.map((slice) => ({ ...slice })) }));
  if (!first.ok && !pages.some((page) => page.degraded)) {
    pages[pages.length - 1] = degrade(pages[pages.length - 1], "as-is", first.reason);
  }
  if (clipped) pages[pages.length - 1] = degrade(pages[pages.length - 1], "clip", clipReason);
  const mark = (boxes, fallback, why) => {
    for (const box of boxes) {
      const hit = pages.flatMap((page, index) => (overlaps(page, box.top, box.bottom) ? [index] : []));
      const at = hit.length ? hit : pages.map((_, index) => index);
      for (const index of at) pages[index] = degrade(pages[index], fallback, why(box));
    }
  };
  if (shot.pastRight) {
    const boxes = shot.pastBoxes?.length ? shot.pastBoxes : [{ top: -Infinity, bottom: Infinity, sel: shot.pastDetail }];
    mark(boxes, "crop-right", (box) => `element past right ${box.sel || ""}`.trim());
  } else if (shot.shrunk?.length) {
    mark(shot.shrunk, "shrink", (box) => `element past right ${box.sel || ""} shrunk ${box.fit}`.replace(/ +/g, " "));
    for (const box of shot.shrunk) {
      for (const page of pages) {
        if (overlaps(page, box.top, box.bottom)) page.shrink = Math.min(page.shrink ?? 1, Number(box.fit) || 1);
      }
    }
  }
  if (shot.seam && Number(shot.scale) > 0) {
    const y = shot.seam.y / shot.scale;
    mark([{ top: y - 1, bottom: y + 1 }], "as-is", () => `seam y ${shot.seam.y}`);
  }
  if (pages.length > 1) {
    const kept = pages.filter(
      (page) => page.degraded || bodySpan(page) >= NEAR_EMPTY_CSS || !inklessRows(shot, page.slices.filter((slice) => !slice.header)),
    );
    if (kept.length) pages = kept;
  }
  pages = mergeNearEmpty(pages, pageH);
  const tiny = pages.findIndex((page) => pages.length > 1 && bodySpan(page) < NEAR_EMPTY_CSS);
  if (tiny >= 0) return refuse(`near-empty page ${tiny + 1} (${Math.round(bodySpan(pages[tiny]))}px)`);
  const thin = pages.findIndex((page) => pageFit(page) < MIN_FIT);
  if (thin >= 0) return refuse(`page ${thin + 1} fit ${pageFit(pages[thin]).toFixed(2)} < ${MIN_FIT}`);
  return { ok: true, pages, salvaged: pages.some((page) => page.degraded) };
}

/** Manifest JSON. Degraded pages keep the reason and which fallback published them. */
export function buildFlatManifest({ issueId, printedAt, pages }) {
  return {
    issueId,
    printedAt,
    geometry: { cssWidth: PAGE_W, cssHeight: PAGE_CSS_H, cssViewportHeight: IPAD13.height, dpr: DPR, pageW: PAGE_W },
    pages: (pages || []).map((page) => {
      const row = {
        folio: page.folio,
        kind: page.kind,
        index: page.index,
        section: page.section,
        url: page.url,
        width: page.width,
        height: page.height,
        cssWidth: page.cssWidth,
        cssHeight: page.cssHeight,
        bytes: page.bytes,
        hotspots: page.hotspots || [],
      };
      if (page.degraded) {
        row.degraded = true;
        row.reason = page.reason || "";
        row.fallback = page.fallback || "";
        if (Number(page.fit) > 0 && page.fit < 1) row.fit = Math.round(page.fit * 1000) / 1000;
      }
      return row;
    }),
  };
}

export function continuationName(folio, part) {
  if (part <= 0) return { folio, file: folio };
  return {
    folio: part === 1 ? `${folio} cont.` : `${folio} cont. ${part}`,
    file: `${folio}-${part + 1}`,
  };
}

/**
 * Hotspots are fractions of the sheet. Move each one onto the page that holds
 * it. A fitted page is painted top-left at its fit, so y, h, x, and w scale
 * with it, and y offsets past any repeated header or earlier slice.
 */
export function remapHotspots(spots, sheetH, pages) {
  const out = pages.map(() => []);
  if (!(sheetH > 0)) return out;
  for (const spot of spots || []) {
    const top = spot.y * sheetH;
    const bottom = top + spot.h * sheetH;
    const center = (top + bottom) / 2;
    const pageIndex = pages.findIndex((page) =>
      page.slices.some((slice) => center >= slice.srcTop - 0.5 && center < slice.srcBottom + 0.5),
    );
    if (pageIndex < 0) continue;
    const fit = pageFit(pages[pageIndex]);
    let dest = 0;
    let placed = null;
    for (const slice of pages[pageIndex].slices) {
      const span = slice.srcBottom - slice.srcTop;
      if (center >= slice.srcTop - 0.5 && center < slice.srcBottom + 0.5) {
        const localTop = (Math.max(slice.srcTop, top) - slice.srcTop) * fit + dest;
        const localBottom = (Math.min(slice.srcBottom, bottom) - slice.srcTop) * fit + dest;
        placed = { y: localTop / PAGE_CSS_H, h: Math.max(0, localBottom - localTop) / PAGE_CSS_H };
        break;
      }
      dest += span * fit;
    }
    if (!placed || placed.h <= 0 || placed.y >= 1) continue;
    const row = { ...spot, y: placed.y, h: Math.min(placed.h, 1 - placed.y) };
    if (Number.isFinite(spot.x) && Number.isFinite(spot.w)) {
      if (spot.x >= 1) continue;
      const x = Math.max(0, spot.x);
      row.x = x * fit;
      row.w = Math.max(0, Math.min(spot.x + spot.w, 1) - x) * fit;
    }
    out[pageIndex].push(row);
  }
  return out;
}

/**
 * Copy sheet slices into one 2064×2752 page and pad the rest with paper.
 * A fitted page samples its slices in order, top-left, at one uniform scale.
 */
export function paintFlatPage(src, srcW, srcH, slices, scale) {
  const out = Buffer.alloc(PAGE_DEV_W * PAGE_DEV_H * 4);
  for (let i = 0; i < PAGE_DEV_W * PAGE_DEV_H; i++) {
    const o = i * 4;
    out[o] = PAPER[0];
    out[o + 1] = PAPER[1];
    out[o + 2] = PAPER[2];
    out[o + 3] = PAPER[3];
  }
  const fitted = Array.isArray(slices) ? slices.find((slice) => Number(slice.fit) > 0 && Number(slice.fit) < 1) : null;
  if (fitted && srcW > 0 && srcH > 0) {
    const bands = [];
    let total = 0;
    for (const slice of slices) {
      const srcTop = Math.max(0, Math.min(srcH, Math.round(slice.srcTop * scale)));
      const srcBottom = Math.max(srcTop, Math.min(srcH, Math.round(slice.srcBottom * scale)));
      if (srcBottom <= srcTop) continue;
      bands.push({ top: srcTop, at: total, rows: srcBottom - srcTop });
      total += srcBottom - srcTop;
    }
    if (!total) return { buffer: out, used: 0, pastEdge: false };
    const destH = Math.max(1, Math.min(PAGE_DEV_H, Math.round((total * Number(fitted.fit) * DPR) / scale)));
    const destW = Math.max(1, Math.min(PAGE_DEV_W, Math.round((srcW * destH) / total)));
    let band = 0;
    for (let destY = 0; destY < destH; destY++) {
      const v = total <= 1 || destH <= 1 ? 0 : Math.round((destY * (total - 1)) / (destH - 1));
      while (band < bands.length - 1 && v >= bands[band].at + bands[band].rows) band += 1;
      const srcY = bands[band].top + Math.min(bands[band].rows - 1, v - bands[band].at);
      const fromRow = srcY * srcW;
      const toRow = destY * PAGE_DEV_W;
      for (let destX = 0; destX < destW; destX++) {
        const srcX = destW <= 1 ? 0 : Math.min(srcW - 1, Math.round((destX * (srcW - 1)) / (destW - 1)));
        const from = (fromRow + srcX) * 4;
        const to = (toRow + destX) * 4;
        out[to] = src[from];
        out[to + 1] = src[from + 1];
        out[to + 2] = src[from + 2];
        out[to + 3] = src[from + 3];
      }
    }
    return { buffer: out, used: destH, pastEdge: false };
  }
  let dest = 0;
  let dropped = 0;
  const copyW = Math.min(PAGE_DEV_W, srcW);
  for (const slice of slices) {
    let srcTop = Math.round(slice.srcTop * scale);
    let srcBottom = Math.round(slice.srcBottom * scale);
    srcTop = Math.max(0, Math.min(srcH, srcTop));
    srcBottom = Math.max(srcTop, Math.min(srcH, srcBottom));
    let rows = srcBottom - srcTop;
    if (dest + rows > PAGE_DEV_H) {
      dropped += dest + rows - PAGE_DEV_H;
      rows = PAGE_DEV_H - dest;
    }
    for (let row = 0; row < rows; row++) {
      const from = ((srcTop + row) * srcW) * 4;
      const to = ((dest + row) * PAGE_DEV_W) * 4;
      src.copy(out, to, from, from + copyW * 4);
    }
    dest += rows;
    if (dest >= PAGE_DEV_H) break;
  }
  return { buffer: out, used: dest, pastEdge: dropped > 2 || srcW > PAGE_DEV_W + 4 };
}

/**
 * A stitch seam is a 1 CSS px (1–3 device rows) full-width line: near-uniform,
 * dark, and different from the rows just outside the run. Photo blacks and
 * rules that are not uniform across the whole sheet do not match. Edge rows
 * are ignored. Returns `{ y, rows }` in device pixels, or null.
 */
export function findSeam(canvas, width, height) {
  if (!width || !height || height < 3) return null;
  const pixels = width * height;
  if (canvas.length < pixels * 3) return null;
  const channels = canvas.length >= pixels * 4 ? 4 : 3;
  const step = Math.max(1, Math.floor(width / 480));
  const dark = new Uint8Array(height);
  for (let y = 0; y < height; y++) {
    let n = 0;
    let darkN = 0;
    let min = 255;
    let max = 0;
    const row = y * width * channels;
    for (let x = 0; x < width; x += step) {
      const o = row + x * channels;
      const r = canvas[o];
      const g = canvas[o + 1];
      const b = canvas[o + 2];
      const l = (r + g + b) / 3;
      if (l < min) min = l;
      if (l > max) max = l;
      n += 1;
      if (r < 40 && g < 40 && b < 48) darkN += 1;
    }
    if (n && darkN / n >= 0.98 && max - min <= 12 && (min + max) / 2 < 36) dark[y] = 1;
  }
  const differs = (a, b) => {
    let n = 0;
    let diff = 0;
    let sumA = 0;
    let sumB = 0;
    for (let x = 0; x < width; x += step) {
      const oa = (a * width + x) * channels;
      const ob = (b * width + x) * channels;
      const la = (canvas[oa] + canvas[oa + 1] + canvas[oa + 2]) / 3;
      const lb = (canvas[ob] + canvas[ob + 1] + canvas[ob + 2]) / 3;
      n += 1;
      sumA += la;
      sumB += lb;
      if (Math.abs(la - lb) > 24) diff += 1;
    }
    // A photo can share the line's darkness in part of the row. The line still
    // differs when its mean is far from the neighbor and most samples disagree.
    return n > 0 && Math.abs(sumA - sumB) / n >= 24 && diff / n >= 0.45;
  };
  for (let y = 0; y < height; ) {
    if (!dark[y]) {
      y += 1;
      continue;
    }
    let end = y;
    while (end + 1 < height && dark[end + 1]) end += 1;
    const rows = end - y + 1;
    const above = y - 1;
    const below = end + 1;
    if (rows <= 3 && above >= 0 && below < height && !dark[above] && !dark[below] && differs(y, above) && differs(end, below)) {
      return { y, rows };
    }
    y = end + 1;
  }
  return null;
}

function blankRatio(canvas, width, height, limit = height) {
  let white = 0;
  let n = 0;
  const step = 8;
  const yMax = Math.max(0, Math.min(height, limit));
  for (let y = 0; y < yMax; y += step) {
    const row = y * width * 4;
    for (let x = 0; x < width; x += step) {
      const o = row + x * 4;
      n += 1;
      const a = canvas[o + 3];
      if (a < 16 || (canvas[o] >= 248 && canvas[o + 1] >= 248 && canvas[o + 2] >= 248)) white += 1;
    }
  }
  return n ? white / n : 1;
}

/** Drop a tall unpainted tail. A real page keeps its last ink row. */
function cropWhiteTail(canvas, width, height) {
  const step = 4;
  let bottom = -1;
  for (let y = height - 1; y >= 0; y -= 1) {
    const row = y * width * 4;
    let ink = 0;
    let n = 0;
    for (let x = 0; x < width; x += step) {
      const o = row + x * 4;
      n += 1;
      if (canvas[o + 3] > 16 && (canvas[o] < 248 || canvas[o + 1] < 248 || canvas[o + 2] < 248)) ink += 1;
    }
    if (n && ink / n > 0.004) {
      bottom = y;
      break;
    }
  }
  if (bottom < 0) return { buffer: canvas, height: 1 };
  const keep = Math.min(height, bottom + 1 + 8);
  if (height - keep < 80) return { buffer: canvas, height };
  const next = Buffer.alloc(width * keep * 4);
  canvas.copy(next, 0, 0, width * keep * 4);
  return { buffer: next, height: keep };
}

function fitHotspots(spots, sheetCss, contentCss) {
  if (!sheetCss || !contentCss || Math.abs(sheetCss - contentCss) < 1) return spots;
  const scale = sheetCss / contentCss;
  const out = [];
  for (const spot of spots) {
    const y = spot.y * scale;
    const h = spot.h * scale;
    if (y >= 1 || y + h <= 0) continue;
    const top = Math.max(0, y);
    const bottom = Math.min(1, y + h);
    out.push({ ...spot, y: top, h: bottom - top });
  }
  return out;
}

async function loadSession(config) {
  let session;
  if (process.env.TIMES_SESSION_JSON) session = JSON.parse(process.env.TIMES_SESSION_JSON);
  else session = JSON.parse(await readFile(SESSION_FILE, "utf8"));
  const left = (session.expires_at || 0) - Date.now() / 1000;
  // A full book can take most of an hour. Refresh before the token gets short.
  if (left < 2700 && session.refresh_token) {
    const res = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.access_token) throw new Error(`session refresh failed: ${res.status}`);
    session = {
      access_token: body.access_token,
      refresh_token: body.refresh_token,
      expires_in: body.expires_in,
      expires_at: body.expires_at ?? Math.floor(Date.now() / 1000) + (body.expires_in || 3600),
      token_type: body.token_type || "bearer",
      user: body.user,
    };
    if (!process.env.TIMES_SESSION_JSON) await writeFile(SESSION_FILE, JSON.stringify(session), { mode: 0o600 });
    log("refreshed session");
  }
  let layout = {};
  try {
    layout = JSON.parse(await readFile(LAYOUT_FILE, "utf8"));
  } catch {
    layout = {};
  }
  return { session, layout };
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    const extra = (process.env.NODE_PATH || "").split(path.delimiter).filter(Boolean);
    const candidates = [
      ...extra.map((dir) => path.join(dir, "playwright", "index.mjs")),
      "/tmp/tt-measure/node_modules/playwright/index.mjs",
    ];
    let last = "playwright is not installed";
    for (const file of candidates) {
      try {
        return await import(pathToFileURL(file).href);
      } catch (err) {
        last = err.message;
      }
    }
    throw new Error(last);
  }
}

function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.LD_LIBRARY_PATH;
    const child = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", ...args], { stdio: "inherit", env });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`))));
  });
}

function pngSize(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

async function encodeWebp(pngPath, webpPath) {
  await ffmpeg(["-y", "-i", pngPath, "-c:v", "libwebp", "-lossless", "1", "-compression_level", "6", webpPath]);
}

async function rawSize(file) {
  const { width, height } = pngSize(await readFile(file));
  return { width, height };
}

/**
 * The 1650 pack hides flowed blocks and cuts sentences. Printing wants the
 * copy those rules removed, measured at 1032 CSS px wide, then one screenshot
 * of that whole sheet. No slice is stitched.
 */
export async function openSheet(page, index) {
  await page.evaluate(async (i) => {
    const leaf = document.querySelectorAll(".wsj-page")[i];
    const sheet = leaf?.querySelector(".wsj-sheet");
    if (!leaf || !sheet) return;
    const unlock = (el, size) => {
      if (!el) return;
      el.style.setProperty("overflow", "visible", "important");
      el.style.setProperty("max-height", "none", "important");
      if (size) el.style.setProperty("height", "auto", "important");
    };
    let busy = false;
    const release = () => {
      if (busy) return;
      busy = true;
      try {
      const host = sheet.closest(".wsj-fit-plan");
      host?.querySelectorAll("style").forEach((node) => node.remove());
      for (const node of sheet.querySelectorAll("[data-fit-full]")) {
        const full = node.getAttribute("data-fit-full");
        if (full != null && node.textContent !== full) node.textContent = full;
      }
      for (const node of sheet.querySelectorAll("[hidden]")) node.hidden = false;
      // The pager is the horizontal scrollport. overflow:visible on it drops
      // that scrollport, scrollLeft snaps back to 0, and every later folio
      // sits past the right edge (clip width 0, height intact).
      unlock(leaf, true);
      unlock(sheet, true);
      for (const el of sheet.querySelectorAll("*")) {
        if (!(el instanceof HTMLElement)) continue;
        if (el.scrollHeight <= el.clientHeight + 2) continue;
        const oy = getComputedStyle(el).overflowY;
        // A scrollport's extra lines are real copy. Grow the box so the
        // screenshot includes them. Do not invent height from overflow that
        // is already visible — that is what doubled a packed front.
        if (oy === "visible") continue;
        const need = el.scrollHeight;
        unlock(el, true);
        el.style.setProperty("min-height", `${need}px`, "important");
      }
      } finally {
        busy = false;
      }
    };
    window.__ttPrintUnlock?.disconnect();
    window.__ttPrintUnlock = new MutationObserver(release);
    window.__ttPrintUnlock.observe(sheet.closest(".wsj-fit-plan") || sheet, { childList: true, subtree: true });
    release();
    const pager = document.querySelector(".newspaper-edition");
    if (pager) {
      pager.style.scrollBehavior = "auto";
      pager.scrollLeft = i * (pager.clientWidth || 1);
      const placed = sheet.getBoundingClientRect();
      if (Math.abs(placed.x) > 1) pager.scrollLeft += placed.x;
    }
    leaf.scrollTop = 0;
    const imgs = [...sheet.querySelectorAll("img")];
    for (const img of imgs) {
      img.loading = "eager";
      const src = img.getAttribute("src");
      if (src && (!img.complete || img.naturalWidth === 0)) img.src = src;
    }
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete && (img.naturalWidth > 0 || img.getAttribute("src") == null)) {
              resolve();
              return;
            }
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
            setTimeout(done, 4000);
          }),
      ),
    );
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    release();
  }, index);
}

/**
 * `shrink` (a floor, e.g. MIN_FIT) is the last-chance capture for a sheet
 * still past right: each outermost element painting past 1032 gets CSS zoom
 * so it ends inside the sheet, unless that needs less than the floor.
 */
export async function measureSheet(page, index, opts = {}) {
  return page.evaluate(({ i, shrink }) => {
    const pager = document.querySelector(".newspaper-edition");
    const leaf = document.querySelectorAll(".wsj-page")[i];
    const sheet = leaf?.querySelector(".wsj-sheet");
    if (!leaf || !sheet) return null;
    if (pager) {
      pager.style.scrollBehavior = "auto";
      pager.scrollLeft = i * (pager.clientWidth || 1);
      const placed = sheet.getBoundingClientRect();
      if (Math.abs(placed.x) > 1) pager.scrollLeft += placed.x;
    }
    leaf.scrollTop = 0;
    const zoom = Number.parseFloat(getComputedStyle(sheet).zoom || "1") || 1;
    const sheetRect = sheet.getBoundingClientRect();
    const rel = (el) => {
      const r = el.getBoundingClientRect();
      return {
        top: (r.top - sheetRect.top) / zoom,
        bottom: (r.bottom - sheetRect.top) / zoom,
        left: (r.left - sheetRect.left) / zoom,
        right: (r.right - sheetRect.left) / zoom,
      };
    };
    // Painted right edge. A horizontal scroller, a closed menu, or the fit
    // clone keeps a layout box past 1032 while its ink stays inside the sheet.
    const clipsX = (node) => {
      const ox = getComputedStyle(node).overflowX;
      return ox === "hidden" || ox === "clip" || ox === "auto" || ox === "scroll";
    };
    const paintedRight = (el) => {
      const box = rel(el);
      let right = box.right;
      let node = el.parentElement;
      while (node && node !== sheet.parentElement) {
        if (clipsX(node)) right = Math.min(right, rel(node).right);
        if (node === sheet) break;
        node = node.parentElement;
      }
      return { ...box, right };
    };
    const selOf = (el) => {
      const id = el.id ? `#${el.id}` : "";
      const cls = [...el.classList].slice(0, 4).join(".");
      return `${el.tagName.toLowerCase()}${id}${cls ? "." + cls : ""}`;
    };
    const width = sheet.offsetWidth;
    const fixed = [];
    const contain = (el) => {
      const menu = el.closest(".tt-editions-menu");
      const decorative =
        menu ||
        el.dataset.ttFitHost != null ||
        el.dataset.ttFitClone != null ||
        el.getAttribute("aria-hidden") === "true";
      if (decorative) {
        el.style.setProperty("display", "none", "important");
        return;
      }
      // Real text that paints past the sheet wraps inside 1032. An image or
      // table is left alone so the log can name it instead of shrinking it.
      const tag = el.tagName;
      if (tag === "IMG" || tag === "SVG" || tag === "CANVAS" || tag === "TABLE") return;
      el.style.setProperty("max-width", "100%", "important");
      el.style.setProperty("min-width", "0", "important");
      el.style.setProperty("white-space", "normal", "important");
      el.style.setProperty("overflow-wrap", "anywhere", "important");
    };
    for (const el of sheet.querySelectorAll("*")) {
      if (!(el instanceof HTMLElement)) continue;
      const box = rel(el);
      if (box.bottom - box.top <= 1) continue;
      if (box.right <= width + 1) continue;
      const painted = paintedRight(el);
      if (painted.right <= width + 1) continue;
      fixed.push(
        `${selOf(el)} right ${Math.round(box.right)} top ${Math.round(box.top)} ${Math.round(box.right - box.left)}x${Math.round(box.bottom - box.top)}`,
      );
      contain(el);
    }
    let sheetRect2 = sheet.getBoundingClientRect();
    const rel2 = (el) => {
      const r = el.getBoundingClientRect();
      return {
        top: (r.top - sheetRect2.top) / zoom,
        bottom: (r.bottom - sheetRect2.top) / zoom,
        left: (r.left - sheetRect2.left) / zoom,
        right: (r.right - sheetRect2.left) / zoom,
      };
    };
    const scanPast = () => {
      let tall = Math.max(sheet.scrollHeight, sheet.offsetHeight);
      const past = [];
      for (const el of sheet.querySelectorAll("*")) {
        if (!(el instanceof HTMLElement)) continue;
        const box = rel2(el);
        if (box.bottom > tall) tall = box.bottom;
        if (box.bottom - box.top <= 1 || box.right <= width + 1) continue;
        let painted = box.right;
        let node = el.parentElement;
        while (node && node !== sheet.parentElement) {
          if (clipsX(node)) painted = Math.min(painted, rel2(node).right);
          if (node === sheet) break;
          node = node.parentElement;
        }
        if (painted <= width + 1) continue;
        past.push({ el, box });
      }
      return { tall, past: past.filter(({ el }) => !past.some((other) => other.el !== el && other.el.contains(el))) };
    };
    let { tall: contentH, past } = scanPast();
    if (shrink > 0 && past.length) {
      let changed = false;
      for (const { el, box } of past) {
        const left = Math.max(0, box.left);
        const now = Number.parseFloat(el.style.zoom || "1") || 1;
        const fit = box.right > left ? ((width - 1 - left) / (box.right - left)) * now : 0;
        if (!(fit >= shrink) || fit >= now) continue;
        el.style.setProperty("zoom", String(fit), "important");
        el.setAttribute("data-tt-shrunk", String(Math.round(fit * 1000) / 1000));
        changed = true;
      }
      if (changed) {
        sheetRect2 = sheet.getBoundingClientRect();
        ({ tall: contentH, past } = scanPast());
      }
    }
    const shrunkEls = [...sheet.querySelectorAll("[data-tt-shrunk]")].map((el) => ({
      el,
      fit: Number(el.getAttribute("data-tt-shrunk")) || 1,
    }));
    const pastRight = past.length > 0;
    const detailOf = ({ el, box }) =>
      `${selOf(el)} right ${Math.round(box.right)} top ${Math.round(box.top)} ${Math.round(box.right - box.left)}x${Math.round(box.bottom - box.top)}`;
    const pastDetail = past.length ? detailOf(past[0]) : "";
    const pastBoxes = past.slice(0, 8).map(({ el, box }) => ({ sel: selOf(el), top: box.top, bottom: box.bottom }));
    const shrunk = shrunkEls.map(({ el, fit }) => {
      const box = rel2(el);
      return { sel: selOf(el), fit, top: box.top, bottom: box.bottom };
    });
    const pieceSel = [
      "article",
      "table",
      ".wsj-mast",
      ".wsj-form-card",
      ".wsj-brief",
      ".wsj-front-under",
      ".wsj-front-row",
      ".wsj-rail",
      ".wsj-rail-block",
      ".wx",
      "figure",
      ".wsj-section-head",
      ".tt-outlook",
    ].join(",");
    const found = [...sheet.querySelectorAll(pieceSel)];
    const own = found.filter((el) => !found.some((other) => other !== el && other.contains(el)));
    for (const el of sheet.querySelectorAll("div, section, header, ul, ol")) {
      if (el === sheet || own.some((piece) => piece === el || piece.contains(el) || el.contains(piece))) continue;
      if (el.offsetHeight < 12 || el.offsetWidth < 80) continue;
      if ([...el.children].some((child) => child instanceof HTMLElement && child.offsetHeight > el.offsetHeight * 0.7)) continue;
      own.push(el);
    }
    const pageH = 1376;
    const pieces = [];
    for (const el of own) {
      const box = rel2(el);
      if (box.bottom - box.top < 8) continue;
      const piece = { top: box.top, bottom: box.bottom, atoms: [], header: null, sel: selOf(el) };
      if (box.bottom - box.top > pageH + 0.5) {
        const thead = el.querySelector("thead");
        if (thead) {
          const head = rel2(thead);
          piece.header = { top: head.top, bottom: head.bottom, left: head.left, right: head.right };
        }
        for (const row of el.querySelectorAll("tr")) {
          if (row.closest("thead")) continue;
          const rowBox = rel2(row);
          if (rowBox.bottom - rowBox.top > 0.5) {
            piece.atoms.push({ top: rowBox.top, bottom: rowBox.bottom, left: rowBox.left, right: rowBox.right });
          }
        }
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node) {
          if (!node.parentElement?.closest("table") && (node.textContent || "").trim()) {
            const range = document.createRange();
            range.selectNodeContents(node);
            for (const r of range.getClientRects()) {
              if (r.height < 1 || r.width < 1) continue;
              piece.atoms.push({
                top: (r.top - sheetRect2.top) / zoom,
                bottom: (r.bottom - sheetRect2.top) / zoom,
                left: (r.left - sheetRect2.left) / zoom,
                right: (r.right - sheetRect2.left) / zoom,
              });
            }
          }
          node = walker.nextNode();
        }
        for (const media of el.querySelectorAll("img, svg, canvas")) {
          if (media.closest("table")) continue;
          const mediaBox = rel2(media);
          if (mediaBox.bottom - mediaBox.top > 1) {
            piece.atoms.push({ top: mediaBox.top, bottom: mediaBox.bottom, left: mediaBox.left, right: mediaBox.right });
          }
        }
      }
      pieces.push(piece);
    }
    pieces.sort((a, b) => a.top - b.top);
    // A child a few dozen pixels below the border (the short A4/A6 clip) is
    // real copy. Stretch the paper so the shot includes it. A front that
    // merely unpacked is already hundreds of pixels taller; don't pad that.
    if (contentH > sheet.offsetHeight + 2 && contentH < sheet.offsetHeight + 80) {
      sheet.style.setProperty("min-height", `${Math.ceil(contentH)}px`, "important");
      contentH = Math.max(contentH, sheet.offsetHeight);
    }
    const s = sheet.getBoundingClientRect();
    return {
      x: s.x,
      y: s.y,
      w: s.width,
      h: s.height,
      viewW: window.innerWidth,
      viewH: window.innerHeight,
      sheetW: width,
      contentH,
      pastRight,
      pastDetail,
      pastBoxes,
      shrunk,
      fixed,
      pieces,
    };
  }, { i: index, shrink: Number(opts.shrink) || 0 });
}

export async function captureSheet(page, index, pngPath, opts = {}) {
  const contained = [];
  const noteFixed = (geom) => {
    for (const row of geom?.fixed || []) {
      if (!contained.includes(row)) contained.push(row);
    }
  };
  await page.setViewportSize({ width: IPAD13.width, height: IPAD13.height });
  await openSheet(page, index);
  let geom = await measureSheet(page, index, opts);
  noteFixed(geom);
  if (!geom || geom.contentH < 40 || geom.sheetW < 40) return null;
  const chrome = Math.max(48, geom.viewH - geom.h);
  const viewH = Math.min(16000, Math.max(IPAD13.height, Math.ceil(geom.y + geom.contentH + chrome)));
  await page.setViewportSize({ width: IPAD13.width, height: viewH });
  try {
    await openSheet(page, index);
    geom = await measureSheet(page, index, opts);
    noteFixed(geom);
    if (!geom || geom.w < 40 || geom.h < 40) return null;
    const need = Math.ceil(geom.y + geom.h + 8);
    if (need > viewH || geom.h + 1 < geom.contentH) {
      const taller = Math.min(16000, Math.max(viewH, Math.ceil(geom.y + geom.contentH + chrome)));
      await page.setViewportSize({ width: IPAD13.width, height: taller });
      await openSheet(page, index);
      geom = await measureSheet(page, index, opts);
      noteFixed(geom);
      if (!geom) return null;
    }
    const clip = clipSize(geom);
    const { x, y, width } = clip;
    // A short sheet can still report content below its border (a child that
    // overflows). Capture that ink when the viewport has room. y is the sheet
    // top, so the limit is the viewport below y, not the viewport itself.
    const room = Math.max(0, geom.viewH - y);
    const height = Math.min(Math.max(clip.height, geom.contentH), room);
    if (width < 40) {
      log("clip offscreen", `x ${Math.round(x)}`, `w ${Math.round(width)}`, `view ${Math.round(geom.viewW)}`);
      return { missing: "offscreen" };
    }
    if (contained.length) log("contained", contained.slice(0, 4).join(" | "));
    if (height + 2 < geom.contentH) {
      log(
        "clip short",
        Math.round(height),
        "of",
        Math.round(geom.contentH),
        `y ${Math.round(y)}`,
        `box ${Math.round(geom.h)}`,
        `view ${Math.round(geom.viewH)}`,
      );
      // Keep what is on screen. planSheet publishes it as a "clip" page
      // if the retries never capture the whole sheet.
      if (height < MIN_CSS_HEIGHT) return { missing: "clipped" };
    }
    try {
      await page.screenshot({
        path: pngPath,
        animations: "disabled",
        type: "png",
        clip: { x, y, width, height },
        timeout: 45_000,
      });
    } catch (err) {
      log("screenshot", String(err?.message || err).slice(0, 180));
      return null;
    }
  } finally {
    await page.setViewportSize({ width: IPAD13.width, height: IPAD13.height });
  }
  const { width, height } = await rawSize(pngPath);
  const scale = width / geom.sheetW;
  const rawOut = `${pngPath}.raw`;
  await ffmpeg(["-y", "-i", pngPath, "-f", "rawvideo", "-pix_fmt", "rgba", rawOut]);
  const pixels = await readFile(rawOut);
  await unlink(rawOut).catch(() => {});
  const capturedHeight = height / scale;
  const seam = findSeam(pixels, width, height);
  return {
    width,
    height,
    cssWidth: geom.sheetW,
    capturedHeight,
    contentHeight: geom.contentH,
    pieces: geom.pieces,
    pastBottom: capturedHeight + 1 < geom.contentH,
    pastRight: geom.pastRight,
    pastDetail: geom.pastDetail || "",
    pastBoxes: geom.pastBoxes || [],
    shrunk: geom.shrunk || [],
    fixed: contained,
    buffer: pixels,
    scale,
    blankRatio: blankRatio(pixels, width, height),
    seam,
  };
}

function authHeaders(config, token, extra = {}) {
  return {
    apikey: config.key,
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

async function uploadObject(config, token, objectPath, bytes, contentType, cacheControl) {
  const res = await fetch(`${config.url}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: "POST",
    headers: authHeaders(config, token, {
      "Content-Type": contentType,
      "x-upsert": "true",
      "cache-control": cacheControl,
    }),
    body: bytes,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`upload ${objectPath} ${res.status} ${text.slice(0, 180)}`);
  }
}

async function listPrefix(config, token, prefix) {
  const rows = [];
  for (let offset = 0; offset < 5000; offset += 100) {
    const res = await fetch(`${config.url}/storage/v1/object/list/${BUCKET}`, {
      method: "POST",
      headers: authHeaders(config, token, { "Content-Type": "application/json" }),
      body: JSON.stringify({ prefix, limit: 100, offset, sortBy: { column: "name", order: "asc" } }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`list ${res.status}`);
    if (!Array.isArray(body) || !body.length) break;
    rows.push(...body);
    if (body.length < 100) break;
  }
  return rows;
}

async function removePrefixes(config, token, prefixes) {
  if (!prefixes.length) return;
  const res = await fetch(`${config.url}/storage/v1/object/${BUCKET}`, {
    method: "DELETE",
    headers: authHeaders(config, token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ prefixes }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`delete ${res.status} ${text.slice(0, 180)}`);
  }
}

async function prune(config, token) {
  const today = chicagoToday();
  const keepFrom = addDays(today, -(RETENTION_DAYS - 1));
  const top = await listPrefix(config, token, "");
  let removed = 0;
  for (const row of top) {
    const name = String(row.name || "");
    const day = editionDate(name);
    if (!day || day >= keepFrom) continue;
    const files = await listPrefix(config, token, `${name}/`);
    const prefixes = files.filter((f) => f.id).map((f) => `${name}/${f.name}`);
    if (prefixes.length) {
      await removePrefixes(config, token, prefixes);
      removed += prefixes.length;
      log("pruned", name, prefixes.length, "files");
    }
  }
  log("retention", `keep dateline >= ${keepFrom}`, "removed", removed);
}

async function harden(context) {
  const supa = (await supabaseConfig()).url;
  await context.route("**/*", (route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();
    if (url.startsWith(supa) && url.includes("/rest/v1/") && method !== "GET" && method !== "HEAD") return route.abort();
    if (url.startsWith(supa) && /\/functions\/v1\/(newspaper-press|newspaper-editor|times-telegram)/.test(url)) return route.abort();
    return route.continue();
  });
}

function sessionInit(projectRef, session, layout) {
  return {
    script: ({ key, session, layout }) => {
      try {
        localStorage.setItem(key, JSON.stringify(session));
        localStorage.setItem("sports-layout-v1", JSON.stringify(layout));
        localStorage.setItem("newspaper-solo", "1");
        sessionStorage.setItem("newspaper-solo", "1");
      } catch {}
    },
    arg: { key: `sb-${projectRef}-auth-token`, session, layout },
  };
}

async function reveal(page) {
  await page
    .waitForFunction(() => {
      const sheet = document.querySelector(".wsj-page .wsj-sheet");
      return !!sheet && sheet.childElementCount > 0 && sheet.getBoundingClientRect().height > 80;
    }, { timeout: 70_000 })
    .catch(() => {});
  const start = Date.now();
  let last = -1;
  let quiet = Date.now();
  while (Date.now() - start < 28_000) {
    const h = await page.evaluate(() => document.querySelector(".wsj-page .wsj-sheet")?.offsetHeight || 0);
    if (h !== last) {
      last = h;
      quiet = Date.now();
    }
    const ready = await page.evaluate(
      () => document.querySelector("[data-times-ready]")?.getAttribute("data-times-ready") === "1",
    );
    if (h > 200 && ready && Date.now() - quiet > 1500) break;
    if (h > 200 && Date.now() - quiet > 4000) break;
    await page.waitForTimeout(250);
  }
  await page.evaluate(() => {
    document.querySelectorAll(".tt-hold").forEach((el) => {
      el.style.display = "none";
    });
    const pager = document.querySelector(".newspaper-edition");
    if (pager) pager.style.visibility = "visible";
  });
}

/**
 * Non-empty sheet, fonts ready, every image decoded, and the same height
 * across three animation frames and two polls. A short shell keeps waiting
 * until the budget runs out so a late table can still land.
 */
async function waitForSheet(page, index, budgetMs) {
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  const start = Date.now();
  let lastH = -1;
  let stablePolls = 0;
  let last = null;
  while (Date.now() - start < budgetMs) {
    const snap = await page.evaluate(async (i) => {
      const leaf = document.querySelectorAll(".wsj-page")[i];
      const sheet = leaf?.querySelector(".wsj-sheet");
      if (!sheet || sheet.childElementCount === 0) {
        return { empty: true, h: 0, stable: false, pending: 0, text: 0 };
      }
      const imgs = [...sheet.querySelectorAll("img")];
      const pending = imgs.filter((img) => !img.complete).length;
      const h1 = sheet.offsetHeight;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const h2 = sheet.offsetHeight;
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const h3 = sheet.offsetHeight;
      const text = (sheet.innerText || "").replace(/\s+/g, " ").trim().length;
      return {
        empty: false,
        h: h3,
        stable: h1 > 0 && h1 === h2 && h2 === h3,
        pending,
        text,
      };
    }, index);
    last = snap;
    if (!snap.empty && snap.stable && snap.pending === 0 && snap.text >= 24 && snap.h === lastH) stablePolls += 1;
    else if (!snap.empty && snap.stable && snap.pending === 0 && snap.text >= 24) stablePolls = 1;
    else stablePolls = 0;
    lastH = snap.h || 0;
    if (
      !snap.empty &&
      snap.stable &&
      snap.pending === 0 &&
      snap.text >= 24 &&
      snap.h >= MIN_CSS_HEIGHT &&
      stablePolls >= 2
    ) {
      return { ok: true, ...snap };
    }
    await page.waitForTimeout(200);
  }
  return { ok: false, ...(last || { empty: true, h: 0, stable: false, pending: 0, text: 0 }) };
}

async function waitQuiet(page, index) {
  let last = -1;
  let quiet = Date.now();
  const start = Date.now();
  while (Date.now() - start < 2_000) {
    const h = await page.evaluate(
      (i) => document.querySelectorAll(".wsj-page")[i]?.querySelector(".wsj-sheet")?.offsetHeight || 0,
      index,
    );
    if (h !== last) {
      last = h;
      quiet = Date.now();
    }
    if (h > 80 && Date.now() - quiet > 700) return;
    await page.waitForTimeout(200);
  }
}

async function primePage(page, index) {
  await page.evaluate((i) => {
    const leaf = document.querySelectorAll(".wsj-page")[i];
    const folio = leaf?.getAttribute("data-folio");
    if (folio) location.hash = `#${folio}`;
  }, index);
  await page
    .waitForFunction(
      (i) => {
        const sheet = document.querySelectorAll(".wsj-page")[i]?.querySelector(".wsj-sheet");
        return !!sheet && sheet.childElementCount > 0 && sheet.getBoundingClientRect().height > 80;
      },
      index,
      { timeout: 25_000 },
    )
    .catch(() => {});
  await page.evaluate(async (i) => {
    const pager = document.querySelector(".newspaper-edition");
    const leaf = pager?.querySelectorAll(".wsj-page")[i];
    if (!leaf) return;
    if (pager) pager.scrollTo({ left: i * pager.clientWidth, behavior: "instant" });
    leaf.scrollTop = 0;
    const imgs = [...leaf.querySelectorAll("img")];
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise((resolve) => {
            img.loading = "eager";
            const src = img.getAttribute("src");
            if (src && (!img.complete || img.naturalWidth === 0)) img.src = src;
            if (img.complete && (img.naturalWidth > 0 || img.getAttribute("src") == null)) {
              resolve();
              return;
            }
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
            setTimeout(done, 8000);
          }),
      ),
    );
    // Walk the folio so lazy art below the first screen actually requests.
    const max = leaf.scrollHeight;
    for (let y = 0; y < max; y += 900) leaf.scrollTop = y;
    leaf.scrollTop = 0;
    await document.fonts?.ready;
  }, index);
  await page.evaluate(async (i) => {
    const leaf = document.querySelectorAll(".wsj-page")[i];
    if (!leaf) return;
    const imgs = [...leaf.querySelectorAll("img")];
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete && img.naturalWidth > 0) {
              resolve();
              return;
            }
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
            setTimeout(done, 4000);
          }),
      ),
    );
  }, index);
  await waitQuiet(page, index);
}

async function hotspots(page, index) {
  return page.evaluate((i) => {
    const leaf = document.querySelectorAll(".wsj-page")[i];
    const sheet = leaf?.querySelector(".wsj-sheet");
    if (!sheet) return [];
    const box = sheet.getBoundingClientRect();
    if (!box.width || !box.height) return [];
    const out = [];
    for (const el of sheet.querySelectorAll("a[href], button, [data-tt-goto]")) {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      const hrefAttr = el.getAttribute("href");
      const href = hrefAttr && !hrefAttr.startsWith("javascript:") ? hrefAttr : null;
      const text = (el.innerText || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 140);
      const stamped = el.getAttribute("data-tt-goto");
      const found = (text.match(/\b([A-Z]{1,4}\d{1,2})\b/) || [])[1] || null;
      const folio = stamped || (found && /^[A-Z]{1,4}\d{1,2}$/.test(found) ? found : null);
      if (!href && !folio) continue;
      out.push({
        x: (r.left - box.left) / box.width,
        y: (r.top - box.top) / box.height,
        w: r.width / box.width,
        h: r.height / box.height,
        href,
        folio,
        label: text,
      });
    }
    return out;
  }, index);
}

async function encodeRawWebp(buffer, webpPath) {
  const raw = `${webpPath}.raw`;
  await writeFile(raw, buffer);
  await ffmpeg([
    "-y",
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgba",
    "-s",
    `${PAGE_DEV_W}x${PAGE_DEV_H}`,
    "-i",
    raw,
    "-c:v",
    "libwebp",
    "-lossless",
    "1",
    "-compression_level",
    "6",
    webpPath,
  ]);
  await unlink(raw).catch(() => {});
  return readFile(webpPath);
}

/** heights.txt / PAGE status for one report row. */
export function rowStatus(row) {
  if (!row.ok) return `FAIL ${row.reason}`;
  if (row.degraded) return `DEGRADED ${row.fallback}: ${row.reason}`;
  return "ok";
}

export function heightLine(row) {
  return `${row.folio}\tcss ${row.cssHeight}\tblank ${row.blankRatio.toFixed(2)}\t${rowStatus(row)}`;
}

function encodedProblem(webp) {
  const dim = webpSize(webp);
  if (!dim || dim.width !== PAGE_DEV_W || dim.height !== PAGE_DEV_H) {
    return `encoded ${dim ? `${dim.width}x${dim.height}` : "not VP8L"}`;
  }
  if (webp.length < MIN_WEBP_BYTES) return `encoded ${webp.length} bytes`;
  return null;
}

/**
 * Paint, judge, and encode every page of one planned sheet to outDir.
 * Nothing is uploaded here. A page that fails its own check after planning
 * publishes degraded "as-is" (seam, mostly white, rows past the edge); an
 * empty page or a bad encode is a FAIL row, which withholds the edition.
 */
export async function renderSheet({ leaf, shot, plan, spots, outDir, firstIndex = 0, encode = encodeRawWebp, say = log }) {
  const staged = [];
  const report = [];
  const mapped = remapHotspots(spots, shot.contentHeight, plan.pages);
  const section = (/^([A-Z]+)/.exec(leaf.folio) || [])[1] || leaf.folio;
  for (let part = 0; part < plan.pages.length; part++) {
    const name = continuationName(leaf.folio, part);
    let page = plan.pages[part];
    const painted = paintFlatPage(shot.buffer, shot.width, shot.height, page.slices, shot.scale);
    const pageShot = {
      width: PAGE_DEV_W,
      height: PAGE_DEV_H,
      pastEdge: painted.pastEdge,
      blankRatio: blankRatio(painted.buffer, PAGE_DEV_W, PAGE_DEV_H, painted.used),
      seam: findSeam(painted.buffer, PAGE_DEV_W, PAGE_DEV_H),
    };
    const verdict = judgePage(pageShot);
    const row = { folio: name.folio, cssHeight: PAGE_CSS_H, blankRatio: pageShot.blankRatio, ok: true };
    let fail = null;
    if (pageShot.blankRatio >= EMPTY_PAGE_RATIO) fail = `empty ${pageShot.blankRatio.toFixed(3)}`;
    else if (!verdict.ok && /^size/.test(verdict.reason)) fail = verdict.reason;
    else if (!verdict.ok) page = degrade(page, "as-is", verdict.reason);
    let webp = null;
    if (!fail) {
      const webpPath = path.join(outDir, `${name.file}.webp`);
      webp = await encode(painted.buffer, webpPath);
      if (encodedProblem(webp)) webp = await encode(painted.buffer, webpPath);
      fail = encodedProblem(webp);
      if (!fail) {
        staged.push({
          folio: name.folio,
          file: name.file,
          webpPath,
          kind: leaf.kind,
          index: firstIndex + staged.length,
          section,
          bytes: webp.length,
          width: PAGE_DEV_W,
          height: PAGE_DEV_H,
          cssWidth: PAGE_W,
          cssHeight: PAGE_CSS_H,
          hotspots: mapped[part] || [],
          degraded: Boolean(page.degraded),
          reason: page.reason || "",
          fallback: page.fallback || "",
          selector: page.selector || "",
          fit: pageFit(page),
          shrink: page.shrink ?? 1,
          bodyCss: Math.round(bodySpan(page)),
        });
      }
    }
    if (fail) Object.assign(row, { ok: false, reason: fail });
    else if (page.degraded) Object.assign(row, { degraded: true, fallback: page.fallback, reason: page.reason });
    if (page.degraded) say("DEGRADED", name.folio, page.selector || "", page.fallback || "", page.reason || "");
    say("PAGE", name.folio, `${PAGE_DEV_W}x${PAGE_DEV_H}`, `blank ${pageShot.blankRatio.toFixed(2)}`, rowStatus(row));
    report.push(row);
  }
  return { staged, report };
}

const baseFolio = (folio) => folio.replace(/ cont\.(?: \d+)?$/, "");
const LOSSY_A1 = new Set(["scale", "crop", "clip", "crop-right"]);

/**
 * Last gate before anything is uploaded. Refuses (ok false) on any FAIL row, a
 * folio with no page, A1 scaled or cropped (it is also the Telegram front), a
 * shrink or merge on A1 below A1_MIN_FIT, more than MAX_DEGRADED_SHARE of the
 * pages degraded, any page under MIN_FIT, or a near-empty page.
 */
export function publishVerdict({ leaves, report, staged }) {
  const reasons = [];
  const failures = report.filter((row) => !row.ok);
  if (failures.length) {
    reasons.push(`${failures.length} pages failed: ${failures.map((row) => `${row.folio}:${row.reason}`).join(", ")}`);
  }
  const covered = new Set(staged.map((page) => baseFolio(page.folio)));
  const missing = leaves.filter((leaf) => !covered.has(leaf.folio)).map((leaf) => leaf.folio);
  if (missing.length) reasons.push(`no page for ${missing.join(", ")}`);
  const degraded = staged.filter((page) => page.degraded);
  for (const page of degraded) {
    if (baseFolio(page.folio) !== "A1") continue;
    const used = String(page.fallback || "").split("+");
    const lossy = used.filter((fallback) => LOSSY_A1.has(fallback));
    const small = Math.min(Number(page.fit) || 1, Number(page.shrink) || 1);
    if (lossy.length) reasons.push(`front page ${page.folio} is ${lossy.join("+")}`);
    else if (small < A1_MIN_FIT) reasons.push(`front page ${page.folio} at ${small.toFixed(2)} (< ${A1_MIN_FIT})`);
  }
  if (staged.length && degraded.length / staged.length > MAX_DEGRADED_SHARE) {
    reasons.push(`${degraded.length} of ${staged.length} pages degraded (over ${Math.round(MAX_DEGRADED_SHARE * 100)}%)`);
  }
  const thin = staged.filter((page) => (Number(page.fit) || 1) < MIN_FIT);
  if (thin.length) reasons.push(`scaled under ${MIN_FIT}: ${thin.map((page) => page.folio).join(", ")}`);
  const near = staged.filter((page) => Number.isFinite(page.bodyCss) && page.bodyCss < NEAR_EMPTY_CSS);
  if (near.length) reasons.push(`near-empty: ${near.map((page) => `${page.folio} ${page.bodyCss}px`).join(", ")}`);
  return { ok: reasons.length === 0, reasons, degraded: degraded.length, pages: staged.length };
}

/** One-line GitHub Actions annotation, or null when nothing is degraded. */
export function degradedWarning(publishId, staged) {
  const degraded = staged.filter((page) => page.degraded);
  if (!degraded.length) return null;
  const list = degraded.map((page) => `${page.folio} ${page.fallback}`).join(", ");
  return `::warning title=Times flat print::${publishId}: ${degraded.length} of ${staged.length} pages degraded (${list})`;
}

export async function printFlatEdition() {
  const issueId = opt("issue") || process.env.ISSUE_ID;
  const publishId = opt("publish") || process.env.TIMES_FLAT_PUBLISH || issueId;
  if (!editionDate(issueId || "")) throw new Error("--issue 2026-10-07-evening is required");
  const outDir = opt("out") || process.env.TIMES_FLAT_OUT || path.resolve("times-flat-out", publishId);
  const config = await supabaseConfig();
  const { session, layout } = await loadSession(config);
  const projectRef = new URL(config.url).hostname.split(".")[0];
  await mkdir(outDir, { recursive: true });

  const { webkit } = await loadPlaywright();
  const browser = await webkit.launch();
  const shots = [];
  try {
    const context = await browser.newContext({
      viewport: IPAD13,
      deviceScaleFactor: DPR,
      isMobile: true,
      hasTouch: true,
      locale: "en-US",
      timezoneId: "America/Chicago",
      colorScheme: "light",
      userAgent:
        "Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1",
    });
    await harden(context);
    const init = sessionInit(projectRef, session, layout);
    await context.addInitScript(init.script, init.arg);
    const page = await context.newPage();
    const at = instantFor(issueId);
    if (at && pressIdAt(new Date()) !== issueId) {
      log("pinning clock", at.toISOString());
      await page.clock.setFixedTime(at);
    }
    await page.goto(`${APP}/newspaper?solo=1&edition=${encodeURIComponent(issueId)}`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    if (new URL(page.url()).pathname.startsWith("/login")) throw new Error("landed on /login");
    await reveal(page);
    let folioCount = 0;
    {
      let last = "";
      let quiet = Date.now();
      const start = Date.now();
      while (Date.now() - start < 45_000) {
        const snap = await page.evaluate(() => String(document.querySelectorAll(".wsj-page").length));
        if (snap !== last) {
          last = snap;
          quiet = Date.now();
          log("settling", snap, "folios");
        }
        const n = Number(snap);
        if (n > 3 && Date.now() - quiet > 8_000) break;
        await page.waitForTimeout(400);
      }
      folioCount = Number(last) || 0;
    }
    log("folio count settled", folioCount);
    const leaves = await page.evaluate(() =>
      [...document.querySelectorAll(".wsj-page")].map((el) => ({
        folio: el.getAttribute("data-folio") || "",
        kind: el.getAttribute("data-kind") || "",
      })),
    );
    if (!leaves.length) throw new Error("no folios");
    log("folios", leaves.length);
    log("publish", publishId);

    const printedAt = new Date().toISOString();
    const version = String(Date.parse(printedAt));
    const report = [];
    const staged = [];
    let failedSheets = 0;
    for (let i = 0; i < leaves.length; i++) {
      const leaf = leaves[i];
      const pngPath = path.join(outDir, `${leaf.folio}.png`);
      let shot = null;
      let reason = "no sheet";
      for (let attempt = 1; attempt <= PAGE_TRIES; attempt++) {
        if (attempt > 1) log("retry", leaf.folio, attempt, reason);
        await primePage(page, i);
        const ready = await waitForSheet(page, i, SHEET_WAIT_MS);
        log(
          "sheet",
          leaf.folio,
          "attempt",
          attempt,
          "css",
          Math.round(ready.h || 0),
          ready.stable ? "stable" : "moving",
          "images",
          ready.pending || 0,
          ready.ok ? "content" : "shell",
        );
        const next = await captureSheet(page, i, pngPath);
        if (!next || next.missing) {
          // An earlier attempt's pixels stay the fallback.
          reason = next?.missing || "no sheet";
          continue;
        }
        shot = next;
        const sheetVerdict = judgeSheet(shot);
        if (!sheetVerdict.ok) {
          reason = sheetVerdict.reason;
          if (shot.pastDetail) log("past right", shot.pastDetail);
          shot.reject = sheetVerdict.reason;
          continue;
        }
        const laid = layoutSheet(shot.contentHeight, shot.pieces, PAGE_CSS_H);
        if (!laid.ok) {
          reason = laid.reason || "layout";
          shot.reject = reason;
          continue;
        }
        reason = "ok";
        break;
      }
      if (shot?.buffer && shot.pastRight) {
        log("shrink", leaf.folio, shot.pastDetail || "");
        const wide = await captureSheet(page, i, pngPath, { shrink: MIN_FIT });
        if (wide?.buffer && planSheet(wide).ok) {
          shot = wide;
          log("shrunk", leaf.folio, (wide.shrunk || []).map((box) => `${box.sel} ${box.fit}`).join(", ") || "none");
        }
      }
      const plan = shot?.buffer ? planSheet(shot) : { ok: false, reason: shot?.reject || reason, pages: [] };
      if (!plan.ok) {
        report.push({
          folio: leaf.folio,
          cssHeight: shot ? Math.round(shot.contentHeight) : 0,
          blankRatio: shot ? shot.blankRatio : 1,
          ok: false,
          reason: plan.reason,
        });
        log("HEIGHT", leaf.folio, "FAIL", plan.reason);
        failedSheets += 1;
        if (i === 2 && failedSheets === 3) {
          const why = report.map((row) => `${row.folio}:${row.reason}`).join(", ");
          throw new Error(`stopped after the first 3 sheets failed (${why})`);
        }
        if (shot) shot.buffer = null;
        continue;
      }
      if (plan.salvaged) log("salvage", leaf.folio, shot.reject || "", plan.pages.map((item) => item.fallback || "cut").join(","));
      log(
        "HEIGHT",
        leaf.folio,
        `content ${Math.round(shot.contentHeight)}`,
        `captured ${Math.round(shot.capturedHeight)}`,
        `${plan.pages.length} pages`,
      );
      const spots = await hotspots(page, i);
      const done = await renderSheet({ leaf, shot, plan, spots, outDir, firstIndex: staged.length });
      report.push(...done.report);
      staged.push(...done.staged);
      shot.buffer = null;
      await unlink(pngPath).catch(() => {});
    }
    await page.close();
    await context.close();
    const heightLines = report.map(heightLine);
    await writeFile(path.join(outDir, "heights.txt"), `${heightLines.join("\n")}\n`);
    const degradedCount = staged.filter((item) => item.degraded).length;
    log(`page heights (${report.length} rows, ${degradedCount} degraded):\n${heightLines.join("\n")}`);
    const warning = degradedWarning(publishId, staged);
    if (warning) console.log(warning);
    const token = session.access_token;
    const verdict = publishVerdict({ leaves, report, staged });
    if (!verdict.ok) {
      // Nothing else from this run goes to storage, so the edition's last good
      // manifest and its images still stand. With no manifest yet, a clean A1
      // still goes up for the Telegram front, as before.
      const front = staged.find((item) => item.file === "A1" && !item.degraded);
      if (front && !(await manifestPublished(config, publishId))) {
        await uploadObject(config, token, `${publishId}/A1.webp`, await readFile(front.webpPath), "image/webp", IMAGE_CACHE);
        log("A1 on storage for the Telegram alert (manifest withheld)");
      }
      await prune(config, token).catch((err) => log("prune", err.message));
      throw new Error(`manifest withheld: ${verdict.reasons.join("; ")}`);
    }
    for (const item of staged) {
      await uploadObject(config, token, `${publishId}/${item.file}.webp`, await readFile(item.webpPath), "image/webp", IMAGE_CACHE);
      if (item.file === "A1") log("A1 on storage for the Telegram alert");
    }
    const manifest = buildFlatManifest({
      issueId: publishId,
      printedAt,
      pages: staged.map((item) => ({
        ...item,
        url: `/times-flat/${publishId}/${item.file}.webp?v=${version}`,
      })),
    });
    const manifestPath = path.join(outDir, "manifest.json");
    await writeFile(manifestPath, JSON.stringify(manifest));
    await uploadObject(config, token, `${publishId}/manifest.json`, await readFile(manifestPath), "application/json", MANIFEST_CACHE);
    const total = staged.reduce((sum, item) => sum + item.bytes, 0);
    log("uploaded", publishId, staged.length, "pages", degradedCount, "degraded", total, "bytes");
    log("manifest", `${config.url}/storage/v1/object/public/${BUCKET}/${publishId}/manifest.json`);
    await prune(config, token);
    return manifest;
  } finally {
    await browser.close();
  }
}

async function manifestPublished(config, issueId) {
  try {
    const res = await fetch(`${config.url}/storage/v1/object/public/${BUCKET}/${issueId}/manifest.json?t=${Date.now()}`, {
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return true;
  }
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) {
  printFlatEdition().catch((err) => {
    console.error(`[times-flat] ${err.message}`);
    process.exit(1);
  });
}
