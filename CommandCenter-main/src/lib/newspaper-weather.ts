/**
 * The Marshfield weather report: today's sky, the next 24 hours, ten days out,
 * and the almanac (sun, moon, yesterday's readings) — all from Open-Meteo.
 */

export const MARSHFIELD = {
  place: "Marshfield, Mo.",
  county: "Webster County",
  latitude: 37.3387,
  longitude: -92.9071,
  timezone: "America/Chicago",
} as const;

export type Sky =
  | "sun"
  | "moon"
  | "partly"
  | "partly-night"
  | "cloud"
  | "fog"
  | "drizzle"
  | "rain"
  | "showers"
  | "storm"
  | "snow";

export type WxHour = { time: string; tempF: number; precipChance: number; code: number; sky: Sky };

export type WxDay = {
  date: string;
  highF: number;
  lowF: number;
  precipChance: number;
  precipIn: number;
  code: number;
  sky: Sky;
  summary: string;
  sunrise: string | null;
  sunset: string | null;
  uv: number | null;
  windMaxMph: number | null;
};

export type MarshfieldWeather = {
  observedAt: string;
  current: {
    tempF: number;
    feelsLikeF: number;
    humidity: number;
    dewPointF: number;
    windMph: number;
    gustMph: number;
    windFrom: string;
    pressureIn: number;
    code: number;
    sky: Sky;
    summary: string;
    isDay: boolean;
  };
  /** The next 24 hours, starting with the current one. */
  hours: WxHour[];
  /** Today first. */
  days: WxDay[];
  yesterday: { highF: number; lowF: number; precipIn: number } | null;
};

export function skyOf(code: number, isDay = true): Sky {
  if (code <= 1) return isDay ? "sun" : "moon";
  if (code === 2) return isDay ? "partly" : "partly-night";
  if (code === 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if ((code >= 61 && code <= 67) || code === 80) return code === 80 ? "showers" : "rain";
  if (code >= 81 && code <= 82) return "showers";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return isDay ? "partly" : "partly-night";
}

/** Forecast-desk wording for a WMO code. */
export function summaryOf(code: number, isDay = true): string {
  if (code === 0) return isDay ? "Sunny" : "Clear";
  if (code === 1) return isDay ? "Mostly sunny" : "Mostly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Cloudy";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code === 61 || code === 80) return "Light rain";
  if (code >= 62 && code <= 67) return "Rain";
  if (code >= 81 && code <= 82) return "Showers";
  if (code >= 71 && code <= 77) return "Snow";
  if (code === 85 || code === 86) return "Snow showers";
  if (code >= 95) return "Thunderstorms";
  return "Fair";
}

const POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

export function compass(deg: number): string {
  return POINTS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16]!;
}

/** "2026-10-01T07:05" (local) → "7:05 a.m." */
export function clock(local: string | null | undefined): string {
  const m = local?.match(/T(\d{2}):(\d{2})/);
  if (!m) return "—";
  const h = Number(m[1]);
  const hour = h % 12 || 12;
  return `${hour}:${m[2]} ${h < 12 ? "a.m." : "p.m."}`;
}

/** "2026-10-01T15:00" → "3 p.m."; midnight and noon by name. */
export function hourLabel(local: string): string {
  const h = Number(local.slice(11, 13));
  if (h === 0) return "Mid.";
  if (h === 12) return "Noon";
  return `${h % 12} ${h < 12 ? "a.m." : "p.m."}`;
}

export function dayLength(sunrise: string | null, sunset: string | null): string | null {
  const mins = (s: string | null) => {
    const m = s?.match(/T(\d{2}):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const a = mins(sunrise);
  const b = mins(sunset);
  if (a == null || b == null || b <= a) return null;
  const d = b - a;
  return `${Math.floor(d / 60)} hr ${d % 60} min`;
}

export function uvWord(uv: number | null): string {
  if (uv == null) return "—";
  if (uv < 3) return "Low";
  if (uv < 6) return "Moderate";
  if (uv < 8) return "High";
  if (uv < 11) return "Very high";
  return "Extreme";
}

const SYNODIC = 29.530588853;
const NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14);

/** Phase on the given day (noon UTC): its name, fraction lit and whether it is growing. */
export function moonPhase(day: string): { name: string; lit: number; waxing: boolean; age: number } {
  const [y, m, d] = day.slice(0, 10).split("-").map(Number) as [number, number, number];
  const days = (Date.UTC(y, m - 1, d, 12) - NEW_MOON_MS) / 86_400_000;
  const age = ((days % SYNODIC) + SYNODIC) % SYNODIC;
  const lit = (1 - Math.cos((2 * Math.PI * age) / SYNODIC)) / 2;
  const waxing = age < SYNODIC / 2;
  let name: string;
  if (age < 1.2 || age > SYNODIC - 1.2) name = "New moon";
  else if (Math.abs(age - SYNODIC / 2) < 1.2) name = "Full moon";
  else if (Math.abs(age - SYNODIC / 4) < 1.2) name = "First quarter";
  else if (Math.abs(age - (3 * SYNODIC) / 4) < 1.2) name = "Last quarter";
  else name = `${waxing ? "Waxing" : "Waning"} ${lit < 0.5 ? "crescent" : "gibbous"}`;
  return { name, lit, waxing, age };
}

function feel(highF: number): string | null {
  if (highF >= 95) return "hot";
  if (highF >= 85) return "very warm";
  if (highF >= 75) return "warm";
  if (highF >= 60) return "pleasant";
  if (highF >= 45) return "cool";
  if (highF >= 32) return "chilly";
  return "cold";
}

/** The forecaster's paragraph for today: "Cloudy, breezy and very warm. High 88. …" */
export function writtenForecast(w: MarshfieldWeather): string {
  const today = w.days[0];
  if (!today) return `${w.current.summary}. ${w.current.tempF}°.`;
  const breezy = (today.windMaxMph ?? w.current.windMph) >= 15;
  const mood = [breezy ? "breezy" : null, feel(today.highF)].filter(Boolean).join(" and ");
  const lead = `${today.summary}${mood ? `, ${mood}` : ""}.`;
  const wind = `Winds ${w.current.windFrom} at ${w.current.windMph} mph${
    w.current.gustMph >= w.current.windMph + 8 ? `, gusting to ${w.current.gustMph}` : ""
  }.`;
  const rain = today.precipChance >= 20 ? ` Chance of rain ${today.precipChance}%.` : "";
  return `${lead} High ${today.highF}. ${wind}${rain}`;
}

/** The front-page ear: today, tonight, tomorrow in one breath. */
export function earForecast(w: MarshfieldWeather): string {
  const [today, tomorrow] = w.days;
  if (!today) return `${w.current.summary}, ${w.current.tempF}°.`;
  const night = w.hours.filter((h) => {
    const hr = Number(h.time.slice(11, 13));
    return hr >= 19 || hr <= 5;
  });
  const tonightCode = night.length ? Math.max(...night.map((h) => h.code)) : today.code;
  const parts = [
    `Today, ${today.summary.toLowerCase()}, high ${today.highF}.`,
    `Tonight, ${summaryOf(tonightCode, false).toLowerCase()}, low ${tomorrow?.lowF ?? today.lowF}.`,
  ];
  if (tomorrow) parts.push(`Tomorrow, ${tomorrow.summary.toLowerCase()}, high ${tomorrow.highF}.`);
  return parts.join(" ");
}

type OpenMeteo = {
  current?: Record<string, number | string | undefined>;
  hourly?: { time?: string[]; temperature_2m?: number[]; precipitation_probability?: number[]; weather_code?: number[] };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
    precipitation_sum?: number[];
    sunrise?: string[];
    sunset?: string[];
    uv_index_max?: number[];
    wind_speed_10m_max?: number[];
  };
};

export function parseWeather(data: OpenMeteo): MarshfieldWeather {
  const c = data.current ?? {};
  const num = (k: string) => Number(c[k] ?? 0);
  const isDay = num("is_day") === 1;
  const code = num("weather_code");
  const observedAt = String(c.time ?? "");

  const ht = data.hourly?.time ?? [];
  const nowHour = observedAt.slice(0, 13);
  const start = Math.max(0, ht.findIndex((t) => t.slice(0, 13) === nowHour));
  const hours: WxHour[] = ht.slice(start, start + 24).map((time, j) => {
    const i = start + j;
    const hr = Number(time.slice(11, 13));
    const hc = data.hourly?.weather_code?.[i] ?? 0;
    return {
      time,
      tempF: Math.round(data.hourly?.temperature_2m?.[i] ?? 0),
      precipChance: data.hourly?.precipitation_probability?.[i] ?? 0,
      code: hc,
      sky: skyOf(hc, hr >= 7 && hr < 19),
    };
  });

  const d = data.daily ?? {};
  const all: WxDay[] = (d.time ?? []).map((date, i) => {
    const dc = d.weather_code?.[i] ?? 0;
    return {
      date,
      highF: Math.round(d.temperature_2m_max?.[i] ?? 0),
      lowF: Math.round(d.temperature_2m_min?.[i] ?? 0),
      precipChance: d.precipitation_probability_max?.[i] ?? 0,
      precipIn: d.precipitation_sum?.[i] ?? 0,
      code: dc,
      sky: skyOf(dc),
      summary: summaryOf(dc),
      sunrise: d.sunrise?.[i] ?? null,
      sunset: d.sunset?.[i] ?? null,
      uv: d.uv_index_max?.[i] ?? null,
      windMaxMph: d.wind_speed_10m_max?.[i] != null ? Math.round(d.wind_speed_10m_max[i]!) : null,
    };
  });
  const today = observedAt.slice(0, 10);
  const ti = Math.max(0, all.findIndex((x) => x.date === today));
  const prev = ti > 0 ? all[ti - 1]! : null;

  return {
    observedAt,
    current: {
      tempF: Math.round(num("temperature_2m")),
      feelsLikeF: Math.round(num("apparent_temperature")),
      humidity: Math.round(num("relative_humidity_2m")),
      dewPointF: Math.round(num("dew_point_2m")),
      windMph: Math.round(num("wind_speed_10m")),
      gustMph: Math.round(num("wind_gusts_10m")),
      windFrom: compass(num("wind_direction_10m")),
      pressureIn: Math.round(num("pressure_msl") * 0.02953 * 100) / 100,
      code,
      sky: skyOf(code, isDay),
      summary: summaryOf(code, isDay),
      isDay,
    },
    hours,
    days: all.slice(ti),
    yesterday: prev ? { highF: prev.highF, lowF: prev.lowF, precipIn: prev.precipIn } : null,
  };
}

export async function fetchMarshfieldWeather(): Promise<MarshfieldWeather> {
  const { latitude, longitude, timezone } = MARSHFIELD;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m," +
    "wind_gusts_10m,relative_humidity_2m,dew_point_2m,pressure_msl,is_day" +
    "&hourly=temperature_2m,precipitation_probability,weather_code" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max," +
    "precipitation_sum,sunrise,sunset,uv_index_max,wind_speed_10m_max" +
    "&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch" +
    `&timezone=${encodeURIComponent(timezone)}&forecast_days=10&past_days=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather failed (${res.status})`);
  return parseWeather((await res.json()) as OpenMeteo);
}
