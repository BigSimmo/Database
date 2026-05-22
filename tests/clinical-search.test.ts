import { describe, expect, it } from "vitest";
import { clinicalRankScore, expandClinicalQuery, rankClinicalResults } from "../src/lib/clinical-search";
import type { SearchResult } from "../src/lib/types";

function source(overrides: Partial<SearchResult>): SearchResult {
  return {
    id: "source-a",
    document_id: "doc-a",
    title: "General source",
    file_name: "general.pdf",
    page_number: 1,
    chunk_index: 0,
    section_heading: "General",
    content: "General background information.",
    image_ids: [],
    similarity: 0.7,
    images: [],
    ...overrides,
  };
}

describe("clinical search ranking", () => {
  it("expands clinical safety and monitoring terms with lightweight synonyms", () => {
    expect(expandClinicalQuery("urgent escalation")).toContain("red flag");
    expect(expandClinicalQuery("monitoring plan")).toContain("blood test");
  });

  it("boosts exact title and safety content matches", () => {
    const matched = source({
      id: "matched",
      title: "Lithium monitoring protocol",
      content: "Escalate urgent review for toxicity warning features.",
      similarity: 0.7,
    });
    const generic = source({ id: "generic", title: "Other source", similarity: 0.72 });

    expect(clinicalRankScore("lithium urgent escalation", matched)).toBeGreaterThan(
      clinicalRankScore("lithium urgent escalation", generic),
    );
  });

  it("prefers current approved sources over outdated sources when otherwise close", () => {
    const current = source({
      id: "current",
      similarity: 0.7,
      source_metadata: {
        source_title: null,
        publisher: null,
        jurisdiction: "Australia/WA",
        version: null,
        publication_date: null,
        review_date: null,
        uploaded_at: null,
        indexed_at: null,
        uploaded_by: null,
        document_status: "current",
        clinical_validation_status: "approved",
        extraction_quality: "good",
      },
    });
    const outdated = source({
      id: "outdated",
      similarity: 0.71,
      source_metadata: {
        source_title: null,
        publisher: null,
        jurisdiction: "Australia/WA",
        version: null,
        publication_date: null,
        review_date: null,
        uploaded_at: null,
        indexed_at: null,
        uploaded_by: null,
        document_status: "outdated",
        clinical_validation_status: "unverified",
        extraction_quality: "good",
      },
    });

    expect(rankClinicalResults("monitoring", [outdated, current])[0].id).toBe("current");
  });
});
