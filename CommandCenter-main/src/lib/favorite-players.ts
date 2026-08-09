import { supabase } from "./supabase";

export type FavoritePlayer = {
  id: string;
  userId: string;
  playerId: string;
  playerName: string;
  teamName: string | null;
  teamId: string | null;
  sport: string | null;
  league: string | null;
  position: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  user_id: string;
  player_id: string;
  player_name: string;
  team_name: string | null;
  team_id: string | null;
  sport: string | null;
  league: string | null;
  position: string | null;
  created_at: string;
};

function mapRow(r: Row): FavoritePlayer {
  return {
    id: r.id,
    userId: r.user_id,
    playerId: r.player_id,
    playerName: r.player_name,
    teamName: r.team_name,
    teamId: r.team_id,
    sport: r.sport,
    league: r.league,
    position: r.position,
    createdAt: r.created_at,
  };
}

export async function listFavoritePlayers(userId: string): Promise<FavoritePlayer[]> {
  const { data, error } = await supabase
    .from("favorite_sports_players")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Row[]).map(mapRow);
}

export async function isFavoritePlayer(userId: string, playerId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("favorite_sports_players")
    .select("id")
    .eq("user_id", userId)
    .eq("player_id", playerId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function addFavoritePlayer(input: {
  userId: string;
  playerId: string;
  playerName: string;
  teamName?: string | null;
  teamId?: string | null;
  position?: string | null;
  sport?: string;
  league?: string;
}): Promise<void> {
  const { error } = await supabase.from("favorite_sports_players").upsert(
    {
      user_id: input.userId,
      player_id: String(input.playerId),
      player_name: input.playerName,
      team_name: input.teamName ?? null,
      team_id: input.teamId != null ? String(input.teamId) : null,
      position: input.position ?? null,
      sport: input.sport ?? "baseball",
      league: input.league ?? "MLB",
    },
    { onConflict: "user_id,player_id" },
  );
  if (error) throw error;
}

export async function removeFavoritePlayer(userId: string, playerId: string): Promise<void> {
  const { error } = await supabase
    .from("favorite_sports_players")
    .delete()
    .eq("user_id", userId)
    .eq("player_id", String(playerId));
  if (error) throw error;
}
