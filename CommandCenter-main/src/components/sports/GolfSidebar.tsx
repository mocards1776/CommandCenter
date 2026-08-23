import { useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Star, X } from "lucide-react";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import { useAuth } from "@/lib/auth-context";
import { listFavoritePlayers } from "@/lib/favorite-players";
import { DEFAULT_FAVORITES, fetchTourSnapshot, type TourLeader } from "@/lib/sports";
import { cn } from "@/lib/utils";

function todayTone(today: string | null): string {
  if (!today || today === "—" || today === "E") return "text-white/80";
  if (today.startsWith("-")) return "text-[#4ade80]";
  if (today.startsWith("+")) return "text-[#f87171]";
  return "text-white/80";
}

function LeaderTable({
  rows,
  favIds,
  highlightFavs,
}: {
  rows: TourLeader[];
  favIds: Set<string>;
  highlightFavs?: boolean;
}) {
  const navigate = useNavigate();
  const roundLabel = rows.find((r) => r.latestRoundNum)?.latestRoundNum ?? 1;
  if (rows.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-[12px] text-white/45">No players in this list.</p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[380px] text-left">
        <thead>
          <tr className="border-b border-white/20 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
            <th className="py-2 pr-2 font-medium">Pos</th>
            <th className="py-2 pr-2 font-medium">Player</th>
            <th className="py-2 pr-2 text-right font-medium">Tot</th>
            <th className="py-2 pr-2 text-right font-medium">Today</th>
            <th className="py-2 pr-2 text-right font-medium">Thru</th>
            <th className="py-2 text-right font-medium">R{roundLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l, i) => {
            const watched = l.id != null && favIds.has(l.id);
            const name = l.shortName ?? l.name;
            const roundScore = l.latestRound ?? l.r1;
            return (
              <tr
                key={`${l.id ?? l.name}-${i}`}
                className={cn(
                  "border-b border-white/[0.08]",
                  highlightFavs && watched && "bg-[#4ea1ff]/8",
                  l.id && "cursor-pointer hover:bg-white/[0.04]",
                )}
                onClick={() => {
                  if (l.id) navigate(`/sports/golf/player/${l.id}`);
                }}
              >
                <td className="numeral py-2 pr-2 text-[12px] text-white/55">{l.position ?? i + 1}</td>
                <td className="py-2 pr-2">
                  <span className="inline-flex max-w-[12rem] items-center gap-1.5 sm:max-w-[16rem]">
                    {watched && <Star size={12} className="shrink-0 fill-[#4ea1ff] text-[#4ea1ff]" />}
                    <span className="truncate text-[13px] font-medium text-white">{name}</span>
                    {l.fedexCupRank != null && l.fedexCupRank > 0 ? (
                      <span className="numeral ml-0.5 shrink-0 text-[10px] font-medium text-[#d4a574]/90">
                        {l.fedexCupRank}
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="numeral py-2 pr-2 text-right text-[15px] font-semibold text-white">
                  {l.score}
                </td>
                <td
                  className={cn(
                    "numeral py-2 pr-2 text-right text-[15px] font-bold tabular-nums",
                    todayTone(l.today),
                  )}
                >
                  {l.today ?? "—"}
                </td>
                <td className="numeral py-2 pr-2 text-right text-[12px] text-white/65">{l.thru ?? "—"}</td>
                <td className="numeral py-2 text-right text-[12px] text-white/55">{roundScore ?? "—"}</td>
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
  const pga = DEFAULT_FAVORITES.find((f) => f.key === "pga-tour")!;
  const swipeRef = useSwipeBack(onClose, open);

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

  const field = tour.data?.field ?? tour.data?.leaders ?? [];
  const favRows = useMemo(
    () => field.filter((r) => r.id != null && favGolferIds.has(r.id)),
    [field, favGolferIds],
  );

  // History stack so iPad edge-swipe / browser back closes the panel.
  useEffect(() => {
    if (!open) return;
    const st = (history.state as { sportsGolf?: boolean } | null) ?? {};
    if (!st.sportsGolf) {
      history.pushState({ ...st, sportsGolf: true }, "", window.location.href);
    }
    const onPop = (e: PopStateEvent) => {
      const next = (e.state as { sportsGolf?: boolean } | null) ?? {};
      if (!next.sportsGolf) onClose();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [open, onClose]);

  const handleClose = () => {
    const st = (history.state as { sportsGolf?: boolean } | null) ?? {};
    if (st.sportsGolf) history.back();
    else onClose();
  };

  const tz =
    typeof Intl !== "undefined"
      ? new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
          .formatToParts(new Date())
          .find((p) => p.type === "timeZoneName")?.value
      : null;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/55" onClick={handleClose}>
      <aside
        ref={swipeRef}
        className="flex h-full w-full max-w-full flex-col overflow-hidden border-l border-white/10 bg-black"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 px-5 pb-3 pt-4 sm:px-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-[32px] leading-none text-white sm:text-[36px]">
                Golf
              </h2>
              <p className="mt-1 text-[11px] text-white/45">
                {tour.data?.eventName ?? "PGA Tour"}
                {tour.data?.status ? ` · ${tour.data.status}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {tz && <span className="mr-1 hidden text-[10px] text-white/40 sm:inline">Time in {tz}</span>}
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
                onClick={handleClose}
                className="rounded-full border border-white/15 p-2 text-white/70 hover:text-white"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8 sm:px-7">
          {tour.isPending ? (
            <p className="text-[12px] text-white/50">Loading tournament…</p>
          ) : (
            <div className="space-y-5">
              <section>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
                    Favorites
                  </h3>
                  <Link
                    to="/sports?solo=1"
                    className="text-[10px] uppercase tracking-[0.14em] text-white/35 hover:text-white/60"
                  >
                    Board
                  </Link>
                </div>
                {favRows.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-white/15 px-3 py-3 text-[12px] text-white/45">
                    Star golfers on their profile — they’ll pin here above the field.
                  </p>
                ) : (
                  <LeaderTable rows={favRows} favIds={favGolferIds} highlightFavs />
                )}
              </section>

              <section>
                <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
                  Leaderboard
                </h3>
                <LeaderTable rows={field} favIds={favGolferIds} highlightFavs />
              </section>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
