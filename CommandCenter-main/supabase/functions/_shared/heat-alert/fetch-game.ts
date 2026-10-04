import { hexColor } from "./color.ts";
import type {
  DiamondSpot,
  FootballSpot,
  HeatAlertCard,
  HeatSide,
  HeatSport,
  IceSpot,
} from "./types.ts";

/**
 * site.api is often bot-walled from a browser (403). site.web.api is what the
 * Sports pages already use as the host that answers. Try it first, then site.api
 * for the edge function and the local script.
 */
const ESPN_HOSTS = [
  "https://site.web.api.espn.com/apis/site/v2/sports",
  "https://site.api.espn.com/apis/site/v2/sports",
];
const UA = "CommandCenterHeatAlert";

const SPORT_PATHS: Record<Exclude<HeatSport, "soccer">, string> = {
  nfl: "football/nfl",
  cfb: "football/college-football",
  nhl: "hockey/nhl",
  mlb: "baseball/mlb",
};

const SOCCER_PATHS = ["soccer/eng.1", "soccer/eng.2", "soccer/usa.1", "soccer/uefa.champions"];

const DATED = new Set(["mlb", "nhl", "soccer"]);

export class HeatAlertLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HeatAlertLookupError";
  }
}

export function isHeatSport(value: string): value is HeatSport {
  return value === "nfl" || value === "cfb" || value === "nhl" || value === "mlb" || value === "soccer";
}

function chicagoYmd(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Chicago" }).replace(/-/g, "");
}

function chicagoTime(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
  });
}

type Reach = { ok: number; failed: number };

async function getJson(pathAndQuery: string, reach: Reach): Promise<unknown | null> {
  let blocked = false;
  for (const host of ESPN_HOSTS) {
    try {
      const res = await fetch(`${host}/${pathAndQuery}`, {
        headers: { Accept: "application/json", "User-Agent": UA },
        signal: AbortSignal.timeout(12_000),
      });
      if (res.ok) {
        reach.ok += 1;
        return await res.json();
      }
      blocked = true;
    } catch {
      blocked = true;
    }
  }
  if (blocked) reach.failed += 1;
  return null;
}

/** Scrimmage snaps on this drive. Kicks, punts, PATs, and dead-ball flags stay off the field. */
function scrimmageYards(plays: Record<string, unknown>[]): number[] {
  const spots: number[] = [];
  for (const play of plays) {
    const typeText = str(asRecord(play.type)?.text);
    const text = str(play.text);
    if (/kickoff|\bpunt\b|end period|timeout|two-minute|coin toss/i.test(typeText)) continue;
    if (/extra point|two[- ]point|\bpat\b/i.test(typeText)) continue;
    if (/penalty/i.test(typeText) && /no play/i.test(text)) continue;
    const startYard = num(asRecord(play.start)?.yardLine);
    const endYard = num(asRecord(play.end)?.yardLine);
    const yard = startYard != null && startYard > 0 && startYard < 100 ? startYard : endYard;
    if (yard == null || yard <= 0 || yard >= 100) continue;
    spots.push(yard);
  }
  return spots;
}

function unreachable(reach: Reach): boolean {
  return reach.ok === 0 && reach.failed > 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : value != null && typeof value !== "object" ? String(value) : "";
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function gamePath(sport: HeatSport, id: string): string {
  return `/sports/${sport}/game/${id}?solo=1`;
}

function largeLogo(url: string | null, sport: HeatSport, abbrev: string): string | null {
  if (url && /^https?:/i.test(url)) {
    return url.replace("/500/scoreboard/", "/500/").replace("/500-dark/scoreboard/", "/500/");
  }
  const league = sport === "cfb" ? "ncaa" : sport;
  const slug = abbrev.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!slug) return null;
  return `https://a.espncdn.com/i/teamlogos/${league}/500/${slug}.png`;
}

function readSide(raw: unknown, sport: HeatSport, homeAway: "away" | "home"): HeatSide | null {
  const row = asRecord(raw);
  if (!row || str(row.homeAway) !== homeAway) return null;
  const team = asRecord(row.team);
  if (!team) return null;
  const id = str(team.id);
  const abbrev = str(team.abbreviation) || "—";
  if (!id) return null;
  const logos = asArray(team.logos);
  const fromList = logos.map(asRecord).find((logo) => logo && /^https?:/i.test(str(logo.href)));
  const logo = str(team.logo) || (fromList ? str(fromList.href) : "");
  const records = asArray(row.records).map(asRecord);
  const total = records.find((rec) => rec && str(rec.type) === "total");
  const linescores = asArray(row.linescores).map((item) => {
    const rec = asRecord(item);
    return rec ? num(rec.value) ?? num(rec.displayValue) : null;
  });
  return {
    id,
    abbrev,
    name: str(team.shortDisplayName) || str(team.displayName) || abbrev,
    score: num(row.score),
    record: str(total?.summary) || null,
    linescores,
    color: hexColor(str(team.color) || null, homeAway === "away" ? "1e3a5f" : "7a1f1f"),
    logoHref: largeLogo(logo || null, sport, abbrev),
  };
}

function periodLabelsFor(sport: HeatSport, count: number): string[] {
  if (count <= 0) return [];
  if (sport === "mlb") return Array.from({ length: count }, (_, i) => String(i + 1));
  if (sport === "nhl") return ["1st", "2nd", "3rd", "OT", "SO"].slice(0, count);
  return ["Q1", "Q2", "Q3", "Q4", "OT"].slice(0, count);
}

function isTerminalDriveResult(result: string): boolean {
  return /punt|touchdown|field goal|interception|fumble|downs|safety|missed fg|turnover|end of (half|game|quarter)|blocked|touchback/i.test(
    result,
  );
}

function possessionAfterKick(sit: Record<string, unknown> | null, fallback: string | null): string | null {
  const last = asRecord(sit?.lastPlay);
  const typeText = str(asRecord(last?.type)?.text);
  const kicking = str(asRecord(asRecord(last?.start)?.team)?.id);
  const receiving = str(asRecord(asRecord(last?.end)?.team)?.id);
  if (/kickoff|\bpunt\b/i.test(typeText) && kicking && receiving && kicking !== receiving) {
    if (!fallback || fallback === kicking) return receiving;
  }
  return fallback;
}

function readDiamond(sit: Record<string, unknown> | null): DiamondSpot | null {
  if (!sit) return null;
  const balls = num(sit.balls);
  const strikes = num(sit.strikes);
  const outs = num(sit.outs);
  if (balls == null && strikes == null && outs == null && sit.onFirst == null && sit.onSecond == null) {
    return null;
  }
  const athlete = (value: unknown): string | null => {
    const row = asRecord(value);
    const person = asRecord(row?.athlete) ?? row;
    const name = str(person?.displayName) || str(person?.shortName);
    return name || null;
  };
  const base = (value: unknown): boolean => {
    if (value === true) return true;
    const row = asRecord(value);
    return Boolean(row && (row.id != null || asRecord(row.athlete)?.id != null));
  };
  return {
    balls: balls ?? 0,
    strikes: strikes ?? 0,
    outs: outs ?? 0,
    onFirst: base(sit.onFirst),
    onSecond: base(sit.onSecond),
    onThird: base(sit.onThird),
    batter: athlete(sit.batter),
    pitcher: athlete(sit.pitcher),
  };
}

function readFootball(sit: Record<string, unknown> | null): FootballSpot {
  const last = asRecord(sit?.lastPlay);
  const possession = possessionAfterKick(sit, str(sit?.possession) || str(asRecord(last?.team)?.id) || null);
  return {
    downDistanceText: str(sit?.downDistanceText) || null,
    yardLine: num(sit?.yardLine),
    possessionTeamId: possession,
    lastPlayText: str(last?.text) || null,
    driveStartYardLine: null,
    redZone: sit?.isRedZone === true,
  };
}

function cardFromEvent(sport: HeatSport, event: Record<string, unknown>): HeatAlertCard | null {
  const competitions = asArray(event.competitions);
  const comp = asRecord(competitions[0]);
  if (!comp) return null;
  const status = asRecord(asRecord(comp.status)?.type) ?? asRecord(asRecord(event.status)?.type);
  const state = str(status?.state);
  const away = readSide(
    asArray(comp.competitors).find((row) => str(asRecord(row)?.homeAway) === "away"),
    sport,
    "away",
  );
  const home = readSide(
    asArray(comp.competitors).find((row) => str(asRecord(row)?.homeAway) === "home"),
    sport,
    "home",
  );
  const id = str(event.id) || str(comp.id);
  if (!id || !away || !home) return null;
  const live = state === "in";
  const final = state === "post" || status?.completed === true;
  const detail = str(status?.shortDetail) || str(status?.detail);
  const sit = asRecord(comp.situation);
  const football = sport === "nfl" || sport === "cfb" ? readFootball(sit) : null;
  const diamond = sport === "mlb" ? readDiamond(sit) : null;
  const ice: IceSpot | null = sport === "nhl" ? { puckX: null, puckY: null } : null;
  const periodCount = Math.max(away.linescores.length, home.linescores.length);
  return {
    sport,
    gameId: id,
    live,
    final,
    detail,
    when: live || final ? null : chicagoTime(str(event.date) || str(comp.date)),
    away,
    home,
    venue: str(asRecord(comp.venue)?.fullName) || null,
    date: str(event.date) || str(comp.date) || null,
    periodLabels: periodLabelsFor(sport, periodCount),
    football,
    ice,
    diamond,
    gamePath: gamePath(sport, id),
  };
}

function applySummary(card: HeatAlertCard, summary: Record<string, unknown>): HeatAlertCard {
  const header = asRecord(summary.header);
  const comp = asRecord(asArray(header?.competitions)[0]);
  const next: HeatAlertCard = { ...card, away: { ...card.away }, home: { ...card.home } };
  if (comp) {
    const status = asRecord(asRecord(comp.status)?.type);
    const state = str(status?.state);
    if (state) {
      next.live = state === "in";
      next.final = state === "post" || status?.completed === true;
    }
    const detail = str(status?.shortDetail) || str(status?.detail);
    if (detail) next.detail = detail;
    for (const row of asArray(comp.competitors)) {
      const side = str(asRecord(row)?.homeAway) === "home" ? "home" : str(asRecord(row)?.homeAway) === "away" ? "away" : null;
      if (!side) continue;
      const team = asRecord(asRecord(row)?.team);
      const score = num(asRecord(row)?.score);
      if (score != null) next[side].score = score;
      const color = str(team?.color);
      if (color) next[side].color = hexColor(color, next[side].color);
      const name = str(team?.shortDisplayName) || str(team?.displayName);
      if (name) next[side].name = name;
      const rec = asArray(asRecord(row)?.records).map(asRecord).find((item) => item && str(item.type) === "total");
      if (str(rec?.summary)) next[side].record = str(rec?.summary);
      const lines = asArray(asRecord(row)?.linescores).map((item) => {
        const cell = asRecord(item);
        return cell ? num(cell.value) ?? num(cell.displayValue) : null;
      });
      if (lines.length) next[side].linescores = lines;
    }
    const headerSit = asRecord(comp.situation);
    if (headerSit && next.football) {
      const headerSpot = readFootball(headerSit);
      next.football = {
        ...next.football,
        yardLine: headerSpot.yardLine ?? next.football.yardLine,
        downDistanceText: headerSpot.downDistanceText || next.football.downDistanceText,
        possessionTeamId: headerSpot.possessionTeamId || next.football.possessionTeamId,
        lastPlayText: headerSpot.lastPlayText || next.football.lastPlayText,
        redZone: headerSit.isRedZone === true || next.football.redZone,
      };
    }
  }

  if (next.football) {
    const drives = asRecord(summary.drives);
    const current = asRecord(drives?.current);
    const plays = asArray(current?.plays).map(asRecord).filter((row): row is Record<string, unknown> => Boolean(row));
    const displayResult = str(current?.displayResult) || str(current?.shortDisplayResult) || str(current?.result);
    const terminal = isTerminalDriveResult(displayResult);
    const playYardLines = terminal ? [] : scrimmageYards(plays);
    const last = plays.length ? plays[plays.length - 1] : null;
    const start = asRecord(current?.start);
    next.football = {
      ...next.football,
      lastPlayText: str(last?.text) || next.football.lastPlayText,
      driveStartYardLine: terminal ? null : num(start?.yardLine) ?? next.football.driveStartYardLine,
      playYardLines,
    };
  }
  const periodCount = Math.max(next.away.linescores.length, next.home.linescores.length);
  if (periodCount && !next.periodLabels.length) {
    next.periodLabels = periodLabelsFor(next.sport, periodCount);
  } else if (periodCount > next.periodLabels.length) {
    next.periodLabels = periodLabelsFor(next.sport, periodCount);
  }

  if (next.ice) {
    const plays = asArray(summary.plays);
    for (let i = plays.length - 1; i >= 0; i--) {
      const play = asRecord(plays[i]);
      const coord = asRecord(play?.coordinate) ?? asRecord(asRecord(play?.end)?.coordinate);
      const x = num(coord?.x);
      const y = num(coord?.y);
      if (x == null || y == null) continue;
      next.ice = { puckX: x, puckY: y };
      break;
    }
  }
  return next;
}

async function summaryFor(path: string, gameId: string, reach: Reach): Promise<Record<string, unknown> | null> {
  const json = await getJson(`${path}/summary?event=${encodeURIComponent(gameId)}`, reach);
  return asRecord(json);
}

async function scoreboard(path: string, sport: HeatSport, reach: Reach): Promise<HeatAlertCard[]> {
  const dated = DATED.has(sport) ? `?dates=${chicagoYmd()}` : "";
  const json = asRecord(await getJson(`${path}/scoreboard${dated}`, reach));
  return asArray(json?.events)
    .map((event) => {
      const row = asRecord(event);
      return row ? cardFromEvent(sport, row) : null;
    })
    .filter((card): card is HeatAlertCard => card != null);
}

function pathsFor(sport: HeatSport): string[] {
  if (sport === "soccer") return SOCCER_PATHS;
  return [SPORT_PATHS[sport]];
}

function rank(card: HeatAlertCard): number {
  let score = 0;
  if (card.live) score += 100;
  if (card.football?.yardLine != null) score += 30;
  if (card.football?.downDistanceText) score += 10;
  if (card.diamond) score += 10;
  if (card.final) score += 5;
  return score;
}

async function enrich(card: HeatAlertCard, path: string, reach: Reach): Promise<HeatAlertCard> {
  const summary = await summaryFor(path, card.gameId, reach);
  return summary ? applySummary(card, summary) : card;
}

export async function loadHeatAlertCard(opts: {
  sport?: string | null;
  gameId?: string | null;
}): Promise<HeatAlertCard> {
  const reach: Reach = { ok: 0, failed: 0 };
  const sportRaw = (opts.sport ?? "").trim().toLowerCase();
  const gameId = (opts.gameId ?? "").trim();
  if (sportRaw && !isHeatSport(sportRaw)) {
    throw new HeatAlertLookupError("sport must be nfl, cfb, nhl, mlb, or soccer");
  }
  if (gameId && !/^\d{4,16}$/.test(gameId)) {
    throw new HeatAlertLookupError("gameId must be the ESPN event id");
  }
  const sports: HeatSport[] = sportRaw && isHeatSport(sportRaw)
    ? [sportRaw]
    : ["nfl", "cfb", "nhl", "mlb", "soccer"];

  if (gameId) {
    for (const sport of sports) {
      for (const path of pathsFor(sport)) {
        const boards = await scoreboard(path, sport, reach);
        const found = boards.find((card) => card.gameId === gameId);
        if (found) return enrich(found, path, reach);
        const summary = await summaryFor(path, gameId, reach);
        const header = asRecord(summary?.header);
        if (header) {
          const fromHeader = cardFromEvent(sport, header);
          if (fromHeader) return applySummary(fromHeader, summary!);
        }
      }
    }
    if (unreachable(reach)) {
      throw new HeatAlertLookupError("Could not reach ESPN for that game");
    }
    throw new HeatAlertLookupError(`No ESPN game ${gameId}${sportRaw ? ` in ${sportRaw}` : ""}`);
  }

  let best: { card: HeatAlertCard; path: string } | null = null;
  for (const sport of sports) {
    for (const path of pathsFor(sport)) {
      const boards = await scoreboard(path, sport, reach);
      for (const card of boards) {
        if (!best || rank(card) > rank(best.card)) best = { card, path };
      }
    }
    if (sportRaw && best?.card.live) break;
  }
  if (!best) {
    throw new HeatAlertLookupError(
      unreachable(reach) ? "Could not reach ESPN for that sport" : "ESPN did not return a game for that sport",
    );
  }
  return enrich(best.card, best.path, reach);
}
