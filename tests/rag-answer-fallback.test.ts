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

type GeneratedAnswerPayload = {
  answer: string;
  grounded: boolean;
  confidence: "high" | "medium" | "low" | "unsupported";
  answerSections?: unknown[];
  citations?: Array<{ chunk_id: string }>;
  quoteCards?: unknown[];
  conflictsOrGaps?: unknown[];
};

async function answerFromTextSources(
  query: string,
  sources: SearchResult[],
  generatedAnswer?: GeneratedAnswerPayload | Error,
) {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubEnv("RAG_SEARCH_CACHE_TTL_MS", "0");
  vi.stubEnv("RAG_ANSWER_CACHE_TTL_MS", "0");

  const rpc = vi.fn(async (name: string) => {
    if (name === "match_document_chunks_text") return { data: sources, error: null };
    if (name === "get_related_document_metadata") return { data: [], error: null };
    return { data: [], error: null };
  });

  vi.doMock("@/lib/supabase/admin", () => ({
    createAdminClient: () => ({
      rpc,
      from: vi.fn(() => new EmptyQuery()),
    }),
  }));
  const generateStructuredTextResult = vi.fn(async () => {
    if (generatedAnswer instanceof Error) throw generatedAnswer;
    return {
      text: JSON.stringify(
        generatedAnswer ?? {
          answer: "No current source with specific guidance for this query was found.",
          grounded: false,
          confidence: "unsupported",
          answerSections: [],
          citations: [],
          quoteCards: [],
          conflictsOrGaps: [],
        },
      ),
      model: "gpt-4.1-mini",
      operation: "answer",
      latencyMs: 12,
      requestId: "req_answer_from_text_sources",
      usage: { input_tokens: 120, output_tokens: 80, total_tokens: 200 },
    };
  });

  vi.doMock("@/lib/openai", () => ({
    embedTextWithTelemetry: vi.fn(),
    generateStructuredTextResult,
  }));

  const { answerQuestionWithScope } = await import("../src/lib/rag");
  return answerQuestionWithScope({
    query,
    ownerId: undefined,
    logQuery: false,
    skipCache: true,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe("RAG structured-output fallback", () => {
  it("keeps table-threshold questions on fact synthesis instead of source lookup", async () => {
    const answer = await answerFromTextSources("What ANC threshold does the clozapine table show?", [
      source({
        id: "clozapine-threshold-chunk",
        document_id: "clozapine-doc",
        title: "Clozapine Monitoring",
        file_name: "Clozapine Monitoring.pdf",
        page_number: 4,
        section_heading: "ANC thresholds",
        content: "Clozapine ANC threshold table: below 1.5 x 10^9/L, withhold clozapine and repeat FBC.",
        table_facts: [
          {
            id: "fact-anc-threshold",
            document_id: "clozapine-doc",
            source_chunk_id: "clozapine-threshold-chunk",
            source_image_id: null,
            page_number: 4,
            table_title: "Clozapine ANC thresholds",
            row_label: "ANC below 1.5",
            clinical_parameter: "ANC",
            threshold_value: "below 1.5 x 10^9/L",
            action: "Withhold clozapine and repeat FBC.",
          },
        ],
      }),
    ]);

    expect(answer.answer).toContain("1.5 x 10^9/L");
    // Strip bold markers first: values-only bolding emphasises escalation verbs ("**withhold**").
    expect(answer.answer.replace(/\*\*/g, "")).toMatch(/withhold clozapine/i);
    expect(answer.answer).not.toContain("The relevant source is");
  });

  it("uses model synthesis for strong source answers instead of packed source-card labels", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_ANSWER_TIMEOUT_MS", "4321");
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
    const generateStructuredTextResult = vi.fn(async () => ({
      text: JSON.stringify({
        answer:
          "Clozapine monitoring requires supported initiation documentation and completion of the Clozapine Monitoring Form.",
        grounded: true,
        confidence: "high",
        answerSections: [
          {
            heading: "Monitoring documents",
            kind: "documentation",
            supportLevel: "direct",
            body: "Use consent documentation, initiation/titration prescribing, and the Clozapine Monitoring Form during clozapine initiation.",
            citation_chunk_ids: ["clozapine-monitoring-1"],
          },
        ],
        citations: [{ chunk_id: "clozapine-monitoring-1" }],
        quoteCards: [
          {
            chunk_id: "clozapine-monitoring-1",
            quote: "Ensure consumers complete the Clozapine Monitoring Form on initiation.",
            section_heading: "Monitoring",
          },
        ],
        conflictsOrGaps: [],
      }),
      model: "gpt-4.1-mini",
      operation: "answer",
      latencyMs: 12,
      requestId: "req_model_synthesis",
      usage: { input_tokens: 120, output_tokens: 90, total_tokens: 210 },
    }));

    vi.doMock("@/lib/openai", () => ({
      embedTextWithTelemetry: vi.fn(async () => ({ embedding: [0.1, 0.2, 0.3], cacheHit: false })),
      generateStructuredTextResult,
    }));

    const { answerQuestionWithScope } = await import("../src/lib/rag");

    const answer = await answerQuestionWithScope({
      query: "what monitoring is required for clozapine",
      ownerId: undefined,
      logQuery: false,
      skipCache: true,
    });

    expect(generateStructuredTextResult).toHaveBeenCalledTimes(1);
    const answerCalls = generateStructuredTextResult.mock.calls as unknown as Array<
      [string, unknown, { timeoutMs?: number }]
    >;
    const answerInput = answerCalls[0]?.[0] ?? "";
    expect(answerCalls[0]?.[2]).toMatchObject({ timeoutMs: 4321 });
    expect(answerInput).toContain("answer_plan.intent: clinical_synthesis");
    expect(answerInput).toContain("answer_plan.route_mode: fast");
    expect(answerInput).toContain("answer_plan.model_strategy: fast_model_then_quality_gate");
    expect(answerInput).toContain("answer_plan.source_policy: required_citations");
    expect(answer.routingMode).toBe("fast");
    expect(answer.routingReason).toContain("clinical_fast_grounded_synthesis");
    expect(answer.smartApiPlan?.answerPlan).toMatchObject({
      intent: "clinical_synthesis",
      routeMode: "fast",
      modelStrategy: "fast_model_then_quality_gate",
      sourcePolicy: "required_citations",
    });
    expect(answer.answer.replace(/\*\*/g, "")).toMatch(/clozapine Monitoring Form/i);
    expect(answer.answer).not.toContain("- Medication point");
    expect(answer.answer).not.toMatch(/Medication point:.*Medication point:/);
    expect(answer.answerSections?.[0]?.heading).toBe("Monitoring documents");
  });

  it("preserves grounded source-backed answers when only the overlap heuristic is recoverable", async () => {
    const answer = await answerFromTextSources(
      "What is the long acting injectable pathway?",
      [
        source({
          id: "lai-pathway-1",
          document_id: "lai-doc",
          title: "Long Acting Injectable Antipsychotic Pathway",
          file_name: "MHSP.LongActingInjectableAntipsychoticPathway.pdf",
          section_heading: "Depot pathway",
          content: "Long acting injectable antipsychotic pathway guidance for depot reviews.",
          match_explanation: { titleHit: true, contentHit: true, reasons: ["title"] },
        }),
      ],
      {
        answer: "Depot antipsychotic follow-up is covered by the cited local pathway.",
        grounded: true,
        confidence: "low",
        answerSections: [],
        citations: [{ chunk_id: "lai-pathway-1" }],
        quoteCards: [],
        conflictsOrGaps: [],
      },
    );

    expect(answer.grounded).toBe(true);
    expect(answer.confidence).toBe("medium");
    expect(answer.routingReason).toContain("final_quality_gate_source_backed_recovery:missing_query_overlap");
    expect(answer.answer).not.toMatch(/not enough source evidence|No current source/i);
  });

  it("recovers generation timeouts with an extractive source-backed answer when sources are strong", async () => {
    const answer = await answerFromTextSources(
      "How should agitation be managed when oral medication is refused?",
      [
        source({
          id: "agitation-table-1",
          title: "Agitation And Arousal Pharmacological Management(AKG)",
          file_name: "Agitation and Arousal Pharmacological Management (AKG).pdf",
          section_heading: "Appendix V: Agitation and Arousal PRN Medication",
          content:
            "Agitation is managed by using IM medication when oral medication is refused, with review and monitoring.",
          match_explanation: { titleHit: true, contentHit: true, tableHit: true, reasons: ["title", "table"] },
          table_facts: [
            {
              id: "fact-agitation-table",
              document_id: "agitation-doc",
              source_chunk_id: "agitation-table-1",
              source_image_id: "image-agitation-table",
              page_number: 11,
              table_title: "Agitation and arousal pharmacological management",
              row_label: "PRN medication",
              clinical_parameter: "Medication table",
              threshold_value: null,
              action: "Use IM medication when oral medication is refused, with review and monitoring.",
            },
          ],
        }),
      ],
      new Error("OpenAI timed out. Trying source-only fallback response."),
    );

    expect(answer.routingMode).toBe("extractive");
    expect(answer.routingReason).toContain("source_backed_extractive_fallback");
    expect(answer.grounded).toBe(true);
    expect(answer.answer).toMatch(/IM medication|oral medication|agitation/i);
  });

  it("returns a grounded document-support fallback for procedure queries when no clean fact can be synthesized", async () => {
    const answer = await answerFromTextSources(
      "What is the process for ECT procedure?",
      [
        source({
          id: "ect-procedure-1",
          document_id: "ect-doc",
          title: "ECT Procedure",
          file_name: "ECT Procedure (AKG).pdf",
          section_heading: "Procedure flowchart",
          content: "Procedure flowchart records and rostered ECT team coordination.",
          similarity: 0.9,
          hybrid_score: 0.9,
          match_explanation: { titleHit: true, contentHit: true, reasons: ["document_title"] },
        }),
      ],
      new Error("OpenAI timed out. Trying source-only fallback response."),
    );

    expect(answer.routingMode).toBe("extractive");
    expect(answer.routingReason).toMatch(/source_backed_(?:extractive|review)_fallback/);
    expect(answer.grounded).toBe(true);
    expect(answer.citations.length).toBeGreaterThan(0);
    expect(answer.answer).toMatch(/source support|indexed document|supports this query|ECT Procedure/i);
  });

  it("retries template-like fast answers with the strong model before returning", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("RAG_SEARCH_CACHE_TTL_MS", "0");
    vi.stubEnv("RAG_ANSWER_CACHE_TTL_MS", "0");

    const clozapineSource = source({
      id: "clozapine-monitoring-template-1",
      document_id: "clozapine-doc",
      title: "Clozapine Monitoring",
      file_name: "CG.MHSP.ClozapinePresAdminMonitor.pdf",
      page_number: 11,
      section_heading: "Monitoring",
      content:
        "Copy the Consent to Clozapine Treatment Form EMR0270, prescribe initiation on the WA Adult Clozapine Initiation and Titration form, and ensure consumers complete the Clozapine Monitoring Form on initiation.",
      similarity: 0.94,
      hybrid_score: 0.94,
      text_rank: 1.2,
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
    const generateStructuredTextResult = vi
      .fn()
      .mockResolvedValueOnce({
        text: JSON.stringify({
          answer: "The retrieved source supports clozapine monitoring documentation during initiation.",
          grounded: true,
          confidence: "high",
          answerSections: [
            {
              heading: "Monitoring documents",
              kind: "documentation",
              supportLevel: "direct",
              body: "The retrieved source supports consent documentation and completion of the Clozapine Monitoring Form.",
              citation_chunk_ids: ["clozapine-monitoring-template-1"],
            },
          ],
          citations: [{ chunk_id: "clozapine-monitoring-template-1" }],
          quoteCards: [
            {
              chunk_id: "clozapine-monitoring-template-1",
              quote: "ensure consumers complete the Clozapine Monitoring Form on initiation.",
              section_heading: "Monitoring",
            },
          ],
          conflictsOrGaps: [],
        }),
        model: "gpt-4.1-mini",
        operation: "answer",
        latencyMs: 12,
        requestId: "req_fast_template",
        usage: { input_tokens: 120, output_tokens: 80, total_tokens: 200 },
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          answer:
            "Clozapine initiation requires consent documentation, initiation/titration prescribing, and completion of the **Clozapine Monitoring Form**.",
          grounded: true,
          confidence: "high",
          answerSections: [
            {
              heading: "Documentation",
              kind: "documentation",
              supportLevel: "direct",
              body: "Complete the consent form, prescribe initiation on the WA Adult Clozapine Initiation and Titration form, and complete the monitoring form at initiation.",
              citation_chunk_ids: ["clozapine-monitoring-template-1"],
            },
          ],
          citations: [{ chunk_id: "clozapine-monitoring-template-1" }],
          quoteCards: [
            {
              chunk_id: "clozapine-monitoring-template-1",
              quote: "ensure consumers complete the Clozapine Monitoring Form on initiation.",
              section_heading: "Monitoring",
            },
          ],
          conflictsOrGaps: [],
        }),
        model: "gpt-4.1",
        operation: "answer",
        latencyMs: 24,
        requestId: "req_strong_natural",
        usage: { input_tokens: 160, output_tokens: 100, total_tokens: 260 },
      });

    vi.doMock("@/lib/openai", () => ({
      embedTextWithTelemetry: vi.fn(),
      generateStructuredTextResult,
    }));

    const { answerQuestionWithScope } = await import("../src/lib/rag");

    const answer = await answerQuestionWithScope({
      query: "what monitoring is required for clozapine",
      ownerId: undefined,
      logQuery: false,
      skipCache: true,
    });

    expect(generateStructuredTextResult).toHaveBeenCalledTimes(2);
    expect(answer.routingMode).toBe("strong");
    expect(answer.routingReason).toContain("fast_template_retry_strong");
    expect(answer.openAIRequestIds ?? []).toEqual(["req_fast_template", "req_strong_natural"]);
    expect(answer.grounded).toBe(true);
    expect(answer.confidence).toBe("medium");
    expect(answer.responseMode).toBe("clinical_pathway");
    expect(answer.answer.replace(/\*\*/g, "")).toMatch(/Clozapine initiation requires/i);
    expect(answer.answer).not.toMatch(/retrieved source|source-backed|based on the provided excerpts/i);
    expect(answer.answerSections?.[0]?.heading).toBe("Documentation");
  });

  it("retries over-expanded fast answers for simple direct questions", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("RAG_SEARCH_CACHE_TTL_MS", "0");
    vi.stubEnv("RAG_ANSWER_CACHE_TTL_MS", "0");

    const bulimiaSource = source({
      id: "bulimia-definition-1",
      document_id: "bulimia-doc",
      title: "Bulimia Nervosa",
      file_name: "bulimia-nervosa.pdf",
      page_number: 1,
      section_heading: "Overview",
      content:
        "Bulimia nervosa is an eating disorder with recurrent binge eating and compensatory behaviours. The guideline also discusses CBT, nutritional support, monitoring, and referral.",
      similarity: 0.94,
      hybrid_score: 0.94,
      text_rank: 1.2,
    });
    const rpc = vi.fn(async (name: string) => {
      if (name === "match_document_chunks_text") return { data: [bulimiaSource], error: null };
      if (name === "get_related_document_metadata") return { data: [], error: null };
      return { data: [], error: null };
    });

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        rpc,
        from: vi.fn(() => new EmptyQuery()),
      }),
    }));
    const generateStructuredTextResult = vi
      .fn()
      .mockResolvedValueOnce({
        text: JSON.stringify({
          queryClass: "unsupported_or_general",
          confidence: 0.4,
          reasons: ["direct definition question"],
          expandedTerms: ["bulimia nervosa"],
        }),
        model: "gpt-4.1-mini",
        operation: "text_generation",
        latencyMs: 6,
        requestId: "req_classifier",
        usage: { input_tokens: 80, output_tokens: 20, total_tokens: 100 },
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          answer:
            "Bulimia nervosa is an eating disorder involving recurrent binge eating and compensatory behaviours. Management includes CBT, nutritional support, medication options, monitoring, and referral when risks are present.",
          grounded: true,
          confidence: "high",
          answerSections: [
            {
              heading: "Management",
              kind: "required_actions",
              supportLevel: "direct",
              body: "CBT and nutritional support are central treatments.",
              citation_chunk_ids: ["bulimia-definition-1"],
            },
            {
              heading: "Monitoring",
              kind: "required_actions",
              supportLevel: "direct",
              body: "Monitoring and referral are required when clinical risks are present.",
              citation_chunk_ids: ["bulimia-definition-1"],
            },
          ],
          citations: [{ chunk_id: "bulimia-definition-1" }],
          quoteCards: [
            {
              chunk_id: "bulimia-definition-1",
              quote: "Bulimia nervosa is an eating disorder with recurrent binge eating and compensatory behaviours.",
              section_heading: "Overview",
            },
          ],
          conflictsOrGaps: [],
        }),
        model: "gpt-4.1-mini",
        operation: "answer",
        latencyMs: 12,
        requestId: "req_fast_overexpanded",
        usage: { input_tokens: 120, output_tokens: 120, total_tokens: 240 },
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          answer:
            "Bulimia nervosa is an eating disorder involving recurrent binge eating followed by compensatory behaviours.",
          grounded: true,
          confidence: "high",
          answerSections: [],
          citations: [{ chunk_id: "bulimia-definition-1" }],
          quoteCards: [
            {
              chunk_id: "bulimia-definition-1",
              quote: "Bulimia nervosa is an eating disorder with recurrent binge eating and compensatory behaviours.",
              section_heading: "Overview",
            },
          ],
          conflictsOrGaps: [],
        }),
        model: "gpt-4.1",
        operation: "answer",
        latencyMs: 24,
        requestId: "req_strong_concise",
        usage: { input_tokens: 150, output_tokens: 60, total_tokens: 210 },
      });

    vi.doMock("@/lib/openai", () => ({
      embedTextWithTelemetry: vi.fn(),
      generateStructuredTextResult,
    }));

    const { answerQuestionWithScope } = await import("../src/lib/rag");

    const answer = await answerQuestionWithScope({
      query: "what is bulimia nervosa",
      ownerId: undefined,
      logQuery: false,
      skipCache: true,
    });

    expect(generateStructuredTextResult).toHaveBeenCalledTimes(3);
    expect(answer.routingMode).toBe("strong");
    expect(answer.routingReason).toContain("fast_overexpanded_simple_retry_strong");
    expect(answer.openAIRequestIds ?? []).toEqual(["req_fast_overexpanded", "req_strong_concise"]);
    expect(answer.answer.replace(/\*\*/g, "")).toContain("Bulimia nervosa is an eating disorder");
    expect(answer.smartApiPlan?.answerPlan.intent).toBe("clinical_synthesis");
  });

  it("records fast-template and strong-quality retry telemetry", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("RAG_SEARCH_CACHE_TTL_MS", "0");
    vi.stubEnv("RAG_ANSWER_CACHE_TTL_MS", "0");
    vi.stubEnv("RAG_AWAIT_QUERY_LOGS", "true");

    const firstSource = source({
      id: "template-retry-1",
      document_id: "document-a",
      title: "Document Monitoring Pathway Guide A",
      file_name: "document-monitoring-pathway-guide-a.pdf",
      page_number: 3,
      section_heading: "Monitoring pathway",
      content:
        "Guide A defines document monitoring pathways, routine review intervals, safety checks, and referral thresholds for comparison across guides.",
      similarity: 0.96,
      hybrid_score: 0.96,
      text_rank: 1.1,
    });

    const secondSource = source({
      id: "template-retry-2",
      document_id: "document-b",
      title: "Document Monitoring Pathway Guide B",
      file_name: "document-monitoring-pathway-guide-b.pdf",
      page_number: 4,
      section_heading: "Monitoring pathway",
      content:
        "Guide B describes a second document monitoring pathway with review frequency, escalation triggers, and referral thresholds for comparison.",
      similarity: 0.92,
      hybrid_score: 0.92,
      text_rank: 1.0,
    });

    const rpc = vi.fn(async (name: string) => {
      if (name === "match_document_chunks_text") return { data: [firstSource, secondSource], error: null };
      if (name === "get_related_document_metadata") return { data: [], error: null };
      return { data: [], error: null };
    });

    const generateStructuredTextResult = vi
      .fn()
      .mockResolvedValueOnce({
        text: JSON.stringify({
          answer:
            "This is a Direct source-backed answer derived from the retrieved sources and structured for the same citations.",
          grounded: false,
          confidence: "low",
          answerSections: [
            {
              heading: "Direct source-backed answer",
              kind: "documentation",
              supportLevel: "direct",
              body: "Use the retrieved evidence to guide a routine review.",
              citation_chunk_ids: ["template-retry-1"],
            },
          ],
          citations: [{ chunk_id: "template-retry-1" }],
          quoteCards: [
            {
              chunk_id: "template-retry-1",
              quote:
                "Retrieved source supports that this document defines the first-line management of a condition and associated safety checks.",
              section_heading: "Summary",
            },
          ],
          conflictsOrGaps: [],
        }),
        model: "gpt-5.4-mini",
        operation: "answer",
        latencyMs: 12,
        requestId: "req_fast_template",
        usage: { input_tokens: 80, output_tokens: 90, total_tokens: 170 },
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          answer: "Source-backed summaries mention management steps and review intervals.",
          grounded: true,
          confidence: "high",
          answerSections: [],
          citations: [{ chunk_id: "template-retry-1" }],
          quoteCards: [
            {
              chunk_id: "template-retry-1",
              quote: "Retrieved source supports that this document defines the first-line management.",
              section_heading: "Summary",
            },
          ],
          conflictsOrGaps: [],
        }),
        model: "gpt-5.5",
        operation: "answer",
        latencyMs: 18,
        requestId: "req_strong_template",
        usage: { input_tokens: 140, output_tokens: 120, total_tokens: 260 },
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          answer:
            "Compare the guide pathways by using routine review intervals, escalation triggers, and urgent referral thresholds.",
          grounded: true,
          confidence: "high",
          answerSections: [
            {
              heading: "Monitoring",
              kind: "required_actions",
              supportLevel: "direct",
              body: "Review the pathway criteria regularly and escalate when safety checks or referral thresholds are met.",
              citation_chunk_ids: ["template-retry-2"],
            },
          ],
          citations: [{ chunk_id: "template-retry-2" }],
          quoteCards: [
            {
              chunk_id: "template-retry-2",
              quote:
                "Guide B describes a second document monitoring pathway with review frequency, escalation triggers, and referral thresholds for comparison.",
              section_heading: "Monitoring",
            },
          ],
          conflictsOrGaps: [],
        }),
        model: "gpt-5.5",
        operation: "answer",
        latencyMs: 14,
        requestId: "req_strong_quality",
        usage: { input_tokens: 170, output_tokens: 120, total_tokens: 290 },
      });

    const insert = vi.fn(async () => ({ data: null, error: null }));
    const from = vi.fn((table: string) => (table === "rag_queries" ? { insert } : new EmptyQuery()));

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        rpc,
        from,
      }),
    }));
    vi.doMock("@/lib/openai", () => ({
      embedTextWithTelemetry: vi.fn(async () => ({ embedding: [0.1, 0.2, 0.3], cacheHit: false })),
      generateStructuredTextResult,
    }));

    const { answerQuestionWithScope } = await import("../src/lib/rag");

    const answer = await answerQuestionWithScope({
      query: "Compare document monitoring pathways across two guides",
      ownerId: undefined,
      skipCache: true,
    });

    expect(generateStructuredTextResult).toHaveBeenCalledTimes(3);
    expect(answer.routingMode).toBe("strong");
    expect(answer.latencyTimings?.answer_retry_count).toBe(2);
    expect(answer.latencyTimings?.answer_retry_reasons).toEqual(["fast_template_retry_strong", "strong_quality_retry"]);
    expect(answer.routingReason).toContain("fast_template_retry_strong");
    expect(answer.routingReason).toContain("strong_quality_retry");
    expect(answer.openAIRequestIds).toEqual(["req_fast_template", "req_strong_template", "req_strong_quality"]);
    expect(insert).toHaveBeenCalledTimes(1);
    const insertCalls = insert.mock.calls as unknown as Array<[{ metadata?: Record<string, unknown> }]>;
    const loggedMetadata = insertCalls[0]?.[0]?.metadata ?? {};
    expect(loggedMetadata.answer_retry_count).toBe(2);
    expect(loggedMetadata.answer_retry_reasons).toEqual(["fast_template_retry_strong", "strong_quality_retry"]);
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
    const generateStructuredTextResult = vi.fn(async () => ({
      text: JSON.stringify({
        answer:
          "For red-range blood results during clozapine therapy, clozapine therapy must be discontinued immediately and reported to the patient monitoring system.",
        grounded: true,
        confidence: "high",
        answerSections: [
          {
            heading: "Required action",
            kind: "required_actions",
            supportLevel: "direct",
            body: "Red-range blood results require immediate discontinuation of clozapine therapy and reporting to the monitoring system.",
            citation_chunk_ids: ["clozapine-table-1"],
          },
        ],
        citations: [{ chunk_id: "clozapine-table-1" }],
        quoteCards: [
          {
            chunk_id: "clozapine-table-1",
            quote:
              "If the consumer's blood results return in the red range, Clozapine therapy must be discontinued immediately and reported to the patient monitoring system.",
            section_heading: "Roles and responsibilities",
          },
        ],
        conflictsOrGaps: [],
      }),
      model: "gpt-4.1-mini",
      operation: "answer",
      latencyMs: 12,
      requestId: "req_table_synthesis",
      usage: { input_tokens: 130, output_tokens: 100, total_tokens: 230 },
    }));

    vi.doMock("@/lib/openai", () => ({
      embedTextWithTelemetry: vi.fn(),
      generateStructuredTextResult,
    }));

    const { answerQuestionWithScope } = await import("../src/lib/rag");

    const answer = await answerQuestionWithScope({
      query: "what clozapine monitoring action is needed for red range blood results",
      ownerId: undefined,
      logQuery: false,
      skipCache: true,
    });

    const plainAnswer = answer.answer.replace(/\*\*/g, "");
    expect(generateStructuredTextResult).toHaveBeenCalledTimes(1);
    expect(answer.routingMode).toBe("strong");
    expect(plainAnswer).toContain("must be discontinued immediately");
    expect(plainAnswer).not.toContain("Table detailing roles and responsibilities");
    expect(plainAnswer).not.toContain("clinical_table");
    expect(plainAnswer).not.toContain("table_crop");
  });

  it("retries malformed fast output and fails closed after strong generation also fails", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_MAX_OUTPUT_TOKENS", "650");
    vi.stubEnv("RAG_SEARCH_CACHE_TTL_MS", "0");
    vi.stubEnv("RAG_ANSWER_CACHE_TTL_MS", "0");

    const sources = [
      source({
        content:
          "Inpatient approach details for agitation and arousal management include oral medication when the patient is willing, increased observation when ratings rise, and intramuscular medication when oral medication is refused.",
      }),
      source({
        id: "agitation-chunk-2",
        page_number: 10,
        chunk_index: 1,
        content:
          "Inpatient approach details include review of route, rating severity, escalation triggers, and monitoring after medication administration.",
      }),
    ];
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
      embedTextWithTelemetry: vi.fn(async () => ({ embedding: [0.1, 0.2, 0.3], cacheHit: false })),
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
    expect(answer.routingMode).toBe("strong");
    expect(answer.grounded).toBe(false);
    expect(answer.confidence).toBe("unsupported");
    expect(answer.responseMode).toBe("evidence_gap");
    expect(answer.citations).toEqual([]);
    expect(answer.quoteCards?.length).toBeGreaterThan(0);
    expect(answer.routingReason).toContain("final_quality_gate");
    expect(generateStructuredTextResult).toHaveBeenCalledTimes(3);
    expect(answer.openAIRequestIds).toEqual(["req_truncated", "req_truncated", "req_truncated"]);
    expect(answer.openAIUsage).toMatchObject({ output_tokens: 1950 });
    expect(answer.latencyTimings?.answer_retry_count).toBe(2);
    expect(answer.latencyTimings?.answer_retry_reasons).toEqual([
      "fast_unsupported_retry_strong",
      "strong_quality_retry",
    ]);
  });

  it("keeps valid structured model answers on the generated-answer path", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("RAG_SEARCH_CACHE_TTL_MS", "0");
    vi.stubEnv("RAG_ANSWER_CACHE_TTL_MS", "0");

    const sources = [
      source({
        content:
          "Inpatient approach details for agitation and arousal management include a stepwise approach based on rating severity, route, oral options, and intramuscular options.",
      }),
    ];
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
            heading: "Approach",
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
      embedTextWithTelemetry: vi.fn(async () => ({ embedding: [0.1, 0.2, 0.3], cacheHit: false })),
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

  it("coalesces identical scoped answer requests before OpenAI generation", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("RAG_SEARCH_CACHE_TTL_MS", "0");
    vi.stubEnv("RAG_ANSWER_CACHE_TTL_MS", "300000");
    vi.stubEnv("RAG_ANSWER_CACHE_SIZE", "100");

    const sources = [
      source({
        content:
          "Inpatient approach details for agitation and arousal management include a stepwise approach based on rating severity, route, oral options, and intramuscular options.",
      }),
    ];
    const rpc = vi.fn(async (name: string) => {
      if (name === "match_document_chunks_text") return { data: sources, error: null };
      if (name === "get_related_document_metadata") return { data: [], error: null };
      return { data: [], error: null };
    });

    let releaseGeneration!: () => void;
    let markGenerationStarted!: () => void;
    const generationStarted = new Promise<void>((resolve) => {
      markGenerationStarted = resolve;
    });
    const generationGate = new Promise<void>((resolve) => {
      releaseGeneration = resolve;
    });
    const generateStructuredTextResult = vi.fn(async () => {
      markGenerationStarted();
      await generationGate;
      return {
        text: JSON.stringify({
          answer: "Use a stepwise agitation and arousal approach based on rating and route.",
          grounded: true,
          confidence: "high",
          answerSections: [],
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
        requestId: "req_coalesced",
        usage: { input_tokens: 100, output_tokens: 120, total_tokens: 220 },
      };
    });

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        rpc,
        from: vi.fn(() => new EmptyQuery()),
      }),
    }));
    vi.doMock("@/lib/openai", () => ({
      embedTextWithTelemetry: vi.fn(async () => ({ embedding: [0.1, 0.2, 0.3], cacheHit: false })),
      generateStructuredTextResult,
    }));

    const { answerQuestionWithScope } = await import("../src/lib/rag");
    const first = answerQuestionWithScope({
      query: "Summarize inpatient approach",
      ownerId: "owner-1",
      logQuery: false,
    });
    const second = answerQuestionWithScope({
      query: "Summarize inpatient approach",
      ownerId: "owner-1",
      logQuery: false,
    });

    await generationStarted;
    releaseGeneration();
    const [firstAnswer, secondAnswer] = await Promise.all([first, second]);

    expect(generateStructuredTextResult).toHaveBeenCalledTimes(1);
    const generateCalls = generateStructuredTextResult.mock.calls as unknown as Array<
      [
        unknown,
        {
          properties: {
            citations: { items: { properties: { chunk_id: { enum: string[] } } } };
            quoteCards: { items: { properties: { chunk_id: { enum: string[] } } } };
            answerSections: { items: { properties: { citation_chunk_ids: { items: { enum: string[] } } } } };
            conflictsOrGaps: { items: { properties: { source_chunk_ids: { items: { enum: string[] } } } } };
          };
        },
      ]
    >;
    const schema = generateCalls[0]?.[1];
    if (!schema) throw new Error("Expected generated answer schema");
    expect(schema).toMatchObject({
      properties: {
        citations: { items: { properties: { chunk_id: { enum: ["agitation-chunk-1"] } } } },
        quoteCards: { items: { properties: { chunk_id: { enum: ["agitation-chunk-1"] } } } },
        answerSections: { items: { properties: { citation_chunk_ids: { items: { enum: ["agitation-chunk-1"] } } } } },
        conflictsOrGaps: { items: { properties: { source_chunk_ids: { items: { enum: ["agitation-chunk-1"] } } } } },
      },
    });
    expect(schema.properties.citations.items.properties.chunk_id.enum).toEqual(["agitation-chunk-1"]);
    expect(schema.properties.quoteCards.items.properties.chunk_id.enum).toEqual(["agitation-chunk-1"]);
    expect(schema.properties.answerSections.items.properties.citation_chunk_ids.items.enum).toEqual([
      "agitation-chunk-1",
    ]);
    expect(schema.properties.conflictsOrGaps.items.properties.source_chunk_ids.items.enum).toEqual([
      "agitation-chunk-1",
    ]);
    expect(rpc).toHaveBeenCalledWith("match_document_chunks_text", expect.any(Object));
    expect(rpc.mock.calls.filter(([name]) => name === "match_document_chunks_text")).toHaveLength(1);
    expect(firstAnswer.openAIRequestIds).toEqual(["req_coalesced"]);
    expect(secondAnswer.openAIRequestIds).toEqual(["req_coalesced"]);
    expect(secondAnswer.routingReason).toContain("answer_inflight_coalesced");
  });

  it("retries fast model output that cites evidence IDs outside retrieved chunks", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("RAG_SEARCH_CACHE_TTL_MS", "0");
    vi.stubEnv("RAG_ANSWER_CACHE_TTL_MS", "0");

    const bulimiaSource = source({
      id: "bulimia-definition-1",
      document_id: "bulimia-doc",
      title: "Bulimia Nervosa Guideline",
      file_name: "bulimia-guideline.pdf",
      section_heading: "Definition",
      content:
        "Bulimia nervosa is an eating disorder characterised by recurrent binge-eating episodes followed by compensatory behaviours.",
      similarity: 0.96,
      hybrid_score: 0.96,
      text_rank: 1.2,
    });
    const rpc = vi.fn(async (name: string) => {
      if (name === "match_document_chunks_text") return { data: [bulimiaSource], error: null };
      if (name === "get_related_document_metadata") return { data: [], error: null };
      return { data: [], error: null };
    });
    const generateStructuredTextResult = vi
      .fn()
      .mockResolvedValueOnce({
        text: JSON.stringify({
          queryClass: "unsupported_or_general",
          confidence: 0.4,
          reasons: ["direct definition question"],
          expandedTerms: ["bulimia nervosa"],
        }),
        model: "gpt-5.4-mini",
        operation: "text_generation",
        latencyMs: 6,
        requestId: "req_classifier_invalid_evidence",
        usage: { input_tokens: 80, output_tokens: 20, total_tokens: 100 },
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          answer:
            "Bulimia nervosa is an eating disorder characterised by binge eating followed by compensatory behaviours.",
          grounded: true,
          confidence: "high",
          answerSections: [],
          citations: [{ chunk_id: "missing-bulimia-chunk" }],
          quoteCards: [],
          conflictsOrGaps: [],
        }),
        model: "gpt-5.4-mini",
        operation: "answer",
        latencyMs: 12,
        requestId: "req_invalid_evidence",
        usage: { input_tokens: 90, output_tokens: 50, total_tokens: 140 },
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          answer:
            "Bulimia nervosa is an eating disorder characterised by recurrent binge-eating episodes followed by compensatory behaviours.",
          grounded: true,
          confidence: "high",
          answerSections: [],
          citations: [{ chunk_id: "bulimia-definition-1" }],
          quoteCards: [
            {
              chunk_id: "bulimia-definition-1",
              quote: "Bulimia nervosa is an eating disorder",
              section_heading: "Definition",
            },
          ],
          conflictsOrGaps: [],
        }),
        model: "gpt-5.5",
        operation: "answer",
        latencyMs: 18,
        requestId: "req_valid_evidence",
        usage: { input_tokens: 120, output_tokens: 60, total_tokens: 180 },
      });

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        rpc,
        from: vi.fn(() => new EmptyQuery()),
      }),
    }));
    vi.doMock("@/lib/openai", () => ({
      embedTextWithTelemetry: vi.fn(async () => ({ embedding: [0.1, 0.2, 0.3], cacheHit: false })),
      generateStructuredTextResult,
    }));

    const { answerQuestionWithScope } = await import("../src/lib/rag");
    const answer = await answerQuestionWithScope({
      query: "what is bulimia nervosa",
      ownerId: undefined,
      logQuery: false,
      skipCache: true,
    });

    expect(generateStructuredTextResult).toHaveBeenCalledTimes(3);
    expect(answer.routingMode).toBe("strong");
    expect(answer.routingReason).toContain("fast_invalid_evidence_retry_strong");
    expect(answer.grounded).toBe(true);
    expect(answer.openAIRequestIds).toEqual(["req_invalid_evidence", "req_valid_evidence"]);
    expect(answer.answer.replace(/\*\*/g, "")).toContain("Bulimia nervosa is an eating disorder");
  });

  it("fails closed when generated clinical prose starts as a source heading", async () => {
    const answer = await answerFromTextSources(
      "lithium dosing for patients",
      [
        source({
          id: "lithium-heading-1",
          document_id: "lithium-doc",
          title: "Lithium Therapy - Initiation And Continuation Guideline",
          file_name: "lithium-therapy.pdf",
          section_heading: "Dosage and monitoring",
          content:
            "Dosage and monitoring. Therapy with lithium should begin with conventional lithium carbonate tablets and serum lithium levels should guide titration.",
          similarity: 0.95,
          hybrid_score: 0.95,
          text_rank: 1.3,
        }),
      ],
      {
        answer: "Dosage and monitoring.",
        grounded: true,
        confidence: "high",
        answerSections: [],
        citations: [{ chunk_id: "lithium-heading-1" }],
        quoteCards: [
          {
            chunk_id: "lithium-heading-1",
            quote: "Therapy with lithium should begin with conventional lithium carbonate tablets",
            section_heading: "Dosage and monitoring",
          },
        ],
        conflictsOrGaps: [],
      },
    );

    expect(answer.answer).toBe("No current source with dose guidance for this query was found.");
    expect(answer.responseMode).toBe("evidence_gap");
    expect(answer.grounded).toBe(false);
    expect(answer.routingReason).toContain("final_quality_gate:incomplete_opening_sentence");
    expect(answer.answer).not.toMatch(/^Dosage and monitoring/i);
  });

  it("treats max-output truncation as a distinct retry and fallback reason", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("RAG_SEARCH_CACHE_TTL_MS", "0");
    vi.stubEnv("RAG_ANSWER_CACHE_TTL_MS", "0");

    const sources = [
      source({
        content:
          "Inpatient approach details for agitation and arousal management include a stepwise approach based on rating severity, route, oral options, and intramuscular options.",
      }),
    ];
    const rpc = vi.fn(async (name: string) => {
      if (name === "match_document_chunks_text") return { data: sources, error: null };
      if (name === "get_related_document_metadata") return { data: [], error: null };
      return { data: [], error: null };
    });
    let requestIndex = 0;
    const generateStructuredTextResult = vi.fn(async () => ({
      text: '{"answer":"Use a stepwise approach',
      model: "gpt-5.4-mini",
      operation: "answer",
      latencyMs: 12,
      requestId: `req_truncated_${++requestIndex}`,
      usage: { input_tokens: 100, output_tokens: 650, total_tokens: 750 },
      status: "incomplete",
      truncated: true,
      incompleteReason: "max_output_tokens",
    }));

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        rpc,
        from: vi.fn(() => new EmptyQuery()),
      }),
    }));
    vi.doMock("@/lib/openai", () => ({
      embedTextWithTelemetry: vi.fn(async () => ({ embedding: [0.1, 0.2, 0.3], cacheHit: false })),
      generateStructuredTextResult,
    }));

    const { answerQuestionWithScope } = await import("../src/lib/rag");
    const answer = await answerQuestionWithScope({
      query: "Summarize inpatient approach",
      ownerId: undefined,
      logQuery: false,
      skipCache: true,
    });

    expect(generateStructuredTextResult).toHaveBeenCalledTimes(2);
    expect(answer.routingMode).toBe("unsupported");
    expect(answer.routingReason).toContain("generation_fallback:provider_incomplete_max_output_tokens");
    expect(answer.routingReason).not.toContain("OpenAI generation incomplete");
    expect(answer.latencyTimings?.answer_retry_count).toBe(2);
    expect(answer.latencyTimings?.answer_retry_reasons).toEqual([
      "fast_max_output_tokens_retry_strong",
      "strong_max_output_tokens",
    ]);
    expect(answer.openAIRequestIds).toEqual(["req_truncated_1", "req_truncated_2"]);
    expect(answer.openAIUsage).toMatchObject({ output_tokens: 1300, total_tokens: 1500 });
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
    const embedTextWithTelemetry = vi.fn(async () => ({ embedding: [0.1, 0.2, 0.3], cacheHit: false }));

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        rpc,
        from: vi.fn(() => new EmptyQuery()),
      }),
    }));
    vi.doMock("@/lib/openai", () => ({
      embedTextWithTelemetry,
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
      candidateCount: 2,
      retrievalDepth: 2,
      distinctDocumentCount: 2,
      topScore: 0.6,
      secondScore: 0.58,
      scoreSpread: 0.02,
      routeMode: "unsupported",
    });
    expect(answer.grounded).toBe(false);
    expect(answer.citations).toHaveLength(0);
    expect(generateStructuredTextResult).not.toHaveBeenCalled();
  });

  it("returns document names for source-support questions instead of clinical advice", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("RAG_SEARCH_CACHE_TTL_MS", "0");
    vi.stubEnv("RAG_ANSWER_CACHE_TTL_MS", "0");

    const lithiumDocument = {
      id: "lithium-doc",
      title: "Lithium Monitoring Guideline",
      file_name: "CG.MHSP.Lithium.pdf",
      metadata: {
        source_title: "Lithium Monitoring Guideline",
        publisher: "Local service",
        jurisdiction: "Australia/WA",
        document_status: "current",
        clinical_validation_status: "approved",
        extraction_quality: "good",
      },
      text_rank: 0.31,
    };
    const lithiumChunk = {
      id: "lithium-doc-chunk-1",
      document_id: "lithium-doc",
      page_number: 4,
      chunk_index: 0,
      section_heading: "Lithium monitoring",
      section_path: ["Lithium monitoring"],
      content: "Lithium monitoring guidance covers baseline tests, level checks, and renal review.",
      retrieval_synopsis: "Lithium monitoring source summary.",
      image_ids: [],
      text_rank: 0.42,
    };
    const rpc = vi.fn(async (name: string) => {
      if (name === "match_documents_for_query") return { data: [lithiumDocument], error: null };
      if (name === "match_document_lookup_chunks_text") return { data: [lithiumChunk], error: null };
      if (name === "match_document_chunks_hybrid") {
        return {
          data: [
            source({
              id: "lithium-doc-chunk-1",
              document_id: "lithium-doc",
              title: "Lithium Monitoring Guideline",
              file_name: "CG.MHSP.Lithium.pdf",
              section_heading: "Lithium monitoring",
              content: "Lithium monitoring guidance covers baseline tests, level checks, and renal review.",
              similarity: 0.91,
              hybrid_score: 0.93,
              text_rank: 0.42,
            }),
          ],
          error: null,
        };
      }
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
      embedTextWithTelemetry: vi.fn(async () => ({ embedding: [0.1, 0.2, 0.3], cacheHit: false })),
      generateStructuredTextResult: vi.fn(),
    }));

    const { answerQuestionWithScope } = await import("../src/lib/rag");

    const answer = await answerQuestionWithScope({
      query: "What documents support lithium monitoring?",
      ownerId: undefined,
      logQuery: false,
      skipCache: true,
    });

    expect(answer.routingMode).toBe("extractive");
    expect(answer.answer.replace(/\*\*/g, "")).toContain("Lithium Monitoring Guideline");
    expect(answer.answer).toContain("indexed document");
    expect(answer.answer).not.toMatch(/level checks|renal review|baseline tests/i);
  });

  it("does not promote lithium dosage headings or continuation fragments as the primary answer", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("RAG_SEARCH_CACHE_TTL_MS", "0");
    vi.stubEnv("RAG_ANSWER_CACHE_TTL_MS", "0");

    const lithiumSource = source({
      id: "lithium-dose-1",
      document_id: "lithium-doc",
      title: "Lithium Therapy - Initiation And Continuation Guideline",
      file_name: "lithium-therapy.pdf",
      page_number: 6,
      section_heading: "Dosage and monitoring",
      content:
        "Dosage (as lithium carbonate). alternative agent where possible and adjust the dose of lithium when necessary. Reduce doses in the elderly and in patients with renal impairment. Target serum lithium ranges are as follows: acute mania 0.8-1.2 mmol/L; prophylaxis uses a lower maintenance range. Therapy with lithium should always begin with conventional tablets (lithium carbonate 250 mg).",
      similarity: 0.95,
      hybrid_score: 0.95,
      text_rank: 1.3,
    });
    const rpc = vi.fn(async (name: string) => {
      if (name === "match_document_chunks_text") return { data: [lithiumSource], error: null };
      if (name === "get_related_document_metadata") return { data: [], error: null };
      return { data: [], error: null };
    });

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        rpc,
        from: vi.fn(() => new EmptyQuery()),
      }),
    }));
    const generateStructuredTextResult = vi.fn(async () => ({
      text: JSON.stringify({
        answer:
          "For lithium dosing, the retrieved guidance supports starting with **lithium carbonate 250 mg conventional tablets**, reducing doses in elderly patients or renal impairment, and using serum lithium targets to titrate.",
        grounded: true,
        confidence: "high",
        answerSections: [
          {
            heading: "Dose and monitoring",
            kind: "medication_dose",
            supportLevel: "direct",
            body: "The source gives acute mania and prophylaxis serum lithium target ranges and says dose adjustment is needed when clinically indicated.",
            citation_chunk_ids: ["lithium-dose-1"],
          },
        ],
        citations: [{ chunk_id: "lithium-dose-1" }],
        quoteCards: [
          {
            chunk_id: "lithium-dose-1",
            quote: "Reduce doses in the elderly and in patients with renal impairment.",
            section_heading: "Dosage and monitoring",
          },
        ],
        conflictsOrGaps: [],
      }),
      model: "gpt-4.1-mini",
      operation: "answer",
      latencyMs: 12,
      requestId: "req_lithium_fast",
      usage: { input_tokens: 140, output_tokens: 90, total_tokens: 230 },
    }));

    vi.doMock("@/lib/openai", () => ({
      embedTextWithTelemetry: vi.fn(),
      generateStructuredTextResult,
    }));

    const { answerQuestionWithScope } = await import("../src/lib/rag");

    const answer = await answerQuestionWithScope({
      query: "lithium dosing for patients",
      ownerId: undefined,
      logQuery: false,
      skipCache: true,
    });

    const plainAnswer = answer.answer.replace(/\*\*/g, "");
    expect(generateStructuredTextResult).toHaveBeenCalledTimes(1);
    expect(answer.routingMode).toBe("fast");
    expect(answer.grounded).toBe(true);
    expect(plainAnswer).not.toMatch(/^Dosage\b/i);
    expect(plainAnswer).not.toContain("alternative agent where possible");
    expect(plainAnswer).toMatch(/target serum lithium|reduce doses|conventional tablets/i);
  });

  it("uses the same model-first guard for non-lithium dose searches", async () => {
    const answer = await answerFromTextSources(
      "olanzapine maximum dose",
      [
        source({
          id: "olanzapine-dose-1",
          document_id: "olanzapine-doc",
          title: "Olanzapine Dose Chart",
          file_name: "olanzapine-dose-chart.pdf",
          section_heading: "Dose table",
          content:
            "Dosage (adult). chart reference only. Maximum olanzapine dose is 20 mg in 24 hours. Repeat doses require sedation and blood pressure monitoring.",
          similarity: 0.95,
          hybrid_score: 0.95,
          text_rank: 1.3,
        }),
      ],
      {
        answer:
          "The retrieved guidance gives a maximum **olanzapine** dose of **20 mg in 24 hours**, with repeat doses requiring sedation and blood pressure monitoring.",
        grounded: true,
        confidence: "high",
        answerSections: [],
        citations: [{ chunk_id: "olanzapine-dose-1" }],
        quoteCards: [
          {
            chunk_id: "olanzapine-dose-1",
            quote: "Maximum olanzapine dose is 20 mg in 24 hours.",
            section_heading: "Dose table",
          },
        ],
        conflictsOrGaps: [],
      },
    );

    const plainAnswer = answer.answer.replace(/\*\*/g, "");
    expect(answer.routingMode).toBe("fast");
    expect(answer.grounded).toBe(true);
    expect(plainAnswer).not.toMatch(/^Dosage\b/i);
    expect(plainAnswer).not.toContain("chart reference only");
    expect(plainAnswer).toContain("20 mg");
  });

  it("uses the same model-first guard for threshold-action searches", async () => {
    const answer = await answerFromTextSources(
      "what clozapine monitoring action is needed for red range blood results",
      [
        source({
          id: "clozapine-red-action-1",
          document_id: "clozapine-doc",
          title: "Clozapine Monitoring Action Table",
          file_name: "clozapine-monitoring.pdf",
          section_heading: "Monitoring",
          content:
            "Monitoring. and reported to the patient monitoring system. If blood results return in the red range, clozapine therapy must be discontinued immediately and reported to the patient monitoring system.",
          similarity: 0.95,
          hybrid_score: 0.95,
          text_rank: 1.3,
        }),
      ],
      {
        answer:
          "For red-range blood results, the source-supported action is to **discontinue clozapine immediately** and report the result to the patient monitoring system.",
        grounded: true,
        confidence: "high",
        answerSections: [],
        citations: [{ chunk_id: "clozapine-red-action-1" }],
        quoteCards: [
          {
            chunk_id: "clozapine-red-action-1",
            quote: "clozapine therapy must be discontinued immediately",
            section_heading: "Monitoring",
          },
        ],
        conflictsOrGaps: [],
      },
    );

    const plainAnswer = answer.answer.replace(/\*\*/g, "");
    expect(answer.routingMode).toBe("strong");
    expect(answer.grounded).toBe(true);
    expect(plainAnswer).not.toMatch(/^Monitoring\b/i);
    expect(plainAnswer).not.toMatch(/^and reported/i);
    expect(plainAnswer).toMatch(/discontinue.*immediately|discontinued immediately/i);
  });

  it("uses the same model-first guard for pathway and referral searches", async () => {
    const answer = await answerFromTextSources(
      "what are ECT referral criteria",
      [
        source({
          id: "ect-referral-1",
          document_id: "ect-doc",
          title: "ECT Referral Pathway",
          file_name: "ect-referral-pathway.pdf",
          section_heading: "Referral criteria",
          content:
            "Referral criteria. and document the referral form. ECT referral criteria include severe depression requiring specialist psychiatric review, consent assessment, and referral through the ECT pathway.",
          similarity: 0.95,
          hybrid_score: 0.95,
          text_rank: 1.3,
        }),
      ],
      {
        answer:
          "The ECT referral criteria include **severe depression requiring specialist psychiatric review**, consent assessment, and referral through the ECT pathway.",
        grounded: true,
        confidence: "high",
        answerSections: [],
        citations: [{ chunk_id: "ect-referral-1" }],
        quoteCards: [
          {
            chunk_id: "ect-referral-1",
            quote: "ECT referral criteria include severe depression requiring specialist psychiatric review",
            section_heading: "Referral criteria",
          },
        ],
        conflictsOrGaps: [],
      },
    );

    const plainAnswer = answer.answer.replace(/\*\*/g, "");
    expect(answer.routingMode).toBe("fast");
    expect(answer.grounded).toBe(true);
    expect(plainAnswer).not.toMatch(/^Referral criteria\b/i);
    expect(plainAnswer).not.toMatch(/^and document/i);
    expect(plainAnswer).toMatch(/severe depression|specialist psychiatric review|ECT pathway/i);
  });

  it("blocks same-sentence cross-medication dose leakage", async () => {
    const answer = await answerFromTextSources(
      "What is the maximum sertraline dose?",
      [
        source({
          id: "sertraline-cross-medication-1",
          document_id: "sertraline-doc",
          title: "Sertraline Dose Appendix",
          file_name: "sertraline-dose-appendix.pdf",
          section_heading: "Maximum doses",
          content:
            "Sertraline dosing appendix lists fluoxetine maximum dose 60 mg and citalopram 40 mg for comparison, but does not state a maximum sertraline dose.",
          similarity: 0.95,
          hybrid_score: 0.95,
          text_rank: 1.3,
        }),
      ],
      {
        answer: "No current source with dose guidance for this query was found.",
        grounded: false,
        confidence: "unsupported",
        answerSections: [],
        citations: [],
        quoteCards: [],
        conflictsOrGaps: [],
      },
    );

    expect(answer.answer).toBe("No current source with dose guidance for this query was found.");
    expect(answer.grounded).toBe(false);
    expect(answer.confidence).toBe("unsupported");
    expect(answer.answer).not.toMatch(/fluoxetine|citalopram|60 mg|40 mg/i);
  });

  it("fails closed for classified dose intent when no accepted fact covers entity and intent together", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("RAG_SEARCH_CACHE_TTL_MS", "0");
    vi.stubEnv("RAG_ANSWER_CACHE_TTL_MS", "0");

    const broadDoseSource = source({
      id: "sertraline-broad-dose-1",
      document_id: "sertraline-doc",
      title: "Antidepressant Dose Overview",
      file_name: "antidepressant-overview.pdf",
      section_heading: "Maximum doses",
      content:
        "Antidepressant maximum oral doses include fluoxetine 60 mg, citalopram 40 mg, and escitalopram 20 mg. Sertraline patient information is provided in another section.",
      similarity: 0.94,
      hybrid_score: 0.94,
      text_rank: 1.2,
    });
    const rpc = vi.fn(async (name: string) => {
      if (name === "match_document_chunks_text") return { data: [broadDoseSource], error: null };
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
      generateStructuredTextResult: vi.fn(async () => ({
        text: JSON.stringify({
          answer: "No current source with dose guidance for this query was found.",
          grounded: false,
          confidence: "unsupported",
          answerSections: [],
          citations: [],
          quoteCards: [],
          conflictsOrGaps: [],
        }),
        model: "gpt-4.1-mini",
        operation: "answer",
        latencyMs: 12,
        requestId: "req_sertraline_source_gap",
        usage: { input_tokens: 130, output_tokens: 40, total_tokens: 170 },
      })),
    }));

    const { answerQuestionWithScope } = await import("../src/lib/rag");

    const answer = await answerQuestionWithScope({
      query: "What is the maximum sertraline dose?",
      ownerId: undefined,
      logQuery: false,
      skipCache: true,
    });

    expect(answer.answer).toBe("No current source with dose guidance for this query was found.");
    expect(answer.grounded).toBe(false);
    expect(answer.confidence).toBe("unsupported");
    expect(answer.answer).not.toMatch(/fluoxetine|citalopram|escitalopram/i);
    expect(answer.answerSections ?? []).toEqual([]);
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
