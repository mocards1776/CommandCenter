import { supabase } from "./supabase";
import { asPrintedIssue, ISSUE_VERSION, slimIssue, type PrintedIssue } from "./newspaper-issue";
import { filterRecentFiledIssues, EDITION_LOOKBACK_MS, type FiledIssueMeta } from "./newspaper-editions";
import type { EditorRequest } from "./newspaper-editor";

function filed(data: { version?: unknown; status?: unknown } | null, error: unknown): boolean {
  return !error && !!data && data.status === "ready" && data.version === ISSUE_VERSION;
}

/** Stories only, so the filed edition can open before the desks arrive. */
export async function readRemoteStories(id: string): Promise<unknown[] | null> {
  const { data, error } = await supabase
    .from("newspaper_issues")
    .select("version, status, stories")
    .eq("id", id)
    .maybeSingle();
  if (!filed(data, error) || !data || !Array.isArray(data.stories)) return null;
  return data.stories;
}

/** Desks and art for an edition already on screen. */
export async function readRemoteQueries(id: string): Promise<PrintedIssue["queries"] | null> {
  const { data, error } = await supabase
    .from("newspaper_issues")
    .select("version, status, queries")
    .eq("id", id)
    .maybeSingle();
  if (!filed(data, error) || !data || !Array.isArray(data.queries)) return null;
  return (data.queries as unknown[]).filter(isQuery);
}

function isQuery(value: unknown): value is PrintedIssue["queries"][number] {
  if (!value || typeof value !== "object") return false;
  return Array.isArray((value as { key?: unknown }).key);
}

/** The edition already on the press, if the desk has finished it. */
export async function readRemoteIssue(id: string): Promise<PrintedIssue | null> {
  const { data, error } = await supabase
    .from("newspaper_issues")
    .select("version, status, stories, queries, printed_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !data || data.status !== "ready") return null;
  return asPrintedIssue(id, data.version, data.stories, data.queries, { printedAt: data.printed_at });
}

/** Ready issues printed in the last 24 hours, newest first. */
export async function listRecentIssues(now = Date.now()): Promise<FiledIssueMeta[]> {
  const since = new Date(now - EDITION_LOOKBACK_MS).toISOString();
  const { data, error } = await supabase
    .from("newspaper_issues")
    .select("id, printed_at")
    .eq("status", "ready")
    .gte("printed_at", since)
    .order("printed_at", { ascending: false });
  if (error || !data) return [];
  return filterRecentFiledIssues(
    data.flatMap((row) =>
      typeof row.id === "string" && typeof row.printed_at === "string"
        ? [{ id: row.id, printedAt: row.printed_at }]
        : [],
    ),
    now,
  );
}

/** The AI editor, for a device setting the paper itself. A throw means the rule desk sets it. */
export async function askRemoteEditor(request: EditorRequest, timeoutMs = 25_000): Promise<unknown> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("newspaper-editor timed out")), timeoutMs);
  });
  try {
    const { data, error } = await Promise.race([
      supabase.functions.invoke("newspaper-editor", { body: request }),
      timeout,
    ]);
    const body = data as { ok?: boolean; desk?: unknown } | null;
    if (error || !body?.ok || !body.desk) throw error ?? new Error("newspaper-editor had no answer");
    return body.desk;
  } finally {
    clearTimeout(timer);
  }
}

/** File an edition once. A later press does not overwrite the one already out. */
export async function writeRemoteIssue(issue: PrintedIssue): Promise<void> {
  const slim = slimIssue(issue);
  const { error } = await supabase.from("newspaper_issues").insert({
    id: slim.id,
    version: ISSUE_VERSION,
    status: "ready",
    stories: slim.stories as never,
    queries: slim.queries as never,
  });
  if (error && error.code !== "23505") {
    /* the edition can still live on this device */
  }
}

/** Remember which clubs belong on the desk, so the press can run while the app is closed. */
export async function writeDesk(desk: { userId: string; order: string[]; hidden: string[] }): Promise<void> {
  await supabase.from("newspaper_desk").upsert(
    {
      id: "household",
      user_id: desk.userId,
      fav_order: desk.order,
      hidden: desk.hidden,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
}
