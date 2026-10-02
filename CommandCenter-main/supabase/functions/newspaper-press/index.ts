import { createClient } from "jsr:@supabase/supabase-js@2";
import { Pool } from "jsr:@db/postgres@^0";

/**
 * The composer is compose.bundle.js, stored as base64 in private.press_bundle.
 * The scheduled function reads those rows and runs the press while the app is closed.
 */
const ISSUE_VERSION = 1;

type Fav = { key: string };
type Layout = {
  order: string[];
  hidden: string[];
  pinnedPlayers: { id: string; name: string; teamKey: string }[];
};
type Issue = {
  version: number;
  id: string;
  stories: unknown[];
  queries: unknown[];
};
type PressModule = {
  composePress: (args: {
    pressId: string;
    day: string;
    favs: Fav[];
    layout: Layout;
    userId: string | null;
  }) => Promise<Issue>;
  deskFavorites: (order: string[] | null, hidden: string[] | null) => Fav[];
  pressEdition: () => { id: string; day: string };
  previousPressId: (pressId: string) => string | null;
  slimIssue: (issue: Issue) => Issue;
  pressStep: (
    args: {
      pressId: string;
      day: string;
      favs: Fav[];
      layout: Layout;
      userId: string | null;
      readKeys?: string[];
      carried?: unknown[];
      carriedMissouri?: unknown[];
    },
    bag: Record<string, unknown> | null,
  ) => Promise<{ done: false; bag: Record<string, unknown> } | { done: true; issue: Issue }>;
};

let loading: Promise<PressModule> | null = null;

function loadPress(): Promise<PressModule> {
  if (!loading) {
    loading = loadPressOnce().catch((err) => {
      loading = null;
      throw err;
    });
  }
  return loading;
}

async function loadPressOnce(): Promise<PressModule> {
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) throw new Error("Missing database URL");
  const pool = new Pool(dbUrl, 1);
  const connection = await pool.connect();
  try {
    const result = await connection.queryObject<{ body: string }>(
      "select body from private.press_bundle order by seq",
    );
    const b64 = result.rows.map((row) => row.body.trim()).join("");
    if (b64.length < 1000) throw new Error("Press bundle is empty");
    return (await import("data:application/javascript;base64," + b64)) as PressModule;
  } finally {
    connection.release();
    await pool.end();
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Expected POST", { status: 405 });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    return Response.json({ ok: false, error: "Missing Supabase env" }, { status: 500 });
  }

  const supabase = createClient(url, key);
  const { deskFavorites, pressEdition, previousPressId, pressStep, slimIssue } = await loadPress();
  const press = pressEdition();
  let continued = false;
  try {
    const body = (await req.json()) as { continue?: boolean };
    continued = body?.continue === true;
  } catch {
    continued = false;
  }
  const { data: existing } = await supabase
    .from("newspaper_issues")
    .select("status, printed_at, queries")
    .eq("id", press.id)
    .maybeSingle();

  if (existing?.status === "ready") {
    return Response.json({ ok: true, id: press.id, skipped: true });
  }
  if (existing?.status === "printing" && !continued) {
    const age = Date.now() - new Date(existing.printed_at).getTime();
    if (age < 90_000) return Response.json({ ok: true, id: press.id, busy: true });
  }

  if (!existing) {
    const { error: claimError } = await supabase.from("newspaper_issues").insert({
      id: press.id,
      version: ISSUE_VERSION,
      status: "printing",
      stories: [],
      queries: [],
      printed_at: new Date().toISOString(),
    });
    if (claimError) return Response.json({ ok: false, error: claimError.message }, { status: 500 });
  }

  const saved = existing?.queries as { checkpoint?: boolean; bag?: Record<string, unknown> } | null;
  const bag = saved && typeof saved === "object" && !Array.isArray(saved) && saved.checkpoint ? (saved.bag ?? null) : null;

  try {
    const { data: desk } = await supabase
      .from("newspaper_desk")
      .select("user_id, fav_order, hidden")
      .eq("id", "household")
      .maybeSingle();
    const favs = deskFavorites(desk?.fav_order ?? null, desk?.hidden ?? null);
    const layout = {
      order: desk?.fav_order?.length ? desk.fav_order : favs.map((fav) => fav.key),
      hidden: desk?.hidden ?? [],
      pinnedPlayers: [] as { id: string; name: string; teamKey: string }[],
    };
    const since = new Date(Date.now() - 48 * 3_600_000).toISOString();
    const { data: reads } = await supabase
      .from("rss_reads")
      .select("article_url")
      .gte("read_at", since)
      .order("read_at", { ascending: false })
      .limit(2000);
    const readKeys = (reads ?? []).map((row) => row.article_url).filter((url): url is string => Boolean(url));
    const prevId = previousPressId(press.id);
    let carried: unknown[] = [];
    let carriedMissouri: unknown[] = [];
    if (prevId) {
      const { data: prev } = await supabase
        .from("newspaper_issues")
        .select("stories, queries")
        .eq("id", prevId)
        .eq("status", "ready")
        .maybeSingle();
      if (Array.isArray(prev?.stories)) carried = prev.stories;
      const queries = Array.isArray(prev?.queries) ? prev.queries : [];
      for (const query of queries) {
        const row = query as { key?: unknown; data?: { items?: unknown[] } };
        if (Array.isArray(row.key) && row.key[1] === "tt-missouri" && Array.isArray(row.data?.items)) {
          carriedMissouri = row.data.items;
        }
      }
    }
    const step = await pressStep(
      {
        pressId: press.id,
        day: press.day,
        favs,
        layout,
        userId: desk?.user_id ?? null,
        readKeys,
        carried,
        carriedMissouri,
      },
      bag,
    );
    if (!step.done) {
      const { error } = await supabase
        .from("newspaper_issues")
        .update({
          status: "printing",
          queries: { checkpoint: true, bag: step.bag },
          printed_at: new Date().toISOString(),
        })
        .eq("id", press.id);
      if (error) throw new Error(error.message);
      const dbUrl = Deno.env.get("SUPABASE_DB_URL");
      if (!dbUrl) throw new Error("Missing database URL");
      const pool = new Pool(dbUrl, 1);
      const connection = await pool.connect();
      try {
        await connection.queryObject(
          "select net.http_post(url := $1::text, headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', $2::text), body := $3::text::jsonb, timeout_milliseconds := 150000)",
          [`${url}/functions/v1/newspaper-press`, `Bearer ${key}`, JSON.stringify({ continue: true })],
        );
      } finally {
        connection.release();
        await pool.end();
      }
      const stage = typeof step.bag.stage === "number" ? step.bag.stage : null;
      return Response.json({ ok: true, id: press.id, stage });
    }
    const issue = slimIssue(step.issue);
    const { error } = await supabase
      .from("newspaper_issues")
      .update({
        version: issue.version,
        status: "ready",
        stories: issue.stories,
        queries: issue.queries,
        printed_at: new Date().toISOString(),
      })
      .eq("id", press.id);
    if (error) throw new Error(error.message);
    return Response.json({ ok: true, id: press.id, stories: issue.stories.length, queries: issue.queries.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
