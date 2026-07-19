import { describe, expect, it } from "vitest";
import { applySecondStageRerankIfNeeded, stabilizeReleasedSearchOrder } from "../src/lib/rag";
import type { SearchTelemetry } from "../src/lib/rag-contracts";
import type { SearchResult, SearchScoreExplanation } from "../src/lib/types";

function explanation(rankScore: number): SearchScoreExplanation {
  return {
    vectorScore: 0.8,
    textRank: 0.4,
    lexicalCoverageScore: 0.5,
    metadataMatchScore: 0,
    sectionTitleMatchBoost: 0,
    freshnessRecencyBoost: 0,
    weightedHybridScore: 0.8,
    rrfScore: null,
    rrfBoost: 0,
    memoryBoost: 0,
    titleBoost: 0,
    metadataBoost: 0,
    clinicalSignalBoost: 0,
    penalty: 0,
    rankScore,
    finalScore: Math.min(1, Math.max(0, rankScore)),
    preClampFinalScore: rankScore,
    strategy: "weighted_hybrid",
  };
}

function result(overrides: Partial<SearchResult>): SearchResult {
  return {
    id: overrides.id ?? "chunk-1",
    document_id: overrides.document_id ?? "doc-1",
    title: overrides.title ?? "Guideline",
    file_name: overrides.file_name ?? "guideline.pdf",
    page_number: 1,
    chunk_index: 0,
    section_heading: null,
    content: "Clinical evidence",
    image_ids: [],
    images: [],
    similarity: overrides.similarity ?? 0.8,
    hybrid_score: overrides.hybrid_score ?? 0.8,
    score_explanation: overrides.score_explanation ?? explanation(0.8),
    ...overrides,
  };
}

describe("second-stage rank score", () => {
  it("applies signed demotions to rankScore while preserving hybrid coverage scores", () => {
    const telemetry = {} as SearchTelemetry;
    const demoted = result({
      id: "demoted",
      document_id: "old-doc",
      hybrid_score: 0.8,
      score_explanation: explanation(0.4),
      source_metadata: {
        source_title: "Older guideline",
        publisher: "Test publisher",
        jurisdiction: "Australia/WA",
        version: "1",
        publication_date: null,
        review_date: null,
        uploaded_at: null,
        indexed_at: null,
        uploaded_by: null,
        document_status: "outdated",
        clinical_validation_status: "locally_reviewed",
        extraction_quality: "good",
      },
    });
    const relevant = result({
      id: "relevant",
      document_id: "current-doc",
      hybrid_score: 0.79,
      score_explanation: explanation(0.5),
    });

    const ranked = applySecondStageRerankIfNeeded({
      queryClass: "medication_dose_risk",
      results: [demoted, relevant],
      telemetry,
      topK: 2,
    });

    expect(ranked.map((item) => item.id)).toEqual(["relevant", "demoted"]);
    expect(ranked.map((item) => item.score_explanation?.finalRank)).toEqual([1, 2]);
    expect(ranked.find((item) => item.id === "demoted")?.hybrid_score).toBe(0.8);
    expect(ranked.find((item) => item.id === "relevant")?.hybrid_score).toBe(0.79);
    expect(ranked[0].score_explanation?.finalScore).toBeGreaterThanOrEqual(0);
    expect(ranked[0].score_explanation?.finalScore).toBeLessThanOrEqual(1);
    expect(telemetry.second_stage_rerank_used).toBe(true);
  });

  it("does not leak ranking-only magnitude into the clamped confidence signal", () => {
    const highRank = explanation(1.4);
    highRank.finalScore = 0.6;
    const ranked = applySecondStageRerankIfNeeded({
      queryClass: "medication_dose_risk",
      results: [
        result({ id: "high-rank", score_explanation: highRank }),
        result({ id: "runner-up", hybrid_score: 0.79, score_explanation: explanation(0.79) }),
      ],
      telemetry: {} as SearchTelemetry,
      topK: 2,
    });

    expect(ranked[0].id).toBe("high-rank");
    expect(ranked[0].score_explanation?.rankScore).toBe(1.49);
    expect(ranked[0].score_explanation?.preClampFinalScore).toBe(1.49);
    expect(ranked[0].score_explanation?.finalScore).toBe(0.69);
    expect(ranked.map((item) => item.score_explanation?.finalRank)).toEqual([1, 2]);
  });

  it("sorts by the computed second-stage score even when score explanations are absent", () => {
    const doseEvidenceWithoutExplanation = result({
      id: "dose-evidence-without-explanation",
      document_id: "dose-doc",
      hybrid_score: 0.82,
      content: "Give 5 mg orally when clinically indicated.",
    });
    delete doseEvidenceWithoutExplanation.score_explanation;
    const supported = result({
      id: "supported",
      document_id: "current-doc",
      hybrid_score: 0.84,
      score_explanation: explanation(0.84),
    });

    const ranked = applySecondStageRerankIfNeeded({
      queryClass: "medication_dose_risk",
      results: [doseEvidenceWithoutExplanation, supported],
      telemetry: {} as SearchTelemetry,
      topK: 2,
    });

    expect(ranked.map((item) => item.id)).toEqual(["dose-evidence-without-explanation", "supported"]);
    expect(ranked[1].score_explanation?.finalRank).toBe(2);
  });

  it("keeps distinct rank order while upgrading duplicate chunks to the strongest released-hybrid copy", () => {
    const telemetry = {} as SearchTelemetry;
    const strongerHybridDuplicate = result({
      id: "stronger-hybrid",
      document_id: "older-doc",
      hybrid_score: 0.8,
      score_explanation: explanation(0.4),
      source_metadata: {
        source_title: "Older guideline",
        publisher: "Test publisher",
        jurisdiction: "Australia/WA",
        version: "1",
        publication_date: null,
        review_date: null,
        uploaded_at: null,
        indexed_at: null,
        uploaded_by: null,
        document_status: "outdated",
        clinical_validation_status: "locally_reviewed",
        extraction_quality: "good",
      },
    });
    const higherRankScore = result({
      id: "higher-rank-score",
      document_id: "current-doc",
      hybrid_score: 0.79,
      score_explanation: explanation(0.5),
    });
    const weakerDuplicate = {
      ...strongerHybridDuplicate,
      hybrid_score: 0.78,
      score_explanation: explanation(0.41),
      content: "Weaker duplicate",
    };

    const secondStage = applySecondStageRerankIfNeeded({
      queryClass: "medication_dose_risk",
      results: [higherRankScore, weakerDuplicate, strongerHybridDuplicate],
      telemetry,
      topK: 3,
    });
    expect(secondStage.map((item) => item.id)).toEqual(["higher-rank-score", "stronger-hybrid", "stronger-hybrid"]);

    const stabilized = stabilizeReleasedSearchOrder(secondStage);

    expect(stabilized.map((item) => item.id)).toEqual([
      "higher-rank-score",
      "stronger-hybrid",
    ]);
    expect(stabilized[1].hybrid_score).toBe(0.8);
    expect(stabilized[1].content).toBe(strongerHybridDuplicate.content);
  });
});
