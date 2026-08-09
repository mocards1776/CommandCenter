import { supabase } from "./supabase";

export type SportsEntityType = "player" | "manager";

export type SportsPersonNote = {
  id: string;
  userId: string;
  entityType: SportsEntityType;
  entityId: string;
  content: string;
  updatedAt: string;
};

type Row = {
  id: string;
  user_id: string;
  entity_type: SportsEntityType;
  entity_id: string;
  content: string;
  updated_at: string;
};

function mapRow(r: Row): SportsPersonNote {
  return {
    id: r.id,
    userId: r.user_id,
    entityType: r.entity_type,
    entityId: r.entity_id,
    content: r.content,
    updatedAt: r.updated_at,
  };
}

export async function getSportsPersonNote(
  userId: string,
  entityType: SportsEntityType,
  entityId: string | number,
): Promise<SportsPersonNote | null> {
  const { data, error } = await supabase
    .from("sports_person_notes")
    .select("*")
    .eq("user_id", userId)
    .eq("entity_type", entityType)
    .eq("entity_id", String(entityId))
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as Row) : null;
}

export async function upsertSportsPersonNote(input: {
  userId: string;
  entityType: SportsEntityType;
  entityId: string | number;
  content: string;
}): Promise<SportsPersonNote> {
  const { data, error } = await supabase
    .from("sports_person_notes")
    .upsert(
      {
        user_id: input.userId,
        entity_type: input.entityType,
        entity_id: String(input.entityId),
        content: input.content,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,entity_type,entity_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return mapRow(data as Row);
}
