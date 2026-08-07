import { useCallback, useRef, useState } from "react";
import { useCompleteTask, useCompletedToday } from "@/lib/queries";
import { useCelebration } from "@/components/celebration-context";

/** How long the row gets to animate out before the mutation fires. */
const CLEAR_MS = 380;

const MILESTONES: Record<number, string> = {
  1: "First one down.",
  5: "Five today.",
  10: "Ten today. Rolling.",
  15: "Fifteen. Unreasonable.",
  20: "Twenty. Go outside.",
};

/**
 * Completing a task, with the feedback that makes it worth doing.
 *
 * The mutation is delayed briefly so the row can animate out first — the
 * optimistic update in useCompleteTask removes it from the list instantly,
 * which otherwise cuts the animation off before it starts.
 */
export function useTaskCompletion() {
  const complete = useCompleteTask();
  const { data: completedToday } = useCompletedToday();
  const { burst, fanfare } = useCelebration();

  const [clearing, setClearing] = useState<Set<string>>(new Set());
  const timers = useRef<number[]>([]);

  const completeTask = useCallback(
    (id: string, origin?: { x: number; y: number }) => {
      if (clearing.has(id)) return; // ignore a double-click mid-animation

      if (origin) burst(origin.x, origin.y);
      setClearing((s) => new Set(s).add(id));

      const t = window.setTimeout(() => {
        complete.mutate(id);
        setClearing((s) => {
          const next = new Set(s);
          next.delete(id);
          return next;
        });

        // completedToday hasn't refetched yet, so count this one ourselves.
        const total = (completedToday?.length ?? 0) + 1;
        const line = MILESTONES[total];
        if (line) fanfare(line);
      }, CLEAR_MS);

      timers.current.push(t);
    },
    [clearing, burst, fanfare, complete, completedToday],
  );

  /** Convenience for click handlers: bursts from the button that was clicked. */
  const completeFromEvent = useCallback(
    (id: string, e: React.MouseEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      completeTask(id, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
    },
    [completeTask],
  );

  return { completeTask, completeFromEvent, isClearing: (id: string) => clearing.has(id) };
}
