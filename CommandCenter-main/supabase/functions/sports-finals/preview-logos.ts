/**
 * Team-mark overrides for the evening preview. Lightning and Capitals have no
 * ESPN/NHL CDN file that already includes a white rim (500 is navy-only,
 * 500-dark is a white silhouette). Vendored PNGs are official geometry with
 * the rim baked into the pixels — the card does not apply a stroke filter.
 */
import {
  applyNhlDarkRimLogos,
  isNhlDarkRimSide,
  nhlDarkRimDataUri,
  nhlDarkRimFile,
} from "../_shared/nhl-dark-logos.ts";
import type { PreviewGame, PreviewSide, PreviewSport } from "./preview-slate.ts";

export const LIGHTNING_LOGO_SOURCE =
  "vendored official NHL TBL bolt (assets.nhle.com TBL_light geometry) with a baked white rim — supabase/functions/sports-finals/logos/nhl-tb.png";

export const CAPITALS_LOGO_SOURCE =
  "vendored official NHL Capitals Weagle (secondary_logo_on_black_color) with a baked white rim — supabase/functions/sports-finals/logos/nhl-wsh.png";

export function isLightningSide(sport: PreviewSport, side: Pick<PreviewSide, "teamId" | "abbrev">): boolean {
  return nhlDarkRimFile({ sport, abbrev: side.abbrev, teamId: side.teamId }) === "nhl-tb.png";
}

export function isCapitalsSide(sport: PreviewSport, side: Pick<PreviewSide, "teamId" | "abbrev">): boolean {
  return nhlDarkRimFile({ sport, abbrev: side.abbrev, teamId: side.teamId }) === "nhl-wsh.png";
}

export function isDarkRimSide(sport: PreviewSport, side: Pick<PreviewSide, "teamId" | "abbrev" | "logo">): boolean {
  return isNhlDarkRimSide(sport, side);
}

export async function lightningLogoDataUri(): Promise<string | null> {
  return nhlDarkRimDataUri("nhl-tb.png");
}

export async function capitalsLogoDataUri(): Promise<string | null> {
  return nhlDarkRimDataUri("nhl-wsh.png");
}

export async function applyLightningLogos(games: PreviewGame[]): Promise<void> {
  await applyNhlDarkRimLogos(games);
}

export { applyNhlDarkRimLogos };
