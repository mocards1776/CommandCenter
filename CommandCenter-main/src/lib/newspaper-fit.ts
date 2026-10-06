import { dropLastSentence } from "./newspaper-copy";

const COPY_SEL = ".wsj-prose p, .wsj-dek, .wsj-brief-dek, .tt-under-story p";

/**
 * Soft pack target: compose to one newspaper page. The sheet may grow to
 * HARD_PAGE_H only to keep a sentence intact. Whole blocks marked
 * [data-tt-flow] then continue on the next folio instead of stretching.
 */
export const SOFT_PAGE_H = 1480;
export const HARD_PAGE_H = 1650;
const FLOW_SEL = "[data-tt-flow]";

function isVerticalClip(overflow: string, overflowY: string): boolean {
  return overflow === "hidden" || overflowY === "hidden" || overflowY === "clip";
}

function clipBottom(el: HTMLElement): number {
  let limit = Infinity;
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const s = getComputedStyle(node);
    // Dynamic sheets use overflow-x: clip and may grow; never treat the sheet as a vertical cap.
    if (!node.classList.contains("wsj-sheet") && isVerticalClip(s.overflow, s.overflowY)) {
      limit = Math.min(limit, node.getBoundingClientRect().bottom);
    }
    node = node.parentElement;
  }
  const folio = el.closest(".wsj-sheet")?.querySelector(".wsj-folio");
  if (folio) limit = Math.min(limit, folio.getBoundingClientRect().top);
  return limit;
}

function softTargetBottom(el: HTMLElement): number | null {
  const sheet = el.closest(".wsj-sheet");
  if (!sheet) return null;
  const zoom = Number.parseFloat(getComputedStyle(sheet).zoom || "1") || 1;
  return sheet.getBoundingClientRect().top + SOFT_PAGE_H * zoom;
}

function overflowsClip(el: HTMLElement): boolean {
  const box = el.getBoundingClientRect();
  const hard = clipBottom(el);
  if (Number.isFinite(hard) && box.bottom > hard + 6) return true;
  const soft = softTargetBottom(el);
  if (soft != null && box.bottom > soft + 6) return true;
  if (!Number.isFinite(hard) && soft == null) return el.scrollHeight > el.clientHeight + 6;
  return false;
}

function restoreFlow(root: HTMLElement): void {
  for (const node of root.querySelectorAll<HTMLElement>(`${FLOW_SEL}, [data-tt-flowed]`)) {
    node.hidden = false;
    delete node.dataset.ttFlowed;
  }
}

const PACK_ROOTS = ".wsj-front, .tt-section-front, .tt-scores, .wsj-sport-solo, .wx, .tt-stand-grid, .wsj-clubs-desk";

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
        node instanceof HTMLElement && !node.hidden && node.getAttribute("data-tt-keep") == null,
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
 * clipping column, the folio, or the soft 1480 pack target. Whole extra
 * blocks marked [data-tt-flow] hide past HARD_PAGE_H so they can run on
 * the next section folio instead of stretching this sheet.
 */
let fitting = false;
export function fitSentencesIn(root: HTMLElement): void {
  if (fitting) return;
  fitting = true;
  try {
    restoreFlow(root);
    const nodes = [...root.querySelectorAll<HTMLElement>(COPY_SEL)];
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
