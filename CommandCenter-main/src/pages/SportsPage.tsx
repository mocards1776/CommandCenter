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
import HeroGameCard from "@/components/sports/HeroGameCard";
import { useAuth } from "@/lib/auth-context";
import { fetchTeamCurrentGame, mlbTeamLogo, teamPagePath } from "@/lib/mlb";
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
  type ScheduleGame,
  type SportsFavorite,
  type SportsLayout,
  type TeamDetail,
  type TeamSnapshot,
  type TourSnapshot,
} from "@/lib/sports";
import { cn } from "@/lib/utils";

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
}: {
  snap: TeamSnapshot;
  accent?: string;
  mlbTeamId?: number;
  onOpen: () => void;
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

function TourCard({ snap, accent }: { snap: TourSnapshot; accent?: string }) {
  const bar = accent ? `#${accent}` : "var(--color-accent)";
  return (
    <article className="bg-panel relative overflow-hidden rounded border border-white/[0.07] sm:col-span-2">
      <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: bar }} />
      <div className="p-4 pt-5">
        <div className="rule-head mb-1">PGA Tour</div>
        <h3 className="font-display text-cream text-[22px] leading-tight">
          {snap.eventName ?? "This week’s event"}
        </h3>
        {snap.status && <p className="text-chalk mt-1 text-[12px]">{snap.status}</p>}
        {snap.leaders.length > 0 ? (
          <ol className="mt-4 flex flex-col gap-2">
            {snap.leaders.map((l, i) => (
              <li
                key={`${l.name}-${i}`}
                className="flex items-baseline justify-between gap-3 border-b border-white/[0.05] pb-2 last:border-0"
              >
                <span className="text-cream text-[13px]">
                  <span className="text-chalk-dim numeral mr-2 text-[12px]">{i + 1}</span>
                  {l.name}
                </span>
                <span className="numeral text-accent text-[16px]">{l.score}</span>
              </li>
            ))}
          </ol>
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
        className="bg-field h-full w-full max-w-md overflow-y-auto overscroll-contain border-l border-accent/25 p-6"
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

  useEffect(() => {
    const team = searchParams.get("team");
    if (team) setSelectedKey(team);
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
      <div className="relative overflow-hidden rounded-lg border border-accent/25 bg-gradient-to-br from-hero-lift to-hero p-5 sm:p-7">
        <StarField count={28} seed={19} />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="rule-head mb-2">Sports</div>
            <h2 className="font-display text-cream text-[28px] leading-tight sm:text-[34px]">
              Your <span className="text-accent">board</span>
            </h2>
            <p className="text-chalk mt-2 max-w-lg text-[13px] leading-relaxed">
              Tap a team for standings, schedule, roster, stats, and playoff odds.
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

      {seed.isError && (
        <p className="text-chalk-dim text-[11.5px]">
          Couldn’t sync favorites to the cloud — using your local board.
        </p>
      )}

      {cardsHero.data && (
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
            return <TourCard key={fav.key} snap={q.data} accent={fav.color} />;
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

  const hero = useQuery({
    queryKey: ["team-detail-hero", mlbTeamId],
    queryFn: () => fetchTeamCurrentGame(mlbTeamId!),
    enabled: Boolean(mlbTeamId),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/55" onClick={onClose}>
      <aside
        className="bg-field flex h-full w-full max-w-lg flex-col overflow-hidden border-l border-accent/25"
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
                <span className="numeral text-[24px] leading-none" style={{ color: accent }}>
                  {detail.record}
                </span>
              )}
              {detail.standing && (
                <span className="text-chalk text-[12px]">{detail.standing}</span>
              )}
            </div>
          )}
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
              <DetailSection title="Playoff odds">
                {detail.playoffOdds || detail.wildCardOdds ? (
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
                  <EmptyLine>Playoff odds not available yet.</EmptyLine>
                )}
              </DetailSection>

              <DetailSection title="Standings">
                {detail.division.length === 0 ? (
                  <EmptyLine>No standings available.</EmptyLine>
                ) : (
                  <div className="bg-panel overflow-x-auto rounded border border-white/[0.07]">
                    <table className="w-full min-w-[420px] text-left text-[12px]">
                      <thead className="text-chalk-dim text-[10px] uppercase tracking-[0.12em]">
                        <tr className="border-b border-white/[0.06]">
                          <th className="px-3 py-2 font-medium">Team</th>
                          <th className="px-2 py-2 font-medium">Rec</th>
                          <th className="px-2 py-2 font-medium">Pct</th>
                          <th className="px-2 py-2 font-medium">GB</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.division.map((row) => (
                          <tr
                            key={`${row.rank}-${row.team}`}
                            className={cn(
                              "border-t border-white/[0.04]",
                              row.isMe && "bg-white/[0.04]",
                            )}
                          >
                            <td className={cn("px-3 py-2", row.isMe ? "text-cream font-medium" : "text-chalk")}>
                              <span className="inline-flex items-center gap-2">
                                <span className="text-chalk-dim numeral w-3">{row.rank}</span>
                                {detail.source === "mlb" && row.teamId ? (
                                  <img
                                    src={mlbTeamLogo(row.teamId)}
                                    alt=""
                                    className="h-5 w-5 object-contain"
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
                            <td className="numeral text-cream px-2 py-2">{row.record}</td>
                            <td className="numeral text-chalk px-2 py-2">{row.pct || "—"}</td>
                            <td className="numeral text-chalk px-2 py-2">{row.gb}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </DetailSection>

              <DetailSection title="Upcoming">
                <GameList
                  games={detail.upcoming}
                  empty="No upcoming games."
                  mlbBoxscores={detail.source === "mlb"}
                />
              </DetailSection>

              <DetailSection title="Recent">
                <GameList
                  games={detail.recent}
                  empty="No recent games."
                  mlbBoxscores={detail.source === "mlb"}
                />
              </DetailSection>

              <DetailSection title="Roster">
                {detail.roster.length === 0 ? (
                  <EmptyLine>Roster unavailable.</EmptyLine>
                ) : (
                  <ul className="bg-panel divide-y divide-white/[0.05] rounded border border-white/[0.07]">
                    {detail.roster.map((p) => {
                      const mlbClickable =
                        detail.source === "mlb" && /^\d+$/.test(String(p.id));
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
                          {mlbClickable ? (
                            <Link
                              to={`/sports/mlb/player/${p.id}`}
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
              </DetailSection>

              <DetailSection title="Team stats">
                {(detail.teamHitting.length > 0 || detail.teamPitching.length > 0) ? (
                  <div className="flex flex-col gap-3">
                    {detail.teamHitting.length > 0 && (
                      <StatGrid title="Hitting" rows={detail.teamHitting} accent={accent} />
                    )}
                    {detail.teamPitching.length > 0 && (
                      <StatGrid title="Pitching" rows={detail.teamPitching} accent={accent} />
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

              {(detail.hittingLeaders.length > 0 || detail.pitchingLeaders.length > 0) && (
                <DetailSection title="Leaders">
                  <div className="flex flex-col gap-4">
                    {detail.hittingLeaders.length > 0 && (
                      <LeaderList title="Hitting" leaders={detail.hittingLeaders} />
                    )}
                    {detail.pitchingLeaders.length > 0 && (
                      <LeaderList title="Pitching" leaders={detail.pitchingLeaders} />
                    )}
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
              <div className="flex flex-wrap items-baseline gap-x-2">
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
                <div className="mt-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">
                    Expected pitching
                  </p>
                  <p className="text-cream mt-0.5 text-[12.5px] leading-snug">
                    {g.myPitcher || g.oppPitcher ? (
                      <>
                        <span>{g.myPitcher ?? "TBD"}</span>
                        <span className="mx-1.5 text-[#8b93a7]">vs</span>
                        <span>{g.oppPitcher ?? "TBD"}</span>
                      </>
                    ) : (
                      g.pitchers
                    )}
                  </p>
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
  accent,
}: {
  title: string;
  rows: { label: string; value: string }[];
  accent: string;
}) {
  return (
    <div>
      <p className="text-chalk-dim mb-2 text-[10.5px] uppercase tracking-[0.14em]">{title}</p>
      <dl className="grid grid-cols-3 gap-2">
        {rows.map((s) => (
          <div key={s.label} className="bg-panel rounded border border-white/[0.07] px-2.5 py-2">
            <dt className="text-chalk-dim text-[10px] uppercase tracking-[0.12em]">{s.label}</dt>
            <dd className="numeral text-cream mt-0.5 text-[18px]">{s.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function LeaderList({
  title,
  leaders,
}: {
  title: string;
  leaders: { id?: string; name: string; line: string }[];
}) {
  return (
    <div>
      <p className="text-chalk-dim mb-2 text-[10.5px] uppercase tracking-[0.14em]">{title}</p>
      <ul className="flex flex-col gap-2">
        {leaders.map((l) => {
          const body = (
            <>
              <p className="text-cream text-[13px] group-hover:underline">{l.name}</p>
              <p className="text-chalk-dim numeral mt-0.5 text-[11.5px]">{l.line}</p>
            </>
          );
          return (
            <li
              key={`${title}-${l.id ?? l.name}-${l.line}`}
              className="border-b border-white/[0.05] pb-2 last:border-0"
            >
              {l.id ? (
                <Link
                  to={`/sports/mlb/player/${l.id}`}
                  className="group block"
                  onClick={(e) => e.stopPropagation()}
                >
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
