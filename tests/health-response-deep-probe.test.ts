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
      SITE_CONTENT_EXPECTED_STATIC_MANIFEST_DIGEST: "a".repeat(64),
    },
    isDemoMode: () => false,
  }));
}

function mockSupabase(healthy: boolean, options: { fails?: boolean } = {}) {
  vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ id: "admin-client" })) }));
  vi.doMock("@/lib/supabase/health", () => ({
    probeSupabaseHealth: vi.fn(async () => ({ ok: healthy, checkedAt: "2026-08-01T00:00:00.000Z" })),
  }));
  const current = new Date().toISOString();
  const readSiteContentHealthEvidence = vi.fn(async (client: unknown, signal?: AbortSignal) => {
    // Mirror the real call: the admin client is forwarded, and an expired deadline aborts
    // rather than being ignored.
    expect(client).toEqual({ id: "admin-client" });
    signal?.throwIfAborted();
    if (options.fails) throw new Error("private database failure");
    return {
      initialized: true,
      bootstrapIntegrityState: "not_applicable",
      activePublicSiteRelease: {
        version: "clinical-kb-site-release-v1",
        releaseId: "11111111-1111-5111-8111-111111111111",
        registryVersion: "site-content-registry-v1",
        staticManifestDigest: "a".repeat(64),
        dynamicStateDigest: "b".repeat(64),
        releaseDigest: "c".repeat(64),
        state: "active",
        activatedAt: current,
      },
      publicSiteChangeEpoch: "7",
      outstandingHeadCount: 0,
      populationComplete: true,
      releaseDigestValid: true,
      dynamicDigestValid: true,
      administratorAttestationValid: true,
      governanceValid: true,
      pendingSetExact: true,
      outstandingHeadCountAgrees: true,
      pendingCount: 0,
      retryPendingCount: 0,
      processingCount: 0,
      readyCount: 0,
      quarantinedCount: 0,
      oldestOutstandingOriginAgeMs: null,
      countOverflow: false,
      timeIntegrityValid: true,
      expiredProcessingLeaseCount: 0,
      synchronizerSeen: true,
      lastInvocationAt: current,
      lastSuccessfulInvocationAt: current,
      latestInvocationSucceeded: true,
      lastActivation: current,
      rollbackAvailable: false,
    };
  });
  vi.doMock("@/lib/site-content/site-content-publication", () => ({ readSiteContentHealthEvidence }));
  return { readSiteContentHealthEvidence };
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
    expect(body.checks).toMatchObject({ supabase: "ok", siteContent: "ok" });
    expect(body.siteContent).toMatchObject({ state: "current", releaseDigestPrefix: "cccccccccccc" });
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

/**
 * The split that keeps production deployable.
 *
 * `read_site_content_health()` audits the whole site-content control plane — record counts,
 * digest comparisons, tombstone reconciliation — and costs about seven seconds against the live
 * database. Railway allows each healthcheck attempt ten, so while `/api/health/ready` called it,
 * 24 consecutive production deploys (2026-09-11 to 2026-09-14) built, started cleanly, answered
 * too slowly and were rolled back. The audit is not weakened here; one caller stopped asking.
 * `docs/deployment-architecture.md` § Readiness carries the measurements.
 */
describe("the site-content control-plane audit", () => {
  it("runs for the token-gated deep probe", async () => {
    mockEnv();
    const { readSiteContentHealthEvidence } = mockSupabase(true);

    const { response, body } = await deepProbe();

    expect(response.status).toBe(200);
    expect(readSiteContentHealthEvidence).toHaveBeenCalledTimes(1);
    expect(body.checks).toMatchObject({ siteContent: "ok" });
    expect(body.siteContent).toMatchObject({ state: "current" });
  });

  it("is bounded by a deadline so it can never hang a request path", async () => {
    mockEnv();
    const { readSiteContentHealthEvidence } = mockSupabase(true);

    await deepProbe();

    const signal = readSiteContentHealthEvidence.mock.calls[0]?.[1];
    expect(signal, "an unbounded control-plane query is what caused the outage").toBeInstanceOf(AbortSignal);
  });

  /**
   * The deadline is a measured range, not a preference, and it went in below the range once.
   *
   * An abort is reported through the same `catch` as a corpus inconsistency — `checks.siteContent
   * = "error"`, which makes the whole probe 503 — so a deadline under the audit's healthy cost
   * does not bound a fault, it fabricates one, on every single call. That would take out
   * `check:production-readiness` too, since `scripts/lib/deployment-rag-activation.mjs` reads this
   * exact response and fails on a non-2xx. The opposite error is quieter but also real: a deadline
   * above that caller's own 15 s whole-response budget can never fire, so a one-field timeout
   * degrades into an opaque `health_probe_failed` instead.
   */
  it("keeps its deadline above the audit's measured cost and below the readiness prober's budget", async () => {
    mockEnv();
    mockSupabase(true);
    const { SITE_CONTENT_PROBE_TIMEOUT_MS } = await import("../src/lib/health-response");

    // Measured on the live container, 2026-09-14: /api/health/ready totalled 7.884 s with the
    // audit against 0.798 s without it. See docs/deployment-architecture.md § Readiness.
    const MEASURED_HEALTHY_COST_MS = 7_100;
    // scripts/lib/deployment-rag-activation.mjs: AbortSignal.timeout(15000) around this response.
    const READINESS_PROBER_BUDGET_MS = 15_000;

    expect(
      SITE_CONTENT_PROBE_TIMEOUT_MS,
      "a deadline below the audit's healthy cost reports every healthy call as an integrity fault",
    ).toBeGreaterThan(MEASURED_HEALTHY_COST_MS);
    expect(
      SITE_CONTENT_PROBE_TIMEOUT_MS,
      "a deadline above the readiness prober's own budget can never be reached",
    ).toBeLessThan(READINESS_PROBER_BUDGET_MS);
  });

  it("fails the deep probe closed, without leaking the RPC error", async () => {
    // Migrated from `tests/health-route.test.ts`, where it asserted the same fail-closed
    // behaviour on `/api/health/ready`. The behaviour is unchanged; only its caller moved.
    mockEnv();
    mockSupabase(true, { fails: true });

    const { response, body } = await deepProbe();

    expect(response.status).toBe(503);
    expect(body.checks).toMatchObject({ supabase: "ok", siteContent: "error" });
    expect(JSON.stringify(body)).not.toContain("private database failure");
  });

  it("is skipped, not failed, when a caller opts out", async () => {
    mockEnv();
    const { readSiteContentHealthEvidence } = mockSupabase(true, { fails: true });
    const { healthResponse } = await import("../src/lib/health-response");

    const response = await healthResponse(
      new Request("http://localhost/api/health?deep=1", { headers: { "x-health-deep-token": DEEP_TOKEN } }),
      { includeSiteContent: false },
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.checks).toMatchObject({ supabase: "ok", siteContent: "skipped" });
    expect(body.siteContent).toBeUndefined();
    expect(readSiteContentHealthEvidence).not.toHaveBeenCalled();
  });
});
