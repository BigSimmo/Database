import { describe, expect, it } from "vitest";
import {
  evaluateGoldenRetrievalCase,
  loadGoldenRetrievalCases,
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
          content:
            "Clozapine table State WBC Neutrophil Outcome Red <3 <1.5. Continue with regular blood tests.",
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
      results: [result({ file_name: "Other.pdf", content: "No matching content." })],
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
});
