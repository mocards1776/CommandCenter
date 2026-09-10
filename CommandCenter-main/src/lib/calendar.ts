/** Google Calendar / iCal agenda for Thompson Times. */

import { todayStr } from "./utils";

const STORAGE_KEY = "thompson-times-ical-urls";

export type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date | null;
  allDay: boolean;
  location: string | null;
  calendar: string | null;
};

export function getCalendarIcalUrls(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map(String).map((s) => s.trim()).filter(Boolean);
      }
    }
  } catch {
    /* ignore */
  }
  const env = import.meta.env.VITE_CALENDAR_ICAL_URLS as string | undefined;
  if (env?.trim()) {
    return env
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function setCalendarIcalUrls(urls: string[]): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(urls.map((u) => u.trim()).filter(Boolean)),
  );
}

function unfoldIcs(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}

function icsUnescape(s: string): string {
  return s
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

/** Parse ICS floating / UTC / offset timestamps into Date. */
function parseIcsDate(raw: string, params: string): { date: Date; allDay: boolean } {
  const allDay = /VALUE=DATE/i.test(params) || /^\d{8}$/.test(raw);
  if (allDay) {
    const y = Number(raw.slice(0, 4));
    const m = Number(raw.slice(4, 6)) - 1;
    const d = Number(raw.slice(6, 8));
    return { date: new Date(y, m, d, 12, 0, 0, 0), allDay: true };
  }
  // 20260910T125000Z or 20260910T075000
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) return { date: new Date(raw), allDay: false };
  const [, ys, mos, ds, hs, mins, ss, z] = m;
  if (z) {
    return {
      date: new Date(Date.UTC(+ys!, +mos! - 1, +ds!, +hs!, +mins!, +ss!)),
      allDay: false,
    };
  }
  return {
    date: new Date(+ys!, +mos! - 1, +ds!, +hs!, +mins!, +ss!),
    allDay: false,
  };
}

function dayKey(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

export function parseIcsEvents(ics: string, calendarLabel?: string | null): CalendarEvent[] {
  const text = unfoldIcs(ics);
  const blocks = text.split(/BEGIN:VEVENT/i).slice(1);
  const out: CalendarEvent[] = [];

  for (const block of blocks) {
    const body = block.split(/END:VEVENT/i)[0] ?? "";
    const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
    let uid = "";
    let title = "Untitled";
    let location: string | null = null;
    let start: Date | null = null;
    let end: Date | null = null;
    let allDay = false;

    for (const line of lines) {
      const colon = line.indexOf(":");
      if (colon < 0) continue;
      const left = line.slice(0, colon);
      const value = line.slice(colon + 1);
      const [prop, ...paramParts] = left.split(";");
      const params = paramParts.join(";");
      const key = prop.toUpperCase();

      if (key === "UID") uid = value;
      else if (key === "SUMMARY") title = icsUnescape(value);
      else if (key === "LOCATION") location = icsUnescape(value) || null;
      else if (key === "DTSTART") {
        const parsed = parseIcsDate(value, params);
        start = parsed.date;
        allDay = parsed.allDay;
      } else if (key === "DTEND") {
        const parsed = parseIcsDate(value, params);
        end = parsed.date;
      }
    }

    if (!start) continue;
    out.push({
      id: uid || `${title}-${start.toISOString()}`,
      title,
      start,
      end,
      allDay,
      location,
      calendar: calendarLabel ?? null,
    });
  }

  return out;
}

async function fetchIcalText(url: string): Promise<string> {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (base && key) {
    try {
      const res = await fetch(`${base}/functions/v1/ical`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          apikey: key,
        },
        body: JSON.stringify({ url }),
      });
      if (res.ok) {
        const data = (await res.json()) as { text?: string; error?: string };
        if (data.text) return data.text;
      }
    } catch {
      /* fall through */
    }
  }

  // Browser CORS fallback (works for some hosts; Google private ICS usually needs the edge proxy).
  const proxied = `https://corsproxy.io/?${encodeURIComponent(url)}`;
  const res = await fetch(proxied);
  if (!res.ok) throw new Error(`Calendar fetch failed (${res.status})`);
  return await res.text();
}

function labelFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "Calendar";
  }
}

/** Today's (+ optional tomorrow) events from configured iCal feeds. */
export async function fetchCalendarAgenda(opts?: {
  days?: number;
}): Promise<{ events: CalendarEvent[]; days: string[]; sourceCount: number }> {
  const urls = getCalendarIcalUrls();
  const days = Math.max(1, opts?.days ?? 2);
  const startDay = todayStr();
  const want = new Set<string>();
  for (let i = 0; i < days; i++) {
    const d = new Date(`${startDay}T12:00:00`);
    d.setDate(d.getDate() + i);
    want.add(dayKey(d));
  }

  if (!urls.length) {
    return { events: [], days: [...want], sourceCount: 0 };
  }

  const chunks = await Promise.all(
    urls.map(async (url) => {
      try {
        const text = await fetchIcalText(url);
        return parseIcsEvents(text, labelFromUrl(url));
      } catch {
        return [] as CalendarEvent[];
      }
    }),
  );

  const events = chunks
    .flat()
    .filter((e) => want.has(dayKey(e.start)))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  // De-dupe recurring / multi-feed copies
  const seen = new Set<string>();
  const unique = events.filter((e) => {
    const k = `${e.title}|${e.start.toISOString()}|${e.allDay}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return { events: unique, days: [...want], sourceCount: urls.length };
}

export function formatEventTime(e: CalendarEvent): string {
  if (e.allDay) return "All day";
  return e.start.toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
  });
}
