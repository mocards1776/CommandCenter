import PossessionFootball from "@/components/sports/PossessionFootball";
import { MlbPlaybug } from "@/components/sports/MlbLiveInstrument";
import { appleClockParts, isBreakStatus, timeoutMarks } from "@/lib/apple-score";
import { mlbHeroInstrument, type MlbHeroDiamond } from "@heat/mlb-hero.ts";
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

/**
 * Score cluster with the clock nested between the numerals.
 * The game header stacks the quarter above the clock. A period break
 * ("End of 1st", "Halftime") stays out of that band so it does not
 * read as a third numeral — the header chip carries it.
 * RUWT cards use the same sans as the rest of the card (`face="sans"`)
 * on one line. A football mark is optional and belongs beside a
 * single-line clock, not on a RUWT card.
 * Timeout dashes are remaining ESPN counts, drawn small and dim for
 * the game page. RUWT cards omit the counts.
 * MLB live puts a diamond + B/S/O lamps between the scores. The inning
 * stays in the status bar, never as a black plate in this nest.
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
  /** Live MLB play-state. Replaces the inning word between the scores. */
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
  const mlbHero = mlb
    ? mlbHeroInstrument({
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
  const showMlbPlay = Boolean(mlbHero?.livePlay);
  // Break copy already lives in the game-detail status chip. Keeping it
  // between the tall scores makes "End of 1st" read as another numeral.
  const breakInHeader = size === "header" && !stacked && !showMlbPlay && isBreakStatus(clock);
  const showBall = Boolean(
    football && live && /\d:\d/.test(clock) && !stacked && !breakInHeader && !showMlbPlay,
  );
  const showMarks = live && (awayTimeouts != null || homeTimeouts != null);
  const numeral = sans
    ? "numeral text-[28px] font-semibold leading-none"
    : cn("score-tight", size === "header" ? "text-[58px] sm:text-[76px]" : "text-[46px]");

  return (
    <div
      className={cn(
        "flex justify-center",
        breakInHeader
          ? "items-end gap-5 sm:gap-7"
          : showMlbPlay
            ? "items-center gap-2 sm:gap-3"
            : stacked
              ? "items-end gap-3 sm:gap-5"
              : "items-start gap-1 sm:gap-2",
      )}
    >
      <div className="flex min-w-[2rem] flex-col items-center">
        <span className={cn(awayDim ? "text-white/40" : "text-white", numeral)}>{away ?? "–"}</span>
        {showMarks ? <TimeoutDashes count={awayTimeouts} /> : null}
      </div>
      {breakInHeader ? null : showMlbPlay && mlbHero ? (
        <MlbPlaybug hero={mlbHero} size={size} />
      ) : stacked ? (
        <div className="mb-0.5 flex w-[3.15rem] shrink-0 translate-y-2 flex-col items-center pb-px text-center text-white sm:mb-1 sm:w-[3.5rem] sm:translate-y-3">
          <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/60 sm:text-[10px]">
            {parts.period}
          </span>
          <span className="numeral mt-1 text-[13px] font-semibold leading-none text-white/95 sm:text-[15px]">
            {parts.clock}
          </span>
        </div>
      ) : (
      <p
        className={cn(
          "flex max-w-[6.75rem] items-center justify-center gap-1 self-center text-center font-semibold leading-tight tracking-tight text-white",
          size === "header" ? "px-1 pt-2 text-[15px] sm:pt-3 sm:text-[17px]" : "px-0.5 pt-1 text-[12px]",
        )}
      >
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
