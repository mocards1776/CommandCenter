/**
 * Tall post-game graphic. Sections follow the game detail page after the
 * final — score, records, linescore, win probability, team stats, box
 * leaders — and leave the live field out.
 *
 * Inline SVG (not the Tailwind game page) because the edge rasterizer cannot
 * run that React tree. Satori was a worse fit for the probability path.
 */
import type { FinalCard, FinalLeader, FinalSide, FinalStat } from "./card.ts";
import {
  CFB_QUARTER_SEC,
  CFB_REGULATION_SEC,
  cfbWinProbDomainSec,
  formatWinPct,
  isLightTeamColor,
} from "./win-probability.ts";

const W = 1080;

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeHex(color: string | null | undefined): string | null {
  const raw = (color ?? "").replace(/^#/, "").trim();
  return /^[0-9a-fA-F]{6}$/.test(raw) ? `#${raw.toLowerCase()}` : null;
}

function luminance(hex: string): number {
  const raw = hex.replace("#", "");
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * Team color that still reads on the navy card.
 * Scarlet and other dark-but-real primaries stay. Near-black (Steelers, Iowa)
 * takes the alternate so the chart is not a black slab.
 */
export function paintColor(primary: string, alternate: string | null): string {
  const main = normalizeHex(primary);
  const alt = normalizeHex(alternate);
  const mainY = main ? luminance(main) : 0;
  const altY = alt ? luminance(alt) : 0;
  if (main && mainY >= 0.18) return main;
  if (alt && altY >= 0.22) return alt;
  const base = main ?? alt;
  if (!base) return "#94a3b8";
  const raw = base.replace("#", "");
  const ch = [0, 2, 4].map((i) => parseInt(raw.slice(i, i + 2), 16));
  const lifted = ch.map((c) => Math.round(c + (255 - c) * 0.5));
  return `#${lifted.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function sideTitle(side: FinalSide): string {
  const rank = side.rank ? `#${side.rank} ` : "";
  const text = `${rank}${side.name}`;
  if (text.length <= 24) return text;
  return `${rank}${side.abbrev}`;
}

function wrap(text: string | null, max: number, limit: number): string[] {
  if (!text) return [];
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  let index = 0;
  for (; index < words.length; index++) {
    const word = words[index]!;
    const next = cur ? `${cur} ${word}` : word;
    if (next.length > max && cur) {
      lines.push(cur);
      cur = word;
      if (lines.length === limit) {
        cur = "";
        break;
      }
    } else {
      cur = next;
    }
  }
  if (cur && lines.length < limit) {
    lines.push(cur);
    index = words.length;
  }
  if (lines.length && index < words.length) {
    lines[lines.length - 1] = `${lines[lines.length - 1]!.replace(/[.,;:]?$/, "")}…`;
  }
  return lines;
}

function winner(card: FinalCard, which: "away" | "home"): boolean {
  const away = card.away.score;
  const home = card.home.score;
  if (!card.final || away == null || home == null || away === home) return false;
  return which === "away" ? away > home : home > away;
}

function centerStatus(label: string): string {
  if (/ot/i.test(label)) return "Final/OT";
  if (/final/i.test(label)) return "Final";
  return label || "Final";
}

function abbrevChip(abbrev: string, x: number, y: number): string {
  const w = Math.max(52, abbrev.length * 14 + 18);
  return [
    `<rect x="${x}" y="${y}" width="${w}" height="26" rx="6" fill="rgba(0,0,0,0.45)"/>`,
    text(abbrev, x + 9, y + 18, { size: 15, fill: "#ffffff", weight: 700, spacing: 0.8 }),
  ].join("");
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

function logo(side: FinalSide, x: number, y: number, size: number, paint: string): string {
  if (side.logoData) {
    return `<image href="${side.logoData}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  const cx = x + size / 2;
  const cy = y + size / 2;
  return [
    `<circle cx="${cx}" cy="${cy}" r="${size / 2 - 4}" fill="none" stroke="${paint}" stroke-width="3"/>`,
    text(side.abbrev, cx, cy + 8, { size: 28, fill: paint, anchor: "middle", weight: 700 }),
  ].join("");
}

function linescore(card: FinalCard, y: number, awayPaint: string, homePaint: string): { svg: string; height: number } {
  const periods = card.periods;
  const height = 132;
  const x = 48;
  const w = W - 96;
  const cols = periods.length + 1;
  const teamW = 108;
  const colW = (w - 36 - teamW) / cols;
  const headerY = y + 36;
  const rowY = [y + 74, y + 108];
  const paints = [awayPaint, homePaint];
  const sides = [card.away, card.home];
  const labels = periods.map((label, i) =>
    text(label, x + 18 + teamW + colW * i + colW / 2, headerY, {
      size: 15,
      fill: "#8b93a7",
      anchor: "middle",
      weight: 600,
      spacing: 0.6,
    }),
  );
  labels.push(
    text("T", x + 18 + teamW + colW * periods.length + colW / 2, headerY, {
      size: 15,
      fill: "#e8e4d9",
      anchor: "middle",
      weight: 700,
    }),
  );
  const rows = sides.map((side, row) => {
    const cells = periods.map((_, i) => {
      const value = side.linescores[i];
      return text(value == null ? "" : String(value), x + 18 + teamW + colW * i + colW / 2, rowY[row]!, {
        size: 22,
        fill: "#d5dae6",
        anchor: "middle",
        weight: 500,
      });
    });
    const total = side.score == null ? "" : String(side.score);
    cells.push(
      text(total, x + 18 + teamW + colW * periods.length + colW / 2, rowY[row]!, {
        size: 24,
        fill: "#f7f4ee",
        anchor: "middle",
        weight: 700,
      }),
    );
    return [
      text(side.abbrev, x + 18, rowY[row]!, { size: 20, fill: paints[row]!, anchor: "start", weight: 700, spacing: 0.8 }),
      ...cells,
    ].join("");
  });
  const svg = [
    `<rect x="${x}" y="${y}" width="${w}" height="${height}" rx="18" fill="#080e18" stroke="rgba(255,255,255,0.08)"/>`,
    ...labels,
    ...rows,
  ].join("");
  return { svg, height };
}

function winChart(
  card: FinalCard,
  x: number,
  y: number,
  w: number,
  h: number,
  awayPaint: string,
  homePaint: string,
): string {
  const points = card.winProbability;
  const domain = cfbWinProbDomainSec(points);
  const coords = points.map((point) => ({
    x: (point.elapsedSec / Math.max(domain, 1)) * w,
    y: h - (Math.max(0, Math.min(100, point.homeWinPct)) / 100) * h,
  }));
  const line = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(2)} ${c.y.toFixed(2)}`)
    .join(" ");
  const first = coords[0];
  const last = coords[coords.length - 1];
  const area =
    first && last
      ? `M${first.x.toFixed(2)} ${h} ${coords.map((c) => `L${c.x.toFixed(2)} ${c.y.toFixed(2)}`).join(" ")} L${last.x.toFixed(2)} ${h} Z`
      : "";
  const ticks: string[] = [];
  for (let q = 1; q <= 3; q++) {
    const tx = ((q * CFB_QUARTER_SEC) / domain) * w;
    ticks.push(
      `<line x1="${tx.toFixed(2)}" y1="0" x2="${tx.toFixed(2)}" y2="${h}" stroke="white" stroke-opacity="0.16" stroke-width="2"/>`,
    );
  }
  const dot = last
    ? `<circle cx="${last.x.toFixed(2)}" cy="${last.y.toFixed(2)}" r="8" fill="#f7f4ee"/>`
    : "";
  return [
    `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `<rect width="${w}" height="${h}" fill="${awayPaint}"/>`,
    area ? `<path d="${area}" fill="${homePaint}"/>` : "",
    `<line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 2}" stroke="white" stroke-opacity="0.28" stroke-width="2"/>`,
    ticks.join(""),
    line ? `<path d="${line}" fill="none" stroke="#f7f4ee" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>` : "",
    dot,
    abbrevChip(card.away.abbrev, 14, 10),
    abbrevChip(card.home.abbrev, 14, h - 36),
    `</svg>`,
  ].join("");
}

function quarterLabels(card: FinalCard, x: number, y: number, w: number): string {
  const domain = cfbWinProbDomainSec(card.winProbability);
  const labels = ["Q1", "Q2", "Q3", "Q4"].map((label, i) => {
    const cx = x + ((i + 0.5) * CFB_QUARTER_SEC * w) / domain;
    return text(label, cx, y, { size: 14, fill: "#8b93a7", anchor: "middle", weight: 600, spacing: 1.1 });
  });
  if (domain > CFB_REGULATION_SEC + 1) {
    const cx = x + (((CFB_REGULATION_SEC + domain) / 2) * w) / domain;
    labels.push(text("OT", cx, y, { size: 14, fill: "#8b93a7", anchor: "middle", weight: 600, spacing: 1.1 }));
  }
  return labels.join("");
}

function leaderBadge(card: FinalCard, awayPaint: string, homePaint: string): { label: string; fill: string; text: string } {
  const last = card.winProbability[card.winProbability.length - 1]!;
  const awayPct = Math.max(0, 100 - last.homeWinPct - (last.tiePct || 0));
  const even = Math.abs(last.homeWinPct - awayPct) < 0.05;
  if (even) {
    return { label: `EVEN ${formatWinPct(last.homeWinPct)}%`, fill: "#334155", text: "#f7f4ee" };
  }
  const homeLeads = last.homeWinPct > awayPct;
  const fill = homeLeads ? homePaint : awayPaint;
  const abbrev = homeLeads ? card.home.abbrev : card.away.abbrev;
  const pct = homeLeads ? last.homeWinPct : awayPct;
  return {
    label: `${abbrev} ${formatWinPct(pct)}%`,
    fill,
    text: isLightTeamColor(fill) ? "#140c08" : "#f7f4ee",
  };
}

function statRows(stats: FinalStat[], y: number, awayPaint: string, homePaint: string): string {
  return stats
    .map((stat, i) => {
      const top = y + i * 64;
      const awayFill = stat.awayLeads ? "#f7f4ee" : "#a8b0c2";
      const homeFill = stat.homeLeads ? "#f7f4ee" : "#a8b0c2";
      const barY = top + 36;
      const barX = 72;
      const barW = W - 144;
      const share = stat.awayShare == null ? 50 : Math.max(0, Math.min(100, stat.awayShare));
      const awayW = (share / 100) * barW;
      return [
        text(stat.away, 72, top + 24, { size: 22, fill: awayFill, weight: stat.awayLeads ? 700 : 500 }),
        text(stat.label, W / 2, top + 24, {
          size: 15,
          fill: "#8b93a7",
          anchor: "middle",
          weight: 600,
          spacing: 1.2,
        }),
        text(stat.home, W - 72, top + 24, { size: 22, fill: homeFill, anchor: "end", weight: stat.homeLeads ? 700 : 500 }),
        `<rect x="${barX}" y="${barY}" width="${barW}" height="8" rx="4" fill="rgba(255,255,255,0.06)"/>`,
        `<rect x="${barX}" y="${barY}" width="${awayW.toFixed(2)}" height="8" rx="4" fill="${awayPaint}" opacity="${stat.awayLeads ? 0.95 : 0.45}"/>`,
        `<rect x="${(barX + awayW).toFixed(2)}" y="${barY}" width="${(barW - awayW).toFixed(2)}" height="8" rx="4" fill="${homePaint}" opacity="${stat.homeLeads ? 0.95 : 0.45}"/>`,
      ].join("");
    })
    .join("");
}

function leaderBlock(leaders: FinalLeader[], y: number, awayPaint: string, homePaint: string, awayAbbrev: string): string {
  const groups: { label: string; rows: FinalLeader[] }[] = [];
  for (const row of leaders) {
    const last = groups[groups.length - 1];
    if (!last || last.label !== row.groupLabel) groups.push({ label: row.groupLabel, rows: [row] });
    else last.rows.push(row);
  }
  let cursor = y;
  const parts: string[] = [];
  for (const group of groups) {
    parts.push(
      text(group.label, 72, cursor + 18, { size: 13, fill: "#8b93a7", weight: 700, spacing: 1.6 }),
    );
    cursor += 32;
    for (const row of group.rows) {
      const paint = row.teamAbbrev === awayAbbrev ? awayPaint : homePaint;
      parts.push(text(row.teamAbbrev, 72, cursor + 22, { size: 16, fill: paint, weight: 700, spacing: 0.6 }));
      parts.push(text(row.name, 148, cursor + 22, { size: 22, fill: "#f4f0e6", weight: 600 }));
      parts.push(text(row.line, W - 72, cursor + 22, { size: 18, fill: "#c5cce0", anchor: "end", weight: 500 }));
      cursor += 40;
    }
    cursor += 10;
  }
  return parts.join("");
}

function leaderHeight(leaders: FinalLeader[]): number {
  const groups = new Set(leaders.map((row) => row.groupLabel)).size;
  return groups * 42 + leaders.length * 40 + 8;
}

export function renderFinalSvg(card: FinalCard): string {
  const awayPaint = paintColor(card.away.color, card.away.alternateColor);
  const homePaint = paintColor(card.home.color, card.home.alternateColor);
  const awayWins = winner(card, "away");
  const homeWins = winner(card, "home");
  const headline = wrap(card.headline, 52, 2);
  const parts: string[] = [];

  let y = 36;
  parts.push(
    text(centerStatus(card.statusLabel).toUpperCase(), 48, y + 22, {
      size: 22,
      fill: "#e8e4d9",
      weight: 700,
      spacing: 3.4,
    }),
  );
  const meta = [card.sportLabel, card.venue].filter(Boolean).join("  ·  ");
  parts.push(
    text(meta, W - 48, y + 22, { size: 18, fill: "#8b93a7", anchor: "end", weight: 500 }),
  );
  y += 48;

  const logoSize = 156;
  const logoY = y;
  parts.push(logo(card.away, 72, logoY, logoSize, awayPaint));
  parts.push(logo(card.home, W - 72 - logoSize, logoY, logoSize, homePaint));
  const scoreY = logoY + 104;
  parts.push(
    text(card.away.score == null ? "–" : String(card.away.score), 455, scoreY, {
      size: 100,
      fill: awayWins || !homeWins ? "#f7f4ee" : "#5c6578",
      anchor: "end",
      weight: 700,
    }),
  );
  parts.push(
    text(centerStatus(card.statusLabel), W / 2, scoreY - 10, {
      size: 20,
      fill: "#e8e4d9",
      anchor: "middle",
      weight: 700,
      spacing: 1.4,
    }),
  );
  parts.push(
    text(card.home.score == null ? "–" : String(card.home.score), 625, scoreY, {
      size: 100,
      fill: homeWins || !awayWins ? "#f7f4ee" : "#5c6578",
      anchor: "start",
      weight: 700,
    }),
  );
  y = logoY + logoSize + 36;
  parts.push(
    text(sideTitle(card.away), 72 + logoSize / 2, y, {
      size: 22,
      fill: awayWins || !homeWins ? "#f7f4ee" : "#c5cce0",
      anchor: "middle",
      weight: 700,
    }),
  );
  parts.push(
    text(sideTitle(card.home), W - 72 - logoSize / 2, y, {
      size: 22,
      fill: homeWins || !awayWins ? "#f7f4ee" : "#c5cce0",
      anchor: "middle",
      weight: 700,
    }),
  );
  y += 28;
  if (card.away.record || card.home.record) {
    if (card.away.record) {
      parts.push(
        text(card.away.record, 72 + logoSize / 2, y, {
          size: 18,
          fill: "#8b93a7",
          anchor: "middle",
          weight: 500,
        }),
      );
    }
    if (card.home.record) {
      parts.push(
        text(card.home.record, W - 72 - logoSize / 2, y, {
          size: 18,
          fill: "#8b93a7",
          anchor: "middle",
          weight: 500,
        }),
      );
    }
    y += 12;
  }
  y += 22;

  if (card.periods.length) {
    const table = linescore(card, y, awayPaint, homePaint);
    parts.push(table.svg);
    y += table.height + 22;
  }

  if (headline.length) {
    for (const line of headline) {
      y += 30;
      parts.push(text(line, 48, y, { size: 22, fill: "#d5dae6", weight: 500 }));
    }
    y += 26;
  }

  const headerBottom = y;
  if (card.winProbability.length) {
    const badge = leaderBadge(card, awayPaint, homePaint);
    const badgeW = Math.max(132, badge.label.length * 13 + 36);
    const blockH = 430;
    parts.push(
      `<rect x="48" y="${y}" width="${W - 96}" height="${blockH}" rx="22" fill="#0c1628" stroke="rgba(255,255,255,0.08)"/>`,
    );
    parts.push(
      text("Win probability", 72, y + 40, { size: 15, fill: "#e8e4d9", weight: 700, spacing: 1.8 }),
    );
    parts.push(text("ESPN", 268, y + 40, { size: 13, fill: "rgba(255,255,255,0.35)", weight: 700, spacing: 1.4 }));
    parts.push(
      `<rect x="${W - 48 - 24 - badgeW}" y="${y + 16}" width="${badgeW}" height="34" rx="8" fill="${badge.fill}"/>`,
    );
    parts.push(
      text(badge.label, W - 48 - 24 - badgeW / 2, y + 39, {
        size: 16,
        fill: badge.text,
        anchor: "middle",
        weight: 700,
        spacing: 0.4,
      }),
    );
    const chartX = 72;
    const chartY = y + 64;
    const chartW = W - 144;
    const chartH = 280;
    parts.push(
      `<clipPath id="wp"><rect x="${chartX}" y="${chartY}" width="${chartW}" height="${chartH}" rx="16"/></clipPath>`,
    );
    parts.push(`<g clip-path="url(#wp)">`);
    parts.push(winChart(card, chartX, chartY, chartW, chartH, awayPaint, homePaint));
    parts.push(`</g>`);
    parts.push(quarterLabels(card, chartX, chartY + chartH + 28, chartW));
    y += blockH + 22;
  }

  if (card.stats.length) {
    const blockH = 72 + card.stats.length * 64;
    parts.push(
      `<rect x="48" y="${y}" width="${W - 96}" height="${blockH}" rx="22" fill="#0c1628" stroke="rgba(255,255,255,0.08)"/>`,
    );
    parts.push(text("Team stats", 72, y + 40, { size: 15, fill: "#e8e4d9", weight: 700, spacing: 1.8 }));
    parts.push(text(card.away.abbrev, W / 2 - 70, y + 40, { size: 15, fill: awayPaint, anchor: "end", weight: 700, spacing: 0.8 }));
    parts.push(text(card.home.abbrev, W / 2 + 70, y + 40, { size: 15, fill: homePaint, weight: 700, spacing: 0.8 }));
    parts.push(statRows(card.stats, y + 64, awayPaint, homePaint));
    y += blockH + 22;
  }

  if (card.leaders.length) {
    const inner = leaderHeight(card.leaders);
    const blockH = 64 + inner;
    parts.push(
      `<rect x="48" y="${y}" width="${W - 96}" height="${blockH}" rx="22" fill="#0c1628" stroke="rgba(255,255,255,0.08)"/>`,
    );
    parts.push(text("Box leaders", 72, y + 40, { size: 15, fill: "#e8e4d9", weight: 700, spacing: 1.8 }));
    parts.push(leaderBlock(card.leaders, y + 64, awayPaint, homePaint, card.away.abbrev));
    y += blockH + 22;
  }

  y += 8;
  parts.push(
    text("Finals and Stats", 48, y + 22, { size: 16, fill: "#6f778a", weight: 700, spacing: 1.6 }),
  );
  parts.push(
    text(centerStatus(card.statusLabel), W - 48, y + 22, {
      size: 16,
      fill: "#6f778a",
      anchor: "end",
      weight: 600,
      spacing: 1.2,
    }),
  );
  y += 48;

  const wash = [
    `<defs>`,
    `<radialGradient id="awayWash" cx="18%" cy="22%" r="58%">`,
    `<stop offset="0%" stop-color="${awayPaint}" stop-opacity="0.5"/>`,
    `<stop offset="72%" stop-color="${awayPaint}" stop-opacity="0"/>`,
    `</radialGradient>`,
    `<radialGradient id="homeWash" cx="82%" cy="22%" r="58%">`,
    `<stop offset="0%" stop-color="${homePaint}" stop-opacity="0.5"/>`,
    `<stop offset="72%" stop-color="${homePaint}" stop-opacity="0"/>`,
    `</radialGradient>`,
    `</defs>`,
    `<rect width="${W}" height="${y}" fill="#07101d"/>`,
    `<rect width="${W / 2}" height="8" fill="${awayPaint}"/>`,
    `<rect x="${W / 2}" width="${W / 2}" height="8" fill="${homePaint}"/>`,
    `<rect width="${W}" height="${headerBottom}" fill="url(#awayWash)"/>`,
    `<rect width="${W}" height="${headerBottom}" fill="url(#homeWash)"/>`,
  ].join("");

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y}" viewBox="0 0 ${W} ${y}" font-family="Inter, sans-serif">`,
    wash,
    parts.join(""),
    `</svg>`,
  ].join("");
}
