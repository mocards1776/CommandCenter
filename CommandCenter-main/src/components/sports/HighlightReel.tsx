import { useState } from "react";
import { ChevronDown, ChevronRight, Play } from "lucide-react";
import type { MlbHighlight } from "@/lib/mlb";

export default function HighlightReel({
  highlights,
  title = "Highlights",
  defaultOpen = false,
}: {
  highlights: MlbHighlight[];
  title?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [active, setActive] = useState<MlbHighlight | null>(null);

  if (!highlights.length) return null;

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="bg-panel flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.08] px-4 py-3 text-left transition hover:border-accent/40"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          {open ? (
            <ChevronDown size={16} className="text-accent shrink-0" />
          ) : (
            <ChevronRight size={16} className="text-accent shrink-0" />
          )}
          <span className="text-cream text-[13px] font-semibold tracking-wide">
            {title}
          </span>
          <span className="rounded-sm bg-white/[0.08] px-1.5 py-0.5 text-[11px] text-[#b8bfd0]">
            {highlights.length}
          </span>
        </span>
        <span className="text-[11px] uppercase tracking-[0.14em] text-[#8b93a7]">
          {open ? "Hide" : "Show videos"}
        </span>
      </button>

      {open && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {highlights.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => setActive(h)}
              className="bg-panel group overflow-hidden rounded-xl border border-white/[0.08] text-left transition hover:border-accent/40"
            >
              <div className="relative aspect-video bg-black/40">
                {h.thumb ? (
                  <img src={h.thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-hero to-ink" />
                )}
                <div className="absolute inset-0 grid place-items-center bg-black/25 transition group-hover:bg-black/15">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-accent text-cream shadow-lg">
                    <Play size={18} className="ml-0.5 fill-current" />
                  </span>
                </div>
                {h.duration && (
                  <span className="absolute right-2 bottom-2 rounded-sm bg-black/70 px-1.5 py-0.5 text-[10px] text-cream">
                    {h.duration.replace(/^00:/, "")}
                  </span>
                )}
              </div>
              <div className="p-3">
                <p className="text-cream line-clamp-2 text-[13px] leading-snug">{h.title}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {active && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setActive(null)}
        >
          <div
            className="w-full max-w-3xl overflow-hidden rounded-xl bg-ink shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <p className="text-cream min-w-0 truncate text-[13px]">{active.title}</p>
              <button
                type="button"
                onClick={() => setActive(null)}
                className="text-chalk hover:text-cream text-[11px] uppercase tracking-[0.14em]"
              >
                Close
              </button>
            </div>
            <video
              key={active.url}
              src={active.url}
              controls
              autoPlay
              playsInline
              className="aspect-video w-full bg-black"
            />
          </div>
        </div>
      )}
    </section>
  );
}
