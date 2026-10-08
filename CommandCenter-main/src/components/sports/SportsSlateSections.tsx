import { useMemo } from "react";
import { useRuwtSlateSplit } from "@/hooks/useRuwtSlateSplit";
import { SlateScoreboardCard } from "@/components/sports/ScoreboardCard";
import { boardGameIsFavorite, selectBoardTopGames } from "@/lib/board-top-games";
import { useMlbWorldSeriesOdds } from "@/lib/mlb-ws-odds";

/**
 * Teams Board main list: favorite-team games, with RUWT heat filling the
 * remaining spots. Not the full live board, and not a link into RUWT.
 */
export default function SportsSlateSections({
  favoriteTeamKeys,
}: {
  favoriteTeamKeys: ReadonlySet<string>;
}) {
  const slate = useRuwtSlateSplit();
  const wsOdds = useMlbWorldSeriesOdds();
  const games = useMemo(
    () => selectBoardTopGames(slate.unified, (item) => boardGameIsFavorite(item, favoriteTeamKeys)),
    [slate.unified, favoriteTeamKeys],
  );

  if (slate.allPending) return null;
  if (games.length === 0) return null;

  const anyLive = games.some((item) => item.game.live && !item.game.final);

  return (
    <section>
      <div className="mb-1 flex items-center gap-2">
        <h2 className="inline-flex items-center gap-2">
          {anyLive ? <span className="bg-alert inline-block h-2 w-2 animate-pulse rounded-full" /> : null}
          <span className="rule-head">Top games</span>
          <span className="text-chalk-dim numeral text-[11px]">({games.length})</span>
        </h2>
      </div>
      <p className="text-chalk-dim mb-3 text-[12px]">
        Every favorite team playing today, with the hottest other games around them.
      </p>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {games.map((item) => (
          <SlateScoreboardCard
            key={item.id}
            item={item}
            favorite={boardGameIsFavorite(item, favoriteTeamKeys)}
            wsBoard={wsOdds.data}
          />
        ))}
      </div>
    </section>
  );
}
