import { describe, expect, it } from "vitest";
import { formatQuoteCardsForClipboard } from "../src/components/clinical-dashboard/evidence-panels";
import type { QuoteCard } from "../src/lib/types";

function quoteCard(overrides: Partial<QuoteCard> = {}): QuoteCard {
  return {
    chunk_id: "chunk-1",
    document_id: "doc-1",
    title: "Lithium Guideline",
    file_name: "CG.MHSP.Lithium.pdf",
    page_number: 4,
    chunk_index: 0,
    quote: "Maintenance range is 0.4-0.8 mmol/L.",
    section_heading: null,
    ...overrides,
  };
}

describe("formatQuoteCardsForClipboard", () => {
  it("marks copied quotes when the displayed quote was truncated", () => {
    const text = formatQuoteCardsForClipboard([quoteCard({ isTruncated: true })]);

    expect(text).toContain("Warning: quote truncated for length; open the source to read the full passage.");
    expect(text).toContain("Source: Lithium Guideline, p. 4");
  });

  it("does not add a truncation warning for complete quotes", () => {
    const text = formatQuoteCardsForClipboard([quoteCard({ isTruncated: false })]);

    expect(text).not.toContain("Warning: quote truncated");
  });
});
