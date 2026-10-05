import { Bookmark, X } from "lucide-react";
import { useReader } from "./reader-context";
import { SaveMark } from "./SaveMark";
import { useSavedArticles } from "./saved-context";

function savedWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString([], { month: "short", day: "numeric", year: "numeric" });
}

export function SavedDrawer({ onClose }: { onClose: () => void }) {
  const { articles, cardOf } = useSavedArticles();
  const open = useReader();

  return (
    <div className="tt-saved" role="dialog" aria-modal="true" aria-label="Saved stories">
      <div className="tt-saved-bar">
        <button type="button" className="tt-reader-back" onClick={onClose}>
          <X size={14} /> Back to the paper
        </button>
        <span className="tt-reader-plate">Saved</span>
        <span className="tt-saved-count">
          {articles.length ? `${articles.length} ${articles.length === 1 ? "story" : "stories"}` : "None yet"}
        </span>
      </div>
      <div className="tt-saved-scroll">
        <div className="tt-saved-sheet">
          <p className="wsj-kicker">The Thompson Times</p>
          <h1 className="tt-saved-title">Saved for later</h1>
          <p className="tt-saved-dek">Stories you keep after the edition rolls over.</p>
          {articles.length ? (
            <ol className="tt-saved-list">
              {articles.map((row) => {
                const card = cardOf(row);
                return (
                  <li key={row.id}>
                    <article className="tt-saved-row">
                      <button
                        type="button"
                        className="tt-saved-open"
                        onClick={() => open({ card })}
                        aria-label={row.headline}
                      >
                        {row.image ? (
                          <img src={row.image} alt="" />
                        ) : (
                          <span className="tt-saved-thumb">
                            <Bookmark size={18} strokeWidth={1.5} />
                          </span>
                        )}
                        <div>
                          <p className="tt-saved-kicker">
                            {[row.section, row.editionDate, savedWhen(row.savedAt)].filter(Boolean).join(" · ")}
                          </p>
                          <h2>{row.headline}</h2>
                          {row.dek ? <p className="tt-saved-blurb">{row.dek}</p> : null}
                        </div>
                      </button>
                      <SaveMark card={card} />
                    </article>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="tt-saved-empty">
              No saved stories. Tap the bookmark on a headline or in the reader to keep a copy.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
