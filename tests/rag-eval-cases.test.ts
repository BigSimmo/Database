import { describe, expect, it } from "vitest";
import {
  answerQualityEvalCases,
  answerQualityMetricLabels,
  loadCapturedRagEvalCases,
  mapCapturedEvalCase,
  mergeRagEvalCases,
  scoreAnswerQualityEvalCase,
} from "../src/lib/rag-eval-cases";
import type { RagAnswer } from "../src/lib/types";

const row = {
  id: "capture-1",
  query: "What FBC threshold should withhold clozapine?",
  query_class: "table_threshold",
  top_files: ["CG.MHSP.ClozapinePresAdminMonitor.pdf"],
  expected_file: null,
  miss_reason: "answer_good_eval",
  metadata: { rating: "good" },
  created_at: "2026-06-13T00:00:00.000Z",
};

function clientWithRows(rows: (typeof row)[]) {
  const filters: Array<{ column: string; value: unknown }> = [];
  const query = {
    eq(column: string, value: unknown) {
      filters.push({ column, value });
      return query;
    },
    order() {
      return {
        limit: async () => ({ data: rows, error: null }),
      };
    },
  };
  return {
    filters,
    from: () => ({
      select: () => query,
    }),
  };
}

describe("captured RAG eval cases", () => {
  it("maps good captures to source-backed reusable eval cases", () => {
    const testCase = mapCapturedEvalCase(row);

    expect(testCase).toMatchObject({
      id: "captured-capture-1",
      question: row.query,
      expectedQueryClass: "table_threshold",
      expectedFiles: ["CG.MHSP.ClozapinePresAdminMonitor.pdf"],
      supported: true,
      minCitations: 1,
    });
  });

  it("does not treat needs-fixing top files as expected hits without explicit review", () => {
    const testCase = mapCapturedEvalCase({
      ...row,
      id: "capture-2",
      miss_reason: "answer_needs_fixing",
      metadata: { rating: "needs_fixing" },
    });

    expect(testCase.expectedFiles).toEqual([]);
    expect(testCase.minCitations).toBe(0);
  });

  it("maps unsupported-answer feedback to unsupported eval expectations", () => {
    const testCase = mapCapturedEvalCase({
      ...row,
      id: "capture-unsupported",
      miss_reason: "unsupported_answer",
      metadata: { rating: "needs_fixing", feedback_type: "unsupported_answer" },
    });

    expect(testCase).toMatchObject({
      category: "unsupported",
      relevanceGrade: "unsupported",
      supported: false,
      expectedFiles: [],
      allowedRoutes: ["unsupported"],
      minCitations: 0,
    });
  });

  it("preserves expected danger-warning metadata on unsupported captures", () => {
    const testCase = mapCapturedEvalCase({
      ...row,
      id: "capture-source-danger",
      miss_reason: "source_insufficient",
      metadata: {
        rating: "needs_fixing",
        feedback_type: "source_insufficient",
        sourceGovernanceWarnings: [{ severity: "danger", code: "outdated_source" }],
      },
    });

    expect(testCase).toMatchObject({
      supported: false,
      expectsSourceDangerWarning: true,
    });
  });

  it("detects persisted danger-message string governance warnings on unsupported captures", () => {
    // /api/eval-cases persists governance warnings as plain message strings
    // (ClinicalDashboard submits warning.message), so the predicate matches the
    // canonical danger message text, not only object-shaped { severity: "danger" }.
    const testCase = mapCapturedEvalCase({
      ...row,
      id: "capture-source-danger-string",
      miss_reason: "unsupported_answer",
      metadata: {
        rating: "needs_fixing",
        feedback_type: "unsupported_answer",
        source_governance_warnings: [
          "One or more supporting sources have not been locally validated.",
          "One or more supporting sources are marked outdated.",
        ],
      },
    });

    expect(testCase).toMatchObject({
      supported: false,
      expectsSourceDangerWarning: true,
    });
  });

  it("does not expect a danger warning for non-danger string warnings on unsupported captures", () => {
    // A review_due-only refusal carries no danger warning; flagging it as
    // expecting one would trip the missing-warning gate on a false positive.
    const testCase = mapCapturedEvalCase({
      ...row,
      id: "capture-string-warning-only",
      miss_reason: "unsupported_answer",
      metadata: {
        rating: "needs_fixing",
        feedback_type: "unsupported_answer",
        source_governance_warnings: ["One or more supporting sources are due for review."],
      },
    });

    expect(testCase.expectsSourceDangerWarning).toBeUndefined();
  });

  it("expects danger warnings for source-insufficient captured refusals", () => {
    const testCase = mapCapturedEvalCase({
      ...row,
      id: "capture-source-insufficient",
      miss_reason: "source_insufficient",
      metadata: { rating: "needs_fixing", feedback_type: "source_insufficient" },
    });

    expect(testCase).toMatchObject({
      supported: false,
      expectsSourceDangerWarning: true,
    });
  });

  it("maps numeric-error feedback to a source-backed regression case", () => {
    const testCase = mapCapturedEvalCase({
      ...row,
      id: "capture-numeric",
      miss_reason: "numeric_error",
      metadata: { rating: "needs_fixing", feedback_type: "numeric_error" },
    });

    expect(testCase).toMatchObject({
      category: "complex",
      supported: true,
      minCitations: 1,
    });
  });

  it("loads only promoted captures and scopes to the owner when provided", async () => {
    const client = clientWithRows([row]);
    const cases = await loadCapturedRagEvalCases({
      supabase: client,
      ownerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      limit: 3,
    });

    expect(cases).toHaveLength(1);
    expect(client.filters).toEqual([
      { column: "promoted_eval_case", value: true },
      { column: "owner_id", value: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    ]);
  });

  it("prefers captured regressions while deduping matching static questions", () => {
    const captured = mapCapturedEvalCase(row);
    const merged = mergeRagEvalCases(
      [
        {
          ...captured,
          id: "static-duplicate",
          expectedFiles: [],
        },
      ],
      [captured],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("captured-capture-1");
  });

  it("keeps a 30-query answer-quality fixture with the expected scoring dimensions", () => {
    expect(answerQualityEvalCases).toHaveLength(30);
    expect(new Set(answerQualityEvalCases.map((testCase) => testCase.id)).size).toBe(30);
    expect(Object.keys(answerQualityMetricLabels).sort()).toEqual([
      "artifact_leaks",
      "fail_closed",
      "intent_coverage",
      "readability",
      "relevance",
    ]);
    expect(answerQualityEvalCases.some((testCase) => testCase.expectedIntent === "document_lookup")).toBe(true);
    expect(answerQualityEvalCases.some((testCase) => testCase.supported === false)).toBe(true);
  });

  it("scores answer quality for relevance, readability, artifacts, intent coverage, and fail-closed behavior", () => {
    const testCase = answerQualityEvalCases.find((item) => item.id === "quality-naltrexone-source-gap-specific")!;
    const answer = {
      answer: "No current source with contraindication or avoid-use guidance was found.",
      grounded: false,
      confidence: "unsupported",
      citations: [],
      sources: [],
      routingMode: "unsupported",
      queryClass: "medication_dose_risk",
      answerSections: [],
    } satisfies RagAnswer;

    const scores = scoreAnswerQualityEvalCase(testCase, answer);

    expect(scores.map((score) => score.metric).sort()).toEqual([
      "artifact_leaks",
      "fail_closed",
      "intent_coverage",
      "readability",
      "relevance",
    ]);
    expect(scores.every((score) => score.score === 1)).toBe(true);
  });
});
