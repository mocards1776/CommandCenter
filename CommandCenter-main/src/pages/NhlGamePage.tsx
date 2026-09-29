import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import { fetchNhlGameDetail, nhlHeadshot, type NhlScoreSide } from "@/lib/nhl";
import { cn } from "@/lib/utils";

export default function NhlGamePage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const swipeRef = useSwipeBack(() => navigate(-1));

  const game = useQuery({
    queryKey: ["nhl-game", eventId],
    queryFn: () => fetchNhlGameDetail(eventId!),
    enabled: Boolean(eventId),
    refetchInterval: (q) => (q.state.data?.live ? 15_000 : false),
  });

  if (!eventId) return <p className="text-alert p-6 text-[13px]">Missing game id</p>;

  const g = game.data;
  const periods = g ? Math.max(g.away.linescores.length, g.home.linescores.length, g.final || g.live ? 3 : 0) : 0;

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
          to="/sports/nhl?solo=1"
          className="text-chalk-dim hover:text-cream text-[11px] uppercase tracking-[0.14em]"
        >
          NHL hub
        </Link>
      </div>

      {game.isPending ? (
        <div className="text-chalk flex min-h-[40vh] items-center justify-center gap-2">
          <Loader2 size={18} className="animate-spin" />
          Loading game…
        </div>
      ) : game.isError || !g ? (
        <p className="text-alert text-[13px]">Couldn’t load this game.</p>
      ) : (
        <>
          <article className="bg-panel overflow-hidden rounded-2xl border border-white/[0.1]">
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
                {g.venue ?? "NHL"}
              </p>
              <p
                className={cn(
                  "text-[11px] font-semibold uppercase tracking-[0.14em]",
                  g.live ? "text-alert" : "text-chalk",
                )}
              >
                {g.live ? "Live" : g.shortDetail ?? g.status}
              </p>
            </div>
            <div className="grid gap-4 p-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <TeamBlock side={g.away} align="left" />
              <div className="text-center">
                <p className="numeral text-cream text-[28px] leading-none">
                  {g.final || g.live ? `${g.away.score ?? 0} – ${g.home.score ?? 0}` : "vs"}
                </p>
                <p className="text-chalk-dim mt-1 text-[11px]">{g.when}</p>
              </div>
              <TeamBlock side={g.home} align="right" />
            </div>
            {periods > 0 && (
              <div className="overflow-x-auto border-t border-white/[0.06]">
                <table className="w-full text-center text-[12px]">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                      <th className="px-3 py-2 text-left font-medium"> </th>
                      {Array.from({ length: periods }, (_, i) => (
                        <th key={i} className="px-2 py-2 font-medium">
                          {periodLabel(i)}
                        </th>
                      ))}
                      <th className="px-3 py-2 font-medium">T</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[g.away, g.home].map((side) => (
                      <tr key={side.teamId} className="border-t border-white/[0.05]">
                        <td className="text-cream px-3 py-2 text-left font-semibold">{side.abbrev}</td>
                        {Array.from({ length: periods }, (_, i) => (
                          <td key={i} className="numeral px-2 py-2 text-white/80">
                            {side.linescores[i] ?? "—"}
                          </td>
                        ))}
                        <td className="numeral text-cream px-3 py-2 font-semibold">{side.score ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          {g.leaders.length > 0 && (
            <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
              <h3 className="rule-head mb-3">Game leaders</h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {g.leaders.map((l) => (
                  <li key={`${l.teamAbbrev}-${l.category}-${l.id}`}>
                    <Link
                      to={`/sports/nhl/player/${l.id}`}
                      className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-white/[0.03]"
                    >
                      <img
                        src={nhlHeadshot(l.id)}
                        alt=""
                        className="h-9 w-9 rounded-full bg-[#dfe6f2] object-cover object-top"
                      />
                      <span className="min-w-0">
                        <span className="text-cream block truncate text-[13px] font-semibold">
                          {l.name}
                        </span>
                        <span className="text-chalk-dim text-[11px]">
                          {l.teamAbbrev} · {l.category} {l.value}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {g.scoringPlays.length > 0 && (
            <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
              <div className="border-b border-white/[0.06] px-4 py-2.5">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
                  Scoring
                </h3>
              </div>
              <ul className="divide-y divide-white/[0.05]">
                {g.scoringPlays.map((p) => (
                  <li key={p.id} className="flex gap-3 px-4 py-3">
                    <div className="w-16 shrink-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8b93a7]">
                        {p.period ?? "—"}
                      </p>
                      <p className="numeral text-chalk text-[12px]">{p.clock ?? ""}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-cream text-[13px] leading-snug">
                        <ScoringText play={p} />
                      </p>
                      {p.strength ? (
                        <p className="text-accent mt-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
                          {p.strength}
                        </p>
                      ) : null}
                    </div>
                    <p className="numeral text-cream shrink-0 text-[13px]">
                      {p.awayScore ?? 0}–{p.homeScore ?? 0}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {g.teamStats.length > 0 && (
            <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
              <div className="border-b border-white/[0.06] px-4 py-2.5">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
                  Team stats
                </h3>
              </div>
              <table className="w-full text-center text-[13px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                    <th className="px-3 py-2 font-medium">{g.away.abbrev}</th>
                    <th className="px-3 py-2 font-medium"> </th>
                    <th className="px-3 py-2 font-medium">{g.home.abbrev}</th>
                  </tr>
                </thead>
                <tbody>
                  {g.teamStats.map((row) => (
                    <tr key={row.label} className="border-t border-white/[0.05]">
                      <td className="numeral text-cream px-3 py-2">{row.away}</td>
                      <td className="px-3 py-2 text-[11px] uppercase tracking-[0.12em] text-[#8b93a7]">
                        {row.label}
                      </td>
                      <td className="numeral text-cream px-3 py-2">{row.home}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {g.boxGroups.length > 0 && (
            <section className="space-y-4">
              <h2 className="rule-head">Box score</h2>
              {g.boxGroups.map((group) => (
                <div
                  key={`${group.teamId}-${group.name}`}
                  className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]"
                >
                  <div className="border-b border-white/[0.06] px-4 py-2.5">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
                      {group.teamAbbrev} · {group.name}
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left text-[12px]">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                          <th className="px-4 py-2 font-medium">Player</th>
                          {group.rows[0]?.stats.map((s) => (
                            <th key={s.label} className="numeral px-2 py-2 text-right font-medium">
                              {s.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((row) => (
                          <tr key={row.id} className="border-t border-white/[0.05]">
                            <td className="px-4 py-2">
                              <Link
                                to={`/sports/nhl/player/${row.id}`}
                                className="text-cream inline-flex items-center gap-2 font-medium hover:underline"
                              >
                                <img
                                  src={nhlHeadshot(row.id)}
                                  alt=""
                                  className="h-7 w-7 rounded-full bg-[#dfe6f2] object-cover object-top"
                                  loading="lazy"
                                />
                                {row.name}
                              </Link>
                            </td>
                            {row.stats.map((s) => (
                              <td key={s.label} className="numeral px-2 py-2 text-right text-white/90">
                                {s.value}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function periodLabel(index: number): string {
  if (index < 3) return String(index + 1);
  if (index === 3) return "OT";
  return `OT${index - 2}`;
}

function TeamBlock({ side, align }: { side: NhlScoreSide; align: "left" | "right" }) {
  return (
    <Link
      to={`/sports/nhl/team/${side.teamId}`}
      className={cn("flex items-center gap-3", align === "right" && "sm:flex-row-reverse sm:text-right")}
    >
      {side.logo ? <img src={side.logo} alt="" className="h-12 w-12 object-contain" /> : null}
      <div>
        <p className="text-cream text-[18px] font-semibold">{side.abbrev}</p>
        <p className="text-chalk-dim text-[12px]">{side.name}</p>
        {side.record ? <p className="text-chalk-dim numeral text-[11px]">{side.record}</p> : null}
      </div>
    </Link>
  );
}

function ScoringText({
  play,
}: {
  play: { text: string; athletes: { id: string; name: string }[] };
}) {
  if (!play.athletes.length) return <>{play.text}</>;
  const pieces: { key: string; node: ReactNode }[] = [];
  let rest = play.text;
  play.athletes.forEach((a, idx) => {
    const at = rest.indexOf(a.name);
    if (at < 0) return;
    if (at > 0) pieces.push({ key: `t-${idx}`, node: rest.slice(0, at) });
    pieces.push({
      key: a.id + idx,
      node: (
        <Link to={`/sports/nhl/player/${a.id}`} className="hover:text-accent font-semibold">
          {a.name}
        </Link>
      ),
    });
    rest = rest.slice(at + a.name.length);
  });
  if (rest) pieces.push({ key: "end", node: rest });
  if (!pieces.length) return <>{play.text}</>;
  return (
    <>
      {pieces.map((p) => (
        <span key={p.key}>{p.node}</span>
      ))}
    </>
  );
}
