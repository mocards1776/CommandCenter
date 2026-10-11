import { useLayoutEffect, useRef, useState } from "react";
import { anchoredWashBackground, halfWashBackground } from "@/lib/team-logo-glow";
import { cn } from "@/lib/utils";

type Point = { x: number; y: number };
type Layout = { width: number; away: Point | null; home: Point | null };

function samePoint(a: Point | null, b: Point | null): boolean {
  if (!a || !b) return a === b;
  return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
}

/**
 * The game-detail header wash: one wide team-color ellipse on each half.
 * Each ellipse is centered on its team's logo — the element inside the same
 * card marked `data-wash-anchor="away"` / `"home"` — and re-measured whenever
 * the card or the logo resizes, so it stays behind the mark at phone and iPad
 * widths. Without an anchor it falls back to the fixed per-half position.
 * Losing halves fade. No second glow behind the logo.
 */
export default function TeamHalfWash({
  awayHex,
  homeHex,
  awayDim = false,
  homeDim = false,
  soft = false,
}: {
  awayHex?: string | null;
  homeHex?: string | null;
  awayDim?: boolean;
  homeDim?: boolean;
  /** Lighter tint for headers with a tall live panel under the score row (MLB). */
  soft?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const card = root?.parentElement;
    if (!root || !card) return;
    const measure = () => {
      const box = root.getBoundingClientRect();
      if (!box.width) return;
      const center = (which: "away" | "home"): Point | null => {
        const el = card.querySelector<HTMLElement>(`[data-wash-anchor="${which}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return null;
        return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
      };
      const next: Layout = { width: box.width, away: center("away"), home: center("home") };
      setLayout((prev) =>
        prev &&
        Math.abs(prev.width - next.width) < 0.5 &&
        samePoint(prev.away, next.away) &&
        samePoint(prev.home, next.home)
          ? prev
          : next,
      );
    };
    const ro = new ResizeObserver(measure);
    const watchAnchors = () => {
      ro.disconnect();
      ro.observe(card);
      card.querySelectorAll("[data-wash-anchor]").forEach((el) => ro.observe(el));
    };
    watchAnchors();
    measure();
    const mo = new MutationObserver(() => {
      watchAnchors();
      measure();
    });
    mo.observe(card, { childList: true, subtree: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  if (!awayHex && !homeHex) return null;
  const half = layout ? layout.width / 2 : 0;
  const awayBg = awayHex
    ? layout?.away
      ? anchoredWashBackground(awayHex, layout.away, layout.width, soft)
      : halfWashBackground(awayHex, "left", soft ? "40" : "88")
    : null;
  const homeBg = homeHex
    ? layout?.home
      ? anchoredWashBackground(homeHex, { x: layout.home.x - half, y: layout.home.y }, layout.width, soft)
      : halfWashBackground(homeHex, "right", soft ? "40" : "88")
    : null;

  return (
    <div ref={rootRef} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {awayBg ? (
        <div
          className={cn("absolute inset-y-0 left-0 w-1/2", awayDim ? "opacity-40" : "opacity-90")}
          style={{ background: awayBg }}
        />
      ) : null}
      {homeBg ? (
        <div
          className={cn("absolute inset-y-0 right-0 w-1/2", homeDim ? "opacity-40" : "opacity-90")}
          style={{ background: homeBg }}
        />
      ) : null}
    </div>
  );
}
