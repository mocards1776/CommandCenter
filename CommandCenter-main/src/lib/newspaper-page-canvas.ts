/**
 * One broadsheet canvas. Every folio is this size and never taller.
 * Overflow drops the lowest-priority [data-tt-trim] items; leftover
 * paper is filled by the sheet flex, not by growing the page.
 */

export const PAGE_CANVAS_W = 1040;
export const PAGE_CANVAS_H = 1480;

export type TrimCandidate = {
  id: string;
  /** Higher number drops first. */
  priority: number;
  height: number;
};

/** Which items to cut so `overflow` px come off the bottom of the page. */
export function chooseOverflowCuts(items: TrimCandidate[], overflow: number): string[] {
  if (overflow <= 0 || !items.length) return [];
  const ranked = [...items].sort((a, b) => b.priority - a.priority || a.height - b.height);
  const cut: string[] = [];
  let left = overflow;
  for (const item of ranked) {
    if (left <= 0) break;
    cut.push(item.id);
    left -= Math.max(1, item.height);
  }
  return cut;
}

export function measureSheetOverflow(scrollHeight: number, canvasH = PAGE_CANVAS_H): number {
  return Math.max(0, Math.ceil(scrollHeight - canvasH));
}

function mark(el: HTMLElement, on: boolean) {
  if (on) el.setAttribute("data-tt-trimmed", "");
  else el.removeAttribute("data-tt-trimmed");
}

/** Hide a day header / list wrap once every trimmable child is gone. */
export function hideOrphanTrimBlocks(root: HTMLElement) {
  for (const day of root.querySelectorAll<HTMLElement>(".tt-cfb-day")) {
    let n = day.nextElementSibling;
    let open = false;
    while (n && !n.classList.contains("tt-cfb-day")) {
      if (n instanceof HTMLElement && n.matches("[data-tt-trim]") && !n.hasAttribute("data-tt-trimmed")) {
        open = true;
        break;
      }
      n = n.nextElementSibling;
    }
    mark(day, !open);
  }
  for (const wrap of root.querySelectorAll<HTMLElement>(
    ".tt-lleaders-cat, .wsj-briefs-wrap, .tt-results, .tt-front-rail, .wsj-rail-block, .tt-wrap-band, .tt-ahead, .tt-stars-wrap",
  )) {
    const kids = [...wrap.querySelectorAll<HTMLElement>("[data-tt-trim]")];
    if (!kids.length) continue;
    mark(wrap, kids.every((el) => el.hasAttribute("data-tt-trimmed")));
  }
}

export function resetSheetTrim(sheet: HTMLElement) {
  sheet.removeAttribute("data-tt-tight");
  for (const el of sheet.querySelectorAll<HTMLElement>("[data-tt-trimmed]")) {
    el.removeAttribute("data-tt-trimmed");
  }
}

/** Cut lowest-priority items until the sheet is no taller than the canvas. */
export function fitSheetToCanvas(sheet: HTMLElement, canvasH = PAGE_CANVAS_H): {
  cut: number;
  overflow: number;
} {
  let cut = 0;
  let guard = 80;
  if (sheet.scrollHeight > canvasH + 0.5) sheet.setAttribute("data-tt-tight", "");
  while (sheet.scrollHeight > canvasH + 0.5 && guard--) {
    const next = [...sheet.querySelectorAll<HTMLElement>("[data-tt-trim]:not([data-tt-trimmed])")]
      .filter((el) => el.offsetHeight > 0)
      .sort((a, b) => Number(b.dataset.ttTrim || 0) - Number(a.dataset.ttTrim || 0))[0];
    if (!next) break;
    mark(next, true);
    hideOrphanTrimBlocks(sheet);
    cut++;
  }
  if (sheet.scrollHeight > canvasH + 0.5) sheet.setAttribute("data-tt-tight", "");
  else sheet.removeAttribute("data-tt-tight");
  while (sheet.scrollHeight > canvasH + 0.5 && guard--) {
    const extras = [...sheet.querySelectorAll<HTMLElement>(".wsj-prose p, .wsj-dek, .tt-nat-copy p, .tt-mo-dek, .tt-wrap-copy")].filter(
      (el) => !el.hasAttribute("data-tt-trimmed") && el.offsetHeight > 0,
    );
    const last = extras[extras.length - 1];
    if (!last) break;
    mark(last, true);
    cut++;
  }
  return { cut, overflow: measureSheetOverflow(sheet.scrollHeight, canvasH) };
}
