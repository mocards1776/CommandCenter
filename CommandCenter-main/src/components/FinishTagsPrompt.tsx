import { useEffect, useMemo, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { coverSrc } from "@/lib/books";
import type { Book } from "@/types";

/**
 * Finishing a book with no tags stops here. Cancel abandons the finish;
 * there is no skip — a tag is required.
 */
export default function FinishTagsPrompt({
  book,
  existing,
  onSubmit,
  onCancel,
}: {
  book: Book;
  existing: string[];
  onSubmit: (tags: string[]) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [tags, setTags] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const cover = coverSrc(book);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const matches = useMemo(() => {
    const q = draft.trim().toLowerCase();
    if (!q) return [];
    return existing.filter((t) => !tags.includes(t) && t.toLowerCase().includes(q)).slice(0, 8);
  }, [draft, existing, tags]);

  const add = (raw: string) => {
    const v = raw.trim();
    if (!v || tags.includes(v)) {
      setDraft("");
      return;
    }
    setTags((prev) => [...prev, v]);
    setDraft("");
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (tags.length === 0 || busy) return;
    setBusy(true);
    try {
      await onSubmit(tags);
    } catch {
      // The parent surfaces the save error and leaves this prompt open.
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[125] flex items-end justify-center overflow-y-auto bg-black/75 backdrop-blur-sm sm:items-center"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={`Add tags to finish ${book.title}`}
    >
      {cover && (
        <img
          src={cover}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full scale-150 object-cover opacity-30 blur-3xl"
        />
      )}

      <div
        className="relative z-10 mx-4 mb-[max(1rem,env(safe-area-inset-bottom))] mt-16 w-full max-w-[380px] overflow-hidden rounded-2xl border border-white/12 bg-[#0a1428]/95 shadow-2xl sm:mb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel finish"
          className="text-chalk hover:text-cream absolute right-4 top-4 z-10 rounded-full bg-black/45 p-2 backdrop-blur"
        >
          <X size={18} />
        </button>

        <div className="space-y-5 px-5 pb-6 pt-8 text-center">
          {cover ? (
            <img
              src={cover}
              alt=""
              className="mx-auto h-[140px] w-[94px] rounded-[3px] object-cover shadow-[0_12px_32px_rgba(0,0,0,.55)] ring-1 ring-white/15"
            />
          ) : null}

          <div>
            <p className="text-accent text-[10px] font-semibold uppercase tracking-[0.22em]">
              Tag required
            </p>
            <h2 className="font-display text-cream mt-2 text-[24px] leading-[1.15]">{book.title}</h2>
            {book.authors && <p className="text-chalk-dim mt-1 text-[13px]">{book.authors}</p>}
            <p className="text-chalk-dim mt-3 text-[12.5px] leading-relaxed">
              Add at least one tag before this book can be marked finished.
            </p>
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="bg-white/[0.06] text-chalk flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => setTags((prev) => prev.filter((x) => x !== t))}
                    className="hover:text-alert"
                    aria-label={`Remove ${t}`}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <form onSubmit={submit} className="relative text-left">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add(matches[0] ?? draft);
                }
              }}
              placeholder="legal thriller"
              className="bg-panel text-cream w-full rounded-sm border border-white/10 px-3 py-2.5 text-[13px] outline-none focus:border-accent/50"
            />
            {matches.length > 0 && (
              <div className="bg-panel absolute z-20 mt-1 w-full overflow-hidden rounded-sm border border-accent/30 text-left shadow-xl">
                {matches.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      add(t);
                    }}
                    className="text-chalk hover:bg-accent/20 hover:text-cream block w-full px-3 py-1.5 text-left text-[12px]"
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </form>

          <button
            type="button"
            disabled={tags.length === 0 || busy}
            onClick={() => void submit()}
            className="bg-accent text-cream w-full rounded-md px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save tags and finish"}
          </button>
        </div>
      </div>
    </div>
  );
}
