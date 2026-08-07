import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
// Unpinned deliberately: an invented version pin fails the deploy outright,
// which is worse than tracking the current SDK.
import Anthropic from "npm:@anthropic-ai/sdk";

// Four AI features over the reading library, on the user's own Anthropic key:
//
//   "recommend" — reads the library and suggests what to read next.
//   "search"    — natural-language book search, answered with web search.
//   "classify"  — batched (or single-book via bookId) pass filling fiction/
//     non-fiction and series. Catalog subjects often settle fiction during
//     enrich; the model fills the rest and is the only source for series.
//   "cover"     — find and store a jacket for one book (Open Library first,
//     then Claude + web search; or a reader-supplied page/image URL).
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

/** Google Books often has a jacket when Open Library does not. */
async function googleCover(title: string, author: string | null, isbn: string | null): Promise<string | null> {
  try {
    const q = isbn
      ? `isbn:${isbn.replace(/[^0-9Xx]/g, "")}`
      : `intitle:${title.slice(0, 80)}${author ? `+inauthor:${author.split(",")[0].trim().slice(0, 40)}` : ""}`;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1`,
      { signal: ctl.signal, headers: { "User-Agent": UA } },
    ).finally(() => clearTimeout(t));
    if (!res.ok) return null;
    const links = (await res.json())?.items?.[0]?.volumeInfo?.imageLinks as
      | Record<string, string>
      | undefined;
    if (!links) return null;
    const raw = links.extraLarge ?? links.large ?? links.medium ?? links.thumbnail ?? links.smallThumbnail;
    return raw ? String(raw).replace(/^http:/, "https:").replace(/&edge=curl/, "") : null;
  } catch {
    return null;
  }
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

/** Download an image URL; reject tiny placeholders and non-images. */
async function grabImage(url: string): Promise<{ bytes: Uint8Array; type: string } | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 12000);
    const res = await fetch(url, {
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
    const header = (res.headers.get("Content-Type") ?? "").split(";")[0].trim();
    const type = header.startsWith("image/") ? header : sniffImageType(bytes);
    if (!type) return null;
    return { bytes, type };
  } catch {
    return null;
  }
}

/** Pull a cover URL out of a retail/library page (og:image / twitter:image). */
async function coverFromPage(pageUrl: string): Promise<string | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 10000);
    const res = await fetch(pageUrl, {
      signal: ctl.signal,
      headers: { "User-Agent": UA },
    }).finally(() => clearTimeout(t));
    if (!res.ok) return null;
    const html = await res.text();
    const patterns = [
      /<meta[^>]+(?:property|name)=["']og:image["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']og:image["']/i,
      /<meta[^>]+(?:property|name)=["']twitter:image["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']twitter:image["']/i,
    ];
    for (const re of patterns) {
      const m = re.exec(html);
      if (m?.[1]) {
        let u = m[1].trim();
        if (u.startsWith("//")) u = "https:" + u;
        return u;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Collect every plausible image URL Claude (or its citations) mentioned. */
function extractCoverUrls(text: string): string[] {
  const out: string[] = [];
  const push = (raw: string) => {
    let u = raw.trim().replace(/[),.;]+$/, "");
    if (u.startsWith("//")) u = "https:" + u;
    if (!/^https?:\/\//i.test(u)) return;
    if (out.includes(u)) return;
    out.push(u);
  };

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  try {
    const parsed = JSON.parse(candidate);
    const primary = parsed?.cover_url;
    if (typeof primary === "string") push(primary);
    if (Array.isArray(parsed?.cover_urls)) {
      for (const u of parsed.cover_urls) if (typeof u === "string") push(u);
    }
  } catch {
    // fall through to regex sweep
  }

  for (const m of text.matchAll(/https?:\/\/[^\s"'<>]+/gi)) {
    const u = m[0];
    if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(u) || /covers\.openlibrary|books\.google|googleusercontent|covers\.openlib/i.test(u)) {
      push(u);
    }
  }
  return out;
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
    // Direct image, or a book page whose og:image is the jacket.
    if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(url) || /covers\.openlibrary\.org/i.test(url)) {
      push(url, "link");
    } else {
      push(await coverFromPage(url), "link");
      // Image CDNs sometimes omit a file extension — try the URL itself last.
      push(url, "link");
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
      `${book.isbn ? ` ISBN ${book.isbn}` : ""} book cover`;
    try {
      const message = await askClaude(client, {
        model: MODEL,
        max_tokens: 4000,
        thinking: { type: "adaptive" },
        output_config: { effort: "low" },
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
        system:
          "You find direct URLs to book cover IMAGE FILES (jpg/png/webp), not HTML pages. " +
          "Prefer covers.openlibrary.org, books.google.com image CDN, or publisher art. " +
          "Answer with a ```json fenced block only: " +
          '{"cover_url":"https://...","cover_urls":["https://..."]}. ' +
          "Put the best URL in cover_url and up to 4 alternates in cover_urls. " +
          "If you cannot find a direct image URL, return {\"cover_url\":\"\",\"cover_urls\":[]}.",
        messages: [{ role: "user", content: `Find cover image URLs for: ${q}` }],
      });
      if (message.stop_reason === "refusal") {
        aiError = "Claude declined that cover search.";
      } else {
        const text = (message.content ?? [])
          .filter((b: { type: string }) => b.type === "text")
          .map((b: { text: string }) => b.text)
          .join("\n");
        for (const found of extractCoverUrls(text)) {
          img = await grabImage(found);
          if (img) {
            usedUrl = found;
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
    // 200 on purpose: supabase-js turns non-2xx into a generic toast and drops
    // the body, so "couldn't find one" has to ride a success status.
    return json({
      found: false,
      error: aiError
        ? `Cover search failed: ${aiError.slice(0, 180)}`
        : "Couldn't find a cover for this one. Try pasting a cover image link.",
    });
  }

  const ext = img.type.includes("png") ? "png" : img.type.includes("webp") ? "webp" : "jpg";
  const path = `${userId}/${book.id}.${ext}`;
  const { error: upErr } = await admin.storage
    .from("book-covers")
    .upload(path, img.bytes, { contentType: img.type, upsert: true });
  if (upErr) return json({ error: upErr.message }, 500);

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
    if (body?.mode === "search" || body?.mode === "classify" || body?.mode === "cover") {
      mode = body.mode;
    }
    query = String(body?.query ?? "").slice(0, 500);
    if (typeof body?.batch === "number") batch = Math.min(100, Math.max(10, body.batch));
    if (typeof body?.bookId === "string") bookId = body.bookId;
    if (typeof body?.url === "string" && body.url.trim()) coverUrl = body.url.trim().slice(0, 2000);
  } catch {
    // defaults are fine
  }
  if (mode === "search" && !query.trim()) return json({ error: "Ask me something." }, 400);
  if (mode === "cover" && !bookId) return json({ error: "Which book?" }, 400);

  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Cover-from-link only needs storage; everything else needs Claude.
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
