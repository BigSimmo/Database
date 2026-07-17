import { describe, expect, it } from "vitest";
import { isUsableBrowserSupabaseKey } from "../src/lib/supabase/client";

const liveEnvReady = Boolean(
  process.env.E2E_USER_EMAIL &&
  process.env.E2E_USER_PASSWORD &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  isUsableBrowserSupabaseKey(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) &&
  process.env.SUPABASE_SERVICE_ROLE_KEY &&
  !/<[^>]+>|^your-|replace-with|placeholder/i.test(process.env.SUPABASE_SERVICE_ROLE_KEY) &&
  process.env.NEXT_PUBLIC_DEMO_MODE !== "true",
);

if (!liveEnvReady) {
  throw new Error("Live owner-search tests require complete, non-placeholder E2E and Supabase credentials.");
}

describe("GET /api/search/universal (live owner auth)", () => {
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
    if (error) throw new Error(`Live owner-auth sign-in failed: ${error.message}`);
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
    expect(payload.demoMode).toBeUndefined();
    expect(payload.publicAccess).toBeUndefined();

    const medications = payload.groups.find((group) => group.kind === "medications");
    expect(medications?.error).toBeUndefined();
    expect(medications?.items.length ?? 0).toBeGreaterThan(0);
    expect(medications?.items[0]?.href).toContain("/medications/");

    const documents = payload.groups.find((group) => group.kind === "documents");
    expect(documents?.error).toBeUndefined();

    const signOut = await supabase.auth.signOut();
    if (signOut.error) throw new Error(`Live owner-auth sign-out failed: ${signOut.error.message}`);
  });
});
