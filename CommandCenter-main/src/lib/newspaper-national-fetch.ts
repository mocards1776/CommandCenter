import { supabase } from "./supabase";
import { asNationalDesk, type NationalDesk } from "./newspaper-national";

/** The filed National News page for this edition, or null (section stays off). */
export async function readTimesNationalNews(issueId: string): Promise<NationalDesk | null> {
  const { data, error } = await supabase
    .from("times_national_news")
    .select("issue_id, day, edition, stories, sources, editor, printed_at")
    .eq("issue_id", issueId)
    .maybeSingle();
  if (error || !data) return null;
  return asNationalDesk(data);
}
