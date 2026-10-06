import { usePhoneCardFit } from "@/hooks/usePhoneCardFit";
import {
  clockLabel,
  countLine,
  durationLabel,
  layoutDay,
  toMinutes,
  upcomingLines,
  type DayEvent,
  type DayUpcoming,
} from "@/lib/newspaper-day-ahead";
import { trimPhoneDayFit, type PhoneDayFit } from "@/lib/newspaper-phone-cards";

function longDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

function weekday(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? "the day" : d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
}

function shortDay(date: string): { name: string; date: string } {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return { name: date, date: "" };
  const months = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];
  return {
    name: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
    date: `${months[d.getUTCMonth()]} ${d.getUTCDate()}`,
  };
}

function KindTag({ kind }: { kind: DayEvent["kind"] }) {
  return <span className={`tt-phone-tag ${kind}`}>{kind === "family" ? "Family" : "Work"}</span>;
}

function ComingUp({ days }: { days: DayUpcoming[] }) {
  if (!days.length) return null;
  return (
    <section className="tt-phone-coming" aria-label="Coming up">
      <h2>Coming Up · The Next {days.length === 1 ? "Day" : `${days.length} Days`}</h2>
      <ol>
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

/**
 * Portrait iPhone Day Ahead card. Same props and helpers as the paper's DayAhead
 * (layoutDay, countLine, upcomingLines from newspaper-day-ahead).
 */
export function PhoneDayAheadCard({
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
  const byClock = [...day.timed].sort((a, b) => a.start - b.start || a.col - b.col);
  const first = day.firstUp;
  const next = first ? (byClock.find((p) => p !== first && p.start >= first.start) ?? null) : null;
  const openMinutes = day.open.reduce((n, o) => n + (o.end - o.start), 0);
  const { ref, value } = usePhoneCardFit<PhoneDayFit>(
    { comingDays: upcoming.length, rundown: byClock.length, allDay: day.allDay.length },
    trimPhoneDayFit,
    `${date}:${events.length}:${upcoming.length}`,
  );
  const allDay = day.allDay.slice(0, value.allDay);
  const rundown = byClock.slice(0, value.rundown);
  const coming = upcoming.slice(0, value.comingDays);

  return (
    <article ref={ref} className="tt-phone-card tt-phone-day" aria-label="The Day Ahead">
      <header className="tt-phone-mast">
        <p className="tt-phone-kicker">The Daily Planner · {editionLabel}</p>
        <h1>The Day Ahead</h1>
        <p className="tt-phone-dek">{longDate(date)} · the schedule as filed this morning</p>
        <p className="tt-phone-count">{countLine(day.counts)}</p>
      </header>

      {allDay.length ? (
        <section className="tt-phone-allday" aria-label="All day">
          <h2>All day</h2>
          <ul>
            {allDay.map((e, i) => (
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
        <p className="tt-phone-empty">
          Nothing on the books. No meetings, no pickups, no appointments filed for {weekday(date)}. The whole day is
          open.
        </p>
      ) : (
        <>
          <section className="tt-phone-first" aria-label="First up">
            <p className="tt-phone-flag">First up</p>
            {first ? (
              <>
                <p className={`tt-phone-first-time ${first.event.kind}`}>{clockLabel(first.start)}</p>
                <h2>{first.event.title}</h2>
                <p className="tt-phone-first-meta">
                  <KindTag kind={first.event.kind} />
                  {first.event.location ? <em>{first.event.location}</em> : null}
                  {!first.openEnded ? <span>{durationLabel(first.end - first.start)}</span> : null}
                </p>
                {next ? (
                  <p className="tt-phone-then">
                    <i>Then</i> {clockLabel(next.start)} · {next.event.title}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="tt-phone-then">No timed events. Only the all-day items above.</p>
            )}
          </section>

          {rundown.length ? (
            <section className="tt-phone-rundown" aria-label="The rundown">
              <h2>The Rundown</h2>
              <ol>
                {rundown.map((p, i) => (
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
          ) : null}

          <section className="tt-phone-tally" aria-label="By the numbers">
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
        </>
      )}

      <ComingUp days={coming} />
    </article>
  );
}
