import { describe, expect, it } from "vitest";
import {
  capturedRagCaseToGoldenCase,
  evaluateGoldenRetrievalCase,
  loadGoldenRetrievalCases,
  retrievalLimitForGoldenCase,
  summarizeGoldenRetrievalResults,
} from "../scripts/eval-retrieval";
import type { SearchResult } from "../src/lib/types";

function result(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: "chunk-1",
    document_id: "doc-1",
    title: "Clozapine Prescribing Administration Monitoring",
    file_name: "CG.MHSP.ClozapinePresAdminMonitor.pdf",
    page_number: 3,
    chunk_index: 0,
    section_heading: "ANC monitoring",
    content: "Withhold clozapine when ANC or FBC threshold values require repeat blood tests.",
    image_ids: [],
    similarity: 0.82,
    text_rank: 0.6,
    hybrid_score: 0.88,
    rrf_score: 0.03,
    images: [],
    ...overrides,
  };
}

describe("golden retrieval eval helpers", () => {
  it("loads the JSON fixture", () => {
    const cases = loadGoldenRetrievalCases("scripts/fixtures/rag-retrieval-golden.json");

    expect(cases.length).toBeGreaterThan(0);
    expect(cases[0]).toHaveProperty("query");
    expect(cases[0]).toHaveProperty("expectedQueryClass");
  });

  it("scores document recall, content recall, and MRR", () => {
    const evaluated = evaluateGoldenRetrievalCase({
      testCase: {
        id: "case-1",
        query: "What ANC threshold should withhold clozapine?",
        expectedQueryClass: "table_threshold",
        expectedDocumentSubstrings: ["ClozapinePresAdminMonitor"],
        expectedContentTerms: ["anc", "withhold"],
        topK: 8,
        expectTableEvidence: false,
      },
      results: [result()],
      telemetry: { query_class: "table_threshold", retrieval_strategy: "hybrid" },
      latencyMs: 123,
    });

    expect(evaluated.documentRecallAt5).toBe(1);
    expect(evaluated.contentRecallAt5).toBe(1);
    expect(evaluated.reciprocalRankAt10).toBe(1);
    expect(evaluated.contentReciprocalRankAt10).toBe(1);
    expect(evaluated.failures).toEqual([]);
  });

  it("content_mrr@10 penalises answer passages that rank below distractors even when recall is perfect", () => {
    const testCase = {
      id: "content-rank",
      query: "What ANC threshold should withhold clozapine?",
      expectedQueryClass: "table_threshold" as const,
      expectedDocumentSubstrings: ["ClozapinePresAdminMonitor"],
      expectedContentTerms: ["anc", "withhold"],
      topK: 8,
      expectTableEvidence: false,
    };
    // A distractor with no matching content terms sits above the real answer passage.
    const distractor = result({
      id: "chunk-distractor",
      title: "Unrelated Ward Policy",
      file_name: "CG.MHSP.ClozapinePresAdminMonitor.pdf",
      section_heading: "General notes",
      content: "This section covers unrelated logistics and has no matching clinical terms.",
      retrieval_synopsis: undefined,
    });
    const topRanked = evaluateGoldenRetrievalCase({
      testCase,
      results: [result(), distractor],
      telemetry: { query_class: "table_threshold", retrieval_strategy: "hybrid" },
      latencyMs: 100,
    });
    const demoted = evaluateGoldenRetrievalCase({
      testCase,
      results: [distractor, result()],
      telemetry: { query_class: "table_threshold", retrieval_strategy: "hybrid" },
      latencyMs: 100,
    });

    // Content recall is blind to ordering — both keep the answer passage in the top 5.
    expect(topRanked.contentRecallAt5).toBe(1);
    expect(demoted.contentRecallAt5).toBe(1);
    // Passage rank is not: demoting the answer passage to rank 2 halves each term's RR.
    expect(topRanked.contentReciprocalRankAt10).toBe(1);
    expect(demoted.contentReciprocalRankAt10).toBeCloseTo(0.5, 5);

    // The summary averages content_mrr only over cases that declare content terms.
    const noContentCase = evaluateGoldenRetrievalCase({
      testCase: { ...testCase, id: "no-content", expectedContentTerms: [] },
      results: [result()],
      telemetry: { query_class: "table_threshold", retrieval_strategy: "hybrid" },
      latencyMs: 100,
    });
    const summary = summarizeGoldenRetrievalResults([demoted, noContentCase]);
    expect(summary.content_mrr_case_count).toBe(1);
    expect(summary.content_mrr_at_10).toBeCloseTo(0.5, 4);
  });

  it("content_mrr@10 ignores document metadata when ranking answer-bearing passages", () => {
    const testCase = {
      id: "metadata-distractor",
      query: "What is the patient property safety plan?",
      expectedQueryClass: "document_lookup" as const,
      expectedDocumentSubstrings: ["Patient Property Safety Plan"],
      expectedContentTerms: ["patient", "property"],
      topK: 8,
      expectTableEvidence: false,
    };
    const metadataOnlyDistractor = result({
      id: "metadata-only",
      title: "Patient Property Safety Plan",
      file_name: "PatientPropertySafetyPlan.pdf",
      section_heading: "Patient property",
      content: "This unrelated passage describes roster logistics without the expected evidence.",
      retrieval_synopsis: undefined,
    });
    const answerPassage = result({
      id: "answer-passage",
      title: "Other Document",
      file_name: "Other.pdf",
      section_heading: "Unrelated heading",
      content: "The patient property process requires documenting valuables in the safety plan.",
      retrieval_synopsis: undefined,
    });

    const evaluated = evaluateGoldenRetrievalCase({
      testCase,
      results: [metadataOnlyDistractor, answerPassage],
      telemetry: { query_class: "document_lookup", retrieval_strategy: "hybrid" },
      latencyMs: 100,
    });

    expect(evaluated.contentRecallAt5).toBe(1);
    expect(evaluated.contentReciprocalRankAt10).toBeCloseTo(0.5, 5);
  });

  it("fetches enough results to score content_mrr@10 even when hit@K uses a smaller topK", () => {
    expect(
      retrievalLimitForGoldenCase({
        id: "top-k-8",
        query: "What ANC threshold should withhold clozapine?",
        expectedQueryClass: "table_threshold",
        expectedDocumentSubstrings: [],
        expectedContentTerms: ["anc"],
        topK: 8,
        expectTableEvidence: false,
      }),
    ).toBe(10);
    expect(
      retrievalLimitForGoldenCase({
        id: "top-k-12",
        query: "What ANC threshold should withhold clozapine?",
        expectedQueryClass: "table_threshold",
        expectedDocumentSubstrings: [],
        expectedContentTerms: ["anc"],
        topK: 12,
        expectTableEvidence: false,
      }),
    ).toBe(12);
  });

  it("matches legacy compact expected document names to current corpus titles", () => {
    const evaluated = evaluateGoldenRetrievalCase({
      testCase: {
        id: "case-1",
        query: "What ANC threshold should withhold clozapine?",
        expectedQueryClass: "table_threshold",
        expectedDocumentSubstrings: ["ClozapinePresAdminMonitor"],
        expectedContentTerms: ["anc", "withhold"],
        topK: 8,
        expectTableEvidence: false,
      },
      results: [
        result({
          title: "Clozapine Prescribing, Administration And Monitoring(AKG)",
          file_name: "Clozapine Prescribing, Administration and Monitoring (AKG).pdf",
        }),
      ],
      telemetry: { query_class: "table_threshold", retrieval_strategy: "hybrid" },
      latencyMs: 123,
    });

    expect(evaluated.documentRecallAt5).toBe(1);
    expect(evaluated.reciprocalRankAt10).toBe(1);
    expect(evaluated.failures).toEqual([]);
  });

  it("matches clinical aliases and explicit alternatives for content recall", () => {
    const evaluated = evaluateGoldenRetrievalCase({
      testCase: {
        id: "case-1",
        query: "What FBC threshold should withhold clozapine?",
        expectedQueryClass: "table_threshold",
        expectedDocumentSubstrings: ["ClozapinePresAdminMonitor"],
        expectedContentTerms: ["anc", ["fbc", "full blood count"], ["withhold", "cease", "stop", "red"]],
        topK: 8,
        expectTableEvidence: true,
      },
      results: [
        result({
          content: "Clozapine table State WBC Neutrophil Outcome Red <3 <1.5. Continue with regular blood tests.",
          images: [
            {
              id: "image-1",
              page_number: 3,
              storage_path: "private/table.png",
              caption: "Clozapine blood monitoring table.",
              image_type: "clinical_table",
              searchable: true,
            },
          ],
        }),
      ],
      telemetry: { query_class: "table_threshold", retrieval_strategy: "hybrid" },
      latencyMs: 123,
    });

    expect(evaluated.contentRecallAt5).toBe(1);
    expect(evaluated.failures).toEqual([]);
  });

  it("reports failed cases with top result summaries", () => {
    const evaluated = evaluateGoldenRetrievalCase({
      testCase: {
        id: "case-1",
        query: "What ANC threshold should withhold clozapine?",
        expectedQueryClass: "table_threshold",
        expectedDocumentSubstrings: ["ClozapinePresAdminMonitor"],
        expectedContentTerms: ["anc", "withhold"],
        topK: 8,
        expectTableEvidence: true,
      },
      results: [result({ title: "Other Document", file_name: "Other.pdf", content: "No matching content." })],
      telemetry: { query_class: "document_lookup", retrieval_strategy: "text_fast_path" },
      latencyMs: 50,
    });
    const summary = summarizeGoldenRetrievalResults([evaluated]);

    expect(evaluated.failures).toEqual(
      expect.arrayContaining([
        "expected query class table_threshold, got document_lookup",
        "expected table evidence in top 5",
      ]),
    );
    expect(summary.failed_cases).toHaveLength(1);
    expect(summary.document_recall_at_5).toBe(0);
  });

  it("classifies the abbreviation golden cases as their declared query class (CI-14)", async () => {
    // The eval fails a case on query-class mismatch, so a golden case whose query does not
    // classify as its expectedQueryClass would pollute the baseline. Guard the abbreviation
    // case added for the CBC synonym expansion.
    const { classifyRagQuery } = await import("../src/lib/clinical-search");
    const cases = loadGoldenRetrievalCases("scripts/fixtures/rag-retrieval-golden.json");
    const abbreviationCases = cases.filter((testCase) => testCase.id === "clozapine-cbc-abbreviation-threshold");
    expect(abbreviationCases).toHaveLength(1);
    for (const testCase of abbreviationCases) {
      expect(classifyRagQuery(testCase.query).queryClass).toBe(testCase.expectedQueryClass);
    }
  });

  it("still classifies the deferred WCC clozapine query as table_threshold (CI-14)", async () => {
    // The clozapine-wcc-abbreviation-threshold golden case is excluded from the fixture
    // above because its withhold-action evidence doesn't yet rank top-5 (a retrieval gap,
    // tracked separately) — but routing/classification for this phrasing is correct and
    // already shipped. Keep asserting that directly so a future classifier regression is
    // still caught even though the live retrieval case is deferred.
    const { classifyRagQuery } = await import("../src/lib/clinical-search");
    expect(
      classifyRagQuery("What WCC (white cell count) or neutrophil threshold should withhold clozapine?").queryClass,
    ).toBe("table_threshold");
  });

  it("converts captured RAG eval cases into golden retrieval cases", () => {
    expect(
      capturedRagCaseToGoldenCase({
        id: "captured-case",
        question: "Which document covers clozapine monitoring?",
        category: "routine",
        expectedQueryClass: "document_lookup",
        supported: true,
        expectedFiles: ["CG.MHSP.ClozapinePresAdminMonitor.pdf"],
        allowedRoutes: ["extractive", "fast"],
        minCitations: 1,
        latencyTargetMs: 5000,
      }),
    ).toMatchObject({
      id: "captured-case",
      query: "Which document covers clozapine monitoring?",
      expectedQueryClass: "document_lookup",
      expectedDocumentSubstrings: ["CG.MHSP.ClozapinePresAdminMonitor.pdf"],
      expectedContentTerms: [],
      topK: 8,
    });
  });
});
