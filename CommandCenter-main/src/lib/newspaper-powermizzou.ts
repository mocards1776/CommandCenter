/**
 * PowerMizzou. The RSS excerpt is a sentence or two. The press fetches the
 * article once and keeps the body only when the page is open and long enough.
 * Anything else stays a brief and cannot front A1. A failed feed returns nothing.
 */
import type { GameWrapCard } from "./newspaper-sports";

export const POWERMIZZOU_FEED = "https://rss.app/feeds/uXxccdMsYLLjs47k.xml";
export const POWERMIZZOU_FETCH_CAP = 15;
const BODY_MIN = 400;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

export type PowerItem = {
  title: string;
  link: string;
  publishedAt: string | null;
  excerpt: string;
};

export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function parsePowerMizzouFeed(xml: string): PowerItem[] {
  const items: PowerItem[] = [];
  const re = /<item[\s\S]*?<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const block = m[0];
    const pick = (name: string) =>
      (block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"))?.[1] ?? "")
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const title = pick("title");
    const link = pick("link");
    if (!title || !link) continue;
    items.push({ title, link, publishedAt: pick("pubDate") || null, excerpt: pick("description") });
  }
  return items;
}

/** Body text from the article container, or a paywall flag. Nav <p> tags stay out. */
export function powerMizzouPage(html: string): { paywall: boolean; text: string } {
  const paywall = /"isAccessibleForFree"\s*:\s*false/i.test(html) || /vip[-_ ]?lock|subscriber-only|class="[^"]*paywall/i.test(html);
  if (paywall) return { paywall: true, text: "" };
  const container =
    html.match(/<(?:div|section)[^>]+class="[^"]*(?:entry-content|article-body|article__body|post-content|c-entry-content)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section)>/i)?.[1] ??
    html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    "";
  const text = [...container.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((part) => part[1]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .filter((part) => part.length > 40)
    .join("\n\n");
  return { paywall: false, text };
}

function hoops(text: string): boolean {
  return /\b(basketball|hoops|dennis gates|mizzou arena)\b/i.test(text);
}

function hashId(link: string): string {
  let h = 0;
  for (let i = 0; i < link.length; i++) h = (h * 33 + link.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function powerMizzouCard(item: PowerItem, body: string | null): GameWrapCard {
  const full = (body ?? "").trim();
  const brief = full.length < BODY_MIN;
  const text = brief ? item.excerpt : full;
  const basketball = hoops(`${item.title} ${text}`);
  return {
    id: `pm-${hashId(item.link)}`,
    favoriteKey: basketball ? "cbb-mizzou" : "cfb-mizzou",
    followed: true,
    teamName: basketball ? "Mizzou BB" : "Mizzou FB",
    teamHref: item.link,
    sportLabel: basketball ? "College Basketball" : "College Football",
    leaguePath: basketball ? "basketball/mens-college-basketball" : "football/college-football",
    headline: item.title,
    dek: item.excerpt.slice(0, 240) || null,
    body: text || null,
    scoreLine: null,
    when: item.publishedAt,
    won: null,
    gameHref: item.link,
    wrapHref: item.link,
    feedUrl: POWERMIZZOU_FEED,
    gameId: null,
    stats: [],
    leaders: [],
    teamStats: [],
    division: [],
    photo: null,
    caption: "PowerMizzou",
    status: brief ? "Brief" : "Story",
  };
}

export function isBriefCard(card: { status?: string | null }): boolean {
  return card.status === "Brief";
}

async function readFeed(): Promise<PowerItem[]> {
  const res = await fetch(POWERMIZZOU_FEED, {
    headers: { Accept: "application/rss+xml, application/xml, text/xml", "User-Agent": UA },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  return parsePowerMizzouFeed(await res.text());
}

async function readPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { Accept: "text/html", "User-Agent": UA },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return "";
  return res.text();
}

/** Titles already filed by the Post-Dispatch and the other Mizzou wires. */
export async function fetchPowerMizzou(takenTitles: string[] = []): Promise<GameWrapCard[]> {
  try {
    const taken = new Set(takenTitles.map(normalizeTitle).filter(Boolean));
    const items = (await readFeed()).filter((item) => !taken.has(normalizeTitle(item.title))).slice(0, POWERMIZZOU_FETCH_CAP);
    const cards: GameWrapCard[] = [];
    for (const item of items) {
      let body = "";
      try {
        const page = powerMizzouPage(await readPage(item.link));
        if (!page.paywall) body = page.text;
      } catch {
        body = "";
      }
      cards.push(powerMizzouCard(item, body));
    }
    return cards;
  } catch {
    return [];
  }
}
