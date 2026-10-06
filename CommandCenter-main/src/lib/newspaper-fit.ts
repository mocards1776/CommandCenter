import { dropLastSentence } from "./newspaper-copy";

const COPY_SEL = ".wsj-prose p, .wsj-dek, .wsj-brief-dek, .tt-under-story p";

/**
 * Soft pack target from the #326 folio lock. Not a clip: if copy still
 * does not fit after dropping sentences, the sheet grows and nothing is hidden.
 * Global 1480/1650 continuation is #329 — this file stays on main's fitter.
 */
const SOFT_PAGE_H = 1480;

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

/**
 * Restore full copy, then drop the last sentence that does not fit the
 * clipping column, the folio, or the soft 1480 pack target. Leftover
 * space stays empty; leftover copy is never clipped out of view.
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
    let guard = 80;
    while (guard--) {
      const hit = [...nodes].reverse().find((node) => (node.textContent ?? "").trim() && overflowsClip(node));
      if (!hit) break;
      const next = dropLastSentence(hit.textContent ?? "");
      if (next === hit.textContent) break;
      hit.textContent = next;
    }
  } finally {
    fitting = false;
  }
}
