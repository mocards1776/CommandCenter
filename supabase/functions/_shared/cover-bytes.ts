import jpeg from "npm:jpeg-js@0.4.4";
import { decode as decodePng } from "npm:fast-png@6.2.0";
import { isInteriorPage, rasterToRgb, type DecodedRaster } from "./interior-page.ts";

/** Magic-byte type when a CDN serves a jacket as application/octet-stream. */
export function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * True when these bytes are a praise page, copyright page, or other interior
 * text scan. Decode failures return false so a real jacket is never dropped
 * just because we couldn't read it.
 */
export function imageIsInteriorPage(bytes: Uint8Array, contentType: string): boolean {
  try {
    const sniffed = sniffImageType(bytes);
    const type = (sniffed ?? contentType).toLowerCase();
    if (type.includes("png")) {
      const png = decodePng(bytes) as DecodedRaster;
      const rgb = rasterToRgb({
        width: png.width,
        height: png.height,
        data: png.data,
        channels: png.channels,
        depth: png.depth,
        palette: png.palette,
      });
      if (!rgb) return false;
      return isInteriorPage(rgb.width, rgb.height, rgb.data, rgb.channels);
    }
    if (type.includes("jpeg") || type.includes("jpg")) {
      const jpg = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
      return isInteriorPage(jpg.width, jpg.height, jpg.data, 4);
    }
    return false;
  } catch {
    return false;
  }
}

/** URL slug Simon & Schuster uses in its ONIX cover CDN. */
function titleSlugs(title: string): string[] {
  const base = title
    .split(":")[0]!
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  if (!base) return [];
  const slugs = [base];
  const noArticle = base.replace(/^(the|a|an)-/, "");
  if (noArticle && noArticle !== base) slugs.push(noArticle);
  return slugs.slice(0, 2);
}

/**
 * Publisher jacket URLs keyed by ISBN-13. Free catalogs lag on new titles, and
 * Google Books sometimes serves the first interior page (praise, copyright)
 * as the "front cover."
 */
export function publisherJacketUrls(isbnRaw: string, title?: string | null): string[] {
  const isbn = isbnRaw.replace(/[^0-9Xx]/g, "");
  if (isbn.length !== 13) return [];
  const urls = [
    `https://www.harpercollins.com/cdn/shop/files/${isbn}.jpg`,
    `https://www.harpercollins.com/cdn/shop/products/${isbn}.jpg`,
  ];
  for (const slug of titleSlugs(title ?? "")) {
    urls.push(
      `https://d28hgpri8am2if.cloudfront.net/book_images/onix/cvr${isbn}/${slug}-${isbn}_hr.jpg`,
    );
  }
  return urls;
}
