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
  fetchMlbPlayer,
  fetchMlbPlayerHighlights,
  fetchMlbPlayerSplits,
  fetchMlbPlayerTransactions,
  fetchPlayerContract,
  mlbTeamLogo,
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
    <article className="bg-panel overflow-hidden rounded-2xl border border-white/[0.1]">
      <div className="h-1.5 w-full" style={{ background: accent }} />
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:p-6">
        <div className="relative mx-auto shrink-0 sm:mx-0">
          <img
            src={player.headshot}
            alt=""
            width={148}
            height={148}
            className="h-[148px] w-[148px] rounded-full object-cover object-top ring-2 ring-white/15"
          />
          {player.teamId != null && (
            <img
              src={mlbTeamLogo(player.teamId)}
              alt=""
              className="absolute -right-1 -bottom-1 h-11 w-11 rounded-full bg-white p-1 shadow-md"
            />
          )}
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="mb-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            {player.position && (
              <span
                className="rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-cream"
                style={{ background: accent }}
              >
                {player.position}
                {player.number ? ` · #${player.number}` : ""}
              </span>
            )}
            {player.teamName && (
              <span className="text-[12px] text-[#b8bfd0]">{player.teamName}</span>
            )}
          </div>
          <p className="text-[14px] text-[#b8bfd0]">{player.firstName}</p>
          <h1 className="font-display text-cream text-[38px] leading-[0.95] sm:text-[44px]">
            {player.lastName || player.name}
          </h1>
          <p className="mt-2 text-[12px] text-[#8b93a7]">
            {[
              player.bats && player.throws ? `B/T: ${player.bats}/${player.throws}` : null,
              player.height,
              player.weight ? `${player.weight} lb` : null,
              player.positionName,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          {top.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {top.map((s) => (
                <div
                  key={s.label}
                  className="rounded-lg border border-white/[0.08] bg-black/20 px-2 py-2 text-center"
                >
                  <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[#8b93a7]">
                    {s.label}
                  </p>
                  <p className="numeral text-cream mt-0.5 text-[18px] leading-none">{s.value}</p>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={onToggleFavorite}
            disabled={favoriting}
            className={cn(
              "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-sm px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition disabled:opacity-50 sm:w-auto",
              isFavorite ? "border border-white/20 bg-white/[0.06] text-cream" : "text-cream",
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

function ContractBlock({
  contract,
  loading,
  transactions,
}: {
  contract: Awaited<ReturnType<typeof fetchPlayerContract>>;
  loading: boolean;
  transactions: { date: string; type: string; description: string }[];
}) {
  const acquisition =
    contract?.acquisition?.length
      ? contract.acquisition
      : transactions.slice(0, 6).map((t) => `${t.date}: ${t.description}`);

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

      {acquisition.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">
            How he got here
          </p>
          <ul className="space-y-2">
            {acquisition.map((line) => (
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
