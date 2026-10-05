/**
 * Same-origin proxy for Kalshi's public trade API.
 * The exchange blocks browser Origins, so the Times Heisman desk
 * reads through here. Only Heisman event/market GETs are forwarded.
 *
 * GET /api/kalshi?path=events?series_ticker=KXHEISMAN&status=open&limit=10
 * GET /api/kalshi?path=markets?event_ticker=KXHEISMAN-27&status=open&limit=200
 */

const UPSTREAM = "https://api.elections.kalshi.com/trade-api/v2/";
const ALLOWED = [
  /^events\?(?:series_ticker=KXHEISMAN(?:-[A-Z0-9]+)?&)?status=open&limit=\d{1,3}$/,
  /^events\?series_ticker=KXHEISMAN(?:-[A-Z0-9]+)?&status=open&limit=\d{1,3}$/,
  /^markets\?event_ticker=KXHEISMAN-[A-Z0-9-]+&status=open&limit=\d{1,3}$/,
];

function upstreamUrl(path: string): string | null {
  const clean = path.replace(/^\/+/, "");
  return ALLOWED.some((re) => re.test(clean)) ? `${UPSTREAM}${clean}` : null;
}

export async function GET(request: Request): Promise<Response> {
  const path = new URL(request.url).searchParams.get("path") ?? "";
  const url = upstreamUrl(path);
  if (!url) return Response.json({ error: "Path not allowed" }, { status: 400 });
  try {
    const upstream = await fetch(url, { headers: { Accept: "application/json" } });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch {
    return Response.json({ error: "Upstream unavailable" }, { status: 502 });
  }
}
