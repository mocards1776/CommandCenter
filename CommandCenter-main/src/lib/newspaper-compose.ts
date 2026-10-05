/**
 * One press run. The page and the scheduled desk both set an edition through here,
 * so the paper that is waiting and the paper that prints while you read are the same.
 */
import { fileEditionStories, fileMissouriItems, isNewsMuted, missouriItemInEdition } from "./newspaper";
import { fetchLeagueArticles, fetchTeamArticles } from "./newspaper-news";
import { fetchLeagueLeaders, fetchSectionBoard, fetchSectionStandings } from "./newspaper-box";
import { fetchClubSheet } from "./newspaper-clubsheet";
import { enrichMissouriItems, fetchMissouriDesk, fetchMissouriScout } from "./newspaper-missouri-fetch";
import type { MoItem } from "./newspaper-missouri";
import { fetchOpener, type Opener } from "./newspaper-openers";
import { cleanStoryCopy, isNavSoup, isPeripheralClubStory, killedSource } from "./newspaper-copy";
import { isBoilerplateDek, storySource } from "./newspaper-source";
import {
  buildGameWrapCards,
  buildTeamInfoboxes,
  collectWrapFeeds,
  enrichWrapBodies,
  leaguePathFromEspn,
  mergeStoryCards,
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
import { fetchWatchList, type WatchGame } from "./newspaper-watch";
import { fetchYesterdayRecap, type YesterdayRecap } from "./yesterday-recap";
import { ISSUE_VERSION, type PrintedIssue, type PrintedQuery } from "./newspaper-issue";
import { clearEditorStamps, editEdition, type EditorRequest } from "./newspaper-editor";

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
        (card.favoriteKey || card.followed || card.caption === "The Athletic") &&
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

export function fileExtracts(cards: GameWrapCard[], extracts: Record<string, RssArticle> | undefined): GameWrapCard[] {
  const clean = cards.filter(runnable).map((card) => {
    const dek = cleanStoryCopy(card.dek);
    return {
      ...card,
      dek: !dek.text || isBoilerplateDek(dek.text) ? null : dek.text,
      body: filedBody(card, card.body),
    };
  });
  if (!extracts) return clean;
  return clean.map((card) => {
    const hit = card.wrapHref ? extracts[card.wrapHref] : undefined;
    if (!hit || killedSource(card.wrapHref)) return card;
    const text = cleanStoryCopy(hit.contentText).text;
    const adopt = text.length > (card.body?.trim().length ?? 0) + 120 && !isNavSoup(text);
    return {
      ...card,
      body: adopt ? filedBody(card, hit.contentText) : card.body,
      photo: card.photo || hit.image || firstContentImageUrl(hit.contentHtml),
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
  return mergeStoryCards(withLeague, opts.athletic ?? []).filter((card) => !isNewsMuted(card));
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
  queries: PrintedQuery[];
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
  extractCursor?: number;
  extracts?: Record<string, RssArticle>;
};

export type PressStep =
  | { done: false; bag: PressBag }
  | { done: true; issue: PrintedIssue };

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
  const state: PressBag = bag ?? { stage: 0, queries: [] };
  const favKeys = favs.map((t) => t.key).join(",");
  const put = (key: unknown[], data: unknown) => {
    state.queries.push({ key, data });
  };
  const wrapFeedUrls = wrapFeedsForFavorites(favs);

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
    return { done: false, bag: state };
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
    return { done: false, bag: state };
  }

  if (state.stage === 2) {
    state.wire = await settle(fetchNewspaperWire({ favs, day, pressId }), { games: [], postseasonLeagues: [] } as NewspaperWire);
    state.wireCursor = 0;
    state.stage = 3;
    return { done: false, bag: state };
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
      return { done: false, bag: state };
    }
    logWireFiling(`filed ${pressId}`, wire.games);
    put([pressId, "tt-wire-log", day], tallyWireGames(wire.games));
    state.stage = 4;
    return { done: false, bag: state };
  }

  if (state.stage === 4) {
    state.recap = await settle(fetchYesterdayRecap({ layout: opts.layout, userId }), {
      date: day,
      games: [],
      playerLines: [],
    } as YesterdayRecap);
    state.stage = 5;
    return { done: false, bag: state };
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
    state.stage = 6;
    return { done: false, bag: state };
  }

  if (state.stage === 6) {
    state.news = await settle(fetchTeamArticles(favs, pressId), [] as GameWrapCard[]);
    state.stage = 7;
    return { done: false, bag: state };
  }

  if (state.stage === 7) {
    state.weather = await settle(fetchMarshfieldWeather(), null);
    state.watch = await settle(fetchWatchList(day), [] as WatchGame[]);
    state.scoutItem = await settle(
      fetchMissouriScout(pressId).then(async (item) => (item ? ((await enrichMissouriItems([item], 1))[0] ?? item) : null)),
      null,
    );
    state.stage = 8;
    return { done: false, bag: state };
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
    const fresh = (desk?.items ?? []).filter((item) => missouriItemInEdition(item.when, pressId));
    const items = fileMissouriItems({
      fresh,
      carried: opts.carriedMissouri ?? [],
      readKeys,
    });
    state.missouri = items.length || desk ? { scout: desk?.scout ?? null, items, listen: desk?.listen ?? [] } : null;
    state.stage = 9;
    return { done: false, bag: state };
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
    put([pressId, "tt-team-snaps", day, favKeys], snaps);
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
    state.stage = 10;
    return { done: false, bag: state };
  }

  if (state.stage === 10) {
    const teamCards = state.teamCards ?? [];
    state.enriched = teamCards.length ? await settle(enrichWrapBodies(teamCards, favs), teamCards) : teamCards;
    state.stage = 11;
    return { done: false, bag: state };
  }

  if (state.stage === 11) {
    const paths = state.paths ?? [];
    const cursor = state.leagueCursor ?? 0;
    state.leagueNews ??= [];
    if (cursor < paths.length) {
      const batch = await settle(fetchLeagueArticles([paths[cursor]!], pressId), [] as GameWrapCard[]);
      state.leagueNews = [...state.leagueNews, ...batch];
      state.leagueCursor = cursor + 1;
      return { done: false, bag: state };
    }
    state.stage = 12;
    return { done: false, bag: state };
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
    return { done: false, bag: state };
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
    const teamCards = state.teamCards ?? [];
    const pathsKey = state.pathKey ?? "";
    put([pressId, "tt-wrap-bodies", day, teamCards.map((c) => `${c.id}:${c.gameId}`).join("|")], state.enriched ?? teamCards);
    if (paths.length) {
      put([pressId, "tt-league-news", day, pathsKey], state.leagueNews ?? []);
      put([pressId, "tt-league-clubs", day, pathsKey], state.leagueClubs);
      put([pressId, "tt-league-slate", day, pathsKey], state.leagueSlate);
      put([pressId, "tt-board", day, pathsKey], state.board);
      put([pressId, "tt-standings", day, pathsKey], state.standings);
      put([pressId, "tt-leaders", day, pathsKey], state.leaders);
    }
    if (paths.includes("baseball/mlb")) put([pressId, "tt-mlb-playoffs", day], state.playoffs);
    state.extracts = {};
    state.extractCursor = 0;
    state.stage = 14;
    return { done: false, bag: state };
  }

  const details = state.details ?? [];
  const teamCards = state.teamCards ?? [];
  const raw = gatherStories({
    wire: state.wire ?? { games: [], postseasonLeagues: [] },
    favs,
    details,
    enriched: state.enriched ?? teamCards,
    teamCards,
    news: state.news ?? [],
    leagueNews: state.leagueNews ?? [],
    athletic: state.athletic ?? [],
  });
  const extractUrls = urlsToExtract(raw);
  const extracts = state.extracts ?? {};
  const cursor = state.extractCursor ?? 0;
  if (cursor < extractUrls.length) {
    const slice = extractUrls.slice(cursor, cursor + 4);
    for (const url of slice) {
      try {
        const article = await fetchRssArticle(url);
        extracts[url] = article;
        put([pressId, "rss-article-v3", url], article);
      } catch {
        /* the brief runs as filed */
      }
    }
    state.extracts = extracts;
    state.extractCursor = cursor + slice.length;
    return { done: false, bag: state };
  }
  if (extractUrls.length) put([pressId, "tt-extracts", day, extractUrls.join("|")], extracts);
  const filed = fileEditionStories({
    fresh: fileExtracts(raw, extractUrls.length ? extracts : undefined),
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
  let stories = clearEditorStamps(filed);
  if (opts.editor) {
    const edited = await editEdition(filed, pressId, opts.editor);
    stories = edited.stories;
    if (edited.desk) put([pressId, "tt-editor", day], edited.desk);
  }
  return {
    done: true,
    issue: { version: ISSUE_VERSION, id: pressId, stories, queries: state.queries },
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
  for (;;) {
    const step = await pressStep(opts, bag);
    if (step.done) return step.issue;
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
