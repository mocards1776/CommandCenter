/**
 * NHL win probability.
 *
 * ESPN's NHL summary, scoreboard, and core probabilities feed do not publish
 * `winprobability` or a matchup predictor (checked against live games). This is
 * a score / clock / strength model:
 *
 * Remaining goals are two independent Poissons. Even-strength rates are 2.70
 * (home) and 2.50 (away) per 60 minutes — a small home-ice edge. A current
 * power play adds 0.22 expected goals to that side. Ties at the end of
 * regulation (or a scoreless OT sample) split with a 53.5% home chance in
 * OT/SO. Overtime is sudden-death 3-on-3. Shootouts are a coin flip plus the
 * goals already on the board.
 *
 * The chart replays that model over ESPN play-by-play (period clock counts up,
 * score, power-play / shorthanded). The RUWT bar uses the scoreboard clock.
 */

export const NHL_PERIOD_SEC = 20 * 60;
export const NHL_REGULATION_SEC = 3 * NHL_PERIOD_SEC;
export const NHL_OT_SEC = 5 * 60;
const HOME_GOALS_PER_60 = 2.7;
const AWAY_GOALS_PER_60 = 2.5;
const PP_EXTRA_GOALS = 0.22;
const OT_HOME_RATE_PER_MIN = 0.1;
const OT_AWAY_RATE_PER_MIN = 0.092;
const TIE_HOME = 0.535;
const MAX_GOALS = 16;

export type NhlWinProbPoint = {
  playId: string;
  homeWinPct: number;
  tiePct: number;
  elapsedSec: number;
  period: number | null;
};

export type NhlWinProbSnapshot = {
  homeWinPct: number;
  awayWinPct: number;
  tiePct: number;
};

export type NhlWpStrength = "home" | "away" | null;

export type NhlLiveClock = {
  period: number;
  secondsLeftInPeriod: number;
};

export type NhlWpPlay = {
  id: string;
  period: number | null;
  /** Seconds elapsed in the period. ESPN play clocks count up from 0:00. */
  elapsedInPeriod: number | null;
  awayScore: number | null;
  homeScore: number | null;
  powerPlay: NhlWpStrength;
};

function clampPct(n: number): number {
  return Math.round(Math.max(0, Math.min(100, n)) * 10) / 10;
}

function poisson(lam: number): number[] {
  const out = new Array<number>(MAX_GOALS + 1);
  out[0] = Math.exp(-lam);
  for (let k = 1; k <= MAX_GOALS; k++) out[k] = (out[k - 1]! * lam) / k;
  return out;
}

function pairMass(home: number[], away: number[]): number {
  let mass = 0;
  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) mass += home[i]! * away[j]!;
  }
  return mass || 1;
}

/**
 * Home win chance, 0–100. Null when the score is missing.
 * `period` is 1–3, 4 for OT, 5 for a shootout.
 */
export function nhlHomeWinPct(input: {
  awayScore: number;
  homeScore: number;
  period: number;
  secondsLeftInPeriod: number;
  powerPlay?: NhlWpStrength;
}): number | null {
  const awayScore = input.awayScore;
  const homeScore = input.homeScore;
  if (!Number.isFinite(awayScore) || !Number.isFinite(homeScore)) return null;
  const diff = homeScore - awayScore;
  const period = input.period;
  const left = Math.max(0, input.secondsLeftInPeriod);
  const pp = input.powerPlay ?? null;

  if (period >= 5) {
    if (diff > 0) return 97;
    if (diff < 0) return 3;
    return clampPct(TIE_HOME * 100);
  }

  if (period === 4) {
    if (diff > 0) return 99.5;
    if (diff < 0) return 0.5;
    const minutes = Math.min(NHL_OT_SEC, left) / 60;
    const rh = OT_HOME_RATE_PER_MIN + (pp === "home" ? 0.04 : 0);
    const ra = OT_AWAY_RATE_PER_MIN + (pp === "away" ? 0.04 : 0);
    const quiet = Math.exp(-(rh + ra) * minutes);
    const homeFirst = (1 - quiet) * (rh / (rh + ra));
    return clampPct((homeFirst + quiet * TIE_HOME) * 100);
  }

  const periodLeft = Math.min(NHL_PERIOD_SEC, left);
  const futurePeriods = Math.max(0, 3 - Math.min(3, Math.max(1, period)));
  const secondsLeft = futurePeriods * NHL_PERIOD_SEC + (period >= 1 && period <= 3 ? periodLeft : NHL_PERIOD_SEC);
  if (secondsLeft <= 0) {
    if (diff > 0) return 99.5;
    if (diff < 0) return 0.5;
    return clampPct(TIE_HOME * 100);
  }

  const minutes = secondsLeft / 60;
  let lamH = (HOME_GOALS_PER_60 / 60) * minutes;
  let lamA = (AWAY_GOALS_PER_60 / 60) * minutes;
  if (pp === "home") lamH += PP_EXTRA_GOALS;
  if (pp === "away") lamA += PP_EXTRA_GOALS;
  const ph = poisson(lamH);
  const pa = poisson(lamA);
  const mass = pairMass(ph, pa);
  let win = 0;
  let tie = 0;
  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      const p = (ph[i]! * pa[j]!) / mass;
      const h = homeScore + i;
      const a = awayScore + j;
      if (h > a) win += p;
      else if (h === a) tie += p;
    }
  }
  return clampPct((win + tie * TIE_HOME) * 100);
}

function snapshot(homeWinPct: number | null): NhlWinProbSnapshot | null {
  if (homeWinPct == null || !Number.isFinite(homeWinPct)) return null;
  const home = clampPct(homeWinPct);
  return { homeWinPct: home, awayWinPct: clampPct(100 - home), tiePct: 0 };
}

/** Scoreboard strings such as "1:30 - 3rd" or "End of 2nd". Null when it is not a live clock. */
export function parseNhlLiveClock(text: string | null | undefined): NhlLiveClock | null {
  const blob = (text ?? "").replace(/\s+/g, " ").trim();
  if (!blob || /final/i.test(blob)) return null;
  if (/\bshootout\b|\bSO\b/i.test(blob)) return { period: 5, secondsLeftInPeriod: 0 };
  const end = /end of (1st|2nd|3rd)/i.exec(blob);
  if (end) {
    const period = end[1]!.toLowerCase() === "1st" ? 1 : end[1]!.toLowerCase() === "2nd" ? 2 : 3;
    return { period, secondsLeftInPeriod: 0 };
  }
  if (/1st intermission/i.test(blob)) return { period: 1, secondsLeftInPeriod: 0 };
  if (/2nd intermission/i.test(blob)) return { period: 2, secondsLeftInPeriod: 0 };
  const clock = /(\d{1,2}):(\d{2})/.exec(blob);
  if (!clock) return null;
  const sec = Number(clock[1]) * 60 + Number(clock[2]);
  if (/\bOT\b|overtime/i.test(blob)) {
    return { period: 4, secondsLeftInPeriod: Math.min(NHL_OT_SEC, sec) };
  }
  const per = /\b([1-3])(?:st|nd|rd)\b/i.exec(blob);
  if (!per) return null;
  return { period: Number(per[1]), secondsLeftInPeriod: Math.min(NHL_PERIOD_SEC, sec) };
}

/** Current bar for a live RUWT / scoreboard card. Hidden when the clock or score is missing. */
export function nhlWinProbFromScoreboard(game: {
  live: boolean;
  shortDetail?: string | null;
  status?: string | null;
  away: { score: number | null };
  home: { score: number | null };
  powerPlay?: NhlWpStrength;
}): NhlWinProbSnapshot | null {
  if (!game.live) return null;
  if (game.away.score == null || game.home.score == null) return null;
  const clock = parseNhlLiveClock(game.shortDetail) ?? parseNhlLiveClock(game.status);
  if (!clock) return null;
  return snapshot(
    nhlHomeWinPct({
      awayScore: game.away.score,
      homeScore: game.home.score,
      period: clock.period,
      secondsLeftInPeriod: clock.secondsLeftInPeriod,
      powerPlay: game.powerPlay ?? null,
    }),
  );
}

function periodLength(period: number): number {
  if (period >= 4 && period < 5) return NHL_OT_SEC;
  return NHL_PERIOD_SEC;
}

function elapsedSec(period: number, elapsedInPeriod: number): number {
  const used = Math.max(0, Math.min(periodLength(period), elapsedInPeriod));
  if (period <= 0) return 0;
  if (period <= 3) return (period - 1) * NHL_PERIOD_SEC + used;
  if (period === 4) return NHL_REGULATION_SEC + used;
  return NHL_REGULATION_SEC + NHL_OT_SEC + used;
}

function secondsLeftInPeriod(period: number, elapsedInPeriod: number): number {
  return Math.max(0, periodLength(period) - Math.max(0, elapsedInPeriod));
}

type State = {
  id: string;
  period: number;
  elapsed: number;
  secondsLeftInPeriod: number;
  away: number;
  home: number;
  powerPlay: NhlWpStrength;
};

function stateFromPlay(play: NhlWpPlay): State | null {
  if (play.period == null || play.period < 1) return null;
  if (play.elapsedInPeriod == null || play.awayScore == null || play.homeScore == null) return null;
  return {
    id: play.id,
    period: play.period,
    elapsed: elapsedSec(play.period, play.elapsedInPeriod),
    secondsLeftInPeriod: secondsLeftInPeriod(play.period, play.elapsedInPeriod),
    away: play.awayScore,
    home: play.homeScore,
    powerPlay: play.powerPlay,
  };
}

function toPoint(state: State, decided: number | null): NhlWinProbPoint | null {
  const homeWinPct =
    decided ??
    nhlHomeWinPct({
      awayScore: state.away,
      homeScore: state.home,
      period: state.period >= 5 ? 5 : state.period,
      secondsLeftInPeriod: state.secondsLeftInPeriod,
      powerPlay: state.powerPlay,
    });
  if (homeWinPct == null) return null;
  return {
    playId: state.id,
    homeWinPct,
    tiePct: 0,
    elapsedSec: state.elapsed,
    period: state.period,
  };
}

/**
 * Chart series from ESPN plays, plus the live scoreboard clock when the game
 * is still going. Empty when there is nothing to plot.
 */
export function buildNhlWinProbability(input: {
  plays: NhlWpPlay[];
  live: boolean;
  final: boolean;
  awayScore: number | null;
  homeScore: number | null;
  now?: NhlLiveClock | null;
  nowPowerPlay?: NhlWpStrength;
}): NhlWinProbPoint[] {
  const states: State[] = [];
  for (const play of input.plays) {
    const next = stateFromPlay(play);
    if (!next) continue;
    const prev = states[states.length - 1];
    if (prev && next.elapsed < prev.elapsed) next.elapsed = prev.elapsed;
    const changed =
      !prev ||
      next.away !== prev.away ||
      next.home !== prev.home ||
      next.powerPlay !== prev.powerPlay ||
      next.period !== prev.period ||
      next.elapsed - prev.elapsed >= 45;
    if (changed) states.push(next);
  }

  if (input.live && input.now && input.awayScore != null && input.homeScore != null) {
    const nowState: State = {
      id: "now",
      period: input.now.period,
      elapsed: elapsedSec(input.now.period, periodLength(input.now.period) - input.now.secondsLeftInPeriod),
      secondsLeftInPeriod: input.now.secondsLeftInPeriod,
      away: input.awayScore,
      home: input.homeScore,
      powerPlay: input.nowPowerPlay ?? states[states.length - 1]?.powerPlay ?? null,
    };
    const prev = states[states.length - 1];
    if (!prev || nowState.elapsed >= prev.elapsed) states.push(nowState);
  }

  const points: NhlWinProbPoint[] = [];
  for (const state of states) {
    const point = toPoint(state, null);
    if (point) points.push(point);
  }

  if (input.final && input.awayScore != null && input.homeScore != null && points.length) {
    const decided = input.homeScore > input.awayScore ? 99.5 : input.homeScore < input.awayScore ? 0.5 : 53.5;
    const last = points[points.length - 1]!;
    last.homeWinPct = decided;
    const end = last.period != null && last.period >= 4 ? last.elapsedSec : NHL_REGULATION_SEC;
    if (end > last.elapsedSec + 1) {
      points.push({
        playId: `${last.playId}-horn`,
        homeWinPct: decided,
        tiePct: 0,
        elapsedSec: end,
        period: last.period,
      });
    }
  }

  return points;
}

export type NhlWinProbPlot = {
  domain: number;
  nowX: number;
  line: string;
  area: string;
  last: { x: number; y: number } | null;
  ticks: number[];
  future: boolean;
};

export function plotNhlWinProbability(points: NhlWinProbPoint[]): NhlWinProbPlot | null {
  if (!points.length) return null;
  const maxT = points.reduce((m, p) => Math.max(m, p.elapsedSec), 0);
  const domain = Math.max(NHL_REGULATION_SEC, maxT);
  const coords = points.map((p) => ({
    x: (p.elapsedSec / domain) * 100,
    y: 100 - Math.max(0, Math.min(100, p.homeWinPct)),
  }));
  const first = coords[0];
  const last = coords[coords.length - 1] ?? null;
  const nowX = last ? last.x : 0;
  const line = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(2)} ${c.y.toFixed(2)}`)
    .join(" ");
  const area =
    first && last
      ? `M${first.x.toFixed(2)} 100 ${coords.map((c) => `L${c.x.toFixed(2)} ${c.y.toFixed(2)}`).join(" ")} L${last.x.toFixed(2)} 100 Z`
      : "";
  return {
    domain,
    nowX,
    line,
    area,
    last,
    ticks: [1, 2].map((p) => (p * NHL_PERIOD_SEC * 100) / domain),
    future: nowX < 99.2,
  };
}
