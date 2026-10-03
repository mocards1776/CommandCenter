/**
 * Teams Board game list.
 *
 * The Board is the favorite-team list, not a second RUWT feed. Every game
 * involving a visible board favorite is included. RUWT score is used only to
 * fill the remaining slots up to BOARD_TOP_TARGET with interesting games.
 * This module does not re-score; callers pass the slate RUWT already ranked.
 */
import { ruwtPinnedTeamKey } from "./ruwt-slate.ts";

/** How many games the Board aims to show. Favorites can push the list past this. */
export const BOARD_TOP_TARGET = 8;

export type BoardSlateEntry = {
  id: string;
  score: number;
  game: { live: boolean; final: boolean };
};

export type BoardFavoriteTeam = {
  kind: string;
  league?: string | null;
  sport?: string | null;
  mlbTeamId?: number | null;
  espnPath?: string | null;
};

/** `sport:teamId` keys for visible board favorites. Tours and unknown clubs are skipped. */
export function boardFavoriteTeamKeys(favorites: readonly BoardFavoriteTeam[]): Set<string> {
  const keys = new Set<string>();
  for (const fav of favorites) {
    const key = ruwtPinnedTeamKey(fav);
    if (key) keys.add(key);
  }
  return keys;
}

export function boardGameIsFavorite(
  item: {
    sport: string;
    game: { away: { teamId: string | number }; home: { teamId: string | number } };
  },
  favoriteTeamKeys: ReadonlySet<string>,
): boolean {
  return (
    favoriteTeamKeys.has(`${item.sport}:${item.game.away.teamId}`) ||
    favoriteTeamKeys.has(`${item.sport}:${item.game.home.teamId}`)
  );
}

/** Live, then not-yet-started, then final. */
function boardPhase(game: { live: boolean; final: boolean }): number {
  if (game.final) return 2;
  if (game.live) return 0;
  return 1;
}

function byHeat<T extends BoardSlateEntry>(a: T, b: T): number {
  return b.score - a.score || a.id.localeCompare(b.id);
}

/**
 * Favorite-team games, plus the highest-RUWT non-favorites until the list
 * reaches `target`. A favorite is never dropped to make room for heat, and a
 * game is never listed twice.
 *
 * Reading order is live, then upcoming, then final. Favorites lead each group;
 * heat fills in behind them in existing RUWT order.
 */
export function selectBoardTopGames<T extends BoardSlateEntry>(
  slate: readonly T[],
  isFavorite: (item: T) => boolean,
  target = BOARD_TOP_TARGET,
): T[] {
  const favorites: T[] = [];
  const others: T[] = [];
  for (const item of slate) {
    if (isFavorite(item)) favorites.push(item);
    else others.push(item);
  }
  const fillCount = Math.max(0, target - favorites.length);
  const selected = favorites.concat([...others].sort(byHeat).slice(0, fillCount));
  return selected.sort((a, b) => {
    const phase = boardPhase(a.game) - boardPhase(b.game);
    if (phase !== 0) return phase;
    const fav = Number(isFavorite(b)) - Number(isFavorite(a));
    if (fav !== 0) return fav;
    return byHeat(a, b);
  });
}
