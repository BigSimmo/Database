import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("/api/setup-status", () => {
  it("keeps schema diagnostics when the readiness probe reports a query failure", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const failedResult = async () => ({ error: { message: "relation is missing" }, data: [], count: 0 });
    const select = vi.fn(() => ({
      limit: vi.fn(failedResult),
      order: vi.fn(() => ({ limit: vi.fn(failedResult) })),
      in: vi.fn(failedResult),
    }));
    const from = vi.fn(() => ({ select }));
    const createAdminClient = vi.fn(() => ({
      from,
      rpc: vi.fn(failedResult),
      storage: { listBuckets: vi.fn(failedResult) },
    }));
    vi.doMock("@/lib/env", () => ({
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "https://sjrfecxgysukkwxsowpy.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        OPENAI_API_KEY: "openai-key",
        SUPABASE_DOCUMENT_BUCKET: "clinical-documents",
        SUPABASE_IMAGE_BUCKET: "clinical-images",
        WORKER_POLL_MS: 1500,
        HEALTH_DEEP_PROBE_SECRET: "operator-secret",
      },
      isDemoMode: () => false,
      isLocalNoAuthMode: () => false,
    }));
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient }));
    vi.doMock("@/lib/supabase/auth", () => ({
      AuthenticationError: class AuthenticationError extends Error {},
      requireAuthenticatedUser: vi.fn(),
    }));
    vi.doMock("@/lib/supabase/health", () => ({
      probeSupabaseHealth: vi.fn(async () => ({
        ok: false,
        failureKind: "query",
        message: "Supabase health check failed.",
        rawMessage: 'relation "public.import_batches" does not exist',
      })),
      isSupabaseUnavailableError: () => false,
      formatSupabaseUnavailableError: (error: unknown) => String(error),
    }));
    vi.doMock("@/lib/supabase/project", () => ({
      checkSupabaseProjectConfig: () => ({ status: "ready", detail: "Clinical KB Database target is configured." }),
      formatSupabaseProjectCheck: () => "Clinical KB Database target is configured.",
    }));
    const { GET } = await import("../src/app/api/setup-status/route");

    const response = await GET(
      new Request("https://clinical.example/api/setup-status", {
        headers: { "x-health-deep-token": "operator-secret" },
      }),
    );
    const body = await response.json();
    const schema = body.checks.find((item: { id: string }) => item.id === "schema");

    expect(response.status).toBe(200);
    expect(schema).toMatchObject({
      status: "needs_setup",
      detail: "Required tables or private storage buckets were not confirmed.",
    });
    expect(body.pollAfterMs).toBe(60_000);
    expect(from).toHaveBeenCalledWith("documents");
  });

  it("returns only coarse posture for anonymous production requests", async () => {
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
    vi.doMock("@/lib/supabase/auth", () => {
      class AuthenticationError extends Error {}
      return {
        AuthenticationError,
        requireAuthenticatedUser: vi.fn(async () => {
          throw new AuthenticationError("Authentication required.");
        }),
      };
    });
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
    expect(body).toMatchObject({ demoMode: false, indexingActive: false });
    expect(body.checks.length).toBeGreaterThan(0);
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
    const requireAuthenticatedUser = vi.fn(async () => ({ id: "user-1" }));
    vi.doMock("@/lib/supabase/auth", () => ({
      AuthenticationError: class AuthenticationError extends Error {},
      requireAuthenticatedUser,
    }));
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

    const response = await GET(
      new Request("https://clinical.example/api/setup-status", {
        headers: { authorization: "Bearer authenticated-user-token" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.checks).toEqual(expect.arrayContaining([expect.objectContaining({ id: "project", status: "ready" })]));
    expect(requireAuthenticatedUser).toHaveBeenCalledOnce();
  });

  it("coarsens per-check detail for anonymous production callers and restores it with the operator token", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const from = vi.fn(async () => ({ error: null, data: [], count: 0 }));
    const createAdminClient = vi.fn(() => ({ from, rpc: vi.fn() }));
    vi.doMock("@/lib/env", () => ({
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "https://sjrfecxgysukkwxsowpy.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        OPENAI_API_KEY: "openai-key",
        SUPABASE_DOCUMENT_BUCKET: "clinical-documents",
        SUPABASE_IMAGE_BUCKET: "clinical-images",
        WORKER_POLL_MS: 1500,
        HEALTH_DEEP_PROBE_SECRET: "operator-secret",
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
      checkSupabaseProjectConfig: () => ({ status: "warning", detail: "raw project posture detail" }),
      formatSupabaseProjectCheck: () => "SECRET-PROJECT-POSTURE-DETAIL",
    }));
    const { GET } = await import("../src/app/api/setup-status/route");

    // Anonymous production caller: raw per-check detail (Supabase/project posture) is redacted.
    const anon = await (await GET(new Request("https://clinical.example/api/setup-status"))).json();
    expect(JSON.stringify(anon)).not.toContain("SECRET-PROJECT-POSTURE-DETAIL");
    const anonProject = anon.checks.find((c: { id: string }) => c.id === "project");
    expect(anonProject.detail).not.toContain("SECRET-PROJECT-POSTURE-DETAIL");

    // Operator presenting the shared deep-probe token: full detail is restored.
    const operator = await (
      await GET(
        new Request("https://clinical.example/api/setup-status", {
          headers: { "x-health-deep-token": "operator-secret" },
        }),
      )
    ).json();
    const operatorProject = operator.checks.find((c: { id: string }) => c.id === "project");
    expect(operatorProject.detail).toContain("SECRET-PROJECT-POSTURE-DETAIL");
  });

  it("does not unlock detail for a spoofed local-looking Host in production (trusted-signal gate)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const from = vi.fn(async () => ({ error: null, data: [], count: 0 }));
    const createAdminClient = vi.fn(() => ({ from, rpc: vi.fn() }));
    vi.doMock("@/lib/env", () => ({
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "https://sjrfecxgysukkwxsowpy.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        OPENAI_API_KEY: "openai-key",
        SUPABASE_DOCUMENT_BUCKET: "clinical-documents",
        SUPABASE_IMAGE_BUCKET: "clinical-images",
        WORKER_POLL_MS: 1500,
        HEALTH_DEEP_PROBE_SECRET: "operator-secret",
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
      checkSupabaseProjectConfig: () => ({ status: "warning", detail: "raw project posture detail" }),
      formatSupabaseProjectCheck: () => "SECRET-PROJECT-POSTURE-DETAIL",
    }));
    const { GET } = await import("../src/app/api/setup-status/route");

    // localhost:3100 is a managed project port (3100-4599), so it passes the local-project guard and
    // reaches the detail gate. The Host is client-controllable behind a proxy — it must NOT unlock
    // raw detail in a production runtime just because it looks local.
    const response = await GET(new Request("http://localhost:3100/api/setup-status"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(JSON.stringify(body)).not.toContain("SECRET-PROJECT-POSTURE-DETAIL");
  });

  it("allowDeepHealthProbe rejects a crafted multi-byte token without throwing (byte-length safety)", async () => {
    // The HTTP layer decodes header bytes as latin1, so a raw multi-byte UTF-8 token arrives as a
    // string whose code-unit length can match the secret while its re-encoded UTF-8 byte length
    // differs — which made a `token.length === secret.length` gate pass and timingSafeEqual throw.
    // Test the helper directly with a fake request (the Headers API rejects non-latin1 values).
    vi.doMock("@/lib/env", () => ({
      env: { HEALTH_DEEP_PROBE_SECRET: "abcdefghijklmnop" }, // 16 code units / 16 bytes
      isDemoMode: () => false,
      isLocalNoAuthMode: () => false,
    }));
    const { allowDeepHealthProbe } = await import("../src/lib/deep-probe-auth");
    const fakeRequest = (token: string) =>
      ({ headers: { get: (name: string) => (name === "x-health-deep-token" ? token : null) } }) as unknown as Request;

    // 8 emoji = 16 UTF-16 code units (matches the 16-char secret) but 32 UTF-8 bytes.
    expect(() => allowDeepHealthProbe(fakeRequest("😀".repeat(8)))).not.toThrow();
    expect(allowDeepHealthProbe(fakeRequest("😀".repeat(8)))).toBe(false);
    // An exact match still authorizes.
    expect(allowDeepHealthProbe(fakeRequest("abcdefghijklmnop"))).toBe(true);
  });
});
