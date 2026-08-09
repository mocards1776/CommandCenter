import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw, Share, Star } from "lucide-react";
import toast from "react-hot-toast";
import StarField from "@/components/StarField";
import HeroGameCard from "@/components/sports/HeroGameCard";
import { useAuth } from "@/lib/auth-context";
import { listFavoritePlayers } from "@/lib/favorite-players";
import {
  fetchMlbLeaders,
  fetchMlbScoreboard,
  fetchMlbStandings,
  mlbHeadshot,
  mlbTeamLogo,
  pickHeroGame,
  playoffOddsFromStandings,
  teamPagePath,
  type MlbLeaderBoard,
  type MlbScoreGame,
} from "@/lib/mlb";
import { markSportsSolo } from "@/lib/sports-home";
import { cn } from "@/lib/utils";

export default function MlbPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"board" | "standings" | "leaders" | "odds">("board");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("solo") === "1") markSportsSolo();
  }, []);

  const scoreboard = useQuery({
    queryKey: ["mlb-scoreboard"],
    queryFn: () => fetchMlbScoreboard(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const standings = useQuery({
    queryKey: ["mlb-standings"],
    queryFn: () => fetchMlbStandings(),
    staleTime: 120_000,
  });

  const leaders = useQuery({
    queryKey: ["mlb-leaders"],
    queryFn: () => fetchMlbLeaders(8),
    staleTime: 300_000,
  });

  const favorites = useQuery({
    queryKey: ["favorite-players", user?.id],
    queryFn: () => listFavoritePlayers(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 30_000,
  });

  const odds = useMemo(
    () => (standings.data ? playoffOddsFromStandings(standings.data) : []),
    [standings.data],
  );

  const liveCount = scoreboard.data?.filter((g) => g.live).length ?? 0;
  const hero = scoreboard.data ? pickHeroGame(scoreboard.data) : null;
  const refreshing =
    scoreboard.isFetching || standings.isFetching || leaders.isFetching;

  const refresh = () => {
    void Promise.all([
      scoreboard.refetch(),
      standings.refetch(),
      leaders.refetch(),
      favorites.refetch(),
    ]).then(() => toast.success("MLB updated"));
  };

  return (
    <div className="flex min-h-0 flex-col gap-5 p-4 md:p-7">
      <div className="relative overflow-hidden rounded-lg border border-accent/25 bg-gradient-to-br from-hero-lift to-hero p-5 sm:p-7">
        <StarField count={32} seed={42} />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="rule-head mb-2">Major League Baseball</div>
            <h2 className="font-display text-cream text-[28px] leading-tight sm:text-[34px]">
              Live <span className="text-accent">MLB</span>
            </h2>
            <p className="text-chalk mt-2 max-w-lg text-[13px] leading-relaxed">
              Scoreboard, standings, league leaders, playoff odds — tap any player
              for a full card and add favorites.
            </p>
            {liveCount > 0 && (
              <p className="text-alert mt-2 text-[11px] font-semibold uppercase tracking-[0.16em]">
                <span className="bg-alert mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full" />
                {liveCount} live now
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
              disabled={refreshing}
              className="text-chalk hover:text-cream flex items-center gap-2 rounded-sm border border-white/10 px-3 py-2 text-[10.5px] uppercase tracking-[0.14em] transition hover:border-accent/40 disabled:opacity-40"
            >
              <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
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

      {hero && (
        <HeroGameCard
          game={hero}
          label={hero.live ? "Live now" : hero.final ? "Latest final" : "Up next"}
        />
      )}

      {favorites.data && favorites.data.length > 0 && (
        <section>
          <h3 className="rule-head mb-3">Your players</h3>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {favorites.data.map((f) => (
              <Link
                key={f.id}
                to={`/sports/mlb/player/${f.playerId}`}
                className="bg-panel group relative w-[148px] shrink-0 overflow-hidden rounded-lg border border-white/[0.08] transition hover:border-accent/40"
              >
                <div className="from-accent-dark/80 absolute inset-0 bg-gradient-to-t to-transparent opacity-80" />
                <img
                  src={mlbHeadshot(f.playerId, 213)}
                  alt=""
                  className="aspect-[3/4] w-full object-cover object-top"
                  loading="lazy"
                />
                <div className="absolute inset-x-0 bottom-0 p-2.5">
                  <p className="font-display text-cream text-[15px] leading-tight drop-shadow">
                    {f.playerName.split(" ").slice(-1)[0]}
                  </p>
                  <p className="text-chalk-dim mt-0.5 text-[10px] uppercase tracking-[0.12em]">
                    {f.position ?? "MLB"}
                    {f.teamName ? ` · ${f.teamName}` : ""}
                  </p>
                </div>
                <Star
                  size={12}
                  className="text-accent absolute top-2 right-2 fill-current drop-shadow"
                />
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["board", "Scoreboard"],
            ["standings", "Standings"],
            ["leaders", "Leaders"],
            ["odds", "Playoff odds"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "rounded-sm px-3 py-2 text-[10.5px] uppercase tracking-[0.14em] transition",
              tab === id
                ? "from-accent-deep to-accent-dark text-cream bg-gradient-to-b"
                : "text-chalk border border-white/10 hover:text-cream",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "board" && (
        <ScoreboardSection
          games={scoreboard.data ?? []}
          loading={scoreboard.isPending}
          error={scoreboard.isError ? "Couldn’t load scoreboard." : null}
        />
      )}
      {tab === "standings" && (
        <StandingsSection
          tables={standings.data ?? []}
          loading={standings.isPending}
          error={standings.isError ? "Couldn’t load standings." : null}
        />
      )}
      {tab === "leaders" && (
        <LeadersSection
          boards={leaders.data ?? []}
          loading={leaders.isPending}
          error={leaders.isError ? "Couldn’t load leaders." : null}
        />
      )}
      {tab === "odds" && (
        <OddsSection
          rows={odds}
          loading={standings.isPending}
          error={standings.isError ? "Couldn’t load odds." : null}
        />
      )}
    </div>
  );
}

function ScoreboardSection({
  games,
  loading,
  error,
}: {
  games: MlbScoreGame[];
  loading: boolean;
  error: string | null;
}) {
  if (loading) return <LoadingBlock label="Loading games…" />;
  if (error) return <ErrorLine>{error}</ErrorLine>;
  if (games.length === 0) return <EmptyLine>No games on today’s slate.</EmptyLine>;

  const live = games.filter((g) => g.live);
  const rest = games.filter((g) => !g.live);

  return (
    <div className="flex flex-col gap-4">
      {live.length > 0 && (
        <div>
          <h3 className="rule-head mb-3">Live</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {live.map((g) => (
              <ScoreCard key={g.id} game={g} />
            ))}
          </div>
        </div>
      )}
      <div>
        <h3 className="rule-head mb-3">{live.length ? "Also today" : "Today"}</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {rest.map((g) => (
            <ScoreCard key={g.id} game={g} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ScoreCard({ game }: { game: MlbScoreGame }) {
  const awayWins =
    game.final && (game.away.score ?? 0) > (game.home.score ?? 0);
  const homeWins =
    game.final && (game.home.score ?? 0) > (game.away.score ?? 0);

  return (
    <Link
      to={`/sports/mlb/game/${game.id}`}
      className={cn(
        "relative block overflow-hidden rounded-lg border bg-[#0a1424] transition hover:border-accent/40",
        game.live ? "border-alert/45" : "border-white/[0.08]",
      )}
    >
      {game.live && (
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-alert to-transparent" />
      )}
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-2">
        <span
          className={cn(
            "text-[10px] font-bold uppercase tracking-[0.14em]",
            game.live ? "text-alert" : "text-[#8b93a7]",
          )}
        >
          {game.live ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-alert" />
              {game.inning || "Live"}
            </span>
          ) : game.final ? (
            "Final"
          ) : (
            game.status
          )}
        </span>
        <span className="truncate text-[10.5px] text-[#8b93a7]">
          {!game.live && !game.final ? game.when : game.venue ?? "Box score"}
        </span>
      </div>
      <div className="space-y-0.5 px-3 py-2.5">
        <TeamScoreLine side={game.away} emphasize={awayWins} muted={homeWins} />
        <TeamScoreLine side={game.home} emphasize={homeWins} muted={awayWins} />
      </div>
      {(game.away.probablePitcher || game.home.probablePitcher) && !game.final && !game.live && (
        <p className="truncate border-t border-white/[0.06] px-3 py-1.5 text-[10.5px] text-[#8b93a7]">
          {game.away.probablePitcher ?? "TBD"} vs {game.home.probablePitcher ?? "TBD"}
        </p>
      )}
    </Link>
  );
}

function TeamScoreLine({
  side,
  emphasize,
  muted,
}: {
  side: MlbScoreGame["away"];
  emphasize?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="flex min-w-0 items-center gap-2">
        {side.teamId ? (
          <img src={mlbTeamLogo(side.teamId)} alt="" className="h-7 w-7 object-contain" />
        ) : null}
        <div className="min-w-0">
          {side.teamId ? (
            <Link
              to={teamPagePath(side.teamId)}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "block text-[15px] font-semibold tracking-wide hover:underline",
                emphasize ? "text-white" : muted ? "text-white/45" : "text-[#d5dae6]",
              )}
            >
              {side.abbrev}
            </Link>
          ) : (
            <span
              className={cn(
                "block text-[15px] font-semibold tracking-wide",
                emphasize ? "text-white" : muted ? "text-white/45" : "text-[#d5dae6]",
              )}
            >
              {side.abbrev}
            </span>
          )}
          {side.record && (
            <span className="text-[10px] text-[#8b93a7]">{side.record}</span>
          )}
        </div>
      </div>
      <span
        className={cn(
          "numeral text-[26px] leading-none",
          emphasize ? "text-white" : muted ? "text-white/40" : "text-white",
        )}
      >
        {side.score ?? "—"}
      </span>
    </div>
  );
}

function StandingsSection({
  tables,
  loading,
  error,
}: {
  tables: Awaited<ReturnType<typeof fetchMlbStandings>>;
  loading: boolean;
  error: string | null;
}) {
  if (loading) return <LoadingBlock label="Loading standings…" />;
  if (error) return <ErrorLine>{error}</ErrorLine>;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {tables.map((t) => (
        <div key={t.name} className="bg-panel overflow-hidden rounded-lg border border-white/[0.07]">
          <div className="border-b border-white/[0.06] px-3 py-2.5">
            <h3 className="font-display text-cream text-[18px]">{t.shortName}</h3>
          </div>
          <table className="w-full text-left text-[12px]">
            <thead className="text-chalk-dim text-[10px] uppercase tracking-[0.12em]">
              <tr>
                <th className="px-3 py-2 font-medium">Team</th>
                <th className="px-1.5 py-2 font-medium">W</th>
                <th className="px-1.5 py-2 font-medium">L</th>
                <th className="px-1.5 py-2 font-medium">Pct</th>
                <th className="px-1.5 py-2 font-medium">GB</th>
                <th className="px-2 py-2 font-medium">PO%</th>
              </tr>
            </thead>
            <tbody>
              {t.rows.map((r) => (
                <tr key={r.teamId} className="border-t border-white/[0.04]">
                            <td className="text-cream px-3 py-2">
                              <span className="inline-flex items-center gap-2">
                                <span className="text-chalk-dim numeral w-3">{r.rank}</span>
                                {r.teamId ? (
                                  <img
                                    src={mlbTeamLogo(r.teamId)}
                                    alt=""
                                    className="h-5 w-5 object-contain"
                                  />
                                ) : null}
                                <Link
                                  to={teamPagePath(r.teamId)}
                                  className="hover:text-accent hover:underline"
                                >
                                  {r.team}
                                </Link>
                              </span>
                            </td>
                  <td className="numeral text-cream px-1.5 py-2">{r.wins}</td>
                  <td className="numeral text-chalk px-1.5 py-2">{r.losses}</td>
                  <td className="numeral text-chalk px-1.5 py-2">{r.pct}</td>
                  <td className="numeral text-chalk px-1.5 py-2">{r.gb}</td>
                  <td className="numeral text-accent px-2 py-2">
                    {r.playoffPercent ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function LeadersSection({
  boards,
  loading,
  error,
}: {
  boards: MlbLeaderBoard[];
  loading: boolean;
  error: string | null;
}) {
  if (loading) return <LoadingBlock label="Loading leaders…" />;
  if (error) return <ErrorLine>{error}</ErrorLine>;
  const hitting = boards.filter((b) => b.group === "hitting");
  const pitching = boards.filter((b) => b.group === "pitching");
  return (
    <div className="flex flex-col gap-6">
      <LeaderGroup title="Hitting" boards={hitting} />
      <LeaderGroup title="Pitching" boards={pitching} />
    </div>
  );
}

function LeaderGroup({ title, boards }: { title: string; boards: MlbLeaderBoard[] }) {
  if (boards.length === 0) return null;
  return (
    <div>
      <h3 className="rule-head mb-3">{title}</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {boards.map((b) => (
          <div key={b.key} className="bg-panel rounded-lg border border-white/[0.07] p-3.5">
            <p className="text-accent mb-3 text-[10.5px] font-semibold uppercase tracking-[0.18em]">
              {b.label}
            </p>
            <ol className="flex flex-col gap-2">
              {b.leaders.map((l) => (
                <li key={`${b.key}-${l.playerId}`}>
                  <Link
                    to={`/sports/mlb/player/${l.playerId}`}
                    className="group flex items-center gap-2.5 rounded-sm transition hover:bg-white/[0.03]"
                  >
                    <img
                      src={mlbHeadshot(l.playerId)}
                      alt=""
                      className="h-9 w-9 rounded-full object-cover object-top ring-1 ring-white/10"
                      loading="lazy"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-cream truncate text-[13px] group-hover:underline">
                        <span className="text-chalk-dim numeral mr-1.5 text-[11px]">{l.rank}</span>
                        {l.name}
                      </p>
                      <p className="text-chalk-dim text-[10.5px]">{l.team}</p>
                    </div>
                    <span className="numeral text-accent text-[18px]">{l.value}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}

function OddsSection({
  rows,
  loading,
  error,
}: {
  rows: ReturnType<typeof playoffOddsFromStandings>;
  loading: boolean;
  error: string | null;
}) {
  if (loading) return <LoadingBlock label="Loading playoff odds…" />;
  if (error) return <ErrorLine>{error}</ErrorLine>;
  if (rows.length === 0) return <EmptyLine>Playoff odds not published yet.</EmptyLine>;
  return (
    <div className="bg-panel overflow-hidden rounded-lg border border-white/[0.07]">
      <table className="w-full text-left text-[12.5px]">
        <thead className="text-chalk-dim text-[10px] uppercase tracking-[0.12em]">
          <tr className="border-b border-white/[0.06]">
            <th className="px-3 py-2.5 font-medium">Team</th>
            <th className="px-2 py-2.5 font-medium">Rec</th>
            <th className="px-2 py-2.5 font-medium">Playoff</th>
            <th className="hidden px-2 py-2.5 font-medium sm:table-cell">WC</th>
            <th className="px-3 py-2.5 font-medium">Div</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const pct = parseFloat(r.playoffPercent) || 0;
            return (
              <tr key={r.teamId} className="border-t border-white/[0.04]">
                <td className="text-cream px-3 py-2.5">
                  <Link
                    to={teamPagePath(r.teamId)}
                    className="inline-flex items-center gap-2 hover:text-accent hover:underline"
                  >
                    <img src={mlbTeamLogo(r.teamId)} alt="" className="h-5 w-5 object-contain" />
                    {r.team}
                  </Link>
                </td>
                <td className="numeral text-chalk px-2 py-2.5">{r.record}</td>
                <td className="px-2 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="numeral text-accent w-12">{r.playoffPercent}</span>
                    <div className="bg-field hidden h-1.5 max-w-[80px] flex-1 overflow-hidden rounded-full sm:block">
                      <div
                        className="bg-accent h-full rounded-full"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="numeral text-chalk hidden px-2 py-2.5 sm:table-cell">
                  {r.wildCardPercent ?? "—"}
                </td>
                <td className="text-chalk-dim px-3 py-2.5 text-[11px]">{r.division}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-chalk-dim border-t border-white/[0.06] px-3 py-2 text-[10.5px]">
        Odds via ESPN projections · standings via MLB Stats API
      </p>
    </div>
  );
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="text-chalk flex items-center justify-center gap-2 py-16 text-[13px]">
      <Loader2 size={16} className="animate-spin" />
      {label}
    </div>
  );
}

function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="text-chalk-dim text-[13px]">{children}</p>;
}

function ErrorLine({ children }: { children: ReactNode }) {
  return <p className="text-alert text-[13px]">{children}</p>;
}
