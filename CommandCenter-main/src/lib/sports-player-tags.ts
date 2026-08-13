import { supabase } from "./supabase";

export const SUGGESTED_PLAYER_TAGS = [
  "Former Cardinal",
  "Prospect",
  "Watch",
  "Trade candidate",
  "Free agent target",
  "Favorite",
] as const;

export type SportsPlayerTag = {
  id: string;
  playerId: string;
  tag: string;
  createdAt: string;
};

function normalizeTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, "")
    .replace(/\s+/g, " ")
    .slice(0, 40);
}

export function displayPlayerTag(tag: string): string {
  const t = tag.replace(/^#+/, "").trim();
  return t ? `#${t.replace(/\s+/g, "")}` : "";
}

export async function fetchPlayerTags(playerId: string | number): Promise<SportsPlayerTag[]> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const userId = userData.user?.id;
  if (!userId) return [];
  const { data, error } = await supabase
    .from("sports_player_tags")
    .select("*")
    .eq("user_id", userId)
    .eq("player_id", String(playerId))
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    playerId: r.player_id,
    tag: r.tag,
    createdAt: r.created_at,
  }));
}

export async function fetchPlayersWithTag(tag: string): Promise<SportsPlayerTag[]> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const userId = userData.user?.id;
  if (!userId) return [];
  const normalized = normalizeTag(tag);
  const { data, error } = await supabase
    .from("sports_player_tags")
    .select("*")
    .eq("user_id", userId)
    .ilike("tag", normalized)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    playerId: r.player_id,
    tag: r.tag,
    createdAt: r.created_at,
  }));
}

/** All player ids the user has tagged (any label). */
export async function fetchTaggedPlayerIds(): Promise<number[]> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const userId = userData.user?.id;
  if (!userId) return [];
  const { data, error } = await supabase
    .from("sports_player_tags")
    .select("player_id")
    .eq("user_id", userId);
  if (error) throw error;
  const ids = new Set<number>();
  for (const r of data ?? []) {
    const n = Number(r.player_id);
    if (Number.isFinite(n)) ids.add(n);
  }
  return [...ids];
}

export async function addPlayerTag(
  playerId: string | number,
  tag: string,
): Promise<SportsPlayerTag> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not signed in");
  const normalized = normalizeTag(tag);
  if (!normalized) throw new Error("Tag is empty");
  const { data, error } = await supabase
    .from("sports_player_tags")
    .upsert(
      {
        user_id: userId,
        player_id: String(playerId),
        tag: normalized,
      },
      { onConflict: "user_id,player_id,tag" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    playerId: data.player_id,
    tag: data.tag,
    createdAt: data.created_at,
  };
}

export async function removePlayerTag(id: string): Promise<void> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not signed in");
  const { error } = await supabase
    .from("sports_player_tags")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
}
