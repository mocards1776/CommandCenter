/**
 * Series strip: every volume of the open book's series, one card per volume,
 * in reading order. Pure so it can be unit-tested with node.
 *
 * The library imports several editions of the same volume as separate rows
 * (StoryGraph digital / hardcover / audio), so volumes are grouped by
 * position (or by normalized title when unnumbered) and one representative
 * row is picked per group.
 */

export type SeriesBook = {
  id: string;
  title: string;
  series: string | null;
  series_position: number | string | null;
  status: string;
  read_count: number;
  content_type?: string | null;
  cover_path?: string | null;
  cover_url?: string | null;
  published_year?: number | null;
};

export type SeriesVolume<B extends SeriesBook = SeriesBook> = {
  key: string;
  /** Numeric position, or null for an unnumbered entry. */
  position: number | null;
  /** The row the card shows — prefers the open book, then a cover, then read. */
  book: B;
  /** Every edition folded into this volume. */
  editions: B[];
  isCurrent: boolean;
  isRead: boolean;
  isReading: boolean;
};

export type SeriesGap = { kind: "gap"; key: string; position: number };
export type SeriesStripItem<B extends SeriesBook = SeriesBook> =
  | ({ kind: "volume" } & SeriesVolume<B>)
  | SeriesGap;

export type SeriesStrip<B extends SeriesBook = SeriesBook> = {
  name: string;
  volumes: SeriesVolume<B>[];
  items: SeriesStripItem<B>[];
  readCount: number;
  /** Index into `items` of the open book's card. */
  currentIndex: number;
  /** Suggested position for a new volume — one past the highest. */
  nextPosition: number | null;
};

/** Numeric comes back from PostgREST as a string in some clients. */
export function seriesPositionNumber(raw: number | string | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number.parseFloat(String(raw));
  return Number.isFinite(n) ? n : null;
}

/** "#1", "#12.5", or "" when unnumbered. */
export function seriesPositionLabel(raw: number | string | null | undefined): string {
  const n = seriesPositionNumber(raw);
  if (n === null) return "";
  return `#${Number.isInteger(n) ? n : String(n).replace(/\.?0+$/, "")}`;
}

/** Parse what the user typed into the position field. Blank clears it. */
export function parseSeriesPositionInput(raw: string): number | null | undefined {
  const s = raw.trim().replace(/^#/, "");
  if (!s) return null;
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 100) / 100;
}

export function normalizeSeriesName(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim().replace(/\s+/g, " ");
  return s.length > 0 ? s : null;
}

/** Title without subtitle / edition tails, so "Full Black, Volume 10: A Thriller" folds with "Full Black". */
function titleKey(title: string): string {
  return title
    .toLowerCase()
    .split(/[:\u2014\u2013]|\s-\s/)[0]
    .replace(/\([^)]*\)/g, " ")
    .replace(/,?\s*(volume|vol\.?|book)\s+[0-9ivxlc]+\s*$/i, " ")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/^(the|a|an) /, "")
    .trim();
}

function hasCover(b: SeriesBook): boolean {
  return Boolean((b.cover_path && b.cover_path.length > 0) || b.cover_url);
}

/** Rank editions so the card shows the most useful row. */
function representativeScore(b: SeriesBook, currentId: string | null): number {
  let s = 0;
  if (b.id === currentId) s += 1000;
  if (hasCover(b)) s += 100;
  if (b.status === "currently-reading") s += 50;
  if (b.status === "read" || b.read_count > 0) s += 20;
  return s;
}

/** Integer gaps between known positions, so a missing volume reads as missing. */
const MAX_GAP_CARDS = 8;

/**
 * Build the strip for `current`'s series out of the whole library. Returns
 * null when the book has no series or is a magazine issue (those use the
 * series column for the publication name — a different idea).
 */
export function buildSeriesStrip<B extends SeriesBook>(
  current: Pick<B, "id" | "series" | "content_type">,
  books: B[],
): SeriesStrip<B> | null {
  const name = normalizeSeriesName(current.series);
  if (!name || current.content_type === "magazine") return null;
  const nameKey = name.toLowerCase();

  const members = books.filter(
    (b) =>
      b.content_type !== "magazine" &&
      normalizeSeriesName(b.series)?.toLowerCase() === nameKey,
  );
  if (members.length === 0) return null;

  // Editions of one work share position *and* title. Two different titles at
  // the same number (a mis-filed row) stay two cards rather than hiding one.
  const groups = new Map<string, { position: number | null; editions: B[] }>();
  for (const b of members) {
    const pos = seriesPositionNumber(b.series_position);
    const key = `${pos !== null ? `p:${pos}` : "p:-"}|${titleKey(b.title)}`;
    const g = groups.get(key);
    if (g) g.editions.push(b);
    else groups.set(key, { position: pos, editions: [b] });
  }

  const volumes: SeriesVolume<B>[] = [...groups.entries()].map(([key, g]) => {
    const editions = [...g.editions].sort(
      (a, b) => representativeScore(b, current.id) - representativeScore(a, current.id),
    );
    const book = editions[0];
    return {
      key,
      position: g.position,
      book,
      editions,
      isCurrent: editions.some((e) => e.id === current.id),
      isRead: editions.some((e) => e.status === "read" || e.read_count > 0),
      isReading: editions.some((e) => e.status === "currently-reading"),
    };
  });

  volumes.sort((a, b) => {
    if (a.position !== null && b.position !== null) return a.position - b.position;
    if (a.position !== null) return -1;
    if (b.position !== null) return 1;
    const ya = a.book.published_year ?? Number.MAX_SAFE_INTEGER;
    const yb = b.book.published_year ?? Number.MAX_SAFE_INTEGER;
    if (ya !== yb) return ya - yb;
    return a.book.title.localeCompare(b.book.title);
  });

  const numbered = volumes.filter((v) => v.position !== null).map((v) => v.position as number);
  const items: SeriesStripItem<B>[] = [];
  let gapCards = 0;
  const totalGaps = countIntegerGaps(numbered);
  const showGaps = totalGaps > 0 && totalGaps <= MAX_GAP_CARDS;

  for (let i = 0; i < volumes.length; i++) {
    const v = volumes[i];
    const prev = volumes[i - 1];
    if (showGaps && prev && prev.position !== null && v.position !== null) {
      for (let p = Math.floor(prev.position) + 1; p < v.position; p++) {
        if (gapCards >= MAX_GAP_CARDS) break;
        items.push({ kind: "gap", key: `g:${p}`, position: p });
        gapCards++;
      }
    }
    items.push({ kind: "volume", ...v });
  }

  const currentIndex = items.findIndex((it) => it.kind === "volume" && it.isCurrent);
  const maxPos = numbered.length > 0 ? Math.max(...numbered) : null;

  return {
    name,
    volumes,
    items,
    readCount: volumes.filter((v) => v.isRead).length,
    currentIndex,
    nextPosition: maxPos === null ? 1 : Math.floor(maxPos) + 1,
  };
}

function countIntegerGaps(positions: number[]): number {
  const sorted = [...new Set(positions)].sort((a, b) => a - b);
  let gaps = 0;
  for (let i = 1; i < sorted.length; i++) {
    const from = Math.floor(sorted[i - 1]) + 1;
    const to = sorted[i];
    for (let p = from; p < to; p++) gaps++;
  }
  return gaps;
}

/** "3 of 7 read", "7 of 7 read", "2 volumes". */
export function seriesSummary(strip: Pick<SeriesStrip, "volumes" | "readCount">): string {
  const total = strip.volumes.length;
  if (total === 0) return "";
  if (strip.readCount === 0) return `${total} volume${total === 1 ? "" : "s"}`;
  return `${strip.readCount} of ${total} read`;
}

/** Distinct series names in the library for the add-to-series picker. */
export function librarySeriesNames(books: SeriesBook[]): string[] {
  const counts = new Map<string, { name: string; n: number }>();
  for (const b of books) {
    if (b.content_type === "magazine") continue;
    const name = normalizeSeriesName(b.series);
    if (!name) continue;
    const k = name.toLowerCase();
    const e = counts.get(k);
    if (e) e.n++;
    else counts.set(k, { name, n: 1 });
  }
  return [...counts.values()]
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
    .map((e) => e.name);
}
