import { describe, expect, it } from "vitest";
import chunks from "./fixtures/clozapine-threshold-source-chunks.json";
import { rankAnswerEvidence } from "../src/lib/answer-ranking";
import { annotateSearchResults, buildSourceRelevance } from "../src/lib/evidence-relevance";
import { selectAnswerRouteEvidence } from "../src/lib/retrieval-selection";
import { hasValidatedClozapineBloodActionThresholdExtractiveAnswer } from "../src/lib/rag/rag-extractive-first";
import type { SearchResult } from "../src/lib/types";

// Public source text read on 2026-09-27 by the chunk IDs in canary 35528299276.
// All seven chunks were still in committed document generations. This is a
// bounded, text-only selection regression, not a reconstruction of unavailable
// historical image/table hydration or the complete provider request.
const sources: SearchResult[] = chunks.map((chunk) => ({
  ...chunk,
  title: chunk.file_name,
  chunk_index: 0,
  section_heading: null,
  image_ids: [],
  images: [],
  similarity: 0.9,
  hybrid_score: 1,
}));
const row = sources.at(-1)!;
const questions = [
  "What ANC or FBC threshold should withhold clozapine?",
  "What FBC threshold should withhold clozapine?",
];

describe("clozapine blood stop-boundary context selection", () => {
  it.each(questions)("retains the complete row and validates its single citation: %s", (query) => {
    const ranked = rankAnswerEvidence(query, sources, "table_threshold");
    const annotated = annotateSearchResults(query, ranked.rankedResults);
    const selected = selectAnswerRouteEvidence({
      query,
      queryClass: "table_threshold",
      results: annotated,
    }).routeSelection.results;
    expect(buildSourceRelevance(query, row).verdict).toBe("direct");
    expect(selected.map((source) => source.id)).toContain(row.id);
    expect(selected.length).toBeLessThanOrEqual(6);
    expect(selected.find((source) => source.id === row.id)?.content).toBe(row.content);
    expect(
      hasValidatedClozapineBloodActionThresholdExtractiveAnswer({
        query,
        queryClass: "table_threshold",
        results: selected,
        route: { mode: "strong", reason: "clinical_risk_or_complex_query" },
        sourceBacked: true,
        gateStatus: "passed",
      }),
    ).toBe(true);
  });

  it.each(["Which full blood count threshold should stop clozapine?", "What is the ANC threshold?"])(
    "only adds support for an explicit stop-boundary request: %s",
    (query) => {
      const relevance = buildSourceRelevance(query, row);
      if (query.includes("stop clozapine")) {
        expect(relevance.verdict).toBe("direct");
        expect(relevance.missingTerms).toEqual([]);
      } else {
        expect(relevance.contentMatchedTerms).not.toContain("threshold");
      }
    },
  );

  it.each([
    ["wrong analyte", row.content.replace("Neutrophils < 1.5", "WBC < 1.5")],
    ["different boundary", row.content.replace("Neutrophils < 1.5", "Neutrophils < 0.5")],
    ["missing action", row.content.replace("Stop clozapine therapy immediately.", "")],
    ["partial row", "WBC < 3.0 x 109/L AND/OR Stop clozapine therapy immediately."],
    ["negated action", row.content.replace("Stop clozapine", "Do not stop clozapine")],
  ])("does not lend semantic support from a %s", (_label, content) => {
    for (const query of questions) {
      expect(buildSourceRelevance(query, { ...row, content }).verdict).not.toBe("direct");
    }
  });

  it("does not borrow the row from a different source or adjacent/derived evidence", () => {
    const query = questions[0];
    expect(buildSourceRelevance(query, { ...row, title: "Other guideline", file_name: "other.pdf" }).verdict).not.toBe(
      "direct",
    );
    expect(
      buildSourceRelevance(query, { ...row, content: "Clozapine monitoring", adjacent_context: row.content }).verdict,
    ).not.toBe("direct");
  });

  it.each([
    "What ANC or FBC threshold should withhold clozapine in benign ethnic neutropenia?",
    "What ANC or FBC threshold should withhold clozapine during chemotherapy?",
    "What ANC or FBC threshold should not withhold clozapine?",
    "What FBC threshold should withhold lithium?",
    "What ANC or FBC threshold should withhold clozapine in children?",
    "What absolute neutrophil count or full blood count or white cell count threshold should withhold clozapine during chemotherapy?",
  ])("preserves the lexical verdict for a different or qualified request: %s", (query) => {
    // Renaming only the source disables the source-bound semantic match.
    const control = { ...row, title: "Clozapine other source", file_name: "clozapine-other.pdf" };
    const relevance = buildSourceRelevance(query, row);
    expect(relevance.contentMatchedTerms).toEqual(buildSourceRelevance(query, control).contentMatchedTerms);
  });
});
