/**
 * Heat-line hook for sports push.
 *
 * The scorer lives next to the sender (`supabase/functions/sports-push/live-drama.ts`)
 * so the poll and any RUWT refinement cannot drift. RUWT can replace `liveDrama`.
 * It is live drama only: no series weight, no Cardinals bump, no interest sliders.
 * A game is hot at 68 — a one-score game in another sport.
 */
export {
  MLB_ONE_RUN_LINE_GAP,
  ONE_SCORE_HEAT_LINE,
  crossingAlerts,
  dramaWhy,
  liveDrama,
} from "../../../supabase/functions/sports-push/live-drama.ts";
export type {
  AlertKind,
  LiveDrama,
  LiveDramaInput,
  PhaseSnapshot,
} from "../../../supabase/functions/sports-push/live-drama.ts";
