import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { SelectableHighlightRegion } from "@/components/rss/SelectableHighlightRegion";
import AppleScoreCluster from "@/components/sports/AppleScoreCluster";
import LogoPlate from "@/components/sports/LogoPlate";
import NflFieldMap from "@/components/sports/NflFieldMap";
import CfbWinProbability from "@/components/sports/CfbWinProbability";
import PossessionFootball from "@/components/sports/PossessionFootball";
import CfbRankLabel, { CfbFpiCaption } from "@/components/sports/CfbRankLabel";
import CfbRecentPlays from "@/components/sports/CfbRecentPlays";
import EspnVideoEmbed from "@/components/sports/EspnVideoEmbed";
import HighlightReel from "@/components/sports/HighlightReel";
import { appleClockParts } from "@/lib/apple-score";
import { cfbDriveGlance } from "@/lib/cfb-drive";
import { fetchCfbBackupHighlights, fetchCfbGameDetail, type CfbScoreSide } from "@/lib/cfb";
import type { MlbHighlight } from "@/lib/mlb";
import { useSportsBack, useSwipeBack } from "@/hooks/useSwipeBack";
import { cn, formatSportsDateLong } from "@/lib/utils";

const LOWER_IS_BETTER = /penalt|turnover|fumble|interception/i;
const LEADER_STAT = /^(yds|avg|td|long|lng|pts|tot|pct)$/i;

function readableTeamColor(color: string): string {
  const raw = color.replace(/^#/, "");
  const n = Number.parseInt(raw, 16);
  if (!Number.isFinite(n) || raw.length !== 6) return "#d5dae6";
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const lum = (0.299 * ch[0]! + 0.587 * ch[1]! + 0.114 * ch[2]!) / 255;
  const lifted = lum > 0.42 ? ch : ch.map((c) => Math.round(c + (255 - c) * 0.48));
  return `rgb(${lifted.join(",")})`;
}

/** Light wash of a team color. Dark primaries are lifted so the tint still reads. */
function teamWash(color: string, alpha = 0.2): string {
  const raw = color.replace(/^#/, "");
  const n = Number.parseInt(raw, 16);
  if (!Number.isFinite(n) || raw.length !== 6) return `rgba(255,255,255,${alpha})`;
  let ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const lum = (0.299 * ch[0]! + 0.587 * ch[1]! + 0.114 * ch[2]!) / 255;
  if (lum < 0.45) ch = ch.map((c) => Math.round(c + (255 - c) * 0.55));
  return `rgba(${ch.join(",")},${alpha})`;
}

/** Magnitude for a comparison bar. Efficiency and completions use the rate; possession uses seconds. */
function statMagnitude(label: string, value: string): number | null {
  const text = value.trim();
  const clock = /^(\d+):(\d{2})$/.exec(text);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const slash = /^(\d+)\s*\/\s*(\d+)$/.exec(text);
  if (slash) {
    const made = Number(slash[1]);
    const att = Number(slash[2]);
    if (/comp|efficienc|red zone/i.test(label)) return att > 0 ? made / att : 0;
    return made;
  }
  const dash = /^(\d+)\s*-\s*(\d+)$/.exec(text);
  if (dash) {
    const made = Number(dash[1]);
    const other = Number(dash[2]);
    if (/efficienc|red zone/i.test(label)) return other > 0 ? made / other : 0;
    if (/penalt/i.test(label)) return other;
    return made;
  }
  const n = Number.parseFloat(text.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function leaderColumns(labels: string[], athletes: { stats: string[] }[]): Map<number, Set<number>> {
  const leaders = new Map<number, Set<number>>();
  labels.forEach((label, col) => {
    if (!LEADER_STAT.test(label)) return;
    const nums = athletes.map((athlete) => {
      const raw = athlete.stats[col];
      if (!raw || raw === "—" || raw.includes("/")) return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    });
    const finite = nums.filter((n): n is number => n != null);
    if (finite.length < 2) return;
    const max = Math.max(...finite);
    const min = Math.min(...finite);
    if (max === min || max <= 0) return;
    const hits = new Set<number>();
    nums.forEach((n, index) => {
      if (n === max) hits.add(index);
    });
    leaders.set(col, hits);
  });
  return leaders;
}

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

  const currentDrive = useMemo(() => {
    if (!g?.currentDriveId) return null;
    return g.drives.find((drive) => drive.id === g.currentDriveId) ?? null;
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
  const awayWins = g.final && (g.away.score ?? 0) > (g.home.score ?? 0);
  const homeWins = g.final && (g.home.score ?? 0) > (g.away.score ?? 0);
  const possId = g.live ? g.situation?.possessionTeamId : null;
  const awayHasBall = possId != null && String(possId) === String(g.away.teamId);
  const homeHasBall = possId != null && String(possId) === String(g.home.teamId);
  const label = statusLabel(g);
  const pregame = !g.final && !g.live;
  const clockParts = appleClockParts(g.shortDetail);
  const clockInNest = Boolean(g.live && clockParts.period && clockParts.clock);
  const barLabel = clockInNest ? "Live" : label;

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
    <div className="space-y-3">
      <header className="relative overflow-hidden rounded-xl border border-white/[0.1] bg-[#07101d] shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 w-1/2",
            homeWins ? "opacity-40" : "opacity-90",
          )}
          style={{
            background: `radial-gradient(ellipse at 20% 45%, #${g.away.color}88, transparent 58%)`,
          }}
        />
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 w-1/2",
            awayWins ? "opacity-40" : "opacity-90",
          )}
          style={{
            background: `radial-gradient(ellipse at 80% 45%, #${g.home.color}88, transparent 58%)`,
          }}
        />
        <div className="relative z-10 flex items-center justify-between gap-2 border-b border-white/[0.07] px-3 py-2 sm:px-4">
          <p
            className={cn(
              "shrink-0 text-[11px] font-bold uppercase tracking-[0.16em]",
              g.final ? "text-cream" : g.live ? "text-alert" : "text-[#a8b0c2]",
            )}
          >
            {barLabel}
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

        <div className="relative z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2 sm:gap-4 sm:px-6 sm:py-3">
          <MatchupSide
            side={g.away}
            align="left"
            winner={awayWins}
            loser={homeWins}
            hasBall={awayHasBall}
          />
          <div className="px-1 text-center">
            <AppleScoreCluster
              away={g.away.score}
              home={g.home.score}
              detail={g.shortDetail || label}
              live={g.live}
              final={g.final}
              size="header"
              awayTimeouts={g.situation?.awayTimeouts}
              homeTimeouts={g.situation?.homeTimeouts}
              preview={g.whenShort}
              awayDim={homeWins}
              homeDim={awayWins}
            />
            {pregame ? (
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/80">
                Kickoff
              </p>
            ) : null}
          </div>
          <MatchupSide
            side={g.home}
            align="right"
            winner={homeWins}
            loser={awayWins}
            hasBall={homeHasBall}
          />
        </div>

        {!pregame ? (
          <div className="relative z-10 border-t border-white/[0.06] px-3 pb-2 pt-0.5 sm:px-4">
            <CfbLinescoreTable away={g.away} home={g.home} />
          </div>
        ) : null}
      </header>

      {!g.final && (g.live || g.situation || homeYardLine != null) && (
        <section className="space-y-2">
          <NflFieldMap
            game={g}
            branded
            homeYardLine={homeYardLine}
            possessionTeamId={g.situation?.possessionTeamId ?? null}
            downDistanceText={g.situation?.downDistanceText}
            drive={currentDrive ? cfbDriveGlance(currentDrive) : null}
            omitLastPlay
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

      {!g.final && g.winProbability.length > 0 ? (
        <CfbWinProbability away={g.away} home={g.home} points={g.winProbability} />
      ) : null}

      <CfbRecentPlays g={g} />

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
          <div className="border-b border-white/[0.06] px-4 py-3">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#e8e4d9]">
              Team stats
            </h2>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-white/[0.06] px-4 py-3">
            <Link
              to={`/sports/cfb/team/${g.away.teamId}`}
              className="flex min-w-0 items-center gap-2 hover:opacity-90"
            >
              {g.away.logo ? <LogoPlate src={g.away.logo} className="h-8 w-8" /> : null}
              <span className="min-w-0">
                <span className="text-cream block text-[13px] font-semibold leading-tight">
                  {g.away.abbrev}
                </span>
                {g.away.record ? (
                  <span className="numeral text-chalk-dim block text-[10.5px] leading-tight">
                    {g.away.record}
                  </span>
                ) : null}
              </span>
            </Link>
            <span className="text-[10px] uppercase tracking-[0.14em] text-[#8b93a7]">vs</span>
            <Link
              to={`/sports/cfb/team/${g.home.teamId}`}
              className="flex min-w-0 items-center justify-end gap-2 text-right hover:opacity-90"
            >
              <span className="min-w-0">
                <span className="text-cream block text-[13px] font-semibold leading-tight">
                  {g.home.abbrev}
                </span>
                {g.home.record ? (
                  <span className="numeral text-chalk-dim block text-[10.5px] leading-tight">
                    {g.home.record}
                  </span>
                ) : null}
              </span>
              {g.home.logo ? <LogoPlate src={g.home.logo} className="h-8 w-8" /> : null}
            </Link>
          </div>
          <ul>
            {teamStatLabels.map((statLabel) => {
              const away =
                g.teamStats.find(
                  (s) => s.label === statLabel && s.teamAbbrev === g.away.abbrev,
                )?.value ?? "—";
              const home =
                g.teamStats.find(
                  (s) => s.label === statLabel && s.teamAbbrev === g.home.abbrev,
                )?.value ?? "—";
              const awayMag = statMagnitude(statLabel, away);
              const homeMag = statMagnitude(statLabel, home);
              const numeric = awayMag != null && homeMag != null;
              const total = numeric ? Math.abs(awayMag) + Math.abs(homeMag) : 0;
              const awayShare = numeric && total > 0 ? (Math.abs(awayMag) / total) * 100 : 50;
              const lower = LOWER_IS_BETTER.test(statLabel);
              const awayLeads = numeric && awayMag !== homeMag && (lower ? awayMag < homeMag : awayMag > homeMag);
              const homeLeads = numeric && awayMag !== homeMag && !awayLeads;
              const possession = /possession/i.test(statLabel);
              return (
                <li key={statLabel} className="border-t border-white/[0.05] px-3 py-2 sm:px-4">
                  <div className="grid grid-cols-[5.25rem_minmax(0,1fr)_5.25rem] items-center gap-1">
                    <span
                      className={cn(
                        "numeral rounded-md px-2 py-1 text-left text-[14px]",
                        awayLeads ? "font-semibold text-cream" : "text-white/75",
                      )}
                      style={{ backgroundColor: teamWash(g.away.color) }}
                    >
                      {away}
                    </span>
                    <span className="text-center text-[10px] font-medium uppercase tracking-[0.12em] text-[#8b93a7]">
                      {statLabel}
                    </span>
                    <span
                      className={cn(
                        "numeral rounded-md px-2 py-1 text-right text-[14px]",
                        homeLeads ? "font-semibold text-cream" : "text-white/75",
                      )}
                      style={{ backgroundColor: teamWash(g.home.color) }}
                    >
                      {home}
                    </span>
                  </div>
                  {numeric && total > 0 ? (
                    <div
                      className={cn(
                        "mt-1.5 flex overflow-hidden rounded-full bg-white/[0.05]",
                        possession ? "h-2" : "h-1.5",
                      )}
                    >
                      <span
                        className="h-full rounded-l-full"
                        style={{
                          width: `${awayShare}%`,
                          background: readableTeamColor(g.away.color),
                          opacity: awayLeads ? 0.95 : 0.45,
                        }}
                      />
                      <span
                        className="h-full flex-1 rounded-r-full"
                        style={{
                          background: readableTeamColor(g.home.color),
                          opacity: homeLeads ? 0.95 : 0.45,
                        }}
                      />
                    </div>
                  ) : numeric ? (
                    <div className={cn("mt-1.5 rounded-full bg-white/[0.05]", possession ? "h-2" : "h-1.5")} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {g.boxGroups.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#e8e4d9]">
            Box score
          </h2>
          {(["away", "home"] as const).map((which) => {
            const side = which === "away" ? g.away : g.home;
            const groups = g.boxGroups.filter((gr) => gr.teamAbbrev === side.abbrev);
            if (!groups.length) return null;
            return (
              <div key={side.teamId} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 px-0.5">
                  {side.logo ? <LogoPlate src={side.logo} className="h-7 w-7" /> : null}
                  <div>
                    <p className="text-[14px] font-bold text-white">
                      <CfbRankLabel pollRank={side.rank} fpiRank={null} />
                      {side.name}
                    </p>
                    {side.record ? (
                      <p className="numeral text-[12px] font-medium text-white/85">{side.record}</p>
                    ) : null}
                    <CfbFpiCaption pollRank={side.rank} fpiRank={side.fpiRank} />
                  </div>
                </div>
                {groups.map((group) => {
                  const leaders = leaderColumns(group.labels, group.athletes);
                  return (
                  <div
                    key={`${group.teamAbbrev}-${group.name}`}
                    className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]"
                  >
                    <div className="border-b border-white/[0.06] px-3 py-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e8e4d9]">
                        {group.teamAbbrev} · {group.name}
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[480px] text-left text-[12px]">
                        <thead>
                          <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                            <th className="px-3 py-1.5 font-medium">Player</th>
                            {group.labels.map((lab) => (
                              <th key={lab} className="numeral px-1.5 py-1.5 font-medium">
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
                              <td className="px-3 py-1">
                                <Link
                                  to={`/sports/cfb/player/${a.id}`}
                                  className="text-cream hover:text-accent hover:underline"
                                >
                                  {a.name}
                                </Link>
                              </td>
                              {group.labels.map((_, idx) => {
                                const leads = leaders.get(idx)?.has(i) ?? false;
                                return (
                                <td
                                  key={`${a.id}-${idx}`}
                                  className={cn(
                                    "numeral px-1.5 py-1",
                                    leads ? "font-semibold text-cream" : "text-white/75",
                                  )}
                                >
                                  {a.stats[idx] ?? "—"}
                                </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  );
                })}
              </div>
            );
          })}
        </section>
      )}

      {g.final && g.winProbability.length > 0 ? (
        <CfbWinProbability away={g.away} home={g.home} points={g.winProbability} />
      ) : null}

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
            <th className="px-2 py-1 text-left font-medium">Team</th>
            {headers.map((h) => (
              <th key={h} className="numeral px-1.5 py-1 font-medium">
                {h}
              </th>
            ))}
            <th className="numeral px-2 py-1 font-semibold text-cream/80">T</th>
          </tr>
        </thead>
        <tbody>
          {[away, home].map((side) => (
            <tr key={side.teamId} className="border-t border-white/[0.05]">
              <td className="px-2 py-1 text-left">
                <span className="inline-flex items-center gap-1.5 font-semibold text-cream">
                  {side.logo ? <LogoPlate src={side.logo} className="h-4 w-4" /> : null}
                  {side.abbrev}
                </span>
              </td>
              {headers.map((_, i) => (
                <td key={`${side.teamId}-${i}`} className="numeral px-1.5 py-1 text-white/85">
                  {side.linescores[i] ?? "–"}
                </td>
              ))}
              <td className="numeral px-2 py-1 font-bold text-white">
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
  hasBall,
}: {
  side: CfbScoreSide;
  align: "left" | "right";
  winner: boolean;
  loser: boolean;
  hasBall: boolean;
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
        <LogoPlate src={side.logo} className={cn("h-12 w-12 sm:h-14 sm:w-14", loser && "opacity-40")} />
      ) : null}
      <div className="min-w-0">
        <p
          className={cn(
            "inline-flex items-center gap-1 text-[15px] font-bold leading-tight sm:text-[17px]",
            winner ? "text-white" : loser ? "text-white/40" : "text-white",
          )}
        >
          {align === "right" && hasBall ? (
            <PossessionFootball className="h-3 w-5 shrink-0" />
          ) : null}
          <CfbRankLabel pollRank={side.rank} fpiRank={null} />
          {side.abbrev}
          {align === "left" && hasBall ? (
            <PossessionFootball className="h-3 w-5 shrink-0" />
          ) : null}
        </p>
        <p className={cn("text-[11px] leading-tight", loser ? "text-white/35" : "text-white/75")}>
          {side.name}
        </p>
        {side.record ? (
          <p
            className={cn(
              "numeral mt-0.5 text-[12px] font-medium",
              loser ? "text-white/35" : "text-white/85",
            )}
          >
            {side.record}
          </p>
        ) : null}
        <CfbFpiCaption pollRank={side.rank} fpiRank={side.fpiRank} className="mt-0.5" />
      </div>
    </Link>
  );
}

export default function CfbGamePage() {
  const { eventId } = useParams<{ eventId: string }>();
  const goBack = useSportsBack("/sports/cfb?solo=1");
  const swipeRef = useSwipeBack(goBack);

  if (!eventId) {
    return <p className="text-alert p-6 text-[13px]">Missing game id</p>;
  }

  return (
    <div ref={swipeRef} className="mx-auto max-w-5xl px-3 pb-3 pt-1.5 sm:p-4 md:p-7">
      <CfbGameDetailView eventId={eventId} />
    </div>
  );
}
