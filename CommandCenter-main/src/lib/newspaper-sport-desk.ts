/**
 * Recaps-desk rules for a Times sport section: spike the junk, keep one wrap
 * per game, order the night, and attach a feature as a related item.
 */

import { favoriteDeskWeight, gameWrapCovers, isGameWrapStory, isResultCopy } from "./newspaper.ts";
import { scoresInHeadline } from "./newspaper-box.ts";
import { isNewspaperSecGame } from "./newspaper-espn.ts";
import { wrapBriefSentences } from "./newspaper-box-wrap.ts";
import { storySource } from "./newspaper-source.ts";
import { favoriteKeyFitsPath, storyMatchesFavorite } from "./newspaper-favorite-match.ts";
import type { GameWrapCard } from "./newspaper-sports.ts";

function isPreviewCard(card: GameWrapCard): boolean {
  if (card.status && /\b(scheduled|pre-?game|preview)\b/i.test(card.status)) return true;
  if (card.wrapHref && /\/preview\b/i.test(card.wrapHref)) return true;
  if (/\bBOTTOM LINE:|\bLINE:\s|Data Skrive/.test(card.body ?? "")) return true;
  const head = `${card.headline} ${card.dek ?? ""}`;
  return (
    /\b(hosts?|visits?|face|take on|meet)\b.*\bto (start|open|begin|kick off)\b/i.test(head) ||
    /\b(preview|what to watch|how to watch|keys to the game|prediction)\b/i.test(card.headline)
  );
}

export const SPORT_NEWS_CAP = 8;

export type RelatedStory = {
  id: string;
  headline: string;
  href: string | null;
  source: string | null;
};

export type SpikeReason =
  | "video"
  | "fantasy"
  | "betting"
  | "podcast"
  | "listicle"
  | "preview"
  | "wrong-sport"
  | "duplicate-game";

const VIDEO =
  /\b(game highlights?|highlights?|watch now|must-see|viral clip|film room|watch:)\b/i;
const FANTASY = /\b(fantasy|dfs|draftkings|sleeper pick|start.?em|sit.?em)\b/i;
const BETTING =
  /\b(betting|odds|spread|over-?under|prop bet|picks? and parlays?|best bets?|moneyline)\b/i;
const PODCAST = /\b(podcast|pod\b|listen now|episode \d+)\b/i;
const LISTICLE =
  /^(?:\d+\s+(?:things|plays|moments|takeaways|reasons|signs)|here are \d+|the \d+ (?:best|worst|biggest)|things we learned|week \d+ power rankings)\b/i;

function hay(card: GameWrapCard): string {
  return `${card.headline} ${card.dek ?? ""} ${card.status ?? ""} ${card.wrapHref ?? ""} ${card.feedUrl ?? ""}`;
}

export function isGameWrapCard(card: GameWrapCard): boolean {
  return isGameWrapStory(card);
}

/** A transaction / injury note — not a recap, and not Section A filler. */
export function isInjuryNote(card: GameWrapCard): boolean {
  if (isGameWrapCard(card)) return false;
  if (card.scoreLine && /\d/.test(card.scoreLine) && /\bfinal\b/i.test(card.status ?? "")) return false;
  const head = `${card.headline} ${card.dek ?? ""}`;
  return /\binjur|surgery|questionable|doubtful|out for the season|season-ending|torn (?:acl|achilles)|dislocat|to have surgery|expected back in|out \d+(?:-\d+)? weeks|sidelined|injured reserve|week-to-week|placed on ir\b/i.test(
    head,
  );
}

export function sportFillerReason(card: GameWrapCard, recaps: GameWrapCard[] = []): SpikeReason | null {
  if (isGameWrapCard(card)) return null;
  const text = hay(card);
  const href = `${card.wrapHref ?? ""} ${card.feedUrl ?? ""}`;
  if (card.status && /\b(video|media)\b/i.test(card.status)) return "video";
  if (/\/video\b|\/clip\b|watch\.espn/i.test(href) || VIDEO.test(text)) return "video";
  if (FANTASY.test(text)) return "fantasy";
  if (BETTING.test(text)) return "betting";
  if (PODCAST.test(text) || /\/podcast/i.test(href)) return "podcast";
  if (LISTICLE.test(card.headline.trim())) return "listicle";
  if (isPreviewCard(card) && recaps.some((wrap) => sameGameStory(card, wrap))) return "preview";
  return null;
}

export function isSportFiller(card: GameWrapCard, recaps: GameWrapCard[] = []): boolean {
  return sportFillerReason(card, recaps) != null;
}

/** Championship clubs (and the league name). International / MLS stars are not EFL copy. */
const EFL_CLUB =
  /\b(wrexham|wolves|wolverhampton|leicester|southampton|ipswich|leeds|norwich|sheffield wednesday|sheffield united|west brom|coventry|middlesbrough|stoke|hull|bristol city|watford|swansea|cardiff|qpr|queens park|millwall|preston|blackburn|derby|portsmouth|oxford|plymouth|charlton|birmingham|sunderland|championship|efl)\b/i;
const NOT_EFL =
  /\b(messi|ronaldo|reyna|inter miami|mls|lafc|galaxy|premier league|champions league|liga mx)\b/i;

/** True when the card is actually Championship / EFL news. */
export function isEflChampionshipStory(card: GameWrapCard): boolean {
  if (card.leaguePath && card.leaguePath !== "soccer/eng.2") return false;
  const text = hay(card);
  if (NOT_EFL.test(text) && !EFL_CLUB.test(text)) return false;
  return EFL_CLUB.test(text);
}

const CFB_OFF_DESK =
  /\b(colts|commanders|jordan walker|nfl\b|world series|nlcs|alcs)\b/i;
const CFB_OTHER_SPORT =
  /\b(soccer|usmnt|world cup|\bmls\b|premier league|nba\b|nhl\b|wizards|anthony davis|timberwolves|lakers)\b/i;
const CFB_SIGNAL = /\b(college|ncaa|sec\b|acc\b|big ten|big 12|mizzou|missouri tigers)\b/i;

function cfbDeskCopy(text: string): boolean {
  if (CFB_OTHER_SPORT.test(text)) return false;
  if (CFB_OFF_DESK.test(text) && !CFB_SIGNAL.test(text)) return false;
  return true;
}

export function storyFitsSection(card: GameWrapCard, path: string): boolean {
  if (path === "soccer/eng.2") return isEflChampionshipStory(card);
  if (card.leaguePath && card.leaguePath !== path) return false;
  if (path === "football/college-football") {
    const text = hay(card);
    if (!cfbDeskCopy(text)) return false;
    if (!card.leaguePath && /\b(nfl|mlb|nhl|nba)\b/i.test(text) && !CFB_SIGNAL.test(text)) return false;
  }
  return !card.leaguePath || card.leaguePath === path;
}

export function relatedFitsSection(
  item: { headline: string; source?: string | null; href?: string | null },
  path: string,
): boolean {
  if (path !== "football/college-football") return true;
  const text = `${item.headline} ${item.source ?? ""} ${item.href ?? ""}`;
  return cfbDeskCopy(text);
}

function eventIdOf(card: GameWrapCard): string | null {
  const raw = card.gameId ?? "";
  const fromId = raw.match(/(\d{6,})/)?.[1];
  if (fromId) return fromId;
  const href = `${card.wrapHref ?? ""} ${card.gameHref ?? ""}`;
  return href.match(/(?:gameId|event)[=/](\d{6,})/i)?.[1] ?? null;
}

const GAME_TOKEN_STOP = new Set([
  "beat", "over", "from", "with", "that", "will", "this", "have", "been", "were",
  "they", "into", "after", "week", "more", "than", "then", "when", "game", "win",
  "wins", "lead", "seals", "throws", "passes", "start", "best", "fuel",
]);

function teamTokens(card: GameWrapCard): string[] {
  return `${card.headline} ${card.scoreLine ?? ""} ${card.teamName}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !GAME_TOKEN_STOP.has(w));
}

type GameMatchKey = {
  eventId: string | null;
  tokens: string[];
  tokenSet: Set<string>;
  scoreKey: string | null;
  leaguePath: string | null;
  hasScore: boolean;
  isWrap: boolean;
};

const matchKeyCache = new WeakMap<GameWrapCard, GameMatchKey>();

function matchKeyOf(card: GameWrapCard): GameMatchKey {
  const hit = matchKeyCache.get(card);
  if (hit) return hit;
  const tokens = teamTokens(card);
  const key: GameMatchKey = {
    eventId: eventIdOf(card),
    tokens,
    tokenSet: new Set(tokens),
    scoreKey: card.scoreLine ? `${card.scoreLine}\0${card.leaguePath ?? ""}` : null,
    leaguePath: card.leaguePath ?? null,
    hasScore: Boolean(card.scoreLine),
    isWrap: isGameWrapCard(card),
  };
  matchKeyCache.set(card, key);
  return key;
}

function sameGameKeyed(a: GameMatchKey, b: GameMatchKey): boolean {
  if (a.eventId && b.eventId && a.eventId === b.eventId) return true;
  if (a.leaguePath && b.leaguePath && a.leaguePath !== b.leaguePath) return false;
  if (a.scoreKey && b.scoreKey && a.scoreKey === b.scoreKey) return true;
  // sameGameStory(a, b) counted tokens(b) against the set of a.
  const shared = b.tokens.filter((w) => a.tokenSet.has(w));
  return shared.length >= 2 && Boolean(a.hasScore || b.hasScore || a.isWrap || b.isWrap);
}

export function sameGameStory(a: GameWrapCard, b: GameWrapCard): boolean {
  return sameGameKeyed(matchKeyOf(a), matchKeyOf(b));
}

function indexKeptWraps(kept: GameWrapCard[]): { byEvent: Map<string, number>; byScore: Map<string, number> } {
  const byEvent = new Map<string, number>();
  const byScore = new Map<string, number>();
  for (let i = 0; i < kept.length; i++) {
    const key = matchKeyOf(kept[i]!);
    if (key.eventId && !byEvent.has(key.eventId)) byEvent.set(key.eventId, i);
    if (key.scoreKey && !byScore.has(key.scoreKey)) byScore.set(key.scoreKey, i);
  }
  return { byEvent, byScore };
}

/** First kept wrap that matches, same order as findIndex(sameGameStory). */
function findKeptWrapIndex(card: GameWrapCard, kept: GameWrapCard[]): number {
  if (!kept.length) return -1;
  const key = matchKeyOf(card);
  const { byEvent, byScore } = indexKeptWraps(kept);
  let hinted = -1;
  if (key.eventId && byEvent.has(key.eventId)) hinted = byEvent.get(key.eventId)!;
  else if (key.scoreKey && byScore.has(key.scoreKey)) hinted = byScore.get(key.scoreKey)!;
  const limit = hinted >= 0 ? hinted : kept.length;
  for (let i = 0; i < limit; i++) {
    if (sameGameKeyed(key, matchKeyOf(kept[i]!))) return i;
  }
  return hinted;
}

function isFeatureOutlet(card: GameWrapCard): boolean {
  const source = (storySource(card) ?? card.caption ?? "").toLowerCase();
  if (source.includes("athletic") || source.includes("post-dispatch")) return true;
  return card.id.startsWith("athletic-") || /theathletic\.com|stltoday\.com/i.test(`${card.wrapHref ?? ""} ${card.feedUrl ?? ""}`);
}

function wrapPreference(card: GameWrapCard): number {
  if (card.wrapKind === "espn" || card.id.startsWith("wire-")) return 0;
  if ((storySource(card) ?? "").includes("Associated Press")) return 1;
  if (card.wrapKind === "box") return 2;
  if (isGameWrapCard(card)) return 3;
  return 4;
}

function asRelated(card: GameWrapCard): RelatedStory {
  return {
    id: card.id,
    headline: card.headline,
    href: card.wrapHref ?? card.gameHref,
    source: storySource(card) ?? card.caption ?? null,
  };
}

export type RelatedCopyCursor = {
  wrapAt: number;
  restAt: number;
  keptWraps: GameWrapCard[];
  leftover: GameWrapCard[];
};

export type RelatedCopyStep = {
  done: boolean;
  phase: "related-wraps" | "related-rest";
  cursor: RelatedCopyCursor;
  cards?: GameWrapCard[];
};

function foldKeptWrap(keptWraps: GameWrapCard[], card: GameWrapCard): void {
  const idx = findKeptWrapIndex(card, keptWraps);
  if (idx < 0) {
    keptWraps.push({ ...card, related: card.related ? [...card.related] : [] });
    return;
  }
  const prev = keptWraps[idx]!;
  const nextWins = wrapPreference(card) < wrapPreference(prev);
  const winner = nextWins ? card : prev;
  const loser = nextWins ? prev : card;
  keptWraps[idx] = {
    ...winner,
    related: [...(winner.related ?? []), asRelated(loser), ...(loser.related ?? [])],
  };
}

function attachRestCard(keptWraps: GameWrapCard[], leftover: GameWrapCard[], card: GameWrapCard): void {
  const idx = findKeptWrapIndex(card, keptWraps);
  const wrap = idx >= 0 ? keptWraps[idx] : undefined;
  if (wrap && (isFeatureOutlet(card) || isPreviewCard(card))) {
    wrap.related = [...(wrap.related ?? []), asRelated(card)];
    return;
  }
  leftover.push(card);
}

/**
 * One wrap per game. AP / ESPN recap stays; an Athletic or Post-Dispatch
 * feature on the same game hangs off it as a related item.
 *
 * `attachRelatedGameCopyStep` is the same walk with a time budget so the
 * scheduled press can save a cursor and come back.
 */
export function attachRelatedGameCopyStep(
  cards: GameWrapCard[],
  cursor: RelatedCopyCursor | null,
  budgetMs: number,
): RelatedCopyStep {
  const wraps = cards.filter(isGameWrapCard);
  const rest = cards.filter((c) => !isGameWrapCard(c));
  const started = Date.now();
  let wrapAt = cursor?.wrapAt ?? 0;
  let restAt = cursor?.restAt ?? 0;
  const keptWraps = cursor?.keptWraps ?? [];
  const leftover = cursor?.leftover ?? [];
  let progressed = false;

  while (wrapAt < wraps.length) {
    if (progressed && Date.now() - started >= budgetMs) {
      return { done: false, phase: "related-wraps", cursor: { wrapAt, restAt, keptWraps, leftover } };
    }
    foldKeptWrap(keptWraps, wraps[wrapAt]!);
    wrapAt += 1;
    progressed = true;
  }

  while (restAt < rest.length) {
    if (progressed && Date.now() - started >= budgetMs) {
      return { done: false, phase: "related-rest", cursor: { wrapAt, restAt, keptWraps, leftover } };
    }
    attachRestCard(keptWraps, leftover, rest[restAt]!);
    restAt += 1;
    progressed = true;
  }

  return {
    done: true,
    phase: "related-rest",
    cursor: { wrapAt, restAt, keptWraps, leftover },
    cards: [...keptWraps, ...leftover],
  };
}

export function attachRelatedGameCopy(cards: GameWrapCard[]): GameWrapCard[] {
  const step = attachRelatedGameCopyStep(cards, null, Number.POSITIVE_INFINITY);
  return step.cards ?? [...(step.cursor.keptWraps ?? []), ...(step.cursor.leftover ?? [])];
}

function recapScore(card: GameWrapCard): number {
  return (
    (card.favoriteKey || card.followed ? 10_000 + favoriteDeskWeight(card.favoriteKey) : 0) +
    (card.postseason ? 5_000 : 0) +
    (card.ranked ? 2_000 : 0) +
    (card.sec ? 1_500 : 0) +
    Math.min(400, Math.floor((card.body?.length ?? 0) / 10))
  );
}

function bySignificance(a: GameWrapCard, b: GameWrapCard): number {
  const diff = recapScore(b) - recapScore(a);
  if (diff) return diff;
  return String(a.when ?? "").localeCompare(String(b.when ?? ""));
}

export function isSecCard(card: GameWrapCard): boolean {
  if (card.leaguePath && card.leaguePath !== "football/college-football") return false;
  if (card.sec) return true;
  if (card.favoriteKey === "cfb-mizzou") return true;
  return false;
}

/** Times box-wrap stub — a two-sentence score line, not a filed recap. */
export function isBoxStub(card: GameWrapCard): boolean {
  if (card.wrapKind === "box") return true;
  if (card.id.startsWith("box-") && !card.photo && (card.body?.length ?? 0) < 400) return true;
  return false;
}

export function isWrapLead(card: GameWrapCard): boolean {
  if (isGameWrapCard(card) || Boolean(card.scoreLine && /\d/.test(card.scoreLine))) return true;
  if (scoresInHeadline(card.headline ?? "")) return true;
  return isResultCopy({
    headline: card.headline,
    dek: card.dek,
    status: card.status,
    scoreLine: card.scoreLine,
    type: card.id.startsWith("news-") || card.id.startsWith("league-") ? card.status : null,
  });
}

const CLUB_ALIASES: Record<string, RegExp> = {
  "cfb-mizzou": /mizzou|missouri tigers|\bmissouri\b(?!\s+state)/,
  "cbb-mizzou": /mizzou|missouri tigers|\bmissouri\b(?!\s+state)/,
  "eng-wrexham": /wrexham/,
  "eng-wolves": /wolverhampton|(?<!timber)wolves\b/,
};

const AMBIGUOUS_GAME_NICK = /^(cardinals|lions|bears|blues|wolves|arsenal)$/i;

export function favoriteKeyForGame(
  game: {
    away: { short?: string | null; name?: string | null; id?: string | null; abbrev?: string | null };
    home: { short?: string | null; name?: string | null; id?: string | null; abbrev?: string | null };
    path?: string | null;
  },
  clubs: { key: string; shortName: string; leaguePath?: string | null }[],
): string {
  const path = (game.path ?? "").toLowerCase();
  const names = [game.away.short, game.away.name, game.home.short, game.home.name]
    .map((s) => (s ?? "").toLowerCase())
    .filter(Boolean);
  const ids = [game.away.id, game.home.id].map((s) => (s ?? "").toLowerCase()).filter(Boolean);
  const abbrevs = [game.away.abbrev, game.home.abbrev].map((s) => (s ?? "").toLowerCase()).filter(Boolean);
  const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const sides = names.map(squash).filter(Boolean);

  for (const club of clubs) {
    if (path && club.leaguePath && club.leaguePath !== path) continue;
    if (path && !favoriteKeyFitsPath(club.key, path)) continue;
    const fav = {
      key: club.key,
      name: club.shortName,
      shortName: club.shortName,
      sport: "",
      league: "",
      espnPath: club.leaguePath ? `${club.leaguePath}/teams/0` : "",
      kind: "team" as const,
    };
    if (
      storyMatchesFavorite(
        {
          headline: `${game.away.name ?? game.away.short ?? ""} ${game.home.name ?? game.home.short ?? ""}`,
          teamName: `${game.away.short ?? ""} ${game.home.short ?? ""}`,
          leaguePath: game.path ?? club.leaguePath ?? null,
          recapGame: { away: game.away, home: game.home },
        },
        fav,
      )
    ) {
      return club.key;
    }
    const alias = CLUB_ALIASES[club.key];
    if (alias && names.some((s) => alias.test(s))) return club.key;
    const nick = club.shortName.toLowerCase();
    const n = squash(club.shortName);
    if (!n || n.length < 3) continue;
    // ESPN id / official abbreviation still stamp the desk when names are short.
    if (abbrevs.includes(n) || ids.includes(n)) return club.key;
    if (sides.some((s) => s === n)) return club.key;
    if (AMBIGUOUS_GAME_NICK.test(nick)) continue;
    if (names.some((s) => s === nick || s.endsWith(` ${nick}`))) return club.key;
  }
  return "";
}

/** Team crests are not a recap cut. */
export function isStoryPhoto(url: string | null | undefined): boolean {
  if (!url) return false;
  return !/teamlogos|\/team-logos\/|\/logos\//i.test(url);
}

/** Photo + copy beats a long box wrap with no cut. */
export function frontCardWeight(card: GameWrapCard): number {
  return (isStoryPhoto(card.photo) ? 2_000 : 0) + (isBoxStub(card) ? 0 : 800) + Math.min(800, card.body?.length ?? 0);
}

export function preferFrontCard(a: GameWrapCard, b: GameWrapCard): GameWrapCard {
  return frontCardWeight(a) >= frontCardWeight(b) ? a : b;
}

/** Never open on a box stub when a photo recap (even a holdover) is on file. */
export function alreadyOnSectionA(card: GameWrapCard, ran: GameWrapCard[] = []): boolean {
  return ran.some((a) => a.id === card.id || sameGameStory(a, card));
}

export function pickSectionFrontLead(
  wraps: GameWrapCard[],
  pool: GameWrapCard[],
  editorLead?: GameWrapCard,
  newsLead?: GameWrapCard,
  alreadyOnA1: GameWrapCard[] = [],
): GameWrapCard | undefined {
  const open = (cs: GameWrapCard[]) => cs.filter((c) => !alreadyOnSectionA(c, alreadyOnA1));
  const quality = wraps.filter((c) => !isBoxStub(c) && (isStoryPhoto(c.photo) || (c.body?.length ?? 0) >= 280));
  const pictured = quality.filter((c) => isStoryPhoto(c.photo));
  const picturedFresh = pictured.filter((c) => !c.holdover);
  const picturedPost = pictured.filter((c) => c.postseason);
  const qualityFresh = quality.filter((c) => !c.holdover);
  const qualityPost = quality.filter((c) => c.postseason);
  const favOf = (cs: GameWrapCard[]) => cs.filter((c) => c.favoriteKey || c.followed);
  const nonStubFresh = wraps.filter((c) => !c.holdover && !isBoxStub(c));
  const nonStub = wraps.filter((c) => !isBoxStub(c));
  const freshWraps = wraps.filter((c) => !c.holdover);
  return (
    favOf(open(picturedFresh))[0] ??
    favOf(open(qualityFresh))[0] ??
    open(picturedFresh)[0] ??
    open(picturedPost)[0] ??
    open(pictured)[0] ??
    open(qualityFresh)[0] ??
    open(qualityPost)[0] ??
    open(quality)[0] ??
    open(nonStubFresh)[0] ??
    open(nonStub)[0] ??
    open(freshWraps)[0] ??
    open(wraps)[0] ??
    (editorLead && !alreadyOnSectionA(editorLead, alreadyOnA1) ? editorLead : undefined) ??
    (newsLead && !alreadyOnSectionA(newsLead, alreadyOnA1) ? newsLead : undefined) ??
    open(pool)[0] ??
    picturedFresh[0] ??
    wraps[0] ??
    pool[0]
  );
}

/** Last-match brief from a club snapshot — logo art, not an empty hole. */
export function lastMatchCardFromChip(opts: {
  key: string;
  name: string;
  shortName: string;
  logo: string | null;
  leaguePath: string;
  sportLabel: string;
  last: { label: string; detail: string | null; when: string | null; won: boolean | null };
}): GameWrapCard {
  const raw = opts.last.label.replace(/\s+/g, " ").trim();
  const away = /^\s*@/i.test(raw);
  const opp = raw.replace(/^(vs|@)\s+/i, "").trim() || "their last opponent";
  const venue = away ? "at" : "vs";
  const score = opts.last.detail;
  const verb = opts.last.won === true ? "beat" : opts.last.won === false ? "fell to" : "played";
  const headline = score
    ? `${opts.shortName} ${verb} ${opp} ${score}`
    : `${opts.shortName} ${venue} ${opp}`;
  const whenBit = opts.last.when ? ` (${opts.last.when})` : "";
  const follow =
    opts.last.won === true
      ? `${opts.shortName} take the points and turn to the next Championship fixture.`
      : opts.last.won === false
        ? `${opts.shortName} will look to bounce back in the next Championship fixture.`
        : `The last Championship result is on the sheet.`;
  const body = score
    ? `${opts.name} ${verb} ${opp} ${score}${whenBit}. ${follow}`
    : `${opts.name} played ${opp}${whenBit}. ${follow}`;
  return {
    id: `last-${opts.key}-${raw}-${score ?? "final"}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    favoriteKey: opts.key,
    followed: true,
    teamName: opts.shortName,
    teamHref: "/",
    sportLabel: opts.sportLabel,
    leaguePath: opts.leaguePath,
    headline,
    dek: score,
    body,
    scoreLine: score,
    when: opts.last.when,
    won: opts.last.won,
    gameHref: null,
    wrapHref: null,
    feedUrl: null,
    gameId: null,
    stats: [],
    leaders: [],
    teamStats: [],
    division: [],
    photo: opts.logo,
    caption: `${opts.name} ${venue} ${opp}.`,
    status: "Final",
  };
}

function isFreshSectionLead(card: GameWrapCard, path: string, edition: string): boolean {
  if (isWrapLead(card)) {
    if (!card.when) return true;
    if (gameWrapCovers(card.when, edition, path) || card.holdover) return true;
    if (card.postseason) return true;
    if (card.status && /\brecap\b/i.test(card.status)) return true;
    return false;
  }
  if (card.holdover) return false;
  return true;
}

/**
 * Section-front order: today's / last night's wraps first (Josh's clubs,
 * then current / ranked / postseason games), then editor news. A stale
 * holdover never opens the section when a fresh game is on file.
 */
export function orderSportSectionFront(
  cards: GameWrapCard[],
  path: string,
  edition: string,
  alreadyOnA1: GameWrapCard[] = [],
): GameWrapCard[] {
  const seen = new Set<string>();
  const unique = cards.filter((card) => {
    if (seen.has(card.id)) return false;
    seen.add(card.id);
    return true;
  });
  const fresh = unique.filter((card) => isFreshSectionLead(card, path, edition));
  const pool = fresh.length ? fresh : unique;
  const wraps = orderSportRecaps(pool.filter(isWrapLead), path);
  const news = pool
    .filter((card) => !isWrapLead(card))
    .sort((a, b) => (a.editorRank ?? 99) - (b.editorRank ?? 99) || String(b.when ?? "").localeCompare(String(a.when ?? "")));
  const newsLead = news.find((card) => !isInjuryNote(card));
  const editorLead = pool.find((card) => card.editorFront === 0 && !isInjuryNote(card));
  const lead = pickSectionFrontLead(wraps, pool, editorLead, newsLead, alreadyOnA1);
  if (!lead) return [];
  const rest = pool.filter((card) => card.id !== lead.id);
  const withPhoto = rest.filter((card) => card.photo);
  const without = rest.filter((card) => !card.photo);
  return [lead, ...withPhoto, ...without];
}

export function orderSportRecaps(cards: GameWrapCard[], path: string): GameWrapCard[] {
  const fav = cards.filter((c) => c.favoriteKey || c.followed).sort(bySignificance);
  const rest = cards.filter((c) => !c.favoriteKey && !c.followed);
  if (path === "football/college-football") {
    const sec = rest.filter(isSecCard).sort(bySignificance);
    const other = rest.filter((c) => !isSecCard(c)).sort(bySignificance);
    return [...fav, ...sec, ...other];
  }
  const marquee = rest.filter((c) => c.postseason || c.ranked).sort(bySignificance);
  const other = rest.filter((c) => !c.postseason && !c.ranked).sort(bySignificance);
  return [...fav, ...marquee, ...other];
}

export function groupSportRecaps(
  cards: GameWrapCard[],
  path: string,
): { title: string; cards: GameWrapCard[] }[] {
  const ordered = orderSportRecaps(cards, path);
  if (path === "football/college-football") {
    const fav = ordered.filter((c) => c.favoriteKey || c.followed);
    const sec = ordered.filter((c) => !(c.favoriteKey || c.followed) && isSecCard(c));
    const other = ordered.filter((c) => !(c.favoriteKey || c.followed) && !isSecCard(c));
    return [
      fav.length ? { title: "Your club", cards: fav } : null,
      sec.length ? { title: "SEC", cards: sec } : null,
      other.length ? { title: "Around the country", cards: other } : null,
    ].filter((b): b is { title: string; cards: GameWrapCard[] } => Boolean(b));
  }
  const fav = ordered.filter((c) => c.favoriteKey || c.followed);
  const marquee = ordered.filter((c) => !(c.favoriteKey || c.followed) && (c.postseason || c.ranked));
  const other = ordered.filter((c) => !(c.favoriteKey || c.followed) && !c.postseason && !c.ranked);
  return [
    fav.length ? { title: "Your clubs", cards: fav } : null,
    marquee.length ? { title: "Marquee", cards: marquee } : null,
    other.length ? { title: "The rest of the slate", cards: other } : null,
  ].filter((b): b is { title: string; cards: GameWrapCard[] } => Boolean(b));
}

export function wrapBriefCopy(card: GameWrapCard, max = 4): string {
  return wrapBriefSentences(card.body || card.dek || "", max);
}

export function isCfbSecIds(awayId?: string | null, homeId?: string | null): boolean {
  return isNewspaperSecGame("football/college-football", awayId, homeId);
}

export function spikeSportCopy(
  cards: GameWrapCard[],
  path: string,
): { kept: GameWrapCard[]; spiked: { card: GameWrapCard; reason: SpikeReason }[] } {
  const recaps = cards.filter((c) => isGameWrapCard(c) || (c.scoreLine && /\d/.test(c.scoreLine)));
  const spiked: { card: GameWrapCard; reason: SpikeReason }[] = [];
  const kept: GameWrapCard[] = [];
  for (const card of cards) {
    if (!storyFitsSection(card, path)) {
      spiked.push({ card, reason: "wrong-sport" });
      continue;
    }
    const reason = sportFillerReason(card, recaps);
    if (reason) {
      spiked.push({ card, reason });
      continue;
    }
    kept.push(card);
  }
  return { kept, spiked };
}
