/**
 * Competitive Telegram card (1080×1350). Centered liquid-glass infographic:
 * wordmark on the field (no plate), Just in = actual new buys, then race
 * recap + DMA affiliation pies and a spend totals strip.
 *
 * Raster: SVG → resvg PNG → JPEG q≈95 → sendPhoto.
 */
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  DEM_CANDIDATE,
  GOP_CANDIDATE,
  affiliationTotals,
  barWidth,
  displayMedia,
  formatGrp,
  formatJustInNote,
  formatSpendExact,
  formatSpendShort,
  landscapeBuyers,
  maxGrp,
  maxSpend,
  raceSpendTotal,
  type AffiliationSlice,
  type BuyerRow,
  type CompetitiveCard,
  type JustInBuy,
} from "./card.ts";

export const COMPETITIVE_ALERT_WIDTH = CARD_WIDTH;
export const COMPETITIVE_ALERT_HEIGHT = CARD_HEIGHT;

/** Native logo 276×34. Centered on the field — no disc or plate. */
export const LOGO_DISPLAY_WIDTH = 480;
export const LOGO_DISPLAY_HEIGHT = 59;
export const LOGO_X = (CARD_WIDTH - LOGO_DISPLAY_WIDTH) / 2;
export const LOGO_Y = 28;

const W = CARD_WIDTH;
const H = CARD_HEIGHT;
const CX = W / 2;

const CREAM = "#EFE8DC";
const INK = "#1A1814";
const MUTED = "#5C564E";
const FAINT = "#8A8378";
const TRACK = "rgba(255,255,255,0.35)";
const BRAND = "#8A3046";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function text(
  value: string,
  x: number,
  y: number,
  opts: {
    size: number;
    fill: string;
    anchor?: "start" | "middle" | "end";
    weight?: number;
    spacing?: number;
  },
): string {
  const anchor = opts.anchor ?? "start";
  const weight = opts.weight ?? 400;
  const spacing = opts.spacing != null ? ` letter-spacing="${opts.spacing}"` : "";
  return `<text x="${x}" y="${y}" fill="${opts.fill}" font-size="${opts.size}" font-weight="${weight}" font-family="Inter" text-anchor="${anchor}"${spacing}>${esc(value)}</text>`;
}

/** Inter bold advance — conservative so PAC names never clip the glass tile. */
export function estimateTextWidth(value: string, size: number, weight = 700): number {
  const em = weight >= 700 ? 0.64 : 0.58;
  let width = 0;
  for (const ch of value) {
    if (ch === " ") width += size * 0.28;
    else if ("ilI.,'’".includes(ch)) width += size * 0.3;
    else if ("mwMW@".includes(ch)) width += size * 0.88;
    else width += size * em;
  }
  return width;
}

export function wrapTwoLines(value: string, maxWidth: number, size: number, weight = 700): string[] {
  if (estimateTextWidth(value, size, weight) <= maxWidth) return [value];
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length < 2) return [value];
  let best = 1;
  let bestScore = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    const score = Math.max(estimateTextWidth(a, size, weight), estimateTextWidth(b, size, weight));
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

export function fitName(
  value: string,
  maxWidth: number,
  maxSize: number,
  minSize: number,
  weight = 700,
): { lines: string[]; size: number } {
  const words = value.trim().split(/\s+/).filter(Boolean).length;
  const readable = Math.max(minSize, Math.min(maxSize, words >= 3 ? 19 : 16));
  for (let size = maxSize; size >= readable; size--) {
    if (estimateTextWidth(value, size, weight) <= maxWidth) {
      return { lines: [value], size };
    }
  }
  for (let size = maxSize; size >= minSize; size--) {
    const lines = wrapTwoLines(value, maxWidth, size, weight);
    if (lines.length === 2 && lines.every((line) => estimateTextWidth(line, size, weight) <= maxWidth)) {
      return { lines, size };
    }
  }
  for (let size = readable - 1; size >= minSize; size--) {
    if (estimateTextWidth(value, size, weight) <= maxWidth) {
      return { lines: [value], size };
    }
  }
  return { lines: wrapTwoLines(value, maxWidth, minSize, weight), size: minSize };
}

function fittedLines(
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  opts: {
    maxSize: number;
    minSize: number;
    fill: string;
    anchor?: "start" | "middle" | "end";
    weight?: number;
    /** Shift the block so a 2-line name stays on the same baseline as a 1-line name. */
    baseline?: number;
  },
): string {
  const weight = opts.weight ?? 700;
  const fit = fitName(value, maxWidth, opts.maxSize, opts.minSize, weight);
  const baseline = opts.baseline ?? y;
  if (fit.lines.length === 1) {
    return text(fit.lines[0]!, x, baseline, { size: fit.size, fill: opts.fill, anchor: opts.anchor, weight });
  }
  const gap = fit.size + 3;
  return [
    text(fit.lines[0]!, x, baseline - gap / 2, { size: fit.size, fill: opts.fill, anchor: opts.anchor, weight }),
    text(fit.lines[1]!, x, baseline + gap / 2, { size: fit.size, fill: opts.fill, anchor: opts.anchor, weight }),
  ].join("");
}

function glassPanel(x: number, y: number, w: number, h: number, rx = 26): string {
  return [
    `<rect filter="url(#glassDepth)" x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="rgba(255,255,255,0.34)" stroke="rgba(255,255,255,0.7)" stroke-width="1.25"/>`,
    `<rect x="${x + 14}" y="${y + 1}" width="${w - 28}" height="2" rx="1" fill="rgba(255,255,255,0.55)"/>`,
  ].join("");
}

function sectionLabel(label: string, y: number): string {
  return text(label, CX, y, { size: 13, fill: FAINT, anchor: "middle", weight: 700, spacing: 2.4 });
}

function logoMark(card: CompetitiveCard): string {
  if (card.logoData) {
    return `<image href="${esc(card.logoData)}" x="${LOGO_X}" y="${LOGO_Y}" width="${LOGO_DISPLAY_WIDTH}" height="${LOGO_DISPLAY_HEIGHT}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  return text("THOMPSON COMMUNICATIONS", CX, LOGO_Y + 34, {
    size: 16,
    fill: BRAND,
    anchor: "middle",
    weight: 700,
    spacing: 2,
  });
}

function justInHero(buys: readonly JustInBuy[], y: number): string {
  const n = Math.max(1, buys.length);
  const gap = 18;
  const colW = Math.round((W - 80 - gap * (n - 1)) / n);
  const colH = 248;
  const x0 = Math.round((W - (colW * n + gap * (n - 1))) / 2);
  const tileY = y + 48;
  const parts = [text("JUST IN", CX, y + 28, { size: 26, fill: INK, anchor: "middle", weight: 700, spacing: 2.6 })];
  buys.forEach((buy, i) => {
    const x = x0 + i * (colW + gap);
    const cx = x + colW / 2;
    parts.push(glassPanel(x, tileY, colW, colH, 28));
    parts.push(`<circle cx="${cx}" cy="${tileY + 36}" r="8" fill="${buy.color}"/>`);
    parts.push(fittedLines(buy.sponsor, cx, tileY + 72, colW - 36, {
      maxSize: 20,
      minSize: 12,
      fill: INK,
      anchor: "middle",
      weight: 700,
      baseline: tileY + 72,
    }));
    parts.push(text("added", cx, tileY + 98, { size: 14, fill: MUTED, anchor: "middle" }));
    parts.push(text(formatSpendExact(buy.amount), cx, tileY + 150, { size: 40, fill: INK, anchor: "middle", weight: 700 }));
    parts.push(
      text(`in ${buy.market} ${displayMedia(buy.media)} for ${formatGrp(buy.grp)} GRP`, cx, tileY + 186, {
        size: 15,
        fill: MUTED,
        anchor: "middle",
      }),
    );
    const note = formatJustInNote(buy);
    if (note) {
      parts.push(fittedLines(note, cx, tileY + 214, colW - 28, {
        maxSize: 13,
        minSize: 10,
        fill: MUTED,
        anchor: "middle",
        weight: 400,
        baseline: tileY + 214,
      }));
    }
  });
  return parts.join("");
}

function buyerTile(row: BuyerRow, x: number, y: number, w: number, h: number, spendMax: number, grpMax: number): string {
  const pad = 22;
  const track = w - pad * 2;
  const spendW = barWidth(row.spend, spendMax, track);
  const grpW = barWidth(row.grp, grpMax, track);
  const barY = y + h - 42;
  const grpLabel = `${formatGrp(row.grp)} GRP`;
  const grpWpx = estimateTextWidth(grpLabel, 15, 700);
  const nameWidth = Math.max(120, track - grpWpx - 14);
  return [
    glassPanel(x, y, w, h, 22),
    `<rect x="${x + 18}" y="${y + 10}" width="${w - 36}" height="4" rx="2" fill="${row.color}" opacity="0.85"/>`,
    fittedLines(row.name, x + pad, y + 48, nameWidth, {
      maxSize: 22,
      minSize: 13,
      fill: INK,
      weight: 700,
      baseline: y + 48,
    }),
    text(grpLabel, x + w - pad, y + 48, { size: 15, fill: MUTED, anchor: "end", weight: 700 }),
    text(formatSpendShort(row.spend), x + pad, y + 86, { size: 26, fill: INK, weight: 700 }),
    `<rect x="${x + pad}" y="${barY}" width="${track}" height="12" rx="6" fill="${TRACK}"/>`,
    `<rect x="${x + pad}" y="${barY}" width="${spendW}" height="12" rx="6" fill="${row.color}"/>`,
    `<rect x="${x + pad}" y="${barY + 18}" width="${track}" height="5" rx="2.5" fill="${TRACK}"/>`,
    `<rect x="${x + pad}" y="${barY + 18}" width="${grpW}" height="5" rx="2.5" fill="${row.color}" opacity="0.5"/>`,
  ].join("");
}

function raceGrid(buyers: readonly BuyerRow[], y: number): string {
  const shown = landscapeBuyers(buyers);
  const gap = 14;
  const colW = Math.round((W - 80 - gap) / 2);
  const rowH = 156;
  const x0 = Math.round((W - (colW * 2 + gap)) / 2);
  const spendMax = maxSpend(shown);
  const grpMax = maxGrp(shown);
  const parts = [sectionLabel("RACE", y + 8)];
  shown.forEach((row, i) => {
    const col = i % 2;
    const r = Math.floor(i / 2);
    parts.push(buyerTile(row, x0 + col * (colW + gap), y + 24 + r * (rowH + gap), colW, rowH, spendMax, grpMax));
  });
  return parts.join("");
}

function polar(cx: number, cy: number, r: number, a: number): [number, number] {
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

/** Donut slice. Angles in radians, 0 = 3 o'clock, sweep clockwise from 12 o'clock. */
export function donutSlice(cx: number, cy: number, outer: number, inner: number, a0: number, a1: number): string {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = polar(cx, cy, outer, a0);
  const [x1, y1] = polar(cx, cy, outer, a1);
  const [ix1, iy1] = polar(cx, cy, inner, a1);
  const [ix0, iy0] = polar(cx, cy, inner, a0);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${outer} ${outer} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} L${ix1.toFixed(2)} ${iy1.toFixed(2)} A${inner} ${inner} 0 ${large} 0 ${ix0.toFixed(2)} ${iy0.toFixed(2)} Z`;
}

function affiliationPies(slices: readonly AffiliationSlice[], y: number): string {
  const gap = 16;
  const colW = Math.round((W - 80 - gap) / 2);
  const colH = 248;
  const x0 = Math.round((W - (colW * 2 + gap)) / 2);
  const charts: { title: string; key: "spend" | "grp"; format: (n: number) => string }[] = [
    { title: "SPEND", key: "spend", format: formatSpendShort },
    { title: "GRP", key: "grp", format: formatGrp },
  ];
  const parts = [sectionLabel("DMA", y + 6)];
  charts.forEach((chart, i) => {
    const x = x0 + i * (colW + gap);
    const cx = x + colW / 2;
    const cy = y + 118;
    const total = slices.reduce((sum, s) => sum + s[chart.key], 0);
    parts.push(glassPanel(x, y + 20, colW, colH, 24));
    parts.push(text(chart.title, cx, y + 48, { size: 13, fill: FAINT, anchor: "middle", weight: 700, spacing: 1.8 }));
    let angle = -Math.PI / 2;
    const gapA = 0.06;
    const usable = Math.PI * 2 - gapA * slices.length;
    for (const slice of slices) {
      const share = total > 0 ? slice[chart.key] / total : 0;
      const sweep = Math.max(0.02, share * usable);
      parts.push(
        `<path d="${donutSlice(cx, cy, 70, 40, angle, angle + sweep)}" fill="${slice.color}"/>`,
      );
      angle += sweep + gapA;
    }
    parts.push(text(chart.format(total), cx, cy + 6, { size: 16, fill: INK, anchor: "middle", weight: 700 }));
    let lx = x + 24;
    slices.forEach((slice) => {
      parts.push(`<circle cx="${lx}" cy="${y + 226}" r="5" fill="${slice.color}"/>`);
      parts.push(text(`${slice.label}  ${chart.format(slice[chart.key])}`, lx + 12, y + 230, { size: 13, fill: INK, weight: 700 }));
      lx += colW / 2 - 8;
    });
  });
  return parts.join("");
}

/**
 * Footer affiliation labels. PAC names stay full; wrap to two lines and
 * shorten only the candidate last name if the column is still tight.
 */
function footerParties(label: string, cx: number, y: number, maxWidth: number): string {
  if (!label) return "";
  const plus = label.indexOf(" + ");
  const oneLine = estimateTextWidth(label, 12, 400) <= maxWidth * 0.92 && label.length <= 26;
  if (oneLine) {
    return text(label, cx, y, { size: 12, fill: MUTED, anchor: "middle" });
  }
  if (plus > 0) {
    let left = label.slice(0, plus);
    const right = label.slice(plus + 3);
    if (estimateTextWidth(`${left} +`, 11, 400) > maxWidth) {
      left = `${left.slice(0, Math.min(4, left.length))}.`;
    }
    return [
      text(`${left} +`, cx, y - 7, { size: 11, fill: MUTED, anchor: "middle" }),
      fittedLines(right, cx, y + 8, maxWidth, {
        maxSize: 11,
        minSize: 8,
        fill: MUTED,
        anchor: "middle",
        weight: 400,
        baseline: y + 8,
      }),
    ].join("");
  }
  return fittedLines(label, cx, y, maxWidth, {
    maxSize: 12,
    minSize: 8,
    fill: MUTED,
    anchor: "middle",
    weight: 400,
    baseline: y,
  });
}

function spendTotalsStrip(slices: readonly AffiliationSlice[], race: number, y: number): string {
  const x = 40;
  const w = W - 80;
  const h = 92;
  const [dem, gop] = slices;
  const third = w / 3;
  return [
    glassPanel(x, y, w, h, 22),
    text("DEM", x + third * 0.5, y + 26, { size: 11, fill: FAINT, anchor: "middle", weight: 700, spacing: 1.4 }),
    footerParties(dem?.parties ?? "", x + third * 0.5, y + 44, third - 20),
    text(formatSpendExact(dem?.spend ?? 0), x + third * 0.5, y + 72, { size: 20, fill: DEM_CANDIDATE, anchor: "middle", weight: 700 }),
    text("GOP", x + third * 1.5, y + 26, { size: 11, fill: FAINT, anchor: "middle", weight: 700, spacing: 1.4 }),
    footerParties(gop?.parties ?? "", x + third * 1.5, y + 44, third - 20),
    text(formatSpendExact(gop?.spend ?? 0), x + third * 1.5, y + 72, { size: 20, fill: GOP_CANDIDATE, anchor: "middle", weight: 700 }),
    text("RACE", x + third * 2.5, y + 26, { size: 11, fill: FAINT, anchor: "middle", weight: 700, spacing: 1.4 }),
    text("both sides", x + third * 2.5, y + 44, { size: 12, fill: MUTED, anchor: "middle" }),
    text(formatSpendExact(race), x + third * 2.5, y + 72, { size: 20, fill: INK, anchor: "middle", weight: 700 }),
  ].join("");
}

/** Mid-weight orb blur. 42 OOMs isolates (546); live hotfix 14 looked hard-edged. */
export const ORB_BLUR_STD_DEVIATION = 26;
/** Light glass shadow — the std=18 drop-shadow was part of the isolate OOM. */
export const GLASS_SHADOW_STD_DEVIATION = 8;

function field(): string {
  return `
  <rect width="${W}" height="${H}" fill="${CREAM}"/>
  <ellipse filter="url(#orb)" cx="200" cy="260" rx="300" ry="210" fill="#7EB6FF" opacity="0.34"/>
  <ellipse filter="url(#orb)" cx="900" cy="320" rx="280" ry="200" fill="#FF8A80" opacity="0.26"/>
  <ellipse filter="url(#orb)" cx="540" cy="1000" rx="360" ry="230" fill="#C4B5FD" opacity="0.22"/>
  <ellipse filter="url(#orb)" cx="140" cy="1120" rx="210" ry="160" fill="#FFFFFF" opacity="0.26"/>
`;
}

function defs(): string {
  // Soft depth without the 42-blur + heavy drop-shadow path that 546'd isolates.
  // Filter region is wide enough that std=26 does not clip into a hard halo.
  return `
  <defs>
    <filter id="orb" x="-45%" y="-45%" width="190%" height="190%" color-interpolation-filters="sRGB">
      <feGaussianBlur stdDeviation="${ORB_BLUR_STD_DEVIATION}"/>
    </filter>
    <filter id="glassDepth" x="-8%" y="-12%" width="116%" height="130%">
      <feDropShadow dx="0" dy="6" stdDeviation="${GLASS_SHADOW_STD_DEVIATION}" flood-color="#1A1814" flood-opacity="0.10"/>
    </filter>
  </defs>`;
}

export function renderCompetitiveSvg(card: CompetitiveCard): string {
  const heroY = 208;
  const raceY = 540;
  const dmaY = 892;
  const stripY = 1176;
  const sides = affiliationTotals(card.buyers);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Inter, sans-serif" role="img" aria-label="${esc(card.title)} just in">
  ${defs()}
  ${field()}
  ${logoMark(card)}
  ${text(card.kicker, CX, 108, { size: 12, fill: BRAND, anchor: "middle", weight: 700, spacing: 2.8 })}
  ${text(card.title, CX, 158, { size: 48, fill: INK, anchor: "middle", weight: 700 })}
  ${text(`${card.dateLabel}  ·  ${card.market}  ·  ${card.weekNumberLabel}`, CX, 190, { size: 16, fill: MUTED, anchor: "middle" })}
  ${justInHero(card.justIn, heroY)}
  ${raceGrid(card.buyers, raceY)}
  ${affiliationPies(sides, dmaY)}
  ${spendTotalsStrip(sides, raceSpendTotal(card.buyers), stripY)}
  ${text(`${card.footer}   ·   ${card.handle}`, CX, 1318, { size: 13, fill: FAINT, anchor: "middle" })}
</svg>`;
}
