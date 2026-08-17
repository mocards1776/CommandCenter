/** User-added Dispatch RSS feeds — localStorage, per browser. */

import type { RssFeedDef } from "./rss";

const KEY = "dispatch-custom-feeds-v1";

export type CustomRssFeed = RssFeedDef & {
  createdAt: string;
};

function isFeedDef(x: unknown): x is CustomRssFeed {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.title === "string" &&
    typeof o.short === "string" &&
    typeof o.url === "string" &&
    /^https?:\/\//i.test(o.url)
  );
}

export function loadCustomFeeds(): CustomRssFeed[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isFeedDef);
  } catch {
    return [];
  }
}

export function saveCustomFeeds(feeds: CustomRssFeed[]): void {
  window.localStorage.setItem(KEY, JSON.stringify(feeds));
}

export function addCustomFeed(input: {
  title: string;
  url: string;
}): CustomRssFeed {
  const title = input.title.trim();
  const url = input.url.trim();
  if (title.length < 2) throw new Error("Give the feed a name");
  if (!/^https?:\/\//i.test(url)) throw new Error("Feed URL must start with http(s)://");
  if (/^synthetic:/i.test(url)) throw new Error("Use a real RSS/Atom URL");

  const existing = loadCustomFeeds();
  if (existing.some((f) => f.url === url)) {
    throw new Error("That feed URL is already added");
  }

  const short =
    title.length <= 18 ? title : `${title.slice(0, 16).trimEnd()}…`;
  const feed: CustomRssFeed = {
    id: `custom:${crypto.randomUUID().slice(0, 10)}`,
    title,
    short,
    url,
    createdAt: new Date().toISOString(),
  };
  saveCustomFeeds([feed, ...existing]);
  return feed;
}

export function removeCustomFeed(feedId: string): void {
  saveCustomFeeds(loadCustomFeeds().filter((f) => f.id !== feedId));
}

export function findCustomFeed(feedId: string): CustomRssFeed | undefined {
  return loadCustomFeeds().find((f) => f.id === feedId);
}
