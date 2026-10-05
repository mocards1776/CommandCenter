import { editionDateline } from "@/lib/newspaper";
import { ElectionEar } from "@/components/newspaper/ElectionEar";
import { electionEar } from "@/lib/newspaper-election";

/**
 * Portrait iPhone A1 flag — nameplate and the election ear. Same edition date
 * as the printed paper; sized for the Telegram phone-card frame (430 CSS px).
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
        <div className="tt-phone-front-plate">
          <p className="tt-phone-kicker">Sports Final · {editionLabel}</p>
          <h1 className="wsj-nameplate">The Thompson Times</h1>
          <p className="tt-phone-dek">
            {editionDateline(date)} · Section A · A1
          </p>
        </div>
        {ballot ? <ElectionEar day={date} className="phone" /> : null}
      </header>
    </article>
  );
}
