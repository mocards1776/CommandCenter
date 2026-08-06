import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, requireUserId } from "./supabase";
import { todoist } from "./todoist";
import { todayStr, isDueToday, streakFrom } from "./utils";
import type {
  Habit,
  HabitInsert,
  HabitCompletion,
  HabitWithStatus,
  NewTask,
  TaskPatch,
  TodoistTask,
  Scoreboard,
} from "@/types";

export const keys = {
  habits: ["habits"] as const,
  completions: ["habit_completions"] as const,
  tasks: ["todoist", "tasks"] as const,
  projects: ["todoist", "projects"] as const,
  labels: ["todoist", "labels"] as const,
};

// ─── Todoist ──────────────────────────────────────────────────────────────

export function useTasks() {
  return useQuery({
    queryKey: keys.tasks,
    queryFn: () => todoist.tasks(),
    staleTime: 30_000,
  });
}

export function useProjects() {
  return useQuery({
    queryKey: keys.projects,
    queryFn: () => todoist.projects(),
    staleTime: 5 * 60_000, // projects change rarely
  });
}

export function useLabels() {
  return useQuery({
    queryKey: keys.labels,
    queryFn: () => todoist.labels(),
    staleTime: 5 * 60_000,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (task: NewTask) => todoist.create(task),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.tasks }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TaskPatch }) => todoist.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.tasks }),
  });
}

export function useCompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => todoist.complete(id),
    // Drop the task from the list immediately; completing should feel instant.
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: keys.tasks });
      const previous = qc.getQueryData<TodoistTask[]>(keys.tasks);
      qc.setQueryData<TodoistTask[]>(keys.tasks, (old) => old?.filter((t) => t.id !== id) ?? []);
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(keys.tasks, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.tasks }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => todoist.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.tasks }),
  });
}

// ─── Habits (Supabase) ────────────────────────────────────────────────────

async function fetchHabits(): Promise<Habit[]> {
  const { data, error } = await supabase
    .from("habits")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

async function fetchCompletions(): Promise<HabitCompletion[]> {
  // 120 days back is enough to render any streak we display.
  const since = new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("habit_completions")
    .select("*")
    .gte("completed_date", since)
    .order("completed_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Habits joined with today's completion state and current streak. */
export function useHabits() {
  const habits = useQuery({ queryKey: keys.habits, queryFn: fetchHabits });
  const completions = useQuery({ queryKey: keys.completions, queryFn: fetchCompletions });

  const today = todayStr();
  const data: HabitWithStatus[] | undefined =
    habits.data &&
    completions.data &&
    habits.data.map((h) => {
      const mine = completions.data!.filter((c) => c.habit_id === h.id);
      return {
        ...h,
        completedToday: mine.some((c) => c.completed_date === today),
        streak: streakFrom(mine.map((c) => c.completed_date)),
        dueToday: isDueToday(h.frequency, h.custom_days),
      };
    });

  return {
    data,
    isLoading: habits.isLoading || completions.isLoading,
    error: habits.error ?? completions.error,
  };
}

export function useToggleHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ habitId, done }: { habitId: string; done: boolean }) => {
      const userId = await requireUserId();
      if (done) {
        // unique(habit_id, completed_date) makes a repeat click a 409 rather
        // than a duplicate row, so upsert-on-conflict is the safe form.
        const { error } = await supabase
          .from("habit_completions")
          .upsert(
            { user_id: userId, habit_id: habitId, completed_date: todayStr() },
            { onConflict: "habit_id,completed_date" },
          );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("habit_completions")
          .delete()
          .eq("habit_id", habitId)
          .eq("completed_date", todayStr());
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.completions }),
  });
}

export function useCreateHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (habit: Omit<HabitInsert, "user_id">) => {
      const userId = await requireUserId();
      const { data, error } = await supabase
        .from("habits")
        .insert({ ...habit, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.habits }),
  });
}

export function useDeleteHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("habits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.habits }),
  });
}

// ─── Scoreboard ───────────────────────────────────────────────────────────

/**
 * Computed here rather than fetched from a server endpoint. The old backend
 * had a /dashboard/ route that silently stopped returning fields and blanked
 * the whole scoreboard; deriving it from data already loaded removes that
 * failure mode entirely.
 */
export function useScoreboard(): Scoreboard {
  const { data: tasks } = useTasks();
  const { data: habits } = useHabits();

  const today = todayStr();
  const list = tasks ?? [];

  const dueToday = list.filter((t) => t.due?.date?.slice(0, 10) === today);
  const overdue = list.filter((t) => t.due?.date && t.due.date.slice(0, 10) < today);

  // Todoist drops completed tasks from the active list, so "hits" comes from
  // habits + remaining count rather than a completed-task query.
  const habitsDone = habits?.filter((h) => h.completedToday).length ?? 0;
  const atBats = dueToday.length + habitsDone;
  const hits = habitsDone;

  return {
    hits,
    atBats,
    battingAverage: atBats > 0 ? hits / atBats : 0,
    strikeouts: overdue.length,
    onDeck: dueToday.length,
    focusMinutes: 0,
    habitStreak: habits?.reduce((max, h) => Math.max(max, h.streak), 0) ?? 0,
  };
}
