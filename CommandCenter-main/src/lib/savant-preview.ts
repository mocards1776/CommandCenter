/**
 * Baseball Savant /preview pages are React SPAs — the visible body is nav chrome.
 * Rebuild Statcast Hitters/Pitchers tables from the embedded `var teams = {...}` JSON.
 * Works in the browser (Savant sends Access-Control-Allow-Origin: *).
 */

type SavantPerson = { id?: number; fullName?: string };
type SavantPosition = { abbreviation?: string };
type SavantGameStatus = { isOnBench?: boolean };
type SavantPlayer = {
  person?: SavantPerson;
  position?: SavantPosition;
  gameStatus?: SavantGameStatus;
  battingOrder?: number | string | null;
  playerOrder?: number | null;
  batted_ball?: number | null;
  launch_angle_avg?: number | string | null;
  exit_velocity_avg?: number | string | null;
  hard_hit_percent?: number | string | null;
  xwoba?: number | string | null;
  xba?: number | string | null;
  k_percent?: number | string | null;
  bb_percent?: number | string | null;
  whiff_percent?: number | string | null;
  didNotQualify?: string | null;
  percent_rank_exit_velocity_avg?: number | null;
  percent_rank_hard_hit_percent?: number | null;
  percent_rank_xwoba?: number | null;
  percent_rank_xba?: number | null;
  percent_rank_k_percent?: number | null;
  percent_rank_bb_percent?: number | null;
  percent_rank_whiff_percent?: number | null;
};

type SavantSide = {
  hasLineup?: boolean;
  fileCode?: string;
  team?: { id?: number; name?: string; abbreviation?: string; teamName?: string };
  roster?: { hitters?: SavantPlayer[]; pitchers?: SavantPlayer[] };
};

type SavantTeamsPayload = {
  home?: SavantSide;
  away?: SavantSide;
  gameDate?: string;
};

export type SavantPreviewArticle = {
  url: string;
  title: string | null;
  byline: string | null;
  image: string | null;
  contentHtml: string;
  contentText: string;
  wordCount: number;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lerpChannel(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function percentileStyle(pct: number | string | null | undefined): string {
  if (pct == null || pct === "") return "";
  const n = Number(pct);
  if (!Number.isFinite(n)) return "";
  const t = Math.max(0, Math.min(100, n));
  const poor: [number, number, number] = [0x8f, 0xab, 0xdc];
  const mid: [number, number, number] = [0xff, 0xff, 0xff];
  const great: [number, number, number] = [0xd8, 0x21, 0x29];
  let rgb: [number, number, number];
  if (t <= 50) {
    const u = t / 50;
    rgb = [
      Math.round(lerpChannel(poor[0], mid[0], u)),
      Math.round(lerpChannel(poor[1], mid[1], u)),
      Math.round(lerpChannel(poor[2], mid[2], u)),
    ];
  } else {
    const u = (t - 50) / 50;
    rgb = [
      Math.round(lerpChannel(mid[0], great[0], u)),
      Math.round(lerpChannel(mid[1], great[1], u)),
      Math.round(lerpChannel(mid[2], great[2], u)),
    ];
  }
  const [r, g, b] = rgb;
  const lum = (299 * r + 587 * g + 114 * b) / 1000;
  const fg = lum > 125 ? "#000" : "#fff";
  return `background-color:rgb(${r},${g},${b});color:${fg};text-align:center`;
}

function fmt(value: unknown, kind: "int" | "1" | "avg" | "pct"): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(String(value).replace(/%/g, ""));
  if (!Number.isFinite(n)) {
    const s = String(value).trim();
    return s || "—";
  }
  if (kind === "int") return String(Math.round(n));
  if (kind === "1") return n.toFixed(1);
  if (kind === "pct") return n.toFixed(1);
  if (n >= 0 && n < 1) return n.toFixed(3).replace(/^0/, "");
  return n.toFixed(3);
}

function heatCell(display: string, pct: number | string | null | undefined): string {
  const style = percentileStyle(pct);
  if (style) return `<td style="${style}">${escapeHtml(display)}</td>`;
  return `<td style="text-align:center">${escapeHtml(display)}</td>`;
}

function headshot(playerId: number): string {
  return (
    `https://img.mlbstatic.com/mlb-photos/image/upload/` +
    `d_people:generic:headshot:67:current.png/w_64,q_auto:best/v1/people/${playerId}/headshot/67/current`
  );
}

function teamLogo(teamId: number): string {
  return `https://www.mlbstatic.com/team-logos/team-primary-on-light/${teamId}.svg`;
}

export function isSavantPreviewUrl(url: string): boolean {
  return /baseballsavant\.mlb\.com/i.test(url) && /\/preview(?:\?|#|$)/i.test(url);
}

/** True when an extract is Savant site navigation instead of Statcast tables. */
export function isSavantNavSoup(htmlOrText: string): boolean {
  if (/<h3>Hitters<\/h3>/i.test(htmlOrText) && /exit_velocity|xwOBA|Hard Hit/i.test(htmlOrText)) {
    return false;
  }
  return /League Batting|Leaderboards|Statcast Search|Metric Documentation|Gamefeed/i.test(
    htmlOrText,
  );
}

export function parseSavantTeamsJson(html: string): SavantTeamsPayload | null {
  const marker = html.match(/var\s+teams\s*=\s*\{/);
  if (!marker || marker.index == null) return null;
  const start = marker.index + marker[0].indexOf("{");
  let depth = 0;
  let end = -1;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end < 0) return null;
  try {
    return JSON.parse(html.slice(start, end)) as SavantTeamsPayload;
  } catch {
    return null;
  }
}

function sortHitters(players: SavantPlayer[]): SavantPlayer[] {
  return [...players].sort((a, b) => {
    const ao = Number(a.battingOrder ?? a.playerOrder ?? 9999);
    const bo = Number(b.battingOrder ?? b.playerOrder ?? 9999);
    if (ao !== bo) return ao - bo;
    return String(a.person?.fullName ?? "").localeCompare(String(b.person?.fullName ?? ""));
  });
}

function buildHittersTable(players: SavantPlayer[], startersOnly: boolean): string {
  const rows = sortHitters(
    startersOnly ? players.filter((p) => !p.gameStatus?.isOnBench) : players,
  );
  if (!rows.length) return "";
  const body = rows
    .map((p) => {
      const id = p.person?.id;
      const name = p.person?.fullName ?? "Player";
      const dnq = p.didNotQualify === "*" || p.didNotQualify === "true" ? "*" : "";
      const pos = p.position?.abbreviation ?? "—";
      const mug = id
        ? `<img class="rss-savant-mug" src="${headshot(id)}" alt="" width="28" height="28" loading="lazy" />`
        : "";
      const nameCell =
        `<td style="white-space:nowrap;vertical-align:middle">` +
        `<span style="display:inline-flex;align-items:center;gap:8px">` +
        mug +
        `<span>${escapeHtml(name)}${dnq}</span></span></td>`;
      return (
        `<tr>${nameCell}` +
        `<td style="text-align:center">${escapeHtml(pos)}</td>` +
        `<td style="text-align:center">${escapeHtml(fmt(p.batted_ball, "int"))}</td>` +
        `<td style="text-align:center">${escapeHtml(fmt(p.launch_angle_avg, "1"))}</td>` +
        heatCell(fmt(p.exit_velocity_avg, "1"), p.percent_rank_exit_velocity_avg) +
        heatCell(fmt(p.hard_hit_percent, "pct"), p.percent_rank_hard_hit_percent) +
        heatCell(fmt(p.xwoba, "avg"), p.percent_rank_xwoba) +
        heatCell(fmt(p.xba, "avg"), p.percent_rank_xba) +
        `</tr>`
      );
    })
    .join("");
  return (
    `<h3>Hitters</h3>` +
    `<table>` +
    `<thead><tr>` +
    `<th>Name</th><th>Pos.</th><th>BBE</th><th>LA°</th><th>EV</th>` +
    `<th>Hard Hit%</th><th>xwOBA</th><th>xBA</th>` +
    `</tr></thead><tbody>${body}</tbody></table>`
  );
}

function buildPitchersTable(players: SavantPlayer[]): string {
  const rows = [...players].sort((a, b) =>
    String(a.person?.fullName ?? "").localeCompare(String(b.person?.fullName ?? "")),
  );
  if (!rows.length) return "";
  const body = rows
    .map((p) => {
      const id = p.person?.id;
      const name = p.person?.fullName ?? "Pitcher";
      const dnq = p.didNotQualify === "*" || p.didNotQualify === "true" ? "*" : "";
      const mug = id
        ? `<img class="rss-savant-mug" src="${headshot(id)}" alt="" width="28" height="28" loading="lazy" />`
        : "";
      const nameCell =
        `<td style="white-space:nowrap;vertical-align:middle">` +
        `<span style="display:inline-flex;align-items:center;gap:8px">` +
        mug +
        `<span>${escapeHtml(name)}${dnq}</span></span></td>`;
      return (
        `<tr>${nameCell}` +
        heatCell(fmt(p.exit_velocity_avg, "1"), p.percent_rank_exit_velocity_avg) +
        heatCell(fmt(p.hard_hit_percent, "pct"), p.percent_rank_hard_hit_percent) +
        heatCell(fmt(p.xwoba, "avg"), p.percent_rank_xwoba) +
        heatCell(fmt(p.xba, "avg"), p.percent_rank_xba) +
        heatCell(fmt(p.k_percent, "pct"), p.percent_rank_k_percent) +
        heatCell(fmt(p.bb_percent, "pct"), p.percent_rank_bb_percent) +
        heatCell(fmt(p.whiff_percent, "pct"), p.percent_rank_whiff_percent) +
        `</tr>`
      );
    })
    .join("");
  return (
    `<h3>Pitchers</h3>` +
    `<table>` +
    `<thead><tr>` +
    `<th>Name</th><th>EV</th><th>Hard Hit%</th><th>xwOBA</th><th>xBA</th>` +
    `<th>K%</th><th>BB%</th><th>Whiff%</th>` +
    `</tr></thead><tbody>${body}</tbody></table>`
  );
}

function buildTeamSection(side: SavantSide, startersOnly: boolean): string {
  const team = side.team;
  const name = team?.name || team?.teamName || "Team";
  const teamId = team?.id;
  const logo = teamId
    ? `<img class="rss-savant-logo" src="${teamLogo(teamId)}" alt="${escapeHtml(name)}" width="48" height="48" loading="lazy" />`
    : "";
  const hittersHtml = buildHittersTable(
    side.roster?.hitters ?? [],
    startersOnly && Boolean(side.hasLineup),
  );
  const pitchersHtml = buildPitchersTable(side.roster?.pitchers ?? []);
  if (!hittersHtml && !pitchersHtml) return "";
  return (
    `<div class="rss-savant-team">` +
    `<p style="display:flex;align-items:center;gap:10px;margin:1.25rem 0 0.35rem">` +
    logo +
    `<strong style="font-size:1.15em">${escapeHtml(name)}</strong></p>` +
    hittersHtml +
    pitchersHtml +
    `</div>`
  );
}

export function buildSavantPreviewHtml(
  data: SavantTeamsPayload,
  opts: { focusTeamId?: number | null; focusFileCode?: string | null } = {},
): string {
  const sides: SavantSide[] = [];
  if (data.away) sides.push(data.away);
  if (data.home) sides.push(data.home);
  let chosen = sides;
  if (opts.focusTeamId) {
    const hit = sides.filter((s) => Number(s.team?.id) === opts.focusTeamId);
    if (hit.length) chosen = hit;
  } else if (opts.focusFileCode) {
    const code = opts.focusFileCode.toLowerCase();
    const hit = sides.filter((s) => (s.fileCode || "").toLowerCase() === code);
    if (hit.length) chosen = hit;
  }
  const startersOnly = chosen.some((s) => s.hasLineup);
  const sections = chosen
    .map((s) => buildTeamSection(s, startersOnly))
    .filter(Boolean);
  if (!sections.length) return "";
  const date = data.gameDate ? escapeHtml(String(data.gameDate)) : "";
  return (
    `<p><strong>Statcast Game Preview</strong>${date ? ` · ${date}` : ""}</p>` +
    sections.join("\n") +
    `<p style="margin-top:1rem;font-size:0.85em">` +
    `<span style="display:inline-block;width:12px;height:12px;background:#D82129;margin-right:4px;vertical-align:middle"></span> Great ` +
    `<span style="display:inline-block;width:12px;height:12px;background:#8fabdc;margin-left:10px;margin-right:4px;vertical-align:middle"></span> Poor` +
    ` · * Did Not Qualify</p>`
  );
}

/** Fetch a Savant /preview page and rebuild Statcast tables in the browser. */
export async function extractSavantPreviewInBrowser(
  url: string,
): Promise<SavantPreviewArticle | null> {
  if (!isSavantPreviewUrl(url)) return null;
  let gamePk: string | null = null;
  let focusTeamId: number | null = null;
  let focusFileCode: string | null = null;
  try {
    const u = new URL(url);
    gamePk = u.searchParams.get("game_pk") || u.searchParams.get("gamePk");
    const teamParam =
      u.searchParams.get("teamId") ||
      u.searchParams.get("team_id") ||
      u.searchParams.get("team");
    if (teamParam && /^\d+$/.test(teamParam)) focusTeamId = Number(teamParam);
    else if (teamParam && /^[a-z]{2,3}$/i.test(teamParam)) {
      focusFileCode = teamParam.toLowerCase();
    }
  } catch {
    return null;
  }
  if (!gamePk) return null;

  const previewUrl = `https://baseballsavant.mlb.com/preview?game_pk=${encodeURIComponent(gamePk)}`;
  const res = await fetch(previewUrl, {
    headers: { Accept: "text/html" },
    credentials: "omit",
  });
  if (!res.ok) return null;
  const html = await res.text();
  const teams = parseSavantTeamsJson(html);
  if (!teams?.away && !teams?.home) return null;
  const built = buildSavantPreviewHtml(teams, { focusTeamId, focusFileCode });
  if (!built || stripTags(built).length < 40) return null;
  if (isSavantNavSoup(built)) return null;

  const title =
    html.match(/<title[^>]*>([^<]+)/i)?.[1]?.replace(/\s*\|\s*MLB\.com.*$/i, "").trim() ||
    "Statcast Game Preview";
  const contentText = stripTags(built);
  return {
    url,
    title,
    byline: "Baseball Savant",
    image: null,
    contentHtml: built,
    contentText,
    wordCount: contentText.split(/\s+/).filter(Boolean).length,
  };
}
