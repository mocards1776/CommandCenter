/**
 * Post-game Telegram graphic. Sections follow the game detail page after the
 * final — score, records, linescore, win probability, team stats, box
 * leaders — and leave the live field out.
 *
 * Inline SVG (not the Tailwind game page) because the edge rasterizer cannot
 * run that React tree. Satori was a worse fit for the probability path.
 *
 * Canvas stays 1080px wide (same as heat-alert photos). Height is content-
 * driven and targets ~1080×1350 so Telegram fills the photo slot. Win
 * probability shares a row with division/conference standings when ESPN has
 * both; missing standings leave the chart full width.
 */
import { formatFinalsTimestamp, type FinalCard, type FinalLeader, type FinalSide, type FinalStat } from "./card.ts";
import type { StandingRow, StandingTable } from "./standings.ts";
import {
  CFB_QUARTER_SEC,
  CFB_REGULATION_SEC,
  cfbWinProbDomainSec,
  formatWinPct,
  isLightTeamColor,
} from "./win-probability.ts";

export const FINALS_ALERT_WIDTH = 1080;
/** Heat is 1080×1300. After #276 a full NFL card was ~1276; use the spare height. */
export const FINALS_ALERT_TARGET_HEIGHT = 1350;
const W = FINALS_ALERT_WIDTH;
const M = 36;
const GAP = 16;
const CARD_IN = 20;

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

function panel(x: number, y: number, w: number, h: number, fill = "#0c1628"): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${fill}" stroke="rgba(255,255,255,0.08)"/>`;
}

function abbrevChip(abbrev: string, x: number, y: number): string {
  const w = Math.max(58, abbrev.length * 15 + 20);
  return [
    `<rect x="${x}" y="${y}" width="${w}" height="30" rx="7" fill="rgba(0,0,0,0.5)"/>`,
    text(abbrev, x + 10, y + 21, { size: 16, fill: "#ffffff", weight: 700, spacing: 0.7 }),
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

function logo(side: FinalSide, x: number, y: number, size: number, paint: string, faded = false): string {
  const inner = side.logoData
    ? `<image href="${side.logoData}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/>`
    : [
        `<circle cx="${x + size / 2}" cy="${y + size / 2}" r="${size / 2 - 3}" fill="none" stroke="${paint}" stroke-width="4"/>`,
        text(side.abbrev, x + size / 2, y + size / 2 + 9, { size: 26, fill: paint, anchor: "middle", weight: 700 }),
      ].join("");
  return faded ? `<g opacity="0.38">${inner}</g>` : inner;
}

function loserOf(card: FinalCard, which: "away" | "home"): boolean {
  return winner(card, which === "away" ? "home" : "away");
}

function linescore(card: FinalCard, y: number, awayPaint: string, homePaint: string): { svg: string; height: number } {
  const periods = card.periods;
  const height = 118;
  const x = M;
  const w = W - M * 2;
  const cols = periods.length + 1;
  const teamW = 118;
  const colW = (w - 32 - teamW) / cols;
  const headerY = y + 34;
  const rowY = [y + 68, y + 100];
  const paints = [awayPaint, homePaint];
  const sides = [card.away, card.home];
  const labels = periods.map((label, i) =>
    text(label, x + 16 + teamW + colW * i + colW / 2, headerY, {
      size: 17,
      fill: "#8b93a7",
      anchor: "middle",
      weight: 700,
      spacing: 0.5,
    }),
  );
  labels.push(
    text("T", x + 16 + teamW + colW * periods.length + colW / 2, headerY, {
      size: 17,
      fill: "#e8e4d9",
      anchor: "middle",
      weight: 700,
    }),
  );
  const rows = sides.map((side, row) => {
    const faded = loserOf(card, row === 0 ? "away" : "home");
    const cellFill = faded ? "#8b93a7" : "#d5dae6";
    const totalFill = faded ? "#8b93a7" : "#f7f4ee";
    const cells = periods.map((_, i) => {
      const value = side.linescores[i];
      return text(value == null ? "" : String(value), x + 16 + teamW + colW * i + colW / 2, rowY[row]!, {
        size: 26,
        fill: cellFill,
        anchor: "middle",
        weight: 500,
      });
    });
    const total = side.score == null ? "" : String(side.score);
    cells.push(
      text(total, x + 16 + teamW + colW * periods.length + colW / 2, rowY[row]!, {
        size: 28,
        fill: totalFill,
        anchor: "middle",
        weight: 700,
      }),
    );
    return [
      text(side.abbrev, x + 16, rowY[row]!, {
        size: 22,
        fill: faded ? "#8b93a7" : paints[row]!,
        anchor: "start",
        weight: 700,
        spacing: 0.7,
      }),
      ...cells,
    ].join("");
  });
  const svg = [panel(x, y, w, height, "#080e18"), ...labels, ...rows].join("");
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
    line ? `<path d="${line}" fill="none" stroke="#f7f4ee" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/>` : "",
    dot,
    abbrevChip(card.away.abbrev, 12, 10),
    abbrevChip(card.home.abbrev, 12, h - 40),
    `</svg>`,
  ].join("");
}

function quarterLabels(card: FinalCard, x: number, y: number, w: number): string {
  const domain = cfbWinProbDomainSec(card.winProbability);
  const labels = ["Q1", "Q2", "Q3", "Q4"].map((label, i) => {
    const cx = x + ((i + 0.5) * CFB_QUARTER_SEC * w) / domain;
    return text(label, cx, y, { size: 16, fill: "#8b93a7", anchor: "middle", weight: 700, spacing: 1 });
  });
  if (domain > CFB_REGULATION_SEC + 1) {
    const cx = x + (((CFB_REGULATION_SEC + domain) / 2) * w) / domain;
    labels.push(text("OT", cx, y, { size: 16, fill: "#8b93a7", anchor: "middle", weight: 700, spacing: 1 }));
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

function statsHeight(count: number): number {
  return 50 + count * 50 + 10;
}

function statRows(stats: FinalStat[], x: number, y: number, w: number, awayPaint: string, homePaint: string): string {
  const inner = w - CARD_IN * 2;
  return stats
    .map((stat, i) => {
      const top = y + i * 50;
      const awayFill = stat.awayLeads ? "#f7f4ee" : "#a8b0c2";
      const homeFill = stat.homeLeads ? "#f7f4ee" : "#a8b0c2";
      const barY = top + 32;
      const barX = x + CARD_IN;
      const share = stat.awayShare == null ? 50 : Math.max(0, Math.min(100, stat.awayShare));
      const awayW = (share / 100) * inner;
      return [
        text(stat.away, barX, top + 22, { size: 22, fill: awayFill, weight: stat.awayLeads ? 700 : 500 }),
        text(stat.label, x + w / 2, top + 22, {
          size: 14,
          fill: "#8b93a7",
          anchor: "middle",
          weight: 700,
          spacing: 0.6,
        }),
        text(stat.home, barX + inner, top + 22, { size: 22, fill: homeFill, anchor: "end", weight: stat.homeLeads ? 700 : 500 }),
        `<rect x="${barX}" y="${barY}" width="${inner}" height="7" rx="3.5" fill="rgba(255,255,255,0.06)"/>`,
        `<rect x="${barX}" y="${barY}" width="${awayW.toFixed(2)}" height="7" rx="3.5" fill="${awayPaint}" opacity="${stat.awayLeads ? 0.95 : 0.45}"/>`,
        `<rect x="${(barX + awayW).toFixed(2)}" y="${barY}" width="${(inner - awayW).toFixed(2)}" height="7" rx="3.5" fill="${homePaint}" opacity="${stat.homeLeads ? 0.95 : 0.45}"/>`,
      ].join("");
    })
    .join("");
}

function leaderGroups(leaders: FinalLeader[]): { label: string; rows: FinalLeader[] }[] {
  const groups: { label: string; rows: FinalLeader[] }[] = [];
  for (const row of leaders) {
    const last = groups[groups.length - 1];
    if (!last || last.label !== row.groupLabel) groups.push({ label: row.groupLabel, rows: [row] });
    else last.rows.push(row);
  }
  return groups;
}

function leadersHeight(leaders: FinalLeader[], stacked: boolean): number {
  const groups = leaderGroups(leaders);
  const row = stacked ? 48 : 38;
  return 50 + groups.length * 24 + leaders.length * row + 12;
}

function leaderBlock(
  leaders: FinalLeader[],
  x: number,
  y: number,
  w: number,
  awayPaint: string,
  homePaint: string,
  awayAbbrev: string,
  stacked: boolean,
): string {
  const groups = leaderGroups(leaders);
  let cursor = y;
  const parts: string[] = [];
  const left = x + CARD_IN;
  const right = x + w - CARD_IN;
  for (const group of groups) {
    parts.push(text(group.label, left, cursor + 16, { size: 14, fill: "#8b93a7", weight: 700, spacing: 1.2 }));
    cursor += 24;
    for (const row of group.rows) {
      const paint = row.teamAbbrev === awayAbbrev ? awayPaint : homePaint;
      parts.push(text(row.teamAbbrev, left, cursor + 20, { size: 16, fill: paint, weight: 700, spacing: 0.5 }));
      if (stacked) {
        parts.push(text(row.name, left + 58, cursor + 20, { size: 20, fill: "#f4f0e6", weight: 700 }));
        parts.push(text(row.line, left + 58, cursor + 40, { size: 15, fill: "#c5cce0", weight: 500 }));
        cursor += 48;
      } else {
        parts.push(text(row.name, left + 62, cursor + 20, { size: 22, fill: "#f4f0e6", weight: 600 }));
        parts.push(text(row.line, right, cursor + 20, { size: 17, fill: "#c5cce0", anchor: "end", weight: 500 }));
        cursor += 38;
      }
    }
    cursor += 4;
  }
  return parts.join("");
}

function sectionTitle(label: string, x: number, y: number): string {
  return text(label, x, y, { size: 17, fill: "#e8e4d9", weight: 700, spacing: 1.2 });
}

function rowIsFocus(row: StandingRow, card: FinalCard): "away" | "home" | null {
  const away =
    (Boolean(card.away.teamId) && row.teamId === card.away.teamId) || row.abbrev === card.away.abbrev;
  const home =
    (Boolean(card.home.teamId) && row.teamId === card.home.teamId) || row.abbrev === card.home.abbrev;
  if (away) return "away";
  if (home) return "home";
  return null;
}

/** Baseline of the panel "Standings" title. Group labels start below this. */
export const STANDINGS_TITLE_DY = 36;
/** First group label ("AFC North") sits this far below the panel top. */
export const STANDINGS_GROUP_DY = 68;

function standingsHeight(tables: StandingTable[], stacked: boolean): number {
  if (!tables.length) return 0;
  const rows = tables.reduce((sum, table) => sum + table.rows.length, 0);
  const titles = tables.length;
  const rowH = stacked ? 28 : 32;
  return STANDINGS_GROUP_DY + titles * 28 + rows * rowH + (tables.length - 1) * 10 + 12;
}

function standingsBlock(
  card: FinalCard,
  tables: StandingTable[],
  x: number,
  y: number,
  w: number,
  h: number,
  awayPaint: string,
  homePaint: string,
): string {
  const parts: string[] = [];
  const inner = w - CARD_IN * 2;
  const gap = tables.length > 1 ? 10 : 0;
  const header = STANDINGS_GROUP_DY;
  const titleH = 26;
  const usable = h - header - (tables.length - 1) * gap;
  const totalRows = tables.reduce((sum, table) => sum + table.rows.length, 0);
  const rowH = Math.max(
    26,
    Math.min(58, Math.floor((usable - tables.length * titleH) / Math.max(totalRows, 1))),
  );
  let cursor = y + header;
  for (let t = 0; t < tables.length; t++) {
    const table = tables[t]!;
    const label = table.rows.length < table.total ? `${table.title} · ${table.rows.length}/${table.total}` : table.title;
    parts.push(text(label, x + CARD_IN, cursor, { size: 15, fill: "#8b93a7", weight: 700, spacing: 0.8 }));
    parts.push(
      text(table.extraLabel, x + CARD_IN + inner, cursor, {
        size: 13,
        fill: "#8b93a7",
        anchor: "end",
        weight: 700,
        spacing: 0.6,
      }),
    );
    cursor += titleH;
    for (let i = 0; i < table.rows.length; i++) {
      const row = table.rows[i]!;
      const focus = rowIsFocus(row, card);
      const paint = focus === "away" ? awayPaint : focus === "home" ? homePaint : "#8b93a7";
      const nameFill = focus ? "#f7f4ee" : "#c5cce0";
      const weight = focus ? 700 : 500;
      if (focus) {
        parts.push(
          `<rect x="${x + CARD_IN - 6}" y="${cursor - 18}" width="${inner + 12}" height="${rowH - 4}" rx="7" fill="${paint}" opacity="0.22"/>`,
        );
      }
      parts.push(text(String(row.rank || i + 1), x + CARD_IN, cursor + 4, { size: 16, fill: paint, weight: 700 }));
      parts.push(text(row.abbrev, x + CARD_IN + 28, cursor + 4, { size: 18, fill: nameFill, weight }));
      parts.push(text(row.record, x + CARD_IN + inner - 56, cursor + 4, { size: 17, fill: nameFill, anchor: "end", weight }));
      parts.push(text(row.extra || "–", x + CARD_IN + inner, cursor + 4, { size: 16, fill: "#a8b0c2", anchor: "end", weight: 500 }));
      cursor += rowH;
    }
    cursor += gap;
  }
  return parts.join("");
}

export function renderFinalSvg(card: FinalCard): string {
  const awayPaint = paintColor(card.away.color, card.away.alternateColor);
  const homePaint = paintColor(card.home.color, card.home.alternateColor);
  const awayWins = winner(card, "away");
  const homeWins = winner(card, "home");
  const awayLoses = loserOf(card, "away");
  const homeLoses = loserOf(card, "home");
  const headline = wrap(card.headline, 58, 2);
  const parts: string[] = [];
  const stamp = formatFinalsTimestamp(card.date);

  let y = 28;
  parts.push(
    text(centerStatus(card.statusLabel).toUpperCase(), M, y + 22, {
      size: 24,
      fill: "#e8e4d9",
      weight: 700,
      spacing: 3,
    }),
  );
  const meta = [card.sportLabel, card.venue].filter(Boolean).join("  ·  ");
  parts.push(text(meta, W - M, y + 22, { size: 18, fill: "#8b93a7", anchor: "end", weight: 500 }));
  y += 40;

  const logoSize = 124;
  const logoY = y;
  parts.push(logo(card.away, M + 8, logoY, logoSize, awayPaint, awayLoses));
  parts.push(logo(card.home, W - M - 8 - logoSize, logoY, logoSize, homePaint, homeLoses));
  const scoreY = logoY + 88;
  const awayScore = card.away.score == null ? "–" : String(card.away.score);
  const homeScore = card.home.score == null ? "–" : String(card.home.score);
  parts.push(
    text(awayScore, W / 2 - 62, scoreY, {
      size: 118,
      fill: awayWins || !homeWins ? "#f7f4ee" : "#5c6578",
      anchor: "end",
      weight: 700,
    }),
  );
  parts.push(
    text(centerStatus(card.statusLabel), W / 2, scoreY - 12, {
      size: 22,
      fill: "#e8e4d9",
      anchor: "middle",
      weight: 700,
      spacing: 1.2,
    }),
  );
  parts.push(
    text(homeScore, W / 2 + 62, scoreY, {
      size: 118,
      fill: homeWins || !awayWins ? "#f7f4ee" : "#5c6578",
      anchor: "start",
      weight: 700,
    }),
  );
  y = logoY + logoSize + 28;
  parts.push(
    text(sideTitle(card.away), M, y, {
      size: 24,
      fill: awayLoses ? "#8b93a7" : "#f7f4ee",
      anchor: "start",
      weight: 700,
    }),
  );
  parts.push(
    text(sideTitle(card.home), W - M, y, {
      size: 24,
      fill: homeLoses ? "#8b93a7" : "#f7f4ee",
      anchor: "end",
      weight: 700,
    }),
  );
  y += 28;
  if (card.away.record || card.home.record) {
    if (card.away.record) {
      parts.push(
        text(card.away.record, M, y, {
          size: 32,
          fill: awayLoses ? "#6f778a" : "#f7f4ee",
          anchor: "start",
          weight: 700,
        }),
      );
    }
    if (card.home.record) {
      parts.push(
        text(card.home.record, W - M, y, {
          size: 32,
          fill: homeLoses ? "#6f778a" : "#f7f4ee",
          anchor: "end",
          weight: 700,
        }),
      );
    }
    y += 16;
  }
  y += 14;

  if (card.periods.length) {
    const table = linescore(card, y, awayPaint, homePaint);
    parts.push(table.svg);
    y += table.height + GAP;
  }

  if (card.odds?.graphicLine) {
    y += 8;
    parts.push(
      text(card.odds.graphicLine, W / 2, y + 18, {
        size: 20,
        fill: "#d5dae6",
        anchor: "middle",
        weight: 700,
        spacing: 0.2,
      }),
    );
    y += 36;
  }

  if (headline.length) {
    for (const line of headline) {
      y += 30;
      parts.push(text(line, M, y, { size: 25, fill: "#d5dae6", weight: 500 }));
    }
    y += 16;
  }

  const headerBottom = y;
  const hasWp = card.winProbability.length > 0;
  const standings = (card.standings ?? []).filter((table) => table.rows.length > 0);
  const hasStandings = standings.length > 0;
  const splitWp = hasWp && hasStandings;
  const fullW = W - M * 2;
  const halfW = (fullW - GAP) / 2;

  if (hasWp || hasStandings) {
    const standH = hasStandings ? standingsHeight(standings, splitWp) : 0;
    const chartH = splitWp ? 214 : 220;
    const wpH = hasWp ? 56 + chartH + 34 : 0;
    const blockH = Math.max(wpH, standH, splitWp ? 340 : 0);
    if (hasWp) {
      const badge = leaderBadge(card, awayPaint, homePaint);
      const badgeW = Math.max(132, badge.label.length * 13 + 28);
      const wpW = splitWp ? halfW : fullW;
      const wpX = M;
      parts.push(panel(wpX, y, wpW, blockH));
      parts.push(sectionTitle("Win probability", wpX + CARD_IN, y + 36));
      if (!splitWp) {
        parts.push(text("ESPN", wpX + 196, y + 36, { size: 14, fill: "rgba(255,255,255,0.38)", weight: 700, spacing: 1.2 }));
      }
      parts.push(
        `<rect x="${wpX + wpW - CARD_IN - badgeW}" y="${y + 14}" width="${badgeW}" height="32" rx="8" fill="${badge.fill}"/>`,
      );
      parts.push(
        text(badge.label, wpX + wpW - CARD_IN - badgeW / 2, y + 36, {
          size: 15,
          fill: badge.text,
          anchor: "middle",
          weight: 700,
          spacing: 0.3,
        }),
      );
      const chartX = wpX + CARD_IN;
      const chartY = y + 50;
      const chartW = wpW - CARD_IN * 2;
      parts.push(
        `<clipPath id="wp"><rect x="${chartX}" y="${chartY}" width="${chartW}" height="${chartH}" rx="14"/></clipPath>`,
      );
      parts.push(`<g clip-path="url(#wp)">`);
      parts.push(winChart(card, chartX, chartY, chartW, chartH, awayPaint, homePaint));
      parts.push(`</g>`);
      parts.push(quarterLabels(card, chartX, chartY + chartH + 22, chartW));
    }
    if (hasStandings) {
      const stX = splitWp ? M + halfW + GAP : M;
      const stW = splitWp ? halfW : fullW;
      parts.push(panel(stX, y, stW, blockH));
      parts.push(sectionTitle("Standings", stX + CARD_IN, y + STANDINGS_TITLE_DY));
      parts.push(standingsBlock(card, standings, stX, y, stW, blockH, awayPaint, homePaint));
    }
    y += blockH + GAP;
  }

  const hasStats = card.stats.length > 0;
  const hasLeaders = card.leaders.length > 0;
  const stacked = hasStats && hasLeaders;
  const colW = stacked ? (fullW - GAP) / 2 : fullW;
  const statsH = hasStats ? statsHeight(card.stats.length) : 0;
  const boxH = hasLeaders ? leadersHeight(card.leaders, stacked) : 0;
  const colH = Math.max(statsH, boxH);

  if (hasStats) {
    const x = M;
    parts.push(panel(x, y, colW, colH));
    parts.push(text(card.away.abbrev, x + CARD_IN, y + 34, { size: 16, fill: awayPaint, weight: 700, spacing: 0.6 }));
    parts.push(text("Team stats", x + colW / 2, y + 34, { size: 17, fill: "#e8e4d9", anchor: "middle", weight: 700, spacing: 1.2 }));
    parts.push(text(card.home.abbrev, x + colW - CARD_IN, y + 34, { size: 16, fill: homePaint, anchor: "end", weight: 700, spacing: 0.6 }));
    parts.push(statRows(card.stats, x, y + 50, colW, awayPaint, homePaint));
  }

  if (hasLeaders) {
    const x = stacked ? M + colW + GAP : M;
    parts.push(panel(x, y, colW, colH));
    parts.push(sectionTitle("Box leaders", x + CARD_IN, y + 34));
    parts.push(leaderBlock(card.leaders, x, y + 50, colW, awayPaint, homePaint, card.away.abbrev, stacked));
  }

  if (hasStats || hasLeaders) y += colH + GAP;

  y += 4;
  parts.push(text(stamp, M, y + 22, { size: 18, fill: "#c5cce0", weight: 700, spacing: 0.4 }));
  parts.push(
    text(centerStatus(card.statusLabel), W - M, y + 22, {
      size: 18,
      fill: "#8b93a7",
      anchor: "end",
      weight: 700,
      spacing: 1,
    }),
  );
  y += 44;

  const wash = [
    `<defs>`,
    `<radialGradient id="awayWash" cx="18%" cy="22%" r="58%">`,
    `<stop offset="0%" stop-color="${awayPaint}" stop-opacity="${awayLoses ? 0.22 : 0.5}"/>`,
    `<stop offset="72%" stop-color="${awayPaint}" stop-opacity="0"/>`,
    `</radialGradient>`,
    `<radialGradient id="homeWash" cx="82%" cy="22%" r="58%">`,
    `<stop offset="0%" stop-color="${homePaint}" stop-opacity="${homeLoses ? 0.22 : 0.5}"/>`,
    `<stop offset="72%" stop-color="${homePaint}" stop-opacity="0"/>`,
    `</radialGradient>`,
    `</defs>`,
    `<rect width="${W}" height="${y}" fill="#07101d"/>`,
    `<rect width="${W / 2}" height="8" fill="${awayPaint}" opacity="${awayLoses ? 0.35 : 1}"/>`,
    `<rect x="${W / 2}" width="${W / 2}" height="8" fill="${homePaint}" opacity="${homeLoses ? 0.35 : 1}"/>`,
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
