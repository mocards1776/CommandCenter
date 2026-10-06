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
type PrintedQuery = { key: unknown[]; data: unknown };
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
  slimPrintedQuery: (query: PrintedQuery) => PrintedQuery;
  checkpointBag: (bag: Record<string, unknown>) => Record<string, unknown>;
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
      editor?: (request: unknown) => Promise<unknown>;
    },
    bag: Record<string, unknown> | null,
  ) => Promise<
    | { done: false; bag: Record<string, unknown>; flush: PrintedQuery[]; stories?: unknown[] }
    | { done: true; issue: Issue; flush: PrintedQuery[]; stories?: unknown[] }
  >;
};

/** Long enough for one Grok pass; short enough that a hung editor still leaves time to file the rule desk's paper. */
const EDITOR_TIMEOUT_MS = 60_000;

/** Soft ceiling for the POST body to newspaper-editor after local trim. */
const EDITOR_REQUEST_MAX_BYTES = 120_000;

type EditorCand = Record<string, unknown> & { id?: unknown; headline?: unknown };
type EditorReq = { edition?: unknown; candidates?: unknown; games?: unknown };

/**
 * Keep only what the editor needs to judge the front: id, headline, dek, source,
 * desk/club/league flags. Drop body snippets/HTML. Cap list sizes so a busy slate
 * cannot bloat the edge hop.
 */
function trimEditorRequest(raw: unknown): { request: EditorReq; bytesBefore: number; bytesAfter: number } {
  const bytesBefore = JSON.stringify(raw ?? null).length;
  const src = (raw && typeof raw === "object" ? raw : {}) as EditorReq;
  const trimCand = (row: unknown, kind: "news" | "game"): EditorCand | null => {
    if (!row || typeof row !== "object") return null;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id.slice(0, 200) : "";
    const headline = typeof r.headline === "string" ? r.headline.replace(/\s+/g, " ").trim().slice(0, 240) : "";
    if (!id || !headline) return null;
    if (kind === "game") {
      return {
        id,
        headline,
        score: typeof r.score === "string" ? r.score.slice(0, 60) : null,
        favoriteKey: typeof r.favoriteKey === "string" ? r.favoriteKey.slice(0, 40) : null,
        desk: typeof r.desk === "string" ? r.desk.slice(0, 12) : null,
        league: typeof r.league === "string" ? r.league.slice(0, 8) : null,
        status: typeof r.status === "string" ? r.status.slice(0, 40) : null,
        postseason: r.postseason === true,
        hasCopy: r.hasCopy === true,
        holdover: r.holdover === true,
      };
    }
    const dek =
      typeof r.dek === "string"
        ? r.dek.replace(/\s+/g, " ").trim().slice(0, 200)
        : null;
    return {
      id,
      headline,
      dek: dek || null,
      // Intentionally omit snippet/body — headline+dek+source+ids is enough to judge.
      favoriteKey: typeof r.favoriteKey === "string" ? r.favoriteKey.slice(0, 40) : null,
      desk: typeof r.desk === "string" ? r.desk.slice(0, 12) : null,
      league: typeof r.league === "string" ? r.league.slice(0, 8) : null,
      status: typeof r.status === "string" ? r.status.slice(0, 40) : null,
      source: typeof r.source === "string" ? r.source.slice(0, 60) : null,
      when: typeof r.when === "string" ? r.when.slice(0, 40) : null,
      final: r.final === true,
      recap: r.recap === true,
      preview: r.preview === true,
      postseason: r.postseason === true,
      holdover: r.holdover === true,
      ruleRank: typeof r.ruleRank === "number" ? r.ruleRank : null,
      ruleScore: typeof r.ruleScore === "number" ? r.ruleScore : null,
    };
  };
  const candidates = (Array.isArray(src.candidates) ? src.candidates : [])
    .map((row) => trimCand(row, "news"))
    .filter((row): row is EditorCand => Boolean(row))
    .slice(0, 24);
  const games = (Array.isArray(src.games) ? src.games : [])
    .map((row) => trimCand(row, "game"))
    .filter((row): row is EditorCand => Boolean(row))
    .slice(0, 16);
  const request: EditorReq = {
    edition: typeof src.edition === "string" ? src.edition.slice(0, 40) : "",
    candidates,
    games,
  };
  return { request, bytesBefore, bytesAfter: JSON.stringify(request).length };
}

/** One call to the newspaper-editor function. A throw means the rule desk sets the paper. */
function askEditor(url: string, key: string) {
  return async (request: unknown): Promise<unknown> => {
    const { request: trimmed, bytesBefore, bytesAfter } = trimEditorRequest(request);
    if (bytesAfter > EDITOR_REQUEST_MAX_BYTES) {
      console.error(
        `[newspaper-press] EDITOR SKIPPED: trimmed request still ${bytesAfter} bytes ` +
          `(was ${bytesBefore}) exceeds ${EDITOR_REQUEST_MAX_BYTES}. Rule desk will file.`,
      );
      throw new Error(`editor request too large after trim (${bytesAfter} bytes)`);
    }
    if (bytesBefore !== bytesAfter) {
      console.info(
        `[newspaper-press] editor request trimmed ${bytesBefore} → ${bytesAfter} bytes ` +
          `(${(trimmed.candidates as unknown[]).length} news, ${(trimmed.games as unknown[]).length} games)`,
      );
    }
    const res = await fetch(`${url}/functions/v1/newspaper-editor`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, apikey: key },
      body: JSON.stringify(trimmed),
      signal: AbortSignal.timeout(EDITOR_TIMEOUT_MS),
    });
    const body = (await res.json().catch(() => null)) as { ok?: boolean; desk?: unknown; error?: string } | null;
    if (!res.ok || !body?.ok || !body.desk) throw new Error(body?.error ?? `newspaper-editor ${res.status}`);
    return body.desk;
  };
}

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
  const { deskFavorites, pressEdition, previousPressId, pressStep, slimPrintedQuery, checkpointBag } =
    await loadPress();
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
  const bag =
    saved && typeof saved === "object" && !Array.isArray(saved) && saved.checkpoint ? (saved.bag ?? null) : null;
  const bagStage = typeof bag?.stage === "number" ? bag.stage : 0;

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
    // Only the Missouri desk (8) and story file (15) need yesterday's paper.
    if (prevId && (bagStage === 8 || (bagStage === 15 && !Array.isArray(bag?.filed)))) {
      const { data: prev } = await supabase
        .from("newspaper_issues")
        .select(bagStage === 8 ? "queries" : "stories")
        .eq("id", prevId)
        .eq("status", "ready")
        .maybeSingle();
      if (bagStage === 15 && !Array.isArray(bag?.filed) && Array.isArray(prev?.stories)) carried = prev.stories;
      if (bagStage === 8) {
        const queries = Array.isArray(prev?.queries) ? prev.queries : [];
        for (const query of queries) {
          const row = query as { key?: unknown; data?: { items?: unknown[] } };
          if (Array.isArray(row.key) && row.key[1] === "tt-missouri" && Array.isArray(row.data?.items)) {
            carriedMissouri = row.data.items;
          }
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
        // Editor always runs unless NEWSPAPER_EDITOR=off. askEditor trims the
        // payload (headline+dek+source+ids, capped lists) and only throws — with a
        // loud log — if the trimmed request still exceeds EDITOR_REQUEST_MAX_BYTES.
        editor: Deno.env.get("NEWSPAPER_EDITOR") === "off" ? undefined : askEditor(url, key),
      },
      bag,
    );
    const flush = (step.flush ?? []).map(slimPrintedQuery);
    const storyFlush = step.stories ?? (!step.done ? [] : step.issue.stories);
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) throw new Error("Missing database URL");
    if (!step.done) {
      // Persist only this hop's flush + story slice + the slim bag.
      // Postgres concatenates desks and stories so this isolate never
      // reloads or stringifies the whole edition.
      const bag = checkpointBag(step.bag ?? { stage: 0 });
      const pool = new Pool(dbUrl, 1);
      const connection = await pool.connect();
      try {
        await connection.queryObject(
          `update public.newspaper_issues
              set status = 'printing',
                  printed_at = now(),
                  stories = case
                    when coalesce(($1::jsonb->>'stage')::int, 0) < 18 then '[]'::jsonb
                    else coalesce(stories, '[]'::jsonb) || $4::jsonb
                  end,
                  queries = jsonb_build_object(
                    'checkpoint', true,
                    'bag', $1::jsonb,
                    'desks', coalesce(
                      case
                        when jsonb_typeof(queries) = 'object' then queries->'desks'
                        else '[]'::jsonb
                      end,
                      '[]'::jsonb
                    ) || $2::jsonb
                  )
            where id = $3`,
          [JSON.stringify(bag), JSON.stringify(flush), press.id, JSON.stringify(storyFlush)],
        );
        await connection.queryObject(
          "select net.http_post(url := $1::text, headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', $2::text), body := $3::text::jsonb, timeout_milliseconds := 150000)",
          [`${url}/functions/v1/newspaper-press`, `Bearer ${key}`, JSON.stringify({ continue: true })],
        );
      } finally {
        connection.release();
        await pool.end();
      }
      const stage = typeof step.bag.stage === "number" ? step.bag.stage : null;
      return Response.json({
        ok: true,
        id: press.id,
        stage,
        flushed: flush.length,
        stories: storyFlush.length,
      });
    }
    const pool = new Pool(dbUrl, 1);
    const connection = await pool.connect();
    try {
      const filed = await connection.queryObject<{ n: number; ns: number }>(
        `update public.newspaper_issues
            set version = $1,
                status = 'ready',
                stories = coalesce(stories, '[]'::jsonb) || $2::jsonb,
                queries = coalesce(
                  case
                    when jsonb_typeof(queries) = 'object' then queries->'desks'
                    else '[]'::jsonb
                  end,
                  '[]'::jsonb
                ) || $3::jsonb,
                printed_at = now()
          where id = $4
          returning jsonb_array_length(queries) as n, jsonb_array_length(stories) as ns`,
        [ISSUE_VERSION, JSON.stringify(storyFlush ?? []), JSON.stringify(flush), press.id],
      );
      const queryCount = filed.rows[0]?.n ?? flush.length;
      const storyCount = filed.rows[0]?.ns ?? storyFlush.length;
      return Response.json({ ok: true, id: press.id, stories: storyCount, queries: queryCount });
    } finally {
      connection.release();
      await pool.end();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
