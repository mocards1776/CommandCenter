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
  ready = true,
  overflow,
  sparse,
}: {
  children: ReactNode;
  folio?: string;
  ready?: boolean;
  overflow?: boolean;
  sparse?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [plan, setPlan] = useState<SheetFitPlan>(EMPTY_FIT_PLAN);
  const sheetId = useId().replace(/:/g, "");

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !ready) return;
    let cancel = false;
    let passes = 0;
    const measure = () => {
      if (cancel || !el.isConnected || passes > 1) return;
      const next = planSheetFit(el);
      setPlan((prev) => (plansEqual(prev, next) ? prev : next));
      passes += 1;
    };
    measure();
    // Fonts can still be swapping on the first folio; one follow-up is enough.
    // Do not remesure on every children swap — that is the iPad flash.
    void document.fonts?.ready.then(() => {
      if (cancel || passes > 1) return;
      measure();
    });
    return () => {
      cancel = true;
    };
  }, [folio, ready]);

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
