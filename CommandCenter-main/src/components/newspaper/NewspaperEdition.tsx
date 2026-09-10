/**
 * Thompson Times — the printed edition.
 *
 * Pure presentation: every value arrives already shaped by
 * `DailyNewspaperPage`, which is what lets `/newspaper-preview.html` render
 * the same markup from a fixture and lets print layout be checked without
 * live Todoist/Supabase/ESPN data.
 *
 * The document is one continuous flow. Page breaks are the printer's job —
 * see `src/styles/newspaper.css`.
 */

import { cn } from "@/lib/utils";

export type EditionSide = {
  abbrev: string;
  score: string | number | null;
  win?: boolean;
  record?: string | null;
};

export type EditionScore = {
  id: string;
  away: EditionSide;
  home: EditionSide;
  status: string;
  detail?: string | null;
};

export type EditionBoard = {
  key: string;
  label: string;
  note: string;
  games: EditionScore[];
  empty: string;
};

export type EditionEntry = {
  id: string;
  /** Left-hand rail: a time, a rank, a priority. */
  when?: string | null;
  title: string;
  /** Right-hand agate: a due date, a page count, a record. */
  value?: string | null;
  note?: string | null;
  late?: boolean;
  done?: boolean;
  mark?: string | null;
};

export type EditionTable = {
  key: string;
  title: string;
  note: string;
  columns: string[];
  rows: { key: string; cells: string[]; highlight?: boolean }[];
};

export type EditionData = {
  volume: number;
  issue: number;
  dateLabel: string;
  dateline: string;
  place: string;
  lede: string[];
  lead: { kicker: string; hed: string; dek: string };
  weather: {
    glyph: string;
    tempF: number;
    summary: string;
    days: { key: string; label: string; glyph: string; high: number; low: number }[];
  } | null;
  scoreboard: { figure: string; figureLabel: string; stats: { key: string; label: string; value: string }[] };
  dayBook: { today: EditionEntry[]; tomorrow: EditionEntry[]; empty: string };
  agenda: { entries: EditionEntry[]; note: string; empty: string };
  habits: { entries: EditionEntry[]; note: string; empty: string };
  teams: { entries: EditionEntry[]; note: string; empty: string };
  upcoming: { entries: EditionEntry[]; note: string; empty: string };
  boards: EditionBoard[];
  finals: { note: string; groups: { key: string; label: string; games: EditionScore[] }[]; empty: string };
  players: { entries: EditionEntry[]; note: string; empty: string };
  standings: { tables: EditionTable[]; empty: string };
  leaders: { boards: { key: string; label: string; entries: EditionEntry[] }[]; empty: string };
  reading: {
    stats: { key: string; label: string; value: string }[];
    summary: string;
    now: { entries: EditionEntry[]; note: string; empty: string };
    week: { entries: EditionEntry[]; note: string; empty: string };
    yesterday: { entries: EditionEntry[]; note: string } | null;
    onDeck: { entries: EditionEntry[]; note: string; empty: string };
  };
  dispatch: {
    kicker: string;
    hed: string;
    meta: string;
    paragraphs: string[];
    continued: boolean;
    wire: EditionEntry[];
    empty: string;
  };
};

function BriefHead({ title, note }: { title: string; note?: string | null }) {
  return (
    <div className="tt-brief-head">
      <h3>{title}</h3>
      {note ? <span>{note}</span> : null}
    </div>
  );
}

function Agate({
  entries,
  empty,
  stacked = false,
  narrow = false,
}: {
  entries: EditionEntry[];
  empty: string;
  /** Name and figure on one line, detail on the next. */
  stacked?: boolean;
  /** Left lane holds a tag or a rank rather than a clock time. */
  narrow?: boolean;
}) {
  if (!entries.length) return <p className="tt-empty">{empty}</p>;
  return (
    <ul className={cn("tt-agate", stacked && "tt-agate-stack", narrow && "tt-agate-narrow")}>
      {entries.map((e) => (
        <li key={e.id} className={cn(e.late && "tt-late", e.done && "tt-done")}>
          {e.mark ? <span className="mark">{e.mark}</span> : null}
          {e.when ? <span className="when">{e.when}</span> : null}
          <span className="t">{e.title}</span>
          {e.value ? <span className="m">{e.value}</span> : null}
          {e.note ? <span className="note">{e.note}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function Score({ game }: { game: EditionScore }) {
  return (
    <div className="tt-score">
      {[game.away, game.home].map((side, i) => (
        <div key={i} className={cn("tt-score-row", side.win && "win")}>
          <span className="team">
            <span>{side.abbrev}</span>
            {side.record ? <span className="rec">{side.record}</span> : null}
          </span>
          <span>{side.score ?? "—"}</span>
        </div>
      ))}
      <div className="tt-score-meta">
        {[game.status, game.detail].filter(Boolean).join(" · ")}
      </div>
    </div>
  );
}

function StatGrid({ stats }: { stats: { key: string; label: string; value: string }[] }) {
  return (
    <dl className="tt-stats">
      {stats.map((s) => (
        <div key={s.key}>
          <dt>{s.label}</dt>
          <dd>{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function NewspaperEdition({ data }: { data: EditionData }) {
  const wx = data.weather;

  return (
    <div className="tt-sheet">
      <article className="tt-edition">
        {/* ── Nameplate ─────────────────────────────────────────────── */}
        <header className="tt-mast">
          <div className="tt-mast-brow">
            <span>
              Vol. {data.volume} · No. {data.issue}
            </span>
            <span>{data.place}</span>
            <span>Printed daily</span>
          </div>
          <h1 className="tt-nameplate">Thompson Times</h1>
          <p className="tt-mast-motto">The day set in order before breakfast.</p>
          <div className="tt-mast-line">
            <span>Morning edition</span>
            <span>{data.dateLabel}</span>
            <span>
              {wx ? `${wx.glyph} ${wx.tempF}° · ${wx.summary}` : "Weather to come"}
            </span>
          </div>
        </header>

        {/* ── Front page: lead story and rail ───────────────────────── */}
        <section className="tt-section">
          <div className="tt-lead">
            <div className="tt-lead-main">
              <p className="tt-kicker">{data.lead.kicker}</p>
              <h2 className="tt-hed">{data.lead.hed}</h2>
              <p className="tt-dek">{data.lead.dek}</p>
              <div className="tt-body tt-flow-2">
                {data.lede.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>

              <div className="tt-story tt-story-open tt-story-rule">
                <BriefHead title="On the desk" note={data.agenda.note} />
                <div className="tt-flow-2">
                  <Agate entries={data.agenda.entries} empty={data.agenda.empty} narrow />
                </div>
              </div>
            </div>

            <aside className="tt-rail">
              <div className="tt-story">
                <BriefHead title="Weather" note={data.place} />
                {wx ? (
                  <>
                    <div className="tt-wx-now">
                      <span className="temp">{wx.tempF}°</span>
                      <span className="sky">
                        {wx.glyph} {wx.summary}
                      </span>
                    </div>
                    <ul className="tt-agate tt-wx-days">
                      {wx.days.map((d) => (
                        <li key={d.key}>
                          <span>{d.label}</span>
                          <span>{d.glyph}</span>
                          <span className="v">
                            {d.high}°/{d.low}°
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="tt-empty">Observations not in.</p>
                )}
              </div>

              <div className="tt-story">
                <BriefHead title="Scoreboard" note="Season to date" />
                <div className="tt-figure">
                  <strong>{data.scoreboard.figure}</strong>
                  <span>{data.scoreboard.figureLabel}</span>
                </div>
                <StatGrid stats={data.scoreboard.stats} />
              </div>

              <div className="tt-story">
                <BriefHead title="Standing orders" note={data.habits.note} />
                <Agate entries={data.habits.entries} empty={data.habits.empty} narrow />
              </div>
            </aside>
          </div>

          {/* Briefs below the fold, three columns wide */}
          <div className="tt-flow-3">
            <div className="tt-story">
              <BriefHead title="Day book" note="Today" />
              <Agate entries={data.dayBook.today} empty={data.dayBook.empty} />
              {data.dayBook.tomorrow.length ? (
                <>
                  <BriefHead title="Tomorrow" />
                  <Agate entries={data.dayBook.tomorrow} empty="" />
                </>
              ) : null}
            </div>

            <div className="tt-story tt-story-open">
              <BriefHead title="Clubhouse" note={data.teams.note} />
              <Agate entries={data.teams.entries} empty={data.teams.empty} stacked />
            </div>

            <div className="tt-story tt-story-open">
              <BriefHead title="Fixtures" note={data.upcoming.note} />
              <Agate entries={data.upcoming.entries} empty={data.upcoming.empty} stacked />
            </div>
          </div>
        </section>

        {/* ── Sports ────────────────────────────────────────────────── */}
        <section className="tt-section">
          <div className="tt-section-head">
            <h2>Sports</h2>
            <p>
              {data.dateline}
              <br />
              Scoreboards · Finals · Players
            </p>
          </div>

          <div className="tt-flow-3">
            {data.boards.map((board) => (
              <div key={board.key} className="tt-story tt-story-open">
                <BriefHead title={board.label} note={board.note} />
                {board.games.length ? (
                  board.games.map((g) => <Score key={g.id} game={g} />)
                ) : (
                  <p className="tt-empty">{board.empty}</p>
                )}
              </div>
            ))}

            <div className="tt-story tt-story-open">
              <BriefHead title="Finals" note={data.finals.note} />
              {data.finals.groups.length ? (
                data.finals.groups.map((group) => (
                  <div key={group.key} className="tt-story">
                    <p className="tt-kicker">{group.label}</p>
                    {group.games.map((g) => (
                      <Score key={g.id} game={g} />
                    ))}
                  </div>
                ))
              ) : (
                <p className="tt-empty">{data.finals.empty}</p>
              )}
            </div>

            <div className="tt-story tt-story-open">
              <BriefHead title="Followed players" note={data.players.note} />
              <Agate entries={data.players.entries} empty={data.players.empty} stacked />
            </div>
          </div>
        </section>

        {/* ── Standings and leaders ─────────────────────────────────── */}
        <section className="tt-section">
          <div className="tt-section-head">
            <h2>Standings</h2>
            <p>
              Divisions · Playoff odds
              <br />
              League leaders
            </p>
          </div>

          <div className="tt-flow-3">
            {data.standings.tables.length ? (
              data.standings.tables.map((table) => (
                <div key={table.key} className="tt-story">
                  <BriefHead title={table.title} note={table.note} />
                  <table className="tt-table">
                    <thead>
                      <tr>
                        {table.columns.map((c) => (
                          <th key={c}>{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.map((r) => (
                        <tr key={r.key} className={cn(r.highlight && "me")}>
                          {r.cells.map((cell, i) => (
                            <td key={i}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            ) : (
              <p className="tt-empty">{data.standings.empty}</p>
            )}

            {data.leaders.boards.length
              ? data.leaders.boards.map((b) => (
                  <div key={b.key} className="tt-story">
                    <BriefHead title={b.label} note="MLB" />
                    <Agate entries={b.entries} empty="" />
                  </div>
                ))
              : null}
          </div>
        </section>

        {/* ── Reading ───────────────────────────────────────────────── */}
        <section className="tt-section">
          <div className="tt-section-head">
            <h2>Reading</h2>
            <p>
              Pages · Shelf
              <br />
              On deck
            </p>
          </div>

          <div className="tt-flow-3">
            <div className="tt-story">
              <BriefHead title="The ledger" note="Pages" />
              <StatGrid stats={data.reading.stats} />
              <p className="tt-empty tt-note">{data.reading.summary}</p>
            </div>

            <div className="tt-story">
              <BriefHead title="Currently reading" note={data.reading.now.note} />
              <Agate entries={data.reading.now.entries} empty={data.reading.now.empty} stacked />
            </div>

            <div className="tt-story">
              <BriefHead title="Pages this week" note={data.reading.week.note} />
              <Agate entries={data.reading.week.entries} empty={data.reading.week.empty} />
              {data.reading.yesterday ? (
                <>
                  <BriefHead title="Yesterday" note={data.reading.yesterday.note} />
                  <Agate entries={data.reading.yesterday.entries} empty="" />
                </>
              ) : null}
            </div>

            <div className="tt-story">
              <BriefHead title="On deck" note={data.reading.onDeck.note} />
              <Agate entries={data.reading.onDeck.entries} empty={data.reading.onDeck.empty} />
            </div>
          </div>
        </section>

        {/* ── Dispatch: the long read ───────────────────────────────── */}
        <section
          className={cn("tt-section", data.dispatch.paragraphs.length && "tt-section-page")}
        >
          <div className="tt-section-head">
            <h2>Dispatch</h2>
            <p>
              {data.dateline}
              <br />
              Missouri Scout
            </p>
          </div>

          {data.dispatch.paragraphs.length ? (
            <>
              <p className="tt-kicker">{data.dispatch.kicker}</p>
              <h3 className="tt-hed">{data.dispatch.hed}</h3>
              <p className="tt-byline">{data.dispatch.meta}</p>
              <div className="tt-dispatch-body tt-flow-3">
                {data.dispatch.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
              {data.dispatch.continued ? (
                <p className="tt-continued">Continued in Missouri Scout</p>
              ) : null}
            </>
          ) : (
            <p className="tt-empty">{data.dispatch.empty}</p>
          )}

          {data.dispatch.wire.length ? (
            <div className="tt-story tt-story-rule">
              <BriefHead title="Also on the wire" note={`${data.dispatch.wire.length} filed`} />
              <div className="tt-flow-3">
                <Agate entries={data.dispatch.wire} empty="" stacked />
              </div>
            </div>
          ) : null}
        </section>

        <footer className="tt-colophon">
          <span>Thompson Times</span>
          <span>{data.dateline}</span>
          <span>End of edition</span>
        </footer>
      </article>
    </div>
  );
}
