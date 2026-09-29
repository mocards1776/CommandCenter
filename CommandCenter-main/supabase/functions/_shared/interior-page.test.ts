import assert from "node:assert/strict";
import { isInteriorPage } from "./interior-page.ts";

function blank(width: number, height: number, fill = 255): Uint8Array {
  const data = new Uint8Array(width * height * 3);
  data.fill(fill);
  return data;
}

function hline(
  data: Uint8Array,
  width: number,
  y: number,
  x0: number,
  x1: number,
  thick: number,
  gray = 0,
  // Body copy is ink broken by word spaces. A solid bar reads as display type.
  duty = 1,
) {
  const height = data.length / (width * 3);
  for (let yy = y; yy < y + thick && yy < height; yy++) {
    for (let x = x0; x < x1 && x < width; x++) {
      if (duty < 1 && (x - x0) % 5 >= Math.round(5 * duty)) continue;
      const i = (yy * width + x) * 3;
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }
  }
}

// Praise page: paper-white, many thin lines of body text down the page.
{
  const w = 600;
  const h = 900;
  const data = blank(w, h);
  // Lines are a few pixels thick so the row sampler (about height/180) hits them.
  for (let n = 0; n < 16; n++) {
    hline(data, w, 210 + n * 36, 70, 530, 6, 0, 0.4);
  }
  assert.equal(isInteriorPage(w, h, data, 3), true, "praise page should be rejected");
}

// Minimal white jacket: a few display lines, not a page of quotes.
{
  const w = 600;
  const h = 900;
  const data = blank(w, h);
  hline(data, w, 280, 80, 520, 36);
  hline(data, w, 420, 140, 460, 18);
  hline(data, w, 620, 180, 420, 8);
  assert.equal(isInteriorPage(w, h, data, 3), false, "minimal jacket should be kept");
}

// Color jacket.
{
  const w = 400;
  const h = 600;
  const data = blank(w, h, 20);
  for (let y = 40; y < 560; y++) {
    for (let x = 30; x < 370; x++) {
      const i = (y * w + x) * 3;
      data[i] = 220;
      data[i + 1] = 40;
      data[i + 2] = 30;
    }
  }
  assert.equal(isInteriorPage(w, h, data, 3), false, "color jacket should be kept");
}

// Near-white cover with only a handful of lines (the Enemy of Mine shape).
{
  const w = 400;
  const h = 600;
  const data = blank(w, h);
  for (let n = 0; n < 7; n++) {
    hline(data, w, 80 + n * 60, 40, 360, 3);
  }
  assert.equal(isInteriorPage(w, h, data, 3), false, "sparse white cover should be kept");
}

console.log("interior-page tests ok");
