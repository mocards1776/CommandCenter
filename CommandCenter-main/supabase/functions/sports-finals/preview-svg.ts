/**
 * Evening-preview Telegram graphic. Same 1080×1350 family as finals cards:
 * navy field, team-color washes, Inter, no live field.
 *
 * Lead with matchup, time, network, and one RUWT why chip. Heat stays off.
 */
import { FINALS_ALERT_TARGET_HEIGHT, FINALS_ALERT_WIDTH } from "./svg.ts";
import { printClock, type PreviewGame } from "./preview-slate.ts";

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

function logoMark(side: PreviewGame["away"], x: number, y: number, size: number): string {
  if (side.logoData) {
    return `<image href="${side.logoData}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  return [
    `<circle cx="${x + size / 2}" cy="${y + size / 2}" r="${size / 2 - 2}" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)"/>`,
    text(side.abbrev.slice(0, 3), x + size / 2, y + size / 2 + 7, {
      size: 16,
      fill: "#d5dae6",
      anchor: "middle",
      weight: 700,
    }),
  ].join("");
}

function chip(label: string, x: number, y: number): { svg: string; width: number } {
  const w = Math.min(240, Math.max(88, label.length * 9.2 + 22));
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
    const chipW = why ? Math.min(240, Math.max(88, why.length * 9.2 + 22)) : 0;
    const textMax = W - M - pad - (why ? chipW + 20 : 0) - textX;
    void textMax;
    parts.push(
      text(matchupLabel(game), textX, boxY + boxH / 2 - 6, { size: 24, fill: "#f7f4ee", weight: 700 }),
    );
    const meta = [leagueLabel(game), `${printClock(game.startIso)} CT`, game.network]
      .filter(Boolean)
      .join("  ·  ");
    parts.push(text(meta, textX, boxY + boxH / 2 + 22, { size: 16, fill: "#c5cce0", weight: 600 }));
    if (why) {
      const drawn = chip(why, W - M - pad - chipW, boxY + (boxH - 28) / 2);
      parts.push(drawn.svg);
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
