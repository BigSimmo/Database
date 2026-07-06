import { describe, expect, it } from "vitest";

// Live owner-auth coverage for universal search. The header sign-in UI is magic-link/OAuth
// only (no password field), so browser-login Playwright coverage is not feasible; instead
// this signs in with the E2E password user via supabase-js and exercises the real route
// handler with a genuine bearer token — the same path the typeahead hook uses.
//
// Skips (never fails) when the live env is absent: demo/offline environments and keys-free
// CI run the mocked coverage in tests/universal-search.test.ts instead.

const liveEnvReady = Boolean(
  process.env.E2E_USER_EMAIL &&
  process.env.E2E_USER_PASSWORD &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
  process.env.SUPABASE_SERVICE_ROLE_KEY &&
  process.env.NEXT_PUBLIC_DEMO_MODE !== "true",
);

describe.skipIf(!liveEnvReady)("GET /api/search/universal (live owner auth)", () => {
  it("serves owner-scoped registry groups through a real session token", { timeout: 45_000 }, async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false } },
    );
    const { data, error } = await supabase.auth.signInWithPassword({
      email: process.env.E2E_USER_EMAIL!,
      password: process.env.E2E_USER_PASSWORD!,
    });
    expect(error).toBeNull();
    const token = data.session?.access_token;
    expect(token).toBeTruthy();

    const { GET } = await import("../src/app/api/search/universal/route");
    const response = await GET(
      new Request("http://localhost/api/search/universal?q=acamprosate&limit=3", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      demoMode?: boolean;
      publicAccess?: boolean;
      groups: Array<{ kind: string; error?: boolean; items: Array<{ href: string }> }>;
    };
    // Owner path: neither the demo nor the public-fixture ladder rung served this.
    expect(payload.demoMode).toBeUndefined();
    expect(payload.publicAccess).toBeUndefined();

    const medications = payload.groups.find((group) => group.kind === "medications");
    expect(medications?.error).toBeUndefined();
    expect(medications?.items.length ?? 0).toBeGreaterThan(0);
    expect(medications?.items[0]?.href).toContain("/medications/");

    const documents = payload.groups.find((group) => group.kind === "documents");
    expect(documents?.error).toBeUndefined();

    await supabase.auth.signOut();
  });
});
