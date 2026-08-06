import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useHabits, useCreateHabit, useDeleteHabit, useToggleHabit } from "@/lib/queries";
import { cn } from "@/lib/utils";
import type { HabitFrequency } from "@/types";

const FREQUENCIES: { value: HabitFrequency; label: string }[] = [
  { value: "daily", label: "Every day" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekends", label: "Weekends" },
  { value: "weekly", label: "Weekly" },
];

export default function HabitsPage() {
  const { data: habits, isLoading, error } = useHabits();
  const create = useCreateHabit();
  const remove = useDeleteHabit();
  const toggle = useToggleHabit();

  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<HabitFrequency>("daily");

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setName("");
    try {
      await create.mutateAsync({ name: trimmed, frequency });
    } catch (err) {
      setName(trimmed);
      toast.error(err instanceof Error ? err.message : "Could not add habit");
    }
  }

  if (error) {
    return (
      <div className="p-7">
        <div className="bg-panel border-alert/40 text-alert rounded border p-4 text-sm">
          Could not load habits: {error instanceof Error ? error.message : String(error)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4 p-6 md:p-7">
      <h2 className="rule-head">Habits</h2>

      <form onSubmit={onAdd} className="flex flex-col gap-2 sm:flex-row">
        <div className="bg-panel flex flex-1 items-center gap-2.5 rounded-sm border border-white/10 px-4 focus-within:border-accent/50">
          <Plus size={15} className="text-chalk-dim shrink-0" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New habit"
            className="placeholder:text-chalk-dim flex-1 bg-transparent py-3 text-[13px] outline-none"
          />
        </div>
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as HabitFrequency)}
          className="bg-panel text-cream rounded-sm border border-white/10 px-3 py-3 text-[13px] outline-none focus:border-accent/50"
        >
          {FREQUENCIES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={create.isPending || !name.trim()}
          className="from-accent-deep to-accent-dark text-cream rounded-sm bg-gradient-to-b px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.20em] transition hover:brightness-110 disabled:opacity-40"
        >
          Add
        </button>
      </form>

      <div className="bg-panel rounded border border-white/[0.07]">
        {isLoading ? (
          <p className="label-caps animate-pulse py-10 text-center">Loading</p>
        ) : (habits ?? []).length === 0 ? (
          <p className="text-chalk py-10 text-center text-sm">No habits yet. Add one above.</p>
        ) : (
          <ul>
            {(habits ?? []).map((h) => (
              <li
                key={h.id}
                className="group flex items-center gap-4 border-b border-white/[0.055] px-5 py-3.5 last:border-0"
              >
                <button
                  onClick={() => toggle.mutate({ habitId: h.id, done: !h.completedToday })}
                  disabled={!h.dueToday}
                  aria-label={`${h.completedToday ? "Undo" : "Complete"} ${h.name}`}
                  className={cn(
                    "grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[2px] border-[1.5px] text-[10px] transition-colors",
                    h.completedToday
                      ? "border-accent bg-accent text-field"
                      : "border-white/25 hover:border-accent disabled:opacity-30 disabled:hover:border-white/25",
                  )}
                >
                  {h.completedToday && "✓"}
                </button>

                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-[13.5px]", h.completedToday && "text-chalk-dim")}>
                    {h.name}
                  </p>
                  <p className="text-chalk-dim text-[10.5px] uppercase tracking-[0.10em]">
                    {FREQUENCIES.find((f) => f.value === h.frequency)?.label ?? h.frequency}
                    {!h.dueToday && " · not today"}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="numeral text-accent text-[19px] leading-none">{h.streak}</p>
                  <p className="label-caps text-[9.5px]">day{h.streak === 1 ? "" : "s"}</p>
                </div>

                <button
                  onClick={() => {
                    if (confirm(`Delete "${h.name}" and its history?`)) remove.mutate(h.id);
                  }}
                  aria-label={`Delete ${h.name}`}
                  className="text-chalk-dim hover:text-alert shrink-0 opacity-0 transition group-hover:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
