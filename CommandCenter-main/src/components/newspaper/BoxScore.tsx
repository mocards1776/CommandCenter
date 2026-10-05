import { useQuery } from "@tanstack/react-query";
import {
  fetchMlbAgate,
  type BoxGame,
  type BoxPerson,
  type BoxSide,
  type StandGroup,
  gameClock,
  gameDay,
} from "@/lib/newspaper-box";
import {
  agateMinWidth,
  agateWidths,
  keyStats,
  mlbBattingTable,
  mlbPitchingTable,
  statSplit,
  type AgatePair,
  type AgateTable,
  type EspnBox,
  type NamePiece,
  type ScoringPeriod,
  type StarPick,
} from "@/lib/newspaper-agate";
import { cn } from "@/lib/utils";
import { PersonName } from "./PlayerPop";
import "./box-agate.css";

function Mark({ src, size = "sm" }: { src: string | null | undefined; size?: "xs" | "sm" | "md" | "lg" }) {
  if (!src) return <span className={cn("tt-mark", size, "empty")} aria-hidden="true" />;
  return (
    <img
      src={src}
      alt=""
      className={cn("tt-mark", size)}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        e.currentTarget.style.visibility = "hidden";
      }}
    />
  );
}

export function Face({ person, size = "md" }: { person: BoxPerson | null | undefined; size?: "sm" | "md" | "lg" }) {
  if (!person?.headshot) return <span className={cn("tt-face", size, "empty")} aria-hidden="true" />;
  return (
    <img
      src={person.headshot}
      alt=""
      className={cn("tt-face", size)}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        e.currentTarget.style.visibility = "hidden";
      }}
    />
  );
}

/** The inning-by-inning (or period-by-period) line with the totals. */
export function Linescore({ game, compact }: { game: BoxGame; compact?: boolean }) {
  const isMlb = game.path === "baseball/mlb";
  const played = game.final || game.live;
  const sides: BoxSide[] = [game.away, game.home];
  const hasLines = sides.some((s) => s.lines.some((v) => v != null));
  const periods = played && hasLines ? game.periods : [];
  return (
    <table className={cn("tt-line", compact && "compact")}>
      <thead>
        <tr>
          <th className="team" scope="col">
            <span className="sr-only">Team</span>
          </th>
          {periods.map((p) => (
            <th key={p} scope="col" className="per">
              {p}
            </th>
          ))}
          <th scope="col" className="tot">
            {isMlb ? "R" : "T"}
          </th>
          {isMlb && played ? (
            <>
              <th scope="col" className="rhe">
                H
              </th>
              <th scope="col" className="rhe">
                E
              </th>
            </>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {sides.map((side, i) => (
          <tr key={i} className={cn(side.winner && "won")}>
            <th scope="row" className="team">
              <span className="tt-line-team">
                <Mark src={side.logo} size="xs" />
                <b>{compact ? side.abbrev : side.short}</b>
                {side.record ? <em>{side.record}</em> : null}
              </span>
            </th>
            {periods.map((p, j) => (
              <td key={p} className="per">
                {side.lines[j] ?? (played ? "–" : "")}
              </td>
            ))}
            <td className="tot">{side.score ?? "–"}</td>
            {isMlb && played ? (
              <>
                <td className="rhe">{side.hits ?? "–"}</td>
                <td className="rhe">{side.errors ?? "–"}</td>
              </>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Decisions({ game, faces }: { game: BoxGame; faces?: boolean }) {
  if (!game.decisions.length) return null;
  return (
    <ul className={cn("tt-decisions", faces && "faces")}>
      {game.decisions.map((d) => (
        <li key={d.label}>
          {faces ? <Face person={d.person} size="sm" /> : null}
          <span>
            <b>{d.label}</b> <PersonName path={game.path} id={d.person.id} name={d.person.name} />
            {d.person.line ? <em> ({d.person.line.replace(/ ERA$/, "")})</em> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Leaders({ game, max = 3 }: { game: BoxGame; max?: number }) {
  if (!game.leaders.length) return null;
  return (
    <ul className="tt-leaders">
      {game.leaders.slice(0, max).map((l) => (
        <li key={`${l.label}-${l.name}`}>
          <Face person={l} size="sm" />
          <span>
            <em>
              {l.label}
              {l.team ? ` · ${l.team}` : ""}
            </em>
            <b>
              <PersonName path={game.path} id={l.id} name={l.name} />
            </b>
            <i>{l.line}</i>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Goals({ game }: { game: BoxGame }) {
  if (!game.scoring.length) return null;
  const by = (abbrev: string) => game.scoring.filter((g) => g.team === abbrev).map((g) => g.text);
  const away = by(game.away.abbrev);
  const home = by(game.home.abbrev);
  return (
    <p className="tt-goals">
      {away.length ? (
        <span>
          <b>{game.away.abbrev}</b> {away.join(", ")}
        </span>
      ) : null}
      {home.length ? (
        <span>
          <b>{game.home.abbrev}</b> {home.join(", ")}
        </span>
      ) : null}
    </p>
  );
}

function AgateGrid({
  table,
  widths,
  path,
  className,
}: {
  table: AgateTable;
  widths: string[];
  path: string;
  className?: string;
}) {
  return (
    <div className="tt-agate-wrap">
      <table className={cn("tt-agate", className)} style={{ minWidth: agateMinWidth(widths) }}>
        <colgroup>
          <col />
          {widths.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="n" scope="col">
              {table.title}
            </th>
            {table.columns.map((c, i) => (
              <th key={i} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={`${r.id ?? r.name}-${i}`} className={cn(r.sub && "sub")}>
              <td className="n">
                {r.lead ? <i className="lead">{r.lead}</i> : null}
                <PersonName path={path} id={r.id} name={r.name} />
                {r.note ? <i> {r.note}</i> : null}
              </td>
              {r.cells.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {table.totals ? (
          <tfoot>
            <tr className="tot">
              <td className="n">Totals</td>
              {table.totals.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

/** Two clubs' tables of one kind, side by side on shared column widths. */
function AgateTwin({
  away,
  home,
  path,
  label,
}: {
  away: AgateTable | null;
  home: AgateTable | null;
  path: string;
  label?: string | null;
}) {
  if (!away && !home) return null;
  const widths = agateWidths([away, home]);
  return (
    <div className="tt-agate-group">
      {label ? <h4 className="tt-agate-kicker">{label}</h4> : null}
      <div className="tt-agate-cols">
        {away ? <AgateGrid table={away} widths={widths} path={path} /> : <div aria-hidden="true" />}
        {home ? <AgateGrid table={home} widths={widths} path={path} /> : <div aria-hidden="true" />}
      </div>
    </div>
  );
}

function AgateNotes({ notes, team }: { notes: { label: string; value: string }[]; team?: string }) {
  if (!notes.length) return null;
  return (
    <p className="tt-agate-notes">
      {team ? <b>{team} </b> : null}
      {notes.map((n) => (
        <span key={n.label}>
          <i>{n.label}</i> {n.value}.{" "}
        </span>
      ))}
    </p>
  );
}

/** The full MLB box, set in agate the way the morning paper runs it. */
export function MlbAgate({ game, enabled = true }: { game: BoxGame; enabled?: boolean }) {
  const q = useQuery({
    queryKey: ["tt-mlb-agate", game.gamePk],
    queryFn: () => fetchMlbAgate(game.gamePk!),
    enabled: enabled && game.gamePk != null && (game.final || game.live),
    staleTime: game.final ? 60 * 60_000 : 60_000,
  });
  const box = q.data;
  if (!box) {
    return q.isLoading && enabled ? <p className="tt-agate-wait">Setting the box…</p> : null;
  }
  return (
    <div className="tt-agate-box">
      <AgateTwin
        away={mlbBattingTable(box.away, game.away)}
        home={mlbBattingTable(box.home, game.home)}
        path={game.path}
      />
      <AgateNotes notes={box.away.notes} team={game.away.abbrev} />
      <AgateNotes notes={box.home.notes} team={game.home.abbrev} />
      <AgateTwin
        away={mlbPitchingTable(box.away, game.away)}
        home={mlbPitchingTable(box.home, game.home)}
        path={game.path}
      />
      <AgateNotes notes={box.info} />
    </div>
  );
}

function Pieces({ pieces, path }: { pieces: NamePiece[]; path: string }) {
  return (
    <>
      {pieces.map((p, i) =>
        typeof p === "string" ? p : <PersonName key={i} path={path} id={p.id} name={p.name} />,
      )}
    </>
  );
}

function ScoringTable({ periods, game, path }: { periods: ScoringPeriod[]; game: BoxGame; path: string }) {
  if (!periods.length) return null;
  return (
    <div className="tt-agate-group">
      <h4 className="tt-agate-kicker">Scoring</h4>
      <div className="tt-agate-wrap">
        <table className="tt-agate tt-agate-plays">
          <colgroup>
            <col className="c-team" />
            <col className="c-clock" />
            <col />
            <col className="c-tag" />
            <col className="c-score" />
          </colgroup>
          <thead>
            <tr>
              <th className="n" scope="col">
                Team
              </th>
              <th scope="col">Time</th>
              <th className="n" scope="col">
                Play
              </th>
              <th scope="col">
                <span className="sr-only">Type</span>
              </th>
              <th scope="col">
                {game.away.abbrev}-{game.home.abbrev}
              </th>
            </tr>
          </thead>
          {periods.map((period) => (
            <tbody key={period.label}>
              <tr className="per">
                <th colSpan={5} scope="rowgroup">
                  {period.label}
                </th>
              </tr>
              {period.plays.map((play, i) => (
                <tr key={i}>
                  <td className="n team">{play.team}</td>
                  <td>{play.clock}</td>
                  <td className="n play">
                    <Pieces pieces={play.lead} path={path} />
                    {play.detail.length ? (
                      <i>
                        {" "}
                        <Pieces pieces={play.detail} path={path} />
                      </i>
                    ) : null}
                  </td>
                  <td className="tag">{play.tag ? <span>{play.tag}</span> : null}</td>
                  <td className="score">{play.score}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}

const STAR_LABEL = ["First star", "Second star", "Third star"];

/** The three stars, set like the leaders strip at the top of the reader's box. */
export function Stars({ stars, path }: { stars: StarPick[]; path: string }) {
  if (!stars.length) return null;
  return (
    <ul className="tt-leaders">
      {stars.map((s) => (
        <li key={s.rank}>
          <Face person={s.person} size="sm" />
          <span>
            <em>
              {STAR_LABEL[s.rank - 1]}
              {s.team ? ` · ${s.team}` : ""}
            </em>
            <b>
              <PersonName path={path} id={s.person.id} name={s.person.name} />
            </b>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A line of team numbers under the linescore: yards and turnovers, shots and power plays. */
export function KeyStats({ box }: { box: EspnBox }) {
  const rows = keyStats(box);
  if (!rows.length) return null;
  return (
    <dl className="tt-keystats">
      <div className="head">
        <dt>
          <span className="sr-only">Team stats</span>
        </dt>
        <dd>
          {box.game.away.abbrev}
          <span aria-hidden="true">–</span>
          {box.game.home.abbrev}
        </dd>
      </div>
      {rows.map((r) => (
        <div key={r.label}>
          <dt>{r.label}</dt>
          <dd>
            {r.away}
            <span aria-hidden="true">–</span>
            {r.home}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** NFL and NHL box: scoring by period, team stats, and every club's agate. */
export function EspnAgate({ box, path }: { box: EspnBox; path: string }) {
  const { game } = box;
  const stat = (rows: EspnBox["teamStats"], title: string): AgateTable => ({
    title,
    columns: [game.away.abbrev, game.home.abbrev],
    rows: rows.map((r) => ({ id: null, name: r.label, sub: r.sub, cells: [r.away, r.home] })),
    totals: null,
  });
  const hockey = path.startsWith("hockey/");
  const half = hockey ? box.teamStats.length : statSplit(box.teamStats);
  const statsA = box.teamStats.length ? stat(box.teamStats.slice(0, half), "Team stats") : null;
  const statsB = box.teamStats.length > half ? stat(box.teamStats.slice(half), "") : null;
  const shots: AgateTable | null = box.shots
    ? {
        title: "Shots on goal",
        columns: [...box.shots.periods, "T"],
        rows: [
          { id: null, name: game.away.short, cells: [...box.shots.away.map((v) => (v == null ? "–" : String(v))), box.shots.awayTotal] },
          { id: null, name: game.home.short, cells: [...box.shots.home.map((v) => (v == null ? "–" : String(v))), box.shots.homeTotal] },
        ],
        totals: null,
      }
    : null;
  const stars: AgateTable | null = box.stars.length
    ? {
        title: "Three stars",
        columns: ["Team"],
        rows: box.stars.map((s) => ({ id: s.person.id, name: s.person.name, lead: `${s.rank}.`, cells: [s.team ?? ""] })),
        totals: null,
      }
    : null;
  return (
    <div className="tt-agate-box">
      <ScoreMast game={game} />
      <ScoringTable periods={box.scoring} game={game} path={path} />
      {hockey ? (
        <div className="tt-agate-cols">
          <div className="tt-agate-stack">
            {shots ? <AgateGrid table={shots} widths={agateWidths([shots])} path={path} className="shots" /> : null}
            {stars ? <AgateGrid table={stars} widths={agateWidths([stars])} path={path} /> : null}
          </div>
          {statsA ? <AgateGrid table={statsA} widths={agateWidths([statsA])} path={path} className="stats" /> : <div />}
        </div>
      ) : statsA ? (
        <div className="tt-agate-cols">
          <AgateGrid table={statsA} widths={agateWidths([statsA, statsB])} path={path} className="stats" />
          {statsB ? (
            <AgateGrid table={statsB} widths={agateWidths([statsA, statsB])} path={path} className="stats" />
          ) : (
            <div />
          )}
        </div>
      ) : null}
      {box.pairs.map((pair: AgatePair) => (
        <AgateTwin key={pair.key} away={pair.away} home={pair.home} path={path} label={pair.label} />
      ))}
      <AgateNotes notes={box.info} />
    </div>
  );
}

function sidePaint(color: string | null): string {
  if (!color) return "#1f2a44";
  return color.startsWith("#") ? color : `#${color}`;
}

/** The final the way the sports pages set it: both clubs, their marks, the score. */
export function ScoreMast({ game }: { game: BoxGame }) {
  return (
    <div className="tt-score-mast">
      {[game.away, game.home].map((side, i) => (
        <div key={i} className={cn("tt-score-mast-side", side.winner && "won", game.final && !side.winner && "lost")} style={{ background: sidePaint(side.color) }}>
          <Mark src={side.logo} size="lg" />
          <span>
            <em>{i === 0 ? "Away" : "Home"}</em>
            <strong>{side.short}</strong>
          </span>
          <b>{side.score ?? "–"}</b>
        </div>
      ))}
      <span className="tt-score-mast-state">{gameClock(game)}</span>
    </div>
  );
}

function headOf(game: BoxGame): string {
  const bits = [game.round, game.series].filter(Boolean);
  if (bits.length) return bits.join(" · ");
  return game.venue ?? game.league;
}

/** A finished (or running) game: line, decisions or leaders, the recap headline. */
export function ScoreCard({
  game,
  onOpen,
  agate,
  agateEnabled,
}: {
  game: BoxGame;
  onOpen?: (game: BoxGame) => void;
  agate?: boolean;
  agateEnabled?: boolean;
}) {
  return (
    <article className={cn("tt-scorecard", game.live && "live")}>
      <header>
        <span>{headOf(game)}</span>
        <b>{gameClock(game)}</b>
      </header>
      <Linescore game={game} compact />
      <Decisions game={game} />
      <Goals game={game} />
      {!game.decisions.length ? <Leaders game={game} max={2} /> : null}
      {game.recap ? (
        <button type="button" className="tt-scorecard-recap" onClick={() => onOpen?.(game)}>
          <strong>{game.recap.headline}</strong>
          {game.recap.blurb ? <span>{game.recap.blurb}</span> : null}
          <em>Click for full story →</em>
        </button>
      ) : onOpen && (game.final || game.live) ? (
        <button type="button" className="tt-scorecard-recap" onClick={() => onOpen(game)}>
          <em>Box score →</em>
        </button>
      ) : null}
      {agate && game.path === "baseball/mlb" ? <MlbAgate game={game} enabled={agateEnabled} /> : null}
    </article>
  );
}

/** Mini scoreboard tiles: last night at a glance. */
export function ScoreStrip({ games, onOpen }: { games: BoxGame[]; onOpen?: (game: BoxGame) => void }) {
  if (!games.length) return null;
  return (
    <ul className="tt-strip">
      {games.map((g) => (
        <li key={g.id}>
          <button type="button" onClick={() => onOpen?.(g)} disabled={!g.recap && !onOpen}>
            <span className="tt-strip-st">{gameClock(g)}</span>
            {[g.away, g.home].map((s, i) => (
              <span key={i} className={cn("tt-strip-row", s.winner && "won")}>
                <Mark src={s.logo} size="xs" />
                <b>{s.abbrev}</b>
                <i>{g.final || g.live ? s.score ?? "" : ""}</i>
              </span>
            ))}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Tonight's game as a matchup: crests, records, series, probables with season lines, venue, TV. */
export function MatchupCard({ game }: { game: BoxGame }) {
  const sides = [
    { side: game.away, prob: game.probables.away, align: "away" as const },
    { side: game.home, prob: game.probables.home, align: "home" as const },
  ];
  const series = [game.round, game.series].filter(Boolean).join(" · ");
  const when = [gameDay(game), gameClock(game)].filter(Boolean).join(" · ");
  const baseball = game.path === "baseball/mlb";
  const hasProbables = Boolean(game.probables.away || game.probables.home);
  return (
    <article className={cn("tt-matchup", game.live && "live")}>
      {series ? <p className="tt-matchup-series">{series}</p> : null}
      <header>
        <b>
          {gameDay(game) ? <time dateTime={game.startIso ?? undefined}>{when}</time> : when}
        </b>
      </header>
      <div className="tt-matchup-teams">
        {sides.map(({ side, align }) => (
          <div
            key={align}
            className={cn("tt-matchup-side", align)}
            style={side.color ? { ["--tt-side" as string]: side.color } : undefined}
          >
            <Mark src={side.logo} size="lg" />
            <div className="tt-matchup-who">
              <strong>{side.short}</strong>
              <em>{side.record || ""}</em>
            </div>
            {game.live ? <span className="tt-matchup-score">{side.score}</span> : null}
          </div>
        ))}
        <span className="tt-matchup-at" aria-hidden="true">
          at
        </span>
      </div>
      {baseball || hasProbables ? (
        <div className="tt-matchup-probs">
          <p className="tt-matchup-probs-label">{baseball ? "Probable pitchers" : "Probables"}</p>
          <div className="tt-matchup-probs-row">
            {sides.map(({ prob, align }) => (
              <div key={align} className={cn("tt-prob", align)}>
                <Face person={prob} size="lg" />
                <span>
                  <b>{prob ? <PersonName path={game.path} id={prob.id} name={prob.name} /> : "TBD"}</b>
                  <em>{prob?.line || (baseball ? "Line pending" : "")}</em>
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <footer>
        {game.venue ? <span>{game.venue}</span> : <span />}
        {game.broadcasts.length ? <span className="tv">{game.broadcasts.join(" · ")}</span> : null}
      </footer>
    </article>
  );
}

export function StandingsTable({
  group,
  mine,
}: {
  group: StandGroup;
  mine: (row: { id: string; abbrev: string; name: string }) => boolean;
}) {
  return (
    <table className="tt-stand">
      <caption>{group.name}</caption>
      <thead>
        <tr>
          <th className="team" scope="col">
            Team
          </th>
          {group.columns.map((c) => (
            <th key={c} scope="col">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {group.rows.map((row, i) => (
          <tr key={row.id || i} className={cn(mine(row) && "me")}>
            <th scope="row" className="team">
              <div className="cell">
                <span className="rk">{i + 1}</span>
                <Mark src={row.logo} size="xs" />
                <b>{row.name}</b>
                {row.clinch && row.clinch !== "-" ? <sup>{row.clinch}</sup> : null}
              </div>
            </th>
            {row.cells.map((c, j) => (
              <td key={j}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
