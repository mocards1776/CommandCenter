/**
 * Shared helpers for the Telegram phone cards (A1 flag, weather, The Day Ahead, watch).
 * These routes are only opened by the screenshot runner — the printed paper
 * does not import this file.
 */
import { PRESS_HOURS } from "./newspaper.ts";
import { scheduleDateFor, type DayEvent, type DaySchedule } from "./newspaper-day-ahead.ts";
import type { WatchGame } from "./newspaper-watch.ts";

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

/** Realistic stand-in if today's RUWT slate is empty. */
export function sampleWatchGames(): WatchGame[] {
  return [
    {
      id: "mlb-sample-1",
      league: "MLB",
      competition: null,
      away: { name: "St. Louis Cardinals", abbrev: "STL", logo: "https://www.mlbstatic.com/team-logos/138.svg", record: "83-79" },
      home: { name: "Chicago Cubs", abbrev: "CHC", logo: "https://www.mlbstatic.com/team-logos/112.svg", record: "92-70" },
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
      away: { name: "Kansas City Chiefs", abbrev: "KC", logo: null, record: "4-1" },
      home: { name: "Jacksonville Jaguars", abbrev: "JAX", logo: null, record: "3-2" },
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
      away: { name: "Missouri", abbrev: "MIZ", logo: null, record: "5-1", rank: 21 },
      home: { name: "Alabama", abbrev: "BAMA", logo: null, record: "5-1", rank: 8 },
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
      away: { name: "St. Louis Blues", abbrev: "STL", logo: null, record: "2-1-0" },
      home: { name: "Dallas Stars", abbrev: "DAL", logo: null, record: "2-1-1" },
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
