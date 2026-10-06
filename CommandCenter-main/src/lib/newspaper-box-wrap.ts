/**
 * Rule-based game wraps for the Thompson Times recaps desk.
 *
 * When ESPN has no recap of 200+ characters (NBA preseason, a late final),
 * the desk still files a 2–4 sentence box wrap from the score, the line, the
 * leaders, and the records. No model. Labeled "Times box wrap" on the page.
 */

export const ESPN_RECAP_MIN = 200;

export type BoxWrapSide = {
  name: string;
  short: string;
  abbrev: string;
  score: string | null;
  winner: boolean;
  record: string | null;
};

export type BoxWrapLine = {
  period: string;
  away: number | null;
  home: number | null;
};

export type BoxWrapLeader = {
  name: string;
  line: string;
  label?: string | null;
  headshot?: string | null;
  team?: string | null;
  id?: string | null;
};

export type BoxWrapGame = {
  league: string;
  path: string;
  preseason?: boolean;
  postseason?: boolean;
  round?: string | null;
  statusDetail?: string | null;
  away: BoxWrapSide;
  home: BoxWrapSide;
  leaders: BoxWrapLeader[];
  lines: BoxWrapLine[];
  next?: string | null;
};

export type EspnSummaryForWrap = {
  article?: { story?: string; headline?: string; images?: { url?: string; width?: number }[]; byline?: string };
  news?: { articles?: { story?: string; description?: string; headline?: string }[] };
  header?: {
    competitions?: {
      notes?: { headline?: string }[];
      status?: {
        type?: { detail?: string; shortDetail?: string };
        featuredAthletes?: {
          name?: string;
          athlete?: { id?: string; displayName?: string; shortName?: string; headshot?: string | { href?: string } };
        }[];
      };
      competitors?: {
        homeAway?: string;
        score?: string;
        winner?: boolean;
        hits?: number;
        errors?: number;
        linescores?: { value?: number }[];
        records?: { type?: string; summary?: string }[];
        team?: {
          id?: string;
          displayName?: string;
          shortDisplayName?: string;
          abbreviation?: string;
          color?: string;
          logo?: string;
          logos?: { href?: string }[];
        };
      }[];
    }[];
  };
  gameInfo?: { venue?: { fullName?: string } };
  leaders?: {
    shortDisplayName?: string;
    displayName?: string;
    name?: string;
    team?: { abbreviation?: string };
    leaders?: {
      displayValue?: string;
      athlete?: {
        id?: string;
        displayName?: string;
        shortName?: string;
        headshot?: string | { href?: string };
      };
    }[];
  }[];
  boxscore?: {
    teams?: { team?: { id?: string }; homeAway?: string; statistics?: { name?: string; displayValue?: string }[] }[];
    players?: {
      statistics?: {
        name?: string;
        labels?: string[];
        names?: string[];
        athletes?: {
          athlete?: { id?: string; displayName?: string; shortName?: string; headshot?: string | { href?: string } };
          stats?: string[];
        }[];
      }[];
    }[];
  };
};

export function summaryImageWidth(sum: EspnSummaryForWrap | null | undefined): number | null {
  const w = sum?.article?.images?.[0]?.width;
  return typeof w === "number" && w > 0 ? w : null;
}

export function summaryVenue(sum: EspnSummaryForWrap | null | undefined): string | null {
  return sum?.gameInfo?.venue?.fullName ?? null;
}

function headshotUrl(raw: string | { href?: string } | undefined): string | null {
  if (!raw) return null;
  return typeof raw === "string" ? raw : raw.href ?? null;
}

const ORDINALS: Record<string, string> = {
  "1": "first",
  "2": "second",
  "3": "third",
  "4": "fourth",
  "5": "fifth",
  "6": "sixth",
  "7": "seventh",
  "8": "eighth",
  "9": "ninth",
  "10": "tenth",
};

function ordinalWord(n: string): string {
  return ORDINALS[n] ?? `${n}th`;
}

/** Quarter / period / inning label as it reads in a sentence. */
export function periodPhrase(path: string, label: string): string {
  const raw = label.trim();
  if (/^(OT|1OT)$/i.test(raw)) return "overtime";
  if (/^\d+OT$/i.test(raw)) return `${raw.replace(/OT$/i, "")} overtime`;
  if (/^SO$/i.test(raw)) return "the shootout";
  if (raw === "1H") return "the first half";
  if (raw === "2H") return "the second half";
  if (/baseball/i.test(path)) {
    const n = raw.replace(/\D/g, "") || raw;
    return `the ${ordinalWord(n)}`;
  }
  if (/hockey/i.test(path)) {
    const n = raw.replace(/\D/g, "") || raw;
    return `the ${ordinalWord(n)} period`;
  }
  const n = raw.replace(/\D/g, "") || raw;
  return `the ${ordinalWord(n)} quarter`;
}

export function periodLabelsFor(path: string, count: number): string[] {
  const base = /soccer\//i.test(path)
    ? ["1H", "2H"]
    : /hockey\//i.test(path)
      ? ["1", "2", "3"]
      : /mens-college-basketball|baseball\//i.test(path)
        ? /baseball\//i.test(path)
          ? ["1", "2", "3", "4", "5", "6", "7", "8", "9"]
          : ["1H", "2H"]
        : ["1", "2", "3", "4"];
  const out = [...base];
  while (out.length < count) {
    const extra = out.length - base.length + 1;
    if (/hockey\//i.test(path)) out.push(extra === 1 ? "OT" : "SO");
    else if (/baseball\//i.test(path)) out.push(String(out.length + 1));
    else out.push(extra === 1 ? "OT" : `${extra}OT`);
  }
  return out.slice(0, Math.max(count, 0));
}

function num(score: string | null | undefined): number | null {
  if (score == null || score === "") return null;
  const n = Number(score);
  return Number.isFinite(n) ? n : null;
}

function club(side: BoxWrapSide): string {
  return side.name || side.short || side.abbrev;
}

function clubShort(side: BoxWrapSide): string {
  return side.short || side.name || side.abbrev;
}

function winnerLeader(game: BoxWrapGame): BoxWrapLeader | null {
  const pair = winnerLoser(game);
  const marked = pair
    ? game.leaders.find((l) => l.team && l.team.toUpperCase() === pair.winner.abbrev.toUpperCase())
    : null;
  if (marked?.name) return marked;
  if (game.leaders.length === 1 && game.leaders[0]?.name) return game.leaders[0]!;
  return null;
}

function resultVerb(game: BoxWrapGame): string {
  const pair = winnerLoser(game);
  const w = pair ? num(pair.winner.score) : null;
  const l = pair ? num(pair.loser.score) : null;
  if (w == null || l == null) return "beat";
  const margin = Math.abs(w - l);
  if (/football/i.test(game.path) && margin <= 8) return "held off";
  if (/(baseball|hockey)/i.test(game.path) && margin <= 3) return "held off";
  if (/basketball/i.test(game.path) && margin <= 7) return "held off";
  return "beat";
}

/**
 * One card sentence when ESPN has no recap: the final plus the winner's
 * key performer. No stat dump, no repeated full club names.
 */
export function writeBoxCardSentence(game: BoxWrapGame): string {
  const pair = winnerLoser(game);
  const extra = overtimeOf(game) ? " in overtime" : game.preseason ? " in preseason play" : "";
  if (!pair || pair.winner.score == null || pair.loser.score == null) {
    return `${game.away.short} ${game.away.score ?? "—"}, ${game.home.short} ${game.home.score ?? "—"}${extra}.`;
  }
  const winner = clubShort(pair.winner);
  const loser = clubShort(pair.loser);
  const score = scorePair(pair.winner, pair.loser);
  const star = winnerLeader(game);
  const verb = resultVerb(game);
  if (star?.name) {
    return `${star.name} and the ${winner} ${verb} the ${loser} ${score}${extra}.`;
  }
  return `The ${winner} ${verb} the ${loser} ${score}${extra}.`;
}

function winnerLoser(game: BoxWrapGame): { winner: BoxWrapSide; loser: BoxWrapSide } | null {
  if (game.away.winner === game.home.winner) {
    const a = num(game.away.score);
    const b = num(game.home.score);
    if (a == null || b == null || a === b) return null;
    return a > b
      ? { winner: game.away, loser: game.home }
      : { winner: game.home, loser: game.away };
  }
  return game.away.winner
    ? { winner: game.away, loser: game.home }
    : { winner: game.home, loser: game.away };
}

function scorePair(winner: BoxWrapSide, loser: BoxWrapSide): string {
  return `${winner.score}-${loser.score}`;
}

function overtimeOf(game: BoxWrapGame): boolean {
  return /\bOT\b|overtime/i.test(game.statusDetail ?? "") || game.lines.some((l) => /OT|SO/i.test(l.period));
}

function finalSentence(game: BoxWrapGame): string {
  const pair = winnerLoser(game);
  const extra = [
    overtimeOf(game) ? "in overtime" : "",
    game.preseason ? "in preseason play" : "",
    !game.preseason && game.postseason && game.round ? `in ${game.round}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  if (!pair || pair.winner.score == null || pair.loser.score == null) {
    return `${game.away.short} ${game.away.score ?? "—"}, ${game.home.short} ${game.home.score ?? "—"}${extra ? ` ${extra}` : ""}.`;
  }
  return `${club(pair.winner)} beat ${club(pair.loser)} ${scorePair(pair.winner, pair.loser)}${extra ? ` ${extra}` : ""}.`;
}

/** The period the winner ran away with, or the highest-scoring frame. */
export function lineHighlight(game: BoxWrapGame): string | null {
  if (game.lines.length < 2) return null;
  const pair = winnerLoser(game);
  const winnerHome = pair ? pair.winner === game.home : false;
  let best: { line: BoxWrapLine; margin: number; combined: number } | null = null;
  for (const line of game.lines) {
    if (line.away == null || line.home == null) continue;
    if (/OT|SO/i.test(line.period)) continue;
    const margin = winnerHome ? line.home - line.away : line.away - line.home;
    const combined = line.away + line.home;
    if (!best || margin > best.margin || (margin === best.margin && combined > best.combined)) {
      best = { line, margin, combined };
    }
  }
  if (!best || best.combined <= 0) return null;
  const phrase = periodPhrase(game.path, best.line.period);
  if (pair && best.margin >= 3) {
    const w = winnerHome ? best.line.home : best.line.away;
    const l = winnerHome ? best.line.away : best.line.home;
    return `${club(pair.winner)} outscored ${club(pair.loser)} ${w}-${l} in ${phrase}.`;
  }
  if (best.combined >= 10 || /football|basketball/i.test(game.path)) {
    return `The clubs combined for ${best.combined} in ${phrase}.`;
  }
  return null;
}

function leaderSentence(leaders: BoxWrapLeader[]): string | null {
  const rows = leaders.filter((l) => l.name && l.line).slice(0, 3);
  if (!rows.length) return null;
  if (rows.length === 1) return `${rows[0]!.name} had ${rows[0]!.line}.`;
  const last = rows[rows.length - 1]!;
  const head = rows
    .slice(0, -1)
    .map((l) => `${l.name} (${l.line})`)
    .join(", ");
  return `${head} and ${last.name} (${last.line}).`;
}

function recordSentence(game: BoxWrapGame): string | null {
  const pair = winnerLoser(game);
  if (!pair) return null;
  const w = pair.winner.record;
  const l = pair.loser.record;
  if (!w && !l) return null;
  if (w && l) return `${club(pair.winner)} is ${w}; ${club(pair.loser)} is ${l}.`;
  if (w) return `${club(pair.winner)} is ${w}.`;
  return `${club(pair.loser)} is ${l}.`;
}

function nextSentence(game: BoxWrapGame): string | null {
  const next = game.next?.replace(/^\s*next:\s*/i, "").trim();
  if (!next) return null;
  if (/[.!?]$/.test(next)) return next;
  const pair = winnerLoser(game);
  const subject = pair ? club(pair.winner) : game.home.name;
  if (/^(vs\.?|at|versus)\b/i.test(next)) return `${subject} plays ${next}.`;
  return `${subject} plays ${next}.`;
}

function sentencesOf(...parts: (string | null)[]): string[] {
  return parts.filter((s): s is string => Boolean(s && s.trim()));
}

/**
 * Two to four factual sentences. The page, not the copy, carries
 * "Times box wrap".
 */
export function writeBoxWrap(game: BoxWrapGame): { body: string; wrapKind: "box" } {
  const first = finalSentence(game);
  const highlight = lineHighlight(game);
  const names = leaderSentence(game.leaders);
  const records = recordSentence(game);
  const next = nextSentence(game);
  let parts = sentencesOf(first, highlight, names, records);
  if (parts.length < 2 && next) parts = sentencesOf(first, highlight, names, next, records);
  if (parts.length < 2 && records) parts = sentencesOf(first, records);
  if (parts.length < 2) parts = [first, names ?? records ?? "The box is the story."].filter(Boolean);
  if (parts.length > 4) {
    parts = sentencesOf(first, highlight, names, next ?? records);
  }
  return { body: parts.slice(0, 4).join(" "), wrapKind: "box" };
}

export function hasEspnRecap(text: string | null | undefined): boolean {
  return (text ?? "").replace(/\s+/g, " ").trim().length >= ESPN_RECAP_MIN;
}

/** First 2–4 sentences of a wrap, for the recaps-desk brief. */
export function wrapBriefSentences(text: string, max = 4): string {
  const raw = text.replace(/\s+/g, " ").trim();
  if (!raw) return "";
  const parts = raw.split(/(?<=[.!?])\s+(?=["“A-Z0-9])/).filter(Boolean);
  return parts.slice(0, Math.max(2, Math.min(max, parts.length || 1))).join(" ");
}

export function nextFromSummary(sum: EspnSummaryForWrap | null | undefined): string | null {
  for (const note of sum?.header?.competitions?.[0]?.notes ?? []) {
    const h = note.headline?.trim() ?? "";
    if (/^next\b/i.test(h) || /\bplays?\b.+\b(on|at|friday|saturday|sunday|monday|tuesday|wednesday|thursday)\b/i.test(h)) {
      return h;
    }
  }
  return null;
}

export function leadersFromSummary(sum: EspnSummaryForWrap | null | undefined): BoxWrapLeader[] {
  const out: BoxWrapLeader[] = [];
  for (const group of sum?.leaders ?? []) {
    const top = group.leaders?.[0];
    const name = top?.athlete?.shortName || top?.athlete?.displayName;
    const line = top?.displayValue;
    if (!name || !line) continue;
    if (out.some((l) => l.name === name)) continue;
    out.push({
      name,
      line,
      label: group.shortDisplayName || group.displayName || group.name || null,
      headshot: headshotUrl(top.athlete?.headshot),
      team: group.team?.abbreviation ?? null,
      id: top.athlete?.id ?? null,
    });
    if (out.length >= 4) break;
  }
  if (out.length) return out;
  for (const team of sum?.boxscore?.players ?? []) {
    for (const stat of team.statistics ?? []) {
      const labels = stat.labels?.length ? stat.labels : stat.names ?? [];
      const athlete = stat.athletes?.[0];
      const name = athlete?.athlete?.shortName || athlete?.athlete?.displayName;
      if (!name || !athlete?.stats?.length) continue;
      const bits = athlete.stats
        .map((v, i) => (v && labels[i] ? `${v} ${labels[i]}` : v))
        .filter(Boolean)
        .slice(0, 3);
      if (!bits.length) continue;
      if (out.some((l) => l.name === name)) continue;
      out.push({
        name,
        line: bits.join(", "),
        label: stat.name ?? null,
        headshot: headshotUrl(athlete.athlete?.headshot),
        id: athlete.athlete?.id ?? null,
      });
      if (out.length >= 3) break;
    }
    if (out.length >= 3) break;
  }
  return out;
}

/** 2–4 sentence box wrap from a printed BoxGame when the ESPN recap is a one-line dek. */
export function writeBoxWrapFromBoxGame(game: {
  league: string;
  path: string;
  status: string;
  round?: string | null;
  away: {
    name: string;
    short: string;
    abbrev: string;
    score: string | null;
    winner: boolean;
    record: string | null;
    lines: (number | null)[];
  };
  home: {
    name: string;
    short: string;
    abbrev: string;
    score: string | null;
    winner: boolean;
    record: string | null;
    lines: (number | null)[];
  };
  leaders: { name: string; line: string | null; label?: string; team?: string | null }[];
  periods: string[];
}): string {
  const n = Math.max(game.away.lines.length, game.home.lines.length, game.periods.length);
  const lines = Array.from({ length: n }, (_, i) => ({
    period: game.periods[i] ?? String(i + 1),
    away: game.away.lines[i] ?? null,
    home: game.home.lines[i] ?? null,
  }));
  return writeBoxWrap(boxWrapGameFromBox(game, lines)).body;
}

/** One clean card sentence from a printed BoxGame. */
export function writeBoxCardSentenceFromBoxGame(game: Parameters<typeof writeBoxWrapFromBoxGame>[0]): string {
  const n = Math.max(game.away.lines.length, game.home.lines.length, game.periods.length);
  const lines = Array.from({ length: n }, (_, i) => ({
    period: game.periods[i] ?? String(i + 1),
    away: game.away.lines[i] ?? null,
    home: game.home.lines[i] ?? null,
  }));
  return writeBoxCardSentence(boxWrapGameFromBox(game, lines));
}

function boxWrapGameFromBox(
  game: Parameters<typeof writeBoxWrapFromBoxGame>[0],
  lines: BoxWrapLine[],
): BoxWrapGame {
  return {
    league: game.league,
    path: game.path,
    postseason: Boolean(game.round),
    statusDetail: game.status,
    away: {
      name: game.away.name,
      short: game.away.short,
      abbrev: game.away.abbrev,
      score: game.away.score,
      winner: game.away.winner,
      record: game.away.record,
    },
    home: {
      name: game.home.name,
      short: game.home.short,
      abbrev: game.home.abbrev,
      score: game.home.score,
      winner: game.home.winner,
      record: game.home.record,
    },
    leaders: game.leaders
      .filter((l) => l.name && l.line)
      .map((l) => ({ name: l.name, line: l.line!, label: l.label, team: l.team })),
    lines,
  };
}

export function linesFromSummary(
  path: string,
  sum: EspnSummaryForWrap | null | undefined,
): BoxWrapLine[] {
  const away = sum?.header?.competitions?.[0]?.competitors?.find((c) => c.homeAway === "away");
  const home = sum?.header?.competitions?.[0]?.competitors?.find((c) => c.homeAway === "home");
  const count = Math.max(away?.linescores?.length ?? 0, home?.linescores?.length ?? 0);
  if (!count) return [];
  const labels = periodLabelsFor(path, count);
  return labels.map((period, i) => ({
    period,
    away: typeof away?.linescores?.[i]?.value === "number" ? away.linescores[i]!.value! : null,
    home: typeof home?.linescores?.[i]?.value === "number" ? home.linescores[i]!.value! : null,
  }));
}
