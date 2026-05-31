import { describe, expect, it } from "vitest";
import { chooseAnswerRoute, shouldRetryWithStrongAfterFast } from "../src/lib/rag-routing";
import type { SearchResult } from "../src/lib/types";

function source(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: "chunk-1",
    document_id: "doc-1",
    title: "Guideline",
    file_name: "guideline.pdf",
    page_number: 1,
    chunk_index: 0,
    section_heading: "Overview",
    content: "Clinical guideline text.",
    image_ids: [],
    similarity: 0.84,
    hybrid_score: 0.86,
    images: [],
    ...overrides,
  };
}

function route(query: string, results: SearchResult[]) {
  return chooseAnswerRoute({
    query,
    results,
    fastModel: "fast-model",
    strongModel: "strong-model",
  });
}

describe("RAG answer routing", () => {
  it("uses extractive answers for direct routine document questions with strong retrieval", () => {
    const selected = route("What does the admission information document include?", [source()]);

    expect(selected.mode).toBe("extractive");
    expect(selected.model).toBeNull();
    expect(selected.reason).toBe("document_lookup_source_extractive");
  });

  it("uses the fast model for broader routine questions with strong retrieval", () => {
    const selected = route("How is admission information handled?", [source()]);

    expect(selected.mode).toBe("fast");
    expect(selected.model).toBe("fast-model");
    expect(selected.reason).toBe("strong_routine_retrieval");
  });

  it("uses extractive answers for routine medication questions with strong source support", () => {
    const selected = route("What clozapine monitoring is required?", [source()]);

    expect(selected.mode).toBe("extractive");
    expect(selected.model).toBeNull();
    expect(selected.reason).toBe("high_confidence_source_extractive");
  });

  it("uses the strong model for medication or risk-heavy decision questions", () => {
    const selected = route("What ANC threshold should stop clozapine?", [source()]);

    expect(selected.mode).toBe("strong");
    expect(selected.model).toBe("strong-model");
    expect(selected.reason).toBe("clinical_risk_or_complex_query");
  });

  it("uses the strong model when retrieval is plausible but weak", () => {
    const selected = route("What should the form include?", [source({ similarity: 0.5, hybrid_score: 0.52 })]);

    expect(selected.mode).toBe("strong");
    expect(selected.reason).toBe("limited_retrieval_strength");
  });

  it("keeps direct title matches on the fast synthesis path when the question is routine", () => {
    const selected = chooseAnswerRoute({
      query: "What are NOCC requirements?",
      results: [
        source({
          title: "MHSP NOCC",
          file_name: "MHSP.NOCC.pdf",
          similarity: 0.5,
          hybrid_score: 0.52,
        }),
      ],
      conflictsOrGaps: [{ type: "gap", message: "Top sources are limited-strength matches.", source_chunk_ids: [] }],
      fastModel: "fast-model",
      strongModel: "strong-model",
    });

    expect(selected.mode).toBe("extractive");
    expect(selected.reason).toBe("high_confidence_source_extractive");
  });

  it("uses extractive answers for direct table or threshold lookups with strong source support", () => {
    const selected = route("What ANC threshold should stop clozapine?", [
      source({
        title: "Clozapine Prescribing and Monitoring",
        file_name: "CG.MHSP.ClozapinePresAdminMonitor.pdf",
        text_rank: 0.08,
      }),
    ]);

    expect(selected.mode).toBe("extractive");
    expect(selected.reason).toBe("table_or_threshold_source_extractive");
  });

  it("keeps broad summaries on the fast synthesis path", () => {
    const selected = route("Summarize the admission information guidance", [source()]);

    expect(selected.mode).toBe("fast");
    expect(selected.reason).toBe("strong_routine_retrieval");
  });

  it("uses the strong model for explicit multi-document comparisons", () => {
    const selected = route("Compare the admission and discharge requirements", [
      source({ id: "chunk-1", document_id: "doc-1", title: "Admission" }),
      source({ id: "chunk-2", document_id: "doc-2", title: "Discharge" }),
      source({ id: "chunk-3", document_id: "doc-3", title: "Assessment" }),
      source({ id: "chunk-4", document_id: "doc-4", title: "Review" }),
    ]);

    expect(selected.mode).toBe("strong");
    expect(selected.reason).toBe("multi_document_comparison_synthesis");
  });

  it("skips generation when retrieval has no plausible support", () => {
    const selected = route("How do I configure an unrelated router?", [
      source({ similarity: 0.18, hybrid_score: 0.2, text_rank: 0 }),
    ]);

    expect(selected.mode).toBe("unsupported");
    expect(selected.model).toBeNull();
  });

  it("retries a fast unsupported answer with the strong model when source hits are solid", () => {
    const selected = route("How is admission information handled?", [
      source(),
      source({ id: "chunk-2", document_id: "doc-2" }),
    ]);

    expect(
      shouldRetryWithStrongAfterFast({
        route: selected,
        answer: { grounded: false, confidence: "unsupported", citations: [] },
        results: [source(), source({ id: "chunk-2", document_id: "doc-2" })],
      }),
    ).toBe(true);
  });
});
