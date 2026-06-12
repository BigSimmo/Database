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

  it("does not promote nearby table evidence for unsupported answers", () => {
    const unsupportedAnswer: RagAnswer = {
      ...answer,
      answer: "The retrieved excerpts do not support lithium dosing guidance.",
      grounded: false,
      confidence: "unsupported",
      relevance: {
        verdict: "nearby",
        score: 0.2,
        label: "Nearby only",
        supportReason: "Only adjacent concepts matched.",
        matchedTerms: ["lithium"],
        missingTerms: ["dosing"],
        directSourceCount: 0,
        weakSourceCount: 1,
        isSourceBacked: false,
      },
      smartPanel: { query: "lithium dosing" } as RagAnswer["smartPanel"],
      visualEvidence: [
        {
          id: "image-1",
          image_id: "image-1",
          signed_url_endpoint: "/api/images/image-1/signed-url",
          caption: "Clozapine dose restart and monitoring thresholds",
          document_id: "doc-2",
          title: "Clozapine source",
          file_name: "clozapine.pdf",
          page_number: 8,
          source_chunk_id: "chunk-2",
          chunk_index: 18,
          viewer_href: "/documents/doc-2?page=8&chunk=chunk-2",
          tableLabel: "Table",
          tableTitle: "Clozapine restart thresholds",
          tableRows: [
            ["Time since last Clozapine dose", "Clozapine dose"],
            [">= 48 hours", "Restart Clozapine at 12.5mg"],
          ],
          tableColumns: ["Time", "Dose"],
          relevance: {
            verdict: "nearby",
            score: 0.2,
            label: "Nearby only",
            supportReason: "Only adjacent concepts matched.",
            matchedTerms: ["clozapine"],
            missingTerms: ["lithium", "dosing"],
            directSourceCount: 0,
            weakSourceCount: 1,
            coverageScore: 0.2,
            rankScore: 0.2,
            titleMatchedTerms: ["clozapine"],
            contentMatchedTerms: [],
            metadataMatchedTerms: [],
            chips: ["nearby only"],
            isSourceBacked: false,
          },
        },
      ],
    };

    const thresholds = buildClinicalOutputSections(unsupportedAnswer).find((section) => section.id === "thresholds");
    expect(thresholds?.tables ?? []).toHaveLength(0);
  });

  it("cleans source codes and page labels from structured clinical support", () => {
    const sections = buildClinicalOutputSections({
      ...answer,
      answer: "Olanzapine LAI has a source-backed post-injection syndrome risk signal.",
      answerSections: [
        {
          heading: "Medication/dose details",
          kind: "medication_dose",
          supportLevel: "direct",
          body: "Neuroleptic side effect Guideline PAE-PRO-0338/16 Page 5 of 5. Dose evidence: effect profile of medication including the risk of PIS with Olanzapine LAI (1.85% of patients were affected in pre-marketing studies - refer to MIMS Product Information).",
          citation_chunk_ids: ["chunk-1"],
        },
      ],
    });

    const medication = sections.find((section) => section.id === "medication");

    expect(medication?.items.join(" ")).toContain("risk of PIS with Olanzapine LAI");
    expect(medication?.items.join(" ")).not.toContain("PAE-PRO-0338");
    expect(medication?.items.join(" ")).not.toContain("Page 5 of 5");
    expect(medication?.items.join(" ")).not.toContain("Neuroleptic side effect Guideline");
  });

  it("does not promote nearby or unsupported structured sections as primary clinical support", () => {
    const sections = buildClinicalOutputSections({
      ...answer,
      answer: "The retrieved excerpts do not directly support lithium dosing guidance.",
      grounded: false,
      confidence: "unsupported",
      relevance: {
        verdict: "nearby",
        score: 0.2,
        label: "Nearby only",
        supportReason: "Only adjacent concepts matched.",
        matchedTerms: ["lithium"],
        missingTerms: ["dosing"],
        directSourceCount: 0,
        weakSourceCount: 1,
        isSourceBacked: false,
      },
      answerSections: [
        {
          heading: "Medication/dose details",
          kind: "medication_dose",
          supportLevel: "nearby",
          body: "Clozapine restart table mentions dose changes but does not answer lithium dosing.",
          citation_chunk_ids: ["chunk-1"],
        },
        {
          heading: "Source gap",
          kind: "source_gap",
          supportLevel: "unsupported",
          body: "The retrieved excerpts do not contain a direct lithium dosing recommendation.",
          citation_chunk_ids: ["chunk-1"],
        },
      ],
      quoteCards: [],
    });

    expect(sections.find((section) => section.id === "medication")).toBeUndefined();
    expect(sections.find((section) => section.id === "source-gap")?.items[0]).toContain("do not contain");
  });

  it("does not promote medication-mismatched threshold prose for medication-specific queries", () => {
    const sections = buildClinicalOutputSections({
      ...answer,
      answer:
        "The supplied excerpts do not provide lithium toxicity safety-net symptoms; they only support lithium level monitoring.",
      smartPanel: { query: "lithium toxicity safety-net symptoms" } as RagAnswer["smartPanel"],
      answerSections: [],
      quoteCards: [
        {
          chunk_id: "chunk-1",
          document_id: "doc-1",
          title: "Clozapine source",
          file_name: "clozapine.pdf",
          page_number: 4,
          chunk_index: 2,
          section_heading: "Thresholds",
          quote:
            "Any side effect which is causing distress irrespective of score should be escalated to the treating doctor and reviewed. Clozapine levels can rise with caffeine and smoking changes and cause toxicity.",
        },
      ],
    });

    expect(sections.find((section) => section.id === "thresholds")).toBeUndefined();
  });

  it("promotes direct query-matched tables for weak answers", () => {
    const weakButMatchedAnswer: RagAnswer = {
      ...answer,
      answer: "The retrieved clozapine source is nearby; verify before use.",
      grounded: false,
      confidence: "unsupported",
      relevance: {
        verdict: "nearby",
        score: 0.4,
        label: "Nearby only",
        supportReason: "Only adjacent concepts matched.",
        matchedTerms: ["clozapine"],
        missingTerms: ["restart"],
        directSourceCount: 0,
        weakSourceCount: 1,
        isSourceBacked: false,
      },
      smartPanel: { query: "clozapine restart" } as RagAnswer["smartPanel"],
      visualEvidence: [
        {
          id: "image-1",
          image_id: "image-1",
          signed_url_endpoint: "/api/images/image-1/signed-url",
          caption: "Clozapine restart thresholds",
          document_id: "doc-2",
          title: "Clozapine source",
          file_name: "clozapine.pdf",
          page_number: 8,
          source_chunk_id: "chunk-2",
          chunk_index: 18,
          viewer_href: "/documents/doc-2?page=8&chunk=chunk-2",
          tableLabel: "Table",
          tableTitle: "Clozapine restart thresholds",
          tableRows: [
            ["Time since last Clozapine dose", "Clozapine dose"],
            [">= 48 hours", "Restart Clozapine at 12.5mg threshold"],
          ],
          tableColumns: ["Time", "Dose"],
          relevance: {
            verdict: "direct",
            score: 0.8,
            label: "Direct support",
            supportReason: "Matched core concepts.",
            matchedTerms: ["clozapine", "restart"],
            missingTerms: [],
            directSourceCount: 1,
            weakSourceCount: 0,
            coverageScore: 1,
            rankScore: 0.8,
            titleMatchedTerms: ["clozapine"],
            contentMatchedTerms: ["restart"],
            metadataMatchedTerms: [],
            chips: ["direct evidence"],
            isSourceBacked: true,
          },
        },
      ],
    };

    expect(
      buildClinicalOutputSections(weakButMatchedAnswer).find((section) => section.id === "thresholds")?.tables,
    ).toHaveLength(1);
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
