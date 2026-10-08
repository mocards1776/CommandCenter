/**
 * Thompson Times sections.
 *
 * Section A is the essentials — the stuff that matters most to the reader:
 * favorite clubs, MoScout and Missouri politics, races we're tracking,
 * the Day Ahead, the Beez, and — almost never — a historic national story.
 * Other teams reach A only
 * when the story is major (`isMajorStory`). National news stays in Section B
 * unless it is major-major (assassination attempt, war starting, major terror
 * attack, landmark Court ruling, market crash, huge disaster, a president
 * leaving office), near-universal across outlets, and the national editor
 * confirmed the slate. Most days, zero national stories make A; at most 1–2
 * on a historic day. A front, a clubs desk, inside story / club-form pages,
 * the races desk, the Day Ahead, the Beez, and the RUWT watch page stay in A. National News
 * is its own section immediately after A (B when the edition has a filed
 * row). Missouri follows as C, or stays B when National is off.
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
  previousSaturday,
  splitStoryCopy,
  withinEditionHours,
  withoutEditorStamps,
} from "./newspaper.ts";
import { cleanedBodyLength, cleanStoryCopy, isPeripheralClubStory, killedSource, printHeadline } from "./newspaper-copy.ts";
import { storySource } from "./newspaper-source.ts";
import type { GameWrapCard } from "./newspaper-sports";
import { favoriteKeyFitsPath, storyMatchesFavorite } from "./newspaper-favorite-match.ts";
import {
  isInjuryNote,
  isSportFiller,
  orderSportRecaps,
  orderSportSectionFront,
  SPORT_NEWS_CAP,
  storyFitsSection,
} from "./newspaper-sport-desk.ts";
import { isPromoMissouriItem, type MissouriDesk, type MoItem } from "./newspaper-missouri.ts";
import type { FavoritesDayPage } from "./newspaper-day-ahead.ts";
import type { FavoritesBeezPage } from "./newspaper-beez.ts";
import type { FavoritesRacesPage } from "./newspaper-races.ts";
import { cleanNationalStories, packNationalPages, type NationalDesk, type NationalStory } from "./newspaper-national.ts";
import { printsFavoriteCoaches } from "./newspaper-favorite-coaches.ts";
import {
  A2_CLUB_CARDS,
  NEWS_STORIES_PER_PAGE,
  planOutlookAndForm,
  planStandingsPages,
  STAND_TABLES_PER_PAGE_COLLEGE,
  STAND_TABLES_PER_PAGE_PRO,
} from "./newspaper-page.ts";

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

/** Section A masthead / chrome label. The pages stay; the beat is the essentials. */
export const SECTION_A_TITLE = "The Essentials";

/**
 * In-season from a Central calendar date (YYYY-MM-DD or an edition id).
 * NBA preseason (before late October) counts as out of season.
 *
 * NFL Sep–Feb, CFB late Aug–Jan, MLB Mar–Oct (postseason Oct), NHL Oct–Jun,
 * NBA late Oct–Jun, CBB Nov–Apr, EPL/EFL Aug–May.
 */
export function sportInSeason(path: string, day: string, now = day): boolean {
  const stamp = (now || day).slice(0, 10);
  const month = Number(stamp.slice(5, 7));
  const date = Number(stamp.slice(8, 10));
  if (!month || !date) return true;
  switch (path) {
    case "football/nfl":
      return month >= 9 || month <= 2;
    case "football/college-football":
      return month > 8 || month === 1 || (month === 8 && date >= 20);
    case "baseball/mlb":
      return month >= 3 && month <= 10;
    case "hockey/nhl":
      return month >= 10 || month <= 6;
    case "basketball/nba":
      return month >= 11 || month <= 6 || (month === 10 && date >= 22);
    case "basketball/mens-college-basketball":
      return month >= 11 || month <= 4;
    case "soccer/eng.1":
    case "soccer/eng.2":
      return month >= 8 || month <= 5;
    default:
      return true;
  }
}

/** In-season sports first; tie-break with the existing KNOWN order. */
export function orderSportSections(ids: SportSectionId[], day: string): SportSectionId[] {
  return [...ids].sort((a, b) => {
    const season = Number(sportInSeason(b.path, day)) - Number(sportInSeason(a.path, day));
    if (season) return season;
    return a.order - b.order || a.code.localeCompare(b.code);
  });
}

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
  /** A2 is today's weather; the next folio is the outlook plus club form. */
  weatherPart?: "today" | "outlook";
  /** Slice of the clubs grid so A2 can fill without reprinting every card. */
  clubOffset?: number;
  clubLimit?: number;
  /** Club-form cards pulled onto the outlook folio so A3 is not empty cream. */
  formClubs?: ClubDesk[];
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
  | "opener"
  | "coaches";

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
  /** Which conference tables this standings folio prints. */
  standSlice?: { offset: number; count: number };
  /** Which leftover news stories this folio prints. */
  newsSlice?: { offset: number; count: number };
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
  /** Set client-side by insertRaceBriefs (newspaper-races.ts); buildEdition never makes one. */
  | FavoritesRacesPage
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

/** Infer a sport path when the filed row left leaguePath blank. */
export function leaguePathFromSportLabel(label?: string | null): string | null {
  const s = (label ?? "").trim().toLowerCase();
  if (s === "nfl" || s === "football") return "football/nfl";
  if (s === "mlb" || s === "baseball") return "baseball/mlb";
  if (s === "nhl" || s === "hockey") return "hockey/nhl";
  if (s === "nba" || s === "basketball") return "basketball/nba";
  if (s === "cfb" || s === "college football") return "football/college-football";
  if (s === "cbb" || s === "college basketball" || s === "ncaam") return "basketball/mens-college-basketball";
  if (s === "epl" || s === "premier league") return "soccer/eng.1";
  if (s === "efl" || s === "championship") return "soccer/eng.2";
  return null;
}

/**
 * A favoriteKey belongs to the card's own sport. "Cardinals" in an NFL hed
 * is Arizona, not the St. Louis baseball desk.
 */
export function favoriteKeyFitsCard(
  key: string | null | undefined,
  card: Pick<GameWrapCard, "leaguePath" | "sportLabel">,
): boolean {
  return favoriteKeyFitsPath(key, card.leaguePath || leaguePathFromSportLabel(card.sportLabel), card.sportLabel);
}

export function isFavoriteStory(card: GameWrapCard): boolean {
  if (card.favoriteKey) return favoriteKeyFitsCard(card.favoriteKey, card);
  return false;
}

/** Today's Missouri Scout brief — always an A1 slot when the edition has one. */
export function isMoScoutCard(card: Pick<GameWrapCard, "sportLabel" | "teamName" | "caption" | "wrapHref">): boolean {
  if (card.sportLabel !== "Missouri") return false;
  return /missouri scout|moscout/i.test(`${card.teamName ?? ""} ${card.caption ?? ""} ${card.wrapHref ?? ""}`);
}

export function isTodaysMoScout(card: GameWrapCard, edition: string): boolean {
  if (!isMoScoutCard(card)) return false;
  if (!card.when) return true;
  const day = instantDay(card.when);
  const newsDay = editionNewsDay(edition);
  return !day || day === newsDay || day === edition.slice(0, 10);
}

/** Clubs that print scores and the NBA desk, but never occupy an A1 slot. */
export const A1_MUTED_KEYS = new Set(["nba-phi"]);

export function isA1MutedFavoriteKey(key: string | null | undefined): boolean {
  return Boolean(key && A1_MUTED_KEYS.has(key));
}

export function isNbaCard(card: Pick<GameWrapCard, "leaguePath" | "sportLabel">): boolean {
  const path = cardLeaguePath(card);
  return path === "basketball/nba" || /^nba$/i.test(card.sportLabel ?? "");
}

/** 76ers, NBA preseason / exhibition, stale prior-day results, and other non-favorite NBA fluff. */
export function isA1Muted(card: GameWrapCard, edition = ""): boolean {
  if (isA1MutedFavoriteKey(card.favoriteKey)) return true;
  if (isFrontPreseasonNote(card)) return true;
  if (isStaleA1Result(card, edition)) return true;
  if (!isNbaCard(card)) return false;
  if (edition && !sportInSeason("basketball/nba", edition)) return true;
  return !isFavoriteStory(card);
}

/** A1 Coming Up: same slate, minus clubs that do not belong on the front. */
export function a1ComingUp<T extends { favoriteKey?: string | null }>(games: T[]): T[] {
  return games.filter((game) => !isA1MutedFavoriteKey(game.favoriteKey));
}

/** A1 lead / second / third: a followed club, today's MoScout, or historic national. */
export function mayFrontA1(card: GameWrapCard, edition: string): boolean {
  if (isA1Muted(card, edition)) return false;
  if (isTodaysMoScout(card, edition)) return true;
  if (isHistoricNationalCard(card)) return true;
  return isFavoriteStory(card);
}

function cardLeaguePath(card: Pick<GameWrapCard, "leaguePath" | "sportLabel">): string | null {
  return card.leaguePath || leaguePathFromSportLabel(card.sportLabel);
}

/** Filed rows sometimes drop favoriteKey; put the home desk back on the card. */
export function stampFavoriteKeys(stories: GameWrapCard[], clubs: ClubDesk[]): GameWrapCard[] {
  return stories.map((card) => {
    const kept = card.favoriteKey && favoriteKeyFitsCard(card.favoriteKey, card) ? card.favoriteKey : "";
    if (kept) return card.followed ? card : { ...card, favoriteKey: kept, followed: true };

    // Cross-league stamps (NFL "Cardinals" → mlb-stl, NFL "Bears" → MOST) drop
    // even when the clubs desk has not loaded yet.
    if (card.favoriteKey && !kept) {
      card = { ...card, favoriteKey: "", followed: false };
    }
    if (!clubs.length) return card;

    const path = cardLeaguePath(card);
    let hit: ClubDesk | undefined;
    for (const club of clubs) {
      if (club.leaguePath && path && club.leaguePath !== path) continue;
      const fav = {
        key: club.key,
        name: club.shortName,
        shortName: club.shortName,
        sport: "",
        league: "",
        espnPath: club.leaguePath ? `${club.leaguePath}/teams/0` : "",
        kind: "team" as const,
      };
      if (storyMatchesFavorite(card, fav)) {
        hit = club;
        break;
      }
    }
    if (hit) return { ...card, favoriteKey: hit.key, followed: true };
    return card;
  });
}

/** National or Missouri copy filed as a card so Section A can run the essentials. */
export function isEssentialsDesk(card: GameWrapCard): boolean {
  return card.sportLabel === "National" || card.sportLabel === "Missouri";
}

/** Mark set on a National card that cleared the historic Section A gate. */
export const HISTORIC_NATIONAL_STATUS = "historic-national";

/**
 * National copy big enough for Section A: not a funding bill, a hearing, or
 * the day's Washington lead — only the rare major-major event. Close to a
 * 9/11-class day, not merely important. The phrases match Josh's bar:
 * assassination attempt, war starting, major terror attack, landmark Court
 * ruling, market crash, huge natural disaster, a president leaving office.
 */
const HISTORIC_NATIONAL = new RegExp(
  [
    String.raw`assassinat`,
    String.raw`attempt on (?:the )?(?:u\.?s\.? )?(?:president|vice[- ]president)`,
    String.raw`(?:president|vice[- ]president)\S{0,24}(?:is |was |has been )?(?:shot|wounded|killed)`,
    String.raw`(?:shot|wounded|killed) (?:the )?(?:u\.?s\.? )?(?:president|vice[- ]president)`,
    String.raw`declares? war`,
    String.raw`war (?:has )?begun`,
    String.raw`war breaks? out`,
    String.raw`full-scale invasion`,
    String.raw`launches? (?:a |an |its )?(?:full-scale )?invasion`,
    String.raw`\binvades\b`,
    String.raw`terror(?:ist)? attack`,
    String.raw`suicide bomb`,
    String.raw`mass-casualty (?:attack|bombing)`,
    String.raw`landmark (?:supreme court |scotus )?(?:ruling|decision|opinion|holding)`,
    String.raw`(?:supreme court|scotus) (?:overturns?|strikes? down)`,
    String.raw`(?:stock[- ]?)?market crash`,
    String.raw`markets? crash`,
    String.raw`category [45] hurricane`,
    String.raw`magnitude \d+(?:\.\d+)? earthquake`,
    String.raw`(?:devastating|deadliest|catastrophic) (?:hurricane|earthquake|tsunami|wildfire|tornado|flood)`,
    String.raw`president (?:resigns|steps down|leaves office)`,
    String.raw`(?:25th|twenty-fifth) amendment`,
    String.raw`removed from office`,
    String.raw`sworn in as president`,
    String.raw`takes? the oath of office`,
  ].join("|"),
  "i",
);

/** Distinct desks that must have filed the same event (~10 national outlets). */
export const NATIONAL_A_OUTLET_MIN = 6;

export function isHistoricNationalEvent(text: string): boolean {
  return HISTORIC_NATIONAL.test(text.replace(/\s+/g, " "));
}

/** Grok actually sat the national slate — not the mechanical fallback. */
export function nationalDeskConfirmed(desk: NationalDesk | null | undefined): boolean {
  return Boolean(desk?.editor.model && desk.editor.fallback !== true);
}

/** Near-universal: most of the national roster filed the same lead. */
export function nationalNearUniversalCoverage(story: Pick<NationalStory, "outlets">): boolean {
  const names = [...new Set((story.outlets ?? []).map((outlet) => outlet.trim()).filter(Boolean))];
  return names.length >= NATIONAL_A_OUTLET_MIN;
}

/**
 * Rule gate for a National story in Section A: historic event language,
 * near-universal cross-outlet lead coverage, and national-editor confirmation.
 * Fail any one and it stays in National News (Section B).
 */
export function isHistoricNationalStory(
  story: Pick<NationalStory, "headline" | "summary" | "outlets">,
  desk: NationalDesk | null | undefined,
): boolean {
  if (!nationalDeskConfirmed(desk)) return false;
  if (!nationalNearUniversalCoverage(story)) return false;
  return isHistoricNationalEvent(`${story.headline} ${story.summary ?? ""}`);
}

export function isHistoricNationalCard(card: GameWrapCard): boolean {
  return card.sportLabel === "National" && card.status === HISTORIC_NATIONAL_STATUS;
}

/**
 * What belongs in Section A: followed clubs, Missouri, a historic national
 * story that cleared the gate, and other teams only when the copy is major.
 * Ordinary National News never qualifies.
 */
export function isSectionAStory(card: GameWrapCard): boolean {
  if (isFavoriteStory(card) || card.sportLabel === "Missouri") return true;
  if (isHistoricNationalCard(card)) return true;
  return isMajorStory(card);
}

function blankDeskCard(partial: Partial<GameWrapCard> & Pick<GameWrapCard, "id" | "headline">): GameWrapCard {
  return {
    favoriteKey: "",
    teamName: "",
    teamHref: "",
    sportLabel: "Wire",
    leaguePath: null,
    dek: null,
    body: null,
    scoreLine: null,
    when: null,
    won: null,
    gameHref: null,
    wrapHref: null,
    feedUrl: null,
    gameId: null,
    stats: [],
    leaders: [],
    teamStats: [],
    division: [],
    ...partial,
  };
}

export function nationalStoryCard(story: NationalStory, historic = false): GameWrapCard {
  const body = story.body?.trim() || story.summary;
  return blankDeskCard({
    id: story.id,
    teamName: story.source,
    sportLabel: "National",
    headline: story.headline,
    dek: story.summary,
    body,
    when: story.publishedAt,
    wrapHref: story.url,
    photo: story.imageUrl,
    caption: story.imageCredit || story.source,
    dateline: story.byline || story.credit,
    status: historic ? HISTORIC_NATIONAL_STATUS : null,
  });
}

export function missouriStoryCard(item: MoItem): GameWrapCard {
  return blankDeskCard({
    id: item.id,
    teamName: item.source,
    sportLabel: "Missouri",
    headline: item.headline,
    dek: item.dek,
    body: item.dek,
    when: item.when,
    wrapHref: item.url,
    photo: item.photo,
  });
}

const NATIONAL_A_CAP = 2;
const MISSOURI_A_CAP = 3;

/** Cards the rule desk may run in Section A from the National and Missouri pages. */
export function essentialsFromDesks(
  national: NationalDesk | null | undefined,
  missouri: MissouriDesk | null | undefined,
): GameWrapCard[] {
  const out: GameWrapCard[] = [];
  let nationalInA = 0;
  for (const story of national?.stories ?? []) {
    if (nationalInA >= NATIONAL_A_CAP) break;
    if (!isHistoricNationalStory(story, national)) continue;
    out.push(nationalStoryCard(story, true));
    nationalInA += 1;
  }
  if (missouri?.scout) out.push(missouriStoryCard(missouri.scout));
  const scoutId = missouri?.scout?.id;
  const politics = (missouri?.items ?? []).filter((item) => item.kind !== "listen" && item.id !== scoutId);
  for (const item of politics.slice(0, MISSOURI_A_CAP)) {
    out.push(missouriStoryCard(item));
  }
  return out;
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
  if (isEssentialsDesk(card)) return Boolean(card.headline);
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
    return cleanedBodyLength(card) >= 80;
  }
  if (!isFavoriteStory(card)) return false;
  if (card.id.startsWith("news-")) return Boolean(card.headline);
  if (cleanedBodyLength(card) >= 80) return true;
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
  return cleanedBodyLength(card) >= STORY_COPY_MIN;
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

/**
 * Betting tips, odds sheets, prop picks — fine inside a sport section, never the
 * A1 lead or the Telegram alert lead. Prefer the actual recap of that final.
 */
export function isBettingPreview(card: GameWrapCard): boolean {
  const head = `${card.headline} ${card.dek ?? ""}`;
  return /\bhow to bet\b|\bprop plays?\b|\bbetting (?:lines?|tips?|preview|odds)\b|\bagainst the spread\b|\bpicks and props\b|\btop prop\b|\bmoneyline\b|\bover\/under\b|\b(odds|spreads?) to (?:bet|know|watch)\b/i.test(
    head,
  );
}

/** A preview (or betting sheet) whose matchup already has a final/recap on the slate. */
export function isStaleGamePreview(card: GameWrapCard, pool: GameWrapCard[]): boolean {
  if (!isPreviewStory(card) && !isBettingPreview(card)) return false;
  return pool.some(
    (other) =>
      other.id !== card.id &&
      shareMatchup(card, other) &&
      (isRecapStory(other) ||
        isGameRecapCopy(other) ||
        isGameWrap(other) ||
        Boolean(other.status && /final/i.test(other.status))),
  );
}

/** A followed/home club's game result — not a transaction, injury, or preview. */
export function isFavoriteGameResult(card: GameWrapCard): boolean {
  if (!isFavoriteStory(card) || isInjuryNote(card)) return false;
  if (isPreviewStory(card) || isBettingPreview(card)) return false;
  return (
    isRecapStory(card) ||
    isGameRecapCopy(card) ||
    isGameWrap(card) ||
    Boolean(card.status && /final/i.test(card.status) && card.scoreLine && /\d/.test(card.scoreLine))
  );
}

function isFrontPreseasonNote(card: Pick<GameWrapCard, "preseason" | "headline" | "dek" | "status">): boolean {
  if (card.preseason) return true;
  return /\bpreseason\b/i.test(`${card.headline} ${card.dek ?? ""} ${card.status ?? ""}`);
}

function editionDateline(edition: string): string | null {
  const day = edition.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

function weekdayCt(day: string): number {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}

export function isCfbCard(card: Pick<GameWrapCard, "leaguePath" | "sportLabel">): boolean {
  const path = cardLeaguePath(card);
  return path === "football/college-football" || /^(cfb|college football)$/i.test(card.sportLabel ?? "");
}

/** Wire / box / scored final — not MoScout, a preview, or a notes piece. */
export function isA1GameResultCopy(card: GameWrapCard): boolean {
  if (isMoScoutCard(card) || isHistoricNationalCard(card) || card.sportLabel === "Missouri") return false;
  if (isPreviewStory(card) || isBettingPreview(card) || isInjuryNote(card)) return false;
  if (isGameWrap(card) || isRecapStory(card)) return true;
  return Boolean(card.status && /final/i.test(card.status) && card.scoreLine && /\d/.test(card.scoreLine));
}

const PRIOR_WEEKEND_COPY =
  /\bon saturday\b|\blast saturday\b|\bsaturday(?:'s)?(?: night)?\b|\bon sunday\b|\blast sunday\b|\blast weekend\b/i;

/**
 * Front-page sports must be current. Last night (the edition news day) and
 * today may occupy A1; older dated results may not. College football from
 * this past weekend may still lead through Monday; after Monday it is
 * leftover weekend copy. Coming Up schedule items are not game results
 * and are not filtered here.
 */
export function isStaleA1Result(card: GameWrapCard, edition: string): boolean {
  const today = editionDateline(edition);
  if (!today || !isA1GameResultCopy(card)) return false;

  const gameDay = card.when ? instantDay(card.when) : null;
  if (gameDay) {
    if (gameDay >= today) return false;
    if (gameDay >= editionNewsDay(today)) return false;
    const wd = weekdayCt(today);
    // Saturday / Sunday CFB stays current through Monday's papers.
    if (isCfbCard(card) && (wd === 0 || wd === 1) && gameDay >= previousSaturday(today)) return false;
    return true;
  }

  if (!isCfbCard(card)) return false;
  const wd = weekdayCt(today);
  if (wd < 2 || wd > 5) return false;
  return PRIOR_WEEKEND_COPY.test(`${card.headline} ${card.dek ?? ""} ${card.body ?? ""}`);
}

/** A followed club's own game wrap — not commentary that inherited a score. */
function isClubGameResult(card: GameWrapCard): boolean {
  if (!isFavoriteGameResult(card) || !favoriteKeyFitsCard(card.favoriteKey, card)) return false;
  return isGameWrap(card) || isRecapStory(card) || isGameRecapCopy(card);
}

/** Central calendar day of a club result. Wire wraps use the kickoff, not a later take. */
export function clubResultDay(card: GameWrapCard): string | null {
  if (!isClubGameResult(card) || !isGameWrap(card) || !card.when) return null;
  return instantDay(card.when);
}

/**
 * The most recent day a followed club actually played in this pool.
 * Saturday's Blues final is stale once Sunday's Chiefs/Cowboys are on the slate.
 */
export function latestClubResultDay(pool: GameWrapCard[]): string | null {
  let latest: string | null = null;
  for (const card of pool) {
    const day = clubResultDay(card);
    if (day && (!latest || day > latest)) latest = day;
  }
  return latest;
}

/**
 * Compact story under the A1 lead. Desk-club results (photo + graf) beat a
 * national wrap that only shares a name with a home club. A result from an
 * earlier club game day never beats one from the latest game day on the slate.
 */
export function pickFrontUnderLead(pool: GameWrapCard[], lead: GameWrapCard | null, edition = ""): GameWrapCard | null {
  const playable = pool.filter((c) => c !== lead && c.id !== lead?.id && !isA1Muted(c, edition) && !isFrontPreseasonNote(c));
  if (!playable.length) return null;
  const latestDay = latestClubResultDay(playable);
  const freshEnough = (card: GameWrapCard) => {
    if (!latestDay || !isClubGameResult(card)) return true;
    const day = clubResultDay(card);
    return !day || day >= latestDay;
  };
  const freshResults = playable.filter((c) => isClubGameResult(c) && freshEnough(c));
  const wins = freshResults.filter((c) => c.won === true);
  const candidates = wins.length ? wins : freshResults.length ? freshResults : playable.filter(freshEnough);
  const score = (card: GameWrapCard) =>
    (isFavoriteGameResult(card) && favoriteKeyFitsCard(card.favoriteKey, card)
      ? 100 + favoriteDeskWeight(card.favoriteKey)
      : 0) +
    (isGameWrap(card) ? 15 : 0) +
    (card.photo ? 20 : 0) +
    (card.scoreLine && /\d/.test(card.scoreLine) ? 10 : 0);
  return [...candidates].sort((a, b) => score(b) - score(a))[0] ?? null;
}

/** Never open A1 or the edition alert on these. */
export function cannotLeadFront(card: GameWrapCard, pool: GameWrapCard[] = [], edition = ""): boolean {
  if (isA1Muted(card, edition)) return true;
  if (isHoldoverGame(card)) return true;
  if (isBettingPreview(card)) return true;
  if (pool.length && isStaleGamePreview(card, pool)) return true;
  if (isPreviewStory(card)) return true;
  // A minor injury note may run inside Section A; it never opens the paper
  // when a current favorite-team result is on the slate (Mizzou first).
  const liveFavoriteResult = (other: GameWrapCard) =>
    other.id !== card.id && isFavoriteGameResult(other) && !isStaleA1Result(other, edition);
  if (isInjuryNote(card) && pool.some(liveFavoriteResult)) {
    return true;
  }
  if (card.sportLabel === "Missouri" && pool.some(liveFavoriteResult)) {
    return true;
  }
  return false;
}

/** When a banned lead is the editor's pick, swap in the matchup's recap if we have one. */
function leadReplacement(bad: GameWrapCard, pool: GameWrapCard[], taken: Set<string>, edition = ""): GameWrapCard | null {
  const recap = pool.find(
    (c) =>
      !taken.has(c.id) &&
      c.id !== bad.id &&
      !isA1Muted(c, edition) &&
      shareMatchup(c, bad) &&
      (isRecapStory(c) || isGameRecapCopy(c) || isGameWrap(c)) &&
      hasStoryCopy(c),
  );
  if (recap) return recap;
  if (!isInjuryNote(bad) && bad.sportLabel !== "Missouri") return null;
  const results = pool
    .filter(
      (c) =>
        !taken.has(c.id) &&
        c.id !== bad.id &&
        isFavoriteGameResult(c) &&
        !isStaleA1Result(c, edition) &&
        hasStoryCopy(c),
    )
    .sort((a, b) => favoriteDeskWeight(b.favoriteKey ?? "") - favoriteDeskWeight(a.favoriteKey ?? ""));
  return results[0] ?? null;
}

/** Last night's result outranks a feature; home clubs outrank the rest. */
export function storyRank(card: GameWrapCard, edition: string): number {
  const day = card.when ? instantDay(card.when) : null;
  let score = 0;
  if (isBettingPreview(card)) score -= 250;
  if (isPreviewStory(card)) score -= 150;
  if (isInjuryNote(card)) score -= 220;
  if (isFavoriteGameResult(card)) score += 80;
  if (day === editionNewsDay(edition) && card.status && /final/i.test(card.status)) score += 100;
  if (card.postseason) score += 40;
  if (card.id.startsWith("news-")) score += 25;
  if (card.id.startsWith("league-")) score += 10;
  if (isAthleticCard(card)) score += 12;
  if (isRecapStory(card)) score += 20;
  if (cleanedBodyLength(card) >= 400) score += 15;
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
  // storyRank runs cleanStoryCopy. Score once per card — a comparator that
  // re-ranks on every compare was ~n log n HTML passes and blew the edge CPU budget.
  const score = new Map(cards.map((card) => [card, storyRank(card, edition)]));
  return [...cards].sort((a, b) => {
    const byRank = (score.get(b) ?? 0) - (score.get(a) ?? 0);
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

function upcomingFor(clubs: ClubDesk[]): DeskFixture[] {
  return sortComingUp(
    clubs.flatMap((club) =>
      club.upcoming.map((game) => ({
        id: game.id,
        team: club.shortName,
        label: game.label,
        when: game.when,
        startIso: game.startIso ?? null,
        detail: game.detail,
        favoriteKey: club.key,
      })),
    ),
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
  const cleaned = when
    .replace(/^@\s*[A-Za-z0-9.&']+\s+/i, "")
    .replace(/^(vs\.?|at)\s+[A-Za-z0-9.&']+\s+/i, "")
    .replace(/\bCT\b/g, "")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  const year = new Date(now).getFullYear();
  // Never parse a yearless "Sat Oct 31" — Date.parse treats 31 as the year.
  const attempts = /\b(?:19|20)\d{2}\b/.test(cleaned)
    ? [cleaned]
    : [`${cleaned} ${year}`, `${cleaned}, ${year}`];
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

/** Sort key: kickoff ms in real time. Date-only listings (no ISO, no clock) close their Chicago day. */
export function comingUpSortMs(
  game: { when: string | null; startIso?: string | null },
  now = Date.now(),
): number {
  if (game.startIso) {
    const t = Date.parse(game.startIso);
    if (!Number.isNaN(t)) return t;
  }
  const when = game.when?.trim() || "";
  if (!when) return Number.POSITIVE_INFINITY;
  const parsed = parseComingUpWhen(when, now);
  if (parsed == null) return Number.POSITIVE_INFINITY;
  return comingUpHasClock(when) ? parsed : endOfChicagoDay(parsed);
}

/** Favorite-team next games, soonest first. Same kickoff: higher desk weight first. */
export function sortComingUp<T extends { when: string | null; startIso?: string | null; favoriteKey?: string | null }>(
  games: T[],
  now = Date.now(),
): T[] {
  return [...games].sort((a, b) => {
    const d = comingUpSortMs(a, now) - comingUpSortMs(b, now);
    if (d !== 0) return d;
    const byDesk = favoriteDeskWeight(b.favoriteKey ?? "") - favoriteDeskWeight(a.favoriteKey ?? "");
    if (byDesk) return byDesk;
    return (a.when ?? "").localeCompare(b.when ?? "");
  });
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
  // National / Missouri desks already belong to this edition.
  if (isEssentialsDesk(card)) return true;
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
  const fromField = raw.match(/(\d{6,})/)?.[1] ?? (raw.length >= 4 ? raw : null);
  if (fromField) return fromField;
  const href = `${card.wrapHref ?? ""} ${card.gameHref ?? ""}`;
  const fromHref = href.match(/(?:gameId|event)[=/](\d{6,})/i)?.[1];
  if (fromHref) return fromHref;
  // Wire / recap / recent ids carry the ESPN game id. News- and league- ids
  // are article ids — do not treat those as the game.
  return /^(?:wire|recap|recent|wrap)[^\d]*(\d{6,})/.exec(card.id)?.[1] ?? null;
}

const TEAM_ALIASES: [string, string[]][] = [
  ["cowboys", ["cowboys", "dallas"]],
  ["texans", ["texans", "houston"]],
  ["lions", ["lions", "detroit"]],
  ["panthers", ["panthers", "carolina"]],
  ["chiefs", ["chiefs"]],
  ["raiders", ["raiders", "vegas"]],
  ["blues", ["blues"]],
  ["avalanche", ["avalanche", "colorado"]],
  ["mizzou", ["mizzou", "missouri", "tigers"]],
  ["florida", ["florida", "gators"]],
];

const FAVORITE_TEAM: Record<string, string> = {
  "nfl-dal": "cowboys",
  "nfl-det": "lions",
  "nfl-kc": "chiefs",
  "nhl-stl": "blues",
  "cfb-mizzou": "mizzou",
  "mlb-stl": "cardinals",
};

function namedTeams(card: GameWrapCard): Set<string> {
  const text = `${card.headline} ${card.dek ?? ""} ${card.teamName ?? ""}`.toLowerCase();
  const out = new Set<string>();
  const fav = card.favoriteKey ? FAVORITE_TEAM[card.favoriteKey] : null;
  if (fav) out.add(fav);
  for (const [canon, aliases] of TEAM_ALIASES) {
    if (aliases.some((alias) => new RegExp(`\\b${alias}\\b`, "i").test(text))) out.add(canon);
  }
  return out;
}

function shareMatchup(a: GameWrapCard, b: GameWrapCard): boolean {
  const shared = [...namedTeams(a)].filter((team) => namedTeams(b).has(team));
  return shared.length >= 2;
}

/**
 * A write-up of one game: the wrap, a recap, highlights, or a takeaways
 * piece on that matchup. Columns, betting notes, and week-wide roundups
 * stay out so they do not swallow the recap.
 */
export function isGameRecapCopy(card: GameWrapCard): boolean {
  if (isColumnStory(card) || isPreviewStory(card)) return false;
  const head = `${card.headline} ${card.dek ?? ""}`;
  if (/\bhow to bet\b|\bprop plays\b/i.test(head)) return false;
  if (isMultiGameRoundup(card)) return false;
  if (isMainGameStory(card)) return true;
  if (/\bgame highlights\b|\bfull highlights\b/i.test(head)) return true;
  if (/\btakeaways\b/i.test(head) && namedTeams(card).size >= 2) return true;
  if (
    /\b(?:win over|defeat(?:s|ed)?|trounc(?:es|ed)|beats?\b|rout(?:s|ed)?|crushed|whipped|edging|hold off|held off|thriller)\b/i.test(
      head,
    )
  ) {
    return true;
  }
  if (/\bvs\.?\b/i.test(head) && /\b(?:highlights|final|recap|score)\b/i.test(head)) return true;
  // A star's line from the same game ("17 catches, go-ahead score") is
  // another write-up of the recap, not a separate story.
  return (
    /\b(?:go-ahead|touchdowns?|\btds?\b|catches?|\byards?\b)\b/i.test(head) &&
    !/\binjur|dislocat|surgery|doubtful|questionable/i.test(head)
  );
}

/** Week-wide or three-team copy — not one final. */
export function isMultiGameRoundup(card: GameWrapCard): boolean {
  const head = `${card.headline} ${card.dek ?? ""}`;
  if (/\bweek \d+\b/i.test(head) && /\b(takeaways|comebacks?|roundup|results|scores)\b/i.test(head) && !/\bvs\.?\b/i.test(head)) {
    return true;
  }
  return namedTeams(card).size >= 3;
}

/**
 * Score banner, line score, and leaders belong only on that game's recap.
 * A week-wide roundup or injury note does not wear another game's chrome.
 */
export function isSingleGameRecap(card: GameWrapCard): boolean {
  if (isColumnStory(card) || isPreviewStory(card) || isMultiGameRoundup(card)) return false;
  return isGameWrap(card) || isRecapStory(card) || isGameRecapCopy(card);
}

/** When a club has one final in the slate, stamp that game id on its recaps. */
function attachInferredGameIds(stories: GameWrapCard[]): GameWrapCard[] {
  const byFav = new Map<string, Set<string>>();
  for (const card of stories) {
    if (!card.favoriteKey) continue;
    const gid = storyGameId(card);
    if (!gid) continue;
    if (!(isGameWrap(card) || (card.status && /final/i.test(card.status)))) continue;
    const set = byFav.get(card.favoriteKey) ?? new Set<string>();
    set.add(gid);
    byFav.set(card.favoriteKey, set);
  }
  return stories.map((card) => {
    if (storyGameId(card) || !card.favoriteKey || isColumnStory(card) || !isGameRecapCopy(card)) {
      return card;
    }
    const ids = byFav.get(card.favoriteKey);
    if (!ids || ids.size !== 1) return card;
    return { ...card, gameId: [...ids][0] };
  });
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

/** Club / city / generic sports words — not enough to collapse two packages. */
const SUBJECT_STOP = new Set([
  "cardinals", "chiefs", "lions", "cowboys", "blues", "tigers", "bears", "packers",
  "giants", "yankees", "rays", "brewers", "padres", "dodgers", "braves", "guardians",
  "kansas", "city", "louis", "detroit", "dallas", "missouri", "mizzou", "chicago",
  "arizona", "england", "patriots", "raiders", "vegas", "panthers", "falcons", "saints",
  "eagles", "steelers", "ravens", "bengals", "browns", "texans", "colts", "jaguars",
  "titans", "broncos", "chargers", "seahawks", "rams", "49ers", "niners", "commanders",
  "bills", "dolphins", "jets", "vikings", "buccaneers", "white", "sox", "cubs",
  "reds", "phillies", "mets", "orioles", "twins", "mariners", "astros", "rangers",
  "royals", "athletics", "nationals", "marlins", "rockies", "angels", "pirates",
  "division", "series", "playoff", "playoffs", "postseason", "walk", "single", "lifts",
  "beats", "beat", "win", "wins", "lead", "leads", "game", "final", "week", "monday",
  "sunday", "saturday", "night", "analysis", "tips", "prop", "plays", "preview",
]);

function distinctiveSubjects(card: GameWrapCard): string[] {
  return headlineTokens(card).filter((word) => word.length >= 6 && !SUBJECT_STOP.has(word));
}

function seriesGameKey(headline: string): string | null {
  const m = headline.match(/\b((?:al|nl)ds)\s+game\s+(\d)\b/i);
  return m ? `${m[1]!.toLowerCase()}-${m[2]}` : null;
}

/** Same person / same package: Tyreek Hill twice, Chourio twice, ALDS Game 3 twice. */
function sameNamedPackage(a: GameWrapCard, b: GameWrapCard): boolean {
  if (a.leaguePath && b.leaguePath && a.leaguePath !== b.leaguePath) return false;
  const seriesA = seriesGameKey(a.headline);
  const seriesB = seriesGameKey(b.headline);
  if (seriesA && seriesB && seriesA === seriesB) return true;
  const left = distinctiveSubjects(a);
  const right = distinctiveSubjects(b);
  if (!left.length || !right.length) return false;
  const shared = left.filter((w) => right.includes(w));
  return shared.length >= 1;
}

export function sameSectionAStory(a: GameWrapCard, b: GameWrapCard): boolean {
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
  if (gameA && gameB && gameA === gameB) return true;
  if (isGameRecapCopy(a) && isGameRecapCopy(b) && shareMatchup(a, b)) return true;
  if (isMainGameStory(a) && isMainGameStory(b) && sameStory(headlineTokens(a), headlineTokens(b))) {
    return true;
  }
  if (sameNamedPackage(a, b)) return true;
  return sameStory(headlineTokens(a), headlineTokens(b));
}

function pickBetterStory(cards: GameWrapCard[]): GameWrapCard {
  return cards.reduce((best, card) => (preferStory(card, best) ? card : best));
}

/** One story per event. The better / fuller copy stays; columns like Hochman stay separate. */
/** One card into the same groups `dedupeStories` builds. Safe to call across hops. */
export function dedupePush(groups: GameWrapCard[][], card: GameWrapCard): GameWrapCard[][] {
  const hits: number[] = [];
  for (let i = 0; i < groups.length; i += 1) {
    if (groups[i]!.some((prev) => sameSectionAStory(card, prev))) hits.push(i);
  }
  if (!hits.length) {
    groups.push([card]);
    return groups;
  }
  const [first, ...rest] = hits;
  groups[first!]!.push(card);
  for (const i of rest.sort((a, b) => b - a)) {
    groups[first!]!.push(...groups[i]!);
    groups.splice(i, 1);
  }
  return groups;
}

export function finishDedupe(groups: GameWrapCard[][]): GameWrapCard[] {
  return groups.map(pickBetterStory);
}

/** Desk-eligible stories, not yet collapsed — the scheduled press dedupes these a slice at a time. */
export function deskCopyQueue(stories: GameWrapCard[], edition: string): GameWrapCard[] {
  const inWindow = stories.filter(
    (card) =>
      isDeskStory(card) && !isNewsMuted(card) && !staleNamedPackage(card, edition) && inEditionWindow(card, edition),
  );
  return attachInferredGameIds(inWindow);
}

export function dedupeStories(stories: GameWrapCard[]): GameWrapCard[] {
  const groups: GameWrapCard[][] = [];
  for (const card of attachInferredGameIds(stories)) dedupePush(groups, card);
  return finishDedupe(groups);
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
 * Section A is the essentials desk; routine league wire never runs there.
 */
export function isMajorStory(card: GameWrapCard): boolean {
  if (isPreviewStory(card)) return false;
  // Non-favorite injury news stays in the sport section, even a star lost
  // for the season. Section A is the essentials desk, not the league wire.
  if (isInjuryNote(card)) return false;
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
/**
 * Stories the editor put on A1, in its order, held to the desk's beat: a
 * favorite-club, today's MoScout, or historic-national story always may.
 * Other teams never occupy an A1 slot, even when the copy is major.
 */
export function editorFront(fresh: GameWrapCard[], edition = ""): GameWrapCard[] {
  const picked: GameWrapCard[] = [];
  const taken = new Set<string>();
  const ordered = fresh
    .filter((card) => card.editorFront != null && card.editorFront < FRONT_STORIES && hasStoryCopy(card))
    .filter((card) => !isHoldoverGame(card))
    .sort((a, b) => a.editorFront! - b.editorFront!);
  for (const card of ordered) {
    let choice: GameWrapCard | null = card;
    if (cannotLeadFront(card, fresh, edition)) {
      choice = leadReplacement(card, fresh, taken, edition);
      if (!choice) continue;
    }
    if (taken.has(choice.id)) continue;
    if (
      isA1Muted(choice, edition) ||
      !(isFavoriteStory(choice) || isMoScoutCard(choice) || isHistoricNationalCard(choice))
    ) {
      if (choice.sportLabel === "National") continue;
      // Other-team copy may still run inside Section A when it is major.
      // It never occupies an A1 slot. 76ers / NBA fluff never do either.
      continue;
    }
    picked.push(choice);
    taken.add(choice.id);
    if (picked.length >= FRONT_STORIES) break;
  }
  return picked;
}

function favoritePages(
  freshStories: GameWrapCard[],
  sectionStories: GameWrapCard[],
  clubs: ClubDesk[],
  frontPicks: GameWrapCard[] = [],
  edition = "",
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
  const clubOf = (c: GameWrapCard) => c.favoriteKey ?? c.teamName ?? c.id;
  const picks: GameWrapCard[] = [];
  const taken = new Set<string>();
  const slotOk = (card: GameWrapCard) => mayFrontA1(card, edition);
  // Editor picks first, but betting sheets / stale previews never open A1 —
  // swap in that matchup's recap when we have one.
  for (const card of frontPicks) {
    if (picks.length >= FRONT_STORIES) break;
    let choice: GameWrapCard | null = card;
    if (cannotLeadFront(card, frontPool, edition) || !slotOk(card)) choice = leadReplacement(card, frontPool, taken, edition);
    if (!choice || taken.has(choice.id) || cannotLeadFront(choice, frontPool, edition) || !slotOk(choice)) continue;
    picks.push(choice);
    taken.add(choice.id);
  }
  // A video stub or one-line note leaves a column of bare photo on the front.
  const written = frontPool.filter(
    (c) =>
      slotOk(c) &&
      !cannotLeadFront(c, frontPool, edition) &&
      !taken.has(c.id) &&
      !isTodaysMoScout(c, edition),
  );
  for (const card of written) {
    if (picks.length >= 3) break;
    if (!picks.some((f) => clubOf(f) === clubOf(card))) {
      picks.push(card);
      taken.add(card.id);
    }
  }
  for (const card of [...written, ...frontPool]) {
    if (picks.length >= 3) break;
    if (!slotOk(card) || cannotLeadFront(card, frontPool, edition) || taken.has(card.id)) continue;
    picks.push(card);
    taken.add(card.id);
  }
  const scout = frontPool.find((c) => isTodaysMoScout(c, edition));
  if (scout && !taken.has(scout.id)) {
    if (picks.length < FRONT_STORIES) {
      picks.push(scout);
      taken.add(scout.id);
    } else {
      const replaceAt = picks.length - 1;
      const dropped = picks[replaceAt]!;
      taken.delete(dropped.id);
      picks[replaceAt] = scout;
      taken.add(scout.id);
    }
  }
  const [lead = null, second = null, third = null] = picks;
  for (const card of [lead, second, third]) {
    if (card) favoriteFolioByStory[card.id] = "A1";
  }

  // Every front jump lands on one page after weather today (A2) and the
  // outlook / clubs desk (A3). A2 used to hold both and ran past 1650.
  const jumps: { card: GameWrapCard; rest: string }[] = [];
  const jumpFolio = "A4";
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
          sectionTitle: SECTION_A_TITLE,
          sectionPage: 4,
          sectionCount: 0,
          continuedFrom: "A1",
          jumps,
          jumpFolio: undefined,
        },
      ]
    : [];
  let n = 4 + continues.length;

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
      sectionTitle: SECTION_A_TITLE,
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
    sectionTitle: SECTION_A_TITLE,
    sectionPage: 1,
    sectionCount: 0,
    lead,
    second,
    third,
    briefs: (freshStories.length ? freshStories : sectionStories)
      .filter((c) => !frontIds.has(c.id) && !isA1Muted(c, edition))
      .slice(0, 6),
    news: (freshStories.length ? freshStories : sectionStories).filter((c) => !isA1Muted(c, edition)),
    leadContinue: leadJump.folio,
    secondContinue: secondJump.folio,
    thirdContinue: thirdJump.folio,
    leadTeaser: leadJump.teaser,
    secondTeaser: secondJump.teaser,
    thirdTeaser: thirdJump.teaser,
  };

  const orderedClubs = [...clubs].sort(
    (a, b) => favoriteDeskWeight(b.key) - favoriteDeskWeight(a.key),
  );
  const packed = planOutlookAndForm(orderedClubs.length);

  const weatherToday: FavoritesClubsPage = {
    kind: "favorites-clubs",
    folio: "A2",
    section: "A",
    sectionTitle: SECTION_A_TITLE,
    sectionPage: 2,
    sectionCount: 0,
    weatherPart: "today",
    clubOffset: 0,
    clubLimit: A2_CLUB_CARDS,
  };

  const weatherOutlook: FavoritesClubsPage = {
    kind: "favorites-clubs",
    folio: "A3",
    section: "A",
    sectionTitle: SECTION_A_TITLE,
    sectionPage: 3,
    sectionCount: 0,
    weatherPart: "outlook",
    clubOffset: packed.leftoverOffset,
    clubLimit: packed.leftoverCount,
    formClubs: orderedClubs.slice(0, packed.formOnOutlook),
  };

  const pages: (
    | FavoritesFrontPage
    | FavoritesClubsPage
    | FavoritesFormPage
    | FavoritesInsidePage
    | FavoritesContinuePage
    | FavoritesWatchPage
  )[] = [front, weatherToday, weatherOutlook, ...continues, ...inside];

  // Remaining club form only — never repeat a short page just to pad to 5.
  for (const slice of packed.formContinue) {
    const chunk = orderedClubs.slice(slice.offset, slice.offset + slice.count);
    if (!chunk.length) continue;
    const pageN = pages.length + 1;
    pages.push({
      kind: "favorites-form",
      folio: `A${pageN}`,
      section: "A",
      sectionTitle: SECTION_A_TITLE,
      sectionPage: pageN,
      sectionCount: 0,
      clubs: chunk,
    });
  }

  // The viewing guide closes Section A, after the club pages and before Missouri.
  const watchN = pages.length + 1;
  pages.push({
    kind: "favorites-watch",
    folio: `A${watchN}`,
    section: "A",
    sectionTitle: SECTION_A_TITLE,
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

/** After the section front / wraps, before standings and the schedule. */
export function insertCoachesFocus(focuses: SportFocus[], include: boolean): SportFocus[] {
  if (!include || focuses.includes("coaches")) return focuses;
  const recapsAt = focuses.indexOf("recaps");
  if (recapsAt >= 0) {
    return [...focuses.slice(0, recapsAt + 1), "coaches", ...focuses.slice(recapsAt + 1)];
  }
  const refAt = focuses.findIndex((focus) => focus === "teams" || focus === "schedule");
  if (refAt >= 0) {
    return [...focuses.slice(0, refAt), "coaches", ...focuses.slice(refAt)];
  }
  return [...focuses, "coaches"];
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
  withCoaches = false,
  alreadyOnA1: GameWrapCard[] = [],
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
  const focuses = insertCoachesFocus(
    sportSectionFocuses({
      path: id.path,
      offseason,
      withLeaders,
      withPlayers,
      postseason,
    }),
    withCoaches && printsFavoriteCoaches(edition),
  );
  const isStoryFocus = (f: SportFocus): boolean => f === "front" || f === "recaps" || f === "news" || f === "opener";
  const recapPool = orderSportRecaps(
    unique.filter((card) => isGameWrap(card) || isRecapStory(card)),
    id.path,
  );
  const newsPool = unique
    .filter((card) => !isGameWrap(card) && !isSportFiller(card, recapPool))
    .slice(0, SPORT_NEWS_CAP);
  const newsDay = editionNewsDay(edition);
  const frontPool = orderSportSectionFront([...recapPool, ...newsPool], id.path, edition, alreadyOnA1).filter((card) => {
    // Last night's favorite wrap may lead its section. Older Section A
    // recaps already ran in A — do not reprint them on a later front.
    // Home-desk and Championship clubs always stay (Mizzou, Wrexham).
    if (!(isSectionAStory(card) && (isGameWrap(card) || isRecapStory(card)))) return true;
    if (id.path.startsWith("soccer/")) return true;
    if (favoriteDeskWeight(card.favoriteKey) >= 100) return true;
    const gameDay = card.when ? instantDay(card.when) : null;
    return Boolean(gameDay && gameDay === newsDay);
  });
  // Six stories fill a ~1480 front (lead + under + rail + briefs). Three
  // left CFB1 short (~1229) with cream under the lead column.
  const FRONT_SHOW = 6;
  const frontShown = frontPool.slice(0, FRONT_SHOW);
  const shownIds = new Set(frontShown.map((card) => card.id));
  let recapsLeft = recapPool.filter((card) => !shownIds.has(card.id));
  recapsLeft.forEach((card) => shownIds.add(card.id));
  let newsLeft = newsPool.filter((card) => !shownIds.has(card.id));
  // CFB2 was leaving two cream columns when only four leftover wraps
  // sat in a 3-col flow. Pull the next CFB notes onto the recaps desk.
  if (id.path.includes("college-football") && recapsLeft.length < 6) {
    const pulled = newsLeft.slice(0, 9 - recapsLeft.length);
    recapsLeft = [...recapsLeft, ...pulled];
    const pulledIds = new Set(pulled.map((card) => card.id));
    newsLeft = newsLeft.filter((card) => !pulledIds.has(card.id));
  }
  const storyFocuses = focuses.flatMap((f) => {
    if (!isStoryFocus(f)) return [];
    if (f === "recaps") return recapsLeft.length > 0 ? (["recaps"] as const) : [];
    if (f === "news") {
      if (!newsLeft.length) return [];
      const n = Math.max(1, Math.ceil(newsLeft.length / NEWS_STORIES_PER_PAGE));
      return Array.from({ length: n }, () => "news" as const);
    }
    return [f];
  });
  const refFocuses = focuses.filter((f) => !isStoryFocus(f));
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

  let newsCursor = 0;
  const pages = numbered.map((page, i) => {
    if (page.kind !== "sport-front") return page;
    const nextFront = numbered.slice(i + 1).find((p) => p.kind === "sport-front");
    let newsSlice: { offset: number; count: number } | undefined;
    let pool =
      page.focus === "front"
        ? frontShown
        : page.focus === "news"
          ? newsLeft
          : page.focus === "recaps"
            ? recapsLeft
            : unique;
    if (page.focus === "news") {
      const offset = newsCursor;
      const count = Math.min(NEWS_STORIES_PER_PAGE, Math.max(newsLeft.length - offset, 0));
      newsSlice = { offset, count };
      pool = newsLeft.slice(offset, offset + count);
      newsCursor += count;
    }
    return {
      ...page,
      sectionDesks,
      newsSlice,
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
  const packed = packNationalPages(cleanNationalStories(desk.stories));
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
  const inWindow = stories.filter(
    (card) =>
      isDeskStory(card) && !isNewsMuted(card) && !staleNamedPackage(card, edition) && inEditionWindow(card, edition),
  );
  return dedupeStories(inWindow).map((card) => ({
    ...card,
    headline: printHeadline(card.headline),
    dek: card.dek != null ? printHeadline(card.dek) : card.dek,
  }));
}

/**
 * What the AI editor reads, in the rule desk's order: `news` is the budget it
 * ranks and may spike (team news, league news, The Athletic), capped at
 * `limit`; `games` is the night's wraps, shown only so it can weigh news
 * against results. Wraps never count against the cap.
 */
export function editorCandidatesFromDesk(
  deskStories: GameWrapCard[],
  edition: string,
  limit = 24,
): { news: GameWrapCard[]; games: GameWrapCard[] } {
  const ranked = ruleOrder(deskStories.map(withoutEditorStamps), edition);
  return {
    news: ranked.filter((card) => !isGameWrap(card)).slice(0, limit),
    games: ranked.filter(isGameWrap),
  };
}

export function editorCandidates(
  stories: GameWrapCard[],
  edition: string,
  limit = 24,
  gameLimit = 16,
): { news: GameWrapCard[]; games: GameWrapCard[] } {
  return editorCandidatesFromDesk(deskCopy(stories, edition), edition, limit);
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
  /** League paths with favorite coaches on file — each may get the weekly coaches desk. */
  coachPaths?: string[];
}): Edition {
  const fresh = rankStories(
    deskCopy(stampFavoriteKeys(opts.stories, opts.clubs), opts.edition).filter((card) => !card.editorSpiked),
    opts.edition,
  );
  const favoriteFresh = fresh.filter(isSectionAStory);

  const paths = new Set<string>();
  for (const club of opts.clubs) if (club.leaguePath) paths.add(club.leaguePath);
  for (const story of fresh) if (story.leaguePath) paths.add(story.leaguePath);

  const ids = uniqueCodes(orderSportSections([...paths].map(sportSectionId), opts.edition));

  const clubsBy = new Map<string, ClubDesk[]>();
  for (const club of opts.clubs) {
    if (!club.leaguePath) continue;
    const list = clubsBy.get(club.leaguePath) ?? [];
    list.push(club);
    clubsBy.set(club.leaguePath, list);
  }
  // A1 already ran the favorite wrap (Mizzou 45–17). The sport front opens
  // on the next-best game and points back to A1 instead of reprinting it.
  // editorFront() is only stamped picks — favoritePages may still put a
  // club wrap on A1 with no editorFront, so read the composed A1 lead.
  const a1Picks = editorFront(fresh, opts.edition);
  const favorites = favoritePages(favoriteFresh, favoriteFresh, opts.clubs, a1Picks, opts.edition);
  const a1Front = favorites.pages.find((p) => p.kind === "favorites-front");
  const a1Ran =
    a1Front?.kind === "favorites-front"
      ? [a1Front.lead, a1Front.second, a1Front.third].filter((c): c is GameWrapCard => Boolean(c))
      : a1Picks;
  const storiesBy = new Map<string, GameWrapCard[]>();
  for (const story of fresh) {
    if (!story.leaguePath) continue;
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
      opts.coachPaths?.includes(id.path) ?? false,
      id.path.includes("college-football")
        ? a1Ran.filter((card) => card.leaguePath === id.path)
        : [],
    ),
  }));
  const sportFolioByStory: Record<string, string> = {};
  for (const part of sportPagesBuilt) Object.assign(sportFolioByStory, part.built.sportFolioByStory);

  const national = nationalPages(opts.national ?? null);
  // National News sits in B, right after Section A, when the edition has a
  // filed row. Missouri keeps B when National is off so existing folios hold;
  // with National on, Missouri becomes C. Sports never take B or C.
  const mo = missouriPages(opts.missouri ?? null, national.length ? "C" : "B");
  const pages: EditionPage[] = [...favorites.pages, ...national, ...mo];
  const sections: EditionSection[] = [
    {
      code: "A",
      title: SECTION_A_TITLE,
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

  return dropEmptyFolios({
    pages,
    sections,
    sportFolioByStory,
    favoriteFolioByStory: favorites.favoriteFolioByStory,
  });
}

function restampEditionPages(pages: EditionPage[]): EditionPage[] {
  const counts = new Map<string, number>();
  for (const page of pages) counts.set(page.section, (counts.get(page.section) ?? 0) + 1);
  const seen = new Map<string, number>();
  const numbered = pages.map((page) => {
    const n = (seen.get(page.section) ?? 0) + 1;
    seen.set(page.section, n);
    return {
      ...page,
      folio: `${page.section}${n}`,
      sectionPage: n,
      sectionCount: counts.get(page.section) ?? n,
    };
  });
  return numbered.map((page, i) => {
    if (page.kind !== "sport-front") return page;
    const sectionDesks = numbered.flatMap((p) =>
      p.kind === "sport-front" && p.section === page.section ? [{ focus: p.focus, folio: p.folio }] : [],
    );
    const nextFront = numbered.slice(i + 1).find((p) => p.kind === "sport-front" && p.section === page.section);
    return {
      ...page,
      sectionDesks,
      turn: nextFront && nextFront.kind === "sport-front" ? { folio: nextFront.folio, focus: nextFront.focus } : null,
    };
  });
}

/** True when a folio has something to print. Blank covers are never filed. */
export function editionPageHasInk(page: EditionPage): boolean {
  switch (page.kind) {
    case "favorites-front":
      return true;
    case "favorites-clubs":
      return true;
    case "favorites-form":
      return page.clubs.length > 0;
    case "favorites-inside":
      return Boolean(page.primary);
    case "favorites-continue":
      return page.jumps.length > 0;
    case "favorites-watch":
      return true;
    case "favorites-day":
      return page.events.length > 0 || (page.upcoming?.length ?? 0) > 0;
    case "favorites-beez":
      return true;
    case "favorites-races":
      return page.races.length > 0;
    case "sport-front":
      if (page.focus === "front" || page.focus === "recaps" || page.focus === "news" || page.focus === "opener") {
        return page.articles.length > 0 || page.clubs.length > 0;
      }
      return true;
    case "sport-inside":
      return Boolean(page.primary);
    case "national":
      return page.stories.length > 0;
    case "missouri":
      return page.items.length > 0;
    default:
      return true;
  }
}

export function dropEmptyFolios(edition: Edition): Edition {
  const pages = edition.pages.filter(editionPageHasInk);
  if (pages.length === edition.pages.length) return edition;
  const restamped = restampEditionPages(pages);
  const sportFolioByStory = { ...edition.sportFolioByStory };
  const favoriteFolioByStory = { ...edition.favoriteFolioByStory };
  for (const page of restamped) {
    if (page.kind === "sport-inside") {
      sportFolioByStory[page.primary.id] = page.folio;
      if (page.secondary) sportFolioByStory[page.secondary.id] = page.folio;
    }
    if (page.kind === "favorites-inside") {
      favoriteFolioByStory[page.primary.id] = page.folio;
      if (page.secondary) favoriteFolioByStory[page.secondary.id] = page.folio;
    }
    if (page.kind === "favorites-front") {
      for (const card of [page.lead, page.second, page.third]) {
        if (card) favoriteFolioByStory[card.id] = page.folio;
      }
    }
  }
  const sections = edition.sections
    .map((section) => {
      const index = restamped.findIndex((page) => page.section === section.code);
      return {
        ...section,
        pages: restamped.filter((page) => page.section === section.code).length,
        index: index < 0 ? section.index : index,
        folio: restamped.find((page) => page.section === section.code)?.folio ?? section.folio,
      };
    })
    .filter((section) => section.pages > 0);
  return { ...edition, pages: restamped, sections, sportFolioByStory, favoriteFolioByStory };
}

/**
 * Split standings desks onto continuation folios once the tables are on file.
 * Compose does not know the conference count; the client calls this after
 * the standings query lands. Story folios before the first teams desk keep
 * their place; later reference desks shift (CFB2 → CFB3…).
 */
export function paginateEditionDesks(
  edition: Edition,
  standingsByPath: Record<string, { length: number } | undefined> | null | undefined,
): Edition {
  const pages: EditionPage[] = [];
  for (const page of edition.pages) {
    if (page.kind === "sport-front" && page.focus === "teams") {
      const n = standingsByPath?.[page.path]?.length ?? 0;
      // A count of 0 is not a folio. Callers pass the tables the desk will
      // actually draw (offseason desks pass only the followed conferences),
      // so a slice past that list is never filed as a blank page.
      if (!n) continue;
      const per = page.path.includes("college-football") ? STAND_TABLES_PER_PAGE_COLLEGE : STAND_TABLES_PER_PAGE_PRO;
      const slices = planStandingsPages(n, per);
      for (const standSlice of slices) pages.push({ ...page, standSlice });
      continue;
    }
    pages.push(page);
  }
  const restamped = restampEditionPages(pages);
  const sportFolioByStory = { ...edition.sportFolioByStory };
  for (const page of restamped) {
    if (page.kind !== "sport-inside") continue;
    sportFolioByStory[page.primary.id] = page.folio;
    if (page.secondary) sportFolioByStory[page.secondary.id] = page.folio;
  }
  const sections = edition.sections.map((section) => {
    const index = restamped.findIndex((page) => page.section === section.code);
    return {
      ...section,
      pages: restamped.filter((page) => page.section === section.code).length,
      index: index < 0 ? section.index : index,
    };
  });
  return dropEmptyFolios({ ...edition, pages: restamped, sections, sportFolioByStory });
}
