import { describe, expect, it } from "vitest";

import { tableFromImage } from "../eval/docling/harness/legacy-tables";
import type { ExtractedImage } from "../src/lib/types";

/**
 * Audit L117: the legacy runner read the table row/column COUNTS from
 * `metadata.table_rows` / `metadata.table_columns`. worker/python/
 * extract_pdf_assets.py emits those two keys as arrays — `table_rows` is a list
 * of row lists, `table_columns` a list of header cells — and puts the counts in
 * `row_count` / `column_count`. The `typeof === "number"` filter therefore made
 * both fields permanently null in out/raw. Scoring is unaffected (score.py reads
 * `markdown` only), so this is a lab-output correctness fix, not a Gate B change.
 */
function tableCropImage(metadata: Record<string, unknown>): ExtractedImage {
  return {
    path: "/tmp/page-1-table-crop-1.png",
    mimeType: "image/png",
    pageNumber: 1,
    sourceKind: "table_crop",
    metadata,
  } as ExtractedImage;
}

describe("docling lab legacy runner table counts (L117)", () => {
  it("reads the counts from row_count/column_count, the keys the extractor actually emits", () => {
    const table = tableFromImage(
      tableCropImage({
        accessible_table_markdown: "| Dose | Frequency |\n| --- | --- |\n| 10 mg | daily |",
        // Shapes copied from extract_pdf_assets.py's crop_metadata: arrays, not counts.
        table_rows: [
          ["Dose", "Frequency"],
          ["10 mg", "daily"],
        ],
        table_columns: ["Dose", "Frequency"],
        row_count: 2,
        column_count: 2,
      }),
    );

    expect(table).toEqual({
      markdown: "| Dose | Frequency |\n| --- | --- |\n| 10 mg | daily |",
      rows: 2,
      cols: 2,
    });
  });

  it("still yields nulls when the counts are genuinely absent or non-numeric", () => {
    expect(tableFromImage(tableCropImage({ row_count: null, column_count: "two" }))).toEqual({
      markdown: null,
      rows: null,
      cols: null,
    });
  });

  it("ignores images that are not table crops", () => {
    const image = { ...tableCropImage({ row_count: 2, column_count: 2 }), sourceKind: "embedded" } as ExtractedImage;
    expect(tableFromImage(image)).toBeNull();
  });
});
