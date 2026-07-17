import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// The proxy's second job (session-cookie refresh via supabase.auth.getClaims)
// must run on page navigations and cookie-authenticated API routes. Route
// handlers can validate an SSR cookie, but their read-only adapter cannot return
// rotated Set-Cookie headers to the browser.

const getClaims = vi.fn(async () => ({ data: { claims: null }, error: null }));

vi.mock("@supabase/ssr", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@supabase/ssr")>();
  return {
    ...actual,
    createServerClient: vi.fn((_url, _key, options: { cookies: { setAll: (cookies: never[]) => void } }) => ({
      auth: {
        getClaims: async () => {
          options.cookies.setAll([
            {
              name: "sb-unit-test-auth-token",
              value: "rotated-session",
              options: { path: "/", httpOnly: true },
            },
          ] as never[]);
          return getClaims();
        },
      },
    })),
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

function requestWithSessionCookie(path: string): NextRequest {
  const request = new NextRequest(new URL(`http://localhost${path}`));
  request.cookies.set("sb-unit-test-auth-token", "base64-opaque-session");
  return request;
}

beforeEach(() => {
  getClaims.mockClear();
});

describe("proxy session refresh scoping", () => {
  it("refreshes SSR cookies for cookie-authenticated API routes and stamps the CSP", async () => {
    const { proxy } = await import("../src/proxy");
    const response = await proxy(requestWithSessionCookie("/api/answer"));

    expect(getClaims).toHaveBeenCalledTimes(1);
    expect(response.cookies.get("sb-unit-test-auth-token")?.value).toBe("rotated-session");
    expect(response.headers.get("content-security-policy")).toBeTruthy();
  });

  it("refreshes the session on page navigations that carry an sb- cookie", async () => {
    const { proxy } = await import("../src/proxy");
    const response = await proxy(requestWithSessionCookie("/documents/some-id"));

    expect(getClaims).toHaveBeenCalledTimes(1);
    expect(response.cookies.get("sb-unit-test-auth-token")?.value).toBe("rotated-session");
    expect(response.headers.get("content-security-policy")).toBeTruthy();
  });

  it("never calls getClaims without an sb- cookie", async () => {
    const { proxy } = await import("../src/proxy");
    await proxy(new NextRequest(new URL("http://localhost/documents/some-id")));

    expect(getClaims).not.toHaveBeenCalled();
  });

  it.each(["/sw.js", "/offline.html", "/manifest.webmanifest", "/apple-icon", "/icon.svg", "/icons/icon-192"])(
    "keeps the public PWA bootstrap path %s independent from user sessions",
    async (path) => {
      const { proxy } = await import("../src/proxy");
      const response = await proxy(requestWithSessionCookie(path));

      expect(getClaims).not.toHaveBeenCalled();
      expect(response.headers.get("content-security-policy")).toBeNull();
    },
  );

  it("does not classify clinical API routes as public PWA resources", async () => {
    const { isPublicPwaPath } = await import("../src/proxy");

    expect(isPublicPwaPath("/api/answer")).toBe(false);
    expect(isPublicPwaPath("/documents/private-id")).toBe(false);
    expect(isPublicPwaPath("/pwa/private-export.json")).toBe(false);
  });
});
