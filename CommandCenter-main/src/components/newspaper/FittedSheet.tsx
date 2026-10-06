import { createContext, useContext, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  EMPTY_FIT_PLAN,
  hideCssForPlan,
  planSheetFit,
  plansEqual,
  type SheetFitPlan,
} from "@/lib/newspaper-fit";

export const SheetFitContext = createContext<SheetFitPlan>(EMPTY_FIT_PLAN);

export function useSheetCut(cid: string): string | undefined {
  return useContext(SheetFitContext).cuts[cid];
}

/** Copy node React owns. A measured cut replaces children with the packed string. */
export function FitCopy({
  cid,
  full,
  className,
  children,
}: {
  cid: string;
  full: string;
  className?: string;
  children?: ReactNode;
}) {
  const cut = useSheetCut(cid);
  return (
    <p className={className} data-tt-cid={cid} data-fit-full={full}>
      {cut != null ? cut : (children ?? full)}
    </p>
  );
}

/**
 * Pack toward 1480 / hide [data-tt-flow] past 1650 without moving React's DOM.
 * Measurement runs on a detached clone; hide/cut come back as React state.
 */
export function FittedSheet({
  children,
  folio,
  overflow,
  sparse,
}: {
  children: ReactNode;
  folio?: string;
  overflow?: boolean;
  sparse?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [plan, setPlan] = useState<SheetFitPlan>(EMPTY_FIT_PLAN);
  const sheetId = useId().replace(/:/g, "");

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancel = false;
    let raf = 0;
    const measure = () => {
      if (cancel || !el.isConnected) return;
      const next = planSheetFit(el);
      setPlan((prev) => (plansEqual(prev, next) ? prev : next));
    };
    const schedule = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        measure();
      });
    };
    measure();
    void document.fonts?.ready.then(async () => {
      await Promise.all(
        [...el.querySelectorAll("img")].map((img) =>
          img.decode ? img.decode().catch(() => undefined) : Promise.resolve(),
        ),
      );
      schedule();
    });
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    for (const img of el.querySelectorAll("img")) img.addEventListener("load", schedule);
    return () => {
      cancel = true;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      for (const img of el.querySelectorAll("img")) img.removeEventListener("load", schedule);
    };
  }, [children]);

  const hideCss = hideCssForPlan(sheetId, plan);

  return (
    <SheetFitContext.Provider value={plan}>
      <div
        ref={ref}
        className="wsj-sheet"
        data-tt-sheet={sheetId}
        {...(folio != null ? { "data-folio": folio } : {})}
        {...(overflow != null ? { "data-overflow": overflow ? "1" : "0" } : {})}
        {...(sparse != null ? { "data-sparse": sparse ? "1" : "0" } : {})}
      >
        {hideCss ? <style>{hideCss}</style> : null}
        {children}
      </div>
    </SheetFitContext.Provider>
  );
}
