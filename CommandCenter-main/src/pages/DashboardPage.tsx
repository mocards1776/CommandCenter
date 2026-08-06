import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { useTasks, useHabits, useScoreboard, useCompleteTask, useToggleHabit } from "@/lib/queries";
import { battingAvg, dueLabel, isOverdue, priorityColor, todayStr, cn } from "@/lib/utils";
import type { TodoistTask } from "@/types";

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="panel px-4 py-3 flex flex-col gap-1">
      <span className="label-caps">{label}</span>
      <span className="numeral text-3xl font-bold" style={accent ? { color: accent } : undefined}>
        {value}
      </span>
    </div>
  );
}

function TaskRow({ task, onDone }: { task: TodoistTask; onDone: (id: string) => void }) {
  const label = dueLabel(task.due?.date);
  const overdue = isOverdue(task.due?.date);

  return (
    <li className="flex items-center gap-3 px-3 py-2.5 border-b border-line last:border-0 group">
      <button
        onClick={() => onDone(task.id)}
        aria-label={`Complete ${task.content}`}
        className="w-4 h-4 shrink-0 border-2 rounded-full grid place-items-center transition-colors hover:bg-turf/20"
        style={{ borderColor: priorityColor(task.priority) || "var(--color-panel-hi)" }}
      >
        <Check size={10} className="opacity-0 group-hover:opacity-60 transition-opacity" />
      </button>
      <span className="flex-1 min-w-0 truncate text-sm">{task.content}</span>
      {label && (
        <span className={cn("text-xs shrink-0", overdue ? "text-clay" : "text-chalk")}>{label}</span>
      )}
    </li>
  );
}

export default function DashboardPage() {
  const { data: tasks, isLoading, error } = useTasks();
  const { data: habits } = useHabits();
  const score = useScoreboard();
  const complete = useCompleteTask();
  const toggleHabit = useToggleHabit();

  const today = todayStr();
  const dueToday = (tasks ?? [])
    .filter((t) => t.due?.date && t.due.date.slice(0, 10) <= today)
    .sort((a, b) => (a.due!.date < b.due!.date ? -1 : 1))
    .slice(0, 8);

  const habitsToday = (habits ?? []).filter((h) => h.dueToday);

  if (error) {
    return (
      <div className="panel p-4 text-clay text-sm">
        Could not load tasks: {error instanceof Error ? error.message : String(error)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Batting Avg" value={battingAvg(score.battingAverage)} accent="var(--color-gold)" />
        <Stat label="On Deck" value={String(score.onDeck)} />
        <Stat
          label="Strikeouts"
          value={String(score.strikeouts)}
          accent={score.strikeouts > 0 ? "var(--color-clay)" : undefined}
        />
        <Stat label="Streak" value={String(score.habitStreak)} accent="var(--color-turf)" />
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="label-caps">Due Today</h2>
          <Link to="/todos" className="text-xs text-chalk hover:text-gold transition-colors">
            All tasks →
          </Link>
        </div>
        <div className="panel">
          {isLoading ? (
            <p className="px-3 py-6 text-center label-caps animate-pulse">Loading</p>
          ) : dueToday.length === 0 ? (
            <p className="px-3 py-6 text-center text-chalk text-sm">Nothing due. Clean slate.</p>
          ) : (
            <ul>
              {dueToday.map((t) => (
                <TaskRow key={t.id} task={t} onDone={(id) => complete.mutate(id)} />
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="label-caps">Habits</h2>
          <Link to="/habits" className="text-xs text-chalk hover:text-gold transition-colors">
            Manage →
          </Link>
        </div>
        <div className="panel">
          {habitsToday.length === 0 ? (
            <p className="px-3 py-6 text-center text-chalk text-sm">No habits scheduled today.</p>
          ) : (
            <ul>
              {habitsToday.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center gap-3 px-3 py-2.5 border-b border-line last:border-0"
                >
                  <button
                    onClick={() => toggleHabit.mutate({ habitId: h.id, done: !h.completedToday })}
                    aria-label={`${h.completedToday ? "Undo" : "Complete"} ${h.name}`}
                    className={cn(
                      "w-4 h-4 shrink-0 border-2 grid place-items-center transition-colors",
                      h.completedToday ? "bg-turf border-turf" : "border-panel-hi hover:border-turf",
                    )}
                  >
                    {h.completedToday && <Check size={10} className="text-shell" />}
                  </button>
                  <span
                    className={cn(
                      "flex-1 min-w-0 truncate text-sm",
                      h.completedToday && "line-through text-chalk-dim",
                    )}
                  >
                    {h.name}
                  </span>
                  {h.streak > 0 && (
                    <span className="numeral text-xs text-gold shrink-0">{h.streak}d</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
