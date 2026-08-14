import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Cake,
  Calendar,
  ChartNoAxesColumn,
  CheckCircle2,
  ChevronRight,
  DollarSign,
  Flag,
  Loader2,
  Medal,
  Ruler,
  Star,
  Trophy,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import {
  addFavoritePlayer,
  isFavoritePlayer,
  removeFavoritePlayer,
} from "@/lib/favorite-players";
import { fetchGolferProfile } from "@/lib/sports";
import { cn } from "@/lib/utils";

function InfoCard({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string; Icon?: typeof Trophy }[];
}) {
  return (
    <section className="rounded-xl border border-white/[0.1] bg-[#12151c] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold text-white">{title}</h2>
        <ChevronRight size={16} className="text-white/35" />
      </div>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={`${title}-${r.label}`} className="flex items-center gap-2.5 text-[13px]">
            {r.Icon ? <r.Icon size={15} className="shrink-0 text-white/55" /> : null}
            <span className="text-white/90">
              <span className="font-semibold text-white">{r.value}</span>
              {r.label ? <span className="text-white/55"> {r.label}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

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

  const p = profile.data;

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-7">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-chalk hover:text-cream flex items-center gap-2 text-[11px] uppercase tracking-[0.14em]"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <Link
          to="/sports?solo=1&golf=1"
          className="text-chalk-dim hover:text-cream text-[11px] uppercase tracking-[0.14em]"
        >
          Favorites
        </Link>
      </div>

      {profile.isPending ? (
        <p className="text-chalk flex items-center gap-2 text-[13px]">
          <Loader2 size={14} className="animate-spin" /> Loading golfer…
        </p>
      ) : profile.isError || !p ? (
        <p className="text-alert text-[13px]">Couldn’t load this golfer.</p>
      ) : (
        <>
          <article className="relative overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0b0e14]">
            {p.headshot && (
              <div className="pointer-events-none absolute inset-0 opacity-35">
                <img
                  src={p.headshot}
                  alt=""
                  className="h-full w-full object-cover object-[center_20%] blur-[1px]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0b0e14] via-[#0b0e14]/85 to-[#0b0e14]/40" />
              </div>
            )}
            <div className="relative z-10 px-5 pb-6 pt-8 text-center sm:px-8">
              <div className="mb-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void toggleFav()}
                  className={cn(
                    "rounded-full border p-2 transition",
                    fav.data
                      ? "border-[#4ea1ff]/50 bg-[#4ea1ff]/15 text-[#4ea1ff]"
                      : "border-white/20 text-white/70 hover:text-white",
                  )}
                  aria-label={fav.data ? "Unfavorite" : "Favorite"}
                >
                  <Star size={16} className={fav.data ? "fill-[#4ea1ff]" : ""} />
                </button>
              </div>
              <h1 className="font-display text-[36px] leading-tight text-white sm:text-[44px]">
                {p.name}
              </h1>
              <p className="mt-2 inline-flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                {p.flagUrl && <img src={p.flagUrl} alt="" className="h-3.5 w-5 object-cover" />}
                {p.citizenship ?? "PGA Tour"}
              </p>
            </div>
          </article>

          {p.rankings.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {p.rankings.map((r) => (
                <div
                  key={r.label}
                  className="min-w-[7.5rem] flex-1 rounded-xl border border-white/[0.1] bg-[#12151c] px-3 py-3"
                >
                  <p className="flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-white/45">
                    <Trophy size={11} /> {r.label}
                  </p>
                  <p className="numeral mt-1 text-[28px] leading-none text-white">{r.rank}</p>
                  {r.detail && (
                    <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/45">
                      {r.detail}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {p.highlights.length > 0 && (
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
              {p.highlights.map((h) => {
                const inner = (
                  <>
                    <div className="h-20 w-20 overflow-hidden rounded-full border border-white/15 bg-[#1a2030]">
                      {h.image ? (
                        <img src={h.image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-white/30">
                          <Flag size={18} />
                        </div>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-2 max-w-[5.5rem] text-center text-[10px] leading-snug text-white/70">
                      {h.headline}
                    </p>
                  </>
                );
                return h.href ? (
                  <a
                    key={h.headline}
                    href={h.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex w-[5.5rem] shrink-0 flex-col items-center"
                  >
                    {inner}
                  </a>
                ) : (
                  <div key={h.headline} className="flex w-[5.5rem] shrink-0 flex-col items-center">
                    {inner}
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoCard
              title="Career (PGA TOUR)"
              rows={[
                { label: "Wins", value: p.career[0]?.value ?? "—", Icon: Trophy },
                { label: "Earnings", value: p.career[1]?.value ?? "—", Icon: DollarSign },
                { label: "Cuts Made", value: p.career[2]?.value ?? "—", Icon: CheckCircle2 },
              ]}
            />
            <InfoCard
              title={`Season (${new Date().getFullYear()})`}
              rows={[
                { label: "Wins", value: p.season[0]?.value ?? "—", Icon: Trophy },
                { label: "Top 10", value: p.season[1]?.value ?? "—", Icon: Medal },
                { label: "Cuts Made", value: p.season[2]?.value ?? "—", Icon: CheckCircle2 },
              ]}
            />
            <InfoCard
              title="Bio"
              rows={p.bioFacts.map((f) => ({
                label: f.label === "Height" ? "" : f.label,
                value: f.value,
                Icon: f.label === "Height" ? Ruler : f.label === "Age" ? Cake : Calendar,
              }))}
            />
            <InfoCard
              title="Stats"
              rows={p.performance.map((s) => ({
                label: s.label,
                value: s.value,
                Icon: /putt/i.test(s.label)
                  ? Flag
                  : /tee|driv/i.test(s.label)
                    ? Flag
                    : ChartNoAxesColumn,
              }))}
            />
          </div>

          {p.seasonStats.length > 0 && (
            <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#12151c]">
              <div className="border-b border-white/[0.06] px-4 py-2.5">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
                  Season overview
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6">
                {p.seasonStats.map((s) => (
                  <div
                    key={s.label}
                    className="border-b border-r border-white/[0.05] px-3 py-4 text-center"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">
                      {s.label}
                    </p>
                    <p className="numeral mt-1 text-[20px] text-white">{s.value}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {p.recentNews.length > 0 && (
            <section className="space-y-3 rounded-xl border border-white/[0.08] bg-[#12151c] p-4">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
                Recent
              </h2>
              {p.recentNews.map((n) => (
                <div key={n.headline} className="border-t border-white/[0.05] pt-3 first:border-0 first:pt-0">
                  <p className="text-[13px] font-medium text-white">{n.headline}</p>
                  {n.description && (
                    <p className="mt-1 text-[12px] leading-relaxed text-white/55">{n.description}</p>
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
