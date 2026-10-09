/**
 * Open the Times as a finished document: one hold, then the whole paper.
 */

/** Once the edition is set, the cover waits at most this long for fonts and A1's pictures. */
export const REVEAL_CAP_MS = 1_500;
export const COMPANION_WAIT_MS = 3_000;
/** While the Times is visible, look for a newly ready press. */
export const ISSUE_POLL_MS = 120_000;
export const ATF_PAGES = 1;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Resolve with `fallback` if `task` has not settled. The original work is not cancelled. */
export async function withDeadline<T>(task: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([task, sleep(ms).then(() => fallback)]);
}

function pageIndexOf(img: Element): number {
  const page = img.closest(".wsj-page");
  const pager = page?.parentElement;
  if (!page || !pager) return -1;
  return [...pager.children].indexOf(page);
}

/** Images on the first view (A1 and the next folio), not the whole book. */
export function aboveFoldImages(root: ParentNode, pages = ATF_PAGES): HTMLImageElement[] {
  return [...root.querySelectorAll("img")].filter((img) => {
    const idx = pageIndexOf(img);
    return idx >= 0 && idx < pages;
  });
}

export async function decodeImage(img: HTMLImageElement): Promise<void> {
  if (img.complete && img.naturalWidth) {
    try {
      await img.decode();
    } catch {
      /* a broken file still occupies its box */
    }
    return;
  }
  await new Promise<void>((resolve) => {
    const done = () => {
      img.removeEventListener("load", done);
      img.removeEventListener("error", done);
      resolve();
    };
    img.addEventListener("load", done);
    img.addEventListener("error", done);
  });
  try {
    if (img.naturalWidth) await img.decode();
  } catch {
    /* printed without this cut */
  }
}

export async function waitForFonts(capMs: number): Promise<void> {
  const fonts = document.fonts;
  if (!fonts?.ready) return;
  await Promise.race([fonts.ready.catch(() => undefined), sleep(capMs)]);
}

export async function waitForAboveFoldImages(root: ParentNode | null, capMs: number): Promise<void> {
  if (!root || capMs <= 0) return;
  const imgs = aboveFoldImages(root);
  if (!imgs.length) return;
  await Promise.race([Promise.all(imgs.map(decodeImage)), sleep(capMs)]);
}

/**
 * Fonts and A1's pictures, together. Always resolves by `capMs` so a hung
 * image cannot hold the cover; a late picture fills its reserved box.
 */
export async function waitForPrintedReveal(root: ParentNode | null, capMs = REVEAL_CAP_MS): Promise<void> {
  await Promise.all([waitForFonts(capMs), waitForAboveFoldImages(root, capMs)]);
}

export function queryNamed<T = unknown>(
  queries: { key: unknown[]; data: unknown }[],
  name: string,
): T | undefined {
  const hit = queries.find((q) => q.key[1] === name);
  return hit?.data as T | undefined;
}
