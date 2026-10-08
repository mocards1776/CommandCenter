import type { ReactNode } from "react";
import { logoGlowBackground, mlbGlowColor } from "@/lib/mlb-team-glow";
import { cn } from "@/lib/utils";

/**
 * Wraps an MLB logo with a concentrated radial team-color glow centered
 * behind it (NHL-header look). No disc or plate — the glow is a soft gradient.
 * `spread` is the glow diameter as a multiple of the logo box.
 */
export default function MlbLogoGlow({
  teamId,
  primaryColor,
  spread = 4,
  strength = 1,
  dim = false,
  className,
  children,
}: {
  teamId: number | null | undefined;
  primaryColor: string | null | undefined;
  spread?: number;
  strength?: number;
  dim?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const color = mlbGlowColor(teamId, primaryColor);
  const pct = `${Math.round(spread * 100)}%`;
  return (
    <span className={cn("relative isolate inline-grid shrink-0 place-items-center", className)}>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity",
          dim ? "opacity-40" : "opacity-100",
        )}
        style={{ width: pct, height: pct, background: logoGlowBackground(color, strength) }}
      />
      {children}
    </span>
  );
}
