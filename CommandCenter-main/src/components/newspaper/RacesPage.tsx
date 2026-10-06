import { countdownLine, creditLine, flightLabel, money, grpLabel, cppLabel, printDay, raceLabel, spendTotals, stationMarket, type FavoritesRacesPage, type RaceBrief, type RaceSpend } from "@/lib/newspaper-races";
import "./races.css";

function NewTag() {
  return <em className="tt-races-new">New</em>;
}

function SpendTable({ rows }: { rows: RaceSpend[] }) {
  if (!rows.length) return null;
  const totals = spendTotals(rows);
  return (
    <div className="tt-races-spend">
      <h4 className="wsj-band-title">Media spend</h4>
      <table>
        <thead>
          <tr>
            <th className="sponsor">Sponsor</th>
            <th className="side">Side</th>
            <th className="mkt">Station / market</th>
            <th className="num">Amount</th>
            <th className="num">GRPs</th>
            <th className="num">CPP</th>
            <th className="flight">Flight</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={`${row.sponsor}-${row.station}-${row.flight_start}-${i}`}>
              <th className="sponsor" scope="row">
                {row.sponsor}
                {row.is_new ? <NewTag /> : null}
              </th>
              <td className={`side ${/oppose/i.test(row.side) ? "oppose" : /support/i.test(row.side) ? "support" : ""}`}>
                {row.side || "—"}
              </td>
              <td className="mkt">{stationMarket(row)}</td>
              <td className="num">{money(row.amount)}</td>
              <td className="num">{grpLabel(row.grps)}</td>
              <td className="num">{cppLabel(row.cpp)}</td>
              <td className="flight">{flightLabel(row.flight_start, row.flight_end)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {totals.length ? (
        <p className="tt-races-totals">
          {totals.map((t) => (
            <span key={t.side}>
              <b>{t.side}</b> {money(t.amount)}
              {t.grps ? ` · ${grpLabel(t.grps)} GRPs` : ""}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}

function RaceBlock({ race }: { race: RaceBrief }) {
  const bullets = race.bullets.slice(0, 5);
  return (
    <article className="tt-races-block" aria-label={raceLabel(race.race)}>
      <header className="tt-races-racehead">
        <p className="tt-races-code">{raceLabel(race.race)}</p>
        <h3>{race.headline || `${raceLabel(race.race)} on the air`}</h3>
      </header>
      <SpendTable rows={race.spend} />
      {bullets.length ? (
        <ul className="tt-races-bullets">
          {bullets.map((line, i) => (
            <li key={`${line.slice(0, 24)}-${i}`}>{line}</li>
          ))}
        </ul>
      ) : null}
      {race.notes.length ? (
        <ul className="tt-races-notes">
          {race.notes.map((note, i) => (
            <li key={`${note.source}-${i}`}>
              <b>{note.source}</b>
              {note.url ? (
                <a href={note.url} target="_blank" rel="noreferrer">
                  {note.text}
                </a>
              ) : (
                <span>{note.text}</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {race.links.length ? (
        <ul className="tt-races-links">
          {race.links.map((link) => (
            <li key={link.url}>
              <a href={link.url} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export default function RacesPage({ page }: { page: FavoritesRacesPage }) {
  const days = countdownLine(page.editionDate);
  return (
    <div className="tt-races" data-tt-races={page.continued ? "continued" : "lead"}>
      <header className="tt-races-head">
        <p className="tt-races-kicker">Missouri Senate{page.continued ? " · continued" : ""}</p>
        <h2>Races We’re Tracking</h2>
        <p className="tt-races-dek">
          {page.stale ? `Briefs filed ${printDay(page.briefDate)}` : `The ${printDay(page.briefDate)} book`}
          {days ? ` · ${days}` : ""}
        </p>
      </header>
      <div className="tt-races-stack">
        {page.races.map((race) => (
          <RaceBlock key={race.race} race={race} />
        ))}
      </div>
      <p className="tt-races-credit">{creditLine(page)}</p>
    </div>
  );
}
