import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * ESPN proxy fallback for the Sports dashboard.
 * Prefer the browser (ESPN allows CORS); this path uses a browser-like UA
 * because ESPN 403s many server/edge clients.
 *
 * POST { path: "baseball/mlb/teams/24" }
 */

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ESPN = "https://site.api.espn.com/apis/site/v2/sports";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function safePath(raw: string): string | null {
  const p = raw.replace(/^\/+/, "").split("?")[0];
  if (!/^[a-z0-9._/-]+$/i.test(p)) return null;
  if (p.includes("..")) return null;
  if (p.length > 180) return null;
  return p;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let path = "";
  try {
    const body = await req.json();
    path = String(body?.path ?? "");
  } catch {
    return json({ error: "Bad JSON" }, 400);
  }

  const safe = safePath(path);
  if (!safe) return json({ error: "Bad path" }, 400);

  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 12000);
    // ESPN blocks generic bot/server UAs — look like a normal browser tab.
    const res = await fetch(`${ESPN}/${safe}`, {
      signal: ctl.signal,
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Referer: "https://www.espn.com/",
        Origin: "https://www.espn.com",
      },
    }).finally(() => clearTimeout(t));

    const text = await res.text();
    if (!res.ok) {
      // 200 with error payload so supabase-js surfaces the message instead of
      // the generic "Edge Function returned a non-2xx status code".
      return json({ error: `ESPN ${res.status}`, detail: text.slice(0, 200) }, 200);
    }
    return new Response(text, {
      status: 200,
      headers: {
        ...CORS,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 200);
  }
});
