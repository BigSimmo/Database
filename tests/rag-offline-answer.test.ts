import { afterEach, describe, expect, it, vi } from "vitest";
import type { SearchResult } from "../src/lib/types";

function source(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: "clozapine-chunk-1",
    document_id: "clozapine-doc",
    title: "Clozapine Prescribing Administration Monitoring",
    file_name: "CG.MHSP.ClozapinePresAdminMonitor.pdf",
    page_number: 11,
    chunk_index: 0,
    section_heading: "Monitoring",
    content:
      "Withhold clozapine if the absolute neutrophil count (ANC) falls below 1.5 x10^9/L. Mandatory FBC monitoring is weekly for the first 18 weeks of clozapine treatment, then reduces in frequency.",
    image_ids: [],
    similarity: 0.95,
    hybrid_score: 0.95,
    text_rank: 1.2,
    table_facts: [
      {
        id: "clozapine-anc-threshold",
        document_id: "clozapine-doc",
        source_chunk_id: "clozapine-chunk-1",
        source_image_id: null,
        page_number: 11,
        table_title: "Clozapine ANC thresholds",
        row_label: "ANC below 1.5 x 10^9/L",
        clinical_parameter: "ANC",
        threshold_value: "below 1.5 x 10^9/L",
        action: "Withhold clozapine and repeat FBC.",
      },
    ],
    source_metadata: {
      source_title: "Clozapine source",
      publisher: "Local service",
      jurisdiction: "Australia/WA",
      version: "1",
      publication_date: null,
      review_date: null,
      uploaded_at: null,
      indexed_at: null,
      uploaded_by: null,
      document_status: "current",
      clinical_validation_status: "approved",
      extraction_quality: "good",
    },
    images: [],
    ...overrides,
  };
}

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

type RpcResult = { data: unknown; error: unknown };

async function answerOffline(
  query: string,
  textSources: SearchResult[],
  rpcHandler?: (name: string) => RpcResult | Promise<RpcResult>,
) {
  // offline provider mode forces source-only behaviour regardless of key presence.
  vi.stubEnv("RAG_PROVIDER_MODE", "offline");
  vi.stubEnv("RAG_SEARCH_CACHE_TTL_MS", "0");
  vi.stubEnv("RAG_ANSWER_CACHE_TTL_MS", "0");

  const rpc = vi.fn(
    rpcHandler
      ? async (name: string) => rpcHandler(name)
      : async (name: string) => {
          if (name === "match_document_chunks_text_v2" || name === "match_document_chunks_text") {
            return { data: textSources, error: null };
          }
          return { data: [], error: null };
        },
  );
  vi.doMock("@/lib/supabase/admin", () => ({
    createAdminClient: () => ({ rpc, from: vi.fn(() => new EmptyQuery()) }),
  }));

  const generateStructuredTextResult = vi.fn();
  const embedTextWithTelemetry = vi.fn();
  vi.doMock("@/lib/openai", () => ({ embedTextWithTelemetry, generateStructuredTextResult }));

  const { answerQuestionWithScope } = await import("../src/lib/rag");
  const answer = await answerQuestionWithScope({ query, ownerId: undefined, logQuery: false, skipCache: true });
  return { answer, generateStructuredTextResult, embedTextWithTelemetry };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe("source-only / offline answers", () => {
  it("returns the source/citation wire contract without calling the model or embeddings", async () => {
    const { answer, generateStructuredTextResult, embedTextWithTelemetry } = await answerOffline(
      "What ANC threshold should withhold clozapine?",
      [source()],
    );

    expect(generateStructuredTextResult).not.toHaveBeenCalled();
    expect(embedTextWithTelemetry).not.toHaveBeenCalled();
    expect(answer.modelUsed).toBeNull();
    expect(answer.routingMode).toBe("extractive");
    expect(answer.routingReason).toContain("source_only");
    expect(answer).toMatchObject({
      answer: expect.any(String),
      grounded: false,
      confidence: "unsupported",
      citations: [
        expect.objectContaining({
          chunk_id: "clozapine-chunk-1",
          document_id: "clozapine-doc",
          title: "Clozapine Prescribing Administration Monitoring",
          file_name: "CG.MHSP.ClozapinePresAdminMonitor.pdf",
          page_number: 11,
          source_metadata: expect.objectContaining({
            jurisdiction: "Australia/WA",
            document_status: "current",
            clinical_validation_status: "approved",
          }),
        }),
      ],
      sources: [
        expect.objectContaining({
          id: "clozapine-chunk-1",
          document_id: "clozapine-doc",
          page_number: 11,
        }),
      ],
    });
    expect(new Set(answer.sources.map((item) => item.id))).toEqual(
      new Set(answer.citations.map((citation) => citation.chunk_id)),
    );
    // quality signalling for the UI disclosure
    expect(answer.answerQualityTier).toBe("source_only");
    expect(answer.providerMode).toBe("offline");
    expect(answer.fallbackReason).toContain("source_only");
  });

  it("stays fail-closed (does not throw) when a lexical retrieval RPC errors", async () => {
    // F8: the terminal lexical layer now records the RPC error in retrieval
    // telemetry via recordHybridRpcError before returning empty. The return
    // value is unchanged, so the path must still degrade to a source-gap answer
    // rather than throw.
    const rpcError = {
      code: "42P01",
      message: "relation match_document_chunks_text does not exist",
      hint: null,
    };
    const { answer, generateStructuredTextResult } = await answerOffline(
      "What ANC threshold should withhold clozapine?",
      [],
      (name) => (name === "match_document_chunks_text" ? { data: null, error: rpcError } : { data: [], error: null }),
    );

    expect(generateStructuredTextResult).not.toHaveBeenCalled();
    expect(answer.grounded).toBe(false);
    expect(answer.confidence).toBe("unsupported");
  });

  it("fails closed to a source-gap answer when there is no usable evidence", async () => {
    const { answer, generateStructuredTextResult } = await answerOffline(
      "What is the duress response procedure for the community team?",
      [],
    );

    expect(generateStructuredTextResult).not.toHaveBeenCalled();
    expect(answer.modelUsed).toBeNull();
    expect(answer.routingMode).toBe("unsupported");
    expect(answer).toMatchObject({
      answer: expect.any(String),
      grounded: false,
      confidence: "unsupported",
      citations: [],
      sources: [],
    });
  });

  it("uses the dedicated comparison builder and keeps provider-unavailable output source-safe", async () => {
    const protocolB = source({
      id: "clozapine-chunk-2",
      document_id: "clozapine-doc-b",
      title: "Clozapine Protocol B",
      file_name: "clozapine-b.pdf",
      table_facts: [
        {
          ...source().table_facts![0],
          id: "clozapine-anc-threshold-b",
          document_id: "clozapine-doc-b",
          source_chunk_id: "clozapine-chunk-2",
          threshold_value: "below 1.0 x 10^9/L",
          action: "Stop clozapine and repeat FBC.",
        },
      ],
    });

    const { answer, generateStructuredTextResult } = await answerOffline("Compare the ANC thresholds", [
      source(),
      protocolB,
    ]);

    expect(generateStructuredTextResult).not.toHaveBeenCalled();
    expect(answer.routingReason).toContain("structured_comparison_matrix");
    expect(answer.routingReason).toContain("source_only");
    expect(answer.comparisonEvaluationState).toBe("evaluated");
    expect(answer.comparisonMatrix?.rows[0]?.status).toBe("conflict");
    expect(answer.answer).toContain("below 1.5 x 10^9/L");
    expect(answer.answer).toContain("below 1.0 x 10^9/L");
    expect(answer.citations.map((citation) => citation.chunk_id)).toEqual(["clozapine-chunk-1", "clozapine-chunk-2"]);
  });
});
