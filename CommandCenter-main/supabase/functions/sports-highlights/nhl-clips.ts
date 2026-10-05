/**
 * NHL.com gamecenter landing + Brightcove progressive MP4s.
 *
 * Same path the Sports app already uses in CommandCenter-main/src/lib/nhl.ts
 * (`api-web.nhle.com` landing `highlightClip`, then the public Brightcove
 * Playback API). Only the scoring team's highlightClip is kept — not an
 * opponent goal, empty-net, own goal, or discreteClip. Edge calls NHL directly.
 */
import {
  acceptScoringHighlight,
  canonEspnAbbrev,
  canonNhlAbbrev,
  highlightCaption,
  highlightId,
  parseClockSeconds,
  type TeamFilter,
} from "./select.ts";

const NHL = "https://api-web.nhle.com";
const ESPN = "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl";
const NHL_BC_ACCOUNT = "6415718365001";
const NHL_BC_CONFIG = `https://players.brightcove.net/${NHL_BC_ACCOUNT}/default_default/config.json`;

let nhlBcPolicyKey =
  "BCpkADawqM3l37Vq8trLJ95vVwxubXYZXYglAopEZXQTHTWX3YdalyF9xmkuknxjBgiMYwt8VZ_OZ1jAjYxz_yzuNh_cjC3uOaMspVTD-hZfNUHtNnBnhVD0Gmsih8TBF8QlQFXiCQM3W_u4ydJ1qK2Rx8ZutCUg3PHb7Q";
let nhlBcKeyRefresh: Promise<string | null> | null = null;

type Rec = Record<string, unknown>;

function rec(value: unknown): Rec {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Rec) : {};
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

async function nhlJson(path: string): Promise<unknown> {
  const res = await fetch(`${NHL}/${path.replace(/^\//, "")}`, {
    headers: { Accept: "application/json", "User-Agent": "CommandCenterSportsHighlights" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`NHL ${res.status} ${path}`);
  return await res.json();
}

function refreshNhlBcPolicyKey(): Promise<string | null> {
  nhlBcKeyRefresh ??= fetch(NHL_BC_CONFIG, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((cfg) => {
      const key = str(rec(cfg).video_cloud && rec(rec(cfg).video_cloud).policy_key);
      if (key) nhlBcPolicyKey = key;
      return key || null;
    })
    .catch(() => null);
  return nhlBcKeyRefresh;
}

export type BrightcoveMp4 = {
  name: string | null;
  mp4: string;
  poster: string | null;
  durationSec: number | null;
  width: number | null;
  height: number | null;
};

export async function loadBrightcoveMp4(videoId: string): Promise<BrightcoveMp4 | null> {
  const url = `https://edge.api.brightcove.com/playback/v1/accounts/${NHL_BC_ACCOUNT}/videos/${videoId}`;
  const call = (key: string) =>
    fetch(url, {
      headers: { Accept: `application/json;pk=${key}` },
      signal: AbortSignal.timeout(15_000),
    });
  const usedKey = nhlBcPolicyKey;
  let res = await call(usedKey);
  if (res.status === 401 || res.status === 403) {
    const fresh = await refreshNhlBcPolicyKey();
    if (fresh && fresh !== usedKey) res = await call(fresh);
  }
  if (!res.ok) return null;
  const v = rec(await res.json());
  const sources = arr(v.sources)
    .map(rec)
    .filter((s) => str(s.container) === "MP4" && str(s.src).startsWith("https://"))
    .sort(
      (a, b) =>
        (num(b.width) ?? 0) - (num(a.width) ?? 0) || (num(b.avg_bitrate) ?? 0) - (num(a.avg_bitrate) ?? 0),
    );
  const best = sources[0];
  const mp4 = best ? str(best.src) : "";
  if (!mp4) return null;
  return {
    name: str(v.name) || null,
    mp4,
    poster: str(v.poster) || str(v.thumbnail) || null,
    durationSec: num(v.duration) != null ? Math.round(num(v.duration)! / 1000) : null,
    width: best ? num(best.width) : null,
    height: best ? num(best.height) : null,
  };
}

export type ClubGame = {
  nhlGameId: string;
  gameDate: string;
  startIso: string | null;
  state: string;
  live: boolean;
  finished: boolean;
  awayAbbrev: string;
  homeAbbrev: string;
  awayName: string;
  homeName: string;
  awayId: string;
  homeId: string;
};

const LIVE_STATES = new Set(["LIVE", "CRIT"]);
const DONE_STATES = new Set(["OFF", "FINAL"]);

export function isWatchableState(state: string): boolean {
  const up = state.toUpperCase();
  return LIVE_STATES.has(up) || DONE_STATES.has(up);
}

export function mapClubGame(raw: unknown): ClubGame | null {
  const g = rec(raw);
  const id = str(g.id);
  if (!id) return null;
  const away = rec(g.awayTeam);
  const home = rec(g.homeTeam);
  const state = str(g.gameState).toUpperCase();
  return {
    nhlGameId: id,
    gameDate: str(g.gameDate),
    startIso: str(g.startTimeUTC) || null,
    state,
    live: LIVE_STATES.has(state),
    finished: DONE_STATES.has(state),
    awayAbbrev: canonNhlAbbrev(str(away.abbrev)),
    homeAbbrev: canonNhlAbbrev(str(home.abbrev)),
    awayName: str(rec(away.commonName).default) || str(away.abbrev),
    homeName: str(rec(home.commonName).default) || str(home.abbrev),
    awayId: str(away.id),
    homeId: str(home.id),
  };
}

export function gameInLookback(game: ClubGame, now: Date, hours: number): boolean {
  if (game.live) return true;
  const start = Date.parse(game.startIso ?? "");
  if (!Number.isFinite(start)) {
    const day = Date.parse(`${game.gameDate}T00:00:00Z`);
    if (!Number.isFinite(day)) return false;
    return now.getTime() - day <= hours * 3600_000;
  }
  return now.getTime() - start <= hours * 3600_000 && start <= now.getTime() + 6 * 3600_000;
}

export async function fetchClubGames(nhlAbbrev: string): Promise<ClubGame[]> {
  const raw = rec(await nhlJson(`v1/club-schedule-season/${encodeURIComponent(nhlAbbrev)}/now`));
  return arr(raw.games).map(mapClubGame).filter((g): g is ClubGame => g != null);
}

export async function fetchRecentClubGames(
  filter: TeamFilter,
  hours: number,
  now = new Date(),
): Promise<ClubGame[]> {
  const seen = new Set<string>();
  const out: ClubGame[] = [];
  for (const abbrev of filter.nhlAbbrevs) {
    const games = await fetchClubGames(abbrev);
    for (const game of games) {
      if (!isWatchableState(game.state) || !gameInLookback(game, now, hours)) continue;
      if (seen.has(game.nhlGameId)) continue;
      seen.add(game.nhlGameId);
      out.push(game);
    }
  }
  return out.sort((a, b) => Date.parse(a.startIso ?? "") - Date.parse(b.startIso ?? ""));
}

export type GoalClip = {
  highlightId: string;
  clipId: string;
  nhlGameId: string;
  espnEventId: string | null;
  teamAbbrev: string;
  opponentAbbrev: string;
  scorer: string;
  caption: string;
  mp4: string;
  poster: string | null;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  periodNumber: number;
  timeInPeriod: string;
  sharingUrl: string | null;
};

function sideName(game: ClubGame, abbrev: string): string {
  if (canonNhlAbbrev(abbrev) === game.awayAbbrev) return game.awayName;
  if (canonNhlAbbrev(abbrev) === game.homeAbbrev) return game.homeName;
  return abbrev;
}

function opponentAbbrev(game: ClubGame, teamAbbrev: string): string {
  return canonNhlAbbrev(teamAbbrev) === game.awayAbbrev ? game.homeAbbrev : game.awayAbbrev;
}

export function sortClips(clips: GoalClip[]): GoalClip[] {
  return [...clips].sort((a, b) => {
    if (a.nhlGameId !== b.nhlGameId) return a.nhlGameId.localeCompare(b.nhlGameId);
    if (a.periodNumber !== b.periodNumber) return a.periodNumber - b.periodNumber;
    return parseClockSeconds(a.timeInPeriod) - parseClockSeconds(b.timeInPeriod);
  });
}

export async function resolveEspnEventId(game: ClubGame): Promise<string | null> {
  const dates = new Set<string>();
  if (/^\d{4}-\d{2}-\d{2}$/.test(game.gameDate)) dates.add(game.gameDate.replace(/-/g, ""));
  const start = Date.parse(game.startIso ?? "");
  if (Number.isFinite(start)) {
    for (const tz of ["America/Chicago", "America/New_York"] as const) {
      dates.add(new Date(start).toLocaleDateString("en-CA", { timeZone: tz }).replace(/-/g, ""));
    }
  }
  const away = canonEspnAbbrev(game.awayAbbrev);
  const home = canonEspnAbbrev(game.homeAbbrev);
  for (const ymd of dates) {
    try {
      const res = await fetch(`${ESPN}/scoreboard?dates=${ymd}`, {
        headers: { Accept: "application/json", "User-Agent": "CommandCenterSportsHighlights" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) continue;
      const raw = rec(await res.json());
      for (const event of arr(raw.events)) {
        const ev = rec(event);
        const comp = rec(arr(ev.competitions)[0]);
        const sides = arr(comp.competitors).map(rec);
        const a = sides.find((s) => str(s.homeAway) === "away");
        const h = sides.find((s) => str(s.homeAway) === "home");
        if (canonEspnAbbrev(str(rec(a?.team).abbreviation)) !== away) continue;
        if (canonEspnAbbrev(str(rec(h?.team).abbreviation)) !== home) continue;
        const id = str(ev.id) || str(comp.id);
        if (id) return id;
      }
    } catch {
      /* try the next date */
    }
  }
  return null;
}

type PlayGoal = {
  eventId: string;
  highlightClip: string;
  eventOwnerTeamId: string;
  scorerTeamId: string;
};

/** Play-by-play is where eventOwnerTeamId lives. Landing teamAbbrev is the fallback. */
async function loadPlayGoals(nhlGameId: string): Promise<PlayGoal[]> {
  try {
    const raw = rec(await nhlJson(`v1/gamecenter/${nhlGameId}/play-by-play`));
    const roster = new Map<string, string>();
    for (const spot of arr(raw.rosterSpots)) {
      const row = rec(spot);
      const playerId = str(row.playerId);
      const teamId = str(row.teamId);
      if (playerId && teamId) roster.set(playerId, teamId);
    }
    const goals: PlayGoal[] = [];
    for (const play of arr(raw.plays)) {
      const row = rec(play);
      if (str(row.typeDescKey) !== "goal") continue;
      const details = rec(row.details);
      goals.push({
        eventId: str(row.eventId),
        highlightClip: str(details.highlightClip),
        eventOwnerTeamId: str(details.eventOwnerTeamId),
        scorerTeamId: roster.get(str(details.scoringPlayerId)) ?? "",
      });
    }
    return goals;
  } catch {
    return [];
  }
}

function matchPlayGoal(goals: PlayGoal[], eventId: string, highlightClip: string): PlayGoal | null {
  return (
    goals.find((goal) => highlightClip && goal.highlightClip === highlightClip) ??
    goals.find((goal) => eventId && goal.eventId === eventId) ??
    null
  );
}

export async function fetchGoalClipsForGame(
  game: ClubGame,
  filter: TeamFilter,
  espnEventId: string | null,
): Promise<GoalClip[]> {
  const [landing, playGoals] = await Promise.all([
    nhlJson(`v1/gamecenter/${game.nhlGameId}/landing`).then(rec),
    loadPlayGoals(game.nhlGameId),
  ]);
  const pending: Promise<GoalClip | null>[] = [];
  for (const period of arr(rec(landing.summary).scoring)) {
    const p = rec(period);
    const desc = rec(p.periodDescriptor);
    const periodNumber = num(desc.number) ?? 0;
    for (const goal of arr(p.goals)) {
      const g = rec(goal);
      const listedAbbrev = str(rec(g.teamAbbrev).default) || str(g.teamAbbrev);
      const clipHint = str(g.highlightClip);
      const play = matchPlayGoal(playGoals, str(g.eventId), clipHint);
      const decision = acceptScoringHighlight(filter, game, {
        teamAbbrev: listedAbbrev,
        eventOwnerTeamId: play?.eventOwnerTeamId,
        scorerTeamId: play?.scorerTeamId,
        goalModifier: str(g.goalModifier),
        situationCode: str(g.situationCode),
        isHome: typeof g.isHome === "boolean" ? g.isHome : null,
        highlightClip: g.highlightClip,
      });
      if (!decision.ok) continue;
      const { clipId, teamAbbrev } = decision;
      pending.push(
        loadBrightcoveMp4(clipId).then((bc): GoalClip | null => {
          if (!bc?.mp4) return null;
          const scorer =
            [str(rec(g.firstName).default), str(rec(g.lastName).default)].filter(Boolean).join(" ") ||
            str(rec(g.name).default) ||
            "Player";
          return {
            highlightId: highlightId(clipId),
            clipId,
            nhlGameId: game.nhlGameId,
            espnEventId,
            teamAbbrev,
            opponentAbbrev: opponentAbbrev(game, teamAbbrev),
            scorer,
            caption: highlightCaption({
              teamAbbrev,
              teamName: sideName(game, teamAbbrev),
              scorer,
              opponentAbbrev: opponentAbbrev(game, teamAbbrev),
            }),
            mp4: bc.mp4,
            poster: bc.poster,
            durationSec: bc.durationSec,
            width: bc.width,
            height: bc.height,
            periodNumber,
            timeInPeriod: str(g.timeInPeriod),
            sharingUrl: str(g.highlightClipSharingUrl) || null,
          };
        }),
      );
    }
  }
  const resolved = await Promise.all(pending);
  return sortClips(resolved.filter((c): c is GoalClip => c != null));
}

export async function collectGoalClips(filter: TeamFilter, hours: number, now = new Date()): Promise<GoalClip[]> {
  const games = await fetchRecentClubGames(filter, hours, now);
  const clips: GoalClip[] = [];
  for (const game of games) {
    const espnEventId = await resolveEspnEventId(game);
    const found = await fetchGoalClipsForGame(game, filter, espnEventId);
    clips.push(...found);
  }
  return sortClips(clips);
}

export async function loadClubGame(nhlGameId: string): Promise<ClubGame | null> {
  const landing = rec(await nhlJson(`v1/gamecenter/${nhlGameId}/landing`));
  if (!str(landing.id)) return null;
  return mapClubGame({
    id: landing.id,
    gameDate: landing.gameDate,
    startTimeUTC: landing.startTimeUTC,
    gameState: landing.gameState,
    awayTeam: landing.awayTeam,
    homeTeam: landing.homeTeam,
  });
}
