import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("/api/setup-status", () => {
  it("requires auth for non-local production requests before returning setup posture", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const getUser = vi.fn();
    const createAdminClient = vi.fn(() => ({ auth: { getUser } }));
    vi.doMock("@/lib/env", () => ({
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "https://sjrfecxgysukkwxsowpy.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        OPENAI_API_KEY: "openai-key",
        SUPABASE_DOCUMENT_BUCKET: "clinical-documents",
        SUPABASE_IMAGE_BUCKET: "clinical-images",
        WORKER_POLL_MS: 1500,
      },
      isDemoMode: () => false,
      isLocalNoAuthMode: () => false,
    }));
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient }));
    const { GET } = await import("../src/app/api/setup-status/route");

    const response = await GET(new Request("https://clinical.example/api/setup-status"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Authentication required." });
    expect(JSON.stringify(body)).not.toContain("OPENAI");
    expect(JSON.stringify(body)).not.toContain("Supabase");
    expect(createAdminClient).toHaveBeenCalledTimes(1);
    expect(getUser).not.toHaveBeenCalled();
  });
});
