import { afterEach, describe, expect, it, vi } from "vitest";

const DEEP_TOKEN = "deep-probe-secret";

function mockEnv(options: { configured: boolean; demoMode?: boolean; deepSecret?: boolean }) {
  vi.resetModules();
  vi.doMock("@/lib/env", () => ({
    env: {
      NEXT_PUBLIC_SUPABASE_URL: options.configured ? "https://sjrfecxgysukkwxsowpy.supabase.co" : undefined,
      SUPABASE_SERVICE_ROLE_KEY: options.configured ? "service-role-key" : undefined,
      OPENAI_API_KEY: options.configured ? "openai-key" : undefined,
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
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("GET /api/health", () => {
  it("reports ok when fully configured", async () => {
    mockEnv({ configured: true });
    const { GET } = await import("../src/app/api/health/route");

    const response = await GET(healthRequest());
    const body = await payload(response);

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.checks).toMatchObject({ supabaseConfig: "ok", openaiConfig: "ok" });
    expect(body.demoMode).toBe(false);
    expect(typeof body.uptimeSeconds).toBe("number");
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

  it("gates the deep probe without a token and omits the slo/cache snapshots", async () => {
    mockEnv({ configured: true, deepSecret: true });
    const { GET } = await import("../src/app/api/health/route");

    const response = await GET(healthRequest("?deep=1"));
    const body = await payload(response);

    expect(response.status).toBe(503);
    expect(body.checks).toMatchObject({ supabase: "unauthorized" });
    expect(body.slo).toBeUndefined();
    expect(body.cache).toBeUndefined();
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
