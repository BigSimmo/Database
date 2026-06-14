import { afterEach, describe, expect, it, vi } from "vitest";
import type { SearchResult } from "../src/lib/types";

function source(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: "agitation-chunk-1",
    document_id: "agitation-doc",
    title: "Agitation and Arousal Pharmacological Management",
    file_name: "MHSP.AgitationArousalPharmaMgt.pdf",
    page_number: 8,
    chunk_index: 0,
    section_heading: "Appendix 1",
    content:
      "Agitation and arousal pharmacological management for adult mental health inpatients. Step 1 uses oral medication when the patient is willing. Step 2 considers increased agitation and arousal ratings with oral benzodiazepines or antipsychotics. Step 3 uses intramuscular medication when oral medication is refused.",
    image_ids: [],
    similarity: 0.97,
    hybrid_score: 0.97,
    text_rank: 1.1,
    source_metadata: {
      source_title: "Agitation source",
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

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe("RAG structured-output fallback", () => {
  it("returns natural extractive answers instead of packed source-card labels", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("RAG_SEARCH_CACHE_TTL_MS", "0");
    vi.stubEnv("RAG_ANSWER_CACHE_TTL_MS", "0");

    const clozapineSource = source({
      id: "clozapine-monitoring-1",
      document_id: "clozapine-doc",
      title: "Clozapine Monitoring",
      file_name: "CG.MHSP.ClozapinePresAdminMonitor.pdf",
      page_number: 11,
      section_heading: "Monitoring",
      content:
        "Medication point: • Copy of the Consent to Clozapine Treatment Form EMR0270. Medication point: • Prescribe initiation of Clozapine on the WA Adult Clozapine Initiation and Titration form. Medication point: • Ensure consumers complete the Clozapine Monitoring Form on initiation.",
      similarity: 0.94,
      hybrid_score: 0.94,
      text_rank: 1.2,
      memory_cards: [
        {
          id: "memory-1",
          document_id: "clozapine-doc",
          owner_id: null,
          card_type: "medication",
          title: "Clozapine monitoring",
          content:
            "Medication point: • Copy of the Consent to Clozapine Treatment Form EMR0270 - Medication point: • Prescribe Initiation of Clozapine on the WA Adult Clozapine Initiation and Titration form - Medication point: • Ensure all consumers complete the Clozapine Monitoring Form on initiation.",
          normalized_terms: ["clozapine", "monitoring"],
          page_number: 11,
          source_chunk_ids: ["clozapine-monitoring-1"],
          source_image_ids: [],
          confidence: 0.92,
        },
      ],
    });
    const rpc = vi.fn(async (name: string) => {
      if (name === "match_document_chunks_text") return { data: [clozapineSource], error: null };
      if (name === "get_related_document_metadata") return { data: [], error: null };
      return { data: [], error: null };
    });

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        rpc,
        from: vi.fn(() => new EmptyQuery()),
      }),
    }));
    vi.doMock("@/lib/openai", () => ({
      embedTextWithTelemetry: vi.fn(),
      generateStructuredTextResult: vi.fn(),
    }));

    const { answerQuestionWithScope } = await import("../src/lib/rag");

    const answer = await answerQuestionWithScope({
      query: "what monitoring is required for clozapine",
      ownerId: undefined,
      logQuery: false,
      skipCache: true,
    });

    expect(answer.routingMode).toBe("extractive");
    expect(answer.answer.replace(/\*\*/g, "")).toContain("retrieved clozapine sources");
    expect(answer.answer.replace(/\*\*/g, "")).toContain("Clozapine Monitoring Form");
    expect(answer.answer).not.toContain("- Medication point");
    expect(answer.answer).not.toMatch(/Medication point:.*Medication point:/);
    expect(answer.answerSections?.[0]?.heading).toBe("Direct source-backed answer");
    expect(answer.answerSections?.[0]?.body).not.toContain("- Medication point");
  });

  it("filters table-caption metadata from extractive answer points", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("RAG_SEARCH_CACHE_TTL_MS", "0");
    vi.stubEnv("RAG_ANSWER_CACHE_TTL_MS", "0");

    const clozapineTableSource = source({
      id: "clozapine-table-1",
      document_id: "clozapine-doc",
      title: "Clozapine Monitoring",
      file_name: "CG.MHSP.ClozapinePresAdminMonitor.pdf",
      page_number: 6,
      section_heading: "Roles and responsibilities",
      content:
        "Table detailing roles and responsibilities in Clozapine therapy monitoring including discontinuation criteria for red-range blood results. clinical_table table_crop Roles and responsibilities: If the consumer's blood results return in the red range, Clozapine therapy must be discontinued immediately and reported to the patient monitoring system.",
      similarity: 0.95,
      hybrid_score: 0.95,
      text_rank: 1.3,
      memory_cards: [
        {
          id: "memory-table-1",
          document_id: "clozapine-doc",
          owner_id: null,
          card_type: "table_row",
          title: "Clozapine red range action",
          content:
            "Table detailing roles and responsibilities in Clozapine therapy monitoring. clinical_table table_crop Roles and responsibilities: If the consumer's blood results return in the red range, Clozapine therapy must be discontinued immediately and reported to the patient monitoring system.",
          normalized_terms: ["clozapine", "monitoring", "red", "range"],
          page_number: 6,
          source_chunk_ids: ["clozapine-table-1"],
          source_image_ids: [],
          confidence: 0.93,
        },
      ],
    });
    const rpc = vi.fn(async (name: string) => {
      if (name === "match_document_chunks_text") return { data: [clozapineTableSource], error: null };
      if (name === "get_related_document_metadata") return { data: [], error: null };
      return { data: [], error: null };
    });

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        rpc,
        from: vi.fn(() => new EmptyQuery()),
      }),
    }));
    vi.doMock("@/lib/openai", () => ({
      embedTextWithTelemetry: vi.fn(),
      generateStructuredTextResult: vi.fn(),
    }));

    const { answerQuestionWithScope } = await import("../src/lib/rag");

    const answer = await answerQuestionWithScope({
      query: "what clozapine monitoring action is needed for red range blood results",
      ownerId: undefined,
      logQuery: false,
      skipCache: true,
    });

    const plainAnswer = answer.answer.replace(/\*\*/g, "");
    expect(plainAnswer).toContain("must be discontinued immediately");
    expect(plainAnswer).not.toContain("Table detailing roles and responsibilities");
    expect(plainAnswer).not.toContain("clinical_table");
    expect(plainAnswer).not.toContain("table_crop");
  });

  it("returns an extractive source-backed answer when structured model output is truncated", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_MAX_OUTPUT_TOKENS", "650");
    vi.stubEnv("RAG_SEARCH_CACHE_TTL_MS", "0");
    vi.stubEnv("RAG_ANSWER_CACHE_TTL_MS", "0");

    const sources = [source(), source({ id: "agitation-chunk-2", page_number: 10, chunk_index: 1 })];
    const rpc = vi.fn(async (name: string) => {
      if (name === "match_document_chunks_text") return { data: sources, error: null };
      if (name === "get_related_document_metadata") return { data: [], error: null };
      return { data: [], error: null };
    });
    const generateStructuredTextResult = vi.fn(async () => ({
      text: '{"answer":"Agitation and arousal management starts',
      model: "gpt-4.1-mini",
      operation: "answer",
      latencyMs: 12,
      requestId: "req_truncated",
      usage: { input_tokens: 100, output_tokens: 650, total_tokens: 750 },
    }));

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        rpc,
        from: vi.fn(() => new EmptyQuery()),
      }),
    }));
    vi.doMock("@/lib/openai", () => ({
      embedTextWithTelemetry: vi.fn(),
      generateStructuredTextResult,
    }));

    const { answerQuestionWithScope, machineReadableFallbackAnswer } = await import("../src/lib/rag");

    const answer = await answerQuestionWithScope({
      query: "Summarize inpatient approach",
      ownerId: undefined,
      logQuery: false,
      skipCache: true,
    });

    expect(answer.answer).not.toBe(machineReadableFallbackAnswer);
    expect(answer.answer.toLowerCase()).toContain("agitation and arousal");
    expect(answer.grounded).toBe(true);
    expect(answer.citations.length).toBeGreaterThan(0);
    expect(answer.quoteCards?.length).toBeGreaterThan(0);
    expect(answer.routingMode).toBe("extractive");
    expect(answer.routingReason).toContain("structured_output_fallback");
    expect(answer.openAIRequestIds).toEqual(["req_truncated"]);
    expect(answer.openAIUsage).toMatchObject({ output_tokens: 650 });
    expect(answer.citations[0]?.source_metadata?.document_status).toBe("current");
  });

  it("keeps valid structured model answers on the generated-answer path", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("RAG_SEARCH_CACHE_TTL_MS", "0");
    vi.stubEnv("RAG_ANSWER_CACHE_TTL_MS", "0");

    const sources = [source()];
    const rpc = vi.fn(async (name: string) => {
      if (name === "match_document_chunks_text") return { data: sources, error: null };
      if (name === "get_related_document_metadata") return { data: [], error: null };
      return { data: [], error: null };
    });
    const generateStructuredTextResult = vi.fn(async () => ({
      text: JSON.stringify({
        answer: "Use a stepwise agitation and arousal approach based on rating and route.",
        grounded: true,
        confidence: "high",
        answerSections: [
          {
            heading: "Bottom line",
            body: "Use a stepwise agitation and arousal approach based on rating and route.",
            citation_chunk_ids: ["agitation-chunk-1"],
          },
        ],
        citations: [{ chunk_id: "agitation-chunk-1" }],
        quoteCards: [
          {
            chunk_id: "agitation-chunk-1",
            quote: "Agitation and arousal pharmacological management for adult mental health inpatients.",
            section_heading: "Appendix 1",
          },
        ],
        conflictsOrGaps: [],
      }),
      model: "gpt-4.1-mini",
      operation: "answer",
      latencyMs: 12,
      requestId: "req_valid",
      usage: { input_tokens: 100, output_tokens: 120, total_tokens: 220 },
    }));

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        rpc,
        from: vi.fn(() => new EmptyQuery()),
      }),
    }));
    vi.doMock("@/lib/openai", () => ({
      embedTextWithTelemetry: vi.fn(),
      generateStructuredTextResult,
    }));

    const { answerQuestionWithScope } = await import("../src/lib/rag");

    const answer = await answerQuestionWithScope({
      query: "Summarize inpatient approach",
      ownerId: undefined,
      logQuery: false,
      skipCache: true,
    });

    expect(answer.answer).toBe("Use a stepwise agitation and arousal approach based on rating and route.");
    expect(answer.routingMode).toBe("fast");
    expect(answer.routingReason).not.toContain("structured_output_fallback");
    expect(answer.openAIRequestIds).toEqual(["req_valid"]);
    expect(answer.quoteCards?.length).toBe(1);
  });

  it("keeps the confidence gate active for weak ambiguous retrieval", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("RAG_SEARCH_CACHE_TTL_MS", "0");
    vi.stubEnv("RAG_ANSWER_CACHE_TTL_MS", "0");

    const sources = [
      source({
        id: "weak-general-1",
        document_id: "doc-1",
        title: "Ward Process",
        file_name: "ward-process.pdf",
        content: "Discharge planning documentation is briefly mentioned alongside general administrative notes.",
        similarity: 0.6,
        hybrid_score: 0.6,
        text_rank: 0.06,
      }),
      source({
        id: "weak-general-2",
        document_id: "doc-2",
        title: "General Overview",
        file_name: "overview.pdf",
        content: "Planning tasks and review notes are listed without specific admission or discharge guidance.",
        similarity: 0.58,
        hybrid_score: 0.58,
        text_rank: 0.05,
      }),
    ];
    const rpc = vi.fn(async (name: string) => {
      if (name === "match_document_chunks_text") return { data: sources, error: null };
      if (name === "get_related_document_metadata") return { data: [], error: null };
      return { data: [], error: null };
    });
    const generateStructuredTextResult = vi.fn();

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        rpc,
        from: vi.fn(() => new EmptyQuery()),
      }),
    }));
    vi.doMock("@/lib/openai", () => ({
      embedTextWithTelemetry: vi.fn(),
      generateStructuredTextResult,
    }));

    const { answerQuestionWithScope } = await import("../src/lib/rag");

    const answer = await answerQuestionWithScope({
      query: "How is discharge planning handled?",
      ownerId: undefined,
      logQuery: false,
      skipCache: true,
    });

    expect(answer.routingMode).toBe("unsupported");
    expect(answer.routingReason).toContain("confidence_gate_blocked");
    expect(answer.retrievalDiagnostics).toMatchObject({
      gateStatus: "blocked",
      fallbackReason: "low_signal_document_lookup_strong",
    });
    expect(answer.grounded).toBe(false);
    expect(answer.citations).toHaveLength(0);
    expect(generateStructuredTextResult).not.toHaveBeenCalled();
  });

  it("continues hybrid chunk retrieval when index-unit hybrid retrieval times out", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("RAG_SEARCH_CACHE_TTL_MS", "0");

    const hybridSource = source({
      id: "hybrid-fallback-chunk",
      title: "Monitoring Requirements",
      content: "Monitoring requirements are documented here.",
      similarity: 0.81,
      hybrid_score: 0.88,
      text_rank: 0.7,
    });
    const rpc = vi.fn(async (name: string) => {
      if (name === "match_document_chunks_text") return { data: [], error: null };
      if (name === "match_document_table_facts_text") return { data: [], error: null };
      if (name === "match_document_embedding_fields_hybrid") return { data: [], error: null };
      if (name === "match_document_index_units_hybrid") {
        return { data: null, error: { message: "canceling statement due to statement timeout" } };
      }
      if (name === "match_document_chunks_hybrid") return { data: [hybridSource], error: null };
      if (name === "match_document_memory_cards_hybrid") return { data: [], error: null };
      if (name === "get_related_document_metadata") return { data: [], error: null };
      return { data: [], error: null };
    });

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        rpc,
        from: vi.fn(() => new EmptyQuery()),
      }),
    }));
    vi.doMock("@/lib/openai", () => ({
      embedTextWithTelemetry: vi.fn(async () => ({ embedding: Array(1536).fill(0.01), cacheHit: false })),
      generateStructuredTextResult: vi.fn(),
    }));

    const { searchChunksWithTelemetry } = await import("../src/lib/rag");

    const search = await searchChunksWithTelemetry({
      query: "monitoring requirements",
      topK: 4,
      allowGlobalSearch: true,
    });

    expect(rpc).toHaveBeenCalledWith("match_document_index_units_hybrid", expect.any(Object));
    expect(rpc).toHaveBeenCalledWith("match_document_chunks_hybrid", expect.any(Object));
    expect(search.results.map((result) => result.id)).toContain("hybrid-fallback-chunk");
    expect(search.telemetry.index_unit_count).toBe(0);
    expect(search.telemetry.index_unit_top_score).toBe(0);
    expect(search.telemetry.retrieval_strategy).toBe("hybrid");
  });
});
