import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import SportsSearch from "@/components/sports/SportsSearch";

/** Header magnifier that opens player / manager / team search in a top sheet. */
export default function SportsSearchLauncher() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Search"
        aria-label="Search player, manager, team"
        className="text-chalk hover:text-cream relative z-10 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/[0.06]"
      >
        <Search size={18} strokeWidth={2} />
      </button>
      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px]"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
              }}
            >
              <div
                className="bg-ink border-b border-accent/20 px-4 pb-3 shadow-2xl md:px-8"
                style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
              >
                <div className="mx-auto flex max-w-2xl items-start gap-2">
                  <SportsSearch autoFocus onPicked={() => setOpen(false)} className="flex-1" />
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close search"
                    className="text-chalk hover:text-cream inline-flex h-9 w-9 shrink-0 items-center justify-center"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
