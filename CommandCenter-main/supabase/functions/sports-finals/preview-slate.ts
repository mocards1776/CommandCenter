/**
 * Evening RUWT slate: Today's Top heat, then a 5pm-CT window filter.
 *
 * Selection is hottest-first (same rankRuwt* scores the board uses). The
 * graphic may print in start-time order. Live and final games are dropped —
 * this is a preview, not a wrap. Empty slate → skip send.
 */

export const PREVIEW_TZ = "America/Chicago";
/** Board target is 8; ruwtTodaysTop's default section cap is 6. */
export const PREVIEW_LIMIT = 8;
export const PREVIEW_WINDOW_END_HOUR = 1;
export const PREVIEW_WINDOW_END_MINUTE = 30;

export type PreviewLeague = "MLB" | "NFL" | "NHL" | "CFB" | "Soccer";
export type PreviewSport = "mlb" | "nfl" | "nhl" | "cfb" | "soccer";

export type PreviewSide = {
  teamId: string;
  name: string;
  abbrev: string;
  logo: string | null;
  logoData?: string | null;
  record: string | null;
  rank?: number | null;
  color?: string | null;
};

export type PreviewGame = {
  id: string;
  sport: PreviewSport;
  league: PreviewLeague;
  competition: string | null;
  away: PreviewSide;
  home: PreviewSide;
  startIso: string | null;
  live: boolean;
  final: boolean;
  heat: number;
  reasons: string[];
  tv: string[];
  seriesLine?: string | null;
  path: string;
  why: string | null;
  network: string | null;
};

/**
 * Server cannot read RUWT localStorage sliders. Defaults match
 * DEFAULT_FAVORITES for the five preview leagues. Cardinals (MLB 138) and
 * Blues (NHL 19) are explicit so they keep their board bumps.
 */
export const DEFAULT_PREVIEW_INTEREST = {
  mlb: { "138": 10 } as Record<string, number>,
  nhl: { "19": 10 } as Record<string, number>,
  nfl: { "8": 10, "12": 10, "6": 10 } as Record<string, number>,
  cfb: { "142": 10, "2623": 10 } as Record<string, number>,
  soccer: { "352": 10, "380": 10, "359": 10 } as Record<string, number>,
};

const SKIP_REASON =
  /^(live(\s+now)?|upcoming|final|your #1|high interest|on your board|followed club|pitching set|watch player|favorite pitchers?|favorite manager|watch \w+|both teams ranked|both clubs ranked|tight score|even records|matched records|strong clubs|contenders|your #1 (team|club)|high interest (team|club))$/i;

const NETWORKS: { test: RegExp; name: string }[] = [
  { test: /^espn\+$/i, name: "ESPN+" },
  { test: /^espn2$/i, name: "ESPN2" },
  { test: /^espnu$/i, name: "ESPNU" },
  { test: /^espn(\s*unlmtd|\s*unlimited)?$/i, name: "ESPN" },
  { test: /^abc$/i, name: "ABC" },
  { test: /^cbs\s*sports\s*network$|^cbssn$/i, name: "CBSSN" },
  { test: /^cbs$/i, name: "CBS" },
  { test: /^nbc$/i, name: "NBC" },
  { test: /^fox\s*sports\s*1$|^fs1$/i, name: "FS1" },
  { test: /^fox\s*sports\s*2$|^fs2$/i, name: "FS2" },
  { test: /^fox(\s*sports)?$/i, name: "FOX" },
  { test: /^apple(\s*tv\+?)?$/i, name: "Apple TV+" },
  { test: /^peacock$/i, name: "Peacock" },
  { test: /paramount\+|^para\+$/i, name: "Para+" },
  { test: /prime\s*video|^amazon|^\s*prime\s*$/i, name: "Prime" },
  { test: /^netflix$/i, name: "Netflix" },
  { test: /^usa(\s*network)?$/i, name: "USA" },
  { test: /^tnt$/i, name: "TNT" },
  { test: /^tbs$/i, name: "TBS" },
  { test: /^mlb\.?tv$/i, name: "MLB.TV" },
  { test: /^max$/i, name: "Max" },
  { test: /^secn?\+$/i, name: "SECN+" },
  { test: /^sec(\s*network)?$|^secn$/i, name: "SECN" },
  { test: /^acc\s*network$|^accn$/i, name: "ACCN" },
  { test: /^big\s*ten(\s*network)?$|^btn$/i, name: "BTN" },
  { test: /^nfl\s*network$|^nfln$/i, name: "NFLN" },
  { test: /^nhl\s*network$|^nhln$/i, name: "NHLN" },
  { test: /^the\s*cw$|^cw$/i, name: "CW" },
  { test: /^unim[aá]s$/i, name: "UniMás" },
  { test: /^univision$/i, name: "Univision" },
  { test: /^telemundo$/i, name: "Telemundo" },
  { test: /^fanduel/i, name: "FanDuel" },
];

export function chicagoYmd(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: PREVIEW_TZ });
}

export function nextChicagoYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export function chicagoWallUtc(ymd: string, hour: number, minute: number): Date {
  const [y, mo, d] = ymd.split("-").map(Number) as [number, number, number];
  let utc = Date.UTC(y, mo - 1, d, hour + 5, minute, 0);
  for (let i = 0; i < 4; i++) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: PREVIEW_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(utc));
    const num = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const got = Date.UTC(num("year"), num("month") - 1, num("day"), num("hour"), num("minute"));
    const want = Date.UTC(y, mo - 1, d, hour, minute);
    const delta = want - got;
    if (delta === 0) break;
    utc += delta;
  }
  return new Date(utc);
}

/** Send time through ~1:30am CT the following morning (late West Coast counts). */
export function eveningWindowEnd(now = new Date()): Date {
  const ymd = chicagoYmd(now);
  const oneThirtyToday = chicagoWallUtc(ymd, PREVIEW_WINDOW_END_HOUR, PREVIEW_WINDOW_END_MINUTE);
  if (now.getTime() < oneThirtyToday.getTime()) return oneThirtyToday;
  return chicagoWallUtc(nextChicagoYmd(ymd), PREVIEW_WINDOW_END_HOUR, PREVIEW_WINDOW_END_MINUTE);
}

export function inEveningWindow(startIso: string | null | undefined, now: Date, end = eveningWindowEnd(now)): boolean {
  if (!startIso) return false;
  const t = Date.parse(startIso);
  if (!Number.isFinite(t)) return false;
  return t >= now.getTime() && t <= end.getTime();
}

export function printClock(iso: string | null | undefined): string {
  if (!iso) return "TBA";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBA";
  return d
    .toLocaleTimeString("en-US", { timeZone: PREVIEW_TZ, hour: "numeric", minute: "2-digit" })
    .replace(":00 ", " ");
}

export function printNetworks(tv: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of tv) {
    const name = raw.trim();
    if (!name) continue;
    let mapped: string | null = null;
    for (const row of NETWORKS) {
      if (row.test.test(name)) {
        mapped = row.name;
        break;
      }
    }
    if (!mapped) {
      if (name.length <= 12 && !/\s/.test(name)) mapped = name;
      else continue;
    }
    const key = mapped.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(mapped);
    if (out.length === 2) break;
  }
  return out;
}

export function printReason(game: Pick<PreviewGame, "reasons" | "seriesLine" | "away" | "home" | "league">): string | null {
  const series = game.seriesLine?.trim();
  if (series) return series.length <= 28 ? series : series.slice(0, 27);
  const awayR = game.away.rank;
  const homeR = game.home.rank;
  if (awayR && homeR && awayR <= 10 && homeR <= 10) return "Top-10 clash";
  for (const r of game.reasons) {
    if (/playoff|series|october|world series|alcs|nlcs|wild card|pennant/i.test(r)) return r;
  }
  for (const r of game.reasons) {
    if (/rivalry/i.test(r)) return r.length <= 28 ? r : "Rivalry";
  }
  if (awayR && homeR) return "Ranked matchup";
  if ((awayR && awayR <= 10) || (homeR && homeR <= 10)) return "Top-10 team";
  for (const r of game.reasons) {
    if (!SKIP_REASON.test(r) && !/\binterest \d/i.test(r)) return r;
  }
  return null;
}

export function decoratePreviewGame(game: Omit<PreviewGame, "why" | "network">): PreviewGame {
  const networks = printNetworks(game.tv);
  return {
    ...game,
    why: printReason(game),
    network: networks[0] ?? null,
  };
}

export function previewClaimKey(chicagoDate: string): string {
  return `evening-preview:${chicagoDate}`;
}

export function isPreviewUpcoming(game: Pick<PreviewGame, "live" | "final">): boolean {
  return !game.live && !game.final;
}

export function selectEveningPreview(
  games: PreviewGame[],
  now = new Date(),
  limit = PREVIEW_LIMIT,
): PreviewGame[] {
  const end = eveningWindowEnd(now);
  return games
    .filter((g) => isPreviewUpcoming(g) && inEveningWindow(g.startIso, now, end))
    .sort((a, b) => b.heat - a.heat || String(a.startIso ?? "").localeCompare(String(b.startIso ?? "")) || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map((g) => decoratePreviewGame(g));
}

/** Kickoff order for the card. Heat already picked the slate. */
export function sortPreviewForDisplay(games: PreviewGame[]): PreviewGame[] {
  return [...games].sort(
    (a, b) =>
      String(a.startIso ?? "~").localeCompare(String(b.startIso ?? "~")) ||
      b.heat - a.heat ||
      a.id.localeCompare(b.id),
  );
}

export function previewCaption(games: PreviewGame[], chicagoDate: string): string {
  const when = new Date(`${chicagoDate}T18:00:00-05:00`);
  const day = Number.isNaN(when.getTime())
    ? chicagoDate
    : when.toLocaleDateString("en-US", { timeZone: PREVIEW_TZ, weekday: "short", month: "short", day: "numeric" });
  const lines = [
    `Tonight's top games · ${day}`,
    ...games.slice(0, PREVIEW_LIMIT).map((g) => {
      const clock = printClock(g.startIso);
      return `${g.away.abbrev} @ ${g.home.abbrev} · ${clock} CT`;
    }),
  ];
  return lines.join("\n").slice(0, 1000);
}

export function previewGamePath(sport: PreviewSport, eventId: string): string {
  return `/sports/${sport}/game/${eventId}`;
}

export function previewDateLabel(chicagoDate: string): string {
  const noon = new Date(`${chicagoDate}T18:00:00-05:00`);
  if (Number.isNaN(noon.getTime())) return `${chicagoDate} · Central`;
  return `${noon.toLocaleDateString("en-US", {
    timeZone: PREVIEW_TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
  })} · Central`;
}
