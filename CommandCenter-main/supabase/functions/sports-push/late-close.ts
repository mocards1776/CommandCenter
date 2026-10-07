/**
 * Close-and-late gate for RUWT heat alerts.
 *
 * The drama score (live-drama.ts) still decides the heat line. This gate
 * only decides whether that line may mark a game hot for the push cross.
 * RUWT ranking, Today's Top, the card, and favorite start/final do not read it.
 *
 * A decided football game never alerts. The 97% leader win chance, and the
 * two-score clock fallback, match scoreNflRuwtGame / cfbEffectivelyDecided.
 * An unreadable period or clock is not late.
 */

export type ClockWindow = "early" | "late" | "unknown";

export type LateCloseGame = {
  detail?: string | null;
  /** ESPN shortDetail when the caller has not copied it onto detail. */
  shortDetail?: string | null;
  period?: number | null;
  awayScore?: number | null;
  homeScore?: number | null;
  away?: { score?: number | null };
  home?: { score?: number | null };
  /** Home win chance, 0–100 or a 0–1 rate. */
  homeWinPct?: number | null;
  /** Away win chance, 0–100 or a 0–1 rate. */
  awayWinPct?: number | null;
};

/** Same bar as the NFL and CFB rankers. */
const DECIDED_WIN_PCT = 97;
/** Two-score lead, no win chance, 4th or OT: 2:36 is inside, 4:00 is not. */
const DECIDED_CLOCK_SEC = 3 * 60;

const DRAMA_SPORTS = new Set(["mlb", "nfl", "nhl", "cfb", "soccer"]);

/**
 * True when a live game is close enough, late enough, and still in doubt
 * to count as hot for a heat alert.
 */
export function isLateAndClose(sport: string, game: LateCloseGame): boolean {
  if (!DRAMA_SPORTS.has(sport)) return false;
  if (clockWindow(sport, game) !== "late") return false;
  const diff = margin(game);
  if (diff == null) return false;
  if (!withinMargin(sport, diff)) return false;
  if ((sport === "nfl" || sport === "cfb") && effectivelyDecided(game, diff)) return false;
  return true;
}

/**
 * Hot flag the heat cross stores.
 * Over the line and late-and-close is hot.
 * A known early game is never hot, even when a previous sweep stored hot.
 * That false flag clears, and the sweep releases the heat claim on the drop.
 * Stickiness is only for an unreadable period or clock, so a blip does not
 * flap and ping again. A missing score also holds. A known late game that
 * is no longer close drops. Coming back is a new cross.
 */
export function heatCrossHot(input: {
  overLine: boolean;
  lateAndClose: boolean;
  window: ClockWindow;
  prevHot: boolean;
  scoresKnown: boolean;
}): boolean {
  if (!input.scoresKnown && input.prevHot) return true;
  if (!input.overLine) return false;
  if (input.lateAndClose) return true;
  if (input.prevHot && input.window === "unknown") return true;
  return false;
}

/** Period phrase for the heat reason line. Null when the game is not late. */
export function latePeriodChip(sport: string, game: LateCloseGame): string | null {
  if (clockWindow(sport, game) !== "late") return null;
  const text = detailText(game);
  const period = finitePeriod(game.period);
  switch (sport) {
    case "nhl":
      if (/\bot\b|overtime|shootout|\bso\b/.test(text) || (period != null && period >= 4)) {
        return "Overtime";
      }
      return "3rd period";
    case "nfl":
    case "cfb":
      if (/\bot\b|overtime/.test(text) || (period != null && period >= 5)) return "Overtime";
      return "4th quarter";
    case "mlb": {
      const inning = mlbInning(game);
      if (/\bextra/.test(text) || (inning != null && inning >= 10)) return "Extras";
      return "Late innings";
    }
    case "soccer":
      return "Late";
    default:
      return null;
  }
}

export function clockWindow(sport: string, game: LateCloseGame): ClockWindow {
  switch (sport) {
    case "nhl":
      return nhlWindow(game);
    case "nfl":
    case "cfb":
      return footballWindow(game);
    case "mlb":
      return mlbWindow(game);
    case "soccer":
      return soccerWindow(game);
    default:
      return "unknown";
  }
}

function withinMargin(sport: string, diff: number): boolean {
  switch (sport) {
    case "nhl":
    case "soccer":
      return diff <= 1;
    case "nfl":
    case "cfb":
      return diff <= 8;
    case "mlb":
      return diff <= 2;
    default:
      return false;
  }
}

/**
 * Leader win chance at or above 97% is over, at any clock.
 * With no win chance, only a two-score lead late and inside three minutes.
 * One score without a win chance stays in doubt. Three scores stay on the blowout path.
 */
function effectivelyDecided(game: LateCloseGame, diff: number): boolean {
  const leader = leaderWinPct(game);
  if (leader != null) return leader >= DECIDED_WIN_PCT;
  if (diff < 9 || diff > 16) return false;
  const clock = clockSeconds(detailText(game));
  return clock != null && clock <= DECIDED_CLOCK_SEC;
}

function leaderWinPct(game: LateCloseGame): number | null {
  const home = asPct(game.homeWinPct);
  const away = asPct(game.awayWinPct);
  if (home == null && away == null) return null;
  if (home != null && away != null) return Math.max(home, away);
  const one = (home ?? away) as number;
  return one >= 50 ? one : 100 - one;
}

function asPct(raw: number | null | undefined): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  const pct = raw <= 1 ? raw * 100 : raw;
  if (pct < 0 || pct > 100) return null;
  return pct;
}

/**
 * ESPN sometimes omits status.period and leaves the period only in
 * shortDetail ("1st", "2nd", "3rd", "OT", "Period 1"). An unreadable
 * period stays unknown and must not alert.
 */
function nhlPeriodFromText(text: string): number | null {
  if (/\bot\b|overtime|shootout|\bso\b/.test(text)) return 4;
  if (/\b3rd\b/.test(text)) return 3;
  if (/\b2nd\b/.test(text)) return 2;
  if (/\b1st\b/.test(text)) return 1;
  const labeled = text.match(/\bperiod\s*([1-5])\b/);
  if (!labeled) return null;
  const period = Number(labeled[1]);
  return Number.isFinite(period) ? period : null;
}

function nhlWindow(game: LateCloseGame): ClockWindow {
  const text = detailText(game);
  const fromStatus = finitePeriod(game.period);
  const period = fromStatus != null && fromStatus >= 1 ? fromStatus : nhlPeriodFromText(text);
  if (period == null) return "unknown";
  return period >= 3 ? "late" : "early";
}

function footballWindow(game: LateCloseGame): ClockWindow {
  const text = detailText(game);
  const period = finitePeriod(game.period);
  if (/\bot\b|overtime/.test(text)) return "late";
  if (period != null) {
    if (period >= 4) return "late";
    if (period >= 1) return "early";
  }
  if (/\b4th\b/.test(text)) return "late";
  if (/\b1st\b/.test(text) || /\b2nd\b/.test(text) || /\b3rd\b/.test(text)) return "early";
  return "unknown";
}

function mlbWindow(game: LateCloseGame): ClockWindow {
  const inning = mlbInning(game);
  if (inning == null) return "unknown";
  return inning >= 7 ? "late" : "early";
}

function mlbInning(game: LateCloseGame): number | null {
  const period = finitePeriod(game.period);
  if (period != null && period >= 1) return period;
  const text = detailText(game);
  if (/\bextra/.test(text)) return 10;
  const match = text.match(/\b(\d+)(?:st|nd|rd|th)\b/);
  if (!match) return null;
  const inning = Number(match[1]);
  return Number.isFinite(inning) ? inning : null;
}

function soccerWindow(game: LateCloseGame): ClockWindow {
  const text = detailText(game);
  const period = finitePeriod(game.period);
  if (/extra\s*time|\baet\b|\bet\b/.test(text) || (period != null && period >= 3)) return "late";
  const minute = soccerMinute(text);
  if (minute == null) return "unknown";
  return minute >= 70 ? "late" : "early";
}

function soccerMinute(text: string): number | null {
  const stoppage = text.match(/(\d+)\s*\+\s*(\d+)/);
  if (stoppage) return Number(stoppage[1]) + Number(stoppage[2]);
  const mark = text.match(/(\d+)\s*['′’]/);
  if (mark) return Number(mark[1]);
  const word = text.match(/\b(\d{1,3})\s*(?:min|minute)s?\b/);
  if (word) return Number(word[1]);
  return null;
}

function margin(game: LateCloseGame): number | null {
  const away = game.awayScore ?? game.away?.score ?? null;
  const home = game.homeScore ?? game.home?.score ?? null;
  if (typeof away !== "number" || typeof home !== "number") return null;
  if (!Number.isFinite(away) || !Number.isFinite(home)) return null;
  return Math.abs(away - home);
}

function detailText(game: LateCloseGame): string {
  return `${game.detail ?? ""} ${game.shortDetail ?? ""}`.toLowerCase();
}

function finitePeriod(period: number | null | undefined): number | null {
  if (typeof period !== "number" || !Number.isFinite(period)) return null;
  return period;
}

function clockSeconds(text: string): number | null {
  const match = text.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!match) return null;
  const min = Number(match[1]);
  const sec = Number(match[2]);
  if (!Number.isFinite(min) || !Number.isFinite(sec) || sec > 59) return null;
  return min * 60 + sec;
}
