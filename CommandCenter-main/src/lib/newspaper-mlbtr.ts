/**
 * MLB Trade Rumors. Full text is in content:encoded and team tags are categories.
 * A failed fetch returns nothing so the rest of the paper still prints.
 */
import type { MoItem } from "./newspaper-missouri";
import type { GameWrapCard } from "./newspaper-sports";

export const MLBTR_FEED = "https://feeds.feedburner.com/MlbTradeRumors";
const DROP_TITLE = /^(?:MLBTR Chat|MLBTR Podcast|Poll:|Mailbag)/;
const CARDINALS = "st. louis cardinals";
const ROYALS = "kansas city royals";

export type MlbtrItem = {
  title: string;
  link: string;
  publishedAt: string | null;
  categories: string[];
  body: string;
  excerpt: string;
};

export type MlbtrFiling = {
  cardinals: GameWrapCard[];
  royals: MoItem[];
  league: GameWrapCard[];
};

function decode(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function tag(block: string, name: string): string {
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i");
  return decode(block.match(re)?.[1] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function categoriesOf(block: string): string[] {
  const out: string[] = [];
  const re = /<category[^>]*>([\s\S]*?)<\/category>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    const value = decode(m[1] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (value) out.push(value);
  }
  return out;
}

function plain(html: string): string {
  return decode(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[^\S\n]+/g, " ")
    .trim();
}

export function parseMlbtr(xml: string): MlbtrItem[] {
  const items: MlbtrItem[] = [];
  const re = /<item[\s\S]*?<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const block = m[0];
    const title = tag(block, "title");
    const link = tag(block, "link") || tag(block, "guid");
    if (!title || !link || DROP_TITLE.test(title)) continue;
    const encoded = block.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i)?.[1] ?? "";
    const body = plain(encoded);
    const description = tag(block, "description");
    items.push({
      title,
      link,
      publishedAt: tag(block, "pubDate") || null,
      categories: categoriesOf(block),
      body: body || description,
      excerpt: description || body.slice(0, 280),
    });
  }
  return items;
}

function hashId(link: string): string {
  let h = 0;
  for (let i = 0; i < link.length; i++) h = (h * 33 + link.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function card(item: MlbtrItem, favoriteKey: string): GameWrapCard {
  const text = item.body || item.excerpt;
  return {
    id: `mlbtr-${hashId(item.link)}`,
    favoriteKey,
    followed: Boolean(favoriteKey),
    teamName: favoriteKey ? "Cardinals" : "MLB",
    teamHref: item.link,
    sportLabel: "MLB",
    leaguePath: "baseball/mlb",
    headline: item.title,
    dek: item.excerpt.slice(0, 240) || null,
    body: text,
    scoreLine: null,
    when: item.publishedAt,
    won: null,
    gameHref: item.link,
    wrapHref: item.link,
    feedUrl: MLBTR_FEED,
    gameId: null,
    stats: [],
    leaders: [],
    teamStats: [],
    division: [],
    photo: null,
    caption: "MLB Trade Rumors",
  };
}

function royal(item: MlbtrItem): MoItem {
  return {
    id: `mlbtr-${hashId(item.link)}`,
    source: "MLB Trade Rumors",
    headline: item.title,
    url: item.link,
    kind: "story",
    photo: null,
    dek: item.excerpt.slice(0, 260) || null,
    when: item.publishedAt,
  };
}

export function fileMlbtr(items: MlbtrItem[]): MlbtrFiling {
  const cardinals: GameWrapCard[] = [];
  const royals: MoItem[] = [];
  const league: GameWrapCard[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.link)) continue;
    seen.add(item.link);
    const tags = item.categories.map((c) => c.toLowerCase());
    const cards = tags.includes(CARDINALS);
    const kc = tags.includes(ROYALS);
    if (cards) cardinals.push(card(item, "mlb-stl"));
    if (kc) royals.push(royal(item));
    if (!cards && !kc) league.push(card(item, ""));
  }
  return { cardinals, royals, league };
}

export function isMlbtrCard(card: { id?: string; caption?: string | null; wrapHref?: string | null; feedUrl?: string | null }): boolean {
  if (card.caption === "MLB Trade Rumors" || card.id?.startsWith("mlbtr-")) return true;
  return /mlbtraderumors\.com|MlbTradeRumors/i.test(`${card.wrapHref ?? ""} ${card.feedUrl ?? ""}`);
}

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

/** Empty filing when the feed is down. */
export async function fetchMlbtr(): Promise<MlbtrFiling> {
  try {
    const res = await fetch(MLBTR_FEED, {
      headers: { Accept: "application/rss+xml, application/xml, text/xml", "User-Agent": UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { cardinals: [], royals: [], league: [] };
    return fileMlbtr(parseMlbtr(await res.text()));
  } catch {
    return { cardinals: [], royals: [], league: [] };
  }
}
