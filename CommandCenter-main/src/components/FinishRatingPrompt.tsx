import { useEffect, useState } from "react";
import { X } from "lucide-react";
import RatingPicker from "./RatingPicker";
import { coverSrc } from "@/lib/books";
import type { Book } from "@/types";

export default function FinishRatingPrompt({
  book,
  onSubmit,
  onSkip,
}: {
  book: Book;
  onSubmit: (rating: number) => void;
  onSkip: () => void;
}) {
  const [rating, setRating] = useState<number | null>(null);
  const cover = coverSrc(book);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkip]);

  return (
    <div
      className="fixed inset-0 z-[125] flex items-end justify-center overflow-y-auto bg-black/75 backdrop-blur-sm sm:items-center"
      onClick={onSkip}
      role="dialog"
      aria-modal="true"
      aria-label={`Rate ${book.title}`}
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
        className="cc-finish-card relative z-10 mx-4 mb-[max(1rem,env(safe-area-inset-bottom))] mt-16 w-full max-w-[380px] overflow-hidden rounded-2xl border border-white/12 bg-[#0a1428]/95 shadow-2xl sm:mb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onSkip}
          aria-label="Skip rating"
          className="text-chalk hover:text-cream absolute right-4 top-4 z-10 rounded-full bg-black/45 p-2 backdrop-blur"
        >
          <X size={18} />
        </button>

        <div className="space-y-5 px-5 pb-6 pt-8 text-center">
          {cover ? (
            <img
              src={cover}
              alt=""
              className="mx-auto h-[180px] w-[120px] rounded-[3px] object-cover shadow-[0_12px_32px_rgba(0,0,0,.55)] ring-1 ring-white/15"
            />
          ) : null}

          <div>
            <p className="text-accent text-[10px] font-semibold uppercase tracking-[0.22em]">
              Finished
            </p>
            <h2 className="font-display text-cream mt-2 text-[24px] leading-[1.15]">{book.title}</h2>
            {book.authors && <p className="text-chalk-dim mt-1 text-[13px]">{book.authors}</p>}
          </div>

          <div>
            <p className="font-display text-cream text-[20px]">How was it?</p>
            <p className="text-chalk-dim mt-1 text-[12px]">Tap a rating before the recap.</p>
            <div className="mt-4 flex justify-center">
              <RatingPicker value={rating} onChange={setRating} />
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              disabled={rating === null}
              onClick={() => rating !== null && onSubmit(rating)}
              className="bg-accent text-cream rounded-md px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] disabled:opacity-40"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="text-chalk-dim hover:text-chalk py-1 text-[11px] uppercase tracking-[0.14em]"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
