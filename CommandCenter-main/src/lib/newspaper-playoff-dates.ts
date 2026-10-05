/**
 * Series-by-series lines for the Times playoff desk. Dates always print;
 * the zone is Central, labeled CT (never CDT/CST).
 */

const CT = "America/Chicago";

function asCtDate(isoDay: string | null | undefined): Date | null {
  if (!isoDay) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDay)) return new Date(`${isoDay}T12:00:00-05:00`);
  const d = new Date(isoDay);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatPlayoffDate(isoDay: string | null | undefined): string | null {
  const d = asCtDate(isoDay);
  if (!d) return null;
  const weekday = d.toLocaleDateString("en-US", { weekday: "short", timeZone: CT });
  const month = d.toLocaleDateString("en-US", { month: "numeric", timeZone: CT });
  const day = d.toLocaleDateString("en-US", { day: "numeric", timeZone: CT });
  return `${weekday} ${month}/${day}`;
}

/** "7:00 PM CDT" / "7:00 PM CST" → "7:00 PM CT". Leaves TBD / if nec. alone. */
export function formatPlayoffClock(when: string | null | undefined): string | null {
  if (!when) return null;
  const trimmed = when.trim();
  if (!trimmed) return null;
  if (/\b(tbd|if nec)/i.test(trimmed) && !/\d/.test(trimmed)) return trimmed;
  return trimmed
    .replace(/\bC[DS]T\b/g, "CT")
    .replace(/\b(?:EDT|EST|MDT|MST|PDT|PST)\b/g, "CT");
}

export function playoffGameStamp(game: {
  date?: string | null;
  when?: string | null;
}): string | null {
  const day = formatPlayoffDate(game.date);
  const clock = formatPlayoffClock(game.when);
  if (day && clock && !clock.includes(day) && !/^[A-Za-z]{3}\s/.test(clock)) {
    return `${day} · ${clock}`;
  }
  if (day && clock && /tbd|if nec/i.test(clock) && !/[A-Za-z]{3}\s+\d/.test(clock)) {
    return `${day} · ${clock}`;
  }
  return day || clock || null;
}

export function formatSeriesGameLine(
  game: {
    gameNumber: number;
    date?: string | null;
    when?: string | null;
    final?: boolean;
    live?: boolean;
    awayScore?: number | null;
    homeScore?: number | null;
    status?: string | null;
  },
  awayAbbrev: string,
  homeAbbrev: string,
): string {
  const tag = `G${game.gameNumber}`;
  if (game.final || game.live) {
    const day = formatPlayoffDate(game.date);
    const score = `${awayAbbrev} ${game.awayScore ?? 0}, ${homeAbbrev} ${game.homeScore ?? 0}`;
    const live = game.live && game.status ? ` · ${game.status}` : "";
    return day ? `${tag} ${day} · ${score}${live}` : `${tag} · ${score}${live}`;
  }
  const stamp = playoffGameStamp(game);
  return stamp ? `${tag} ${stamp}` : tag;
}
