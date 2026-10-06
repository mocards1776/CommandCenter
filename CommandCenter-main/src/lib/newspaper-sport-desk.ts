/**
 * Recaps-desk rules for a Times sport section: spike the junk, keep one wrap
 * per game, order the night, and attach a feature as a related item.
 */

import { favoriteDeskWeight, gameWrapCovers, isGameWrapStory, isResultCopy } from "./newspaper.ts";
import { isNewspaperSecGame } from "./newspaper-espn.ts";
import { wrapBriefSentences } from "./newspaper-box-wrap.ts";
import { storySource } from "./newspaper-source.ts";
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
  return /\binjur|surgery|questionable|doubtful|out for the season|season-ending|torn (?:acl|achilles)|dislocat|to have surgery\b/i.test(
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

export function storyFitsSection(card: GameWrapCard, path: string): boolean {
  if (path === "soccer/eng.2") return isEflChampionshipStory(card);
  if (!card.leaguePath) return true;
  return card.leaguePath === path;
}

function eventIdOf(card: GameWrapCard): string | null {
  const raw = card.gameId ?? "";
  const fromId = raw.match(/(\d{6,})/)?.[1];
  if (fromId) return fromId;
  const href = `${card.wrapHref ?? ""} ${card.gameHref ?? ""}`;
  return href.match(/(?:gameId|event)[=/](\d{6,})/i)?.[1] ?? null;
}

function teamTokens(card: GameWrapCard): string[] {
  return `${card.headline} ${card.scoreLine ?? ""} ${card.teamName}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4);
}

export function sameGameStory(a: GameWrapCard, b: GameWrapCard): boolean {
  const idA = eventIdOf(a);
  const idB = eventIdOf(b);
  if (idA && idB && idA === idB) return true;
  if (a.scoreLine && b.scoreLine && a.scoreLine === b.scoreLine && a.leaguePath === b.leaguePath) {
    return true;
  }
  const ta = new Set(teamTokens(a));
  const tb = teamTokens(b);
  const shared = tb.filter((w) => ta.has(w));
  return shared.length >= 2 && Boolean(a.scoreLine || b.scoreLine || isGameWrapCard(a) || isGameWrapCard(b));
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

/**
 * One wrap per game. AP / ESPN recap stays; an Athletic or Post-Dispatch
 * feature on the same game hangs off it as a related item.
 */
export function attachRelatedGameCopy(cards: GameWrapCard[]): GameWrapCard[] {
  const wraps = cards.filter(isGameWrapCard);
  const rest = cards.filter((c) => !isGameWrapCard(c));
  const keptWraps: GameWrapCard[] = [];
  for (const card of wraps) {
    const idx = keptWraps.findIndex((prev) => sameGameStory(card, prev));
    if (idx < 0) {
      keptWraps.push({ ...card, related: card.related ? [...card.related] : [] });
      continue;
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
  const leftover: GameWrapCard[] = [];
  for (const card of rest) {
    const wrap = keptWraps.find((w) => sameGameStory(card, w));
    if (wrap && (isFeatureOutlet(card) || isPreviewCard(card))) {
      wrap.related = [...(wrap.related ?? []), asRelated(card)];
      continue;
    }
    leftover.push(card);
  }
  return [...keptWraps, ...leftover];
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

function isWrapLead(card: GameWrapCard): boolean {
  if (isGameWrapCard(card) || Boolean(card.scoreLine && /\d/.test(card.scoreLine))) return true;
  return isResultCopy({
    headline: card.headline,
    dek: card.dek,
    status: card.status,
    scoreLine: card.scoreLine,
    type: card.id.startsWith("news-") || card.id.startsWith("league-") ? card.status : null,
  });
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
  const freshWraps = wraps.filter((card) => !card.holdover);
  const news = pool
    .filter((card) => !isWrapLead(card))
    .sort((a, b) => (a.editorRank ?? 99) - (b.editorRank ?? 99) || String(b.when ?? "").localeCompare(String(a.when ?? "")));
  const newsLead = news.find((card) => !isInjuryNote(card));
  const editorLead = pool.find((card) => card.editorFront === 0 && !isInjuryNote(card));
  // Wraps beat editor news. A holdover wrap still leads when every final is marked holdover.
  const lead = (freshWraps[0] ?? wraps[0]) ?? editorLead ?? newsLead ?? news[0] ?? pool[0];
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
