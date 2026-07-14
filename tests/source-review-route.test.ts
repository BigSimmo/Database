import { afterEach, describe, expect, it, vi } from "vitest";

const documentId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

function request(body: unknown) {
  return new Request(`http://localhost/api/documents/${documentId}/reviews`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function documentQuery(status = "indexed") {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(async () => ({ data: { id: documentId, status }, error: null })),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

function mockAuthenticatedUser() {
  vi.doMock("@/lib/supabase/auth", () => ({
    AuthenticationError: class AuthenticationError extends Error {},
    requireAuthenticatedUser: vi.fn(async () => ({ id: userId })),
    unauthorizedResponse: vi.fn(),
  }));
}

describe("source review route", () => {
  it("rejects approval without evidence", async () => {
    vi.doMock("@/lib/env", () => ({ env: { WORKER_STALE_AFTER_MINUTES: 15 }, isDemoMode: () => false }));
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
    mockAuthenticatedUser();
    const { POST } = await import("../src/app/api/documents/[id]/reviews/route");
    const response = await POST(request({ decision: "approved", reason: "Reviewed source" }), {
      params: Promise.resolve({ id: documentId }),
    });
    expect(response.status).toBe(400);
  });

  it("rejects future and invalid calendar review dates", async () => {
    vi.doMock("@/lib/env", () => ({ env: { WORKER_STALE_AFTER_MINUTES: 15 }, isDemoMode: () => false }));
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
    mockAuthenticatedUser();

    const { POST } = await import("../src/app/api/documents/[id]/reviews/route");
    for (const reviewDate of ["2999-01-01", "2026-02-30"]) {
      const response = await POST(
        request({
          decision: "approved",
          reason: "Reviewed against the signed local policy",
          evidenceReferences: ["policy-signoff-2026-07"],
          reviewDate,
        }),
        { params: Promise.resolve({ id: documentId }) },
      );
      expect(response.status).toBe(400);
    }
  });

  it("rejects source promotion before indexing completes", async () => {
    const rpc = vi.fn();
    const query = documentQuery("processing");
    vi.doMock("@/lib/env", () => ({ env: { WORKER_STALE_AFTER_MINUTES: 15 }, isDemoMode: () => false }));
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({ from: vi.fn(() => query), rpc }),
    }));
    mockAuthenticatedUser();
    vi.doMock("@/lib/api-rate-limit", () => ({
      consumeApiRateLimit: vi.fn(async () => ({ limited: false })),
      rateLimitJsonResponse: vi.fn(),
    }));

    const { POST } = await import("../src/app/api/documents/[id]/reviews/route");
    const response = await POST(
      request({
        decision: "approved",
        reason: "Reviewed against the signed local policy",
        evidenceReferences: ["policy-signoff-2026-07"],
      }),
      { params: Promise.resolve({ id: documentId }) },
    );

    expect(response.status).toBe(409);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("records an evidence-bearing review transaction and then invalidates caches", async () => {
    const rpc = vi.fn(async () => ({ data: { id: "review-1" }, error: null }));
    const invalidateRagCachesForOwner = vi.fn();
    const checkIngestionMutationSafety = vi.fn(async () => ({
      ok: true as const,
      checkedAt: "2026-07-13T00:00:00.000Z",
      reason: "ready" as const,
      message: "safe",
      activeJobs: [] as [],
      staleProcessingJobs: [] as [],
    }));
    const hasActiveAgentEnrichmentJob = vi.fn(async () => false);
    const query = documentQuery();
    vi.doMock("@/lib/env", () => ({ env: { WORKER_STALE_AFTER_MINUTES: 15 }, isDemoMode: () => false }));
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({ from: vi.fn(() => query), rpc }),
    }));
    mockAuthenticatedUser();
    vi.doMock("@/lib/api-rate-limit", () => ({
      consumeApiRateLimit: vi.fn(async () => ({ limited: false })),
      rateLimitJsonResponse: vi.fn(),
    }));
    vi.doMock("@/lib/ingestion-mutation-safety", () => ({
      checkIngestionMutationSafety,
      hasActiveAgentEnrichmentJob,
      ingestionMutationSafetyPayload: vi.fn(),
    }));
    vi.doMock("@/lib/rag", () => ({ invalidateRagCachesForOwner }));

    const { POST } = await import("../src/app/api/documents/[id]/reviews/route");
    const response = await POST(
      request({
        decision: "approved",
        reason: "Reviewed against the signed local policy",
        evidenceReferences: ["policy-signoff-2026-07"],
        reviewDate: "2026-07-11",
      }),
      { params: Promise.resolve({ id: documentId }) },
    );

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("record_source_review", expect.objectContaining({ p_reviewer_id: userId }));
    expect(checkIngestionMutationSafety).toHaveBeenCalledWith(expect.objectContaining({ documentIds: [documentId] }));
    expect(hasActiveAgentEnrichmentJob).toHaveBeenCalledWith(expect.objectContaining({ documentId }));
    expect(invalidateRagCachesForOwner).toHaveBeenCalledWith(userId);
  });
});
