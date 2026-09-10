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
import { listFavoritePlayers } from "@/lib/favorite-players";
import {
  fetchMlbLeaders,
  fetchMlbStandings,
  fetchFavoritePlayersYesterday,
  type FavoriteYesterdayLine,
  type MlbDivisionTable,
  type MlbLeaderBoard,
} from "@/lib/mlb";
import {
  battingAverageLabel,
  editionDateLabel,
  editionDateline,
  editionIssue,
} from "@/lib/newspaper";
import {
  fetchTeamSnapshot,
  loadSportsLayout,
  visibleFavorites,
  type TeamSnapshot,
} from "@/lib/sports";
import { cn, dueLabel, isOverdue, todayStr } from "@/lib/utils";
import { DEFAULT_WEATHER_ZIP, fetchZipWeather, weatherGlyph } from "@/lib/weather";
import { fetchYesterdayRecap, type YesterdayRecapGame } from "@/lib/yesterday-recap";

const STL_TEAM_ID = 138;

function nlCentral(tables: MlbDivisionTable[] | undefined) {
  if (!tables?.length) return null;
  return (
    tables.find((t) => {
      const n = `${t.shortName} ${t.name}`.toLowerCase();
      return n.includes("nl") && n.includes("central");
    }) ?? null
  );
}

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
      (favorites.data ?? []).filter((f) => {
        if ((f.position ?? "").toLowerCase() === "manager") return false;
        const sport = (f.sport ?? "").toLowerCase();
        return !sport || sport === "baseball" || sport === "mlb";
      }),
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
        teamFavs.slice(0, 12).map(async (fav) => {
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
  const central = nlCentral(standings.data);
  const games = recap.data?.games ?? [];
  const scoresBySport = useMemo(() => groupScores(games), [games]);
  const playedLines = useMemo(
    () => (playerYesterday.data?.lines ?? []).filter((l) => l.played),
    [playerYesterday.data],
  );
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

  const leadDek = useMemo(() => {
    const bits: string[] = [];
    if (dueToday.length) bits.push(`${dueToday.length} due`);
    if (overdue.length) bits.push(`${overdue.length} overdue`);
    if (habitsDue.length) {
      bits.push(`${habitsDue.filter((h) => h.completedToday).length}/${habitsDue.length} habits`);
    }
    if (todayEvents.length) bits.push(`${todayEvents.length} on calendar`);
    if (teamFavs.length) bits.push(`${teamFavs.length} teams`);
    return bits.join(" · ") || "Quiet desk — make some news.";
  }, [dueToday.length, overdue.length, habitsDue, todayEvents.length, teamFavs.length]);

  const refreshing =
    tasksFetching ||
    weather.isFetching ||
    standings.isFetching ||
    recap.isFetching ||
    calendar.isFetching ||
    leaders.isFetching ||
    teamSnaps.isFetching;

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
    return list.slice(0, 14).map((e) => (
      <li key={e.id}>
        <span className="when">{formatEventTime(e)}</span>
        <span className="t">{e.title}</span>
      </li>
    ));
  }

  return (
    <div className="newspaper-root">
      <div className="newspaper-toolbar print:hidden">
        <div>
          <p className="label-caps text-accent">Print edition</p>
          <h1>Thompson Times</h1>
          <p className="text-chalk mt-2 max-w-xl text-[12px] leading-relaxed">
            Two packed letter pages — desk, calendar, your teams, then sports finals, followed
            players, standings, and leaders.
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
            <em>Secret address in iCal format</em>. Paste one URL per line (Pookie, work, sports,
            etc.).
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
            <div className="np-stack">
              <section className="np-box">
                <p className="np-kicker">Calendar</p>
                <div className="np-sec-head">
                  <h2>Today</h2>
                  <span>{todayEvents.length} events</span>
                </div>
                <ul className="np-list np-cal">
                  {renderEvents(
                    todayEvents,
                    calendar.data?.sourceCount
                      ? "Nothing on the books today."
                      : "Add an iCal feed via Calendar settings.",
                  )}
                </ul>
                {tomorrowEvents.length > 0 ? (
                  <>
                    <div className="np-sec-head" style={{ marginTop: "0.4rem" }}>
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
                      {weather.data.daily.slice(0, 4).map((d) => {
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
                  <p className="np-muted">Loading forecast…</p>
                )}
              </section>
            </div>

            <div className="np-stack">
              <section className="np-box" style={{ flex: 1 }}>
                <p className="np-kicker">The desk</p>
                <h2 className="np-headline">{upNext?.content ?? "Nothing left on the plate."}</h2>
                <p className="np-dek">{leadDek}</p>
                <div className="np-columns">
                  <p>
                    {upNext
                      ? `Lead item${upNext.due?.date ? ` — ${dueLabel(upNext.due.date) ?? ""}` : ""}${
                          isOverdue(upNext.due?.date) ? " (overdue)" : ""
                        }. Clear the board before the day drifts.`
                      : "The scoreboard is open. Knock out a habit or pull the next due task."}
                  </p>
                  <p>
                    Sports desk: yesterday’s finals by league, followed-player lines, NL Central, and
                    MLB leaders run on page B. Your teams box sits below the fold.
                  </p>
                </div>
                <div className="np-sec-head" style={{ marginTop: "0.45rem" }}>
                  <h2>Agenda</h2>
                  <span>
                    {dueToday.length} due · {overdue.length} late
                  </span>
                </div>
                <ul className="np-list np-agenda">
                  {[...overdue, ...dueToday].slice(0, 16).map((t) => (
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
            </div>

            <div className="np-stack">
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
                    <dt>On deck</dt>
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
          </div>

          <section className="np-box np-anim-body">
            <div className="np-sec-head">
              <h2>My teams</h2>
              <span>{teamFavs.length} followed</span>
            </div>
            <div className="np-teams">
              {(teamSnaps.data ?? []).map((snap) => {
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
              {!teamSnaps.data?.length ? <p className="np-muted">Loading team desk…</p> : null}
            </div>
          </section>

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
            <div
              style={{
                textAlign: "right",
                fontSize: "8px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--np-muted)",
              }}
            >
              <div>{editionDateline(day)}</div>
              <div>Finals · Players · Standings · Leaders</div>
            </div>
          </header>

          <div className="np-sports np-anim-body">
            <section className="np-box">
              <div className="np-sec-head">
                <h2>Final scores</h2>
                <span>{recap.data?.date ?? "Yesterday"}</span>
              </div>
              {scoresBySport.length ? (
                scoresBySport.map(([sport, list]) => (
                  <div key={sport} className="np-sport-block">
                    <div className="np-sport-label">{sport}</div>
                    <div className="np-scores">
                      {list.map((g) => (
                        <div key={g.id} className="np-score">
                          <div className={cn("np-score-row", g.away.winner && "win")}>
                            <span>{g.away.abbrev || g.away.name}</span>
                            <span>{g.away.score ?? "—"}</span>
                          </div>
                          <div className={cn("np-score-row", g.home.winner && "win")}>
                            <span>{g.home.abbrev || g.home.name}</span>
                            <span>{g.home.score ?? "—"}</span>
                          </div>
                        </div>
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
                <span>{playerYesterday.data?.date ?? "Yesterday"}</span>
              </div>
              <ul className="np-list np-players">
                {playedLines.length ? (
                  playedLines.slice(0, 14).map((p: FavoriteYesterdayLine) => (
                    <li key={`${p.playerId}-${p.summary}`}>
                      <strong>
                        {p.playerName}
                        {p.isWin != null ? (p.isWin ? " · W" : " · L") : ""}
                      </strong>
                      <span className="meta">
                        {p.isHome ? "vs" : "@"} {p.opponent}
                        {p.teamName ? ` · ${p.teamName}` : ""}
                      </span>
                      <span className="line">{p.summary || "—"}</span>
                    </li>
                  ))
                ) : (
                  <li className="np-muted">
                    {playerFavs.length
                      ? playerYesterday.isPending
                        ? "Loading lines…"
                        : "No followed-player lines from yesterday."
                      : "Star players on the MLB board to fill this column."}
                  </li>
                )}
              </ul>
            </section>

            <section className="np-box np-span-2">
              <div className="np-sec-head">
                <h2>NL Central</h2>
                <span>Standings</span>
              </div>
              {central ? (
                <table className="np-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Team</th>
                      <th>W</th>
                      <th>L</th>
                      <th>GB</th>
                      <th>L10</th>
                      <th>Str</th>
                    </tr>
                  </thead>
                  <tbody>
                    {central.rows.map((r) => (
                      <tr key={r.teamId} className={cn(r.teamId === STL_TEAM_ID && "np-home")}>
                        <td>{r.rank}</td>
                        <td>{r.abbrev || r.team}</td>
                        <td>{r.wins}</td>
                        <td>{r.losses}</td>
                        <td>{r.gb}</td>
                        <td>{r.l10}</td>
                        <td>{r.streak}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="np-muted">
                  {standings.isPending ? "Loading…" : "Standings unavailable."}
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
