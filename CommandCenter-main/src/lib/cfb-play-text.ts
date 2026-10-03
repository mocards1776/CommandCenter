/**
 * Readable college-football play copy from ESPN drive text.
 * Rewrites wording that is already in the feed (spots, fouls, results).
 * Does not add players, yardage, or flags that the source did not state.
 */

export type CfbPlayTone =
  | "score"
  | "penalty"
  | "turnover"
  | "sack"
  | "timeout"
  | "period"
  | "routine";

export type CfbPlayCopy = {
  /** Primary sentence. */
  text: string;
  /** Secondary line: nullified attempt, declined flag, or review. */
  detail: string | null;
  /** Short chips, in display order. TD, FG, INT, FUM, PEN, SACK, 1ST, MISS, BLK. */
  tags: string[];
  tone: CfbPlayTone;
};

export type CfbPlayHints = {
  type?: string | null;
  scoringPlay?: boolean;
  penalty?: boolean;
  turnover?: boolean;
};

const NAME = String.raw`[A-Z]\.\s+[A-Za-z][A-Za-z.'-]*(?:\s+(?:Jr\.|Sr\.|II|III|IV))?`;

export function presentCfbPlayText(
  raw: string | null | undefined,
  hints: CfbPlayHints = {},
): CfbPlayCopy {
  const empty: CfbPlayCopy = { text: "", detail: null, tags: [], tone: "routine" };
  if (!raw?.trim()) return empty;

  let text = raw.replace(/\s+/g, " ").trim();
  text = text.replace(/^\(\d{1,2}:\d{2}\)\s*/i, "");
  text = text.replace(
    /\b(?:No\s*Huddle(?:[\s-]*Shotgun)?|Shotgun|Under Center|Wildcat|Pistol)\b[\s-]*/gi,
    "",
  );
  text = text.replace(/#\s*\d+\s*/g, "");
  text = text.replace(/\s*\(\s*H:\s*[^;)]*;\s*LS:\s*[^)]*\)\s*/gi, " ");
  text = text.replace(/\s*\(\s*(?:H|LS):\s*[^)]*\)\s*/gi, " ");
  text = text.replace(/,?\s*clock\s+\d{1,2}:\d{2}\b/gi, "");
  text = text.replace(/,?\s*End Of Play\b/gi, "");
  text = spaceInitials(text);

  const details: string[] = [];
  const review = text.match(
    /\.?\s*The previous play is under (?:automatic )?review\s*[-–—]\s*"([^"]+)"\.\s*(CALL UPHELD|CALL OVERTURNED|UPHELD|OVERTURNED)\.?/i,
  );
  if (review) {
    const overturned = /overturn/i.test(review[2] ?? "");
    const subject = (review[1] ?? "call").trim();
    details.push(overturned ? `Review overturned (${subject}).` : `Review upheld (${subject}).`);
    text = text.replace(review[0], " ");
  }

  if (/^End of\b/i.test(text) || /^end period$/i.test(hints.type ?? "")) {
    return { text: tidy(text), detail: null, tags: [], tone: "period" };
  }

  const timeout = text.match(/^Timeout(?:\s+(.+?))?(?:,|$)/i);
  if (timeout || /^timeout$/i.test(hints.type ?? "")) {
    const team = timeout?.[1]?.replace(/[,.\s]+$/g, "").trim();
    return {
      text: team ? `Timeout, ${team}` : "Timeout",
      detail: null,
      tags: [],
      tone: "timeout",
    };
  }

  let declined: string | null = null;
  const declinedMatch = text.match(
    /,?\s*PENALTY\s+([A-Za-z][A-Za-z.'&-]*)\s+(.+?)\s+declined\s*\.?$/i,
  );
  if (declinedMatch) {
    const foul = (declinedMatch[2] ?? "").trim();
    const team = declinedMatch[1] ?? "";
    declined = foul ? `${foul} declined, ${team}.` : `Penalty declined, ${team}.`;
    text = text.slice(0, declinedMatch.index).trim();
  }

  let penalty: { sentence: string; noPlay: boolean; firstDown: boolean } | null = null;
  if (!declined) {
    const at = text.search(/\bPENALTY\b/i);
    if (at >= 0) {
      penalty = buildPenalty(text.slice(at).replace(/^PENALTY\s*/i, ""));
      text = text.slice(0, at).trim();
    }
  }

  const playFirstDown = /\b1ST DOWN\b/i.test(text);
  text = text.replace(/,?\s*\b1ST DOWN\b/gi, "");
  text = polishClause(text);

  if (declined) details.unshift(declined);

  const attempt = text;
  const noPlay = Boolean(penalty?.noPlay);
  const primary = noPlay && penalty ? penalty.sentence : attempt || penalty?.sentence || tidy(raw);
  if (noPlay && penalty && attempt) details.unshift(`No play · ${attempt}`);
  else if (!noPlay && penalty) details.unshift(penalty.sentence);

  const detail = details.filter(Boolean).join(" ") || null;
  const classified = classify({
    primary,
    original: raw,
    hints,
    penalty,
    declined: Boolean(declined),
    playFirstDown: noPlay ? false : playFirstDown,
    noPlay,
  });

  return {
    text: tidy(primary) || tidy(raw),
    detail: detail ? tidy(detail) : null,
    tags: classified.tags,
    tone: classified.tone,
  };
}

/** Primary sentence only — last-play line and scoring blurbs. */
export function simplifyCfbPlayText(raw: string | null | undefined): string {
  return presentCfbPlayText(raw).text;
}

function buildPenalty(rest: string): { sentence: string; noPlay: boolean; firstDown: boolean } {
  const noPlay = /\bNO PLAY\b/i.test(rest);
  const firstDown = /\b1ST DOWN\b/i.test(rest);
  const body = rest
    .replace(/,?\s*\b1ST DOWN\b/gi, "")
    .replace(/\.?\s*\bNO PLAY\b/gi, "")
    .trim();
  const parsed =
    /^([A-Za-z][A-Za-z.'&-]*)\s+(.+?)\s*(?:\(([^)]*)\))?\s*(\d+)\s+yards?\s+from\s+(\S+)\s+to\s+(\S+)/i.exec(
      body,
    );
  if (!parsed) {
    let sentence = tidy(humanizeSpots(body));
    if (firstDown) sentence = `${sentence}, first down`;
    if (!/[.!?]$/.test(sentence)) sentence += ".";
    return { sentence, noPlay, firstDown };
  }
  const team = parsed[1] ?? "";
  const foul = prettyFoul((parsed[2] ?? "").trim());
  const player = parsed[3] ? tidy(parsed[3]) : "";
  const yards = parsed[4] ?? "0";
  const from = formatSpot(parsed[5] ?? "");
  const to = formatSpot(parsed[6] ?? "");
  const who = player ? `${team} (${player})` : team;
  let sentence = `${foul}, ${who}, ${yards} ${yardWord(yards)} from ${from} to ${to}`;
  if (firstDown) sentence += ", first down";
  sentence += ".";
  return { sentence: tidy(sentence), noPlay, firstDown };
}

function polishClause(input: string): string {
  let text = humanizeSpots(input);
  text = text.replace(
    /\s*,?\s*\b(?:caught|thrown)\s+(?:at|to)\s+the\s+(?:goal line|[A-Za-z][A-Za-z.'&-]*\s+\d{1,2})\s*,?/gi,
    " ",
  );
  text = text.replace(/\bfor\s+(\d+)\s+yards?\s+gain\b/gi, (_, n: string) => `for ${n} ${yardWord(n)}`);
  text = text.replace(
    /\bfor\s+(\d+)\s+yards?\s+loss\b/gi,
    (_, n: string) => `for a loss of ${n} ${yardWord(n)}`,
  );
  text = text.replace(
    /\bsacked for (?:a )?loss of (\d+) yards?(?: to (the (?:goal line|[A-Za-z][A-Za-z.'&-]* \d{1,2})))?(?: \(([^)]+)\))?/gi,
    (_, n: string, spot: string | undefined, by: string | undefined) => {
      const who = by && isNameList(by) ? ` by ${formatNameList(by)}` : by ? ` (${tidy(by)})` : "";
      const where = spot ? ` to ${spot.trim()}` : "";
      return `sacked${who} for a loss of ${n} ${yardWord(n)}${where}`;
    },
  );
  text = text.replace(/\s*\(([^)]+)\)/g, (full, inner: string) => (isNameList(inner) ? "" : full));
  text = text.replace(
    /\(\s*([A-Z]\.\s+[A-Za-z][A-Za-z.'-]*)\s+KICK\s*\)/gi,
    (_, name: string) => `. ${name} kick good`,
  );
  text = text.replace(/\breturn (\d+) yards?\b/gi, "returns $1 yards");
  text = text.replace(
    /\b((?:at|to) the (?:goal line|[A-Z][A-Za-z.'&-]* \d{1,2}))\s+(?=[A-Z]\.\s)/g,
    "$1. ",
  );
  text = text.replace(/\s*,?\s*\bTOUCHDOWN\b/gi, ", touchdown");
  text = text.replace(/, touchdown\s+(?=[A-Z]\.\s)/g, ", touchdown. ");
  text = text.replace(/\s*,?\s*for a TD\b/gi, ", touchdown");
  text = text.replace(/\bkick attempt good\b/gi, "kick good");
  text = text.replace(/\bkick attempt (no good|missed|blocked)\b/gi, (_, w: string) => `kick ${w.toLowerCase()}`);
  text = text.replace(
    /\bfield goal attempt from (\d+) yards?\s+(GOOD|NO GOOD|MISSED|BLOCKED)\b/gi,
    (_, yards: string, result: string) => `field goal ${result.toLowerCase()} from ${yards} yards`,
  );
  text = text.replace(
    /\b(\d+)\s*yd FG (GOOD|NO GOOD|MISSED|BLOCKED)\b/gi,
    (_, yards: string, result: string) => `${yards}-yard field goal, ${result.toLowerCase()}`,
  );
  text = text.replace(/\bTouchback\b/g, "touchback");
  text = text.replace(/\brecovered by ([A-Z][A-Za-z]+)\s+(?=[A-Z]\.\s)/g, "recovered by $1, ");
  text = text.replace(
    /,?\s+(muffed by|fumbled by|fumble by|forced by|recovered by|fair catch by|out of bounds)\b/gi,
    (_, w: string) => `. ${w[0]!.toUpperCase()}${w.slice(1)}`,
  );
  text = text.replace(
    /\s+(QB hurried by|broken up by)\b/gi,
    (_, w: string) => `. ${w[0]!.toUpperCase()}${w.slice(1)}`,
  );
  return tidy(text);
}

function classify(args: {
  primary: string;
  original: string;
  hints: CfbPlayHints;
  penalty: { noPlay: boolean; firstDown: boolean } | null;
  declined: boolean;
  playFirstDown: boolean;
  noPlay: boolean;
}): { tags: string[]; tone: CfbPlayTone } {
  const { primary, original, hints, penalty, declined, playFirstDown, noPlay } = args;
  const type = hints.type ?? "";
  const blob = `${type} ${original}`;
  const scoring =
    Boolean(hints.scoringPlay) ||
    /\bTOUCHDOWN\b/i.test(original) ||
    /\bfield goal attempt\b[\s\S]*\bGOOD\b/i.test(original) ||
    /\bFG GOOD\b/i.test(original) ||
    /\bfor a TD\b/i.test(original);
  const fieldGoal = /field goal|\bFG\b/i.test(blob);
  const interception = /intercept/i.test(blob);
  const fumbleTurnover = Boolean(hints.turnover) && /fumble|muff/i.test(blob) && !interception;
  const sack = /sack/i.test(type) || /\bsacked\b/i.test(primary);
  const punt = /^punt/i.test(type);

  const tags: string[] = [];
  let tone: CfbPlayTone = "routine";

  if (noPlay && penalty) {
    tone = "penalty";
    tags.push("PEN");
    if (penalty.firstDown) tags.push("1ST");
    return { tags, tone };
  }

  if (scoring && fieldGoal && /\bgood\b/i.test(primary)) {
    tone = "score";
    tags.push("FG");
  } else if (scoring && /safety/i.test(blob)) {
    tone = "score";
    tags.push("SAF");
  } else if (scoring) {
    tone = "score";
    tags.push("TD");
  } else if (fieldGoal && /\bno good\b|\bmissed\b/i.test(primary)) {
    tags.push("MISS");
  } else if (fieldGoal && /\bblocked\b/i.test(primary)) {
    tags.push("BLK");
  }

  if (interception && (hints.turnover || scoring || /intercept/i.test(primary))) tags.push("INT");
  if (fumbleTurnover) tags.push("FUM");
  if (hints.turnover && (interception || fumbleTurnover) && tone !== "score") tone = "turnover";

  if (!noPlay && penalty && !declined) {
    tags.push("PEN");
    if (tone === "routine") tone = "penalty";
  }
  if (sack && tone !== "score") {
    tags.push("SACK");
    if (tone === "routine") tone = "sack";
  }
  if (playFirstDown && !tags.includes("TD") && !tags.includes("FG")) tags.push("1ST");
  if (punt && tags.length === 0) tags.push("PUNT");

  return { tags, tone };
}

function humanizeSpots(input: string): string {
  return input.replace(
    /\b(?:the\s+)?([A-Z][A-Za-z.'&-]{1,18}?)(\d{2})\b/g,
    (full, nick: string, yards: string) => {
      const n = Number(yards);
      if (!Number.isFinite(n) || n > 50) return full;
      if (n === 0) return "the goal line";
      return `the ${nick} ${n}`;
    },
  );
}

function formatSpot(token: string): string {
  return humanizeSpots(token.replace(/[.,;]+$/g, ""));
}

function spaceInitials(input: string): string {
  const re = /\b([A-Z])\.([A-Z])/g;
  // Twice so A.J.Green becomes A. J. Green, and C.O'Neal becomes C. O'Neal.
  return input.replace(re, "$1. $2").replace(re, "$1. $2");
}

function isNameList(inner: string): boolean {
  const parts = inner.split(/\s*[;,]\s*/).map((s) => s.trim()).filter(Boolean);
  if (!parts.length || parts.length > 4) return false;
  return parts.every((part) => new RegExp(`^${NAME}$`).test(part));
}

function formatNameList(inner: string): string {
  const parts = inner.split(/\s*[;,]\s*/).map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? inner.trim();
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function prettyFoul(foul: string): string {
  return foul.replace(/\b(Of|The|A|An|And)\b/g, (word) => word.toLowerCase());
}

function yardWord(n: string): string {
  return n === "1" ? "yard" : "yards";
}

function tidy(input: string): string {
  let text = input.replace(/\s+/g, " ").trim();
  text = text.replace(/\s+,/g, ",");
  text = text.replace(/,\s*,+/g, ",");
  text = text.replace(/\s+\./g, ".");
  text = text.replace(/\.{2,}/g, ".");
  text = text.replace(/,\s*\./g, ".");
  text = text.replace(/([,.;])(?=[A-Za-z])/g, "$1 ");
  text = text.replace(/^[,.\s]+/g, "");
  text = text.replace(/\s+,/g, ",");
  text = text.replace(/\s{2,}/g, " ");
  return text.trim();
}
