import { describe, expect, it } from "vitest";
import { isUsableBrowserSupabaseKey } from "../src/lib/supabase/client";

const liveCapabilities: Array<[string, boolean]> = [
  ["E2E_USER_EMAIL", Boolean(process.env.E2E_USER_EMAIL)],
  ["E2E_USER_PASSWORD", Boolean(process.env.E2E_USER_PASSWORD)],
  ["NEXT_PUBLIC_SUPABASE_URL", Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)],
  [
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    isUsableBrowserSupabaseKey(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  ],
  [
    "SUPABASE_SERVICE_ROLE_KEY",
    Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      !/<[^>]+>|^your-|replace-with|placeholder/i.test(process.env.SUPABASE_SERVICE_ROLE_KEY),
    ),
  ],
  ["NEXT_PUBLIC_DEMO_MODE=false", process.env.NEXT_PUBLIC_DEMO_MODE !== "true"],
];

const missingLiveCapabilities = liveCapabilities.filter(([, ready]) => !ready).map(([name]) => name);

if (missingLiveCapabilities.length > 0) {
  throw new Error(
    `Live owner-search capability gap: missing required names/modes: ${missingLiveCapabilities.join(", ")}. ` +
      "No credential values were inspected or printed.",
  );
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
    type SearchPayload = {
      demoMode?: boolean;
      publicAccess?: boolean;
      groups: Array<{ kind: string; error?: boolean; items: Array<{ href: string }> }>;
    };

    try {
      expect(token).toBeTruthy();

      const { GET } = await import("../src/app/api/search/universal/route");
      const response = await GET(
        new Request("http://localhost/api/search/universal?q=acamprosate&limit=3", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      expect(response.status).toBe(200);

      const payload = (await response.json()) as SearchPayload;
      expect(payload.demoMode).toBeUndefined();
      expect(payload.publicAccess).toBeUndefined();

      const medications = payload.groups.find((group) => group.kind === "medications");
      expect(medications?.error).toBeUndefined();
      expect(medications?.items.length ?? 0).toBeGreaterThan(0);
      expect(medications?.items[0]?.href).toContain("/medications/");

      // Federated search intentionally gives documents a short latency budget. Prove the
      // authenticated document path separately so a valid federated timeout is not a failure.
      const focusedResponse = await GET(
        new Request("http://localhost/api/search/universal?q=acamprosate&limit=3&domains=documents", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      expect(focusedResponse.status).toBe(200);

      const focusedPayload = (await focusedResponse.json()) as SearchPayload;
      expect(focusedPayload.demoMode).toBeUndefined();
      expect(focusedPayload.publicAccess).toBeUndefined();
      const documents = focusedPayload.groups.find((group) => group.kind === "documents");
      expect(documents).toBeDefined();
      expect(documents?.error).toBeUndefined();
    } finally {
      const signOut = await supabase.auth.signOut();
      if (signOut.error) throw new Error(`Live owner-auth sign-out failed: ${signOut.error.message}`);
    }
  });
});
