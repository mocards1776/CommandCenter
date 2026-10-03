import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
import { SportsPushBanner, SportsPushSettings } from "@/components/sports/SportsPushAlerts";
import HeroGameCard from "@/components/sports/HeroGameCard";
import SportsSlateSections from "@/components/sports/SportsSlateSections";
import {
  MlbTeamLeadersSection,
  MlbTeamOrgSummary,
  MlbTeamPayrollTable,
  MlbTeamRecordSplitsSection,
  MlbTeamWinTrend,
} from "@/components/sports/MlbTeamExtras";
import LogoPlate from "@/components/sports/LogoPlate";
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
import {
  BOARD_TIER,
  isoDayOffset,
  rankBoardFavorites,
  teamBoardTier,
  tourBoardTier,
  type BoardTier,
} from "@/lib/sports-board";
import { cn } from "@/lib/utils";
import { boardFavoriteTeamKeys } from "@/lib/board-top-games";
import { fetchChampionshipPromotionOdds } from "@/lib/soccer";
import { fetchYesterdayRecap, type YesterdayRecap } from "@/lib/yesterday-recap";

const CARDINALS_MLB_ID = 138;

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
            {typeof snap.status === "string" && snap.status ? (
              <p className="text-chalk mt-1 text-[12px]">{snap.status}</p>
            ) : null}
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
                        <span className="inline-flex max-w-[12rem] items-center gap-1 sm:max-w-[16rem]">
                          <Link
                            to={`/sports/golf/player/${l.id}`}
                            className="text-cream truncate text-[13px] hover:underline"
                          >
                            {l.shortName ?? l.name}
                          </Link>
                          {l.fedexCupRank != null && l.fedexCupRank > 0 ? (
                            <span className="numeral shrink-0 text-[10px] font-medium text-[#d4a574]/90">
                              {l.fedexCupRank}
                            </span>
                          ) : null}
                        </span>
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

        <SportsPushSettings layout={layout} />

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

function cfbEspnTeamId(fav: SportsFavorite): string | null {
  const m = /football\/college-football\/teams\/(\d+)/i.exec(fav.espnPath);
  return m?.[1] ?? (/^cfb-(\d+)$/.exec(fav.key)?.[1] ?? null);
}

export default function SportsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [layout, setLayout] = useState<SportsLayout>(() => loadSportsLayout());
  const [customizing, setCustomizing] = useState(false);
  const [homeMode, setHomeMode] = useState<"board" | "yesterday">("board");
  const [searchParams] = useSearchParams();
  const initialTeam = searchParams.get("team");
  const [selectedKey, setSelectedKey] = useState<string | null>(() => {
    if (!initialTeam) return null;
    // CFB schools use the dedicated team page — never open the board drawer.
    if (/^cfb-\d+$/.test(initialTeam)) return null;
    return initialTeam;
  });
  const [golfOpen, setGolfOpen] = useState(false);

  useEffect(() => {
    const team = searchParams.get("team");
    if (team) {
      const cfbId = /^cfb-(\d+)$/.exec(team)?.[1];
      if (cfbId) {
        navigate(`/sports/cfb/team/${cfbId}`, { replace: true });
        return;
      }
      setSelectedKey(team);
    }
    if (searchParams.get("golf") === "1") setGolfOpen(true);
  }, [searchParams, navigate]);

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
  const boardFavoriteKeys = useMemo(() => boardFavoriteTeamKeys(favorites), [favorites]);

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

  const yesterdayRecap = useQuery({
    queryKey: ["sports-yesterday-recap", user?.id, layout.order.join(","), layout.hidden.join(",")],
    queryFn: () => fetchYesterdayRecap({ layout, userId: user?.id }),
    enabled: homeMode === "yesterday",
    staleTime: 120_000,
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
    queryKey: ["sports-hero-game", CARDINALS_MLB_ID],
    queryFn: () => fetchTeamCurrentGame(CARDINALS_MLB_ID),
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

  const tierByKey = new Map<string, BoardTier>();
  teamFavs.forEach((fav, i) => tierByKey.set(fav.key, teamBoardTier(teamQueries[i]?.data)));
  tourFavs.forEach((fav, i) => tierByKey.set(fav.key, tourBoardTier(tourQueries[i]?.data)));
  const boardFavorites = rankBoardFavorites(
    favorites,
    (fav) => tierByKey.get(fav.key) ?? BOARD_TIER.unknown,
  );

  const cardsKey = DEFAULT_FAVORITES.find((f) => f.mlbTeamId === CARDINALS_MLB_ID)?.key;
  const otherTeamLive = teamFavs.some(
    (fav) => fav.key !== cardsKey && tierByKey.get(fav.key) === BOARD_TIER.live,
  );
  const heroGame = cardsHero.data;
  const heroDay = isoDayOffset(heroGame?.officialDate);
  const heroRecent = heroDay != null && heroDay >= -1 && heroDay <= 3;
  const showCardsHero = Boolean(
    heroGame && !selectedKey && (heroGame.live || (heroRecent && !otherTeamLive)),
  );

  return (
    <div className="flex min-h-0 flex-col gap-5 p-4 md:p-7">
      {seed.isError && (
        <p className="text-chalk-dim text-[11.5px]">
          Couldn’t sync favorites to the cloud — using your local board.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["board", "Board"],
            ["yesterday", "Yesterday’s recap"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setHomeMode(id)}
            className={cn(
              "rounded-sm border px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] transition",
              homeMode === id
                ? "border-accent/50 bg-accent/15 text-cream"
                : "border-white/10 text-chalk hover:border-accent/40 hover:text-cream",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {homeMode === "yesterday" ? (
        <YesterdayRecapPanel
          data={yesterdayRecap.data}
          loading={yesterdayRecap.isPending}
          error={yesterdayRecap.isError}
          onRetry={() => void yesterdayRecap.refetch()}
        />
      ) : (
        <>
      {/* Hide board hero while team detail is open — panel covers the right half otherwise.
          Off-season finals and nights another followed club is live drop it too. */}
      <SportsPushBanner layout={layout} />

      {showCardsHero && heroGame && (
        <HeroGameCard
          game={heroGame}
          accent="#be0a14"
          label={
            heroGame.live
              ? "Cardinals · Live"
              : heroGame.final
                ? "Cardinals · Latest"
                : "Cardinals · Next up"
          }
        />
      )}

      <SportsSlateSections favoriteTeamKeys={boardFavoriteKeys} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {boardFavorites.map((fav) => {
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
              onOpen={() => {
                const cfbId = cfbEspnTeamId(fav);
                if (cfbId) {
                  navigate(`/sports/cfb/team/${cfbId}`);
                  return;
                }
                setSelectedKey(fav.key);
              }}
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
            <Link
              to="/sports/nhl?solo=1"
              className="text-chalk hover:text-cream rounded-sm border border-white/10 px-3 py-2 text-[10.5px] uppercase tracking-[0.14em] transition hover:border-accent/40"
            >
              NHL hub
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
        </>
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
