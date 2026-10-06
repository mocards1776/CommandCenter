/**
 * ESPN fetches for the Thompson Times press only.
 *
 * Mirrors `espnGet` in sports.ts (site.api → site.web → sports-edge proxy)
 * so the wire, slate, and summary desks survive the same Akamai/CORS walls
 * league news already does. Lives in the newspaper libs so the Sports App
 * fetch is left alone.
 */

const ESPN_API = "https://site.api.espn.com/apis/site/v2/sports";
const ESPN_WEB = "https://site.web.api.espn.com/apis/site/v2/sports";
const ESPN_API_V3 = "https://site.api.espn.com/apis/site/v3/sports";
const ESPN_WEB_V3 = "https://site.web.api.espn.com/apis/site/v3/sports";

export type NewspaperEspnGetOpts = {
  /** League leaders live on the v3 site API; scoreboards stay on v2. */
  site?: 2 | 3;
};

/** Current SEC (ESPN group 8). Kept here so the press bundle does not pull cfb.ts. */
export const NEWSPAPER_CFB_SEC_IDS = new Set([
  "333",
  "8",
  "2",
  "57",
  "61",
  "96",
  "99",
  "145",
  "344",
  "142",
  "201",
  "2579",
  "2633",
  "251",
  "245",
  "238",
]);

/** SEC IDs collide with NFL/NBA/NHL club IDs (Arkansas 8 = Lions 8). CFB path only. */
export function isNewspaperSecGame(
  path: string,
  awayId?: string | null,
  homeId?: string | null,
): boolean {
  if (path !== "football/college-football") return false;
  return Boolean(
    (awayId && NEWSPAPER_CFB_SEC_IDS.has(String(awayId))) ||
      (homeId && NEWSPAPER_CFB_SEC_IDS.has(String(homeId))),
  );
}

export function isNewspaperCfbDeskGame(opts: {
  awayId?: string | null;
  homeId?: string | null;
  awayRank?: number | null;
  homeRank?: number | null;
  favorite?: boolean;
}): boolean {
  if (opts.favorite) return true;
  if (opts.awayId && NEWSPAPER_CFB_SEC_IDS.has(String(opts.awayId))) return true;
  if (opts.homeId && NEWSPAPER_CFB_SEC_IDS.has(String(opts.homeId))) return true;
  const ranked = (n?: number | null) => n != null && Number.isFinite(n) && n > 0 && n <= 25;
  return ranked(opts.awayRank) || ranked(opts.homeRank);
}

function newspaperSupabaseEnv(): { url: string; key: string } | null {
  try {
    const env = (import.meta as { env?: { VITE_SUPABASE_URL?: string; VITE_SUPABASE_ANON_KEY?: string } }).env;
    const url = env?.VITE_SUPABASE_URL;
    const key = env?.VITE_SUPABASE_ANON_KEY;
    if (url && key) return { url, key };
  } catch {
    /* Node / tests have no Vite env */
  }
  return null;
}

function abortAfter(ms: number): { signal: AbortSignal; clear: () => void } {
  const ctl = new AbortController();
  const t = globalThis.setTimeout(() => ctl.abort(), ms);
  return { signal: ctl.signal, clear: () => globalThis.clearTimeout(t) };
}

async function espnViaSportsProxy(clean: string): Promise<unknown> {
  const env = newspaperSupabaseEnv();
  if (env) {
    try {
      const { signal, clear } = abortAfter(20_000);
      try {
        const res = await fetch(`${env.url}/functions/v1/sports`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.key}`,
            apikey: env.key,
          },
          body: JSON.stringify({ path: clean }),
          signal,
        });
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data === "object" && !(data as { error?: string }).error) {
            return data;
          }
        }
      } finally {
        clear();
      }
    } catch {
      /* invoke next */
    }
    try {
      const { supabase } = await import("./supabase.ts");
      const { data, error } = await supabase.functions.invoke("sports", {
        body: { path: clean },
      });
      if (error) throw new Error(error.message);
      if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
        throw new Error(String((data as { error: string }).error));
      }
      return data;
    } catch (err) {
      if (err instanceof Error && /ESPN |failed|error/i.test(err.message) && !/Missing VITE_/.test(err.message)) {
        throw err;
      }
    }
  }
  throw new Error(`ESPN ${clean} failed`);
}

/** ESPN site API with the same hosts, headers, timeouts, and proxy fallback as espnGet. */
export async function newspaperEspnGet(path: string, opts?: NewspaperEspnGetOpts): Promise<unknown> {
  const clean = path.replace(/^\/+/, "");
  const headers = { Accept: "application/json" };
  const hosts = opts?.site === 3 ? [ESPN_WEB_V3, ESPN_API_V3, ESPN_API, ESPN_WEB] : [ESPN_API, ESPN_WEB];
  // The sports-edge proxy first: browsers on localhost are CORS-blocked from
  // site.api, and waiting 12s per host starves the A1 lead recap.
  try {
    return await espnViaSportsProxy(clean);
  } catch {
    /* fall through to the public hosts */
  }
  for (const host of hosts) {
    try {
      const { signal, clear } = abortAfter(12_000);
      try {
        const res = await fetch(`${host}/${clean}`, { signal, headers });
        if (!res.ok) continue;
        const data = await res.json();
        if (data && typeof data === "object" && "code" in (data as object) && !("leaders" in (data as object))) {
          continue;
        }
        return data;
      } finally {
        clear();
      }
    } catch {
      /* try next */
    }
  }
  throw new Error(`ESPN ${clean} failed`);
}
