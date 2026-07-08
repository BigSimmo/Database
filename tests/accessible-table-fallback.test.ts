import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AccessibleTable } from "@/components/AccessibleTable";

// GEN-H3: when a clinical table can't be confidently reconstructed the padded raw
// grid is misleading (mostly empty "-" cells, clipped headers). Callers that hold
// the cropped source image can pass `lowConfidenceFallback` so the real table
// screenshot is shown instead of that grid.

// Named column, interleaved generic (empty) column, then another named column, with
// a clinical (ANC/dose) signal — this is the `ambiguous_generic_column` case that
// normalizeAccessibleTable flags low-confidence and preserves as a raw grid.
const lowConfidenceColumns = ["ANC level", "", "Action"];
const lowConfidenceRows = [
  ["1.5", "", "Continue clozapine"],
  ["1.0", "", "Withhold dose"],
];

const fallback = createElement("div", { "data-testid": "fake-source-image" }, "SOURCE IMAGE");

describe("AccessibleTable low-confidence screenshot fallback", () => {
  it("renders the fallback instead of the reconstructed grid when the table is low-confidence", () => {
    const markup = renderToStaticMarkup(
      createElement(AccessibleTable, {
        caption: "Recommended maximum PRN and total daily dose",
        rows: lowConfidenceRows,
        columns: lowConfidenceColumns,
        lowConfidenceFallback: fallback,
      }),
    );

    expect(markup).toContain('data-testid="table-low-confidence-note"');
    expect(markup).toContain("showing the source document image instead");
    expect(markup).toContain('data-testid="table-source-image-fallback"');
    expect(markup).toContain("SOURCE IMAGE");
    // The garbled reconstructed grid must not render alongside the screenshot.
    expect(markup).not.toContain("<table");
  });

  it("still renders the reconstructed grid for a low-confidence table when no fallback is provided", () => {
    const markup = renderToStaticMarkup(
      createElement(AccessibleTable, {
        caption: "Recommended maximum PRN and total daily dose",
        rows: lowConfidenceRows,
        columns: lowConfidenceColumns,
      }),
    );

    expect(markup).toContain('data-testid="table-low-confidence-note"');
    expect(markup).toContain("verify values against the source document");
    expect(markup).toContain("<table");
    expect(markup).not.toContain('data-testid="table-source-image-fallback"');
  });

  it("renders the reconstructed grid (never the fallback) for a confidently-reconstructed table", () => {
    const markup = renderToStaticMarkup(
      createElement(AccessibleTable, {
        caption: "Clozapine monitoring",
        rows: [["0", "Monitor observations"]],
        columns: ["Score", "Management"],
        lowConfidenceFallback: fallback,
      }),
    );

    expect(markup).toContain("<table");
    expect(markup).not.toContain('data-testid="table-low-confidence-note"');
    expect(markup).not.toContain('data-testid="table-source-image-fallback"');
  });
});
