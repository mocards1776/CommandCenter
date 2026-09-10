import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer, RefreshCw, Settings2 } from "lucide-react";
import NewspaperEdition, {
  type EditionBoard,
  type EditionData,
  type EditionScore,
} from "@/components/newspaper/NewspaperEdition";
import {
  flattenTasks,
  pickUpNext,
  useCompletedToday,
  useHabits,
  useScoreboard,
  useTasks,
} from "@/lib/queries";
import { useAuth } from "@/lib/auth-context";
import {
  fetchCalendarAgenda,
  formatEventTime,
  getCalendarIcalUrls,
  setCalendarIcalUrls,
  type CalendarEvent,
} from "@/lib/calendar";
import { listFavoritePlayers, type FavoritePlayer } from "@/lib/favorite-players";
import {
  chicagoToday,
  fetchFavoritePlayersYesterday,
  fetchMlbLeaders,
  fetchMlbPlayer,
  fetchMlbScoreboard,
  fetchMlbStandings,
  type FavoriteYesterdayLine,
  type MlbDivisionTable,
  type MlbLeaderBoard,
  type MlbPlayerStatLine,
} from "@/lib/mlb";
import {
  battingAverageLabel,
  clipArticleBody,
  countWord,
  editionDateLabel,
  editionDateline,
  editionIssue,
  editionLede,
} from "@/lib/newspaper";
import {
  chicagoTodayNfl,
  fetchNflPlayerProfile,
  fetchNflScoreboard,
} from "@/lib/nfl";
import {
  chicagoTodayCfb,
  fetchCfbPlayerProfile,
  fetchCfbScoreboard,
} from "@/lib/cfb";
import {
  chicagoTodaySoccer,
  fetchSoccerRuwtBoard,
} from "@/lib/soccer";
import {
  fetchTeamDetail,
  fetchTeamSnapshot,
  loadSportsLayout,
  visibleFavorites,
  type StandingRow,
  type TeamDetail,
  type TeamSnapshot,
} from "@/lib/sports";
import { cn, dueLabel, isOverdue, shiftDay, todayStr } from "@/lib/utils";
import { DEFAULT_WEATHER_ZIP, fetchZipWeather, weatherGlyph } from "@/lib/weather";
import { fetchYesterdayRecap, type YesterdayRecapGame } from "@/lib/yesterday-recap";
import {
  dailyProgress,
  fetchBooks,
  fetchDailyGoal,
  fetchHighlightCounts,
  fetchOnDeck,
  fetchSessions,
  libraryTitle,
  pagesContributions,
  periodStats,
} from "@/lib/books";
import {
  RSS_FEEDS,
  cleanArticleTitle,
  fetchRssArticle,
  fetchRssFeed,
  fetchRssHighlights,
  fetchRssReads,
  fetchRssSaves,
  formatFeedDate,
} from "@/lib/rss";
import type { Book } from "@/types";

const STL_TEAM_ID = 138;
const MOSCOUT = RSS_FEEDS.find((f) => f.id === "moscout")!;
/** Most recent Missouri Scout story only. */
const MOSCOUT_LEAD_COUNT = 1;
/** Roughly two letter pages of three-column copy; longer wire stories get clipped. */
const MOSCOUT_MAX_WORDS = 1800;

type PlayerSeasonCard = {
  playerId: string;
  name: string;
  team: string | null;
  position: string | null;
  sport: string;
  seasonLine: string;
  yesterday: FavoriteYesterdayLine | null;
};

type LeagueStandingBox = {
  key: string;
  title: string;
  subtitle: string;
  rows: {
    rank: string;
    team: string;
    record: string;
    gb: string;
    playoffOdds: string | null;
    wildCardOdds: string | null;
    highlight: boolean;
  }[];
};

type MoscoutArticle = {
  id: string;
  title: string;
  link: string;
  author: string | null;
  publishedAt: string | null;
  body: string;
  wordCount: number;
};

function groupScores(games: YesterdayRecapGame[]) {
  const map = new Map<string, YesterdayRecapGame[]>();
  for (const g of games) {
    const key = g.sportLabel || "Other";
    const arr = map.get(key) ?? [];
    arr.push(g);
    map.set(key, arr);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function pickLeaderBoards(boards: MlbLeaderBoard[] | undefined) {
  if (!boards?.length) return [];
  const want = ["hr", "avg", "rbi", "era", "k", "sv", "ops", "w"];
  const picked: MlbLeaderBoard[] = [];
  for (const key of want) {
    const b = boards.find((x) => x.key === key);
    if (b) picked.push(b);
    if (picked.length >= 5) break;
  }
  return picked.length ? picked : boards.slice(0, 5);
}

function teamLine(snap: TeamSnapshot): { text: string; cls?: string } {
  if (snap.lastGame) {
    const g = snap.lastGame;
    const result = g.won === true ? "W" : g.won === false ? "L" : "·";
    return {
      text: `Last ${result} · ${g.label}${g.detail ? ` ${g.detail}` : ""}`,
      cls: g.won === true ? "w" : g.won === false ? "l" : undefined,
    };
  }
  if (snap.nextGame) {
    return {
      text: `Next · ${snap.nextGame.label}${snap.nextGame.when ? ` · ${snap.nextGame.when}` : ""}`,
    };
  }
  return { text: snap.standing || snap.record || "—" };
}

/** Reuse sports.ts offseason signal: hollow 0-0 records are already nulled. */
function isTeamInSeason(snap: TeamSnapshot): boolean {
  return Boolean(snap.nextGame || snap.record);
}

function pickStatLine(stats: MlbPlayerStatLine[], keys: string[]): string {
  const parts: string[] = [];
  for (const key of keys) {
    const hit = stats.find(
      (s) => s.label.toLowerCase() === key.toLowerCase() || s.label === key,
    );
    if (hit?.value) parts.push(`${hit.label} ${hit.value}`);
  }
  return parts.join(" · ") || stats.slice(0, 4).map((s) => `${s.label} ${s.value}`).join(" · ");
}

function playerSportKey(f: FavoritePlayer): string {
  return `${f.sport ?? ""} ${f.league ?? ""}`.toLowerCase();
}

function isPitcherFav(f: FavoritePlayer): boolean {
  return /^(p|pitcher|sp|rp|cl|lhp|rhp)$/i.test(f.position ?? "");
}

async function loadPlayerSeasonCard(
  f: FavoritePlayer,
  yesterday: FavoriteYesterdayLine | null,
): Promise<PlayerSeasonCard> {
  const key = playerSportKey(f);
  try {
    if (!key.trim() || key.includes("baseball") || key.includes("mlb") || !f.sport) {
      const p = await fetchMlbPlayer(f.playerId);
      const pitcher = isPitcherFav(f) || /p/i.test(p.position ?? "");
      const stats = pitcher
        ? p.mlbPitching.length
          ? p.mlbPitching
          : p.pitching
        : p.mlbHitting.length
          ? p.mlbHitting
          : p.hitting;
      return {
        playerId: f.playerId,
        name: f.playerName,
        team: f.teamName ?? p.teamAbbrev,
        position: f.position ?? p.position,
        sport: "MLB",
        seasonLine: pickStatLine(
          stats,
          pitcher ? ["ERA", "W", "SO", "IP", "WHIP", "SV"] : ["AVG", "HR", "RBI", "OPS", "SB"],
        ),
        yesterday,
      };
    }
    if (key.includes("nfl") || (key.includes("football") && key.includes("nfl"))) {
      const p = await fetchNflPlayerProfile(f.playerId);
      return {
        playerId: f.playerId,
        name: f.playerName,
        team: f.teamName ?? p.teamAbbrev,
        position: f.position ?? p.position,
        sport: "NFL",
        seasonLine:
          p.seasonStats
            .slice(0, 5)
            .map((s) => `${s.label} ${s.value}`)
            .join(" · ") || "—",
        yesterday,
      };
    }
    if (key.includes("cfb") || key.includes("college")) {
      const p = await fetchCfbPlayerProfile(f.playerId);
      return {
        playerId: f.playerId,
        name: f.playerName,
        team: f.teamName ?? p.teamAbbrev,
        position: f.position ?? p.position,
        sport: "CFB",
        seasonLine:
          p.seasonStats
            .slice(0, 5)
            .map((s) => `${s.label} ${s.value}`)
            .join(" · ") || "—",
        yesterday,
      };
    }
  } catch {
    /* fall through */
  }
  return {
    playerId: f.playerId,
    name: f.playerName,
    team: f.teamName,
    position: f.position,
    sport: (f.league || f.sport || "—").toUpperCase(),
    seasonLine: yesterday?.summary || "Season line unavailable",
    yesterday,
  };
}

function standingRowsFromMlb(table: MlbDivisionTable): LeagueStandingBox {
  return {
    key: `mlb-${table.shortName}-${table.name}`,
    title: table.shortName || table.name,
    subtitle: "MLB",
    rows: table.rows.slice(0, 6).map((r) => ({
      rank: String(r.rank),
      team: r.abbrev || r.team,
      record: `${r.wins}-${r.losses}`,
      gb: r.gb,
      playoffOdds: r.playoffPercent,
      wildCardOdds: r.wildCardPercent,
      highlight: r.teamId === STL_TEAM_ID,
    })),
  };
}

function standingRowsFromDivision(
  key: string,
  title: string,
  subtitle: string,
  rows: StandingRow[],
): LeagueStandingBox {
  return {
    key,
    title,
    subtitle,
    rows: rows.slice(0, 6).map((r) => ({
      rank: r.rank,
      team: r.team,
      record: r.record,
      gb: r.gb || r.pts || r.pct || "—",
      playoffOdds: null,
      wildCardOdds: null,
      highlight: r.isMe,
    })),
  };
}

function formatOddsPct(raw: string | null | undefined): string {
  if (!raw) return "—";
  const n = Number.parseFloat(String(raw).replace("%", ""));
  if (!Number.isFinite(n)) return raw;
  return `${n.toFixed(n >= 10 ? 0 : 1)}%`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

type BoardSide = {
  abbrev: string;
  score: number | string | null;
  record: string | null;
  probablePitcher?: string | null;
};

type BoardGame = {
  id: string;
  away: BoardSide;
  home: BoardSide;
  final: boolean;
  live: boolean;
  status: string;
  venue: string | null;
  inning?: string | null;
  shortDetail?: string | null;
  when?: string | null;
  whenShort?: string | null;
};

function toScore(v: number | string | null): number {
  const n = typeof v === "string" ? Number.parseInt(v, 10) : v;
  return Number.isFinite(n) ? (n as number) : 0;
}

/** MLB and the ESPN-shaped boards all reduce to the same printed box score. */
function boardScores(
  prefix: string,
  games: BoardGame[] | undefined,
  finalLabel = "Final",
  limit = 10,
): EditionScore[] {
  return (games ?? []).slice(0, limit).map((g) => {
    const decided = g.final && toScore(g.away.score) !== toScore(g.home.score);
    const pitchers = [g.away.probablePitcher, g.home.probablePitcher].filter(Boolean).join(" vs ");
    return {
      id: `${prefix}-${g.id}`,
      away: {
        abbrev: g.away.abbrev,
        score: g.away.score,
        win: decided && toScore(g.away.score) > toScore(g.home.score),
        record: g.away.record,
      },
      home: {
        abbrev: g.home.abbrev,
        score: g.home.score,
        win: decided && toScore(g.home.score) > toScore(g.away.score),
        record: g.home.record,
      },
      status: g.live
        ? g.inning || g.shortDetail || "Live"
        : g.final
          ? finalLabel
          : g.whenShort || g.when || g.shortDetail || g.status,
      detail: pitchers || g.venue,
    };
  });
}

function readingProgress(book: Book): string {
  if (!book.page_count || book.page_count <= 0) {
    return book.current_page ? `p. ${book.current_page}` : "—";
  }
  const pct = Math.min(100, Math.round((100 * (book.current_page || 0)) / book.page_count));
  return `${book.current_page || 0}/${book.page_count} · ${pct}%`;
}

/** Ultra-short stamp for dense MoScout wire columns. */
function moscoutWhen(raw: string | null): string {
  const full = formatFeedDate(raw);
  if (!full) return "—";
  // Drop weekday + year: "Thu, Sep 10, 2026" → "Sep 10"
  const m = full.match(/([A-Z][a-z]{2})\s+(\d{1,2})(?:,?\s+\d{4})?/);
  if (m) return `${m[1]} ${m[2]}`;
  return full.length > 12 ? full.slice(0, 12) : full;
}

export default function DailyNewspaperPage() {
  const { user } = useAuth();
  const day = todayStr();
  const { volume, issue } = editionIssue(day);
  const layout = useMemo(() => loadSportsLayout(), []);
  const teamFavs = useMemo(
    () => visibleFavorites(layout).filter((f) => f.kind === "team"),
    [layout],
  );

  // Print rules key off the body so the app shell (header, rails, tab bar)
  // can be dropped without those rules leaking into other routes' printouts.
  useEffect(() => {
    document.body.classList.add("tt-paper-mode");
    return () => document.body.classList.remove("tt-paper-mode");
  }, []);

  const [showCalSetup, setShowCalSetup] = useState(false);
  const [calDraft, setCalDraft] = useState(() => getCalendarIcalUrls().join("\n"));
  const [calTick, setCalTick] = useState(0);

  const {
    data: tasks,
    isFetching: tasksFetching,
    refetch: refetchTasks,
  } = useTasks();
  const { data: habits } = useHabits();
  const { data: completed } = useCompletedToday();
  const score = useScoreboard();

  const weather = useQuery({
    queryKey: ["weather-zip", DEFAULT_WEATHER_ZIP],
    queryFn: () => fetchZipWeather(DEFAULT_WEATHER_ZIP),
    staleTime: 10 * 60_000,
  });

  const calendar = useQuery({
    queryKey: ["thompson-times-calendar", calTick, day],
    queryFn: () => fetchCalendarAgenda({ days: 2 }),
    staleTime: 5 * 60_000,
  });

  const standings = useQuery({
    queryKey: ["mlb-standings"],
    queryFn: () => fetchMlbStandings(),
    staleTime: 5 * 60_000,
  });

  const leaders = useQuery({
    queryKey: ["mlb-leaders", 5],
    queryFn: () => fetchMlbLeaders(5),
    staleTime: 10 * 60_000,
  });

  const recap = useQuery({
    queryKey: ["newspaper-yesterday-recap", user?.id],
    queryFn: () => fetchYesterdayRecap({ layout, userId: user?.id }),
    staleTime: 120_000,
  });

  const favorites = useQuery({
    queryKey: ["favorite-players", user?.id],
    queryFn: () => listFavoritePlayers(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 30_000,
  });

  const playerFavs = useMemo(
    () =>
      (favorites.data ?? []).filter((f) => (f.position ?? "").toLowerCase() !== "manager"),
    [favorites.data],
  );

  const playerYesterday = useQuery({
    queryKey: [
      "favorite-players-yesterday",
      user?.id,
      playerFavs.map((f) => f.playerId).join(","),
    ],
    queryFn: () => fetchFavoritePlayersYesterday(playerFavs),
    enabled: playerFavs.length > 0,
    staleTime: 120_000,
  });

  const teamSnaps = useQuery({
    queryKey: ["tt-team-snaps", teamFavs.map((t) => t.key).join(",")],
    queryFn: async () => {
      const rows = await Promise.all(
        teamFavs.slice(0, 16).map(async (fav) => {
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
            } satisfies TeamSnapshot;
          }
        }),
      );
      return rows;
    },
    staleTime: 120_000,
  });

  const mlbBoard = useQuery({
    queryKey: ["tt-mlb-board", chicagoToday()],
    queryFn: () => fetchMlbScoreboard(chicagoToday()),
    staleTime: 60_000,
  });
  const nflBoard = useQuery({
    queryKey: ["tt-nfl-board", chicagoTodayNfl()],
    queryFn: async () => {
      const ymd = chicagoTodayNfl().replace(/-/g, "");
      return fetchNflScoreboard(ymd).catch(() => fetchNflScoreboard());
    },
    staleTime: 60_000,
  });
  const cfbBoard = useQuery({
    queryKey: ["tt-cfb-board", chicagoTodayCfb()],
    queryFn: async () => {
      const ymd = chicagoTodayCfb().replace(/-/g, "");
      return fetchCfbScoreboard(ymd).catch(() => fetchCfbScoreboard());
    },
    staleTime: 60_000,
  });
  const soccerBoard = useQuery({
    queryKey: ["tt-soccer-board", chicagoTodaySoccer()],
    queryFn: () => fetchSoccerRuwtBoard(chicagoTodaySoccer()),
    staleTime: 60_000,
  });

  const booksQ = useQuery({
    queryKey: ["books"],
    queryFn: fetchBooks,
    staleTime: 60_000,
  });
  const sessionsQ = useQuery({
    queryKey: ["reading-sessions"],
    queryFn: fetchSessions,
    staleTime: 60_000,
  });
  const dailyGoalQ = useQuery({
    queryKey: ["daily-goal"],
    queryFn: fetchDailyGoal,
    staleTime: 5 * 60_000,
  });
  const onDeckQ = useQuery({
    queryKey: ["on-deck"],
    queryFn: fetchOnDeck,
    staleTime: 60_000,
  });
  const highlightCountsQ = useQuery({
    queryKey: ["highlight-counts"],
    queryFn: fetchHighlightCounts,
    staleTime: 5 * 60_000,
  });
  const moscoutQ = useQuery({
    queryKey: ["rss-feed-v6", MOSCOUT.url],
    queryFn: () => fetchRssFeed(MOSCOUT.url),
    staleTime: 90_000,
  });
  const rssReadsQ = useQuery({
    queryKey: ["rss-reads", user?.id],
    queryFn: fetchRssReads,
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });
  const rssHighlightsQ = useQuery({
    queryKey: ["rss-highlights-all"],
    queryFn: () => fetchRssHighlights(),
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });
  const rssSavesQ = useQuery({
    queryKey: ["rss-saves"],
    queryFn: fetchRssSaves,
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  const inSeasonSnaps = useMemo(
    () => (teamSnaps.data ?? []).filter(isTeamInSeason),
    [teamSnaps.data],
  );

  const inSeasonFavs = useMemo(() => {
    const keys = new Set(inSeasonSnaps.map((s) => s.key));
    return teamFavs.filter((f) => keys.has(f.key));
  }, [teamFavs, inSeasonSnaps]);

  const teamDetailsQ = useQuery({
    queryKey: ["tt-team-details", inSeasonFavs.map((f) => f.key).join(",")],
    queryFn: async () => {
      const rows = await Promise.all(
        inSeasonFavs.slice(0, 12).map(async (fav) => {
          try {
            const detail = await fetchTeamDetail(fav);
            return { fav, detail } as const;
          } catch {
            return null;
          }
        }),
      );
      return rows.filter(Boolean) as { fav: (typeof inSeasonFavs)[number]; detail: TeamDetail }[];
    },
    enabled: inSeasonFavs.length > 0,
    staleTime: 5 * 60_000,
  });

  const moscoutArticlesQ = useQuery({
    queryKey: [
      "tt-moscout-articles",
      (moscoutQ.data?.items ?? []).slice(0, MOSCOUT_LEAD_COUNT).map((i) => i.link).join("|"),
    ],
    queryFn: async (): Promise<MoscoutArticle[]> => {
      const items = (moscoutQ.data?.items ?? []).slice(0, MOSCOUT_LEAD_COUNT);
      const rows = await Promise.all(
        items.map(async (item) => {
          let body = stripHtml(item.snippet || "");
          let author = item.author;
          try {
            const article = await fetchRssArticle(item.link);
            const text = (article.contentText || stripHtml(article.contentHtml || "")).trim();
            if (text.length > body.length) body = text;
            author = article.byline || author;
            return {
              id: item.id,
              title: cleanArticleTitle(article.title || item.title),
              link: item.link,
              author,
              publishedAt: item.publishedAt,
              body,
              wordCount: article.wordCount || body.split(/\s+/).filter(Boolean).length,
            };
          } catch {
            return {
              id: item.id,
              title: cleanArticleTitle(item.title),
              link: item.link,
              author,
              publishedAt: item.publishedAt,
              body,
              wordCount: body.split(/\s+/).filter(Boolean).length,
            };
          }
        }),
      );
      return rows.filter((r) => r.body.length > 40 || r.title);
    },
    enabled: (moscoutQ.data?.items?.length ?? 0) > 0,
    staleTime: 10 * 60_000,
  });

  const leagueStandings = useQuery({
    queryKey: [
      "tt-league-standings",
      inSeasonFavs.map((f) => f.key).join(","),
      standings.dataUpdatedAt,
    ],
    queryFn: async (): Promise<LeagueStandingBox[]> => {
      const boxes: LeagueStandingBox[] = [];
      for (const table of standings.data ?? []) {
        boxes.push(standingRowsFromMlb(table));
      }

      const byLeague = new Map<string, (typeof inSeasonFavs)[number]>();
      for (const fav of inSeasonFavs) {
        if (/mlb/i.test(fav.league) || /baseball/i.test(fav.sport)) continue;
        const leagueKey = `${fav.sport}|${fav.league}`;
        if (!byLeague.has(leagueKey)) byLeague.set(leagueKey, fav);
      }

      const extras = await Promise.all(
        [...byLeague.values()].slice(0, 8).map(async (fav) => {
          try {
            const detail = await fetchTeamDetail(fav);
            if (!detail.division.length) return null;
            return standingRowsFromDivision(
              fav.key,
              detail.standing || fav.league || fav.shortName,
              fav.league || fav.sport,
              detail.division,
            );
          } catch {
            return null;
          }
        }),
      );
      for (const box of extras) if (box) boxes.push(box);
      return boxes;
    },
    staleTime: 5 * 60_000,
  });

  const yesterdayByPlayer = useMemo(() => {
    const map = new Map<string, FavoriteYesterdayLine>();
    for (const line of playerYesterday.data?.lines ?? []) {
      map.set(line.playerId, line);
    }
    return map;
  }, [playerYesterday.data]);

  const playerSeason = useQuery({
    queryKey: [
      "tt-player-season",
      user?.id,
      playerFavs.map((f) => f.playerId).join(","),
      playerYesterday.dataUpdatedAt,
    ],
    queryFn: async () => {
      const cards = await Promise.all(
        playerFavs.slice(0, 16).map((f) =>
          loadPlayerSeasonCard(f, yesterdayByPlayer.get(f.playerId) ?? null),
        ),
      );
      return cards;
    },
    enabled: playerFavs.length > 0,
    staleTime: 5 * 60_000,
  });

  const rows = useMemo(() => flattenTasks(tasks ?? []), [tasks]);
  const upNext = pickUpNext(rows);
  const dueToday = useMemo(
    () => (tasks ?? []).filter((t) => t.due?.date?.slice(0, 10) === day),
    [tasks, day],
  );
  const overdue = useMemo(
    () => (tasks ?? []).filter((t) => t.due?.date && t.due.date.slice(0, 10) < day),
    [tasks, day],
  );
  const habitsDue = useMemo(() => (habits ?? []).filter((h) => h.dueToday), [habits]);
  const games = recap.data?.games ?? [];
  const scoresBySport = useMemo(() => groupScores(games), [games]);
  const leaderBoards = useMemo(() => pickLeaderBoards(leaders.data), [leaders.data]);

  const todayEvents = useMemo(() => {
    const events = calendar.data?.events ?? [];
    return events.filter((e) => dayKeyEvent(e) === day);
  }, [calendar.data, day]);

  const tomorrowEvents = useMemo(() => {
    const events = calendar.data?.events ?? [];
    const d = new Date(`${day}T12:00:00`);
    d.setDate(d.getDate() + 1);
    const tom = d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
    return events.filter((e) => dayKeyEvent(e) === tom);
  }, [calendar.data, day]);

  const upcomingFromTeams = useMemo(() => {
    const fromDetails = (teamDetailsQ.data ?? []).flatMap(({ fav, detail }) =>
      detail.upcoming.map((g) => ({
        key: `${detail.key}-${g.id}`,
        team: detail.shortName || fav.shortName || detail.name,
        record: detail.record,
        logo: detail.logo,
        label: g.label,
        when: g.when,
        startIso: g.startIso ?? null,
        pitchers: g.pitchers ?? null,
        detail: g.detail,
        status: g.status,
      })),
    );
    if (fromDetails.length) {
      return [...fromDetails].sort((a, b) => {
        const ta = a.startIso ? Date.parse(a.startIso) : Number.POSITIVE_INFINITY;
        const tb = b.startIso ? Date.parse(b.startIso) : Number.POSITIVE_INFINITY;
        if (ta !== tb) return ta - tb;
        return (a.when || "").localeCompare(b.when || "");
      });
    }
    return inSeasonSnaps
      .filter((s) => s.nextGame)
      .map((s) => ({
        key: s.key,
        team: s.shortName || s.name,
        record: s.record,
        logo: s.logo,
        label: s.nextGame!.label,
        when: s.nextGame!.when,
        startIso: null as string | null,
        pitchers: null as string | null,
        detail: s.nextGame!.detail,
        status: "Scheduled",
      }))
      .sort((a, b) => (a.when || "").localeCompare(b.when || ""));
  }, [teamDetailsQ.data, inSeasonSnaps]);

  const upcomingFromBoards = useMemo(() => {
    const items: {
      key: string;
      team: string;
      label: string;
      when: string | null;
      startIso: string | null;
      record: string | null;
      pitchers: string | null;
      detail: string | null;
    }[] = [];
    for (const g of mlbBoard.data ?? []) {
      if (g.final || g.live) continue;
      const records = [g.away.record, g.home.record].filter(Boolean).join(" / ");
      const pitchers = [g.away.probablePitcher, g.home.probablePitcher]
        .filter(Boolean)
        .join(" vs ");
      items.push({
        key: `mlb-${g.id}`,
        team: "MLB",
        label: `${g.away.abbrev} @ ${g.home.abbrev}`,
        when: g.whenShort || g.when,
        startIso: g.gameDate,
        record: records || null,
        pitchers: pitchers || null,
        detail: g.venue,
      });
    }
    for (const g of nflBoard.data ?? []) {
      if (g.final || g.live) continue;
      const records = [g.away.record, g.home.record].filter(Boolean).join(" / ");
      items.push({
        key: `nfl-${g.id}`,
        team: "NFL",
        label: `${g.away.abbrev} @ ${g.home.abbrev}`,
        when: g.whenShort || g.when,
        startIso: null,
        record: records || null,
        pitchers: null,
        detail: g.venue,
      });
    }
    for (const g of cfbBoard.data ?? []) {
      if (g.final || g.live) continue;
      const records = [g.away.record, g.home.record].filter(Boolean).join(" / ");
      items.push({
        key: `cfb-${g.id}`,
        team: "CFB",
        label: `${g.away.abbrev} @ ${g.home.abbrev}`,
        when: g.whenShort || g.when,
        startIso: null,
        record: records || null,
        pitchers: null,
        detail: g.venue,
      });
    }
    for (const g of soccerBoard.data ?? []) {
      if (g.final || g.live) continue;
      const records = [g.away.record, g.home.record].filter(Boolean).join(" / ");
      items.push({
        key: `soc-${g.id}`,
        team: g.league || "Soccer",
        label: `${g.away.abbrev} vs ${g.home.abbrev}`,
        when: g.shortDetail,
        startIso: null,
        record: records || null,
        pitchers: null,
        detail: g.venue,
      });
    }
    return items
      .sort((a, b) => {
        const ta = a.startIso ? Date.parse(a.startIso) : Number.POSITIVE_INFINITY;
        const tb = b.startIso ? Date.parse(b.startIso) : Number.POSITIVE_INFINITY;
        if (ta !== tb) return ta - tb;
        return (a.when || "").localeCompare(b.when || "");
      })
      .slice(0, 18);
  }, [mlbBoard.data, nflBoard.data, cfbBoard.data, soccerBoard.data]);

  const currentlyReading = useMemo(() => {
    const sessions = sessionsQ.data ?? [];
    const latest = new Map<string, string>();
    for (const s of sessions) {
      if (!s.book_id) continue;
      const prev = latest.get(s.book_id);
      if (!prev || s.session_date > prev) latest.set(s.book_id, s.session_date);
    }
    return (booksQ.data ?? [])
      .filter((b) => b.status === "currently-reading")
      .sort((a, b) => {
        const da = latest.get(a.id) ?? a.last_date_read ?? a.started_at ?? "";
        const db = latest.get(b.id) ?? b.last_date_read ?? b.started_at ?? "";
        return db.localeCompare(da);
      });
  }, [booksQ.data, sessionsQ.data]);

  const readingToday = useMemo(
    () => dailyProgress(sessionsQ.data ?? [], dailyGoalQ.data ?? null),
    [sessionsQ.data, dailyGoalQ.data],
  );
  const readingPeriod = useMemo(
    () => periodStats(booksQ.data ?? [], sessionsQ.data ?? []),
    [booksQ.data, sessionsQ.data],
  );
  const pagesRecent = useMemo(() => {
    const to = day;
    const from = shiftDay(day, -6);
    return pagesContributions(sessionsQ.data ?? [], booksQ.data ?? [], from, to).slice(0, 14);
  }, [sessionsQ.data, booksQ.data, day]);
  const pagesYesterday = useMemo(() => {
    const y = shiftDay(day, -1);
    return pagesContributions(sessionsQ.data ?? [], booksQ.data ?? [], y, y);
  }, [sessionsQ.data, booksQ.data, day]);
  const readingHighlightTotal = useMemo(
    () => Object.values(highlightCountsQ.data ?? {}).reduce((n, v) => n + v, 0),
    [highlightCountsQ.data],
  );
  const moscoutItems = useMemo(
    () => moscoutQ.data?.items ?? [],
    [moscoutQ.data],
  );
  const moscoutLatest = useMemo(
    () => moscoutArticlesQ.data?.[0] ?? null,
    [moscoutArticlesQ.data],
  );
  const moscoutHighlightCount = useMemo(() => {
    const items = moscoutItems;
    if (!items.length) return 0;
    const links = new Set(items.map((i) => i.link));
    return (rssHighlightsQ.data ?? []).filter((h) => links.has(h.articleUrl)).length;
  }, [moscoutItems, rssHighlightsQ.data]);
  const moscoutReadCount = useMemo(() => {
    const reads = new Set(rssReadsQ.data ?? []);
    return moscoutItems.filter((i) => reads.has(i.link)).length;
  }, [moscoutItems, rssReadsQ.data]);

  const leadDek = useMemo(() => {
    const bits: string[] = [];
    if (dueToday.length) bits.push(`${dueToday.length} due`);
    if (overdue.length) bits.push(`${overdue.length} overdue`);
    if (habitsDue.length) {
      bits.push(`${habitsDue.filter((h) => h.completedToday).length}/${habitsDue.length} habits`);
    }
    if (todayEvents.length) bits.push(`${todayEvents.length} on calendar`);
    if (inSeasonSnaps.length) bits.push(`${inSeasonSnaps.length} in-season`);
    return bits.join(" · ") || "Quiet desk — make some news.";
  }, [dueToday.length, overdue.length, habitsDue, todayEvents.length, inSeasonSnaps.length]);

  const refreshing =
    tasksFetching ||
    weather.isFetching ||
    standings.isFetching ||
    recap.isFetching ||
    calendar.isFetching ||
    leaders.isFetching ||
    teamSnaps.isFetching ||
    mlbBoard.isFetching ||
    nflBoard.isFetching ||
    cfbBoard.isFetching ||
    soccerBoard.isFetching ||
    playerSeason.isFetching ||
    leagueStandings.isFetching ||
    booksQ.isFetching ||
    sessionsQ.isFetching ||
    moscoutQ.isFetching || teamDetailsQ.isFetching || moscoutArticlesQ.isFetching ||
    rssReadsQ.isFetching ||
    rssHighlightsQ.isFetching ||
    rssSavesQ.isFetching;

  async function onRefresh() {
    await Promise.all([
      refetchTasks(),
      weather.refetch(),
      standings.refetch(),
      leaders.refetch(),
      recap.refetch(),
      calendar.refetch(),
      teamSnaps.refetch(),
      playerYesterday.refetch(),
      mlbBoard.refetch(),
      nflBoard.refetch(),
      cfbBoard.refetch(),
      soccerBoard.refetch(),
      playerSeason.refetch(),
      leagueStandings.refetch(),
      booksQ.refetch(),
      sessionsQ.refetch(),
      dailyGoalQ.refetch(),
      onDeckQ.refetch(),
      highlightCountsQ.refetch(),
      moscoutQ.refetch(),
      rssReadsQ.refetch(),
      rssHighlightsQ.refetch(),
      rssSavesQ.refetch(),
    ]);
  }

  function saveCalendar() {
    const urls = calDraft
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    setCalendarIcalUrls(urls);
    setCalTick((n) => n + 1);
    setShowCalSetup(false);
  }

  const place = weather.data?.label ?? "Marshfield, Mo.";
  const habitList = habitsDue.length ? habitsDue : (habits ?? []);

  const lede = editionLede({
    place,
    weather: weather.data
      ? {
          tempF: weather.data.current.tempF,
          summary: weather.data.current.summary,
          highF: weather.data.daily[0]?.highF ?? null,
          lowF: weather.data.daily[0]?.lowF ?? null,
        }
      : null,
    dueToday: dueToday.length,
    overdue: overdue.length,
    nextUp: upNext?.content ?? null,
    events: todayEvents.length,
    firstEvent: todayEvents[0]
      ? { when: formatEventTime(todayEvents[0]), title: todayEvents[0].title }
      : null,
    habitsDone: habitList.filter((h) => h.completedToday).length,
    habitsTotal: habitList.length,
    teamsInSeason: inSeasonSnaps.length,
    finals: games.length,
    pagesToday: readingToday.today,
    pagesGoal: readingToday.goal ?? null,
  });

  const upcomingGames = upcomingFromTeams.length ? upcomingFromTeams : upcomingFromBoards;

  const boards: EditionBoard[] = [
    {
      key: "mlb",
      label: "Baseball",
      note: "MLB",
      games: boardScores("mlb", mlbBoard.data),
      empty: mlbBoard.isPending ? "Wire still moving." : "No games on the card.",
    },
    {
      key: "nfl",
      label: "Pro football",
      note: "NFL",
      games: boardScores("nfl", nflBoard.data),
      empty: nflBoard.isPending ? "Wire still moving." : "No games on the card.",
    },
    {
      key: "cfb",
      label: "College football",
      note: "FBS",
      games: boardScores("cfb", cfbBoard.data),
      empty: cfbBoard.isPending ? "Wire still moving." : "No games on the card.",
    },
    {
      key: "soccer",
      label: "Soccer",
      note: "Worldwide",
      games: boardScores("soc", soccerBoard.data, "FT"),
      empty: soccerBoard.isPending ? "Wire still moving." : "No matches on the card.",
    },
  ];

  const dispatchClipped = moscoutLatest
    ? clipArticleBody(moscoutLatest.body, MOSCOUT_MAX_WORDS)
    : null;

  const edition: EditionData = {
    volume,
    issue,
    dateLabel: editionDateLabel(day),
    dateline: editionDateline(day),
    place,
    lede,
    lead: {
      kicker: "The desk",
      hed: upNext?.content ?? "A clear desk, and no one to blame for it",
      dek: leadDek,
    },
    weather: weather.data
      ? {
          glyph: weatherGlyph(weather.data.current.code),
          tempF: weather.data.current.tempF,
          summary: weather.data.current.summary,
          days: weather.data.daily.slice(0, 4).map((d) => ({
            key: d.date,
            label: new Date(`${d.date}T12:00:00`).toLocaleDateString("en-US", {
              timeZone: weather.data!.timezone,
              weekday: "short",
            }),
            glyph: weatherGlyph(d.code),
            high: d.highF,
            low: d.lowF,
          })),
        }
      : null,
    scoreboard: {
      figure: battingAverageLabel(score.battingAverage),
      figureLabel: "Batting average",
      stats: [
        { key: "hits", label: "Hits", value: String(score.hits) },
        { key: "ab", label: "At bats", value: String(score.atBats) },
        { key: "k", label: "K", value: String(score.strikeouts) },
        { key: "deck", label: "On deck", value: String(score.onDeck) },
        { key: "streak", label: "Streak", value: `${score.habitStreak}d` },
        { key: "done", label: "Closed", value: String(completed?.length ?? 0) },
      ],
    },
    dayBook: {
      today: todayEvents.slice(0, 6).map((e) => ({
        id: e.id,
        when: formatEventTime(e),
        title: e.title,
      })),
      tomorrow: tomorrowEvents.slice(0, 4).map((e) => ({
        id: `tom-${e.id}`,
        when: formatEventTime(e),
        title: e.title,
      })),
      empty: calendar.data?.sourceCount
        ? "Nothing scheduled."
        : "Add an iCal feed to fill the day book.",
    },
    agenda: {
      entries: [...overdue, ...dueToday].slice(0, 12).map((t) => ({
        id: t.id,
        when: `P${5 - t.priority}`,
        title: t.content,
        value: t.due?.date ? dueLabel(t.due.date) : null,
        late: isOverdue(t.due?.date),
      })),
      note: `${dueToday.length} due · ${overdue.length} late`,
      empty: tasksFetching ? "Copy still coming in." : "Nothing carries a date today.",
    },
    habits: {
      entries: habitList.slice(0, 10).map((h) => ({
        id: h.id,
        mark: h.completedToday ? "■" : "□",
        title: h.name,
        value: h.streak > 0 ? `${h.streak}d` : null,
        done: h.completedToday,
      })),
      note: habitList.length
        ? `${habitList.filter((h) => h.completedToday).length} of ${habitList.length}`
        : "",
      empty: "No habits on the books.",
    },
    teams: {
      entries: inSeasonSnaps.slice(0, 10).map((snap) => {
        const line = teamLine(snap);
        const fav = teamFavs.find((f) => f.key === snap.key);
        return {
          id: snap.key,
          title: snap.shortName || snap.name,
          value:
            [snap.record, fav?.league].filter(Boolean).join(" · ") || fav?.sport || null,
          note: line.text,
          late: line.cls === "l",
        };
      }),
      note: inSeasonSnaps.length ? `${countWord(inSeasonSnaps.length)} in season` : "",
      empty: teamSnaps.isPending ? "Standings desk is checking." : "Every club is out of season.",
    },
    upcoming: {
      entries: upcomingGames.slice(0, 8).map((u) => ({
        id: u.key,
        title: `${u.team} · ${u.label}`,
        value: u.when || "TBD",
        note: [u.pitchers, u.detail].filter(Boolean).join(" · ") || null,
      })),
      note: "Next up",
      empty: "Nothing on the schedule.",
    },
    boards,
    finals: {
      note: recap.data?.date ?? "Overnight",
      groups: scoresBySport.slice(0, 4).map(([sport, list]) => ({
        key: sport,
        label: sport,
        games: list.slice(0, 6).map((g) => ({
          id: g.id,
          away: {
            abbrev: g.away.abbrev || g.away.name,
            score: g.away.score,
            win: g.away.winner,
            record: null,
          },
          home: {
            abbrev: g.home.abbrev || g.home.name,
            score: g.home.score,
            win: g.home.winner,
            record: null,
          },
          status: "Final",
          detail: g.detail || g.headline || null,
        })),
      })),
      empty: recap.isPending ? "Finals still landing." : "No favorite-team finals overnight.",
    },
    players: {
      entries: (playerSeason.data ?? []).slice(0, 14).map((p) => ({
        id: p.playerId,
        title: [p.name, p.position].filter(Boolean).join(" · "),
        value: [p.sport, p.team].filter(Boolean).join(" "),
        note: [
          p.seasonLine || null,
          p.yesterday?.summary
            ? `Yday ${p.yesterday.isHome ? "vs" : "@"} ${p.yesterday.opponent}: ${p.yesterday.summary}`
            : null,
        ]
          .filter(Boolean)
          .join(" — "),
      })),
      note: "Season lines",
      empty: playerFavs.length
        ? playerSeason.isPending
          ? "Box scores still setting."
          : "No season lines filed."
        : "Star players on the sports board to fill this column.",
    },
    standings: {
      tables: (leagueStandings.data ?? []).slice(0, 8).map((box) => ({
        key: box.key,
        title: box.title,
        note: box.subtitle,
        columns: ["#", "Team", "W-L", "GB", "PO%", "WC%"],
        rows: box.rows.slice(0, 6).map((r, idx) => ({
          key: `${box.key}-${r.team}-${idx}`,
          cells: [
            r.rank,
            r.team,
            r.record,
            r.gb,
            formatOddsPct(r.playoffOdds),
            formatOddsPct(r.wildCardOdds),
          ],
          highlight: r.highlight,
        })),
      })),
      empty: leagueStandings.isPending ? "Tables still being set." : "Standings unavailable.",
    },
    leaders: {
      boards: leaderBoards.map((b) => ({
        key: b.key,
        label: b.label,
        entries: b.leaders.slice(0, 5).map((l) => ({
          id: `${b.key}-${l.playerId}`,
          title: `${l.rank}. ${l.name.split(" ").slice(-1)[0]}`,
          value: `${l.team} ${l.value}`,
        })),
      })),
      empty: leaders.isPending ? "Leaders still counting." : "Leaders unavailable.",
    },
    reading: {
      stats: [
        {
          key: "today",
          label: "Today",
          value: `${readingToday.today}${readingToday.goal != null ? `/${readingToday.goal}` : ""}`,
        },
        { key: "streak", label: "Streak", value: `${readingToday.streak}d` },
        { key: "best", label: "Best", value: `${readingToday.bestStreak}d` },
        { key: "week", label: "Week", value: String(readingPeriod.pagesWeek) },
        { key: "month", label: "Month", value: String(readingPeriod.pagesMonth) },
        { key: "marks", label: "Marks", value: String(readingHighlightTotal) },
      ],
      summary: `Finished this week: ${readingPeriod.booksWeek} books and ${readingPeriod.magazinesWeek} magazines. This month: ${readingPeriod.booksMonth} books and ${readingPeriod.magazinesMonth} magazines.`,
      now: {
        entries: currentlyReading.slice(0, 6).map((b) => ({
          id: b.id,
          title: libraryTitle(b),
          value: readingProgress(b),
          note: b.authors || null,
        })),
        note: currentlyReading.length ? String(currentlyReading.length) : "",
        empty: booksQ.isPending ? "Shelf still loading." : "Nothing marked currently reading.",
      },
      week: {
        entries: pagesRecent.map((p) => ({
          id: `w-${p.bookId ?? p.title}`,
          title: p.title,
          value: `${p.pages}p`,
        })),
        note: "7 days",
        empty: sessionsQ.isPending ? "Sessions still loading." : "No pages logged this week.",
      },
      yesterday: pagesYesterday.length
        ? {
            entries: pagesYesterday.map((p) => ({
              id: `y-${p.bookId ?? p.title}`,
              title: p.title,
              value: `${p.pages}p`,
            })),
            note: `${pagesYesterday.reduce((n, p) => n + p.pages, 0)}p`,
          }
        : null,
      onDeck: {
        entries: (onDeckQ.data ?? []).slice(0, 10).map((b) => ({
          id: b.id,
          title: libraryTitle(b),
          value: b.authors ? b.authors.split(",")[0]! : null,
        })),
        note: String((onDeckQ.data ?? []).length),
        empty: onDeckQ.isPending ? "Shelf still loading." : "On-deck shelf is empty.",
      },
    },
    dispatch: {
      kicker: "Missouri Scout",
      hed: moscoutLatest?.title ?? "",
      meta: moscoutLatest
        ? [
            moscoutWhen(moscoutLatest.publishedAt),
            moscoutLatest.author,
            moscoutLatest.wordCount ? `${moscoutLatest.wordCount} words` : null,
            moscoutReadCount ? `${moscoutReadCount} read` : null,
            moscoutHighlightCount ? `${moscoutHighlightCount} marks` : null,
          ]
            .filter(Boolean)
            .join(" · ")
        : "",
      paragraphs: dispatchClipped
        ? dispatchClipped.text
            .split(/\n{2,}/)
            .map((p) => p.trim())
            .filter(Boolean)
        : [],
      continued: Boolean(dispatchClipped?.truncated),
      wire: moscoutItems.slice(MOSCOUT_LEAD_COUNT, MOSCOUT_LEAD_COUNT + 15).map((item) => ({
        id: item.id,
        title: cleanArticleTitle(item.title),
        value: moscoutWhen(item.publishedAt),
        note: item.author || null,
      })),
      empty:
        moscoutArticlesQ.isPending || moscoutQ.isPending
          ? "The Scout has not filed yet."
          : "Missouri Scout wire is empty this morning.",
    },
  };

  return (
    <div className="tt-root">
      <div className="tt-toolbar tt-screen-only print:hidden">
        <div>
          <p className="label-caps text-accent">Print edition</p>
          <h1>Thompson Times</h1>
          <p>
            One continuous edition, set for US Letter. Print or save to PDF and the
            app chrome drops away.
          </p>
        </div>
        <div className="tt-toolbar-actions">
          <button type="button" className="tt-btn" onClick={() => setShowCalSetup((v) => !v)}>
            <Settings2 size={13} />
            Calendar
          </button>
          <button type="button" className="tt-btn" onClick={() => void onRefresh()}>
            <RefreshCw size={13} className={cn(refreshing && "animate-spin")} />
            Refresh
          </button>
          <button
            type="button"
            className="tt-btn tt-btn-primary"
            onClick={() => window.print()}
          >
            <Printer size={14} />
            Print
          </button>
        </div>
      </div>

      {showCalSetup ? (
        <div className="tt-setup tt-screen-only print:hidden">
          <strong>Google Calendar / iCal feeds</strong>
          <p>
            Google Calendar → Settings → Integrate calendar → copy the{" "}
            <em>Secret address in iCal format</em>. Paste one URL per line.
          </p>
          <textarea
            value={calDraft}
            onChange={(e) => setCalDraft(e.target.value)}
            placeholder="https://calendar.google.com/calendar/ical/…/private-…/basic.ics"
          />
          <div className="tt-setup-actions">
            <button type="button" className="tt-btn tt-btn-primary" onClick={saveCalendar}>
              Save feeds
            </button>
            <button type="button" className="tt-btn" onClick={() => setShowCalSetup(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      <NewspaperEdition data={edition} />
    </div>
  );
}

function dayKeyEvent(e: CalendarEvent): string {
  return e.start.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}
