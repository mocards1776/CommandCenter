import {
  addFavoritePlayer,
  isFavoritePlayer,
  listFavoritePlayers,
  removeFavoritePlayer,
  type FavoritePlayer,
} from "./favorite-players";

export type FavoriteManager = FavoritePlayer;

export async function listFavoriteManagers(userId: string): Promise<FavoriteManager[]> {
  const all = await listFavoritePlayers(userId);
  return all.filter((f) => (f.position ?? "").toLowerCase() === "manager");
}

export async function isFavoriteManager(userId: string, managerId: string): Promise<boolean> {
  return isFavoritePlayer(userId, String(managerId));
}

export async function addFavoriteManager(input: {
  userId: string;
  managerId: string;
  managerName: string;
  teamName?: string | null;
  teamId?: string | null;
}): Promise<void> {
  await addFavoritePlayer({
    userId: input.userId,
    playerId: String(input.managerId),
    playerName: input.managerName,
    teamName: input.teamName ?? null,
    teamId: input.teamId != null ? String(input.teamId) : null,
    position: "Manager",
    sport: "baseball",
    league: "MLB",
  });
}

export async function removeFavoriteManager(userId: string, managerId: string): Promise<void> {
  await removeFavoritePlayer(userId, String(managerId));
}
