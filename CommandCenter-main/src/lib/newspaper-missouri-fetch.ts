import { missouriItemInEdition, pressEdition } from "./newspaper";
import {
  buildMissouriDesk,
  combestUrl,
  feedItemToMo,
  newestPublished,
  parseArticlePublished,
  parseCombest,
  preferArticleDate,
  type MissouriDesk,
  type MoItem,
} from "./newspaper-missouri";
import { stripGettyCredit, truncateAtSentence } from "./newspaper-copy";
import { pickBestStoryImage, srcsetCandidates } from "./newspaper-images.ts";
import { fetchRssArticle, fetchRssFeed, type RssFeedItem } from "./rss";

export const MOSCOUT_NATIVE_FEED = "https://moscout.com/daily-updates-1?format=rss";
export const MOSCOUT_FEED = "https://rss.app/feeds/nG7WGKJTs5LOQjxd.xml";
const COMBEST_FEED = "https://johncombest.com/feed/";
const WIRES: { url: string; source: string }[] = [
  { url: "https://missouriindependent.com/feed/", source: "Missouri Independent" },
  { url: "https://www.missourinet.com/feed/", source: "Missourinet" },
];

function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function fresh(iso: string | null, hours: number): boolean {
  if (!iso) return true;
  const t = Date.parse(iso);
  return Number.isNaN(t) || Date.now() - t < hours * 3_600_000;
}

/** rss.app sends CORS headers, so the browser can read the Scout feed without the edge. */
async function directFeed(url: string): Promise<RssFeedItem[]> {
  const res = await fetch(url, { headers: { Accept: "application/rss+xml, text/xml" } });
  if (!res.ok) throw new Error(`feed ${res.status}`);
  const doc = new DOMParser().parseFromString(await res.text(), "text/xml");
  return [...doc.querySelectorAll("item")].map((el, i) => {
    const pick = (sel: string) => el.getElementsByTagName(sel)[0]?.textContent?.trim() ?? "";
    const desc = pick("description");
    const candidates: { url: string; width: number | null }[] = [];
    const take = (node: Element | undefined) => {
      const href = node?.getAttribute("url");
      if (!href) return;
      const width = Number(node?.getAttribute("width") || 0);
      candidates.push({ url: href, width: width > 0 ? width : null });
    };
    for (const name of ["media:content", "media:thumbnail"]) {
      for (const node of el.getElementsByTagName(name)) take(node);
    }
    take(el.getElementsByTagName("enclosure")[0]);
    const inline = desc.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
    if (inline) candidates.push({ url: inline, width: null });
    for (const srcset of desc.matchAll(/\bsrcset=["']([^"']+)["']/gi)) {
      candidates.push(...srcsetCandidates(srcset[1]));
    }
    return {
      id: pick("guid") || `${url}-${i}`,
      title: pick("title"),
      link: pick("link"),
      author: pick("dc:creator") || null,
      publishedAt: pick("pubDate") || null,
      image: pickBestStoryImage(candidates),
      snippet: desc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 600),
    };
  });
}

async function feedItems(url: string): Promise<RssFeedItem[]> {
  try {
    const feed = await fetchRssFeed(url);
    if (feed.items?.length) return feed.items;
  } catch {
    /* the browser may still reach it directly */
  }
  try {
    return await directFeed(url);
  } catch {
    return [];
  }
}

export async function fetchMissouriScout(pressId?: string): Promise<MoItem | null> {
  const native = await feedItems(MOSCOUT_NATIVE_FEED);
  const items = native.length ? native : await feedItems(MOSCOUT_FEED);
  const latest = newestPublished(items.filter((item) => item.link));
  if (!latest?.link) return null;
  const edition = pressId ?? pressEdition().id;
  if (!missouriItemInEdition(latest.publishedAt, edition)) return null;
  const item = feedItemToMo(latest, "Missouri Scout");
  return { ...item, headline: item.headline.replace(/^MOScout Daily Update:\s*/i, "") };
}

async function combestLinks(day: string): Promise<MoItem[]> {
  const candidates: string[] = [];
  const posts = await feedItems(COMBEST_FEED);
  const post = posts.find((p) => /political news headlines/i.test(p.title) && fresh(p.publishedAt, 40));
  if (post?.link) candidates.push(post.link);
  candidates.push(combestUrl(day), combestUrl(shiftDay(day, -1)));
  for (const url of [...new Set(candidates)]) {
    try {
      const article = await fetchRssArticle(url);
      const links = parseCombest(article.contentHtml ?? "");
      if (links.length >= 3) return links;
    } catch {
      /* today's post may not be up yet */
    }
  }
  return [];
}

async function wireItems(): Promise<MoItem[]> {
  const lists = await Promise.all(
    WIRES.map(async (w) =>
      (await feedItems(w.url))
        .filter((i) => i.link && fresh(i.publishedAt, 36))
        .slice(0, 12)
        .map((i) => feedItemToMo(i, w.source)),
    ),
  );
  return lists.flat();
}

export async function fetchMissouriDesk(day: string, pressId?: string): Promise<MissouriDesk> {
  const [combest, wires, scout] = await Promise.all([
    combestLinks(day),
    wireItems(),
    fetchMissouriScout(pressId).catch(() => null),
  ]);
  return buildMissouriDesk({ combest, wires, scout });
}

/** Lead art and copy for the top of the desk, through Dispatch's reader extract. */
export async function enrichMissouriItems(items: MoItem[], count = 6): Promise<MoItem[]> {
  const head = items.slice(0, count);
  const enriched = await Promise.all(
    head.map(async (item) => {
      const feedAge = item.when ? Date.now() - Date.parse(item.when) : 0;
      const staleStamp = Number.isFinite(feedAge) && feedAge > 14 * 86_400_000;
      if (item.photo && item.dek && !staleStamp) return item;
      try {
        const article = await fetchRssArticle(item.url);
        const text = truncateAtSentence(stripGettyCredit((article.contentText ?? "").replace(/\s+/g, " ").trim()), 320);
        const published = parseArticlePublished(article.contentHtml ?? "");
        return {
          ...item,
          photo: pickBestStoryImage([item.photo, article.image]),
          dek: item.dek ?? (text || null),
          when: preferArticleDate(item.when, published),
        };
      } catch {
        return item;
      }
    }),
  );
  return [...enriched, ...items.slice(count)];
}
