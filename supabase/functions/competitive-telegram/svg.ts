/**
 * Competitive Telegram card (1080×1350). Centered liquid-glass infographic:
 * wordmark on the field (no plate), Just in = actual new buys, then race
 * recap + still ahead on frosted panels.
 *
 * Raster: SVG → resvg PNG → JPEG q≈95 → sendPhoto.
 */
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  barWidth,
  formatGrp,
  formatSpendExact,
  formatSpendShort,
  maxGrp,
  maxSpend,
  type AheadItem,
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
    parts.push(text(buy.sponsor, cx, tileY + 72, { size: 20, fill: INK, anchor: "middle", weight: 700 }));
    parts.push(text("added", cx, tileY + 98, { size: 14, fill: MUTED, anchor: "middle" }));
    parts.push(text(formatSpendExact(buy.amount), cx, tileY + 150, { size: 40, fill: INK, anchor: "middle", weight: 700 }));
    parts.push(
      text(`in ${buy.market} ${buy.media} for ${formatGrp(buy.grp)} GRP`, cx, tileY + 186, {
        size: 15,
        fill: MUTED,
        anchor: "middle",
      }),
    );
    parts.push(text(buy.station, cx, tileY + 214, { size: 13, fill: FAINT, anchor: "middle", weight: 700, spacing: 1.2 }));
  });
  return parts.join("");
}

function buyerTile(row: BuyerRow, x: number, y: number, w: number, h: number, spendMax: number, grpMax: number): string {
  const pad = 22;
  const track = w - pad * 2;
  const spendW = barWidth(row.spend, spendMax, track);
  const grpW = barWidth(row.grp, grpMax, track);
  const barY = y + h - 42;
  return [
    glassPanel(x, y, w, h, 22),
    `<rect x="${x + 18}" y="${y + 10}" width="${w - 36}" height="4" rx="2" fill="${row.color}" opacity="0.85"/>`,
    text(row.name, x + pad, y + 48, { size: 22, fill: INK, weight: 700 }),
    text(`${formatGrp(row.grp)} GRP`, x + w - pad, y + 48, { size: 15, fill: MUTED, anchor: "end", weight: 700 }),
    text(formatSpendShort(row.spend), x + pad, y + 86, { size: 26, fill: INK, weight: 700 }),
    `<rect x="${x + pad}" y="${barY}" width="${track}" height="12" rx="6" fill="${TRACK}"/>`,
    `<rect x="${x + pad}" y="${barY}" width="${spendW}" height="12" rx="6" fill="${row.color}"/>`,
    `<rect x="${x + pad}" y="${barY + 18}" width="${track}" height="5" rx="2.5" fill="${TRACK}"/>`,
    `<rect x="${x + pad}" y="${barY + 18}" width="${grpW}" height="5" rx="2.5" fill="${row.color}" opacity="0.5"/>`,
  ].join("");
}

function raceGrid(buyers: readonly BuyerRow[], y: number): string {
  const gap = 14;
  const colW = Math.round((W - 80 - gap) / 2);
  const rowH = 156;
  const x0 = Math.round((W - (colW * 2 + gap)) / 2);
  const spendMax = maxSpend(buyers);
  const grpMax = maxGrp(buyers);
  const parts = [sectionLabel("RACE", y + 8)];
  buyers.forEach((row, i) => {
    const col = i % 2;
    const r = Math.floor(i / 2);
    parts.push(buyerTile(row, x0 + col * (colW + gap), y + 24 + r * (rowH + gap), colW, rowH, spendMax, grpMax));
  });
  return parts.join("");
}

function stillAheadRow(items: readonly AheadItem[], y: number): string {
  const n = Math.max(1, items.length);
  const gap = 12;
  const colW = Math.round((W - 80 - gap * (n - 1)) / n);
  const colH = 96;
  const x0 = Math.round((W - (colW * n + gap * (n - 1))) / 2);
  const parts = [sectionLabel("STILL AHEAD", y + 8)];
  items.forEach((item, i) => {
    const x = x0 + i * (colW + gap);
    parts.push(glassPanel(x, y + 22, colW, colH, 20));
    parts.push(text(item.line, x + colW / 2, y + 62, { size: 14, fill: INK, anchor: "middle", weight: 700 }));
    parts.push(text(item.sub, x + colW / 2, y + 86, { size: 12, fill: MUTED, anchor: "middle" }));
  });
  return parts.join("");
}

function field(): string {
  return `
  <rect width="${W}" height="${H}" fill="${CREAM}"/>
  <ellipse filter="url(#orb)" cx="220" cy="280" rx="260" ry="180" fill="#7EB6FF" opacity="0.42"/>
  <ellipse filter="url(#orb)" cx="880" cy="340" rx="240" ry="170" fill="#FF8A80" opacity="0.34"/>
  <ellipse filter="url(#orb)" cx="540" cy="980" rx="320" ry="200" fill="#C4B5FD" opacity="0.3"/>
  <ellipse filter="url(#orb)" cx="160" cy="1100" rx="180" ry="140" fill="#FFFFFF" opacity="0.35"/>
`;
}

function defs(): string {
  return `
  <defs>
    <filter id="orb" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="42"/>
    </filter>
    <filter id="glassDepth" x="-15%" y="-20%" width="130%" height="160%">
      <feDropShadow dx="0" dy="12" stdDeviation="18" flood-color="#1A1814" flood-opacity="0.12"/>
    </filter>
  </defs>`;
}

export function renderCompetitiveSvg(card: CompetitiveCard): string {
  const heroY = 208;
  const raceY = 540;
  const aheadY = 900;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Inter, sans-serif" role="img" aria-label="${esc(card.title)} just in">
  ${defs()}
  ${field()}
  ${logoMark(card)}
  ${text(card.kicker, CX, 108, { size: 12, fill: BRAND, anchor: "middle", weight: 700, spacing: 2.8 })}
  ${text(card.title, CX, 158, { size: 48, fill: INK, anchor: "middle", weight: 700 })}
  ${text(`${card.dateLabel}  ·  ${card.market}`, CX, 190, { size: 16, fill: MUTED, anchor: "middle" })}
  ${justInHero(card.justIn, heroY)}
  ${raceGrid(card.buyers, raceY)}
  ${stillAheadRow(card.stillAhead, aheadY)}
  ${text(`${card.footer}   ·   ${card.handle}`, CX, 1318, { size: 13, fill: FAINT, anchor: "middle" })}
</svg>`;
}
