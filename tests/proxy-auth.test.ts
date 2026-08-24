import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  PROXY_AUTH_USER_HEADER,
  extractProxyAuthenticatedUser,
  resolveOptionalAuthentication,
} from "@/lib/supabase/auth";
import type { createAdminClient } from "@/lib/supabase/admin";

const getClaims = vi.fn(async () => ({
  data: {
    claims: {
      sub: "user-12345",
      app_metadata: { role: "clinician", provider: "email" },
    },
  },
  error: null,
}));

vi.mock("@supabase/ssr", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@supabase/ssr")>();
  return {
    ...actual,
    createServerClient: vi.fn(
      (_url, _key, options: { cookies: { setAll: (cookies: never[], headers: Record<string, string>) => void } }) => ({
        auth: {
          getClaims: async () => {
            options.cookies.setAll(
              [
                {
                  name: "sb-unit-test-auth-token",
                  value: "rotated-session",
                  options: { path: "/", httpOnly: true },
                },
              ] as never[],
              {
                "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
              },
            );
            return getClaims();
          },
        },
      }),
    ),
  };
});

vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/env")>();
  return {
    ...actual,
    env: {
      ...actual.env,
      NEXT_PUBLIC_SUPABASE_URL: "https://unit-test.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_unit_test",
    },
  };
});

describe("proxy auth claims forwarding & anti-spoofing", () => {
  const previousServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const previousInternalKey = process.env.INTERNAL_SERVICE_KEY;

  beforeEach(() => {
    getClaims.mockClear();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "unit-test-service-role-key";
    delete process.env.INTERNAL_SERVICE_KEY;
  });

  afterEach(() => {
    if (previousServiceRoleKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRoleKey;
    }
    if (previousInternalKey === undefined) {
      delete process.env.INTERNAL_SERVICE_KEY;
    } else {
      process.env.INTERNAL_SERVICE_KEY = previousInternalKey;
    }
  });

  it("keeps rotated session cookie flags when forwarding verified claims", async () => {
    const { proxy } = await import("../src/proxy");
    const request = new NextRequest(new URL("http://localhost/api/answer"));
    request.cookies.set("sb-unit-test-auth-token", "base64-opaque-session");

    const response = await proxy(request);
    const cookie = response.cookies.get("sb-unit-test-auth-token");
    expect(cookie?.value).toBe("rotated-session");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.path).toBe("/");
    const setCookie = response.headers.getSetCookie();
    expect(setCookie.some((header) => /sb-unit-test-auth-token=rotated-session/i.test(header))).toBe(true);
    expect(setCookie.some((header) => /HttpOnly/i.test(header) && /Path=\//i.test(header))).toBe(true);
  });

  it("strips client-supplied x-proxy-auth-user header to prevent spoofing", async () => {
    const { proxy } = await import("../src/proxy");
    const maliciousRequest = new NextRequest(new URL("http://localhost/api/answer"), {
      headers: {
        [PROXY_AUTH_USER_HEADER]: Buffer.from(
          JSON.stringify({ id: "spoofed-admin", appMetadata: { admin: true } }),
        ).toString("base64"),
      },
    });

    const response = await proxy(maliciousRequest);
    expect(response).toBeTruthy();
  });

  it("extractProxyAuthenticatedUser safely rejects unsigned, forged, or malformed headers", () => {
    const unsignedHeaderRequest = new Request("http://localhost/api/test", {
      headers: {
        [PROXY_AUTH_USER_HEADER]: Buffer.from(
          JSON.stringify({ id: "spoofed-user", appMetadata: { admin: true } }),
        ).toString("base64"),
      },
    });
    // Unsigned header sent directly to proxy-skipped route is rejected
    expect(extractProxyAuthenticatedUser(unsignedHeaderRequest)).toBeNull();

    const invalidHeaderRequest = new Request("http://localhost/api/test", {
      headers: {
        [PROXY_AUTH_USER_HEADER]: "not-valid-base64-!!!",
      },
    });
    expect(extractProxyAuthenticatedUser(invalidHeaderRequest)).toBeNull();

    const notJsonRequest = new Request("http://localhost/api/test", {
      headers: {
        [PROXY_AUTH_USER_HEADER]: Buffer.from("plain text not json").toString("base64"),
      },
    });
    expect(extractProxyAuthenticatedUser(notJsonRequest)).toBeNull();
  });

  it("fast-paths resolveOptionalAuthentication when valid HMAC-signed proxy claims are present", async () => {
    const { signProxyAuthPayload } = await import("../src/lib/supabase/proxy-auth-crypto");
    const validPayload = {
      id: "verified-user-789",
      appMetadata: { clinician: true },
    };
    const validHeader = signProxyAuthPayload(Buffer.from(JSON.stringify(validPayload)).toString("base64"));
    expect(validHeader).toBeTruthy();
    const requestWithProxyClaims = new Request("http://localhost/api/test", {
      headers: {
        [PROXY_AUTH_USER_HEADER]: validHeader,
      },
    });

    const mockAdmin = {
      auth: {
        getUser: vi.fn(),
      },
    } as unknown as ReturnType<typeof createAdminClient>;

    const result = await resolveOptionalAuthentication(requestWithProxyClaims, mockAdmin);
    expect(result).toEqual({
      status: "valid",
      user: {
        id: "verified-user-789",
        appMetadata: { clinician: true },
      },
    });
    // Verified: No Supabase getUser RPC was made
    expect(mockAdmin.auth.getUser).not.toHaveBeenCalled();
  });

  it("refuses to sign or verify proxy claims without a server-only secret", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.INTERNAL_SERVICE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const { signProxyAuthPayload, verifyProxyAuthHeader } = await import("../src/lib/supabase/proxy-auth-crypto");
    const payload = Buffer.from(JSON.stringify({ id: "user", appMetadata: {} })).toString("base64");
    expect(signProxyAuthPayload(payload)).toBeNull();
    expect(verifyProxyAuthHeader(`${payload}.forged`)).toBeNull();
  });

  it("does not treat the public publishable key as a signing secret", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.INTERNAL_SERVICE_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_browser_visible";
    const { createHmac } = await import("node:crypto");
    const { signProxyAuthPayload, verifyProxyAuthHeader } = await import("../src/lib/supabase/proxy-auth-crypto");
    const payload = Buffer.from(JSON.stringify({ id: "user", appMetadata: { site_role: "administrator" } })).toString(
      "base64",
    );
    const publicSignature = createHmac("sha256", "sb_publishable_browser_visible").update(payload).digest("base64url");
    expect(signProxyAuthPayload(payload)).toBeNull();
    expect(verifyProxyAuthHeader(`${payload}.${publicSignature}`)).toBeNull();
  });

  it("keeps /api routes inside the proxy matcher even when the last segment looks like an image", async () => {
    const { config } = await import("../src/proxy");
    expect(config.matcher).toContain("/api/:path*");
    expect(config.matcher.some((pattern) => pattern.includes("api(?:/|$)") || pattern === "/api/:path*")).toBe(true);
  });
});
