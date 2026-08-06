import { useMemo, useState, type FormEvent } from "react";
import { Check, Trash2, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { useTasks, useProjects, useCreateTask, useCompleteTask, useDeleteTask } from "@/lib/queries";
import { dueLabel, isOverdue, priorityColor, cn, todayStr } from "@/lib/utils";
import type { TodoistTask } from "@/types";

type Filter = "all" | "today" | "overdue";

export default function TodosPage() {
  const { data: tasks, isLoading, error } = useTasks();
  const { data: projects } = useProjects();
  const create = useCreateTask();
  const complete = useCompleteTask();
  const remove = useDeleteTask();

  const [draft, setDraft] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [filter, setFilter] = useState<Filter>("all");

  const projectName = useMemo(
    () => new Map((projects ?? []).map((p) => [p.id, p.name])),
    [projects],
  );

  const visible = useMemo(() => {
    const today = todayStr();
    const list = tasks ?? [];
    const filtered =
      filter === "today"
        ? list.filter((t) => t.due?.date?.slice(0, 10) === today)
        : filter === "overdue"
          ? list.filter((t) => t.due?.date && t.due.date.slice(0, 10) < today)
          : list;

    // Dated tasks first, soonest at the top; undated fall to the bottom.
    return [...filtered].sort((a, b) => {
      const ad = a.due?.date ?? "9999";
      const bd = b.due?.date ?? "9999";
      if (ad !== bd) return ad < bd ? -1 : 1;
      return b.priority - a.priority;
    });
  }, [tasks, filter]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content) return;
    setDraft("");
    try {
      // due_string is passed straight through — Todoist parses "tomorrow at
      // 3pm" server-side, so there is no date parsing in this app.
      await create.mutateAsync({
        content,
        project_id: projectId || undefined,
      });
    } catch (err) {
      setDraft(content);
      toast.error(err instanceof Error ? err.message : "Could not add task");
    }
  }

  if (error) {
    return (
      <div className="panel p-4 text-clay text-sm">
        Could not load tasks: {error instanceof Error ? error.message : String(error)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <form onSubmit={onAdd} className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 flex items-center gap-2 panel px-3">
          <Plus size={16} className="text-chalk shrink-0" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a task — try &quot;Call Dave tomorrow at 3pm&quot;"
            className="flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-chalk-dim"
          />
        </div>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="panel px-3 py-2.5 text-sm outline-none focus:border-gold"
        >
          <option value="">Inbox</option>
          {(projects ?? [])
            .filter((p) => !p.is_archived)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
        <button
          type="submit"
          disabled={create.isPending || !draft.trim()}
          className="bg-gold text-shell font-semibold uppercase tracking-wider text-xs px-5 py-2.5 hover:brightness-110 disabled:opacity-40 transition"
        >
          Add
        </button>
      </form>

      <div className="flex gap-1">
        {(["all", "today", "overdue"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 text-xs uppercase tracking-wider font-semibold transition-colors",
              filter === f ? "bg-panel text-gold" : "text-chalk hover:text-cream",
            )}
          >
            {f}
          </button>
        ))}
        <span className="ml-auto label-caps self-center">{visible.length} tasks</span>
      </div>

      <div className="panel">
        {isLoading ? (
          <p className="px-3 py-8 text-center label-caps animate-pulse">Loading</p>
        ) : visible.length === 0 ? (
          <p className="px-3 py-8 text-center text-chalk text-sm">Nothing here.</p>
        ) : (
          <ul>
            {visible.map((t: TodoistTask) => {
              const label = dueLabel(t.due?.date);
              const overdue = isOverdue(t.due?.date);
              return (
                <li
                  key={t.id}
                  className="flex items-center gap-3 px-3 py-2.5 border-b border-line last:border-0 group"
                >
                  <button
                    onClick={() => complete.mutate(t.id)}
                    aria-label={`Complete ${t.content}`}
                    className="w-4 h-4 shrink-0 border-2 rounded-full grid place-items-center hover:bg-turf/20 transition-colors"
                    style={{ borderColor: priorityColor(t.priority) || "var(--color-panel-hi)" }}
                  >
                    <Check size={10} className="opacity-0 group-hover:opacity-60 transition-opacity" />
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm">{t.content}</p>
                    {t.labels.length > 0 && (
                      <p className="text-xs text-chalk-dim truncate">
                        {t.labels.map((l) => `@${l}`).join(" ")}
                      </p>
                    )}
                  </div>

                  {t.project_id && projectName.has(t.project_id) && (
                    <span className="text-xs text-chalk-dim shrink-0 hidden sm:inline">
                      {projectName.get(t.project_id)}
                    </span>
                  )}
                  {label && (
                    <span className={cn("text-xs shrink-0", overdue ? "text-clay" : "text-chalk")}>
                      {label}
                    </span>
                  )}

                  <button
                    onClick={() => {
                      if (confirm(`Delete "${t.content}"?`)) remove.mutate(t.id);
                    }}
                    aria-label={`Delete ${t.content}`}
                    className="opacity-0 group-hover:opacity-100 text-chalk-dim hover:text-clay transition shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
