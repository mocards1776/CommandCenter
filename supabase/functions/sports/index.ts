import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Thin ESPN proxy for the Sports dashboard.
 * Keeps team scores/schedules off the browser origin and avoids UA quirks.
 *
 * POST { path: "baseball/mlb/teams/24" }
 *   → https://site.api.espn.com/apis/site/v2/sports/{path}
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
  // sport/league/... only — no scheme, no parent hops.
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
    const res = await fetch(`${ESPN}/${safe}`, {
      signal: ctl.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "CommandCenter/1.0 (personal sports dashboard)",
      },
    }).finally(() => clearTimeout(t));

    const text = await res.text();
    if (!res.ok) {
      return json({ error: `ESPN ${res.status}`, detail: text.slice(0, 200) }, 502);
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
    return json({ error: msg }, 502);
  }
});
