/**
 * Render the Competitive Telegram cream card (1080×1350 JPEG).
 *
 *   cd scripts && npm install
 *   node --experimental-strip-types competitive-telegram-photo.ts
 *   node --experimental-strip-types competitive-telegram-photo.ts --out ../artifacts/competitive-sd30.jpg
 *
 * SVG → PNG (resvg) → JPEG q≈95. Same path as sports-finals. Not a Times screenshot.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import jpeg from "jpeg-js";
import { decode as decodePng } from "fast-png";
import { competitiveCaption, loadTciLogoDataUri, sd30GrayTwoStationCard, sd30KsprRevisionCard, sd30SampleCard, sd8SampleCard } from "../supabase/functions/competitive-telegram/card.ts";
import { renderCompetitiveSvg } from "../supabase/functions/competitive-telegram/svg.ts";
import { TELEGRAM_JPEG_QUALITY } from "../supabase/functions/competitive-telegram/telegram.ts";

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return null;
  const value = process.argv[i + 1];
  if (!value || value.startsWith("--")) return "";
  return value;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const vendor = path.resolve(here, "../supabase/functions/sports-finals/vendor");
const previewDir = path.resolve(here, "../supabase/functions/competitive-telegram/previews");

type DecodedPng = {
  width: number;
  height: number;
  data: Uint8Array | Uint16Array;
  channels?: number;
};

function toRgba8(decoded: DecodedPng): Uint8Array {
  const { width, height, data } = decoded;
  const channels = decoded.channels ?? 4;
  const pixels = width * height;
  if (channels === 4 && data instanceof Uint8Array && data.length >= pixels * 4) {
    return data.subarray(0, pixels * 4);
  }
  throw new Error(`unsupported PNG channels=${channels}`);
}

function pngToJpeg(png: Uint8Array, quality: number): Uint8Array {
  const decoded = decodePng(png) as DecodedPng;
  const encoded = jpeg.encode(
    { width: decoded.width, height: decoded.height, data: toRgba8(decoded) },
    quality,
  );
  return encoded.data instanceof Uint8Array ? new Uint8Array(encoded.data) : new Uint8Array(encoded.data);
}

async function rasterize(svg: string): Promise<Uint8Array> {
  const [wasm, regular, bold] = await Promise.all([
    readFile(path.join(vendor, "resvg.wasm")),
    readFile(path.join(vendor, "Inter-400.ttf")),
    readFile(path.join(vendor, "Inter-700.ttf")),
  ]);
  await initWasm(wasm);
  const resvg = new Resvg(svg, {
    font: {
      fontBuffers: [regular, bold],
      defaultFontFamily: "Inter",
      sansSerifFamily: "Inter",
    },
    textRendering: 1,
    shapeRendering: 2,
    background: "#EFE8DC",
  });
  try {
    return resvg.render().asPng();
  } finally {
    resvg.free();
  }
}

const slug = arg("slug") || "mo-sd30";
const preview = arg("preview");
const logo = await loadTciLogoDataUri();
const card = preview === "kspr"
  ? sd30KsprRevisionCard(logo)
  : preview === "gray-two"
    ? sd30GrayTwoStationCard(logo)
    : slug === "mo-sd8"
      ? sd8SampleCard(logo)
      : sd30SampleCard(logo);
const defaultName = preview === "kspr"
  ? "sd30-kspr-revision.jpg"
  : preview === "gray-two"
    ? "sd30-gray-two-station.jpg"
    : slug === "mo-sd8"
      ? "sample-sd8.jpg"
      : "sample-sd30.jpg";
const outPath = path.resolve(arg("out") || path.join(previewDir, defaultName));
const svg = renderCompetitiveSvg(card);
const png = await rasterize(svg);
const jpegBytes = pngToJpeg(png, TELEGRAM_JPEG_QUALITY);

await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, jpegBytes);
await writeFile(outPath.replace(/\.jpe?g$/i, ".svg"), svg);
await writeFile(outPath.replace(/\.jpe?g$/i, ".png"), png);

console.log(
  JSON.stringify(
    {
      out: outPath,
      width: 1080,
      height: 1350,
      jpegBytes: jpegBytes.byteLength,
      pngBytes: png.byteLength,
      quality: TELEGRAM_JPEG_QUALITY,
      logo: Boolean(logo),
      caption: competitiveCaption(card),
    },
    null,
    2,
  ),
);
