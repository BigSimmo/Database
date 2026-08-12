import { afterEach, describe, expect, it, vi } from "vitest";

const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

function createSharedCacheBuilder(payload: {
  answer: { routingReason: string; degradedMode?: { active: boolean; reason: string } };
}) {
  const sharedBuilder = {
    select: () => sharedBuilder,
    eq: () => sharedBuilder,
    is: () => sharedBuilder,
    in: () => sharedBuilder,
    gt: () => sharedBuilder,
    order: () => sharedBuilder,
    limit: () => sharedBuilder,
    maybeSingle: async () => ({ data: { payload }, error: null }),
    then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(resolve),
  };

  let deletionCalls = 0;
  const deleteBuilder = {
    eq: () => deleteBuilder,
    is: () => deleteBuilder,
    in: () => deleteBuilder,
    then: (resolve: (value: { data: unknown; error: null }) => unknown) => {
      deletionCalls += 1;
      return Promise.resolve({ data: null, error: null }).then(resolve);
    },
  };

  return {
    builder: {
      select: () => sharedBuilder,
      delete: () => deleteBuilder,
      eq: () => sharedBuilder,
      is: () => sharedBuilder,
      in: () => sharedBuilder,
      gt: () => sharedBuilder,
      order: () => sharedBuilder,
      limit: () => sharedBuilder,
      then: (resolve: (value: { data: unknown[]; error: null }) => unknown, reject?: (reason: unknown) => unknown) => {
        return Promise.resolve({
          data: [{ id: "doc-1", updated_at: "2026-07-14T00:00:00.000Z", metadata: {} }],
          error: null,
        }).then(resolve, reject);
      },
    },
    sharedBuilder,
    deleteBuilder,
    get deletionCalls() {
      return deletionCalls;
    },
  } as const;
}

describe("shared RAG search cache", () => {
  it("uses one shared-cache read for a cold filtered miss", async () => {
    vi.resetModules();
    let sharedCacheReads = 0;

    vi.doMock("@/lib/env", () => ({
      env: {
        RAG_SEARCH_CACHE_TTL_MS: 60_000,
        RAG_SEARCH_CACHE_SIZE: 200,
        RAG_PERSIST_RAW_QUERY_TEXT: false,
        RAG_QUERY_HASH_SECRET: "test-query-hash-secret",
      },
      isDemoMode: () => false,
      isLocalNoAuthMode: () => false,
    }));
    vi.doMock("@/lib/deep-memory", () => ({ ragDeepMemoryVersion: "test-rag-version" }));
    vi.doMock("@/lib/clinical-search", () => ({
      buildClinicalTextSearchQuery: (query: string) => query.trim(),
    }));
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        from: (table: string) => {
          const builder = {
            select: () => builder,
            eq: () => builder,
            is: () => builder,
            in: () => builder,
            or: () => builder,
            gt: () => builder,
            order: () => builder,
            limit: () => builder,
            maybeSingle: async () => {
              expect(table).toBe("rag_response_cache");
              sharedCacheReads += 1;
              return { data: null, error: null };
            },
            then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
              Promise.resolve({
                data:
                  table === "documents" ? [{ id: "doc-1", updated_at: "2026-07-14T00:00:00.000Z", metadata: {} }] : [],
                error: null,
              }).then(resolve),
          };
          return builder;
        },
      }),
    }));

    const { getSharedCachedSearch } = await import("../src/lib/rag/rag-cache");
    const result = await getSharedCachedSearch({
      query: "lithium monitoring",
      ownerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });

    expect(result).toEqual({ kind: "miss", reason: "unknown_filter_miss" });
    expect(sharedCacheReads).toBe(1);
  });

  it("forwards corpus_grounding from the stored payload on a shared-cache hit", async () => {
    vi.resetModules();

    vi.doMock("@/lib/env", () => ({
      env: {
        RAG_SEARCH_CACHE_TTL_MS: 60_000,
        RAG_SEARCH_CACHE_SIZE: 200,
        RAG_PERSIST_RAW_QUERY_TEXT: false,
        RAG_QUERY_HASH_SECRET: "test-query-hash-secret",
      },
      isDemoMode: () => false,
      isLocalNoAuthMode: () => false,
    }));
    vi.doMock("@/lib/deep-memory", () => ({ ragDeepMemoryVersion: "test-rag-version" }));
    vi.doMock("@/lib/clinical-search", () => ({
      buildClinicalTextSearchQuery: (query: string) => query.trim(),
    }));
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        from: (table: string) => {
          const builder = {
            select: () => builder,
            eq: () => builder,
            is: () => builder,
            in: () => builder,
            or: () => builder,
            gt: () => builder,
            order: () => builder,
            limit: () => builder,
            maybeSingle: async () => {
              if (table !== "rag_response_cache") return { data: null, error: null };
              return {
                data: {
                  payload: {
                    results: [],
                    telemetry: { query_class: "unsupported_or_general", corpus_grounding: "in_corpus_topic" },
                  },
                },
                error: null,
              };
            },
            then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
              Promise.resolve({
                data:
                  table === "documents" ? [{ id: "doc-1", updated_at: "2026-07-14T00:00:00.000Z", metadata: {} }] : [],
                error: null,
              }).then(resolve),
          };
          return builder;
        },
      }),
    }));

    const { getSharedCachedSearch } = await import("../src/lib/rag/rag-cache");
    const result = await getSharedCachedSearch({
      query: "catatonia",
      ownerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });

    expect(result?.kind).toBe("hit");
    expect(result?.kind === "hit" && result.telemetry.corpus_grounding).toBe("in_corpus_topic");
  });

  it("does not serve generation-fallback answers from shared cache and removes them", async () => {
    vi.resetModules();
    const fallback = {
      answer: {
        routingReason: "clinical_fast_grounded_synthesis; generation_fallback",
        degradedMode: { active: true, reason: "generation_fallback" },
      },
    };
    const shared = createSharedCacheBuilder(fallback);

    vi.doMock("@/lib/env", () => ({
      env: {
        RAG_SEARCH_CACHE_TTL_MS: 60_000,
        RAG_SEARCH_CACHE_SIZE: 200,
        RAG_ANSWER_CACHE_TTL_MS: 60_000,
        RAG_ANSWER_CACHE_SIZE: 200,
        RAG_PERSIST_RAW_QUERY_TEXT: false,
        RAG_QUERY_HASH_SECRET: "test-query-hash-secret",
      },
      isDemoMode: () => false,
      isLocalNoAuthMode: () => false,
    }));
    vi.doMock("@/lib/deep-memory", () => ({ ragDeepMemoryVersion: "test-rag-version" }));
    vi.doMock("@/lib/clinical-search", () => ({
      buildClinicalTextSearchQuery: (query: string) => query.trim(),
    }));
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        from: (table: string) => {
          if (table === "rag_response_cache") return shared.builder;
          return {
            select: () => shared.sharedBuilder,
            eq: () => shared.sharedBuilder,
            is: () => shared.sharedBuilder,
            or: () => shared.sharedBuilder,
            gt: () => shared.sharedBuilder,
            order: () => shared.sharedBuilder,
            limit: () => shared.sharedBuilder,
            then: (
              resolve: (value: { data: unknown[]; error: null }) => unknown,
              reject?: (reason: unknown) => unknown,
            ) =>
              Promise.resolve({
                data: [{ id: "doc-1", updated_at: "2026-07-14T00:00:00.000Z", metadata: {} }],
                error: null,
              }).then(resolve, reject),
            maybeSingle: async () => ({ data: null, error: null }),
          };
        },
      }),
    }));

    const { getSharedCachedAnswer } = await import("../src/lib/rag/rag-cache");
    const result = await getSharedCachedAnswer(
      {
        query: "clinical deterioration",
        ownerId,
        queryMode: "auto",
        forceEmbedding: false,
      },
      Date.now(),
    );

    expect(result).toBeNull();
    expect(shared.deletionCalls).toBe(1);
  });
});
