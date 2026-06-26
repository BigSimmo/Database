import { describe, expect, it } from "vitest";
import { selectModelContextResults } from "../src/lib/rag";
import type { RagQueryClass, SearchResult } from "../src/lib/types";

function source(index: number): SearchResult {
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
  };
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
    expect(select({ routeMode: "fast", queryClass: "medication_dose_risk" })).toHaveLength(12);
    expect(select({ routeMode: "fast", queryClass: "document_lookup", crossDocument: true })).toHaveLength(12);
  });

  it("does not limit strong generation or non-model routes", () => {
    expect(select({ routeMode: "strong", queryClass: "document_lookup" })).toHaveLength(12);
    expect(select({ routeMode: "extractive", queryClass: "document_lookup" })).toHaveLength(12);
    expect(select({ routeMode: "unsupported", queryClass: "unsupported_or_general" })).toHaveLength(12);
  });
});
