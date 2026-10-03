import { useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Play } from "lucide-react";
import { SelectableHighlightRegion } from "@/components/rss/SelectableHighlightRegion";
import EspnVideoEmbed from "@/components/sports/EspnVideoEmbed";
import HighlightReel, { type ReelHighlight } from "@/components/sports/HighlightReel";
import NhlIceRink from "@/components/sports/NhlIceRink";
import { useSportsBack, useSwipeBack } from "@/hooks/useSwipeBack";
import {
  dedupeNhlEspnVideos,
  fetchNhlGameDetail,
  fetchNhlGamecenter,
  liftTeamColor,
  nhlClockKey,
  nhlHeadshot,
  type NhlGameDetail,
  type NhlGameVideo,
  type NhlGoalClip,
  type NhlRecentPlay,
  type NhlScoreSide,
} from "@/lib/nhl";
import { cn } from "@/lib/utils";

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
    refetchInterval: g?.live ? 30_000 : false,
    staleTime: 20_000,
    retry: 1,
  });
  const situation = g?.live ? (gamecenter.data?.situation ?? null) : null;

  const [featuredId, setFeaturedId] = useState<string | null>(null);
  const highlightsRef = useRef<HTMLElement>(null);

  const { clips, goalByClock } = useMemo(() => {
    const goals = gamecenter.data?.goals ?? [];
    const espn = dedupeNhlEspnVideos((g?.videos ?? []).filter((v) => v.mp4), goals);
    const byClock = new Map<string, NhlGoalClip>();
    for (const goal of goals) {
      const key = nhlClockKey(goal.periodNumber, goal.timeInPeriod);
      if (key) byClock.set(key, goal);
    }
    const all: NhlGameVideo[] = [...goals].reverse();
    return { clips: all.concat(espn), goalByClock: byClock };
  }, [gamecenter.data, g?.videos]);

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

  return (
    <div ref={swipeRef} className="mx-auto max-w-6xl space-y-5 p-4 md:p-7">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={goBack}
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
                    {statusLabel(g)}
                  </span>
                ) : (
                  statusLabel(g)
                )}
              </p>
              <p className="text-[11px] text-[#8b93a7]">{g.venueDetail ?? g.venue ?? "NHL"}</p>
            </div>

            <div className="relative z-10 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 px-2 py-4 sm:gap-4 sm:px-5 sm:py-6">
              <TeamBlock side={g.away} align="left" />
              <div className="flex items-center gap-2 sm:gap-5">
                {started ? (
                  <ScoreFigure
                    score={g.away.score}
                    pp={situation?.powerPlayAbbrev === g.away.abbrev}
                    side="away"
                  />
                ) : null}
                <div className="min-w-[5.5rem] text-center sm:min-w-[8rem]">
                  {started ? (
                    <p
                      className={cn(
                        "text-[13px] font-semibold tabular-nums sm:text-[15px]",
                        g.live ? "text-cream" : "text-chalk",
                      )}
                    >
                      {statusLabel(g)}
                    </p>
                  ) : (
                    <>
                      <p className="font-display text-cream text-[22px] leading-none sm:text-[28px]">
                        {g.whenShort ?? "vs"}
                      </p>
                      <p className="text-chalk-dim mt-1.5 text-[11px]">{g.when}</p>
                    </>
                  )}
                  {situation?.powerPlayAbbrev && situation.timeRemaining ? (
                    <p className="text-accent mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] tabular-nums">
                      {situation.powerPlayAbbrev} PP · {situation.timeRemaining.replace(/^0/, "")}
                    </p>
                  ) : null}
                  {g.oddsLine && !g.final ? (
                    <p className="text-chalk mt-1.5 text-[10px] font-medium tracking-wide">{g.oddsLine}</p>
                  ) : null}
                </div>
                {started ? (
                  <ScoreFigure
                    score={g.home.score}
                    pp={situation?.powerPlayAbbrev === g.home.abbrev}
                    side="home"
                  />
                ) : null}
              </div>
              <TeamBlock side={g.home} align="right" />
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

          {g.ice ? (
            <NhlIceRink
              ice={g.ice}
              away={g.away}
              home={g.home}
              live={g.live}
              final={g.final}
              statusText={statusLabel(g)}
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

          {g.article?.storyHtml || g.article?.description ? (
            <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08] font-rss">
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
          ) : null}

          {g.lastFive.length > 0 ? (
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
          ) : null}

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
                {g.scoringPlays.map((p) => {
                  const clip = goalByClock.get(nhlClockKey(p.periodNumber, p.clock) ?? "");
                  return (
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
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <p className="numeral text-cream text-[13px]">
                        {p.awayScore ?? 0}–{p.homeScore ?? 0}
                      </p>
                      {clip ? (
                        <button
                          type="button"
                          onClick={() => watchGoal(clip.id)}
                          className="text-accent hover:text-cream inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                        >
                          <Play size={11} className="fill-current" /> Watch
                        </button>
                      ) : null}
                    </div>
                  </li>
                  );
                })}
              </ul>
            </section>
          )}

          {g.teamStats.length > 0 && <TeamStats g={g} />}

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
      className={cn(
        "flex min-w-0 flex-col items-center gap-1 text-center sm:gap-3",
        align === "left" ? "sm:flex-row sm:text-left" : "sm:flex-row-reverse sm:text-right",
      )}
    >
      {side.logo ? (
        <img
          src={side.logo}
          alt=""
          className="h-14 w-14 shrink-0 object-contain drop-shadow-[0_4px_14px_rgba(0,0,0,0.45)] sm:h-20 sm:w-20"
        />
      ) : null}
      <div className="min-w-0">
        <p className="text-cream text-[15px] font-semibold leading-tight sm:text-[22px]">{side.abbrev}</p>
        <p className="text-chalk-dim hidden truncate text-[12px] sm:block">{side.name}</p>
        {side.record ? <p className="text-chalk-dim numeral text-[11px]">{side.record}</p> : null}
      </div>
    </Link>
  );
}

const LOWER_IS_BETTER = new Set(["Giveaways", "PIM"]);

function TeamStats({ g }: { g: NhlGameDetail }) {
  const head = (side: NhlScoreSide, align: "left" | "right") => (
    <Link
      to={`/sports/nhl/team/${side.teamId}`}
      className={cn("flex min-w-0 items-center gap-2", align === "right" && "flex-row-reverse text-right")}
    >
      {side.logo ? <img src={side.logo} alt="" className="h-9 w-9 shrink-0 object-contain" /> : null}
      <span className="min-w-0">
        <span className="text-cream block text-[13px] font-semibold leading-tight">{side.abbrev}</span>
        {side.record ? (
          <span className="numeral text-chalk-dim block text-[10.5px] leading-tight">{side.record}</span>
        ) : null}
      </span>
    </Link>
  );
  return (
    <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
      <div className="border-b border-white/[0.06] px-4 py-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">Team stats</h3>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        {head(g.away, "left")}
        <span className="text-[10px] uppercase tracking-[0.14em] text-[#8b93a7]">vs</span>
        {head(g.home, "right")}
      </div>
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

function ScoreFigure({
  score,
  pp,
  side,
}: {
  score: number | null;
  pp: boolean;
  side: "away" | "home";
}) {
  return (
    <div className={cn("flex items-center gap-1.5", side === "away" ? "flex-row-reverse" : "")}>
      {pp ? (
        <span className="bg-accent/20 text-accent rounded-sm px-1 py-0.5 text-[9px] font-bold tracking-[0.08em]">
          PP
        </span>
      ) : null}
      <span className="font-display text-cream text-[40px] leading-none tabular-nums sm:text-[52px]">
        {score ?? 0}
      </span>
    </div>
  );
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
  return clip.source === "nhl";
}

function clipEyebrow(clip: NhlGameVideo): string {
  if (!isGoalClip(clip)) return "ESPN video";
  return ["NHL goal", clip.teamAbbrev, `${clip.periodLabel} ${clip.timeInPeriod}`.trim(), clip.tag]
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
