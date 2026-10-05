/**
 * Playoff series copy for finals cards.
 *
 * Mirrors CommandCenter-main/src/lib/playoff-series.ts so the edge function
 * does not import the app tree. Only ESPN facts already on the summary —
 * nothing is guessed. Regular-season "season series" is ignored.
 */

export type PlayoffSeriesFields = {
  playoff: boolean;
  summary?: string | null;
  gameNumber?: number | null;
  totalGames?: number | null;
  note?: string | null;
  wins?: number | null;
  losses?: number | null;
  isTied?: boolean | null;
};

function finite(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function polishSeriesSummary(raw: string | null | undefined): string | null {
  const text = raw?.replace(/\s+/g, " ").trim() ?? "";
  if (!text) return null;
  if (/tied/i.test(text) && /\b0-0\b/.test(text)) return null;
  return text.replace(/\blead series\b/gi, "leads series");
}

function gameNumberFromNote(note: string | null | undefined): number | null {
  const match = note?.match(/game\s*(\d+)/i);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function tiedFromCounts(input: PlayoffSeriesFields): string | null {
  if (!input.isTied) return null;
  const wins = finite(input.wins);
  if (wins == null || wins <= 0) return null;
  const losses = finite(input.losses);
  if (losses != null && losses !== wins) return null;
  return `Series tied ${wins}-${wins}`;
}

function gameLabel(input: PlayoffSeriesFields): string | null {
  const n = finite(input.gameNumber) ?? gameNumberFromNote(input.note);
  if (n == null || n < 1) return null;
  const total = finite(input.totalGames);
  if (total != null && total > 1) return `Game ${n} of ${total}`;
  return `Game ${n}`;
}

export function formatPlayoffSeriesLine(input: PlayoffSeriesFields): string | null {
  if (!input.playoff) return null;
  const summary = polishSeriesSummary(input.summary) ?? tiedFromCounts(input);
  const game = gameLabel(input);
  if (summary && game) return `${summary} · ${game}`;
  return summary ?? game;
}

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

function seriesBlobs(comp: Rec, body: Rec): Rec[] {
  const fromComp = arr(comp.series).length ? arr(comp.series) : comp.series ? [comp.series] : [];
  return [...fromComp, ...arr(body.seasonseries)].map(rec);
}

function isMlbPostseason(body: Rec): boolean {
  const season = rec(rec(body.header).season);
  return num(season.type) === 3 || /post/i.test(str(season.displayName) || str(season.name));
}

function noteFrom(comp: Rec, series: Rec): string | null {
  const headlines = arr(comp.notes)
    .map((row) => str(rec(row).headline))
    .filter(Boolean);
  return headlines[0] || str(series.seriesLabel) || str(series.title) || null;
}

/**
 * MLB postseason only. NHL/NFL/CFB regular-season series blobs stay off.
 * ESPN's game summary labels the live series `current` and also ships a
 * `playoff` seasonseries row with the same summary.
 */
export function mlbPlayoffFromSummary(sport: string, body: unknown, comp: unknown): {
  playoff: boolean;
  seriesLine: string | null;
} {
  if (sport !== "mlb") return { playoff: false, seriesLine: null };
  const raw = rec(body);
  const competition = rec(comp);
  const blobs = seriesBlobs(competition, raw);
  const playoffRow =
    blobs.find((row) => str(row.type) === "playoff") ??
    (isMlbPostseason(raw) ? blobs.find((row) => str(row.type) === "current") : undefined);
  const postseason = Boolean(playoffRow) || isMlbPostseason(raw);
  if (!postseason) return { playoff: false, seriesLine: null };
  const series = playoffRow ?? {};
  const wins = arr(series.competitors)
    .map((row) => num(rec(row).wins))
    .filter((n): n is number => n != null);
  const line = formatPlayoffSeriesLine({
    playoff: true,
    summary: str(series.summary) || str(series.shortSummary) || null,
    totalGames: num(series.totalCompetitions),
    note: noteFrom(competition, series),
    wins: wins.length ? Math.max(...wins) : null,
    losses: wins.length >= 2 ? Math.min(...wins) : null,
    isTied: /tied/i.test(str(series.summary)) || (wins.length >= 2 && wins[0] === wins[1] && (wins[0] ?? 0) > 0),
  });
  return { playoff: true, seriesLine: line };
}
