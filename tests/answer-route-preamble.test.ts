import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Admission-cost guard for the /api/answer preamble (latency audit 2026-07-28, L1-2).
 *
 * A denied request must cost zero scope queries. `resolveSearchScope` pages
 * `documents` and their labels whenever the caller sends filters or explicit ids, and
 * an AbortSignal cancels the client request without un-executing a query Postgres has
 * already started — so "start scope early and abort on deny" is NOT free, and was
 * removed after review. These tests pin the ordering so a future latency pass cannot
 * reintroduce the overlap, and pin the signal threading that was kept.
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
  it("does not begin scope resolution until the limiter has admitted the request", async () => {
    const limiter = deferred<ReturnType<typeof rateLimitDecision>>();
    consumeSubjectApiRateLimit.mockReturnValue(limiter.promise);
    resolveSearchScope.mockResolvedValue({ documentIds: undefined, filters: {}, activeFilterCount: 0, warnings: [] });

    const { POST } = await import("../src/app/api/answer/route");
    const response = POST(answerRequest());

    // Give the route every chance to dispatch scope early: if it overlapped the
    // two, this microtask drain would be enough for the call to land.
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(resolveSearchScope).not.toHaveBeenCalled();

    limiter.resolve(rateLimitDecision(false));
    expect((await response).status).toBe(200);
    expect(resolveSearchScope).toHaveBeenCalledTimes(1);
  });

  it("dispatches no scope query at all when the limiter denies", async () => {
    consumeSubjectApiRateLimit.mockResolvedValue(rateLimitDecision(true));
    resolveSearchScope.mockResolvedValue({ documentIds: undefined, filters: {}, activeFilterCount: 0, warnings: [] });

    const { POST } = await import("../src/app/api/answer/route");
    // Filters are what push resolveSearchScope past its zero-query early returns
    // (search-scope.ts:242,253) and into the paginated `documents` loop, so this
    // is the shape that made the old overlap expensive for a throttled caller.
    const response = await POST(
      new Request("http://localhost/api/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "clozapine monitoring", filters: { sourceStatuses: ["current"] } }),
      }),
    );

    expect(response.status).toBe(429);
    expect(resolveSearchScope).not.toHaveBeenCalled();
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
