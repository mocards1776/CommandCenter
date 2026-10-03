import PossessionFootball from "@/components/sports/PossessionFootball";
import { appleClockLine, timeoutMarks } from "@/lib/apple-score";
import { cn } from "@/lib/utils";

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
 * The game header uses the condensed face. RUWT cards use the same
 * sans as the rest of the card (`face="sans"`). A football mark is
 * optional and belongs on the game header clock, not on a RUWT card.
 * Timeout dashes are remaining ESPN counts, drawn small and dim for
 * the game page. RUWT cards omit the counts.
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

  const clock = appleClockLine(detail) || (final ? "Final" : "Live");
  const showBall = Boolean(football && live && /\d:\d/.test(clock));
  const showMarks = live && (awayTimeouts != null || homeTimeouts != null);
  const numeral = sans
    ? "numeral text-[28px] font-semibold leading-none"
    : cn("score-tight", size === "header" ? "text-[58px] sm:text-[76px]" : "text-[46px]");

  return (
    <div className="flex items-start justify-center gap-1 sm:gap-2">
      <div className="flex min-w-[2rem] flex-col items-center">
        <span className={cn("text-white", numeral)}>{away ?? "–"}</span>
        {showMarks ? <TimeoutDashes count={awayTimeouts} /> : null}
      </div>
      <p
        className={cn(
          "flex max-w-[6.75rem] items-center justify-center gap-1 self-center text-center font-semibold leading-tight tracking-tight text-white",
          size === "header" ? "px-1 pt-2 text-[15px] sm:pt-3 sm:text-[17px]" : "px-0.5 pt-1 text-[12px]",
        )}
      >
        {showBall ? <PossessionFootball className="h-3.5 w-5 shrink-0" title="Football" /> : null}
        <span>{clock}</span>
      </p>
      <div className="flex min-w-[2rem] flex-col items-center">
        <span className={cn("text-white", numeral)}>{home ?? "–"}</span>
        {showMarks ? <TimeoutDashes count={homeTimeouts} /> : null}
      </div>
    </div>
  );
}
