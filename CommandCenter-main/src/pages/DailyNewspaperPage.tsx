import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer, RefreshCw, Settings2 } from "lucide-react";
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
  type MlbScoreGame,
} from "@/lib/mlb";
import {
  battingAverageLabel,
  editionDateLabel,
  editionDateline,
  editionIssue,
} from "@/lib/newspaper";
import {
  chicagoTodayNfl,
  fetchNflPlayerProfile,
  fetchNflScoreboard,
  type NflScoreGame,
} from "@/lib/nfl";
import {
  chicagoTodayCfb,
  fetchCfbPlayerProfile,
  fetchCfbScoreboard,
  type CfbScoreGame,
} from "@/lib/cfb";
import {
  chicagoTodaySoccer,
  fetchSoccerRuwtBoard,
  type SoccerScoreGame,
} from "@/lib/soccer";
import {
  fetchTeamDetail,
  fetchTeamSnapshot,
  loadSportsLayout,
  visibleFavorites,
  type StandingRow,
  type TeamSnapshot,
} from "@/lib/sports";
import { cn, dueLabel, isOverdue, todayStr } from "@/lib/utils";
import { DEFAULT_WEATHER_ZIP, fetchZipWeather, weatherGlyph } from "@/lib/weather";
import { fetchYesterdayRecap, type YesterdayRecapGame } from "@/lib/yesterday-recap";

const STL_TEAM_ID = 138;

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
    highlight: boolean;
  }[];
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
    if (picked.length >= 6) break;
  }
  return picked.length ? picked : boards.slice(0, 6);
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
    rows: table.rows.map((r) => ({
      rank: String(r.rank),
      team: r.abbrev || r.team,
      record: `${r.wins}-${r.losses}`,
      gb: r.gb,
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
    rows: rows.slice(0, 8).map((r) => ({
      rank: r.rank,
      team: r.team,
      record: r.record,
      gb: r.gb || r.pts || r.pct || "—",
      highlight: r.isMe,
    })),
  };
}

function ScoreCell({
  away,
  home,
  status,
}: {
  away: { abbrev: string; score: string | number | null; win?: boolean };
  home: { abbrev: string; score: string | number | null; win?: boolean };
  status: string;
}) {
  return (
    <div className="np-score">
      <div className={cn("np-score-row", away.win && "win")}>
        <span>{away.abbrev}</span>
        <span>{away.score ?? "—"}</span>
      </div>
      <div className={cn("np-score-row", home.win && "win")}>
        <span>{home.abbrev}</span>
        <span>{home.score ?? "—"}</span>
      </div>
      <div className="np-score-status">{status}</div>
    </div>
  );
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

  const inSeasonSnaps = useMemo(
    () => (teamSnaps.data ?? []).filter(isTeamInSeason),
    [teamSnaps.data],
  );

  const inSeasonFavs = useMemo(() => {
    const keys = new Set(inSeasonSnaps.map((s) => s.key));
    return teamFavs.filter((f) => keys.has(f.key));
  }, [teamFavs, inSeasonSnaps]);

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
  const boards = useMemo(() => pickLeaderBoards(leaders.data), [leaders.data]);

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

  const upcomingFromTeams = useMemo(
    () =>
      inSeasonSnaps
        .filter((s) => s.nextGame)
        .map((s) => ({
          key: s.key,
          team: s.shortName || s.name,
          logo: s.logo,
          label: s.nextGame!.label,
          when: s.nextGame!.when,
          detail: s.nextGame!.detail,
        })),
    [inSeasonSnaps],
  );

  const upcomingFromBoards = useMemo(() => {
    const items: { key: string; team: string; label: string; when: string | null; detail: string | null }[] = [];
    for (const g of mlbBoard.data ?? []) {
      if (g.final || g.live) continue;
      items.push({
        key: `mlb-${g.id}`,
        team: "MLB",
        label: `${g.away.abbrev} @ ${g.home.abbrev}`,
        when: g.whenShort || g.when,
        detail: g.venue,
      });
    }
    for (const g of nflBoard.data ?? []) {
      if (g.final || g.live) continue;
      items.push({
        key: `nfl-${g.id}`,
        team: "NFL",
        label: `${g.away.abbrev} @ ${g.home.abbrev}`,
        when: g.whenShort || g.when,
        detail: g.venue,
      });
    }
    for (const g of cfbBoard.data ?? []) {
      if (g.final || g.live) continue;
      items.push({
        key: `cfb-${g.id}`,
        team: "CFB",
        label: `${g.away.abbrev} @ ${g.home.abbrev}`,
        when: g.whenShort || g.when,
        detail: g.venue,
      });
    }
    for (const g of soccerBoard.data ?? []) {
      if (g.final || g.live) continue;
      items.push({
        key: `soc-${g.id}`,
        team: g.league || "Soccer",
        label: `${g.away.abbrev} vs ${g.home.abbrev}`,
        when: g.shortDetail,
        detail: g.venue,
      });
    }
    return items.slice(0, 18);
  }, [mlbBoard.data, nflBoard.data, cfbBoard.data, soccerBoard.data]);

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
    leagueStandings.isFetching;

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

  function renderEvents(list: CalendarEvent[], empty: string) {
    if (!list.length) return <li className="np-muted">{empty}</li>;
    return list.slice(0, 12).map((e) => (
      <li key={e.id}>
        <span className="when">{formatEventTime(e)}</span>
        <span className="t">{e.title}</span>
      </li>
    ));
  }

  function renderMlbGames(games: MlbScoreGame[] | undefined) {
    if (!games?.length) return <p className="np-muted">No MLB games today.</p>;
    return (
      <div className="np-scores">
        {games.slice(0, 12).map((g) => (
          <ScoreCell
            key={g.id}
            away={{
              abbrev: g.away.abbrev,
              score: g.away.score,
              win: g.final && (g.away.score ?? 0) > (g.home.score ?? 0),
            }}
            home={{
              abbrev: g.home.abbrev,
              score: g.home.score,
              win: g.final && (g.home.score ?? 0) > (g.away.score ?? 0),
            }}
            status={g.live ? g.inning || "Live" : g.final ? "Final" : g.whenShort || g.when || g.status}
          />
        ))}
      </div>
    );
  }

  function renderNflGames(games: NflScoreGame[] | undefined) {
    if (!games?.length) return <p className="np-muted">No NFL games today.</p>;
    return (
      <div className="np-scores">
        {games.slice(0, 12).map((g) => (
          <ScoreCell
            key={g.id}
            away={{
              abbrev: g.away.abbrev,
              score: g.away.score,
              win: g.final && (g.away.score ?? 0) > (g.home.score ?? 0),
            }}
            home={{
              abbrev: g.home.abbrev,
              score: g.home.score,
              win: g.final && (g.home.score ?? 0) > (g.away.score ?? 0),
            }}
            status={g.live ? g.shortDetail || "Live" : g.final ? "Final" : g.whenShort || g.when || g.status}
          />
        ))}
      </div>
    );
  }

  function renderCfbGames(games: CfbScoreGame[] | undefined) {
    if (!games?.length) return <p className="np-muted">No CFB games today.</p>;
    return (
      <div className="np-scores">
        {games.slice(0, 12).map((g) => (
          <ScoreCell
            key={g.id}
            away={{
              abbrev: g.away.abbrev,
              score: g.away.score,
              win: g.final && (g.away.score ?? 0) > (g.home.score ?? 0),
            }}
            home={{
              abbrev: g.home.abbrev,
              score: g.home.score,
              win: g.final && (g.home.score ?? 0) > (g.away.score ?? 0),
            }}
            status={g.live ? g.shortDetail || "Live" : g.final ? "Final" : g.whenShort || g.when || g.status}
          />
        ))}
      </div>
    );
  }

  function renderSoccerGames(games: SoccerScoreGame[] | undefined) {
    if (!games?.length) return <p className="np-muted">No soccer matches today.</p>;
    return (
      <div className="np-scores">
        {games.slice(0, 12).map((g) => (
          <ScoreCell
            key={g.id}
            away={{
              abbrev: g.away.abbrev,
              score: g.away.score,
              win: false,
            }}
            home={{
              abbrev: g.home.abbrev,
              score: g.home.score,
              win: false,
            }}
            status={g.live ? g.shortDetail || "Live" : g.final ? "FT" : g.shortDetail || g.status}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="newspaper-root">
      <div className="newspaper-toolbar print:hidden">
        <div>
          <p className="label-caps text-accent">Print edition</p>
          <h1>Thompson Times</h1>
          <p className="text-chalk mt-2 max-w-xl text-[12px] leading-relaxed">
            Dense broadsheet boxes — desk beside calendar, in-season teams beside upcoming
            games, then every scoreboard and standing that already lives in Command Center.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCalSetup((v) => !v)}
            className="text-chalk hover:text-cream inline-flex items-center gap-2 rounded-sm border border-white/10 px-3 py-2 text-[11px] uppercase tracking-[0.16em] transition hover:border-accent/40"
          >
            <Settings2 size={13} />
            Calendar
          </button>
          <button
            type="button"
            onClick={() => void onRefresh()}
            className="text-chalk hover:text-cream inline-flex items-center gap-2 rounded-sm border border-white/10 px-3 py-2 text-[11px] uppercase tracking-[0.16em] transition hover:border-accent/40"
          >
            <RefreshCw size={13} className={cn(refreshing && "animate-spin")} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="from-accent-deep to-accent-dark text-cream inline-flex items-center gap-2 rounded-sm bg-gradient-to-b px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition hover:brightness-110"
          >
            <Printer size={14} />
            Print
          </button>
        </div>
      </div>

      {showCalSetup ? (
        <div className="newspaper-cal-setup print:hidden">
          <p className="font-semibold text-cream">Google Calendar / iCal feeds</p>
          <p className="mt-1 text-[11px] leading-relaxed">
            Google Calendar → Settings → Integrate calendar → copy the{" "}
            <em>Secret address in iCal format</em>. Paste one URL per line.
          </p>
          <textarea
            value={calDraft}
            onChange={(e) => setCalDraft(e.target.value)}
            placeholder="https://calendar.google.com/calendar/ical/…/private-…/basic.ics"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={saveCalendar}
              className="from-accent-deep to-accent-dark text-cream rounded-sm bg-gradient-to-b px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
            >
              Save feeds
            </button>
            <button
              type="button"
              onClick={() => setShowCalSetup(false)}
              className="text-chalk rounded-sm border border-white/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.14em]"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      <div className="newspaper-edition">
        {/* ── PAGE A: FRONT ─────────────────────────────────────── */}
        <article className="np-page" aria-label="Thompson Times front page">
          <header className="np-mast np-anim-mast">
            <div className="np-mast-top">
              <span>
                Vol. {volume} · No. {issue}
              </span>
              <span>{editionDateline(day)}</span>
              <span>{weather.data?.label ?? "Marshfield, Mo."}</span>
            </div>
            <h1 className="np-flag">Thompson Times</h1>
            <div className="np-mast-sub">
              <span>Morning edition</span>
              <span className="flex-rule" />
              <span>{editionDateLabel(day)}</span>
              <span className="flex-rule" />
              <span>
                {weather.data
                  ? `${weatherGlyph(weather.data.current.code)} ${weather.data.current.tempF}° · ${weather.data.current.summary}`
                  : "Weather…"}
              </span>
            </div>
          </header>

          <div className="np-front np-anim-body">
            <section className="np-box">
              <p className="np-kicker">Calendar</p>
              <div className="np-sec-head">
                <h2>Today</h2>
                <span>{todayEvents.length}</span>
              </div>
              <ul className="np-list np-cal">{renderEvents(todayEvents, calendar.data?.sourceCount ? "Clear day." : "Add iCal in Calendar settings.")}</ul>
              {tomorrowEvents.length ? (
                <>
                  <div className="np-sec-head" style={{ marginTop: "0.35rem" }}>
                    <h2>Tomorrow</h2>
                    <span>{tomorrowEvents.length}</span>
                  </div>
                  <ul className="np-list np-cal">
                    {tomorrowEvents.slice(0, 6).map((e) => (
                      <li key={e.id}>
                        <span className="when">{formatEventTime(e)}</span>
                        <span className="t">{e.title}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </section>

            <section className="np-box np-desk">
              <p className="np-kicker">The desk</p>
              <h2 className="np-headline">{upNext?.content ?? "Nothing left on the plate."}</h2>
              <p className="np-dek">{leadDek}</p>
              <div className="np-sec-head">
                <h2>Agenda</h2>
                <span>
                  {dueToday.length} due · {overdue.length} late
                </span>
              </div>
              <ul className="np-list np-agenda">
                {[...overdue, ...dueToday].slice(0, 14).map((t) => (
                  <li key={t.id} className={cn(isOverdue(t.due?.date) && "late")}>
                    <span className="pri">P{5 - t.priority}</span>
                    <span className="t">{t.content}</span>
                    <span className="due m">{t.due?.date ? dueLabel(t.due.date) : "—"}</span>
                  </li>
                ))}
                {!dueToday.length && !overdue.length ? (
                  <li className="np-muted">No dated tasks for today.</li>
                ) : null}
              </ul>
            </section>

            <div className="np-stack">
              <section className="np-box">
                <p className="np-kicker">Weather</p>
                {weather.data ? (
                  <>
                    <div className="np-wx">
                      <span>{weatherGlyph(weather.data.current.code)}</span>
                      <div>
                        <div className="temp">{weather.data.current.tempF}°</div>
                        <div className="np-muted" style={{ fontStyle: "normal" }}>
                          {weather.data.current.summary}
                        </div>
                      </div>
                    </div>
                    <ul className="np-list np-wx-days">
                      {weather.data.daily.slice(0, 3).map((d) => {
                        const label = new Date(`${d.date}T12:00:00`).toLocaleDateString("en-US", {
                          timeZone: weather.data!.timezone,
                          weekday: "short",
                        });
                        return (
                          <li key={d.date}>
                            <span>{label}</span>
                            <span>{weatherGlyph(d.code)}</span>
                            <span>
                              {d.highF}°/{d.lowF}°
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : (
                  <p className="np-muted">Loading…</p>
                )}
              </section>

              <section className="np-box">
                <p className="np-kicker">Scoreboard</p>
                <div className="np-ba">
                  <strong>{battingAverageLabel(score.battingAverage)}</strong>
                  <em>Batting avg</em>
                </div>
                <dl className="np-stats">
                  <div>
                    <dt>Hits</dt>
                    <dd>{score.hits}</dd>
                  </div>
                  <div>
                    <dt>AB</dt>
                    <dd>{score.atBats}</dd>
                  </div>
                  <div>
                    <dt>K</dt>
                    <dd>{score.strikeouts}</dd>
                  </div>
                  <div>
                    <dt>Deck</dt>
                    <dd>{score.onDeck}</dd>
                  </div>
                  <div>
                    <dt>Streak</dt>
                    <dd>{score.habitStreak}</dd>
                  </div>
                  <div>
                    <dt>Done</dt>
                    <dd>{completed?.length ?? 0}</dd>
                  </div>
                </dl>
              </section>
            </div>

            <section className="np-box">
              <p className="np-kicker">Habits</p>
              <ul className="np-list">
                {(habitsDue.length ? habitsDue : habits ?? []).slice(0, 10).map((h) => (
                  <li key={h.id} className={cn(h.completedToday && "np-done")}>
                    <span className="check">{h.completedToday ? "■" : "□"}</span>
                    <span className="t">{h.name}</span>
                    {h.streak > 0 ? <span className="m">{h.streak}d</span> : null}
                  </li>
                ))}
                {!habits?.length ? <li className="np-muted">No habits due.</li> : null}
              </ul>
            </section>
          </div>

          <div className="np-duo np-anim-body">
            <section className="np-box">
              <div className="np-sec-head">
                <h2>My teams</h2>
                <span>{inSeasonSnaps.length} in season</span>
              </div>
              <div className="np-teams">
                {inSeasonSnaps.map((snap) => {
                  const line = teamLine(snap);
                  const fav = teamFavs.find((f) => f.key === snap.key);
                  return (
                    <div key={snap.key} className="np-team">
                      <div className="np-team-top">
                        {snap.logo ? <img src={snap.logo} alt="" /> : null}
                        <span className="np-team-name">{snap.shortName || snap.name}</span>
                      </div>
                      <div className="np-team-rec">
                        {[snap.record, snap.standing, fav?.league].filter(Boolean).join(" · ") ||
                          fav?.sport}
                      </div>
                      <div className={cn("np-team-line", line.cls)}>{line.text}</div>
                    </div>
                  );
                })}
                {!teamSnaps.isPending && !inSeasonSnaps.length ? (
                  <p className="np-muted">No in-season teams right now.</p>
                ) : null}
                {teamSnaps.isPending ? <p className="np-muted">Loading team desk…</p> : null}
              </div>
            </section>

            <section className="np-box">
              <div className="np-sec-head">
                <h2>Upcoming</h2>
                <span>Next tips</span>
              </div>
              <ul className="np-list np-upcoming">
                {upcomingFromTeams.length
                  ? upcomingFromTeams.slice(0, 12).map((u) => (
                      <li key={u.key}>
                        <span className="when">{u.when || "TBD"}</span>
                        <span className="t">
                          <strong>{u.team}</strong> · {u.label}
                          {u.detail ? ` · ${u.detail}` : ""}
                        </span>
                      </li>
                    ))
                  : upcomingFromBoards.slice(0, 12).map((u) => (
                      <li key={u.key}>
                        <span className="when">{u.when || "TBD"}</span>
                        <span className="t">
                          <strong>{u.team}</strong> · {u.label}
                        </span>
                      </li>
                    ))}
                {!upcomingFromTeams.length && !upcomingFromBoards.length ? (
                  <li className="np-muted">No upcoming games on the wire.</li>
                ) : null}
              </ul>
            </section>
          </div>

          <footer className="np-folio">
            <span>Thompson Times</span>
            <span>A · Front</span>
            <span>Sports →</span>
          </footer>
        </article>

        {/* ── PAGE B: SPORTS ────────────────────────────────────── */}
        <article className="np-page" aria-label="Thompson Times sports page">
          <header className="np-section-mast np-anim-mast">
            <div>
              <p className="np-kicker">Section B</p>
              <h1>Sports</h1>
            </div>
            <div className="np-section-meta">
              <div>{editionDateline(day)}</div>
              <div>Boards · Upcoming · Players · Standings · Leaders</div>
            </div>
          </header>

          <div className="np-sports np-anim-body">
            <section className="np-box">
              <div className="np-sec-head">
                <h2>MLB</h2>
                <span>Scoreboard</span>
              </div>
              {mlbBoard.isPending ? <p className="np-muted">Loading…</p> : renderMlbGames(mlbBoard.data)}
            </section>

            <section className="np-box">
              <div className="np-sec-head">
                <h2>NFL</h2>
                <span>Scoreboard</span>
              </div>
              {nflBoard.isPending ? <p className="np-muted">Loading…</p> : renderNflGames(nflBoard.data)}
            </section>

            <section className="np-box">
              <div className="np-sec-head">
                <h2>CFB</h2>
                <span>Scoreboard</span>
              </div>
              {cfbBoard.isPending ? <p className="np-muted">Loading…</p> : renderCfbGames(cfbBoard.data)}
            </section>

            <section className="np-box">
              <div className="np-sec-head">
                <h2>Soccer</h2>
                <span>Scoreboard</span>
              </div>
              {soccerBoard.isPending ? (
                <p className="np-muted">Loading…</p>
              ) : (
                renderSoccerGames(soccerBoard.data)
              )}
            </section>

            <section className="np-box">
              <div className="np-sec-head">
                <h2>Finals</h2>
                <span>{recap.data?.date ?? "Yesterday"}</span>
              </div>
              {scoresBySport.length ? (
                scoresBySport.map(([sport, list]) => (
                  <div key={sport} className="np-sport-block">
                    <div className="np-sport-label">{sport}</div>
                    <div className="np-scores">
                      {list.map((g) => (
                        <ScoreCell
                          key={g.id}
                          away={{
                            abbrev: g.away.abbrev || g.away.name,
                            score: g.away.score,
                            win: g.away.winner,
                          }}
                          home={{
                            abbrev: g.home.abbrev || g.home.name,
                            score: g.home.score,
                            win: g.home.winner,
                          }}
                          status="Final"
                        />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="np-muted">
                  {recap.isPending ? "Pulling finals…" : "No favorite-team finals overnight."}
                </p>
              )}
            </section>

            <section className="np-box">
              <div className="np-sec-head">
                <h2>Followed players</h2>
                <span>Season stats</span>
              </div>
              <ul className="np-list np-players">
                {(playerSeason.data ?? []).length ? (
                  (playerSeason.data ?? []).map((p) => (
                    <li key={p.playerId}>
                      <strong>
                        {p.name}
                        {p.position ? ` · ${p.position}` : ""}
                        {p.yesterday?.isWin != null
                          ? p.yesterday.isWin
                            ? " · W"
                            : " · L"
                          : ""}
                      </strong>
                      <span className="meta">
                        {p.sport}
                        {p.team ? ` · ${p.team}` : ""}
                        {p.yesterday
                          ? ` · ${p.yesterday.isHome ? "vs" : "@"} ${p.yesterday.opponent}`
                          : ""}
                      </span>
                      <span className="line">{p.seasonLine || "—"}</span>
                      {p.yesterday?.summary ? (
                        <span className="meta">Yday · {p.yesterday.summary}</span>
                      ) : null}
                    </li>
                  ))
                ) : (
                  <li className="np-muted">
                    {playerFavs.length
                      ? playerSeason.isPending
                        ? "Loading season lines…"
                        : "No season lines yet."
                      : "Star players on the sports board to fill this box."}
                  </li>
                )}
              </ul>
            </section>

            <section className="np-box np-span-2">
              <div className="np-sec-head">
                <h2>Standings</h2>
                <span>All boards</span>
              </div>
              {(leagueStandings.data ?? []).length ? (
                <div className="np-standings-grid">
                  {(leagueStandings.data ?? []).map((box) => (
                    <div key={box.key} className="np-standing-box">
                      <div className="np-sport-label">
                        {box.title} · {box.subtitle}
                      </div>
                      <table className="np-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Team</th>
                            <th>Rec</th>
                            <th>GB</th>
                          </tr>
                        </thead>
                        <tbody>
                          {box.rows.map((r, idx) => (
                            <tr key={`${box.key}-${r.team}-${idx}`} className={cn(r.highlight && "np-home")}>
                              <td>{r.rank}</td>
                              <td>{r.team}</td>
                              <td>{r.record}</td>
                              <td>{r.gb}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="np-muted">
                  {leagueStandings.isPending ? "Loading standings…" : "Standings unavailable."}
                </p>
              )}
            </section>

            <section className="np-box np-span-2">
              <div className="np-sec-head">
                <h2>League leaders</h2>
                <span>MLB</span>
              </div>
              {boards.length ? (
                <div className="np-leaders">
                  {boards.map((b) => (
                    <div key={b.key} className="np-leader-col">
                      <h3>{b.label}</h3>
                      <ul className="np-list">
                        {b.leaders.slice(0, 5).map((l) => (
                          <li key={`${b.key}-${l.playerId}`}>
                            <span>
                              {l.rank}. {l.name.split(" ").slice(-1)[0]}
                              <span className="m"> {l.team}</span>
                            </span>
                            <span className="v">{l.value}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="np-muted">
                  {leaders.isPending ? "Loading leaders…" : "Leaders unavailable."}
                </p>
              )}
            </section>
          </div>

          <footer className="np-folio">
            <span>Thompson Times</span>
            <span>B · Sports</span>
            <span>End of edition</span>
          </footer>
        </article>
      </div>
    </div>
  );
}

function dayKeyEvent(e: CalendarEvent): string {
  return e.start.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}
