import { describe, expect, it } from "vitest";

import { toClientAnswerPayload } from "@/lib/answer-client-payload";
import { buildGovernedAnswerClientResponse, buildGovernedDemoAnswerClientResponse } from "@/lib/answer-response";
import { projectDocumentMatchForClient } from "@/lib/client-source-projection";
import { extractSafetyFindings } from "@/lib/clinical-safety";
import type { RagAnswer, SearchResult } from "@/lib/types";

function fullSource(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: "chunk-1",
    document_id: "doc-1",
    title: "Clozapine monitoring guideline",
    file_name: "clozapine.pdf",
    page_number: 4,
    chunk_index: 7,
    section_heading: "Monitoring",
    content: "Full blood count weekly for 18 weeks. ".repeat(60),
    retrieval_synopsis: "FBC weekly for 18 weeks, then monthly.",
    image_ids: [],
    similarity: 0.82,
    source_metadata: { document_status: "current" } as SearchResult["source_metadata"],
    adjacent_context: "Preceding paragraph context. ".repeat(20),
    document_summary: "A long document summary. ".repeat(30),
    memory_cards: [{ id: "m1" } as never],
    table_facts: [{ id: "t1" } as never],
    index_unit: { unit_type: "table" } as never,
    ...overrides,
  } as SearchResult;
}

function answerWith(sources: SearchResult[]): Pick<RagAnswer, "sources"> {
  return { sources };
}

describe("toClientAnswerPayload", () => {
  it("governs empty-source real and demo answers without requiring source fields", () => {
    const answer = {
      answer: "No source details.",
      grounded: true,
      confidence: "high",
      citations: [],
      sources: [],
    } as RagAnswer;

    expect(buildGovernedAnswerClientResponse(answer).payload).toMatchObject({ sources: [], safetyWarnings: [] });
    expect(buildGovernedDemoAnswerClientResponse(answer)).toMatchObject({
      sources: [],
      safetyWarnings: [],
      demoMode: true,
    });
  });

  it("drops server-only per-source fields the client never renders", () => {
    const trimmed = toClientAnswerPayload(answerWith([fullSource()])).sources![0];
    expect(trimmed.adjacent_context).toBeUndefined();
    expect(trimmed.memory_cards).toBeUndefined();
    expect(trimmed.table_facts).toBeUndefined();
    expect(trimmed.index_unit).toBeUndefined();
    expect(trimmed.document_summary).toBeUndefined();
    expect(trimmed.images).toEqual([]);
  });

  it("does not serialize bulky source image objects", () => {
    const image = {
      id: "image-1",
      storage_path: "private/source/page-4.png",
      metadata: { raw: "x".repeat(8_000) },
      table_markdown: `| heading |\n| --- |\n| ${"cell ".repeat(1_000)} |`,
    } as never;
    const source = fullSource({ image_ids: ["image-1"], images: [image] });
    const trimmed = toClientAnswerPayload(answerWith([source])).sources![0];

    expect(trimmed.image_ids).toEqual(["image-1"]);
    expect(trimmed.images).toEqual([]);
    expect(JSON.stringify(trimmed)).not.toContain("private/source/page-4.png");
  });

  it("does not pass unclassified runtime fields through the route boundary", () => {
    const source = { ...fullSource(), future_server_secret: "private" } as SearchResult;
    const trimmed = toClientAnswerPayload(answerWith([source])).sources![0] as SearchResult & {
      future_server_secret?: string;
    };
    expect(trimmed.future_server_secret).toBeUndefined();
  });

  it("deeply removes owner and reviewer fields from every browser-bound evidence path", () => {
    const sourceMetadata = {
      source_title: "Clozapine monitoring guideline",
      publisher: "WA Health",
      jurisdiction: "Australia/WA",
      version: null,
      publication_date: null,
      review_date: null,
      uploaded_at: null,
      indexed_at: null,
      uploaded_by: "uploader-private-marker",
      document_status: "current",
      clinical_validation_status: "approved",
      clinical_validation_evidence: {
        attested_by: "reviewer-private-marker",
        evidence_reference: "attestation-private-marker",
      },
      extraction_quality: "good",
    } as NonNullable<SearchResult["source_metadata"]>;
    const label = {
      id: "label-1",
      document_id: "doc-1",
      owner_id: "label-owner-private-marker",
      label: "clozapine",
      label_type: "medication",
      source: "manual",
      confidence: 1,
      metadata: { review_status: "approved", reviewer: "label-metadata-private-marker" },
    } as const;
    const hiddenLabel = {
      ...label,
      id: "label-hidden",
      label: "hidden-clinical-label-private-marker",
      metadata: { review_status: "hidden", reviewed_by: "hidden-reviewer-private-marker" },
    } as const;
    const indexingQuality = {
      document_id: "doc-1",
      owner_id: "index-owner-private-marker",
      quality_score: 0.92,
      extraction_quality: "good",
      metrics: { raw: "index-metrics-private-marker" },
      issues: ["safe issue"],
    };
    const citation = {
      chunk_id: "chunk-1",
      document_id: "doc-1",
      title: "Clozapine monitoring guideline",
      file_name: "clozapine.pdf",
      page_number: 4,
      chunk_index: 7,
      source_metadata: sourceMetadata,
    };
    const relatedDocument = {
      document_id: "doc-related",
      title: "Related guideline",
      file_name: "related.pdf",
      labels: [
        { ...label, id: "label-related", document_id: "doc-related" },
        { ...hiddenLabel, document_id: "doc-related" },
      ],
      summary: "Related summary.",
      best_pages: [1],
      best_chunk_ids: ["related-chunk"],
      image_count: 0,
      match_reason: "Matched label: hidden-clinical-label-private-marker",
      score: 0.7,
    };
    const quoteCard = {
      ...citation,
      quote: "FBC weekly for 18 weeks.",
      section_heading: "Monitoring",
    };
    const bestSource = {
      ...citation,
      source_strength: "strong" as const,
      score: 0.92,
      snippet: "FBC weekly for 18 weeks.",
      section_heading: "Monitoring",
      image_count: 0,
      viewer_href: "/documents/doc-1",
    };
    const answer = {
      answer: "Use the cited monitoring schedule.",
      grounded: true,
      confidence: "high",
      citations: [citation],
      sources: [
        fullSource({
          source_metadata: sourceMetadata,
          document_labels: [label, hiddenLabel],
          indexing_quality: indexingQuality,
        }),
      ],
      quoteCards: [quoteCard],
      bestSource,
      relatedDocuments: [relatedDocument],
      smartPanel: {
        query: "clozapine monitoring",
        total_sources: 1,
        documents: [],
        quotes: [quoteCard],
        visualEvidence: [],
        bestSource,
        image_count: 0,
        evidenceSummary: {
          document_count: 1,
          total_sources: 1,
          quote_count: 1,
          image_count: 0,
          source_strength: "strong",
          summary: "One strong source.",
        },
        sourceCoverage: { documents_used: 1, pages: [4], strongest_similarity: 0.82, has_images: false },
        conflictsOrGaps: [],
        relatedDocuments: [relatedDocument],
        future_panel_secret: "panel-private-marker",
      },
      memoryCardsUsed: [
        {
          id: "memory-1",
          document_id: "doc-1",
          owner_id: "memory-owner-private-marker",
          card_type: "section_summary",
          title: "Private memory",
          content: "memory-content-private-marker",
          normalized_terms: [],
          page_number: 4,
          source_chunk_ids: ["chunk-1"],
          source_image_ids: [],
          confidence: 1,
          metadata: { raw: "memory-metadata-private-marker" },
          embedding: [0.1, 0.2],
        },
      ],
      safetyWarnings: [
        {
          id: "warning-1",
          kind: "monitoring",
          label: "Monitoring",
          text: "Check the source schedule.",
          citation,
          href: "/documents/doc-1",
        },
      ],
      future_answer_secret: "answer-private-marker",
    } as RagAnswer;

    const payload = buildGovernedAnswerClientResponse(answer).payload as RagAnswer;
    const serialized = JSON.stringify(payload);

    for (const privateMarker of [
      "uploader-private-marker",
      "reviewer-private-marker",
      "attestation-private-marker",
      "label-owner-private-marker",
      "label-metadata-private-marker",
      "hidden-clinical-label-private-marker",
      "hidden-reviewer-private-marker",
      "index-owner-private-marker",
      "index-metrics-private-marker",
      "memory-owner-private-marker",
      "memory-content-private-marker",
      "memory-metadata-private-marker",
      "panel-private-marker",
      "answer-private-marker",
    ]) {
      expect(serialized).not.toContain(privateMarker);
    }
    expect(payload.sources[0].source_metadata).toMatchObject({
      document_status: "current",
      clinical_validation_status: "approved",
    });
    expect(payload.sources[0].source_metadata?.uploaded_by).toBeNull();
    expect(payload.sources[0].document_labels).toEqual([
      expect.objectContaining({ label: "clozapine", metadata: { review_status: "approved" } }),
    ]);
    expect(payload.sources[0].indexing_quality).toMatchObject({
      quality_score: 0.92,
      metrics: {},
      issues: ["safe issue"],
    });
    expect(payload.citations[0].source_metadata).toMatchObject({ document_status: "current" });
    expect(payload.quoteCards?.[0].source_metadata).toMatchObject({ document_status: "current" });
    expect(payload.bestSource?.source_metadata).toMatchObject({ document_status: "current" });
    expect(payload.smartPanel?.quotes[0].source_metadata).toMatchObject({ document_status: "current" });
    expect(payload.smartPanel?.bestSource?.source_metadata).toMatchObject({ document_status: "current" });
    expect(payload.relatedDocuments?.[0].labels).toEqual([expect.objectContaining({ label: "clozapine" })]);
    expect(payload.smartPanel?.relatedDocuments?.[0].labels).toEqual([expect.objectContaining({ label: "clozapine" })]);
    expect(payload.safetyWarnings?.[0].citation.source_metadata).toMatchObject({ document_status: "current" });
    expect(payload.memoryCardsUsed).toBeUndefined();

    const projectedDocumentMatch = projectDocumentMatchForClient({
      document_id: "doc-related",
      title: "Related guideline",
      file_name: "related.pdf",
      labels: [
        { ...label, id: "label-match", document_id: "doc-related" },
        { ...hiddenLabel, document_id: "doc-related" },
      ],
      summarySnippet: "Related summary.",
      bestPages: [1],
      bestChunkIds: ["related-chunk"],
      imageCount: 0,
      tableCount: 0,
      matchReason: "Matched label",
      score: 0.7,
    });
    expect(projectedDocumentMatch.labels).toEqual([expect.objectContaining({ label: "clozapine" })]);
    expect(projectedDocumentMatch.labels[0].owner_id).toBeUndefined();
    expect(projectedDocumentMatch.labels[0].metadata).toEqual({ review_status: "approved" });
  });

  it("keeps identity, snippet, scoring, and governance fields intact", () => {
    const trimmed = toClientAnswerPayload(answerWith([fullSource()])).sources![0];
    expect(trimmed.id).toBe("chunk-1");
    expect(trimmed.title).toBe("Clozapine monitoring guideline");
    expect(trimmed.retrieval_synopsis).toBe("FBC weekly for 18 weeks, then monthly.");
    expect(trimmed.content).toBe("FBC weekly for 18 weeks, then monthly.");
    expect(trimmed.similarity).toBe(0.82);
    expect(trimmed.source_metadata).toMatchObject({ document_status: "current", uploaded_by: null });
    expect(trimmed.page_number).toBe(4);
  });

  it("derives safety warnings before replacing full source content with the rendered snippet", () => {
    const source = fullSource({ content: `${"Routine context. ".repeat(60)}Contraindicated in severe disease.` });
    const response = buildGovernedAnswerClientResponse({
      answer: "Review the source.",
      grounded: true,
      confidence: "medium",
      citations: [],
      sources: [source],
    } as RagAnswer);
    const payload = response.payload;

    expect(payload.sources![0].content).toBe(source.retrieval_synopsis);
    expect(payload.sources![0].content.length).toBeLessThan(source.content.length);
    expect(payload.safetyWarnings).toHaveLength(1);
    // Issue 9: governance provenance is retained on safety-finding citations so the
    // safety panel can badge outdated / review-due / unverified sources, consistent
    // with regular source citations (which already keep source_metadata).
    expect(payload.safetyWarnings![0].citation.source_metadata).toMatchObject({
      document_status: "current",
      uploaded_by: null,
    });
    expect(extractSafetyFindings(payload)).toHaveLength(1);
  });

  it("leaves short content untouched", () => {
    const short = fullSource({ content: "Short snippet.", retrieval_synopsis: undefined });
    expect(toClientAnswerPayload(answerWith([short])).sources![0].content).toBe("Short snippet.");
  });

  it("does not mutate the original answer (caches keep the full sources)", () => {
    const source = fullSource();
    const answer = answerWith([source]);
    toClientAnswerPayload(answer);
    expect(answer.sources![0].adjacent_context).toBeTruthy();
    expect(answer.sources![0].content.length).toBeGreaterThan(700);
  });

  it("passes through answers without sources", () => {
    const empty = answerWith([]);
    expect(toClientAnswerPayload(empty)).toEqual(empty);
  });

  it("materially shrinks a representative payload", () => {
    const answer = answerWith(Array.from({ length: 8 }, (_, index) => fullSource({ id: `chunk-${index}` })));
    const fullBytes = JSON.stringify(answer).length;
    const trimmedBytes = JSON.stringify(toClientAnswerPayload(answer)).length;
    expect(trimmedBytes).toBeLessThan(fullBytes * 0.8);
  });
});
