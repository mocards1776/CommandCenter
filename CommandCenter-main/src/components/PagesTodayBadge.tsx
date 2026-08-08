import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { dailyProgress, fetchDailyGoal, fetchSessions } from "@/lib/books";

/** Compact pages-today counter for the app header (flag-sized, upper right). */
export default function PagesTodayBadge() {
  const { data: sessions } = useQuery({ queryKey: ["reading-sessions"], queryFn: fetchSessions });
  const { data: goal } = useQuery({ queryKey: ["daily-goal"], queryFn: fetchDailyGoal });
  const today = useMemo(
    () => dailyProgress(sessions ?? [], goal ?? null).today,
    [sessions, goal],
  );

  return (
    <div
      className="relative z-10 flex h-5 min-w-[30px] flex-col items-end justify-center"
      title={goal != null ? `${today} pages today · goal ${goal}` : `${today} pages today`}
    >
      <span className="numeral text-accent text-[17px] leading-none">{today}</span>
      <span className="text-chalk-dim text-[7.5px] uppercase leading-none tracking-[0.12em]">
        pages
      </span>
    </div>
  );
}
