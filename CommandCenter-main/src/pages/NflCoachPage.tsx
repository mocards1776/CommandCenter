import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Flame, Loader2 } from "lucide-react";
import { fetchNflCoachProfile } from "@/lib/nfl";
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

export default function NflCoachPage() {
  const { coachId } = useParams<{ coachId: string }>();
  const navigate = useNavigate();
  const swipeRef = useSwipeBack(() => navigate(-1));

  const detail = useQuery({
    queryKey: ["nfl-coach-v1", coachId],
    queryFn: () => fetchNflCoachProfile(coachId!),
    enabled: Boolean(coachId),
    staleTime: 180_000,
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
          to="/sports/hot-seat?sport=nfl&solo=1"
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
            ) : c.logo ? (
              <img
                src={c.logo}
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
                {c.record && <span className="numeral text-cream font-semibold">{c.record}</span>}
                <span className={cn("font-bold uppercase tracking-[0.14em]", heatTone(c.hotSeatRank))}>
                  #{c.hotSeatRank} {heatLabel(c.hotSeatRank)}
                </span>
              </div>
            </div>
          </div>
          <div className="sm:ml-auto">
            <div className="rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                Kalshi out %
              </p>
              <p className={cn("numeral text-[28px] font-semibold", heatTone(c.hotSeatRank))}>
                {c.firedOddsPct != null ? `${c.firedOddsPct.toFixed(1)}%` : "—"}
              </p>
              {c.firedOddsAmerican && (
                <p className="numeral text-[12px] text-white/55">{c.firedOddsAmerican}</p>
              )}
            </div>
          </div>
        </div>
      </article>

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
            to={`/sports/nfl/team/${c.teamId}`}
            className="text-accent inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] hover:underline"
          >
            {c.teamName} page
          </Link>
        )}
        {c.kalshiUrl && (
          <a
            href={c.kalshiUrl}
            target="_blank"
            rel="noreferrer"
            className="text-chalk-dim hover:text-cream inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em]"
          >
            Kalshi market <ExternalLink size={11} />
          </a>
        )}
      </div>
    </div>
  );
}
