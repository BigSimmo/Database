import { describe, expect, it } from "vitest";
import { groupSourceGovernanceWarnings, sourceGovernanceWarnings } from "../src/lib/source-governance";
import type { SearchResult } from "../src/lib/types";

function result(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: "chunk-1",
    document_id: "doc-1",
    title: "Guideline",
    file_name: "guideline.pdf",
    page_number: 1,
    chunk_index: 0,
    section_heading: null,
    content: "Clinical text",
    image_ids: [],
    similarity: 0.42,
    source_metadata: {
      source_title: "Guideline",
      publisher: "Non-local publisher",
      jurisdiction: "Elsewhere",
      version: null,
      publication_date: null,
      review_date: null,
      uploaded_at: null,
      indexed_at: null,
      uploaded_by: null,
      document_status: "outdated",
      clinical_validation_status: "unverified",
      extraction_quality: "poor",
    },
    indexing_quality: {
      document_id: "doc-1",
      quality_score: 0.35,
      extraction_quality: "poor",
      metrics: {},
      issues: ["short extraction"],
    },
    table_facts: [
      {
        id: "fact-1",
        document_id: "doc-1",
        source_chunk_id: "chunk-1",
        source_image_id: null,
        page_number: 1,
        table_title: "Admin table",
        row_label: null,
        clinical_parameter: null,
        threshold_value: null,
        action: null,
        metadata: { review_class: "administrative" },
      },
    ],
    images: [],
    ...overrides,
  };
}

describe("source governance warnings", () => {
  it("flags stale, unverified, low-quality, non-local, weak, and weak-table sources", () => {
    const warnings = sourceGovernanceWarnings({
      results: [result()],
      relevance: {
        verdict: "nearby",
        label: "Nearby evidence",
        matchedTerms: [],
        missingTerms: [],
        directSourceCount: 0,
        weakSourceCount: 1,
        score: 0.2,
        supportReason: "Nearby-only evidence.",
        isSourceBacked: false,
      },
    });
    const codes = warnings.map((warning) => warning.code);

    expect(codes).toContain("outdated_source");
    expect(codes).toContain("non_local_source");
    expect(codes).toContain("unverified_source");
    expect(codes).toContain("poor_extraction");
    expect(codes).toContain("low_index_quality");
    expect(codes).toContain("weak_evidence");
    expect(codes).toContain("weak_table_extraction");
  });

  it("groups repeated document-level warnings into one counted message", () => {
    const grouped = groupSourceGovernanceWarnings([
      {
        code: "unverified_source",
        severity: "warning",
        message: "One or more supporting sources have not been locally validated.",
        document_id: "doc-1",
        title: "A",
      },
      {
        code: "unverified_source",
        severity: "warning",
        message: "One or more supporting sources have not been locally validated.",
        document_id: "doc-2",
        title: "B",
      },
      {
        code: "non_local_source",
        severity: "info",
        message: "One or more supporting sources do not appear to be local WA/Perth guidance.",
        document_id: "doc-3",
        title: "C",
      },
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped[0]).toMatchObject({
      code: "unverified_source",
      count: 2,
      message: "2 sources have not been locally validated.",
      titles: ["A", "B"],
    });
  });
});
