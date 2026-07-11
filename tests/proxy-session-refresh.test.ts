import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// The proxy's second job (session-cookie refresh via supabase.auth.getUser)
// must run on page navigations but NOT on /api routes: API handlers validate
// the caller themselves, so the proxy call added a serial auth-server round
// trip to every authenticated API request without gating anything.

const getUser = vi.fn(async () => ({ data: { user: null }, error: null }));

vi.mock("@supabase/ssr", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@supabase/ssr")>();
  return {
    ...actual,
    createServerClient: vi.fn(() => ({ auth: { getUser } })),
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
  getUser.mockClear();
});

describe("proxy session refresh scoping", () => {
  it("skips the session-refresh getUser for API routes but still stamps the CSP", async () => {
    const { proxy } = await import("../src/proxy");
    const response = await proxy(requestWithSessionCookie("/api/answer"));

    expect(getUser).not.toHaveBeenCalled();
    expect(response.headers.get("content-security-policy")).toBeTruthy();
  });

  it("refreshes the session on page navigations that carry an sb- cookie", async () => {
    const { proxy } = await import("../src/proxy");
    const response = await proxy(requestWithSessionCookie("/documents/some-id"));

    expect(getUser).toHaveBeenCalledTimes(1);
    expect(response.headers.get("content-security-policy")).toBeTruthy();
  });

  it("never calls getUser without an sb- cookie", async () => {
    const { proxy } = await import("../src/proxy");
    await proxy(new NextRequest(new URL("http://localhost/documents/some-id")));

    expect(getUser).not.toHaveBeenCalled();
  });
});
