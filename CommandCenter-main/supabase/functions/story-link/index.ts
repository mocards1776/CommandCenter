import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Mint / revoke client story share links.
 *
 * POST   body { slug, label? }  → { token }   (auth required, idempotent)
 * DELETE ?slug=...              → { revoked } (auth required, soft-revoke)
 * GET    ?token=...             → { slug, label } (public; token is the auth)
 *
 * Deploy: supabase functions deploy story-link --no-verify-jwt
 * (Auth is enforced in-handler for POST/DELETE; GET must stay public.)
 */

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

/** Known scroll-story slugs. Keep in sync with frontend story registry. */
const KNOWN_SLUGS = new Set(["1715-e-buena-vista", "1715-e-buena-vista-financial"]);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/** 18 cryptographically random bytes → base64url (~24 chars). */
function mintToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function requireUserId(req: Request): Promise<string> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) throw new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  return data.user.id;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const url = new URL(req.url);
    const admin = serviceClient();

    if (req.method === "GET") {
      const token = url.searchParams.get("token")?.trim();
      if (!token) return json({ error: "token required" }, 400);

      const { data, error } = await admin
        .from("story_links")
        .select("slug, label")
        .eq("token", token)
        .is("revoked_at", null)
        .maybeSingle();

      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: "Not found" }, 404);
      return json({ slug: data.slug, label: data.label });
    }

    // POST / DELETE require a signed-in staff session.
    let userId: string;
    try {
      userId = await requireUserId(req);
    } catch (res) {
      if (res instanceof Response) return res;
      throw res;
    }

    if (req.method === "POST") {
      const body = (await req.json().catch(() => ({}))) as { slug?: string; label?: string };
      const slug = body.slug?.trim();
      if (!slug) return json({ error: "slug required" }, 400);
      if (!KNOWN_SLUGS.has(slug)) return json({ error: "Unknown story slug" }, 400);

      const { data: existing, error: findErr } = await admin
        .from("story_links")
        .select("token")
        .eq("slug", slug)
        .is("revoked_at", null)
        .maybeSingle();

      if (findErr) return json({ error: findErr.message }, 500);
      if (existing?.token) return json({ token: existing.token });

      const token = mintToken();
      const { error: insertErr } = await admin.from("story_links").insert({
        token,
        slug,
        label: body.label?.trim() || null,
        created_by: userId,
      });

      if (insertErr) {
        // Race on unique active-slug index: re-read the winner.
        if (insertErr.code === "23505") {
          const { data: raced } = await admin
            .from("story_links")
            .select("token")
            .eq("slug", slug)
            .is("revoked_at", null)
            .maybeSingle();
          if (raced?.token) return json({ token: raced.token });
        }
        return json({ error: insertErr.message }, 500);
      }

      return json({ token });
    }

    if (req.method === "DELETE") {
      const slug = url.searchParams.get("slug")?.trim();
      if (!slug) return json({ error: "slug required" }, 400);
      if (!KNOWN_SLUGS.has(slug)) return json({ error: "Unknown story slug" }, 400);

      const { data, error } = await admin
        .from("story_links")
        .update({ revoked_at: new Date().toISOString() })
        .eq("slug", slug)
        .is("revoked_at", null)
        .select("id");

      if (error) return json({ error: error.message }, 500);
      return json({ revoked: data?.length ?? 0 });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    return json({ error: "story-link failed", detail: String(err) }, 500);
  }
});
