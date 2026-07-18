import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

function callbackRequest(query: string) {
  return new Request(`https://clinical.example/auth/callback?${query}`);
}

describe("/auth/callback", () => {
  it("exchanges the PKCE code and redirects to a same-origin path", async () => {
    const exchangeCodeForSession = vi.fn(async () => ({ error: null }));
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => ({ auth: { exchangeCodeForSession } })),
    }));
    const { GET } = await import("../src/app/auth/callback/route");

    const response = await GET(callbackRequest("code=pkce-code&next=%2Fdocuments%3Fq%3Dlithium"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://clinical.example/documents?q=lithium");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("pkce-code");
  });

  it("forwards auth cookies and anti-cache headers to the final redirect", async () => {
    const createSupabaseServerClient = vi.fn(
      async (options: {
        setAllCookies: (
          cookies: Array<{ name: string; value: string; options: Record<string, unknown> }>,
          headers: Record<string, string>,
        ) => void;
      }) => ({
        auth: {
          exchangeCodeForSession: vi.fn(async () => {
            options.setAllCookies(
              [{ name: "sb-session", value: "session-value", options: { httpOnly: true, path: "/" } }],
              {
                "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
                Expires: "0",
                Pragma: "no-cache",
              },
            );
            return { error: null };
          }),
        },
      }),
    );
    vi.doMock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));
    const { GET } = await import("../src/app/auth/callback/route");

    const response = await GET(callbackRequest("code=pkce-code&next=%2Fdocuments"));

    expect(createSupabaseServerClient).toHaveBeenCalledWith({ setAllCookies: expect.any(Function) });
    expect(response.cookies.get("sb-session")?.value).toBe("session-value");
    expect(response.headers.get("cache-control")).toBe("private, no-cache, no-store, must-revalidate, max-age=0");
    expect(response.headers.get("expires")).toBe("0");
    expect(response.headers.get("pragma")).toBe("no-cache");
  });

  it.each(["https://evil.example/steal", "//evil.example/steal"])("rejects unsafe redirect target %s", async (next) => {
    const exchangeCodeForSession = vi.fn(async () => ({ error: null }));
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => ({ auth: { exchangeCodeForSession } })),
    }));
    const { GET } = await import("../src/app/auth/callback/route");

    const response = await GET(callbackRequest(`code=pkce-code&next=${encodeURIComponent(next)}`));

    expect(response.headers.get("location")).toBe("https://clinical.example/");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("pkce-code");
  });

  it("returns provider errors without attempting a code exchange", async () => {
    const createSupabaseServerClient = vi.fn();
    vi.doMock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));
    const { GET } = await import("../src/app/auth/callback/route");

    const response = await GET(callbackRequest("error_description=Link+expired"));

    expect(response.headers.get("location")).toBe("https://clinical.example/?auth_error=Link%20expired");
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("falls back to the provider error code when no description is supplied", async () => {
    const createSupabaseServerClient = vi.fn();
    vi.doMock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));
    const { GET } = await import("../src/app/auth/callback/route");

    const response = await GET(callbackRequest("error=access_denied"));

    expect(response.headers.get("location")).toBe("https://clinical.example/?auth_error=access_denied");
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("reports missing codes and unconfigured auth", async () => {
    const createSupabaseServerClient = vi.fn(async () => null);
    vi.doMock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));
    const { GET } = await import("../src/app/auth/callback/route");

    const missingCodeResponse = await GET(callbackRequest("next=%2Fdocuments"));
    const unconfiguredResponse = await GET(callbackRequest("code=pkce-code"));

    expect(missingCodeResponse.headers.get("location")).toBe("https://clinical.example/?auth_error=missing_auth_code");
    expect(unconfiguredResponse.headers.get("location")).toBe("https://clinical.example/?auth_error=auth_unconfigured");
    expect(createSupabaseServerClient).toHaveBeenCalledTimes(1);
  });

  it("surfaces exchange failures without redirecting into the app", async () => {
    const exchangeCodeForSession = vi.fn(async (code: string) => {
      void code;
      return { error: { message: "Code verifier mismatch" } };
    });
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(
        async (options: {
          setAllCookies: (
            cookies: Array<{ name: string; value: string; options: Record<string, unknown> }>,
            headers: Record<string, string>,
          ) => void;
        }) => ({
          auth: {
            exchangeCodeForSession: vi.fn(async (code: string) => {
              options.setAllCookies([{ name: "sb-session", value: "", options: { maxAge: 0 } }], {
                "Cache-Control": "private, no-store",
                Pragma: "no-cache",
              });
              return exchangeCodeForSession(code);
            }),
          },
        }),
      ),
    }));
    const { GET } = await import("../src/app/auth/callback/route");

    const response = await GET(callbackRequest("code=bad-code&next=%2Fdocuments"));

    expect(response.headers.get("location")).toBe("https://clinical.example/?auth_error=Code%20verifier%20mismatch");
    expect(response.cookies.get("sb-session")?.value).toBe("");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
  });
});
