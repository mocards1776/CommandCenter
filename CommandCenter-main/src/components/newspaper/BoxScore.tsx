import { useQuery } from "@tanstack/react-query";
import {
  fetchMlbAgate,
  type AgateSide,
  type BoxGame,
  type BoxPerson,
  type BoxSide,
  type StandGroup,
  gameClock,
} from "@/lib/newspaper-box";
import { cn } from "@/lib/utils";

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
            <th key={p} scope="col">
              {p}
            </th>
          ))}
          <th scope="col" className="tot">
            {isMlb ? "R" : "T"}
          </th>
          {isMlb && played ? (
            <>
              <th scope="col">H</th>
              <th scope="col">E</th>
            </>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {sides.map((side, i) => (
          <tr key={i} className={cn(side.winner && "won")}>
            <th scope="row" className="team">
              <Mark src={side.logo} size="xs" />
              <b>{compact ? side.abbrev : side.short}</b>
              {side.record ? <em>{side.record}</em> : null}
            </th>
            {periods.map((p, j) => (
              <td key={p}>{side.lines[j] ?? (played ? "–" : "")}</td>
            ))}
            <td className="tot">{side.score ?? "–"}</td>
            {isMlb && played ? (
              <>
                <td>{side.hits ?? "–"}</td>
                <td>{side.errors ?? "–"}</td>
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
            <b>{d.label}</b> {d.person.name}
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
            <b>{l.name}</b>
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

function AgateBatting({ side, team }: { side: AgateSide; team: BoxSide }) {
  if (!side.batters.length) return null;
  const tot = side.batters.reduce(
    (t, b) => ({ ab: t.ab + b.ab, r: t.r + b.r, h: t.h + b.h, rbi: t.rbi + b.rbi, bb: t.bb + b.bb, so: t.so + b.so }),
    { ab: 0, r: 0, h: 0, rbi: 0, bb: 0, so: 0 },
  );
  return (
    <table className="tt-agate">
      <thead>
        <tr>
          <th className="n">{team.short}</th>
          <th>AB</th>
          <th>R</th>
          <th>H</th>
          <th>BI</th>
          <th>BB</th>
          <th>SO</th>
          <th>Avg</th>
        </tr>
      </thead>
      <tbody>
        {side.batters.map((b) => (
          <tr key={b.id} className={cn(b.sub && "sub")}>
            <td className="n">
              {b.name} <i>{b.pos.toLowerCase()}</i>
            </td>
            <td>{b.ab}</td>
            <td>{b.r}</td>
            <td>{b.h}</td>
            <td>{b.rbi}</td>
            <td>{b.bb}</td>
            <td>{b.so}</td>
            <td>{b.avg ?? ""}</td>
          </tr>
        ))}
        <tr className="tot">
          <td className="n">Totals</td>
          <td>{tot.ab}</td>
          <td>{tot.r}</td>
          <td>{tot.h}</td>
          <td>{tot.rbi}</td>
          <td>{tot.bb}</td>
          <td>{tot.so}</td>
          <td />
        </tr>
      </tbody>
    </table>
  );
}

function AgatePitching({ side, team }: { side: AgateSide; team: BoxSide }) {
  if (!side.pitchers.length) return null;
  return (
    <table className="tt-agate">
      <thead>
        <tr>
          <th className="n">{team.short}</th>
          <th>IP</th>
          <th>H</th>
          <th>R</th>
          <th>ER</th>
          <th>BB</th>
          <th>SO</th>
          <th>ERA</th>
        </tr>
      </thead>
      <tbody>
        {side.pitchers.map((p) => (
          <tr key={p.id}>
            <td className="n">
              {p.name}
              {p.note ? <i> {p.note}</i> : null}
            </td>
            <td>{p.ip}</td>
            <td>{p.h}</td>
            <td>{p.r}</td>
            <td>{p.er}</td>
            <td>{p.bb}</td>
            <td>{p.so}</td>
            <td>{p.era ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
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
  const notes = (side: AgateSide, team: BoxSide) =>
    side.notes.length ? (
      <p className="tt-agate-notes">
        <b>{team.abbrev}</b>{" "}
        {side.notes.map((n) => (
          <span key={n.label}>
            <i>{n.label}</i> {n.value}.{" "}
          </span>
        ))}
      </p>
    ) : null;
  return (
    <div className="tt-agate-box">
      <div className="tt-agate-cols">
        <AgateBatting side={box.away} team={game.away} />
        <AgateBatting side={box.home} team={game.home} />
      </div>
      {notes(box.away, game.away)}
      {notes(box.home, game.home)}
      <div className="tt-agate-cols">
        <AgatePitching side={box.away} team={game.away} />
        <AgatePitching side={box.home} team={game.home} />
      </div>
      {box.info.length ? (
        <p className="tt-agate-notes">
          {box.info.map((n) => (
            <span key={n.label}>
              <i>{n.label}</i> {n.value}.{" "}
            </span>
          ))}
        </p>
      ) : null}
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
          <em>Read the story →</em>
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
                <i>{s.score ?? ""}</i>
              </span>
            ))}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Tonight's game as a matchup: crests, records, probables with season lines, TV. */
export function MatchupCard({ game }: { game: BoxGame }) {
  const sides = [
    { side: game.away, prob: game.probables.away },
    { side: game.home, prob: game.probables.home },
  ];
  const hasProbables = Boolean(game.probables.away || game.probables.home);
  return (
    <article className={cn("tt-matchup", game.live && "live")}>
      <header>
        <b>{gameClock(game)}</b>
        <span>{[game.round, game.series].filter(Boolean).join(" · ") || game.venue || ""}</span>
      </header>
      <div className="tt-matchup-teams">
        {sides.map(({ side }, i) => (
          <div key={i} className="tt-matchup-side" style={side.color ? { ["--tt-side" as string]: side.color } : undefined}>
            <Mark src={side.logo} size="lg" />
            <strong>{side.short}</strong>
            <em>{side.record || ""}</em>
            {game.live ? <span className="tt-matchup-score">{side.score}</span> : null}
          </div>
        ))}
        <span className="tt-matchup-at" aria-hidden="true">
          at
        </span>
      </div>
      {hasProbables ? (
        <div className="tt-matchup-probs">
          {sides.map(({ prob }, i) => (
            <div key={i} className="tt-prob">
              <Face person={prob} size="md" />
              <span>
                <b>{prob?.name ?? "TBD"}</b>
                <em>{prob?.line ?? ""}</em>
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <footer>
        {game.venue && (game.round || game.series) ? <span>{game.venue}</span> : null}
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
                <span className="bar" aria-hidden="true">
                  <i style={{ width: `${Math.round(row.bar * 100)}%` }} />
                </span>
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
