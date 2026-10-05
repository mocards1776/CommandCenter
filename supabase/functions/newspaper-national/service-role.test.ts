/**
 * Run with:
 *   node --experimental-strip-types supabase/functions/newspaper-national/service-role.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bearerToken,
  isServiceRoleToken,
  looksLikeJwt,
  matchesServiceRoleKey,
  probeAuthAdmin,
} from "./service-role.ts";

const SERVICE_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UifQ.sig";
const USER_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYXV0aGVudGljYXRlZCIsInN1YiI6InUifQ.sig";
const ANON_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIn0.sig";
const FORGED_SERVICE =
  "eyJhbGciOiJub25lIn0.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.fakesig";

test("bearerToken strips Bearer and whitespace", () => {
  assert.equal(bearerToken("Bearer  abc  "), "abc");
  assert.equal(bearerToken("bearer xyz"), "xyz");
  assert.equal(bearerToken(null), "");
});

test("looksLikeJwt requires three segments", () => {
  assert.equal(looksLikeJwt(SERVICE_JWT), true);
  assert.equal(looksLikeJwt("sb_secret_abc"), false);
  assert.equal(looksLikeJwt(""), false);
});

test("trimmed service key matches even with surrounding whitespace", () => {
  assert.equal(matchesServiceRoleKey(`  ${SERVICE_JWT}  `, `\n${SERVICE_JWT}\n`), true);
  assert.equal(matchesServiceRoleKey(SERVICE_JWT, "sb_secret_other"), false);
  assert.equal(matchesServiceRoleKey("", SERVICE_JWT), false);
});

test("accepts an exact (trimmed) service-role key without calling Auth", async () => {
  let called = false;
  const ok = await isServiceRoleToken(` ${SERVICE_JWT} `, `\t${SERVICE_JWT} `, {
    verifyClaims: async () => {
      called = true;
      return null;
    },
    probeAdmin: async () => {
      called = true;
      return false;
    },
  });
  assert.equal(ok, true);
  assert.equal(called, false);
});

test("accepts a verified JWT whose role claim is service_role", async () => {
  const ok = await isServiceRoleToken(SERVICE_JWT, "sb_secret_new_style", {
    verifyClaims: async () => ({ role: "service_role", iss: "supabase" }),
  });
  assert.equal(ok, true);
});

test("rejects verified anon and authenticated JWTs", async () => {
  assert.equal(
    await isServiceRoleToken(USER_JWT, "sb_secret_new_style", {
      verifyClaims: async () => ({ role: "authenticated", sub: "u" }),
      probeAdmin: async () => {
        throw new Error("must not probe after a verified user JWT");
      },
    }),
    false,
  );
  assert.equal(
    await isServiceRoleToken(ANON_JWT, "sb_secret_new_style", {
      verifyClaims: async () => ({ role: "anon" }),
    }),
    false,
  );
});

test("falls back to Auth admin when getClaims cannot verify a service JWT", async () => {
  const ok = await isServiceRoleToken(SERVICE_JWT, "sb_secret_new_style", {
    verifyClaims: async () => null,
    probeAdmin: async () => true,
  });
  assert.equal(ok, true);
});

test("forged service_role payload is rejected when Auth disagrees", async () => {
  const ok = await isServiceRoleToken(FORGED_SERVICE, "sb_secret_new_style", {
    verifyClaims: async () => null,
    probeAdmin: async () => false,
  });
  assert.equal(ok, false);
});

test("empty or non-JWT tokens never refresh", async () => {
  assert.equal(await isServiceRoleToken("", "sb_secret_new_style"), false);
  assert.equal(await isServiceRoleToken("sb_publishable_x", "sb_secret_new_style"), false);
  assert.equal(await isServiceRoleToken("anon-key", ""), false);
});

test("probeAuthAdmin treats HTTP 200 as service_role and everything else as no", async () => {
  const ok = await probeAuthAdmin(
    "https://example.supabase.co/",
    SERVICE_JWT,
    "sb_secret_new_style",
    async (input) => {
      assert.equal(String(input), "https://example.supabase.co/auth/v1/admin/users?per_page=1");
      return new Response("{}", { status: 200 });
    },
  );
  assert.equal(ok, true);

  const denied = await probeAuthAdmin(
    "https://example.supabase.co",
    USER_JWT,
    "sb_secret_new_style",
    async () => new Response("no", { status: 403 }),
  );
  assert.equal(denied, false);
});
