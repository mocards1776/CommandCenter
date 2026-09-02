import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { decodeHtmlEntities, loadBbrefPlayerHtml } from "./lib-b.ts";

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

/** BBRef HTML — direct first, then a CORS/CF open proxy when Cloudflare challenges the edge IP. */
async function fetchBbrefHtml(
  url: string,
  init: RequestInit = {},
  ms = FETCH_MS,
): Promise<{ url: string; html: string } | null> {
  const tryDirect = async () => {
    const res = await timedFetch(url, init, ms);
    const html = await res.text();
    if (/just a moment|cf-browser-verification/i.test(html)) return null;
    if (html.length < 8_000) return null;
    return { url: res.url || url, html };
  };
  try {
    const direct = await tryDirect();
    if (direct) return direct;
  } catch {
    /* proxy next */
  }
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const res = await timedFetch(
      proxyUrl,
      {
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/json",
        },
      },
      Math.max(ms, 20_000),
    );
    if (!res.ok) return null;
    const html = await res.text();
    if (/just a moment|cf-browser-verification/i.test(html) || html.length < 8_000) return null;
    // allorigins keeps the target URL opaque — use the requested URL for redirects we already know.
    const finalUrl =
      html.match(/canonical"\s+href="(https:\/\/www\.baseball-reference\.com\/players\/[^"]+)"/i)?.[1] ??
      url;
    return { url: finalUrl, html };
  } catch {
    return null;
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

async function scrapeBbref(name: string, mlbId?: number | null) {
  const page = await loadBbrefPlayerHtml(name, mlbId);
  if (!page) return { error: "Player not found on Baseball Reference", name };
  const html = page.html;
  const playerUrl = page.url;
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
  if (!salaries.length) {
    const textPay =
      /data-stat="year_ID"[^>]*>\s*(\d{4})[\s\S]*?data-stat="(?:Salary|salary)"[^>]*>\s*\$?([\d,]+)/gi;
    while ((sm = textPay.exec(searchable))) {
      const amount = parseMoney(sm[2]);
      if (amount == null) continue;
      salaries.push({ year: sm[1], team: null, amount });
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
  let contractStatus = statusMatch
    ? stripTags(statusMatch[statusMatch.length - 1] ?? "").replace(/\s+/g, " ").trim()
    : null;
  if (!contractStatus && /pre-?arb/i.test(searchable)) {
    contractStatus = "Pre-arbitration";
  } else if (!contractStatus && /minor league contract/i.test(searchable)) {
    contractStatus = "Minor league contract";
  }
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
  // Same page already has value tables — return WAR so the player card can use contract
  // payload when playerExtras is blank (CF / soft-timeout).
  const valueSlice = extractBbrefWarTables(searchable);
  let { seasonWar, careerWar } = parseBbrefSeasonAndCareerWar(valueSlice, "b_war");
  if (seasonWar == null && careerWar == null) {
    ({ seasonWar, careerWar } = parseBbrefSeasonAndCareerWar(valueSlice, "p_war"));
  }
  return {
    source: "baseball-reference",
    url: playerUrl,
    name,
    contractStatus,
    serviceTime: stMatch?.[1] ?? null,
    seasonWar,
    careerWar,
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
  "michael soroka": { id: "17596", slug: "michael-soroka" },
  "mike soroka": { id: "17596", slug: "michael-soroka" },
  soroka: { id: "17596", slug: "michael-soroka" },
  "eury perez": { id: "31667", slug: "eury-perez" },
  "eury pérez": { id: "31667", slug: "eury-perez" },
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

async function findSpotracUrl(
  name: string,
  hintUrl?: string | null,
  mlbId?: number | null,
): Promise<string | null> {
  if (hintUrl) {
    const normalized = normalizeSpotracUrl(hintUrl);
    if (normalized) return normalized;
  }
  const known = spotracUrlForName(name);
  if (known) return known;

  const slug = slugifyName(name);
  const last = slug.split("-").filter(Boolean).slice(-1)[0] ?? "";
  const q = mlbId ? `${name} ${mlbId}` : name;
  const urls = [
    `https://www.spotrac.com/search/?q=${encodeURIComponent(name)}`,
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`site:spotrac.com/mlb/player ${q}`)}`,
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

async function scrapeSpotrac(name: string, hintUrl?: string | null, mlbId?: number | null) {
  const playerUrl = await findSpotracUrl(name, hintUrl, mlbId);
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

async function scrapeContract(name: string, hintUrl?: string | null, mlbId?: number | null) {
  const fallback = { error: "Contract lookup timed out", name };
  return withBudget(HEAVY_MS, async () => {
    // Pull BBRef + Spotrac together so a Spotrac miss or BBRef blip still fills the card.
    const [bbSettled, spotracSettled] = await Promise.allSettled([
      scrapeBbref(name, mlbId),
      scrapeSpotrac(name, hintUrl, mlbId),
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

/** Common English first-name nickname groups (any member matches any other). */
const FIRST_NAME_ALIAS_GROUPS: string[][] = [
  ["james", "jimmy", "jim"],
  ["michael", "mike"],
  ["william", "will", "bill", "billy"],
  ["robert", "rob", "bob", "bobby"],
  ["richard", "rick", "dick"],
  ["anthony", "tony"],
  ["joseph", "joe"],
  ["thomas", "tom", "tommy"],
  ["christopher", "chris"],
  ["alexander", "alex"],
  ["nicholas", "nick"],
  ["benjamin", "ben"],
  ["samuel", "sam"],
  ["matthew", "matt"],
  ["jonathan", "john", "jon"],
  ["patrick", "pat"],
  ["gregory", "greg"],
  ["edward", "ed", "eddie"],
  ["charles", "chuck", "charlie"],
  ["stephen", "steve"],
  ["andrew", "andy", "drew"],
];
const FIRST_NAME_ALIAS_MAP: Record<string, Set<string>> = {};
for (const group of FIRST_NAME_ALIAS_GROUPS) {
  const set = new Set(group);
  for (const n of group) FIRST_NAME_ALIAS_MAP[n] = set;
}

function firstNamesMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const group = FIRST_NAME_ALIAS_MAP[a];
  return Boolean(group && group.has(b));
}

/** `normPerson` already strips jr/sr/ii/iii/iv suffixes before we split first/last. */
function splitPersonName(name: string): { first: string; last: string } {
  const parts = normPerson(name).split(" ").filter(Boolean);
  return { first: parts[0] ?? "", last: parts[parts.length - 1] ?? "" };
}

/** Same last name + first-name alias match (James ↔ Jimmy ↔ Jim, Mike ↔ Michael, etc). */
function peopleMatch(a: string, b: string): boolean {
  const pa = splitPersonName(a);
  const pb = splitPersonName(b);
  if (!pa.last || !pb.last || pa.last !== pb.last) return false;
  return firstNamesMatch(pa.first, pb.first);
}

/** Does a RotoWorld URL slug (e.g. "jimmy-crooks-iii") refer to this player name? */
function slugMatchesName(slug: string, name: string): boolean {
  const slugParts = slug
    .toLowerCase()
    .split("-")
    .filter((p) => p && !/^(jr|sr|ii|iii|iv)$/.test(p));
  if (slugParts.length < 2) return false;
  const slugFirst = slugParts[0];
  const slugLast = slugParts[slugParts.length - 1];
  const { first, last } = splitPersonName(name);
  if (!last || slugLast !== last) return false;
  return firstNamesMatch(slugFirst, first);
}

type PlayerNewsNote = {
  source: "rotowire" | "rotoworld";
  headline: string | null;
  story: string | null;
  description: string | null;
  published: string | null;
  url: string | null;
};

function notePublishedMs(published: string | null | undefined): number {
  if (!published) return 0;
  const t = Date.parse(published);
  return Number.isFinite(t) ? t : 0;
}

/** RotoWire write-up via ESPN athlete overview (plus a couple news headlines). */
async function scrapeRotoWireNote(name: string): Promise<{
  note: PlayerNewsNote | null;
  news: { headline: string; description: string }[];
  displayName: string | null;
  espnId: string | null;
  error?: string;
}> {
  const want = normPerson(name);
  const searchUrl =
    `https://site.web.api.espn.com/apis/common/v3/search?region=us&lang=en&type=player&limit=8&query=` +
    encodeURIComponent(name.trim());
  const searchRes = await timedFetch(searchUrl, {
    headers: { Accept: "application/json", "User-Agent": UA, Referer: "https://www.espn.com/" },
  }, SEARCH_MS);
  if (!searchRes.ok) {
    return { note: null, news: [], displayName: null, espnId: null, error: `ESPN search ${searchRes.status}` };
  }
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
  if (!hit?.id) {
    return { note: null, news: [], displayName: null, espnId: null, error: "Player not found on ESPN" };
  }

  const ovRes = await timedFetch(
    `https://site.web.api.espn.com/apis/common/v3/sports/baseball/mlb/athletes/${hit.id}/overview`,
    { headers: { Accept: "application/json", "User-Agent": UA, Referer: "https://www.espn.com/" } },
  );
  if (!ovRes.ok) {
    return {
      note: null,
      news: [],
      displayName: hit.displayName ?? null,
      espnId: String(hit.id),
      error: `ESPN overview ${ovRes.status}`,
    };
  }
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
  const headline = rw.headline ?? rw.description ?? null;
  const story = rw.story ?? null;
  const displayName = hit.displayName ?? name;
  const last = want.split(/\s+/).filter(Boolean).pop()?.toLowerCase() ?? "";
  const generic =
    /fantasy baseball forecaster|team hitting ratings|team pitching ratings|starting lineup advice|waiver wire pick|daily fantasy|dfs pick|weekly outlook|matchup ratings/i;
  const noteHay = `${headline ?? ""} ${story ?? ""} ${rw.description ?? ""}`.toLowerCase();
  const playerSpecific =
    Boolean(last) &&
    (!headline || headline.toLowerCase().includes(last)) &&
    (!generic.test(noteHay) || noteHay.includes(last));
  if (!headline && !story) {
    return {
      note: null,
      news,
      displayName,
      espnId: String(hit.id),
    };
  }
  if (!playerSpecific) {
    return {
      note: null,
      news,
      displayName,
      espnId: String(hit.id),
    };
  }
  return {
    note: {
      source: "rotowire",
      headline,
      story,
      description: rw.description ?? null,
      published: rw.published ?? null,
      url: `https://www.espn.com/mlb/player/_/id/${hit.id}`,
    },
    news,
    displayName,
    espnId: String(hit.id),
  };
}

type RotoWorldFeedItem = PlayerNewsNote & {
  firstName: string | null;
  lastName: string | null;
};

/** Parse `<div class="PlayerNewsPost" ...>` blocks out of an NBC Sports RotoWorld page. */
function parseRotoWorldPosts(html: string, fallbackUrl: string): RotoWorldFeedItem[] {
  const posts = html.split(/<div class="PlayerNewsPost"/i).slice(1);
  const items: RotoWorldFeedItem[] = [];
  for (const raw of posts) {
    const block = `<div class="PlayerNewsPost"${raw}`;
    const firstName =
      stripTags(block.match(/PlayerNewsPost-firstName[^>]*>([\s\S]*?)<\//i)?.[1] ?? "").trim() ||
      null;
    const lastName =
      stripTags(block.match(/PlayerNewsPost-lastName[^>]*>([\s\S]*?)<\//i)?.[1] ?? "").trim() ||
      null;
    const headline = decodeHtmlEntities(
      stripTags(block.match(/PlayerNewsPost-headline[^>]*>([\s\S]*?)<\//i)?.[1] ?? ""),
    )
      .replace(/\s+/g, " ")
      .trim();
    const story = decodeHtmlEntities(
      stripTags(block.match(/PlayerNewsPost-analysis[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? ""),
    )
      .replace(/\s+/g, " ")
      .trim();
    const published =
      block.match(/PlayerNewsPost-date[^>]*data-date="([^"]+)"/i)?.[1]?.trim() ||
      block.match(/data-share-url="[^"]*\/(\d{4}-\d{2}-\d{2})\//i)?.[1] ||
      null;
    const shareUrl = block.match(/data-share-url="([^"]+)"/i)?.[1]?.trim() || fallbackUrl;
    if (!headline && !story) continue;
    items.push({
      source: "rotoworld",
      firstName,
      lastName,
      headline: headline || null,
      story: story || null,
      description: story || null,
      published,
      url: shareUrl,
    });
  }
  return items;
}

/** League-wide RotoWorld (NBC Sports) MLB player-news feed, paginated. */
async function scrapeRotoWorldFeed(maxPages = 3): Promise<RotoWorldFeedItem[]> {
  const items: RotoWorldFeedItem[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= Math.max(1, maxPages); page++) {
    const url =
      page === 1
        ? "https://www.nbcsports.com/fantasy/baseball/player-news"
        : `https://www.nbcsports.com/fantasy/baseball/player-news?p=${page}`;
    try {
      const res = await timedFetch(
        url,
        {
          headers: {
            "User-Agent": UA,
            Accept: "text/html",
            Referer: "https://www.nbcsports.com/",
          },
        },
        HEAVY_MS,
      );
      if (!res.ok) break;
      const html = await res.text();
      const pagePosts = parseRotoWorldPosts(html, url);
      if (!pagePosts.length) break;
      for (const post of pagePosts) {
        const key = `${post.source}|${post.headline ?? ""}|${post.url ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        items.push(post);
      }
    } catch {
      break;
    }
  }
  return items;
}

/** RotoWorld (NBC Sports) player-news blurb for an MLB player. */
async function scrapeRotoWorldNote(name: string): Promise<PlayerNewsNote | null> {
  const toNote = (post: RotoWorldFeedItem): PlayerNewsNote => ({
    source: "rotoworld",
    headline: post.headline,
    story: post.story,
    description: post.description,
    published: post.published,
    url: post.url,
  });

  // 1) The league-wide feed listing (first 2 pages) is fast and usually has the
  // freshest note — check it before falling back to per-player search.
  try {
    const feed = await scrapeRotoWorldFeed(2);
    const hit = feed.find((post) => peopleMatch(`${post.firstName ?? ""} ${post.lastName ?? ""}`, name));
    if (hit) return toNote(hit);
  } catch {
    /* fall through to search */
  }

  const want = normPerson(name);
  const parts = want.split(" ").filter(Boolean);
  const first = parts[0] ?? "";
  const last = parts[parts.length - 1] ?? "";
  const slugWant = parts.join("-");

  const searchRes = await timedFetch(
    `https://www.nbcsports.com/search?q=${encodeURIComponent(name.trim())}`,
    {
      headers: {
        "User-Agent": UA,
        Accept: "text/html",
        Referer: "https://www.nbcsports.com/",
      },
    },
    SEARCH_MS,
  );
  if (!searchRes.ok) return null;
  const searchHtml = await searchRes.text();
  const linkRe = /\/(?:https:)?\/\/www\.nbcsports\.com\/mlb\/([a-z0-9-]+)\/(\d+)/gi;
  const candidates: { slug: string; id: string }[] = [];
  const seen = new Set<string>();
  for (const m of searchHtml.matchAll(linkRe)) {
    const slug = m[1] ?? "";
    const id = m[2] ?? "";
    if (!/^\d{4,7}$/.test(id)) continue;
    const key = `${slug}/${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({ slug, id });
  }
  const pick =
    candidates.find((c) => c.slug === slugWant) ??
    candidates.find((c) => slugMatchesName(c.slug, name)) ??
    candidates.find((c) => first && last && c.slug.includes(first) && c.slug.includes(last)) ??
    candidates.find((c) => last && c.slug.includes(last)) ??
    null;
  if (!pick) return null;

  const newsUrl = `https://www.nbcsports.com/mlb/${pick.slug}/${pick.id}/news`;
  const newsRes = await timedFetch(
    newsUrl,
    {
      headers: {
        "User-Agent": UA,
        Accept: "text/html",
        Referer: "https://www.nbcsports.com/",
      },
    },
    HEAVY_MS,
  );
  if (!newsRes.ok) return null;
  const html = await newsRes.text();
  const posts = parseRotoWorldPosts(html, newsUrl);
  const hit =
    posts.find((post) => peopleMatch(`${post.firstName ?? ""} ${post.lastName ?? ""}`, name)) ??
    posts.find((post) => {
      const postName = normPerson(`${post.firstName ?? ""} ${post.lastName ?? ""}`);
      return Boolean(postName) && (postName.includes(last) || want.includes(postName));
    }) ??
    null;
  return hit ? toNote(hit) : null;
}

/** Combined RotoWire (ESPN) + RotoWorld (NBC Sports) player news. */
async function scrapePlayerBrief(name: string) {
  const [rwPack, rotoworld] = await Promise.all([
    scrapeRotoWireNote(name).catch((e) => ({
      note: null as PlayerNewsNote | null,
      news: [] as { headline: string; description: string }[],
      displayName: null as string | null,
      espnId: null as string | null,
      error: String(e),
    })),
    scrapeRotoWorldNote(name).catch(() => null),
  ]);

  const notes: PlayerNewsNote[] = [];
  if (rwPack.note) notes.push(rwPack.note);
  if (rotoworld) notes.push(rotoworld);
  notes.sort((a, b) => notePublishedMs(b.published) - notePublishedMs(a.published));

  if (!notes.length && !rwPack.news.length) {
    return {
      error: rwPack.error || "No RotoWire or RotoWorld brief available",
      name,
      espnId: rwPack.espnId,
    };
  }

  const primary = notes[0] ?? null;
  const sources = notes.map((n) => n.source);
  return {
    source: sources.length ? sources.join("+") : "rotowire",
    provider: "espn+nbcsports",
    name: rwPack.displayName ?? name,
    espnId: rwPack.espnId,
    headline: primary?.headline ?? null,
    story: primary?.story ?? null,
    description: primary?.description ?? null,
    published: primary?.published ?? null,
    url: primary?.url ?? (rwPack.espnId ? `https://www.espn.com/mlb/player/_/id/${rwPack.espnId}` : null),
    news: rwPack.news,
    notes,
    rotowire: rwPack.note,
    rotoworld,
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

function kalshiDollarProb(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n === 0) return 0;
  return Math.max(0.01, Math.min(0.99, n));
}

function kalshiMidProb(m: {
  yes_bid_dollars?: string | null;
  yes_ask_dollars?: string | null;
  last_price_dollars?: string | null;
  yes_bid?: number | null;
  yes_ask?: number | null;
  last_price?: number | null;
}): number | null {
  const bid = kalshiDollarProb(m.yes_bid_dollars);
  const ask = kalshiDollarProb(m.yes_ask_dollars);
  const last = kalshiDollarProb(m.last_price_dollars);
  let p: number | null = null;
  if (bid != null && ask != null && (bid > 0 || ask > 0)) p = (bid + ask) / 2;
  else p = (ask && ask > 0 ? ask : null) ?? (bid && bid > 0 ? bid : null) ?? (last && last > 0 ? last : null);
  if (p == null || p <= 0) {
    const cents = m.last_price ?? m.yes_ask ?? m.yes_bid ?? null;
    if (cents == null || !(cents > 0)) return null;
    p = Math.max(0.01, Math.min(0.99, cents / 100));
  }
  return p;
}

function kalshiAmerican(p: number): string {
  return p >= 0.5
    ? `-${Math.round((100 * p) / (1 - p))}`
    : `+${Math.round((100 * (1 - p)) / p)}`;
}

async function scrapeManagerFiredOdds() {
  // Kalshi "Baseball Managers Out" — next-fired / out before Dec 1.
  const items: {
    name: string;
    team?: string | null;
    oddsAmerican: string;
    impliedPct: number | null;
    source: string;
    url: string;
    ticker?: string;
  }[] = [];
  try {
    const url =
      "https://api.elections.kalshi.com/trade-api/v2/markets?limit=100&status=open&series_ticker=KXCOACHOUTMLB";
    const res = await timedFetch(url, {
      headers: { Accept: "application/json", "User-Agent": UA },
    });
    if (res.ok) {
      const data = (await res.json()) as {
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
          yes_sub_title?: string | null;
          no_sub_title?: string | null;
          custom_strike?: { Coach?: string; Team?: string; Person?: string } | null;
        }[];
      };
      for (const m of data.markets ?? []) {
        const name =
          (
            m.custom_strike?.Coach ??
            m.custom_strike?.Person ??
            m.yes_sub_title ??
            m.no_sub_title ??
            ""
          ).trim() ||
          (() => {
            const title = `${m.title ?? ""} ${m.subtitle ?? ""}`;
            const nameMatch =
              title.match(
                /Will\s+([A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.']+){0,3})\s+be\s+out/i,
              ) ?? title.match(/([A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.']+){1,3})/);
            return nameMatch?.[1]?.trim() ?? "";
          })();
        if (!name || /field|any other|tie|co-?winner/i.test(name)) continue;
        const p = kalshiMidProb(m);
        if (p == null) continue;
        const subtitle = (m.subtitle ?? "").replace(/^:+\s*/, "").trim();
        items.push({
          name,
          team: m.custom_strike?.Team ?? (subtitle || null),
          oddsAmerican: kalshiAmerican(p),
          impliedPct: Math.round(p * 1000) / 10,
          source: "Kalshi",
          url: `https://kalshi.com/markets/${(m.ticker ?? "").toLowerCase()}`,
          ticker: m.ticker ?? "",
        });
      }
    }
  } catch {
    /* */
  }

  if (!items.length) {
    // Fallback: scrape BetOnline futures page text for american odds lines.
    try {
      const html = await (
        await timedFetch(
          "https://www.betonline.ag/sportsbook/futures-and-props/mlb-specials/manager-fired",
          { headers: { "User-Agent": UA, Accept: "text/html" } },
          SEARCH_MS,
        )
      ).text();
      for (const m of html.matchAll(
        /([A-Z][a-z]+(?:\s+[A-Z][a-z.]+)+)\s*<[^>]*>\s*([+-]\d{2,4})/g,
      )) {
        items.push({
          name: m[1],
          team: null,
          oddsAmerican: m[2],
          impliedPct: null,
          source: "BetOnline",
          url: "https://www.betonline.ag/sportsbook/futures-and-props/mlb-specials/manager-fired",
        });
      }
    } catch {
      /* */
    }
  }

  items.sort((a, b) => (b.impliedPct ?? 0) - (a.impliedPct ?? 0));
  return {
    source: items[0]?.source ?? "none",
    checkedAt: new Date().toISOString(),
    items,
  };
}

/** AL + NL Kalshi Manager of the Year markets — safety signal for hot seat. */
async function scrapeManagerMotyOdds() {
  const items: {
    name: string;
    league: "AL" | "NL";
    oddsAmerican: string;
    impliedPct: number;
    source: string;
    url: string;
    ticker: string;
  }[] = [];

  const series: { ticker: string; league: "AL" | "NL" }[] = [
    { ticker: "KXMLBALMOTY", league: "AL" },
    { ticker: "KXMLBNLMOTY", league: "NL" },
  ];

  for (const s of series) {
    try {
      const url =
        `https://api.elections.kalshi.com/trade-api/v2/markets?limit=50&status=open&series_ticker=${s.ticker}`;
      const res = await timedFetch(url, {
        headers: { Accept: "application/json", "User-Agent": UA },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        markets?: {
          title?: string;
          ticker?: string;
          yes_bid?: number | null;
          yes_ask?: number | null;
          last_price?: number | null;
          yes_bid_dollars?: string | null;
          yes_ask_dollars?: string | null;
          last_price_dollars?: string | null;
          yes_sub_title?: string | null;
          no_sub_title?: string | null;
          custom_strike?: { Person?: string; Coach?: string } | null;
        }[];
      };
      for (const m of data.markets ?? []) {
        const name = (
          m.custom_strike?.Person ??
          m.custom_strike?.Coach ??
          m.yes_sub_title ??
          m.no_sub_title ??
          ""
        ).trim();
        if (!name || /tie|co-?winner|field|any other/i.test(name)) continue;
        const p = kalshiMidProb(m);
        if (p == null) continue;
        items.push({
          name,
          league: s.league,
          oddsAmerican: kalshiAmerican(p),
          impliedPct: Math.round(p * 1000) / 10,
          source: "Kalshi",
          url: `https://kalshi.com/markets/${(m.ticker ?? "").toLowerCase()}`,
          ticker: m.ticker ?? "",
        });
      }
    } catch {
      /* next series */
    }
  }

  items.sort((a, b) => b.impliedPct - a.impliedPct);
  return {
    source: items.length ? "Kalshi" : "none",
    checkedAt: new Date().toISOString(),
    items,
  };
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

async function scrapeCfbCoachFiredOdds() {
  const items: {
    name: string;
    teamHint: string | null;
    oddsAmerican: string;
    impliedPct: number;
    ticker: string;
    url: string;
  }[] = [];
  const url =
    "https://api.elections.kalshi.com/trade-api/v2/markets?limit=200&status=open&series_ticker=KXCOACHOUTNCAAFB";
  const res = await timedFetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`Kalshi CFB coaches ${res.status}`);
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

export {
  CORS,
  ESPN,
  UA,
  FETCH_MS,
  SEARCH_MS,
  HEAVY_MS,
  json,
  timedFetch,
  fetchBbrefHtml,
  withBudget,
  safePath,
  stripTags,
  moneyDisplay,
  parseMoney,
  pickCurrentSalary,
  parseBbrefTotals,
  scrapeBbref,
  slugifyName,
  SPOTRAC_PLAYER_RE,
  normalizeSpotracUrl,
  spotracUrlForName,
  findSpotracUrl,
  scrapeSpotrac,
  hasContractBits,
  scrapeContract,
  normPerson,
  firstNamesMatch,
  splitPersonName,
  peopleMatch,
  slugMatchesName,
  notePublishedMs,
  scrapeRotoWireNote,
  parseRotoWorldPosts,
  scrapeRotoWorldFeed,
  scrapeRotoWorldNote,
  scrapePlayerBrief,
  findBbrefManagerUrl,
  parseBbrefInt,
  extractBbrefManagerPhoto,
  detectManagerLeash,
  extractBbrefManagerContract,
  extractBbrefInterimRecord,
  scrapeBbrefManager,
  ordinal,
  fetchGoogleNews,
  isRelevantMlbManagerRumor,
  scrapeManagerRumors,
  scrapeBbrefManagerPhoto,
  kalshiDollarProb,
  kalshiMidProb,
  kalshiAmerican,
  scrapeManagerFiredOdds,
  scrapeManagerMotyOdds,
  scrapeNflCoachFiredOdds,
  scrapeCfbCoachFiredOdds,
  type PlayerNewsNote,
  type RotoWorldFeedItem
};
