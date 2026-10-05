import { supabase } from "./supabase";
import { asBeezDesk, type BeezDesk } from "./newspaper-beez";

/**
 * The current Beez desk, or null when the row is missing or the read fails.
 * The page is then left out rather than inventing a season.
 */
export async function readTimesBeez(): Promise<BeezDesk | null> {
  try {
    const { data, error } = await supabase
      .from("times_beez")
      .select("season, division, team, standings, skaters, goalies, last_game, results, upcoming, source, updated_at")
      .eq("id", "current")
      .maybeSingle();
    if (error || !data) return null;
    return asBeezDesk(data);
  } catch {
    return null;
  }
}
