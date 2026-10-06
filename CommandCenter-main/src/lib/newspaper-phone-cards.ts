/**
 * Shared helpers for the Telegram phone cards (A1 flag, weather, The Day Ahead, watch).
 * These routes are only opened by the screenshot runner — the printed paper
 * does not import this file.
 */
import { PRESS_HOURS } from "./newspaper.ts";
import { scheduleDateFor, type DayEvent, type DaySchedule } from "./newspaper-day-ahead.ts";
import { buildEdition, type FavoritesFrontPage } from "./newspaper-sections.ts";
import type { GameWrapCard } from "./newspaper-sports.ts";
import { sampleWatchSlate, type WatchGame } from "./newspaper-watch-page.ts";

/** Portrait iPhone CSS size. times-shots.mjs clips every alert image to this at 3x. */
export const PHONE_CARD_SIZE = { width: 430, height: 932 } as const;
export const PHONE_CARD_SCALE = 3;
export const PHONE_CARD_PX = {
  width: PHONE_CARD_SIZE.width * PHONE_CARD_SCALE,
  height: PHONE_CARD_SIZE.height * PHONE_CARD_SCALE,
} as const;

export type PhoneFrontStory = {
  id: string;
  headline: string;
  teamName: string | null;
  dek: string | null;
  photo: string | null;
};

/** Favorites first, then heat (national / stakes). Used only by the phone watch card. */
export function rankPhoneWatchGames(games: WatchGame[]): WatchGame[] {
  return [...games].sort((a, b) => {
    const fav = Number(Boolean(b.favorite)) - Number(Boolean(a.favorite));
    if (fav) return fav;
    return b.heat - a.heat || String(a.when ?? "").localeCompare(String(b.when ?? "")) || a.id.localeCompare(b.id);
  });
}

export type PhoneWatchFit = { keepRest: number };

export function trimPhoneWatchFit(fit: PhoneWatchFit): PhoneWatchFit | null {
  return fit.keepRest > 0 ? { keepRest: fit.keepRest - 1 } : null;
}

export type PhoneDayFit = { comingDays: number; rundown: number; allDay: number };

export function trimPhoneDayFit(fit: PhoneDayFit): PhoneDayFit | null {
  if (fit.comingDays > 0) return { ...fit, comingDays: fit.comingDays - 1 };
  if (fit.rundown > 1) return { ...fit, rundown: fit.rundown - 1 };
  if (fit.allDay > 0) return { ...fit, allDay: fit.allDay - 1 };
  return null;
}

export type PhoneFrontFit = { stories: number; showDek: boolean; showPhoto: boolean };

export function trimPhoneFrontFit(fit: PhoneFrontFit): PhoneFrontFit | null {
  if (fit.stories > 1) return { ...fit, stories: fit.stories - 1 };
  if (fit.showDek) return { ...fit, showDek: false };
  if (fit.showPhoto) return { ...fit, showPhoto: false };
  return null;
}

export type PhoneWeatherFit = {
  showAlmanac: boolean;
  showToday: boolean;
  days: number;
  showHourly: boolean;
};

export function trimPhoneWeatherFit(fit: PhoneWeatherFit): PhoneWeatherFit | null {
  if (fit.showAlmanac) return { ...fit, showAlmanac: false };
  if (fit.showToday) return { ...fit, showToday: false };
  if (fit.days > 3) return { ...fit, days: fit.days - 1 };
  if (fit.showHourly) return { ...fit, showHourly: false };
  if (fit.days > 1) return { ...fit, days: fit.days - 1 };
  return null;
}

function slimFront(card: GameWrapCard | null | undefined): PhoneFrontStory | null {
  const headline = String(card?.headline ?? "").replace(/\s+/g, " ").trim();
  if (!card || !headline) return null;
  return {
    id: card.id,
    headline,
    teamName: card.teamName ?? null,
    dek: card.dek ? String(card.dek).replace(/\s+/g, " ").trim() : null,
    photo: card.photo ?? null,
  };
}

/** A1 lead + two more, same order the paper sets. Phone card only. */
export function phoneFrontStories(stories: unknown[], edition: string): PhoneFrontStory[] {
  try {
    const paper = buildEdition({ stories: stories as GameWrapCard[], clubs: [], edition });
    const front = paper.pages.find((p) => p.kind === "favorites-front") as FavoritesFrontPage | undefined;
    if (!front) return [];
    return [front.lead, front.second, front.third].map(slimFront).filter((s): s is PhoneFrontStory => Boolean(s));
  } catch {
    return [];
  }
}

export const PHONE_CARD_KINDS = ["front", "weather", "day", "watch"] as const;
export type PhoneCardKind = (typeof PHONE_CARD_KINDS)[number];

const TZ = "America/Chicago";

export function isPhoneCardKind(value: string | null | undefined): value is PhoneCardKind {
  return PHONE_CARD_KINDS.includes(value as PhoneCardKind);
}

/** Central calendar date for an issue id, or today's Central date. */
export function phoneCardDate(issueId: string | null | undefined): string {
  return scheduleDateFor(issueId ?? "") ?? new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

export function phoneCardEditionLabel(issueId: string | null | undefined): string {
  const slot = /-(morning|midday|evening)$/.exec(issueId ?? "")?.[1];
  return PRESS_HOURS.find((p) => p.slot === slot)?.label ?? "Edition";
}

/** Realistic stand-in when public.times_day_schedule has no row (or no table yet). */
export function sampleDaySchedule(date = "2026-10-05"): DaySchedule {
  const ev = (
    start: string | null,
    end: string | null,
    title: string,
    kind: DayEvent["kind"],
    location: string | null = null,
  ): DayEvent => ({
    start,
    end,
    all_day: start == null,
    title,
    kind,
    location,
  });
  return {
    date,
    events: [
      ev(null, null, "Fall break — kids home", "family"),
      ev("07:30", "08:00", "School drop-off", "family", "Marshfield"),
      ev("09:00", "10:00", "Desk standup", "work"),
      ev("11:30", "12:30", "Lunch with Dad", "family", "The Wheelhouse"),
      ev("14:00", "15:30", "Webster County errands", "family"),
      ev("18:00", "19:30", "Dinner", "family"),
    ],
    upcoming: [
      { date: nextDay(date, 1), events: [ev("09:00", "10:30", "Dentist — Maya", "family", "Marshfield")] },
      { date: nextDay(date, 2), events: [ev(null, null, "Columbus Day", "family"), ev("19:00", "21:00", "Cards at Wrigley", "family")] },
      { date: nextDay(date, 3), events: [] },
      { date: nextDay(date, 4), events: [ev("08:00", "09:00", "Staff meeting", "work")] },
      { date: nextDay(date, 5), events: [ev("18:00", null, "Friday pizza", "family")] },
    ],
  };
}

function nextDay(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** A1-shaped stand-in from the 2026-10-05-evening issue (headlines only). */
export function sampleFrontStories(): PhoneFrontStory[] {
  return [
    {
      id: "wire-college-football-401856708",
      headline: "No. 25 Missouri trounces No. 8 Florida 45-17 to snap 9-game skid against Top 25 opponents",
      teamName: "Mizzou FB",
      dek: null,
      photo: null,
    },
    {
      id: "wire-nhl-401892439",
      headline: "Necas and Roy score quick goals as the Avalanche rout the Blues 6-1",
      teamName: "Blues",
      dek: null,
      photo: null,
    },
    {
      id: "wire-nfl-401872978",
      headline: "Young, McMillan connect for 2 TDs to lead Panthers past Lions 32-26",
      teamName: "Lions",
      dek: null,
      photo: null,
    },
  ];
}

/** Full printed slate — more games than a phone card can hold. */
export function sampleHeavyWatchGames(day = "2026-10-05"): WatchGame[] {
  return sampleWatchSlate(day);
}

/** Realistic stand-in if today's RUWT slate is empty. */
export function sampleWatchGames(): WatchGame[] {
  return [
    {
      id: "mlb-sample-1",
      league: "MLB",
      competition: null,
      away: { name: "St. Louis Cardinals", short: "Cardinals", abbrev: "STL", logo: "https://www.mlbstatic.com/team-logos/138.svg", record: "83-79", color: "be0a14" },
      home: { name: "Chicago Cubs", short: "Cubs", abbrev: "CHC", logo: "https://www.mlbstatic.com/team-logos/112.svg", record: "92-70", color: "0e3386" },
      when: "2026-10-05T23:40:00Z",
      status: "7:40 p.m. CT",
      live: false,
      venue: "Wrigley Field",
      tv: ["ESPN", "Bally Sports"],
      heat: 86,
      reasons: ["Rivalry", "Your club", "Playoff race"],
    },
    {
      id: "nfl-sample-1",
      league: "NFL",
      competition: null,
      away: { name: "Kansas City Chiefs", short: "Chiefs", abbrev: "KC", logo: "https://a.espncdn.com/i/teamlogos/nfl/500/kc.png", record: "4-1", color: "e31837" },
      home: { name: "Jacksonville Jaguars", short: "Jaguars", abbrev: "JAX", logo: "https://a.espncdn.com/i/teamlogos/nfl/500/jax.png", record: "3-2", color: "006778" },
      when: "2026-10-06T00:15:00Z",
      status: "7:15 p.m. CT",
      live: false,
      venue: "EverBank Stadium",
      tv: ["ESPN", "ABC"],
      heat: 74,
      reasons: ["Your #1 team", "Primetime"],
    },
    {
      id: "cfb-sample-1",
      league: "CFB",
      competition: null,
      away: { name: "Missouri", short: "Missouri", abbrev: "MIZ", logo: "https://a.espncdn.com/i/teamlogos/ncaa/500/142.png", record: "5-1", rank: 21, color: "f1b82d" },
      home: { name: "Alabama", short: "Alabama", abbrev: "BAMA", logo: "https://a.espncdn.com/i/teamlogos/ncaa/500/333.png", record: "5-1", rank: 8, color: "9e1b32" },
      when: "2026-10-05T16:00:00Z",
      status: "11 a.m. CT",
      live: false,
      venue: "Bryant-Denny Stadium",
      tv: ["ABC"],
      heat: 71,
      reasons: ["Both teams ranked", "SEC"],
    },
    {
      id: "nhl-sample-1",
      league: "NHL",
      competition: null,
      away: { name: "St. Louis Blues", short: "Blues", abbrev: "STL", logo: "https://a.espncdn.com/i/teamlogos/nhl/500/stl.png", record: "2-1-0", color: "002f87" },
      home: { name: "Dallas Stars", short: "Stars", abbrev: "DAL", logo: "https://a.espncdn.com/i/teamlogos/nhl/500/dal.png", record: "2-1-1", color: "006847" },
      when: "2026-10-05T00:00:00Z",
      status: "7 p.m. CT",
      live: false,
      venue: "American Airlines Center",
      tv: ["FanDuel Sports"],
      heat: 58,
      reasons: ["Your club"],
    },
  ];
}
