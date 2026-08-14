import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Loader2, Star } from "lucide-react";
import toast from "react-hot-toast";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import { useAuth } from "@/lib/auth-context";
import {
  addFavoritePlayer,
  isFavoritePlayer,
  removeFavoritePlayer,
} from "@/lib/favorite-players";
import { fetchNflPlayerProfile, nflHeadshot, type NflPlayerProfile } from "@/lib/nfl";
import { cn } from "@/lib/utils";

export default function NflPlayerPage() {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const swipeRef = useSwipeBack(() => navigate(-1));
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
  const accent = `#${(p?.teamColor ?? "d9515c").replace(/^#/, "")}`;

  return (
    <div ref={swipeRef} className="mx-auto max-w-6xl space-y-6 p-4 md:p-7">
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
        <div className="text-chalk flex min-h-[40vh] items-center justify-center gap-2">
          <Loader2 size={18} className="animate-spin" />
          Loading player…
        </div>
      ) : profile.isError || !p ? (
        <p className="text-alert text-[13px]">Couldn’t load this player.</p>
      ) : (
        <>
          <PlayerHero player={p} accent={accent} isFavorite={Boolean(fav.data)} onToggleFav={toggleFav} />

          {p.seasonStats.length > 0 && (
            <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
              <div className="border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b93a7]">
                  Season key stats
                </h2>
              </div>
              <div className="grid grid-cols-2 divide-x divide-white/[0.06] sm:grid-cols-4">
                {p.seasonStats.slice(0, 8).map((s) => (
                  <div key={s.label} className="border-b border-white/[0.05] px-3 py-4 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">
                      {s.label}
                    </p>
                    <p className="numeral text-cream mt-1 text-[26px] leading-none sm:text-[28px]">
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {p.statCategories.map((cat) => (
            <section
              key={cat.name}
              className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]"
            >
              <div className="border-b border-white/[0.06] px-4 py-2.5">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
                  {cat.name}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-center text-[12px]">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                      {cat.stats.map((s) => (
                        <th key={s.label} className="px-2 py-2 font-medium">
                          {s.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-white/[0.05]">
                      {cat.stats.map((s) => (
                        <td key={s.label} className="numeral text-cream px-2 py-2.5 text-[15px]">
                          {s.value}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          {p.recentGames.length > 0 && (
            <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
              <div className="border-b border-white/[0.06] px-4 py-2.5">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
                  Recent games
                </h3>
              </div>
              <ul className="divide-y divide-white/[0.05]">
                {p.recentGames.map((g) => (
                  <li
                    key={`${g.label}-${g.result}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[12px]"
                  >
                    <span className="text-cream min-w-[120px] font-medium">{g.label}</span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                        g.result.startsWith("W")
                          ? "bg-emerald-500/15 text-emerald-300"
                          : g.result.startsWith("L")
                            ? "bg-red-500/15 text-red-300"
                            : "bg-white/10 text-[#c8cdd8]",
                      )}
                    >
                      {g.result}
                    </span>
                    <span className="text-chalk min-w-0 flex-1 truncate">{g.line || "—"}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {p.news.length > 0 && (
            <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
              <h3 className="rule-head mb-3">News</h3>
              <ul className="space-y-3">
                {p.news.map((n) => (
                  <li key={n.headline} className="flex gap-3">
                    {n.image && (
                      <img
                        src={n.image}
                        alt=""
                        className="h-14 w-20 shrink-0 rounded-md object-cover"
                      />
                    )}
                    <div className="min-w-0">
                      {n.href ? (
                        <a
                          href={n.href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cream hover:text-accent inline-flex items-start gap-1 text-[13.5px] font-medium leading-snug"
                        >
                          {n.headline}
                          <ExternalLink size={11} className="mt-1 shrink-0 opacity-60" />
                        </a>
                      ) : (
                        <p className="text-cream text-[13.5px] font-medium leading-snug">
                          {n.headline}
                        </p>
                      )}
                      {n.description && (
                        <p className="text-chalk mt-1 line-clamp-2 text-[12px] leading-relaxed">
                          {n.description}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
            <h3 className="rule-head mb-3">Origin</h3>
            <dl className="grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-3">
              <BioItem label="Height" value={p.height ?? "—"} />
              <BioItem label="Weight" value={p.weight ?? "—"} />
              <BioItem label="Age" value={p.age != null ? String(p.age) : "—"} />
              <BioItem label="Born" value={p.dob ?? "—"} />
              <BioItem label="Birthplace" value={p.birthPlace ?? "—"} />
              <BioItem label="College" value={p.college ?? "—"} />
              <BioItem label="Draft" value={p.draft ?? "—"} />
              <BioItem label="Experience" value={p.experience ?? "—"} />
            </dl>
          </section>
        </>
      )}
    </div>
  );
}

function PlayerHero({
  player,
  accent,
  isFavorite,
  onToggleFav,
}: {
  player: NflPlayerProfile;
  accent: string;
  isFavorite: boolean;
  onToggleFav: () => void;
}) {
  const nameParts = player.name.trim().split(/\s+/);
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : player.name;
  const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : "";

  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/[0.1] shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(145deg, #0a1428 0%, ${accent}40 42%, #07101f 100%)`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#07101f] via-[#07101f]/75 to-[#07101f]/35" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#07101f] via-transparent to-[#07101f]/40" />

      <div className="relative z-10 flex flex-col gap-5 p-5 lg:flex-row lg:items-end lg:gap-8 lg:p-8">
        <div className="relative mx-auto shrink-0 sm:mx-0">
          <div className="overflow-hidden rounded-xl bg-[#dfe6f2] p-1 shadow-2xl ring-2 ring-white/30">
            <img
              src={player.headshot ?? nflHeadshot(player.id)}
              alt=""
              width={220}
              height={220}
              className="h-[170px] w-[170px] rounded-[10px] object-cover object-[center_12%] sm:h-[200px] sm:w-[200px] lg:h-[220px] lg:w-[220px]"
              onError={(e) => {
                e.currentTarget.src = nflHeadshot(player.id);
              }}
            />
          </div>
          {player.teamLogo && (
            <span className="absolute -right-2 -bottom-2 rounded-full bg-white p-1 shadow-lg">
              <img src={player.teamLogo} alt="" className="h-10 w-10 object-contain" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {player.teamId && player.teamName ? (
                  <Link
                    to={`/sports/nfl/team/${player.teamId}`}
                    className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/70 transition hover:text-white"
                  >
                    {player.teamName}
                  </Link>
                ) : player.teamName ? (
                  <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/70">
                    {player.teamName}
                  </span>
                ) : null}
                <span className="rounded-sm border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                  NFL
                </span>
              </div>
              {firstName && (
                <p className="mt-1 text-[13px] font-medium uppercase tracking-[0.08em] text-white/65">
                  {firstName}
                </p>
              )}
              <h1 className="font-display text-[40px] leading-[0.92] text-white sm:text-[52px] lg:text-[56px]">
                {lastName}
              </h1>
              {(player.number || player.position) && (
                <p className="mt-1.5 text-[13px] text-white/75">
                  {[player.number ? `#${player.number}` : null, player.positionName ?? player.position]
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

          <dl className="mt-4 grid grid-cols-2 gap-2.5 text-[12.5px] sm:grid-cols-3 lg:grid-cols-4">
            {(player.height || player.weight) && (
              <div>
                <dt className="text-[10px] uppercase tracking-[0.14em] text-white/50">HT / WT</dt>
                <dd className="mt-0.5 text-white">
                  {[player.height, player.weight].filter(Boolean).join(" · ")}
                </dd>
              </div>
            )}
            {player.college && (
              <div>
                <dt className="text-[10px] uppercase tracking-[0.14em] text-white/50">College</dt>
                <dd className="mt-0.5 text-white">{player.college}</dd>
              </div>
            )}
            {player.draft && (
              <div>
                <dt className="text-[10px] uppercase tracking-[0.14em] text-white/50">Draft</dt>
                <dd className="mt-0.5 text-white">{player.draft}</dd>
              </div>
            )}
            {player.experience && (
              <div>
                <dt className="text-[10px] uppercase tracking-[0.14em] text-white/50">Exp</dt>
                <dd className="mt-0.5 text-white">{player.experience}</dd>
              </div>
            )}
          </dl>

          <button
            type="button"
            onClick={() => void onToggleFav()}
            className={cn(
              "mt-4 inline-flex items-center gap-2 rounded-sm border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition",
              isFavorite
                ? "border-accent/50 bg-accent/15 text-cream"
                : "border-white/25 bg-black/25 text-white/85 hover:border-white/50 hover:text-white",
            )}
          >
            <Star size={13} className={isFavorite ? "fill-accent text-accent" : ""} />
            {isFavorite ? "Favorited" : "Add to favorites"}
          </button>
        </div>
      </div>
    </article>
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
