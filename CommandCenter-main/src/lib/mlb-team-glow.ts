/**
 * MLB logo glow. Navy / black / brown clubs use a brighter secondary so the
 * glow reads on the navy cards; every other club goes through the shared
 * team-color glow (ESPN primary, lifted when it is too dark).
 */
import { teamGlowColor } from "./team-logo-glow.ts";

export {
  GLOW_LIFT_LIGHTNESS,
  GLOW_MIN_LIGHTNESS,
  hslToRgb,
  logoGlowBackground,
  parseHex,
  rgbToHsl,
  toHex,
} from "./team-logo-glow.ts";

/**
 * Brighter secondary for clubs whose primary is navy / black / brown and would
 * vanish as a glow on the app's navy cards (team id → hex, no #).
 */
export const MLB_GLOW_OVERRIDE: Record<number, string> = {
  116: "fa4616", // DET orange
  117: "eb6e1f", // HOU orange
  121: "ff5910", // NYM orange
  133: "efb21e", // ATH gold
  134: "fdb827", // PIT gold
  135: "ffc425", // SD gold
  142: "d31145", // MIN red
  145: "c4ced4", // CWS silver
  158: "ffc52f", // MIL gold
};

/**
 * Glow color (hex, no #) for a club: a brighter secondary for navy/black
 * primaries, otherwise the shared team glow.
 */
export function mlbGlowColor(teamId: number | null | undefined, primaryHex: string | null | undefined): string {
  const override = teamId != null ? MLB_GLOW_OVERRIDE[teamId] : undefined;
  if (override) return override;
  return teamGlowColor(primaryHex);
}
