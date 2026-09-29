/**
 * Scanned interior pages (praise, copyright, title-page spreads) are mostly
 * paper-white with many thin lines of body text. Jackets are colorful, or if
 * they're minimal they use a handful of display lines — not a page of quotes.
 *
 * Tuned against the Proof praise page (reject) and a sample of real library
 * jackets, including a near-white cover that only has a few text lines (keep).
 */

export type RgbImage = {
  width: number;
  height: number;
  data: Uint8Array;
  channels: number;
};

export type DecodedRaster = {
  width: number;
  height: number;
  data: Uint8Array;
  channels: number;
  depth?: number;
  palette?: Array<number[] | undefined>;
};

/** Expand an indexed or grayscale PNG into 8-bit RGB. */
export function rasterToRgb(src: DecodedRaster): RgbImage | null {
  const { width, height } = src;
  if (width < 8 || height < 8) return null;
  const pixels = width * height;

  if (src.palette && src.palette.length > 0) {
    const depth = src.depth ?? 8;
    const out = new Uint8Array(pixels * 3);
    const bits = depth === 1 || depth === 2 || depth === 4 || depth === 8 ? depth : 0;
    if (!bits) return null;
    const mask = (1 << bits) - 1;
    const perByte = 8 / bits;
    for (let i = 0; i < pixels; i++) {
      let idx: number;
      if (bits === 8) {
        idx = src.data[i] ?? 0;
      } else {
        const byte = src.data[Math.floor(i / perByte)] ?? 0;
        const shift = (perByte - 1 - (i % perByte)) * bits;
        idx = (byte >> shift) & mask;
      }
      const p = src.palette[idx] ?? [255, 255, 255];
      out[i * 3] = p[0] ?? 255;
      out[i * 3 + 1] = p[1] ?? 255;
      out[i * 3 + 2] = p[2] ?? 255;
    }
    return { width, height, data: out, channels: 3 };
  }

  if ((src.depth ?? 8) !== 8) return null;

  if (src.channels >= 3) {
    return { width, height, data: src.data, channels: src.channels };
  }

  if (src.channels === 1) {
    const out = new Uint8Array(pixels * 3);
    for (let i = 0; i < pixels; i++) {
      const v = src.data[i] ?? 255;
      out[i * 3] = v;
      out[i * 3 + 1] = v;
      out[i * 3 + 2] = v;
    }
    return { width, height, data: out, channels: 3 };
  }

  return null;
}

/**
 * True when the bitmap is an interior text page rather than cover art.
 * `data` is row-major RGB or RGBA.
 */
export function isInteriorPage(
  width: number,
  height: number,
  data: Uint8Array,
  channels: number,
): boolean {
  if (width < 40 || height < 40 || channels < 3) return false;
  if (data.length < width * height * channels) return false;

  const step = Math.max(1, Math.floor(Math.min(width, height) / 180));
  let paper = 0;
  let color = 0;
  let total = 0;
  const rows: number[] = [];
  const xStart = Math.floor(width * 0.1);
  const xEnd = Math.max(xStart + 1, Math.floor(width * 0.9));

  for (let y = 0; y < height; y += step) {
    let n = 0;
    let ink = 0;
    for (let x = xStart; x < xEnd; x += step) {
      const i = (y * width + x) * channels;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const max = r > g ? (r > b ? r : b) : g > b ? g : b;
      const min = r < g ? (r < b ? r : b) : g < b ? g : b;
      const chroma = max - min;
      const lum = Math.floor((r * 299 + g * 587 + b * 114) / 1000);
      total++;
      n++;
      if (lum >= 210 && chroma <= 24) paper++;
      else if (chroma >= 32 && lum >= 25) color++;
      if (lum <= 120 && chroma <= 50) ink++;
    }
    rows.push(n ? ink / n : 0);
  }

  type Band = { a: number; b: number; peak: number };
  const bands: Band[] = [];
  for (let i = 0; i < rows.length; i++) {
    const f = rows[i] ?? 0;
    if (f >= 0.015 && f <= 0.65) {
      const prev = bands[bands.length - 1];
      if (prev && i - prev.b <= 1) {
        prev.b = i;
        if (f > prev.peak) prev.peak = f;
      } else {
        bands.push({ a: i, b: i, peak: f });
      }
    }
  }

  let body = 0;
  for (const band of bands) {
    const heightFrac = ((band.b - band.a + 1) * step) / height;
    if (heightFrac <= 0.055 && band.peak <= 0.55) body++;
  }
  const span = bands.length
    ? ((bands[bands.length - 1]!.b - bands[0]!.a) * step) / height
    : 0;
  const paperF = total ? paper / total : 0;
  const colorF = total ? color / total : 0;

  return paperF >= 0.84 && colorF <= 0.025 && body >= 10 && span >= 0.28;
}
