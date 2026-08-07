import { supabase, requireUserId } from "./supabase";
import { todayStr, shiftDay } from "./utils";
import type { Book, BookHighlight, BookInsert, ReadStatus } from "@/types";

const VALID_STATUS: ReadStatus[] = [
  "read",
  "to-read",
  "currently-reading",
  "did-not-finish",
  "paused",
];

/**
 * A minimal RFC-4180 CSV parser. StoryGraph exports contain commas and
 * newlines inside quoted fields (reviews, content warnings, tag lists), which
 * a naive split(",") mangles — so this walks the text character by character.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  // Strip a UTF-8 BOM; Excel-saved exports carry one and it corrupts the
  // first header name, which would silently break column lookup.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];

    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"'; // escaped quote
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** StoryGraph writes dates as YYYY/MM/DD; Postgres wants YYYY-MM-DD. */
function toDate(v: string): string | null {
  const m = /^(\d{4})\/(\d{2})\/(\d{2})/.exec(v.trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function toNumber(v: string): number | null {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export type ImportResult = { inserted: number; skipped: number; total: number };

/**
 * Import a StoryGraph CSV export. Inserts in chunks so a 2,600-row library
 * doesn't hit request limits, and reports how many rows were unusable rather
 * than failing the whole file for one bad line.
 */
export async function importStoryGraphCsv(
  text: string,
  onProgress?: (done: number, total: number) => void,
): Promise<ImportResult> {
  const userId = await requireUserId();
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("That file has no rows.");

  const header = rows[0].map((h) => h.trim());
  const col = (name: string) => header.indexOf(name);

  const iTitle = col("Title");
  if (iTitle === -1) {
    throw new Error('No "Title" column — is this a StoryGraph export?');
  }

  const idx = {
    authors: col("Authors"),
    contributors: col("Contributors"),
    isbn: col("ISBN/UID"),
    format: col("Format"),
    status: col("Read Status"),
    dateAdded: col("Date Added"),
    lastRead: col("Last Date Read"),
    datesRead: col("Dates Read"),
    readCount: col("Read Count"),
    rating: col("Star Rating"),
    review: col("Review"),
    moods: col("Moods"),
    pace: col("Pace"),
    tags: col("Tags"),
    owned: col("Owned?"),
  };

  const at = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");

  const books: BookInsert[] = [];
  let skipped = 0;

  for (const r of rows.slice(1)) {
    const title = at(r, iTitle);
    if (!title) {
      skipped++;
      continue;
    }

    const rawStatus = at(r, idx.status) as ReadStatus;
    const rating = toNumber(at(r, idx.rating));

    books.push({
      user_id: userId,
      title: title.slice(0, 500),
      authors: at(r, idx.authors) || null,
      contributors: at(r, idx.contributors) || null,
      isbn: at(r, idx.isbn) || null,
      format: at(r, idx.format) || null,
      status: VALID_STATUS.includes(rawStatus) ? rawStatus : "to-read",
      date_added: toDate(at(r, idx.dateAdded)),
      last_date_read: toDate(at(r, idx.lastRead)),
      dates_read: at(r, idx.datesRead) || null,
      read_count: Math.trunc(toNumber(at(r, idx.readCount)) ?? 0),
      // Guard the CHECK constraint rather than letting one bad cell 400 the batch.
      star_rating: rating !== null && rating >= 0 && rating <= 5 ? rating : null,
      review: at(r, idx.review) || null,
      moods: at(r, idx.moods) || null,
      pace: at(r, idx.pace) || null,
      tags: at(r, idx.tags)
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      owned: at(r, idx.owned).toLowerCase() === "yes",
    });
  }

  const CHUNK = 400;
  let inserted = 0;
  for (let i = 0; i < books.length; i += CHUNK) {
    const chunk = books.slice(i, i + CHUNK);
    const { error } = await supabase.from("books").insert(chunk);
    if (error) throw new Error(`Row ${i + 1}: ${error.message}`);
    inserted += chunk.length;
    onProgress?.(inserted, books.length);
  }

  return { inserted, skipped, total: books.length };
}

export async function fetchBooks(): Promise<Book[]> {
  // Paged: Supabase caps a single response at 1,000 rows, and this library
  // is larger than that — a plain select would silently truncate.
  const PAGE = 1000;
  const all: Book[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("books")
      .select("*")
      .order("last_date_read", { ascending: false, nullsFirst: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return all;
}

export async function clearBooks(): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from("books").delete().eq("user_id", userId);
  if (error) throw error;
}

// ── Mutations ────────────────────────────────────────────────────────────

export async function updateBook(id: string, patch: Partial<Book>): Promise<Book> {
  const { data, error } = await supabase.from("books").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function createBook(input: Partial<BookInsert> & { title: string }): Promise<Book> {
  const user_id = await requireUserId();
  const { data, error } = await supabase
    .from("books")
    .insert({ ...input, user_id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBook(id: string): Promise<void> {
  const { error } = await supabase.from("books").delete().eq("id", id);
  if (error) throw error;
}

// ── Lookup by URL ────────────────────────────────────────────────────────

export type Lookup = {
  title: string | null;
  subtitle: string | null;
  authors: string | null;
  isbn: string | null;
  page_count: number | null;
  publisher: string | null;
  published_year: number | null;
  description: string | null;
  cover_url: string | null;
  cover_base64: string | null;
  cover_type: string | null;
  source_url: string;
};

export async function lookupBookUrl(url: string): Promise<Lookup> {
  const { data, error } = await supabase.functions.invoke<Lookup & { error?: string }>(
    "book-lookup",
    { body: { url } },
  );
  if (error) throw new Error(error.message);
  if (!data || (data as { error?: string }).error) {
    throw new Error((data as { error?: string })?.error ?? "Lookup failed");
  }
  return data;
}

/**
 * Store our own copy of the cover. This is what "locking" means: once the
 * bytes are in our bucket, the record no longer depends on the retailer
 * keeping the image (or the page) alive.
 */
export async function storeCover(
  bookId: string,
  base64: string,
  contentType: string,
): Promise<string> {
  const userId = await requireUserId();
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  // Path must start with the user id — the storage policy keys on that folder.
  const path = `${userId}/${bookId}.${ext}`;

  const { error } = await supabase.storage
    .from("book-covers")
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw error;
  return path;
}

export function coverSrc(book: Book): string | null {
  // Prefer our stored copy; fall back to the remote URL only if we never got bytes.
  if (book.cover_path && book.cover_path.length > 0) {
    return supabase.storage.from("book-covers").getPublicUrl(book.cover_path).data.publicUrl;
  }
  return book.cover_url ?? null;
}

/** Create a book from a URL lookup, storing the cover so it can't rot. */
export async function addBookFromUrl(url: string, overrides: Partial<BookInsert> = {}) {
  const found = await lookupBookUrl(url);
  const book = await createBook({
    title: found.title?.trim() || "Untitled",
    subtitle: found.subtitle,
    authors: found.authors,
    isbn: found.isbn,
    page_count: found.page_count,
    publisher: found.publisher,
    published_year: found.published_year,
    description: found.description,
    cover_url: found.cover_url,
    source_url: found.source_url,
    status: "to-read",
    ...overrides,
  });

  let saved: Book;
  if (found.cover_base64 && found.cover_type) {
    try {
      const path = await storeCover(book.id, found.cover_base64, found.cover_type);
      saved = await updateBook(book.id, { cover_path: path, locked_at: new Date().toISOString() });
    } catch {
      // The book is saved either way; a failed cover upload isn't fatal.
      saved = await updateBook(book.id, { locked_at: new Date().toISOString() });
    }
  } else {
    saved = await updateBook(book.id, { locked_at: new Date().toISOString() });
  }

  // Subjects + fiction/series — URL scrape doesn't carry those.
  await enrichBook(saved.id).catch(() => {});
  return saved;
}

// ── Reading sessions ─────────────────────────────────────────────────────

export type ReadingSession = {
  id: string;
  user_id: string;
  book_id: string | null;
  session_date: string;
  pages_read: number;
  minutes: number | null;
  note: string | null;
  created_at: string;
};

export async function fetchSessions(): Promise<ReadingSession[]> {
  const { data, error } = await supabase
    .from("reading_sessions")
    .select("*")
    .order("session_date", { ascending: false })
    .limit(2000);
  if (error) throw error;
  return (data ?? []) as ReadingSession[];
}

/**
 * Log pages read. Also advances the book's current_page, and finishes the
 * book automatically once it reaches its page count — otherwise "read 40
 * pages" and "mark as read" are two chores instead of one.
 */
export async function logPages(opts: {
  bookId: string;
  pages: number;
  date: string;
  minutes?: number | null;
  note?: string | null;
  currentPage: number;
  pageCount: number | null;
  status: string;
}): Promise<{ finished: boolean }> {
  const user_id = await requireUserId();

  const { error } = await supabase.from("reading_sessions").insert({
    user_id,
    book_id: opts.bookId,
    session_date: opts.date,
    pages_read: opts.pages,
    minutes: opts.minutes ?? null,
    note: opts.note ?? null,
  });
  if (error) throw error;

  const nextPage = Math.max(0, opts.currentPage + opts.pages);
  const finished = opts.pageCount !== null && nextPage >= opts.pageCount;

  const patch: Partial<Book> = {
    current_page: opts.pageCount ? Math.min(nextPage, opts.pageCount) : nextPage,
  };
  if (finished) {
    patch.status = "read";
    patch.finished_at = opts.date;
    patch.last_date_read = opts.date;

    // Close out the read-through, so a finished book shows a start–end range
    // rather than only a pile of daily page entries.
    const { data: current } = await supabase
      .from("books")
      .select("read_log, started_at, read_count")
      .eq("id", opts.bookId)
      .single();
    const log = (current?.read_log ?? []) as ReadThrough[];
    const already = log.some((r) => r.end === opts.date);
    if (!already) {
      patch.read_log = [...log, { start: current?.started_at ?? null, end: opts.date }];
      patch.read_count = log.length + 1;
    }
  } else if (opts.status === "to-read") {
    // First pages logged means you've started it.
    patch.status = "currently-reading";
    patch.started_at = opts.date;
  }

  await updateBook(opts.bookId, patch);
  return { finished };
}

export async function deleteSession(id: string): Promise<void> {
  const { error } = await supabase.from("reading_sessions").delete().eq("id", id);
  if (error) throw error;
}

// ── AI ───────────────────────────────────────────────────────────────────

export type Suggestion = {
  title: string;
  author: string;
  year: string;
  reason: string;
  cover_url?: string | null;
};

export type ClassifyResult = { processed: number; series: number; remaining: number };

/**
 * One batch of fiction/series classification. The caller loops until
 * `remaining` is 0; the server records progress per book, so an interrupted
 * run resumes rather than restarting.
 */
export async function classifyBatch(batch = 60): Promise<ClassifyResult> {
  const { data, error } = await supabase.functions.invoke<ClassifyResult & { error?: string }>(
    "book-ai",
    { body: { mode: "classify", batch } },
  );
  if (data?.error) throw new Error(data.error);
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Classification failed");
  return data;
}

/** Classify one book — used right after enrich so fiction lands without a bulk run. */
export async function classifyBook(bookId: string): Promise<ClassifyResult> {
  const { data, error } = await supabase.functions.invoke<ClassifyResult & { error?: string }>(
    "book-ai",
    { body: { mode: "classify", bookId } },
  );
  if (data?.error) throw new Error(data.error);
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Classification failed");
  return data;
}

/** How many books have never been classified. */
export async function unclassifiedCount(): Promise<number> {
  const { count, error } = await supabase
    .from("books")
    .select("id", { count: "exact", head: true })
    .is("classified_at", null);
  if (error) throw error;
  return count ?? 0;
}

/** A reader's own note on a highlight — kept apart from Readwise's own note. */
export async function saveHighlightNote(id: string, my_note: string | null): Promise<void> {
  const { error } = await supabase.from("book_highlights").update({ my_note }).eq("id", id);
  if (error) throw error;
}

/**
 * Ask Claude for books. `search` answers a natural-language request with web
 * search; `recommend` reads the library and suggests what to read next.
 */
export async function askAI(mode: "search" | "recommend", query = ""): Promise<Suggestion[]> {
  const { data, error } = await supabase.functions.invoke<{
    recommendations?: Suggestion[];
    error?: string;
  }>("book-ai", { body: { mode, query } });
  // A non-2xx carries the useful message in the body, not in error.message.
  if (data?.error) throw new Error(data.error);
  if (error) throw new Error(error.message);
  return data?.recommendations ?? [];
}

export type CoverPullResult = { found: boolean; source?: string; cover_path?: string };

/** Prefer the JSON body message; supabase-js hides it behind a generic string. */
async function edgeErrorMessage(error: { message: string; context?: unknown }, fallback: string) {
  const ctx = error.context as { json?: () => Promise<unknown>; body?: unknown } | undefined;
  try {
    if (ctx && typeof ctx.json === "function") {
      const body = (await ctx.json()) as { error?: string };
      if (body?.error) return body.error;
    }
  } catch {
    // fall through
  }
  if (error.message && !/non-2xx/i.test(error.message)) return error.message;
  return fallback;
}

/**
 * Pull a jacket for a blank book. Without `url`, Open Library / Google then
 * Claude + web search; with `url`, scrape/fetch that page or image link.
 */
export async function pullCover(bookId: string, url?: string): Promise<CoverPullResult> {
  const { data, error } = await supabase.functions.invoke<CoverPullResult & { error?: string }>(
    "book-ai",
    { body: { mode: "cover", bookId, url: url?.trim() || undefined } },
  );
  if (data?.error) throw new Error(data.error);
  if (error) {
    throw new Error(await edgeErrorMessage(error, "Couldn't find a cover for this one."));
  }
  if (!data?.found) throw new Error(data?.error ?? "Couldn't find a cover for this one.");
  return data;
}

/**
 * Same normalisation the Readwise matcher uses server-side: drop the subtitle
 * and a leading article so "Relentless" finds "Relentless: A Memoir".
 */
export function titleKey(raw: string): string {
  return raw
    .toLowerCase()
    .split(/[:\u2014\u2013]|\s-\s/)[0]
    .replace(/\(.*?\)/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/^(the|a|an) /, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Readwise highlights ──────────────────────────────────────────────────

export type SyncResult = {
  sources: number;
  matched: number;
  highlights: number;
  unmatched: string[];
  incremental: boolean;
};

/**
 * Pulls highlights from Readwise. Incremental by default; `full` re-reads the
 * whole account, which is what you want after fixing a title so it can match.
 */
export async function syncReadwise(full = false): Promise<SyncResult> {
  const { data, error } = await supabase.functions.invoke<SyncResult & { error?: string }>(
    "readwise-sync",
    { body: { full } },
  );
  // A non-2xx carries the useful message in the body, not in error.message.
  if (data?.error) throw new Error(data.error);
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Readwise sync failed");
  return data;
}

/** Highlights for one book, in reading order. */
export async function fetchHighlights(bookId: string): Promise<BookHighlight[]> {
  const { data, error } = await supabase
    .from("book_highlights")
    .select("*")
    .eq("book_id", bookId)
    .order("location", { ascending: true, nullsFirst: false })
    .order("highlighted_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** How many highlights each book has, so a book can show a count. */
export async function fetchHighlightCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("book_highlights")
    .select("book_id")
    .not("book_id", "is", null)
    .limit(20000);
  if (error) throw error;
  const out: Record<string, number> = {};
  for (const r of data ?? []) {
    if (r.book_id) out[r.book_id] = (out[r.book_id] ?? 0) + 1;
  }
  return out;
}

/** When Readwise was last pulled, for the sync card. */
export async function readwiseSyncedAt(): Promise<string | null> {
  const { data, error } = await supabase
    .from("integration_sync")
    .select("synced_at")
    .eq("service", "readwise")
    .maybeSingle();
  if (error) throw error;
  return data?.synced_at ?? null;
}

// ── Cover backfill ───────────────────────────────────────────────────────

export type BackfillResult = {
  processed: number;
  found: number;
  pages?: number;
  blurbs?: number;
  missed: number;
  sources: Record<string, number>;
  remaining: number;
};

/**
 * Re-fetch metadata for one book, ignoring whether it was enriched before.
 * Backs the "Fetch book info" button on a book that came through the import
 * with nothing but a title. Also auto-pulls fiction (subjects first, then
 * Claude) so the reader never has to set it by hand.
 */
export async function enrichBook(bookId: string): Promise<BackfillResult> {
  const { data, error } = await supabase.functions.invoke<BackfillResult & { error?: string }>(
    "backfill-covers",
    { body: { bookId } },
  );
  if (error) throw new Error(error.message);
  if (!data || data.error) throw new Error(data?.error ?? "Lookup failed");

  // Subjects may have settled fiction; Claude fills holes + series. Skip when
  // both are already done so "Fetch book info" doesn't re-spend tokens.
  const { data: row } = await supabase
    .from("books")
    .select("fiction,classified_at")
    .eq("id", bookId)
    .maybeSingle();
  if (row && (row.fiction === null || row.classified_at === null)) {
    await classifyBook(bookId).catch(() => {});
  }
  return data;
}

/** One batch. The caller loops until `remaining` is 0. */
export async function backfillCoversBatch(batch = 25): Promise<BackfillResult> {
  const { data, error } = await supabase.functions.invoke<BackfillResult & { error?: string }>(
    "backfill-covers",
    { body: { batch } },
  );
  if (error) throw new Error(error.message);
  if (!data || (data as { error?: string }).error) {
    throw new Error((data as { error?: string })?.error ?? "Backfill failed");
  }
  return data;
}

/** How many books still need a cover attempt. */
export async function coversRemaining(): Promise<number> {
  const { count, error } = await supabase
    .from("books")
    .select("id", { count: "exact", head: true })
    .is("cover_path", null)
    .not("isbn", "is", null);
  if (error) throw error;
  return count ?? 0;
}

// ── On Deck ──────────────────────────────────────────────────────────────

export async function fetchOnDeck(): Promise<Book[]> {
  const { data, error } = await supabase
    .from("books")
    .select("*")
    .eq("on_deck", true)
    .order("on_deck_order")
    .limit(12);
  if (error) throw error;
  return data ?? [];
}

export async function setOnDeck(id: string, on: boolean): Promise<void> {
  const { error } = await supabase.from("books").update({ on_deck: on }).eq("id", id);
  if (error) throw error;
}

// ── Goals ────────────────────────────────────────────────────────────────

export type ReadingGoal = {
  id: string;
  user_id: string;
  year: number;
  target_books: number | null;
  target_pages: number | null;
};

export async function fetchGoal(year: number): Promise<ReadingGoal | null> {
  const { data, error } = await supabase
    .from("reading_goals")
    .select("*")
    .eq("year", year)
    .maybeSingle();
  if (error) throw error;
  return (data as ReadingGoal) ?? null;
}

export async function saveGoal(
  year: number,
  targets: { target_books?: number | null; target_pages?: number | null },
): Promise<void> {
  const user_id = await requireUserId();
  const { error } = await supabase
    .from("reading_goals")
    .upsert({ user_id, year, ...targets }, { onConflict: "user_id,year" });
  if (error) throw error;
}

// ── Progress helpers ─────────────────────────────────────────────────────

/** Percent → absolute page, for logging by "I'm 40% through". */
export function percentToPage(percent: number, pageCount: number | null): number | null {
  if (!pageCount || pageCount <= 0) return null;
  return Math.round((Math.min(100, Math.max(0, percent)) / 100) * pageCount);
}

export function pageToPercent(page: number, pageCount: number | null): number | null {
  if (!pageCount || pageCount <= 0) return null;
  return Math.min(100, Math.max(0, (page / pageCount) * 100));
}

/**
 * Jump straight to a page (or percent), rather than adding a delta. Records
 * the difference as a session so the calendar and monthly totals stay right.
 */
export async function setProgress(opts: {
  bookId: string;
  toPage: number;
  date: string;
  currentPage: number;
  pageCount: number | null;
  status: string;
}): Promise<{ finished: boolean; delta: number }> {
  const delta = Math.max(0, opts.toPage - opts.currentPage);
  if (delta > 0) {
    const { finished } = await logPages({
      bookId: opts.bookId,
      pages: delta,
      date: opts.date,
      currentPage: opts.currentPage,
      pageCount: opts.pageCount,
      status: opts.status,
    });
    return { finished, delta };
  }
  // Moving backwards corrects a mistake; adjust the page without a session.
  await updateBook(opts.bookId, { current_page: Math.max(0, opts.toPage) });
  return { finished: false, delta: 0 };
}

/** Books still awaiting enrichment (covers, page counts, descriptions). */
export async function enrichRemaining(): Promise<number> {
  const { count, error } = await supabase
    .from("books")
    .select("id", { count: "exact", head: true })
    .is("enriched_at", null);
  if (error) throw error;
  return count ?? 0;
}

/** Reading sessions for one book, newest first. */
export async function fetchBookSessions(bookId: string): Promise<ReadingSession[]> {
  const { data, error } = await supabase
    .from("reading_sessions")
    .select("*")
    .eq("book_id", bookId)
    .order("session_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ReadingSession[];
}

// ── Other editions ───────────────────────────────────────────────────────

export type Edition = {
  key: string;
  title: string;
  publishers: string[];
  publish_date?: string;
  number_of_pages?: number;
  isbn?: string;
  cover_id?: number;
};

/**
 * Other editions of the same work, via Open Library. Useful mainly for
 * borrowing a page count when your own edition has none — the StoryGraph
 * export carries no page counts at all.
 */
export async function fetchEditions(isbn: string): Promise<Edition[]> {
  const clean = isbn.replace(/[^0-9Xx]/g, "");
  if (clean.length !== 13 && clean.length !== 10) return [];

  // ISBN -> edition -> its work -> all editions of that work.
  const edRes = await fetch(`https://openlibrary.org/isbn/${clean}.json`);
  if (!edRes.ok) return [];
  const ed = await edRes.json();
  const workKey: string | undefined = ed?.works?.[0]?.key;
  if (!workKey) return [];

  const listRes = await fetch(`https://openlibrary.org${workKey}/editions.json?limit=40`);
  if (!listRes.ok) return [];
  const list = await listRes.json();

  return (list.entries ?? [])
    .map(
      (e: Record<string, unknown>): Edition => ({
        key: String(e.key ?? ""),
        title: String(e.title ?? ""),
        publishers: (e.publishers as string[]) ?? [],
        publish_date: e.publish_date as string | undefined,
        number_of_pages: e.number_of_pages as number | undefined,
        isbn: ((e.isbn_13 as string[]) ?? (e.isbn_10 as string[]) ?? [])[0],
        cover_id: ((e.covers as number[]) ?? [])[0],
      }),
    )
    .filter((e: Edition) => e.number_of_pages || e.cover_id)
    .slice(0, 12);
}

/**
 * Adopt an edition: its page count, publisher and year, and its cover.
 * Selecting an edition previously only took the page count, which is why the
 * cover never changed.
 */
export async function applyEdition(
  book: Book,
  edition: Edition,
): Promise<{ coverApplied: boolean }> {
  const patch: Partial<Book> = {};
  if (edition.number_of_pages) patch.page_count = edition.number_of_pages;
  if (edition.publishers?.[0]) patch.publisher = edition.publishers[0];
  const yr = edition.publish_date?.match(/\d{4}/)?.[0];
  if (yr) patch.published_year = Number.parseInt(yr, 10);

  let coverApplied = false;
  if (edition.cover_id) {
    try {
      // Open Library serves covers with Access-Control-Allow-Origin: *,
      // so the browser can fetch the bytes and we store our own copy.
      const res = await fetch(`https://covers.openlibrary.org/b/id/${edition.cover_id}-L.jpg`);
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 3000) {
          const buf = new Uint8Array(await blob.arrayBuffer());
          let bin = "";
          for (let i = 0; i < buf.length; i += 8192) {
            bin += String.fromCharCode(...buf.subarray(i, i + 8192));
          }
          const type = blob.type || "image/jpeg";
          patch.cover_path = await storeCover(book.id, btoa(bin), type);
          patch.locked_at = new Date().toISOString();
          coverApplied = true;
        }
      }
    } catch {
      // Page count still applies even if the cover can't be fetched.
    }
  }

  await updateBook(book.id, patch);
  return { coverApplied };
}

// ── Editing reading history ──────────────────────────────────────────────

export async function addSession(input: {
  bookId: string | null;
  date: string;
  pages: number;
  note?: string | null;
}): Promise<void> {
  const user_id = await requireUserId();
  const { error } = await supabase.from("reading_sessions").insert({
    user_id,
    book_id: input.bookId,
    session_date: input.date,
    pages_read: input.pages,
    note: input.note ?? null,
  });
  if (error) throw error;
}

export async function updateSession(
  id: string,
  patch: { session_date?: string; pages_read?: number; note?: string | null },
): Promise<void> {
  const { error } = await supabase.from("reading_sessions").update(patch).eq("id", id);
  if (error) throw error;
}

/**
 * Recompute a book's current_page from its sessions. Editing history has to
 * move progress with it, or the two silently disagree.
 */
export async function recalcProgress(bookId: string): Promise<void> {
  const sessions = await fetchBookSessions(bookId);
  const total = sessions.reduce((sum, s) => sum + s.pages_read, 0);
  const { data: book } = await supabase
    .from("books")
    .select("page_count")
    .eq("id", bookId)
    .single();
  const cap = book?.page_count ?? null;
  await updateBook(bookId, { current_page: cap ? Math.min(total, cap) : total });
}

// ── Read-throughs ────────────────────────────────────────────────────────

export type ReadThrough = { start: string | null; end: string | null };

/** Newest first, by finish date. */
export function sortReadLog(log: ReadThrough[]): ReadThrough[] {
  return [...log].sort((a, b) => (b.end ?? "").localeCompare(a.end ?? ""));
}

/**
 * read_count is derived from read_log, so the two can never disagree — the
 * old +/- counter could drift away from the actual dates.
 */
async function writeReadLog(book: Book, log: ReadThrough[]): Promise<void> {
  const sorted = sortReadLog(log);
  const latest = sorted[0]?.end ?? null;
  await updateBook(book.id, {
    read_log: sorted,
    read_count: sorted.length,
    // Finishing dates come from the log, so the shelves and stats follow it.
    finished_at: latest ?? book.finished_at,
    last_date_read: latest ?? book.last_date_read,
    ...(sorted.length > 0 && book.status === "to-read" ? { status: "read" as const } : {}),
  });
}

export async function addReadThrough(book: Book, entry: ReadThrough): Promise<void> {
  await writeReadLog(book, [...(book.read_log ?? []), entry]);
}

export async function updateReadThrough(
  book: Book,
  index: number,
  entry: ReadThrough,
): Promise<void> {
  const log = [...(book.read_log ?? [])];
  log[index] = entry;
  await writeReadLog(book, log);
}

/** Delete one read-through — the way to remove a duplicate. */
export async function removeReadThrough(book: Book, index: number): Promise<void> {
  const log = (book.read_log ?? []).filter((_, i) => i !== index);
  await writeReadLog(book, log);
}

/** Duplicate entries (same start and end) so the UI can flag them. */
export function duplicateIndexes(log: ReadThrough[]): Set<number> {
  const seen = new Map<string, number>();
  const dupes = new Set<number>();
  log.forEach((e, i) => {
    const key = `${e.start ?? ""}|${e.end ?? ""}`;
    if (seen.has(key)) dupes.add(i);
    else seen.set(key, i);
  });
  return dupes;
}

// ── Weekly / monthly totals ──────────────────────────────────────────────

export type PeriodStats = {
  pagesWeek: number;
  pagesMonth: number;
  booksWeek: number;
  booksMonth: number;
};

/** Monday-start week; both windows in Central time to match everything else. */
export function periodStats(books: Book[], sessions: ReadingSession[]): PeriodStats {
  const today = todayStr();
  const d = new Date(`${today}T12:00:00`);

  const dow = (d.getDay() + 6) % 7; // Monday = 0
  const weekStartIso = shiftDay(today, -dow);
  const monthStartIso = `${today.slice(0, 7)}-01`;

  let pagesWeek = 0;
  let pagesMonth = 0;
  for (const s of sessions) {
    if (s.session_date >= monthStartIso) pagesMonth += s.pages_read;
    if (s.session_date >= weekStartIso) pagesWeek += s.pages_read;
  }

  let booksWeek = 0;
  let booksMonth = 0;
  for (const b of books) {
    // Count every read-through that finished in the window, not just the
    // book's latest finish — a re-read this month is a book read this month.
    for (const r of b.read_log ?? []) {
      if (!r.end) continue;
      if (r.end >= monthStartIso) booksMonth++;
      if (r.end >= weekStartIso) booksWeek++;
    }
  }

  return { pagesWeek, pagesMonth, booksWeek, booksMonth };
}

// ── Daily pages goal ─────────────────────────────────────────────────────

export async function fetchDailyGoal(): Promise<number | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("daily_page_goal")
    .maybeSingle();
  if (error) throw error;
  return data?.daily_page_goal ?? null;
}

export async function saveDailyGoal(pages: number | null): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("profiles")
    .update({ daily_page_goal: pages })
    .eq("id", userId);
  if (error) throw error;
}

export type DailyProgress = {
  today: number;
  goal: number | null;
  metToday: boolean;
  streak: number;
  bestStreak: number;
};

/**
 * Pages today plus the run of consecutive days that met the goal.
 *
 * Today counts only once it's met, so an unfinished day doesn't read as a
 * broken streak at breakfast — the run is measured from yesterday backwards
 * and today is added on top when it qualifies.
 */
export function dailyProgress(sessions: ReadingSession[], goal: number | null): DailyProgress {
  const byDay = new Map<string, number>();
  for (const s of sessions) {
    byDay.set(s.session_date, (byDay.get(s.session_date) ?? 0) + s.pages_read);
  }

  const today = todayStr();
  const pagesToday = byDay.get(today) ?? 0;
  const metToday = goal !== null && pagesToday >= goal;

  if (goal === null) {
    return { today: pagesToday, goal, metToday: false, streak: 0, bestStreak: 0 };
  }

  let streak = metToday ? 1 : 0;
  for (let day = shiftDay(today, -1); ; day = shiftDay(day, -1)) {
    if ((byDay.get(day) ?? 0) >= goal) streak++;
    else break;
    if (streak > 3650) break; // safety valve
  }

  // Longest run anywhere in the logged history.
  const days = [...byDay.keys()].filter((d) => (byDay.get(d) ?? 0) >= goal).sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    run = prev && shiftDay(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }

  return { today: pagesToday, goal, metToday, streak, bestStreak: Math.max(best, streak) };
}
