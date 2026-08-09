import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Loader2, Star } from "lucide-react";
import toast from "react-hot-toast";
import HighlightReel from "@/components/sports/HighlightReel";
import { useAuth } from "@/lib/auth-context";
import {
  addFavoritePlayer,
  isFavoritePlayer,
  removeFavoritePlayer,
} from "@/lib/favorite-players";
import {
  buildAcquisitionStory,
  fetchMlbPlayer,
  fetchMlbPlayerHighlights,
  fetchMlbPlayerLeagueRanks,
  fetchMlbPlayerRecent,
  fetchMlbPlayerSplits,
  fetchMlbPlayerTransactions,
  fetchPlayerContract,
  mlbTeamLogo,
  type MlbLeagueRank,
  type MlbPlayerCard,
  type MlbPlayerStatLine,
  type MlbSplitRow,
} from "@/lib/mlb";
import { cn } from "@/lib/utils";

export default function MlbPlayerPage() {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const player = useQuery({
    queryKey: ["mlb-player", playerId],
    queryFn: () => fetchMlbPlayer(playerId!),
    enabled: Boolean(playerId),
    staleTime: 120_000,
  });

  const favQuery = useQuery({
    queryKey: ["favorite-player", user?.id, playerId],
    queryFn: () => isFavoritePlayer(user!.id, playerId!),
    enabled: Boolean(user?.id && playerId),
  });

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
    queryKey: ["mlb-player-contract", player.data?.name],
    queryFn: () => fetchPlayerContract(player.data!.name),
    enabled: Boolean(player.data?.name),
    staleTime: 600_000,
  });

  const isPitcherPreview =
    Boolean(player.data) &&
    ((player.data!.pitching.length > 0 && player.data!.position === "P") ||
      player.data!.pitching.length > player.data!.hitting.length);
  const splitGroup = isPitcherPreview ? "pitching" : "hitting";

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

  const toggleFav = useMutation({
    mutationFn: async () => {
      if (!user?.id || !player.data) throw new Error("Not signed in");
      if (favQuery.data) {
        await removeFavoritePlayer(user.id, String(player.data.id));
        return false;
      }
      await addFavoritePlayer({
        userId: user.id,
        playerId: String(player.data.id),
        playerName: player.data.name,
        teamName: player.data.teamName,
        teamId: player.data.teamId != null ? String(player.data.teamId) : null,
        position: player.data.position,
      });
      return true;
    },
    onSuccess: (nowFav) => {
      void qc.invalidateQueries({ queryKey: ["favorite-player", user?.id, playerId] });
      void qc.invalidateQueries({ queryKey: ["favorite-players", user?.id] });
      toast.success(nowFav ? "Added to favorites" : "Removed from favorites");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn’t update favorite"),
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
  const isPitcher = (p.pitching.length > 0 && p.position === "P") || p.pitching.length > p.hitting.length;
  const seasonStats = isPitcher ? p.pitching : p.hitting;
  const careerStats = isPitcher ? p.careerPitching : p.careerHitting;
  const mlbUrl = `https://www.mlb.com/player/${slugify(p.name)}-${p.id}`;

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
          className="text-chalk-dim hover:text-cream inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em]"
        >
          MLB.com <ExternalLink size={12} />
        </a>
      </div>

      <PlayerHeader
        player={p}
        accent={accent}
        seasonStats={seasonStats}
        isFavorite={isFav}
        favoriting={toggleFav.isPending}
        onToggleFavorite={() => toggleFav.mutate()}
      />

      {seasonStats.length > 0 && (
        <StatTable
          title={`${p.season} Regular Season`}
          stats={seasonStats}
          accent={accent}
        />
      )}

      {(ranks.data?.length ?? 0) > 0 && (
        <LeagueRanks ranks={ranks.data!} accent={accent} season={p.season} />
      )}

      {(last5.data || last10.data) && (
        <div className="space-y-3">
          {last5.data && (
            <StatTable
              title={`${last5.data.label} (${last5.data.games} G)`}
              stats={last5.data.stats}
              accent={accent}
            />
          )}
          {last10.data && (
            <StatTable
              title={`${last10.data.label} (${last10.data.games} G)`}
              stats={last10.data.stats}
              accent={accent}
            />
          )}
        </div>
      )}

      {careerStats.length > 0 && (
        <StatTable title="Career Regular Season" stats={careerStats} accent={accent} />
      )}
      {!isPitcher && p.pitching.length > 0 && (
        <StatTable title={`${p.season} Pitching`} stats={p.pitching} accent={accent} />
      )}
      {isPitcher && p.hitting.length > 0 && p.hitting.some((s) => s.label === "AB" || s.label === "G") && (
        <StatTable title={`${p.season} Batting`} stats={p.hitting} accent={accent} />
      )}

      {splits.isPending && (
        <p className="text-chalk-dim flex items-center gap-2 text-[12px]">
          <Loader2 size={14} className="animate-spin" /> Loading splits…
        </p>
      )}
      {(splits.data?.length ?? 0) > 0 && (
        <SplitsTable
          title={`${p.season} Splits`}
          rows={splits.data!}
          accent={accent}
        />
      )}

      <BioAndOrigin player={p} />

      <ContractBlock
        contract={contract.data ?? null}
        loading={contract.isPending}
        transactions={transactions.data ?? []}
        teamName={p.teamName}
      />

      {highlights.isPending && (
        <p className="text-chalk-dim flex items-center gap-2 text-[12px]">
          <Loader2 size={14} className="animate-spin" /> Loading highlights…
        </p>
      )}
      <HighlightReel highlights={highlights.data ?? []} title="Player highlights" />
    </div>
  );
}

function PlayerHeader({
  player,
  accent,
  seasonStats,
  isFavorite,
  favoriting,
  onToggleFavorite,
}: {
  player: MlbPlayerCard;
  accent: string;
  seasonStats: MlbPlayerStatLine[];
  isFavorite: boolean;
  favoriting: boolean;
  onToggleFavorite: () => void;
}) {
  const top = seasonStats.slice(0, 6);

  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/[0.1] bg-[#07111f]">
      {/* MLB.com-style full-bleed team wash + action shot */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(120deg, ${accent}cc 0%, ${accent}66 35%, #07111f 70%)`,
        }}
      />
      <img
        src={player.actionShot}
        alt=""
        className="absolute inset-y-0 right-0 h-full w-[58%] object-cover object-top opacity-35 mix-blend-luminosity sm:opacity-45"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#07111f] via-[#07111f]/88 to-transparent" />

      <div className="relative z-10 flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:p-6">
        <div className="relative mx-auto shrink-0 sm:mx-0">
          <div
            className="absolute -inset-1 rounded-full opacity-80 blur-md"
            style={{ background: accent }}
          />
          <img
            src={player.headshot}
            alt=""
            width={160}
            height={160}
            className="relative h-[150px] w-[150px] rounded-full bg-[#0c1a2e] object-cover object-top ring-4 ring-white/90"
          />
          {player.teamId != null && (
            <img
              src={mlbTeamLogo(player.teamId)}
              alt=""
              className="absolute -right-1 -bottom-1 h-12 w-12 rounded-full bg-white p-1 shadow-md"
            />
          )}
        </div>

        <div className="min-w-0 flex-1 text-center sm:pb-1 sm:text-left">
          <div className="mb-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            {player.number && (
              <span className="font-display text-[28px] leading-none text-white/90">
                #{player.number}
              </span>
            )}
            {player.position && (
              <span
                className="rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-cream"
                style={{ background: accent }}
              >
                {player.position}
              </span>
            )}
            {player.teamName && (
              <span className="text-[12px] font-medium text-white/75">{player.teamName}</span>
            )}
          </div>
          <p className="text-[15px] font-medium tracking-wide text-white/70">{player.firstName}</p>
          <h1 className="font-display text-[42px] leading-[0.92] text-white sm:text-[52px]">
            {player.lastName || player.name}
          </h1>
          <p className="mt-2 text-[12px] text-white/55">
            {[
              player.bats && player.throws ? `B/T ${player.bats}/${player.throws}` : null,
              player.height,
              player.weight ? `${player.weight} lb` : null,
              player.positionName,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          {top.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
              {top.map((s) => (
                <div
                  key={s.label}
                  className="border border-white/15 bg-black/35 px-2 py-2 text-center backdrop-blur-sm"
                >
                  <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-white/55">
                    {s.label}
                  </p>
                  <p className="numeral mt-0.5 text-[20px] leading-none text-white">{s.value}</p>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={onToggleFavorite}
            disabled={favoriting}
            className={cn(
              "mt-4 inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition disabled:opacity-50 sm:w-auto",
              isFavorite ? "border border-white/25 bg-white/10 text-cream" : "text-cream",
            )}
            style={isFavorite ? undefined : { background: accent }}
          >
            <Star size={14} className={isFavorite ? "fill-current text-accent" : ""} />
            {isFavorite ? "Favorited" : "Add favorite"}
          </button>
        </div>
      </div>
    </article>
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
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: accent }}>
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
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: accent }}>
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
    player.draft?.display ??
    (player.draftYear != null ? String(player.draftYear) : "—");
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

function LeagueRanks({
  ranks,
  accent,
  season,
}: {
  ranks: MlbLeagueRank[];
  accent: string;
  season: number;
}) {
  return (
    <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
      <div className="border-b border-white/[0.06] px-4 py-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: accent }}>
          {season} MLB ranks (qualified)
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-px bg-white/[0.04] sm:grid-cols-5">
        {ranks.map((r) => (
          <div key={r.label} className="bg-panel px-3 py-3 text-center">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#8b93a7]">{r.label}</p>
            <p className="numeral text-cream mt-1 text-[20px] leading-none">{r.value}</p>
            <p className="mt-1.5 text-[12px] font-semibold" style={{ color: accent }}>
              #{r.rank}
              <span className="font-normal text-[#8b93a7]"> / {r.of}</span>
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ContractBlock({
  contract,
  loading,
  transactions,
  teamName,
}: {
  contract: Awaited<ReturnType<typeof fetchPlayerContract>>;
  loading: boolean;
  transactions: { date: string; type: string; description: string }[];
  teamName?: string | null;
}) {
  const story = buildAcquisitionStory(transactions, contract?.acquisition ?? [], teamName);

  return (
    <section className="bg-panel space-y-4 rounded-xl border border-white/[0.08] p-4">
      <h3 className="rule-head">Contract & acquisition</h3>

      {loading && (
        <p className="text-chalk-dim flex items-center gap-2 text-[12px]">
          <Loader2 size={14} className="animate-spin" /> Loading contract…
        </p>
      )}

      {!loading && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-white/[0.08] px-3 py-3 sm:col-span-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#8b93a7]">Contract</p>
            <p className="text-cream mt-1 text-[14px] leading-snug">
              {contract?.contractStatus ?? "Not published"}
            </p>
            {(contract?.totalValue || contract?.aav) && (
              <p className="mt-2 text-[12px] text-[#b8bfd0]">
                {[
                  contract.totalValue ? `Total ${contract.totalValue}` : null,
                  contract.aav ? `AAV ${contract.aav}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
          <div className="rounded-lg border border-white/[0.08] px-3 py-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#8b93a7]">
              {contract?.currentSalary?.year === "Total"
                ? "Contract value"
                : "This season pay"}
            </p>
            <p className="numeral text-cream mt-1 text-[22px] leading-none">
              {contract?.currentSalary?.display ?? "—"}
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
        </div>
      )}

      {contract?.salaryHistory && contract.salaryHistory.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] text-left text-[12px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                <th className="px-1 py-1.5 font-medium">Year</th>
                <th className="px-1 py-1.5 font-medium">Team</th>
                <th className="px-1 py-1.5 font-medium">Salary</th>
              </tr>
            </thead>
            <tbody>
              {[...contract.salaryHistory].reverse().map((s) => (
                <tr key={`${s.year}-${s.display}`} className="border-t border-white/[0.05]">
                  <td className="text-cream px-1 py-1.5">{s.year}</td>
                  <td className="px-1 py-1.5 text-[#c8cdd8]">{s.team ?? "—"}</td>
                  <td className="numeral text-cream px-1 py-1.5">{s.display}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {story.lines.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">
            How he got here
          </p>
          {story.headline && /trade/i.test(story.headline) && (
            <div className="mb-3 border border-accent/35 bg-accent/10 px-3 py-3">
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
          className="text-accent inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] hover:underline"
        >
          {contract.source === "spotrac" ? "Spotrac" : "Baseball Reference"}{" "}
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

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
