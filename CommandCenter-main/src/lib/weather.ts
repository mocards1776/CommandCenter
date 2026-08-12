/** Open-Meteo weather for a US ZIP (default: Marshfield / 65706). */

export const DEFAULT_WEATHER_ZIP = "65706";

export type ZipWeather = {
  zip: string;
  label: string;
  latitude: number;
  longitude: number;
  timezone: string;
  current: {
    tempF: number;
    feelsLikeF: number;
    humidity: number;
    windMph: number;
    code: number;
    summary: string;
    observedAt: string | null;
  };
  daily: {
    date: string;
    highF: number;
    lowF: number;
    precipChance: number;
    code: number;
    summary: string;
  }[];
};

function wmoSummary(code: number): string {
  if (code === 0) return "Clear";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Showers";
  if (code >= 85 && code <= 86) return "Snow showers";
  if (code >= 95) return "Thunderstorm";
  return "Fair";
}

async function geocodeZip(zip: string): Promise<{
  latitude: number;
  longitude: number;
  label: string;
  timezone: string;
}> {
  const zipRes = await fetch(`https://api.zippopotam.us/us/${encodeURIComponent(zip)}`);
  if (zipRes.ok) {
    const data = (await zipRes.json()) as {
      "post code"?: string;
      places?: { "place name"?: string; state?: string; latitude?: string; longitude?: string }[];
    };
    const place = data.places?.[0];
    if (place?.latitude && place?.longitude) {
      return {
        latitude: Number(place.latitude),
        longitude: Number(place.longitude),
        label: [place["place name"], place.state].filter(Boolean).join(", ") || zip,
        timezone: "America/Chicago",
      };
    }
  }

  const om = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(zip)}&count=1&language=en&format=json`,
  );
  if (!om.ok) throw new Error(`Geocode failed (${om.status})`);
  const body = (await om.json()) as {
    results?: { name?: string; admin1?: string; latitude?: number; longitude?: number; timezone?: string }[];
  };
  const hit = body.results?.[0];
  if (!hit?.latitude || !hit?.longitude) throw new Error(`No location for ZIP ${zip}`);
  return {
    latitude: hit.latitude,
    longitude: hit.longitude,
    label: [hit.name, hit.admin1].filter(Boolean).join(", ") || zip,
    timezone: hit.timezone || "America/Chicago",
  };
}

export async function fetchZipWeather(zip = DEFAULT_WEATHER_ZIP): Promise<ZipWeather> {
  const cleaned = zip.trim() || DEFAULT_WEATHER_ZIP;
  const geo = await geocodeZip(cleaned);
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}` +
    `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=${encodeURIComponent(geo.timezone)}` +
    `&forecast_days=3`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather failed (${res.status})`);
  const data = (await res.json()) as {
    current?: {
      time?: string;
      temperature_2m?: number;
      apparent_temperature?: number;
      weather_code?: number;
      wind_speed_10m?: number;
      relative_humidity_2m?: number;
    };
    daily?: {
      time?: string[];
      weather_code?: number[];
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
      precipitation_probability_max?: number[];
    };
  };
  const code = data.current?.weather_code ?? 0;
  const daily: ZipWeather["daily"] = [];
  const days = data.daily?.time?.length ?? 0;
  for (let i = 0; i < days; i++) {
    const dCode = data.daily?.weather_code?.[i] ?? 0;
    daily.push({
      date: data.daily!.time![i]!,
      highF: Math.round(data.daily?.temperature_2m_max?.[i] ?? 0),
      lowF: Math.round(data.daily?.temperature_2m_min?.[i] ?? 0),
      precipChance: data.daily?.precipitation_probability_max?.[i] ?? 0,
      code: dCode,
      summary: wmoSummary(dCode),
    });
  }
  return {
    zip: cleaned,
    label: geo.label,
    latitude: geo.latitude,
    longitude: geo.longitude,
    timezone: geo.timezone,
    current: {
      tempF: Math.round(data.current?.temperature_2m ?? 0),
      feelsLikeF: Math.round(data.current?.apparent_temperature ?? 0),
      humidity: data.current?.relative_humidity_2m ?? 0,
      windMph: Math.round(data.current?.wind_speed_10m ?? 0),
      code,
      summary: wmoSummary(code),
      observedAt: data.current?.time ?? null,
    },
    daily,
  };
}
