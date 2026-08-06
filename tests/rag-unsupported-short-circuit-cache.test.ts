import { afterEach, describe, expect, it, vi } from "vitest";

// Finding #11 follow-up (handover 2026-08-06): the soft-tail unsupported short-circuit can be a
// false negative for genuinely in-corpus bare topics (e.g. "catatonia" is well represented in
// chunk content but no document is *titled* "Catatonia", so corpus grounding returns
// "inconclusive" rather than rescuing it, and the query falls through to the nondeterministic
// LLM classifier). Caching that zero made the false negative sticky for every later caller within
// the cache TTL. searchChunksWithTelemetry (src/lib/rag/rag.ts) must skip the cache write only for
// that specific soft-tail bucket, while still caching the three deterministic exclusion patterns
// (unavailable-document noise, clearly-outside-corpus terms, clearly-non-clinical consumer terms)
// that are stable true negatives.

class EmptyQuery implements PromiseLike<{ data: unknown[]; error: null }> {
  select() {
    return this;
  }
  in() {
    return this;
  }
  eq() {
    return this;
  }
  is() {
    return this;
  }
  neq() {
    return this;
  }
  or() {
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return Promise.resolve({ data: [], error: null });
  }
  then<TResult1 = { data: unknown[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: [], error: null }).then(onfulfilled, onrejected);
  }
}

async function loadSearch(corpusGroundingVerdict: "inconclusive" | "out_of_corpus" | "in_corpus_topic") {
  const setCachedSearch = vi.fn(async () => undefined);

  vi.doMock("@/lib/rag/rag-cache", async () => {
    const actual = await vi.importActual<typeof import("../src/lib/rag/rag-cache")>("@/lib/rag/rag-cache");
    return {
      ...actual,
      cacheIndexingVersion: vi.fn(async () => "test-indexing-version"),
      getCachedSearch: vi.fn(async () => null),
      getSharedCachedSearch: vi.fn(async () => null),
      setCachedSearch,
    };
  });
  vi.doMock("@/lib/rag/rag-retrieval-variants", async () => {
    const actual = await vi.importActual<typeof import("../src/lib/rag/rag-retrieval-variants")>(
      "@/lib/rag/rag-retrieval-variants",
    );
    return {
      ...actual,
      fetchEnabledRagAliases: vi.fn(async () => []),
    };
  });
  vi.doMock("@/lib/corpus-grounding", () => ({
    classifyCorpusGrounding: vi.fn(async () => ({ verdict: corpusGroundingVerdict, anchorTerms: [], absentTerms: [] })),
  }));
  vi.doMock("@/lib/rag/rag-provider", () => ({
    isSourceOnlyMode: () => true,
    allowsAutoDegrade: () => true,
    sourceOnlyReason: () => "source_only",
    classifyProviderFailure: () => "provider_failure",
    SOURCE_ONLY_EMBEDDING_SKIP_REASON: "source_only",
  }));
  vi.doMock("@/lib/supabase/admin", () => ({
    createAdminClient: () => ({
      rpc: vi.fn(async () => ({ data: [], error: null })),
      from: vi.fn(() => new EmptyQuery()),
    }),
  }));
  vi.stubEnv("OPENAI_API_KEY", "");

  const { searchChunksWithTelemetry } = await import("../src/lib/rag/rag");
  return { searchChunksWithTelemetry, setCachedSearch };
}

const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("unsupported short-circuit cache write", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("does not cache a zero result for the soft-tail bucket (corpus grounding inconclusive)", async () => {
    const { searchChunksWithTelemetry, setCachedSearch } = await loadSearch("inconclusive");

    const result = await searchChunksWithTelemetry({
      query: "catatonia",
      ownerId,
      lexicalOnly: true,
    });

    expect(result.results).toEqual([]);
    expect(result.telemetry.retrieval_strategy).toBe("unsupported_short_circuit");
    expect(setCachedSearch).not.toHaveBeenCalled();
  }, 60_000);

  it("still caches the deterministic unavailable-document-noise short circuit", async () => {
    const { searchChunksWithTelemetry, setCachedSearch } = await loadSearch("inconclusive");

    const result = await searchChunksWithTelemetry({
      query: "Show me the airport travel policy",
      ownerId,
      lexicalOnly: true,
    });

    expect(result.results).toEqual([]);
    expect(result.telemetry.retrieval_strategy).toBe("unsupported_short_circuit");
    expect(setCachedSearch).toHaveBeenCalledTimes(1);
  }, 60_000);

  it("rescues an in-corpus bare topic before ever reaching the short circuit", async () => {
    const { searchChunksWithTelemetry, setCachedSearch } = await loadSearch("in_corpus_topic");

    const result = await searchChunksWithTelemetry({
      query: "catatonia",
      ownerId,
      lexicalOnly: true,
    });

    expect(result.telemetry.retrieval_strategy).not.toBe("unsupported_short_circuit");
    expect(setCachedSearch).not.toHaveBeenCalled();
  }, 60_000);
});
