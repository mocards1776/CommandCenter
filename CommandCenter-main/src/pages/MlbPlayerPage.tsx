import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Star } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import {
  addFavoritePlayer,
  isFavoritePlayer,
  removeFavoritePlayer,
} from "@/lib/favorite-players";
import {
  fetchMlbPlayer,
  mlbTeamLogo,
  type MlbPlayerCard,
  type MlbPlayerStatLine,
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
  const headline = (p.hitting.length > 0 ? p.hitting : p.pitching).slice(0, 3);

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-7">
      <div className="mb-5 flex items-center justify-between gap-3">
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

      <PlayerCard
        player={p}
        accent={accent}
        headline={headline}
        isFavorite={isFav}
        favoriting={toggleFav.isPending}
        onToggleFavorite={() => toggleFav.mutate()}
      />

      <div className="mt-6 flex flex-col gap-6">
        {p.hitting.length > 0 && (
          <StatBlock title={`${p.season} Hitting`} stats={p.hitting} />
        )}
        {p.pitching.length > 0 && (
          <StatBlock title={`${p.season} Pitching`} stats={p.pitching} />
        )}
        {p.hitting.length === 0 && p.pitching.length === 0 && (
          <p className="text-chalk-dim text-[13px]">No season stats posted yet.</p>
        )}

        <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
          <h3 className="rule-head mb-3">Bio</h3>
          <dl className="grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-3">
            <BioItem label="Bats / Throws" value={`${p.bats ?? "—"} / ${p.throws ?? "—"}`} />
            <BioItem label="Height" value={p.height ?? "—"} />
            <BioItem label="Weight" value={p.weight ? `${p.weight} lb` : "—"} />
            <BioItem label="Born" value={p.birthDate ?? "—"} />
            <BioItem label="From" value={p.birthPlace ?? "—"} className="col-span-2" />
          </dl>
        </section>
      </div>
    </div>
  );
}

function PlayerCard({
  player,
  accent,
  headline,
  isFavorite,
  favoriting,
  onToggleFavorite,
}: {
  player: MlbPlayerCard;
  accent: string;
  headline: MlbPlayerStatLine[];
  isFavorite: boolean;
  favoriting: boolean;
  onToggleFavorite: () => void;
}) {
  return (
    <article className="bg-panel overflow-hidden rounded-2xl border border-white/[0.1]">
      <div className="h-1.5 w-full" style={{ background: accent }} />

      <div className="flex flex-col items-center px-5 pt-7 pb-5 text-center sm:px-8">
        <div className="relative mb-4">
          <div
            className="absolute -inset-1 rounded-full opacity-50 blur-md"
            style={{ background: accent }}
          />
          <img
            src={player.headshot}
            alt=""
            width={168}
            height={168}
            className="relative h-[168px] w-[168px] rounded-full object-cover object-top ring-2 ring-white/20"
          />
          {player.number && (
            <span
              className="font-display absolute -right-1 -bottom-1 grid h-10 w-10 place-items-center rounded-full text-[16px] text-cream ring-2 ring-[#0d1d3c]"
              style={{ background: accent }}
            >
              {player.number}
            </span>
          )}
        </div>

        <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
          {player.position && (
            <span
              className="rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-cream"
              style={{ background: accent }}
            >
              {player.position}
            </span>
          )}
          {player.teamId != null && (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-[#c8cdd8]">
              <img
                src={mlbTeamLogo(player.teamId)}
                alt=""
                className="h-5 w-5 object-contain"
              />
              {player.teamName ?? player.teamAbbrev}
            </span>
          )}
        </div>

        <p className="text-[14px] tracking-wide text-[#b8bfd0]">{player.firstName}</p>
        <h1 className="font-display text-cream mt-0.5 text-[40px] leading-none sm:text-[46px]">
          {player.lastName || player.name}
        </h1>
        {player.positionName && (
          <p className="mt-2 text-[12px] text-[#8b93a7]">{player.positionName}</p>
        )}
      </div>

      {headline.length > 0 && (
        <div className="grid grid-cols-3 gap-px border-y border-white/[0.08] bg-white/[0.06]">
          {headline.map((s) => (
            <div key={s.label} className="bg-panel px-3 py-3.5 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
                {s.label}
              </p>
              <p className="numeral text-cream mt-1 text-[26px] leading-none">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="p-4 sm:p-5">
        <button
          type="button"
          onClick={onToggleFavorite}
          disabled={favoriting}
          className={cn(
            "inline-flex w-full items-center justify-center gap-2 rounded-sm px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] transition disabled:opacity-50",
            isFavorite
              ? "border border-white/20 bg-white/[0.06] text-cream"
              : "text-cream",
          )}
          style={isFavorite ? undefined : { background: accent }}
        >
          <Star size={14} className={isFavorite ? "fill-current text-accent" : ""} />
          {isFavorite ? "Favorited" : "Add favorite"}
        </button>
      </div>
    </article>
  );
}

function StatBlock({ title, stats }: { title: string; stats: MlbPlayerStatLine[] }) {
  return (
    <section>
      <h3 className="rule-head mb-3">{title}</h3>
      <dl className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-white/[0.08] bg-[#0d1d3c] px-3 py-3"
          >
            <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">
              {s.label}
            </dt>
            <dd className="numeral text-cream mt-1 text-[24px] leading-none">{s.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function BioItem({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-[10px] uppercase tracking-[0.14em] text-[#8b93a7]">{label}</dt>
      <dd className="text-cream mt-0.5">{value}</dd>
    </div>
  );
}
