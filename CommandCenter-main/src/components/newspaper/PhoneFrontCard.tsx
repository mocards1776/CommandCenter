import { editionDateline } from "@/lib/newspaper";
import { ElectionEar } from "@/components/newspaper/ElectionEar";
import { electionEar } from "@/lib/newspaper-election";
import { usePhoneCardFit } from "@/hooks/usePhoneCardFit";
import {
  trimPhoneFrontFit,
  type PhoneFrontFit,
  type PhoneFrontStory,
} from "@/lib/newspaper-phone-cards";

/**
 * Portrait iPhone A1 flag — kicker + compact ear on one row, nameplate full
 * width below so "Times" never runs under the box (430 and 375 CSS px).
 * Lead plus lower-priority stories drop from the bottom until the card fits.
 */
export function PhoneFrontCard({
  date,
  editionLabel,
  stories = [],
}: {
  date: string;
  editionLabel: string;
  stories?: PhoneFrontStory[];
}) {
  const ballot = electionEar(date);
  const { ref, value } = usePhoneCardFit<PhoneFrontFit>(
    { stories: stories.length, showDek: true, showPhoto: true },
    trimPhoneFrontFit,
    `${date}:${stories.map((s) => s.id).join(",")}`,
  );
  const shown = stories.slice(0, value.stories);

  return (
    <article ref={ref} className="tt-phone-card tt-phone-front" aria-label="Page A1">
      <header className="tt-phone-front-mast">
        <div className="tt-phone-front-top">
          <p className="tt-phone-kicker">{editionLabel}</p>
          {ballot ? <ElectionEar day={date} className="phone" compact /> : null}
        </div>
        <h1 className="wsj-nameplate">The Thompson Times</h1>
        <p className="tt-phone-dek">
          {editionDateline(date)} · Section A · A1
        </p>
      </header>
      {shown.length ? (
        <ol className="tt-phone-front-stories">
          {shown.map((story, i) => (
            <li key={story.id} className={i === 0 ? "lead" : undefined}>
              {i === 0 && value.showPhoto && story.photo ? (
                <img className="tt-phone-front-art" src={story.photo} alt="" />
              ) : null}
              {story.teamName ? <p className="tt-phone-front-team">{story.teamName}</p> : null}
              <h2>{story.headline}</h2>
              {i === 0 && value.showDek && story.dek ? <p className="tt-phone-front-dek">{story.dek}</p> : null}
            </li>
          ))}
        </ol>
      ) : null}
    </article>
  );
}
