import { afterEach, describe, expect, it, vi } from "vitest";

const DEEP_TOKEN = "deep-probe-secret";

function mockEnv() {
  vi.resetModules();
  vi.doMock("@/lib/env", () => ({
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://sjrfecxgysukkwxsowpy.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      OPENAI_API_KEY: "openai-key",
      RAG_PROVIDER_MODE: "auto",
      HEALTH_DEEP_PROBE_SECRET: DEEP_TOKEN,
      OPENAI_PRICE_INPUT_PER_MTOK: 1.25,
      OPENAI_PRICE_CACHED_INPUT_PER_MTOK: 0.125,
      OPENAI_PRICE_OUTPUT_PER_MTOK: 10,
      SPEND_ALERT_DAILY_USD: 25,
    },
    isDemoMode: () => false,
  }));
}

function mockSupabase(healthy: boolean) {
  vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ id: "admin-client" })) }));
  vi.doMock("@/lib/supabase/health", () => ({
    probeSupabaseHealth: vi.fn(async () => ({ ok: healthy, checkedAt: "2026-08-01T00:00:00.000Z" })),
  }));
}

async function deepProbe() {
  const { healthResponse } = await import("../src/lib/health-response");
  const response = await healthResponse(
    new Request("http://localhost/api/health?deep=1", { headers: { "x-health-deep-token": DEEP_TOKEN } }),
  );
  return { response, body: (await response.json()) as Record<string, unknown> };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("authorized deep health probe diagnostics", () => {
  it("reports the SLO and spend snapshots when Supabase is healthy", async () => {
    mockEnv();
    mockSupabase(true);
    const answerSloSnapshot = vi.fn(async () => ({ windowMinutes: 60, answers: 12 }));
    const spendCalls: unknown[][] = [];
    const spendSnapshot = vi.fn(async (...args: unknown[]) => {
      spendCalls.push(args);
      return { windowMinutes: 60, totalUsd: 1.5 };
    });
    vi.doMock("@/lib/observability/answer-slo", () => ({ answerSloSnapshot }));
    vi.doMock("@/lib/observability/spend-metrics", () => ({ spendSnapshot }));

    const { response, body } = await deepProbe();

    expect(response.status).toBe(200);
    expect(body.checks).toMatchObject({ supabase: "ok" });
    expect(body.slo).toMatchObject({ answers: 12 });
    expect(body.spend).toMatchObject({ totalUsd: 1.5 });
    expect(spendCalls[0]?.[1]).toMatchObject({
      pricing: { inputPerMTok: 1.25, cachedInputPerMTok: 0.125, outputPerMTok: 10 },
      alertDailyUsd: 25,
    });
  });

  it("keeps the probe healthy when a diagnostic snapshot query fails", async () => {
    mockEnv();
    mockSupabase(true);
    vi.doMock("@/lib/observability/answer-slo", () => ({
      answerSloSnapshot: vi.fn(async () => {
        throw new Error("slo query failed");
      }),
    }));
    vi.doMock("@/lib/observability/spend-metrics", () => ({
      spendSnapshot: vi.fn(async () => {
        throw new Error("spend query failed");
      }),
    }));

    const { response, body } = await deepProbe();

    expect(response.status).toBe(200);
    expect(body.checks).toMatchObject({ supabase: "ok" });
    expect(body.slo).toBeUndefined();
    expect(body.spend).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("query failed");
  });

  it("skips both snapshots when the Supabase probe is unhealthy", async () => {
    mockEnv();
    mockSupabase(false);
    const answerSloSnapshot = vi.fn();
    const spendSnapshot = vi.fn();
    vi.doMock("@/lib/observability/answer-slo", () => ({ answerSloSnapshot }));
    vi.doMock("@/lib/observability/spend-metrics", () => ({ spendSnapshot }));

    const { response, body } = await deepProbe();

    expect(response.status).toBe(503);
    expect(body.checks).toMatchObject({ supabase: "error" });
    expect(answerSloSnapshot).not.toHaveBeenCalled();
    expect(spendSnapshot).not.toHaveBeenCalled();
  });

  it("degrades without leaking details when the Supabase probe itself throws", async () => {
    mockEnv();
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn(() => {
        throw new Error("service role key rejected");
      }),
    }));
    vi.doMock("@/lib/supabase/health", () => ({ probeSupabaseHealth: vi.fn() }));

    const { response, body } = await deepProbe();

    expect(response.status).toBe(503);
    expect(body.checks).toMatchObject({ supabase: "error" });
    expect(JSON.stringify(body)).not.toContain("service role key rejected");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("omits slo for an unauthenticated deep probe even when includeSlo is not passed", async () => {
    // `answer-slo`'s tenancy exemption (scripts/lib/tenancy-scan.mjs) states that this
    // deliberate cross-tenant aggregate is reached "only from /api/health's deep probe behind
    // HEALTH_DEEP_PROBE_SECRET". Until 2026-09-02 the SLO branch was gated on
    // `health.ok && options.includeSlo !== false` with no `tokenAuthorized`, so it also ran for
    // any caller passing `allowUnauthenticatedDeep`. The claim held only because the sole such
    // caller (/api/health/ready) opts out with `includeSlo: false` — one flag at one caller,
    // not a gate. This pins the gate itself, with the opt-out deliberately omitted.
    mockEnv();
    mockSupabase(true);
    const answerSloSnapshot = vi.fn(async () => ({ windowMinutes: 60, answers: 12 }));
    const spendSnapshot = vi.fn(async () => ({ totalUsd: 1 }));
    vi.doMock("@/lib/observability/answer-slo", () => ({ answerSloSnapshot }));
    vi.doMock("@/lib/observability/spend-metrics", () => ({ spendSnapshot }));
    const { healthResponse } = await import("../src/lib/health-response");

    const response = await healthResponse(new Request("http://localhost/api/health/ready"), {
      forceDeep: true,
      allowUnauthenticatedDeep: true,
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.checks).toMatchObject({ supabase: "ok" });
    expect(body.slo, "an unauthenticated deep probe must not receive the cross-tenant SLO aggregate").toBeUndefined();
    expect(answerSloSnapshot).not.toHaveBeenCalled();
    // The other operator-gated snapshots were already token-gated; assert they stay that way.
    expect(body.spend).toBeUndefined();
    expect(spendSnapshot).not.toHaveBeenCalled();
    expect(body.cache).toBeUndefined();
    expect(body.coalescing).toBeUndefined();
  });

  it("suppresses opted-out snapshots for an authorized caller", async () => {
    mockEnv();
    mockSupabase(true);
    const answerSloSnapshot = vi.fn(async () => ({ answers: 1 }));
    const spendSnapshot = vi.fn(async () => ({ totalUsd: 1 }));
    vi.doMock("@/lib/observability/answer-slo", () => ({ answerSloSnapshot }));
    vi.doMock("@/lib/observability/spend-metrics", () => ({ spendSnapshot }));
    const { healthResponse } = await import("../src/lib/health-response");

    const response = await healthResponse(
      new Request("http://localhost/api/health?deep=1", { headers: { "x-health-deep-token": DEEP_TOKEN } }),
      { includeSlo: false, includeSpend: false, includeCache: false, includeCoalescing: false },
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.slo).toBeUndefined();
    expect(body.spend).toBeUndefined();
    expect(body.cache).toBeUndefined();
    expect(body.coalescing).toBeUndefined();
    expect(answerSloSnapshot).not.toHaveBeenCalled();
    expect(spendSnapshot).not.toHaveBeenCalled();
  });
});
