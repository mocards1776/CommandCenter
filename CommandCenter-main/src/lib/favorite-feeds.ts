/** Favorite Dispatch feeds — localStorage, per browser. */

const KEY = "dispatch-favorite-feeds";

export function loadFavoriteFeedIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export function saveFavoriteFeedIds(ids: string[]): void {
  window.localStorage.setItem(KEY, JSON.stringify([...new Set(ids)]));
}

export function isFavoriteFeed(feedId: string): boolean {
  return loadFavoriteFeedIds().includes(feedId);
}

export function toggleFavoriteFeed(feedId: string): boolean {
  const cur = loadFavoriteFeedIds();
  const next = cur.includes(feedId) ? cur.filter((id) => id !== feedId) : [...cur, feedId];
  saveFavoriteFeedIds(next);
  return next.includes(feedId);
}
