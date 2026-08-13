import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const answerQuestionWithScope = vi.fn();
const publicAccessContext = vi.fn();
const consumeSubjectApiRateLimit = vi.fn();
const resolveSearchScope = vi.fn();

vi.mock("@/lib/env", () => ({ isDemoMode: () => false }));
vi.mock("@/lib/rag/rag", () => ({ answerQuestionWithScope, summarizeDocument: vi.fn() }));
vi.mock("@/lib/public-api-access", () => ({ publicAccessContext }));
vi.mock("@/lib/api-rate-limit", () => ({
  allowRateLimitInMemoryFallbackOnUnavailable: () => false,
  consumeSummaryRateLimits: vi.fn(),
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse: () => new Response(null, { status: 429 }),
}));
vi.mock("@/lib/answer-response", () => ({
  answerDegradedModeSignal: () => ({ active: false }),
  buildGovernedAnswerClientResponse: (answer: unknown) => ({ payload: answer, telemetryAnswer: answer }),
  buildGovernedDemoAnswerClientResponse: vi.fn(),
}));
vi.mock("@/lib/search-scope", async (importOriginal) => ({
  ...(await importOriginal()),
  resolveSearchScope,
}));
vi.mock("@/lib/owner-scope", () => ({
  resolveRetrievalAccessScope: (ownerId?: string) => ({ ownerId }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/answer-telemetry", () => ({ logAnswerDiagnostics: vi.fn() }));
vi.mock("@/lib/observability/agent-monitoring", () => ({ setAgentConversationId: vi.fn() }));
vi.mock("@/lib/sse-heartbeat", () => ({ startSseHeartbeat: () => () => undefined }));
vi.mock("@/lib/server-timing", () => ({
  buildServerTimingHeader: () => null,
  preambleServerTimingEntries: () => [],
}));
vi.mock("@/lib/answer-feedback-token", () => ({ answerFeedbackMetadata: () => ({}) }));

const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

beforeEach(() => {
  publicAccessContext.mockResolvedValue({
    ownerId,
    authenticated: true,
    rateLimitSubject: { kind: "owner", id: ownerId },
  });
  consumeSubjectApiRateLimit.mockResolvedValue({
    limited: false,
    limit: 100,
    remaining: 99,
    retryAfterSeconds: 0,
    resetAt: new Date(Date.now() + 60_000).toISOString(),
  });
  resolveSearchScope.mockResolvedValue({ documentIds: undefined, filters: {}, activeFilterCount: 0, warnings: [] });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("answer stream verified preview ordering", () => {
  it("delivers the ranking preview before generation and final frames", async () => {
    answerQuestionWithScope.mockImplementation(async ({ onProgress }: { onProgress?: (event: unknown) => void }) => {
      onProgress?.({
        stage: "ranking",
        verifiedUnit: {
          schemaVersion: 1,
          kind: "evidence_preview",
          sequence: 0,
          sources: [],
          selectedContextCount: 0,
        },
      });
      onProgress?.({ stage: "generating" });
      return { answer: "Source-backed answer.", grounded: true, confidence: "high", citations: [], sources: [] };
    });

    const { POST } = await import("../src/app/api/answer/stream/route");
    const response = await POST(
      new Request("http://localhost/api/answer/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "clozapine monitoring" }),
      }),
    );
    const body = await response.text();

    const previewIndex = body.indexOf('"stage":"ranking"');
    const generationIndex = body.indexOf('"stage":"generating"');
    const finalIndex = body.indexOf("event: final");
    expect(previewIndex).toBeGreaterThan(-1);
    expect(previewIndex).toBeLessThan(generationIndex);
    expect(generationIndex).toBeLessThan(finalIndex);
  });
});
