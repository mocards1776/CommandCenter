/**
 * Competitive Telegram card (1080×1350). Sports-finals hierarchy on cream:
 * left-aligned type, no postcard plates, Just in as the hero, recap second.
 *
 * Logo is the wordmark on the field — no disc, plate, or drop shadow.
 * Raster: SVG → resvg PNG → JPEG q≈95 → sendPhoto.
 */
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  barWidth,
  formatCpp,
  formatGrp,
  formatSpendShort,
  maxSpend,
  type CompetitiveCard,
} from "./card.ts";

export const COMPETITIVE_ALERT_WIDTH = CARD_WIDTH;
export const COMPETITIVE_ALERT_HEIGHT = CARD_HEIGHT;

/** Native logo 276×34. Small header mark, left — not a letterhead plate. */
export const LOGO_DISPLAY_WIDTH = 368;
export const LOGO_DISPLAY_HEIGHT = 45;
export const LOGO_X = 40;
export const LOGO_Y = 26;

const W = CARD_WIDTH;
const H = CARD_HEIGHT;
const M = 40;

const CREAM = "#F2EEE6";
const INK = "#1A1814";
const MUTED = "#6E6860";
const FAINT = "#9A948A";
const LINE = "#DDD6CB";
const TRACK = "#E4DED4";
const BLUE = "#0A84FF";
const BRAND = "#8A3046";

const TRACK_W = W - M * 2;

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

function hairline(y: number): string {
  return `<rect x="${M}" y="${y}" width="${TRACK_W}" height="1" fill="${LINE}"/>`;
}

function logoMark(card: CompetitiveCard): string {
  if (card.logoData) {
    return `<image href="${esc(card.logoData)}" x="${LOGO_X}" y="${LOGO_Y}" width="${LOGO_DISPLAY_WIDTH}" height="${LOGO_DISPLAY_HEIGHT}" preserveAspectRatio="xMinYMid meet"/>`;
  }
  return text("THOMPSON COMMUNICATIONS", LOGO_X, LOGO_Y + 30, {
    size: 15,
    fill: BRAND,
    weight: 700,
    spacing: 1.6,
  });
}

function newMark(x: number, y: number): string {
  const w = 52;
  const h = 22;
  return [
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${BLUE}"/>`,
    text("NEW", x + w / 2, y + 16, { size: 11, fill: "#FFFFFF", anchor: "middle", weight: 700, spacing: 1.1 }),
  ].join("");
}

function justInHero(card: CompetitiveCard, y: number): string {
  const parts = [
    text(card.justInTitle, M, y + 40, { size: 48, fill: INK, weight: 700 }),
  ];
  let rowY = y + 72;
  for (const item of card.whatsNew) {
    parts.push(`<rect x="${M}" y="${rowY + 6}" width="4" height="76" rx="2" fill="${item.color}"/>`);
    parts.push(newMark(M + 20, rowY + 10));
    parts.push(text(item.label, M + 84, rowY + 28, { size: 32, fill: INK, weight: 700 }));
    parts.push(text(item.detail, M + 84, rowY + 58, { size: 20, fill: MUTED }));
    rowY += 104;
  }
  return parts.join("");
}

function raceRow(card: CompetitiveCard, index: number, y: number): string {
  const row = card.buyers[index];
  if (!row) return "";
  const spendMax = maxSpend(card.buyers);
  const barH = 6;
  const barW = barWidth(row.spend, spendMax, TRACK_W);
  const barY = y + 52;
  return [
    text(row.name, M, y + 22, { size: 22, fill: INK, weight: 700 }),
    text(`${formatCpp(row.cpp)} CPP`, W - M, y + 22, { size: 18, fill: MUTED, anchor: "end", weight: 700 }),
    text(`${formatSpendShort(row.spend)}  ·  ${formatGrp(row.grp)} GRP`, M, y + 44, {
      size: 16,
      fill: FAINT,
    }),
    `<rect x="${M}" y="${barY}" width="${TRACK_W}" height="${barH}" rx="3" fill="${TRACK}"/>`,
    `<rect x="${M}" y="${barY}" width="${barW}" height="${barH}" rx="3" fill="${row.color}"/>`,
  ].join("");
}

function stillAhead(card: CompetitiveCard, y: number): string {
  const parts = [text("STILL AHEAD", M, y, { size: 13, fill: FAINT, weight: 700, spacing: 1.6 })];
  card.stillAhead.forEach((item, i) => {
    const iy = y + 36 + i * 36;
    parts.push(`<circle cx="${M + 6}" cy="${iy - 5}" r="3.5" fill="${FAINT}"/>`);
    parts.push(text(item.text, M + 24, iy, { size: 18, fill: INK }));
  });
  return parts.join("");
}

export function renderCompetitiveSvg(card: CompetitiveCard): string {
  const heroY = 156;
  const heroH = 72 + card.whatsNew.length * 104;
  const recapY = heroY + heroH + 24;
  const recapRowH = 80;
  const recapH = 36 + card.buyers.length * recapRowH;
  const aheadY = recapY + recapH + 24;

  const recap = card.buyers.map((_, i) => raceRow(card, i, recapY + 28 + i * recapRowH)).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Inter, sans-serif" role="img" aria-label="${esc(card.title)} just in">
  <rect width="${W}" height="${H}" fill="${CREAM}"/>
  ${logoMark(card)}
  ${text(card.dateLabel, W - M, 54, { size: 15, fill: MUTED, anchor: "end" })}
  ${text(card.race, M, 102, { size: 34, fill: INK, weight: 700 })}
  ${text(`${card.office}  ·  ${card.market}`, M, 128, { size: 16, fill: MUTED })}
  ${justInHero(card, heroY)}
  ${hairline(recapY - 16)}
  ${text("RACE", M, recapY + 8, { size: 13, fill: FAINT, weight: 700, spacing: 1.6 })}
  ${recap}
  ${hairline(aheadY - 16)}
  ${stillAhead(card, aheadY)}
  ${text(card.footer, M, 1298, { size: 14, fill: MUTED })}
  ${text(card.handle, W - M, 1298, { size: 13, fill: FAINT, anchor: "end" })}
</svg>`;
}
