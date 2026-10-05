import { editionDateline, editionIssue, pressEdition, romanNumeral } from "@/lib/newspaper";

/** Printed cover used while the edition is still being set, and as the auth hold. */
export function TimesHold({
  kicker = "Sports Final",
  line = "Today's edition",
  day,
}: {
  kicker?: string;
  line?: string;
  day?: string;
}) {
  const press = pressEdition();
  const datelineDay = day ?? press.day;
  const { volume, issue } = editionIssue(datelineDay);
  return (
    <section className="wsj-page" aria-label={line}>
      <div className="wsj-fit">
        <div className="wsj-sheet tt-cover">
          <p className="tt-cover-kicker">{kicker}</p>
          <h1 className="wsj-nameplate">The Thompson Times</h1>
          <p className="tt-cover-edition">{line}</p>
          <p className="tt-cover-date">
            Vol. {romanNumeral(volume)} · No. {issue}
            <span>{editionDateline(datelineDay)}</span>
          </p>
        </div>
      </div>
    </section>
  );
}

export function TimesHoldShell({
  line = "Today's edition",
  day,
}: {
  line?: string;
  day?: string;
}) {
  return (
    <div className="newspaper-root wsj-shell">
      <div className="tt-spread">
        <TimesHold line={line} day={day} />
      </div>
    </div>
  );
}
