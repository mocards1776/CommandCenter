/**
 * Apple-esque cream Competitive Telegram card (1080×1350).
 *
 * Josh: no dark poster, centered TCI logo (no discs/plates), visual
 * spend / GRP bars with accurate CPP labels, short what’s-new chips.
 * Raster via sports-finals SVG → PNG → JPEG q≈95, not Times screenshots.
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
  type CompetitiveCard,
} from "./card.ts";

export const COMPETITIVE_ALERT_WIDTH = CARD_WIDTH;
export const COMPETITIVE_ALERT_HEIGHT = CARD_HEIGHT;

/** Native logo is 276×34. Display width keeps it sharp and centered. */
export const LOGO_DISPLAY_WIDTH = 552;
export const LOGO_DISPLAY_HEIGHT = 68;
export const LOGO_X = (CARD_WIDTH - LOGO_DISPLAY_WIDTH) / 2;
export const LOGO_Y = 40;

const W = CARD_WIDTH;
const H = CARD_HEIGHT;
const M = 44;

const CREAM = "#F4EFE6";
const CARD = "#FFFFFF";
const INK = "#1C1916";
const MUTED = "#7A746A";
const FAINT = "#A39C91";
const TRACK = "#E7E1D6";
const GOLD = "#C6A15B";
const BRAND = "#8A3046";

const CARD_X = M;
const CARD_W = W - M * 2;
const INNER = 36;
const TRACK_W = CARD_W - INNER * 2;

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
    family?: string;
  },
): string {
  const anchor = opts.anchor ?? "start";
  const weight = opts.weight ?? 400;
  const family = opts.family ?? "Inter";
  const spacing = opts.spacing != null ? ` letter-spacing="${opts.spacing}"` : "";
  return `<text x="${x}" y="${y}" fill="${opts.fill}" font-size="${opts.size}" font-weight="${weight}" font-family="${family}" text-anchor="${anchor}"${spacing}>${esc(value)}</text>`;
}

function estimateWidth(label: string, size: number): number {
  return Math.round(label.length * size * 0.58 + 8);
}

function kickerPill(label: string, cx: number, y: number): string {
  const size = 13;
  const spacing = 1.8;
  const textW = label.length * size * 0.74 + Math.max(0, label.length - 1) * spacing;
  const w = Math.max(176, Math.round(textW + 44));
  const h = 34;
  const x = cx - w / 2;
  return [
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="#0A84FF"/>`,
    text(label, cx, y + 22, { size, fill: "#FFFFFF", anchor: "middle", weight: 700, spacing }),
  ].join("");
}

function logoMark(card: CompetitiveCard): string {
  if (card.logoData) {
    return `<image href="${esc(card.logoData)}" x="${LOGO_X}" y="${LOGO_Y}" width="${LOGO_DISPLAY_WIDTH}" height="${LOGO_DISPLAY_HEIGHT}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  return [
    text("THOMPSON COMMUNICATIONS", W / 2, LOGO_Y + 32, {
      size: 18,
      fill: BRAND,
      anchor: "middle",
      weight: 700,
      spacing: 2.2,
    }),
    text("INC.", W / 2, LOGO_Y + 54, { size: 11, fill: BRAND, anchor: "middle", weight: 700, spacing: 3 }),
  ].join("");
}

function whatsNewChips(card: CompetitiveCard, y: number): string {
  const gap = 14;
  const n = Math.max(1, card.whatsNew.length);
  const w = (W - M * 2 - gap * (n - 1)) / n;
  const h = 86;
  return card.whatsNew
    .map((item, i) => {
      const x = M + i * (w + gap);
      return [
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="${CARD}"/>`,
        `<circle cx="${x + 26}" cy="${y + 43}" r="6" fill="${item.color}"/>`,
        text(item.label, x + 44, y + 36, { size: 15, fill: INK, weight: 700 }),
        text(item.detail, x + 44, y + 58, { size: 14, fill: MUTED, weight: 400 }),
      ].join("");
    })
    .join("");
}

function valueOnBar(
  label: string,
  x: number,
  y: number,
  barW: number,
  trackW: number,
  fill: string,
  insideFill: string,
  size: number,
): string {
  const tw = estimateWidth(label, size);
  const pad = 12;
  if (barW > tw + pad * 2 && barW > trackW * 0.62) {
    return text(label, x + barW - pad, y, { size, fill: insideFill, anchor: "end", weight: 700 });
  }
  const outside = x + barW + 10;
  if (outside + tw < x + trackW) {
    return text(label, outside, y, { size, fill, anchor: "start", weight: 700 });
  }
  return text(label, x + trackW, y, { size, fill, anchor: "end", weight: 700 });
}

function buyerBlock(
  card: CompetitiveCard,
  index: number,
  y: number,
): string {
  const row = card.buyers[index];
  if (!row) return "";
  const spendMax = maxSpend(card.buyers);
  const grpMax = maxGrp(card.buyers);
  const x = CARD_X + INNER;
  const spendH = 18;
  const grpH = 7;
  const spendW = barWidth(row.spend, spendMax, TRACK_W);
  const grpW = barWidth(row.grp, grpMax, TRACK_W);
  const spendY = y + 42;
  const grpY = y + 76;
  const spendLabel = formatSpendShort(row.spend);
  const grpLabel = `${formatGrp(row.grp)} GRP`;
  return [
    text(row.name, x, y + 22, { size: 26, fill: INK, weight: 700 }),
    text(`${formatCpp(row.cpp)} CPP`, x + TRACK_W, y + 22, {
      size: 20,
      fill: MUTED,
      anchor: "end",
      weight: 700,
    }),
    `<rect x="${x}" y="${spendY}" width="${TRACK_W}" height="${spendH}" rx="${spendH / 2}" fill="${TRACK}"/>`,
    `<rect x="${x}" y="${spendY}" width="${spendW}" height="${spendH}" rx="${spendH / 2}" fill="${row.color}"/>`,
    valueOnBar(spendLabel, x, spendY + 13, spendW, TRACK_W, INK, "#FFFFFF", 13),
    `<rect x="${x}" y="${grpY}" width="${TRACK_W}" height="${grpH}" rx="${grpH / 2}" fill="${TRACK}"/>`,
    `<rect x="${x}" y="${grpY}" width="${grpW}" height="${grpH}" rx="${grpH / 2}" fill="${row.color}" opacity="0.55"/>`,
    valueOnBar(grpLabel, x, grpY + 20, grpW, TRACK_W, FAINT, MUTED, 13),
  ].join("");
}

export function renderCompetitiveSvg(card: CompetitiveCard): string {
  const chipY = 268;
  const boardY = 378;
  const boardH = 860;
  const rowStart = boardY + 118;
  const rowH = 168;
  const legendY = boardY + boardH - 36;

  const buyers = card.buyers
    .map((_, i) => buyerBlock(card, i, rowStart + i * rowH))
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(card.title)} competitive">
  <rect width="${W}" height="${H}" fill="${CREAM}"/>
  <rect width="${W}" height="4" fill="${GOLD}"/>
  ${logoMark(card)}
  ${kickerPill(card.kicker, W / 2, 128)}
  ${text(card.title, W / 2, 202, { size: 52, fill: INK, anchor: "middle", weight: 700 })}
  ${text(`${card.dateLabel} · ${card.market}`, W / 2, 240, { size: 20, fill: MUTED, anchor: "middle" })}
  ${whatsNewChips(card, chipY)}
  <g filter="url(#cardShadow)">
    <rect x="${CARD_X}" y="${boardY}" width="${CARD_W}" height="${boardH}" rx="32" fill="${CARD}"/>
  </g>
  ${text("TV SPEND & GRP", CARD_X + INNER, boardY + 48, { size: 13, fill: FAINT, weight: 700, spacing: 1.4 })}
  ${text("Race landscape", CARD_X + INNER, boardY + 86, { size: 32, fill: INK, weight: 700 })}
  ${buyers}
  ${text("Thick = spend  ·  Thin = GRP  ·  CPP labeled per buyer", W / 2, legendY, {
    size: 14,
    fill: FAINT,
    anchor: "middle",
  })}
  ${text(card.footer, W / 2, 1294, { size: 15, fill: MUTED, anchor: "middle", weight: 400 })}
  ${text(card.handle, W / 2, 1320, { size: 13, fill: FAINT, anchor: "middle" })}
  <defs>
    <filter id="cardShadow" x="-6%" y="-4%" width="112%" height="114%">
      <feDropShadow dx="0" dy="10" stdDeviation="18" flood-color="#1C1916" flood-opacity="0.08"/>
    </filter>
  </defs>
</svg>`;
}
