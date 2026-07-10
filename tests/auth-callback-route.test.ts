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

  it("rejects cross-origin redirect targets", async () => {
    const exchangeCodeForSession = vi.fn(async () => ({ error: null }));
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => ({ auth: { exchangeCodeForSession } })),
    }));
    const { GET } = await import("../src/app/auth/callback/route");

    const response = await GET(callbackRequest("code=pkce-code&next=https%3A%2F%2Fevil.example%2Fsteal"));

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
    const exchangeCodeForSession = vi.fn(async () => ({ error: { message: "Code verifier mismatch" } }));
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => ({ auth: { exchangeCodeForSession } })),
    }));
    const { GET } = await import("../src/app/auth/callback/route");

    const response = await GET(callbackRequest("code=bad-code&next=%2Fdocuments"));

    expect(response.headers.get("location")).toBe("https://clinical.example/?auth_error=Code%20verifier%20mismatch");
  });
});
