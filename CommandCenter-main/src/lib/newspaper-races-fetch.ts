import { supabase } from "./supabase";
import { asRaceBriefsDesk, type RaceBriefsDesk } from "./newspaper-races";

const COLUMNS = "brief_date, race, headline, bullets, spend, links, notes, source, updated_at";

/**
 * Race briefs for one edition date, or the newest filing inside the last two
 * days. Missing table, failed read, or an empty window: null, and the page
 * stays out of Section A.
 */
function peekProofRaces(editionDate: string): RaceBriefsDesk | null {
  const raw = (globalThis as { __TT_PROOF_RACES__?: unknown }).__TT_PROOF_RACES__;
  return raw == null ? null : asRaceBriefsDesk(raw, editionDate);
}

export async function fetchRaceBriefs(editionDate: string): Promise<RaceBriefsDesk | null> {
  const planted = peekProofRaces(editionDate);
  if (planted) return planted;
  try {
    const { data, error } = await supabase
      .from("times_race_briefs")
      .select(COLUMNS)
      .lte("brief_date", editionDate)
      .gte("brief_date", fallbackFloor(editionDate))
      .order("brief_date", { ascending: false })
      .order("race", { ascending: true });
    if (error || !data?.length) return null;
    return asRaceBriefsDesk(data, editionDate);
  } catch {
    return null;
  }
}

function fallbackFloor(editionDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(editionDate);
  if (!match) return editionDate;
  const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) - 2);
  return new Date(utc).toISOString().slice(0, 10);
}
