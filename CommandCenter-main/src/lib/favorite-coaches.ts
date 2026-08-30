import {
  addFavoritePlayer,
  isFavoritePlayer,
  listFavoritePlayers,
  removeFavoritePlayer,
  type FavoritePlayer,
} from "./favorite-players";

export type FavoriteCoach = FavoritePlayer;

export async function listFavoriteCoaches(userId: string): Promise<FavoriteCoach[]> {
  const all = await listFavoritePlayers(userId);
  return all.filter((f) => (f.position ?? "").toLowerCase() === "coach");
}

export async function isFavoriteCoach(userId: string, coachId: string): Promise<boolean> {
  return isFavoritePlayer(userId, String(coachId));
}

export async function addFavoriteCoach(input: {
  userId: string;
  coachId: string;
  coachName: string;
  teamName?: string | null;
  teamId?: string | null;
  sport?: string;
  league?: string;
}): Promise<void> {
  await addFavoritePlayer({
    userId: input.userId,
    playerId: String(input.coachId),
    playerName: input.coachName,
    teamName: input.teamName ?? null,
    teamId: input.teamId != null ? String(input.teamId) : null,
    position: "Coach",
    sport: input.sport ?? "football",
    league: input.league ?? "CFB",
  });
}

export async function removeFavoriteCoach(userId: string, coachId: string): Promise<void> {
  await removeFavoritePlayer(userId, String(coachId));
}
