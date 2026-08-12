import { supabase, requireUserId } from "./supabase";

/** Configured feeds — Missouri Scout, STL Today Cardinals, Cardinals wire. */
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

export type RssFilterKind = "phrase" | "url";

export type RssFilter = {
  id: string;
  kind: RssFilterKind;
  value: string;
  createdAt: string;
};

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

export function articleMatchesFilters(
  item: Pick<RssFeedItem, "link" | "title" | "snippet">,
  filters: RssFilter[],
): boolean {
  if (isSoccerBleedArticle(item)) return true;
  if (!filters.length) return false;
  const hayTitle = item.title.toLowerCase();
  const haySnippet = (item.snippet ?? "").toLowerCase();
  const hayLink = item.link.toLowerCase();
  for (const f of filters) {
    const v = f.value.trim().toLowerCase();
    if (!v) continue;
    if (f.kind === "phrase") {
      if (hayTitle.includes(v) || haySnippet.includes(v)) return true;
    } else if (f.kind === "url") {
      if (hayLink.includes(v)) return true;
    }
  }
  return false;
}

export function applyRssFilters<T extends Pick<RssFeedItem, "link" | "title" | "snippet">>(
  items: T[],
  filters: RssFilter[],
): T[] {
  return items.filter((item) => !articleMatchesFilters(item, filters));
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
  quoteText: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

async function invokeRss<T>(body: Record<string, string>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("rss", { body });
  if (error) throw new Error(error.message);
  if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
    throw new Error(String((data as { error: string }).error));
  }
  return data as T;
}

export function fetchRssFeed(feedUrl: string = DEFAULT_RSS_FEED): Promise<RssFeed> {
  return invokeRss<RssFeed>({ mode: "feed", feedUrl });
}

export function fetchRssArticle(url: string): Promise<RssArticle> {
  return invokeRss<RssArticle>({ mode: "read", url });
}

export function formatFeedDate(raw: string | null): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
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
