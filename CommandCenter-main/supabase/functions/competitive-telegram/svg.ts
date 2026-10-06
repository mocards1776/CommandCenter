/**
 * Competitive Telegram card (1080×1350). Centered infographic poster:
 * wordmark on the cream field (no plate), Just in as a 3-column hero,
 * 2×2 race tiles, still-ahead as a balanced row. Not a left-aligned list.
 *
 * Raster: SVG → resvg PNG → JPEG q≈95 → sendPhoto.
 */
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  barWidth,
  formatCpp,
  formatGrp,
  formatSpendShort,
  maxGrp,
  maxSpend,
  type AheadItem,
  type BuyerRow,
  type CompetitiveCard,
  type WhatsNewItem,
} from "./card.ts";

export const COMPETITIVE_ALERT_WIDTH = CARD_WIDTH;
export const COMPETITIVE_ALERT_HEIGHT = CARD_HEIGHT;

/** Native logo 276×34. Centered on the field — no disc or plate. */
export const LOGO_DISPLAY_WIDTH = 500;
export const LOGO_DISPLAY_HEIGHT = 62;
export const LOGO_X = (CARD_WIDTH - LOGO_DISPLAY_WIDTH) / 2;
export const LOGO_Y = 30;

const W = CARD_WIDTH;
const H = CARD_HEIGHT;
const CX = W / 2;

const CREAM = "#F2EEE6";
const TILE = "#FBF7F0";
const INK = "#1A1814";
const MUTED = "#6E6860";
const FAINT = "#9A948A";
const TRACK = "#E4DED4";
const RULE = "#D2C8B8";
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

function rulePair(label: string, y: number): string {
  const labelW = Math.max(80, label.length * 9);
  const gap = 18;
  const x1 = 64;
  const x2 = CX - labelW / 2 - gap;
  const x3 = CX + labelW / 2 + gap;
  const x4 = W - 64;
  return [
    `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${RULE}" stroke-width="1.5"/>`,
    text(label, CX, y + 5, { size: 13, fill: FAINT, anchor: "middle", weight: 700, spacing: 2.2 }),
    `<line x1="${x3}" y1="${y}" x2="${x4}" y2="${y}" stroke="${RULE}" stroke-width="1.5"/>`,
  ].join("");
}

function logoMark(card: CompetitiveCard): string {
  if (card.logoData) {
    return `<image href="${esc(card.logoData)}" x="${LOGO_X}" y="${LOGO_Y}" width="${LOGO_DISPLAY_WIDTH}" height="${LOGO_DISPLAY_HEIGHT}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  return text("THOMPSON COMMUNICATIONS", CX, LOGO_Y + 36, {
    size: 16,
    fill: BRAND,
    anchor: "middle",
    weight: 700,
    spacing: 2,
  });
}

function justInHero(items: readonly WhatsNewItem[], y: number): string {
  const n = Math.max(1, items.length);
  const gap = 18;
  const colW = (W - 72 - gap * (n - 1)) / n;
  const colH = 220;
  const x0 = (W - (colW * n + gap * (n - 1))) / 2;
  const tileY = y + 56;
  const parts = [
    `<line x1="72" y1="${y + 18}" x2="${CX - 86}" y2="${y + 18}" stroke="${RULE}" stroke-width="1.5"/>`,
    `<line x1="${CX + 86}" y1="${y + 18}" x2="${W - 72}" y2="${y + 18}" stroke="${RULE}" stroke-width="1.5"/>`,
    text("JUST IN", CX, y + 26, { size: 28, fill: INK, anchor: "middle", weight: 700, spacing: 2.4 }),
  ];
  items.forEach((item, i) => {
    const x = x0 + i * (colW + gap);
    const cy = tileY + 52;
    parts.push(`<rect x="${x}" y="${tileY}" width="${colW}" height="${colH}" rx="22" fill="${TILE}"/>`);
    parts.push(`<rect x="${x + 22}" y="${tileY}" width="${colW - 44}" height="7" rx="3.5" fill="${item.color}"/>`);
    parts.push(`<circle cx="${x + colW / 2}" cy="${cy}" r="24" fill="${item.color}"/>`);
    parts.push(text(item.label, x + colW / 2, tileY + 118, { size: 22, fill: INK, anchor: "middle", weight: 700 }));
    parts.push(text(item.detail, x + colW / 2, tileY + 148, { size: 15, fill: MUTED, anchor: "middle" }));
  });
  return parts.join("");
}

function buyerTile(row: BuyerRow, x: number, y: number, w: number, h: number, spendMax: number, grpMax: number): string {
  const pad = 22;
  const track = w - pad * 2;
  const spendW = barWidth(row.spend, spendMax, track);
  const grpW = barWidth(row.grp, grpMax, track);
  const barY = y + h - 44;
  return [
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="20" fill="${TILE}"/>`,
    `<rect x="${x}" y="${y}" width="${w}" height="7" rx="3.5" fill="${row.color}"/>`,
    text(row.name, x + pad, y + 44, { size: 24, fill: INK, weight: 700 }),
    text(`${formatCpp(row.cpp)} CPP`, x + w - pad, y + 44, { size: 16, fill: MUTED, anchor: "end", weight: 700 }),
    text(formatSpendShort(row.spend), x + pad, y + 86, { size: 28, fill: INK, weight: 700 }),
    text(`${formatGrp(row.grp)} GRP`, x + w - pad, y + 84, { size: 16, fill: FAINT, anchor: "end" }),
    `<rect x="${x + pad}" y="${barY}" width="${track}" height="14" rx="7" fill="${TRACK}"/>`,
    `<rect x="${x + pad}" y="${barY}" width="${spendW}" height="14" rx="7" fill="${row.color}"/>`,
    `<rect x="${x + pad}" y="${barY + 20}" width="${track}" height="6" rx="3" fill="${TRACK}"/>`,
    `<rect x="${x + pad}" y="${barY + 20}" width="${grpW}" height="6" rx="3" fill="${row.color}" opacity="0.5"/>`,
  ].join("");
}

function raceGrid(buyers: readonly BuyerRow[], y: number): string {
  const gap = 16;
  const colW = (W - 72 - gap) / 2;
  const rowH = 168;
  const x0 = (W - (colW * 2 + gap)) / 2;
  const spendMax = maxSpend(buyers);
  const grpMax = maxGrp(buyers);
  const parts = [rulePair("RACE LANDSCAPE", y + 10)];
  buyers.forEach((row, i) => {
    const col = i % 2;
    const r = Math.floor(i / 2);
    parts.push(buyerTile(row, x0 + col * (colW + gap), y + 32 + r * (rowH + gap), colW, rowH, spendMax, grpMax));
  });
  return parts.join("");
}

function stillAheadRow(items: readonly AheadItem[], y: number): string {
  const n = Math.max(1, items.length);
  const gap = 14;
  const colW = Math.round((W - 72 - gap * (n - 1)) / n);
  const colH = 108;
  const x0 = Math.round((W - (colW * n + gap * (n - 1))) / 2);
  const parts = [rulePair("STILL AHEAD", y + 10)];
  items.forEach((item, i) => {
    const x = x0 + i * (colW + gap);
    parts.push(`<rect x="${x}" y="${y + 28}" width="${colW}" height="${colH}" rx="18" fill="${TILE}"/>`);
    parts.push(`<circle cx="${x + colW / 2}" cy="${y + 48}" r="5" fill="${BRAND}"/>`);
    parts.push(text(item.line, x + colW / 2, y + 76, { size: 15, fill: INK, anchor: "middle", weight: 700 }));
    parts.push(text(item.sub, x + colW / 2, y + 98, { size: 13, fill: MUTED, anchor: "middle" }));
  });
  return parts.join("");
}

export function renderCompetitiveSvg(card: CompetitiveCard): string {
  const heroY = 220;
  const raceY = 520;
  const aheadY = 920;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Inter, sans-serif" role="img" aria-label="${esc(card.title)} just in">
  <rect width="${W}" height="${H}" fill="${CREAM}"/>
  ${logoMark(card)}
  ${text(card.kicker, CX, 114, { size: 12, fill: BRAND, anchor: "middle", weight: 700, spacing: 2.8 })}
  ${text(card.title, CX, 168, { size: 52, fill: INK, anchor: "middle", weight: 700 })}
  ${text(`${card.dateLabel}  ·  ${card.market}`, CX, 202, { size: 17, fill: MUTED, anchor: "middle" })}
  ${justInHero(card.whatsNew, heroY)}
  ${raceGrid(card.buyers, raceY)}
  ${stillAheadRow(card.stillAhead, aheadY)}
  ${text(`${card.footer}   ·   ${card.handle}`, CX, 1316, { size: 13, fill: FAINT, anchor: "middle" })}
</svg>`;
}
