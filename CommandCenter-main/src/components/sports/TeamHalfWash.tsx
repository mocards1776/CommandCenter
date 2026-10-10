import { halfWashBackground } from "@/lib/team-logo-glow";
import { cn } from "@/lib/utils";

/**
 * The game-detail header wash: one wide team-color ellipse on each half.
 * Losing halves fade the same way the header does. No second glow behind the logo.
 */
export default function TeamHalfWash({
  awayHex,
  homeHex,
  awayDim = false,
  homeDim = false,
}: {
  awayHex?: string | null;
  homeHex?: string | null;
  awayDim?: boolean;
  homeDim?: boolean;
}) {
  if (!awayHex && !homeHex) return null;
  return (
    <>
      {awayHex ? (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 w-1/2",
            awayDim ? "opacity-40" : "opacity-90",
          )}
          style={{ background: halfWashBackground(awayHex, "left") }}
        />
      ) : null}
      {homeHex ? (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 w-1/2",
            homeDim ? "opacity-40" : "opacity-90",
          )}
          style={{ background: halfWashBackground(homeHex, "right") }}
        />
      ) : null}
    </>
  );
}
