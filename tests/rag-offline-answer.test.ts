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

async function answerOffline(query: string, textSources: SearchResult[]) {
  // offline provider mode forces source-only behaviour regardless of key presence.
  vi.stubEnv("RAG_PROVIDER_MODE", "offline");
  vi.stubEnv("RAG_SEARCH_CACHE_TTL_MS", "0");
  vi.stubEnv("RAG_ANSWER_CACHE_TTL_MS", "0");

  const rpc = vi.fn(async (name: string) => {
    if (name === "match_document_chunks_text") return { data: textSources, error: null };
    return { data: [], error: null };
  });
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
  it("answers from sources deterministically without calling the model or embeddings", async () => {
    const { answer, generateStructuredTextResult, embedTextWithTelemetry } = await answerOffline(
      "What ANC threshold should withhold clozapine?",
      [source()],
    );

    expect(generateStructuredTextResult).not.toHaveBeenCalled();
    expect(embedTextWithTelemetry).not.toHaveBeenCalled();
    expect(answer.modelUsed).toBeNull();
    expect(answer.routingMode).toBe("extractive");
    expect(answer.routingReason).toContain("source_only");
    expect(answer.sources.length).toBeGreaterThan(0);
    // quality signalling for the UI disclosure
    expect(answer.answerQualityTier).toBe("source_only");
    expect(answer.providerMode).toBe("offline");
    expect(answer.fallbackReason).toContain("source_only");
  });

  it("fails closed to a source-gap answer when there is no usable evidence", async () => {
    const { answer, generateStructuredTextResult } = await answerOffline(
      "What is the duress response procedure for the community team?",
      [],
    );

    expect(generateStructuredTextResult).not.toHaveBeenCalled();
    expect(answer.modelUsed).toBeNull();
    expect(answer.routingMode).toBe("unsupported");
    expect(answer.grounded).toBe(false);
  });
});
