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
 * Pack toward 1480 / hide overflow blocks past 1650 without writing the
 * printed tree. Measurement clones into a non-React host; hide/cut apply
 * through React state (CSS + FitCopy).
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
    let lastH = -1;
    const measure = () => {
      if (cancel || !el.isConnected || el.childElementCount === 0) return;
      const h = el.offsetHeight;
      // Same layout height: do not clone the sheet or rewrite the fit plan.
      // A children-identity rerun was doing that on every folio turn.
      if (h === lastH && h > 0) return;
      lastH = h;
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
    void document.fonts?.ready.then(() => schedule());
    const ro = new ResizeObserver(() => {
      if (el.offsetHeight === lastH) return;
      schedule();
    });
    ro.observe(el);
    return () => {
      cancel = true;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const hideCss = hideCssForPlan(sheetId, plan);

  return (
    <SheetFitContext.Provider value={plan}>
      <div className="wsj-fit-plan" style={{ display: "contents" }}>
        {hideCss ? <style>{hideCss}</style> : null}
        <div
          ref={ref}
          className="wsj-sheet"
          data-tt-sheet={sheetId}
          {...(folio != null ? { "data-folio": folio } : {})}
          {...(overflow != null ? { "data-overflow": overflow ? "1" : "0" } : {})}
          {...(sparse != null ? { "data-sparse": sparse ? "1" : "0" } : {})}
        >
          {children}
        </div>
      </div>
    </SheetFitContext.Provider>
  );
}
