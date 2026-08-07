import { supabase, requireUserId } from "./supabase";
import type { Book, BookInsert, ReadStatus } from "@/types";

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
  if (book.cover_path) {
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

  if (found.cover_base64 && found.cover_type) {
    try {
      const path = await storeCover(book.id, found.cover_base64, found.cover_type);
      return await updateBook(book.id, { cover_path: path, locked_at: new Date().toISOString() });
    } catch {
      // The book is saved either way; a failed cover upload isn't fatal.
    }
  }
  return await updateBook(book.id, { locked_at: new Date().toISOString() });
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
