import { useState, type CSSProperties } from "react";
import { editionDateline } from "@/lib/newspaper";
import { ElectionEar } from "@/components/newspaper/ElectionEar";
import { electionEar } from "@/lib/newspaper-election";
import { usePhoneCardFit } from "@/hooks/usePhoneCardFit";
import {
  trimPhoneFrontFit,
  type PhoneFrontFit,
  type PhoneFrontStory,
} from "@/lib/newspaper-phone-cards";

/** Lead photo at most its native width — never stretched or CSS-upscaled. */
function LeadArt({ src, nativeWidth }: { src: string; nativeWidth: number | null }) {
  const [natural, setNatural] = useState<number | null>(nativeWidth && nativeWidth > 0 ? nativeWidth : null);
  const style: CSSProperties = {
    width: "auto",
    maxWidth: natural ? `min(100%, ${natural}px)` : "100%",
    height: "auto",
  };
  return (
    <img
      className="tt-phone-front-art"
      src={src}
      alt=""
      style={style}
      onLoad={(e) => {
        const w = e.currentTarget.naturalWidth;
        if (w > 0) setNatural((prev) => (prev && prev <= w ? prev : w));
      }}
    />
  );
}

/**
 * Portrait iPhone A1 flag — kicker + compact ear on one row, nameplate full
 * width below so "Times" never runs under the box (430 and 375 CSS px).
 * Lead photo, dek, and more Section A headlines fill the 430×932 canvas.
 * Lower-priority stories drop from the bottom until the card fits.
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
    <article
      className="tt-phone-card tt-phone-front"
      aria-label="Page A1"
      data-front-stories={shown.length}
      data-front-photo={value.showPhoto && shown[0]?.photo ? "1" : "0"}
    >
      <div className="tt-phone-fit-body" ref={ref}>
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
                  <LeadArt src={story.photo} nativeWidth={story.photoWidth} />
                ) : null}
                {story.teamName ? <p className="tt-phone-front-team">{story.teamName}</p> : null}
                <h2>{story.headline}</h2>
                {value.showDek && story.dek ? <p className="tt-phone-front-dek">{story.dek}</p> : null}
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </article>
  );
}
