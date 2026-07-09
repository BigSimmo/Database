import { describe, expect, it } from "vitest";
import {
  buildDocumentIndexUnitInputs,
  countDocumentIndexUnitsByType,
  documentIntelligenceVersion,
  repairOcrDropoutAgainstReference,
} from "../src/lib/document-index-units";

const document = {
  id: "doc-1",
  owner_id: "owner-1",
  title: "Clozapine Monitoring",
  file_name: "clozapine.pdf",
};

describe("document index units", () => {
  it("creates typed deterministic and model-backed clinical index units", () => {
    const units = buildDocumentIndexUnitInputs({
      document,
      chunks: [
        {
          id: "chunk-1",
          document_id: "doc-1",
          page_number: 4,
          chunk_index: 0,
          section_heading: "Monitoring",
          section_path: ["Monitoring"],
          content:
            "If ANC is < 1.5, stop clozapine and seek urgent review. Monitor FBC weekly and document the workflow step.",
          metadata: {},
        },
      ],
      modelProfile: {
        sections: [],
        askable_questions: [
          {
            title: "What ANC threshold stops clozapine?",
            content: "What ANC threshold requires clozapine to stop?",
            source_chunk_ids: ["chunk-1"],
            source_image_ids: [],
            confidence: 0.9,
          },
        ],
        clinical_facts: [
          {
            title: "ANC stop threshold",
            content: "ANC below 1.5 requires stopping clozapine and urgent review.",
            source_chunk_ids: ["chunk-1"],
            source_image_ids: [],
            confidence: 0.92,
          },
        ],
        table_facts: [],
        aliases: [
          {
            alias: "ANC",
            canonical: "absolute neutrophil count",
            alias_type: "clinical_term",
            source_chunk_ids: ["chunk-1"],
            confidence: 0.9,
          },
        ],
        quality_issues: [],
        model: "test-model",
        version: "model-heavy-index-v1",
      },
    });

    expect(units.map((unit) => unit.unit_type)).toEqual(
      expect.arrayContaining(["threshold", "medication_monitoring", "workflow_step", "askable_question", "alias"]),
    );
    expect(units.every((unit) => unit.metadata.document_intelligence_version === documentIntelligenceVersion)).toBe(
      true,
    );
    expect(countDocumentIndexUnitsByType(units)).toMatchObject({
      threshold: expect.any(Number),
      askable_question: 1,
      alias: 1,
    });
  });

  it("creates source-image-backed visual units from structured visual profiles", () => {
    const units = buildDocumentIndexUnitInputs({
      document,
      chunks: [
        {
          id: "chunk-1",
          document_id: "doc-1",
          page_number: 5,
          chunk_index: 0,
          section_heading: "Visual algorithm",
          section_path: ["Visual algorithm"],
          content: "The page contains a risk matrix and flowchart.",
          metadata: {},
        },
      ],
      images: [
        {
          id: "image-1",
          pageNumber: 5,
          imageType: "risk_matrix",
          sourceKind: "page_region",
          caption: "Risk matrix with red-zone escalation action.",
          tableTitle: "Risk matrix",
          structuredVisualProfile: {
            clinical_purpose: "Risk matrix red-zone action",
            key_terms: ["risk", "red zone", "escalation"],
            medications: [],
            thresholds: [{ label: "Red zone", value: "high risk", action: "Escalate urgently", confidence: 0.8 }],
            actions: ["Escalate urgently"],
            monitoring_items: [],
            flowchart_nodes: [{ id: "assess", label: "Assess risk", type: "step" }],
            flowchart_edges: [{ from: "assess", to: "escalate", label: "red zone" }],
            risk_matrix_axes: ["likelihood", "consequence"],
            risk_matrix_cells: [
              {
                row: "High likelihood",
                column: "Severe consequence",
                risk: "Red",
                action: "Escalate",
                confidence: 0.9,
              },
            ],
            chart_axes: [],
            chart_findings: [],
            table_column_roles: {},
            source_regions: [],
            confidence: 0.86,
          },
          candidatePriorityScore: 0.9,
          imageQualityScore: 0.8,
        },
      ],
    });

    expect(units.map((unit) => unit.unit_type)).toEqual(
      expect.arrayContaining([
        "visual_summary",
        "visual_askable_question",
        "table_threshold",
        "flowchart_step",
        "diagram_decision",
        "risk_matrix_cell",
      ]),
    );
    expect(
      units.filter((unit) => unit.unit_type.startsWith("visual")).every((unit) => unit.source_image_id === "image-1"),
    ).toBe(true);
    expect(units.find((unit) => unit.unit_type === "risk_matrix_cell")?.metadata.visual_intelligence_version).toBe(
      "visual-intelligence-v1",
    );
    expect(units.find((unit) => unit.unit_type === "risk_matrix_cell")?.metadata).toMatchObject({
      generated_by: "local-worker",
      source_image_id: "image-1",
      page_number: 5,
    });
  });

  it("indexes only the best representative for duplicate visual families", () => {
    const units = buildDocumentIndexUnitInputs({
      document,
      chunks: [
        {
          id: "chunk-1",
          document_id: "doc-1",
          page_number: 2,
          chunk_index: 0,
          section_heading: "Table",
          section_path: ["Table"],
          content: "The page contains duplicated table crops.",
          metadata: {},
        },
      ],
      images: [
        {
          id: "image-low",
          pageNumber: 2,
          sourceKind: "table_crop",
          tableTitle: "ANC table duplicate",
          tableRows: [["ANC", "< 1.0", "Stop"]],
          tableColumns: ["Parameter", "Threshold", "Action"],
          candidatePriorityScore: 0.55,
          imageQualityScore: 0.5,
          metadata: { visual_family_id: "family-anc", visual_duplicate_group: "dup-anc" },
        },
        {
          id: "image-best",
          pageNumber: 2,
          sourceKind: "table_crop",
          tableTitle: "ANC table",
          tableRows: [["ANC", "< 1.0", "Stop"]],
          tableColumns: ["Parameter", "Threshold", "Action"],
          candidatePriorityScore: 0.92,
          imageQualityScore: 0.9,
          metadata: { visual_family_id: "family-anc", visual_duplicate_group: "dup-anc" },
        },
      ],
    });

    const visualUnits = units.filter((unit) => unit.metadata.source === "visual_intelligence");

    expect(visualUnits.length).toBeGreaterThan(0);
    expect(visualUnits.every((unit) => unit.source_image_id === "image-best")).toBe(true);
    expect(visualUnits.every((unit) => unit.metadata.visual_family_id === "family-anc")).toBe(true);
  });

  it("creates typed visual fallback units for sparse table images", () => {
    const units = buildDocumentIndexUnitInputs({
      document,
      chunks: [
        {
          id: "chunk-1",
          document_id: "doc-1",
          page_number: 3,
          chunk_index: 0,
          section_heading: "Medication chart",
          section_path: ["Medication chart"],
          content: "The page includes a medication chart image.",
          metadata: {},
        },
      ],
      images: [
        {
          id: "image-sparse-med",
          pageNumber: 3,
          imageType: "medication_chart",
          sourceKind: "table_crop",
          caption: "Agitation medication dose and route chart.",
          tableTitle: "Agitation medication chart",
          tableRows: [["Lorazepam", "1 mg", "IM or PO"]],
          tableColumns: ["Medication", "Dose", "Route"],
          candidatePriorityScore: 0.7,
          imageQualityScore: 0.7,
          metadata: {},
        },
      ],
    });

    expect(units.map((unit) => unit.unit_type)).toEqual(
      expect.arrayContaining(["visual_summary", "visual_askable_question", "medication_chart_row"]),
    );
    expect(units.find((unit) => unit.unit_type === "medication_chart_row")).toMatchObject({
      source_image_id: "image-sparse-med",
      metadata: expect.objectContaining({ visual_item_type: "sparse_visual_fallback" }),
    });
  });

  it("repairs whitespace-fragmented OCR words against the source chunk", () => {
    const units = buildDocumentIndexUnitInputs({
      document,
      chunks: [
        {
          id: "chunk-1",
          document_id: "doc-1",
          page_number: 7,
          chunk_index: 0,
          section_heading: "Discharge",
          section_path: ["Discharge"],
          content: "Psychosocial interventions should be documented before discharge.",
          metadata: {},
        },
      ],
      images: [
        {
          id: "image-ocr",
          pageNumber: 7,
          sourceKind: "table_crop",
          tableTitle: "Discharge table",
          tableRows: [["p ycho ocial", "Document before discharge"]],
          tableColumns: ["Intervention", "Action"],
          metadata: {},
        },
      ],
    });

    const repaired = units.find((unit) => unit.metadata.ocr_repair_version === "clean-chunk-fragment-v1");
    expect(repaired?.content).toContain("psychosocial");
    expect(repaired?.metadata.ocr_replacements).toEqual(
      expect.arrayContaining([expect.objectContaining({ from: "p ycho ocial", to: "psychosocial" })]),
    );
  });

  it("does not drop isolated single-letter clinical tokens during OCR repair", () => {
    const { text, replacements } = repairOcrDropoutAgainstReference(
      "vitamin D deficiency may require supplementation",
      "vitamin D deficiency monitoring protocol",
    );

    expect(text).toContain("vitamin D");
    expect(replacements).toEqual([]);
  });

  it("still repairs whitespace-fragmented OCR words against the source chunk", () => {
    const { text, replacements } = repairOcrDropoutAgainstReference(
      "p ycho ocial",
      "Psychosocial interventions should be documented before discharge.",
    );

    expect(text).toContain("psychosocial");
    expect(replacements).toEqual([expect.objectContaining({ from: "p ycho ocial", to: "psychosocial" })]);
  });
});
