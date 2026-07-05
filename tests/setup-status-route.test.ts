import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("/api/setup-status", () => {
  it("returns setup posture for anonymous production requests without exposing secret values", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const from = vi.fn(async () => ({ error: null, data: [], count: 0 }));
    const createAdminClient = vi.fn(() => ({
      from,
      rpc: vi.fn(),
    }));
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
    vi.doMock("@/lib/supabase/health", () => ({
      probeSupabaseHealth: vi.fn(async () => ({ ok: true })),
      isSupabaseUnavailableError: () => false,
      formatSupabaseUnavailableError: (error: unknown) => String(error),
    }));
    vi.doMock("@/lib/supabase/project", () => ({
      checkSupabaseProjectConfig: () => ({ status: "ready", detail: "Clinical KB Database target is configured." }),
      formatSupabaseProjectCheck: () => "Clinical KB Database target is configured.",
    }));
    const { GET } = await import("../src/app/api/setup-status/route");

    const response = await GET(new Request("https://clinical.example/api/setup-status"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      demoMode: false,
      checks: expect.arrayContaining([
        expect.objectContaining({ id: "env" }),
        expect.objectContaining({ id: "openai" }),
      ]),
    });
    expect(JSON.stringify(body)).not.toContain("service-role-key");
    expect(JSON.stringify(body)).not.toContain("openai-key");
  });

  it("treats project warning status as ready when the URL ref matches", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const from = vi.fn(async () => ({ error: null, data: [], count: 0 }));
    const createAdminClient = vi.fn(() => ({
      from,
      rpc: vi.fn(),
    }));
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
    vi.doMock("@/lib/supabase/health", () => ({
      probeSupabaseHealth: vi.fn(async () => ({ ok: true })),
      isSupabaseUnavailableError: () => false,
      formatSupabaseUnavailableError: (error: unknown) => String(error),
    }));
    vi.doMock("@/lib/supabase/project", () => ({
      checkSupabaseProjectConfig: () => ({
        status: "warning",
        detail: 'Set SUPABASE_PROJECT_NAME="Clinical KB Database" in .env.local.',
      }),
      formatSupabaseProjectCheck: () => 'Set SUPABASE_PROJECT_NAME="Clinical KB Database" in .env.local.',
    }));
    const { GET } = await import("../src/app/api/setup-status/route");

    const response = await GET(new Request("https://clinical.example/api/setup-status"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.checks).toEqual(expect.arrayContaining([expect.objectContaining({ id: "project", status: "ready" })]));
  });
});
