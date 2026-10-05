/**
 * Official NHL Three Stars from api-web.nhle.com gamecenter landing.
 *
 * ESPN summaries do not include stars. The app already reads the same
 * `summary.threeStars` field (CommandCenter-main/src/lib/nhl.ts). Stars
 * usually appear shortly after the horn; they are sometimes late and
 * occasionally never posted. Callers retry briefly, then render without.
 */

export type NhlLandingStar = {
  star: 1 | 2 | 3;
  nhlPlayerId: number;
  name: string;
  teamAbbrev: string;
  headshot: string | null;
  sweaterNo: string | null;
  position: string | null;
  goals: number | null;
  assists: number | null;
  points: number | null;
  goalsAgainstAverage: number | null;
  savePctg: number | null;
};

type Rec = Record<string, unknown>;

function rec(value: unknown): Rec {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Rec) : {};
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

const NHL_TO_ESPN: Record<string, string> = { LAK: "LA", NJD: "NJ", SJS: "SJ", TBL: "TB" };

export function canonNhlAbbrev(abbrev: string | null | undefined): string {
  const up = (abbrev ?? "").toUpperCase();
  return NHL_TO_ESPN[up] ?? up;
}

export function mapThreeStars(raw: unknown): NhlLandingStar[] {
  return arr(raw)
    .map((row) => rec(row))
    .filter((s) => {
      const star = num(s.star);
      return Boolean(s.playerId) && (star === 1 || star === 2 || star === 3);
    })
    .map((s) => ({
      star: num(s.star) as 1 | 2 | 3,
      nhlPlayerId: num(s.playerId) ?? 0,
      name: str(rec(s.name).default) || str(s.name) || "Player",
      teamAbbrev: canonNhlAbbrev(str(s.teamAbbrev)),
      headshot: str(s.headshot) || null,
      sweaterNo: s.sweaterNo != null ? String(s.sweaterNo) : null,
      position: str(s.position) || null,
      goals: num(s.goals),
      assists: num(s.assists),
      points: num(s.points),
      goalsAgainstAverage: num(s.goalsAgainstAverage),
      savePctg: num(s.savePctg),
    }))
    .sort((a, b) => a.star - b.star);
}

export function starLine(star: NhlLandingStar): string {
  if (star.position === "G") {
    const bits: string[] = [];
    if (star.savePctg != null) bits.push(`${star.savePctg.toFixed(3).replace(/^0/, "")} SV%`);
    if (star.goalsAgainstAverage != null) bits.push(`${star.goalsAgainstAverage.toFixed(2)} GAA`);
    return bits.join(" · ") || "Goalie";
  }
  const g = star.goals ?? 0;
  const a = star.assists ?? 0;
  const p = star.points ?? g + a;
  return `${g} G · ${a} A · ${p} P`;
}

async function fetchJson(url: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "CommandCenterSportsFinals" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveNhlGameId(input: {
  date: string | null;
  awayAbbrev: string;
  homeAbbrev: string;
}): Promise<number | null> {
  const startMs = Date.parse(input.date ?? "");
  if (!Number.isFinite(startMs)) return null;
  const from = new Date(startMs - 86_400_000).toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
  const away = canonNhlAbbrev(input.awayAbbrev);
  const home = canonNhlAbbrev(input.homeAbbrev);
  const raw = rec(await fetchJson(`https://api-web.nhle.com/v1/schedule/${from}`));
  let best: { id: number; gap: number } | null = null;
  for (const day of arr(raw.gameWeek)) {
    for (const game of arr(rec(day).games)) {
      const g = rec(game);
      const id = num(g.id);
      if (id == null) continue;
      if (canonNhlAbbrev(str(rec(g.awayTeam).abbrev)) !== away) continue;
      if (canonNhlAbbrev(str(rec(g.homeTeam).abbrev)) !== home) continue;
      const gap = Math.abs(Date.parse(str(g.startTimeUTC)) - startMs);
      if (!Number.isFinite(gap) || gap > 36 * 3_600_000) continue;
      if (!best || gap < best.gap) best = { id, gap };
    }
  }
  return best?.id ?? null;
}

export async function fetchNhlThreeStars(input: {
  date: string | null;
  awayAbbrev: string;
  homeAbbrev: string;
}): Promise<NhlLandingStar[]> {
  const nhlGameId = await resolveNhlGameId(input);
  if (nhlGameId == null) return [];
  const landing = rec(await fetchJson(`https://api-web.nhle.com/v1/gamecenter/${nhlGameId}/landing`));
  return mapThreeStars(rec(landing.summary).threeStars);
}

/** First fetch + 3 waits of 20s ≈ 60s. Stars usually land in that window. */
export const NHL_STARS_RETRY_ATTEMPTS = 3;
export const NHL_STARS_RETRY_MS = 20_000;

export async function fetchNhlThreeStarsWithRetry(
  input: {
    date: string | null;
    awayAbbrev: string;
    homeAbbrev: string;
  },
  opts: { wait: boolean; sleep?: (ms: number) => Promise<void> } = { wait: false },
): Promise<NhlLandingStar[]> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  let stars = await fetchNhlThreeStars(input);
  if (stars.length || !opts.wait) return stars;
  for (let i = 0; i < NHL_STARS_RETRY_ATTEMPTS; i++) {
    await sleep(NHL_STARS_RETRY_MS);
    stars = await fetchNhlThreeStars(input);
    if (stars.length) return stars;
  }
  return stars;
}
