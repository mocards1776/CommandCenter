/**
 * Thompson Times sections.
 *
 * Section A is the clubs you follow — a front, a clubs desk, then inside
 * story / club-form pages, the Day Ahead, and the RUWT watch page.
 * National News is its own section immediately after A (B when the edition
 * has a filed row). Missouri follows as C, or stays B when National is off.
 * Every sport section opens on a real section front (flag, lead wrap or
 * news of the day, score banner, secondary art, and a scores rail), then
 * wraps and news, then the reference desks — standings or the playoff
 * bracket, leaders, schedule — at the back. Followed-club stories run in
 * Section A only, and league copy reaches Section A only as an
 * editor-fronted major story (`isMajorStory`).
 */

import {
  editionNewsDay,
  favoriteDeskWeight,
  gameWrapCovers,
  holdoverCovers,
  instantDay,
  isDeskPress,
  isGameWrapStory,
  isNewsMuted,
  isResultCopy,
  splitStoryCopy,
  withinEditionHours,
  withoutEditorStamps,
} from "./newspaper.ts";
import { cleanStoryCopy, isPeripheralClubStory, killedSource } from "./newspaper-copy.ts";
import { storySource } from "./newspaper-source.ts";
import type { GameWrapCard } from "./newspaper-sports";
import {
  isSportFiller,
  orderSportRecaps,
  orderSportSectionFront,
  SPORT_NEWS_CAP,
  storyFitsSection,
} from "./newspaper-sport-desk.ts";
import { isPromoMissouriItem, type MissouriDesk, type MoItem } from "./newspaper-missouri.ts";
import type { FavoritesDayPage } from "./newspaper-day-ahead.ts";
import type { FavoritesBeezPage } from "./newspaper-beez.ts";
import { packNationalPages, type NationalDesk, type NationalStory } from "./newspaper-national.ts";

/** Front-page teaser budgets — rest jumps to a real continuation folio. */
const LEAD_TEASER = 1050;
const SECOND_TEASER = 720;
const THIRD_TEASER = 700;

const KNOWN: Record<string, { code: string; title: string; order: number }> = {
  "baseball/mlb": { code: "MLB", title: "Major League Baseball", order: 10 },
  "football/nfl": { code: "NFL", title: "National Football League", order: 20 },
  "football/college-football": { code: "CFB", title: "College Football", order: 30 },
  "hockey/nhl": { code: "NHL", title: "National Hockey League", order: 40 },
  "basketball/nba": { code: "NBA", title: "National Basketball Association", order: 45 },
  "basketball/mens-college-basketball": { code: "CBB", title: "College Basketball", order: 50 },
  "soccer/eng.1": { code: "EPL", title: "Premier League", order: 60 },
  "soccer/eng.2": { code: "EFL", title: "EFL Championship", order: 70 },
};

/** Every section prints at least this many pages. */
export const MIN_SECTION_PAGES = 5;

export type SportSectionId = {
  path: string;
  code: string;
  title: string;
  order: number;
};

export function sportSectionId(path: string): SportSectionId {
  const known = KNOWN[path];
  if (known) return { path, ...known };
  const slug = path.split("/").pop() ?? "sport";
  const letters = slug.replace(/[^a-z]/gi, "").toUpperCase().slice(0, 4) || "SP";
  const title = slug.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { path, code: letters, title, order: 200 };
}

type PageBase = {
  folio: string;
  section: string;
  sectionTitle: string;
  sectionPage: number;
  sectionCount: number;
  jumpFolio?: string;
};

export type FavoritesFrontPage = PageBase & {
  kind: "favorites-front";
  lead: GameWrapCard | null;
  second: GameWrapCard | null;
  third: GameWrapCard | null;
  briefs: GameWrapCard[];
  /** Favorite-club stories, in the order the front page runs them. */
  news: GameWrapCard[];
  /** Folio carrying the rest of each front story (real jumps only). */
  leadContinue?: string;
  secondContinue?: string;
  thirdContinue?: string;
  /** Teaser copy paired with the continuation folio (same split). */
  leadTeaser?: string;
  secondTeaser?: string;
  thirdTeaser?: string;
};

export type FavoritesClubsPage = PageBase & {
  kind: "favorites-clubs";
};

/** Deep club form pages that pad Section A to the minimum page count. */
export type FavoritesFormPage = PageBase & {
  kind: "favorites-form";
  clubs: ClubDesk[];
};

export type FavoritesInsidePage = PageBase & {
  kind: "favorites-inside";
  primary: GameWrapCard;
  secondary?: GameWrapCard;
  briefs: GameWrapCard[];
};

/** The jump page: the rest of every front-page story, the way a broadsheet runs A3. */
export type FavoritesContinuePage = PageBase & {
  kind: "favorites-continue";
  continuedFrom: string;
  /** Remaining body of each front story, in front-page order. */
  jumps: { card: GameWrapCard; rest: string }[];
};

/** The viewing guide: today's games as a Central-time timetable. Last page of Section A, every edition. */
export type FavoritesWatchPage = PageBase & {
  kind: "favorites-watch";
};

export type DeskRow = {
  rank: string;
  team: string;
  record: string;
  gb: string;
  me: boolean;
  logo?: string | null;
  teamId?: string | null;
};

export type DeskStat = { label: string; value: string; rank?: string | null; rankIn?: string | null };

export type DeskLeader = { name: string; line: string; href: string | null };

export type DeskFixture = {
  id: string;
  team: string;
  label: string;
  when: string | null;
  /** ISO start when known; used to sort Coming Up by kickoff. */
  startIso?: string | null;
  detail: string | null;
};

/** One followed club, as the sport section's agate. */
export type ClubDesk = {
  key: string;
  shortName: string;
  logo: string | null;
  /** Franchise color as `#rrggbb`, when known. */
  color?: string | null;
  leaguePath: string | null;
  record: string | null;
  standing: string | null;
  /** Playoff or wild-card odds, when the league publishes them. */
  odds?: string | null;
  division: DeskRow[];
  stats: DeskStat[];
  leaders: DeskLeader[];
  upcoming: { id: string; label: string; when: string | null; startIso?: string | null; detail: string | null }[];
};

export type SportFocus =
  | "front"
  | "news"
  | "recaps"
  | "teams"
  | "leaders"
  | "schedule"
  | "form"
  | "playoffs"
  | "players"
  | "opener";

export type SportFrontPage = PageBase & {
  kind: "sport-front";
  path: string;
  /** Which desk this page owns — each sport always prints at least five. */
  focus: SportFocus;
  /** Between seasons: no scores or form, a countdown to opening night instead. */
  offseason?: boolean;
  /** The next desk in this section, for the page's turn line. */
  turn?: { folio: string; focus: SportFocus } | null;
  /** Every desk in this section, so a page can point at the schedule without guessing folios. */
  sectionDesks?: { focus: SportFocus; folio: string }[];
  clubs: ClubDesk[];
  upcoming: DeskFixture[];
  articles: { card: GameWrapCard; folio: string }[];
};

export type SportInsidePage = PageBase & {
  kind: "sport-inside";
  path: string;
  primary: GameWrapCard;
  secondary?: GameWrapCard;
};

/** The Missouri desk: statehouse and political headlines, deduped across outlets. */
export type MissouriPage = PageBase & {
  kind: "missouri";
  items: MoItem[];
  /** Radio, podcast and video segments; the front carries them. */
  listen: MoItem[];
};

/** National News: one or two broadsheet pages, hidden when the edition has no row. */
export type NationalPage = PageBase & {
  kind: "national";
  stories: NationalStory[];
  /** Index of `stories[0]` in the filed desk, so B2 keeps thumb art. */
  startIndex: number;
  editionLabel: string;
  day: string;
};

export type EditionPage =
  | NationalPage
  | MissouriPage
  | FavoritesFrontPage
  | FavoritesClubsPage
  | FavoritesFormPage
  | FavoritesInsidePage
  | FavoritesContinuePage
  | FavoritesWatchPage
  /** Set client-side by insertDayAhead (newspaper-day-ahead.ts); buildEdition never makes one. */
  | FavoritesDayPage
  /** Set client-side by insertBeez (newspaper-beez.ts); buildEdition never makes one. */
  | FavoritesBeezPage
  | SportFrontPage
  | SportInsidePage;

export type EditionSection = {
  code: string;
  title: string;
  folio: string;
  /** Index of this section's first page in `pages`. */
  index: number;
  stories: number;
  upcoming: number;
  pages: number;
};

export type Edition = {
  pages: EditionPage[];
  sections: EditionSection[];
  /** Folio where a story's full sport-section text is set. */
  sportFolioByStory: Record<string, string>;
  /** Folio where a favorite story is teased in section A. */
  favoriteFolioByStory: Record<string, string>;
};

export function isFavoriteStory(card: GameWrapCard): boolean {
  return Boolean(card.favoriteKey || card.followed);
}

/**
 * Copy the desk will set. A line on the schedule is not an article. A final
 * needs a score. A fetched story needs a body. League wire (not a followed
 * club) still counts so sport sections can print a full news page.
 */
function isAthleticCard(card: GameWrapCard): boolean {
  if (card.caption === "The Athletic" || card.id.startsWith("athletic-")) return true;
  const href = `${card.feedUrl ?? ""} ${card.wrapHref ?? ""}`;
  return /theathletic\.com|\/athletic\/rss\//i.test(href);
}

export function isDeskStory(card: GameWrapCard): boolean {
  if (killedSource(card.wrapHref) || killedSource(card.feedUrl) || killedSource(card.gameHref)) return false;
  if (isPeripheralClubStory(card)) return false;
  if (isAthleticCard(card)) return Boolean(card.headline && card.leaguePath);
  if (card.id.startsWith("league-")) return Boolean(card.headline && card.leaguePath);
  if (isGameWrapStory(card)) {
    if (
      card.status &&
      /final|postponed/i.test(card.status) &&
      card.scoreLine &&
      /\d/.test(card.scoreLine)
    ) {
      return true;
    }
    return cleanStoryCopy(card.body).text.length >= 80;
  }
  if (!isFavoriteStory(card)) return false;
  if (card.id.startsWith("news-")) return Boolean(card.headline);
  if (cleanStoryCopy(card.body).text.length >= 80) return true;
  if (
    card.status &&
    /final|postponed/i.test(card.status) &&
    card.scoreLine &&
    /\d/.test(card.scoreLine)
  ) {
    return true;
  }
  return false;
}

/** Enough body to set as an article rather than a brief. */
export const STORY_COPY_MIN = 400;

export function hasStoryCopy(card: GameWrapCard): boolean {
  return cleanStoryCopy(card.body).text.length >= STORY_COPY_MIN;
}

export function isRecapStory(card: GameWrapCard): boolean {
  return isResultCopy({
    headline: card.headline,
    dek: card.dek,
    status: card.status,
    scoreLine: card.scoreLine,
    type: card.id.startsWith("news-") || card.id.startsWith("league-") ? card.status : null,
  });
}

/** A look-ahead at a game not yet played (wire previews, "X host Y to open the season"). */
export function isPreviewStory(card: GameWrapCard): boolean {
  if (card.status && /\b(scheduled|pre-?game|preview)\b/i.test(card.status)) return true;
  if (card.wrapHref && /\/preview\b/i.test(card.wrapHref)) return true;
  const body = card.body ?? "";
  if (/\bBOTTOM LINE:|\bLINE:\s|Data Skrive/.test(body)) return true;
  const head = `${card.headline} ${card.dek ?? ""}`;
  return /\b(hosts?|visits?|face|take on|meet)\b.*\bto (start|open|begin|kick off)\b/i.test(head)
    || /\b(preview|what to watch|how to watch|keys to the game|prediction)\b/i.test(card.headline);
}

/** Last night's result outranks a feature; home clubs outrank the rest. */
export function storyRank(card: GameWrapCard, edition: string): number {
  const day = card.when ? instantDay(card.when) : null;
  let score = 0;
  if (isPreviewStory(card)) score -= 150;
  if (day === editionNewsDay(edition) && card.status && /final/i.test(card.status)) score += 100;
  if (card.postseason) score += 40;
  if (card.id.startsWith("news-")) score += 25;
  if (card.id.startsWith("league-")) score += 10;
  if (isAthleticCard(card)) score += 12;
  if (isRecapStory(card)) score += 20;
  if (cleanStoryCopy(card.body).text.length >= 400) score += 15;
  // ESPN lists the piece it is pushing first. There is no pageview count.
  if (typeof card.listRank === "number") score += Math.max(0, 16 - Math.min(16, card.listRank));
  // Cardinals / Blues / Mizzou lead Section A; Lions, Chiefs, soccer follow.
  if (card.favoriteKey) score += favoriteDeskWeight(card.favoriteKey);
  return score;
}

/**
 * A game's own copy: the wire final, the recap, the club wrap. Every game gets
 * one from the rule desk, so these never spend the AI editor's news budget.
 */
export function isGameWrap(card: GameWrapCard): boolean {
  return isGameWrapStory(card);
}

/** Carried unread game copy. It may run inside; it is not last night and must not open A1. */
export function isHoldoverGame(card: GameWrapCard): boolean {
  return Boolean(card.holdover && isGameWrap(card));
}

function ruleOrder(cards: GameWrapCard[], edition: string): GameWrapCard[] {
  return [...cards].sort((a, b) => {
    const byRank = storyRank(b, edition) - storyRank(a, edition);
    if (byRank) return byRank;
    const byList = (a.listRank ?? 99) - (b.listRank ?? 99);
    if (byList) return byList;
    return String(b.when ?? "").localeCompare(String(a.when ?? ""));
  });
}

/**
 * The rule desk's order, with the news the editor ranked reshuffled into the
 * same slots. Game wraps keep the places the rule desk gave them.
 */
function rankStories(cards: GameWrapCard[], edition: string): GameWrapCard[] {
  const ruled = ruleOrder(cards, edition);
  const slots = ruled.flatMap((card, i) => (card.editorRank != null ? [i] : []));
  if (!slots.length) return ruled;
  const edited = slots.map((i) => ruled[i]!).sort((a, b) => a.editorRank! - b.editorRank!);
  slots.forEach((slot, k) => {
    ruled[slot] = edited[k]!;
  });
  return ruled;
}

function stampCounts<T extends PageBase>(pages: T[]): T[] {
  const count = pages.length;
  // Preserve author-set jumps (story continuations). Never invent a "next page"
  // jump — that is what made "turn to A4" land on the wrong copy.
  return pages.map((page) => ({
    ...page,
    sectionCount: count,
  }));
}

/** Plain story body used for front tease / continuation (no agate notes). */
export function storyBodyForJump(card: GameWrapCard): string {
  const body = cleanStoryCopy(card.body).text;
  if (body.length >= 40) return body;
  const dek = cleanStoryCopy(card.dek).text;
  if (dek) return dek;
  return [card.scoreLine, card.headline].filter(Boolean).join(" ").trim();
}

function frontSplit(
  card: GameWrapCard | null | undefined,
  budget: number,
): { teaser: string; rest: string } {
  if (!card) return { teaser: "", rest: "" };
  const full = storyBodyForJump(card);
  if (!full) return { teaser: "", rest: "" };
  return splitStoryCopy(full, budget);
}

function uniqueCodes(ids: SportSectionId[]): SportSectionId[] {
  const used = new Set<string>(["A", "B", "C"]);
  return ids.map((id) => {
    let code = id.code;
    if (used.has(code)) {
      let n = 2;
      while (used.has(`${id.code}${n}`)) n += 1;
      code = `${id.code}${n}`;
    }
    used.add(code);
    return { ...id, code };
  });
}

const FRONT_STORIES = 3;
const FRONT_BRIEFS = 4;
const FORM_CLUBS_PER_PAGE = 3;

function upcomingFor(clubs: ClubDesk[]): DeskFixture[] {
  return clubs.flatMap((club) =>
    club.upcoming.map((game) => ({
      id: game.id,
      team: club.shortName,
      label: game.label,
      when: game.when,
      startIso: game.startIso ?? null,
      detail: game.detail,
    })),
  );
}

const COMING_UP_CLOCK = /\d{1,2}:\d{2}|\d{1,2}\s*[ap](?:\.?m\.?)/i;
const CHICAGO = "America/Chicago";

function chicagoYmd(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CHICAGO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

function endOfChicagoDay(ms: number): number {
  const ymd = chicagoYmd(ms);
  for (const offset of ["-05:00", "-06:00"]) {
    const t = Date.parse(`${ymd}T23:59:59.999${offset}`);
    if (!Number.isNaN(t) && chicagoYmd(t) === ymd) return t;
  }
  return Date.parse(`${ymd}T23:59:59.999-05:00`);
}

export function comingUpHasClock(when: string | null | undefined): boolean {
  return Boolean(when && COMING_UP_CLOCK.test(when));
}

function parseComingUpWhen(when: string, now: number): number | null {
  const cleaned = when.replace(/,/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  const year = new Date(now).getFullYear();
  const attempts = [cleaned, `${cleaned} ${year}`, `${cleaned}, ${year}`];
  for (const text of attempts) {
    const t = Date.parse(text);
    if (Number.isNaN(t)) continue;
    if (t < now - 150 * 86_400_000) {
      const next = Date.parse(text.replace(String(year), String(year + 1)));
      if (!Number.isNaN(next)) return next;
    }
    return t;
  }
  return null;
}

/** Sort key: kickoff ms, or the end of that Chicago day when the listing has a date but no clock. */
export function comingUpSortMs(
  game: { when: string | null; startIso?: string | null },
  now = Date.now(),
): number {
  const when = game.when?.trim() || "";
  const timed = comingUpHasClock(when);
  if (game.startIso) {
    const t = Date.parse(game.startIso);
    if (!Number.isNaN(t)) return timed || !when ? t : endOfChicagoDay(t);
  }
  if (!when) return Number.POSITIVE_INFINITY;
  const parsed = parseComingUpWhen(when, now);
  if (parsed == null) return Number.POSITIVE_INFINITY;
  return timed ? parsed : endOfChicagoDay(parsed);
}

/** Favorite-team next games, soonest first. Date-only listings close their day. */
export function sortComingUp<T extends { when: string | null; startIso?: string | null }>(games: T[]): T[] {
  return [...games].sort((a, b) => {
    const d = comingUpSortMs(a) - comingUpSortMs(b);
    if (d !== 0) return d;
    return (a.when ?? "").localeCompare(b.when ?? "");
  });
}

function chunkClubs(clubs: ClubDesk[], size: number): ClubDesk[][] {
  if (!clubs.length) return [];
  const out: ClubDesk[][] = [];
  for (let i = 0; i < clubs.length; i += size) out.push(clubs.slice(i, i + size));
  return out;
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function weekdayName(day: string): string {
  const d = new Date(`${day.slice(0, 10)}T12:00:00Z`);
  return d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }).toLowerCase();
}

/**
 * A "Day 2 takeaways / relive Wednesday" package whose named day is neither
 * the news day nor the edition day. ESPN refreshes these, so the timestamp
 * alone lets a two-day-old wild-card package back into the morning paper.
 */
export function staleNamedPackage(card: GameWrapCard, edition: string): boolean {
  const text = `${card.headline} ${card.dek ?? ""}`.toLowerCase();
  if (!/\b(takeaways|relive|wild-?card series|day \d+)\b/.test(text)) return false;
  const named = WEEKDAYS.filter((day) => new RegExp(`\\b${day}\\b`).test(text));
  if (!named.length) return false;
  const editionDay = edition.slice(0, 10);
  const allowed = new Set([weekdayName(editionDay), weekdayName(editionNewsDay(edition))]);
  return named.some((day) => !allowed.has(day));
}

/** News stays on the 18-hour clock. Game wraps key off the news-day window. */
function inEditionWindow(card: GameWrapCard, edition: string): boolean {
  if (isGameWrap(card)) return gameWrapCovers(card.when, edition, card.leaguePath);
  if (card.holdover) return holdoverCovers(card.when, edition);
  return withinEditionHours(card.when, edition);
}

const HEAD_STOP = new Set([
  "the", "and", "for", "with", "from", "that", "this", "have", "has", "was", "were",
  "are", "but", "his", "her", "their", "its", "into", "over", "after", "before",
  "about", "will", "they", "them", "been", "than", "then", "when", "what", "your",
  "our", "who", "how", "not", "you", "all", "can", "just", "out", "new", "says", "said",
  "louis", "saint",
]);

function significantWords(headline: string): string[] {
  return headline
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !HEAD_STOP.has(word));
}

function sameStory(a: string[], b: string[]): boolean {
  if (!a.length || !b.length) return false;
  const other = new Set(b);
  const shared = a.filter((word) => other.has(word));
  const shorter = Math.min(a.length, b.length);
  return shared.length >= 3 && shared.length / shorter >= 0.5;
}

/** Post-Dispatch, then The Athletic, then the wires. A paper does not run four versions. */
function sourceRank(card: GameWrapCard): number {
  const source = (storySource(card) ?? "").toLowerCase();
  if (source.includes("post-dispatch")) return 0;
  if (source.includes("athletic")) return 1;
  if (source.includes("associated press")) return 2;
  if (source === "espn") return 3;
  return 4;
}

/**
 * Same-game recaps: the ESPN/wire wrap wins, even when an RSS recap also
 * carries a `wrap-` id (Post-Dispatch AP). Source rank still decides news.
 */
function gameWrapRank(card: GameWrapCard): number {
  if (card.wrapKind === "espn" || card.id.startsWith("wire-")) return 0;
  if (card.wrapKind === "box") return 2;
  if (isGameWrap(card)) return 3;
  if (isRecapStory(card)) return 4;
  return 5;
}

/** ESPN article id shared by `news-123` and `league-123`, or a /id/ link. */
export function sourceStoryId(card: Pick<GameWrapCard, "id" | "wrapHref" | "gameHref">): string | null {
  const prefixed = /^(?:news|league|espn)-(\d+)$/.exec(card.id);
  if (prefixed) return prefixed[1];
  const href = `${card.wrapHref ?? ""} ${card.gameHref ?? ""}`;
  return href.match(/\/(?:id|story)\/(\d{5,})/i)?.[1] ?? null;
}

const PATH_HINTS: [string, RegExp][] = [
  ["football/college-football", /\b(football|cfb|fbs|quarterback|touchdown|sec football|college football)\b/i],
  ["basketball/mens-college-basketball", /\b(basketball|hoops|cbb|ncaa tournament|march madness|tip-?off)\b/i],
  ["football/nfl", /\b(nfl|super bowl|draft)\b/i],
  ["baseball/mlb", /\b(mlb|world series|pitcher|home run)\b/i],
  ["hockey/nhl", /\b(nhl|hockey|stanley cup)\b/i],
  ["basketball/nba", /\b(nba|lakers|celtics)\b/i],
];

export function sectionFitScore(card: GameWrapCard, path: string): number {
  const hay = `${card.headline} ${card.dek ?? ""} ${card.body ?? ""}`;
  const hint = PATH_HINTS.find(([p]) => p === path)?.[1];
  let score = 0;
  if (card.leaguePath === path) score += 2;
  if (hint?.test(hay)) score += 4;
  if (card.followed || card.favoriteKey) score += 3;
  return score;
}

function preferStory(next: GameWrapCard, prev: GameWrapCard): boolean {
  const nextId = sourceStoryId(next);
  const prevId = sourceStoryId(prev);
  if (nextId && nextId === prevId && next.leaguePath !== prev.leaguePath) {
    const nextFit = sectionFitScore(next, next.leaguePath ?? "");
    const prevFit = sectionFitScore(prev, prev.leaguePath ?? "");
    if (nextFit !== prevFit) return nextFit > prevFit;
  }
  const nextWrap = gameWrapRank(next);
  const prevWrap = gameWrapRank(prev);
  // A wire/ESPN wrap beats an RSS recap of the same game, even when the
  // RSS card is not classified as a recap (and even when its host is the
  // Post-Dispatch). Source rank still decides two news items.
  if (nextWrap !== prevWrap && Math.min(nextWrap, prevWrap) <= 2) {
    return nextWrap < prevWrap;
  }
  if (isMainGameStory(next) && isMainGameStory(prev) && nextWrap !== prevWrap) {
    return nextWrap < prevWrap;
  }
  const rank = sourceRank(next) - sourceRank(prev);
  if (rank) return rank < 0;
  if ((next.followed || next.favoriteKey) !== (prev.followed || prev.favoriteKey)) {
    return Boolean(next.followed || next.favoriteKey);
  }
  return cleanStoryCopy(next.body).text.length > cleanStoryCopy(prev.body).text.length;
}

function storyUrlKey(card: GameWrapCard): string | null {
  const raw = card.wrapHref || card.gameHref;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    u.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid"].forEach((k) =>
      u.searchParams.delete(k),
    );
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}${u.search}`.toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

function storyGameId(card: GameWrapCard): string | null {
  const raw = card.gameId ?? "";
  const fromId = raw.match(/(\d{6,})/)?.[1] ?? (raw.length >= 4 ? raw : null);
  if (fromId) return fromId;
  const href = `${card.wrapHref ?? ""} ${card.gameHref ?? ""}`;
  return href.match(/(?:gameId|event)[=/](\d{6,})/i)?.[1] ?? null;
}

/** Signed columns and opinion stay even when they cover the same game. */
export function isColumnStory(card: GameWrapCard): boolean {
  const href = `${card.wrapHref ?? ""} ${card.feedUrl ?? ""}`;
  if (/\/(column|columns|opinion|commentary|editors-view)\b/i.test(href)) return true;
  if (/^(hochman|bernhard|goold|hummel|strauss|dunkley|caesar)\s*:/i.test(card.headline)) return true;
  return /\b(column|op-?ed|commentary)\b/i.test(card.headline);
}

function isMainGameStory(card: GameWrapCard): boolean {
  if (isColumnStory(card)) return false;
  return isGameWrap(card) || isRecapStory(card);
}

function headlineTokens(card: GameWrapCard): string[] {
  const aliases: Record<string, string> = {};
  if (card.favoriteKey === "cfb-mizzou") {
    aliases.mizzou = "missouri";
    aliases.tigers = "missouri";
    aliases.gators = "florida";
  }
  return significantWords(card.headline).map((word) => aliases[word] ?? word);
}

function sameSectionAStory(a: GameWrapCard, b: GameWrapCard): boolean {
  if (a.id && a.id === b.id) return true;
  const urlA = storyUrlKey(a);
  const urlB = storyUrlKey(b);
  if (urlA && urlB && urlA === urlB) return true;
  const srcA = sourceStoryId(a);
  const srcB = sourceStoryId(b);
  if (srcA && srcB && srcA === srcB) return true;
  if (isColumnStory(a) || isColumnStory(b)) {
    return sameStory(headlineTokens(a), headlineTokens(b));
  }
  const gameA = storyGameId(a);
  const gameB = storyGameId(b);
  if (gameA && gameB && gameA === gameB && isMainGameStory(a) && isMainGameStory(b)) return true;
  if (isMainGameStory(a) && isMainGameStory(b) && sameStory(headlineTokens(a), headlineTokens(b))) {
    return true;
  }
  return sameStory(headlineTokens(a), headlineTokens(b));
}

/** One story per event. The better source stays; columns like Hochman stay separate. */
export function dedupeStories(stories: GameWrapCard[]): GameWrapCard[] {
  const kept: GameWrapCard[] = [];
  for (const card of stories) {
    const idx = kept.findIndex((prev) => sameSectionAStory(card, prev));
    if (idx < 0) {
      kept.push(card);
      continue;
    }
    if (preferStory(card, kept[idx]!)) kept[idx] = card;
  }
  return kept;
}

function isStalePreview(card: GameWrapCard, edition: string): boolean {
  if (isRecapStory(card)) return false;
  const hay = `${card.headline} ${card.status ?? ""} ${card.dek ?? ""}`;
  if (!/\bpreview\b|\bbreak skid\b|\blook to\b|\binto game\b|\bprobable\b/i.test(hay)) {
    return false;
  }
  return !withinEditionHours(card.when, edition);
}

const MAJOR_NEWS = new RegExp(
  [
    String.raw`no-?hitter`,
    String.raw`perfect game`,
    String.raw`clinch(?:es|ed|ing)?`,
    String.raw`eliminat(?:es|ed|ion)`,
    String.raw`(?:wins?|won|capture[sd]?|claims?) (?:the |a |its |their )?(?:world series|stanley cup|super bowl|pennant|national (?:championship|title)|(?:\w+ )?title)`,
    String.raw`champions?hip (?:game|series)? ?(?:win|victory)`,
    String.raw`(?:fire[sd]?|dismiss(?:es|ed)?|part(?:s|ed)? ways with|hire[sd]?|names?|named) (?:\S+ ){0,4}(?:manager|head coach|coach|general manager|gm|president|skipper)`,
    String.raw`steps? down`,
    String.raw`resign(?:s|ed)`,
    String.raw`traded`,
    String.raw`acquire[sd]`,
    String.raw`blockbuster`,
    String.raw`record (?:deal|contract)`,
    String.raw`season-ending`,
    String.raw`out for the season`,
    String.raw`torn (?:acl|achilles)`,
    String.raw`tommy john`,
    String.raw`suspend(?:s|ed)`,
    String.raw`banned`,
    String.raw`dies`,
    String.raw`died`,
    String.raw`death of`,
    String.raw`retires`,
    String.raw`announces? (?:his |her )?retirement`,
  ]
    .map((pattern) => String.raw`\b${pattern}\b`)
    .join("|"),
  "i",
);

/**
 * League copy big enough to run in Section A: a title or clincher, a no-hitter,
 * a firing or hiring, a major trade, a star lost for the season, a death.
 * Section A is the favorite-teams desk; routine league wire never runs there.
 */
export function isMajorStory(card: GameWrapCard): boolean {
  if (isPreviewStory(card)) return false;
  const text = `${card.headline} ${card.dek ?? ""}`.replace(/\s+/g, " ");
  if (MAJOR_NEWS.test(text)) return true;
  // A decisive postseason result, not just any October game.
  return Boolean(
    card.postseason &&
      isRecapStory(card) &&
      /\b(?:advance[sd]?|sweep(?:s|ed)?|game (?:5|7)|series win|win (?:the )?series)\b/i.test(text),
  );
}

/** League stories the editor may front in Section A in one edition. */
const LEAGUE_FRONT_MAX = 1;

/**
 * Stories the editor put on A1, in its order, held to the desk's beat: a
 * favorite-club story always may; league copy only when it is major news, and
 * never more than one. A front story still needs copy.
 */
export function editorFront(fresh: GameWrapCard[]): GameWrapCard[] {
  let league = 0;
  return fresh
    .filter((card) => card.editorFront != null && card.editorFront < FRONT_STORIES && hasStoryCopy(card))
    .filter((card) => !isHoldoverGame(card))
    .sort((a, b) => a.editorFront! - b.editorFront!)
    .filter((card) => {
      if (isFavoriteStory(card)) return true;
      if (league >= LEAGUE_FRONT_MAX || !isMajorStory(card)) return false;
      league += 1;
      return true;
    });
}

function favoritePages(
  freshStories: GameWrapCard[],
  sectionStories: GameWrapCard[],
  clubs: ClubDesk[],
  frontPicks: GameWrapCard[] = [],
): {
  pages: (
    | FavoritesFrontPage
    | FavoritesClubsPage
    | FavoritesFormPage
    | FavoritesInsidePage
    | FavoritesContinuePage
    | FavoritesWatchPage
  )[];
  favoriteFolioByStory: Record<string, string>;
} {
  const favoriteFolioByStory: Record<string, string> = {};
  const freshIds = new Set(freshStories.map((c) => c.id));
  const frontPool = [...freshStories, ...sectionStories.filter((c) => !freshIds.has(c.id))];
  const picks: GameWrapCard[] = frontPicks.filter((card) => !isHoldoverGame(card)).slice(0, FRONT_STORIES);
  const clubOf = (c: GameWrapCard) => c.favoriteKey ?? c.teamName ?? c.id;
  // A video stub or one-line note leaves a column of bare photo on the front.
  const written = frontPool.filter((c) => hasStoryCopy(c) && !isPreviewStory(c) && !isHoldoverGame(c));
  for (const card of written) {
    if (picks.length >= 3) break;
    if (!picks.some((f) => clubOf(f) === clubOf(card))) picks.push(card);
  }
  for (const card of [...written, ...frontPool]) {
    if (picks.length >= 3) break;
    if (isHoldoverGame(card)) continue;
    if (!picks.includes(card)) picks.push(card);
  }
  const [lead = null, second = null, third = null] = picks;
  for (const card of [lead, second, third]) {
    if (card) favoriteFolioByStory[card.id] = "A1";
  }

  // Every front jump lands on one page right after the clubs desk.
  const jumps: { card: GameWrapCard; rest: string }[] = [];
  const jumpFolio = "A3";
  const maybeContinue = (
    card: GameWrapCard | null,
    budget: number,
  ): { folio?: string; teaser?: string } => {
    const { teaser, rest } = frontSplit(card, budget);
    if (!card || !rest) return { teaser: teaser || undefined };
    jumps.push({ card, rest });
    favoriteFolioByStory[`${card.id}::cont`] = jumpFolio;
    return { folio: jumpFolio, teaser };
  };

  const leadJump = maybeContinue(lead, LEAD_TEASER);
  const secondJump = maybeContinue(second, SECOND_TEASER);
  const thirdJump = maybeContinue(third, THIRD_TEASER);
  const continues: FavoritesContinuePage[] = jumps.length
    ? [
        {
          kind: "favorites-continue",
          folio: jumpFolio,
          section: "A",
          sectionTitle: "Favorite Teams",
          sectionPage: 3,
          sectionCount: 0,
          continuedFrom: "A1",
          jumps,
          jumpFolio: undefined,
        },
      ]
    : [];
  let n = 3 + continues.length;

  const inside: FavoritesInsidePage[] = [];
  const frontIds = new Set(
    [lead, second, third].filter(Boolean).map((c) => c!.id),
  );
  const restPool = [
    ...freshStories.filter((c) => !frontIds.has(c.id)),
    ...sectionStories.filter(
      (c) => !frontIds.has(c.id) && !freshStories.some((f) => f.id === c.id),
    ),
  ];
  // A story page needs a story. Thin items ride along as briefs.
  const full = restPool.filter(hasStoryCopy);
  const thin = restPool.filter((c) => !hasStoryCopy(c));
  let cursor = 0;
  let thinCursor = 0;
  while (cursor < full.length) {
    const primary = full[cursor]!;
    const secondary = full[cursor + 1];
    const last = cursor + 2 >= full.length;
    const take = last ? thin.length - thinCursor : FRONT_BRIEFS;
    const briefs = thin.slice(thinCursor, thinCursor + take);
    thinCursor += briefs.length;
    const folio = `A${n}`;
    favoriteFolioByStory[primary.id] = folio;
    if (secondary) favoriteFolioByStory[secondary.id] = folio;
    for (const brief of briefs) favoriteFolioByStory[brief.id] = folio;
    inside.push({
      kind: "favorites-inside",
      folio,
      section: "A",
      sectionTitle: "Favorite Teams",
      sectionPage: n,
      sectionCount: 0,
      primary,
      secondary,
      briefs,
    });
    cursor += 2;
    n += 1;
  }

  const front: FavoritesFrontPage = {
    kind: "favorites-front",
    folio: "A1",
    section: "A",
    sectionTitle: "Favorite Teams",
    sectionPage: 1,
    sectionCount: 0,
    lead,
    second,
    third,
    briefs: (freshStories.length ? freshStories : sectionStories)
      .filter((c) => !frontIds.has(c.id))
      .slice(0, 6),
    news: freshStories.length ? freshStories : sectionStories,
    leadContinue: leadJump.folio,
    secondContinue: secondJump.folio,
    thirdContinue: thirdJump.folio,
    leadTeaser: leadJump.teaser,
    secondTeaser: secondJump.teaser,
    thirdTeaser: thirdJump.teaser,
  };

  const clubsPage: FavoritesClubsPage = {
    kind: "favorites-clubs",
    folio: "A2",
    section: "A",
    sectionTitle: "Favorite Teams",
    sectionPage: 2,
    sectionCount: 0,
  };

  const pages: (
    | FavoritesFrontPage
    | FavoritesClubsPage
    | FavoritesFormPage
    | FavoritesInsidePage
    | FavoritesContinuePage
    | FavoritesWatchPage
  )[] = [front, clubsPage, ...continues, ...inside];

  // Pad to the minimum with deep club-form pages (standings + slate).
  const orderedClubs = [...clubs].sort(
    (a, b) => favoriteDeskWeight(b.key) - favoriteDeskWeight(a.key),
  );
  const formChunks = chunkClubs(orderedClubs, FORM_CLUBS_PER_PAGE);
  let formIdx = 0;
  while (pages.length < MIN_SECTION_PAGES) {
    const chunk =
      formChunks[formIdx % Math.max(1, formChunks.length)] ??
      orderedClubs.slice(0, FORM_CLUBS_PER_PAGE);
    const pageN = pages.length + 1;
    pages.push({
      kind: "favorites-form",
      folio: `A${pageN}`,
      section: "A",
      sectionTitle: "Favorite Teams",
      sectionPage: pageN,
      sectionCount: 0,
      clubs: chunk.length ? chunk : orderedClubs,
    });
    formIdx += 1;
    if (!orderedClubs.length && formIdx > MIN_SECTION_PAGES) break;
  }

  // The viewing guide closes Section A, after the club pages and before Missouri.
  const watchN = pages.length + 1;
  pages.push({
    kind: "favorites-watch",
    folio: `A${watchN}`,
    section: "A",
    sectionTitle: "Favorite Teams",
    sectionPage: watchN,
    sectionCount: 0,
  });

  return {
    pages: stampCounts(pages),
    favoriteFolioByStory,
  };
}

/**
 * Desk order for one sport section. Story pages (front, wraps, news) first;
 * standings / bracket / leaders / schedule at the back. Postseason drops
 * regular-season standings — MLB's bracket replaces that page.
 */
export function sportSectionFocuses(opts: {
  path: string;
  offseason?: boolean;
  withLeaders?: boolean;
  withPlayers?: boolean;
  postseason?: boolean;
}): SportFocus[] {
  const leaders = opts.withLeaders ? (["leaders"] as const) : [];
  const players = opts.withPlayers ? (["players"] as const) : [];
  const isMlb = opts.path === "baseball/mlb";
  if (opts.offseason) return ["front", "opener", "news", "teams", ...leaders, ...players];
  const reference: SportFocus[] = [];
  if (!opts.postseason) reference.push("teams");
  reference.push(isMlb ? "playoffs" : "form", ...leaders, "schedule", ...players);
  return ["front", "recaps", "news", ...reference];
}

function sportPages(
  id: SportSectionId,
  clubs: ClubDesk[],
  stories: GameWrapCard[],
  edition: string,
  withPlayers = false,
  offseason = false,
  withLeaders = false,
  postseason = false,
): {
  pages: (SportFrontPage | SportInsidePage)[];
  sportFolioByStory: Record<string, string>;
} {
  const upcoming = upcomingFor(clubs);
  const unique = dedupeStories(
    stories.filter(
      (card) =>
        !isStalePreview(card, edition) &&
        storyFitsSection(card, id.path) &&
        (isGameWrap(card) || !isSportFiller(card)),
    ),
  );
  const desk = isDeskPress(edition);
  const NEWS_INSIDE_CAP = 6;
  const focuses = sportSectionFocuses({
    path: id.path,
    offseason,
    withLeaders,
    withPlayers,
    postseason,
  });
  const isStoryFocus = (f: SportFocus): boolean => f === "front" || f === "recaps" || f === "news" || f === "opener";
  const storyFocuses = focuses.filter(isStoryFocus);
  const refFocuses = focuses.filter((f) => !isStoryFocus(f));
  const recapPool = orderSportRecaps(
    unique.filter((card) => isGameWrap(card) || isRecapStory(card)),
    id.path,
  );
  const newsPool = unique
    .filter((card) => !isGameWrap(card) && !isSportFiller(card, recapPool))
    .slice(0, SPORT_NEWS_CAP);
  const frontPool = orderSportSectionFront([...recapPool, ...newsPool], id.path, edition);
  const inside: SportInsidePage[] = [];
  const full = desk
    ? []
    : [
        ...recapPool.filter(hasStoryCopy),
        ...newsPool.filter(hasStoryCopy).slice(0, NEWS_INSIDE_CAP),
      ];
  for (let i = 0; i < full.length; i += 2) {
    const primary = full[i]!;
    const secondary = full[i + 1];
    inside.push({
      kind: "sport-inside",
      folio: "",
      section: id.code,
      sectionTitle: id.title,
      sectionPage: 0,
      sectionCount: 0,
      path: id.path,
      primary,
      secondary,
    });
  }

  const raw: (SportFrontPage | SportInsidePage)[] = [
    ...storyFocuses.map((focus) => ({
      section: id.code,
      sectionTitle: id.title,
      sectionCount: 0,
      path: id.path,
      clubs,
      upcoming,
      kind: "sport-front" as const,
      folio: "",
      sectionPage: 0,
      focus,
      offseason,
      turn: null,
      articles: [] as { card: GameWrapCard; folio: string }[],
    })),
    ...inside,
    ...refFocuses.map((focus) => ({
      section: id.code,
      sectionTitle: id.title,
      sectionCount: 0,
      path: id.path,
      clubs,
      upcoming,
      kind: "sport-front" as const,
      folio: "",
      sectionPage: 0,
      focus,
      offseason,
      turn: null,
      articles: [] as { card: GameWrapCard; folio: string }[],
    })),
  ];

  const numbered = raw.map((page, i) => ({
    ...page,
    folio: `${id.code}${i + 1}`,
    sectionPage: i + 1,
  }));
  const sportFolioByStory: Record<string, string> = {};
  for (const page of numbered) {
    if (page.kind !== "sport-inside") continue;
    sportFolioByStory[page.primary.id] = page.folio;
    if (page.secondary) sportFolioByStory[page.secondary.id] = page.folio;
  }
  const sectionDesks = numbered.flatMap((page) =>
    page.kind === "sport-front" ? [{ focus: page.focus, folio: page.folio }] : [],
  );
  const fallbackDesk = (focus: SportFocus) =>
    sectionDesks.find((d) => d.focus === focus)?.folio ?? `${id.code}1`;
  const articlesFor = (focus: SportFocus, cards: GameWrapCard[]) =>
    cards.map((card) => ({
      card,
      folio: sportFolioByStory[card.id] ?? fallbackDesk(focus),
    }));

  const pages = numbered.map((page, i) => {
    if (page.kind !== "sport-front") return page;
    const nextFront = numbered.slice(i + 1).find((p) => p.kind === "sport-front");
    const pool =
      page.focus === "front"
        ? frontPool
        : page.focus === "news"
          ? newsPool
          : page.focus === "recaps"
            ? recapPool
            : unique;
    return {
      ...page,
      sectionDesks,
      turn: nextFront && nextFront.kind === "sport-front" ? { folio: nextFront.folio, focus: nextFront.focus } : null,
      articles: articlesFor(page.focus, pool),
    };
  });

  return {
    pages: stampCounts(pages),
    sportFolioByStory,
  };
}

const MO_FRONT = 11;
const MO_PAGE = 16;

function missouriPages(desk: MissouriDesk | null, code = "B"): MissouriPage[] {
  if (!desk?.items.length) return [];
  const clean = desk.items.filter((item) => !isPromoMissouriItem(item));
  if (!clean.length) return [];
  const chunks: MoItem[][] = [clean.slice(0, MO_FRONT)];
  for (let i = MO_FRONT; i < clean.length && chunks.length < 3; i += MO_PAGE) {
    chunks.push(clean.slice(i, i + MO_PAGE));
  }
  return stampCounts(
    chunks.map((items, i) => ({
      kind: "missouri" as const,
      folio: `${code}${i + 1}`,
      section: code,
      sectionTitle: "Missouri",
      sectionPage: i + 1,
      sectionCount: 0,
      items,
      listen: i === 0 ? desk.listen : [],
    })),
  );
}

function nationalPages(desk: NationalDesk | null): NationalPage[] {
  if (!desk?.stories.length) return [];
  const packed = packNationalPages(desk.stories);
  return stampCounts(
    packed.map((page, i) => ({
      kind: "national" as const,
      folio: `B${i + 1}`,
      section: "B",
      sectionTitle: "National News",
      sectionPage: i + 1,
      sectionCount: 0,
      stories: page.stories,
      startIndex: 0,
      editionLabel: desk.label,
      day: desk.day,
      jumpFolio: packed[i + 1] ? `B${i + 2}` : undefined,
    })),
  );
}

/** Copy that can run in this edition: filed, deduped, inside the press window. */
export function deskCopy(stories: GameWrapCard[], edition: string): GameWrapCard[] {
  return dedupeStories(
    stories.filter((card) => isDeskStory(card) && !isNewsMuted(card) && !staleNamedPackage(card, edition)),
  ).filter((card) => inEditionWindow(card, edition));
}

/**
 * What the AI editor reads, in the rule desk's order: `news` is the budget it
 * ranks and may spike (team news, league news, The Athletic), capped at
 * `limit`; `games` is the night's wraps, shown only so it can weigh news
 * against results. Wraps never count against the cap.
 */
export function editorCandidates(
  stories: GameWrapCard[],
  edition: string,
  limit = 24,
  gameLimit = 16,
): { news: GameWrapCard[]; games: GameWrapCard[] } {
  const ranked = ruleOrder(deskCopy(stories, edition).map(withoutEditorStamps), edition);
  return {
    news: ranked.filter((card) => !isGameWrap(card)).slice(0, limit),
    games: ranked.filter(isGameWrap),
  };
}

export function buildEdition(opts: {
  stories: GameWrapCard[];
  clubs: ClubDesk[];
  edition: string;
  /** League paths with followed or tagged players — each gets a "Your players" desk. */
  playerPaths?: string[];
  missouri?: MissouriDesk | null;
  /** Filed national-news row for this edition. No row, no section. */
  national?: NationalDesk | null;
  /** League paths between seasons. */
  offseason?: string[];
  /** League paths with a league-leaders list on file — each gets a leaders desk. */
  leaderPaths?: string[];
  /** Leagues in their postseason — regular-season standings drop; MLB's bracket stays. */
  postseasonPaths?: string[];
}): Edition {
  const fresh = rankStories(
    deskCopy(opts.stories, opts.edition).filter((card) => !card.editorSpiked),
    opts.edition,
  );
  const sectionCopy = fresh;

  const paths = new Set<string>();
  for (const club of opts.clubs) if (club.leaguePath) paths.add(club.leaguePath);
  for (const story of sectionCopy) if (story.leaguePath) paths.add(story.leaguePath);

  const ids = uniqueCodes(
    [...paths].map(sportSectionId).sort((a, b) => a.order - b.order || a.code.localeCompare(b.code)),
  );

  const clubsBy = new Map<string, ClubDesk[]>();
  for (const club of opts.clubs) {
    if (!club.leaguePath) continue;
    const list = clubsBy.get(club.leaguePath) ?? [];
    list.push(club);
    clubsBy.set(club.leaguePath, list);
  }
  // Favorite-club news stays on Section A. Game wraps also run in the sport
  // section, favorite-team first, so a Sunday Chiefs final leads the NFL recaps.
  const storiesBy = new Map<string, GameWrapCard[]>();
  for (const story of sectionCopy) {
    if (!story.leaguePath) continue;
    if (isFavoriteStory(story) && !isGameWrap(story)) continue;
    const list = storiesBy.get(story.leaguePath) ?? [];
    list.push(story);
    storiesBy.set(story.leaguePath, list);
  }

  const sportPagesBuilt = ids.map((id) => ({
    id,
    built: sportPages(
      id,
      clubsBy.get(id.path) ?? [],
      storiesBy.get(id.path) ?? [],
      opts.edition,
      opts.playerPaths?.includes(id.path) ?? false,
      opts.offseason?.includes(id.path) ?? false,
      opts.leaderPaths?.includes(id.path) ?? false,
      opts.postseasonPaths?.includes(id.path) ?? false,
    ),
  }));
  const sportFolioByStory: Record<string, string> = {};
  for (const part of sportPagesBuilt) Object.assign(sportFolioByStory, part.built.sportFolioByStory);

  const favoriteFresh = fresh.filter(isFavoriteStory);
  const favorites = favoritePages(favoriteFresh, favoriteFresh, opts.clubs, editorFront(fresh));

  const national = nationalPages(opts.national ?? null);
  // National News sits in B, right after Section A, when the edition has a
  // filed row. Missouri keeps B when National is off so existing folios hold;
  // with National on, Missouri becomes C. Sports never take B or C.
  const mo = missouriPages(opts.missouri ?? null, national.length ? "C" : "B");
  const pages: EditionPage[] = [...favorites.pages, ...national, ...mo];
  const sections: EditionSection[] = [
    {
      code: "A",
      title: "Favorite Teams",
      folio: "A1",
      index: 0,
      stories: favoriteFresh.length,
      upcoming: opts.clubs.reduce((n, club) => n + Math.min(1, club.upcoming.length), 0),
      pages: favorites.pages.length,
    },
  ];
  if (national.length) {
    sections.push({
      code: "B",
      title: "National News",
      folio: "B1",
      index: favorites.pages.length,
      stories: national.reduce((n, p) => n + p.stories.length, 0),
      upcoming: 0,
      pages: national.length,
    });
  }
  if (mo.length) {
    const moCode = national.length ? "C" : "B";
    sections.push({
      code: moCode,
      title: "Missouri",
      folio: `${moCode}1`,
      index: favorites.pages.length + national.length,
      stories: mo.reduce((n, p) => n + p.items.length, 0),
      upcoming: 0,
      pages: mo.length,
    });
  }

  for (const part of sportPagesBuilt) {
    const upcoming = (clubsBy.get(part.id.path) ?? []).reduce((n, club) => n + club.upcoming.length, 0);
    sections.push({
      code: part.id.code,
      title: part.id.title,
      folio: `${part.id.code}1`,
      index: pages.length,
      stories: (storiesBy.get(part.id.path) ?? []).length,
      upcoming,
      pages: part.built.pages.length,
    });
    pages.push(...part.built.pages);
  }

  return {
    pages,
    sections,
    sportFolioByStory,
    favoriteFolioByStory: favorites.favoriteFolioByStory,
  };
}
