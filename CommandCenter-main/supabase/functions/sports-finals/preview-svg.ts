/**
 * Evening-preview Telegram graphic. Same 1080×1350 family as finals cards:
 * navy field, team-color washes, Inter, split away/home, no live field.
 *
 * Logos stay bare. Dark marks (Lightning) get the ESPN 500-dark asset plus a
 * white stroke filter — never a disc, plate, or circle behind the mark.
 */
import { FINALS_ALERT_TARGET_HEIGHT, FINALS_ALERT_WIDTH } from "./svg.ts";
import { printClock, type PreviewGame, type PreviewSide } from "./preview-slate.ts";

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

function leagueLabel(game: PreviewGame): string {
  if (game.league === "Soccer") return game.competition || "Soccer";
  return game.league;
}

function hex(color: string | null | undefined, fallback: string): string {
  const raw = (color ?? "").replace(/^#/, "").trim();
  return /^[0-9a-fA-F]{6}$/.test(raw) ? `#${raw.toLowerCase()}` : fallback;
}

function luminance(color: string): number {
  const raw = color.replace("#", "");
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function mix(color: string, toward: string, t: number): string {
  const a = color.replace("#", "");
  const b = toward.replace("#", "");
  const ch = [0, 2, 4].map((i) => {
    const x = parseInt(a.slice(i, i + 2), 16);
    const y = parseInt(b.slice(i, i + 2), 16);
    return Math.round(x + (y - x) * t);
  });
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** Accent bar that still reads on navy — lift near-black, keep real primaries. */
function accent(color: string | null | undefined, fallback: string): string {
  const main = hex(color, fallback);
  return luminance(main) < 0.18 ? mix(main, "#ffffff", 0.28) : main;
}

function sideName(side: PreviewSide): string {
  const rank = side.rank ? `#${side.rank} ` : "";
  const name = `${rank}${side.name}`;
  return name.length > 16 ? `${rank}${side.abbrev}` : name;
}

function starterRole(sport: PreviewGame["sport"]): string | null {
  if (sport === "mlb") return "P";
  if (sport === "nhl") return "G";
  return null;
}

function chipWidth(label: string): number {
  return Math.min(188, Math.max(72, label.length * 8.6 + 20));
}

function chip(label: string, x: number, y: number): { svg: string; width: number } {
  const w = chipWidth(label);
  return {
    width: w,
    svg: [
      `<rect x="${x}" y="${y}" width="${w}" height="26" rx="7" fill="#1c2a44" stroke="rgba(255,255,255,0.14)"/>`,
      text(label, x + w / 2, y + 18, { size: 12, fill: "#f7f4ee", anchor: "middle", weight: 700, spacing: 0.3 }),
    ].join(""),
  };
}

function logoMark(side: PreviewSide, x: number, y: number, size: number): string {
  if (side.logoData) {
    const stroke = side.outline ? ` class="logo-stroke" filter="url(#logoStroke)"` : "";
    return `<image${stroke} href="${side.logoData}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  return text(side.abbrev.slice(0, 3), x + size / 2, y + size / 2 + 6, {
    size: 16,
    fill: "#d5dae6",
    anchor: "middle",
    weight: 700,
  });
}

function defs(games: PreviewGame[], awayWash: string, homeWash: string): string {
  const washes = games.flatMap((game, i) => {
    const a = accent(game.away.color, "#1d4ed8");
    const h = accent(game.home.color, "#be0a14");
    return [
      `<radialGradient id="rowAway${i}" cx="12%" cy="50%" r="46%">`,
      `<stop offset="0%" stop-color="${esc(a)}" stop-opacity="0.28"/>`,
      `<stop offset="70%" stop-color="${esc(a)}" stop-opacity="0"/>`,
      `</radialGradient>`,
      `<radialGradient id="rowHome${i}" cx="88%" cy="50%" r="46%">`,
      `<stop offset="0%" stop-color="${esc(h)}" stop-opacity="0.28"/>`,
      `<stop offset="70%" stop-color="${esc(h)}" stop-opacity="0"/>`,
      `</radialGradient>`,
    ];
  });
  return [
    `<defs>`,
    `<radialGradient id="awayWash" cx="16%" cy="10%" r="54%">`,
    `<stop offset="0%" stop-color="${esc(awayWash)}" stop-opacity="0.46"/>`,
    `<stop offset="72%" stop-color="${esc(awayWash)}" stop-opacity="0"/>`,
    `</radialGradient>`,
    `<radialGradient id="homeWash" cx="84%" cy="10%" r="54%">`,
    `<stop offset="0%" stop-color="${esc(homeWash)}" stop-opacity="0.46"/>`,
    `<stop offset="72%" stop-color="${esc(homeWash)}" stop-opacity="0"/>`,
    `</radialGradient>`,
    `<filter id="logoStroke" x="-45%" y="-45%" width="190%" height="190%" color-interpolation-filters="sRGB">`,
    `<feMorphology in="SourceAlpha" operator="dilate" radius="2.2" result="dilated"/>`,
    `<feFlood flood-color="#ffffff" flood-opacity="0.92" result="white"/>`,
    `<feComposite in="white" in2="dilated" operator="in" result="stroke"/>`,
    `<feMerge>`,
    `<feMergeNode in="stroke"/>`,
    `<feMergeNode in="SourceGraphic"/>`,
    `</feMerge>`,
    `</filter>`,
    washes.join(""),
    `</defs>`,
  ].join("");
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
  const headerH = 132;
  const footerH = 46;
  const listTop = headerH + 6;
  const listH = H - listTop - footerH;
  const rowH = games.length ? Math.min(192, listH / games.length) : 0;
  const first = games[0];
  const awayWash = accent(first?.away.color, "#1d4ed8");
  const homeWash = accent(first?.home.color, "#be0a14");
  const roomy = rowH >= 168;

  const parts: string[] = [];
  parts.push(text(card.kicker.toUpperCase(), M, 42, { size: 14, fill: "#8b93a7", weight: 700, spacing: 2.2 }));
  parts.push(
    text(`${games.length} GAME${games.length === 1 ? "" : "S"}`, W - M, 42, {
      size: 14,
      fill: "#8b93a7",
      anchor: "end",
      weight: 700,
      spacing: 1.6,
    }),
  );
  parts.push(text(card.title, M, 88, { size: 44, fill: "#f7f4ee", weight: 700 }));
  parts.push(text(card.dateLabel, M, 120, { size: 18, fill: "#c5cce0", weight: 600 }));
  parts.push(`<rect x="${M}" y="${headerH - 2}" width="${W - M * 2}" height="1" fill="rgba(255,255,255,0.1)"/>`);

  games.forEach((game, i) => {
    const y = listTop + i * rowH;
    const boxY = y + 5;
    const boxH = rowH - 10;
    const awayPaint = accent(game.away.color, "#3b82f6");
    const homePaint = accent(game.home.color, "#ef4444");
    const innerX = M + 8;
    const innerW = W - M * 2 - 16;
    parts.push(
      `<rect x="${innerX}" y="${boxY}" width="${innerW}" height="${boxH}" rx="16" fill="#0c1628" stroke="rgba(255,255,255,0.08)"/>`,
    );
    parts.push(`<rect x="${innerX}" y="${boxY}" width="${innerW}" height="${boxH}" rx="16" fill="url(#rowAway${i})"/>`);
    parts.push(`<rect x="${innerX}" y="${boxY}" width="${innerW}" height="${boxH}" rx="16" fill="url(#rowHome${i})"/>`);
    parts.push(`<rect x="${innerX}" y="${boxY + 14}" width="5" height="${boxH - 28}" rx="2.5" fill="${esc(awayPaint)}"/>`);
    parts.push(
      `<rect x="${innerX + innerW - 5}" y="${boxY + 14}" width="5" height="${boxH - 28}" rx="2.5" fill="${esc(homePaint)}"/>`,
    );

    const logo = Math.min(roomy ? 68 : 54, boxH - (roomy ? 52 : 36));
    const logoY = boxY + (roomy ? 18 : 14);
    const awayLogoX = innerX + 20;
    const homeLogoX = innerX + innerW - 20 - logo;
    parts.push(logoMark(game.away, awayLogoX, logoY, logo));
    parts.push(logoMark(game.home, homeLogoX, logoY, logo));

    const awayTx = awayLogoX + logo + 14;
    const homeTx = homeLogoX - 14;
    const nameY = logoY + (roomy ? 28 : 22);
    const recY = nameY + (roomy ? 26 : 22);
    const startY = recY + (roomy ? 24 : 20);
    parts.push(text(sideName(game.away), awayTx, nameY, { size: roomy ? 26 : 22, fill: "#f7f4ee", weight: 700 }));
    parts.push(text(sideName(game.home), homeTx, nameY, { size: roomy ? 26 : 22, fill: "#f7f4ee", weight: 700, anchor: "end" }));
    if (game.away.record) {
      parts.push(text(game.away.record, awayTx, recY, { size: roomy ? 20 : 17, fill: "#e8e4d9", weight: 700 }));
    }
    if (game.home.record) {
      parts.push(text(game.home.record, homeTx, recY, { size: roomy ? 20 : 17, fill: "#e8e4d9", weight: 700, anchor: "end" }));
    }
    const role = starterRole(game.sport);
    if (game.probableAway) {
      const line = role ? `${role}  ${game.probableAway}` : game.probableAway;
      parts.push(text(line, awayTx, startY, { size: 14, fill: "#c5cce0", weight: 600 }));
    }
    if (game.probableHome) {
      const line = role ? `${role}  ${game.probableHome}` : game.probableHome;
      parts.push(text(line, homeTx, startY, { size: 14, fill: "#c5cce0", weight: 600, anchor: "end" }));
    }

    const midX = W / 2;
    const clock = `${printClock(game.startIso)} CT`;
    parts.push(text(clock, midX, boxY + (roomy ? 48 : 40), { size: roomy ? 28 : 22, fill: "#f7f4ee", anchor: "middle", weight: 700 }));
    const meta = [leagueLabel(game), game.network].filter(Boolean).join("  ·  ");
    parts.push(text(meta, midX, boxY + (roomy ? 74 : 62), { size: 14, fill: "#c5cce0", anchor: "middle", weight: 700, spacing: 0.4 }));

    const chips: string[] = [];
    if (game.why) chips.push(game.why);
    if (game.oddsLine && game.sport !== "mlb" && game.sport !== "nhl") chips.push(game.oddsLine);
    const chipY = boxY + (roomy ? 92 : 78);
    if (chips.length === 1) {
      const w = chipWidth(chips[0]!);
      parts.push(chip(chips[0]!, midX - w / 2, chipY).svg);
    } else if (chips.length > 1) {
      const widths = chips.map(chipWidth);
      const total = widths.reduce((s, w) => s + w, 0) + 8 * (chips.length - 1);
      let x = midX - total / 2;
      chips.forEach((label, idx) => {
        const drawn = chip(label, x, chipY);
        parts.push(drawn.svg);
        x += widths[idx]! + 8;
      });
    }

    parts.push(
      text(String(i + 1).padStart(2, "0"), midX, boxY + boxH - 12, {
        size: 11,
        fill: "#5c6578",
        anchor: "middle",
        weight: 700,
        spacing: 1.4,
      }),
    );
  });

  parts.push(text("Finals & Stats", M, H - 18, { size: 14, fill: "#8b93a7", weight: 700, spacing: 1.2 }));
  parts.push(
    text("RUWT  ·  Command Center", W - M, H - 18, {
      size: 14,
      fill: "#8b93a7",
      anchor: "end",
      weight: 700,
    }),
  );

  const field = [
    defs(games, awayWash, homeWash),
    `<rect width="${W}" height="${H}" fill="#07101d"/>`,
    `<rect width="${W / 2}" height="8" fill="${esc(awayWash)}"/>`,
    `<rect x="${W / 2}" width="${W / 2}" height="8" fill="${esc(homeWash)}"/>`,
    `<rect width="${W}" height="${headerH}" fill="url(#awayWash)"/>`,
    `<rect width="${W}" height="${headerH}" fill="url(#homeWash)"/>`,
  ].join("");

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Inter, sans-serif">`,
    field,
    parts.join(""),
    `</svg>`,
  ].join("");
}
