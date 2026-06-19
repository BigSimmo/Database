import { describe, expect, it } from "vitest";
import { assessDocumentIndexQuality } from "../src/lib/index-quality";

describe("index quality scoring", () => {
  it("penalizes missing structured and document-level indexing coverage", () => {
    const quality = assessDocumentIndexQuality({
      metrics: {
        page_count: 20,
        text_character_count: 2_400,
        extracted_image_count: 1,
        searchable_image_count: 1,
      },
      chunks: Array.from({ length: 6 }, (_, index) => ({
        content: index < 3 ? "Repeated short chunk." : `Brief chunk ${index}.`,
        section_heading: null,
        section_path: [],
      })),
      insertedImages: [{ sourceKind: "table_crop", tableRows: [] }],
      sectionCount: 0,
      memoryCardCount: 0,
      documentEmbeddingFieldTypes: ["document_title"],
    });

    expect(quality.extractionQuality).not.toBe("good");
    expect(quality.qualityScore).toBeLessThan(0.82);
    expect(quality.issues).toEqual(
      expect.arrayContaining([
        "low chunk coverage for page count",
        "low text coverage for page count",
        "no structured sections",
        "no memory cards",
        "missing document summary embedding",
      ]),
    );
  });

  it("flags image-heavy indexes that did not produce searchable visual evidence", () => {
    const quality = assessDocumentIndexQuality({
      metrics: {
        page_count: 8,
        text_character_count: 16_000,
        extracted_image_count: 6,
        searchable_image_count: 1,
      },
      chunks: Array.from({ length: 8 }, (_, index) => ({
        content: `Distinct indexed passage ${index} with enough clinical text to avoid short chunk penalties and preserve retrieval context.`,
        section_heading: `Section ${index}`,
        section_path: ["Guideline", `Section ${index}`],
      })),
      insertedImages: [
        { sourceKind: "table_crop", tableRows: [["Parameter", "Action"]] },
        { sourceKind: "table_crop", tableRows: [] },
      ],
      sectionCount: 4,
      memoryCardCount: 8,
      documentEmbeddingFieldTypes: ["document_title", "document_summary"],
    });

    expect(quality.issues).toContain("low searchable image coverage");
    expect(quality.metrics.searchable_image_coverage).toBe(0.167);
  });

  it("reserves perfect scores for complete, low-duplication structured indexes", () => {
    const quality = assessDocumentIndexQuality({
      metrics: {
        page_count: 4,
        text_character_count: 18_000,
        extracted_image_count: 1,
        searchable_image_count: 1,
      },
      chunks: Array.from({ length: 8 }, (_, index) => ({
        content: `Distinct clinical chunk ${index} with monitoring action, threshold detail, section context, source citation, patient-safety qualifiers, and enough text volume to represent a complete extracted passage from the guideline.`,
        section_heading: `Section ${index}`,
        section_path: ["Guideline", `Section ${index}`],
      })),
      insertedImages: [{ sourceKind: "table_crop", tableRows: [["ANC", "withhold"]] }],
      sectionCount: 3,
      memoryCardCount: 6,
      documentEmbeddingFieldTypes: ["document_title", "document_summary"],
    });

    expect(quality.extractionQuality).toBe("good");
    expect(quality.qualityScore).toBe(1);
    expect(quality.issues).toEqual([]);
  });
});
