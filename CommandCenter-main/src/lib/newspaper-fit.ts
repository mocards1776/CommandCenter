import { dropLastSentence } from "./newspaper-copy";
import { PAGE_SOFT_CAP_H, PAGE_TARGET_H } from "./newspaper-page";

const COPY_SEL = ".wsj-prose p, .wsj-dek, .wsj-brief-dek, .tt-under-story p";

/**
 * Pack toward 1480. Grow only to 1650 to keep the last sentence of a
 * story. Anything past the cap is leftover for the next folio — never hidden.
 */
const SOFT_PAGE_H = PAGE_TARGET_H;
const SOFT_CAP_H = PAGE_SOFT_CAP_H;

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

function sheetZoom(el: HTMLElement): number {
  const sheet = el.closest(".wsj-sheet");
  return Number.parseFloat(getComputedStyle(sheet ?? el).zoom || "1") || 1;
}

function softLimitBottom(el: HTMLElement, height: number): number | null {
  const sheet = el.closest(".wsj-sheet");
  if (!sheet) return null;
  return sheet.getBoundingClientRect().top + height * sheetZoom(el);
}

function overflowsLimit(el: HTMLElement, height: number): boolean {
  const box = el.getBoundingClientRect();
  const hard = clipBottom(el);
  if (Number.isFinite(hard) && box.bottom > hard + 6) return true;
  const soft = softLimitBottom(el, height);
  if (soft != null && box.bottom > soft + 6) return true;
  if (!Number.isFinite(hard) && soft == null) return el.scrollHeight > el.clientHeight + 6;
  return false;
}

/**
 * Restore full copy, then drop trailing sentences past the 1650 cap.
 * Between 1480 and 1650 keep the last sentence so a story is not cut.
 * Leftover copy is never clipped out of view.
 */
let fitting = false;
export function fitSentencesIn(root: HTMLElement): void {
  if (fitting) return;
  fitting = true;
  try {
    const nodes = [...root.querySelectorAll<HTMLElement>(COPY_SEL)];
    for (const node of nodes) {
      if (node.dataset.fitFull == null) node.dataset.fitFull = node.textContent ?? "";
      if (node.textContent !== node.dataset.fitFull) node.textContent = node.dataset.fitFull;
    }
    let guard = 120;
    while (guard--) {
      const overCap = [...nodes].reverse().find((node) => (node.textContent ?? "").trim() && overflowsLimit(node, SOFT_CAP_H));
      const overTarget = [...nodes].reverse().find((node) => (node.textContent ?? "").trim() && overflowsLimit(node, SOFT_PAGE_H));
      const hit = overCap ?? overTarget;
      if (!hit) break;
      const next = dropLastSentence(hit.textContent ?? "");
      if (next === hit.textContent) break;
      if (!overCap && !next.trim()) break;
      hit.textContent = next;
    }
  } finally {
    fitting = false;
  }
}
