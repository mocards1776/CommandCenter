import { supabase } from "./supabase";
import { peekProofIssue } from "./newspaper-issue";
import { asNationalDesk, type NationalDesk } from "./newspaper-national";

/** The filed National News page for this edition, or null (section stays off). */
function peekProofNational(issueId: string): NationalDesk | null {
  const raw = (globalThis as { __TT_PROOF_NATIONAL__?: unknown }).__TT_PROOF_NATIONAL__;
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== "object") return null;
  const desk = asNationalDesk(row as Parameters<typeof asNationalDesk>[0]);
  if (desk?.issueId && desk.issueId !== issueId) return null;
  return desk;
}

export async function readTimesNationalNews(issueId: string): Promise<NationalDesk | null> {
  const proof = peekProofNational(issueId);
  if (proof) return proof;
  const planted = peekProofIssue(issueId)?.companions?.national;
  if (planted && typeof planted === "object") {
    const desk = asNationalDesk(planted as Parameters<typeof asNationalDesk>[0]);
    if (desk) return desk;
    const row = planted as NationalDesk;
    if (typeof row.issueId === "string" && Array.isArray(row.stories) && row.stories.length) return row;
  }
  const { data, error } = await supabase
    .from("times_national_news")
    .select("issue_id, day, edition, stories, sources, editor, printed_at")
    .eq("issue_id", issueId)
    .maybeSingle();
  if (error || !data) return null;
  return asNationalDesk(data);
}
