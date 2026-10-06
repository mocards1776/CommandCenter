/**
 * Rasterize the competitive SVG. Fonts and resvg prefer the sports-finals
 * vendor directory (already in the repo); CDN is the isolate fallback.
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
  const locals = [
    new URL(`../sports-finals/vendor/${name}`, import.meta.url),
    new URL(`./vendor/${name}`, import.meta.url),
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
