import { supabase } from "./supabase";
import { normalizeEvents, normalizeUpcoming, type DaySchedule } from "./newspaper-day-ahead";

/**
 * The schedule filed for one America/Chicago date, or null when none was filed
 * (the page is then left out rather than reprinting an older day). Read-only; RLS
 * lets only a signed-in reader see it.
 */
export async function fetchDaySchedule(date: string): Promise<DaySchedule | null> {
  const { data, error } = await supabase
    .from("times_day_schedule")
    .select("schedule_date, events, upcoming")
    .eq("schedule_date", date)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    date: data.schedule_date,
    events: normalizeEvents(data.events),
    upcoming: normalizeUpcoming(data.upcoming, data.schedule_date),
  };
}
