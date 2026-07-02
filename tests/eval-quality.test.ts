import { describe, expect, it } from "vitest";

import {
  buildEvalQualityReport,
  qualityFailureCategory,
  renderEvalQualityMarkdown,
  sourceGovernanceDangerFailuresForAnswer,
  sourceWarningsForRagQualityAnswer,
  type RagQualityResult,
} from "../scripts/eval-quality";
import type { GoldenRetrievalResult } from "../scripts/eval-retrieval";

function retrievalResult(overrides: Partial<GoldenRetrievalResult> = {}): GoldenRetrievalResult {
  const base: GoldenRetrievalResult = {
    id: "retrieval-1",
    query: "What ANC threshold should withhold clozapine?",
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
    expect(
      sourceGovernanceDangerFailuresForAnswer({ grounded: true, sourceDangerWarningCount: 1 }),
    ).toEqual(["danger source governance warning present"]);
    // Declined answer (grounded=false): the danger warning is the expected
    // refusal signal, not a failure -- regardless of the preserved routingMode,
    // so evidence-gap refusals converted from fast/strong routes are exempt too.
    expect(sourceGovernanceDangerFailuresForAnswer({ grounded: false, sourceDangerWarningCount: 1 })).toEqual([]);
    // Grounded answer with no danger warning: clean.
    expect(sourceGovernanceDangerFailuresForAnswer({ grounded: true, sourceDangerWarningCount: 0 })).toEqual([]);
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
