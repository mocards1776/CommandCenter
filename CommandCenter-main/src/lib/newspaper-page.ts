/**
 * Locked Times broadsheet canvas. Global ~1480 compose / ~1650 continuation
 * is #329. This file only adds recaps-desk score paging for #318.
 */
export const PAGE_CANVAS = { width: 1040, height: 1480 } as const;
/** Recaps-desk pack target. After #329 merges, use that PR's PAGE_SOFT_CAP_H. */
export const PAGE_TARGET_H = 1480;
export const PAGE_SOFT_CAP_H = 1650;

/** Masthead + folio + sheet padding reserved on every page. */
export const PAGE_CHROME_PX = 188;

export const PAGE_BODY_PX = PAGE_CANVAS.height - PAGE_CHROME_PX;

const SCHEDULE_DAY_HEAD_PX = 28;
const SCHEDULE_ROW_PX = 44;
const SCHEDULE_GAP_PX = 10;
const SCHEDULE_COLS = 3;

export function groupByDay<T extends { day: string }>(games: T[]): [string, T[]][] {
  const days = new Map<string, T[]>();
  for (const g of games) {
    const list = days.get(g.day) ?? [];
    list.push(g);
    days.set(g.day, list);
  }
  return [...days.entries()];
}

/** Printed height of a compact 3-column slate (NFL7). */
export function estimateScheduleHeight(games: { day: string }[]): number {
  let h = 36;
  for (const [, list] of groupByDay(games)) {
    const rows = Math.max(1, Math.ceil(list.length / SCHEDULE_COLS));
    h += SCHEDULE_DAY_HEAD_PX + rows * SCHEDULE_ROW_PX + SCHEDULE_GAP_PX;
  }
  return h;
}

/**
 * Pack a week slate onto one folio when it fits; otherwise split on day
 * boundaries so Thursday–Monday stay chronological and no page is sparse.
 */
export function planSchedulePages<T extends { day: string }>(games: T[]): T[][] {
  if (!games.length) return [[]];
  if (estimateScheduleHeight(games) <= PAGE_BODY_PX) return [games];
  const groups = groupByDay(games);
  const pages: T[][] = [];
  let cur: T[] = [];
  let h = 36;
  for (const [, list] of groups) {
    const rows = Math.max(1, Math.ceil(list.length / SCHEDULE_COLS));
    const cost = SCHEDULE_DAY_HEAD_PX + rows * SCHEDULE_ROW_PX + SCHEDULE_GAP_PX;
    if (cur.length && h + cost > PAGE_BODY_PX) {
      pages.push(cur);
      cur = [];
      h = 36;
    }
    cur.push(...list);
    h += cost;
  }
  if (cur.length) pages.push(cur);
  return pages.length ? pages : [games];
}

export function pageExceedsCanvas(heightPx: number): boolean {
  return heightPx > PAGE_CANVAS.height;
}

/** Sport-front budget: lead + rail of `n` week games in two columns. */
export function estimateSportFrontHeight(opts: { railGames: number; extraStories: number }): number {
  const railRows = Math.ceil(Math.max(opts.railGames, 1) / 2);
  const rail = 32 + railRows * 48;
  const extras = opts.extraStories * 110;
  return 90 + Math.max(620 + extras, rail);
}

/** A1: lead photo + copy, rail of favorite wraps, optional kickoff fill. */
export function estimateA1Height(opts: { railItems: number; hasLeadPhoto: boolean; fillRows: number }): number {
  const lead = (opts.hasLeadPhoto ? 280 : 0) + 90 + 240 + 150;
  const rail = Math.max(opts.railItems, 0) * 210;
  const fill = Math.max(opts.fillRows, 0) * 52;
  return Math.max(lead, rail) + fill;
}

/** Inside recap (A4): photo, chrome, grafs, condensed box. */
export function estimateInsideRecapHeight(opts: { grafs: number; condensedBox: boolean }): number {
  return 80 + 280 + 190 + Math.max(opts.grafs, 0) * 68 + (opts.condensedBox ? 150 : 0);
}

/** NFL2 scoreboard: `n` finals in three columns. */
export function estimateScoreGridHeight(games: number, cols = 3, rowPx = 118): number {
  const rows = Math.max(1, Math.ceil(Math.max(games, 1) / cols));
  return 36 + rows * rowPx;
}

const RECAPS_HERO_PX = 80;
const RECAPS_WRAPS_PX = 720;

/**
 * Split a recaps-desk score grid so the first folio keeps the wrap briefs
 * and later folios take leftover finals. Target 1480; never past 1650.
 */
export function planRecapsScorePages(
  gameCount: number,
  opts?: { mlb?: boolean; wraps?: boolean },
): { offset: number; count: number; wraps: boolean }[] {
  const n = Math.max(0, gameCount);
  const cols = opts?.mlb ? 2 : 3;
  const rowPx = opts?.mlb ? 280 : 220;
  const wrapH = opts?.wraps === false ? 0 : RECAPS_WRAPS_PX;
  const chrome = PAGE_CHROME_PX + RECAPS_HERO_PX;
  const firstBudget = PAGE_TARGET_H - chrome - wrapH;
  const contBudget = PAGE_TARGET_H - chrome;
  const firstN = Math.max(cols, Math.floor(Math.max(firstBudget - 36, rowPx) / rowPx) * cols);
  const contN = Math.max(cols, Math.floor(Math.max(contBudget - 36, rowPx) / rowPx) * cols);
  if (n <= firstN) return [{ offset: 0, count: n, wraps: opts?.wraps !== false }];
  const pages = [{ offset: 0, count: firstN, wraps: true }];
  let i = firstN;
  while (i < n) {
    pages.push({ offset: i, count: Math.min(contN, n - i), wraps: false });
    i += contN;
  }
  return pages;
}

/** Wraps and boxes that actually print on this recaps folio — never the whole slate. */
export function recapsDeskPrinted(opts: {
  articles: number;
  wraps: boolean;
  offset?: number;
  count?: number | null;
  boardGames?: number;
  mlb?: boolean;
}): { wraps: number; boxes: number } {
  const offset = opts.offset ?? 0;
  const board = Math.max(0, opts.boardGames ?? 0);
  const planned = planRecapsScorePages(board || Math.max(0, opts.count ?? 0), { mlb: opts.mlb });
  const slice = planned.find((s) => s.offset === offset) ?? planned[0];
  const remain = board ? Math.max(0, board - offset) : Math.max(0, opts.count ?? 0);
  const boxes = Math.min(slice?.count ?? remain, remain || Math.max(0, opts.count ?? 0));
  const leadWraps = opts.wraps && !offset ? (opts.articles === 3 ? 3 : Math.min(2, Math.max(0, opts.articles))) : 0;
  const contWraps = !opts.wraps && boxes > 0 && boxes <= 4 ? boxes : 0;
  return { wraps: leadWraps || contWraps, boxes };
}

export function recapsDeskBlurb(printed: { wraps: number; boxes: number }): string {
  const bits = [
    printed.wraps ? `${printed.wraps} ${printed.wraps === 1 ? "wrap" : "wraps"}` : null,
    printed.boxes ? `${printed.boxes} ${printed.boxes === 1 ? "box" : "boxes"}` : null,
  ].filter(Boolean);
  return bits.join(" · ") || "Box scores";
}

/**
 * Pixels from this element's top to the recaps-desk pack target (or soft cap).
 * Recap fill uses this so leftover matter on a compact card does not grow the sheet.
 */
export function folioFillBudget(el: HTMLElement, cap = false): number {
  const sheet = el.closest(".wsj-sheet") as HTMLElement | null;
  if (!sheet) return el.clientHeight;
  const zoom = Number.parseFloat(getComputedStyle(sheet).zoom || "1") || 1;
  const limit = (cap ? PAGE_SOFT_CAP_H : PAGE_TARGET_H) * zoom;
  return Math.max(0, Math.floor(sheet.getBoundingClientRect().top + limit - el.getBoundingClientRect().top));
}

/** Old 2-column MatchupCard slate — used to prove the compact row is required. */
export function estimateMatchupScheduleHeight(games: { day: string }[]): number {
  let h = 36;
  for (const [, list] of groupByDay(games)) {
    const rows = Math.max(1, Math.ceil(list.length / 2));
    h += SCHEDULE_DAY_HEAD_PX + rows * 210 + SCHEDULE_GAP_PX;
  }
  return h;
}

/** Guard: every folio in a composed edition must fit the locked canvas. */
export function assertPagesFitCanvas(pages: { folio: string; heightPx: number }[]): void {
  const tall = pages.filter((p) => pageExceedsCanvas(p.heightPx));
  if (tall.length) {
    throw new Error(
      `pages exceed ${PAGE_CANVAS.height}px canvas: ${tall.map((p) => `${p.folio}=${p.heightPx}`).join(", ")}`,
    );
  }
}

/** Content may not end more than this far above the folio rule. */
export const PAGE_FOOT_SLACK_PX = 60;

/** No internal hole larger than this between stacked bands. */
export const PAGE_INTERNAL_GAP_PX = 80;

/**
 * True when a folio is sparse: the last ink sits too far above the footer,
 * or a stacked band leaves a hole bigger than `PAGE_INTERNAL_GAP_PX`.
 */
export function pageHasBlankBand(opts: {
  contentBottomPx: number;
  canvasHeight?: number;
  internalGapsPx?: number[];
}): boolean {
  const canvas = opts.canvasHeight ?? PAGE_CANVAS.height;
  if (canvas - opts.contentBottomPx > PAGE_FOOT_SLACK_PX) return true;
  return (opts.internalGapsPx ?? []).some((gap) => gap > PAGE_INTERNAL_GAP_PX);
}

/** Guard: packed folios must fill the canvas, not just fit it. */
export function assertPagesFilled(
  pages: { folio: string; contentBottomPx: number; internalGapsPx?: number[] }[],
): void {
  const sparse = pages.filter((p) => pageHasBlankBand(p));
  if (sparse.length) {
    throw new Error(`pages leave blank space: ${sparse.map((p) => p.folio).join(", ")}`);
  }
}
