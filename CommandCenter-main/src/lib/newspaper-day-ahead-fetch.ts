import { supabase } from "./supabase";
import { normalizeEvents, normalizeUpcoming, type DaySchedule } from "./newspaper-day-ahead";

/**
 * The schedule filed for one America/Chicago date, or null when none was filed
 * (the page is then left out rather than reprinting an older day). Read-only; RLS
 * lets only a signed-in reader see it.
 */
function peekProofDay(date: string): DaySchedule | null {
  const raw = (globalThis as { __TT_PROOF_DAY__?: unknown }).__TT_PROOF_DAY__;
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== "object") return null;
  const rec = row as { schedule_date?: unknown; date?: unknown; events?: unknown; upcoming?: unknown };
  const when = typeof rec.date === "string" ? rec.date : typeof rec.schedule_date === "string" ? rec.schedule_date : "";
  if (when !== date) return null;
  return {
    date: when,
    events: normalizeEvents(rec.events),
    upcoming: normalizeUpcoming(rec.upcoming, when),
  };
}

export async function fetchDaySchedule(date: string): Promise<DaySchedule | null> {
  const planted = peekProofDay(date);
  if (planted) return planted;
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
