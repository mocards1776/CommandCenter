import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { SelectableHighlightRegion } from "@/components/rss/SelectableHighlightRegion";
import { fetchCfbGameDetail, type CfbScoreSide } from "@/lib/cfb";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import { cn, formatSportsDateLong } from "@/lib/utils";

function statusLabel(g: {
  live: boolean;
  final: boolean;
  status: string;
  shortDetail: string | null;
}): string {
  if (g.live) return g.shortDetail && !/^live$/i.test(g.shortDetail) ? g.shortDetail : "Live";
  if (g.final) {
    if (g.shortDetail && !/^final\b/i.test(g.shortDetail)) return g.shortDetail;
    return "Final";
  }
  if (g.shortDetail && !/scheduled|pregame|pre-game/i.test(g.shortDetail)) return g.shortDetail;
  return "Preview";
}

export function CfbGameDetailView({
  eventId,
  suppressStoryHeader = false,
}: {
  eventId: string;
  suppressStoryHeader?: boolean;
}) {
  const detail = useQuery({
    queryKey: ["cfb-game", eventId],
    queryFn: () => fetchCfbGameDetail(eventId),
    enabled: Boolean(eventId),
    refetchInterval: (q) => (q.state.data?.live ? 15_000 : false),
    staleTime: 10_000,
  });

  const g = detail.data;

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
    return <p className="text-alert text-[13px]">Couldn’t load this college football game.</p>;
  }

  const recapUrl = `https://www.espn.com/college-football/recap/_/gameId/${eventId}`;
  const boxUrl = `https://www.espn.com/college-football/boxscore/_/gameId/${eventId}`;
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
            feedUrl="synthetic:cfb-wraps"
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
          <MatchupSide side={g.away} align="left" winner={awayWins} loser={homeWins} />
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
          <MatchupSide side={g.home} align="right" winner={homeWins} loser={awayWins} />
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
                  <th className="numeral px-2 py-2 text-right font-medium">{g.away.abbrev}</th>
                  <th className="numeral px-3 py-2 text-right font-medium">{g.home.abbrev}</th>
                </tr>
              </thead>
              <tbody>
                {teamStatLabels.map((statLabel) => {
                  const away =
                    g.teamStats.find(
                      (s) => s.label === statLabel && s.teamAbbrev === g.away.abbrev,
                    )?.value ?? "—";
                  const home =
                    g.teamStats.find(
                      (s) => s.label === statLabel && s.teamAbbrev === g.home.abbrev,
                    )?.value ?? "—";
                  return (
                    <tr key={statLabel} className="border-t border-white/[0.05]">
                      <td className="px-3 py-1.5 text-[#c8cdd8]">{statLabel}</td>
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
            const groups = g.boxGroups.filter((gr) => gr.teamAbbrev === side.abbrev);
            if (!groups.length) return null;
            return (
              <div key={side.teamId} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 px-0.5">
                  {side.logo ? (
                    <img src={side.logo} alt="" className="h-7 w-7 object-contain" />
                  ) : null}
                  <div>
                    <p className="text-[14px] font-bold text-white">
                      {side.rank ? `#${side.rank} ` : ""}
                      {side.name}
                    </p>
                    {side.record ? (
                      <p className="numeral text-[12px] text-[#8b93a7]">{side.record}</p>
                    ) : null}
                  </div>
                </div>
                {groups.map((group) => (
                  <div
                    key={`${group.teamAbbrev}-${group.name}`}
                    className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]"
                  >
                    <div className="border-b border-white/[0.06] px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                        {group.teamAbbrev} · {group.name}
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
                                  to={`/sports/cfb/player/${a.id}`}
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
              <li key={s.id} className="text-[13px] text-[#c8cdd8]">
                {s.clock ? (
                  <span className="numeral text-[11px] text-[#8b93a7]">{s.clock} · </span>
                ) : null}
                {s.teamAbbrev ? (
                  <span className="font-semibold text-cream">{s.teamAbbrev}: </span>
                ) : null}
                {s.text}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function MatchupSide({
  side,
  align,
  winner,
  loser,
}: {
  side: CfbScoreSide;
  align: "left" | "right";
  winner: boolean;
  loser: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2",
        align === "right" ? "items-end text-right" : "items-start",
      )}
    >
      {side.logo ? (
        <img src={side.logo} alt="" className="h-12 w-12 object-contain sm:h-14 sm:w-14" />
      ) : null}
      <div>
        <p
          className={cn(
            "text-[15px] font-bold sm:text-[17px]",
            winner ? "text-white" : loser ? "text-white/45" : "text-white",
          )}
        >
          {side.rank ? `#${side.rank} ` : ""}
          {side.abbrev}
        </p>
        <p className="text-[11px] text-[#8b93a7]">{side.name}</p>
        {side.record ? (
          <p className="numeral mt-0.5 text-[12px] text-[#a8b0c2]">{side.record}</p>
        ) : null}
      </div>
    </div>
  );
}

export default function CfbGamePage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const swipeRef = useSwipeBack(() => navigate(-1));

  const detail = useQuery({
    queryKey: ["cfb-game", eventId],
    queryFn: () => fetchCfbGameDetail(eventId!),
    enabled: Boolean(eventId),
    refetchInterval: (q) => (q.state.data?.live ? 15_000 : false),
    staleTime: 10_000,
  });

  const refresh = () => {
    void detail.refetch().then(() => toast.success("Game updated"));
  };

  if (!eventId) {
    return <p className="text-alert p-6 text-[13px]">Missing game id</p>;
  }

  return (
    <div ref={swipeRef} className="mx-auto max-w-5xl space-y-5 p-4 md:p-7">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-chalk hover:text-cream inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.14em]"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={detail.isFetching}
            className="text-chalk hover:text-cream inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] disabled:opacity-40"
          >
            <RefreshCw size={13} className={detail.isFetching ? "animate-spin" : ""} />
            Refresh
          </button>
          <Link
            to="/sports/cfb?solo=1"
            className="text-chalk-dim hover:text-cream text-[11px] uppercase tracking-[0.14em]"
          >
            CFB hub
          </Link>
        </div>
      </div>
      <CfbGameDetailView eventId={eventId} />
    </div>
  );
}
