import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, ChevronRight, ExternalLink, Loader2 } from "lucide-react";
import HighlightReel from "@/components/sports/HighlightReel";
import SportsNotesPanel from "@/components/sports/SportsNotesPanel";
import PlayerTagsPanel from "@/components/sports/PlayerTagsPanel";
import TeamMark from "@/components/sports/TeamMark";
import { useAuth } from "@/lib/auth-context";
import { isFavoritePlayer } from "@/lib/favorite-players";
import {
  buildAcquisitionStory,
  buildPlayerPerformanceSummary,
  fetchMlbPlayer,
  fetchMlbPlayerGameLog,
  fetchMlbPlayerHighlights,
  fetchMlbPlayerLeagueRanks,
  fetchMlbPlayerRecent,
  fetchMlbPlayerSplits,
  fetchMlbPlayerTransactions,
  clearPlayerContractCache,
  fetchPlayerBrief,
  fetchPlayerContract,
  teamPagePath,
  type MlbGameLogEntry,
  type MlbLeagueRank,
  type MlbPerformanceSummary,
  type MlbPlayerBrief,
  type MlbPlayerCard,
  type MlbPlayerLevel,
  type MlbPlayerSeasonRow,
  type MlbPlayerStatLine,
  type MlbSplitRow,
} from "@/lib/mlb";
import { cn } from "@/lib/utils";

export default function MlbPlayerPage() {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [level, setLevel] = useState<MlbPlayerLevel | null>(null);

  const player = useQuery({
    queryKey: ["mlb-player-v5", playerId],
    queryFn: () => fetchMlbPlayer(playerId!),
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
      "mlb-player-contract-v9",
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
      }),
    enabled: Boolean(player.data?.name),
    staleTime: 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  const brief = useQuery({
    queryKey: ["mlb-player-brief-v1", player.data?.name],
    queryFn: () => fetchPlayerBrief(player.data!.name),
    enabled: Boolean(player.data?.name),
    staleTime: 300_000,
    retry: 1,
  });

  const isPitcherPreview =
    Boolean(player.data) &&
    ((player.data!.pitching.length > 0 && player.data!.position === "P") ||
      player.data!.pitching.length > player.data!.hitting.length);
  const splitGroup = isPitcherPreview ? "pitching" : "hitting";

  const latestGame = useQuery({
    queryKey: ["mlb-player-latest-game", playerId, splitGroup, player.data?.season],
    queryFn: () => fetchMlbPlayerGameLog(player.data!.id, splitGroup, 1, player.data!.season),
    enabled: Boolean(player.data),
    staleTime: 120_000,
  });

  const splits = useQuery({
    queryKey: ["mlb-player-splits", playerId, splitGroup, player.data?.season],
    queryFn: () =>
      fetchMlbPlayerSplits(player.data!.id, splitGroup, player.data!.season),
    enabled: Boolean(player.data),
    staleTime: 120_000,
  });

  const last5 = useQuery({
    queryKey: ["mlb-player-last5", playerId, splitGroup, player.data?.season],
    queryFn: () => fetchMlbPlayerRecent(player.data!.id, splitGroup, 5, player.data!.season),
    enabled: Boolean(player.data),
    staleTime: 120_000,
  });

  const last10 = useQuery({
    queryKey: ["mlb-player-last10", playerId, splitGroup, player.data?.season],
    queryFn: () => fetchMlbPlayerRecent(player.data!.id, splitGroup, 10, player.data!.season),
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

  useEffect(() => {
    const st = (history.state as { mlbPlayer?: string } | null) ?? {};
    if (playerId && st.mlbPlayer !== playerId) {
      history.replaceState({ ...st, mlbPlayer: playerId }, "", window.location.href);
    }
  }, [playerId]);

  if (player.isPending) {
    return (
      <div className="text-chalk flex min-h-[50vh] items-center justify-center gap-2">
        <Loader2 size={18} className="animate-spin" />
        Loading player…
      </div>
    );
  }

  if (player.isError || !player.data) {
    return (
      <div className="p-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-chalk hover:text-cream mb-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em]"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <p className="text-alert text-[13px]">
          {player.error instanceof Error ? player.error.message : "Player not found"}
        </p>
      </div>
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

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-7">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-chalk hover:text-cream flex items-center gap-2 text-[11px] uppercase tracking-[0.14em]"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <a
          href={mlbUrl}
          target="_blank"
          rel="noreferrer"
          className="text-chalk-dim/80 hover:text-chalk inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em]"
        >
          MLB.com <ExternalLink size={12} />
        </a>
      </div>

      <PlayerHeader player={p} accent={accent} isFavorite={isFav} />

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
        <RotoWireBriefCard brief={brief.data ?? null} loading={brief.isPending} />
      )}

      {performance && <PerformanceSummaryCard summary={performance} />}

      {seasonStats.length > 0 && (
        <SeasonStatsStrip
          season={p.season}
          stats={seasonStats}
          ranks={activeLevel === "mlb" ? (ranks.data ?? []) : []}
          isPitcher={isPitcher}
          levelLabel={showLevelSelector ? levelLabel : undefined}
        />
      )}

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
            />
          )}
          {last10.data && (
            <RecentGamesSection
              playerId={p.id}
              season={p.season}
              group={splitGroup}
              recent={last10.data}
              accent={accent}
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

      <BioAndOrigin player={p} />

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
    </div>
  );
}

function RotoWireBriefCard({
  brief,
  loading,
}: {
  brief: MlbPlayerBrief | null;
  loading: boolean;
}) {
  return (
    <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
      <div className="border-b border-white/[0.06] flex items-center justify-between gap-3 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
          RotoWire
        </p>
        {brief?.url ? (
          <a
            href={brief.url}
            target="_blank"
            rel="noreferrer"
            className="text-chalk-dim hover:text-chalk inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em]"
          >
            Source <ExternalLink size={12} />
          </a>
        ) : null}
      </div>
      <div className="px-4 py-3">
        {loading ? (
          <div className="text-chalk-dim flex items-center gap-2 text-[13px]">
            <Loader2 size={14} className="animate-spin" />
            Loading brief…
          </div>
        ) : brief?.story || brief?.headline ? (
          <div className="space-y-2">
            {brief.headline ? (
              <p className="text-cream text-[15px] font-medium leading-snug">{brief.headline}</p>
            ) : null}
            {brief.story ? (
              <p className="text-chalk text-[14px] leading-relaxed">{brief.story}</p>
            ) : null}
            {brief.published ? (
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#8b93a7]">
                {brief.published}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-chalk-dim text-[13px]">No RotoWire note available right now.</p>
        )}
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
          Form
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
}: {
  player: MlbPlayerCard;
  accent: string;
  isFavorite: boolean;
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

      <div className="relative z-10 flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:p-7">
        <div className="relative mx-auto shrink-0 sm:mx-0">
          <div className="overflow-hidden rounded-xl bg-[#dfe6f2] p-1 shadow-2xl ring-2 ring-white/30">
            <img
              src={player.headshot}
              alt=""
              width={176}
              height={176}
              className="h-[150px] w-[150px] rounded-[10px] object-cover object-[center_12%] sm:h-[176px] sm:w-[176px]"
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
              </div>
              <p className="mt-1 text-[13px] font-medium uppercase tracking-[0.08em] text-white/65">
                {player.firstName}
              </p>
              <h1 className="font-display text-[38px] leading-[0.92] text-white sm:text-[48px]">
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

            {player.age != null && (
              <div className="shrink-0 rounded-md border border-white/25 bg-black/35 px-3 py-2 text-center backdrop-blur-sm">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/60">Age</p>
                <p className="numeral text-[30px] leading-none text-white">{player.age}</p>
              </div>
            )}
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-2.5 text-[12.5px] sm:grid-cols-4">
            {htWt && (
              <div>
                <dt className="text-[10px] uppercase tracking-[0.14em] text-white/50">HT / WT</dt>
                <dd className="mt-0.5 text-white">{htWt}</dd>
              </div>
            )}
            {player.birthDate && (
              <div>
                <dt className="text-[10px] uppercase tracking-[0.14em] text-white/50">Birthdate</dt>
                <dd className="mt-0.5 text-white">
                  {player.birthDate}
                  {player.age != null ? ` (${player.age})` : ""}
                </dd>
              </div>
            )}
            {batThr && (
              <div>
                <dt className="text-[10px] uppercase tracking-[0.14em] text-white/50">Bat / Thr</dt>
                <dd className="mt-0.5 text-white">{batThr}</dd>
              </div>
            )}
            {player.mlbDebut && (
              <div>
                <dt className="text-[10px] uppercase tracking-[0.14em] text-white/50">MLB debut</dt>
                <dd className="mt-0.5 text-white">{player.mlbDebut}</dd>
              </div>
            )}
            {player.birthPlace && (
              <div className="sm:col-span-2">
                <dt className="text-[10px] uppercase tracking-[0.14em] text-white/50">Born</dt>
                <dd className="mt-0.5 text-white">{player.birthPlace}</dd>
              </div>
            )}
            {player.school && (
              <div className="sm:col-span-2">
                <dt className="text-[10px] uppercase tracking-[0.14em] text-white/50">School</dt>
                <dd className="mt-0.5 text-white">{player.school}</dd>
              </div>
            )}
          </dl>

          <PlayerTagsPanel
            playerId={player.id}
            playerName={player.name}
            variant="hero"
            isFavorite={isFavorite}
          />
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
}: {
  season: number;
  stats: MlbPlayerStatLine[];
  ranks: MlbLeagueRank[];
  isPitcher: boolean;
  levelLabel?: string;
}) {
  const keyStats: KeyStat[] = isPitcher ? buildPitcherKeyStats(stats) : buildHitterKeyStats(stats);

  return (
    <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
      <div className="border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b93a7]">
          {season} Season Stats{levelLabel ? ` · ${levelLabel}` : ""}
        </h2>
      </div>
      <div className="grid grid-cols-2 divide-x divide-white/[0.06] sm:grid-cols-4">
        {keyStats.map((s) => {
          const rank = s.rankLabel ? findRank(ranks, s.rankLabel) : undefined;
          return (
            <div key={s.label} className="px-3 py-4 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">
                {s.label}
              </p>
              <p className="numeral text-cream mt-1 text-[26px] leading-none sm:text-[28px]">
                {s.value}
              </p>
              {rank && (
                <p className="mt-1.5 text-[12px] font-medium text-[#b8c0d2]">{rank.display}</p>
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
}: {
  playerId: number;
  season: number;
  group: "hitting" | "pitching";
  recent: { label: string; games: number; stats: MlbPlayerStatLine[] };
  accent: string;
}) {
  const [open, setOpen] = useState(false);
  const limit = recent.label.includes("10") ? 10 : 5;

  const gameLog = useQuery({
    queryKey: ["mlb-player-gamelog", playerId, group, limit, season],
    queryFn: () => fetchMlbPlayerGameLog(playerId, group, limit, season),
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
}: {
  title: string;
  rows: MlbPlayerSeasonRow[];
  isPitcher: boolean;
}) {
  const labels = isPitcher
    ? ["W", "L", "ERA", "IP", "SO", "WHIP", "SV"]
    : ["G", "AB", "AVG", "HR", "RBI", "OPS", "SB"];

  return (
    <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
      <div className="border-b border-white/[0.06] px-4 py-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
          {title}
        </h3>
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
                  {labels.map((l) => (
                    <td key={l} className="numeral text-cream px-2 py-2 text-center">
                      {map.get(l) ?? "—"}
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
            {rows.map((row) => (
              <tr key={row.code} className="border-t border-white/[0.05]">
                <td className="text-cream px-2 py-2 text-left text-[12px]">{row.label}</td>
                {row.stats.map((s) => (
                  <td key={s.label} className="numeral text-cream px-2 py-2 text-[14px]">
                    {s.value}
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

function BioAndOrigin({ player }: { player: MlbPlayerCard }) {
  const draftValue =
    player.draft?.display ?? (player.draftYear != null ? String(player.draftYear) : "—");
  return (
    <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
      <h3 className="rule-head mb-3">Bio</h3>
      <dl className="grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-3">
        <BioItem label="Full name" value={player.name} />
        <BioItem label="Born" value={player.birthDate ?? "—"} />
        <BioItem label="Birthplace" value={player.birthPlace ?? "—"} />
        <BioItem label="Debut" value={player.mlbDebut ?? "—"} />
        <BioItem label="Draft" value={draftValue} />
        {player.draft?.signingBonus && (
          <BioItem label="Signing bonus" value={player.draft.signingBonus} />
        )}
        <BioItem label="School" value={player.school ?? player.draft?.school ?? "—"} />
      </dl>
    </section>
  );
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
              <p className="text-chalk-dim text-[13px]">
                {error
                  ? `Couldn't load contract details${error instanceof Error ? `: ${error.message}` : "."}`
                  : "No salary table came back from Baseball Reference / Spotrac for this player yet."}
              </p>
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
