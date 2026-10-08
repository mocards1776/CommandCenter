import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type MlbWsOddsTeam = {
  teamId: number;
  abbrev: string;
  pct: number;
  ticker: string;
};

export type MlbWsOddsBoard = {
  source: "Kalshi";
  eventTicker: string;
  title: string;
  asOf: string;
  asOfLabel: string;
  teams: MlbWsOddsTeam[];
};

function usable(data: MlbWsOddsBoard | null | undefined): MlbWsOddsBoard | null {
  if (!data?.teams?.length) return null;
  return data;
}

/**
 * World Series percents. Dev talks to the Vite stand-in (same parser the edge
 * function caches). Production calls `mlb-ws-odds`. A miss hides the strip.
 */
export async function fetchMlbWorldSeriesOdds(): Promise<MlbWsOddsBoard | null> {
  try {
    if (import.meta.env.DEV) {
      const res = await fetch("/api/mlb-ws-odds");
      if (!res.ok) return null;
      return usable((await res.json()) as MlbWsOddsBoard);
    }
    const { data, error } = await supabase.functions.invoke<MlbWsOddsBoard>("mlb-ws-odds", {
      body: {},
    });
    if (error) return null;
    return usable(data);
  } catch {
    return null;
  }
}

export function useMlbWorldSeriesOdds() {
  return useQuery({
    queryKey: ["mlb-ws-odds"],
    queryFn: fetchMlbWorldSeriesOdds,
    staleTime: 3 * 60_000,
    gcTime: 30 * 60_000,
    refetchInterval: 3 * 60_000,
    retry: false,
  });
}

export function wsPctFor(board: MlbWsOddsBoard | null | undefined, teamId: number | null | undefined): number | null {
  if (teamId == null || !board) return null;
  const row = board.teams.find((t) => t.teamId === teamId);
  return row ? row.pct : null;
}
