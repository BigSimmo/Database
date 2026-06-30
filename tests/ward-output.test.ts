import { describe, expect, it } from "vitest";
import {
  buildAnswerEvidenceMap,
  buildClinicalOutputSections,
  buildHighYieldClinicalOutputSections,
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
      "verify-source",
    ]);
    expect(sections[0].items[0]).toContain("Monitor renal function");
    expect(sections[1].items[0]).toContain("renal function");
    expect(sections[1].items[0]).toContain("lithium level");
    expect(sections[2].items[0]).toContain("vomiting");
    expect(sections[3].items[0]).toContain("1 linked citation");
  });

  it("derives high-yield sections and evidence-map rows below the concise answer", () => {
    const enrichedAnswer: RagAnswer = {
      ...answer,
      sources: [
        {
          id: "chunk-1",
          document_id: "doc-1",
          title: "Lithium source",
          file_name: "lithium.pdf",
          page_number: 1,
          chunk_index: 0,
          section_heading: "Monitoring",
          content: "Check lithium level, renal function, thyroid function, calcium, and interacting medicines.",
          image_ids: [],
          images: [],
          similarity: 0.78,
          source_strength: "strong",
          source_metadata: {
            source_title: "Lithium source",
            publisher: "WA Health",
            jurisdiction: "Western Australia",
            version: null,
            publication_date: null,
            review_date: null,
            uploaded_at: null,
            indexed_at: null,
            uploaded_by: null,
            document_status: "current",
            clinical_validation_status: "approved",
            extraction_quality: "good",
          },
        },
      ],
      answerSections: [
        {
          heading: "Monitoring",
          kind: "monitoring_timing",
          supportLevel: "direct",
          body: "Check lithium level, renal function, thyroid function, calcium, and interacting medicines.",
          citation_chunk_ids: ["chunk-1"],
        },
        {
          heading: "Documentation",
          kind: "documentation",
          supportLevel: "direct",
          body: "Record the source and review decision.",
          citation_chunk_ids: ["chunk-1"],
        },
      ],
    };

    const highYieldSections = buildHighYieldClinicalOutputSections(enrichedAnswer);
    const evidenceRows = buildAnswerEvidenceMap(enrichedAnswer);

    expect(highYieldSections.map((section) => section.id)).toEqual(["monitoring", "verify-source"]);
    expect(highYieldSections.some((section) => section.id === "documentation")).toBe(false);
    expect(evidenceRows[0]).toMatchObject({
      section: "Monitoring/timing",
      supportLevel: "Direct",
      citationCount: 1,
      bestSourceLabel: "Lithium source, page 1",
    });
    expect(evidenceRows[0].sourceStatus).toContain("Current source");
    expect(evidenceRows[0].sourceStatus).toContain("Approved");
    expect(evidenceRows[0].href).toContain("/documents/doc-1");
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
    expect(thresholds?.tables?.[0]).not.toHaveProperty("sourceLabel");
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

  it("rejects source-title-heavy evidence snippets from structured support", () => {
    const sections = buildClinicalOutputSections({
      ...answer,
      answer: "Care coordinator follow-up is supported by the retrieved source.",
      answerSections: [
        {
          heading: "Medication/dose details",
          kind: "medication_dose",
          supportLevel: "direct",
          body: "Dose evidence: LUNSERS (Liverpool University Neuroleptic Side Effect Rating Scale) - using for monitoring Neuroleptic side effect Guideline Appendix 1. Dose evidence: Care coordinator to follow up completion by consumer and report findings to treating doctor.",
          citation_chunk_ids: ["chunk-1"],
        },
      ],
    });

    expect(sections.find((section) => section.id === "medication")).toBeUndefined();
    expect(JSON.stringify(sections)).not.toContain("Dose evidence");
    expect(JSON.stringify(sections)).not.toContain("Liverpool University");
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

  it("keeps missing threshold evidence in source gaps instead of threshold support", () => {
    const sections = buildClinicalOutputSections({
      ...answer,
      answer:
        "There is no direct information on dose ranges, usual starting doses, titration steps, or therapeutic serum lithium thresholds in the supplied documents.",
      grounded: false,
      confidence: "unsupported",
      smartPanel: { query: "lithium dosing" } as RagAnswer["smartPanel"],
      answerSections: [
        {
          heading: "Source gap",
          kind: "source_gap",
          supportLevel: "unsupported",
          body: "The supplied sources do not provide dosing guidelines, starting doses, titration schedules, or target serum levels for lithium.",
          citation_chunk_ids: ["chunk-1"],
        },
        {
          heading: "Thresholds",
          kind: "thresholds",
          supportLevel: "partial",
          body: "The supplied sources do not provide dosing guidelines, starting doses, titration schedules, or target serum levels for lithium.",
          citation_chunk_ids: ["chunk-1"],
        },
      ],
      quoteCards: [],
    });

    const sourceGapSections = sections.filter((section) => section.id === "source-gap");
    expect(sourceGapSections).toHaveLength(1);
    expect(sourceGapSections[0]?.items.join(" ")).toContain("do not provide");
    expect(sections.find((section) => section.id === "thresholds")).toBeUndefined();
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

  it("does not promote generic level monitoring as threshold support without target or numeric context", () => {
    const sections = buildClinicalOutputSections({
      ...answer,
      answer: "Lithium level monitoring should be checked alongside renal function.",
      smartPanel: { query: "lithium level monitoring" } as RagAnswer["smartPanel"],
      answerSections: [
        {
          heading: "Monitoring",
          kind: "monitoring_timing",
          supportLevel: "direct",
          body: "Check lithium level and renal function after clinically relevant medicine changes.",
          citation_chunk_ids: ["chunk-1"],
        },
      ],
      quoteCards: [],
    });

    expect(sections.find((section) => section.id === "monitoring")?.items.join(" ")).toContain("lithium level");
    expect(sections.find((section) => section.id === "thresholds")).toBeUndefined();
  });

  it("promotes therapeutic target level ranges as threshold support", () => {
    const sections = buildClinicalOutputSections({
      ...answer,
      answer: "For acute mania, target serum lithium level is 0.8-1.2 mmol/L.",
      smartPanel: { query: "lithium therapeutic target level" } as RagAnswer["smartPanel"],
      answerSections: [
        {
          heading: "Thresholds",
          kind: "thresholds",
          supportLevel: "direct",
          body: "Target serum lithium level for acute mania is 0.8-1.2 mmol/L.",
          citation_chunk_ids: ["chunk-1"],
        },
      ],
      quoteCards: [],
    });

    expect(sections.find((section) => section.id === "thresholds")?.items.join(" ")).toContain("0.8-1.2 mmol/L");
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

  it("builds a compact structured support table for complex answers", () => {
    const sections = buildClinicalOutputSections({
      ...answer,
      responseMode: "clinical_pathway",
      answerSections: [
        {
          heading: "Required actions",
          kind: "required_actions",
          supportLevel: "direct",
          body: "Arrange baseline renal function, thyroid function, calcium, and lithium level before continuing.",
          citation_chunk_ids: ["chunk-1"],
        },
        {
          heading: "Monitoring/timing",
          kind: "monitoring_timing",
          supportLevel: "partial",
          body: "Review lithium level and renal function after clinically relevant changes.",
          citation_chunk_ids: ["chunk-1"],
        },
      ],
    });

    const support = sections.find((section) => section.id === "support-map");

    expect(support?.tables?.[0]).toMatchObject({
      columns: ["Clinical area", "Clinical detail"],
      rows: [
        ["Required actions", expect.stringContaining("baseline renal function")],
        ["Monitoring/timing", expect.stringContaining("Review lithium level")],
      ],
    });
    expect(support?.tables?.[0].columns).not.toContain("Support");
  });

  it("adds clinical-only comparison detail for comparison answers", () => {
    const sections = buildClinicalOutputSections({
      ...answer,
      answer: "The retrieved documents overlap on monitoring but differ in escalation detail.",
      queryClass: "comparison",
      responseMode: "comparison_matrix",
      documentBreakdown: [
        {
          document_id: "doc-1",
          title: "Lithium guideline",
          file_name: "lithium.pdf",
          top_similarity: 0.8,
          source_strength: "strong",
          source_count: 2,
          quote_count: 1,
          pages: [1, 2],
          best_quote: "Check lithium level and renal function.",
        },
        {
          document_id: "doc-2",
          title: "Renal monitoring protocol",
          file_name: "renal.pdf",
          top_similarity: 0.7,
          source_strength: "limited",
          source_count: 1,
          quote_count: 1,
          pages: [4],
          best_quote: "Escalate abnormal renal function for review.",
        },
      ],
    });

    const comparison = sections.find((section) => section.id === "comparison");

    expect(comparison?.tables?.[0]).toMatchObject({
      columns: ["Clinical detail"],
      rows: [[expect.stringContaining("lithium level")], [expect.stringContaining("Escalate abnormal")]],
    });
    expect(comparison?.tables?.[0].columns).not.toEqual(expect.arrayContaining(["Source", "Support", "Pages"]));
  });

  it("formats copyable answer and quote text with citations", () => {
    const copy = formatAnswerForClipboard(answer);

    expect(copy).toContain("Bottom line");
    expect(copy).toContain("- Monitor renal function");
    expect(copy).toContain("Monitoring");
    expect(copy).not.toContain("\nThresholds");
    expect(copy).toContain("Citations");
    expect(copy).toContain("Lithium source, p. 1");
    expect(copy).toContain("Source status");
    expect(copy).toContain("Review requirement");
    expect(copy.match(/Monitor renal function and escalate review/g)).toHaveLength(1);
    expect(formatQuotesForClipboard(answer.quoteCards)).toContain('"Escalate review');
  });

  it("formats a ward note with demo warning when requested", () => {
    const note = formatWardNote(answer, true);

    expect(note).toContain("Synthetic demo only");
    expect(note).toContain("Bottom line");
    expect(note).toContain("Review requirement");
    expect(note).toContain("Citations");
    expect(note.match(/Monitor renal function and escalate review/g)).toHaveLength(1);
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
