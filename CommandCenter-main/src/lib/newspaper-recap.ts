/**
 * One recap model for every Thompson Times game wrap.
 *
 * Favorite-team stories, desk wraps, Times box wraps, and the reader all
 * set the same chrome (banner, line, chips, photo, box) off this pack.
 * Sport adapters pick the line labels and the three leader chips.
 */

import { splitNewspaperSentences, tidy, truncateAtSentence } from "./newspaper-copy.ts";
import type { BoxGame, BoxLeader, BoxPerson, BoxSide } from "./newspaper-box.ts";

export const RECAP_WIDE_MIN = 800;

export type RecapSide = {
  id: string | null;
  name: string;
  short: string;
  abbrev: string;
  logo: string | null;
  color: string | null;
  score: string | null;
  record: string | null;
  winner: boolean;
  hits: string | null;
  errors: string | null;
  lines: (number | null)[];
};

export type RecapLeader = {
  label: string;
  name: string;
  line: string;
  headshot: string | null;
  team: string | null;
  id: string | null;
  href: string | null;
};

export type RecapGamePack = {
  path: string;
  league: string;
  venue: string | null;
  status: string;
  final: boolean;
  live: boolean;
  periods: string[];
  away: RecapSide;
  home: RecapSide;
  leaders: RecapLeader[];
};

export type RecapCardBits = {
  leaguePath?: string | null;
  sportLabel?: string;
  favoriteKey?: string;
  followed?: boolean;
  ranked?: boolean;
  postseason?: boolean;
  photo?: string | null;
  photoWidth?: number | null;
  caption?: string | null;
  recapGame?: RecapGamePack | null;
  leaders?: Array<{
    name: string;
    line: string;
    href?: string | null;
    label?: string | null;
    headshot?: string | null;
    team?: string | null;
    id?: string | null;
  }>;
};

const MLB_COLORS: Record<string, string> = {
  ARI: "#A71930",
  AZ: "#A71930",
  ATL: "#CE1141",
  BAL: "#DF4601",
  BOS: "#BD3039",
  CHC: "#0E3386",
  CWS: "#27251F",
  CHW: "#27251F",
  CIN: "#C6011F",
  CLE: "#00385D",
  COL: "#33006F",
  DET: "#0C2340",
  HOU: "#002D62",
  KC: "#004687",
  LAA: "#BA0021",
  LAD: "#005A9C",
  MIA: "#00A3E0",
  MIL: "#12284B",
  MIN: "#002B5C",
  NYM: "#002D72",
  NYY: "#0C2340",
  ATH: "#003831",
  OAK: "#003831",
  PHI: "#E81828",
  PIT: "#27251F",
  SD: "#2F241D",
  SF: "#FD5A1E",
  SEA: "#0C2C56",
  STL: "#C41E3A",
  TB: "#092C5C",
  TEX: "#003278",
  TOR: "#134A8E",
  WSH: "#AB0003",
  WAS: "#AB0003",
};

export function mlbTeamColor(abbrev: string | null | undefined): string | null {
  if (!abbrev) return null;
  return MLB_COLORS[abbrev.toUpperCase()] ?? null;
}

export function recapPaint(color: string | null | undefined): string {
  if (!color) return "#1f2a44";
  return color.startsWith("#") ? color : `#${color}`;
}

export function recapPhotoKind(
  url: string | null | undefined,
  width?: number | null,
): "wide" | "inset" | "none" {
  if (!url) return "none";
  if (width != null && width > 0 && width < RECAP_WIDE_MIN) return "inset";
  return "wide";
}

/** Favorites, ranked, and postseason get the full box; the rest of the desk is compact. */
export function recapIsFull(card: RecapCardBits): boolean {
  return Boolean(card.followed || card.favoriteKey || card.ranked || card.postseason);
}

function asLeader(row: {
  label?: string | null;
  name: string;
  line?: string | null;
  headshot?: string | null;
  team?: string | null;
  id?: string | null;
  href?: string | null;
}): RecapLeader | null {
  if (!row.name) return null;
  return {
    label: row.label?.trim() || "Star",
    name: row.name,
    line: row.line?.trim() || "",
    headshot: row.headshot ?? null,
    team: row.team ?? null,
    id: row.id ?? null,
    href: row.href ?? null,
  };
}

function fromBoxLeader(row: BoxLeader): RecapLeader | null {
  return asLeader(row);
}

function fromDecision(label: string, person: BoxPerson): RecapLeader | null {
  const word = label === "W" ? "Winner" : label === "L" ? "Loser" : label === "S" ? "Save" : label;
  return asLeader({
    label: word,
    name: person.name,
    line: person.line,
    headshot: person.headshot,
    id: person.id,
  });
}

type LeaderWant = { test: RegExp; label: string };

const WANTS: Record<string, LeaderWant[]> = {
  football: [
    { test: /pass/i, label: "Pass" },
    { test: /rush/i, label: "Rush" },
    { test: /rec/i, label: "Rec" },
  ],
  basketball: [
    { test: /pts|points|scor/i, label: "Points" },
    { test: /reb/i, label: "Rebounds" },
    { test: /ast|assist/i, label: "Assists" },
  ],
  hockey: [
    { test: /point/i, label: "Points" },
    { test: /goal(?!ie|tend)/i, label: "Goals" },
    { test: /save|goalie|goaltend/i, label: "Goalie" },
  ],
  baseball: [
    { test: /win|winner|pitch/i, label: "Winner" },
    { test: /loser/i, label: "Loser" },
    { test: /save/i, label: "Save" },
    { test: /hit|hr|home|rbi|bat/i, label: "Hit" },
  ],
};

export function recapSportFamily(path: string | null | undefined): keyof typeof WANTS {
  if (path?.startsWith("baseball/")) return "baseball";
  if (path?.startsWith("hockey/")) return "hockey";
  if (path?.startsWith("basketball/")) return "basketball";
  return "football";
}

function matchWant(row: RecapLeader, want: LeaderWant): boolean {
  return want.test.test(row.label) || want.test.test(row.line);
}

/** Three chips the paper prints under the line, in sport order. */
export function pickRecapLeaders(
  path: string,
  leaders: RecapLeader[],
  decisions: { label: string; person: BoxPerson }[] = [],
): RecapLeader[] {
  const family = recapSportFamily(path);
  const fromDecisions = decisions
    .map((d) => fromDecision(d.label, d.person))
    .filter((l): l is RecapLeader => Boolean(l))
    .map((l) => (family === "hockey" && /winner|loser/i.test(l.label) ? { ...l, label: "Goalie" } : l));
  const pool = [...fromDecisions, ...leaders].filter((l) => l.name);
  const seen = new Set<string>();
  const out: RecapLeader[] = [];
  const take = (row: RecapLeader, label?: string) => {
    const key = row.name.toLowerCase();
    if (seen.has(key) || out.length >= 3) return;
    seen.add(key);
    out.push(label ? { ...row, label } : row);
  };

  if (family === "baseball") {
    const winner = fromDecisions.find((l) => l.label === "Winner");
    const loser = fromDecisions.find((l) => l.label === "Loser");
    const save =
      fromDecisions.find((l) => l.label === "Save") ??
      pool.find((l) => /save|^s(?:v)?$/i.test(l.label));
    const hitter = pool.find((l) => /hit|hr|home|rbi|bat|avg/i.test(`${l.label} ${l.line}`));
    if (winner) take(winner);
    if (loser) take(loser);
    if (save) take(save);
    else if (hitter) take(hitter, /hit|hr|home|rbi|bat|avg/i.test(hitter.label) ? "Hit" : hitter.label);
    if (out.length < 3) {
      for (const row of pool) take(row);
    }
    return out.slice(0, 3);
  }

  for (const want of WANTS[family]) {
    const hit = pool.find((l) => matchWant(l, want));
    if (hit) take(hit, want.label);
  }
  if (out.length < 3) {
    for (const row of pool) take(row);
  }
  return out.slice(0, 3);
}

function paintSide(side: RecapSide, path: string): RecapSide {
  if (side.color) return side;
  if (path.startsWith("baseball/")) {
    return { ...side, color: mlbTeamColor(side.abbrev) };
  }
  return side;
}

function sideFromBox(side: BoxSide): RecapSide {
  return {
    id: side.id,
    name: side.name,
    short: side.short,
    abbrev: side.abbrev,
    logo: side.logo,
    color: side.color,
    score: side.score,
    record: side.record,
    winner: side.winner,
    hits: side.hits,
    errors: side.errors,
    lines: side.lines,
  };
}

export function packFromSides(opts: {
  path: string;
  league: string;
  venue: string | null;
  status: string;
  final: boolean;
  live: boolean;
  periods: string[];
  away: RecapSide;
  home: RecapSide;
  leaders: RecapLeader[];
}): RecapGamePack {
  return {
    ...opts,
    away: paintSide(opts.away, opts.path),
    home: paintSide(opts.home, opts.path),
    leaders: pickRecapLeaders(opts.path, opts.leaders),
  };
}

export function packFromBoxGame(game: BoxGame): RecapGamePack {
  const leaders = pickRecapLeaders(
    game.path,
    game.leaders.map(fromBoxLeader).filter((l): l is RecapLeader => Boolean(l)),
    game.decisions,
  );
  return {
    path: game.path,
    league: game.league,
    venue: game.venue,
    status: game.status,
    final: game.final,
    live: game.live,
    periods: game.periods,
    away: paintSide(sideFromBox(game.away), game.path),
    home: paintSide(sideFromBox(game.home), game.path),
    leaders,
  };
}

export function recapPackFor(card: RecapCardBits, game: BoxGame | null | undefined): RecapGamePack | null {
  const stored = card.recapGame ?? null;
  if (game) {
    const pack = packFromBoxGame(game);
    const extra = (card.leaders ?? [])
      .map((l) => asLeader(l))
      .filter((l): l is RecapLeader => Boolean(l));
    if (!pack.leaders.length) {
      pack.leaders = pickRecapLeaders(pack.path, [...(stored?.leaders ?? []), ...extra], game.decisions);
    }
    if (!pack.away.color && stored?.away.color) pack.away.color = stored.away.color;
    if (!pack.home.color && stored?.home.color) pack.home.color = stored.home.color;
    if (!pack.away.logo && stored?.away.logo) pack.away.logo = stored.away.logo;
    if (!pack.home.logo && stored?.home.logo) pack.home.logo = stored.home.logo;
    if (!pack.venue && stored?.venue) pack.venue = stored.venue;
    return pack;
  }
  if (stored) {
    return {
      ...stored,
      away: paintSide(stored.away, stored.path),
      home: paintSide(stored.home, stored.path),
      leaders: pickRecapLeaders(stored.path, stored.leaders),
    };
  }
  const extra = (card.leaders ?? [])
    .map((l) => asLeader(l))
    .filter((l): l is RecapLeader => Boolean(l));
  if (!extra.length) return null;
  return null;
}

/** A BoxGame the chrome components already know how to set, from a stored pack. */
export function boxGameFromPack(pack: RecapGamePack, espnEventId: string | null = null): BoxGame {
  const side = (s: RecapSide): BoxSide => ({
    id: s.id,
    name: s.name,
    short: s.short,
    abbrev: s.abbrev,
    logo: s.logo,
    color: s.color,
    score: s.score,
    hits: s.hits,
    errors: s.errors,
    record: s.record,
    winner: s.winner,
    rank: null,
    lines: s.lines,
  });
  return {
    id: `${pack.path}-${pack.away.abbrev}-${pack.home.abbrev}`,
    path: pack.path,
    league: pack.league,
    day: "",
    startIso: null,
    status: pack.status,
    final: pack.final,
    live: pack.live,
    venue: pack.venue,
    round: null,
    series: null,
    periods: pack.periods,
    away: side(pack.away),
    home: side(pack.home),
    decisions: [],
    probables: { away: null, home: null },
    leaders: pack.leaders.map((l) => ({
      label: l.label,
      name: l.name,
      line: l.line,
      headshot: l.headshot,
      team: l.team,
      id: l.id,
    })),
    scoring: [],
    recap: null,
    broadcasts: [],
    gamePk: null,
    espnEventId,
    href: null,
  };
}

/**
 * ESPN files "LONDON -- — Jonathan Taylor…". City off the dash, leftover
 * dashes dropped, so the page can set `LONDON —` once.
 */
export function splitApDateline(text: string): { dateline: string | null; body: string } {
  const raw = tidy(text)
    .replace(/\s*-{3,}\s*See AP['’]?s[\s\S]*$/i, "")
    .replace(/\s*_{3,}\s*AP [\s\S]*$/i, "")
    .replace(/\s*-{3,}\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) return { dateline: null, body: "" };
  const m =
    /^([A-Z][A-Z.'’]*(?:[ -][A-Z][A-Z.'’]*){0,3}(?:,\s*[A-Z][A-Za-z.]{1,12})?)\s*(?:--+|—|–)\s*(?:[—–-]+\s*)?/.exec(
      raw,
    );
  if (!m) return { dateline: null, body: raw.replace(/^(?:--+|—|–)\s+/, "") };
  return { dateline: m[1]!.trim(), body: raw.slice(m[0].length).replace(/^(?:--+|—|–)\s+/, "").trim() };
}

const AP_MONTHS: Record<string, string> = {
  Jan: "Jan.",
  Feb: "Feb.",
  Mar: "March",
  Apr: "April",
  May: "May",
  Jun: "June",
  Jul: "July",
  Aug: "Aug.",
  Sep: "Sept.",
  Oct: "Oct.",
  Nov: "Nov.",
  Dec: "Dec.",
};

/** Central, friendly: `Sun., Oct. 4 · 8:30 a.m. CT`. */
export function formatRecapWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const weekday = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "America/Chicago" });
  const month = d.toLocaleDateString("en-US", { month: "short", timeZone: "America/Chicago" });
  const day = d.toLocaleDateString("en-US", { day: "numeric", timeZone: "America/Chicago" });
  const clock = d
    .toLocaleTimeString("en-US", {
      timeZone: "America/Chicago",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(" AM", " a.m.")
    .replace(" PM", " p.m.");
  return `${weekday}., ${AP_MONTHS[month] ?? `${month}.`} ${day} · ${clock} CT`;
}

function recapSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+(?=["“A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** A one-line score (`Jazz 109, Nuggets 97.`) is not a story. */
export function recapIsScoreOnly(text: string | null | undefined): boolean {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return true;
  if (recapSentences(t).length > 1) return false;
  return recapIsScoreStub(t) || /^.+?\s\d{1,3},\s+.+?\s\d{1,3}\.?$/.test(t);
}

/** Banner already shows the score — `Final: LAC 23 · SEA 30.` is not a graf. */
export function recapIsScoreStub(text: string | null | undefined): boolean {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return true;
  return /^(?:final|end|f\/ot|f\/so)\s*:\s*.+\s\d{1,3}\s*[·•|,–-]\s*.+\s\d{1,3}\.?$/i.test(t);
}

/** Drop score-only sentences so the card can set the recap body. */
export function stripRecapScoreStubs(text: string | null | undefined): string {
  return recapSentences(text ?? "")
    .filter((s) => !recapIsScoreStub(s) && !recapIsScoreOnly(s))
    .join(" ");
}

export function recapShouldDropCap(text: string | null | undefined): boolean {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t || recapIsScoreOnly(t)) return false;
  return recapSentences(t).length >= 2;
}

export function recapBodyForPage(text: string | null | undefined): string {
  const { body } = splitApDateline(text ?? "");
  if (!body || recapIsScoreOnly(body)) return "";
  return stripRecapScoreStubs(body);
}

export type RecapDropLead = {
  /** Drop-cap letter: first of the dateline, else first of the opening word. */
  letter: string;
  /** Full city when a dateline is set. */
  city: string | null;
  /** Rest of the city after the drop letter, or null when there is no dateline. */
  datelineRest: string | null;
  /** Story with any leading AP dateline stripped. No city: rest after the drop letter. */
  body: string;
};

/**
 * Build the drop-cap lead. The letter is the dateline's first character
 * (`M` of `MILWAUKEE — Jackson…`). Without a city it is the first word's
 * first letter, with the rest of that word immediately after. Any city
 * already on the body is stripped so the dateline is not printed twice.
 */
export function recapDropLead(
  dateline: string | null | undefined,
  body: string | null | undefined,
): RecapDropLead | null {
  const split = splitApDateline(body ?? "");
  const city = (dateline ?? "").trim() || split.dateline;
  const clean = split.body;
  if (city) {
    return { letter: city.slice(0, 1), city, datelineRest: city.slice(1), body: clean };
  }
  if (!clean) return null;
  return { letter: clean.slice(0, 1), city: null, datelineRest: null, body: clean.slice(1) };
}

function stripRecapCopy(htmlOrText: string): string {
  return (htmlOrText ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s*-{3,}\s*See AP['’]?s[\s\S]*$/i, "")
    .replace(/\s*_{3,}\s*AP [\s\S]*$/i, "")
    .replace(/\s*-{3,}\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A quotation from later in the wrap, used to fill leftover space after the
 * lead graf. Prefers a spoken quote; returns null when the copy has none.
 */
export function recapPullQuote(htmlOrText: string): string | null {
  const stripped = stripRecapCopy(htmlOrText);
  const { body } = splitApDateline(stripped);
  if (!body) return null;
  const paras = body
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const rest = paras.slice(1).join(" ") || body;
  const quotes = [...rest.matchAll(/[“"]([^”"]{50,180})[”"]/g)].map((m) => m[1]!.trim());
  if (!quotes.length) return null;
  const pick = quotes.sort((a, b) => b.length - a.length)[0]!;
  return `“${pick.replace(/[,.]$/, "")}.”`;
}

/** Full story when it fits; otherwise the last complete sentence before `max`. */
export function recapPrintStory(
  htmlOrText: string,
  maxChars: number | null,
): { dateline: string | null; body: string; dropCap: boolean } {
  const { dateline, body: raw } = splitApDateline(stripRecapCopy(htmlOrText));
  if (!raw || recapIsScoreOnly(raw)) return { dateline, body: "", dropCap: false };
  const body = maxChars != null ? truncateAtSentence(raw, maxChars) : raw;
  if (!body || recapIsScoreOnly(body)) return { dateline, body: "", dropCap: false };
  return { dateline, body, dropCap: recapShouldDropCap(body) };
}

/** A card graf is 2–4 sentences of the lead; lead cards can run a little longer. */
export const RECAP_CARD_GRAF = 560;
export const RECAP_LEAD_GRAF = 640;
const RECAP_GRAF_MIN_SENTENCES = 2;
const RECAP_GRAF_MAX_SENTENCES = 4;
const RECAP_GRAF_SHORT_WORDS = 25;

function recapWordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Paper card copy: a real first paragraph of 2–4 sentences. Uses the first
 * full paragraph of the recap, or the first two when that lead is under
 * ~25 words (a kicker fragment, not a graf). Cut on a sentence. A one-line
 * score is omitted.
 */
/** Injury notes may mention last night's score; they are not the game story. */
export function isInjuryRecapHeadline(text: string): boolean {
  return /\binjur|dislocat|surgery|day-to-day|questionable|doubtful|adductor|ruled out|week-to-week|out for (?:the )?(?:season|year)\b/i.test(
    text,
  );
}

/** City + club ("Los Angeles Dodgers") becomes the nickname so a kicker fits. */
export function recapTeamNick(name: string | null | undefined): string {
  const raw = (name ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  const parts = raw.split(" ");
  if (parts.length === 1) return raw;
  if (/^golden$/i.test(parts[0]) || (/^vegas$/i.test(parts[0]) && /^golden$/i.test(parts[1] ?? ""))) {
    const nick = parts.slice(-2).join(" ");
    return nick.length <= 16 ? nick : parts[parts.length - 1]!;
  }
  return parts[parts.length - 1]!;
}

/**
 * Compact kicker: league + winning (or featured) nickname. Never the full
 * city+club string, which letter-spaces off the card.
 */
export function recapKicker(
  card: RecapCardBits & { teamName?: string | null; sportLabel?: string | null; round?: string | null },
  game?: BoxGame | null,
): string {
  const league = (card.sportLabel || game?.league || "").trim();
  const winner = game ? (game.away.winner ? game.away : game.home.winner ? game.home : null) : null;
  const nick = recapTeamNick(winner?.short || card.teamName);
  const bits = [league || null, card.round || (card.postseason ? "Postseason" : null), nick && nick.length <= 16 ? nick : null].filter(
    Boolean,
  ) as string[];
  if (bits.length) return bits.join(" · ");
  return league || nick || "";
}

/** AP/ESPN game story when the board filed one; otherwise the card body. */
export function recapCardSource(
  card: { headline: string; body?: string | null; dek?: string | null },
  game?: { recap?: { html?: string | null; headline?: string | null } | null } | null,
): { headline: string; body: string } {
  const recapHtml = game?.recap?.html ?? "";
  const recapText = stripRecapScoreStubs(recapHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  const cardBody = stripRecapScoreStubs((card.body ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  const injury = isInjuryRecapHeadline(`${card.headline} ${card.dek ?? ""}`);
  if (recapText.length >= 40 && (injury || recapText.length >= Math.min(80, cardBody.length))) {
    return { headline: game?.recap?.headline || card.headline, body: recapText };
  }
  return { headline: card.headline, body: cardBody || stripRecapScoreStubs(card.dek ?? "") };
}

export function recapCardGraf(
  htmlOrText: string,
  maxChars: number = RECAP_CARD_GRAF,
): { dateline: string | null; body: string; dropCap: boolean } {
  const stripped = (htmlOrText ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s*-{3,}\s*See AP['’]?s[\s\S]*$/i, "")
    .replace(/\s*_{3,}\s*AP [\s\S]*$/i, "")
    .replace(/\s*-{3,}\s*$/g, "")
    .trim();
  const blocks = stripped
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const first = blocks[0] ?? "";
  const { dateline, body: leadRaw } = splitApDateline(first);
  const lead = stripRecapScoreStubs(leadRaw);
  if (!lead || recapIsScoreOnly(lead)) return { dateline, body: "", dropCap: false };
  const second = stripRecapScoreStubs(blocks[1]?.replace(/\s+/g, " ").trim() ?? "");
  const raw = recapWordCount(lead) < RECAP_GRAF_SHORT_WORDS && second ? `${lead} ${second}` : lead;
  const sentences = splitNewspaperSentences(raw);
  const take = Math.min(RECAP_GRAF_MAX_SENTENCES, Math.max(RECAP_GRAF_MIN_SENTENCES, sentences.length));
  const picked = sentences.slice(0, take).join(" ");
  const body = truncateAtSentence(picked, maxChars);
  if (!body || recapIsScoreOnly(body)) return { dateline, body: "", dropCap: false };
  return { dateline, body, dropCap: Boolean(dateline) || recapShouldDropCap(body) };
}
