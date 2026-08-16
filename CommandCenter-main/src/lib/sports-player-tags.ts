import { supabase } from "./supabase";

export const SUGGESTED_PLAYER_TAGS = [
  "Favorite",
  "Former Cardinal",
  "Prospect",
  "Watch",
  "Trade candidate",
  "Free agent target",
] as const;

export type SportsPlayerTag = {
  id: string;
  playerId: string;
  tag: string;
  createdAt: string;
};

export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, "")
    .replace(/\s+/g, " ")
    .slice(0, 40);
}

/** "#Favorite" tags share the starred Favorite pill — not a separate sky label. */
export function isFavoriteTagName(tag: string): boolean {
  return normalizeTag(tag).toLowerCase() === "favorite";
}

export function displayPlayerTag(tag: string): string {
  const t = tag.replace(/^#+/, "").trim();
  return t ? `#${t.replace(/\s+/g, "")}` : "";
}

/** Short label without the leading # (for icon chips). */
export function playerTagLabel(tag: string): string {
  return normalizeTag(tag) || "Tag";
}

export type PlayerTagVisualKind =
  | "watch"
  | "prospect"
  | "former"
  | "trade"
  | "freeAgent"
  | "custom";

/** Distinct color + icon kind per known tag — prefer icons over "#Watch" text. */
export function playerTagVisual(tag: string): {
  kind: PlayerTagVisualKind;
  label: string;
  className: string;
} {
  const label = playerTagLabel(tag);
  const key = label.toLowerCase();
  if (key === "watch") {
    return {
      kind: "watch",
      label: "Watch",
      className: "border-violet-300/35 bg-violet-400/15 text-violet-100",
    };
  }
  if (key === "prospect") {
    return {
      kind: "prospect",
      label: "Prospect",
      className: "border-emerald-300/35 bg-emerald-400/15 text-emerald-100",
    };
  }
  if (key.includes("former")) {
    return {
      kind: "former",
      label,
      className: "border-rose-300/35 bg-rose-400/15 text-rose-100",
    };
  }
  if (key.includes("trade")) {
    return {
      kind: "trade",
      label,
      className: "border-amber-300/35 bg-amber-400/15 text-amber-100",
    };
  }
  if (key.includes("free agent") || key.includes("freeagent")) {
    return {
      kind: "freeAgent",
      label,
      className: "border-cyan-300/35 bg-cyan-400/15 text-cyan-100",
    };
  }
  return {
    kind: "custom",
    label,
    className: "border-sky-300/30 bg-sky-400/10 text-sky-100",
  };
}

export function tagFeedId(tag: string): string {
  return `tag:${normalizeTag(tag)}`;
}

export function tagFeedUrl(tag: string): string {
  return `synthetic:tag:${encodeURIComponent(normalizeTag(tag))}`;
}

export function parseTagFeedUrl(feedUrl: string): string | null {
  if (!feedUrl.startsWith("synthetic:tag:")) return null;
  try {
    return normalizeTag(decodeURIComponent(feedUrl.slice("synthetic:tag:".length)));
  } catch {
    return normalizeTag(feedUrl.slice("synthetic:tag:".length));
  }
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

/** Distinct tags this user has applied (for reuse chips + Dispatch feeds). */
export async function fetchUserTagNames(): Promise<string[]> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const userId = userData.user?.id;
  if (!userId) return [];
  const { data, error } = await supabase
    .from("sports_player_tags")
    .select("tag")
    .eq("user_id", userId);
  if (error) throw error;
  const set = new Set<string>();
  for (const r of data ?? []) {
    const t = normalizeTag(String(r.tag ?? ""));
    if (t) set.add(t);
  }
  for (const s of SUGGESTED_PLAYER_TAGS) set.add(s);
  return [...set].sort((a, b) => a.localeCompare(b));
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
