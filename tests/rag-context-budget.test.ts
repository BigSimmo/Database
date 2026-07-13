import { describe, expect, it } from "vitest";
import { capPerDocumentCrowding, packedContextCacheKey, selectModelContextResults } from "../src/lib/rag";
import type { RagQueryClass, SearchResult } from "../src/lib/types";

function source(index: number, overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: `chunk-${index}`,
    document_id: `doc-${index}`,
    title: `Guideline ${index}`,
    file_name: `guideline-${index}.pdf`,
    page_number: index,
    chunk_index: index,
    section_heading: "Overview",
    content: `Clinical source text ${index}.`,
    image_ids: [],
    similarity: 0.9 - index * 0.01,
    hybrid_score: 0.9 - index * 0.01,
    images: [],
    ...overrides,
  };
}

function governedSource(
  index: number,
  args: {
    documentId: string;
    publisherCode: string;
    publisher: string;
    jurisdiction: string;
    validation?: "unverified" | "locally_reviewed" | "approved";
  },
) {
  return source(index, {
    document_id: args.documentId,
    source_metadata: {
      source_title: `Guideline ${index}`,
      publisher: args.publisher,
      publisher_code: args.publisherCode,
      jurisdiction: args.jurisdiction,
      version: null,
      publication_date: null,
      review_date: null,
      uploaded_at: null,
      indexed_at: null,
      uploaded_by: null,
      document_status: "current",
      clinical_validation_status: args.validation ?? "approved",
      extraction_quality: "good",
    },
  });
}

const results = Array.from({ length: 12 }, (_, index) => source(index + 1));

function select(args: {
  routeMode: "unsupported" | "extractive" | "fast" | "strong";
  queryClass: RagQueryClass;
  crossDocument?: boolean;
}) {
  return selectModelContextResults({
    routeMode: args.routeMode,
    queryClass: args.queryClass,
    crossDocument: args.crossDocument ?? false,
    results,
  });
}

describe("RAG model context budgeting", () => {
  it("limits routine fast generation to the top four sources", () => {
    const selected = select({ routeMode: "fast", queryClass: "document_lookup" });

    expect(selected.map((result) => result.id)).toEqual(["chunk-1", "chunk-2", "chunk-3", "chunk-4"]);
  });

  it("keeps broader context for synthesis-heavy fast routes", () => {
    expect(select({ routeMode: "fast", queryClass: "comparison" })).toHaveLength(12);
    expect(select({ routeMode: "fast", queryClass: "broad_summary" })).toHaveLength(12);
    expect(select({ routeMode: "fast", queryClass: "document_lookup", crossDocument: true })).toHaveLength(12);
  });

  it("bounds high-risk supplementary-only context without dropping all available evidence", () => {
    const selected = select({ routeMode: "fast", queryClass: "medication_dose_risk" });

    expect(selected).toHaveLength(6);
    expect(selected.map((result) => result.id)).toEqual([
      "chunk-1",
      "chunk-2",
      "chunk-3",
      "chunk-4",
      "chunk-5",
      "chunk-6",
    ]);
  });

  it("does not limit strong generation or non-model routes", () => {
    expect(select({ routeMode: "strong", queryClass: "document_lookup" })).toHaveLength(12);
    expect(select({ routeMode: "extractive", queryClass: "document_lookup" })).toHaveLength(12);
    expect(select({ routeMode: "unsupported", queryClass: "unsupported_or_general" })).toHaveLength(12);
  });

  it("caps a crowding document to three chunks in the model context but keeps other docs (P9)", () => {
    const crowded: SearchResult[] = [
      source(1), // doc-1
      { ...source(2), document_id: "doc-1", id: "a2" },
      { ...source(3), document_id: "doc-1", id: "a3" },
      { ...source(4), document_id: "doc-1", id: "a4" }, // 4th from doc-1 → dropped
      { ...source(5), document_id: "doc-1", id: "a5" }, // 5th from doc-1 → dropped
      { ...source(6), document_id: "doc-2", id: "b1" },
    ];
    const selected = selectModelContextResults({
      routeMode: "strong",
      queryClass: "broad_summary",
      crossDocument: false,
      results: crowded,
    });
    const perDoc = selected.reduce<Record<string, number>>((acc, r) => {
      acc[r.document_id] = (acc[r.document_id] ?? 0) + 1;
      return acc;
    }, {});
    expect(perDoc["doc-1"]).toBe(3);
    expect(perDoc["doc-2"]).toBe(1);
    // Order preserved, no reranking.
    expect(selected.map((r) => r.id)).toEqual(["chunk-1", "a2", "a3", "b1"]);
  });

  it("never starves a genuinely single-document answer", () => {
    const singleDoc: SearchResult[] = Array.from({ length: 6 }, (_, index) => ({
      ...source(index + 1),
      document_id: "doc-only",
      id: `only-${index + 1}`,
    }));
    expect(capPerDocumentCrowding(singleDoc)).toHaveLength(6);
  });

  it("uses four validated Australian passages across two documents without supplementary padding", () => {
    const highRiskResults = [
      governedSource(1, {
        documentId: "wa-doc-1",
        publisherCode: "FSH",
        publisher: "Fiona Stanley Fremantle Hospitals Group",
        jurisdiction: "Australia/WA",
      }),
      governedSource(2, {
        documentId: "wa-doc-2",
        publisherCode: "EMHS",
        publisher: "East Metropolitan Health Service",
        jurisdiction: "Australia/WA",
      }),
      governedSource(3, {
        documentId: "wa-doc-1",
        publisherCode: "FSH",
        publisher: "WA Health",
        jurisdiction: "Australia/WA",
      }),
      governedSource(4, {
        documentId: "wa-doc-2",
        publisherCode: "EMHS",
        publisher: "East Metropolitan Health Service",
        jurisdiction: "Australia/WA",
      }),
      governedSource(5, {
        documentId: "bmj-doc",
        publisherCode: "BMJ",
        publisher: "BMJ Best Practice",
        jurisdiction: "International",
        validation: "unverified",
      }),
    ];

    const selected = selectModelContextResults({
      routeMode: "strong",
      queryClass: "medication_dose_risk",
      crossDocument: false,
      results: highRiskResults,
    });

    expect(selected.map((result) => result.id)).toEqual(["chunk-1", "chunk-2", "chunk-3", "chunk-4"]);
    expect(new Set(selected.map((result) => result.document_id))).toEqual(new Set(["wa-doc-1", "wa-doc-2"]));
  });

  it("keeps supplementary evidence when authoritative Australian coverage is not sufficient", () => {
    const selected = selectModelContextResults({
      routeMode: "strong",
      queryClass: "table_threshold",
      crossDocument: false,
      results: [
        governedSource(1, {
          documentId: "wa-doc",
          publisherCode: "WACHS",
          publisher: "WA Country Health Service",
          jurisdiction: "Australia/WA",
        }),
        governedSource(2, {
          documentId: "national-doc",
          publisherCode: "TGA",
          publisher: "Therapeutic Goods Administration",
          jurisdiction: "Australia/National",
          validation: "unverified",
        }),
        governedSource(3, {
          documentId: "bmj-doc",
          publisherCode: "BMJ",
          publisher: "BMJ Best Practice",
          jurisdiction: "International",
          validation: "unverified",
        }),
      ],
    });

    expect(selected.map((result) => result.id)).toEqual(["chunk-1", "chunk-2", "chunk-3"]);
  });

  it("does not promote a known international code with conflicting WA metadata", () => {
    const conflict = governedSource(1, {
      documentId: "conflict-doc",
      publisherCode: "BMJ",
      publisher: "BMJ Best Practice",
      jurisdiction: "Australia/WA",
    });
    const waSources = [2, 3, 4, 5].map((index) =>
      governedSource(index, {
        documentId: index % 2 === 0 ? "wa-doc-1" : "wa-doc-2",
        publisherCode: index % 2 === 0 ? "FSH" : "EMHS",
        publisher: index % 2 === 0 ? "Fiona Stanley Fremantle Hospitals Group" : "East Metropolitan Health Service",
        jurisdiction: "Australia/WA",
      }),
    );

    const selected = selectModelContextResults({
      routeMode: "strong",
      queryClass: "medication_dose_risk",
      crossDocument: false,
      results: [conflict, ...waSources],
    });

    expect(selected.map((result) => result.id)).toEqual(["chunk-2", "chunk-3", "chunk-4", "chunk-5"]);
  });

  it("uses a stable context pack cache key for matching retry inputs", () => {
    const key = packedContextCacheKey(results, "broad_summary", { crossDocument: true });
    const sameInputs = packedContextCacheKey([...results], "broad_summary", { crossDocument: true });
    const differentInputs = packedContextCacheKey(results.slice(0, 6), "broad_summary", { crossDocument: true });

    expect(sameInputs).toBe(key);
    expect(differentInputs).not.toBe(key);
  });

  it("includes document-scope for stricter packed context reuse", () => {
    const keyA = packedContextCacheKey(results, "document_lookup", {
      crossDocument: false,
      documentIds: ["doc-1", "doc-2"],
    });
    const keyB = packedContextCacheKey(results, "document_lookup", {
      crossDocument: false,
      documentIds: ["doc-3"],
    });

    expect(keyA).not.toBe(keyB);
  });

  it("reuses packed context keys for the same document filter regardless of order", () => {
    const keyA = packedContextCacheKey(results, "document_lookup", {
      crossDocument: false,
      documentIds: ["doc-2", "doc-1", "doc-1"],
    });
    const keyB = packedContextCacheKey(results, "document_lookup", {
      crossDocument: false,
      documentIds: ["doc-1", "doc-2"],
    });

    expect(keyA).toBe(keyB);
  });
});
