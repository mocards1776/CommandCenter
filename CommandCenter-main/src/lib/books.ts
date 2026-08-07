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
