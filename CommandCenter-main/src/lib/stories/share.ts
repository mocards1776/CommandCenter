import { getAccessToken, supabase } from "@/lib/supabase";
import { STORY_SLUGS } from "@/lib/stories/types";

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

/**
 * Absolute origin used when minting client-facing story URLs.
 * Prefer a dedicated share host so links never point at an admin UI domain.
 */
export function clientShareOrigin(): string {
  const configured =
    import.meta.env.VITE_CLIENT_SHARE_ORIGIN?.replace(/\/$/, "") ||
    import.meta.env.VITE_PUBLIC_CLIENT_SHARE_ORIGIN?.replace(/\/$/, "");
  if (configured) return configured;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function storyShareUrl(token: string): string {
  return `${clientShareOrigin()}/story/${token}`;
}

export function isKnownStorySlug(slug: string): boolean {
  return STORY_SLUGS.includes(slug);
}

async function authHeaders(): Promise<HeadersInit> {
  const token = await getAccessToken();
  if (!token) throw new Error("Sign in required");
  return {
    Authorization: `Bearer ${token}`,
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
  };
}

/** POST mint (idempotent). Returns the secret token. */
export async function mintStoryLink(slug: string, label?: string): Promise<string> {
  if (!isKnownStorySlug(slug)) throw new Error("Unknown story slug");
  const res = await fetch(`${FUNCTIONS_BASE}/story-link`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ slug, label }),
  });
  const body = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
  if (!res.ok || !body.token) throw new Error(body.error || `Mint failed (${res.status})`);
  return body.token;
}

/** Soft-revoke active links for a slug. */
export async function revokeStoryLink(slug: string): Promise<number> {
  const res = await fetch(
    `${FUNCTIONS_BASE}/story-link?slug=${encodeURIComponent(slug)}`,
    { method: "DELETE", headers: await authHeaders() },
  );
  const body = (await res.json().catch(() => ({}))) as { revoked?: number; error?: string };
  if (!res.ok) throw new Error(body.error || `Revoke failed (${res.status})`);
  return body.revoked ?? 0;
}

/** Public resolve — prefers RPC, falls back to edge GET. */
export async function resolveStoryToken(
  token: string,
): Promise<{ slug: string; label: string | null } | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;

  const { data, error } = await supabase.rpc("resolve_story_link", { p_token: trimmed });
  if (!error && Array.isArray(data) && data[0]?.slug) {
    return { slug: data[0].slug as string, label: (data[0].label as string | null) ?? null };
  }

  const res = await fetch(
    `${FUNCTIONS_BASE}/story-link?token=${encodeURIComponent(trimmed)}`,
    {
      headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
    },
  );
  if (res.status === 404) return null;
  const body = (await res.json().catch(() => ({}))) as {
    slug?: string;
    label?: string | null;
    error?: string;
  };
  if (!res.ok || !body.slug) return null;
  return { slug: body.slug, label: body.label ?? null };
}
