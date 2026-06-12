import { describe, expect, it } from "vitest";
import { buildAdditionalEmbeddingFieldInputs } from "../worker/embedding-fields";
import type { TableFactChunkRow, TableFactImageRow, TableFactInsert } from "../worker/table-facts";

const job = {
  document_id: "doc-1",
  documents: {
    owner_id: "owner-1",
    title: "Clinical guideline",
    file_name: "clinical-guideline.pdf",
  },
};

function chunk(overrides: Partial<TableFactChunkRow> = {}): TableFactChunkRow {
  return {
    id: "chunk-1",
    page_number: 2,
    chunk_index: 0,
    image_ids: [],
    section_heading: "Monitoring",
    content: "Monitor FBC and ANC. Withhold clozapine when ANC falls below threshold and repeat FBC.",
    ...overrides,
  };
}

function tableFact(overrides: Partial<TableFactInsert> = {}): TableFactInsert {
  return {
    owner_id: "owner-1",
    document_id: "doc-1",
    source_chunk_id: "chunk-1",
    source_image_id: "image-1",
    page_number: 2,
    table_title: "Clozapine ANC thresholds",
    row_label: "ANC below 1.5",
    clinical_parameter: "ANC",
    threshold_value: "below 1.5 x 10^9/L",
    action: "Withhold clozapine and repeat FBC.",
    normalized_terms: ["clozapine", "anc", "withhold"],
    metadata: {},
    ...overrides,
  };
}

function image(overrides: Partial<TableFactImageRow> = {}): TableFactImageRow {
  return {
    id: "image-1",
    pageNumber: 2,
    imageType: "clinical_table",
    sourceKind: "table_crop",
    caption: "Clozapine ANC thresholds and required action.",
    tableTitle: "Clozapine ANC thresholds",
    tableTextSnippet: "ANC | threshold | action",
    ...overrides,
  };
}

describe("additional embedding fields", () => {
  it("creates bounded high-yield, table-row, action, threshold, and image-caption fields", () => {
    const fields = buildAdditionalEmbeddingFieldInputs({
      job,
      chunkRows: [chunk({ image_ids: ["image-1"] })],
      insertedImages: [image()],
      tableFacts: [tableFact()],
    });

    expect(fields.map((field) => field.field_type)).toEqual(
      expect.arrayContaining([
        "chunk_high_yield",
        "clinical_action",
        "threshold_fact",
        "table_row",
        "image_caption",
      ]),
    );
    expect(fields.every((field) => field.source_chunk_id === "chunk-1")).toBe(true);
    expect(fields.length).toBeLessThanOrEqual(8);
  });

  it("dedupes extra fields by lowercased content", () => {
    const fields = buildAdditionalEmbeddingFieldInputs({
      job,
      chunkRows: [chunk()],
      insertedImages: [],
      tableFacts: [
        tableFact({ action: "Repeat FBC." }),
        tableFact({ action: "repeat fbc." }),
      ],
    });

    const contents = fields.map((field) => field.content.toLowerCase());
    expect(new Set(contents).size).toBe(contents.length);
  });
});
