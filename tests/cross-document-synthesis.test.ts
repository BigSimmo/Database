import { describe, expect, it } from "vitest";
import {
  balanceCrossDocumentResults,
  buildCrossDocumentFusionBrief,
  buildCrossDocumentSynthesisPlan,
  buildCrossDocumentSourceGuide,
} from "../src/lib/cross-document-synthesis";
import type { SearchResult } from "../src/lib/types";

function source(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: overrides.id ?? "chunk-1",
    document_id: overrides.document_id ?? "doc-1",
    title: overrides.title ?? "Guideline",
    file_name: overrides.file_name ?? "guideline.pdf",
    page_number: overrides.page_number ?? 1,
    chunk_index: overrides.chunk_index ?? 0,
    section_heading: overrides.section_heading ?? null,
    content: overrides.content ?? "Clinical guidance.",
    image_ids: [],
    similarity: overrides.similarity ?? 0.8,
    hybrid_score: overrides.hybrid_score ?? 0.8,
    images: [],
    ...overrides,
  };
}

describe("cross-document synthesis", () => {
  it("balances source packing across documents before filling extra slots", () => {
    const balanced = balanceCrossDocumentResults(
      [
        source({ id: "a1", document_id: "a", hybrid_score: 0.95 }),
        source({ id: "a2", document_id: "a", hybrid_score: 0.93 }),
        source({ id: "a3", document_id: "a", hybrid_score: 0.91 }),
        source({ id: "b1", document_id: "b", hybrid_score: 0.74 }),
        source({ id: "c1", document_id: "c", hybrid_score: 0.7 }),
      ],
      { limit: 4, maxPerDocument: 2, minDocuments: 3 },
    );

    expect(new Set(balanced.map((result) => result.document_id))).toEqual(new Set(["a", "b", "c"]));
    expect(balanced.filter((result) => result.document_id === "a")).toHaveLength(2);
  });

  it("enables balanced packing for broad cross-document questions", () => {
    const plan = buildCrossDocumentSynthesisPlan(
      "What monitoring issues are important across these documents?",
      [
        source({ id: "a1", document_id: "a", title: "Lithium" }),
        source({ id: "b1", document_id: "b", title: "Clozapine" }),
      ],
      "broad_summary",
    );

    expect(plan.enabled).toBe(true);
    expect(plan.reason).toBe("broad_summary");
    expect(plan.selectedDocumentCount).toBe(2);
  });

  it("leaves single-document answers untouched", () => {
    const plan = buildCrossDocumentSynthesisPlan("Summarize this document", [source()], "broad_summary");

    expect(plan.enabled).toBe(false);
    expect(plan.results).toHaveLength(1);
  });

  it("builds a compact fused brief across selected documents", () => {
    const results = [
      source({
        id: "lithium-1",
        document_id: "lithium",
        title: "Lithium Monitoring",
        content: "Baseline renal and thyroid monitoring is required. Escalate for toxicity symptoms.",
      }),
      source({
        id: "clozapine-1",
        document_id: "clozapine",
        title: "Clozapine Monitoring",
        page_number: 4,
        content: "FBC and ANC monitoring is required. Urgent review is needed for myocarditis symptoms.",
      }),
    ];

    const brief = buildCrossDocumentFusionBrief("monitoring and escalation across documents", results);

    expect(brief.documentCount).toBe(2);
    expect(brief.bulletCount).toBe(2);
    expect(brief.sourceChunkIds).toEqual(["lithium-1", "clozapine-1"]);
    expect(brief.text).toContain("Fast fused source brief");
    expect(brief.text).toContain("Lithium Monitoring");
    expect(brief.text).toContain("Clozapine Monitoring");
  });

  it("builds a cross-document source guide with pages and chunk ids", () => {
    const guide = buildCrossDocumentSourceGuide([
      source({ id: "a1", document_id: "a", title: "A", page_number: 2 }),
      source({ id: "b1", document_id: "b", title: "B", page_number: 5 }),
    ]);

    expect(guide).toContain("Cross-document synthesis guide");
    expect(guide).toContain("A: use pages 2; source chunks a1");
    expect(guide).toContain("B: use pages 5; source chunks b1");
  });
});
