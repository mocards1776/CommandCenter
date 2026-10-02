/** Sports-edition helpers for Thompson Times (digital newspaper). */

import { espnGet, type SportsFavorite, type TeamDetail, type TeamSnapshot, type TeamStatLine } from "./sports";
import type { RssFeedItem } from "./rss";
import { favoriteDeskWeight } from "./newspaper";
import type { WireGame } from "./newspaper-wire";
import type { YesterdayRecapGame } from "./yesterday-recap";

export { favoriteDeskWeight };

export function favoriteTeamHref(fav: SportsFavorite): string {
  const nfl = /football\/nfl\/teams\/(\d+)/.exec(fav.espnPath);
  if (nfl) return `/sports/nfl/team/${nfl[1]}`;
  const cfb = /football\/college-football\/teams\/(\d+)/.exec(fav.espnPath);
  if (cfb) return `/sports/cfb/team/${cfb[1]}`;
  const nhl = /hockey\/nhl\/teams\/(\d+)/.exec(fav.espnPath);
  if (nhl) return `/sports/nhl/team/${nhl[1]}`;
  return `/sports?solo=1&team=${encodeURIComponent(fav.key)}`;
}

export function favoriteGameHref(fav: SportsFavorite, gameId: string): string | null {
  if (!gameId || gameId.startsWith("sb-")) return null;
  if (/baseball\/mlb\//.test(fav.espnPath)) {
    if (gameId.length >= 9) return `https://www.espn.com/mlb/game/_/gameId/${gameId}`;
    return `/sports/mlb/game/${gameId}`;
  }
  if (/football\/nfl\//.test(fav.espnPath)) return `/sports/nfl/game/${gameId}`;
  if (/college-football\//.test(fav.espnPath)) return `/sports/cfb/game/${gameId}`;
  if (/soccer\//.test(fav.espnPath)) return `/sports/soccer/game/${gameId}`;
  if (/hockey\/nhl\//.test(fav.espnPath)) return `/sports/nhl/game/${gameId}`;
  if (/mens-college-basketball\//.test(fav.espnPath)) {
    return `https://www.espn.com/mens-college-basketball/game/_/gameId/${gameId}`;
  }
  if (/basketball\/nba\//.test(fav.espnPath)) return `https://www.espn.com/nba/game/_/gameId/${gameId}`;
  return null;
}

export function playerHref(sportPath: string, playerId: string): string | null {
  if (!playerId) return null;
  if (/baseball\/mlb\//.test(sportPath) || sportPath === "mlb") {
    return `/sports/mlb/player/${playerId}`;
  }
  if (/football\/nfl\//.test(sportPath) || sportPath === "nfl") {
    return `/sports/nfl/player/${playerId}`;
  }
  if (/college-football\//.test(sportPath) || sportPath === "cfb") {
    return `/sports/cfb/player/${playerId}`;
  }
  if (/hockey\/nhl\//.test(sportPath) || sportPath === "nhl") {
    return `/sports/nhl/player/${playerId}`;
  }
  return null;
}

const STL_TODAY_RSS = (section: string) =>
  `https://www.stltoday.com/search/?f=rss&c=${section}*&l=50&s=start_time&sd=desc&t=article`;
export const PD_BLUES_FEED = STL_TODAY_RSS("sports/professional/nhl/blues");
export const PD_CARDINALS_FEED = STL_TODAY_RSS("sports/professional/mlb/cardinals");
export const PD_MIZZOU_FEED = STL_TODAY_RSS("sports/college/mizzou");
export const ATHLETIC_BLUES_FEED = "https://rss.app/feeds/HJaMzlWvefjQfs5f.xml";

/** The Athletic's own league feeds. One per sport the desk follows. */
const ATHLETIC_FEEDS: { prefix: string; url: string }[] = [
  { prefix: "football/nfl/", url: "https://www.nytimes.com/athletic/rss/nfl/" },
  { prefix: "football/college-football/", url: "https://www.nytimes.com/athletic/rss/college-football/" },
  { prefix: "baseball/mlb/", url: "https://www.nytimes.com/athletic/rss/mlb/" },
  { prefix: "basketball/nba/", url: "https://www.nytimes.com/athletic/rss/nba/" },
  { prefix: "basketball/mens-college-basketball/", url: "https://www.nytimes.com/athletic/rss/college-basketball/" },
  { prefix: "hockey/nhl/", url: "https://www.nytimes.com/athletic/rss/nhl/" },
  { prefix: "soccer/eng.1/", url: "https://www.nytimes.com/athletic/rss/premier-league/" },
  { prefix: "soccer/", url: "https://www.nytimes.com/athletic/rss/soccer/" },
];

export function athleticFeedsForEspn(path: string): string[] {
  return ATHLETIC_FEEDS.filter((feed) => path.startsWith(feed.prefix)).map((feed) => feed.url);
}

/** League path an Athletic feed files into, when a followed club plays that sport. */
export function athleticLeaguePath(feedUrl: string, favs: { espnPath: string }[]): string | null {
  const slug = feedUrl.match(/athletic\/rss\/([^/]+)/)?.[1];
  const prefix = ATHLETIC_FEEDS.find((feed) => feed.url.includes(`/rss/${slug}/`))?.prefix;
  if (!prefix) return null;
  const fav = favs.find((f) => f.espnPath.startsWith(prefix));
  if (!fav) return null;
  const parts = fav.espnPath.split("/");
  // soccer/eng.1/team/id → soccer/eng.1. Other sports are league/sport.
  if (prefix === "soccer/") return parts.slice(0, 2).join("/");
  return parts.slice(0, 2).join("/");
}

/** Real club RSS plus synthetic game-wrap boards for the Times desk. */
export function wrapFeedsForFavorites(favs: SportsFavorite[]): string[] {
  const urls = new Set<string>();
  for (const f of favs) {
    if (f.kind !== "team") continue;
    const p = f.espnPath;
    if (p.startsWith("baseball/mlb/")) {
      if (f.key === "mlb-stl" || f.mlbTeamId === 138) {
        urls.add("synthetic:cardinals-wraps");
        urls.add(PD_CARDINALS_FEED);
        // Club wires. Yardbarker and Viral Sports News are dropped at the desk.
        urls.add("https://rss.app/feeds/NY6044y6TPBMOdru.xml");
        urls.add("https://rss.app/feeds/tdKZI96hgDCSMd6o.xml");
      } else {
        urls.add("synthetic:mlb-wraps");
      }
    } else if (p.startsWith("football/nfl/")) {
      urls.add("synthetic:nfl-wraps");
    } else if (p.startsWith("football/college-football/")) {
      urls.add("synthetic:cfb-wraps");
      if (f.key === "cfb-mizzou") {
        urls.add("https://rss.app/feeds/nG7WGKJTs5LOQjxd.xml"); // Missouri Scout
        urls.add(PD_MIZZOU_FEED);
      }
    } else if (p.startsWith("basketball/mens-college-basketball/")) {
      if (f.key === "cbb-mizzou") urls.add(PD_MIZZOU_FEED);
    } else if (p.startsWith("hockey/nhl/")) {
      urls.add("synthetic:nhl-wraps");
      if (f.key === "nhl-stl") {
        urls.add(PD_BLUES_FEED);
        urls.add(ATHLETIC_BLUES_FEED);
      }
    } else if (p.startsWith("soccer/")) {
      urls.add("synthetic:soccer-clubs-wraps");
      if (/eng\.1/.test(p)) urls.add("synthetic:epl-wraps");
    }
    for (const athletic of athleticFeedsForEspn(p)) urls.add(athletic);
  }
  return [...urls];
}

export type MatchedWrap = {
  item: RssFeedItem;
  feedUrl: string;
  favoriteKeys: string[];
  gameHref: string | null;
  gameId: string | null;
};

const WEAK_TOKENS = new Set([
  "the", "and", "st.", "st", "fc", "afc", "club", "city", "united", "state",
  "states", "football", "basketball", "baseball", "hockey", "soccer", "tour",
  "louis", "kansas", "detroit", "missouri",
]);

/** Names a headline must use before it counts as a story about this club. */
export function clubMentionNames(fav: SportsFavorite): string[] {
  return strongNames(fav).filter((name) => name.length >= 4);
}

function strongNames(fav: SportsFavorite): string[] {
  const names = [fav.shortName, fav.name]
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean);
  if (fav.key === "mlb-stl") names.push("cardinals", "st. louis cardinals", "stl");
  if (fav.key === "nfl-kc") names.push("chiefs", "kansas city chiefs", "kc");
  if (fav.key === "nfl-det") names.push("lions", "detroit lions");
  if (fav.key === "cfb-mizzou" || fav.key === "cbb-mizzou") {
    names.push("mizzou", "missouri tigers");
  }
  if (fav.key === "cfb-missouri-state" || fav.key === "cbb-missouri-state") {
    names.push("missouri state", "bears");
  }
  if (fav.key === "eng-wolves") names.push("wolves", "wolverhampton", "wolverhampton wanderers");
  if (fav.key === "eng-wrexham") names.push("wrexham");
  if (fav.key === "eng-arsenal") names.push("arsenal");
  if (fav.key === "nhl-stl") names.push("blues", "st. louis blues");
  if (fav.key === "nfl-dal") names.push("cowboys", "dallas cowboys");
  if (fav.key === "nba-phi") names.push("76ers", "sixers", "philadelphia 76ers");
  return [...new Set(names)].filter((n) => n.length >= 3 && !WEAK_TOKENS.has(n));
}

/** A wrap feed only names clubs in that feed's sport. */
function feedAllowsFavorite(feedUrl: string, fav: SportsFavorite): boolean {
  const path = fav.espnPath;
  // Named club RSS (not the synthetic league boards).
  if (feedUrl.includes("NY6044y6TPBMOdru") || feedUrl.includes("tdKZI96hgDCSMd6o")) {
    return fav.key === "mlb-stl";
  }
  if (feedUrl.includes("nG7WGKJTs5LOQjxd") || feedUrl === PD_MIZZOU_FEED) {
    return fav.key === "cfb-mizzou" || fav.key === "cbb-mizzou";
  }
  if (feedUrl === PD_BLUES_FEED || feedUrl === ATHLETIC_BLUES_FEED) return fav.key === "nhl-stl";
  if (feedUrl === PD_CARDINALS_FEED) return fav.key === "mlb-stl";
  const athletic = ATHLETIC_FEEDS.find((feed) => feed.url === feedUrl);
  if (athletic) return fav.espnPath.startsWith(athletic.prefix);
  if (feedUrl.includes("cardinals-wraps")) return fav.key === "mlb-stl";
  if (feedUrl.includes("mlb")) return path.startsWith("baseball/mlb/");
  if (feedUrl.includes("nfl")) return path.startsWith("football/nfl/");
  if (feedUrl.includes("cfb")) return path.startsWith("football/college-football/");
  if (feedUrl.includes("nhl")) return path.startsWith("hockey/nhl/");
  if (feedUrl.includes("epl")) return /soccer\/eng\.1\//.test(path);
  if (feedUrl.includes("soccer")) return path.startsWith("soccer/");
  return true;
}

function hayHasName(hay: string, name: string): boolean {
  if (name.length <= 3) {
    const re = new RegExp(`(?:^|[^a-z0-9])${name.replace(/\./g, "\\.")}(?:[^a-z0-9]|$)`, "i");
    return re.test(hay);
  }
  return hay.includes(name);
}

function extractGameId(link: string): string | null {
  return (
    link.match(/gameId[=/](\d+)/i)?.[1] ??
    link.match(/\/game\/_\/gameId\/(\d+)/i)?.[1] ??
    null
  );
}

export function matchWrapToFavorites(
  item: RssFeedItem,
  feedUrl: string,
  favs: SportsFavorite[],
): MatchedWrap | null {
  const hay = `${item.title} ${item.snippet ?? ""}`.toLowerCase();
  const keys: string[] = [];

  for (const fav of favs) {
    if (fav.kind !== "team") continue;
    if (!feedAllowsFavorite(feedUrl, fav)) continue;
    let hit = false;
    if (fav.mlbTeamId && item.logoTeamIds?.includes(fav.mlbTeamId)) hit = true;
    if (!hit && item.logoSoccerIds?.length) {
      const espnId = fav.espnPath.split("/").pop();
      if (espnId && item.logoSoccerIds.includes(espnId)) hit = true;
    }
    if (!hit) hit = strongNames(fav).some((n) => hayHasName(hay, n));
    if (!hit && feedUrl.includes("cardinals-wraps") && fav.key === "mlb-stl") hit = true;
    // Single-club desks: every story in the feed is about the club, named or not.
    if (!hit && (feedUrl === PD_BLUES_FEED || feedUrl === PD_MIZZOU_FEED || feedUrl === PD_CARDINALS_FEED)) hit = true;
    if (hit) keys.push(fav.key);
  }

  // One Mizzou feed covers football and hoops; file each story with the right club.
  if (keys.includes("cfb-mizzou") && keys.includes("cbb-mizzou")) {
    const hoops = /\b(basketball|hoops|dennis gates|tip-?off|sec tournament|march madness|ncaa tournament|mizzou arena)\b/i.test(
      `${hay} ${item.link}`,
    );
    keys.splice(keys.indexOf(hoops ? "cfb-mizzou" : "cbb-mizzou"), 1);
  }

  if (!keys.length) return null;

  // Home desk (Cardinals / Blues / Mizzou) wins when a wrap names two clubs.
  keys.sort((a, b) => favoriteDeskWeight(b) - favoriteDeskWeight(a));

  const gameId = extractGameId(item.link) ?? extractGameId(item.id);
  const primary = favs.find((f) => f.key === keys[0]);
  const gameHref =
    gameId && primary
      ? favoriteGameHref(primary, gameId)
      : gameId
        ? inferGameHrefFromFeed(feedUrl, gameId)
        : null;

  return { item, feedUrl, favoriteKeys: keys, gameHref, gameId };
}

function inferGameHrefFromFeed(feedUrl: string, gameId: string): string | null {
  if (feedUrl.includes("nfl")) return `/sports/nfl/game/${gameId}`;
  if (feedUrl.includes("cfb")) return `/sports/cfb/game/${gameId}`;
  if (feedUrl.includes("nhl")) return `/sports/nhl/game/${gameId}`;
  if (feedUrl.includes("mlb") || feedUrl.includes("cardinals")) {
    if (gameId.length >= 9) return `https://www.espn.com/mlb/game/_/gameId/${gameId}`;
    return `/sports/mlb/game/${gameId}`;
  }
  if (feedUrl.includes("soccer") || feedUrl.includes("epl")) {
    return `/sports/soccer/game/${gameId}`;
  }
  return null;
}

function sportPathsForWrap(feedUrl: string, fav?: SportsFavorite | null): string[] {
  if (feedUrl.includes("nfl")) return ["football/nfl"];
  if (feedUrl.includes("cfb")) return ["football/college-football"];
  if (feedUrl.includes("nhl")) return ["hockey/nhl"];
  if (feedUrl.includes("mlb") || feedUrl.includes("cardinals")) return ["baseball/mlb"];
  if (feedUrl.includes("soccer") || feedUrl.includes("epl")) {
    const fromFav = fav?.espnPath.match(/soccer\/([^/]+)\//)?.[1];
    const paths = [];
    if (fromFav) paths.push(`soccer/${fromFav}`);
    paths.push("soccer/eng.1", "soccer/eng.2");
    return [...new Set(paths)];
  }
  if (fav?.espnPath.includes("/teams/")) {
    const base = fav.espnPath.replace(/\/teams\/\d+.*/, "");
    if (base) return [base];
  }
  return [];
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Pull full ESPN wrap prose for a game (summary API, then article extract). */
export async function fetchEspnWrapStoryText(opts: {
  feedUrl: string;
  gameId: string | null;
  link: string;
  fav?: SportsFavorite | null;
}): Promise<string | null> {
  const paths = sportPathsForWrap(opts.feedUrl, opts.fav);
  if (opts.gameId) {
    for (const path of paths) {
      try {
        const sum = (await espnGet(`${path}/summary?event=${opts.gameId}`)) as {
          article?: { story?: string; description?: string; headline?: string };
          news?: { articles?: { story?: string; description?: string; headline?: string }[] };
        };
        const candidates = [
          sum.article,
          ...(sum.news?.articles ?? []),
        ].filter(Boolean);
        let best = "";
        for (const a of candidates) {
          const text = stripHtml(a?.story || "");
          if (text.length > best.length) best = text;
        }
        if (best.length >= 160) return best;
        const desc = (sum.article?.description || "").replace(/^—\s*/, "").trim();
        if (best.length < 80 && desc.length >= 80) return desc;
        if (best.length >= 80) return best;
      } catch {
        /* try next path */
      }
    }
  }

  try {
    const { fetchRssArticle } = await import("./rss");
    const article = await fetchRssArticle(opts.link);
    const text = (article.contentText || stripHtml(article.contentHtml || "")).trim();
    if (text.length >= 120 && readsLikeProse(text)) return text;
  } catch {
    /* ignore */
  }
  return null;
}

/** ESPN box-score shells scrape as run-together labels; keep only real sentences. */
function readsLikeProse(text: string): boolean {
  const head = text.slice(0, 600);
  const sentences = head.match(/[.!?]["')\]]?\s/g)?.length ?? 0;
  if (sentences < 2) return false;
  if (/All Players|Period\s*\d|\d(?:st|nd|rd|th)\s+Period|Team Stats/i.test(head)) {
    return false;
  }
  // Scoreboard scrapes jam words together without spaces after capitals.
  const jammed = head.match(/[a-z][A-Z]/g)?.length ?? 0;
  return jammed < 8;
}

/**
 * Where a club sits in its calendar. A record with nothing left on the schedule
 * means the season is over — which is the Cardinals in October, and is not the
 * same thing as a club that simply hasn't started yet.
 */
export type SeasonState = "active" | "complete" | "upcoming";

export function teamSeasonState(snap: TeamSnapshot): SeasonState {
  if (snap.nextGame) return "active";
  if (snap.record || snap.lastGame) return "complete";
  return "upcoming";
}

export function isTeamInSeason(snap: TeamSnapshot): boolean {
  return teamSeasonState(snap) === "active";
}

export type TeamInfobox = {
  fav: SportsFavorite;
  snap: TeamSnapshot;
  detail: TeamDetail | null;
  href: string;
  seasonState: SeasonState;
  form: ("W" | "L" | "·")[];
  odds: string | null;
  teamStats: TeamStatLine[];
  recentLines: { label: string; won: boolean | null; href: string | null }[];
};

export type GameWrapCard = {
  id: string;
  favoriteKey: string;
  teamName: string;
  teamHref: string;
  sportLabel: string;
  /** ESPN sport path, e.g. baseball/mlb, used to file the story in a section. */
  leaguePath: string | null;
  headline: string;
  dek: string | null;
  /** Full ESPN wrap body when available. */
  body: string | null;
  scoreLine: string | null;
  when: string | null;
  won: boolean | null;
  gameHref: string | null;
  wrapHref: string | null;
  feedUrl: string | null;
  gameId: string | null;
  stats: { label: string; value: string }[];
  leaders: { name: string; line: string; href: string | null }[];
  teamStats: TeamStatLine[];
  division: { rank: string; team: string; record: string; me: boolean }[];
  /** Wire extras — present on stories built from a league board. */
  photo?: string | null;
  /** A player cutout on a transparent ground, set on the club's color rather than cropped. */
  photoStyle?: "cutout";
  caption?: string | null;
  dateline?: string | null;
  round?: string | null;
  series?: string | null;
  postseason?: boolean;
  followed?: boolean;
  status?: string | null;
  boxScore?: { label: string; away: string; home: string }[];
  /** Unread in the previous edition, so it may run again past the 18-hour window. */
  holdover?: boolean;
  /** Place in the source's own list. ESPN leads with what it is pushing; 0 is the top. */
  listRank?: number;
  /** The AI editor's order for this press; 0, 1, 2 are its lead, second and third. */
  editorRank?: number;
  /** The AI editor spiked it for this press. */
  editorSpiked?: boolean;
};

export function buildTeamInfoboxes(
  favs: SportsFavorite[],
  snaps: TeamSnapshot[],
  details: { fav: SportsFavorite; detail: TeamDetail }[],
): TeamInfobox[] {
  const snapBy = new Map(snaps.map((s) => [s.key, s]));
  const detailBy = new Map(details.map((d) => [d.fav.key, d.detail]));
  return favs
    .map((fav) => {
      const snap = snapBy.get(fav.key);
      // Keep finished clubs — the page prints them as a closed-season line
      // rather than pretending they're still playing.
      if (!snap || teamSeasonState(snap) === "upcoming") return null;
      const detail = detailBy.get(fav.key) ?? null;
      const form = (detail?.recent ?? [])
        .slice(0, 5)
        .map((g) => (g.won === true ? "W" : g.won === false ? "L" : "·")) as ("W" | "L" | "·")[];
      const odds = detail?.playoffOdds || detail?.wildCardOdds || null;
      const teamStats = [
        ...(detail?.teamHitting ?? []).slice(0, 3),
        ...(detail?.teamPitching ?? []).slice(0, 2),
        ...(detail?.teamFacts ?? []).slice(0, 3),
      ].slice(0, 5);
      const recentLines = (detail?.recent ?? []).slice(0, 3).map((g) => ({
        label: g.label + (g.detail ? ` ${g.detail}` : ""),
        won: g.won,
        href: favoriteGameHref(fav, g.id),
      }));
      return {
        fav,
        snap,
        detail,
        href: favoriteTeamHref(fav),
        seasonState: teamSeasonState(snap),
        form,
        odds,
        teamStats,
        recentLines,
      } satisfies TeamInfobox;
    })
    .filter((x): x is TeamInfobox => x != null)
    .sort((a, b) => favoriteDeskWeight(b.fav.key) - favoriteDeskWeight(a.fav.key));
}

const LEAGUE_ROOTS = [
  "baseball/mlb",
  "football/nfl",
  "football/college-football",
  "hockey/nhl",
  "basketball/nba",
  "basketball/mens-college-basketball",
] as const;

/** ESPN path of the league a club plays in, without the team id. */
export function leaguePathFromEspn(espnPath: string): string | null {
  for (const root of LEAGUE_ROOTS) {
    if (espnPath === root || espnPath.startsWith(`${root}/`)) return root;
  }
  const soccer = /^(soccer\/[^/]+)(?:\/|$)/.exec(espnPath);
  return soccer?.[1] ?? null;
}

function sportMatchesFavorite(
  fav: SportsFavorite,
  sport: YesterdayRecapGame["sport"],
): boolean {
  const p = fav.espnPath;
  if (sport === "mlb") return /baseball\/mlb\//.test(p);
  if (sport === "nfl") return /football\/nfl\//.test(p);
  if (sport === "cfb") return /college-football\//.test(p);
  if (sport === "nhl") return /hockey\/nhl\//.test(p);
  if (sport === "cbb") return /mens-college-basketball\//.test(p);
  if (sport === "soccer") return /soccer\//.test(p);
  return false;
}

function leadersFromDetail(fav: SportsFavorite, detail: TeamDetail | null) {
  const hit = (detail?.hittingLeaders ?? []).slice(0, 4).map((l) => ({
    name: l.name,
    line: l.line,
    href: l.id ? playerHref(fav.espnPath, l.id) : null,
  }));
  const pit = (detail?.pitchingLeaders ?? []).slice(0, 2).map((l) => ({
    name: l.name,
    line: l.line,
    href: l.id ? playerHref(fav.espnPath, l.id) : null,
  }));
  return [...hit, ...pit].slice(0, 5);
}

function teamStatsFromDetail(detail: TeamDetail | null) {
  return [
    ...(detail?.teamHitting ?? []).slice(0, 4),
    ...(detail?.teamPitching ?? []).slice(0, 3),
    ...(detail?.teamFacts ?? []).slice(0, 4),
  ].slice(0, 8);
}

function divisionFromDetail(detail: TeamDetail | null) {
  return (detail?.division ?? []).slice(0, 6).map((r) => ({
    rank: r.rank,
    team: r.team,
    record: r.record,
    me: r.isMe,
  }));
}

export function buildGameWrapCards(opts: {
  favs: SportsFavorite[];
  details: { fav: SportsFavorite; detail: TeamDetail }[];
  recapGames: YesterdayRecapGame[];
  wraps: MatchedWrap[];
  /** Calendar day the recap board covers, stamped so the 18-hour gate can see it. */
  recapDate?: string | null;
}): GameWrapCard[] {
  const { favs, details, recapGames } = opts;
  const wraps = Array.isArray(opts.wraps) ? opts.wraps : [];
  const favBy = new Map(favs.map((f) => [f.key, f]));
  const cards: GameWrapCard[] = [];
  const seen = new Set<string>();

  function push(card: GameWrapCard) {
    if (seen.has(card.id)) return;
    seen.add(card.id);
    cards.push(card);
  }

  for (const g of recapGames) {
    if (!g.favoriteKeys.length) continue;
    const favKey = g.favoriteKeys[0]!;
    const fav = favBy.get(favKey);
    if (!fav) continue;
    if (!sportMatchesFavorite(fav, g.sport)) continue;

    const wrap =
      wraps.find((w) => w.favoriteKeys.includes(favKey) && w.gameId === g.id) ??
      wraps.find(
        (w) =>
          w.favoriteKeys.includes(favKey) &&
          strongNames(fav).some((n) =>
            hayHasName(`${w.item.title} ${w.item.snippet}`.toLowerCase(), n),
          ),
      );

    const scoreLine = `${g.away.abbrev} ${g.away.score ?? "—"}  ${g.home.abbrev} ${g.home.score ?? "—"}`;
    let favWon: boolean | null = null;
    const names = strongNames(fav);
    if (names.some((t) => hayHasName(g.away.name.toLowerCase(), t))) favWon = g.away.winner;
    else if (names.some((t) => hayHasName(g.home.name.toLowerCase(), t))) favWon = g.home.winner;

    const detail = details.find((d) => d.fav.key === favKey)?.detail ?? null;
    const internalHref = g.href.startsWith("/")
      ? g.href
      : favoriteGameHref(fav, g.id) ?? wrap?.gameHref ?? g.href;

    push({
      id: `recap-${g.id}`,
      favoriteKey: favKey,
      teamName: fav.shortName,
      teamHref: favoriteTeamHref(fav),
      sportLabel: g.sportLabel,
      leaguePath: leaguePathFromEspn(fav.espnPath),
      headline: wrap?.item.title || g.headline,
      dek: wrap?.item.snippet || g.detail,
      body: null,
      scoreLine,
      when: opts.recapDate ? `${opts.recapDate}T23:00:00Z` : null,
      won: favWon,
      gameHref: internalHref,
      wrapHref: wrap?.item.link ?? null,
      feedUrl: wrap?.feedUrl ?? null,
      gameId: wrap?.gameId ?? g.id,
      stats: [
        { label: g.away.abbrev, value: String(g.away.score ?? "—") },
        { label: g.home.abbrev, value: String(g.home.score ?? "—") },
      ],
      leaders: leadersFromDetail(fav, detail),
      teamStats: teamStatsFromDetail(detail),
      division: divisionFromDetail(detail),
    });
  }

  for (const { fav, detail } of details) {
    for (const game of detail.recent.slice(0, 2)) {
      const wrap = wraps.find(
        (w) => w.favoriteKeys.includes(fav.key) && (w.gameId === game.id || w.gameHref?.includes(game.id)),
      );
      push({
        id: `recent-${fav.key}-${game.id}`,
        favoriteKey: fav.key,
        teamName: fav.shortName,
        teamHref: favoriteTeamHref(fav),
        sportLabel: fav.league || fav.sport,
        leaguePath: leaguePathFromEspn(fav.espnPath),
        headline: wrap?.item.title || `${fav.shortName}: ${game.label}`,
        dek: wrap?.item.snippet || game.detail,
        body: null,
        scoreLine: game.detail,
        when: game.when,
        won: game.won,
        gameHref: favoriteGameHref(fav, game.id) ?? wrap?.gameHref ?? null,
        wrapHref: wrap?.item.link ?? null,
        feedUrl: wrap?.feedUrl ?? null,
        gameId: wrap?.gameId ?? game.id,
        stats: [
          { label: "Result", value: game.won === true ? "W" : game.won === false ? "L" : "—" },
          { label: "Matchup", value: game.label },
        ],
        leaders: leadersFromDetail(fav, detail),
        teamStats: teamStatsFromDetail(detail),
        division: divisionFromDetail(detail),
      });
    }
  }

  for (const w of wraps) {
    if (cards.some((c) => c.wrapHref === w.item.link || c.headline === w.item.title)) continue;
    const fav = favBy.get(w.favoriteKeys[0] ?? "") ?? null;
    if (!fav) continue;
    const detail = details.find((d) => d.fav.key === fav.key)?.detail ?? null;
    push({
      id: `wrap-${w.item.id}`,
      favoriteKey: fav.key,
      teamName: fav.shortName,
      teamHref: favoriteTeamHref(fav),
      sportLabel: fav.league || fav.sport,
      leaguePath: leaguePathFromEspn(fav.espnPath),
      headline: w.item.title,
      dek: w.item.snippet,
      body: null,
      photo: feedPhoto(w.item.image),
      scoreLine: null,
      when: w.item.publishedAt,
      won: null,
      gameHref: w.gameHref,
      wrapHref: w.item.link,
      feedUrl: w.feedUrl,
      gameId: w.gameId,
      stats: [],
      leaders: leadersFromDetail(fav, detail),
      teamStats: teamStatsFromDetail(detail),
      division: divisionFromDetail(detail),
    });
  }

  return cards;
}

/** A feed item's own picture — not the crest some feeds stand in when they have none. */
function feedPhoto(src: string | null | undefined): string | null {
  if (!src || !/^https?:\/\//i.test(src)) return null;
  if (/team-?logos?|\/logos?\/|teamlogos|\.svg(\?|$)|placeholder|default-?image/i.test(src)) return null;
  return src;
}

/** A league story from The Athletic that did not name a followed club. */
export function cardFromAthletic(
  item: RssFeedItem,
  feedUrl: string,
  leaguePath: string,
): GameWrapCard | null {
  const headline = item.title?.trim();
  const link = item.link?.trim();
  if (!headline || !link) return null;
  const slug = leaguePath.split("/").pop() ?? "League";
  const sportLabel = slug.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    id: `athletic-${item.id || link}`,
    favoriteKey: "",
    teamName: sportLabel,
    teamHref: link,
    sportLabel,
    leaguePath,
    headline,
    dek: item.snippet?.trim() || null,
    body: item.snippet?.trim() || null,
    scoreLine: null,
    when: item.publishedAt,
    won: null,
    gameHref: link,
    wrapHref: link,
    feedUrl,
    gameId: null,
    stats: [],
    leaders: [],
    teamStats: [],
    division: [],
    photo: feedPhoto(item.image),
    caption: "The Athletic",
    followed: false,
  };
}

/** Club matches stay wraps. Athletic items that name no club still file in that sport. */
export function collectWrapFeeds(
  feeds: { url: string; items: RssFeedItem[] }[],
  favs: SportsFavorite[],
): { wraps: MatchedWrap[]; athletic: GameWrapCard[] } {
  const wraps: MatchedWrap[] = [];
  const athletic: GameWrapCard[] = [];
  const seen = new Set<string>();
  for (const feed of feeds) {
    for (const item of (feed.items ?? []).slice(0, 24)) {
      const key = item.link || item.id;
      if (!key || seen.has(key)) continue;
      const hit = matchWrapToFavorites(item, feed.url, favs);
      if (hit) {
        seen.add(key);
        wraps.push(hit);
        continue;
      }
      const league = athleticLeaguePath(feed.url, favs);
      if (!league) continue;
      const card = cardFromAthletic(item, feed.url, league);
      if (!card) continue;
      seen.add(key);
      athletic.push(card);
    }
  }
  return { wraps, athletic };
}

/** ESPN event id behind a card, used to dedupe wire stories against team wraps. */
function cardEventId(card: GameWrapCard): string | null {
  const raw = card.gameId ?? "";
  const digits = raw.match(/(\d{6,})/)?.[1];
  return digits ?? null;
}

/** Turn league-board games into printable stories. */
function scoreNoun(league: string): string {
  if (league === "MLB") return "Runs";
  if (league === "NHL") return "Goals";
  return "Points";
}

export function wireStoryCards(opts: {
  games: WireGame[];
  favs: SportsFavorite[];
  details: { fav: SportsFavorite; detail: TeamDetail }[];
}): GameWrapCard[] {
  const { games, favs, details } = opts;
  const favBy = new Map(favs.map((f) => [f.key, f]));

  return games.map((g) => {
    const favKey =
      [...g.favoriteKeys].sort((a, b) => favoriteDeskWeight(b) - favoriteDeskWeight(a))[0] ?? "";
    const fav = favBy.get(favKey) ?? null;
    const detail = details.find((d) => d.fav.key === favKey)?.detail ?? null;
    const scored = g.away.score != null && g.home.score != null;
    const mine = fav
      ? strongNames(fav).some(
          (n) =>
            hayHasName(g.away.name.toLowerCase(), n) || hayHasName(g.home.name.toLowerCase(), n),
        )
      : false;
    const won = !g.final || !mine
      ? null
      : strongNames(fav!).some((n) => hayHasName(g.away.name.toLowerCase(), n))
        ? g.away.winner
        : g.home.winner;

    return {
      id: `wire-${g.id}`,
      favoriteKey: favKey,
      teamName: fav?.shortName ?? (g.away.winner ? g.away.short : g.home.short),
      teamHref: fav ? favoriteTeamHref(fav) : g.href,
      sportLabel: g.league,
      leaguePath: g.path,
      headline: g.headline,
      dek: g.series ?? null,
      body: g.body,
      scoreLine: scored
        ? `${g.away.abbrev} ${g.away.score}  ·  ${g.home.abbrev} ${g.home.score}`
        : `${g.away.abbrev} at ${g.home.abbrev}`,
      when: g.startedAt,
      won,
      gameHref: g.href,
      wrapHref: `https://www.espn.com/${g.path.split("/").pop()}/game/_/gameId/${g.eventId}`,
      feedUrl: null,
      gameId: g.eventId,
      stats: scored
        ? [
            { label: g.away.abbrev, value: String(g.away.score) },
            { label: g.home.abbrev, value: String(g.home.score) },
          ]
        : [],
      leaders: g.leaders.length ? g.leaders : fav ? leadersFromDetail(fav, detail) : [],
      teamStats: fav ? teamStatsFromDetail(detail) : [],
      division: fav ? divisionFromDetail(detail) : [],
      photo: g.photo,
      caption: scored
        ? `${g.away.name} at ${g.home.name}. ${g.statusDetail}.`
        : `${g.away.name} at ${g.home.name}.`,
      dateline: g.dateline,
      round: g.round,
      series: g.series,
      postseason: g.postseason,
      followed: g.favoriteKeys.length > 0,
      status: g.statusDetail,
      boxScore: [
        { label: scoreNoun(g.league), away: g.away.score ?? "—", home: g.home.score ?? "—" },
        { label: "Record", away: g.away.record ?? "—", home: g.home.record ?? "—" },
      ],
    } satisfies GameWrapCard;
  });
}

/**
 * One story per game. Wire copy wins over the team-wrap version — it carries the
 * photo, dateline, and series line — but club-only sources (soccer RSS) survive.
 */
export function mergeStoryCards(
  wire: GameWrapCard[],
  teamCards: GameWrapCard[],
): GameWrapCard[] {
  const takenEvents = new Set(wire.map(cardEventId).filter(Boolean) as string[]);
  const takenHeads = new Set(wire.map((c) => c.headline.toLowerCase()));
  const extra = teamCards.filter((c) => {
    const id = cardEventId(c);
    if (id && takenEvents.has(id)) return false;
    return !takenHeads.has(c.headline.toLowerCase());
  });
  return [...wire, ...extra];
}

/**
 * Bracket baseball belongs above the fold even in a week when a followed club
 * won. If nothing in the first `within` slots is a postseason game, the best
 * one is lifted into the last of them rather than left to the foot briefs.
 */
export function promotePostseason(cards: GameWrapCard[], within = 3): GameWrapCard[] {
  if (cards.length <= within) return cards;
  if (cards.slice(0, within).some((c) => c.postseason)) return cards;
  const at = cards.findIndex((c, i) => i >= within && c.postseason);
  if (at < 0) return cards;
  const out = cards.slice();
  const [game] = out.splice(at, 1);
  out.splice(within - 1, 0, game!);
  return out;
}

/** Fill `body` on wrap cards with ESPN recap prose. */
export async function enrichWrapBodies(
  cards: GameWrapCard[],
  favs: SportsFavorite[],
): Promise<GameWrapCard[]> {
  const favBy = new Map(favs.map((f) => [f.key, f]));
  const out = await Promise.all(
    cards.map(async (card) => {
      if (!card.wrapHref && !card.gameId) return card;
      const fav = favBy.get(card.favoriteKey);
      const body = await fetchEspnWrapStoryText({
        feedUrl: card.feedUrl || "",
        gameId: card.gameId,
        link: card.wrapHref || card.gameHref || "",
        fav,
      });
      if (!body) return card;
      return { ...card, body, dek: card.dek || body.slice(0, 180) };
    }),
  );
  return out;
}

export function chunkPages<T>(items: T[], size: number): T[][] {
  if (!items.length) return [];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
