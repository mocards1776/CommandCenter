import { supabase, requireUserId } from "./supabase";
import { formatCentralDateTime, parsePublishedAt } from "./utils";

export type RssFeedDef = {
  id: string;
  title: string;
  short: string;
  url: string;
};

/** Configured feeds — Missouri Scout, STL Today Cardinals, Cardinals wire, game wraps. */
export const RSS_FEEDS: readonly RssFeedDef[] = [
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
    short: "STL wraps",
    url: "synthetic:cardinals-wraps",
  },
  {
    id: "mlb-wraps",
    title: "MLB wraps & previews",
    short: "MLB wraps",
    url: "synthetic:mlb-wraps",
  },
  {
    id: "nfl-wraps",
    title: "NFL wraps & previews",
    short: "NFL wraps",
    url: "synthetic:nfl-wraps",
  },
  {
    id: "mlb-stats",
    title: "MLB standings & leaders",
    short: "MLB boards",
    url: "synthetic:mlb-stats",
  },
  {
    id: "mlb-form",
    title: "MLB form standings",
    short: "Form",
    url: "synthetic:mlb-form",
  },
  {
    id: "cardinals-farm",
    title: "Cardinals farm wraps",
    short: "Farm",
    url: "synthetic:cardinals-farm",
  },
  {
    id: "cardinals-savant",
    title: "Cardinals Baseball Savant",
    short: "Savant",
    url: "synthetic:cardinals-savant",
  },
  {
    id: "soccer-clubs-wraps",
    title: "Wrexham, Wolves & Arsenal wraps",
    short: "Clubs",
    url: "synthetic:soccer-clubs-wraps",
  },
  {
    id: "epl-wraps",
    title: "Premier League wraps & previews",
    short: "EPL wraps",
    url: "synthetic:epl-wraps",
  },
];

export type RssFeedId = string;

/** Sidebar folders — left/middle opens a combined feed; chevron expands children. */
export type RssFeedFolder = {
  id: string;
  title: string;
  feedIds: readonly string[];
};

export const RSS_FEED_FOLDERS: readonly RssFeedFolder[] = [
  {
    id: "folder:cardinals",
    title: "Cardinals",
    feedIds: [
      "cardinals",
      "cardinals-wire",
      "cardinals-wraps",
      "cardinals-farm",
      "cardinals-savant",
    ],
  },
  {
    id: "folder:mlb",
    title: "MLB",
    feedIds: ["mlb-wraps", "mlb-stats", "mlb-form"],
  },
  {
    id: "folder:nfl",
    title: "NFL",
    feedIds: ["nfl-wraps"],
  },
  {
    id: "folder:soccer",
    title: "Soccer",
    feedIds: ["soccer-clubs-wraps", "epl-wraps"],
  },
  {
    id: "folder:scout",
    title: "Missouri Scout",
    feedIds: ["moscout"],
  },
];

export function isFeedFolderId(id: string): boolean {
  return id.startsWith("folder:");
}

export function feedIdsForFolder(folderId: string): string[] {
  if (folderId === "folder:tags") return [];
  const folder = RSS_FEED_FOLDERS.find((f) => f.id === folderId);
  return folder ? [...folder.feedIds] : [];
}

export function isTagFeedId(id: string): boolean {
  return id.startsWith("tag:");
}

export function parsePlayerArticleLink(link: string): number | null {
  const m = /^app:mlb-player\/(\d+)(?:[?#].*)?$/.exec(link);
  return m ? Number(m[1]) : null;
}

export function parseMlbGameArticleLink(link: string): number | null {
  const app = /^app:mlb-game\/(\d+)$/.exec(link);
  if (app) return Number(app[1]);
  const path = /\/sports\/mlb\/game\/(\d+)/.exec(link);
  return path ? Number(path[1]) : null;
}

export const DEFAULT_RSS_FEED = RSS_FEEDS[0].url;

export type RssFeedItem = {
  id: string;
  title: string;
  link: string;
  author: string | null;
  publishedAt: string | null;
  image: string | null;
  snippet: string;
  /** Prebuilt reader HTML for synthetic digests (skips edge extract). */
  contentHtml?: string;
  /** MLB team ids for logo fallbacks when the story image is missing (wraps). */
  logoTeamIds?: number[];
  /** NFL (or other) ESPN logo abbrevs when MLB ids are unavailable. */
  logoAbbrevs?: string[];
  /** ESPN soccer team ids for logo fallbacks. */
  logoSoccerIds?: string[];
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
    // ESPN recap/preview/game/match for the same event are one story.
    const espnGame =
      path.match(/\/(?:mlb|nfl)\/(?:recap|preview|game)\/_\/gameid\/(\d+)/i) ||
      path.match(/\/soccer\/(?:match|recap|preview)\/_\/gameid\/(\d+)/i) ||
      item.link.match(/[?&]gameId=(\d+)/i) ||
      item.link.match(/gameId\/(\d+)/i);
    if (espnGame?.[1] && (host === "espn.com" || host.endsWith(".espn.com") || host.includes("espn."))) {
      const sport = /\/soccer\//i.test(path) || /espn\.com\/soccer/i.test(item.link)
        ? "soccer"
        : /\/nfl\//i.test(path) || /espn\.com\/nfl/i.test(item.link)
          ? "nfl"
          : "mlb";
      return `espn-game:${sport}:${espnGame[1]}`;
    }
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

const PUBLISHER_BY_HOST: { test: RegExp; label: string }[] = [
  { test: /nytimes|theathletic|athletic\.com/i, label: "The Athletic" },
  { test: /espn\.com/i, label: "ESPN" },
  { test: /mlb\.com/i, label: "MLB" },
  { test: /stltoday|post-dispatch/i, label: "STL Today" },
  { test: /beehiiv\.com/i, label: "Beehiiv" },
  { test: /fox2|ktvi|foxsports/i, label: "FOX" },
  { test: /yahoo/i, label: "Yahoo" },
  { test: /cbssports|cbs\.com/i, label: "CBS Sports" },
  { test: /si\.com|sportsillustrated/i, label: "SI" },
  { test: /bleacherreport/i, label: "B/R" },
  { test: /rotowire/i, label: "RotoWire" },
  { test: /rotoworld/i, label: "RotoWorld" },
  { test: /heavy\.com/i, label: "Heavy" },
  { test: /nbcsports|nbc\.com/i, label: "NBC Sports" },
];

/** Publisher label for an article URL (not the feed folder title). */
export function articlePublisherLabel(
  link: string | null | undefined,
  fallback?: string | null,
): string {
  if (link && /nbcsports\.com\/fantasy\/baseball\/player-news/i.test(link)) {
    return "RotoWorld";
  }
  const host = link ? articleSourceHost(link) : null;
  if (host) {
    for (const row of PUBLISHER_BY_HOST) {
      if (row.test.test(host)) return row.label;
    }
  }
  const fb = (fallback ?? "").trim();
  if (fb && !/^dispatch$/i.test(fb)) return fb;
  if (host) {
    const base = host.split(".")[0] ?? host;
    return base.charAt(0).toUpperCase() + base.slice(1);
  }
  return "Article";
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
  if (setA.size < 4 || setB.size < 4) {
    // Same-game recap shells: "Cubs 3-0 Cardinals Game Recap" vs feature writeups.
    if (sameGameRecapTitles(a, b)) return true;
    return false;
  }
  let inter = 0;
  for (const w of setA) if (setB.has(w)) inter++;
  const union = setA.size + setB.size - inter;
  if (union <= 0) return false;
  const jaccard = inter / union;
  const coverage = inter / Math.min(setA.size, setB.size);
  // Box-score / game-recap headlines need stronger overlap so ESPN
  // "Cards 2-0 Phillies Game Recap" doesn't eat a feature writeup —
  // unless both clearly name the same final scoreline.
  if (sameGameRecapTitles(a, b)) return true;
  const recapish = /game recap|box score|final score|\b\d+\s*[-–]\s*\d+\b/i.test(`${a} ${b}`);
  if (recapish) return jaccard >= 0.55 && inter >= 5;
  return (jaccard >= 0.45 && inter >= 4) || coverage >= 0.7;
}

const TEAM_TITLE_TOKENS = [
  "cubs",
  "cardinals",
  "cards",
  "redbirds",
  "yankees",
  "mets",
  "red sox",
  "sox",
  "dodgers",
  "giants",
  "padres",
  "rockies",
  "diamondbacks",
  "dbacks",
  "braves",
  "phillies",
  "phils",
  "nationals",
  "marlins",
  "pirates",
  "brewers",
  "reds",
  "astros",
  "rangers",
  "athletics",
  "mariners",
  "angels",
  "twins",
  "guardians",
  "tigers",
  "royals",
  "white sox",
  "orioles",
  "rays",
  "blue jays",
  "jays",
  "broncos",
  "falcons",
  "bears",
  "packers",
  "vikings",
  "lions",
  "chiefs",
  "raiders",
  "chargers",
  "rams",
  "49ers",
  "seahawks",
  "cardinals",
  "cowboys",
  "eagles",
  "giants",
  "commanders",
  "buccaneers",
  "saints",
  "panthers",
  "falcons",
  "jets",
  "patriots",
  "bills",
  "dolphins",
  "bengals",
  "browns",
  "steelers",
  "ravens",
  "texans",
  "colts",
  "jaguars",
  "titans",
];

/** Detect two headlines about the same final scoreline (even if one is a feature). */
export function sameGameRecapTitles(a: string, b: string): boolean {
  const scoreRe = /(\d{1,2})\s*[-–]\s*(\d{1,2})/;
  const sa = a.match(scoreRe);
  const sb = b.match(scoreRe);
  const na = normalizeTitleKey(a);
  const nb = normalizeTitleKey(b);
  const teamsA = TEAM_TITLE_TOKENS.filter((t) => na.includes(t));
  const teamsB = TEAM_TITLE_TOKENS.filter((t) => nb.includes(t));
  const shared = teamsA.filter((t) => teamsB.includes(t));
  const uniqShared = [...new Set(shared)];

  if (sa && sb) {
    const scoresMatch =
      (sa[1] === sb[1] && sa[2] === sb[2]) || (sa[1] === sb[2] && sa[2] === sb[1]);
    if (!scoresMatch) return false;
    if (uniqShared.length < 1) return false;
    return /game recap|final|wins?|beat|defeat|blank|shutout|walk.?off|\bvs\.?\b|\bat\b/i.test(
      `${a} ${b}`,
    );
  }

  // ESPN "Team A X-Y Team B Game Recap" vs a feature about the same matchup.
  const aRecap = /game recap/i.test(a);
  const bRecap = /game recap/i.test(b);
  if (!(aRecap || bRecap)) return false;
  if (!(sa || sb)) return false;
  // Prefer two shared team tokens; allow one when both titles name the same club heavily.
  return uniqShared.length >= 2 || (uniqShared.length >= 1 && teamsA.length + teamsB.length >= 3);
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
      // Distinct player-note links (e.g. RotoWire vs RotoWorld) never soft-hide each other.
      if (
        item.link.startsWith("app:mlb-player/") &&
        k.link.startsWith("app:mlb-player/") &&
        item.link !== k.link
      ) {
        return false;
      }
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

export type RssFilterKind = "phrase" | "url" | "content";

export type RssFilter = {
  id: string;
  kind: RssFilterKind;
  value: string;
  createdAt: string;
};

/**
 * Always scrubbed from article bodies (MLB newsletter / signup chrome).
 * Matched case-insensitively against normalized element text.
 */
export const DEFAULT_CONTENT_HIDES = [
  "get the latest from mlb",
  "get the latest from mlb sign up",
  "get the latest from mlb signup",
  "morning lineup",
  "mlb morning lineup",
  "see aps full mlb coverage here",
  "see ap s full mlb coverage here",
  "see aps full mlb coverage",
  "full mlb coverage here",
  "share on x",
  "share on x opens in new window",
  "opens in new window",
  "email a link to a friend",
  "email a link to a friend opens in new window",
  "sports mlb chicago cubs",
  "sports mlb cubs",
  "sportsmlbcubschicago cubs",
  "sportsmlbcubs",
  "sports mlbchicago cubs",
  "the associated press created this story using technology provided by data skrive",
  "created this story using technology provided by data skrive",
  "data from sportradar",
  "most popular",
] as const;

/** Collect user content-hide phrases plus built-in MLB clutter patterns. */
export function contentHidePhrases(filters: RssFilter[]): string[] {
  const out = new Set<string>();
  for (const p of DEFAULT_CONTENT_HIDES) out.add(normalizeHideText(p));
  for (const f of filters) {
    if (f.kind !== "content") continue;
    const v = normalizeHideText(f.value);
    if (v.length >= 3) out.add(v);
  }
  return [...out].sort((a, b) => b.length - a.length);
}

const BLOCK_TAGS = new Set([
  "P",
  "DIV",
  "FIGURE",
  "SECTION",
  "ASIDE",
  "BLOCKQUOTE",
  "LI",
  "ARTICLE",
  "HEADER",
  "FOOTER",
  "TABLE",
  "UL",
  "OL",
  "NAV",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
]);

/** Collapse whitespace/punctuation so split MLB promo copy still matches. */
export function normalizeHideText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u00a0\u2000-\u200b\u202f\u205f\u3000]/g, " ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickPromoBlock(start: Element, root: Element): Element | null {
  let el: Element | null = start;
  let block: Element | null = null;
  while (el && el !== root) {
    if (BLOCK_TAGS.has(el.tagName)) {
      block = el;
      const parentEl: Element | null = el.parentElement;
      const parentText = normalizeHideText(parentEl?.textContent ?? "");
      if (
        parentEl &&
        parentEl !== root &&
        BLOCK_TAGS.has(parentEl.tagName) &&
        parentText.length > 0 &&
        parentText.length < 480
      ) {
        el = parentEl;
        continue;
      }
      break;
    }
    el = el.parentElement;
  }
  return block;
}

/** Prefer the smallest element that fully contains the hide phrase. */
function pickHideTarget(start: Element, root: Element, needle: string): Element | null {
  let el: Element | null = start;
  let best: Element | null = null;
  while (el && el !== root) {
    const text = normalizeHideText(el.textContent ?? "");
    if (text.includes(needle)) {
      best = el;
      // Allow climbing further for short chrome (share/breadcrumb) so the
      // whole list item / nav crumb is removed, not just a child <a>.
      const parent = el.parentElement;
      if (parent && parent !== root) {
        const parentText = normalizeHideText(parent.textContent ?? "");
        const chrome =
          parentText.length <= Math.max(needle.length + 120, 220) ||
          /share on|opens in new window|email a link|sports ?mlb/i.test(parentText);
        if (!chrome && parentText.length > Math.max(needle.length + 80, 320)) break;
      }
    }
    el = el.parentElement;
  }
  if (best && BLOCK_TAGS.has(best.tagName)) return best;
  return best ? pickPromoBlock(best, root) ?? best : null;
}

/**
 * Remove in-article clutter blocks whose text matches hide phrases.
 * Prefer removing the nearest block ancestor so signup chrome collapses
 * (no empty reserved space). Also drops bare "Follow" links.
 */
export function hidePhrasesInHtml(html: string, phrases: string[]): string {
  if (!html || typeof DOMParser === "undefined") return html;
  const needles = [
    ...new Set(phrases.map((p) => normalizeHideText(p)).filter((p) => p.length >= 3)),
  ];

  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, "text/html");
  const root = doc.getElementById("root");
  if (!root) return html;

  const matchesPhrase = (text: string) => {
    const t = normalizeHideText(text);
    if (!t) return false;
    return needles.some((n) => t.includes(n));
  };

  const matchingNeedle = (text: string) => {
    const t = normalizeHideText(text);
    if (!t) return null;
    return needles.find((n) => t.includes(n)) ?? null;
  };

  const toRemove = new Set<Element>();

  // 1) Text-node hits (user highlight / partial copy).
  if (needles.length) {
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const value = node.nodeValue ?? "";
      const needle = matchingNeedle(value);
      if (needle && node.parentElement) {
        const target = pickHideTarget(node.parentElement, root, needle);
        if (target) {
          toRemove.add(target);
        } else if (normalizeHideText(value).length <= needle.length + 48) {
          // Phrase is the whole text node inside a longer story block — drop it.
          node.nodeValue = "";
        }
      }
      node = walker.nextNode();
    }

    // 2) Inline / anchor hits — AP promo footers are often a lone <a> in a long column.
    root.querySelectorAll("a, span, em, strong, small").forEach((el) => {
      const text = normalizeHideText(el.textContent ?? "");
      if (!text || text.length > 240) return;
      const needle = matchingNeedle(text);
      if (!needle) return;
      // Only remove when the element is mostly the promo phrase.
      if (text.length > needle.length + 48) return;
      toRemove.add(el);
    });

    // 3) Block-level scan — catches promo copy split across nested spans/links.
    root.querySelectorAll([...BLOCK_TAGS].map((t) => t.toLowerCase()).join(",")).forEach((el) => {
      const text = normalizeHideText(el.textContent ?? "");
      if (!text || text.length > 480) return;
      if (!matchesPhrase(text)) return;
      const block = pickPromoBlock(el, root) ?? el;
      toRemove.add(block);
    });
  }

  // 3) Bare social "Follow" links (and their tiny wrappers).
  root.querySelectorAll("a").forEach((a) => {
    const label = normalizeHideText(a.textContent ?? "");
    if (label !== "follow") return;
    const parent = a.parentElement;
    if (
      parent &&
      parent !== root &&
      BLOCK_TAGS.has(parent.tagName) &&
      normalizeHideText(parent.textContent ?? "") === "follow"
    ) {
      toRemove.add(parent);
    } else {
      toRemove.add(a);
    }
  });

  // 4) Built-in share / breadcrumb chrome even before a user hide is saved.
  root.querySelectorAll("a, li, p, nav, span").forEach((el) => {
    const text = normalizeHideText(el.textContent ?? "");
    if (!text || text.length > 180) return;
    if (
      /^(?:share on x|share on twitter|email a link to a friend)(?: opens in new window)?(?: x| email)?$/.test(
        text,
      ) ||
      /^opens in new window$/.test(text) ||
      /^sports ?mlb ?[a-z ]{0,40}$/.test(text) ||
      /^sportsmlb/.test(text.replace(/\s+/g, ""))
    ) {
      const block = pickPromoBlock(el, root) ?? el;
      toRemove.add(block);
    }
  });

  for (const el of toRemove) {
    if (!el.isConnected) continue;
    const prev = el.previousElementSibling;
    const next = el.nextElementSibling;
    el.remove();
    for (const sib of [prev, next]) {
      if (!sib || !sib.isConnected) continue;
      const t = normalizeHideText(sib.textContent ?? "");
      const onlyMedia =
        !t && Boolean(sib.querySelector("img,svg")) && !sib.querySelector("p,li,table,video");
      const empty =
        !t && !sib.querySelector("img,video,iframe,table,svg");
      if (empty || onlyMedia) sib.remove();
    }
  }

  // Collapse leftover empty paragraphs/divs created by cleanup.
  root.querySelectorAll("p,div").forEach((el) => {
    if (
      !el.textContent?.replace(/\s+/g, "").trim() &&
      !el.querySelector("img,video,iframe,table,br,svg")
    ) {
      el.remove();
    }
  });

  return root.innerHTML;
}

/**
 * Client-side pass for leftover newspaper chrome the edge extract missed:
 * mashed breadcrumbs ("SportsMLBCubs"), share intents, empty placeholders.
 */
export function scrubReaderChrome(html: string): string {
  if (!html || typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, "text/html");
  const root = doc.getElementById("root");
  if (!root) return html;

  const kill = new Set<Element>();
  root.querySelectorAll("a, li, p, nav, span, div").forEach((el) => {
    const raw = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    const text = normalizeHideText(raw);
    if (!text || text.length > 200) return;
    if (
      /share on (?:x|twitter|facebook|linkedin)/i.test(raw) ||
      /opens in new window/i.test(raw) ||
      /email a link to a friend/i.test(raw) ||
      /^most popular$/i.test(raw) ||
      /^latest video$/i.test(raw) ||
      /^sports\s*mlb\s*/i.test(raw.replace(/\s+/g, "")) ||
      /^sportsmlb/i.test(text.replace(/\s+/g, "")) ||
      /^(?:facebook|twitter|bluesky|whatsapp|sms|email|print|copy link|save|close|log in)$/i.test(
        raw,
      ) ||
      // Bare URL chrome, or Pre-Gamin / game-thread title with a glued URL.
      /^https?:\/\/\S+$/i.test(raw) ||
      (/https?:\/\/\S+/i.test(raw) &&
        /pre-?gamin|game\s*thread|lineups?,?\s*broadcast/i.test(raw))
    ) {
      kill.add(el);
    }
  });

  // Silhouette / empty placeholder images with no useful src.
  root.querySelectorAll("img").forEach((img) => {
    const src = (img.getAttribute("src") ?? "").toLowerCase();
    const alt = (img.getAttribute("alt") ?? "").toLowerCase();
    if (
      !src ||
      src.startsWith("data:image/svg") ||
      /placeholder|default[-_]user|avatar[-_]empty|silhouette|1x1\./i.test(src) ||
      (/placeholder|default/.test(alt) && img.naturalWidth === 0)
    ) {
      const fig = img.closest("figure, picture, p, div");
      if (fig && normalizeHideText(fig.textContent ?? "").length < 40) kill.add(fig);
      else kill.add(img);
    }
  });

  for (const el of kill) {
    if (el.isConnected) el.remove();
  }

  return hidePhrasesInHtml(root.innerHTML, [...DEFAULT_CONTENT_HIDES]);
}

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

/**
 * STL Today posts that are video-first with little or no readable article text.
 */
export function isStlTodayVideoOnlyArticle(
  item: Pick<RssFeedItem, "link" | "title" | "snippet">,
): boolean {
  let host = "";
  try {
    host = new URL(item.link).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    if (!/stltoday\.com/i.test(item.link)) return false;
    host = "stltoday.com";
  }
  if (host !== "stltoday.com") return false;

  const link = item.link.toLowerCase();
  const hay = `${item.title} ${item.snippet ?? ""}`.toLowerCase();

  if (/\/video(?:\/|$|\?)/.test(link)) return true;
  if (/^video:/i.test(item.title.trim())) return true;
  if (/\blatest video\b/.test(hay)) return true;
  if (/\bwatch(?:ing)?\b/.test(hay) && /\bvideo\b/.test(hay) && hay.length < 140) return true;
  return false;
}

/**
 * Non-Cardinals STL Today bleed — prep/high-school and other local sports.
 */
export function isStlTodayOffTopicArticle(
  item: Pick<RssFeedItem, "link" | "title" | "snippet">,
): boolean {
  let link = item.link.toLowerCase();
  try {
    link = new URL(item.link).pathname.toLowerCase() + new URL(item.link).search.toLowerCase();
  } catch {
    /* keep raw link */
  }
  if (!/stltoday\.com/i.test(item.link)) return false;

  if (
    /\/sports\/(?:prep|high-school|highschool|stlhighschool)/.test(link) ||
    /stlhighschoolsports\.com/.test(link) ||
    /[?&]section=(?:prep|high-school|soccer)\b/.test(link)
  ) {
    return true;
  }

  const hay = `${item.title} ${item.snippet ?? ""}`.toLowerCase();
  if (/\bhigh school\b/.test(hay) && !/\bcardinals?\b/.test(hay)) return true;
  if (/\bboys?\s+soccer\b|\bgirls?\s+soccer\b/.test(hay) && !/\bcardinals?\b/.test(hay)) {
    return true;
  }
  return false;
}

/**
 * MLB Film Room / clip pages (`/video/…`), not written mlb.com news.
 * Cardinals Wire syndicates these heavily; we hide them only in that feed.
 */
export function isMlbFilmRoomArticle(item: Pick<RssFeedItem, "link" | "title">): boolean {
  try {
    const u = new URL(item.link);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "mlb.com" && !host.endsWith(".mlb.com")) return false;
    // /video/slug or /cardinals/video/slug — not /news/…
    return /(?:^|\/)video(?:\/|$)/i.test(u.pathname);
  } catch {
    return /mlb\.com\/(?:[a-z-]+\/)?video\//i.test(item.link);
  }
}

/**
 * AP / Data Skrive / Sportradar auto-wires (e.g. "rookie makes history with 3 HRs").
 * Drop from Wire / Cardinals folder — not real reporting.
 */
export function isDataSkriveArticle(
  item: Pick<RssFeedItem, "link" | "title" | "snippet"> & { author?: string | null },
): boolean {
  const hay = `${item.title} ${item.snippet ?? ""} ${item.author ?? ""} ${item.link}`.toLowerCase();
  if (/data[\s-]?skrive|sportradar/.test(hay)) return true;
  if (/associated press created this story/i.test(hay)) return true;
  // FanDuel / DraftKings auto game-update stubs.
  if (/fanduel\.com\/research\/mlb\/player-news\/game-updates/i.test(item.link)) return true;
  // Classic Skrive headline templates on ESPN / AP wires.
  if (
    /\bmakes history with\b/i.test(item.title) ||
    /\bsets (?:an )?mlb record\b/i.test(item.title) ||
    /\bsets a(?:n)? (?:mlb|major league) record\b/i.test(item.title)
  ) {
    return true;
  }
  return false;
}

/** Strip a trailing URL accidentally glued onto a title (Bleacher Nation etc.). */
export function cleanArticleTitle(title: string | null | undefined): string {
  if (!title) return "";
  return title
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\s*\|\s*STLtoday\.com.*$/i, "")
    .replace(/\s*\|\s*St\.?\s*Louis Post-Dispatch.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

const GENERIC_ARTICLE_TITLES =
  /^(?:cardinals|st\.?\s*louis cardinals|mlb|sports|news|video|latest)$/i;

/**
 * Prefer the RSS list title when the extracted page title is generic or truncated
 * (common on STL Today og:title and paywall shells).
 */
export function resolveArticleTitle(
  extracted: string | null | undefined,
  feedTitle: string | null | undefined,
): string {
  const feed = cleanArticleTitle(feedTitle);
  const ext = cleanArticleTitle(extracted);
  if (!ext) return feed;
  if (!feed) return ext;
  if (GENERIC_ARTICLE_TITLES.test(ext)) return feed;
  const extLower = ext.toLowerCase();
  const feedLower = feed.toLowerCase();
  if (feed.length > ext.length + 6 && feedLower.startsWith(extLower)) return feed;
  // Truncated mid-word ("Orioles didn" vs full headline).
  if (
    feed.length > ext.length + 4 &&
    feedLower.startsWith(extLower) &&
    !/[.!?:;"'\u2019\u201d]$/.test(ext)
  ) {
    return feed;
  }
  return ext.length >= feed.length ? ext : feed;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Decode common HTML entities so saved quotes can match article markup. */
export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#0*39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&rsquo;/gi, "\u2019")
    .replace(/&lsquo;/gi, "\u2018")
    .replace(/&rdquo;/gi, "\u201D")
    .replace(/&ldquo;/gi, "\u201C")
    .replace(/&mdash;/gi, "\u2014")
    .replace(/&ndash;/gi, "\u2013")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => {
      try {
        return String.fromCodePoint(parseInt(h, 16));
      } catch {
        return "";
      }
    })
    .replace(/&#(\d+);/g, (_, n: string) => {
      try {
        return String.fromCodePoint(Number(n));
      } catch {
        return "";
      }
    });
}

/** Collapse whitespace the same way selection capture does. */
export function normalizeHighlightQuote(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Build a regex that matches a saved quote across ordinary HTML whitespace. */
function quoteMatchPattern(quote: string): RegExp | null {
  const normalized = normalizeHighlightQuote(quote);
  if (normalized.length < 2) return null;
  const parts = normalized
    .split(" ")
    .map((word) =>
      escapeRegExp(word)
        // Treat curly / straight quotes as equivalent in the article body.
        .replace(/'/g, "['\u2018\u2019]")
        .replace(/"/g, '["\u201C\u201D]'),
    )
    .filter(Boolean);
  if (!parts.length) return null;
  return new RegExp(parts.join("\\s+"), "gi");
}

/**
 * Wrap saved highlight quotes in `<mark class="rss-hl">` inside article HTML.
 * Matches across tags (e.g. player links) by searching decoded plain text and
 * projecting ranges back onto the original markup.
 */
export function markQuotesInHtml(html: string, quotes: string[]): string {
  const needles = [...new Set(quotes.map(normalizeHighlightQuote).filter((q) => q.length >= 2))].sort(
    (a, b) => b.length - a.length,
  );
  if (!html || !needles.length) return html;

  type Piece = { kind: "tag" | "text"; raw: string };
  const pieces: Piece[] = html.split(/(<[^>]+>)/g).filter(Boolean).map((raw) => ({
    kind: raw.startsWith("<") ? "tag" : "text",
    // Decode text nodes up front so plain offsets stay 1:1 with piece contents.
    raw: raw.startsWith("<") ? raw : decodeHtmlEntities(raw),
  }));

  type MapEntry = { pieceIndex: number; start: number; end: number };
  const map: MapEntry[] = [];
  let plain = "";
  pieces.forEach((piece, pieceIndex) => {
    if (piece.kind !== "text") return;
    const start = plain.length;
    plain += piece.raw;
    map.push({ pieceIndex, start, end: plain.length });
  });
  if (!plain) return html;

  type Range = { start: number; end: number };
  const ranges: Range[] = [];
  for (const needle of needles) {
    const re = quoteMatchPattern(needle);
    if (!re) continue;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(plain)) != null) {
      const start = m.index;
      const end = start + m[0].length;
      if (!ranges.some((r) => start < r.end && end > r.start)) ranges.push({ start, end });
      if (m[0].length === 0) re.lastIndex += 1;
    }
  }
  if (!ranges.length) return html;

  // Wrap each text piece independently so marks never straddle real tags
  // (`<a>…</a>`). Adjacent marks still read as one highlight visually.
  for (const entry of map) {
    const piece = pieces[entry.pieceIndex]!;
    const local = piece.raw;
    const locals = ranges
      .map((r) => ({
        start: Math.max(0, r.start - entry.start),
        end: Math.min(local.length, r.end - entry.start),
      }))
      .filter((r) => r.end > r.start)
      .sort((a, b) => b.start - a.start);
    if (!locals.length) continue;
    let out = local;
    for (const r of locals) {
      out =
        out.slice(0, r.start) +
        `<mark class="rss-hl">${out.slice(r.start, r.end)}</mark>` +
        out.slice(r.end);
    }
    piece.raw = out;
  }

  return pieces.map((p) => p.raw).join("");
}

/** Remove previously painted highlight marks (DOM path). */
export function clearRssHighlights(root: Element | null | undefined): void {
  if (!root) return;
  root.querySelectorAll("mark.rss-hl").forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  });
}

/**
 * Paint a saved quote into a live DOM tree (handles player links / nested tags).
 * Returns true when at least one range was wrapped.
 */
export function paintQuoteInElement(root: Element, quote: string): boolean {
  if (typeof document === "undefined") return false;
  const needle = normalizeHighlightQuote(quote);
  const re = quoteMatchPattern(needle);
  if (!re) return false;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = (node as Text).parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest("mark.rss-hl, script, style")) return NodeFilter.FILTER_REJECT;
      if (!(node.nodeValue ?? "").trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) nodes.push(current as Text);
  if (!nodes.length) return false;

  type MapEntry = { node: Text; start: number; end: number };
  const map: MapEntry[] = [];
  let hay = "";
  for (const node of nodes) {
    const start = hay.length;
    hay += node.nodeValue ?? "";
    map.push({ node, start, end: hay.length });
  }

  re.lastIndex = 0;
  const match = re.exec(hay);
  if (!match) return false;
  const matchStart = match.index;
  const matchEnd = matchStart + match[0].length;

  // Wrap from the end so earlier offsets stay valid.
  for (let i = map.length - 1; i >= 0; i--) {
    const entry = map[i]!;
    if (entry.end <= matchStart || entry.start >= matchEnd) continue;
    const localStart = Math.max(0, matchStart - entry.start);
    const localEnd = Math.min(entry.node.nodeValue?.length ?? 0, matchEnd - entry.start);
    if (localEnd <= localStart) continue;

    const text = entry.node.nodeValue ?? "";
    const before = text.slice(0, localStart);
    const mid = text.slice(localStart, localEnd);
    const after = text.slice(localEnd);
    const mark = document.createElement("mark");
    mark.className = "rss-hl";
    mark.textContent = mid;

    const parent = entry.node.parentNode;
    if (!parent) continue;
    const frag = document.createDocumentFragment();
    if (before) frag.appendChild(document.createTextNode(before));
    frag.appendChild(mark);
    if (after) frag.appendChild(document.createTextNode(after));
    parent.replaceChild(frag, entry.node);
  }
  return true;
}

/** Clear + paint all quotes into a reader root. */
export function paintQuotesInElement(root: Element | null | undefined, quotes: string[]): void {
  if (!root) return;
  clearRssHighlights(root);
  const unique = [...new Set(quotes.map(normalizeHighlightQuote).filter((q) => q.length >= 2))].sort(
    (a, b) => b.length - a.length,
  );
  for (const q of unique) paintQuoteInElement(root, q);
}

/** Split plain text into highlighted / plain segments for React title rendering. */
export function splitTextByQuotes(
  text: string,
  quotes: string[],
): { text: string; highlighted: boolean }[] {
  const patterns = [...new Set(quotes.map(normalizeHighlightQuote).filter((q) => q.length >= 2))]
    .sort((a, b) => b.length - a.length)
    .map(quoteMatchPattern)
    .filter((re): re is RegExp => Boolean(re));
  if (!text || !patterns.length) return [{ text, highlighted: false }];

  type Hit = { start: number; end: number };
  const hits: Hit[] = [];
  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) != null) {
      const start = m.index;
      const end = start + m[0].length;
      if (!hits.some((h) => start < h.end && end > h.start)) {
        hits.push({ start, end });
      }
      if (m[0].length === 0) re.lastIndex += 1;
    }
  }
  hits.sort((a, b) => a.start - b.start);
  if (!hits.length) return [{ text, highlighted: false }];

  const parts: { text: string; highlighted: boolean }[] = [];
  let cursor = 0;
  for (const hit of hits) {
    if (hit.start > cursor) {
      parts.push({ text: text.slice(cursor, hit.start), highlighted: false });
    }
    parts.push({ text: text.slice(hit.start, hit.end), highlighted: true });
    cursor = hit.end;
  }
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), highlighted: false });
  }
  return parts;
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
  const effectiveFeed = (feedId ?? item.feedId)?.toLowerCase() ?? null;
  // Soccer bleed is for news wires only — never strip dedicated soccer wrap feeds.
  const isWrapFeed =
    effectiveFeed === "soccer-clubs-wraps" ||
    effectiveFeed === "epl-wraps" ||
    effectiveFeed === "mlb-wraps" ||
    effectiveFeed === "nfl-wraps" ||
    effectiveFeed === "cardinals-wraps" ||
    effectiveFeed === "cardinals-farm";
  if (!isWrapFeed && isSoccerBleedArticle(item)) return true;
  if (
    (effectiveFeed === "cardinals" || effectiveFeed === "folder:cardinals") &&
    isStlTodayOffTopicArticle(item)
  ) {
    return true;
  }
  if (
    (effectiveFeed === "cardinals" || effectiveFeed === "folder:cardinals") &&
    isStlTodayVideoOnlyArticle(item)
  ) {
    return true;
  }
  // Wire-only: drop MLB Film Room clips; keep mlb.com/news and other hosts.
  if (effectiveFeed === "cardinals-wire" && isMlbFilmRoomArticle(item)) return true;
  // Auto-generated AP / Data Skrive wires + FanDuel game stubs (news wires only).
  if (
    (effectiveFeed === "cardinals-wire" ||
      effectiveFeed === "cardinals" ||
      effectiveFeed === "folder:cardinals") &&
    isDataSkriveArticle(item)
  ) {
    return true;
  }
  // Cardinals folder feeds: drop league filler that never mentions the club.
  if (
    (effectiveFeed === "cardinals-wire" ||
      effectiveFeed === "cardinals" ||
      effectiveFeed === "folder:cardinals") &&
    !articleMentionsCardinals(item)
  ) {
    return true;
  }
  if (!filters.length) return false;
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
  articleImage: string | null;
  quoteText: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

/** Human source label for a highlight/feed URL. Prefer publisher hosts over feed titles. */
export function feedSourceLabel(feedUrl: string | null | undefined): string {
  if (!feedUrl) return "Article";
  if (/^https?:/i.test(feedUrl)) {
    const pub = articlePublisherLabel(feedUrl);
    if (pub !== "Article") return pub;
  }
  const hit = RSS_FEEDS.find((f) => f.url === feedUrl);
  if (hit) return hit.short || hit.title;
  if (typeof window !== "undefined") {
    try {
      // Lazy require pattern avoided — sync localStorage lookup via dynamic function.
      const stored = window.localStorage.getItem("dispatch-custom-feeds-v1");
      if (stored) {
        const parsed = JSON.parse(stored) as { url?: string; short?: string; title?: string }[];
        const custom = parsed.find((f) => f.url === feedUrl);
        if (custom) return custom.short || custom.title || "Custom feed";
      }
    } catch {
      /* ignore */
    }
  }
  try {
    const host = new URL(feedUrl).hostname.replace(/^www\./, "");
    return articlePublisherLabel(`https://${host}/`);
  } catch {
    return "Article";
  }
}

/** True when title/snippet clearly references the Cardinals. */
export function articleMentionsCardinals(
  item: Pick<RssFeedItem, "title" | "snippet" | "link">,
): boolean {
  const text = `${item.title} ${item.snippet ?? ""}`.toLowerCase();
  if (
    /cardinals?\b|redbirds?\b|st\.?\s*louis\s+cardinals\b|\bstl\s+cardinals\b/.test(text)
  ) {
    return true;
  }
  if (/\bvs\.?\s+(?:stl|cardinals)\b|\b(?:stl|cardinals)\s+vs\.?\b/.test(text)) return true;

  const link = (item.link ?? "").toLowerCase();
  if (!link) return false;
  // MLB / wire URLs — not bare stltoday.com (covers all St. Louis sports).
  if (/teamid=138\b|mlb\.com\/cardinals\b|\/cardinals(?:\/|$|\?)/.test(link)) {
    if (/stltoday\.com/i.test(link) && !/\/sports\/(?:mlb\/)?cardinals\b/.test(link)) {
      return false;
    }
    return true;
  }
  return false;
}

/** Drop league-wide RotoWire templates that aren't about this player. */
export function isPlayerSpecificNewsNote(
  note: {
    headline?: string | null;
    story?: string | null;
    description?: string | null;
  },
  playerName: string,
): boolean {
  const headline = (note.headline ?? "").trim();
  const body = `${note.story ?? ""} ${note.description ?? ""}`.trim();
  const hay = `${headline} ${body}`.toLowerCase();
  if (!hay.trim()) return false;

  const parts = playerName.trim().split(/\s+/).filter(Boolean);
  const last = parts[parts.length - 1]?.toLowerCase() ?? "";
  if (!last || last.length < 2) return true;

  const generic =
    /fantasy baseball forecaster|team hitting ratings|team pitching ratings|starting lineup advice|waiver wire pick|daily fantasy|dfs pick|weekly outlook|matchup ratings|pitching ratings update|hitting ratings update/i;
  if (generic.test(hay) && !hay.includes(last)) return false;

  if (headline && !headline.toLowerCase().includes(last)) return false;
  return true;
}

function normalizeImgKeyClient(src: string): string {
  try {
    const u = new URL(src, "https://example.invalid");
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    // Drop size/query noise so CDN variants still match.
    const bare = path.replace(/\/(?:w_|w=)\d+/g, "").replace(/_\d+x\d+/g, "");
    return `${host}${bare}`;
  } catch {
    return src.split("?")[0]!.toLowerCase();
  }
}

/** Remove duplicate &lt;img&gt; tags (same asset twice, or matching the hero). */
export function stripDuplicateContentImages(
  html: string,
  heroImage?: string | null,
): string {
  if (!html || typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, "text/html");
  const root = doc.getElementById("root");
  if (!root) return html;
  const seen = new Set<string>();
  if (heroImage) seen.add(normalizeImgKeyClient(heroImage));
  root.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src") || "";
    if (!src) {
      img.remove();
      return;
    }
    const key = normalizeImgKeyClient(src);
    if (seen.has(key)) {
      const fig = img.closest("figure");
      (fig ?? img).remove();
      return;
    }
    seen.add(key);
  });
  return root.innerHTML;
}

/** First usable content image URL from article HTML. */
export function firstContentImageUrl(html: string | null | undefined): string | null {
  if (!html || typeof DOMParser === "undefined") return null;
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, "text/html");
  const root = doc.getElementById("root");
  if (!root) return null;
  for (const img of root.querySelectorAll("img")) {
    // Tiny standings / leaderboard / results-card logos must not become the article hero.
    if (
      img.classList.contains("mlb-standings-logo") ||
      img.classList.contains("mlb-results-logo") ||
      img.classList.contains("mlb-results-mug") ||
      img.closest(".mlb-standings-table, .mlb-standings-feed, .mlb-leader-card") ||
      img.closest(".mlb-results-card, .mlb-results-feed")
    ) {
      continue;
    }
    const src = img.getAttribute("src") || "";
    if (/^https?:/i.test(src) && scoreImageUrl(src) > 0) return src;
  }
  return null;
}

/** Score image URLs so blur/LQIP placeholders lose to the real asset. */
function scoreImageUrl(raw: string): number {
  const u = raw.toLowerCase();
  if (!u || u.startsWith("data:")) return -1000;
  let score = 10;
  if (/(?:blur|lqip|placeholder|spacer|pixel|transparent|1x1|dummy|default-image|fallback|no-image|missing)/i.test(u)) {
    score -= 80;
  }
  if (/[?&](?:w|width|h|height)=(?:[1-9]|[1-9]\d|1\d\d)(?:&|$)/i.test(u)) score -= 40;
  if (/\/(?:w_|w=|h_)(?:[1-9]|[1-9]\d|1\d\d)(?:\/|,|$)/i.test(u)) score -= 35;
  if (/graytv|gray\.media|lee\.net|mosaic/i.test(u)) score += 12;
  if (/[?&](?:w|width)=(?:[5-9]\d{2}|\d{4,})(?:&|$)/i.test(u)) score += 40;
  if (/\/(?:w_|w=)(?:[5-9]\d{2}|\d{4,})(?:\/|,|$)/i.test(u)) score += 35;
  if (/\.(?:jpe?g|png|webp)(?:$|\?)/i.test(u)) score += 8;
  if (/mlbstatic|mlbinfra|espncdn|cloudinary|imgix|wp\.com|twimg/i.test(u)) score += 6;
  score += Math.min(raw.length / 40, 12);
  return score;
}

function largestFromSrcset(srcset: string): string | null {
  let best: string | null = null;
  let bestW = -1;
  for (const part of srcset.split(",")) {
    const bits = part.trim().split(/\s+/);
    const url = bits[0];
    if (!url) continue;
    const wMark = bits.find((b) => /^\d+w$/i.test(b));
    const w = wMark ? Number(wMark.replace(/\D/g, "")) : 0;
    if (w > bestW) {
      bestW = w;
      best = url;
    } else if (best == null) {
      best = url;
    }
  }
  return best;
}

function absolutizeImgUrl(src: string, base: URL | null): string {
  let out = src.trim();
  if (out.startsWith("//")) out = `https:${out}`;
  if (out.startsWith("/") && base) {
    try {
      out = new URL(out, base).toString();
    } catch {
      /* keep */
    }
  }
  return out;
}

/** Fix lazy/relative secondary images in reader HTML. */
export function repairRssContentImages(html: string, pageUrl?: string | null): string {
  if (!html || typeof DOMParser === "undefined") return html;
  let base: URL | null = null;
  try {
    if (pageUrl) base = new URL(pageUrl);
  } catch {
    base = null;
  }
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, "text/html");
  const root = doc.getElementById("root");
  if (!root) return html;

  // Promote <picture><source srcset> into the nested img when needed.
  root.querySelectorAll("picture").forEach((pic) => {
    const img = pic.querySelector("img");
    if (!img) return;
    const sources = [...pic.querySelectorAll("source")];
    for (const source of sources) {
      const ss = source.getAttribute("srcset") || source.getAttribute("data-srcset");
      if (!ss) continue;
      const large = largestFromSrcset(ss);
      if (large) {
        img.setAttribute("data-srcset-promoted", large);
        break;
      }
    }
  });

  root.querySelectorAll("img").forEach((img) => {
    const attrs = img as HTMLImageElement;
    const candidates = [
      attrs.getAttribute("data-src"),
      attrs.getAttribute("data-lazy-src"),
      attrs.getAttribute("data-lazy"),
      attrs.getAttribute("nitro-lazy-src"),
      attrs.getAttribute("data-original"),
      attrs.getAttribute("data-url"),
      attrs.getAttribute("data-image"),
      attrs.getAttribute("data-img-url"),
      attrs.getAttribute("data-hero-image"),
      attrs.getAttribute("data-src-mobile"),
      attrs.getAttribute("data-srcset-promoted"),
      attrs.getAttribute("src"),
    ].filter(Boolean) as string[];
    const srcset = attrs.getAttribute("srcset") || attrs.getAttribute("data-srcset");
    if (srcset) {
      const large = largestFromSrcset(srcset);
      if (large) candidates.unshift(large);
    }
    const ranked = candidates
      .map((c) => absolutizeImgUrl(c, base))
      .filter((c) => /^https?:/i.test(c) && !/^data:image\/svg/i.test(c))
      .sort((a, b) => scoreImageUrl(b) - scoreImageUrl(a));
    const src = ranked[0] ?? "";
    if (src) {
      attrs.setAttribute("src", src);
      attrs.removeAttribute("srcset");
      attrs.removeAttribute("data-srcset");
      attrs.removeAttribute("data-srcset-promoted");
      attrs.loading = "lazy";
      // Some CDNs block no-referrer; prefer origin when loading inline.
      attrs.referrerPolicy = "no-referrer-when-downgrade";
    }
  });

  return root.innerHTML;
}

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
  // MLB + Cardinals wraps are built+cached on the rss edge (15-min cron warms them
  // even when Dispatch is closed). Client still polls while open for faster pickup.
  if (feedUrl === "synthetic:cardinals-wraps" || feedUrl === "synthetic:mlb-wraps") {
    return invokeRss<RssFeed>({ mode: "feed", feedUrl });
  }
  if (feedUrl === "synthetic:nfl-wraps") {
    return fetchEspnWrapsFeed({
      feedUrl,
      title: "NFL wraps & previews",
      description: "League-wide NFL game wraps and previews from ESPN",
      sportPath: "football/nfl",
      linkSport: "nfl",
      days: 14,
      maxItems: 48,
      preferFinals: true,
      includeLive: true,
      // Preseason often lags on recap copy — still surface finals with a score stub.
      stubWithoutArticle: true,
    });
  }
  if (feedUrl === "synthetic:soccer-clubs-wraps") {
    // Wrexham (Championship) + Wolves / Arsenal (PL) — pull both league scoreboards.
    return fetchMergedEspnWrapsFeeds(
      [
        {
          feedUrl,
          title: "Wrexham, Wolves & Arsenal wraps",
          description: "Wrexham, Wolverhampton, and Arsenal game wraps and previews from ESPN",
          sportPath: "soccer/eng.2",
          linkSport: "soccer",
          teamFilters: [
            { espnId: "352", abbrev: "WXM" },
            { espnId: "380", abbrev: "WOL" },
            { espnId: "359", abbrev: "ARS" },
          ],
          days: 21,
          maxItems: 40,
          preferFinals: true,
          stubWithoutArticle: true,
          lookAheadDays: 1,
        },
        {
          feedUrl,
          title: "Wrexham, Wolves & Arsenal wraps",
          description: "Wrexham, Wolverhampton, and Arsenal game wraps and previews from ESPN",
          sportPath: "soccer/eng.1",
          linkSport: "soccer",
          teamFilters: [
            { espnId: "352", abbrev: "WXM" },
            { espnId: "380", abbrev: "WOL" },
            { espnId: "359", abbrev: "ARS" },
          ],
          days: 14,
          maxItems: 40,
          preferFinals: true,
          stubWithoutArticle: true,
          lookAheadDays: 1,
        },
      ],
      {
        title: "Wrexham, Wolves & Arsenal wraps",
        description: "Wrexham, Wolverhampton, and Arsenal game wraps and previews from ESPN",
        feedUrl,
        link: "https://www.espn.com/soccer/",
      },
    );
  }
  if (feedUrl === "synthetic:epl-wraps") {
    return fetchEspnWrapsFeed({
      feedUrl,
      title: "Premier League wraps & previews",
      description: "Premier League game wraps and previews from ESPN",
      sportPath: "soccer/eng.1",
      linkSport: "soccer",
      // Same rules as MLB wraps: short window, finals + today's previews.
      days: 5,
      maxItems: 48,
      preferFinals: true,
      stubWithoutArticle: true,
      lookAheadDays: 1,
    });
  }
  if (feedUrl === "synthetic:mlb-stats") {
    return fetchMlbStatsDigestFeed();
  }
  if (feedUrl === "synthetic:mlb-form") {
    return fetchMlbFormStandingsFeed();
  }
  if (feedUrl === "synthetic:cardinals-farm") {
    return fetchCardinalsFarmWrapsFeed();
  }
  if (feedUrl === "synthetic:cardinals-savant") {
    return fetchCardinalsSavantFeed();
  }
  if (feedUrl.startsWith("synthetic:tag:")) {
    return fetchTagPlayerFeed(feedUrl);
  }
  return invokeRss<RssFeed>({ mode: "feed", feedUrl });
}

/** Dispatch feed of tagged players who have RotoWire / RotoWorld notes — opens as player page. */
export async function fetchTagPlayerFeed(feedUrl: string): Promise<RssFeed> {
  const { fetchPlayersWithTag, normalizeTag, parseTagFeedUrl, displayPlayerTag } =
    await import("./sports-player-tags");
  const {
    fetchMlbPeopleByIds,
    fetchPlayerBrief,
    mlbHeadshot,
    playerNewsSourceLabel,
    fetchRotoWorldNews,
    mergeRotoWorldBoard,
    rotoworldPlayerMatch,
  } = await import("./mlb");

  const tag = parseTagFeedUrl(feedUrl) ?? normalizeTag(feedUrl.replace(/^synthetic:tag:/, ""));
  const label = displayPlayerTag(tag) || `#${tag}`;
  const rows = await fetchPlayersWithTag(tag);
  const people = await fetchMlbPeopleByIds(rows.map((r) => r.playerId));
  const rotoWorldBoard = await fetchRotoWorldNews().catch(() => []);

  const items: RssFeedItem[] = [];
  const seenLinks = new Set<string>();
  // Cap concurrency — brief lookups hit the sports edge function.
  const queue = rows.slice(0, 24);
  await Promise.all(
    queue.map(async (row) => {
      const id = Number(row.playerId);
      const person = people.get(id);
      const name = person?.name ?? `Player #${row.playerId}`;
      let brief = await fetchPlayerBrief(name).catch(() => null);
      if (brief) {
        brief = mergeRotoWorldBoard(brief, rotoWorldBoard);
      } else {
        const boardMatches = rotoWorldBoard.filter((item) => {
          const itemName = (
            item.name ?? [item.firstName, item.lastName].filter(Boolean).join(" ")
          ).trim();
          return itemName && rotoworldPlayerMatch(itemName, name);
        });
        if (boardMatches.length) {
          brief = {
            source: "rotoworld",
            name,
            espnId: null,
            headline: boardMatches[0].headline ?? null,
            story: boardMatches[0].story ?? null,
            description: boardMatches[0].description ?? null,
            published: boardMatches[0].published ?? null,
            news: [],
            url: boardMatches[0].url ?? null,
            notes: boardMatches.map((m) => ({
              source: m.source || "rotoworld",
              headline: m.headline ?? null,
              story: m.story ?? null,
              description: m.description ?? null,
              published: m.published ?? null,
              url: m.url ?? null,
            })),
          };
        }
      }
      const notes =
        brief?.notes?.length
          ? brief.notes
          : brief?.headline || brief?.story
            ? [
                {
                  source: brief.source || "rotowire",
                  headline: brief.headline,
                  story: brief.story,
                  description: brief.description,
                  published: brief.published,
                  url: brief.url,
                },
              ]
            : [];
      if (!notes.length && !(brief?.news?.length)) return;

      const entries =
        notes.length > 0
          ? notes
          : [
              {
                source: "rotowire",
                headline: brief?.news?.[0]?.headline ?? null,
                story: brief?.news?.[0]?.description ?? null,
                description: brief?.news?.[0]?.description ?? null,
                published: brief?.published ?? null,
                url: brief?.url ?? null,
              },
            ];

      for (const note of entries) {
        if (!isPlayerSpecificNewsNote(note, name)) continue;
        const headline = note.headline || "Player news update";
        const story = note.story || note.description || "";
        // Missing publish date → treat as fresh (now) instead of skipping.
        const publishedAt = note.published || new Date().toISOString();
        // Only surface notes posted on/after the player was tagged (when we
        // actually have a real publish date to compare against).
        if (note.published && row.createdAt) {
          const pubDate = parsePublishedAt(note.published);
          const tagged = Date.parse(row.createdAt);
          const pub = pubDate?.getTime() ?? Date.parse(note.published);
          if (Number.isFinite(pub) && Number.isFinite(tagged) && pub < tagged) continue;
        }
        const sourceLabel = playerNewsSourceLabel(note.source);
        const link = `app:mlb-player/${id}?n=${encodeURIComponent(`${note.source}-${publishedAt}`)}`;
        if (seenLinks.has(link)) continue;
        seenLinks.add(link);
        items.push({
          id: `tag-${tag}-${id}-${note.source}-${publishedAt}`,
          title: `${name}: ${headline}`,
          link,
          author: sourceLabel,
          publishedAt,
          image: mlbHeadshot(id, 426),
          snippet: story.slice(0, 280),
          contentHtml: "",
        });
      }
    }),
  );

  items.sort((a, b) => {
    const da = parsePublishedAt(a.publishedAt)?.getTime() ?? 0;
    const db = parsePublishedAt(b.publishedAt)?.getTime() ?? 0;
    return db - da;
  });

  return {
    title: `${label} · Player news`,
    description: `Player pages for ${label} when RotoWire or RotoWorld posts a note`,
    link: feedUrl,
    feedUrl,
    items,
  };
}

/** Merge multiple ESPN wrap feeds (dedupe by link/id) — used for multi-league club boards. */
async function fetchMergedEspnWrapsFeeds(
  optsList: EspnWrapsOpts[],
  meta: { title: string; description: string; feedUrl: string; link: string },
): Promise<RssFeed> {
  const feeds = await Promise.all(optsList.map((o) => fetchEspnWrapsFeed(o)));
  const seen = new Set<string>();
  const items: RssFeedItem[] = [];
  for (const feed of feeds) {
    for (const item of feed.items) {
      const key = item.link || item.id;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
  }
  items.sort((a, b) => {
    const da = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const db = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return db - da;
  });
  return {
    title: meta.title,
    description: meta.description,
    link: meta.link,
    feedUrl: meta.feedUrl,
    items: items.slice(0, 48),
  };
}

type EspnWrapsOpts = {
  feedUrl: string;
  title: string;
  description: string;
  /** ESPN site path, e.g. baseball/mlb or football/nfl or soccer/eng.1 */
  sportPath?: string;
  /** Link slug under espn.com — mlb, nfl, or soccer */
  linkSport?: "mlb" | "nfl" | "soccer";
  teamFilter?: { espnId: string; abbrev: string };
  /** Multi-club filter (OR). Takes precedence over teamFilter when set. */
  teamFilters?: { espnId: string; abbrev: string }[];
  days?: number;
  maxItems?: number;
  preferFinals?: boolean;
  /** Include in-progress games (useful for sparse NFL slates). */
  includeLive?: boolean;
  /** Emit score/matchup stubs when ESPN has no article (NFL preseason / soccer). */
  stubWithoutArticle?: boolean;
  /** Extra upcoming days to include (defaults to 7 for team feeds, 0 league-wide). */
  lookAheadDays?: number;
};

const ESPN_ABBREV_TO_MLB_ID: Record<string, number> = {
  LAA: 108,
  ANA: 108,
  AZ: 109,
  ARI: 109,
  BAL: 110,
  BOS: 111,
  CHC: 112,
  CIN: 113,
  CLE: 114,
  COL: 115,
  DET: 116,
  HOU: 117,
  KC: 118,
  KCR: 118,
  LAD: 119,
  LA: 119,
  WSH: 120,
  WAS: 120,
  NYM: 121,
  ATH: 133,
  OAK: 133,
  PIT: 134,
  SD: 135,
  SDP: 135,
  SEA: 136,
  SF: 137,
  SFG: 137,
  STL: 138,
  TB: 139,
  TBR: 139,
  TAM: 139,
  TEX: 140,
  TOR: 141,
  MIN: 142,
  PHI: 143,
  ATL: 144,
  CWS: 145,
  CHW: 145,
  MIA: 146,
  FLA: 146,
  NYY: 147,
  MIL: 158,
};

function mlbIdsFromEspnAbbrevs(abbrevs: (string | null | undefined)[]): number[] {
  const out: number[] = [];
  for (const a of abbrevs) {
    if (!a) continue;
    const id = ESPN_ABBREV_TO_MLB_ID[a.toUpperCase()];
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** ESPN `article.links` is sometimes an array of `{href}`, sometimes `{ web: { href } }`. */
function espnArticleLinkHref(
  links: { href?: string }[] | { web?: { href?: string } } | undefined,
): string | null {
  if (!links) return null;
  if (Array.isArray(links)) {
    return links.find((l) => /espn\.com/i.test(l.href ?? ""))?.href ?? links[0]?.href ?? null;
  }
  return links.web?.href ?? null;
}

/** ESPN site JSON for wraps — `site.web.api` first (more reliable from some edges), then
 * `site.api`, then sports-edge proxy. For `summary` endpoints, keep checking hosts and
 * prefer whichever response carries the longer `article.story` (ESPN sometimes serves a
 * fuller story from one host and a stub from the other) — return early once story ≥200 chars.
 * Kept local to rss.ts (do not import sports.ts — that pulls mlb and can stall the feed). */
async function espnSiteJson(path: string): Promise<unknown | null> {
  const clean = path.replace(/^\/+/, "");
  const hosts = [
    "https://site.web.api.espn.com/apis/site/v2/sports",
    "https://site.api.espn.com/apis/site/v2/sports",
  ];
  const isSummary = /\/summary(?:[/?]|$)/.test(clean);
  let best: unknown | null = null;
  let bestStoryLen = -1;
  for (const host of hosts) {
    try {
      const ctl = new AbortController();
      const timer = window.setTimeout(() => ctl.abort(), 12_000);
      try {
        const res = await fetch(`${host}/${clean}`, {
          headers: { Accept: "application/json" },
          signal: ctl.signal,
        });
        if (!res.ok) continue;
        const data = await res.json();
        if (!data || typeof data !== "object") continue;
        if (!isSummary) return data;
        const storyLen = stripHtmlTags(
          (data as { article?: { story?: string } }).article?.story ?? "",
        ).length;
        if (storyLen > bestStoryLen) {
          best = data;
          bestStoryLen = storyLen;
        }
        if (bestStoryLen >= 200) return best;
      } finally {
        window.clearTimeout(timer);
      }
    } catch {
      /* try next host */
    }
  }
  if (best) return best;

  try {
    const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (!base || !key) return null;
    const ctl = new AbortController();
    const timer = window.setTimeout(() => ctl.abort(), 20_000);
    try {
      const res = await fetch(`${base}/functions/v1/sports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          apikey: key,
        },
        body: JSON.stringify({ path: clean }),
        signal: ctl.signal,
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data && typeof data === "object" && !(data as { error?: string }).error) {
        return data;
      }
    } finally {
      window.clearTimeout(timer);
    }
  } catch {
    /* give up */
  }
  return null;
}

/** Client-side ESPN game wrap + preview feed (reachable from the browser). */
async function fetchEspnWrapsFeed(opts: EspnWrapsOpts): Promise<RssFeed> {
  const days = opts.days ?? 7;
  const maxItems = opts.maxItems ?? 40;
  const sportPath = opts.sportPath ?? "baseball/mlb";
  const linkSport = opts.linkSport ?? "mlb";
  const items: RssFeedItem[] = [];
  const seen = new Set<string>();
  const today = new Date();
  const hasTeamFilter = Boolean(opts.teamFilters?.length || opts.teamFilter);
  const lookAheadDays = opts.lookAheadDays ?? (hasTeamFilter ? 7 : 0);
  const candidates: {
    eventId: string;
    dateStr: string;
    y: number;
    m: string;
    day: string;
    event: {
      id?: string;
      date?: string;
      shortName?: string;
      competitions?: {
        id?: string;
        status?: { type?: { state?: string; completed?: boolean; name?: string } };
        competitors?: {
          homeAway?: string;
          team?: { id?: string; abbreviation?: string; displayName?: string; shortDisplayName?: string };
          score?: string | number;
          records?: { type?: string; summary?: string }[];
          probables?: { athlete?: { displayName?: string; shortName?: string } }[];
        }[];
      }[];
      status?: { type?: { state?: string; completed?: boolean; name?: string } };
    };
    isFinal: boolean;
    isPreview: boolean;
    isLive: boolean;
  }[] = [];

  // Past `days` (incl. today) plus optional look-ahead for team-filtered club feeds.
  for (let i = -lookAheadDays; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const dateStr = `${y}${m}${day}`;
    try {
      const board = (await espnSiteJson(
        `${sportPath}/scoreboard?dates=${dateStr}`,
      )) as {
        events?: (typeof candidates)[number]["event"][];
        error?: string;
      } | null;
      if (!board || board.error) continue;

      for (const event of board.events ?? []) {
        const comp = event.competitions?.[0];
        if (!comp) continue;
        if (opts.teamFilters?.length || opts.teamFilter) {
          const filters = opts.teamFilters?.length
            ? opts.teamFilters
            : opts.teamFilter
              ? [opts.teamFilter]
              : [];
          const hit = (comp.competitors ?? []).some((c) =>
            filters.some(
              (f) =>
                c.team?.abbreviation === f.abbrev || c.team?.id === f.espnId,
            ),
          );
          if (!hit) continue;
        }
        const status = comp.status?.type ?? event.status?.type;
        const isFinal = status?.state === "post" || status?.completed === true;
        const isPreview =
          status?.state === "pre" ||
          /STATUS_SCHEDULED|STATUS_PRE/i.test(status?.name ?? "");
        const isLive = status?.state === "in" || (!isFinal && !isPreview);
        if (!isFinal && !isPreview && !(opts.includeLive && isLive)) continue;
        // League-wide: skip future/past-day previews except today (preferFinals).
        // Team-filtered: allow upcoming previews (i < 0), still skip past-day previews.
        if (opts.preferFinals && isPreview) {
          if (hasTeamFilter) {
            if (i > 0) continue;
          } else if (i > 0) {
            continue;
          }
        }
        const eventId = event.id ?? comp.id;
        if (!eventId || seen.has(eventId)) continue;
        seen.add(eventId);
        candidates.push({ eventId, dateStr, y, m, day, event, isFinal, isPreview, isLive });
      }
    } catch {
      /* skip day */
    }
  }

  // NFL: also pull the undated "current week" scoreboard so preseason / bye weeks aren't missed.
  if (linkSport === "nfl" && candidates.length < 8) {
    try {
      const board = (await espnSiteJson(`${sportPath}/scoreboard`)) as {
        events?: (typeof candidates)[number]["event"][];
        error?: string;
      } | null;
      if (board && !board.error) {
        for (const event of board.events ?? []) {
          const comp = event.competitions?.[0];
          if (!comp) continue;
          const status = comp.status?.type ?? event.status?.type;
          const isFinal = status?.state === "post" || status?.completed === true;
          const isPreview =
            status?.state === "pre" ||
            /STATUS_SCHEDULED|STATUS_PRE/i.test(status?.name ?? "");
          const isLive = status?.state === "in" || (!isFinal && !isPreview);
          if (!isFinal && !isPreview && !(opts.includeLive && isLive)) continue;
          const eventId = event.id ?? comp.id;
          if (!eventId || seen.has(eventId)) continue;
          seen.add(eventId);
          const when = event.date ? new Date(event.date) : today;
          const y = when.getFullYear();
          const m = String(when.getMonth() + 1).padStart(2, "0");
          const day = String(when.getDate()).padStart(2, "0");
          candidates.push({
            eventId,
            dateStr: `${y}${m}${day}`,
            y,
            m,
            day,
            event,
            isFinal,
            isPreview,
            isLive,
          });
        }
      }
    } catch {
      /* optional */
    }
  }

  // Newest first; cap before summary fetches.
  candidates.sort((a, b) => {
    const da = a.event.date ? Date.parse(a.event.date) : 0;
    const db = b.event.date ? Date.parse(b.event.date) : 0;
    return db - da;
  });
  // Previews (today's games) go first so a busy final-heavy slate doesn't push
  // today's preview out of the cap before maxItems is reached.
  const previews = candidates.filter((c) => c.isPreview);
  const rest = candidates.filter((c) => !c.isPreview);
  const limited = [...previews, ...rest].slice(0, maxItems);

  // Fetch summaries with modest concurrency.
  const concurrency = 4;
  for (let i = 0; i < limited.length; i += concurrency) {
    const chunk = limited.slice(i, i + concurrency);
    const settled = await Promise.all(
      chunk.map(async (c) => {
        const comp = c.event.competitions?.[0];
        const home = (comp?.competitors ?? []).find((x) => x.homeAway === "home");
        const away = (comp?.competitors ?? []).find((x) => x.homeAway === "away");
        const matchup =
          c.event.shortName ||
          `${away?.team?.abbreviation ?? "AWAY"} @ ${home?.team?.abbreviation ?? "HOME"}`;
        const publishedAt = c.event.date || `${c.y}-${c.m}-${c.day}T17:00:00Z`;
        const homeScore = home?.score;
        const awayScore = away?.score;
        const scoreBit =
          homeScore != null && awayScore != null
            ? `${away?.team?.abbreviation ?? "AWAY"} ${awayScore}, ${home?.team?.abbreviation ?? "HOME"} ${homeScore}`
            : matchup;
        const awayAbbr = away?.team?.abbreviation ?? null;
        const homeAbbr = home?.team?.abbreviation ?? null;
        const logoTeamIds =
          linkSport === "mlb" ? mlbIdsFromEspnAbbrevs([awayAbbr, homeAbbr]) : undefined;
        const logoAbbrevs =
          linkSport === "nfl"
            ? [awayAbbr, homeAbbr].filter((x): x is string => Boolean(x))
            : undefined;
        const logoSoccerIds =
          linkSport === "soccer"
            ? [away?.team?.id, home?.team?.id].filter((x): x is string => Boolean(x))
            : undefined;

        const gameLink = (kind: "wrap" | "preview" | "live", storyHref?: string | null) => {
          if (linkSport === "soccer") {
            if (storyHref) return storyHref;
            return `https://www.espn.com/soccer/match/_/gameId/${c.eventId}`;
          }
          return kind === "preview"
            ? `https://www.espn.com/${linkSport}/preview/_/gameId/${c.eventId}`
            : `https://www.espn.com/${linkSport}/recap/_/gameId/${c.eventId}`;
        };

        const stubItem = (
          kind: "wrap" | "preview" | "live",
          title: string,
          snippet: string,
          image?: string | null,
          storyHref?: string | null,
        ) =>
          ({
            id: `${kind}-${c.eventId}`,
            title,
            link: gameLink(kind, storyHref),
            author: "ESPN",
            publishedAt,
            image: image ?? null,
            snippet,
            logoTeamIds,
            logoAbbrevs,
            logoSoccerIds,
          }) satisfies RssFeedItem;

        const recordOf = (
          side: (typeof home) | (typeof away),
        ) =>
          side?.records?.find((r) => r.type === "total" || r.type === "vsconf")?.summary ||
          side?.records?.[0]?.summary ||
          null;
        const pitcherOf = (
          side: (typeof home) | (typeof away),
        ) =>
          side?.probables?.[0]?.athlete?.shortName ||
          side?.probables?.[0]?.athlete?.displayName ||
          null;
        const previewCopy = () => {
          const awayPitch = pitcherOf(away);
          const homePitch = pitcherOf(home);
          const pitchers =
            awayPitch || homePitch
              ? `${awayPitch ?? "TBD"} vs ${homePitch ?? "TBD"}`
              : null;
          const records = [awayAbbr && recordOf(away) ? `${awayAbbr} ${recordOf(away)}` : null, homeAbbr && recordOf(home) ? `${homeAbbr} ${recordOf(home)}` : null]
            .filter(Boolean)
            .join(" · ");
          let when = "";
          if (c.event.date) {
            const t = Date.parse(c.event.date);
            if (Number.isFinite(t)) {
              when = new Date(t).toLocaleTimeString("en-US", {
                timeZone: "America/Chicago",
                hour: "numeric",
                minute: "2-digit",
              });
              if (when) when = `${when} CT`;
            }
          }
          return [pitchers, records || null, when].filter(Boolean).join(" · ") || `First pitch — ${matchup}.`;
        };

        // Scoreboard stubs only for sports that opt in (NFL/soccer). MLB waits for ESPN prose.
        const scoreboardStub = () => {
          if (linkSport === "mlb") return null;
          if (c.isPreview) {
            if (!opts.stubWithoutArticle) return null;
            return stubItem("preview", `Preview: ${matchup}`, previewCopy());
          }
          if (!opts.stubWithoutArticle) return null;
          if (c.isLive) {
            return stubItem("live", `Live: ${scoreBit}`, `In progress — ${matchup}.`);
          }
          if (c.isFinal) {
            return stubItem("wrap", `Final: ${scoreBit}`, `Final — ${matchup}.`);
          }
          return null;
        };

        try {
          const sum = (await espnSiteJson(
            `${sportPath}/summary?event=${c.eventId}`,
          )) as {
            article?: {
              headline?: string;
              description?: string;
              story?: string;
              type?: string;
              images?: { url?: string }[];
              links?: { href?: string }[] | { web?: { href?: string } };
            };
            news?: {
              articles?: {
                headline?: string;
                description?: string;
                story?: string;
                type?: string;
                images?: { url?: string }[];
                links?: { href?: string }[] | { web?: { href?: string } };
              }[];
            };
            error?: string;
          } | null;
          if (!sum || sum.error) return scoreboardStub();
          // Soccer (and some other sports) put wrap copy in news.articles, not article.
          // MLB previews: never promote the league news rail (fantasy promo, clips).
          // MLB finals: news.articles often hold the real wrap when article.story is empty.
          const espnPromo =
            /fantasy baseball|optimize your fantasy|stay ahead of the game|rolling 10-day outlook|team hitting ratings|pitcher projections/i;
          const newsArticles = (sum.news?.articles ?? []).filter((a) => {
            const blob = `${a.headline ?? ""} ${a.description ?? ""} ${a.story ?? ""}`;
            return Boolean(a.headline) && !espnPromo.test(blob) && !/^media$/i.test(a.type ?? "");
          });
          const newsArticle = newsArticles[0];
          const officialOk =
            Boolean(sum.article?.headline) &&
            !espnPromo.test(
              `${sum.article?.headline ?? ""} ${sum.article?.description ?? ""} ${sum.article?.story ?? ""}`,
            );
          type StorySrc = {
            headline?: string;
            description?: string;
            story?: string;
            type?: string;
            images?: { url?: string }[];
            links?: { href?: string }[] | { web?: { href?: string } };
          };
          const isMediaClip = (a: StorySrc | undefined) => /^media$/i.test(a?.type ?? "");
          const stripStory = (html: string | undefined) =>
            (html ?? "")
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim();
          const bodyLen = (a: StorySrc | undefined) => {
            const story = stripStory(a?.story);
            const desc = (a?.description ?? "").replace(/^—\s*/, "").trim();
            return Math.max(story.length, desc.length);
          };
          const homeName = home?.team?.displayName ?? home?.team?.shortDisplayName ?? null;
          const awayName = away?.team?.displayName ?? away?.team?.shortDisplayName ?? null;
          const storyMentionsMatchup = (a: StorySrc | undefined) => {
            if (linkSport !== "mlb") return true;
            const blob = `${a?.headline ?? ""} ${a?.description ?? ""} ${stripStory(a?.story)}`.toLowerCase();
            const hits = (name: string | null, abbrev: string | null, short?: string | null) => {
              const nick = name?.split(/\s+/).slice(-1)[0] ?? null;
              const keys = [abbrev, name, short, nick]
                .filter((k): k is string => Boolean(k && k.length >= 3))
                .map((k) => k.toLowerCase());
              return keys.some((k) => blob.includes(k));
            };
            return (
              hits(homeName, homeAbbr, home?.team?.shortDisplayName) &&
              hits(awayName, awayAbbr, away?.team?.shortDisplayName)
            );
          };
          let article: StorySrc | undefined = officialOk && !isMediaClip(sum.article) && storyMentionsMatchup(sum.article)
            ? sum.article
            : linkSport !== "mlb" && newsArticle?.headline
              ? {
                  headline: newsArticle.headline,
                  description: newsArticle.description,
                  story: newsArticle.story,
                  images: newsArticle.images,
                  links: newsArticle.links,
                }
              : undefined;

          // MLB wraps: richest story that is actually about THIS game.
          // ESPN's news rail is league-wide — picking length alone attached
          // Jo Adell / Guardians to Dodgers–Rockies.
          if (linkSport === "mlb" && c.isFinal) {
            const candidates: StorySrc[] = [];
            if (
              !isMediaClip(sum.article) &&
              (sum.article?.headline || sum.article?.story || sum.article?.description)
            ) {
              candidates.push(sum.article);
            }
            for (const a of newsArticles) candidates.push(a);
            let best: StorySrc | undefined;
            let bestLen = 0;
            for (const cand of candidates) {
              if (!storyMentionsMatchup(cand)) continue;
              const len = bodyLen(cand);
              if (len > bestLen || (!best && cand.headline)) {
                best = cand;
                bestLen = len;
              }
            }
            if (best) article = best;
          }

          // MLB previews: same candidate search — article alone is often empty early.
          if (linkSport === "mlb" && c.isPreview && !article) {
            const candidates: StorySrc[] = [];
            if (
              !isMediaClip(sum.article) &&
              (sum.article?.headline || sum.article?.story || sum.article?.description)
            ) {
              candidates.push(sum.article);
            }
            for (const a of newsArticles) candidates.push(a);
            let best: StorySrc | undefined;
            let bestLen = 0;
            for (const cand of candidates) {
              if (!storyMentionsMatchup(cand)) continue;
              const len = bodyLen(cand);
              if (len > bestLen || (!best && cand.headline)) {
                best = cand;
                bestLen = len;
              }
            }
            article = best;
          }

          const storyLink = espnArticleLinkHref(article?.links);
          const image = article?.images?.[0]?.url ?? null;

          if (c.isLive) {
            return stubItem(
              "live",
              `Live: ${scoreBit}`,
              article?.description?.replace(/^—\s*/, "").trim() ||
                `In progress — ${matchup}.`,
              image,
              storyLink,
            );
          }

          if (c.isFinal) {
            if (!article?.headline) {
              return scoreboardStub();
            }
            const storyText = stripStory(article.story);
            const description = (article.description ?? "").replace(/^—\s*/, "").trim();
            const snippet = description || storyText.slice(0, 220);
            // MLB: same bar as previews — real wrap prose before Dispatch lists it.
            if (linkSport === "mlb") {
              const hasStory = storyText.length >= 80;
              const hasProseDesc =
                description.length >= 60 &&
                /[.!?]/.test(description) &&
                !/^final\b/i.test(description);
              if (!hasStory && !hasProseDesc) return null;
            } else {
              if (!opts.stubWithoutArticle && (!snippet || snippet.length < 40)) return null;
              if (opts.stubWithoutArticle && (!snippet || snippet.length < 40)) {
                return stubItem("wrap", article.headline, `Final — ${matchup}.`, image, storyLink);
              }
            }
            return {
              id: `wrap-${c.eventId}`,
              title: article.headline,
              link: gameLink("wrap", storyLink),
              author: "ESPN",
              publishedAt,
              image,
              snippet,
              logoTeamIds,
              logoAbbrevs,
              logoSoccerIds,
            } satisfies RssFeedItem;
          }

          // Hollow previews: MLB requires real ESPN preview prose — no scoreboard stubs.
          // Finals/live may still stub when stubWithoutArticle is on.
          const headline = article?.headline?.trim() ?? "";
          const storyText = (article?.story ?? "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          const description = (article?.description ?? "").replace(/^—\s*/, "").trim();
          const body = description || storyText;
          // BBRef-style matchup copy ("Bottom line", "Pitching probables", "Line:") is real
          // preview prose even when compact — never treat it as hollow.
          const hasBbrefMatchupCopy = /BOTTOM LINE|PITCHING PROBABLES|LINE:/i.test(body);
          const hollow =
            !hasBbrefMatchupCopy &&
            (!headline ||
              !body ||
              body.length < 40 ||
              /no story available/i.test(`${headline} ${body}`) ||
              /^game preview for\b/i.test(body) ||
              /^preview\s*[—–-]/i.test(body) ||
              /fantasy baseball|optimize your fantasy|stay ahead of the game|rolling 10-day outlook/i.test(
                `${headline} ${body}`,
              ));
          if (hollow) return scoreboardStub();

          // MLB: require an actual story body (or a description that reads like preview prose).
          if (linkSport === "mlb") {
            const hasStory = storyText.length >= 80;
            const hasProseDesc =
              description.length >= 60 &&
              /[.!?]/.test(description) &&
              !/^first pitch\b/i.test(description);
            if (!hasStory && !hasProseDesc) return null;
          }

          return {
            id: `preview-${c.eventId}`,
            title: headline,
            link: gameLink("preview", storyLink),
            author: "ESPN",
            publishedAt,
            image,
            snippet: body.slice(0, 220),
            logoTeamIds,
            logoAbbrevs,
            logoSoccerIds,
          } satisfies RssFeedItem;
        } catch {
          return scoreboardStub();
        }
      }),
    );
    for (const item of settled) {
      if (item) items.push(item);
    }
  }

  items.sort((a, b) => {
    const da = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const db = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return db - da;
  });

  // Drop hollow preview stubs (scoreboard-only / pitcher-line previews with no story).
  const filtered = items.filter((it) => {
    const snip = (it.snippet ?? "").trim();
    const title = (it.title ?? "").trim();
    const isMlbWrap =
      linkSport === "mlb" &&
      (/\/mlb\/recap\//i.test(it.link) || /^wrap-/i.test(it.id) || /^Final\s*:/i.test(title));
    if (isMlbWrap) {
      if (/^Final\s*:/i.test(title) && snip.length < 60) return false;
      if (/^Final\s*[—–-]/i.test(snip) && snip.length < 60) return false;
      if (snip.length < 40) return false;
    }
    const isMlbPreview =
      linkSport === "mlb" &&
      (/\/mlb\/preview\//i.test(it.link) || /^preview-/i.test(it.id) || /^Preview\s*:/i.test(title));
    // BBRef-style matchup snippets ("Bottom line", "Pitching probables", "Line:") read as
    // real preview prose even though they're compact — never drop them as hollow.
    const hasBbrefMatchupCopy = /BOTTOM LINE|PITCHING PROBABLES|LINE:/i.test(snip);
    if (isMlbPreview && !hasBbrefMatchupCopy) {
      // Pitcher · record · time stubs and "Preview: AWY @ HOME" titles without prose.
      if (/^Preview\s*:/i.test(title) && snip.length < 60) return false;
      if (
        /^[A-Za-z.'\-]+(?:\s+[A-Za-z.'\-]+)?\s+vs\s+[A-Za-z.'\-]+/i.test(snip) &&
        snip.length < 100 &&
        !/[.!?].{10,}/.test(snip)
      ) {
        return false;
      }
      if (/^First pitch\b/i.test(snip)) return false;
      if (/fantasy baseball|optimize your fantasy|stay ahead of the game/i.test(snip)) return false;
      if (snip.length < 40) return false;
    }
    if (/^Preview\s*[—–-]/i.test(title) || /^Preview\s*[—–-]/i.test(snip)) {
      // Keep only if snippet has real prose beyond the stub pattern.
      if (/^Preview\s*[—–-].{0,80}$/i.test(snip) && !/[.!?].*\s\w{4,}/.test(snip.slice(20))) {
        return false;
      }
    }
    return true;
  });

  return {
    title: opts.title,
    description: opts.description,
    link: `https://www.espn.com/${linkSport}/`,
    feedUrl: opts.feedUrl,
    items: filtered,
  };
}

type MlbDayResultDecisionPitcher = {
  id: number;
  name: string;
  seasonLine: string | null;
};

type MlbDayResultDecisions = {
  winner?: MlbDayResultDecisionPitcher | null;
  loser?: MlbDayResultDecisionPitcher | null;
  save?: MlbDayResultDecisionPitcher | null;
};

type MlbDayResultGame = {
  gamePk: number;
  awayName: string;
  homeName: string;
  awayAbbr: string;
  homeAbbr: string;
  awayId: number | null;
  homeId: number | null;
  awayScore: number | null;
  homeScore: number | null;
  awayRecord: string | null;
  homeRecord: string | null;
  awayRuns: number | null;
  homeRuns: number | null;
  awayHits: number | null;
  homeHits: number | null;
  awayErrors: number | null;
  homeErrors: number | null;
  /** e.g. "F/10" for extras, or the current inning while in progress. */
  inningLine: string | null;
  currentInning: number | null;
  statusDetail: string;
  isExtra: boolean;
  extrasInnings: number | null;
  /** Postponed/rescheduled/makeup note from the schedule, when present. */
  description: string | null;
  status: string;
  isFinal: boolean;
  decisions: MlbDayResultDecisions | null;
};

async function fetchMlbResultsByDate(
  start: string,
  end: string,
): Promise<Map<string, MlbDayResultGame[]>> {
  const url =
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1` +
    `&startDate=${start}&endDate=${end}&hydrate=linescore,team,decisions`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`MLB results ${res.status}`);
  const data = (await res.json()) as {
    dates?: {
      date?: string;
      games?: {
        gamePk?: number;
        status?: { detailedState?: string; abstractGameState?: string };
        description?: string;
        teams?: {
          away?: {
            score?: number;
            leagueRecord?: { wins?: number; losses?: number };
            team?: { id?: number; name?: string; abbreviation?: string };
          };
          home?: {
            score?: number;
            leagueRecord?: { wins?: number; losses?: number };
            team?: { id?: number; name?: string; abbreviation?: string };
          };
        };
        linescore?: {
          currentInning?: number;
          scheduledInnings?: number;
          currentInningOrdinal?: string;
          inningState?: string;
          innings?: unknown[];
          teams?: {
            away?: { runs?: number; hits?: number; errors?: number };
            home?: { runs?: number; hits?: number; errors?: number };
          };
        };
        decisions?: {
          winner?: { id?: number; fullName?: string };
          loser?: { id?: number; fullName?: string };
          save?: { id?: number; fullName?: string };
        };
      }[];
    }[];
  };
  const byDay = new Map<string, MlbDayResultGame[]>();
  for (const day of data.dates ?? []) {
    const key = day.date ?? "";
    if (!key) continue;
    const games: MlbDayResultGame[] = [];
    for (const g of day.games ?? []) {
      const abstract = g.status?.abstractGameState ?? "";
      const detailed = g.status?.detailedState ?? "";
      const isFinal = /final/i.test(detailed) || abstract === "Final";
      const ls = g.linescore;
      const scheduledInnings = ls?.scheduledInnings ?? 9;
      const inningsPlayed = ls?.innings?.length ?? 0;
      const isExtra = isFinal && inningsPlayed > scheduledInnings;
      const currentInning = ls?.currentInning ?? (inningsPlayed || null);
      let inningLine: string | null = null;
      if (isFinal) {
        inningLine = isExtra ? `F/${inningsPlayed}` : "F";
      } else if (currentInning) {
        const half = ls?.inningState ? `${ls.inningState} ` : "";
        inningLine = `${half}${ls?.currentInningOrdinal ?? currentInning}`;
      }
      const winner = g.decisions?.winner;
      const loser = g.decisions?.loser;
      const save = g.decisions?.save;
      const decisions: MlbDayResultDecisions | null =
        winner || loser || save
          ? {
              winner: winner?.id
                ? { id: winner.id, name: winner.fullName ?? "Winner", seasonLine: null }
                : null,
              loser: loser?.id
                ? { id: loser.id, name: loser.fullName ?? "Loser", seasonLine: null }
                : null,
              save: save?.id
                ? { id: save.id, name: save.fullName ?? "Save", seasonLine: null }
                : null,
            }
          : null;
      games.push({
        gamePk: Number(g.gamePk) || 0,
        awayName: g.teams?.away?.team?.name ?? "Away",
        homeName: g.teams?.home?.team?.name ?? "Home",
        awayAbbr: g.teams?.away?.team?.abbreviation ?? "AWAY",
        homeAbbr: g.teams?.home?.team?.abbreviation ?? "HOME",
        awayId: g.teams?.away?.team?.id ?? null,
        homeId: g.teams?.home?.team?.id ?? null,
        awayScore: g.teams?.away?.score ?? null,
        homeScore: g.teams?.home?.score ?? null,
        awayRecord:
          g.teams?.away?.leagueRecord?.wins != null && g.teams?.away?.leagueRecord?.losses != null
            ? `${g.teams.away.leagueRecord.wins}-${g.teams.away.leagueRecord.losses}`
            : null,
        homeRecord:
          g.teams?.home?.leagueRecord?.wins != null && g.teams?.home?.leagueRecord?.losses != null
            ? `${g.teams.home.leagueRecord.wins}-${g.teams.home.leagueRecord.losses}`
            : null,
        awayRuns: ls?.teams?.away?.runs ?? null,
        homeRuns: ls?.teams?.home?.runs ?? null,
        awayHits: ls?.teams?.away?.hits ?? null,
        homeHits: ls?.teams?.home?.hits ?? null,
        awayErrors: ls?.teams?.away?.errors ?? null,
        homeErrors: ls?.teams?.home?.errors ?? null,
        inningLine,
        currentInning,
        statusDetail: detailed || abstract || "Scheduled",
        isExtra,
        extrasInnings: isExtra ? inningsPlayed : null,
        description: g.description ?? null,
        status: detailed || abstract || "Scheduled",
        isFinal,
        decisions,
      });
    }
    byDay.set(key, games);
  }
  return byDay;
}

/** Season W-L-ERA line for a pitcher from a game's boxscore (today/yesterday only). */
async function fetchPitcherSeasonLine(
  gamePk: number,
  personId: number,
): Promise<string | null> {
  try {
    const res = await fetch(`https://statsapi.mlb.com/api/v1/game/${gamePk}/boxscore`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      teams?: {
        away?: { players?: Record<string, unknown> };
        home?: { players?: Record<string, unknown> };
      };
    };
    const key = `ID${personId}`;
    const player =
      (data.teams?.away?.players?.[key] as
        | { seasonStats?: { pitching?: { wins?: number; losses?: number; era?: string; saves?: number } } }
        | undefined) ??
      (data.teams?.home?.players?.[key] as
        | { seasonStats?: { pitching?: { wins?: number; losses?: number; era?: string; saves?: number } } }
        | undefined);
    const p = player?.seasonStats?.pitching;
    if (!p) return null;
    if (p.saves) return `${p.saves} SV, ${p.era ?? "—"} ERA`;
    if (p.wins == null || p.losses == null) return null;
    return `${p.wins}-${p.losses}, ${p.era ?? "—"} ERA`;
  } catch {
    return null;
  }
}

/** Fill in decisions[].seasonLine from boxscores — only worth the extra calls for recent days. */
async function enrichMlbResultsWithPitcherLines(
  byDay: Map<string, MlbDayResultGame[]>,
  recentKeys: string[],
): Promise<void> {
  const jobs: { game: MlbDayResultGame; role: "winner" | "loser" | "save" }[] = [];
  for (const key of recentKeys) {
    const games = byDay.get(key) ?? [];
    for (const game of games) {
      if (!game.decisions) continue;
      if (game.decisions.winner) jobs.push({ game, role: "winner" });
      if (game.decisions.loser) jobs.push({ game, role: "loser" });
      if (game.decisions.save) jobs.push({ game, role: "save" });
    }
  }
  const concurrency = 4;
  for (let i = 0; i < jobs.length; i += concurrency) {
    const chunk = jobs.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async ({ game, role }) => {
        const pitcher = game.decisions?.[role];
        if (!pitcher) return;
        const line = await fetchPitcherSeasonLine(game.gamePk, pitcher.id);
        if (line) pitcher.seasonLine = line;
      }),
    );
  }
}

function renderMlbResultsHtml(
  games: MlbDayResultGame[],
  dateKey: string,
  esc: (s: string) => string,
  mlbTeamLogo: (id: number) => string,
  teamPagePath: (id: number) => string,
  mlbHeadshot: (playerId: number | string, size?: 213 | 426) => string,
): string {
  if (!games.length) {
    return `<p class="mlb-digest-lede">No MLB games on ${esc(dateKey)}.</p>`;
  }
  const finals = games.filter((g) => g.isFinal);
  const others = games.filter((g) => !g.isFinal);

  const teamRow = (
    id: number | null,
    abbr: string,
    name: string,
    record: string | null,
    runs: number | null,
    isWinner: boolean,
  ) => {
    const logo = id
      ? `<img class="mlb-results-logo" src="${esc(mlbTeamLogo(id))}" alt="" width="24" height="24" loading="lazy" />`
      : "";
    const teamName = id
      ? `<a class="mlb-results-team" href="${esc(teamPagePath(id))}">${esc(name)}</a>`
      : esc(name);
    return `<div class="mlb-results-team-row${isWinner ? " mlb-results-team-row--win" : ""}">
      <div class="mlb-results-team-id">${logo}<div class="mlb-results-team-names"><span class="mlb-results-abbr">${esc(abbr)}</span>${teamName}</div></div>
      ${record ? `<span class="mlb-results-record">${esc(record)}</span>` : ""}
      <span class="mlb-results-runs numeral">${runs != null ? runs : "—"}</span>
    </div>`;
  };

  const rheTable = (g: MlbDayResultGame) => {
    if (g.awayRuns == null && g.homeRuns == null) return "";
    return `<table class="mlb-results-rhe">
      <thead><tr><th></th><th>R</th><th>H</th><th>E</th></tr></thead>
      <tbody>
        <tr><td>${esc(g.awayAbbr)}</td><td class="numeral">${g.awayRuns ?? "—"}</td><td class="numeral">${g.awayHits ?? "—"}</td><td class="numeral">${g.awayErrors ?? "—"}</td></tr>
        <tr><td>${esc(g.homeAbbr)}</td><td class="numeral">${g.homeRuns ?? "—"}</td><td class="numeral">${g.homeHits ?? "—"}</td><td class="numeral">${g.homeErrors ?? "—"}</td></tr>
      </tbody>
    </table>`;
  };

  const pitcherChip = (role: string, pitcher: MlbDayResultDecisionPitcher | null | undefined) => {
    if (!pitcher) return "";
    return `<div class="mlb-results-pitcher">
      <img class="mlb-results-mug" src="${esc(mlbHeadshot(pitcher.id, 213))}" alt="" width="32" height="32" loading="lazy" />
      <div class="mlb-results-pitcher-info">
        <span class="mlb-results-pitcher-role">${esc(role)}</span>
        <a class="rss-player-link mlb-results-pitcher-name" href="/sports/mlb/player/${pitcher.id}">${esc(pitcher.name)}</a>
        ${pitcher.seasonLine ? `<span class="numeral mlb-results-pitcher-line">${esc(pitcher.seasonLine)}</span>` : ""}
      </div>
    </div>`;
  };

  const card = (g: MlbDayResultGame) => {
    const header = g.isFinal
      ? `FINAL${g.isExtra ? `/${g.extrasInnings}` : ""}`
      : g.inningLine || g.statusDetail;
    const homeWin = g.homeScore != null && g.awayScore != null && g.homeScore > g.awayScore;
    const awayWin = g.homeScore != null && g.awayScore != null && g.awayScore > g.homeScore;
    const decisions = g.decisions;
    const pitchersHtml = decisions
      ? [
          pitcherChip("W", decisions.winner),
          pitcherChip("L", decisions.loser),
          pitcherChip("S", decisions.save),
        ]
          .filter(Boolean)
          .join("")
      : "";
    return `<article class="mlb-results-card">
      <header class="mlb-results-card__header">
        <span class="mlb-results-status">${esc(header)}</span>
        ${g.description ? `<span class="mlb-results-note">${esc(g.description)}</span>` : ""}
      </header>
      <div class="mlb-results-teams">
        ${teamRow(g.awayId, g.awayAbbr, g.awayName, g.awayRecord, g.awayScore, awayWin)}
        ${teamRow(g.homeId, g.homeAbbr, g.homeName, g.homeRecord, g.homeScore, homeWin)}
      </div>
      ${rheTable(g)}
      ${pitchersHtml ? `<div class="mlb-results-pitchers">${pitchersHtml}</div>` : ""}
      <footer class="mlb-results-links">
        <a href="https://www.mlb.com/tv/gameday/${g.gamePk}">Watch</a>
        <a href="/sports/mlb/game/${g.gamePk}">Wrap</a>
        <a href="/sports/mlb/game/${g.gamePk}">Box</a>
        <a href="https://www.mlb.com/gameday/${g.gamePk}">Story</a>
      </footer>
    </article>`;
  };

  const section = (title: string, list: MlbDayResultGame[]) => {
    if (!list.length) return "";
    return `<section class="mlb-results-block">
      <h2>${esc(title)}</h2>
      <div class="mlb-results-grid">${list.map(card).join("")}</div>
    </section>`;
  };
  return `
    <p class="mlb-digest-lede">Every MLB final${others.length ? " and remaining game" : ""} for ${esc(dateKey)}.</p>
    <div class="mlb-results-feed">
      ${section("Finals", finals)}
      ${section("Still to play", others)}
    </div>
  `.trim();
}

/** Once-per-day standings + wild card, and a separate league-leaders article. */
async function fetchMlbStatsDigestFeed(): Promise<RssFeed> {
  const {
    fetchMlbStandings,
    fetchMlbWildCardStandings,
    fetchMlbLeaders,
    divisionLeaders,
    mlbTeamLogo,
    mlbHeadshot,
    mlbLeagueLogo,
    mlbTeamAccent,
    teamPagePath,
  } = await import("./mlb");
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const dateKey = `${y}-${m}-${d}`;

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

  const startDay = new Date(today);
  startDay.setDate(today.getDate() - 6);
  const startKey = `${startDay.getFullYear()}-${String(startDay.getMonth() + 1).padStart(2, "0")}-${String(startDay.getDate()).padStart(2, "0")}`;

  const [standings, nlWc, alWc, alLeaders, nlLeaders, resultsByDay] = await Promise.all([
    fetchMlbStandings(),
    fetchMlbWildCardStandings(104),
    fetchMlbWildCardStandings(103),
    fetchMlbLeaders(5, { leagueId: 103 }),
    fetchMlbLeaders(5, { leagueId: 104 }),
    fetchMlbResultsByDate(startKey, dateKey).catch(() => new Map<string, MlbDayResultGame[]>()),
  ]);

  // Only worth the extra boxscore calls for the last two days' pitcher lines.
  await enrichMlbResultsWithPitcherLines(resultsByDay, [dateKey, yesterdayKey]).catch(() => {});

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const divisionHtml = standings
    .map((div) => {
      const rows = div.rows
        .map((r) => {
          const logo = r.teamId
            ? `<img class="mlb-standings-logo" src="${esc(mlbTeamLogo(r.teamId))}" alt="" width="22" height="22" loading="lazy" />`
            : "";
          const name = r.teamId
            ? `<a class="mlb-standings-team" href="${esc(teamPagePath(r.teamId))}">${esc(r.team)}</a>`
            : esc(r.team);
          return `<tr>
            <td class="mlb-standings-team-cell"><span class="mlb-standings-rank">${esc(r.rank)}</span>${logo}${name}</td>
            <td class="mlb-standings-wl numeral">${r.wins}&ndash;${r.losses}</td>
            <td class="numeral">${esc(r.pct)}</td>
            <td class="numeral">${esc(r.gb)}</td>
            <td class="numeral mlb-standings-po">${esc(r.playoffPercent ?? "—")}</td>
          </tr>`;
        })
        .join("");
      return `<section class="mlb-standings-block">
        <h2>${esc(div.name)}</h2>
        <table class="mlb-standings-table">
          <thead><tr><th>Team</th><th>W-L</th><th>Pct</th><th>GB</th><th>Playoff%</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>`;
    })
    .join("");

  const wcBlock = (title: string, rows: Awaited<ReturnType<typeof fetchMlbWildCardStandings>>) => {
    const body = rows
      .slice(0, 10)
      .map((r) => {
        const logo = r.teamId
          ? `<img class="mlb-standings-logo" src="${esc(mlbTeamLogo(r.teamId))}" alt="" width="22" height="22" loading="lazy" />`
          : "";
        const name = r.teamId
          ? `<a class="mlb-standings-team" href="${esc(teamPagePath(r.teamId))}">${esc(r.team)}</a>`
          : esc(r.team);
        return `<tr>
          <td class="mlb-standings-team-cell"><span class="mlb-standings-rank">${esc(String(r.rank))}</span>${logo}${name}</td>
          <td class="mlb-standings-wl numeral">${r.wins}&ndash;${r.losses}</td>
          <td class="numeral">${esc(r.wcgb)}</td>
        </tr>`;
      })
      .join("");
    return `<section class="mlb-standings-block">
      <h2>${esc(title)}</h2>
      <table class="mlb-standings-table">
        <thead><tr><th>Team</th><th>W-L</th><th>WCGB</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </section>`;
  };

  const leadersBlock = (
    title: string,
    rows: ReturnType<typeof divisionLeaders>,
  ) => {
    if (!rows.length) return "";
    const body = rows
      .map((r) => {
        const logo = r.teamId
          ? `<img class="mlb-standings-logo" src="${esc(mlbTeamLogo(r.teamId))}" alt="" width="22" height="22" loading="lazy" />`
          : "";
        const label = `${r.abbrev || r.team} - ${r.divisionLetter}`;
        const name = r.teamId
          ? `<a class="mlb-standings-team" href="${esc(teamPagePath(r.teamId))}">${esc(label)}</a>`
          : esc(label);
        return `<tr>
          <td class="mlb-standings-team-cell">${logo}${name}</td>
          <td class="mlb-standings-wl numeral">${r.wins}&ndash;${r.losses}</td>
          <td class="numeral">${esc(r.pct)}</td>
          <td class="numeral">${esc(r.wcgb || "—")}</td>
        </tr>`;
      })
      .join("");
    return `<section class="mlb-standings-block">
      <h2>${esc(title)}</h2>
      <table class="mlb-standings-table">
        <thead><tr><th>Team</th><th>W-L</th><th>Pct</th><th>WCGB</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </section>`;
  };

  const nlDivLeaders = divisionLeaders(standings, "NL");
  const alDivLeaders = divisionLeaders(standings, "AL");

  const shortName = (name: string) => {
    const bits = name.trim().split(/\s+/);
    if (bits.length < 2) return name;
    return `${bits[0]![0]}. ${bits[bits.length - 1]}`;
  };

  const leaderCardsHtml = (
    leagueLabel: string,
    boards: Awaited<ReturnType<typeof fetchMlbLeaders>>,
  ) => {
    const hitting = boards.filter((b) => b.group === "hitting");
    const pitching = boards.filter((b) => b.group === "pitching");
    const renderGroup = (title: string, group: typeof boards) => {
      if (!group.length) return "";
      const cards = group
        .map((board) => {
          const top = board.leaders[0];
          if (!top) return "";
          const accent = mlbTeamAccent(top.teamId);
          const rest = board.leaders
            .slice(1)
            .map(
              (l) => `<li class="mlb-leader-card__row">
                <img class="mlb-leader-card__mug" src="${esc(mlbHeadshot(l.playerId, 213))}" alt="" width="32" height="32" loading="lazy" />
                <a class="rss-player-link mlb-leader-card__name" href="/sports/mlb/player/${l.playerId}">${esc(l.name || shortName(l.name))}</a>
                <span class="numeral mlb-leader-card__stat">${esc(l.value)}</span>
              </li>`,
            )
            .join("");
          return `<article class="mlb-leader-card">
            <div class="mlb-leader-card__hero" style="background:#${accent}">
              <p class="mlb-leader-card__cat">${esc(board.label)}</p>
              <p class="mlb-leader-card__val numeral">${esc(top.value)}</p>
              <div class="mlb-leader-card__who">
                <a class="rss-player-link mlb-leader-card__name" href="/sports/mlb/player/${top.playerId}">${esc(top.name)}</a>
                <p>${esc(top.team || "—")}</p>
              </div>
              <img class="mlb-leader-card__shot" src="${esc(mlbHeadshot(top.playerId, 426))}" alt="" loading="lazy" />
            </div>
            ${rest ? `<ul class="mlb-leader-card__list">${rest}</ul>` : ""}
          </article>`;
        })
        .join("");
      return `<h3>${esc(title)}</h3><div class="mlb-leader-grid">${cards}</div>`;
    };
    return `<section class="mlb-leaders-league">
      <h2>${esc(leagueLabel)}</h2>
      ${renderGroup("Hitting", hitting)}
      ${renderGroup("Pitching", pitching)}
    </section>`;
  };

  const standingsHtml = `
    <p class="mlb-digest-lede">Division standings, division leaders, and wild-card boards for ${esc(dateKey)}.</p>
    <div class="mlb-standings-feed">
      ${divisionHtml}
      ${leadersBlock("NL Leaders", nlDivLeaders)}
      ${wcBlock("NL Wild Card", nlWc)}
      ${leadersBlock("AL Leaders", alDivLeaders)}
      ${wcBlock("AL Wild Card", alWc)}
    </div>
  `.trim();

  const leadersHtml = `
    <p class="mlb-digest-lede">American League and National League leaders for ${esc(dateKey)}.</p>
    ${leaderCardsHtml("American League", alLeaders)}
    ${leaderCardsHtml("National League", nlLeaders)}
  `.trim();

  const items: RssFeedItem[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const yy = day.getFullYear();
    const mm = String(day.getMonth() + 1).padStart(2, "0");
    const dd = String(day.getDate()).padStart(2, "0");
    const key = `${yy}-${mm}-${dd}`;
    const isToday = i === 0;
    const archiveNote = `<p>This archive day is listed for history. Switch to today's article for live boards.</p>`;
    const dayGames = resultsByDay.get(key) ?? [];
    const finals = dayGames.filter((g) => g.isFinal);
    const resultsHtml = renderMlbResultsHtml(dayGames, key, esc, mlbTeamLogo, teamPagePath, mlbHeadshot);
    items.push({
      id: `mlb-results-${key}`,
      title: isToday ? `MLB results — ${key}` : `MLB results — ${key}`,
      link: `dispatch://mlb-results/${key}`,
      author: "MLB Stats API",
      publishedAt: `${key}T20:00:00-05:00`,
      image: mlbLeagueLogo(),
      snippet: dayGames.length
        ? `${finals.length} final${finals.length === 1 ? "" : "s"} · ${dayGames.length} game${dayGames.length === 1 ? "" : "s"} on ${key}.`
        : `No MLB games on ${key}.`,
      contentHtml: resultsHtml,
    });
    items.push({
      id: `mlb-standings-${key}`,
      title: isToday ? `MLB standings — ${key}` : `MLB standings — ${key} (archive)`,
      link: `dispatch://mlb-standings/${key}`,
      author: "MLB Stats API",
      publishedAt: `${key}T12:00:00-05:00`,
      image: null,
      snippet: isToday
        ? `Division standings and NL/AL wild cards for ${dateKey}.`
        : `Archived standings placeholder for ${key}.`,
      contentHtml: isToday ? standingsHtml : archiveNote,
    });
    items.push({
      id: `mlb-leaders-${key}`,
      title: isToday ? `MLB league leaders — ${key}` : `MLB league leaders — ${key} (archive)`,
      link: `dispatch://mlb-leaders/${key}`,
      author: "MLB Stats API",
      // Slightly later so leaders sort under standings when same day.
      publishedAt: `${key}T12:05:00-05:00`,
      image: null,
      snippet: isToday
        ? `AL and NL hitting/pitching leaders for ${dateKey}.`
        : `Archived leaders placeholder for ${key}.`,
      contentHtml: isToday ? leadersHtml : archiveNote,
    });
  }

  items.sort((a, b) => {
    const da = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const db = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return db - da;
  });

  return {
    title: "MLB standings & leaders",
    description: "Daily results, division standings, and AL/NL league leaders as separate articles",
    link: "https://www.mlb.com/standings",
    feedUrl: "synthetic:mlb-stats",
    items,
  };
}

/** Form standings over the last 5 / 10 / 20 / 30 / 40 / 50 games. */
async function fetchMlbFormStandingsFeed(): Promise<RssFeed> {
  const { mlbTeamLogo, teamPagePath } = await import("./mlb");
  const { fetchMlbFormStandings } = await import("./team-form");
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const dateKey = `${y}-${m}-${d}`;

  const boards = await fetchMlbFormStandings([5, 10, 20, 30, 40, 50]);
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const contentHtml = `
    <p class="mlb-digest-lede">Entire league ranked by record over recent games — ${esc(dateKey)}.</p>
    <div class="mlb-standings-feed">
      ${boards
        .map((board) => {
          const rows = board.rows
            .map((r) => {
              const logo = r.teamId
                ? `<img class="mlb-standings-logo" src="${esc(mlbTeamLogo(r.teamId))}" alt="" width="22" height="22" loading="lazy" />`
                : "";
              const name = r.teamId
                ? `<a class="mlb-standings-team" href="${esc(teamPagePath(r.teamId))}">${esc(r.team)}</a>`
                : esc(r.team);
              return `<tr>
                <td class="mlb-standings-team-cell"><span class="mlb-standings-rank">${r.rank}</span>${logo}${name}</td>
                <td class="mlb-standings-wl numeral">${r.wins}&ndash;${r.losses}</td>
                <td class="numeral">${esc(r.pct)}</td>
              </tr>`;
            })
            .join("");
          return `<section class="mlb-standings-block">
            <h2>${esc(board.label)} games</h2>
            <table class="mlb-standings-table">
              <thead><tr><th>Team</th><th>W-L</th><th>Pct</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </section>`;
        })
        .join("")}
    </div>
  `.trim();

  const items: RssFeedItem[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const yy = day.getFullYear();
    const mm = String(day.getMonth() + 1).padStart(2, "0");
    const dd = String(day.getDate()).padStart(2, "0");
    const key = `${yy}-${mm}-${dd}`;
    const isToday = i === 0;
    items.push({
      id: `mlb-form-${key}`,
      title: isToday ? `MLB form standings — ${key}` : `MLB form standings — ${key} (archive)`,
      link: `dispatch://mlb-form/${key}`,
      author: "MLB Stats API",
      publishedAt: `${key}T12:10:00-05:00`,
      image: null,
      snippet: isToday
        ? `League standings for the last 5, 10, 20, 30, 40, and 50 games (${dateKey}).`
        : `Archived form standings placeholder for ${key}.`,
      contentHtml: isToday
        ? contentHtml
        : `<p>This archive day is listed for history. Open today's form standings for live boards.</p>`,
    });
  }

  return {
    title: "MLB form standings",
    description: "League standings by last 5 / 10 / 20 / 30 / 40 / 50 games",
    link: "https://www.mlb.com/standings",
    feedUrl: "synthetic:mlb-form",
    items,
  };
}

/** Cardinals MiLB affiliate box-score wraps (Single-A and up). */
async function fetchCardinalsFarmWrapsFeed(): Promise<RssFeed> {
  const { fetchCardinalsFarmGameWraps, mlbTeamLogo } = await import("./mlb");
  const wraps = await fetchCardinalsFarmGameWraps(5);
  const items: RssFeedItem[] = wraps.map((w) => ({
    id: `farm-wrap-${w.gamePk}`,
    title: w.title,
    link: `app:mlb-game/${w.gamePk}`,
    author: w.level,
    publishedAt: w.publishedAt,
    image: w.image ?? (w.logoTeamIds[0] != null ? mlbTeamLogo(w.logoTeamIds[0]) : null),
    snippet: w.snippet,
    contentHtml: w.contentHtml,
    logoTeamIds: w.logoTeamIds,
  }));

  return {
    title: "Cardinals farm wraps",
    description: "Box scores and summaries for St. Louis Cardinals affiliates (Single-A and up)",
    link: "/sports/mlb/prospects",
    feedUrl: "synthetic:cardinals-farm",
    items,
  };
}

/** Cardinals Baseball Savant Statcast preview — today's game only (Central). */
async function fetchCardinalsSavantFeed(): Promise<RssFeed> {
  const { mlbTeamLogo } = await import("./mlb");
  const { formatSportsDateLong, todayStr } = await import("./utils");

  const CARDINALS_ID = 138;
  const today = todayStr();

  const url =
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${CARDINALS_ID}` +
    `&startDate=${today}&endDate=${today}&hydrate=team`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Cardinals schedule ${res.status}`);
  const data = (await res.json()) as {
    dates?: {
      date?: string;
      games?: {
        gamePk?: number;
        officialDate?: string;
        status?: { detailedState?: string; abstractGameState?: string };
        teams?: {
          away?: { team?: { id?: number; abbreviation?: string; name?: string } };
          home?: { team?: { id?: number; abbreviation?: string; name?: string } };
        };
      }[];
    }[];
  };

  const items: RssFeedItem[] = [];
  const seen = new Set<number>();
  for (const day of data.dates ?? []) {
    for (const g of day.games ?? []) {
      const pk = Number(g.gamePk);
      if (!Number.isFinite(pk) || seen.has(pk)) continue;
      seen.add(pk);
      const away = g.teams?.away?.team;
      const home = g.teams?.home?.team;
      const awayAbbr = away?.abbreviation ?? "AWAY";
      const homeAbbr = home?.abbreviation ?? "HOME";
      const status = g.status?.detailedState ?? g.status?.abstractGameState ?? "";
      const date = g.officialDate ?? day.date ?? "";
      if (date !== today) continue;
      const dateLabel = date ? formatSportsDateLong(date) : "";
      const isFinal = /final|completed/i.test(status);
      const title = isFinal
        ? `Statcast wrap-up: ${awayAbbr} @ ${homeAbbr}${dateLabel ? ` · ${dateLabel}` : ""}`
        : `Statcast preview: ${awayAbbr} @ ${homeAbbr}${dateLabel ? ` · ${dateLabel}` : ""}`;
      const logoId = away?.id === CARDINALS_ID ? home?.id : away?.id;
      items.push({
        id: `savant-stl-${pk}`,
        title,
        link: `https://baseballsavant.mlb.com/preview?game_pk=${pk}&teamId=${CARDINALS_ID}`,
        author: "Baseball Savant",
        publishedAt: date ? `${date}T17:00:00Z` : null,
        image: logoId != null ? mlbTeamLogo(logoId) : mlbTeamLogo(CARDINALS_ID),
        snippet: `${status || "Game"} · Cardinals Statcast matchup tables from Baseball Savant`,
        logoTeamIds: [away?.id, home?.id].filter((x): x is number => typeof x === "number"),
      });
    }
  }

  items.sort((a, b) => {
    const da = Date.parse(a.publishedAt ?? "") || 0;
    const db = Date.parse(b.publishedAt ?? "") || 0;
    return db - da;
  });

  return {
    title: "Cardinals Baseball Savant",
    description: "Statcast preview for today's St. Louis Cardinals game",
    link: "https://baseballsavant.mlb.com/",
    feedUrl: "synthetic:cardinals-savant",
    items,
  };
}

const EXTRACT_SESSION_PREFIX = "rss-extract-v3:";
const EXTRACT_SESSION_TTL_MS = 45 * 60_000;
const EXTRACT_SESSION_MAX = 28;
const EXTRACT_SESSION_MAX_BYTES = 180_000;

type ExtractSessionEntry = { at: number; data: RssArticle };

function readExtractSession(url: string): RssArticle | null {
  try {
    const raw = sessionStorage.getItem(EXTRACT_SESSION_PREFIX + url);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ExtractSessionEntry;
    if (!parsed?.data?.contentHtml || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > EXTRACT_SESSION_TTL_MS) {
      sessionStorage.removeItem(EXTRACT_SESSION_PREFIX + url);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeExtractSession(article: RssArticle): void {
  try {
    if (!article?.url || !article.contentHtml) return;
    if (article.contentHtml.length > EXTRACT_SESSION_MAX_BYTES) return;
    const entry: ExtractSessionEntry = { at: Date.now(), data: article };
    sessionStorage.setItem(EXTRACT_SESSION_PREFIX + article.url, JSON.stringify(entry));
    // Bound growth — drop oldest extract keys first.
    const keys: { key: string; at: number }[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key?.startsWith(EXTRACT_SESSION_PREFIX)) continue;
      try {
        const parsed = JSON.parse(sessionStorage.getItem(key) ?? "") as { at?: number };
        keys.push({ key, at: typeof parsed.at === "number" ? parsed.at : 0 });
      } catch {
        keys.push({ key, at: 0 });
      }
    }
    if (keys.length <= EXTRACT_SESSION_MAX) return;
    keys.sort((a, b) => a.at - b.at);
    for (const row of keys.slice(0, keys.length - EXTRACT_SESSION_MAX)) {
      sessionStorage.removeItem(row.key);
    }
  } catch {
    /* quota / private mode */
  }
}

/** True when opening this row needs the rss edge extract (not prebuilt / game UI). */
export function articleNeedsEdgeExtract(
  item: Pick<RssFeedItem, "link" | "contentHtml">,
): boolean {
  if (item.contentHtml) return false;
  if (/espn\.com\/(?:mlb|nfl)\/(?:recap|preview|game)\b/i.test(item.link)) return false;
  if (/espn\.com\/soccer\/(?:match|report|story)\b/i.test(item.link)) return false;
  return /^https?:\/\//i.test(item.link);
}

export function isThinRssExtract(article: Pick<RssArticle, "contentHtml" | "contentText" | "wordCount">): boolean {
  const html = article.contentHtml ?? "";
  const text = article.contentText ?? "";
  const words = article.wordCount || text.split(/\s+/).filter(Boolean).length;
  if (/Open original article/i.test(html) && words < 140) return true;
  return words > 0 && words < 50 && /Open original article/i.test(html);
}

export function clearExtractSession(url?: string): void {
  try {
    if (url) {
      sessionStorage.removeItem(EXTRACT_SESSION_PREFIX + url);
      return;
    }
    const doomed: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(EXTRACT_SESSION_PREFIX)) doomed.push(k);
    }
    doomed.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* private mode */
  }
}

export async function fetchRssArticle(
  url: string,
  opts?: { refresh?: boolean },
): Promise<RssArticle> {
  const cached = opts?.refresh ? null : readExtractSession(url);
  if (cached) {
    // Drop stale Savant nav-chrome extracts from older edge deploys.
    const { isSavantPreviewUrl, isSavantNavSoup } = await import("./savant-preview");
    if (!(isSavantPreviewUrl(url) && isSavantNavSoup(cached.contentHtml || cached.contentText || ""))) {
      return cached;
    }
  }

  // Prefer browser rebuild for Savant — edge often lags redeploys and returns SPA nav.
  if (/baseballsavant\.mlb\.com/i.test(url) && /\/preview(?:\?|#|$)/i.test(url)) {
    const { extractSavantPreviewInBrowser } = await import("./savant-preview");
    const local = await extractSavantPreviewInBrowser(url).catch(() => null);
    if (local) {
      writeExtractSession(local);
      return local;
    }
  }

  try {
    const article = await invokeRss<RssArticle>({
      mode: "read",
      url,
      ...(opts?.refresh ? { refresh: "1" } : {}),
    });
    if (/mlb\.com\/(?:news|gameday|article|press-release|story)\b/i.test(url) && isThinRssExtract(article)) {
      const local = await extractMlbNewsInBrowser(url).catch(() => null);
      if (local && !isThinRssExtract(local)) {
        writeExtractSession(local);
        return local;
      }
    }
    if (/baseballsavant\.mlb\.com/i.test(url)) {
      const { isSavantNavSoup, extractSavantPreviewInBrowser } = await import("./savant-preview");
      if (isSavantNavSoup(article.contentHtml || article.contentText || "")) {
        const local = await extractSavantPreviewInBrowser(url).catch(() => null);
        if (local) {
          writeExtractSession(local);
          return local;
        }
        throw new Error("Savant preview extract returned navigation chrome");
      }
    }
    writeExtractSession(article);
    return article;
  } catch (err) {
    // Edge IPs often get thin STL Today shells — decrypt in the browser as fallback.
    if (/mlb\.com\/(?:news|gameday|article|press-release|story)\b/i.test(url)) {
      const local = await extractMlbNewsInBrowser(url).catch(() => null);
      if (local) {
        writeExtractSession(local);
        return local;
      }
    }
    if (/stltoday\.com/i.test(url)) {
      const local = await extractStlTodayInBrowser(url).catch(() => null);
      if (local) {
        writeExtractSession(local);
        return local;
      }
    }
    if (/baseballsavant\.mlb\.com/i.test(url)) {
      const { extractSavantPreviewInBrowser } = await import("./savant-preview");
      const local = await extractSavantPreviewInBrowser(url).catch(() => null);
      if (local) {
        writeExtractSession(local);
        return local;
      }
    }
    throw err;
  }
}

/**
 * Warm extracts into the React Query cache (idle list / next-up reader).
 * Limited concurrency so we don't stampede the edge function.
 */
export async function prefetchRssArticles(
  urls: string[],
  opts?: {
    concurrency?: number;
    signal?: AbortSignal;
    prefetch?: (url: string) => Promise<unknown>;
  },
): Promise<void> {
  const concurrency = Math.max(1, Math.min(opts?.concurrency ?? 2, 4));
  const unique = [...new Set(urls.filter((u) => /^https?:\/\//i.test(u)))];
  let cursor = 0;

  const worker = async () => {
    while (cursor < unique.length) {
      if (opts?.signal?.aborted) return;
      const idx = cursor++;
      const url = unique[idx]!;
      if (readExtractSession(url)) continue;
      try {
        if (opts?.prefetch) await opts.prefetch(url);
        else await fetchRssArticle(url);
      } catch {
        /* best-effort warm */
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, () => worker()));
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
    resolveArticleTitle(
      unlocked.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
        unlocked.match(/<h1[^>]*class="[^"]*(?:headline|asset-headline|title)[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ||
        null,
      null,
    ) || null;
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

/** Browser-side MLB.com news extract when the edge only got a teaser. */
async function extractMlbNewsInBrowser(url: string): Promise<RssArticle | null> {
  const res = await fetch(url, { headers: { Accept: "text/html" }, credentials: "omit" });
  if (!res.ok) return null;
  const html = await res.text();
  const decode = (s: string) =>
    s
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&mdash;/gi, "—");

  const bodies: string[] = [];
  for (const m of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const data = JSON.parse(m[1] ?? "") as {
        "@type"?: string;
        "@graph"?: { "@type"?: string; articleBody?: string }[];
        articleBody?: string;
      };
      const nodes = [
        data,
        ...(Array.isArray(data["@graph"]) ? data["@graph"] : []),
      ];
      for (const n of nodes) {
        const body = typeof n?.articleBody === "string" ? n.articleBody.trim() : "";
        if (body.length > 400) bodies.push(body);
      }
    } catch {
      /* next */
    }
  }
  let htmlBody = bodies[0] ?? "";
  if (!htmlBody || htmlBody.replace(/<[^>]+>/g, " ").trim().length < 400) {
    const markdown = [
      ...html.matchAll(
        /<div[^>]*class="[^"]*story-part markdown[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      ),
    ].map((m) => m[0]);
    if (markdown.length >= 2) htmlBody = markdown.join("\n");
  }
  if (!htmlBody || htmlBody.replace(/<[^>]+>/g, " ").trim().length < 400) {
    const ps = [
      ...html.matchAll(
        /<p[^>]*class="[^"]*(?:ArticleBody|article-body|body-text)[^"]*"[^>]*>([\s\S]*?)<\/p>/gi,
      ),
    ].map((m) => m[0]);
    if (ps.length >= 3) htmlBody = ps.join("\n");
  }
  if (!htmlBody) return null;
  const contentHtml = /<[a-z][\s\S]*>/i.test(htmlBody)
    ? htmlBody
    : htmlBody
        .split(/\n{2,}/)
        .map((p) => `<p>${decode(p).trim()}</p>`)
        .join("\n");
  const contentText = contentHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (contentText.length < 200) return null;
  const title =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] || null;
  const image =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] || null;
  return {
    url,
    title,
    byline: "MLB.com",
    image,
    contentHtml,
    contentText,
    wordCount: contentText.split(/\s+/).filter(Boolean).length,
  };
}

export function formatFeedDate(raw: string | null): string {
  if (!raw) return "";
  // ESPN RotoWire stamps like "Sun Aug 16 16:41:53 PDT 2026" → Central clock.
  if (/\b(?:PDT|PST|EDT|EST|CDT|CST|MDT|MST)\b/i.test(raw)) {
    return formatCentralDateTime(raw);
  }
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

/** TanStack Query key — scoped per signed-in user. */
export function rssReadsQueryKey(userId?: string | null) {
  return ["rss-reads", userId ?? "anon"] as const;
}

/** Canonical article URL for read/unread storage and lookup. */
export function normalizeReadUrl(url: string): string {
  const raw = url.trim();
  if (!raw) return raw;
  try {
    const u = new URL(raw, "https://local.invalid");
    if (u.protocol === "http:" || u.protocol === "https:") {
      u.hash = "";
      if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
        u.pathname = u.pathname.slice(0, -1);
      }
      return u.toString();
    }
  } catch {
    /* app:/dispatch: links */
  }
  return raw;
}

export function espnGameIdFromUrl(url: string): string | null {
  const m = url.match(/gameId\/(\d+)/i);
  return m?.[1] ?? null;
}

export type ReadLookup = {
  urls: Set<string>;
  espnGameIds: Set<string>;
};

export function buildReadLookup(urls: readonly string[]): ReadLookup {
  const normalized = new Set<string>();
  const espnGameIds = new Set<string>();
  for (const raw of urls) {
    if (!raw) continue;
    normalized.add(raw);
    normalized.add(normalizeReadUrl(raw));
    const gid = espnGameIdFromUrl(raw);
    if (gid) espnGameIds.add(gid);
  }
  return { urls: normalized, espnGameIds };
}

export function isArticleRead(link: string, lookup: ReadLookup): boolean {
  if (lookup.urls.has(link) || lookup.urls.has(normalizeReadUrl(link))) return true;
  const gid = espnGameIdFromUrl(link);
  return gid != null && lookup.espnGameIds.has(gid);
}

export async function fetchRssReads(): Promise<string[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("rss_reads")
    .select("article_url")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.article_url).filter(Boolean);
}

export async function markRssRead(input: {
  articleUrl: string;
  articleTitle?: string | null;
  feedUrl?: string | null;
}): Promise<void> {
  await markRssReadMany([
    { ...input, articleUrl: normalizeReadUrl(input.articleUrl) },
  ]);
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
    article_url: normalizeReadUrl(input.articleUrl),
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
  const normalized = normalizeReadUrl(articleUrl);
  const candidates = [...new Set([articleUrl.trim(), normalized])];
  const { error } = await supabase
    .from("rss_reads")
    .delete()
    .eq("user_id", userId)
    .in("article_url", candidates);
  if (error) throw error;
}

export async function fetchRssHighlightUrls(): Promise<Set<string>> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("rss_highlights")
    .select("article_url")
    .eq("user_id", userId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.article_url as string).filter(Boolean));
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
    articleImage: (r as { article_image?: string | null }).article_image ?? null,
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
  articleImage?: string | null;
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
      article_image: input.articleImage ?? null,
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
    articleImage: (data as { article_image?: string | null }).article_image ?? null,
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

export type RssSave = {
  id: string;
  articleUrl: string;
  articleTitle: string | null;
  feedUrl: string | null;
  image: string | null;
  snippet: string | null;
  author: string | null;
  publishedAt: string | null;
  savedAt: string;
};

export async function fetchRssSaves(): Promise<RssSave[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("rss_saves")
    .select("*")
    .eq("user_id", userId)
    .order("saved_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    articleUrl: r.article_url,
    articleTitle: r.article_title,
    feedUrl: r.feed_url,
    image: r.image,
    snippet: r.snippet,
    author: r.author,
    publishedAt: r.published_at,
    savedAt: r.saved_at,
  }));
}

export async function saveRssArticle(input: {
  articleUrl: string;
  articleTitle?: string | null;
  feedUrl?: string | null;
  image?: string | null;
  snippet?: string | null;
  author?: string | null;
  publishedAt?: string | null;
}): Promise<RssSave> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("rss_saves")
    .upsert(
      {
        user_id: userId,
        article_url: input.articleUrl,
        article_title: input.articleTitle ?? null,
        feed_url: input.feedUrl ?? null,
        image: input.image ?? null,
        snippet: input.snippet ?? null,
        author: input.author ?? null,
        published_at: input.publishedAt ?? null,
        saved_at: new Date().toISOString(),
      },
      { onConflict: "user_id,article_url" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    articleUrl: data.article_url,
    articleTitle: data.article_title,
    feedUrl: data.feed_url,
    image: data.image,
    snippet: data.snippet,
    author: data.author,
    publishedAt: data.published_at,
    savedAt: data.saved_at,
  };
}

export async function unsaveRssArticle(articleUrl: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("rss_saves")
    .delete()
    .eq("user_id", userId)
    .eq("article_url", articleUrl);
  if (error) throw error;
}

/** Feeds that stay out of the cross-feed Unread inbox (browse them on their own). */
export const RSS_SEPARATE_FEEDS = new Set<RssFeedId>([
  "mlb-wraps",
  "nfl-wraps",
  "mlb-stats",
  "mlb-form",
  "soccer-clubs-wraps",
  "epl-wraps",
  "cardinals-farm",
  "cardinals-savant",
]);

/** ESPN wrap/preview feeds — poll until written recap/preview copy lands. */
export const RSS_ESPN_WRAP_FEED_URLS = new Set<string>([
  "synthetic:cardinals-wraps",
  "synthetic:mlb-wraps",
  "synthetic:nfl-wraps",
  "synthetic:soccer-clubs-wraps",
  "synthetic:epl-wraps",
]);

export function isEspnWrapFeedUrl(url: string): boolean {
  return RSS_ESPN_WRAP_FEED_URLS.has(url);
}
