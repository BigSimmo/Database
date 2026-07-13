import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CanonicalAnswerTable, CanonicalAnswerTables } from "@/components/clinical-dashboard/visual-evidence";
import type { CanonicalAnswerTableRecord } from "@/lib/answer-render-policy";

const table: CanonicalAnswerTableRecord = {
  id: "table-1",
  title: "ANC actions",
  headers: ["ANC range", "Action"],
  rows: [
    ["1.0–1.5 × 10⁹/L", "Increase monitoring"],
    ["<1.0 × 10⁹/L", "Withhold and seek specialist advice"],
  ],
  lowConfidence: false,
  source: {
    label: "Clozapine Monitoring Guideline, page 4",
    href: "/documents/doc-1?page=4&chunk=chunk-1",
    chunkId: "chunk-1",
  },
};

describe("CanonicalAnswerTable", () => {
  it("renders every canonical header, row, caveat, and linked source", () => {
    const markup = renderToStaticMarkup(
      createElement(CanonicalAnswerTable, {
        table: {
          ...table,
          lowConfidence: true,
          caveat: "Table structure could not be confidently reconstructed — verify values against the source.",
        },
      }),
    );

    for (const value of [...table.headers, ...table.rows.flat()].filter(
      (value): value is string => typeof value === "string" && !value.startsWith("<"),
    )) {
      expect(markup).toContain(value);
    }
    expect(markup).toContain("&lt;1.0 × 10⁹/L");
    expect(markup).toContain("could not be confidently reconstructed");
    expect(markup).toContain('aria-label="Inline table preview"');
    expect(markup).toContain('data-testid="accessible-table-surface"');
    expect(markup).toContain('href="/documents/doc-1?page=4&amp;chunk=chunk-1"');
    expect(markup).toContain('aria-label="Open table source"');
    expect(markup).not.toContain("Clozapine Monitoring Guideline, page 4");
  });

  it("renders every canonical table as a separately labelled region", () => {
    const secondTable: CanonicalAnswerTableRecord = {
      ...table,
      id: "table-2",
      title: "Metabolic monitoring",
      headers: ["Parameter", "Timing"],
      rows: [["HbA1c", "At baseline and review"]],
      source: {
        label: "Metabolic Guideline, page 7",
        href: "/documents/doc-2?page=7&chunk=chunk-2",
        chunkId: "chunk-2",
      },
    };
    const markup = renderToStaticMarkup(createElement(CanonicalAnswerTables, { tables: [table, secondTable] }));

    expect(markup).toContain('aria-label="Clinical tables"');
    expect(markup).toContain('aria-label="ANC actions"');
    expect(markup).toContain('aria-label="Metabolic monitoring"');
    expect(markup).toContain("Withhold and seek specialist advice");
    expect(markup).toContain("HbA1c");
    expect(markup).toContain("At baseline and review");
  });
});
