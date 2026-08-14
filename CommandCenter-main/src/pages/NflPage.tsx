import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw, Share } from "lucide-react";
import toast from "react-hot-toast";
import StarField from "@/components/StarField";
import NflFieldMap, { NflScoreRow } from "@/components/sports/NflFieldMap";
import { fetchNflScoreboard, pickNflHeroGame } from "@/lib/nfl";
import { markSportsSolo } from "@/lib/sports-home";
import { cn } from "@/lib/utils";

export default function NflPage() {
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

  const games = scoreboard.data ?? [];
  const live = useMemo(() => games.filter((g) => g.live), [games]);
  const upcoming = useMemo(() => games.filter((g) => !g.live && !g.final), [games]);
  const finals = useMemo(() => games.filter((g) => g.final), [games]);
  const hero = games.length ? pickNflHeroGame(games) : null;

  const refresh = () => {
    void scoreboard.refetch().then(() => toast.success("NFL updated"));
  };

  return (
    <div className="flex min-h-0 flex-col gap-5 p-4 md:p-7">
      <div className="relative overflow-hidden rounded-lg border border-accent/25 bg-gradient-to-br from-hero-lift to-hero p-5 sm:p-7">
        <StarField count={28} seed={28} />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="rule-head mb-2">National Football League</div>
            <h2 className="font-display text-cream text-[28px] leading-tight sm:text-[34px]">
              Live <span className="text-accent">NFL</span>
            </h2>
            <p className="text-chalk mt-2 max-w-lg text-[13px] leading-relaxed">
              Scoreboard, live field map, play-by-play — and{" "}
              <Link to="/sports/ruwt?solo=1" className="text-accent hover:underline">
                RUWT
              </Link>{" "}
              including NFL games.
            </p>
            {live.length > 0 && (
              <p className="text-alert mt-2 text-[11px] font-semibold uppercase tracking-[0.16em]">
                <span className="bg-alert mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full" />
                {live.length} live now
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/sports.html"
              className="text-chalk hover:text-cream flex items-center gap-2 rounded-sm border border-white/10 px-3 py-2 text-[10.5px] uppercase tracking-[0.14em] transition hover:border-accent/40"
            >
              <Share size={13} />
              Home Screen
            </a>
            <button
              type="button"
              onClick={refresh}
              disabled={scoreboard.isFetching}
              className="text-chalk hover:text-cream flex items-center gap-2 rounded-sm border border-white/10 px-3 py-2 text-[10.5px] uppercase tracking-[0.14em] transition hover:border-accent/40 disabled:opacity-40"
            >
              <RefreshCw size={13} className={scoreboard.isFetching ? "animate-spin" : ""} />
              Refresh
            </button>
            <Link
              to="/sports"
              className="from-accent-deep to-accent-dark text-cream rounded-sm bg-gradient-to-b px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.14em]"
            >
              My teams
            </Link>
          </div>
        </div>
      </div>

      {hero?.live && (
        <section className="space-y-3">
          <h3 className="rule-head">Live now</h3>
          <Link
            to={`/sports/nfl/game/${hero.id}`}
            className="bg-panel block overflow-hidden rounded-xl border border-white/[0.1] transition hover:border-white/20"
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
              <div className="flex items-center gap-4">
                {[hero.away, hero.home].map((s) => (
                  <div key={s.teamId} className="flex items-center gap-2">
                    {s.logo && <img src={s.logo} alt="" className="h-8 w-8 object-contain" />}
                    <div>
                      <p className="text-cream text-[14px] font-semibold">{s.abbrev}</p>
                      <p className="text-chalk-dim text-[10px]">{s.record}</p>
                    </div>
                    <span className="numeral text-cream text-[26px]">{s.score ?? 0}</span>
                  </div>
                ))}
              </div>
              <p className={cn("text-[11px] font-semibold uppercase tracking-[0.14em]", "text-alert")}>
                {hero.shortDetail}
              </p>
            </div>
            <div className="p-3">
              <NflFieldMap
                game={hero}
                homeYardLine={hero.situation?.yardLine ?? null}
                possessionTeamId={hero.situation?.possessionTeamId ?? null}
                downDistanceText={hero.situation?.downDistanceText}
              />
            </div>
          </Link>
        </section>
      )}

      {scoreboard.isPending ? (
        <p className="text-chalk flex items-center gap-2 text-[13px]">
          <Loader2 size={14} className="animate-spin" /> Loading NFL…
        </p>
      ) : scoreboard.isError ? (
        <p className="text-alert text-[13px]">Couldn’t load the NFL scoreboard.</p>
      ) : (
        <>
          {live.length > 0 && (
            <section>
              <h3 className="rule-head mb-3">In progress</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {live.map((g) => (
                  <NflScoreRow key={g.id} game={g} to={`/sports/nfl/game/${g.id}`} />
                ))}
              </div>
            </section>
          )}
          {upcoming.length > 0 && (
            <section>
              <h3 className="rule-head mb-3">Upcoming</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {upcoming.map((g) => (
                  <NflScoreRow key={g.id} game={g} to={`/sports/nfl/game/${g.id}`} />
                ))}
              </div>
            </section>
          )}
          {finals.length > 0 && (
            <section>
              <h3 className="rule-head mb-3">Final</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {finals.map((g) => (
                  <NflScoreRow key={g.id} game={g} to={`/sports/nfl/game/${g.id}`} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
