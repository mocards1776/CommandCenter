/**
 * The Times viewing guide: today's games, picked by RUWT heat and printed
 * as a Central-time timetable at the back of Section A.
 *
 * Heat is frozen at press time as the pregame pick — never the in-game drama
 * score — and team-interest comes from the Times desk, not RUWT sliders.
 */
import { cfbRivalryName } from "./cfb-team-profile.ts";
import type { GameBroadcast } from "./game-broadcasts.ts";
import { fetchMlbScoreboard, mlbTeamLogo, type MlbScoredGame } from "./mlb.ts";
import {
  fetchWatchCfbBoard,
  fetchWatchNbaBoard,
  fetchWatchNflBoard,
  fetchWatchNhlBoard,
  fetchWatchSoccerBoard,
  fetchWatchWnbaBoard,
  rankWatchSoccerGames,
  scoreWatchBasket,
  wnbaInSeason,
  type WatchBasketGame,
  type WatchSoccerGame,
} from "./newspaper-watch-scoreboard.ts";
import { rankRuwtCfbGames, rankRuwtGames, rankRuwtNflGames, rankRuwtNhlGames } from "./ruwt.ts";
import { DEFAULT_FAVORITES } from "./sports.ts";
import type { CfbScoredGame } from "./cfb.ts";
import type { NflScoredGame } from "./nfl.ts";
import type { NhlScoredGame } from "./nhl.ts";
import {
  asPrintGame,
  pickWatchGames,
  printNetworks,
  printReason,
  timesTeamInterest,
  WATCH_LIST_DEFAULT,
  WATCH_PAGE_GAMES,
  type WatchFavorite,
  type WatchGame,
  type WatchLeague,
  type WatchListOpts,
  type WatchSide,
} from "./newspaper-watch-page.ts";

export * from "./newspaper-watch-page.ts";

const tvOf = (broadcasts: GameBroadcast[] | null | undefined) =>
  [...new Set((broadcasts ?? []).map((b) => b.name).filter(Boolean))];

type Side = {
  name: string;
  abbrev: string;
  record: string | null;
  logo?: string | null;
  rank?: number | null;
  teamId?: string | number | null;
  short?: string | null;
  color?: string | null;
  primaryColor?: string | null;
  score?: unknown;
  starter?: string | null;
  starterLine?: string | null;
  probablePitcher?: string | null;
};
const numScore = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const side = (s: Side, logo: string | null = s.logo ?? null): WatchSide => ({
  name: s.name,
  abbrev: s.abbrev,
  logo,
  record: s.record,
  ...(s.rank != null ? { rank: s.rank } : {}),
  ...(s.teamId != null && String(s.teamId) !== "" ? { teamId: String(s.teamId) } : {}),
  ...(s.short ? { short: s.short } : {}),
  ...((s.color ?? s.primaryColor) ? { color: s.color ?? s.primaryColor } : {}),
  ...(numScore(s.score) != null ? { score: numScore(s.score) } : {}),
  ...((s.starter ?? s.probablePitcher) ? { starter: s.starter ?? s.probablePitcher } : {}),
  ...(s.starterLine ? { starterLine: s.starterLine } : {}),
});

type ExtraBits = {
  short?: string | null;
  starter?: string | null;
  starterLine?: string | null;
  line?: string | null;
};
const bits = <T,>(row: T): T & ExtraBits => row as T & ExtraBits;

type Scored = {
  id: string;
  score: number;
  reasons: string[];
  live: boolean;
  final: boolean;
  venue: string | null;
  broadcasts: GameBroadcast[];
};
const base = (g: Scored, league: WatchLeague, when: string | null, status: string | null) => ({
  id: `${league.toLowerCase()}-${g.id}`,
  league,
  when,
  status,
  live: g.live,
  venue: g.venue,
  tv: printNetworks(tvOf(g.broadcasts)).map((n) => n.name),
  heat: g.score,
  reasons: g.reasons.slice(0, 3),
});

export function watchFromMlb(g: MlbScoredGame): WatchGame {
  const series = g.seriesLine?.trim();
  return {
    ...base(g, "MLB", g.gameDate ?? g.when, g.status),
    competition: null,
    away: side({ ...g.away, color: g.away.primaryColor, starter: g.away.probablePitcher }),
    home: side({ ...g.home, color: g.home.primaryColor, starter: g.home.probablePitcher }),
    ...(series ? { series } : {}),
  };
}

export function watchFromNfl(g: NflScoredGame): WatchGame {
  const extra = bits(g);
  const away = bits(g.away);
  const home = bits(g.home);
  return {
    ...base(g, "NFL", g.startIso ?? null, g.shortDetail ?? g.status),
    competition: null,
    away: side(away),
    home: side(home),
    ...(g.seriesLine?.trim() ? { series: g.seriesLine.trim() } : {}),
    ...(extra.line ? { line: extra.line } : {}),
  };
}

export function watchFromNhl(g: NhlScoredGame): WatchGame {
  const series = g.seriesLine?.trim();
  const extra = bits(g);
  const away = bits(g.away);
  const home = bits(g.home);
  return {
    ...base(g, "NHL", g.startIso ?? null, g.shortDetail ?? g.status),
    competition: null,
    away: side(away),
    home: side(home),
    reasons: [series, ...g.reasons].filter((r): r is string => Boolean(r)).slice(0, 3),
    ...(series ? { series } : {}),
    ...(extra.line ? { line: extra.line } : {}),
  };
}

export function watchFromCfb(g: CfbScoredGame): WatchGame {
  const rivalry = cfbRivalryName(g.away.teamId, g.home.teamId);
  const away = bits(g.away);
  const home = bits(g.home);
  const line = g.odds?.details?.trim();
  return {
    ...base(g, "CFB", g.startIso ?? null, g.shortDetail ?? g.status),
    competition: null,
    away: side(away),
    home: side(home),
    reasons: [rivalry, ...g.reasons].filter((r): r is string => Boolean(r)).slice(0, 3),
    ...(line ? { line } : {}),
  };
}

export function watchFromSoccer(g: WatchSoccerGame & { score: number; reasons: string[] }): WatchGame {
  return {
    ...base(g, "Soccer", g.startIso ?? null, g.shortDetail ?? g.status),
    competition: g.league || null,
    away: side({ ...g.away, score: g.away.score }),
    home: side({ ...g.home, score: g.home.score }),
  };
}

export function watchFromBasket(
  g: WatchBasketGame & { score: number; reasons: string[] },
  league: "NBA" | "WNBA",
): WatchGame {
  const series = g.seriesLine?.trim();
  return {
    ...base(g, league, g.startIso ?? null, g.shortDetail ?? g.status),
    competition: null,
    away: side(g.away),
    home: side(g.home),
    preseason: g.preseason,
    reasons: [series, ...g.reasons].filter((r): r is string => Boolean(r)).slice(0, 3),
    ...(series ? { series } : {}),
    ...(g.line ? { line: g.line } : {}),
  };
}

function deskFavorites(favs?: WatchFavorite[]): WatchFavorite[] {
  if (favs?.length) return favs;
  return DEFAULT_FAVORITES.filter((f) => f.kind === "team");
}

function favoriteLabelFor(game: WatchGame, byId: Map<string, WatchFavorite>): string | null {
  const hits = [game.away.teamId, game.home.teamId]
    .filter((id): id is string => Boolean(id))
    .map((id) => byId.get(id))
    .filter((f): f is WatchFavorite => Boolean(f));
  if (!hits.length) {
    if (game.reasons.some((r) => /cardinals/i.test(r))) return "Cardinals";
    return null;
  }
  if (hits.length > 1) return "Favorite team";
  const name = (hits[0]!.shortName ?? hits[0]!.name ?? "Favorite team").replace(/\s+(FB|BB)$/i, "");
  return name || "Favorite team";
}

function stampDesk(game: WatchGame, byId: Map<string, WatchFavorite>): WatchGame {
  const favoriteLabel = favoriteLabelFor(game, byId);
  const favorite = Boolean(favoriteLabel);
  return {
    ...game,
    favorite,
    favoriteLabel,
    printReason: printReason({ ...game, favorite, favoriteLabel }),
  };
}

async function board<T>(league: string, task: Promise<T[]>): Promise<T[]> {
  try {
    return await task;
  } catch (err) {
    console.warn(`watch desk ${league} scoreboard failed`, err);
    return [];
  }
}

function parseWatchArgs(limitOrOpts?: number | WatchListOpts): { limit: number; favorites?: WatchFavorite[] } {
  if (typeof limitOrOpts === "number") return { limit: limitOrOpts };
  return {
    limit: limitOrOpts?.limit ?? WATCH_LIST_DEFAULT,
    favorites: limitOrOpts?.favorites,
  };
}

function rankBasket(
  games: WatchBasketGame[],
  interest: Record<string, number>,
): (WatchBasketGame & { score: number; reasons: string[] })[] {
  return games
    .map((g) => {
      const { score, reasons } = scoreWatchBasket(g, interest);
      return { ...g, score, reasons };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

/**
 * Today's RUWT slate across every league the desk covers, trimmed to one page.
 * NBA and in-season WNBA ride along at low heat so a light day still prints
 * the full slate; preseason basketball stays in the lowest tier.
 */
export async function fetchWatchList(day: string, limitOrOpts?: number | WatchListOpts): Promise<WatchGame[]> {
  const { limit, favorites } = parseWatchArgs(limitOrOpts);
  const desk = deskFavorites(favorites);
  const interest = timesTeamInterest(desk);
  const ymd = day.replace(/-/g, "");
  const onDay = <G extends { date?: string | null }>(games: G[]) => games.filter((g) => !g.date || g.date === day);
  const [mlb, nfl, nhl, cfb, soccer, nba, wnba] = await Promise.all([
    board("MLB", fetchMlbScoreboard(day)).then((games) => games.filter((g) => !g.officialDate || g.officialDate === day)),
    fetchWatchNflBoard(ymd).then(onDay),
    fetchWatchNhlBoard(ymd).then(onDay),
    fetchWatchCfbBoard(ymd).then(onDay),
    fetchWatchSoccerBoard(day),
    fetchWatchNbaBoard(ymd).then(onDay),
    wnbaInSeason(day) ? fetchWatchWnbaBoard(ymd).then(onDay) : Promise.resolve([] as WatchBasketGame[]),
  ]);
  type Orig = {
    id: string;
    final: boolean;
    live: boolean;
    status?: string | null;
    shortDetail?: string | null;
    away?: { score?: unknown };
    home?: { score?: unknown };
  };
  const attach =
    <S extends { id: string }>(toWatch: (g: S) => WatchGame, originals: Orig[]) => {
      const byId = new Map(originals.map((row) => [row.id, row]));
      return (g: S): WatchGame & { final?: boolean } => {
      const orig = byId.get(g.id);
      const watch = toWatch(g);
      const awayScore = numScore(orig?.away?.score) ?? watch.away.score ?? null;
      const homeScore = numScore(orig?.home?.score) ?? watch.home.score ?? null;
      return {
        ...stampDesk(
          {
            ...watch,
            live: orig?.live ?? watch.live,
            status: orig?.shortDetail ?? orig?.status ?? watch.status,
            final: orig?.final ?? watch.final ?? false,
            away: { ...watch.away, ...(awayScore != null ? { score: awayScore } : {}) },
            home: { ...watch.home, ...(homeScore != null ? { score: homeScore } : {}) },
          },
          interest.byId,
        ),
        final: orig?.final ?? false,
      };
      };
    };
  return pickWatchGames(
    [
      ...rankRuwtGames(
        mlb.map(asPrintGame),
        { teamInterest: interest.mlb, watchPlayerIds: new Set(), watchManagerIds: new Set() },
        30,
      ).map(attach(watchFromMlb, mlb)),
      ...rankRuwtNflGames(nfl.map(asPrintGame), interest.nfl, 24).map(attach(watchFromNfl, nfl)),
      ...rankRuwtNhlGames(nhl.map(asPrintGame), interest.nhl, 24).map(attach(watchFromNhl, nhl)),
      ...rankRuwtCfbGames(cfb.map(asPrintGame), interest.cfb, 24).map(attach(watchFromCfb, cfb)),
      ...rankWatchSoccerGames(soccer.map(asPrintGame), interest.soccer, 24).map(attach(watchFromSoccer, soccer)),
      ...rankBasket(nba.map(asPrintGame), interest.nba).map(attach((g) => watchFromBasket(g, "NBA"), nba)),
      ...rankBasket(wnba.map(asPrintGame), interest.wnba).map(attach((g) => watchFromBasket(g, "WNBA"), wnba)),
    ],
    limit,
  );
}
