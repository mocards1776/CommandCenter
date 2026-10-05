import {
  clockLabel,
  countLine,
  durationLabel,
  layoutDay,
  toMinutes,
  upcomingLines,
  type DayEvent,
  type DaySchedule,
  type DayUpcoming,
} from "@/lib/newspaper-day-ahead";

function longDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

function shortDay(date: string): { name: string; md: string } {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return { name: date, md: "" };
  const months = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];
  return {
    name: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
    md: `${months[d.getUTCMonth()]} ${d.getUTCDate()}`,
  };
}

function KindTag({ kind }: { kind: DayEvent["kind"] }) {
  return <span className={`tt-phone-tag ${kind}`}>{kind === "family" ? "Family" : "Work"}</span>;
}

function ComingUp({ days }: { days: DayUpcoming[] }) {
  if (!days.length) return null;
  return (
    <section className="tt-phone-coming" aria-label="Coming up">
      <h2>Coming up</h2>
      <ol>
        {days.map((d) => {
          const label = shortDay(d.date);
          const { shown, more } = upcomingLines(d.events, 3);
          return (
            <li key={d.date}>
              <header>
                <b>{label.name}</b>
                <span>{label.md}</span>
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
                <p className="tt-phone-open">Open day</p>
              )}
              {more ? <p className="tt-phone-more">+{more} more</p> : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Portrait iPhone Day Ahead card. Same times_day_schedule shape as the paper page. */
export function PhoneDayAheadCard({
  schedule,
  editionLabel,
}: {
  schedule: DaySchedule;
  editionLabel: string;
}) {
  const day = layoutDay(schedule.events);
  const byClock = [...day.timed].sort((a, b) => a.start - b.start || a.col - b.col);
  const first = day.firstUp;

  return (
    <article className="tt-phone-card tt-phone-day" aria-label="The Day Ahead">
      <header className="tt-phone-mast">
        <p className="tt-phone-kicker">The Daily Planner · {editionLabel}</p>
        <h1>The Day Ahead</h1>
        <p className="tt-phone-dek">{longDate(schedule.date)}</p>
        <p className="tt-phone-count">{countLine(day.counts)}</p>
      </header>

      {day.allDay.length ? (
        <section className="tt-phone-allday" aria-label="All day">
          <h2>All day</h2>
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

      {first ? (
        <section className="tt-phone-first" aria-label="First up">
          <p className="tt-phone-flag">First up</p>
          <p className={`tt-phone-first-time ${first.event.kind}`}>{clockLabel(first.start)}</p>
          <h2>{first.event.title}</h2>
          <p className="tt-phone-first-meta">
            <KindTag kind={first.event.kind} />
            {first.event.location ? <em>{first.event.location}</em> : null}
            {!first.openEnded ? <span>{durationLabel(first.end - first.start)}</span> : null}
          </p>
        </section>
      ) : null}

      {byClock.length ? (
        <section className="tt-phone-rundown" aria-label="The rundown">
          <h2>The rundown</h2>
          <ol>
            {byClock.map((p, i) => (
              <li key={`${p.event.title}-${p.start}-${i}`} className={p.event.kind}>
                <b>{clockLabel(p.start, { short: true })}</b>
                <span>
                  <strong>{p.event.title}</strong>
                  {p.event.location ? <em>{p.event.location}</em> : null}
                </span>
                <KindTag kind={p.event.kind} />
              </li>
            ))}
          </ol>
        </section>
      ) : !day.allDay.length ? (
        <p className="tt-phone-empty">Nothing on the books. The whole day is open.</p>
      ) : null}

      <ComingUp days={schedule.upcoming ?? []} />
    </article>
  );
}
