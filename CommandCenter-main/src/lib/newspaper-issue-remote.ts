import { supabase } from "./supabase";
import { asFiledQueries, asPrintedIssue, ISSUE_VERSION, peekProofIssue, slimIssue, type PrintedIssue } from "./newspaper-issue";
import { filterRecentFiledIssues, EDITION_LOOKBACK_MS, type FiledIssueMeta } from "./newspaper-editions";
import type { EditorRequest } from "./newspaper-editor";
import { ISSUE_QUERY_COLUMNS, ISSUE_SHELL_COLUMNS } from "./newspaper-payload";
import { consumeIssueShellStream, frontPrefixLength, yieldToPaint } from "./newspaper-front-load";

function filed(data: { version?: unknown; status?: unknown } | null, error: unknown): boolean {
  return !error && !!data && data.status === "ready" && data.version === ISSUE_VERSION;
}

/** Stories only, so the filed edition can open before the desks arrive. */
export async function readRemoteStories(id: string): Promise<unknown[] | null> {
  const shell = await readRemoteIssueShell(id);
  return shell?.stories ?? null;
}

async function* responseTextChunks(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value?.byteLength) yield decoder.decode(value, { stream: true });
    }
    const rest = decoder.decode();
    if (rest) yield rest;
  } finally {
    reader.releaseLock();
  }
}

/**
 * Stories + print clock, A1 first. `onFront` runs once the lead slots are in
 * hand; the returned issue still has every story. Desks stay on the queries
 * request so the ~4MB file does not compete with first paint.
 */
export async function readRemoteIssueFrontFirst(
  id: string,
  onFront: (issue: PrintedIssue) => void,
): Promise<PrintedIssue | null> {
  const planted = peekProofIssue(id);
  if (planted) {
    const shell = { ...planted, queries: [] as PrintedIssue["queries"] };
    const n = frontPrefixLength(shell.stories);
    if (n < shell.stories.length) {
      onFront({ ...shell, stories: shell.stories.slice(0, n) });
      await yieldToPaint();
    }
    return shell;
  }

  const base = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!base || !key) return readRemoteIssueShell(id);

  try {
    const { data } = await supabase.auth.getSession();
    const headers: Record<string, string> = {
      apikey: key,
      Accept: "application/vnd.pgrst.object+json",
    };
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
    const url = `${base.replace(/\/$/, "")}/rest/v1/newspaper_issues?id=eq.${encodeURIComponent(id)}&select=${encodeURIComponent(ISSUE_SHELL_COLUMNS.replace(/\s/g, ""))}`;
    const res = await fetch(url, { headers });
    if (!res.ok || !res.body) return readRemoteIssueShell(id);
    const streamed = await consumeIssueShellStream(responseTextChunks(res.body), (stories) => {
      const partial = asPrintedIssue(id, ISSUE_VERSION, stories, []);
      if (partial) onFront(partial);
    });
    if (!streamed) return readRemoteIssueShell(id);
    return asPrintedIssue(id, streamed.version, streamed.stories, [], { printedAt: streamed.printedAt });
  } catch {
    return readRemoteIssueShell(id);
  }
}

/** Stories + print clock, no desks. A1 can set from this. */
export async function readRemoteIssueShell(id: string): Promise<PrintedIssue | null> {
  const planted = peekProofIssue(id);
  if (planted) return { ...planted, queries: [] };
  const { data, error } = await supabase
    .from("newspaper_issues")
    .select(ISSUE_SHELL_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (!filed(data, error) || !data || !Array.isArray(data.stories)) return null;
  return asPrintedIssue(id, data.version, data.stories, [], { printedAt: data.printed_at });
}

/** Desks and art for an edition already on screen. */
export async function readRemoteQueries(id: string): Promise<PrintedIssue["queries"] | null> {
  const planted = peekProofIssue(id);
  if (planted) return planted.queries;
  const { data, error } = await supabase
    .from("newspaper_issues")
    .select(ISSUE_QUERY_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (!filed(data, error) || !data) return null;
  if (Array.isArray(data.queries)) return asFiledQueries(data.queries);
  // Printing leftover or a sidecar: `{ desks: [...] }`. Same contract as an array.
  const desks = asFiledQueries(data.queries);
  return desks.length ? desks : null;
}

/** A newly ready press, while the Times is open. iOS will not fire this if the app is closed. */
export function subscribeReadyIssues(onReady: (row: FiledIssueMeta) => void): () => void {
  const channel = supabase
    .channel("tt-newspaper-issues")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "newspaper_issues" },
      (payload) => {
        const row = (payload.new ?? null) as { id?: unknown; status?: unknown; printed_at?: unknown } | null;
        if (!row || row.status !== "ready" || typeof row.id !== "string") return;
        onReady({
          id: row.id,
          printedAt: typeof row.printed_at === "string" ? row.printed_at : "",
        });
      },
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

/** The edition already on the press, if the desk has finished it. */
export async function readRemoteIssue(id: string): Promise<PrintedIssue | null> {
  const planted = peekProofIssue(id);
  if (planted) return planted;
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
