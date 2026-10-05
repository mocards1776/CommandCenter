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
import {
  formatFinalsTimestamp,
  type FinalCard,
  type FinalLeader,
  type FinalPlayer,
  type FinalSide,
  type FinalStar,
  type FinalStat,
  type MlbBox,
  type MlbBoxSide,
} from "./card.ts";
import {
  mlbInningLabels,
  mlbInningTicks,
  mlbWinProbDomain,
} from "./mlb-win-probability.ts";
import type { StandingRow, StandingTable } from "./standings.ts";
import {
  CFB_QUARTER_SEC,
  CFB_REGULATION_SEC,
  cfbWinProbDomainSec,
  formatWinPct,
  isLightTeamColor,
} from "./win-probability.ts";

export const FINALS_ALERT_WIDTH = 1080;
/** Heat is 1080×1350. Keep finals in the same Telegram photo slot. */
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

function sideTitleLines(side: FinalSide): string[] {
  const rank = side.rank ? `#${side.rank} ` : "";
  const text = `${rank}${side.name}`;
  if (text.length <= 20) return [text];
  const wrapped = wrap(text, 18, 2);
  return wrapped.length ? wrapped : [side.abbrev];
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

function logoHaloFilter(): string {
  return [
    `<filter id="logoHalo" x="-28%" y="-28%" width="156%" height="156%">`,
    `<feMorphology in="SourceAlpha" operator="dilate" radius="2.4" result="spread"/>`,
    `<feFlood flood-color="#f7f4ee" flood-opacity="0.92" result="haloColor"/>`,
    `<feComposite in="haloColor" in2="spread" operator="in" result="halo"/>`,
    `<feGaussianBlur in="halo" stdDeviation="1.15" result="soft"/>`,
    `<feMerge><feMergeNode in="soft"/><feMergeNode in="halo"/><feMergeNode in="SourceGraphic"/></feMerge>`,
    `</filter>`,
  ].join("");
}

function logo(side: FinalSide, x: number, y: number, size: number, paint: string, faded = false): string {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const disc = `<circle cx="${cx}" cy="${cy}" r="${size / 2 - 1}" fill="rgba(247,244,238,0.16)"/>`;
  const inner = side.logoData
    ? `<image href="${side.logoData}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet" filter="url(#logoHalo)"/>`
    : [
        `<circle cx="${cx}" cy="${cy}" r="${size / 2 - 3}" fill="none" stroke="${paint}" stroke-width="4"/>`,
        text(side.abbrev, cx, cy + 9, { size: 26, fill: paint, anchor: "middle", weight: 700 }),
      ].join("");
  const mark = `${disc}${inner}`;
  return faded ? `<g opacity="0.38">${mark}</g>` : mark;
}

function loserOf(card: FinalCard, which: "away" | "home"): boolean {
  return winner(card, which === "away" ? "home" : "away");
}

function linescore(card: FinalCard, y: number, awayPaint: string, homePaint: string): { svg: string; height: number } {
  const periods = card.periods;
  const rhe = card.away.hits != null || card.home.hits != null || card.away.errors != null || card.home.errors != null;
  const extras = rhe ? (["H", "E"] as const) : [];
  const height = 118;
  const x = M;
  const w = W - M * 2;
  const cols = periods.length + 1 + extras.length;
  const teamW = 108;
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
    text(rhe ? "R" : "T", x + 16 + teamW + colW * periods.length + colW / 2, headerY, {
      size: 17,
      fill: "#e8e4d9",
      anchor: "middle",
      weight: 700,
    }),
  );
  extras.forEach((label, i) => {
    labels.push(
      text(label, x + 16 + teamW + colW * (periods.length + 1 + i) + colW / 2, headerY, {
        size: 17,
        fill: "#8b93a7",
        anchor: "middle",
        weight: 700,
      }),
    );
  });
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
    const extraVals = extras.map((key) => (key === "H" ? side.hits : side.errors));
    extraVals.forEach((value, i) => {
      cells.push(
        text(value == null ? "" : String(value), x + 16 + teamW + colW * (periods.length + 1 + i) + colW / 2, rowY[row]!, {
          size: 22,
          fill: cellFill,
          anchor: "middle",
          weight: 600,
        }),
      );
    });
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
  const domain = card.sport === "mlb" ? mlbWinProbDomain(points) : cfbWinProbDomainSec(points);
  const coords = points.map((point) => ({
    x: (point.elapsedSec / Math.max(domain, 1)) * w,
    y: h - (Math.max(0, Math.min(100, point.homeWinPct)) / 100) * h,
  }));
  const line = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(2)} ${c.y.toFixed(2)}`)
    .join(" ");
  const first = coords[0];
  const last = coords[coords.length - 1];
  const nowX = last ? last.x : 0;
  const future = nowX < w * 0.992;
  const area =
    first && last
      ? `M${first.x.toFixed(2)} ${h} ${coords.map((c) => `L${c.x.toFixed(2)} ${c.y.toFixed(2)}`).join(" ")} L${last.x.toFixed(2)} ${h} Z`
      : "";
  const tickAt = card.sport === "mlb" ? mlbInningTicks(domain) : [1, 2, 3].map((q) => q * CFB_QUARTER_SEC);
  const ticks = tickAt.map((t) => {
    const tx = (t / domain) * w;
    return `<line x1="${tx.toFixed(2)}" y1="0" x2="${tx.toFixed(2)}" y2="${h}" stroke="white" stroke-opacity="0.16" stroke-width="2"/>`;
  });
  const dot = last
    ? `<circle cx="${last.x.toFixed(2)}" cy="${last.y.toFixed(2)}" r="8" fill="#f7f4ee"/>`
    : "";
  const futureLine =
    future && last
      ? `<path d="M${last.x.toFixed(2)} ${last.y.toFixed(2)} L${w} ${last.y.toFixed(2)}" fill="none" stroke="#f7f4ee" stroke-opacity="0.35" stroke-width="3" stroke-dasharray="8 7"/>`
      : "";
  const nowMark = future
    ? `<line x1="${nowX.toFixed(2)}" y1="0" x2="${nowX.toFixed(2)}" y2="${h}" stroke="#f7f4ee" stroke-opacity="0.45" stroke-width="2"/>`
    : "";
  return [
    `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `<clipPath id="wpHist"><rect x="0" y="0" width="${Math.max(0, nowX).toFixed(2)}" height="${h}"/></clipPath>`,
    `<rect width="${w}" height="${h}" fill="#0b1220"/>`,
    `<g clip-path="url(#wpHist)">`,
    `<rect width="${w}" height="${h}" fill="${awayPaint}"/>`,
    area ? `<path d="${area}" fill="${homePaint}"/>` : "",
    `</g>`,
    futureLine,
    nowMark,
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
  if (card.sport === "mlb") {
    const domain = mlbWinProbDomain(card.winProbability);
    return mlbInningLabels(domain)
      .map((row) =>
        text(row.label, x + (row.at * w) / domain, y, {
          size: 16,
          fill: "#8b93a7",
          anchor: "middle",
          weight: 700,
          spacing: 1,
        }),
      )
      .join("");
  }
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

function statsHeight(count: number, roomy = false): number {
  return 50 + count * (roomy ? 58 : 50) + 10;
}

function statRows(
  stats: FinalStat[],
  x: number,
  y: number,
  w: number,
  awayPaint: string,
  homePaint: string,
  roomy = false,
): string {
  const inner = w - CARD_IN * 2;
  const rowH = roomy ? 58 : 50;
  const valueSize = roomy ? 26 : 22;
  const labelSize = roomy ? 16 : 14;
  return stats
    .map((stat, i) => {
      const top = y + i * rowH;
      const awayFill = stat.awayLeads ? "#f7f4ee" : "#c5cce0";
      const homeFill = stat.homeLeads ? "#f7f4ee" : "#c5cce0";
      const barY = top + (roomy ? 36 : 32);
      const barX = x + CARD_IN;
      const share = stat.awayShare == null ? 50 : Math.max(0, Math.min(100, stat.awayShare));
      const awayW = (share / 100) * inner;
      return [
        text(stat.away, barX, top + 22, { size: valueSize, fill: awayFill, weight: stat.awayLeads ? 700 : 500 }),
        text(stat.label, x + w / 2, top + 22, {
          size: labelSize,
          fill: roomy ? "#a8b0c2" : "#8b93a7",
          anchor: "middle",
          weight: 700,
          spacing: 0.6,
        }),
        text(stat.home, barX + inner, top + 22, { size: valueSize, fill: homeFill, anchor: "end", weight: stat.homeLeads ? 700 : 500 }),
        `<rect x="${barX}" y="${barY}" width="${inner}" height="${roomy ? 8 : 7}" rx="3.5" fill="rgba(255,255,255,0.06)"/>`,
        `<rect x="${barX}" y="${barY}" width="${awayW.toFixed(2)}" height="${roomy ? 8 : 7}" rx="3.5" fill="${awayPaint}" opacity="${stat.awayLeads ? 0.95 : 0.45}"/>`,
        `<rect x="${(barX + awayW).toFixed(2)}" y="${barY}" width="${(inner - awayW).toFixed(2)}" height="${roomy ? 8 : 7}" rx="3.5" fill="${homePaint}" opacity="${stat.homeLeads ? 0.95 : 0.45}"/>`,
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

function standingsHeight(tables: StandingTable[], stacked: boolean, roomy = false): number {
  if (!tables.length) return 0;
  const rows = tables.reduce((sum, table) => sum + table.rows.length, 0);
  const titles = tables.length;
  const rowH = roomy ? (stacked ? 34 : 38) : stacked ? 28 : 32;
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
    card.sport === "nhl" ? 32 : 26,
    Math.min(58, Math.floor((usable - tables.length * titleH) / Math.max(totalRows, 1))),
  );
  let cursor = y + header;
  for (let t = 0; t < tables.length; t++) {
    const table = tables[t]!;
    const label = table.rows.length < table.total ? `${table.title} · ${table.rows.length}/${table.total}` : table.title;
    const roomy = card.sport === "nhl";
    parts.push(text(label, x + CARD_IN, cursor, { size: roomy ? 17 : 15, fill: "#a8b0c2", weight: 700, spacing: 0.8 }));
    parts.push(
      text(table.extraLabel, x + CARD_IN + inner, cursor, {
        size: roomy ? 15 : 13,
        fill: "#a8b0c2",
        anchor: "end",
        weight: 700,
        spacing: 0.6,
      }),
    );
    cursor += titleH;
    for (let i = 0; i < table.rows.length; i++) {
      const row = table.rows[i]!;
      const focus = rowIsFocus(row, card);
      const paint = focus === "away" ? awayPaint : focus === "home" ? homePaint : "#a8b0c2";
      const nameFill = focus ? "#f7f4ee" : "#d5dae6";
      const weight = focus ? 700 : 500;
      if (focus) {
        parts.push(
          `<rect x="${x + CARD_IN - 6}" y="${cursor - 18}" width="${inner + 12}" height="${rowH - 4}" rx="7" fill="${paint}" opacity="0.22"/>`,
        );
      }
      parts.push(text(String(row.rank || i + 1), x + CARD_IN, cursor + 4, { size: roomy ? 18 : 16, fill: paint, weight: 700 }));
      parts.push(text(row.abbrev, x + CARD_IN + 32, cursor + 4, { size: roomy ? 21 : 18, fill: nameFill, weight }));
      const extraW = table.extraLabel ? 52 : 0;
      parts.push(
        text(row.record, x + CARD_IN + inner - extraW, cursor + 4, {
          size: roomy ? 20 : 17,
          fill: nameFill,
          anchor: "end",
          weight,
        }),
      );
      if (table.extraLabel) {
        parts.push(
          text(row.extra || "–", x + CARD_IN + inner, cursor + 4, {
            size: roomy ? 18 : 16,
            fill: "#c5cce0",
            anchor: "end",
            weight: 500,
          }),
        );
      }
      cursor += rowH;
    }
    cursor += gap;
  }
  return parts.join("");
}

let photoClip = 0;

function playerPhoto(
  photo: string | null | undefined,
  x: number,
  y: number,
  size: number,
  fallback: string,
  ring?: string | null,
): string {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size / 2;
  const parts: string[] = [];
  if (photo) {
    photoClip += 1;
    const id = `ph${photoClip}`;
    parts.push(`<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>`);
    parts.push(
      `<image href="${photo}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`,
    );
  } else {
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(255,255,255,0.08)"/>`);
    parts.push(
      text(fallback.slice(0, 1), cx, cy + 8, {
        size: Math.max(16, Math.round(size * 0.28)),
        fill: "#c5cce0",
        anchor: "middle",
        weight: 700,
      }),
    );
  }
  if (ring) {
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${r + 2.5}" fill="none" stroke="${ring}" stroke-width="3.5"/>`);
  }
  return parts.join("");
}

function medalStarIcon(cx: number, cy: number, r: number, fill: string): string {
  const pts: string[] = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const ia = a + Math.PI / 5;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`);
    pts.push(`${(cx + Math.cos(ia) * r * 0.42).toFixed(1)},${(cy + Math.sin(ia) * r * 0.42).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(" ")}" fill="${fill}"/>`;
}

function starStatCells(star: FinalStar): { value: string; label: string }[] {
  if (star.position === "G") {
    const cells: { value: string; label: string }[] = [];
    if (star.savePctg != null) cells.push({ value: star.savePctg.toFixed(3).replace(/^0/, ""), label: "SV%" });
    if (star.gaa != null) cells.push({ value: star.gaa.toFixed(2), label: "GAA" });
    if (cells.length) return cells;
  }
  const g = star.goals ?? 0;
  const a = star.assists ?? 0;
  const p = star.points ?? g + a;
  return [
    { value: String(g), label: "G" },
    { value: String(a), label: "A" },
    { value: String(p), label: "P" },
  ];
}

function sideLogoMark(side: FinalSide, cx: number, y: number, size: number, paint: string, anchor: "start" | "end"): string {
  const x = anchor === "end" ? cx - size : cx;
  if (side.logoData) {
    return `<image href="${side.logoData}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet" filter="url(#logoHalo)"/>`;
  }
  return text(side.abbrev, anchor === "end" ? cx : cx, y + size - 8, {
    size: 16,
    fill: paint,
    anchor,
    weight: 700,
    spacing: 0.4,
  });
}

function starsHeight(stars: FinalStar[]): number {
  if (!stars.length) return 0;
  return 356;
}

function starsBlock(
  stars: FinalStar[],
  card: FinalCard,
  x: number,
  y: number,
  w: number,
  awayPaint: string,
  homePaint: string,
): string {
  const order = [2, 1, 3]
    .map((n) => stars.find((row) => row.star === n))
    .filter((row): row is FinalStar => Boolean(row));
  const inner = w - CARD_IN * 2;
  const colW = inner / Math.max(order.length, 1);
  const parts = [
    sectionTitle("Three Stars", x + CARD_IN, y + 34),
    text("NHL official", x + w - CARD_IN, y + 34, {
      size: 13,
      fill: "#8b93a7",
      anchor: "end",
      weight: 700,
      spacing: 1.4,
    }),
  ];
  order.forEach((star, i) => {
    const first = star.star === 1;
    const medal = star.star === 1 ? "#f5c84c" : star.star === 2 ? "#d4dae6" : "#d9925a";
    const paint = star.teamAbbrev === card.away.abbrev ? awayPaint : star.teamAbbrev === card.home.abbrev ? homePaint : medal;
    const side = star.teamAbbrev === card.away.abbrev ? card.away : star.teamAbbrev === card.home.abbrev ? card.home : null;
    const colX = x + CARD_IN + colW * i;
    const cx = colX + colW / 2;
    const lift = first ? 0 : 20;
    const cardY = y + 48 + lift;
    const cardH = first ? 292 : 272;
    const photo = first ? 96 : 80;
    parts.push(
      `<rect x="${colX + 4}" y="${cardY}" width="${colW - 8}" height="${cardH}" rx="12" fill="#0a1424" stroke="${medal}" stroke-opacity="0.45"/>`,
    );
    parts.push(
      `<ellipse cx="${cx}" cy="${cardY + 8}" rx="${colW * 0.38}" ry="36" fill="${medal}" opacity="0.16"/>`,
    );
    const starCount = 4 - star.star;
    const starR = first ? 6.5 : 5.5;
    const starGap = first ? 16 : 14;
    const starsW = (starCount - 1) * starGap;
    for (let s = 0; s < starCount; s++) {
      parts.push(medalStarIcon(cx - starsW / 2 + s * starGap, cardY + 22, starR, medal));
    }
    const medalLabel = star.star === 1 ? "1ST STAR" : star.star === 2 ? "2ND STAR" : "3RD STAR";
    parts.push(
      text(medalLabel, cx, cardY + 42, { size: 13, fill: medal, anchor: "middle", weight: 700, spacing: 1.8 }),
    );
    const photoY = cardY + 54;
    parts.push(playerPhoto(star.photoData, cx - photo / 2, photoY, photo, star.name, medal));
    if (side?.logoData) {
      const badge = 26;
      parts.push(
        `<circle cx="${cx + photo / 2 - 4}" cy="${photoY + photo - 4}" r="${badge / 2 + 2}" fill="#0a1424"/>`,
      );
      parts.push(
        `<image href="${side.logoData}" x="${cx + photo / 2 - 4 - badge / 2}" y="${photoY + photo - 4 - badge / 2}" width="${badge}" height="${badge}" preserveAspectRatio="xMidYMid meet"/>`,
      );
    }
    parts.push(
      text(star.name, cx, photoY + photo + 26, {
        size: first ? 22 : 20,
        fill: "#f7f4ee",
        anchor: "middle",
        weight: 700,
      }),
    );
    const meta = [star.teamAbbrev, star.sweaterNo ? `#${star.sweaterNo}` : null, star.position]
      .filter(Boolean)
      .join("  ·  ");
    if (meta) {
      parts.push(text(meta, cx, photoY + photo + 46, { size: 14, fill: "#c5cce0", anchor: "middle", weight: 600, spacing: 0.6 }));
    }
    const cells = starStatCells(star);
    const statY = photoY + photo + 86;
    const statGap = cells.some((c) => c.value.length > 3) ? 52 : 44;
    const statsW = (cells.length - 1) * statGap;
    cells.forEach((cell, idx) => {
      const sx = cx - statsW / 2 + idx * statGap;
      parts.push(
        text(cell.value, sx, statY, {
          size: first ? 28 : 24,
          fill: "#f7f4ee",
          anchor: "middle",
          weight: 700,
        }),
      );
      parts.push(text(cell.label, sx, statY + 18, { size: 12, fill: paint, anchor: "middle", weight: 700, spacing: 1.2 }));
    });
  });
  return parts.join("");
}

function peopleHeight(_title: string, rows: FinalPlayer[], roomy = false): number {
  if (!rows.length) return 0;
  return 54 + rows.length * (roomy ? 66 : 56) + 12;
}

function peopleBlock(
  title: string,
  rows: FinalPlayer[],
  x: number,
  y: number,
  w: number,
  awayPaint: string,
  homePaint: string,
  awayAbbrev: string,
  roomy = false,
): string {
  const parts = [sectionTitle(title, x + CARD_IN, y + 34)];
  let cursor = y + 50;
  const photo = roomy ? 48 : 40;
  const rowH = roomy ? 66 : 56;
  for (const row of rows) {
    const paint = row.teamAbbrev === awayAbbrev ? awayPaint : homePaint;
    parts.push(playerPhoto(row.photoData, x + CARD_IN, cursor, photo, row.name));
    parts.push(text(row.name, x + CARD_IN + photo + 14, cursor + (roomy ? 20 : 18), { size: roomy ? 23 : 20, fill: "#f7f4ee", weight: 700 }));
    parts.push(text(row.line, x + CARD_IN + photo + 14, cursor + (roomy ? 44 : 40), { size: roomy ? 18 : 15, fill: paint, weight: 600 }));
    cursor += rowH;
  }
  return parts.join("");
}

function performersHeight(rows: FinalLeader[]): number {
  if (!rows.length) return 0;
  return 128;
}

function performersBlock(
  rows: FinalLeader[],
  card: FinalCard,
  x: number,
  y: number,
  w: number,
  awayPaint: string,
  homePaint: string,
): string {
  const inner = w - CARD_IN * 2;
  const colW = inner / Math.max(rows.length, 1);
  const parts = [sectionTitle("Key performers", x + CARD_IN, y + 32)];
  rows.forEach((row, i) => {
    const cx = x + CARD_IN + colW * i;
    const paint = row.teamAbbrev === card.away.abbrev ? awayPaint : homePaint;
    parts.push(playerPhoto(row.photoData, cx, y + 48, 44, row.name));
    parts.push(text(row.name, cx + 54, y + 68, { size: 18, fill: "#f7f4ee", weight: 700 }));
    parts.push(text(row.line || row.groupLabel, cx + 54, y + 90, { size: 15, fill: paint, weight: 600 }));
    parts.push(text(row.teamAbbrev, cx + 54, y + 110, { size: 13, fill: "#a8b0c2", weight: 700, spacing: 0.6 }));
  });
  return parts.join("");
}

const MLB_ROW_H = 22;

function mlbBoxHeight(box: MlbBox): number {
  const bat = Math.max(box.batting.away.rows.length, box.batting.home.rows.length);
  const pit = Math.max(box.pitching.away.rows.length, box.pitching.home.rows.length);
  const header = 64;
  return header + (bat + 1) * MLB_ROW_H + 28 + (pit + 1) * MLB_ROW_H + 12;
}

function mlbSideTable(side: MlbBoxSide, x: number, y: number, w: number, paint: string, title: string): string {
  const cols = side.labels;
  const nameW = Math.max(118, w * 0.34);
  const colW = (w - nameW) / Math.max(cols.length, 1);
  const parts = [
    text(title, x, y, { size: 14, fill: paint, weight: 700, spacing: 0.6 }),
    text(side.abbrev, x + w, y, { size: 14, fill: "#8b93a7", anchor: "end", weight: 700 }),
  ];
  const headY = y + 20;
  parts.push(text("Player", x, headY, { size: 12, fill: "#8b93a7", weight: 700 }));
  cols.forEach((label, i) => {
    parts.push(
      text(label, x + nameW + colW * i + colW / 2, headY, {
        size: 12,
        fill: "#8b93a7",
        anchor: "middle",
        weight: 700,
      }),
    );
  });
  side.rows.forEach((row, r) => {
    const ry = headY + MLB_ROW_H + r * MLB_ROW_H;
    const label = row.pos ? `${row.name}, ${row.pos}` : row.name;
    parts.push(text(label.length > 18 ? row.name : label, x, ry, { size: 14, fill: "#f4f0e6", weight: 500 }));
    row.cells.forEach((cell, i) => {
      parts.push(
        text(cell, x + nameW + colW * i + colW / 2, ry, {
          size: 15,
          fill: "#d5dae6",
          anchor: "middle",
          weight: 500,
        }),
      );
    });
  });
  return parts.join("");
}

function mlbBoxBlock(box: MlbBox, x: number, y: number, w: number, awayPaint: string, homePaint: string): string {
  const half = (w - GAP) / 2;
  const batH = 32 + (Math.max(box.batting.away.rows.length, box.batting.home.rows.length) + 1) * MLB_ROW_H;
  const parts = [
    sectionTitle("Box score", x + CARD_IN, y + 34),
    mlbSideTable(box.batting.away, x + CARD_IN, y + 56, half - CARD_IN, awayPaint, "Batting"),
    mlbSideTable(box.batting.home, x + CARD_IN + half + GAP, y + 56, half - CARD_IN, homePaint, "Batting"),
    mlbSideTable(box.pitching.away, x + CARD_IN, y + 56 + batH, half - CARD_IN, awayPaint, "Pitching"),
    mlbSideTable(
      box.pitching.home,
      x + CARD_IN + half + GAP,
      y + 56 + batH,
      half - CARD_IN,
      homePaint,
      "Pitching",
    ),
  ];
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
  const awayNames = sideTitleLines(card.away);
  const homeNames = sideTitleLines(card.home);
  const nameLines = Math.max(awayNames.length, homeNames.length);
  for (let i = 0; i < nameLines; i++) {
    if (awayNames[i]) {
      parts.push(
        text(awayNames[i]!, M, y, {
          size: 26,
          fill: awayLoses ? "#8b93a7" : "#f7f4ee",
          anchor: "start",
          weight: 700,
        }),
      );
    }
    if (homeNames[i]) {
      parts.push(
        text(homeNames[i]!, W - M, y, {
          size: 26,
          fill: homeLoses ? "#8b93a7" : "#f7f4ee",
          anchor: "end",
          weight: 700,
        }),
      );
    }
    y += 30;
  }
  if (card.playoff && card.seriesLine) {
    parts.push(
      text(card.seriesLine, W / 2, y + 4, {
        size: 26,
        fill: "#f7f4ee",
        anchor: "middle",
        weight: 700,
      }),
    );
    y += 28;
  } else if (card.away.record || card.home.record) {
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

  if (headline.length) {
    for (const line of headline) {
      y += 30;
      parts.push(text(line, M, y, { size: 25, fill: "#d5dae6", weight: 500 }));
    }
    y += 16;
  }

  const headerBottom = y;
  const hasWp = card.winProbability.length > 0;
  const standings = (card.playoff ? [] : card.standings ?? []).filter((table) => table.rows.length > 0);
  const hasStandings = standings.length > 0;
  const splitWp = hasWp && hasStandings;
  const fullW = W - M * 2;
  const halfW = (fullW - GAP) / 2;

  if (hasWp || hasStandings) {
    const standH = hasStandings ? standingsHeight(standings, splitWp, card.sport === "nhl") : 0;
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

  const mlbBox = card.sport === "mlb" ? card.mlbBox : null;
  const hasMlbBox = Boolean(mlbBox && (mlbBox.batting.away.rows.length || mlbBox.batting.home.rows.length));
  const hasStars = card.threeStars.length > 0;
  const hasGoalies = card.goalies.length > 0;
  const hasStats = card.stats.length > 0;
  const hasLeaders = !hasStars && !hasMlbBox && card.leaders.length > 0;
  const hasPerformers = hasMlbBox && card.leaders.length > 0;
  const roomy = card.sport === "nhl";
  const stackedStats = hasStats && (hasGoalies || hasLeaders);
  const colW = stackedStats ? (fullW - GAP) / 2 : fullW;

  if (hasPerformers) {
    const perfH = performersHeight(card.leaders);
    parts.push(panel(M, y, fullW, perfH));
    parts.push(performersBlock(card.leaders, card, M, y, fullW, awayPaint, homePaint));
    y += perfH + GAP;
  }

  if (hasMlbBox && mlbBox) {
    let boxH = mlbBoxHeight(mlbBox);
    const footerH = 46;
    const used = y + boxH + GAP + footerH;
    if (used < FINALS_ALERT_TARGET_HEIGHT) boxH += FINALS_ALERT_TARGET_HEIGHT - used;
    parts.push(panel(M, y, fullW, boxH));
    parts.push(mlbBoxBlock(mlbBox, M, y, fullW, awayPaint, homePaint));
    y += boxH + GAP;
  } else {
    if (hasStars) {
      const starH = starsHeight(card.threeStars);
      parts.push(panel(M, y, fullW, starH));
      parts.push(starsBlock(card.threeStars, card, M, y, fullW, awayPaint, homePaint));
      y += starH + GAP;
    }

    const statsH = hasStats ? statsHeight(card.stats.length, roomy) : 0;
    const goalieH = hasGoalies ? peopleHeight("Goalies", card.goalies, roomy) : 0;
    const leadH = hasLeaders ? leadersHeight(card.leaders, stackedStats) : 0;
    const colH = Math.max(statsH, goalieH, leadH);

    if (hasStats) {
      const x = M;
      const titleSize = roomy ? 19 : 17;
      parts.push(panel(x, y, colW, colH));
      parts.push(sideLogoMark(card.away, x + CARD_IN, y + 12, roomy ? 32 : 28, awayPaint, "start"));
      parts.push(
        text("Team stats", x + colW / 2, y + 34, {
          size: titleSize,
          fill: "#e8e4d9",
          anchor: "middle",
          weight: 700,
          spacing: 1.2,
        }),
      );
      parts.push(sideLogoMark(card.home, x + colW - CARD_IN, y + 12, roomy ? 32 : 28, homePaint, "end"));
      parts.push(statRows(card.stats, x, y + 50, colW, awayPaint, homePaint, roomy));
    }

    if (hasGoalies || hasLeaders) {
      const x = hasStats ? M + colW + GAP : M;
      const rightW = hasStats ? colW : fullW;
      parts.push(panel(x, y, rightW, colH));
      if (hasGoalies) {
        parts.push(peopleBlock("Goalies", card.goalies, x, y, rightW, awayPaint, homePaint, card.away.abbrev, roomy));
      } else {
        parts.push(sectionTitle("Box leaders", x + CARD_IN, y + 34));
        parts.push(leaderBlock(card.leaders, x, y + 50, rightW, awayPaint, homePaint, card.away.abbrev, stackedStats));
      }
    }

    if (hasStats || hasGoalies || hasLeaders) y += colH + GAP;
  }

  y += 4;
  const footerRight = card.odds?.graphicLine || centerStatus(card.statusLabel);
  parts.push(text(stamp, M, y + 22, { size: 18, fill: "#c5cce0", weight: 700, spacing: 0.4 }));
  parts.push(
    text(footerRight, W - M, y + 22, {
      size: footerRight.length > 28 ? 16 : 18,
      fill: "#d5dae6",
      anchor: "end",
      weight: 700,
      spacing: 0.2,
    }),
  );
  y += 42;

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
    logoHaloFilter(),
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
