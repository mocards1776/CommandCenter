import { useEffect, useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  RefreshCw,
  Settings2,
  Trophy,
} from "lucide-react";
import toast from "react-hot-toast";
import StarField from "@/components/StarField";
import { useAuth } from "@/lib/auth-context";
import {
  DEFAULT_FAVORITES,
  ensureFavoriteTeamsSeeded,
  fetchTeamSnapshot,
  fetchTourSnapshot,
  loadSportsLayout,
  saveSportsLayout,
  visibleFavorites,
  type GameChip,
  type SportsFavorite,
  type SportsLayout,
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
          )}
        >
          {game.label}
          {game.detail ? ` · ${game.detail}` : ""}
        </span>
        {game.when && (
          <span className="text-chalk-dim mt-0.5 block text-[10.5px]">{game.when}</span>
        )}
      </span>
    </div>
  );
}

function TeamCard({ snap, accent }: { snap: TeamSnapshot; accent?: string }) {
  const bar = accent ? `#${accent}` : "var(--color-accent)";
  return (
    <article className="bg-panel relative overflow-hidden rounded border border-white/[0.07]">
      <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: bar }} />
      <div className="flex items-start gap-3.5 p-4 pt-5">
        {snap.logo ? (
          <img
            src={snap.logo}
            alt=""
            className="h-14 w-14 shrink-0 object-contain"
          />
        ) : (
          <div className="bg-field grid h-14 w-14 shrink-0 place-items-center rounded-sm">
            <Trophy size={18} className="text-chalk-dim" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-cream text-[20px] leading-tight">{snap.shortName}</h3>
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
      </div>
      <div className="border-t border-white/[0.06] px-4 py-3 flex flex-col gap-2">
        <GameLine label="Last" game={snap.lastGame} />
        <GameLine label="Next" game={snap.nextGame} />
      </div>
    </article>
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
              Favorites up front — records, last result, next tip. Customize the order
              anytime.
            </p>
          </div>
          <div className="flex items-center gap-2">
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
              className="from-accent-deep to-accent-dark text-cream flex items-center gap-2 rounded-sm bg-gradient-to-b px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.14em]"
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
    </div>
  );
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
