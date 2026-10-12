/**
 * The club ledger on the Essentials page: every favorite on one agate table,
 * record and place, the last five results as dots, and the week ahead as a
 * calendar — seven day columns with the opponent and the hour in each cell.
 */
import type { ScheduleGame } from "@/lib/sports";
import type { TeamInfobox } from "@/lib/newspaper-sports";

export type LedgerCell = {
  /** "vs CBJ" / "@ OTT". */
  label: string;
  /** "6:00 PM", "TBA", or the result "W 4–0". */
  when: string;
  won: boolean | null;
  /** The result is in. */
  done: boolean;
  live: boolean;
};

export type LedgerDot = { won: boolean | null; title: string };

export type LedgerRow = {
  key: string;
  name: string;
  league: string;
  logo: string | null;
  color: string | null;
  href: string;
  record: string | null;
  standing: string | null;
  form: LedgerDot[];
  cells: (LedgerCell | null)[];
  /** What the club does next when nothing lands inside the week. */
  next: string;
};

export type LedgerDay = { date: string; weekday: string; monthDay: string; today: boolean };

export type ClubLedger = { days: LedgerDay[]; rows: LedgerRow[] };

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function isoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number) as [number, number, number];
  const [by, bm, bd] = b.split("-").map(Number) as [number, number, number];
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return isoDate(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/**
 * The calendar date and hour printed in a schedule's `when` ("Sat, Oct 10,
 * 6:00 PM", "Sat, Oct 31"), read against the edition date so a December
 * paper puts "Jan 3" in the new year. Falls back to the ISO start's date.
 */
export function gameDate(
  game: Pick<ScheduleGame, "when" | "startIso">,
  editionDate: string,
): { date: string; time: string | null } | null {
  const m = game.when?.match(/^(?:[A-Za-z]{3},?\s+)?([A-Za-z]{3})\.?\s+(\d{1,2})(?:,?\s+(\d{1,2}:\d{2}\s*[AP]M))?/i);
  if (m) {
    const month = MONTHS[m[1]!.toLowerCase()];
    const dayNum = Number(m[2]);
    if (month && dayNum >= 1 && dayNum <= 31) {
      const year = Number(editionDate.slice(0, 4));
      let best = isoDate(year, month, dayNum);
      for (const y of [year - 1, year + 1]) {
        const alt = isoDate(y, month, dayNum);
        if (Math.abs(daysBetween(editionDate, alt)) < Math.abs(daysBetween(editionDate, best))) best = alt;
      }
      return { date: best, time: m[3] ? m[3].replace(/\s+/g, " ").toUpperCase() : null };
    }
  }
  if (game.startIso) {
    const d = new Date(game.startIso);
    if (!Number.isNaN(d.getTime())) return { date: d.toISOString().slice(0, 10), time: null };
  }
  return null;
}

function weekday(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}

function monthDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** "7th in National League Central" → "7th · NL Central". */
export function shortStanding(standing: string | null | undefined): string | null {
  if (!standing) return null;
  const m = standing.match(/^(\d+(?:st|nd|rd|th))\s+in\s+(.+)$/i);
  if (!m) return standing;
  const group = m[2]!
    .replace(/\bNational League\b/i, "NL")
    .replace(/\bAmerican League\b/i, "AL")
    .replace(/\bEnglish League Championship\b/i, "Championship")
    .replace(/\bEnglish Premier League\b/i, "Premier League")
    .replace(/\s+Division$/i, "")
    .trim();
  return `${m[1]} · ${group}`;
}

/** "4–6" with won=false → "L 4–6". */
export function resultLine(game: Pick<ScheduleGame, "detail" | "won">): string {
  const score = (game.detail ?? "").trim();
  const letter = game.won === true ? "W" : game.won === false ? (/^(\d+)[–-](\d+)$/.test(score) && isDraw(score) ? "D" : "L") : "";
  return [letter, score].filter(Boolean).join(" ") || "Final";
}

function isDraw(score: string): boolean {
  const m = score.match(/^(\d+)[–-](\d+)$/);
  return m != null && m[1] === m[2];
}

function shortWhen(when: string | null | undefined): string {
  if (!when) return "";
  return when.replace(/^[A-Za-z]{3},?\s+/, "").replace(/,\s*\d{1,2}:\d{2}\s*[AP]M.*$/i, "");
}

export function buildClubLedger(teams: TeamInfobox[], editionDate: string, span = 7): ClubLedger {
  const days: LedgerDay[] = Array.from({ length: span }, (_, i) => {
    const date = shiftDate(editionDate, i);
    return { date, weekday: i === 0 ? "Today" : weekday(date), monthDay: monthDay(date), today: i === 0 };
  });
  const last = days[days.length - 1]!.date;
  const rows: LedgerRow[] = teams.map((t) => {
    const detail = t.detail;
    const cells: (LedgerCell | null)[] = days.map(() => null);
    const place = (date: string) => daysBetween(editionDate, date);
    const played = [...(detail?.recent ?? [])]
      .map((g) => ({ g, at: gameDate(g, editionDate) }))
      .filter((x): x is { g: ScheduleGame; at: { date: string; time: string | null } } => x.at != null)
      .sort((a, b) => a.at.date.localeCompare(b.at.date));
    for (const { g, at } of played) {
      const i = place(at.date);
      if (i < 0 || i >= span) continue;
      cells[i] = { label: g.label, when: g.live ? g.status || "Live" : resultLine(g), won: g.won, done: !g.live, live: g.live };
    }
    const coming = [...(detail?.upcoming ?? [])]
      .map((g) => ({ g, at: gameDate(g, editionDate) }))
      .filter((x): x is { g: ScheduleGame; at: { date: string; time: string | null } } => x.at != null)
      .sort((a, b) => a.at.date.localeCompare(b.at.date));
    for (const { g, at } of coming) {
      const i = place(at.date);
      if (i < 0 || i >= span || cells[i]) continue;
      cells[i] = { label: g.label, when: g.live ? g.status || "Live" : (at.time ?? "TBA"), won: null, done: false, live: g.live };
    }
    const form: LedgerDot[] = played
      .slice(-5)
      .map(({ g }) => ({ won: isDraw(g.detail ?? "") ? null : g.won, title: `${g.label} · ${resultLine(g)}` }));
    let next = "";
    if (t.seasonState === "complete") next = "Season complete";
    else if (!cells.some(Boolean)) {
      const after = coming.find(({ at }) => at.date > last) ?? coming[0];
      if (after) next = `${shortWhen(after.g.when) || monthDay(after.at.date)} · ${after.g.label}`;
      else if (t.snap.nextGame) next = [shortWhen(t.snap.nextGame.when), t.snap.nextGame.label].filter(Boolean).join(" · ");
      else next = "Idle this week";
    }
    const standing = shortStanding(detail?.standing ?? t.snap.standing);
    return {
      key: t.fav.key,
      name: t.fav.shortName,
      league: t.fav.league,
      logo: t.snap.logo || detail?.logo || null,
      color: t.snap.color || t.fav.color || null,
      href: t.href,
      record: detail?.division?.find((r) => r.isMe)?.record || detail?.record || t.snap.record || null,
      standing,
      form,
      cells,
      next,
    };
  });
  // Clubs with a game this week lead, in the reader's order; idle clubs close the board,
  // so a short page loses an idle row before a game.
  const busy = rows.filter((r) => r.cells.some(Boolean));
  const idle = rows.filter((r) => !r.cells.some(Boolean));
  return { days, rows: [...busy, ...idle] };
}
