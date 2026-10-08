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
      <h4 className="wsj-band-title">Media spend · partial</h4>
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

function WhatsNew({ lines }: { lines: string[] }) {
  if (!lines.length) return null;
  return (
    <div className="tt-races-whatsnew">
      <h4 className="wsj-band-title">What’s new</h4>
      <ul className="tt-races-bullets">
        {lines.map((line, i) => (
          <li key={`${line.slice(0, 24)}-${i}`}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function copyLines(race: RaceBrief, cap: number): string[] {
  const prose = (race.copy ?? "").replace(/\s+/g, " ").trim();
  if (!prose) return race.bullets.slice(0, cap);
  const parts = prose.split(/(?<=[.!?])\s+/).map((line) => line.trim()).filter(Boolean);
  return (parts.length ? parts : [prose]).slice(0, cap);
}

function RaceBlock({ race }: { race: RaceBrief }) {
  const bullets = copyLines(race, 5);
  return (
    <article className="tt-races-block" aria-label={raceLabel(race.race)}>
      <header className="tt-races-racehead">
        <p className="tt-races-code">{raceLabel(race.race)}</p>
        <h3>{race.headline || `${raceLabel(race.race)} on the air`}</h3>
      </header>
      <WhatsNew lines={bullets} />
      <SpendTable rows={race.spend} />
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

function RoundupBox({ race }: { race: RaceBrief }) {
  const lines = copyLines(race, 6);
  return (
    <aside className="tt-races-roundup" aria-label="Missouri Roundup">
      <p className="tt-races-code">Missouri Roundup</p>
      {race.headline ? <h3>{race.headline}</h3> : null}
      {lines.length ? (
        <ul className="tt-races-bullets">
          {lines.map((line, i) => (
            <li key={`${line.slice(0, 24)}-${i}`}>{line}</li>
          ))}
        </ul>
      ) : null}
      <p className="tt-races-roundup-note">Partial, inbox only</p>
    </aside>
  );
}

function RaceList({ races, briefDate }: { races: RaceBrief[]; briefDate: string }) {
  if (!races.length) return null;
  return (
    <section className="tt-races-list" aria-label="Other races">
      <h3 className="wsj-band-title">Also on the book</h3>
      <ul>
        {races.map((race) => (
          <li key={race.race}>
            <b>{raceLabel(race.race)}</b>
            <span>{printDay(race.updated_at?.slice(0, 10) || briefDate)}</span>
            <em>{race.headline || "On the book"}</em>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function RacesPage({ page }: { page: FavoritesRacesPage }) {
  const days = countdownLine(page.editionDate);
  const lead = page.races.filter((race) => race.race === "SD8" || race.race === "SD30");
  const rest = page.races.filter((race) => race.race !== "SD8" && race.race !== "SD30");
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
        {lead.map((race) => (
          <RaceBlock key={race.race} race={race} />
        ))}
        {page.roundup ? <RoundupBox race={page.roundup} /> : null}
        {rest.map((race) => (
          <RaceBlock key={race.race} race={race} />
        ))}
        {page.list?.length ? <RaceList races={page.list} briefDate={page.briefDate} /> : null}
      </div>
      <p className="tt-races-credit">{creditLine(page)}</p>
    </div>
  );
}
