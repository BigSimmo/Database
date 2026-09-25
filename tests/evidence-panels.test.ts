import { describe, expect, it } from "vitest";
import {
  compactEvidenceSummary,
  formatQuoteCardsForClipboard,
} from "../src/components/clinical-dashboard/evidence-panels";
import type { ClientRagAnswerPayload } from "../src/lib/answer-client-payload";
import { buildAnswerRenderModel } from "../src/lib/answer-render-policy";
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

// #WGMB4Z decision 17 (owner, 2026-09-25): the summary's support word follows the label cap,
// not render trust, so a high-trust answer without reviewed direct support reads "Supported".
describe("compactEvidenceSummary support word", () => {
  const payload = (strongSupportLabelCapped?: boolean): ClientRagAnswerPayload => ({
    answer: "Check lithium levels.",
    grounded: true,
    confidence: "high",
    citations: [],
    sources: [],
    relevance: {
      verdict: "direct",
      label: "Direct",
      matchedTerms: [],
      missingTerms: [],
      directSourceCount: 1,
      weakSourceCount: 0,
      score: 1,
      supportReason: "Direct support",
      isSourceBacked: true,
    },
    ...(strongSupportLabelCapped === undefined ? {} : { strongSupportLabelCapped }),
  });

  it.each([
    [true, "Supported"],
    [false, "Strong support"],
    [undefined, "Strong support"],
  ] as const)("strongSupportLabelCapped=%s starts with %j", (capped, word) => {
    const answer = payload(capped);
    const renderModel = buildAnswerRenderModel(answer);
    expect(renderModel.trust).toBe("high");
    const summary = compactEvidenceSummary(answer, [], undefined, renderModel);
    expect(summary.split(" · ")[0]).toBe(word);
    if (capped) expect(summary).not.toContain("Strong support");
  });
});
