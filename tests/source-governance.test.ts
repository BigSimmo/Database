import { describe, expect, it } from "vitest";
import {
  frontendSourceGovernanceWarnings,
  groupSourceGovernanceWarnings,
  hasDangerSourceGovernanceWarning,
  sourceGovernanceRefusalAnswer,
  sourceGovernanceWarnings,
} from "../src/lib/source-governance";
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

  it("identifies danger-class warnings for server-side answer refusal", () => {
    const warnings = sourceGovernanceWarnings({ results: [result()] });

    expect(hasDangerSourceGovernanceWarning(warnings)).toBe(true);
    expect(hasDangerSourceGovernanceWarning(warnings.filter((warning) => warning.severity !== "danger"))).toBe(false);
  });

  it("does not danger-refuse usable content just because review metadata is missing", () => {
    const warnings = sourceGovernanceWarnings({
      results: [
        result({
          source_metadata: undefined,
          indexing_quality: {
            document_id: "doc-1",
            quality_score: 0.92,
            extraction_quality: "good",
            metrics: {},
            issues: [],
          },
          table_facts: [],
        }),
      ],
    });

    expect(warnings).toEqual([expect.objectContaining({ code: "unverified_source", severity: "warning" })]);
    expect(hasDangerSourceGovernanceWarning(warnings)).toBe(false);
  });

  it("keeps routine review metadata notes out of frontend-visible governance warnings", () => {
    const warnings = sourceGovernanceWarnings({
      results: [
        result({
          source_metadata: {
            source_title: "Review due local source",
            publisher: "WA Health",
            jurisdiction: "Australia/WA",
            version: null,
            publication_date: null,
            review_date: null,
            uploaded_at: null,
            indexed_at: null,
            uploaded_by: null,
            document_status: "review_due",
            clinical_validation_status: "unverified",
            extraction_quality: "good",
          },
          indexing_quality: {
            document_id: "doc-1",
            quality_score: 0.9,
            extraction_quality: "good",
            metrics: {},
            issues: [],
          },
          table_facts: [],
        }),
      ],
    });

    expect(warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining(["review_due_source", "unverified_source"]),
    );
    expect(frontendSourceGovernanceWarnings(warnings)).toEqual([]);
  });

  it("surfaces only clinically material warnings to the frontend", () => {
    const warnings = sourceGovernanceWarnings({
      results: [result()],
      relevance: {
        verdict: "none",
        label: "No evidence",
        matchedTerms: [],
        missingTerms: [],
        directSourceCount: 0,
        weakSourceCount: 0,
        score: 0,
        supportReason: "No source-backed evidence.",
        isSourceBacked: false,
      },
    });
    const visibleCodes = frontendSourceGovernanceWarnings(warnings).map((warning) => warning.code);

    expect(visibleCodes).toEqual(expect.arrayContaining(["weak_evidence", "outdated_source", "poor_extraction"]));
    expect(visibleCodes).not.toContain("review_due_source");
    expect(visibleCodes).not.toContain("unverified_source");
    expect(visibleCodes).not.toContain("non_local_source");
  });

  it("keeps the refusal message free of backend and source-backed wording", () => {
    expect(sourceGovernanceRefusalAnswer).not.toMatch(/source-backed|source-governance|admin|need review/i);
    expect(sourceGovernanceRefusalAnswer).toContain("matched documents are not suitable for clinical use yet");
  });
});
