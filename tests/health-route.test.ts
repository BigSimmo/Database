import { afterEach, describe, expect, it, vi } from "vitest";

const DEEP_TOKEN = "deep-probe-secret";

function mockEnv(options: {
  configured: boolean;
  openAIConfigured?: boolean;
  demoMode?: boolean;
  deepSecret?: boolean;
  providerMode?: "auto" | "openai" | "offline";
}) {
  vi.resetModules();
  const openAIConfigured = options.openAIConfigured ?? options.configured;
  vi.doMock("@/lib/env", () => ({
    env: {
      NEXT_PUBLIC_SUPABASE_URL: options.configured ? "https://sjrfecxgysukkwxsowpy.supabase.co" : undefined,
      SUPABASE_SERVICE_ROLE_KEY: options.configured ? "service-role-key" : undefined,
      OPENAI_API_KEY: openAIConfigured ? "openai-key" : undefined,
      RAG_PROVIDER_MODE: options.providerMode ?? "auto",
      HEALTH_DEEP_PROBE_SECRET: options.deepSecret ? DEEP_TOKEN : undefined,
    },
    isDemoMode: () => Boolean(options.demoMode),
  }));
}

function healthRequest(query = "", headers?: HeadersInit) {
  return new Request(`http://localhost/api/health${query}`, headers ? { headers } : undefined);
}

async function payload(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("GET /api/health", () => {
  it("reports ok when fully configured", async () => {
    vi.stubEnv("RAILWAY_GIT_COMMIT_SHA", "2ae5a0aa5d339a7dc9089db134c2d9d0220444ae");
    mockEnv({ configured: true });
    const { GET } = await import("../src/app/api/health/route");

    const response = await GET(healthRequest());
    const body = await payload(response);

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.checks).toMatchObject({ supabaseConfig: "ok", openaiConfig: "ok" });
    expect(body.demoMode).toBe(false);
    expect(typeof body.uptimeSeconds).toBe("number");
    expect(body.deploymentCommitSha).toBe("2ae5a0aa5d339a7dc9089db134c2d9d0220444ae");
  });

  it("reports degraded with 503 when required config is missing", async () => {
    mockEnv({ configured: false });
    const { GET } = await import("../src/app/api/health/route");

    const response = await GET(healthRequest());
    const body = await payload(response);

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.checks).toMatchObject({ supabaseConfig: "missing", openaiConfig: "missing" });
  });

  it("treats a missing OpenAI key as intentionally skipped only in explicit offline mode", async () => {
    mockEnv({ configured: false, providerMode: "offline" });
    const { GET } = await import("../src/app/api/health/route");

    const response = await GET(healthRequest());
    const body = await payload(response);

    expect(response.status).toBe(503);
    expect(body.checks).toMatchObject({ supabaseConfig: "missing", openaiConfig: "skipped" });
  });

  it("reports healthy without an OpenAI key when Supabase is configured for explicit offline mode", async () => {
    mockEnv({ configured: true, openAIConfigured: false, providerMode: "offline" });
    const { GET } = await import("../src/app/api/health/route");

    const response = await GET(healthRequest());
    const body = await payload(response);

    expect(response.status).toBe(200);
    expect(body.checks).toMatchObject({ supabaseConfig: "ok", openaiConfig: "skipped" });
  });

  it("returns 401, not 503, for an unauthorized deep probe (#L29)", async () => {
    // Before this fix, GET /api/health?deep=1 without the diagnostic token
    // reported HTTP 503 status: "degraded" — indistinguishable from a genuine
    // outage to a monitor that pages on 5xx, when the service was actually
    // healthy and the caller simply omitted a bearer token.
    mockEnv({ configured: true, deepSecret: true });
    const { GET } = await import("../src/app/api/health/route");

    const response = await GET(healthRequest("?deep=1"));
    const body = await payload(response);

    expect(response.status).toBe(401);
    expect(body.checks).toMatchObject({ supabase: "unauthorized" });
    expect(body.slo).toBeUndefined();
    expect(body.cache).toBeUndefined();
    expect(body.coalescing).toBeUndefined();
  });

  it("still reports 503 degraded for a real Supabase outage on an authorized deep probe", async () => {
    mockEnv({ configured: true, deepSecret: true });
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({})) }));
    vi.doMock("@/lib/supabase/health", () => ({
      probeSupabaseHealth: vi.fn(async () => ({
        ok: false,
        checkedAt: "2026-07-22T00:00:00.000Z",
        message: "Supabase health check failed.",
        rawMessage: "permission denied",
      })),
    }));
    const { GET } = await import("../src/app/api/health/route");

    const response = await GET(healthRequest("?deep=1", { "x-health-deep-token": DEEP_TOKEN }));
    const body = await payload(response);

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.checks).toMatchObject({ supabase: "error" });
  });

  it("exposes the in-process cache hit-rate counter on an authorized deep probe", async () => {
    // Demo mode skips the Supabase-backed slo query, so no admin mock is needed;
    // the cache counter is in-process and must still be reported.
    mockEnv({ configured: true, demoMode: true, deepSecret: true });
    const { GET } = await import("../src/app/api/health/route");

    const response = await GET(healthRequest("?deep=1", { "x-health-deep-token": DEEP_TOKEN }));
    const body = await payload(response);

    expect(response.status).toBe(200);
    const cache = body.cache as Record<string, number>;
    // Counters are process-cumulative, so assert shape/invariants, not exact counts.
    expect(typeof cache.lookups).toBe("number");
    expect(typeof cache.hits).toBe("number");
    expect(cache.misses).toBe(cache.lookups - cache.hits);
    expect(cache.hitRate).toBeGreaterThanOrEqual(0);
    expect(cache.hitRate).toBeLessThanOrEqual(1);
    const coalescing = body.coalescing as Record<string, number>;
    expect(typeof coalescing.originations).toBe("number");
    expect(typeof coalescing.coalescedWaiters).toBe("number");
    expect(typeof coalescing.activeOriginations).toBe("number");
    expect(coalescing.coalescingRate).toBeGreaterThanOrEqual(0);
    expect(coalescing.coalescingRate).toBeLessThanOrEqual(1);
    expect(body.slo).toBeUndefined();
  });

  it("does not leak secret values in the payload", async () => {
    mockEnv({ configured: true });
    const { GET } = await import("../src/app/api/health/route");

    const response = await GET(healthRequest());
    const raw = JSON.stringify(await payload(response));

    expect(raw).not.toContain("service-role-key");
    expect(raw).not.toContain("openai-key");
  });
});

describe("GET /api/health/ready", () => {
  it("runs the Supabase readiness branch without requiring the diagnostic probe token", async () => {
    mockEnv({ configured: true, demoMode: true });
    const { GET } = await import("../src/app/api/health/ready/route");

    const response = await GET(new Request("http://localhost/api/health/ready"));
    const body = await payload(response);

    expect(response.status).toBe(200);
    expect(body.checks).toMatchObject({ supabaseConfig: "ok", openaiConfig: "ok", supabase: "skipped" });
  });

  it("exposes no diagnostic details even to a token-bearing caller", async () => {
    mockEnv({ configured: true, demoMode: true, deepSecret: true });
    const { GET } = await import("../src/app/api/health/ready/route");

    const response = await GET(
      new Request("http://localhost/api/health/ready", { headers: { "x-health-deep-token": DEEP_TOKEN } }),
    );
    const body = await payload(response);

    expect(body.slo).toBeUndefined();
    expect(body.cache).toBeUndefined();
    expect(body.coalescing).toBeUndefined();
  });

  it("returns 503 without leaking dependency details when the readiness query fails", async () => {
    mockEnv({ configured: true });
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({})) }));
    vi.doMock("@/lib/supabase/health", () => ({
      probeSupabaseHealth: vi.fn(async () => ({
        ok: false,
        checkedAt: "2026-07-22T00:00:00.000Z",
        message: "Supabase health check failed.",
        rawMessage: "permission denied",
      })),
    }));
    const { GET } = await import("../src/app/api/health/ready/route");

    const response = await GET(new Request("http://localhost/api/health/ready"));
    const body = await payload(response);

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.checks).toMatchObject({ supabase: "error" });
    expect(JSON.stringify(body)).not.toContain("permission denied");
  });

  // #L29: this route is Railway's healthcheck target, so it cannot require
  // auth or a token, and it runs an unauthenticated, unlimited Supabase probe
  // on every hit. A short in-process result cache means a burst of hits
  // (Railway's own healthcheck interval, or anyone else) shares one probe
  // instead of paying for one each — without adding a durable rate limiter
  // that would itself need a database round trip to check.
  it("caches the readiness result briefly so a burst of hits shares one Supabase probe (#L29)", async () => {
    vi.useFakeTimers();
    try {
      mockEnv({ configured: true });
      const probeSupabaseHealth = vi.fn(async () => ({
        ok: true,
        checkedAt: "2026-07-22T00:00:00.000Z",
        message: "ok",
      }));
      vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({})) }));
      vi.doMock("@/lib/supabase/health", () => ({ probeSupabaseHealth }));
      const { GET } = await import("../src/app/api/health/ready/route");

      const first = await GET(new Request("http://localhost/api/health/ready"));
      const second = await GET(new Request("http://localhost/api/health/ready"));
      expect(probeSupabaseHealth).toHaveBeenCalledTimes(1);
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect((await second.json()).checks).toMatchObject({ supabase: "ok" });

      await vi.advanceTimersByTimeAsync(2_001);
      const third = await GET(new Request("http://localhost/api/health/ready"));
      expect(probeSupabaseHealth).toHaveBeenCalledTimes(2);
      expect(third.status).toBe(200);
    } finally {
      vi.useRealTimers();
    }
  });
});
