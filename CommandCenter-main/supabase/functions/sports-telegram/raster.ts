import { Resvg, initWasm } from "npm:@resvg/resvg-wasm@2.6.2";
import {
  FONT_BOLD,
  FONT_CONDENSED_BOLD,
  FONT_REGULAR,
  FONT_SEMIBOLD,
  RESVG_WASM,
} from "../_shared/heat-alert/assets.ts";
import { decodeBase64 } from "../_shared/heat-alert/binary.ts";
import { heatAlertFonts, heatAlertResvgOptions } from "../_shared/heat-alert/raster-options.ts";

const fonts = heatAlertFonts({
  regular: decodeBase64(FONT_REGULAR),
  semibold: decodeBase64(FONT_SEMIBOLD),
  bold: decodeBase64(FONT_BOLD),
  condensedBold: decodeBase64(FONT_CONDENSED_BOLD),
});

let wasmReady: Promise<void> | null = null;

function ensureWasm(): Promise<void> {
  if (!wasmReady) {
    wasmReady = initWasm(decodeBase64(RESVG_WASM)).catch((err) => {
      wasmReady = null;
      throw err;
    });
  }
  return wasmReady;
}

export async function rasterizeHeatAlert(svg: string): Promise<Uint8Array> {
  await ensureWasm();
  const resvg = new Resvg(svg, heatAlertResvgOptions(fonts));
  try {
    return resvg.render().asPng();
  } finally {
    resvg.free();
  }
}
