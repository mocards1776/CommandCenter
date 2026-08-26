import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Proxies RSS feeds and extracts full article text (reader mode) so the
// browser never hits third-party origins directly.
//
// Deploy: supabase functions deploy rss
// Auth: verify_jwt on — signed-in Command Center users only.
//
// POST body:
//   { mode: "feed", feedUrl?: string }
//   { mode: "read", url: string }
//   { mode: "warm-wraps" }  — cron: rebuild MLB + Cardinals wrap caches
// Successful extracts are kept in-memory briefly so idle prefetches make opens instant.

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UA = "Mozilla/5.0 (compatible; CommandCenterRSS/1.0)";
/** Real browser UA — STL Today / TownNews often serve thin shells to bot UAs. */
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const DEFAULT_FEED = "https://rss.app/feeds/nG7WGKJTs5LOQjxd.xml";

/** Per-isolate extract cache — warms shared across concurrent / repeat reads. */
const EXTRACT_MEM = new Map<string, { at: number; body: string }>();
const EXTRACT_MEM_TTL_MS = 45 * 60_000;
const EXTRACT_MEM_MAX = 220;

function readExtractMem(url: string): Response | null {
  const hit = EXTRACT_MEM.get(url);
  if (!hit) return null;
  if (Date.now() - hit.at > EXTRACT_MEM_TTL_MS) {
    EXTRACT_MEM.delete(url);
    return null;
  }
  return new Response(hit.body, {
    status: 200,
    headers: {
      ...CORS,
      "Content-Type": "application/json",
      "Cache-Control": "private, max-age=120",
      "X-Extract-Cache": "HIT",
    },
  });
}

function writeExtractMem(url: string, payload: unknown): void {
  try {
    const body = JSON.stringify(payload);
    if (body.length > 400_000) return;
    EXTRACT_MEM.set(url, { at: Date.now(), body });
    if (EXTRACT_MEM.size <= EXTRACT_MEM_MAX) return;
    // Drop oldest entries.
    const ranked = [...EXTRACT_MEM.entries()].sort((a, b) => a[1].at - b[1].at);
    for (const [key] of ranked.slice(0, EXTRACT_MEM.size - EXTRACT_MEM_MAX)) {
      EXTRACT_MEM.delete(key);
    }
  } catch {
    /* ignore */
  }
}

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
  "footer",
  "cite",
  "hr",
  "span",
  "div",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "video",
  "source",
]);

const TWEET_URL_RE = /(?:twitter\.com|x\.com)\/\w+\/status(?:es)?\/\d+/i;
const TWEET_EMBED_RE = /twitter-tweet|rss-tweet|data-tweet|twt-embed|twitter-video/i;

const PROMO_LINK_RE =
  /(?:get tickets|ticket package|star wars|jersey with|subscribe|newsletter|sign up|fantasy baseball|betmgm|draftkings|fanduel|promo code|bonus bets|specials\/|shop\.mlb|mlb\.com\/tickets|more mlb on heavy|more from heavy|advertisement|get the latest from mlb|morning lineup|share on x|share on twitter|email a link to a friend|opens in new window)/i;

const CAPTION_RE =
  /(?:mandatory credit|imagn images|via reuters|getty images|photo by|ap photo|usa today sports|\bwp-caption\b)/i;

const FILM_ROOM_CHROME_RE =
  /(?:film room powered by|google cloud|grid-\d+|channels?reels|arrow-expand|add-reel|share-square|dot-menu-\d+|more from this game|data visualization)/i;

const BYLINE_NOISE_RE =
  /^(?:story by|by)\s+.+|(?:[A-Z][a-z]+(?:\s+[A-Z][a-z.'-]+)+)\s*\|\s*(?:post-dispatch|st\.?\s*louis post-dispatch|associated press|ap|reuters|espn|mlb\.com|heavy|yahoo sports)\s*$/i;

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
    .replace(/<template[\s\S]*?<\/template>/gi, "")
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
    /<(p|div|section|span)([^>]*(?:class|data-type)=["'][^"']*encrypted-content[^"']*["'][^>]*)>([\s\S]*?)<\/\1>/gi,
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

const CHROME_CLASS_RE =
  /(?:subscriber-hide|tnt-gift|gift-|share-tools|share-bar|social-share|social-links|follow-this|follow-author|author-card|asset-user|asset-meta|asset-tags|asset-comments|comments-|newsletter|notification|modal-|dropdown-menu|preferred-source|google-preferred|paywall|clipboard|subscribe-promo|inline-relcontent|tnt-inline|trinity|audio-player|related-articles|read-more|promo-|story-cover|caas-readmore|caas-da|bodyad|body-ads|taboola|outbrain|film-room-branding|powered-by|most-popular|popular-stories|popular-module|more-stories|trb_pop|related-content|right-rail|sidebar-module)/i;

/** Drop share/gift/follow/modals and other newspaper chrome before sanitize. */
function stripArticleChrome(html: string): string {
  let out = html;
  out = out.replace(/<template[\s\S]*?<\/template>/gi, "");
  // Repeatedly peel nested chrome wrappers.
  for (let pass = 0; pass < 8; pass++) {
    const next = out.replace(
      /<(div|section|aside|nav|ul|form|button|figure)([^>]*)>([\s\S]*?)<\/\1>/gi,
      (full, tag: string, attrs: string, inner: string) => {
        // Keep tweet embeds even when wrapped in share/social chrome.
        if (TWEET_EMBED_RE.test(attrs) || TWEET_EMBED_RE.test(inner) || TWEET_URL_RE.test(inner)) {
          return full;
        }
        const hay = (attrs + " " + inner.slice(0, 240)).toLowerCase();
        if (CHROME_CLASS_RE.test(attrs) || CHROME_CLASS_RE.test(hay)) return "";
        if (/id="[^"]*(?:gift|follow|share|modal|notification|clipboard)[^"]*"/i.test(attrs)) {
          return "";
        }
        return full;
      },
    );
    if (next === out) break;
    out = next;
  }
  // Author byline cards / avatar blocks that aren't the article.
  out = out.replace(
    /<(div|aside)[^>]*class="[^"]*(?:asset-author|byline-card|author-bio|author-info)[^"]*"[^>]*>[\s\S]*?<\/\1>/gi,
    "",
  );
  return out;
}

/** Prefer TownNews article paragraphs only — avoids gift/share chrome in asset-content. */
function extractTownNewsParagraphs(html: string): string | null {
  // Tweet embeds live outside lee-article-text <p>s — use the full body path instead.
  // Only treat real status embeds as tweets (not share intent links).
  if (TWEET_EMBED_RE.test(html) || /(?:twitter\.com|x\.com)\/\w+\/status(?:es)?\/\d+/i.test(html)) {
    return null;
  }

  const parts: string[] = [];
  const re =
    /<(p|div|blockquote)([^>]*class="[^"]*(?:subscriber-preview|lee-article-text|article-body|twitter-tweet)[^"]*"[^>]*)>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tag = m[1].toLowerCase();
    const attrs = m[2] || "";
    if (/subscriber-hide|trinity|inline-relcontent/i.test(attrs)) continue;
    // Photo captions use bare subscriber-preview — keep article first-p + unlocked body.
    if (
      /subscriber-preview/i.test(attrs) &&
      !/lee-article-text|first-p|article-body/i.test(attrs)
    ) {
      continue;
    }
    const inner = m[3].trim();
    if (stripTags(inner).length < 12) continue;
    if (tag === "blockquote" || TWEET_EMBED_RE.test(attrs)) {
      parts.push("<blockquote>" + inner + "</blockquote>");
    } else {
      // Inner is often already <p>…</p> after ROT47 unlock — don't double-wrap.
      if (/^\s*<p[\s>]/i.test(inner)) parts.push(inner);
      else parts.push("<p>" + inner + "</p>");
    }
  }
  if (!parts.length) return null;
  const joined = parts.join("\n");
  // Any unlocked paragraph is enough — prefer a usable story over a hard failure.
  const minLen = /stltoday\.com|lee\.net|townnews|blox/i.test(html) ? 40 : 200;
  return stripTags(joined).length >= minLen ? joined : null;
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

function extractBeehiivFragment(html: string): string | null {
  const openers = [
    /<div[^>]*id=["']content-blocks["'][^>]*>/i,
    /<div[^>]*class=["'][^"']*post-content-node[^"']*["'][^>]*>/i,
  ];
  for (const re of openers) {
    const frag = sliceBalancedDiv(html, re);
    if (frag && stripTags(frag).length > 120) return frag;
  }
  return null;
}

/** Baltimore Sun / Tribune article body — avoid sidebar "Most Popular" leakage. */
function extractTribuneArticleFragment(html: string): string | null {
  const openers = [
    /<div[^>]*class="[^"]*article-body[^"]*"[^>]*>/i,
    /<div[^>]*class="[^"]*story-body[^"]*"[^>]*>/i,
    /<div[^>]*class="[^"]*trb_article[^"]*"[^>]*>/i,
    /<div[^>]*itemprop=["']articleBody["'][^>]*>/i,
    /<article[^>]*class="[^"]*article[^"]*"[^>]*>/i,
  ];
  for (const re of openers) {
    const tag = re.source.includes("<article") ? "article" : "div";
    const frag = tag === "article"
      ? html.match(re)?.[0]
        ? (() => {
            const m = html.match(/<article[^>]*class="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/article>/i);
            return m?.[1] ?? null;
          })()
        : null
      : sliceBalancedDiv(html, re);
    if (frag && stripTags(frag).length > 200) {
      // Peel sidebar / popular modules that sometimes nest inside the body wrapper.
      let out = frag;
      for (let pass = 0; pass < 4; pass++) {
        const next = out.replace(
          /<(aside|section|div|nav|ul)[^>]*(?:most-popular|popular-stories|popular-module|more-stories|trb_pop|related-content|right-rail)[^>]*>[\s\S]*?<\/\1>/gi,
          "",
        );
        if (next === out) break;
        out = next;
      }
      if (stripTags(out).length > 200) return out;
    }
  }
  return null;
}

/** Gray Media / KY3 / Mosaic CMS article bodies. */
function extractGrayMediaFragment(html: string): string | null {
  const ld = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  if (ld) {
    for (const block of ld) {
      const inner = block.match(/>([\s\S]*?)<\/script>/i)?.[1];
      if (!inner) continue;
      try {
        const data = JSON.parse(inner) as {
          "@type"?: string;
          articleBody?: string;
          image?: string | { url?: string }[];
        };
        const body = data.articleBody?.trim();
        if (body && body.length > 120) {
          const imgs = Array.isArray(data.image)
            ? data.image.map((i) => (typeof i === "string" ? i : i.url)).filter(Boolean)
            : typeof data.image === "string"
              ? [data.image]
              : [];
          const lead = imgs[0] ? `<figure><img src="${imgs[0]}" alt="" loading="lazy"></figure>` : "";
          return `${lead}${body.startsWith("<") ? body : `<p>${body}</p>`}`;
        }
      } catch {
        /* next block */
      }
    }
  }

  const openers = [
    /<div[^>]*class="[^"]*RichTextArticleBody[^"]*"[^>]*>/i,
    /<div[^>]*class="[^"]*article-body[^"]*"[^>]*>/i,
    /<div[^>]*class="[^"]*story-body[^"]*"[^>]*>/i,
    /<section[^>]*class="[^"]*article-content[^"]*"[^>]*>/i,
  ];
  for (const re of openers) {
    const tag = re.source.includes("<section") ? "section" : "div";
    const frag =
      tag === "section"
        ? html.match(re)?.[0]
          ? html.match(/<section[^>]*class="[^"]*article-content[^"]*"[^>]*>([\s\S]*?)<\/section>/i)?.[1]
          : null
        : sliceBalancedDiv(html, re);
    if (frag && stripTags(frag).length > 120) return frag;
  }
  return null;
}

function isGrayMediaUrl(url: string): boolean {
  return /(?:^|\.)ky3\.com|kytv\.com|gray\.tv|graymedia/i.test(url);
}

function extractFragment(html: string, pageUrl = ""): string | null {
  // Baseball Savant is a React SPA — generic <main>/<nav> splits yield menu soup.
  if (isSavantPreviewUrl(pageUrl) || isBaseballSavantUrl(pageUrl)) {
    return null;
  }

  // Beehiiv newsletters — body lives in #content-blocks (free posts SSR'd).
  if (isBeehiivUrl(pageUrl)) {
    const beehiiv = extractBeehiivFragment(html);
    if (beehiiv) return beehiiv;
  }

  if (/baltimoresun\.com|chicagotribune\.com|orlandosentinel\.com/i.test(pageUrl)) {
    const tribune = extractTribuneArticleFragment(html);
    if (tribune) return tribune;
  }

  if (isGrayMediaUrl(pageUrl)) {
    const gray = extractGrayMediaFragment(html);
    if (gray) return gray;
  }

  // MLB.com news — never let an embedded clip steal the article body.
  if (isMlbNewsUrl(pageUrl)) {
    const news = extractMlbNewsFragment(html);
    if (news) return news;
  }

  // MLB Film Room / video pages — prefer mp4 autoplay card over chrome soup.
  // Do NOT run this on newspapers (STL Today embeds promo .mp4s that stole the body).
  if (isMlbVideoUrl(pageUrl)) {
    const mlbVideo = extractMlbVideoFragment(html, pageUrl);
    if (mlbVideo) return mlbVideo;
  }

  const townNews = extractTownNewsParagraphs(html);
  if (townNews) return townNews;

  // TownNews / BLOX + Yahoo + Heavy + SI + ESPN-style bodies.
  const balancedOpeners = [
    /<div[^>]*id=["']content-blocks["'][^>]*>/i,
    /<div[^>]*class=["'][^"']*post-content-node[^"']*["'][^>]*>/i,
    /<div[^>]*itemprop="articleBody"[^>]*>/i,
    /<div[^>]*class="[^"]*Story__Body[^"]*"[^>]*>/i,
    /<div[^>]*class="[^"]*lee-article-body[^"]*"[^>]*>/i,
    /<div[^>]*class="[^"]*blog-item-content[^"]*e-content[^"]*"[^>]*>/i,
    /<div[^>]*class="[^"]*e-content[^"]*"[^>]*>/i,
    /<div[^>]*class="[^"]*asset-content[^"]*"[^>]*>/i,
    /<div[^>]*class="[^"]*subscriber-premium[^"]*"[^>]*>/i,
    /<div[^>]*class="[^"]*content-body[^"]*"[^>]*>/i,
    /<div[^>]*class="[^"]*caas-body[^"]*"[^>]*>/i,
    /<div[^>]*class="[^"]*l-article__content[^"]*"[^>]*>/i,
    /<div[^>]*class="[^"]*c-content[^"]*entry-content[^"]*"[^>]*>/i,
  ];
  for (const re of balancedOpeners) {
    const frag = sliceBalancedDiv(html, re);
    if (frag && stripTags(frag).length > 200) return frag;
  }

  // ESPN often uses <aside>/<section> wrappers — try class-based slice too.
  const espn = html.match(
    /<(?:div|section|article)[^>]*class="[^"]*Story__Body[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section|article)>/i,
  );
  if (espn?.[1] && stripTags(espn[1]).length > 200) return espn[1];

  const patterns = [
    /<div[^>]*class="[^"]*blog-item-content[^"]*e-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div[^>]*class="[^"]*blog-item-author-profile/i,
    /<(?:div|section|article)[^>]*class="[^"]*(?:post-content|entry-content|article-content|article-body|post-body|rich-text|content-body|caas-body|Story__Body)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section|article)>/i,
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

function isMlbVideoUrl(url: string): boolean {
  return /mlb\.com/i.test(url) && /\/video\//i.test(url);
}

function isMlbNewsUrl(url: string): boolean {
  return (
    /mlb\.com/i.test(url) &&
    !/baseballsavant/i.test(url) &&
    !/\/video\//i.test(url) &&
    /\/(?:news|gameday|article|press-release|story)\b/i.test(url)
  );
}

function paragraphsFromText(text: string): string {
  const cleaned = decodeEntities(text.replace(/\r/g, "").trim());
  const bits = cleaned
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 40);
  if (bits.length >= 2) return bits.map((p) => `<p>${p}</p>`).join("\n");
  if (cleaned.length > 200) return `<p>${cleaned.replace(/\n/g, "</p><p>")}</p>`;
  return "";
}

function findJsonArticleBody(node: unknown, depth = 0): string | null {
  if (node == null || depth > 8) return null;
  if (typeof node === "string") {
    const t = node.trim();
    if (t.length > 400 && /<(p|div|br)\b/i.test(t)) return t;
    if (t.length > 600) return paragraphsFromText(t);
    return null;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = findJsonArticleBody(item, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof node !== "object") return null;
  const rec = node as Record<string, unknown>;
  for (const key of ["articleBody", "body", "content", "story", "html", "text"]) {
    if (key in rec) {
      const hit = findJsonArticleBody(rec[key], depth + 1);
      if (hit) return hit;
    }
  }
  if (rec["@type"] === "NewsArticle" || rec["@type"] === "Article") {
    for (const key of ["articleBody", "text", "description"]) {
      const hit = findJsonArticleBody(rec[key], depth + 1);
      if (hit) return hit;
    }
  }
  if (rec["@graph"]) {
    const hit = findJsonArticleBody(rec["@graph"], depth + 1);
    if (hit) return hit;
  }
  for (const val of Object.values(rec)) {
    if (val && typeof val === "object") {
      const hit = findJsonArticleBody(val, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

function extractMlbNewsFragment(html: string): string | null {
  for (const m of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const data = JSON.parse(m[1] ?? "");
      const body = findJsonArticleBody(data);
      if (body && stripTags(body).length > 400) return body;
    } catch {
      /* next */
    }
  }

  const next = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (next?.[1]) {
    try {
      const body = findJsonArticleBody(JSON.parse(next[1]));
      if (body && stripTags(body).length > 400) return body;
    } catch {
      /* ignore */
    }
  }

  const preloaded = html.match(/__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/i);
  if (preloaded?.[1]) {
    try {
      const body = findJsonArticleBody(JSON.parse(preloaded[1]));
      if (body && stripTags(body).length > 400) return body;
    } catch {
      /* ignore */
    }
  }

  const markdownParts = [
    ...html.matchAll(
      /<div[^>]*class="[^"]*story-part markdown[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    ),
  ].map((m) => m[0]);
  if (markdownParts.length >= 2) {
    const joined = markdownParts.join("\n");
    if (stripTags(joined).length > 400) return joined;
  }

  const openers = [
    /<div[^>]*class="[^"]*MarkdownContainer[^"]*"[^>]*>/i,
    /<div[^>]*class="[^"]*ArticleBody[^"]*"[^>]*>/i,
    /<div[^>]*class="[^"]*article-body[^"]*"[^>]*>/i,
    /<div[^>]*class="[^"]*ArticleTemplate[^"]*"[^>]*>/i,
    /<div[^>]*data-testid="article-body"[^>]*>/i,
    /<div[^>]*data-type="article-body"[^>]*>/i,
    /<section[^>]*class="[^"]*article-body[^"]*"[^>]*>/i,
  ];
  for (const re of openers) {
    const frag = /<section/i.test(re.source)
      ? html.match(
          /<section[^>]*class="[^"]*article-body[^"]*"[^>]*>([\s\S]*?)<\/section>/i,
        )?.[1] ?? null
      : sliceBalancedDiv(html, re);
    if (frag && stripTags(frag).length > 400) return frag;
  }

  const ps = [...html.matchAll(/<p[^>]*class="[^"]*(?:ArticleBody|article-body|body-text)[^"]*"[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => m[0]);
  if (ps.length >= 3) {
    const joined = ps.join("\n");
    if (stripTags(joined).length > 400) return joined;
  }
  return null;
}

function isBaseballSavantUrl(url: string): boolean {
  return /baseballsavant\.mlb\.com/i.test(url);
}

function isSavantPreviewUrl(url: string): boolean {
  return isBaseballSavantUrl(url) && /\/preview(?:\?|#|$)/i.test(url);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function lerpChannel(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Baseball Savant percentile heat map: blue (poor) → white → red (great). */
function savantPercentileStyle(pct: number | string | null | undefined): string {
  if (pct == null || pct === "") return "";
  const n = Number(pct);
  if (!Number.isFinite(n)) return "";
  const t = Math.max(0, Math.min(100, n));
  const poor: [number, number, number] = [0x8f, 0xab, 0xdc];
  const mid: [number, number, number] = [0xff, 0xff, 0xff];
  const great: [number, number, number] = [0xd8, 0x21, 0x29];
  let rgb: [number, number, number];
  if (t <= 50) {
    const u = t / 50;
    rgb = [
      Math.round(lerpChannel(poor[0], mid[0], u)),
      Math.round(lerpChannel(poor[1], mid[1], u)),
      Math.round(lerpChannel(poor[2], mid[2], u)),
    ];
  } else {
    const u = (t - 50) / 50;
    rgb = [
      Math.round(lerpChannel(mid[0], great[0], u)),
      Math.round(lerpChannel(mid[1], great[1], u)),
      Math.round(lerpChannel(mid[2], great[2], u)),
    ];
  }
  const [r, g, b] = rgb;
  const lum = (299 * r + 587 * g + 114 * b) / 1000;
  const fg = lum > 125 ? "#000" : "#fff";
  return `background-color:rgb(${r},${g},${b});color:${fg};text-align:center`;
}

function savantFmt(value: unknown, kind: "int" | "1" | "avg" | "pct"): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(String(value).replace(/%/g, ""));
  if (!Number.isFinite(n)) {
    const s = String(value).trim();
    return s || "—";
  }
  if (kind === "int") return String(Math.round(n));
  if (kind === "1") return n.toFixed(1);
  if (kind === "pct") return n.toFixed(1);
  // batting-average style (.xxx)
  if (n >= 0 && n < 1) return n.toFixed(3).replace(/^0/, "");
  return n.toFixed(3);
}

type SavantPerson = { id?: number; fullName?: string };
type SavantPosition = { abbreviation?: string };
type SavantGameStatus = { isOnBench?: boolean };
type SavantPlayer = {
  person?: SavantPerson;
  position?: SavantPosition;
  gameStatus?: SavantGameStatus;
  battingOrder?: number | string | null;
  playerOrder?: number | null;
  batted_ball?: number | null;
  launch_angle_avg?: number | string | null;
  exit_velocity_avg?: number | string | null;
  hard_hit_percent?: number | string | null;
  xwoba?: number | string | null;
  xba?: number | string | null;
  xslg?: number | string | null;
  k_percent?: number | string | null;
  bb_percent?: number | string | null;
  whiff_percent?: number | string | null;
  didNotQualify?: string | null;
  percent_rank_exit_velocity_avg?: number | null;
  percent_rank_hard_hit_percent?: number | null;
  percent_rank_xwoba?: number | null;
  percent_rank_xba?: number | null;
  percent_rank_xslg?: number | null;
  percent_rank_k_percent?: number | null;
  percent_rank_bb_percent?: number | null;
  percent_rank_whiff_percent?: number | null;
};

type SavantSide = {
  hasLineup?: boolean;
  fileCode?: string;
  team?: { id?: number; name?: string; abbreviation?: string; teamName?: string };
  roster?: { hitters?: SavantPlayer[]; pitchers?: SavantPlayer[] };
};

type SavantTeamsPayload = {
  home?: SavantSide;
  away?: SavantSide;
  gameDate?: string;
};

function parseSavantTeamsJson(html: string): SavantTeamsPayload | null {
  const marker = html.match(/var\s+teams\s*=\s*\{/);
  if (!marker || marker.index == null) return null;
  const start = marker.index + marker[0].indexOf("{");
  let depth = 0;
  let end = -1;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end < 0) return null;
  try {
    return JSON.parse(html.slice(start, end)) as SavantTeamsPayload;
  } catch {
    return null;
  }
}

function savantHeadshot(playerId: number): string {
  return (
    `https://img.mlbstatic.com/mlb-photos/image/upload/` +
    `d_people:generic:headshot:67:current.png/w_64,q_auto:best/v1/people/${playerId}/headshot/67/current`
  );
}

function savantTeamLogo(teamId: number): string {
  return `https://www.mlbstatic.com/team-logos/team-primary-on-light/${teamId}.svg`;
}

function savantSortHitters(players: SavantPlayer[]): SavantPlayer[] {
  return [...players].sort((a, b) => {
    const ao = Number(a.battingOrder ?? a.playerOrder ?? 9999);
    const bo = Number(b.battingOrder ?? b.playerOrder ?? 9999);
    if (ao !== bo) return ao - bo;
    return String(a.person?.fullName ?? "").localeCompare(String(b.person?.fullName ?? ""));
  });
}

function savantHeatCell(
  display: string,
  pct: number | string | null | undefined,
): string {
  const style = savantPercentileStyle(pct);
  if (style) return `<td style="${style}">${escapeHtml(display)}</td>`;
  return `<td style="text-align:center">${escapeHtml(display)}</td>`;
}

function buildSavantHittersTable(players: SavantPlayer[], startersOnly: boolean): string {
  const rows = savantSortHitters(
    startersOnly
      ? players.filter((p) => !p.gameStatus?.isOnBench)
      : players,
  );
  if (!rows.length) return "";
  const body = rows
    .map((p) => {
      const id = p.person?.id;
      const name = p.person?.fullName ?? "Player";
      const dnq = p.didNotQualify === "*" || p.didNotQualify === "true" ? "*" : "";
      const pos = p.position?.abbreviation ?? "—";
      const mug = id
        ? `<img class="rss-savant-mug" src="${savantHeadshot(id)}" alt="" width="28" height="28" loading="lazy" />`
        : "";
      const nameCell =
        `<td style="white-space:nowrap;vertical-align:middle">` +
        `<span style="display:inline-flex;align-items:center;gap:8px">` +
        mug +
        `<span>${escapeHtml(name)}${dnq}</span></span></td>`;
      return (
        `<tr>${nameCell}` +
        `<td style="text-align:center">${escapeHtml(pos)}</td>` +
        `<td style="text-align:center">${escapeHtml(savantFmt(p.batted_ball, "int"))}</td>` +
        `<td style="text-align:center">${escapeHtml(savantFmt(p.launch_angle_avg, "1"))}</td>` +
        savantHeatCell(savantFmt(p.exit_velocity_avg, "1"), p.percent_rank_exit_velocity_avg) +
        savantHeatCell(savantFmt(p.hard_hit_percent, "pct"), p.percent_rank_hard_hit_percent) +
        savantHeatCell(savantFmt(p.xwoba, "avg"), p.percent_rank_xwoba) +
        savantHeatCell(savantFmt(p.xba, "avg"), p.percent_rank_xba) +
        `</tr>`
      );
    })
    .join("");
  return (
    `<h3>Hitters</h3>` +
    `<table>` +
    `<thead><tr>` +
    `<th>Name</th><th>Pos.</th><th>BBE</th><th>LA°</th><th>EV</th>` +
    `<th>Hard Hit%</th><th>xwOBA</th><th>xBA</th>` +
    `</tr></thead><tbody>${body}</tbody></table>`
  );
}

function buildSavantPitchersTable(players: SavantPlayer[]): string {
  const rows = [...players].sort((a, b) =>
    String(a.person?.fullName ?? "").localeCompare(String(b.person?.fullName ?? "")),
  );
  if (!rows.length) return "";
  const body = rows
    .map((p) => {
      const id = p.person?.id;
      const name = p.person?.fullName ?? "Pitcher";
      const dnq = p.didNotQualify === "*" || p.didNotQualify === "true" ? "*" : "";
      const mug = id
        ? `<img class="rss-savant-mug" src="${savantHeadshot(id)}" alt="" width="28" height="28" loading="lazy" />`
        : "";
      const nameCell =
        `<td style="white-space:nowrap;vertical-align:middle">` +
        `<span style="display:inline-flex;align-items:center;gap:8px">` +
        mug +
        `<span>${escapeHtml(name)}${dnq}</span></span></td>`;
      return (
        `<tr>${nameCell}` +
        savantHeatCell(savantFmt(p.exit_velocity_avg, "1"), p.percent_rank_exit_velocity_avg) +
        savantHeatCell(savantFmt(p.hard_hit_percent, "pct"), p.percent_rank_hard_hit_percent) +
        savantHeatCell(savantFmt(p.xwoba, "avg"), p.percent_rank_xwoba) +
        savantHeatCell(savantFmt(p.xba, "avg"), p.percent_rank_xba) +
        savantHeatCell(savantFmt(p.k_percent, "pct"), p.percent_rank_k_percent) +
        savantHeatCell(savantFmt(p.bb_percent, "pct"), p.percent_rank_bb_percent) +
        savantHeatCell(savantFmt(p.whiff_percent, "pct"), p.percent_rank_whiff_percent) +
        `</tr>`
      );
    })
    .join("");
  return (
    `<h3>Pitchers</h3>` +
    `<table>` +
    `<thead><tr>` +
    `<th>Name</th><th>EV</th><th>Hard Hit%</th><th>xwOBA</th><th>xBA</th>` +
    `<th>K%</th><th>BB%</th><th>Whiff%</th>` +
    `</tr></thead><tbody>${body}</tbody></table>`
  );
}

function buildSavantTeamSection(side: SavantSide, startersOnly: boolean): string {
  const team = side.team;
  const name = team?.name || team?.teamName || "Team";
  const teamId = team?.id;
  const logo = teamId
    ? `<img class="rss-savant-logo" src="${savantTeamLogo(teamId)}" alt="${escapeHtml(name)}" width="48" height="48" loading="lazy" />`
    : "";
  const hitters = side.roster?.hitters ?? [];
  const pitchers = side.roster?.pitchers ?? [];
  const hittersHtml = buildSavantHittersTable(hitters, startersOnly && Boolean(side.hasLineup));
  const pitchersHtml = buildSavantPitchersTable(pitchers);
  if (!hittersHtml && !pitchersHtml) return "";
  return (
    `<div class="rss-savant-team">` +
    `<p style="display:flex;align-items:center;gap:10px;margin:1.25rem 0 0.35rem">` +
    logo +
    `<strong style="font-size:1.15em">${escapeHtml(name)}</strong></p>` +
    hittersHtml +
    pitchersHtml +
    `</div>`
  );
}

function buildSavantPreviewHtml(
  data: SavantTeamsPayload,
  opts: { focusTeamId?: number | null; focusFileCode?: string | null },
): string {
  const sides: SavantSide[] = [];
  if (data.away) sides.push(data.away);
  if (data.home) sides.push(data.home);
  let chosen = sides;
  if (opts.focusTeamId) {
    const hit = sides.filter((s) => Number(s.team?.id) === opts.focusTeamId);
    if (hit.length) chosen = hit;
  } else if (opts.focusFileCode) {
    const code = opts.focusFileCode.toLowerCase();
    const hit = sides.filter((s) => (s.fileCode || "").toLowerCase() === code);
    if (hit.length) chosen = hit;
  }
  const startersOnly = chosen.some((s) => s.hasLineup);
  const sections = chosen
    .map((s) => buildSavantTeamSection(s, startersOnly))
    .filter(Boolean);
  if (!sections.length) return "";
  const date = data.gameDate ? escapeHtml(String(data.gameDate)) : "";
  return (
    `<p><strong>Statcast Game Preview</strong>${date ? ` · ${date}` : ""}</p>` +
    sections.join("\n") +
    `<p style="margin-top:1rem;font-size:0.85em">` +
    `<span style="display:inline-block;width:12px;height:12px;background:#D82129;margin-right:4px;vertical-align:middle"></span> Great ` +
    `<span style="display:inline-block;width:12px;height:12px;background:#8fabdc;margin-left:10px;margin-right:4px;vertical-align:middle"></span> Poor` +
    ` · * Did Not Qualify</p>`
  );
}

async function extractSavantPreviewFromUrl(url: string): Promise<{
  title: string | null;
  byline: string | null;
  image: string | null;
  html: string;
} | null> {
  if (!isSavantPreviewUrl(url)) return null;
  let gamePk: string | null = null;
  let focusTeamId: number | null = null;
  let focusFileCode: string | null = null;
  try {
    const u = new URL(url);
    gamePk = u.searchParams.get("game_pk") || u.searchParams.get("gamePk");
    const teamParam =
      u.searchParams.get("teamId") ||
      u.searchParams.get("team_id") ||
      u.searchParams.get("team");
    if (teamParam && /^\d+$/.test(teamParam)) focusTeamId = Number(teamParam);
    else if (teamParam && /^[a-z]{2,3}$/i.test(teamParam)) {
      focusFileCode = teamParam.toLowerCase();
    }
  } catch {
    return null;
  }
  if (!gamePk) return null;

  const previewUrl = `https://baseballsavant.mlb.com/preview?game_pk=${encodeURIComponent(gamePk)}`;
  const res = await fetch(previewUrl, {
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://baseballsavant.mlb.com/",
    },
    redirect: "follow",
  });
  if (!res.ok) return null;
  const html = await res.text();
  const teams = parseSavantTeamsJson(html);
  if (!teams?.away && !teams?.home) return null;
  const built = buildSavantPreviewHtml(teams, { focusTeamId, focusFileCode });
  if (!built || stripTags(built).length < 40) return null;
  const meta = pageMeta(html);
  return {
    title: meta.title || `Statcast Game Preview`,
    byline: "Baseball Savant",
    image: meta.image,
    html: built,
  };
}

function cleanMediaUrl(raw: string): string {
  return raw
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/\\+$/g, "")
    .replace(/&amp;/g, "&")
    .trim();
}

function mlbVideoFallbackHtml(url: string, title?: string | null): string {
  const label = title ? stripTags(title) : "Watch on MLB.com";
  return (
    `<p>This MLB.com item is a video clip. Playback couldn’t be embedded here.</p>` +
    `<p><a href="${url.replace(/"/g, "")}" target="_blank" rel="noopener noreferrer">${label}</a></p>`
  );
}

/** Pull a clean autoplay video card out of MLB.com Film Room / clip pages. */
function extractMlbVideoFragment(html: string, pageUrl = ""): string | null {
  const diamondMatches = [
    ...html.matchAll(/https:\/\/mlb-cuts-diamond\.mlb\.com\/[^"'\\\s>]+\.mp4/gi),
  ].map((m) => cleanMediaUrl(m[0]));
  // Prefer mid-bitrate diamond cuts when several qualities are present.
  const diamond =
    diamondMatches.find((u) => /_4000K\.mp4/i.test(u)) ||
    diamondMatches.find((u) => /_2500K\.mp4/i.test(u)) ||
    diamondMatches[0] ||
    null;

  const mp4 =
    diamond ||
    (html.match(/https:\/\/darkroom-clips\.mlb\.com\/[0-9a-f-]+\.mp4/i)?.[0]
      ? cleanMediaUrl(html.match(/https:\/\/darkroom-clips\.mlb\.com\/[0-9a-f-]+\.mp4/i)![0])
      : null) ||
    (html.match(/https:\/\/[^"'\\\s>]+mp4Avc[^"'\\\s>]*\.mp4/i)?.[0]
      ? cleanMediaUrl(html.match(/https:\/\/[^"'\\\s>]+mp4Avc[^"'\\\s>]*\.mp4/i)![0])
      : null) ||
    (html.match(/"mp4Avc"\s*:\s*"((?:\\.|[^"\\])*)"/i)?.[1]
      ? cleanMediaUrl(html.match(/"mp4Avc"\s*:\s*"((?:\\.|[^"\\])*)"/i)![1])
      : null) ||
    // Generic .mp4 only on MLB pages — newspapers embed unrelated promo clips.
    (/mlb\.com/i.test(pageUrl) && html.match(/"(https:\/\/[^"]+\.mp4)"/i)?.[1]
      ? cleanMediaUrl(html.match(/"(https:\/\/[^"]+\.mp4)"/i)![1])
      : null) ||
    (/mlb\.com/i.test(pageUrl) && html.match(/content=["'](https:\/\/[^"']+\.mp4)["']/i)?.[1]
      ? cleanMediaUrl(html.match(/content=["'](https:\/\/[^"']+\.mp4)["']/i)![1])
      : null) ||
    null;

  const ogVideoRaw =
    html.match(/<meta[^>]+property=["']og:video(?::secure_url|:url)?["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video(?::secure_url|:url)?["']/i)?.[1] ||
    null;
  const ogVideo = ogVideoRaw ? cleanMediaUrl(ogVideoRaw) : null;

  const src = mp4 || (ogVideo && /\.mp4(\?|$)/i.test(ogVideo) ? ogVideo : null);
  if (!src) return null;

  const isVideoPage =
    isMlbVideoUrl(pageUrl) ||
    /film.?room|darkroom-clips|mlb-cuts-diamond|mp4Avc|HTTP_CLOUD_WIRED|og:video/i.test(html) ||
    /mlb\.com\/[^"'\s]*\/video\//i.test(html) ||
    /mlb\.com\/video\//i.test(html);
  if (!isVideoPage && !mp4) return null;

  const title =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ||
    "Highlight";
  const cleanTitle = stripTags(title).replace(/\s*\|\s*0?\d+\/\d+.*/i, "").trim();
  return (
    `<p><video class="rss-video" src="${src}" controls autoplay muted playsinline loop preload="auto"></video></p>` +
    (cleanTitle ? `<p>${cleanTitle}</p>` : "")
  );
}

const JUNK_TEXT_RE =
  /(?:get email notifications|your notification has been saved|problem saving your notification|followed notifications|please log in to use this feature|don't have an account|sign up today|gift this article|new subscriber benefit|copied to clipboard|out of gifts for the month|share this article paywall|prefer us on google|preferred news source|author twitter|author email|follow [\w .|/-]+ post-dispatch|manage followed notifications|facebook|twitter|bluesky|whatsapp|\bsms\b|copy (?:article )?link|copy link|\bprint\b|\{\{[^}]+\}\}|data-(?:html|toggle|placement|trigger)|aria-label="tooltip|tabindex="0"|role="button"|story by|appeared first on|film room powered by|advertisement|more mlb on heavy|share on x|opens in new window|email a link to a friend|sports\s*mlb|most popular)/i;

/** Drop leftover chrome paragraphs and leaked attribute debris after sanitize. */
function scrubContentHtml(html: string, heroImage: string | null = null): string {
  let out = html
    .replace(/\s*data-[a-z0-9-]+="[^"]*"/gi, "")
    .replace(/\s*(?:role|aria-label|tabindex|data-placement|data-trigger|data-toggle|data-html)="[^"]*"/gi, "")
    .replace(/\{\{[^}]+\}\}/g, "")
    .replace(/"[^"]*data-html="true"[^<]*/gi, "")
    // Drop captions / photo credits entirely.
    .replace(/<figcaption\b[^>]*>[\s\S]*?<\/figcaption>/gi, "")
    .replace(/<figure\b[^>]*>\s*<\/figure>/gi, "");

  out = out.replace(/<(p|li|h[1-6]|blockquote)(\b[^>]*)>([\s\S]*?)<\/\1>/gi, (full, tag, attrs, inner) => {
    if (tag === "blockquote" && (TWEET_EMBED_RE.test(attrs) || TWEET_URL_RE.test(inner))) {
      return "<" + tag + attrs + ">" + inner + "</" + tag + ">";
    }
    const text = stripTags(inner).replace(/\s+/g, " ").trim();
    if (!text) return "";
    if (CAPTION_RE.test(text) && text.length < 420) return "";
    if (FILM_ROOM_CHROME_RE.test(text) && text.length < 280) return "";
    if (PROMO_LINK_RE.test(text) && text.length < 220) return "";
    if (BYLINE_NOISE_RE.test(text) && text.length < 160) return "";
    if (/^(?:advertisement)+$/i.test(text.replace(/\s+/g, ""))) return "";
    if (text.length < 120 && JUNK_TEXT_RE.test(text)) return "";
    if (/^(?:facebook|twitter|bluesky|whatsapp|sms|email|print|copy link|save|close|log in|story by|most popular)$/i.test(text)) {
      return "";
    }
    // Promo bullets that are mostly a single link.
    if (tag === "li" || tag === "p") {
      const onlyLink = inner.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, "").replace(/<[^>]+>/g, "").trim();
      if (!onlyLink && /<a\b/i.test(inner) && PROMO_LINK_RE.test(inner)) return "";
    }
    return "<" + tag + attrs + ">" + inner + "</" + tag + ">";
  });

  // Drop promo anchors that sit alone in lists.
  out = out.replace(/<li\b[^>]*>\s*<a\b[^>]*>([\s\S]*?)<\/a>\s*<\/li>/gi, (full, label) => {
    const t = stripTags(label);
    if (PROMO_LINK_RE.test(t) || /get tickets|ticket package|star wars/i.test(t)) return "";
    return full;
  });

  // Bare "Follow" CTAs + MLB Morning Lineup signup chrome.
  out = out
    .replace(/<a\b[^>]*>\s*Follow\s*<\/a>/gi, "")
    .replace(
      /<(?:p|div|section|aside)\b[^>]*>[\s\S]*?(?:get the latest from mlb|morning lineup)[\s\S]*?<\/(?:p|div|section|aside)>/gi,
      (full) => (stripTags(full).replace(/\s+/g, " ").trim().length < 280 ? "" : full),
    )
    // Mashed section breadcrumbs like "SportsMLBCubs" / "Sports MLB Chicago Cubs".
    .replace(
      /<(?:p|li|nav|a|span|div)\b[^>]*>\s*(?:Sports\s*)?MLB\s*(?:Chicago\s*)?Cubs\s*<\/(?:p|li|nav|a|span|div)>/gi,
      "",
    )
    .replace(
      /<(?:p|li|nav|a|span|div)\b[^>]*>\s*Sports\s*MLB\s*[A-Za-z][A-Za-z\s]{0,32}\s*<\/(?:p|li|nav|a|span|div)>/gi,
      "",
    )
    .replace(
      /<(?:p|li|a|span)\b[^>]*>\s*SportsMLB[A-Za-z]{2,24}\s*<\/(?:p|li|a|span)>/gi,
      "",
    );

  out = dedupeImages(out, heroImage);

  // Smash leftover ad markers / byline promo lines that survive tag filters.
  out = out
    .replace(/(?:<p[^>]*>\s*)?(?:Advertisement\s*){1,}(?:<\/p>)?/gi, "")
    .replace(/<a\b[^>]*>\s*More MLB on Heavy:[\s\S]*?<\/a>/gi, "")
    .replace(/<p\b[^>]*>\s*More MLB on Heavy:[\s\S]*?<\/p>/gi, "")
    .replace(
      /<(?:p|li|h[1-6])\b[^>]*>\s*(?:<a\b[^>]*>)?\s*[A-Z][a-z]+(?:\s+[A-Z][a-z.'-]+)+\s*\|\s*(?:Post-Dispatch|Associated Press|AP|Reuters|ESPN|Heavy|Yahoo Sports)[^<]*(?:<\/a>)?\s*<\/(?:p|li|h[1-6])>/gi,
      "",
    );

  // Orphaned chrome lines not wrapped in p
  out = out
    .split(/\n+/)
    .filter((line) => {
      const t = stripTags(line).replace(/\s+/g, " ").trim();
      if (!t) return true;
      if (CAPTION_RE.test(t) && t.length < 420) return false;
      if (FILM_ROOM_CHROME_RE.test(t) && t.length < 280) return false;
      if (BYLINE_NOISE_RE.test(t) && t.length < 160) return false;
      if (/^(?:advertisement)+$/i.test(t.replace(/\s+/g, ""))) return false;
      if (t.length < 160 && JUNK_TEXT_RE.test(t)) return false;
      return true;
    })
    .join("\n");

  return out
    .replace(/<p>\s*<\/p>/gi, "")
    .replace(/<ul>\s*<\/ul>/gi, "")
    .replace(/(?:\s*<br>\s*){3,}/gi, "<br><br>")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeImgKey(src: string): string {
  try {
    const u = new URL(src);
    u.hash = "";
    ["w", "h", "width", "height", "quality", "format", "fit", "crop"].forEach((k) =>
      u.searchParams.delete(k),
    );
    // Collapse common CDN resize prefixes; keep path basename identity.
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();
    return `${u.hostname.replace(/^www\./, "")}${path}`;
  } catch {
    return src.split("?")[0]!.toLowerCase();
  }
}

function dedupeImages(html: string, heroImage: string | null): string {
  if (!heroImage) return html;
  const heroKey = normalizeImgKey(heroImage);
  let seenHeroDup = false;
  return html.replace(/<img\b([^>]*)>/gi, (full, attrs) => {
    const src = attrValue(String(attrs), "src");
    if (!src) return "";
    const key = normalizeImgKey(src);
    if (!seenHeroDup && key === heroKey) {
      seenHeroDup = true;
      return "";
    }
    return full;
  });
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

/** Turn twitter-tweet markup into a clean quote + attribution footer. */
function stylizeTweetBlockquotes(html: string): string {
  return html.replace(/<blockquote\b([^>]*)>([\s\S]*?)<\/blockquote>/gi, (_full, attrs, inner) => {
    const hay = String(attrs) + " " + String(inner);
    const isTweet =
      TWEET_EMBED_RE.test(hay) ||
      TWEET_URL_RE.test(hay) ||
      /(?:^|[\s>])(?:—|&mdash;)\s*[^<]+?\(@\w+\)/i.test(stripTags(inner));

    let body = String(inner)
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/pic\.twitter\.com\/\w+/gi, "")
      .trim();

    // Already has a footer — keep structure, mark as tweet when applicable.
    if (/<footer\b/i.test(body)) {
      return `<blockquote${isTweet ? ' class="rss-tweet"' : ""}>${body}</blockquote>`;
    }

    // Common embed shape: <p>…</p> — Name (@handle) <a>Date</a>
    const metaMatch = body.match(
      /(?:<br\s*\/?>|\n|\s)*(?:—|&mdash;|–|&ndash;)\s*([\s\S]*?)(<a\b[^>]*>[\s\S]*?<\/a>)\s*$/i,
    );
    if (metaMatch && (isTweet || /\(@\w+\)/.test(metaMatch[1]))) {
      const before = body.slice(0, metaMatch.index).trim();
      const who = stripTags(metaMatch[1]).replace(/\s+/g, " ").trim();
      const link = metaMatch[2];
      body =
        before +
        `<footer class="rss-tweet-meta">— ${who} ${link}</footer>`;
      return `<blockquote class="rss-tweet">${body}</blockquote>`;
    }

    if (isTweet) {
      return `<blockquote class="rss-tweet">${body}</blockquote>`;
    }
    return `<blockquote>${body}</blockquote>`;
  });
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
        if (!href || !/^(https?:|mailto:|\/)/i.test(href)) return "";
        if (/tickets|specials|shop\.mlb|ticket.?package|star.?wars/i.test(href)) return "";
        keep.push('href="' + href.replace(/"/g, "") + '"');
        keep.push('target="_blank"');
        keep.push('rel="noopener noreferrer"');
      }
      // Allow safe inline styles for Statcast heat-map cells / compact mugs.
      const rawStyle = attrValue(attrs, "style");
      if (
        rawStyle &&
        /^(?:table|thead|tbody|tr|th|td|span|div|p|img)$/i.test(name) &&
        !/expression\s*\(|javascript:|url\s*\(\s*["']?\s*data:/i.test(rawStyle)
      ) {
        const safe = rawStyle
          .replace(/["<>]/g, "")
          .split(";")
          .map((part) => part.trim())
          .filter((part) =>
            /^(?:background-color|color|text-align|vertical-align|white-space|width|height|max-width|max-height|min-width|padding|margin|border-radius|display|align-items|gap|font-size|font-weight|object-fit)\s*:/i.test(
              part,
            ),
          )
          .join(";");
        if (safe) keep.push('style="' + safe + '"');
      }
      const rawClass = attrValue(attrs, "class");
      if (rawClass && /^rss-[\w\s-]+$/i.test(rawClass.trim())) {
        keep.push('class="' + rawClass.trim().replace(/"/g, "") + '"');
      }

      if (name === "img") {
        const scoreUrl = (raw: string): number => {
          const u = raw.toLowerCase();
          if (!u || u.startsWith("data:")) return -1000;
          let score = 10;
          if (/(?:blur|lqip|placeholder|spacer|pixel|transparent|1x1|dummy)/i.test(u)) {
            score -= 80;
          }
          if (/[?&](?:w|width)=(?:[1-9]|[1-9]\d|1\d\d)(?:&|$)/i.test(u)) score -= 40;
          if (/[?&](?:w|width)=(?:[5-9]\d{2}|\d{4,})(?:&|$)/i.test(u)) score += 40;
          if (/\.(?:jpe?g|png|webp)(?:$|\?)/i.test(u)) score += 8;
          score += Math.min(raw.length / 40, 12);
          return score;
        };
        const largestSrcset = (srcset: string): string => {
          let best = "";
          let bestW = -1;
          for (const part of srcset.split(",")) {
            const bits = part.trim().split(/\s+/);
            const url = bits[0] || "";
            if (!url) continue;
            const wMark = bits.find((b) => /^\d+w$/i.test(b));
            const w = wMark ? Number(wMark.replace(/\D/g, "")) : 0;
            if (w > bestW) {
              bestW = w;
              best = url;
            } else if (!best) best = url;
          }
          return best;
        };
        const candidates = [
          attrValue(attrs, "data-src"),
          attrValue(attrs, "data-lazy-src"),
          attrValue(attrs, "data-original"),
          attrValue(attrs, "data-url"),
          attrValue(attrs, "data-image"),
          attrValue(attrs, "src"),
        ].filter((v): v is string => Boolean(v));
        const srcset =
          attrValue(attrs, "srcset") || attrValue(attrs, "data-srcset") || "";
        if (srcset) {
          const large = largestSrcset(srcset);
          if (large) candidates.unshift(large);
        }
        let src =
          candidates
            .map((c) => (c.startsWith("//") ? "https:" + c : c))
            .filter((c) => /^(https?:|\/)/i.test(c) && !c.startsWith("data:"))
            .sort((a, b) => scoreUrl(b) - scoreUrl(a))[0] || "";
        if (!src || !/^(https?:|\/)/i.test(src)) return "";
        keep.push('src="' + src.replace(/"/g, "") + '"');
        const alt = attrValue(attrs, "alt");
        if (alt) keep.push('alt="' + alt.replace(/"/g, "&quot;") + '"');
        keep.push('loading="lazy"');
        keep.push('referrerpolicy="no-referrer-when-downgrade"');
      }
      if (name === "video") {
        const src = attrValue(attrs, "src");
        if (src && /^https?:/i.test(src)) {
          keep.push('src="' + src.replace(/"/g, "") + '"');
        }
        keep.push("controls");
        keep.push("playsinline");
        keep.push("muted");
        keep.push("autoplay");
        keep.push('preload="auto"');
        keep.push('class="rss-video"');
        if (/\bloop\b/i.test(attrs)) keep.push("loop");
      }
      if (name === "source") {
        const src = attrValue(attrs, "src");
        if (!src || !/^https?:/i.test(src)) return "";
        keep.push('src="' + src.replace(/"/g, "") + '"');
        const type = attrValue(attrs, "type");
        if (type) keep.push('type="' + type.replace(/"/g, "") + '"');
      }
      if (name === "blockquote") {
        const cls = attrValue(attrs, "class") || "";
        if (TWEET_EMBED_RE.test(cls) || TWEET_EMBED_RE.test(attrs)) {
          keep.push('class="rss-tweet"');
        }
      }
      if (name === "footer" || name === "cite") {
        keep.push('class="rss-tweet-meta"');
      }
      return "<" + name + (keep.length ? " " + keep.join(" ") : "") + ">";
    },
  );

  return stylizeTweetBlockquotes(
    cleaned
      .replace(/\u200d|\ufeff/g, "")
      .replace(/<p>\s*<\/p>/gi, "")
      .replace(/(?:\s*<br>\s*){3,}/gi, "<br><br>")
      .trim(),
  );
}

function pageMeta(html: string) {
  const h1 =
    html.match(
      /<h1[^>]*class="[^"]*(?:headline|asset-headline|article-title|entry-title|title)[^"]*"[^>]*>([\s\S]*?)<\/h1>/i,
    )?.[1] ||
    html.match(/<h1[^>]*itemprop=["']headline["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1] ||
    null;
  const ogTitle =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1] ||
    null;
  const docTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || null;
  const clean = (raw: string | null) =>
    raw
      ? stripTags(raw)
          .replace(/https?:\/\/\S+/gi, " ")
          .replace(/\s*\|\s*STLtoday\.com.*$/i, "")
          .replace(/\s*\|\s*The Baltimore Sun.*$/i, "")
          .replace(/\s+/g, " ")
          .trim()
      : null;
  const h1Clean = clean(h1);
  const ogClean = clean(ogTitle);
  const docClean = clean(docTitle);
  const generic = /^(?:cardinals|st\.?\s*louis cardinals|mlb|sports|news|video|latest)$/i;
  let title: string | null = ogClean || docClean;
  if (h1Clean && (!title || generic.test(title) || (title && h1Clean.length > title.length + 6))) {
    title = h1Clean;
  }
  if (title && generic.test(title) && docClean && !generic.test(docClean)) title = docClean;
  const byline =
    html.match(/itemprop=["']author["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
    html.match(/class=["'][^"']*blog-author-name[^"']*["'][^>]*>([\s\S]*?)</i)?.[1] ||
    null;
  const image =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ||
    null;
  const cleanTitle = title
    ? stripTags(title)
        .replace(/https?:\/\/\S+/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
    : null;
  return {
    title: cleanTitle,
    byline: byline ? stripTags(byline) : null,
    image,
  };
}

function isBeehiivUrl(url: string): boolean {
  return /beehiiv\.com/i.test(url);
}

async function fetchText(url: string, attempt = 0): Promise<string> {
  const isTownNews = /stltoday\.com|lee\.net|townnews/i.test(url);
  const isGray = isGrayMediaUrl(url);
  const isSavant = isBaseballSavantUrl(url);
  const isBeehiiv = isBeehiivUrl(url);
  const res = await fetch(url, {
    headers: {
      "User-Agent": isTownNews || isSavant || isBeehiiv || isGray ? BROWSER_UA : UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      ...(isTownNews
        ? {
            Referer: "https://www.stltoday.com/",
            "Cache-Control": "no-cache",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
          }
        : {}),
      ...(isSavant
        ? { Referer: "https://baseballsavant.mlb.com/" }
        : isMlbVideoUrl(url) || /mlb\.com/i.test(url)
          ? { Referer: "https://www.mlb.com/" }
          : isBeehiiv
            ? { Referer: "https://words-about-birds.beehiiv.com/" }
            : {}),
    },
    redirect: "follow",
  });
  if (!res.ok) {
    // Soft retry for rate limits / transient CDN failures.
    if ((res.status === 429 || res.status === 503 || res.status === 502) && attempt < 2) {
      await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
      return fetchText(url, attempt + 1);
    }
    throw new Error("Upstream " + res.status + " for " + url);
  }
  return await res.text();
}

const CARDINALS_TEAM_ID = "24"; // ESPN team id (MLB.com uses 138)
const CARDINALS_ABBREV = "STL";
const SYNTHETIC_CARDINALS_WRAPS = "synthetic:cardinals-wraps";
const SYNTHETIC_MLB_WRAPS = "synthetic:mlb-wraps";
/** Serve cached wraps for up to 20m; cron refreshes every 15m. */
const FEED_CACHE_TTL_MS = 20 * 60_000;

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function readFeedCache(
  feedUrl: string,
  maxAgeMs: number,
): Promise<Record<string, unknown> | null> {
  const admin = adminClient();
  if (!admin) return null;
  try {
    const { data, error } = await admin
      .from("rss_feed_cache")
      .select("payload, updated_at")
      .eq("feed_url", feedUrl)
      .maybeSingle();
    if (error || !data?.payload) return null;
    const at = Date.parse(String(data.updated_at));
    if (!Number.isFinite(at) || Date.now() - at > maxAgeMs) return null;
    return data.payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function writeFeedCache(feedUrl: string, payload: Record<string, unknown>): Promise<void> {
  const admin = adminClient();
  if (!admin) return;
  try {
    await admin.from("rss_feed_cache").upsert({
      feed_url: feedUrl,
      payload,
      updated_at: new Date().toISOString(),
    });
  } catch {
    /* ignore cache write failures */
  }
}

function isSyntheticFeedUrl(raw: string): boolean {
  return raw.startsWith("synthetic:");
}

function formatEspnDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function espnRecapUrl(eventId: string): string {
  return `https://www.espn.com/mlb/recap/_/gameId/${eventId}`;
}

async function fetchEspnJson(url: string): Promise<unknown | null> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
  });
  if (!res.ok) return null;
  return await res.json();
}

type EspnCompetitor = {
  homeAway?: string;
  team?: {
    id?: string;
    abbreviation?: string;
    displayName?: string;
    shortDisplayName?: string;
  };
};

type EspnEvent = {
  id?: string;
  date?: string;
  name?: string;
  shortName?: string;
  status?: { type?: { state?: string; completed?: boolean; name?: string } };
  competitions?: {
    id?: string;
    date?: string;
    status?: { type?: { state?: string; completed?: boolean; name?: string } };
    competitors?: EspnCompetitor[];
  }[];
};

function isCardinalsGame(comp: { competitors?: EspnCompetitor[] }): boolean {
  return (comp.competitors ?? []).some(
    (c) => c.team?.id === CARDINALS_TEAM_ID || c.team?.abbreviation === CARDINALS_ABBREV,
  );
}

function isFinalGame(
  comp: { status?: { type?: { state?: string; completed?: boolean } } },
  event: EspnEvent,
): boolean {
  const status = comp.status?.type ?? event.status?.type;
  return status?.state === "post" || status?.completed === true;
}

function isPreviewGame(
  comp: { status?: { type?: { state?: string; completed?: boolean; name?: string } } },
  event: EspnEvent,
): boolean {
  const status = comp.status?.type ?? event.status?.type;
  return (
    status?.state === "pre" ||
    /STATUS_SCHEDULED|STATUS_PRE/i.test(String(status?.name ?? ""))
  );
}

async function buildCardinalsWrapsFeed(): Promise<Record<string, unknown>> {
  const items: FeedItem[] = [];
  const seen = new Set<string>();

  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const dateStr = formatEspnDate(d);

    const scoreboard = (await fetchEspnJson(
      `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${dateStr}`,
    )) as { events?: EspnEvent[] } | null;
    if (!scoreboard?.events?.length) continue;

    for (const event of scoreboard.events) {
      const comp = event.competitions?.[0];
      if (!comp || !isCardinalsGame(comp)) continue;
      const isFinal = isFinalGame(comp, event);
      const isPreview = isPreviewGame(comp, event);
      if (!isFinal && !isPreview) continue;

      const eventId = event.id ?? comp.id;
      if (!eventId || seen.has(eventId)) continue;
      seen.add(eventId);

      const summary = (await fetchEspnJson(
        `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${eventId}`,
      )) as {
        article?: {
          headline?: string;
          description?: string;
          story?: string;
          type?: string;
        };
        news?: {
          articles?: {
            headline?: string;
            description?: string;
            story?: string;
            type?: string;
          }[];
        };
      } | null;

      if (isFinal) {
        type StorySrc = {
          headline?: string;
          description?: string;
          story?: string;
          type?: string;
        };
        const espnPromo =
          /fantasy baseball|optimize your fantasy|stay ahead of the game|rolling 10-day outlook/i;
        const home = (comp.competitors ?? []).find((x) => x.homeAway === "home");
        const away = (comp.competitors ?? []).find((x) => x.homeAway === "away");
        const storyMentionsMatchup = (a: StorySrc) => {
          const blob = `${a.headline ?? ""} ${a.description ?? ""} ${a.story ?? ""}`.toLowerCase();
          const hits = (side?: EspnCompetitor) => {
            const abbrev = side?.team?.abbreviation ?? "";
            const name = side?.team?.displayName ?? "";
            const short = side?.team?.shortDisplayName ?? "";
            const nick = name.split(/\s+/).slice(-1)[0] ?? "";
            const keys = [abbrev, name, short, nick]
              .filter((k) => k && k.length >= 3)
              .map((k) => k.toLowerCase());
            if (abbrev === "STL") keys.push("cardinals", "cards");
            return keys.some((k) => blob.includes(k));
          };
          return hits(home) && hits(away);
        };
        const candidates: StorySrc[] = [];
        if (summary?.article && !/^media$/i.test(summary.article.type ?? "")) {
          candidates.push(summary.article);
        }
        for (const a of summary?.news?.articles ?? []) {
          const blob = `${a.headline ?? ""} ${a.description ?? ""} ${a.story ?? ""}`;
          if (a.headline && !espnPromo.test(blob) && !/^media$/i.test(a.type ?? "")) {
            candidates.push(a);
          }
        }
        let best: StorySrc | null = null;
        let bestLen = 0;
        for (const c of candidates) {
          if (!storyMentionsMatchup(c)) continue;
          const story = c.story ? stripTags(c.story).trim() : "";
          const desc = (c.description ?? "").replace(/^—\s*/, "").trim();
          const len = Math.max(story.length, desc.length);
          if (len > bestLen || (!best && c.headline)) {
            best = c;
            bestLen = len;
          }
        }
        if (!best?.headline) continue;
        const storyText = best.story ? stripTags(best.story).trim() : "";
        const description = (best.description ?? "").replace(/^—\s*/, "").trim();
        const hasStory = storyText.length >= 80;
        const hasProseDesc =
          description.length >= 60 && /[.!?]/.test(description) && !/^final\b/i.test(description);
        // Wait for real wrap prose — headline-only / scoreboard stubs open empty readers.
        if (!hasStory && !hasProseDesc) continue;
        const snippet = description || storyText.slice(0, 220);
        items.push({
          id: eventId,
          title: best.headline,
          link: espnRecapUrl(eventId),
          author: "ESPN",
          publishedAt: event.date ?? comp.date ?? null,
          image: null,
          snippet,
        });
      } else {
        const article = summary?.article;
        const headline = article?.headline?.trim() || "";
        const storyText = article?.story ? stripTags(article.story).trim() : "";
        const description = (article?.description ?? "").replace(/^—\s*/, "").trim();
        const body = description || storyText;
        const promo =
          /fantasy baseball|optimize your fantasy|stay ahead of the game|rolling 10-day outlook/i.test(
            `${headline} ${body}`,
          );
        // Only list Cardinals previews when ESPN has written preview copy.
        if (!headline || promo || body.length < 60 || /^game preview for\b/i.test(body)) {
          continue;
        }
        if (storyText.length < 80 && !(description.length >= 60 && /[.!?]/.test(description))) {
          continue;
        }
        items.push({
          id: `preview-${eventId}`,
          title: headline,
          link: `https://www.espn.com/mlb/preview/_/gameId/${eventId}`,
          author: "ESPN",
          publishedAt: event.date ?? comp.date ?? null,
          image: null,
          snippet: body.slice(0, 220),
        });
      }
    }
  }

  items.sort((a, b) => {
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return tb - ta;
  });

  return {
    title: "Cardinals wraps & previews",
    description: "St. Louis Cardinals game wraps and previews from ESPN",
    link: "https://www.espn.com/mlb/",
    feedUrl: SYNTHETIC_CARDINALS_WRAPS,
    items,
  };
}

/** League-wide MLB wraps — same prose bar as Cardinals; no scoreboard stubs. */
async function buildMlbWrapsFeed(): Promise<Record<string, unknown>> {
  type Cand = {
    eventId: string;
    event: EspnEvent;
    isFinal: boolean;
    isPreview: boolean;
  };
  const candidates: Cand[] = [];
  const seen = new Set<string>();
  const today = new Date();
  // Past 5 days + tomorrow (look-ahead for previews).
  for (let i = -1; i < 5; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const dateStr = formatEspnDate(d);
    const scoreboard = (await fetchEspnJson(
      `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${dateStr}`,
    )) as { events?: EspnEvent[] } | null;
    if (!scoreboard?.events?.length) continue;
    for (const event of scoreboard.events) {
      const comp = event.competitions?.[0];
      if (!comp) continue;
      const isFinal = isFinalGame(comp, event);
      const isPreview = isPreviewGame(comp, event);
      if (!isFinal && !isPreview) continue;
      // League-wide: only keep today's/tomorrow's previews (i <= 0).
      if (isPreview && i > 0) continue;
      const eventId = event.id ?? comp.id;
      if (!eventId || seen.has(eventId)) continue;
      seen.add(eventId);
      candidates.push({ eventId, event, isFinal, isPreview });
    }
  }

  candidates.sort((a, b) => {
    const da = a.event.date ? Date.parse(a.event.date) : 0;
    const db = b.event.date ? Date.parse(b.event.date) : 0;
    return db - da;
  });
  const limited = [
    ...candidates.filter((c) => c.isPreview),
    ...candidates.filter((c) => !c.isPreview),
  ].slice(0, 60);

  const items: FeedItem[] = [];
  const espnPromo =
    /fantasy baseball|optimize your fantasy|stay ahead of the game|rolling 10-day outlook|team hitting ratings|pitcher projections/i;

  const concurrency = 4;
  for (let i = 0; i < limited.length; i += concurrency) {
    const chunk = limited.slice(i, i + concurrency);
    const settled = await Promise.all(
      chunk.map(async (c) => {
        const comp = c.event.competitions?.[0];
        if (!comp) return null;
        const home = (comp.competitors ?? []).find((x) => x.homeAway === "home");
        const away = (comp.competitors ?? []).find((x) => x.homeAway === "away");
        const summary = (await fetchEspnJson(
          `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${c.eventId}`,
        )) as {
          article?: {
            headline?: string;
            description?: string;
            story?: string;
            type?: string;
          };
          news?: {
            articles?: {
              headline?: string;
              description?: string;
              story?: string;
              type?: string;
            }[];
          };
        } | null;
        if (!summary) return null;

        type StorySrc = {
          headline?: string;
          description?: string;
          story?: string;
          type?: string;
        };
        const storyMentionsMatchup = (a: StorySrc) => {
          const blob = `${a.headline ?? ""} ${a.description ?? ""} ${a.story ?? ""}`.toLowerCase();
          const hits = (side?: EspnCompetitor) => {
            const abbrev = side?.team?.abbreviation ?? "";
            const name = side?.team?.displayName ?? "";
            const short = side?.team?.shortDisplayName ?? "";
            const nick = name.split(/\s+/).slice(-1)[0] ?? "";
            const keys = [abbrev, name, short, nick]
              .filter((k) => k && k.length >= 3)
              .map((k) => k.toLowerCase());
            return keys.some((k) => blob.includes(k));
          };
          return hits(home) && hits(away);
        };
        const newsArticles = (summary.news?.articles ?? []).filter((a) => {
          const blob = `${a.headline ?? ""} ${a.description ?? ""} ${a.story ?? ""}`;
          return Boolean(a.headline) && !espnPromo.test(blob) && !/^media$/i.test(a.type ?? "");
        });

        const bodyLen = (a: StorySrc) => {
          const story = a.story ? stripTags(a.story).trim() : "";
          const desc = (a.description ?? "").replace(/^—\s*/, "").trim();
          return Math.max(story.length, desc.length);
        };

        let best: StorySrc | null = null;
        if (c.isFinal) {
          const pool: StorySrc[] = [];
          if (summary.article && !/^media$/i.test(summary.article.type ?? "")) {
            pool.push(summary.article);
          }
          for (const a of newsArticles) pool.push(a);
          let bestLen = 0;
          for (const cand of pool) {
            if (!storyMentionsMatchup(cand)) continue;
            const len = bodyLen(cand);
            if (len > bestLen || (!best && cand.headline)) {
              best = cand;
              bestLen = len;
            }
          }
        } else {
          const art = summary.article;
          if (
            art?.headline &&
            !espnPromo.test(`${art.headline} ${art.description ?? ""} ${art.story ?? ""}`) &&
            !/^media$/i.test(art.type ?? "") &&
            storyMentionsMatchup(art)
          ) {
            best = art;
          } else {
            // Previews: also search news rail for matchup copy.
            let bestLen = 0;
            for (const cand of newsArticles) {
              if (!storyMentionsMatchup(cand)) continue;
              const len = bodyLen(cand);
              if (len > bestLen || (!best && cand.headline)) {
                best = cand;
                bestLen = len;
              }
            }
          }
        }

        if (!best?.headline) return null;
        const storyText = best.story ? stripTags(best.story).trim() : "";
        const description = (best.description ?? "").replace(/^—\s*/, "").trim();
        const hasStory = storyText.length >= 80;
        const hasProseDesc =
          description.length >= 60 &&
          /[.!?]/.test(description) &&
          !(c.isFinal ? /^final\b/i.test(description) : /^first pitch\b/i.test(description));
        if (!hasStory && !hasProseDesc) return null;

        const snippet = description || storyText.slice(0, 220);
        if (c.isFinal) {
          return {
            id: `wrap-${c.eventId}`,
            title: best.headline,
            link: espnRecapUrl(c.eventId),
            author: "ESPN",
            publishedAt: c.event.date ?? null,
            image: null,
            snippet,
          } satisfies FeedItem;
        }
        return {
          id: `preview-${c.eventId}`,
          title: best.headline,
          link: `https://www.espn.com/mlb/preview/_/gameId/${c.eventId}`,
          author: "ESPN",
          publishedAt: c.event.date ?? null,
          image: null,
          snippet: snippet.slice(0, 220),
        } satisfies FeedItem;
      }),
    );
    for (const item of settled) {
      if (item) items.push(item);
    }
  }

  items.sort((a, b) => {
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return tb - ta;
  });

  return {
    title: "MLB wraps & previews",
    description: "League-wide MLB game wraps and previews from ESPN",
    link: "https://www.espn.com/mlb/",
    feedUrl: SYNTHETIC_MLB_WRAPS,
    items,
  };
}

async function handleCachedWrapFeed(
  feedUrl: string,
  builder: () => Promise<Record<string, unknown>>,
  forceRefresh = false,
): Promise<Response> {
  if (!forceRefresh) {
    const cached = await readFeedCache(feedUrl, FEED_CACHE_TTL_MS);
    if (cached) return json(cached);
  }
  const payload = await builder();
  await writeFeedCache(feedUrl, payload);
  return json(payload);
}

async function handleWarmWraps(): Promise<Response> {
  const results: Record<string, { ok: boolean; items?: number; error?: string }> = {};
  for (const [feedUrl, builder] of [
    [SYNTHETIC_MLB_WRAPS, buildMlbWrapsFeed],
    [SYNTHETIC_CARDINALS_WRAPS, buildCardinalsWrapsFeed],
  ] as const) {
    try {
      const payload = await builder();
      await writeFeedCache(feedUrl, payload);
      const items = Array.isArray(payload.items) ? payload.items.length : 0;
      results[feedUrl] = { ok: true, items };
    } catch (e) {
      results[feedUrl] = {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
  return json({ warmedAt: new Date().toISOString(), results });
}

async function handleFeed(feedUrl: string) {
  if (feedUrl === SYNTHETIC_CARDINALS_WRAPS) {
    return await handleCachedWrapFeed(feedUrl, buildCardinalsWrapsFeed);
  }
  if (feedUrl === SYNTHETIC_MLB_WRAPS) {
    return await handleCachedWrapFeed(feedUrl, buildMlbWrapsFeed);
  }
  if (isSyntheticFeedUrl(feedUrl)) {
    return json({ error: "Unknown synthetic feed" }, 400);
  }
  if (!isPublicHttpUrl(feedUrl)) return json({ error: "Invalid feed URL" }, 400);
  const xml = await fetchText(feedUrl);
  return json(parseFeed(xml, feedUrl));
}

async function handleRead(url: string, refresh = false) {
  if (!isPublicHttpUrl(url)) return json({ error: "Invalid article URL" }, 400);

  if (refresh) EXTRACT_MEM.delete(url);
  else {
    const cached = readExtractMem(url);
    if (cached) return cached;
  }

  // ESPN game recaps: prefer the public summary API over brittle HTML scrapes.
  const espnStory =
    (await extractEspnRecapFromUrl(url).catch(() => null)) ||
    (await extractEspnNewsStoryFromUrl(url).catch(() => null));
  if (espnStory) {
    let contentHtml = scrubContentHtml(sanitizeHtml(espnStory.html), espnStory.image);
    const contentText = stripTags(contentHtml);
    const payload = {
      url,
      title: espnStory.title,
      byline: espnStory.byline,
      image: espnStory.image,
      contentHtml,
      contentText,
      wordCount: contentText.split(/\s+/).filter(Boolean).length,
    };
    writeExtractMem(url, payload);
    return json(payload);
  }

  // Baseball Savant Statcast game preview — SPA chrome; rebuild tables from embedded JSON.
  const savantStory = await extractSavantPreviewFromUrl(url).catch(() => null);
  if (savantStory) {
    const contentHtml = scrubContentHtml(sanitizeHtml(savantStory.html), savantStory.image);
    const contentText = stripTags(contentHtml);
    // Never cache / return Savant site nav if the table rebuild somehow failed.
    if (
      /League Batting|Leaderboards|Statcast Search|Metric Documentation/i.test(contentText) &&
      !/<h3>Hitters<\/h3>/i.test(contentHtml)
    ) {
      return json({ error: "Savant preview extract returned navigation chrome", url }, 422);
    }
    const payload = {
      url,
      title: savantStory.title,
      byline: savantStory.byline,
      image: null, // keep reader focused on tables, not the generic Statcast card
      contentHtml,
      contentText,
      wordCount: contentText.split(/\s+/).filter(Boolean).length,
    };
    writeExtractMem(url, payload);
    return json(payload);
  }
  // Do not fall through to generic HTML extract — Savant pages are nav-only SPAs.
  if (isSavantPreviewUrl(url) || isBaseballSavantUrl(url)) {
    return json({ error: "Could not extract Statcast preview tables", url }, 422);
  }

  let rawHtml = "";
  try {
    rawHtml = await fetchText(url);
  } catch (err) {
    // MLB video pages often 403/502 from edge IPs — return a soft watch link instead of 502.
    if (isMlbVideoUrl(url)) {
      const contentHtml = sanitizeHtml(mlbVideoFallbackHtml(url));
      const contentText = stripTags(contentHtml);
      const payload = {
        url,
        title: null,
        byline: "MLB.com",
        image: null,
        contentHtml,
        contentText,
        wordCount: contentText.split(/\s+/).filter(Boolean).length,
      };
      writeExtractMem(url, payload);
      return json(payload);
    }
    throw err;
  }

  const html = unlockEncryptedContent(stripNoise(rawHtml));
  const meta = pageMeta(html);
  let frag = extractFragment(html, url);

  // MLB.com news is often a SPA — try the AMP shell before giving up.
  if (isMlbNewsUrl(url) && (!frag || stripTags(frag).length < 400)) {
    const ampUrls = [
      url.includes("?") ? `${url}&amp=1` : `${url}?amp=1`,
      url.replace(/\/news\//i, "/news/amp/"),
    ];
    for (const ampUrl of ampUrls) {
      try {
        const ampHtml = unlockEncryptedContent(stripNoise(await fetchText(ampUrl)));
        const ampFrag = extractMlbNewsFragment(ampHtml) || extractFragment(ampHtml, url);
        if (ampFrag && stripTags(ampFrag).length > (frag ? stripTags(frag).length : 0)) {
          frag = ampFrag;
          break;
        }
      } catch {
        /* next amp shape */
      }
    }
  }

  // Soft fallback: og:description / meta description when the body is SPA-only.
  if (!frag) {
    const desc =
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      null;
    const mlbVideo = extractMlbVideoFragment(html, url);
    if (mlbVideo) frag = mlbVideo;
    else if (isMlbVideoUrl(url)) frag = mlbVideoFallbackHtml(url, meta.title);
    else if (isBeehiivUrl(url) && desc && stripTags(desc).length > 20) {
      frag =
        `<p>${desc}</p>` +
        `<p><em>Full article may require a Words About Birds subscription.</em></p>` +
        `<p><a href="${url}">Read on Words About Birds</a></p>`;
    } else if (desc && stripTags(desc).length > 40) {
      frag = `<p>${desc}</p><p><a href="${url}">Open original article</a></p>`;
    }
  }

  if (!frag) return json({ error: "Could not extract article text", url }, 422);
  const isTownNews = /stltoday\.com|lee\.net|townnews/i.test(url);
  // TownNews: keep unlocked body intact — chrome/caption scrubbing was wiping columns.
  let contentHtml = isTownNews
    ? sanitizeHtml(frag)
    : scrubContentHtml(sanitizeHtml(stripArticleChrome(frag)), meta.image);
  // Video pages can be short on text but still valid.
  let contentText = stripTags(contentHtml);
  const hasVideo = /<video\b/i.test(contentHtml);
  // Soft fallback when extract shrinks below threshold (common on STL Today paywall HTML).
  const minOk = isTownNews ? 40 : 80;
  if (contentText.length < minOk && !hasVideo && !isMlbVideoUrl(url)) {
    // Retry TownNews with unlock only — no chrome strip.
    if (isTownNews) {
      const retry = extractTownNewsParagraphs(html);
      if (retry && stripTags(retry).length >= 40) {
        contentHtml = sanitizeHtml(retry);
        contentText = stripTags(contentHtml);
      }
    }
  }
  if (contentText.length < minOk && !hasVideo && !isMlbVideoUrl(url)) {
    const desc =
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i)?.[1] ||
      null;
    const firstP =
      html.match(
        /class="[^"]*subscriber-preview[^"]*lee-article-text[^"]*first-p[^"]*"[^>]*>\s*<p[^>]*>([\s\S]*?)<\/p>/i,
      )?.[1] || null;
    const bits = [firstP, desc]
      .filter(Boolean)
      .map((t) => `<p>${String(t).replace(/^—\s*/, "")}</p>`);
    if (bits.length) {
      bits.push(`<p><a href="${url}">Open original article</a></p>`);
      contentHtml = sanitizeHtml(bits.join("\n"));
      contentText = stripTags(contentHtml);
    }
  }
  if (contentText.length < minOk && !hasVideo && !isMlbVideoUrl(url)) {
    return json({ error: "Extracted text too short", url }, 422);
  }
  // Prefer no hero image when the body already embeds a video (Film Room).
  const image = hasVideo ? null : meta.image;
  if (image) contentHtml = dedupeImages(contentHtml, image);
  const payload = {
    url,
    title: meta.title,
    byline: meta.byline,
    image,
    contentHtml,
    contentText,
    wordCount: contentText.split(/\s+/).filter(Boolean).length,
  };
  writeExtractMem(url, payload);
  return json(payload);
}

async function extractEspnNewsStoryFromUrl(url: string): Promise<{
  title: string | null;
  byline: string | null;
  image: string | null;
  html: string;
} | null> {
  const id =
    url.match(/\/(?:story|report)\/_\/id\/(\d+)/i)?.[1] ||
    url.match(/[?&]id=(\d+)/i)?.[1] ||
    null;
  if (!id || !/espn\.com/i.test(url)) return null;
  const res = await fetch(`https://now.core.api.espn.com/v1/sports/news/${id}`, {
    headers: { Accept: "application/json", "User-Agent": UA },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    headlines?: {
      headline?: string;
      description?: string;
      story?: string;
      byline?: string;
      images?: { url?: string }[];
    }[];
  };
  const hl = data.headlines?.[0];
  const story = (hl?.story ?? "").trim();
  if (!story || stripTags(story).length < 80) return null;
  return {
    title: hl?.headline ?? null,
    byline: hl?.byline ?? null,
    image: hl?.images?.[0]?.url ?? null,
    html: story.startsWith("<") ? story : `<p>${story}</p>`,
  };
}

async function extractEspnRecapFromUrl(url: string): Promise<{
  title: string | null;
  byline: string | null;
  image: string | null;
  html: string;
} | null> {
  const isMlb =
    /espn\.com\/mlb\/(?:recap|preview|game)/i.test(url) ||
    /espn\.com\/mlb\/game\?.*gameId=/i.test(url);
  const isSoccer = /espn\.com\/soccer\/(?:match|preview|report|recap)/i.test(url);
  if (!isMlb && !isSoccer) return null;

  const id =
    url.match(/gameId\/(\d+)/i)?.[1] ||
    url.match(/[?&]gameId=(\d+)/i)?.[1] ||
    null;
  if (!id) return null;

  type EspnSummary = {
    header?: {
      competitions?: {
        status?: { type?: { description?: string; detail?: string; state?: string } };
        venue?: { fullName?: string };
        competitors?: {
          homeAway?: string;
          score?: string | number;
          winner?: boolean;
          form?: string;
          records?: { type?: string; summary?: string }[];
          probables?: { athlete?: { displayName?: string; shortName?: string } }[];
          team?: {
            displayName?: string;
            shortDisplayName?: string;
            abbreviation?: string;
            logos?: { href?: string }[];
          };
        }[];
      }[];
    };
    gameInfo?: { venue?: { fullName?: string }; weather?: { temperature?: number; precipitation?: number } };
    seasonseries?: { type?: string; summary?: string }[];
    predictor?: { homeTeam?: { gameProjection?: string }; awayTeam?: { gameProjection?: string } };
    article?: {
      headline?: string;
      description?: string;
      story?: string;
      byline?: string;
      images?: { url?: string }[];
    };
    news?: {
      articles?: {
        headline?: string;
        description?: string;
        story?: string;
        byline?: string;
        images?: { url?: string }[];
      }[];
    };
  };

  async function fetchSummary(leaguePath: string): Promise<EspnSummary | null> {
    const hosts = [
      `https://site.api.espn.com/apis/site/v2/sports/${leaguePath}/summary?event=${id}`,
      `https://site.web.api.espn.com/apis/site/v2/sports/${leaguePath}/summary?event=${id}`,
    ];
    for (const href of hosts) {
      try {
        const res = await fetch(href, {
          headers: { Accept: "application/json", "User-Agent": UA },
        });
        if (!res.ok) continue;
        return (await res.json()) as EspnSummary;
      } catch {
        /* next host */
      }
    }
    return null;
  }

  let sum: EspnSummary | null = null;
  if (isMlb) {
    sum = await fetchSummary("baseball/mlb");
  } else {
    const leagueFromUrl =
      url.match(/\/league\/_\/([^/?#]+)/i)?.[1] ||
      url.match(/[?&]league=([^&#]+)/i)?.[1] ||
      null;
    const leagues = [
      ...(leagueFromUrl ? [`soccer/${leagueFromUrl}`] : []),
      "soccer/eng.1",
      "soccer/eng.2",
    ];
    for (const path of leagues) {
      sum = await fetchSummary(path);
      if (sum?.article?.headline || sum?.news?.articles?.[0]?.headline || sum?.header?.competitions?.[0]) {
        break;
      }
      sum = null;
    }
  }
  if (!sum) return null;

  const espnPromo =
    /fantasy baseball|optimize your fantasy|stay ahead of the game|rolling 10-day outlook|team hitting ratings|pitcher projections/i;
  const isPromo = (a?: { headline?: string; description?: string; story?: string } | null) =>
    espnPromo.test(`${a?.headline ?? ""} ${a?.description ?? ""} ${a?.story ?? ""}`);

  const newsArticle = (sum.news?.articles ?? []).find((a) => a.headline && !isPromo(a));
  const officialOk = Boolean(sum.article?.headline) && !isPromo(sum.article);
  const article = officialOk
    ? sum.article
    : !isMlb && newsArticle?.headline
      ? {
          headline: newsArticle.headline,
          description: newsArticle.description,
          story: newsArticle.story,
          byline: newsArticle.byline,
          images: newsArticle.images,
        }
      : undefined;

  const storyHtml =
    article?.story?.trim() ||
    (article?.description
      ? `<p>${article.description.replace(/^—\s*/, "")}</p>`
      : "");

  const storyText = stripTags(storyHtml);
  const mashedEspnBlob =
    /[a-z][A-Z]/.test(storyText) || // EndPreston
    /[A-Z]{2,}\d-\d-\d/.test(storyText) || // PNE0-0-1
    (/\d\s*PTS\b/i.test(storyText) && !/\.\s/.test(storyText) && storyText.length < 120);

  if (
    storyHtml &&
    storyText.length >= 40 &&
    !mashedEspnBlob &&
    !espnPromo.test(`${article?.headline ?? ""} ${storyText}`)
  ) {
    return {
      title: article?.headline ?? null,
      byline: article?.byline ?? null,
      image: article?.images?.[0]?.url ?? null,
      html: storyHtml,
    };
  }

  // Soccer + thin MLB previews: build a readable match header — never the mashed competitor blob or fantasy promo.
  if (!isSoccer && !isMlb) return null;
  const comp = sum.header?.competitions?.[0];
  const competitors = comp?.competitors ?? [];
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  if (!home?.team && !away?.team) return null;

  const nameOf = (c: (typeof competitors)[number] | undefined) =>
    c?.team?.displayName || c?.team?.shortDisplayName || c?.team?.abbreviation || "TBD";
  const scoreOf = (c: (typeof competitors)[number] | undefined) =>
    c?.score != null && String(c.score).length ? String(c.score) : null;
  const recordOf = (c: (typeof competitors)[number] | undefined) =>
    c?.records?.find((r) => r.type === "total")?.summary ||
    c?.records?.[0]?.summary ||
    null;

  const awayName = nameOf(away);
  const homeName = nameOf(home);
  const awayScore = scoreOf(away);
  const homeScore = scoreOf(home);
  const status =
    comp?.status?.type?.detail ||
    comp?.status?.type?.description ||
    "Scheduled";
  const venue = comp?.venue?.fullName || sum.gameInfo?.venue?.fullName || null;
  const leagueName =
    (sum as { header?: { league?: { name?: string; shortName?: string } } }).header?.league
      ?.shortName ||
    (sum as { header?: { league?: { name?: string } } }).header?.league?.name ||
    (isMlb ? "MLB" : "Soccer");
  const awayPitch = away?.probables?.[0]?.athlete?.displayName || away?.probables?.[0]?.athlete?.shortName;
  const homePitch = home?.probables?.[0]?.athlete?.displayName || home?.probables?.[0]?.athlete?.shortName;
  const series = (sum.seasonseries ?? []).find(
    (s) => s.summary && /current|season/i.test(s.type ?? "") && !/preseason/i.test(s.type ?? ""),
  );
  const awayPct = Number(sum.predictor?.awayTeam?.gameProjection);
  const homePct = Number(sum.predictor?.homeTeam?.gameProjection);
  const title =
    awayScore != null && homeScore != null
      ? `${awayName} ${awayScore}, ${homeName} ${homeScore}`
      : `${awayName} at ${homeName}`;

  const bits: string[] = [];
  bits.push(`<h2>${title}</h2>`);
  bits.push(
    `<p><strong>${leagueName}</strong> · ${status}${venue ? ` · ${venue}` : ""}</p>`,
  );
  bits.push("<ul>");
  bits.push(
    `<li>${awayName}${recordOf(away) ? ` (${recordOf(away)})` : ""}${
      away?.form ? ` · Form ${away.form}` : ""
    }${awayScore != null ? ` — ${awayScore}` : ""}</li>`,
  );
  bits.push(
    `<li>${homeName}${recordOf(home) ? ` (${recordOf(home)})` : ""}${
      home?.form ? ` · Form ${home.form}` : ""
    }${homeScore != null ? ` — ${homeScore}` : ""}</li>`,
  );
  bits.push("</ul>");
  bits.push(
    `<p>${awayName} and ${homeName} meet in ${leagueName}${
      venue ? ` at ${venue}` : ""
    }. ${status}.</p>`,
  );
  if (isMlb && awayPitch && homePitch) {
    bits.push(`<p>${awayPitch} is lined up against ${homePitch}.</p>`);
  }
  if (isMlb && series?.summary) {
    bits.push(`<p>${series.summary.replace(/\.$/, "")}.</p>`);
  }
  if (isMlb && Number.isFinite(awayPct) && Number.isFinite(homePct)) {
    const fav = awayPct >= homePct ? { name: awayName, pct: awayPct } : { name: homeName, pct: homePct };
    bits.push(`<p>ESPN's matchup predictor gives ${fav.name} a ${Math.round(fav.pct)}% chance to win.</p>`);
  }
  const wx = sum.gameInfo?.weather;
  if (isMlb && wx?.temperature != null) {
    const rain =
      wx.precipitation != null && wx.precipitation > 0 ? ` with a ${wx.precipitation}% chance of rain` : "";
    bits.push(`<p>First-pitch forecast: ${wx.temperature}°${rain}.</p>`);
  }
  bits.push(`<p><a href="${url}">Open on ESPN</a></p>`);

  const html = bits.join("\n");
  if (stripTags(html).length < 40) return null;
  return {
    title,
    byline: "ESPN",
    image: home?.team?.logos?.[0]?.href ?? away?.team?.logos?.[0]?.href ?? null,
    html,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: {
    mode?: string;
    feedUrl?: string;
    url?: string;
    refresh?: boolean | string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  try {
    if (body.mode === "warm-wraps") {
      return await handleWarmWraps();
    }
    if (body.mode === "feed") {
      return await handleFeed(body.feedUrl?.trim() || DEFAULT_FEED);
    }
    if (body.mode === "read") {
      if (!body.url?.trim()) return json({ error: "url is required" }, 400);
      const refresh = body.refresh === true || body.refresh === "1" || body.refresh === "true";
      return await handleRead(body.url.trim(), refresh);
    }
    return json({ error: "mode must be 'feed', 'read', or 'warm-wraps'" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 502);
  }
});
