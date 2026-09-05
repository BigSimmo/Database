import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
  PROXY_AUTH_CLAIMS_MAX_AGE_SECONDS,
  signProxyAuthPayload,
  verifyProxyAuthHeader,
} from "@/lib/supabase/proxy-auth-crypto";
import { PROXY_AUTH_USER_HEADER, extractProxyAuthenticatedUser } from "@/lib/supabase/auth";

const SERVICE_ROLE_KEY = "unit-test-service-role-key";

function claimsPayload(id = "verified-user-789") {
  return Buffer.from(JSON.stringify({ id, appMetadata: { clinician: true } }), "utf8").toString("base64");
}

function requestWith(headerValue: string) {
  return new Request("http://localhost/api/test", { headers: { [PROXY_AUTH_USER_HEADER]: headerValue } });
}

describe("proxy claims freshness, key derivation and tamper resistance", () => {
  const previousServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const previousInternalKey = process.env.INTERNAL_SERVICE_KEY;

  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY;
    delete process.env.INTERNAL_SERVICE_KEY;
  });

  afterEach(() => {
    vi.useRealTimers();
    if (previousServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRoleKey;
    if (previousInternalKey === undefined) delete process.env.INTERNAL_SERVICE_KEY;
    else process.env.INTERNAL_SERVICE_KEY = previousInternalKey;
  });

  it("stamps an issued-at into the signed envelope and verifies a fresh header", () => {
    const payload = claimsPayload();
    const header = signProxyAuthPayload(payload);
    expect(header).not.toBeNull();

    const parts = String(header).split(".");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe(payload);
    expect(Number(parts[1])).toBeGreaterThan(0);
    expect(verifyProxyAuthHeader(String(header))).toBe(payload);
    expect(extractProxyAuthenticatedUser(requestWith(String(header)))?.id).toBe("verified-user-789");
  });

  it("rejects a captured header replayed after the verification window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-04T00:00:00Z"));
    const header = String(signProxyAuthPayload(claimsPayload()));

    vi.setSystemTime(new Date(Date.now() + (PROXY_AUTH_CLAIMS_MAX_AGE_SECONDS - 1) * 1000));
    expect(verifyProxyAuthHeader(header), "a header inside the window still verifies").not.toBeNull();

    vi.setSystemTime(new Date(Date.now() + (PROXY_AUTH_CLAIMS_MAX_AGE_SECONDS + 60) * 1000));
    expect(verifyProxyAuthHeader(header)).toBeNull();
    expect(extractProxyAuthenticatedUser(requestWith(header))).toBeNull();
  });

  it("rejects a header dated far in the future", () => {
    const payload = claimsPayload();
    const futureIat = Math.floor(Date.now() / 1000) + 3600;
    const forged = `${payload}.${futureIat}.${createHmac("sha256", SERVICE_ROLE_KEY)
      .update(`${payload}.${futureIat}`)
      .digest("base64url")}`;
    expect(verifyProxyAuthHeader(forged)).toBeNull();
  });

  it("rejects tampering with either the claims or the issued-at", () => {
    const header = String(signProxyAuthPayload(claimsPayload()));
    const [, iat, signature] = header.split(".");

    const swappedClaims = `${claimsPayload("attacker")}.${iat}.${signature}`;
    expect(verifyProxyAuthHeader(swappedClaims)).toBeNull();

    const refreshedIat = `${claimsPayload()}.${Number(iat) + 10_000}.${signature}`;
    expect(verifyProxyAuthHeader(refreshedIat)).toBeNull();

    expect(verifyProxyAuthHeader(`${claimsPayload()}.${iat}.${signature}x`)).toBeNull();
    // The legacy two-part envelope carried no issued-at, so it must not verify at all.
    expect(verifyProxyAuthHeader(`${claimsPayload()}.${signature}`)).toBeNull();
  });

  it("signs with a key derived from the service-role key, not the service-role key itself", () => {
    const payload = claimsPayload();
    const header = String(signProxyAuthPayload(payload));
    const [, iat, signature] = header.split(".");
    const rawKeySignature = createHmac("sha256", SERVICE_ROLE_KEY).update(`${payload}.${iat}`).digest("base64url");

    expect(signature).not.toBe(rawKeySignature);
    expect(verifyProxyAuthHeader(`${payload}.${iat}.${rawKeySignature}`)).toBeNull();
  });

  it("has no undeclared INTERNAL_SERVICE_KEY fallback", () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.INTERNAL_SERVICE_KEY = "undeclared-secret-name";

    expect(signProxyAuthPayload(claimsPayload())).toBeNull();
    const iat = Math.floor(Date.now() / 1000);
    const forged = `${claimsPayload()}.${iat}.${createHmac("sha256", "undeclared-secret-name")
      .update(`${claimsPayload()}.${iat}`)
      .digest("base64url")}`;
    expect(verifyProxyAuthHeader(forged)).toBeNull();
  });
});
