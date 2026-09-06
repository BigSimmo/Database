/**
 * Table projection for the Docling lab's legacy-extractor runner.
 *
 * Extracted from run-legacy.ts so the key contract with
 * worker/python/extract_pdf_assets.py can be tested without executing the
 * runner's `main()`.
 */
import type { ExtractedImage } from "../../../src/lib/types";

export type LegacyTable = {
  markdown: string | null;
  rows: number | null;
  cols: number | null;
};

export function tableFromImage(image: ExtractedImage): LegacyTable | null {
  if (image.sourceKind !== "table_crop") return null;
  const metadata = image.metadata ?? {};
  const markdown = metadata["accessible_table_markdown"];
  // Audit L117: `table_rows` / `table_columns` are ARRAYS in
  // worker/python/extract_pdf_assets.py (a list of row lists and a list of
  // header cells). The counts live in `row_count` / `column_count`; reading the
  // array keys through a `typeof === "number"` filter made both fields
  // permanently null in out/raw.
  const rows = metadata["row_count"];
  const cols = metadata["column_count"];
  return {
    markdown: typeof markdown === "string" ? markdown : null,
    rows: typeof rows === "number" ? rows : null,
    cols: typeof cols === "number" ? cols : null,
  };
}
