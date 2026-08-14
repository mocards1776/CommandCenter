/** Shared iPad/iOS-friendly swipe-back for sports panels and pages. */

import { useEffect, useRef, useState } from "react";

/**
 * Attach to a panel/page root. Swipe left, or edge-swipe right from the left
 * bezel, calls `onBack` (same thresholds as Dispatch reader).
 */
export function useSwipeBack(onBack: () => void, enabled = true) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const [node, setNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!node) return;

    const onTouchStart = (e: TouchEvent) => {
      if (!enabledRef.current) return;
      const t = e.changedTouches[0] ?? e.touches[0];
      if (!t) return;
      start.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!enabledRef.current || !start.current) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - start.current.x;
      const dy = t.clientY - start.current.y;
      const startX = start.current.x;
      const held = Date.now() - start.current.t;
      start.current = null;

      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && (sel.toString() || "").trim().length >= 2) return;
      if (held > 700) return;
      if (Math.abs(dx) < 48) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.05) return;

      if (dx < 0 || (startX < 40 && dx > 0)) {
        onBackRef.current();
      }
    };

    node.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
    node.addEventListener("touchend", onTouchEnd, { passive: true, capture: true });
    return () => {
      node.removeEventListener("touchstart", onTouchStart, true);
      node.removeEventListener("touchend", onTouchEnd, true);
    };
  }, [node]);

  return setNode;
}
