import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  clusterBriefs,
  clusterExtractTargets,
  extractArticleFromHtml,
  imageCreditFor,
  itemsFromFeed,
  mechanicalStories,
  NATIONAL_CLUSTER_CAP,
  NATIONAL_SOURCES,
  NATIONAL_STORY_MIN,
  nationalPress,
  padStories,
  parseOgImage,
  parseRss,
  pickExtractedBody,
  rankClusters,
  readNationalEditor,
  storiesFromEditor,
  type ExtractedArticle,
  type FeedStatus,
  type NationalCluster,
  type NationalDesk,
  type NationalItem,
  type NationalSource,
  type NationalStory,
} from "../_shared/national-news.ts";
import {
  bearerToken,
  isServiceRoleToken,
  probeAuthAdmin,
} from "./service-role.ts";

/**
 * Thompson Times national-news press. Independent of newspaper-press:
 * a failure here never blocks or rewrites a sports edition.
 *
 * Callers: pg_cron with the anon key, or a signed-in reader. Writes with
 * the service role. `{ "refresh": true }` is service-role only (trimmed
 * SUPABASE_SERVICE_ROLE_KEY, or a bearer JWT whose verified role is
 * service_role). Secret: XAI_API_KEY (already on the project).
 */

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "grok-4.6";
const XAI_BASE = "https://api.x.ai/v1";
const EDITOR_TIMEOUT_MS = 60_000;
const OG_TIMEOUT_MS = 6_000;
const EXTRACT_TIMEOUT_MS = 8_000;
const OG_UA = "ThompsonTimes/1.0 (national-news desk)";

const SYSTEM = `You are the national-news editor of the Thompson Times, a one-reader broadsheet printed three times a day (6 a.m. morning, noon midday, 5 p.m. evening, Central time) for a reader in Marshfield, Missouri.

You receive CLUSTER briefs: events already grouped across conservative-leaning straight-news desks (Fox News, WSJ, New York Post, Washington Examiner, Washington Free Beacon, The Dispatch, National Review news, Daily Wire) plus AP and Reuters as a wire check. Each cluster has a mechanical score. Opinion, columns, podcasts, videos and celebrity fluff should already be thin; reject any that slipped through.

Pick the 12 to 16 most important NATIONAL stories for this edition. News only — no opinion, analysis or columns.
- Importance: government, war and diplomacy, the courts, the economy, the border, elections, major disasters. Not sports, not celebrity, not culture-war bait unless it is actual news.
- Reject duplicates, day-old process pieces, and anything that is really an opinion column, analysis or signed column.
- For each pick write a clean newspaper headline (no outlet name, no question-mark tease) and a 2–3 sentence factual summary in neutral newspaper voice. Put each sentence in the \`paragraphs\` array (one sentence per string). Also set \`summary\` to those paragraphs joined by spaces. Do not editorialize. Do not invent facts that are not in the cluster.
- sourceItemId must be one of the item ids in that cluster. Prefer the conservative outlet's straight-news piece (Fox, WSJ, Examiner, Post) over the wire; use AP or Reuters only when they are the clearest account.
- credit is the outlets that filed it, conservative first, like "Fox News, WSJ" or "WSJ, AP".

Use only cluster ids you were given.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["picks", "rationale"],
  properties: {
    picks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["clusterId", "headline", "summary", "paragraphs", "sourceItemId", "credit"],
        properties: {
          clusterId: { type: "string" },
          headline: { type: "string" },
          summary: { type: "string" },
          paragraphs: { type: "array", items: { type: "string" } },
          sourceItemId: { type: "string" },
          credit: { type: "string" },
        },
      },
    },
    rationale: { type: "string" },
  },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function responseText(data: Record<string, unknown>): string {
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text;
  const parts: string[] = [];
  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (!item || typeof item !== "object") continue;
      const block = item as Record<string, unknown>;
      if (typeof block.text === "string") parts.push(block.text);
      if (Array.isArray(block.content)) {
        for (const c of block.content) {
          if (!c || typeof c !== "object") continue;
          const chunk = c as Record<string, unknown>;
          if (typeof chunk.text === "string") parts.push(chunk.text);
        }
      }
    }
  }
  return parts.join("\n");
}

async function askGrok(apiKey: string, user: string): Promise<{ desk: Record<string, unknown>; model: string }> {
  const res = await fetch(`${XAI_BASE}/responses`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      store: false,
      reasoning: { effort: "low" },
      max_output_tokens: 8000,
      input: [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
      text: { format: { type: "json_schema", name: "national_desk", schema: SCHEMA, strict: true } },
    }),
    signal: AbortSignal.timeout(EDITOR_TIMEOUT_MS),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`xAI ${res.status}: ${raw.slice(0, 300)}`);
  const data = JSON.parse(raw) as Record<string, unknown>;
  const text = responseText(data).trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)?.[1] ?? text;
  const desk = JSON.parse(fenced) as Record<string, unknown>;
  if (!desk || typeof desk !== "object" || Array.isArray(desk)) throw new Error("Editor answer was not an object");
  return { desk, model: String(data.model ?? MODEL) };
}

async function fetchFeed(source: NationalSource): Promise<{ source: NationalSource; items: NationalItem[]; ok: boolean }> {
  try {
    const res = await fetch(source.url, {
      headers: {
        Accept: "application/rss+xml, application/atom+xml, text/xml, */*",
        "User-Agent": "ThompsonTimes/1.0 (national-news desk)",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { source, items: [], ok: false };
    const xml = await res.text();
    if (xml.length < 80 || !/<item\b|<entry\b/i.test(xml)) return { source, items: [], ok: false };
    return { source, items: itemsFromFeed(source, parseRss(xml)), ok: true };
  } catch {
    return { source, items: [], ok: false };
  }
}

function budgetText(edition: string, briefs: ReturnType<typeof clusterBriefs>): string {
  return [
    `Edition: ${edition}`,
    `Now: ${new Date().toISOString()}`,
    "",
    `CLUSTERS (${briefs.length}, best first, one JSON object per line):`,
    ...briefs.map((b) => JSON.stringify(b)),
  ].join("\n");
}

async function fetchOgImage(articleUrl: string): Promise<string | null> {
  try {
    const res = await fetch(articleUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent": OG_UA,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(OG_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const html = await res.text();
    if (html.length < 80) return null;
    return parseOgImage(html, articleUrl);
  } catch {
    return null;
  }
}

async function attachStoryImages(stories: NationalStory[]): Promise<NationalStory[]> {
  const out: NationalStory[] = new Array(stories.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(4, stories.length) }, async () => {
    while (next < stories.length) {
      const i = next++;
      const story = stories[i]!;
      if (story.imageUrl) {
        out[i] = { ...story, imageCredit: imageCreditFor(story.source, story.imageCredit) };
        continue;
      }
      const imageUrl = await fetchOgImage(story.url);
      out[i] = {
        ...story,
        imageUrl,
        imageCredit: imageUrl ? imageCreditFor(story.source, story.imageCredit) : null,
      };
    }
  });
  await Promise.all(workers);
  return out;
}

async function fetchArticlePage(articleUrl: string): Promise<string | null> {
  try {
    const res = await fetch(articleUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent": OG_UA,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(EXTRACT_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const html = await res.text();
    return html.length >= 80 ? html : null;
  } catch {
    return null;
  }
}

async function extractUrl(url: string): Promise<ExtractedArticle | null> {
  const html = await fetchArticlePage(url);
  if (!html) return null;
  return extractArticleFromHtml(html, url);
}

/** Full text at file time, so the paper reader can set it like a sports wrap. */
async function attachStoryBodies(
  stories: NationalStory[],
  clusters: NationalCluster[],
): Promise<NationalStory[]> {
  const byId = new Map(clusters.map((c) => [c.id, c]));
  const out: NationalStory[] = new Array(stories.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(3, stories.length) }, async () => {
    while (next < stories.length) {
      const i = next++;
      const story = stories[i]!;
      const cluster = byId.get(story.id);
      const targets = cluster
        ? clusterExtractTargets(cluster, story.url).slice(0, 4)
        : [{ url: story.url, outlet: story.source, snippet: story.summary }];
      const preferred = await extractUrl(targets[0]!.url);
      const alts: { outlet: string; extract: ExtractedArticle }[] = [];
      const needFallback = !preferred || preferred.paywalled || preferred.text.length < 360;
      if (needFallback) {
        for (const target of targets.slice(1, 3)) {
          const extract = await extractUrl(target.url);
          if (extract) alts.push({ outlet: target.outlet, extract });
        }
      }
      const rss = targets.map((t) => t.snippet).find((s) => (s?.length ?? 0) >= 80) ?? story.summary;
      const picked = pickExtractedBody(preferred, alts, rss);
      const imageUrl = story.imageUrl || picked.imageUrl || null;
      out[i] = {
        ...story,
        body: picked.text || story.body || null,
        byline: picked.byline,
        bodyNote: picked.note,
        imageUrl,
        imageCredit: imageUrl ? imageCreditFor(story.source, story.imageCredit) : null,
      };
    }
  });
  await Promise.all(workers);
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ ok: false, error: "Missing Supabase env" }, 500);
  const supabase = createClient(url, key);

  const token = bearerToken(req.headers.get("Authorization"));
  const service = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  const anon = (Deno.env.get("SUPABASE_ANON_KEY") ?? "").trim();
  let wantsRefresh = false;
  try {
    const body = (await req.json()) as { refresh?: unknown };
    wantsRefresh = body?.refresh === true;
  } catch {
    wantsRefresh = false;
  }
  const refresh = wantsRefresh && await isServiceRoleToken(token, service, {
    verifyClaims: async (jwt) => {
      const { data, error } = await supabase.auth.getClaims(jwt);
      if (error || !data?.claims) return null;
      return data.claims as Record<string, unknown>;
    },
    probeAdmin: (jwt) => probeAuthAdmin(url, jwt, service || anon || jwt),
  });

  const press = nationalPress();
  const { data: existing } = await supabase
    .from("times_national_news")
    .select("issue_id, stories")
    .eq("issue_id", press.id)
    .maybeSingle();
  if (!refresh && Array.isArray(existing?.stories) && existing.stories.length) {
    return json({ ok: true, id: press.id, skipped: true, stories: existing.stories.length });
  }

  const fetched = await Promise.all(NATIONAL_SOURCES.map(fetchFeed));
  const sources: FeedStatus[] = fetched.map((row) => ({
    id: row.source.id,
    outlet: row.source.outlet,
    url: row.source.url,
    ok: row.ok,
    count: row.items.length,
  }));
  const items = fetched.flatMap((row) => row.items);
  if (items.length < 8) {
    return json({ ok: false, error: "Not enough national copy", sources }, 502);
  }

  const clusters = rankClusters(items);
  const briefs = clusterBriefs(clusters, NATIONAL_CLUSTER_CAP);
  const mechanical = mechanicalStories(clusters);
  let stories = mechanical;
  let editor: NationalDesk["editor"] = { model: null, fallback: true, rationale: "Mechanical ranking." };

  const apiKey = Deno.env.get("XAI_API_KEY");
  if (apiKey && briefs.length >= 4) {
    try {
      const { desk, model } = await askGrok(apiKey, budgetText(press.id, briefs));
      const read = readNationalEditor({ ...desk, model }, briefs);
      if (read) {
        const picked = storiesFromEditor(read, clusters);
        if (picked.length >= 8 || (picked.length >= 4 && briefs.length < NATIONAL_STORY_MIN)) {
          stories = padStories(picked, mechanical);
          editor = { model, fallback: false, rationale: read.rationale };
        }
      }
    } catch {
      /* the mechanical desk still files */
    }
  }

  stories = await attachStoryImages(stories);
  stories = await attachStoryBodies(stories, clusters);

  if (!stories.length) return json({ ok: false, error: "Nothing to file", sources }, 502);

  const row = {
    issue_id: press.id,
    day: press.day,
    edition: press.edition,
    stories,
    sources,
    editor,
    printed_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("times_national_news").upsert(row, { onConflict: "issue_id" });
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({
    ok: true,
    id: press.id,
    stories: stories.length,
    fallback: editor.fallback,
    sources: sources.filter((s) => s.ok).map((s) => s.id),
  });
});
