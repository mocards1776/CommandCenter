import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  unifyRuwtRanked,
  type RuwtRankInputs,
  type UnifiedRuwtItem,
} from "@/hooks/useRuwtSlate";
import { useRuwtSlateSplit } from "@/hooks/useRuwtSlateSplit";
import { fetchCfbScoreboard } from "@/lib/cfb";
import { fetchMlbScoreboard } from "@/lib/mlb";
import { fetchNflScoreboard } from "@/lib/nfl";
import { fetchNhlScoreboard } from "@/lib/nhl";
import {
  isScoreStripFavorite,
  ruwtPinnedTeamKey,
  scoreStripItems,
  scoreStripTeamKeys,
  type ScoreStripSource,
} from "@/lib/ruwt-slate";
import {
  rankRuwtCfbGames,
  rankRuwtGames,
  rankRuwtNflGames,
  rankRuwtNhlGames,
} from "@/lib/ruwt";
import { fetchSoccerRuwtBoard, rankRuwtSoccerGames } from "@/lib/soccer";
import { loadSportsLayout, visibleFavorites } from "@/lib/sports";
import { shiftDay, todayStr } from "@/lib/utils";

function chicagoYesterday(): string {
  return shiftDay(todayStr(), -1);
}

function useYesterdayFinals(enabled: boolean, rank: RuwtRankInputs): UnifiedRuwtItem[] {
  const day = enabled ? chicagoYesterday() : null;
  const ymd = day?.replace(/-/g, "") ?? "";

  const mlb = useQuery({
    queryKey: ["mlb-scoreboard", "strip-yesterday", day],
    enabled: Boolean(day),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const board = await fetchMlbScoreboard(day!);
      return board.filter((g) => !g.officialDate || g.officialDate === day);
    },
  });
  const nfl = useQuery({
    queryKey: ["nfl-scoreboard", "strip-yesterday", day],
    enabled: Boolean(day),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const board = await fetchNflScoreboard(ymd).catch(() => fetchNflScoreboard());
      return board.filter((g) => !g.date || g.date === day);
    },
  });
  const nhl = useQuery({
    queryKey: ["nhl-scoreboard", "strip-yesterday", day],
    enabled: Boolean(day),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const board = await fetchNhlScoreboard(ymd).catch(() => fetchNhlScoreboard());
      return board.filter((g) => !g.date || g.date === day);
    },
  });
  const cfb = useQuery({
    queryKey: ["cfb-scoreboard", "strip-yesterday", day],
    enabled: Boolean(day),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const board = await fetchCfbScoreboard(ymd).catch(() => fetchCfbScoreboard());
      return board.filter((g) => !g.date || g.date === day);
    },
  });
  const soccer = useQuery({
    queryKey: ["soccer-ruwt-board", "strip-yesterday", day],
    enabled: Boolean(day),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const board = await fetchSoccerRuwtBoard(day!);
      return board.filter((g) => g.date === day);
    },
  });

  return useMemo(() => {
    if (!enabled) return [];
    const { interest } = rank;
    return unifyRuwtRanked({
      mlb: mlb.data
        ? rankRuwtGames(
            mlb.data,
            {
              teamInterest: interest.mlb,
              watchPlayerIds: rank.watchPlayerIds,
              watchPlayerNames: rank.watchPlayerNames,
              watchManagerIds: rank.watchManagerIds,
              managerTeamById: rank.managerTeamById,
              playoffOddsByTeam: rank.playoffOddsByTeam,
            },
            mlb.data.length,
          ).filter((g) => g.final)
        : [],
      nfl: nfl.data
        ? rankRuwtNflGames(nfl.data, interest.nfl, nfl.data.length, {
            watchPlayerIds: rank.nflWatchPlayerIds,
            watchTeamIds: rank.nflWatchTeamIds,
          }).filter((g) => g.final)
        : [],
      nhl: nhl.data
        ? rankRuwtNhlGames(nhl.data, interest.nhl, nhl.data.length, {
            watchTeamIds: rank.nhlWatchTeamIds,
          }).filter((g) => g.final)
        : [],
      cfb: cfb.data
        ? rankRuwtCfbGames(cfb.data, interest.cfb, cfb.data.length).filter((g) => g.final)
        : [],
      soccer: soccer.data
        ? rankRuwtSoccerGames(soccer.data, interest.soccer, soccer.data.length).filter((g) => g.final)
        : [],
    });
  }, [enabled, rank, mlb.data, nfl.data, nhl.data, cfb.data, soccer.data]);
}

function pinnedTeamKeys(): Set<string> {
  const keys = new Set<string>();
  for (const fav of visibleFavorites(loadSportsLayout())) {
    const key = ruwtPinnedTeamKey(fav);
    if (key) keys.add(key);
  }
  return keys;
}

/**
 * Games for the global score-tab strip.
 * Live, else today's upcoming, else yesterday-then-today finals with favorites first.
 * Home Live / Today's Top keep using the today-only slate and are not affected.
 */
export function useScoreStripItems(): { source: ScoreStripSource; items: UnifiedRuwtItem[] } {
  const slate = useRuwtSlateSplit();
  const needYesterday =
    !slate.allPending && slate.live.length === 0 && slate.upcoming.length === 0;
  const yesterdayFinals = useYesterdayFinals(needYesterday, slate.rankInputs);

  return useMemo(() => {
    const pinned = pinnedTeamKeys();
    const interest = slate.rankInputs.interest;
    return scoreStripItems(
      { live: slate.live, upcoming: slate.upcoming, finals: slate.finals },
      {
        yesterdayFinals: needYesterday ? yesterdayFinals : [],
        isFavorite: (item) =>
          isScoreStripFavorite(
            scoreStripTeamKeys(item.sport, item.game.away.teamId, item.game.home.teamId),
            interest[item.sport],
            pinned,
          ),
      },
    );
  }, [
    slate.live,
    slate.upcoming,
    slate.finals,
    slate.rankInputs,
    needYesterday,
    yesterdayFinals,
  ]);
}
