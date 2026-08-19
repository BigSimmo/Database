import { afterEach, describe, expect, it, vi } from "vitest";

// resolveDeveloperAccessState() is the real authorization decision behind the
// Development hub and Caring Contact routes in production (src/proxy.ts and
// mockups/layout.tsx only decide which requests reach it). It must distinguish
// three states — no session, a session that is not an administrator, and an
// administrator session — because the middle case (someone else's ordinary
// self-serve account) must NOT be treated the same as "please sign in".

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

async function loadWithSupabaseUser(
  user: { id: string; email?: string; app_metadata?: Record<string, unknown> } | null,
) {
  vi.doMock("server-only", () => ({}));
  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: vi.fn(async () => ({
      auth: { getUser: vi.fn(async () => ({ data: { user } })) },
    })),
  }));
  return import("../src/lib/developer-area/access");
}

describe("resolveDeveloperAccessState", () => {
  it("reports unauthenticated when Supabase is not configured (no client)", async () => {
    vi.doMock("server-only", () => ({}));
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => null),
    }));
    const { resolveDeveloperAccessState } = await import("../src/lib/developer-area/access");

    await expect(resolveDeveloperAccessState()).resolves.toEqual({ state: "unauthenticated", email: null });
  });

  it("reports unauthenticated when there is no signed-in user", async () => {
    const { resolveDeveloperAccessState } = await loadWithSupabaseUser(null);

    await expect(resolveDeveloperAccessState()).resolves.toEqual({ state: "unauthenticated", email: null });
  });

  it("reports unauthorized for a signed-in user without the administrator claim", async () => {
    const { resolveDeveloperAccessState } = await loadWithSupabaseUser({
      id: "user-1",
      email: "someone-else@example.com",
      app_metadata: {},
    });

    await expect(resolveDeveloperAccessState()).resolves.toEqual({
      state: "unauthorized",
      email: "someone-else@example.com",
    });
  });

  it("reports authorized for a signed-in administrator", async () => {
    const { resolveDeveloperAccessState } = await loadWithSupabaseUser({
      id: "user-1",
      email: "josh@stoicable.com",
      app_metadata: { site_role: "administrator" },
    });

    await expect(resolveDeveloperAccessState()).resolves.toEqual({
      state: "authorized",
      email: "josh@stoicable.com",
    });
  });
});
