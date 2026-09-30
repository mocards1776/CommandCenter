/**
 * Thompson Times sections.
 *
 * Section A is the clubs you follow. Every other section is one sport: MLB1
 * carries that league's schedule, stats, and a recap of every game, and MLB2
 * onward sets those recaps in full.
 */

import type { GameWrapCard } from "./newspaper-sports";
import type { WireGame } from "./newspaper-wire";

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

export type SportLeader = { name: string; line: string; href: string | null };

export type SportFrontPage = PageBase & {
  kind: "sport-front";
  path: string;
  games: WireGame[];
  spansDays: boolean;
  leaders: SportLeader[];
  recaps: { card: GameWrapCard; folio: string }[];
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
  games: number;
  recaps: number;
};

export type Edition = {
  pages: EditionPage[];
  sections: EditionSection[];
  /** Folio where a story's full sport-section recap is set. */
  sportFolioByStory: Record<string, string>;
  /** Folio where a favorite story is set in section A. */
  favoriteFolioByStory: Record<string, string>;
};

export function isFavoriteStory(card: GameWrapCard): boolean {
  return Boolean(card.favoriteKey || card.followed);
}

/** A result worth a recap column. A bare start time stays on the schedule. */
export function isRecapCard(card: GameWrapCard): boolean {
  const status = (card.status ?? "").trim();
  const scored = Boolean(card.scoreLine && /\d/.test(card.scoreLine));
  const hasBody = Boolean(card.body && card.body.trim().length >= 60);
  if (/^scheduled$/i.test(status)) return hasBody;
  if (/^\d{1,2}:\d{2}\s*(am|pm)\b/i.test(status) && !hasBody) return false;
  if (/final|postponed|suspended/i.test(status)) return true;
  if (hasBody) return true;
  // Still being played: the schedule line is the news until a recap is filed.
  if (/progress|halftime|end of|top |bottom |overtime|shootout|delayed/i.test(status)) return false;
  if (scored) return true;
  if (!status && card.favoriteKey && (card.won != null || Boolean(card.dek))) return true;
  return false;
}

/**
 * Bracket games belong above the fold. If none of the first `within` slots is
 * a postseason game, the best one is lifted into the last of them.
 */
function promotePostseason(cards: GameWrapCard[], within: number): GameWrapCard[] {
  if (cards.length <= within) return cards;
  if (cards.slice(0, within).some((c) => c.postseason)) return cards;
  const at = cards.findIndex((c, i) => i >= within && c.postseason);
  if (at < 0) return cards;
  const out = cards.slice();
  const [game] = out.splice(at, 1);
  out.splice(within - 1, 0, game!);
  return out;
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

function scheduleOrder(games: WireGame[]): WireGame[] {
  return [...games].sort((a, b) => {
    const byStart = String(a.startedAt ?? "").localeCompare(String(b.startedAt ?? ""));
    if (byStart) return byStart;
    return a.id.localeCompare(b.id);
  });
}

function slateLeaders(games: WireGame[]): SportLeader[] {
  const out: SportLeader[] = [];
  const seen = new Set<string>();
  for (const game of games) {
    for (const leader of game.leaders) {
      const key = leader.name.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ name: leader.name, line: leader.line, href: leader.href });
    }
  }
  return out.slice(0, 12);
}

/** Recaps in a sport section are the games on that board, not another league's clip. */
function boardStories(path: string, board: WireGame[], stories: GameWrapCard[]): GameWrapCard[] {
  const mine = stories.filter((story) => story.leaguePath === path);
  if (!board.length) return mine;
  const eventIds = new Set(board.map((game) => game.eventId));
  return mine.filter(
    (story) => story.id.startsWith("wire-") || (story.gameId != null && eventIds.has(story.gameId)),
  );
}

/** Stories the front page sets before section A turns inside. */
const FRONT_STORIES = 3;
const FRONT_BRIEFS = 4;

function favoritePages(stories: GameWrapCard[]): {
  pages: (FavoritesFrontPage | FavoritesInsidePage)[];
  favoriteFolioByStory: Record<string, string>;
} {
  const ordered = promotePostseason(
    stories.filter((card) => isFavoriteStory(card) && isRecapCard(card)),
    FRONT_STORIES,
  );
  const favoriteFolioByStory: Record<string, string> = {};
  for (const card of ordered.slice(0, FRONT_STORIES)) favoriteFolioByStory[card.id] = "A1";

  const inside: FavoritesInsidePage[] = [];
  const rest = ordered.slice(FRONT_STORIES);
  let cursor = 0;
  let n = 2;
  while (cursor < rest.length) {
    const primary = rest[cursor]!;
    const secondary = rest[cursor + 1];
    const briefs = rest.slice(cursor + 2, cursor + 2 + FRONT_BRIEFS);
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
    lead: ordered[0] ?? null,
    second: ordered[1] ?? null,
    third: ordered[2] ?? null,
    briefs: ordered.slice(FRONT_STORIES, FRONT_STORIES + 5),
    news: ordered,
  };
  return { pages: stampCounts([front, ...inside]), favoriteFolioByStory };
}

function sportPages(id: SportSectionId, games: WireGame[], stories: GameWrapCard[]): {
  pages: (SportFrontPage | SportInsidePage)[];
  sportFolioByStory: Record<string, string>;
  recapCount: number;
} {
  const recaps = promotePostseason(stories.filter(isRecapCard), 2);
  const inside: SportInsidePage[] = [];
  const sportFolioByStory: Record<string, string> = {};
  let n = 2;
  for (let i = 0; i < recaps.length; i += 2) {
    const primary = recaps[i]!;
    const secondary = recaps[i + 1];
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
    games: scheduleOrder(games),
    spansDays: new Set(games.map((g) => g.day)).size > 1,
    leaders: slateLeaders(games),
    recaps: recaps.map((card) => ({
      card,
      folio: sportFolioByStory[card.id] ?? frontFolio,
    })),
  };

  return {
    pages: stampCounts([front, ...inside]),
    sportFolioByStory,
    recapCount: recaps.length,
  };
}

export function buildEdition(opts: { stories: GameWrapCard[]; games: WireGame[] }): Edition {
  const { stories, games } = opts;
  const favorites = favoritePages(stories);

  const paths = new Set<string>();
  for (const game of games) if (game.path) paths.add(game.path);
  for (const story of stories) if (story.leaguePath) paths.add(story.leaguePath);

  const ids = uniqueCodes(
    [...paths]
      .map(sportSectionId)
      .sort((a, b) => a.order - b.order || a.code.localeCompare(b.code)),
  );

  const gamesBy = new Map<string, WireGame[]>();
  for (const game of games) {
    const list = gamesBy.get(game.path) ?? [];
    list.push(game);
    gamesBy.set(game.path, list);
  }
  const storiesBy = new Map<string, GameWrapCard[]>();
  for (const story of stories) {
    if (!story.leaguePath) continue;
    const list = storiesBy.get(story.leaguePath) ?? [];
    list.push(story);
    storiesBy.set(story.leaguePath, list);
  }

  const pages: EditionPage[] = [...favorites.pages];
  const sections: EditionSection[] = [
    {
      code: "A",
      title: "Favorite Teams",
      folio: "A1",
      index: 0,
      games: games.filter((g) => g.favoriteKeys.length > 0).length,
      recaps: stories.filter((card) => isFavoriteStory(card) && isRecapCard(card)).length,
    },
  ];
  const sportFolioByStory: Record<string, string> = {};

  for (const id of ids) {
    const board = gamesBy.get(id.path) ?? [];
    const built = sportPages(id, board, boardStories(id.path, board, storiesBy.get(id.path) ?? []));
    sections.push({
      code: id.code,
      title: id.title,
      folio: `${id.code}1`,
      index: pages.length,
      games: (gamesBy.get(id.path) ?? []).length,
      recaps: built.recapCount,
    });
    Object.assign(sportFolioByStory, built.sportFolioByStory);
    pages.push(...built.pages);
  }

  return {
    pages,
    sections,
    sportFolioByStory,
    favoriteFolioByStory: favorites.favoriteFolioByStory,
  };
}
