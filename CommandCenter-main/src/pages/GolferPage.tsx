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
import { fetchGolferProfile } from "@/lib/sports";
import { cn } from "@/lib/utils";

export default function GolferPage() {
  const { golferId } = useParams<{ golferId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const profile = useQuery({
    queryKey: ["golfer-profile", golferId],
    queryFn: () => fetchGolferProfile(golferId!),
    enabled: Boolean(golferId),
    staleTime: 120_000,
  });

  const fav = useQuery({
    queryKey: ["favorite-player", user?.id, golferId],
    queryFn: () => isFavoritePlayer(user!.id, golferId!),
    enabled: Boolean(user?.id && golferId),
  });

  const toggleFav = async () => {
    if (!user?.id || !golferId || !profile.data) return;
    try {
      if (fav.data) {
        await removeFavoritePlayer(user.id, golferId);
        toast.success("Removed favorite golfer");
      } else {
        await addFavoritePlayer({
          userId: user.id,
          playerId: golferId,
          playerName: profile.data.name,
          sport: "golf",
          league: "PGA Tour",
          position: "G",
        });
        toast.success("Favorited golfer");
      }
      await qc.invalidateQueries({ queryKey: ["favorite-player", user.id, golferId] });
      await qc.invalidateQueries({ queryKey: ["favorite-players", user.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update favorite");
    }
  };

  if (!golferId) {
    return <p className="text-alert p-6 text-[13px]">Missing golfer id</p>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-7">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-chalk hover:text-cream flex items-center gap-2 text-[11px] uppercase tracking-[0.14em]"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <Link
          to="/sports?solo=1"
          className="text-chalk-dim hover:text-cream text-[11px] uppercase tracking-[0.14em]"
        >
          Board
        </Link>
      </div>

      {profile.isPending ? (
        <p className="text-chalk flex items-center gap-2 text-[13px]">
          <Loader2 size={14} className="animate-spin" /> Loading golfer…
        </p>
      ) : profile.isError || !profile.data ? (
        <p className="text-alert text-[13px]">Couldn’t load this golfer.</p>
      ) : (
        <>
          <article className="relative overflow-hidden rounded-2xl border border-white/[0.1] bg-gradient-to-br from-[#0a1f14] via-[#07101d] to-[#0c1810] p-5 sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
              <div className="mx-auto shrink-0 overflow-hidden rounded-xl bg-[#dfe6f2] ring-2 ring-white/25 sm:mx-0">
                <img
                  src={profile.data.headshot ?? undefined}
                  alt=""
                  className="h-[140px] w-[140px] object-cover object-top"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200/70">
                  PGA Tour
                </p>
                <h1 className="font-display text-cream mt-1 text-[34px] leading-tight sm:text-[42px]">
                  {profile.data.name}
                </h1>
                <p className="text-chalk mt-2 text-[13px]">
                  {[
                    profile.data.age != null ? `Age ${profile.data.age}` : null,
                    profile.data.college,
                    profile.data.birthPlace,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {profile.data.bio && (
                  <p className="text-chalk mt-3 max-w-2xl text-[13px] leading-relaxed">
                    {profile.data.bio}
                  </p>
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
                  {fav.data ? "Favorited" : "Favorite golfer"}
                </button>
              </div>
            </div>
          </article>

          {profile.data.seasonStats.length > 0 && (
            <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
              <div className="border-b border-white/[0.06] px-4 py-2.5">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
                  Season stats
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6">
                {profile.data.seasonStats.map((s) => (
                  <div
                    key={s.label}
                    className="border-b border-r border-white/[0.05] px-3 py-4 text-center last:border-r-0"
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

          {profile.data.recentNews.length > 0 && (
            <section className="bg-panel space-y-3 rounded-xl border border-white/[0.08] p-4">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
                Recent
              </h2>
              {profile.data.recentNews.map((n) => (
                <div key={n.headline} className="border-t border-white/[0.05] pt-3 first:border-0 first:pt-0">
                  <p className="text-cream text-[13px] font-medium">{n.headline}</p>
                  {n.description && (
                    <p className="text-chalk mt-1 text-[12px] leading-relaxed">{n.description}</p>
                  )}
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
