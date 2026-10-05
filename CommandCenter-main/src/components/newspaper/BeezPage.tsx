import {
  buildBeezHeadline,
  clockOrTba,
  clubName,
  creditLine,
  hockeyRecord,
  isBeezRow,
  printDate,
  teamGameNumber,
  wpctLabel,
  type BeezDesk,
  type BeezGoalie,
  type BeezLastGame,
  type BeezUpcoming,
} from "@/lib/newspaper-beez";
import "./beez.css";

function vsLine(homeAway: "home" | "away", opponent: string): string {
  return homeAway === "home" ? `vs ${opponent}` : `at ${opponent}`;
}

function periodLabels(n: number): string[] {
  return Array.from({ length: n }, (_, i) => (i < 3 ? String(i + 1) : i === 3 ? "OT" : `OT${i - 2}`));
}

function LastGame({ game, club, desk }: { game: BeezLastGame; club: string; desk: BeezDesk }) {
  const n = Math.max(game.periods.home.length, game.periods.away.length);
  const labels = periodLabels(n);
  const sides = [
    { name: game.away || "Away", score: game.away_score, periods: game.periods.away, shots: game.shots.away, pim: game.pim.away, me: isBeezRow(game.away, club) },
    { name: game.home || "Home", score: game.home_score, periods: game.periods.home, shots: game.shots.home, pim: game.pim.home, me: isBeezRow(game.home, club) },
  ];
  const meta: string[] = [];
  if (game.date) meta.push(printDate(game.date));
  if (game.time) meta.push(clockOrTba(game.time));
  if (game.stage) meta.push(game.stage);
  const gameNo = teamGameNumber(desk, game);
  if (gameNo != null) meta.push(`Game ${gameNo}`);
  const title = (
    <h3 className="wsj-band-title">Last Game</h3>
  );

  return (
    <section className="tt-beez-box" aria-label="Last game">
      {game.url ? (
        <a href={game.url} target="_blank" rel="noreferrer" className="tt-beez-box-link">
          {title}
        </a>
      ) : (
        title
      )}
      {meta.length ? <p className="tt-beez-box-meta">{meta.join(" · ")}</p> : null}
      <table className="tt-beez-line">
        <thead>
          <tr>
            <th className="team" scope="col">
              <span className="sr-only">Team</span>
            </th>
            {labels.map((p) => (
              <th key={p} scope="col" className="per">
                {p}
              </th>
            ))}
            <th scope="col" className="tot">
              T
            </th>
          </tr>
        </thead>
        <tbody>
          {sides.map((side) => (
            <tr key={side.name} className={side.me ? "me" : undefined}>
              <th scope="row" className="team">
                {side.name}
              </th>
              {labels.map((_, i) => (
                <td key={i} className="per">
                  {side.periods[i] ?? "–"}
                </td>
              ))}
              <td className="tot">{side.score ?? "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="tt-beez-box-agate">
        {game.shots.home != null || game.shots.away != null ? (
          <span>
            Shots {game.shots.away ?? "–"}–{game.shots.home ?? "–"}
          </span>
        ) : null}
        {game.pim.home != null || game.pim.away != null ? (
          <span>
            PIM {game.pim.away ?? "–"}–{game.pim.home ?? "–"}
          </span>
        ) : null}
        {game.rink ? <span>{game.rink}</span> : null}
        {game.referee ? <span>Ref {game.referee}</span> : null}
      </p>
    </section>
  );
}

function NextUp({ games }: { games: BeezUpcoming[] }) {
  const [next, ...rest] = games;
  if (!next) {
    return (
      <section className="tt-beez-next" aria-label="Next up">
        <h3 className="wsj-band-title">Next Up</h3>
        <p className="tt-beez-empty-line">Nothing on the slate.</p>
      </section>
    );
  }
  return (
    <section className="tt-beez-next" aria-label="Next up">
      <h3 className="wsj-band-title">Next Up</h3>
      <p className="tt-beez-next-flag">{next.home_away === "home" ? "Home" : "Away"}</p>
      <h4>{vsLine(next.home_away, next.opponent)}</h4>
      <p className="tt-beez-next-when">
        <b>{next.date ? printDate(next.date) : "Date TBA"}</b>
        <span>{clockOrTba(next.time)}</span>
      </p>
      {next.rink ? <p className="tt-beez-next-rink">{next.rink}</p> : null}
      {rest.length ? (
        <ol className="tt-beez-next-rest">
          {rest.map((g, i) => (
            <li key={`${g.date}-${g.opponent}-${i}`}>
              <b>{g.date ? printDate(g.date) : "TBA"}</b>
              <span>{vsLine(g.home_away, g.opponent)}</span>
              <em>{clockOrTba(g.time)}</em>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function goalieStat(g: BeezGoalie, key: string): string | null {
  const v = g[key];
  if (typeof v === "number" && Number.isFinite(v)) {
    if (key === "svpct" || key === "sv%") return wpctLabel(v);
    if (key === "gaa") return v.toFixed(2);
    return String(v);
  }
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function Goalies({ rows }: { rows: BeezGoalie[] }) {
  if (!rows.length) return null;
  const extras = ["w", "l", "t", "so", "ga", "gaa", "sv", "sa", "svpct"] as const;
  const used = extras.filter((key) => rows.some((g) => goalieStat(g, key) != null));
  return (
    <section className="tt-beez-goalies" aria-label="Goaltending">
      <h3 className="wsj-band-title">Goaltending</h3>
      <table>
        <thead>
          <tr>
            <th className="num">#</th>
            <th className="name">Goalie</th>
            <th>GP</th>
            {used.map((key) => (
              <th key={key}>{key === "svpct" ? "SV%" : key.toUpperCase()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((g, i) => (
            <tr key={`${g.name}-${i}`} className={g.is_josh ? "josh" : undefined}>
              <td className="num">{g.number ?? "–"}</td>
              <th className="name" scope="row">
                {g.name}
              </th>
              <td>{g.gp}</td>
              {used.map((key) => (
                <td key={key}>{goalieStat(g, key) ?? "–"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default function BeezPage({ desk, editionLabel }: { desk: BeezDesk; editionLabel: string }) {
  const club = clubName(desk);
  const hed = buildBeezHeadline(desk);
  const rec = hockeyRecord(desk.team);
  const empty =
    !desk.last_game &&
    !desk.results.length &&
    !desk.standings.length &&
    !desk.skaters.length &&
    !desk.goalies.length &&
    !desk.upcoming.length;

  return (
    <div className="tt-beez">
      <header className="tt-beez-head">
        <p className="tt-beez-kicker">
          The Beez · {hed.kicker} · {editionLabel}
        </p>
        <h2>{hed.headline}</h2>
        <p className="tt-beez-dek">{hed.dek}</p>
        {desk.team.gp || desk.team.w + desk.team.l + desk.team.t ? (
          <p className="tt-beez-record">
            {rec}
            {desk.team.pts != null ? ` · ${desk.team.pts} pts` : ""}
            {desk.team.gf || desk.team.ga ? ` · ${desk.team.gf}–${desk.team.ga}` : ""}
          </p>
        ) : null}
      </header>

      {empty ? (
        <section className="tt-beez-empty" aria-label="Season not posted">
          <p className="tt-beez-orn" aria-hidden>
            ❦
          </p>
          <h3>The season has not been posted</h3>
          <p>
            No scores, standings or dates on file
            {desk.season ? ` for ${desk.season}` : ""}
            {desk.division ? ` · ${desk.division}` : ""}.
          </p>
        </section>
      ) : (
        <>
          <div className="tt-beez-top">
            {desk.last_game ? <LastGame game={desk.last_game} club={club} desk={desk} /> : <section className="tt-beez-box" aria-label="Last game">
              <h3 className="wsj-band-title">Last Game</h3>
              <p className="tt-beez-empty-line">No result on file.</p>
            </section>}
            <NextUp games={desk.upcoming} />
          </div>

          {desk.standings.length ? (
            <section className="tt-beez-standings" aria-label="Standings">
              <h3 className="wsj-band-title">{desk.division || "Standings"}</h3>
              <table>
                <thead>
                  <tr>
                    <th className="rk"> </th>
                    <th className="name">Team</th>
                    <th>GP</th>
                    <th>W</th>
                    <th>L</th>
                    <th>T</th>
                    <th>OTL</th>
                    <th>PTS</th>
                    <th>PCT</th>
                    <th>GF</th>
                    <th>GA</th>
                    <th>PIM</th>
                  </tr>
                </thead>
                <tbody>
                  {desk.standings.map((row, i) => (
                    <tr key={`${row.team}-${i}`} className={isBeezRow(row.team, club) ? "me" : undefined}>
                      <td className="rk">{i + 1}</td>
                      <th className="name" scope="row">
                        {row.team}
                      </th>
                      <td>{row.gp}</td>
                      <td>{row.w}</td>
                      <td>{row.l}</td>
                      <td>{row.t}</td>
                      <td>{row.otl}</td>
                      <td className="pts">{row.pts}</td>
                      <td>{wpctLabel(row.wpct)}</td>
                      <td>{row.gf}</td>
                      <td>{row.ga}</td>
                      <td>{row.pim}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : (
            <section className="tt-beez-standings" aria-label="Standings">
              <h3 className="wsj-band-title">{desk.division || "Standings"}</h3>
              <p className="tt-beez-empty-line">Standings have not been posted.</p>
            </section>
          )}

          <div className="tt-beez-bottom">
            <section className="tt-beez-skaters" aria-label="Scoring leaders">
              <h3 className="wsj-band-title">Scoring Leaders</h3>
              {desk.skaters.length ? (
                <table>
                  <thead>
                    <tr>
                      <th className="num">#</th>
                      <th className="name">Player</th>
                      <th>GP</th>
                      <th>G</th>
                      <th>A</th>
                      <th>P</th>
                      <th>PIM</th>
                      <th>P/G</th>
                    </tr>
                  </thead>
                  <tbody>
                    {desk.skaters.map((s, i) => (
                      <tr key={`${s.name}-${i}`} className={s.is_josh ? "josh" : undefined}>
                        <td className="num">{s.number ?? "–"}</td>
                        <th className="name" scope="row">
                          {s.name}
                        </th>
                        <td>{s.gp}</td>
                        <td>{s.g}</td>
                        <td>{s.a}</td>
                        <td className="pts">{s.p}</td>
                        <td>{s.pim}</td>
                        <td>{s.ptsg != null ? s.ptsg.toFixed(2) : "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="tt-beez-empty-line">No scoring ledger yet.</p>
              )}
              <Goalies rows={desk.goalies} />
            </section>

            <section className="tt-beez-results" aria-label="Results">
              <h3 className="wsj-band-title">Results</h3>
              {desk.results.length ? (
                <ol>
                  {desk.results.map((r, i) => (
                    <li key={`${r.date}-${r.opponent}-${i}`}>
                      <b className={r.result === "W" ? "w" : r.result === "L" ? "l" : r.result === "T" ? "t" : undefined}>
                        {r.result ?? "–"}
                      </b>
                      <span>
                        {vsLine(r.home_away, r.opponent)}
                        {r.beez != null && r.opp != null ? ` · ${r.beez}–${r.opp}` : ""}
                      </span>
                      <em>
                        {r.date ? printDate(r.date) : ""}
                        {r.rink ? ` · ${r.rink}` : ""}
                      </em>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="tt-beez-empty-line">No results on file.</p>
              )}
            </section>
          </div>
        </>
      )}

      <p className="tt-beez-credit">{creditLine(desk)}</p>
    </div>
  );
}
