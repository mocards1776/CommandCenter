/**
 * The Missouri desk: John Combest's daily list of Missouri political
 * headlines, the statehouse wires, and the latest Missouri Scout update.
 * Parsing and dedupe live here (no network) so they can be tested in node.
 */
import { stripGettyCredit, truncateAtSentence } from "./newspaper-copy.ts";

export type MoItem = {
  id: string;
  source: string;
  headline: string;
  url: string;
  /** "listen" is a podcast, video or radio segment: it links out instead of opening in the reader. */
  kind: "story" | "listen";
  photo: string | null;
  dek: string | null;
  when: string | null;
  /** Other outlets that filed the same story. */
  also?: string[];
};

export type MissouriDesk = {
  scout: MoItem | null;
  items: MoItem[];
  listen: MoItem[];
};

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/** johncombest.com files one headline post per day at a predictable address. */
export function combestUrl(day: string): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  const weekday = WEEKDAYS[date.getUTCDay()]!;
  const month = MONTHS[m - 1]!;
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `https://johncombest.com/${y}/${mm}/${dd}/${weekday}-${month}-${d}-${y}-missouri-political-news-headlines/`;
}

const LISTEN_HOSTS =
  /(^|\.)(podcasts\.apple\.com|open\.spotify\.com|spotify\.com|youtube\.com|youtu\.be|soundcloud\.com|rumble\.com|iheart\.com|podbean\.com|anchor\.fm|buzzsprout\.com|vimeo\.com)$/i;
const SKIP_HOSTS =
  /(^|\.)(archive\.is|archive\.ph|archive\.today|web\.archive\.org|johncombest\.com|johncombestblog\.com|msn\.com|amzn\.to|amazon\.com|facebook\.com|x\.com|twitter\.com)$/i;

const PROMO_MARK =
  /\b(advertorial|sponsored content|presented by|paid (?:content|post)|partner content|click for full story)\b/i;
const PROMO_SERIES =
  /\b(debt collection series|how to collect debt|empathy in debt collection|delinquent debtor)\b/i;
const PROMO_PATH =
  /johncombestblog\.com|blogcategory=debt|\/f\/(?:empathy-in-debt|how-to-collect-debt)/i;

/**
 * Self-promo, advertorial, and off-topic series copy — Combest's own
 * johncombestblog.com "Debt collection series" is the type specimen.
 */
export function isPromoMissouriItem(item: { source?: string; headline: string; url: string }): boolean {
  const hay = `${item.source ?? ""} ${item.headline} ${item.url}`;
  if (PROMO_PATH.test(item.url) || PROMO_PATH.test(hay)) return true;
  if (PROMO_MARK.test(hay) || PROMO_SERIES.test(hay)) return true;
  if (/^combest$/i.test(item.source ?? "") && /johncombestblog\.com/i.test(item.url)) return true;
  return false;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&[lr]squo;/g, "’")
    .replace(/&[lr]dquo;/g, "”")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—");
}

function textOf(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function squash(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashId(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `mo-${(h >>> 0).toString(36)}`;
}

/** "P-D:  Boeing contract…" → source "P-D", headline "Boeing contract…". */
export function splitSourceLine(text: string): { source: string; headline: string } {
  const i = text.indexOf(":");
  if (i > 1 && i <= 90) {
    const source = text
      .slice(0, i)
      .replace(/\s*\([^)]*\)\s*$/, "")
      .trim();
    const headline = text.slice(i + 1).trim();
    if (headline.length > 12) return { source, headline };
  }
  return { source: "", headline: text };
}

function sourceFromHost(host: string): string {
  const known: Record<string, string> = {
    "stltoday.com": "Post-Dispatch",
    "kansascity.com": "KC Star",
    "missouriindependent.com": "Missouri Independent",
    "missourinet.com": "Missourinet",
    "stlpr.org": "St. Louis Public Radio",
    "kcur.org": "KCUR",
    "newstribune.com": "News Tribune",
    "news-leader.com": "Springfield News-Leader",
    "columbiamissourian.com": "Missourian",
    "komu.com": "KOMU",
    "ksdk.com": "KSDK",
    "fox2now.com": "FOX 2",
    "kmov.com": "KMOV",
    "kshb.com": "KSHB",
    "thehill.com": "The Hill",
    "rollcall.com": "Roll Call",
    "politico.com": "Politico",
    "apnews.com": "AP",
  };
  return known[host] ?? host.split(".").slice(-2, -1)[0]?.replace(/\b\w/g, (c) => c.toUpperCase()) ?? host;
}

/** Every headline link in a Combest post, in the order he ran them. */
export function parseCombest(html: string): MoItem[] {
  const out: MoItem[] = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const url = decodeEntities(m[1]!).replace(/#.*$/, "");
    const host = hostOf(url);
    if (!host || SKIP_HOSTS.test(host)) continue;
    const text = textOf(m[2]!);
    if (text.length < 20 || /^(archived version|free syndicated|syndicated|here\b|read more|click)/i.test(text)) continue;
    const { source, headline } = splitSourceLine(text);
    if (isPromoMissouriItem({ source, headline, url })) continue;
    out.push({
      id: hashId(normalizeUrl(url)),
      source: source || sourceFromHost(host),
      headline,
      url,
      kind: LISTEN_HOSTS.test(host) ? "listen" : "story",
      photo: null,
      dek: null,
      when: null,
    });
  }
  return out;
}

function words(s: string): Set<string> {
  return new Set(
    squash(s)
      .split(" ")
      .filter((w) => w.length > 3),
  );
}

const COMMON = new Set(
  "missouri missouri's state states house senate says would could should after about their there federal county counties school schools bill bills court new year years week first public plan plans report city louis kansas".split(
    " ",
  ),
);

function sameStory(a: MoItem, b: MoItem): boolean {
  if (normalizeUrl(a.url) === normalizeUrl(b.url)) return true;
  if (squash(a.headline).slice(0, 48) === squash(b.headline).slice(0, 48)) return true;
  const wa = words(a.headline);
  const wb = words(b.headline);
  if (wa.size < 4 || wb.size < 4) return false;
  let shared = 0;
  let telling = 0;
  for (const w of wa) {
    if (!wb.has(w)) continue;
    shared += 1;
    if (w.length >= 5 && !COMMON.has(w)) telling += 1;
  }
  const ratio = shared / Math.min(wa.size, wb.size);
  // Two outlets on one story share its nouns ("playing cards", "cold cases") even when the verbs differ.
  return ratio >= 0.7 || (telling >= 2 && ratio >= 0.25);
}

/** First copy wins; a later duplicate only lends its photo or dek. */
export function dedupeMo(items: MoItem[]): MoItem[] {
  const out: MoItem[] = [];
  for (const item of items) {
    const twin = out.find((o) => sameStory(o, item));
    if (twin) {
      if (item.source && item.source !== twin.source) twin.also = [...new Set([...(twin.also ?? []), item.source])];
      twin.photo ??= item.photo;
      twin.dek ??= item.dek;
      twin.when ??= item.when;
      continue;
    }
    out.push({ ...item });
  }
  return out;
}

/** Newest dated item by pubDate. Items without a parseable date do not win. */
export function newestPublished<T extends { publishedAt: string | null }>(items: T[]): T | null {
  let best: T | null = null;
  let bestAt = -Infinity;
  for (const item of items) {
    if (!item.publishedAt) continue;
    const at = Date.parse(item.publishedAt);
    if (Number.isNaN(at) || at < bestAt) continue;
    best = item;
    bestAt = at;
  }
  return best;
}

/** Article-page date (og/article:published_time or <time>), not a feed-level stamp. */
export function parseArticlePublished(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']article:published_time["']/i,
    /<time[^>]+datetime=["']([^"']+)["']/i,
    /<meta[^>]+property=["']og:updated_time["'][^>]*content=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const raw = re.exec(html)?.[1]?.trim();
    if (!raw) continue;
    const t = Date.parse(raw);
    if (!Number.isNaN(t)) return new Date(t).toISOString();
  }
  return null;
}

/** Prefer the story's own date when the feed stamped an old channel date. */
export function preferArticleDate(feed: string | null, article: string | null): string | null {
  if (article && feed) {
    const a = Date.parse(article);
    const f = Date.parse(feed);
    if (!Number.isNaN(a) && !Number.isNaN(f) && Math.abs(a - f) > 14 * 86_400_000) return article;
  }
  return article || feed;
}

export function feedItemToMo(
  item: { title: string; link: string; image: string | null; snippet: string; publishedAt: string | null },
  source: string,
): MoItem {
  const dek = truncateAtSentence(stripGettyCredit(textOf(item.snippet)), 260);
  return {
    id: hashId(normalizeUrl(item.link)),
    source,
    headline: textOf(item.title),
    url: item.link,
    kind: "story",
    photo: item.image,
    dek: dek || null,
    when: item.publishedAt,
  };
}

/** Combest's list sets the order; the statehouse wires fill in behind it. */
export function buildMissouriDesk(input: {
  combest: MoItem[];
  wires: MoItem[];
  scout: MoItem | null;
}): MissouriDesk {
  const all = dedupeMo([...input.combest, ...input.wires]).filter((i) => !isPromoMissouriItem(i));
  const scoutKey = input.scout ? normalizeUrl(input.scout.url) : "";
  const items = all.filter((i) => i.kind === "story" && normalizeUrl(i.url) !== scoutKey);
  const listen = all.filter((i) => i.kind === "listen");
  return { scout: input.scout, items, listen };
}
