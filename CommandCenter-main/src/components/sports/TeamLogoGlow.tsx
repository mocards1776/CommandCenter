import type { ReactNode } from "react";
import { logoGlowBackground, teamGlowColor } from "@/lib/team-logo-glow";
import { cn } from "@/lib/utils";

/**
 * Soft radial team-color glow centered behind a logo.
 * No disc or plate. `spread` is the glow diameter as a multiple of the logo box.
 * Pass `color` when the hex is already resolved (MLB club overrides).
 */
export default function TeamLogoGlow({
  color,
  primaryColor,
  alternateColor,
  spread = 4,
  strength = 1,
  dim = false,
  className,
  children,
}: {
  color?: string | null;
  primaryColor?: string | null;
  alternateColor?: string | null;
  spread?: number;
  strength?: number;
  dim?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const hex = color ?? teamGlowColor(primaryColor, alternateColor);
  const pct = `${Math.round(spread * 100)}%`;
  return (
    <span className={cn("relative isolate inline-grid shrink-0 place-items-center", className)}>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity",
          dim ? "opacity-40" : "opacity-100",
        )}
        style={{ width: pct, height: pct, background: logoGlowBackground(hex, strength) }}
      />
      {children}
    </span>
  );
}
