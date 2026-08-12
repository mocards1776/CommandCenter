import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Pulls Readwise highlights and attaches them to library books.
//
// Readwise calls every source a "book" — articles, tweets and podcasts all
// come back from the same endpoint — so only the `books` category is matched
// against the library. The rest is skipped rather than stored, since this is a
// reading tracker and not a read-later app.
//
// Incremental: /export/ takes an updatedAfter cursor, so a re-sync pulls only
// what changed. The bookmark is only advanced after a clean run, so an
// interrupted sync repeats work rather than losing highlights.

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// The token is account-wide and read/write, so it never reaches the browser.
const READWISE_TOKEN =
  Deno.env.get("READWISE_TOKEN") ?? Deno.env.get("READWISE_ACCESS_TOKEN") ?? "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

type RwHighlight = {
  id: number;
  text: string;
  note?: string | null;
  location?: number | null;
  location_type?: string | null;
  color?: string | null;
  url?: string | null;
  highlighted_at?: string | null;
};

type RwBook = {
  user_book_id: number;
  title?: string | null;
  author?: string | null;
  category?: string | null;
  asin?: string | null;
  source_url?: string | null;
  highlights?: RwHighlight[];
};

/**
 * Title key for matching. Subtitles are the main source of disagreement —
 * Readwise stores the cover title, StoryGraph exported the full one — so
 * everything after a colon or dash is dropped, along with a leading article.
 */
function titleKey(raw: string): string {
  return raw
    .toLowerCase()
    .split(/[:—–]|\s-\s/)[0]
    .replace(/\(.*?\)/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/^(the|a|an) /, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Surname only: "Erik Larson" and "Larson, Erik" have to agree. */
function authorKey(raw: string | null | undefined): string {
  const first = String(raw ?? "").split(/[,;&]| and /)[0].trim();
  const parts = first.split(/\s+/).filter(Boolean);
  const last = parts.length > 1 ? parts[parts.length - 1] : parts[0];
  return (last ?? "").toLowerCase().replace(/[^a-z]/g, "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  if (!READWISE_TOKEN) {
    return json(
      {
        error:
          "No Readwise token on the server. Add READWISE_TOKEN under Edge Functions → Secrets in Supabase (not Vercel).",
      },
      400,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  // Identify with the caller's own token; write with the service role scoped
  // to that id. A user id from the request body is never trusted.
  const asUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: userData, error: userErr } = await asUser.auth.getUser();
  if (userErr || !userData.user) return json({ error: "Not signed in" }, 401);
  const userId = userData.user.id;

  let full = false;
  try {
    full = (await req.json())?.full === true;
  } catch {
    // default is fine
  }

  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Where we left off. A full sync ignores it and re-reads everything.
  const { data: state } = await admin
    .from("integration_sync")
    .select("synced_at")
    .eq("user_id", userId)
    .eq("service", "readwise")
    .maybeSingle();
  const since = full ? null : (state?.synced_at ?? null);

  const startedAt = new Date().toISOString();

  // The library, indexed for matching. 2,600 rows is one cheap read.
  const { data: books, error: booksErr } = await admin
    .from("books")
    .select("id,title,authors")
    .eq("user_id", userId);
  if (booksErr) return json({ error: booksErr.message }, 500);

  const byTitleAuthor = new Map<string, string>();
  const byTitle = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const b of books ?? []) {
    const t = titleKey(String(b.title ?? ""));
    if (!t) continue;
    byTitleAuthor.set(`${t}|${authorKey(b.authors)}`, b.id);
    // A bare title can be shared by two books; then it isn't a safe match.
    if (byTitle.has(t)) ambiguous.add(t);
    else byTitle.set(t, b.id);
  }

  function matchBook(rw: RwBook): string | null {
    const t = titleKey(String(rw.title ?? ""));
    if (!t) return null;
    return byTitleAuthor.get(`${t}|${authorKey(rw.author)}`) ?? (ambiguous.has(t) ? null : byTitle.get(t)) ?? null;
  }

  let cursor: string | null = null;
  let sources = 0;
  let matched = 0;
  let highlights = 0;
  const unmatched: string[] = [];

  // Paginated; bounded so a cursor that never terminates can't spin forever.
  for (let page = 0; page < 200; page++) {
    const params = new URLSearchParams();
    if (since) params.set("updatedAfter", since);
    if (cursor) params.set("pageCursor", cursor);

    const res = await fetch(`https://readwise.io/api/v2/export/?${params}`, {
      headers: { Authorization: `Token ${READWISE_TOKEN}` },
    });

    if (res.status === 401) {
      return json({ error: "Readwise rejected the token. Check READWISE_TOKEN." }, 400);
    }
    if (res.status === 429) {
      // Readwise asks for a wait rather than a retry storm.
      const wait = res.headers.get("Retry-After") ?? "60";
      return json(
        { error: `Readwise rate limit hit. Try again in ${wait}s.`, highlights, matched },
        429,
      );
    }
    if (!res.ok) {
      return json({ error: `Readwise returned ${res.status}`, highlights, matched }, 502);
    }

    const payload = await res.json();
    const results: RwBook[] = payload?.results ?? [];

    const rows: Record<string, unknown>[] = [];
    for (const rw of results) {
      sources++;
      // Articles, tweets and podcasts aren't part of the library.
      if (rw.category && rw.category !== "books") continue;

      const bookId = matchBook(rw);
      if (bookId) matched++;
      else if (rw.title && unmatched.length < 25) unmatched.push(rw.title);

      for (const h of rw.highlights ?? []) {
        if (!h.text?.trim()) continue;
        rows.push({
          user_id: userId,
          book_id: bookId,
          readwise_id: h.id,
          readwise_book_id: rw.user_book_id,
          source_title: rw.title ?? null,
          source_author: rw.author ?? null,
          category: rw.category ?? null,
          text: h.text,
          note: h.note || null,
          location: typeof h.location === "number" ? h.location : null,
          location_type: h.location_type ?? null,
          color: h.color || null,
          url: h.url ?? null,
          highlighted_at: h.highlighted_at ?? null,
          updated_at: new Date().toISOString(),
        });
      }
    }

    // Chunked: a heavily-highlighted account can return thousands per page.
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await admin
        .from("book_highlights")
        .upsert(rows.slice(i, i + 500), { onConflict: "user_id,readwise_id" });
      if (error) return json({ error: error.message, highlights }, 500);
    }
    highlights += rows.length;

    cursor = payload?.nextPageCursor ?? null;
    if (!cursor) break;
  }

  // Only advance the bookmark on a clean finish, so an error above means the
  // next run re-reads rather than skipping past what it missed.
  await admin
    .from("integration_sync")
    .upsert(
      { user_id: userId, service: "readwise", synced_at: startedAt, detail: { sources, matched } },
      { onConflict: "user_id,service" },
    );

  return json({ sources, matched, highlights, unmatched, incremental: !!since });
});
