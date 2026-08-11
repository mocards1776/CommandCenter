import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Proxies RSS feeds and extracts full article text (reader mode) so the
// browser never hits third-party origins directly.
//
// Deploy: supabase functions deploy rss
// Auth: verify_jwt on — signed-in Command Center users only.
//
// POST body:
//   { mode: "feed", feedUrl?: string }
//   { mode: "read", url: string }

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const DEFAULT_FEED = "https://rss.app/feeds/nG7WGKJTs5LOQjxd.xml";

const ALLOWED_TAGS = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "a",
  "strong",
  "b",
  "em",
  "i",
  "ul",
  "ol",
  "li",
  "blockquote",
  "br",
  "img",
  "figure",
  "figcaption",
  "hr",
  "span",
]);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&nbsp;/gi, " ")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&rsquo;/gi, "’")
    .replace(/&lsquo;/gi, "‘")
    .replace(/&rdquo;/gi, "”")
    .replace(/&ldquo;/gi, "“")
    .replace(/&hellip;/gi, "…")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/h[1-6]>/gi, "\n\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\u200d|\ufeff/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
  );
}

function isPublicHttpUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    return false;
  }
  return true;
}

function tag(xml: string, name: string): string {
  const cdata = xml.match(
    new RegExp(
      "<" + name + "[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</" + name + ">",
      "i",
    ),
  );
  if (cdata) return cdata[1].trim();
  const plain = xml.match(
    new RegExp("<" + name + "[^>]*>([\\s\\S]*?)</" + name + ">", "i"),
  );
  return plain ? decodeEntities(plain[1].trim()) : "";
}

function attr(xml: string, name: string, attrName: string): string {
  const m = xml.match(
    new RegExp(
      "<" + name + "[^>]*\\s" + attrName + "\\s*=\\s*\"([^\"]*)\"",
      "i",
    ),
  );
  return m ? m[1] : "";
}

type FeedItem = {
  id: string;
  title: string;
  link: string;
  author: string | null;
  publishedAt: string | null;
  image: string | null;
  snippet: string;
};

function parseFeed(xml: string, feedUrl: string) {
  const channel = xml.match(/<channel[\s\S]*?<\/channel>/i)?.[0] ?? xml;
  const title = tag(channel, "title") || "RSS";
  const description = tag(channel, "description");
  const link = tag(channel, "link") || feedUrl;
  const items: FeedItem[] = [];

  const itemRe = /<item[\s\S]*?<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml))) {
    const block = m[0];
    const itemLink = tag(block, "link");
    const guid = tag(block, "guid") || itemLink;
    const descHtml = tag(block, "description");
    const contentEncoded =
      tag(block, "content:encoded") ||
      block.match(/<content:encoded[\s\S]*?<!\[CDATA\[([\s\S]*?)\]\]>/i)?.[1] ||
      "";
    const image =
      attr(block, "media:content", "url") ||
      attr(block, "enclosure", "url") ||
      descHtml.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ||
      null;
    const snippetSource = contentEncoded || descHtml;
    items.push({
      id: guid || itemLink,
      title: stripTags(tag(block, "title")) || "Untitled",
      link: itemLink,
      author: tag(block, "dc:creator") || tag(block, "author") || null,
      publishedAt: tag(block, "pubDate") || null,
      image,
      snippet: stripTags(snippetSource).slice(0, 320),
    });
  }

  return { title, description: stripTags(description), link, feedUrl, items };
}

function stripNoise(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
}

/** TownNews / BLOX subscriber-only bodies ship ROT-47-style scrambled. */
function decryptTownNews(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 33 && c <= 126) {
      out += String.fromCharCode(33 + ((c - 33 + 47) % 94));
    } else {
      out += s[i];
    }
  }
  return out;
}

/** Unlock STL Today (and similar) encrypted subscriber paragraphs before extract. */
function unlockEncryptedContent(html: string): string {
  return html.replace(
    /<(p|div)([^>]*class="[^"]*encrypted-content[^"]*"[^>]*)>([\s\S]*?)<\/\1>/gi,
    (_m, tag: string, attrs: string, inner: string) => {
      const decoded = decryptTownNews(decodeEntities(inner));
      const cleanAttrs = String(attrs)
        .replace(/\bencrypted-content\b/g, "")
        .replace(/\bsubscriber-only\b/g, "")
        .replace(/\s*style\s*=\s*"display:\s*none"/gi, "");
      return "<" + tag + cleanAttrs + ">" + decoded + "</" + tag + ">";
    },
  );
}

/** Match a full nested <div>…</div> (non-greedy patterns stop at the first child close). */
function sliceBalancedDiv(html: string, openRe: RegExp): string | null {
  const m = openRe.exec(html);
  if (!m) return null;
  const start = m.index + m[0].length;
  const lower = html.toLowerCase();
  let depth = 1;
  let i = start;
  while (i < html.length && depth > 0) {
    const open = lower.indexOf("<div", i);
    const close = lower.indexOf("</div>", i);
    if (close === -1) return null;
    if (open !== -1 && open < close) {
      const boundary = lower[open + 4] ?? "";
      if (!boundary || /[\s>/]/.test(boundary)) depth++;
      i = open + 4;
      continue;
    }
    depth--;
    if (depth === 0) return html.slice(start, close);
    i = close + 6;
  }
  return null;
}

function extractFragment(html: string): string | null {
  // TownNews / BLOX: prefer balanced article body so unlocked subscriber paragraphs are kept.
  const balancedOpeners = [
    /<div[^>]*itemprop="articleBody"[^>]*>/i,
    /<div[^>]*class="[^"]*asset-content[^"]*"[^>]*>/i,
    /<div[^>]*class="[^"]*subscriber-premium[^"]*"[^>]*>/i,
    /<div[^>]*class="[^"]*lee-article-body[^"]*"[^>]*>/i,
    /<div[^>]*class="[^"]*blog-item-content[^"]*e-content[^"]*"[^>]*>/i,
    /<div[^>]*class="[^"]*e-content[^"]*"[^>]*>/i,
  ];
  for (const re of balancedOpeners) {
    const frag = sliceBalancedDiv(html, re);
    if (frag && stripTags(frag).length > 200) return frag;
  }

  const patterns = [
    /<div[^>]*class="[^"]*blog-item-content[^"]*e-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div[^>]*class="[^"]*blog-item-author-profile/i,
    /<(?:div|section|article)[^>]*class="[^"]*(?:post-content|entry-content|article-content|article-body|post-body|rich-text|subscriber-premium)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section|article)>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1] && stripTags(m[1]).length > 200) return m[1];
  }

  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  const chunks = body.split(/<\/?(?:nav|header|footer|aside)[^>]*>/i);
  let best = "";
  for (const chunk of chunks) {
    const text = stripTags(chunk);
    if (text.length > best.length) best = chunk;
  }
  return best.length > 200 ? best : null;
}

function attrValue(attrs: string, name: string): string | null {
  const dq = attrs.match(
    new RegExp("\\b" + name + "\\s*=\\s*\"([^\"]*)\"", "i"),
  );
  if (dq) return dq[1];
  const sq = attrs.match(
    new RegExp("\\b" + name + "\\s*=\\s*'([^']*)'", "i"),
  );
  return sq ? sq[1] : null;
}

function sanitizeHtml(frag: string): string {
  const cleaned = frag.replace(
    /<\/?([a-zA-Z0-9]+)(\s[^>]*)?>/g,
    (full, rawTag: string, attrs = "") => {
      const name = rawTag.toLowerCase();
      const closing = full.startsWith("</");
      if (!ALLOWED_TAGS.has(name)) return "";
      if (closing) return "</" + name + ">";
      if (name === "br" || name === "hr") return "<" + name + ">";

      const keep: string[] = [];
      if (name === "a") {
        const href = attrValue(attrs, "href");
        if (href && /^(https?:|mailto:|\/)/i.test(href)) {
          keep.push('href="' + href.replace(/"/g, "") + '"');
          keep.push('target="_blank"');
          keep.push('rel="noopener noreferrer"');
        } else {
          return "";
        }
      }
      if (name === "img") {
        const src = attrValue(attrs, "src");
        if (!src || !/^(https?:|\/)/i.test(src)) return "";
        keep.push('src="' + src.replace(/"/g, "") + '"');
        const alt = attrValue(attrs, "alt");
        if (alt) keep.push('alt="' + alt.replace(/"/g, "&quot;") + '"');
        keep.push('loading="lazy"');
      }
      return "<" + name + (keep.length ? " " + keep.join(" ") : "") + ">";
    },
  );

  return cleaned
    .replace(/\u200d|\ufeff/g, "")
    .replace(/<p>\s*<\/p>/gi, "")
    .replace(/(?:\s*<br>\s*){3,}/gi, "<br><br>")
    .trim();
}

function pageMeta(html: string) {
  const title =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1] ||
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ||
    null;
  const byline =
    html.match(/itemprop=["']author["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
    html.match(/class=["'][^"']*blog-author-name[^"']*["'][^>]*>([\s\S]*?)</i)?.[1] ||
    null;
  const image =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ||
    null;
  return {
    title: title ? stripTags(title) : null,
    byline: byline ? stripTags(byline) : null,
    image,
  };
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error("Upstream " + res.status + " for " + url);
  }
  return await res.text();
}

async function handleFeed(feedUrl: string) {
  if (!isPublicHttpUrl(feedUrl)) return json({ error: "Invalid feed URL" }, 400);
  const xml = await fetchText(feedUrl);
  return json(parseFeed(xml, feedUrl));
}

async function handleRead(url: string) {
  if (!isPublicHttpUrl(url)) return json({ error: "Invalid article URL" }, 400);
  const html = unlockEncryptedContent(stripNoise(await fetchText(url)));
  const frag = extractFragment(html);
  if (!frag) return json({ error: "Could not extract article text", url }, 422);
  const contentHtml = sanitizeHtml(frag);
  const contentText = stripTags(contentHtml);
  if (contentText.length < 80) {
    return json({ error: "Extracted text too short", url }, 422);
  }
  const meta = pageMeta(html);
  return json({
    url,
    title: meta.title,
    byline: meta.byline,
    image: meta.image,
    contentHtml,
    contentText,
    wordCount: contentText.split(/\s+/).filter(Boolean).length,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: { mode?: string; feedUrl?: string; url?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  try {
    if (body.mode === "feed") {
      return await handleFeed(body.feedUrl?.trim() || DEFAULT_FEED);
    }
    if (body.mode === "read") {
      if (!body.url?.trim()) return json({ error: "url is required" }, 400);
      return await handleRead(body.url.trim());
    }
    return json({ error: "mode must be 'feed' or 'read'" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 502);
  }
});
