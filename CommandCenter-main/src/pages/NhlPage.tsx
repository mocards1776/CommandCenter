import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import {
  fetchNhlScoreboard,
  fetchNhlScoringLeaders,
  fetchNhlStandings,
  nhlHeadshot,
  nhlSeasonYear,
  pickNhlHeroGame,
  type NhlScoreGame,
} from "@/lib/nhl";
import LogoPlate from "@/components/sports/LogoPlate";
import { NhlScoreboardCard } from "@/components/sports/ScoreboardCard";
import { markSportsSolo } from "@/lib/sports-home";

export default function NhlPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("solo") === "1") markSportsSolo();
  }, []);

  const scoreboard = useQuery({
    queryKey: ["nhl-scoreboard"],
    queryFn: () => fetchNhlScoreboard(),
    refetchInterval: 20_000,
    staleTime: 10_000,
  });

  const standings = useQuery({
    queryKey: ["nhl-standings", nhlSeasonYear()],
    queryFn: fetchNhlStandings,
    staleTime: 10 * 60_000,
  });

  const leaders = useQuery({
    queryKey: ["nhl-scoring-leaders", nhlSeasonYear()],
    queryFn: () => fetchNhlScoringLeaders(8),
    staleTime: 10 * 60_000,
  });

  const games = useMemo(() => scoreboard.data ?? [], [scoreboard.data]);
  const live = useMemo(() => games.filter((g) => g.live), [games]);
  const upcoming = useMemo(() => games.filter((g) => !g.live && !g.final), [games]);
  const finals = useMemo(() => games.filter((g) => g.final), [games]);
  const hero = games.length ? pickNhlHeroGame(games) : null;
  const featured = hero?.live ? hero : null;
  const liveRest = useMemo(
    () => (featured ? live.filter((g) => g.id !== featured.id) : live),
    [live, featured],
  );
  const seasonLabel =
    standings.data?.[0]?.seasonLabel ??
    leaders.data?.[0]?.seasonLabel ??
    `${nhlSeasonYear() - 1}-${String(nhlSeasonYear()).slice(2)}`;

  const refresh = () => {
    void Promise.all([scoreboard.refetch(), standings.refetch(), leaders.refetch()]).then(() =>
      toast.success("NHL updated"),
    );
  };

  return (
    <div className="flex min-h-0 flex-col gap-5 p-4 md:p-7">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
        <div className="flex items-baseline gap-x-2.5 gap-y-1">
          <h2 className="font-display text-cream text-[22px] leading-none sm:text-[26px]">
            NHL <span className="text-accent">{seasonLabel}</span>
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
          <Loader2 size={14} className="animate-spin" /> Loading NHL…
        </p>
      ) : scoreboard.isError ? (
        <p className="text-alert text-[13px]">Couldn’t load the NHL scoreboard.</p>
      ) : (
        <>
          {live.length > 0 && (
            <section className="space-y-3">
              <h3 className="rule-head">Live</h3>
              {featured && <NhlScoreboardCard game={featured} />}
              {liveRest.length > 0 && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {liveRest.map((g) => (
                    <NhlScoreboardCard key={g.id} game={g} />
                  ))}
                </div>
              )}
            </section>
          )}
          {upcoming.length > 0 && <GameSection title="Upcoming" games={upcoming} />}
          {finals.length > 0 && <GameSection title="Final" games={finals} />}
          {games.length === 0 && (
            <p className="text-chalk-dim text-[13px]">No NHL games on the board right now.</p>
          )}
        </>
      )}

      {leaders.data && leaders.data.length > 0 && (
        <section>
          <h3 className="rule-head mb-3">Scoring leaders · {seasonLabel}</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {leaders.data.map((p) => (
              <Link
                key={p.id}
                to={`/sports/nhl/player/${p.id}`}
                className="bg-panel flex items-center gap-3 rounded-xl border border-white/[0.08] p-3 transition hover:border-white/15"
              >
                <img
                  src={nhlHeadshot(p.id)}
                  alt=""
                  className="h-11 w-11 rounded-full bg-[#dfe6f2] object-cover object-top"
                  loading="lazy"
                />
                <div className="min-w-0">
                  <p className="text-cream truncate text-[13px] font-semibold">{p.name}</p>
                  <p className="text-chalk-dim numeral text-[12px]">
                    {p.goals} G · {p.assists} A · {p.points} PTS
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {standings.data && standings.data.length > 0 && (
        <section className="space-y-4">
          <h3 className="rule-head">Standings · {seasonLabel}</h3>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {standings.data.map((group) => (
              <div
                key={group.name}
                className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]"
              >
                <div className="border-b border-white/[0.06] px-4 py-2.5">
                  <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
                    {group.name}
                  </h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-left text-[12px]">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                        <th className="px-4 py-2 font-medium">Team</th>
                        <th className="px-2 py-2 text-right font-medium">GP</th>
                        <th className="px-2 py-2 text-right font-medium">W-L-OTL</th>
                        <th className="px-2 py-2 text-right font-medium">DIFF</th>
                        <th className="px-3 py-2 text-right font-medium">PTS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row) => (
                        <tr key={row.teamId} className="border-t border-white/[0.05]">
                          <td className="px-4 py-2">
                            <Link
                              to={`/sports/nhl/team/${row.teamId}`}
                              className="text-cream inline-flex min-w-0 items-center gap-2 font-medium hover:underline"
                            >
                              {row.logo ? <LogoPlate src={row.logo} className="h-5 w-5" /> : null}
                              <span>{row.abbrev}</span>
                              <span className="text-chalk-dim hidden truncate font-normal sm:inline">
                                {row.name}
                              </span>
                            </Link>
                          </td>
                          <td className="numeral px-2 py-2 text-right text-white/70">{row.gp}</td>
                          <td className="numeral px-2 py-2 text-right text-white/90">{row.record}</td>
                          <td className="numeral px-2 py-2 text-right text-white/70">{row.diff}</td>
                          <td className="numeral text-cream px-3 py-2 text-right font-semibold">
                            {row.points}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function GameSection({ title, games }: { title: string; games: NhlScoreGame[] }) {
  return (
    <section>
      <h3 className="rule-head mb-3">{title}</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {games.map((g) => (
          <NhlScoreboardCard key={g.id} game={g} />
        ))}
      </div>
    </section>
  );
}
