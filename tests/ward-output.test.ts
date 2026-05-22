import { describe, expect, it } from "vitest";
import {
  buildClinicalOutputSections,
  createQuoteFollowUp,
  formatAnswerForClipboard,
  formatQuotesForClipboard,
  formatWardNote,
  shouldPollForUpdates,
} from "../src/lib/ward-output";
import type { RagAnswer } from "../src/lib/types";

const answer: RagAnswer = {
  answer: "Monitor renal function and escalate review for vomiting, dehydration, tremor, confusion, or ataxia.",
  grounded: true,
  confidence: "medium",
  citations: [
    {
      chunk_id: "chunk-1",
      document_id: "doc-1",
      title: "Lithium source",
      file_name: "lithium.pdf",
      page_number: 1,
      chunk_index: 0,
    },
  ],
  sources: [],
  answerSections: [
    {
      heading: "Monitoring",
      body: "Check lithium level, renal function, thyroid function, calcium, and interacting medicines.",
      citation_chunk_ids: ["chunk-1"],
    },
    {
      heading: "Escalation",
      body: "Escalate review for vomiting, dehydration, tremor, confusion, or ataxia.",
      citation_chunk_ids: ["chunk-1"],
    },
  ],
  quoteCards: [
    {
      chunk_id: "chunk-1",
      document_id: "doc-1",
      title: "Lithium source",
      file_name: "lithium.pdf",
      page_number: 1,
      chunk_index: 0,
      section_heading: "Monitoring",
      quote: "Escalate review for vomiting, dehydration, tremor, confusion, or ataxia.",
    },
  ],
};

describe("ward output helpers", () => {
  it("builds source-backed clinical output sections", () => {
    const sections = buildClinicalOutputSections(answer);

    expect(sections.map((section) => section.id)).toEqual([
      "key-actions",
      "monitoring-checklist",
      "escalation-triggers",
    ]);
    expect(sections[1].items[0]).toContain("renal function");
    expect(sections[2].items[0]).toContain("vomiting");
  });

  it("formats copyable answer and quote text with citations", () => {
    expect(formatAnswerForClipboard(answer)).toContain("Lithium source, p. 1");
    expect(formatQuotesForClipboard(answer.quoteCards)).toContain('"Escalate review');
  });

  it("formats a ward note with demo warning when requested", () => {
    const note = formatWardNote(answer, true);

    expect(note).toContain("Synthetic demo only");
    expect(note).toContain("Citations");
  });

  it("creates a focused follow-up question from a quote", () => {
    expect(createQuoteFollowUp(answer.quoteCards![0])).toContain("page 1");
    expect(createQuoteFollowUp(answer.quoteCards![0])).toContain("Escalate review");
  });

  it("pauses polling in demo mode or hidden tabs", () => {
    expect(shouldPollForUpdates(false, "visible")).toBe(true);
    expect(shouldPollForUpdates(true, "visible")).toBe(false);
    expect(shouldPollForUpdates(false, "hidden")).toBe(false);
  });
});
