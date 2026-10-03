import PossessionFootball from "@/components/sports/PossessionFootball";
import { appleClockLine, timeoutMarks } from "@/lib/apple-score";
import { cn } from "@/lib/utils";

function TimeoutDashes({ count }: { count: number | null | undefined }) {
  const n = timeoutMarks(count);
  if (!n) return <span className="mt-1 block h-[3px]" aria-hidden />;
  return (
    <span className="mt-1 flex items-center justify-center gap-[5px]" aria-label={`${n} timeouts left`}>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="block h-[3px] w-2.5 rounded-sm bg-white" />
      ))}
    </span>
  );
}

/**
 * Apple Sports score cluster: condensed white numerals with the clock
 * nested between them. A football mark sits with the clock on live
 * football games. Timeout dashes are remaining ESPN counts, in white.
 */
export default function AppleScoreCluster({
  away,
  home,
  detail,
  live,
  final,
  football = false,
  size = "card",
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
  awayTimeouts?: number | null;
  homeTimeouts?: number | null;
  preview?: string | null;
}) {
  if (!live && !final) {
    return (
      <p
        className={cn(
          "score-tight text-center text-white",
          size === "header" ? "text-[40px] sm:text-[52px]" : "text-[22px]",
        )}
      >
        {preview || "TBD"}
      </p>
    );
  }

  const clock = appleClockLine(detail) || (final ? "Final" : "Live");
  const showBall = Boolean(football && live && /\d:\d/.test(clock));
  const showMarks = live && (awayTimeouts != null || homeTimeouts != null);
  const numeral = size === "header" ? "text-[58px] sm:text-[76px]" : "text-[46px]";

  return (
    <div className="flex items-start justify-center gap-1 sm:gap-2">
      <div className="flex min-w-[2rem] flex-col items-center">
        <span className={cn("score-tight text-white", numeral)}>{away ?? "–"}</span>
        {showMarks ? <TimeoutDashes count={awayTimeouts} /> : null}
      </div>
      <p
        className={cn(
          "flex max-w-[6.75rem] items-center justify-center gap-1 self-center text-center font-semibold leading-tight tracking-tight text-white",
          size === "header" ? "px-1 pt-2 text-[15px] sm:pt-3 sm:text-[17px]" : "px-0.5 pt-2 text-[12px]",
        )}
      >
        {showBall ? <PossessionFootball className="h-3.5 w-5 shrink-0" title="Football" /> : null}
        <span>{clock}</span>
      </p>
      <div className="flex min-w-[2rem] flex-col items-center">
        <span className={cn("score-tight text-white", numeral)}>{home ?? "–"}</span>
        {showMarks ? <TimeoutDashes count={homeTimeouts} /> : null}
      </div>
    </div>
  );
}
