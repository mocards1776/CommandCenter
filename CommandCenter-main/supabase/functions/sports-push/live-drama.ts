/**
 * Live-drama heat line for sports push.
 *
 * RUWT owns ranking. This is the push hook until RUWT exports a shared
 * helper. It reads the same in-game drama terms the live scorers already use
 * (margin, inning, extras, quarter, overtime, red zone) and nothing else.
 *
 * Ignored on purpose — they move Today's Top and the full RUWT rank, not
 * whether a live game has become hot:
 *   - October/November series weight and the live playoff nudge
 *   - the Cardinals bump
 *   - interest sliders, favorite players, favorite managers
 *   - CFB rank / FPI / betting line / national TV
 *   - soccer league and "followed club" bumps
 *
 * The line is 68: a one-score NFL, NHL, or CFB game (live 40 + one-score 28).
 * A bare MLB one-run game is 66 in the scorer (live 42 + one-run 24). Those
 * two points are the live-base gap, not extra heat, so a bare one-run is
 * lifted onto 68. Do not close that gap with series weight or Cardinals.
 *
 * A 0–0 opening is the start of the game, not a cross. Scoreless games stay
 * under the line until they are late or in extras/overtime.
 */

export const ONE_SCORE_HEAT_LINE = 68;

/** Live 42 + one-run 24 = 66. The cross-sport one-score floor is 68. */
export const MLB_ONE_RUN_LINE_GAP = 2;

export type DramaSport = "mlb" | "nfl" | "nhl" | "cfb" | "soccer";

export type LiveDramaInput = {
  sport: DramaSport;
  live: boolean;
  final: boolean;
  awayScore: number | null;
  homeScore: number | null;
  /** ESPN shortDetail / MLB inning label. */
  detail: string;
  period?: number | null;
  redZone?: boolean;
  downDistance?: string | null;
};

export type LiveDrama = {
  score: number;
  hot: boolean;
  /** Drama phrase for the notification. Never playoff, series, or favorite. */
  why: string;
  reasons: string[];
};

export type GamePhase = "pregame" | "live" | "final";

export type PhaseSnapshot = {
  phase: GamePhase;
  hot: boolean;
};

export type AlertKind = "heat" | "favorite-start" | "favorite-final";

const MARGIN_WHY = ["One-score game", "One-run game", "One-goal game", "Tied"] as const;
const SITUATION_WHY = [
  "Extras",
  "Overtime",
  "Closing seconds",
  "Final minute",
  "Two-minute drill",
  "Late innings",
  "Late & close",
  "4th quarter",
  "Late",
  "Red zone",
  "4th down",
] as const;

export function gamePhase(game: { live: boolean; final: boolean }): GamePhase {
  if (game.final) return "final";
  if (game.live) return "live";
  return "pregame";
}

/**
 * Alerts for one poll step.
 * The first time a game is seen, nothing fires — that sample is the baseline,
 * so a deploy does not push every game that is already hot or already final.
 * Heat fires once on the rising edge. A later dip and re-cross is suppressed
 * by the sent-log (one heat push per game).
 */
export function crossingAlerts(prev: PhaseSnapshot | null, next: PhaseSnapshot): AlertKind[] {
  if (!prev) return [];
  const out: AlertKind[] = [];
  if (next.phase === "live" && next.hot && !prev.hot) out.push("heat");
  if (prev.phase === "pregame" && next.phase === "live") out.push("favorite-start");
  if (prev.phase !== "final" && next.phase === "final") out.push("favorite-final");
  return out;
}

export function liveDrama(input: LiveDramaInput): LiveDrama {
  if (!input.live || input.final || !isDramaSport(input.sport)) {
    return { score: 0, hot: false, why: "", reasons: [] };
  }
  const scored = scoreSport(input);
  const score = Math.max(0, scored.score);
  const reasons = unique(scored.reasons);
  const hot = score >= ONE_SCORE_HEAT_LINE;
  return { score, hot, why: hot ? dramaWhy(reasons) : "", reasons };
}

export function dramaWhy(reasons: readonly string[]): string {
  const have = new Set(reasons);
  const margin = MARGIN_WHY.find((r) => have.has(r)) ?? "";
  const situation = SITUATION_WHY.find((r) => have.has(r)) ?? "";
  if (margin && situation) return `${margin} · ${situation}`;
  return margin || situation || "One-score game";
}

function isDramaSport(sport: string): sport is DramaSport {
  return sport === "mlb" || sport === "nfl" || sport === "nhl" || sport === "cfb" || sport === "soccer";
}

function scoreSport(input: LiveDramaInput): { score: number; reasons: string[] } {
  switch (input.sport) {
    case "mlb":
      return scoreMlb(input);
    case "nfl":
      return scoreNfl(input);
    case "nhl":
      return scoreNhl(input);
    case "cfb":
      return scoreCfb(input);
    case "soccer":
      return scoreSoccer(input);
  }
}

function nums(input: LiveDramaInput): { diff: number | null; total: number | null; scoreless: boolean } {
  const away = input.awayScore;
  const home = input.homeScore;
  if (away == null || home == null || !Number.isFinite(away) || !Number.isFinite(home)) {
    return { diff: null, total: null, scoreless: false };
  }
  return { diff: Math.abs(away - home), total: away + home, scoreless: away === 0 && home === 0 };
}

function detail(input: LiveDramaInput): string {
  return `${input.detail ?? ""}`.toLowerCase();
}

function scoreMlb(input: LiveDramaInput): { score: number; reasons: string[] } {
  let score = 42;
  const reasons = ["Live"];
  const { diff, total, scoreless } = nums(input);
  const text = detail(input);
  const extras = /extra|10th|11th|12th|13th|14th|15th|16th|17th|18th/.test(text);
  const late =
    /\b(7th|8th|9th)\b/.test(text) ||
    /mid\s*7|top\s*7|bot\s*7|end\s*7|mid\s*8|top\s*8|bot\s*8|end\s*8|mid\s*9|top\s*9|bot\s*9|end\s*9/.test(
      text,
    );
  const opening = scoreless && !extras && !late;

  if (diff != null && !opening) {
    if (diff === 0) {
      score += 28;
      reasons.push("Tied");
    } else if (diff === 1) {
      score += 24;
      reasons.push("One-run game");
    } else if (diff === 2) {
      score += 14;
      reasons.push("Within two");
    } else if (diff <= 3) {
      score += 8;
      reasons.push("Tight");
    } else if (diff >= 7) {
      score -= 16;
      reasons.push("Blowout");
    } else if (diff >= 5) {
      score -= 8;
    }
  }

  if (extras) {
    score += 32;
    reasons.push("Extras");
  } else if (late) {
    score += 18;
    reasons.push("Late innings");
  }

  if (total != null && !opening && total >= 12) {
    score += 12;
    reasons.push("Slugfest");
  } else if (total != null && !opening && total >= 9) {
    score += 6;
    reasons.push("High scoring");
  }

  // Bare one-run (66) matches a one-score game in another sport (68).
  if (reasons.includes("One-run game") && score === 66) score += MLB_ONE_RUN_LINE_GAP;

  return { score, reasons };
}

function footballLate(input: LiveDramaInput, text: string): boolean {
  const period = input.period ?? null;
  return (period != null && period >= 4) || /\b4th\b/.test(text) || /\bot\b|overtime/.test(text);
}

function scoreNfl(input: LiveDramaInput): { score: number; reasons: string[] } {
  let score = 40;
  const reasons = ["Live"];
  const { diff, scoreless } = nums(input);
  const text = detail(input);
  const late = footballLate(input, text);
  const opening = scoreless && !late;

  if (diff != null && !opening) {
    if (diff <= 3) {
      score += 28;
      reasons.push("One-score game");
    } else if (diff <= 8) {
      score += 14;
      reasons.push("Tight");
    }
  }
  if (input.redZone) {
    score += 18;
    reasons.push("Red zone");
  }
  if (input.downDistance?.startsWith("4th") && late) {
    score += 12;
    reasons.push("4th down");
  }
  if (late && (input.period === 4 || /\b4th\b/.test(text))) reasons.push("4th quarter");
  return { score, reasons };
}

function scoreNhl(input: LiveDramaInput): { score: number; reasons: string[] } {
  let score = 40;
  const reasons = ["Live"];
  const { diff, scoreless } = nums(input);
  const text = detail(input);
  const ot = /\bot\b|overtime|shootout|\bso\b/.test(text) || (input.period != null && input.period >= 4);
  const third = /\b3rd\b/.test(text) || input.period === 3;
  const opening = scoreless && !ot && !third;

  if (diff != null && !opening) {
    if (diff <= 1) {
      score += 28;
      reasons.push(diff === 0 ? "Tied" : "One-goal game");
    } else if (diff <= 2) {
      score += 14;
      reasons.push("Tight");
    }
  }
  if (ot) {
    score += 18;
    reasons.push("Overtime");
  } else if (third && diff != null && diff <= 1 && !opening) {
    score += 12;
    reasons.push("Late & close");
  }
  return { score, reasons };
}

function parseClockSeconds(text: string): number | null {
  const m = text.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!m) return null;
  const min = Number(m[1]);
  const sec = Number(m[2]);
  if (!Number.isFinite(min) || !Number.isFinite(sec) || sec > 59) return null;
  return min * 60 + sec;
}

function scoreCfb(input: LiveDramaInput): { score: number; reasons: string[] } {
  let score = 40;
  const reasons = ["Live"];
  const { diff, scoreless } = nums(input);
  const text = detail(input);
  const period = input.period ?? null;
  const inOt = (period != null && period >= 5) || /\bot\b|overtime/.test(text);
  const fourth = period === 4 || /\b4th\b/.test(text);
  const third = period === 3 || /\b3rd\b/.test(text);
  const opening = scoreless && !inOt && !fourth;

  if (diff != null && !opening) {
    if (diff <= 8) {
      score += 28;
      reasons.push("One-score game");
      if (diff <= 3 && diff > 0) {
        score += 6;
        reasons.push("Within a kick");
      }
    } else if (diff <= 14) {
      score += 10;
      reasons.push("Tight");
    } else if (diff >= 28) {
      score -= 20;
      reasons.push("Blowout");
    } else if (diff >= 21) {
      score -= 14;
      reasons.push("Blowout");
    } else {
      score -= 8;
    }
  }

  if (inOt) {
    score += 32;
    reasons.push("Overtime");
  } else if (diff == null || diff <= 14) {
    if (fourth && !opening) {
      score += 18;
      reasons.push("4th quarter");
    } else if (third && !opening) {
      score += 8;
      reasons.push("3rd quarter");
    }
  }

  if (diff != null && diff <= 8 && (inOt || fourth) && !opening) {
    const clock = parseClockSeconds(text);
    if (clock != null && clock <= 120) {
      if (clock <= 30) {
        score += 22;
        reasons.push("Closing seconds");
      } else if (clock <= 60) {
        score += 16;
        reasons.push("Final minute");
      } else {
        score += 10;
        reasons.push("Two-minute drill");
      }
    }
  }

  if (input.redZone && (diff == null || diff <= 14)) {
    score += 18;
    reasons.push("Red zone");
  }
  if (
    input.downDistance?.startsWith("4th") &&
    (diff == null || diff <= 14) &&
    (fourth || third || inOt)
  ) {
    score += 12;
    reasons.push("4th down");
  }

  return { score, reasons };
}

function soccerMinute(text: string): number | null {
  const et = text.match(/(\d+)\s*\+\s*(\d+)/);
  if (et) return Number(et[1]) + Number(et[2]);
  const m = text.match(/(\d+)\s*'/);
  if (m) return Number(m[1]);
  return null;
}

function scoreSoccer(input: LiveDramaInput): { score: number; reasons: string[] } {
  // The soccer ranker only adds +8 for a tight score, so a one-goal match
  // never reaches 68. Heat uses the same live + one-score floor as the
  // other sports. League and interest bumps stay on the ranker.
  let score = 40;
  const reasons = ["Live"];
  const { diff, scoreless } = nums(input);
  const text = detail(input);
  const minute = soccerMinute(text);
  const extraTime = /extra\s*time|\bet\b|aet/.test(text);
  const late = extraTime || (minute != null && minute >= 80);
  const opening = scoreless && !late && !extraTime;

  if (diff != null && !opening && diff <= 1) {
    score += 28;
    reasons.push(diff === 0 ? "Tied" : "One-goal game");
  }
  if (late && !opening) reasons.push("Late");
  return { score, reasons };
}

function unique(reasons: string[]): string[] {
  const out: string[] = [];
  for (const r of reasons) if (r && !out.includes(r)) out.push(r);
  return out;
}

export type PushSide = {
  id: string;
  abbrev: string;
  name: string;
  score: number | null;
  logo: string | null;
  /** AP Top 25 when the scoreboard has one. 99 and blanks stay empty. */
  rank?: number | null;
};

export type PushGame = {
  sport: string;
  id: string;
  live: boolean;
  final: boolean;
  detail: string;
  period: number | null;
  redZone: boolean;
  downDistance: string | null;
  when: string | null;
  /** Network names already shown on the RUWT card. Display only. */
  broadcasts?: string[];
  /** Soccer league label, e.g. Premier League. */
  league?: string | null;
  away: PushSide;
  home: PushSide;
};

export type PushFavorite = {
  key: string;
  sport: string;
  teamId: string;
  shortName: string;
};

export type PushNote = {
  title: string;
  body: string;
  icon: string | null;
  /** Large image for clients that expand the note. Omitted when there is no logo. */
  image: string | null;
  tag: string;
  url: string;
  reason: AlertKind;
  sport: string;
  gameId: string;
  silent: boolean;
  /** Same tag updates in place. A second buzz would stack alerts for one game. */
  renotify: boolean;
  vibrate: number[];
};

export function gameKey(game: { sport: string; id: string }): string {
  return `${game.sport}:${game.id}`;
}

export function gameHref(game: { sport: string; id: string }): string {
  switch (game.sport) {
    case "mlb":
      return `/sports/mlb/game/${game.id}?solo=1`;
    case "nfl":
      return `/sports/nfl/game/${game.id}?solo=1`;
    case "nhl":
      return `/sports/nhl/game/${game.id}?solo=1`;
    case "cfb":
      return `/sports/cfb/game/${game.id}?solo=1`;
    case "soccer":
      return `/sports/soccer/game/${game.id}?solo=1`;
    default:
      return "/sports?solo=1";
  }
}

export function startVerb(sport: string): string {
  if (sport === "mlb") return "First pitch";
  if (sport === "nhl") return "Puck drop";
  if (sport === "nba" || sport === "cbb") return "Tip-off";
  return "Kickoff";
}

export function favoriteSide(game: PushGame, fav: PushFavorite): PushSide | null {
  if (fav.sport !== game.sport) return null;
  if (game.away.id === fav.teamId) return game.away;
  if (game.home.id === fav.teamId) return game.home;
  return null;
}

function scoreLine(game: PushGame): string {
  const a = game.away.score == null ? "" : ` ${game.away.score}`;
  const h = game.home.score == null ? "" : ` ${game.home.score}`;
  if (game.away.score == null && game.home.score == null) {
    return `${game.away.name} at ${game.home.name}`;
  }
  return `${game.away.name}${a}, ${game.home.name}${h}`;
}

function leadLogo(game: PushGame): string | null {
  const away = game.away.score;
  const home = game.home.score;
  if (away != null && home != null && away !== home) {
    return (away > home ? game.away.logo : game.home.logo) || game.home.logo || game.away.logo;
  }
  return game.home.logo || game.away.logo;
}

const GENERIC_CARD_REASONS = new Set(["live", "upcoming", "final", "live now"]);

/** Slider and personal chips. Heat copy never mentions them. */
const PERSONAL_REASON =
  /interest|your #1|on your board|high interest|favorite|playoff|series|\bcardinals\b|^watch\b/i;

const HEAT_CHIP_CAP = 5;
const HEAT_VIBRATE = [80, 40, 80];
const FAVORITE_VIBRATE = [40];

function cleanChip(label: string): string | null {
  const text = label.trim();
  if (!text || GENERIC_CARD_REASONS.has(text.toLowerCase())) return null;
  if (PERSONAL_REASON.test(text) || /^heat\b/i.test(text)) return null;
  return text;
}

function shownRank(rank: number | null | undefined): number | null {
  if (typeof rank !== "number" || !Number.isFinite(rank) || rank < 1 || rank > 25) return null;
  return rank;
}

/**
 * National TV uses the CFB card's window list (ABC/CBS/NBC/FOX and
 * TNT/TBS/USA/Peacock/Netflix). ESPN-only windows are not that chip.
 * This does not change the heat score.
 */
function cfbNationalTv(names: readonly string[]): boolean {
  const nets = names.map((name) => name.toUpperCase());
  const bigFour = nets.some((name) => /\b(ABC|CBS|NBC|FOX)\b/.test(name));
  const cable = nets.some((name) => /\b(TNT|TBS|USA|PEACOCK|NETFLIX)\b/.test(name));
  return bigFour || cable;
}

/** Public reason chips the RUWT card already prints for this game. */
function publicCardChips(game: PushGame): string[] {
  const out: string[] = [];
  if (game.sport === "cfb") {
    const ranks = [shownRank(game.away.rank), shownRank(game.home.rank)].filter(
      (rank): rank is number => rank != null,
    );
    if (ranks.length >= 2) out.push("Ranked matchup");
    else if (ranks.length === 1) out.push("Ranked team");
    if (cfbNationalTv(game.broadcasts ?? [])) out.push("National TV");
  }
  if (game.sport === "soccer" && /premier league/i.test(game.league ?? "")) {
    out.push("Premier League");
  }
  return out;
}

/**
 * Heat words follow the card reason line: drama chips, then ranked / national
 * TV when the card would say them. The heat number and the interest slider
 * are not on this line.
 */
export function heatReasonChips(game: PushGame, drama: LiveDrama): string[] {
  const dramaChips: string[] = [];
  for (const reason of drama.reasons) {
    const chip = cleanChip(reason);
    if (chip && !dramaChips.includes(chip)) dramaChips.push(chip);
  }
  if (!dramaChips.length) {
    const why = cleanChip(drama.why);
    if (why) dramaChips.push(why);
  }
  const clock = clockLabel(game);
  const visible = dramaChips.filter((chip) => !clockCovers(chip, clock));
  const base = visible.length ? visible : dramaChips;
  const extras = publicCardChips(game).filter((chip) => !base.includes(chip));
  const room = Math.max(1, HEAT_CHIP_CAP - extras.length);
  return [...base.slice(0, room), ...extras].slice(0, HEAT_CHIP_CAP);
}

function clockLabel(game: PushGame): string {
  const detailText = game.detail.trim();
  if (!detailText || /^(live|in progress|scheduled|pregame)$/i.test(detailText)) return "";
  return detailText;
}

/** The clock line already says the period, so the chip does not repeat it. */
function clockCovers(chip: string, clock: string): boolean {
  const text = clock.toLowerCase();
  if (chip === "4th quarter") return /\b4th\b/.test(text);
  if (chip === "3rd quarter") return /\b3rd\b/.test(text);
  return false;
}

function broadcastGlance(game: PushGame): string {
  const names: string[] = [];
  for (const raw of game.broadcasts ?? []) {
    const name = raw.trim();
    if (!name || names.some((have) => have.toLowerCase() === name.toLowerCase())) continue;
    names.push(name);
    if (names.length >= 2) break;
  }
  return names.join(" · ");
}

function heatBody(game: PushGame, chips: string): string {
  const lines: string[] = [];
  const clock = clockLabel(game);
  const tv = broadcastGlance(game);
  // Network stays on the clock line so a name like "CW" is not an orphan chip.
  const clockLine = [clock, tv].filter(Boolean).join(" · ");
  if (clockLine) lines.push(clockLine);
  if (chips) lines.push(chips);
  return lines.join("\n") || "One-score game";
}

function present(
  game: PushGame,
  reason: AlertKind,
  fields: { title: string; body: string; icon: string | null },
): PushNote {
  return {
    ...fields,
    image: fields.icon,
    tag: `${reason === "favorite-start" ? "start" : reason === "favorite-final" ? "final" : "heat"}:${gameKey(game)}`,
    url: gameHref(game),
    reason,
    sport: game.sport,
    gameId: game.id,
    silent: false,
    renotify: false,
    vibrate: reason === "heat" ? HEAT_VIBRATE : FAVORITE_VIBRATE,
  };
}

export function heatNote(game: PushGame, drama: LiveDrama): PushNote {
  const chips = heatReasonChips(game, drama).join(" · ");
  return present(game, "heat", {
    title: scoreLine(game),
    body: heatBody(game, chips),
    icon: leadLogo(game),
  });
}

export function favoriteStartNote(game: PushGame, fav: PushFavorite): PushNote {
  const verb = startVerb(game.sport);
  const when = game.when?.trim() || "";
  const matchup = `${game.away.name} at ${game.home.name}`;
  const mark = favoriteSide(game, fav)?.logo || leadLogo(game);
  return present(game, "favorite-start", {
    title: `${fav.shortName} · ${verb.toLowerCase()}`,
    body: when ? `${matchup}\n${when}` : matchup,
    icon: mark,
  });
}

export function favoriteFinalNote(game: PushGame, fav: PushFavorite): PushNote {
  const clock = clockLabel(game);
  const extra = clock && !/^final$/i.test(clock) ? clock : "";
  const score = scoreLine(game);
  const mark = favoriteSide(game, fav)?.logo || leadLogo(game);
  return present(game, "favorite-final", {
    title: `${fav.shortName} final`,
    body: extra ? `${score}\n${extra}` : score,
    icon: mark,
  });
}

export function dramaInput(game: PushGame): LiveDramaInput | null {
  if (!isDramaSport(game.sport)) return null;
  return {
    sport: game.sport,
    live: game.live && !game.final,
    final: game.final,
    awayScore: game.away.score,
    homeScore: game.home.score,
    detail: game.detail,
    period: game.period,
    redZone: game.redZone,
    downDistance: game.downDistance,
  };
}
