/**
 * Pregame betting lines from the ESPN summary already loaded for the card.
 *
 * Prefer `pickcenter` (same object the NFL/CFB game pages read for oddsLine),
 * then `odds`, then the competition odds array. No extra network call.
 * Missing lines omit cleanly — the send still goes out.
 */

type FinalSide = {
  abbrev: string;
  score: number | null;
};

export type SpreadResult = "covered" | "not covered" | "push";

export type FinalOdds = {
  details: string | null;
  favoriteSide: "away" | "home" | null;
  favoriteAbbrev: string | null;
  /** Favorite's point line, always ≤ 0 (e.g. -2.5). */
  favoriteSpread: number | null;
  awaySpread: number | null;
  homeSpread: number | null;
  awayMl: number | null;
  homeMl: number | null;
  overUnder: number | null;
  provider: string | null;
  /** Favorite's ATS result. Null when there is no spread or no final score. */
  spreadResult: SpreadResult | null;
  mlWinnerSide: "away" | "home" | null;
  underdogWon: boolean;
  noteworthyUpset: boolean;
  graphicLine: string | null;
  captionLine: string | null;
  upsetLine: string | null;
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
  if (typeof value === "string") {
    const t = value.trim().replace(/^[ou]/i, "");
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function american(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const t = value.trim().replace(/^\+/, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function fmtAmerican(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

function fmtSpread(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

function closeLine(block: unknown): string {
  return str(rec(rec(block).close).line);
}

function closeOdds(block: unknown): number | null {
  return american(rec(rec(block).close).odds);
}

const DETAILS_RE = /^([A-Za-z0-9]{2,5})\s+([+-]?\d+(?:\.\d+)?)$/;

export function parseDetails(details: string | null | undefined): { abbrev: string; line: number } | null {
  if (!details) return null;
  const match = DETAILS_RE.exec(details.trim());
  if (!match) return null;
  const line = Number(match[2]);
  if (!Number.isFinite(line)) return null;
  return { abbrev: match[1]!.toUpperCase(), line };
}

export function spreadOutcome(line: number, scored: number, against: number): SpreadResult {
  const margin = scored - against + line;
  if (Math.abs(margin) < 1e-9) return "push";
  return margin > 0 ? "covered" : "not covered";
}

function pickRow(raw: Rec): Rec | null {
  const pick = rec(arr(raw.pickcenter)[0]);
  if (Object.keys(pick).length) return pick;
  const odds = rec(arr(raw.odds)[0]);
  if (Object.keys(odds).length) return odds;
  const header = rec(arr(rec(raw.header).competitions)[0]);
  const fromComp = rec(arr(header.odds)[0]);
  return Object.keys(fromComp).length ? fromComp : null;
}

function sideFromAbbrev(away: FinalSide, home: FinalSide, abbrev: string | null): "away" | "home" | null {
  if (!abbrev) return null;
  const token = abbrev.toUpperCase();
  if (token === away.abbrev.toUpperCase()) return "away";
  if (token === home.abbrev.toUpperCase()) return "home";
  return null;
}

function noteworthy(favoriteSpread: number | null, favoriteMl: number | null, dogMl: number | null): boolean {
  if (favoriteSpread != null && Math.abs(favoriteSpread) >= 6.5) return true;
  if (favoriteMl != null && favoriteMl <= -200) return true;
  if (dogMl != null && dogMl >= 200) return true;
  return false;
}

export function oddsFromSummary(
  raw: unknown,
  away: FinalSide,
  home: FinalSide,
  final: boolean,
): FinalOdds | null {
  const row = pickRow(rec(raw));
  if (!row) return null;

  const details = str(row.details) || null;
  const parsed = parseDetails(details);
  const ps = rec(row.pointSpread);
  const awaySpread = num(closeLine(ps.away)) ?? (parsed && sideFromAbbrev(away, home, parsed.abbrev) === "away" ? parsed.line : null);
  const homeSpread = num(closeLine(ps.home)) ?? (parsed && sideFromAbbrev(away, home, parsed.abbrev) === "home" ? parsed.line : null);

  const awayOdds = rec(row.awayTeamOdds);
  const homeOdds = rec(row.homeTeamOdds);
  const mlBlock = rec(row.moneyline);
  const awayMl = american(awayOdds.moneyLine) ?? closeOdds(mlBlock.away);
  const homeMl = american(homeOdds.moneyLine) ?? closeOdds(mlBlock.home);
  const overUnder = num(row.overUnder);
  const provider = str(rec(row.provider).displayName) || str(rec(row.provider).name) || null;

  let favoriteSide: "away" | "home" | null = null;
  if (awayOdds.favorite === true) favoriteSide = "away";
  else if (homeOdds.favorite === true) favoriteSide = "home";
  else if (parsed) favoriteSide = sideFromAbbrev(away, home, parsed.abbrev);
  else if (awaySpread != null && awaySpread < 0) favoriteSide = "away";
  else if (homeSpread != null && homeSpread < 0) favoriteSide = "home";
  else if (awayMl != null && homeMl != null) {
    if (awayMl < homeMl) favoriteSide = "away";
    else if (homeMl < awayMl) favoriteSide = "home";
  }

  const favoriteAbbrev = favoriteSide === "away" ? away.abbrev : favoriteSide === "home" ? home.abbrev : parsed?.abbrev ?? null;
  let favoriteSpread: number | null = null;
  if (favoriteSide === "away") favoriteSpread = awaySpread ?? (parsed && parsed.abbrev.toUpperCase() === away.abbrev.toUpperCase() ? parsed.line : null);
  else if (favoriteSide === "home") favoriteSpread = homeSpread ?? (parsed && parsed.abbrev.toUpperCase() === home.abbrev.toUpperCase() ? parsed.line : null);
  else if (parsed) favoriteSpread = parsed.line;
  if (favoriteSpread != null && favoriteSpread > 0) favoriteSpread = -favoriteSpread;

  if (!details && favoriteSpread == null && awayMl == null && homeMl == null && overUnder == null) {
    return null;
  }

  const awayScore = away.score;
  const homeScore = home.score;
  const haveScores = final && awayScore != null && homeScore != null && awayScore !== homeScore;
  const tie = final && awayScore != null && homeScore != null && awayScore === homeScore;

  let spreadResult: SpreadResult | null = null;
  if (favoriteSpread != null && final && awayScore != null && homeScore != null && favoriteSide) {
    const scored = favoriteSide === "away" ? awayScore : homeScore;
    const against = favoriteSide === "away" ? homeScore : awayScore;
    spreadResult = spreadOutcome(favoriteSpread, scored, against);
  }

  let mlWinnerSide: "away" | "home" | null = null;
  if (haveScores) mlWinnerSide = awayScore! > homeScore! ? "away" : "home";
  const underdogWon = Boolean(haveScores && favoriteSide && mlWinnerSide && mlWinnerSide !== favoriteSide);

  const favoriteMl = favoriteSide === "away" ? awayMl : favoriteSide === "home" ? homeMl : null;
  const dogMl = favoriteSide === "away" ? homeMl : favoriteSide === "home" ? awayMl : null;
  const noteworthyUpset = underdogWon && noteworthy(favoriteSpread, favoriteMl, dogMl);

  const spreadLabel = favoriteAbbrev && favoriteSpread != null ? `${favoriteAbbrev} ${fmtSpread(favoriteSpread)}` : details;
  const graphicBits: string[] = [];
  if (spreadLabel) {
    if (spreadResult === "covered") graphicBits.push(`${spreadLabel} covered`);
    else if (spreadResult === "not covered") graphicBits.push(`${spreadLabel} did not cover`);
    else if (spreadResult === "push") graphicBits.push(`${spreadLabel} push`);
    else graphicBits.push(spreadLabel);
  }
  if (mlWinnerSide && (awayMl != null || homeMl != null)) {
    const ml = mlWinnerSide === "away" ? awayMl : homeMl;
    const abbrev = mlWinnerSide === "away" ? away.abbrev : home.abbrev;
    if (ml != null) graphicBits.push(`${abbrev} ${fmtAmerican(ml)}`);
  } else if (!haveScores && (awayMl != null || homeMl != null)) {
    const bits = [
      awayMl != null ? `${away.abbrev} ${fmtAmerican(awayMl)}` : null,
      homeMl != null ? `${home.abbrev} ${fmtAmerican(homeMl)}` : null,
    ].filter(Boolean);
    if (bits.length) graphicBits.push(`ML ${bits.join(" / ")}`);
  }
  if (!graphicBits.length && overUnder != null) graphicBits.push(`O/U ${overUnder}`);

  const captionBits: string[] = [];
  if (spreadLabel) {
    if (spreadResult === "covered") captionBits.push(`${spreadLabel} covered`);
    else if (spreadResult === "not covered") captionBits.push(`${spreadLabel} did not cover`);
    else if (spreadResult === "push") captionBits.push(`${spreadLabel} pushed`);
    else captionBits.push(spreadLabel);
  }
  if (mlWinnerSide && (awayMl != null || homeMl != null)) {
    const ml = mlWinnerSide === "away" ? awayMl : homeMl;
    const abbrev = mlWinnerSide === "away" ? away.abbrev : home.abbrev;
    if (ml != null) captionBits.push(`ML ${abbrev} ${fmtAmerican(ml)} won`);
  } else if (awayMl != null || homeMl != null) {
    const bits = [
      awayMl != null ? `${away.abbrev} ${fmtAmerican(awayMl)}` : null,
      homeMl != null ? `${home.abbrev} ${fmtAmerican(homeMl)}` : null,
    ].filter(Boolean);
    if (bits.length) captionBits.push(`ML ${bits.join(" / ")}`);
  }
  if (overUnder != null) captionBits.push(`O/U ${overUnder}`);

  let upsetLine: string | null = null;
  if (underdogWon && mlWinnerSide) {
    const dog = mlWinnerSide === "away" ? away : home;
    const fav = mlWinnerSide === "away" ? home : away;
    const dogLine = (mlWinnerSide === "away" ? awayMl : homeMl);
    const mlBit = dogLine != null ? ` ${fmtAmerican(dogLine)}` : "";
    if (noteworthyUpset) {
      upsetLine = `Upset: ${dog.abbrev}${mlBit} beat ${fav.abbrev}`;
    } else {
      upsetLine = `Underdog ${dog.abbrev}${mlBit} won`;
    }
  } else if (tie && favoriteAbbrev) {
    upsetLine = null;
  }

  const graphicLine = graphicBits.length ? graphicBits.join("  ·  ") : null;
  const captionLine = captionBits.length ? `Odds: ${captionBits.join(" · ")}` : null;
  if (!graphicLine && !captionLine) return null;

  return {
    details,
    favoriteSide,
    favoriteAbbrev,
    favoriteSpread,
    awaySpread,
    homeSpread,
    awayMl,
    homeMl,
    overUnder,
    provider,
    spreadResult,
    mlWinnerSide,
    underdogWon,
    noteworthyUpset,
    graphicLine,
    captionLine,
    upsetLine,
  };
}
