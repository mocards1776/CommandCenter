import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ESPN = "https://site.api.espn.com/apis/site/v2/sports";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** Hard caps so hung scrapes can't pin edge workers (504/546 after ~150s). */
const FETCH_MS = 12_000;
const SEARCH_MS = 7_000;
const HEAVY_MS = 28_000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function timedFetch(
  url: string,
  init: RequestInit = {},
  ms = FETCH_MS,
): Promise<Response> {
  const ctl = new AbortController();
  const outer = init.signal;
  const onAbort = () => ctl.abort();
  if (outer) {
    if (outer.aborted) ctl.abort();
    else outer.addEventListener("abort", onAbort, { once: true });
  }
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(t);
    outer?.removeEventListener("abort", onAbort);
  }
}

async function withBudget<T>(ms: number, work: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await Promise.race([
      work(),
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
    ]);
  } catch {
    return fallback;
  }
}
function safePath(raw: string): string | null {
  const cleaned = raw.replace(/^\/+/, "");
  const qIdx = cleaned.indexOf("?");
  const pathPart = qIdx >= 0 ? cleaned.slice(0, qIdx) : cleaned;
  const queryPart = qIdx >= 0 ? cleaned.slice(qIdx + 1) : "";
  if (!pathPart || !/^[a-z0-9._/-]+$/i.test(pathPart) || pathPart.includes("..") || pathPart.length > 180) {
    return null;
  }
  if (!queryPart) return pathPart;
  // Allow ESPN query params (player, season, dates, etc.)
  if (!/^[a-z0-9._&=%-]+$/i.test(queryPart) || queryPart.length > 160) return pathPart;
  return `${pathPart}?${queryPart}`;
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
function moneyDisplay(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}
function parseMoney(raw: string): number | null {
  const n = Number(String(raw).replace(/[$,]/g, "").trim());
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
    const m = contractStatus.match(/\$([\d.]+)\s*M/i);
    if (m) return { year, amount: Math.round(parseFloat(m[1]) * 1_000_000), team: null };
  }
  const upcoming = [...salaries]
    .filter((s) => Number(s.year) >= Number(year))
    .sort((a, b) => Number(a.year) - Number(b.year));
  return upcoming[0] ?? salaries[salaries.length - 1] ?? null;
}
function parseBbrefTotals(contractStatus: string | null) {
  if (!contractStatus) return { aav: null as string | null, totalValue: null as string | null };
  const total = contractStatus.match(/\$([\d.]+)\s*M\b/i);
  const totalValue = total ? moneyDisplay(Math.round(parseFloat(total[1]) * 1_000_000)) : null;
  const years = contractStatus.match(/(\d+)\s*yrs?\/\$[\d.]+\s*M/i) ??
    contractStatus.match(/(\d+)\s*yr\/\$[\d.]+\s*M/i);
  const aav =
    total && years
      ? moneyDisplay(Math.round((parseFloat(total[1]) * 1_000_000) / Number(years[1])))
      : null;
  return { aav, totalValue };
}

async function scrapeBbref(name: string) {
  const q = encodeURIComponent(name.trim());
  const searchUrl = `https://www.baseball-reference.com/search/search.fcgi?search=${q}`;
  const searchRes = await timedFetch(searchUrl, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    redirect: "follow",
  });
  let html = await searchRes.text();
  let playerUrl = searchRes.url;
  const want = name.trim().toLowerCase();
  if (!/\/players\/[a-z]\/[a-z0-9]+\.shtml/i.test(playerUrl)) {
    // Prefer an anchor whose link text matches the player name.
    const linkRe = /href="(\/players\/[a-z]\/[a-z0-9]+\.shtml)"[^>]*>([^<]{2,80})<\/a>/gi;
    let best: { path: string; score: number } | null = null;
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(html))) {
      const label = stripTags(m[2]).toLowerCase();
      let score = 0;
      if (label === want) score = 100;
      else if (label.startsWith(want) || want.startsWith(label)) score = 80;
      else if (label.includes(want.split(/\s+/).slice(-1)[0] ?? "")) score = 40;
      if (!best || score > best.score) best = { path: m[1], score };
    }
    const fallback = html.match(/href="(\/players\/[a-z]\/[a-z0-9]+\.shtml)"/i);
    const path = (best && best.score >= 40 ? best.path : null) ?? fallback?.[1];
    if (!path) return { error: "Player not found on Baseball Reference", name };
    playerUrl = `https://www.baseball-reference.com${path}`;
    html = await (
      await timedFetch(playerUrl, {
        headers: { "User-Agent": UA, Accept: "text/html", Referer: searchUrl },
      })
    ).text();
  }
  const salaries: { year: string; amount: number; team: string | null }[] = [];
  // BBRef often wraps tables in HTML comments — search the raw markup either way.
  const searchable = html.replace(/<!--([\s\S]*?)-->/g, "$1");
  // Prefer rows that carry data-amount (salary tables).
  const rowRe =
    /<tr[^>]*>[\s\S]*?data-stat="year_ID"[^>]*>\s*(\d{4})[\s\S]*?data-stat="team_name"[^>]*>([\s\S]*?)<\/td>[\s\S]*?data-amount="([\d.]+)"[\s\S]*?<\/tr>/gi;
  let sm: RegExpExecArray | null;
  while ((sm = rowRe.exec(searchable))) {
    const amount = Number(sm[3]);
    if (!Number.isFinite(amount)) continue;
    salaries.push({ year: sm[1], team: stripTags(sm[2]) || null, amount });
  }
  if (!salaries.length) {
    const loose =
      /data-stat="year_ID"[^>]*>(\d{4})[\s\S]*?data-stat="team_name"[^>]*>([\s\S]*?)<\/td>[\s\S]*?data-amount="([\d.]+)"/gi;
    while ((sm = loose.exec(searchable))) {
      const amount = Number(sm[3]);
      if (!Number.isFinite(amount)) continue;
      salaries.push({ year: sm[1], team: stripTags(sm[2]) || null, amount });
    }
  }
  // Dedupe by year (keep latest / highest amount when duplicated).
  const byYear = new Map<string, { year: string; amount: number; team: string | null }>();
  for (const s of salaries) {
    const prev = byYear.get(s.year);
    if (!prev || s.amount >= prev.amount) byYear.set(s.year, s);
  }
  const uniqueSalaries = [...byYear.values()].sort((a, b) => Number(a.year) - Number(b.year));
  const statusMatch =
    searchable.match(/Contract Status<\/strong>\s*:?\s*([^<]+)/i) ??
    searchable.match(/(\d{4})\s*Contract Status<\/strong>\s*:?\s*([^<\n]+)/i);
  const contractStatus = statusMatch
    ? stripTags(statusMatch[statusMatch.length - 1] ?? "").replace(/\s+/g, " ").trim()
    : null;
  const acquisition: string[] = [];
  for (const re of [
    /<p><strong>[^<]+<\/strong>\s*Drafted by[\s\S]*?<\/p>/gi,
    /<p><strong>[^<]+<\/strong>\s*Traded by[\s\S]*?<\/p>/gi,
    /<p><strong>[^<]+<\/strong>\s*Signed as[\s\S]*?<\/p>/gi,
  ]) {
    for (const hit of searchable.matchAll(re)) {
      const text = stripTags(hit[0]);
      if (text && !acquisition.includes(text)) acquisition.push(text);
    }
  }
  const latest = pickCurrentSalary(uniqueSalaries, contractStatus);
  const totals = parseBbrefTotals(contractStatus);
  const stMatch =
    searchable.match(
      /Service Time(?:\s*\([^)]*\))?\s*<\/strong>\s*:?\s*([0-9]+(?:\.[0-9]+)?)/i,
    ) ?? searchable.match(/Service Time[^:]*:\s*([0-9]+(?:\.[0-9]+)?)/i);
  return {
    source: "baseball-reference",
    url: playerUrl,
    name,
    contractStatus,
    serviceTime: stMatch?.[1] ?? null,
    currentSalary: latest
      ? {
          year: latest.year,
          amount: latest.amount,
          display: moneyDisplay(latest.amount),
          team: latest.team,
        }
      : null,
    salaryHistory: uniqueSalaries.slice(-12).map((s) => ({
      year: s.year,
      amount: s.amount,
      display: moneyDisplay(s.amount),
      team: s.team,
    })),
    acquisition,
    aav: totals.aav,
    totalValue: totals.totalValue,
  };
}

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Known Spotrac MLB ids — search engines often miss market-value URLs. */
const SPOTRAC_IDS: Record<string, { id: string; slug: string }> = {
  "alec burleson": { id: "48426", slug: "alec-burleson" },
  "andre pallante": { id: "30525", slug: "andre-pallante" },
  "neil pallante": { id: "30525", slug: "andre-pallante" },
  pallante: { id: "30525", slug: "andre-pallante" },
  "blake snell": { id: "18356", slug: "blake-snell" },
  "ivan herrera": { id: "20857", slug: "ivan-herrera" },
  "iván herrera": { id: "20857", slug: "ivan-herrera" },
  "jojo romero": { id: "20195", slug: "jojo-romero" },
  "jordan walker": { id: "48376", slug: "jordan-walker" },
  "kyle leahy": { id: "26606", slug: "kyle-leahy" },
  "lars nootbaar": { id: "26276", slug: "lars-nootbaar" },
  "masyn winn": { id: "48410", slug: "masyn-winn" },
  "matthew liberatore": { id: "26039", slug: "matthew-liberatore" },
  liberatore: { id: "26039", slug: "matthew-liberatore" },
  "miles mikolas": { id: "11497", slug: "miles-mikolas" },
  "nolan arenado": { id: "12643", slug: "nolan-arenado" },
  "nolan gorman": { id: "26042", slug: "nolan-gorman" },
  "pedro pages": { id: "31125", slug: "pedro-pages" },
  "sonny gray": { id: "14331", slug: "sonny-gray" },
  "willson contreras": { id: "18368", slug: "willson-contreras" },
  "yohel pozo": { id: "70734", slug: "yohel-pozo" },
  "victor scott ii": { id: "78741", slug: "victor-scott-ii" },
  "thomas saggese": { id: "48501", slug: "thomas-saggese" },
  "ryan fernandez": { id: "27319", slug: "ryan-fernandez" },
  "michael mcgreevy": { id: "73280", slug: "michael-mcgreevy" },
};

const SPOTRAC_PLAYER_RE =
  /spotrac\.com\/mlb\/player(?:\/market-value)?\/_\/id\/(\d+)\/([a-z0-9-]+)/i;

function normalizeSpotracUrl(raw: string): string | null {
  const m = raw.match(SPOTRAC_PLAYER_RE);
  if (!m) return null;
  return `https://www.spotrac.com/mlb/player/_/id/${m[1]}/${m[2].toLowerCase()}`;
}

function spotracUrlForName(name: string): string | null {
  const key = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
  const hit = SPOTRAC_IDS[key] ?? SPOTRAC_IDS[name.trim().toLowerCase().replace(/\s+/g, " ")];
  if (!hit) return null;
  return `https://www.spotrac.com/mlb/player/_/id/${hit.id}/${hit.slug}`;
}

async function findSpotracUrl(name: string, hintUrl?: string | null): Promise<string | null> {
  if (hintUrl) {
    const normalized = normalizeSpotracUrl(hintUrl);
    if (normalized) return normalized;
  }
  const known = spotracUrlForName(name);
  if (known) return known;

  const slug = slugifyName(name);
  const last = slug.split("-").filter(Boolean).slice(-1)[0] ?? "";
  const urls = [
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`site:spotrac.com/mlb/player ${name}`)}`,
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`"${name}" site:spotrac.com/mlb/player/_/id`)}`,
    `https://www.bing.com/search?q=${encodeURIComponent(`"${name}" site:spotrac.com/mlb/player`)}`,
  ];
  for (const url of urls) {
    try {
      const html = await (
        await timedFetch(url, { headers: { "User-Agent": UA, Accept: "text/html" } }, SEARCH_MS)
      ).text();
      const matches = [...html.matchAll(new RegExp(SPOTRAC_PLAYER_RE.source, "gi"))];
      if (!matches.length) continue;
      const ranked = matches
        .map((m) => {
          const s = m[2].toLowerCase();
          let score = 0;
          if (s === slug) score = 100;
          else if (s.endsWith(slug) || slug.endsWith(s)) score = 80;
          else if (last && s.endsWith(`-${last}`) && s.includes(slug.split("-")[0] ?? "")) score = 70;
          else if (last && s.includes(last)) score = 20;
          return { id: m[1], slug: s, score };
        })
        .filter((x) => x.score >= 70)
        .sort((a, b) => b.score - a.score);
      const pick = ranked[0];
      if (!pick) continue;
      return `https://www.spotrac.com/mlb/player/_/id/${pick.id}/${pick.slug}`;
    } catch {
      /* next */
    }
  }
  return null;
}

async function scrapeSpotrac(name: string, hintUrl?: string | null) {
  const playerUrl = await findSpotracUrl(name, hintUrl);
  if (!playerUrl) return null;
  const html = await (
    await timedFetch(playerUrl, {
      headers: { "User-Agent": UA, Accept: "text/html", Referer: "https://www.spotrac.com/" },
    })
  ).text();
  const metaDesc =
    html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1] ?? null;
  let ldDesc: string | null = null;
  let ldImage: string | null = null;
  for (const m of html.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const data = JSON.parse(m[1]);
      if (data["@type"] === "Person") {
        if (data.description) ldDesc = data.description;
        if (data.image) ldImage = String(data.image);
        break;
      }
    } catch {
      /* */
    }
  }
  const contractStatus = (ldDesc || metaDesc || "").replace(/\s+/g, " ").trim() || null;
  const blob = `${metaDesc ?? ""} ${ldDesc ?? ""} ${html.slice(0, 80_000)}`;
  const aavMatch =
    blob.match(/average annual salary of \$([\d,]+)/i) ??
    blob.match(/average annual value[^$]{0,40}\$([\d,]+)/i);
  const totalMatch =
    blob.match(/\$([\d,]+)\s+contract/i) ??
    blob.match(/signed a[n]?\s+\d+\s+year[s]?,\s*\$([\d,]+)/i) ??
    blob.match(/signed a[n]?\s+\d+\s+year[s]?\s*\$([\d.]+)\s*million/i) ??
    blob.match(/\$([\d.]+)\s*million contract/i);
  const year = String(new Date().getFullYear());
  const cardCash = html.match(/card-text[^>]*>\s*\$([\d,]+)\s*</i);
  const yearSalary = html.match(
    new RegExp(`In ${year}[^.\\n]{0,120}?\\$([\\d,]+)`, "i"),
  );
  const millionToCash = (raw: string): number | null => {
    if (/^\d+(?:\.\d+)?$/.test(raw) && blob.toLowerCase().includes(`${raw} million`)) {
      return Math.round(parseFloat(raw) * 1_000_000);
    }
    return parseMoney(raw);
  };
  const currentAmount =
    (yearSalary && parseMoney(yearSalary[1])) ||
    (cardCash && parseMoney(cardCash[1])) ||
    (totalMatch && millionToCash(totalMatch[1])) ||
    (aavMatch && parseMoney(aavMatch[1])) ||
    null;
  const totalValue =
    totalMatch
      ? moneyDisplay(millionToCash(totalMatch[1]) ?? parseMoney(totalMatch[1]) ?? 0)
      : null;
  const aav = aavMatch
    ? moneyDisplay(parseMoney(aavMatch[1]) ?? 0)
    : totalValue;
  return {
    source: "spotrac",
    url: playerUrl,
    name,
    contractStatus,
    serviceTime: null as string | null,
    currentSalary:
      currentAmount != null
        ? { year, amount: currentAmount, display: moneyDisplay(currentAmount), team: null }
        : null,
    salaryHistory: [] as { year: string; amount: number; display: string; team: string | null }[],
    acquisition: contractStatus ? [contractStatus] : [],
    aav,
    totalValue,
    image: ldImage,
  };
}

function hasContractBits(c: {
  contractStatus?: string | null;
  currentSalary?: unknown;
  salaryHistory?: unknown[];
  aav?: string | null;
  totalValue?: string | null;
} | null | undefined): boolean {
  if (!c) return false;
  return Boolean(
    c.contractStatus ||
      c.currentSalary ||
      c.aav ||
      c.totalValue ||
      (c.salaryHistory?.length ?? 0) > 0,
  );
}

async function scrapeContract(name: string, hintUrl?: string | null) {
  const fallback = { error: "Contract lookup timed out", name };
  return withBudget(HEAVY_MS, async () => {
    // Pull BBRef + Spotrac together so a Spotrac miss or BBRef blip still fills the card.
    const [bbSettled, spotracSettled] = await Promise.allSettled([
      scrapeBbref(name),
      scrapeSpotrac(name, hintUrl),
    ]);
    const bb =
      bbSettled.status === "fulfilled" && bbSettled.value && !("error" in bbSettled.value)
        ? bbSettled.value
        : null;
    const spotrac =
      spotracSettled.status === "fulfilled" ? spotracSettled.value : null;

    if (bb && hasContractBits(bb)) {
      if (spotrac && hasContractBits(spotrac)) {
        if (!bb.aav && spotrac.aav) bb.aav = spotrac.aav;
        if (!bb.totalValue && spotrac.totalValue) bb.totalValue = spotrac.totalValue;
        if (!bb.contractStatus && spotrac.contractStatus) bb.contractStatus = spotrac.contractStatus;
        // Prefer Spotrac "this season" when BBRef salary table is a year behind.
        const year = new Date().getFullYear();
        const bbYear = Number(bb.currentSalary?.year || 0);
        if (
          spotrac.currentSalary &&
          (!bb.currentSalary || bbYear < year)
        ) {
          if (spotrac.aav && bbYear < year) {
            const amt = parseMoney(spotrac.aav.replace(/[$,]/g, ""));
            bb.currentSalary = {
              year: String(year),
              amount: amt ?? spotrac.currentSalary.amount,
              display: spotrac.aav,
              team: spotrac.currentSalary.team,
            };
          } else {
            bb.currentSalary = spotrac.currentSalary;
          }
        } else if (!bb.currentSalary && spotrac.currentSalary) {
          bb.currentSalary = spotrac.currentSalary;
        }
        for (const line of spotrac.acquisition ?? []) {
          if (!bb.acquisition.includes(line)) bb.acquisition.push(line);
        }
        // Prefer Spotrac player URL when we have one (canonical contract page).
        if (spotrac.url) bb.url = spotrac.url;
        // Always keep BBRef service time — Spotrac never carries it.
        if (!bb.serviceTime && spotrac.serviceTime) bb.serviceTime = spotrac.serviceTime;
        bb.source = "spotrac+baseball-reference";
      }
      return bb;
    }
    if (spotrac && hasContractBits(spotrac)) {
      // Spotrac-only wins still need BBRef service time when we scraped it.
      if (bb?.serviceTime && !spotrac.serviceTime) {
        spotrac.serviceTime = bb.serviceTime;
        spotrac.source = spotrac.source
          ? `${spotrac.source}+service-time`
          : "spotrac+baseball-reference";
      }
      return spotrac;
    }
    if (bb) return bb;
    return {
      error:
        bbSettled.status === "rejected"
          ? bbSettled.reason instanceof Error
            ? bbSettled.reason.message
            : String(bbSettled.reason)
          : "Contract not found",
      name,
    };
  }, fallback);
}

function normPerson(s: string): string {
  return s
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** RotoWire write-up via ESPN athlete overview (plus a couple news headlines). */
async function scrapePlayerBrief(name: string) {
  const want = normPerson(name);
  const searchUrl =
    `https://site.web.api.espn.com/apis/common/v3/search?region=us&lang=en&type=player&limit=8&query=` +
    encodeURIComponent(name.trim());
  const searchRes = await timedFetch(searchUrl, {
    headers: { Accept: "application/json", "User-Agent": UA, Referer: "https://www.espn.com/" },
  });
  if (!searchRes.ok) return { error: `ESPN search ${searchRes.status}`, name };
  const searchJson = (await searchRes.json()) as {
    items?: { id?: string; displayName?: string; league?: string; type?: string }[];
  };
  const mlb = (searchJson.items ?? []).filter(
    (it) => String(it.league ?? "").toLowerCase() === "mlb" || it.type === "player",
  );
  const hit =
    mlb.find((it) => normPerson(it.displayName ?? "") === want) ??
    mlb.find((it) => normPerson(it.displayName ?? "").includes(want.split(" ").slice(-1)[0] ?? "")) ??
    mlb[0];
  if (!hit?.id) return { error: "Player not found on ESPN", name };

  const ovRes = await timedFetch(
    `https://site.web.api.espn.com/apis/common/v3/sports/baseball/mlb/athletes/${hit.id}/overview`,
    { headers: { Accept: "application/json", "User-Agent": UA, Referer: "https://www.espn.com/" } },
  );
  if (!ovRes.ok) return { error: `ESPN overview ${ovRes.status}`, name, espnId: hit.id };
  const ov = (await ovRes.json()) as {
    rotowire?: {
      headline?: string;
      story?: string;
      description?: string;
      published?: string;
    };
    news?: { headline?: string; description?: string; published?: string; type?: string }[];
  };
  const rw = ov.rotowire ?? {};
  const news = (ov.news ?? [])
    .filter((n) => n.headline && n.type !== "Media")
    .slice(0, 3)
    .map((n) => ({
      headline: n.headline ?? "",
      description: n.description ?? "",
    }));
  if (!rw.headline && !rw.story && !news.length) {
    return { error: "No RotoWire brief available", name, espnId: hit.id };
  }
  return {
    source: "rotowire",
    provider: "espn",
    name: hit.displayName ?? name,
    espnId: String(hit.id),
    headline: rw.headline ?? rw.description ?? null,
    story: rw.story ?? null,
    description: rw.description ?? null,
    published: rw.published ?? null,
    news,
    url: `https://www.espn.com/mlb/player/_/id/${hit.id}`,
  };
}

async function findBbrefManagerUrl(name: string): Promise<string | null> {
  const q = encodeURIComponent(name.trim());
  const searchUrl = `https://www.baseball-reference.com/search/search.fcgi?search=${q}`;
  const res = await timedFetch(searchUrl, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    redirect: "follow",
  });
  const html = await res.text();
  const finalUrl = res.url;
  if (/\/managers\/[a-z0-9]+\.shtml/i.test(finalUrl)) return finalUrl.split("?")[0];
  const mgr = html.match(/href="(\/managers\/[a-z0-9]+\.shtml)"/i);
  if (mgr) return `https://www.baseball-reference.com${mgr[1]}`;
  const player = html.match(/href="(\/players\/[a-z]\/[a-z0-9]+\.shtml)"/i);
  if (player) {
    const playerUrl = `https://www.baseball-reference.com${player[1]}`;
    const slug = player[1].split("/").pop()?.replace(/\.shtml$/i, "");
    if (slug) return `https://www.baseball-reference.com/managers/${slug}.shtml`;
    const phtml = await (
      await timedFetch(playerUrl, { headers: { "User-Agent": UA, Accept: "text/html", Referer: searchUrl } })
    ).text();
    const link = phtml.match(/href="(\/managers\/[a-z0-9]+\.shtml)"/i);
    if (link) return `https://www.baseball-reference.com${link[1]}`;
  }
  return null;
}

function parseBbrefInt(raw: string): number | null {
  const t = raw.trim();
  if (!/^-?\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function extractBbrefManagerPhoto(html: string): string | null {
  const photoRaw =
    html.match(
      /src="(https?:\/\/www\.baseball-reference\.com\/req\/[^"]+headshots\/[^"]+\.jpg)"/i,
    )?.[1] ??
    html.match(
      /content="(https?:\/\/www\.baseball-reference\.com\/req\/[^"]+headshots\/[^"]+\.jpg)"/i,
    )?.[1] ??
    html.match(/og:image"\s+content="([^"]+)"/i)?.[1] ??
    null;
  if (!photoRaw) return null;
  if (photoRaw.includes("image_resize.cgi")) {
    return photoRaw.match(/url=(https?:\/\/[^&]+)/i)?.[1] ?? photoRaw;
  }
  return photoRaw;
}

function detectManagerLeash(html: string): { interim: boolean; shortLeash: boolean } {
  const head = stripTags(html.slice(0, 12000));
  const comments = [...html.matchAll(/data-stat="comments"[^>]*>([\s\S]*?)<\/t/gi)]
    .map((m) => stripTags(m[1]))
    .join(" ");
  const interim =
    /\binterim manager\b/i.test(head) ||
    /\bas interim\b/i.test(head) ||
    /\binterim\b/i.test(comments);
  // First-year audition deals / explicit interim language = always hot.
  const shortLeash =
    interim ||
    /\b(1[\s-]?year|one[\s-]?year|1\s*yr)\b.{0,48}\b(deal|contract|agreement)\b/i.test(head) ||
    /\b(deal|contract|agreement)\b.{0,48}\b(1[\s-]?year|one[\s-]?year|1\s*yr)\b/i.test(head);
  return { interim, shortLeash };
}

/** Pull a short contract blurb from a BBRef manager page when present. */
function extractBbrefManagerContract(html: string): string | null {
  const head = stripTags(html.slice(0, 18000)).replace(/\s+/g, " ");
  const comments = [...html.matchAll(/data-stat="comments"[^>]*>([\s\S]*?)<\/t/gi)]
    .map((m) => stripTags(m[1]))
    .join(" · ");
  const blob = `${head} ${comments}`;
  const patterns = [
    /\b(?:signed|agreed to|on)\s+a[n]?\s+(\d+\s*-\s*year[^.·]{0,80}(?:contract|deal|extension)[^.·]{0,60})/i,
    /\b(\d+\s*-\s*year[^.·]{0,40}(?:contract|deal|extension)(?:\s+through\s+20\d{2})?[^.·]{0,40})/i,
    /\b((?:contract|deal)\s+through\s+20\d{2}[^.·]{0,40})/i,
    /\b(final year of (?:his |the )?(?:contract|deal)[^.·]{0,40})/i,
    /\b(club option for 20\d{2}[^.·]{0,40})/i,
    /\b(interim manager[^.·]{0,60})/i,
  ];
  for (const re of patterns) {
    const m = blob.match(re);
    if (!m?.[1]) continue;
    const note = m[1].replace(/\s+/g, " ").trim().replace(/[.,;]+$/, "");
    if (note.length >= 12 && note.length <= 160) return note[0]!.toUpperCase() + note.slice(1);
  }
  return null;
}

function extractBbrefInterimRecord(html: string): { yearWins: number | null; yearLosses: number | null } {
  const year = new Date().getFullYear();
  // Current-season row with interim comment.
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html))) {
    const row = m[1];
    const y = stripTags(row.match(/data-stat="year_ID"[^>]*>([\s\S]*?)<\/t/i)?.[1] ?? "");
    if (y !== String(year)) continue;
    const comments = stripTags(row.match(/data-stat="comments"[^>]*>([\s\S]*?)<\/t/i)?.[1] ?? "");
    if (!/interim/i.test(comments) && !/interim/i.test(stripTags(row))) continue;
    const wins = parseBbrefInt(stripTags(row.match(/data-stat="W"[^>]*>([\s\S]*?)<\/t/i)?.[1] ?? ""));
    const losses = parseBbrefInt(stripTags(row.match(/data-stat="L"[^>]*>([\s\S]*?)<\/t/i)?.[1] ?? ""));
    if (wins != null && losses != null && wins + losses > 0) {
      return { yearWins: wins, yearLosses: losses };
    }
  }
  return { yearWins: null, yearLosses: null };
}

async function scrapeBbrefManager(name: string) {
  const url = await findBbrefManagerUrl(name);
  if (!url) return { error: "Manager page not found", name };
  const html = await (
    await timedFetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html", Referer: "https://www.baseball-reference.com/" },
    })
  ).text();
  if (/404|Page Not Found/i.test(html) && !/manager_stats/.test(html)) {
    return { error: "Manager page not found", name };
  }
  const i = html.indexOf('id="div_manager_stats"');
  // Keep the primary manager_stats table only — later abbr/team tables are 0–0 junk.
  const tableEnd = i >= 0 ? html.indexOf("</table>", i) : -1;
  const chunk =
    i >= 0
      ? html.slice(i, tableEnd > i ? tableEnd + 8 : i + 40000)
      : html;
  const rows = [...chunk.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1]);
  const cell = (row: string, key: string) => {
    const m = row.match(new RegExp(`data-stat="${key}"[^>]*>([\\s\\S]*?)</t`, "i"));
    return m ? stripTags(m[1]) : "";
  };
  const seasons: {
    season: number;
    team: string;
    league: string;
    games: number;
    wins: number;
    losses: number;
    pct: string;
    finish: number | null;
    postWins: number;
    postLosses: number;
    comments: string;
  }[] = [];
  for (const row of rows) {
    const yearRaw = cell(row, "year_ID");
    const wins = parseBbrefInt(cell(row, "W"));
    const losses = parseBbrefInt(cell(row, "L"));
    const team = cell(row, "team_ID") || "—";
    // Skip empty / abbreviation summary rows (COL/ATL with blank W-L → Number('') === 0).
    if (!/^\d{4}$/.test(yearRaw) || wins == null || losses == null) continue;
    if (wins + losses <= 0) continue;
    if (/^[A-Z]{2,3}$/.test(team)) continue;
    const finishRaw = cell(row, "finish");
    const comments = cell(row, "comments") || "";
    seasons.push({
      season: Number(yearRaw),
      team,
      league: cell(row, "lg_ID") || "",
      games: parseBbrefInt(cell(row, "G")) ?? wins + losses,
      wins,
      losses,
      pct: cell(row, "win_loss_perc") || ".000",
      finish: finishRaw && /^\d+$/.test(finishRaw) ? Number(finishRaw) : null,
      postWins: parseBbrefInt(cell(row, "W_post")) ?? 0,
      postLosses: parseBbrefInt(cell(row, "L_post")) ?? 0,
      comments,
    });
  }
  // Totals row: empty year, empty team — keep the largest W+L (ignore trailing 0–0 junk).
  let career: {
    wins: number;
    losses: number;
    pct: string;
    games: number;
    postWins: number;
    postLosses: number;
  } | null = null;
  for (const row of rows) {
    const yearRaw = cell(row, "year_ID");
    const team = cell(row, "team_ID");
    const wins = parseBbrefInt(cell(row, "W"));
    const losses = parseBbrefInt(cell(row, "L"));
    if (yearRaw !== "" || team !== "" || wins == null || losses == null) continue;
    if (wins + losses <= 0) continue;
    const next = {
      wins,
      losses,
      pct: cell(row, "win_loss_perc") || ".000",
      games: parseBbrefInt(cell(row, "G")) ?? wins + losses,
      postWins: parseBbrefInt(cell(row, "W_post")) ?? 0,
      postLosses: parseBbrefInt(cell(row, "L_post")) ?? 0,
    };
    if (!career || next.wins + next.losses > career.wins + career.losses) career = next;
  }
  if (!career && seasons.length) {
    const wins = seasons.reduce((s, x) => s + x.wins, 0);
    const losses = seasons.reduce((s, x) => s + x.losses, 0);
    const postWins = seasons.reduce((s, x) => s + x.postWins, 0);
    const postLosses = seasons.reduce((s, x) => s + x.postLosses, 0);
    career = {
      wins,
      losses,
      pct: wins + losses > 0 ? (wins / (wins + losses)).toFixed(3).replace(/^0/, "") : ".000",
      games: wins + losses,
      postWins,
      postLosses,
    };
  }

  const stints: {
    team: string;
    start: number;
    end: number;
    wins: number;
    losses: number;
    pct: string;
    departure: string | null;
    departureUrl: string | null;
  }[] = [];
  for (const s of seasons) {
    const last = stints[stints.length - 1];
    if (last && last.team === s.team && s.season === last.end + 1) {
      last.end = s.season;
      last.wins += s.wins;
      last.losses += s.losses;
      const g = last.wins + last.losses;
      last.pct = g > 0 ? (last.wins / g).toFixed(3).replace(/^0/, "") : ".000";
    } else {
      stints.push({
        team: s.team,
        start: s.season,
        end: s.season,
        wins: s.wins,
        losses: s.losses,
        pct: s.pct,
        departure: null,
        departureUrl: null,
      });
    }
  }

  const currentYear = new Date().getFullYear();
  // Baseline departure blurb from final season of each completed stint.
  for (let i = 0; i < stints.length; i++) {
    const st = stints[i];
    const isCurrent = i === stints.length - 1 && st.end >= currentYear - 0;
    if (isCurrent) {
      st.departure = null;
      st.departureUrl = null;
      continue;
    }
    const lastSeason = seasons.filter((s) => s.team === st.team && s.season === st.end)[0];
    const finish =
      lastSeason?.finish != null ? `${lastSeason.finish}${ordinal(lastSeason.finish)}` : null;
    st.departure =
      lastSeason?.comments ||
      `Left ${st.team} after ${st.end} (${st.wins}-${st.losses}${finish ? `, ${finish}` : ""})`;
  }

  // Upgrade departures with a news headline when available (best-effort, timed).
  try {
    await Promise.race([
      Promise.all(
        stints
          .filter((st) => st.departure)
          .slice(0, 3)
          .map(async (st) => {
            const teamHint = st.team.split(" ").pop() || st.team;
            const news = await fetchGoogleNews(
              `"${name}" ${teamHint} (fired OR dismissed OR "will not return" OR parted OR "mutual agreement") manager MLB`,
              3,
            );
            const hit = news.find((n) =>
              /fired|dismiss|will not return|parted|mutual|hired|named|replace/i.test(n.title),
            );
            if (hit) {
              st.departure = hit.title;
              st.departureUrl = hit.url;
            }
          }),
      ),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  } catch {
    /* keep baseline departure blurbs */
  }

  const divisionTitles = seasons.filter((s) => s.finish === 1).length;
  const postseasonAppearances = seasons.filter((s) => s.postWins + s.postLosses > 0).length;
  const managedYears = new Set(seasons.map((s) => s.season));
  const worldSeriesYears = [
    ...html.matchAll(/World Series[^<]{0,80}?(\d{4})/gi),
    ...html.matchAll(/(\d{4})[^<]{0,40}World Series/gi),
  ]
    .map((m) => Number(m[1]))
    .filter((y) => Number.isFinite(y) && managedYears.has(y));
  const worldSeriesAppearances = new Set(worldSeriesYears).size;
  const moy = [...html.matchAll(/Manager of the Year \((\d)(?:st|nd|rd|th)\)/gi)].map((m) =>
    Number(m[1]),
  );
  const managerOfYearWins = moy.filter((p) => p === 1).length;
  const photo = extractBbrefManagerPhoto(html);
  const leash = detectManagerLeash(html);
  const interim =
    leash.interim || seasons.some((s) => /interim/i.test(s.comments));

  return {
    source: "baseball-reference",
    url,
    name,
    photo,
    seasons,
    stints,
    career,
    interim,
    shortLeash: leash.shortLeash || interim,
    divisionTitles,
    postseasonAppearances,
    worldSeriesAppearances,
    worldSeriesYears: [...new Set(worldSeriesYears)],
    managerOfYearWins,
    managerOfYearFinishes: moy,
  };
}

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return "th";
  return ["th", "st", "nd", "rd", "th", "th", "th", "th", "th", "th"][Math.min(n % 10, 9)];
}

async function fetchGoogleNews(
  query: string,
  limit = 8,
): Promise<{ title: string; url: string; source: string }[]> {
  const rss = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const xml = await (await timedFetch(rss, { headers: { "User-Agent": UA, Accept: "application/rss+xml,application/xml,text/xml" } })).text();
    const items: { title: string; url: string; source: string }[] = [];
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
      const block = m[1];
      const title = stripTags(
        (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i)?.[1] ??
          block.match(/<title>([^<]+)<\/title>/i)?.[1] ??
          "").replace(/ - [^-]+$/, ""),
      );
      const link =
        block.match(/<link>([^<]+)<\/link>/i)?.[1] ??
        block.match(/url="([^"]+)"/i)?.[1] ??
        "";
      const source =
        stripTags(block.match(/<source[^>]*>([^<]+)<\/source>/i)?.[1] ?? "") || "News";
      if (!title || title.length < 18 || !link) continue;
      if (/google news/i.test(title)) continue;
      items.push({ title, url: link, source });
      if (items.length >= limit) break;
    }
    return items;
  } catch {
    return [];
  }
}

function isRelevantMlbManagerRumor(title: string, url: string, named?: string | null): boolean {
  const text = `${title} ${url}`;
  // Wrong sports / roles / off-topic
  if (
    /\b(NFL|NHL|NBA|MLS|WNBA|college football|NCAA|Red Wings|general managers?|\bGM\b|head coach|jersey retirement|retire(?:s|d)? (?:his |her )?jersey|ejection|ejected|quick-hook)\b/i.test(
      text,
    )
  ) {
    return false;
  }
  const mlbCue = /\b(MLB|Major League|baseball|skipper|managerial)\b/i.test(text);
  const managerCue = /\bmanagers?\b|\bskipper\b|\bbench boss\b/i.test(text);
  const heatCue =
    /\b(hot seat|on the hot seat|fired|dismissed|will be fired|will not return|ousted|axed|job security|under fire)\b/i.test(
      text,
    );
  if (!heatCue || !managerCue) return false;
  // Prefer explicit MLB cues; allow manager+heat when clearly not another sport (already filtered).
  if (!mlbCue && !/\b(AL|NL|American League|National League)\b/i.test(text)) {
    // still ok if title is clearly "MLB managers" style; otherwise require mlbCue for league feed
    if (!named) return false;
  }
  if (named?.trim()) {
    const parts = named.trim().split(/\s+/);
    const last = parts[parts.length - 1];
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!new RegExp(esc(last), "i").test(text) && !new RegExp(esc(named), "i").test(text)) {
      return false;
    }
  }
  return true;
}

async function scrapeManagerRumors(name?: string | null) {
  const empty = { name: name ?? null, items: [] as { title: string; url: string; source: string; channel: string }[], checkedAt: new Date().toISOString() };
  return withBudget(HEAVY_MS, async () => {
    const year = new Date().getFullYear();
    const queries = name?.trim()
      ? [
          `"${name.trim()}" MLB (manager OR skipper) ("hot seat" OR fired OR dismissed OR "will not return")`,
          `"${name.trim()}" (manager OR skipper) ("hot seat" OR fired) (site:x.com OR site:twitter.com OR site:reddit.com OR site:bsky.app)`,
        ]
      : [
          `MLB (manager OR skipper) ("hot seat" OR "on the hot seat" OR fired OR dismissed) ${year}`,
          `("hot seat" OR fired OR dismissed) (manager OR skipper) MLB -NFL -NHL -NBA -coach`,
          `MLB manager ("hot seat" OR fired) (site:x.com OR site:twitter.com OR site:reddit.com/r/baseball OR site:bsky.app)`,
        ];

    const seen = new Set<string>();
    const items: { title: string; url: string; source: string; channel: string }[] = [];

    for (const q of queries) {
      for (const hit of await fetchGoogleNews(q, 10)) {
        if (seen.has(hit.url)) continue;
        if (!isRelevantMlbManagerRumor(hit.title, hit.url, name)) continue;
        seen.add(hit.url);
        const social = /x\.com|twitter\.com|reddit\.com|bsky\.app|nitter/i.test(hit.url);
        items.push({
          ...hit,
          source: social ? hit.source || "Social" : hit.source,
          channel: social ? "social" : "news",
        });
        if (items.length >= 8) break;
      }
      if (items.length >= 8) break;
    }

    // Fallback scrapers when RSS is thin — keep short so workers don't pin.
    if (items.length < 3) {
      const q = queries[0];
      const urls = [
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
        `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
      ];
      for (const searchUrl of urls) {
        try {
          const html = await (
            await timedFetch(
              searchUrl,
              { headers: { "User-Agent": UA, Accept: "text/html" } },
              SEARCH_MS,
            )
          ).text();
          for (const m of html.matchAll(
            /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
          )) {
            const href = m[1];
            const title = stripTags(m[2]);
            if (!title || title.length < 20 || title.length > 180) continue;
            if (/duckduckgo|bing\.com|microsoft|google\.|yahoo\./i.test(href)) continue;
            if (!isRelevantMlbManagerRumor(title, href, name)) continue;
            if (seen.has(href)) continue;
            seen.add(href);
            let source = "News";
            try {
              source = new URL(href).hostname.replace(/^www\./, "");
            } catch {
              /* */
            }
            const social = /x\.com|twitter\.com|reddit\.com|bsky\.app/i.test(href);
            items.push({
              title,
              url: href,
              source,
              channel: social ? "social" : "news",
            });
            if (items.length >= 8) break;
          }
        } catch {
          /* */
        }
        if (items.length >= 8) break;
      }
    }

    return { name: name ?? null, items: items.slice(0, 8), checkedAt: new Date().toISOString() };
  }, empty);
}

async function scrapeBbrefManagerPhoto(name: string) {
  const url = await findBbrefManagerUrl(name);
  if (!url) {
    return {
      error: "Manager page not found",
      name,
      photo: null as string | null,
      interim: false,
      shortLeash: false,
      contractNote: null as string | null,
      yearWins: null as number | null,
      yearLosses: null as number | null,
    };
  }
  const html = await (
    await timedFetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html", Referer: "https://www.baseball-reference.com/" },
    })
  ).text();
  const leash = detectManagerLeash(html);
  const interimRecord = extractBbrefInterimRecord(html);
  return {
    source: "baseball-reference",
    url,
    name,
    photo: extractBbrefManagerPhoto(html),
    contractNote: extractBbrefManagerContract(html),
    ...leash,
    ...interimRecord,
  };
}

async function scrapeManagerFiredOdds() {
  // Prefer Kalshi public market search for "manager" MLB out contracts.
  const items: { name: string; team?: string | null; oddsAmerican: string; impliedPct: number | null; source: string; url: string }[] = [];
  try {
    const url = "https://api.elections.kalshi.com/trade-api/v2/markets?limit=50&status=open&series_ticker=KXCOACHOUTMLB";
    const res = await timedFetch(url, { headers: { Accept: "application/json", "User-Agent": UA } });
    if (res.ok) {
      const data = await res.json() as {
        markets?: {
          title?: string;
          subtitle?: string;
          ticker?: string;
          yes_bid?: number | null;
          yes_ask?: number | null;
          last_price?: number | null;
          yes_bid_dollars?: string | null;
          yes_ask_dollars?: string | null;
          last_price_dollars?: string | null;
          no_sub_title?: string | null;
          custom_strike?: { Coach?: string; Team?: string } | null;
        }[];
      };
      const dollarProb = (raw: string | null | undefined): number | null => {
        if (raw == null || raw === "") return null;
        const n = Number(raw);
        if (!Number.isFinite(n) || n <= 0) return null;
        return Math.max(0.01, Math.min(0.99, n));
      };
      for (const m of data.markets ?? []) {
        const name =
          (m.custom_strike?.Coach ?? m.no_sub_title ?? "").trim() ||
          (() => {
            const title = `${m.title ?? ""} ${m.subtitle ?? ""}`;
            // Legacy titles like "Will Matt Quatraro be out as manager..."
            const nameMatch = title.match(/Will\s+([A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.']+){0,3})\s+be\s+out/i)
              ?? title.match(/([A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.']+){1,3})/);
            return nameMatch?.[1]?.trim() ?? "";
          })();
        if (!name || /field|any other/i.test(name)) continue;
        // Prefer mid of bid/ask dollars; fall back to last trade, then legacy cent prices.
        const bid = dollarProb(m.yes_bid_dollars);
        const ask = dollarProb(m.yes_ask_dollars);
        const last = dollarProb(m.last_price_dollars);
        let p: number | null = null;
        if (bid != null && ask != null) p = (bid + ask) / 2;
        else p = ask ?? bid ?? last;
        if (p == null) {
          const cents = m.last_price ?? m.yes_ask ?? m.yes_bid ?? null;
          if (cents == null) continue;
          p = Math.max(0.01, Math.min(0.99, cents / 100));
        }
        const american = p >= 0.5
          ? `-${Math.round((100 * p) / (1 - p))}`
          : `+${Math.round((100 * (1 - p)) / p)}`;
        items.push({
          name,
          team: m.custom_strike?.Team ?? null,
          oddsAmerican: american,
          impliedPct: Math.round(p * 1000) / 10,
          source: "Kalshi",
          url: `https://kalshi.com/markets/${(m.ticker ?? "").toLowerCase()}`,
        });
      }
    }
  } catch { /* */ }

  if (!items.length) {
    // Fallback: scrape BetOnline futures page text for american odds lines.
    try {
      const html = await (await timedFetch(
        "https://www.betonline.ag/sportsbook/futures-and-props/mlb-specials/manager-fired",
        { headers: { "User-Agent": UA, Accept: "text/html" } },
        SEARCH_MS,
      )).text();
      for (const m of html.matchAll(/([A-Z][a-z]+(?:\s+[A-Z][a-z.]+)+)\s*<[^>]*>\s*([+-]\d{2,4})/g)) {
        items.push({
          name: m[1],
          team: null,
          oddsAmerican: m[2],
          impliedPct: null,
          source: "BetOnline",
          url: "https://www.betonline.ag/sportsbook/futures-and-props/mlb-specials/manager-fired",
        });
      }
    } catch { /* */ }
  }

  items.sort((a, b) => (b.impliedPct ?? 0) - (a.impliedPct ?? 0));
  return { source: items[0]?.source ?? "none", checkedAt: new Date().toISOString(), items: items.slice(0, 20) };
}

async function scrapeNflCoachFiredOdds() {
  const items: {
    name: string;
    teamHint: string | null;
    oddsAmerican: string;
    impliedPct: number;
    ticker: string;
    url: string;
  }[] = [];
  const url =
    "https://api.elections.kalshi.com/trade-api/v2/markets?limit=50&status=open&series_ticker=KXCOACHOUTNFL";
  const res = await timedFetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`Kalshi NFL coaches ${res.status}`);
  const data = (await res.json()) as {
    markets?: {
      title?: string;
      subtitle?: string;
      ticker?: string;
      yes_sub_title?: string | null;
      no_sub_title?: string | null;
      yes_bid_dollars?: string | null;
      yes_ask_dollars?: string | null;
      last_price_dollars?: string | null;
      custom_strike?: { Coach?: string; Team?: string } | null;
    }[];
  };
  const dollarProb = (raw: string | null | undefined): number | null => {
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return null;
    if (n === 0) return 0;
    return Math.max(0.01, Math.min(0.99, n));
  };
  for (const m of data.markets ?? []) {
    const name =
      (m.custom_strike?.Coach ?? m.yes_sub_title ?? m.no_sub_title ?? "").trim() || "";
    if (!name || /field|any other/i.test(name)) continue;
    const bid = dollarProb(m.yes_bid_dollars);
    const ask = dollarProb(m.yes_ask_dollars);
    const last = dollarProb(m.last_price_dollars);
    let p: number | null = null;
    if (bid != null && ask != null && (bid > 0 || ask > 0)) p = (bid + ask) / 2;
    else p = (ask && ask > 0 ? ask : null) ?? (bid && bid > 0 ? bid : null) ?? last;
    if (p == null || p <= 0) continue;
    const american =
      p >= 0.5
        ? `-${Math.round((100 * p) / (1 - p))}`
        : `+${Math.round((100 * (1 - p)) / p)}`;
    const subtitle = (m.subtitle ?? "").replace(/^:+\s*/, "").trim();
    items.push({
      name,
      teamHint: subtitle || m.custom_strike?.Team || null,
      oddsAmerican: american,
      impliedPct: Math.round(p * 1000) / 10,
      ticker: m.ticker ?? "",
      url: `https://kalshi.com/markets/${(m.ticker ?? "").toLowerCase()}`,
    });
  }
  items.sort((a, b) => b.impliedPct - a.impliedPct);
  return {
    source: items.length ? "Kalshi" : "none",
    checkedAt: new Date().toISOString(),
    items,
  };
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

async function scrapeGolferSeasonResults(golferId: string, year: number) {
  const url = `https://www.espn.com/golf/player/results/_/id/${encodeURIComponent(golferId)}/year/${year}`;
  // ESPN bot-walls full Chrome UAs with a tiny 202 page; a short Mozilla/5.0 UA returns the SSR table.
  const html = await (
    await timedFetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.espn.com/",
      },
    })
  ).text();
  const results: {
    event: string;
    date: string | null;
    position: string;
    score: string | null;
    tournamentId: string | null;
  }[] = [];
  const rowRe =
    /leaderboard\?tournamentId=(\d+)[^>]*>([^<]+)<\/a>[\s\S]*?<td class="Table__TD">([^<]*)<\/td>[\s\S]*?\((?:<!-- -->)?([-+]?\d+|E)(?:<!-- -->)?\)/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html))) {
    const pos = (m[3] ?? "").trim();
    if (!pos) continue;
    results.push({
      event: decodeHtmlEntities((m[2] ?? "").trim()),
      date: null,
      position: pos,
      score: m[4] === "E" ? "E" : m[4] ?? null,
      tournamentId: m[1] ?? null,
    });
  }
  // Fallback without score capture (CUT/WD rows).
  if (!results.length) {
    const loose =
      /leaderboard\?tournamentId=(\d+)[^>]*>([^<]+)<\/a>[\s\S]*?<td class="Table__TD">([^<]*)<\/td>/g;
    while ((m = loose.exec(html))) {
      const pos = (m[3] ?? "").trim();
      if (!pos || /Table__TD/.test(pos)) continue;
      results.push({
        event: decodeHtmlEntities((m[2] ?? "").trim()),
        date: null,
        position: pos,
        score: null,
        tournamentId: m[1] ?? null,
      });
    }
  }
  return { year, results };
}

async function scrapeGolferLastWin(golferId: string) {
  const yearNow = new Date().getUTCFullYear();
  for (let y = yearNow; y >= yearNow - 12; y--) {
    const { results } = await scrapeGolferSeasonResults(golferId, y);
    // ESPN lists chronologically — last win in a year is the latest 1/T1.
    const wins = results.filter((r) => /^(?:x)?1$/i.test(r.position));
    if (wins.length) {
      const last = wins[wins.length - 1]!;
      return {
        event: last.event,
        year: y,
        position: last.position,
        score: last.score,
        tournamentId: last.tournamentId,
      };
    }
  }
  return null;
}

/** Resolve a RotoWire golf player page from display name. */
async function resolveGolferRotoWireUrl(name: string): Promise<string | null> {
  const want = normPerson(name);
  const slugWant = want.replace(/\s+/g, "-");
  const last = want.split(" ").slice(-1)[0] ?? "";
  const newsUrl =
    `https://www.rotowire.com/golf/news.php?player=` + encodeURIComponent(name.trim());
  const html = await (
    await timedFetch(newsUrl, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html",
        Referer: "https://www.rotowire.com/golf/",
      },
    }, SEARCH_MS)
  ).text();

  const re =
    /href="(?:https:\/\/www\.rotowire\.com)?(\/golf\/player\/([a-z0-9-]+-\d+))"[^>]*>([^<]+)</gi;
  let m: RegExpExecArray | null;
  let soft: string | null = null;
  while ((m = re.exec(html))) {
    const path = m[1]!;
    const slug = (m[2] ?? "").toLowerCase();
    const label = normPerson(m[3] ?? "");
    if (
      label === want ||
      slug === slugWant ||
      slug.startsWith(`${slugWant}-`)
    ) {
      return `https://www.rotowire.com${path}`;
    }
    if (
      !soft &&
      last &&
      (label.includes(want) || want.includes(label) || slug.includes(last))
    ) {
      soft = `https://www.rotowire.com${path}`;
    }
  }

  const slugHit = html.match(new RegExp(`/golf/player/(${slugWant}-\\d+)`, "i"));
  if (slugHit?.[1]) return `https://www.rotowire.com/golf/player/${slugHit[1]}`;
  return soft;
}

/** After-round RotoWire blurbs for a golfer (player page scrape). */
async function scrapeGolferRotoNotes(name: string) {
  const trimmed = name.trim();
  if (trimmed.length < 3) return { name: trimmed, url: null, notes: [], error: "Bad name" };

  const url = await resolveGolferRotoWireUrl(trimmed);
  if (!url) {
    return { name: trimmed, url: null, notes: [], error: "Golfer not found on RotoWire" };
  }

  const html = await (
    await timedFetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html",
        Referer: "https://www.rotowire.com/golf/news.php",
      },
    }, HEAVY_MS)
  ).text();

  const notes: { headline: string; body: string; date: string | null }[] = [];
  const seen = new Set<string>();
  const itemRe =
    /<div class="news-update__headline">([\s\S]*?)<\/div>[\s\S]*?<div class="news-update__timestamp">([\s\S]*?)<\/div>[\s\S]*?<div class="news-update__news">([\s\S]*?)<\/div>(?:[\s\S]*?<div class="news-update__analysis">([\s\S]*?)<\/div>)?/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(html))) {
    const headline = decodeHtmlEntities(stripTags(m[1] ?? "")).replace(/\s+/g, " ").trim();
    const date = decodeHtmlEntities(stripTags(m[2] ?? "")).replace(/\s+/g, " ").trim() || null;
    const news = decodeHtmlEntities(stripTags(m[3] ?? "")).replace(/\s+/g, " ").trim();
    const analysisRaw = decodeHtmlEntities(stripTags(m[4] ?? ""))
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^ANALYSIS\s*/i, "")
      .trim();
    const analysis =
      analysisRaw && !/subscribe now/i.test(analysisRaw) ? analysisRaw : "";
    const body = [news, analysis].filter(Boolean).join(" ").trim();
    if (!headline || !body) continue;
    const key = headline.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    notes.push({ headline, body, date });
    if (notes.length >= 8) break;
  }

  if (!notes.length) {
    return { name: trimmed, url, notes: [], error: "No RotoWire notes found" };
  }
  return { name: trimmed, url, notes };
}

type PipelineBio = { contentTitle?: string | null; contentText?: string | null };
type PipelineRow = {
  rank?: number | null;
  playerEntity?: {
    position?: string | null;
    eta?: string | null;
    player?: { id?: number | null; fullName?: string | null } | null;
    prospectBio?: PipelineBio[] | null;
  } | null;
};



function parsePipelineBio(contentText: string): {
  gradesLine: string | null;
  grades: { label: string; value: string }[];
  paragraphs: string[];
} {
  const html = decodeHtmlEntities(contentText);
  const gradeMatch = html.match(
    /Scouting grades:\s*<\/strong>\s*([^<]+)/i,
  ) || html.match(/<strong>\s*Scouting grades:?\s*<\/strong>\s*([^<]+)/i);
  const gradesLine = gradeMatch?.[1]?.replace(/\s+/g, " ").trim() || null;
  const grades: { label: string; value: string }[] = [];
  if (gradesLine) {
    for (const part of gradesLine.split("|")) {
      const m = part.trim().match(/^([^:]+):\s*(\d+)\s*$/);
      if (m) grades.push({ label: m[1].trim(), value: m[2] });
    }
  }
  const paragraphs: string[] = [];
  for (const block of html.matchAll(/<p>([\s\S]*?)<\/p>/gi)) {
    const text = stripTags(block[1] ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    if (/^scouting grades:/i.test(text)) continue;
    if (/^video scouting report/i.test(text)) continue;
    paragraphs.push(text);
  }
  return { gradesLine, grades, paragraphs };
}

function slugifyPlayer(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** MLB.com “More Bio Info” narrative modal body. */
async function scrapeMlbPlayerBio(
  playerId: number,
  name: string,
): Promise<Record<string, unknown>> {
  const slug = slugifyPlayer(name || String(playerId));
  const url = `https://www.mlb.com/player/${slug}-${playerId}`;
  const res = await timedFetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
  });
  const html = await res.text();
  const bodyMatch =
    html.match(
      /id=["']playerBioModalBody["'][^>]*>\s*([\s\S]*?)\s*<\/div>\s*(?:<\/div>\s*)?(?:<footer|<\/section|<aside|$)/i,
    ) ??
    html.match(/id=["']playerBioModalBody["'][^>]*>\s*([\s\S]*?)\s*<\/div>/i);
  let raw = bodyMatch?.[1] ?? "";
  if (!raw || raw.length < 40) {
    return { error: "Bio not found", found: false, url };
  }
  // Keep year headings + paragraphs; strip scripts/styles.
  raw = raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .trim();
  const fullNameMatch = html.match(
    /class="[^"]*p-modal__title[^"]*"[^>]*>([^<]+)</i,
  );
  const text = stripTags(raw).replace(/\s+/g, " ").trim();
  // Light HTML cleanup for client rendering
  const cleanHtml = raw
    .replace(/<\/?(?:span|font)[^>]*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<h\d[^>]*>/gi, "\n\n")
    .replace(/<\/h\d>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return {
    found: true,
    fullName: fullNameMatch ? stripTags(fullNameMatch[1]).trim() : null,
    html: cleanHtml,
    text,
    url,
  };
}

/** Resolve BBRef player page HTML (shared with contract scrape). */
async function loadBbrefPlayerHtml(
  name: string,
  mlbId?: number | null,
): Promise<{ url: string; html: string } | null> {
  // Direct MLB id redirect is far faster/more reliable than search (and avoids
  // soft-timeouts that blank season WAR on the player card).
  if (mlbId != null && Number.isFinite(mlbId) && mlbId > 0) {
    try {
      const directUrl =
        `https://www.baseball-reference.com/redirect.fcgi?player=1&mlb_ID=${Math.trunc(mlbId)}`;
      const directRes = await timedFetch(directUrl, {
        headers: { "User-Agent": UA, Accept: "text/html" },
        redirect: "follow",
      });
      const html = await directRes.text();
      if (
        /\/players\/[a-z]\/[a-z0-9]+\.shtml/i.test(directRes.url) &&
        html.length > 20_000 &&
        !/just a moment|cf-browser-verification/i.test(html)
      ) {
        return { url: directRes.url, html };
      }
    } catch {
      /* fall through to name search */
    }
  }

  const q = encodeURIComponent(name.trim());
  const searchUrl = `https://www.baseball-reference.com/search/search.fcgi?search=${q}`;
  const searchRes = await timedFetch(searchUrl, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    redirect: "follow",
  });
  let html = await searchRes.text();
  let playerUrl = searchRes.url;
  const want = name.trim().toLowerCase();
  if (!/\/players\/[a-z]\/[a-z0-9]+\.shtml/i.test(playerUrl)) {
    const linkRe = /href="(\/players\/[a-z]\/[a-z0-9]+\.shtml)"[^>]*>([^<]{2,80})<\/a>/gi;
    let best: { path: string; score: number } | null = null;
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(html))) {
      const label = stripTags(m[2]).toLowerCase();
      let score = 0;
      if (label === want) score = 100;
      else if (label.startsWith(want) || want.startsWith(label)) score = 80;
      else if (label.includes(want.split(/\s+/).slice(-1)[0] ?? "")) score = 40;
      if (!best || score > best.score) best = { path: m[1], score };
    }
    const fallback = html.match(/href="(\/players\/[a-z]\/[a-z0-9]+\.shtml)"/i);
    const path = (best && best.score >= 40 ? best.path : null) ?? fallback?.[1];
    if (!path) return null;
    playerUrl = `https://www.baseball-reference.com${path}`;
    html = await (
      await timedFetch(playerUrl, {
        headers: { "User-Agent": UA, Accept: "text/html", Referer: searchUrl },
      })
    ).text();
  }
  return { url: playerUrl, html };
}

/** Prefer current-season WAR from a year+stat table instead of the last numeric cell sitewide. */
function parseBbrefSeasonAndCareerWar(
  searchable: string,
  warStat: string,
): { seasonWar: number | null; careerWar: number | null } {
  const year = new Date().getFullYear();
  const yearWars: { year: number; war: number }[] = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(searchable))) {
    const row = m[1];
    // Skip headers + summary rows (162 Game Avg, multi-year team/league totals).
    if (
      /thead|colhead|over_header|162\s*Game|colspan\s*=\s*["']?\d/i.test(row) ||
      /data-stat="year_id"[^>]*>\s*(?:<[^>]+>)?\s*Yrs\b/i.test(row)
    ) {
      continue;
    }
    const y =
      row.match(/data-stat="year_id"[^>]*>\s*(?:<a[^>]*>)?\s*(\d{4})/i)?.[1] ??
      row.match(/data-stat="year_id"[^>]*\bcsk="(\d{4})"/i)?.[1] ??
      row.match(/href="\/players\/gl\.fcgi[^"]*year=(\d{4})/i)?.[1];
    const w = row.match(new RegExp(`data-stat="${warStat}"[^>]*>([^<]*)`, "i"))?.[1]?.trim();
    if (!y || !w || !/^-?[0-9.]+$/.test(w)) continue;
    yearWars.push({ year: Number(y), war: Number(w) });
  }
  const seasonRows = yearWars.filter((r) => r.year === year);
  const seasonWar = seasonRows.length
    ? seasonRows[seasonRows.length - 1]!.war
    : yearWars.length
      ? yearWars[yearWars.length - 1]!.war
      : null;

  let careerWar: number | null = null;
  const foot = searchable.match(
    new RegExp(`<tfoot>[\\s\\S]*?data-stat="${warStat}"[^>]*>([^<]*)`, "i"),
  );
  if (foot && /^-?[0-9.]+$/.test(foot[1].trim())) careerWar = Number(foot[1].trim());
  if (careerWar == null) {
    // Unique years only — avoid double-counting value + standard tables.
    const byYear = new Map<number, number>();
    for (const r of yearWars) byYear.set(r.year, r.war);
    if (byYear.size) {
      careerWar =
        Math.round([...byYear.values()].reduce((a, b) => a + b, 0) * 10) / 10;
    }
  }
  return { seasonWar, careerWar };
}

/** Service time + WAR (+ optional league WAR rank) from Baseball Reference. */
async function scrapePlayerExtras(
  name: string,
  isPitcher: boolean,
  mlbId?: number | null,
): Promise<Record<string, unknown>> {
  const page = await loadBbrefPlayerHtml(name, mlbId);
  if (!page) return { error: "Player not found on Baseball Reference", name };
  const searchable = page.html.replace(/<!--([\s\S]*?)-->/g, "$1");
  const stMatch =
    searchable.match(
      /Service Time(?:\s*\([^)]*\))?\s*<\/strong>\s*:?\s*([0-9]+(?:\.[0-9]+)?)/i,
    ) ??
    searchable.match(/Service Time[^<]{0,60}<\/strong>\s*:?\s*([0-9]+(?:\.[0-9]+)?)/i) ??
    searchable.match(/Service Time[^:]*:\s*([0-9]+(?:\.[0-9]+)?)/i);
  const serviceTime = stMatch?.[1] ?? null;
  const primary = isPitcher ? "p_war" : "b_war";
  const secondary = isPitcher ? "b_war" : "p_war";
  let { seasonWar, careerWar } = parseBbrefSeasonAndCareerWar(searchable, primary);
  // Two-way players / misclassified pitchers: fall back to the other WAR column.
  if (seasonWar == null && careerWar == null) {
    ({ seasonWar, careerWar } = parseBbrefSeasonAndCareerWar(searchable, secondary));
  }

  // Core fields only — skip league-rank scrape (extra BBRef page) so WAR survives soft timeouts.
  return {
    source: "baseball-reference",
    url: page.url,
    name,
    serviceTime,
    seasonWar,
    careerWar,
    warRank: null as number | null,
    warOf: null as number | null,
  };
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function parseCompactMoney(raw: string): number | null {
  const t = decodeHtmlEntities(raw).replace(/,/g, "").trim();
  if (!t || t === "—" || t === "-" || /^free/i.test(t)) return null;
  const m = t.match(/^\$?\s*([\d.]+)\s*([kmb])?/i);
  if (!m) return parseMoney(t);
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = (m[2] ?? "").toLowerCase();
  if (unit === "k") return Math.round(n * 1_000);
  if (unit === "m") return Math.round(n * 1_000_000);
  if (unit === "b") return Math.round(n * 1_000_000_000);
  return Math.round(n);
}

/** Baseball-Reference team season summary (org / park / pythag). */
async function scrapeTeamBbrefSummary(
  abbrev: string,
  season: number,
): Promise<Record<string, unknown>> {
  const abbr = abbrev.toUpperCase();
  const url = `https://www.baseball-reference.com/teams/${abbr}/${season}.shtml`;
  const res = await timedFetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
  });
  if (!res.ok) return { error: `BBRef team ${res.status}`, abbrev: abbr, season };
  const html = (await res.text()).replace(/<!--([\s\S]*?)-->/g, "$1");
  const pickStrong = (label: string) => {
    const re = new RegExp(
      `<strong>${label}:</strong>\\s*([\\s\\S]*?)(?:</p>|<p>|$)`,
      "i",
    );
    const m = html.match(re);
    if (!m) return null;
    return decodeHtmlEntities(stripTags(m[1])).replace(/\s+/g, " ").trim() || null;
  };
  const managerRaw = pickStrong("Manager");
  const managerMatch = managerRaw?.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  const recordBlock = html.match(/Record:<\/strong>\s*([\s\S]{0,280}?)<\/p>/i);
  const recordText = recordBlock
    ? decodeHtmlEntities(stripTags(recordBlock[1])).replace(/\s+/g, " ").trim()
    : null;
  const recordMatch = recordText?.match(/(\d+-\d+)/);
  const placeMatch = recordText?.match(/(\d+(?:st|nd|rd|th)\s+place\s+in\s+[^,]+)/i);
  const pythagBlock = html.match(/Pythagorean W-L:?\s*([\s\S]{0,120}??)(?:More team|<\/)/i);
  const pythagText = pythagBlock
    ? decodeHtmlEntities(stripTags(pythagBlock[1])).replace(/\s+/g, " ").trim()
    : null;
  const pythagRecord = pythagText?.match(/(\d+-\d+)/)?.[1] ?? null;
  const runsScored = pythagText?.match(/(\d+)\s*Runs/i)?.[1] ?? null;
  const runsAllowed = pythagText?.match(/(\d+)\s*Runs Allowed/i)?.[1] ?? null;
  const multi = html.match(
    /Multi-year:<\/strong>\s*Batting\s*-\s*(\d+)[,\s]*Pitching\s*-\s*(\d+)/i,
  );
  const oneYear = html.match(
    /One-year:<\/strong>\s*Batting\s*-\s*(\d+)[,\s]*Pitching\s*-\s*(\d+)/i,
  );
  const attendanceRaw = pickStrong("Attendance");
  const salaryHref =
    html.match(/href="(\/teams\/[^"]*salaries[^"]*)"/i)?.[1] ??
    `/teams/${abbr}/${abbr.toLowerCase()}-salaries-and-contracts.shtml`;

  return {
    source: "baseball-reference",
    url,
    salariesUrl: salaryHref.startsWith("http")
      ? salaryHref
      : `https://www.baseball-reference.com${salaryHref}`,
    season,
    abbrev: abbr,
    record: recordMatch?.[1] ?? null,
    standing: placeMatch?.[1] ?? null,
    manager: managerMatch
      ? { name: managerMatch[1]!.trim(), record: managerMatch[2]!.trim() }
      : managerRaw
        ? { name: managerRaw, record: null }
        : null,
    president: pickStrong("President"),
    farmDirector: pickStrong("Farm Director"),
    scoutingDirector: pickStrong("Scouting Director"),
    ballpark: pickStrong("Ballpark"),
    attendance: attendanceRaw,
    parkFactors: {
      multiYear: multi
        ? { batting: Number(multi[1]), pitching: Number(multi[2]) }
        : null,
      oneYear: oneYear
        ? { batting: Number(oneYear[1]), pitching: Number(oneYear[2]) }
        : null,
      note: "Over 100 favors batters, under 100 favors pitchers.",
    },
    pythagorean: {
      record: pythagRecord,
      runsScored: runsScored ? Number(runsScored) : null,
      runsAllowed: runsAllowed ? Number(runsAllowed) : null,
    },
  };
}

/** Team payroll / contracts table from Baseball-Reference. */
async function scrapeTeamPayroll(abbrev: string): Promise<Record<string, unknown>> {
  const abbr = abbrev.toUpperCase();
  // Resolve salaries URL from the current season team page when possible.
  const season = new Date().getFullYear();
  let salariesUrl: string | null = null;
  try {
    const teamPage = await timedFetch(
      `https://www.baseball-reference.com/teams/${abbr}/${season}.shtml`,
      { headers: { "User-Agent": UA, Accept: "text/html" } },
      10_000,
    );
    if (teamPage.ok) {
      const teamHtml = await teamPage.text();
      const href = teamHtml.match(/href="(\/teams\/[^"]*salaries[^"]*)"/i)?.[1];
      if (href) {
        salariesUrl = href.startsWith("http")
          ? href
          : `https://www.baseball-reference.com${href}`;
      }
    }
  } catch {
    /* fall through */
  }
  if (!salariesUrl) {
    return { error: "Could not resolve salaries URL", abbrev: abbr };
  }

  const res = await timedFetch(salariesUrl, {
    headers: { "User-Agent": UA, Accept: "text/html" },
  });
  if (!res.ok) return { error: `BBRef payroll ${res.status}`, abbrev: abbr };
  let html = (await res.text()).replace(/<!--([\s\S]*?)-->/g, "$1");
  if (!/id="payroll"/i.test(html)) {
    return { error: "Payroll table not found", abbrev: abbr, url: salariesUrl };
  }

  const table = html.match(/<table[^>]*id="payroll"[\s\S]*?<\/table>/i)?.[0] ?? "";
  const rows: {
    name: string;
    age: string | null;
    experience: string | null;
    serviceTime: string | null;
    acquired: string | null;
    contractStatus: string | null;
    salary: string | null;
    salaryAmount: number | null;
    bbrefId: string | null;
  }[] = [];
  const year = String(new Date().getFullYear());
  for (const rowHtml of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = rowHtml[1];
    if (/data-stat="player"[^>]*scope="col"/i.test(row) || !/data-stat="player"/i.test(row)) {
      continue;
    }
    const cell = (stat: string) => {
      const m = row.match(
        new RegExp(`data-stat="${stat}"[^>]*>([\\s\\S]*?)</t[dh]`, "i"),
      );
      return m ? decodeHtmlEntities(stripTags(m[1])).replace(/\s+/g, " ").trim() : null;
    };
    const name = cell("player");
    if (!name || /^(name|player)$/i.test(name)) continue;
    const salaryRaw = cell("contract_y0") ?? cell(`salary_${year}`) ?? cell("salary");
    const bbrefId = row.match(/\/players\/[a-z]\/([a-z0-9]+)\.shtml/i)?.[1] ?? null;
    rows.push({
      name,
      age: cell("age"),
      experience: cell("experience"),
      serviceTime: cell("service_time"),
      acquired: cell("how_acquired"),
      contractStatus: cell("contract_summary"),
      salary: salaryRaw,
      salaryAmount: salaryRaw ? parseCompactMoney(salaryRaw) : null,
      bbrefId,
    });
  }

  const payrollTotal = rows.reduce((sum, r) => sum + (r.salaryAmount ?? 0), 0);

  return {
    source: "baseball-reference",
    url: salariesUrl,
    abbrev: abbr,
    season: year,
    payrollTotal,
    payrollTotalDisplay: payrollTotal ? moneyDisplay(payrollTotal) : null,
    rows,
  };
}

/** MLB Pipeline scouting grades + narrative for a prospect (hide when absent). */
async function scrapePipelineScouting(playerId: number): Promise<Record<string, unknown>> {
  const year = new Date().getFullYear();
  const query = `
    query PipelineSelection($slug: String!, $limit: Int) {
      getPlayerRankingsFromSelection(slug: $slug, limit: $limit) {
        rank
        playerEntity {
          position
          eta
          player { id fullName }
          prospectBio { contentTitle contentText }
        }
      }
    }
  `;
  const slugs = [
    `sel-pr-${year}-cardinals`,
    `sel-pr-${year}-top100`,
    `sel-pr-${year - 1}-cardinals`,
  ];

  let hit: PipelineRow | null = null;
  let sourceSlug: string | null = null;
  for (const slug of slugs) {
    const res = await timedFetch(
      "https://data-graph.mlb.com/graphql",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Origin: "https://www.mlb.com",
          Referer: "https://www.mlb.com/cardinals/prospects",
          "User-Agent": UA,
        },
        body: JSON.stringify({
          query,
          variables: { slug, limit: 100 },
        }),
      },
      FETCH_MS,
    );
    if (!res.ok) continue;
    const payload = (await res.json()) as {
      data?: { getPlayerRankingsFromSelection?: PipelineRow[] };
    };
    const rows = payload.data?.getPlayerRankingsFromSelection ?? [];
    const found = rows.find((r) => Number(r.playerEntity?.player?.id) === playerId);
    if (found) {
      hit = found;
      sourceSlug = slug;
      break;
    }
  }

  if (!hit?.playerEntity?.player?.id) {
    return { found: false, playerId };
  }

  const bios = hit.playerEntity.prospectBio ?? [];
  const preferred =
    bios.find((b) => String(b.contentTitle ?? "") === String(year)) ??
    [...bios].reverse().find((b) => (b.contentText ?? "").toLowerCase().includes("scouting grades")) ??
    bios[bios.length - 1] ??
    null;
  if (!preferred?.contentText) {
    return { found: false, playerId };
  }
  const parsed = parsePipelineBio(preferred.contentText);
  if (!parsed.gradesLine && parsed.paragraphs.length === 0) {
    return { found: false, playerId };
  }

  const fullName = hit.playerEntity.player.fullName ?? "";
  const slug = fullName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return {
    found: true,
    playerId,
    playerName: fullName,
    rank: hit.rank ?? null,
    eta: hit.playerEntity.eta ?? null,
    position: hit.playerEntity.position ?? null,
    gradesLine: parsed.gradesLine,
    grades: parsed.grades,
    paragraphs: parsed.paragraphs,
    bioYear: preferred.contentTitle ?? null,
    sourceSlug,
    pipelineUrl: `https://www.mlb.com/prospects/${slug}-${playerId}`,
  };
}

/** Implied promotion % from ESPN projected Championship finish. */
function promotionProbFromProjectedPlace(place: number): number {
  if (place <= 1) return 0.92;
  if (place === 2) return 0.86;
  if (place === 3) return 0.48;
  if (place === 4) return 0.38;
  if (place === 5) return 0.32;
  if (place === 6) return 0.28;
  if (place <= 8) return 0.14;
  if (place <= 10) return 0.08;
  if (place <= 14) return 0.04;
  return 0.015;
}

function americanFromProb(p: number): string {
  const clamped = Math.min(0.98, Math.max(0.02, p));
  if (clamped >= 0.5) {
    return String(Math.round((-100 * clamped) / (1 - clamped)));
  }
  return `+${Math.round((100 * (1 - clamped)) / clamped)}`;
}

type SoccerPromotionOdd = {
  teamId: string;
  name: string;
  percent: number;
  american: string;
  projectedPlace: number | null;
  source: string;
  url: string | null;
};

/** Polymarket (when open) + ESPN projected finishes → Championship promotion odds. */
async function scrapeChampionshipPromotionOdds(): Promise<Record<string, unknown>> {
  const byId = new Map<string, SoccerPromotionOdd>();

  // Polymarket — prefer live markets for the current season when listed.
  try {
    const searchUrl =
      "https://gamma-api.polymarket.com/public-search?q=" +
      encodeURIComponent("efl championship team promoted");
    const search = (await (
      await timedFetch(searchUrl, { headers: { Accept: "application/json", "User-Agent": UA } }, 8_000)
    ).json()) as {
      events?: { slug?: string; title?: string; closed?: boolean }[];
    };
    const slug =
      (search.events ?? []).find(
        (e) =>
          /championship/i.test(e.title ?? "") &&
          /promot/i.test(e.title ?? "") &&
          e.closed === false &&
          e.slug,
      )?.slug ??
      (search.events ?? []).find((e) => e.slug && /championship.*promot|promot.*championship/i.test(e.slug))
        ?.slug ??
      "efl-championship-team-promoted-to-epl";

    const evRes = await timedFetch(
      `https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(slug)}`,
      { headers: { Accept: "application/json", "User-Agent": UA } },
      8_000,
    );
    if (evRes.ok) {
      const events = (await evRes.json()) as {
        title?: string;
        closed?: boolean;
        markets?: {
          groupItemTitle?: string;
          question?: string;
          closed?: boolean;
          active?: boolean;
          outcomePrices?: string | string[];
          outcomes?: string | string[];
        }[];
      }[];
      const ev = Array.isArray(events) ? events[0] : null;
      if (ev && ev.closed !== true) {
        const nameToId: Record<string, string> = {
          wrexham: "352",
          "wolverhampton wanderers": "380",
          wolves: "380",
        };
        for (const m of ev.markets ?? []) {
          if (m.closed === true) continue;
          const label = (m.groupItemTitle || m.question || "").trim();
          const key = label.toLowerCase().replace(/\s+fc$/i, "").trim();
          let teamId: string | null = null;
          let name = label;
          for (const [n, id] of Object.entries(nameToId)) {
            if (key === n || key.includes(n)) {
              teamId = id;
              name = n === "wolves" || n.includes("wolverhampton") ? "Wolves" : "Wrexham";
              break;
            }
          }
          if (!teamId) continue;
          let prices = m.outcomePrices;
          if (typeof prices === "string") {
            try {
              prices = JSON.parse(prices) as string[];
            } catch {
              prices = [];
            }
          }
          const yes = Number((prices as string[])?.[0]);
          if (!Number.isFinite(yes) || yes <= 0) continue;
          byId.set(teamId, {
            teamId,
            name,
            percent: Math.round(yes * 1000) / 10,
            american: americanFromProb(yes),
            projectedPlace: null,
            source: "Polymarket",
            url: `https://polymarket.com/event/${slug}`,
          });
        }
      }
    }
  } catch {
    /* optional */
  }

  // ESPN projected finishes for clubs still missing market odds.
  try {
    const storyIds: number[] = [];
    try {
      const news = (await (
        await timedFetch(
          "https://now.core.api.espn.com/v1/sports/news?limit=50&league=eng.2",
          { headers: { Accept: "application/json", "User-Agent": UA } },
          8_000,
        )
      ).json()) as { headlines?: { id?: number; headline?: string }[] };
      for (const h of news.headlines ?? []) {
        if (
          h.id &&
          /predict|projected finish|guide to new season|every club/i.test(h.headline ?? "")
        ) {
          storyIds.push(h.id);
        }
      }
    } catch {
      /* known id below */
    }
    if (!storyIds.includes(49583537)) storyIds.push(49583537);

    for (const storyId of storyIds) {
      const storyPayload = (await (
        await timedFetch(
          `https://now.core.api.espn.com/v1/sports/news/${storyId}`,
          { headers: { Accept: "application/json", "User-Agent": UA } },
          8_000,
        )
      ).json()) as { headlines?: { story?: string; links?: { web?: { href?: string } } }[] };
      const storyHtml = storyPayload.headlines?.[0]?.story ?? "";
      const storyText = stripTags(storyHtml);
      if (!/Wrexham|Wolves/i.test(storyText)) continue;
      const url = storyPayload.headlines?.[0]?.links?.web?.href ?? null;
      const targets: { teamId: string; name: string; patterns: RegExp[] }[] = [
        {
          teamId: "352",
          name: "Wrexham",
          patterns: [/Wrexham\s*[—–-]+\s*(\d+)(?:st|nd|rd|th)?/i],
        },
        {
          teamId: "380",
          name: "Wolves",
          patterns: [
            /Wolves\s*[—–-]+\s*(\d+)(?:st|nd|rd|th)?/i,
            /Wolverhampton Wanderers\s*[—–-]+\s*(\d+)(?:st|nd|rd|th)?/i,
          ],
        },
      ];
      for (const t of targets) {
        if (byId.has(t.teamId)) continue;
        let place: number | null = null;
        for (const re of t.patterns) {
          const m = storyText.match(re);
          if (m) {
            place = Number(m[1]);
            break;
          }
        }
        if (place == null || !Number.isFinite(place)) continue;
        const p = promotionProbFromProjectedPlace(place);
        byId.set(t.teamId, {
          teamId: t.teamId,
          name: t.name,
          percent: Math.round(p * 1000) / 10,
          american: americanFromProb(p),
          projectedPlace: place,
          source: "ESPN projection",
          url,
        });
      }
      if (byId.size >= 2) break;
    }
  } catch {
    /* optional */
  }

  const items = [...byId.values()];
  return {
    league: "eng.2",
    items,
    source: items[0]?.source ?? "none",
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
  if (body.action === "bbref" || body.action === "contract") {
    const name = String(body.name ?? "").trim();
    const hintUrl = body.url != null ? String(body.url) : null;
    if (name.length < 3 || name.length > 80) return json({ error: "Bad name" }, 400);
    try {
      const data =
        body.action === "bbref" ? await scrapeBbref(name) : await scrapeContract(name, hintUrl);
      return json(data);
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 200);
    }
  }
  if (body.action === "playerBrief") {
    const name = String(body.name ?? "").trim();
    if (name.length < 3 || name.length > 80) return json({ error: "Bad name" }, 400);
    try {
      return json(await scrapePlayerBrief(name));
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 200);
    }
  }
  if (body.action === "managerCareer") {
    const name = String(body.name ?? "").trim();
    if (name.length < 3 || name.length > 80) return json({ error: "Bad name" }, 400);
    try {
      return json(
        await withBudget(
          HEAVY_MS,
          () => scrapeBbrefManager(name),
          { error: "Manager career timed out", name },
        ),
      );
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 200);
    }
  }
  if (body.action === "managerRumors") {
    const name = body.name != null ? String(body.name).trim() : null;
    try {
      return json(await scrapeManagerRumors(name));
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 200);
    }
  }
  if (body.action === "managerPhoto") {
    const name = String(body.name ?? "").trim();
    if (name.length < 3 || name.length > 80) return json({ error: "Bad name" }, 400);
    try {
      return json(await scrapeBbrefManagerPhoto(name));
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 200);
    }
  }
  if (body.action === "managerFiredOdds") {
    try {
      return json(await scrapeManagerFiredOdds());
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e), items: [] }, 200);
    }
  }
  if (body.action === "nflCoachFiredOdds") {
    try {
      return json(await scrapeNflCoachFiredOdds());
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e), items: [] }, 200);
    }
  }
  if (body.action === "championshipPromotionOdds") {
    try {
      return json(
        await withBudget(
          18_000,
          () => scrapeChampionshipPromotionOdds(),
          { error: "Promotion odds timed out", league: "eng.2", items: [] },
        ),
      );
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e), items: [] }, 200);
    }
  }
  if (body.action === "golferSeasonResults") {
    const golferId = String(body.golferId ?? "").trim();
    const year = Number(body.year) || new Date().getUTCFullYear();
    if (!/^\d+$/.test(golferId)) return json({ error: "Bad golferId" }, 400);
    try {
      return json(await scrapeGolferSeasonResults(golferId, year));
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e), results: [] }, 200);
    }
  }
  if (body.action === "golferScorecard") {
    const golferId = String(body.golferId ?? "").trim();
    const season = Number(body.season) || new Date().getUTCFullYear();
    let eventId = String(body.eventId ?? "").trim();
    if (!/^\d+$/.test(golferId)) return json({ error: "Bad golferId" }, 400);
    try {
      if (!eventId) {
        const lbRes = await timedFetch(
          `${ESPN}/golf/leaderboard`,
          { headers: { Accept: "application/json" } },
          FETCH_MS,
        );
        if (lbRes.ok) {
          const lb = (await lbRes.json()) as { events?: { id?: string | number; name?: string }[] };
          const ev = lb.events?.[0];
          if (ev?.id != null) eventId = String(ev.id);
          if (ev?.name) body.eventName = ev.name;
        }
      }
      if (!eventId) return json({ error: "No event", rounds: [] }, 200);
      const url =
        `${ESPN}/golf/pga/leaderboard/${eventId}/playersummary?season=${season}&player=${golferId}`;
      const res = await timedFetch(url, { headers: { Accept: "application/json" } }, FETCH_MS);
      const text = await res.text();
      if (!res.ok) {
        return json({ error: `ESPN ${res.status}`, detail: text.slice(0, 200), rounds: [] }, 200);
      }
      const raw = JSON.parse(text) as Record<string, unknown>;
      return json({
        eventId,
        eventName: body.eventName ?? null,
        playerId: golferId,
        ...raw,
      });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e), rounds: [] }, 200);
    }
  }
  if (body.action === "golferLastWin") {
    const golferId = String(body.golferId ?? "").trim();
    if (!/^\d+$/.test(golferId)) return json({ error: "Bad golferId" }, 400);
    try {
      return json({ lastWin: await scrapeGolferLastWin(golferId) });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e), lastWin: null }, 200);
    }
  }
  if (body.action === "golferRotoNotes") {
    const name = String(body.name ?? "").trim();
    if (name.length < 3 || name.length > 80) return json({ error: "Bad name" }, 400);
    try {
      return json(
        await withBudget(
          HEAVY_MS,
          () => scrapeGolferRotoNotes(name),
          { error: "RotoWire notes timed out", name, url: null, notes: [] },
        ),
      );
    } catch (e) {
      return json(
        { error: e instanceof Error ? e.message : String(e), name, url: null, notes: [] },
        200,
      );
    }
  }
  if (body.action === "pipelineScouting") {
    const playerId = Number(body.playerId);
    if (!Number.isFinite(playerId) || playerId <= 0) {
      return json({ error: "Bad playerId" }, 400);
    }
    try {
      return json(
        await withBudget(
          HEAVY_MS,
          () => scrapePipelineScouting(playerId),
          { error: "Pipeline scouting timed out", playerId, found: false },
        ),
      );
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e), found: false }, 200);
    }
  }
  if (body.action === "playerBio") {
    const playerId = Number(body.playerId);
    const name = String(body.name ?? "").trim();
    if (!Number.isFinite(playerId) || playerId <= 0) return json({ error: "Bad playerId" }, 400);
    try {
      return json(
        await withBudget(
          HEAVY_MS,
          () => scrapeMlbPlayerBio(playerId, name),
          { error: "Player bio timed out", found: false },
        ),
      );
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e), found: false }, 200);
    }
  }
  if (body.action === "playerExtras") {
    const name = String(body.name ?? "").trim();
    if (name.length < 3 || name.length > 80) return json({ error: "Bad name" }, 400);
    const mlbIdRaw = body.mlbId ?? body.playerId;
    const mlbId =
      typeof mlbIdRaw === "number"
        ? mlbIdRaw
        : typeof mlbIdRaw === "string" && /^\d+$/.test(mlbIdRaw)
          ? Number(mlbIdRaw)
          : null;
    try {
      // Soft timeout still returns whatever core fields we managed to scrape.
      const partial: Record<string, unknown> = {
        error: "Player extras timed out",
        name,
        serviceTime: null,
        seasonWar: null,
        careerWar: null,
        warRank: null,
        warOf: null,
        url: null,
      };
      const result = await withBudget(
        HEAVY_MS,
        async () => {
          const full = await scrapePlayerExtras(name, Boolean(body.isPitcher), mlbId);
          for (const k of [
            "serviceTime",
            "seasonWar",
            "careerWar",
            "warRank",
            "warOf",
            "url",
            "source",
          ] as const) {
            if (full[k] != null) partial[k] = full[k];
          }
          if (full.serviceTime || full.seasonWar != null || full.careerWar != null) {
            delete partial.error;
          }
          return full;
        },
        partial,
      );
      return json(result);
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 200);
    }
  }
  if (body.action === "teamBbrefSummary") {
    const abbrev = String(body.abbrev ?? "").trim().toUpperCase();
    const season = Number(body.season) || new Date().getFullYear();
    if (!/^[A-Z0-9]{2,3}$/.test(abbrev)) return json({ error: "Bad abbrev" }, 400);
    try {
      return json(
        await withBudget(
          HEAVY_MS,
          () => scrapeTeamBbrefSummary(abbrev, season),
          { error: "Team summary timed out", abbrev, season },
        ),
      );
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 200);
    }
  }
  if (body.action === "teamPayroll") {
    const abbrev = String(body.abbrev ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9]{2,3}$/.test(abbrev)) return json({ error: "Bad abbrev" }, 400);
    try {
      return json(
        await withBudget(
          HEAVY_MS,
          () => scrapeTeamPayroll(abbrev),
          { error: "Team payroll timed out", abbrev },
        ),
      );
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 200);
    }
  }
  const safe = safePath(String(body.path ?? ""));
  if (!safe) return json({ error: "Bad path" }, 400);
  try {
    // Bare Accept header — UA+Referer gets Akamai 403 from some edge IPs.
    const res = await timedFetch(
      `${ESPN}/${safe}`,
      { headers: { Accept: "application/json" } },
      FETCH_MS,
    );
    const text = await res.text();
    if (!res.ok) return json({ error: `ESPN ${res.status}`, detail: text.slice(0, 200) }, 200);
    return new Response(text, {
      status: 200,
      headers: {
        ...CORS,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 200);
  }
});
