/**
 * PNG → JPEG for Telegram sendPhoto. Does not resize further; png.ts already
 * rasterizes at fitTo width 900 (native SVG is 1080×1350).
 *
 * Same helper as sports-finals/telegram-jpeg.ts.
 */
import jpeg from "npm:jpeg-js@0.4.4";
import { decode as decodePng } from "npm:fast-png@6.2.0";

type DecodedPng = {
  width: number;
  height: number;
  data: Uint8Array | Uint16Array;
  channels?: number;
};

export function pngToJpeg(png: Uint8Array, quality: number): Uint8Array {
  const decoded = decodePng(png) as DecodedPng;
  if (!decoded.width || !decoded.height) throw new Error("PNG has no dimensions");
  const encoded = jpeg.encode(
    { width: decoded.width, height: decoded.height, data: toRgba8(decoded) },
    quality,
  );
  return encoded.data instanceof Uint8Array ? new Uint8Array(encoded.data) : new Uint8Array(encoded.data);
}

function toRgba8(decoded: DecodedPng): Uint8Array {
  const { width, height, data } = decoded;
  const channels = decoded.channels ?? 4;
  const pixels = width * height;
  if (channels === 4 && data instanceof Uint8Array && data.length >= pixels * 4) {
    return data.subarray(0, pixels * 4);
  }
  const out = new Uint8Array(pixels * 4);
  if (channels === 3) {
    for (let i = 0, j = 0; i < pixels; i++, j += 4) {
      const k = i * 3;
      out[j] = Number(data[k]);
      out[j + 1] = Number(data[k + 1]);
      out[j + 2] = Number(data[k + 2]);
      out[j + 3] = 255;
    }
    return out;
  }
  if (channels === 1) {
    for (let i = 0, j = 0; i < pixels; i++, j += 4) {
      const v = Number(data[i]);
      out[j] = v;
      out[j + 1] = v;
      out[j + 2] = v;
      out[j + 3] = 255;
    }
    return out;
  }
  throw new Error(`unsupported PNG channels=${channels}`);
}
