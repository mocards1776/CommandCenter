import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Looks up a book from a retail/library URL and returns metadata plus the
// cover image as base64, so the caller can store its own copy.
//
// Nothing here trusts the source staying alive: the point is to pull
// everything out once, then never need the URL again.
//
// Deploy: supabase functions deploy book-lookup

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
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

function meta(html: string, key: string): string | null {
  // property= and name= appear in either attribute order depending on the site.
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (m?.[1]) return decodeEntities(m[1]).trim();
  }
  return null;
}

/** Every JSON-LD block on the page, flattened (some sites use @graph). */
function jsonLd(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const re = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const it of items) {
        out.push(it);
        const graph = (it as Record<string, unknown>)["@graph"];
        if (Array.isArray(graph)) out.push(...(graph as Record<string, unknown>[]));
      }
    } catch {
      // A malformed block shouldn't lose the ones that parse.
    }
  }
  return out;
}

// Retailers put their own name in Product.author / Product.publisher.
// Anything matching the site itself is a store, not a writer.
function isStoreName(name: string, siteName: string | null): boolean {
  const n = name.trim().toLowerCase();
  if (siteName && n === siteName.trim().toLowerCase()) return true;
  return /^(barnes\s*&?\s*noble|amazon(\.com)?|goodreads|open library|bookshop|target|walmart|thriftbooks|abebooks|waterstones)$/i.test(
    n,
  );
}

function pickAuthor(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(pickAuthor).filter(Boolean).join(", ") || null;
  if (typeof v === "object") {
    const n = (v as Record<string, unknown>).name;
    return typeof n === "string" ? n : null;
  }
  return null;
}

/** ISBN-13/10 from structured data, then from visible text. */
function findIsbn(html: string, ld: Record<string, unknown>[]): string | null {
  for (const d of ld) {
    for (const k of ["isbn", "gtin13", "gtin", "productID"]) {
      const v = d[k];
      if (typeof v === "string") {
        const digits = v.replace(/[^0-9Xx]/g, "");
        if (digits.length === 13 || digits.length === 10) return digits;
      }
    }
  }
  const m = /ISBN(?:-?1[03])?[^0-9]{0,12}((?:97[89][- ]?)?[0-9][0-9- ]{8,14}[0-9Xx])/i.exec(html);
  if (m) {
    const digits = m[1].replace(/[^0-9Xx]/g, "");
    if (digits.length === 13 || digits.length === 10) return digits;
  }
  return null;
}

/** Open Library fills in what a retail page usually omits: pages, publisher. */
async function enrich(isbn: string) {
  try {
    const res = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,
      { headers: { "User-Agent": UA } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const rec = data[`ISBN:${isbn}`];
    if (!rec) return null;
    return {
      title: rec.title as string | undefined,
      subtitle: rec.subtitle as string | undefined,
      authors: (rec.authors ?? []).map((a: { name: string }) => a.name).join(", ") || undefined,
      page_count: rec.number_of_pages as number | undefined,
      publisher: (rec.publishers ?? [])[0]?.name as string | undefined,
      published_year: rec.publish_date
        ? Number.parseInt(String(rec.publish_date).match(/\d{4}/)?.[0] ?? "", 10) || undefined
        : undefined,
      cover_url: rec.cover?.large ?? rec.cover?.medium,
    };
  } catch {
    return null; // enrichment is a bonus, never a failure mode
  }
}

/** First candidate that isn't empty and isn't the store's own name. */
function firstUsableAuthor(candidates: (string | null)[], siteName: string | null): string | null {
  for (const c of candidates) {
    if (c && c.trim() && !isStoreName(c, siteName)) return c.trim();
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let url: string;
  try {
    ({ url } = await req.json());
  } catch {
    return json({ error: "Body must be JSON: { url }" }, 400);
  }
  if (!url || typeof url !== "string") return json({ error: "No url provided" }, 400);

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return json({ error: "That doesn't look like a URL" }, 400);
  }
  // Only fetch public web pages — no file://, and no poking at internal hosts.
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return json({ error: "Only http(s) links are supported" }, 400);
  }
  if (/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[?::1)/i.test(parsed.hostname)) {
    return json({ error: "That host isn't allowed" }, 400);
  }

  let html: string;
  try {
    const res = await fetch(parsed.toString(), {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
    });
    if (!res.ok) return json({ error: `The page returned ${res.status}` }, 502);
    html = await res.text();
  } catch (err) {
    return json({ error: "Could not reach that page", detail: String(err) }, 502);
  }

  const ld = jsonLd(html);
  const book = ld.find((d) => {
    const t = d["@type"];
    return t === "Book" || (Array.isArray(t) && t.includes("Book"));
  });
  const product = ld.find((d) => {
    const t = d["@type"];
    return t === "Product" || (Array.isArray(t) && t.includes("Product"));
  });
  const src = book ?? product ?? {};

  const siteName = meta(html, "og:site_name");

  const titleRaw =
    (typeof src.name === "string" ? src.name : null) ??
    meta(html, "og:title") ??
    decodeEntities(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? "").trim();

  // Page titles trail the site name after a separator. Strip whatever
  // og:site_name reports rather than maintaining a list of retailers.
  let title = titleRaw;
  if (siteName) {
    const esc = siteName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    title = title.replace(new RegExp(`\\s*[|–—-]\\s*${esc}\\s*$`, "i"), "");
  }
  title = title
    .replace(
      /\s*[|–—-]\s*(Barnes\s*&\s*Noble|Amazon(\.com)?|Goodreads|Open Library)\s*$/i,
      "",
    )
    .trim();

  // "The Christmas sweater by Glenn Beck" — split the author off the title
  // and keep it as a fallback if nothing better turns up.
  let titleAuthorHint: string | null = null;
  const byMatch = /^(.*?\S)\s+by\s+(\S.*)$/i.exec(title);
  if (byMatch && byMatch[1].length > 2) {
    title = byMatch[1].trim();
    titleAuthorHint = byMatch[2].trim();
  }

  const isbn = findIsbn(html, ld);
  const extra = isbn ? await enrich(isbn) : null;

  let coverUrl =
    (typeof src.image === "string" ? src.image : Array.isArray(src.image) ? src.image[0] : null) ??
    meta(html, "og:image:secure_url") ??
    meta(html, "og:image") ??
    meta(html, "twitter:image") ??
    extra?.cover_url ??
    null;
  if (coverUrl && coverUrl.startsWith("//")) coverUrl = "https:" + coverUrl;
  if (coverUrl) coverUrl = coverUrl.replace(/^http:/i, "https:");

  // Fetch the cover here and hand back bytes: the caller stores its own copy,
  // so the record survives the retailer changing or removing the image.
  let coverBase64: string | null = null;
  let coverType: string | null = null;
  if (coverUrl) {
    try {
      const img = await fetch(coverUrl, { headers: { "User-Agent": UA, Referer: parsed.origin } });
      const type = img.headers.get("Content-Type") ?? "";
      if (img.ok && type.startsWith("image/")) {
        const buf = new Uint8Array(await img.arrayBuffer());
        if (buf.byteLength <= 4_000_000) {
          let bin = "";
          for (let i = 0; i < buf.length; i += 8192) {
            bin += String.fromCharCode(...buf.subarray(i, i + 8192));
          }
          coverBase64 = btoa(bin);
          coverType = type.split(";")[0];
        }
      }
    } catch {
      // A missing cover is not a failed lookup.
    }
  }

  const description =
    (typeof src.description === "string" ? src.description : null) ??
    meta(html, "og:description") ??
    meta(html, "description");

  return json({
    title: title || null,
    subtitle: extra?.subtitle ?? null,
    authors: firstUsableAuthor(
      [
        book ? pickAuthor(book.author) : null, // only a real Book gives a real author
        extra?.authors ?? null,
        titleAuthorHint,
        meta(html, "author"),
        product ? pickAuthor(product.author) : null, // last resort, often the seller
      ],
      siteName,
    ),
    isbn: isbn ?? null,
    page_count: extra?.page_count ?? null,
    publisher: pickAuthor(src.publisher) ?? extra?.publisher ?? null,
    published_year: extra?.published_year ?? null,
    description: description ? description.slice(0, 4000) : null,
    cover_url: coverUrl,
    cover_base64: coverBase64,
    cover_type: coverType,
    source_url: parsed.toString(),
    enriched: Boolean(extra),
  });
});
