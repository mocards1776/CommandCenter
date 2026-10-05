import { useSearchParams } from "react-router-dom";
import { ElectionEar } from "@/components/newspaper/ElectionEar";
import { PhoneFrontCard } from "@/components/newspaper/PhoneFrontCard";
import { electionEar } from "@/lib/newspaper-election";
import { editionDateline, editionIssue, romanNumeral } from "@/lib/newspaper";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Public fixture of the A1 masthead ear at iPad Pro 13" width, or the iPhone
 * flag with ?phone=1. Not linked from nav. Used to proof the countdown.
 * `?day=2026-10-05` pins an edition dateline.
 */
export default function NewspaperA1PreviewPage() {
  const [params] = useSearchParams();
  const raw = params.get("day") ?? "2026-10-05";
  const day = YMD.test(raw) ? raw : "2026-10-05";
  const phone = params.get("phone") === "1";
  const { volume, issue } = editionIssue(day);
  const ballot = electionEar(day);

  if (phone) {
    return (
      <div className="tt-phone-page" data-phone-card="front" data-ready="1">
        <PhoneFrontCard date={day} editionLabel="Evening Edition" />
      </div>
    );
  }

  return (
    <div className="newspaper-root wsj-shell tt-watch-preview">
      <div className="wsj-page" data-a1-preview="1">
        <div className="wsj-fit">
          <div className="wsj-sheet">
            <header className="wsj-mast">
              <div className="wsj-mast-row">
                {ballot ? (
                  <ElectionEar day={day} />
                ) : (
                  <div className="wsj-ear">
                    <strong>Sports Final</strong>
                    <span>All the scores fit to print</span>
                  </div>
                )}
                <h1 className="wsj-nameplate">The Thompson Times</h1>
                <div className="wsj-ear right">
                  <strong>Evening Edition</strong>
                  <span>8 clubs on the desk</span>
                </div>
              </div>
              <div className="wsj-dateline-bar">
                <span>
                  Vol. {romanNumeral(volume)} · No. {issue}
                </span>
                <span className="c">{editionDateline(day)}</span>
                <span className="r">Section A · A1</span>
              </div>
            </header>
          </div>
        </div>
      </div>
    </div>
  );
}
