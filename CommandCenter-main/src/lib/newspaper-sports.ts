/** Sports-edition helpers for Thompson Times (digital newspaper). */

import {
  type SportsFavorite,
  type TeamDetail,
  type TeamSnapshot,
} from "./sports";
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
  if (/baseball\/mlb\//.test(fav.espnPath)) return `/sports/mlb/game/${gameId}`;
  if (/football\/nfl\//.test(fav.espnPath)) return `/sports/nfl/game/${gameId}`;
  if (/college-football\//.test(fav.espnPath)) return `/sports/cfb/game/${gameId}`;
  if (/soccer\//.test(fav.espnPath)) {
    return `https://www.espn.com/soccer/match/_/gameId/${gameId}`;
  }
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
      if (f.key === "mlb-stl" || f.mlbTeamId === 138) {
        urls.add("synthetic:cardinals-wraps");
      }
      urls.add("synthetic:mlb-wraps");
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
};

function teamTokens(fav: SportsFavorite): string[] {
  const bits = [
    fav.shortName,
    fav.name,
    fav.name.replace(/^St\.\s+/i, ""),
    ...fav.shortName.split(/\s+/),
    ...fav.name.split(/\s+/),
  ];
  return [...new Set(bits.map((b) => b.toLowerCase()).filter((b) => b.length > 2))];
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
    if (!hit && item.logoAbbrevs?.length) {
      const abbr = fav.shortName.slice(0, 3).toUpperCase();
      if (item.logoAbbrevs.some((a) => a.toUpperCase() === abbr)) hit = true;
    }
    if (!hit) {
      const tokens = teamTokens(fav);
      hit = tokens.some((t) => hay.includes(t));
    }
    if (hit) keys.push(fav.key);
  }

  if (!keys.length) return null;

  const gameId =
    item.link.match(/gameId[=/](\d+)/i)?.[1] ??
    item.link.match(/\/game\/_\/gameId\/(\d+)/i)?.[1] ??
    null;

  const primary = favs.find((f) => f.key === keys[0]);
  const gameHref =
    gameId && primary
      ? favoriteGameHref(primary, gameId)
      : gameId
        ? inferGameHrefFromFeed(feedUrl, gameId)
        : null;

  return { item, feedUrl, favoriteKeys: keys, gameHref };
}

function inferGameHrefFromFeed(feedUrl: string, gameId: string): string | null {
  if (feedUrl.includes("nfl")) return `/sports/nfl/game/${gameId}`;
  if (feedUrl.includes("cfb")) return `/sports/cfb/game/${gameId}`;
  if (feedUrl.includes("mlb") || feedUrl.includes("cardinals")) {
    return `/sports/mlb/game/${gameId}`;
  }
  if (feedUrl.includes("soccer") || feedUrl.includes("epl")) {
    return `https://www.espn.com/soccer/match/_/gameId/${gameId}`;
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
};

export type GameWrapCard = {
  id: string;
  favoriteKey: string;
  teamName: string;
  teamHref: string;
  sportLabel: string;
  headline: string;
  dek: string | null;
  scoreLine: string | null;
  when: string | null;
  won: boolean | null;
  gameHref: string | null;
  wrapHref: string | null;
  stats: { label: string; value: string }[];
  leaders: { name: string; line: string; href: string | null }[];
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
      return {
        fav,
        snap,
        detail: detailBy.get(fav.key) ?? null,
        href: favoriteTeamHref(fav),
      } satisfies TeamInfobox;
    })
    .filter((x): x is TeamInfobox => x != null);
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

  // Prefer yesterday's finished games for followed teams.
  for (const g of recapGames) {
    if (!g.favoriteKeys.length) continue;
    const favKey = g.favoriteKeys[0]!;
    const fav = favBy.get(favKey);
    if (!fav) continue;
    const id = `recap-${g.id}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const wrap = wraps.find((w) => w.favoriteKeys.includes(favKey));
    const scoreLine = `${g.away.abbrev} ${g.away.score ?? "—"} · ${g.home.abbrev} ${g.home.score ?? "—"}`;
    let favWon: boolean | null = null;
    const tokens = teamTokens(fav);
    const awayHit = tokens.some(
      (t) =>
        g.away.name.toLowerCase().includes(t) ||
        g.away.abbrev.toLowerCase() === t.slice(0, 3),
    );
    const homeHit = tokens.some(
      (t) =>
        g.home.name.toLowerCase().includes(t) ||
        g.home.abbrev.toLowerCase() === t.slice(0, 3),
    );
    if (awayHit) favWon = g.away.winner;
    else if (homeHit) favWon = g.home.winner;

    const detail = details.find((d) => d.fav.key === favKey)?.detail ?? null;
    const leaders = (detail?.hittingLeaders ?? [])
      .slice(0, 3)
      .map((l) => ({
        name: l.name,
        line: l.line,
        href: l.id ? playerHref(fav.espnPath, l.id) : null,
      }));

    cards.push({
      id,
      favoriteKey: favKey,
      teamName: fav.shortName,
      teamHref: favoriteTeamHref(fav),
      sportLabel: g.sportLabel,
      headline: wrap?.item.title || g.headline,
      dek: wrap?.item.snippet || g.detail,
      scoreLine,
      when: null,
      won: favWon,
      gameHref: g.href.startsWith("/") ? g.href : wrap?.gameHref ?? g.href,
      wrapHref: wrap?.item.link ?? null,
      stats: [
        { label: "Away", value: `${g.away.abbrev} ${g.away.score ?? "—"}` },
        { label: "Home", value: `${g.home.abbrev} ${g.home.score ?? "—"}` },
      ],
      leaders,
    });
  }

  // Fill from team recent schedule when recap is thin.
  for (const { fav, detail } of details) {
    for (const game of detail.recent.slice(0, 3)) {
      const id = `recent-${fav.key}-${game.id}`;
      if (seen.has(id) || seen.has(`recap-${game.id}`)) continue;
      seen.add(id);
      const wrap = wraps.find(
        (w) =>
          w.favoriteKeys.includes(fav.key) &&
          (w.gameHref?.includes(game.id) ||
            w.item.title.toLowerCase().includes(fav.shortName.toLowerCase())),
      );
      const gameHref = favoriteGameHref(fav, game.id) ?? wrap?.gameHref ?? null;
      cards.push({
        id,
        favoriteKey: fav.key,
        teamName: fav.shortName,
        teamHref: favoriteTeamHref(fav),
        sportLabel: fav.league || fav.sport,
        headline: wrap?.item.title || `${fav.shortName}: ${game.label}`,
        dek: wrap?.item.snippet || game.detail,
        scoreLine: game.detail,
        when: game.when,
        won: game.won,
        gameHref,
        wrapHref: wrap?.item.link ?? null,
        stats: [
          { label: "Result", value: game.won === true ? "W" : game.won === false ? "L" : "—" },
          { label: "Matchup", value: game.label },
        ],
        leaders: (detail.hittingLeaders ?? [])
          .slice(0, 2)
          .map((l) => ({
            name: l.name,
            line: l.line,
            href: l.id ? playerHref(fav.espnPath, l.id) : null,
          })),
      });
    }
  }

  // Noteworthy wraps that didn't match a card yet.
  for (const w of wraps) {
    const id = `wrap-${w.item.id}`;
    if (seen.has(id)) continue;
    if (cards.some((c) => c.wrapHref === w.item.link || c.headline === w.item.title)) continue;
    const fav = favBy.get(w.favoriteKeys[0] ?? "") ?? null;
    if (!fav) continue;
    seen.add(id);
    cards.push({
      id,
      favoriteKey: fav.key,
      teamName: fav.shortName,
      teamHref: favoriteTeamHref(fav),
      sportLabel: fav.league || fav.sport,
      headline: w.item.title,
      dek: w.item.snippet,
      scoreLine: null,
      when: w.item.publishedAt,
      won: null,
      gameHref: w.gameHref,
      wrapHref: w.item.link,
      stats: [],
      leaders: [],
    });
  }

  return cards;
}

export function chunkPages<T>(items: T[], size: number): T[][] {
  if (!items.length) return [];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
