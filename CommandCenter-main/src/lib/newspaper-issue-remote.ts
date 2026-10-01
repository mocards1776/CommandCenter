import { supabase } from "./supabase";
import { asPrintedIssue, ISSUE_VERSION, slimIssue, type PrintedIssue } from "./newspaper-issue";

/** The edition already on the press, if the desk has finished it. */
export async function readRemoteIssue(id: string): Promise<PrintedIssue | null> {
  const { data, error } = await supabase
    .from("newspaper_issues")
    .select("version, status, stories, queries")
    .eq("id", id)
    .maybeSingle();
  if (error || !data || data.status !== "ready") return null;
  return asPrintedIssue(id, data.version, data.stories, data.queries);
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
