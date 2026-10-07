/**
 * Rasterize the competitive SVG. Fonts and resvg prefer this function's
 * vendor directory (deployed with the isolate); sports-finals/vendor is
 * the local-repo fallback; CDN is last.
 */
import { initWasm, Resvg } from "npm:@resvg/resvg-wasm@2.6.2";

const WASM_URL = "https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm";
const FONT_URLS = {
  "Inter-400.ttf": "https://cdn.jsdelivr.net/fontsource/fonts/inter@5.2.8/latin-400-normal.ttf",
  "Inter-700.ttf": "https://cdn.jsdelivr.net/fontsource/fonts/inter@5.2.8/latin-700-normal.ttf",
} as const;

/** Native card is 1080 wide; 900 still reads cleanly and keeps isolate RAM down. */
export const PNG_FIT_TO_WIDTH = 900;

let ready: Promise<void> | null = null;
let fonts: Uint8Array[] = [];

async function loadBytes(name: string, remote: string): Promise<Uint8Array> {
  const locals = [
    new URL(`./vendor/${name}`, import.meta.url),
    new URL(`../sports-finals/vendor/${name}`, import.meta.url),
  ];
  for (const href of locals) {
    try {
      return await Deno.readFile(href);
    } catch {
      try {
        const { readFile } = await import("node:fs/promises");
        return new Uint8Array(await readFile(href));
      } catch {
        // try next
      }
    }
  }
  const res = await fetch(remote);
  if (!res.ok) throw new Error(`Could not load ${name} (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

function ensure(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const [wasm, regular, bold] = await Promise.all([
        loadBytes("resvg.wasm", WASM_URL),
        loadBytes("Inter-400.ttf", FONT_URLS["Inter-400.ttf"]),
        loadBytes("Inter-700.ttf", FONT_URLS["Inter-700.ttf"]),
      ]);
      await initWasm(wasm);
      fonts = [regular, bold];
    })();
  }
  return ready;
}

export async function rasterizeSvg(svg: string): Promise<Uint8Array> {
  await ensure();
  const resvg = new Resvg(svg, {
    font: {
      fontBuffers: fonts,
      defaultFontFamily: "Inter",
      sansSerifFamily: "Inter",
    },
    fitTo: { mode: "width", value: PNG_FIT_TO_WIDTH },
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
