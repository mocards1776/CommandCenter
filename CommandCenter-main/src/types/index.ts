import type { Tables, TablesInsert, TablesUpdate } from "./database";

export type { Database, Tables, TablesInsert, TablesUpdate } from "./database";

// ─── Supabase-backed records ──────────────────────────────────────────────
export type Profile = Tables<"profiles">;
export type Habit = Tables<"habits">;
export type HabitCompletion = Tables<"habit_completions">;
export type TimeEntry = Tables<"time_entries">;
export type TimeBlock = Tables<"time_blocks">;
export type Note = Tables<"notes">;
export type CRMPerson = Tables<"crm_people">;
export type BraindumpEntry = Tables<"braindump_entries">;
export type FavoriteSportsTeam = Tables<"favorite_sports_teams">;
export type Book = Tables<"books">;
export type BookInsert = TablesInsert<"books">;
export type BookHighlight = Tables<"book_highlights">;

export type ReadStatus = "read" | "to-read" | "currently-reading" | "did-not-finish" | "paused";

export type HabitInsert = TablesInsert<"habits">;
export type HabitUpdate = TablesUpdate<"habits">;

export type HabitFrequency = "daily" | "weekdays" | "weekends" | "weekly" | "custom";

/** A habit plus the derived state the UI needs. */
export type HabitWithStatus = Habit & {
  completedToday: boolean;
  streak: number;
  dueToday: boolean;
};

// ─── Todoist (unified /api/v1) ────────────────────────────────────────────
// Todoist priority is inverted from what you'd expect: 4 is urgent, 1 is none.
export type TodoistPriority = 1 | 2 | 3 | 4;

export type TodoistDue = {
  date: string; // YYYY-MM-DD or full ISO when a time is set
  string: string; // the natural-language text the user typed
  lang: string;
  is_recurring: boolean;
  timezone?: string | null;
};

export type TodoistTask = {
  id: string;
  project_id: string;
  section_id: string | null;
  parent_id: string | null;
  content: string;
  description: string;
  labels: string[];
  priority: TodoistPriority;
  due: TodoistDue | null;
  deadline: { date: string } | null;
  duration: { amount: number; unit: "minute" | "day" } | null;
  checked: boolean;
  is_deleted: boolean;
  child_order: number;
  added_at: string;
  completed_at: string | null;
  url?: string;
};

export type TodoistProject = {
  id: string;
  name: string;
  color: string;
  parent_id: string | null;
  child_order: number;
  is_favorite: boolean;
  is_archived: boolean;
  is_deleted: boolean;
  view_style: string;
};

export type TodoistLabel = {
  id: string;
  name: string;
  color: string;
  order: number;
  is_favorite: boolean;
};

export type TodoistSection = {
  id: string;
  project_id: string;
  name: string;
  section_order: number;
};

/** Fields accepted when creating a task. `due_string` uses Todoist's own
 *  natural-language parser ("tomorrow at 3pm"), which is why this app has no
 *  date-parsing code of its own. */
export type NewTask = {
  content: string;
  description?: string;
  project_id?: string;
  section_id?: string;
  parent_id?: string;
  labels?: string[];
  priority?: TodoistPriority;
  due_string?: string;
  due_date?: string;
  duration?: number;
  duration_unit?: "minute" | "day";
};

export type TaskPatch = Partial<Omit<NewTask, "project_id" | "section_id" | "parent_id">>;

// ─── Dashboard ────────────────────────────────────────────────────────────
/** Baseball scoring, computed client-side from Todoist + Supabase rather than
 *  by a server endpoint (the old /dashboard/ route was the usual suspect when
 *  stats went blank). */
export type Scoreboard = {
  hits: number; // tasks completed today
  atBats: number; // tasks due today
  battingAverage: number;
  strikeouts: number; // overdue
  onDeck: number; // due today, not done
  focusMinutes: number;
  habitStreak: number;
};
