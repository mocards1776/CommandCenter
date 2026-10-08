import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { fetchWsBoardCached, type WsOddsBoard } from "./board.ts";

/**
 * Cached Kalshi World Series championship odds for the MLB sports UI.
 *
 * GET or POST. No auth — the prices are public. In-process cache is 3 minutes
 * on a hit and 30 seconds on a miss, so a down Kalshi (or the offseason, when
 * every market is settled) hides the strip without a retry storm.
 *
 * Deploy:
 *   supabase functions deploy mlb-ws-odds --project-ref esdgrgulaxnewmhjuyzh --no-verify-jwt
 */

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200, maxAge = 30): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS,
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${maxAge}`,
    },
  });
}

const EMPTY = { source: "Kalshi" as const, teams: [] as WsOddsBoard["teams"] };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET" && req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, 0);
  }
  try {
    const board = await fetchWsBoardCached();
    if (!board) return json(EMPTY, 200, 30);
    return json(board, 200, 180);
  } catch {
    return json(EMPTY, 200, 30);
  }
});
