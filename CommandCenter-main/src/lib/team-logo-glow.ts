/**
 * Shared team color for logo glows and football end zones.
 * Only ESPN `color` and `alternateColor` — never a generated tint.
 * The primary is the logo's dominant color unless a caller passes a different one.
 * A real color that separates from the mark wins; otherwise the better of the
 * two real colors is used. White and cream plates are not chosen over a real
 * non-plate color. No discs or plates.
 */

export const GLOW_MIN_LIGHTNESS = 0.4;
export const GLOW_LIFT_LIGHTNESS = 0.58;
const FALLBACK = "d9515c";
const CARD_BG = "07101d";

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

function channelLum(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function luminance(rgb: Rgb): number {
  return 0.2126 * channelLum(rgb[0]) + 0.7152 * channelLum(rgb[1]) + 0.0722 * channelLum(rgb[2]);
}

/** WCAG contrast ratio. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

/** Near-white fills read as a plate. Saturated gold, including a light alternate, does not. */
export function isPlateColor(rgb: Rgb | null): boolean {
  if (!rgb) return true;
  const [, s, l] = rgbToHsl(rgb);
  if (l >= 0.84) return true;
  return l >= 0.78 && s < 0.22;
}

function hueDelta(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function closeToLogo(color: Rgb, logo: Rgb): boolean {
  const [ch, cs, cl] = rgbToHsl(color);
  const [lh, ls, ll] = rgbToHsl(logo);
  if (contrastRatio(color, logo) < 1.7) return true;
  return cs > 0.15 && ls > 0.15 && hueDelta(ch, lh) < 18 && Math.abs(cl - ll) < 0.18;
}

/** A real ESPN color that separates from the mark and is not a white/cream plate. */
function contrastsWell(color: Rgb, logo: Rgb): boolean {
  if (isPlateColor(color)) return false;
  if (closeToLogo(color, logo)) return false;
  const card = parseHex(CARD_BG)!;
  return contrastRatio(color, card) >= 1.25;
}

/** Higher is a better real color when neither one contrasts cleanly. */
function realColorScore(color: Rgb, logo: Rgb): number {
  const card = parseHex(CARD_BG)!;
  let score = contrastRatio(color, logo) + Math.min(contrastRatio(color, card), 6);
  if (isPlateColor(color)) score -= 30;
  if (closeToLogo(color, logo)) score -= 5;
  return score;
}

/**
 * Glow / end-zone hex (no #). Only the ESPN primary or alternate.
 * `logoHex` defaults to the primary.
 */
export function teamGlowColor(
  primaryHex: string | null | undefined,
  alternateHex?: string | null,
  logoHex?: string | null,
): string {
  const primary = parseHex(primaryHex);
  const alternate = parseHex(alternateHex);
  const logo = parseHex(logoHex) ?? primary;
  if (primary && logo && contrastsWell(primary, logo)) return toHex(primary);
  if (alternate && logo && contrastsWell(alternate, logo)) return toHex(alternate);
  const options = [primary, alternate].filter((c): c is Rgb => c != null);
  if (!logo || options.length === 0) {
    if (primary && !isPlateColor(primary)) return toHex(primary);
    if (alternate && !isPlateColor(alternate)) return toHex(alternate);
    if (primary) return toHex(primary);
    if (alternate) return toHex(alternate);
    return FALLBACK;
  }
  options.sort((a, b) => realColorScore(b, logo) - realColorScore(a, logo));
  return toHex(options[0]!);
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
  return `radial-gradient(circle closest-side, rgba(${c},${a(0.22)}) 0%, rgba(${c},${a(0.82)}) 28%, rgba(${c},${a(0.5)}) 48%, rgba(${c},${a(0.2)}) 70%, rgba(${c},${a(0.05)}) 86%, rgba(${c},0) 100%)`;
}
