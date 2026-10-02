/**
 * The Times viewing guide: today's best games to watch, by RUWT's heat score.
 * Same boards and the same rankers as the RUWT page (team interest, the
 * Cardinals bump, close/live/rivalry signals); the paper keeps the games not
 * yet over and prints one page of them at the back of Section A.
 */
import { fetchCfbScoreboard, type CfbScoredGame } from "./cfb";
import type { GameBroadcast } from "./game-broadcasts";
import { fetchMlbScoreboard, mlbTeamLogo, type MlbScoredGame } from "./mlb";
import { fetchNflScoreboard, type NflScoredGame } from "./nfl";
import { fetchNhlScoreboard, type NhlScoredGame } from "./nhl";
import {
  loadCfbTeamInterest,
  loadNflTeamInterest,
  loadNhlTeamInterest,
  loadTeamInterest,
  rankRuwtCfbGames,
  rankRuwtGames,
  rankRuwtNflGames,
  rankRuwtNhlGames,
} from "./ruwt";
import { fetchSoccerRuwtBoard, loadSoccerTeamInterest, rankRuwtSoccerGames, type SoccerScoredGame } from "./soccer";

export type WatchLeague = "MLB" | "NFL" | "NHL" | "CFB" | "Soccer";

export type WatchSide = {
  name: string;
  abbrev: string;
  logo: string | null;
  record: string | null;
  /** AP rank, college football only. */
  rank?: number | null;
};

export type WatchGame = {
  id: string;
  league: WatchLeague;
  /** Competition name when the league label is not enough (Premier League, Championship). */
  competition: string | null;
  away: WatchSide;
  home: WatchSide;
  /** Start as an ISO instant; the page prints it in Central time. */
  when: string | null;
  status: string | null;
  live: boolean;
  venue: string | null;
  tv: string[];
  /** RUWT heat score; higher is more worth turning on. */
  heat: number;
  reasons: string[];
};

/** One printed page: a game of the day and a column of listings. */
export const WATCH_PAGE_GAMES = 12;

const tvOf = (broadcasts: GameBroadcast[] | null | undefined) =>
  [...new Set((broadcasts ?? []).map((b) => b.name).filter(Boolean))].slice(0, 3);

type Side = { name: string; abbrev: string; record: string | null; logo?: string | null; rank?: number | null };
const side = (s: Side, logo: string | null = s.logo ?? null): WatchSide => ({
  name: s.name,
  abbrev: s.abbrev,
  logo,
  record: s.record,
  ...(s.rank != null ? { rank: s.rank } : {}),
});

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
  tv: tvOf(g.broadcasts),
  heat: g.score,
  reasons: g.reasons.slice(0, 3),
});

export function watchFromMlb(g: MlbScoredGame): WatchGame {
  return {
    ...base(g, "MLB", g.gameDate ?? g.when, g.status),
    competition: null,
    away: side(g.away, mlbTeamLogo(g.away.teamId)),
    home: side(g.home, mlbTeamLogo(g.home.teamId)),
  };
}

export function watchFromNfl(g: NflScoredGame): WatchGame {
  return { ...base(g, "NFL", g.startIso ?? null, g.shortDetail ?? g.status), competition: null, away: side(g.away), home: side(g.home) };
}

export function watchFromNhl(g: NhlScoredGame): WatchGame {
  return { ...base(g, "NHL", g.startIso ?? null, g.shortDetail ?? g.status), competition: null, away: side(g.away), home: side(g.home) };
}

export function watchFromCfb(g: CfbScoredGame): WatchGame {
  return { ...base(g, "CFB", g.startIso ?? null, g.shortDetail ?? g.status), competition: null, away: side(g.away), home: side(g.home) };
}

export function watchFromSoccer(g: SoccerScoredGame): WatchGame {
  return {
    ...base(g, "Soccer", g.startIso ?? null, g.shortDetail ?? g.status),
    competition: g.league || null,
    away: side(g.away),
    home: side(g.home),
  };
}

/** Games still worth turning on, hottest first. Finished games are yesterday's paper. */
export function pickWatchGames(
  games: (WatchGame & { final?: boolean })[],
  limit = WATCH_PAGE_GAMES,
): WatchGame[] {
  return games
    .filter((g) => !g.final)
    .sort((a, b) => b.heat - a.heat || String(a.when ?? "").localeCompare(String(b.when ?? "")) || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map((g) => {
      const out = { ...g };
      delete out.final;
      return out;
    });
}

async function board<T>(task: Promise<T[]>): Promise<T[]> {
  try {
    return await task;
  } catch {
    return [];
  }
}

/** Today's RUWT slate across every league RUWT covers, trimmed to one page. */
export async function fetchWatchList(day: string, limit = WATCH_PAGE_GAMES): Promise<WatchGame[]> {
  const ymd = day.replace(/-/g, "");
  const onDay = <G extends { date?: string | null }>(games: G[]) => games.filter((g) => !g.date || g.date === day);
  const [mlb, nfl, nhl, cfb, soccer] = await Promise.all([
    board(fetchMlbScoreboard(day)).then((games) => games.filter((g) => !g.officialDate || g.officialDate === day)),
    board(fetchNflScoreboard(ymd)).then(onDay),
    board(fetchNhlScoreboard(ymd)).then(onDay),
    board(fetchCfbScoreboard(ymd)).then(onDay),
    board(fetchSoccerRuwtBoard(day)).then((games) => games.filter((g) => g.date === day)),
  ]);
  const flag = <G extends { final: boolean }>(fn: (g: G) => WatchGame) => (g: G) => ({ ...fn(g), final: g.final });
  return pickWatchGames(
    [
      ...rankRuwtGames(mlb, { teamInterest: loadTeamInterest(), watchPlayerIds: new Set(), watchManagerIds: new Set() }, 30).map(flag(watchFromMlb)),
      ...rankRuwtNflGames(nfl, loadNflTeamInterest(), 24).map(flag(watchFromNfl)),
      ...rankRuwtNhlGames(nhl, loadNhlTeamInterest(), 24).map(flag(watchFromNhl)),
      ...rankRuwtCfbGames(cfb, loadCfbTeamInterest(), 24).map(flag(watchFromCfb)),
      ...rankRuwtSoccerGames(soccer, loadSoccerTeamInterest(), 24).map(flag(watchFromSoccer)),
    ],
    limit,
  );
}
