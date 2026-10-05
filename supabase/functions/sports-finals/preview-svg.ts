/**
 * Evening-preview Telegram graphic. Same 1080×1350 family as finals cards:
 * navy field, team-color washes, Inter, no live field.
 *
 * Left: logos + matchup + league/time/network. Right: records, starters or
 * a short spread, and one why chip. Logos sit on a light disc so dark marks
 * (Lightning bolt on navy) stay readable — same idea as TeamMark.
 */
import { FINALS_ALERT_TARGET_HEIGHT, FINALS_ALERT_WIDTH } from "./svg.ts";
import { printClock, recordsLine, starterLine, type PreviewGame } from "./preview-slate.ts";

export const PREVIEW_ALERT_WIDTH = FINALS_ALERT_WIDTH;
export const PREVIEW_ALERT_HEIGHT = FINALS_ALERT_TARGET_HEIGHT;

const W = PREVIEW_ALERT_WIDTH;
const H = PREVIEW_ALERT_HEIGHT;
const M = 36;

export type PreviewCard = {
  title: string;
  kicker: string;
  dateLabel: string;
  games: PreviewGame[];
};

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
  const spacing = opts.spacing ? ` letter-spacing="${opts.spacing}"` : "";
  return `<text x="${x}" y="${y}" fill="${opts.fill}" font-size="${opts.size}" font-weight="${weight}" text-anchor="${anchor}"${spacing}>${esc(value)}</text>`;
}

function matchupLabel(game: PreviewGame): string {
  const away = game.away.rank ? `#${game.away.rank} ${game.away.name}` : game.away.name;
  const home = game.home.rank ? `#${game.home.rank} ${game.home.name}` : game.home.name;
  const line = `${away} @ ${home}`;
  return line.length > 36 ? `${game.away.abbrev} @ ${game.home.abbrev}` : line;
}

function leagueLabel(game: PreviewGame): string {
  if (game.league === "Soccer") return game.competition || "Soccer";
  return game.league;
}

const LOGO_PLATE = "#f4f0e6";

function chipWidth(label: string): number {
  return Math.min(200, Math.max(88, label.length * 9.2 + 22));
}

function logoMark(side: PreviewGame["away"], x: number, y: number, size: number): string {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size / 2;
  const plate = `<circle class="logo-plate" cx="${cx}" cy="${cy}" r="${r}" fill="${LOGO_PLATE}" stroke="rgba(255,255,255,0.55)" stroke-width="1.5"/>`;
  const inset = Math.max(5, Math.round(size * 0.12));
  if (side.logoData) {
    return [
      plate,
      `<image href="${side.logoData}" x="${x + inset}" y="${y + inset}" width="${size - inset * 2}" height="${size - inset * 2}" preserveAspectRatio="xMidYMid meet"/>`,
    ].join("");
  }
  return [
    plate,
    text(side.abbrev.slice(0, 3), cx, cy + 6, {
      size: 15,
      fill: "#1a2438",
      anchor: "middle",
      weight: 700,
    }),
  ].join("");
}

function chip(label: string, x: number, y: number): { svg: string; width: number } {
  const w = chipWidth(label);
  return {
    width: w,
    svg: [
      `<rect x="${x}" y="${y}" width="${w}" height="28" rx="8" fill="#1c2a44" stroke="rgba(255,255,255,0.12)"/>`,
      text(label, x + w / 2, y + 19, { size: 13, fill: "#f7f4ee", anchor: "middle", weight: 700, spacing: 0.3 }),
    ].join(""),
  };
}

export function previewCardModel(games: PreviewGame[], dateLabel: string): PreviewCard {
  return {
    title: "Tonight's top games",
    kicker: "RUWT evening preview",
    dateLabel,
    games,
  };
}

export function renderPreviewSvg(card: PreviewCard): string {
  const games = card.games.slice(0, 8);
  const headerH = 168;
  const footerH = 56;
  const listTop = headerH + 8;
  const listH = H - listTop - footerH;
  const rowH = games.length ? Math.min(148, listH / games.length) : 0;
  const first = games[0];
  const awayWash = first?.away.color || "#1d4ed8";
  const homeWash = first?.home.color || "#be0a14";

  const parts: string[] = [];
  parts.push(text(card.kicker.toUpperCase(), M, 48, { size: 15, fill: "#8b93a7", weight: 700, spacing: 1.8 }));
  parts.push(text(card.title, M, 98, { size: 42, fill: "#f7f4ee", weight: 700 }));
  parts.push(text(card.dateLabel, M, 136, { size: 20, fill: "#c5cce0", weight: 600 }));
  parts.push(
    text(`${games.length} game${games.length === 1 ? "" : "s"}`, W - M, 136, {
      size: 16,
      fill: "#8b93a7",
      anchor: "end",
      weight: 700,
      spacing: 0.4,
    }),
  );

  games.forEach((game, i) => {
    const y = listTop + i * rowH;
    const pad = 14;
    const boxY = y + 6;
    const boxH = rowH - 12;
    parts.push(
      `<rect x="${M}" y="${boxY}" width="${W - M * 2}" height="${boxH}" rx="16" fill="#0c1628" stroke="rgba(255,255,255,0.08)"/>`,
    );
    const logo = Math.min(64, boxH - 28);
    const logoY = boxY + (boxH - logo) / 2;
    parts.push(logoMark(game.away, M + pad + 4, logoY, logo));
    parts.push(logoMark(game.home, M + pad + 4 + logo + 10, logoY, logo));
    const textX = M + pad + 4 + logo * 2 + 28;
    const why = game.why;
    const records = recordsLine(game);
    const starters = starterLine(game);
    const rightX = Math.max(textX + 340, 560);
    const mid = boxY + boxH / 2;
    const stacked = boxH >= 120 && Boolean(why && (records || starters));
    parts.push(
      text(matchupLabel(game), textX, mid - 6, { size: 24, fill: "#f7f4ee", weight: 700 }),
    );
    const meta = [leagueLabel(game), `${printClock(game.startIso)} CT`, game.network]
      .filter(Boolean)
      .join("  ·  ");
    parts.push(text(meta, textX, mid + 22, { size: 16, fill: "#c5cce0", weight: 600 }));
    const detailY = stacked ? mid - 18 : mid - 6;
    if (records) {
      parts.push(text(records, rightX, detailY, { size: 17, fill: "#f7f4ee", weight: 700 }));
    }
    if (starters) {
      parts.push(text(starters, rightX, detailY + 24, { size: 15, fill: "#c5cce0", weight: 600 }));
    }
    if (why) {
      const chipY = stacked ? detailY + 36 : mid - 14;
      parts.push(chip(why, rightX, chipY).svg);
    }
  });

  parts.push(
    text("Finals & Stats", M, H - 22, { size: 15, fill: "#8b93a7", weight: 700, spacing: 1.2 }),
  );
  parts.push(
    text("RUWT  ·  Command Center", W - M, H - 22, {
      size: 15,
      fill: "#8b93a7",
      anchor: "end",
      weight: 700,
    }),
  );

  const wash = [
    `<defs>`,
    `<radialGradient id="awayWash" cx="16%" cy="12%" r="52%">`,
    `<stop offset="0%" stop-color="${esc(awayWash)}" stop-opacity="0.42"/>`,
    `<stop offset="72%" stop-color="${esc(awayWash)}" stop-opacity="0"/>`,
    `</radialGradient>`,
    `<radialGradient id="homeWash" cx="84%" cy="12%" r="52%">`,
    `<stop offset="0%" stop-color="${esc(homeWash)}" stop-opacity="0.42"/>`,
    `<stop offset="72%" stop-color="${esc(homeWash)}" stop-opacity="0"/>`,
    `</radialGradient>`,
    `</defs>`,
    `<rect width="${W}" height="${H}" fill="#07101d"/>`,
    `<rect width="${W / 2}" height="8" fill="${esc(awayWash)}"/>`,
    `<rect x="${W / 2}" width="${W / 2}" height="8" fill="${esc(homeWash)}"/>`,
    `<rect width="${W}" height="${headerH}" fill="url(#awayWash)"/>`,
    `<rect width="${W}" height="${headerH}" fill="url(#homeWash)"/>`,
  ].join("");

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Inter, sans-serif">`,
    wash,
    parts.join(""),
    `</svg>`,
  ].join("");
}
