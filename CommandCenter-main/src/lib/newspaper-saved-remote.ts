import { requireUserId, supabase } from "./supabase";
import type { SavedArticle, SavedSnapshot } from "./newspaper-saved";

function asRow(r: {
  id: string;
  story_id: string;
  headline: string;
  dek: string | null;
  body: string | null;
  byline: string | null;
  source: string | null;
  url: string | null;
  image: string | null;
  section: string | null;
  edition_date: string | null;
  saved_at: string;
}): SavedArticle {
  return {
    id: r.id,
    storyId: r.story_id,
    headline: r.headline,
    dek: r.dek,
    body: r.body,
    byline: r.byline,
    source: r.source,
    url: r.url,
    image: r.image,
    section: r.section,
    editionDate: r.edition_date,
    savedAt: r.saved_at,
  };
}

export async function fetchSavedArticles(): Promise<SavedArticle[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("times_saved_articles")
    .select("*")
    .eq("user_id", userId)
    .order("saved_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(asRow);
}

export async function saveTimesArticle(snap: SavedSnapshot): Promise<SavedArticle> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("times_saved_articles")
    .upsert(
      {
        user_id: userId,
        story_id: snap.storyId,
        headline: snap.headline,
        dek: snap.dek,
        body: snap.body,
        byline: snap.byline,
        source: snap.source,
        url: snap.url,
        image: snap.image,
        section: snap.section,
        edition_date: snap.editionDate,
        saved_at: new Date().toISOString(),
      },
      { onConflict: "user_id,story_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return asRow(data);
}

export async function unsaveTimesArticle(storyId: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("times_saved_articles")
    .delete()
    .eq("user_id", userId)
    .eq("story_id", storyId);
  if (error) throw error;
}
