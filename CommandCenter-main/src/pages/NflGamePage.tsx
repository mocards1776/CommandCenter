import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { SelectableHighlightRegion } from "@/components/rss/SelectableHighlightRegion";
import NflFieldMap from "@/components/sports/NflFieldMap";
import { TeamStandingLine } from "@/components/sports/TeamFormChips";
import { fetchNflTeamForm, type TeamFormStrip } from "@/lib/team-form";
import { fetchNflGameDetail, type NflScoreSide } from "@/lib/nfl";
import { cn, formatSportsDateLong } from "@/lib/utils";

function statusLabel(g: {
  live: boolean;
  final: boolean;
  status: string;
  shortDetail: string | null;
}): string {
  if (g.live) return g.shortDetail && !/^live$/i.test(g.shortDetail) ? g.shortDetail : "Live";
  if (g.final) {
    // Avoid "Final · Final" when ESPN repeats the state in shortDetail.
    if (g.shortDetail && !/^final\b/i.test(g.shortDetail)) return g.shortDetail;
    return "Final";
  }
  if (g.shortDetail && !/scheduled|pregame|pre-game/i.test(g.shortDetail)) return g.shortDetail;
  return "Preview";
}

export function NflGameDetailView({
  eventId,
  suppressStoryHeader = false,
}: {
  eventId: string;
  /** When a parent hero already shows the wrap headline, skip repeating it. */
  suppressStoryHeader?: boolean;
}) {
  const detail = useQuery({
    queryKey: ["nfl-game", eventId],
    queryFn: () => fetchNflGameDetail(eventId),
    enabled: Boolean(eventId),
    refetchInterval: (q) => (q.state.data?.live ? 12_000 : false),
    staleTime: 8_000,
  });

  const g = detail.data;

  const awayForm = useQuery({
    queryKey: ["nfl-team-form", g?.away.teamId],
    queryFn: () => fetchNflTeamForm(g!.away.teamId, g!.away.abbrev),
    enabled: Boolean(g?.away.teamId),
    staleTime: 120_000,
  });
  const homeForm = useQuery({
    queryKey: ["nfl-team-form", g?.home.teamId],
    queryFn: () => fetchNflTeamForm(g!.home.teamId, g!.home.abbrev),
    enabled: Boolean(g?.home.teamId),
    staleTime: 120_000,
  });

  const homeYardLine = useMemo(() => {
    if (!g) return null;
    if (g.situation?.yardLine != null) return g.situation.yardLine;
    const play = g.recentPlays[0];
    if (play?.yardLine != null) return play.yardLine;
    return null;
  }, [g]);

  const teamStatLabels = useMemo(() => {
    const labels: string[] = [];
    const seen = new Set<string>();
    for (const s of g?.teamStats ?? []) {
      if (seen.has(s.label)) continue;
      seen.add(s.label);
      labels.push(s.label);
    }
    return labels.slice(0, 16);
  }, [g?.teamStats]);

  if (detail.isPending) {
    return (
      <p className="text-chalk flex items-center gap-2 text-[13px]">
        <Loader2 size={14} className="animate-spin" /> Loading game…
      </p>
    );
  }
  if (detail.isError || !g) {
    return <p className="text-alert text-[13px]">Couldn’t load this NFL game.</p>;
  }

  const recapUrl = `https://www.espn.com/nfl/recap/_/gameId/${eventId}`;
  const boxUrl = `https://www.espn.com/nfl/boxscore/_/gameId/${eventId}`;
  const awayWins = g.final && (g.away.score ?? 0) > (g.home.score ?? 0);
  const homeWins = g.final && (g.home.score ?? 0) > (g.away.score ?? 0);
  const label = statusLabel(g);
  const pregame = !g.final && !g.live;

  const articleSection =
    g.article?.storyHtml || g.article?.description ? (
      <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08] font-rss">
        {!suppressStoryHeader ? (
          <div className="border-b border-white/[0.06] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
              {g.final ? "Game wrap" : "Preview"}
            </p>
            <h2 className="font-rss mt-1 text-[20px] font-semibold leading-snug text-cream">
              {g.article.headline}
            </h2>
            {g.article.description ? (
              <p className="text-chalk mt-2 text-[13px] leading-relaxed">
                {g.article.description.replace(/^—\s*/, "")}
              </p>
            ) : null}
          </div>
        ) : g.article.description ? (
          <div className="border-b border-white/[0.06] px-4 py-3">
            <p className="text-chalk text-[13px] leading-relaxed">
              {g.article.description.replace(/^—\s*/, "")}
            </p>
          </div>
        ) : null}
        {g.article.storyHtml ? (
          <SelectableHighlightRegion
            articleUrl={recapUrl}
            articleTitle={g.article.headline}
            feedUrl="synthetic:nfl-wraps"
            html={g.article.storyHtml}
            className="rss-reader px-4 py-4 text-[15px] leading-[1.75] text-[#d5dae6] [&_a]:font-semibold [&_a]:text-accent [&_a]:hover:underline [&_p]:my-3.5 [&_mark.rss-hl]:bg-accent/35 [&_mark.rss-hl]:text-cream"
          />
        ) : null}
      </section>
    ) : null;

  return (
    <div className="space-y-5">
      <header className="relative overflow-hidden rounded-xl border border-white/[0.1] bg-[#07101d] shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-1/2 opacity-90"
          style={{
            background: `radial-gradient(ellipse at 20% 45%, #${g.away.color}88, transparent 58%)`,
          }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-90"
          style={{
            background: `radial-gradient(ellipse at 80% 45%, #${g.home.color}88, transparent 58%)`,
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.06),transparent_45%)]" />

        <div className="relative z-10 flex items-center justify-between gap-2 border-b border-white/[0.07] px-4 py-2.5">
          <p
            className={cn(
              "text-[11px] font-bold uppercase tracking-[0.16em]",
              g.final ? "text-cream" : g.live ? "text-alert" : "text-[#a8b0c2]",
            )}
          >
            {label}
          </p>
          {g.venue ? (
            <p className="truncate text-[11px] text-[#8b93a7]">{g.venue}</p>
          ) : g.date ? (
            <p className="text-[11px] text-[#8b93a7]">{formatSportsDateLong(g.date)}</p>
          ) : null}
        </div>

        <div className="relative z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-7 sm:gap-4 sm:px-6">
          <NflMatchupSide
            side={g.away}
            align="left"
            winner={awayWins}
            loser={homeWins}
            form={awayForm.data ?? null}
          />
          <div className="px-1 text-center">
            {pregame ? (
              <>
                <p className="font-display text-[40px] leading-none tracking-tight text-white sm:text-[52px]">
                  {g.whenShort ?? "TBD"}
                </p>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
                  Kickoff
                </p>
              </>
            ) : (
              <>
                <p className="font-display text-[48px] leading-none tabular-nums text-white sm:text-[60px]">
                  <span className={awayWins ? "text-white" : "text-white/50"}>
                    {g.away.score ?? "–"}
                  </span>
                  <span className="mx-2 text-[22px] text-white/25 sm:mx-3">-</span>
                  <span className={homeWins ? "text-white" : "text-white/50"}>
                    {g.home.score ?? "–"}
                  </span>
                </p>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
                  {g.final ? "Final" : label}
                </p>
              </>
            )}
          </div>
          <NflMatchupSide
            side={g.home}
            align="right"
            winner={homeWins}
            loser={awayWins}
            form={homeForm.data ?? null}
          />
        </div>

        <div className="relative z-10 flex flex-wrap gap-3 border-t border-white/[0.06] px-4 py-2.5">
          <a
            href={recapUrl}
            target="_blank"
            rel="noreferrer"
            className="text-chalk-dim hover:text-cream inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em]"
          >
            ESPN recap <ExternalLink size={11} />
          </a>
          <a
            href={boxUrl}
            target="_blank"
            rel="noreferrer"
            className="text-chalk-dim hover:text-cream inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em]"
          >
            ESPN boxscore <ExternalLink size={11} />
          </a>
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

      {articleSection}

      {teamStatLabels.length > 0 && (
        <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
          <div className="border-b border-white/[0.06] px-4 py-2.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
              Team stats
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                  <th className="px-3 py-2 font-medium">Stat</th>
                  <th className="numeral px-2 py-2 text-right font-medium">
                    <NflTeamStatHeader side={g.away} align="right" />
                  </th>
                  <th className="numeral px-3 py-2 text-right font-medium">
                    <NflTeamStatHeader side={g.home} align="right" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {teamStatLabels.map((label) => {
                  const away =
                    g.teamStats.find(
                      (s) => s.label === label && s.teamAbbrev === g.away.abbrev,
                    )?.value ?? "—";
                  const home =
                    g.teamStats.find(
                      (s) => s.label === label && s.teamAbbrev === g.home.abbrev,
                    )?.value ?? "—";
                  return (
                    <tr key={label} className="border-t border-white/[0.05]">
                      <td className="px-3 py-1.5 text-[#c8cdd8]">{label}</td>
                      <td className="numeral px-2 py-1.5 text-right text-white">{away}</td>
                      <td className="numeral px-3 py-1.5 text-right text-white">{home}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {g.boxGroups.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
            Box score
          </h2>
          {(["away", "home"] as const).map((which) => {
            const side = which === "away" ? g.away : g.home;
            const form = which === "away" ? awayForm.data : homeForm.data;
            const groups = g.boxGroups.filter((gr) => gr.teamAbbrev === side.abbrev);
            if (!groups.length) return null;
            return (
              <div key={side.teamId} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 px-0.5">
                  {side.logo ? (
                    <img src={side.logo} alt="" className="h-7 w-7 object-contain" />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold text-white">{side.name}</p>
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      {side.record ? (
                        <span className="numeral text-[12px] text-[#8b93a7]">{side.record}</span>
                      ) : null}
                      <TeamStandingLine standing={form?.standing} className="text-[#8b93a7]" />
                    </div>
                  </div>
                </div>
                {groups.map((group) => (
                  <div
                    key={`${group.teamAbbrev}-${group.name}`}
                    className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]"
                  >
                    <div className="border-b border-white/[0.06] px-3 py-2">
                      <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                        {side.logo ? (
                          <img src={side.logo} alt="" className="h-5 w-5 object-contain" />
                        ) : null}
                        <span>
                          {group.teamAbbrev} · {group.name}
                        </span>
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[480px] text-left text-[12px]">
                        <thead>
                          <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                            <th className="px-3 py-2 font-medium">Player</th>
                            {group.labels.map((lab) => (
                              <th key={lab} className="numeral px-1.5 py-2 font-medium">
                                {lab}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {group.athletes.map((a, i) => (
                            <tr
                              key={`${group.name}-${a.id}`}
                              className={cn(
                                "border-t border-white/[0.05]",
                                i % 2 === 1 && "bg-white/[0.02]",
                              )}
                            >
                              <td className="px-3 py-1.5">
                                <Link
                                  to={`/sports/nfl/player/${a.id}`}
                                  className="text-cream hover:text-accent hover:underline"
                                >
                                  {a.name}
                                </Link>
                              </td>
                              {group.labels.map((_, idx) => (
                                <td
                                  key={`${a.id}-${idx}`}
                                  className="numeral px-1.5 py-1.5 text-white/85"
                                >
                                  {a.stats[idx] ?? "—"}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
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

      {g.recentPlays.length > 0 && (
        <section className="bg-panel rounded-xl border border-white/[0.08]">
          <div className="border-b border-white/[0.06] px-4 py-2.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
              Play-by-play
            </h2>
          </div>
          <ul className="max-h-[28rem] divide-y divide-white/[0.05] overflow-y-auto">
            {g.recentPlays.map((p) => (
              <li key={p.id} className={cn("px-4 py-2.5", p.scoringPlay && "bg-accent/10")}>
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
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function NflTeamStatHeader({
  side,
  align,
}: {
  side: NflScoreSide;
  align: "left" | "right";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        align === "right" ? "justify-end" : "justify-start",
      )}
    >
      {side.logo ? (
        <img src={side.logo} alt="" className="h-5 w-5 object-contain" />
      ) : null}
      {side.abbrev}
    </span>
  );
}

function NflMatchupSide({
  side,
  align,
  winner,
  loser,
  form,
}: {
  side: NflScoreSide;
  align: "left" | "right";
  winner?: boolean;
  loser?: boolean;
  form: TeamFormStrip | null;
}) {
  return (
    <Link
      to={`/sports/nfl/team/${side.teamId}`}
      className={cn(
        "flex min-w-0 flex-col items-center gap-2.5 transition hover:opacity-90",
        align === "left" ? "sm:items-start" : "sm:items-end",
        loser && "opacity-70",
      )}
    >
      {side.logo ? (
        <img
          src={side.logo}
          alt=""
          className={cn(
            "h-16 w-16 object-contain sm:h-[4.5rem] sm:w-[4.5rem]",
            winner && "drop-shadow-[0_0_12px_rgba(255,255,255,0.35)]",
          )}
        />
      ) : (
        <div className="grid h-16 w-16 place-items-center rounded-full bg-white/10 text-[12px] font-bold text-white">
          {side.abbrev}
        </div>
      )}
      <div className={cn("text-center", align === "left" ? "sm:text-left" : "sm:text-right")}>
        <p
          className={cn(
            "text-[18px] font-bold tracking-wide sm:text-[22px]",
            winner ? "text-white" : loser ? "text-white/55" : "text-white",
          )}
        >
          {side.abbrev}
        </p>
        {side.record ? (
          <p className="numeral mt-1 text-[13px] font-medium text-white/70">{side.record}</p>
        ) : (
          <p className="mt-1 truncate text-[11px] text-[#8b93a7]">{side.name}</p>
        )}
        <TeamStandingLine standing={form?.standing} />
      </div>
    </Link>
  );
}

export default function NflGamePage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

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
            onClick={() => toast.success("Game updated")}
            className="text-chalk hover:text-cream rounded-sm border border-white/10 p-2"
            aria-label="Refresh"
          >
            <RefreshCw size={14} />
          </button>
          <Link
            to="/sports/nfl?solo=1"
            className="text-chalk-dim hover:text-cream text-[11px] uppercase tracking-[0.14em]"
          >
            NFL hub
          </Link>
        </div>
      </div>
      <NflGameDetailView eventId={eventId} />
    </div>
  );
}
