import { supabase } from "./supabase";
import { asClassNewsletter, type ClassNewsletter } from "./newspaper-class.ts";

/**
 * The newest class letter on or before the edition date.
 * A missing table or a failed read returns null and The Day Ahead prints as it does today.
 */
export async function fetchClassNewsletter(editionDate: string): Promise<ClassNewsletter | null> {
  try {
    const { data, error } = await supabase
      .from("times_class_newsletter")
      .select("week_of, teacher, learning, reminders, upcoming")
      .lte("week_of", editionDate)
      .order("week_of", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return asClassNewsletter(data);
  } catch {
    return null;
  }
}
