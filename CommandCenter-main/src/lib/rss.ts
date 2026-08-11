import { supabase } from "./supabase";

/** Default Missouri Scout feed (rss.app). */
export const DEFAULT_RSS_FEED = "https://rss.app/feeds/nG7WGKJTs5LOQjxd.xml";

export type RssFeedItem = {
  id: string;
  title: string;
  link: string;
  author: string | null;
  publishedAt: string | null;
  image: string | null;
  snippet: string;
};

export type RssFeed = {
  title: string;
  description: string;
  link: string;
  feedUrl: string;
  items: RssFeedItem[];
};

export type RssArticle = {
  url: string;
  title: string | null;
  byline: string | null;
  image: string | null;
  contentHtml: string;
  contentText: string;
  wordCount: number;
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
