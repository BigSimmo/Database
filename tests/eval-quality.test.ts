import { describe, expect, it } from "vitest";

import {
  buildEvalQualityReport,
  deliveredGroundedAfterSourceGovernancePolicy,
  qualityFailureCategory,
  renderEvalQualityMarkdown,
  sourceGovernanceDangerFailuresForAnswer,
  sourceWarningsForRagQualityAnswer,
  type RagQualityResult,
} from "../scripts/eval-quality";
import { evaluateGoldenRetrievalCase, type GoldenRetrievalResult } from "../scripts/eval-retrieval";

function retrievalResult(overrides: Partial<GoldenRetrievalResult> = {}): GoldenRetrievalResult {
  const base: GoldenRetrievalResult = {
    id: "retrieval-1",
    query: "What ANC threshold should withhold clozapine?",
    forceEmbedding: false,
    expectedQueryClass: "table_threshold",
    actualQueryClass: "table_threshold",
    expectedDocumentSubstrings: ["clozapine.pdf"],
    missingDocumentSubstrings: [],
    expectedContentTerms: ["anc"],
    missingContentTerms: [],
    documentRecallAt5: 1,
    contentRecallAt5: 1,
    hitAtK: true,
    topK: 8,
    reciprocalRankAt10: 1,
    latencyMs: 120,
    retrievalStrategy: "hybrid",
    retrievalPlan: "table_threshold:table_facts_visual_units_then_chunks",
    embeddingSkipped: false,
    embeddingSkipReason: null,
    textFastPathReason: null,
    textCandidateBudget: 40,
    textCandidateCount: 12,
    vectorCandidateCount: 16,
    secondStageRerankUsed: false,
    resultCount: 3,
    tableEvidenceFound: true,
    failures: [],
    topResults: [
      {
        rank: 1,
        title: "Clozapine monitoring",
        file_name: "clozapine.pdf",
        chunk_id: "chunk-1",
        page_number: 2,
        document_status: "current",
        clinical_validation_status: "approved",
        extraction_quality: "good",
        hybrid_score: 0.9,
        similarity: 0.82,
        text_rank: 0.6,
        rrf_score: 0.03,
        content_preview: "Withhold clozapine at the source threshold.",
      },
    ],
  };
  return {
    ...base,
    ...overrides,
    retrievalPlan: overrides.retrievalPlan === undefined ? base.retrievalPlan : overrides.retrievalPlan,
  };
}

function ragResult(overrides: Partial<RagQualityResult> = {}): RagQualityResult {
  return {
    id: "rag-1",
    question: "What safety monitoring is required for clozapine?",
    category: "routine",
    supported: true,
    expectedFiles: ["clozapine.pdf"],
    matchedFiles: ["clozapine.pdf"],
    missingFiles: [],
    topFiles: ["clozapine.pdf"],
    expectedHit: true,
    grounded: true,
    latencyMs: 900,
    route: "fast",
    model: "test-model",
    citations: 2,
    visualEvidence: 0,
    failures: [],
    sourceWarningCount: 0,
    sourceDangerWarningCount: 0,
    unverifiedNumericTokenCount: 0,
    hasFaithfulnessWarning: false,
    routingReason: "test_route",
    estimatedCostUsd: 0.001,
    ...overrides,
  };
}

describe("eval quality reporting", () => {
  it("categorizes common retrieval and answer failures", () => {
    expect(qualityFailureCategory("expected query class table_threshold, got document_lookup")).toBe("query_class");
    expect(qualityFailureCategory("missing expected document(s) in top 5")).toBe("expected_source");
    expect(qualityFailureCategory("expected at least 2 citations")).toBe("citation");
    expect(qualityFailureCategory("numeric faithfulness warning present")).toBe("numeric_grounding");
  });

  it("builds source governance, retrieval, and RAG summaries", () => {
    const report = buildEvalQualityReport({
      generatedAt: "2026-06-25T00:00:00.000Z",
      retrievalResults: [
        retrievalResult(),
        retrievalResult({
          id: "retrieval-2",
          documentRecallAt5: 0,
          contentRecallAt5: 0,
          hitAtK: false,
          reciprocalRankAt10: 0,
          embeddingSkipped: true,
          embeddingSkipReason: "structured_threshold_text_match",
          textFastPathReason: "structured_threshold_text_match",
          secondStageRerankUsed: true,
          failures: ["missing expected document(s) in top 5: Missing.pdf"],
          expectedDocumentSubstrings: ["Missing.pdf"],
          missingDocumentSubstrings: ["Missing.pdf"],
          expectedContentTerms: ["anc"],
          missingContentTerms: ["anc"],
          topResults: [
            {
              ...retrievalResult().topResults[0],
              document_status: "outdated",
              clinical_validation_status: "unverified",
              extraction_quality: "poor",
            },
          ],
        }),
      ],
      ragResults: [
        ragResult(),
        ragResult({
          id: "rag-2",
          supported: false,
          grounded: true,
          expectedHit: false,
          citations: 0,
          failures: ["expected unsupported answer", "numeric faithfulness warning present"],
          unverifiedNumericTokenCount: 1,
          hasFaithfulnessWarning: true,
          sourceWarningCount: 1,
          sourceDangerWarningCount: 0,
        }),
        ragResult({
          id: "rag-3",
          failures: ["danger source governance warning present"],
          sourceWarningCount: 1,
          sourceDangerWarningCount: 1,
        }),
      ],
    });

    expect(report.retrieval.summary.case_count).toBe(2);
    expect(report.retrieval.summary.top_k_hit_rate).toBe(0.5);
    expect(report.retrieval.source_governance.stale_top_results).toBe(1);
    expect(report.retrieval.source_governance.unverified_top_results).toBe(1);
    expect(report.retrieval.source_governance.review_required_top_results).toBe(1);
    expect(report.retrieval.source_governance.metadata_policy).toContain("review-required");
    expect(report.retrieval.summary.embedding_skipped_rate).toBe(0.5);
    expect(report.retrieval.summary.embedding_skip_reason_counts).toMatchObject({
      embedding_used: 1,
      structured_threshold_text_match: 1,
    });
    expect(report.retrieval.summary.second_stage_rerank_rate).toBe(0.5);
    expect(report.retrieval.summary.force_embedding_case_count).toBe(0);
    expect(report.retrieval.summary.force_embedding_failure_count).toBe(0);
    expect(report.rag.summary.unsupported_correct_rate).toBe(0);
    expect(report.rag.summary.numeric_grounding_failure_rate).toBeCloseTo(0.3333, 4);
    expect(report.rag.summary.source_governance_danger_failure_rate).toBeCloseTo(0.3333, 4);
    expect(report.threshold_failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining("retrieval top_k_hit_rate"),
        expect.stringContaining("top-result review_required_rate"),
        expect.stringContaining("RAG unsupported_correct_rate"),
        expect.stringContaining("RAG numeric_grounding_failure_rate"),
        expect.stringContaining("RAG source_governance_danger_failure_rate"),
      ]),
    );
  });

  it("fails forced-embedding retrieval cases that return from cache, coverage, or lexical paths", () => {
    const result = evaluateGoldenRetrievalCase({
      testCase: {
        id: "vector-regression",
        query: "How is panic disorder managed?",
        expectedQueryClass: "broad_summary",
        expectedDocumentSubstrings: [],
        expectedContentTerms: [],
        topK: 8,
        expectTableEvidence: false,
        forceEmbedding: true,
      },
      results: [],
      telemetry: {
        query_class: "broad_summary",
        retrieval_strategy: "text_fast_path",
        embedding_skipped: true,
        embedding_skip_reason: "strong_document_text_score",
        text_fast_path_reason: "strong_document_text_score",
        text_candidate_budget: 32,
        text_candidate_count: 5,
        vector_candidate_count: 0,
        retrieval_layer_counts: { text_candidates: 5 },
        coverage_gate_decision: "accepted",
        coverage_gate_reason: "document_title_evidence_gate",
        second_stage_rerank_used: false,
      },
      latencyMs: 10,
    });

    expect(result.forceEmbedding).toBe(true);
    expect(result.failures).toEqual(
      expect.arrayContaining([
        "forceEmbedding expected embedding to run",
        "forceEmbedding returned lexical strategy text_fast_path",
        "forceEmbedding returned coverage gate",
        "forceEmbedding found no vector-layer candidates",
      ]),
    );
    const report = buildEvalQualityReport({ retrievalResults: [result], ragResults: [] });
    expect(report.retrieval.summary.force_embedding_case_count).toBe(1);
    expect(report.retrieval.summary.force_embedding_failure_count).toBe(1);
    expect(report.blocking_threshold_failures).toEqual(
      expect.arrayContaining([expect.stringContaining("retrieval force_embedding_failure_count 1 above 0")]),
    );
  });

  it("derives source governance warnings for direct RAG answers without precomputed warnings", () => {
    const warnings = sourceWarningsForRagQualityAnswer({
      sourceGovernanceWarnings: undefined,
      relevance: undefined,
      sources: [
        {
          document_id: "doc-outdated",
          title: "Outdated policy",
          source_metadata: {
            document_status: "outdated",
            clinical_validation_status: "approved",
            extraction_quality: "good",
          },
        },
      ],
    } as never);

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "outdated_source",
          severity: "danger",
          document_id: "doc-outdated",
        }),
      ]),
    );
  });

  it("accepts explicit warning-class source metadata debt without clearing danger failures", () => {
    const report = buildEvalQualityReport({
      generatedAt: "2026-06-25T00:00:00.000Z",
      retrievalResults: [
        retrievalResult({
          topResults: [
            {
              ...retrievalResult().topResults[0],
              document_status: "unknown",
              clinical_validation_status: "unverified",
              extraction_quality: "partial",
            },
          ],
        }),
      ],
      ragResults: [
        ragResult({
          failures: ["danger source governance warning present"],
          sourceWarningCount: 1,
          sourceDangerWarningCount: 1,
        }),
      ],
      sourceMetadataDebtAcceptance: {
        accepted_by: "release owner",
        accepted_at: "2026-06-25T00:00:00.000Z",
        expires_at: "2099-01-01T00:00:00.000Z",
        reason: "Temporary corpus metadata debt while source records are reviewed.",
        max_stale_rate: 1,
        max_review_required_rate: 1,
        max_outdated_top_results: 0,
        max_poor_extraction_top_results: 0,
        max_source_governance_danger_failure_rate: 0,
      },
    });

    expect(report.accepted_threshold_failures).toEqual(
      expect.arrayContaining([expect.stringContaining("top-result review_required_rate")]),
    );
    expect(report.accepted_threshold_failures).not.toEqual(
      expect.arrayContaining([expect.stringContaining("top-result stale_rate")]),
    );
    expect(report.blocking_threshold_failures).toEqual(
      expect.arrayContaining([expect.stringContaining("RAG source_governance_danger_failure_rate")]),
    );
  });

  it("treats danger warnings as failures only for delivered grounded answers", () => {
    // Grounded answer delivered on dangerous sourcing: a governance failure.
    expect(sourceGovernanceDangerFailuresForAnswer({ grounded: true, sourceDangerWarningCount: 1 })).toEqual([
      "danger source governance warning present",
    ]);
    // Declined answer (grounded=false): the danger warning is the expected
    // refusal signal, not a failure -- regardless of the preserved routingMode,
    // so evidence-gap refusals converted from fast/strong routes are exempt too.
    expect(sourceGovernanceDangerFailuresForAnswer({ grounded: false, sourceDangerWarningCount: 1 })).toEqual([]);
    // Grounded answer with no danger warning: clean.
    expect(sourceGovernanceDangerFailuresForAnswer({ grounded: true, sourceDangerWarningCount: 0 })).toEqual([]);
  });

  it("mirrors API source-governance refusals before delivery accounting", () => {
    expect(
      deliveredGroundedAfterSourceGovernancePolicy(
        { grounded: true, confidence: "high", responseMode: "clinical_pathway" },
        [{ severity: "danger" }],
      ),
    ).toBe(false);
    expect(
      deliveredGroundedAfterSourceGovernancePolicy(
        { grounded: true, confidence: "high", responseMode: "clinical_pathway" },
        [{ severity: "warning" }],
      ),
    ).toBe(true);
    expect(
      deliveredGroundedAfterSourceGovernancePolicy(
        { grounded: false, confidence: "unsupported", responseMode: "evidence_gap" },
        [{ severity: "danger" }],
      ),
    ).toBe(false);
  });

  it("flags refusals that drop an expected danger warning, regardless of grounded", () => {
    // Refusal expected to surface a danger warning but missing it: a
    // refusal-safety regression, failing even though grounded=false.
    expect(
      sourceGovernanceDangerFailuresForAnswer({
        grounded: false,
        sourceDangerWarningCount: 0,
        expectsDangerWarning: true,
      }),
    ).toEqual(["expected danger source governance warning missing"]);
    // Refusal that still carries its expected danger warning: clean (the warning
    // is the expected refusal signal, not a failure).
    expect(
      sourceGovernanceDangerFailuresForAnswer({
        grounded: false,
        sourceDangerWarningCount: 1,
        expectsDangerWarning: true,
      }),
    ).toEqual([]);
    // No expectation set: unchanged behavior (ungrounded, no warning => clean).
    expect(sourceGovernanceDangerFailuresForAnswer({ grounded: false, sourceDangerWarningCount: 0 })).toEqual([]);
    // The failure is categorized under source governance for reporting.
    expect(qualityFailureCategory("expected danger source governance warning missing")).toBe("source_governance");
  });

  it("hard-blocks release when a refusal drops an expected danger warning (not waivable by debt)", () => {
    const report = buildEvalQualityReport({
      generatedAt: "2026-07-02T00:00:00.000Z",
      retrievalResults: [retrievalResult()],
      ragResults: [
        ragResult({
          id: "refusal-missing-expected-danger",
          supported: false,
          grounded: false,
          route: "unsupported",
          citations: 0,
          failures: ["expected danger source governance warning missing"],
        }),
      ],
      // A permissive debt acceptance must NOT waive this refusal-safety failure.
      sourceMetadataDebtAcceptance: {
        accepted_by: "release owner",
        accepted_at: "2026-07-02T00:00:00.000Z",
        expires_at: "2099-01-01T00:00:00.000Z",
        reason: "Broad metadata debt acceptance for the test.",
        max_stale_rate: 1,
        max_review_required_rate: 1,
        max_outdated_top_results: 0,
        max_poor_extraction_top_results: 0,
        max_source_governance_danger_failure_rate: 0,
      },
    });
    expect(report.rag.summary.expected_danger_warning_missing_count).toBe(1);
    const blocker = "RAG expected_danger_warning_missing_count 1 above 0";
    expect(report.threshold_failures).toContain(blocker);
    expect(report.blocking_threshold_failures).toContain(blocker);
    expect(report.accepted_threshold_failures).not.toContain(blocker);
  });

  it("excludes declined answers from the danger failure rate regardless of route", () => {
    const declinedOnly = buildEvalQualityReport({
      generatedAt: "2026-07-02T00:00:00.000Z",
      retrievalResults: [retrievalResult()],
      ragResults: [
        // Declined via the unsupported route.
        ragResult({
          id: "unsupported-declined",
          supported: false,
          grounded: false,
          route: "unsupported",
          citations: 0,
          sourceWarningCount: 1,
          sourceDangerWarningCount: 1,
        }),
        // Declined via a fast-route answer converted to an evidence-gap refusal:
        // grounded=false but the original route is preserved.
        ragResult({
          id: "fast-route-evidence-gap-refusal",
          grounded: false,
          route: "fast",
          citations: 0,
          sourceWarningCount: 1,
          sourceDangerWarningCount: 1,
        }),
        ragResult({ id: "answered-clean" }),
      ],
    });
    expect(declinedOnly.rag.summary.source_governance_danger_failure_rate).toBe(0);

    const answeredDangerous = buildEvalQualityReport({
      generatedAt: "2026-07-02T00:00:00.000Z",
      retrievalResults: [retrievalResult()],
      ragResults: [ragResult({ grounded: true, sourceWarningCount: 1, sourceDangerWarningCount: 1 })],
    });
    expect(answeredDangerous.rag.summary.source_governance_danger_failure_rate).toBeGreaterThan(0);
  });

  it("rejects source metadata debt acceptance when outdated sources are present", () => {
    const report = buildEvalQualityReport({
      generatedAt: "2026-06-25T00:00:00.000Z",
      retrievalResults: [
        retrievalResult({
          topResults: [
            {
              ...retrievalResult().topResults[0],
              document_status: "outdated",
              clinical_validation_status: "unverified",
              extraction_quality: "partial",
            },
          ],
        }),
      ],
      ragResults: [],
      sourceMetadataDebtAcceptance: {
        accepted_by: "release owner",
        accepted_at: "2026-06-25T00:00:00.000Z",
        expires_at: "2099-01-01T00:00:00.000Z",
        reason: "Temporary corpus metadata debt while source records are reviewed.",
        max_stale_rate: 1,
        max_review_required_rate: 1,
        max_outdated_top_results: 0,
        max_poor_extraction_top_results: 0,
        max_source_governance_danger_failure_rate: 0,
      },
    });

    expect(report.accepted_threshold_failures).toEqual([]);
    expect(report.blocking_threshold_failures).toEqual(report.threshold_failures);
    expect(report.source_metadata_debt_acceptance.rejection_reasons.join(" ")).toContain("outdated top results");
  });

  it("marks source metadata debt acceptance passed when no metadata thresholds need accepting", () => {
    const report = buildEvalQualityReport({
      generatedAt: "2026-06-25T00:00:00.000Z",
      retrievalResults: [retrievalResult()],
      ragResults: [ragResult()],
      sourceMetadataDebtAcceptance: {
        accepted_by: "release owner",
        accepted_at: "2026-06-25T00:00:00.000Z",
        expires_at: "2099-01-01T00:00:00.000Z",
        reason: "Temporary corpus metadata debt while source records are reviewed.",
        max_stale_rate: 0,
        max_review_required_rate: 0,
        max_outdated_top_results: 0,
        max_poor_extraction_top_results: 0,
        max_source_governance_danger_failure_rate: 0,
      },
    });

    expect(report.threshold_failures).toEqual([]);
    expect(report.source_metadata_debt_acceptance).toMatchObject({
      status: "accepted",
      accepted_failures: [],
      rejection_reasons: [],
    });
  });

  it("renders a readable Markdown report", () => {
    const report = buildEvalQualityReport({
      generatedAt: "2026-06-25T00:00:00.000Z",
      retrievalResults: [retrievalResult()],
      ragResults: [ragResult()],
    });
    const markdown = renderEvalQualityMarkdown(report);

    expect(markdown).toContain("# Retrieval Quality Report");
    expect(markdown).toContain("## Retrieval Metrics");
    expect(markdown).toContain("## Retrieval Decision Metrics");
    expect(markdown).toContain("## Source Governance");
    expect(markdown).toContain("## Answer Metrics");
    expect(markdown).toContain("| Hit@K | 1 |");
    expect(markdown).toContain("Policy: unknown, unverified");
  });
});
