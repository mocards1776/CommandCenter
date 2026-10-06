import { dropLastSentence } from "./newspaper-copy.ts";

const COPY_SEL = ".wsj-prose p, .wsj-dek, .wsj-brief-dek, .tt-under-story p";

/**
 * Soft pack target: compose to one newspaper page. The sheet may grow to
 * HARD_PAGE_H only to keep a sentence intact. Whole blocks marked
 * [data-tt-flow] then continue on the next folio instead of stretching.
 */
export const SOFT_PAGE_H = 1480;
export const HARD_PAGE_H = 1650;
const FLOW_SEL = "[data-tt-flow]";

export function sheetZoom(sheet: Element): number {
  const z = Number.parseFloat(getComputedStyle(sheet).zoom || "1");
  return Number.isFinite(z) && z > 0 ? z : 1;
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

function overflowsClip(el: HTMLElement): boolean {
  const sheet = el.closest(".wsj-sheet");
  if (!sheet) return el.scrollHeight > el.clientHeight + 6;
  // scrollHeight is the unzoomed layout size, so 768 and 1280 pack the same
  // 1032-wide sheet. getBoundingClientRect follows CSS zoom and the viewport.
  return sheet.scrollHeight > SOFT_PAGE_H + 6;
}

function restoreFlow(root: HTMLElement): void {
  for (const node of root.querySelectorAll<HTMLElement>(`${FLOW_SEL}, [data-tt-flowed]`)) {
    node.hidden = false;
    delete node.dataset.ttFlowed;
  }
}

const PACK_ROOTS = ".wsj-front, .tt-section-front, .tt-scores, .wsj-sport-solo, .wx, .tt-stand-grid";
const KEEP_COPY = "[data-tt-lead], [data-tt-keep]";

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
  while (guard-- && sheet.scrollHeight > HARD_PAGE_H + 8) {
    if (!hideLastPackChild(root)) break;
  }
}

/**
 * Restore full copy, then drop the last sentence that does not fit the
 * soft 1480 pack target. Whole extra blocks marked [data-tt-flow] hide past
 * HARD_PAGE_H so they can run on the next section folio instead of stretching
 * this sheet. Packing uses unzoomed sheet coordinates so 768 and 1280 compose
 * the same folio when the sheet is 1032 CSS px wide.
 */
let fitting = false;
export function fitSentencesIn(root: HTMLElement): void {
  if (fitting) return;
  fitting = true;
  try {
    restoreFlow(root);
    const nodes = [...root.querySelectorAll<HTMLElement>(COPY_SEL)].filter(
      (node) => !node.closest(KEEP_COPY),
    );
    for (const node of nodes) {
      if (node.dataset.fitFull == null) node.dataset.fitFull = node.textContent ?? "";
      if (node.textContent !== node.dataset.fitFull) node.textContent = node.dataset.fitFull;
    }
    let guard = 80;
    while (guard--) {
      const hit = [...nodes].reverse().find((node) => (node.textContent ?? "").trim() && overflowsClip(node));
      if (!hit) break;
      const next = dropLastSentence(hit.textContent ?? "");
      if (next === hit.textContent) break;
      hit.textContent = next;
    }
    hideOverflowBlocks(root);
  } finally {
    fitting = false;
  }
}
