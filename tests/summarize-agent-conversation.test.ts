import { afterEach, describe, expect, it, vi } from "vitest";

const setAgentConversationId = vi.fn();
const summarizeDocument = vi.fn(async () => ({
  answer: "Summary body.",
  grounded: true,
  confidence: "high",
  citations: [],
  smartPanel: { query: "summary" },
  smartApiPlan: { displayMode: "direct" },
}));

vi.mock("@/lib/observability/agent-monitoring", () => ({
  setAgentConversationId: (...args: unknown[]) => setAgentConversationId(...args),
}));

vi.mock("@/lib/demo-data", () => ({
  isDemoMode: () => false,
  getDemoDocument: () => null,
  demoSummary: () => ({}),
}));

vi.mock("@/lib/env", () => ({
  isDemoMode: () => false,
}));

vi.mock("@/lib/rag/rag", () => ({
  summarizeDocument: (...args: unknown[]) => summarizeDocument(...args),
}));

vi.mock("@/lib/answer-response", () => ({
  buildGovernedAnswerClientResponse: (answer: { answer: string }) => ({
    payload: { answer: answer.answer, grounded: true },
    telemetryAnswer: answer,
  }),
  buildGovernedDemoAnswerClientResponse: (payload: unknown) => payload,
}));

vi.mock("@/lib/answer-telemetry", () => ({
  logAnswerDiagnostics: vi.fn(),
}));

vi.mock("@/lib/answer-feedback-token", () => ({
  answerFeedbackMetadata: (interactionId: string) => ({ interactionId }),
}));

vi.mock("@/lib/api-rate-limit", () => ({
  consumeApiRateLimit: vi.fn(async () => ({
    limited: false,
    limit: 12,
    remaining: 11,
    retryAfterSeconds: 60,
    resetAt: new Date().toISOString(),
  })),
  rateLimitJsonResponse: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({}),
}));

vi.mock("@/lib/supabase/auth", () => ({
  AuthenticationError: class AuthenticationError extends Error {},
  requireAuthenticatedUser: vi.fn(async () => ({ id: "11111111-1111-4111-8111-111111111111" })),
  unauthorizedResponse: () => new Response(null, { status: 401 }),
}));

describe("document summarize Sentry conversation id", () => {
  afterEach(() => {
    setAgentConversationId.mockClear();
    summarizeDocument.mockClear();
    vi.resetModules();
  });

  it("sets the agent conversation id before any LLM summarize work", async () => {
    const { POST } = await import("../src/app/api/documents/[id]/summarize/route");
    const documentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

    const response = await POST(
      new Request(`http://localhost/api/documents/${documentId}/summarize`, { method: "POST" }),
      {
        params: Promise.resolve({ id: documentId }),
      },
    );

    expect(response.status).toBe(200);
    expect(setAgentConversationId).toHaveBeenCalledTimes(1);
    expect(setAgentConversationId.mock.invocationCallOrder[0]).toBeLessThan(
      summarizeDocument.mock.invocationCallOrder[0]!,
    );
    const body = (await response.json()) as { interactionId?: string };
    expect(body.interactionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(setAgentConversationId).toHaveBeenCalledWith(body.interactionId);
  });
});
