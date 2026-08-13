import { supabase, requireUserId } from "./supabase";

/** Configured feeds — Missouri Scout, STL Today Cardinals, Cardinals wire, game wraps. */
export const RSS_FEEDS = [
  {
    id: "moscout",
    title: "Missouri Scout",
    short: "Scout",
    url: "https://rss.app/feeds/nG7WGKJTs5LOQjxd.xml",
  },
  {
    id: "cardinals",
    title: "Cardinals",
    short: "STL Today",
    url: "https://rss.app/feeds/NY6044y6TPBMOdru.xml",
  },
  {
    id: "cardinals-wire",
    title: "Cardinals Wire",
    short: "Wire",
    url: "https://rss.app/feeds/tdKZI96hgDCSMd6o.xml",
  },
  {
    id: "cardinals-wraps",
    title: "Cardinals wraps & previews",
    short: "STL wraps",
    url: "synthetic:cardinals-wraps",
  },
  {
    id: "mlb-wraps",
    title: "MLB wraps & previews",
    short: "MLB wraps",
    url: "synthetic:mlb-wraps",
  },
  {
    id: "mlb-stats",
    title: "MLB stats & standings",
    short: "MLB stats",
    url: "synthetic:mlb-stats",
  },
  {
    id: "cardinals-farm",
    title: "Cardinals farm wraps",
    short: "Farm",
    url: "synthetic:cardinals-farm",
  },
] as const;

export type RssFeedId = (typeof RSS_FEEDS)[number]["id"];

export const DEFAULT_RSS_FEED = RSS_FEEDS[0].url;

export type RssFeedItem = {
  id: string;
  title: string;
  link: string;
  author: string | null;
  publishedAt: string | null;
  image: string | null;
  snippet: string;
  /** Prebuilt reader HTML for synthetic digests (skips edge extract). */
  contentHtml?: string;
};

export type RssFeedItemRef = RssFeedItem & {
  feedId: RssFeedId;
  feedUrl: string;
};

export type RssFeed = {
  title: string;
  description: string;
  link: string;
  feedUrl: string;
  items: RssFeedItem[];
};

/** Canonical key for de-duplicating the same story across feeds. */
export function articleDedupeKey(item: Pick<RssFeedItem, "link" | "title">): string {
  try {
    const u = new URL(item.link);
    u.hash = "";
    // Drop tracking params; keep path identity.
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"].forEach(
      (k) => u.searchParams.delete(k),
    );
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();
    return `url:${host}${path}`;
  } catch {
    return `title:${normalizeTitleKey(item.title)}`;
  }
}

export function normalizeTitleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Prefer official MLB.com writeups when the same story is syndicated elsewhere. */
export function sourcePreferenceScore(link: string): number {
  try {
    const host = new URL(link).hostname.replace(/^www\./, "").toLowerCase();
    if (host === "mlb.com" || host.endsWith(".mlb.com")) return 100;
    if (host.includes("vivaelbirdos") || host.includes("sbnation")) return 70;
    if (host.includes("espn.")) return 55;
    if (host.includes("stltoday")) return 50;
    if (host.includes("fox") || host.includes("yahoo") || host.includes("heavy")) return 25;
    return 40;
  } catch {
    return 0;
  }
}

export function articleSourceHost(link: string): string | null {
  try {
    return new URL(link).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

const DEDUPE_KEEP_KEY = "rss-dedupe-keep-hosts";

/** Hosts the user has white-labeled — never soft-hidden as duplicates. */
export function loadDedupeKeepHosts(): string[] {
  try {
    const raw = localStorage.getItem(DEDUPE_KEEP_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.map((x) => String(x).toLowerCase()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

export function saveDedupeKeepHosts(hosts: string[]): void {
  localStorage.setItem(
    DEDUPE_KEEP_KEY,
    JSON.stringify([...new Set(hosts.map((h) => h.toLowerCase()).filter(Boolean))]),
  );
}

export function addDedupeKeepHost(linkOrHost: string): string[] {
  const host = linkOrHost.includes("://")
    ? articleSourceHost(linkOrHost)
    : linkOrHost.replace(/^www\./, "").toLowerCase();
  if (!host) return loadDedupeKeepHosts();
  const next = [...loadDedupeKeepHosts(), host];
  saveDedupeKeepHosts(next);
  return loadDedupeKeepHosts();
}

export function removeDedupeKeepHost(host: string): string[] {
  const next = loadDedupeKeepHosts().filter((h) => h !== host.toLowerCase());
  saveDedupeKeepHosts(next);
  return next;
}

function isKeepHost(link: string, keepHosts: string[]): boolean {
  const host = articleSourceHost(link);
  if (!host || !keepHosts.length) return false;
  return keepHosts.some((k) => host === k || host.endsWith(`.${k}`));
}

const STOP_TITLE = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "into",
  "over",
  "after",
  "before",
  "against",
  "game",
  "recap",
  "team",
  "series",
  "season",
  "mlb",
  "news",
  "update",
  "report",
  "will",
  "their",
  "this",
  "that",
  "have",
  "been",
  "aug",
  "august",
  "sep",
  "september",
  "oct",
  "october",
]);

const TITLE_ALIASES: Record<string, string[]> = {
  cards: ["cardinals", "cards", "redbirds"],
  cardinals: ["cardinals", "cards", "redbirds"],
  redbirds: ["cardinals", "cards", "redbirds"],
  phils: ["phillies", "phils"],
  phillies: ["phillies", "phils"],
};

/** Soft title match for the same wire story across publishers. */
export function titlesLikelySameStory(a: string, b: string): boolean {
  const expand = (title: string) => {
    const out = new Set<string>();
    for (const w of normalizeTitleKey(title).split(" ")) {
      if (w.length <= 2 || STOP_TITLE.has(w)) continue;
      if (/^\d+$/.test(w)) continue;
      out.add(w);
      for (const alias of TITLE_ALIASES[w] ?? []) out.add(alias);
    }
    return out;
  };
  const setA = expand(a);
  const setB = expand(b);
  if (setA.size < 4 || setB.size < 4) return false;
  let inter = 0;
  for (const w of setA) if (setB.has(w)) inter++;
  const union = setA.size + setB.size - inter;
  if (union <= 0) return false;
  const jaccard = inter / union;
  const coverage = inter / Math.min(setA.size, setB.size);
  // Box-score / game-recap headlines need stronger overlap so ESPN
  // "Cards 2-0 Phillies Game Recap" doesn't eat a feature writeup.
  const recapish = /game recap|box score|final score|\b\d+\s*[-–]\s*\d+\b/i.test(`${a} ${b}`);
  if (recapish) return jaccard >= 0.55 && inter >= 5;
  return (jaccard >= 0.45 && inter >= 4) || coverage >= 0.7;
}

export type DedupePartition<T> = {
  kept: T[];
  /** Stories hidden from the main/unread feeds because a preferred copy won. */
  duplicates: T[];
};

/**
 * Keep first occurrence when the same article appears in multiple feeds.
 * Prefer mlb.com when titles collide. Soft-dedupe near-identical headlines.
 * `keepHosts` are white-labeled sources that always stay in the main feed.
 */
export function partitionDedupedArticles<T extends Pick<RssFeedItem, "link" | "title">>(
  items: T[],
  keepHosts: string[] = [],
): DedupePartition<T> {
  const ranked = [...items].sort(
    (a, b) => sourcePreferenceScore(b.link) - sourcePreferenceScore(a.link),
  );
  const seenUrl = new Set<string>();
  const kept: T[] = [];
  const duplicates: T[] = [];

  for (const item of ranked) {
    const urlKey = articleDedupeKey(item);
    const titleKey = normalizeTitleKey(item.title);
    if (seenUrl.has(urlKey)) {
      duplicates.push(item);
      continue;
    }
    const softHit = kept.find((k) => {
      const kt = normalizeTitleKey(k.title);
      if (titleKey.length >= 24 && kt === titleKey) return true;
      return titlesLikelySameStory(k.title, item.title);
    });
    if (softHit) {
      if (isKeepHost(item.link, keepHosts)) {
        seenUrl.add(urlKey);
        kept.push(item);
        continue;
      }
      duplicates.push(item);
      continue;
    }
    seenUrl.add(urlKey);
    kept.push(item);
  }

  const order = new Map(items.map((it, i) => [it.link, i]));
  kept.sort((a, b) => (order.get(a.link) ?? 0) - (order.get(b.link) ?? 0));
  duplicates.sort((a, b) => (order.get(a.link) ?? 0) - (order.get(b.link) ?? 0));
  return { kept, duplicates };
}

/** Keep first occurrence when the same article appears in multiple feeds. */
export function dedupeArticles<T extends Pick<RssFeedItem, "link" | "title">>(
  items: T[],
  keepHosts: string[] = [],
): T[] {
  return partitionDedupedArticles(items, keepHosts).kept;
}

export type RssFilterKind = "phrase" | "url" | "content";

export type RssFilter = {
  id: string;
  kind: RssFilterKind;
  value: string;
  createdAt: string;
};

/**
 * Always scrubbed from article bodies (MLB newsletter / signup chrome).
 * Matched case-insensitively against element text.
 */
export const DEFAULT_CONTENT_HIDES = [
  "get the latest from mlb",
  "get the latest from mlb sign up",
  "morning lineup",
] as const;

/** Collect user content-hide phrases plus built-in MLB clutter patterns. */
export function contentHidePhrases(filters: RssFilter[]): string[] {
  const out = new Set<string>();
  for (const p of DEFAULT_CONTENT_HIDES) out.add(p.toLowerCase());
  for (const f of filters) {
    if (f.kind !== "content") continue;
    const v = f.value.trim().toLowerCase();
    if (v.length >= 3) out.add(v);
  }
  return [...out].sort((a, b) => b.length - a.length);
}

const BLOCK_TAGS = new Set([
  "P",
  "DIV",
  "FIGURE",
  "SECTION",
  "ASIDE",
  "BLOCKQUOTE",
  "LI",
  "ARTICLE",
  "HEADER",
  "FOOTER",
  "TABLE",
]);

/**
 * Remove in-article clutter blocks whose text matches hide phrases.
 * Prefer removing the nearest block ancestor so signup chrome collapses
 * (no empty reserved space).
 */
export function hidePhrasesInHtml(html: string, phrases: string[]): string {
  if (!html || !phrases.length || typeof DOMParser === "undefined") return html;
  const needles = [...new Set(phrases.map((p) => p.trim().toLowerCase()).filter((p) => p.length >= 3))];
  if (!needles.length) return html;

  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, "text/html");
  const root = doc.getElementById("root");
  if (!root) return html;

  const matchesPhrase = (text: string) => {
    const t = text.replace(/\s+/g, " ").trim().toLowerCase();
    if (!t) return false;
    return needles.some((n) => t.includes(n));
  };

  const toRemove = new Set<Element>();
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const value = node.nodeValue ?? "";
    if (matchesPhrase(value)) {
      let el: Element | null = node.parentElement;
      let block: Element | null = null;
      while (el && el !== root) {
        if (BLOCK_TAGS.has(el.tagName)) {
          block = el;
          // Prefer a compact promo container: if a parent block is still mostly
          // the same promo (short), keep walking up a bit.
          const parentEl: Element | null = el.parentElement;
          if (
            parentEl &&
            parentEl !== root &&
            BLOCK_TAGS.has(parentEl.tagName) &&
            matchesPhrase(parentEl.textContent ?? "") &&
            (parentEl.textContent ?? "").replace(/\s+/g, " ").trim().length < 220
          ) {
            el = parentEl;
            continue;
          }
          break;
        }
        el = el.parentElement;
      }
      if (block) toRemove.add(block);
    }
    node = walker.nextNode();
  }

  for (const el of toRemove) {
    // Also drop a following empty sibling spacer if present.
    const next = el.nextElementSibling;
    el.remove();
    if (
      next &&
      !next.textContent?.replace(/\s+/g, "").trim() &&
      !next.querySelector("img,video,iframe,table")
    ) {
      next.remove();
    }
  }

  // Collapse leftover empty paragraphs/divs created by cleanup.
  root.querySelectorAll("p,div").forEach((el) => {
    if (
      !el.textContent?.replace(/\s+/g, "").trim() &&
      !el.querySelector("img,video,iframe,table,br")
    ) {
      el.remove();
    }
  });

  return root.innerHTML;
}

/**
 * STL Today’s Cardinals rss.app feed also carries MLS / City SC stories.
 * Detect clear soccer bleed so we don’t need a blunt “city” phrase ban.
 */
export function isSoccerBleedArticle(
  item: Pick<RssFeedItem, "link" | "title" | "snippet">,
): boolean {
  const title = item.title.toLowerCase();
  const snippet = (item.snippet ?? "").toLowerCase();
  const link = item.link.toLowerCase();
  const hay = `${title} ${snippet}`;

  // Section URLs from stltoday (and similar) are definitive.
  if (
    /\/sports\/professional\/mls\b/.test(link) ||
    /\/mls\/city-sc\b/.test(link) ||
    /\/soccer\//.test(link) ||
    /[?&]section=soccer\b/.test(link)
  ) {
    return true;
  }

  // Strong title/snippet signals — "City SC", not bare "city".
  const strong = [
    "city sc",
    "st. louis city sc",
    "st louis city sc",
    "stl city sc",
    "marcel hartel",
  ];
  if (strong.some((p) => hay.includes(p))) return true;

  // MLS + soccer club context together.
  if (/\bmls\b/.test(hay) && /\b(soccer|midfielder|football club|hannover)\b/.test(hay)) {
    return true;
  }

  return false;
}

/**
 * MLB Film Room / clip pages (`/video/…`), not written mlb.com news.
 * Cardinals Wire syndicates these heavily; we hide them only in that feed.
 */
export function isMlbFilmRoomArticle(item: Pick<RssFeedItem, "link" | "title">): boolean {
  try {
    const u = new URL(item.link);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "mlb.com" && !host.endsWith(".mlb.com")) return false;
    // /video/slug or /cardinals/video/slug — not /news/…
    return /(?:^|\/)video(?:\/|$)/i.test(u.pathname);
  } catch {
    return /mlb\.com\/(?:[a-z-]+\/)?video\//i.test(item.link);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Decode common HTML entities so saved quotes can match article markup. */
export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#0*39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&rsquo;/gi, "\u2019")
    .replace(/&lsquo;/gi, "\u2018")
    .replace(/&rdquo;/gi, "\u201D")
    .replace(/&ldquo;/gi, "\u201C")
    .replace(/&mdash;/gi, "\u2014")
    .replace(/&ndash;/gi, "\u2013")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => {
      try {
        return String.fromCodePoint(parseInt(h, 16));
      } catch {
        return "";
      }
    })
    .replace(/&#(\d+);/g, (_, n: string) => {
      try {
        return String.fromCodePoint(Number(n));
      } catch {
        return "";
      }
    });
}

/** Collapse whitespace the same way selection capture does. */
export function normalizeHighlightQuote(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Build a regex that matches a saved quote across ordinary HTML whitespace. */
function quoteMatchPattern(quote: string): RegExp | null {
  const normalized = normalizeHighlightQuote(quote);
  if (normalized.length < 2) return null;
  const parts = normalized
    .split(" ")
    .map((word) =>
      escapeRegExp(word)
        // Treat curly / straight quotes as equivalent in the article body.
        .replace(/'/g, "['\u2018\u2019]")
        .replace(/"/g, '["\u201C\u201D]'),
    )
    .filter(Boolean);
  if (!parts.length) return null;
  return new RegExp(parts.join("\\s+"), "gi");
}

/**
 * Wrap saved highlight quotes in `<mark class="rss-hl">` inside article HTML.
 * Matches across tags (e.g. player links) by searching decoded plain text and
 * projecting ranges back onto the original markup.
 */
export function markQuotesInHtml(html: string, quotes: string[]): string {
  const needles = [...new Set(quotes.map(normalizeHighlightQuote).filter((q) => q.length >= 2))].sort(
    (a, b) => b.length - a.length,
  );
  if (!html || !needles.length) return html;

  type Piece = { kind: "tag" | "text"; raw: string };
  const pieces: Piece[] = html.split(/(<[^>]+>)/g).filter(Boolean).map((raw) => ({
    kind: raw.startsWith("<") ? "tag" : "text",
    // Decode text nodes up front so plain offsets stay 1:1 with piece contents.
    raw: raw.startsWith("<") ? raw : decodeHtmlEntities(raw),
  }));

  type MapEntry = { pieceIndex: number; start: number; end: number };
  const map: MapEntry[] = [];
  let plain = "";
  pieces.forEach((piece, pieceIndex) => {
    if (piece.kind !== "text") return;
    const start = plain.length;
    plain += piece.raw;
    map.push({ pieceIndex, start, end: plain.length });
  });
  if (!plain) return html;

  type Range = { start: number; end: number };
  const ranges: Range[] = [];
  for (const needle of needles) {
    const re = quoteMatchPattern(needle);
    if (!re) continue;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(plain)) != null) {
      const start = m.index;
      const end = start + m[0].length;
      if (!ranges.some((r) => start < r.end && end > r.start)) ranges.push({ start, end });
      if (m[0].length === 0) re.lastIndex += 1;
    }
  }
  if (!ranges.length) return html;

  // Wrap each text piece independently so marks never straddle real tags
  // (`<a>…</a>`). Adjacent marks still read as one highlight visually.
  for (const entry of map) {
    const piece = pieces[entry.pieceIndex]!;
    const local = piece.raw;
    const locals = ranges
      .map((r) => ({
        start: Math.max(0, r.start - entry.start),
        end: Math.min(local.length, r.end - entry.start),
      }))
      .filter((r) => r.end > r.start)
      .sort((a, b) => b.start - a.start);
    if (!locals.length) continue;
    let out = local;
    for (const r of locals) {
      out =
        out.slice(0, r.start) +
        `<mark class="rss-hl">${out.slice(r.start, r.end)}</mark>` +
        out.slice(r.end);
    }
    piece.raw = out;
  }

  return pieces.map((p) => p.raw).join("");
}

/** Remove previously painted highlight marks (DOM path). */
export function clearRssHighlights(root: Element | null | undefined): void {
  if (!root) return;
  root.querySelectorAll("mark.rss-hl").forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  });
}

/**
 * Paint a saved quote into a live DOM tree (handles player links / nested tags).
 * Returns true when at least one range was wrapped.
 */
export function paintQuoteInElement(root: Element, quote: string): boolean {
  if (typeof document === "undefined") return false;
  const needle = normalizeHighlightQuote(quote);
  const re = quoteMatchPattern(needle);
  if (!re) return false;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = (node as Text).parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest("mark.rss-hl, script, style")) return NodeFilter.FILTER_REJECT;
      if (!(node.nodeValue ?? "").trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) nodes.push(current as Text);
  if (!nodes.length) return false;

  type MapEntry = { node: Text; start: number; end: number };
  const map: MapEntry[] = [];
  let hay = "";
  for (const node of nodes) {
    const start = hay.length;
    hay += node.nodeValue ?? "";
    map.push({ node, start, end: hay.length });
  }

  re.lastIndex = 0;
  const match = re.exec(hay);
  if (!match) return false;
  const matchStart = match.index;
  const matchEnd = matchStart + match[0].length;

  // Wrap from the end so earlier offsets stay valid.
  for (let i = map.length - 1; i >= 0; i--) {
    const entry = map[i]!;
    if (entry.end <= matchStart || entry.start >= matchEnd) continue;
    const localStart = Math.max(0, matchStart - entry.start);
    const localEnd = Math.min(entry.node.nodeValue?.length ?? 0, matchEnd - entry.start);
    if (localEnd <= localStart) continue;

    const text = entry.node.nodeValue ?? "";
    const before = text.slice(0, localStart);
    const mid = text.slice(localStart, localEnd);
    const after = text.slice(localEnd);
    const mark = document.createElement("mark");
    mark.className = "rss-hl";
    mark.textContent = mid;

    const parent = entry.node.parentNode;
    if (!parent) continue;
    const frag = document.createDocumentFragment();
    if (before) frag.appendChild(document.createTextNode(before));
    frag.appendChild(mark);
    if (after) frag.appendChild(document.createTextNode(after));
    parent.replaceChild(frag, entry.node);
  }
  return true;
}

/** Clear + paint all quotes into a reader root. */
export function paintQuotesInElement(root: Element | null | undefined, quotes: string[]): void {
  if (!root) return;
  clearRssHighlights(root);
  const unique = [...new Set(quotes.map(normalizeHighlightQuote).filter((q) => q.length >= 2))].sort(
    (a, b) => b.length - a.length,
  );
  for (const q of unique) paintQuoteInElement(root, q);
}

/** Split plain text into highlighted / plain segments for React title rendering. */
export function splitTextByQuotes(
  text: string,
  quotes: string[],
): { text: string; highlighted: boolean }[] {
  const patterns = [...new Set(quotes.map(normalizeHighlightQuote).filter((q) => q.length >= 2))]
    .sort((a, b) => b.length - a.length)
    .map(quoteMatchPattern)
    .filter((re): re is RegExp => Boolean(re));
  if (!text || !patterns.length) return [{ text, highlighted: false }];

  type Hit = { start: number; end: number };
  const hits: Hit[] = [];
  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) != null) {
      const start = m.index;
      const end = start + m[0].length;
      if (!hits.some((h) => start < h.end && end > h.start)) {
        hits.push({ start, end });
      }
      if (m[0].length === 0) re.lastIndex += 1;
    }
  }
  hits.sort((a, b) => a.start - b.start);
  if (!hits.length) return [{ text, highlighted: false }];

  const parts: { text: string; highlighted: boolean }[] = [];
  let cursor = 0;
  for (const hit of hits) {
    if (hit.start > cursor) {
      parts.push({ text: text.slice(cursor, hit.start), highlighted: false });
    }
    parts.push({ text: text.slice(hit.start, hit.end), highlighted: true });
    cursor = hit.end;
  }
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), highlighted: false });
  }
  return parts;
}

/** Prefer a sectional path over the whole host when blacklisting from a row. */
export function suggestUrlFilterValue(articleUrl: string): string {
  try {
    const u = new URL(articleUrl);
    const path = u.pathname.toLowerCase();
    // STL Today MLS / City SC section
    const mls = path.match(/(\/sports\/professional\/mls(?:\/city-sc)?)/);
    if (mls) return mls[1].replace(/^\/+|\/+$/g, "");
    const soccer = path.match(/(\/soccer(?:\/[a-z0-9-]+)?)/);
    if (soccer) return soccer[1].replace(/^\/+|\/+$/g, "");
    // Fall back to host so Ban still does something useful.
    return u.hostname.replace(/^www\./, "");
  } catch {
    return articleUrl;
  }
}

/** Encode a domain/path block scoped to one feed: `feed:cardinals|stltoday.com`. */
export function encodeFeedDomainFilter(feedId: string, domainOrPath: string): string {
  const cleaned = domainOrPath.replace(/^www\./i, "").replace(/^\/+|\/+$/g, "").toLowerCase();
  return `feed:${feedId}|${cleaned}`;
}

export function parseFeedScopedFilter(value: string): {
  feedId: string | null;
  pattern: string;
} {
  const m = value.trim().match(/^feed:([a-z0-9-]+)\|(.+)$/i);
  if (m) return { feedId: m[1].toLowerCase(), pattern: m[2].trim().toLowerCase() };
  return { feedId: null, pattern: value.trim().toLowerCase() };
}

export function articleMatchesFilters(
  item: Pick<RssFeedItem, "link" | "title" | "snippet"> & { feedId?: string },
  filters: RssFilter[],
  feedId?: string,
): boolean {
  if (isSoccerBleedArticle(item)) return true;
  const effectiveFeed = (feedId ?? item.feedId)?.toLowerCase() ?? null;
  // Wire-only: drop MLB Film Room clips; keep mlb.com/news and other hosts.
  if (effectiveFeed === "cardinals-wire" && isMlbFilmRoomArticle(item)) return true;
  if (!filters.length) return false;
  const hayTitle = item.title.toLowerCase();
  const haySnippet = (item.snippet ?? "").toLowerCase();
  const hayLink = item.link.toLowerCase();
  for (const f of filters) {
    const { feedId: scoped, pattern } = parseFeedScopedFilter(f.value);
    if (!pattern) continue;
    // Feed-scoped rules only apply inside that feed (or unread rows from it).
    if (scoped && scoped !== effectiveFeed) continue;
    if (f.kind === "phrase") {
      if (hayTitle.includes(pattern) || haySnippet.includes(pattern)) return true;
    } else if (f.kind === "url") {
      if (hayLink.includes(pattern)) return true;
    }
  }
  return false;
}

export function applyRssFilters<
  T extends Pick<RssFeedItem, "link" | "title" | "snippet"> & { feedId?: string },
>(items: T[], filters: RssFilter[], feedId?: string): T[] {
  return items.filter((item) => !articleMatchesFilters(item, filters, feedId ?? item.feedId));
}

export async function fetchRssFilters(): Promise<RssFilter[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("rss_filters")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    kind: r.kind as RssFilterKind,
    value: r.value,
    createdAt: r.created_at,
  }));
}

export async function addRssFilter(kind: RssFilterKind, value: string): Promise<RssFilter> {
  const userId = await requireUserId();
  const cleaned = value.trim();
  if (!cleaned) throw new Error("Filter value is empty");
  const { data, error } = await supabase
    .from("rss_filters")
    .upsert(
      {
        user_id: userId,
        kind,
        value: cleaned,
      },
      { onConflict: "user_id,kind,value" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    kind: data.kind as RssFilterKind,
    value: data.value,
    createdAt: data.created_at,
  };
}

export async function deleteRssFilter(id: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("rss_filters")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
}

export type RssArticle = {
  url: string;
  title: string | null;
  byline: string | null;
  image: string | null;
  contentHtml: string;
  contentText: string;
  wordCount: number;
};

export type RssHighlight = {
  id: string;
  articleUrl: string;
  articleTitle: string | null;
  feedUrl: string | null;
  articleImage: string | null;
  quoteText: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

/** Human source label for a highlight/feed URL. */
export function feedSourceLabel(feedUrl: string | null | undefined): string {
  if (!feedUrl) return "Dispatch";
  const hit = RSS_FEEDS.find((f) => f.url === feedUrl);
  if (hit) return hit.title;
  try {
    const host = new URL(feedUrl).hostname.replace(/^www\./, "");
    if (/stltoday/i.test(host)) return "STL Today";
    if (/espn\.com/i.test(host)) return "ESPN";
    if (/mlb\.com/i.test(host)) return "MLB.com";
    return host;
  } catch {
    return "Dispatch";
  }
}

/** Fix lazy/relative secondary images in reader HTML. */
export function repairRssContentImages(html: string, pageUrl?: string | null): string {
  if (!html || typeof DOMParser === "undefined") return html;
  let base: URL | null = null;
  try {
    if (pageUrl) base = new URL(pageUrl);
  } catch {
    base = null;
  }
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, "text/html");
  const root = doc.getElementById("root");
  if (!root) return html;

  root.querySelectorAll("img").forEach((img) => {
    const attrs = img as HTMLImageElement;
    const candidates = [
      attrs.getAttribute("src"),
      attrs.getAttribute("data-src"),
      attrs.getAttribute("data-lazy-src"),
      attrs.getAttribute("data-original"),
      attrs.getAttribute("data-url"),
    ].filter(Boolean) as string[];
    const srcset = attrs.getAttribute("srcset") || attrs.getAttribute("data-srcset");
    if (srcset) {
      const first = srcset.split(",")[0]?.trim().split(/\s+/)[0];
      if (first) candidates.push(first);
    }
    let src = candidates.find((c) => c && !/^data:image\/svg/i.test(c)) ?? "";
    if (src && src.startsWith("//")) src = `https:${src}`;
    if (src && src.startsWith("/") && base) {
      try {
        src = new URL(src, base).toString();
      } catch {
        /* keep */
      }
    }
    if (src && /^https?:/i.test(src)) {
      attrs.setAttribute("src", src);
      attrs.removeAttribute("srcset");
      attrs.loading = "lazy";
      // Some CDNs block no-referrer; prefer origin when loading inline.
      attrs.referrerPolicy = "no-referrer-when-downgrade";
    }
  });

  return root.innerHTML;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function readFunctionsErrorDetail(error: {
  message: string;
  context?: Response;
}): Promise<{ status: number | null; detail: string }> {
  const status =
    error.context && typeof error.context.status === "number" ? error.context.status : null;
  let detail = error.message;
  if (error.context) {
    try {
      const body = (await error.context.clone().json()) as { error?: string };
      if (body?.error) detail = String(body.error);
    } catch {
      // keep generic message
    }
  }
  return { status, detail };
}

async function invokeRss<T>(body: Record<string, string>): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase.functions.invoke("rss", { body });
    if (!error) {
      if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
        throw new Error(String((data as { error: string }).error));
      }
      return data as T;
    }
    const { status, detail } = await readFunctionsErrorDetail(error);
    lastError = new Error(detail);
    // Retry transient gateway / rate-limit failures; skip hard extract failures (422).
    const retryable =
      status === 429 ||
      status === 502 ||
      status === 503 ||
      (status == null && /non-2xx|rate.?limit|timeout/i.test(error.message));
    if (!retryable || attempt === 2) break;
    await sleep(450 * 2 ** attempt);
  }
  throw lastError ?? new Error("RSS request failed");
}

export function fetchRssFeed(feedUrl: string = DEFAULT_RSS_FEED): Promise<RssFeed> {
  if (feedUrl === "synthetic:cardinals-wraps") {
    return fetchEspnWrapsFeed({
      feedUrl,
      title: "Cardinals wraps & previews",
      description: "St. Louis Cardinals game wraps and previews from ESPN",
      teamFilter: { espnId: "24", abbrev: "STL" },
      days: 14,
      maxItems: 40,
    });
  }
  if (feedUrl === "synthetic:mlb-wraps") {
    return fetchEspnWrapsFeed({
      feedUrl,
      title: "MLB wraps & previews",
      description: "League-wide MLB game wraps and previews from ESPN",
      days: 3,
      maxItems: 48,
      // League volume is high — prefer finals + today's previews.
      preferFinals: true,
    });
  }
  if (feedUrl === "synthetic:mlb-stats") {
    return fetchMlbStatsDigestFeed();
  }
  if (feedUrl === "synthetic:cardinals-farm") {
    return fetchCardinalsFarmWrapsFeed();
  }
  return invokeRss<RssFeed>({ mode: "feed", feedUrl });
}

type EspnWrapsOpts = {
  feedUrl: string;
  title: string;
  description: string;
  teamFilter?: { espnId: string; abbrev: string };
  days?: number;
  maxItems?: number;
  preferFinals?: boolean;
};

/** Client-side ESPN game wrap + preview feed (reachable from the browser). */
async function fetchEspnWrapsFeed(opts: EspnWrapsOpts): Promise<RssFeed> {
  const days = opts.days ?? 7;
  const maxItems = opts.maxItems ?? 40;
  const items: RssFeedItem[] = [];
  const seen = new Set<string>();
  const today = new Date();
  const candidates: {
    eventId: string;
    dateStr: string;
    y: number;
    m: string;
    day: string;
    event: {
      id?: string;
      date?: string;
      shortName?: string;
      competitions?: {
        id?: string;
        status?: { type?: { state?: string; completed?: boolean; name?: string } };
        competitors?: {
          homeAway?: string;
          team?: { id?: string; abbreviation?: string };
          score?: string;
        }[];
      }[];
      status?: { type?: { state?: string; completed?: boolean; name?: string } };
    };
    isFinal: boolean;
    isPreview: boolean;
  }[] = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const dateStr = `${y}${m}${day}`;
    try {
      const boardRes = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${dateStr}`,
        { headers: { Accept: "application/json" } },
      );
      if (!boardRes.ok) continue;
      const board = (await boardRes.json()) as {
        events?: (typeof candidates)[number]["event"][];
      };

      for (const event of board.events ?? []) {
        const comp = event.competitions?.[0];
        if (!comp) continue;
        if (opts.teamFilter) {
          const hit = (comp.competitors ?? []).some(
            (c) =>
              c.team?.abbreviation === opts.teamFilter!.abbrev ||
              c.team?.id === opts.teamFilter!.espnId,
          );
          if (!hit) continue;
        }
        const status = comp.status?.type ?? event.status?.type;
        const isFinal = status?.state === "post" || status?.completed === true;
        const isPreview =
          status?.state === "pre" ||
          /STATUS_SCHEDULED|STATUS_PRE/i.test(status?.name ?? "");
        if (!isFinal && !isPreview) continue;
        // League feed: skip future previews except for today.
        if (opts.preferFinals && isPreview && i > 0) continue;
        const eventId = event.id ?? comp.id;
        if (!eventId || seen.has(eventId)) continue;
        seen.add(eventId);
        candidates.push({ eventId, dateStr, y, m, day, event, isFinal, isPreview });
      }
    } catch {
      /* skip day */
    }
  }

  // Newest first; cap before summary fetches.
  candidates.sort((a, b) => {
    const da = a.event.date ? Date.parse(a.event.date) : 0;
    const db = b.event.date ? Date.parse(b.event.date) : 0;
    return db - da;
  });
  const limited = candidates.slice(0, maxItems);

  // Fetch summaries with modest concurrency.
  const concurrency = 4;
  for (let i = 0; i < limited.length; i += concurrency) {
    const chunk = limited.slice(i, i + concurrency);
    const settled = await Promise.all(
      chunk.map(async (c) => {
        try {
          const sumRes = await fetch(
            `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${c.eventId}`,
            { headers: { Accept: "application/json" } },
          );
          if (!sumRes.ok) return null;
          const sum = (await sumRes.json()) as {
            article?: {
              headline?: string;
              description?: string;
              story?: string;
              images?: { url?: string }[];
            };
          };
          const article = sum.article;
          const comp = c.event.competitions?.[0];
          const home = (comp?.competitors ?? []).find((x) => x.homeAway === "home");
          const away = (comp?.competitors ?? []).find((x) => x.homeAway === "away");
          const matchup =
            c.event.shortName ||
            `${away?.team?.abbreviation ?? "AWAY"} @ ${home?.team?.abbreviation ?? "HOME"}`;
          const publishedAt = c.event.date || `${c.y}-${c.m}-${c.day}T17:00:00Z`;

          if (c.isFinal) {
            if (!article?.headline) return null;
            const storyText = (article.story ?? "")
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim();
            const snippet =
              (article.description ?? "").replace(/^—\s*/, "").trim() ||
              storyText.slice(0, 220);
            return {
              id: `wrap-${c.eventId}`,
              title: article.headline,
              link: `https://www.espn.com/mlb/recap/_/gameId/${c.eventId}`,
              author: "ESPN",
              publishedAt,
              image: article.images?.[0]?.url ?? null,
              snippet,
            } satisfies RssFeedItem;
          }

          // Hold hollow previews ("No Story Available" / placeholder blurbs) until ESPN
          // publishes real preview copy.
          const headline = article?.headline?.trim() ?? "";
          const storyText = (article?.story ?? "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          const description = (article?.description ?? "").replace(/^—\s*/, "").trim();
          const body = description || storyText;
          const hollow =
            !headline ||
            !body ||
            body.length < 40 ||
            /no story available/i.test(`${headline} ${body}`) ||
            /^game preview for\b/i.test(body);
          if (hollow) return null;

          return {
            id: `preview-${c.eventId}`,
            title: headline,
            link: `https://www.espn.com/mlb/preview/_/gameId/${c.eventId}`,
            author: "ESPN",
            publishedAt,
            image: article?.images?.[0]?.url ?? null,
            snippet: body.slice(0, 220),
          } satisfies RssFeedItem;
        } catch {
          return null;
        }
      }),
    );
    for (const item of settled) {
      if (item) items.push(item);
    }
  }

  items.sort((a, b) => {
    const da = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const db = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return db - da;
  });

  return {
    title: opts.title,
    description: opts.description,
    link: "https://www.espn.com/mlb/",
    feedUrl: opts.feedUrl,
    items,
  };
}

/** Once-per-day standings + wild card + league leaders digest. */
async function fetchMlbStatsDigestFeed(): Promise<RssFeed> {
  const { fetchMlbStandings, fetchMlbWildCardStandings, fetchMlbLeaders } = await import("./mlb");
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const dateKey = `${y}-${m}-${d}`;
  const publishedAt = `${dateKey}T12:00:00-05:00`;

  const [standings, nlWc, alWc, leaders] = await Promise.all([
    fetchMlbStandings(),
    fetchMlbWildCardStandings(104),
    fetchMlbWildCardStandings(103),
    fetchMlbLeaders(8),
  ]);

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const divisionHtml = standings
    .map((div) => {
      const rows = div.rows
        .map(
          (r) =>
            `<tr><td>${esc(r.rank)}. ${esc(r.team)}</td><td>${r.wins}-${r.losses}</td><td>${esc(r.pct)}</td><td>${esc(r.gb)}</td><td>${esc(r.playoffPercent ?? "—")}</td></tr>`,
        )
        .join("");
      return `<h2>${esc(div.name)}</h2><table><thead><tr><th>Team</th><th>W-L</th><th>Pct</th><th>GB</th><th>Playoff%</th></tr></thead><tbody>${rows}</tbody></table>`;
    })
    .join("");

  const wcBlock = (title: string, rows: Awaited<ReturnType<typeof fetchMlbWildCardStandings>>) => {
    const body = rows
      .slice(0, 10)
      .map(
        (r) =>
          `<tr><td>${esc(r.rank)}. ${esc(r.team)}</td><td>${r.wins}-${r.losses}</td><td>${esc(r.wcgb)}</td></tr>`,
      )
      .join("");
    return `<h2>${esc(title)}</h2><table><thead><tr><th>Team</th><th>W-L</th><th>WCGB</th></tr></thead><tbody>${body}</tbody></table>`;
  };

  const leadersHtml = leaders
    .map((board) => {
      const rows = board.leaders
        .map(
          (l) =>
            `<tr><td>${l.rank}. ${esc(l.name)}</td><td>${esc(l.team)}</td><td>${esc(l.value)}</td></tr>`,
        )
        .join("");
      return `<h3>${esc(board.label)}</h3><table><thead><tr><th>Player</th><th>Team</th><th>Stat</th></tr></thead><tbody>${rows}</tbody></table>`;
    })
    .join("");

  const contentHtml = `
    <p>Daily MLB board — division standings, wild cards, and league leaders for ${esc(dateKey)}.</p>
    <h2>Division standings</h2>
    ${divisionHtml}
    ${wcBlock("NL Wild Card", nlWc)}
    ${wcBlock("AL Wild Card", alWc)}
    <h2>League leaders</h2>
    ${leadersHtml}
  `.trim();

  const snippet = `Division standings, NL/AL wild card, and league leaders for ${dateKey}.`;

  // Keep a short rolling history (today + prior 6 days) so the feed isn't a single row forever.
  const items: RssFeedItem[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const yy = day.getFullYear();
    const mm = String(day.getMonth() + 1).padStart(2, "0");
    const dd = String(day.getDate()).padStart(2, "0");
    const key = `${yy}-${mm}-${dd}`;
    const isToday = i === 0;
    items.push({
      id: `mlb-stats-${key}`,
      title: isToday
        ? `MLB stats digest — ${key}`
        : `MLB stats digest — ${key} (archive)`,
      link: `dispatch://mlb-stats/${key}`,
      author: "MLB Stats API",
      publishedAt: `${key}T12:00:00-05:00`,
      image: null,
      snippet: isToday
        ? snippet
        : `Archived daily digest placeholder for ${key}. Open today's digest for live boards.`,
      contentHtml: isToday
        ? contentHtml
        : `<p>This archive day is listed for history. Switch to today's digest for live standings and leaders.</p>`,
    });
  }

  return {
    title: "MLB stats & standings",
    description: "Once-a-day division standings, wild cards, and league leaders",
    link: "https://www.mlb.com/standings",
    feedUrl: "synthetic:mlb-stats",
    items,
  };
}

/** Cardinals MiLB affiliate box-score wraps (Memphis → DSL). */
async function fetchCardinalsFarmWrapsFeed(): Promise<RssFeed> {
  const { fetchCardinalsFarmGameWraps } = await import("./mlb");
  const wraps = await fetchCardinalsFarmGameWraps(5);
  const items: RssFeedItem[] = wraps.map((w) => ({
    id: `farm-wrap-${w.gamePk}`,
    title: w.title,
    link: `/sports/mlb/game/${w.gamePk}`,
    author: w.level,
    publishedAt: w.publishedAt,
    image: null,
    snippet: w.snippet,
    contentHtml: w.contentHtml,
  }));

  return {
    title: "Cardinals farm wraps",
    description: "Box scores and summaries for St. Louis Cardinals minor-league affiliates",
    link: "/sports/mlb/prospects",
    feedUrl: "synthetic:cardinals-farm",
    items,
  };
}

export function fetchRssArticle(url: string): Promise<RssArticle> {
  return invokeRss<RssArticle>({ mode: "read", url }).catch(async (err) => {
    // Edge IPs often get thin STL Today shells — decrypt in the browser as fallback.
    if (/stltoday\.com/i.test(url)) {
      const local = await extractStlTodayInBrowser(url).catch(() => null);
      if (local) return local;
    }
    throw err;
  });
}

/** Browser-side TownNews unlock for STL Today when the edge extract fails. */
async function extractStlTodayInBrowser(url: string): Promise<RssArticle | null> {
  const res = await fetch(url, {
    headers: { Accept: "text/html" },
    credentials: "omit",
  });
  if (!res.ok) return null;
  const raw = await res.text();
  const decodeEntities = (s: string) =>
    s
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&mdash;/gi, "—")
      .replace(/&rsquo;/gi, "'");
  const decrypt = (s: string) => {
    let out = "";
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      out +=
        c >= 33 && c <= 126 ? String.fromCharCode(33 + ((c - 33 + 47) % 94)) : s[i];
    }
    return out;
  };
  const unlocked = raw.replace(
    /<(p|div|section|span)([^>]*(?:class|data-type)=["'][^"']*encrypted-content[^"']*["'][^>]*)>([\s\S]*?)<\/\1>/gi,
    (_m, tag: string, attrs: string, inner: string) => {
      const decoded = decrypt(decodeEntities(inner));
      const cleanAttrs = String(attrs)
        .replace(/\bencrypted-content\b/g, "")
        .replace(/\bsubscriber-only\b/g, "")
        .replace(/\s*style\s*=\s*"display:\s*none"/gi, "");
      return `<${tag}${cleanAttrs}>${decoded}</${tag}>`;
    },
  );
  const parts: string[] = [];
  const re =
    /<(p|div|blockquote)([^>]*class="[^"]*(?:subscriber-preview|lee-article-text|article-body)[^"]*"[^>]*)>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(unlocked))) {
    const attrs = m[2] || "";
    if (/subscriber-hide|trinity|inline-relcontent/i.test(attrs)) continue;
    if (/subscriber-preview/i.test(attrs) && !/lee-article-text|first-p|article-body/i.test(attrs)) {
      continue;
    }
    const inner = m[3].trim();
    const text = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (text.length < 12) continue;
    parts.push(/^\s*<p[\s>]/i.test(inner) ? inner : `<p>${inner}</p>`);
  }
  if (!parts.length) return null;
  const contentHtml = parts.join("\n");
  const contentText = contentHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (contentText.length < 40) return null;
  const title =
    unlocked.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    null;
  const image =
    unlocked.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    null;
  return {
    url,
    title,
    byline: "Post-Dispatch",
    image,
    contentHtml,
    contentText,
    wordCount: contentText.split(/\s+/).filter(Boolean).length,
  };
}

export function formatFeedDate(raw: string | null): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  // MLB Film Room / video items often publish as midnight UTC calendar labels
  // ("Tue, 11 Aug 2026 00:00:00 GMT"). Formatting in America/Chicago shifts
  // those to the previous evening and shows "yesterday".
  const isMidnightUtc =
    d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
  return d.toLocaleDateString("en-US", {
    timeZone: isMidnightUtc ? "UTC" : "America/Chicago",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export async function fetchRssReads(): Promise<Set<string>> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("rss_reads")
    .select("article_url")
    .eq("user_id", userId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.article_url));
}

export async function markRssRead(input: {
  articleUrl: string;
  articleTitle?: string | null;
  feedUrl?: string | null;
}): Promise<void> {
  await markRssReadMany([input]);
}

export async function markRssReadMany(
  inputs: {
    articleUrl: string;
    articleTitle?: string | null;
    feedUrl?: string | null;
  }[],
): Promise<void> {
  if (!inputs.length) return;
  const userId = await requireUserId();
  const readAt = new Date().toISOString();
  const rows = inputs.map((input) => ({
    user_id: userId,
    article_url: input.articleUrl,
    article_title: input.articleTitle ?? null,
    feed_url: input.feedUrl ?? null,
    read_at: readAt,
  }));
  const { error } = await supabase.from("rss_reads").upsert(rows, {
    onConflict: "user_id,article_url",
  });
  if (error) throw error;
}

export async function markRssUnread(articleUrl: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("rss_reads")
    .delete()
    .eq("user_id", userId)
    .eq("article_url", articleUrl);
  if (error) throw error;
}

export async function fetchRssHighlights(articleUrl?: string): Promise<RssHighlight[]> {
  const userId = await requireUserId();
  let q = supabase
    .from("rss_highlights")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (articleUrl) q = q.eq("article_url", articleUrl);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    articleUrl: r.article_url,
    articleTitle: r.article_title,
    feedUrl: r.feed_url,
    articleImage: (r as { article_image?: string | null }).article_image ?? null,
    quoteText: r.quote_text,
    note: r.note,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function createRssHighlight(input: {
  articleUrl: string;
  articleTitle?: string | null;
  feedUrl?: string | null;
  articleImage?: string | null;
  quoteText: string;
  note?: string;
}): Promise<RssHighlight> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("rss_highlights")
    .insert({
      user_id: userId,
      article_url: input.articleUrl,
      article_title: input.articleTitle ?? null,
      feed_url: input.feedUrl ?? null,
      article_image: input.articleImage ?? null,
      quote_text: input.quoteText.trim(),
      note: (input.note ?? "").trim(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    articleUrl: data.article_url,
    articleTitle: data.article_title,
    feedUrl: data.feed_url,
    articleImage: (data as { article_image?: string | null }).article_image ?? null,
    quoteText: data.quote_text,
    note: data.note,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function updateRssHighlightNote(id: string, note: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("rss_highlights")
    .update({ note: note.trim(), updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteRssHighlight(id: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("rss_highlights")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
}

export type RssSave = {
  id: string;
  articleUrl: string;
  articleTitle: string | null;
  feedUrl: string | null;
  image: string | null;
  snippet: string | null;
  author: string | null;
  publishedAt: string | null;
  savedAt: string;
};

export async function fetchRssSaves(): Promise<RssSave[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("rss_saves")
    .select("*")
    .eq("user_id", userId)
    .order("saved_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    articleUrl: r.article_url,
    articleTitle: r.article_title,
    feedUrl: r.feed_url,
    image: r.image,
    snippet: r.snippet,
    author: r.author,
    publishedAt: r.published_at,
    savedAt: r.saved_at,
  }));
}

export async function saveRssArticle(input: {
  articleUrl: string;
  articleTitle?: string | null;
  feedUrl?: string | null;
  image?: string | null;
  snippet?: string | null;
  author?: string | null;
  publishedAt?: string | null;
}): Promise<RssSave> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("rss_saves")
    .upsert(
      {
        user_id: userId,
        article_url: input.articleUrl,
        article_title: input.articleTitle ?? null,
        feed_url: input.feedUrl ?? null,
        image: input.image ?? null,
        snippet: input.snippet ?? null,
        author: input.author ?? null,
        published_at: input.publishedAt ?? null,
        saved_at: new Date().toISOString(),
      },
      { onConflict: "user_id,article_url" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    articleUrl: data.article_url,
    articleTitle: data.article_title,
    feedUrl: data.feed_url,
    image: data.image,
    snippet: data.snippet,
    author: data.author,
    publishedAt: data.published_at,
    savedAt: data.saved_at,
  };
}

export async function unsaveRssArticle(articleUrl: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("rss_saves")
    .delete()
    .eq("user_id", userId)
    .eq("article_url", articleUrl);
  if (error) throw error;
}

/** Feeds that stay out of the cross-feed Unread inbox (browse them on their own). */
export const RSS_SEPARATE_FEEDS = new Set<RssFeedId>([
  "mlb-wraps",
  "mlb-stats",
  "cardinals-farm",
]);
