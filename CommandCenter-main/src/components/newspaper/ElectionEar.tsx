import { ELECTION_DAY_TODAY, electionDayLabel, electionEar } from "@/lib/newspaper-election";

/** Classic A1 ear: big numeral, days line, and the date. Phone omits the date. */
export function ElectionEar({
  day,
  className,
  compact,
}: {
  day: string;
  className?: string;
  compact?: boolean;
}) {
  const state = electionEar(day);
  if (!state) return null;
  const classes = ["wsj-ear", "tt-election-ear", compact && "is-compact", className].filter(Boolean).join(" ");
  if (state.kind === "today") {
    return (
      <div className={`${classes} is-today`} aria-label={ELECTION_DAY_TODAY}>
        <strong>Election Day</strong>
        <span className="tt-election-line">Polls close 7 p.m.</span>
      </div>
    );
  }
  return (
    <div className={classes} aria-label={`${state.days} days to Election Day, ${electionDayLabel()}`}>
      <em className="tt-election-num">{state.days}</em>
      <span className="tt-election-line">Days to Election Day</span>
      {compact ? null : <i className="tt-election-date">{electionDayLabel()}</i>}
    </div>
  );
}
