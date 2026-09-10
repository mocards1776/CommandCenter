import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Proxies private Google Calendar / generic iCal feeds so the browser can
 * read them without CORS. Body: { url: string }
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }
  if (req.method !== "POST") {
    return Response.json({ error: "POST only" }, { status: 405, headers: CORS });
  }

  try {
    const body = (await req.json()) as { url?: string };
    const url = String(body.url ?? "").trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return Response.json({ error: "Valid https url required" }, { status: 400, headers: CORS });
    }
    // Only allow calendar-ish hosts — avoid open proxy abuse.
    const host = new URL(url).hostname.toLowerCase();
    const allowed =
      host.includes("google.com") ||
      host.includes("outlook.") ||
      host.includes("office365.com") ||
      host.includes("live.com") ||
      host.includes("icloud.com") ||
      host.includes("calendar.") ||
      host.endsWith(".ics") ||
      url.toLowerCase().includes(".ics");
    if (!allowed) {
      return Response.json({ error: "Host not allowed" }, { status: 403, headers: CORS });
    }

    const res = await fetch(url, {
      headers: {
        Accept: "text/calendar, text/plain, */*",
        "User-Agent": "CommandCenter-iCal/1.0",
      },
    });
    if (!res.ok) {
      return Response.json(
        { error: `Upstream ${res.status}` },
        { status: 502, headers: CORS },
      );
    }
    const text = await res.text();
    if (!/BEGIN:VCALENDAR/i.test(text)) {
      return Response.json({ error: "Not an iCalendar feed" }, { status: 422, headers: CORS });
    }
    return Response.json({ text }, { headers: CORS });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500, headers: CORS },
    );
  }
});
