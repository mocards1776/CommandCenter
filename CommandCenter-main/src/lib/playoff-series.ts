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

export type PlayoffElimination = {
  /** 1 = one club is out with a loss today; 2 = winner-take-all. */
  facing: 1 | 2;
};

export type PlayoffEliminationInput = {
  /** Card line, e.g. "CWS leads 2-0 · Game 3 of 5". */
  seriesLine?: string | null;
  summary?: string | null;
  gameNumber?: number | null;
  totalGames?: number | null;
  wins?: number | null;
  losses?: number | null;
  isTied?: boolean | null;
};

/**
 * A loss today ends the series for at least one club.
 * Reads the same series facts the card already prints. Nothing is guessed
 * when the lead and series length cannot be read.
 */
export function playoffElimination(input: PlayoffEliminationInput): PlayoffElimination | null {
  const blob = [input.seriesLine, input.summary].filter(Boolean).join(" ");
  const gameMatch = blob.match(/game\s+(\d+)(?:\s+of\s+(\d+))?/i);
  const total = finite(input.totalGames) ?? (gameMatch?.[2] ? Number(gameMatch[2]) : null);
  const gameNumber = finite(input.gameNumber) ?? (gameMatch?.[1] ? Number(gameMatch[1]) : null);

  let leaderWins: number | null = null;
  let trailerWins: number | null = null;

  const tiedMatch = blob.match(/(?:series\s+)?tied\s+(\d+)\s*-\s*(\d+)/i);
  const leadMatch = blob.match(/leads(?:\s+series)?\s+(\d+)\s*-\s*(\d+)/i);
  if (tiedMatch) {
    const a = Number(tiedMatch[1]);
    const b = Number(tiedMatch[2]);
    if (Number.isFinite(a) && Number.isFinite(b) && a === b) {
      leaderWins = a;
      trailerWins = b;
    }
  } else if (leadMatch) {
    const a = Number(leadMatch[1]);
    const b = Number(leadMatch[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      leaderWins = Math.max(a, b);
      trailerWins = Math.min(a, b);
    }
  } else if (input.isTied && finite(input.wins) != null) {
    const wins = finite(input.wins)!;
    const losses = finite(input.losses);
    if (losses == null || losses === wins) {
      leaderWins = wins;
      trailerWins = wins;
    }
  } else if (finite(input.wins) != null && finite(input.losses) != null) {
    leaderWins = Math.max(input.wins!, input.losses!);
    trailerWins = Math.min(input.wins!, input.losses!);
  }

  const winsNeeded = total != null && total > 1 ? Math.ceil(total / 2) : null;
  if (winsNeeded != null && leaderWins != null && trailerWins != null) {
    const trailerOut = leaderWins + 1 >= winsNeeded;
    const leaderOut = trailerWins + 1 >= winsNeeded;
    if (trailerOut && leaderOut) return { facing: 2 };
    if (trailerOut || leaderOut) return { facing: 1 };
    return null;
  }

  if (gameNumber != null && total != null && total > 1 && gameNumber >= total) {
    return { facing: 2 };
  }
  return null;
}
