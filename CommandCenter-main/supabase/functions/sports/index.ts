import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ESPN = "https://site.api.espn.com/apis/site/v2/sports";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
function safePath(raw: string): string | null {
  const p = raw.replace(/^\/+/, "").split("?")[0];
  if (!/^[a-z0-9._/-]+$/i.test(p) || p.includes("..") || p.length > 180) return null;
  return p;
}
function stripTags(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
function moneyDisplay(amount: number): string { return `$${amount.toLocaleString("en-US")}`; }
function parseMoney(raw: string): number | null {
  const n = Number(raw.replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function pickCurrentSalary(
  salaries: { year: string; amount: number; team: string | null }[],
  contractStatus: string | null,
): { year: string; amount: number; team: string | null } | null {
  const year = String(new Date().getFullYear());
  const yy = year.slice(2);
  const byYear = salaries.find((s) => s.year === year);
  if (byYear) return byYear;
  if (contractStatus) {
    const k = contractStatus.match(new RegExp(`\\$([\\d.]+)k\\s*\\(${yy}\\)`, "i"));
    if (k) return { year, amount: Math.round(parseFloat(k[1]) * 1000), team: null };
  }
  const upcoming = [...salaries].filter((s) => Number(s.year) >= Number(year)).sort((a, b) => Number(a.year) - Number(b.year));
  return upcoming[0] ?? salaries[salaries.length - 1] ?? null;
}
function parseBbrefTotals(contractStatus: string | null) {
  if (!contractStatus) return { aav: null as string | null, totalValue: null as string | null };
  const total = contractStatus.match(/\$([\d.]+)\s*M\b/i);
  const totalValue = total ? moneyDisplay(Math.round(parseFloat(total[1]) * 1_000_000)) : null;
  const years = contractStatus.match(/(\d+)\s*yrs?\/\$[\d.]+\s*M/i);
  const aav = total && years ? moneyDisplay(Math.round((parseFloat(total[1]) * 1_000_000) / Number(years[1]))) : null;
  return { aav, totalValue };
}

async function scrapeBbref(name: string) {
  const q = encodeURIComponent(name.trim());
  const searchUrl = `https://www.baseball-reference.com/search/search.fcgi?search=${q}`;
  const searchRes = await fetch(searchUrl, { headers: { "User-Agent": UA, Accept: "text/html" }, redirect: "follow" });
  let html = await searchRes.text();
  let playerUrl = searchRes.url;
  if (!/\/players\/[a-z]\/[a-z0-9]+\.shtml/i.test(playerUrl)) {
    const m = html.match(/href="(\/players\/[a-z]\/[a-z0-9]+\.shtml)"/i);
    if (!m) return { error: "Player not found on Baseball Reference", name };
    playerUrl = `https://www.baseball-reference.com${m[1]}`;
    html = await (await fetch(playerUrl, { headers: { "User-Agent": UA, Accept: "text/html", Referer: searchUrl } })).text();
  }
  const salaries: { year: string; amount: number; team: string | null }[] = [];
  const salRe = /data-stat="year_ID"[^>]*>(\d{4})[\s\S]*?data-stat="team_name"[^>]*>([\s\S]*?)<\/td>[\s\S]*?data-amount="([\d.]+)"/gi;
  let sm: RegExpExecArray | null;
  while ((sm = salRe.exec(html))) salaries.push({ year: sm[1], team: stripTags(sm[2]) || null, amount: Number(sm[3]) });
  const statusMatch = html.match(/(\d{4})\s*Contract Status<\/strong>\s*:?\s*([^<\n]+)/i);
  const contractStatus = statusMatch ? `${statusMatch[1]}: ${stripTags(statusMatch[2])}` : null;
  const acquisition: string[] = [];
  for (const re of [/<p><strong>[^<]+<\/strong>\s*Drafted by[\s\S]*?<\/p>/gi, /<p><strong>[^<]+<\/strong>\s*Traded by[\s\S]*?<\/p>/gi, /<p><strong>[^<]+<\/strong>\s*Signed as[\s\S]*?<\/p>/gi]) {
    for (const hit of html.matchAll(re)) { const text = stripTags(hit[0]); if (text && !acquisition.includes(text)) acquisition.push(text); }
  }
  const latest = pickCurrentSalary(salaries, contractStatus);
  const totals = parseBbrefTotals(contractStatus);
  return {
    source: "baseball-reference", url: playerUrl, name, contractStatus,
    currentSalary: latest ? { year: latest.year, amount: latest.amount, display: moneyDisplay(latest.amount), team: latest.team } : null,
    salaryHistory: salaries.slice(-8).map((s) => ({ year: s.year, amount: s.amount, display: moneyDisplay(s.amount), team: s.team })),
    acquisition, aav: totals.aav, totalValue: totals.totalValue,
  };
}

async function findSpotracUrl(name: string): Promise<string | null> {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  for (const url of [
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent("site:spotrac.com/mlb/player " + name)}`,
    `https://www.bing.com/search?q=${encodeURIComponent('"' + name + '" site:spotrac.com/mlb/player')}`,
  ]) {
    try {
      const html = await (await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" } })).text();
      const matches = [...html.matchAll(/spotrac\.com\/mlb\/player\/_\/id\/(\d+)\/([a-z0-9-]+)/gi)];
      if (!matches.length) continue;
      const exact = matches.find((m) => m[2].toLowerCase() === slug);
      const pick = exact ?? matches[0];
      return `https://www.spotrac.com/mlb/player/_/id/${pick[1]}/${pick[2]}`;
    } catch { /* next */ }
  }
  return null;
}

async function scrapeSpotrac(name: string) {
  const playerUrl = await findSpotracUrl(name);
  if (!playerUrl) return null;
  const html = await (await fetch(playerUrl, { headers: { "User-Agent": UA, Accept: "text/html", Referer: "https://www.spotrac.com/" } })).text();
  const metaDesc = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1] ?? null;
  let ldDesc: string | null = null;
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try { const data = JSON.parse(m[1]); if (data["@type"] === "Person" && data.description) { ldDesc = data.description; break; } } catch { /* */ }
  }
  const contractStatus = (ldDesc || metaDesc || "").replace(/\s+/g, " ").trim() || null;
  const aavMatch = (metaDesc ?? "").match(/average annual salary of \$([\d,]+)/i) ?? html.match(/average annual salary of \$([\d,]+)/i);
  const totalMatch = (metaDesc ?? "").match(/\$([\d,]+)\s+contract/i) ?? html.match(/signed a[n]?\s+\d+\s+year[s]?,\s*\$([\d,]+)/i);
  const year = String(new Date().getFullYear());
  const cardCash = html.match(/card-text[^>]*>\s*\$([\d,]+)\s*</i);
  const yearSalary = html.match(new RegExp(`In ${year}[^.]*earn(?: a base salary of)?\\s*\\$([\\d,]+)`, "i"));
  const currentAmount = (yearSalary && parseMoney(yearSalary[1])) || (cardCash && parseMoney(cardCash[1])) || null;
  return {
    source: "spotrac", url: playerUrl, name, contractStatus,
    currentSalary: currentAmount != null ? { year, amount: currentAmount, display: moneyDisplay(currentAmount), team: null } : null,
    salaryHistory: [] as { year: string; amount: number; display: string; team: string | null }[],
    acquisition: contractStatus ? [contractStatus] : [],
    aav: aavMatch ? moneyDisplay(parseMoney(aavMatch[1]) ?? 0) : null,
    totalValue: totalMatch ? moneyDisplay(parseMoney(totalMatch[1]) ?? 0) : null,
  };
}

async function scrapeContract(name: string) {
  try {
    const spotrac = await scrapeSpotrac(name);
    if (spotrac?.contractStatus || spotrac?.currentSalary) {
      try {
        const bb = await scrapeBbref(name);
        if (!("error" in bb)) {
          if (!spotrac.salaryHistory.length && bb.salaryHistory?.length) spotrac.salaryHistory = bb.salaryHistory;
          if (!spotrac.currentSalary && bb.currentSalary) spotrac.currentSalary = bb.currentSalary;
          if (!spotrac.aav && bb.aav) spotrac.aav = bb.aav;
          if (!spotrac.totalValue && bb.totalValue) spotrac.totalValue = bb.totalValue;
          for (const line of bb.acquisition ?? []) if (!spotrac.acquisition.includes(line)) spotrac.acquisition.push(line);
        }
      } catch { /* */ }
      return spotrac;
    }
  } catch { /* */ }
  return scrapeBbref(name);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  if (body.action === "bbref" || body.action === "contract") {
    const name = String(body.name ?? "").trim();
    if (name.length < 3 || name.length > 80) return json({ error: "Bad name" }, 400);
    try {
      const data = body.action === "bbref" ? await scrapeBbref(name) : await scrapeContract(name);
      return json(data);
    } catch (e) { return json({ error: e instanceof Error ? e.message : String(e) }, 200); }
  }
  const safe = safePath(String(body.path ?? ""));
  if (!safe) return json({ error: "Bad path" }, 400);
  try {
    const res = await fetch(`${ESPN}/${safe}`, { headers: { Accept: "application/json", "User-Agent": UA, Referer: "https://www.espn.com/" } });
    const text = await res.text();
    if (!res.ok) return json({ error: `ESPN ${res.status}`, detail: text.slice(0, 200) }, 200);
    return new Response(text, { status: 200, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "public, max-age=60" } });
  } catch (e) { return json({ error: e instanceof Error ? e.message : String(e) }, 200); }
});
