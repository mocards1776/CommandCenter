import { useState, type FormEvent } from "react";
import { Check, Trash2, Plus } from "lucide-react";
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
      <div className="panel p-4 text-clay text-sm">
        Could not load habits: {error instanceof Error ? error.message : String(error)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <form onSubmit={onAdd} className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 flex items-center gap-2 panel px-3">
          <Plus size={16} className="text-chalk shrink-0" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New habit"
            className="flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-chalk-dim"
          />
        </div>
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as HabitFrequency)}
          className="panel px-3 py-2.5 text-sm outline-none focus:border-gold"
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
          className="bg-gold text-shell font-semibold uppercase tracking-wider text-xs px-5 py-2.5 hover:brightness-110 disabled:opacity-40 transition"
        >
          Add
        </button>
      </form>

      <div className="panel">
        {isLoading ? (
          <p className="px-3 py-8 text-center label-caps animate-pulse">Loading</p>
        ) : (habits ?? []).length === 0 ? (
          <p className="px-3 py-8 text-center text-chalk text-sm">
            No habits yet. Add one above.
          </p>
        ) : (
          <ul>
            {(habits ?? []).map((h) => (
              <li
                key={h.id}
                className="flex items-center gap-3 px-3 py-3 border-b border-line last:border-0 group"
              >
                <button
                  onClick={() => toggle.mutate({ habitId: h.id, done: !h.completedToday })}
                  disabled={!h.dueToday}
                  aria-label={`${h.completedToday ? "Undo" : "Complete"} ${h.name}`}
                  className={cn(
                    "w-5 h-5 shrink-0 border-2 grid place-items-center transition-colors",
                    h.completedToday
                      ? "bg-turf border-turf"
                      : "border-panel-hi hover:border-turf disabled:opacity-30 disabled:hover:border-panel-hi",
                  )}
                >
                  {h.completedToday && <Check size={12} className="text-shell" />}
                </button>

                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "truncate text-sm",
                      h.completedToday && "line-through text-chalk-dim",
                    )}
                  >
                    {h.name}
                  </p>
                  <p className="text-xs text-chalk-dim">
                    {FREQUENCIES.find((f) => f.value === h.frequency)?.label ?? h.frequency}
                    {!h.dueToday && " · not scheduled today"}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="numeral text-lg text-gold leading-none">{h.streak}</p>
                  <p className="label-caps">day{h.streak === 1 ? "" : "s"}</p>
                </div>

                <button
                  onClick={() => {
                    if (confirm(`Delete "${h.name}" and its history?`)) remove.mutate(h.id);
                  }}
                  aria-label={`Delete ${h.name}`}
                  className="opacity-0 group-hover:opacity-100 text-chalk-dim hover:text-clay transition shrink-0"
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
