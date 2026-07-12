import { describe, expect, it } from "vitest";
import {
  buildAnswerRenderModel,
  describeSourceStrengthForCopy,
  formatAnswerRenderCopyText,
} from "../src/lib/answer-render-policy";
import type {
  BestSourceRecommendation,
  Citation,
  QuoteCard,
  RagAnswer,
  RelatedDocument,
  SearchResult,
  VisualEvidenceCard,
} from "../src/lib/types";

function source(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: "chunk-1",
    document_id: "doc-1",
    title: "Clozapine Monitoring Guideline",
    file_name: "clozapine-monitoring.pdf",
    page_number: 4,
    chunk_index: 0,
    section_heading: "Monitoring",
    content: "If blood results are red range, withhold clozapine and contact the monitoring service.",
    image_ids: [],
    similarity: 0.95,
    hybrid_score: 0.95,
    images: [],
    source_strength: "strong",
    ...overrides,
  };
}

function citation(overrides: Partial<Citation> = {}): Citation {
  return {
    chunk_id: "chunk-1",
    document_id: "doc-1",
    title: "Clozapine Monitoring Guideline",
    file_name: "clozapine-monitoring.pdf",
    page_number: 4,
    chunk_index: 0,
    similarity: 0.95,
    ...overrides,
  };
}

function quote(overrides: Partial<QuoteCard> = {}): QuoteCard {
  return {
    ...citation(overrides),
    quote: "withhold clozapine and contact the monitoring service",
    section_heading: "Monitoring",
    source_strength: "strong",
    ...overrides,
  };
}

function visual(overrides: Partial<VisualEvidenceCard> = {}): VisualEvidenceCard {
  return {
    id: "image-1",
    image_id: "img-1",
    signed_url_endpoint: "/api/images/img-1",
    caption: "Monitoring table",
    document_id: "doc-1",
    title: "Clozapine Monitoring Guideline",
    file_name: "clozapine-monitoring.pdf",
    page_number: 4,
    source_chunk_id: "chunk-1",
    chunk_index: 0,
    viewer_href: "/documents/doc-1?page=4&chunk=chunk-1",
    tableRows: [["Red", "Withhold"]],
    tableColumns: ["Range", "Action"],
    ...overrides,
  };
}

function related(overrides: Partial<RelatedDocument> = {}): RelatedDocument {
  return {
    document_id: "related-doc",
    title: "Related Guideline",
    file_name: "related.pdf",
    labels: [],
    summary: "Related monitoring material.",
    best_pages: [1],
    best_chunk_ids: ["related-chunk"],
    image_count: 0,
    match_reason: "Similar topic",
    score: 0.7,
    ...overrides,
  };
}

function answer(overrides: Partial<RagAnswer> = {}): RagAnswer {
  const baseSource = source();
  return {
    answer: "For red-range blood results, withhold clozapine and contact the monitoring service.",
    grounded: true,
    confidence: "high",
    citations: [citation()],
    sources: [baseSource],
    answerSections: [
      {
        heading: "Action",
        body: "Withhold clozapine and contact the monitoring service.",
        citation_chunk_ids: ["chunk-1"],
        kind: "required_actions",
        supportLevel: "direct",
      },
    ],
    quoteCards: [quote()],
    visualEvidence: [visual()],
    relatedDocuments: [related()],
    bestSource: {
      ...citation(),
      source_strength: "strong",
      score: 0.95,
      snippet: "If blood results are red range, withhold clozapine.",
      section_heading: "Monitoring",
      image_count: 1,
      viewer_href: "/documents/doc-1?page=4&chunk=chunk-1",
    } satisfies BestSourceRecommendation,
    ...overrides,
  };
}

describe("answer render policy", () => {
<<<<<<< HEAD
  it("copies the displayed table values, units, and canonical provenance", () => {
    const model = buildAnswerRenderModel(
      answer({
        visualEvidence: [
          visual({
            tableTitle: "ANC action thresholds",
            tableColumns: ["ANC", "Action"],
            tableRows: [["0.49 ×10^9/L", "Stop and escalate"]],
          }),
        ],
      }),
    );
    expect(model.copyText).toContain("ANC action thresholds");
    expect(model.copyText).toContain("0.49 ×10^9/L");
    expect(model.copyText).toContain("Stop and escalate");
    expect(model.copyText).toContain("/documents/doc-1?page=4&chunk=chunk-1");
=======
  it("strips high-yield bold markers from the copy/paste clinical draft", () => {
    const model = buildAnswerRenderModel(
      answer({
        answer: "For red-range results, **withhold clozapine** and recheck ANC **within 24 hours**.",
      }),
    );
    // The pasted draft is plain text for clinical notes — no literal "**".
    expect(model.copyText).not.toContain("**");
    expect(model.copyText).toContain("withhold clozapine");
    expect(model.copyText).toContain("within 24 hours");
>>>>>>> origin/main
  });

  it("limits unsupported answers to source review and warnings even when raw extras are present", () => {
    const model = buildAnswerRenderModel(
      answer({
        answer: "No current source with threshold-specific action guidance was found.",
        grounded: false,
        confidence: "unsupported",
        responseMode: "evidence_gap",
        routingMode: "unsupported",
      }),
      { includeDebugReasons: true },
    );

    expect(model.trust).toBe("unsupported");
    expect(model.allowedBlocks).toEqual(expect.arrayContaining(["sourceStatus", "reviewSources", "warnings"]));
    expect(model.allowedBlocks).not.toContain("quoteCards");
    expect(model.allowedBlocks).not.toContain("visualEvidence");
    expect(model.allowedBlocks).not.toContain("relatedDocuments");
    expect(model.quoteCards).toHaveLength(0);
    expect(model.visualEvidence).toHaveLength(0);
    expect(model.relatedDocuments).toHaveLength(0);
    expect(model.bestSource).toBeNull();
    expect(model.debugReasons?.quoteCards.shown).toBe(false);
    expect(model.copyText).toContain("Render trust: unsupported");
    expect(model.copyText).toContain("Sources for review");
  });

  it("keeps medium-confidence rendering focused on source status, sources, and evidence map", () => {
    const model = buildAnswerRenderModel(
      answer({
        confidence: "medium",
        quoteCards: [quote(), quote({ quote: "another exact quote" })],
        visualEvidence: [visual(), visual({ id: "image-2", image_id: "img-2" })],
        relatedDocuments: [related(), related({ document_id: "related-doc-2", title: "Second related" })],
      }),
    );

    expect(model.trust).toBe("medium");
    expect(model.allowedBlocks).toEqual(expect.arrayContaining(["sourceStatus", "reviewSources", "evidenceMap"]));
    expect(model.allowedBlocks).not.toContain("quoteCards");
    expect(model.allowedBlocks).not.toContain("relatedDocuments");
    expect(model.quoteCards).toHaveLength(0);
    expect(model.relatedDocuments).toHaveLength(0);
    expect(model.evidenceRows).toHaveLength(1);
    expect(model.copyText).toContain("Verify against linked source documents");
  });

  it("deduplicates high-confidence evidence channels and caps optional blocks", () => {
    const manyQuotes = Array.from({ length: 6 }, (_, index) =>
      quote({ quote: `quoted evidence ${index}`, chunk_id: "chunk-1" }),
    );
    const manyVisuals = Array.from({ length: 5 }, (_, index) =>
      visual({ id: `image-${index}`, image_id: `img-${index}`, source_chunk_id: "chunk-1" }),
    );
    const manyRelated = Array.from({ length: 6 }, (_, index) =>
      related({ document_id: `related-${index}`, title: `Related ${index}` }),
    );

    const model = buildAnswerRenderModel(
      answer({
        quoteCards: manyQuotes,
        visualEvidence: manyVisuals,
        relatedDocuments: manyRelated,
      }),
    );

    expect(model.trust).toBe("high");
    expect(model.primarySources).toHaveLength(1);
    expect(model.quoteCards).toHaveLength(3);
    expect(model.visualEvidence).toHaveLength(3);
    expect(model.relatedDocuments).toHaveLength(4);
    expect(model.allowedBlocks).toEqual(expect.arrayContaining(["quoteCards", "visualEvidence", "relatedDocuments"]));
  });

  it("promotes smartApiPlan core source links into canonical primary sources", () => {
    const model = buildAnswerRenderModel(
      answer({
        smartApiPlan: {
          coreSourceLinks: [
            {
              id: "core-chunk",
              label: "Core source, page 8",
              href: "/documents/doc-core?page=8&chunk=core-chunk",
              document_id: "doc-core",
              chunk_id: "core-chunk",
              title: "Canonical Source Packet",
              file_name: "canonical-source.pdf",
              page_number: 8,
              source_strength: "strong",
              reason: "Selected by the answer plan.",
              snippet: "Canonical answer-plan source text.",
            },
          ],
        } as RagAnswer["smartApiPlan"],
      }),
    );

    expect(model.primarySources[0]).toMatchObject({
      chunk_id: "core-chunk",
      document_id: "doc-core",
      href: "/documents/doc-core?page=8&chunk=core-chunk",
      reason: "Selected by the answer plan.",
    });
    expect(model.copyText).toContain("/documents/doc-core?page=8&chunk=core-chunk");
  });

  it("deduplicates conflicting section evidence by source rather than rendering duplicate rows", () => {
    const model = buildAnswerRenderModel(
      answer({
        answerSections: [
          {
            heading: "Backend section",
            body: "Withhold clozapine.",
            citation_chunk_ids: ["chunk-1"],
            supportLevel: "direct",
          },
          {
            heading: "Parser section",
            body: "Contact the monitoring service.",
            citation_chunk_ids: ["chunk-1"],
            supportLevel: "direct",
          },
        ],
      }),
    );

    expect(model.evidenceRows).toHaveLength(1);
    expect(model.evidenceRows[0]?.channels).toContain("evidenceMap");
  });

  it("drops empty placeholder supplemental content before render decisions", () => {
    const model = buildAnswerRenderModel(
      answer({
        quoteCards: [quote({ quote: "" }), quote({ quote: "N/A" })],
        visualEvidence: [],
        relatedDocuments: [],
      }),
    );

    expect(model.quoteCards).toHaveLength(0);
    expect(model.allowedBlocks).not.toContain("quoteCards");
  });

  describe("copy-text source-strength gloss (P4b)", () => {
    it("glosses each strength into a clinician-readable phrase and avoids the odd 'none support'", () => {
      expect(describeSourceStrengthForCopy("strong")).toBe("strong match");
      expect(describeSourceStrengthForCopy("moderate")).toBe("moderate match");
      expect(describeSourceStrengthForCopy("limited")).toBe("limited match");
      expect(describeSourceStrengthForCopy("none")).toBe("match strength not rated");
    });

    it("renders the glossed strength in the copy block, not the bare enum", () => {
      const link = (
        overrides: Partial<Parameters<typeof formatAnswerRenderCopyText>[0]["primarySources"][number]>,
      ) => ({
        id: "s1",
        chunk_id: "c1",
        document_id: "d1",
        title: "T",
        file_name: "f.pdf",
        page_number: 4,
        href: "/documents/doc-1?page=4",
        label: "Clozapine Monitoring (AKG)",
        sourceStrength: "strong" as const,
        reason: "selected",
        ...overrides,
      });
      const text = formatAnswerRenderCopyText({
        answerText: "Withhold clozapine for a red-range result.",
        trust: "high",
        primarySources: [link({}), link({ label: "Legacy Note", href: "/documents/doc-2", sourceStrength: "none" })],
        warnings: [],
      });
      expect(text).toContain("Clozapine Monitoring (AKG) | strong match | /documents/doc-1?page=4");
      expect(text).toContain("Legacy Note | match strength not rated | /documents/doc-2");
      expect(text).not.toContain("none support");
    });
  });
});
