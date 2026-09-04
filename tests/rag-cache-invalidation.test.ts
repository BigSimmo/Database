import { afterEach, describe, expect, it, vi } from "vitest";
import type { SearchChunksArgs } from "../src/lib/rag/rag-contracts";
import type { RagAnswer } from "../src/lib/types";

const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function sampleAnswer(answer = "Cached clinical answer."): RagAnswer {
  return {
    answer,
    grounded: true,
    confidence: "high",
    citations: [],
    sources: [],
    routingMode: "fast",
    routingReason: "test",
    modelUsed: "test-model",
  };
}

type FilterCall =
  | { method: "eq"; column: string; value: unknown }
  | { method: "is"; column: string; value: unknown }
  | { method: "in"; column: string; value: unknown };

class DeleteQuery implements PromiseLike<{ data: null; error: null }> {
  constructor(private readonly calls: FilterCall[]) {}

  eq(column: string, value: unknown) {
    this.calls.push({ method: "eq", column, value });
    return this;
  }

  is(column: string, value: unknown) {
    this.calls.push({ method: "is", column, value });
    return this;
  }

  in(column: string, value: unknown) {
    this.calls.push({ method: "in", column, value });
    return this;
  }

  then<TResult1 = { data: null; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: null; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: null, error: null }).then(onfulfilled, onrejected);
  }
}

afterEach(() => {
  vi.doUnmock("@/lib/supabase/admin");
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function installAnswerCacheEntrypointHarness(sharedPayload?: Record<string, unknown>) {
  const insertedRows: Array<Record<string, unknown>> = [];
  const documentBuilder = {
    select: () => documentBuilder,
    eq: () => documentBuilder,
    is: () => documentBuilder,
    or: () => documentBuilder,
    in: () => documentBuilder,
    order: () => documentBuilder,
    limit: () => documentBuilder,
    abortSignal: () => documentBuilder,
    then: (
      resolve: (value: { data: Array<{ id: string; updated_at: string; metadata: object }>; error: null }) => unknown,
    ) =>
      Promise.resolve({
        data: [{ id: "doc-1", updated_at: "2026-08-30T00:00:00.000Z", metadata: {} }],
        error: null,
      }).then(resolve),
  };
  const responseBuilder = {
    select: () => responseBuilder,
    delete: () => responseBuilder,
    insert: (value: Record<string, unknown>) => {
      insertedRows.push(value);
      return responseBuilder;
    },
    eq: () => responseBuilder,
    is: () => responseBuilder,
    in: () => responseBuilder,
    gt: () => responseBuilder,
    order: () => responseBuilder,
    limit: () => responseBuilder,
    abortSignal: () => responseBuilder,
    maybeSingle: async () => ({ data: sharedPayload ? { payload: sharedPayload } : null, error: null }),
    then: (resolve: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(resolve),
  };
  const from = vi.fn((table: string) => (table === "documents" ? documentBuilder : responseBuilder));
  vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from }) }));
  return { from, insertedRows };
}

describe("RAG cache invalidation", () => {
  it("preserves decomposed telemetry through the real local-answer cache entrypoint", async () => {
    vi.stubEnv("RAG_ANSWER_CACHE_TTL_MS", "60000");
    vi.stubEnv("RAG_ANSWER_CACHE_SIZE", "100");
    const harness = installAnswerCacheEntrypointHarness();
    const cache = await import("../src/lib/rag/rag-cache");
    const { answerQuestionWithScope } = await import("../src/lib/rag/rag");
    const { ragProgrammeTelemetryForAnswer } = await import("../src/lib/rag/rag-programme-telemetry");
    const args = {
      query: "cached decomposed local plan",
      ownerId,
      accessScope: { ownerId, includePublic: true as const },
      ragQueryPlanVersion: "rag-query-plan-v1",
      ragQueryPlanMode: "legacy" as const,
      ragQueryPlanKind: "decomposed" as const,
      ragSubquestionCount: 3,
      ragCandidateMatchCounts: { matched: 1, partial_match: 1, absent: 1 },
    };
    await cache.setCachedAnswer(args, sampleAnswer("Local cached answer."));
    await vi.waitFor(() => expect(harness.insertedRows).toHaveLength(1));

    const answer = await answerQuestionWithScope({
      query: args.query,
      ownerId,
      accessScope: args.accessScope,
      logQuery: false,
      observationContext: {
        interactionId: "11111111-1111-4111-8111-111111111111",
        rolloutMode: "legacy",
      },
    });

    expect(answer.routingReason).toContain("answer_cache_hit");
    expect(ragProgrammeTelemetryForAnswer(answer)).toMatchObject({
      query_plan_kind: "decomposed",
      subquestion_count: 3,
      candidate_match_counts: null,
    });
    expect(cache.ragAnswerQueryPlanDiagnostics(answer)?.candidateMatchCounts).toBeUndefined();
    expect(harness.insertedRows[0]?.payload).not.toHaveProperty("queryPlanDiagnostics.candidateMatchCounts");
  });

  it("preserves decomposed telemetry through the real shared-answer cache entrypoint", async () => {
    vi.stubEnv("RAG_ANSWER_CACHE_TTL_MS", "60000");
    vi.stubEnv("RAG_ANSWER_CACHE_SIZE", "100");
    installAnswerCacheEntrypointHarness({
      answer: sampleAnswer("Shared cached answer."),
      queryPlanDiagnostics: {
        queryPlanKind: "decomposed",
        subquestionCount: 3,
        candidateMatchCounts: { matched: 3, partial_match: 0, absent: 0 },
      },
    });
    const cache = await import("../src/lib/rag/rag-cache");
    const { answerQuestionWithScope } = await import("../src/lib/rag/rag");
    const { ragProgrammeTelemetryForAnswer } = await import("../src/lib/rag/rag-programme-telemetry");

    const answer = await answerQuestionWithScope({
      query: "cached decomposed shared plan",
      ownerId,
      accessScope: { ownerId, includePublic: true },
      logQuery: false,
      observationContext: {
        interactionId: "22222222-2222-4222-8222-222222222222",
        rolloutMode: "legacy",
      },
    });

    expect(answer.routingReason).toContain("shared_answer_cache_hit");
    expect(ragProgrammeTelemetryForAnswer(answer)).toMatchObject({
      query_plan_kind: "decomposed",
      subquestion_count: 3,
      candidate_match_counts: null,
    });
    expect(cache.ragAnswerQueryPlanDiagnostics(answer)?.candidateMatchCounts).toBeUndefined();
  });

  it("performs no local, shared, or deferred cache writes in shadow mode", async () => {
    vi.resetModules();
    const from = vi.fn(() => {
      throw new Error("shadow cache writes must not touch storage");
    });
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from }) }));

    const { getCachedAnswer, setCachedAnswer, setCachedSearch } = await import("../src/lib/rag/rag-cache");
    const args = {
      query: "compare clozapine and olanzapine monitoring",
      ownerId,
      accessScope: { ownerId, includePublic: true as const },
      ragQueryPlanVersion: "rag-query-plan-v1",
      ragQueryPlanMode: "shadow" as const,
      ragQueryPlanKind: "decomposed" as const,
      ragSubquestionCount: 3,
    };

    await setCachedAnswer(args, sampleAnswer());
    await setCachedSearch(
      args,
      [],
      {
        search_cache_hit: false,
        text_fast_path_latency_ms: 0,
        embedding_skipped: true,
        embedding_latency_ms: 0,
        embedding_cache_hit: false,
        supabase_rpc_latency_ms: 0,
        rerank_latency_ms: 0,
      },
      [],
    );

    expect(await getCachedAnswer(args, Date.now(), { indexingVersionAtRequestStart: "unused" })).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("partitions query-plan versions and modes without exposing candidate subqueries", async () => {
    vi.resetModules();
    const { withRagRequestContext } = await import("../src/lib/rag/rag-context-snapshot");
    const { ragCacheDependencyVersion, retrievalPlanCacheQuery, scopedAnswerCacheKey } =
      await import("../src/lib/rag/rag-cache");
    const requestArgs: SearchChunksArgs = {
      query: "lithium monitoring",
      ownerId,
      accessScope: { ownerId, includePublic: true as const },
    };
    const request = withRagRequestContext(requestArgs);
    const legacyV1 = {
      ...request,
      ragQueryPlanVersion: "rag-query-plan-v1",
      ragQueryPlanMode: "legacy" as const,
    };
    const shadowV1 = { ...legacyV1, ragQueryPlanMode: "shadow" as const };
    const shadowV2 = { ...shadowV1, ragQueryPlanVersion: "rag-query-plan-v2" };

    expect(ragCacheDependencyVersion).toBe("rag-cache-v23");
    expect(scopedAnswerCacheKey(legacyV1)).not.toBe(scopedAnswerCacheKey(shadowV1));
    expect(scopedAnswerCacheKey(shadowV1)).not.toBe(scopedAnswerCacheKey(shadowV2));
    const searchKeys = [legacyV1, shadowV1, shadowV2].map((args) =>
      retrievalPlanCacheQuery(args, undefined, ["candidate subquestion secret"]),
    );
    expect(new Set(searchKeys).size).toBe(3);
    expect(searchKeys.every((key) => !key.includes("candidate subquestion secret"))).toBe(true);
  });

  it("removes only the matching hashed site-aware answer and in-flight identities", async () => {
    vi.resetModules();
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        from: () => ({
          delete: () => new DeleteQuery([]),
        }),
      }),
    }));

    const { withRagRequestContext } = await import("../src/lib/rag/rag-context-snapshot");
    const { answerInflight, invalidateRagCachesForOwner, scopedAnswerCacheKey } =
      await import("../src/lib/rag/rag-cache");
    const input = {
      expectedSiteStaticManifestDigest: "a".repeat(64),
      activePublicSiteRelease: {
        version: "clinical-kb-site-release-v1" as const,
        releaseId: "11111111-1111-5111-8111-111111111111",
        registryVersion: "site-content-registry-v1",
        staticManifestDigest: "a".repeat(64),
        dynamicStateDigest: "b".repeat(64),
        releaseDigest: "c".repeat(64),
        state: "active" as const,
        activatedAt: "2026-08-29T00:00:00.000Z",
      },
      publicSiteChangeEpoch: "1",
      pendingPublicSiteChangeCount: 0,
      documentIndexGeneration: "generation-v1",
      sourcePolicyVersion: "source-policy-v1",
      rolloutVersion: "rollout-v1",
    };
    const publicRequest = withRagRequestContext({
      query: "clozapine monitoring",
      accessScope: { includePublic: true as const },
      ragContextSnapshotInput: input,
    });
    const ownerAArgs = { ...publicRequest, ownerId };
    const ownerB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const ownerBArgs = { ...publicRequest, ownerId: ownerB };
    const ownerAKey = scopedAnswerCacheKey(ownerAArgs);
    const ownerBKey = scopedAnswerCacheKey(ownerBArgs);
    answerInflight.set(ownerAKey, Promise.resolve(sampleAnswer("owner-a")));
    answerInflight.set(ownerBKey, Promise.resolve(sampleAnswer("owner-b")));

    expect(ownerAKey).not.toContain(ownerId);
    invalidateRagCachesForOwner(ownerId);

    expect(answerInflight.has(ownerAKey)).toBe(false);
    expect(answerInflight.has(ownerBKey)).toBe(true);
    invalidateRagCachesForOwner(ownerB);
  });

  it("clears anonymous shared cache rows with owner_id is null instead of writing the anonymous sentinel to UUID filters", async () => {
    vi.resetModules();
    const calls: FilterCall[][] = [];

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        from: vi.fn((table: string) => ({
          delete: vi.fn(() => {
            expect(table).toBe("rag_response_cache");
            const queryCalls: FilterCall[] = [];
            calls.push(queryCalls);
            return new DeleteQuery(queryCalls);
          }),
        })),
      }),
    }));

    const { invalidateRagCachesForDocumentMutation } = await import("../src/lib/rag/rag");

    invalidateRagCachesForDocumentMutation(ownerId);

    await vi.waitFor(() => expect(calls.length).toBe(2), { timeout: 10000 });

    expect(calls[0]).toContainEqual({ method: "eq", column: "owner_id", value: ownerId });
    expect(calls.flat()).not.toContainEqual({ method: "eq", column: "owner_id", value: "anonymous" });
    expect(calls[1]).toContainEqual({ method: "is", column: "owner_id", value: null });
    expect(calls[1]).toContainEqual({ method: "in", column: "cache_kind", value: ["search", "answer"] });

    calls.length = 0;
    invalidateRagCachesForDocumentMutation(ownerId, { affectsPublicCorpus: false });
    await vi.waitFor(() => expect(calls.length).toBe(1), { timeout: 10000 });
    expect(calls[0]).toContainEqual({ method: "eq", column: "owner_id", value: ownerId });

    calls.length = 0;
    invalidateRagCachesForDocumentMutation(ownerId, { affectsPublicCorpus: true });
    await vi.waitFor(() => expect(calls.length).toBe(2), { timeout: 10000 });
    expect(calls[1]).toContainEqual({ method: "is", column: "owner_id", value: null });
  });

  it("discards a deferred setCachedAnswer that resumes after invalidateRagCachesForOwner", async () => {
    vi.resetModules();

    let releaseIndexingVersion: (() => void) | undefined;
    const indexingVersionGate = new Promise<void>((resolve) => {
      releaseIndexingVersion = resolve;
    });
    const indexingStamp = "rag-deep-memory-v1:doc-1:2026-07-01T00:00:00.000Z:";

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        from: vi.fn((table: string) => {
          if (table === "documents") {
            const builder = {
              select: vi.fn(() => builder),
              eq: vi.fn(() => builder),
              is: vi.fn(() => builder),
              or: vi.fn(() => builder),
              in: vi.fn(() => builder),
              order: vi.fn(() => builder),
              limit: vi.fn(() => builder),
              abortSignal: vi.fn(() => builder),
              then: (onfulfilled?: (value: { data: unknown; error: null }) => unknown) =>
                indexingVersionGate
                  .then(() =>
                    Promise.resolve({
                      data: [{ id: "doc-1", updated_at: "2026-07-01T00:00:00.000Z", metadata: {} }],
                      error: null,
                    }),
                  )
                  .then(onfulfilled),
            };
            return builder;
          }

          const deleteCalls: FilterCall[] = [];
          return {
            delete: vi.fn(() => new DeleteQuery(deleteCalls)),
            insert: vi.fn(async () => ({ data: null, error: null })),
          };
        }),
      }),
    }));

    const { getCachedAnswer, invalidateRagCachesForOwner, setCachedAnswer } = await import("../src/lib/rag/rag-cache");

    const args = {
      query: "clozapine monitoring",
      ownerId,
      accessScope: { ownerId, includePublic: true as const },
    };
    const promotion = setCachedAnswer(args, sampleAnswer("pre-review answer"), {
      indexingVersionAtRetrievalStart: indexingStamp,
    });

    // Simulate a table-fact / review mutation while the deferred promotion awaits
    // its forced indexing-version read. Review metadata does not change that stamp.
    invalidateRagCachesForOwner(ownerId);
    releaseIndexingVersion?.();
    await promotion;

    const cached = await getCachedAnswer(args, Date.now(), {
      indexingVersionAtRequestStart: indexingStamp,
    });
    expect(cached).toBeNull();
  });

  it("does not let one owner's invalidation discard another owner's deferred setCachedAnswer", async () => {
    vi.resetModules();

    const ownerA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const ownerB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    let releaseIndexingVersion: (() => void) | undefined;
    const indexingVersionGate = new Promise<void>((resolve) => {
      releaseIndexingVersion = resolve;
    });
    const indexingStamp = "rag-deep-memory-v1:doc-1:2026-07-01T00:00:00.000Z:";

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        from: vi.fn((table: string) => {
          if (table === "documents") {
            const builder = {
              select: vi.fn(() => builder),
              eq: vi.fn(() => builder),
              is: vi.fn(() => builder),
              or: vi.fn(() => builder),
              in: vi.fn(() => builder),
              order: vi.fn(() => builder),
              limit: vi.fn(() => builder),
              abortSignal: vi.fn(() => builder),
              then: (onfulfilled?: (value: { data: unknown; error: null }) => unknown) =>
                indexingVersionGate
                  .then(() =>
                    Promise.resolve({
                      data: [{ id: "doc-1", updated_at: "2026-07-01T00:00:00.000Z", metadata: {} }],
                      error: null,
                    }),
                  )
                  .then(onfulfilled),
            };
            return builder;
          }

          const deleteCalls: FilterCall[] = [];
          return {
            delete: vi.fn(() => new DeleteQuery(deleteCalls)),
            insert: vi.fn(async () => ({ data: null, error: null })),
          };
        }),
      }),
    }));

    const { getCachedAnswer, invalidateRagCachesForOwner, setCachedAnswer } = await import("../src/lib/rag/rag-cache");

    const argsB = {
      query: "clozapine monitoring",
      ownerId: ownerB,
      accessScope: { ownerId: ownerB, includePublic: true as const },
    };
    const promotionB = setCachedAnswer(argsB, sampleAnswer("owner-b answer"), {
      indexingVersionAtRetrievalStart: indexingStamp,
    });

    invalidateRagCachesForOwner(ownerA);
    releaseIndexingVersion?.();
    await promotionB;

    const cachedB = await getCachedAnswer(argsB, Date.now(), {
      indexingVersionAtRequestStart: indexingStamp,
    });
    expect(cachedB?.answer).toBe("owner-b answer");
  });
});
