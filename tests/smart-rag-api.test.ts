import { describe, expect, it } from "vitest";
import { buildSmartRagApiPlan } from "../src/lib/smart-rag-api";
import type { SearchResult } from "../src/lib/types";

function source(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: overrides.id ?? "chunk-1",
    document_id: overrides.document_id ?? "doc-1",
    title: overrides.title ?? "Clinical Guideline",
    file_name: overrides.file_name ?? "guideline.pdf",
    page_number: overrides.page_number ?? 3,
    chunk_index: overrides.chunk_index ?? 1,
    section_heading: overrides.section_heading ?? "Monitoring",
    content: overrides.content ?? "Monitor observations and escalate urgent risk.",
    image_ids: [],
    similarity: overrides.similarity ?? 0.86,
    hybrid_score: overrides.hybrid_score ?? 0.92,
    images: [],
    ...overrides,
  };
}

describe("smart RAG API plan", () => {
  const answerPlanContract = {
    intent: new Set(["clinical_synthesis", "source_lookup", "document_lookup", "unsupported"]),
    routeMode: new Set(["unsupported", "extractive", "fast", "strong"]),
    modelStrategy: new Set([
      "fast_model_then_quality_gate",
      "strong_model_then_quality_gate",
      "extractive_lookup",
      "source_gap",
    ]),
    retrievalQuality: new Set(["strong", "partial", "weak", "conflicting"]),
    fallbackBehavior: new Set(["retry_strong_then_source_gap", "source_gap", "extractive_lookup_only"]),
    sourcePolicy: new Set(["required_citations", "nearby_sources_allowed", "exact_source_links"]),
  };

  function expectContractAnswerPlan(plan: ReturnType<typeof buildSmartRagApiPlan>) {
    expect(answerPlanContract.intent.has(plan.answerPlan.intent)).toBe(true);
    expect(answerPlanContract.routeMode.has(plan.answerPlan.routeMode)).toBe(true);
    expect(answerPlanContract.modelStrategy.has(plan.answerPlan.modelStrategy)).toBe(true);
    expect(answerPlanContract.retrievalQuality.has(plan.answerPlan.retrievalQuality)).toBe(true);
    expect(answerPlanContract.fallbackBehavior.has(plan.answerPlan.fallbackBehavior)).toBe(true);
    expect(answerPlanContract.sourcePolicy.has(plan.answerPlan.sourcePolicy)).toBe(true);
  }

  it("keeps generated answer-plan values inside the central contract", () => {
    const plans = [
      buildSmartRagApiPlan({
        query: "What monitoring escalation is required?",
        queryClass: "medication_dose_risk",
        results: [source()],
        routeMode: "fast",
        retrievalStrategy: "hybrid",
      }),
      buildSmartRagApiPlan({
        query: "What ANC threshold should stop clozapine?",
        queryClass: "table_threshold",
        results: [source()],
        routeMode: "strong",
        retrievalStrategy: "text_fast_path",
      }),
      buildSmartRagApiPlan({
        query: "agitation guideline source",
        queryClass: "unsupported_or_general",
        results: [source()],
        preferredResponseMode: "document_lookup",
        retrievalStrategy: "document_lookup_fast_path",
      }),
      buildSmartRagApiPlan({
        query: "unsupported clinical question",
        queryClass: "unsupported_or_general",
        results: [],
        routeMode: "unsupported",
        retrievalStrategy: "unsupported_short_circuit",
      }),
    ];

    for (const plan of plans) expectContractAnswerPlan(plan);
  });

  it("builds clickable core source links for answer responses", () => {
    const plan = buildSmartRagApiPlan({
      query: "What monitoring escalation is required?",
      queryClass: "medication_dose_risk",
      results: [source({ id: "chunk-a", document_id: "doc-a", title: "Monitoring Guide", page_number: 7 })],
      routeMode: "fast",
      retrievalStrategy: "hybrid",
    });

    expect(plan.intent).toBe("medication_or_risk_answer");
    expect(plan.responseMode).toBe("fast_grounded_answer");
    expect(plan.displayMode).toBe("clinical_pathway");
    expect(plan.answerFocus).toContain("medication");
    expect(plan.answerPlan).toMatchObject({
      intent: "clinical_synthesis",
      queryClass: "medication_dose_risk",
      retrievalQuality: "strong",
      routeMode: "fast",
      modelStrategy: "fast_model_then_quality_gate",
      fallbackBehavior: "retry_strong_then_source_gap",
      sourcePolicy: "required_citations",
    });
    expect(plan.answerPlan.retrievalIntent).toMatchObject({
      needsDoseRouteFrequency: false,
      needsMedicationChart: true,
    });
    expect(plan.answerPlan.sourceSelection.selectedCount).toBe(1);
    expect(plan.answerPlan.qualityCriteria).toEqual(
      expect.arrayContaining([
        "first_sentence_answers_query",
        "natural_clinical_synthesis",
        "no_source_headings_or_fragments",
        "no_cross_medication_leakage",
      ]),
    );
    expect(plan.coreSourceLinks).toHaveLength(1);
    expect(plan.coreSourceLinks[0]).toMatchObject({
      href: "/documents/doc-a?page=7&chunk=chunk-a",
      reason: "Medication, dose, monitoring, or risk evidence",
    });
  });

  it("plans multi-document synthesis when the question asks to combine sources", () => {
    const plan = buildSmartRagApiPlan({
      query: "Combine monitoring guidance across documents",
      queryClass: "broad_summary",
      results: [
        source({ id: "chunk-a", document_id: "doc-a", title: "Lithium", hybrid_score: 0.9 }),
        source({ id: "chunk-b", document_id: "doc-b", title: "Clozapine", hybrid_score: 0.82 }),
      ],
      routeMode: "fast",
      retrievalStrategy: "text_fast_path",
    });

    expect(plan.responseMode).toBe("multi_document_synthesis");
    expect(plan.displayMode).toBe("comparison_matrix");
    expect(plan.latencyPlan).toBe("cache_or_text_first");
    expect(plan.answerFocus).toContain("2 documents");
    expect(plan.streamPlan).toContain("Fuse strongest points");
    expect(plan.answerPlan.qualityCriteria).toContain("conflicts_or_gaps_handled_when_supported");
    expect(plan.answerPlan.intent).toBe("clinical_synthesis");
    expect(plan.coreSourceLinks.map((link) => link.document_id)).toEqual(["doc-a", "doc-b"]);
  });

  it("can be forced into document lookup mode for document-search API calls", () => {
    const plan = buildSmartRagApiPlan({
      query: "agitation guideline",
      queryClass: "unsupported_or_general",
      results: [source({ title: "Agitation Guideline" })],
      retrievalStrategy: "document_lookup_fast_path",
      preferredResponseMode: "document_lookup",
    });

    expect(plan.responseMode).toBe("document_lookup");
    expect(plan.displayMode).toBe("document_lookup");
    expect(plan.answerFocus).toContain("best matching document");
    expect(plan.answerPlan).toMatchObject({
      intent: "document_lookup",
      modelStrategy: "extractive_lookup",
      fallbackBehavior: "extractive_lookup_only",
      sourcePolicy: "exact_source_links",
    });
  });

  it("uses threshold table display mode and strong answer planning for threshold queries", () => {
    const plan = buildSmartRagApiPlan({
      query: "What ANC threshold should stop clozapine?",
      queryClass: "table_threshold",
      results: [source({ content: "ANC threshold table with action rows." })],
      retrievalStrategy: "text_fast_path",
      routeMode: "strong",
    });

    expect(plan.displayMode).toBe("threshold_table");
    expect(plan.answerPlan.routeMode).toBe("strong");
    expect(plan.answerPlan.modelStrategy).toBe("strong_model_then_quality_gate");
    expect(plan.answerPlan.sourcePolicy).toBe("required_citations");
    expect(plan.answerFocus).toContain("threshold");
  });

  it("marks unsupported plans as source gaps with nearby sources allowed only when present", () => {
    const plan = buildSmartRagApiPlan({
      query: "unsupported clinical question",
      queryClass: "unsupported_or_general",
      results: [],
      retrievalStrategy: "unsupported_short_circuit",
      routeMode: "unsupported",
    });

    expect(plan.responseMode).toBe("unsupported");
    expect(plan.answerPlan).toMatchObject({
      intent: "unsupported",
      queryClass: "unsupported_or_general",
      routeMode: "unsupported",
      modelStrategy: "source_gap",
      retrievalQuality: "weak",
      fallbackBehavior: "source_gap",
      sourcePolicy: "required_citations",
    });
    expect(plan.answerPlan.sourceSelection).toMatchObject({
      candidateCount: 0,
      selectedCount: 0,
      requiredSignalsSatisfied: true,
    });
  });
});
