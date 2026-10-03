import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { listFavoritePlayers } from "@/lib/favorite-players";
import {
  chicagoToday,
  fetchMlbScoreboard,
  fetchMlbStandings,
  parsePlayoffPercent,
  type MlbScoredGame,
} from "@/lib/mlb";
import { chicagoTodayNfl, fetchNflScoreboard, type NflScoredGame } from "@/lib/nfl";
import { chicagoTodayNhl, fetchNhlScoreboard, type NhlScoredGame } from "@/lib/nhl";
import { chicagoTodayCfb, fetchCfbScoreboard, type CfbScoredGame } from "@/lib/cfb";
import {
  chicagoTodaySoccer,
  fetchSoccerRuwtBoard,
  loadSoccerTeamInterest,
  rankRuwtSoccerGames,
  type SoccerScoredGame,
} from "@/lib/soccer";
import {
  loadCfbTeamInterest,
  loadNflTeamInterest,
  loadNhlTeamInterest,
  loadTeamInterest,
  rankRuwtCfbGames,
  rankRuwtGames,
  rankRuwtNflGames,
  rankRuwtNhlGames,
  RUWT_INTEREST_EVENT,
  type RuwtTeamInterest,
} from "@/lib/ruwt";
import { fetchTaggedPlayerIds } from "@/lib/sports-player-tags";

export type RuwtSport = "mlb" | "nfl" | "nhl" | "cfb" | "soccer";

export type UnifiedRuwtItem =
  | { sport: "mlb"; score: number; id: string; game: MlbScoredGame }
  | { sport: "nfl"; score: number; id: string; game: NflScoredGame }
  | { sport: "nhl"; score: number; id: string; game: NhlScoredGame }
  | { sport: "cfb"; score: number; id: string; game: CfbScoredGame }
  | { sport: "soccer"; score: number; id: string; game: SoccerScoredGame };

export type RuwtInterestMaps = {
  mlb: RuwtTeamInterest;
  nfl: RuwtTeamInterest;
  nhl: RuwtTeamInterest;
  cfb: RuwtTeamInterest;
  soccer: RuwtTeamInterest;
};

export function ruwtItemHref(item: Pick<UnifiedRuwtItem, "sport"> & { game: { id: string } }): string {
  return `/sports/${item.sport}/game/${item.game.id}`;
}

function loadStoredInterest(): RuwtInterestMaps {
  return {
    mlb: loadTeamInterest(),
    nfl: loadNflTeamInterest(),
    nhl: loadNhlTeamInterest(),
    cfb: loadCfbTeamInterest(),
    soccer: loadSoccerTeamInterest(),
  };
}

function useStoredRuwtInterest(enabled: boolean): RuwtInterestMaps | null {
  const [maps, setMaps] = useState<RuwtInterestMaps | null>(() =>
    enabled ? loadStoredInterest() : null,
  );
  useEffect(() => {
    if (!enabled) return;
    const reload = () => setMaps(loadStoredInterest());
    window.addEventListener(RUWT_INTEREST_EVENT, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(RUWT_INTEREST_EVENT, reload);
      window.removeEventListener("storage", reload);
    };
  }, [enabled]);
  return maps;
}

/**
 * Today's cross-sport RUWT slate (MLB · NFL · NHL · CFB · soccer), ranked by watchability.
 * Pass `interest` when the caller owns editable interest state; otherwise stored values are used.
 */
export function useRuwtSlate(opts?: { interest?: RuwtInterestMaps }) {
  const { user } = useAuth();
  const stored = useStoredRuwtInterest(!opts?.interest);
  const interest = (opts?.interest ?? stored)!;

  const scoreboard = useQuery({
    queryKey: ["mlb-scoreboard", "today", chicagoToday()],
    queryFn: async () => {
      const today = chicagoToday();
      const board = await fetchMlbScoreboard(today);
      // RUWT is same-day only — drop any spill from the schedule hydrate.
      return board.filter((g) => !g.officialDate || g.officialDate === today);
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const nflBoard = useQuery({
    queryKey: ["nfl-scoreboard", "today", chicagoTodayNfl()],
    queryFn: async () => {
      const today = chicagoTodayNfl();
      // ESPN week boards mix days — pin to Chicago today.
      const ymd = today.replace(/-/g, "");
      const board = await fetchNflScoreboard(ymd).catch(() => fetchNflScoreboard());
      return board.filter((g) => !g.date || g.date === today);
    },
    refetchInterval: 20_000,
    staleTime: 10_000,
  });

  const nhlBoard = useQuery({
    queryKey: ["nhl-scoreboard", "today", chicagoTodayNhl()],
    queryFn: async () => {
      const today = chicagoTodayNhl();
      const ymd = today.replace(/-/g, "");
      const board = await fetchNhlScoreboard(ymd).catch(() => fetchNhlScoreboard());
      return board.filter((g) => !g.date || g.date === today);
    },
    refetchInterval: 20_000,
    staleTime: 10_000,
  });

  const cfbBoard = useQuery({
    queryKey: ["cfb-scoreboard", "today", chicagoTodayCfb()],
    queryFn: async () => {
      const today = chicagoTodayCfb();
      const ymd = today.replace(/-/g, "");
      const board = await fetchCfbScoreboard(ymd).catch(() => fetchCfbScoreboard());
      return board.filter((g) => !g.date || g.date === today);
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const soccerBoard = useQuery({
    queryKey: ["soccer-ruwt-board", "today-only", chicagoTodaySoccer()],
    queryFn: async () => {
      const today = chicagoTodaySoccer();
      const board = await fetchSoccerRuwtBoard(today);
      return board.filter((g) => g.date === today);
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const standings = useQuery({
    queryKey: ["mlb-standings"],
    queryFn: () => fetchMlbStandings(),
    staleTime: 120_000,
  });

  const favorites = useQuery({
    queryKey: ["favorite-players", user?.id],
    queryFn: () => listFavoritePlayers(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  const taggedIds = useQuery({
    queryKey: ["sports-player-tags-ids", user?.id],
    queryFn: () => fetchTaggedPlayerIds(),
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  const playoffOddsByTeam = useMemo(() => {
    const out: Record<number, number> = {};
    for (const div of standings.data ?? []) {
      for (const row of div.rows) {
        if (!row.playoffPercent) continue;
        const n = parsePlayoffPercent(row.playoffPercent);
        if (n > 0 || row.playoffPercent.trim().startsWith("<")) out[row.teamId] = n;
      }
    }
    return out;
  }, [standings.data]);

  const watchPlayerIds = useMemo(() => {
    const set = new Set<number>();
    for (const f of favorites.data ?? []) {
      if ((f.position ?? "").toLowerCase() === "manager") continue;
      if (f.sport && f.sport !== "baseball") continue;
      const id = Number(f.playerId);
      if (Number.isFinite(id)) set.add(id);
    }
    for (const id of taggedIds.data ?? []) set.add(id);
    return set;
  }, [favorites.data, taggedIds.data]);

  const watchPlayerNames = useMemo(() => {
    const map = new Map<number, string>();
    for (const f of favorites.data ?? []) {
      if ((f.position ?? "").toLowerCase() === "manager") continue;
      if (f.sport && f.sport !== "baseball") continue;
      const id = Number(f.playerId);
      if (!Number.isFinite(id)) continue;
      const parts = f.playerName.trim().split(/\s+/);
      map.set(id, parts[parts.length - 1] || f.playerName);
    }
    return map;
  }, [favorites.data]);

  const watchManagerIds = useMemo(() => {
    const set = new Set<number>();
    for (const f of favorites.data ?? []) {
      if ((f.position ?? "").toLowerCase() !== "manager") continue;
      const id = Number(f.playerId);
      if (Number.isFinite(id)) set.add(id);
    }
    return set;
  }, [favorites.data]);

  const managerTeamById = useMemo(() => {
    const map = new Map<number, number>();
    for (const f of favorites.data ?? []) {
      if ((f.position ?? "").toLowerCase() !== "manager") continue;
      const mid = Number(f.playerId);
      const tid = f.teamId != null ? Number(f.teamId) : NaN;
      if (Number.isFinite(mid) && Number.isFinite(tid)) map.set(mid, tid);
    }
    return map;
  }, [favorites.data]);

  const nflWatchTeamIds = useMemo(() => {
    const set = new Set<string>();
    for (const f of favorites.data ?? []) {
      const sport = (f.sport ?? "").toLowerCase();
      const league = (f.league ?? "").toLowerCase();
      if (sport !== "football" && sport !== "nfl" && league !== "nfl") continue;
      if (f.teamId) set.add(String(f.teamId));
    }
    return set;
  }, [favorites.data]);

  const nflWatchPlayerIds = useMemo(() => {
    const set = new Set<string>();
    for (const f of favorites.data ?? []) {
      const sport = (f.sport ?? "").toLowerCase();
      const league = (f.league ?? "").toLowerCase();
      if (sport !== "football" && sport !== "nfl" && league !== "nfl") continue;
      if ((f.position ?? "").toLowerCase() === "coach") continue;
      set.add(String(f.playerId));
    }
    return set;
  }, [favorites.data]);

  const nhlWatchTeamIds = useMemo(() => {
    const set = new Set<string>();
    for (const f of favorites.data ?? []) {
      const sport = (f.sport ?? "").toLowerCase();
      const league = (f.league ?? "").toLowerCase();
      if (sport !== "hockey" && sport !== "nhl" && league !== "nhl") continue;
      if (f.teamId) set.add(String(f.teamId));
    }
    return set;
  }, [favorites.data]);

  const ranked = useMemo(() => {
    if (!scoreboard.data) return [] as MlbScoredGame[];
    return rankRuwtGames(
      scoreboard.data,
      {
        teamInterest: interest.mlb,
        watchPlayerIds,
        watchPlayerNames,
        watchManagerIds,
        managerTeamById,
        playoffOddsByTeam,
      },
      30,
    );
  }, [
    scoreboard.data,
    interest.mlb,
    watchPlayerIds,
    watchPlayerNames,
    watchManagerIds,
    managerTeamById,
    playoffOddsByTeam,
  ]);

  const nflRanked = useMemo(() => {
    if (!nflBoard.data) return [] as NflScoredGame[];
    return rankRuwtNflGames(nflBoard.data, interest.nfl, 24, {
      watchPlayerIds: nflWatchPlayerIds,
      watchTeamIds: nflWatchTeamIds,
    });
  }, [nflBoard.data, interest.nfl, nflWatchPlayerIds, nflWatchTeamIds]);

  const nhlRanked = useMemo(() => {
    if (!nhlBoard.data) return [] as NhlScoredGame[];
    return rankRuwtNhlGames(nhlBoard.data, interest.nhl, 24, {
      watchTeamIds: nhlWatchTeamIds,
    });
  }, [nhlBoard.data, interest.nhl, nhlWatchTeamIds]);

  const cfbRanked = useMemo(() => {
    if (!cfbBoard.data) return [] as CfbScoredGame[];
    return rankRuwtCfbGames(cfbBoard.data, interest.cfb, 24);
  }, [cfbBoard.data, interest.cfb]);

  const soccerRanked = useMemo(() => {
    if (!soccerBoard.data) return [] as SoccerScoredGame[];
    return rankRuwtSoccerGames(soccerBoard.data, interest.soccer, 24);
  }, [soccerBoard.data, interest.soccer]);

  const unified = useMemo((): UnifiedRuwtItem[] => {
    const mlbItems: UnifiedRuwtItem[] = ranked.map((g) => ({
      sport: "mlb",
      score: g.score,
      id: `mlb-${g.id}`,
      game: g,
    }));
    const nflItems: UnifiedRuwtItem[] = nflRanked.map((g) => ({
      sport: "nfl",
      score: g.score,
      id: `nfl-${g.id}`,
      game: g,
    }));
    const nhlItems: UnifiedRuwtItem[] = nhlRanked.map((g) => ({
      sport: "nhl",
      score: g.score,
      id: `nhl-${g.id}`,
      game: g,
    }));
    const cfbItems: UnifiedRuwtItem[] = cfbRanked.map((g) => ({
      sport: "cfb",
      score: g.score,
      id: `cfb-${g.id}`,
      game: g,
    }));
    const soccerItems: UnifiedRuwtItem[] = soccerRanked.map((g) => ({
      sport: "soccer",
      score: g.score,
      id: `soccer-${g.id}`,
      game: g,
    }));
    return [...mlbItems, ...nflItems, ...nhlItems, ...cfbItems, ...soccerItems].sort(
      (a, b) => b.score - a.score || a.id.localeCompare(b.id),
    );
  }, [ranked, nflRanked, nhlRanked, cfbRanked, soccerRanked]);

  const allPending =
    scoreboard.isPending &&
    nflBoard.isPending &&
    nhlBoard.isPending &&
    cfbBoard.isPending &&
    soccerBoard.isPending;

  return {
    unified,
    allPending,
    scoreboard,
    nflBoard,
    nhlBoard,
    cfbBoard,
    soccerBoard,
    standings,
  };
}
