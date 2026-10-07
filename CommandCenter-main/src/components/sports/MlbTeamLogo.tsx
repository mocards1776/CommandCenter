import { useState } from "react";
import { mlbTeamLogo } from "@/lib/mlb";
import { mlbTeamLogoOnDark } from "@/lib/mlb-logos";
import { cn } from "@/lib/utils";

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
  const primary = mlbTeamLogoOnDark(teamId);
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <img
      src={failed === primary ? mlbTeamLogo(teamId) : primary}
      alt={alt}
      loading={loading}
      onError={() => setFailed(primary)}
      className={cn(
        "shrink-0 object-contain drop-shadow-[0_6px_18px_rgba(0,0,0,0.45)]",
        className,
      )}
    />
  );
}
