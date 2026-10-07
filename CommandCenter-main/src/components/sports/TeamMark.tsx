import { useState } from "react";
import { mlbTeamLogo } from "@/lib/mlb";
import { mlbTeamLogoFor } from "@/lib/mlb-logos";
import { cn } from "@/lib/utils";

/**
 * MLB team mark straight on the surface — no white disc / plate.
 * Dark surfaces (default) use mlbstatic's `team-primary-on-dark` variant so
 * navy marks keep a light outline, falling back to the on-light mark if the
 * dark variant fails. Pass `surface="light"` on light (paper) UI.
 */
export default function TeamMark({
  teamId,
  size = "md",
  className,
  imgClassName,
  surface = "dark",
}: {
  teamId: number | string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  imgClassName?: string;
  surface?: "dark" | "light";
}) {
  const primary = mlbTeamLogoFor(teamId, surface);
  const [failed, setFailed] = useState<string | null>(null);
  const src = failed === primary ? mlbTeamLogo(teamId) : primary;

  const dim =
    size === "xs"
      ? "h-5 w-5"
      : size === "sm"
        ? "h-7 w-7"
        : size === "md"
          ? "h-9 w-9"
          : size === "lg"
            ? "h-14 w-14 sm:h-16 sm:w-16"
            : "h-16 w-16 sm:h-20 sm:w-20";

  return (
    <span className={cn("inline-grid shrink-0 place-items-center", dim, className)}>
      <img
        src={src}
        alt=""
        className={cn(
          "h-full w-full object-contain",
          surface === "dark" && "drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]",
          imgClassName,
        )}
        loading="lazy"
        onError={() => {
          if (src === primary && surface === "dark") setFailed(primary);
        }}
      />
    </span>
  );
}
