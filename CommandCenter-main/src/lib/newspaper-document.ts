/**
 * Open the Times as a finished document: one hold, then the whole paper.
 */

export const REVEAL_CAP_MS = 7_000;
export const COMPANION_WAIT_MS = 3_000;
export const ISSUE_WAIT_MS = 10_000;
/** Filed shells carry hundreds of stories; give the first read time to land. */
export const SHELL_WAIT_MS = 25_000;
/** While the Times is visible, look for a newly ready press. */
export const ISSUE_POLL_MS = 120_000;
export const ATF_PAGES = 2;

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

const primedSrc = new WeakMap<HTMLImageElement, string>();

/**
 * Make a folio image fetch and decode before it scrolls into view.
 * A lazy image can sit at complete with naturalWidth 0 and no request,
 * which is the blank box a swipe reveals. Eager plus decode() paints the bitmap
 * while the folio is still the neighbor.
 */
export function primeFolioImage(img: HTMLImageElement): Promise<void> {
  const src = img.getAttribute("src") || img.currentSrc || "";
  if (!src || src.startsWith("data:")) return Promise.resolve();
  if (img.loading !== "eager") img.loading = "eager";
  if (img.naturalWidth > 0) return decodeImage(img);

  const wait = () =>
    new Promise<void>((resolve) => {
      const finish = () => {
        img.removeEventListener("load", finish);
        img.removeEventListener("error", finish);
        void decodeImage(img).then(resolve);
      };
      if (img.complete && img.naturalWidth > 0) {
        finish();
        return;
      }
      img.addEventListener("load", finish);
      img.addEventListener("error", finish);
      if (img.complete && img.naturalWidth === 0) {
        // Listener is on before the restart, including a synchronous cache hit.
        if (primedSrc.get(img) !== src) {
          primedSrc.set(img, src);
          img.removeAttribute("src");
          img.src = src;
        }
        if (img.complete) finish();
      }
    });

  if (!img.complete) return decodeImage(img);
  return wait();
}

export async function decodeImage(img: HTMLImageElement): Promise<void> {
  // A finished image (including a broken one) will not fire load again.
  // Waiting here held the cover for the whole cap.
  if (img.complete) {
    try {
      if (img.naturalWidth) await img.decode();
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
 * Fonts, then above-the-fold pictures, then give the sheet back.
 * Always resolves by `capMs` so a hung image cannot hold the cover.
 */
export async function waitForPrintedReveal(root: ParentNode | null, capMs = REVEAL_CAP_MS): Promise<void> {
  const started = Date.now();
  const left = () => Math.max(0, capMs - (Date.now() - started));
  await waitForFonts(left());
  await waitForAboveFoldImages(root, left());
}

export function queryNamed<T = unknown>(
  queries: { key: unknown[]; data: unknown }[],
  name: string,
): T | undefined {
  const hit = queries.find((q) => q.key[1] === name);
  return hit?.data as T | undefined;
}
