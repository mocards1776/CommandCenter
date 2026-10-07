import { dropLastSentence } from "./newspaper-copy.ts";

const COPY_SEL = ".wsj-prose p, .wsj-dek, .wsj-brief-dek, .tt-under-story p, .tt-wrap-copy";

/**
 * Soft pack target: compose to one newspaper page. The sheet may grow to
 * HARD_PAGE_H only to keep a sentence intact. Whole extra blocks marked
 * [data-tt-flow] then continue on the next folio instead of stretching.
 */
export const SOFT_PAGE_H = 1480;
export const HARD_PAGE_H = 1650;
const FLOW_SEL = "[data-tt-flow]";
const PACK_ROOTS = ".wsj-front, .tt-section-front, .tt-scores, .wsj-sport-solo, .wx, .tt-stand-grid";
const KEEP_COPY = "[data-tt-lead], [data-tt-keep]";

export type SheetFitPlan = {
  /** nth-child paths from the sheet, e.g. ":nth-child(3) > :nth-child(1)" */
  hide: string[];
  cuts: Record<string, string>;
};

export const EMPTY_FIT_PLAN: SheetFitPlan = { hide: [], cuts: {} };

export function sheetZoom(sheet: Element): number {
  const z = Number.parseFloat(getComputedStyle(sheet).zoom || "1");
  return Number.isFinite(z) && z > 0 ? z : 1;
}

/** Width-only fit. LOCKED: never add a height term. */
export function pageFit(viewportW: number, pageW = 1032): number {
  if (!(pageW > 0) || !(viewportW > 0)) return 1;
  return Math.min(1, viewportW / pageW);
}

/**
 * Whether the iPad scale wrapper must be rewritten.
 * An unchanged layout height must not clear `transform` (that flash was the
 * sheet disappearing). A remount that collapses the sheet under 80px must
 * not lock the wrapper shut either.
 */
export function fitMeasureNeeded(prevLayoutH: number, layoutH: number, prevFit: number, fit: number): boolean {
  if (!(layoutH > 0)) return false;
  if (prevLayoutH > 80 && layoutH < 80) return false;
  if (prevLayoutH === layoutH && prevFit === fit) return false;
  return true;
}

/** Visual box of a scaled 1032-wide sheet. Wrapper height must match this or iOS leaves a white void. */
export function scaledFitBox(pageW: number, sheetH: number, fit: number): { width: number; height: number } {
  const f = fit > 0 ? fit : 1;
  return { width: pageW * f, height: Math.max(0, sheetH) * f };
}

/** Unzoomed sheet height. scrollHeight wins when overflow is clipped by a stale wrapper. */
export function sheetLayoutHeight(sheet: { offsetHeight: number; scrollHeight: number }): number {
  return Math.max(sheet.offsetHeight, sheet.scrollHeight);
}

/** iPad / no-zoom-layout: use transform:scale and a height-corrected wrapper. */
export function sheetNeedsTransformFit(
  ua = typeof navigator === "undefined" ? "" : navigator.userAgent,
  opts?: { maxTouchPoints?: number; platform?: string; zoomShrinksLayout?: boolean; supportsZoom?: boolean },
): boolean {
  const touch = opts?.maxTouchPoints ?? (typeof navigator === "undefined" ? 0 : navigator.maxTouchPoints);
  const platform = opts?.platform ?? (typeof navigator === "undefined" ? "" : navigator.platform);
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  if (platform === "MacIntel" && touch > 1) return true;
  if (opts?.supportsZoom === false) return true;
  if (opts?.zoomShrinksLayout === false) return true;
  if (opts?.zoomShrinksLayout === true || opts?.supportsZoom === true) return false;
  if (typeof document === "undefined") return false;
  try {
    if (typeof CSS !== "undefined" && CSS.supports && !CSS.supports("zoom", "1")) return true;
  } catch {
    /* ignore */
  }
  const probe = document.createElement("div");
  probe.style.cssText = "width:100px;height:100px;zoom:0.5;position:absolute;left:-9999px;visibility:hidden;pointer-events:none";
  document.body.appendChild(probe);
  const layout = probe.offsetHeight;
  probe.remove();
  return layout > 90;
}

/** Size the fit wrapper to the visual sheet when using transform:scale (not CSS zoom). */
export function applyScaledFitBox(
  fitBox: HTMLElement,
  sheet: HTMLElement,
  pageW: number,
  fit: number,
  useTransform: boolean,
): void {
  if (!useTransform || fit >= 1) {
    fitBox.classList.remove("tt-fit-transform");
    fitBox.style.width = "";
    fitBox.style.height = "";
    fitBox.style.overflow = "";
    sheet.style.transform = "";
    sheet.style.transformOrigin = "";
    return;
  }
  fitBox.classList.add("tt-fit-transform");
  // Measure the unscaled sheet, then lock the wrapper to the visual box.
  // A stale overflow:hidden height makes offsetHeight lie; transform makes
  // scrollHeight balloon. Clear both before reading.
  sheet.style.transform = "none";
  fitBox.style.height = "auto";
  fitBox.style.overflow = "visible";
  const box = scaledFitBox(pageW, sheetLayoutHeight(sheet), fit);
  const nextW = `${box.width}px`;
  const nextH = `${box.height}px`;
  sheet.style.transform = `scale(${fit})`;
  sheet.style.transformOrigin = "top left";
  if (fitBox.style.width !== nextW) fitBox.style.width = nextW;
  if (fitBox.style.height !== nextH) fitBox.style.height = nextH;
  fitBox.style.overflow = "hidden";
}

/** Convert a zoomed viewport distance into unzoomed sheet CSS pixels. */
export function unzoomedPx(zoomedPx: number, zoom: number): number {
  const z = zoom > 0 ? zoom : 1;
  return zoomedPx / z;
}

/** Element bottom in unzoomed sheet coordinates (0 at the sheet top). */
export function sheetLocalBottom(el: HTMLElement, sheet: Element): number {
  const zoom = sheetZoom(sheet);
  return unzoomedPx(el.getBoundingClientRect().bottom - sheet.getBoundingClientRect().top, zoom);
}

export function plansEqual(a: SheetFitPlan, b: SheetFitPlan): boolean {
  if (a.hide.length !== b.hide.length) return false;
  const hideA = [...a.hide].sort();
  const hideB = [...b.hide].sort();
  if (hideA.some((id, i) => id !== hideB[i])) return false;
  const keysA = Object.keys(a.cuts);
  const keysB = Object.keys(b.cuts);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => a.cuts[key] === b.cuts[key]);
}

export function childPath(el: HTMLElement, root: HTMLElement): string | null {
  const parts: string[] = [];
  let node: HTMLElement | null = el;
  while (node && node !== root) {
    const parent: HTMLElement | null = node.parentElement;
    if (!parent) return null;
    const idx = [...parent.children].indexOf(node);
    if (idx < 0) return null;
    parts.unshift(`:nth-child(${idx + 1})`);
    node = parent;
  }
  return node === root && parts.length ? parts.join(" > ") : null;
}

function overflowsClip(el: HTMLElement): boolean {
  const sheet = el.closest(".wsj-sheet");
  if (!sheet) return el.scrollHeight > el.clientHeight + 6;
  return sheet.scrollHeight > SOFT_PAGE_H + 6;
}

function restoreFlow(root: HTMLElement): void {
  for (const node of root.querySelectorAll<HTMLElement>(`${FLOW_SEL}, [data-tt-flowed]`)) {
    node.hidden = false;
    delete node.dataset.ttFlowed;
  }
}

function hideLastPackChild(root: HTMLElement): boolean {
  const flow = [...root.querySelectorAll<HTMLElement>(FLOW_SEL)].reverse().find((node) => !node.hidden);
  if (flow) {
    flow.hidden = true;
    flow.dataset.ttFlowed = "1";
    return true;
  }
  for (const pack of root.querySelectorAll<HTMLElement>(PACK_ROOTS)) {
    const kids = [...pack.children].reverse().filter(
      (node): node is HTMLElement =>
        node instanceof HTMLElement &&
        !node.hidden &&
        node.getAttribute("data-tt-keep") == null &&
        node.getAttribute("data-tt-lead") == null,
    );
    if (kids.length > 1) {
      kids[0]!.hidden = true;
      kids[0]!.dataset.ttFlowed = "1";
      return true;
    }
  }
  return false;
}

function hideOverflowBlocks(root: HTMLElement): void {
  const sheet = root.closest(".wsj-sheet") ?? root;
  let guard = 24;
  while (guard-- && sheet.scrollHeight > HARD_PAGE_H) {
    if (!hideLastPackChild(root)) break;
  }
}

function restoreCopy(root: HTMLElement): HTMLElement[] {
  const nodes = [...root.querySelectorAll<HTMLElement>(COPY_SEL)].filter((node) => !node.closest(KEEP_COPY));
  for (const node of nodes) {
    if (node.dataset.fitFull == null) node.dataset.fitFull = node.textContent ?? "";
    if (node.textContent !== node.dataset.fitFull) node.textContent = node.dataset.fitFull;
  }
  return nodes;
}

/** Mutates a detached clone only. Never call on a React-owned sheet. */
function fitClone(root: HTMLElement): void {
  restoreFlow(root);
  const nodes = restoreCopy(root);
  let guard = 80;
  while (guard--) {
    const hit = [...nodes].reverse().find((node) => (node.textContent ?? "").trim() && overflowsClip(node));
    if (!hit) break;
    const next = dropLastSentence(hit.textContent ?? "");
    if (next === hit.textContent) break;
    hit.textContent = next;
  }
  hideOverflowBlocks(root);
}

function readPlan(root: HTMLElement): SheetFitPlan {
  const hide: string[] = [];
  for (const node of root.querySelectorAll<HTMLElement>("[data-tt-flowed], [hidden]")) {
    if (!node.hidden && !node.dataset.ttFlowed) continue;
    const path = childPath(node, root);
    if (path) hide.push(path);
  }
  const cuts: Record<string, string> = {};
  for (const node of root.querySelectorAll<HTMLElement>("[data-tt-cid]")) {
    const cid = node.dataset.ttCid;
    const full = node.dataset.fitFull ?? "";
    const text = node.textContent ?? "";
    if (cid && full && text !== full) cuts[cid] = text;
  }
  return { hide, cuts };
}

let measureHost: HTMLDivElement | null = null;

function getMeasureHost(): HTMLDivElement {
  if (measureHost?.isConnected) return measureHost;
  const el = document.createElement("div");
  el.dataset.ttFitHost = "1";
  el.setAttribute("aria-hidden", "true");
  el.style.cssText = "position:absolute;left:-10000px;top:0;visibility:hidden;pointer-events:none;";
  document.body.appendChild(el);
  measureHost = el;
  return el;
}

function attachMeasureClone(live: HTMLElement): HTMLElement {
  const clone = live.cloneNode(true) as HTMLElement;
  clone.dataset.ttFitClone = "1";
  for (const node of clone.querySelectorAll("style")) node.remove();
  const width = live.clientWidth || live.offsetWidth || 1032;
  const cs = getComputedStyle(live);
  clone.style.cssText = [
    "position:absolute",
    "left:0",
    "top:0",
    `width:${width}px`,
    `zoom:${cs.zoom || "1"}`,
  ].join(";");
  const fit = cs.getPropertyValue("--tt-fit");
  const pageW = cs.getPropertyValue("--tt-page-w");
  if (fit) clone.style.setProperty("--tt-fit", fit);
  if (pageW) clone.style.setProperty("--tt-page-w", pageW);
  getMeasureHost().appendChild(clone);
  return clone;
}

/**
 * Measure packing on a detached clone. The live React tree is not written —
 * hide/cut come back as a plan for React to apply.
 */
export function planSheetFit(live: HTMLElement): SheetFitPlan {
  if (!live.isConnected) return EMPTY_FIT_PLAN;
  const clone = attachMeasureClone(live);
  try {
    fitClone(clone);
    return readPlan(clone);
  } finally {
    clone.remove();
  }
}

/**
 * Live sheets must not call this. It only packs a clone marked
 * `data-tt-fit-clone`. React owns the printed tree.
 */
export function fitSentencesIn(root: HTMLElement): void {
  if (root.dataset.ttFitClone !== "1") return;
  fitClone(root);
}

export function hideCssForPlan(sheetId: string, plan: SheetFitPlan): string {
  if (!plan.hide.length) return "";
  const root = `[data-tt-sheet="${sheetId}"]`;
  return plan.hide.map((path) => `${root} > ${path}{display:none!important}`).join("");
}

/** Prefetch art without touching React-owned <img> nodes. */
export function prefetchSrc(src: string | null | undefined): void {
  if (!src || src.startsWith("data:")) return;
  const img = new Image();
  img.decoding = "async";
  img.src = src;
}
