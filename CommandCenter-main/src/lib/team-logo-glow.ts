/**
 * Shared team-color glow behind logos, and the same color for football end zones.
 * ESPN `color` is the logo's dominant color unless a caller passes a different one.
 * The glow has to separate from that mark and from the dark card. A dark or
 * too-similar primary yields to alternateColor, then a lighter tint of the team hue.
 * Cream, white, discs, and plates are never used.
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

/** Cream, white, and beige fills read as a plate. Saturated gold does not. */
export function isPlateColor(rgb: Rgb | null): boolean {
  if (!rgb) return true;
  const [h, s, l] = rgbToHsl(rgb);
  if (l >= 0.8) return true;
  if (l >= 0.68 && s < 0.72 && h >= 20 && h <= 65) return true;
  return l >= 0.72 && s < 0.35;
}

function hueDelta(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * True when `glow` separates from the logo and still reads on the dark card.
 * Same-hue marks need a wide lightness gap; a different hue can sit closer.
 */
function separates(glow: Rgb, logo: Rgb): boolean {
  if (isPlateColor(glow)) return false;
  const [gh, gs, gl] = rgbToHsl(glow);
  const [lh, ls, ll] = rgbToHsl(logo);
  if (gl < 0.42 || gl > 0.78) return false;
  const card = parseHex(CARD_BG)!;
  if (contrastRatio(glow, card) < 1.7) return false;
  // A white or black mark separates from any saturated team color on this card.
  if (ll > 0.86 || ll < 0.08) return gs >= 0.28;
  const sameHue = gs > 0.2 && ls > 0.2 && hueDelta(gh, lh) < 28;
  const gap = Math.abs(gl - ll);
  if (sameHue && gap < 0.28) return false;
  if (!sameHue && gap < 0.12 && hueDelta(gh, lh) < 18) return false;
  if (contrastRatio(glow, logo) < 2.2) return false;
  return true;
}

/**
 * Tint of `source` that clears the logo. Dark marks land on a lighter step.
 * An already-light mark can't go lighter without turning into a plate, so the
 * best same-hue step may be a bit deeper.
 */
function lighterTint(source: Rgb, logo: Rgb): Rgb {
  const [h, s] = rgbToHsl(source);
  const card = parseHex(CARD_BG)!;
  if (s < 0.12) return hslToRgb(0, 0, 0.58);
  const sat = Math.min(Math.max(s, 0.55), 0.85);
  let best = hslToRgb(h, sat, GLOW_LIFT_LIGHTNESS);
  let bestScore = -1;
  for (const light of [0.48, 0.54, 0.58, 0.64, 0.7]) {
    const rgb = hslToRgb(h, sat, light);
    if (isPlateColor(rgb)) continue;
    if (contrastRatio(rgb, card) < 1.7) continue;
    const score = contrastRatio(rgb, logo);
    if (score > bestScore) {
      best = rgb;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Glow / end-zone hex (no #).
 * `logoHex` is the mark's dominant color; it defaults to the ESPN primary.
 */
export function teamGlowColor(
  primaryHex: string | null | undefined,
  alternateHex?: string | null,
  logoHex?: string | null,
): string {
  const primary = parseHex(primaryHex);
  const alternate = parseHex(alternateHex);
  const logo = parseHex(logoHex) ?? primary;
  if (primary && logo && separates(primary, logo)) return toHex(primary);
  if (alternate && logo && separates(alternate, logo)) return toHex(alternate);
  const base = primary ?? alternate;
  if (base && logo) return toHex(lighterTint(base, logo));
  if (alternate && !isPlateColor(alternate)) return toHex(alternate);
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
  return `radial-gradient(circle closest-side, rgba(${c},${a(0.22)}) 0%, rgba(${c},${a(0.82)}) 28%, rgba(${c},${a(0.5)}) 48%, rgba(${c},${a(0.2)}) 70%, rgba(${c},${a(0.05)}) 86%, rgba(${c},0) 100%)`;
}
