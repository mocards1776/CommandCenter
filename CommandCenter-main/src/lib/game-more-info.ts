/**
 * "More info" for sports game-detail pages: everything ESPN publishes around a
 * game beyond the box score — odds and the result against the spread, series
 * history, each team's last five, season stat comparison, leaders, injuries,
 * standings, venue, attendance, weather and officials.
 *
 * Sports UI only. These fetches are separate from the newspaper's ESPN reads.
 * Every section is optional; parsers return null / [] when ESPN has nothing.
 */

export type MoreInfoSport = "cfb" | "nfl" | "nhl" | "mlb" | "nba" | "wnba";

const SITE = "https://site.api.espn.com/apis/site/v2/sports";

const LEAGUE_PATH: Record<MoreInfoSport, string> = {
  cfb: "football/college-football",
  nfl: "football/nfl",
  nhl: "hockey/nhl",
  mlb: "baseball/mlb",
  nba: "basketball/nba",
  wnba: "basketball/wnba",
};

export type MoreInfoTeam = {
  id: string;
  abbrev: string;
  name: string;
  logo: string | null;
  color: string | null;
  alternateColor: string | null;
  homeAway: "home" | "away";
  score: number | null;
  rank: number | null;
  records: { type: string; summary: string }[];
};

export type MoreInfoOdds = {
  provider: string | null;
  details: string | null;
  /** Spread from the home team's side (−4.5 = home favored by 4.5). */
  homeLine: number | null;
  homeLineOpen: number | null;
  overUnder: number | null;
  totalOpen: number | null;
  awayMoneyline: string | null;
  homeMoneyline: string | null;
  lineLabel: string;
  /** Final games only. */
  ats: { text: string; coverId: string | null } | null;
  total: { text: string; result: "over" | "under" | "push" } | null;
};

export type MoreInfoMeeting = {
  id: string;
  date: string;
  season: number | null;
  awayId: string;
  homeId: string;
  awayAbbrev: string;
  homeAbbrev: string;
  awayScore: number | null;
  homeScore: number | null;
  winnerId: string | null;
  neutral: boolean;
  venue: string | null;
  note: string | null;
};

export type MoreInfoSeries = {
  title: string;
  summary: string | null;
  awayWins: number;
  homeWins: number;
  ties: number;
  sinceSeason: number | null;
  meetings: MoreInfoMeeting[];
};

export type MoreInfoFormGame = {
  id: string;
  date: string;
  atVs: "vs" | "@";
  opponentAbbrev: string;
  opponentLogo: string | null;
  result: string | null;
  score: string | null;
};

export type MoreInfoForm = { teamId: string; abbrev: string; games: MoreInfoFormGame[] };

export type MoreInfoLeader = {
  id: string;
  name: string;
  shortName: string;
  headshot: string | null;
  position: string | null;
  value: string;
};

export type MoreInfoLeaderPair = {
  key: string;
  label: string;
  away: MoreInfoLeader | null;
  home: MoreInfoLeader | null;
};

export type MoreInfoInjury = {
  id: string;
  name: string;
  position: string | null;
  status: string;
  detail: string | null;
};

export type MoreInfoInjuries = { teamId: string; abbrev: string; players: MoreInfoInjury[] };

export type MoreInfoStandingsRow = {
  teamId: string;
  name: string;
  logo: string | null;
  values: string[];
  highlight: boolean;
};

export type MoreInfoStandings = {
  title: string;
  columns: string[];
  rows: MoreInfoStandingsRow[];
};

export type MoreInfoGameInfo = {
  venue: string | null;
  place: string | null;
  image: string | null;
  surface: string | null;
  attendance: number | null;
  weather: string | null;
  officials: { name: string; role: string | null }[];
  neutral: boolean;
};

export type MoreInfoAts = { teamId: string; abbrev: string; records: { label: string; summary: string }[] };

export type MoreInfoStatRow = {
  label: string;
  away: string;
  home: string;
  awayNum: number | null;
  homeNum: number | null;
  lowerIsBetter: boolean;
};

export type GameMoreInfo = {
  sport: MoreInfoSport;
  eventId: string;
  state: "pre" | "in" | "post";
  date: string | null;
  season: number | null;
  away: MoreInfoTeam;
  home: MoreInfoTeam;
  odds: MoreInfoOdds | null;
  predictor: { awayPct: number; homePct: number } | null;
  ats: MoreInfoAts[];
  /** ESPN season series (NHL / MLB / NBA). Football builds its own from schedules. */
  series: MoreInfoSeries | null;
  form: MoreInfoForm[];
  leaders: { title: string; pairs: MoreInfoLeaderPair[] };
  injuries: MoreInfoInjuries[];
  standings: MoreInfoStandings[];
  gameInfo: MoreInfoGameInfo | null;
};

/* ───────────────────────── raw ESPN shapes ───────────────────────── */

type RawLogo = { href?: string; rel?: string[] };
type RawTeam = {
  id?: string;
  abbreviation?: string;
  displayName?: string;
  shortDisplayName?: string;
  logo?: string;
  logos?: RawLogo[];
  color?: string;
  alternateColor?: string;
};
type RawScore = string | number | { value?: number; displayValue?: string } | null | undefined;
type RawCompetitor = {
  id?: string;
  homeAway?: string;
  winner?: boolean;
  score?: RawScore;
  team?: RawTeam;
  rank?: number;
  curatedRank?: { current?: number };
  record?: { type?: string; summary?: string; displayValue?: string }[];
};
type RawAthlete = {
  id?: string;
  displayName?: string;
  shortName?: string;
  fullName?: string;
  headshot?: { href?: string } | string;
  position?: { abbreviation?: string };
};
type RawOddsSide = { close?: { line?: string; odds?: string }; open?: { line?: string; odds?: string } };
export type RawSummary = {
  header?: {
    season?: { year?: number };
    competitions?: {
      date?: string;
      neutralSite?: boolean;
      status?: { type?: { state?: string; completed?: boolean } };
      competitors?: RawCompetitor[];
    }[];
  };
  pickcenter?: RawPick[];
  odds?: RawPick[];
  predictor?: { homeTeam?: { gameProjection?: string }; awayTeam?: { gameProjection?: string } };
  againstTheSpread?: {
    team?: RawTeam;
    records?: { type?: string; name?: string; displayName?: string; summary?: string; displayValue?: string }[];
  }[];
  seasonseries?: {
    type?: string;
    title?: string;
    summary?: string;
    seriesLabel?: string;
    events?: {
      id?: string;
      date?: string;
      neutralSite?: boolean;
      statusType?: { completed?: boolean; shortDetail?: string };
      competitors?: RawCompetitor[];
    }[];
  }[];
  lastFiveGames?: {
    team?: RawTeam;
    events?: {
      id?: string;
      gameDate?: string;
      atVs?: string;
      score?: string;
      gameResult?: string;
      opponent?: RawTeam;
      opponentLogo?: string;
    }[];
  }[];
  leaders?: {
    team?: RawTeam;
    leaders?: {
      name?: string;
      displayName?: string;
      leaders?: { displayValue?: string; athlete?: RawAthlete }[];
    }[];
  }[];
  injuries?: {
    team?: RawTeam;
    injuries?: {
      status?: string;
      athlete?: RawAthlete;
      type?: { abbreviation?: string; description?: string };
      details?: { type?: string; detail?: string; side?: string; location?: string; returnDate?: string };
    }[];
  }[];
  standings?: {
    groups?: {
      header?: string;
      standings?: {
        entries?: {
          team?: string;
          id?: string;
          logo?: RawLogo[];
          stats?: { name?: string; abbreviation?: string; shortDisplayName?: string; displayValue?: string; summary?: string }[];
        }[];
      };
    }[];
  };
  gameInfo?: {
    venue?: {
      fullName?: string;
      address?: { city?: string; state?: string; country?: string };
      grass?: boolean;
      images?: RawLogo[];
    };
    attendance?: number;
    weather?: {
      temperature?: number;
      displayValue?: string;
      conditionId?: string;
      gust?: number;
      precipitation?: number;
    };
    officials?: { displayName?: string; fullName?: string; position?: { displayName?: string }; order?: number }[];
  };
};
type RawPick = {
  provider?: { name?: string };
  details?: string;
  overUnder?: number;
  spread?: number;
  awayTeamOdds?: { moneyLine?: number; favorite?: boolean };
  homeTeamOdds?: { moneyLine?: number; favorite?: boolean };
  moneyline?: { away?: RawOddsSide; home?: RawOddsSide };
  pointSpread?: { away?: RawOddsSide; home?: RawOddsSide };
  total?: { over?: RawOddsSide; under?: RawOddsSide };
};

/* ───────────────────────── helpers ───────────────────────── */

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, "").replace(/^o|^u/i, ""));
  return Number.isFinite(n) ? n : null;
}

export function scoreValue(score: RawScore): number | null {
  if (score == null) return null;
  if (typeof score === "object") return num(score.value ?? score.displayValue);
  return num(score);
}

function teamLogo(team: RawTeam | undefined): string | null {
  if (!team) return null;
  const logos = team.logos ?? [];
  const dflt = logos.find((l) => l.rel?.includes("default")) ?? logos[0];
  return team.logo || dflt?.href || null;
}

function cleanHex(hex: string | undefined): string | null {
  const raw = (hex ?? "").replace(/^#/, "").trim().toLowerCase();
  return /^[0-9a-f]{6}$/.test(raw) ? raw : null;
}

function signed(n: number): string {
  if (n === 0) return "PK";
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`;
}

function american(odds: string | number | null | undefined): string | null {
  const n = num(odds);
  if (n == null) return null;
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`;
}

function headshotHref(a: RawAthlete | undefined): string | null {
  if (!a?.headshot) return null;
  return typeof a.headshot === "string" ? a.headshot : a.headshot.href ?? null;
}

/* ───────────────────────── parsers ───────────────────────── */

function parseTeam(c: RawCompetitor | undefined, side: "home" | "away"): MoreInfoTeam {
  const t = c?.team ?? {};
  const rank = c?.curatedRank?.current ?? c?.rank;
  return {
    id: String(t.id ?? c?.id ?? ""),
    abbrev: t.abbreviation ?? "",
    name: t.displayName ?? t.abbreviation ?? "",
    logo: teamLogo(t),
    color: cleanHex(t.color),
    alternateColor: cleanHex(t.alternateColor),
    homeAway: side,
    score: scoreValue(c?.score),
    rank: rank != null && rank > 0 && rank < 99 ? rank : null,
    records: (c?.record ?? [])
      .map((r) => ({ type: r.type ?? "", summary: r.summary ?? r.displayValue ?? "" }))
      .filter((r) => r.type && r.summary),
  };
}

const LINE_LABEL: Record<MoreInfoSport, string> = {
  cfb: "Spread",
  nfl: "Spread",
  nba: "Spread",
  wnba: "Spread",
  nhl: "Puck line",
  mlb: "Run line",
};

export function parseOdds(
  pick: RawPick | undefined,
  sport: MoreInfoSport,
  away: MoreInfoTeam,
  home: MoreInfoTeam,
  final: boolean,
): MoreInfoOdds | null {
  if (!pick) return null;
  const homeLine = num(pick.pointSpread?.home?.close?.line) ?? num(pick.spread);
  const homeLineOpen = num(pick.pointSpread?.home?.open?.line);
  const overUnder = num(pick.overUnder) ?? num(pick.total?.over?.close?.line);
  const totalOpen = num(pick.total?.over?.open?.line);
  const awayMoneyline = american(pick.moneyline?.away?.close?.odds ?? pick.awayTeamOdds?.moneyLine);
  const homeMoneyline = american(pick.moneyline?.home?.close?.odds ?? pick.homeTeamOdds?.moneyLine);
  if (homeLine == null && overUnder == null && !awayMoneyline && !homeMoneyline && !pick.details) return null;

  let ats: MoreInfoOdds["ats"] = null;
  let total: MoreInfoOdds["total"] = null;
  if (final && away.score != null && home.score != null) {
    if (homeLine != null) {
      const margin = home.score - away.score;
      const adjusted = margin + homeLine;
      if (adjusted === 0) {
        ats = { text: `Push at ${home.abbrev} ${signed(homeLine)}`, coverId: null };
      } else {
        const homeCovers = adjusted > 0;
        const cover = homeCovers ? home : away;
        const line = homeCovers ? homeLine : -homeLine;
        const coverMargin = homeCovers ? margin : -margin;
        const how =
          coverMargin > 0 ? `won by ${coverMargin}` : coverMargin < 0 ? `lost by ${-coverMargin}` : "tied";
        ats = { text: `${cover.abbrev} covered ${signed(line)} · ${how}`, coverId: cover.id };
      }
    }
    if (overUnder != null) {
      const sum = away.score + home.score;
      const result = sum > overUnder ? "over" : sum < overUnder ? "under" : "push";
      const word = result === "over" ? "Over" : result === "under" ? "Under" : "Push";
      total = { text: `${word} ${overUnder} · ${sum} total`, result };
    }
  }

  return {
    provider: pick.provider?.name ?? null,
    details: pick.details ?? null,
    homeLine,
    homeLineOpen,
    overUnder,
    totalOpen,
    awayMoneyline,
    homeMoneyline,
    lineLabel: LINE_LABEL[sport],
    ats,
    total,
  };
}

export function parseSeasonSeries(
  raw: RawSummary["seasonseries"],
  away: MoreInfoTeam,
  home: MoreInfoTeam,
  currentEventId: string,
): MoreInfoSeries | null {
  const block =
    (raw ?? []).find((s) => s.type === "season" || /regular|playoff|series/i.test(s.title ?? "")) ?? raw?.[0];
  if (!block) return null;
  const meetings: MoreInfoMeeting[] = [];
  for (const e of block.events ?? []) {
    if (!e.id || e.id === currentEventId || !e.statusType?.completed) continue;
    const comps = e.competitors ?? [];
    const h = comps.find((c) => c.homeAway === "home");
    const a = comps.find((c) => c.homeAway === "away");
    if (!h || !a) continue;
    const homeScore = scoreValue(h.score);
    const awayScore = scoreValue(a.score);
    const winnerId = h.winner ? String(h.team?.id ?? "") : a.winner ? String(a.team?.id ?? "") : null;
    meetings.push({
      id: e.id,
      date: e.date ?? "",
      season: null,
      awayId: String(a.team?.id ?? ""),
      homeId: String(h.team?.id ?? ""),
      awayAbbrev: a.team?.abbreviation ?? "",
      homeAbbrev: h.team?.abbreviation ?? "",
      awayScore,
      homeScore,
      winnerId,
      neutral: Boolean(e.neutralSite),
      venue: null,
      note: e.statusType?.shortDetail && /OT|SO|\//.test(e.statusType.shortDetail) ? e.statusType.shortDetail : null,
    });
  }
  meetings.sort((x, y) => y.date.localeCompare(x.date));
  const awayWins = meetings.filter((m) => m.winnerId === away.id).length;
  const homeWins = meetings.filter((m) => m.winnerId === home.id).length;
  if (!block.summary && meetings.length === 0) return null;
  return {
    title: block.title || "Season series",
    summary: block.summary ?? null,
    awayWins,
    homeWins,
    ties: meetings.filter((m) => !m.winnerId).length,
    sinceSeason: null,
    meetings,
  };
}

export function parseLastFive(raw: RawSummary["lastFiveGames"]): MoreInfoForm[] {
  return (raw ?? [])
    .map((block) => ({
      teamId: String(block.team?.id ?? ""),
      abbrev: block.team?.abbreviation ?? "",
      games: (block.events ?? []).slice(-5).reverse().map((e) => ({
        id: e.id ?? "",
        date: e.gameDate ?? "",
        atVs: (e.atVs === "@" ? "@" : "vs") as "vs" | "@",
        opponentAbbrev: e.opponent?.abbreviation ?? "",
        opponentLogo: e.opponentLogo ?? teamLogo(e.opponent),
        result: e.gameResult || null,
        score: e.score ?? null,
      })),
    }))
    .filter((b) => b.teamId && b.games.length > 0);
}

export function parseLeaders(
  raw: RawSummary["leaders"],
  away: MoreInfoTeam,
  home: MoreInfoTeam,
): MoreInfoLeaderPair[] {
  const byTeam = new Map<string, NonNullable<RawSummary["leaders"]>[number]>();
  for (const block of raw ?? []) {
    if (block.team?.id) byTeam.set(String(block.team.id), block);
  }
  const awayBlock = byTeam.get(away.id);
  const homeBlock = byTeam.get(home.id);
  if (!awayBlock && !homeBlock) return [];
  const keys: { key: string; label: string }[] = [];
  for (const cat of [...(awayBlock?.leaders ?? []), ...(homeBlock?.leaders ?? [])]) {
    if (cat.name && !keys.some((k) => k.key === cat.name)) {
      keys.push({ key: cat.name, label: cat.displayName ?? cat.name });
    }
  }
  const pick = (block: typeof awayBlock, key: string): MoreInfoLeader | null => {
    const top = block?.leaders?.find((c) => c.name === key)?.leaders?.[0];
    const a = top?.athlete;
    if (!a?.id || !top?.displayValue) return null;
    const name = a.displayName ?? a.fullName ?? "";
    return {
      id: String(a.id),
      name,
      shortName: a.shortName ?? name,
      headshot: headshotHref(a),
      position: a.position?.abbreviation ?? null,
      value: top.displayValue,
    };
  };
  return keys
    .map(({ key, label }) => ({ key, label, away: pick(awayBlock, key), home: pick(homeBlock, key) }))
    .filter((p) => p.away || p.home);
}

const INJURY_ORDER = ["out", "injured reserve", "ir", "doubtful", "questionable", "day-to-day", "probable"];

export function parseInjuries(raw: RawSummary["injuries"]): MoreInfoInjuries[] {
  return (raw ?? [])
    .map((block) => {
      const players = (block.injuries ?? [])
        .filter((row) => row.athlete?.id && (row.status || row.type?.description))
        .map((row) => {
          const d = row.details;
          const detail = [d?.side && d.side !== "Not Specified" ? d.side : null, d?.type, d?.detail && d.detail !== "Not Specified" ? d.detail : null]
            .filter(Boolean)
            .join(" ");
          return {
            id: String(row.athlete!.id),
            name: row.athlete!.displayName ?? row.athlete!.fullName ?? "",
            position: row.athlete!.position?.abbreviation ?? null,
            status: row.status || row.type?.description || "",
            detail: detail || null,
          };
        });
      const rank = (s: string) => {
        const i = INJURY_ORDER.findIndex((k) => s.toLowerCase().startsWith(k));
        return i < 0 ? INJURY_ORDER.length : i;
      };
      players.sort((a, b) => rank(a.status) - rank(b.status));
      return { teamId: String(block.team?.id ?? ""), abbrev: block.team?.abbreviation ?? "", players };
    })
    .filter((b) => b.teamId && b.players.length > 0);
}

const STANDING_COLUMNS: Record<MoreInfoSport, { name: string; label: string }[]> = {
  cfb: [
    { name: "vs. Conf.", label: "Conf" },
    { name: "overall", label: "Overall" },
  ],
  nfl: [
    { name: "overall", label: "W-L" },
    { name: "winPercent", label: "Pct" },
    { name: "pointsFor", label: "PF" },
    { name: "pointsAgainst", label: "PA" },
  ],
  nhl: [
    { name: "wins", label: "W" },
    { name: "losses", label: "L" },
    { name: "otLosses", label: "OTL" },
    { name: "points", label: "Pts" },
  ],
  mlb: [
    { name: "wins", label: "W" },
    { name: "losses", label: "L" },
    { name: "gamesBehind", label: "GB" },
  ],
  nba: [
    { name: "wins", label: "W" },
    { name: "losses", label: "L" },
    { name: "gamesBehind", label: "GB" },
  ],
  wnba: [
    { name: "wins", label: "W" },
    { name: "losses", label: "L" },
    { name: "gamesBehind", label: "GB" },
  ],
};

export function parseStandings(
  raw: RawSummary["standings"],
  sport: MoreInfoSport,
  teamIds: string[],
): MoreInfoStandings[] {
  const out: MoreInfoStandings[] = [];
  for (const group of raw?.groups ?? []) {
    const entries = group.standings?.entries ?? [];
    if (!entries.length) continue;
    const available = new Set(entries[0]?.stats?.map((s) => s.name ?? "") ?? []);
    let columns = STANDING_COLUMNS[sport].filter((c) => available.has(c.name));
    if (!columns.length) {
      columns = (entries[0]?.stats ?? []).slice(0, 4).map((s) => ({
        name: s.name ?? "",
        label: s.shortDisplayName ?? s.abbreviation ?? s.name ?? "",
      }));
    }
    const rows = entries.map((e) => ({
      teamId: String(e.id ?? ""),
      name: e.team ?? "",
      logo: (e.logo ?? []).find((l) => l.rel?.includes("default"))?.href ?? e.logo?.[0]?.href ?? null,
      values: columns.map((c) => {
        const s = e.stats?.find((x) => x.name === c.name);
        return s?.displayValue ?? s?.summary ?? "—";
      }),
      highlight: teamIds.includes(String(e.id ?? "")),
    }));
    if (!rows.some((r) => r.highlight)) continue;
    out.push({
      title: (group.header ?? "Standings").replace(/^\d{4}(-\d{2})?\s+/, ""),
      columns: columns.map((c) => c.label),
      rows,
    });
  }
  return out;
}

/** ESPN's `grass` flag only means a playing surface in these leagues. */
const OUTDOOR_SURFACE = new Set<MoreInfoSport>(["cfb", "nfl", "mlb"]);

export function parseGameInfo(
  raw: RawSummary["gameInfo"],
  neutral: boolean,
  sport: MoreInfoSport,
): MoreInfoGameInfo | null {
  if (!raw) return null;
  const v = raw.venue;
  const place = [v?.address?.city, v?.address?.state].filter(Boolean).join(", ") || null;
  const images = v?.images ?? [];
  const image = (images.find((i) => i.rel?.includes("day") && !i.rel?.includes("interior")) ?? images[0])?.href ?? null;
  const w = raw.weather;
  const condition = w?.displayValue || (w?.conditionId && !/^\d+$/.test(w.conditionId) ? w.conditionId : null);
  const weatherBits = [
    w?.temperature != null ? `${w.temperature}°` : null,
    condition,
    w?.gust ? `gusts ${w.gust} mph` : null,
    w?.precipitation ? `${w.precipitation}% precip` : null,
  ].filter(Boolean);
  const officials = [...(raw.officials ?? [])]
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
    .map((o) => ({ name: o.displayName ?? o.fullName ?? "", role: o.position?.displayName ?? null }))
    .filter((o) => o.name);
  const attendance = raw.attendance && raw.attendance > 0 ? raw.attendance : null;
  const info: MoreInfoGameInfo = {
    venue: v?.fullName ?? null,
    place,
    image,
    surface: !OUTDOOR_SURFACE.has(sport) ? null : v?.grass === true ? "Grass" : v?.grass === false ? "Turf" : null,
    attendance,
    weather: weatherBits.length ? weatherBits.join(" · ") : null,
    officials,
    neutral,
  };
  if (!info.venue && !info.attendance && !info.weather && !officials.length) return null;
  return info;
}

export function parseAtsRecords(raw: RawSummary["againstTheSpread"]): MoreInfoAts[] {
  return (raw ?? [])
    .map((block) => ({
      teamId: String(block.team?.id ?? ""),
      abbrev: block.team?.abbreviation ?? "",
      records: (block.records ?? [])
        .map((r) => ({ label: r.displayName ?? r.name ?? r.type ?? "ATS", summary: r.summary ?? r.displayValue ?? "" }))
        .filter((r) => r.summary),
    }))
    .filter((b) => b.teamId && b.records.length > 0);
}

export function parseGameMoreInfo(raw: RawSummary, sport: MoreInfoSport, eventId: string): GameMoreInfo | null {
  const comp = raw.header?.competitions?.[0];
  const comps = comp?.competitors ?? [];
  const homeRaw = comps.find((c) => c.homeAway === "home");
  const awayRaw = comps.find((c) => c.homeAway === "away");
  if (!homeRaw || !awayRaw) return null;
  const away = parseTeam(awayRaw, "away");
  const home = parseTeam(homeRaw, "home");
  const stateRaw = comp?.status?.type?.state;
  const state: GameMoreInfo["state"] = stateRaw === "in" ? "in" : stateRaw === "post" ? "post" : "pre";
  const final = state === "post" && comp?.status?.type?.completed !== false;
  const awayPct = num(raw.predictor?.awayTeam?.gameProjection);
  const homePct = num(raw.predictor?.homeTeam?.gameProjection);
  return {
    sport,
    eventId,
    state,
    date: comp?.date ?? null,
    season: raw.header?.season?.year ?? null,
    away,
    home,
    odds: parseOdds(raw.pickcenter?.[0] ?? raw.odds?.[0], sport, away, home, final),
    predictor: awayPct != null && homePct != null && state === "pre" ? { awayPct, homePct } : null,
    ats: parseAtsRecords(raw.againstTheSpread),
    series: parseSeasonSeries(raw.seasonseries, away, home, eventId),
    form: parseLastFive(raw.lastFiveGames),
    leaders: {
      title: state === "pre" ? "Season leaders" : "Game leaders",
      pairs: parseLeaders(raw.leaders, away, home),
    },
    injuries: parseInjuries(raw.injuries),
    standings: parseStandings(raw.standings, sport, [away.id, home.id]),
    gameInfo: parseGameInfo(raw.gameInfo, Boolean(comp?.neutralSite), sport),
  };
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`ESPN ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchGameMoreInfo(sport: MoreInfoSport, eventId: string): Promise<GameMoreInfo | null> {
  const raw = await getJson<RawSummary>(`${SITE}/${LEAGUE_PATH[sport]}/summary?event=${encodeURIComponent(eventId)}`);
  return parseGameMoreInfo(raw, sport, eventId);
}

/* ───────────────────── football schedules: series + form ───────────────────── */

type RawScheduleEvent = {
  id?: string;
  date?: string;
  season?: { year?: number };
  competitions?: {
    neutralSite?: boolean;
    notes?: { headline?: string }[];
    venue?: { fullName?: string };
    status?: { type?: { completed?: boolean; shortDetail?: string } };
    competitors?: RawCompetitor[];
  }[];
};

export type ScheduleGame = {
  id: string;
  date: string;
  season: number | null;
  completed: boolean;
  neutral: boolean;
  venue: string | null;
  note: string | null;
  home: { id: string; abbrev: string; logo: string | null; score: number | null; winner: boolean };
  away: { id: string; abbrev: string; logo: string | null; score: number | null; winner: boolean };
};

export function parseScheduleEvents(events: RawScheduleEvent[] | undefined, season: number | null): ScheduleGame[] {
  const out: ScheduleGame[] = [];
  for (const e of events ?? []) {
    const c = e.competitions?.[0];
    const h = c?.competitors?.find((x) => x.homeAway === "home");
    const a = c?.competitors?.find((x) => x.homeAway === "away");
    if (!e.id || !h?.team || !a?.team) continue;
    const side = (x: RawCompetitor) => ({
      id: String(x.team?.id ?? x.id ?? ""),
      abbrev: x.team?.abbreviation ?? "",
      logo: teamLogo(x.team),
      score: scoreValue(x.score),
      winner: Boolean(x.winner),
    });
    out.push({
      id: e.id,
      date: e.date ?? "",
      season: e.season?.year ?? season,
      completed: Boolean(c?.status?.type?.completed),
      neutral: Boolean(c?.neutralSite),
      venue: c?.venue?.fullName ?? null,
      note: c?.notes?.[0]?.headline ?? null,
      home: side(h),
      away: side(a),
    });
  }
  return out;
}

/** Meetings between two clubs in the given schedules, newest first. */
export function seriesFromSchedules(
  games: ScheduleGame[],
  away: { id: string; abbrev: string },
  home: { id: string; abbrev: string },
  excludeEventId: string,
  sinceSeason: number | null,
): MoreInfoSeries | null {
  const seen = new Set<string>();
  const meetings: MoreInfoMeeting[] = [];
  for (const g of games) {
    if (!g.completed || g.id === excludeEventId || seen.has(g.id)) continue;
    const ids = [g.home.id, g.away.id];
    if (!ids.includes(away.id) || !ids.includes(home.id)) continue;
    if (g.home.score == null || g.away.score == null) continue;
    seen.add(g.id);
    const winnerId =
      g.home.score > g.away.score ? g.home.id : g.away.score > g.home.score ? g.away.id : null;
    meetings.push({
      id: g.id,
      date: g.date,
      season: g.season,
      awayId: g.away.id,
      homeId: g.home.id,
      awayAbbrev: g.away.abbrev,
      homeAbbrev: g.home.abbrev,
      awayScore: g.away.score,
      homeScore: g.home.score,
      winnerId,
      neutral: g.neutral,
      venue: g.venue,
      note: g.note,
    });
  }
  if (!meetings.length) return null;
  meetings.sort((x, y) => y.date.localeCompare(x.date));
  const awayWins = meetings.filter((m) => m.winnerId === away.id).length;
  const homeWins = meetings.filter((m) => m.winnerId === home.id).length;
  const ties = meetings.length - awayWins - homeWins;
  const leader = awayWins === homeWins ? null : awayWins > homeWins ? away : home;
  const record = `${Math.max(awayWins, homeWins)}-${Math.min(awayWins, homeWins)}${ties ? `-${ties}` : ""}`;
  const summary = leader ? `${leader.abbrev} leads ${record}` : `Series tied ${record}`;
  return {
    title: "Series history",
    summary,
    awayWins,
    homeWins,
    ties,
    sinceSeason,
    meetings,
  };
}

/** A club's last five completed games before `beforeIso`, newest first. */
export function formFromSchedule(
  games: ScheduleGame[],
  teamId: string,
  abbrev: string,
  beforeIso: string | null,
  excludeEventId: string,
): MoreInfoForm | null {
  const done = games
    .filter((g) => g.completed && g.id !== excludeEventId && (!beforeIso || g.date < beforeIso))
    .filter((g) => g.home.id === teamId || g.away.id === teamId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  if (!done.length) return null;
  return {
    teamId,
    abbrev,
    games: done.map((g) => {
      const home = g.home.id === teamId;
      const me = home ? g.home : g.away;
      const opp = home ? g.away : g.home;
      const result =
        me.score == null || opp.score == null ? null : me.score > opp.score ? "W" : me.score < opp.score ? "L" : "T";
      return {
        id: g.id,
        date: g.date,
        atVs: home ? "vs" : "@",
        opponentAbbrev: opp.abbrev,
        opponentLogo: opp.logo,
        result,
        score: me.score != null && opp.score != null ? `${me.score}-${opp.score}` : null,
      };
    }),
  };
}

/** Points scored and allowed per completed game this season. */
export function scoringFromSchedule(
  games: ScheduleGame[],
  teamId: string,
): { pointsFor: number; pointsAgainst: number } | null {
  let pf = 0;
  let pa = 0;
  let n = 0;
  for (const g of games) {
    if (!g.completed || g.home.score == null || g.away.score == null) continue;
    if (g.home.id === teamId) {
      pf += g.home.score;
      pa += g.away.score;
    } else if (g.away.id === teamId) {
      pf += g.away.score;
      pa += g.home.score;
    } else continue;
    n += 1;
  }
  return n ? { pointsFor: pf / n, pointsAgainst: pa / n } : null;
}

export const SERIES_SEASONS = 15;

async function fetchSchedule(sport: MoreInfoSport, teamId: string, season?: number): Promise<ScheduleGame[]> {
  const q = season ? `?season=${season}` : "";
  const raw = await getJson<{ events?: RawScheduleEvent[]; requestedSeason?: { year?: number } }>(
    `${SITE}/${LEAGUE_PATH[sport]}/teams/${encodeURIComponent(teamId)}/schedule${q}`,
  );
  return parseScheduleEvents(raw.events, raw.requestedSeason?.year ?? season ?? null);
}

export type FootballHistory = {
  series: MoreInfoSeries | null;
  form: MoreInfoForm[];
  scoring: Record<string, { pointsFor: number; pointsAgainst: number } | null>;
};

/**
 * Series history (regular season, last SERIES_SEASONS seasons) from the home
 * club's schedules, plus both clubs' last five and points per game this season.
 */
export async function fetchFootballHistory(input: {
  sport: "cfb" | "nfl";
  eventId: string;
  season: number;
  date: string | null;
  away: { id: string; abbrev: string };
  home: { id: string; abbrev: string };
}): Promise<FootballHistory> {
  const seasons = Array.from({ length: SERIES_SEASONS }, (_, i) => input.season - i);
  const [homeSeasons, awayNow] = await Promise.all([
    Promise.allSettled(seasons.map((y) => fetchSchedule(input.sport, input.home.id, y))),
    fetchSchedule(input.sport, input.away.id, input.season).catch(() => [] as ScheduleGame[]),
  ]);
  const homeAll = homeSeasons.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const homeNow = homeAll.filter((g) => g.season === input.season);
  const loaded = homeSeasons
    .map((r, i) => (r.status === "fulfilled" ? seasons[i]! : null))
    .filter((y): y is number => y != null);
  const since = loaded.length ? Math.min(...loaded) : null;
  const form = [
    formFromSchedule(awayNow, input.away.id, input.away.abbrev, input.date, input.eventId),
    formFromSchedule(homeNow, input.home.id, input.home.abbrev, input.date, input.eventId),
  ].filter((f): f is MoreInfoForm => f != null);
  return {
    series: seriesFromSchedules(homeAll, input.away, input.home, input.eventId, since),
    form,
    scoring: {
      [input.away.id]: scoringFromSchedule(awayNow, input.away.id),
      [input.home.id]: scoringFromSchedule(homeNow, input.home.id),
    },
  };
}

/* ───────────────────────── season team stats ───────────────────────── */

type RawTeamStats = {
  results?: {
    stats?: {
      categories?: { name?: string; stats?: { name?: string; value?: number; displayValue?: string }[] }[];
    };
  };
};

export type StatLookup = (category: string, name: string) => number | null;

export function statLookup(raw: RawTeamStats | null | undefined): StatLookup {
  const cats = raw?.results?.stats?.categories ?? [];
  return (category, name) => {
    const stat = cats.find((c) => c.name === category)?.stats?.find((s) => s.name === name);
    return num(stat?.value ?? stat?.displayValue);
  };
}

type StatSpec = {
  label: string;
  value: (s: StatLookup, extra: { pointsFor?: number; pointsAgainst?: number }) => number | null;
  format: (n: number) => string;
  lower?: boolean;
};

const one = (n: number) => n.toFixed(1);
const pct = (n: number) => `${n.toFixed(1)}%`;
const per = (total: number | null, games: number | null) =>
  total != null && games != null && games > 0 ? total / games : null;

const FOOTBALL_STATS: StatSpec[] = [
  { label: "Points / game", value: (s, x) => s("scoring", "totalPointsPerGame") ?? x.pointsFor ?? null, format: one },
  { label: "Points allowed / game", value: (_, x) => x.pointsAgainst ?? null, format: one, lower: true },
  { label: "Total yards / game", value: (s) => s("passing", "yardsPerGame"), format: one },
  { label: "Pass yards / game", value: (s) => s("passing", "netPassingYardsPerGame"), format: one },
  { label: "Rush yards / game", value: (s) => s("rushing", "rushingYardsPerGame"), format: one },
  {
    label: "Yards / play",
    value: (s) => per(s("rushing", "totalYards"), s("rushing", "totalOffensivePlays")),
    format: one,
  },
  { label: "3rd down %", value: (s) => s("miscellaneous", "thirdDownConvPct"), format: pct },
  {
    label: "Turnover margin",
    value: (s) => s("miscellaneous", "turnOverDifferential"),
    format: (n) => (n > 0 ? `+${n}` : String(n)),
  },
  { label: "Sacks", value: (s) => s("defensive", "sacks"), format: (n) => String(Math.round(n)) },
  {
    label: "Penalty yards / game",
    value: (s) => per(s("miscellaneous", "totalPenaltyYards"), s("general", "gamesPlayed") ?? s("passing", "teamGamesPlayed")),
    format: one,
    lower: true,
  },
];

const HOCKEY_STATS: StatSpec[] = [
  { label: "Goals / game", value: (s) => per(s("offensive", "goals"), s("general", "games")), format: (n) => n.toFixed(2) },
  { label: "Goals against / game", value: (s) => s("defensive", "avgGoalsAgainst"), format: (n) => n.toFixed(2), lower: true },
  { label: "Shots / game", value: (s) => per(s("offensive", "shotsTotal"), s("general", "games")), format: one },
  { label: "Shooting %", value: (s) => s("offensive", "shootingPct"), format: pct },
  {
    label: "Save %",
    value: (s) => s("defensive", "savePct"),
    format: (n) => (n < 1 ? n.toFixed(3).replace(/^0/, "") : n.toFixed(1)),
  },
  { label: "Power-play goals", value: (s) => s("offensive", "powerPlayGoals"), format: (n) => String(Math.round(n)) },
  { label: "Faceoff %", value: (s) => s("offensive", "faceoffPercent"), format: pct },
  { label: "PIM / game", value: (s) => per(s("penalties", "penaltyMinutes"), s("general", "games")), format: one, lower: true },
];

export function seasonStatRows(
  sport: MoreInfoSport,
  away: StatLookup,
  home: StatLookup,
  awayExtra: { pointsFor?: number; pointsAgainst?: number } = {},
  homeExtra: { pointsFor?: number; pointsAgainst?: number } = {},
): MoreInfoStatRow[] {
  const specs = sport === "cfb" || sport === "nfl" ? FOOTBALL_STATS : sport === "nhl" ? HOCKEY_STATS : [];
  return specs
    .map((spec) => {
      const a = spec.value(away, awayExtra);
      const h = spec.value(home, homeExtra);
      return {
        label: spec.label,
        away: a == null ? "—" : spec.format(a),
        home: h == null ? "—" : spec.format(h),
        awayNum: a,
        homeNum: h,
        lowerIsBetter: Boolean(spec.lower),
      };
    })
    .filter((r) => r.awayNum != null && r.homeNum != null);
}

export async function fetchTeamSeasonStats(sport: MoreInfoSport, teamId: string): Promise<StatLookup | null> {
  try {
    const raw = await getJson<RawTeamStats>(
      `${SITE}/${LEAGUE_PATH[sport]}/teams/${encodeURIComponent(teamId)}/statistics`,
    );
    return statLookup(raw);
  } catch {
    return null;
  }
}
