import type { ReactNode } from "react";
import TeamLogoGlow from "@/components/sports/TeamLogoGlow";
import { mlbGlowColor } from "@/lib/mlb-team-glow";

/**
 * MLB logo glow. Club overrides (navy teams → orange/gold) stay here;
 * the radial itself is the shared team glow.
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
  return (
    <TeamLogoGlow
      color={mlbGlowColor(teamId, primaryColor)}
      spread={spread}
      strength={strength}
      dim={dim}
      className={className}
    >
      {children}
    </TeamLogoGlow>
  );
}
