/**
 * Same-origin proxy for api-web.nhle.com, api.nhle.com/stats and
 * records.nhl.com, none of which send CORS headers.
 * GET /api/nhl?path=v1/gamecenter/2026020017/landing
 * GET /api/nhl?path=stats/shiftcharts/2026020017
 * GET /api/nhl?path=records/coach/Jim Montgomery
 * GET /api/nhl?path=records/coach-franchise/Jim Montgomery
 * Only read-only gamecenter / schedule / score / player / shift-chart / coach paths are forwarded.
 */

const UPSTREAM = "https://api-web.nhle.com/";
const ALLOWED =
  /^v1\/(?:gamecenter\/\d{10}\/(?:landing|play-by-play|right-rail|boxscore)|schedule\/\d{4}-\d{2}-\d{2}|score\/(?:now|\d{4}-\d{2}-\d{2})|scoreboard\/now|player\/\d{7,8}\/landing)$/;
const SHIFT_CHARTS = /^stats\/shiftcharts\/(\d{10})$/;
const COACH_RECORDS = /^records\/(coach|coach-franchise)\/([\p{L} .'-]{3,60})$/u;

function upstreamUrl(path: string): string | null {
  const shifts = SHIFT_CHARTS.exec(path);
  if (shifts) return `https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=${shifts[1]}`;
  const coach = COACH_RECORDS.exec(path);
  if (coach) {
    const [, kind, name] = coach;
    const field = kind === "coach" ? "fullName" : "coachName";
    const resource = kind === "coach" ? "coach" : "coach-franchise-records";
    const exp = encodeURIComponent(`${field}="${name.trim()}"`);
    return `https://records.nhl.com/site/api/${resource}?cayenneExp=${exp}`;
  }
  return ALLOWED.test(path) ? `${UPSTREAM}${path}` : null;
}

export async function GET(request: Request): Promise<Response> {
  const path = new URL(request.url).searchParams.get("path")?.replace(/^\/+/, "") ?? "";
  const url = upstreamUrl(path);
  if (!url) {
    return Response.json({ error: "Path not allowed" }, { status: 400 });
  }
  const isRecords = url.startsWith("https://records.nhl.com/");
  try {
    const upstream = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "CommandCenter/1.0" },
    });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": isRecords
          ? "public, s-maxage=3600, stale-while-revalidate=86400"
          : "public, s-maxage=15, stale-while-revalidate=30",
      },
    });
  } catch {
    return Response.json({ error: "Upstream unavailable" }, { status: 502 });
  }
}
