/**
 * Extra college boards for the finals sweep only.
 *
 * ESPN's plain college-football scoreboard (what sports-push polls) is the
 * Top 25 / featured view — about 19 games on a full Saturday, so most Power 4
 * games never reach the sweep. `groups=80` is every FBS game; we keep the ones
 * with a Power 4 team (ACC, Big 12, Big Ten, SEC) or Notre Dame. Dated like the
 * MLB/NHL boards (Chicago today + yesterday) so late Saturday finals that end
 * after midnight CT still get their live→final transition.
 *
 * sports-push keeps its own board. Adding every FBS game there would turn on
 * heat alerts for games nobody asked for.
 */
import { chicagoYmd, chicagoYmdDaysAgo, mapEspnEvent } from "../sports-push/boards.ts";
import { gameKey, type PushGame } from "../sports-push/live-drama.ts";

const ESPN = "https://site.api.espn.com/apis/site/v2/sports";

/** ESPN group ids: ACC 1, Big 12 4, Big Ten 5, SEC 8. Pac-12 (9) is not Power 4. */
export const POWER4_CONFERENCE_IDS: ReadonlySet<string> = new Set(["1", "4", "5", "8"]);
export const NOTRE_DAME_TEAM_ID = "87";
export const CFB_FBS_GROUP = "80";
/** A full FBS Saturday is ~60 games; ESPN's default page size is lower. */
export const CFB_BOARD_LIMIT = 300;

type RawEvent = NonNullable<Parameters<typeof mapEspnEvent>[1]>;
type RawPower4Team = { id?: string | number; conferenceId?: string | number };

export function isPower4Team(team: RawPower4Team | undefined | null): boolean {
  if (!team) return false;
  if (team.id != null && String(team.id) === NOTRE_DAME_TEAM_ID) return true;
  return team.conferenceId != null && POWER4_CONFERENCE_IDS.has(String(team.conferenceId));
}

export function isPower4Event(event: RawEvent): boolean {
  const competitors = (event.competitions?.[0]?.competitors ?? []) as { team?: RawPower4Team }[];
  return competitors.some((row) => isPower4Team(row.team));
}

export function power4CfbFromScoreboard(raw: { events?: RawEvent[] } | null | undefined): PushGame[] {
  const out: PushGame[] = [];
  for (const event of raw?.events ?? []) {
    if (!isPower4Event(event)) continue;
    const game = mapEspnEvent("cfb", event, null);
    if (game) out.push(game);
  }
  return out;
}

export function cfbFbsScoreboardUrl(ymd: string): string {
  return `${ESPN}/football/college-football/scoreboard?dates=${ymd}&groups=${CFB_FBS_GROUP}&limit=${CFB_BOARD_LIMIT}`;
}

/** Chicago today first, then yesterday (same window as the MLB/NHL boards). */
export function finalsBoardDays(now = new Date()): string[] {
  const today = chicagoYmd(now);
  const yesterday = chicagoYmdDaysAgo(now, 1);
  return yesterday === today ? [today] : [today, yesterday];
}

export async function fetchPower4Cfb(now = new Date(), fetchImpl: typeof fetch = fetch): Promise<PushGame[]> {
  const days = await Promise.all(
    finalsBoardDays(now).map(async (ymd) => {
      try {
        const res = await fetchImpl(cfbFbsScoreboardUrl(ymd), {
          headers: { Accept: "application/json", "User-Agent": "CommandCenterSportsFinals" },
        });
        if (!res.ok) return [];
        return power4CfbFromScoreboard((await res.json()) as { events?: RawEvent[] });
      } catch {
        return [];
      }
    }),
  );
  const seen = new Set<string>();
  const out: PushGame[] = [];
  for (const game of days.flat()) {
    const key = gameKey(game);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(game);
  }
  return out;
}

/**
 * Push boards plus Power 4 college games. A game on both keeps the push-board
 * copy (same ESPN row). `power4` is every cfb key that came back from the
 * Power 4 fetch, including games the push board already had.
 */
export function mergeFinalsBoards(
  base: PushGame[],
  power4Cfb: PushGame[],
): { games: PushGame[]; power4: Set<string> } {
  const power4 = new Set(power4Cfb.map(gameKey));
  const seen = new Set(base.map(gameKey));
  const games = [...base];
  for (const game of power4Cfb) {
    const key = gameKey(game);
    if (seen.has(key)) continue;
    seen.add(key);
    games.push(game);
  }
  return { games, power4 };
}
