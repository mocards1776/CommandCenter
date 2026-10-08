/**
 * Team-color glow behind MLB logos (RUWT card, game header), matching the
 * NHL game header's concentrated radial team-color glow.
 * Pure helpers, no React. Unit-tested with node --experimental-strip-types.
 */

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

/** Primaries darker than this HSL lightness get lifted (same hue). */
export const GLOW_MIN_LIGHTNESS = 0.4;
/** Lightness a too-dark primary is lifted to. */
export const GLOW_LIFT_LIGHTNESS = 0.47;

type Rgb = [number, number, number];

export function parseHex(hex: string | null | undefined): Rgb | null {
  const raw = (hex ?? "").trim().replace(/^#/, "");
  const full = raw.length === 3 ? raw.replace(/./g, (c) => c + c) : raw;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: Rgb): string {
  return [r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("");
}

export function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === R) h = (G - B) / d + (G < B ? 6 : 0);
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  return [h * 60, s, l];
}

export function hslToRgb(h: number, s: number, l: number): Rgb {
  const hh = (((h % 360) + 360) % 360) / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const ch = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [ch(hh + 1 / 3) * 255, ch(hh) * 255, ch(hh - 1 / 3) * 255];
}

/**
 * Glow color (hex, no #) for a club: a brighter secondary for navy/black
 * primaries, otherwise the primary, lifted in lightness (same hue) when it
 * is too dark to read as a glow on navy.
 */
export function mlbGlowColor(teamId: number | null | undefined, primaryHex: string | null | undefined): string {
  const override = teamId != null ? MLB_GLOW_OVERRIDE[teamId] : undefined;
  if (override) return override;
  const rgb = parseHex(primaryHex);
  if (!rgb) return "d9515c";
  const [h, s, l] = rgbToHsl(rgb);
  if (l >= GLOW_MIN_LIGHTNESS) return toHex(rgb);
  return toHex(hslToRgb(h, Math.max(s, 0.55), GLOW_LIFT_LIGHTNESS));
}

/**
 * Concentrated radial glow (CSS background) for an element centered on the
 * logo — strong at the mark, fading to transparent at the element's edge.
 */
export function logoGlowBackground(hex: string, strength = 1): string {
  const rgb = parseHex(hex) ?? [217, 81, 92];
  const k = Math.min(Math.max(strength, 0), 1.2);
  const a = (n: number) => Math.round(Math.min(n * k, 1) * 100) / 100;
  const c = rgb.join(",");
  // Eased falloff (no visible rim) so it reads as light, not a disc.
  return `radial-gradient(circle closest-side, rgba(${c},${a(0.66)}) 0%, rgba(${c},${a(0.5)}) 18%, rgba(${c},${a(0.3)}) 40%, rgba(${c},${a(0.13)}) 64%, rgba(${c},${a(0.04)}) 84%, rgba(${c},0) 100%)`;
}
