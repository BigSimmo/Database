import { describe, expect, it } from "vitest";
import {
  buildExtractiveAnswer,
  finalizeRagAnswerQuality,
  generatedAnswerQualityFailureReason,
} from "../src/lib/rag/rag-extractive-answer";
import { citationFromResult } from "../src/lib/citations";
import { hasDanglingProceduralComparatorStepArtifact } from "../src/lib/rag/rag-extractive-artifacts";
import type { RagAnswer, SearchResult } from "../src/lib/types";

function ectResult(overrides: Partial<SearchResult>): SearchResult {
  return {
    id: "ect-artifact",
    document_id: "ect-akg",
    title: "ECT Procedure (AKG)",
    file_name: "ECT Procedure (AKG).pdf",
    page_number: 17,
    chunk_index: 1,
    section_heading:
      "ECT records) ECT Nurse Coordinator to transfer patient 1 to procedure matching Inform rostered ECT",
    content: "Referral for ECT > 6",
    image_ids: [],
    similarity: 0.94,
    hybrid_score: 0.96,
    images: [],
    ...overrides,
  } as unknown as SearchResult;
}

function extractiveAnswer(results: SearchResult[]) {
  return buildExtractiveAnswer({
    query: "What is the process for ECT procedure?",
    queryClass: "document_lookup",
    results,
    quoteCards: [],
    documentBreakdown: [] as RagAnswer["documentBreakdown"],
    evidenceSummary: undefined as unknown as RagAnswer["evidenceSummary"],
    sourceCoverage: undefined as unknown as RagAnswer["sourceCoverage"],
    conflictsOrGaps: [],
    visualEvidence: [] as unknown as RagAnswer["visualEvidence"],
    bestSource: undefined as unknown as RagAnswer["bestSource"],
    smartPanel: undefined as unknown as RagAnswer["smartPanel"],
    relatedDocuments: [] as unknown as RagAnswer["relatedDocuments"],
    routeReason: "test",
    timings: undefined as unknown as RagAnswer["latencyTimings"],
  });
}

describe("extractive procedural comparator artifacts", () => {
  it("does not promote the flattened ECT flowchart edge over substantive workflow evidence", () => {
    const cleanWorkflow = ectResult({
      id: "ect-clean-workflow",
      document_id: "ect-fsh",
      title: "ECT Coordinator Role (FSH)",
      file_name: "ECT Coordinator Role (FSH).pdf",
      page_number: 2,
      section_heading: "ECT bookings",
      content:
        "Following receipt of referral, the ECT Coordinator places the patient onto the\nBooking Assistant Scheduling Engine (BASE).",
      similarity: 0.91,
      hybrid_score: 0.94,
    });

    const artifact = ectResult({});
    const results = [artifact, cleanWorkflow];
    const answer = extractiveAnswer(results);
    const plain = answer.answer.replace(/\*\*/g, "");

    expect(answer.grounded).toBe(true);
    expect(plain).toContain(
      "Following receipt of referral, the ECT Coordinator places the patient onto the Booking Assistant Scheduling Engine (BASE).",
    );
    expect(plain).not.toMatch(/onto the\s*\.$/i);
    expect(plain).not.toMatch(/referral for ECT\s*>\s*6/i);
    expect(answer.answerSections?.some((section) => section.citation_chunk_ids.includes(cleanWorkflow.id))).toBe(true);
    expect(answer.citations.map((citation) => citation.chunk_id)).toEqual([cleanWorkflow.id]);
    expect(answer.quoteCards?.map((quote) => quote.chunk_id) ?? []).not.toContain(artifact.id);
    expect(answer.sources.map((source) => source.id)).toEqual([cleanWorkflow.id]);

    const finalized = finalizeRagAnswerQuality(
      answer,
      "What is the process for ECT procedure?",
      "document_lookup",
      results,
    );
    expect(finalized.grounded).toBe(true);
    expect(finalized.answer).toContain(
      "Following receipt of referral, the ECT Coordinator places the patient onto the Booking Assistant Scheduling Engine (BASE).",
    );
    expect(finalized.answer).not.toMatch(/referral for ECT\s*>\s*6/i);
    expect(finalized.citations.map((citation) => citation.chunk_id)).toEqual([cleanWorkflow.id]);
    expect(finalized.quoteCards?.map((quote) => quote.chunk_id) ?? []).not.toContain(artifact.id);
    expect(finalized.sources.map((source) => source.id)).toEqual([cleanWorkflow.id]);
    expect(finalized.supportedClaims?.some((claim) => claim.supportStatus === "direct")).toBe(true);
    expect(finalized.supportedClaims?.flatMap((claim) => claim.supportingChunkIds) ?? []).not.toContain(artifact.id);
  });

  it("fails closed when the only apparent procedure fact is a dangling flowchart edge", () => {
    const artifact = ectResult({});
    const answer = extractiveAnswer([artifact]);

    expect(answer.grounded).toBe(false);
    expect(answer.confidence).toBe("unsupported");
    expect(answer.answer).toBe("No current source with ECT referral criteria was found.");
    expect(answer.answer).not.toMatch(/referral for ECT\s*>\s*6/i);
    expect(answer.citations).toEqual([]);
    expect(answer.quoteCards).toEqual([]);
    expect(answer.sources).toEqual([]);
    expect(answer.bestSource).toBeNull();
    expect(answer.documentBreakdown).toEqual([]);
    expect(answer.evidenceSummary).toMatchObject({ document_count: 0, total_sources: 0, quote_count: 0 });
    expect(answer.sourceCoverage).toMatchObject({ documents_used: 0, pages: [] });
    expect(answer.smartPanel).toMatchObject({ total_sources: 0, documents: [], quotes: [], bestSource: null });

    const finalized = finalizeRagAnswerQuality(answer, "What is the process for ECT procedure?", "document_lookup", [
      artifact,
    ]);
    expect(finalized.grounded).toBe(false);
    expect(finalized.citations).toEqual([]);
    expect(finalized.quoteCards).toEqual([]);
    expect(finalized.sources).toEqual([]);
    expect(finalized.bestSource).toBeNull();
    expect(finalized.documentBreakdown).toEqual([]);
    expect(finalized.supportedClaims?.every((claim) => claim.supportStatus === "unsupported")).toBe(true);
    expect(finalized.supportedClaims?.flatMap((claim) => claim.supportingChunkIds) ?? []).toEqual([]);
  });

  it("fails closed instead of returning a bare document-title list when the clean result is only document-level", () => {
    const cleanDocument = ectResult({
      id: "ect-clean-document",
      document_id: "ect-clean-document-record",
      title: "Current ECT Workflow Overview",
      file_name: "Current ECT Workflow Overview.pdf",
      section_heading: "Document scope",
      content: "This current document contains the ECT procedure workflow and staff responsibilities.",
      similarity: 0.91,
      hybrid_score: 0.94,
    });

    const answer = extractiveAnswer([ectResult({}), cleanDocument]);

    expect(answer.grounded).toBe(false);
    expect(answer.confidence).toBe("unsupported");
    expect(answer.answer).toBe("No current source with ECT referral criteria was found.");
    expect(answer.answer).not.toContain("Current ECT Workflow Overview");
    expect(answer.answer).not.toContain("ECT Procedure (AKG)");
    expect(answer.citations.map((citation) => citation.chunk_id)).toEqual([cleanDocument.id]);
    expect(answer.sources.map((source) => source.id)).toEqual([cleanDocument.id]);
    expect(answer.quoteCards?.map((quote) => quote.chunk_id) ?? []).not.toContain("ect-artifact");
    expect(answer.answerSections).toEqual([]);

    const finalized = finalizeRagAnswerQuality(answer, "What is the process for ECT procedure?", "document_lookup", [
      ectResult({}),
      cleanDocument,
    ]);
    expect(finalized.grounded).toBe(false);
    expect(finalized.citations).toEqual([]);
    expect(finalized.sources.map((source) => source.id)).toEqual([cleanDocument.id]);
    expect(finalized.sources.map((source) => source.id)).not.toContain("ect-artifact");
  });

  it("rebuilds every user-visible derived artifact after removing a mixed-set flow edge", () => {
    const artifact = ectResult({});
    const clean = ectResult({
      id: "ect-clean-derived",
      document_id: "ect-clean-derived-document",
      title: "Current ECT Workflow",
      file_name: "Current ECT Workflow.pdf",
      section_heading: "Referral workflow",
      content:
        "Following receipt of an ECT referral, the coordinator verifies consent and completes the booking documentation.",
    });
    const artifactCitation = citationFromResult(artifact, "exact_quote");
    const answer = buildExtractiveAnswer({
      query: "What is the process for ECT procedure?",
      queryClass: "document_lookup",
      results: [artifact, clean],
      quoteCards: [
        {
          ...artifactCitation,
          quote: "Referral for ECT > 6",
          isTruncated: false,
          section_heading: artifact.section_heading,
        },
      ],
      documentBreakdown: [
        {
          document_id: artifact.document_id,
          title: artifact.title,
          file_name: artifact.file_name,
          top_similarity: 0.96,
          source_strength: "strong",
          source_count: 1,
          quote_count: 1,
          pages: [17],
          best_quote: "Referral for ECT > 6",
        },
      ],
      evidenceSummary: {
        document_count: 1,
        total_sources: 1,
        quote_count: 1,
        image_count: 0,
        source_strength: "strong",
        summary: "Referral for ECT > 6",
      },
      sourceCoverage: {
        documents_used: 1,
        pages: [17],
        strongest_similarity: 0.96,
        has_images: false,
      },
      conflictsOrGaps: [{ type: "gap", message: "Referral for ECT > 6", source_chunk_ids: [artifact.id] }],
      visualEvidence: [],
      bestSource: {
        ...artifactCitation,
        source_strength: "strong",
        score: 0.96,
        snippet: "Referral for ECT > 6",
        section_heading: artifact.section_heading,
        image_count: 0,
        viewer_href: "/documents/ect-akg",
      },
      smartPanel: {
        query: "What is the process for ECT procedure?",
        total_sources: 1,
        documents: [],
        quotes: [],
        visualEvidence: [],
        bestSource: null,
        image_count: 0,
        evidenceSummary: {
          document_count: 1,
          total_sources: 1,
          quote_count: 0,
          image_count: 0,
          source_strength: "strong",
          summary: "Referral for ECT > 6",
        },
        sourceCoverage: {
          documents_used: 1,
          pages: [17],
          strongest_similarity: 0.96,
          has_images: false,
        },
        conflictsOrGaps: [],
        relevance: {} as NonNullable<RagAnswer["relevance"]>,
      },
      relatedDocuments: [
        {
          document_id: artifact.document_id,
          title: artifact.title,
          file_name: artifact.file_name,
          labels: [],
          summary: "Referral for ECT > 6",
          best_pages: [17],
          best_chunk_ids: [artifact.id],
          image_count: 0,
          match_reason: "Referral for ECT > 6",
          score: 0.96,
        },
      ],
      routeReason: "test",
      timings: undefined,
    });

    expect(answer.sources.map((source) => source.id)).toEqual([clean.id]);
    expect(answer.documentBreakdown?.map((document) => document.document_id)).toEqual([clean.document_id]);
    expect(answer.evidenceSummary).toMatchObject({ document_count: 1, total_sources: 1 });
    expect(answer.sourceCoverage).toMatchObject({ documents_used: 1 });
    expect(answer.bestSource?.chunk_id).toBe(clean.id);
    expect(answer.relatedDocuments).toEqual([]);
    expect(JSON.stringify(answer)).not.toMatch(/Referral for ECT\s*>\s*6/i);
  });

  it("filters a colon-normalized table-fact flow edge during build and finalization", () => {
    const artifact = ectResult({
      content: "The ECT document contains a referral workflow.",
      table_facts: [
        {
          id: "ect-referral-step-fact",
          document_id: "ect-akg",
          source_chunk_id: "ect-artifact",
          source_image_id: null,
          page_number: 17,
          table_title: "ECT workflow",
          row_label: "Referral for ECT",
          clinical_parameter: null,
          threshold_value: "> 6",
          action: null,
        },
      ],
    });

    const built = extractiveAnswer([artifact]);
    expect(built.grounded).toBe(false);
    expect(built.citations).toEqual([]);
    expect(built.sources).toEqual([]);

    const finalized = finalizeRagAnswerQuality(
      {
        answer: "The ECT procedure uses the documented referral workflow.",
        grounded: true,
        confidence: "medium",
        citations: [citationFromResult(artifact, "deterministic_support")],
        sources: [artifact],
        routingMode: "extractive",
        routingReason: "source_backed_extractive_fallback",
        queryClass: "document_lookup",
        answerSections: [],
      },
      "What is the process for ECT procedure?",
      "document_lookup",
      [artifact],
    );

    expect(finalized.grounded).toBe(false);
    expect(finalized.citations).toEqual([]);
    expect(finalized.sources).toEqual([]);
    expect(finalized.bestSource).toBeNull();
  });

  it("rejects the exact previously grounded answer at the final extractive quality gate", () => {
    const clean = extractiveAnswer([
      ectResult({
        id: "ect-final-quality-control",
        content:
          "Following receipt of an ECT referral, the ECT Coordinator verifies the required consent and booking documentation.",
      }),
    ]);

    expect(
      generatedAnswerQualityFailureReason(
        { ...clean, answer: "The guidance for process is that referral for ECT > 6." },
        "What is the process for ECT procedure?",
        "document_lookup",
      ),
    ).toBe("bad_final_answer_quality");
  });

  it.each([
    "LUNSERS score > 6",
    "eGFR <30",
    "QTc >500 ms",
    "ECT treatment count > 6",
    "After more than 6 ECT treatments, the treating team should review clinical response.",
    "Contact the treating team when potassium > 6 mmol/L.",
    "Notify the medical officer if O2 saturation < 90%.",
    "Review treatment when prolactin > 1000 mIU/L.",
    "Escalate if weight > 100 kg.",
    "Referral for ECT > 6.5",
    "Referral for ECT > 7",
    "Referral for ECT > 60",
  ])("does not reject a non-artifact clinical comparator: %s", (content) => {
    expect(hasDanglingProceduralComparatorStepArtifact(content)).toBe(false);
  });

  it.each([
    "Referral for ECT > 6",
    "Referral for ECT > 6, then confirm the booking.",
    "Referral for ECT > 6 and notify the coordinator.",
    "Referral for ECT\n> 6 and notify the coordinator.",
    "Continue with referral for ECT > 6 to procedure matching.",
    "Transfer patient -> step 4 and notify theatre.",
    "Recovery workflow → 3, then return to the ward.",
  ])("rejects a bounded flattened flow edge even with continuation text: %s", (content) => {
    expect(hasDanglingProceduralComparatorStepArtifact(content)).toBe(true);
  });
});
