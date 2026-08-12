import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Proxies the browser to the Todoist unified API so the token never ships
// to the client. verify_jwt is on, so only a signed-in Supabase user gets here.
//
// NOTE: Todoist REST v2 (/rest/v2/) is retired and returns HTTP 410.
// Everything below targets /api/v1/.
//
// Deploy: supabase functions deploy todoist
// Secret: TODOIST_API_TOKEN (Project Settings -> Edge Functions -> Secrets)

const TODOIST_BASE = "https://api.todoist.com/api/v1";
const TOKEN_VAR = "TODOIST_API_TOKEN";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

// The token has full account access, so the proxy only forwards resources the
// dashboard actually uses. Anything else is refused here rather than at Todoist.
const ALLOWED_RESOURCES = new Set([
  "tasks",
  "projects",
  "sections",
  "labels",
  "comments",
]);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  const url = new URL(req.url);

  // Supabase routes as /functions/v1/todoist/<path>; strip both prefixes so
  // callers just pass "tasks", "tasks/123/close", etc.
  const path = url.pathname
    .replace(/^\/functions\/v1/, "")
    .replace(/^\/todoist\/?/, "")
    .replace(/^\/+/, "");

  if (!path) {
    return json({ error: "No Todoist resource specified" }, 400);
  }

  const resource = path.split("/")[0];
  if (!ALLOWED_RESOURCES.has(resource)) {
    return json(
      { error: `Resource '${resource}' is not allowed`, allowed: [...ALLOWED_RESOURCES] },
      403,
    );
  }

  const token = Deno.env.get(TOKEN_VAR);
  if (!token) {
    return json({ error: `${TOKEN_VAR} is not set in Edge Function secrets` }, 500);
  }

  const target = `${TODOIST_BASE}/${path}${url.search}`;

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  let body: string | undefined;

  if (req.method !== "GET" && req.method !== "HEAD") {
    const raw = await req.text();
    if (raw) {
      body = raw;
      headers["Content-Type"] = "application/json";
    }
  }

  try {
    const res = await fetch(target, { method: req.method, headers, body });
    const text = await res.text();

    // Todoist returns 204 with an empty body on delete/close.
    if (!text) {
      return new Response(null, { status: res.status, headers: CORS });
    }

    return new Response(text, {
      status: res.status,
      headers: {
        ...CORS,
        "Content-Type": res.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch (err) {
    return json({ error: "Upstream request to Todoist failed", detail: String(err) }, 502);
  }
});
