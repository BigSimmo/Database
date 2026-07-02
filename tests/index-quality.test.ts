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
      insertedImages: [
        {
          sourceKind: "table_crop",
          tableRows: [["ANC", "withhold"]],
          imageQualityScore: 1,
          cropCompleteness: 1,
          structuredVisualProfile: { confidence: 1, thresholds: [{}] },
        },
      ],
      sectionCount: 3,
      memoryCardCount: 6,
      documentEmbeddingFieldTypes: ["document_title", "document_summary"],
    });

    expect(quality.extractionQuality).toBe("good");
    expect(quality.qualityScore).toBe(1);
    expect(quality.issues).toEqual([]);
  });

  it("tracks structured visual extraction and visual unit coverage", () => {
    const quality = assessDocumentIndexQuality({
      metrics: {
        page_count: 4,
        text_character_count: 10_000,
        extracted_image_count: 3,
        searchable_image_count: 3,
      },
      chunks: Array.from({ length: 6 }, (_, index) => ({
        content: `Distinct visual-heavy chunk ${index} with enough clinical text, action detail, and source context for indexing.`,
        section_heading: `Section ${index}`,
        section_path: ["Guideline", `Section ${index}`],
      })),
      insertedImages: [
        {
          sourceKind: "table_crop",
          tableRows: [["ANC", "withhold"]],
          imageQualityScore: 0.9,
          cropCompleteness: 0.9,
          structuredVisualProfile: { confidence: 0.84, thresholds: [{}] },
        },
        {
          sourceKind: "page_region",
          imageQualityScore: 0.82,
          cropCompleteness: 0.72,
          structuredVisualProfile: { confidence: 0.78, flowchart_nodes: [{}] },
        },
        {
          sourceKind: "page_region",
          imageQualityScore: 0.8,
          cropCompleteness: 0.7,
          structuredVisualProfile: { confidence: 0.74, risk_matrix_cells: [{}] },
        },
      ],
      sectionCount: 2,
      memoryCardCount: 4,
      documentEmbeddingFieldTypes: ["document_title", "document_summary"],
    });

    expect(quality.metrics.visual_unit_coverage).toBe(1);
    expect(quality.metrics.average_structured_visual_confidence).toBeGreaterThan(0.75);
    expect(quality.issues).not.toContain("low visual unit coverage");
  });

  it("forces poor quality and flags an actionable issue for un-OCR'd image-only PDFs (CI-6)", () => {
    const quality = assessDocumentIndexQuality({
      metrics: {
        page_count: 5,
        text_character_count: 30, // only incidental header text
        extracted_image_count: 5,
        searchable_image_count: 0,
        needs_ocr_page_count: 5, // every page is image-only and was not OCR'd
      },
      chunks: [],
      insertedImages: [],
      sectionCount: 0,
      memoryCardCount: 0,
      documentEmbeddingFieldTypes: [],
    });

    expect(quality.extractionQuality).toBe("poor");
    expect(quality.issues).toEqual(
      expect.arrayContaining([expect.stringContaining("image-only pages not OCR'd (5 of 5)")]),
    );
  });

  it("flags a minority of un-OCR'd pages without forcing an otherwise-strong index to poor", () => {
    const quality = assessDocumentIndexQuality({
      metrics: {
        page_count: 10,
        text_character_count: 24_000,
        extracted_image_count: 1,
        searchable_image_count: 1,
        needs_ocr_page_count: 1, // a single image-only page in an otherwise strong text PDF
      },
      chunks: Array.from({ length: 12 }, (_, index) => ({
        content: `Distinct clinical passage ${index} with monitoring action, threshold detail, and section context for complete retrieval.`,
        section_heading: `Section ${index}`,
        section_path: ["Guideline", `Section ${index}`],
      })),
      insertedImages: [
        {
          sourceKind: "table_crop",
          tableRows: [["ANC", "withhold"]],
          imageQualityScore: 1,
          cropCompleteness: 1,
          structuredVisualProfile: { confidence: 1, thresholds: [{}] },
        },
      ],
      sectionCount: 3,
      memoryCardCount: 6,
      documentEmbeddingFieldTypes: ["document_title", "document_summary"],
    });

    expect(quality.issues).toEqual(
      expect.arrayContaining([expect.stringContaining("image-only pages not OCR'd (1 of 10)")]),
    );
    expect(quality.extractionQuality).not.toBe("poor");
  });
});
