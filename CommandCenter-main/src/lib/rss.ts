import { supabase, requireUserId } from "./supabase";

/** Configured feeds — Missouri Scout, STL Today Cardinals, Cardinals wire, game wraps. */
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
  {
    id: "cardinals-wraps",
    title: "Cardinals wraps & previews",
    short: "Wraps",
    url: "synthetic:cardinals-wraps",
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

/** Encode a domain/path block scoped to one feed: `feed:cardinals|stltoday.com`. */
export function encodeFeedDomainFilter(feedId: string, domainOrPath: string): string {
  const cleaned = domainOrPath.replace(/^www\./i, "").replace(/^\/+|\/+$/g, "").toLowerCase();
  return `feed:${feedId}|${cleaned}`;
}

export function parseFeedScopedFilter(value: string): {
  feedId: string | null;
  pattern: string;
} {
  const m = value.trim().match(/^feed:([a-z0-9-]+)\|(.+)$/i);
  if (m) return { feedId: m[1].toLowerCase(), pattern: m[2].trim().toLowerCase() };
  return { feedId: null, pattern: value.trim().toLowerCase() };
}

export function articleMatchesFilters(
  item: Pick<RssFeedItem, "link" | "title" | "snippet"> & { feedId?: string },
  filters: RssFilter[],
  feedId?: string,
): boolean {
  if (isSoccerBleedArticle(item)) return true;
  if (!filters.length) return false;
  const effectiveFeed = (feedId ?? item.feedId)?.toLowerCase() ?? null;
  const hayTitle = item.title.toLowerCase();
  const haySnippet = (item.snippet ?? "").toLowerCase();
  const hayLink = item.link.toLowerCase();
  for (const f of filters) {
    const { feedId: scoped, pattern } = parseFeedScopedFilter(f.value);
    if (!pattern) continue;
    // Feed-scoped rules only apply inside that feed (or unread rows from it).
    if (scoped && scoped !== effectiveFeed) continue;
    if (f.kind === "phrase") {
      if (hayTitle.includes(pattern) || haySnippet.includes(pattern)) return true;
    } else if (f.kind === "url") {
      if (hayLink.includes(pattern)) return true;
    }
  }
  return false;
}

export function applyRssFilters<
  T extends Pick<RssFeedItem, "link" | "title" | "snippet"> & { feedId?: string },
>(items: T[], filters: RssFilter[], feedId?: string): T[] {
  return items.filter((item) => !articleMatchesFilters(item, filters, feedId ?? item.feedId));
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

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function readFunctionsErrorDetail(error: {
  message: string;
  context?: Response;
}): Promise<{ status: number | null; detail: string }> {
  const status =
    error.context && typeof error.context.status === "number" ? error.context.status : null;
  let detail = error.message;
  if (error.context) {
    try {
      const body = (await error.context.clone().json()) as { error?: string };
      if (body?.error) detail = String(body.error);
    } catch {
      // keep generic message
    }
  }
  return { status, detail };
}

async function invokeRss<T>(body: Record<string, string>): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase.functions.invoke("rss", { body });
    if (!error) {
      if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
        throw new Error(String((data as { error: string }).error));
      }
      return data as T;
    }
    const { status, detail } = await readFunctionsErrorDetail(error);
    lastError = new Error(detail);
    // Retry transient gateway / rate-limit failures; skip hard extract failures (422).
    const retryable =
      status === 429 ||
      status === 502 ||
      status === 503 ||
      (status == null && /non-2xx|rate.?limit|timeout/i.test(error.message));
    if (!retryable || attempt === 2) break;
    await sleep(450 * 2 ** attempt);
  }
  throw lastError ?? new Error("RSS request failed");
}

export function fetchRssFeed(feedUrl: string = DEFAULT_RSS_FEED): Promise<RssFeed> {
  if (feedUrl === "synthetic:cardinals-wraps") {
    return fetchCardinalsWrapsFeed();
  }
  return invokeRss<RssFeed>({ mode: "feed", feedUrl });
}

/** Client-side Cardinals game wrap + preview feed (ESPN is reachable from the browser). */
async function fetchCardinalsWrapsFeed(): Promise<RssFeed> {
  const items: RssFeedItem[] = [];
  const seen = new Set<string>();
  const today = new Date();

  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const dateStr = `${y}${m}${day}`;
    try {
      const boardRes = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${dateStr}`,
        { headers: { Accept: "application/json" } },
      );
      if (!boardRes.ok) continue;
      const board = (await boardRes.json()) as {
        events?: {
          id?: string;
          date?: string;
          name?: string;
          shortName?: string;
          competitions?: {
            id?: string;
            status?: { type?: { state?: string; completed?: boolean; name?: string } };
            competitors?: {
              homeAway?: string;
              team?: { id?: string; abbreviation?: string; displayName?: string };
              score?: string;
            }[];
          }[];
          status?: { type?: { state?: string; completed?: boolean; name?: string } };
        }[];
      };

      for (const event of board.events ?? []) {
        const comp = event.competitions?.[0];
        if (!comp) continue;
        const isStl = (comp.competitors ?? []).some(
          (c) => c.team?.abbreviation === "STL" || c.team?.id === "24",
        );
        if (!isStl) continue;
        const status = comp.status?.type ?? event.status?.type;
        const isFinal = status?.state === "post" || status?.completed === true;
        const isPreview =
          status?.state === "pre" ||
          /STATUS_SCHEDULED|STATUS_PRE/i.test(status?.name ?? "");
        if (!isFinal && !isPreview) continue;
        const eventId = event.id ?? comp.id;
        if (!eventId || seen.has(eventId)) continue;
        seen.add(eventId);

        const sumRes = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${eventId}`,
          { headers: { Accept: "application/json" } },
        );
        if (!sumRes.ok) continue;
        const sum = (await sumRes.json()) as {
          article?: {
            headline?: string;
            description?: string;
            story?: string;
            images?: { url?: string }[];
          };
        };
        const article = sum.article;
        const home = (comp.competitors ?? []).find((c) => c.homeAway === "home");
        const away = (comp.competitors ?? []).find((c) => c.homeAway === "away");
        const matchup =
          event.shortName ||
          `${away?.team?.abbreviation ?? "AWAY"} @ ${home?.team?.abbreviation ?? "HOME"}`;
        const publishedAt = event.date || `${y}-${m}-${day}T17:00:00Z`;

        if (isFinal) {
          if (!article?.headline) continue;
          const storyText = (article.story ?? "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          const snippet =
            (article.description ?? "").replace(/^—\s*/, "").trim() ||
            storyText.slice(0, 220);
          items.push({
            id: `wrap-${eventId}`,
            title: article.headline,
            link: `https://www.espn.com/mlb/recap/_/gameId/${eventId}`,
            author: "ESPN",
            publishedAt,
            image: article.images?.[0]?.url ?? null,
            snippet,
          });
        } else {
          // Game preview — use ESPN article when present, else a synthetic preview blurb.
          const headline =
            article?.headline ||
            `Preview: ${matchup}`;
          const storyText = (article?.story ?? "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          const snippet =
            (article?.description ?? "").replace(/^—\s*/, "").trim() ||
            storyText.slice(0, 220) ||
            `Game preview for ${matchup} at ${publishedAt.slice(0, 10)}.`;
          items.push({
            id: `preview-${eventId}`,
            title: article?.headline ? headline : `Preview: ${matchup}`,
            link: `https://www.espn.com/mlb/preview/_/gameId/${eventId}`,
            author: "ESPN",
            publishedAt,
            image: article?.images?.[0]?.url ?? null,
            snippet,
          });
        }
      }
    } catch {
      /* skip day */
    }
  }

  items.sort((a, b) => {
    const da = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const db = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return db - da;
  });

  return {
    title: "Cardinals wraps & previews",
    description: "St. Louis Cardinals game wraps and previews from ESPN",
    link: "https://www.espn.com/mlb/",
    feedUrl: "synthetic:cardinals-wraps",
    items,
  };
}

export function fetchRssArticle(url: string): Promise<RssArticle> {
  return invokeRss<RssArticle>({ mode: "read", url }).catch(async (err) => {
    // Edge IPs often get thin STL Today shells — decrypt in the browser as fallback.
    if (/stltoday\.com/i.test(url)) {
      const local = await extractStlTodayInBrowser(url).catch(() => null);
      if (local) return local;
    }
    throw err;
  });
}

/** Browser-side TownNews unlock for STL Today when the edge extract fails. */
async function extractStlTodayInBrowser(url: string): Promise<RssArticle | null> {
  const res = await fetch(url, {
    headers: { Accept: "text/html" },
    credentials: "omit",
  });
  if (!res.ok) return null;
  const raw = await res.text();
  const decodeEntities = (s: string) =>
    s
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&mdash;/gi, "—")
      .replace(/&rsquo;/gi, "'");
  const decrypt = (s: string) => {
    let out = "";
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      out +=
        c >= 33 && c <= 126 ? String.fromCharCode(33 + ((c - 33 + 47) % 94)) : s[i];
    }
    return out;
  };
  const unlocked = raw.replace(
    /<(p|div|section|span)([^>]*(?:class|data-type)=["'][^"']*encrypted-content[^"']*["'][^>]*)>([\s\S]*?)<\/\1>/gi,
    (_m, tag: string, attrs: string, inner: string) => {
      const decoded = decrypt(decodeEntities(inner));
      const cleanAttrs = String(attrs)
        .replace(/\bencrypted-content\b/g, "")
        .replace(/\bsubscriber-only\b/g, "")
        .replace(/\s*style\s*=\s*"display:\s*none"/gi, "");
      return `<${tag}${cleanAttrs}>${decoded}</${tag}>`;
    },
  );
  const parts: string[] = [];
  const re =
    /<(p|div|blockquote)([^>]*class="[^"]*(?:subscriber-preview|lee-article-text|article-body)[^"]*"[^>]*)>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(unlocked))) {
    const attrs = m[2] || "";
    if (/subscriber-hide|trinity|inline-relcontent/i.test(attrs)) continue;
    if (/subscriber-preview/i.test(attrs) && !/lee-article-text|first-p|article-body/i.test(attrs)) {
      continue;
    }
    const inner = m[3].trim();
    const text = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (text.length < 12) continue;
    parts.push(/^\s*<p[\s>]/i.test(inner) ? inner : `<p>${inner}</p>`);
  }
  if (!parts.length) return null;
  const contentHtml = parts.join("\n");
  const contentText = contentHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (contentText.length < 40) return null;
  const title =
    unlocked.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    null;
  const image =
    unlocked.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    null;
  return {
    url,
    title,
    byline: "Post-Dispatch",
    image,
    contentHtml,
    contentText,
    wordCount: contentText.split(/\s+/).filter(Boolean).length,
  };
}

export function formatFeedDate(raw: string | null): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  // MLB Film Room / video items often publish as midnight UTC calendar labels
  // ("Tue, 11 Aug 2026 00:00:00 GMT"). Formatting in America/Chicago shifts
  // those to the previous evening and shows "yesterday".
  const isMidnightUtc =
    d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
  return d.toLocaleDateString("en-US", {
    timeZone: isMidnightUtc ? "UTC" : "America/Chicago",
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
