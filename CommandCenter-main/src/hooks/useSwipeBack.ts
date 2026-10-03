/** Shared iPad/iOS-friendly swipe-back for sports panels and pages. */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

/** Safari's own edge-swipe back pops history around the same time our touchend fires. */
const NATIVE_BACK_GRACE_MS = 350;

function startsInHorizontalScroller(target: EventTarget | null, root: HTMLElement): boolean {
  let el = target instanceof Element ? target : null;
  const opted = el?.closest("[data-no-swipe-back], [role='slider'], input, video");
  if (opted && root.contains(opted)) return true;
  while (el && el !== root) {
    if (el instanceof HTMLElement && el.scrollWidth > el.clientWidth + 1) {
      const overflowX = getComputedStyle(el).overflowX;
      if (overflowX === "auto" || overflowX === "scroll") return true;
    }
    el = el.parentElement;
  }
  return false;
}

/**
 * Attach to a panel/page root. Swipe left, or edge-swipe right from the left
 * bezel, calls `onBack` (same thresholds as Dispatch reader).
 */
export function useSwipeBack(onBack: () => void, enabled = true) {
  const start = useRef<{ x: number; y: number; t: number; skip: boolean } | null>(null);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const [node, setNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!node) return;
    let lastPopAt = 0;
    let pending: number | null = null;

    const onPop = () => {
      lastPopAt = Date.now();
      if (pending != null) {
        window.clearTimeout(pending);
        pending = null;
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (!enabledRef.current) return;
      const t = e.changedTouches[0] ?? e.touches[0];
      if (!t) return;
      start.current = {
        x: t.clientX,
        y: t.clientY,
        t: Date.now(),
        skip: startsInHorizontalScroller(e.target, node),
      };
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!enabledRef.current || !start.current) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - start.current.x;
      const dy = t.clientY - start.current.y;
      const startX = start.current.x;
      const startedAt = start.current.t;
      const skip = start.current.skip;
      start.current = null;

      if (skip) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && (sel.toString() || "").trim().length >= 2) return;
      if (Date.now() - startedAt > 700) return;
      if (Math.abs(dx) < 48) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.05) return;
      if (lastPopAt >= startedAt) return;

      if (dx < 0) {
        onBackRef.current();
        return;
      }
      if (startX < 40 && dx > 0) {
        const href = window.location.href;
        pending = window.setTimeout(() => {
          pending = null;
          if (lastPopAt >= startedAt || window.location.href !== href) return;
          onBackRef.current();
        }, NATIVE_BACK_GRACE_MS);
      }
    };

    window.addEventListener("popstate", onPop);
    node.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
    node.addEventListener("touchend", onTouchEnd, { passive: true, capture: true });
    return () => {
      if (pending != null) window.clearTimeout(pending);
      window.removeEventListener("popstate", onPop);
      node.removeEventListener("touchstart", onTouchStart, true);
      node.removeEventListener("touchend", onTouchEnd, true);
    };
  }, [node]);

  return setNode;
}

/**
 * Back for sports detail pages: pop in-app history when there is some,
 * otherwise land on `fallback` (deep links / fresh Home Screen launches).
 */
export function useSportsBack(fallback: string) {
  const navigate = useNavigate();
  return useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  }, [navigate, fallback]);
}
