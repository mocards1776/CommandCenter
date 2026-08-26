import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Enriches imported books: cover art, page count, description, subjects,
// publisher and year. The StoryGraph export carries none of those, which is why
// a freshly imported library looks empty beyond titles and ratings.
//
// Batched: the caller loops until `remaining` is 0. Progress is recorded per
// book (enriched_at), so a run that dies partway resumes instead of restarting.
//
// Open Library is the primary source. Descriptions live on the *work* record,
// not the edition — `/api/books` never returns one, which is why the first
// version of this function produced 1 description across 385 books. Google
// Books JSON API is a fallback (anonymous callers get 429 without a key). For
// brand-new bestsellers missing from both catalogs, we sniff an ISBN via
// DuckDuckGo lite and scrape Google Books' public HTML page — still free.

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UA = "CommandCenter/1.0 (personal reading tracker)";

// Optional. Anonymous Google Books calls get 429'd almost every time, so
// without this the only real metadata source is Open Library. Set it with:
//   supabase secrets set GOOGLE_BOOKS_API_KEY=...
const GOOGLE_KEY = Deno.env.get("GOOGLE_BOOKS_API_KEY") ?? "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/** Abort slow upstreams so one hung request can't eat the whole batch. */
async function fetchWithTimeout(url: string, ms = 6000, init: RequestInit = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, {
      ...init,
      signal: ctl.signal,
      headers: { "User-Agent": UA, ...(init.headers ?? {}) },
    });
  } finally {
    clearTimeout(t);
  }
}

type Meta = {
  page_count?: number;
  description?: string;
  publisher?: string;
  published_year?: number;
  subtitle?: string;
  subjects?: string[];
  isbn?: string;
  coverUrl?: string;
};

/** "The Mannings: The Fall…" → try the short work title Open Library indexes. */
function titleVariants(title: string): string[] {
  const raw = title.trim();
  if (!raw) return [];
  const beforeColon = raw.split(/[:\u2014\u2013]|\s+-\s+/)[0].trim();
  const out: string[] = [];
  for (const t of [beforeColon, raw]) {
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

function titlesMatch(wantTitle: string, gotTitle: string): boolean {
  const want = wantTitle.toLowerCase().replace(/[^a-z0-9]/g, "");
  const got = gotTitle.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!want || !got) return false;
  // Either side may be the short work title or the full edition title.
  return want.startsWith(got.slice(0, Math.min(12, got.length))) ||
    got.startsWith(want.slice(0, Math.min(12, want.length))) ||
    want.includes(got) ||
    got.includes(want);
}

/**
 * Fiction/non-fiction from catalog subjects when the signal is clear.
 * Open Library and Google often tag "Fiction", "Fantasy fiction", or
 * "Biography & Autobiography" — enough to fill the boolean without Claude.
 * Ambiguous or conflicting tags return null so the classifier can decide.
 */
function inferFiction(subjects: string[] | undefined | null): boolean | null {
  if (!subjects?.length) return null;
  let fictionHit = false;
  let nonfictionHit = false;
  for (const raw of subjects) {
    const s = raw.toLowerCase();
    if (/\bnon[\s-]?fiction\b/.test(s)) nonfictionHit = true;
    else if (/\bfiction\b/.test(s)) fictionHit = true;
    else if (/\b(biography|autobiography|memoir|self-help)\b/.test(s)) nonfictionHit = true;
  }
  if (fictionHit && !nonfictionHit) return true;
  if (nonfictionHit && !fictionHit) return false;
  return null;
}

/** Open Library stores descriptions as either a string or {type, value}. */
function plainText(v: unknown): string | undefined {
  const s = typeof v === "string" ? v : (v as { value?: string } | null)?.value;
  if (typeof s !== "string" || !s.trim()) return undefined;
  // Trailing source credits ("([source][1])") are noise in a book blurb.
  return s.split(/\r?\n\s*-{3,}/)[0].replace(/\(\[source\]\[\d+\]\)/gi, "").trim().slice(0, 4000);
}

function year(v: unknown): number | undefined {
  const m = String(v ?? "").match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  return m ? Number.parseInt(m[1], 10) : undefined;
}

/** Upgrade catalog jacket URLs to the largest available size. */
function upgradeCoverUrl(url: string): string | null {
  if (!url?.trim()) return null;
  let u = url.trim().replace(/^http:/i, "https:");
  if (/[?&]vid=ISBN/i.test(u)) return null;
  u = u.replace(/\/b\/(id|isbn|olid)\/([^/?#]+)-(S|M)\.jpe?g(\?[^#]*)?$/i, "/b/$1/$2-L.jpg$4");
  if (/books\.google\.|googleusercontent\.com\/books/i.test(u)) {
    u = u.replace(/([?&])edge=curl(&)?/gi, (_, p1, p2) => (p2 ? p1 : ""));
    // Prefer zoom=4: for brand-new titles zoom=0/3 is often a grayscale stub
    // while zoom=4 still serves the publisher jacket. grabImage retries others.
    if (/[?&]zoom=\d+/i.test(u)) u = u.replace(/([?&])zoom=\d+/gi, "$1zoom=4");
    else u += (u.includes("?") ? "&" : "?") + "zoom=4";
    if (!/[?&]img=/i.test(u)) u += "&img=1";
  }
  return u;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** First ISBN-13 in free-form text (DuckDuckGo / Google Books HTML). */
function firstIsbn13(text: string): string | null {
  const matches = text.match(/\b97[89][0-9]{10}\b/g) ?? [];
  return matches[0] ?? null;
}

/**
 * Brand-new bestsellers often aren't in Open Library yet, and the Google Books
 * *API* rate-limits anonymous callers to nothing. DuckDuckGo lite still surfaces
 * the ISBN from retailer snippets — free, no key.
 */
async function discoverIsbn(title: string, authors: string | null): Promise<string | null> {
  const author = (authors ?? "").split(",")[0].trim();
  const q = `"${titleVariants(title)[0] ?? title}"${author ? ` ${author}` : ""} ISBN`;
  try {
    const res = await fetchWithTimeout(
      `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}`,
      9000,
    );
    if (res.ok) {
      const isbn = firstIsbn13(await res.text());
      if (isbn) return isbn;
    }
  } catch {
    // try Google Books HTML next
  }
  try {
    const gq = `intitle:"${titleVariants(title)[0] ?? title}"${
      author ? ` inauthor:${author}` : ""
    }`;
    const res = await fetchWithTimeout(
      `https://books.google.com/books?q=${encodeURIComponent(gq)}&hl=en`,
      9000,
    );
    if (res.ok) return firstIsbn13(await res.text());
  } catch {
    // no isbn
  }
  return null;
}

/**
 * Scrape Google Books' public HTML page (not the JSON API). Works without an
 * API key and covers brand-new titles the Open Library catalog hasn't ingested.
 */
async function lookupGoogleBooksHtml(
  title: string,
  authors: string | null,
  isbnHint?: string | null,
): Promise<Meta> {
  const out: Meta = {};
  let isbn = (isbnHint ?? "").replace(/[^0-9Xx]/g, "");
  if (!(isbn.length === 10 || isbn.length === 13)) {
    isbn = (await discoverIsbn(title, authors)) ?? "";
  }
  if (!(isbn.length === 10 || isbn.length === 13)) return out;

  try {
    const res = await fetchWithTimeout(
      `https://books.google.com/books?vid=ISBN${isbn}&hl=en`,
      10000,
    );
    if (!res.ok) return out;
    const html = await res.text();

    const desc =
      /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i.exec(html)?.[1] ??
      /<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i.exec(html)?.[1];
    if (desc) out.description = plainText(decodeEntities(desc));

    const pages =
      /Length(?:<\/span>)?<\/td>\s*<td[^>]*>\s*(?:<span[^>]*>)?\s*(\d+)\s*pages/i.exec(html)?.[1] ??
      />(\d+)\s*pages<\/span>/i.exec(html)?.[1];
    if (pages) {
      const n = Number.parseInt(pages, 10);
      if (n > 0 && n < 5000) out.page_count = n;
    }

    const pubCell =
      /Publisher(?:<\/span>)?<\/td>\s*<td[^>]*>\s*(?:<span[^>]*>)?\s*([^<]+)/i.exec(html)?.[1];
    if (pubCell) {
      const cleaned = decodeEntities(pubCell).replace(/,\s*\d{4}\s*$/, "").trim();
      if (cleaned) out.publisher = cleaned;
      out.published_year ??= year(pubCell);
    }

    const isbnCell =
      /(?:metadata_label[^>]*>\s*(?:<span[^>]*>)?\s*)?ISBN(?:<\/span>)?<\/td>\s*<td[^>]*>\s*(?:<span[^>]*>)?\s*([^<]+)/i
        .exec(html)?.[1];
    if (isbnCell && /[0-9]{9,}/.test(isbnCell)) {
      const prefer = firstIsbn13(isbnCell.replace(/[^0-9Xx,\s]/g, ""));
      out.isbn = prefer ?? isbn.replace(/[^0-9Xx]/g, "");
    } else {
      out.isbn = isbn.replace(/[^0-9Xx]/g, "");
    }

    const vol =
      /"volume_id"\s*:\s*"([A-Za-z0-9_-]+)"/.exec(html)?.[1] ??
      /books\/about\/[^"?]+html\?id=([A-Za-z0-9_-]+)/i.exec(html)?.[1] ??
      /canonical[^>]+id=([A-Za-z0-9_-]+)/i.exec(html)?.[1];
    if (vol) {
      // zoom=4 is the reliable jacket for titles without a preview scan.
      out.coverUrl =
        `https://books.google.com/books/content?id=${vol}&printsec=frontcover&img=1&zoom=4`;
    } else {
      const og =
        /<meta[^>]+(?:property|name)=["']og:image["'][^>]*content=["']([^"']+)["']/i.exec(html)?.[1] ??
        /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']og:image["']/i.exec(html)?.[1];
      if (og) out.coverUrl = decodeEntities(og).replace(/^http:/i, "https:");
    }

    // Subjects from the bibliographic breadcrumb / subject links.
    const subjects: string[] = [];
    for (const m of html.matchAll(/subject:%22([^%"']+)%22/gi)) {
      const label = decodeEntities(decodeURIComponent(m[1].replace(/\+/g, " "))).trim();
      if (label && label.length < 40) subjects.push(label);
    }
    out.subjects = cleanSubjects(subjects);

    out.published_year ??= year(html);
  } catch {
    // partial / empty is fine — caller merges with other sources
  }
  return out;
}

/** True when a stored cover_url is worth keeping (not Google's shared stub). */
function isValidCoverUrl(url: string | null | undefined): boolean {
  if (!url || !url.trim()) return false;
  return !/[?&]vid=ISBN/i.test(url);
}

function hasJacket(b: {
  cover_path?: string | null;
  cover_url?: string | null;
}): boolean {
  return Boolean(b.cover_path && b.cover_path.length > 0) || isValidCoverUrl(b.cover_url);
}

/** Pull og:image from a retailer page the book was added from. */
async function coverFromSourcePage(pageUrl: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(pageUrl, 10000, {
      headers: { Accept: "text/html,application/xhtml+xml" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const patterns = [
      /<meta[^>]+(?:property|name)=["']og:image:secure_url["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']og:image:secure_url["']/i,
      /<meta[^>]+(?:property|name)=["']og:image["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']og:image["']/i,
    ];
    for (const re of patterns) {
      const m = re.exec(html);
      if (m?.[1]) {
        let u = decodeEntities(m[1]).trim();
        if (u.startsWith("//")) u = "https:" + u;
        if (/^https?:\/\//i.test(u)) return u.replace(/^http:/i, "https:");
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Best hotlink when we can't store bytes — prefer Google, then Open Library. */
function pickCoverHotlink(urls: string[]): string | null {
  const upgraded = urls.map((u) => upgradeCoverUrl(u)).filter((u): u is string => Boolean(u));
  const google = upgraded.find((u) => /books\.google\.|googleusercontent\.com\/books/i.test(u));
  if (google) return google;
  const ol = upgraded.find((u) => /covers\.openlibrary\.org/i.test(u));
  return ol ?? upgraded[0] ?? null;
}

/** Subjects double as genre chips, so drop the cataloguing cruft. */
function cleanSubjects(list: unknown): string[] | undefined {
  if (!Array.isArray(list)) return undefined;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const s = String(raw ?? "").trim();
    // e.g. "nyt:trade-fiction-paperback=2021-01-31", "accessible book"
    if (!s || s.length > 40 || /[:=]/.test(s) || /^accessible/i.test(s)) continue;
    const label = s[0].toUpperCase() + s.slice(1);
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length === 8) break;
  }
  return out.length ? out : undefined;
}

async function lookupOpenLibrary(isbn: string): Promise<Meta> {
  const out: Meta = {};
  let workKey: string | undefined;

  try {
    const res = await fetchWithTimeout(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=details`,
    );
    if (res.ok) {
      const det = (await res.json())?.[`ISBN:${isbn}`]?.details;
      if (det) {
        if (typeof det.number_of_pages === "number") out.page_count = det.number_of_pages;
        if (typeof det.publishers?.[0] === "string") out.publisher = det.publishers[0];
        if (typeof det.subtitle === "string") out.subtitle = det.subtitle;
        out.published_year = year(det.publish_date);
        out.description = plainText(det.description);
        out.subjects = cleanSubjects(det.subjects);
        if (typeof det.works?.[0]?.key === "string") workKey = det.works[0].key;
      }
    }
  } catch {
    // keep going; a partial result is still worth saving
  }

  // The work record is where blurbs and genre subjects actually live.
  if (workKey && (!out.description || !out.subjects)) {
    try {
      const res = await fetchWithTimeout(`https://openlibrary.org${workKey}.json`);
      if (res.ok) {
        const work = await res.json();
        out.description ??= plainText(work.description);
        out.subjects ??= cleanSubjects(work.subjects);
        // A work's first publication beats a reprint's date for "released".
        out.published_year ??= year(work.first_publish_date);
      }
    } catch {
      // partial result is fine
    }
  }

  return out;
}

/** Cached per book: the same payload answers metadata and cover-art lookups. */
async function googleVolume(isbn: string): Promise<Record<string, unknown> | null> {
  try {
    const key = GOOGLE_KEY ? `&key=${encodeURIComponent(GOOGLE_KEY)}` : "";
    const res = await fetchWithTimeout(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}${key}`,
    );
    if (!res.ok) return null; // 429 without an API key is the common case
    const data = await res.json();
    return data?.items?.[0]?.volumeInfo ?? null;
  } catch {
    return null;
  }
}

function googleMeta(v: Record<string, unknown> | null): Meta {
  const out: Meta = {};
  if (!v) return out;
  if (typeof v.pageCount === "number" && v.pageCount > 0) out.page_count = v.pageCount;
  out.description = plainText(v.description);
  if (typeof v.publisher === "string") out.publisher = v.publisher;
  out.published_year = year(v.publishedDate);
  out.subjects = cleanSubjects(v.categories);
  return out;
}

/**
 * Last resort for the ~500 imported rows that carry no ISBN at all. Open
 * Library's search returns a work key and a cover id, which is enough to get
 * both a blurb and a jacket. Tries the short title first — OL indexes
 * "The Mannings", not the full subtitle string from StoryGraph.
 */
async function lookupByTitle(title: string, authors: string | null): Promise<Meta & { coverId?: number }> {
  const out: Meta & { coverId?: number } = {};
  const author = (authors ?? "").split(",")[0].trim();
  if (!title.trim()) return out;

  for (const variant of titleVariants(title)) {
    try {
      const params = new URLSearchParams({
        title: variant.slice(0, 120),
        limit: "3",
        fields:
          "key,title,author_name,cover_i,first_publish_year,number_of_pages_median,publisher,subject,isbn",
      });
      if (author) params.set("author", author);

      const res = await fetchWithTimeout(`https://openlibrary.org/search.json?${params}`, 9000);
      if (!res.ok) continue;
      const docs = (await res.json())?.docs ?? [];
      const doc = docs.find((d: { title?: string }) => titlesMatch(title, String(d.title ?? ""))) ??
        docs[0];
      if (!doc) continue;
      if (!titlesMatch(title, String(doc.title ?? ""))) continue;

      if (typeof doc.number_of_pages_median === "number") out.page_count = doc.number_of_pages_median;
      if (typeof doc.first_publish_year === "number") out.published_year = doc.first_publish_year;
      if (typeof doc.publisher?.[0] === "string") out.publisher = doc.publisher[0];
      out.subjects = cleanSubjects(doc.subject);
      if (typeof doc.cover_i === "number") out.coverId = doc.cover_i;
      const isbn13 = Array.isArray(doc.isbn)
        ? doc.isbn.find((x: string) => String(x).replace(/[^0-9Xx]/g, "").length === 13)
        : null;
      const isbnAny = Array.isArray(doc.isbn) ? doc.isbn[0] : null;
      if (isbn13 || isbnAny) out.isbn = String(isbn13 ?? isbnAny).replace(/[^0-9Xx]/g, "");

      if (typeof doc.key === "string") {
        const w = await fetchWithTimeout(`https://openlibrary.org${doc.key}.json`);
        if (w.ok) {
          const work = await w.json();
          out.description = plainText(work.description);
          out.subjects ??= cleanSubjects(work.subjects);
        }
      }
      if (out.description || out.page_count || out.coverId) return out;
    } catch {
      // try next variant
    }
  }

  // Google Books by title — often has the blurb when OL's work record is empty.
  try {
    const q = `intitle:${titleVariants(title)[0].slice(0, 80)}${
      author ? ` inauthor:${author.slice(0, 40)}` : ""
    }`;
    const key = GOOGLE_KEY ? `&key=${encodeURIComponent(GOOGLE_KEY)}` : "";
    const res = await fetchWithTimeout(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=3${key}`,
      9000,
    );
    if (res.ok) {
      const items = (await res.json())?.items ?? [];
      for (const it of items) {
        const v = it.volumeInfo ?? {};
        if (!titlesMatch(title, String(v.title ?? ""))) continue;
        const gb = googleMeta(v);
        out.page_count ??= gb.page_count;
        out.description ??= gb.description;
        out.publisher ??= gb.publisher;
        out.published_year ??= gb.published_year;
        out.subjects ??= gb.subjects;
        const ids = Array.isArray(v.industryIdentifiers) ? v.industryIdentifiers : [];
        const isbn13 = ids.find((x: { type?: string }) => x.type === "ISBN_13")?.identifier;
        const isbn10 = ids.find((x: { type?: string }) => x.type === "ISBN_10")?.identifier;
        if (!out.isbn && (isbn13 || isbn10)) out.isbn = String(isbn13 ?? isbn10);
        const links = v.imageLinks as Record<string, string> | undefined;
        const cover = links?.extraLarge ?? links?.large ?? links?.medium ?? links?.thumbnail;
        if (cover) out.coverUrl = String(cover).replace(/^http:/, "https:");
        break;
      }
    }
  } catch {
    // partial OL result is still useful
  }

  return out;
}

/**
 * Google Books placeholder jackets (blue stub + grayscale "no preview" stub).
 * Hash them so we never lock a skeleton onto a book.
 */
const GOOGLE_PLACEHOLDER_SHA256 = new Set([
  "5e7f0425abc77878f2a1efe98f12070d7e97b3047d2ce1cd050598230e34e205",
  // Grayscale stub many 2025–26 titles return at zoom=0 / zoom=3.
  "3efa8c43e5b4348f303a528c81adf435f0111ea752fe9f0f6241478b60987fa6",
]);

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Google zoom levels to try. New titles often stub zoom=0; zoom=4 still has art. */
function googleCoverCandidates(url: string): string[] {
  let base = url.replace(/^http:/i, "https:").replace(/&edge=curl/gi, "");
  if (!/[?&]img=/i.test(base)) base += (base.includes("?") ? "&" : "?") + "img=1";
  const out: string[] = [];
  for (const zoom of [0, 4, 2, 1]) {
    const next = /[?&]zoom=\d+/i.test(base)
      ? base.replace(/([?&])zoom=\d+/gi, `$1zoom=${zoom}`)
      : `${base}&zoom=${zoom}`;
    if (!out.includes(next)) out.push(next);
  }
  return out;
}

async function grabImage(url: string): Promise<{ bytes: Uint8Array; type: string } | null> {
  try {
    // The vid=ISBN form is what returns the shared skeleton placeholder.
    if (/[?&]vid=ISBN/i.test(url)) return null;
    const isGoogle = /books\.google\.|googleusercontent\.com\/books/i.test(url);
    const candidates = isGoogle
      ? googleCoverCandidates(url)
      : [url.replace(/^http:/i, "https:").replace(/\/b\/(id|isbn|olid)\/([^/?#]+)-(S|M)\.jpe?g/i, "/b/$1/$2-L.jpg")];

    for (const fetchUrl of candidates) {
      const res = await fetchWithTimeout(fetchUrl, 8000, { redirect: "follow" });
      if (!res.ok) continue;
      const type = (res.headers.get("Content-Type") ?? "").split(";")[0];
      if (!type.startsWith("image/")) continue;
      const bytes = new Uint8Array(await res.arrayBuffer());
      // Open Library serves a ~1KB placeholder for misses; size is the real test.
      if (bytes.byteLength < 3000) continue;
      if (GOOGLE_PLACEHOLDER_SHA256.has(await sha256Hex(bytes))) continue;
      return { bytes, type };
    }
    return null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Identify with the caller's own token; write with the service role scoped
  // to that id. A user id from the request body is never trusted.
  const asUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: userData, error: userErr } = await asUser.auth.getUser();
  if (userErr || !userData.user) return json({ error: "Not signed in" }, 401);
  const userId = userData.user.id;

  let batch = 12;
  let retryCovers = false;
  let skipCovers = false;
  let bookId: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.batch === "number") batch = Math.min(25, Math.max(1, body.batch));
    if (typeof body?.bookId === "string") bookId = body.bookId;
    retryCovers = body?.retryCovers === true;
    skipCovers = body?.skipCovers === true;
  } catch {
    // defaults are fine
  }

  // Single-book requests re-fetch metadata; covers retry only when missing
  // or the caller explicitly asked (bulk backfill / cover refresh).
  const force = bookId !== null;

  const admin = createClient(supabaseUrl, serviceKey);

  const query = admin
    .from("books")
    .select(
      "id,isbn,title,authors,subtitle,cover_path,cover_url,source_url,locked_at,page_count,publisher,published_year,description,subjects,fiction",
    )
    .eq("user_id", userId);

  const { data: books, error } = force
    ? await query.eq("id", bookId!).limit(1)
    : // No ISBN filter: the title search can still find those.
      await query.is("enriched_at", null).limit(batch);
  if (error) return json({ error: error.message }, 500);

  let covers = 0;
  let pages = 0;
  let blurbs = 0;
  let processed = 0;

  for (const b of books ?? []) {
    processed++;
    const isbn = String(b.isbn ?? "").replace(/[^0-9Xx]/g, "");
    const hasIsbn = isbn.length === 13 || isbn.length === 10;
    const jacket = hasJacket(b);
    // cover_path "" means "looked, found nothing" — don't pay for it twice.
    const wantCover = !skipCovers && !jacket && (retryCovers || b.cover_path == null);
    const patch: Record<string, unknown> = { enriched_at: new Date().toISOString() };

    // Candidate cover URLs in preference order, collected as we look things up.
    const coverUrls: string[] = [];
    let meta: Meta = {};

    if (wantCover) {
      const existing = upgradeCoverUrl(String(b.cover_url ?? ""));
      if (existing) coverUrls.push(existing);
      const sourceUrl = String((b as { source_url?: string | null }).source_url ?? "");
      if (sourceUrl.startsWith("http")) {
        const fromPage = await coverFromSourcePage(sourceUrl);
        if (fromPage) coverUrls.unshift(fromPage);
      }
    }

    if (hasIsbn) {
      const ol = await lookupOpenLibrary(isbn);

      // Fetch Google once and reuse it for metadata and cover art. Skip it
      // entirely when Open Library already answered everything.
      const needGoogle = !ol.description || !ol.page_count || wantCover;
      const volume = needGoogle ? await googleVolume(isbn) : null;
      const gb = googleMeta(volume);

      // Open Library wins field by field; Google only fills the holes.
      meta = {
        page_count: ol.page_count ?? gb.page_count,
        description: ol.description ?? gb.description,
        publisher: ol.publisher ?? gb.publisher,
        published_year: ol.published_year ?? gb.published_year,
        subtitle: ol.subtitle,
        subjects: ol.subjects ?? gb.subjects,
      };

      coverUrls.push(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`);
      const links = (volume?.imageLinks ?? null) as Record<string, string> | null;
      const gbLink = links?.extraLarge ?? links?.large ?? links?.medium ?? links?.thumbnail;
      if (gbLink) coverUrls.push(String(gbLink).replace(/^http:/, "https:"));
    }

    // No ISBN, or the ISBN turned up nothing: fall back to a title search.
    if (!hasIsbn || (!meta.description && !meta.page_count)) {
      const bt = await lookupByTitle(String(b.title ?? ""), (b as { authors?: string }).authors ?? null);
      meta = {
        page_count: meta.page_count ?? bt.page_count,
        description: meta.description ?? bt.description,
        publisher: meta.publisher ?? bt.publisher,
        published_year: meta.published_year ?? bt.published_year,
        subtitle: meta.subtitle,
        subjects: meta.subjects ?? bt.subjects,
        isbn: meta.isbn ?? bt.isbn,
        coverUrl: meta.coverUrl ?? bt.coverUrl,
      };
      if (bt.coverId) coverUrls.push(`https://covers.openlibrary.org/b/id/${bt.coverId}-L.jpg`);
      if (bt.coverUrl) coverUrls.push(bt.coverUrl);
      // Title search often yields an ISBN — use it for a better jacket pass.
      if (!hasIsbn && bt.isbn) {
        coverUrls.unshift(`https://covers.openlibrary.org/b/isbn/${bt.isbn}-L.jpg?default=false`);
      }
    }

    // Brand-new bestsellers: Open Library + Google API often empty, but the
    // public Google Books HTML page (and a free DuckDuckGo ISBN sniff) still
    // have the blurb, page count, and jacket.
    if (!meta.description || !meta.page_count || (wantCover && coverUrls.length === 0 && !meta.coverUrl)) {
      const gb = await lookupGoogleBooksHtml(
        String(b.title ?? ""),
        (b as { authors?: string }).authors ?? null,
        meta.isbn ?? (hasIsbn ? isbn : null),
      );
      meta = {
        page_count: meta.page_count ?? gb.page_count,
        description: meta.description ?? gb.description,
        publisher: meta.publisher ?? gb.publisher,
        published_year: meta.published_year ?? gb.published_year,
        subtitle: meta.subtitle,
        subjects: meta.subjects ?? gb.subjects,
        isbn: meta.isbn ?? gb.isbn,
        coverUrl: meta.coverUrl ?? gb.coverUrl,
      };
      if (gb.coverUrl) coverUrls.unshift(gb.coverUrl);
      if (gb.isbn) {
        coverUrls.push(`https://covers.openlibrary.org/b/isbn/${gb.isbn}-L.jpg?default=false`);
      }
    }

    if (meta.page_count && (force || !b.page_count)) {
      patch.page_count = meta.page_count;
      pages++;
    }
    if (meta.description && (force || !b.description)) {
      patch.description = meta.description;
      blurbs++;
    }
    if (meta.publisher && (force || !b.publisher)) patch.publisher = meta.publisher;
    if (meta.published_year && (force || !b.published_year)) {
      patch.published_year = meta.published_year;
    }
    if (meta.subtitle && (force || !b.subtitle)) patch.subtitle = meta.subtitle;
    if (meta.subjects) patch.subjects = meta.subjects;
    if (meta.isbn && (force || !b.isbn)) patch.isbn = meta.isbn;

    // Fiction is auto-pulled from subjects — never overwrite a value the reader
    // (or the classifier) already set.
    if (b.fiction === null) {
      const inferred = inferFiction(meta.subjects ?? (b as { subjects?: string[] }).subjects);
      if (inferred !== null) patch.fiction = inferred;
    }

    if (wantCover) {
      let img: { bytes: Uint8Array; type: string } | null = null;
      for (const url of coverUrls) {
        img = await grabImage(url);
        if (img) break;
      }

      if (img) {
        const ext = img.type.includes("png") ? "png" : img.type.includes("webp") ? "webp" : "jpg";
        const path = `${userId}/${b.id}.${ext}`;
        const { error: upErr } = await admin.storage
          .from("book-covers")
          .upload(path, img.bytes, { contentType: img.type, upsert: true });
        if (!upErr) {
          patch.cover_path = path;
          patch.locked_at = new Date().toISOString();
          covers++;
        }
      } else {
        const hotlink = pickCoverHotlink(coverUrls);
        if (hotlink && !jacket) {
          patch.cover_url = hotlink;
          patch.cover_path = null;
          patch.locked_at = new Date().toISOString();
          covers++;
        } else if (b.cover_path == null && !isValidCoverUrl(String(b.cover_url ?? ""))) {
          // Mark as searched — but never blank a jacket we already had.
          patch.cover_path = "";
        }
      }
    }

    await admin.from("books").update(patch).eq("id", b.id);
  }

  const { count: remaining } = await admin
    .from("books")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("enriched_at", null);

  return json({
    processed,
    found: covers,
    pages,
    blurbs,
    missed: processed - covers,
    sources: {},
    remaining: remaining ?? 0,
  });
});
