import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import TeamMark from "@/components/sports/TeamMark";
import { useAuth } from "@/lib/auth-context";
import { listFavoritePlayers } from "@/lib/favorite-players";
import { listFavoriteManagers } from "@/lib/favorite-managers";
import {
  fetchMlbManagers,
  fetchMlbScoreboard,
  fetchMlbStandings,
  parsePlayoffPercent,
  playoffOddsFromStandings,
  type MlbScoreGame,
  type MlbScoredGame,
} from "@/lib/mlb";
import {
  loadTeamInterest,
  rankRuwtGames,
  type RuwtScoreContext,
} from "@/lib/ruwt";
import { loadSportsLayout, visibleFavorites } from "@/lib/sports";
import { cn } from "@/lib/utils";

const HOT_SCORE_LIVE = 78;
const HOT_SCORE_PREGAME = 96;

function isTickerHot(g: MlbScoredGame): boolean {
  if (g.final) return false;
  const drama = g.reasons.some((r) =>
    /Tied|One-run|Extras|Late innings|Watch player|Cardinals/i.test(r),
  );
  if (g.live) {
    // Live close/late games only — not every red-tinted chip.
    return g.score >= HOT_SCORE_LIVE && drama;
  }
  // Pregame: require real heat (favorites + matchup), not "Pitching set" alone.
  if (g.score >= HOT_SCORE_PREGAME) return true;
  return g.score >= 88 && g.reasons.includes("Cardinals") && drama;
}

function shortPitcher(name: string | null): string {
  if (!name) return "TBD";
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

function BaseDiamond({
  onFirst,
  onSecond,
  onThird,
}: {
  onFirst: boolean;
  onSecond: boolean;
  onThird: boolean;
}) {
  const bag = (on: boolean) =>
    on ? "bg-[#1a5cff]" : "bg-[#c5c9d2]";
  return (
    <div className="relative mx-auto h-7 w-7" aria-hidden>
      <span className={cn("absolute top-0 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45", bag(onSecond))} />
      <span className={cn("absolute top-1/2 left-0 h-2 w-2 -translate-y-1/2 rotate-45", bag(onThird))} />
      <span className={cn("absolute top-1/2 right-0 h-2 w-2 -translate-y-1/2 rotate-45", bag(onFirst))} />
    </div>
  );
}

function TickerModule({
  game,
  hot,
}: {
  game: MlbScoredGame;
  hot: boolean;
}) {
  const awayWins = game.final && (game.away.score ?? 0) > (game.home.score ?? 0);
  const homeWins = game.final && (game.home.score ?? 0) > (game.away.score ?? 0);
  const pregame = !game.live && !game.final;

  return (
    <Link
      to={`/sports/mlb/game/${game.id}`}
      className={cn(
        "flex min-w-[168px] shrink-0 flex-col gap-1 border-r border-[#d0d4dc] px-3 py-1.5 transition hover:bg-[#f3f5f9]",
        hot && "bg-[#fff4f0]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "text-[10px] font-bold uppercase tracking-[0.04em]",
            game.live ? "text-[#c8102e]" : "text-[#111]",
          )}
        >
          {game.live ? game.inning || "Live" : game.final ? "Final" : game.whenShort || "Upcoming"}
        </span>
        {hot ? (
          <span className="rounded-sm bg-[#c8102e] px-1 py-px text-[8px] font-bold uppercase tracking-[0.08em] text-white">
            Hot
          </span>
        ) : null}
      </div>

      <div className="flex items-stretch gap-2">
        <div className="min-w-0 flex-1 space-y-0.5">
          <TeamRow
            side={game.away}
            score={pregame ? null : game.away.score}
            record={pregame ? game.away.record : null}
            winner={awayWins}
            muted={homeWins}
          />
          <TeamRow
            side={game.home}
            score={pregame ? null : game.home.score}
            record={pregame ? game.home.record : null}
            winner={homeWins}
            muted={awayWins}
          />
        </div>
        {game.live && game.situation ? (
          <div className="flex w-12 shrink-0 flex-col items-center justify-center">
            <BaseDiamond
              onFirst={game.situation.onFirst}
              onSecond={game.situation.onSecond}
              onThird={game.situation.onThird}
            />
            <p className="mt-0.5 text-[9px] font-semibold text-[#444]">
              {game.situation.outs} Out{game.situation.outs === 1 ? "" : "s"}
            </p>
          </div>
        ) : null}
      </div>

      {pregame && (game.away.probablePitcher || game.home.probablePitcher) ? (
        <p className="truncate text-[9px] text-[#666]">
          {shortPitcher(game.away.probablePitcher)} vs {shortPitcher(game.home.probablePitcher)}
        </p>
      ) : null}
    </Link>
  );
}

function TeamRow({
  side,
  score,
  record,
  winner,
  muted,
}: {
  side: MlbScoreGame["away"];
  score: number | null;
  record: string | null;
  winner?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-1.5", muted && "opacity-45")}>
      <TeamMark teamId={side.teamId} size="xs" />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[12px] font-semibold tracking-wide text-[#111]",
          winner && "font-bold",
        )}
      >
        {side.abbrev}
      </span>
      {score != null ? (
        <span className="numeral text-[13px] font-bold text-[#111]">{score}</span>
      ) : record ? (
        <span className="numeral text-[10px] text-[#777]">{record}</span>
      ) : null}
    </div>
  );
}

/** Desktop/tablet MLB score strip for Dispatch — favorites pinned, then RUWT order. */
export default function DispatchScoreTicker() {
  const { user } = useAuth();
  const layout = useMemo(() => loadSportsLayout(), []);
  const favTeamIds = useMemo(
    () =>
      visibleFavorites(layout)
        .filter((f) => f.kind === "team" && f.mlbTeamId != null && f.league === "MLB")
        .map((f) => f.mlbTeamId!),
    [layout],
  );

  const scoreboard = useQuery({
    queryKey: ["mlb-scoreboard", "dispatch-ticker"],
    queryFn: () => fetchMlbScoreboard(),
    staleTime: 45_000,
    refetchInterval: 60_000,
  });
  const standings = useQuery({
    queryKey: ["mlb-standings"],
    queryFn: () => fetchMlbStandings(),
    staleTime: 15 * 60_000,
  });
  const playerFavs = useQuery({
    queryKey: ["favorite-players", user?.id],
    queryFn: () => listFavoritePlayers(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });
  const managerFavs = useQuery({
    queryKey: ["favorite-managers", user?.id],
    queryFn: () => listFavoriteManagers(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });
  const managers = useQuery({
    queryKey: ["mlb-managers"],
    queryFn: fetchMlbManagers,
    staleTime: 30 * 60_000,
  });

  const ordered = useMemo(() => {
    const games = scoreboard.data ?? [];
    if (!games.length) return [] as MlbScoredGame[];

    const interest = loadTeamInterest();
    const watchPlayerIds = new Set(
      (playerFavs.data ?? [])
        .filter((p) => (p.position ?? "").toLowerCase() !== "manager")
        .map((p) => Number(p.playerId))
        .filter((n) => Number.isFinite(n)),
    );
    const watchManagerIds = new Set(
      (managerFavs.data ?? []).map((m) => Number(m.playerId)).filter((n) => Number.isFinite(n)),
    );
    const managerTeamById = new Map<number, number>();
    for (const m of managers.data ?? []) {
      if (m.teamId != null) managerTeamById.set(m.id, m.teamId);
    }
    const oddsRows = standings.data ? playoffOddsFromStandings(standings.data) : [];
    const playoffOddsByTeam: Record<number, number> = {};
    for (const row of oddsRows) {
      playoffOddsByTeam[row.teamId] = parsePlayoffPercent(row.playoffPercent);
    }

    const ctx: RuwtScoreContext = {
      teamInterest: interest,
      watchPlayerIds,
      watchManagerIds,
      managerTeamById,
      playoffOddsByTeam,
    };

    const ranked = rankRuwtGames(games, ctx, games.length);
    const byId = new Map(ranked.map((g) => [g.id, g]));
    const used = new Set<string>();
    const pinned: MlbScoredGame[] = [];

    for (const teamId of favTeamIds) {
      const hit = ranked.find(
        (g) => !used.has(g.id) && (g.away.teamId === teamId || g.home.teamId === teamId),
      );
      if (hit) {
        pinned.push(hit);
        used.add(hit.id);
      }
    }

    const rest = ranked.filter((g) => !used.has(g.id));
    return [...pinned, ...rest].map((g) => byId.get(g.id) ?? g);
  }, [
    scoreboard.data,
    standings.data,
    playerFavs.data,
    managerFavs.data,
    managers.data,
    favTeamIds,
  ]);

  if (scoreboard.isPending || ordered.length === 0) return null;

  return (
    <div className="hidden border-b border-white/10 bg-white md:block">
      <div className="flex overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ordered.map((g) => (
          <TickerModule key={g.id} game={g} hot={isTickerHot(g)} />
        ))}
      </div>
    </div>
  );
}
