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

const UA = "Mozilla/5.0 (compatible; CommandCenterRSS/1.0)";

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
  "footer",
  "cite",
  "hr",
  "span",
  "video",
  "source",
]);

const TWEET_URL_RE = /(?:twitter\.com|x\.com)\/\w+\/status(?:es)?\/\d+/i;
const TWEET_EMBED_RE = /twitter-tweet|rss-tweet|data-tweet|twt-embed|twitter-video/i;

const PROMO_LINK_RE =
  /(?:get tickets|ticket package|star wars|jersey with|subscribe|newsletter|sign up|fantasy baseball|betmgm|draftkings|fanduel|promo code|bonus bets|specials\/|shop\.mlb|mlb\.com\/tickets|more mlb on heavy|more from heavy|advertisement)/i;

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
  /(?:subscriber-hide|tnt-gift|gift-|share-tools|share-bar|social-share|social-links|follow-this|follow-author|author-card|asset-user|asset-meta|asset-tags|asset-comments|comments-|newsletter|notification|modal-|dropdown-menu|preferred-source|google-preferred|paywall|clipboard|subscribe-promo|inline-relcontent|tnt-inline|trinity|audio-player|related-articles|read-more|promo-|story-cover|caas-readmore|caas-da|bodyad|body-ads|taboola|outbrain|film-room-branding|powered-by)/i;

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
  if (TWEET_EMBED_RE.test(html) || TWEET_URL_RE.test(html)) return null;

  const parts: string[] = [];
  const re =
    /<(p|div|blockquote)([^>]*class="[^"]*(?:subscriber-preview|lee-article-text|article-body|twitter-tweet)[^"]*"[^>]*)>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tag = m[1].toLowerCase();
    const attrs = m[2] || "";
    if (/subscriber-hide|trinity|inline-relcontent/i.test(attrs)) continue;
    const inner = m[3].trim();
    if (stripTags(inner).length < 20) continue;
    if (tag === "blockquote" || TWEET_EMBED_RE.test(attrs)) {
      parts.push("<blockquote>" + inner + "</blockquote>");
    } else {
      parts.push("<p>" + inner + "</p>");
    }
  }
  if (!parts.length) return null;
  const joined = parts.join("\n");
  // STL Today / TownNews often yields thinner first extracts after unlock — still usable.
  const minLen = /stltoday\.com|lee\.net|townnews/i.test(html) ? 80 : 200;
  return stripTags(joined).length > minLen ? joined : null;
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

function extractFragment(html: string, pageUrl = ""): string | null {
  // MLB Film Room / video pages — prefer mp4 autoplay card over chrome soup.
  const mlbVideo = extractMlbVideoFragment(html, pageUrl);
  if (mlbVideo) return mlbVideo;

  const townNews = extractTownNewsParagraphs(html);
  if (townNews) return townNews;

  // TownNews / BLOX + Yahoo + Heavy + SI + ESPN-style bodies.
  const balancedOpeners = [
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
    (html.match(/"(https:\/\/[^"]+\.mp4)"/i)?.[1]
      ? cleanMediaUrl(html.match(/"(https:\/\/[^"]+\.mp4)"/i)![1])
      : null) ||
    (html.match(/content=["'](https:\/\/[^"']+\.mp4)["']/i)?.[1]
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
  /(?:get email notifications|your notification has been saved|problem saving your notification|followed notifications|please log in to use this feature|don't have an account|sign up today|gift this article|new subscriber benefit|copied to clipboard|out of gifts for the month|share this article paywall|prefer us on google|preferred news source|author twitter|author email|follow [\w .|/-]+ post-dispatch|manage followed notifications|facebook|twitter|bluesky|whatsapp|\bsms\b|copy (?:article )?link|copy link|\bprint\b|\{\{[^}]+\}\}|data-(?:html|toggle|placement|trigger)|aria-label="tooltip|tabindex="0"|role="button"|story by|appeared first on|film room powered by|advertisement|more mlb on heavy)/i;

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
    if (/^(?:facebook|twitter|bluesky|whatsapp|sms|email|print|copy link|save|close|log in|story by)$/i.test(text)) {
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
  const seen = new Set<string>();
  if (heroImage) seen.add(normalizeImgKey(heroImage));
  return html.replace(/<img\b([^>]*)>/gi, (full, attrs) => {
    const src = attrValue(String(attrs), "src");
    if (!src) return "";
    const key = normalizeImgKey(src);
    if (seen.has(key)) return "";
    seen.add(key);
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
      if (name === "img") {
        const src = attrValue(attrs, "src");
        if (!src || !/^(https?:|\/)/i.test(src)) return "";
        keep.push('src="' + src.replace(/"/g, "") + '"');
        const alt = attrValue(attrs, "alt");
        if (alt) keep.push('alt="' + alt.replace(/"/g, "&quot;") + '"');
        keep.push('loading="lazy"');
        keep.push('referrerpolicy="no-referrer"');
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

async function fetchText(url: string, attempt = 0): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      ...(isMlbVideoUrl(url) || /mlb\.com/i.test(url)
        ? { Referer: "https://www.mlb.com/" }
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
  team?: { id?: string; abbreviation?: string };
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

async function handleCardinalsWrapsFeed(): Promise<Response> {
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
        };
      } | null;

      const article = summary?.article;
      const matchup = event.shortName || event.name || "Cardinals game";
      if (isFinal) {
        if (!article?.headline) continue;
        const snippet =
          article.description?.trim() ||
          (article.story ? stripTags(article.story).slice(0, 200) : "");
        items.push({
          id: eventId,
          title: article.headline,
          link: espnRecapUrl(eventId),
          author: "ESPN",
          publishedAt: event.date ?? comp.date ?? null,
          image: null,
          snippet,
        });
      } else {
        const headline = article?.headline || `Preview: ${matchup}`;
        const snippet =
          article?.description?.trim() ||
          (article?.story ? stripTags(article.story).slice(0, 200) : "") ||
          `Game preview for ${matchup}.`;
        items.push({
          id: `preview-${eventId}`,
          title: article?.headline ? headline : `Preview: ${matchup}`,
          link: `https://www.espn.com/mlb/preview/_/gameId/${eventId}`,
          author: "ESPN",
          publishedAt: event.date ?? comp.date ?? null,
          image: null,
          snippet,
        });
      }
    }
  }

  items.sort((a, b) => {
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return tb - ta;
  });

  return json({
    title: "Cardinals wraps & previews",
    description: "St. Louis Cardinals game wraps and previews from ESPN",
    link: "https://www.espn.com/mlb/",
    feedUrl: SYNTHETIC_CARDINALS_WRAPS,
    items,
  });
}

async function handleFeed(feedUrl: string) {
  if (feedUrl === SYNTHETIC_CARDINALS_WRAPS) {
    return await handleCardinalsWrapsFeed();
  }
  if (isSyntheticFeedUrl(feedUrl)) {
    return json({ error: "Unknown synthetic feed" }, 400);
  }
  if (!isPublicHttpUrl(feedUrl)) return json({ error: "Invalid feed URL" }, 400);
  const xml = await fetchText(feedUrl);
  return json(parseFeed(xml, feedUrl));
}

async function handleRead(url: string) {
  if (!isPublicHttpUrl(url)) return json({ error: "Invalid article URL" }, 400);

  // ESPN game recaps: prefer the public summary API over brittle HTML scrapes.
  const espnStory = await extractEspnRecapFromUrl(url).catch(() => null);
  if (espnStory) {
    let contentHtml = scrubContentHtml(sanitizeHtml(espnStory.html), espnStory.image);
    const contentText = stripTags(contentHtml);
    return json({
      url,
      title: espnStory.title,
      byline: espnStory.byline,
      image: espnStory.image,
      contentHtml,
      contentText,
      wordCount: contentText.split(/\s+/).filter(Boolean).length,
    });
  }

  let rawHtml = "";
  try {
    rawHtml = await fetchText(url);
  } catch (err) {
    // MLB video pages often 403/502 from edge IPs — return a soft watch link instead of 502.
    if (isMlbVideoUrl(url)) {
      const contentHtml = sanitizeHtml(mlbVideoFallbackHtml(url));
      const contentText = stripTags(contentHtml);
      return json({
        url,
        title: null,
        byline: "MLB.com",
        image: null,
        contentHtml,
        contentText,
        wordCount: contentText.split(/\s+/).filter(Boolean).length,
      });
    }
    throw err;
  }

  const html = unlockEncryptedContent(stripNoise(rawHtml));
  const meta = pageMeta(html);
  let frag = extractFragment(html, url);

  // Soft fallback: og:description / meta description when the body is SPA-only.
  if (!frag) {
    const desc =
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      null;
    const mlbVideo = extractMlbVideoFragment(html, url);
    if (mlbVideo) frag = mlbVideo;
    else if (isMlbVideoUrl(url)) frag = mlbVideoFallbackHtml(url, meta.title);
    else if (desc && stripTags(desc).length > 40) {
      frag = `<p>${desc}</p><p><a href="${url}">Open original article</a></p>`;
    }
  }

  if (!frag) return json({ error: "Could not extract article text", url }, 422);
  let contentHtml = scrubContentHtml(sanitizeHtml(stripArticleChrome(frag)), meta.image);
  // Video pages can be short on text but still valid.
  let contentText = stripTags(contentHtml);
  const hasVideo = /<video\b/i.test(contentHtml);
  // Soft fallback when extract shrinks below threshold (common on STL Today paywall HTML).
  if (contentText.length < 80 && !hasVideo && !isMlbVideoUrl(url)) {
    const desc =
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      null;
    if (desc && stripTags(desc).length > 40) {
      const fallback = `<p>${desc}</p><p><a href="${url}">Open original article</a></p>`;
      contentHtml = scrubContentHtml(sanitizeHtml(fallback), meta.image);
      contentText = stripTags(contentHtml);
    }
  }
  if (contentText.length < 80 && !hasVideo && !isMlbVideoUrl(url)) {
    return json({ error: "Extracted text too short", url }, 422);
  }
  // Prefer no hero image when the body already embeds a video (Film Room).
  const image = hasVideo ? null : meta.image;
  if (image) contentHtml = dedupeImages(contentHtml, image);
  return json({
    url,
    title: meta.title,
    byline: meta.byline,
    image,
    contentHtml,
    contentText,
    wordCount: contentText.split(/\s+/).filter(Boolean).length,
  });
}

async function extractEspnRecapFromUrl(url: string): Promise<{
  title: string | null;
  byline: string | null;
  image: string | null;
  html: string;
} | null> {
  if (!/espn\.com\/mlb\/(?:recap|preview|game)/i.test(url) && !/espn\.com\/mlb\/game\?.*gameId=/i.test(url)) {
    return null;
  }
  const id =
    url.match(/gameId\/(\d+)/i)?.[1] ||
    url.match(/[?&]gameId=(\d+)/i)?.[1] ||
    null;
  if (!id) return null;
  const res = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${id}`,
    { headers: { Accept: "application/json", "User-Agent": UA } },
  );
  if (!res.ok) return null;
  const sum = await res.json() as {
    article?: {
      headline?: string;
      description?: string;
      story?: string;
      byline?: string;
      images?: { url?: string }[];
    };
  };
  const article = sum.article;
  const storyHtml =
    article?.story?.trim() ||
    (article?.description
      ? `<p>${article.description.replace(/^—\s*/, "")}</p>`
      : "");
  if (!storyHtml || stripTags(storyHtml).length < 40) return null;
  return {
    title: article?.headline ?? null,
    byline: article?.byline ?? null,
    image: article?.images?.[0]?.url ?? null,
    html: storyHtml,
  };
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
