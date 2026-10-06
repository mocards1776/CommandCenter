import { dropLastSentence } from "./newspaper-copy";

const COPY_SEL = ".wsj-prose p, .wsj-dek, .wsj-brief-dek, .tt-under-story p";

function clipBottom(el: HTMLElement): number {
  let limit = Infinity;
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const s = getComputedStyle(node);
    if (s.overflow === "hidden" || s.overflowY === "hidden") {
      limit = Math.min(limit, node.getBoundingClientRect().bottom);
    }
    node = node.parentElement;
  }
  const folio = el.closest(".wsj-sheet")?.querySelector(".wsj-folio");
  if (folio) limit = Math.min(limit, folio.getBoundingClientRect().top);
  return limit;
}

function overflowsClip(el: HTMLElement): boolean {
  const limit = clipBottom(el);
  if (Number.isFinite(limit)) return el.getBoundingClientRect().bottom > limit + 1;
  return el.scrollHeight > el.clientHeight + 1;
}

/**
 * Restore full copy, then drop the last sentence that does not fit the
 * clipping column or the folio. Leftover space stays empty.
 */
export function fitSentencesIn(root: HTMLElement): void {
  const nodes = [...root.querySelectorAll<HTMLElement>(COPY_SEL)];
  for (const node of nodes) {
    if (node.dataset.fitFull == null) node.dataset.fitFull = node.textContent ?? "";
    node.textContent = node.dataset.fitFull;
  }
  let guard = 80;
  while (guard--) {
    const hit = [...nodes].reverse().find((node) => (node.textContent ?? "").trim() && overflowsClip(node));
    if (!hit) break;
    hit.textContent = dropLastSentence(hit.textContent ?? "");
  }
}
