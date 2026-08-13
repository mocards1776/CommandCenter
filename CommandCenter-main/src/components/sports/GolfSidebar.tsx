import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Star, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listFavoritePlayers } from "@/lib/favorite-players";
import { DEFAULT_FAVORITES, fetchTourSnapshot, type TourLeader } from "@/lib/sports";
import { cn } from "@/lib/utils";

export default function GolfSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const pga = DEFAULT_FAVORITES.find((f) => f.key === "pga-tour")!;

  const tour = useQuery({
    queryKey: ["golf-sidebar-tour", pga.key],
    queryFn: () => fetchTourSnapshot(pga),
    enabled: open,
    staleTime: 60_000,
    refetchInterval: open ? 60_000 : false,
  });

  const favorites = useQuery({
    queryKey: ["favorite-players", user?.id],
    queryFn: () => listFavoritePlayers(user!.id),
    enabled: Boolean(user?.id && open),
    staleTime: 60_000,
  });

  const favGolferIds = useMemo(() => {
    const set = new Set<string>();
    for (const f of favorites.data ?? []) {
      if ((f.sport ?? "").toLowerCase() === "golf") set.add(String(f.playerId));
    }
    return set;
  }, [favorites.data]);

  const rows: TourLeader[] = expanded
    ? tour.data?.field ?? tour.data?.leaders ?? []
    : tour.data?.leaders ?? [];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/55" onClick={onClose}>
      <aside
        className="bg-field flex h-full w-full max-w-md flex-col overflow-hidden border-l border-emerald-700/40"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 border-b border-white/[0.07] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="rule-head mb-1">Golf</p>
              <h2 className="font-display text-cream text-[26px] leading-tight">
                {tour.data?.eventName ?? "PGA Tour"}
              </h2>
              {tour.data?.status && (
                <p className="text-chalk-dim mt-1 text-[11px] uppercase tracking-[0.14em]">
                  {tour.data.status}
                </p>
              )}
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
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {favGolferIds.size > 0 && (
            <section className="mb-5">
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200/70">
                Your golfers
              </h3>
              <ul className="space-y-1.5">
                {(favorites.data ?? [])
                  .filter((f) => (f.sport ?? "").toLowerCase() === "golf")
                  .map((f) => (
                    <li key={f.id}>
                      <Link
                        to={`/sports/golf/player/${f.playerId}`}
                        className="text-cream hover:border-accent/40 flex items-center gap-2 rounded-md border border-white/[0.06] px-3 py-2 text-[13px] transition"
                      >
                        <Star size={12} className="fill-accent text-accent" />
                        {f.playerName}
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          )}

          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
              Leaderboard
            </h3>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-chalk hover:text-cream inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em]"
            >
              {expanded ? (
                <>
                  Collapse <ChevronDown size={12} />
                </>
              ) : (
                <>
                  Expand field <ChevronRight size={12} />
                </>
              )}
            </button>
          </div>

          {tour.isPending ? (
            <p className="text-chalk-dim text-[12px]">Loading tournament…</p>
          ) : rows.length === 0 ? (
            <p className="text-chalk-dim text-[12px]">No leaderboard right now.</p>
          ) : (
            <ol className="space-y-1">
              {rows.map((l, i) => {
                const watched = l.id != null && favGolferIds.has(l.id);
                const inner = (
                  <>
                    <span className="numeral text-chalk-dim w-6 shrink-0 text-[12px]">
                      {l.position ?? i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-cream">
                      {l.name}
                      {watched ? (
                        <Star size={11} className="ml-1 inline fill-accent text-accent" />
                      ) : null}
                    </span>
                    <span className="numeral text-accent shrink-0 text-[15px]">{l.score}</span>
                  </>
                );
                return (
                  <li key={`${l.id ?? l.name}-${i}`}>
                    {l.id ? (
                      <Link
                        to={`/sports/golf/player/${l.id}`}
                        className={cn(
                          "flex items-center gap-2 rounded-md border border-transparent px-2 py-2 transition hover:border-white/10 hover:bg-white/[0.03]",
                          watched && "border-accent/25 bg-accent/5",
                        )}
                      >
                        {inner}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-2 px-2 py-2">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </aside>
    </div>
  );
}
