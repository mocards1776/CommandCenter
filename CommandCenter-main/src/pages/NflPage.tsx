import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import LogoPlate from "@/components/sports/LogoPlate";
import NflFieldMap, { NflScoreRow } from "@/components/sports/NflFieldMap";
import { useAuth } from "@/lib/auth-context";
import { listFavoritePlayers } from "@/lib/favorite-players";
import { fetchNflScoreboard, pickNflHeroGame, rankNflRuwtGames } from "@/lib/nfl";
import { loadNflTeamInterest } from "@/lib/ruwt";
import { markSportsSolo } from "@/lib/sports-home";
import { cn } from "@/lib/utils";

export default function NflPage() {
  const { user } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("solo") === "1") markSportsSolo();
  }, []);

  const scoreboard = useQuery({
    queryKey: ["nfl-scoreboard"],
    queryFn: () => fetchNflScoreboard(),
    refetchInterval: 20_000,
    staleTime: 10_000,
  });

  const favorites = useQuery({
    queryKey: ["favorite-players", user?.id],
    queryFn: () => listFavoritePlayers(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  const nflInterest = useMemo(() => loadNflTeamInterest(), []);

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

  const games = scoreboard.data ?? [];
  const heatById = useMemo(() => {
    const ranked = rankNflRuwtGames(
      games,
      {
        teamInterest: nflInterest,
        watchPlayerIds: new Set(),
        watchTeamIds: nflWatchTeamIds,
      },
      Math.max(games.length, 1),
    );
    const map = new Map<string, { score: number; reasons: string[] }>();
    for (const g of ranked) map.set(String(g.id), { score: g.score, reasons: g.reasons });
    return map;
  }, [games, nflInterest, nflWatchTeamIds]);

  const live = useMemo(() => games.filter((g) => g.live), [games]);
  const upcoming = useMemo(() => games.filter((g) => !g.live && !g.final), [games]);
  const finals = useMemo(() => games.filter((g) => g.final), [games]);
  const hero = games.length ? pickNflHeroGame(games) : null;
  const featured = hero?.live ? hero : null;
  const liveRest = useMemo(
    () => (featured ? live.filter((g) => g.id !== featured.id) : live),
    [live, featured],
  );

  const refresh = () => {
    void scoreboard.refetch().then(() => toast.success("NFL updated"));
  };

  return (
    <div className="flex min-h-0 flex-col gap-5 p-4 md:p-7">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
        <div className="flex items-baseline gap-x-2.5 gap-y-1">
          <h2 className="font-display text-cream text-[22px] leading-none sm:text-[26px]">
            NFL <span className="text-accent">scores</span>
          </h2>
          {live.length > 0 ? (
            <span className="text-alert text-[10px] font-semibold uppercase tracking-[0.14em]">
              <span className="bg-alert mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full" />
              {live.length} live
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/sports/ruwt?solo=1"
            className="text-chalk hover:text-cream rounded-sm border border-white/10 px-3 py-2 text-[10.5px] uppercase tracking-[0.14em] transition hover:border-accent/40"
          >
            RUWT
          </Link>
          <button
            type="button"
            onClick={refresh}
            disabled={scoreboard.isFetching}
            className="text-chalk hover:text-cream flex items-center gap-2 rounded-sm border border-white/10 px-3 py-2 text-[10.5px] uppercase tracking-[0.14em] transition hover:border-accent/40 disabled:opacity-40"
          >
            <RefreshCw size={13} className={scoreboard.isFetching ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </header>

      {scoreboard.isPending ? (
        <p className="text-chalk flex items-center gap-2 text-[13px]">
          <Loader2 size={14} className="animate-spin" /> Loading NFL…
        </p>
      ) : scoreboard.isError ? (
        <p className="text-alert text-[13px]">Couldn’t load the NFL scoreboard.</p>
      ) : (
        <>
          {live.length > 0 && (
            <section className="space-y-3">
              <h3 className="rule-head">Live</h3>
              {featured && (
                <Link
                  to={`/sports/nfl/game/${featured.id}`}
                  className="bg-panel block overflow-hidden rounded-xl border border-white/[0.1] transition hover:border-white/20"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
                    <div className="flex items-center gap-4">
                      {[featured.away, featured.home].map((s) => (
                        <div key={s.teamId} className="flex items-center gap-2">
                          {s.logo && <LogoPlate src={s.logo} className="h-8 w-8" />}
                          <div>
                            <p className="text-cream text-[14px] font-semibold">{s.abbrev}</p>
                            <p className="text-chalk-dim text-[10px]">{s.record}</p>
                          </div>
                          <span className="numeral text-cream text-[26px]">{s.score ?? 0}</span>
                        </div>
                      ))}
                    </div>
                    <p className={cn("text-[11px] font-semibold uppercase tracking-[0.14em]", "text-alert")}>
                      {featured.shortDetail}
                    </p>
                  </div>
                  <div className="p-3">
                    <NflFieldMap
                      game={featured}
                      homeYardLine={featured.situation?.yardLine ?? null}
                      possessionTeamId={featured.situation?.possessionTeamId ?? null}
                      downDistanceText={featured.situation?.downDistanceText}
                    />
                  </div>
                </Link>
              )}
              {liveRest.length > 0 && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {liveRest.map((g) => (
                    <NflScoreRow
                      key={g.id}
                      game={g}
                      to={`/sports/nfl/game/${g.id}`}
                      heat={heatById.get(String(g.id))?.score}
                      reasons={heatById.get(String(g.id))?.reasons}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
          {upcoming.length > 0 && (
            <section>
              <h3 className="rule-head mb-3">Upcoming</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {upcoming.map((g) => (
                  <NflScoreRow
                    key={g.id}
                    game={g}
                    to={`/sports/nfl/game/${g.id}`}
                    heat={heatById.get(String(g.id))?.score}
                    reasons={heatById.get(String(g.id))?.reasons}
                  />
                ))}
              </div>
            </section>
          )}
          {finals.length > 0 && (
            <section>
              <h3 className="rule-head mb-3">Final</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {finals.map((g) => (
                  <NflScoreRow
                    key={g.id}
                    game={g}
                    to={`/sports/nfl/game/${g.id}`}
                    heat={heatById.get(String(g.id))?.score}
                    reasons={heatById.get(String(g.id))?.reasons}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
