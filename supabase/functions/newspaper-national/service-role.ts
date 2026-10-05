/**
 * Who may force a national-news refile (`refresh: true`).
 *
 * Cron and signed-in readers may file a missing edition, but they must not
 * overwrite one that already printed. The Management API often sends the
 * project's service_role JWT while SUPABASE_SERVICE_ROLE_KEY is the new-style
 * secret key (or the same JWT with different whitespace) — so a raw
 * `token === env` check is not enough.
 */

export function bearerToken(authorization: string | null | undefined): string {
  return (authorization ?? "").replace(/^Bearer\s+/i, "").trim();
}

export function looksLikeJwt(token: string): boolean {
  return token.split(".").length === 3 && token.length > 20;
}

export function matchesServiceRoleKey(token: string, serviceKey: string): boolean {
  const a = token.trim();
  const b = serviceKey.trim();
  return Boolean(a && b && a === b);
}

export type JwtClaims = Record<string, unknown>;

export type ServiceRoleChecks = {
  /** Verify the JWT (JWKS / Auth) and return its claims, or null if invalid. */
  verifyClaims?: (jwt: string) => Promise<JwtClaims | null>;
  /**
   * Probe an Auth admin endpoint that only a real service_role credential
   * can pass. Used when getClaims cannot verify a legacy HS256 service JWT.
   */
  probeAdmin?: (jwt: string) => Promise<boolean>;
};

/**
 * True only for the service-role key or a verified service_role JWT.
 * Anon / authenticated / forged tokens fail closed.
 */
export async function isServiceRoleToken(
  token: string,
  serviceKey: string,
  checks: ServiceRoleChecks = {},
): Promise<boolean> {
  if (matchesServiceRoleKey(token, serviceKey)) return true;
  const jwt = token.trim();
  if (!looksLikeJwt(jwt)) return false;

  if (checks.verifyClaims) {
    try {
      const claims = await checks.verifyClaims(jwt);
      if (claims) return claims.role === "service_role";
    } catch {
      /* fall through to the admin probe */
    }
  }

  if (checks.probeAdmin) {
    try {
      return await checks.probeAdmin(jwt);
    } catch {
      return false;
    }
  }
  return false;
}

export async function verifyJwtClaimsViaAuth(
  url: string,
  apiKey: string,
  jwt: string,
  getClaims: (jwt: string) => Promise<{ data: { claims?: JwtClaims } | null; error: unknown }>,
): Promise<JwtClaims | null> {
  if (!url || !apiKey || !jwt) return null;
  const { data, error } = await getClaims(jwt);
  if (error || !data?.claims) return null;
  return data.claims;
}

export async function probeAuthAdmin(
  url: string,
  jwt: string,
  apikey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const base = url.trim().replace(/\/+$/, "");
  if (!base || !jwt) return false;
  try {
    const res = await fetchImpl(`${base}/auth/v1/admin/users?per_page=1`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        apikey: apikey || jwt,
      },
      signal: AbortSignal.timeout(8_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
