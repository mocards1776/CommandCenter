/**
 * Thompson Times national-news desk.
 *
 * Pure ranking: parse public RSS, drop opinion/fluff, cluster the same event
 * across outlets, score by consensus / prominence / recency, then (optionally)
 * let Grok pick the 12–16 stories that run. No network. The newspaper-national
 * edge function fetches feeds, fills missing art from og:image, and calls Grok;
 * the paper only reads the filed row.
 */

import { newspaperParas, splitNewspaperSentences } from "./newspaper-paras.ts";

export type FeedKind = "lead" | "section" | "popular" | "wire";

export type NationalSource = {
  id: string;
  outlet: string;
  /** Conservative outlets sit above 1; wires are a confirmation check. */
  outletWeight: number;
  url: string;
  kind: FeedKind;
};

/**
 * Public feeds verified 2026-10-05. Dropped: Fox most-popular on moxie (400),
 * WSJ a.dj US (403), Dispatch /category/news (404), NR Corner (opinion),
 * Daily Wire /rss.xml and /feed (HTML), AP/Reuters native hosts (dead),
 * Reuters agency feed (404). Wires ride Google News site: queries.
 */
export const NATIONAL_SOURCES: readonly NationalSource[] = [
  { id: "fox-latest", outlet: "Fox News", outletWeight: 1.2, url: "https://moxie.foxnews.com/google-publisher/latest.xml", kind: "lead" },
  { id: "fox-politics", outlet: "Fox News", outletWeight: 1.2, url: "https://moxie.foxnews.com/google-publisher/politics.xml", kind: "section" },
  { id: "fox-us", outlet: "Fox News", outletWeight: 1.2, url: "https://moxie.foxnews.com/google-publisher/us.xml", kind: "section" },
  { id: "fox-popular", outlet: "Fox News", outletWeight: 1.25, url: "https://feeds.foxnews.com/foxnews/most-popular", kind: "popular" },
  { id: "wsj-world", outlet: "WSJ", outletWeight: 1.3, url: "https://feeds.content.dowjones.io/public/rss/RSSWorldNews", kind: "lead" },
  { id: "wsj-us", outlet: "WSJ", outletWeight: 1.3, url: "https://feeds.content.dowjones.io/public/rss/RSSUSnews", kind: "lead" },
  { id: "wsj-politics", outlet: "WSJ", outletWeight: 1.25, url: "https://feeds.content.dowjones.io/public/rss/socialpoliticsfeed", kind: "section" },
  { id: "nyp-news", outlet: "New York Post", outletWeight: 1.0, url: "https://nypost.com/news/feed/", kind: "lead" },
  { id: "nyp-us", outlet: "New York Post", outletWeight: 1.0, url: "https://nypost.com/us-news/feed/", kind: "section" },
  { id: "nyp-politics", outlet: "New York Post", outletWeight: 1.0, url: "https://nypost.com/politics/feed/", kind: "section" },
  { id: "examiner-news", outlet: "Washington Examiner", outletWeight: 1.0, url: "https://www.washingtonexaminer.com/news/feed/", kind: "lead" },
  { id: "freebeacon", outlet: "Washington Free Beacon", outletWeight: 0.95, url: "https://freebeacon.com/feed/", kind: "lead" },
  { id: "dispatch", outlet: "The Dispatch", outletWeight: 1.0, url: "https://thedispatch.com/feed/", kind: "lead" },
  { id: "nr-news", outlet: "National Review", outletWeight: 0.95, url: "https://www.nationalreview.com/news/feed/", kind: "lead" },
  { id: "dailywire", outlet: "Daily Wire", outletWeight: 0.9, url: "https://www.dailywire.com/feeds/rss.xml", kind: "lead" },
  { id: "ap-wire", outlet: "AP", outletWeight: 1.15, url: "https://news.google.com/rss/search?q=site:apnews.com+when:1d&hl=en-US&gl=US&ceid=US:en", kind: "wire" },
  { id: "reuters-wire", outlet: "Reuters", outletWeight: 1.15, url: "https://news.google.com/rss/search?q=site:reuters.com+when:1d&hl=en-US&gl=US&ceid=US:en", kind: "wire" },
];

export const WIRE_OUTLETS = new Set(["AP", "Reuters"]);

export type RawFeedItem = {
  title: string;
  url: string;
  snippet: string | null;
  publishedAt: string | null;
  imageUrl: string | null;
  imageCredit: string | null;
};

export type NationalItem = {
  id: string;
  sourceId: string;
  outlet: string;
  outletWeight: number;
  kind: FeedKind;
  title: string;
  url: string;
  snippet: string | null;
  publishedAt: string | null;
  imageUrl: string | null;
  imageCredit: string | null;
  /** 0-based position in that outlet's feed. */
  position: number;
};

export type NationalCluster = {
  id: string;
  items: NationalItem[];
  score: number;
  consensus: number;
  prominence: number;
  recency: number;
  popular: boolean;
  wireConfirm: boolean;
};

export type NationalStory = {
  id: string;
  headline: string;
  summary: string;
  /** Grok-filed grafs. When present the paper prints these and does not resplit. */
  paragraphs?: string[];
  url: string;
  source: string;
  credit: string;
  outlets: string[];
  publishedAt: string | null;
  imageUrl: string | null;
  imageCredit: string | null;
};

export type FeedStatus = {
  id: string;
  outlet: string;
  url: string;
  ok: boolean;
  count: number;
};

export type NationalDesk = {
  issueId: string;
  day: string;
  edition: "morning" | "midday" | "evening";
  label: string;
  stories: NationalStory[];
  sources: FeedStatus[];
  editor: { model: string | null; fallback: boolean; rationale: string };
  printedAt: string;
};

export type NationalEditorPick = {
  clusterId: string;
  headline: string;
  summary: string;
  paragraphs: string[];
  sourceItemId: string;
  credit: string;
};

export type NationalEditorDesk = {
  picks: NationalEditorPick[];
  rationale: string;
  model?: string | null;
};

export const NATIONAL_CLUSTER_CAP = 32;
export const NATIONAL_STORY_MIN = 12;
export const NATIONAL_STORY_MAX = 16;
/** Lead page of Section B; the rest jump to B2. */
export const NATIONAL_PAGE_FRONT = 8;

export type NationalPhotoSize = "lead" | "medium" | "thumb";

/** Art scale by rank: lead large, next few medium, the rest thumbs or none. */
export function nationalPhotoSize(index: number, hasImage: boolean): NationalPhotoSize | null {
  if (!hasImage) return null;
  if (index <= 0) return "lead";
  if (index < 4) return "medium";
  return "thumb";
}

const TZ = "America/Chicago";
const PRESS = [
  { hour: 6, slot: "morning" as const, label: "Morning Edition" },
  { hour: 12, slot: "midday" as const, label: "Midday Edition" },
  { hour: 17, slot: "evening" as const, label: "Evening Edition" },
];

function centralHour(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  return Number(parts.find((p) => p.type === "hour")?.value) % 24 || 0;
}

function shiftDay(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Same three Central-time editions as the sports press. */
export function nationalPress(now = new Date()): NationalDesk extends never ? never : {
  id: string;
  day: string;
  edition: "morning" | "midday" | "evening";
  label: string;
} {
  const today = now.toLocaleDateString("en-CA", { timeZone: TZ });
  const hour = centralHour(now);
  const slot = [...PRESS].reverse().find((p) => hour >= p.hour) ?? null;
  if (!slot) {
    const day = shiftDay(today, -1);
    const evening = PRESS[PRESS.length - 1]!;
    return { id: `${day}-${evening.slot}`, day, edition: evening.slot, label: evening.label };
  }
  return { id: `${today}-${slot.slot}`, day: today, edition: slot.slot, label: slot.label };
}

export function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&[lr]squo;/g, "’")
    .replace(/&[lr]dquo;/g, "”")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—");
}

function stripHtml(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function tagText(xml: string, name: string): string {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i");
  return decodeEntities((re.exec(xml)?.[1] ?? "").trim());
}

function tagAttr(xml: string, name: string, attr: string): string {
  const re = new RegExp(`<${name}[^>]*\\s${attr}=["']([^"']+)["']`, "i");
  return re.exec(xml)?.[1] ?? "";
}

function firstHref(html: string): string {
  return /href=["']([^"']+)["']/i.exec(html)?.[1] ?? "";
}

function toIso(raw: string): string | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function looksLikeImagePath(url: string): boolean {
  return /\.(jpe?g|png|gif|webp|avif)(?:$|[?#])/i.test(url);
}

/** Absolute http(s) image URL, or null. Relative URLs resolve against `base`. */
export function asHttpImageUrl(raw: string | null | undefined, base?: string): string | null {
  if (!raw) return null;
  const cleaned = decodeEntities(raw).trim();
  if (!cleaned) return null;
  try {
    const u = new URL(cleaned, base || "https://invalid.example");
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.hostname === "invalid.example") return null;
    if (/\b(1x1|pixel|spacer|sprite|tracking)\b/i.test(u.pathname)) return null;
    return u.href;
  } catch {
    return null;
  }
}

function mediaTagIsImage(attrs: string, url: string): boolean {
  const type = /(?:^|\s)type=["']([^"']+)["']/i.exec(attrs)?.[1] ?? "";
  const medium = /(?:^|\s)medium=["']([^"']+)["']/i.exec(attrs)?.[1] ?? "";
  if (medium && medium.toLowerCase() !== "image") return false;
  if (type && !/^image\//i.test(type)) return false;
  if (!type && !medium) return looksLikeImagePath(url) || /\/image|\/photo|\/media\//i.test(url);
  return true;
}

/** Art on the RSS item: media:content, media:thumbnail, enclosure, or an inline img. */
export function feedImage(block: string): { url: string | null; credit: string | null } {
  const candidates: { url: string; width: number }[] = [];
  const take = (attrs: string) => {
    const raw = /(?:^|\s)url=["']([^"']+)["']/i.exec(attrs)?.[1] ?? "";
    const url = asHttpImageUrl(raw);
    if (!url || !mediaTagIsImage(attrs, url)) return;
    const width = Number(/(?:^|\s)width=["'](\d+)["']/i.exec(attrs)?.[1] ?? 0);
    candidates.push({ url, width });
  };
  for (const name of ["media:content", "media:thumbnail"]) {
    const re = new RegExp(`<${name}\\b([^>]*)\\/?>`, "gi");
    let match: RegExpExecArray | null;
    while ((match = re.exec(block))) take(match[1] ?? "");
  }
  const enc = /<enclosure\b([^>]*)\/?>/gi;
  let enclosure: RegExpExecArray | null;
  while ((enclosure = enc.exec(block))) take(enclosure[1] ?? "");
  if (!candidates.length) {
    const inline = /<img[^>]+src=["']([^"']+)["']/i.exec(block)?.[1];
    const url = asHttpImageUrl(inline);
    if (url) candidates.push({ url, width: 0 });
  }
  candidates.sort((a, b) => b.width - a.width);
  const credit = stripHtml(tagText(block, "media:credit") || tagText(block, "media:title"));
  return { url: candidates[0]?.url ?? null, credit: credit || null };
}

/** og:image (or twitter:image) from an article page. */
export function parseOgImage(html: string, base?: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image:secure_url["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image:secure_url["']/i,
    /<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*name=["']twitter:image(?::src)?["']/i,
  ];
  for (const re of patterns) {
    const url = asHttpImageUrl(re.exec(html)?.[1], base);
    if (url) return url;
  }
  return null;
}

export function imageCreditFor(outlet: string, filed?: string | null): string {
  const credit = (filed ?? "").replace(/\s+/g, " ").trim();
  return credit || outlet || "";
}

function clusterArt(items: NationalItem[], preferred: NationalItem): { imageUrl: string | null; imageCredit: string | null } {
  if (preferred.imageUrl) {
    return { imageUrl: preferred.imageUrl, imageCredit: imageCreditFor(preferred.outlet, preferred.imageCredit) };
  }
  const hit = items.find((i) => i.imageUrl);
  if (!hit?.imageUrl) return { imageUrl: null, imageCredit: null };
  return { imageUrl: hit.imageUrl, imageCredit: imageCreditFor(hit.outlet, hit.imageCredit) };
}

/** RSS 2 and Atom. Google News items keep the original article URL when present. */
export function parseRss(xml: string): RawFeedItem[] {
  const items: RawFeedItem[] = [];
  const blocks = [
    ...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi),
    ...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi),
  ];
  for (const match of blocks) {
    const block = match[0]!;
    const title = stripHtml(tagText(block, "title"));
    const desc = tagText(block, "description") || tagText(block, "summary") || tagText(block, "content");
    const atomLink = tagAttr(block, "link", "href");
    const rssLink = stripHtml(tagText(block, "link"));
    const sourceUrl = tagAttr(block, "source", "url");
    const fromDesc = firstHref(desc);
    let url = "";
    if (/apnews\.com|reuters\.com/i.test(fromDesc)) url = fromDesc;
    else if (/apnews\.com|reuters\.com/i.test(sourceUrl) && fromDesc) url = fromDesc;
    else url = rssLink || atomLink || fromDesc || sourceUrl;
    if (!title || !url || !/^https?:\/\//i.test(url)) continue;
    const published =
      tagText(block, "pubDate") ||
      tagText(block, "published") ||
      tagText(block, "updated") ||
      tagText(block, "dc:date");
    const art = feedImage(block);
    items.push({
      title,
      url: url.replace(/&amp;/g, "&"),
      snippet: stripHtml(desc).slice(0, 420) || null,
      publishedAt: toIso(published),
      imageUrl: art.url,
      imageCredit: art.credit,
    });
  }
  return items;
}

const OUTLET_SUFFIX =
  /\s+[—|–-]\s+(?:Fox News|The Wall Street Journal|WSJ|New York Post|Associated Press|AP News|AP|Reuters|National Review|The Daily Wire|Daily Wire|Washington Examiner|Washington Free Beacon|The Dispatch|Yahoo News|Google News)\s*$/i;

export function cleanHeadline(title: string): string {
  return title.replace(OUTLET_SUFFIX, "").replace(/\s+/g, " ").trim();
}

const SKIP_PATH =
  /\/(opinion|op-ed|oped|opinions|column|columns|commentary|editorial|editorials|analysis|analyses|podcasts?|video(?:s|watch)?|watch|sponsored|advertisement|entertainment|celebrity|page-six|sports|horoscope|comics|crossword|recipe|lifestyle|shopping|deals|newsletter|newsletters|shows?|videos|down-the-rabbit-hole)\b/i;
const SKIP_TITLE =
  /\b(opinion|op-?ed|column(?:ist)?|analysis|analyses|podcast|watch now|sponsored|fox nation|editorial|your letters|horoscope|page six)\b/i;
const SKIP_HOST = /(^|\.)(youtube\.com|youtu\.be|spotify\.com|apple\.com)$/i;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function isExcludedItem(item: { title: string; url: string }): boolean {
  let path = "";
  try {
    path = new URL(item.url).pathname;
  } catch {
    path = item.url;
  }
  if (SKIP_PATH.test(path) || SKIP_TITLE.test(item.title) || SKIP_HOST.test(hostOf(item.url))) return true;
  return false;
}

function hashId(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `nn-${(h >>> 0).toString(36)}`;
}

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid"].forEach((k) => u.searchParams.delete(k));
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}${u.search}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

export function itemsFromFeed(
  source: NationalSource,
  raw: RawFeedItem[],
  limit = source.kind === "popular" ? 20 : 16,
): NationalItem[] {
  const out: NationalItem[] = [];
  const seen = new Set<string>();
  raw.forEach((row, position) => {
    if (out.length >= limit) return;
    if (isExcludedItem(row)) return;
    const url = row.url;
    const key = normalizeUrl(url);
    if (seen.has(key)) return;
    seen.add(key);
    const title = cleanHeadline(row.title);
    if (title.length < 16) return;
    out.push({
      id: hashId(`${source.id}:${key}`),
      sourceId: source.id,
      outlet: source.outlet,
      outletWeight: source.outletWeight,
      kind: source.kind,
      title,
      url,
      snippet: row.snippet,
      publishedAt: row.publishedAt,
      imageUrl: asHttpImageUrl(row.imageUrl),
      imageCredit: row.imageCredit?.replace(/\s+/g, " ").trim() || null,
      position,
    });
  });
  return out;
}

const STOP = new Set([
  "the", "and", "for", "with", "from", "that", "this", "have", "has", "was", "were",
  "are", "but", "his", "her", "their", "its", "into", "over", "after", "before",
  "about", "will", "they", "them", "been", "than", "then", "when", "what", "your",
  "our", "who", "how", "not", "you", "all", "can", "just", "out", "new", "says", "said",
  "after", "amid", "against", "under", "into", "onto", "over", "near", "more", "than",
  "could", "would", "should", "might", "must", "also", "still", "back", "down", "some",
]);

export function significantWords(title: string): string[] {
  return cleanHeadline(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w));
}

export function sameStory(a: string[], b: string[]): boolean {
  if (!a.length || !b.length) return false;
  const other = new Set(b);
  const shared = a.filter((w) => other.has(w));
  const shorter = Math.min(a.length, b.length);
  if (shared.length >= 3 && shared.length / shorter >= 0.45) return true;
  if (shared.length >= 2 && shared.some((w) => w.length >= 6) && shared.length / shorter >= 0.55) return true;
  return false;
}

/** One cluster per event. Items keep their outlet and feed rank. */
export function clusterItems(items: NationalItem[]): NationalItem[][] {
  const groups: { words: string[]; items: NationalItem[] }[] = [];
  for (const item of items) {
    const words = significantWords(item.title);
    const hit = groups.find((g) => sameStory(words, g.words));
    if (hit) {
      if (!hit.items.some((prev) => normalizeUrl(prev.url) === normalizeUrl(item.url))) {
        hit.items.push(item);
        for (const w of words) if (!hit.words.includes(w)) hit.words.push(w);
      }
      continue;
    }
    groups.push({ words, items: [item] });
  }
  return groups.map((g) => g.items);
}

function ageHours(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, (now.getTime() - t) / 3_600_000);
}

function kindBonus(kind: FeedKind): number {
  if (kind === "popular") return 10;
  if (kind === "lead") return 4;
  if (kind === "section") return 2;
  return 1;
}

/**
 * Mechanical rank for one event:
 *   14 × consensus  (unique-outlet weights; wires count 0.6)
 * +  1 × prominence (feed position + lead/popular bonus, per item)
 * + 18 × recency    (exp(-ageHours / 10), 0.45 if undated)
 * +  6 if AP or Reuters also filed it
 * +  8 if it appeared on a most-read list
 */
export function scoreCluster(items: NationalItem[], now = new Date()): Omit<NationalCluster, "id"> {
  const byOutlet = new Map<string, NationalItem>();
  for (const item of items) {
    const prev = byOutlet.get(item.outlet);
    if (!prev || item.position < prev.position) byOutlet.set(item.outlet, item);
  }
  const unique = [...byOutlet.values()];
  let consensus = 0;
  for (const item of unique) {
    consensus += WIRE_OUTLETS.has(item.outlet) ? 0.6 : item.outletWeight;
  }
  let prominence = 0;
  for (const item of items) {
    const place = Math.max(0, 12 - item.position);
    prominence += (place + kindBonus(item.kind)) * item.outletWeight;
  }
  const ages = items.map((i) => ageHours(i.publishedAt, now)).filter((n): n is number => n != null);
  const recency = ages.length
    ? ages.reduce((n, h) => n + Math.exp(-h / 10), 0) / ages.length
    : 0.45;
  const popular = items.some((i) => i.kind === "popular");
  const wireConfirm = unique.some((i) => WIRE_OUTLETS.has(i.outlet));
  const score = 14 * consensus + prominence + 18 * recency + (wireConfirm ? 6 : 0) + (popular ? 8 : 0);
  return { items, score, consensus, prominence, recency, popular, wireConfirm };
}

export function rankClusters(items: NationalItem[], now = new Date()): NationalCluster[] {
  return clusterItems(items)
    .map((group, i) => ({ id: `cl-${i + 1}`, ...scoreCluster(group, now) }))
    .sort((a, b) => b.score - a.score || b.items.length - a.items.length);
}

export function preferredItem(items: NationalItem[]): NationalItem {
  const conservative = items.filter((i) => !WIRE_OUTLETS.has(i.outlet));
  const pool = conservative.length ? conservative : items;
  return [...pool].sort((a, b) => {
    const byKind = kindBonus(b.kind) - kindBonus(a.kind);
    if (byKind) return byKind;
    const byWeight = b.outletWeight - a.outletWeight;
    if (byWeight) return byWeight;
    return a.position - b.position;
  })[0]!;
}

export function creditLine(items: NationalItem[]): string {
  const names: string[] = [];
  for (const item of items) {
    if (!names.includes(item.outlet)) names.push(item.outlet);
  }
  const conservative = names.filter((n) => !WIRE_OUTLETS.has(n));
  const wires = names.filter((n) => WIRE_OUTLETS.has(n));
  return [...conservative, ...wires].slice(0, 4).join(", ");
}

function sentences(text: string, max = 3): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const parts = splitNewspaperSentences(clean);
  return (parts.slice(0, max).join(" ") || clean).slice(0, 520);
}

function storyParagraphs(summary: string, filed?: unknown): string[] {
  const fromFiled = Array.isArray(filed)
    ? filed.filter((p): p is string => typeof p === "string")
    : [];
  return newspaperParas(fromFiled.length ? fromFiled : summary);
}

export function storyFromCluster(cluster: NationalCluster): NationalStory {
  const pick = preferredItem(cluster.items);
  const summary =
    sentences(pick.snippet ?? "", 3) ||
    `${pick.title}.`;
  const art = clusterArt(cluster.items, pick);
  return {
    id: cluster.id,
    headline: pick.title,
    summary,
    paragraphs: newspaperParas(summary),
    url: pick.url,
    source: pick.outlet,
    credit: creditLine(cluster.items),
    outlets: [...new Set(cluster.items.map((i) => i.outlet))],
    publishedAt: pick.publishedAt,
    imageUrl: art.imageUrl,
    imageCredit: art.imageCredit,
  };
}

/** Keep Grok's order; top up a short desk from the mechanical list. */
export function padStories(
  picked: NationalStory[],
  fallback: NationalStory[],
  min = NATIONAL_STORY_MIN,
  max = NATIONAL_STORY_MAX,
): NationalStory[] {
  const seen = new Set(picked.map((s) => s.id));
  const out = picked.slice(0, max);
  for (const story of fallback) {
    if (out.length >= min || out.length >= max) break;
    if (seen.has(story.id)) continue;
    seen.add(story.id);
    out.push(story);
  }
  return out.slice(0, max);
}

export function mechanicalStories(clusters: NationalCluster[], limit = NATIONAL_STORY_MAX): NationalStory[] {
  return clusters.slice(0, Math.max(NATIONAL_STORY_MIN, Math.min(limit, NATIONAL_STORY_MAX))).map(storyFromCluster);
}

export type ClusterBrief = {
  id: string;
  score: number;
  outlets: string[];
  items: {
    id: string;
    outlet: string;
    title: string;
    url: string;
    snippet: string | null;
    position: number;
    kind: FeedKind;
  }[];
};

export function clusterBriefs(clusters: NationalCluster[], cap = NATIONAL_CLUSTER_CAP): ClusterBrief[] {
  return clusters.slice(0, cap).map((c) => ({
    id: c.id,
    score: Math.round(c.score * 10) / 10,
    outlets: [...new Set(c.items.map((i) => i.outlet))],
    items: c.items.slice(0, 6).map((i) => ({
      id: i.id,
      outlet: i.outlet,
      title: i.title,
      url: i.url,
      snippet: i.snippet ? i.snippet.slice(0, 220) : null,
      position: i.position,
      kind: i.kind,
    })),
  }));
}

const ids = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

/**
 * Hold Grok to the clusters it was shown. Unknown ids drop; 12–16 picks;
 * a junk answer (too few, empty copy) is null and the mechanical desk runs.
 */
export function readNationalEditor(
  raw: unknown,
  briefs: ClusterBrief[],
): NationalEditorDesk | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const known = new Map(briefs.map((b) => [b.id, b]));
  const itemIds = new Set(briefs.flatMap((b) => b.items.map((i) => i.id)));
  const picks: NationalEditorPick[] = [];
  const seen = new Set<string>();
  const rows = Array.isArray(rec.picks) ? rec.picks : [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const clusterId = typeof r.clusterId === "string" ? r.clusterId : "";
    if (!known.has(clusterId) || seen.has(clusterId)) continue;
    const headline = typeof r.headline === "string" ? cleanHeadline(r.headline).slice(0, 160) : "";
    const paragraphs = storyParagraphs(typeof r.summary === "string" ? r.summary : "", r.paragraphs);
    const summary = (paragraphs.join(" ") || (typeof r.summary === "string" ? r.summary : "")).replace(/\s+/g, " ").trim().slice(0, 520);
    if (!headline || summary.length < 40) continue;
    let sourceItemId = typeof r.sourceItemId === "string" ? r.sourceItemId : "";
    if (!itemIds.has(sourceItemId)) {
      const brief = known.get(clusterId)!;
      sourceItemId = brief.items[0]?.id ?? "";
    }
    const credit = typeof r.credit === "string" ? r.credit.replace(/\s+/g, " ").trim().slice(0, 80) : "";
    seen.add(clusterId);
    picks.push({ clusterId, headline, summary, paragraphs, sourceItemId, credit });
    if (picks.length >= NATIONAL_STORY_MAX) break;
  }
  const need = briefs.length >= NATIONAL_STORY_MIN ? 8 : Math.min(2, briefs.length);
  if (picks.length < need) return null;
  const rationale = typeof rec.rationale === "string" ? rec.rationale.trim().slice(0, 400) : "";
  const model = typeof rec.model === "string" ? rec.model : null;
  return { picks, rationale, model };
}

export function storiesFromEditor(
  desk: NationalEditorDesk,
  clusters: NationalCluster[],
): NationalStory[] {
  const byId = new Map(clusters.map((c) => [c.id, c]));
  const out: NationalStory[] = [];
  for (const pick of desk.picks) {
    const cluster = byId.get(pick.clusterId);
    if (!cluster) continue;
    const item = cluster.items.find((i) => i.id === pick.sourceItemId) ?? preferredItem(cluster.items);
    const art = clusterArt(cluster.items, item);
    out.push({
      id: cluster.id,
      headline: pick.headline,
      summary: pick.summary,
      paragraphs: pick.paragraphs,
      url: item.url,
      source: item.outlet,
      credit: pick.credit || creditLine(cluster.items),
      outlets: [...new Set(cluster.items.map((i) => i.outlet))],
      publishedAt: item.publishedAt,
      imageUrl: art.imageUrl,
      imageCredit: art.imageCredit,
    });
  }
  return out;
}

export function asNationalDesk(row: {
  issue_id?: unknown;
  day?: unknown;
  edition?: unknown;
  stories?: unknown;
  sources?: unknown;
  editor?: unknown;
  printed_at?: unknown;
}): NationalDesk | null {
  if (!row || typeof row.issue_id !== "string") return null;
  if (!Array.isArray(row.stories) || !row.stories.length) return null;
  const stories: NationalStory[] = [];
  for (const raw of row.stories) {
    if (!raw || typeof raw !== "object") continue;
    const s = raw as Record<string, unknown>;
    if (typeof s.headline !== "string" || typeof s.url !== "string") continue;
    if (!s.headline.trim() || !/^https?:\/\//i.test(s.url)) continue;
    const summary = typeof s.summary === "string" ? s.summary : "";
    const paragraphs = storyParagraphs(summary, s.paragraphs);
    const source = typeof s.source === "string" ? s.source : "";
    const imageUrl = asHttpImageUrl(
      (typeof s.imageUrl === "string" && s.imageUrl) ||
        (typeof s.image === "string" && s.image) ||
        (typeof s.photo === "string" && s.photo) ||
        null,
    );
    const imageCredit = imageCreditFor(
      source,
      typeof s.imageCredit === "string" ? s.imageCredit : null,
    );
    stories.push({
      id: typeof s.id === "string" ? s.id : hashId(s.url),
      headline: s.headline.trim(),
      summary: paragraphs.join(" ") || summary,
      paragraphs,
      url: s.url,
      source,
      credit: typeof s.credit === "string" ? s.credit : source,
      outlets: Array.isArray(s.outlets) ? s.outlets.filter((v): v is string => typeof v === "string") : [],
      publishedAt: typeof s.publishedAt === "string" ? s.publishedAt : null,
      imageUrl,
      imageCredit: imageUrl ? imageCredit : null,
    });
  }
  if (!stories.length) return null;
  const edition =
    row.edition === "morning" || row.edition === "midday" || row.edition === "evening"
      ? row.edition
      : "morning";
  const editor = row.editor && typeof row.editor === "object" ? (row.editor as Record<string, unknown>) : {};
  return {
    issueId: row.issue_id,
    day: typeof row.day === "string" ? row.day : row.issue_id.slice(0, 10),
    edition,
    label:
      edition === "morning" ? "Morning Edition" : edition === "midday" ? "Midday Edition" : "Evening Edition",
    stories,
    sources: Array.isArray(row.sources) ? (row.sources as FeedStatus[]) : [],
    editor: {
      model: typeof editor.model === "string" ? editor.model : null,
      fallback: editor.fallback === true,
      rationale: typeof editor.rationale === "string" ? editor.rationale : "",
    },
    printedAt: typeof row.printed_at === "string" ? row.printed_at : new Date().toISOString(),
  };
}

/** Realistic stand-in for layout tests and iPad screenshots. */
export function sampleNationalDesk(issueId = "2026-10-05-morning"): NationalDesk {
  const press = issueId.match(/^(.*)-(morning|midday|evening)$/);
  const day = press?.[1] ?? "2026-10-05";
  const edition = (press?.[2] ?? "morning") as NationalDesk["edition"];
  const label =
    edition === "morning" ? "Morning Edition" : edition === "midday" ? "Midday Edition" : "Evening Edition";
  return {
    issueId,
    day,
    edition,
    label,
    printedAt: `${day}T11:07:00.000Z`,
    editor: { model: "grok-4.6", fallback: false, rationale: "Lead is the overnight Washington story every desk filed." },
    sources: NATIONAL_SOURCES.map((s) => ({ id: s.id, outlet: s.outlet, url: s.url, ok: true, count: 8 })),
    stories: [
      {
        id: "cl-1",
        headline: "White House and Senate leaders reopen the spending fight",
        summary:
          "Negotiators returned to the Capitol overnight after a weekend of stalled talks on a stopgap spending bill. Party leaders said a short-term measure was still possible before agencies start to close, but neither side released a text. The wire desks treated it as the lead in Washington.",
        url: "https://www.foxnews.com/politics/white-house-senate-spending",
        source: "Fox News",
        credit: "Fox News, WSJ, AP",
        outlets: ["Fox News", "WSJ", "AP"],
        publishedAt: `${day}T08:20:00.000Z`,
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/US_Capitol_west_side.JPG/1280px-US_Capitol_west_side.JPG",
        imageCredit: "Fox News",
      },
      {
        id: "cl-2",
        headline: "Justices take up a challenge to a federal firearms rule",
        summary:
          "The Supreme Court agreed to hear a challenge to a Biden-era firearms regulation that lower courts have split on. Briefing is set for the winter sitting. The case does not yet schedule oral argument.",
        url: "https://www.wsj.com/us-news/supreme-court-firearms",
        source: "WSJ",
        credit: "WSJ, National Review, Reuters",
        outlets: ["WSJ", "National Review", "Reuters"],
        publishedAt: `${day}T07:05:00.000Z`,
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/United_States_Supreme_Court_Building.jpg/1280px-United_States_Supreme_Court_Building.jpg",
        imageCredit: "WSJ",
      },
      {
        id: "cl-3",
        headline: "Israel and Hamas trade accusations after a Gaza cease-fire scare",
        summary:
          "Israeli and Hamas officials accused each other of violating a fragile cease-fire after overnight strikes near Rafah. The White House said it was monitoring the reports. No independent casualty count was available at press time.",
        url: "https://www.foxnews.com/world/israel-hamas-cease-fire",
        source: "Fox News",
        credit: "Fox News, WSJ, Reuters",
        outlets: ["Fox News", "WSJ", "Reuters"],
        publishedAt: `${day}T06:40:00.000Z`,
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Flag_of_the_White_House.svg/1280px-Flag_of_the_White_House.svg.png",
        imageCredit: "Fox News",
      },
      {
        id: "cl-4",
        headline: "Federal Reserve officials signal they are in no rush to cut",
        summary:
          "Two regional Fed presidents said incoming inflation data has not cleared the way for a near-term rate cut. Futures markets trimmed the odds of a move at the next meeting. The comments came after last week’s jobs report.",
        url: "https://www.wsj.com/economy/fed-officials-rates",
        source: "WSJ",
        credit: "WSJ, AP, Washington Examiner",
        outlets: ["WSJ", "AP", "Washington Examiner"],
        publishedAt: `${day}T09:10:00.000Z`,
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Marriner_S._Eccles_Federal_Reserve_Board_Building.jpg/1280px-Marriner_S._Eccles_Federal_Reserve_Board_Building.jpg",
        imageCredit: "WSJ",
      },
      {
        id: "cl-5",
        headline: "House panel issues new subpoenas in the intelligence leak inquiry",
        summary:
          "The House intelligence committee issued subpoenas to two former agency officials after they declined voluntary interviews. The ranking member called the step premature. The panel set a closed hearing for later this month.",
        url: "https://www.washingtonexaminer.com/news/house-intel-subpoenas",
        source: "Washington Examiner",
        credit: "Washington Examiner, Fox News, The Dispatch",
        outlets: ["Washington Examiner", "Fox News", "The Dispatch"],
        publishedAt: `${day}T05:55:00.000Z`,
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/US_Capitol_Building.jpg/1280px-US_Capitol_Building.jpg",
        imageCredit: "Washington Examiner",
      },
      {
        id: "cl-6",
        headline: "Border crossings fall again in the latest monthly tally",
        summary:
          "Customs and Border Protection said southwest border encounters fell for a third straight month. Officials credited enforcement changes and seasonal patterns. Advocacy groups said the figures omit people released pending hearings.",
        url: "https://nypost.com/news/border-crossings-fall",
        source: "New York Post",
        credit: "New York Post, Fox News, AP",
        outlets: ["New York Post", "Fox News", "AP"],
        publishedAt: `${day}T04:15:00.000Z`,
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/US-Mexico_border_fence.jpg/1280px-US-Mexico_border_fence.jpg",
        imageCredit: "New York Post",
      },
      {
        id: "cl-7",
        headline: "China announces new export controls on battery materials",
        summary:
          "Beijing said it would require licenses for exports of two battery metals used in electric vehicles. The Commerce Department said it was reviewing the notice. Automakers have been stockpiling the materials since last year.",
        url: "https://www.wsj.com/world/china-battery-export-controls",
        source: "WSJ",
        credit: "WSJ, Reuters, National Review",
        outlets: ["WSJ", "Reuters", "National Review"],
        publishedAt: `${day}T03:30:00.000Z`,
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Flag_of_the_United_States.svg/1280px-Flag_of_the_United_States.svg.png",
        imageCredit: "WSJ",
      },
      {
        id: "cl-8",
        headline: "Missouri’s attorney general joins a multistate election suit",
        summary:
          "Missouri joined a coalition of states asking a federal court to block a Justice Department guidance memo on voter-roll maintenance. The department said the memo restates existing law. A hearing has not been set.",
        url: "https://freebeacon.com/missouri-election-suit",
        source: "Washington Free Beacon",
        credit: "Washington Free Beacon, The Dispatch",
        outlets: ["Washington Free Beacon", "The Dispatch"],
        publishedAt: `${day}T02:50:00.000Z`,
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Missouri_State_Capitol_2009.jpg/1280px-Missouri_State_Capitol_2009.jpg",
        imageCredit: "Washington Free Beacon",
      },
      {
        id: "cl-9",
        headline: "Pentagon sends a new Patriot battery to the Middle East",
        summary:
          "The Defense Department said it had moved an additional Patriot battery and several hundred troops to the region after weekend strikes on commercial shipping. Officials called the deployment defensive. No timeline for a withdrawal was given.",
        url: "https://www.foxnews.com/politics/pentagon-patriot-battery",
        source: "Fox News",
        credit: "Fox News, WSJ, Reuters",
        outlets: ["Fox News", "WSJ", "Reuters"],
        publishedAt: `${day}T08:05:00.000Z`,
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Pentagon_US_Department_of_Defense_building.jpg/1280px-Pentagon_US_Department_of_Defense_building.jpg",
        imageCredit: "Fox News",
      },
      {
        id: "cl-10",
        headline: "House votes to keep Ukraine aid flowing through the winter",
        summary:
          "The House passed a short-term Ukraine assistance bill after a weekend of talks with holdouts. The Senate is expected to take it up this week. The White House said the package does not include new long-range weapons.",
        url: "https://www.wsj.com/politics/ukraine-aid-house",
        source: "WSJ",
        credit: "WSJ, The Dispatch, AP",
        outlets: ["WSJ", "The Dispatch", "AP"],
        publishedAt: `${day}T07:40:00.000Z`,
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Flag_of_Ukraine.svg/1280px-Flag_of_Ukraine.svg.png",
        imageCredit: "WSJ",
      },
      {
        id: "cl-11",
        headline: "Gulf hurricane makes landfall as a Category 2 storm",
        summary:
          "The National Hurricane Center said the storm came ashore west of Tampa with 100-mile-an-hour winds. Evacuation orders covered three coastal counties. Power companies reported more than 400,000 customers without electricity at press time.",
        url: "https://nypost.com/news/gulf-hurricane-landfall",
        source: "New York Post",
        credit: "New York Post, Fox News, AP",
        outlets: ["New York Post", "Fox News", "AP"],
        publishedAt: `${day}T06:10:00.000Z`,
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Hurricane_Ian_2022-09-28_1510Z.jpg/1280px-Hurricane_Ian_2022-09-28_1510Z.jpg",
        imageCredit: "New York Post",
      },
      {
        id: "cl-12",
        headline: "Justice Department charges a former aide in a classified-files case",
        summary:
          "Prosecutors unsealed an indictment accusing a former White House aide of retaining classified documents after leaving office. The defendant’s lawyer said the files were stored by mistake. A first appearance is set for Thursday.",
        url: "https://www.washingtonexaminer.com/news/doj-classified-files",
        source: "Washington Examiner",
        credit: "Washington Examiner, Fox News",
        outlets: ["Washington Examiner", "Fox News"],
        publishedAt: `${day}T05:20:00.000Z`,
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/US-DeptOfJustice-Seal.svg/1024px-US-DeptOfJustice-Seal.svg.png",
        imageCredit: "Washington Examiner",
      },
      {
        id: "cl-13",
        headline: "September jobs report shows hiring slowed but did not stall",
        summary:
          "Employers added fewer jobs than economists had forecast, and the unemployment rate ticked up a tenth of a point. Wage growth cooled. The figures landed as Fed officials debate whether to wait on a rate cut.",
        url: "https://www.wsj.com/economy/september-jobs-report",
        source: "WSJ",
        credit: "WSJ, AP",
        outlets: ["WSJ", "AP"],
        publishedAt: `${day}T12:30:00.000Z`,
        imageUrl: null,
        imageCredit: null,
      },
      {
        id: "cl-14",
        headline: "Taiwan reports a new surge of Chinese military flights",
        summary:
          "Taiwan’s defense ministry said more than 40 Chinese military aircraft crossed the median line of the Taiwan Strait overnight. Beijing said the drills were routine. Washington called on both sides to avoid an incident.",
        url: "https://thedispatch.com/taiwan-strait-flights",
        source: "The Dispatch",
        credit: "The Dispatch, Reuters",
        outlets: ["The Dispatch", "Reuters"],
        publishedAt: `${day}T03:05:00.000Z`,
        imageUrl: null,
        imageCredit: null,
      },
    ].map((story) => ({ ...story, paragraphs: newspaperParas(story.summary) })),
  };
}
