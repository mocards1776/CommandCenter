#!/usr/bin/env python3
"""Rebuild the embedded font and resvg wasm module used by sports-telegram.

Reads the OFL fonts in supabase/functions/_shared/heat-alert/fonts and
@resvg/resvg-wasm from scripts/node_modules (npm install in scripts/ first).
"""

from __future__ import annotations

import base64
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
HEAT = ROOT / "supabase" / "functions" / "_shared" / "heat-alert"
FONTS = HEAT / "fonts"
WASM = ROOT / "scripts" / "node_modules" / "@resvg" / "resvg-wasm" / "index_bg.wasm"
OUT = HEAT / "assets.ts"

FILES = {
    "FONT_REGULAR": FONTS / "LibreFranklin-Regular.ttf",
    "FONT_SEMIBOLD": FONTS / "LibreFranklin-SemiBold.ttf",
    "FONT_BOLD": FONTS / "LibreFranklin-Bold.ttf",
    "FONT_CONDENSED_BOLD": FONTS / "BarlowCondensed-Bold.ttf",
    "RESVG_WASM": WASM,
}


def main() -> None:
    missing = [str(path) for path in FILES.values() if not path.is_file()]
    if missing:
        raise SystemExit("missing:\n  " + "\n  ".join(missing))
    lines = [
        "/**",
        " * Embedded fonts and the resvg wasm binary so the edge bundle can rasterize",
        " * without extra static-file packaging.",
        " * Libre Franklin and Barlow Condensed: SIL Open Font License (see ./fonts).",
        " * resvg wasm: MPL-2.0, @resvg/resvg-wasm@2.6.2.",
        " * Rebuild with: python3 scripts/embed-heat-alert-assets.py",
        " */",
    ]
    for name, path in FILES.items():
        encoded = base64.b64encode(path.read_bytes()).decode("ascii")
        lines.append(f"export const {name} =")
        lines.append(f'  "{encoded}";')
    OUT.write_text("\n".join(lines) + "\n")
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
