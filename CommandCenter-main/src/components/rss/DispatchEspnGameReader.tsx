import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Loader2, Share } from "lucide-react";
import toast from "react-hot-toast";
import { MlbGameDetail } from "@/pages/MlbGamePage";
import { parseEspnGameIdFromUrl, resolveMlbGamePkFromEspnEvent } from "@/lib/mlb";

export default function DispatchEspnGameReader({
  url,
  title,
  onBack,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  url: string;
  title?: string;
  onBack: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}) {
  const eventId = parseEspnGameIdFromUrl(url);

  const resolved = useQuery({
    queryKey: ["mlb-gamepk-from-espn", eventId],
    queryFn: () => resolveMlbGamePkFromEspnEvent(eventId!),
    enabled: Boolean(eventId),
    staleTime: 300_000,
    retry: 1,
  });

  async function shareLink() {
    const shareTitle = title || "MLB game";
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

  const chrome = (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
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
  );

  if (!eventId || resolved.isError || (resolved.isSuccess && resolved.data == null)) {
    return (
      <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-7">
        {chrome}
        <div className="space-y-3">
          <p className="text-alert text-[13px]">
            {!eventId
              ? "Couldn’t find an ESPN game id in this link."
              : "Couldn’t match this ESPN game to an MLB box score."}
          </p>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-chalk hover:text-cream inline-flex items-center gap-1.5 text-[12px] underline-offset-2 hover:underline"
          >
            Open original <ExternalLink size={12} />
          </a>
          <div>
            <button
              type="button"
              onClick={onBack}
              className="font-body text-chalk hover:text-cream inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em]"
            >
              <ArrowLeft size={14} />
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (resolved.isPending || resolved.data == null) {
    return (
      <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-7">
        {chrome}
        <div className="text-chalk flex min-h-[40vh] items-center justify-center gap-2">
          <Loader2 size={18} className="animate-spin" />
          Loading game…
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-7">
      {chrome}
      <MlbGameDetail gamePk={String(resolved.data)} />
    </div>
  );
}
