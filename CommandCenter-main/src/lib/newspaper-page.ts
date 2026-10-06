/**
 * Locked Times broadsheet. Compose each folio to this canvas (~1480 tall).
 * A page may grow modestly to PAGE_SOFT_CAP_H only to keep a story intact.
 * Anything past that continues on the next folio in the same section
 * (CFB1 → CFB2 → CFB3), not on a taller sheet.
 */
export const PAGE_CANVAS = { width: 1040, height: 1480 } as const;

/** Soft grow past the canvas so a wrap is not cut mid-thought. */
export const PAGE_SOFT_CAP_H = 1650;

/** Favorite wraps that may fill a section front. The rest stay on later folios. */
export function frontPageLeftover<T extends { id: string; favoriteKey?: string | null }>(
  onFront: { id: string }[],
  pool: T[],
  max = 2,
): T[] {
  const seen = new Set(onFront.map((card) => card.id));
  const out: T[] = [];
  for (const card of pool) {
    if (seen.has(card.id) || !card.favoriteKey) continue;
    seen.add(card.id);
    out.push(card);
    if (out.length >= max) break;
  }
  return out;
}

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

/** One standings table: head plus compact rows. College tables run longer. */
export const STAND_TABLE_HEAD_PX = 44;
export const STAND_ROW_PX = 22;
export const STAND_TABLE_GAP_PX = 16;
/** College conferences are 12–16 rows; three tables fill a ~1480 folio. */
export const STAND_TABLES_PER_PAGE_COLLEGE = 3;
/** Pro divisions are shorter; four tables still sit under the soft cap. */
export const STAND_TABLES_PER_PAGE_PRO = 4;
/** League-news stories per folio after the section front. */
export const NEWS_STORIES_PER_PAGE = 3;

export function estimateStandingsHeight(groups: { rows: unknown[] }[]): number {
  let h = 36;
  for (const group of groups) {
    h += STAND_TABLE_HEAD_PX + Math.max(group.rows.length, 1) * STAND_ROW_PX + STAND_TABLE_GAP_PX;
  }
  return h;
}

export function planStandingsPages(
  groupCount: number,
  tablesPerPage = STAND_TABLES_PER_PAGE_PRO,
): { offset: number; count: number }[] {
  const n = Math.max(groupCount, 0);
  if (n <= 0) return [{ offset: 0, count: 0 }];
  const size = Math.max(tablesPerPage, 1);
  const pages: { offset: number; count: number }[] = [];
  for (let offset = 0; offset < n; offset += size) {
    pages.push({ offset, count: Math.min(size, n - offset) });
  }
  return pages;
}

export function planNewsPages(storyCount: number, perPage = NEWS_STORIES_PER_PAGE): { offset: number; count: number }[] {
  const n = Math.max(storyCount, 0);
  if (n <= 0) return [{ offset: 0, count: 0 }];
  const size = Math.max(perPage, 1);
  const pages: { offset: number; count: number }[] = [];
  for (let offset = 0; offset < n; offset += size) {
    pages.push({ offset, count: Math.min(size, n - offset) });
  }
  return pages;
}

const PRESEASON_MS = 18 * 24 * 60 * 60 * 1000;

/** Ticker W-L: current season only. Before tip-off, print the opener, not last year. */
export function clubTickerRecord(
  record: string | null | undefined,
  inSeason: boolean,
  opensLabel?: string | null,
): string {
  if (!inSeason) return opensLabel?.trim() || "—";
  const r = (record ?? "").trim();
  if (!r || /^0-0(-0)?$/.test(r)) return opensLabel?.trim() || "—";
  return r;
}

/** "Opens Nov 3" from an opener ISO or a board chip like "Tue Nov 3". */
export function clubOpensLabel(iso?: string | null, when?: string | null): string | null {
  const hit = when?.match(/[A-Z][a-z]{2}\s+\d{1,2}/);
  if (hit) return `Opens ${hit[0]}`;
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      const dateOnly = /T00:00:00/.test(iso);
      return `Opens ${d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: dateOnly ? "America/New_York" : "America/Chicago",
      })}`;
    }
  }
  return null;
}

/** A club card with only a future slate — drop the empty form grid until it has numbers. */
export function clubFormIsThin(
  club: {
    stats: unknown[];
    leaders: unknown[];
    division: unknown[];
    upcoming?: { startIso?: string | null; when?: string | null }[];
  },
  now = Date.now(),
): boolean {
  // A future slate with no current-season numbers — last year's table does
  // not earn a full form card (Missouri basketball before tip-off).
  if (club.stats.length === 0 && club.leaders.length === 0) return true;
  const next = club.upcoming?.[0];
  if (!next) return false;
  if (next.startIso) {
    const start = Date.parse(next.startIso);
    if (Number.isFinite(start) && start - now > PRESEASON_MS) return true;
  }
  // Board chips often have "Tue Nov 3" and no ISO. Before November that
  // is still preseason, not a form card.
  return Boolean(next.when && /Nov|Dec/i.test(next.when) && new Date(now).getUTCMonth() <= 9);
}

/** ESPN files 0.00 on unused % stats (Missouri RZ TD %). Keep real zeroes like 0 sacks. */
export function printableFormStat(stat: { label: string; value: string }): boolean {
  const raw = stat.value.replace(/%/g, "").trim();
  const emptyPct = /^(0+|0\.0+)$/.test(raw);
  return !(emptyPct && /%/.test(stat.label));
}

/** Stat-grid columns that fill the last row instead of leaving grey cells. */
export function formStatColumns(count: number): number {
  const n = Math.max(count, 0);
  if (n <= 1) return Math.max(n, 1);
  const options = [3, 2, 4, 5, 6];
  let best = n;
  let bestEmpty = Infinity;
  for (const cols of options) {
    if (cols > n) continue;
    const empty = (cols - (n % cols)) % cols;
    if (empty < bestEmpty) {
      best = cols;
      bestEmpty = empty;
    }
  }
  return bestEmpty === 0 ? best : n;
}

/** A2 keeps this many club cards under today's weather. */
export const A2_CLUB_CARDS = 3;
/**
 * Club-form cards in a 2-column grid: six cards are three rows and fill a
 * folio with the outlook chart. Three cards were one short row of cream.
 */
export const FORM_CLUBS_PER_PACKED_PAGE = 6;

export type OutlookFormPlan = {
  leftoverOffset: number;
  leftoverCount: number;
  formOnOutlook: number;
  formContinue: { offset: number; count: number }[];
};

/**
 * Pack leftover clubs and club form onto the outlook folio, then continue
 * in six-club slices. Never emit a one-row form page just to pad Section A.
 */
export function planOutlookAndForm(clubCount: number): OutlookFormPlan {
  const n = Math.max(clubCount, 0);
  const leftoverOffset = A2_CLUB_CARDS;
  // Leftover club cards reprint as form on A3 — a 1–4 card row is empty cream.
  const leftoverCount = 0;
  const formOnOutlook = Math.min(n, FORM_CLUBS_PER_PACKED_PAGE);
  const formContinue: { offset: number; count: number }[] = [];
  for (let offset = formOnOutlook; offset < n; offset += FORM_CLUBS_PER_PACKED_PAGE) {
    formContinue.push({ offset, count: Math.min(FORM_CLUBS_PER_PACKED_PAGE, n - offset) });
  }
  return { leftoverOffset, leftoverCount, formOnOutlook, formContinue };
}

export function pageExceedsCanvas(heightPx: number): boolean {
  return heightPx > PAGE_CANVAS.height;
}

export function pageExceedsSoftCap(heightPx: number): boolean {
  return heightPx > PAGE_SOFT_CAP_H;
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
export function estimateScoreGridHeight(games: number, cols = 3): number {
  const rows = Math.max(1, Math.ceil(Math.max(games, 1) / cols));
  return 36 + rows * 118;
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
