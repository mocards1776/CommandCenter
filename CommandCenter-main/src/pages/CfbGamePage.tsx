import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { SelectableHighlightRegion } from "@/components/rss/SelectableHighlightRegion";
import NflFieldMap from "@/components/sports/NflFieldMap";
import CfbRankLabel from "@/components/sports/CfbRankLabel";
import EspnVideoEmbed from "@/components/sports/EspnVideoEmbed";
import HighlightReel from "@/components/sports/HighlightReel";
import { fetchCfbBackupHighlights, fetchCfbGameDetail, type CfbScoreSide } from "@/lib/cfb";
import type { MlbHighlight } from "@/lib/mlb";
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
    queryKey: ["cfb-game-v2", eventId],
    queryFn: () => fetchCfbGameDetail(eventId),
    enabled: Boolean(eventId),
    refetchInterval: (q) => (q.state.data?.live ? 12_000 : false),
    staleTime: 8_000,
  });

  const g = detail.data;

  const homeYardLine = useMemo(() => {
    if (!g) return null;
    if (g.situation?.yardLine != null) return g.situation.yardLine;
    const play = g.recentPlays?.[0];
    if (play?.yardLine != null) return play.yardLine;
    return null;
  }, [g]);

  const backups = useQuery({
    queryKey: [
      "cfb-backup-highlights",
      eventId,
      g?.away.name,
      g?.home.name,
      g?.date,
    ],
    queryFn: () =>
      fetchCfbBackupHighlights({
        awayName: g!.away.name,
        homeName: g!.home.name,
        awayAbbrev: g!.away.abbrev,
        homeAbbrev: g!.home.abbrev,
        date: g!.date,
      }),
    enabled: Boolean(g?.final && !g.recapVideo),
    staleTime: 300_000,
  });

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

  const extraHighlights = useMemo((): MlbHighlight[] => {
    if (!g) return [];
    const recapId = g.recapVideo?.id;
    return g.videos
      .filter((v) => v.mp4 && v.id !== recapId)
      .map((v) => ({
        id: v.id,
        title: v.headline,
        description: v.description,
        duration:
          v.durationSec != null
            ? `${Math.floor(v.durationSec / 60)}:${String(Math.floor(v.durationSec % 60)).padStart(2, "0")}`
            : null,
        thumb: v.thumb,
        url: v.mp4!,
        date: null,
      }));
  }, [g]);

  const primaryHighlight = g?.recapVideo ?? backups.data?.primary ?? null;
  const primaryEyebrow =
    primaryHighlight?.source === "fox"
      ? "FOX highlights"
      : primaryHighlight?.source === "cbs"
        ? "CBS highlights"
        : "ESPN recap";

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
        <div className="relative z-10 flex items-center justify-between gap-2 border-b border-white/[0.07] px-3 py-2.5 sm:px-4">
          <p
            className={cn(
              "shrink-0 text-[11px] font-bold uppercase tracking-[0.16em]",
              g.final ? "text-cream" : g.live ? "text-alert" : "text-[#a8b0c2]",
            )}
          >
            {label}
          </p>
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-x-2 gap-y-1">
            {g.broadcasts.length > 0 ? (
              <div className="flex flex-wrap items-center justify-end gap-1">
                {g.broadcasts.map((b) => {
                  const isSvg = Boolean(b.logo && /\.svg(\?|$)/i.test(b.logo));
                  return (
                    <span
                      key={`${b.market ?? "x"}-${b.name}`}
                      className="inline-flex h-5 max-w-[8.5rem] items-center gap-1 rounded-sm bg-white/[0.08] px-1.5 text-[10px] text-[#c5cce0]"
                      title={b.market ? `${b.name} (${b.market})` : b.name}
                    >
                      {b.logo ? (
                        <img
                          src={b.logo}
                          alt=""
                          className={
                            isSvg
                              ? "h-3.5 w-3.5 object-contain"
                              : "h-3.5 w-auto max-w-[2.5rem] object-contain brightness-0 invert"
                          }
                          loading="lazy"
                        />
                      ) : null}
                      <span className="truncate">{b.name}</span>
                    </span>
                  );
                })}
              </div>
            ) : null}
            {g.venue ? (
              <p className="truncate text-[11px] text-[#8b93a7]">{g.venue}</p>
            ) : g.date ? (
              <p className="text-[11px] text-[#8b93a7]">{formatSportsDateLong(g.date)}</p>
            ) : null}
          </div>
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

        {!pregame ? (
          <div className="relative z-10 border-t border-white/[0.06] px-3 pb-3 pt-1 sm:px-4">
            <CfbLinescoreTable away={g.away} home={g.home} />
          </div>
        ) : null}

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
        <section className="space-y-2">
          <NflFieldMap
            game={g}
            homeYardLine={homeYardLine}
            possessionTeamId={g.situation?.possessionTeamId ?? null}
            downDistanceText={g.situation?.downDistanceText}
          />
          {g.situation?.lastPlayText ? (
            <p className="text-chalk px-1 text-[12px] leading-relaxed">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">
                Last play ·{" "}
              </span>
              <span className="text-cream/90">{g.situation.lastPlayText}</span>
            </p>
          ) : null}
        </section>
      )}

      {g.recentPlays.length > 0 && (
        <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.22)]">
          <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
              Recent plays
            </h2>
            <span className="text-[10px] text-[#6b7386]">Cleaned for readability</span>
          </div>
          <ul className="max-h-[28rem] divide-y divide-white/[0.05] overflow-y-auto">
            {g.recentPlays.slice(0, 12).map((p) => (
              <li
                key={p.id}
                className={cn(
                  "px-4 py-3 transition-colors",
                  p.scoringPlay && "bg-gradient-to-r from-accent/15 to-transparent",
                )}
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  {p.period != null && (
                    <span className="rounded-sm bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a8b0c2]">
                      Q{p.period}
                      {p.clock ? ` · ${p.clock}` : ""}
                    </span>
                  )}
                  {p.shortDownDistanceText && (
                    <span className="text-[10px] font-medium text-emerald-200/75">
                      {p.shortDownDistanceText}
                    </span>
                  )}
                  {p.scoringPlay ? (
                    <span className="text-accent text-[10px] font-semibold uppercase tracking-[0.12em]">
                      Score
                    </span>
                  ) : null}
                </div>
                <p className="text-cream mt-1 text-[13px] leading-relaxed">{p.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {primaryHighlight ? (
        <EspnVideoEmbed clip={primaryHighlight} eyebrow={primaryEyebrow} />
      ) : null}

      {extraHighlights.length > 0 ? (
        <HighlightReel
          highlights={extraHighlights}
          title="More ESPN highlights"
          defaultOpen={false}
        />
      ) : null}

      {!g.recapVideo && (backups.data?.clips.length ?? 0) > 0 ? (
        <section className="space-y-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
            More highlights
          </p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {backups.data!.clips.map((clip) => (
              <EspnVideoEmbed
                key={clip.id}
                clip={clip}
                eyebrow={
                  clip.source === "cbs"
                    ? "CBS"
                    : clip.source === "fox"
                      ? "FOX"
                      : "Highlights"
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      {articleSection}

      {pregame && (g.oddsLine || g.predictor || g.lastFive.length > 0 || g.venueDetail) ? (
        <section className="bg-panel space-y-3 overflow-hidden rounded-xl border border-white/[0.08] px-4 py-3.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
            Preview
          </h2>
          {g.venueDetail ? (
            <p className="text-[13px] text-[#c8cdd8]">{g.venueDetail}</p>
          ) : null}
          {g.oddsLine ? (
            <p className="text-cream text-[14px] font-medium">{g.oddsLine}</p>
          ) : null}
          {g.predictor &&
          (g.predictor.awayWinPct != null || g.predictor.homeWinPct != null) ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-[#8b93a7]">
                  {g.away.abbrev} win%
                </p>
                <p className="numeral text-cream text-[22px] font-semibold">
                  {g.predictor.awayWinPct != null ? `${g.predictor.awayWinPct}%` : "—"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[0.14em] text-[#8b93a7]">
                  {g.home.abbrev} win%
                </p>
                <p className="numeral text-cream text-[22px] font-semibold">
                  {g.predictor.homeWinPct != null ? `${g.predictor.homeWinPct}%` : "—"}
                </p>
              </div>
            </div>
          ) : null}
          {g.lastFive.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {g.lastFive.map((side) => (
                <div key={side.teamAbbrev}>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">
                    {side.teamAbbrev} last 5
                  </p>
                  <ul className="space-y-1">
                    {side.results.map((r, i) => (
                      <li
                        key={`${side.teamAbbrev}-${i}`}
                        className="flex items-center justify-between gap-2 text-[12px]"
                      >
                        <span className="text-[#c8cdd8]">vs {r.label}</span>
                        <span
                          className={cn(
                            "numeral font-semibold",
                            /^W/i.test(r.result)
                              ? "text-emerald-300"
                              : /^L/i.test(r.result)
                                ? "text-alert"
                                : "text-cream",
                          )}
                        >
                          {r.result}
                          {r.score ? ` ${r.score}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {pregame &&
      !g.article &&
      !g.boxGroups.length &&
      !g.teamStats.length &&
      !g.scoringPlays.length &&
      !(g.oddsLine || g.predictor || g.lastFive.length) ? (
        <section className="bg-panel rounded-xl border border-white/[0.08] px-4 py-5">
          <p className="text-chalk text-[13px] leading-relaxed">
            ESPN hasn&apos;t published preview copy or boxscore data for this matchup yet.
            Odds and team pages will fill in as kickoff gets closer.
          </p>
        </section>
      ) : null}

      {!pregame &&
      !g.boxGroups.length &&
      !g.teamStats.length &&
      !g.scoringPlays.length &&
      !g.recentPlays.length ? (
        <section className="bg-panel rounded-xl border border-white/[0.08] px-4 py-5">
          <p className="text-chalk text-[13px] leading-relaxed">
            ESPN hasn&apos;t opened the live box score or play-by-play feed for this game yet
            (score by quarter is above
            {g.videos.length || g.recapVideo ? "; highlights are below" : ""}
            ). Stats will appear when ESPN publishes them.
          </p>
        </section>
      ) : null}

      {teamStatLabels.length > 0 && (
        <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
          <div className="border-b border-white/[0.06] px-3 py-2.5 sm:px-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
              Team stats
            </h2>
          </div>
          <table className="w-full table-fixed text-left text-[11px] sm:text-[12px]">
            <colgroup>
              <col className="w-[46%]" />
              <col className="w-[27%]" />
              <col className="w-[27%]" />
            </colgroup>
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                <th className="px-2 py-2 font-medium sm:px-3">Stat</th>
                <th className="px-1.5 py-2 text-center font-medium sm:px-2">
                  <span className="inline-flex flex-col items-center gap-1">
                    {g.away.logo ? (
                      <img
                        src={g.away.logo}
                        alt=""
                        className="h-6 w-6 object-contain sm:h-7 sm:w-7"
                      />
                    ) : null}
                    <span className="numeral">{g.away.abbrev}</span>
                  </span>
                </th>
                <th className="px-1.5 py-2 text-center font-medium sm:px-3">
                  <span className="inline-flex flex-col items-center gap-1">
                    {g.home.logo ? (
                      <img
                        src={g.home.logo}
                        alt=""
                        className="h-6 w-6 object-contain sm:h-7 sm:w-7"
                      />
                    ) : null}
                    <span className="numeral">{g.home.abbrev}</span>
                  </span>
                </th>
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
                    <td className="px-2 py-1.5 leading-snug text-[#c8cdd8] sm:px-3">
                      {statLabel}
                    </td>
                    <td className="numeral break-words px-1.5 py-1.5 text-center text-white sm:px-2">
                      {away}
                    </td>
                    <td className="numeral break-words px-1.5 py-1.5 text-center text-white sm:px-3">
                      {home}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
                      <CfbRankLabel pollRank={side.rank} fpiRank={side.fpiRank} />
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

function CfbLinescoreTable({
  away,
  home,
}: {
  away: CfbScoreSide;
  home: CfbScoreSide;
}) {
  const periodCount = Math.max(away.linescores.length, home.linescores.length, 4);
  const headers = Array.from({ length: periodCount }, (_, i) =>
    i < 4 ? `Q${i + 1}` : periodCount === 5 ? "OT" : `OT${i - 3}`,
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-white/[0.08] bg-black/25">
      <table className="w-full min-w-[280px] text-center text-[12px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
            <th className="px-2 py-1.5 text-left font-medium">Team</th>
            {headers.map((h) => (
              <th key={h} className="numeral px-1.5 py-1.5 font-medium">
                {h}
              </th>
            ))}
            <th className="numeral px-2 py-1.5 font-semibold text-cream/80">T</th>
          </tr>
        </thead>
        <tbody>
          {[away, home].map((side) => (
            <tr key={side.teamId} className="border-t border-white/[0.05]">
              <td className="px-2 py-1.5 text-left">
                <span className="inline-flex items-center gap-1.5 font-semibold text-cream">
                  {side.logo ? (
                    <img src={side.logo} alt="" className="h-4 w-4 object-contain" />
                  ) : null}
                  {side.abbrev}
                </span>
              </td>
              {headers.map((_, i) => (
                <td key={`${side.teamId}-${i}`} className="numeral px-1.5 py-1.5 text-white/85">
                  {side.linescores[i] ?? "–"}
                </td>
              ))}
              <td className="numeral px-2 py-1.5 font-bold text-white">
                {side.score ?? "–"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
    <Link
      to={`/sports/cfb/team/${side.teamId}`}
      className={cn(
        "flex min-w-0 flex-col gap-2 hover:opacity-90",
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
          <CfbRankLabel pollRank={side.rank} fpiRank={side.fpiRank} />
          {side.abbrev}
        </p>
        <p className="text-[11px] text-[#8b93a7]">{side.name}</p>
        {side.record ? (
          <p className="numeral mt-0.5 text-[12px] text-[#a8b0c2]">{side.record}</p>
        ) : null}
      </div>
    </Link>
  );
}

export default function CfbGamePage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const swipeRef = useSwipeBack(() => navigate(-1));

  const detail = useQuery({
    queryKey: ["cfb-game-v2", eventId],
    queryFn: () => fetchCfbGameDetail(eventId!),
    enabled: Boolean(eventId),
    refetchInterval: (q) => (q.state.data?.live ? 12_000 : false),
    staleTime: 8_000,
  });

  const refresh = () => {
    void detail.refetch().then(() => toast.success("Game updated"));
  };

  if (!eventId) {
    return <p className="text-alert p-6 text-[13px]">Missing game id</p>;
  }

  return (
    <div ref={swipeRef} className="mx-auto max-w-5xl space-y-4 p-3 sm:space-y-5 sm:p-4 md:p-7">
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
