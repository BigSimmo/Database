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
    expect(plan.answerFocus).toContain("medication");
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
    expect(plan.latencyPlan).toBe("cache_or_text_first");
    expect(plan.answerFocus).toContain("2 documents");
    expect(plan.streamPlan).toContain("Fuse strongest points");
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
    expect(plan.answerFocus).toContain("best matching document");
  });
});
