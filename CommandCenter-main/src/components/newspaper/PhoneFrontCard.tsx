import { editionDateline } from "@/lib/newspaper";
import { ElectionEar } from "@/components/newspaper/ElectionEar";
import { electionEar } from "@/lib/newspaper-election";

/**
 * Portrait iPhone A1 flag — kicker + compact ear on one row, nameplate full
 * width below so "Times" never runs under the box (430 and 375 CSS px).
 */
export function PhoneFrontCard({
  date,
  editionLabel,
}: {
  date: string;
  editionLabel: string;
}) {
  const ballot = electionEar(date);
  return (
    <article className="tt-phone-card tt-phone-front" aria-label="Page A1">
      <header className="tt-phone-front-mast">
        <div className="tt-phone-front-top">
          <p className="tt-phone-kicker">{editionLabel}</p>
          {ballot ? <ElectionEar day={date} className="phone" /> : null}
        </div>
        <h1 className="wsj-nameplate">The Thompson Times</h1>
        <p className="tt-phone-dek">
          {editionDateline(date)} · Section A · A1
        </p>
      </header>
    </article>
  );
}
