import {
  countdownLine,
  creditLine,
  flightChart,
  flightLabel,
  money,
  moneyShort,
  grpLabel,
  cppLabel,
  printDay,
  raceCharted,
  raceLabel,
  sideKey,
  spendTotals,
  sponsorTotals,
  stationMarket,
  stationTotals,
  SPEND_TABLE_ROWS,
  type FavoritesRacesPage,
  type RaceBrief,
  type RaceSpend,
} from "@/lib/newspaper-races";
import { daysUntilElection, electionDayLabel } from "@/lib/newspaper-election";
import "./races.css";

function NewTag() {
  return <em className="tt-races-new">New</em>;
}

/** The two sides' money as one bar: support from the left, oppose from the right. */
function SidesBar({ rows }: { rows: RaceSpend[] }) {
  const totals = spendTotals(rows);
  if (!totals.length) return null;
  const sum = totals.reduce((n, t) => n + t.amount, 0) || 1;
  const support = totals.find((t) => sideKey(t.side) === "support");
  const oppose = totals.find((t) => sideKey(t.side) === "oppose");
  const other = totals.filter((t) => sideKey(t.side) === "other");
  const otherSum = other.reduce((n, t) => n + t.amount, 0);
  const pct = (n: number) => `${Math.max(0, Math.min(100, (n / sum) * 100))}%`;
  const buys = (key: "support" | "oppose") => rows.filter((r) => sideKey(r.side) === key).length;
  return (
    <div className="tt-races-sides" aria-label="Money by side">
      <div className="tt-races-side support">
        <em>Support</em>
        <b>{money(support?.amount ?? 0)}</b>
        <span>
          {buys("support")} {buys("support") === 1 ? "buy" : "buys"}
          {support?.grps ? ` · ${grpLabel(support.grps)} GRPs` : ""}
        </span>
      </div>
      <div className="tt-races-sides-bar" role="img" aria-label={`Support ${money(support?.amount ?? 0)}, oppose ${money(oppose?.amount ?? 0)}`}>
        <i className="support" style={{ width: pct(support?.amount ?? 0) }} />
        {otherSum ? <i className="other" style={{ width: pct(otherSum) }} /> : null}
        <i className="oppose" style={{ width: pct(oppose?.amount ?? 0) }} />
        <u style={{ left: pct(support?.amount ?? 0) }} />
      </div>
      <div className="tt-races-side oppose">
        <em>Oppose</em>
        <b>{money(oppose?.amount ?? 0)}</b>
        <span>
          {buys("oppose")} {buys("oppose") === 1 ? "buy" : "buys"}
          {oppose?.grps ? ` · ${grpLabel(oppose.grps)} GRPs` : ""}
        </span>
      </div>
    </div>
  );
}

/** Who is paying: one bar per sponsor, the side's color, the amount at its end. */
function SponsorChart({ rows }: { rows: RaceSpend[] }) {
  const sponsors = sponsorTotals(rows).slice(0, 8);
  if (!sponsors.length) return null;
  const max = sponsors[0]!.amount || 1;
  return (
    <section className="tt-races-chart sponsors">
      <h4 className="wsj-band-title">Who is buying</h4>
      <ol>
        {sponsors.map((s) => (
          <li key={`${s.sponsor}-${s.key}`} className={s.key}>
            <span className="tt-races-bar-label">
              <b>{s.sponsor}</b>
              {s.isNew ? <NewTag /> : null}
              <em>
                {s.buys} {s.buys === 1 ? "buy" : "buys"} · {s.stations.slice(0, 3).join(", ")}
                {s.stations.length > 3 ? ` +${s.stations.length - 3}` : ""}
              </em>
            </span>
            <span className="tt-races-bar">
              <i style={{ width: `${Math.max(1.5, (s.amount / max) * 100)}%` }} />
              <b>{moneyShort(s.amount)}</b>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Where it runs: each station's money, split by side. */
function StationChart({ rows }: { rows: RaceSpend[] }) {
  const stations = stationTotals(rows).slice(0, 8);
  if (!stations.length) return null;
  const max = stations[0]!.total || 1;
  const markets = [...new Set(stations.map((s) => s.market).filter(Boolean))];
  return (
    <section className="tt-races-chart stations">
      <h4 className="wsj-band-title">
        Where it runs
        {markets.length ? <small>{markets.join(" · ")}</small> : null}
      </h4>
      <ol>
        {stations.map((s) => (
          <li key={s.station}>
            <span className="tt-races-bar-label">
              <b>{s.station}</b>
              <em>
                {s.buys} {s.buys === 1 ? "buy" : "buys"}
              </em>
            </span>
            <span className="tt-races-bar stacked">
              {s.support ? <i className="support" style={{ width: `${(s.support / max) * 100}%` }} /> : null}
              {s.other ? <i className="other" style={{ width: `${(s.other / max) * 100}%` }} /> : null}
              {s.oppose ? <i className="oppose" style={{ width: `${(s.oppose / max) * 100}%` }} /> : null}
              <b>{moneyShort(s.total)}</b>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** When it airs: every flight on one calendar, today's date ruled through it. */
function FlightChartView({ rows, editionDate }: { rows: RaceSpend[]; editionDate: string }) {
  const chart = flightChart(rows, editionDate, 8);
  if (!chart) return null;
  return (
    <section className="tt-races-chart flights">
      <h4 className="wsj-band-title">
        On the air
        <small>
          {printDay(chart.start)}–{printDay(chart.end)}
        </small>
      </h4>
      <div className="tt-races-flights">
        <div className="tt-races-flight-ticks" aria-hidden="true">
          {chart.ticks.map((t) => (
            <span key={t.label} style={{ left: `${t.at * 100}%` }}>
              {t.label}
            </span>
          ))}
        </div>
        <ol>
          {chart.bars.map((bar, i) => (
            <li key={`${bar.sponsor}-${bar.station}-${i}`} className={bar.key}>
              <span className="tt-races-flight-name">
                <b>{bar.sponsor}</b>
                <em>{bar.station}</em>
              </span>
              <span className="tt-races-flight-lane">
                {chart.ticks.map((t) => (
                  <u key={t.label} style={{ left: `${t.at * 100}%` }} aria-hidden="true" />
                ))}
                <i style={{ left: `${bar.from * 100}%`, width: `${Math.max(1, (bar.to - bar.from) * 100)}%` }}>
                  <b>{moneyShort(bar.amount)}</b>
                </i>
              </span>
            </li>
          ))}
        </ol>
        {chart.today != null ? (
          <span className="tt-races-flight-today" style={{ left: `calc(var(--lane-left) + (100% - var(--lane-left)) * ${chart.today})` }}>
            <em>Today</em>
          </span>
        ) : null}
      </div>
    </section>
  );
}

/** The agate: every buy on file, the biggest first, with its amount drawn as a bar. */
function SpendTable({ rows, cap }: { rows: RaceSpend[]; cap: number }) {
  if (!rows.length) return null;
  const totals = spendTotals(rows);
  const shown = rows.slice(0, cap);
  const rest = rows.slice(cap);
  const restSum = rest.reduce((n, r) => n + r.amount, 0);
  const max = shown[0]?.amount || 1;
  return (
    <div className="tt-races-spend">
      <h4 className="wsj-band-title">
        Media spend
        <small>
          {rows.length} {rows.length === 1 ? "buy" : "buys"} on file
        </small>
      </h4>
      <table>
        <thead>
          <tr>
            <th className="sponsor">Sponsor</th>
            <th className="side">Side</th>
            <th className="mkt">Station / market</th>
            <th className="num">Amount</th>
            <th className="bar" aria-hidden="true" />
            <th className="num">GRPs</th>
            <th className="num">CPP</th>
            <th className="flight">Flight</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((row, i) => (
            <tr key={`${row.sponsor}-${row.station}-${row.flight_start}-${i}`} className={sideKey(row.side)}>
              <th className="sponsor" scope="row">
                {row.sponsor}
                {row.is_new ? <NewTag /> : null}
              </th>
              <td className={`side ${sideKey(row.side)}`}>{row.side || "—"}</td>
              <td className="mkt">{stationMarket(row)}</td>
              <td className="num">{money(row.amount)}</td>
              <td className="bar" aria-hidden="true">
                <i style={{ width: `${Math.max(1, (row.amount / max) * 100)}%` }} />
              </td>
              <td className="num">{grpLabel(row.grps)}</td>
              <td className="num">{cppLabel(row.cpp)}</td>
              <td className="flight">{flightLabel(row.flight_start, row.flight_end)}</td>
            </tr>
          ))}
          {rest.length ? (
            <tr className="rest">
              <th className="sponsor" scope="row">
                {rest.length} smaller {rest.length === 1 ? "buy" : "buys"}
              </th>
              <td className="side" />
              <td className="mkt">{[...new Set(rest.map((r) => r.station || r.market).filter(Boolean))].join(", ")}</td>
              <td className="num">{money(restSum)}</td>
              <td className="bar" aria-hidden="true" />
              <td className="num">{grpLabel(rest.reduce((n, r) => n + (r.grps ?? 0), 0) || null)}</td>
              <td className="num">—</td>
              <td className="flight">—</td>
            </tr>
          ) : null}
        </tbody>
      </table>
      {totals.length ? (
        <p className="tt-races-totals">
          {totals.map((t) => (
            <span key={t.side} className={sideKey(t.side)}>
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

function RaceBlock({ race, editionDate }: { race: RaceBrief; editionDate: string }) {
  const bullets = race.bullets.slice(0, 5);
  const charted = raceCharted(race);
  return (
    <article className={`tt-races-block ${charted ? "charted" : ""}`} aria-label={raceLabel(race.race)}>
      <header className="tt-races-racehead">
        <p className="tt-races-code">{raceLabel(race.race)}</p>
        <h3>{race.headline || `${raceLabel(race.race)} on the air`}</h3>
      </header>
      {race.spend.length ? <SidesBar rows={race.spend} /> : null}
      <div className="tt-races-lead">
        <WhatsNew lines={bullets} />
        {charted ? <FlightChartView rows={race.spend} editionDate={editionDate} /> : null}
      </div>
      {charted ? (
        <div className="tt-races-charts" data-tt-flow="">
          <SponsorChart rows={race.spend} />
          <StationChart rows={race.spend} />
        </div>
      ) : null}
      <SpendTable rows={race.spend} cap={charted ? SPEND_TABLE_ROWS : race.spend.length} />
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
  const left = daysUntilElection(page.editionDate);
  return (
    <div className="tt-races" data-tt-races={page.continued ? "continued" : "lead"}>
      <header className="tt-races-head">
        <div className="tt-races-head-book">
          <p className="tt-races-kicker">Missouri Senate{page.continued ? " · continued" : ""}</p>
          <p className="tt-races-dek">{page.stale ? `Briefs filed ${printDay(page.briefDate)}` : `The ${printDay(page.briefDate)} book`}</p>
        </div>
        <h2>Races We’re Tracking</h2>
        {left != null && left >= 0 ? (
          <div className="tt-races-count" aria-label={days ?? undefined}>
            <b>{left === 0 ? "Vote" : left}</b>
            <span>{left === 0 ? "Election Day" : left === 1 ? "day to go" : "days to go"}</span>
            <em>{electionDayLabel()}</em>
          </div>
        ) : (
          <div className="tt-races-count empty" />
        )}
      </header>
      <div className="tt-races-stack">
        {page.races.map((race) => (
          <RaceBlock key={race.race} race={race} editionDate={page.editionDate} />
        ))}
      </div>
      <p className="tt-races-credit">
        {creditLine(page)}
        <span className="tt-races-key">
          <i className="support" /> Support <i className="oppose" /> Oppose
        </span>
      </p>
    </div>
  );
}
