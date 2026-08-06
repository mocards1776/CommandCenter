import { useMemo, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import toast from "react-hot-toast";
import {
  useTasks,
  useHabits,
  useProjects,
  useScoreboard,
  useCompleteTask,
  useCreateTask,
  useToggleHabit,
} from "@/lib/queries";
import StarField from "@/components/StarField";
import { cn, dueLabel, isOverdue, todayDow } from "@/lib/utils";
import type { TodoistTask } from "@/types";

/** Rough minutes for a task, from Todoist's duration when it's set. */
function estimate(task: TodoistTask): string | null {
  if (!task.duration) return null;
  const { amount, unit } = task.duration;
  return unit === "minute" ? `About ${amount} min` : `About ${amount} d`;
}

function UpNext({ task, onStart }: { task?: TodoistTask; onStart: (id: string) => void }) {
  if (!task) {
    return (
      <div className="from-hero-lift to-hero relative overflow-hidden rounded border border-accent/30 bg-gradient-to-br px-8 py-7">
        <StarField count={34} seed={11} />
        <div className="rule-head relative z-10">Up Next</div>
        <p className="font-display text-cream relative z-10 mt-3 text-[38px] leading-tight">
          Nothing left today.
        </p>
        <p className="text-chalk relative z-10 mt-2 text-sm">The board is clear.</p>
      </div>
    );
  }

  const late = isOverdue(task.due?.date);
  const meta = [task.due ? dueLabel(task.due.date) : null, estimate(task)].filter(Boolean);

  return (
    <div className="from-hero-lift to-hero relative overflow-hidden rounded border border-accent/30 bg-gradient-to-br px-8 py-7">
      <StarField count={34} seed={11} />
      <div className="rule-head relative z-10">Up Next</div>

      <h2 className="font-display text-cream relative z-10 mt-3 max-w-[74%] text-[38px] leading-tight">
        {task.content}
      </h2>

      <div className="relative z-10 mt-4 flex flex-wrap items-center gap-5">
        {meta.map((m, i) => (
          <span
            key={i}
            className={cn(
              "text-[10.5px] uppercase tracking-[0.16em]",
              i === 0 && late ? "text-alert font-semibold" : "text-chalk",
            )}
          >
            {m}
          </span>
        ))}
      </div>

      <button
        onClick={() => onStart(task.id)}
        className="from-accent-deep to-accent-dark absolute bottom-6 right-7 z-10 rounded-sm bg-gradient-to-b px-6 py-2.5 text-[11px] font-semibold uppercase tracking-[0.20em] text-cream transition hover:brightness-110"
      >
        Done
      </button>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "alert" | "accent" }) {
  return (
    <div className="bg-panel px-4 py-3">
      <div className="label-caps text-[9.5px] tracking-[0.17em]">{label}</div>
      <div
        className={cn(
          "numeral mt-1 text-[29px] leading-tight",
          tone === "alert" ? "text-alert" : tone === "accent" ? "text-accent" : "text-cream",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: tasks, isLoading, error } = useTasks();
  const { data: habits } = useHabits();
  const { data: projects } = useProjects();
  const score = useScoreboard();
  const complete = useCompleteTask();
  const create = useCreateTask();
  const toggleHabit = useToggleHabit();

  const [draft, setDraft] = useState("");

  const projectName = useMemo(
    () => new Map((projects ?? []).map((p) => [p.id, p.name])),
    [projects],
  );

  /** Overdue first, then soonest. Undated sink to the bottom. */
  const queue = useMemo(() => {
    return [...(tasks ?? [])].sort((a, b) => {
      const ad = a.due?.date ?? "9999";
      const bd = b.due?.date ?? "9999";
      if (ad !== bd) return ad < bd ? -1 : 1;
      return b.priority - a.priority;
    });
  }, [tasks]);

  const upNext = queue[0];
  const rest = queue.slice(1);
  const habitsToday = (habits ?? []).filter((h) => h.dueToday);
  const pct = score.atBats > 0 ? Math.round((score.hits / score.atBats) * 100) : 0;

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content) return;
    setDraft("");
    try {
      await create.mutateAsync({ content });
    } catch (err) {
      setDraft(content);
      toast.error(err instanceof Error ? err.message : "Could not add task");
    }
  }

  if (error) {
    return (
      <div className="p-7">
        <div className="bg-panel border-alert/40 text-alert rounded border p-4 text-sm">
          Could not load tasks: {error instanceof Error ? error.message : String(error)}
        </div>
      </div>
    );
  }

  const dow = todayDow();

  return (
    <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[1fr_306px]">
      {/* ── Main column ── */}
      <div className="flex min-w-0 flex-col gap-4 p-6 md:p-7">
        <UpNext task={upNext} onStart={(id) => complete.mutate(id)} />

        <form onSubmit={onAdd}>
          <div className="bg-panel flex items-center gap-2.5 rounded-sm border border-white/10 px-4 focus-within:border-accent/50">
            <Plus size={15} className="text-chalk-dim shrink-0" />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder='Add a task — try "Call Dave tomorrow at 3pm"'
              className="placeholder:text-chalk-dim flex-1 bg-transparent py-3 text-[13px] outline-none"
            />
          </div>
        </form>

        <div className="bg-panel min-h-0 rounded border border-white/[0.07]">
          {isLoading ? (
            <p className="label-caps animate-pulse py-10 text-center">Loading</p>
          ) : rest.length === 0 ? (
            <p className="text-chalk py-10 text-center text-sm">Nothing else queued.</p>
          ) : (
            <ul>
              {rest.map((t) => {
                const late = isOverdue(t.due?.date);
                return (
                  <li
                    key={t.id}
                    className="group flex items-center gap-4 border-b border-white/[0.055] px-5 py-3 last:border-0"
                  >
                    <button
                      onClick={() => complete.mutate(t.id)}
                      aria-label={`Complete ${t.content}`}
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 rounded-full border-[1.5px] transition-colors",
                        late
                          ? "border-alert bg-alert shadow-[inset_0_0_0_2px_var(--color-panel)]"
                          : "border-white/25 hover:border-accent",
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate text-[13.5px]">{t.content}</span>
                    {t.project_id && projectName.has(t.project_id) && (
                      <span className="text-chalk-dim hidden shrink-0 text-[10.5px] uppercase tracking-[0.10em] sm:inline">
                        {projectName.get(t.project_id)}
                      </span>
                    )}
                    <span
                      className={cn(
                        "w-[86px] shrink-0 text-right text-[10.5px] uppercase tracking-[0.15em]",
                        late ? "text-alert font-semibold" : "text-chalk",
                      )}
                    >
                      {dueLabel(t.due?.date) ?? ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── Rail ── */}
      <aside className="bg-ink flex flex-col gap-5 border-l border-accent/15 p-6">
        <div className="flex items-center gap-4">
          <div
            className="grid h-[78px] w-[78px] shrink-0 place-items-center rounded-full"
            style={{
              background: `conic-gradient(var(--color-accent) 0 ${pct}%, rgba(237,239,245,0.09) ${pct}%)`,
            }}
          >
            <div className="bg-ink numeral text-cream grid h-[63px] w-[63px] place-items-center rounded-full text-xl">
              {pct}%
            </div>
          </div>
          <div>
            <div className="numeral text-cream text-[21px]">
              {score.hits} of {score.atBats}
            </div>
            <div className="label-caps mt-0.5 text-[10.5px] tracking-[0.16em]">cleared today</div>
          </div>
        </div>

        <div className="bg-accent/15 grid grid-cols-2 gap-px">
          <Stat label="Due Today" value={String(score.onDeck)} />
          <Stat label="Overdue" value={String(score.strikeouts)} tone="alert" />
          <Stat label="Habits" value={String(habitsToday.length)} />
          <Stat label="Streak" value={String(score.habitStreak)} tone="accent" />
        </div>

        <div>
          <h2 className="rule-head mb-3">Habits</h2>
          {habitsToday.length === 0 ? (
            <p className="text-chalk-dim text-sm">None scheduled today.</p>
          ) : (
            <>
              <ul>
                {habitsToday.map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center gap-3 border-b border-white/[0.055] py-2 last:border-0"
                  >
                    <button
                      onClick={() => toggleHabit.mutate({ habitId: h.id, done: !h.completedToday })}
                      aria-label={`${h.completedToday ? "Undo" : "Complete"} ${h.name}`}
                      className={cn(
                        "grid h-4 w-4 shrink-0 place-items-center rounded-[2px] border-[1.5px] text-[9px] transition-colors",
                        h.completedToday
                          ? "border-accent bg-accent text-field"
                          : "border-white/25 hover:border-accent",
                      )}
                    >
                      {h.completedToday && "✓"}
                    </button>
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-[13px]",
                        h.completedToday && "text-chalk-dim",
                      )}
                    >
                      {h.name}
                    </span>
                    <span className="numeral text-accent shrink-0 text-[15px]">{h.streak}</span>
                  </li>
                ))}
              </ul>

              {/* Week strip — today is outlined so the row has an anchor. */}
              <div className="mt-3 flex gap-1">
                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => {
                  const idx = (i + 1) % 7; // strip starts Monday; todayDow() is Sun-based
                  const done = habitsToday.some((h) => h.completedToday) && idx <= dow;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "flex-1 rounded-[2px] py-1.5 text-center text-[9.5px] tracking-[0.09em]",
                        done ? "bg-accent/85 text-field" : "text-chalk-dim bg-white/[0.06]",
                        idx === dow && "ring-1 ring-accent",
                      )}
                    >
                      {d}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
