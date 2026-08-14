import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Loader2, Radio, RefreshCw, Settings2 } from "lucide-react";
import toast from "react-hot-toast";
import LiveSituationStrip from "@/components/sports/LiveSituationStrip";
import NflFieldMap from "@/components/sports/NflFieldMap";
import StarField from "@/components/StarField";
import TeamMark from "@/components/sports/TeamMark";
import { useAuth } from "@/lib/auth-context";
import { listFavoritePlayers } from "@/lib/favorite-players";
import {
  chicagoToday,
  fetchMlbScoreboard,
  fetchMlbStandings,
  fetchPitcherSeasonLines,
  mlbHeadshot,
  type MlbPitcherSeasonLine,
  type MlbScoreGame,
  type MlbScoredGame,
} from "@/lib/mlb";
import { fetchNflScoreboard, chicagoTodayNfl, NFL_TEAMS, type NflScoredGame } from "@/lib/nfl";
import {
  loadNflTeamInterest,
  loadTeamInterest,
  rankRuwtGames,
  rankRuwtNflGames,
  setNflTeamInterestRating,
  setTeamInterestRating,
  type RuwtTeamInterest,
} from "@/lib/ruwt";
import { fetchTaggedPlayerIds } from "@/lib/sports-player-tags";
import { markSportsSolo } from "@/lib/sports-home";
import { cn } from "@/lib/utils";

function ordinalPlace(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

type RuwtSportFilter = "all" | "mlb" | "nfl";

type UnifiedRuwtItem =
  | { sport: "mlb"; score: number; id: string; game: MlbScoredGame }
  | { sport: "nfl"; score: number; id: string; game: NflScoredGame };

const MLB_TEAMS: { id: number; name: string; abbrev: string }[] = [
  { id: 108, name: "Angels", abbrev: "LAA" },
  { id: 109, name: "D-backs", abbrev: "AZ" },
  { id: 110, name: "Orioles", abbrev: "BAL" },
  { id: 111, name: "Red Sox", abbrev: "BOS" },
  { id: 112, name: "Cubs", abbrev: "CHC" },
  { id: 113, name: "Reds", abbrev: "CIN" },
  { id: 114, name: "Guardians", abbrev: "CLE" },
  { id: 115, name: "Rockies", abbrev: "COL" },
  { id: 116, name: "Tigers", abbrev: "DET" },
  { id: 117, name: "Astros", abbrev: "HOU" },
  { id: 118, name: "Royals", abbrev: "KC" },
  { id: 119, name: "Dodgers", abbrev: "LAD" },
  { id: 120, name: "Nationals", abbrev: "WSH" },
  { id: 121, name: "Mets", abbrev: "NYM" },
  { id: 133, name: "Athletics", abbrev: "ATH" },
  { id: 134, name: "Pirates", abbrev: "PIT" },
  { id: 135, name: "Padres", abbrev: "SD" },
  { id: 136, name: "Mariners", abbrev: "SEA" },
  { id: 137, name: "Giants", abbrev: "SF" },
  { id: 138, name: "Cardinals", abbrev: "STL" },
  { id: 139, name: "Rays", abbrev: "TB" },
  { id: 140, name: "Rangers", abbrev: "TEX" },
  { id: 141, name: "Blue Jays", abbrev: "TOR" },
  { id: 142, name: "Twins", abbrev: "MIN" },
  { id: 143, name: "Phillies", abbrev: "PHI" },
  { id: 144, name: "Braves", abbrev: "ATL" },
  { id: 145, name: "White Sox", abbrev: "CWS" },
  { id: 146, name: "Marlins", abbrev: "MIA" },
  { id: 147, name: "Yankees", abbrev: "NYY" },
  { id: 158, name: "Brewers", abbrev: "MIL" },
];

export default function RuwtPage() {
  const { user } = useAuth();
  const [interest, setInterest] = useState<RuwtTeamInterest>(() => loadTeamInterest());
  const [nflInterest, setNflInterest] = useState<RuwtTeamInterest>(() => loadNflTeamInterest());
  const [editing, setEditing] = useState(false);
  const [showFinals, setShowFinals] = useState(false);
  const [sportFilter, setSportFilter] = useState<RuwtSportFilter>("all");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("solo") === "1") markSportsSolo();
  }, []);

  const scoreboard = useQuery({
    queryKey: ["mlb-scoreboard", "today", chicagoToday()],
    queryFn: () => fetchMlbScoreboard(chicagoToday()),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const nflBoard = useQuery({
    queryKey: ["nfl-scoreboard", "today", chicagoTodayNfl()],
    queryFn: async () => {
      const today = chicagoTodayNfl();
      // ESPN week boards mix days — pin to Chicago today.
      const ymd = today.replace(/-/g, "");
      const board = await fetchNflScoreboard(ymd).catch(() => fetchNflScoreboard());
      return board.filter((g) => !g.date || g.date === today);
    },
    refetchInterval: 20_000,
    staleTime: 10_000,
  });

  const standings = useQuery({
    queryKey: ["mlb-standings"],
    queryFn: () => fetchMlbStandings(),
    staleTime: 120_000,
  });

  const favorites = useQuery({
    queryKey: ["favorite-players", user?.id],
    queryFn: () => listFavoritePlayers(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  const taggedIds = useQuery({
    queryKey: ["sports-player-tags-ids", user?.id],
    queryFn: () => fetchTaggedPlayerIds(),
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  const playoffOddsByTeam = useMemo(() => {
    const out: Record<number, number> = {};
    for (const div of standings.data ?? []) {
      for (const row of div.rows) {
        if (!row.playoffPercent) continue;
        const n = parseFloat(row.playoffPercent.replace("%", ""));
        if (Number.isFinite(n)) out[row.teamId] = n;
      }
    }
    return out;
  }, [standings.data]);

  const divisionPlaceByTeam = useMemo(() => {
    const out: Record<number, string> = {};
    for (const div of standings.data ?? []) {
      const divName = div.shortName || div.name || "division";
      for (const row of div.rows) {
        const n = Number.parseInt(String(row.rank), 10);
        const place = Number.isFinite(n) && n > 0 ? `${ordinalPlace(n)} in ${divName}` : divName;
        out[row.teamId] = place;
      }
    }
    return out;
  }, [standings.data]);

  const watchPlayerIds = useMemo(() => {
    const set = new Set<number>();
    for (const f of favorites.data ?? []) {
      if (f.position === "manager") continue;
      if (f.sport && f.sport !== "baseball") continue;
      const id = Number(f.playerId);
      if (Number.isFinite(id)) set.add(id);
    }
    for (const id of taggedIds.data ?? []) set.add(id);
    return set;
  }, [favorites.data, taggedIds.data]);

  const watchPlayerNames = useMemo(() => {
    const map = new Map<number, string>();
    for (const f of favorites.data ?? []) {
      if (f.position === "manager") continue;
      if (f.sport && f.sport !== "baseball") continue;
      const id = Number(f.playerId);
      if (!Number.isFinite(id)) continue;
      const parts = f.playerName.trim().split(/\s+/);
      map.set(id, parts[parts.length - 1] || f.playerName);
    }
    return map;
  }, [favorites.data]);

  const watchManagerIds = useMemo(() => {
    const set = new Set<number>();
    for (const f of favorites.data ?? []) {
      if (f.position !== "manager") continue;
      const id = Number(f.playerId);
      if (Number.isFinite(id)) set.add(id);
    }
    return set;
  }, [favorites.data]);

  const managerTeamById = useMemo(() => {
    const map = new Map<number, number>();
    for (const f of favorites.data ?? []) {
      if (f.position !== "manager") continue;
      const mid = Number(f.playerId);
      const tid = f.teamId != null ? Number(f.teamId) : NaN;
      if (Number.isFinite(mid) && Number.isFinite(tid)) map.set(mid, tid);
    }
    return map;
  }, [favorites.data]);

  const ranked = useMemo(() => {
    if (!scoreboard.data) return [] as MlbScoredGame[];
    return rankRuwtGames(
      scoreboard.data,
      {
        teamInterest: interest,
        watchPlayerIds,
        watchPlayerNames,
        watchManagerIds,
        managerTeamById,
        playoffOddsByTeam,
      },
      30,
    );
  }, [
    scoreboard.data,
    interest,
    watchPlayerIds,
    watchPlayerNames,
    watchManagerIds,
    managerTeamById,
    playoffOddsByTeam,
  ]);

  const nflRanked = useMemo(() => {
    if (!nflBoard.data) return [] as NflScoredGame[];
    return rankRuwtNflGames(nflBoard.data, nflInterest, 24);
  }, [nflBoard.data, nflInterest]);

  const unified = useMemo((): UnifiedRuwtItem[] => {
    const mlbItems: UnifiedRuwtItem[] = ranked.map((g) => ({
      sport: "mlb",
      score: g.score,
      id: `mlb-${g.id}`,
      game: g,
    }));
    const nflItems: UnifiedRuwtItem[] = nflRanked.map((g) => ({
      sport: "nfl",
      score: g.score,
      id: `nfl-${g.id}`,
      game: g,
    }));
    return [...mlbItems, ...nflItems].sort(
      (a, b) => b.score - a.score || a.id.localeCompare(b.id),
    );
  }, [ranked, nflRanked]);

  const filtered = useMemo(() => {
    if (sportFilter === "all") return unified;
    return unified.filter((g) => g.sport === sportFilter);
  }, [unified, sportFilter]);

  const activeGames = useMemo(() => filtered.filter((g) => !g.game.final), [filtered]);
  const finalGames = useMemo(() => filtered.filter((g) => g.game.final), [filtered]);

  const refresh = () => {
    void Promise.all([scoreboard.refetch(), standings.refetch(), nflBoard.refetch()]).then(() =>
      toast.success("RUWT updated"),
    );
  };

  return (
    <div className="flex min-h-0 flex-col gap-5 p-4 md:p-7">
      <div className="relative overflow-hidden rounded-lg border border-accent/25 bg-gradient-to-br from-hero-lift to-hero p-5 sm:p-7">
        <StarField count={28} seed={17} />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="rule-head mb-2 inline-flex items-center gap-2">
              <Radio size={14} className="text-accent" />
              Are You Watching This
            </div>
            <h2 className="font-display text-cream text-[28px] leading-tight sm:text-[34px]">
              Best games <span className="text-accent">right now</span>
            </h2>
            <p className="text-chalk mt-2 max-w-xl text-[13px] leading-relaxed">
              Today&apos;s MLB and NFL games, ranked by drama, your team interest, favorites, and
              stakes — so you know what to turn on.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="text-chalk hover:text-cream flex items-center gap-2 rounded-sm border border-white/10 px-3 py-2 text-[10.5px] uppercase tracking-[0.14em] transition hover:border-accent/40"
            >
              <Settings2 size={13} />
              {editing ? "Done" : "Rank teams"}
            </button>
            <button
              type="button"
              onClick={refresh}
              disabled={scoreboard.isFetching || nflBoard.isFetching}
              className="text-chalk hover:text-cream flex items-center gap-2 rounded-sm border border-white/10 px-3 py-2 text-[10.5px] uppercase tracking-[0.14em] transition hover:border-accent/40 disabled:opacity-40"
            >
              <RefreshCw
                size={13}
                className={scoreboard.isFetching || nflBoard.isFetching ? "animate-spin" : ""}
              />
              Refresh
            </button>
            <Link
              to="/sports/nfl?solo=1"
              className="text-chalk hover:text-cream rounded-sm border border-white/10 px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.14em]"
            >
              NFL board
            </Link>
            <Link
              to="/sports/mlb?solo=1"
              className="from-accent-deep to-accent-dark text-cream rounded-sm bg-gradient-to-b px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.14em]"
            >
              Full MLB
            </Link>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["all", "All"],
            ["mlb", "MLB"],
            ["nfl", "NFL"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSportFilter(id)}
            className={cn(
              "rounded-sm border px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] transition",
              sportFilter === id
                ? "border-accent/50 bg-accent/15 text-cream"
                : "border-white/10 text-chalk hover:border-accent/40 hover:text-cream",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {editing && (
        <section className="bg-panel space-y-6 rounded-xl border border-white/[0.08] p-4">
          {(sportFilter === "all" || sportFilter === "mlb") && (
            <div>
              <h3 className="rule-head mb-1">MLB team interest</h3>
              <p className="text-chalk-dim mb-4 text-[12px]">
                10 = favorite must-watch · 7 = follow closely · 0 = ignore for RUWT.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {MLB_TEAMS.map((t) => {
                  const value = interest[String(t.id)] ?? 0;
                  return (
                    <label
                      key={t.id}
                      className="flex items-center gap-3 rounded-lg border border-white/[0.06] px-3 py-2"
                    >
                      <TeamMark teamId={t.id} size="sm" />
                      <span className="text-cream min-w-0 flex-1 truncate text-[13px]">
                        {t.abbrev} · {t.name}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={10}
                        value={value}
                        onChange={(e) =>
                          setInterest(setTeamInterestRating(interest, t.id, Number(e.target.value)))
                        }
                        className="w-24 accent-[var(--accent,#d9515c)]"
                      />
                      <span className="numeral text-accent w-5 text-right text-[13px] font-semibold">
                        {value}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          {(sportFilter === "all" || sportFilter === "nfl") && (
            <div>
              <h3 className="rule-head mb-1">NFL team interest</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {NFL_TEAMS.map((t) => {
                  const value = nflInterest[String(t.id)] ?? 0;
                  return (
                    <label
                      key={t.id}
                      className="flex items-center gap-3 rounded-lg border border-white/[0.06] px-3 py-2"
                    >
                      <img
                        src={`https://a.espncdn.com/i/teamlogos/nfl/500/${t.abbrev.toLowerCase()}.png`}
                        alt=""
                        className="h-6 w-6 object-contain"
                      />
                      <span className="text-cream min-w-0 flex-1 truncate text-[13px]">
                        {t.abbrev} · {t.name}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={10}
                        value={value}
                        onChange={(e) =>
                          setNflInterest(
                            setNflTeamInterestRating(nflInterest, t.id, Number(e.target.value)),
                          )
                        }
                        className="w-24 accent-[var(--accent,#d9515c)]"
                      />
                      <span className="numeral text-accent w-5 text-right text-[13px] font-semibold">
                        {value}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {scoreboard.isPending && nflBoard.isPending ? (
        <p className="text-chalk flex items-center gap-2 text-[13px]">
          <Loader2 size={14} className="animate-spin" /> Loading slate…
        </p>
      ) : activeGames.length === 0 && finalGames.length === 0 ? (
        <p className="text-chalk-dim text-[13px]">
          {scoreboard.isError && sportFilter !== "nfl"
            ? "Couldn’t load today’s MLB games."
            : "No games on the board for this filter."}
        </p>
      ) : (
        <section className="space-y-3">
          {activeGames.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {activeGames.map((item, i) =>
                item.sport === "mlb" ? (
                  <RuwtCard
                    key={item.id}
                    game={item.game}
                    rank={i + 1}
                    placeByTeam={divisionPlaceByTeam}
                  />
                ) : (
                  <NflRuwtCard key={item.id} game={item.game} rank={i + 1} />
                ),
              )}
            </div>
          ) : (
            <p className="text-chalk-dim text-[13px]">No live/upcoming games — finals below.</p>
          )}

          {finalGames.length > 0 && (
            <section className="space-y-2">
              <button
                type="button"
                onClick={() => setShowFinals((v) => !v)}
                className="text-chalk hover:text-cream flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-left transition hover:border-white/10"
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">
                  Finals minimized · {finalGames.length}
                </span>
                {showFinals ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              {showFinals ? (
                <div className="grid grid-cols-1 gap-2 opacity-70 sm:grid-cols-2 xl:grid-cols-3">
                  {finalGames.map((item, i) =>
                    item.sport === "mlb" ? (
                      <RuwtCard
                        key={item.id}
                        game={item.game}
                        rank={activeGames.length + i + 1}
                        compactFinal
                        placeByTeam={divisionPlaceByTeam}
                      />
                    ) : (
                      <NflRuwtCard key={item.id} game={item.game} rank={activeGames.length + i + 1} />
                    ),
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {finalGames.slice(0, 10).map((item) => {
                    const g = item.game;
                    const href =
                      item.sport === "mlb"
                        ? `/sports/mlb/game/${g.id}`
                        : `/sports/nfl/game/${g.id}`;
                    return (
                      <Link
                        key={item.id}
                        to={href}
                        className="text-chalk-dim hover:text-cream inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] px-2.5 py-1.5 text-[11px] transition hover:border-white/15"
                      >
                        <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-accent/80">
                          {item.sport}
                        </span>
                        <span className="text-cream/80">
                          {g.away.abbrev} {g.away.score}-{g.home.score} {g.home.abbrev}
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.12em]">Final</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </section>
      )}
    </div>
  );
}

function NflRuwtCard({ game, rank }: { game: NflScoredGame; rank: number }) {
  return (
    <Link
      to={`/sports/nfl/game/${game.id}`}
      className={cn(
        "relative block overflow-hidden rounded-lg border bg-[#07101d] transition hover:border-accent/40",
        game.live ? "border-alert/45" : "border-white/[0.08]",
      )}
    >
      <div className="relative z-10 flex items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-cream">
          <span className="text-accent">#{rank}</span>{" "}
          {game.live ? (
            <span className="text-alert">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-alert" />
              {game.shortDetail || "Live"}
            </span>
          ) : game.final ? (
            "Final"
          ) : (
            "Preview"
          )}
        </span>
        <span className="text-[10.5px] text-[#8b93a7]">Heat {game.score}</span>
      </div>
      <div className="relative z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-3.5">
        <div className="flex min-w-0 flex-col items-center gap-1 sm:items-start">
          {game.away.logo && <img src={game.away.logo} alt="" className="h-8 w-8 object-contain" />}
          <p className="text-[15px] font-bold text-white">{game.away.abbrev}</p>
        </div>
        <p className="font-display text-center text-[28px] tabular-nums text-white">
          {game.live || game.final ? (
            <>
              {game.away.score ?? "—"}
              <span className="mx-1.5 text-[16px] text-white/30">-</span>
              {game.home.score ?? "—"}
            </>
          ) : (
            <span className="text-[20px]">{game.whenShort ?? "TBD"}</span>
          )}
        </p>
        <div className="flex min-w-0 flex-col items-center gap-1 sm:items-end">
          {game.home.logo && <img src={game.home.logo} alt="" className="h-8 w-8 object-contain" />}
          <p className="text-[15px] font-bold text-white">{game.home.abbrev}</p>
        </div>
      </div>
      {game.live && game.situation && (
        <div className="relative z-10 border-t border-white/[0.06] px-2 py-2">
          <NflFieldMap
            game={game}
            homeYardLine={game.situation.yardLine}
            possessionTeamId={game.situation.possessionTeamId}
            downDistanceText={game.situation.downDistanceText}
          />
        </div>
      )}
      {game.reasons.length > 0 && (
        <p className="relative z-10 truncate border-t border-white/[0.06] px-3 py-1.5 text-[10.5px] text-[#a8b0c2]">
          {game.reasons.join(" · ")}
        </p>
      )}
    </Link>
  );
}

function RuwtCard({
  game,
  rank,
  compactFinal,
  placeByTeam,
}: {
  game: MlbScoredGame;
  rank: number;
  compactFinal?: boolean;
  placeByTeam?: Record<number, string>;
}) {
  const pregame = !game.live && !game.final;
  const awayWins = game.final && (game.away.score ?? 0) > (game.home.score ?? 0);
  const homeWins = game.final && (game.home.score ?? 0) > (game.away.score ?? 0);
  const pitcherIds = [game.away.probablePitcherId, game.home.probablePitcherId].filter(
    (id): id is number => id != null,
  );

  const pitcherLines = useQuery({
    queryKey: ["ruwt-pitcher-lines", game.id, pitcherIds.join(",")],
    queryFn: () => fetchPitcherSeasonLines(pitcherIds),
    enabled: pregame && pitcherIds.length > 0,
    staleTime: 120_000,
  });

  if (compactFinal) {
    return (
      <Link
        to={`/sports/mlb/game/${game.id}`}
        className="relative block overflow-hidden rounded-lg border border-white/[0.06] bg-[#07101d]/80 px-3 py-2.5 transition hover:border-accent/30"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">
            #{rank} Final
          </span>
          <span className="text-[10px] text-[#8b93a7]">Heat {game.score}</span>
        </div>
        <p className="mt-1 text-[13px] text-cream">
          {game.away.abbrev} {game.away.score} · {game.home.score} {game.home.abbrev}
        </p>
      </Link>
    );
  }

  return (
    <Link
      to={`/sports/mlb/game/${game.id}`}
      className={cn(
        "relative block overflow-hidden rounded-lg border bg-[#07101d] transition hover:border-accent/40",
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
      <div className="relative z-10 flex items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-cream">
          <span className="text-accent">#{rank}</span>{" "}
          {game.live ? (
            <span className="text-alert">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-alert" />
              {game.inning || "Live"}
            </span>
          ) : game.final ? (
            "Final"
          ) : (
            "Preview"
          )}
        </span>
        <span className="text-[10.5px] text-[#8b93a7]">Heat {game.score}</span>
      </div>

      {pregame ? (
        <div className="relative z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-3.5">
          <Side
            side={game.away}
            align="left"
            place={placeByTeam?.[game.away.teamId ?? -1]}
          />
          <p className="font-display text-center text-[26px] text-white">
            {game.whenShort ?? "TBD"}
          </p>
          <Side
            side={game.home}
            align="right"
            place={placeByTeam?.[game.home.teamId ?? -1]}
          />
        </div>
      ) : (
        <div className="relative z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-3.5">
          <Side
            side={game.away}
            align="left"
            muted={homeWins}
            place={placeByTeam?.[game.away.teamId ?? -1]}
          />
          <p className="font-display text-center text-[32px] tabular-nums text-white">
            {game.away.score ?? "—"}
            <span className="mx-1.5 text-[16px] text-white/30">-</span>
            {game.home.score ?? "—"}
          </p>
          <Side
            side={game.home}
            align="right"
            muted={awayWins}
            place={placeByTeam?.[game.home.teamId ?? -1]}
          />
        </div>
      )}

      {game.live && game.situation ? (
        <div className="relative z-10 border-t border-white/[0.06] px-3 py-2.5">
          <LiveSituationStrip game={game} compact />
        </div>
      ) : null}

      {pregame && (game.away.probablePitcherId || game.home.probablePitcherId) ? (
        <div className="relative z-10 border-t border-white/[0.06] px-3 py-2.5">
          <p className="mb-2 text-center text-[9px] font-semibold uppercase tracking-[0.16em] text-white/45">
            Probable pitchers
          </p>
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <RuwtPitcherCard
              side={game.away}
              align="left"
              line={
                game.away.probablePitcherId
                  ? pitcherLines.data?.get(game.away.probablePitcherId) ?? null
                  : null
              }
            />
            <span className="pb-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
              vs
            </span>
            <RuwtPitcherCard
              side={game.home}
              align="right"
              line={
                game.home.probablePitcherId
                  ? pitcherLines.data?.get(game.home.probablePitcherId) ?? null
                  : null
              }
            />
          </div>
        </div>
      ) : null}

      {game.reasons.length > 0 && (
        <p className="relative z-10 truncate border-t border-white/[0.06] px-3 py-1.5 text-[10.5px] text-[#a8b0c2]">
          {game.reasons.join(" · ")}
        </p>
      )}
    </Link>
  );
}

function RuwtPitcherCard({
  side,
  align,
  line,
}: {
  side: MlbScoreGame["away"];
  align: "left" | "right";
  line: MlbPitcherSeasonLine | null;
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
      {line ? (
        <p className="numeral text-[10px] text-white/60">
          {line.wins}-{line.losses} · {line.era} ERA
        </p>
      ) : null}
    </div>
  );
}

function Side({
  side,
  align,
  muted,
  place,
}: {
  side: MlbScoreGame["away"];
  align: "left" | "right";
  muted?: boolean;
  place?: string;
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
      <p className="text-[15px] font-bold tracking-wide text-white">{side.abbrev}</p>
      {side.record && (
        <p className="numeral text-[12px] font-medium text-white/70">{side.record}</p>
      )}
      {place ? (
        <p className="max-w-[9rem] truncate text-[10px] leading-tight text-white/45">{place}</p>
      ) : null}
    </div>
  );
}
