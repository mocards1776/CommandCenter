/**
 * Top-down rink markings from NhlIceRink (RinkMarkings).
 * Coordinates are ESPN/NHL feet: x ∈ ±100, y ∈ ±42.5, goal lines at ±89.
 */

const HALF_L = 100;
const HALF_W = 42.5;
const GOAL_X = 89;

function dot(cx: number, cy: number): string {
  return `<circle cx="${cx}" cy="${cy}" r="1" fill="#c8102e"/>`;
}

function endCircle(cx: number, cy: number): string {
  const ticks: string[] = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      ticks.push(
        `<path d="M${cx + sx * 2} ${cy + sy * 15} v${sy * 2.6}" stroke="#c8102e" stroke-width="0.45"/>`,
      );
    }
  }
  return `<g><circle cx="${cx}" cy="${cy}" r="15" fill="none" stroke="#c8102e" stroke-width="0.45"/>${dot(cx, cy)}${ticks.join("")}</g>`;
}

function net(side: 1 | -1): string {
  const flip = side === 1 ? "" : ` transform="scale(-1 1)"`;
  const rectX = side === 1 ? GOAL_X : -GOAL_X - 3.3;
  return `<g>
    <path d="M${GOAL_X} -6 A6 6 0 0 0 ${GOAL_X} 6 Z"${flip} fill="#9fc9f0" fill-opacity="0.55" stroke="#c8102e" stroke-width="0.35"/>
    <rect x="${rectX}" y="-3" width="3.3" height="6" rx="1.2" fill="none" stroke="#64748b" stroke-width="0.5"/>
    <path d="M${side * GOAL_X} -11 L${side * 100} -14 M${side * GOAL_X} 11 L${side * 100} 14" stroke="#c8102e" stroke-width="0.3"/>
  </g>`;
}

/** Markings in rink space, origin at center ice. */
export function rinkMarkings(): string {
  const red = "#c8102e";
  const blue = "#1d4fb8";
  const dots = [-20, 20].flatMap((cx) => [-22, 22].map((cy) => dot(cx, cy))).join("");
  const circles = [-69, 69].flatMap((cx) => [-22, 22].map((cy) => endCircle(cx, cy))).join("");
  const goalLines = [-1, 1]
    .map((s) => `<path d="M${s * GOAL_X} -36.7 V36.7" stroke="${red}" stroke-width="0.45"/>`)
    .join("");
  return `
    <rect x="${-HALF_L}" y="${-HALF_W}" width="200" height="85" rx="28" fill="#f4f7fb"/>
    ${goalLines}
    <rect x="-26" y="${-HALF_W}" width="1" height="85" fill="${blue}"/>
    <rect x="25" y="${-HALF_W}" width="1" height="85" fill="${blue}"/>
    <rect x="-0.5" y="${-HALF_W}" width="1" height="85" fill="${red}"/>
    <circle cx="0" cy="0" r="15" fill="none" stroke="${blue}" stroke-width="0.45"/>
    <circle cx="0" cy="0" r="0.6" fill="${blue}"/>
    ${dots}
    ${circles}
    ${net(1)}
    ${net(-1)}
    <rect x="${-HALF_L}" y="${-HALF_W}" width="200" height="85" rx="28" fill="none" stroke="#9aa6b8" stroke-width="1"/>
  `;
}

export const RINK_WIDTH_FT = HALF_L * 2;
export const RINK_HEIGHT_FT = HALF_W * 2;
