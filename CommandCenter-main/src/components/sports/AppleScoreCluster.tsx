import MlbBaseDiamond from "@/components/sports/MlbBaseDiamond";
import PossessionFootball from "@/components/sports/PossessionFootball";
import { appleClockParts, isBreakStatus, timeoutMarks } from "@/lib/apple-score";
import { isEmptyBasesLabel, mlbInningLabel } from "@/lib/mlb-score-ui";
import { mlbHeroNest, type MlbHeroDiamond } from "@heat/mlb-hero.ts";
import { cn } from "@/lib/utils";

export type MlbScoreNest = MlbHeroDiamond & {
  homeWinPct?: number | null;
  awayAbbrev?: string | null;
  homeAbbrev?: string | null;
};

function TimeoutDashes({ count }: { count: number | null | undefined }) {
  const n = timeoutMarks(count);
  if (!n) return <span className="mt-1 block h-px" aria-hidden />;
  return (
    <span className="mt-1 flex items-center justify-center gap-[3px]" aria-label={`${n} timeouts left`}>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="block h-[2px] w-2 rounded-sm bg-white/55" />
      ))}
    </span>
  );
}

type HeaderNest = {
  inning: string | null;
  count: string | null;
  outs: string | null;
  runners: string | null;
  winChip: string | null;
  diamond: MlbScoreNest | null;
};

/**
 * Game-detail score line: "6 – 17". Each numeral sits in a two-digit box
 * aligned toward the dash, so the dash stays on the header's center line
 * whatever the digit counts are. A running clock (or MLB count and bases)
 * sits in one quiet line under the score instead of between the numerals.
 * Breaks and finals add nothing here — the header chip already says so.
 */
function HeaderScoreLine({
  away,
  home,
  awayDim,
  homeDim,
  live,
  clock,
  period,
  periodClock,
  awayTimeouts,
  homeTimeouts,
  nest,
}: {
  away: number | string | null;
  home: number | string | null;
  awayDim: boolean;
  homeDim: boolean;
  live: boolean;
  clock: string;
  period: string | null;
  periodClock: string | null;
  awayTimeouts?: number | null;
  homeTimeouts?: number | null;
  nest: HeaderNest | null;
}) {
  const numeral = "score-tight block min-w-[2ch] text-[56px] sm:text-[68px]";
  const showMarks = awayTimeouts !== undefined || homeTimeouts !== undefined;
  const liveWords = live && !nest && !period && !isBreakStatus(clock) && !/^live$/i.test(clock);
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center justify-center gap-3 sm:gap-[18px]" aria-label={`${away ?? "–"} to ${home ?? "–"}`}>
        <div className="flex flex-col items-end">
          <span className={cn(numeral, "text-right", awayDim ? "text-white/40" : "text-white")}>{away ?? "–"}</span>
          {showMarks ? <TimeoutDashes count={awayTimeouts} /> : null}
        </div>
        <span
          aria-hidden
          className={cn(
            "block h-[3px] w-3.5 shrink-0 rounded-full bg-white/40 sm:h-1 sm:w-[18px]",
            showMarks ? "translate-y-0" : "translate-y-[3px] sm:translate-y-1",
          )}
        />
        <div className="flex flex-col items-start">
          <span className={cn(numeral, "text-left", homeDim ? "text-white/40" : "text-white")}>{home ?? "–"}</span>
          {showMarks ? <TimeoutDashes count={homeTimeouts} /> : null}
        </div>
      </div>
      {nest ? (
        <div className="mt-3 flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2.5 rounded-full border border-white/[0.1] bg-black/30 py-1 pl-3 pr-2 text-white">
            {nest.inning ? (
              <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.12em] text-white/90">
                {nest.inning}
              </span>
            ) : null}
            {nest.count ? <span className="numeral text-[13px] font-semibold leading-none">{nest.count}</span> : null}
            {nest.outs ? (
              <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200/80">
                {nest.outs}
              </span>
            ) : null}
            {nest.diamond ? (
              <MlbBaseDiamond
                onFirst={nest.diamond.onFirst}
                onSecond={nest.diamond.onSecond}
                onThird={nest.diamond.onThird}
                size="sm"
                className="mx-0 scale-[0.8]"
              />
            ) : nest.runners && !isEmptyBasesLabel(nest.runners) ? (
              <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/55">{nest.runners}</span>
            ) : null}
          </div>
          {nest.winChip ? (
            <span className="text-[9px] font-semibold tracking-wide text-emerald-100/80 sm:text-[10px]">{nest.winChip}</span>
          ) : null}
        </div>
      ) : period && periodClock ? (
        <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-black/30 px-3 py-1 text-white">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-alert" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">{period}</span>
          <span className="numeral text-[13px] font-semibold leading-none">{periodClock}</span>
        </span>
      ) : liveWords ? (
        <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-black/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/85">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-alert" aria-hidden />
          {clock}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Score cluster. `size="header"` is the game-detail score line (see
 * HeaderScoreLine): "6 – 17" with the running clock, or the live MLB count
 * and bases, in one quiet line under it.
 * Cards keep the clock nested between the numerals on one line, in the same
 * sans as the rest of the card (`face="sans"`). A football mark is optional
 * and belongs beside that single-line clock.
 * Timeout dashes are remaining ESPN counts, drawn small and dim for the game
 * page. RUWT cards omit the counts.
 * MLB live uses the shared heat-alert nest (count, outs, runners) so the app
 * hero and Telegram photo stay aligned, with an inning line ("Top 3rd",
 * "Mid 3rd") on top of it.
 */
export default function AppleScoreCluster({
  away,
  home,
  detail,
  live,
  final,
  football = false,
  size = "card",
  face = "tight",
  awayTimeouts = null,
  homeTimeouts = null,
  preview,
  awayDim = false,
  homeDim = false,
  mlb = null,
}: {
  away: number | string | null;
  home: number | string | null;
  detail: string | null;
  live: boolean;
  final: boolean;
  football?: boolean;
  size?: "card" | "header";
  face?: "tight" | "sans";
  awayTimeouts?: number | null;
  homeTimeouts?: number | null;
  preview?: string | null;
  /** Fade the away numeral (losing side on a final). */
  awayDim?: boolean;
  homeDim?: boolean;
  /** Live MLB play-state (count, outs, runners) between the scores, under the inning line. */
  mlb?: MlbScoreNest | null;
}) {
  const sans = face === "sans";
  if (!live && !final) {
    return (
      <p
        className={cn(
          "text-center text-white",
          sans
            ? "numeral text-[20px] font-semibold"
            : cn("score-tight", size === "header" ? "text-[40px] sm:text-[52px]" : "text-[22px]"),
        )}
      >
        {preview || "TBD"}
      </p>
    );
  }

  const parts = appleClockParts(detail);
  const clock = parts.line || (final ? "Final" : "Live");
  const stacked = size === "header" && Boolean(parts.period && parts.clock);
  const mlbNest = mlb
    ? mlbHeroNest({
        live,
        final,
        detail,
        when: preview,
        diamond: mlb,
        homeWinPct: mlb.homeWinPct,
        awayAbbrev: mlb.awayAbbrev,
        homeAbbrev: mlb.homeAbbrev,
      })
    : null;
  const showMlbNest = Boolean(mlbNest && (mlbNest.liveCount || mlbNest.runners || (live && mlb)));
  // Inning above the outs/count stack on live MLB ("Top 3rd", "Mid 3rd").
  const mlbInning = showMlbNest && live && !final ? mlbInningLabel(detail) : null;
  // On a half-inning break the nest primary is the raw break copy
  // ("Middle 3rd") — the inning line already says it, so don't repeat it.
  const mlbPrimary =
    mlbNest && mlbInning && !mlbNest.liveCount && mlbInningLabel(mlbNest.primary) === mlbInning
      ? null
      : (mlbNest?.primary ?? null);
  const showBall = Boolean(football && live && /\d:\d/.test(clock) && !showMlbNest);
  const showMarks = live && (awayTimeouts != null || homeTimeouts != null);

  if (size === "header") {
    return (
      <HeaderScoreLine
        away={away}
        home={home}
        awayDim={awayDim}
        homeDim={homeDim}
        live={live}
        clock={clock}
        period={stacked ? parts.period : null}
        periodClock={stacked ? parts.clock : null}
        awayTimeouts={showMarks ? awayTimeouts : undefined}
        homeTimeouts={showMarks ? homeTimeouts : undefined}
        nest={
          showMlbNest && mlbNest
            ? {
                inning: mlbInning,
                count: mlbPrimary,
                outs: mlbNest.secondary,
                runners: mlbNest.runners,
                winChip: mlbNest.winChip,
                diamond: mlb,
              }
            : null
        }
      />
    );
  }

  const numeral = sans ? "numeral text-[28px] font-semibold leading-none" : "score-tight text-[46px]";

  return (
    <div className={cn("flex justify-center", showMlbNest ? "items-end gap-3 sm:gap-5" : "items-start gap-1 sm:gap-2")}>
      <div className="flex min-w-[2rem] flex-col items-center">
        <span className={cn(awayDim ? "text-white/40" : "text-white", numeral)}>{away ?? "–"}</span>
        {showMarks ? <TimeoutDashes count={awayTimeouts} /> : null}
      </div>
      {showMlbNest && mlbNest ? (
        <div className="mb-0.5 flex min-w-[3.4rem] shrink-0 translate-y-1 flex-col items-center text-center text-white">
          {mlbInning ? (
            <span className="mb-1 whitespace-nowrap text-[10px] font-semibold leading-none tracking-[0.02em] text-white/90">
              {mlbInning}
            </span>
          ) : null}
          {mlbNest.secondary ? (
            <span className="text-[8px] font-semibold uppercase leading-none tracking-[0.16em] text-emerald-200/80">
              {mlbNest.secondary}
            </span>
          ) : null}
          {mlbPrimary ? (
            <span
              className={cn(
                "numeral mt-0.5 font-semibold leading-none text-white",
                sans ? "text-[13px]" : "text-[12px]",
              )}
            >
              {mlbPrimary}
            </span>
          ) : null}
          {mlb ? (
            <MlbBaseDiamond
              onFirst={mlb.onFirst}
              onSecond={mlb.onSecond}
              onThird={mlb.onThird}
              size="sm"
              className="mt-1.5"
            />
          ) : mlbNest.runners && !isEmptyBasesLabel(mlbNest.runners) ? (
            <span className="mt-1 text-[8px] font-semibold uppercase leading-none tracking-[0.14em] text-white/55">
              {mlbNest.runners}
            </span>
          ) : null}
        </div>
      ) : (
        <p className="flex max-w-[6.75rem] items-center justify-center gap-1 self-center px-0.5 pt-1 text-center text-[12px] font-semibold leading-tight tracking-tight text-white">
          {showBall ? <PossessionFootball className="h-3.5 w-5 shrink-0" title="Football" /> : null}
          <span>{clock}</span>
        </p>
      )}
      <div className="flex min-w-[2rem] flex-col items-center">
        <span className={cn(homeDim ? "text-white/40" : "text-white", numeral)}>{home ?? "–"}</span>
        {showMarks ? <TimeoutDashes count={homeTimeouts} /> : null}
      </div>
    </div>
  );
}
