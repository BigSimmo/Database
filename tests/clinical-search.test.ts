import { describe, expect, it } from "vitest";
import {
  buildClinicalTextSearchQuery,
  classifyRagQuery,
  normalizedClinicalSearchTokens,
  rankClinicalResults,
} from "../src/lib/clinical-search";
import type { SearchResult } from "../src/lib/types";

function result(overrides: Partial<SearchResult>): SearchResult {
  return {
    id: overrides.id ?? "chunk-1",
    document_id: overrides.document_id ?? "doc-1",
    title: overrides.title ?? "Guideline",
    file_name: overrides.file_name ?? "guideline.pdf",
    page_number: 1,
    chunk_index: 0,
    section_heading: null,
    content: overrides.content ?? "Treatment process text.",
    image_ids: [],
    similarity: overrides.similarity ?? 0.6,
    hybrid_score: overrides.hybrid_score ?? 0.6,
    images: [],
    ...overrides,
  };
}

describe("clinical search query normalization", () => {
  it("classifies common RAG query shapes for routing and observability", () => {
    expect(classifyRagQuery("Find the NOCC document").queryClass).toBe("document_lookup");
    expect(classifyRagQuery("What ANC threshold should stop clozapine?").queryClass).toBe("table_threshold");
    expect(classifyRagQuery("How are long acting injectable medications managed?").queryClass).toBe(
      "medication_dose_risk",
    );
    expect(classifyRagQuery("Compare admission and discharge requirements").queryClass).toBe("comparison");
    expect(classifyRagQuery("Summarize the discharge guidance").queryClass).toBe("broad_summary");
  });

  it("keeps high-yield clinical terms and removes question filler", () => {
    expect(normalizedClinicalSearchTokens("What safety monitoring is required for clozapine?")).toEqual([
      "safety",
      "monitoring",
      "clozapine",
    ]);
  });

  it("uses AND-style websearch text to avoid broad unsupported OR matches", () => {
    expect(buildClinicalTextSearchQuery("What antibiotic dose is recommended for community-acquired pneumonia?")).toBe(
      "antibiotic dose recommended community acquired pneumonia",
    );
  });

  it("falls back to the original query when only one useful token remains", () => {
    expect(buildClinicalTextSearchQuery("What are NOCC requirements?")).toBe("nocc");
  });

  it("expands community patients to the local Pts abbreviation for title matching", () => {
    expect(buildClinicalTextSearchQuery("What is the process for admission of community patients?")).toBe(
      "admission community pts",
    );
  });

  it("expands active community patients in ED to the local Pt ED title terms", () => {
    expect(buildClinicalTextSearchQuery("How are active community patients in ED managed?")).toBe(
      "active community pt ed",
    );
  });

  it("removes low-value identification filler from exact topic lookups", () => {
    expect(buildClinicalTextSearchQuery("What is required when illegal substances are identified?")).toBe(
      "illegal substance",
    );
  });

  it("removes table-coverage filler while keeping the clinical topic", () => {
    expect(buildClinicalTextSearchQuery("Which table covers agitation and arousal pharmacological management?")).toBe(
      "table agitation arousal pharmacological",
    );
  });

  it("boosts exact treatment team process title matches above broader treatment-process hits", () => {
    const ranked = rankClinicalResults("What is the mental health treatment team process?", [
      result({
        id: "assessment-treatment",
        title: "MHSP.MHATT.AssessmentTreatmentProcess",
        file_name: "MHSP.MHATT.AssessmentTreatmentProcess.pdf",
        hybrid_score: 0.65,
      }),
      result({
        id: "treatment-team",
        title: "MHSP.MHAT.MHCT.TreatmentTeamProcess",
        file_name: "MHSP.MHAT.MHCT.TreatmentTeamProcess.pdf",
        hybrid_score: 0.61,
      }),
    ]);

    expect(ranked[0].id).toBe("treatment-team");
  });

  it("keeps lookup scoring path stable when section and content have clinical tokens", () => {
    const searchQuery = "document lookup section page 3 treatment team review";
    const ranked = rankClinicalResults(searchQuery, [
      result({
        id: "lookup-match",
        title: "Clozapine Prescribing and Monitoring",
        file_name: "clozapine-prescribing.pdf",
        section_heading: "Section 3: Safety Monitoring",
        content: "Monitoring requirements and safety thresholds are listed by section and page.",
        hybrid_score: 0.61,
      }),
      result({
        id: "unrelated",
        title: "Generic Mental Health Notes",
        file_name: "notes.docx",
        section_heading: "Overview",
        content: "General team process and broad guidance references.",
        hybrid_score: 0.75,
      }),
    ]);

    expect(ranked).toHaveLength(2);
    expect(ranked.map((item) => item.id).sort()).toEqual(["lookup-match", "unrelated"]);
  });

  it("uses generated labels and summaries as deterministic ranking signals", () => {
    const ranked = rankClinicalResults("Find the metabolic monitoring document", [
      result({
        id: "metadata-match",
        title: "General Monitoring",
        file_name: "general-monitoring.pdf",
        content: "General review text.",
        hybrid_score: 0.6,
        document_labels: [
          {
            id: "label-1",
            document_id: "doc-1",
            label: "metabolic monitoring",
            label_type: "topic",
            source: "generated",
            confidence: 0.91,
          },
        ],
        document_summary: "Metabolic monitoring requirements and review timing.",
      }),
      result({
        id: "higher-base",
        title: "Generic Monitoring",
        file_name: "generic-monitoring.pdf",
        content: "General monitoring review without specialty specifics.",
        hybrid_score: 0.66,
      }),
    ]);

    expect(ranked[0].id).toBe("metadata-match");
  });

  it("ranks arbitrary newly uploaded documents from generic labels and summaries", () => {
    const ranked = rankClinicalResults("future protocol escalation pathway", [
      result({
        id: "new-upload",
        title: "Ward Reference Pack",
        file_name: "new-upload.pdf",
        content: "General ward reference notes.",
        hybrid_score: 0.55,
        document_labels: [
          {
            id: "label-future",
            document_id: "doc-future",
            label: "escalation pathway",
            label_type: "workflow",
            source: "generated",
            confidence: 0.93,
          },
        ],
        document_summary: "Future protocol escalation pathway for clinical workflow decisions.",
      }),
      result({
        id: "generic",
        title: "Administrative Pack",
        file_name: "generic.pdf",
        content: "General administrative checklist.",
        hybrid_score: 0.66,
      }),
    ]);

    expect(ranked[0].id).toBe("new-upload");
  });

  it("still ranks source chunks when enrichment labels and summaries are absent", () => {
    const ranked = rankClinicalResults("observation interval after medication change", [
      result({
        id: "chunk-match",
        title: "Recently Uploaded Guideline",
        file_name: "recent-upload.pdf",
        content: "After a medication change, the observation interval must be reviewed and documented.",
        hybrid_score: 0.58,
      }),
      result({
        id: "metadata-absent-unrelated",
        title: "Unrelated Uploaded Guideline",
        file_name: "unrelated-upload.pdf",
        content: "Discharge appointment administration and filing process.",
        hybrid_score: 0.62,
      }),
    ]);

    expect(ranked[0].id).toBe("chunk-match");
  });
});
