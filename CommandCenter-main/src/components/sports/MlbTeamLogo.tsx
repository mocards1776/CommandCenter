import { useState } from "react";
import { mlbTeamLogo } from "@/lib/mlb";
import { cn } from "@/lib/utils";

/** mlbstatic dark-background variant of the primary mark (light outlines on navy logos). */
function mlbTeamLogoOnDark(teamId: number | string): string {
  return `https://www.mlbstatic.com/team-logos/team-primary-on-dark/${teamId}.svg`;
}

/**
 * MLB team mark straight on a dark team-color surface — no disc / plate.
 * Uses mlbstatic's `team-primary-on-dark` variant so navy marks (NYY, DET,
 * MIN…) keep a light outline; falls back to the on-light mark if missing.
 */
export default function MlbTeamLogo({
  teamId,
  className,
  alt = "",
  loading,
}: {
  teamId: number | string;
  className?: string;
  alt?: string;
  loading?: "eager" | "lazy";
}) {
  const [fallback, setFallback] = useState(false);
  return (
    <img
      key={teamId}
      src={fallback ? mlbTeamLogo(teamId) : mlbTeamLogoOnDark(teamId)}
      alt={alt}
      loading={loading}
      onError={() => setFallback(true)}
      className={cn(
        "shrink-0 object-contain drop-shadow-[0_6px_18px_rgba(0,0,0,0.45)]",
        className,
      )}
    />
  );
}
