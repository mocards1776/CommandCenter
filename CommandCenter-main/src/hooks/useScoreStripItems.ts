import { useMemo } from "react";
import { useRuwtSlateSplit } from "@/hooks/useRuwtSlateSplit";
import { scoreStripItems, type ScoreStripSource } from "@/lib/ruwt-slate";
import type { UnifiedRuwtItem } from "@/hooks/useRuwtSlate";

/**
 * Games for the global score-tab strip.
 * Live RUWT heat when anything is in progress; otherwise Today's Top
 * (upcoming, or finals in Today's Top order when the slate is all final).
 * Home Live / Today's Top keep using the today-only slate and are not affected.
 */
export function useScoreStripItems(): { source: ScoreStripSource; items: UnifiedRuwtItem[] } {
  const slate = useRuwtSlateSplit();
  return useMemo(
    () => scoreStripItems({ live: slate.live, upcoming: slate.upcoming, finals: slate.finals }),
    [slate.live, slate.upcoming, slate.finals],
  );
}
