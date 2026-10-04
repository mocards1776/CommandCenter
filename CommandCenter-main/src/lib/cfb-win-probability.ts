/**
 * ESPN college-football win probability.
 *
 * The game summary (`winprobability`) is the series behind the chart: each row is
 * `homeWinPercentage` (0–1) for a play. The core probabilities feed is the lightweight
 * source for the current number on a live card. Nothing here is estimated locally.
 */

const FOOTBALL_CORE = "https://sports.core.api.espn.com/v2/sports/football/leagues";

export const CFB_QUARTER_SEC = 15 * 60;
export const CFB_REGULATION_SEC = 4 * CFB_QUARTER_SEC;

export type CfbWinProbPlayRef = {
  id: string;
  period: number | null;
  clock: string | null;
};

export type CfbWinProbPoint = {
  playId: string;
  /** Home win chance, 0–100. */
  homeWinPct: number;
  /** Tie chance, 0–100. */
  tiePct: number;
  /** Seconds since kickoff. Regulation is 0–3600; overtime runs past that. */
  elapsedSec: number;
  period: number | null;
};

export type CfbWinProbSnapshot = {
  homeWinPct: number;
  awayWinPct: number;
  tiePct: number;
};

export type CfbWinProbTeam = {
  abbrev: string;
  color: string;
  logo?: string | null;
};

export type CfbWinProbLeader = {
  abbrev: string;
  pct: number;
  color: string;
  logo: string | null;
  even: boolean;
};

type EspnWinProbRow = {
  homeWinPercentage?: number;
  awayWinPercentage?: number;
  tiePercentage?: number;
  playId?: string;
};

type Draft = {
  playId: string;
  homeWinPct: number;
  tiePct: number;
  elapsed: number | null;
  period: number | null;
  ot: boolean;
};

/** ESPN sends 0–1. Values already above 1 are treated as percents. */
export function espnRateToPct(n: number | undefined | null): number | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const pct = n <= 1 ? n * 100 : n;
  const clamped = Math.max(0, Math.min(100, pct));
  // ESPN rates are 4 decimals (0.2694). Round so 0.2694 * 100 stays 26.94.
  return Math.round(clamped * 10000) / 10000;
}

export function formatWinPct(pct: number): string {
  return (Math.round(pct * 10) / 10).toFixed(1);
}

/** Relative luminance, 0–1. Used so marks stay readable on team color. */
export function isLightTeamColor(color: string): boolean {
  const raw = color.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return false;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return y > 0.62;
}

function clockRemainSec(clock: string | null | undefined): number | null {
  if (!clock) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(clock.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Yards-style clock → seconds elapsed in a 15:00 quarter. OT returns null. */
function regulationElapsed(period: number, clock: string | null | undefined): number | null {
  if (period < 1 || period > 4) return null;
  const remain = clockRemainSec(clock);
  if (remain == null) return null;
  const clamped = Math.max(0, Math.min(CFB_QUARTER_SEC, remain));
  return (period - 1) * CFB_QUARTER_SEC + (CFB_QUARTER_SEC - clamped);
}

function assignElapsed(drafts: Draft[]): number[] {
  const n = drafts.length;
  const out: (number | null)[] = drafts.map((d) => (d.ot ? null : d.elapsed));
  let cursor = 0;
  for (let i = 0; i < n; i++) {
    if (drafts[i].ot) {
      const floor = Math.max(CFB_REGULATION_SEC, cursor);
      cursor = floor + 20;
      out[i] = cursor;
      continue;
    }
    if (out[i] != null) cursor = out[i]!;
  }

  let i = 0;
  while (i < n) {
    if (out[i] != null) {
      i++;
      continue;
    }
    const start = i;
    while (i < n && out[i] == null) i++;
    const end = i;
    const slots = end - start;
    const leftIdx = start - 1;
    const rightIdx = end < n ? end : -1;
    const leftT = leftIdx >= 0 && out[leftIdx] != null ? out[leftIdx]! : 0;
    const rightT =
      rightIdx >= 0 && out[rightIdx] != null
        ? out[rightIdx]!
        : Math.max(leftT, CFB_REGULATION_SEC);
    const gaps = slots + 1;
    for (let k = 0; k < slots; k++) {
      out[start + k] = leftT + ((k + 1) * (rightT - leftT)) / gaps;
    }
  }

  const nums = out.map((t, idx) =>
    t == null ? (n === 1 ? 0 : (idx / Math.max(1, n - 1)) * CFB_REGULATION_SEC) : t,
  );
  for (let j = 1; j < nums.length; j++) {
    if (nums[j] < nums[j - 1]) nums[j] = nums[j - 1];
  }
  return nums;
}

/**
 * Join ESPN's `winprobability` array to play clocks.
 * Series order is kept. Plays without a clock are spaced between the neighbors
 * that do have one — the percentages themselves are never invented.
 */
export function mapCfbWinProbability(
  series: EspnWinProbRow[] | null | undefined,
  plays: CfbWinProbPlayRef[] | null | undefined,
): CfbWinProbPoint[] {
  if (!series?.length) return [];
  const byId = new Map((plays ?? []).map((p) => [String(p.id), p]));
  const drafts: Draft[] = [];
  series.forEach((row, index) => {
    const home = espnRateToPct(row.homeWinPercentage);
    if (home == null) return;
    const tie = espnRateToPct(row.tiePercentage) ?? 0;
    const playId = row.playId != null && String(row.playId) ? String(row.playId) : `play-${index}`;
    const play = byId.get(playId);
    const period = play?.period ?? null;
    const ot = period != null && period > 4;
    drafts.push({
      playId,
      homeWinPct: home,
      tiePct: tie,
      elapsed: period != null && !ot ? regulationElapsed(period, play?.clock) : null,
      period,
      ot,
    });
  });
  if (!drafts.length) return [];
  const elapsed = assignElapsed(drafts);
  return drafts.map((d, i) => ({
    playId: d.playId,
    homeWinPct: d.homeWinPct,
    tiePct: d.tiePct,
    elapsedSec: elapsed[i] ?? 0,
    period: d.period,
  }));
}

/** X-axis length: a full regulation, or longer once overtime plays exist. */
export function cfbWinProbDomainSec(points: CfbWinProbPoint[]): number {
  const maxT = points.reduce((m, p) => Math.max(m, p.elapsedSec), 0);
  return Math.max(CFB_REGULATION_SEC, maxT);
}

export function cfbWinProbLeader(
  homeWinPct: number,
  away: CfbWinProbTeam,
  home: CfbWinProbTeam,
  tiePct = 0,
  awayWinPct?: number | null,
): CfbWinProbLeader {
  const awayPct =
    awayWinPct != null && Number.isFinite(awayWinPct)
      ? awayWinPct
      : Math.max(0, 100 - homeWinPct - tiePct);
  if (Math.abs(homeWinPct - awayPct) < 0.05) {
    return {
      abbrev: "EVEN",
      pct: homeWinPct,
      color: "334155",
      logo: null,
      even: true,
    };
  }
  if (homeWinPct > awayPct) {
    return {
      abbrev: home.abbrev,
      pct: homeWinPct,
      color: home.color,
      logo: home.logo ?? null,
      even: false,
    };
  }
  return {
    abbrev: away.abbrev,
    pct: awayPct,
    color: away.color,
    logo: away.logo ?? null,
    even: false,
  };
}

export function snapshotFromEspnProbability(
  row: EspnWinProbRow | null | undefined,
): CfbWinProbSnapshot | null {
  const home = espnRateToPct(row?.homeWinPercentage);
  if (home == null || !row) return null;
  const tie = espnRateToPct(row.tiePercentage) ?? 0;
  const away = espnRateToPct(row.awayWinPercentage) ?? Math.max(0, 100 - home - tie);
  return { homeWinPct: home, awayWinPct: away, tiePct: tie };
}

type ProbPage = {
  count?: number;
  pageCount?: number;
  items?: EspnWinProbRow[];
};

/**
 * Latest ESPN win probability for one game.
 * Two small core-API pages (count, then the last row). Returns null when ESPN
 * has not published a probability yet.
 */
async function fetchFootballCurrentWinProbability(
  league: "college-football" | "nfl",
  eventId: string,
): Promise<CfbWinProbSnapshot | null> {
  try {
    const base = `${FOOTBALL_CORE}/${league}/events/${encodeURIComponent(eventId)}/competitions/${encodeURIComponent(eventId)}/probabilities?limit=1`;
    const firstRes = await fetch(base, { headers: { Accept: "application/json" } });
    if (!firstRes.ok) return null;
    const first = (await firstRes.json()) as ProbPage;
    const pageCount = Number(first.pageCount) || 0;
    if (!pageCount) return null;
    const row =
      pageCount <= 1
        ? first.items?.[0]
        : await (async () => {
            const res = await fetch(`${base}&page=${pageCount}`, {
              headers: { Accept: "application/json" },
            });
            if (!res.ok) return null;
            const page = (await res.json()) as ProbPage;
            return page.items?.[0] ?? null;
          })();
    return snapshotFromEspnProbability(row);
  } catch {
    return null;
  }
}

/** Latest ESPN win probability for one college game. */
export function fetchCfbCurrentWinProbability(
  eventId: string,
): Promise<CfbWinProbSnapshot | null> {
  return fetchFootballCurrentWinProbability("college-football", eventId);
}

/** Latest ESPN win probability for one NFL game. Same feed shape as college. */
export function fetchNflCurrentWinProbability(
  eventId: string,
): Promise<CfbWinProbSnapshot | null> {
  return fetchFootballCurrentWinProbability("nfl", eventId);
}
