/**
 * Flat Times: a filed edition is a stack of page images, not a live layout.
 * The flag defaults off. `?flat=1` forces it on and `?flat=0` forces it off.
 */

export const FLAT_BUCKET = "times-flat";
/** All editions whose dateline falls on this day or the previous six. */
export const FLAT_RETENTION_DAYS = 7;

export type FlatHotspot = {
  /** Fractions of the page image, top-left origin. */
  x: number;
  y: number;
  w: number;
  h: number;
  href: string | null;
  folio: string | null;
  label: string;
};

export type FlatPage = {
  folio: string;
  kind: string;
  index: number;
  section: string;
  url: string;
  width: number;
  height: number;
  cssWidth: number;
  cssHeight: number;
  bytes: number;
  hotspots: FlatHotspot[];
};

export type FlatManifest = {
  issueId: string;
  printedAt: string;
  geometry: {
    cssWidth: number;
    cssViewportHeight: number;
    dpr: number;
    pageW: number;
  };
  pages: FlatPage[];
};

/** Edition id the flat reader should open, including a test publish such as `2026-10-07-evening-test`. */
export function flatEditionAsk(raw: string | null | undefined, fallback: string): string {
  if (raw && /^\d{4}-\d{2}-\d{2}-(?:morning|midday|evening)(?:-test)?$/.test(raw)) return raw;
  return fallback;
}

export function flatRequested(search: string, envFlag?: string): boolean {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("flat");
  if (q === "1" || q === "true") return true;
  if (q === "0" || q === "false") return false;
  return envFlag === "1";
}

export function flatManifestUrl(supabaseUrl: string, issueId: string): string {
  const base = supabaseUrl.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${FLAT_BUCKET}/${issueId}/manifest.json`;
}

export function flatEditionDate(issueId: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})-(?:morning|midday|evening)$/.exec(issueId);
  return match ? match[1]! : null;
}

function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

/** First dateline still kept, inclusive. Today and the previous six days. */
export function flatKeepFrom(today: string, days = FLAT_RETENTION_DAYS): string {
  return addDays(today, -(days - 1));
}

export function flatEditionExpired(issueId: string, today: string, days = FLAT_RETENTION_DAYS): boolean {
  const day = flatEditionDate(issueId);
  if (!day) return false;
  return day < flatKeepFrom(today, days);
}

export function isFlatManifest(value: unknown): value is FlatManifest {
  if (!value || typeof value !== "object") return false;
  const row = value as FlatManifest;
  return typeof row.issueId === "string" && Array.isArray(row.pages) && row.pages.length > 0 && typeof row.pages[0]?.url === "string";
}
