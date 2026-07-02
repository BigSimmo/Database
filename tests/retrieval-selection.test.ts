import { describe, expect, it } from "vitest";
import {
  buildRetrievalIntent,
  selectRetrievalEvidence,
  summarizeRetrievalSelection,
} from "../src/lib/retrieval-selection";
import type { SearchResult } from "../src/lib/types";

function source(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: overrides.id ?? "chunk-1",
    document_id: overrides.document_id ?? "doc-1",
    title: overrides.title ?? "Clinical Guideline",
    file_name: overrides.file_name ?? "guideline.pdf",
    page_number: overrides.page_number ?? 1,
    chunk_index: overrides.chunk_index ?? 0,
    section_heading: overrides.section_heading ?? null,
    content: overrides.content ?? "Clinical guidance text.",
    image_ids: [],
    similarity: overrides.similarity ?? 0.55,
    hybrid_score: overrides.hybrid_score ?? 0.55,
    images: [],
    ...overrides,
  };
}

function sourceMetadata(
  overrides: Partial<NonNullable<SearchResult["source_metadata"]>> = {},
): NonNullable<SearchResult["source_metadata"]> {
  return {
    source_title: null,
    publisher: null,
    jurisdiction: null,
    version: null,
    publication_date: null,
    review_date: null,
    uploaded_at: null,
    indexed_at: null,
    uploaded_by: null,
    document_status: "current",
    clinical_validation_status: "locally_reviewed",
    extraction_quality: "good",
    ...overrides,
  };
}

describe("retrieval source selection", () => {
  it("rescues active-community ED document evidence above generic community hits", () => {
    const selection = selectRetrievalEvidence({
      query: "How are active community patients in ED managed?",
      queryClass: "document_lookup",
      topK: 3,
      maxResultsPerDocument: 2,
      results: [
        source({
          id: "generic-community",
          document_id: "generic-doc",
          title: "Community Process Overview",
          file_name: "community-process.pdf",
          content: "Community mental health process overview.",
          hybrid_score: 0.76,
        }),
        source({
          id: "active-community-ed",
          document_id: "active-community-doc",
          title: "MHSP Active Community Pt ED",
          file_name: "MHSP.ActiveCommunityPtED.pdf",
          content:
            "Active community patients in the Emergency Department require liaison with the community team and ED handover.",
          hybrid_score: 0.52,
          match_explanation: { titleHit: true, contentHit: true, reasons: ["title"] },
        }),
      ],
    });

    expect(selection.results[0].id).toBe("active-community-ed");
    expect(selection.intent.needsPatientEducation).toBe(true);
    expect(selection.summary.requiredSignalsSatisfied).toBe(true);
    expect(selection.summary.matchedSignals).toEqual(expect.arrayContaining(["active_community", "ed"]));
    expect(selection.summary.rescueApplied).toBe(true);
  });

  it("promotes medication-chart route evidence for agitation IM/PO options without requiring a numeric dose", () => {
    const intent = buildRetrievalIntent("What IM or PO options are listed for agitation?", "medication_dose_risk");
    const selection = selectRetrievalEvidence({
      query: "What IM or PO options are listed for agitation?",
      queryClass: "medication_dose_risk",
      topK: 3,
      maxResultsPerDocument: 2,
      results: [
        source({
          id: "agitation-overview",
          title: "Agitation Overview",
          content: "Agitation management includes de-escalation and observation.",
          hybrid_score: 0.72,
        }),
        source({
          id: "agitation-route-row",
          document_id: "agitation-doc",
          title: "Agitation and Arousal Pharmacological Management",
          file_name: "MHSP.AgitationArousalPharmaMgt.pdf",
          section_heading: "Medication chart",
          content:
            "Medication chart options list oral medication when accepted and IM medication when oral is refused.",
          hybrid_score: 0.5,
          index_unit: {
            id: "unit-agitation-route",
            unit_type: "medication_chart_row",
            title: "Agitation medication route options",
            content: "Oral and IM medication options for agitation.",
            source_chunk_id: "agitation-route-row",
            source_image_id: null,
            page_start: 4,
            page_end: 4,
            heading_path: ["Medication chart"],
            normalized_terms: ["agitation", "oral", "im"],
            quality_score: 0.88,
            extraction_mode: "hybrid",
          },
        }),
      ],
    });

    expect(intent.requiredTermSignals).toEqual(expect.arrayContaining(["agitation", "route"]));
    expect(intent.requiredTermSignals).not.toContain("dose_amount");
    expect(selection.results[0].id).toBe("agitation-route-row");
    expect(selection.summary.requiredSignalsSatisfied).toBe(true);
    expect(selection.summary.topChunkTypes.medication_chart).toBeGreaterThan(0);
  });

  it("promotes flowchart next-step evidence for red-zone pathway questions", () => {
    const selection = selectRetrievalEvidence({
      query: "In the clinical flowchart, what is the next step after red-zone risk?",
      queryClass: "document_lookup",
      topK: 3,
      maxResultsPerDocument: 2,
      results: [
        source({
          id: "risk-overview",
          title: "Risk Overview",
          content: "Risk review background.",
          hybrid_score: 0.74,
        }),
        source({
          id: "red-zone-flowchart",
          title: "Risk Matrix Flowchart",
          file_name: "risk-flowchart.pdf",
          section_heading: "Red zone flowchart",
          content: "Flowchart red zone: next step is urgent senior review and escalation.",
          hybrid_score: 0.48,
          index_unit: {
            id: "unit-red-zone",
            unit_type: "flowchart_step",
            title: "Red zone next step",
            content: "Next step after red zone risk is urgent senior review.",
            source_chunk_id: "red-zone-flowchart",
            source_image_id: "image-1",
            page_start: 3,
            page_end: 3,
            heading_path: ["Risk flowchart"],
            normalized_terms: ["red zone", "next step", "urgent review"],
            quality_score: 0.9,
            extraction_mode: "hybrid",
          },
        }),
      ],
    });

    expect(selection.results[0].id).toBe("red-zone-flowchart");
    expect(selection.intent.needsFlowchartStep).toBe(true);
    expect(selection.summary.requiredSignalsSatisfied).toBe(true);
    expect(selection.summary.matchedSignals).toEqual(
      expect.arrayContaining(["flowchart", "flowchart_or_pathway", "next_step_or_action"]),
    );
  });

  it("marks medication dose-route chart evidence as strong selected support", () => {
    const selected = summarizeRetrievalSelection({
      query: "What dose and route are shown in the agitation medication chart?",
      queryClass: "medication_dose_risk",
      results: [
        source({
          id: "agitation-dose-route",
          document_id: "agitation-doc",
          title: "Agitation and Arousal Pharmacological Management",
          file_name: "MHSP.AgitationArousalPharmaMgt.pdf",
          section_heading: "Medication chart",
          content: "Lorazepam 1 mg IM or PO is listed in the agitation medication chart.",
          hybrid_score: 0.66,
          index_unit: {
            id: "unit-dose-route",
            unit_type: "medication_chart_row",
            title: "Lorazepam dose route row",
            content: "Lorazepam 1 mg IM or PO.",
            source_chunk_id: "agitation-dose-route",
            source_image_id: null,
            page_start: 5,
            page_end: 5,
            heading_path: ["Medication chart"],
            normalized_terms: ["lorazepam", "1 mg", "im", "po"],
            quality_score: 0.92,
            extraction_mode: "hybrid",
          },
        }),
      ],
    });

    expect(selected.intent.needsMedicationChart).toBe(true);
    expect(selected.intent.needsDoseRouteFrequency).toBe(true);
    expect(selected.summary.requiredSignalsSatisfied).toBe(true);
    expect(selected.summary.matchedSignals).toEqual(
      expect.arrayContaining(["medication_chart", "dose_amount", "route", "agitation"]),
    );
  });

  it("promotes exact source-table image evidence for clozapine ANC visual requests", () => {
    const selection = selectRetrievalEvidence({
      query: "Show the source table image for the clozapine ANC monitoring table.",
      queryClass: "table_threshold",
      topK: 3,
      maxResultsPerDocument: 2,
      results: [
        source({
          id: "clozapine-overview",
          document_id: "clozapine-doc",
          title: "Clozapine Prescribing Administration Monitoring",
          file_name: "MHSP.ClozapinePrescribingAdministrationMonitoring.pdf",
          content: "Clozapine monitoring overview with blood-test guidance.",
          hybrid_score: 0.78,
        }),
        source({
          id: "clozapine-anc-table-image",
          document_id: "clozapine-doc",
          title: "Clozapine Prescribing Administration Monitoring",
          file_name: "MHSP.ClozapinePrescribingAdministrationMonitoring.pdf",
          section_heading: "ANC monitoring table",
          content: "The clozapine ANC monitoring table is available as a source image.",
          image_ids: ["image-anc"],
          hybrid_score: 0.5,
          table_facts: [
            {
              id: "fact-anc",
              document_id: "clozapine-doc",
              source_chunk_id: "clozapine-anc-table-image",
              source_image_id: "image-anc",
              page_number: 2,
              table_title: "Clozapine ANC monitoring table",
              row_label: "ANC",
              clinical_parameter: "ANC",
              threshold_value: "ANC threshold",
              action: "Review according to the table.",
            },
          ],
          images: [
            {
              id: "image-anc",
              page_number: 2,
              storage_path: "documents/clozapine/page-2/table.png",
              caption: "Clozapine ANC monitoring table",
              image_type: "clinical_table",
              searchable: true,
              clinical_relevance_score: 0.95,
              sourceKind: "table_crop",
              tableTitle: "Clozapine ANC monitoring table",
              tableTextSnippet: "ANC threshold monitoring table",
            },
          ],
        }),
      ],
    });

    expect(selection.results[0].id).toBe("clozapine-anc-table-image");
    expect(selection.intent.needsSourceImage).toBe(true);
    expect(selection.intent.needsExactVisualTable).toBe(true);
    expect(selection.summary.requiredSignalsSatisfied).toBe(true);
    expect(selection.summary.matchedSignals).toEqual(
      expect.arrayContaining(["source_image", "visual_table", "table", "clozapine", "anc"]),
    );
  });

  it("prefers current locally reviewed clozapine threshold evidence over close review-required sources", () => {
    const selection = selectRetrievalEvidence({
      query: "What ANC or FBC threshold should withhold clozapine?",
      queryClass: "table_threshold",
      topK: 5,
      maxResultsPerDocument: 1,
      results: [
        source({
          id: "review-due-shared-care",
          document_id: "review-due-doc",
          title: "Clozapine GP Shared Care",
          file_name: "Clozapine GP Shared Care (FSH).pdf",
          content: "Clozapine FBC and ANC blood count monitoring threshold information.",
          hybrid_score: 0.99,
          source_metadata: sourceMetadata({
            document_status: "review_due",
            clinical_validation_status: "unverified",
          }),
        }),
        source({
          id: "current-unverified-bmj",
          document_id: "bmj-doc",
          title: "Schizophrenia",
          file_name: "Schizophrenia.pdf",
          content: "Clozapine ANC and FBC monitoring for neutrophil thresholds.",
          hybrid_score: 0.98,
          source_metadata: sourceMetadata({
            publisher: "BMJ Best Practice",
            jurisdiction: "International",
            clinical_validation_status: "unverified",
          }),
        }),
        ...["fsh", "nmhs", "akg", "camhs", "smhs"].map((site, index) =>
          source({
            id: `current-local-${site}`,
            document_id: `current-local-${site}-doc`,
            title: "Clozapine Prescribing Administration Monitoring",
            file_name: `Clozapine Prescribing Administration Monitoring (${site.toUpperCase()}).pdf`,
            content: "Clozapine ANC and FBC threshold table: withhold clozapine and review blood results.",
            hybrid_score: 0.94 - index * 0.01,
            source_metadata: sourceMetadata({
              publisher: "WA Health",
              jurisdiction: "Australia/WA",
            }),
          }),
        ),
      ],
    });

    expect(selection.results).toHaveLength(5);
    expect(selection.results.map((result) => result.id)).toEqual([
      "current-local-fsh",
      "current-local-nmhs",
      "current-local-akg",
      "current-local-camhs",
      "current-local-smhs",
    ]);
    expect(
      selection.results.every((result) => result.source_metadata?.clinical_validation_status === "locally_reviewed"),
    ).toBe(true);
  });

  it("prefers risk/red-zone flowchart evidence over generic flowchart evidence", () => {
    const selection = selectRetrievalEvidence({
      query: "In the clinical flowchart, what is the next step after red-zone risk?",
      queryClass: "document_lookup",
      topK: 2,
      maxResultsPerDocument: 2,
      results: [
        source({
          id: "generic-flowchart",
          title: "Generic Admission Flowchart",
          file_name: "generic-flowchart.pdf",
          content: "Flowchart pathway overview with general process steps.",
          hybrid_score: 0.72,
          index_unit: {
            id: "unit-generic-flowchart",
            unit_type: "flowchart_step",
            title: "Generic flowchart",
            content: "General flowchart process step.",
            source_chunk_id: "generic-flowchart",
            source_image_id: "image-generic",
            page_start: 1,
            page_end: 1,
            heading_path: ["Flowchart"],
            normalized_terms: ["flowchart", "process"],
            quality_score: 0.9,
            extraction_mode: "hybrid",
          },
        }),
        source({
          id: "risk-red-zone-flowchart",
          title: "Risk Matrix Flowchart",
          file_name: "risk-flowchart.pdf",
          section_heading: "Red zone risk",
          content: "Risk matrix flowchart red zone: next step is urgent senior review and escalation.",
          hybrid_score: 0.5,
          images: [
            {
              id: "image-risk",
              page_number: 3,
              storage_path: "documents/risk/page-3/flowchart.png",
              caption: "Red-zone risk flowchart",
              image_type: "flowchart_algorithm",
              searchable: true,
              clinical_relevance_score: 0.94,
              sourceKind: "diagram_crop",
            },
          ],
          index_unit: {
            id: "unit-risk-red",
            unit_type: "flowchart_step",
            title: "Red-zone risk next step",
            content: "Red-zone risk requires urgent senior review and escalation.",
            source_chunk_id: "risk-red-zone-flowchart",
            source_image_id: "image-risk",
            page_start: 3,
            page_end: 3,
            heading_path: ["Risk matrix", "Red zone"],
            normalized_terms: ["risk", "red zone", "next step", "urgent escalation"],
            quality_score: 0.92,
            extraction_mode: "hybrid",
          },
        }),
      ],
    });

    expect(selection.results[0].id).toBe("risk-red-zone-flowchart");
    expect(selection.intent.needsRiskFlowchart).toBe(true);
    expect(selection.summary.requiredSignalsSatisfied).toBe(true);
    expect(selection.summary.matchedSignals).toEqual(expect.arrayContaining(["risk", "red_zone"]));
  });
});
