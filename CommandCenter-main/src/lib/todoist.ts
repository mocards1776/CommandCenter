import { getAccessToken } from "./supabase";
import type {
  TodoistTask,
  TodoistProject,
  TodoistLabel,
  TodoistSection,
  NewTask,
  TaskPatch,
} from "@/types";

// All Todoist traffic goes through the `todoist` edge function so the API token
// stays server-side. Never call api.todoist.com directly from the browser.
//
// The function targets Todoist's unified /api/v1; REST v2 is retired (HTTP 410).
const FN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/todoist`;

type Paged<T> = { results: T[]; next_cursor: string | null };

async function call<T>(
  path: string,
  init: { method?: string; body?: unknown; params?: Record<string, string | number | undefined> } = {},
): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not signed in");

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(init.params ?? {})) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const url = `${FN_BASE}/${path}${qs.toString() ? `?${qs}` : ""}`;

  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Todoist ${res.status}: ${detail || res.statusText}`);
  }

  // close/delete return 204 with no body.
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

/**
 * Todoist paginates with an opaque cursor. Walk it so callers get one array
 * rather than having to care — the page cap stops a runaway loop.
 */
async function collect<T>(path: string, params: Record<string, string | number | undefined> = {}) {
  const out: T[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 20; page++) {
    const res: Paged<T> = await call<Paged<T>>(path, {
      params: { ...params, ...(cursor ? { cursor } : {}) },
    });
    out.push(...res.results);
    cursor = res.next_cursor;
    if (!cursor) break;
  }
  return out;
}

/**
 * Completed tasks live on their own endpoint and come back under `items`
 * rather than `results` — the active /tasks list never includes them.
 * Window is kept wide and filtered by the caller, so a timezone edge can't
 * silently drop the first or last completion of the day.
 */
async function collectCompleted(sinceIso: string, untilIso: string) {
  const out: TodoistTask[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 10; page++) {
    const res: { items: TodoistTask[]; next_cursor: string | null } = await call(
      "tasks/completed/by_completion_date",
      { params: { since: sinceIso, until: untilIso, limit: 200, ...(cursor ? { cursor } : {}) } },
    );
    out.push(...(res.items ?? []));
    cursor = res.next_cursor;
    if (!cursor) break;
  }
  return out;
}

export const todoist = {
  projects: () => collect<TodoistProject>("projects"),
  labels: () => collect<TodoistLabel>("labels"),
  sections: (projectId?: string) => collect<TodoistSection>("sections", { project_id: projectId }),

  /** Active (incomplete) tasks. Optionally scoped to one project. */
  tasks: (opts: { projectId?: string } = {}) =>
    collect<TodoistTask>("tasks", { project_id: opts.projectId }),

  task: (id: string) => call<TodoistTask>(`tasks/${id}`),

  /** Tasks completed in the given UTC window. */
  completed: (sinceIso: string, untilIso: string) => collectCompleted(sinceIso, untilIso),

  create: (task: NewTask) => call<TodoistTask>("tasks", { method: "POST", body: task }),

  /** Todoist takes updates as POST to the task id, not PATCH. */
  update: (id: string, patch: TaskPatch) =>
    call<TodoistTask>(`tasks/${id}`, { method: "POST", body: patch }),

  complete: (id: string) => call<void>(`tasks/${id}/close`, { method: "POST" }),
  reopen: (id: string) => call<void>(`tasks/${id}/reopen`, { method: "POST" }),
  remove: (id: string) => call<void>(`tasks/${id}`, { method: "DELETE" }),
};
