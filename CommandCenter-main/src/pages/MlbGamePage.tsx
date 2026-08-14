import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Loader2, Star } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listFavoritePlayers } from "@/lib/favorite-players";
import { fetchTaggedPlayerIds } from "@/lib/sports-player-tags";
import HighlightReel from "@/components/sports/HighlightReel";
import TeamMark from "@/components/sports/TeamMark";
import {
  buildPlayerNameIndex,
  fetchEspnGameRecap,
  fetchMlbBoxscore,
  fetchMlbGameHighlights,
  fetchMlbGamePreview,
  formatGameDuration,
  mlbHeadshot,
  parseEspnRecapHtml,
  resolveMissingRecapPlayers,
  teamPagePath,
  type MlbBoxscore,
  type MlbBoxscoreBatter,
  type MlbBoxscorePitcher,
  type MlbBoxscoreSide,
  type MlbGameRecap,
  type MlbLineupHitter,
  type MlbPitcherSeasonLine,
  type MlbPreviewLeaderRow,
  type RecapInline,
} from "@/lib/mlb";
import { cn, formatSportsDateLong } from "@/lib/utils";

export function MlbGameDetail({
  gamePk,
  espnEventId,
  boxFirst = false,
}: {
  gamePk: string;
  espnEventId?: string | null;
  /** Prefer full box score above the written wrap (farm feeds). */
  boxFirst?: boolean;
}) {
  const { user } = useAuth();

  const box = useQuery({
    queryKey: ["mlb-boxscore-v3", gamePk],
    queryFn: () => fetchMlbBoxscore(gamePk),
    enabled: Boolean(gamePk),
    staleTime: 30_000,
    refetchInterval: (q) =>
      q.state.data?.status && /progress|live|in progress/i.test(q.state.data.status)
        ? 20_000
        : false,
  });

  const preview = useQuery({
    queryKey: ["mlb-game-preview-stats", gamePk],
    queryFn: () => fetchMlbGamePreview(gamePk),
    enabled: Boolean(gamePk),
    staleTime: 120_000,
  });

  const highlights = useQuery({
    queryKey: ["mlb-game-highlights", gamePk],
    queryFn: () => fetchMlbGameHighlights(gamePk),
    enabled: Boolean(gamePk),
    staleTime: 60_000,
  });

  const recap = useQuery({
    queryKey: [
      "mlb-game-recap-v2",
      gamePk,
      espnEventId ?? null,
      box.data?.officialDate,
      box.data?.home.abbrev,
      box.data?.away.abbrev,
    ],
    queryFn: () =>
      fetchEspnGameRecap(box.data!.officialDate, box.data!.home.abbrev, box.data!.away.abbrev, {
        espnEventId,
      }),
    enabled: Boolean(
      espnEventId ||
        (box.data?.officialDate && box.data.home.abbrev && box.data.away.abbrev),
    ),
    staleTime: 300_000,
  });

  const favPlayers = useQuery({
    queryKey: ["favorite-players", user?.id],
    queryFn: () => listFavoritePlayers(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  const taggedPlayers = useQuery({
    queryKey: ["sports-player-tags-ids", user?.id],
    queryFn: fetchTaggedPlayerIds,
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  const watchPlayerIds = useMemo(() => {
    const set = new Set<number>();
    for (const f of favPlayers.data ?? []) {
      if (f.position === "manager") continue;
      const id = Number(f.playerId);
      if (Number.isFinite(id)) set.add(id);
    }
    for (const id of taggedPlayers.data ?? []) set.add(id);
    return set;
  }, [favPlayers.data, taggedPlayers.data]);

  if (box.isPending) {
    return (
      <div className="text-chalk flex min-h-[50vh] items-center justify-center gap-2">
        <Loader2 size={18} className="animate-spin" />
        Loading box score…
      </div>
    );
  }

  if (box.isError || !box.data) {
    return (
      <p className="text-alert text-[13px]">
        {box.error instanceof Error ? box.error.message : "Box score unavailable"}
      </p>
    );
  }

  const g = box.data;
  const isFinal = /final|game over|completed/i.test(g.status);
  const duration = formatGameDuration(g.gameDurationMinutes);
  const metaBits = [
    g.venue,
    g.when,
    duration ? `Time ${duration}` : null,
    g.attendance != null ? `Att ${g.attendance.toLocaleString("en-US")}` : null,
    g.weather,
  ].filter(Boolean);

  return (
    <div className="space-y-5">
      <GameMatchupHeader game={g} />

      {/* Final: wrap first (default) or box first for farm digests. Live: box first. Pregame: preview. */}
      {!g.pregame && isFinal && !boxFirst && (
        <>
          {recap.isPending && (
            <p className="text-chalk-dim flex items-center gap-2 text-[12px]">
              <Loader2 size={14} className="animate-spin" /> Loading game wrap…
            </p>
          )}
          {recap.data && <GameWrap recap={recap.data} box={g} defaultOpen />}
        </>
      )}

      {g.pregame && (
        <>
          {recap.isPending && (
            <p className="text-chalk-dim flex items-center gap-2 text-[12px]">
              <Loader2 size={14} className="animate-spin" /> Loading preview…
            </p>
          )}
          {recap.data && <GameWrap recap={recap.data} box={g} defaultOpen />}
          <PreviewStack
            game={g}
            preview={preview.data}
            loading={preview.isPending}
            metaBits={metaBits}
          />
        </>
      )}

      {!g.pregame && g.innings.length > 0 && (
        <EspnBoxBoard game={g} metaBits={metaBits} watchPlayerIds={watchPlayerIds} />
      )}

      {!g.pregame && isFinal && boxFirst && (
        <>
          {recap.isPending && (
            <p className="text-chalk-dim flex items-center gap-2 text-[12px]">
              <Loader2 size={14} className="animate-spin" /> Loading game wrap…
            </p>
          )}
          {recap.data && <GameWrap recap={recap.data} box={g} defaultOpen={false} />}
        </>
      )}

      {!g.pregame && !isFinal && (
        <>
          {recap.isPending && (
            <p className="text-chalk-dim flex items-center gap-2 text-[12px]">
              <Loader2 size={14} className="animate-spin" /> Loading game wrap…
            </p>
          )}
          {recap.data && <GameWrap recap={recap.data} box={g} defaultOpen />}
        </>
      )}

      {highlights.isPending && (
        <p className="text-chalk-dim flex items-center gap-2 text-[12px]">
          <Loader2 size={14} className="animate-spin" /> Loading highlights…
        </p>
      )}
      <HighlightReel
        highlights={highlights.data ?? []}
        title="Game highlights"
        defaultOpen={!g.pregame}
      />

      {!g.pregame && (
        <PreviewStack
          game={g}
          preview={preview.data}
          loading={preview.isPending}
          metaBits={[]}
          bottom
        />
      )}
    </div>
  );
}

export default function MlbGamePage() {
  const { gamePk } = useParams<{ gamePk: string }>();
  const navigate = useNavigate();

  if (!gamePk) {
    return (
      <div className="p-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-chalk hover:text-cream mb-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em]"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <p className="text-alert text-[13px]">Game not found</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-7">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-chalk hover:text-cream flex items-center gap-2 text-[11px] uppercase tracking-[0.14em]"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <Link
          to="/sports/mlb"
          className="text-chalk-dim hover:text-cream text-[11px] uppercase tracking-[0.14em]"
        >
          MLB hub
        </Link>
      </div>
      <MlbGameDetail gamePk={gamePk} />
    </div>
  );
}

function PreviewStack({
  game: g,
  preview,
  loading,
  metaBits,
  bottom = false,
}: {
  game: MlbBoxscore;
  preview: Awaited<ReturnType<typeof fetchMlbGamePreview>> | undefined;
  loading: boolean;
  metaBits: (string | null)[];
  bottom?: boolean;
}) {
  const hasPitchers =
    g.away.probablePitcher ||
    g.home.probablePitcher ||
    preview?.awayPitcher ||
    preview?.homePitcher;
  const hasLineups = Boolean(
    preview && (preview.awayLineup.length > 0 || preview.homeLineup.length > 0),
  );
  const hasLeaders = Boolean(
    preview &&
      (preview.battingLeaders.some((r) => r.away || r.home) ||
        preview.pitchingLeaders.some((r) => r.away || r.home)),
  );
  if (!hasPitchers && !hasLineups && !hasLeaders && !loading && !metaBits.length) return null;

  return (
    <div className="space-y-5">
      {bottom && (hasPitchers || hasLineups || hasLeaders) && (
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b93a7]">
          Preview notes
        </p>
      )}
      {hasPitchers && (
        <ProbablePitchers
          away={g.away}
          home={g.home}
          awayStats={preview?.awayPitcher ?? null}
          homeStats={preview?.homePitcher ?? null}
          loading={loading}
        />
      )}
      {loading && g.pregame && (
        <p className="text-chalk-dim flex items-center gap-2 text-[12px]">
          <Loader2 size={14} className="animate-spin" /> Loading preview stats…
        </p>
      )}
      {hasLineups && preview && (
        <PreviewLineups
          awayAbbrev={g.away.abbrev}
          homeAbbrev={g.home.abbrev}
          away={preview.awayLineup}
          home={preview.homeLineup}
        />
      )}
      {hasLeaders && preview && (
        <PreviewLeaders
          awayAbbrev={g.away.abbrev}
          homeAbbrev={g.home.abbrev}
          batting={preview.battingLeaders}
          pitching={preview.pitchingLeaders}
        />
      )}
      {g.pregame && metaBits.length > 0 && (
        <p className="text-[12px] text-[#a8b0c2]">{metaBits.filter(Boolean).join(" · ")}</p>
      )}
    </div>
  );
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
  const bag = (on: boolean) => (on ? "bg-cream shadow-[0_0_0_1px_rgba(255,255,255,0.35)]" : "bg-white/15");
  return (
    <div className="relative mx-auto h-11 w-11" aria-hidden>
      <span className={cn("absolute top-0 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45", bag(onSecond))} />
      <span className={cn("absolute top-1/2 left-0 h-3 w-3 -translate-y-1/2 rotate-45", bag(onThird))} />
      <span className={cn("absolute top-1/2 right-0 h-3 w-3 -translate-y-1/2 rotate-45", bag(onFirst))} />
    </div>
  );
}

function LiveSituationBar({
  inning,
  situation,
}: {
  inning: string | null;
  situation: NonNullable<MlbBoxscore["situation"]>;
}) {
  const short = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length < 2) return name;
    return `${parts[0]![0]}. ${parts[parts.length - 1]}`;
  };
  return (
    <div className="relative z-10 border-t border-white/[0.08] px-3 py-3 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          {situation.batter ? (
            <p className="truncate text-[13px] text-white/85">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">
                Batter{" "}
              </span>
              <Link
                to={`/sports/mlb/player/${situation.batter.id}`}
                className="font-medium text-[#9ec1ff] hover:underline"
              >
                {short(situation.batter.name)}
              </Link>
            </p>
          ) : null}
          {situation.pitcher ? (
            <p className="truncate text-[13px] text-white/85">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">
                Pitcher{" "}
              </span>
              <Link
                to={`/sports/mlb/player/${situation.pitcher.id}`}
                className="font-medium text-[#9ec1ff] hover:underline"
              >
                {short(situation.pitcher.name)}
              </Link>
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-4">
          <BaseDiamond
            onFirst={situation.onFirst}
            onSecond={situation.onSecond}
            onThird={situation.onThird}
          />
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
              {inning || "Live"}
            </p>
            <p className="numeral mt-1 text-[15px] text-cream">
              {situation.balls}-{situation.strikes}
              <span className="mx-1.5 text-white/30">·</span>
              {situation.outs} out{situation.outs === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function GameMatchupHeader({ game: g }: { game: MlbBoxscore }) {
  const awayWins = !g.pregame && g.away.runs > g.home.runs;
  const homeWins = !g.pregame && g.home.runs > g.away.runs;
  return (
    <header className="relative overflow-hidden rounded-xl border border-white/[0.1] bg-[#07101d] shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1/2 opacity-90"
        style={{
          background: `radial-gradient(ellipse at 20% 45%, #${g.away.primaryColor}88, transparent 58%)`,
        }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-90"
        style={{
          background: `radial-gradient(ellipse at 80% 45%, #${g.home.primaryColor}88, transparent 58%)`,
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.06),transparent_45%)]" />

      <div className="relative z-10 flex items-center justify-between gap-2 border-b border-white/[0.07] px-4 py-2.5">
        <p
          className={cn(
            "text-[11px] font-bold uppercase tracking-[0.16em]",
            g.status === "Final" ? "text-cream" : g.live ? "text-alert" : "text-[#a8b0c2]",
          )}
        >
          {g.pregame ? "Preview" : g.live ? g.inning || g.status : g.status}
        </p>
        {g.officialDate && (
          <p className="text-[11px] text-[#8b93a7]">{formatSportsDateLong(g.officialDate)}</p>
        )}
      </div>

      <div className="relative z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-7 sm:gap-4 sm:px-6">
        <EspnTeam side={g.away} align="left" winner={awayWins} loser={homeWins} />
        <div className="px-1 text-center">
          {g.pregame ? (
            <>
              <p className="font-display text-[40px] leading-none tracking-tight text-white sm:text-[52px]">
                {g.whenShort ?? "TBD"}
              </p>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
                First pitch
              </p>
            </>
          ) : (
            <>
              <p className="font-display text-[48px] leading-none tabular-nums text-white sm:text-[60px]">
                <span className={awayWins ? "text-white" : "text-white/50"}>{g.away.runs}</span>
                <span className="mx-2 text-[22px] text-white/25 sm:mx-3">-</span>
                <span className={homeWins ? "text-white" : "text-white/50"}>{g.home.runs}</span>
              </p>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
                {g.status === "Final" ? "Final" : g.inning || g.status}
              </p>
              {(g.away.hits != null || g.home.hits != null) && (
                <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-white/45">
                  H {g.away.hits ?? "–"}–{g.home.hits ?? "–"}
                  {g.away.errors != null
                    ? ` · E ${g.away.errors}–${g.home.errors ?? 0}`
                    : ""}
                </p>
              )}
            </>
          )}
        </div>
        <EspnTeam side={g.home} align="right" winner={homeWins} loser={awayWins} />
      </div>

      {g.live && g.situation ? (
        <LiveSituationBar inning={g.inning} situation={g.situation} />
      ) : null}
    </header>
  );
}

function EspnTeam({
  side,
  align,
  winner,
  loser,
}: {
  side: MlbBoxscoreSide;
  align: "left" | "right";
  winner?: boolean;
  loser?: boolean;
}) {
  return (
    <Link
      to={teamPagePath(side.teamId)}
      className={cn(
        "flex min-w-0 flex-col items-center gap-2.5 transition hover:opacity-90",
        align === "left" ? "sm:items-start" : "sm:items-end",
        loser && "opacity-70",
      )}
    >
      <TeamMark
        teamId={side.teamId}
        size="xl"
        className={cn(
          "shadow-[0_8px_28px_rgba(0,0,0,0.45)]",
          winner && "ring-2 ring-white/35",
        )}
      />
      <div className={cn("text-center", align === "left" ? "sm:text-left" : "sm:text-right")}>
        <p
          className={cn(
            "text-[18px] font-bold tracking-wide sm:text-[22px]",
            winner ? "text-white" : loser ? "text-white/55" : "text-white",
          )}
        >
          {side.abbrev}
        </p>
        {side.record ? (
          <p className="numeral mt-1 text-[13px] font-medium text-white/70">{side.record}</p>
        ) : (
          <p className="mt-1 truncate text-[11px] text-[#8b93a7]">{side.name}</p>
        )}
      </div>
    </Link>
  );
}

function ProbablePitchers({
  away,
  home,
  awayStats,
  homeStats,
  loading,
}: {
  away: MlbBoxscoreSide;
  home: MlbBoxscoreSide;
  awayStats: MlbPitcherSeasonLine | null;
  homeStats: MlbPitcherSeasonLine | null;
  loading: boolean;
}) {
  const rows = [
    { side: away, stats: awayStats },
    { side: home, stats: homeStats },
  ].filter((r) => r.side.probablePitcher || r.stats);

  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.1] bg-[#0a1424]">
      <p className="border-b border-white/[0.07] px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b93a7]">
        Probable pitchers
      </p>
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2">
        <div className="flex items-center gap-2">
          <TeamMark teamId={away.teamId} size="xs" />
          <span className="text-[11px] font-semibold text-white/70">{away.abbrev}</span>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
          Pitchers
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-white/70">{home.abbrev}</span>
          <TeamMark teamId={home.teamId} size="xs" />
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3 px-4 py-4 sm:gap-5">
        <PitcherCard side={away} stats={awayStats} align="left" />
        <span className="pb-8 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/30">
          vs
        </span>
        <PitcherCard side={home} stats={homeStats} align="right" />
      </div>
      {(awayStats || homeStats || loading) && (
        <div className="overflow-x-auto border-t border-white/[0.07]">
          <table className="w-full min-w-[520px] text-[12px]">
            <thead>
              <tr className="bg-white/[0.03] text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                <th className="px-3 py-2 text-left font-medium">Player</th>
                <th className="numeral px-1.5 py-2 font-medium">W-L</th>
                <th className="numeral px-1.5 py-2 font-medium">ERA</th>
                <th className="numeral px-1.5 py-2 font-medium">WHIP</th>
                <th className="numeral px-1.5 py-2 font-medium">IP</th>
                <th className="numeral px-1.5 py-2 font-medium">H</th>
                <th className="numeral px-1.5 py-2 font-medium">K</th>
                <th className="numeral px-1.5 py-2 font-medium">BB</th>
                <th className="numeral px-1.5 py-2 pr-3 font-medium">HR</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ side, stats }) => {
                const id = stats?.id ?? side.probablePitcherId;
                const label =
                  stats?.shortName ||
                  (side.probablePitcher
                    ? side.probablePitcher
                        .split(" ")
                        .filter(Boolean)
                        .map((p, i, arr) => (i === arr.length - 1 ? p : `${p[0]}.`))
                        .join(" ")
                    : "TBD");
                const meta = [stats?.hand, stats?.number ? `#${stats.number}` : null]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <tr key={`${side.abbrev}-${id ?? label}`} className="border-t border-white/[0.05]">
                    <td className="px-3 py-2.5 text-left">
                      {id ? (
                        <Link
                          to={`/sports/mlb/player/${id}`}
                          className="font-medium text-[#9ec1ff] hover:underline"
                        >
                          {label}
                        </Link>
                      ) : (
                        <span className="text-cream">{label}</span>
                      )}
                      {meta && (
                        <span className="mt-0.5 block text-[10px] text-[#8b93a7]">{meta}</span>
                      )}
                    </td>
                    {stats ? (
                      <>
                        <td className="numeral px-1.5 py-2.5 text-center text-cream">
                          {stats.wins}-{stats.losses}
                        </td>
                        <td className="numeral px-1.5 py-2.5 text-center text-cream">{stats.era}</td>
                        <td className="numeral px-1.5 py-2.5 text-center text-cream">{stats.whip}</td>
                        <td className="numeral px-1.5 py-2.5 text-center text-cream">{stats.ip}</td>
                        <td className="numeral px-1.5 py-2.5 text-center text-cream">{stats.h}</td>
                        <td className="numeral px-1.5 py-2.5 text-center text-cream">{stats.k}</td>
                        <td className="numeral px-1.5 py-2.5 text-center text-cream">{stats.bb}</td>
                        <td className="numeral px-1.5 py-2.5 pr-3 text-center text-cream">
                          {stats.hr}
                        </td>
                      </>
                    ) : (
                      <td colSpan={8} className="px-1.5 py-2.5 text-center text-[#8b93a7]">
                        {loading ? "Loading…" : "—"}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PitcherCard({
  side,
  stats,
  align,
}: {
  side: MlbBoxscoreSide;
  stats: MlbPitcherSeasonLine | null;
  align: "left" | "right";
}) {
  const name = stats?.name ?? side.probablePitcher ?? "TBD";
  const parts = name.split(" ");
  const last = parts.length > 1 ? parts[parts.length - 1] : name;
  const first = parts.length > 1 ? parts.slice(0, -1).join(" ") : "";
  const id = stats?.id ?? side.probablePitcherId;
  const href = id ? `/sports/mlb/player/${id}` : null;
  const meta = [stats?.hand, stats?.number ? `#${stats.number}` : null].filter(Boolean).join(" · ");
  const body = (
    <>
      {id ? (
        <div className="relative h-[84px] w-[70px] overflow-hidden rounded-lg bg-[#dfe6f2] ring-1 ring-white/20 sm:h-[96px] sm:w-[78px]">
          <img
            src={mlbHeadshot(id, 426)}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-[center_15%]"
          />
        </div>
      ) : (
        <div className="grid h-[84px] w-[70px] place-items-center rounded-lg bg-white/10 text-[11px] text-white/40">
          TBD
        </div>
      )}
      {first && (
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/50">{first}</p>
      )}
      <p className="text-[16px] font-semibold leading-tight text-white sm:text-[18px]">{last}</p>
      {meta && <p className="text-[10px] text-[#8b93a7]">{meta}</p>}
    </>
  );
  const cls = cn(
    "flex min-w-0 flex-col gap-1.5",
    align === "right" ? "items-end text-right" : "items-start text-left",
  );
  if (!href) return <div className={cls}>{body}</div>;
  return (
    <Link to={href} className={cn(cls, "transition hover:opacity-95")}>
      {body}
    </Link>
  );
}

function PreviewLineups({
  awayAbbrev,
  homeAbbrev,
  away,
  home,
}: {
  awayAbbrev: string;
  homeAbbrev: string;
  away: MlbLineupHitter[];
  home: MlbLineupHitter[];
}) {
  const [tab, setTab] = useState<"away" | "home">("away");
  const rows = tab === "away" ? away : home;
  if (!away.length && !home.length) return null;

  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.1] bg-[#0a1424]">
      <div className="flex border-b border-white/[0.07]">
        {(
          [
            ["away", awayAbbrev, away.length],
            ["home", homeAbbrev, home.length],
          ] as const
        ).map(([key, abbrev, count]) => (
          <button
            key={key}
            type="button"
            disabled={!count}
            onClick={() => setTab(key)}
            className={cn(
              "flex-1 px-3 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] transition",
              tab === key
                ? "border-b-2 border-accent text-cream"
                : "text-[#8b93a7] hover:text-cream disabled:opacity-30",
            )}
          >
            {abbrev} Lineup
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-[12px]">
          <thead>
            <tr className="bg-white/[0.03] text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
              <th className="px-3 py-2 text-left font-medium">Hitters</th>
              <th className="numeral px-1.5 py-2 font-medium">H-AB</th>
              <th className="numeral px-1.5 py-2 font-medium">HR</th>
              <th className="numeral px-1.5 py-2 font-medium">RBI</th>
              <th className="numeral px-1.5 py-2 font-medium">SB</th>
              <th className="numeral px-1.5 py-2 pr-3 font-medium">AVG</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((h) => (
              <tr key={h.id} className="border-t border-white/[0.05]">
                <td className="px-3 py-2.5 text-left">
                  <Link
                    to={`/sports/mlb/player/${h.id}`}
                    className="font-medium text-[#9ec1ff] hover:underline"
                  >
                    {h.shortName}
                  </Link>
                  <span className="ml-1.5 text-[10px] text-[#8b93a7]">{h.position}</span>
                </td>
                <td className="numeral px-1.5 py-2.5 text-center text-cream">
                  {h.hits}-{h.atBats}
                </td>
                <td className="numeral px-1.5 py-2.5 text-center text-cream">{h.hr}</td>
                <td className="numeral px-1.5 py-2.5 text-center text-cream">{h.rbi}</td>
                <td className="numeral px-1.5 py-2.5 text-center text-cream">{h.sb}</td>
                <td className="numeral px-1.5 py-2.5 pr-3 text-center text-cream">{h.avg}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PreviewLeaders({
  awayAbbrev,
  homeAbbrev,
  batting,
  pitching,
}: {
  awayAbbrev: string;
  homeAbbrev: string;
  batting: MlbPreviewLeaderRow[];
  pitching: MlbPreviewLeaderRow[];
}) {
  const [tab, setTab] = useState<"batting" | "pitching">("batting");
  const rows = tab === "batting" ? batting : pitching;

  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.1] bg-[#0a1424]">
      <div className="flex border-b border-white/[0.07]">
        {(
          [
            ["batting", "Batting Leaders"],
            ["pitching", "Pitching Leaders"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "flex-1 px-3 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] transition",
              tab === key
                ? "border-b-2 border-accent text-cream"
                : "text-[#8b93a7] hover:text-cream",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="divide-y divide-white/[0.06]">
        {rows.map((row) => (
          <div key={row.category} className="px-3 py-3 sm:px-4">
            <p className="mb-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">
              {row.category}
            </p>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <LeaderSide
                side={row.away}
                abbrev={awayAbbrev}
                align="left"
                statLabel={row.statLabel}
              />
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/25">
                {row.statLabel}
              </span>
              <LeaderSide
                side={row.home}
                abbrev={homeAbbrev}
                align="right"
                statLabel={row.statLabel}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function LeaderSide({
  side,
  abbrev,
  align,
  statLabel,
}: {
  side: MlbPreviewLeaderRow["away"];
  abbrev: string;
  align: "left" | "right";
  statLabel: string;
}) {
  if (!side) {
    return (
      <div className={cn("text-[12px] text-[#8b93a7]", align === "right" && "text-right")}>—</div>
    );
  }
  return (
    <Link
      to={`/sports/mlb/player/${side.id}`}
      className={cn(
        "flex min-w-0 items-center gap-2 transition hover:opacity-95",
        align === "right" && "flex-row-reverse text-right",
      )}
    >
      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[#dfe6f2] ring-1 ring-white/15">
        <img
          src={mlbHeadshot(side.id, 213)}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[center_15%]"
        />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-cream">{side.shortName}</p>
        <p className="numeral text-[15px] font-semibold text-white">
          {side.value}
          <span className="ml-1 text-[10px] font-medium tracking-wide text-[#8b93a7]">
            {statLabel}
          </span>
        </p>
        <p className="truncate text-[10px] text-[#8b93a7]">
          {abbrev} · {side.detail}
        </p>
      </div>
    </Link>
  );
}

function GameWrap({
  recap,
  box,
  defaultOpen = false,
}: {
  recap: MlbGameRecap;
  box: {
    away: MlbBoxscoreSide;
    home: MlbBoxscoreSide;
  };
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [segments, setSegments] = useState<RecapInline[]>([]);

  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen, recap.espnEventId]);

  const nameIndex = useMemo(() => {
    const players = [
      ...box.away.batters.map((b) => ({ id: b.id, name: b.name })),
      ...box.home.batters.map((b) => ({ id: b.id, name: b.name })),
      ...box.away.pitchers.map((p) => ({ id: p.id, name: p.name })),
      ...box.home.pitchers.map((p) => ({ id: p.id, name: p.name })),
    ];
    return buildPlayerNameIndex(players);
  }, [box]);

  useEffect(() => {
    const parsed = parseEspnRecapHtml(recap.storyHtml || recap.storyText, nameIndex);
    setSegments(parsed);
    let cancelled = false;
    void resolveMissingRecapPlayers(parsed).then((resolved) => {
      if (!cancelled) setSegments(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [recap.storyHtml, recap.storyText, nameIndex]);

  const storyText = recap.storyText.replace(/—\s*—/g, "—").trim();
  const desc = (recap.description ?? "").replace(/^—\s*/, "").trim();
  const showDesc = Boolean(desc) && !storyText.toLowerCase().includes(desc.toLowerCase().slice(0, 48));
  const long = storyText.length > 420;

  const rendered = (
    <RecapBody segments={segments.length ? segments : [{ kind: "text", text: storyText }]} />
  );

  return (
    <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08] font-rss">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
          {box.away.batters.length || box.home.batters.length ? "Game wrap" : "Game preview"}
        </p>
        <h2 className="font-rss mt-1 text-[20px] font-semibold leading-snug text-cream sm:text-[22px]">
          {recap.headline}
        </h2>
        {showDesc && (
          <p className="font-rss mt-2 text-[14px] leading-relaxed text-[#c8cdd8]">{desc}</p>
        )}
      </div>
      <div className="px-4 py-4">
        <div
          className={cn(
            "font-rss text-[15px] leading-[1.75] text-[#d5dae6]",
            !open && long && "line-clamp-[12]",
          )}
        >
          {rendered}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {long && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent hover:underline"
            >
              {open ? "Show less" : "Read full story"}
            </button>
          )}
          <a
            href={recap.url}
            target="_blank"
            rel="noreferrer"
            className="text-chalk-dim hover:text-cream inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em]"
          >
            ESPN <ExternalLink size={11} />
          </a>
        </div>
      </div>
    </section>
  );
}

function RecapBody({ segments }: { segments: RecapInline[] }) {
  const linkClass =
    "font-medium text-[#9ec1ff] decoration-transparent underline-offset-[3px] transition hover:underline hover:decoration-[#9ec1ff]/55";

  // Split on paragraph breaks preserved in text segments.
  // Keep edge spaces — trim() was gluing linked names into neighboring words.
  const paragraphs: RecapInline[][] = [[]];
  for (const seg of segments) {
    if (seg.kind !== "text") {
      paragraphs[paragraphs.length - 1].push(seg);
      continue;
    }
    const chunks = seg.text.split(/\n{2,}/);
    chunks.forEach((chunk, i) => {
      if (i > 0) paragraphs.push([]);
      if (chunk && /[^\s]/.test(chunk)) {
        paragraphs[paragraphs.length - 1].push({
          kind: "text",
          text: chunk.replace(/[^\S\n]+/g, " "),
        });
      }
    });
  }

  return (
    <div className="space-y-3.5">
      {paragraphs
        .filter((p) => p.some((s) => s.text.trim()))
        .map((para, pi) => (
          <p key={pi} className="text-pretty">
            {para.map((seg, i) => {
              if (seg.kind === "text") return <span key={i}>{seg.text}</span>;
              if (seg.kind === "player" && seg.playerId != null) {
                return (
                  <Link key={i} to={`/sports/mlb/player/${seg.playerId}`} className={linkClass}>
                    {seg.text}
                  </Link>
                );
              }
              if (seg.kind === "team" && seg.teamId != null) {
                return (
                  <Link key={i} to={teamPagePath(seg.teamId)} className={linkClass}>
                    {seg.text}
                  </Link>
                );
              }
              if (seg.kind === "ext") {
                return (
                  <a key={i} href={seg.href} target="_blank" rel="noreferrer" className={linkClass}>
                    {seg.text}
                  </a>
                );
              }
              return <span key={i}>{seg.text}</span>;
            })}
          </p>
        ))}
    </div>
  );
}

function InningRow({
  side,
  innings,
  which,
}: {
  side: MlbBoxscoreSide;
  innings: { num: number; away: number | null; home: number | null }[];
  which: "away" | "home";
}) {
  return (
    <tr className="border-t border-white/[0.05]">
      <td className="px-3 py-2 text-left text-[12px] font-semibold text-white">
        <Link
          to={teamPagePath(side.teamId)}
          className="inline-flex items-center gap-2 hover:text-accent hover:underline"
        >
          <TeamMark teamId={side.teamId} size="sm" />
          {side.abbrev}
        </Link>
      </td>
      {innings.map((i) => (
        <td key={i.num} className="numeral px-1 py-2 text-[#c8cdd8]">
          {i[which] ?? "—"}
        </td>
      ))}
      <td className="numeral px-2 py-2 font-bold text-white">{side.runs}</td>
      <td className="numeral px-2 py-2 text-[#c8cdd8]">{side.hits}</td>
      <td className="numeral px-2 py-2 text-[#c8cdd8]">{side.errors}</td>
    </tr>
  );
}

function pitcherDecision(
  note: string | null | undefined,
): "W" | "L" | "S" | "H" | "BS" | null {
  if (!note) return null;
  const m = note.match(/\b(W|L|S|H|BS)\b/i);
  return m ? (m[1].toUpperCase() as "W" | "L" | "S" | "H" | "BS") : null;
}

function shortPitcherName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0]![0]}. ${parts[parts.length - 1]}`;
}

function EspnBoxBoard({
  game,
  metaBits,
  watchPlayerIds,
}: {
  game: MlbBoxscore;
  metaBits: (string | null)[];
  watchPlayerIds?: Set<number>;
}) {
  const decisions = useMemo(() => {
    const all = [...game.away.pitchers, ...game.home.pitchers];
    const find = (code: "W" | "L" | "S") =>
      all.find((p) => pitcherDecision(p.note) === code) ?? null;
    return { win: find("W"), loss: find("L"), save: find("S") };
  }, [game]);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-white/[0.1] bg-[#0a1424]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[440px] text-center text-[12px]">
            <thead>
              <tr className="bg-white/[0.03] text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                <th className="px-3 py-2 text-left font-medium"> </th>
                {game.innings.map((i) => (
                  <th key={i.num} className="numeral px-1 py-2 font-medium">
                    {i.num}
                  </th>
                ))}
                <th className="numeral px-2 py-2 font-semibold text-white/70">R</th>
                <th className="numeral px-2 py-2 font-medium">H</th>
                <th className="numeral px-2 py-2 font-medium">E</th>
              </tr>
            </thead>
            <tbody>
              <InningRow side={game.away} innings={game.innings} which="away" />
              <InningRow side={game.home} innings={game.innings} which="home" />
            </tbody>
          </table>
        </div>
        {(decisions.win || decisions.loss || decisions.save) && (
          <div className="grid grid-cols-3 gap-2 border-t border-white/[0.07] px-3 py-3">
            {(
              [
                ["WIN", decisions.win],
                ["LOSS", decisions.loss],
                ["SAVE", decisions.save],
              ] as const
            ).map(([label, p]) => (
              <div key={label} className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
                  {label}
                </p>
                {p ? (
                  <>
                    <Link
                      to={`/sports/mlb/player/${p.id}`}
                      className="mt-0.5 inline-flex items-center gap-1 truncate text-[13px] font-semibold text-[#9ec1ff] hover:underline"
                    >
                      {shortPitcherName(p.name)}
                      {watchPlayerIds?.has(p.id) ? (
                        <Star size={11} className="text-accent fill-current" />
                      ) : null}
                    </Link>
                    <p className="numeral mt-0.5 text-[11px] text-[#a8b0c2]">
                      {p.ip} IP · {p.h} H · {p.er} ER · {p.so} K · {p.bb} BB
                    </p>
                  </>
                ) : (
                  <p className="mt-0.5 text-[13px] text-[#6b7386]">—</p>
                )}
              </div>
            ))}
          </div>
        )}
        {metaBits.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-white/[0.07] px-4 py-3 text-[11.5px] text-[#a8b0c2]">
            {metaBits.map((bit) => (
              <span key={String(bit)}>{bit}</span>
            ))}
          </div>
        )}
      </div>

      <TeamBoxSection side={game.away} watchPlayerIds={watchPlayerIds} />
      <TeamBoxSection side={game.home} watchPlayerIds={watchPlayerIds} />
    </div>
  );
}

function TeamBoxSection({
  side,
  watchPlayerIds,
}: {
  side: MlbBoxscoreSide;
  watchPlayerIds?: Set<number>;
}) {
  const battingNotes = useMemo(() => {
    const notes: { label: string; text: string }[] = [];
    const hrs = side.batters.filter((b) => b.hr > 0);
    if (hrs.length) {
      notes.push({
        label: "HR",
        text: hrs.map((b) => `${shortPitcherName(b.name)} (${b.hr})`).join(", "),
      });
    }
    const rbis = side.batters.filter((b) => b.rbi > 0);
    if (rbis.length) {
      notes.push({
        label: "RBI",
        text: rbis.map((b) => `${shortPitcherName(b.name)} ${b.rbi}`).join(", "),
      });
    }
    return notes;
  }, [side]);

  const totals = useMemo(() => {
    return side.batters.reduce(
      (acc, b) => ({
        ab: acc.ab + b.ab,
        r: acc.r + b.r,
        h: acc.h + b.h,
        rbi: acc.rbi + b.rbi,
        hr: acc.hr + b.hr,
        bb: acc.bb + b.bb,
        so: acc.so + b.so,
      }),
      { ab: 0, r: 0, h: 0, rbi: 0, hr: 0, bb: 0, so: 0 },
    );
  }, [side]);

  return (
    <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
      <div className="flex items-center gap-2 border-b border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
        <TeamMark teamId={side.teamId} size="sm" />
        <Link
          to={teamPagePath(side.teamId)}
          className="text-[14px] font-bold tracking-wide text-white hover:text-accent hover:underline"
        >
          {side.name}
        </Link>
        {side.record && <span className="numeral text-[12px] text-[#8b93a7]">{side.record}</span>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-[12px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
              <th className="px-3 py-2 font-medium">Hitters</th>
              <th className="numeral px-1.5 py-2 font-medium">AB</th>
              <th className="numeral px-1.5 py-2 font-medium">R</th>
              <th className="numeral px-1.5 py-2 font-medium">H</th>
              <th className="numeral px-1.5 py-2 font-medium">RBI</th>
              <th className="numeral px-1.5 py-2 font-medium">HR</th>
              <th className="numeral px-1.5 py-2 font-medium">BB</th>
              <th className="numeral px-1.5 py-2 font-medium">K</th>
              <th className="numeral px-1.5 py-2 font-medium">AVG</th>
              <th className="numeral px-1.5 py-2 font-medium">OBP</th>
              <th className="numeral px-1.5 py-2 font-medium">SLG</th>
            </tr>
          </thead>
          <tbody>
            {side.batters.map((b, i) => (
              <BatterRow key={b.id} b={b} zebra={i % 2 === 1} watched={watchPlayerIds?.has(b.id)} />
            ))}
            <tr className="border-t border-white/[0.1] bg-white/[0.03] font-semibold">
              <td className="px-3 py-2 text-[11px] uppercase tracking-[0.12em] text-white">
                Team
              </td>
              <td className="numeral px-1.5 py-2 text-white">{totals.ab}</td>
              <td className="numeral px-1.5 py-2 text-white">{totals.r}</td>
              <td className="numeral px-1.5 py-2 text-white">{totals.h}</td>
              <td className="numeral px-1.5 py-2 text-white">{totals.rbi}</td>
              <td className="numeral px-1.5 py-2 text-white">{totals.hr}</td>
              <td className="numeral px-1.5 py-2 text-white">{totals.bb}</td>
              <td className="numeral px-1.5 py-2 text-white">{totals.so}</td>
              <td className="numeral px-1.5 py-2 text-[#8b93a7]">—</td>
              <td className="numeral px-1.5 py-2 text-[#8b93a7]">—</td>
              <td className="numeral px-1.5 py-2 text-[#8b93a7]">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      {battingNotes.length > 0 && (
        <div className="space-y-1.5 border-t border-white/[0.06] px-3 py-3 text-[12.5px] leading-relaxed text-[#c8cdd8]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
            Batting
          </p>
          {battingNotes.map((n) => (
            <p key={n.label}>
              <span className="font-semibold text-cream">{n.label}:</span> {n.text}
            </p>
          ))}
        </div>
      )}

      {side.pitchers.length > 0 && (
        <div className="overflow-x-auto border-t border-white/[0.06]">
          <table className="w-full min-w-[520px] text-left text-[12px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                <th className="px-3 py-2 font-medium">Pitcher</th>
                <th className="numeral px-2 py-2 font-medium">IP</th>
                <th className="numeral px-2 py-2 font-medium">H</th>
                <th className="numeral px-2 py-2 font-medium">R</th>
                <th className="numeral px-2 py-2 font-medium">ER</th>
                <th className="numeral px-2 py-2 font-medium">BB</th>
                <th className="numeral px-2 py-2 font-medium">SO</th>
              </tr>
            </thead>
            <tbody>
              {side.pitchers.map((p) => (
                <PitcherRow key={p.id} p={p} watched={watchPlayerIds?.has(p.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function BatterRow({
  b,
  zebra,
  watched,
}: {
  b: MlbBoxscoreBatter;
  zebra?: boolean;
  watched?: boolean;
}) {
  return (
    <tr className={cn("border-t border-white/[0.04]", zebra && "bg-white/[0.02]")}>
      <td className="px-3 py-1.5">
        <Link
          to={`/sports/mlb/player/${b.id}`}
          className="text-cream inline-flex items-center gap-1 hover:text-accent hover:underline"
        >
          {b.name}
          {watched ? <Star size={11} className="text-accent fill-current" /> : null}
        </Link>
        {b.position && <span className="ml-1 text-[10px] text-[#8b93a7]">{b.position}</span>}
      </td>
      <td className="numeral px-1.5 py-1.5 text-[#c8cdd8]">{b.ab}</td>
      <td className="numeral px-1.5 py-1.5 text-[#c8cdd8]">{b.r}</td>
      <td className="numeral px-1.5 py-1.5 text-[#c8cdd8]">{b.h}</td>
      <td className="numeral px-1.5 py-1.5 text-[#c8cdd8]">{b.rbi}</td>
      <td className="numeral px-1.5 py-1.5 text-[#c8cdd8]">{b.hr}</td>
      <td className="numeral px-1.5 py-1.5 text-[#c8cdd8]">{b.bb}</td>
      <td className="numeral px-1.5 py-1.5 text-[#c8cdd8]">{b.so}</td>
      <td className="numeral px-1.5 py-1.5 text-[#c8cdd8]">{b.avg ?? "—"}</td>
      <td className="numeral px-1.5 py-1.5 text-[#c8cdd8]">{b.obp ?? "—"}</td>
      <td className="numeral px-1.5 py-1.5 text-[#c8cdd8]">{b.slg ?? "—"}</td>
    </tr>
  );
}

function PitcherRow({ p, watched }: { p: MlbBoxscorePitcher; watched?: boolean }) {
  return (
    <tr className="border-t border-white/[0.04]">
      <td className="px-3 py-1.5">
        <Link
          to={`/sports/mlb/player/${p.id}`}
          className="text-cream inline-flex items-center gap-1 hover:text-accent hover:underline"
        >
          {p.name}
          {watched ? <Star size={11} className="text-accent fill-current" /> : null}
        </Link>
        {p.note && <span className="ml-1 text-[10px] text-[#8b93a7]">({p.note})</span>}
      </td>
      <td className="numeral px-2 py-1.5 text-[#c8cdd8]">{p.ip}</td>
      <td className="numeral px-2 py-1.5 text-[#c8cdd8]">{p.h}</td>
      <td className="numeral px-2 py-1.5 text-[#c8cdd8]">{p.r}</td>
      <td className="numeral px-2 py-1.5 text-[#c8cdd8]">{p.er}</td>
      <td className="numeral px-2 py-1.5 text-[#c8cdd8]">{p.bb}</td>
      <td className="numeral px-2 py-1.5 text-[#c8cdd8]">{p.so}</td>
    </tr>
  );
}

