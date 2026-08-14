import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import NflFieldMap from "@/components/sports/NflFieldMap";
import { fetchNflGameDetail } from "@/lib/nfl";
import { cn } from "@/lib/utils";

export default function NflGamePage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const detail = useQuery({
    queryKey: ["nfl-game", eventId],
    queryFn: () => fetchNflGameDetail(eventId!),
    enabled: Boolean(eventId),
    refetchInterval: (q) => (q.state.data?.live ? 12_000 : false),
    staleTime: 8_000,
  });

  const g = detail.data;

  const homeYardLine = useMemo(() => {
    if (!g) return null;
    if (g.situation?.yardLine != null) return g.situation.yardLine;
    const play = g.recentPlays[0];
    if (play?.yardLine != null) return play.yardLine;
    return null;
  }, [g]);

  if (!eventId) {
    return <p className="text-alert p-6 text-[13px]">Missing game id</p>;
  }

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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void detail.refetch().then(() => toast.success("Game updated"))}
            className="text-chalk hover:text-cream rounded-sm border border-white/10 p-2"
            aria-label="Refresh"
          >
            <RefreshCw size={14} className={detail.isFetching ? "animate-spin" : ""} />
          </button>
          <Link
            to="/sports/nfl?solo=1"
            className="text-chalk-dim hover:text-cream text-[11px] uppercase tracking-[0.14em]"
          >
            Scoreboard
          </Link>
        </div>
      </div>

      {detail.isPending ? (
        <p className="text-chalk flex items-center gap-2 text-[13px]">
          <Loader2 size={14} className="animate-spin" /> Loading game…
        </p>
      ) : detail.isError || !g ? (
        <p className="text-alert text-[13px]">Couldn’t load this NFL game.</p>
      ) : (
        <>
          <header className="bg-panel overflow-hidden rounded-2xl border border-white/[0.1]">
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
              <p
                className={cn(
                  "text-[11px] font-semibold uppercase tracking-[0.16em]",
                  g.live ? "text-alert" : "text-chalk-dim",
                )}
              >
                {g.live ? "Live" : g.final ? "Final" : "Scheduled"} · {g.shortDetail}
              </p>
              {g.venue && <p className="text-chalk-dim truncate text-[11px]">{g.venue}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4 p-5">
              {[g.away, g.home].map((side) => (
                <div key={side.teamId} className="flex items-center gap-3">
                  {side.logo && <img src={side.logo} alt="" className="h-12 w-12 object-contain" />}
                  <div className="min-w-0">
                    <p className="text-cream truncate text-[16px] font-semibold">{side.name}</p>
                    <p className="text-chalk-dim text-[11px]">{side.record ?? side.abbrev}</p>
                  </div>
                  <span className="numeral text-cream ml-auto text-[36px] leading-none">
                    {side.score ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          </header>

          {(g.live || g.situation || homeYardLine != null) && (
            <NflFieldMap
              game={g}
              homeYardLine={homeYardLine}
              possessionTeamId={g.situation?.possessionTeamId ?? null}
              downDistanceText={g.situation?.downDistanceText}
            />
          )}

          {g.recentPlays.length > 0 && (
            <section className="bg-panel rounded-xl border border-white/[0.08]">
              <div className="border-b border-white/[0.06] px-4 py-2.5">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
                  Play-by-play
                </h2>
              </div>
              <ul className="max-h-[28rem] divide-y divide-white/[0.05] overflow-y-auto">
                {g.recentPlays.map((p) => (
                  <li
                    key={p.id}
                    className={cn(
                      "px-4 py-2.5",
                      p.scoringPlay && "bg-accent/10",
                    )}
                  >
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      {p.period != null && (
                        <span className="text-chalk-dim text-[10px] uppercase tracking-[0.12em]">
                          Q{p.period}
                          {p.clock ? ` ${p.clock}` : ""}
                        </span>
                      )}
                      {p.shortDownDistanceText && (
                        <span className="text-[10px] text-emerald-200/70">{p.shortDownDistanceText}</span>
                      )}
                    </div>
                    <p className="text-cream mt-0.5 text-[13px] leading-snug">{p.text}</p>
                    {p.athletes.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {p.athletes.map((a) =>
                          a.id ? (
                            <Link
                              key={`${p.id}-${a.id}`}
                              to={`/sports/nfl/player/${a.id}`}
                              className="text-accent rounded-sm border border-accent/25 bg-accent/5 px-2 py-0.5 text-[10px] hover:bg-accent/15"
                            >
                              {a.shortName}
                              {a.position ? ` · ${a.position}` : ""}
                            </Link>
                          ) : null,
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {g.scoringPlays.length > 0 && (
            <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
                Scoring
              </h2>
              <ul className="space-y-2">
                {g.scoringPlays.map((s) => (
                  <li key={s.id} className="text-[12.5px] leading-snug">
                    <span className="text-chalk-dim mr-2 text-[10px] uppercase">
                      {s.teamAbbrev}
                      {s.clock ? ` · ${s.clock}` : ""}
                    </span>
                    <span className="text-cream">{s.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {g.leaders.length > 0 && (
            <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
                Box leaders
              </h2>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {g.leaders.slice(0, 12).map((l) => (
                  <li key={`${l.group}-${l.id}-${l.line}`}>
                    <Link
                      to={`/sports/nfl/player/${l.id}`}
                      className="hover:border-accent/40 flex items-baseline justify-between gap-2 rounded-md border border-white/[0.06] px-3 py-2 transition hover:bg-white/[0.03]"
                    >
                      <span className="min-w-0">
                        <span className="text-cream block truncate text-[13px] font-medium">
                          {l.name}
                        </span>
                        <span className="text-chalk-dim text-[10px] uppercase tracking-[0.12em]">
                          {l.teamAbbrev} · {l.group}
                        </span>
                      </span>
                      <span className="numeral text-chalk shrink-0 text-[12px]">{l.line}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
