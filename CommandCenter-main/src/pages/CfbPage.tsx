import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw, Share } from "lucide-react";
import toast from "react-hot-toast";
import StarField from "@/components/StarField";
import { chicagoTodayCfb, fetchCfbScoreboard, type CfbScoreGame } from "@/lib/cfb";
import { loadCfbTeamInterest, rankRuwtCfbGames } from "@/lib/ruwt";
import { markSportsSolo } from "@/lib/sports-home";
import { cn } from "@/lib/utils";

export default function CfbPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("solo") === "1") markSportsSolo();
  }, []);

  const scoreboard = useQuery({
    queryKey: ["cfb-scoreboard", chicagoTodayCfb()],
    queryFn: () => fetchCfbScoreboard(chicagoTodayCfb().replace(/-/g, "")),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const games = scoreboard.data ?? [];
  const interest = useMemo(() => loadCfbTeamInterest(), []);

  const ranked = useMemo(
    () => rankRuwtCfbGames(games, interest, Math.max(games.length, 1)),
    [games, interest],
  );

  const heatById = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of ranked) map.set(String(g.id), g.score);
    return map;
  }, [ranked]);

  const live = useMemo(() => games.filter((g) => g.live), [games]);
  const upcoming = useMemo(() => games.filter((g) => !g.live && !g.final), [games]);
  const finals = useMemo(() => games.filter((g) => g.final), [games]);

  const refresh = () => {
    void scoreboard.refetch().then(() => toast.success("College football updated"));
  };

  return (
    <div className="flex min-h-0 flex-col gap-5 p-4 md:p-7">
      <div className="relative overflow-hidden rounded-lg border border-accent/25 bg-gradient-to-br from-hero-lift to-hero p-5 sm:p-7">
        <StarField count={28} seed={42} />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="rule-head mb-2">NCAA Football</div>
            <h2 className="font-display text-cream text-[28px] leading-tight sm:text-[34px]">
              College <span className="text-accent">football</span>
            </h2>
            <p className="text-chalk mt-2 max-w-lg text-[13px] leading-relaxed">
              FBS scoreboard, player profiles, and{" "}
              <Link to="/sports/ruwt?solo=1&sport=cfb" className="text-accent hover:underline">
                RUWT
              </Link>{" "}
              with a dedicated CFB filter. Coaches on the{" "}
              <Link to="/sports/hot-seat?solo=1&sport=cfb" className="text-accent hover:underline">
                hot seat
              </Link>
              .
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
              to="/sports?solo=1"
              className="from-accent-deep to-accent-dark text-cream rounded-sm bg-gradient-to-b px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.14em]"
            >
              My teams
            </Link>
          </div>
        </div>
      </div>

      {scoreboard.isPending ? (
        <p className="text-chalk flex items-center gap-2 text-[13px]">
          <Loader2 size={14} className="animate-spin" /> Loading college football…
        </p>
      ) : scoreboard.isError ? (
        <p className="text-alert text-[13px]">Couldn’t load the college football scoreboard.</p>
      ) : games.length === 0 ? (
        <p className="text-chalk-dim text-[13px]">No games on today’s board.</p>
      ) : (
        <>
          {live.length > 0 && (
            <GameSection title="In progress" games={live} heatById={heatById} />
          )}
          {upcoming.length > 0 && (
            <GameSection title="Upcoming" games={upcoming} heatById={heatById} />
          )}
          {finals.length > 0 && (
            <GameSection title="Final" games={finals} heatById={heatById} dimmed />
          )}
        </>
      )}
    </div>
  );
}

function GameSection({
  title,
  games,
  heatById,
  dimmed,
}: {
  title: string;
  games: CfbScoreGame[];
  heatById: Map<string, number>;
  dimmed?: boolean;
}) {
  return (
    <section className={cn(dimmed && "opacity-80")}>
      <h3 className="rule-head mb-3">{title}</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {games.map((g) => (
          <CfbScoreRow key={g.id} game={g} heat={heatById.get(String(g.id))} />
        ))}
      </div>
    </section>
  );
}

function CfbScoreRow({ game, heat }: { game: CfbScoreGame; heat?: number }) {
  return (
    <Link
      to={`/sports/cfb/game/${game.id}`}
      className={cn(
        "bg-panel block overflow-hidden rounded-lg border transition hover:border-accent/40",
        game.live ? "border-alert/45" : "border-white/[0.08]",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cream">
          {game.live ? (
            <span className="text-alert">
              <span className="bg-alert mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full" />
              {game.shortDetail || "Live"}
            </span>
          ) : game.final ? (
            "Final"
          ) : (
            game.whenShort ?? "Scheduled"
          )}
        </span>
        {heat != null && heat > 0 ? (
          <span className="text-[10px] text-[#8b93a7]">Heat {heat}</span>
        ) : null}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-3">
        <TeamSide side={game.away} align="start" />
        <p className="font-display text-center text-[24px] tabular-nums text-cream">
          {game.live || game.final ? (
            <>
              {game.away.score ?? "—"}
              <span className="mx-1 text-[14px] text-white/30">-</span>
              {game.home.score ?? "—"}
            </>
          ) : (
            <span className="text-[18px]">{game.whenShort ?? "TBD"}</span>
          )}
        </p>
        <TeamSide side={game.home} align="end" />
      </div>
    </Link>
  );
}

function TeamSide({
  side,
  align,
}: {
  side: CfbScoreGame["away"];
  align: "start" | "end";
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1",
        align === "end" ? "items-end text-right" : "items-start",
      )}
    >
      {side.logo ? (
        <img src={side.logo} alt="" className="h-8 w-8 object-contain" loading="lazy" />
      ) : null}
      <p className="text-cream text-[14px] font-semibold">
        {side.rank ? `#${side.rank} ` : ""}
        {side.abbrev}
      </p>
      {side.record ? <p className="text-chalk-dim text-[10px]">{side.record}</p> : null}
    </div>
  );
}
