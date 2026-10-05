import { useMemo, useRef, useState, type RefObject } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ChevronRight, Loader2, Play } from "lucide-react";
import { SelectableHighlightRegion } from "@/components/rss/SelectableHighlightRegion";
import { liveScoreHeader } from "@/lib/apple-score";
import EspnVideoEmbed from "@/components/sports/EspnVideoEmbed";
import AppleScoreCluster from "@/components/sports/AppleScoreCluster";
import PlayoffSeriesLine from "@/components/sports/PlayoffSeriesLine";
import LogoPlate from "@/components/sports/LogoPlate";
import HighlightReel, { type ReelHighlight } from "@/components/sports/HighlightReel";
import NhlBoxScore from "@/components/sports/NhlBoxScore";
import NhlGameLeaders from "@/components/sports/NhlGameLeaders";
import NhlIceRink, { type NhlIceGoalieBadge } from "@/components/sports/NhlIceRink";
import NhlScoringSummary from "@/components/sports/NhlScoringSummary";
import NhlGoalies from "@/components/sports/NhlGoalies";
import NhlThreeStars from "@/components/sports/NhlThreeStars";
import TeamStatsLogos from "@/components/sports/TeamStatsLogos";
import { useSportsBack, useSwipeBack } from "@/hooks/useSwipeBack";
import {
  dedupeNhlEspnVideos,
  fetchNhlGameDetail,
  fetchNhlGamecenter,
  liftTeamColor,
  nhlClockKey,
  nhlHeadshot,
  rankNhlWrapVideos,
  type NhlBoxRow,
  type NhlGameDetail,
  type NhlGameVideo,
  type NhlGoalClip,
  type NhlRecentPlay,
  type NhlScoreSide,
  type NhlWrapKind,
} from "@/lib/nhl";
import { fetchNhlShiftLines } from "@/lib/nhl-lines";
import { cn } from "@/lib/utils";

function statusLabel(g: {
  live: boolean;
  final: boolean;
  status: string;
  shortDetail: string | null;
}): string {
  if (g.live) return g.shortDetail && !/^live$/i.test(g.shortDetail) ? g.shortDetail : "Live";
  if (g.final) {
    if (g.shortDetail && !/^final$/i.test(g.shortDetail.trim())) return g.shortDetail;
    return "Final";
  }
  if (g.shortDetail && !/scheduled|pregame|pre-game/i.test(g.shortDetail)) return g.shortDetail;
  return "Preview";
}

export default function NhlGamePage() {
  const { eventId } = useParams<{ eventId: string }>();
  const goBack = useSportsBack("/sports/nhl?solo=1");
  const swipeRef = useSwipeBack(goBack);

  const game = useQuery({
    queryKey: ["nhl-game", eventId],
    queryFn: () => fetchNhlGameDetail(eventId!),
    enabled: Boolean(eventId),
    refetchInterval: (q) => (q.state.data?.live ? 15_000 : false),
    staleTime: 8_000,
  });

  const g = game.data;
  const started = Boolean(g && (g.live || g.final));
  const gamecenter = useQuery({
    queryKey: ["nhl-gamecenter", eventId],
    queryFn: () => fetchNhlGamecenter(g!),
    enabled: Boolean(g) && started,
    refetchInterval: (q) =>
      g?.live
        ? 30_000
        : g?.final && q.state.data && (!q.state.data.wraps.length || !q.state.data.threeStars.length)
          ? 120_000
          : false,
    staleTime: 20_000,
    retry: 1,
  });
  const situation = g?.live ? (gamecenter.data?.situation ?? null) : null;
  const threeStars = gamecenter.data?.threeStars ?? [];
  const nhlGameId = gamecenter.data?.nhlGameId ?? null;
  const shiftLines = useQuery({
    queryKey: ["nhl-shift-lines", nhlGameId],
    queryFn: () => fetchNhlShiftLines(nhlGameId!),
    enabled: nhlGameId != null,
    refetchInterval: g?.live ? 60_000 : false,
    staleTime: 45_000,
    retry: 1,
  });

  const [featuredId, setFeaturedId] = useState<string | null>(null);
  const highlightsRef = useRef<HTMLElement>(null);

  const final = Boolean(g?.final);
  const { clips, goalByClock } = useMemo(() => {
    const goals = gamecenter.data?.goals ?? [];
    const espnPlayable = (g?.videos ?? []).filter((v) => v.mp4);
    const wraps = final ? rankNhlWrapVideos([...espnPlayable, ...(gamecenter.data?.wraps ?? [])]) : [];
    const wrapIds = new Set(wraps.map((w) => w.id));
    const espn = dedupeNhlEspnVideos(
      espnPlayable.filter((v) => !wrapIds.has(v.id)),
      goals,
    );
    const byClock = new Map<string, NhlGoalClip>();
    for (const goal of goals) {
      const key = nhlClockKey(goal.periodNumber, goal.timeInPeriod);
      if (key) byClock.set(key, goal);
    }
    // Live: newest goal first. Final: the game in order, after the whole-game wraps.
    const goalOrder: NhlGameVideo[] = final ? goals : [...goals].reverse();
    return { clips: [...wraps, ...goalOrder, ...espn], goalByClock: byClock };
  }, [gamecenter.data, g?.videos, final]);

  const primaryClip = clips.find((c) => c.id === featuredId) ?? clips[0] ?? null;
  const reel: ReelHighlight[] = clips
    .filter((c) => c.id !== primaryClip?.id && c.mp4)
    .map((c) => ({
      id: c.id,
      title: isGoalClip(c) ? `${c.headline} · ${c.periodLabel} ${c.timeInPeriod}` : c.headline,
      duration: formatClipDuration(c.durationSec),
      thumb: c.thumb,
      url: c.mp4!,
    }));

  const watchGoal = (clipId: string) => {
    setFeaturedId(clipId);
    highlightsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!eventId) return <p className="text-alert p-6 text-[13px]">Missing game id</p>;

  const periods = g
    ? Math.max(g.away.linescores.length, g.home.linescores.length, g.final || g.live ? 3 : 0)
    : 0;
  const recapUrl = `https://www.espn.com/nhl/recap/_/gameId/${eventId}`;
  const winner =
    g?.final && g.away.score != null && g.home.score != null && g.away.score !== g.home.score
      ? g.away.score > g.home.score
        ? "away"
        : "home"
      : null;
  const hasStory = Boolean(g?.article?.storyHtml || g?.article?.description);

  const label = g ? statusLabel(g) : "";
  const barLabel = g?.live ? liveScoreHeader(g.shortDetail || label, label) : label;
  const goalieBadges = g?.ice
    ? { away: goalieBadgeFor(g, "away"), home: goalieBadgeFor(g, "home") }
    : undefined;

  return (
    <div ref={swipeRef} className="mx-auto max-w-6xl space-y-5 px-3 pb-4 pt-1.5 sm:p-4 md:p-7">
      {game.isPending ? (
        <div className="text-chalk flex min-h-[40vh] items-center justify-center gap-2">
          <Loader2 size={18} className="animate-spin" />
          Loading game…
        </div>
      ) : game.isError || !g ? (
        <p className="text-alert text-[13px]">Couldn’t load this game.</p>
      ) : (
        <>
          <header className="relative overflow-hidden rounded-xl border border-white/[0.1] bg-[#07101d] shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
            <div
              className={cn(
                "pointer-events-none absolute inset-y-0 left-0 w-1/2",
                winner === "home" ? "opacity-40" : "opacity-90",
              )}
              style={{
                background: `radial-gradient(ellipse at 20% 45%, #${g.away.color}88, transparent 58%)`,
              }}
            />
            <div
              className={cn(
                "pointer-events-none absolute inset-y-0 right-0 w-1/2",
                winner === "away" ? "opacity-40" : "opacity-90",
              )}
              style={{
                background: `radial-gradient(ellipse at 80% 45%, #${g.home.color}88, transparent 58%)`,
              }}
            />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.06),transparent_45%)]" />

            <div className="relative z-10 flex items-center justify-between gap-2 border-b border-white/[0.07] px-3 py-2.5 sm:px-4">
              <p
                className={cn(
                  "text-[11px] font-semibold uppercase tracking-[0.14em]",
                  g.live ? "text-alert" : "text-chalk",
                )}
              >
                {g.live ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="bg-alert h-1.5 w-1.5 animate-pulse rounded-full" />
                    {barLabel}
                  </span>
                ) : (
                  barLabel
                )}
              </p>
              <p className="text-[11px] text-[#8b93a7]">{g.venueDetail ?? g.venue ?? "NHL"}</p>
            </div>

            <div className="relative z-10 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 px-2 py-3 sm:gap-4 sm:px-5 sm:py-4">
              <TeamBlock side={g.away} align="left" dim={winner === "home"} />
              <div className="px-1 text-center">
                <AppleScoreCluster
                  away={g.away.score}
                  home={g.home.score}
                  detail={g.shortDetail || label}
                  live={g.live}
                  final={g.final}
                  size="header"
                  preview={g.whenShort ?? "vs"}
                  awayDim={winner === "home"}
                  homeDim={winner === "away"}
                />
                {!started && g.when ? (
                  <p className="text-chalk-dim mt-1.5 text-[11px]">{g.when}</p>
                ) : null}
                {situation?.powerPlayAbbrev && situation.timeRemaining ? (
                  <p className="text-accent mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] tabular-nums">
                    {situation.powerPlayAbbrev} PP · {situation.timeRemaining.replace(/^0/, "")}
                  </p>
                ) : null}
                {g.oddsLine && !g.final ? (
                  <p className="text-chalk mt-1.5 text-[10px] font-medium tracking-wide">{g.oddsLine}</p>
                ) : null}
                <PlayoffSeriesLine line={g.seriesLine} className="mx-auto mt-1.5 max-w-[14rem] text-center" />
              </div>
              <TeamBlock side={g.home} align="right" dim={winner === "away"} />
            </div>

            {(g.goalieStarters.away || g.goalieStarters.home) && !g.final ? (
              <div className="relative z-10 grid grid-cols-2 gap-3 border-t border-white/[0.07] px-3 py-3 sm:px-5">
                <GoalieChip side="Away" starter={g.goalieStarters.away} />
                <GoalieChip side="Home" starter={g.goalieStarters.home} align="right" />
              </div>
            ) : null}

            {g.broadcasts.length > 0 ? (
              <div className="relative z-10 flex flex-wrap items-center gap-1.5 border-t border-white/[0.07] px-3 py-2 sm:px-5">
                <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/40">
                  TV
                </span>
                {g.broadcasts.map((b) => (
                  <span
                    key={`${b.market ?? "x"}-${b.name}`}
                    className="inline-flex h-5 max-w-[9rem] items-center gap-1 rounded-sm bg-white/[0.07] px-1.5 text-[10px] text-[#c5cce0]"
                    title={b.market ? `${b.name} (${b.market})` : b.name}
                  >
                    {b.logo ? (
                      <img src={b.logo} alt="" className="h-3.5 w-auto max-w-[2.75rem] object-contain" />
                    ) : null}
                    <span className="truncate">{b.name}</span>
                  </span>
                ))}
              </div>
            ) : null}

            {periods > 0 && (
              <div className="relative z-10 overflow-x-auto border-t border-white/[0.07]">
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
                        <td className="numeral text-cream px-3 py-2 font-semibold">
                          {side.score ?? 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </header>

          {g.final ? (
            <>
              {primaryClip ? (
                <WrapHero
                  g={g}
                  sectionRef={highlightsRef}
                  primary={primaryClip}
                  playlist={clips.filter((c) => c.id !== primaryClip.id && c.mp4)}
                  autoPlay={primaryClip.id === featuredId}
                  onPick={setFeaturedId}
                  hasStory={hasStory}
                />
              ) : null}

              {threeStars.length > 0 ? (
                <NhlThreeStars stars={threeStars} away={g.away} home={g.home} boxGroups={g.boxGroups} />
              ) : g.leaders.length > 0 ? (
                <NhlGameLeaders g={g} />
              ) : null}
              {g.final ? <NhlGoalies away={g.away} home={g.home} rows={goalieRows(g)} /> : null}

              <div
                className={cn(
                  "grid items-start gap-5",
                  g.scoringPlays.length > 0 &&
                    g.teamStats.length > 0 &&
                    "lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]",
                )}
              >
                <NhlScoringSummary g={g} goalByClock={goalByClock} onWatch={watchGoal} />
                {g.teamStats.length > 0 && <TeamStats g={g} />}
              </div>

              {threeStars.length > 0 && g.leaders.length > 0 ? <NhlGameLeaders g={g} /> : null}

              {hasStory ? <GameStory g={g} recapUrl={recapUrl} /> : null}

              {g.boxGroups.length > 0 && (
                <NhlBoxScore
                  g={g}
                  shiftLines={shiftLines.data}
                  shiftsPending={nhlGameId != null && shiftLines.isPending}
                />
              )}

              {g.ice ? (
                <details className="group bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-2">
                      <ChevronRight
                        size={14}
                        className="text-[#8b93a7] transition-transform group-open:rotate-90"
                      />
                      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
                        Ice Tracker
                      </span>
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.14em] text-[#6f778a]">
                      Final on ice
                    </span>
                  </summary>
                  <div className="border-t border-white/[0.06] p-3">
                    <NhlIceRink
                      ice={g.ice}
                      away={g.away}
                      home={g.home}
                      live={g.live}
                      final={g.final}
                      statusText={label}
                      goalieBadges={goalieBadges}
                    />
                  </div>
                </details>
              ) : null}
            </>
          ) : (
            <>
              {g.ice ? (
                <NhlIceRink
                  ice={g.ice}
                  away={g.away}
                  home={g.home}
                  live={g.live}
                  final={g.final}
                  statusText={label}
                  goalieBadges={goalieBadges}
                />
              ) : null}

              <RecentPlays g={g} />

              {primaryClip ? (
                <section ref={highlightsRef} className="scroll-mt-4 space-y-2.5">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
                    Game highlights
                  </h3>
                  <EspnVideoEmbed
                    key={primaryClip.id}
                    clip={primaryClip}
                    eyebrow={clipEyebrow(primaryClip)}
                    autoPlay={primaryClip.id === featuredId}
                  />
                  {reel.length > 0 ? (
                    <HighlightReel highlights={reel} title="More highlights" defaultOpen />
                  ) : null}
                </section>
              ) : null}

              {hasStory ? <GameStory g={g} recapUrl={recapUrl} /> : null}

              {g.lastFive.length > 0 ? <LastFive g={g} /> : null}

              {threeStars.length > 0 ? (
                <NhlThreeStars stars={threeStars} away={g.away} home={g.home} boxGroups={g.boxGroups} />
              ) : null}

              {g.leaders.length > 0 && <NhlGameLeaders g={g} />}

              <NhlScoringSummary g={g} goalByClock={goalByClock} onWatch={watchGoal} />

              {g.teamStats.length > 0 && <TeamStats g={g} />}

              {g.boxGroups.length > 0 && (
                <NhlBoxScore
                  g={g}
                  shiftLines={shiftLines.data}
                  shiftsPending={nhlGameId != null && shiftLines.isPending}
                />
              )}
            </>
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

function TeamBlock({
  side,
  align,
  dim = false,
}: {
  side: NhlScoreSide;
  align: "left" | "right";
  dim?: boolean;
}) {
  return (
    <Link
      to={`/sports/nhl/team/${side.teamId}`}
      className={cn(
        "flex min-w-0 flex-col items-center gap-1 text-center transition-opacity sm:gap-3",
        align === "left" ? "sm:flex-row sm:text-left" : "sm:flex-row-reverse sm:text-right",
      )}
    >
      {side.logo ? (
        <LogoPlate src={side.logo} className={cn("h-14 w-14 sm:h-20 sm:w-20", dim && "opacity-40")} />
      ) : null}
      <div className="min-w-0">
        <p
          className={cn(
            "text-[15px] font-semibold leading-tight sm:text-[22px]",
            dim ? "text-white/40" : "text-cream",
          )}
        >
          {side.abbrev}
        </p>
        <p className={cn("hidden truncate text-[12px] sm:block", dim ? "text-white/30" : "text-chalk-dim")}>
          {side.name}
        </p>
        {side.record ? (
          <p className={cn("numeral text-[11px]", dim ? "text-white/30" : "text-chalk-dim")}>{side.record}</p>
        ) : null}
        {side.points != null ? (
          <p className="numeral text-[10px] tracking-[0.08em] text-[#6f778a]">
            {side.points} {side.points === 1 ? "PT" : "PTS"}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

const LOWER_IS_BETTER = new Set(["Giveaways", "PIM"]);

function goalieRows(g: NhlGameDetail): { side: NhlScoreSide; row: NhlBoxRow }[] {
  const out: { side: NhlScoreSide; row: NhlBoxRow }[] = [];
  for (const side of [g.away, g.home]) {
    const group = g.boxGroups.find(
      (b) => b.name === "Goalies" && (b.teamId === String(side.teamId) || b.teamAbbrev === side.abbrev),
    );
    for (const row of group?.rows ?? []) out.push({ side, row });
  }
  return out;
}

function TeamStats({ g }: { g: NhlGameDetail }) {
  return (
    <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
      <div className="border-b border-white/[0.06] px-4 py-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">Team stats</h3>
      </div>
      <TeamStatsLogos
        away={{
          logo: g.away.logo,
          abbrev: g.away.abbrev,
          name: g.away.name,
          record: g.away.record,
          href: `/sports/nhl/team/${g.away.teamId}`,
        }}
        home={{
          logo: g.home.logo,
          abbrev: g.home.abbrev,
          name: g.home.name,
          record: g.home.record,
          href: `/sports/nhl/team/${g.home.teamId}`,
        }}
      />
      <ul className="divide-y divide-white/[0.05]">
        {g.teamStats.map((row) => {
          const a = Number.parseFloat(row.away);
          const h = Number.parseFloat(row.home);
          const numeric = Number.isFinite(a) && Number.isFinite(h);
          const total = numeric ? a + h : 0;
          const awayShare = total > 0 ? (a / total) * 100 : 50;
          const lower = LOWER_IS_BETTER.has(row.label);
          const awayLeads = numeric && a !== h && (lower ? a < h : a > h);
          const homeLeads = numeric && a !== h && !awayLeads;
          return (
            <li key={row.label} className="px-4 py-2.5">
              <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_3.5rem] items-center text-center">
                <span className={cn("numeral text-left text-[14px]", awayLeads ? "text-cream font-semibold" : "text-white/70")}>
                  {row.away}
                </span>
                <span className="text-[10.5px] uppercase tracking-[0.12em] text-[#8b93a7]">{row.label}</span>
                <span className={cn("numeral text-right text-[14px]", homeLeads ? "text-cream font-semibold" : "text-white/70")}>
                  {row.home}
                </span>
              </div>
              {numeric && total > 0 ? (
                <div className="mt-1.5 flex h-1 gap-0.5 overflow-hidden rounded-full">
                  <span
                    className="rounded-l-full"
                    style={{ width: `${awayShare}%`, background: liftTeamColor(`#${g.away.color}`), opacity: awayLeads ? 1 : 0.55 }}
                  />
                  <span
                    className="flex-1 rounded-r-full"
                    style={{ background: liftTeamColor(`#${g.home.color}`), opacity: homeLeads ? 1 : 0.55 }}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function WrapHero({
  g,
  sectionRef,
  primary,
  playlist,
  autoPlay,
  onPick,
  hasStory,
}: {
  g: NhlGameDetail;
  sectionRef: RefObject<HTMLElement | null>;
  primary: NhlGameVideo;
  playlist: NhlGameVideo[];
  autoPlay: boolean;
  onPick: (clipId: string) => void;
  hasStory: boolean;
}) {
  const headline =
    g.article?.headline ??
    `${g.away.name} ${g.away.score ?? 0}, ${g.home.name} ${g.home.score ?? 0}`;
  const dek = g.article?.description?.replace(/^—\s*/, "") || null;
  const pick = (clipId: string) => {
    onPick(clipId);
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <section
      ref={sectionRef}
      className="relative scroll-mt-4 overflow-hidden rounded-xl border border-white/[0.1] bg-[#07101d] shadow-[0_18px_50px_rgba(0,0,0,0.3)]"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-50"
        style={{
          background: `linear-gradient(100deg, #${g.away.color}55, transparent 45%, transparent 55%, #${g.home.color}55)`,
        }}
      />
      <div className="relative px-4 pb-3 pt-4 sm:px-5">
        <p className="text-accent flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]">
          <Play size={10} className="fill-current" /> Game wrap
        </p>
        <h2 className="font-rss text-cream mt-1.5 max-w-4xl text-[21px] font-semibold leading-tight sm:text-[26px]">
          {headline}
        </h2>
        {dek ? (
          <p className="text-chalk mt-1.5 line-clamp-2 max-w-3xl text-[13px] leading-relaxed">{dek}</p>
        ) : null}
        {hasStory ? (
          <button
            type="button"
            onClick={() =>
              document.getElementById("game-story")?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="text-chalk hover:text-cream mt-2 inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.14em]"
          >
            <ArrowDown size={12} /> Read the story
          </button>
        ) : null}
      </div>
      <div
        className={cn(
          "relative grid gap-3 px-3 pb-3 sm:px-4 sm:pb-4",
          playlist.length > 0 && "lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]",
        )}
      >
        <EspnVideoEmbed
          key={primary.id}
          clip={primary}
          eyebrow={clipEyebrow(primary)}
          autoPlay={autoPlay}
        />
        {playlist.length > 0 ? (
          <aside className="flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-black/25 lg:h-0 lg:min-h-full">
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
                More from this game
              </p>
              <span className="rounded-sm bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-[#8b93a7]">
                {playlist.length}
              </span>
            </div>
            <ul className="max-h-[19rem] divide-y divide-white/[0.05] overflow-y-auto lg:max-h-none lg:min-h-0 lg:flex-1">
              {playlist.map((c) => {
                const duration = formatClipDuration(c.durationSec);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => pick(c.id)}
                      className="group flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-white/[0.04]"
                    >
                      <span className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-md bg-black/40">
                        {c.thumb ? (
                          <img src={c.thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : null}
                        <span className="absolute inset-0 grid place-items-center bg-black/25 transition group-hover:bg-black/10">
                          <Play size={13} className="text-cream fill-current" />
                        </span>
                        {duration ? (
                          <span className="absolute bottom-1 right-1 rounded-sm bg-black/70 px-1 text-[9px] text-[#d5dae6]">
                            {duration}
                          </span>
                        ) : null}
                      </span>
                      <span className="min-w-0">
                        <span
                          className={cn(
                            "block text-[9.5px] font-semibold uppercase tracking-[0.14em]",
                            c.wrap ? "text-accent" : "text-[#8b93a7]",
                          )}
                        >
                          {playlistEyebrow(c)}
                        </span>
                        <span className="text-cream mt-0.5 line-clamp-2 block text-[12.5px] leading-snug">
                          {c.headline}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
        ) : null}
      </div>
    </section>
  );
}

function GameStory({ g, recapUrl }: { g: NhlGameDetail; recapUrl: string }) {
  if (!g.article) return null;
  return (
    <section
      id="game-story"
      className="bg-panel font-rss scroll-mt-4 overflow-hidden rounded-xl border border-white/[0.08]"
    >
      <div className="border-b border-white/[0.06] px-4 py-3">
        <p className="text-accent text-[10px] font-semibold uppercase tracking-[0.16em]">
          {g.final ? "Game story" : "Preview"}
        </p>
        <h2 className="font-rss text-cream mt-1 text-[20px] font-semibold leading-snug">
          {g.article.headline}
        </h2>
        {g.article.description ? (
          <p className="text-chalk mt-2 text-[13px] leading-relaxed">
            {g.article.description.replace(/^—\s*/, "")}
          </p>
        ) : null}
      </div>
      {g.article.storyHtml ? (
        <SelectableHighlightRegion
          articleUrl={recapUrl}
          articleTitle={g.article.headline}
          feedUrl="synthetic:nhl-wraps"
          html={g.article.storyHtml}
          className="rss-reader px-4 py-4 text-[15px] leading-[1.75] text-[#d5dae6] [&_a]:font-semibold [&_a]:text-accent [&_a]:hover:underline [&_p]:my-3.5 [&_mark.rss-hl]:bg-accent/35 [&_mark.rss-hl]:text-cream"
        />
      ) : null}
    </section>
  );
}

function LastFive({ g }: { g: NhlGameDetail }) {
  return (
    <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
      <h3 className="rule-head mb-3">Last five</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {g.lastFive.map((side) => (
          <div key={side.teamAbbrev}>
            <p className="text-cream mb-2 text-[12px] font-semibold">{side.teamAbbrev}</p>
            <ul className="space-y-1.5">
              {side.results.map((r, i) => (
                <li
                  key={`${side.teamAbbrev}-${i}`}
                  className="flex items-center justify-between gap-2 text-[12px]"
                >
                  <span className="text-chalk-dim">vs {r.label}</span>
                  <span
                    className={cn(
                      "numeral font-semibold",
                      /^W/i.test(r.result)
                        ? "text-emerald-400"
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
    </section>
  );
}

function goalieBadgeFor(g: NhlGameDetail, side: "away" | "home"): NhlIceGoalieBadge | null {
  const goalie = (g.ice?.[side] ?? []).find((p) => (p.position ?? "").toUpperCase() === "G");
  if (!goalie) return null;
  const team = side === "away" ? g.away : g.home;
  const row = g.boxGroups
    .find(
      (b) =>
        b.name === "Goalies" &&
        (b.teamId === String(team.teamId) || b.teamAbbrev === team.abbrev),
    )
    ?.rows.find((r) => r.id === goalie.id);
  const read = (stat: string) => row?.stats.find((s) => s.label === stat)?.value ?? null;
  return {
    id: goalie.id,
    name: goalie.name,
    lastName: goalie.lastName,
    jersey: goalie.jersey,
    headshot: goalie.headshot,
    sv: read("SV"),
    svPct: read("SV%"),
  };
}

function teamForId(g: NhlGameDetail, teamId: string | null): NhlScoreSide | null {
  if (!teamId) return null;
  if (String(g.away.teamId) === teamId) return g.away;
  if (String(g.home.teamId) === teamId) return g.home;
  return null;
}

function RecentPlays({ g }: { g: NhlGameDetail }) {
  const [latest, ...rest] = g.recentPlays;
  if (!latest) return null;
  const latestTeam = teamForId(g, latest.teamId);
  const score = (p: NhlRecentPlay) =>
    p.awayScore != null && p.homeScore != null ? `${p.awayScore}-${p.homeScore}` : "";
  return (
    <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
          {g.live ? "Latest" : "Last plays"}
        </h3>
        {g.live ? (
          <span className="text-alert inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em]">
            <span className="bg-alert h-1.5 w-1.5 animate-pulse rounded-full" /> Live
          </span>
        ) : null}
      </div>
      <div
        className={cn(
          "flex gap-3 px-4 py-3.5",
          latest.scoringPlay && "bg-gradient-to-r from-accent/15 to-transparent",
        )}
      >
        {latest.athlete ? (
          <img
            src={latest.athlete.headshot ?? nhlHeadshot(latest.athlete.id)}
            alt=""
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
            className="h-12 w-12 shrink-0 rounded-full bg-[#dfe6f2] object-cover object-top"
          />
        ) : latestTeam?.logo ? (
          <img src={latestTeam.logo} alt="" className="h-12 w-12 shrink-0 object-contain" />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] text-[#a8b0c2]">
            {latestTeam?.logo ? <img src={latestTeam.logo} alt="" className="h-4 w-4 object-contain" /> : null}
            <span className="tabular-nums">
              {latest.clock ?? ""}
              {latest.period ? ` - ${latest.period}` : ""}
            </span>
            {latest.scoringPlay ? (
              <span className="text-accent text-[10px] font-semibold uppercase tracking-[0.12em]">Goal</span>
            ) : null}
          </p>
          <p className="text-cream mt-1 text-[14px] leading-snug">{latest.text}</p>
        </div>
        <p className="numeral text-cream shrink-0 text-[13px]">{score(latest)}</p>
      </div>
      {rest.length > 0 ? (
        <ul className="divide-y divide-white/[0.05] border-t border-white/[0.06]">
          {rest.slice(0, 6).map((p) => {
            const team = teamForId(g, p.teamId);
            return (
              <li
                key={p.id}
                className={cn(
                  "grid grid-cols-[3rem_1.25rem_minmax(0,1fr)_auto] items-center gap-2 px-4 py-2.5 text-[12.5px]",
                  p.scoringPlay && "bg-gradient-to-r from-accent/15 to-transparent",
                )}
              >
                <span className="numeral text-chalk">{p.clock ?? ""}</span>
                {team?.logo ? <img src={team.logo} alt="" className="h-5 w-5 object-contain" /> : <span />}
                <span className={cn("leading-snug", p.scoringPlay ? "text-cream font-semibold" : "text-[#c8cdd8]")}>
                  {p.text}
                </span>
                <span className="numeral text-chalk-dim text-[12px]">{score(p)}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

function formatClipDuration(sec: number | null): string | null {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return null;
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

function isGoalClip(clip: NhlGameVideo): clip is NhlGoalClip {
  return clip.source === "nhl" && "periodNumber" in clip;
}

const WRAP_EYEBROW: Record<NhlWrapKind, string> = {
  "espn-final": "Game highlights",
  "nhl-recap": "NHL recap",
  "nhl-condensed": "Condensed game",
};

function clipEyebrow(clip: NhlGameVideo): string {
  if (clip.wrap) return WRAP_EYEBROW[clip.wrap];
  if (!isGoalClip(clip)) return "ESPN video";
  return ["NHL goal", clip.teamAbbrev, `${clip.periodLabel} ${clip.timeInPeriod}`.trim(), clip.tag]
    .filter(Boolean)
    .join(" · ");
}

function playlistEyebrow(clip: NhlGameVideo): string {
  if (clip.wrap) return WRAP_EYEBROW[clip.wrap];
  if (!isGoalClip(clip)) return "ESPN video";
  return [`${clip.teamAbbrev} goal`, `${clip.periodLabel} ${clip.timeInPeriod}`.trim(), clip.tag]
    .filter(Boolean)
    .join(" · ");
}

function GoalieChip({
  side,
  starter,
  align = "left",
}: {
  side: string;
  starter: { id: string; name: string } | null;
  align?: "left" | "right";
}) {
  if (!starter) {
    return (
      <p className={cn("text-chalk-dim text-[11px]", align === "right" && "text-right")}>
        {side} G · TBD
      </p>
    );
  }
  return (
    <Link
      to={`/sports/nhl/player/${starter.id}`}
      className={cn(
        "flex items-center gap-2",
        align === "right" && "flex-row-reverse text-right",
      )}
    >
      <img
        src={nhlHeadshot(starter.id)}
        alt=""
        className="h-8 w-8 rounded-full bg-[#dfe6f2] object-cover object-top"
      />
      <span className="min-w-0">
        <span className="text-chalk-dim block text-[10px] uppercase tracking-[0.12em]">
          {side} G
        </span>
        <span className="text-cream truncate text-[12px] font-semibold">{starter.name}</span>
      </span>
    </Link>
  );
}
