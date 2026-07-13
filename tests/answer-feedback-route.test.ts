import { afterEach, describe, expect, it, vi } from "vitest";

const interactionId = "11111111-1111-4111-8111-111111111111";
const sourceId = "22222222-2222-4222-8222-222222222222";

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("answer feedback route", () => {
  it("accepts privacy-minimised anonymous feedback", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    vi.doMock("@/lib/env", () => ({ isDemoMode: () => false }));
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({ from: vi.fn(() => ({ insert })) }),
    }));
    vi.doMock("@/lib/public-api-access", () => ({
      publicAccessContext: vi.fn(async () => ({
        authenticated: false,
        ownerId: undefined,
        rateLimitSubject: { kind: "anonymous", subjectKey: "anon:test" },
      })),
    }));
    vi.doMock("@/lib/api-rate-limit", () => ({
      allowRateLimitInMemoryFallbackOnUnavailable: () => true,
      consumeSubjectApiRateLimit: vi.fn(async () => ({ limited: false })),
      rateLimitJsonResponse: vi.fn(),
    }));
    vi.doMock("@/lib/answer-feedback-token", () => ({
      verifyAnswerFeedbackToken: vi.fn(() => true),
    }));

    const { POST } = await import("../src/app/api/answer-feedback/route");
    const response = await POST(
      new Request("http://localhost/api/answer-feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          interactionId,
          feedbackCategory: "needs_correction",
          answerHash: "a".repeat(64),
          feedbackToken: "signed-feedback-token",
          sourceIds: [sourceId],
          citedSourceIds: [sourceId],
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        interaction_id: interactionId,
        owner_id: null,
        answer_hash: "a".repeat(64),
        feedback_category: "needs_correction",
      }),
    );
  });

  it("maps PostgreSQL unique violations to a duplicate-feedback response", async () => {
    const insert = vi.fn(async () => ({ error: { code: "23505", message: "localized constraint failure" } }));
    vi.doMock("@/lib/env", () => ({ isDemoMode: () => false }));
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({ from: vi.fn(() => ({ insert })) }),
    }));
    vi.doMock("@/lib/public-api-access", () => ({
      publicAccessContext: vi.fn(async () => ({
        authenticated: false,
        ownerId: undefined,
        rateLimitSubject: { kind: "anonymous", subjectKey: "anon:test" },
      })),
    }));
    vi.doMock("@/lib/api-rate-limit", () => ({
      allowRateLimitInMemoryFallbackOnUnavailable: () => true,
      consumeSubjectApiRateLimit: vi.fn(async () => ({ limited: false })),
      rateLimitJsonResponse: vi.fn(),
    }));
    vi.doMock("@/lib/answer-feedback-token", () => ({
      verifyAnswerFeedbackToken: vi.fn(() => true),
    }));

    const { POST } = await import("../src/app/api/answer-feedback/route");
    const response = await POST(
      new Request("http://localhost/api/answer-feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          interactionId,
          feedbackCategory: "verified",
          answerHash: "b".repeat(64),
          feedbackToken: "signed-feedback-token",
        }),
      }),
    );

    expect(response.status).toBe(409);
  });

  it("rejects fabricated interaction IDs before inserting feedback", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    const verifyAnswerFeedbackToken = vi.fn(() => false);
    vi.doMock("@/lib/env", () => ({ isDemoMode: () => false }));
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({ from: vi.fn(() => ({ insert })) }),
    }));
    vi.doMock("@/lib/public-api-access", () => ({
      publicAccessContext: vi.fn(async () => ({
        authenticated: false,
        ownerId: undefined,
        rateLimitSubject: { kind: "anonymous", subjectKey: "anon:test" },
      })),
    }));
    vi.doMock("@/lib/api-rate-limit", () => ({
      allowRateLimitInMemoryFallbackOnUnavailable: () => true,
      consumeSubjectApiRateLimit: vi.fn(async () => ({ limited: false })),
      rateLimitJsonResponse: vi.fn(),
    }));
    vi.doMock("@/lib/answer-feedback-token", () => ({ verifyAnswerFeedbackToken }));

    const { POST } = await import("../src/app/api/answer-feedback/route");
    const response = await POST(
      new Request("http://localhost/api/answer-feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          interactionId,
          feedbackCategory: "verified",
          answerHash: "c".repeat(64),
          feedbackToken: "fabricated-feedback-token",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "invalid_feedback_token" });
    expect(verifyAnswerFeedbackToken).toHaveBeenCalledWith({
      token: "fabricated-feedback-token",
      interactionId,
      answerHash: "c".repeat(64),
    });
    expect(insert).not.toHaveBeenCalled();
  });
});
