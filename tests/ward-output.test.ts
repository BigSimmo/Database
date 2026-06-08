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
      "bottom-line",
      "monitoring",
      "escalation",
      "thresholds",
      "verify-source",
    ]);
    expect(sections[0].items[0]).toContain("Monitor renal function");
    expect(sections[1].items[0]).toContain("renal function");
    expect(sections[3].items[0]).toContain("lithium level");
    expect(sections[2].items[0]).toContain("vomiting");
    expect(sections[4].items[0]).toContain("1 linked citation");
  });

  it("uses normalized answer labels instead of raw regex-only buckets", () => {
    const sections = buildClinicalOutputSections({
      ...answer,
      answer: "Bottom line: Verify FBC first.",
      answerSections: [
        {
          heading: "Medication/dose details",
          body: "Withhold clozapine if ANC is unsafe.",
          citation_chunk_ids: ["chunk-1"],
        },
        {
          heading: "Documentation/forms",
          body: "Record the source and review decision.",
          citation_chunk_ids: ["chunk-1"],
        },
      ],
      quoteCards: [],
    });

    expect(sections.map((section) => section.id)).toEqual([
      "bottom-line",
      "medication",
      "documentation",
      "thresholds",
      "verify-source",
    ]);
    expect(sections.find((section) => section.id === "medication")?.items[0]).toContain("Withhold clozapine");
    expect(sections.find((section) => section.id === "documentation")?.items[0]).toContain("Record the source");
  });

  it("places extracted threshold tables before threshold prose", () => {
    const thresholdAnswer: RagAnswer = {
      ...answer,
      answer: "Withhold clozapine if ANC is below the required threshold and urgently review.",
      answerSections: [
        {
          heading: "Threshold",
          body: "Withhold clozapine if ANC is below the required threshold and urgently review.",
          citation_chunk_ids: ["chunk-1"],
        },
      ],
      visualEvidence: [
        {
          id: "image-1",
          image_id: "image-1",
          signed_url_endpoint: "/api/images/image-1/signed-url",
          caption: "FBC/ANC monitoring thresholds",
          document_id: "doc-1",
          title: "Clozapine source",
          file_name: "clozapine.pdf",
          page_number: 2,
          source_chunk_id: "chunk-1",
          chunk_index: 0,
          viewer_href: "/documents/doc-1?page=2&chunk=chunk-1",
          tableLabel: "Table 1",
          tableTitle: "FBC/ANC thresholds",
          tableRows: [
            ["ANC", "Action"],
            ["Below threshold", "Withhold clozapine and review"],
          ],
          tableColumns: ["Threshold", "Action"],
        },
      ],
    };

    const thresholds = buildClinicalOutputSections(thresholdAnswer).find((section) => section.id === "thresholds");

    expect(thresholds?.tables).toHaveLength(1);
    expect(thresholds?.tables?.[0].caption).toContain("FBC/ANC");
    expect(thresholds?.items[0]).toContain("Withhold clozapine");
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
    expect(shouldPollForUpdates(false, "visible", false)).toBe(false);
    expect(shouldPollForUpdates(true, "visible")).toBe(false);
    expect(shouldPollForUpdates(false, "hidden")).toBe(false);
  });
});
