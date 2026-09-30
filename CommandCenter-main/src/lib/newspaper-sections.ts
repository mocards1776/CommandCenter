/**
 * Thompson Times sections.
 *
 * Section A is the clubs you follow: the freshest stories, then a jump into
 * the sport. Each sport section is that league's desk — news about your
 * clubs, their standings and season stats, and the games still to be played.
 * A result from the weekend is a previous edition.
 */

import { editionCovers, editionCoversResult, editionNewsDay, instantDay, isResultCopy } from "./newspaper.ts";
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

export type SportFrontPage = PageBase & {
  kind: "sport-front";
  path: string;
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
 * needs a score. A fetched story needs a body.
 */
export function isDeskStory(card: GameWrapCard): boolean {
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

/** Last night's result outranks a feature; newer copy outranks older copy. */
function storyRank(card: GameWrapCard, edition: string): number {
  const day = card.when ? instantDay(card.when) : null;
  let score = 0;
  if (day === editionNewsDay(edition) && card.status && /final/i.test(card.status)) score += 100;
  if (card.postseason) score += 40;
  if (card.id.startsWith("news-")) score += 25;
  if ((card.body?.length ?? 0) >= 400) score += 15;
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

function sportPages(
  id: SportSectionId,
  clubs: ClubDesk[],
  stories: GameWrapCard[],
): {
  pages: (SportFrontPage | SportInsidePage)[];
  sportFolioByStory: Record<string, string>;
} {
  const inside: SportInsidePage[] = [];
  const sportFolioByStory: Record<string, string> = {};
  let n = 2;
  for (let i = 0; i < stories.length; i += 2) {
    const primary = stories[i]!;
    const secondary = stories[i + 1];
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

  const frontFolio = `${id.code}1`;
  const front: SportFrontPage = {
    kind: "sport-front",
    folio: frontFolio,
    section: id.code,
    sectionTitle: id.title,
    sectionPage: 1,
    sectionCount: 0,
    path: id.path,
    clubs,
    upcoming: clubs.flatMap((club) =>
      club.upcoming.map((game) => ({
        id: game.id,
        team: club.shortName,
        label: game.label,
        when: game.when,
        detail: game.detail,
      })),
    ),
    articles: stories.map((card) => ({
      card,
      folio: sportFolioByStory[card.id] ?? frontFolio,
    })),
  };

  return {
    pages: stampCounts([front, ...inside]),
    sportFolioByStory,
  };
}

export function buildEdition(opts: {
  stories: GameWrapCard[];
  clubs: ClubDesk[];
  edition: string;
}): Edition {
  const fresh = rankStories(
    opts.stories.filter((card) => {
      if (!isDeskStory(card)) return false;
      const result = isResultCopy({
        headline: card.headline,
        dek: card.dek,
        status: card.status,
        scoreLine: card.scoreLine,
        type: card.id.startsWith("news-") ? card.status : null,
      });
      return result
        ? editionCoversResult(card.when, opts.edition)
        : editionCovers(card.when, opts.edition);
    }),
    opts.edition,
  );

  const paths = new Set<string>();
  for (const club of opts.clubs) if (club.leaguePath) paths.add(club.leaguePath);
  for (const story of fresh) if (story.leaguePath) paths.add(story.leaguePath);

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
  for (const story of fresh) {
    if (!story.leaguePath) continue;
    const list = storiesBy.get(story.leaguePath) ?? [];
    list.push(story);
    storiesBy.set(story.leaguePath, list);
  }

  const sportPagesBuilt = ids.map((id) => ({
    id,
    built: sportPages(id, clubsBy.get(id.path) ?? [], storiesBy.get(id.path) ?? []),
  }));
  const sportFolioByStory: Record<string, string> = {};
  for (const part of sportPagesBuilt) Object.assign(sportFolioByStory, part.built.sportFolioByStory);

  const favoriteFolioByStory: Record<string, string> = {};
  for (const card of fresh) favoriteFolioByStory[card.id] = "A1";

  const front: FavoritesFrontPage = {
    kind: "favorites-front",
    folio: "A1",
    section: "A",
    sectionTitle: "Favorite Teams",
    sectionPage: 1,
    sectionCount: 1,
    jumpFolio: fresh[0] ? sportFolioByStory[fresh[0].id] : undefined,
    lead: fresh[0] ?? null,
    second: fresh[1] ?? null,
    third: fresh[2] ?? null,
    briefs: fresh.slice(FRONT_STORIES, FRONT_STORIES + 5),
    news: fresh,
  };

  const pages: EditionPage[] = [front];
  const sections: EditionSection[] = [
    {
      code: "A",
      title: "Favorite Teams",
      folio: "A1",
      index: 0,
      stories: fresh.length,
      upcoming: opts.clubs.reduce((n, club) => n + Math.min(1, club.upcoming.length), 0),
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
    });
    pages.push(...part.built.pages);
  }

  return { pages, sections, sportFolioByStory, favoriteFolioByStory };
}
