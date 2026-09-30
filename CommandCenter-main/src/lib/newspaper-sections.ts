/**
 * Thompson Times sections.
 *
 * Section A is the clubs you follow — a front, a clubs desk, then inside
 * story / club-form pages. Every sport section always runs at least five
 * pages: news, recaps, all-teams, schedule, and club form — then full
 * story pages when copy exists.
 */

import {
  editionCovers,
  editionCoversRecent,
  editionCoversResult,
  editionNewsDay,
  favoriteDeskWeight,
  instantDay,
  isResultCopy,
} from "./newspaper.ts";
import type { GameWrapCard } from "./newspaper-sports";

const KNOWN: Record<string, { code: string; title: string; order: number }> = {
  "baseball/mlb": { code: "MLB", title: "Major League Baseball", order: 10 },
  "football/nfl": { code: "NFL", title: "National Football League", order: 20 },
  "football/college-football": { code: "CFB", title: "College Football", order: 30 },
  "hockey/nhl": { code: "NHL", title: "National Hockey League", order: 40 },
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

export type DeskRow = {
  rank: string;
  team: string;
  record: string;
  gb: string;
  me: boolean;
  logo?: string | null;
  teamId?: string | null;
};

export type DeskStat = { label: string; value: string };

export type DeskLeader = { name: string; line: string; href: string | null };

export type DeskFixture = {
  id: string;
  team: string;
  label: string;
  when: string | null;
  detail: string | null;
};

/** One followed club, as the sport section's agate. */
export type ClubDesk = {
  key: string;
  shortName: string;
  logo: string | null;
  leaguePath: string | null;
  record: string | null;
  standing: string | null;
  division: DeskRow[];
  stats: DeskStat[];
  leaders: DeskLeader[];
  upcoming: { id: string; label: string; when: string | null; detail: string | null }[];
};

export type SportFocus = "news" | "recaps" | "teams" | "schedule" | "form" | "playoffs";

export type SportFrontPage = PageBase & {
  kind: "sport-front";
  path: string;
  /** Which desk this page owns — each sport always prints at least five. */
  focus: SportFocus;
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

export type EditionPage =
  | FavoritesFrontPage
  | FavoritesClubsPage
  | FavoritesFormPage
  | FavoritesInsidePage
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
export function isDeskStory(card: GameWrapCard): boolean {
  if (card.id.startsWith("league-")) return Boolean(card.headline && card.leaguePath);
  if (!isFavoriteStory(card)) return false;
  if (card.id.startsWith("news-")) return Boolean(card.headline);
  if ((card.body?.trim().length ?? 0) >= 80) return true;
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

export function isRecapStory(card: GameWrapCard): boolean {
  return isResultCopy({
    headline: card.headline,
    dek: card.dek,
    status: card.status,
    scoreLine: card.scoreLine,
    type: card.id.startsWith("news-") || card.id.startsWith("league-") ? card.status : null,
  });
}

/** Last night's result outranks a feature; home clubs outrank the rest. */
function storyRank(card: GameWrapCard, edition: string): number {
  const day = card.when ? instantDay(card.when) : null;
  let score = 0;
  if (day === editionNewsDay(edition) && card.status && /final/i.test(card.status)) score += 100;
  if (card.postseason) score += 40;
  if (card.id.startsWith("news-")) score += 25;
  if (card.id.startsWith("league-")) score += 10;
  if (isRecapStory(card)) score += 20;
  if ((card.body?.length ?? 0) >= 400) score += 15;
  // Cardinals / Blues / Mizzou lead Section A; Lions, Chiefs, soccer follow.
  if (card.favoriteKey) score += favoriteDeskWeight(card.favoriteKey);
  return score;
}

function rankStories(cards: GameWrapCard[], edition: string): GameWrapCard[] {
  return [...cards].sort((a, b) => {
    const byRank = storyRank(b, edition) - storyRank(a, edition);
    if (byRank) return byRank;
    return String(b.when ?? "").localeCompare(String(a.when ?? ""));
  });
}

function stampCounts<T extends PageBase>(pages: T[]): T[] {
  const count = pages.length;
  return pages.map((page, i) => ({
    ...page,
    sectionCount: count,
    jumpFolio: pages[i + 1]?.folio,
  }));
}

function uniqueCodes(ids: SportSectionId[]): SportSectionId[] {
  const used = new Set<string>(["A"]);
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
      detail: game.detail,
    })),
  );
}

function chunkClubs(clubs: ClubDesk[], size: number): ClubDesk[][] {
  if (!clubs.length) return [];
  const out: ClubDesk[][] = [];
  for (let i = 0; i < clubs.length; i += size) out.push(clubs.slice(i, i + size));
  return out;
}

function inFreshWindow(card: GameWrapCard, edition: string): boolean {
  return isRecapStory(card)
    ? editionCoversResult(card.when, edition)
    : editionCovers(card.when, edition);
}

function inSectionWindow(card: GameWrapCard, edition: string): boolean {
  // Two-day lookback keeps the paper fresh; older previews stay off the desk.
  return editionCoversRecent(card.when, edition, 2);
}

/** Collapse near-duplicate wires (same game / same head stem). */
export function dedupeStories(stories: GameWrapCard[]): GameWrapCard[] {
  const seen = new Set<string>();
  const out: GameWrapCard[] = [];
  for (const card of stories) {
    const head = card.headline
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .slice(0, 56);
    const keys = [card.gameId ? `g:${card.gameId}` : "", head].filter(Boolean);
    if (keys.some((k) => seen.has(k))) continue;
    for (const k of keys) seen.add(k);
    out.push(card);
  }
  return out;
}

function isStalePreview(card: GameWrapCard, edition: string): boolean {
  if (isRecapStory(card)) return false;
  const hay = `${card.headline} ${card.status ?? ""} ${card.dek ?? ""}`;
  if (!/\bpreview\b|\bbreak skid\b|\blook to\b|\binto game\b|\bprobable\b/i.test(hay)) {
    return false;
  }
  return !editionCovers(card.when, edition);
}

function favoritePages(
  freshStories: GameWrapCard[],
  sectionStories: GameWrapCard[],
  clubs: ClubDesk[],
): {
  pages: (FavoritesFrontPage | FavoritesClubsPage | FavoritesFormPage | FavoritesInsidePage)[];
  favoriteFolioByStory: Record<string, string>;
} {
  const favoriteFolioByStory: Record<string, string> = {};
  for (const card of freshStories.slice(0, FRONT_STORIES)) favoriteFolioByStory[card.id] = "A1";

  const inside: FavoritesInsidePage[] = [];
  // Prefer fresh overflow, then recent section copy not already on the front.
  const frontIds = new Set(freshStories.slice(0, FRONT_STORIES).map((c) => c.id));
  const restPool = [
    ...freshStories.slice(FRONT_STORIES),
    ...sectionStories.filter((c) => !frontIds.has(c.id) && !freshStories.slice(FRONT_STORIES).some((f) => f.id === c.id)),
  ];
  let cursor = 0;
  let n = 3; // A2 is clubs desk; insides / form start at A3
  while (cursor < restPool.length) {
    const primary = restPool[cursor]!;
    const secondary = restPool[cursor + 1];
    const briefs = restPool.slice(cursor + 2, cursor + 2 + FRONT_BRIEFS);
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
    cursor += 2 + briefs.length;
    n += 1;
  }

  const front: FavoritesFrontPage = {
    kind: "favorites-front",
    folio: "A1",
    section: "A",
    sectionTitle: "Favorite Teams",
    sectionPage: 1,
    sectionCount: 0,
    jumpFolio: "A2",
    lead: freshStories[0] ?? sectionStories[0] ?? null,
    second: freshStories[1] ?? sectionStories[1] ?? null,
    third: freshStories[2] ?? sectionStories[2] ?? null,
    briefs: (freshStories.length ? freshStories : sectionStories).slice(FRONT_STORIES, FRONT_STORIES + 6),
    news: freshStories.length ? freshStories : sectionStories,
  };

  const clubsPage: FavoritesClubsPage = {
    kind: "favorites-clubs",
    folio: "A2",
    section: "A",
    sectionTitle: "Favorite Teams",
    sectionPage: 2,
    sectionCount: 0,
  };

  const pages: (FavoritesFrontPage | FavoritesClubsPage | FavoritesFormPage | FavoritesInsidePage)[] = [
    front,
    clubsPage,
    ...inside,
  ];

  // Pad to the minimum with deep club-form pages (standings + slate).
  // Home clubs (Cardinals / Blues / Mizzou) before Lions, Chiefs, soccer.
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

  return {
    pages: stampCounts(pages),
    favoriteFolioByStory,
  };
}

function sportPages(
  id: SportSectionId,
  clubs: ClubDesk[],
  stories: GameWrapCard[],
  edition: string,
): {
  pages: (SportFrontPage | SportInsidePage)[];
  sportFolioByStory: Record<string, string>;
} {
  const upcoming = upcomingFor(clubs);
  const sportFolioByStory: Record<string, string> = {};
  const unique = dedupeStories(stories.filter((card) => !isStalePreview(card, edition)));
  const isMlb = id.path === "baseball/mlb";
  const deskCount = 5;
  const inside: SportInsidePage[] = [];
  let n = deskCount + 1;
  for (let i = 0; i < unique.length; i += 2) {
    const primary = unique[i]!;
    const secondary = unique[i + 1];
    const folio = `${id.code}${n}`;
    sportFolioByStory[primary.id] = folio;
    if (secondary) sportFolioByStory[secondary.id] = folio;
    inside.push({
      kind: "sport-inside",
      folio,
      section: id.code,
      sectionTitle: id.title,
      sectionPage: n,
      sectionCount: 0,
      path: id.path,
      primary,
      secondary,
    });
    n += 1;
  }

  const articles = unique.map((card) => ({
    card,
    folio: sportFolioByStory[card.id] ?? `${id.code}${deskCount + 1}`,
  }));
  // News desk shows a capped, deduped set so the grid cannot collapse.
  const newsArticles = articles.slice(0, 8);
  const recaps = unique.filter(isRecapStory).map((card) => ({
    card,
    folio: sportFolioByStory[card.id] ?? `${id.code}${deskCount + 1}`,
  }));
  const recapArticles = (recaps.length ? recaps : articles).slice(0, 8);

  const base = {
    section: id.code,
    sectionTitle: id.title,
    sectionCount: 0,
    path: id.path,
    clubs,
    upcoming,
  };

  const news: SportFrontPage = {
    ...base,
    kind: "sport-front",
    folio: `${id.code}1`,
    sectionPage: 1,
    focus: "news",
    articles: newsArticles,
  };
  const recapPage: SportFrontPage = {
    ...base,
    kind: "sport-front",
    folio: `${id.code}2`,
    sectionPage: 2,
    focus: "recaps",
    articles: recapArticles,
  };
  const teams: SportFrontPage = {
    ...base,
    kind: "sport-front",
    folio: `${id.code}3`,
    sectionPage: 3,
    focus: "teams",
    articles,
  };
  const schedule: SportFrontPage = {
    ...base,
    kind: "sport-front",
    folio: `${id.code}4`,
    sectionPage: 4,
    focus: "schedule",
    articles,
  };
  // MLB prints the playoff tree as page 5; other sports keep the league form desk.
  const fifth: SportFrontPage = {
    ...base,
    kind: "sport-front",
    folio: `${id.code}5`,
    sectionPage: 5,
    focus: isMlb ? "playoffs" : "form",
    articles,
  };

  return {
    pages: stampCounts([news, recapPage, teams, schedule, fifth, ...inside]),
    sportFolioByStory,
  };
}

export function buildEdition(opts: {
  stories: GameWrapCard[];
  clubs: ClubDesk[];
  edition: string;
}): Edition {
  const desk = opts.stories.filter(isDeskStory);
  const fresh = rankStories(
    desk.filter((card) => inFreshWindow(card, opts.edition)),
    opts.edition,
  );
  const recent = rankStories(
    desk.filter((card) => inSectionWindow(card, opts.edition)),
    opts.edition,
  );
  // Prefer recent for packing; fall back to fresh if the lookback is empty.
  const sectionCopy = recent.length ? recent : fresh;

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
  const storiesBy = new Map<string, GameWrapCard[]>();
  for (const story of sectionCopy) {
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
    ),
  }));
  const sportFolioByStory: Record<string, string> = {};
  for (const part of sportPagesBuilt) Object.assign(sportFolioByStory, part.built.sportFolioByStory);

  const favoriteFresh = fresh.filter(isFavoriteStory);
  const favoriteRecent = sectionCopy.filter(isFavoriteStory);
  const favorites = favoritePages(favoriteFresh, favoriteRecent, opts.clubs);

  const pages: EditionPage[] = [...favorites.pages];
  const sections: EditionSection[] = [
    {
      code: "A",
      title: "Favorite Teams",
      folio: "A1",
      index: 0,
      stories: favoriteRecent.length,
      upcoming: opts.clubs.reduce((n, club) => n + Math.min(1, club.upcoming.length), 0),
      pages: favorites.pages.length,
    },
  ];

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
