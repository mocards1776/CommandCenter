/**
 * Weekly Favorite Coaches desk for the Thompson Times.
 *
 * Source of coaches is public.favorite_sports_players (position = coach) for
 * the Times desk user — never a hard-coded list. ESPN fills the tiles; a
 * missing field is omitted. Lives in the newspaper libs so the Sports App
 * fetch and UI stay untouched.
 */

import { truncateAtSentence } from "./newspaper-copy.ts";
import { fetchSectionStandings, formatFixtureWhen, formatPaperDay, type StandGroup } from "./newspaper-box.ts";
import { newspaperEspnGet } from "./newspaper-espn.ts";
import { pickBestStoryImage } from "./newspaper-images.ts";
import type { GameWrapCard } from "./newspaper-sports.ts";

/** Josh's Times desk. The press always reads this list so the page follows his adds/removes. */
export const TIMES_FAVORITE_COACHES_USER_ID = "0a04c242-4b3a-4cac-8441-3844c3d57da0";

/**
 * When the Favorite Coaches page prints, in America/Chicago.
 * Monday: every edition. Sunday: only during the CFB season window.
 */
export const FAVORITE_COACHES_PRINT = {
  monday: "always",
  sunday: "cfb-season",
} as const;

/** Inclusive Central calendar window for Sunday prints (Week 0 through the CFP). */
export const CFB_SEASON_WINDOW = {
  startMonth: 8,
  startDay: 1,
  endMonth: 1,
  endDay: 20,
} as const;

const LEAGUE_PATHS: Record<string, string> = {
  cfb: "football/college-football",
  ncaaf: "football/college-football",
  "college-football": "football/college-football",
  cbb: "basketball/mens-college-basketball",
  ncaab: "basketball/mens-college-basketball",
  "mens-college-basketball": "basketball/mens-college-basketball",
  nba: "basketball/nba",
  wnba: "basketball/wnba",
  nfl: "football/nfl",
  nhl: "hockey/nhl",
  mlb: "baseball/mlb",
};

const SPORT_PATHS: Record<string, string> = {
  football: "football/college-football",
  basketball: "basketball/mens-college-basketball",
};

/** Missouri — Josh's club. Wider tile when this team is on the desk. */
export const FEATURED_COACH_TEAM_ID = "142";

export type FavoriteCoachRow = {
  id?: string;
  user_id?: string;
  player_id?: string;
  player_name?: string;
  team_name?: string | null;
  team_id?: string | null;
  sport?: string | null;
  league?: string | null;
  position?: string | null;
  created_at?: string;
  playerId?: string;
  playerName?: string;
  teamName?: string | null;
  teamId?: string | null;
  createdAt?: string;
};

export type FavoriteCoachRef = {
  coachId: string;
  name: string;
  teamName: string | null;
  teamId: string | null;
  sport: string | null;
  league: string | null;
  leaguePath: string;
  featured: boolean;
};

export type CoachLastGame = {
  id: string;
  result: "W" | "L" | "T" | null;
  score: string | null;
  opponent: string | null;
  opponentLogo: string | null;
  homeAway: "vs" | "at" | null;
  date: string | null;
  summary: string | null;
};

export type CoachNextGame = {
  id: string;
  opponent: string | null;
  opponentLogo: string | null;
  opponentRank: number | null;
  homeAway: "vs" | "at" | null;
  kickoff: string | null;
  tv: string | null;
  line: string | null;
};

export type FavoriteCoachTile = {
  coachId: string;
  name: string;
  leaguePath: string;
  league: string | null;
  teamId: string | null;
  teamName: string | null;
  teamAbbrev: string | null;
  teamLogo: string | null;
  teamColor: string | null;
  headshot: string | null;
  featured: boolean;
  record: string | null;
  conferenceRecord: string | null;
  standing: string | null;
  rank: number | null;
  pointsForAvg: string | null;
  pointsAgainstAvg: string | null;
  lastGame: CoachLastGame | null;
  nextGame: CoachNextGame | null;
  headlines: GameWrapCard[];
  schoolRecord: string | null;
  yearsAtSchool: string | null;
  careerRecord: string | null;
  bowlRecord: string | null;
  playoffRecord: string | null;
  vsRanked: string | null;
  titles: string | null;
  nflRecord: string | null;
  salary: string | null;
  contractEnd: string | null;
  buyout: string | null;
  sourceLabel: string | null;
  sourceUrl: string | null;
  statusNote: string | null;
};

export type TimesCoachProfile = {
  coach_id: string;
  coach_name?: string | null;
  school?: string | null;
  team_id?: string | null;
  hire_year?: number | null;
  school_wins?: number | null;
  school_losses?: number | null;
  career_wins?: number | null;
  career_losses?: number | null;
  bowl_wins?: number | null;
  bowl_losses?: number | null;
  playoff_wins?: number | null;
  playoff_losses?: number | null;
  titles_note?: string | null;
  nfl_record?: string | null;
  salary_annual?: number | string | null;
  salary_note?: string | null;
  contract_end_year?: number | null;
  buyout?: number | string | null;
  source_url?: string | null;
  source_label?: string | null;
  record_source_url?: string | null;
  record_source_label?: string | null;
  as_of?: string | null;
};

export type FavoriteCoachDesk = {
  tiles: FavoriteCoachTile[];
};

export function isFavoriteCoachPosition(position: string | null | undefined): boolean {
  return (position ?? "").trim().toLowerCase() === "coach";
}

export function coachLeaguePath(
  league: string | null | undefined,
  sport: string | null | undefined,
): string | null {
  const l = (league ?? "").trim().toLowerCase();
  if (LEAGUE_PATHS[l]) return LEAGUE_PATHS[l];
  const s = (sport ?? "").trim().toLowerCase();
  return SPORT_PATHS[s] ?? null;
}

export function isFeaturedCoachTeam(
  teamId: string | null | undefined,
  teamName: string | null | undefined,
): boolean {
  if (String(teamId ?? "") === FEATURED_COACH_TEAM_ID) return true;
  const name = (teamName ?? "").trim().toLowerCase();
  if (!name) return false;
  if (/missouri state/.test(name)) return false;
  return /\bmissouri\b/.test(name) || name === "mizzou";
}

export function editionDayOf(pressId: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(pressId);
  return m ? m[1]! : null;
}

/** Weekday of a Central calendar date (0 Sunday … 6 Saturday). The press id already is Chicago. */
export function favoriteCoachesWeekday(day: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const dt = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.getUTCDay();
}

export function isCfbSeasonDay(day: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return false;
  const month = Number(m[2]);
  const date = Number(m[3]);
  const { startMonth, startDay, endMonth, endDay } = CFB_SEASON_WINDOW;
  if (month > startMonth || (month === startMonth && date >= startDay)) return true;
  if (month < endMonth || (month === endMonth && date <= endDay)) return true;
  return false;
}

export function printsFavoriteCoaches(pressId: string): boolean {
  const day = editionDayOf(pressId);
  if (!day) return false;
  const weekday = favoriteCoachesWeekday(day);
  if (weekday == null) return false;
  if (weekday === 1 && FAVORITE_COACHES_PRINT.monday === "always") return true;
  if (weekday === 0 && FAVORITE_COACHES_PRINT.sunday === "cfb-season") return isCfbSeasonDay(day);
  return false;
}

export function mapFavoriteCoachRow(row: FavoriteCoachRow): FavoriteCoachRef | null {
  if (!isFavoriteCoachPosition(row.position)) return null;
  const coachId = String(row.player_id ?? row.playerId ?? "").trim();
  const name = String(row.player_name ?? row.playerName ?? "").replace(/\s+/g, " ").trim();
  if (!coachId || !name) return null;
  const league = row.league ?? null;
  const sport = row.sport ?? null;
  const leaguePath = coachLeaguePath(league, sport);
  if (!leaguePath) return null;
  const teamId = row.team_id != null || row.teamId != null ? String(row.team_id ?? row.teamId) : null;
  const teamName = (row.team_name ?? row.teamName ?? null) as string | null;
  return {
    coachId,
    name,
    teamName: teamName && teamName.trim() ? teamName.trim() : null,
    teamId: teamId && teamId.trim() ? teamId.trim() : null,
    sport,
    league,
    leaguePath,
    featured: isFeaturedCoachTeam(teamId, teamName),
  };
}

export function mapFavoriteCoachRows(rows: FavoriteCoachRow[]): FavoriteCoachRef[] {
  const out: FavoriteCoachRef[] = [];
  const seen = new Set<string>();
  for (const raw of rows ?? []) {
    const mapped = mapFavoriteCoachRow(raw as FavoriteCoachRow);
    if (!mapped) continue;
    const key = `${mapped.leaguePath}:${mapped.coachId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(mapped);
  }
  return out.sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name));
}

export function coachPathsOf(refs: { leaguePath: string }[]): string[] {
  return [...new Set(refs.map((r) => r.leaguePath).filter(Boolean))].sort();
}

/** CFB season year for a Central calendar date (Aug–July). */
export function cfbSeasonYear(day: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  return month >= 8 ? year : year - 1;
}

export function parseWl(summary: string | null | undefined): { wins: number; losses: number } | null {
  const m = /^(\d+)\s*[-–]\s*(\d+)/.exec((summary ?? "").trim());
  if (!m) return null;
  return { wins: Number(m[1]), losses: Number(m[2]) };
}

export function formatWl(wins: number, losses: number): string {
  return `${wins}–${losses}`;
}

export function yearsAtSchoolLabel(hireYear: number | null | undefined, seasonYear: number | null): string | null {
  if (hireYear == null || seasonYear == null || hireYear > seasonYear) return null;
  const n = seasonYear - hireYear + 1;
  if (n === 1) return "1st season";
  if (n === 2) return "2nd season";
  if (n === 3) return "3rd season";
  return `${n}th season`;
}

export function formatCoachMoney(value: number | string | null | undefined): string | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    const raw = (m % 1 === 0 ? String(m) : m.toFixed(2)).replace(/\.?0+$/, "");
    return `$${raw}M`;
  }
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function coachStatusNote(headlines: { headline?: string }[], name: string): string | null {
  const coach = name.toLowerCase();
  const hit = headlines.find((h) => {
    const t = (h.headline ?? "").replace(/\s+/g, " ").trim();
    if (!t) return false;
    const low = t.toLowerCase();
    if (coach && !low.includes(coach.split(" ").pop() ?? coach)) return false;
    return /\b(hot seat|buyout|extension|fired|safe|must[- ]win|on the clock)\b/i.test(t);
  });
  const text = (hit?.headline ?? "").replace(/\s+/g, " ").trim();
  return text || null;
}

export function coachFactLines(tile: FavoriteCoachTile): string[] {
  return [
    tile.schoolRecord
      ? ["At school", tile.schoolRecord, tile.yearsAtSchool].filter(Boolean).join(" · ")
      : null,
    tile.careerRecord ? `Career ${tile.careerRecord}` : null,
    tile.nflRecord,
    tile.bowlRecord ? `Bowls ${tile.bowlRecord}` : null,
    tile.playoffRecord ? `CFP ${tile.playoffRecord}` : null,
    tile.vsRanked ? `vs ranked ${tile.vsRanked}` : null,
    tile.titles,
    tile.salary ? [tile.salary, tile.contractEnd].filter(Boolean).join(" · ") : tile.contractEnd,
    tile.buyout ? `Buyout ${tile.buyout}` : null,
  ].filter((bit): bit is string => Boolean(bit));
}

export function applyCoachProfile(
  tile: FavoriteCoachTile,
  profile: TimesCoachProfile | null | undefined,
  seasonYear: number | null,
  vsRanked: string | null,
): FavoriteCoachTile {
  const season = parseWl(tile.record);
  const schoolBase =
    profile?.school_wins != null && profile.school_losses != null
      ? { wins: Number(profile.school_wins), losses: Number(profile.school_losses) }
      : null;
  const careerBase =
    profile?.career_wins != null && profile.career_losses != null
      ? { wins: Number(profile.career_wins), losses: Number(profile.career_losses) }
      : null;
  const school = schoolBase && season ? { wins: schoolBase.wins + season.wins, losses: schoolBase.losses + season.losses } : schoolBase;
  const career = careerBase && season ? { wins: careerBase.wins + season.wins, losses: careerBase.losses + season.losses } : careerBase;
  const bowl =
    profile?.bowl_wins != null && profile.bowl_losses != null
      ? formatWl(Number(profile.bowl_wins), Number(profile.bowl_losses))
      : null;
  const playoff =
    profile?.playoff_wins != null && profile.playoff_losses != null
      ? formatWl(Number(profile.playoff_wins), Number(profile.playoff_losses))
      : null;
  const salary = formatCoachMoney(profile?.salary_annual ?? null);
  const buyout = formatCoachMoney(profile?.buyout ?? null);
  return {
    ...tile,
    schoolRecord: school ? formatWl(school.wins, school.losses) : null,
    yearsAtSchool: yearsAtSchoolLabel(profile?.hire_year, seasonYear),
    careerRecord: career ? formatWl(career.wins, career.losses) : null,
    bowlRecord: bowl,
    playoffRecord: playoff,
    vsRanked,
    titles: (profile?.titles_note ?? "").trim() || null,
    nflRecord: (profile?.nfl_record ?? "").trim() || null,
    salary: salary ? (profile?.salary_note ? `${salary} ${profile.salary_note}` : salary) : null,
    contractEnd: profile?.contract_end_year ? `thru ${profile.contract_end_year}` : null,
    buyout,
    sourceLabel: (profile?.source_label ?? "").trim() || null,
    sourceUrl: (profile?.source_url ?? "").trim() || null,
    statusNote: coachStatusNote(tile.headlines, tile.name),
  };
}

function blankProfileFields(): Pick<
  FavoriteCoachTile,
  | "schoolRecord"
  | "yearsAtSchool"
  | "careerRecord"
  | "bowlRecord"
  | "playoffRecord"
  | "vsRanked"
  | "titles"
  | "nflRecord"
  | "salary"
  | "contractEnd"
  | "buyout"
  | "sourceLabel"
  | "sourceUrl"
  | "statusNote"
> {
  return {
    schoolRecord: null,
    yearsAtSchool: null,
    careerRecord: null,
    bowlRecord: null,
    playoffRecord: null,
    vsRanked: null,
    titles: null,
    nflRecord: null,
    salary: null,
    contractEnd: null,
    buyout: null,
    sourceLabel: null,
    sourceUrl: null,
    statusNote: null,
  };
}

type EspnStat = { name?: string; type?: string; value?: number; displayValue?: string };
type EspnRecordItem = { type?: string; description?: string; summary?: string; stats?: EspnStat[] };
type EspnLogo = { href?: string };
type EspnTeam = {
  id?: string;
  displayName?: string;
  shortDisplayName?: string;
  abbreviation?: string;
  color?: string;
  rank?: number;
  standingSummary?: string;
  logos?: EspnLogo[];
  record?: { items?: EspnRecordItem[] };
  nextEvent?: unknown[];
};
type EspnCompetitor = {
  homeAway?: string;
  score?: { value?: number; displayValue?: string } | string | number;
  winner?: boolean;
  curatedRank?: { current?: number };
  team?: {
    id?: string;
    abbreviation?: string;
    displayName?: string;
    shortDisplayName?: string;
    logos?: EspnLogo[];
  };
};
type EspnBroadcast = {
  names?: string[];
  name?: string;
  media?: { shortName?: string; name?: string };
  type?: { shortName?: string };
};
type EspnEvent = {
  id?: string;
  date?: string;
  shortName?: string;
  timeValid?: boolean;
  competitions?: {
    id?: string;
    date?: string;
    broadcasts?: EspnBroadcast[];
    status?: { type?: { completed?: boolean; state?: string; description?: string } };
    competitors?: EspnCompetitor[];
    odds?: { details?: string; spread?: number }[];
  }[];
};
type EspnArticle = {
  id?: string | number;
  headline?: string;
  description?: string;
  published?: string;
  type?: string;
  images?: { url?: string }[];
  links?: { web?: { href?: string } };
  categories?: { type?: string; description?: string }[];
};

function statValue(item: EspnRecordItem | undefined, name: string): number | null {
  const hit = (item?.stats ?? []).find((s) => (s.name ?? "").toLowerCase() === name.toLowerCase());
  if (hit && typeof hit.value === "number" && Number.isFinite(hit.value)) return hit.value;
  return null;
}

function apRank(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  if (n < 1 || n > 25) return null;
  return Math.round(n);
}

function scoreOf(c: EspnCompetitor | undefined): string | null {
  if (!c) return null;
  const raw = c.score;
  if (raw == null) return null;
  if (typeof raw === "object") return raw.displayValue ?? (raw.value != null ? String(raw.value) : null);
  const s = String(raw).trim();
  return s || null;
}

function oppOf(comps: EspnCompetitor[] | undefined, teamId: string | null): {
  opp: EspnCompetitor | null;
  me: EspnCompetitor | null;
} {
  const list = comps ?? [];
  const me = list.find((c) => String(c.team?.id ?? "") === String(teamId ?? "")) ?? null;
  const opp = list.find((c) => c !== me) ?? null;
  return { opp, me };
}

function homeAwayOf(me: EspnCompetitor | null): "vs" | "at" | null {
  if (!me?.homeAway) return null;
  return me.homeAway === "home" ? "vs" : "at";
}

function resultOf(me: EspnCompetitor | null): "W" | "L" | "T" | null {
  if (!me) return null;
  if (me.winner === true) return "W";
  if (me.winner === false) return "L";
  return null;
}

function broadcastLine(broadcasts: EspnBroadcast[] | undefined): string | null {
  const names: string[] = [];
  for (const b of broadcasts ?? []) {
    if (b.type?.shortName && !/tv/i.test(b.type.shortName) && b.type.shortName !== "TV") continue;
    const n = b.media?.shortName || b.media?.name || b.names?.[0] || b.name;
    if (n && !names.includes(n)) names.push(n);
  }
  return names.length ? names.join(" · ") : null;
}

function chicagoDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return formatPaperDay(d);
}

function kickoffLine(iso: string | null | undefined, timeValid = true): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  if (!timeValid) return formatPaperDay(d);
  return formatFixtureWhen(iso);
}

function emptyCard(partial: Partial<GameWrapCard> & Pick<GameWrapCard, "id" | "headline">): GameWrapCard {
  return {
    favoriteKey: "",
    teamName: "",
    teamHref: "/",
    sportLabel: "CFB",
    leaguePath: "football/college-football",
    dek: null,
    body: null,
    scoreLine: null,
    when: null,
    won: null,
    gameHref: null,
    wrapHref: null,
    feedUrl: null,
    gameId: null,
    stats: [],
    leaders: [],
    teamStats: [],
    division: [],
    ...partial,
  };
}

function headlineCard(
  article: EspnArticle,
  teamName: string,
  leaguePath: string,
): GameWrapCard | null {
  const headline = (article.headline ?? "").replace(/\s+/g, " ").trim();
  const id = String(article.id ?? "");
  if (!headline || !id) return null;
  const href = article.links?.web?.href ?? null;
  const dek = article.description ? truncateAtSentence(article.description, 220) : null;
  return emptyCard({
    id: `coach-news-${id}`,
    teamName,
    teamHref: href || "/",
    sportLabel: leaguePath.split("/").pop() ?? "Sports",
    leaguePath,
    headline,
    dek: dek || null,
    body: dek,
    when: article.published ?? null,
    gameHref: href,
    wrapHref: href,
    photo: pickBestStoryImage([article.images?.[0]?.url]),
  });
}

const JUNK_HEAD = /\b(betting|odds|spread|best bets?|power rankings?|fpi|how to watch)\b/i;

function pickHeadlines(
  articles: EspnArticle[],
  ref: FavoriteCoachRef,
): GameWrapCard[] {
  const coach = ref.name.toLowerCase();
  const team = (ref.teamName ?? "").toLowerCase();
  const nick = team.replace(/\s+(tigers|tar heels|buffaloes|trojans|bears)\s*$/i, "").trim();
  const scored = articles.map((article, i) => {
    const head = `${article.headline ?? ""} ${article.description ?? ""}`.toLowerCase();
    let score = 0;
    if (coach && head.includes(coach)) score += 50;
    if (nick && nick.length > 2 && head.includes(nick)) score += 30;
    if (team && head.includes(team)) score += 20;
    if (JUNK_HEAD.test(article.headline ?? "") || JUNK_HEAD.test(article.type ?? "")) score -= 25;
    return { article, score, i };
  });
  const picked = new Set<string>();
  const cards: GameWrapCard[] = [];
  const take = (article: EspnArticle) => {
    const card = headlineCard(article, ref.teamName ?? ref.name, ref.leaguePath);
    const key = String(article.id ?? card?.id ?? "");
    if (!card || !key || picked.has(key)) return;
    picked.add(key);
    cards.push(card);
  };
  for (const row of scored
    .filter((row) => row.score >= 20)
    .sort((a, b) => b.score - a.score || a.i - b.i)) {
    if (cards.length >= 2) break;
    take(row.article);
  }
  /* Team news is already scoped; fill leftover slots from latest items. */
  for (const row of scored) {
    if (cards.length >= 2) break;
    if (row.score < 0) continue;
    take(row.article);
  }
  return cards;
}

function conferenceFromStandings(groups: StandGroup[], teamId: string | null): string | null {
  if (!teamId) return null;
  for (const group of groups) {
    const row = group.rows.find((r) => r.id === teamId);
    if (!row) continue;
    const confAt = group.columns.findIndex((c) => /conf/i.test(c));
    const value = confAt >= 0 ? row.cells[confAt] : null;
    if (value && value !== "—" && /\d/.test(value)) return value;
  }
  return null;
}

async function espnJson<T>(path: string): Promise<T | null> {
  try {
    return (await newspaperEspnGet(path)) as T;
  } catch {
    return null;
  }
}

async function coachHeadshot(path: string, coachId: string): Promise<string | null> {
  const athlete = await espnJson<{ athlete?: { headshot?: { href?: string } }; headshot?: { href?: string } }>(
    `${path}/athletes/${coachId}`,
  );
  const href = athlete?.athlete?.headshot?.href ?? athlete?.headshot?.href ?? null;
  if (href && /^https?:\/\//i.test(href)) return href;
  return null;
}

function vsRankedLine(events: EspnEvent[], teamId: string | null): string | null {
  let wins = 0;
  let losses = 0;
  for (const event of events) {
    const comp = event.competitions?.[0];
    if (!comp?.status?.type?.completed) continue;
    const { opp, me } = oppOf(comp.competitors, teamId);
    const rank = apRank(opp?.curatedRank?.current);
    if (rank == null) continue;
    const result = resultOf(me);
    if (result === "W") wins += 1;
    else if (result === "L") losses += 1;
  }
  if (!wins && !losses) return null;
  return formatWl(wins, losses);
}

function lastAndNext(events: EspnEvent[], teamId: string | null): { last: EspnEvent | null; next: EspnEvent | null } {
  let last: EspnEvent | null = null;
  let next: EspnEvent | null = null;
  for (const event of events) {
    const comp = event.competitions?.[0];
    const done = Boolean(comp?.status?.type?.completed);
    if (done) last = event;
    else if (!next) next = event;
  }
  if (!last && !next && teamId) {
    /* keep nulls */
  }
  return { last, next };
}

function lastGameFromEvent(event: EspnEvent, teamId: string | null, summary: string | null): CoachLastGame | null {
  const comp = event.competitions?.[0];
  const { opp, me } = oppOf(comp?.competitors, teamId);
  const myScore = scoreOf(me ?? undefined);
  const oppScore = scoreOf(opp ?? undefined);
  const score = myScore != null && oppScore != null ? `${myScore}–${oppScore}` : null;
  return {
    id: String(event.id ?? comp?.id ?? ""),
    result: resultOf(me),
    score,
    opponent: opp?.team?.shortDisplayName || opp?.team?.abbreviation || opp?.team?.displayName || null,
    opponentLogo: opp?.team?.logos?.[0]?.href ?? null,
    homeAway: homeAwayOf(me),
    date: chicagoDate(comp?.date ?? event.date),
    summary,
  };
}

function nextGameFromEvent(
  event: EspnEvent,
  teamId: string | null,
  extras: { tv?: string | null; line?: string | null },
): CoachNextGame | null {
  const comp = event.competitions?.[0];
  const { opp, me } = oppOf(comp?.competitors, teamId);
  const line = extras.line ?? comp?.odds?.[0]?.details ?? null;
  const tv = extras.tv ?? broadcastLine(comp?.broadcasts);
  return {
    id: String(event.id ?? comp?.id ?? ""),
    opponent: opp?.team?.shortDisplayName || opp?.team?.abbreviation || opp?.team?.displayName || null,
    opponentLogo: opp?.team?.logos?.[0]?.href ?? null,
    opponentRank: apRank(opp?.curatedRank?.current),
    homeAway: homeAwayOf(me),
    kickoff: kickoffLine(comp?.date ?? event.date, event.timeValid !== false),
    tv,
    line,
  };
}

async function summaryBits(
  path: string,
  eventId: string,
): Promise<{ summary: string | null; tv: string | null; line: string | null }> {
  const raw = await espnJson<{
    article?: { headline?: string; description?: string };
    pickcenter?: { details?: string }[];
    header?: { competitions?: { broadcasts?: EspnBroadcast[] }[] };
    broadcasts?: EspnBroadcast[];
  }>(`${path}/summary?event=${eventId}`);
  if (!raw) return { summary: null, tv: null, line: null };
  const text = (raw.article?.description || raw.article?.headline || "").replace(/^[\s—–-]+/, "");
  const summary = text ? truncateAtSentence(text, 280) : null;
  const tv = broadcastLine(raw.header?.competitions?.[0]?.broadcasts ?? raw.broadcasts);
  const line = raw.pickcenter?.[0]?.details ?? null;
  return { summary: summary || null, tv, line };
}

async function fetchOneTile(ref: FavoriteCoachRef, standings: StandGroup[]): Promise<FavoriteCoachTile> {
  const path = ref.leaguePath;
  const teamId = ref.teamId;
  const [teamRaw, schedRaw, newsRaw, headshot] = await Promise.all([
    teamId ? espnJson<{ team?: EspnTeam }>(`${path}/teams/${teamId}`) : Promise.resolve(null),
    teamId ? espnJson<{ events?: EspnEvent[] }>(`${path}/teams/${teamId}/schedule`) : Promise.resolve(null),
    teamId ? espnJson<{ articles?: EspnArticle[] }>(`${path}/news?team=${teamId}&limit=15`) : Promise.resolve(null),
    coachHeadshot(path, ref.coachId),
  ]);
  const team = teamRaw?.team;
  const total = (team?.record?.items ?? []).find((i) => i.type === "total");
  const vsconf = (team?.record?.items ?? []).find((i) => i.type === "vsconf" || /conf/i.test(i.description ?? ""));
  const events = schedRaw?.events ?? [];
  const { last, next } = lastAndNext(events, teamId);
  const lastBits = last?.id ? await summaryBits(path, String(last.id)) : { summary: null, tv: null, line: null };
  const nextBits = next?.id ? await summaryBits(path, String(next.id)) : { summary: null, tv: null, line: null };
  const pf = statValue(total, "avgPointsFor");
  const pa = statValue(total, "avgPointsAgainst");
  const logo = team?.logos?.[0]?.href ?? (teamId ? `https://a.espncdn.com/i/teamlogos/ncaa/500/${teamId}.png` : null);
  return {
    coachId: ref.coachId,
    name: ref.name,
    leaguePath: path,
    league: ref.league,
    teamId,
    teamName: team?.shortDisplayName || team?.displayName || ref.teamName,
    teamAbbrev: team?.abbreviation ?? null,
    teamLogo: logo,
    teamColor: team?.color ? `#${team.color.replace(/^#/, "")}` : null,
    headshot,
    featured: ref.featured,
    record: total?.summary ?? null,
    conferenceRecord: vsconf?.summary ?? conferenceFromStandings(standings, teamId),
    standing: team?.standingSummary ?? null,
    rank: apRank(team?.rank),
    pointsForAvg: pf != null ? pf.toFixed(1).replace(/\.0$/, "") : null,
    pointsAgainstAvg: pa != null ? pa.toFixed(1).replace(/\.0$/, "") : null,
    lastGame: last ? lastGameFromEvent(last, teamId, lastBits.summary) : null,
    nextGame: next ? nextGameFromEvent(next, teamId, { tv: nextBits.tv, line: nextBits.line }) : null,
    headlines: pickHeadlines(newsRaw?.articles ?? [], ref),
    ...blankProfileFields(),
    vsRanked: vsRankedLine(events, teamId),
  };
}

function denoService(): { url: string; key: string } | null {
  try {
    const env = (globalThis as { Deno?: { env?: { get?: (k: string) => string | undefined } } }).Deno?.env;
    const url = env?.get?.("SUPABASE_URL");
    const key = env?.get?.("SUPABASE_SERVICE_ROLE_KEY");
    if (url && key) return { url, key };
  } catch {
    /* browser */
  }
  return null;
}

export async function loadTimesFavoriteCoachRefs(): Promise<FavoriteCoachRef[]> {
  const userId = TIMES_FAVORITE_COACHES_USER_ID;
  try {
    const { listFavoriteCoaches } = await import("./favorite-coaches.ts");
    const rows = await listFavoriteCoaches(userId);
    const mapped = mapFavoriteCoachRows(rows);
    if (mapped.length) return mapped;
  } catch {
    /* scheduled press has no user session; node tests have no Vite env */
  }
  const svc = denoService();
  if (!svc) return [];
  const url = new URL(`${svc.url}/rest/v1/favorite_sports_players`);
  url.searchParams.set("user_id", `eq.${userId}`);
  url.searchParams.set("select", "*");
  url.searchParams.set("order", "created_at.desc");
  const res = await fetch(url, {
    headers: {
      apikey: svc.key,
      Authorization: `Bearer ${svc.key}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) return [];
  const rows = (await res.json()) as FavoriteCoachRow[];
  return mapFavoriteCoachRows(Array.isArray(rows) ? rows : []);
}

export async function loadTimesCoachProfiles(): Promise<Record<string, TimesCoachProfile>> {
  const rows = await readCoachProfileRows();
  const out: Record<string, TimesCoachProfile> = {};
  for (const row of rows) {
    const id = String(row.coach_id ?? "").trim();
    if (id) out[id] = row;
  }
  return out;
}

async function readCoachProfileRows(): Promise<TimesCoachProfile[]> {
  try {
    const { supabase } = await import("./supabase.ts");
    const { data, error } = await supabase.from("times_coach_profiles").select("*");
    if (!error && Array.isArray(data) && data.length) return data as TimesCoachProfile[];
  } catch {
    /* scheduled press / node tests */
  }
  const svc = denoService();
  if (!svc) return [];
  const url = new URL(`${svc.url}/rest/v1/times_coach_profiles`);
  url.searchParams.set("select", "*");
  const res = await fetch(url, {
    headers: {
      apikey: svc.key,
      Authorization: `Bearer ${svc.key}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) return [];
  const rows = (await res.json()) as TimesCoachProfile[];
  return Array.isArray(rows) ? rows : [];
}

export async function fetchFavoriteCoachDesk(opts?: {
  day?: string;
  refs?: FavoriteCoachRef[];
  profiles?: Record<string, TimesCoachProfile>;
}): Promise<FavoriteCoachDesk> {
  const refs = opts?.refs ?? (await loadTimesFavoriteCoachRefs());
  if (!refs.length) return { tiles: [] };
  const profiles = opts?.profiles ?? (await loadTimesCoachProfiles());
  const seasonYear = opts?.day ? cfbSeasonYear(opts.day) : null;
  const paths = coachPathsOf(refs);
  const standByPath: Record<string, StandGroup[]> = {};
  await Promise.all(
    paths.map(async (path) => {
      try {
        standByPath[path] = await fetchSectionStandings(path);
      } catch {
        standByPath[path] = [];
      }
    }),
  );
  const tiles: FavoriteCoachTile[] = [];
  const queue = [...refs];
  async function worker() {
    for (let ref = queue.shift(); ref; ref = queue.shift()) {
      try {
        tiles.push(await fetchOneTile(ref, standByPath[ref.leaguePath] ?? []));
      } catch {
        tiles.push({
          coachId: ref.coachId,
          name: ref.name,
          leaguePath: ref.leaguePath,
          league: ref.league,
          teamId: ref.teamId,
          teamName: ref.teamName,
          teamAbbrev: null,
          teamLogo: ref.teamId ? `https://a.espncdn.com/i/teamlogos/ncaa/500/${ref.teamId}.png` : null,
          teamColor: null,
          headshot: null,
          featured: ref.featured,
          record: null,
          conferenceRecord: null,
          standing: null,
          rank: null,
          pointsForAvg: null,
          pointsAgainstAvg: null,
          lastGame: null,
          nextGame: null,
          headlines: [],
          ...blankProfileFields(),
        });
      }
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  const merged = tiles.map((tile) => applyCoachProfile(tile, profiles[tile.coachId], seasonYear, tile.vsRanked));
  merged.sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name));
  return { tiles: merged };
}

export function asFavoriteCoachDesk(value: unknown): FavoriteCoachDesk | null {
  if (!value || typeof value !== "object") return null;
  const tiles = (value as { tiles?: unknown }).tiles;
  if (!Array.isArray(tiles)) return null;
  return { tiles: tiles.filter((t) => t && typeof t === "object" && typeof (t as FavoriteCoachTile).name === "string") as FavoriteCoachTile[] };
}
