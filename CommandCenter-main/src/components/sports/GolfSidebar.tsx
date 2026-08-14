import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Settings2, Star, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listFavoritePlayers } from "@/lib/favorite-players";
import { DEFAULT_FAVORITES, fetchTourSnapshot, type TourLeader } from "@/lib/sports";
import { cn } from "@/lib/utils";

function LeaderTable({
  rows,
  favIds,
  favoritesOnly,
}: {
  rows: TourLeader[];
  favIds: Set<string>;
  favoritesOnly?: boolean;
}) {
  const navigate = useNavigate();
  const filtered = favoritesOnly ? rows.filter((r) => r.id && favIds.has(r.id)) : rows;
  if (filtered.length === 0) {
    return (
      <p className="text-chalk-dim px-1 py-6 text-center text-[12px]">
        {favoritesOnly ? "Star golfers on their profile to pin them here." : "No leaderboard right now."}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[320px] text-left">
        <thead>
          <tr className="border-b border-white/20 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
            <th className="py-2 pr-2 font-medium">Pos</th>
            <th className="py-2 pr-2 font-medium">Player</th>
            <th className="py-2 pr-2 text-right font-medium">Tot</th>
            <th className="py-2 pr-2 text-right font-medium">Thru</th>
            <th className="py-2 text-right font-medium">R1</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((l, i) => {
            const watched = l.id != null && favIds.has(l.id);
            const name = l.shortName ?? l.name;
            return (
              <tr
                key={`${l.id ?? l.name}-${i}`}
                className={cn(
                  "border-b border-white/[0.08]",
                  watched && "bg-[#4ea1ff]/5",
                  l.id && "cursor-pointer hover:bg-white/[0.04]",
                )}
                onClick={() => {
                  if (l.id) navigate(`/sports/golf/player/${l.id}`);
                }}
              >
                <td className="numeral py-3 pr-2 text-[12px] text-white/45">{l.position ?? i + 1}</td>
                <td className="py-3 pr-2">
                  <span className="inline-flex max-w-[11rem] items-center gap-1.5">
                    {watched && <Star size={12} className="shrink-0 fill-[#4ea1ff] text-[#4ea1ff]" />}
                    <span className="truncate text-[13px] font-medium text-white">{name}</span>
                  </span>
                </td>
                <td className="numeral py-3 pr-2 text-right text-[14px] font-semibold text-[#ff6b6b]">
                  {l.score}
                </td>
                <td className="numeral py-3 pr-2 text-right text-[12px] text-white/70">{l.thru ?? "—"}</td>
                <td className="numeral py-3 text-right text-[12px] text-white/70">{l.r1 ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function GolfSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [mode, setMode] = useState<"favorites" | "field">("favorites");
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

  const rows = tour.data?.field ?? tour.data?.leaders ?? [];
  const tz =
    typeof Intl !== "undefined"
      ? new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
          .formatToParts(new Date())
          .find((p) => p.type === "timeZoneName")?.value
      : null;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/55" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-md flex-col overflow-hidden border-l border-white/10 bg-black"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 px-5 pb-3 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-[32px] leading-none text-white">Favorites</h2>
              <p className="mt-1 text-[11px] text-white/45">
                {tour.data?.eventName ?? "PGA Tour"}
                {tour.data?.status ? ` · ${tour.data.status}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {tz && <span className="mr-1 text-[10px] text-white/40">Time in {tz}</span>}
              <button
                type="button"
                onClick={() => void tour.refetch()}
                className="rounded-full border border-white/15 p-2 text-white/70 hover:text-white"
                aria-label="Refresh"
              >
                <RefreshCw size={14} className={tour.isFetching ? "animate-spin" : ""} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/15 p-2 text-white/70 hover:text-white"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setMode("favorites")}
              className={cn(
                "rounded-sm border px-2.5 py-1.5 text-[10px] uppercase tracking-[0.14em]",
                mode === "favorites"
                  ? "border-white/40 bg-white/10 text-white"
                  : "border-white/10 text-white/50",
              )}
            >
              Favorites
            </button>
            <button
              type="button"
              onClick={() => setMode("field")}
              className={cn(
                "rounded-sm border px-2.5 py-1.5 text-[10px] uppercase tracking-[0.14em]",
                mode === "field"
                  ? "border-white/40 bg-white/10 text-white"
                  : "border-white/10 text-white/50",
              )}
            >
              Full field
            </button>
            <Link
              to="/sports?solo=1"
              className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-white/40 hover:text-white/70"
            >
              <Settings2 size={12} /> Board
            </Link>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
          {tour.isPending ? (
            <p className="text-[12px] text-white/50">Loading tournament…</p>
          ) : (
            <LeaderTable
              rows={rows}
              favIds={favGolferIds}
              favoritesOnly={mode === "favorites"}
            />
          )}
        </div>
      </aside>
    </div>
  );
}
