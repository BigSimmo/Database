import { describe, expect, it } from "vitest";
import { buildRagEvaluationDiagnostics, evaluateAustralianRagExpectation } from "@/lib/rag/rag-eval-diagnostics";
import { evaluateAnswerCoverage, reconcileAnswerSourcePolicyConflicts } from "@/lib/rag/rag-coverage";
import type { Citation, RagAnswer, RagQueryPlan, SearchResult, SourcePolicyConflict } from "@/lib/types";

function source(args: {
  id: string;
  documentId: string;
  publisherCode?: string;
  publisher?: string;
  jurisdiction?: string;
}): SearchResult {
  const publisherCode = args.publisherCode ?? "WACHS";
  return {
    id: args.id,
    document_id: args.documentId,
    title: `${publisherCode} lithium guidance`,
    file_name: `${publisherCode}-lithium-${args.documentId}.pdf`,
    page_number: 1,
    chunk_index: 0,
    section_heading: "Lithium",
    content: "Lithium guidance with a directly supported monitoring statement.",
    image_ids: [],
    similarity: 0.9,
    source_metadata: {
      source_title: `${publisherCode} lithium guidance`,
      publisher_code: publisherCode,
      publisher: args.publisher ?? (publisherCode === "BMJ" ? "BMJ Best Practice" : "WA Country Health Service"),
      jurisdiction: args.jurisdiction ?? (publisherCode === "BMJ" ? "International" : "Australia/WA"),
      version: null,
      publication_date: null,
      review_date: null,
      uploaded_at: null,
      indexed_at: null,
      uploaded_by: null,
      document_status: "current",
      clinical_validation_status: publisherCode === "BMJ" ? "unverified" : "locally_reviewed",
      extraction_quality: "good",
    },
    images: [],
  };
}

function citationFor(item: SearchResult): Citation {
  return {
    chunk_id: item.id,
    document_id: item.document_id,
    title: item.title,
    file_name: item.file_name,
    page_number: item.page_number,
    chunk_index: item.chunk_index,
    source_metadata: item.source_metadata,
  };
}

function answer(sources: SearchResult[], citations: Citation[]): RagAnswer {
  return {
    answer: "A finalized source-backed lithium answer.",
    grounded: true,
    confidence: "high",
    sources,
    citations,
    routingMode: "fast",
    responseMode: "clinical_pathway",
    answerQualityTier: "model_synthesis",
    providerMode: "openai",
    fallbackReason: null,
    latencyTimings: { generation_latency_ms: 1200, total_latency_ms: 1800 },
    unverifiedNumericTokens: [],
  };
}

describe("Australian RAG evaluation diagnostics", () => {
  it("passes a grounded answer with valid Australian citations and sufficient local candidates", () => {
    const sources = [
      source({ id: "wa-1", documentId: "wa-a" }),
      source({ id: "wa-2", documentId: "wa-a" }),
      source({ id: "wa-3", documentId: "wa-b" }),
      source({ id: "wa-4", documentId: "wa-b" }),
    ];
    const diagnostics = buildRagEvaluationDiagnostics(answer(sources, [citationFor(sources[0])]), [
      { stage: "retrieved" },
      { stage: "ranking", usedSupplementaryFallback: false, australianSourceCount: 4 },
      { stage: "generating", mode: "fast" },
      { stage: "verifying" },
    ]);
    const expectation = evaluateAustralianRagExpectation(diagnostics);

    expect(expectation).toEqual({ passed: true, failures: [], warnings: [] });
    expect(diagnostics.source_tier_counts.wa_validated).toBe(4);
    expect(diagnostics.valid_australian_citation_count).toBe(1);
    expect(diagnostics.progress_sequence).toEqual(["retrieved", "ranking", "generating", "verifying"]);
    expect(diagnostics.generation_routes).toEqual(["fast"]);
    expect(diagnostics.latency_timings?.total_latency_ms).toBe(1800);
  });

  it("fails when supplementary evidence is selected despite four Australian passages across two documents", () => {
    const australian = [
      source({ id: "wa-1", documentId: "wa-a" }),
      source({ id: "wa-2", documentId: "wa-a" }),
      source({ id: "wa-3", documentId: "wa-b" }),
      source({ id: "wa-4", documentId: "wa-b" }),
    ];
    const supplementary = source({ id: "bmj-1", documentId: "bmj", publisherCode: "BMJ" });
    const diagnostics = buildRagEvaluationDiagnostics(
      answer([...australian, supplementary], [citationFor(australian[0]), citationFor(supplementary)]),
      [{ stage: "ranking", usedSupplementaryFallback: true, australianSourceCount: 4 }],
    );

    expect(diagnostics.supplementary_selected_despite_sufficient_australian).toBe(true);
    expect(evaluateAustralianRagExpectation(diagnostics).failures).toContain(
      "supplementary evidence selected despite sufficient Australian evidence",
    );
  });

  it("fails authority, citation, numeric, and generic-finalization defects", () => {
    const conflicted = source({
      id: "wa-conflict",
      documentId: "wa-a",
      publisher: "NPS MedicineWise",
    });
    const invalidCitation = { ...citationFor(conflicted), chunk_id: "missing-chunk" };
    const defective = {
      ...answer([conflicted], [invalidCitation]),
      answer: "I found matching indexed passages, but could not generate a finalized answer right now.",
      unverifiedNumericTokens: ["900 mg"],
    };
    const diagnostics = buildRagEvaluationDiagnostics(defective);
    const expectation = evaluateAustralianRagExpectation(diagnostics);

    expect(expectation.passed).toBe(false);
    expect(expectation.failures).toEqual(
      expect.arrayContaining([
        "no valid Australian citation",
        "invalid citations 1",
        "source authority conflicts 1",
        "unverified numeric tokens 1",
        "generic finalization failure returned",
      ]),
    );
  });

  it("warns without failing when Australian coverage is valid but sparse", () => {
    const local = source({ id: "wa-1", documentId: "wa-a" });
    const diagnostics = buildRagEvaluationDiagnostics(answer([local], [citationFor(local)]));
    const expectation = evaluateAustralianRagExpectation(diagnostics);

    expect(expectation.passed).toBe(true);
    expect(expectation.warnings).toEqual(["Australian candidate passages 1/4", "Australian candidate documents 1/2"]);
  });

  it("removes a request-local policy conflict when final citation reconciliation drops either side", () => {
    const local = {
      ...source({ id: "local-chunk", documentId: "local-doc" }),
      corpus_scope: "uploaded_local" as const,
      site_content_domain: null,
      source_metadata: {
        ...source({ id: "local-chunk", documentId: "local-doc" }).source_metadata!,
        corpus_scope: "uploaded_local" as const,
        source_role: "local_guideline" as const,
        content_mode: "indexed_content" as const,
      },
    };
    const australian = {
      ...source({ id: "au-chunk", documentId: "au-doc" }),
      corpus_scope: "australian_public" as const,
      site_content_domain: null,
      source_metadata: {
        ...source({ id: "au-chunk", documentId: "au-doc" }).source_metadata!,
        corpus_scope: "australian_public" as const,
        source_role: "clinical_guideline" as const,
        content_mode: "indexed_content" as const,
      },
    };
    const plan: RagQueryPlan = {
      version: "rag-query-plan-v1",
      kind: "single",
      originalQuery: "lithium monitoring",
      interpretation: "Lithium monitoring",
      subquestions: [{ id: "monitoring", question: "lithium monitoring", purpose: "monitoring", required: true }],
      targetSiteDomains: [],
      siteDomainDecision: "none",
      reasonCodes: [],
    };
    const conflict: SourcePolicyConflict = {
      version: "source-policy-conflict-v1",
      id: "conflict-1",
      claimRole: "dose_or_monitoring",
      topicKey: "lithium-monitoring",
      local: {
        documentId: "local-doc",
        catalogueKey: "local:lithium",
        title: "Local lithium guidance",
        publisher: "WA Health",
        publicationDate: "2024-01-01",
        effectiveFrom: "2024-01-01",
        jurisdiction: "Australia/WA",
        sourceRole: "local_guideline",
        corpusScope: "uploaded_local",
        supportingChunkIds: [local.id],
      },
      australian: {
        documentId: "au-doc",
        catalogueKey: "au:lithium",
        title: "Australian lithium guidance",
        publisher: "Australian guidance publisher",
        publicationDate: "2026-01-01",
        effectiveFrom: "2026-01-01",
        jurisdiction: "Australia/National",
        sourceRole: "clinical_guideline",
        corpusScope: "australian_public",
        supportingChunkIds: [australian.id],
      },
      overlapReason: "same_claim",
      materialDifferenceReason: "monitoring_differs",
      localPrimaryDecision: { selected: "uploaded_local", reason: "current_valid_accessible_directly_supportive" },
      reviewTargetDocumentId: "local-doc",
    };

    const coverage = evaluateAnswerCoverage({
      plan,
      selectedEvidence: [local, australian],
      evidenceBySubquestion: [
        {
          subquestionId: "monitoring",
          selectedChunkIds: [local.id, australian.id],
          citedChunkIds: [local.id],
          eligibleChunkIds: [local.id, australian.id],
          support: "direct",
        },
      ],
      conflicts: [conflict],
    });

    expect(coverage.conflicts).toEqual([]);
    expect(coverage.coverage[0]).toMatchObject({ status: "direct", chunkIds: [local.id] });
    const answerWithDroppedConflict = answer([local, australian], [citationFor(local)]);
    answerWithDroppedConflict.conflictsOrGaps = [
      { type: "conflict", message: "Provisional source policy conflict.", source_chunk_ids: [local.id, australian.id] },
      { type: "gap", message: "Local evidence needs broader review.", source_chunk_ids: [local.id] },
      { type: "conflict", message: "One-source numeric review.", source_chunk_ids: [local.id] },
    ];
    reconcileAnswerSourcePolicyConflicts(
      answerWithDroppedConflict,
      [
        {
          subquestionId: "monitoring",
          claimRole: "dose_or_monitoring",
          orderedEvidence: [local, australian],
          collapsedEvidenceFamilyIds: [],
          conflicts: [conflict],
          sourcePolicyReview: "verified_conflict",
          coverageReason: "direct",
        },
      ],
      coverage,
    );
    expect(answerWithDroppedConflict.conflictsOrGaps).toEqual([
      { type: "gap", message: "Local evidence needs broader review.", source_chunk_ids: [local.id] },
    ]);

    const retainedCoverage = evaluateAnswerCoverage({
      plan,
      selectedEvidence: [local, australian],
      evidenceBySubquestion: [
        {
          subquestionId: "monitoring",
          selectedChunkIds: [local.id, australian.id],
          citedChunkIds: [local.id, australian.id],
          eligibleChunkIds: [local.id, australian.id],
          support: "direct",
        },
      ],
      conflicts: [conflict],
    });
    const answerWithRetainedConflict = answer([local, australian], [citationFor(local), citationFor(australian)]);
    reconcileAnswerSourcePolicyConflicts(
      answerWithRetainedConflict,
      [
        {
          subquestionId: "monitoring",
          claimRole: "dose_or_monitoring",
          orderedEvidence: [local, australian],
          collapsedEvidenceFamilyIds: [],
          conflicts: [conflict],
          sourcePolicyReview: "verified_conflict",
          coverageReason: "direct",
        },
      ],
      retainedCoverage,
    );
    expect(answerWithRetainedConflict.conflictsOrGaps).toEqual([
      expect.objectContaining({ type: "conflict", source_chunk_ids: [local.id, australian.id] }),
    ]);

    const uncitedLocal = { ...local, id: "local-uncited" };
    const uncitedAustralian = { ...australian, id: "au-uncited" };
    const multiChunkConflict: SourcePolicyConflict = {
      ...conflict,
      id: "conflict-multi-chunk",
      local: { ...conflict.local, supportingChunkIds: [uncitedLocal.id, local.id] },
      australian: { ...conflict.australian, supportingChunkIds: [uncitedAustralian.id, australian.id] },
    };
    const citedMultiChunkCoverage = evaluateAnswerCoverage({
      plan,
      selectedEvidence: [uncitedLocal, local, uncitedAustralian, australian],
      evidenceBySubquestion: [
        {
          subquestionId: "monitoring",
          selectedChunkIds: [uncitedLocal.id, local.id, uncitedAustralian.id, australian.id],
          citedChunkIds: [local.id, australian.id],
          eligibleChunkIds: [uncitedLocal.id, local.id, uncitedAustralian.id, australian.id],
          support: "direct",
        },
      ],
      conflicts: [multiChunkConflict],
    });
    const answerWithMultiChunkConflict = answer(
      [uncitedLocal, local, uncitedAustralian, australian],
      [citationFor(local), citationFor(australian)],
    );
    reconcileAnswerSourcePolicyConflicts(
      answerWithMultiChunkConflict,
      [
        {
          subquestionId: "monitoring",
          claimRole: "dose_or_monitoring",
          orderedEvidence: [uncitedLocal, local, uncitedAustralian, australian],
          collapsedEvidenceFamilyIds: [],
          conflicts: [multiChunkConflict],
          sourcePolicyReview: "verified_conflict",
          coverageReason: "direct",
        },
      ],
      citedMultiChunkCoverage,
    );
    expect(answerWithMultiChunkConflict.conflictsOrGaps).toEqual([
      expect.objectContaining({ type: "conflict", source_chunk_ids: [local.id, australian.id] }),
    ]);

    const notEvaluatedCoverage = {
      ...coverage,
      coverage: coverage.coverage.map((item) => ({
        ...item,
        reasonCodes: [...item.reasonCodes, "source_policy_not_evaluated"],
      })),
    };
    const answerWithReviewGap = answer([local], [citationFor(local)]);
    reconcileAnswerSourcePolicyConflicts(
      answerWithReviewGap,
      [
        {
          subquestionId: "monitoring",
          claimRole: "dose_or_monitoring",
          orderedEvidence: [local],
          collapsedEvidenceFamilyIds: [],
          conflicts: [],
          sourcePolicyReview: "not_evaluated",
          coverageReason: "direct",
        },
      ],
      notEvaluatedCoverage,
    );
    expect(answerWithReviewGap.conflictsOrGaps).toEqual([
      expect.objectContaining({ type: "gap", source_chunk_ids: [local.id] }),
    ]);
  });
});
