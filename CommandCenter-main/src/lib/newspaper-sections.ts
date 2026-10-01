/**
 * Thompson Times sections.
 *
 * Section A is the clubs you follow — a front, a clubs desk, then inside
 * story / club-form pages. Every sport section always runs at least five
 * pages: league news, scores, standings, schedule, and playoffs or form —
 * then full story pages for league copy. Followed-club stories run in
 * Section A only.
 */

import {
  editionCovers,
  editionCoversRecent,
  editionCoversResult,
  editionNewsDay,
  favoriteDeskWeight,
  instantDay,
  isNewsMuted,
  isResultCopy,
  splitStoryCopy,
} from "./newspaper.ts";
import type { GameWrapCard } from "./newspaper-sports";
import type { MissouriDesk, MoItem } from "./newspaper-missouri";

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
  division: DeskRow[];
  stats: DeskStat[];
  leaders: DeskLeader[];
  upcoming: { id: string; label: string; when: string | null; detail: string | null }[];
};

export type SportFocus = "news" | "recaps" | "teams" | "schedule" | "form" | "playoffs" | "players" | "opener";

export type SportFrontPage = PageBase & {
  kind: "sport-front";
  path: string;
  /** Which desk this page owns — each sport always prints at least five. */
  focus: SportFocus;
  /** Between seasons: no scores or form, a countdown to opening night instead. */
  offseason?: boolean;
  /** The next desk in this section, for the page's turn line. */
  turn?: { folio: string; focus: SportFocus } | null;
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

export type EditionPage =
  | MissouriPage
  | FavoritesFrontPage
  | FavoritesClubsPage
  | FavoritesFormPage
  | FavoritesInsidePage
  | FavoritesContinuePage
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

/** Enough body to set as an article rather than a brief. */
export const STORY_COPY_MIN = 400;

export function hasStoryCopy(card: GameWrapCard): boolean {
  return (card.body?.trim().length ?? 0) >= STORY_COPY_MIN;
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
function storyRank(card: GameWrapCard, edition: string): number {
  const day = card.when ? instantDay(card.when) : null;
  let score = 0;
  if (isPreviewStory(card)) score -= 150;
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
  // Preserve author-set jumps (story continuations). Never invent a "next page"
  // jump — that is what made "turn to A4" land on the wrong copy.
  return pages.map((page) => ({
    ...page,
    sectionCount: count,
  }));
}

/** Plain story body used for front tease / continuation (no agate notes). */
export function storyBodyForJump(card: GameWrapCard): string {
  const body = (card.body || "").trim();
  if (body.length >= 40) return body;
  return [card.dek, card.scoreLine, card.headline].filter(Boolean).join(" ").trim();
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
  pages: (
    | FavoritesFrontPage
    | FavoritesClubsPage
    | FavoritesFormPage
    | FavoritesInsidePage
    | FavoritesContinuePage
  )[];
  favoriteFolioByStory: Record<string, string>;
} {
  const favoriteFolioByStory: Record<string, string> = {};
  const freshIds = new Set(freshStories.map((c) => c.id));
  const frontPool = [...freshStories, ...sectionStories.filter((c) => !freshIds.has(c.id))];
  const picks: GameWrapCard[] = [];
  const clubOf = (c: GameWrapCard) => c.favoriteKey ?? c.teamName ?? c.id;
  // A video stub or one-line note leaves a column of bare photo on the front.
  const written = frontPool.filter((c) => hasStoryCopy(c) && !isPreviewStory(c));
  for (const card of written) {
    if (picks.length >= 3) break;
    if (!picks.some((f) => clubOf(f) === clubOf(card))) picks.push(card);
  }
  for (const card of [...written, ...frontPool]) {
    if (picks.length >= 3) break;
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
    briefs: (freshStories.length ? freshStories : sectionStories).slice(
      FRONT_STORIES,
      FRONT_STORIES + 6,
    ),
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
  withPlayers = false,
  offseason = false,
): {
  pages: (SportFrontPage | SportInsidePage)[];
  sportFolioByStory: Record<string, string>;
} {
  const upcoming = upcomingFor(clubs);
  const sportFolioByStory: Record<string, string> = {};
  const unique = dedupeStories(stories.filter((card) => !isStalePreview(card, edition)));
  const isMlb = id.path === "baseball/mlb";
  const focuses: SportFocus[] = offseason
    ? ["news", "opener", "teams", ...(withPlayers ? (["players"] as const) : [])]
    : ["news", "recaps", "teams", "schedule", isMlb ? "playoffs" : "form", ...(withPlayers ? (["players"] as const) : [])];
  const deskCount = focuses.length;
  const inside: SportInsidePage[] = [];
  const full = unique.filter(hasStoryCopy);
  let n = deskCount + 1;
  for (let i = 0; i < full.length; i += 2) {
    const primary = full[i]!;
    const secondary = full[i + 1];
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

  // A brief with no story page opens in the reader; its folio is its own desk.
  const articles = unique.map((card) => ({
    card,
    folio: sportFolioByStory[card.id] ?? `${id.code}1`,
  }));
  const newsArticles = articles.slice(0, 12);
  const recapArticles = articles.filter((a) => isRecapStory(a.card)).slice(0, 8);

  const desks: SportFrontPage[] = focuses.map((focus, i) => ({
    section: id.code,
    sectionTitle: id.title,
    sectionCount: 0,
    path: id.path,
    clubs,
    upcoming,
    kind: "sport-front",
    folio: `${id.code}${i + 1}`,
    sectionPage: i + 1,
    focus,
    offseason,
    turn: focuses[i + 1] ? { folio: `${id.code}${i + 2}`, focus: focuses[i + 1]! } : null,
    articles: focus === "news" ? newsArticles : focus === "recaps" ? recapArticles : articles,
  }));

  return {
    pages: stampCounts([...desks, ...inside]),
    sportFolioByStory,
  };
}

const MO_FRONT = 11;
const MO_PAGE = 16;

function missouriPages(desk: MissouriDesk | null): MissouriPage[] {
  if (!desk?.items.length) return [];
  const chunks: MoItem[][] = [desk.items.slice(0, MO_FRONT)];
  for (let i = MO_FRONT; i < desk.items.length && chunks.length < 3; i += MO_PAGE) {
    chunks.push(desk.items.slice(i, i + MO_PAGE));
  }
  return stampCounts(
    chunks.map((items, i) => ({
      kind: "missouri" as const,
      folio: `MO${i + 1}`,
      section: "MO",
      sectionTitle: "Missouri",
      sectionPage: i + 1,
      sectionCount: 0,
      items,
      listen: i === 0 ? desk.listen : [],
    })),
  );
}

export function buildEdition(opts: {
  stories: GameWrapCard[];
  clubs: ClubDesk[];
  edition: string;
  /** League paths with followed or tagged players — each gets a "Your players" desk. */
  playerPaths?: string[];
  missouri?: MissouriDesk | null;
  /** League paths between seasons. */
  offseason?: string[];
}): Edition {
  const desk = dedupeStories(opts.stories.filter((card) => isDeskStory(card) && !isNewsMuted(card)));
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
  // Your clubs are Section A's beat. Sport sections carry the rest of the league.
  const storiesBy = new Map<string, GameWrapCard[]>();
  for (const story of sectionCopy) {
    if (!story.leaguePath || isFavoriteStory(story)) continue;
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
    ),
  }));
  const sportFolioByStory: Record<string, string> = {};
  for (const part of sportPagesBuilt) Object.assign(sportFolioByStory, part.built.sportFolioByStory);

  const favoriteFresh = fresh.filter(isFavoriteStory);
  const favoriteRecent = sectionCopy.filter(isFavoriteStory);
  // A followed club that went quiet (off day, season just ended) still gets its latest story.
  const covered = new Set(favoriteRecent.map((c) => c.favoriteKey));
  const lastWord = rankStories(
    desk.filter(
      (c) =>
        isFavoriteStory(c) &&
        c.favoriteKey &&
        !covered.has(c.favoriteKey) &&
        !isStalePreview(c, opts.edition) &&
        editionCoversRecent(c.when, opts.edition, 7),
    ),
    opts.edition,
  ).filter((c) => {
    if (covered.has(c.favoriteKey)) return false;
    covered.add(c.favoriteKey);
    return true;
  });
  favoriteRecent.push(...lastWord);
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

  const mo = missouriPages(opts.missouri ?? null);
  if (mo.length) {
    sections.push({
      code: "MO",
      title: "Missouri",
      folio: "MO1",
      index: pages.length,
      stories: mo.reduce((n, p) => n + p.items.length, 0),
      upcoming: 0,
      pages: mo.length,
    });
    pages.push(...mo);
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
