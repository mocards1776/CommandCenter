import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, ChevronRight, ExternalLink, Loader2 } from "lucide-react";
import HighlightReel from "@/components/sports/HighlightReel";
import SportsNotesPanel from "@/components/sports/SportsNotesPanel";
import PlayerTagsPanel from "@/components/sports/PlayerTagsPanel";
import TeamMark from "@/components/sports/TeamMark";
import { SelectableHighlightRegion } from "@/components/rss/SelectableHighlightRegion";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import { useAuth } from "@/lib/auth-context";
import { isFavoritePlayer } from "@/lib/favorite-players";
import {
  buildAcquisitionStory,
  buildPlayerPerformanceSummary,
  careerHighLabels,
  fetchMlbPipelineScoutingReport,
  fetchMlbPlayer,
  fetchMlbPlayerBio,
  fetchMlbPlayerExtras,
  fetchMlbPlayerWar,
  mlbHeadshotFallbacks,
  fetchMlbPlayerGameLog,
  fetchMlbPlayerHighlights,
  fetchMlbPlayerLeagueRanks,
  fetchMlbPlayerRecent,
  fetchMlbPlayerSplits,
  fetchMlbPlayerTeamRanks,
  fetchMlbPlayerTransactions,
  clearPlayerContractCache,
  fetchPlayerBrief,
  fetchPlayerContract,
  fetchProspectRankMaps,
  playerNewsSourceLabel,
  preferServiceTime,
  prospectRankLabels,
  prospectRanksFor,
  teamPagePath,
  type MlbGameLogEntry,
  type MlbLeagueRank,
  type MlbPerformanceSummary,
  type MlbPlayerBrief,
  type MlbPlayerCard,
  type MlbPlayerLevel,
  type MlbPlayerNewsNote,
  type MlbPlayerSeasonRow,
  type MlbPlayerStatLine,
  type MlbSplitRow,
} from "@/lib/mlb";
import { cn, formatCentralDateTime, formatSportsDate, isPublishedTodayCentral } from "@/lib/utils";

export default function MlbPlayerPage() {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const goBack = useCallback(() => {
    const from = (location.state as { from?: string } | null)?.from;
    if (from) {
      navigate(from);
      return;
    }
    navigate(-1);
  }, [location.state, navigate]);

  const swipeRef = useSwipeBack(goBack);

  useEffect(() => {
    const st = (history.state as { mlbPlayer?: string } | null) ?? {};
    if (playerId && st.mlbPlayer !== playerId) {
      history.replaceState({ ...st, mlbPlayer: playerId }, "", window.location.href);
    }
  }, [playerId]);

  if (!playerId) {
    return <p className="text-alert p-6 text-[13px]">Missing player id</p>;
  }

  return (
    <div ref={swipeRef} className="mx-auto max-w-6xl space-y-6 p-4 md:p-7">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={goBack}
          className="text-chalk hover:text-cream flex items-center gap-2 text-[11px] uppercase tracking-[0.14em]"
        >
          <ArrowLeft size={14} /> Back
        </button>
      </div>
      <MlbPlayerDetail playerId={playerId} />
    </div>
  );
}

/** Full player page body — also embedded in Dispatch tag-feed articles. */
export function MlbPlayerDetail({ playerId }: { playerId: string }) {
  const { user } = useAuth();
  const [level, setLevel] = useState<MlbPlayerLevel | null>(null);

  const player = useQuery({
    queryKey: ["mlb-player-v5", playerId],
    queryFn: () => fetchMlbPlayer(playerId),
    enabled: Boolean(playerId),
    staleTime: 120_000,
  });

  const favQuery = useQuery({
    queryKey: ["favorite-player", user?.id, playerId],
    queryFn: () => isFavoritePlayer(user!.id, playerId!),
    enabled: Boolean(user?.id && playerId),
  });

  useEffect(() => {
    setLevel(null);
  }, [playerId]);

  const highlights = useQuery({
    queryKey: ["mlb-player-highlights", playerId, player.data?.teamId],
    queryFn: () =>
      fetchMlbPlayerHighlights(player.data!.id, player.data!.teamId, player.data!.name),
    enabled: Boolean(player.data),
    staleTime: 300_000,
  });

  const transactions = useQuery({
    queryKey: ["mlb-player-tx", playerId],
    queryFn: () => fetchMlbPlayerTransactions(Number(playerId)),
    enabled: Boolean(playerId),
    staleTime: 600_000,
  });

  const contract = useQuery({
    queryKey: [
      "mlb-player-contract-v11",
      playerId,
      player.data?.name,
      player.data?.useName,
      player.data?.firstName,
      player.data?.lastName,
    ],
    queryFn: () =>
      fetchPlayerContract(player.data!.name, {
        useName: player.data!.useName,
        firstName: player.data!.firstName,
        lastName: player.data!.lastName,
        mlbId: Number(playerId),
      }),
    enabled: Boolean(player.data?.name),
    staleTime: 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  const brief = useQuery({
    queryKey: ["mlb-player-brief-v2", player.data?.name],
    queryFn: () => fetchPlayerBrief(player.data!.name),
    enabled: Boolean(player.data?.name),
    staleTime: 300_000,
    retry: 1,
  });

  const scouting = useQuery({
    queryKey: ["mlb-pipeline-scouting", playerId],
    queryFn: () => fetchMlbPipelineScoutingReport(playerId),
    enabled: Boolean(playerId),
    staleTime: 30 * 60_000,
    retry: 1,
  });

  const prospectRanks = useQuery({
    queryKey: ["prospect-rank-maps", player.data?.teamId ?? 138],
    queryFn: () =>
      fetchProspectRankMaps({
        teamIds: [player.data?.teamId ?? 138, 138].filter(Boolean) as number[],
      }),
    enabled: Boolean(player.data),
    staleTime: 30 * 60_000,
  });

  const isPitcherPreview =
    Boolean(player.data) &&
    ((player.data!.pitching.length > 0 && player.data!.position === "P") ||
      player.data!.pitching.length > player.data!.hitting.length);
  const splitGroup = isPitcherPreview ? "pitching" : "hitting";

  const statsSportId =
    player.data == null
      ? null
      : (level ?? player.data.defaultLevel) === "minors"
        ? player.data.sportId && player.data.sportId !== 1
          ? player.data.sportId
          : 11
        : 1;

  const latestGame = useQuery({
    queryKey: ["mlb-player-latest-game", playerId, splitGroup, player.data?.season, statsSportId],
    queryFn: () =>
      fetchMlbPlayerGameLog(player.data!.id, splitGroup, 1, player.data!.season, statsSportId),
    enabled: Boolean(player.data),
    staleTime: 120_000,
  });

  const splits = useQuery({
    queryKey: ["mlb-player-splits", playerId, splitGroup, player.data?.season, statsSportId],
    queryFn: () =>
      fetchMlbPlayerSplits(player.data!.id, splitGroup, player.data!.season, statsSportId),
    enabled: Boolean(player.data),
    staleTime: 120_000,
  });

  const last5 = useQuery({
    queryKey: ["mlb-player-last5", playerId, splitGroup, player.data?.season, statsSportId],
    queryFn: () =>
      fetchMlbPlayerRecent(player.data!.id, splitGroup, 5, player.data!.season, statsSportId),
    enabled: Boolean(player.data),
    staleTime: 120_000,
  });

  const last10 = useQuery({
    queryKey: ["mlb-player-last10", playerId, splitGroup, player.data?.season, statsSportId],
    queryFn: () =>
      fetchMlbPlayerRecent(player.data!.id, splitGroup, 10, player.data!.season, statsSportId),
    enabled: Boolean(player.data),
    staleTime: 120_000,
  });

  const ranks = useQuery({
    queryKey: ["mlb-player-ranks", playerId, splitGroup, player.data?.season],
    queryFn: () =>
      fetchMlbPlayerLeagueRanks(player.data!.id, splitGroup, player.data!.season),
    enabled: Boolean(player.data),
    staleTime: 300_000,
  });

  const teamRanks = useQuery({
    queryKey: [
      "mlb-player-team-ranks",
      playerId,
      player.data?.teamId,
      splitGroup,
      player.data?.season,
    ],
    queryFn: () =>
      fetchMlbPlayerTeamRanks(
        player.data!.id,
        player.data!.teamId!,
        splitGroup,
        player.data!.season,
      ),
    enabled: Boolean(player.data?.teamId),
    staleTime: 300_000,
  });

  const mlbBio = useQuery({
    queryKey: ["mlb-player-bio", playerId, player.data?.name],
    queryFn: () => fetchMlbPlayerBio(playerId, player.data!.name),
    enabled: Boolean(player.data?.name),
    staleTime: 24 * 60 * 60_000,
    retry: 1,
  });

  const war = useQuery({
    queryKey: [
      "mlb-player-war-v3",
      playerId,
      player.data?.name,
      player.data?.teamAbbrev,
      isPitcherPreview,
    ],
    queryFn: () =>
      fetchMlbPlayerWar(player.data!.name, {
        isPitcher: isPitcherPreview,
        mlbId: Number(playerId) || null,
        teamAbbrev: player.data!.teamAbbrev,
      }),
    enabled: Boolean(player.data?.name),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const extras = useQuery({
    queryKey: ["mlb-player-extras-v10", playerId, player.data?.name, player.data?.teamAbbrev, isPitcherPreview],
    queryFn: () =>
      fetchMlbPlayerExtras(player.data!.name, {
        isPitcher: isPitcherPreview,
        mlbId: Number(playerId) || null,
        teamAbbrev: player.data!.teamAbbrev,
      }),
    enabled: Boolean(player.data?.name),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  if (player.isPending) {
    return (
      <div className="text-chalk flex min-h-[40vh] items-center justify-center gap-2">
        <Loader2 size={18} className="animate-spin" />
        Loading player…
      </div>
    );
  }

  if (player.isError || !player.data) {
    return (
      <p className="text-alert text-[13px]">
        {player.error instanceof Error ? player.error.message : "Player not found"}
      </p>
    );
  }

  const p = player.data;
  const accent = `#${p.primaryColor ?? "d9515c"}`;
  const isFav = Boolean(favQuery.data);
  const activeLevel: MlbPlayerLevel = level ?? p.defaultLevel;
  const showLevelSelector = p.hasMlbStats && p.hasMinorsStats;
  const levelHitting = activeLevel === "minors" ? p.minorsHitting : p.mlbHitting;
  const levelPitching = activeLevel === "minors" ? p.minorsPitching : p.mlbPitching;
  const isPitcher =
    (levelPitching.length > 0 && p.position === "P") || levelPitching.length > levelHitting.length;
  const seasonStats = isPitcher ? levelPitching : levelHitting;
  const careerStats = isPitcher ? p.careerPitching : p.careerHitting;
  const yearRowsAll = isPitcher ? p.yearByYearPitching : p.yearByYearHitting;
  const yearRows = yearRowsAll.filter((r) =>
    activeLevel === "minors" ? r.sportId !== 1 : r.sportId === 1,
  );
  const mlbUrl = `https://www.mlb.com/player/${slugify(p.name)}-${p.id}`;
  const performance = buildPlayerPerformanceSummary({
    isPitcher,
    latest: latestGame.data?.[0],
    last5: last5.data,
  });
  const levelLabel =
    activeLevel === "minors"
      ? p.sportName && p.sportId !== 1
        ? p.sportName
        : "Minors"
      : "Major League";
  const resolvedSeasonWar =
    war.data?.seasonWar ?? extras.data?.seasonWar ?? contract.data?.seasonWar ?? null;
  const resolvedCareerWar =
    war.data?.careerWar ?? extras.data?.careerWar ?? contract.data?.careerWar ?? null;
  const resolvedServiceTime = preferServiceTime(
    extras.data?.serviceTime,
    contract.data?.serviceTime,
  );
  const warStillLoading =
    resolvedSeasonWar == null &&
    resolvedCareerWar == null &&
    (war.isPending || war.isFetching);
  const serviceStillLoading =
    !resolvedServiceTime &&
    ((extras.isPending || extras.isFetching) ||
      (contract.isPending || contract.isFetching));
  return (
    <div className="space-y-4 md:space-y-5">
      <div className="flex justify-end">
        <a
          href={mlbUrl}
          target="_blank"
          rel="noreferrer"
          className="text-chalk-dim/80 hover:text-chalk inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em]"
        >
          MLB.com <ExternalLink size={12} />
        </a>
      </div>

      <PlayerHeader
        player={p}
        accent={accent}
        isFavorite={isFav}
        serviceTime={resolvedServiceTime}
        extrasPending={serviceStillLoading && (extras.isPending || extras.isFetching)}
        contractPending={serviceStillLoading && (contract.isPending || contract.isFetching)}
        warPending={warStillLoading}
        salary={contract.data?.currentSalary?.display ?? null}
        salaryYear={contract.data?.currentSalary?.year ?? null}
        contractStatus={contract.data?.contractStatus ?? null}
        seasonWar={resolvedSeasonWar}
        careerWar={resolvedCareerWar}
        warRank={extras.data?.warRank ?? null}
        warOf={extras.data?.warOf ?? null}
        pipelineRank={scouting.data?.pipelineRank ?? null}
        prospectRankPair={prospectRanksFor(prospectRanks.data, p.id)}
        seasonStats={seasonStats}
        seasonRanks={activeLevel === "mlb" ? (ranks.data ?? []) : []}
        isPitcher={isPitcher}
        levelLabel={showLevelSelector ? levelLabel : undefined}
      />

      {showLevelSelector && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
            Level
          </p>
          <div className="inline-flex rounded-md border border-white/10 bg-black/20 p-0.5">
            {(
              [
                ["mlb", "Majors"],
                ["minors", p.sportName && p.sportId !== 1 ? p.sportName : "Minors"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setLevel(id)}
                className={cn(
                  "rounded-sm px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition",
                  activeLevel === id
                    ? "bg-accent/20 text-cream"
                    : "text-chalk hover:text-cream",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {(brief.data || brief.isPending || brief.isFetched) && (
        <PlayerNewsBriefCards
          playerId={p.id}
          playerName={p.name}
          brief={brief.data ?? null}
          loading={brief.isPending}
        />
      )}

      {performance && <PerformanceSummaryCard summary={performance} />}

      {seasonStats.length > 0 && (
        <StatTable
          title={`${p.season} ${showLevelSelector ? levelLabel : "Regular Season"}`}
          stats={seasonStats}
          accent={accent}
        />
      )}

      {(last5.data || last10.data) && (
        <div className="space-y-3">
          {last5.data && (
            <RecentGamesSection
              playerId={p.id}
              season={p.season}
              group={splitGroup}
              recent={last5.data}
              accent={accent}
              sportId={statsSportId}
            />
          )}
          {last10.data && (
            <RecentGamesSection
              playerId={p.id}
              season={p.season}
              group={splitGroup}
              recent={last10.data}
              accent={accent}
              sportId={statsSportId}
            />
          )}
        </div>
      )}

      {careerStats.length > 0 && (
        <StatTable title="Career Regular Season" stats={careerStats} accent={accent} />
      )}

      {yearRows.length > 0 && (
        <YearByYearTable
          title={showLevelSelector ? `Career by year · ${levelLabel}` : "Career by year"}
          rows={yearRows}
          isPitcher={isPitcher}
          season={p.season}
          leagueRanks={activeLevel === "mlb" ? (ranks.data ?? []) : []}
          teamRanks={activeLevel === "mlb" ? (teamRanks.data ?? []) : []}
        />
      )}
      {!isPitcher &&
        (activeLevel === "mlb" ? p.yearByYearPitching : p.yearByYearPitching).filter((r) =>
          activeLevel === "minors" ? r.sportId !== 1 : r.sportId === 1,
        ).length > 0 && (
          <YearByYearTable
            title="Pitching by year"
            rows={p.yearByYearPitching.filter((r) =>
              activeLevel === "minors" ? r.sportId !== 1 : r.sportId === 1,
            )}
            isPitcher
            season={p.season}
          />
        )}
      {isPitcher &&
        p.yearByYearHitting.filter((r) =>
          activeLevel === "minors" ? r.sportId !== 1 : r.sportId === 1,
        ).length > 0 && (
          <YearByYearTable
            title="Batting by year"
            rows={p.yearByYearHitting.filter((r) =>
              activeLevel === "minors" ? r.sportId !== 1 : r.sportId === 1,
            )}
            isPitcher={false}
            season={p.season}
          />
        )}

      {!isPitcher && levelPitching.length > 0 && (
        <StatTable title={`${p.season} Pitching`} stats={levelPitching} accent={accent} />
      )}
      {isPitcher &&
        levelHitting.length > 0 &&
        levelHitting.some((s) => s.label === "AB" || s.label === "G") && (
          <StatTable title={`${p.season} Batting`} stats={levelHitting} accent={accent} />
        )}

      {splits.isPending && (
        <p className="text-chalk-dim flex items-center gap-2 text-[12px]">
          <Loader2 size={14} className="animate-spin" /> Loading splits…
        </p>
      )}
      {(splits.data?.length ?? 0) > 0 && (
        <SplitsTable title={`${p.season} Splits`} rows={splits.data!} accent={accent} />
      )}

      <SportsNotesPanel entityType="player" entityId={p.id} entityName={p.name} />

      <ContractBlock
        contract={contract.data ?? null}
        loading={contract.isPending}
        error={contract.isError ? contract.error : null}
        onRetry={() => {
          clearPlayerContractCache(p.name);
          void contract.refetch();
        }}
        transactions={transactions.data ?? []}
        teamName={p.teamName}
        player={p}
      />

      {highlights.isPending && (
        <p className="text-chalk-dim flex items-center gap-2 text-[12px]">
          <Loader2 size={14} className="animate-spin" /> Loading highlights…
        </p>
      )}
      <HighlightReel highlights={highlights.data ?? []} title="Player highlights" defaultOpen={false} />

      {scouting.data ? (
        <ScoutingReportCard
          report={scouting.data}
          prospectRankPair={prospectRanksFor(prospectRanks.data, p.id)}
        />
      ) : null}

      <PlayerTagsPanel
        playerId={p.id}
        playerName={p.name}
        variant="panel"
        isFavorite={isFav}
        teamName={p.teamName}
        teamId={p.teamId}
        position={p.position}
      />

      <BioAndOrigin player={p} />

      {(() => {
        const bio = mlbBio.data;
        if (!bio?.text && !mlbBio.isPending) return null;
        return (
          <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="rule-head">Bio</h3>
              {bio?.url && (
                <a
                  href={bio.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-chalk-dim hover:text-cream text-[10px] uppercase tracking-[0.12em]"
                >
                  MLB.com
                </a>
              )}
            </div>
            {mlbBio.isPending && !bio?.text ? (
              <p className="text-chalk-dim flex items-center gap-2 text-[12px]">
                <Loader2 size={13} className="animate-spin" /> Loading bio…
              </p>
            ) : (
              <div className="space-y-2 text-[13px] leading-relaxed text-[#c8cdd8]">
                {(bio?.html || bio?.text || "")
                  .split(/\n{2,}/)
                  .map((para) => para.trim())
                  .filter(Boolean)
                  .slice(0, 16)
                  .map((para, i) =>
                    /^\d{4}$/.test(para) ? (
                      <p key={i} className="font-display pt-1 text-[18px] text-cream">
                        {para}
                      </p>
                    ) : (
                      <p key={i}>{para}</p>
                    ),
                  )}
              </div>
            )}
          </section>
        );
      })()}
    </div>
  );
}

function ScoutingReportCard({
  report,
  prospectRankPair,
}: {
  report: NonNullable<Awaited<ReturnType<typeof fetchMlbPipelineScoutingReport>>>;
  prospectRankPair?: { orgRank: number | null; top100Rank: number | null };
}) {
  const rankLabels = prospectRankLabels(
    prospectRankPair ?? {
      orgRank: report.pipelineRank,
      top100Rank: null,
    },
  );
  return (
    <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
          Scouting report
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {rankLabels.map((label) => (
            <span
              key={label}
              className="text-accent text-[11px] font-semibold uppercase tracking-[0.14em]"
            >
              {label}
            </span>
          ))}
          {report.eta ? (
            <span className="text-[11px] uppercase tracking-[0.12em] text-[#8b93a7]">
              ETA {report.eta}
            </span>
          ) : null}
        </div>
      </div>
      <div className="space-y-3 px-4 py-3">
        {report.gradesLine ? (
          <p className="text-cream text-[13.5px] leading-relaxed">
            <span className="font-semibold">Scouting grades: </span>
            {report.grades.length > 0
              ? report.grades.map((g, i) => (
                  <span key={g.label}>
                    {i > 0 ? " | " : null}
                    {g.label}: {g.value}
                  </span>
                ))
              : report.gradesLine}
          </p>
        ) : null}
        {report.paragraphs.map((para) => (
          <p key={para.slice(0, 48)} className="text-[13.5px] leading-relaxed text-[#c8cdd8]">
            {para}
          </p>
        ))}
        <a
          href={report.pipelineUrl}
          target="_blank"
          rel="noreferrer"
          className="text-accent inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] hover:underline"
        >
          Full report on MLB Pipeline <ExternalLink size={11} />
        </a>
      </div>
    </section>
  );
}

function PlayerNewsBriefCards({
  playerId,
  playerName,
  brief,
  loading,
}: {
  playerId: number;
  playerName: string;
  brief: MlbPlayerBrief | null;
  loading: boolean;
}) {
  const notes: MlbPlayerNewsNote[] =
    brief?.notes?.length
      ? brief.notes
      : brief?.headline || brief?.story
        ? [
            {
              source: brief.source || "rotowire",
              headline: brief.headline,
              story: brief.story,
              description: brief.description,
              published: brief.published,
              url: brief.url,
            },
          ]
        : [];

  if (loading) {
    return (
      <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
        <div className="border-b border-white/[0.06] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
            Player news
          </p>
        </div>
        <div className="text-chalk-dim flex items-center gap-2 px-4 py-3 text-[13px]">
          <Loader2 size={14} className="animate-spin" />
          Loading RotoWire & RotoWorld…
        </div>
      </section>
    );
  }

  if (!notes.length) {
    return (
      <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
        <div className="border-b border-white/[0.06] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
            Player news
          </p>
        </div>
        <p className="text-chalk-dim px-4 py-3 text-[13px]">
          No RotoWire or RotoWorld note available right now.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-3">
      {notes.map((note) => (
        <PlayerNewsNoteCard
          key={`${note.source}-${note.published ?? ""}-${note.headline ?? ""}`}
          playerId={playerId}
          playerName={playerName}
          note={note}
        />
      ))}
    </div>
  );
}

function PlayerNewsNoteCard({
  playerId,
  playerName,
  note,
}: {
  playerId: number;
  playerName: string;
  note: MlbPlayerNewsNote;
}) {
  const articleUrl = `app:mlb-player/${playerId}`;
  const label = playerNewsSourceLabel(note.source);
  const isNew = isPublishedTodayCentral(note.published);
  const publishedLabel = note.published ? formatCentralDateTime(note.published) : null;
  return (
    <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
      <div className="border-b border-white/[0.06] flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
            {label}
          </p>
          {isNew ? (
            <span className="rounded-sm bg-accent/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-accent">
              New
            </span>
          ) : null}
        </div>
        {note.url ? (
          <a
            href={note.url}
            target="_blank"
            rel="noreferrer"
            className="text-chalk-dim hover:text-chalk inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em]"
          >
            Source <ExternalLink size={12} />
          </a>
        ) : null}
      </div>
      <div className="px-4 py-3">
        <SelectableHighlightRegion
          articleUrl={articleUrl}
          articleTitle={`${playerName}: ${note.headline || label}`}
          feedUrl="synthetic:player-card"
          className="space-y-2"
        >
          {note.headline ? (
            <p className="text-cream text-[15px] font-medium leading-snug">{note.headline}</p>
          ) : null}
          {note.story ? (
            <p className="text-chalk text-[14px] leading-relaxed">{note.story}</p>
          ) : null}
          {publishedLabel ? (
            <p className="text-[11px] uppercase tracking-[0.12em] text-[#8b93a7]">
              {publishedLabel}
            </p>
          ) : null}
        </SelectableHighlightRegion>
      </div>
    </section>
  );
}

function PerformanceSummaryCard({ summary }: { summary: MlbPerformanceSummary }) {
  const tone =
    summary.latestIsWin === true
      ? "from-emerald-500/20 via-transparent to-transparent"
      : summary.latestIsWin === false
        ? "from-alert/20 via-transparent to-transparent"
        : "from-accent/15 via-transparent to-transparent";
  return (
    <section className="bg-panel relative overflow-hidden rounded-xl border border-white/[0.08]">
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", tone)} />
      <div className="relative border-b border-white/[0.06] flex items-center justify-between gap-3 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
          Recent
        </p>
        {summary.latestIsWin != null && (
          <span
            className={cn(
              "rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]",
              summary.latestIsWin
                ? "bg-emerald-400/15 text-emerald-300"
                : "bg-alert/15 text-alert",
            )}
          >
            {summary.latestIsWin ? "Win" : "Loss"}
          </span>
        )}
      </div>
      <div className="relative grid gap-0 sm:grid-cols-2">
        <div className="border-b border-white/[0.06] px-4 py-3.5 sm:border-r sm:border-b-0">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[#8b93a7]">
            {summary.latestTitle}
          </p>
          <p className="text-cream mt-1.5 text-[15px] font-medium leading-relaxed">
            {summary.latestLine}
          </p>
        </div>
        <div className="px-4 py-3.5">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[#8b93a7]">
            {summary.recentTitle}
          </p>
          <p className="text-cream mt-1.5 text-[15px] font-medium leading-relaxed">
            {summary.recentLine}
          </p>
        </div>
      </div>
    </section>
  );
}

function PlayerHeader({
  player,
  accent,
  isFavorite,
  serviceTime,
  extrasPending,
  contractPending,
  warPending,
  salary,
  salaryYear,
  contractStatus,
  seasonWar,
  careerWar,
  warRank,
  warOf,
  pipelineRank,
  prospectRankPair,
  seasonStats,
  seasonRanks,
  isPitcher,
  levelLabel,
}: {
  player: MlbPlayerCard;
  accent: string;
  isFavorite: boolean;
  serviceTime?: string | null;
  extrasPending?: boolean;
  contractPending?: boolean;
  warPending?: boolean;
  salary?: string | null;
  salaryYear?: string | null;
  contractStatus?: string | null;
  seasonWar?: number | null;
  careerWar?: number | null;
  warRank?: number | null;
  warOf?: number | null;
  pipelineRank?: number | null;
  prospectRankPair?: { orgRank: number | null; top100Rank: number | null };
  seasonStats: MlbPlayerStatLine[];
  seasonRanks: MlbLeagueRank[];
  isPitcher: boolean;
  levelLabel?: string;
}) {
  const htWt = [player.height, player.weight ? `${player.weight} lb` : null]
    .filter(Boolean)
    .join(" · ");
  const batThr =
    player.bats && player.throws ? `${player.bats}/${player.throws}` : player.bats ?? player.throws;
  const levelChip =
    player.sportAbbrev && player.sportId != null
      ? player.sportId === 1
        ? "MLB"
        : player.sportAbbrev
      : null;
  const school = player.school ?? player.draft?.school ?? null;
  const rankLabels = prospectRankLabels(
    prospectRankPair ?? { orgRank: pipelineRank ?? null, top100Rank: null },
  );

  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/[0.1] shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(145deg, #0a1428 0%, ${accent}40 42%, #07101f 100%)`,
        }}
      />
      <img
        src={player.heroBackdrop}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[center_20%] opacity-[0.28]"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#07101f] via-[#07101f]/75 to-[#07101f]/35" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#07101f] via-transparent to-[#07101f]/40" />

      <div className="relative z-10 flex flex-col gap-4 p-4 sm:gap-5 sm:p-5 md:flex-row md:items-end md:gap-6 md:p-6 lg:gap-8 lg:p-8">
        <div className="relative mx-auto shrink-0 sm:mx-0">
          <div className="overflow-hidden rounded-xl bg-[#dfe6f2] p-1 shadow-2xl ring-2 ring-white/30">
            <img
              src={player.headshot}
              alt=""
              width={220}
              height={220}
              className="h-[140px] w-[140px] rounded-[10px] object-cover object-[center_12%] sm:h-[170px] sm:w-[170px] md:h-[190px] md:w-[190px] lg:h-[220px] lg:w-[220px]"
              data-fallback-idx="0"
              onError={(e) => {
                const el = e.currentTarget;
                const idx = Number(el.dataset.fallbackIdx ?? "0");
                const chain = mlbHeadshotFallbacks(player.id, 426);
                const next = chain[idx + 1];
                if (next && el.src !== next) {
                  el.dataset.fallbackIdx = String(idx + 1);
                  el.src = next;
                }
              }}
            />
          </div>
          {player.teamId != null && (
            <span className="absolute -right-2 -bottom-2">
              <TeamMark teamId={player.teamId} size="md" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {player.teamId != null && player.teamName && (
                  <Link
                    to={teamPagePath(player.teamId)}
                    className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/70 transition hover:text-white"
                  >
                    {player.teamName}
                  </Link>
                )}
                {levelChip && (
                  <span className="rounded-sm border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                    {levelChip}
                  </span>
                )}
                {rankLabels.map((label) => (
                  <span
                    key={label}
                    className="rounded-sm border border-accent/40 bg-accent/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent"
                  >
                    {label}
                  </span>
                ))}
              </div>
              <p className="mt-1 text-[13px] font-medium uppercase tracking-[0.08em] text-white/65">
                {player.firstName}
              </p>
              <h1 className="font-display text-[40px] leading-[0.92] text-white sm:text-[52px] lg:text-[56px]">
                {player.lastName || player.name}
              </h1>
              {(player.number || player.position) && (
                <p className="mt-1.5 text-[13px] text-white/75">
                  {[player.number ? `#${player.number}` : null, player.position]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {player.age != null && (
                <div className="shrink-0 rounded-md border border-white/25 bg-black/35 px-3 py-2 text-center backdrop-blur-sm">
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/60">Age</p>
                  <p className="numeral text-[30px] leading-none text-white">{player.age}</p>
                </div>
              )}
              <div className="shrink-0 rounded-md border border-white/25 bg-black/35 px-3 py-2 text-center backdrop-blur-sm">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/60">WAR</p>
                <p className="numeral text-[26px] leading-none text-white">
                  {seasonWar != null
                    ? seasonWar.toFixed(1)
                    : careerWar != null
                      ? careerWar.toFixed(1)
                      : warPending
                        ? "…"
                        : "—"}
                </p>
                <p className="mt-0.5 text-[10px] text-white/55">
                  {warRank != null
                    ? `${warRank}${warOf != null ? `/${warOf}` : ""}`
                    : seasonWar != null && careerWar != null
                      ? `Career ${careerWar.toFixed(1)}`
                      : seasonWar != null
                        ? "Season"
                        : careerWar != null
                          ? "Career"
                          : warPending
                            ? "Loading"
                            : "N/A"}
                </p>
              </div>
            </div>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px] sm:mt-4 sm:gap-y-2.5 md:grid-cols-3 lg:grid-cols-2">
            {htWt && (
              <div>
                <dt className="text-[10px] uppercase tracking-[0.14em] text-white/50">HT / WT</dt>
                <dd className="mt-0.5 text-white">{htWt}</dd>
              </div>
            )}
            {batThr && (
              <div>
                <dt className="text-[10px] uppercase tracking-[0.14em] text-white/50">Bat / Thr</dt>
                <dd className="mt-0.5 text-white">{batThr}</dd>
              </div>
            )}
            <div>
              <dt className="text-[10px] uppercase tracking-[0.14em] text-white/50">
                Service time
              </dt>
              <dd className="mt-0.5 text-white">
                {serviceTime ??
                  (extrasPending || contractPending ? (
                    <span className="text-white/40">…</span>
                  ) : (
                    "—"
                  ))}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.14em] text-white/50">School</dt>
              <dd className="mt-0.5 text-white">{school ?? "—"}</dd>
            </div>
            {player.birthDate && (
              <div>
                <dt className="text-[10px] uppercase tracking-[0.14em] text-white/50">Birthdate</dt>
                <dd className="mt-0.5 text-white">
                  {formatSportsDate(player.birthDate)}
                  {player.age != null ? ` (${player.age})` : ""}
                </dd>
              </div>
            )}
            {player.mlbDebut && (
              <div>
                <dt className="text-[10px] uppercase tracking-[0.14em] text-white/50">MLB debut</dt>
                <dd className="mt-0.5 text-white">{formatSportsDate(player.mlbDebut)}</dd>
              </div>
            )}
            {(salary || contractStatus) && (
              <div>
                <dt className="text-[10px] uppercase tracking-[0.14em] text-white/50">
                  {salaryYear && salaryYear !== "Total" ? `${salaryYear} salary` : "Salary"}
                </dt>
                <dd className="mt-0.5 text-white">
                  {salary ?? "—"}
                  {contractStatus ? (
                    <span className="mt-0.5 block text-[11px] text-white/55">{contractStatus}</span>
                  ) : null}
                </dd>
              </div>
            )}
            {careerWar != null && (
              <div>
                <dt className="text-[10px] uppercase tracking-[0.14em] text-white/50">
                  Career WAR
                </dt>
                <dd className="numeral mt-0.5 text-white">{careerWar.toFixed(1)}</dd>
              </div>
            )}
            {player.birthPlace && (
              <div className="col-span-2">
                <dt className="text-[10px] uppercase tracking-[0.14em] text-white/50">Born</dt>
                <dd className="mt-0.5 text-white">{player.birthPlace}</dd>
              </div>
            )}
          </dl>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <PlayerTagsPanel
              playerId={player.id}
              playerName={player.name}
              variant="inline"
              isFavorite={isFavorite}
              teamName={player.teamName}
              teamId={player.teamId}
              position={player.position}
            />
          </div>

          {seasonStats.length > 0 && (
            <div className="mt-4">
              <SeasonStatsStrip
                season={player.season}
                stats={seasonStats}
                ranks={seasonRanks}
                isPitcher={isPitcher}
                levelLabel={levelLabel}
                embedded
              />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

type KeyStat = { label: string; value: string; rankLabel?: string };

function SeasonStatsStrip({
  season,
  stats,
  ranks,
  isPitcher,
  levelLabel,
  embedded = false,
}: {
  season: number;
  stats: MlbPlayerStatLine[];
  ranks: MlbLeagueRank[];
  isPitcher: boolean;
  levelLabel?: string;
  /** Render inside the hero card (dark translucent panel). */
  embedded?: boolean;
}) {
  const keyStats: KeyStat[] = isPitcher ? buildPitcherKeyStats(stats) : buildHitterKeyStats(stats);

  return (
    <section
      className={
        embedded
          ? "overflow-hidden rounded-lg border border-white/10 bg-black/30"
          : "bg-panel overflow-hidden rounded-xl border border-white/[0.08]"
      }
    >
      <div
        className={
          embedded
            ? "border-b border-white/10 px-3 py-2"
            : "border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5"
        }
      >
        <h2
          className={
            embedded
              ? "font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55"
              : "text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b93a7]"
          }
        >
          {season} Season Stats{levelLabel ? ` · ${levelLabel}` : ""}
        </h2>
      </div>
      <div className="grid grid-cols-2 divide-x divide-y divide-white/[0.08]">
        {keyStats.map((s) => {
          const rank = s.rankLabel ? findRank(ranks, s.rankLabel) : undefined;
          return (
            <div key={s.label} className={embedded ? "px-3 py-3.5" : "px-3 py-4 text-center"}>
              <p
                className={
                  embedded
                    ? "text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50"
                    : "text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]"
                }
              >
                {s.label}
              </p>
              <p
                className={
                  embedded
                    ? "numeral mt-1 text-[26px] leading-none text-white"
                    : "numeral text-cream mt-1 text-[26px] leading-none sm:text-[28px]"
                }
              >
                {s.value}
              </p>
              {rank && (
                <p
                  className={
                    embedded
                      ? "mt-1 text-[11px] font-medium text-white/55"
                      : "mt-1.5 text-[12px] font-medium text-[#b8c0d2]"
                  }
                >
                  {rank.display}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function buildHitterKeyStats(stats: MlbPlayerStatLine[]): KeyStat[] {
  const labels = ["AVG", "HR", "RBI", "OPS"] as const;
  return labels.map((label) => ({
    label,
    value: statValue(stats, label) ?? "—",
    rankLabel: label,
  }));
}

function buildPitcherKeyStats(stats: MlbPlayerStatLine[]): KeyStat[] {
  const wl = buildWL(stats);
  const items: KeyStat[] = [];
  if (wl) {
    items.push({ label: "W-L", value: wl, rankLabel: "W" });
  }
  for (const label of ["ERA", "SO", "WHIP"] as const) {
    items.push({
      label: label === "SO" ? "SO" : label,
      value: statValue(stats, label) ?? "—",
      rankLabel: label,
    });
  }
  while (items.length < 4) {
    items.push({ label: "—", value: "—" });
  }
  return items.slice(0, 4);
}

function RecentGamesSection({
  playerId,
  season,
  group,
  recent,
  accent,
  sportId,
}: {
  playerId: number;
  season: number;
  group: "hitting" | "pitching";
  recent: { label: string; games: number; stats: MlbPlayerStatLine[] };
  accent: string;
  sportId?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const limit = recent.label.includes("10") ? 10 : 5;

  const gameLog = useQuery({
    queryKey: ["mlb-player-gamelog", playerId, group, limit, season, sportId],
    queryFn: () => fetchMlbPlayerGameLog(playerId, group, limit, season, sportId),
    enabled: open,
    staleTime: 120_000,
  });

  return (
    <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3 text-left transition hover:bg-white/[0.02]"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          {open ? (
            <ChevronDown size={16} className="text-accent shrink-0" />
          ) : (
            <ChevronRight size={16} className="text-accent shrink-0" />
          )}
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
            {recent.label} ({recent.games} G)
          </span>
        </span>
        <span className="text-[10px] uppercase tracking-[0.14em] text-[#8b93a7]">
          {open ? "Hide game log" : "Show game log"}
        </span>
      </button>

      {!open && recent.stats.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-center text-[12px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                {recent.stats.map((s) => (
                  <th key={s.label} className="px-2 py-2 font-medium">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {recent.stats.map((s) => (
                  <td key={s.label} className="numeral text-cream px-2 py-2.5 text-[15px]">
                    {s.value}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <div className="p-2">
          {gameLog.isPending && (
            <p className="text-chalk-dim flex items-center justify-center gap-2 py-6 text-[12px]">
              <Loader2 size={14} className="animate-spin" /> Loading game log…
            </p>
          )}
          {gameLog.isError && (
            <p className="text-alert py-4 text-center text-[12px]">Couldn't load game log.</p>
          )}
          {(gameLog.data?.length ?? 0) > 0 && (
            <ul className="divide-y divide-white/[0.05]">
              {gameLog.data!.map((g) => (
                <GameLogRow key={`${g.gamePk}-${g.date}`} entry={g} />
              ))}
            </ul>
          )}
          {gameLog.data?.length === 0 && !gameLog.isPending && (
            <p className="text-chalk-dim py-4 text-center text-[12px]">No games in this stretch.</p>
          )}
        </div>
      )}
    </section>
  );
}

function GameLogRow({ entry }: { entry: MlbGameLogEntry }) {
  const oppLink = entry.opponentId != null ? teamPagePath(entry.opponentId) : null;
  const result =
    entry.isWin === true ? "W" : entry.isWin === false ? "L" : null;

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-2.5 text-[12px]">
      <span className="text-chalk-dim w-[72px] shrink-0 tabular-nums">{entry.date}</span>
      <span className="text-cream min-w-[88px]">
        {entry.isHome ? "vs" : "@"}{" "}
        {oppLink ? (
          <Link to={oppLink} className="hover:text-accent transition">
            {entry.opponent}
          </Link>
        ) : (
          entry.opponent
        )}
      </span>
      {result && (
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
            result === "W" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300",
          )}
        >
          {result}
        </span>
      )}
      <span className="text-chalk min-w-0 flex-1 truncate">{entry.summary || "—"}</span>
      {entry.gamePk > 0 && (
        <Link
          to={`/sports/mlb/game/${entry.gamePk}`}
          className="text-accent shrink-0 text-[10px] uppercase tracking-[0.12em] hover:underline"
        >
          Box score
        </Link>
      )}
    </li>
  );
}

function YearByYearTable({
  title,
  rows,
  isPitcher,
  season,
  leagueRanks = [],
  teamRanks = [],
}: {
  title: string;
  rows: MlbPlayerSeasonRow[];
  isPitcher: boolean;
  season?: number;
  leagueRanks?: MlbLeagueRank[];
  teamRanks?: MlbLeagueRank[];
}) {
  const labels = isPitcher
    ? ["W", "L", "ERA", "IP", "SO", "WHIP", "SV"]
    : ["G", "AB", "AVG", "HR", "RBI", "OPS", "SB"];
  const highs = careerHighLabels(rows, labels);
  const leagueLead = new Set(
    leagueRanks.filter((r) => r.rank === 1).map((r) => r.label),
  );
  const teamLead = new Set(teamRanks.filter((r) => r.rank === 1).map((r) => r.label));

  return (
    <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
      <div className="border-b border-white/[0.06] px-4 py-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
            {title}
          </h3>
          <p className="text-[10px] text-[#8b93a7]">
            <span className="font-bold text-cream">Bold</span> career high ·{" "}
            <span className="italic text-[#9ec1ff]">Team lead</span> ·{" "}
            <span className="font-bold text-alert">League lead</span>
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[12px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
              <th className="px-3 py-2 font-medium">Year</th>
              <th className="px-3 py-2 font-medium">Tm</th>
              {labels.map((l) => (
                <th key={l} className="px-2 py-2 text-center font-medium">
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const map = new Map(row.stats.map((s) => [s.label, s.value]));
              const current = season != null && row.season === season && row.sportId === 1;
              return (
                <tr
                  key={`${row.season}-${row.sportId}-${row.teamId ?? row.team}`}
                  className="border-t border-white/[0.05]"
                >
                  <td className="numeral text-cream px-3 py-2">{row.season}</td>
                  <td className="px-3 py-2 text-[#c8cdd8]">
                    {row.teamId != null ? (
                      <Link
                        to={teamPagePath(row.teamId)}
                        className="hover:text-cream hover:underline"
                      >
                        {row.team}
                      </Link>
                    ) : (
                      row.team
                    )}
                    {row.sportAbbrev && row.sportId !== 1 ? (
                      <span className="text-chalk-dim ml-1.5 text-[10px] uppercase tracking-[0.12em]">
                        {row.sportAbbrev}
                      </span>
                    ) : null}
                  </td>
                  {labels.map((l) => {
                    const value = map.get(l) ?? "—";
                    const key = `${row.season}:${row.teamId ?? row.team}:${l}`;
                    const isHigh = highs.has(key);
                    const isLeague = current && leagueLead.has(l);
                    const isTeam = current && teamLead.has(l) && !isLeague;
                    return (
                      <td
                        key={l}
                        className={cn(
                          "numeral px-2 py-2 text-center text-cream",
                          isHigh && "font-bold",
                          isTeam && "italic font-normal text-[#9ec1ff]",
                          isLeague && "font-bold text-alert not-italic",
                        )}
                      >
                        {value}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StatTable({
  title,
  stats,
  accent,
}: {
  title: string;
  stats: MlbPlayerStatLine[];
  accent: string;
}) {
  return (
    <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
      <div className="border-b border-white/[0.06] px-4 py-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
          {title}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-center text-[12px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
              {stats.map((s) => (
                <th key={s.label} className="px-2 py-2 font-medium">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-white/[0.05]">
              {stats.map((s) => (
                <td key={s.label} className="numeral text-cream px-2 py-2.5 text-[15px]">
                  {s.value}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SplitsTable({
  title,
  rows,
  accent,
}: {
  title: string;
  rows: MlbSplitRow[];
  accent: string;
}) {
  const labels = rows[0]?.stats.map((s) => s.label) ?? [];
  return (
    <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
      <div className="border-b border-white/[0.06] px-4 py-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
          {title}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-center text-[12px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
              <th className="px-2 py-2 text-left font-medium">Split</th>
              {labels.map((label) => (
                <th key={label} className="px-2 py-2 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const byLabel = new Map(row.stats.map((s) => [s.label, s.value]));
              return (
                <tr key={row.code} className="border-t border-white/[0.05]">
                  <td className="text-cream px-2 py-2 text-left text-[12px]">{row.label}</td>
                  {labels.map((label) => (
                    <td key={label} className="numeral text-cream px-2 py-2 text-[14px]">
                      {byLabel.get(label) ?? "—"}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BioAndOrigin({ player }: { player: MlbPlayerCard }) {
  const draftValue =
    player.draft?.display ?? (player.draftYear != null ? String(player.draftYear) : "—");
  return (
    <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
      <h3 className="rule-head mb-3">Origin</h3>
      <dl className="grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-3">
        <BioItem label="Full name" value={player.name} />
        <BioItem
          label="Born"
          value={player.birthDate ? formatSportsDate(player.birthDate) : "—"}
        />
        <BioItem label="Birthplace" value={player.birthPlace ?? "—"} />
        <BioItem
          label="Debut"
          value={player.mlbDebut ? formatSportsDate(player.mlbDebut) : "—"}
        />
        <BioItem label="Draft" value={draftValue} />
        {player.draft?.signingBonus && (
          <BioItem label="Signing bonus" value={player.draft.signingBonus} />
        )}
        <BioItem label="School" value={player.school ?? player.draft?.school ?? "—"} />
      </dl>
    </section>
  );
}

function inferContractStatus(
  transactions: { date: string; type: string; description: string }[],
): string | null {
  if (!transactions.length) return null;
  const latest = transactions[0];
  if (/selected the contract/i.test(latest?.description ?? "")) {
    return "Selected from minors · no published MLB salary table yet";
  }
  if (transactions.some((t) => /minor league contract/i.test(t.description))) {
    return "Minor league contract";
  }
  if (transactions.some((t) => /signed as a? free agent/i.test(t.description))) {
    return "Free-agent signing · salary not published yet";
  }
  return null;
}

function ContractBlock({
  contract,
  loading,
  error,
  onRetry,
  transactions,
  teamName,
  player,
}: {
  contract: Awaited<ReturnType<typeof fetchPlayerContract>>;
  loading: boolean;
  error?: unknown;
  onRetry?: () => void;
  transactions: { date: string; type: string; description: string }[];
  teamName?: string | null;
  player: MlbPlayerCard;
}) {
  const acquisitionExtras = [
    ...(contract?.acquisition ?? []),
    player.draft?.display ? `Drafted: ${player.draft.display}` : "",
  ].filter(Boolean);

  const story = buildAcquisitionStory(transactions, acquisitionExtras, teamName);
  const inferredStatus = inferContractStatus(transactions);
  const hasContractDetails =
    Boolean(contract?.contractStatus) ||
    Boolean(contract?.currentSalary?.display) ||
    Boolean(contract?.totalValue) ||
    Boolean(contract?.aav) ||
    (contract?.salaryHistory?.length ?? 0) > 0;

  return (
    <section className="bg-panel space-y-4 rounded-xl border border-white/[0.08] p-4">
      <h3 className="rule-head">Contract & acquisition</h3>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 size={18} className="text-chalk-dim animate-spin" />
          <span className="text-chalk-dim text-[13px]">Loading contract…</span>
        </div>
      )}

      {!loading && (
        <>
          {player.draft?.display && (
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#8b93a7]">Draft</p>
              <p className="text-cream mt-1 text-[15px] font-medium">{player.draft.display}</p>
              {(player.draft.school || player.draft.signingBonus) && (
                <p className="text-chalk-dim mt-1 text-[12px]">
                  {[player.draft.school, player.draft.signingBonus].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          )}

          {hasContractDetails ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {contract?.contractStatus && (
                <div className="rounded-lg border border-white/[0.08] px-3 py-3 sm:col-span-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#8b93a7]">Status</p>
                  <p className="text-cream mt-1 text-[14px] leading-snug">{contract.contractStatus}</p>
                </div>
              )}
              <div className="rounded-lg border border-white/[0.08] px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-[#8b93a7]">
                  {contract?.currentSalary?.year === "Total" ? "Contract value" : "This season"}
                </p>
                <p className="numeral text-cream mt-1 text-[22px] leading-none">
                  {contract?.currentSalary?.display ?? contract?.totalValue ?? "—"}
                </p>
                {contract?.currentSalary?.year && contract.currentSalary.year !== "Total" && (
                  <p className="mt-1 text-[11px] text-[#8b93a7]">{contract.currentSalary.year}</p>
                )}
              </div>
              {contract?.aav && (
                <div className="rounded-lg border border-white/[0.08] px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#8b93a7]">AAV</p>
                  <p className="numeral text-cream mt-1 text-[22px] leading-none">{contract.aav}</p>
                </div>
              )}
              {contract?.totalValue && contract?.currentSalary?.display !== contract.totalValue && (
                <div className="rounded-lg border border-white/[0.08] px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#8b93a7]">Total</p>
                  <p className="numeral text-cream mt-1 text-[22px] leading-none">
                    {contract.totalValue}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-3">
              {inferredStatus ? (
                <>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#8b93a7]">Status</p>
                  <p className="text-cream mt-1 text-[14px] leading-snug">{inferredStatus}</p>
                  <p className="text-chalk-dim mt-2 text-[12px]">
                    Baseball Reference / Spotrac have not published a salary table for this player yet.
                  </p>
                </>
              ) : (
                <p className="text-chalk-dim text-[13px]">
                  {error
                    ? `Couldn't load contract details${error instanceof Error ? `: ${error.message}` : "."}`
                    : "No salary table came back from Baseball Reference / Spotrac for this player yet."}
                </p>
              )}
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="text-chalk-dim mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] hover:text-cream hover:underline"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {contract?.salaryHistory && contract.salaryHistory.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-white/[0.08]">
              <table className="w-full min-w-[320px] text-left text-[12px]">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02] text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                    <th className="px-3 py-2 font-medium">Year</th>
                    <th className="px-3 py-2 font-medium">Team</th>
                    <th className="px-3 py-2 font-medium">Salary</th>
                  </tr>
                </thead>
                <tbody>
                  {[...contract.salaryHistory].reverse().map((s) => (
                    <tr key={`${s.year}-${s.display}`} className="border-t border-white/[0.05]">
                      <td className="text-cream px-3 py-2">{s.year}</td>
                      <td className="px-3 py-2 text-[#c8cdd8]">{s.team ?? "—"}</td>
                      <td className="numeral text-cream px-3 py-2">{s.display}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {story.lines.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">
            How he got here
          </p>
          {story.headline && /trade/i.test(story.headline) && (
            <div className="mb-3 rounded-lg border border-accent/35 bg-accent/10 px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
                Trade that brought him here
              </p>
              <p className="text-cream mt-1.5 text-[13.5px] leading-relaxed">{story.headline}</p>
            </div>
          )}
          {story.headline &&
            !/trade/i.test(story.headline) &&
            /signed|claimed|selected/i.test(story.headline) && (
              <div className="mb-3 rounded-lg border border-accent/35 bg-accent/10 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
                  How he arrived
                </p>
                <p className="text-cream mt-1.5 text-[13.5px] leading-relaxed">{story.headline}</p>
              </div>
            )}
          <ul className="space-y-2">
            {story.lines.map((line) => (
              <li
                key={line}
                className="border-l-2 border-accent/50 pl-3 text-[12.5px] leading-relaxed text-[#c8cdd8]"
              >
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      {contract?.url && (
        <a
          href={contract.url}
          target="_blank"
          rel="noreferrer"
          className="text-chalk-dim hover:text-cream inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] hover:underline"
        >
          {contract.source === "spotrac+baseball-reference"
            ? "Spotrac + Baseball Reference"
            : contract.source?.includes("spotrac")
              ? "Spotrac"
              : "Baseball Reference"}{" "}
          <ExternalLink size={11} />
        </a>
      )}
      <p className="text-[10.5px] text-[#8b93a7]">
        Contract via Spotrac / Baseball Reference · transactions via MLB Stats API
      </p>
    </section>
  );
}

function BioItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.14em] text-[#8b93a7]">{label}</dt>
      <dd className="text-cream mt-0.5">{value}</dd>
    </div>
  );
}

function statValue(stats: MlbPlayerStatLine[], label: string): string | null {
  return stats.find((s) => s.label === label)?.value ?? null;
}

function findRank(ranks: MlbLeagueRank[], label: string): MlbLeagueRank | undefined {
  return ranks.find((r) => r.label === label);
}

function buildWL(stats: MlbPlayerStatLine[]): string | null {
  const w = statValue(stats, "W");
  const l = statValue(stats, "L");
  if (w != null && l != null) return `${w}-${l}`;
  return null;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
