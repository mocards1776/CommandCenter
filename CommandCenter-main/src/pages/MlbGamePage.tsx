import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Eye, Loader2, Star } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listFavoritePlayers } from "@/lib/favorite-players";
import { fetchTaggedPlayerIds } from "@/lib/sports-player-tags";
import HighlightReel from "@/components/sports/HighlightReel";
import MlbLiveMatchupPanel from "@/components/sports/MlbLiveMatchupPanel";
import PlayerHeadshot from "@/components/sports/PlayerHeadshot";
import { SelectableHighlightRegion } from "@/components/rss/SelectableHighlightRegion";
import TeamMark from "@/components/sports/TeamMark";
import { TeamFormChips, TeamStandingLine } from "@/components/sports/TeamFormChips";
import { fetchMlbTeamForm, type TeamFormStrip } from "@/lib/team-form";
import {
  buildPlayerNameIndex,
  fetchBbrefGamePreview,
  fetchEspnGameRecap,
  fetchMlbBoxscore,
  fetchMlbGameHighlights,
  fetchMlbGamePreview,
  fetchProspectRankMaps,
  formatGameDuration,
  mlbHeadshot,
  parseEspnRecapHtml,
  playerWatchKind,
  prospectRankLabels,
  prospectRanksFor,
  resolveMissingRecapPlayers,
  teamPagePath,
  type MlbBbrefGamePreview,
  type MlbBbrefPreviewSummary,
  type MlbBoxscore,
  type MlbBoxscoreBatter,
  type MlbBoxscorePitcher,
  type MlbBoxscoreSide,
  type MlbGameRecap,
  type MlbLineupHitter,
  type MlbPitcherSeasonLine,
  type MlbPreviewLeaderRow,
  type MlbProspectRankMaps,
  type PlayerWatchKind,
  type RecapInline,
} from "@/lib/mlb";
import { contentHidePhrases, fetchRssFilters } from "@/lib/rss";
import { cn, formatSportsDateLong } from "@/lib/utils";

export function MlbGameDetail({
  gamePk,
  espnEventId,
  boxFirst: _boxFirst = false,
  suppressWrapHeader = false,
}: {
  gamePk: string;
  espnEventId?: string | null;
  /** Prefer full box score above the written wrap (farm feeds). */
  boxFirst?: boolean;
  /** Parent hero already shows the wrap headline. */
  suppressWrapHeader?: boolean;
}) {
  const { user } = useAuth();

  const box = useQuery({
    queryKey: ["mlb-boxscore-v4", gamePk],
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

  const bbrefPreview = useQuery({
    queryKey: [
      "mlb-bbref-game-preview",
      box.data?.officialDate,
      box.data?.home.abbrev,
      box.data?.away.abbrev,
    ],
    queryFn: () =>
      fetchBbrefGamePreview({
        homeAbbrev: box.data!.home.abbrev,
        awayAbbrev: box.data!.away.abbrev,
        date: box.data!.officialDate!,
      }),
    enabled: Boolean(box.data?.officialDate && box.data?.home.abbrev && box.data?.away.abbrev),
    staleTime: 30 * 60_000,
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

  const favoritePlayerIds = useMemo(() => {
    const set = new Set<number>();
    for (const f of favPlayers.data ?? []) {
      if (f.position === "manager") continue;
      const id = Number(f.playerId);
      if (Number.isFinite(id)) set.add(id);
    }
    return set;
  }, [favPlayers.data]);

  const taggedPlayerIds = useMemo(() => {
    const set = new Set<number>();
    for (const id of taggedPlayers.data ?? []) set.add(id);
    return set;
  }, [taggedPlayers.data]);

  const pipelineRanks = useQuery({
    queryKey: ["prospect-rank-maps", box.data?.away.teamId, box.data?.home.teamId],
    queryFn: () =>
      fetchProspectRankMaps({
        teamIds: [box.data!.away.teamId, box.data!.home.teamId].filter(Boolean),
      }),
    enabled: Boolean(box.data?.away.teamId && box.data?.home.teamId),
    staleTime: 30 * 60_000,
  });

  const awayForm = useQuery({
    queryKey: ["mlb-team-form", box.data?.away.teamId],
    queryFn: () => fetchMlbTeamForm(box.data!.away.teamId),
    enabled: Boolean(box.data?.away.teamId),
    staleTime: 120_000,
  });
  const homeForm = useQuery({
    queryKey: ["mlb-team-form", box.data?.home.teamId],
    queryFn: () => fetchMlbTeamForm(box.data!.home.teamId),
    enabled: Boolean(box.data?.home.teamId),
    staleTime: 120_000,
  });

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
  const duration = formatGameDuration(g.gameDurationMinutes);
  const metaBits = [
    g.venue,
    g.when,
    duration ? `Time ${duration}` : null,
    g.attendance != null ? `Att ${g.attendance.toLocaleString("en-US")}` : null,
    g.weather,
  ].filter(Boolean);

  return (
    <div className="w-full max-w-full min-w-0 space-y-5 overflow-x-hidden">
      <GameMatchupHeader game={g} />

      {/* Box score (with team circles) sits above wrap text. Pregame: preview story first. */}
      {g.pregame && (
        <>
          {recap.isPending && (
            <p className="text-chalk-dim flex items-center gap-2 text-[12px]">
              <Loader2 size={14} className="animate-spin" /> Loading preview…
            </p>
          )}
          {recap.data && (
            <GameWrap
              recap={recap.data}
              box={g}
              defaultOpen
              suppressHeader={suppressWrapHeader}
              favoriteIds={favoritePlayerIds}
              taggedIds={taggedPlayerIds}
            />
          )}
          <PreviewStack
            game={g}
            preview={preview.data}
            loading={preview.isPending}
            metaBits={metaBits}
            watchPlayerIds={favoritePlayerIds}
            taggedPlayerIds={taggedPlayerIds}
          />
          <BbrefPreviewStack
            awayAbbrev={g.away.abbrev}
            homeAbbrev={g.home.abbrev}
            data={bbrefPreview.data}
            loading={bbrefPreview.isPending}
          />
        </>
      )}

      {!g.pregame && g.innings.length > 0 && (
        <EspnBoxBoard
          game={g}
          metaBits={metaBits}
          watchPlayerIds={favoritePlayerIds}
          taggedPlayerIds={taggedPlayerIds}
          prospectRanks={pipelineRanks.data}
          awayForm={awayForm.data ?? null}
          homeForm={homeForm.data ?? null}
          afterLinescore={
            <>
              {recap.isPending && (
                <p className="text-chalk-dim flex items-center gap-2 text-[12px]">
                  <Loader2 size={14} className="animate-spin" /> Loading game wrap…
                </p>
              )}
              {recap.data ? (
                <GameWrap
                  recap={recap.data}
                  box={g}
                  defaultOpen
                  suppressHeader={suppressWrapHeader}
                  favoriteIds={favoritePlayerIds}
                  taggedIds={taggedPlayerIds}
                />
              ) : null}
            </>
          }
        />
      )}

      {!g.pregame && g.innings.length === 0 && (
        <>
          {recap.isPending && (
            <p className="text-chalk-dim flex items-center gap-2 text-[12px]">
              <Loader2 size={14} className="animate-spin" /> Loading game wrap…
            </p>
          )}
          {recap.data && (
            <GameWrap
              recap={recap.data}
              box={g}
              defaultOpen
              suppressHeader={suppressWrapHeader}
              favoriteIds={favoritePlayerIds}
              taggedIds={taggedPlayerIds}
            />
          )}
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
        <>
          <PreviewStack
            game={g}
            preview={preview.data}
            loading={preview.isPending}
            metaBits={[]}
            bottom
            watchPlayerIds={favoritePlayerIds}
            taggedPlayerIds={taggedPlayerIds}
          />
          <BbrefPreviewStack
            awayAbbrev={g.away.abbrev}
            homeAbbrev={g.home.abbrev}
            data={bbrefPreview.data}
            loading={bbrefPreview.isPending}
          />
        </>
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
  watchPlayerIds,
  taggedPlayerIds,
}: {
  game: MlbBoxscore;
  preview: Awaited<ReturnType<typeof fetchMlbGamePreview>> | undefined;
  loading: boolean;
  metaBits: (string | null)[];
  bottom?: boolean;
  watchPlayerIds?: Set<number>;
  taggedPlayerIds?: Set<number>;
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
          watchPlayerIds={watchPlayerIds}
          taggedPlayerIds={taggedPlayerIds}
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
          watchPlayerIds={watchPlayerIds}
          taggedPlayerIds={taggedPlayerIds}
        />
      )}
      {hasLeaders && preview && (
        <PreviewLeaders
          awayAbbrev={g.away.abbrev}
          homeAbbrev={g.home.abbrev}
          batting={preview.battingLeaders}
          pitching={preview.pitchingLeaders}
          watchPlayerIds={watchPlayerIds}
          taggedPlayerIds={taggedPlayerIds}
        />
      )}
      {g.pregame && metaBits.length > 0 && (
        <p className="text-[12px] text-[#a8b0c2]">{metaBits.filter(Boolean).join(" · ")}</p>
      )}
    </div>
  );
}

function summaryBits(s: MlbBbrefPreviewSummary | null | undefined): string[] {
  if (!s) return [];
  return [
    s.record ? `Rec ${s.record}` : null,
    s.standing,
    s.manager ? `Mgr ${s.manager}` : null,
    s.last10 ? `L10 ${s.last10}` : null,
    s.last20 ? `L20 ${s.last20}` : null,
    s.last30 ? `L30 ${s.last30}` : null,
    s.home ? `Home ${s.home}` : null,
    s.away ? `Away ${s.away}` : null,
    s.vsRhp ? `vs RHP ${s.vsRhp}` : null,
    s.vsLhp ? `vs LHP ${s.vsLhp}` : null,
    s.oneRun ? `1-run ${s.oneRun}` : null,
    s.extraInnings ? `XI ${s.extraInnings}` : null,
  ].filter((x): x is string => Boolean(x));
}

function BbrefPreviewStack({
  awayAbbrev,
  homeAbbrev,
  data,
  loading,
}: {
  awayAbbrev: string;
  homeAbbrev: string;
  data: MlbBbrefGamePreview | null | undefined;
  loading: boolean;
}) {
  if (loading) {
    return (
      <p className="text-chalk-dim flex items-center gap-2 text-[12px]">
        <Loader2 size={14} className="animate-spin" /> Loading Baseball Reference matchups…
      </p>
    );
  }
  if (!data) return null;

  const awayBits = summaryBits(data.awaySummary);
  const homeBits = summaryBits(data.homeSummary);
  const hasSeries = data.seasonSeries.length > 0;
  const hasBatters = data.awayBatters.length > 0 || data.homeBatters.length > 0;
  const hasPitchers = data.awayPitchers.length > 0 || data.homePitchers.length > 0;
  if (!awayBits.length && !homeBits.length && !hasSeries && !hasBatters && !hasPitchers) {
    return null;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b93a7]">
          Baseball Reference matchups
        </p>
        {data.url ? (
          <a
            href={data.url}
            target="_blank"
            rel="noreferrer"
            className="text-chalk-dim hover:text-cream inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] hover:underline"
          >
            Full preview <ExternalLink size={11} />
          </a>
        ) : null}
      </div>

      {(awayBits.length > 0 || homeBits.length > 0) && (
        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/[0.1] bg-[#0a1424] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
              {awayAbbrev} form
            </p>
            <p className="text-cream mt-2 text-[12.5px] leading-relaxed">
              {awayBits.join(" · ") || "—"}
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.1] bg-[#0a1424] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
              {homeAbbrev} form
            </p>
            <p className="text-cream mt-2 text-[12.5px] leading-relaxed">
              {homeBits.join(" · ") || "—"}
            </p>
          </div>
        </section>
      )}

      {hasSeries && (
        <section className="overflow-hidden rounded-xl border border-white/[0.1] bg-[#0a1424]">
          <p className="border-b border-white/[0.07] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b93a7]">
            Season series
          </p>
          <ul className="divide-y divide-white/[0.06]">
            {data.seasonSeries.map((row) => (
              <li
                key={row.result}
                className="px-4 py-2 text-[12.5px] leading-relaxed text-[#c8cdd8]"
              >
                {row.result}
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasBatters && (
        <div className="grid gap-4 lg:grid-cols-2">
          <BbrefStatTable
            title={`${awayAbbrev} batters`}
            rows={data.awayBatters}
            columns={[
              { key: "name", label: "Batter" },
              { key: "PA", label: "PA" },
              { key: "BA", label: "BA" },
              { key: "OPS", label: "OPS" },
              { key: "ops28", label: "28d" },
              { key: "HR", label: "HR" },
            ]}
          />
          <BbrefStatTable
            title={`${homeAbbrev} batters`}
            rows={data.homeBatters}
            columns={[
              { key: "name", label: "Batter" },
              { key: "PA", label: "PA" },
              { key: "BA", label: "BA" },
              { key: "OPS", label: "OPS" },
              { key: "ops28", label: "28d" },
              { key: "HR", label: "HR" },
            ]}
          />
        </div>
      )}

      {hasPitchers && (
        <div className="grid gap-4 lg:grid-cols-2">
          <BbrefStatTable
            title={`${awayAbbrev} pitchers`}
            rows={data.awayPitchers}
            columns={[
              { key: "name", label: "Pitcher" },
              { key: "IP", label: "IP" },
              { key: "ERA", label: "ERA" },
              { key: "OPS", label: "OPS" },
              { key: "ops28", label: "28d" },
              { key: "HR", label: "HR" },
            ]}
          />
          <BbrefStatTable
            title={`${homeAbbrev} pitchers`}
            rows={data.homePitchers}
            columns={[
              { key: "name", label: "Pitcher" },
              { key: "IP", label: "IP" },
              { key: "ERA", label: "ERA" },
              { key: "OPS", label: "OPS" },
              { key: "ops28", label: "28d" },
              { key: "HR", label: "HR" },
            ]}
          />
        </div>
      )}
    </div>
  );
}

function BbrefStatTable({
  title,
  rows,
  columns,
}: {
  title: string;
  rows: Record<string, string>[];
  columns: { key: string; label: string }[];
}) {
  if (!rows.length) return null;
  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.1] bg-[#0a1424]">
      <p className="border-b border-white/[0.07] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b93a7]">
        {title}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] text-[12px]">
          <thead>
            <tr className="bg-white/[0.03] text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "px-2 py-2 font-medium",
                    c.key === "name" ? "text-left" : "numeral text-center",
                  )}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${title}-${row.name}`} className="border-t border-white/[0.05]">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-2 py-1.5",
                      c.key === "name"
                        ? "text-left text-cream"
                        : "numeral text-center text-[#c8cdd8]",
                    )}
                  >
                    {row[c.key] || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
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
                className="font-semibold text-accent hover:underline"
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
                className="font-semibold text-accent hover:underline"
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
  const awayForm = useQuery({
    queryKey: ["mlb-team-form", g.away.teamId],
    queryFn: () => fetchMlbTeamForm(g.away.teamId),
    enabled: g.away.teamId > 0,
    staleTime: 120_000,
  });
  const homeForm = useQuery({
    queryKey: ["mlb-team-form", g.home.teamId],
    queryFn: () => fetchMlbTeamForm(g.home.teamId),
    enabled: g.home.teamId > 0,
    staleTime: 120_000,
  });
  const showLiveMatchup =
    Boolean(g.situation) && (g.live || /warmup|in progress/i.test(g.status));
  const pregameClock = g.pregame && !/warmup/i.test(g.status);
  return (
    <header className="relative w-full max-w-full min-w-0 overflow-hidden rounded-xl border border-white/[0.1] bg-[#07101d] shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
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

      <div className="relative z-10 flex items-center justify-between gap-2 border-b border-white/[0.07] px-3 py-2.5 sm:px-4">
        <p
          className={cn(
            "min-w-0 truncate text-[11px] font-bold uppercase tracking-[0.16em]",
            g.status === "Final" ? "text-cream" : g.live ? "text-alert" : "text-[#a8b0c2]",
          )}
        >
          {g.pregame ? (/warmup/i.test(g.status) ? g.status : "Preview") : g.live ? g.inning || g.status : g.status}
        </p>
        {g.officialDate && (
          <p className="shrink-0 text-[11px] text-[#8b93a7]">{formatSportsDateLong(g.officialDate)}</p>
        )}
      </div>

      {/* Compact flex scoreboard — cannot outgrow the phone width. */}
      <div className="relative z-10 flex w-full min-w-0 items-center gap-2 px-2.5 py-4 sm:gap-4 sm:px-6 sm:py-7">
        <EspnTeam
          side={g.away}
          align="left"
          winner={awayWins}
          loser={homeWins}
          form={awayForm.data ?? null}
          showForm={pregameClock}
        />
        <div className="w-[5.5rem] shrink-0 text-center sm:w-auto sm:min-w-[7.5rem] sm:px-1">
          {pregameClock ? (
            <>
              <p className="font-display text-[26px] leading-none tracking-tight text-white sm:text-[52px]">
                {g.whenShort ?? "TBD"}
              </p>
              <p className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7] sm:mt-2 sm:text-[10px] sm:tracking-[0.16em]">
                First pitch
              </p>
            </>
          ) : (
            <>
              <p className="font-display text-[28px] leading-none tabular-nums tracking-tight text-white sm:text-[52px] md:text-[64px]">
                <span
                  className={cn(
                    "drop-shadow-[0_0_28px_rgba(255,255,255,0.16)]",
                    awayWins ? "text-white" : "text-white/45",
                  )}
                >
                  {g.away.runs}
                </span>
                <span className="mx-1 text-[16px] font-light text-white/25 sm:mx-3 sm:text-[22px]">–</span>
                <span
                  className={cn(
                    "drop-shadow-[0_0_28px_rgba(255,255,255,0.16)]",
                    homeWins ? "text-white" : "text-white/45",
                  )}
                >
                  {g.home.runs}
                </span>
              </p>
              <p
                className={cn(
                  "mt-1.5 inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] sm:mt-2.5 sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[10px] sm:tracking-[0.16em]",
                  g.live || /warmup/i.test(g.status) ? "bg-alert/90 text-ink" : "bg-white/10 text-[#c8cdd8]",
                )}
              >
                {g.live || /warmup/i.test(g.status) ? (
                  <>
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-ink" />
                    <span className="truncate">{g.inning || g.status || "Live"}</span>
                  </>
                ) : g.status === "Final" ? (
                  "Final"
                ) : (
                  <span className="truncate">{g.inning || g.status}</span>
                )}
              </p>
            </>
          )}
        </div>
        <EspnTeam
          side={g.home}
          align="right"
          winner={homeWins}
          loser={awayWins}
          form={homeForm.data ?? null}
          showForm={pregameClock}
        />
      </div>

      {showLiveMatchup && g.situation ? (
        <MlbLiveMatchupPanel game={g} situation={g.situation} />
      ) : g.live && g.situation ? (
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
  form,
  showForm = false,
}: {
  side: MlbBoxscoreSide;
  align: "left" | "right";
  winner?: boolean;
  loser?: boolean;
  form?: TeamFormStrip | null;
  showForm?: boolean;
}) {
  return (
    <Link
      to={teamPagePath(side.teamId)}
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center gap-1.5 transition hover:opacity-90 sm:gap-2.5",
        align === "left" ? "sm:items-start" : "sm:items-end",
        loser && "opacity-70",
      )}
    >
      <TeamMark
        teamId={side.teamId}
        size="md"
        className={cn(
          "shadow-[0_8px_28px_rgba(0,0,0,0.45)] sm:!h-16 sm:!w-16 sm:!p-2",
          winner && "ring-2 ring-white/35",
        )}
      />
      <div
        className={cn(
          "w-full min-w-0 max-w-full text-center",
          align === "left" ? "sm:text-left" : "sm:text-right",
        )}
      >
        <p
          className={cn(
            "truncate text-[15px] font-bold tracking-wide sm:text-[22px]",
            winner ? "text-white" : loser ? "text-white/55" : "text-white",
          )}
        >
          {side.abbrev}
        </p>
        {side.record ? (
          <p className="numeral mt-0.5 truncate text-[11px] font-medium text-white/70 sm:mt-1 sm:text-[13px]">
            {side.record}
          </p>
        ) : (
          <p className="mt-0.5 truncate text-[10px] text-[#8b93a7] sm:mt-1 sm:text-[11px]">{side.name}</p>
        )}
        <TeamStandingLine standing={form?.standing} className="truncate" />
        {showForm ? (
          <TeamFormChips
            form={form}
            className="mt-1.5 max-w-full sm:w-[9rem]"
            align={align === "right" ? "right" : "left"}
          />
        ) : null}
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
  watchPlayerIds,
  taggedPlayerIds,
}: {
  away: MlbBoxscoreSide;
  home: MlbBoxscoreSide;
  awayStats: MlbPitcherSeasonLine | null;
  homeStats: MlbPitcherSeasonLine | null;
  loading: boolean;
  watchPlayerIds?: Set<number>;
  taggedPlayerIds?: Set<number>;
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
                const watchKind =
                  id != null ? playerWatchKind(id, watchPlayerIds, taggedPlayerIds) : null;
                return (
                  <tr key={`${side.abbrev}-${id ?? label}`} className="border-t border-white/[0.05]">
                    <td className="px-3 py-2.5 text-left">
                      {id ? (
                        <Link
                          to={`/sports/mlb/player/${id}`}
                          className="inline-flex items-center gap-1.5 font-semibold text-accent hover:underline"
                        >
                          {label}
                          <PlayerWatchMark kind={watchKind} />
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
  watchPlayerIds,
  taggedPlayerIds,
}: {
  awayAbbrev: string;
  homeAbbrev: string;
  away: MlbLineupHitter[];
  home: MlbLineupHitter[];
  watchPlayerIds?: Set<number>;
  taggedPlayerIds?: Set<number>;
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
            {rows.map((h) => {
              const watchKind = playerWatchKind(h.id, watchPlayerIds, taggedPlayerIds);
              return (
                <tr
                  key={h.id}
                  className={cn(
                    "border-t border-white/[0.05]",
                    watchKind === "favorite" && "bg-accent/[0.06]",
                    watchKind === "tagged" && "bg-[#7eb6ff]/[0.06]",
                  )}
                >
                  <td className="px-3 py-2.5 text-left">
                    <Link
                      to={`/sports/mlb/player/${h.id}`}
                      className="inline-flex items-center gap-1.5 font-semibold text-accent hover:underline"
                    >
                      {h.shortName}
                      <PlayerWatchMark kind={watchKind} />
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
              );
            })}
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
  watchPlayerIds,
  taggedPlayerIds,
}: {
  awayAbbrev: string;
  homeAbbrev: string;
  batting: MlbPreviewLeaderRow[];
  pitching: MlbPreviewLeaderRow[];
  watchPlayerIds?: Set<number>;
  taggedPlayerIds?: Set<number>;
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
                watchKind={
                  row.away
                    ? playerWatchKind(row.away.id, watchPlayerIds, taggedPlayerIds)
                    : null
                }
              />
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/25">
                {row.statLabel}
              </span>
              <LeaderSide
                side={row.home}
                abbrev={homeAbbrev}
                align="right"
                statLabel={row.statLabel}
                watchKind={
                  row.home
                    ? playerWatchKind(row.home.id, watchPlayerIds, taggedPlayerIds)
                    : null
                }
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
  watchKind,
}: {
  side: MlbPreviewLeaderRow["away"];
  abbrev: string;
  align: "left" | "right";
  statLabel: string;
  watchKind?: PlayerWatchKind | null;
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
        <p className="inline-flex items-center gap-1.5 truncate text-[13px] font-semibold text-cream">
          {side.shortName}
          <PlayerWatchMark kind={watchKind ?? null} />
        </p>
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
  suppressHeader = false,
  favoriteIds,
  taggedIds,
}: {
  recap: MlbGameRecap;
  box: {
    away: MlbBoxscoreSide;
    home: MlbBoxscoreSide;
  };
  defaultOpen?: boolean;
  suppressHeader?: boolean;
  favoriteIds?: Set<number>;
  taggedIds?: Set<number>;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [segments, setSegments] = useState<RecapInline[]>([]);

  const contentFilters = useQuery({
    queryKey: ["rss-filters"],
    queryFn: fetchRssFilters,
    staleTime: 60_000,
  });
  const hidePhrases = useMemo(
    () => contentHidePhrases(contentFilters.data ?? []),
    [contentFilters.data],
  );

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
  // Always show wrap copy when present — collapsed clamps were reading as "missing" on mobile.
  const effectiveOpen = open || !long;

  const rendered = (
    <SelectableHighlightRegion
      articleUrl={recap.url || `app:mlb-game/${recap.espnEventId ?? "wrap"}`}
      articleTitle={recap.headline || "Game wrap"}
      feedUrl="synthetic:mlb-wraps"
      className={cn(
        "font-rss text-[15px] leading-[1.75] text-[#d5dae6] [&_mark.rss-hl]:bg-accent/35 [&_mark.rss-hl]:text-cream",
        !effectiveOpen && long && "line-clamp-[12]",
      )}
    >
      <RecapBody
        segments={
          segments.length
            ? segments
            : storyText
              ? [{ kind: "text", text: storyText }]
              : desc
                ? [{ kind: "text", text: desc }]
                : [{ kind: "text", text: "Wrap text unavailable for this game." }]
        }
        hidePhrases={hidePhrases}
        favoriteIds={favoriteIds}
        taggedIds={taggedIds}
      />
    </SelectableHighlightRegion>
  );

  return (
    <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08] font-rss">
      {!suppressHeader ? (
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
      ) : showDesc ? (
        <div className="border-b border-white/[0.06] px-4 py-3">
          <p className="font-rss text-[14px] leading-relaxed text-[#c8cdd8]">{desc}</p>
        </div>
      ) : null}
      <div className="px-4 py-4">
        {rendered}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {long && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent hover:underline"
            >
              {effectiveOpen ? "Show less" : "Read full story"}
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

function RecapBody({
  segments,
  hidePhrases = [],
  favoriteIds,
  taggedIds,
}: {
  segments: RecapInline[];
  hidePhrases?: string[];
  favoriteIds?: Set<number>;
  taggedIds?: Set<number>;
}) {
  const linkClass =
    "font-semibold text-accent underline-offset-[3px] transition hover:underline";

  const needles = hidePhrases
    .map((p) => p.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim())
    .filter((p) => p.length >= 3);

  const visible = segments
    .map((seg) => {
      if (seg.kind !== "text" && seg.kind !== "ext") return seg;
      const norm = seg.text
        .toLowerCase()
        .replace(/['’]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      // Drop the whole segment when it is (or mostly is) a hide phrase,
      // or when a short chrome line contains the phrase.
      if (
        needles.some(
          (n) =>
            norm === n ||
            (norm.includes(n) && (norm.length <= n.length + 80 || norm.length < 160)),
        )
      ) {
        return null;
      }
      if (seg.kind === "text") {
        let text = seg.text
          .replace(/\bSee AP['’]?s full MLB coverage here\.?/gi, "")
          .replace(/\bSee AP['’]?s full MLB coverage\.?/gi, "")
          .replace(/\bShare on X\b[^.]*\.?/gi, "")
          .replace(/\bEmail a link to a friend\b[^.]*\.?/gi, "")
          .replace(/\(\s*Opens in new window\s*\)/gi, "")
          .replace(/\bSports\s*MLB\s*[A-Za-z ]+/gi, "");
        // Strip hide phrases embedded mid-paragraph.
        for (const n of needles) {
          if (n.length < 3) continue;
          const re = new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"), "ig");
          text = text.replace(re, " ");
        }
        text = text.replace(/[^\S\n]{2,}/g, " ");
        if (!/[^\s]/.test(text)) return null;
        // Keep a single edge space so linked names don't glue to neighbors.
        const lead = /^\s/.test(text) ? " " : "";
        const trail = /\s$/.test(text) ? " " : "";
        return { ...seg, text: `${lead}${text.trim()}${trail}` };
      }
      return seg;
    })
    .filter((s): s is RecapInline => s != null);

  // Split on paragraph breaks preserved in text segments.
  // Keep edge spaces — trim() was gluing linked names into neighboring words.
  const paragraphs: RecapInline[][] = [[]];
  for (const seg of visible) {
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
                  <span key={i} className="inline">
                    <Link to={`/sports/mlb/player/${seg.playerId}`} className={linkClass}>
                      {seg.text}
                    </Link>
                    <PlayerWatchMark
                      kind={playerWatchKind(seg.playerId, favoriteIds, taggedIds)}
                    />
                  </span>
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
      <td className="sticky left-0 z-[1] bg-[#0a1424] px-2 py-2 text-left text-[12px] font-semibold text-white sm:px-3">
        <Link
          to={teamPagePath(side.teamId)}
          className="inline-flex items-center gap-1.5 hover:text-accent hover:underline sm:gap-2"
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

/** Prefer boxscore season totals; fall back to `(W, 12-4)` / `(S, 30)` in the note. */
function pitcherSeasonRecord(p: MlbBoxscorePitcher): {
  wins: number | null;
  losses: number | null;
  saves: number | null;
} {
  let wins = p.seasonWins;
  let losses = p.seasonLosses;
  let saves = p.seasonSaves;
  const note = p.note ?? "";
  if (wins == null || losses == null) {
    const wl = note.match(/\(\s*[WL]\s*,\s*(\d+)\s*-\s*(\d+)\s*\)/i);
    if (wl) {
      wins = wins ?? Number(wl[1]);
      losses = losses ?? Number(wl[2]);
    }
  }
  if (saves == null) {
    const sv = note.match(/\(\s*S\s*,\s*(\d+)\s*\)/i);
    if (sv) saves = Number(sv[1]);
  }
  return {
    wins: wins != null && Number.isFinite(wins) ? wins : null,
    losses: losses != null && Number.isFinite(losses) ? losses : null,
    saves: saves != null && Number.isFinite(saves) ? saves : null,
  };
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
  taggedPlayerIds,
  prospectRanks,
  awayForm,
  homeForm,
  afterLinescore,
}: {
  game: MlbBoxscore;
  metaBits: (string | null)[];
  watchPlayerIds?: Set<number>;
  taggedPlayerIds?: Set<number>;
  prospectRanks?: MlbProspectRankMaps;
  awayForm?: TeamFormStrip | null;
  homeForm?: TeamFormStrip | null;
  /** Inserted below linescore / decisions (e.g. game wrap). */
  afterLinescore?: ReactNode;
}) {
  const decisions = useMemo(() => {
    const all = [...game.away.pitchers, ...game.home.pitchers];
    const find = (code: "W" | "L" | "S") =>
      all.find((p) => pitcherDecision(p.note) === code) ?? null;
    return { win: find("W"), loss: find("L"), save: find("S") };
  }, [game]);

  return (
    <div className="w-full max-w-full min-w-0 space-y-4">
      <div className="w-full max-w-full min-w-0 overflow-hidden rounded-xl border border-white/[0.1] bg-[#0a1424]">
        <div
          className="w-full max-w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] [touch-action:pan-x_pan-y]"
        >
          <table className="w-max min-w-full text-center text-[11px] sm:text-[12px]">
            <thead>
              <tr className="bg-white/[0.03] text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                <th className="sticky left-0 z-[1] bg-[#0a1424] px-2 py-2 text-left font-medium sm:px-3"> </th>
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
            ).map(([label, p]) => {
              const season = p ? pitcherSeasonRecord(p) : null;
              const recordBits: string[] = [];
              if (season && season.wins != null && season.losses != null) {
                recordBits.push(`${season.wins}-${season.losses}`);
              }
              if (label === "SAVE" && season?.saves != null) {
                recordBits.push(`${season.saves} SV`);
              } else if (
                label !== "SAVE" &&
                season?.saves != null &&
                season.saves > 0
              ) {
                recordBits.push(`${season.saves} SV`);
              }
              return (
                <div key={label} className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
                    {label}
                  </p>
                  {p ? (
                    <div className="mt-1.5 flex min-w-0 items-start gap-2">
                      <PlayerHeadshot
                        playerId={p.id}
                        size={213}
                        className="h-9 w-9 shrink-0 rounded-full ring-1 ring-white/15"
                        alt=""
                      />
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/sports/mlb/player/${p.id}`}
                          className="inline-flex max-w-full items-center gap-1 truncate text-[13px] font-semibold text-accent hover:underline"
                        >
                          {shortPitcherName(p.name)}
                          <PlayerWatchMark
                            kind={playerWatchKind(p.id, watchPlayerIds, taggedPlayerIds)}
                          />
                        </Link>
                        {recordBits.length > 0 ? (
                          <p className="numeral mt-0.5 text-[11px] font-semibold text-cream/85">
                            {recordBits.join(" · ")}
                          </p>
                        ) : null}
                        <p className="numeral mt-0.5 break-words text-[10px] leading-snug text-[#a8b0c2] sm:text-[11px]">
                          {p.ip} IP · {p.h} H · {p.er} ER · {p.so} K · {p.bb} BB
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-0.5 text-[13px] text-[#6b7386]">—</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {metaBits.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 border-t border-white/[0.07] px-3 py-3 text-[11px] leading-snug text-[#a8b0c2] sm:gap-x-4 sm:px-4 sm:text-[11.5px]">
            {metaBits.map((bit) => (
              <span key={String(bit)} className="max-w-full break-words">
                {bit}
              </span>
            ))}
          </div>
        )}
      </div>

      <TopPerformersSummary
        game={game}
        favoriteIds={watchPlayerIds}
        taggedIds={taggedPlayerIds}
      />

      <TopProspectsInGame game={game} prospectRanks={prospectRanks} />

      {afterLinescore}

      <TeamBoxSection
        side={game.away}
        watchPlayerIds={watchPlayerIds}
        taggedPlayerIds={taggedPlayerIds}
        prospectRanks={prospectRanks}
        form={awayForm}
      />
      <TeamBoxSection
        side={game.home}
        watchPlayerIds={watchPlayerIds}
        taggedPlayerIds={taggedPlayerIds}
        prospectRanks={prospectRanks}
        form={homeForm}
      />
    </div>
  );
}

function TopProspectsInGame({
  game,
  prospectRanks,
}: {
  game: MlbBoxscore;
  prospectRanks?: MlbProspectRankMaps;
}) {
  const prospects = useMemo(() => {
    if (!prospectRanks) return [];
    type Row = {
      id: number;
      name: string;
      teamId: number;
      teamAbbrev: string;
      position: string | null;
      orgRank: number | null;
      top100Rank: number | null;
      orgClubId: number | null;
    };
    const byId = new Map<number, Row>();
    const consider = (
      id: number,
      name: string,
      teamId: number,
      teamAbbrev: string,
      position: string | null,
    ) => {
      const { orgRank, top100Rank, orgClubId } = prospectRanksFor(prospectRanks, id);
      if ((orgRank == null || orgRank <= 0) && (top100Rank == null || top100Rank <= 0)) return;
      byId.set(id, {
        id,
        name,
        teamId,
        teamAbbrev,
        position,
        orgRank,
        top100Rank,
        orgClubId: orgClubId ?? null,
      });
    };
    for (const side of [game.away, game.home]) {
      for (const b of side.batters) {
        consider(b.id, b.name, side.teamId, side.abbrev, b.position);
      }
      for (const p of side.pitchers) {
        consider(p.id, p.name, side.teamId, side.abbrev, "P");
      }
    }
    return [...byId.values()].sort((a, b) => {
      const aTop = a.top100Rank ?? 999;
      const bTop = b.top100Rank ?? 999;
      if (aTop !== bTop) return aTop - bTop;
      const aOrg = a.orgRank ?? 999;
      const bOrg = b.orgRank ?? 999;
      return aOrg - bOrg || a.name.localeCompare(b.name);
    });
  }, [game, prospectRanks]);

  if (!prospects.length) return null;

  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.1] bg-[#0a1424]">
      <div className="border-b border-white/[0.07] px-4 py-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b93a7]">
          Top prospects in this game
        </h2>
      </div>
      <ul className="divide-y divide-white/[0.06]">
        {prospects.map((p) => {
          const labels = prospectRankLabels({
            orgRank: p.orgRank,
            top100Rank: p.top100Rank,
            orgClubId: p.orgClubId,
          });
          return (
            <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
              <PlayerHeadshot
                playerId={p.id}
                size={213}
                className="h-9 w-9 shrink-0 rounded-full ring-1 ring-white/15"
                alt=""
              />
              <div className="min-w-0 flex-1">
                <Link
                  to={`/sports/mlb/player/${p.id}`}
                  className="text-cream inline-flex flex-wrap items-center gap-1.5 text-[14px] font-semibold hover:text-accent hover:underline"
                >
                  {labels.map((label) => (
                    <span key={label} className="text-accent numeral text-[11px] font-bold">
                      {label}
                    </span>
                  ))}
                  {p.name}
                </Link>
                <p className="text-[11px] text-[#8b93a7]">
                  {p.teamAbbrev}
                  {p.position ? ` · ${p.position}` : ""}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PlayerWatchMark({ kind }: { kind: PlayerWatchKind | null }) {
  if (kind === "favorite") {
    return (
      <Star
        size={12}
        className="ml-0.5 inline text-[#f0b429] fill-current align-[-0.05em]"
        aria-label="Favorite"
      />
    );
  }
  if (kind === "tagged") {
    return (
      <span
        className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-violet-400/20 text-violet-200 align-[-0.05em]"
        title="Watch / tagged"
        aria-label="Tagged"
      >
        <Eye size={9} strokeWidth={2.6} />
      </span>
    );
  }
  return null;
}

function parseIpOuts(ip: string): number {
  const m = String(ip ?? "0").trim().match(/^(\d+)(?:\.(\d))?$/);
  if (!m) return 0;
  const innings = Number(m[1]) || 0;
  const partial = Number(m[2]) || 0;
  return innings * 3 + Math.min(partial, 2);
}

/** Boxscore batter impact score (higher = bigger game). */
function batterGameScore(b: MlbBoxscoreBatter): number {
  return Math.max(0, 40 + 3 * b.hr + 2 * b.h + 2 * b.rbi + b.r + b.bb - b.so);
}

/** Bill James pitching game score from boxscore line. */
function pitcherGameScore(p: MlbBoxscorePitcher): number {
  return 50 + parseIpOuts(p.ip) + p.so - 2 * p.h - 4 * p.er - 2 * p.bb;
}

function GameScoreBadge({ score, title }: { score: number; title: string }) {
  return (
    <div
      className="shrink-0 rounded-md border border-white/[0.1] bg-white/[0.04] px-1.5 py-1 text-center"
      title={title}
    >
      <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">GS</p>
      <p className="numeral text-[12px] font-bold leading-none text-cream sm:text-[13px]">{score}</p>
    </div>
  );
}

function pitcherRoleLabel(p: MlbBoxscorePitcher): string {
  if (p.started) return "SP";
  const decision = pitcherDecision(p.note);
  if (decision === "S") return "CL";
  return "RP";
}

function TopPerformersSummary({
  game,
  favoriteIds,
  taggedIds,
}: {
  game: MlbBoxscore;
  favoriteIds?: Set<number>;
  taggedIds?: Set<number>;
}) {
  const batters = [...game.away.batters, ...game.home.batters];
  const pitchers = [...game.away.pitchers, ...game.home.pitchers];
  if (!batters.length && !pitchers.length) return null;

  // Old selection: top 3 batters by boxscore impact + the win pitcher (else best arm).
  const batterPickScore = (b: MlbBoxscoreBatter) => b.h * 2 + b.rbi * 2 + b.hr * 3 + b.r;
  const topBatters = [...batters]
    .filter((b) => batterPickScore(b) > 0)
    .sort((a, b) => batterPickScore(b) - batterPickScore(a))
    .slice(0, 3);
  const topPitcher =
    pitchers.find((p) => pitcherDecision(p.note) === "W") ??
    [...pitchers].sort((a, b) => b.so - a.so || Number(b.ip) - Number(a.ip))[0] ??
    null;

  type Performer = {
    key: string;
    id: number;
    name: string;
    teamAbbrev: string;
    role: string;
    line: string;
    gs: number;
    title: string;
  };

  const rows: Performer[] = [
    ...topBatters.map((b) => ({
      key: `bat-${b.id}`,
      id: b.id,
      name: b.name,
      teamAbbrev: b.teamAbbrev,
      role: b.position || "—",
      line: [
        b.h ? `${b.h} H` : null,
        b.hr ? `${b.hr} HR` : null,
        b.rbi ? `${b.rbi} RBI` : null,
        b.r ? `${b.r} R` : null,
        b.bb ? `${b.bb} BB` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      gs: batterGameScore(b),
      title: "Batter game score from this box score",
    })),
    ...(topPitcher
      ? [
          {
            key: `pit-${topPitcher.id}`,
            id: topPitcher.id,
            name: topPitcher.name,
            teamAbbrev: topPitcher.teamAbbrev,
            role: pitcherRoleLabel(topPitcher),
            line: [
              `${topPitcher.ip} IP`,
              `${topPitcher.h} H`,
              `${topPitcher.er} ER`,
              `${topPitcher.so} K`,
              topPitcher.bb ? `${topPitcher.bb} BB` : null,
              pitcherDecision(topPitcher.note) === "W"
                ? "W"
                : pitcherDecision(topPitcher.note) === "S"
                  ? "SV"
                  : null,
            ]
              .filter(Boolean)
              .join(" · "),
            gs: pitcherGameScore(topPitcher),
            title: "Bill James pitching game score",
          } satisfies Performer,
        ]
      : []),
  ];

  // Display order: highest GS among the selected performers.
  const top = [...rows].sort((a, b) => b.gs - a.gs || a.name.localeCompare(b.name));

  if (!top.length) return null;

  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.1] bg-[#0a1424]">
      <div className="border-b border-white/[0.07] px-4 py-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
          Top performers
        </h3>
      </div>
      <ul className="divide-y divide-white/[0.06]">
        {top.map((row) => (
          <li key={row.key} className="flex items-center gap-3 px-4 py-2.5">
            <PlayerHeadshot
              playerId={row.id}
              size={213}
              className="h-10 w-10 shrink-0 rounded-full ring-1 ring-white/15"
              alt=""
            />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                <Link
                  to={`/sports/mlb/player/${row.id}`}
                  className="inline-flex max-w-full items-center gap-1.5 truncate text-[13px] font-semibold text-accent hover:underline"
                >
                  <span className="truncate">{row.name}</span>
                  <PlayerWatchMark kind={playerWatchKind(row.id, favoriteIds, taggedIds)} />
                </Link>
                <span className="numeral shrink-0 text-[11px] text-[#a8b0c2]">
                  · {row.teamAbbrev} · {row.role}
                </span>
              </div>
              {row.line ? (
                <p className="numeral mt-0.5 text-[11px] text-[#a8b0c2]">{row.line}</p>
              ) : null}
            </div>
            <GameScoreBadge score={row.gs} title={row.title} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function TeamBoxSection({
  side,
  watchPlayerIds,
  taggedPlayerIds,
  prospectRanks,
  form,
}: {
  side: MlbBoxscoreSide;
  watchPlayerIds?: Set<number>;
  taggedPlayerIds?: Set<number>;
  prospectRanks?: MlbProspectRankMaps;
  form?: TeamFormStrip | null;
}) {
  const battingNotes = useMemo(() => {
    const notes: { label: string; text: string }[] = [];
    const hrs = side.batters.filter((b) => b.hr > 0);
    if (hrs.length) {
      notes.push({
        label: "HR",
        text: hrs
          .map((b) => {
            const season = b.seasonHr != null && b.seasonHr > 0 ? b.seasonHr : b.hr;
            return `${shortPitcherName(b.name)} (${season})`;
          })
          .join(", "),
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
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
        <TeamMark teamId={side.teamId} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <Link
              to={teamPagePath(side.teamId)}
              className="text-[14px] font-bold tracking-wide text-white hover:text-accent hover:underline"
            >
              {side.name}
            </Link>
            {side.record && (
              <span className="numeral text-[12px] text-[#8b93a7]">{side.record}</span>
            )}
          </div>
          <TeamStandingLine standing={form?.standing} className="text-[#8b93a7]" />
        </div>
        <TeamFormChips form={form} className="w-[13rem] shrink-0" />
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
              <BatterRow
                key={b.id}
                b={b}
                zebra={i % 2 === 1}
                watchKind={playerWatchKind(b.id, watchPlayerIds, taggedPlayerIds)}
                prospectRanks={prospectRanksFor(prospectRanks, b.id)}
              />
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
                <PitcherRow
                  key={p.id}
                  p={p}
                  watchKind={playerWatchKind(p.id, watchPlayerIds, taggedPlayerIds)}
                  prospectRanks={prospectRanksFor(prospectRanks, p.id)}
                />
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
  watchKind,
  prospectRanks,
}: {
  b: MlbBoxscoreBatter;
  zebra?: boolean;
  watchKind?: PlayerWatchKind | null;
  prospectRanks?: { orgRank: number | null; top100Rank: number | null };
}) {
  const labels = prospectRankLabels(prospectRanks ?? { orgRank: null, top100Rank: null });
  return (
    <tr className={cn("border-t border-white/[0.04]", zebra && "bg-white/[0.02]")}>
      <td className="px-3 py-1.5">
        <Link
          to={`/sports/mlb/player/${b.id}`}
          className="text-cream inline-flex flex-wrap items-center gap-1 hover:text-accent hover:underline"
        >
          {labels.map((label) => (
            <span key={label} className="text-accent numeral text-[10px] font-bold">
              {label}
            </span>
          ))}
          {b.name}
          <PlayerWatchMark kind={watchKind ?? null} />
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

function PitcherRow({
  p,
  watchKind,
  prospectRanks,
}: {
  p: MlbBoxscorePitcher;
  watchKind?: PlayerWatchKind | null;
  prospectRanks?: { orgRank: number | null; top100Rank: number | null };
}) {
  const labels = prospectRankLabels(prospectRanks ?? { orgRank: null, top100Rank: null });
  return (
    <tr className="border-t border-white/[0.04]">
      <td className="px-3 py-1.5">
        <Link
          to={`/sports/mlb/player/${p.id}`}
          className="text-cream inline-flex flex-wrap items-center gap-1 hover:text-accent hover:underline"
        >
          {labels.map((label) => (
            <span key={label} className="text-accent numeral text-[10px] font-bold">
              {label}
            </span>
          ))}
          {p.name}
          <PlayerWatchMark kind={watchKind ?? null} />
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

