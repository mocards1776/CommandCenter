import { mlbTeamLogo } from "@/lib/mlb";

/**
 * mlbstatic dark-background variant of the primary mark: navy marks (NYY,
 * DET, MIN, SD…) get a light outline so they read on dark UI without a disc.
 */
export function mlbTeamLogoOnDark(teamId: number | string): string {
  return `https://www.mlbstatic.com/team-logos/team-primary-on-dark/${teamId}.svg`;
}

/** Logo URL for the surface a mark sits on (dark = default app UI). */
export function mlbTeamLogoFor(teamId: number | string, surface: "dark" | "light" = "dark"): string {
  return surface === "light" ? mlbTeamLogo(teamId) : mlbTeamLogoOnDark(teamId);
}
