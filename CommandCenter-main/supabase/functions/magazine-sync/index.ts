import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Auto-imports new magazine issues into the reading library.
//
// Sources:
//   - Baseball America: public Shopify products.json (Single Issue SKUs)
//   - USA Today Sports Weekly: online store month category pages
//   - Sports Illustrated: DiscountMags cover listing (monthly issues)
//
// Cron (GitHub Actions) hits this with the anon key. Signed-in users can also
// trigger a sync from the Magazines tab. Writes use the service role scoped to
// MAGAZINE_SYNC_USER_ID (defaults to the sole library owner).
//
// Deploy: supabase functions deploy magazine-sync --no-verify-jwt

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

const BA_SHOPIFY = "https://baseballamerica.myshopify.com";
const SW_STORE = "https://onlinestore.usatoday.com";
const SI_DISCOUNTMAGS = "https://www.discountmags.com/magazine/sports-illustrated";

/** How far back to look for issues on each sync (avoids importing the whole archive). */
const LOOKBACK_DAYS = 45;

const DEFAULT_PAGES: Record<string, number> = {
  "Baseball America": 84,
  "Sports Weekly": 48,
  "Sports Illustrated": 96,
};

type Candidate = {
  publication: string;
  issue: string;
  source_url: string;
  cover_url: string | null;
  page_count: number | null;
  published_at: string | null;
  external_key: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

/** YYYYMMDD → "October 10, 2026" */
function formatIssueDate(yyyymmdd: string): string {
  const y = Number(yyyymmdd.slice(0, 4));
  const m = Number(yyyymmdd.slice(4, 6));
  const d = Number(yyyymmdd.slice(6, 8));
  if (!y || !m || !d) return yyyymmdd;
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** MM/DD/YYYY → "September 16, 2026" */
function formatSlashDate(mdy: string): string {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(mdy.trim());
  if (!match) return mdy;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86400_000).toISOString();
}

function isRecent(iso: string | null, lookbackDays: number): boolean {
  if (!iso) return true;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return true;
  return t >= Date.now() - lookbackDays * 86400_000;
}

/** Regular BA magazine issues carry an 8-digit cover date; skip annual books/bundles. */
function isBaMagazineIssue(title: string, productType: string, handle: string): boolean {
  if (!/single\s*issue/i.test(productType) && productType.trim() !== "") return false;
  const blob = `${title} ${handle}`.toLowerCase();
  if (
    /almanac|prospect handbook|directory|three-book|bundle|two-pack|2-pack|combo/.test(blob)
  ) {
    return false;
  }
  return /\(?\d{8}\)?/.test(title) || /^\d{8}/.test(handle);
}

function parseBaIssue(title: string): { dateCode: string | null; label: string } {
  const m = /^\(?(\d{8})\)?\s*[:\-]?\s*(.+)$/i.exec(title.trim());
  if (m) {
    const dateCode = m[1];
    const rest = m[2].replace(/\s*[—–-]\s*$/, "").trim();
    const dateLabel = formatIssueDate(dateCode);
    return { dateCode, label: rest ? `${dateLabel} · ${rest}` : dateLabel };
  }
  return { dateCode: null, label: title.trim() };
}

function extractPageCount(html: string): number | null {
  const m = /(\d{2,3})\s*-?\s*pages?\b/i.exec(stripHtml(html));
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 16 && n <= 400 ? n : null;
}

async function fetchBaCandidates(lookbackDays: number): Promise<Candidate[]> {
  const out: Candidate[] = [];
  // Shopify caps page size at 250; newest first is enough for lookback.
  const url = `${BA_SHOPIFY}/products.json?limit=100`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`Baseball America Shopify returned ${res.status}`);
  const data = (await res.json()) as {
    products?: Array<{
      title: string;
      handle: string;
      body_html?: string;
      product_type?: string;
      published_at?: string;
      created_at?: string;
      images?: Array<{ src: string }>;
    }>;
  };

  for (const p of data.products ?? []) {
    if (!isBaMagazineIssue(p.title, p.product_type ?? "", p.handle)) continue;
    const published = p.published_at ?? p.created_at ?? null;
    if (!isRecent(published, lookbackDays)) continue;
    const { dateCode, label } = parseBaIssue(p.title);
    const source_url = `${BA_SHOPIFY}/products/${p.handle}`;
    out.push({
      publication: "Baseball America",
      issue: label,
      source_url,
      cover_url: p.images?.[0]?.src ?? null,
      page_count: extractPageCount(p.body_html ?? "") ?? DEFAULT_PAGES["Baseball America"],
      published_at: published,
      external_key: `ba:${dateCode ?? p.handle}`,
    });
  }
  return out;
}

const SW_MONTH_SLUGS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/** Discover real month category URLs from the year hub, then scrape products. */
async function fetchSwCandidates(lookbackDays: number): Promise<Candidate[]> {
  const year = new Date().getUTCFullYear();
  const monthPages = new Set<string>();
  // Year hubs list month categories (ids change yearly). Always try the known
  // 2026 hub plus the previous-issues index for discovery.
  const hubs = [
    `${SW_STORE}/2026-sports-weekly-editions-c1574.aspx`,
    `${SW_STORE}/sports-weekly-previous-issues-c2.aspx`,
    `${SW_STORE}/${year}-sports-weekly-editions-c1574.aspx`,
  ];

  for (const yearHub of [...new Set(hubs)]) {
    try {
      const hubHtml = await fetchText(yearHub);
      for (const m of hubHtml.matchAll(
        /href="(https?:\/\/onlinestore\.usatoday\.com\/[a-z]+-\d{4}-c\d+\.aspx)"/gi,
      )) {
        monthPages.add(m[1]);
      }
      for (const m of hubHtml.matchAll(/href="(\/?[a-z]+-\d{4}-c\d+\.aspx)"/gi)) {
        const path = m[1].startsWith("http") ? m[1] : `${SW_STORE}/${m[1].replace(/^\//, "")}`;
        monthPages.add(path);
      }
    } catch {
      // Try the next hub.
    }
  }

  // Guessed month URLs rarely work (category ids vary); prefer discovered ones.
  // Keep the previous 5 months of *discovered* pages only.
  const now = new Date();
  const recentSlugs = new Set<string>();
  for (let i = 0; i < 5; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    recentSlugs.add(`${SW_MONTH_SLUGS[d.getUTCMonth()]}-${d.getUTCFullYear()}`);
  }
  const pages = [...monthPages].filter((u) => {
    const slug = /\/([a-z]+-\d{4})-c\d+\.aspx/i.exec(u)?.[1]?.toLowerCase();
    return slug ? recentSlugs.has(slug) : false;
  });

  // If discovery failed, try a few known recent category ids from live store.
  if (pages.length === 0) {
    pages.push(
      `${SW_STORE}/september-2026-c1595.aspx`,
      `${SW_STORE}/august-2026-c1593.aspx`,
      `${SW_STORE}/july-2026-c1591.aspx`,
      `${SW_STORE}/june-2026-c1589.aspx`,
      `${SW_STORE}/may-2026-c1586.aspx`,
    );
  }

  const byKey = new Map<string, Candidate>();
  for (const page of pages) {
    let html: string;
    try {
      html = await fetchText(page);
    } catch {
      continue;
    }
    // Product tiles: title + href with MMDDYYYY and product id.
    const re =
      /title="(\d{2}\/\d{2}\/\d{4})\s+Issue of Sports Weekly"[^>]*href="(https?:\/\/onlinestore\.usatoday\.com\/(\d{8})-issue-of-sports-weekly-p(\d+)\.aspx)"/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      const slashDate = m[1];
      const source_url = m[2];
      const mmddyyyy = m[3]; // store URLs are MMDDYYYY, e.g. 09162026
      const productId = m[4];
      const month = mmddyyyy.slice(0, 2);
      const day = mmddyyyy.slice(2, 4);
      const year = mmddyyyy.slice(4, 8);
      const publishedGuess = `${year}-${month}-${day}T12:00:00.000Z`;
      if (!isRecent(publishedGuess, lookbackDays)) continue;
      const key = `sw:${year}${month}${day}`;
      if (byKey.has(key)) continue;
      byKey.set(key, {
        publication: "Sports Weekly",
        issue: formatSlashDate(slashDate),
        source_url,
        cover_url: null,
        page_count: DEFAULT_PAGES["Sports Weekly"],
        published_at: publishedGuess,
        external_key: key,
      });
      void productId;
    }
  }

  // Fetch covers for candidates (small N within lookback).
  const list = [...byKey.values()];
  await Promise.all(
    list.map(async (c) => {
      try {
        const html = await fetchText(c.source_url);
        const img = /property="og:image"\s+content="([^"]+)"/i.exec(html)?.[1]
          ?? /content="([^"]+)"\s+property="og:image"/i.exec(html)?.[1]
          ?? null;
        if (img) c.cover_url = decodeEntities(img);
      } catch {
        // Cover is optional.
      }
    }),
  );

  return list;
}

const SI_MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

/** Sports Illustrated monthly issues via DiscountMags cover filenames. */
async function fetchSiCandidates(lookbackDays: number): Promise<Candidate[]> {
  const html = await fetchText(SI_DISCOUNTMAGS);
  const byKey = new Map<string, Candidate>();
  const re =
    /8281-sports-illustrated-cover-(\d{4})-([a-z]+)-(\d+)-issue\.jpg/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const year = m[1];
    const monthName = m[2].toLowerCase();
    const issueNum = m[3];
    const month = SI_MONTHS[monthName];
    if (!month) continue;
    const mm = String(month).padStart(2, "0");
    // Treat as mid-month so lookback matches when the issue is typically out.
    const publishedGuess = `${year}-${mm}-15T12:00:00.000Z`;
    if (!isRecent(publishedGuess, lookbackDays)) continue;
    const key = `si:${year}${mm}`;
    if (byKey.has(key)) continue;
    const label = `${monthName[0]!.toUpperCase()}${monthName.slice(1)} ${year}`;
    byKey.set(key, {
      publication: "Sports Illustrated",
      issue: label,
      source_url: `${SI_DISCOUNTMAGS}#${year}-${monthName}`,
      cover_url:
        `https://img.discountmags.com/products/extras/8281-sports-illustrated-cover-${year}-${monthName}-${issueNum}-issue.jpg`,
      page_count: DEFAULT_PAGES["Sports Illustrated"],
      published_at: publishedGuess,
      external_key: key,
    });
  }
  return [...byKey.values()];
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return await res.text();
}

function buildMagazineRow(userId: string, c: Candidate) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    user_id: userId,
    content_type: "magazine",
    format: "magazine",
    title: c.publication,
    series: c.publication,
    subtitle: c.issue,
    authors: c.publication,
    status: "to-read",
    tags: ["magazine", "auto-import", c.external_key],
    cover_url: c.cover_url,
    source_url: c.source_url,
    page_count: c.page_count,
    date_added: today,
    owned: true,
    read_count: 0,
    current_page: 0,
    favorite: false,
    on_deck: false,
    on_deck_order: 0,
    locked_at: c.cover_url ? new Date().toISOString() : null,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  let body: { lookbackDays?: number; dryRun?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const lookbackDays =
    typeof body.lookbackDays === "number" && body.lookbackDays > 0
      ? Math.min(body.lookbackDays, 365)
      : LOOKBACK_DAYS;
  const dryRun = Boolean(body.dryRun);

  // Prefer the signed-in user when present; otherwise MAGAZINE_SYNC_USER_ID / sole owner.
  let userId = Deno.env.get("MAGAZINE_SYNC_USER_ID") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader.startsWith("Bearer ") && authHeader.slice(7) !== anonKey) {
    const asUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await asUser.auth.getUser();
    if (userData.user) userId = userData.user.id;
  }

  const admin = createClient(supabaseUrl, serviceKey);
  if (!userId) {
    const { data: owners, error: ownerErr } = await admin
      .from("books")
      .select("user_id")
      .limit(1);
    if (ownerErr) return json({ error: ownerErr.message }, 500);
    userId = owners?.[0]?.user_id ?? "";
  }
  if (!userId) return json({ error: "No MAGAZINE_SYNC_USER_ID and no library owner found" }, 400);

  let ba: Candidate[] = [];
  let sw: Candidate[] = [];
  let si: Candidate[] = [];
  const errors: string[] = [];
  try {
    ba = await fetchBaCandidates(lookbackDays);
  } catch (e) {
    errors.push(`Baseball America: ${String(e)}`);
  }
  try {
    sw = await fetchSwCandidates(lookbackDays);
  } catch (e) {
    errors.push(`Sports Weekly: ${String(e)}`);
  }
  try {
    si = await fetchSiCandidates(lookbackDays);
  } catch (e) {
    errors.push(`Sports Illustrated: ${String(e)}`);
  }

  const candidates = [...ba, ...sw, ...si];

  // Existing magazine rows for this user — match on source_url or external tag.
  const { data: existing, error: exErr } = await admin
    .from("books")
    .select("id, series, subtitle, source_url, tags")
    .eq("user_id", userId)
    .eq("content_type", "magazine");
  if (exErr) return json({ error: exErr.message }, 500);

  const existingUrls = new Set(
    (existing ?? []).map((r) => String(r.source_url ?? "").toLowerCase()).filter(Boolean),
  );
  const existingKeys = new Set<string>();
  for (const r of existing ?? []) {
    const tags = Array.isArray(r.tags) ? r.tags : [];
    for (const t of tags) {
      if (/^(ba|sw|si):/i.test(String(t))) existingKeys.add(String(t).toLowerCase());
    }
    const series = String(r.series ?? "").trim().toLowerCase();
    const sub = String(r.subtitle ?? "").trim().toLowerCase();
    if (series && sub) existingKeys.add(`${series}::${sub}`);
  }

  const toInsert = candidates.filter((c) => {
    if (existingUrls.has(c.source_url.toLowerCase())) return false;
    if (existingKeys.has(c.external_key.toLowerCase())) return false;
    const pair = `${c.publication.toLowerCase()}::${c.issue.toLowerCase()}`;
    if (existingKeys.has(pair)) return false;
    return true;
  });

  if (dryRun) {
    return json({
      ok: true,
      dryRun: true,
      looked: candidates.length,
      wouldInsert: toInsert.length,
      baseballAmerica: ba.length,
      sportsWeekly: sw.length,
      sportsIllustrated: si.length,
      candidates: toInsert.map((c) => ({
        publication: c.publication,
        issue: c.issue,
        source_url: c.source_url,
        content_type: "magazine",
      })),
      errors,
      lookbackDays,
      since: daysAgoIso(lookbackDays),
    });
  }

  const inserted: Array<{ publication: string; issue: string; id: string }> = [];
  for (const c of toInsert) {
    const row = buildMagazineRow(userId, c);
    const { data, error } = await admin.from("books").insert(row).select("id").single();
    if (error) {
      errors.push(`insert ${c.publication} ${c.issue}: ${error.message}`);
      continue;
    }
    inserted.push({ publication: c.publication, issue: c.issue, id: data.id });
  }

  return json({
    ok: true,
    looked: candidates.length,
    inserted: inserted.length,
    issues: inserted,
    baseballAmerica: ba.length,
    sportsWeekly: sw.length,
    sportsIllustrated: si.length,
    skipped: candidates.length - toInsert.length,
    errors,
    lookbackDays,
  });
});
