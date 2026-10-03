import { useMemo } from "react";
import { useRuwtSlate, type RuwtInterestMaps } from "@/hooks/useRuwtSlate";
import { partitionRuwtSlate } from "@/lib/ruwt-slate";

/**
 * The RUWT slate split into Live / upcoming / finals. Each bucket keeps RUWT
 * order; ranking itself stays in useRuwtSlate.
 */
export function useRuwtSlateSplit(opts?: { interest?: RuwtInterestMaps }) {
  const slate = useRuwtSlate(opts);
  const split = useMemo(() => partitionRuwtSlate(slate.unified), [slate.unified]);
  return { ...slate, ...split };
}
