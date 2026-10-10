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
  // Keep the halo on the mark. A 5× spread washes the abbreviation underneath
  // and makes white type look team-colored.
  const pad = Math.round(Math.min(Math.max(spread, 1), 2.6) * 6);
  return (
    <span
      className={cn("relative isolate inline-grid shrink-0 place-items-center overflow-hidden", className)}
      style={{ padding: `${pad}px ${pad + 4}px` }}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 transition-opacity",
          dim ? "opacity-40" : "opacity-100",
        )}
        style={{ background: logoGlowBackground(hex, strength) }}
      />
      <span className="relative z-10">{children}</span>
    </span>
  );
}
