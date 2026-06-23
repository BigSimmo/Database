import { describe, expect, it } from "vitest";
import {
  buildDocumentIndexUnitInputs,
  countDocumentIndexUnitsByType,
  documentIntelligenceVersion,
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
});
