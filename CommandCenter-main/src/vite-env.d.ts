/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_WEATHER_LAT?: string;
  readonly VITE_WEATHER_LON?: string;
  readonly VITE_WEATHER_TZ?: string;
  readonly VITE_WEATHER_LABEL?: string;
  readonly VITE_VISUAL_CROSSING_API_KEY?: string;
  /** Absolute origin for minted client story URLs (no trailing slash). */
  readonly VITE_CLIENT_SHARE_ORIGIN?: string;
  readonly VITE_PUBLIC_CLIENT_SHARE_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
