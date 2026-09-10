import { useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer, RefreshCw } from "lucide-react";
import {
  flattenTasks,
  pickUpNext,
  useCompletedToday,
  useHabits,
  useScoreboard,
  useTasks,
} from "@/lib/queries";
import { useAuth } from "@/lib/auth-context";
import { coverSrc, dailyProgress, fetchDailyGoal, fetchOnDeck, fetchSessions } from "@/lib/books";
import {
  computeNetWorth,
  fetchAccounts,
  fetchTransactions,
  fmtMoney,
  periodBounds,
  spendingAmount,
} from "@/lib/finance";
import {
  chicagoToday,
  fetchMlbStandings,
  fetchTeamCurrentAndNextGames,
  type MlbDivisionTable,
  type MlbScoreGame,
} from "@/lib/mlb";
import {
  battingAverageLabel,
  editionDateLabel,
  editionDateline,
  editionIssue,
  moneyCompact,
} from "@/lib/newspaper";
import { loadSportsLayout } from "@/lib/sports";
import { cn, dueLabel, isOverdue, todayStr } from "@/lib/utils";
import { DEFAULT_WEATHER_ZIP, fetchZipWeather, weatherGlyph } from "@/lib/weather";
import { fetchYesterdayRecap } from "@/lib/yesterday-recap";

const STL_TEAM_ID = 138;

function nlCentralTable(tables: MlbDivisionTable[] | undefined) {
  if (!tables?.length) return null;
  return (
    tables.find((t) => {
      const n = `${t.shortName} ${t.name}`.toLowerCase();
      return n.includes("nl") && n.includes("central");
    }) ?? null
  );
}

function gameMatchup(g: MlbScoreGame): string {
  const vs = g.home.teamId === STL_TEAM_ID ? "vs" : "@";
  const them = g.home.teamId === STL_TEAM_ID ? g.away : g.home;
  return `${vs} ${them.abbrev || them.name}`;
}

export default function DailyNewspaperPage() {
  const { user } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);
  const day = todayStr();
  const { volume, issue } = editionIssue(day);
  const layout = useMemo(() => loadSportsLayout(), []);

  const { data: tasks, isFetching: tasksFetching, refetch: refetchTasks } = useTasks();
  const { data: habits } = useHabits();
  const { data: completed } = useCompletedToday();
  const score = useScoreboard();

  const weather = useQuery({
    queryKey: ["weather-zip", DEFAULT_WEATHER_ZIP, 7],
    queryFn: () => fetchZipWeather(DEFAULT_WEATHER_ZIP),
    staleTime: 10 * 60_000,
  });

  const standings = useQuery({
    queryKey: ["mlb-standings"],
    queryFn: () => fetchMlbStandings(),
    staleTime: 5 * 60_000,
  });

  const cards = useQuery({
    queryKey: ["stl-current-next", STL_TEAM_ID],
    queryFn: () => fetchTeamCurrentAndNextGames(STL_TEAM_ID),
    staleTime: 60_000,
  });

  const recap = useQuery({
    queryKey: ["newspaper-yesterday-recap", user?.id],
    queryFn: () => fetchYesterdayRecap({ layout, userId: user?.id }),
    staleTime: 120_000,
  });

  const sessions = useQuery({
    queryKey: ["reading-sessions"],
    queryFn: fetchSessions,
    staleTime: 60_000,
  });
  const goal = useQuery({
    queryKey: ["daily-goal"],
    queryFn: fetchDailyGoal,
    staleTime: 5 * 60_000,
  });
  const onDeck = useQuery({
    queryKey: ["on-deck"],
    queryFn: fetchOnDeck,
    staleTime: 60_000,
  });

  const accounts = useQuery({
    queryKey: ["finance-accounts"],
    queryFn: fetchAccounts,
    staleTime: 5 * 60_000,
  });
  const bounds = periodBounds(day);
  const monthTxns = useQuery({
    queryKey: ["finance-txns-month", bounds.monthStart, day],
    queryFn: () => fetchTransactions({ from: bounds.monthStart, to: day, limit: 400 }),
    staleTime: 5 * 60_000,
  });

  const reading = useMemo(
    () => dailyProgress(sessions.data ?? [], goal.data ?? null),
    [sessions.data, goal.data],
  );

  const netWorth = useMemo(
    () => computeNetWorth(accounts.data ?? []),
    [accounts.data],
  );

  const monthSpend = useMemo(() => {
    let spent = 0;
    for (const t of monthTxns.data ?? []) {
      if (t.pending || t.is_transfer) continue;
      spent += spendingAmount(t);
    }
    return spent;
  }, [monthTxns.data]);

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
  const habitsDue = useMemo(
    () => (habits ?? []).filter((h) => h.dueToday),
    [habits],
  );
  const central = nlCentralTable(standings.data);
  const games = recap.data?.games ?? [];
  const playerLines = recap.data?.playerLines ?? [];

  const leadDek = useMemo(() => {
    const bits: string[] = [];
    if (dueToday.length) bits.push(`${dueToday.length} due today`);
    if (overdue.length) bits.push(`${overdue.length} overdue`);
    if (habitsDue.length) {
      const done = habitsDue.filter((h) => h.completedToday).length;
      bits.push(`${done}/${habitsDue.length} habits`);
    }
    if (score.hits || score.atBats) {
      bits.push(`board ${score.hits}/${score.atBats}`);
    }
    return bits.join(" · ") || "The board is quiet. Make it count.";
  }, [dueToday.length, overdue.length, habitsDue, score.hits, score.atBats]);

  const refreshing =
    tasksFetching || weather.isFetching || standings.isFetching || recap.isFetching;

  function onPrint() {
    window.print();
  }

  async function onRefresh() {
    await Promise.all([
      refetchTasks(),
      weather.refetch(),
      standings.refetch(),
      cards.refetch(),
      recap.refetch(),
      sessions.refetch(),
      accounts.refetch(),
      monthTxns.refetch(),
    ]);
  }

  return (
    <div className="newspaper-root">
      <div className="newspaper-toolbar print:hidden">
        <div>
          <p className="label-caps text-accent">Print edition</p>
          <h1 className="font-display text-cream mt-1 text-[28px] leading-none tracking-[0.04em]">
            Daily Newspaper
          </h1>
          <p className="text-chalk mt-2 max-w-xl text-[13px] leading-relaxed">
            Three letter-size pages — front page, sports, and life & ledger — packed like a morning
            broadsheet. Print from this view.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
            onClick={onPrint}
            className="from-accent-deep to-accent-dark text-cream inline-flex items-center gap-2 rounded-sm bg-gradient-to-b px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition hover:brightness-110"
          >
            <Printer size={14} />
            Print
          </button>
        </div>
      </div>

      <div ref={printRef} className="newspaper-edition">
        {/* ─── PAGE 1: FRONT ───────────────────────────────────────── */}
        <article className="np-page np-page-front" aria-label="Front page">
          <header className="np-masthead np-anim-mast">
            <div className="np-masthead-top">
              <span>Vol. {volume}</span>
              <span>No. {issue}</span>
              <span>{editionDateline(day)}</span>
              <span className="np-masthead-place">
                {weather.data?.label ?? "Marshfield, Mo."}
              </span>
            </div>
            <h1 className="np-flag">The Daily Command</h1>
            <div className="np-masthead-rule">
              <span>Morning edition</span>
              <span className="np-rule-flex" />
              <span>{editionDateLabel(day)}</span>
              <span className="np-rule-flex" />
              <span>
                {weather.data
                  ? `${weatherGlyph(weather.data.current.code)} ${weather.data.current.tempF}° · ${weather.data.current.summary}`
                  : "Weather loading…"}
              </span>
            </div>
          </header>

          <div className="np-front-grid np-anim-cols">
            <aside className="np-rail np-rail-left">
              <section className="np-box">
                <h2 className="np-kicker">Scoreboard</h2>
                <div className="np-ba">
                  <span className="np-ba-num">{battingAverageLabel(score.battingAverage)}</span>
                  <span className="np-ba-label">Batting avg</span>
                </div>
                <dl className="np-stat-grid">
                  <div>
                    <dt>Hits</dt>
                    <dd>{score.hits}</dd>
                  </div>
                  <div>
                    <dt>At bats</dt>
                    <dd>{score.atBats}</dd>
                  </div>
                  <div>
                    <dt>Strikeouts</dt>
                    <dd className={score.strikeouts ? "np-alert" : undefined}>{score.strikeouts}</dd>
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
                <h2 className="np-kicker">Habits</h2>
                <ul className="np-habit-list">
                  {(habitsDue.length ? habitsDue : habits ?? []).slice(0, 8).map((h) => (
                    <li key={h.id} className={cn(h.completedToday && "np-done")}>
                      <span className="np-check">{h.completedToday ? "■" : "□"}</span>
                      <span className="np-habit-name">{h.name}</span>
                      {h.streak > 0 ? <span className="np-habit-streak">{h.streak}d</span> : null}
                    </li>
                  ))}
                  {!habits?.length ? <li className="np-muted">No habits due.</li> : null}
                </ul>
              </section>
            </aside>

            <section className="np-lead">
              <p className="np-kicker">Today’s brief</p>
              <h2 className="np-headline">
                {upNext?.content ?? "Nothing left on the plate."}
              </h2>
              <p className="np-dek">{leadDek}</p>
              <div className="np-columns">
                <p>
                  {upNext
                    ? `Lead item${upNext.due?.date ? ` — ${dueLabel(upNext.due.date)}` : ""}${
                        isOverdue(upNext.due?.date) ? " (overdue)" : ""
                      }. Clear the board before the day drifts. Habits and tasks share one scoreboard: hits over at-bats.`
                    : "The scoreboard is open. Add a due date, knock out a habit, or pick up the book on deck."}
                </p>
                <p>
                  Weather desk reports{" "}
                  {weather.data
                    ? `${weather.data.current.tempF}° in ${weather.data.label}, feels like ${weather.data.current.feelsLikeF}°, wind ${weather.data.current.windMph} mph, humidity ${weather.data.current.humidity}%.`
                    : "conditions loading for the Marshfield desk."}{" "}
                  Sports desk carries yesterday’s favorites and the NL Central table on page 2.
                </p>
                <p>
                  Reading: {reading.today} page{reading.today === 1 ? "" : "s"} today
                  {reading.goal != null ? ` against a goal of ${reading.goal}` : ""}.
                  {reading.streak > 0 ? ` Goal streak ${reading.streak}.` : ""} Ledger snapshot and
                  on-deck titles continue on page 3.
                </p>
              </div>

              {(cards.data?.current || cards.data?.next) && (
                <div className="np-cards-strip">
                  <h3 className="np-kicker">Cardinals desk</h3>
                  <div className="np-cards-row">
                    {cards.data.current ? (
                      <div className="np-mini-score">
                        <span className="np-mini-label">
                          {cards.data.current.live
                            ? cards.data.current.inning || "Live"
                            : cards.data.current.final
                              ? "Latest"
                              : "Today"}
                        </span>
                        <strong>{gameMatchup(cards.data.current)}</strong>
                        {(cards.data.current.live || cards.data.current.final) && (
                          <span className="np-mini-scoreline">
                            {cards.data.current.away.score ?? 0}–{cards.data.current.home.score ?? 0}
                          </span>
                        )}
                      </div>
                    ) : null}
                    {cards.data.next ? (
                      <div className="np-mini-score">
                        <span className="np-mini-label">Next</span>
                        <strong>{gameMatchup(cards.data.next)}</strong>
                        <span className="np-mini-scoreline">
                          {cards.data.next.whenShort || cards.data.next.status}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </section>

            <aside className="np-rail np-rail-right">
              <section className="np-box">
                <h2 className="np-kicker">Weather</h2>
                {weather.data ? (
                  <>
                    <div className="np-wx-now">
                      <span className="np-wx-glyph">{weatherGlyph(weather.data.current.code)}</span>
                      <div>
                        <div className="np-wx-temp">{weather.data.current.tempF}°</div>
                        <div className="np-wx-sum">{weather.data.current.summary}</div>
                      </div>
                    </div>
                    <ul className="np-wx-days">
                      {weather.data.daily.slice(0, 5).map((d) => {
                        const label = new Date(`${d.date}T12:00:00`).toLocaleDateString("en-US", {
                          timeZone: weather.data.timezone,
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

              <section className="np-box">
                <h2 className="np-kicker">In brief</h2>
                <ul className="np-briefs">
                  {overdue.slice(0, 4).map((t) => (
                    <li key={t.id}>
                      <strong>Overdue.</strong> {t.content}
                    </li>
                  ))}
                  {(completed ?? []).slice(0, 3).map((t) => (
                    <li key={t.id}>
                      <strong>Done.</strong> {t.content}
                    </li>
                  ))}
                  {!overdue.length && !(completed ?? []).length ? (
                    <li className="np-muted">No briefs yet — complete a task to fill this column.</li>
                  ) : null}
                </ul>
              </section>
            </aside>
          </div>

          <section className="np-agenda np-anim-base">
            <div className="np-section-head">
              <h2>Agenda</h2>
              <span>{dueToday.length} due · {overdue.length} overdue</span>
            </div>
            <div className="np-agenda-grid">
              {[...overdue, ...dueToday].slice(0, 18).map((t) => (
                <div key={t.id} className={cn("np-agenda-item", isOverdue(t.due?.date) && "is-late")}>
                  <span className="np-agenda-pri">P{5 - t.priority}</span>
                  <span className="np-agenda-text">{t.content}</span>
                  <span className="np-agenda-due">
                    {t.due?.date ? dueLabel(t.due.date) : "—"}
                  </span>
                </div>
              ))}
              {!dueToday.length && !overdue.length ? (
                <p className="np-muted np-agenda-empty">No dated tasks for today. The plate is clear.</p>
              ) : null}
            </div>
          </section>

          <footer className="np-folio">
            <span>The Daily Command</span>
            <span>A · Front page</span>
            <span>Continued: Sports →</span>
          </footer>
        </article>

        {/* ─── PAGE 2: SPORTS ──────────────────────────────────────── */}
        <article className="np-page np-page-sports" aria-label="Sports page">
          <header className="np-section-mast">
            <div>
              <p className="np-kicker">Section B</p>
              <h1>Sports</h1>
            </div>
            <div className="np-section-meta">
              <span>{editionDateline(day)}</span>
              <span>Favorites · NL Central · Cardinals</span>
            </div>
          </header>

          <div className="np-sports-grid">
            <section className="np-box np-span-2">
              <div className="np-section-head">
                <h2>Yesterday’s board</h2>
                <span>{recap.data?.date ?? chicagoToday()}</span>
              </div>
              {games.length ? (
                <div className="np-scoreboard">
                  {games.slice(0, 12).map((g) => (
                    <div key={g.id} className="np-score-row">
                      <span className="np-sport-tag">{g.sportLabel}</span>
                      <div className="np-score-teams">
                        <div className={cn(g.away.winner && "np-winner")}>
                          <span>{g.away.abbrev || g.away.name}</span>
                          <strong>{g.away.score ?? "—"}</strong>
                        </div>
                        <div className={cn(g.home.winner && "np-winner")}>
                          <span>{g.home.abbrev || g.home.name}</span>
                          <strong>{g.home.score ?? "—"}</strong>
                        </div>
                      </div>
                      {g.detail ? <p className="np-score-detail">{g.detail}</p> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="np-muted">
                  {recap.isPending
                    ? "Pulling last night’s scores…"
                    : "No favorite-team finals overnight. Check Sports for the live board."}
                </p>
              )}
            </section>

            <section className="np-box">
              <div className="np-section-head">
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
                      <tr key={r.teamId} className={cn(r.teamId === STL_TEAM_ID && "np-home-row")}>
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
                <p className="np-muted">{standings.isPending ? "Loading…" : "Standings unavailable."}</p>
              )}
            </section>

            <section className="np-box">
              <div className="np-section-head">
                <h2>Player lines</h2>
                <span>Favorites</span>
              </div>
              {playerLines.length ? (
                <ul className="np-player-lines">
                  {playerLines.slice(0, 8).map((p) => (
                    <li key={`${p.playerId}-${p.summary}`}>
                      <strong>{p.playerName}</strong>
                      <span>{p.summary || "—"}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="np-muted">No favorite-player lines from yesterday.</p>
              )}

              {(cards.data?.current || cards.data?.next) && (
                <div className="np-cards-follow">
                  <h3 className="np-kicker">Cardinals</h3>
                  {cards.data.current ? (
                    <p>
                      <strong>{gameMatchup(cards.data.current)}</strong> —{" "}
                      {cards.data.current.live || cards.data.current.final
                        ? `${cards.data.current.away.score ?? 0}–${cards.data.current.home.score ?? 0} · ${cards.data.current.inning || cards.data.current.status}`
                        : cards.data.current.whenShort || cards.data.current.status}
                    </p>
                  ) : null}
                  {cards.data.next ? (
                    <p>
                      Next: <strong>{gameMatchup(cards.data.next)}</strong> ·{" "}
                      {cards.data.next.whenShort || cards.data.next.status}
                    </p>
                  ) : null}
                </div>
              )}
            </section>

            <section className="np-box np-span-2">
              <div className="np-section-head">
                <h2>Recap notes</h2>
                <span>Highlights</span>
              </div>
              <div className="np-highlights">
                {games
                  .filter((g) => g.highlight?.headline)
                  .slice(0, 6)
                  .map((g) => (
                    <div key={`hl-${g.id}`} className="np-hl">
                      <span className="np-sport-tag">{g.sportLabel}</span>
                      <p>{g.highlight!.headline}</p>
                    </div>
                  ))}
                {!games.some((g) => g.highlight?.headline) ? (
                  <p className="np-muted">No highlight blurbs overnight — scores still carry the board.</p>
                ) : null}
              </div>
            </section>
          </div>

          <footer className="np-folio">
            <span>The Daily Command</span>
            <span>B · Sports</span>
            <span>Continued: Life & ledger →</span>
          </footer>
        </article>

        {/* ─── PAGE 3: LIFE & LEDGER ───────────────────────────────── */}
        <article className="np-page np-page-life" aria-label="Life and ledger page">
          <header className="np-section-mast">
            <div>
              <p className="np-kicker">Section C</p>
              <h1>Life & Ledger</h1>
            </div>
            <div className="np-section-meta">
              <span>{editionDateline(day)}</span>
              <span>Reading · Habits · Finance</span>
            </div>
          </header>

          <div className="np-life-grid">
            <section className="np-box">
              <div className="np-section-head">
                <h2>Reading</h2>
                <span>
                  {reading.today}
                  {reading.goal != null ? ` / ${reading.goal}` : ""} pages
                </span>
              </div>
              <div className="np-reading-meter">
                <div
                  className="np-reading-fill"
                  style={{
                    width: `${
                      reading.goal && reading.goal > 0
                        ? Math.min(100, (reading.today / reading.goal) * 100)
                        : reading.today > 0
                          ? 40
                          : 0
                    }%`,
                  }}
                />
              </div>
              <dl className="np-stat-grid np-stat-grid-3">
                <div>
                  <dt>Today</dt>
                  <dd>{reading.today}</dd>
                </div>
                <div>
                  <dt>Streak</dt>
                  <dd>{reading.streak}</dd>
                </div>
                <div>
                  <dt>Best</dt>
                  <dd>{reading.bestStreak}</dd>
                </div>
              </dl>
              <div className="np-ondeck">
                <h3 className="np-kicker">On deck</h3>
                <ul>
                  {(onDeck.data ?? []).slice(0, 4).map((b) => (
                    <li key={b.id}>
                      {coverSrc(b) ? (
                        <img src={coverSrc(b)!} alt="" className="np-cover" />
                      ) : (
                        <span className="np-cover np-cover-empty" />
                      )}
                      <div>
                        <strong>{b.title}</strong>
                        <span>{b.authors || "Unknown author"}</span>
                      </div>
                    </li>
                  ))}
                  {!onDeck.data?.length ? <li className="np-muted">Nothing on deck.</li> : null}
                </ul>
              </div>
            </section>

            <section className="np-box">
              <div className="np-section-head">
                <h2>Habits desk</h2>
                <span>
                  {habitsDue.filter((h) => h.completedToday).length}/{habitsDue.length || (habits ?? []).length}{" "}
                  checked
                </span>
              </div>
              <ul className="np-habit-list np-habit-list-wide">
                {(habits ?? []).map((h) => (
                  <li key={h.id} className={cn(h.completedToday && "np-done")}>
                    <span className="np-check">{h.completedToday ? "■" : "□"}</span>
                    <span className="np-habit-name">{h.name}</span>
                    <span className="np-habit-meta">
                      {h.dueToday ? "due" : "off"} · {h.streak}d
                    </span>
                  </li>
                ))}
                {!habits?.length ? <li className="np-muted">No active habits.</li> : null}
              </ul>
            </section>

            <section className="np-box np-span-2">
              <div className="np-section-head">
                <h2>Ledger</h2>
                <span>{bounds.monthKey}</span>
              </div>
              <dl className="np-stat-grid np-stat-grid-4">
                <div>
                  <dt>Net worth</dt>
                  <dd>{moneyCompact(netWorth.net)}</dd>
                </div>
                <div>
                  <dt>Month spent</dt>
                  <dd>{fmtMoney(monthSpend)}</dd>
                </div>
                <div>
                  <dt>Assets</dt>
                  <dd>{moneyCompact(netWorth.assets)}</dd>
                </div>
                <div>
                  <dt>Liabilities</dt>
                  <dd>{moneyCompact(netWorth.liabilities)}</dd>
                </div>
              </dl>
              <h3 className="np-kicker np-mt">Accounts</h3>
              <ul className="np-accounts np-accounts-wide">
                {(accounts.data ?? []).slice(0, 10).map((a) => (
                  <li key={a.id}>
                    <span>{a.name}</span>
                    <strong>{fmtMoney(Number(a.current_balance))}</strong>
                  </li>
                ))}
                {!accounts.data?.length ? (
                  <li className="np-muted">No accounts linked yet.</li>
                ) : null}
              </ul>
            </section>

            <section className="np-box np-colophon">
              <div className="np-section-head">
                <h2>Colophon</h2>
                <span>How this paper is made</span>
              </div>
              <div className="np-columns np-columns-2">
                <p>
                  <em>The Daily Command</em> is your personal morning paper inside Command Center —
                  agenda from Todoist, habit scoreboard, Marshfield weather, favorite-team
                  scoreboard, NL Central, reading progress, and finance snapshot.
                </p>
                <p>
                  Printed as three US Letter pages. Use the Print button for a physical copy, or
                  save as PDF. Data refreshes when you open the edition; tap Refresh for a new pull.
                  Vol. {volume} · No. {issue} · {editionDateline(day)}.
                </p>
              </div>
            </section>
          </div>

          <footer className="np-folio">
            <span>The Daily Command</span>
            <span>C · Life & ledger</span>
            <span>End of edition</span>
          </footer>
        </article>
      </div>
    </div>
  );
}
