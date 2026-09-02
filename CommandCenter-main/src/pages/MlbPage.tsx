import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Play, RefreshCw, Star } from "lucide-react";
import toast from "react-hot-toast";
import PlayerHeadshot from "@/components/sports/PlayerHeadshot";
import HighlightVideoPlayer from "@/components/sports/HighlightVideoPlayer";
import { useAuth } from "@/lib/auth-context";
import { listFavoritePlayers } from "@/lib/favorite-players";
import { fetchTaggedPlayerIds } from "@/lib/sports-player-tags";
import TeamMark from "@/components/sports/TeamMark";
import {
  fetchFavoritePlayersYesterday,
  fetchMlbLeaders,
  fetchMlbManagers,
  fetchMlbScoreboard,
  fetchMlbStandings,
  fetchMlbTonightDigest,
  mlbHeadshot,
  mlbHeadshotFallbacks,
  playoffOddsFromStandings,
  teamPagePath,
  type MlbLeaderBoard,
  type MlbPageTab,
  type MlbScoreGame,
  type MlbTonightDigest,
  type MlbTonightHighlight,
  type MlbTonightPerformer,
  type MlbTonightTaggedRow,
} from "@/lib/mlb";
import { markSportsSolo } from "@/lib/sports-home";
import { cn } from "@/lib/utils";

const MLB_TABS = new Set<MlbPageTab>(["board", "standings", "leaders", "odds", "highlights"]);

function readMlbTab(raw: string | null): MlbPageTab {
  if (raw && MLB_TABS.has(raw as MlbPageTab)) return raw as MlbPageTab;
  return "board";
}

export default function MlbPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = readMlbTab(searchParams.get("tab"));
  const returnPath = `${location.pathname}${location.search}`;

  const setTab = (id: MlbPageTab) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id === "board") next.delete("tab");
        else next.set("tab", id);
        return next;
      },
      { replace: true },
    );
  };

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

  const taggedPlayers = useQuery({
    queryKey: ["tagged-player-ids"],
    queryFn: fetchTaggedPlayerIds,
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  const hasManagerFavs = Boolean(
    favorites.data?.some((f) => (f.position ?? "").toLowerCase() === "manager"),
  );
  const managers = useQuery({
    queryKey: ["mlb-managers-v10"],
    queryFn: fetchMlbManagers,
    enabled: hasManagerFavs,
    staleTime: 180_000,
  });

  const playerFavs = useMemo(
    () =>
      (favorites.data ?? []).filter((f) => {
        if ((f.position ?? "").toLowerCase() === "manager") return false;
        const sport = (f.sport ?? "").toLowerCase();
        // MLB board: baseball only — golf/NFL favorites belong on their own boards.
        return !sport || sport === "baseball" || sport === "mlb";
      }),
    [favorites.data],
  );

  const favoritePlayerIds = useMemo(() => {
    const set = new Set<number>();
    for (const f of playerFavs) {
      const id = Number(f.playerId);
      if (Number.isFinite(id)) set.add(id);
    }
    return set;
  }, [playerFavs]);

  const taggedPlayerIds = useMemo(() => new Set(taggedPlayers.data ?? []), [taggedPlayers.data]);

  const tonight = useQuery({
    queryKey: [
      "mlb-tonight-digest",
      [...favoritePlayerIds].join(","),
      [...taggedPlayerIds].join(","),
    ],
    queryFn: () =>
      fetchMlbTonightDigest({ favoritePlayerIds, taggedPlayerIds }),
    enabled: tab === "highlights",
    staleTime: 120_000,
    refetchInterval: tab === "highlights" ? 120_000 : false,
  });

  const yesterday = useQuery({
    queryKey: ["favorite-players-yesterday", user?.id, playerFavs.map((f) => f.playerId).join(",")],
    queryFn: () => fetchFavoritePlayersYesterday(playerFavs),
    enabled: playerFavs.length > 0,
    staleTime: 120_000,
  });

  const odds = useMemo(
    () => (standings.data ? playoffOddsFromStandings(standings.data) : []),
    [standings.data],
  );

  const liveCount = scoreboard.data?.filter((g) => g.live).length ?? 0;
  const refreshing =
    scoreboard.isFetching ||
    standings.isFetching ||
    leaders.isFetching ||
    (tab === "highlights" && tonight.isFetching);

  const refresh = () => {
    void Promise.all([
      scoreboard.refetch(),
      standings.refetch(),
      leaders.refetch(),
      favorites.refetch(),
      tab === "highlights" ? tonight.refetch() : Promise.resolve(),
    ]).then(() => toast.success("MLB updated"));
  };

  return (
    <div className="flex min-h-0 flex-col gap-5 p-4 md:p-7">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["board", "Scores"],
            ["standings", "Standings"],
            ["leaders", "Stats"],
            ["highlights", "Tonight's Highlights"],
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
        {liveCount > 0 ? (
          <span className="text-alert ml-1 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]">
            <span className="bg-alert inline-block h-1.5 w-1.5 animate-pulse rounded-full" />
            {liveCount} live
          </span>
        ) : null}
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          title="Refresh"
          className="text-chalk hover:text-cream ml-auto rounded-sm border border-white/10 p-2 transition hover:border-accent/40 disabled:opacity-40"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : undefined} />
        </button>
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
          returnPath={returnPath}
        />
      )}
      {tab === "highlights" && (
        <TonightHighlightsSection
          digest={tonight.data ?? null}
          loading={tonight.isPending}
          error={tonight.isError ? "Couldn’t load tonight’s highlights." : null}
          returnPath={returnPath}
        />
      )}
      {tab === "odds" && (
        <OddsSection
          rows={odds}
          loading={standings.isPending}
          error={standings.isError ? "Couldn’t load odds." : null}
        />
      )}

      {tab === "board" && yesterday.data && yesterday.data.lines.some((l) => l.played) && (
        <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="rule-head">Yesterday</h3>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
              {yesterday.data.date}
            </p>
          </div>
          <ul className="space-y-3">
            {yesterday.data.lines.filter((l) => l.played).map((line) => (
              <li key={line.playerId}>
                <Link
                  to={`/sports/mlb/player/${line.playerId}`}
                  state={{ from: returnPath }}
                  className="flex items-start gap-3 rounded-lg border border-white/[0.05] px-2 py-2 transition hover:bg-white/[0.03]"
                >
                  <img
                    src={mlbHeadshot(line.playerId, 213)}
                    alt=""
                    className="h-12 w-10 shrink-0 rounded-md bg-[#dfe6f2] object-cover object-[center_15%]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <p className="text-cream text-[14px] font-semibold">{line.playerName}</p>
                      {line.isWin != null && (
                        <span
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-[0.12em]",
                            line.isWin ? "text-emerald-300" : "text-alert",
                          )}
                        >
                          {line.isWin ? "W" : "L"}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[12px] text-[#a8b0c2]">
                      {`${line.isHome ? "vs" : "@"} ${line.opponent}`}
                    </p>
                    <p className="numeral text-cream mt-1 text-[13px] leading-snug">
                      {line.summary || "—"}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "board" && playerFavs.length > 0 && (
        <section>
          <h3 className="rule-head mb-3">Your players</h3>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {playerFavs.map((f) => (
              <Link
                key={f.id}
                to={`/sports/mlb/player/${f.playerId}`}
                state={{ from: returnPath }}
                className="bg-panel group relative w-[148px] shrink-0 overflow-hidden rounded-lg border border-white/[0.08] transition hover:border-accent/40"
              >
                <div className="from-accent-dark/80 absolute inset-0 bg-gradient-to-t to-transparent opacity-80" />
                <PlayerHeadshot
                  playerId={f.playerId}
                  className="aspect-[3/4] w-full object-top"
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

      {tab === "board" &&
        favorites.data &&
        favorites.data.some((f) => (f.position ?? "").toLowerCase() === "manager") && (
        <section>
          <h3 className="rule-head mb-3">Your managers</h3>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {favorites.data
              .filter((f) => (f.position ?? "").toLowerCase() === "manager")
              .map((f) => {
                const resolved = managers.data?.find((m) => String(m.id) === String(f.playerId));
                return (
                <Link
                  key={f.id}
                  to={`/sports/mlb/managers/${f.playerId}`}
                  className="bg-panel group relative w-[148px] shrink-0 overflow-hidden rounded-lg border border-white/[0.08] transition hover:border-accent/40"
                >
                  <div className="from-accent-dark/80 absolute inset-0 bg-gradient-to-t to-transparent opacity-80" />
                  <ManagerCarouselPhoto
                    managerId={f.playerId}
                    primary={resolved?.headshot}
                  />
                  <div className="absolute inset-x-0 bottom-0 p-2.5">
                    <p className="font-display text-cream text-[15px] leading-tight drop-shadow">
                      {f.playerName.split(" ").slice(-1)[0]}
                    </p>
                    <p className="text-chalk-dim mt-0.5 text-[10px] uppercase tracking-[0.12em]">
                      Manager{f.teamName ? ` · ${f.teamName}` : ""}
                    </p>
                  </div>
                  <Star
                    size={12}
                    className="text-accent absolute top-2 right-2 fill-current drop-shadow"
                  />
                </Link>
                );
              })}
          </div>
        </section>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="rule-head">{live.length ? "Live" : "Today"}</h3>
        <Link
          to="/sports/ruwt?solo=1"
          className="text-accent text-[10.5px] font-semibold uppercase tracking-[0.14em] hover:underline"
        >
          Open RUWT →
        </Link>
      </div>
      {live.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {live.map((g) => (
            <ScoreCard key={g.id} game={g} />
          ))}
        </div>
      )}
      {rest.length > 0 && (
        <div>
          {live.length > 0 && <h3 className="rule-head mb-3">Also today</h3>}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {rest.map((g) => (
              <ScoreCard key={g.id} game={g} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreCard({ game }: { game: MlbScoreGame }) {
  const awayWins =
    game.final && (game.away.score ?? 0) > (game.home.score ?? 0);
  const homeWins =
    game.final && (game.home.score ?? 0) > (game.away.score ?? 0);
  const pregame = !game.live && !game.final;

  return (
    <Link
      to={`/sports/mlb/game/${game.id}`}
      className={cn(
        "relative block overflow-hidden rounded-lg border bg-[#07101d] transition hover:border-accent/40 hover:shadow-[0_12px_36px_rgba(0,0,0,0.35)]",
        game.live ? "border-alert/45" : "border-white/[0.08]",
      )}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1/2 opacity-80"
        style={{
          background: `radial-gradient(ellipse at 15% 50%, #${game.away.primaryColor}66, transparent 65%)`,
        }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-80"
        style={{
          background: `radial-gradient(ellipse at 85% 50%, #${game.home.primaryColor}66, transparent 65%)`,
        }}
      />
      {game.live && (
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-alert to-transparent" />
      )}
      <div className="relative z-10 flex items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-2">
        <span
          className={cn(
            "text-[10px] font-bold uppercase tracking-[0.14em]",
            game.live ? "text-alert" : game.final ? "text-cream" : "text-[#8b93a7]",
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
            "Preview"
          )}
        </span>
        <span className="truncate text-[10.5px] text-[#8b93a7]">
          {pregame ? game.whenShort ?? game.when : game.venue ?? "Box score"}
        </span>
      </div>

      {pregame ? (
        <div className="relative z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-3.5">
          <ScorePreviewTeam side={game.away} align="left" />
          <div className="text-center">
            <p className="font-display text-[28px] leading-none text-white">
              {game.whenShort ?? "TBD"}
            </p>
          </div>
          <ScorePreviewTeam side={game.home} align="right" />
        </div>
      ) : (
        <div className="relative z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-3.5">
          <ScorePreviewTeam side={game.away} align="left" muted={homeWins} winner={awayWins} />
          <div className="text-center">
            <p className="font-display text-[34px] leading-none tabular-nums text-white">
              <span className={awayWins ? "text-white" : homeWins ? "text-white/45" : "text-white"}>
                {game.away.score ?? "—"}
              </span>
              <span className="mx-1.5 text-[16px] text-white/30">-</span>
              <span className={homeWins ? "text-white" : awayWins ? "text-white/45" : "text-white"}>
                {game.home.score ?? "—"}
              </span>
            </p>
            {(game.away.hits != null || game.home.hits != null) && (
              <p className="mt-1.5 text-[10px] uppercase tracking-[0.12em] text-white/45">
                H {game.away.hits ?? "–"}–{game.home.hits ?? "–"}
              </p>
            )}
          </div>
          <ScorePreviewTeam side={game.home} align="right" muted={awayWins} winner={homeWins} />
        </div>
      )}

      {(game.away.probablePitcher || game.home.probablePitcher || pregame) && pregame && (
        <div className="relative z-10 border-t border-white/[0.06] px-3 py-2.5">
          <p className="mb-2 text-center text-[9px] font-semibold uppercase tracking-[0.16em] text-white/45">
            Probable pitchers
          </p>
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <ScorePitcherCard side={game.away} align="left" />
            <span className="pb-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
              vs
            </span>
            <ScorePitcherCard side={game.home} align="right" />
          </div>
        </div>
      )}
    </Link>
  );
}

function ScorePitcherCard({
  side,
  align,
}: {
  side: MlbScoreGame["away"];
  align: "left" | "right";
}) {
  const name = side.probablePitcher ?? "TBD";
  const parts = name.split(" ");
  const last = parts.length > 1 ? parts[parts.length - 1] : name;
  const first = parts.length > 1 ? parts.slice(0, -1).join(" ") : "";
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1.5",
        align === "right" ? "items-end text-right" : "items-start text-left",
      )}
    >
      {side.probablePitcherId ? (
        <div className="relative h-[72px] w-[58px] overflow-hidden rounded-lg bg-[#dfe6f2] ring-2 ring-white/25">
          <img
            src={mlbHeadshot(side.probablePitcherId, 213)}
            alt=""
            className="absolute inset-0 h-full w-full scale-[1.12] object-cover object-[center_12%]"
          />
        </div>
      ) : (
        <div className="grid h-[72px] w-[58px] place-items-center rounded-lg bg-white/10 text-[10px] text-white/40">
          TBD
        </div>
      )}
      {first ? (
        <p className="truncate text-[10px] font-medium uppercase tracking-[0.08em] text-white/55">
          {first}
        </p>
      ) : null}
      <p className="font-display text-cream truncate text-[16px] leading-none">{last}</p>
    </div>
  );
}

function ScorePreviewTeam({
  side,
  align,
  muted,
  winner,
}: {
  side: MlbScoreGame["away"];
  align: "left" | "right";
  muted?: boolean;
  winner?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-center gap-1.5",
        align === "left" ? "sm:items-start" : "sm:items-end",
        muted && "opacity-60",
      )}
    >
      {side.teamId ? <TeamMark teamId={side.teamId} size="md" /> : null}
      <div className={cn("text-center", align === "left" ? "sm:text-left" : "sm:text-right")}>
        <p
          className={cn(
            "text-[15px] font-bold tracking-wide",
            winner ? "text-white" : "text-white",
          )}
        >
          {side.abbrev}
        </p>
        {side.record && (
          <p className="numeral mt-0.5 text-[12px] font-medium text-white/70">{side.record}</p>
        )}
      </div>
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
                                {r.teamId ? <TeamMark teamId={r.teamId} size="xs" /> : null}
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
  returnPath,
}: {
  boards: MlbLeaderBoard[];
  loading: boolean;
  error: string | null;
  returnPath: string;
}) {
  if (loading) return <LoadingBlock label="Loading leaders…" />;
  if (error) return <ErrorLine>{error}</ErrorLine>;
  const hitting = boards.filter((b) => b.group === "hitting");
  const pitching = boards.filter((b) => b.group === "pitching");
  return (
    <div className="flex flex-col gap-6">
      <LeaderGroup title="Hitting" boards={hitting} returnPath={returnPath} />
      <LeaderGroup title="Pitching" boards={pitching} returnPath={returnPath} />
    </div>
  );
}

function LeaderGroup({
  title,
  boards,
  returnPath,
}: {
  title: string;
  boards: MlbLeaderBoard[];
  returnPath: string;
}) {
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
                    state={{ from: returnPath }}
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
                    <TeamMark teamId={r.teamId} size="xs" />
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

function parseHighlightPossessiveTitle(title: string): { playerName: string; rest: string } | null {
  const match = title.match(/^(.+?)['\u2019]s\s+(.+)$/);
  if (!match) return null;
  return { playerName: match[1]!, rest: match[2]! };
}

function HighlightModalTitle({
  clip,
  returnPath,
}: {
  clip: MlbTonightHighlight;
  returnPath: string;
}) {
  const playerId = clip.playerIds[0];
  const parts = parseHighlightPossessiveTitle(clip.title);
  if (playerId && parts) {
    return (
      <p className="truncate text-[12.5px] text-[#c8cdd8]">
        <Link
          to={`/sports/mlb/player/${playerId}`}
          state={{ from: returnPath }}
          className="text-accent hover:underline"
        >
          {parts.playerName}
        </Link>
        <span>
          {"'s "}
          {parts.rest}
        </span>
      </p>
    );
  }
  if (playerId) {
    return (
      <p className="truncate text-[12.5px] text-[#c8cdd8]">
        <Link
          to={`/sports/mlb/player/${playerId}`}
          state={{ from: returnPath }}
          className="text-accent hover:underline"
        >
          {clip.title}
        </Link>
      </p>
    );
  }
  return <p className="truncate text-[12.5px] text-[#c8cdd8]">{clip.title}</p>;
}

function TonightHighlightsSection({
  digest,
  loading,
  error,
  returnPath,
}: {
  digest: MlbTonightDigest | null;
  loading: boolean;
  error: string | null;
  returnPath: string;
}) {
  const [active, setActive] = useState<MlbTonightHighlight | null>(null);

  if (loading) return <LoadingBlock label="Loading tonight’s highlights…" />;
  if (error) return <ErrorLine>{error}</ErrorLine>;
  if (!digest) {
    return (
      <EmptyLine>
        No games on the board yet — check back once tonight’s slate gets underway.
      </EmptyLine>
    );
  }

  const { league, topHitters, topPitchers, tagged, highlights } = digest;
  const statTiles = [
    { label: "Games", value: String(league.gamesPlayed) },
    { label: "Live", value: String(league.gamesLive) },
    { label: "Home runs", value: String(league.homeRuns) },
    { label: "Runs", value: String(league.runs) },
    { label: "Hits", value: String(league.hits) },
    { label: "Strikeouts", value: String(league.strikeouts) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="rule-head">Tonight in MLB</h2>
          <p className="text-chalk-dim text-[10px] uppercase tracking-[0.12em]">{league.date}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {statTiles.map((tile) => (
            <div
              key={tile.label}
              className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-center"
            >
              <p className="numeral text-cream text-[20px] font-semibold leading-none">{tile.value}</p>
              <p className="text-chalk-dim mt-1.5 text-[10px] uppercase tracking-[0.14em]">
                {tile.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {(topHitters.length > 0 || topPitchers.length > 0) && (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <PerformerTable title="Best hitting" rows={topHitters} returnPath={returnPath} />
          <PerformerTable title="Best pitching" rows={topPitchers} returnPath={returnPath} />
        </section>
      )}

      {tagged.length > 0 ? (
        <TaggedPerformersTable rows={tagged} returnPath={returnPath} />
      ) : null}

      <section>
        <h3 className="rule-head mb-3">Premium highlights &amp; web gems</h3>
        {highlights.length ? (
          <HighlightClipGrid clips={highlights} returnPath={returnPath} onPlay={setActive} />
        ) : (
          <EmptyLine>
            No premium clips yet — walk-offs, homers, and web gems will show up here as games
            finish.
          </EmptyLine>
        )}
      </section>

      {active ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setActive(null)}
        >
          <div
            className="w-full max-w-3xl overflow-hidden rounded-xl border border-white/10 bg-[#0a101c] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-2.5">
              <div className="min-w-0">
                <HighlightModalTitle clip={active} returnPath={returnPath} />
                {active.circumstance ? (
                  <p className="text-chalk-dim mt-0.5 line-clamp-2 text-[11px]">{active.circumstance}</p>
                ) : null}
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="text-chalk-dim text-[10px] uppercase tracking-[0.12em]">
                    {active.gameLabel}
                  </p>
                  {active.winProbabilityAdded != null ? (
                    <span className="numeral text-[10px] text-emerald-300">
                      {active.winProbabilityAdded >= 0 ? "+" : ""}
                      {active.winProbabilityAdded.toFixed(1)}% WPA
                    </span>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActive(null)}
                className="text-[11px] uppercase tracking-[0.14em] text-[#8b93a7] hover:text-[#e8ebf2]"
              >
                Close
              </button>
            </div>
            <HighlightVideoPlayer src={active.url} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PerformerTable({
  title,
  rows,
  returnPath,
}: {
  title: string;
  rows: MlbTonightPerformer[];
  returnPath: string;
}) {
  if (!rows.length) return null;
  return (
    <div className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
      <div className="border-b border-white/[0.06] px-4 py-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
          {title}
        </h3>
        <p className="text-chalk-dim mt-1 text-[10px]">DraftKings-style fantasy points</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-[12px]">
          <thead className="text-chalk-dim text-[10px] uppercase tracking-[0.12em]">
            <tr className="border-b border-white/[0.06]">
              <th className="px-3 py-2 font-medium">Player</th>
              <th className="px-2 py-2 font-medium">Today</th>
              <th className="px-2 py-2 font-medium">Season</th>
              <th className="px-2 py-2 font-medium">Matchup</th>
              <th className="numeral px-3 py-2 text-right font-medium">FP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${title}-${row.playerId}-${row.gamePk}`} className="border-t border-white/[0.04]">
                <td className="px-3 py-2.5">
                  <Link
                    to={`/sports/mlb/player/${row.playerId}`}
                    state={{ from: returnPath }}
                    className="text-cream inline-flex items-center gap-2 font-semibold hover:text-accent hover:underline"
                  >
                    <img
                      src={mlbHeadshot(row.playerId)}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover object-top ring-1 ring-white/10"
                      loading="lazy"
                    />
                    <span>
                      {row.name}
                      <span className="text-chalk-dim ml-1 text-[10px]">{row.teamAbbrev}</span>
                    </span>
                  </Link>
                </td>
                <td className="numeral text-chalk px-2 py-2.5">{row.todayLine}</td>
                <td className="numeral text-chalk-dim px-2 py-2.5">{row.seasonLine || "—"}</td>
                <td className="px-2 py-2.5">
                  <Link
                    to={`/sports/mlb/game/${row.gamePk}`}
                    state={{ from: returnPath }}
                    className="text-chalk-dim hover:text-accent text-[11px]"
                  >
                    {row.gameLabel}
                  </Link>
                </td>
                <td className="numeral text-accent px-3 py-2.5 text-right font-semibold">
                  {row.fantasyPoints % 1 === 0 ? row.fantasyPoints : row.fantasyPoints.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TaggedPerformersTable({
  rows,
  returnPath,
}: {
  rows: MlbTonightTaggedRow[];
  returnPath: string;
}) {
  return (
    <div className="bg-panel overflow-hidden rounded-xl border border-[#7eb6ff]/25">
      <div className="border-b border-white/[0.06] px-4 py-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7eb6ff]">
          Tagged players
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-[12px]">
          <thead className="text-chalk-dim text-[10px] uppercase tracking-[0.12em]">
            <tr className="border-b border-white/[0.06]">
              <th className="px-3 py-2 font-medium">Player</th>
              <th className="px-2 py-2 font-medium">Today</th>
              <th className="px-2 py-2 font-medium">Season</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.playerId} className="border-t border-white/[0.04]">
                <td className="px-3 py-2.5">
                  <Link
                    to={`/sports/mlb/player/${row.playerId}`}
                    state={{ from: returnPath }}
                    className="text-cream inline-flex items-center gap-2 font-semibold hover:text-accent hover:underline"
                  >
                    <img
                      src={mlbHeadshot(row.playerId)}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover object-top ring-1 ring-white/10"
                      loading="lazy"
                    />
                    <span>
                      {row.name}
                      <span className="text-chalk-dim ml-1 text-[10px]">
                        {row.teamAbbrev}
                        {row.position ? ` · ${row.position}` : ""}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="numeral text-chalk px-2 py-2.5">{row.todayLine}</td>
                <td className="numeral text-chalk-dim px-2 py-2.5">{row.seasonLine}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HighlightClipGrid({
  clips,
  returnPath,
  onPlay,
}: {
  clips: MlbTonightHighlight[];
  returnPath: string;
  onPlay: (clip: MlbTonightHighlight) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
      {clips.map((clip) => (
        <article
          key={clip.id}
          className={cn(
            "overflow-hidden rounded-lg border bg-white/[0.025] transition hover:border-white/12",
            clip.watchKind === "favorite" && "border-accent/35 bg-accent/[0.04]",
            clip.watchKind === "tagged" && "border-[#7eb6ff]/35 bg-[#7eb6ff]/[0.04]",
            !clip.watchKind && "border-white/[0.06]",
          )}
        >
          <button
            type="button"
            onClick={() => onPlay(clip)}
            className="group w-full text-left"
          >
            <div className="relative aspect-video bg-black/50">
              {clip.thumb ? (
                <img
                  src={clip.thumb}
                  alt=""
                  className="h-full w-full object-cover opacity-90"
                  loading="lazy"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-[#132033] to-[#0a101c]" />
              )}
              <div className="absolute inset-0 grid place-items-center bg-black/20 transition group-hover:bg-black/10">
                <span className="grid h-10 w-10 place-items-center rounded-full border border-white/25 bg-black/45 text-[#e8ebf2]">
                  <Play size={15} className="ml-0.5 fill-current" />
                </span>
              </div>
              {clip.duration ? (
                <span className="absolute right-2 bottom-2 rounded-sm bg-black/55 px-1.5 py-0.5 text-[10px] text-[#d5dae6]">
                  {clip.duration.replace(/^00:/, "")}
                </span>
              ) : null}
            </div>
          </button>
          <div className="space-y-1.5 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/sports/mlb/game/${clip.gamePk}`}
                state={{ from: returnPath }}
                className="text-chalk-dim hover:text-accent text-[10px] uppercase tracking-[0.12em]"
              >
                {clip.gameLabel}
              </Link>
              {clip.watchKind === "favorite" ? (
                <span className="text-accent inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em]">
                  <Star size={10} className="fill-current" /> Favorite
                </span>
              ) : clip.watchKind === "tagged" ? (
                <span className="text-[10px] uppercase tracking-[0.12em] text-[#7eb6ff]">
                  Tagged
                </span>
              ) : null}
              {clip.isDefense ? (
                <span className="text-[10px] uppercase tracking-[0.12em] text-amber-300/90">
                  Web gem
                </span>
              ) : null}
            </div>
            <p className="line-clamp-2 text-[12.5px] leading-snug text-[#b8bfd0]">{clip.title}</p>
            {clip.circumstance ? (
              <p className="text-chalk-dim line-clamp-2 text-[11px] leading-snug">{clip.circumstance}</p>
            ) : null}
            {(clip.winProbabilityAdded != null || clip.leverageIndex != null) && (
              <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.12em]">
                {clip.winProbabilityAdded != null ? (
                  <span
                    className={cn(
                      "numeral rounded-sm px-1.5 py-0.5",
                      clip.winProbabilityAdded >= 0
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-alert/15 text-alert",
                    )}
                  >
                    {clip.winProbabilityAdded >= 0 ? "+" : ""}
                    {clip.winProbabilityAdded.toFixed(1)}% WPA
                  </span>
                ) : null}
                {clip.leverageIndex != null ? (
                  <span className="text-chalk-dim numeral">LI {clip.leverageIndex.toFixed(2)}</span>
                ) : null}
              </div>
            )}
            {clip.playerIds[0] ? (
              <Link
                to={`/sports/mlb/player/${clip.playerIds[0]}`}
                state={{ from: returnPath }}
                className="text-accent text-[11px] hover:underline"
              >
                Player card
              </Link>
            ) : null}
          </div>
        </article>
      ))}
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

function ManagerCarouselPhoto({
  managerId,
  primary,
}: {
  managerId: number | string;
  primary?: string | null;
}) {
  const chain = useMemo(() => {
    const fallbacks = mlbHeadshotFallbacks(managerId, 213);
    if (primary && !fallbacks.includes(primary)) return [primary, ...fallbacks];
    if (primary) return [primary, ...fallbacks.filter((u) => u !== primary)];
    return fallbacks;
  }, [managerId, primary]);
  const [idx, setIdx] = useState(0);
  const src = chain[Math.min(idx, chain.length - 1)] ?? chain[0]!;

  return (
    <img
      src={src}
      alt=""
      className="aspect-[3/4] w-full object-cover object-[center_18%]"
      loading="lazy"
      onError={() => {
        setIdx((i) => (i + 1 < chain.length ? i + 1 : i));
      }}
    />
  );
}
