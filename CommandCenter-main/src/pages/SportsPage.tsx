import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Settings2,
  Trophy,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import StarField from "@/components/StarField";
import GolfSidebar from "@/components/sports/GolfSidebar";
import HeroGameCard from "@/components/sports/HeroGameCard";
import {
  MlbTeamLeadersSection,
  MlbTeamOrgSummary,
  MlbTeamPayrollTable,
  MlbTeamWinTrend,
} from "@/components/sports/MlbTeamExtras";
import TeamMark from "@/components/sports/TeamMark";
import { useAuth } from "@/lib/auth-context";
import { fetchMlbFarmSystemRankings, fetchTeamCurrentGame, mlbHeadshot, teamPagePath } from "@/lib/mlb";
import { fetchMlbTeamStatLeagueRanks } from "@/lib/mlb-team-page";
import {
  DEFAULT_FAVORITES,
  ensureFavoriteTeamsSeeded,
  favoriteByKey,
  fetchTeamDetail,
  fetchTeamSnapshot,
  fetchTourSnapshot,
  loadSportsLayout,
  saveSportsLayout,
  visibleFavorites,
  type GameChip,
  type RosterPlayer,
  type ScheduleGame,
  type SportsFavorite,
  type SportsLayout,
  type TeamDetail,
  type TeamSnapshot,
  type TourSnapshot,
} from "@/lib/sports";
import { cn } from "@/lib/utils";
import { fetchChampionshipPromotionOdds } from "@/lib/soccer";

function ordinalSuffixLocal(n: number): string {
  const v = Math.abs(n) % 100;
  if (v >= 11 && v <= 13) return "th";
  switch (v % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

function SoccerRosterList({ roster }: { roster: RosterPlayer[] }) {
  const groups = useMemo(() => {
    const order = ["Goalkeeper", "Defender", "Midfielder", "Forward", "Other"];
    const map = new Map<string, RosterPlayer[]>();
    for (const p of roster) {
      const g = p.positionGroup || "Other";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(p);
    }
    return order
      .filter((g) => map.has(g))
      .concat([...map.keys()].filter((g) => !order.includes(g)))
      .map((g) => ({ name: g, players: map.get(g)! }));
  }, [roster]);

  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <div key={g.name}>
          <p className="text-chalk-dim mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]">
            {g.name}
            <span className="text-chalk-dim/70 ml-1.5 font-normal normal-case tracking-normal">
              {g.players.length}
            </span>
          </p>
          <ul className="bg-panel divide-y divide-white/[0.05] rounded border border-white/[0.07]">
            {g.players.map((p) => (
              <li key={p.id} className="flex items-center gap-2.5 px-3 py-2">
                {p.headshot ? (
                  <img
                    src={p.headshot}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-full object-cover bg-white/5"
                    loading="lazy"
                  />
                ) : (
                  <span className="bg-white/5 text-chalk-dim grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px]">
                    {p.position ?? "?"}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-cream truncate text-[12.5px]">
                    {p.number ? (
                      <span className="text-chalk-dim numeral mr-1.5 text-[11px]">#{p.number}</span>
                    ) : null}
                    {p.name}
                  </p>
                  <p className="text-chalk-dim truncate text-[10px]">
                    {[p.position, p.nationality, p.age != null ? `Age ${p.age}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function GameLine({
  label,
  game,
}: {
  label: string;
  game: GameChip | null;
}) {
  if (!game) {
    return (
      <div className="flex justify-between gap-3 text-[11.5px]">
        <span className="text-chalk-dim">{label}</span>
        <span className="text-chalk-dim">—</span>
      </div>
    );
  }
  return (
    <div className="flex items-baseline justify-between gap-3 text-[11.5px]">
      <span className="text-chalk-dim shrink-0">{label}</span>
      <span className="min-w-0 text-right">
        <span
          className={cn(
            "text-cream",
            game.won === true && "text-turf",
            game.won === false && "text-alert",
            game.live && "text-cream",
          )}
        >
          {game.label}
          {game.detail ? ` · ${game.detail}` : ""}
          {game.live ? (
            <span className="text-alert ml-1.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide">
              <span className="bg-alert inline-block h-1.5 w-1.5 animate-pulse rounded-full" />
              Live
            </span>
          ) : null}
        </span>
        {game.when && (
          <span className="text-chalk-dim mt-0.5 block text-[10.5px]">{game.when}</span>
        )}
      </span>
    </div>
  );
}

function TeamCard({
  snap,
  accent,
  mlbTeamId,
  onOpen,
  promotionLine,
  farmRank,
}: {
  snap: TeamSnapshot;
  accent?: string;
  mlbTeamId?: number;
  onOpen: () => void;
  /** e.g. "Promotion 86% (−614)" for Championship clubs. */
  promotionLine?: string | null;
  /** Pipeline Top-100 farm system rank, e.g. 4. */
  farmRank?: number | null;
}) {
  const bar = accent ? `#${accent}` : "var(--color-accent)";
  const logo =
    snap.logo ||
    (mlbTeamId
      ? `https://www.mlbstatic.com/team-logos/${mlbTeamId}.svg`
      : null);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="bg-panel group relative w-full overflow-hidden rounded border border-white/[0.07] text-left transition hover:border-accent/35 hover:shadow-[0_0_0_1px_rgba(190,10,20,0.12)]"
    >
      <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: bar }} />
      <div className="flex items-start gap-3.5 p-4 pt-5">
        {logo ? (
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-white p-1.5 shadow-sm">
            <img src={logo} alt="" className="h-full w-full object-contain" />
          </div>
        ) : (
          <div className="bg-field grid h-16 w-16 shrink-0 place-items-center rounded-full">
            <Trophy size={20} className="text-chalk-dim" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-cream text-[20px] leading-tight group-hover:underline">
            {snap.shortName}
          </h3>
          <p className="text-chalk-dim mt-0.5 text-[10.5px] uppercase tracking-[0.14em]">
            {snap.name}
          </p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {snap.record && (
              <span className="numeral text-accent text-[22px] leading-none">{snap.record}</span>
            )}
            {snap.standing && (
              <span className="text-chalk text-[11.5px]">{snap.standing}</span>
            )}
          </div>
          {farmRank != null && farmRank > 0 ? (
            <p className="mt-1.5 text-[11px] font-medium tracking-wide text-emerald-300/90">
              Farm #{farmRank}
            </p>
          ) : null}
          {promotionLine ? (
            <p className="text-accent/90 mt-1.5 text-[11px] font-medium tracking-wide">
              {promotionLine}
            </p>
          ) : null}
        </div>
        <span className="text-chalk-dim group-hover:text-accent shrink-0 self-center text-[10px] uppercase tracking-[0.14em] opacity-0 transition group-hover:opacity-100">
          Open
        </span>
      </div>
      <div className="border-t border-white/[0.06] px-4 py-3 flex flex-col gap-2">
        <GameLine label="Last" game={snap.lastGame} />
        <GameLine label="Next" game={snap.nextGame} />
      </div>
    </button>
  );
}

function TourCard({
  snap,
  accent,
  onOpenGolf,
}: {
  snap: TourSnapshot;
  accent?: string;
  onOpenGolf?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const bar = accent ? `#${accent}` : "var(--color-accent)";
  const rows = expanded ? snap.field : snap.leaders;
  return (
    <article className="bg-panel relative overflow-hidden rounded border border-white/[0.07] sm:col-span-2">
      <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: bar }} />
      <div className="p-4 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="rule-head mb-1">PGA Tour</div>
            <h3 className="font-display text-cream text-[22px] leading-tight">
              {snap.eventName ?? "This week’s event"}
            </h3>
            {snap.status && <p className="text-chalk mt-1 text-[12px]">{snap.status}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {onOpenGolf && (
              <button
                type="button"
                onClick={onOpenGolf}
                className="text-chalk hover:text-cream rounded-sm border border-white/10 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.14em] transition hover:border-emerald-500/40"
              >
                Golf sidebar
              </button>
            )}
            {snap.field.length > 5 && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="text-chalk hover:text-cream rounded-sm border border-white/10 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.14em]"
              >
                {expanded ? "Top 5" : "Expand field"}
              </button>
            )}
          </div>
        </div>
        {rows.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[360px] text-left">
              <thead>
                <tr className="border-b border-white/[0.1] text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">
                  <th className="py-2 pr-2 font-medium">Pos</th>
                  <th className="py-2 pr-2 font-medium">Player</th>
                  <th className="py-2 pr-2 text-right font-medium">Tot</th>
                  <th className="py-2 pr-2 text-right font-medium">Today</th>
                  <th className="py-2 pr-2 text-right font-medium">Thru</th>
                  <th className="py-2 text-right font-medium">
                    R{rows.find((r) => r.latestRoundNum)?.latestRoundNum ?? 1}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l, i) => (
                  <tr
                    key={`${l.id ?? l.name}-${i}`}
                    className="border-b border-white/[0.05] last:border-0"
                  >
                    <td className="numeral text-chalk-dim py-2.5 pr-2 text-[12px]">
                      {l.position ?? i + 1}
                    </td>
                    <td className="py-2.5 pr-2">
                      {l.id ? (
                        <Link
                          to={`/sports/golf/player/${l.id}`}
                          className="text-cream text-[13px] hover:underline"
                        >
                          {l.shortName ?? l.name}
                        </Link>
                      ) : (
                        <span className="text-cream text-[13px]">{l.shortName ?? l.name}</span>
                      )}
                    </td>
                    <td className="numeral py-2.5 pr-2 text-right text-[15px] font-semibold text-cream">
                      {l.score}
                    </td>
                    <td
                      className={cn(
                        "numeral py-2.5 pr-2 text-right text-[15px] font-bold tabular-nums",
                        !l.today || l.today === "—" || l.today === "E"
                          ? "text-chalk"
                          : l.today.startsWith("-")
                            ? "text-[#4ade80]"
                            : l.today.startsWith("+")
                              ? "text-[#f87171]"
                              : "text-chalk",
                      )}
                    >
                      {l.today ?? "—"}
                    </td>
                    <td className="numeral text-chalk py-2.5 pr-2 text-right text-[12px]">
                      {l.thru ?? "—"}
                    </td>
                    <td className="numeral text-chalk py-2.5 text-right text-[12px]">
                      {l.latestRound ?? l.r1 ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-chalk-dim mt-4 text-[12.5px]">No leaderboard right now.</p>
        )}
      </div>
    </article>
  );
}

function CustomizePanel({
  layout,
  onChange,
  onClose,
}: {
  layout: SportsLayout;
  onChange: (next: SportsLayout) => void;
  onClose: () => void;
}) {
  const byKey = useMemo(() => new Map(DEFAULT_FAVORITES.map((f) => [f.key, f])), []);
  const hidden = new Set(layout.hidden);

  const move = (key: string, dir: -1 | 1) => {
    const order = [...layout.order];
    const i = order.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    onChange({ ...layout, order });
  };

  const toggle = (key: string) => {
    const next = new Set(layout.hidden);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange({ ...layout, hidden: [...next] });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <aside
        className="bg-field h-full w-full max-w-full overflow-y-auto overscroll-contain border-l border-accent/25 p-6"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 5rem)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-cream text-[22px] leading-tight">
              Customize <span className="text-accent">board</span>
            </h2>
            <p className="text-chalk-dim mt-1 text-[11.5px]">
              Reorder favorites and hide what you don’t want on the dashboard.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-chalk hover:text-cream text-[10.5px] uppercase tracking-[0.14em]"
          >
            Done
          </button>
        </div>

        <ul className="flex flex-col gap-2">
          {layout.order.map((key) => {
            const fav = byKey.get(key);
            if (!fav) return null;
            const on = !hidden.has(key);
            return (
              <li
                key={key}
                className="bg-panel flex items-center gap-2 rounded border border-white/[0.07] px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[13px]", on ? "text-cream" : "text-chalk-dim")}>
                    {fav.name}
                  </p>
                  <p className="text-chalk-dim text-[10.5px] uppercase tracking-[0.12em]">
                    {fav.league} · {fav.sport}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Move ${fav.shortName} up`}
                  onClick={() => move(key, -1)}
                  className="text-chalk hover:text-cream p-1.5"
                >
                  <ChevronUp size={15} />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${fav.shortName} down`}
                  onClick={() => move(key, 1)}
                  className="text-chalk hover:text-cream p-1.5"
                >
                  <ChevronDown size={15} />
                </button>
                <button
                  type="button"
                  aria-label={on ? `Hide ${fav.shortName}` : `Show ${fav.shortName}`}
                  onClick={() => toggle(key)}
                  className={cn("p-1.5", on ? "text-accent" : "text-chalk-dim")}
                >
                  {on ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
              </li>
            );
          })}
        </ul>

        <p className="text-chalk-dim mt-6 text-[11.5px] leading-relaxed">
          Player pins are next — you’ll be able to follow specific Cardinals, Lions,
          golfers, and more on this same board.
        </p>
      </aside>
    </div>
  );
}

export default function SportsPage() {
  const { user } = useAuth();
  const [layout, setLayout] = useState<SportsLayout>(() => loadSportsLayout());
  const [customizing, setCustomizing] = useState(false);
  const [searchParams] = useSearchParams();
  const [selectedKey, setSelectedKey] = useState<string | null>(
    () => searchParams.get("team") || null,
  );
  const [golfOpen, setGolfOpen] = useState(false);

  useEffect(() => {
    const team = searchParams.get("team");
    if (team) setSelectedKey(team);
    if (searchParams.get("golf") === "1") setGolfOpen(true);
  }, [searchParams]);

  useEffect(() => {
    if (!user?.id) return;
    void ensureFavoriteTeamsSeeded(user.id).catch(() => {
      // table seed is best-effort; the board still works from defaults
    });
  }, [user?.id]);

  // Back-swipe closes Customize the same way book/browse panels do.
  useEffect(() => {
    if (!customizing) return;
    const st = (history.state as { sportsCustomize?: boolean } | null) ?? {};
    if (!st.sportsCustomize) {
      history.pushState({ ...st, sportsCustomize: true }, "", window.location.href);
    }
    const onPop = (e: PopStateEvent) => {
      const next = (e.state as { sportsCustomize?: boolean } | null) ?? {};
      if (!next.sportsCustomize) setCustomizing(false);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [customizing]);

  const closeCustomize = () => {
    const st = (history.state as { sportsCustomize?: boolean } | null) ?? {};
    if (st.sportsCustomize) history.back();
    else setCustomizing(false);
  };

  useEffect(() => {
    if (!selectedKey) return;
    const st = (history.state as { sportsTeam?: string } | null) ?? {};
    if (st.sportsTeam !== selectedKey) {
      history.pushState({ ...st, sportsTeam: selectedKey }, "", window.location.href);
    }
    const onPop = (e: PopStateEvent) => {
      const next = (e.state as { sportsTeam?: string } | null) ?? {};
      if (!next.sportsTeam) setSelectedKey(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [selectedKey]);

  const closeTeam = () => {
    const st = (history.state as { sportsTeam?: string } | null) ?? {};
    if (st.sportsTeam) history.back();
    else setSelectedKey(null);
  };

  const selectedFav = selectedKey ? favoriteByKey(selectedKey) : undefined;
  const detailQuery = useQuery({
    queryKey: ["sports-team-detail", selectedKey],
    queryFn: () => fetchTeamDetail(selectedFav!),
    enabled: Boolean(selectedFav),
    staleTime: 60_000,
    retry: 1,
  });

  const favorites = useMemo(() => visibleFavorites(layout), [layout]);

  const teamFavs = favorites.filter((f) => f.kind === "team");
  const tourFavs = favorites.filter((f) => f.kind === "tour");

  const teamQueries = useQueries({
    queries: teamFavs.map((fav) => ({
      queryKey: ["sports-team", fav.key],
      queryFn: () => fetchTeamSnapshot(fav),
      staleTime: 60_000,
      retry: 1,
    })),
  });

  const tourQueries = useQueries({
    queries: tourFavs.map((fav) => ({
      queryKey: ["sports-tour", fav.key],
      queryFn: () => fetchTourSnapshot(fav),
      staleTime: 60_000,
      retry: 1,
    })),
  });

  const promotionOdds = useQuery({
    queryKey: ["championship-promotion-odds"],
    queryFn: fetchChampionshipPromotionOdds,
    staleTime: 30 * 60_000,
    retry: 1,
  });

  const farmRanks = useQuery({
    queryKey: ["mlb-farm-system-ranks"],
    queryFn: fetchMlbFarmSystemRankings,
    staleTime: 600_000,
    retry: 1,
  });

  const farmRankByTeamId = useMemo(() => {
    const map = new Map<number, number>();
    for (const row of farmRanks.data ?? []) map.set(row.teamId, row.rank);
    return map;
  }, [farmRanks.data]);

  const promotionByTeamId = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of promotionOdds.data ?? []) {
      const pct = row.percent != null ? `${row.percent}%` : null;
      const am = row.american;
      if (!pct && !am) continue;
      map.set(
        String(row.teamId),
        `Promotion ${[pct, am ? `(${am})` : null].filter(Boolean).join(" ")}`,
      );
    }
    return map;
  }, [promotionOdds.data]);

  const seed = useQuery({
    queryKey: ["sports-seed", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      await ensureFavoriteTeamsSeeded(user.id);
      return true;
    },
    enabled: Boolean(user?.id),
  });

  const cardsHero = useQuery({
    queryKey: ["sports-hero-game", 138],
    queryFn: () => fetchTeamCurrentGame(138),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const updateLayout = (next: SportsLayout) => {
    setLayout(next);
    saveSportsLayout(next);
  };

  const refreshing =
    teamQueries.some((q) => q.isFetching) || tourQueries.some((q) => q.isFetching);

  const refreshAll = () => {
    void Promise.all([
      ...teamQueries.map((q) => q.refetch()),
      ...tourQueries.map((q) => q.refetch()),
    ]).then(() => toast.success("Scores updated"));
  };

  const byKeyFav = useMemo(
    () => new Map(DEFAULT_FAVORITES.map((f) => [f.key, f] as const)),
    [],
  );

  return (
    <div className="flex min-h-0 flex-col gap-5 p-4 md:p-7">
      {seed.isError && (
        <p className="text-chalk-dim text-[11.5px]">
          Couldn’t sync favorites to the cloud — using your local board.
        </p>
      )}

      {/* Hide board hero while team detail is open — panel covers the right half otherwise. */}
      {cardsHero.data && !selectedKey && (
        <HeroGameCard
          game={cardsHero.data}
          accent="#be0a14"
          label={
            cardsHero.data.live
              ? "Cardinals · Live"
              : cardsHero.data.final
                ? "Cardinals · Latest"
                : "Cardinals · Next up"
          }
        />
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {favorites.map((fav) => {
          if (fav.kind === "tour") {
            const qi = tourFavs.findIndex((f) => f.key === fav.key);
            const q = tourQueries[qi];
            if (q?.isPending) return <SkeletonCard key={fav.key} wide />;
            if (q?.isError || !q?.data) {
              return <ErrorCard key={fav.key} fav={fav} message={errorMessage(q?.error)} />;
            }
            return (
              <TourCard
                key={fav.key}
                snap={q.data}
                accent={fav.color}
                onOpenGolf={() => setGolfOpen(true)}
              />
            );
          }
          const qi = teamFavs.findIndex((f) => f.key === fav.key);
          const q = teamQueries[qi];
          if (q?.isPending) return <SkeletonCard key={fav.key} />;
          if (q?.isError || !q?.data) {
            return <ErrorCard key={fav.key} fav={fav} message={errorMessage(q?.error)} />;
          }
          return (
            <TeamCard
              key={fav.key}
              snap={q.data}
              accent={byKeyFav.get(fav.key)?.color}
              mlbTeamId={byKeyFav.get(fav.key)?.mlbTeamId}
              farmRank={
                byKeyFav.get(fav.key)?.mlbTeamId
                  ? farmRankByTeamId.get(byKeyFav.get(fav.key)!.mlbTeamId!) ?? null
                  : null
              }
              promotionLine={
                /soccer\/eng\.2/i.test(fav.espnPath)
                  ? promotionByTeamId.get(fav.espnPath.split("/").pop() ?? "") ?? null
                  : null
              }
              onOpen={() => setSelectedKey(fav.key)}
            />
          );
        })}
      </div>

      {favorites.length === 0 && (
        <p className="text-chalk-dim text-center text-[13px]">
          Everything’s hidden. Open Customize to bring teams back.
        </p>
      )}

      <div className="relative overflow-hidden rounded-lg border border-accent/25 bg-gradient-to-br from-hero-lift to-hero p-5 sm:p-7">
        <StarField count={28} seed={19} />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="rule-head mb-2">Sports</div>
            <h2 className="font-display text-cream text-[28px] leading-tight sm:text-[34px]">
              Your <span className="text-accent">board</span>
            </h2>
            <p className="text-chalk mt-2 max-w-lg text-[13px] leading-relaxed">
              Tap a team for standings, schedule, roster, and odds.
              Or open the full MLB hub for live scores and league leaders.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/sports/mlb"
              className="from-accent-deep to-accent-dark text-cream rounded-sm bg-gradient-to-b px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.14em]"
            >
              MLB hub
            </Link>
            <a
              href="/sports.html"
              className="text-chalk hover:text-cream rounded-sm border border-white/10 px-3 py-2 text-[10.5px] uppercase tracking-[0.14em] transition hover:border-accent/40"
            >
              Sports Home Screen
            </a>
            <button
              type="button"
              onClick={refreshAll}
              disabled={refreshing}
              className="text-chalk hover:text-cream flex items-center gap-2 rounded-sm border border-white/10 px-3 py-2 text-[10.5px] uppercase tracking-[0.14em] transition hover:border-accent/40 disabled:opacity-40"
            >
              <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setCustomizing(true)}
              className="text-chalk hover:text-cream flex items-center gap-2 rounded-sm border border-white/10 px-3 py-2 text-[10.5px] uppercase tracking-[0.14em] transition hover:border-accent/40"
            >
              <Settings2 size={13} />
              Customize
            </button>
          </div>
        </div>
      </div>

      {customizing && (
        <CustomizePanel layout={layout} onChange={updateLayout} onClose={closeCustomize} />
      )}

      {selectedKey && selectedFav && (
        <TeamDetailPanel
          fav={selectedFav}
          detail={detailQuery.data ?? null}
          loading={detailQuery.isPending || detailQuery.isFetching}
          error={detailQuery.isError ? errorMessage(detailQuery.error) : null}
          onClose={closeTeam}
        />
      )}

      <GolfSidebar
        open={golfOpen}
        onClose={() => {
          const st = (history.state as { sportsGolf?: boolean } | null) ?? {};
          if (st.sportsGolf) history.back();
          else setGolfOpen(false);
        }}
      />
    </div>
  );
}

function TeamDetailPanel({
  fav,
  detail,
  loading,
  error,
  onClose,
}: {
  fav: SportsFavorite;
  detail: TeamDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const accent = fav.color ? `#${fav.color}` : "var(--color-accent)";
  const title = detail?.shortName ?? fav.shortName;
  const mlbTeamId = fav.mlbTeamId;
  const nflTeamId =
    fav.league === "NFL" ? (fav.espnPath.split("/").pop() ?? null) : null;
  const isSoccer = /soccer\//i.test(fav.espnPath);

  const hero = useQuery({
    queryKey: ["team-detail-hero", mlbTeamId],
    queryFn: () => fetchTeamCurrentGame(mlbTeamId!),
    enabled: Boolean(mlbTeamId),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const teamStatRanks = useQuery({
    queryKey: ["mlb-team-stat-ranks", mlbTeamId],
    queryFn: () => fetchMlbTeamStatLeagueRanks(mlbTeamId!),
    enabled: Boolean(mlbTeamId) && detail?.source === "mlb",
    staleTime: 60 * 60_000,
  });

  const statRankMap = useMemo(() => {
    const map: Record<string, { rank: number; of: number }> = {};
    for (const r of teamStatRanks.data ?? []) map[r.label] = { rank: r.rank, of: r.of };
    return map;
  }, [teamStatRanks.data]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/55" onClick={onClose}>
      <aside
        className="bg-field flex h-full w-full max-w-full flex-col overflow-hidden border-l border-accent/25"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 border-b border-white/[0.07] px-5 py-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="rule-head mb-1">{fav.league}</div>
              <h2 className="font-display text-cream text-[26px] leading-tight">{title}</h2>
              <p className="text-chalk-dim mt-0.5 text-[11px] uppercase tracking-[0.14em]">
                {detail?.name ?? fav.name}
                {detail?.source === "mlb" ? " · MLB Stats API" : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-chalk hover:text-cream rounded-sm p-2"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
          {detail && (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {detail.record && (
                <span className="numeral text-cream text-[24px] leading-none">
                  {detail.record}
                </span>
              )}
              {detail.standing && (
                <span className="text-chalk text-[12px]">{detail.standing}</span>
              )}
            </div>
          )}
          {nflTeamId && /^\d+$/.test(nflTeamId) && (
            <Link
              to={`/sports/nfl/team/${nflTeamId}`}
              className="text-accent mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Full team page
            </Link>
          )}
          {detail && (detail.manager || detail.generalManager) ? (
            <div className="mt-3 flex flex-col gap-1 border-t border-white/[0.06] pt-3">
              {detail.manager ? (
                <p className="text-chalk text-[12px]">
                  <span className="text-chalk-dim uppercase tracking-[0.12em]">
                    {detail.manager.title || "Manager"}
                  </span>
                  {" · "}
                  <Link
                    to={`/sports/mlb/managers/${detail.manager.id}`}
                    className="text-cream hover:text-accent"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {detail.manager.name}
                  </Link>
                </p>
              ) : null}
              {detail.generalManager ? (
                <p className="text-chalk text-[12px]">
                  <span className="text-chalk-dim uppercase tracking-[0.12em]">
                    {detail.generalManager.title || "GM"}
                  </span>
                  {" · "}
                  <span className="text-cream">{detail.generalManager.name}</span>
                </p>
              ) : null}
            </div>
          ) : null}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          {loading && !detail && (
            <div className="text-chalk flex items-center justify-center gap-2 py-20 text-[13px]">
              <Loader2 size={16} className="animate-spin" />
              Loading team…
            </div>
          )}
          {error && !detail && (
            <p className="text-alert text-[13px]">{error}</p>
          )}
          {detail && (
            <div className="flex flex-col gap-7">
              {hero.data && (
                <HeroGameCard
                  game={hero.data}
                  accent={accent}
                  label={
                    hero.data.live
                      ? `${title} · Live`
                      : hero.data.final
                        ? `${title} · Latest`
                        : `${title} · Next up`
                  }
                />
              )}

              {mlbTeamId && detail.source === "mlb" && detail.abbrev && (
                <MlbTeamOrgSummary
                  abbrev={detail.abbrev}
                  accent={accent}
                  fallbackRecord={detail.record}
                  playoffOdds={formatOdds(detail.playoffOdds)}
                  wildCardOdds={
                    detail.wildCardOdds ? formatOdds(detail.wildCardOdds) : null
                  }
                />
              )}

              {mlbTeamId && detail.source === "mlb" && (
                <MlbTeamWinTrend teamId={mlbTeamId} accent={accent} />
              )}

              <DetailSection title="Standings">
                {detail.division.length === 0 ? (
                  <EmptyLine>No standings available.</EmptyLine>
                ) : (
                  <div className="bg-panel overflow-x-auto rounded border border-white/[0.07]">
                    <table className="w-full min-w-[420px] text-left text-[12px]">
                      <thead className="text-chalk-dim text-[10px] uppercase tracking-[0.12em]">
                        <tr className="border-b border-white/[0.06]">
                          <th className="px-3 py-2 font-medium">Team</th>
                          <th className="px-2 py-2 font-medium">{isSoccer ? "Pld" : "Rec"}</th>
                          {isSoccer ? (
                            <>
                              <th className="px-2 py-2 font-medium">GD</th>
                              <th className="px-2 py-2 font-medium">Pts</th>
                            </>
                          ) : (
                            <>
                              <th className="px-2 py-2 font-medium">Pct</th>
                              <th className="px-2 py-2 font-medium">GB</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {detail.division.map((row) => (
                          <tr
                            key={`${row.rank}-${row.team}`}
                            className={cn(
                              "border-t border-white/[0.04]",
                              row.isMe && "bg-white/[0.04]",
                              isSoccer &&
                                Number(row.rank) <= 2 &&
                                "bg-emerald-500/[0.04]",
                              isSoccer &&
                                Number(row.rank) >= 3 &&
                                Number(row.rank) <= 6 &&
                                "bg-sky-500/[0.03]",
                              isSoccer &&
                                Number(row.rank) >= 22 &&
                                "bg-rose-500/[0.04]",
                            )}
                          >
                            <td className={cn("px-3 py-2", row.isMe ? "text-cream font-medium" : "text-chalk")}>
                              <span className="inline-flex items-center gap-2">
                                <span className="text-chalk-dim numeral w-3">{row.rank}</span>
                                {detail.source === "mlb" && row.teamId ? (
                                  <TeamMark teamId={row.teamId} size="xs" />
                                ) : row.teamId && isSoccer ? (
                                  <img
                                    src={`https://a.espncdn.com/i/teamlogos/soccer/500/${row.teamId}.png`}
                                    alt=""
                                    className="h-4 w-4 object-contain"
                                    loading="lazy"
                                  />
                                ) : null}
                                {detail.source === "mlb" && row.teamId ? (
                                  <Link
                                    to={teamPagePath(Number(row.teamId))}
                                    className="hover:text-cream hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {row.team}
                                    {row.isMe ? " ★" : ""}
                                  </Link>
                                ) : (
                                  <>
                                    {row.team}
                                    {row.isMe ? " ★" : ""}
                                  </>
                                )}
                              </span>
                            </td>
                            <td className="numeral text-cream px-2 py-2">
                              {isSoccer ? row.record : row.record}
                            </td>
                            {isSoccer ? (
                              <>
                                <td className="numeral text-chalk px-2 py-2">{row.gd || "—"}</td>
                                <td className="numeral text-cream px-2 py-2 font-medium">
                                  {row.pts || "—"}
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="numeral text-chalk px-2 py-2">{row.pct || "—"}</td>
                                <td className="numeral text-chalk px-2 py-2">{row.gb}</td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {isSoccer ? (
                      <p className="text-chalk-dim border-t border-white/[0.05] px-3 py-2 text-[10px]">
                        Green = auto-promotion (1–2) · Blue = playoffs (3–6) · Red = relegation
                      </p>
                    ) : null}
                  </div>
                )}
              </DetailSection>

              {mlbTeamId && detail.source === "mlb" && (
                <MlbTeamLeadersSection teamId={mlbTeamId} accent={accent} />
              )}

              {mlbTeamId && detail.source === "mlb" && detail.abbrev && (
                <MlbTeamPayrollTable abbrev={detail.abbrev} />
              )}

              {isSoccer && detail.teamFacts.length > 0 ? (
                <DetailSection title="Club form">
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {detail.teamFacts.map((f) => (
                      <div
                        key={f.label}
                        className="bg-panel rounded border border-white/[0.07] px-2.5 py-2 text-center"
                      >
                        <p className="text-chalk-dim text-[9px] uppercase tracking-[0.14em]">
                          {f.label}
                        </p>
                        <p className="numeral text-cream mt-1 text-[16px] leading-none">{f.value}</p>
                      </div>
                    ))}
                  </div>
                </DetailSection>
              ) : null}

              <DetailSection title={isSoccer ? "Promotion odds" : "Playoff odds"}>
                {isSoccer && detail.soccerPromotion ? (
                  <div className="bg-panel rounded border border-white/[0.07] p-4">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="text-chalk-dim text-[10.5px] uppercase tracking-[0.14em]">
                          To be promoted
                        </p>
                        <p
                          className="numeral text-cream mt-1 text-[36px] leading-none"
                          style={{ color: accent }}
                        >
                          {detail.soccerPromotion.percent != null
                            ? `${detail.soccerPromotion.percent}%`
                            : "—"}
                        </p>
                      </div>
                      {detail.soccerPromotion.american ? (
                        <div className="text-right">
                          <p className="text-chalk-dim text-[10.5px] uppercase tracking-[0.14em]">
                            American
                          </p>
                          <p className="numeral text-cream mt-1 text-[22px]">
                            {detail.soccerPromotion.american}
                          </p>
                        </div>
                      ) : null}
                      {detail.soccerPromotion.projectedPlace != null ? (
                        <div className="text-right">
                          <p className="text-chalk-dim text-[10.5px] uppercase tracking-[0.14em]">
                            ESPN project
                          </p>
                          <p className="numeral text-cream mt-1 text-[22px]">
                            {detail.soccerPromotion.projectedPlace}
                            {ordinalSuffixLocal(detail.soccerPromotion.projectedPlace)}
                          </p>
                        </div>
                      ) : null}
                    </div>
                    {detail.soccerPromotion.percent != null ? (
                      <div className="bg-field mt-3 h-1.5 overflow-hidden rounded-full">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, Math.max(0, detail.soccerPromotion.percent))}%`,
                            background: accent,
                          }}
                        />
                      </div>
                    ) : null}
                    <p className="text-chalk-dim mt-2 text-[11px]">
                      {detail.soccerPromotion.source
                        ? `${detail.soccerPromotion.source}`
                        : "Promotion markets"}
                      {detail.soccerPromotion.zone
                        ? ` · currently ${detail.soccerPromotion.zone === "auto" ? "auto-promotion" : detail.soccerPromotion.zone === "playoff" ? "playoff places" : detail.soccerPromotion.zone === "relegation" ? "relegation zone" : "mid-table"}`
                        : ""}
                      {detail.soccerPromotion.url ? (
                        <>
                          {" · "}
                          <a
                            href={detail.soccerPromotion.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-accent hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Source
                          </a>
                        </>
                      ) : null}
                    </p>
                  </div>
                ) : detail.playoffOdds || detail.wildCardOdds ? (
                  <div className="bg-panel rounded border border-white/[0.07] p-4">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="text-chalk-dim text-[10.5px] uppercase tracking-[0.14em]">
                          Make playoffs
                        </p>
                        <p className="numeral text-cream mt-1 text-[36px] leading-none" style={{ color: accent }}>
                          {formatOdds(detail.playoffOdds)}
                        </p>
                      </div>
                      {detail.wildCardOdds && (
                        <div className="text-right">
                          <p className="text-chalk-dim text-[10.5px] uppercase tracking-[0.14em]">
                            Wild card
                          </p>
                          <p className="numeral text-cream mt-1 text-[22px]">
                            {formatOdds(detail.wildCardOdds)}
                          </p>
                        </div>
                      )}
                    </div>
                    {pctNumber(detail.playoffOdds) != null && (
                      <div className="bg-field mt-3 h-1.5 overflow-hidden rounded-full">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, Math.max(0, pctNumber(detail.playoffOdds)!))}%`,
                            background: accent,
                          }}
                        />
                      </div>
                    )}
                    <p className="text-chalk-dim mt-2 text-[11px]">ESPN projections</p>
                  </div>
                ) : (
                  <EmptyLine>
                    {isSoccer ? "Promotion odds not available yet." : "Playoff odds not available yet."}
                  </EmptyLine>
                )}
              </DetailSection>

              <CollapsibleDetailSection title="Upcoming" count={detail.upcoming.length} defaultOpen={false}>
                <GameList
                  games={detail.upcoming}
                  empty="No upcoming games."
                  mlbBoxscores={detail.source === "mlb"}
                />
              </CollapsibleDetailSection>

              <CollapsibleDetailSection title="Recent" count={detail.recent.length} defaultOpen={false}>
                <GameList
                  games={detail.recent}
                  empty="No recent games."
                  mlbBoxscores={detail.source === "mlb"}
                />
              </CollapsibleDetailSection>

              <CollapsibleDetailSection title="Roster" count={detail.roster.length} defaultOpen={false}>
                {detail.roster.length === 0 ? (
                  <EmptyLine>Roster unavailable.</EmptyLine>
                ) : isSoccer ? (
                  <SoccerRosterList roster={detail.roster} />
                ) : (
                  <ul className="bg-panel divide-y divide-white/[0.05] rounded border border-white/[0.07]">
                    {detail.roster.map((p) => {
                      const mlbClickable =
                        detail.source === "mlb" && /^\d+$/.test(String(p.id));
                      const nflClickable =
                        fav.league === "NFL" && /^\d+$/.test(String(p.id));
                      const href = mlbClickable
                        ? `/sports/mlb/player/${p.id}`
                        : nflClickable
                          ? `/sports/nfl/player/${p.id}`
                          : null;
                      const row = (
                        <>
                          <span className="text-chalk-dim numeral w-8 shrink-0 text-[11px]">
                            {p.number ? `#${p.number}` : "—"}
                          </span>
                          <span className="text-cream min-w-0 flex-1 truncate group-hover:underline">
                            {p.name}
                          </span>
                          <span className="text-chalk-dim shrink-0 text-[10px] uppercase tracking-[0.12em]">
                            {p.position ?? "—"}
                          </span>
                        </>
                      );
                      return (
                        <li key={p.id}>
                          {href ? (
                            <Link
                              to={href}
                              className="group flex items-baseline gap-2 px-3 py-2 text-[12.5px] hover:bg-white/[0.03]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {row}
                            </Link>
                          ) : (
                            <div className="flex items-baseline gap-2 px-3 py-2 text-[12.5px]">
                              {row}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CollapsibleDetailSection>

              {!isSoccer ? (
              <DetailSection title="Team stats">
                {(detail.teamHitting.length > 0 || detail.teamPitching.length > 0) ? (
                  <div className="flex flex-col gap-3">
                    {detail.teamHitting.length > 0 && (
                      <StatGrid
                        title="Hitting"
                        rows={detail.teamHitting}
                        ranks={statRankMap}
                      />
                    )}
                    {detail.teamPitching.length > 0 && (
                      <StatGrid
                        title="Pitching"
                        rows={detail.teamPitching}
                        ranks={statRankMap}
                      />
                    )}
                  </div>
                ) : (
                  <EmptyLine>
                    {detail.source === "mlb"
                      ? "Team stats unavailable."
                      : "Detailed team stats via MLB for Cardinals; other leagues show standings & roster."}
                  </EmptyLine>
                )}
              </DetailSection>
              ) : null}

              {(detail.hittingLeaders.length > 0 || detail.pitchingLeaders.length > 0) && (
                <DetailSection title="Leaders">
                  <div className="flex flex-col gap-4">
                    {detail.hittingLeaders.length > 0 && (
                      <LeaderList title="Hitting" leaders={detail.hittingLeaders} sport="mlb" />
                    )}
                    {detail.pitchingLeaders.length > 0 && (
                      <LeaderList title="Pitching" leaders={detail.pitchingLeaders} sport="mlb" />
                    )}
                  </div>
                </DetailSection>
              )}

              {detail.playerTables.length > 0 && (
                <DetailSection title="Player stats">
                  <div className="flex flex-col gap-4">
                    {detail.playerTables.map((table) => (
                      <PlayerStatTable
                        key={table.name}
                        table={table}
                        sport={detail.source === "mlb" ? "mlb" : "nfl"}
                      />
                    ))}
                  </div>
                </DetailSection>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function CollapsibleDetailSection({
  title,
  children,
  count,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  count?: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-3 flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="inline-flex items-center gap-2">
          <h3 className="rule-head">{title}</h3>
          {count != null && count > 0 ? (
            <span className="text-chalk-dim numeral text-[11px]">({count})</span>
          ) : null}
        </span>
        {open ? (
          <ChevronUp size={16} className="text-chalk-dim shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-chalk-dim shrink-0" />
        )}
      </button>
      {open ? children : null}
    </section>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="rule-head mb-3">{title}</h3>
      {children}
    </section>
  );
}

function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="text-chalk-dim text-[12.5px]">{children}</p>;
}

function PitcherChip({ name, id }: { name?: string | null; id?: number | null }) {
  const label = name ?? "TBD";
  const body = (
    <span className="inline-flex min-w-0 items-center gap-2">
      {id != null ? (
        <img
          src={mlbHeadshot(id, 213)}
          alt=""
          className="h-9 w-9 shrink-0 rounded-full bg-[#0c1a2e] object-cover object-top ring-1 ring-white/15"
        />
      ) : (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.06] text-[9px] text-[#8b93a7]">
          TBD
        </span>
      )}
      <span className="text-cream truncate text-[12.5px] leading-snug">{label}</span>
    </span>
  );
  if (id == null) return body;
  return (
    <Link
      to={`/sports/mlb/player/${id}`}
      onClick={(e) => e.stopPropagation()}
      className="hover:opacity-90"
    >
      {body}
    </Link>
  );
}

function GameList({
  games,
  empty,
  mlbBoxscores,
}: {
  games: ScheduleGame[];
  empty: string;
  mlbBoxscores?: boolean;
}) {
  if (games.length === 0) return <EmptyLine>{empty}</EmptyLine>;
  const upcomingStyle = games.some((g) => g.myPitcher || g.oppPitcher || g.pitchers);
  return (
    <ul className="bg-panel divide-y divide-white/[0.05] rounded border border-white/[0.07]">
      {games.map((g) => {
        const canOpen = mlbBoxscores && /^\d+$/.test(g.id);
        const showMatchup = Boolean(g.myPitcher || g.oppPitcher || g.pitchers);
        const body = (
          <>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {g.opponentTeamId != null && (
                  <TeamMark teamId={g.opponentTeamId} size="sm" />
                )}
                <span className="text-cream text-[14px] font-semibold group-hover:underline">
                  {g.label}
                </span>
                {g.detail ? (
                  <span
                    className={cn(
                      "numeral text-[14px]",
                      g.won === true && "text-turf",
                      g.won === false && "text-alert",
                      g.won == null && "text-chalk",
                    )}
                  >
                    {g.detail}
                  </span>
                ) : null}
                {g.live ? (
                  <span className="text-alert text-[10px] font-semibold uppercase tracking-wide">
                    Live
                  </span>
                ) : null}
              </div>
              {showMatchup && (
                <div className="mt-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#b8c0d2]">
                    Expected pitching
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3">
                    <PitcherChip name={g.myPitcher} id={g.myPitcherId} />
                    <span className="text-[11px] uppercase tracking-[0.14em] text-[#8b93a7]">vs</span>
                    <PitcherChip name={g.oppPitcher} id={g.oppPitcherId} />
                  </div>
                </div>
              )}
            </div>
            <span className="text-chalk-dim shrink-0 text-[11px]">
              {g.when ?? g.status}
              {canOpen ? " · Box" : ""}
            </span>
          </>
        );
        return (
          <li key={g.id}>
            {canOpen ? (
              <Link
                to={`/sports/mlb/game/${g.id}`}
                className={cn(
                  "group flex flex-wrap items-start justify-between gap-2 px-3 text-[12.5px] hover:bg-white/[0.03]",
                  upcomingStyle && showMatchup ? "py-3" : "items-baseline py-2.5",
                )}
                onClick={(e) => e.stopPropagation()}
              >
                {body}
              </Link>
            ) : (
              <div
                className={cn(
                  "flex flex-wrap items-start justify-between gap-2 px-3 text-[12.5px]",
                  upcomingStyle && showMatchup ? "py-3" : "items-baseline py-2.5",
                )}
              >
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function StatGrid({
  title,
  rows,
  ranks,
}: {
  title: string;
  rows: { label: string; value: string }[];
  ranks?: Record<string, { rank: number; of: number }>;
}) {
  return (
    <div>
      <p className="text-chalk-dim mb-2 text-[10.5px] uppercase tracking-[0.14em]">{title}</p>
      <dl className="grid grid-cols-3 gap-2">
        {rows.map((s) => {
          const rank = ranks?.[s.label];
          return (
            <div key={s.label} className="bg-panel rounded border border-white/[0.07] px-2.5 py-2">
              <dt className="text-chalk-dim text-[10px] uppercase tracking-[0.12em]">{s.label}</dt>
              <dd className="numeral text-cream mt-0.5 text-[18px]">{s.value}</dd>
              {rank ? (
                <p className="text-chalk-dim mt-0.5 text-[10px]">
                  {`${rank.rank}${ordinalSuffixLocal(rank.rank)}`} in MLB
                </p>
              ) : null}
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function LeaderList({
  title,
  leaders,
  sport = "mlb",
}: {
  title: string;
  leaders: { id?: string; name: string; line: string }[];
  sport?: "mlb" | "nfl";
}) {
  return (
    <div>
      <p className="text-chalk-dim mb-2 text-[10.5px] uppercase tracking-[0.14em]">{title}</p>
      <ul className="flex flex-col gap-2">
        {leaders.map((l) => {
          const href =
            l.id && sport === "mlb"
              ? `/sports/mlb/player/${l.id}`
              : l.id && sport === "nfl"
                ? `/sports/nfl/player/${l.id}`
                : null;
          const body = (
            <span className="flex items-center gap-2.5">
              {l.id && sport === "mlb" ? (
                <img
                  src={mlbHeadshot(Number(l.id), 213)}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-full bg-[#0c1a2e] object-cover object-top ring-1 ring-white/15"
                  loading="lazy"
                />
              ) : null}
              <span className="min-w-0">
                <p className="text-cream text-[13px] group-hover:underline">{l.name}</p>
                <p className="text-chalk-dim numeral mt-0.5 text-[11.5px]">{l.line}</p>
              </span>
            </span>
          );
          return (
            <li
              key={`${title}-${l.id ?? l.name}-${l.line}`}
              className="border-b border-white/[0.05] pb-2 last:border-0"
            >
              {href ? (
                <Link to={href} className="group block" onClick={(e) => e.stopPropagation()}>
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PlayerStatTable({
  table,
  sport,
}: {
  table: { name: string; labels: string[]; rows: { id: string; name: string; stats: string[] }[] };
  sport: "mlb" | "nfl";
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-white/[0.08]">
      <div className="border-b border-white/[0.06] px-3 py-2">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#e8e4d9]">
          {table.name}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[360px] text-left text-[12px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
              <th className="px-3 py-2 font-medium">Player</th>
              {table.labels.map((lab) => (
                <th key={lab} className="numeral px-2 py-2 text-right font-medium">
                  {lab}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={`${table.name}-${row.id}`} className="border-t border-white/[0.05]">
                <td className="px-3 py-1.5">
                  <Link
                    to={
                      sport === "mlb"
                        ? `/sports/mlb/player/${row.id}`
                        : `/sports/nfl/player/${row.id}`
                    }
                    className="text-cream inline-flex items-center gap-2 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {sport === "mlb" ? (
                      <img
                        src={mlbHeadshot(Number(row.id), 213)}
                        alt=""
                        className="h-7 w-7 rounded-full object-cover object-top"
                        loading="lazy"
                      />
                    ) : null}
                    {row.name}
                  </Link>
                </td>
                {row.stats.map((val, i) => (
                  <td
                    key={`${row.id}-${table.labels[i] ?? i}`}
                    className="numeral px-2 py-1.5 text-right text-white/90"
                  >
                    {val}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatOdds(raw: string | null): string {
  if (!raw) return "—";
  const n = pctNumber(raw);
  if (n != null) return `${Number.isInteger(n) ? n : n.toFixed(1)}%`;
  return raw.includes("%") ? raw : `${raw}%`;
}

function pctNumber(raw: string | null): number | null {
  if (!raw) return null;
  const n = parseFloat(raw.replace("%", "").trim());
  return Number.isFinite(n) ? n : null;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Couldn’t load";
}

function SkeletonCard({ wide }: { wide?: boolean }) {
  return (
    <div
      className={cn(
        "bg-panel h-[180px] animate-pulse rounded border border-white/[0.06]",
        wide && "sm:col-span-2",
      )}
    />
  );
}

function ErrorCard({ fav, message }: { fav: SportsFavorite; message: string }) {
  return (
    <article className="bg-panel rounded border border-alert/25 p-4">
      <h3 className="font-display text-cream text-[18px]">{fav.shortName}</h3>
      <p className="text-alert mt-2 text-[12px]">{message}</p>
    </article>
  );
}
