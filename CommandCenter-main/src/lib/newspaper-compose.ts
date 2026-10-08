/**
 * One press run. The page and the scheduled desk both set an edition through here,
 * so the paper that is waiting and the paper that prints while you read are the same.
 */
import { fileEditionStories, fileMissouriItems, isNewsMuted, missouriItemInEdition } from "./newspaper";
import { fetchLeagueArticles, fetchTeamArticles } from "./newspaper-news";
import { applyTableStandings, fetchLeagueLeaders, fetchSectionBoard, fetchSectionStandings, type StandGroup } from "./newspaper-box";
import { fetchHeismanOdds } from "./newspaper-heisman";
import { fetchClubSheet } from "./newspaper-clubsheet";
import { enrichMissouriItems, fetchMissouriDesk, fetchMissouriScout } from "./newspaper-missouri-fetch";
import type { MoItem } from "./newspaper-missouri";
import { fetchMlbtr } from "./newspaper-mlbtr";
import { fetchPowerMizzou } from "./newspaper-powermizzou";
import { fetchOpener, type Opener } from "./newspaper-openers";
import { attachRelatedGameCopy, attachRelatedGameCopyStep } from "./newspaper-sport-desk";
import { cleanStoryCopy, htmlToNewspaperText, isNavSoup, isPeripheralClubStory, isPrintableStoryBody, killedSource, stampBodyChars, truncateAtSentence } from "./newspaper-copy";
import { isBoilerplateDek, storySource } from "./newspaper-source";
import {
  attachFavoriteRecapChrome,
  buildGameWrapCards,
  buildTeamInfoboxes,
  collectWrapFeeds,
  enrichWrapBodies,
  leaguePathFromEspn,
  mergeStoryCards,
  tagFavoriteStories,
  wireStoryCards,
  wrapFeedsForFavorites,
  type GameWrapCard,
} from "./newspaper-sports";
import {
  enrichWireStories,
  fetchLeagueClubs,
  fetchLeagueSlate,
  fetchNewspaperWire,
  logWireFiling,
  markFavoriteClubs,
  tallyWireGames,
  type NewspaperWire,
} from "./newspaper-wire";
import { fetchMlbPlayoffTree } from "./mlb";
import { pickBestStoryImage } from "./newspaper-images.ts";
import { fetchRssArticle, fetchRssFeed, firstContentImageUrl, type RssArticle } from "./rss";
import {
  DEFAULT_FAVORITES,
  fetchTeamDetail,
  fetchTeamSnapshot,
  visibleFavorites,
  type SportsFavorite,
  type SportsLayout,
  type TeamDetail,
} from "./sports";
import { fetchMarshfieldWeather } from "./newspaper-weather";
import { fetchWatchList, WATCH_PAGE_GAMES, type WatchGame } from "./newspaper-watch";
import { fetchYesterdayRecap, type YesterdayRecap } from "./yesterday-recap";
import { ISSUE_VERSION, type PrintedIssue, type PrintedQuery } from "./newspaper-issue";
import { clearEditorStamps, editEdition, type EditorRequest } from "./newspaper-editor";
import { deskCopyQueue, dedupePush, essentialsFromDesks, finishDedupe } from "./newspaper-sections";
import { fetchFavoriteCoachDesk, printsFavoriteCoaches } from "./newspaper-favorite-coaches";
import {
  checkpointBag,
  DROP_AFTER_BOARD_DESKS,
  DROP_AFTER_FILE_DESKS,
  DROP_AFTER_GATHER,
  dropBagKeys,
  hopSignature,
} from "./newspaper-press-bag";

export { advanceStuckBag, checkpointBag, hopSignature, mergeFinalizeQueries } from "./newspaper-press-bag";

/** Soft ceiling for CPU work in one isolate. Edge kills the hop at ~2,000 ms. */
export const HOP_BUDGET_MS = 1_200;

export function deskFavorites(order: string[] | null | undefined, hidden: string[] | null | undefined): SportsFavorite[] {
  const layout: SportsLayout = {
    order: order?.length ? order : DEFAULT_FAVORITES.map((f) => f.key),
    hidden: hidden ?? [],
    pinnedPlayers: [],
  };
  return visibleFavorites(layout).filter((f) => f.kind === "team");
}

export function sportPathsOf(favs: { espnPath: string }[]): string[] {
  return [...new Set(favs.map((f) => leaguePathFromEspn(f.espnPath)).filter((p): p is string => Boolean(p)))].sort();
}

export function urlsToExtract(cards: GameWrapCard[]): string[] {
  return cards
    .filter(
      (card) =>
        (card.favoriteKey ||
          card.followed ||
          card.caption === "The Athletic" ||
          card.sportLabel === "National" ||
          card.sportLabel === "Missouri") &&
        card.wrapHref &&
        /^https?:\/\//i.test(card.wrapHref) &&
        !/espn\.com\/.+\/(?:game|recap|preview|match)\b/i.test(card.wrapHref) &&
        ((card.body?.trim().length ?? 0) < 600 || !card.photo),
    )
    .map((card) => card.wrapHref!)
    .slice(0, 20);
}

function runnable(card: GameWrapCard): boolean {
  if (killedSource(card.wrapHref) || killedSource(card.feedUrl) || killedSource(card.gameHref)) return false;
  if (isPeripheralClubStory(card)) return false;
  return true;
}

/** Keep the author in the filed copy so the credit line can lift it on the page. */
function filedBody(card: GameWrapCard, text: string | null | undefined): string | null {
  const cleaned = cleanStoryCopy(text);
  if (!cleaned.text) return null;
  if (!cleaned.author) return cleaned.text;
  const outlet = storySource(card) ?? "Wire";
  return `${cleaned.author} | ${outlet} ${cleaned.text}`;
}

/** Article text the press bag keeps after fetch — no raw HTML. */
export type PressExtract = {
  url?: string;
  title?: string | null;
  byline?: string | null;
  image?: string | null;
  /** Image lifted from article HTML at fetch time so the bag can drop HTML. */
  contentImage?: string | null;
  contentText?: string;
  contentHtml?: string;
  wordCount?: number;
};

export function slimFetchedArticle(article: RssArticle): PressExtract {
  const contentText = article.contentHtml ? htmlToNewspaperText(article.contentHtml) : article.contentText;
  return {
    url: article.url,
    title: article.title,
    byline: article.byline,
    image: article.image,
    contentImage: firstContentImageUrl(article.contentHtml),
    contentText,
    wordCount: article.wordCount,
  };
}

export function fileExtracts(cards: GameWrapCard[], extracts: Record<string, PressExtract> | undefined): GameWrapCard[] {
  const clean = cards.filter(runnable).map((card) => {
    const dek = cleanStoryCopy(card.dek);
    const dekText = dek.text ? truncateAtSentence(dek.text, 280) : "";
    return {
      ...card,
      headline: card.headline ? cleanStoryCopy(card.headline).text || card.headline : card.headline,
      dek: !dekText || isBoilerplateDek(dekText) ? null : dekText,
      body: filedBody(card, card.body),
      caption: card.caption ? cleanStoryCopy(card.caption).text || null : card.caption,
      photo: pickBestStoryImage([card.photo]),
    };
  });
  if (!extracts) return clean;
  return clean.map((card) => {
    const hit = card.wrapHref ? extracts[card.wrapHref] : undefined;
    if (!hit || killedSource(card.wrapHref)) return card;
    const source = hit.contentHtml ? htmlToNewspaperText(hit.contentHtml) : hit.contentText;
    const text = cleanStoryCopy(source).text;
    const currentPrintable = isPrintableStoryBody(card.body);
    const extractPrintable = isPrintableStoryBody(text) && !isNavSoup(text);
    const adopt =
      extractPrintable && (!currentPrintable || text.length > (card.body?.trim().length ?? 0) + 120);
    return {
      ...card,
      body: adopt ? filedBody(card, source) : currentPrintable ? card.body : filedBody(card, card.body),
      photo: pickBestStoryImage([
        card.photo,
        hit.image,
        hit.contentImage ?? firstContentImageUrl(hit.contentHtml),
      ]),
    };
  });
}

export function gatherStories(opts: {
  wire: NewspaperWire | undefined;
  favs: SportsFavorite[];
  details: { fav: SportsFavorite; detail: TeamDetail }[];
  enriched: GameWrapCard[] | undefined;
  teamCards: GameWrapCard[];
  news: GameWrapCard[] | undefined;
  leagueNews: GameWrapCard[] | undefined;
  athletic?: GameWrapCard[];
}): GameWrapCard[] {
  const wire = wireStoryCards({
    games: opts.wire?.games ?? [],
    favs: opts.favs,
    details: opts.details,
  });
  const clubCopy = mergeStoryCards(mergeStoryCards(wire, opts.enriched ?? opts.teamCards), opts.news ?? []);
  const withLeague = mergeStoryCards(clubCopy, opts.leagueNews ?? []);
  const merged = mergeStoryCards(withLeague, opts.athletic ?? []).filter((card) => !isNewsMuted(card));
  const tagged = tagFavoriteStories(attachRelatedGameCopy(merged), opts.favs);
  return attachFavoriteRecapChrome(tagged, opts.wire?.games ?? []);
}

async function settle<T>(task: Promise<T>, fallback: T): Promise<T> {
  try {
    return await task;
  } catch {
    return fallback;
  }
}

/** A few requests at a time. The press runs in a small worker, and a full fan-out gets it killed. */
async function poolMap<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return out;
}

type PressBag = {
  stage: number;
  /** Older checkpoints kept desks here. New runs flush them and drop this key. */
  queries?: PrintedQuery[];
  snaps?: unknown;
  details?: { fav: SportsFavorite; detail: TeamDetail }[];
  wire?: NewspaperWire;
  wireCursor?: number;
  recap?: YesterdayRecap;
  wraps?: unknown;
  news?: GameWrapCard[];
  weather?: unknown;
  watch?: WatchGame[];
  scoutItem?: unknown;
  missouri?: { scout: MoItem | null; items: MoItem[]; listen: MoItem[] } | null;
  openers?: unknown;
  org?: unknown;
  sheets?: unknown;
  paths?: string[];
  pathKey?: string;
  teamCards?: GameWrapCard[];
  athletic?: GameWrapCard[];
  enriched?: GameWrapCard[];
  leagueNews?: GameWrapCard[];
  leagueCursor?: number;
  leagueClubs?: unknown;
  leagueSlate?: unknown;
  playoffs?: unknown;
  board?: unknown;
  standings?: unknown;
  leaders?: unknown;
  heisman?: unknown;
  extractCursor?: number;
  extractFileCursor?: number;
  extracts?: Record<string, PressExtract>;
  extractUrls?: string[];
  raw?: GameWrapCard[];
  fresh?: GameWrapCard[];
  enrichCursor?: number;
  coaches?: unknown;
  /** Wire+club+news merged after wrap enrich, so those desks can leave the bag. */
  clubCopy?: GameWrapCard[];
  wireGames?: NewspaperWire["games"];
  filed?: GameWrapCard[];
  storyCursor?: number;
  cleanCursor?: number;
  dedupeQueue?: string[];
  dedupeGroups?: string[][];
  dedupeCursor?: number;
  deskCopy?: GameWrapCard[];
  /** MLB Trade Rumors, held from the wrap hop until the club and Missouri desks file. */
  mlbtrRoyals?: MoItem[];
  mlbtrCards?: GameWrapCard[];
  mlbtrLeague?: GameWrapCard[];
  /** Stage-11 merge sub-steps. */
  mergeStep?: "merge" | "related-wraps" | "related-rest" | "tag";
  pool?: GameWrapCard[];
  wrapCursor?: number;
  restCursor?: number;
  keptWraps?: GameWrapCard[];
  leftover?: GameWrapCard[];
  tagCursor?: number;
};

export type PressStep =
  | { done: false; bag: PressBag; flush: PrintedQuery[]; stories?: GameWrapCard[] }
  | { done: true; issue: PrintedIssue; flush: PrintedQuery[]; stories?: GameWrapCard[] };

/** Wrap-body enrich: live edge spent 2.0s CPU on 4 at once. Stay well under 2s. */
const WRAP_ENRICH_PER_HOP = 2;
/** Stories appended via SQL jsonb || so no hop stringifies the whole edition. */
const STORY_FLUSH_PER_HOP = 20;
/**
 * Stage-14 extract-file only. Live `mo=20` + `Bv=1200` hit HTTP 546
 * (WORKER_RESOURCE_LIMIT) at extractFileCursor=100 of 283. One small
 * slice per hop — wall budget does not protect CPU on this transform.
 */
export const EXTRACT_FILE_PER_HOP = 6;
/** Favorite tagging / recap chrome per time-budgeted slice. */
const TAG_BATCH = 20;

function overBudget(started: number, progressed: boolean): boolean {
  return progressed && Date.now() - started >= HOP_BUDGET_MS;
}

/**
 * One slice of the press. The scheduled worker can only hold a little at a time,
 * so it saves the bag and comes back for the next slice.
 */
export async function pressStep(
  opts: {
    pressId: string;
    day: string;
    favs: SportsFavorite[];
    layout: SportsLayout;
    userId?: string | null;
    /** article_url values from rss_reads. A seen story stays out of this press. */
    readKeys?: string[];
    /** Stories filed in the previous edition. Unread ones may run again. */
    carried?: GameWrapCard[];
    carriedMissouri?: MoItem[];
    /** Asks the AI editor for the front. Without it, or when it fails, the rule desk sets the paper. */
    editor?: (request: EditorRequest) => Promise<unknown>;
  },
  bag: PressBag | null,
): Promise<PressStep> {
  const { pressId, day, favs } = opts;
  const userId = opts.userId ?? null;
  const state: PressBag = bag ?? { stage: 0 };
  delete state.queries;
  const flush: PrintedQuery[] = [];
  const favKeys = favs.map((t) => t.key).join(",");
  const put = (key: unknown[], data: unknown) => {
    flush.push({ key, data });
  };
  const wrapFeedUrls = wrapFeedsForFavorites(favs);
  const hopStarted = Date.now();
  const logHop = (bag: PressBag) => {
    const cursor = hopSignature(bag);
    console.info(
      `[newspaper-press] hop stage=${bag.stage} cursor=${cursor} elapsedMs=${Date.now() - hopStarted}`,
    );
  };
  const pause = (): PressStep => {
    const bag = checkpointBag(state);
    logHop(bag);
    return { done: false, bag, flush };
  };
  const fileWrapAndLeagueDesks = () => {
    const cards = state.enriched ?? state.teamCards;
    if (cards) {
      put([pressId, "tt-wrap-bodies", day, cards.map((c) => `${c.id}:${c.gameId}`).join("|")], cards);
    }
    const paths = state.paths ?? [];
    if (paths.length && state.leagueNews) {
      put([pressId, "tt-league-news", day, state.pathKey ?? ""], state.leagueNews);
    }
  };

  if (state.stage === 0) {
    state.snaps = await poolMap(favs, 3, async (fav) => {
      try {
        return await fetchTeamSnapshot(fav);
      } catch {
        return {
          key: fav.key,
          name: fav.name,
          shortName: fav.shortName,
          abbreviation: fav.shortName.slice(0, 3).toUpperCase(),
          logo: null,
          color: fav.color ?? null,
          record: null,
          standing: null,
          nextGame: null,
          lastGame: null,
        };
      }
    });
    state.stage = 1;
    return pause();
  }

  if (state.stage === 1) {
    state.details = await settle(
      poolMap(favs, 3, async (fav) => {
        try {
          const detail = await fetchTeamDetail(fav);
          return { fav, detail } as { fav: SportsFavorite; detail: TeamDetail };
        } catch {
          return null;
        }
      }).then((rows) => rows.filter((row): row is { fav: SportsFavorite; detail: TeamDetail } => row != null)),
      [] as { fav: SportsFavorite; detail: TeamDetail }[],
    );
    state.stage = 2;
    return pause();
  }

  if (state.stage === 2) {
    state.wire = await settle(fetchNewspaperWire({ favs, day, pressId }), { games: [], postseasonLeagues: [] } as NewspaperWire);
    state.wireCursor = 0;
    state.stage = 3;
    return pause();
  }

  if (state.stage === 3) {
    const wire = state.wire ?? { games: [], postseasonLeagues: [] };
    const finals = wire.games.filter((g) => g.final);
    const cursor = state.wireCursor ?? 0;
    if (cursor < finals.length) {
      const slice = finals.slice(cursor, cursor + 4);
      const filled = await enrichWireStories(slice, 4);
      const byId = new Map(filled.map((g) => [g.id, g]));
      wire.games = wire.games.map((g) => byId.get(g.id) ?? g);
      state.wire = wire;
      state.wireCursor = cursor + slice.length;
      return pause();
    }
    logWireFiling(`filed ${pressId}`, wire.games);
    put([pressId, "tt-wire-log", day], tallyWireGames(wire.games));
    state.stage = 4;
    return pause();
  }

  if (state.stage === 4) {
    state.recap = await settle(fetchYesterdayRecap({ layout: opts.layout, userId }), {
      date: day,
      games: [],
      playerLines: [],
    } as YesterdayRecap);
    state.stage = 5;
    return pause();
  }

  if (state.stage === 5) {
    const packed = await settle(
      poolMap(wrapFeedUrls, 2, async (url) => {
        try {
          const feed = await fetchRssFeed(url);
          return { url, items: feed.items ?? [] };
        } catch {
          return { url, items: [] as Awaited<ReturnType<typeof fetchRssFeed>>["items"] };
        }
      }).then((feeds) => collectWrapFeeds(feeds, favs)),
      { wraps: [], athletic: [] as GameWrapCard[] },
    );
    state.wraps = packed.wraps;
    state.athletic = packed.athletic;
    const mlbtr = await fetchMlbtr();
    state.mlbtrCards = mlbtr.cardinals;
    state.mlbtrLeague = mlbtr.league;
    state.mlbtrRoyals = mlbtr.royals;
    state.stage = 6;
    return pause();
  }

  if (state.stage === 6) {
    const news = await settle(fetchTeamArticles(favs, pressId), [] as GameWrapCard[]);
    const takenTitles = [
      ...news.map((card) => card.headline),
      ...(state.athletic ?? []).map((card) => card.headline),
      ...(state.wraps ?? []).map((wrap) => wrap.item.title),
    ];
    const power = await fetchPowerMizzou(takenTitles);
    state.news = [...news, ...(state.mlbtrCards ?? []), ...power];
    state.athletic = [...(state.athletic ?? []), ...(state.mlbtrLeague ?? [])];
    delete state.mlbtrCards;
    delete state.mlbtrLeague;
    state.stage = 7;
    return pause();
  }

  if (state.stage === 7) {
    state.weather = await settle(fetchMarshfieldWeather(), null);
    state.watch = await settle(
      fetchWatchList(day, { limit: WATCH_PAGE_GAMES, favorites: favs }),
      [] as WatchGame[],
    );
    state.scoutItem = await settle(
      fetchMissouriScout(pressId).then(async (item) => (item ? ((await enrichMissouriItems([item], 1))[0] ?? item) : null)),
      null,
    );
    state.stage = 8;
    return pause();
  }

  if (state.stage === 8) {
    const readKeys = new Set(opts.readKeys ?? []);
    const desk = await settle(
      fetchMissouriDesk(day, pressId).then(async (fetched) => ({
        ...fetched,
        items: await enrichMissouriItems(fetched.items, 7),
      })),
      null,
    );
    const royals = state.mlbtrRoyals ?? [];
    delete state.mlbtrRoyals;
    const withRoyals = desk
      ? { ...desk, items: [...royals, ...desk.items] }
      : royals.length
        ? { scout: null, items: royals, listen: [] as MoItem[] }
        : null;
    const fresh = (withRoyals?.items ?? []).filter((item) => missouriItemInEdition(item.when, pressId));
    const items = fileMissouriItems({
      fresh,
      carried: opts.carriedMissouri ?? [],
      readKeys,
    });
    state.missouri = items.length || withRoyals ? { scout: withRoyals?.scout ?? null, items, listen: withRoyals?.listen ?? [] } : null;
    state.stage = 9;
    return pause();
  }

  if (state.stage === 9) {
    state.openers = await settle(
      poolMap(favs, 3, (fav) => fetchOpener(fav).catch(() => null)).then((rows) => rows.filter((o): o is Opener => o != null)),
      [] as Opener[],
    );
    state.org = await settle(fetchOrg(favs, day), [] as { id: string; name: string }[]);
    state.sheets = await settle(fetchSheets(favs, day), {} as Record<string, unknown>);
    const snaps = state.snaps as Parameters<typeof buildTeamInfoboxes>[1];
    const details = state.details ?? [];
    const recap = state.recap ?? { date: day, games: [], playerLines: [] };
    const wraps = (state.wraps ?? []) as Parameters<typeof buildGameWrapCards>[0]["wraps"];
    // Snaps stay in the bag until stage 13 overlays table standings, then flush.
    put([pressId, "tt-team-details", day, favKeys], details);
    put([pressId, "tt-wire", day, favKeys], state.wire);
    put([pressId, "newspaper-yesterday-recap", day, userId], recap);
    put([pressId, "tt-wraps", day, wrapFeedUrls.join("|")], wraps);
    put([pressId, "tt-news", day, favKeys], state.news ?? []);
    put([pressId, "tt-weather-marshfield"], state.weather);
    put([pressId, "tt-watch", day], state.watch ?? []);
    put([pressId, "tt-mo-scout", day], state.scoutItem);
    if (state.missouri) put([pressId, "tt-missouri", day], state.missouri);
    put([pressId, "tt-openers", day, favKeys], state.openers);
    put([pressId, "tt-org-rosters", day, favKeys], state.org);
    put([pressId, "tt-club-sheets", day, favKeys], state.sheets);
    const teams = buildTeamInfoboxes(favs, snaps, details);
    state.paths = sportPathsOf(teams.map((t) => t.fav));
    state.pathKey = state.paths.join("|");
    state.teamCards = buildGameWrapCards({ favs, details, recapGames: recap.games, wraps, recapDate: recap.date });
    dropBagKeys(state, DROP_AFTER_FILE_DESKS);
    state.stage = 10;
    return pause();
  }

  if (state.stage === 10) {
    const cards = state.teamCards ?? [];
    const cursor = state.enrichCursor ?? 0;
    if (cursor < cards.length) {
      const slice = cards.slice(cursor, cursor + WRAP_ENRICH_PER_HOP);
      const filled = await settle(enrichWrapBodies(slice, favs), slice);
      const next = cards.slice();
      for (let i = 0; i < filled.length; i++) next[cursor + i] = filled[i]!;
      state.teamCards = next;
      state.enrichCursor = cursor + slice.length;
      return pause();
    }
    delete state.enrichCursor;
    const teamCards = state.teamCards ?? [];
    state.clubCopy = mergeStoryCards(
      mergeStoryCards(
        wireStoryCards({
          games: state.wire?.games ?? [],
          favs,
          details: state.details ?? [],
        }),
        teamCards,
      ),
      state.news ?? [],
    );
    state.wireGames = state.wire?.games ?? [];
    dropBagKeys(state, ["details", "wire", "news"]);
    state.stage = 11;
    return pause();
  }

  if (state.stage === 11) {
    const paths = state.paths ?? [];
    const cursor = state.leagueCursor ?? 0;
    state.leagueNews ??= [];
    if (cursor < paths.length) {
      const batch = await settle(fetchLeagueArticles([paths[cursor]!], pressId), [] as GameWrapCard[]);
      state.leagueNews = [...state.leagueNews, ...batch];
      state.leagueCursor = cursor + 1;
      return pause();
    }
    const mergeStep = state.mergeStep ?? "merge";
    if (mergeStep === "merge") {
      const withLeague = mergeStoryCards(state.clubCopy ?? [], state.leagueNews ?? []);
      const merged = mergeStoryCards(withLeague, state.athletic ?? []).filter((card) => !isNewsMuted(card));
      state.pool = merged;
      fileWrapAndLeagueDesks();
      dropBagKeys(state, ["clubCopy", "athletic", "details", "wire", "news", "teamCards", "leagueNews", "enriched"]);
      state.mergeStep = "related-wraps";
      state.wrapCursor = 0;
      state.restCursor = 0;
      state.keptWraps = [];
      state.leftover = [];
      return pause();
    }

    if (mergeStep === "related-wraps" || mergeStep === "related-rest") {
      const result = attachRelatedGameCopyStep(
        state.pool ?? [],
        {
          wrapAt: state.wrapCursor ?? 0,
          restAt: state.restCursor ?? 0,
          keptWraps: state.keptWraps ?? [],
          leftover: state.leftover ?? [],
        },
        HOP_BUDGET_MS,
      );
      state.wrapCursor = result.cursor.wrapAt;
      state.restCursor = result.cursor.restAt;
      state.keptWraps = result.cursor.keptWraps;
      state.leftover = result.cursor.leftover;
      if (!result.done) {
        state.mergeStep = result.phase;
        return pause();
      }
      state.pool = result.cards ?? [...result.cursor.keptWraps, ...result.cursor.leftover];
      dropBagKeys(state, ["keptWraps", "leftover", "wrapCursor", "restCursor"]);
      state.mergeStep = "tag";
      state.tagCursor = 0;
      state.raw = [];
      return pause();
    }

    const pool = state.pool ?? [];
    const started = Date.now();
    let at = state.tagCursor ?? 0;
    const out = state.raw ?? [];
    let progressed = false;
    while (at < pool.length && !overBudget(started, progressed)) {
      const slice = pool.slice(at, at + TAG_BATCH);
      out.push(...attachFavoriteRecapChrome(tagFavoriteStories(slice, favs), state.wireGames ?? []));
      at += slice.length;
      progressed = true;
    }
    state.raw = out;
    state.tagCursor = at;
    if (at < pool.length) return pause();
    dropBagKeys(state, [
      "clubCopy",
      "wireGames",
      "athletic",
      "details",
      "wire",
      "news",
      "pool",
      "mergeStep",
      "tagCursor",
      "keptWraps",
      "leftover",
      "wrapCursor",
      "restCursor",
    ]);
    state.stage = 12;
    return pause();
  }

  if (state.stage === 12) {
    const paths = state.paths ?? [];
    state.leagueClubs = paths.length
      ? await settle(
          poolMap(paths, 2, async (path) => [path, markFavoriteClubs(await fetchLeagueClubs(path), favs, path)] as const).then(
            (entries) => Object.fromEntries(entries),
          ),
          {},
        )
      : {};
    state.leagueSlate = paths.length
      ? await settle(
          poolMap(paths, 2, async (path) => [path, await fetchLeagueSlate(path, day)] as const).then((entries) =>
            Object.fromEntries(entries),
          ),
          {},
        )
      : {};
    state.stage = 13;
    return pause();
  }

  if (state.stage === 13) {
    const paths = state.paths ?? [];
    state.playoffs = paths.includes("baseball/mlb") ? await settle(fetchMlbPlayoffTree(), null) : null;
    state.board = paths.length
      ? await settle(
          poolMap(paths, 2, async (path) => {
            try {
              return [path, await fetchSectionBoard(path, day)] as const;
            } catch {
              return [path, { results: [], slate: [] }] as const;
            }
          }).then((entries) => Object.fromEntries(entries)),
          {},
        )
      : {};
    state.standings = paths.length
      ? await settle(
          poolMap(paths, 2, async (path) => [path, await fetchSectionStandings(path)] as const).then((entries) =>
            Object.fromEntries(entries),
          ),
          {},
        )
      : {};
    state.leaders = paths.length
      ? await settle(
          poolMap(paths, 2, async (path) => [path, await fetchLeagueLeaders(path).catch(() => [])] as const).then(
            (entries) => Object.fromEntries(entries),
          ),
          {},
        )
      : {};
    state.heisman = paths.includes("football/college-football")
      ? await settle(fetchHeismanOdds(), null)
      : null;
    const pathsKey = state.pathKey ?? "";
    fileWrapAndLeagueDesks();
    if (paths.length) {
      put([pressId, "tt-league-clubs", day, pathsKey], state.leagueClubs);
      put([pressId, "tt-league-slate", day, pathsKey], state.leagueSlate);
      put([pressId, "tt-board", day, pathsKey], state.board);
      put([pressId, "tt-standings", day, pathsKey], state.standings);
      put([pressId, "tt-leaders", day, pathsKey], state.leaders);
      if (paths.includes("football/college-football")) put([pressId, "tt-heisman", day], state.heisman);
    }
    if (paths.includes("baseball/mlb")) put([pressId, "tt-mlb-playoffs", day], state.playoffs);
    if (printsFavoriteCoaches(pressId)) {
      state.coaches = await settle(fetchFavoriteCoachDesk({ day }), { tiles: [] });
      put([pressId, "tt-favorite-coaches", day], state.coaches);
    }
    if (state.snaps && state.standings) {
      state.snaps = applyTableStandings(
        state.snaps as { key: string; standing: string | null }[],
        state.standings as Record<string, StandGroup[]>,
        favs,
      );
    }
    put([pressId, "tt-team-snaps", day, favKeys], state.snaps);
    state.extracts = {};
    state.extractCursor = 0;
    dropBagKeys(state, DROP_AFTER_BOARD_DESKS);
    state.stage = 14;
    return pause();
  }

  if (state.stage === 14) {
    if (!state.raw || !state.extractUrls) {
      if (!state.raw) {
        const canRebuild = Boolean(state.teamCards?.length || state.leagueNews?.length || state.clubCopy?.length);
        if (canRebuild) {
          const teamCards = state.teamCards ?? [];
          state.raw = gatherStories({
            wire: state.wire ?? { games: state.wireGames ?? [], postseasonLeagues: [] },
            favs,
            details: state.details ?? [],
            enriched: teamCards,
            teamCards,
            news: state.news ?? [],
            leagueNews: state.leagueNews ?? [],
            athletic: state.athletic ?? [],
          });
        } else {
          console.error(
            "[newspaper-press] stage 14 has no raw stories and gather sources were already dropped",
          );
          state.raw = [];
        }
      }
      state.extractUrls = urlsToExtract(state.raw);
      state.extracts ??= {};
      state.extractCursor ??= 0;
      dropBagKeys(state, DROP_AFTER_GATHER);
    }
    const extractUrls = state.extractUrls ?? [];
    const extracts = state.extracts ?? {};
    const cursor = state.extractCursor ?? 0;
    if (cursor < extractUrls.length) {
      const slice = extractUrls.slice(cursor, cursor + 4);
      for (const url of slice) {
        try {
          const article = slimFetchedArticle(await fetchRssArticle(url));
          extracts[url] = article;
          put([pressId, "rss-article-v3", url], article);
        } catch {
          /* the brief runs as filed */
        }
      }
      state.extracts = extracts;
      state.extractCursor = cursor + slice.length;
      return pause();
    }
    if (state.extractFileCursor == null) {
      if (extractUrls.length) put([pressId, "tt-extracts", day, extractUrls.join("|")], extracts);
      const extras = essentialsFromDesks(null, state.missouri);
      state.raw = [...(state.raw ?? []), ...extras];
      state.fresh = [];
      state.extractFileCursor = 0;
      return pause();
    }
    const queue = state.raw ?? [];
    const fileAt = state.extractFileCursor;
    const slice = queue.slice(fileAt, fileAt + EXTRACT_FILE_PER_HOP);
    if (slice.length) {
      const filed = fileExtracts(slice, extractUrls.length ? extracts : undefined);
      state.fresh = [...(state.fresh ?? []), ...filed];
      state.extractFileCursor = fileAt + slice.length;
      if (state.extractFileCursor < queue.length) return pause();
    }
    dropBagKeys(state, ["raw", "extracts", "extractUrls", "extractCursor", "extractFileCursor"]);
    state.stage = 15;
    return pause();
  }

  if (state.stage === 15 && !state.filed) {
    const extras = essentialsFromDesks(null, state.missouri);
    const filed = fileEditionStories({
      fresh: state.fresh ?? extras,
      carried: opts.carried ?? [],
      readKeys: new Set(opts.readKeys ?? []),
      pressId,
    });
    const filedByLeague = new Map<string, { games: number; wraps: number }>();
    for (const card of filed) {
      if (!/^(?:wire|recap|recent)-/.test(card.id)) continue;
      const league = card.sportLabel || card.leaguePath || "other";
      const row = filedByLeague.get(league) ?? { games: 0, wraps: 0 };
      row.games += 1;
      if ((card.body?.trim().length ?? 0) >= 60 || (card.scoreLine && /\d/.test(card.scoreLine))) row.wraps += 1;
      filedByLeague.set(league, row);
    }
    const filedLine = [...filedByLeague.entries()]
      .map(([league, row]) => `${league} games=${row.games} wraps=${row.wraps}`)
      .join(" · ");
    console.info(`[times-wire] stories ${pressId}${filedLine ? ` ${filedLine}` : " (no wraps)"}`);
    const extraIds = new Set(filed.map((card) => card.id));
    const keptExtras = extras.filter((card) => !extraIds.has(card.id));
    state.filed = clearEditorStamps([...filed, ...keptExtras]);
    dropBagKeys(state, ["fresh", "missouri"]);
    state.cleanCursor = 0;
    return pause();
  }

  if (state.stage === 15 && state.filed) {
    const filed = state.filed;
    const started = Date.now();
    let cursor = state.cleanCursor ?? 0;
    let progressed = false;
    while (cursor < filed.length && !overBudget(started, progressed)) {
      const slice = filed.slice(cursor, cursor + STORY_FLUSH_PER_HOP);
      for (const card of slice) stampBodyChars(card);
      cursor += slice.length;
      progressed = true;
    }
    state.cleanCursor = cursor;
    if (cursor < filed.length) return pause();
    delete state.cleanCursor;
    state.stage = 16;
    return pause();
  }

  if (state.stage === 16) {
    const filed = state.filed ?? [];
    const byId = new Map(filed.map((card) => [card.id, card]));
    if (!state.dedupeQueue) {
      state.dedupeQueue = deskCopyQueue(filed, pressId).map((card) => card.id);
      state.dedupeGroups = [];
      state.dedupeCursor = 0;
      return pause();
    }
    const queue = state.dedupeQueue;
    const started = Date.now();
    let cursor = state.dedupeCursor ?? 0;
    const groups = (state.dedupeGroups ?? []).map((ids) => ids.map((id) => byId.get(id)).filter(Boolean) as GameWrapCard[]);
    let progressed = false;
    while (cursor < queue.length && !overBudget(started, progressed)) {
      const slice = queue.slice(cursor, cursor + STORY_FLUSH_PER_HOP);
      for (const id of slice) {
        const card = byId.get(id);
        if (card) dedupePush(groups, card);
      }
      cursor += slice.length;
      progressed = true;
    }
    state.dedupeGroups = groups.map((group) => group.map((card) => card.id));
    state.dedupeCursor = cursor;
    if (cursor < queue.length) return pause();
    state.deskCopy = finishDedupe(groups);
    dropBagKeys(state, ["dedupeQueue", "dedupeGroups", "dedupeCursor"]);
    state.stage = 17;
    return pause();
  }

  if (state.stage === 17) {
    let stories = state.filed ?? [];
    if (opts.editor) {
      const edited = await editEdition(stories, pressId, opts.editor, state.deskCopy);
      stories = edited.stories;
      if (edited.desk) put([pressId, "tt-editor", day], edited.desk);
    }
    state.filed = stories;
    dropBagKeys(state, ["deskCopy"]);
    state.storyCursor = 0;
    state.stage = 18;
    return pause();
  }

  if (state.stage === 18) {
    const filed = state.filed ?? [];
    const cursor = state.storyCursor ?? 0;
    if (cursor < filed.length) {
      const slice = filed.slice(cursor, cursor + STORY_FLUSH_PER_HOP).map((card) => {
        const next = { ...card };
        delete next.bodyChars;
        return next;
      });
      state.filed = filed.slice(cursor + slice.length);
      state.storyCursor = 0;
      if (!state.filed.length) {
        delete state.filed;
        state.stage = 19;
      }
      const bag = checkpointBag(state);
      logHop(bag);
      return { done: false, bag, flush, stories: slice };
    }
    delete state.filed;
    delete state.storyCursor;
    state.stage = 19;
    return pause();
  }

  logHop({ stage: 19 });
  return {
    done: true,
    flush,
    stories: [],
    issue: { version: ISSUE_VERSION, id: pressId, stories: [], queries: flush },
  };
}

/** Set the edition in one run. The page's own desk does this; the schedule takes it a slice at a time. */
export async function composePress(opts: {
  pressId: string;
  day: string;
  favs: SportsFavorite[];
  layout: SportsLayout;
  userId?: string | null;
  editor?: (request: EditorRequest) => Promise<unknown>;
}): Promise<PrintedIssue> {
  let bag: PressBag | null = null;
  const queries: PrintedQuery[] = [];
  const stories: GameWrapCard[] = [];
  for (;;) {
    const step = await pressStep(opts, bag);
    if (step.flush.length) queries.push(...step.flush);
    if (step.stories?.length) stories.push(...step.stories);
    if (step.done) {
      return {
        version: ISSUE_VERSION,
        id: opts.pressId,
        stories: stories.length ? stories : step.issue.stories,
        queries,
      };
    }
    bag = step.bag;
  }
}

async function fetchSheets(favs: SportsFavorite[], day: string): Promise<Record<string, unknown>> {
  const rows = await poolMap(favs, 3, async (fav) => [fav.key, await fetchClubSheet(fav.espnPath, day).catch(() => null)] as const);
  return Object.fromEntries(rows.filter((row) => row[1]));
}

async function fetchOrg(favs: SportsFavorite[], day: string): Promise<{ id: string; name: string }[]> {
  const season = Number(day.slice(0, 4)) || new Date().getFullYear();
  const rows = await poolMap(
    favs.filter((fav) => fav.mlbTeamId),
    2,
    async (fav) => {
        const res = await fetch(
          `https://statsapi.mlb.com/api/v1/teams/${fav.mlbTeamId}/roster?rosterType=fullRoster&season=${season}`,
        ).catch(() => null);
        const data = (res?.ok ? await res.json().catch(() => null) : null) as {
          roster?: { person?: { id?: number; fullName?: string } }[];
        } | null;
        return (data?.roster ?? []).flatMap((r) =>
          r.person?.id && r.person.fullName ? [{ id: String(r.person.id), name: r.person.fullName }] : [],
        );
    },
  );
  return rows.flat();
}
