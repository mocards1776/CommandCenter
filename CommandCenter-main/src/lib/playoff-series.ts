/**
 * Playoff series copy from data we already fetched.
 * A missing lead or game number is omitted. Nothing here is guessed.
 */

export type PlayoffSeriesFields = {
  /** Caller already knows this competition is a playoff series. */
  playoff: boolean;
  /** "LAD leads 1-0" or ESPN's "LAD lead series 1-0". */
  summary?: string | null;
  gameNumber?: number | null;
  totalGames?: number | null;
  /** "NLDS - Game 2" when the feed has no numeric game number. */
  note?: string | null;
  wins?: number | null;
  losses?: number | null;
  isTied?: boolean | null;
};

const MLB_POSTSEASON_GAME_TYPES = new Set(["F", "D", "L", "W"]);

function finite(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** ESPN writes "lead series"; the card reads "leads series". */
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

/** One line for a card or hero. Null when the feed has no playoff series facts. */
export function formatPlayoffSeriesLine(input: PlayoffSeriesFields): string | null {
  if (!input.playoff) return null;
  const summary = polishSeriesSummary(input.summary) ?? tiedFromCounts(input);
  const game = gameLabel(input);
  if (summary && game) return `${summary} · ${game}`;
  return summary ?? game;
}

/**
 * Keep a feed that already names the series lead. Otherwise take whichever
 * side actually has one, then a bare game number.
 */
export function mergeSeriesLines(primary: string | null, fallback: string | null): string | null {
  if (primary && /leads|tied/i.test(primary)) return primary;
  if (fallback && /leads|tied/i.test(fallback)) return fallback;
  return primary ?? fallback;
}

export type EspnPlayoffCompetition = {
  series?: {
    type?: string | null;
    summary?: string | null;
    totalCompetitions?: number | null;
  } | null;
  notes?: { headline?: string | null }[] | null;
};

/** ESPN scoreboard competition. Only `series.type === "playoff"` is a series. */
export function seriesLineFromEspn(comp: EspnPlayoffCompetition | null | undefined): string | null {
  const series = comp?.series;
  if (!series || series.type !== "playoff") return null;
  const note = (comp?.notes ?? []).map((n) => n.headline).find((h) => h && h.trim()) ?? null;
  return formatPlayoffSeriesLine({
    playoff: true,
    summary: series.summary,
    totalGames: series.totalCompetitions,
    note,
  });
}

export type MlbPlayoffScheduleGame = {
  gameType?: string | null;
  seriesGameNumber?: number | null;
  gamesInSeries?: number | null;
  seriesStatus?: {
    result?: string | null;
    shortDescription?: string | null;
    gameNumber?: number | null;
    totalGames?: number | null;
    wins?: number | null;
    losses?: number | null;
    isTied?: boolean | null;
  } | null;
};

/** MLB schedule row. Regular-season games stay blank even if a note is present. */
export function seriesLineFromMlb(game: MlbPlayoffScheduleGame | null | undefined): string | null {
  const gameType = game?.gameType ?? "";
  if (!MLB_POSTSEASON_GAME_TYPES.has(gameType)) return null;
  const status = game?.seriesStatus;
  return formatPlayoffSeriesLine({
    playoff: true,
    summary: status?.result,
    gameNumber: status?.gameNumber ?? game?.seriesGameNumber,
    totalGames: status?.totalGames ?? game?.gamesInSeries,
    note: status?.shortDescription,
    wins: status?.wins,
    losses: status?.losses,
    isTied: status?.isTied,
  });
}
