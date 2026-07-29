import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Round-trip budget guard for the /api/answer preamble (latency audit 2026-07-28, L1-2).
 *
 * Auth -> rate-limit is a genuine data dependency (the limiter needs
 * `access.rateLimitSubject`), so only scope resolution can overlap. These tests pin
 * the three properties that make the overlap safe, so a refactor that re-serialises
 * the preamble — or drops the abort/settle handling — goes red rather than silently
 * putting a Supabase round trip back on the critical path.
 */

const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const publicAccessContext = vi.fn();
const consumeSubjectApiRateLimit = vi.fn();
const resolveSearchScope = vi.fn();
const answerQuestionWithScope = vi.fn();

vi.mock("@/lib/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/env")>()),
  isDemoMode: () => false,
  isLocalNoAuthMode: () => false,
}));
vi.mock("@/lib/supabase/admin", () => ({
  // Only the route's fire-and-forget telemetry insert touches the client directly;
  // scope and the limiter are mocked below. Without `from` the insert logs a noisy
  // failure that has nothing to do with what these tests assert.
  createAdminClient: () => ({
    from: () => ({ insert: async () => ({ data: null, error: null }) }),
  }),
}));
vi.mock("@/lib/public-api-access", () => ({ publicAccessContext }));
vi.mock("@/lib/api-rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-rate-limit")>()),
  consumeSubjectApiRateLimit,
}));
vi.mock("@/lib/search-scope", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/search-scope")>()),
  resolveSearchScope,
}));
vi.mock("@/lib/rag/rag", () => ({ answerQuestionWithScope }));

function answerRequest() {
  return new Request("http://localhost/api/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "clozapine monitoring thresholds" }),
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function rateLimitDecision(limited: boolean) {
  return {
    limited,
    limit: 100,
    remaining: limited ? 0 : 99,
    retryAfterSeconds: limited ? 60 : 0,
    resetAt: new Date(Date.now() + 60_000).toISOString(),
  };
}

beforeEach(() => {
  publicAccessContext.mockResolvedValue({
    ownerId,
    authenticated: true,
    rateLimitSubject: { kind: "owner", id: ownerId },
  });
  answerQuestionWithScope.mockResolvedValue({
    answer: "stub",
    grounded: true,
    confidence: "supported",
    citations: [],
    sources: [],
    latencyTimings: { total_latency_ms: 1 },
  });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("/api/answer preamble", () => {
  it("starts scope resolution before the rate-limit RPC settles", async () => {
    const limiter = deferred<ReturnType<typeof rateLimitDecision>>();
    consumeSubjectApiRateLimit.mockReturnValue(limiter.promise);
    resolveSearchScope.mockResolvedValue({ documentIds: undefined, filters: {}, activeFilterCount: 0, warnings: [] });

    const { POST } = await import("../src/app/api/answer/route");
    const response = POST(answerRequest());

    // The limiter has not resolved yet. If scope were awaited after it — the
    // pre-2026-07-28 shape — this would still be 0.
    await vi.waitFor(() => expect(resolveSearchScope).toHaveBeenCalledTimes(1));

    limiter.resolve(rateLimitDecision(false));
    expect((await response).status).toBe(200);
  });

  it("aborts the in-flight scope queries when the limiter denies, and still returns 429", async () => {
    consumeSubjectApiRateLimit.mockResolvedValue(rateLimitDecision(true));

    let observed: AbortSignal | undefined;
    resolveSearchScope.mockImplementation(async (args: { signal?: AbortSignal }) => {
      observed = args.signal;
      // Model a paginated scope query that is still in flight when the limiter denies.
      await new Promise((resolve) => setTimeout(resolve, 5));
      if (args.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      return { documentIds: undefined, filters: {}, activeFilterCount: 0, warnings: [] };
    });

    const { POST } = await import("../src/app/api/answer/route");
    const response = await POST(answerRequest());

    expect(response.status).toBe(429);
    expect(observed).toBeInstanceOf(AbortSignal);
    // A throttled caller must not pay for scope: the queries are cancelled, and
    // the rejection is absorbed rather than left floating (an unhandled rejection
    // here would take the process down).
    expect(observed?.aborted).toBe(true);
  });

  it("threads an abort signal so a client disconnect cancels scope's paginated queries", async () => {
    consumeSubjectApiRateLimit.mockResolvedValue(rateLimitDecision(false));
    let observed: AbortSignal | undefined;
    resolveSearchScope.mockImplementation(async (args: { signal?: AbortSignal }) => {
      observed = args.signal;
      return { documentIds: undefined, filters: {}, activeFilterCount: 0, warnings: [] };
    });

    const { POST } = await import("../src/app/api/answer/route");
    const clientAbort = new AbortController();
    const request = new Request("http://localhost/api/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "lithium range" }),
      signal: clientAbort.signal,
    });

    await POST(request);
    expect(observed).toBeInstanceOf(AbortSignal);
    expect(observed?.aborted).toBe(false);
    clientAbort.abort();
    expect(observed?.aborted).toBe(true);
  });

  it("surfaces a scope failure rather than swallowing it with the settle wrapper", async () => {
    consumeSubjectApiRateLimit.mockResolvedValue(rateLimitDecision(false));
    resolveSearchScope.mockRejectedValue(new Error("scope query failed"));

    const { POST } = await import("../src/app/api/answer/route");
    const response = await POST(answerRequest());

    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(answerQuestionWithScope).not.toHaveBeenCalled();
  });
});
