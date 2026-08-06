import { useMemo, useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  useTasks,
  useProjects,
  useCreateTask,
  useCompleteTask,
  useDeleteTask,
  flattenTasks,
} from "@/lib/queries";
import { cn, dueLabel, isOverdue, todayStr } from "@/lib/utils";

type Filter = "all" | "today" | "overdue";

export default function TodosPage() {
  const { data: tasks, isLoading, error } = useTasks();
  const { data: projects } = useProjects();
  const create = useCreateTask();
  const complete = useCompleteTask();
  const remove = useDeleteTask();

  const [draft, setDraft] = useState("");
  const [projectId, setProjectId] = useState("");
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

    // Filtering first means a child whose parent is filtered out still shows,
    // as a root — flattenTasks treats an absent parent as top level.
    return flattenTasks(filtered);
  }, [tasks, filter]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content) return;
    setDraft("");
    try {
      // Todoist parses the natural-language date itself, server-side.
      await create.mutateAsync({ content, project_id: projectId || undefined });
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

  return (
    <div className="flex max-w-4xl flex-col gap-4 p-6 md:p-7">
      <h2 className="rule-head">Tasks</h2>

      <form onSubmit={onAdd} className="flex flex-col gap-2 sm:flex-row">
        <div className="bg-panel flex flex-1 items-center gap-2.5 rounded-sm border border-white/10 px-4 focus-within:border-accent/50">
          <Plus size={15} className="text-chalk-dim shrink-0" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder='Add a task — try "Call Dave tomorrow at 3pm"'
            className="placeholder:text-chalk-dim flex-1 bg-transparent py-3 text-[13px] outline-none"
          />
        </div>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="bg-panel text-cream rounded-sm border border-white/10 px-3 py-3 text-[13px] outline-none focus:border-accent/50"
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
          className="from-accent-deep to-accent-dark text-cream rounded-sm bg-gradient-to-b px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.20em] transition hover:brightness-110 disabled:opacity-40"
        >
          Add
        </button>
      </form>

      <div className="flex items-center gap-1">
        {(["all", "today", "overdue"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 text-[10.5px] uppercase tracking-[0.19em] transition-colors",
              filter === f ? "text-accent border-b border-accent" : "text-chalk hover:text-cream",
            )}
          >
            {f}
          </button>
        ))}
        <span className="label-caps ml-auto">{visible.length} tasks</span>
      </div>

      <div className="bg-panel rounded border border-white/[0.07]">
        {isLoading ? (
          <p className="label-caps animate-pulse py-10 text-center">Loading</p>
        ) : visible.length === 0 ? (
          <p className="text-chalk py-10 text-center text-sm">Nothing here.</p>
        ) : (
          <ul>
            {visible.map(({ task: t, depth, childCount }) => {
              const late = isOverdue(t.due?.date);
              return (
                <li
                  key={t.id}
                  className={cn(
                    "group flex items-center gap-4 border-b border-white/[0.055] py-3 pr-5 last:border-0",
                    depth > 0 && "bg-white/[0.015]",
                  )}
                  style={{ paddingLeft: 20 + depth * 26 }}
                >
                  {depth > 0 && (
                    <span aria-hidden className="text-chalk-dim -ml-4 text-[11px]">
                      └
                    </span>
                  )}
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

                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate", depth > 0 ? "text-[12.5px]" : "text-[13.5px]")}>
                      {t.content}
                    </p>
                    {t.labels.length > 0 && (
                      <p className="text-chalk-dim truncate text-[11px]">
                        {t.labels.map((l) => `@${l}`).join(" ")}
                      </p>
                    )}
                  </div>

                  {childCount > 0 && (
                    <span className="text-chalk-dim shrink-0 text-[10.5px] tracking-[0.10em]">
                      {childCount} sub{childCount === 1 ? "" : "s"}
                    </span>
                  )}
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

                  <button
                    onClick={() => {
                      if (confirm(`Delete "${t.content}"?`)) remove.mutate(t.id);
                    }}
                    aria-label={`Delete ${t.content}`}
                    className="text-chalk-dim hover:text-alert shrink-0 opacity-0 transition group-hover:opacity-100"
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
