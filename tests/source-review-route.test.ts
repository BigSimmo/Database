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

describe("source review route", () => {
  it("rejects approval without evidence", async () => {
    vi.doMock("@/lib/env", () => ({ isDemoMode: () => false }));
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
    vi.doMock("@/lib/supabase/auth", () => ({
      AuthenticationError: class AuthenticationError extends Error {},
      requireAuthenticatedUser: vi.fn(async () => ({ id: userId })),
      unauthorizedResponse: vi.fn(),
    }));
    const { POST } = await import("../src/app/api/documents/[id]/reviews/route");
    const response = await POST(request({ decision: "approved", reason: "Reviewed source" }), {
      params: Promise.resolve({ id: documentId }),
    });
    expect(response.status).toBe(400);
  });

  it("records an evidence-bearing review transaction and then invalidates caches", async () => {
    const rpc = vi.fn(async () => ({ data: { id: "review-1" }, error: null }));
    const invalidateRagCachesForOwner = vi.fn();
    vi.doMock("@/lib/env", () => ({ isDemoMode: () => false }));
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));
    vi.doMock("@/lib/supabase/auth", () => ({
      AuthenticationError: class AuthenticationError extends Error {},
      requireAuthenticatedUser: vi.fn(async () => ({ id: userId })),
      unauthorizedResponse: vi.fn(),
    }));
    vi.doMock("@/lib/api-rate-limit", () => ({
      consumeApiRateLimit: vi.fn(async () => ({ limited: false })),
      rateLimitJsonResponse: vi.fn(),
    }));
    vi.doMock("@/lib/rag", () => ({ invalidateRagCachesForOwner }));

    const { POST } = await import("../src/app/api/documents/[id]/reviews/route");
    const response = await POST(
      request({
        decision: "approved",
        reason: "Reviewed against the signed local policy",
        evidenceReferences: ["policy-signoff-2026-07"],
        reviewDate: "2027-07-11",
      }),
      { params: Promise.resolve({ id: documentId }) },
    );

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("record_source_review", expect.objectContaining({ p_reviewer_id: userId }));
    expect(invalidateRagCachesForOwner).toHaveBeenCalledWith(userId);
  });
});
