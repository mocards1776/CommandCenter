import {
  clockLabel,
  countLine,
  durationLabel,
  layoutDay,
  spanLabel,
  toMinutes,
  upcomingLines,
  type DayEvent,
  type DayUpcoming,
  type PlacedEvent,
} from "@/lib/newspaper-day-ahead";
import "./day-ahead.css";

/** Printed height of one hour on the rail, in CSS px (1040×1480 sheet). */
const HOUR_PX = 56;

function longDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

function weekday(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? "the day" : d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
}

function hourMark(minutes: number): { n: string; ap: string } {
  const h24 = Math.floor(minutes / 60) % 24;
  if (h24 === 12) return { n: "Noon", ap: "" };
  if (h24 === 0) return { n: "12", ap: "a.m." };
  return { n: String(h24 % 12 || 12), ap: h24 < 12 ? "a.m." : "p.m." };
}

function KindTag({ kind }: { kind: DayEvent["kind"] }) {
  return <span className={`tt-day-tag ${kind}`}>{kind === "family" ? "Family" : "Work"}</span>;
}

function Block({ p, railStart }: { p: PlacedEvent; railStart: number }) {
  const top = ((p.start - railStart) / 60) * HOUR_PX;
  const height = Math.max(20, ((p.end - p.start) / 60) * HOUR_PX - 2);
  const size = height < 34 ? "tiny" : height < 66 ? "short" : "tall";
  const { event } = p;
  return (
    <div
      className={`tt-day-ev ${event.kind} ${size}${p.openEnded ? " open-ended" : ""}`}
      style={{
        top,
        height,
        left: `calc(${(p.col / p.cols) * 100}% + 2px)`,
        width: `calc(${100 / p.cols}% - 4px)`,
      }}
      title={`${spanLabel(p.start, p.end, p.openEnded)} · ${event.title}${event.location ? ` · ${event.location}` : ""}`}
    >
      <b>{spanLabel(p.start, p.end, p.openEnded)}</b>
      <strong>{event.title}</strong>
      {event.location && size === "tall" ? <em>{event.location}</em> : null}
    </div>
  );
}

function shortDay(date: string): { name: string; date: string } {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return { name: date, date: "" };
  const months = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];
  return {
    name: d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }),
    date: `${months[d.getUTCMonth()]} ${d.getUTCDate()}`,
  };
}

/** The next five days as filed this morning: an almanac strip along the foot of the page. */
function ComingUp({ days }: { days: DayUpcoming[] }) {
  if (!days.length) return null;
  return (
    <section className="tt-day-ahead-strip" aria-label="Coming up">
      <h3 className="wsj-band-title">Coming Up · The Next {days.length === 1 ? "Day" : `${days.length} Days`}</h3>
      <ol style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
        {days.map((d) => {
          const label = shortDay(d.date);
          const { shown, more } = upcomingLines(d.events);
          return (
            <li key={d.date}>
              <header>
                <b>{label.name}</b>
                <span>{label.date}</span>
              </header>
              {shown.length ? (
                <ul>
                  {shown.map((e, i) => (
                    <li key={`${e.title}-${i}`} className={e.kind}>
                      <b>{e.all_day ? "All day" : clockLabel(toMinutes(e.start) ?? 0, { short: true })}</b>
                      <span>{e.title}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="tt-day-ahead-open">Open day</p>
              )}
              {more ? <p className="tt-day-ahead-more">+{more} more</p> : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Nothing filed but the date: an open day, set like a printed notice. */
function EmptyDay({ date }: { date: string }) {
  const hours = Array.from({ length: 17 }, (_, i) => 6 + i);
  return (
    <section className="tt-day-empty" aria-label="Nothing on the books">
      <p className="tt-day-orn" aria-hidden>
        ❦
      </p>
      <h3>Nothing on the books</h3>
      <p className="tt-day-empty-dek">
        No meetings, no pickups, no appointments filed for {weekday(date)}. The whole day is open.
      </p>
      <div className="tt-day-empty-rail" aria-hidden>
        {hours.map((h) => (
          <span key={h}>{h === 12 ? "N" : h % 12 || 12}</span>
        ))}
      </div>
      <p className="tt-day-empty-foot">Open · 6 a.m. to 10 p.m.</p>
    </section>
  );
}

/** The day's calendar as an hour-by-hour printed timetable. */
export default function DayAhead({
  date,
  events,
  upcoming = [],
  editionLabel,
}: {
  date: string;
  events: DayEvent[];
  upcoming?: DayUpcoming[];
  editionLabel: string;
}) {
  const day = layoutDay(events);
  const hours: number[] = [];
  for (let m = day.railStart; m <= day.railEnd; m += 60) hours.push(m);
  const railHeight = ((day.railEnd - day.railStart) / 60) * HOUR_PX;
  const byClock = [...day.timed].sort((a, b) => a.start - b.start || a.col - b.col);
  const first = day.firstUp;
  const next = first ? byClock.find((p) => p !== first && p.start >= first.start) ?? null : null;
  const openMinutes = day.open.reduce((n, o) => n + (o.end - o.start), 0);

  return (
    <div className="tt-day">
      <header className="tt-day-head">
        <p className="tt-day-kicker">The Daily Planner · {editionLabel}</p>
        <h2>The Day Ahead</h2>
        <p className="tt-day-dek">{longDate(date)} · the schedule as filed this morning</p>
        <p className="tt-day-count">{countLine(day.counts)}</p>
      </header>

      {day.allDay.length ? (
        <section className="tt-day-allday" aria-label="All day">
          <span className="tt-day-allday-flag">All Day</span>
          <ul>
            {day.allDay.map((e, i) => (
              <li key={`${e.title}-${i}`} className={e.kind}>
                <strong>{e.title}</strong>
                {e.location ? <em>{e.location}</em> : null}
                <KindTag kind={e.kind} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!events.length ? (
        <EmptyDay date={date} />
      ) : (
        <div className="tt-day-grid">
          <section className="tt-day-table" aria-label="Hour by hour">
            <div className="tt-day-rail" style={{ height: railHeight }}>
              {hours.map((m) => {
                const mark = hourMark(m);
                return (
                  <span key={m} className="tt-day-hour" style={{ top: ((m - day.railStart) / 60) * HOUR_PX }}>
                    <b>{mark.n}</b>
                    {mark.ap ? <i>{mark.ap}</i> : null}
                  </span>
                );
              })}
            </div>
            <div className="tt-day-lane" style={{ height: railHeight }}>
              {hours.slice(0, -1).map((m) => (
                <span
                  key={m}
                  className="tt-day-line"
                  style={{ top: ((m - day.railStart) / 60) * HOUR_PX, height: HOUR_PX }}
                />
              ))}
              {day.open.map((o) => {
                const h = ((o.end - o.start) / 60) * HOUR_PX;
                return (
                  <div
                    key={`open-${o.start}`}
                    className="tt-day-open"
                    style={{ top: ((o.start - day.railStart) / 60) * HOUR_PX, height: h }}
                  >
                    {h >= 40 ? <span>Open · {durationLabel(o.end - o.start)}</span> : null}
                  </div>
                );
              })}
              {day.timed.map((p, i) => (
                <Block key={`${p.event.title}-${p.start}-${i}`} p={p} railStart={day.railStart} />
              ))}
            </div>
          </section>

          <aside className="tt-day-side">
            <section className="tt-day-first" aria-label="First up">
              <p className="tt-day-first-flag">First up</p>
              {first ? (
                <>
                  <p className={`tt-day-first-time ${first.event.kind}`}>{clockLabel(first.start)}</p>
                  <h3>{first.event.title}</h3>
                  <p className="tt-day-first-meta">
                    <KindTag kind={first.event.kind} />
                    {first.event.location ? <em>{first.event.location}</em> : null}
                    {!first.openEnded ? <span>{durationLabel(first.end - first.start)}</span> : null}
                  </p>
                  {next ? (
                    <p className="tt-day-then">
                      <i>Then</i> {clockLabel(next.start)} · {next.event.title}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="tt-day-then">No timed events. Only the all-day items above.</p>
              )}
            </section>

            <section className="tt-day-legend" aria-label="Key">
              <span className="work">
                <i /> Work
              </span>
              <span className="family">
                <i /> Family
              </span>
              <span className="open">
                <i /> Open
              </span>
            </section>

            {byClock.length ? (
              <section className="tt-day-rundown" aria-label="The rundown">
                <h3 className="wsj-band-title">The Rundown</h3>
                <ol>
                  {byClock.map((p, i) => (
                    <li key={`${p.event.title}-${p.start}-${i}`} className={p.event.kind}>
                      <b>{clockLabel(p.start, { short: true })}</b>
                      <span>
                        <strong>{p.event.title}</strong>
                        {p.event.location ? <em>{p.event.location}</em> : null}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            <section className="tt-day-tally" aria-label="By the numbers">
              <div>
                <b>{durationLabel(day.bookedMinutes || 0).replace(/^0 min$/, "0")}</b>
                <span>Booked</span>
              </div>
              <div>
                <b>{durationLabel(openMinutes)}</b>
                <span>Open</span>
              </div>
              <div>
                <b>{byClock.length ? clockLabel(Math.max(...byClock.map((p) => p.end)), { short: true }) : "—"}</b>
                <span>Last out</span>
              </div>
            </section>
          </aside>
        </div>
      )}

      <ComingUp days={upcoming} />
    </div>
  );
}
