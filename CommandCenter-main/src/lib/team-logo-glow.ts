/**
 * Shared team-color glow behind logos on scoreboard cards and game headers.
 * ESPN `color` / `alternateColor` when the feed has them; dark primaries take
 * a readable secondary or a same-hue lift so the glow still shows on navy.
 * No disc, plate, or cream fill — the CSS is a radial gradient that fades out.
 */

export const GLOW_MIN_LIGHTNESS = 0.4;
export const GLOW_LIFT_LIGHTNESS = 0.47;
const ALT_MIN_LIGHTNESS = 0.32;
const ALT_MAX_LIGHTNESS = 0.72;
const ALT_MIN_SATURATION = 0.28;
const FALLBACK = "d9515c";

type Rgb = [number, number, number];

export function parseHex(hex: string | null | undefined): Rgb | null {
  const raw = (hex ?? "").trim().replace(/^#/, "");
  const full = raw.length === 3 ? raw.replace(/./g, (c) => c + c) : raw;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex([r, g, b]: Rgb): string {
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

function usableAlternate(rgb: Rgb | null): rgb is Rgb {
  if (!rgb) return false;
  const [, s, l] = rgbToHsl(rgb);
  return l >= ALT_MIN_LIGHTNESS && l <= ALT_MAX_LIGHTNESS && s >= ALT_MIN_SATURATION;
}

/**
 * Glow hex (no #). Bright primaries pass through. A dark primary uses ESPN's
 * alternate when that secondary is a real team color (not white or cream).
 * Otherwise the primary is lifted in lightness. Near-black with no hue stays
 * a neutral gray so it does not pick up a fake red cast.
 */
export function teamGlowColor(
  primaryHex: string | null | undefined,
  alternateHex?: string | null,
): string {
  const primary = parseHex(primaryHex);
  const alternate = parseHex(alternateHex);
  if (primary) {
    const [h, s, l] = rgbToHsl(primary);
    if (l >= GLOW_MIN_LIGHTNESS && l <= 0.86) return toHex(primary);
    if (usableAlternate(alternate)) return toHex(alternate);
    if (l > 0.86) return toHex(hslToRgb(h, Math.min(s, 0.35), 0.62));
    if (s < 0.12) return toHex(hslToRgb(0, 0, GLOW_LIFT_LIGHTNESS));
    return toHex(hslToRgb(h, Math.max(s, 0.55), GLOW_LIFT_LIGHTNESS));
  }
  if (usableAlternate(alternate)) return toHex(alternate);
  return FALLBACK;
}

/** ESPN team `color` / `alternateColor`, hashes stripped. Invalid values drop out. */
export function readEspnTeamColors(
  color: string | null | undefined,
  alternate: string | null | undefined,
  fallback: string,
): { color: string; alternateColor: string | null } {
  const norm = (value: string | null | undefined) => {
    const raw = (value ?? "").replace(/^#/, "").trim();
    const rgb = parseHex(raw);
    if (!rgb) return null;
    return raw.length === 3 ? toHex(rgb) : raw.toLowerCase();
  };
  return {
    color: norm(color) ?? fallback,
    alternateColor: norm(alternate),
  };
}

/**
 * Concentrated radial glow (CSS background) centered on the logo.
 * Strong at the mark, fading to transparent — light, not a disc.
 */
export function logoGlowBackground(hex: string, strength = 1): string {
  const rgb = parseHex(hex) ?? parseHex(FALLBACK)!;
  const k = Math.min(Math.max(strength, 0), 1.2);
  const a = (n: number) => Math.round(Math.min(n * k, 1) * 100) / 100;
  const c = rgb.join(",");
  return `radial-gradient(circle closest-side, rgba(${c},${a(0.66)}) 0%, rgba(${c},${a(0.5)}) 18%, rgba(${c},${a(0.3)}) 40%, rgba(${c},${a(0.13)}) 64%, rgba(${c},${a(0.04)}) 84%, rgba(${c},0) 100%)`;
}
