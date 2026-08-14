import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Star } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import {
  addFavoritePlayer,
  isFavoritePlayer,
  removeFavoritePlayer,
} from "@/lib/favorite-players";
import { fetchNflPlayerProfile, nflHeadshot } from "@/lib/nfl";
import { cn } from "@/lib/utils";

export default function NflPlayerPage() {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const profile = useQuery({
    queryKey: ["nfl-player", playerId],
    queryFn: () => fetchNflPlayerProfile(playerId!),
    enabled: Boolean(playerId),
    staleTime: 120_000,
  });

  const fav = useQuery({
    queryKey: ["favorite-player", user?.id, playerId],
    queryFn: () => isFavoritePlayer(user!.id, playerId!),
    enabled: Boolean(user?.id && playerId),
  });

  const toggleFav = async () => {
    if (!user?.id || !playerId || !profile.data) return;
    try {
      if (fav.data) {
        await removeFavoritePlayer(user.id, playerId);
        toast.success("Removed favorite");
      } else {
        await addFavoritePlayer({
          userId: user.id,
          playerId,
          playerName: profile.data.name,
          teamName: profile.data.teamName,
          teamId: profile.data.teamId,
          position: profile.data.position,
          sport: "football",
          league: "NFL",
        });
        toast.success("Favorited NFL player");
      }
      await qc.invalidateQueries({ queryKey: ["favorite-player", user.id, playerId] });
      await qc.invalidateQueries({ queryKey: ["favorite-players", user.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update favorite");
    }
  };

  if (!playerId) {
    return <p className="text-alert p-6 text-[13px]">Missing player id</p>;
  }

  const p = profile.data;

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
        <Link
          to="/sports/nfl?solo=1"
          className="text-chalk-dim hover:text-cream text-[11px] uppercase tracking-[0.14em]"
        >
          NFL board
        </Link>
      </div>

      {profile.isPending ? (
        <p className="text-chalk flex items-center gap-2 text-[13px]">
          <Loader2 size={14} className="animate-spin" /> Loading player…
        </p>
      ) : profile.isError || !p ? (
        <p className="text-alert text-[13px]">Couldn’t load this player.</p>
      ) : (
        <>
          <article className="bg-panel flex flex-col gap-5 overflow-hidden rounded-2xl border border-white/[0.1] p-5 sm:flex-row sm:items-end sm:p-7">
            <div className="mx-auto shrink-0 overflow-hidden rounded-xl bg-[#dfe6f2] ring-2 ring-white/20 sm:mx-0">
              <img
                src={p.headshot ?? nflHeadshot(p.id)}
                alt=""
                className="h-[140px] w-[140px] object-cover object-top"
                onError={(e) => {
                  e.currentTarget.src = nflHeadshot(p.id);
                }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b93a7]">
                NFL
                {p.position ? ` · ${p.position}` : ""}
                {p.number ? ` · #${p.number}` : ""}
              </p>
              <h1 className="font-display text-cream mt-1 text-[32px] leading-tight sm:text-[40px]">
                {p.name}
              </h1>
              <p className="text-chalk mt-2 text-[13px]">
                {[p.teamName, p.height, p.weight, p.age != null ? `Age ${p.age}` : null, p.college]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {p.experience && (
                <p className="text-chalk-dim mt-1 text-[12px]">{p.experience}</p>
              )}
              <button
                type="button"
                onClick={() => void toggleFav()}
                className={cn(
                  "mt-4 inline-flex items-center gap-2 rounded-sm border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition",
                  fav.data
                    ? "border-accent/50 bg-accent/15 text-cream"
                    : "border-white/15 text-chalk hover:border-accent/40 hover:text-cream",
                )}
              >
                <Star size={13} className={fav.data ? "fill-accent text-accent" : ""} />
                {fav.data ? "Favorited" : "Add to favorites"}
              </button>
            </div>
          </article>

          {p.seasonStats.length > 0 && (
            <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
              <div className="border-b border-white/[0.06] px-4 py-2.5">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
                  Season
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
                {p.seasonStats.map((s) => (
                  <div
                    key={s.label}
                    className="border-b border-r border-white/[0.05] px-3 py-4 text-center"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">
                      {s.label}
                    </p>
                    <p className="numeral text-cream mt-1 text-[20px]">{s.value}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
