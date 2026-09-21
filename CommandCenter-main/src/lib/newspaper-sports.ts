/** Sports-edition helpers for Thompson Times (digital newspaper). */

import { espnGet, type SportsFavorite, type TeamDetail, type TeamSnapshot } from "./sports";
import type { RssFeedItem } from "./rss";
import type { YesterdayRecapGame } from "./yesterday-recap";

export function favoriteTeamHref(fav: SportsFavorite): string {
  const nfl = /football\/nfl\/teams\/(\d+)/.exec(fav.espnPath);
  if (nfl) return `/sports/nfl/team/${nfl[1]}`;
  const cfb = /football\/college-football\/teams\/(\d+)/.exec(fav.espnPath);
  if (cfb) return `/sports/cfb/team/${cfb[1]}`;
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
  if (/hockey\/nhl\//.test(fav.espnPath)) {
    return `https://www.espn.com/nhl/game/_/gameId/${gameId}`;
  }
  if (/mens-college-basketball\//.test(fav.espnPath)) {
    return `https://www.espn.com/mens-college-basketball/game/_/gameId/${gameId}`;
  }
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
  return null;
}

export function wrapFeedsForFavorites(favs: SportsFavorite[]): string[] {
  const urls = new Set<string>();
  for (const f of favs) {
    if (f.kind !== "team") continue;
    const p = f.espnPath;
    if (p.startsWith("baseball/mlb/")) {
      if (f.key === "mlb-stl" || f.mlbTeamId === 138) urls.add("synthetic:cardinals-wraps");
      else urls.add("synthetic:mlb-wraps");
    } else if (p.startsWith("football/nfl/")) {
      urls.add("synthetic:nfl-wraps");
    } else if (p.startsWith("football/college-football/")) {
      urls.add("synthetic:cfb-wraps");
    } else if (p.startsWith("soccer/")) {
      urls.add("synthetic:soccer-clubs-wraps");
      if (/eng\.1/.test(p)) urls.add("synthetic:epl-wraps");
    }
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
  return [...new Set(names)].filter((n) => n.length >= 3 && !WEAK_TOKENS.has(n));
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
    let hit = false;
    if (fav.mlbTeamId && item.logoTeamIds?.includes(fav.mlbTeamId)) hit = true;
    if (!hit && item.logoSoccerIds?.length) {
      const espnId = fav.espnPath.split("/").pop();
      if (espnId && item.logoSoccerIds.includes(espnId)) hit = true;
    }
    if (!hit) hit = strongNames(fav).some((n) => hayHasName(hay, n));
    if (!hit && feedUrl.includes("cardinals-wraps") && fav.key === "mlb-stl") hit = true;
    if (hit) keys.push(fav.key);
  }

  if (!keys.length) return null;

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
    if (text.length >= 120) return text;
  } catch {
    /* ignore */
  }
  return null;
}

export function isTeamInSeason(snap: TeamSnapshot): boolean {
  return Boolean(snap.nextGame || snap.record);
}

export type TeamInfobox = {
  fav: SportsFavorite;
  snap: TeamSnapshot;
  detail: TeamDetail | null;
  href: string;
  form: ("W" | "L" | "·")[];
  odds: string | null;
  teamStats: { label: string; value: string }[];
  recentLines: { label: string; won: boolean | null; href: string | null }[];
};

export type GameWrapCard = {
  id: string;
  favoriteKey: string;
  teamName: string;
  teamHref: string;
  sportLabel: string;
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
  teamStats: { label: string; value: string }[];
  division: { rank: string; team: string; record: string; me: boolean }[];
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
      if (!snap || !isTeamInSeason(snap)) return null;
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
        form,
        odds,
        teamStats,
        recentLines,
      } satisfies TeamInfobox;
    })
    .filter((x): x is TeamInfobox => x != null);
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

const MAX_WRAP_CARDS = 8;

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
}): GameWrapCard[] {
  const { favs, details, recapGames, wraps } = opts;
  const favBy = new Map(favs.map((f) => [f.key, f]));
  const cards: GameWrapCard[] = [];
  const seen = new Set<string>();

  function push(card: GameWrapCard) {
    if (cards.length >= MAX_WRAP_CARDS) return;
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
      headline: wrap?.item.title || g.headline,
      dek: wrap?.item.snippet || g.detail,
      body: null,
      scoreLine,
      when: null,
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
      if (cards.length >= MAX_WRAP_CARDS) break;
      const wrap = wraps.find(
        (w) => w.favoriteKeys.includes(fav.key) && (w.gameId === game.id || w.gameHref?.includes(game.id)),
      );
      push({
        id: `recent-${fav.key}-${game.id}`,
        favoriteKey: fav.key,
        teamName: fav.shortName,
        teamHref: favoriteTeamHref(fav),
        sportLabel: fav.league || fav.sport,
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
    if (cards.length >= MAX_WRAP_CARDS) break;
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
      headline: w.item.title,
      dek: w.item.snippet,
      body: null,
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
