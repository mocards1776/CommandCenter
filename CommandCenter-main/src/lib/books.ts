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

/**
 * StoryGraph "Dates Read" looks like "2024/03/09-2024/03/11, 2021/09/13".
 * Build the same read_log shape the rest of the app uses.
 */
export function parseStoryGraphDatesRead(raw: string): { start: string | null; end: string | null }[] {
  const out: { start: string | null; end: string | null }[] = [];
  for (const part of raw.split(",")) {
    const p = part.trim();
    if (!p) continue;
    // Range: YYYY/MM/DD-YYYY/MM/DD (date parts use /, so one "-" separates ends).
    const range = /^(\d{4}\/\d{2}\/\d{2})\s*-\s*(\d{4}\/\d{2}\/\d{2})$/.exec(p);
    if (range) {
      out.push({ start: toDate(range[1]), end: toDate(range[2]) });
      continue;
    }
    const single = toDate(p);
    if (single) out.push({ start: null, end: single });
  }
  return out;
}

/**
 * StoryGraph often leaves Read Status as "to-read" on rows that already have
 * finish dates / a read count (format duplicates, re-shelves, export quirks).
 * Trust those finish signals unless the row is actively mid-read / DNF / paused.
 */
function statusFromStoryGraph(
  rawStatus: string,
  readCount: number,
  lastRead: string | null,
  datesRead: string,
): ReadStatus {
  const status = VALID_STATUS.includes(rawStatus as ReadStatus)
    ? (rawStatus as ReadStatus)
    : "to-read";
  if (
    status === "currently-reading" ||
    status === "paused" ||
    status === "did-not-finish" ||
    status === "read"
  ) {
    return status;
  }
  if (readCount > 0 || lastRead || datesRead.trim()) return "read";
  return status;
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

    const rawStatus = at(r, idx.status);
    const rating = toNumber(at(r, idx.rating));
    const datesRead = at(r, idx.datesRead);
    const lastRead = toDate(at(r, idx.lastRead));
    const readLog = parseStoryGraphDatesRead(datesRead);
    const readCount = Math.max(
      Math.trunc(toNumber(at(r, idx.readCount)) ?? 0),
      readLog.length,
    );
    const status = statusFromStoryGraph(rawStatus, readCount, lastRead, datesRead);
    const finishedAt =
      status === "read"
        ? readLog.find((e) => e.end)?.end ?? lastRead
        : null;

    books.push({
      user_id: userId,
      title: title.slice(0, 500),
      authors: at(r, idx.authors) || null,
      contributors: at(r, idx.contributors) || null,
      isbn: at(r, idx.isbn) || null,
      format: at(r, idx.format) || null,
      status,
      date_added: toDate(at(r, idx.dateAdded)),
      last_date_read: lastRead,
      dates_read: datesRead || null,
      read_count: readCount,
      read_log: readLog,
      finished_at: finishedAt,
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

/**
 * Move finished books out of To Read when StoryGraph (or a merge) left them
 * there with read dates / a read-through log. Safe to re-run.
 */
export async function repairMisfiledReads(): Promise<number> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("books")
    .select("id, last_date_read, dates_read, read_count, read_log, finished_at")
    .eq("user_id", userId)
    .eq("status", "to-read");
  if (error) throw error;

  let fixed = 0;
  for (const b of data ?? []) {
    const log = (b.read_log ?? []) as { start: string | null; end: string | null }[];
    const fromDates = parseStoryGraphDatesRead(String(b.dates_read ?? ""));
    const merged = [...log];
    const seen = new Set(merged.map((r) => `${r.start ?? ""}|${r.end ?? ""}`));
    for (const r of fromDates) {
      const k = `${r.start ?? ""}|${r.end ?? ""}`;
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push(r);
    }
    const hasEvidence =
      (b.read_count ?? 0) > 0 ||
      Boolean(b.last_date_read) ||
      merged.some((r) => r.end);
    if (!hasEvidence) continue;

    const sorted = [...merged].sort((a, b) => (b.end ?? "").localeCompare(a.end ?? ""));
    const finished = sorted.find((r) => r.end)?.end ?? b.last_date_read ?? b.finished_at;
    const { error: uErr } = await supabase
      .from("books")
      .update({
        status: "read",
        read_log: sorted,
        read_count: Math.max(b.read_count ?? 0, sorted.length),
        finished_at: finished,
        last_date_read: finished ?? b.last_date_read,
      })
      .eq("id", b.id);
    if (uErr) throw uErr;
    fixed++;
  }
  return fixed;
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
  // Starting a book means it's no longer waiting in the on-deck queue.
  const next: Partial<Book> =
    patch.status === "currently-reading"
      ? { ...patch, on_deck: false }
      : patch;
  const { data, error } = await supabase.from("books").update(next).eq("id", id).select().single();
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

/**
 * Same work across StoryGraph formats (digital / hardcover / audio often
 * import as separate rows). Author is the first listed name only.
 */
export function workKey(b: Pick<Book, "title" | "authors">): string {
  const author = (b.authors ?? "").split(",")[0].trim().toLowerCase();
  return `${titleKey(b.title)}|${author}`;
}

/** Other library rows that are the same work under a different format. */
export function findDuplicateBooks(books: Book[], of: Book): Book[] {
  const key = workKey(of);
  return books
    .filter((b) => b.id !== of.id && workKey(b) === key)
    .sort((a, b) => (b.read_count ?? 0) - (a.read_count ?? 0));
}

function hasJacket(b: Book): boolean {
  return Boolean(b.cover_path && b.cover_path.length > 0) &&
    !(b.cover_url && /[?&]vid=ISBN/i.test(b.cover_url));
}

const STATUS_RANK: Record<string, number> = {
  "currently-reading": 5,
  read: 4,
  paused: 3,
  "did-not-finish": 2,
  "to-read": 1,
};

/**
 * Fold one or more duplicate edition rows into `keepId`. Read-throughs,
 * tags, ISBN/cover/blurb holes, highlights and sessions move over; the
 * absorbed rows are deleted. Use whenever StoryGraph split formats.
 */
export async function mergeBooks(keepId: string, absorbIds: string[]): Promise<Book> {
  const ids = [...new Set(absorbIds.filter((id) => id && id !== keepId))];
  if (!ids.length) throw new Error("Nothing to merge.");

  const { data: rows, error } = await supabase
    .from("books")
    .select("*")
    .in("id", [keepId, ...ids]);
  if (error) throw error;
  const keep = rows?.find((b) => b.id === keepId);
  if (!keep) throw new Error("Keep book not found.");
  const absorbs = (rows ?? []).filter((b) => b.id !== keepId);
  if (!absorbs.length) throw new Error("Duplicate book not found.");

  const patch: Partial<Book> = {};
  const fill = <K extends keyof Book>(key: K, better?: (v: Book[K]) => boolean) => {
    const cur = keep[key];
    const empty =
      cur === null ||
      cur === undefined ||
      cur === "" ||
      (Array.isArray(cur) && cur.length === 0);
    if (!empty && !better?.(cur)) return;
    for (const a of absorbs) {
      const v = a[key];
      if (v === null || v === undefined || v === "") continue;
      if (Array.isArray(v) && v.length === 0) continue;
      if (better && !better(v)) continue;
      patch[key] = v as Book[K];
      break;
    }
  };

  fill("isbn");
  fill("subtitle");
  fill("page_count");
  fill("publisher");
  fill("published_year");
  fill("description");
  fill("subjects", (v) => Array.isArray(v) && v.length > 0);
  fill("series");
  fill("series_position");
  if (keep.fiction === null) fill("fiction");
  if (!keep.format) fill("format");

  if (!hasJacket(keep)) {
    for (const a of absorbs) {
      if (!hasJacket(a)) continue;
      patch.cover_path = a.cover_path;
      patch.cover_url = a.cover_url;
      patch.locked_at = a.locked_at ?? new Date().toISOString();
      break;
    }
  }

  const tagSet = new Set<string>([...(keep.tags ?? []), ...absorbs.flatMap((a) => a.tags ?? [])]);
  patch.tags = [...tagSet];

  const ratings = [keep.star_rating, ...absorbs.map((a) => a.star_rating)].filter(
    (n): n is number => n !== null && n !== undefined,
  );
  if (ratings.length) patch.star_rating = Math.max(...ratings);

  if (!keep.review) {
    const rev = absorbs.find((a) => a.review)?.review;
    if (rev) patch.review = rev;
  }

  const log: { start: string | null; end: string | null }[] = [
    ...((keep.read_log ?? []) as { start: string | null; end: string | null }[]),
  ];
  const seen = new Set(log.map((r) => `${r.start ?? ""}|${r.end ?? ""}`));
  for (const a of absorbs) {
    for (const r of (a.read_log ?? []) as { start: string | null; end: string | null }[]) {
      const k = `${r.start ?? ""}|${r.end ?? ""}`;
      if (seen.has(k)) continue;
      seen.add(k);
      log.push(r);
    }
  }
  const sorted = [...log].sort((a, b) => (b.end ?? "").localeCompare(a.end ?? ""));
  patch.read_log = sorted;
  patch.read_count = sorted.length;
  if (sorted[0]?.end) {
    patch.finished_at = sorted[0].end;
    patch.last_date_read = sorted[0].end;
  }
  const starts = sorted.map((r) => r.start).filter(Boolean).sort();
  if (starts[0]) patch.started_at = starts[0]!;

  let bestStatus = keep.status;
  let bestRank = STATUS_RANK[keep.status] ?? 0;
  for (const a of absorbs) {
    const r = STATUS_RANK[a.status] ?? 0;
    if (r > bestRank) {
      bestRank = r;
      bestStatus = a.status;
    }
  }
  patch.status = bestStatus;
  // Finish dates mean the work has been read — don't leave a merged row on To Read.
  if (sorted.some((r) => r.end) && (STATUS_RANK[bestStatus] ?? 0) <= STATUS_RANK["to-read"]) {
    patch.status = "read";
  }

  if (absorbs.some((a) => a.on_deck) && !keep.on_deck) {
    patch.on_deck = true;
    patch.on_deck_order = absorbs.find((a) => a.on_deck)?.on_deck_order ?? keep.on_deck_order;
  }

  // Move child rows before deleting parents (FK may restrict otherwise).
  for (const a of absorbs) {
    const { error: hErr } = await supabase
      .from("book_highlights")
      .update({ book_id: keepId })
      .eq("book_id", a.id);
    if (hErr) throw hErr;
    const { error: sErr } = await supabase
      .from("reading_sessions")
      .update({ book_id: keepId })
      .eq("book_id", a.id);
    if (sErr) throw sErr;
  }

  const { data: merged, error: uErr } = await supabase
    .from("books")
    .update(patch)
    .eq("id", keepId)
    .select()
    .single();
  if (uErr) throw uErr;

  for (const a of absorbs) {
    await deleteBook(a.id);
  }

  return merged;
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

/** Rewrite common catalog jacket URLs to the largest available size. */
export function upgradeCoverUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let u = url.trim().replace(/^http:/i, "https:");
  if (!u || /[?&]vid=ISBN/i.test(u)) return null;

  // Open Library: S/M → L
  u = u.replace(/\/b\/(id|isbn|olid)\/([^/?#]+)-(S|M)\.jpe?g(\?[^#]*)?$/i, "/b/$1/$2-L.jpg$4");
  u = u.replace(/-([SM])\.jpe?g(\?|#|$)/i, "-L.jpg$2");

  // Google Books content / thumbnail endpoints. Prefer zoom=4 — brand-new
  // titles often return a grayscale stub at zoom=0; edge grabImage retries.
  if (/books\.google\.|googleusercontent\.com\/books|books\.googleusercontent/i.test(u)) {
    u = u.replace(/([?&])edge=curl(&)?/gi, (_, p1, p2) => (p2 ? p1 : ""));
    if (/[?&]zoom=\d+/i.test(u)) u = u.replace(/([?&])zoom=\d+/gi, "$1zoom=4");
    else u += (u.includes("?") ? "&" : "?") + "zoom=4";
    if (!/[?&]img=/i.test(u)) u += "&img=1";
  }

  return u;
}

/**
 * Ordered jacket candidates for sharp display. Storage first (our locked
 * copy), cache-busted by locked_at so a replaced jacket isn't stuck behind
 * CDN. Then remote URL, then Open Library ISBN large.
 * Paste clears cover_path first so the new URL wins immediately.
 */
export function coverCandidates(book: {
  cover_path?: string | null;
  cover_url?: string | null;
  isbn?: string | null;
  locked_at?: string | null;
  updated_at?: string | null;
}): string[] {
  const out: string[] = [];
  const push = (raw: string | null | undefined) => {
    const u = upgradeCoverUrl(raw) ?? (raw && !/[?&]vid=ISBN/i.test(raw) ? raw : null);
    if (!u || out.includes(u)) return;
    out.push(u);
  };

  // Storage first — even when cover_url is Google's shared "no cover" stub.
  if (book.cover_path && book.cover_path.length > 0) {
    const base = supabase.storage.from("book-covers").getPublicUrl(book.cover_path).data.publicUrl;
    const bust = book.locked_at || book.updated_at || "";
    push(bust ? `${base}${base.includes("?") ? "&" : "?"}v=${encodeURIComponent(bust)}` : base);
  }

  // Skip vid=ISBN stub URLs — they are a shared blue "no cover" skeleton.
  if (!book.cover_url || !/[?&]vid=ISBN/i.test(book.cover_url)) {
    push(book.cover_url);
  }

  const isbn = String(book.isbn ?? "").replace(/[^0-9Xx]/g, "");
  if (isbn.length === 10 || isbn.length === 13) {
    push(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`);
  }

  return out;
}

export function coverSrc(book: Book): string | null {
  return coverCandidates(book)[0] ?? null;
}

/** Create a book from a URL lookup, storing the cover so it can't rot. */
export async function addBookFromUrl(url: string, overrides: Partial<BookInsert> = {}) {
  const found = await lookupBookUrl(url);
  const coverFromLookup = upgradeCoverUrl(found.cover_url) ?? found.cover_url ?? null;
  const book = await createBook({
    title: found.title?.trim() || "Untitled",
    subtitle: found.subtitle,
    authors: found.authors,
    isbn: found.isbn,
    page_count: found.page_count,
    publisher: found.publisher,
    published_year: found.published_year,
    description: found.description,
    cover_url: coverFromLookup,
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
      saved = await updateBook(book.id, { locked_at: new Date().toISOString() });
    }
  } else {
    saved = await updateBook(book.id, { locked_at: new Date().toISOString() });
  }

  // Metadata only — the URL scrape already found the jacket; catalog search
  // for magazines/Shopify products often returns nothing or the wrong book.
  await enrichBook(saved.id, { skipCovers: Boolean(coverFromLookup || saved.cover_path) }).catch(
    () => {},
  );

  // Store our own copy when the edge lookup couldn't upload bytes.
  if (!saved.cover_path && coverFromLookup) {
    try {
      const pulled = await pullCover(saved.id, coverFromLookup);
      if (pulled.found) {
        saved = await updateBook(saved.id, {
          cover_path: pulled.cover_path ?? saved.cover_path,
          cover_url: pulled.cover_url ?? coverFromLookup,
          locked_at: new Date().toISOString(),
        });
      }
    } catch {
      // Hotlink from lookup is fine — enrich must not have stripped it.
    }
  }

  const { data: fresh } = await supabase.from("books").select("*").eq("id", saved.id).single();
  if (!fresh) return saved;

  const stillHasJacket =
    (fresh.cover_path && fresh.cover_path.length > 0) ||
    (fresh.cover_url && !/[?&]vid=ISBN/i.test(fresh.cover_url));
  if (!stillHasJacket && coverFromLookup) {
    return updateBook(fresh.id, {
      cover_url: coverFromLookup,
      locked_at: new Date().toISOString(),
    });
  }
  return fresh;
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
 * Start date for the current read-through: book.started_at when it belongs
 * to this pass, otherwise the earliest session after the previous finish.
 */
async function resolveThroughStart(
  bookId: string,
  startedAt: string | null,
  readLog: ReadThrough[],
): Promise<string | null> {
  const prevEnd = readLog
    .map((r) => r.end)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1) ?? null;

  if (startedAt && (!prevEnd || startedAt > prevEnd)) return startedAt;

  const { data } = await supabase
    .from("reading_sessions")
    .select("session_date")
    .eq("book_id", bookId)
    .order("session_date", { ascending: true });

  const dates = (data ?? [])
    .map((s) => s.session_date as string)
    .filter((d) => !prevEnd || d > prevEnd);
  return dates[0] ?? startedAt;
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
    // Any pages logged count as recent activity — drives Now Reading order.
    last_date_read: opts.date,
  };
  if (finished) {
    patch.status = "read";
    patch.finished_at = opts.date;

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
      const start = await resolveThroughStart(opts.bookId, current?.started_at ?? null, log);
      patch.read_log = [...log, { start, end: opts.date }];
      patch.read_count = log.length + 1;
      if (start) patch.started_at = start;
    }
  } else if (opts.status === "to-read" || opts.status === "did-not-finish") {
    // First pages logged means you've started it — leave on deck.
    patch.status = "currently-reading";
    patch.started_at = opts.date;
    patch.on_deck = false;
  } else if (opts.status === "currently-reading" || opts.status === "paused") {
    // Re-reads often leave started_at on an old pass — refresh when unset or stale.
    const { data: current } = await supabase
      .from("books")
      .select("started_at, read_log")
      .eq("id", opts.bookId)
      .single();
    const log = (current?.read_log ?? []) as ReadThrough[];
    const prevEnd = log
      .map((r) => r.end)
      .filter((d): d is string => Boolean(d))
      .sort()
      .at(-1);
    if (!current?.started_at || (prevEnd && current.started_at <= prevEnd)) {
      const start = await resolveThroughStart(opts.bookId, null, log);
      patch.started_at = start ?? opts.date;
    }
  }

  await updateBook(opts.bookId, patch);
  return { finished };
}

/**
 * Mark a book finished. Logs any remaining pages so Today / stats count them,
 * then closes the read-through with a real start–end range.
 */
export async function finishBook(opts: {
  bookId: string;
  date?: string;
  pageCount: number | null;
  currentPage: number;
  status: string;
}): Promise<{ finished: boolean; pagesLogged: number }> {
  const date = opts.date ?? todayStr();
  const remaining =
    opts.pageCount !== null && opts.pageCount > opts.currentPage
      ? opts.pageCount - opts.currentPage
      : 0;

  if (remaining > 0) {
    const r = await logPages({
      bookId: opts.bookId,
      pages: remaining,
      date,
      currentPage: opts.currentPage,
      pageCount: opts.pageCount,
      status: opts.status,
    });
    return { finished: r.finished, pagesLogged: remaining };
  }

  // Already at (or past) the last page — still close the through.
  const { data: current, error } = await supabase
    .from("books")
    .select("read_log, started_at, read_count")
    .eq("id", opts.bookId)
    .single();
  if (error) throw error;

  const log = (current?.read_log ?? []) as ReadThrough[];
  const patch: Partial<Book> = {
    status: "read",
    finished_at: date,
    last_date_read: date,
  };
  if (opts.pageCount !== null && opts.pageCount > 0) {
    patch.current_page = opts.pageCount;
  }

  const already = log.some((r) => r.end === date);
  if (!already) {
    const start = await resolveThroughStart(opts.bookId, current?.started_at ?? null, log);
    patch.read_log = [...log, { start, end: date }];
    patch.read_count = log.length + 1;
    if (start) patch.started_at = start;
  } else if ((current?.read_count ?? 0) === 0) {
    patch.read_count = 1;
  }

  await updateBook(opts.bookId, patch);
  return { finished: true, pagesLogged: 0 };
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
  isbn?: string | null;
  page_count?: number | null;
};

/** Best-effort ISBN / page count when catalog search omitted them (CORS-friendly). */
async function openLibraryExtras(
  title: string,
  author: string,
): Promise<{ isbn: string | null; page_count: number | null; cover_url: string | null }> {
  try {
    const params = new URLSearchParams({
      title: title.slice(0, 120),
      limit: "1",
      fields: "isbn,number_of_pages_median,cover_i",
    });
    if (author) params.set("author", author.split(",")[0].trim().slice(0, 80));
    const ctl = new AbortController();
    const t = window.setTimeout(() => ctl.abort(), 8000);
    const res = await fetch(`https://openlibrary.org/search.json?${params}`, {
      signal: ctl.signal,
    }).finally(() => window.clearTimeout(t));
    if (!res.ok) return { isbn: null, page_count: null, cover_url: null };
    const doc = (await res.json())?.docs?.[0];
    if (!doc) return { isbn: null, page_count: null, cover_url: null };
    const isbnRaw = Array.isArray(doc.isbn)
      ? String(
          doc.isbn.find((x: string) => String(x).replace(/[^0-9Xx]/g, "").length === 13) ??
            doc.isbn[0] ??
            "",
        ).replace(/[^0-9Xx]/g, "")
      : "";
    const isbn = isbnRaw.length === 10 || isbnRaw.length === 13 ? isbnRaw : null;
    const page_count =
      typeof doc.number_of_pages_median === "number" && doc.number_of_pages_median > 0
        ? Math.round(doc.number_of_pages_median)
        : null;
    const cover_url =
      typeof doc.cover_i === "number"
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
        : null;
    return { isbn, page_count, cover_url };
  } catch {
    return { isbn: null, page_count: null, cover_url: null };
  }
}

/**
 * Add a catalog / AI suggestion and keep the jacket + page count that search
 * already found. Enrich still runs for blurb/subjects, but we no longer discard
 * the cover URL the user just saw in results.
 */
export async function addBookFromSuggestion(
  s: Suggestion,
  overrides: Partial<BookInsert> = {},
): Promise<Book> {
  const year = Number.parseInt(s.year, 10);
  let cover = upgradeCoverUrl(s.cover_url) ?? s.cover_url ?? null;
  let isbn = s.isbn?.replace(/[^0-9Xx]/g, "") || null;
  let pages =
    typeof s.page_count === "number" && s.page_count > 0 ? Math.round(s.page_count) : null;

  if (!isbn || !pages || !cover) {
    const extra = await openLibraryExtras(s.title, s.author ?? "");
    if (!isbn) isbn = extra.isbn;
    if (!pages) pages = extra.page_count;
    if (!cover) cover = extra.cover_url;
  }

  let book = await createBook({
    title: s.title.trim() || "Untitled",
    authors: s.author?.trim() || null,
    status: "to-read",
    published_year: Number.isFinite(year) ? year : null,
    cover_url: cover,
    isbn: isbn && (isbn.length === 10 || isbn.length === 13) ? isbn : null,
    page_count: pages,
    ...overrides,
  });

  // Persist the search jacket immediately so enrich misses don't leave a blank.
  if (cover) {
    try {
      const pulled = await pullCover(book.id, cover);
      if (pulled.found) {
        book = await updateBook(book.id, {
          cover_path: pulled.cover_path ?? book.cover_path,
          cover_url: pulled.cover_url ?? cover,
          locked_at: new Date().toISOString(),
        });
      }
    } catch {
      book = await updateBook(book.id, {
        cover_url: cover,
        locked_at: new Date().toISOString(),
      });
    }
  }

  await enrichBook(book.id).catch(() => {});

  const { data: fresh } = await supabase.from("books").select("*").eq("id", book.id).single();
  if (!fresh) return book;

  // Enrich can clear a Google stub; if we still have nothing, re-apply search art.
  const hasJacket =
    (fresh.cover_path && fresh.cover_path.length > 0) ||
    (fresh.cover_url && !/[?&]vid=ISBN/i.test(fresh.cover_url));
  if (!hasJacket && cover) {
    return updateBook(fresh.id, { cover_url: cover, locked_at: new Date().toISOString() });
  }
  // Keep a page count from search when catalogs had none.
  if ((!fresh.page_count || fresh.page_count <= 0) && pages) {
    return updateBook(fresh.id, { page_count: pages });
  }
  return fresh;
}

export type TagKind = "source" | "subject";

/** Per-user tag → kind map (source = where it came from, subject = topic). */
export async function fetchTagKinds(): Promise<Record<string, TagKind>> {
  const { data, error } = await supabase.from("profiles").select("tag_kinds").maybeSingle();
  if (error) throw error;
  const raw = (data?.tag_kinds ?? {}) as Record<string, string>;
  const out: Record<string, TagKind> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === "source" || v === "subject") out[k] = v;
  }
  return out;
}

export async function saveTagKinds(kinds: Record<string, TagKind>): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from("profiles").update({ tag_kinds: kinds }).eq("id", userId);
  if (error) throw error;
}

export async function setTagKind(tag: string, kind: TagKind | null): Promise<Record<string, TagKind>> {
  const kinds = await fetchTagKinds();
  if (kind === null) delete kinds[tag];
  else kinds[tag] = kind;
  await saveTagKinds(kinds);
  return kinds;
}

/**
 * Rename a tag across the library. Renaming to an existing tag merges
 * (books keep a single copy of the target name).
 */
export async function renameTag(from: string, to: string): Promise<{ updated: number }> {
  const src = from.trim();
  const dest = to.trim();
  if (!src || !dest) throw new Error("Tag name required");
  if (src === dest) return { updated: 0 };

  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("books")
    .select("id, tags")
    .eq("user_id", userId)
    .contains("tags", [src]);
  if (error) throw error;

  let updated = 0;
  for (const row of data ?? []) {
    const next = [...new Set((row.tags ?? []).map((t) => (t === src ? dest : t)))];
    const { error: uErr } = await supabase.from("books").update({ tags: next }).eq("id", row.id);
    if (uErr) throw uErr;
    updated++;
  }

  // Move the kind label with the rename (merge kinds if both existed).
  const kinds = await fetchTagKinds();
  if (kinds[src] || kinds[dest]) {
    const kind = kinds[dest] ?? kinds[src];
    delete kinds[src];
    if (kind) kinds[dest] = kind;
    await saveTagKinds(kinds);
  }

  return { updated };
}

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
 * Ask for books. `catalog` is free (Google Books + Open Library). `search`
 * uses Grok + web search; `recommend` reads the library for what to read next.
 */
export async function askAI(
  mode: "search" | "recommend" | "catalog",
  query = "",
): Promise<Suggestion[]> {
  const { data, error } = await supabase.functions.invoke<{
    recommendations?: Suggestion[];
    error?: string;
  }>("book-ai", { body: { mode, query } });
  // A non-2xx carries the useful message in the body, not in error.message.
  if (data?.error) throw new Error(data.error);
  if (error) throw new Error(error.message);
  return data?.recommendations ?? [];
}

export type BrowseShelf = {
  id: string;
  title: string;
  blurb: string;
  books: Suggestion[];
};

/** New releases + popular shelves — free Google Books browse, no query needed. */
export async function browseNewPopular(): Promise<BrowseShelf[]> {
  const { data, error } = await supabase.functions.invoke<{
    shelves?: BrowseShelf[];
    error?: string;
  }>("book-ai", { body: { mode: "browse" } });
  if (data?.error) throw new Error(data.error);
  if (error) throw new Error(error.message);
  return data?.shelves ?? [];
}

export type CoverPullResult = {
  found: boolean;
  source?: string;
  cover_path?: string | null;
  cover_url?: string | null;
};

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

/** True when a pasted string looks like a direct cover image URL. */
function isLikelyCoverImageUrl(url: string): boolean {
  if (/\.(jpg|jpeg|png|webp|gif)(\?|#|$)/i.test(url)) return true;
  if (/covers\.openlibrary\.org/i.test(url)) return true;
  if (/books\.google\.[^/]+\/books\/content/i.test(url)) return true;
  if (/googleusercontent\.com\/books/i.test(url)) return true;
  if (/m\.media-amazon\.com\/images/i.test(url)) return true;
  if (/images-.*\.ssl-images-amazon\.com/i.test(url)) return true;
  if (/compressed\.photo\.goodreads\.com|i\.gr-assets\.com/i.test(url)) return true;
  if (/cdn\.shopify\.com\/s\/files|\/cdn\/shop\/files\//i.test(url)) return true;
  return false;
}

function cleanPastedCoverUrl(raw: string): string {
  let u = raw.trim().replace(/^['"<]+/, "").replace(/['">]+$/, "").trim();
  if (u.startsWith("//")) u = `https:${u}`;
  return upgradeCoverUrl(u) ?? u;
}

/** Stick a pasted image URL on the book so the jacket updates immediately. */
async function saveCoverHotlink(bookId: string, url: string): Promise<CoverPullResult> {
  const cover_url = cleanPastedCoverUrl(url);
  // Clear cover_path — otherwise a CDN-cached storage object keeps the old art.
  await updateBook(bookId, {
    cover_url,
    cover_path: null,
    locked_at: new Date().toISOString(),
  });
  return { found: true, source: "link", cover_path: null, cover_url };
}

/**
 * Pull a jacket for a blank book. Catalog enrich first (same path as bulk
 * cover backfill), then Grok web search. With `url`, fetch that page/image.
 */
export async function pullCover(bookId: string, url?: string): Promise<CoverPullResult> {
  const pasted = url?.trim() ? cleanPastedCoverUrl(url) : "";

  // Drop Google's shared "no cover" stub so a retry can store a real jacket.
  const { data: existing } = await supabase
    .from("books")
    .select("cover_path,cover_url")
    .eq("id", bookId)
    .maybeSingle();
  if (existing?.cover_url && /[?&]vid=ISBN/i.test(existing.cover_url)) {
    await updateBook(bookId, { cover_path: null, cover_url: null });
  }

  // Paste path: apply a direct image URL immediately so the UI swaps before
  // the edge round-trip, then best-effort store our own copy.
  if (pasted) {
    if (!/^https?:\/\//i.test(pasted)) {
      throw new Error("Paste a full https:// image link.");
    }
    const direct = isLikelyCoverImageUrl(pasted);
    if (direct) await saveCoverHotlink(bookId, pasted);
    try {
      const { data } = await supabase.functions.invoke<CoverPullResult & { error?: string }>(
        "book-ai",
        { body: { mode: "cover", bookId, url: pasted } },
      );
      if (data?.found) {
        const cover_url = data.cover_url ?? (direct ? pasted : null);
        await updateBook(bookId, {
          cover_path: data.cover_path ?? null,
          cover_url,
          locked_at: new Date().toISOString(),
        });
        return {
          found: true,
          source: "link",
          cover_path: data.cover_path ?? null,
          cover_url,
        };
      }
    } catch {
      // Hotlink may already be saved — edge store is optional.
    }
    if (direct) return { found: true, source: "link", cover_path: null, cover_url: pasted };
    throw new Error(
      "That link didn't yield a cover. Paste a direct image URL (…jpg/png).",
    );
  }

  // Reuse the battle-tested cover pipeline before spending AI tokens.
  await supabase.functions.invoke("backfill-covers", { body: { bookId } }).catch(() => {});
  const { data: row } = await supabase
    .from("books")
    .select("cover_path,cover_url")
    .eq("id", bookId)
    .maybeSingle();
  if (
    row?.cover_path &&
    row.cover_path.length > 0 &&
    !(row.cover_url && /[?&]vid=ISBN/i.test(row.cover_url))
  ) {
    return { found: true, source: "catalog", cover_path: row.cover_path };
  }
  if (row?.cover_url && !/[?&]vid=ISBN/i.test(row.cover_url)) {
    return {
      found: true,
      source: "catalog",
      cover_path: row.cover_path ?? null,
      cover_url: row.cover_url,
    };
  }

  const { data, error } = await supabase.functions.invoke<CoverPullResult & { error?: string }>(
    "book-ai",
    { body: { mode: "cover", bookId } },
  );
  if (data?.found) return data;
  if (data?.error) throw new Error(data.error);
  if (error) {
    throw new Error(await edgeErrorMessage(error, "Couldn't find a cover for this one."));
  }
  throw new Error(data?.error ?? "Couldn't find a cover for this one.");
}

/** Repair StoryGraph / catalog blurbs where ’ and — became "?". */
export function cleanBookText(text: string): string {
  return text
    .replace(/\uFFFD/g, "'")
    .replace(/([A-Za-z])\?(t|s|re|ve|ll|d|m)\b/g, "$1'$2")
    .replace(/([A-Za-z])\?([A-Za-z])/g, "$1—$2");
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
  // PostgREST caps a single response at ~1,000 rows even when .limit() is
  // higher — page through so the Highlights card doesn't stop at "1,000".
  const PAGE = 1000;
  const out: Record<string, number> = {};
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("book_highlights")
      .select("book_id")
      .not("book_id", "is", null)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data ?? [];
    for (const r of rows) {
      if (r.book_id) out[r.book_id] = (out[r.book_id] ?? 0) + 1;
    }
    if (rows.length < PAGE) break;
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
 * Grok) so the reader never has to set it by hand.
 */
export async function enrichBook(
  bookId: string,
  opts: { skipCovers?: boolean } = {},
): Promise<BackfillResult> {
  const { data, error } = await supabase.functions.invoke<BackfillResult & { error?: string }>(
    "backfill-covers",
    { body: { bookId, skipCovers: opts.skipCovers === true } },
  );
  if (error) throw new Error(error.message);
  if (!data || data.error) throw new Error(data?.error ?? "Lookup failed");

  // Subjects may have settled fiction; Grok fills holes + series. Skip when
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
  /** 1 = best month ever by pages logged; null when this month has no pages. */
  monthRank: number | null;
  monthTotal: number;
  /** 1 = best week ever by pages logged; null when this week has no pages. */
  weekRank: number | null;
  weekTotal: number;
  /** 1 = best month ever by books finished; null when this month has none. */
  booksMonthRank: number | null;
  booksMonthTotal: number;
  /** 1 = best week ever by books finished; null when this week has none. */
  booksWeekRank: number | null;
  booksWeekTotal: number;
  weekStart: string;
  monthStart: string;
  today: string;
};

/** Monday-start week bounds (Central calendar dates, same as todayStr). */
export function periodBounds(today = todayStr()) {
  const d = new Date(`${today}T12:00:00`);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  return {
    today,
    weekStart: shiftDay(today, -dow),
    monthStart: `${today.slice(0, 7)}-01`,
  };
}

export type PagesContribution = {
  bookId: string | null;
  title: string;
  authors: string | null;
  book: Book | null;
  pages: number;
};

/** Pages logged in [from, to], rolled up per book (most pages first). */
export function pagesContributions(
  sessions: ReadingSession[],
  books: Book[],
  from: string,
  to: string,
): PagesContribution[] {
  const byId = new Map(books.map((b) => [b.id, b]));
  const agg = new Map<string, number>();
  for (const s of sessions) {
    if (s.session_date < from || s.session_date > to) continue;
    const key = s.book_id ?? "__none__";
    agg.set(key, (agg.get(key) ?? 0) + s.pages_read);
  }
  return [...agg.entries()]
    .map(([key, pages]) => {
      const book = key === "__none__" ? null : (byId.get(key) ?? null);
      return {
        bookId: book?.id ?? (key === "__none__" ? null : key),
        title: book?.title ?? "Unknown book",
        authors: book?.authors ?? null,
        book,
        pages,
      };
    })
    .sort((a, b) => b.pages - a.pages || a.title.localeCompare(b.title));
}

export type FinishedContribution = {
  book: Book;
  ended: string;
  started: string | null;
};

/** Read-throughs finished in [from, to], newest finish first. */
export function finishedContributions(
  books: Book[],
  from: string,
  to: string,
): FinishedContribution[] {
  const out: FinishedContribution[] = [];
  for (const b of books) {
    for (const r of b.read_log ?? []) {
      if (!r.end || r.end < from || r.end > to) continue;
      out.push({ book: b, ended: r.end, started: r.start });
    }
  }
  return out.sort(
    (a, b) => b.ended.localeCompare(a.ended) || a.book.title.localeCompare(b.book.title),
  );
}

/** Inclusive day span between two YYYY-MM-DD dates. */
export function inclusiveDays(start: string | null | undefined, end: string): number | null {
  if (!start) return null;
  const a = Date.parse(`${start.slice(0, 10)}T12:00:00`);
  const b = Date.parse(`${end.slice(0, 10)}T12:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.round((b - a) / 86_400_000) + 1;
}

/**
 * 1-based finish counts for the week / month / year containing `finishedAt`.
 * Adds this finish when the in-memory library hasn't refreshed yet.
 */
export function finishOrdinals(
  books: Book[],
  bookId: string,
  finishedAt: string,
): { week: number; month: number; year: number } {
  const day = finishedAt.slice(0, 10);
  const { weekStart, monthStart } = periodBounds(day);
  const yearStart = `${day.slice(0, 4)}-01-01`;

  const countIn = (from: string) => {
    let n = 0;
    let includesThis = false;
    for (const b of books) {
      for (const r of b.read_log ?? []) {
        if (!r.end || r.end < from || r.end > day) continue;
        n += 1;
        if (b.id === bookId && r.end === day) includesThis = true;
      }
    }
    if (!includesThis) n += 1;
    return n;
  };

  return {
    week: countIn(weekStart),
    month: countIn(monthStart),
    year: countIn(yearStart),
  };
}

/** True when finishing should ask for a first-time rating before the recap card. */
export function needsFinishRatingPrompt(book: {
  star_rating?: number | null;
  read_count?: number | null;
}): boolean {
  return book.star_rating == null && (book.read_count ?? 0) === 0;
}

/** Payload for the finish celebration / share card. */
export function buildFinishCard(
  book: Book,
  books: Book[],
  finishedAt = todayStr(),
): {
  title: string;
  authors: string | null;
  coverUrl: string | null;
  pages: number | null;
  days: number | null;
  rating: number | null;
  weekNumber: number;
  monthNumber: number;
  yearNumber: number;
  finishedAt: string;
} {
  const day = finishedAt.slice(0, 10);
  const openStart = (book.read_log ?? []).find((r) => r.start && !r.end)?.start ?? null;
  const closedStart =
    [...(book.read_log ?? [])].reverse().find((r) => r.end === day)?.start ?? null;
  const start = openStart ?? closedStart ?? book.started_at;
  const ordinals = finishOrdinals(books, book.id, day);
  return {
    title: book.title,
    authors: book.authors,
    coverUrl: coverSrc(book),
    pages: book.page_count && book.page_count > 0 ? book.page_count : null,
    days: inclusiveDays(start, day),
    rating: book.star_rating,
    weekNumber: ordinals.week,
    monthNumber: ordinals.month,
    yearNumber: ordinals.year,
    finishedAt: day,
  };
}

/** Monday-start ISO week key (YYYY-MM-DD of that week's Monday). */
export function weekKeyFor(date: string): string {
  const { weekStart } = periodBounds(date);
  return weekStart;
}

/** Finished read-through counts keyed by week Monday / month YYYY-MM. */
function finishedCountsByPeriod(books: Book[]): {
  byWeek: Map<string, number>;
  byMonth: Map<string, number>;
} {
  const byWeek = new Map<string, number>();
  const byMonth = new Map<string, number>();
  for (const b of books) {
    // Count every read-through that finished, not just the book's latest
    // finish — a re-read in a period is a book finished in that period.
    for (const r of b.read_log ?? []) {
      if (!r.end) continue;
      const wk = weekKeyFor(r.end);
      byWeek.set(wk, (byWeek.get(wk) ?? 0) + 1);
      const mk = r.end.slice(0, 7);
      byMonth.set(mk, (byMonth.get(mk) ?? 0) + 1);
    }
  }
  return { byWeek, byMonth };
}

/** Monday-start week; both windows in Central time to match everything else. */
export function periodStats(books: Book[], sessions: ReadingSession[]): PeriodStats {
  const { today, weekStart: weekStartIso, monthStart: monthStartIso } = periodBounds();
  const monthKey = today.slice(0, 7);

  let pagesWeek = 0;
  let pagesMonth = 0;
  const byMonth = new Map<string, number>();
  const byWeek = new Map<string, number>();
  for (const s of sessions) {
    if (s.session_date >= monthStartIso) pagesMonth += s.pages_read;
    if (s.session_date >= weekStartIso) pagesWeek += s.pages_read;
    const mk = s.session_date.slice(0, 7);
    byMonth.set(mk, (byMonth.get(mk) ?? 0) + s.pages_read);
    const wk = weekKeyFor(s.session_date);
    byWeek.set(wk, (byWeek.get(wk) ?? 0) + s.pages_read);
  }
  // Ensure the current month/week is ranked even when empty.
  if (!byMonth.has(monthKey)) byMonth.set(monthKey, pagesMonth);
  if (!byWeek.has(weekStartIso)) byWeek.set(weekStartIso, pagesWeek);

  const finished = finishedCountsByPeriod(books);
  const booksWeek = finished.byWeek.get(weekStartIso) ?? 0;
  const booksMonth = finished.byMonth.get(monthKey) ?? 0;
  // Ensure the current month/week is ranked even when empty.
  if (!finished.byMonth.has(monthKey)) finished.byMonth.set(monthKey, booksMonth);
  if (!finished.byWeek.has(weekStartIso)) finished.byWeek.set(weekStartIso, booksWeek);

  const monthRank = rankDescending(byMonth.get(monthKey) ?? 0, [...byMonth.values()]);
  const weekRank = rankDescending(byWeek.get(weekStartIso) ?? 0, [...byWeek.values()]);
  const booksMonthRank = rankDescending(booksMonth, [...finished.byMonth.values()]);
  const booksWeekRank = rankDescending(booksWeek, [...finished.byWeek.values()]);
  return {
    pagesWeek,
    pagesMonth,
    booksWeek,
    booksMonth,
    monthRank: pagesMonth > 0 ? monthRank : null,
    monthTotal: byMonth.size,
    weekRank: pagesWeek > 0 ? weekRank : null,
    weekTotal: byWeek.size,
    booksMonthRank: booksMonth > 0 ? booksMonthRank : null,
    booksMonthTotal: finished.byMonth.size,
    booksWeekRank: booksWeek > 0 ? booksWeekRank : null,
    booksWeekTotal: finished.byWeek.size,
    weekStart: weekStartIso,
    monthStart: monthStartIso,
    today,
  };
}

/** 1-based rank among totals (higher is better). Ties share the better rank. */
function rankDescending(value: number, all: number[]): number {
  let better = 0;
  for (const n of all) if (n > value) better++;
  return better + 1;
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
  /** 1 = best single day ever by pages logged; null when today is 0. */
  allTimeRank: number | null;
  allTimeDays: number;
};

/**
 * Pages today plus the run of consecutive days that met the goal.
 *
 * Today counts only once it's met, so an unfinished day doesn't read as a
 * broken streak at breakfast — the run is measured from yesterday backwards
 * and today is added on top when it qualifies.
 */
export type TopReadingDay = {
  date: string;
  pages: number;
  rank: number;
  isToday: boolean;
};

/** Best single days by pages logged — used for the all-time day rank drill-down. */
export function topReadingDays(sessions: ReadingSession[], limit = 10): TopReadingDay[] {
  const byDay = new Map<string, number>();
  for (const s of sessions) {
    byDay.set(s.session_date, (byDay.get(s.session_date) ?? 0) + s.pages_read);
  }
  const today = todayStr();
  const ranked = [...byDay.entries()]
    .filter(([, pages]) => pages > 0)
    .sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]));

  const out: TopReadingDay[] = [];
  let i = 0;
  while (i < ranked.length && out.length < limit) {
    const pages = ranked[i]![1];
    // Ties share a rank (1, 1, 3…) matching rankDescending used for today's badge.
    const rank = i + 1;
    let j = i;
    while (j < ranked.length && ranked[j]![1] === pages) {
      if (out.length < limit) {
        out.push({
          date: ranked[j]![0],
          pages,
          rank,
          isToday: ranked[j]![0] === today,
        });
      }
      j += 1;
    }
    i = j;
  }
  return out;
}

export type TopReadingPeriod = {
  /** Week Monday (YYYY-MM-DD) or month key (YYYY-MM). */
  key: string;
  label: string;
  pages: number;
  rank: number;
  isCurrent: boolean;
  from: string;
  to: string;
};

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function weekRangeLabel(weekStart: string): string {
  const end = shiftDay(weekStart, 6);
  const a = new Date(`${weekStart}T12:00:00`);
  const b = new Date(`${end}T12:00:00`);
  const sameMonth = a.getMonth() === b.getMonth();
  const left = a.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const right = b.toLocaleDateString("en-US", {
    month: sameMonth ? undefined : "short",
    day: "numeric",
    year: a.getFullYear() === b.getFullYear() ? undefined : "numeric",
  });
  const year =
    a.getFullYear() === new Date().getFullYear() ? "" : `, ${a.getFullYear()}`;
  return `${left} – ${right}${year}`;
}

function lastDayOfMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return `${ym}-28`;
  // Day 0 of next month = last day of this month.
  const d = new Date(Date.UTC(y, m, 0));
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${ym}-${dd}`;
}

function rankPeriodMap(
  byKey: Map<string, number>,
  currentKey: string,
  limit: number,
  labelFor: (key: string) => string,
  rangeFor: (key: string) => { from: string; to: string },
): TopReadingPeriod[] {
  const ranked = [...byKey.entries()]
    .filter(([, pages]) => pages > 0)
    .sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]));

  const out: TopReadingPeriod[] = [];
  let i = 0;
  while (i < ranked.length && out.length < limit) {
    const pages = ranked[i]![1];
    const rank = i + 1;
    let j = i;
    while (j < ranked.length && ranked[j]![1] === pages) {
      if (out.length < limit) {
        const key = ranked[j]![0];
        const { from, to } = rangeFor(key);
        out.push({
          key,
          label: labelFor(key),
          pages,
          rank,
          isCurrent: key === currentKey,
          from,
          to,
        });
      }
      j += 1;
    }
    i = j;
  }
  return out;
}

/** Best weeks by pages logged — used for the week-rank drill-down. */
export function topReadingWeeks(sessions: ReadingSession[], limit = 10): TopReadingPeriod[] {
  const byWeek = new Map<string, number>();
  for (const s of sessions) {
    const wk = weekKeyFor(s.session_date);
    byWeek.set(wk, (byWeek.get(wk) ?? 0) + s.pages_read);
  }
  const { weekStart } = periodBounds();
  return rankPeriodMap(
    byWeek,
    weekStart,
    limit,
    weekRangeLabel,
    (key) => ({ from: key, to: shiftDay(key, 6) }),
  );
}

/** Best months by pages logged — used for the month-rank drill-down. */
export function topReadingMonths(sessions: ReadingSession[], limit = 10): TopReadingPeriod[] {
  const byMonth = new Map<string, number>();
  for (const s of sessions) {
    const mk = s.session_date.slice(0, 7);
    byMonth.set(mk, (byMonth.get(mk) ?? 0) + s.pages_read);
  }
  const { today } = periodBounds();
  const monthKey = today.slice(0, 7);
  return rankPeriodMap(
    byMonth,
    monthKey,
    limit,
    monthLabel,
    (key) => ({ from: `${key}-01`, to: lastDayOfMonth(key) }),
  );
}

/** Best weeks by books finished — used for the books week-rank drill-down. */
export function topFinishedWeeks(books: Book[], limit = 10): TopReadingPeriod[] {
  const { byWeek } = finishedCountsByPeriod(books);
  const { weekStart } = periodBounds();
  return rankPeriodMap(
    byWeek,
    weekStart,
    limit,
    weekRangeLabel,
    (key) => ({ from: key, to: shiftDay(key, 6) }),
  );
}

/** Best months by books finished — used for the books month-rank drill-down. */
export function topFinishedMonths(books: Book[], limit = 10): TopReadingPeriod[] {
  const { byMonth } = finishedCountsByPeriod(books);
  const { today } = periodBounds();
  const monthKey = today.slice(0, 7);
  return rankPeriodMap(
    byMonth,
    monthKey,
    limit,
    monthLabel,
    (key) => ({ from: `${key}-01`, to: lastDayOfMonth(key) }),
  );
}

export function dailyProgress(sessions: ReadingSession[], goal: number | null): DailyProgress {
  const byDay = new Map<string, number>();
  for (const s of sessions) {
    byDay.set(s.session_date, (byDay.get(s.session_date) ?? 0) + s.pages_read);
  }

  const today = todayStr();
  const pagesToday = byDay.get(today) ?? 0;
  const metToday = goal !== null && pagesToday >= goal;
  if (!byDay.has(today)) byDay.set(today, pagesToday);

  const dayTotals = [...byDay.values()];
  const allTimeDays = dayTotals.filter((n) => n > 0).length || (pagesToday > 0 ? 1 : 0);
  const allTimeRank = pagesToday > 0 ? rankDescending(pagesToday, dayTotals) : null;

  if (goal === null) {
    return {
      today: pagesToday,
      goal,
      metToday: false,
      streak: 0,
      bestStreak: 0,
      allTimeRank,
      allTimeDays,
    };
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

  return {
    today: pagesToday,
    goal,
    metToday,
    streak,
    bestStreak: Math.max(best, streak),
    allTimeRank,
    allTimeDays,
  };
}
