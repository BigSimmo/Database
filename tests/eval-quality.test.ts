import { describe, expect, it } from "vitest";

import {
  buildEvalQualityReport,
  qualityFailureCategory,
  renderEvalQualityMarkdown,
  type RagQualityResult,
} from "../scripts/eval-quality";
import type { GoldenRetrievalResult } from "../scripts/eval-retrieval";

function retrievalResult(overrides: Partial<GoldenRetrievalResult> = {}): GoldenRetrievalResult {
  const base: GoldenRetrievalResult = {
    id: "retrieval-1",
    query: "What ANC threshold should withhold clozapine?",
    expectedQueryClass: "table_threshold",
    actualQueryClass: "table_threshold",
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
        clinical_validation_status: "validated",
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
    expectedHit: true,
    grounded: true,
    latencyMs: 900,
    route: "fast",
    model: "test-model",
    citations: 2,
    visualEvidence: 0,
    failures: [],
    sourceWarningCount: 0,
    unverifiedNumericTokenCount: 0,
    hasFaithfulnessWarning: false,
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
        }),
      ],
    });

    expect(report.retrieval.summary.case_count).toBe(2);
    expect(report.retrieval.summary.top_k_hit_rate).toBe(0.5);
    expect(report.retrieval.source_governance.stale_top_results).toBe(1);
    expect(report.retrieval.source_governance.unverified_top_results).toBe(1);
    expect(report.retrieval.summary.embedding_skipped_rate).toBe(0.5);
    expect(report.retrieval.summary.embedding_skip_reason_counts).toMatchObject({
      embedding_used: 1,
      structured_threshold_text_match: 1,
    });
    expect(report.retrieval.summary.second_stage_rerank_rate).toBe(0.5);
    expect(report.rag.summary.unsupported_correct_rate).toBe(0);
    expect(report.rag.summary.numeric_grounding_failure_rate).toBe(0.5);
    expect(report.threshold_failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining("retrieval top_k_hit_rate"),
        expect.stringContaining("RAG unsupported_correct_rate"),
        expect.stringContaining("RAG numeric_grounding_failure_rate"),
      ]),
    );
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
  });
});
