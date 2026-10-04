import { clockParts, isBreakStatus } from "./clock.ts";
import { onDark } from "./color.ts";
import { leagueLabel, phaseLabel, situationLine } from "./copy.ts";
import { footballMarks, spotIsRedZone } from "./field.ts";
import { RINK_HEIGHT_FT, RINK_WIDTH_FT, rinkMarkings } from "./ice.ts";
import { HEAT_ALERT_HEIGHT, HEAT_ALERT_WIDTH, type HeatAlertCard, type HeatSide } from "./types.ts";

/**
 * Tall heat-alert graphic.
 *
 * The scoreboard follows the hierarchy of the alert the product liked:
 * HEAT chip, league · status, logos, scores, clock nest, down-and-distance.
 * Under that, football uses NflFieldMap's yard lines, end zones, line of
 * scrimmage, and line to gain. Hockey uses NhlIceRink's markings. Baseball
 * uses the same base diagram as LiveSituationStrip. Nothing here is a photo.
 */

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

function header(card: HeatAlertCard): string {
  const phase = phaseLabel(card);
  const phaseFill = card.live ? "#b7e4c7" : "#c5cce0";
  return `
    <rect x="52" y="46" width="148" height="54" rx="27" fill="#e10600"/>
    ${textEl("HEAT", 126, 82, { size: 24, fill: "#ffffff", weight: 700, spacing: 2.4 })}
    ${textEl(`${leagueLabel(card.sport)}   ·   ${phase}`, 220, 82, { size: 28, fill: phaseFill, weight: 600, anchor: "start", spacing: 1.4 })}
  `;
}

function sideColumn(side: HeatSide, cx: number, started: boolean): string {
  const color = onDark(side.color);
  const logo = 168;
  return `
    <circle cx="${cx}" cy="268" r="104" fill="${side.color}" fill-opacity="0.38"/>
    <circle cx="${cx}" cy="268" r="104" fill="#000000" fill-opacity="0.28"/>
    ${logoImage(side.logoHref, cx - logo / 2, 268 - logo / 2, logo, logo)}
    ${textEl(scoreText(side.score, started), cx, 478, { size: 108, family: "condensed", fill: "#ffffff", weight: 700 })}
    ${textEl(side.abbrev, cx, 528, { size: 30, fill: color, weight: 700, spacing: 2.2 })}
  `;
}

function clockNest(card: HeatAlertCard): string {
  const parts = clockParts(card.detail);
  const nest = `<rect x="372" y="168" width="336" height="292" rx="32" fill="#050505"/>`;
  if (parts.period && parts.clock && !isBreakStatus(card.detail)) {
    return `
      ${nest}
      ${textEl(parts.period.toUpperCase(), 540, 268, { size: 32, fill: "#c8f5d4", weight: 700, spacing: 3.2 })}
      ${textEl(parts.clock, 540, 400, { size: 108, family: "condensed", fill: "#ffffff", weight: 700 })}
    `;
  }
  const line = card.live || card.final
    ? parts.line || (card.final ? "Final" : "Live")
    : card.when || parts.line || "TBD";
  const size = line.length > 12 ? 48 : line.length > 8 ? 64 : 78;
  return `
    ${nest}
    ${textEl(line, 540, 340, { size, family: "condensed", fill: "#ffffff", weight: 700 })}
  `;
}

function situationBar(card: HeatAlertCard): string {
  const line = clipText(situationLine(card), 52);
  const fb = card.football;
  const homeHasBall = Boolean(fb && String(fb.possessionTeamId) === String(card.home.id));
  const awayHasBall = Boolean(fb && String(fb.possessionTeamId) === String(card.away.id));
  const red = Boolean(card.live && fb && spotIsRedZone(fb.yardLine, homeHasBall, awayHasBall));
  const fill = red ? "#3a1518" : "#10281f";
  const size = line.length > 40 ? 24 : 28;
  return `
    <rect x="48" y="556" width="984" height="76" rx="18" fill="${fill}"/>
    ${textEl(line, 540, 604, { size, fill: "#f4f1e9", weight: 600, spacing: 0.4 })}
  `;
}

function footballPanel(card: HeatAlertCard): string {
  const spot = card.football;
  if (!spot) return "";
  const branded = card.sport === "cfb";
  const marks = footballMarks({
    yardLine: spot.yardLine,
    possessionTeamId: spot.possessionTeamId,
    awayId: card.away.id,
    homeId: card.home.id,
    downDistanceText: spot.downDistanceText,
    driveStartYardLine: spot.driveStartYardLine,
  });
  const panelX = 40;
  const panelY = 656;
  const panelW = 1000;
  const panelH = 600;
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
      <rect x="${rx}" y="${panelY + 18}" width="${w}" height="36" rx="6" fill="${fill}"/>
      ${textEl(abbrev, anchor === "start" ? rx + w / 2 : rx + w / 2, panelY + 43, { size: 20, fill: text, weight: 700, spacing: 1.2 })}
    `;
  };

  const grassX = panelX + 16;
  const grassY = panelY + 70;
  const grassW = panelW - 32;
  const grassH = spot.lastPlayText ? 430 : 490;
  const endFrac = branded ? 0.11 : 0.09;
  const endW = grassW * endFrac;
  const playX = grassX + endW;
  const playW = grassW - endW * 2;
  const xAt = (pct: number) => playX + (pct / 100) * playW;

  const ticks = [10, 20, 30, 40, 50, 40, 30, 20, 10]
    .map((n, i) => {
      const x = playX + ((i + 1) / 10) * playW;
      return `
        <line x1="${x}" y1="${grassY}" x2="${x}" y2="${grassY + grassH}" stroke="#ffffff" stroke-opacity="0.28" stroke-width="2"/>
        ${textEl(String(n), x + 8, grassY + grassH - 16, { size: 20, fill: "rgba(255,255,255,0.62)", weight: 700, anchor: "start" })}
      `;
    })
    .join("");

  const endZone = (x: number, abbrev: string, color: string, logo: string | null, rotate: number) => {
    const cx = x + endW / 2;
    const cy = grassY + grassH / 2;
    const mark =
      branded && logo
        ? logoImage(logo, x + 8, cy - endW * 0.38, endW - 16, endW * 0.76)
        : `<text x="${cx}" y="${cy}" fill="rgba(255,255,255,0.84)" font-family="Libre Franklin" font-size="26" font-weight="700" text-anchor="middle" letter-spacing="2" transform="rotate(${rotate} ${cx} ${cy})">${esc(abbrev)}</text>`;
    return `<rect x="${x}" y="${grassY}" width="${endW}" height="${grassH}" fill="${color}"/>${mark}`;
  };

  let chain = "";
  if (marks.toGainLeft != null && marks.toGainWidth != null && marks.toGainWidth > 0.3) {
    const left = xAt(marks.toGainLeft);
    const width = (marks.toGainWidth / 100) * playW;
    if (branded) {
      chain += `<rect x="${left}" y="${grassY + grassH / 2 - 7}" width="${width}" height="14" fill="#2f9bff"/>`;
    } else {
      chain += `<rect x="${left}" y="${grassY}" width="${width}" height="${grassH}" fill="#fcd34d" fill-opacity="0.35"/>`;
    }
  }
  if (marks.firstDownPct != null) {
    const x = xAt(marks.firstDownPct);
    if (branded) {
      chain += `<line x1="${x}" y1="${grassY + grassH / 2 - 28}" x2="${x}" y2="${grassY + grassH / 2 + 28}" stroke="#ffffff" stroke-width="3"/>`;
    } else {
      chain += `<line x1="${x}" y1="${grassY}" x2="${x}" y2="${grassY + grassH}" stroke="#fcd34d" stroke-width="4"/>`;
    }
  }
  if (marks.ballPct != null && !branded) {
    const x = xAt(marks.ballPct);
    chain += `<line x1="${x}" y1="${grassY}" x2="${x}" y2="${grassY + grassH}" stroke="#38bdf8" stroke-width="4"/>`;
  }
  if (marks.ballPct != null && branded) {
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

  const mid =
    branded && card.home.logoHref
      ? logoImage(
          card.home.logoHref,
          playX + playW / 2 - 78,
          grassY + grassH / 2 - 78,
          156,
          156,
          0.42,
        )
      : "";

  let ball = "";
  if (marks.ballPct != null && (marks.homeHasBall || marks.awayHasBall || spot.yardLine != null)) {
    const rawX = xAt(marks.ballPct);
    const pad = 78;
    const x = Math.max(playX + pad, Math.min(playX + playW - pad, rawX));
    const y = grassY + grassH / 2;
    const possLogo = marks.homeHasBall ? card.home.logoHref : marks.awayHasBall ? card.away.logoHref : null;
    if (branded && possLogo) {
      ball = logoImage(possLogo, x - 36, y - 36, 72, 72);
    } else {
      const dir = marks.facingRight ? 1 : marks.facingLeft ? -1 : 0;
      const arrow =
        dir === 0
          ? ""
          : `<polygon points="${dir * 46},-12 ${dir * 46},12 ${dir * 68},0" fill="${possColor}"/>`;
      ball = `<g transform="translate(${x} ${y})">${placedFootball(0, 0, marks.facingRight || !marks.facingLeft)}${arrow}</g>`;
    }
  }

  const last = spot.lastPlayText
    ? textEl(clipText(spot.lastPlayText, 92), panelX + panelW / 2, panelY + panelH - 28, {
        size: 20,
        fill: "rgba(244,241,233,0.78)",
        weight: 500,
      })
    : "";

  return `
    <rect x="${panelX}" y="${panelY}" width="${panelW}" height="${panelH}" rx="22" fill="#0a1f12" stroke="#1f6b45" stroke-width="2"/>
    ${chip(card.away.abbrev, marks.awayHasBall, awayColor, panelX + 24, "start")}
    ${textEl(clipText(down, 34), panelX + panelW / 2, panelY + 43, { size: 20, fill: "rgba(209,250,229,0.8)", weight: 700, spacing: 1.1 })}
    ${chip(card.home.abbrev, marks.homeHasBall, homeColor, panelX + panelW - 24, "end")}
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

function icePanel(card: HeatAlertCard): string {
  if (!card.ice) return "";
  const panelX = 40;
  const panelY = 656;
  const panelW = 1000;
  const panelH = 600;
  const rinkW = 940;
  const rinkH = (rinkW * RINK_HEIGHT_FT) / RINK_WIDTH_FT;
  const cx = panelX + panelW / 2;
  const cy = panelY + 78 + rinkH / 2;
  const scale = rinkW / RINK_WIDTH_FT;
  const spot = card.ice;
  let puck = "";
  if (spot.puckX != null && spot.puckY != null) {
    const x = Math.max(-98, Math.min(98, spot.puckX));
    const y = Math.max(-40, Math.min(40, spot.puckY));
    puck = `<circle cx="${x}" cy="${y}" r="2.2" fill="#111827" stroke="#f8fafc" stroke-width="0.45"/>`;
  }
  const logo = card.home.logoHref
    ? logoImage(card.home.logoHref, cx - 70, cy - 70, 140, 140, 0.18)
    : "";
  return `
    <rect x="${panelX}" y="${panelY}" width="${panelW}" height="${panelH}" rx="22" fill="#0d1b2e" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
    ${textEl("ICE", panelX + 36, panelY + 44, { size: 18, fill: "#e8e4d9", weight: 700, anchor: "start", spacing: 2.4 })}
    ${textEl(card.away.abbrev, panelX + 36, panelY + panelH - 28, { size: 22, fill: onDark(card.away.color), weight: 700, anchor: "start", spacing: 1.4 })}
    ${textEl(card.home.abbrev, panelX + panelW - 36, panelY + panelH - 28, { size: 22, fill: onDark(card.home.color), weight: 700, anchor: "end", spacing: 1.4 })}
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

function diamondPanel(card: HeatAlertCard): string {
  const spot = card.diamond;
  if (!spot) return "";
  const panelX = 40;
  const panelY = 656;
  const panelW = 1000;
  const panelH = 600;
  const cx = 430;
  const cy = panelY + 300;
  const arm = 150;
  const outs = `${spot.outs} out${spot.outs === 1 ? "" : "s"}`;
  const people = [spot.batter ? `Batter  ${spot.batter}` : "", spot.pitcher ? `Pitcher  ${spot.pitcher}` : ""]
    .filter(Boolean)
    .map((line, i) =>
      textEl(clipText(line, 28), 760, panelY + 250 + i * 54, {
        size: 24,
        fill: "#f4f1e9",
        weight: 600,
        anchor: "middle",
      }),
    )
    .join("");
  return `
    <rect x="${panelX}" y="${panelY}" width="${panelW}" height="${panelH}" rx="22" fill="#10281f" stroke="#1f6b45" stroke-width="2"/>
    ${textEl(clipText(card.detail || "At bat", 24), panelX + 36, panelY + 48, { size: 20, fill: "#d1fae5", weight: 700, anchor: "start", spacing: 1.4 })}
    <line x1="${cx}" y1="${cy + arm}" x2="${cx - arm - 30}" y2="${cy - 20}" stroke="rgba(255,255,255,0.35)" stroke-width="3"/>
    <line x1="${cx}" y1="${cy + arm}" x2="${cx + arm + 30}" y2="${cy - 20}" stroke="rgba(255,255,255,0.35)" stroke-width="3"/>
    <line x1="${cx - arm}" y1="${cy}" x2="${cx}" y2="${cy - arm}" stroke="rgba(255,255,255,0.28)" stroke-width="3"/>
    <line x1="${cx + arm}" y1="${cy}" x2="${cx}" y2="${cy - arm}" stroke="rgba(255,255,255,0.28)" stroke-width="3"/>
    ${bag(spot.onSecond, cx, cy - arm)}
    ${bag(spot.onThird, cx - arm, cy)}
    ${bag(spot.onFirst, cx + arm, cy)}
    <polygon points="${cx}, ${cy + arm + 18} ${cx - 16}, ${cy + arm} ${cx - 10}, ${cy + arm - 8} ${cx + 10}, ${cy + arm - 8} ${cx + 16}, ${cy + arm}" fill="#f4f1e9"/>
    ${textEl(`${spot.balls}-${spot.strikes}`, 760, panelY + 180, { size: 72, family: "condensed", fill: "#ffffff", weight: 700 })}
    ${textEl(outs, 760, panelY + 214, { size: 22, fill: "rgba(244,241,233,0.72)", weight: 600, spacing: 1.2 })}
    ${people}
  `;
}

function matchupPanel(card: HeatAlertCard): string {
  const panelX = 40;
  const panelY = 656;
  const panelW = 1000;
  const panelH = 600;
  return `
    <rect x="${panelX}" y="${panelY}" width="${panelW}" height="${panelH}" rx="22" fill="#0d1d3c"/>
    ${textEl(card.away.name, 540, panelY + 230, { size: 54, family: "condensed", fill: "#ffffff", weight: 700 })}
    ${textEl("at", 540, panelY + 300, { size: 28, fill: "rgba(244,241,233,0.55)", weight: 600, spacing: 2 })}
    ${textEl(card.home.name, 540, panelY + 380, { size: 54, family: "condensed", fill: "#ffffff", weight: 700 })}
  `;
}

export function renderHeatAlertSvg(card: HeatAlertCard): string {
  const started = card.live || card.final;
  const map = card.football
    ? footballPanel(card)
    : card.ice
      ? icePanel(card)
      : card.diamond
        ? diamondPanel(card)
        : matchupPanel(card);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${HEAT_ALERT_WIDTH}" height="${HEAT_ALERT_HEIGHT}" viewBox="0 0 ${HEAT_ALERT_WIDTH} ${HEAT_ALERT_HEIGHT}">
  <defs>
    <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1a5c34"/>
      <stop offset="1" stop-color="#0d3d22"/>
    </linearGradient>
    <radialGradient id="awayWash" cx="18%" cy="38%" r="58%">
      <stop offset="0" stop-color="${card.away.color}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${card.away.color}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="homeWash" cx="82%" cy="38%" r="58%">
      <stop offset="0" stop-color="${card.home.color}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${card.home.color}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${HEAT_ALERT_WIDTH}" height="${HEAT_ALERT_HEIGHT}" fill="#05080f"/>
  <rect x="16" y="16" width="1048" height="1268" rx="40" fill="#07101d" stroke="#3b82f6" stroke-width="8"/>
  <rect x="28" y="120" width="512" height="420" fill="url(#awayWash)"/>
  <rect x="540" y="120" width="512" height="420" fill="url(#homeWash)"/>
  ${header(card)}
  ${sideColumn(card.away, 210, started)}
  ${clockNest(card)}
  ${sideColumn(card.home, 870, started)}
  ${situationBar(card)}
  ${map}
</svg>`;
}
