import { supabase } from "@/lib/supabase";

/**
 * Sole Command Center login. The player-ask edge function checks the same
 * id and email from the verified JWT. Keep in sync with
 * supabase/functions/player-ask/owner.ts.
 */
export const OWNER_USER_ID = "0a04c242-4b3a-4cac-8441-3844c3d57da0";
export const OWNER_EMAIL = "josh@thompsoncommunications.net";

export type PlayerAskSport = "mlb" | "nfl" | "nhl" | "cfb";

export type PlayerAskStat = { label: string; value: string };

export type PlayerAskContext = {
  name: string;
  team: string | null;
  position: string | null;
  bio: string;
  seasonLabel: string | null;
  seasonStats: PlayerAskStat[];
  recentGames: string[];
};

export type PlayerAiSource = { url: string; title: string | null };

export type PlayerAiAnswer = {
  id: string;
  player_id: string;
  sport: PlayerAskSport;
  question: string;
  answer: string;
  sources: PlayerAiSource[];
  asked_at: string;
};

export function isAskOwner(user: { id?: string | null; email?: string | null } | null | undefined): boolean {
  const id = user?.id?.trim() ?? "";
  const email = user?.email?.trim().toLowerCase() ?? "";
  return id === OWNER_USER_ID && email === OWNER_EMAIL;
}

function asSources(raw: unknown): PlayerAiSource[] {
  if (!Array.isArray(raw)) return [];
  const out: PlayerAiSource[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.url !== "string" || !/^https?:\/\//i.test(row.url)) continue;
    out.push({
      url: row.url,
      title: typeof row.title === "string" && row.title.trim() ? row.title.trim() : null,
    });
  }
  return out;
}

export async function listPlayerAiAnswers(
  sport: PlayerAskSport,
  playerId: string,
): Promise<PlayerAiAnswer[]> {
  const { data, error } = await supabase
    .from("player_ai_answers")
    .select("id, player_id, sport, question, answer, sources, asked_at")
    .eq("sport", sport)
    .eq("player_id", playerId)
    .order("asked_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    player_id: row.player_id,
    sport: row.sport as PlayerAskSport,
    question: row.question,
    answer: row.answer,
    sources: asSources(row.sources),
    asked_at: row.asked_at,
  }));
}

async function edgeErrorMessage(error: { message: string; context?: unknown }, fallback: string) {
  const ctx = error.context as { json?: () => Promise<unknown> } | undefined;
  try {
    if (ctx && typeof ctx.json === "function") {
      const body = (await ctx.json()) as { error?: string };
      if (body?.error) return body.error;
    }
  } catch {
    // The generic functions error is enough.
  }
  if (error.message && !/non-2xx/i.test(error.message)) return error.message;
  return fallback;
}

export async function askPlayerAi(input: {
  sport: PlayerAskSport;
  playerId: string;
  question: string;
  context: PlayerAskContext;
}): Promise<PlayerAiAnswer> {
  const { data, error } = await supabase.functions.invoke<{
    answer?: PlayerAiAnswer;
    error?: string;
  }>("player-ask", { body: input });
  if (data?.error) throw new Error(data.error);
  if (error) throw new Error(await edgeErrorMessage(error, "Could not ask."));
  if (!data?.answer) throw new Error("No answer came back.");
  return {
    ...data.answer,
    sources: asSources(data.answer.sources),
  };
}

export function sourceLabel(source: PlayerAiSource): string {
  if (source.title) return source.title;
  try {
    return new URL(source.url).hostname.replace(/^www\./, "");
  } catch {
    return source.url;
  }
}

export function statLine(stats: { label: string; value: string }[], limit = 8): string {
  return stats
    .slice(0, limit)
    .filter((s) => s.label && s.value)
    .map((s) => `${s.label} ${s.value}`)
    .join(", ");
}
