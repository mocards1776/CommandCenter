/**
 * Rasterize the finals SVG. Fonts and resvg are vendored next to this file.
 * If the edge bundle does not mount that directory, the same bytes are fetched
 * once per isolate.
 */
import { initWasm, Resvg } from "npm:@resvg/resvg-wasm@2.6.2";

const WASM_URL = "https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm";
const FONT_URLS = {
  "Inter-400.ttf": "https://cdn.jsdelivr.net/fontsource/fonts/inter@5.2.8/latin-400-normal.ttf",
  "Inter-700.ttf": "https://cdn.jsdelivr.net/fontsource/fonts/inter@5.2.8/latin-700-normal.ttf",
} as const;

let ready: Promise<void> | null = null;
let fonts: Uint8Array[] = [];

async function loadBytes(name: string, remote: string): Promise<Uint8Array> {
  try {
    return await Deno.readFile(new URL(`./vendor/${name}`, import.meta.url));
  } catch (err) {
    console.error("reading vendored", name, err);
    const res = await fetch(remote);
    if (!res.ok) throw new Error(`Could not load ${name} (${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
  }
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
    textRendering: 1,
    shapeRendering: 2,
    background: "#07101d",
  });
  try {
    return resvg.render().asPng();
  } finally {
    resvg.free();
  }
}
