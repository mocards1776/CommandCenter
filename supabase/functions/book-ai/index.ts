import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
// Unpinned deliberately: an invented version pin fails the deploy outright,
// which is worse than tracking the current SDK.
import Anthropic from "npm:@anthropic-ai/sdk";

// Features over the reading library:
//
//   "recommend" — Claude reads the library and suggests what to read next.
//   "search"    — Claude + web search for natural-language book requests.
//   "catalog"   — FREE search via Google Books + Open Library (no Anthropic).
//   "browse"    — FREE new & popular shelves (Google Books, no Anthropic).
//   "classify"  — batched (or single-book via bookId) fiction/series fill.
//   "cover"     — find and store a jacket (OL / Google / Claude / pasted URL).
//
// Only "search"/"cover" skip structured outputs: web search results carry
// citations, and citations are rejected alongside output_config.format, so
// those paths ask for a JSON block and parse it tolerantly instead of 400ing.

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "claude-opus-5";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

type Suggestion = {
  title: string;
  author: string;
  year: string;
  reason: string;
  cover_url?: string | null;
  isbn?: string | null;
  page_count?: number | null;
};

const UA = "CommandCenter/1.0 (personal reading tracker)";

/**
 * Jacket for a suggested book. Open Library's search returns a cover id, which
 * is enough — these are previews, not library records, so nothing is stored.
 */
async function coverFor(title: string, author: string, size: "M" | "L" = "M"): Promise<string | null> {
  try {
    const params = new URLSearchParams({ title: title.slice(0, 120), limit: "1", fields: "title,cover_i" });
    if (author) params.set("author", author.split(",")[0].trim());
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    const res = await fetch(`https://openlibrary.org/search.json?${params}`, {
      signal: ctl.signal,
      headers: { "User-Agent": UA },
    }).finally(() => clearTimeout(t));
    if (!res.ok) return null;
    const doc = (await res.json())?.docs?.[0];
    return typeof doc?.cover_i === "number"
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-${size}.jpg`
      : null;
  } catch {
    return null;
  }
}

const GOOGLE_KEY = Deno.env.get("GOOGLE_BOOKS_API_KEY") ?? "";

/** Upgrade a Google Books thumbnail into a larger front-cover URL when possible. */
function upgradeGoogleCover(raw: string): string {
  let u = raw.replace(/^http:/, "https:").replace(/&edge=curl/g, "");
  // zoom=0 is the large jacket; API thumbnails arrive as zoom=1 (~128px) or zoom=5 stamps.
  if (u.includes("books.google") || u.includes("googleusercontent.com")) {
    if (/[?&]zoom=\d+/i.test(u)) u = u.replace(/([?&])zoom=\d+/gi, "$1zoom=0");
    else u += (u.includes("?") ? "&" : "?") + "zoom=0";
    if (!/[?&]img=/i.test(u)) u += "&img=1";
  }
  return u;
}

/** Best available jacket URL from Google Books imageLinks. */
function googleCoverLink(links: Record<string, string> | undefined): string | null {
  const raw =
    links?.extraLarge ??
    links?.large ??
    links?.medium ??
    links?.thumbnail ??
    links?.smallThumbnail;
  return raw ? upgradeGoogleCover(String(raw).replace(/^http:/, "https:")) : null;
}

/** Google Books often has a jacket when Open Library does not. */
async function googleCover(title: string, author: string | null, isbn: string | null): Promise<string | null> {
  const queries: string[] = [];
  if (isbn) queries.push(`isbn:${isbn.replace(/[^0-9Xx]/g, "")}`);
  queries.push(
    `intitle:${title.slice(0, 80)}${author ? ` inauthor:${author.split(",")[0].trim().slice(0, 40)}` : ""}`,
  );
  for (const q of queries) {
    try {
      const key = GOOGLE_KEY ? `&key=${encodeURIComponent(GOOGLE_KEY)}` : "";
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 8000);
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1${key}`,
        { signal: ctl.signal, headers: { "User-Agent": UA } },
      ).finally(() => clearTimeout(t));
      if (!res.ok) continue;
      const links = (await res.json())?.items?.[0]?.volumeInfo?.imageLinks as
        | Record<string, string>
        | undefined;
      if (!links) continue;
      const raw = links.extraLarge ?? links.large ?? links.medium ?? links.thumbnail ?? links.smallThumbnail;
      if (raw) return upgradeGoogleCover(String(raw));
    } catch {
      // try next query
    }
  }
  return null;
}

function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * Google Books serves an identical blue "no cover" skeleton for missing jackets
 * (vid=ISBN…&zoom=3). Hash it so we never lock that onto a book.
 */
const GOOGLE_PLACEHOLDER_SHA256 = new Set([
  "5e7f0425abc77878f2a1efe98f12070d7e97b3047d2ce1cd050598230e34e205",
]);

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Download an image URL; reject tiny placeholders and non-images. */
async function grabImage(url: string): Promise<{ bytes: Uint8Array; type: string } | null> {
  try {
    // The vid=ISBN form is what returns the shared skeleton placeholder.
    if (/[?&]vid=ISBN/i.test(url)) return null;
    const fetchUrl = upgradeGoogleCover(url).replace(
      /\/b\/(id|isbn|olid)\/([^/?#]+)-(S|M)\.jpe?g/i,
      "/b/$1/$2-L.jpg",
    );
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 12000);
    const res = await fetch(fetchUrl, {
      signal: ctl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": UA,
        // Some CDNs 403 a bare fetch; Accept helps, and OL covers want a referer-ish UA.
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
    }).finally(() => clearTimeout(t));
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength < 3000 || bytes.byteLength > 4_000_000) return null;
    if (GOOGLE_PLACEHOLDER_SHA256.has(await sha256Hex(bytes))) return null;
    const header = (res.headers.get("Content-Type") ?? "").split(";")[0].trim();
    const type = header.startsWith("image/") ? header : sniffImageType(bytes);
    if (!type) return null;
    return { bytes, type };
  } catch {
    return null;
  }
}

/** True when the URL looks like a direct jacket image (not a retail HTML page). */
function isLikelyImageUrl(url: string): boolean {
  if (/\.(jpg|jpeg|png|webp|gif)(\?|#|$)/i.test(url)) return true;
  if (/covers\.openlibrary\.org/i.test(url)) return true;
  if (/books\.google\.[^/]+\/books\/content/i.test(url)) return true;
  if (/googleusercontent\.com\/books/i.test(url)) return true;
  if (/m\.media-amazon\.com\/images/i.test(url)) return true;
  if (/images-na\.ssl-images-amazon\.com|images-.*\.ssl-images-amazon\.com/i.test(url)) return true;
  if (/compressed\.photo\.goodreads\.com|i\.gr-assets\.com/i.test(url)) return true;
  if (/images\.isbndb\.com|covers\.openbd\.jp/i.test(url)) return true;
  return false;
}

/** Normalize a pasted link (quotes, angle brackets, protocol-relative). */
function normalizeCoverInput(raw: string): string {
  let u = raw.trim().replace(/^['"<]+/, "").replace(/['">]+$/, "").trim();
  if (u.startsWith("//")) u = "https:" + u;
  return u;
}

/** Pull a cover URL out of a retail/library page (og:image / twitter:image). */
async function coverFromPage(pageUrl: string): Promise<string | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 10000);
    const res = await fetch(pageUrl, {
      signal: ctl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
    }).finally(() => clearTimeout(t));
    if (!res.ok) return null;
    const ctype = (res.headers.get("Content-Type") ?? "").toLowerCase();
    // Caller sometimes hands us a direct image that lacks a file extension.
    if (ctype.startsWith("image/")) return pageUrl;
    const html = await res.text();
    const patterns = [
      /<meta[^>]+(?:property|name)=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']og:image(?::secure_url)?["']/i,
      /<meta[^>]+(?:property|name)=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']twitter:image(?::src)?["']/i,
    ];
    for (const re of patterns) {
      const m = re.exec(html);
      if (m?.[1]) {
        let u = m[1].trim();
        if (u.startsWith("//")) u = "https:" + u;
        if (/^https?:\/\//i.test(u)) return u;
      }
    }
    return null;
  } catch {
    return null;
  }
}

type AiCoverHint = { urls: string[]; pages: string[]; isbns: string[] };

/** Collect image URLs, page URLs, and ISBNs Claude mentioned. */
function extractCoverHints(text: string): AiCoverHint {
  const urls: string[] = [];
  const pages: string[] = [];
  const isbns: string[] = [];
  const pushUrl = (raw: string, asPage = false) => {
    let u = raw.trim().replace(/[),.;]+$/, "");
    if (u.startsWith("//")) u = "https:" + u;
    if (!/^https?:\/\//i.test(u)) return;
    const list = asPage ? pages : urls;
    if (!list.includes(u)) list.push(u);
  };
  const pushIsbn = (raw: string) => {
    const n = raw.replace(/[^0-9Xx]/g, "");
    if ((n.length === 10 || n.length === 13) && !isbns.includes(n)) isbns.push(n);
  };

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  try {
    const parsed = JSON.parse(candidate);
    if (typeof parsed?.cover_url === "string") pushUrl(parsed.cover_url);
    if (typeof parsed?.isbn === "string") pushIsbn(parsed.isbn);
    if (Array.isArray(parsed?.cover_urls)) {
      for (const u of parsed.cover_urls) if (typeof u === "string") pushUrl(u);
    }
    if (Array.isArray(parsed?.page_urls)) {
      for (const u of parsed.page_urls) if (typeof u === "string") pushUrl(u, true);
    }
  } catch {
    // fall through to regex sweep
  }

  for (const m of text.matchAll(/https?:\/\/[^\s"'<>]+/gi)) {
    const u = m[0];
    if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(u) || /covers\.openlibrary|books\.google|googleusercontent/i.test(u)) {
      pushUrl(u);
    } else if (/amazon\.|goodreads\.|barnesandnoble\.|bookshop\.org|openlibrary\.org\/(works|books)|books\.google\.[^/]+\/books/i.test(u)) {
      pushUrl(u, true);
    }
  }
  for (const m of text.matchAll(/\b(?:97[89][0-9]{10}|[0-9]{9}[0-9Xx])\b/g)) pushIsbn(m[0]);

  return { urls, pages, isbns };
}

/**
 * Find a jacket for one book and store our own copy. Order: reader URL (if
 * any) → Open Library → Claude web search. Empty cover_path means a prior
 * catalog miss; this path is allowed to overwrite that.
 */
async function findCover(
  admin: ReturnType<typeof createClient>,
  client: Anthropic | null,
  userId: string,
  bookId: string,
  url: string | null,
) {
  const { data: book, error } = await admin
    .from("books")
    .select("id,title,authors,isbn,cover_path")
    .eq("user_id", userId)
    .eq("id", bookId)
    .maybeSingle();
  if (error) return json({ found: false, error: error.message }, 500);
  if (!book) return json({ found: false, error: "Book not found" });

  type Candidate = { url: string; source: string };
  const candidates: Candidate[] = [];
  const push = (u: string | null | undefined, source: string) => {
    if (!u) return;
    let next = u.trim();
    if (next.startsWith("//")) next = "https:" + next;
    if (!/^https?:\/\//i.test(next)) return;
    if (candidates.some((c) => c.url === next)) return;
    candidates.push({ url: next, source });
  };

  if (url) {
    const pasted = normalizeCoverInput(url);
    // Direct image, or a book page whose og:image is the jacket.
    if (isLikelyImageUrl(pasted)) {
      push(pasted, "link");
    } else {
      push(await coverFromPage(pasted), "link");
      // Image CDNs sometimes omit a file extension — try the URL itself last.
      push(pasted, "link");
    }
  } else {
    const isbn = String(book.isbn ?? "").replace(/[^0-9Xx]/g, "");
    if (isbn.length === 10 || isbn.length === 13) {
      push(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`, "openlibrary");
      push(`https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`, "openlibrary");
    }
    push(await coverFor(String(book.title ?? ""), book.authors ?? "", "L"), "openlibrary");
    push(await coverFor(String(book.title ?? ""), book.authors ?? "", "M"), "openlibrary");
    push(await googleCover(String(book.title ?? ""), book.authors, book.isbn), "google");
  }

  let img: { bytes: Uint8Array; type: string } | null = null;
  let usedUrl: string | null = null;
  let source = "none";
  for (const c of candidates) {
    img = await grabImage(c.url);
    if (img) {
      usedUrl = c.url;
      source = c.source;
      break;
    }
  }

  // Catalog miss (or dead OL link): spend tokens on a web search.
  let aiError: string | null = null;
  if (!img && !url && client) {
    const q =
      `"${book.title}"${book.authors ? ` ${book.authors.split(",")[0].trim()}` : ""}` +
      `${book.isbn ? ` ISBN ${book.isbn}` : ""}`;
    try {
      const message = await askClaude(client, {
        model: MODEL,
        max_tokens: 4000,
        thinking: { type: "adaptive" },
        output_config: { effort: "low" },
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }],
        system:
          "You help fetch book cover art. Search the web and return a ```json fenced block only:\n" +
          '{"isbn":"978...","cover_url":"https://...jpg","cover_urls":["https://..."],' +
          '"page_urls":["https://openlibrary.org/..."]}.\n' +
          "Rules: isbn is the 13-digit ISBN if you can find one (else \"\"). " +
          "cover_url/cover_urls must be DIRECT image files (jpg/png/webp) when possible — " +
          "prefer covers.openlibrary.org/b/isbn/... or Google Books content URLs. " +
          "page_urls are retail/library pages that show the cover (Open Library, Amazon, Goodreads). " +
          "Always fill whatever you can; empty strings/arrays are ok.",
        messages: [{ role: "user", content: `Find the cover for: ${q}` }],
      });
      if (message.stop_reason === "refusal") {
        aiError = "Claude declined that cover search.";
      } else {
        const text = (message.content ?? [])
          .filter((b: { type: string }) => b.type === "text")
          .map((b: { text: string }) => b.text)
          .join("\n");
        const hint = extractCoverHints(text);

        // ISBNs beat hotlinked retail images — OL will serve bytes we can store.
        for (const isbn of hint.isbns) {
          push(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`, "ai");
          push(`https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`, "ai");
        }
        for (const u of hint.urls) push(upgradeGoogleCover(u), "ai");
        for (const page of hint.pages.slice(0, 4)) {
          push(await coverFromPage(page), "ai");
        }

        for (const c of candidates.filter((c) => c.source === "ai")) {
          img = await grabImage(c.url);
          if (img) {
            usedUrl = c.url;
            source = "ai";
            break;
          }
        }
      }
    } catch (e) {
      aiError = e instanceof Error ? e.message : String(e);
    }
  }

  if (!img || !usedUrl) {
    // Pasted image URL we couldn't download (CDN bot wall, etc.): still save the
    // hotlink and clear cover_path so the client actually shows the new jacket.
    if (url) {
      const hotlink =
        candidates.find((c) => c.source === "link" && isLikelyImageUrl(c.url))?.url ??
        (isLikelyImageUrl(normalizeCoverInput(url)) ? normalizeCoverInput(url) : null);
      if (hotlink) {
        const { error: hotErr } = await admin
          .from("books")
          .update({
            cover_path: null,
            cover_url: hotlink,
            locked_at: new Date().toISOString(),
          })
          .eq("id", book.id);
        if (hotErr) return json({ found: false, error: hotErr.message }, 500);
        return json({ found: true, source: "link", cover_path: null, cover_url: hotlink });
      }
    }
    // 200 on purpose: supabase-js turns non-2xx into a generic toast and drops
    // the body, so "couldn't find one" has to ride a success status.
    return json({
      found: false,
      error: aiError
        ? `Cover search failed: ${aiError.slice(0, 180)}`
        : url
          ? "That link didn't look like a cover image. Paste a direct image URL (…jpg/png) or a book page with an og:image."
          : "Couldn't find a cover for this one. Try pasting a cover image link.",
    });
  }

  const ext = img.type.includes("png") ? "png" : img.type.includes("webp") ? "webp" : "jpg";
  const path = `${userId}/${book.id}.${ext}`;
  const { error: upErr } = await admin.storage
    .from("book-covers")
    .upload(path, img.bytes, { contentType: img.type, upsert: true });
  if (upErr) {
    // Upload failed but we still have a usable remote URL — prefer showing that
    // over leaving the old jacket in place.
    if (url) {
      const { error: hotErr } = await admin
        .from("books")
        .update({
          cover_path: null,
          cover_url: usedUrl,
          locked_at: new Date().toISOString(),
        })
        .eq("id", book.id);
      if (!hotErr) return json({ found: true, source: "link", cover_path: null, cover_url: usedUrl });
    }
    return json({ error: upErr.message }, 500);
  }

  const { error: updErr } = await admin
    .from("books")
    .update({
      cover_path: path,
      cover_url: usedUrl,
      locked_at: new Date().toISOString(),
    })
    .eq("id", book.id);
  if (updErr) return json({ error: updErr.message }, 500);

  return json({ found: true, source, cover_path: path });
}

const CLASSIFY_SCHEMA = {
  type: "object",
  properties: {
    books: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          fiction: { type: "boolean" },
          // "" when the book stands alone — an empty string is unambiguous in a
          // way a missing key isn't.
          series: { type: "string" },
          series_position: { type: "string" },
        },
        required: ["id", "fiction", "series", "series_position"],
        additionalProperties: false,
      },
    },
  },
  required: ["books"],
  additionalProperties: false,
};

const SUGGESTION_SCHEMA = {
  type: "object",
  properties: {
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          author: { type: "string" },
          // A string, not an integer: "unknown" has to be expressible, and a
          // nullable integer is the shakier schema construct here.
          year: { type: "string" },
          reason: { type: "string" },
        },
        required: ["title", "author", "year", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["recommendations"],
  additionalProperties: false,
};

/** Pull the first JSON object out of a reply that may also contain prose. */
function extractJson(text: string): Suggestion[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  try {
    const parsed = JSON.parse(candidate);
    const list = Array.isArray(parsed) ? parsed : parsed?.recommendations;
    if (!Array.isArray(list)) return [];
    return list
      .filter((r) => r && typeof r.title === "string")
      .map((r) => ({
        title: String(r.title),
        author: String(r.author ?? ""),
        year: String(r.year ?? ""),
        reason: String(r.reason ?? ""),
      }));
  } catch {
    return [];
  }
}

/** Compact the library into something worth spending tokens on. */
function digest(
  books: { title: string; authors: string | null; star_rating: number | null; tags: string[] | null; status: string; finished_at: string | null }[],
) {
  const loved = books
    .filter((b) => (b.star_rating ?? 0) >= 4.5)
    .sort((a, b) => (b.star_rating ?? 0) - (a.star_rating ?? 0))
    .slice(0, 50);

  const recent = books
    .filter((b) => b.status === "read" && b.finished_at)
    .sort((a, b) => (b.finished_at ?? "").localeCompare(a.finished_at ?? ""))
    .slice(0, 20);

  const tagCounts = new Map<string, number>();
  for (const b of books) for (const t of b.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([t, n]) => `${t} (${n})`);

  const line = (b: { title: string; authors: string | null; star_rating: number | null }) =>
    `${b.title}${b.authors ? ` — ${b.authors}` : ""}${b.star_rating ? ` [${b.star_rating}★]` : ""}`;

  return [
    `Library size: ${books.length} books.`,
    topTags.length ? `Most-used tags: ${topTags.join(", ")}.` : "",
    loved.length ? `\nRated 4.5+:\n${loved.map(line).join("\n")}` : "",
    recent.length ? `\nFinished most recently:\n${recent.map(line).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Server-side fallback is the documented default for this model, but it is a
 * beta parameter — if the API rejects it, the request is worth more than the
 * fallback, so retry once without it rather than failing the user's click.
 */
async function askClaude(client: Anthropic, params: Record<string, unknown>) {
  const withFallback = {
    ...params,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  };
  try {
    const stream = client.beta.messages.stream(withFallback as never);
    return await stream.finalMessage();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/fallback|beta/i.test(msg)) throw e;
    const stream = client.beta.messages.stream(params as never);
    return await stream.finalMessage();
  }
}

/**
 * One batch of fiction/series classification. The caller loops until
 * `remaining` is 0. classified_at is the bookmark, so an interrupted run
 * resumes instead of restarting, and re-running only touches new books.
 * Pass `bookId` to classify a single book (e.g. right after enrich) even if
 * it was already stamped — fiction already on the row is left alone.
 */
async function classify(
  admin: ReturnType<typeof createClient>,
  client: Anthropic,
  userId: string,
  batch: number,
  bookId: string | null = null,
) {
  let q = admin
    .from("books")
    .select("id,title,authors,published_year,fiction")
    .eq("user_id", userId);
  q = bookId ? q.eq("id", bookId).limit(1) : q.is("classified_at", null).limit(batch);
  const { data: books, error } = await q;
  if (error) return json({ error: error.message }, 500);
  if (!books?.length) return json({ processed: 0, series: 0, remaining: 0 });

  // Short ids: full UUIDs would be most of the prompt at 60 books a batch.
  const list = books
    .map((b, i) => `${i}. ${b.title}${b.authors ? ` — ${b.authors}` : ""}${b.published_year ? ` (${b.published_year})` : ""}`)
    .join("\n");

  const message = await askClaude(client, {
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "low", format: { type: "json_schema", schema: CLASSIFY_SCHEMA } },
    system:
      "You classify books. For each numbered book return: `id` (the number, as a string), " +
      "`fiction` (true for novels and short-story collections, false for everything else " +
      "including memoir, biography, history and self-help), `series` (the series name, or " +
      '"" if the book stands alone), and `series_position` (the number within the series ' +
      'as a string, or "" if unknown or not applicable). ' +
      "Return one entry per book, in order. If you do not recognise a book, still return an " +
      'entry: guess `fiction` from the title and author, and leave both series fields "".',
    messages: [{ role: "user", content: list }],
  });

  if (message.stop_reason === "refusal") {
    return json({ error: "Claude declined to classify that batch." }, 400);
  }

  const text = (message.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("\n");

  let parsed: { id: string; fiction: boolean; series: string; series_position: string }[] = [];
  try {
    parsed = JSON.parse(text)?.books ?? [];
  } catch {
    return json({ error: "Could not read the classification response." }, 502);
  }

  const now = new Date().toISOString();
  let series = 0;

  // Stamp every book in the batch, including ones the model skipped — otherwise
  // an unrecognised book blocks the loop forever.
  const answered = new Map(parsed.map((p) => [String(p.id), p]));
  for (let i = 0; i < books.length; i++) {
    const got = answered.get(String(i));
    const patch: Record<string, unknown> = { classified_at: now };
    if (got) {
      // Catalog subjects (or a double-click correction) win over the model.
      if (typeof got.fiction === "boolean" && books[i].fiction === null) {
        patch.fiction = got.fiction;
      }
      if (got.series?.trim()) {
        patch.series = got.series.trim();
        const n = Number.parseFloat(got.series_position);
        patch.series_position = Number.isFinite(n) ? n : null;
        series++;
      }
    }
    await admin.from("books").update(patch).eq("id", books[i].id);
  }

  const { count: remaining } = await admin
    .from("books")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("classified_at", null);

  return json({ processed: books.length, series, remaining: remaining ?? 0 });
}

/**
 * Free catalog search — Google Books + Open Library. No Anthropic spend.
 * Used for "Find similar" and the Ask panel's Catalog tab.
 */
function googleIsbn(v: Record<string, unknown>): string | null {
  const ids = v.industryIdentifiers as { type?: string; identifier?: string }[] | undefined;
  if (!Array.isArray(ids)) return null;
  const isbn13 = ids.find((i) => i.type === "ISBN_13")?.identifier;
  const isbn10 = ids.find((i) => i.type === "ISBN_10")?.identifier;
  const raw = String(isbn13 || isbn10 || "").replace(/[^0-9Xx]/g, "");
  return raw.length === 10 || raw.length === 13 ? raw : null;
}

async function catalogSearch(query: string): Promise<Suggestion[]> {
  const q = query.trim().slice(0, 200);
  if (!q) return [];
  const out: Suggestion[] = [];
  const seen = new Set<string>();

  const push = (
    title: string,
    author: string,
    year: string,
    reason: string,
    cover: string | null,
    isbn: string | null = null,
    pageCount: number | null = null,
  ) => {
    const key = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({
      title,
      author,
      year,
      reason,
      cover_url: cover ? upgradeGoogleCover(cover) : null,
      isbn,
      page_count: pageCount && pageCount > 0 ? pageCount : null,
    });
  };

  // Google Books (optional API key avoids anonymous 429s).
  try {
    const key = GOOGLE_KEY ? `&key=${encodeURIComponent(GOOGLE_KEY)}` : "";
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 9000);
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=12${key}`,
      { signal: ctl.signal, headers: { "User-Agent": UA } },
    ).finally(() => clearTimeout(t));
    if (res.ok) {
      const items = (await res.json())?.items ?? [];
      for (const it of items) {
        const v = (it.volumeInfo ?? {}) as Record<string, unknown>;
        const title = String(v.title ?? "").trim();
        if (!title) continue;
        const authors = Array.isArray(v.authors) ? (v.authors as string[]).join(", ") : "";
        const year = String(v.publishedDate ?? "").slice(0, 4);
        const links = v.imageLinks as Record<string, string> | undefined;
        const cover = googleCoverLink(links);
        const cats = Array.isArray(v.categories)
          ? (v.categories as string[]).slice(0, 2).join(" · ")
          : "";
        const pages = typeof v.pageCount === "number" ? v.pageCount : null;
        push(title, authors, year, cats || "Google Books", cover, googleIsbn(v), pages);
      }
    }
  } catch {
    // fall through to Open Library
  }

  // Open Library fills gaps (and works without an API key).
  if (out.length < 8) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 9000);
      const res = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=12&fields=title,author_name,first_publish_year,cover_i,subject,isbn,number_of_pages_median`,
        { signal: ctl.signal, headers: { "User-Agent": UA } },
      ).finally(() => clearTimeout(t));
      if (res.ok) {
        for (const doc of (await res.json())?.docs ?? []) {
          const title = String(doc.title ?? "").trim();
          if (!title) continue;
          const author = Array.isArray(doc.author_name) ? doc.author_name.slice(0, 2).join(", ") : "";
          const year = doc.first_publish_year ? String(doc.first_publish_year) : "";
          const cover = typeof doc.cover_i === "number"
            ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
            : null;
          const sub = Array.isArray(doc.subject) ? String(doc.subject[0] ?? "") : "";
          const isbnRaw = Array.isArray(doc.isbn)
            ? String(doc.isbn.find((x: string) => String(x).replace(/[^0-9Xx]/g, "").length === 13) ??
                doc.isbn[0] ??
                "").replace(/[^0-9Xx]/g, "")
            : "";
          const isbn = isbnRaw.length === 10 || isbnRaw.length === 13 ? isbnRaw : null;
          const pages =
            typeof doc.number_of_pages_median === "number" ? doc.number_of_pages_median : null;
          push(title, author, year, sub || "Open Library", cover, isbn, pages);
          if (out.length >= 12) break;
        }
      }
    } catch {
      // partial results are fine
    }
  }

  return out.slice(0, 12);
}

type BrowseShelf = {
  id: string;
  title: string;
  blurb: string;
  books: Suggestion[];
};

const BROWSE_SHELF_META: { id: string; title: string; blurb: string }[] = [
  {
    id: "new-releases",
    title: "New releases",
    blurb: "Just hitting the front tables.",
  },
  {
    id: "bestsellers",
    title: "Bestsellers",
    blurb: "What’s moving right now — NYT / store charts.",
  },
  {
    id: "fiction",
    title: "Fiction picks",
    blurb: "Novels you’d see stacked by the door.",
  },
  {
    id: "nonfiction",
    title: "Nonfiction picks",
    blurb: "Memoir, history, ideas on the big table.",
  },
];

function normalizeBrowseShelves(raw: unknown): BrowseShelf[] {
  const list = Array.isArray(raw) ? raw : (raw as { shelves?: unknown })?.shelves;
  if (!Array.isArray(list)) return [];
  const out: BrowseShelf[] = [];
  for (const meta of BROWSE_SHELF_META) {
    const hit = list.find(
      (s) => s && typeof s === "object" && String((s as { id?: string }).id ?? "") === meta.id,
    ) as { books?: unknown } | undefined;
    const books: Suggestion[] = [];
    const seen = new Set<string>();
    for (const b of Array.isArray(hit?.books) ? hit!.books : []) {
      if (!b || typeof b !== "object") continue;
      const title = String((b as { title?: string }).title ?? "").trim();
      if (!title) continue;
      const key = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      books.push({
        title,
        author: String((b as { author?: string }).author ?? ""),
        year: String((b as { year?: string }).year ?? ""),
        reason: String((b as { reason?: string }).reason ?? meta.blurb),
      });
      if (books.length >= 10) break;
    }
    if (books.length) out.push({ ...meta, books });
  }
  return out;
}

/**
 * Google fallback when Claude isn't available — prefer high-signal bestsellers /
 * recent titles over raw "newest academic monograph" noise.
 */
async function browseGoogleFrontTables(): Promise<BrowseShelf[]> {
  const year = new Date().getFullYear();
  const key = GOOGLE_KEY ? `&key=${encodeURIComponent(GOOGLE_KEY)}` : "";
  const cutoff = `${year - 1}-01-01`;

  const fetchQuery = async (q: string, orderBy: "newest" | "relevance"): Promise<Suggestion[]> => {
    const books: Suggestion[] = [];
    const seen = new Set<string>();
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 9000);
      const url =
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}` +
        `&orderBy=${orderBy}&maxResults=20&printType=books&langRestrict=en${key}`;
      const res = await fetch(url, {
        signal: ctl.signal,
        headers: { "User-Agent": UA },
      }).finally(() => clearTimeout(t));
      if (!res.ok) return books;
      const items = (await res.json())?.items ?? [];
      // Prefer books people have rated — front-table energy, not obscure newest.
      const ranked = [...items].sort((a, b) => {
        const ra = Number(a?.volumeInfo?.ratingsCount ?? 0);
        const rb = Number(b?.volumeInfo?.ratingsCount ?? 0);
        return rb - ra;
      });
      for (const it of ranked) {
        const v = it.volumeInfo ?? {};
        const bookTitle = String(v.title ?? "").trim();
        if (!bookTitle) continue;
        const published = String(v.publishedDate ?? "");
        if (published && published < cutoff) continue;
        const k = bookTitle.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        if (!k || seen.has(k)) continue;
        seen.add(k);
        const authors = Array.isArray(v.authors) ? v.authors.join(", ") : "";
        const pubYear = published.slice(0, 4);
        const links = v.imageLinks as Record<string, string> | undefined;
        const cover = googleCoverLink(links);
        const ratings = Number(v.ratingsCount ?? 0);
        const cats = Array.isArray(v.categories) ? v.categories.slice(0, 2).join(" · ") : "";
        books.push({
          title: bookTitle,
          author: authors,
          year: pubYear,
          reason: ratings > 0 ? `${cats || "Popular"} · ${ratings.toLocaleString()} ratings` : cats || "New release",
          cover_url: cover,
        });
        if (books.length >= 10) break;
      }
    } catch {
      // empty is fine
    }
    return books;
  };

  const [newRel, best, fic, nonfic] = await Promise.all([
    fetchQuery(`"new release" OR "new york times" hardcover ${year}`, "newest"),
    fetchQuery(`"New York Times Bestseller" OR "bestseller" hardcover ${year}`, "relevance"),
    fetchQuery(`subject:fiction "New York Times" OR bestseller ${year}`, "relevance"),
    fetchQuery(`subject:biography OR subject:history bestseller ${year}`, "relevance"),
  ]);

  const shelves: BrowseShelf[] = [
    { ...BROWSE_SHELF_META[0], books: newRel },
    { ...BROWSE_SHELF_META[1], books: best },
    { ...BROWSE_SHELF_META[2], books: fic },
    { ...BROWSE_SHELF_META[3], books: nonfic },
  ];
  return shelves.filter((s) => s.books.length > 0);
}

/**
 * Front-of-store browse: Claude + web search for what's actually on B&N tables /
 * NYT lists right now. Falls back to curated Google queries without a key.
 */
async function browseFrontTables(client: Anthropic | null): Promise<BrowseShelf[]> {
  if (client) {
    try {
      const year = new Date().getFullYear();
      const message = await askClaude(client, {
        model: MODEL,
        max_tokens: 8000,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }],
        system:
          "You curate the front of a US bookstore (Barnes & Noble front tables + " +
          "current New York Times hardcover bestseller energy). Search the web for " +
          "what is newly released and actually featured / bestselling NOW — not random " +
          "catalog newest, not classics, not obscure academic titles. Prefer books " +
          `published in ${year - 1}–${year}. ` +
          "Answer with a ```json fenced block only:\n" +
          '{"shelves":[{"id":"new-releases|bestsellers|fiction|nonfiction","books":' +
          '[{"title":"","author":"","year":"","reason":""}]}]}' +
          "\nExactly those four shelf ids. 6–10 real books per shelf. " +
          "Each reason is one short clause (e.g. \"NYT hardcover #3\" or \"June release\").",
        messages: [
          {
            role: "user",
            content:
              `What books are on the front tables and bestseller lists in the US right now (${year})? ` +
              "Cover new releases, overall bestsellers, fiction picks, and nonfiction picks.",
          },
        ],
      });

      if (message.stop_reason !== "refusal") {
        const text = (message.content ?? [])
          .filter((b: { type: string }) => b.type === "text")
          .map((b: { text: string }) => b.text)
          .join("\n");
        const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        const candidate = fenced
          ? fenced[1]
          : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
        let parsed: unknown = null;
        try {
          parsed = JSON.parse(candidate);
        } catch {
          parsed = null;
        }
        const shelves = normalizeBrowseShelves(parsed);
        if (shelves.length > 0) {
          // Jackets in parallel — same as recommend/search.
          return await Promise.all(
            shelves.map(async (shelf) => ({
              ...shelf,
              books: await Promise.all(
                shelf.books.map(async (b) => ({
                  ...b,
                  cover_url: b.cover_url ?? (await coverFor(b.title, b.author)),
                })),
              ),
            })),
          );
        }
      }
    } catch {
      // fall through to Google
    }
  }

  return browseGoogleFrontTables();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  // Identify with the caller's own token; read with the service role scoped to
  // that id. A user id from the request body is never trusted.
  const asUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: userData, error: userErr } = await asUser.auth.getUser();
  if (userErr || !userData.user) return json({ error: "Not signed in" }, 401);
  const userId = userData.user.id;

  let mode = "recommend";
  let query = "";
  let batch = 60;
  let bookId: string | null = null;
  let coverUrl: string | null = null;
  try {
    const body = await req.json();
    if (
      body?.mode === "search" ||
      body?.mode === "classify" ||
      body?.mode === "cover" ||
      body?.mode === "catalog" ||
      body?.mode === "browse" ||
      body?.mode === "recommend"
    ) {
      mode = body.mode;
    }
    query = String(body?.query ?? "").slice(0, 500);
    if (typeof body?.batch === "number") batch = Math.min(100, Math.max(10, body.batch));
    if (typeof body?.bookId === "string") bookId = body.bookId;
    // Prefer `url`; accept `query` as an alias so paste never silently no-ops.
    const rawUrl =
      (typeof body?.url === "string" && body.url.trim()) ||
      (mode === "cover" && typeof body?.query === "string" && body.query.trim()) ||
      "";
    if (rawUrl) coverUrl = normalizeCoverInput(String(rawUrl)).slice(0, 2000);
  } catch {
    // defaults are fine
  }
  if ((mode === "search" || mode === "catalog") && !query.trim()) {
    return json({ error: "Ask me something." }, 400);
  }
  if (mode === "cover" && !bookId) return json({ error: "Which book?" }, 400);

  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Free catalog + cover-from-link need no Claude.
  if (mode === "catalog") {
    const recommendations = await catalogSearch(query);
    return json({ recommendations, mode: "catalog" });
  }

  // Browse prefers Claude + web search for real front-table picks, but can
  // degrade to Google when the key is missing.
  if (mode === "browse") {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    const client = apiKey ? new Anthropic({ apiKey }) : null;
    const shelves = await browseFrontTables(client);
    return json({ shelves, mode: "browse" });
  }

  const needsClaude = !(mode === "cover" && coverUrl);
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (needsClaude && !apiKey) {
    return json(
      {
        error:
          "No Anthropic key on the server. Add ANTHROPIC_API_KEY under Edge Functions → Secrets in Supabase (not Vercel).",
      },
      400,
    );
  }
  const client = apiKey ? new Anthropic({ apiKey }) : null;

  if (mode === "classify") {
    return await classify(admin, client!, userId, batch, bookId);
  }
  if (mode === "cover") {
    return await findCover(admin, client, userId, bookId!, coverUrl);
  }

  const { data: books, error } = await admin
    .from("books")
    .select("title,authors,star_rating,tags,status,finished_at")
    .eq("user_id", userId);
  if (error) return json({ error: error.message }, 500);

  const taste = digest(books ?? []);

  const ask = (params: Record<string, unknown>) => askClaude(client!, params);

  try {
    let message;

    if (mode === "recommend") {
      message = await ask({
        model: MODEL,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        output_config: {
          effort: "medium",
          format: { type: "json_schema", schema: SUGGESTION_SCHEMA },
        },
        system:
          "You recommend books to a specific reader based on their library. " +
          "Recommend books they do NOT already own — the list below is what they have. " +
          "Favour specific, well-matched picks over famous ones they have obviously heard of. " +
          "Each reason is one sentence naming the book in their library it follows from.",
        messages: [
          {
            role: "user",
            content: `Here is my reading history.\n\n${taste}\n\nRecommend 8 books I should read next.`,
          },
        ],
      });
    } else {
      message = await ask({
        model: MODEL,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }],
        system:
          "You find books matching a reader's description, searching the web when the " +
          "answer depends on current information (what is in print, what has an audiobook, " +
          "what came out recently). Answer with a ```json fenced block and nothing else: " +
          '{"recommendations":[{"title":"","author":"","year":"","reason":""}]}. ' +
          "Up to 10 entries; each reason is one sentence on why it matches the request.",
        messages: [
          {
            role: "user",
            content:
              `Find books matching: ${query}\n\n` +
              `For context, my taste:\n${taste.slice(0, 2000)}`,
          },
        ],
      });
    }

    // A refusal is a successful HTTP 200 with empty or partial content — read
    // stop_reason before touching content.
    if (message.stop_reason === "refusal") {
      return json({ error: "Claude declined that one. Try rephrasing.", recommendations: [] });
    }

    const text = (message.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n");

    const recommendations =
      mode === "recommend"
        ? ((message as { parsed_output?: { recommendations?: Suggestion[] } }).parsed_output
            ?.recommendations ?? extractJson(text))
        : extractJson(text);

    // Jackets last, in parallel — a slow cover lookup shouldn't hold up an
    // answer that's otherwise ready.
    const withCovers = await Promise.all(
      recommendations.map(async (r: Suggestion) => ({
        ...r,
        cover_url: await coverFor(r.title, r.author),
      })),
    );

    return json({ recommendations: withCovers, model: message.model, mode });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // The two failures worth naming precisely; everything else passes through.
    if (/401|authentication/i.test(msg)) {
      return json({ error: "Anthropic rejected the key. Check ANTHROPIC_API_KEY." }, 400);
    }
    if (/429|rate.?limit/i.test(msg)) {
      return json({ error: "Anthropic rate limit hit. Try again shortly." }, 429);
    }
    return json({ error: msg }, 502);
  }
});
