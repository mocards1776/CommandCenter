import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Sports helpers:
 * 1) ESPN path proxy — POST { path: "baseball/mlb/teams/24" }
 * 2) Baseball-Reference contract scrape — POST { action: "bbref", name: "Matthew Liberatore" }
 */

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ESPN = "https://site.api.espn.com/apis/site/v2/sports";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

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

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function scrapeBbref(name: string) {
  const q = encodeURIComponent(name.trim());
  const searchUrl = `https://www.baseball-reference.com/search/search.fcgi?search=${q}`;
  const searchRes = await fetch(searchUrl, {
    headers: { "User-Agent": UA, Accept: "text/html", "Accept-Language": "en-US,en;q=0.9" },
    redirect: "follow",
  });
  let html = await searchRes.text();
  let playerUrl = searchRes.url;

  if (!/\/players\/[a-z]\/[a-z0-9]+\.shtml/i.test(playerUrl)) {
    const m = html.match(/href="(\/players\/[a-z]\/[a-z0-9]+\.shtml)"/i);
    if (!m) return { error: "Player not found on Baseball Reference", name };
    playerUrl = `https://www.baseball-reference.com${m[1]}`;
    const pageRes = await fetch(playerUrl, {
      headers: { "User-Agent": UA, Accept: "text/html", Referer: searchUrl },
    });
    html = await pageRes.text();
  }

  const salaries: { year: string; amount: number; team: string | null }[] = [];
  const salRe =
    /data-stat="year_ID"[^>]*>(\d{4})[\s\S]*?data-stat="team_name"[^>]*>([\s\S]*?)<\/td>[\s\S]*?data-amount="([\d.]+)"/gi;
  let sm: RegExpExecArray | null;
  while ((sm = salRe.exec(html))) {
    salaries.push({
      year: sm[1],
      team: stripTags(sm[2]) || null,
      amount: Number(sm[3]),
    });
  }

  const statusMatch = html.match(
    /(\d{4})\s*Contract Status<\/strong>\s*:?\s*([^<\n]+)/i,
  );
  const contractStatus = statusMatch
    ? `${statusMatch[1]}: ${stripTags(statusMatch[2])}`
    : null;

  const acquisition: string[] = [];
  for (const re of [
    /<p><strong>[^<]+<\/strong>\s*Drafted by[\s\S]*?<\/p>/gi,
    /<p><strong>[^<]+<\/strong>\s*Traded by[\s\S]*?<\/p>/gi,
    /<p><strong>[^<]+<\/strong>\s*Signed as[\s\S]*?<\/p>/gi,
    /<p><strong>[^<]+<\/strong>\s*Purchased[\s\S]*?<\/p>/gi,
    /<p><strong>[^<]+<\/strong>\s*Granted[\s\S]*?<\/p>/gi,
  ]) {
    for (const hit of html.matchAll(re)) {
      const text = stripTags(hit[0]);
      if (text && !acquisition.includes(text)) acquisition.push(text);
    }
  }

  const latest = salaries[salaries.length - 1] ?? null;

  return {
    source: "baseball-reference",
    url: playerUrl,
    name,
    contractStatus,
    currentSalary: latest
      ? { year: latest.year, amount: latest.amount, display: `$${latest.amount.toLocaleString("en-US")}`, team: latest.team }
      : null,
    salaryHistory: salaries.slice(-8).map((s) => ({
      year: s.year,
      amount: s.amount,
      display: `$${s.amount.toLocaleString("en-US")}`,
      team: s.team,
    })),
    acquisition,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad JSON" }, 400);
  }

  if (body.action === "bbref") {
    const name = String(body.name ?? "").trim();
    if (name.length < 3 || name.length > 80) return json({ error: "Bad name" }, 400);
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 15000);
      const data = await scrapeBbref(name).finally(() => clearTimeout(t));
      return json(data);
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 200);
    }
  }

  const path = String(body.path ?? "");
  const safe = safePath(path);
  if (!safe) return json({ error: "Bad path" }, 400);

  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 12000);
    const res = await fetch(`${ESPN}/${safe}`, {
      signal: ctl.signal,
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": UA,
        Referer: "https://www.espn.com/",
        Origin: "https://www.espn.com",
      },
    }).finally(() => clearTimeout(t));

    const text = await res.text();
    if (!res.ok) {
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
