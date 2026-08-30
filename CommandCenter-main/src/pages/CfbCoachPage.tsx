import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Flame, Loader2, Star } from "lucide-react";
import toast from "react-hot-toast";
import { fetchCfbCoachProfile } from "@/lib/cfb";
import {
  addFavoriteCoach,
  isFavoriteCoach,
  removeFavoriteCoach,
} from "@/lib/favorite-coaches";
import { useAuth } from "@/lib/auth-context";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import { cn } from "@/lib/utils";

function heatTone(rank: number): string {
  if (rank <= 5) return "text-alert";
  if (rank <= 12) return "text-amber-300";
  if (rank <= 20) return "text-[#c8cdd8]";
  return "text-emerald-300";
}

function heatLabel(rank: number): string {
  if (rank <= 5) return "Blazing";
  if (rank <= 12) return "Warm";
  if (rank <= 20) return "Cool";
  return "Safe";
}

export default function CfbCoachPage() {
  const { coachId } = useParams<{ coachId: string }>();
  const navigate = useNavigate();
  const swipeRef = useSwipeBack(() => navigate(-1));
  const { user } = useAuth();
  const qc = useQueryClient();

  const detail = useQuery({
    queryKey: ["cfb-coach-v3", coachId],
    queryFn: () => fetchCfbCoachProfile(coachId!),
    enabled: Boolean(coachId),
    staleTime: 180_000,
  });

  const favId = detail.data?.id ?? coachId;
  const favQuery = useQuery({
    queryKey: ["favorite-coach", user?.id, favId],
    queryFn: () => isFavoriteCoach(user!.id, favId!),
    enabled: Boolean(user?.id && favId),
  });

  const toggleFav = useMutation({
    mutationFn: async () => {
      if (!user || !detail.data) throw new Error("Sign in to favorite coaches");
      const id = detail.data.id;
      const nowFav = !favQuery.data;
      if (nowFav) {
        await addFavoriteCoach({
          userId: user.id,
          coachId: id,
          coachName: detail.data.name,
          teamName: detail.data.teamName,
          teamId: detail.data.teamId,
          sport: "football",
          league: "CFB",
        });
      } else {
        await removeFavoriteCoach(user.id, id);
      }
      return nowFav;
    },
    onSuccess: (nowFav) => {
      void qc.invalidateQueries({ queryKey: ["favorite-coach", user?.id, favId] });
      void qc.invalidateQueries({ queryKey: ["favorite-coaches", user?.id] });
      void qc.invalidateQueries({ queryKey: ["favorite-players", user?.id] });
      toast.success(nowFav ? "Coach favorited" : "Removed from favorites");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't update favorite"),
  });

  if (detail.isPending) {
    return (
      <div className="text-chalk flex min-h-[50vh] items-center justify-center gap-2">
        <Loader2 size={18} className="animate-spin" />
        Loading coach…
      </div>
    );
  }

  if (detail.isError || !detail.data) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-7">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-chalk hover:text-cream inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.14em]"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <p className="text-alert text-[13px]">
          {detail.error instanceof Error ? detail.error.message : "Coach unavailable"}
        </p>
      </div>
    );
  }

  const c = detail.data;
  const accent = `#${c.teamColor}`;
  const isFavorite = Boolean(favQuery.data);

  return (
    <div ref={swipeRef} className="mx-auto max-w-3xl space-y-6 p-4 md:p-7">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-chalk hover:text-cream inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.14em]"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <Link
          to="/sports/hot-seat?sport=cfb&solo=1"
          className="text-chalk hover:text-cream text-[11px] uppercase tracking-[0.14em]"
        >
          Hot Seat
        </Link>
      </div>

      <article className="relative overflow-hidden rounded-2xl border border-white/[0.1]">
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(145deg, #0a1428 0%, ${accent}55 45%, #07101f 100%)`,
          }}
        />
        <div className="relative z-10 flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:p-7">
          <div className="flex items-center gap-4">
            {c.headshot ? (
              <img
                src={c.headshot}
                alt=""
                className="h-28 w-28 rounded-xl bg-[#dfe6f2] object-cover object-top ring-2 ring-white/25"
              />
            ) : c.teamLogo ? (
              <img
                src={c.teamLogo}
                alt=""
                className="h-24 w-24 rounded-xl bg-white object-contain p-2 ring-2 ring-white/20"
              />
            ) : null}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
                Head coach · {c.teamAbbrev}
              </p>
              <h1 className="font-display text-cream mt-1 text-[32px] leading-none sm:text-[40px]">
                {c.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-white/75">
                {c.career?.summary ? (
                  <span className="numeral text-cream font-semibold">
                    Career {c.career.summary}
                  </span>
                ) : c.recordSummary ? (
                  <span className="numeral text-cream font-semibold">{c.recordSummary}</span>
                ) : null}
                {c.hotSeatRank > 0 ? (
                  <span className={cn("font-bold uppercase tracking-[0.14em]", heatTone(c.hotSeatRank))}>
                    #{c.hotSeatRank} {heatLabel(c.hotSeatRank)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:ml-auto sm:items-end">
            <div className="rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                Out odds
              </p>
              <p className={cn("numeral text-[28px] font-semibold", heatTone(c.hotSeatRank))}>
                {c.firedOddsPct != null ? `${c.firedOddsPct.toFixed(1)}%` : "—"}
              </p>
              {c.firedOddsAmerican && (
                <p className="numeral text-[12px] text-white/55">{c.firedOddsAmerican}</p>
              )}
              {c.oddsSource && (
                <p className="mt-1 text-[9px] uppercase tracking-[0.14em] text-white/40">
                  {c.oddsSource}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => toggleFav.mutate()}
              disabled={!user || toggleFav.isPending}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition disabled:opacity-50",
                isFavorite
                  ? "border border-white/30 bg-white/10 text-white"
                  : "text-cream",
              )}
              style={isFavorite ? undefined : { background: accent }}
            >
              <Star size={14} className={isFavorite ? "fill-current text-accent" : ""} />
              {isFavorite ? "Favorited" : "Favorite coach"}
            </button>
          </div>
        </div>
      </article>

      {c.seasonRecords.length > 0 && (
        <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
              Record by year
            </h2>
            <p className="text-chalk-dim mt-0.5 text-[11px]">
              School and W–L from ESPN coach seasons
              {c.career ? ` · Career ${c.career.summary}` : ""}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-[13px]">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.14em] text-[#8b93a7]">
                  <th className="px-4 py-2 font-semibold">Year</th>
                  <th className="px-4 py-2 font-semibold">School</th>
                  <th className="px-4 py-2 font-semibold">Record</th>
                </tr>
              </thead>
              <tbody>
                {c.seasonRecords.map((row) => (
                  <tr
                    key={`${row.season}-${row.teamId ?? row.school}`}
                    className="border-b border-white/[0.04] last:border-0"
                  >
                    <td className="numeral text-cream px-4 py-2.5 font-medium">{row.season}</td>
                    <td className="px-4 py-2.5 text-[#c8cdd8]">
                      {row.teamId ? (
                        <Link
                          to={`/sports/cfb/team/${row.teamId}`}
                          className="hover:text-cream hover:underline"
                        >
                          {row.school}
                          {row.teamAbbrev ? (
                            <span className="text-chalk-dim ml-1.5 text-[11px]">{row.teamAbbrev}</span>
                          ) : null}
                        </Link>
                      ) : (
                        row.school
                      )}
                    </td>
                    <td className="numeral text-cream px-4 py-2.5 font-semibold">{row.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {c.staff.length > 0 && (
        <section className="bg-panel space-y-3 rounded-xl border border-white/[0.08] p-4">
          <div>
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
              Coaching staff
            </h2>
            <p className="text-chalk-dim mt-0.5 text-[11px]">
              Assistants at {c.teamName} · Wikipedia season staff when available
            </p>
          </div>
          <ul className="divide-y divide-white/[0.05]">
            {c.staff.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                {s.headshot ? (
                  <img
                    src={s.headshot}
                    alt=""
                    className="h-10 w-10 rounded-lg bg-[#dfe6f2] object-cover object-top"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="grid h-10 w-10 place-items-center rounded-lg text-[11px] font-semibold text-white"
                    style={{ background: `${accent}99` }}
                  >
                    {s.name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((p) => p[0])
                      .join("")
                      .toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-cream truncate text-[14px] font-medium">{s.name}</p>
                  <p className="text-[11px] text-[#8b93a7]">{s.title}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="bg-panel space-y-3 rounded-xl border border-white/[0.08] p-4">
        <div className="flex items-center gap-2">
          <Flame size={16} className="text-alert" />
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
            Heat factors
          </h2>
        </div>
        <ul className="space-y-2">
          {c.factors.map((f) => (
            <li
              key={f.label}
              className="flex items-start justify-between gap-3 border-b border-white/[0.05] pb-2 last:border-0"
            >
              <div>
                <p className="text-[13px] font-medium text-cream">{f.label}</p>
                {f.detail && <p className="text-[11px] text-[#8b93a7]">{f.detail}</p>}
              </div>
              <span
                className={cn(
                  "numeral text-[13px] font-semibold",
                  f.points > 0 ? "text-alert" : f.points < 0 ? "text-emerald-300" : "text-[#8b93a7]",
                )}
              >
                {f.points > 0 ? "+" : ""}
                {f.points}
              </span>
            </li>
          ))}
          {c.factors.length === 0 && (
            <li className="text-chalk-dim text-[13px]">No heat factors for this coach yet.</li>
          )}
        </ul>
      </section>

      {c.careerHighlights.length > 0 && (
        <section className="bg-panel space-y-2 rounded-xl border border-white/[0.08] p-4">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
            Snapshot
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-[13px] text-[#c8cdd8]">
            {c.careerHighlights.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      {c.bio && (
        <section className="bg-panel space-y-2 rounded-xl border border-white/[0.08] p-4">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">Bio</h2>
          <p className="text-[13.5px] leading-relaxed text-[#c8cdd8]">{c.bio}</p>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        {c.teamId !== "0" && (
          <Link
            to={`/sports/cfb/team/${c.teamId}`}
            className="text-accent inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] hover:underline"
          >
            {c.teamName} team page
          </Link>
        )}
        {c.cfbRefUrl && (
          <a
            href={c.cfbRefUrl}
            target="_blank"
            rel="noreferrer"
            className="text-chalk-dim hover:text-cream inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em]"
          >
            College Football Reference <ExternalLink size={11} />
          </a>
        )}
        {c.kalshiUrl && (
          <a
            href={c.kalshiUrl}
            target="_blank"
            rel="noreferrer"
            className="text-chalk-dim hover:text-cream inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em]"
          >
            Odds market <ExternalLink size={11} />
          </a>
        )}
      </div>
    </div>
  );
}
