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

/** Keep first occurrence when the same article appears in multiple feeds. */
export function dedupeArticles<T extends Pick<RssFeedItem, "link" | "title">>(items: T[]): T[] {
  const seenUrl = new Set<string>();
  const seenTitle = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const urlKey = articleDedupeKey(item);
    const titleKey = normalizeTitleKey(item.title);
    if (seenUrl.has(urlKey)) continue;
    // Soft-dedupe: identical titles across hosts (same wire story).
    if (titleKey.length >= 24 && seenTitle.has(titleKey)) continue;
    seenUrl.add(urlKey);
    if (titleKey) seenTitle.add(titleKey);
    out.push(item);
  }
  return out;
}

export type RssFilterKind = "phrase" | "url";

export type RssFilter = {
  id: string;
  kind: RssFilterKind;
  value: string;
  createdAt: string;
};

export function articleMatchesFilters(
  item: Pick<RssFeedItem, "link" | "title" | "snippet">,
  filters: RssFilter[],
): boolean {
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
  if (!filters.length) return items;
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
  const userId = await requireUserId();
  const { error } = await supabase.from("rss_reads").upsert(
    {
      user_id: userId,
      article_url: input.articleUrl,
      article_title: input.articleTitle ?? null,
      feed_url: input.feedUrl ?? null,
      read_at: new Date().toISOString(),
    },
    { onConflict: "user_id,article_url" },
  );
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
