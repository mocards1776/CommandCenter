/**
 * Team-mark overrides for the evening preview. Lightning has no ESPN/NHL CDN
 * file that already includes a white rim (500 is navy-only, 500-dark is a
 * white bolt). The vendored PNG is official TBL bolt geometry with the rim
 * baked into the pixels — the card does not apply a stroke filter.
 */
import type { PreviewGame, PreviewSide, PreviewSport } from "./preview-slate.ts";

export const LIGHTNING_LOGO_SOURCE =
  "vendored official NHL TBL bolt (assets.nhle.com TBL_light geometry) with a baked white rim — supabase/functions/sports-finals/logos/nhl-tb.png";

export function isLightningSide(sport: PreviewSport, side: Pick<PreviewSide, "teamId" | "abbrev">): boolean {
  const id = String(side.teamId).toLowerCase();
  const abbr = String(side.abbrev || "").toLowerCase();
  return sport === "nhl" && (id === "20" || id === "tb" || abbr === "tb");
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x4000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x4000));
  }
  return btoa(bin);
}

export async function lightningLogoDataUri(): Promise<string | null> {
  const href = new URL("./logos/nhl-tb.png", import.meta.url);
  try {
    const { readFile } = await import("node:fs/promises");
    const bytes = new Uint8Array(await readFile(href));
    if (bytes.length < 32) return null;
    return `data:image/png;base64,${bytesToBase64(bytes)}`;
  } catch {
    try {
      // Deno edge
      const bytes = await Deno.readFile(href);
      return `data:image/png;base64,${bytesToBase64(bytes)}`;
    } catch {
      return null;
    }
  }
}

export async function applyLightningLogos(games: PreviewGame[]): Promise<void> {
  if (!games.some((g) => isLightningSide(g.sport, g.away) || isLightningSide(g.sport, g.home))) return;
  const data = await lightningLogoDataUri();
  if (!data) return;
  for (const game of games) {
    if (isLightningSide(game.sport, game.away)) game.away.logoData = data;
    if (isLightningSide(game.sport, game.home)) game.home.logoData = data;
  }
}
