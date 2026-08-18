/** Shared ArrowLeft/ArrowRight prev/next navigation for Dispatch reader shells. */

import { useEffect } from "react";

export function useArticleNavKeys({
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  blocked = false,
}: {
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  /** Suppress navigation while a lightbox, quote picker, or similar overlay is open. */
  blocked?: boolean;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (blocked) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement | null)?.isContentEditable) return;
      if (e.key === "ArrowLeft" && hasPrev) {
        e.preventDefault();
        onPrev();
      } else if (e.key === "ArrowRight" && hasNext) {
        e.preventDefault();
        onNext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasPrev, hasNext, onPrev, onNext, blocked]);
}
