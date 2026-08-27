import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar, Loader2 } from "lucide-react";
import CfbRankLabel from "@/components/sports/CfbRankLabel";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import { fetchCfbTeamPage } from "@/lib/cfb";
import { formatSportsDate } from "@/lib/utils";

export default function CfbTeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const swipeRef = useSwipeBack(() => navigate(-1));

  const team = useQuery({
    queryKey: ["cfb-team", teamId],
    queryFn: () => fetchCfbTeamPage(teamId!),
    enabled: Boolean(teamId),
    staleTime: 120_000,
  });

  if (!teamId) {
    return <p className="text-alert p-6 text-[13px]">Missing team id</p>;
  }

  const t = team.data;
  const accent = `#${(t?.color ?? "d9515c").replace(/^#/, "")}`;

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
          to="/sports/cfb?solo=1"
          className="text-chalk-dim hover:text-cream text-[11px] uppercase tracking-[0.14em]"
        >
          CFB board
        </Link>
      </div>

      {team.isPending ? (
        <div className="text-chalk flex min-h-[40vh] items-center justify-center gap-2">
          <Loader2 size={18} className="animate-spin" />
          Loading team…
        </div>
      ) : team.isError || !t ? (
        <p className="text-alert text-[13px]">
          {team.error instanceof Error ? team.error.message : "Couldn’t load this team."}
        </p>
      ) : (
        <>
          <article
            className="relative overflow-hidden rounded-2xl border border-white/[0.1] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)] md:p-7"
            style={{
              background: `linear-gradient(145deg, #0a1428 0%, ${accent}55 45%, #07101f 100%)`,
            }}
          >
            <div className="relative z-10 flex flex-wrap items-center gap-4">
              {t.logo ? (
                <img src={t.logo} alt="" className="h-16 w-16 object-contain md:h-20 md:w-20" />
              ) : null}
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
                  {t.abbrev}
                  {t.fpiRank != null ? (
                    <>
                      {" · "}
                      <CfbRankLabel pollRank={null} fpiRank={t.fpiRank} />
                    </>
                  ) : null}
                </p>
                <h1 className="font-display text-[28px] leading-tight text-white md:text-[36px]">
                  {t.name}
                </h1>
                <p className="mt-1 text-[13px] text-white/75">
                  {[t.record, t.standing].filter(Boolean).join(" · ") || "College football"}
                </p>
              </div>
            </div>
          </article>

          {t.nextEvent && (
            <Link
              to={`/sports/cfb/game/${t.nextEvent.id}`}
              className="bg-panel hover:border-accent/40 flex items-center gap-3 rounded-xl border border-white/[0.08] px-4 py-3.5 transition"
            >
              <Calendar size={16} className="text-accent shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">
                  Next event
                </p>
                <p className="text-cream truncate text-[14px] font-medium">{t.nextEvent.name}</p>
              </div>
              {t.nextEvent.date && (
                <span className="text-chalk-dim shrink-0 text-[12px]">
                  {formatSportsDate(t.nextEvent.date)}
                </span>
              )}
            </Link>
          )}

          {t.recent.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
                This week
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {t.recent.map((g) => (
                  <Link
                    key={g.id}
                    to={`/sports/cfb/game/${g.id}`}
                    className="bg-panel hover:border-accent/40 rounded-lg border border-white/[0.08] px-3 py-3 transition"
                  >
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[#8b93a7]">
                      {g.live ? g.shortDetail || "Live" : g.final ? "Final" : g.whenShort || "Upcoming"}
                    </p>
                    <p className="text-cream mt-1 text-[14px] font-semibold">
                      {g.away.abbrev} {g.away.score ?? "—"} · {g.home.abbrev} {g.home.score ?? "—"}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {t.roster.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
                Roster
              </h2>
              <div className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
                <ul className="divide-y divide-white/[0.05]">
                  {t.roster.slice(0, 60).map((p) => (
                    <li key={p.id}>
                      <Link
                        to={`/sports/cfb/player/${p.id}`}
                        className="hover:bg-white/[0.03] flex items-center gap-3 px-3 py-2.5 transition"
                      >
                        {p.headshot ? (
                          <img
                            src={p.headshot}
                            alt=""
                            className="h-9 w-9 rounded-full object-cover bg-white/10"
                            loading="lazy"
                          />
                        ) : (
                          <span className="h-9 w-9 rounded-full bg-white/10" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-cream truncate text-[13px] font-medium">{p.name}</p>
                          <p className="text-chalk-dim text-[11px]">
                            {[p.number ? `#${p.number}` : null, p.position].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
