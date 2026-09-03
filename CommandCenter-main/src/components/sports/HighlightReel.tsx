import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Play } from "lucide-react";
import type { MlbHighlight } from "@/lib/mlb";
import HighlightVideoPlayer from "@/components/sports/HighlightVideoPlayer";

export default function HighlightReel({
  highlights,
  title = "Highlights",
  defaultOpen = false,
  autoPlayFirst = false,
}: {
  highlights: MlbHighlight[];
  title?: string;
  defaultOpen?: boolean;
  /** When true, open the first clip muted+autoplay (MLB Film Room / live game). */
  autoPlayFirst?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen || autoPlayFirst);
  const [active, setActive] = useState<MlbHighlight | null>(null);
  const autoStarted = useRef(false);

  useEffect(() => {
    if (!autoPlayFirst || autoStarted.current || !highlights.length) return;
    autoStarted.current = true;
    setOpen(true);
    setActive(highlights[0]!);
  }, [autoPlayFirst, highlights]);

  if (!highlights.length) return null;

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-left transition hover:border-white/12 hover:bg-white/[0.045]"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          {open ? (
            <ChevronDown size={15} className="shrink-0 text-[#8b93a7]" />
          ) : (
            <ChevronRight size={15} className="shrink-0 text-[#8b93a7]" />
          )}
          <span className="text-[12.5px] font-medium tracking-wide text-[#c8cdd8]">{title}</span>
          <span className="rounded-sm bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-[#8b93a7]">
            {highlights.length}
          </span>
        </span>
        <span className="text-[10px] uppercase tracking-[0.14em] text-[#6f778a]">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {highlights.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => setActive(h)}
              className="group overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.025] text-left transition hover:border-white/12"
            >
              <div className="relative aspect-video bg-black/50">
                {h.thumb ? (
                  <img
                    src={h.thumb}
                    alt=""
                    className="h-full w-full object-cover opacity-90"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-[#132033] to-[#0a101c]" />
                )}
                <div className="absolute inset-0 grid place-items-center bg-black/20 transition group-hover:bg-black/10">
                  <span className="grid h-10 w-10 place-items-center rounded-full border border-white/25 bg-black/45 text-[#e8ebf2] backdrop-blur-[1px]">
                    <Play size={15} className="ml-0.5 fill-current" />
                  </span>
                </div>
                {h.duration && (
                  <span className="absolute right-2 bottom-2 rounded-sm bg-black/55 px-1.5 py-0.5 text-[10px] text-[#d5dae6]">
                    {h.duration.replace(/^00:/, "")}
                  </span>
                )}
              </div>
              <div className="px-3 py-2.5">
                <p className="line-clamp-2 text-[12.5px] leading-snug text-[#b8bfd0]">{h.title}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {active && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setActive(null)}
        >
          <div
            className="w-full max-w-3xl overflow-hidden rounded-xl border border-white/10 bg-[#0a101c] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-2.5">
              <p className="min-w-0 truncate text-[12.5px] text-[#c8cdd8]">{active.title}</p>
              <button
                type="button"
                onClick={() => setActive(null)}
                className="text-[11px] uppercase tracking-[0.14em] text-[#8b93a7] hover:text-[#e8ebf2]"
              >
                Close
              </button>
            </div>
            <HighlightVideoPlayer
              key={active.url}
              src={active.url}
              startMuted
            />
          </div>
        </div>
      )}
    </section>
  );
}
