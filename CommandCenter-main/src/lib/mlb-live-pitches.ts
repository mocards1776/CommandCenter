import { mapLivePlay, type MlbLivePlay, type RawLivePlay } from "@/lib/mlb-statcast";

const MLB_LIVE = "https://statsapi.mlb.com/api/v1.1";

/**
 * StatsAPI `fields` filter: only the current play's matchup + pitch events
 * (Statcast pitch / batted-ball data). Same feed/live endpoint the boxscore
 * uses, but a few KB instead of ~300 KB, so it can poll faster.
 */
export const MLB_LIVE_PITCH_FIELDS = [
  "gamePk",
  "liveData",
  "plays",
  "currentPlay",
  "about",
  "atBatIndex",
  "isComplete",
  "matchup",
  "batter",
  "pitcher",
  "id",
  "batSide",
  "pitchHand",
  "code",
  "playEvents",
  "isPitch",
  "pitchNumber",
  "details",
  "call",
  "description",
  "type",
  "isBall",
  "isStrike",
  "isInPlay",
  "pitchData",
  "startSpeed",
  "endSpeed",
  "strikeZoneTop",
  "strikeZoneBottom",
  "extension",
  "zone",
  "coordinates",
  "pX",
  "pZ",
  "x0",
  "y0",
  "z0",
  "vX0",
  "vY0",
  "vZ0",
  "aX",
  "aY",
  "aZ",
  "breaks",
  "spinRate",
  "spinDirection",
  "breakHorizontal",
  "breakVertical",
  "breakVerticalInduced",
  "hitData",
  "launchSpeed",
  "launchAngle",
  "totalDistance",
  "trajectory",
  "hardness",
  "location",
  "xba",
  "estimatedBAUsingSpeedAngle",
  "hitProbability",
].join(",");

/** Current plate appearance with per-pitch Statcast detail. */
export async function fetchMlbLivePlay(gamePk: number | string): Promise<MlbLivePlay | null> {
  const pk = encodeURIComponent(String(gamePk));
  const url = `${MLB_LIVE}/game/${pk}/feed/live?fields=${MLB_LIVE_PITCH_FIELDS}`;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 12_000);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`MLB ${res.status}`);
    const raw = (await res.json()) as { liveData?: { plays?: { currentPlay?: RawLivePlay } } };
    return mapLivePlay(raw.liveData?.plays?.currentPlay);
  } finally {
    clearTimeout(t);
  }
}
