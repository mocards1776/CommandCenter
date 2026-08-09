import { useEffect, useState } from "react";
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
import { fetchMlbPlayer, type MlbPlayerCard, type MlbPlayerStatLine } from "@/lib/mlb";
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

  // Back-swipe support when opened as a panel-like route
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

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-7">
      <div className="mb-4 flex items-center justify-between gap-3">
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

      <PlayerHero
        player={p}
        accent={accent}
        isFavorite={isFav}
        favoriting={toggleFav.isPending}
        onToggleFavorite={() => toggleFav.mutate()}
      />

      <div className="mt-6 flex flex-col gap-6">
        {p.hitting.length > 0 && (
          <StatBlock title={`${p.season} Hitting`} stats={p.hitting} accent={accent} />
        )}
        {p.pitching.length > 0 && (
          <StatBlock title={`${p.season} Pitching`} stats={p.pitching} accent={accent} />
        )}
        {p.hitting.length === 0 && p.pitching.length === 0 && (
          <p className="text-chalk-dim text-[13px]">No season stats posted yet.</p>
        )}

        <section className="bg-panel rounded-xl border border-white/[0.07] p-4">
          <h3 className="rule-head mb-3">Bio</h3>
          <dl className="grid grid-cols-2 gap-3 text-[12.5px] sm:grid-cols-3">
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

function PlayerHero({
  player,
  accent,
  isFavorite,
  favoriting,
  onToggleFavorite,
}: {
  player: MlbPlayerCard;
  accent: string;
  isFavorite: boolean;
  favoriting: boolean;
  onToggleFavorite: () => void;
}) {
  const [imgOk, setImgOk] = useState(true);
  const [shot, setShot] = useState<"action" | "head">("action");

  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/[0.1] shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(145deg, ${accent}cc 0%, #081228 42%, #0a1730 100%)`,
        }}
      />
      <div
        className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full opacity-40 blur-3xl"
        style={{ background: accent }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(244,241,233,0.12),transparent_55%)]" />

      <div className="relative grid gap-0 sm:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="relative min-h-[320px] overflow-hidden sm:min-h-[420px]">
          {imgOk ? (
            <img
              src={shot === "action" ? player.actionShot : player.headshot}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-top transition duration-700"
              onError={() => {
                if (shot === "action") setShot("head");
                else setImgOk(false);
              }}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center">
              <span className="font-display text-cream/20 text-[120px] leading-none">
                {player.number ?? "•"}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#081228] via-[#081228]/25 to-transparent sm:bg-gradient-to-r sm:from-transparent sm:via-[#081228]/40 sm:to-[#081228]" />
          {player.number && (
            <span
              className="font-display absolute top-4 left-4 text-[64px] leading-none opacity-25 sm:text-[88px]"
              style={{ color: "#f4f1e9" }}
            >
              {player.number}
            </span>
          )}
        </div>

        <div className="relative flex flex-col justify-end gap-4 p-5 sm:p-7">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {player.position && (
                <span
                  className="rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cream"
                  style={{ background: accent }}
                >
                  {player.position}
                </span>
              )}
              {player.teamAbbrev && (
                <span className="text-chalk text-[11px] uppercase tracking-[0.16em]">
                  {player.teamName ?? player.teamAbbrev}
                </span>
              )}
            </div>
            <p className="text-chalk text-[13px] tracking-wide">{player.firstName}</p>
            <h1 className="font-display text-cream text-[40px] leading-[0.95] sm:text-[48px]">
              {player.lastName || player.name}
            </h1>
            {player.positionName && (
              <p className="text-chalk-dim mt-2 text-[12px]">{player.positionName}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(player.hitting.length > 0
              ? player.hitting
              : player.pitching
            )
              .slice(0, 3)
              .map((s) => (
                <div
                  key={s.label}
                  className="rounded-lg border border-white/10 bg-black/25 px-2.5 py-2 backdrop-blur-sm"
                >
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">{s.label}</p>
                  <p className="numeral text-cream mt-0.5 text-[22px] leading-none">{s.value}</p>
                </div>
              ))}
          </div>

          <button
            type="button"
            onClick={onToggleFavorite}
            disabled={favoriting}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-sm px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition disabled:opacity-50",
              isFavorite
                ? "text-cream border border-white/20 bg-white/10"
                : "text-cream",
            )}
            style={
              isFavorite
                ? undefined
                : { background: `linear-gradient(180deg, ${accent}, #6b1218)` }
            }
          >
            <Star size={14} className={isFavorite ? "fill-current text-accent" : ""} />
            {isFavorite ? "Favorited" : "Add favorite"}
          </button>
        </div>
      </div>
    </article>
  );
}

function StatBlock({
  title,
  stats,
  accent,
}: {
  title: string;
  stats: MlbPlayerStatLine[];
  accent: string;
}) {
  return (
    <section>
      <h3 className="rule-head mb-3">{title}</h3>
      <dl className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-panel rounded-xl border border-white/[0.07] px-3 py-3"
          >
            <dt className="text-chalk-dim text-[10px] uppercase tracking-[0.14em]">{s.label}</dt>
            <dd className="numeral text-cream mt-1 text-[22px] leading-none" style={{ color: accent }}>
              {s.value}
            </dd>
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
      <dt className="text-chalk-dim text-[10px] uppercase tracking-[0.14em]">{label}</dt>
      <dd className="text-cream mt-0.5">{value}</dd>
    </div>
  );
}
