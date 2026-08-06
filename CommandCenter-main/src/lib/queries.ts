import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, requireUserId } from "./supabase";
import { todoist } from "./todoist";
import { todayStr, toDateStr, isDueToday, streakFrom } from "./utils";
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
  completed: ["todoist", "completed"] as const,
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

/**
 * Tasks completed today. Todoist's active /tasks endpoint never returns
 * completed tasks, so this is the only way to know what got done.
 * A 48-hour window is fetched and then filtered to the Central-time day,
 * which avoids off-by-one errors at the UTC boundary.
 */
export function useCompletedToday() {
  return useQuery({
    queryKey: keys.completed,
    queryFn: async () => {
      const until = new Date();
      const since = new Date(until.getTime() - 48 * 3600_000);
      const items = await todoist.completed(
        since.toISOString().slice(0, 19) + "Z",
        until.toISOString().slice(0, 19) + "Z",
      );
      const today = todayStr();
      return items.filter((t) => t.completed_at && toDateStr(t.completed_at) === today);
    },
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
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.tasks });
      qc.invalidateQueries({ queryKey: keys.completed });
    },
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
  const { data: completed } = useCompletedToday();

  const today = todayStr();
  const list = tasks ?? [];

  const dueToday = list.filter((t) => t.due?.date?.slice(0, 10) === today);
  const overdue = list.filter((t) => t.due?.date && t.due.date.slice(0, 10) < today);

  const tasksDone = completed?.length ?? 0;
  const habitsDone = habits?.filter((h) => h.completedToday).length ?? 0;

  // "At bats" is everything that was on the plate today: what got done plus
  // what is still outstanding.
  const hits = tasksDone + habitsDone;
  const atBats = hits + dueToday.length + (habits?.filter((h) => h.dueToday && !h.completedToday).length ?? 0);

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

export type TaskRow = { task: TodoistTask; depth: number; childCount: number };

/**
 * Flatten Todoist's parent_id graph into render-ready rows carrying their
 * depth. Recursive rather than one level deep: nesting can go deeper than
 * parent/child (a subtask may itself have subtasks), and a single-level
 * implementation silently drops those grandchildren.
 */
export function flattenTasks(tasks: TodoistTask[]): TaskRow[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const children = new Map<string, TodoistTask[]>();
  const roots: TodoistTask[] = [];

  for (const t of tasks) {
    // A task whose parent is absent (filtered out, or already completed) is
    // treated as a root so it can never disappear from the list.
    if (t.parent_id && byId.has(t.parent_id)) {
      const arr = children.get(t.parent_id) ?? [];
      arr.push(t);
      children.set(t.parent_id, arr);
    } else {
      roots.push(t);
    }
  }

  const order = (a: TodoistTask, b: TodoistTask) => {
    const ad = a.due?.date ?? "9999";
    const bd = b.due?.date ?? "9999";
    if (ad !== bd) return ad < bd ? -1 : 1;
    return b.priority - a.priority;
  };

  const rows: TaskRow[] = [];
  const seen = new Set<string>();

  const walk = (task: TodoistTask, depth: number) => {
    if (seen.has(task.id)) return; // guards against a cyclic parent_id
    seen.add(task.id);
    const kids = (children.get(task.id) ?? []).sort(order);
    rows.push({ task, depth, childCount: kids.length });
    for (const k of kids) walk(k, depth + 1);
  };

  for (const r of roots.sort(order)) walk(r, 0);
  return rows;
}

/**
 * The next thing to actually do. A parent with open subtasks is not
 * actionable, so this returns the first leaf in render order.
 */
export function pickUpNext(rows: TaskRow[]): TodoistTask | undefined {
  return rows.find((r) => r.childCount === 0)?.task ?? rows[0]?.task;
}
