/**
 * True when a `/sports/mlb/game/:id` param looks like an ESPN event id rather than
 * an MLB Stats API `gamePk`. Finals/heat Mini App buttons historically embed the
 * ESPN id (`401908004`); MLB gamePks are shorter (e.g. `849826`).
 */
export function looksLikeEspnMlbEventId(id: string | null | undefined): boolean {
  return Boolean(id && /^\d{9,}$/.test(id.trim()));
}
