/** Shared resvg options. Callers init the wasm module themselves. */

export function heatAlertFonts(decoded: {
  regular: Uint8Array;
  semibold: Uint8Array;
  bold: Uint8Array;
  condensedBold: Uint8Array;
}): Uint8Array[] {
  return [decoded.regular, decoded.semibold, decoded.bold, decoded.condensedBold];
}

export function heatAlertResvgOptions(fonts: Uint8Array[]) {
  return {
    fitTo: { mode: "width" as const, value: 1080 },
    textRendering: 1 as const,
    font: {
      fontBuffers: fonts,
      defaultFontFamily: "Libre Franklin",
      sansSerifFamily: "Libre Franklin",
    },
  };
}
