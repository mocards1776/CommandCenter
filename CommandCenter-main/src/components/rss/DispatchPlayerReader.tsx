import { ArrowLeft, ChevronLeft, ChevronRight, Share } from "lucide-react";
import toast from "react-hot-toast";
import { MlbPlayerDetail } from "@/pages/MlbPlayerPage";

/** Present a full player page inside Dispatch when a tag-feed player-news item opens. */
export default function DispatchPlayerReader({
  playerId,
  title,
  onBack,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  playerId: number;
  title?: string;
  onBack: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}) {
  async function shareLink() {
    const url = `${window.location.origin}/sports/mlb/player/${playerId}`;
    const shareTitle = title || "Player update";
    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, url, text: shareTitle });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      } catch {
        toast.error("Couldn't share");
      }
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-7">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="font-body text-chalk hover:text-cream inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] transition-colors"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <button
            type="button"
            onClick={() => void shareLink()}
            className="font-body text-chalk hover:text-cream inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em]"
          >
            <Share size={14} />
            Share
          </button>
        </div>
        {(onPrev || onNext) && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!hasPrev || !onPrev}
              onClick={onPrev}
              className="font-body text-chalk hover:text-cream inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] disabled:opacity-30"
            >
              <ChevronLeft size={14} />
              Prev
            </button>
            <button
              type="button"
              disabled={!hasNext || !onNext}
              onClick={onNext}
              className="font-body text-chalk hover:text-cream inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] disabled:opacity-30"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
      {title ? (
        <p className="text-cream text-[10px] font-semibold uppercase tracking-[0.18em]">
          Player news · Player page
        </p>
      ) : null}
      <MlbPlayerDetail playerId={String(playerId)} />
    </div>
  );
}
