import { clockParts, isBreakStatus } from "./clock.ts";
import { onDark } from "./color.ts";
import { formatHeatTimestamp, leagueLabel, phaseLabel, situationLine } from "./copy.ts";
import { footballMarks, layoutPlayDots, spotIsRedZone } from "./field.ts";
import { RINK_HEIGHT_FT, RINK_WIDTH_FT, rinkMarkings } from "./ice.ts";
import { HEAT_ALERT_HEIGHT, HEAT_ALERT_WIDTH, type HeatAlertCard } from "./types.ts";

/**
 * Tall heat-alert graphic in the same visual language as the finals card:
 * navy board, team washes, 1080×1350 Telegram slot, logos + score hierarchy,
 * then the live map. Football chains still come from NflFieldMap math.
 * Nothing here is a photo.
 */

const W = HEAT_ALERT_WIDTH;
const H = HEAT_ALERT_HEIGHT;
const M = 36;

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clipText(value: string, max: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function scoreText(score: number | null, started: boolean): string {
  if (!started) return "–";
  if (score == null) return "0";
  return String(score);
}

function logoImage(href: string | null, x: number, y: number, w: number, h: number, opacity = 1): string {
  if (!href) return "";
  const fade = opacity < 1 ? ` opacity="${opacity}"` : "";
  const safe = esc(href);
  return `<image href="${safe}" xlink:href="${safe}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"${fade}/>`;
}

function footballGlyph(): string {
  const laces = [12, 14, 16, 18, 20]
    .map(
      (x) =>
        `<path d="M${x} 5.3 V10.7" stroke="#f5efe4" stroke-width="0.95" stroke-linecap="round"/>`,
    )
    .join("");
  return `
    <path d="M2 8 C2 3.2 7.5 1.2 16 1.2 C24.5 1.2 30 3.2 30 8 C30 12.8 24.5 14.8 16 14.8 C7.5 14.8 2 12.8 2 8 Z" fill="#6b3a14" stroke="#2a1508" stroke-width="1.1"/>
    <path d="M3.2 8 C3.2 4.2 8.2 2.6 16 2.6 C23.8 2.6 28.8 4.2 28.8 8 C28.8 11.8 23.8 13.4 16 13.4 C8.2 13.4 3.2 11.8 3.2 8 Z" fill="#8b4e1c"/>
    <path d="M10 8 H22" stroke="#f5efe4" stroke-width="1.2" stroke-linecap="round"/>
    ${laces}
    <ellipse cx="4.4" cy="8" rx="1.5" ry="2.3" fill="#2a1508" opacity="0.5"/>
    <ellipse cx="27.6" cy="8" rx="1.5" ry="2.3" fill="#2a1508" opacity="0.5"/>
  `;
}

function placedFootball(cx: number, cy: number, facingRight: boolean, scale = 2.35): string {
  const flip = facingRight ? 1 : -1;
  return `<g transform="translate(${cx} ${cy}) scale(${flip} 1) scale(${scale}) translate(-16 -8)">${footballGlyph()}</g>`;
}

/** Same wedge as NflFieldMap's AttackArrow, sitting above the possession mark. */
function attackArrow(facingRight: boolean, facingLeft: boolean, color: string): string {
  if (!facingRight && !facingLeft) return "";
  const d = facingRight ? "M1.2 1.2 L12.2 5 L1.2 8.8 Z" : "M12.8 1.2 L1.8 5 L12.8 8.8 Z";
  return `<g transform="translate(-22 -74) scale(3.14)"><path d="${d}" fill="${color}" stroke="#ffffff" stroke-width="0.9" stroke-linejoin="round"/></g>`;
}

function textEl(
  value: string,
  x: number,
  y: number,
  opts: {
    size: number;
    fill?: string;
    weight?: number;
    family?: "sans" | "condensed";
    anchor?: "start" | "middle" | "end";
    spacing?: number;
  },
): string {
  const family = opts.family === "condensed" ? "Barlow Condensed" : "Libre Franklin";
  const anchor = opts.anchor ?? "middle";
  const fill = opts.fill ?? "#f4f1e9";
  const weight = opts.weight ?? 700;
  const spacing = opts.spacing != null ? ` letter-spacing="${opts.spacing}"` : "";
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${fill}" font-family="${family}" font-size="${opts.size}" font-weight="${weight}"${spacing}>${esc(value)}</text>`;
}

function panel(x: number, y: number, w: number, h: number, fill = "#0c1628"): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${fill}" stroke="rgba(255,255,255,0.08)"/>`;
}

function header(card: HeatAlertCard): string {
  const phase = phaseLabel(card);
  const phaseFill = card.live ? "#b7e4c7" : "#c5cce0";
  const meta = [leagueLabel(card.sport), phase].join("   ·   ");
  const venue = card.venue ? clipText(card.venue, 28) : "";
  return `
    <rect x="${M}" y="22" width="132" height="40" rx="20" fill="#e10600"/>
    ${textEl("HEAT", M + 66, 49, { size: 20, fill: "#ffffff", weight: 700, spacing: 2.2 })}
    ${textEl(meta, M + 150, 49, { size: 22, fill: phaseFill, weight: 700, anchor: "start", spacing: 1.2 })}
    ${venue ? textEl(venue, W - M, 49, { size: 18, fill: "#8b93a7", weight: 500, anchor: "end" }) : ""}
  `;
}

function scoreboard(card: HeatAlertCard, started: boolean): string {
  const logo = 124;
  const awayPaint = onDark(card.away.color);
  const homePaint = onDark(card.home.color);
  const parts = clockParts(card.detail);
  let nest = "";
  if (parts.period && parts.clock && !isBreakStatus(card.detail)) {
    nest = `
      ${textEl(parts.period.toUpperCase(), 540, 168, { size: 28, fill: "#c8f5d4", weight: 700, spacing: 3 })}
      ${textEl(parts.clock, 540, 268, { size: 92, family: "condensed", fill: "#ffffff", weight: 700 })}
    `;
  } else {
    const line = card.live || card.final
      ? parts.line || (card.final ? "Final" : "Live")
      : card.when || parts.line || "TBD";
    const size = line.length > 12 ? 40 : line.length > 8 ? 56 : 72;
    nest = textEl(line, 540, 230, { size, family: "condensed", fill: "#ffffff", weight: 700 });
  }
  const awayLogo = M + 8;
  const homeLogo = W - M - 8 - logo;
  const awayCx = awayLogo + logo / 2;
  const homeCx = homeLogo + logo / 2;
  const awayRecord = card.away.record
    ? textEl(card.away.record, awayCx, 338, { size: 26, fill: "#f7f4ee", weight: 700 })
    : "";
  const homeRecord = card.home.record
    ? textEl(card.home.record, homeCx, 338, { size: 26, fill: "#f7f4ee", weight: 700 })
    : "";
  return `
    <rect x="392" y="96" width="296" height="196" rx="28" fill="#050505" fill-opacity="0.55"/>
    ${nest}
    ${logoImage(card.away.logoHref, awayLogo, 86, logo, logo)}
    ${logoImage(card.home.logoHref, homeLogo, 86, logo, logo)}
    ${card.away.logoHref ? "" : `<circle cx="${awayCx}" cy="${148}" r="${logo / 2 - 4}" fill="none" stroke="${awayPaint}" stroke-width="4"/>`}
    ${card.home.logoHref ? "" : `<circle cx="${homeCx}" cy="${148}" r="${logo / 2 - 4}" fill="none" stroke="${homePaint}" stroke-width="4"/>`}
    ${textEl(scoreText(card.away.score, started), 318, 230, { size: 118, family: "condensed", fill: "#f7f4ee", weight: 700 })}
    ${textEl(scoreText(card.home.score, started), 762, 230, { size: 118, family: "condensed", fill: "#f7f4ee", weight: 700 })}
    ${textEl(card.away.abbrev, awayCx, 300, { size: 26, fill: awayPaint, weight: 700, spacing: 1.4 })}
    ${textEl(card.home.abbrev, homeCx, 300, { size: 26, fill: homePaint, weight: 700, spacing: 1.4 })}
    ${awayRecord}
    ${homeRecord}
  `;
}

function linescore(card: HeatAlertCard, y: number): { svg: string; height: number } {
  const labels = card.periodLabels;
  const count = Math.max(labels.length, card.away.linescores.length, card.home.linescores.length);
  if (!count || (!card.away.linescores.length && !card.home.linescores.length)) {
    return { svg: "", height: 0 };
  }
  const height = 118;
  const x = M;
  const w = W - M * 2;
  const cols = count + 1;
  const teamW = 118;
  const colW = (w - 32 - teamW) / cols;
  const headerY = y + 34;
  const rowY = [y + 68, y + 100];
  const paints = [onDark(card.away.color), onDark(card.home.color)];
  const sides = [card.away, card.home];
  const heads = Array.from({ length: count }, (_, i) =>
    textEl(labels[i] || String(i + 1), x + 16 + teamW + colW * i + colW / 2, headerY, {
      size: 17,
      fill: "#8b93a7",
      weight: 700,
      spacing: 0.5,
    }),
  );
  heads.push(
    textEl("T", x + 16 + teamW + colW * count + colW / 2, headerY, {
      size: 17,
      fill: "#e8e4d9",
      weight: 700,
    }),
  );
  const rows = sides.map((side, row) => {
    const cells = Array.from({ length: count }, (_, i) => {
      const value = side.linescores[i];
      return textEl(value == null ? "" : String(value), x + 16 + teamW + colW * i + colW / 2, rowY[row]!, {
        size: 26,
        fill: "#d5dae6",
        weight: 500,
      });
    });
    cells.push(
      textEl(side.score == null ? "" : String(side.score), x + 16 + teamW + colW * count + colW / 2, rowY[row]!, {
        size: 28,
        fill: "#f7f4ee",
        weight: 700,
      }),
    );
    return [
      textEl(side.abbrev, x + 16, rowY[row]!, {
        size: 22,
        fill: paints[row]!,
        anchor: "start",
        weight: 700,
        spacing: 0.7,
      }),
      ...cells,
    ].join("");
  });
  return { svg: [panel(x, y, w, height, "#080e18"), ...heads, ...rows].join(""), height };
}

function situationBar(card: HeatAlertCard, y: number): { svg: string; height: number } {
  const line = clipText(situationLine(card), 52);
  const fb = card.football;
  const homeHasBall = Boolean(fb && String(fb.possessionTeamId) === String(card.home.id));
  const awayHasBall = Boolean(fb && String(fb.possessionTeamId) === String(card.away.id));
  const red = Boolean(card.live && fb && spotIsRedZone(fb.yardLine, homeHasBall, awayHasBall));
  const fill = red ? "#3a1518" : "#10281f";
  const size = line.length > 40 ? 22 : 26;
  const height = 56;
  return {
    height,
    svg: `
      <rect x="${M}" y="${y}" width="${W - M * 2}" height="${height}" rx="16" fill="${fill}"/>
      ${textEl(line, 540, y + 37, { size, fill: "#f4f1e9", weight: 600, spacing: 0.3 })}
    `,
  };
}

function footballPanel(card: HeatAlertCard, panelX: number, panelY: number, panelW: number, panelH: number): string {
  const spot = card.football;
  if (!spot) return "";
  const marks = footballMarks({
    yardLine: spot.yardLine,
    possessionTeamId: spot.possessionTeamId,
    awayId: card.away.id,
    homeId: card.home.id,
    downDistanceText: spot.downDistanceText,
    driveStartYardLine: spot.driveStartYardLine,
  });
  const awayColor = card.away.color;
  const homeColor = card.home.color;
  const possColor = marks.homeHasBall ? homeColor : marks.awayHasBall ? awayColor : "#f0e6c8";
  const down = spot.downDistanceText && !isBreakStatus(spot.downDistanceText) ? spot.downDistanceText : "Field";

  const chip = (abbrev: string, active: boolean, color: string, x: number, anchor: "start" | "end") => {
    const fill = active ? color : "transparent";
    const text = active ? "#ffffff" : "rgba(255,255,255,0.45)";
    const w = 118;
    const rx = anchor === "start" ? x : x - w;
    return `
      <rect x="${rx}" y="${panelY + 16}" width="${w}" height="34" rx="6" fill="${fill}"/>
      ${textEl(abbrev, rx + w / 2, panelY + 40, { size: 18, fill: text, weight: 700, spacing: 1.2 })}
    `;
  };

  const grassX = panelX + 16;
  const grassY = panelY + 62;
  const grassW = panelW - 32;
  const lastReserve = spot.lastPlayText ? 36 : 16;
  const grassH = Math.max(220, panelH - 70 - lastReserve);
  const endFrac = 0.11;
  const endW = grassW * endFrac;
  const playX = grassX + endW;
  const playW = grassW - endW * 2;
  const xAt = (pct: number) => playX + (pct / 100) * playW;

  const ticks = [10, 20, 30, 40, 50, 40, 30, 20, 10]
    .map((n, i) => {
      const x = playX + ((i + 1) / 10) * playW;
      return `
        <line x1="${x}" y1="${grassY}" x2="${x}" y2="${grassY + grassH}" stroke="#ffffff" stroke-opacity="0.28" stroke-width="2"/>
        ${textEl(String(n), x + 8, grassY + grassH - 16, { size: 18, fill: "rgba(255,255,255,0.62)", weight: 700, anchor: "start" })}
      `;
    })
    .join("");

  const endZone = (x: number, abbrev: string, color: string, logo: string | null, rotate: number) => {
    const cx = x + endW / 2;
    const cy = grassY + grassH / 2;
    const mark = logo
      ? logoImage(logo, x + 8, cy - endW * 0.38, endW - 16, endW * 0.76)
      : `<text x="${cx}" y="${cy}" fill="rgba(255,255,255,0.84)" font-family="Libre Franklin" font-size="26" font-weight="700" text-anchor="middle" letter-spacing="2" transform="rotate(${rotate} ${cx} ${cy})">${esc(abbrev)}</text>`;
    return `<rect x="${x}" y="${grassY}" width="${endW}" height="${grassH}" fill="${color}"/>${mark}`;
  };

  let chain = "";
  if (marks.toGainLeft != null && marks.toGainWidth != null && marks.toGainWidth > 0.3) {
    const left = xAt(marks.toGainLeft);
    const width = (marks.toGainWidth / 100) * playW;
    chain += `<rect x="${left}" y="${grassY + grassH / 2 - 7}" width="${width}" height="14" fill="#2f9bff"/>`;
  }
  const dotScale = playW / 520;
  for (const dot of layoutPlayDots(spot.playYardLines ?? [])) {
    const cx = xAt(dot.pct) + dot.x * dotScale;
    const cy = grassY + grassH / 2 + dot.y * dotScale;
    chain += `<circle cx="${cx}" cy="${cy}" r="7" fill="${possColor}" stroke="#ffffff" stroke-width="1.6"/>`;
  }
  if (marks.firstDownPct != null) {
    const x = xAt(marks.firstDownPct);
    chain += `<line x1="${x}" y1="${grassY}" x2="${x}" y2="${grassY + grassH}" stroke="#ffe500" stroke-width="5"/>`;
  }
  if (marks.ballPct != null) {
    const x = xAt(marks.ballPct);
    chain += `<line x1="${x}" y1="${grassY + grassH / 2 - 36}" x2="${x}" y2="${grassY + grassH / 2 + 36}" stroke="#fcd34d" stroke-width="5"/>`;
  }

  let drive = "";
  if (marks.driveStartPct != null) {
    const x = xAt(marks.driveStartPct);
    drive = `
      <line x1="${x}" y1="${grassY + 10}" x2="${x}" y2="${grassY + grassH - 10}" stroke="#ffffff" stroke-width="2" stroke-dasharray="8 7" stroke-opacity="0.9"/>
      <rect x="${x - 6}" y="${grassY + 12}" width="12" height="12" fill="#ffffff" transform="rotate(45 ${x} ${grassY + 18})"/>
    `;
  }

  const mid = card.home.logoHref
    ? logoImage(card.home.logoHref, playX + playW / 2 - 70, grassY + grassH / 2 - 70, 140, 140, 0.42)
    : "";

  let ball = "";
  if (marks.ballPct != null && (marks.homeHasBall || marks.awayHasBall || spot.yardLine != null)) {
    const rawX = xAt(marks.ballPct);
    const pad = 78;
    const x = Math.max(playX + pad, Math.min(playX + playW - pad, rawX));
    const y = grassY + grassH / 2;
    const possLogo = marks.homeHasBall ? card.home.logoHref : marks.awayHasBall ? card.away.logoHref : null;
    const arrow = attackArrow(marks.facingRight, marks.facingLeft, possColor);
    if (possLogo) {
      ball = `<g transform="translate(${x} ${y})">${arrow}${logoImage(possLogo, -36, -36, 72, 72)}</g>`;
    } else {
      ball = `<g transform="translate(${x} ${y})">${placedFootball(0, 0, marks.facingRight || !marks.facingLeft)}${arrow}</g>`;
    }
  }

  const last = spot.lastPlayText
    ? textEl(clipText(spot.lastPlayText, 88), panelX + panelW / 2, panelY + panelH - 14, {
        size: 18,
        fill: "rgba(244,241,233,0.78)",
        weight: 500,
      })
    : "";

  return `
    ${panel(panelX, panelY, panelW, panelH, "#0a1f12")}
    ${chip(card.away.abbrev, marks.awayHasBall, awayColor, panelX + 20, "start")}
    ${textEl(clipText(down, 34), panelX + panelW / 2, panelY + 40, { size: 18, fill: "rgba(209,250,229,0.8)", weight: 700, spacing: 1.1 })}
    ${chip(card.home.abbrev, marks.homeHasBall, homeColor, panelX + panelW - 20, "end")}
    <clipPath id="grassClip"><rect x="${grassX}" y="${grassY}" width="${grassW}" height="${grassH}" rx="12"/></clipPath>
    <g clip-path="url(#grassClip)">
      <rect x="${grassX}" y="${grassY}" width="${grassW}" height="${grassH}" fill="url(#grass)"/>
      ${endZone(grassX, card.away.abbrev, awayColor, card.away.logoHref, -90)}
      ${endZone(grassX + grassW - endW, card.home.abbrev, homeColor, card.home.logoHref, 90)}
      ${ticks}
      ${mid}
      ${chain}
      ${drive}
      ${ball}
    </g>
    ${last}
  `;
}

function icePanel(card: HeatAlertCard, panelX: number, panelY: number, panelW: number, panelH: number): string {
  if (!card.ice) return "";
  const rinkW = Math.min(940, panelW - 48);
  const rinkH = (rinkW * RINK_HEIGHT_FT) / RINK_WIDTH_FT;
  const cx = panelX + panelW / 2;
  const cy = panelY + 64 + rinkH / 2;
  const scale = rinkW / RINK_WIDTH_FT;
  const spot = card.ice;
  let puck = "";
  if (spot.puckX != null && spot.puckY != null) {
    const x = Math.max(-98, Math.min(98, spot.puckX));
    const y = Math.max(-40, Math.min(40, spot.puckY));
    puck = `<circle cx="${x}" cy="${y}" r="2.2" fill="#111827" stroke="#f8fafc" stroke-width="0.45"/>`;
  }
  const logo = card.home.logoHref ? logoImage(card.home.logoHref, cx - 70, cy - 70, 140, 140, 0.18) : "";
  return `
    ${panel(panelX, panelY, panelW, panelH, "#0d1b2e")}
    ${textEl("ICE", panelX + 28, panelY + 40, { size: 18, fill: "#e8e4d9", weight: 700, anchor: "start", spacing: 2.4 })}
    ${textEl(card.away.abbrev, panelX + 28, panelY + panelH - 22, { size: 22, fill: onDark(card.away.color), weight: 700, anchor: "start", spacing: 1.4 })}
    ${textEl(card.home.abbrev, panelX + panelW - 28, panelY + panelH - 22, { size: 22, fill: onDark(card.home.color), weight: 700, anchor: "end", spacing: 1.4 })}
    <g transform="translate(${cx} ${cy}) scale(${scale})">
      ${rinkMarkings()}
      ${puck}
    </g>
    ${logo}
  `;
}

function bag(on: boolean, cx: number, cy: number): string {
  const fill = on ? "#f4f1e9" : "rgba(255,255,255,0.16)";
  return `<rect x="${cx - 16}" y="${cy - 16}" width="32" height="32" rx="3" fill="${fill}" transform="rotate(45 ${cx} ${cy})"/>`;
}

function diamondPanel(card: HeatAlertCard, panelX: number, panelY: number, panelW: number, panelH: number): string {
  const spot = card.diamond;
  if (!spot) return "";
  const cx = panelX + 360;
  const cy = panelY + panelH / 2 + 10;
  const arm = 140;
  const outs = `${spot.outs} out${spot.outs === 1 ? "" : "s"}`;
  const people = [spot.batter ? `Batter  ${spot.batter}` : "", spot.pitcher ? `Pitcher  ${spot.pitcher}` : ""]
    .filter(Boolean)
    .map((line, i) =>
      textEl(clipText(line, 28), panelX + 760, panelY + 230 + i * 50, {
        size: 22,
        fill: "#f4f1e9",
        weight: 600,
        anchor: "middle",
      }),
    )
    .join("");
  return `
    ${panel(panelX, panelY, panelW, panelH, "#10281f")}
    ${textEl(clipText(card.detail || "At bat", 24), panelX + 28, panelY + 42, { size: 20, fill: "#d1fae5", weight: 700, anchor: "start", spacing: 1.4 })}
    <line x1="${cx}" y1="${cy + arm}" x2="${cx - arm - 30}" y2="${cy - 20}" stroke="rgba(255,255,255,0.35)" stroke-width="3"/>
    <line x1="${cx}" y1="${cy + arm}" x2="${cx + arm + 30}" y2="${cy - 20}" stroke="rgba(255,255,255,0.35)" stroke-width="3"/>
    <line x1="${cx - arm}" y1="${cy}" x2="${cx}" y2="${cy - arm}" stroke="rgba(255,255,255,0.28)" stroke-width="3"/>
    <line x1="${cx + arm}" y1="${cy}" x2="${cx}" y2="${cy - arm}" stroke="rgba(255,255,255,0.28)" stroke-width="3"/>
    ${bag(spot.onSecond, cx, cy - arm)}
    ${bag(spot.onThird, cx - arm, cy)}
    ${bag(spot.onFirst, cx + arm, cy)}
    <polygon points="${cx}, ${cy + arm + 18} ${cx - 16}, ${cy + arm} ${cx - 10}, ${cy + arm - 8} ${cx + 10}, ${cy + arm - 8} ${cx + 16}, ${cy + arm}" fill="#f4f1e9"/>
    ${textEl(`${spot.balls}-${spot.strikes}`, panelX + 760, panelY + 168, { size: 68, family: "condensed", fill: "#ffffff", weight: 700 })}
    ${textEl(outs, panelX + 760, panelY + 200, { size: 22, fill: "rgba(244,241,233,0.72)", weight: 600, spacing: 1.2 })}
    ${people}
  `;
}

function matchupPanel(card: HeatAlertCard, panelX: number, panelY: number, panelW: number, panelH: number): string {
  return `
    ${panel(panelX, panelY, panelW, panelH, "#0d1d3c")}
    ${textEl(card.away.name, 540, panelY + panelH / 2 - 40, { size: 48, family: "condensed", fill: "#ffffff", weight: 700 })}
    ${textEl("at", 540, panelY + panelH / 2 + 8, { size: 24, fill: "rgba(244,241,233,0.55)", weight: 600, spacing: 2 })}
    ${textEl(card.home.name, 540, panelY + panelH / 2 + 70, { size: 48, family: "condensed", fill: "#ffffff", weight: 700 })}
  `;
}

export function renderHeatAlertSvg(card: HeatAlertCard): string {
  const started = card.live || card.final;
  const stamp = formatHeatTimestamp(card.date);
  let y = 70;
  const board = scoreboard(card, started);
  y = 356;
  const table = linescore(card, y);
  if (table.height) y += table.height + 14;
  const sit = situationBar(card, y);
  y += sit.height + 14;
  const footerTop = H - 52;
  const mapY = y;
  const mapH = Math.max(240, footerTop - mapY - 12);
  const mapX = M;
  const mapW = W - M * 2;
  const map = card.football
    ? footballPanel(card, mapX, mapY, mapW, mapH)
    : card.ice
      ? icePanel(card, mapX, mapY, mapW, mapH)
      : card.diamond
        ? diamondPanel(card, mapX, mapY, mapW, mapH)
        : matchupPanel(card, mapX, mapY, mapW, mapH);
  const footerRight = card.live ? "Live" : card.final ? "Final" : card.when || "Upcoming";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1a5c34"/>
      <stop offset="1" stop-color="#0d3d22"/>
    </linearGradient>
    <radialGradient id="awayWash" cx="18%" cy="22%" r="58%">
      <stop offset="0" stop-color="${card.away.color}" stop-opacity="0.5"/>
      <stop offset="72%" stop-color="${card.away.color}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="homeWash" cx="82%" cy="22%" r="58%">
      <stop offset="0" stop-color="${card.home.color}" stop-opacity="0.5"/>
      <stop offset="72%" stop-color="${card.home.color}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#07101d"/>
  <rect width="${W / 2}" height="8" fill="${card.away.color}"/>
  <rect x="${W / 2}" width="${W / 2}" height="8" fill="${card.home.color}"/>
  <rect width="${W}" height="360" fill="url(#awayWash)"/>
  <rect width="${W}" height="360" fill="url(#homeWash)"/>
  ${header(card)}
  ${board}
  ${table.svg}
  ${sit.svg}
  ${map}
  ${textEl(stamp, M, H - 22, { size: 18, fill: "#c5cce0", weight: 700, spacing: 0.4, anchor: "start" })}
  ${textEl(footerRight, W - M, H - 22, { size: 18, fill: "#d5dae6", weight: 700, spacing: 0.2, anchor: "end" })}
</svg>`;
}
