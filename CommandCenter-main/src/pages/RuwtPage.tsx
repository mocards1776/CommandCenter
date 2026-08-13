import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Radio, RefreshCw, Settings2 } from "lucide-react";
import toast from "react-hot-toast";
import StarField from "@/components/StarField";
import TeamMark from "@/components/sports/TeamMark";
import { useAuth } from "@/lib/auth-context";
import { listFavoritePlayers } from "@/lib/favorite-players";
import {
  fetchMlbScoreboard,
  fetchMlbStandings,
  type MlbScoreGame,
  type MlbScoredGame,
} from "@/lib/mlb";
import {
  loadTeamInterest,
  rankRuwtGames,
  setTeamInterestRating,
  type RuwtTeamInterest,
} from "@/lib/ruwt";
import { markSportsSolo } from "@/lib/sports-home";
import { cn } from "@/lib/utils";

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
  const [editing, setEditing] = useState(false);

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

  const favorites = useQuery({
    queryKey: ["favorite-players", user?.id],
    queryFn: () => listFavoritePlayers(user!.id),
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

  const watchPlayerIds = useMemo(() => {
    const set = new Set<number>();
    for (const f of favorites.data ?? []) {
      if (f.position === "manager") continue;
      const id = Number(f.playerId);
      if (Number.isFinite(id)) set.add(id);
    }
    return set;
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
        watchManagerIds,
        managerTeamById,
        playoffOddsByTeam,
      },
      20,
    );
  }, [
    scoreboard.data,
    interest,
    watchPlayerIds,
    watchManagerIds,
    managerTeamById,
    playoffOddsByTeam,
  ]);

  const refresh = () => {
    void Promise.all([scoreboard.refetch(), standings.refetch()]).then(() =>
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
              Ranked by drama, your team interest, favorites, pitching matchups, records, and
              playoff stakes — so you know what to turn on.
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
              disabled={scoreboard.isFetching}
              className="text-chalk hover:text-cream flex items-center gap-2 rounded-sm border border-white/10 px-3 py-2 text-[10.5px] uppercase tracking-[0.14em] transition hover:border-accent/40 disabled:opacity-40"
            >
              <RefreshCw size={13} className={scoreboard.isFetching ? "animate-spin" : ""} />
              Refresh
            </button>
            <Link
              to="/sports/mlb?solo=1"
              className="from-accent-deep to-accent-dark text-cream rounded-sm bg-gradient-to-b px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.14em]"
            >
              Full MLB
            </Link>
          </div>
        </div>
      </div>

      {editing && (
        <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
          <h3 className="rule-head mb-1">Team interest</h3>
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
        </section>
      )}

      {scoreboard.isPending ? (
        <p className="text-chalk flex items-center gap-2 text-[13px]">
          <Loader2 size={14} className="animate-spin" /> Loading slate…
        </p>
      ) : scoreboard.isError ? (
        <p className="text-alert text-[13px]">Couldn’t load today’s games.</p>
      ) : ranked.length === 0 ? (
        <p className="text-chalk-dim text-[13px]">No games on today’s slate.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {ranked.map((g, i) => (
            <RuwtCard key={g.id} game={g} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function RuwtCard({ game, rank }: { game: MlbScoredGame; rank: number }) {
  const pregame = !game.live && !game.final;
  const awayWins = game.final && (game.away.score ?? 0) > (game.home.score ?? 0);
  const homeWins = game.final && (game.home.score ?? 0) > (game.away.score ?? 0);

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
          <Side side={game.away} align="left" />
          <p className="font-display text-center text-[26px] text-white">
            {game.whenShort ?? "TBD"}
          </p>
          <Side side={game.home} align="right" />
        </div>
      ) : (
        <div className="relative z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-3.5">
          <Side side={game.away} align="left" muted={homeWins} />
          <p className="font-display text-center text-[32px] tabular-nums text-white">
            {game.away.score ?? "—"}
            <span className="mx-1.5 text-[16px] text-white/30">-</span>
            {game.home.score ?? "—"}
          </p>
          <Side side={game.home} align="right" muted={awayWins} />
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

function Side({
  side,
  align,
  muted,
}: {
  side: MlbScoreGame["away"];
  align: "left" | "right";
  muted?: boolean;
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
    </div>
  );
}
