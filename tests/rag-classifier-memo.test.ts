import { afterEach, describe, expect, it, vi } from "vitest";

// Finding #11 interim hardening: the generative query classifier's verdict is
// memoized per normalized query, so a bare low-confidence query behaves the same
// on repeat runs instead of intermittently short-circuiting to "unsupported".

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

  neq() {
    return this;
  }

  is() {
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

async function searchTwice(classifierResult: (() => Promise<{ text: string }>) | Error) {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubEnv("RAG_SEARCH_CACHE_TTL_MS", "0");
  vi.stubEnv("RAG_ANSWER_CACHE_TTL_MS", "0");

  const rpc = vi.fn(async (name: string) => {
    if (name === "correct_clinical_query_terms") return { data: null, error: null };
    return { data: [], error: null };
  });
  vi.doMock("@/lib/supabase/admin", () => ({
    createAdminClient: () => ({
      rpc,
      from: vi.fn(() => new EmptyQuery()),
    }),
  }));

  const generateStructuredTextResult = vi.fn(async () => {
    if (classifierResult instanceof Error) throw classifierResult;
    return {
      ...(await classifierResult()),
      model: "gpt-4.1-mini",
      operation: "text_generation",
      latencyMs: 5,
      requestId: "req_classifier_memo",
      usage: { input_tokens: 40, output_tokens: 20, total_tokens: 60 },
    };
  });
  vi.doMock("@/lib/openai", () => ({
    embedTextWithTelemetry: vi.fn(async () => {
      throw new Error("embeddings must not run for short-circuited queries");
    }),
    generateStructuredTextResult,
  }));

  const { searchChunksWithTelemetry } = await import("../src/lib/rag");
  const search = () =>
    searchChunksWithTelemetry({
      query: "bipolar disorder",
      ownerId: undefined,
      allowGlobalSearch: true,
    });
  const first = await search();
  const second = await search();
  return { first, second, generateStructuredTextResult };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe("query classifier verdict memoization", () => {
  it("memoizes a definitive classifier decline so repeat queries stay deterministic", async () => {
    const { first, second, generateStructuredTextResult } = await searchTwice(async () => ({
      text: JSON.stringify({
        queryClass: "unsupported_or_general",
        confidence: 0.9,
        reasons: ["not_retrieval"],
        expandedTerms: [],
      }),
    }));

    expect(first.telemetry.retrieval_strategy).toBe("unsupported_short_circuit");
    expect(second.telemetry.retrieval_strategy).toBe("unsupported_short_circuit");
    expect(generateStructuredTextResult).toHaveBeenCalledTimes(1);
  });

  it("does not memoize transient classifier failures so the next request can retry", async () => {
    const { first, second, generateStructuredTextResult } = await searchTwice(new Error("classifier timed out"));

    expect(first.telemetry.retrieval_strategy).toBe("unsupported_short_circuit");
    expect(second.telemetry.retrieval_strategy).toBe("unsupported_short_circuit");
    expect(generateStructuredTextResult).toHaveBeenCalledTimes(2);
  });
});
