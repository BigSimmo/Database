import { describe, expect, it } from "vitest";
import { capPerDocumentCrowding, packedContextCacheKey, selectModelContextResults } from "../src/lib/rag/rag";
import {
  evaluateAnswerCoverage,
  formatAnswerCoveragePromptLine,
  mergeEvidenceByCoverageAndSourceRole,
} from "../src/lib/rag/rag-coverage";
import type {
  ClinicalSourceRole,
  RagQueryClass,
  RagQueryPlan,
  SearchResult,
  SourceCorpusScope,
} from "../src/lib/types";

function source(index: number, overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: `chunk-${index}`,
    document_id: `doc-${index}`,
    title: `Guideline ${index}`,
    file_name: `guideline-${index}.pdf`,
    page_number: index,
    chunk_index: index,
    section_heading: "Overview",
    content: `Clinical source text ${index}.`,
    image_ids: [],
    similarity: 0.9 - index * 0.01,
    hybrid_score: 0.9 - index * 0.01,
    images: [],
    ...overrides,
  };
}

function governedSource(
  index: number,
  args: {
    documentId: string;
    publisherCode: string;
    publisher: string;
    jurisdiction: string;
    validation?: "unverified" | "locally_reviewed" | "approved";
  },
) {
  return source(index, {
    document_id: args.documentId,
    source_metadata: {
      source_title: `Guideline ${index}`,
      publisher: args.publisher,
      publisher_code: args.publisherCode,
      jurisdiction: args.jurisdiction,
      version: null,
      publication_date: null,
      review_date: null,
      uploaded_at: null,
      indexed_at: null,
      uploaded_by: null,
      document_status: "current",
      clinical_validation_status: args.validation ?? "approved",
      extraction_quality: "good",
    },
  });
}

function withRelevance(result: SearchResult, verdict: NonNullable<SearchResult["relevance"]>["verdict"]): SearchResult {
  return {
    ...result,
    relevance: {
      verdict,
      label: verdict,
      matchedTerms: verdict === "none" ? [] : ["lithium"],
      missingTerms: [],
      directSourceCount: verdict === "direct" ? 1 : 0,
      weakSourceCount: verdict === "direct" ? 0 : 1,
      score: verdict === "direct" ? 1 : verdict === "partial" ? 0.7 : verdict === "nearby" ? 0.4 : 0,
      supportReason: `${verdict} test evidence`,
      isSourceBacked: verdict === "direct" || verdict === "partial",
      coverageScore: verdict === "direct" ? 1 : 0.5,
      rankScore: verdict === "direct" ? 1 : 0.5,
      titleMatchedTerms: [],
      contentMatchedTerms: verdict === "none" ? [] : ["lithium"],
      metadataMatchedTerms: [],
      chips: [],
    },
  };
}

function waGovernedSource(index: number, documentId: string) {
  const fsh = documentId === "wa-doc-1";
  return governedSource(index, {
    documentId,
    publisherCode: fsh ? "FSH" : "EMHS",
    publisher: fsh ? "Fiona Stanley Fremantle Hospitals Group" : "East Metropolitan Health Service",
    jurisdiction: "Australia/WA",
  });
}

function bmjSupplementarySource(index: number) {
  return governedSource(index, {
    documentId: "bmj-doc",
    publisherCode: "BMJ",
    publisher: "BMJ Best Practice",
    jurisdiction: "International",
    validation: "unverified",
  });
}

const results = Array.from({ length: 12 }, (_, index) => source(index + 1));

function queryPlan(
  subquestions: Array<{ id: string; question: string; purpose?: "primary" | "monitoring" }>,
  targetSiteDomains: RagQueryPlan["targetSiteDomains"] = [],
): RagQueryPlan {
  return {
    version: "rag-query-plan-v1",
    kind: subquestions.length > 1 ? "decomposed" : "single",
    originalQuery: subquestions.map((item) => item.question).join(" and "),
    interpretation: "Task 4 policy example",
    subquestions: subquestions.map((item) => ({
      id: item.id,
      question: item.question,
      purpose: item.purpose ?? "primary",
      required: true,
    })),
    targetSiteDomains,
    siteDomainDecision: targetSiteDomains.length ? "explicit" : "none",
    reasonCodes: [],
  };
}

function governedEvidence(args: {
  id: string;
  corpusScope: SourceCorpusScope;
  content: string;
  documentId?: string;
  role?: ClinicalSourceRole;
  jurisdiction?: string;
  publisher?: string;
  contentHash?: string;
  metadata?: Record<string, unknown>;
}): SearchResult {
  const documentId = args.documentId ?? `${args.id}-document`;
  const australianRole = args.role ?? "clinical_guideline";
  const australianClinicalGuideline =
    args.corpusScope === "australian_public" && australianRole === "clinical_guideline";
  return source(1, {
    id: args.id,
    document_id: documentId,
    title: `${args.id} guidance`,
    file_name: `${args.id}.md`,
    content: args.content,
    corpus_scope: args.corpusScope,
    site_content_domain: args.corpusScope === "clinical_kb_site" ? "medications" : null,
    source_metadata: {
      source_kind: args.corpusScope === "clinical_kb_site" ? "registry_record" : "document",
      registry_record_kind: args.corpusScope === "clinical_kb_site" ? "medication" : null,
      registry_record_id: args.corpusScope === "clinical_kb_site" ? documentId : null,
      source_title: `${args.id} guidance`,
      publisher_code:
        args.corpusScope === "australian_public" ? (australianClinicalGuideline ? "OCPWA" : "WAHEALTH") : null,
      publisher:
        args.publisher ??
        (args.corpusScope === "international_supplementary"
          ? "International Publisher"
          : australianClinicalGuideline
            ? "Office of the Chief Psychiatrist WA"
            : "WA Health"),
      jurisdiction:
        args.jurisdiction ?? (args.corpusScope === "international_supplementary" ? "International" : "Australia/WA"),
      version: "1",
      publication_date: "2026-01-01",
      review_date: "2026-06-01",
      uploaded_at: null,
      indexed_at: "2026-06-01",
      uploaded_by: null,
      corpus_scope: args.corpusScope,
      source_role: args.corpusScope === "uploaded_local" ? (args.role ?? "local_guideline") : australianRole,
      content_mode: "indexed_content",
      source_catalogue_key:
        args.corpusScope === "australian_public"
          ? australianClinicalGuideline
            ? "wa-chief-psychiatrist"
            : "wa-health"
          : `${args.corpusScope}:${documentId}`,
      source_policy_version: args.corpusScope === "australian_public" ? "australian-source-policy-v1" : null,
      content_hash: args.contentHash ?? null,
      change_state: "unchanged",
      licence_policy: "public_index_permitted",
      document_status: "current",
      clinical_validation_status: "approved",
      extraction_quality: "good",
      ...args.metadata,
    },
  });
}

function select(args: {
  routeMode: "unsupported" | "extractive" | "fast" | "strong";
  queryClass: RagQueryClass;
  crossDocument?: boolean;
}) {
  return selectModelContextResults({
    routeMode: args.routeMode,
    queryClass: args.queryClass,
    crossDocument: args.crossDocument ?? false,
    results,
  });
}

describe("RAG model context budgeting", () => {
  it("limits routine fast generation to the top four sources", () => {
    const selected = select({ routeMode: "fast", queryClass: "document_lookup" });

    expect(selected.map((result) => result.id)).toEqual(["chunk-1", "chunk-2", "chunk-3", "chunk-4"]);
  });

  it("keeps broader context for synthesis-heavy fast routes", () => {
    expect(select({ routeMode: "fast", queryClass: "comparison" })).toHaveLength(12);
    expect(select({ routeMode: "fast", queryClass: "broad_summary" })).toHaveLength(12);
    expect(select({ routeMode: "fast", queryClass: "document_lookup", crossDocument: true })).toHaveLength(12);
  });

  it("bounds high-risk supplementary-only context without dropping all available evidence", () => {
    const selected = select({ routeMode: "fast", queryClass: "medication_dose_risk" });

    expect(selected).toHaveLength(6);
    expect(selected.map((result) => result.id)).toEqual([
      "chunk-1",
      "chunk-2",
      "chunk-3",
      "chunk-4",
      "chunk-5",
      "chunk-6",
    ]);
  });

  it("does not limit strong generation or non-model routes", () => {
    expect(select({ routeMode: "strong", queryClass: "document_lookup" })).toHaveLength(12);
    expect(select({ routeMode: "extractive", queryClass: "document_lookup" })).toHaveLength(12);
    expect(select({ routeMode: "unsupported", queryClass: "unsupported_or_general" })).toHaveLength(12);
  });

  it("caps a crowding document to three chunks in the model context but keeps other docs (P9)", () => {
    const crowded: SearchResult[] = [
      source(1), // doc-1
      { ...source(2), document_id: "doc-1", id: "a2" },
      { ...source(3), document_id: "doc-1", id: "a3" },
      { ...source(4), document_id: "doc-1", id: "a4" }, // 4th from doc-1 → dropped
      { ...source(5), document_id: "doc-1", id: "a5" }, // 5th from doc-1 → dropped
      { ...source(6), document_id: "doc-2", id: "b1" },
    ];
    const selected = selectModelContextResults({
      routeMode: "strong",
      queryClass: "broad_summary",
      crossDocument: false,
      results: crowded,
    });
    const perDoc = selected.reduce<Record<string, number>>((acc, r) => {
      acc[r.document_id] = (acc[r.document_id] ?? 0) + 1;
      return acc;
    }, {});
    expect(perDoc["doc-1"]).toBe(3);
    expect(perDoc["doc-2"]).toBe(1);
    // Order preserved, no reranking.
    expect(selected.map((r) => r.id)).toEqual(["chunk-1", "a2", "a3", "b1"]);
  });

  it("never starves a genuinely single-document answer", () => {
    const singleDoc: SearchResult[] = Array.from({ length: 6 }, (_, index) => ({
      ...source(index + 1),
      document_id: "doc-only",
      id: `only-${index + 1}`,
    }));
    expect(capPerDocumentCrowding(singleDoc)).toHaveLength(6);
  });

  it("uses four validated Australian passages across two documents without supplementary padding", () => {
    const highRiskResults = [
      governedSource(1, {
        documentId: "wa-doc-1",
        publisherCode: "FSH",
        publisher: "Fiona Stanley Fremantle Hospitals Group",
        jurisdiction: "Australia/WA",
      }),
      governedSource(2, {
        documentId: "wa-doc-2",
        publisherCode: "EMHS",
        publisher: "East Metropolitan Health Service",
        jurisdiction: "Australia/WA",
      }),
      governedSource(3, {
        documentId: "wa-doc-1",
        publisherCode: "FSH",
        publisher: "WA Health",
        jurisdiction: "Australia/WA",
      }),
      governedSource(4, {
        documentId: "wa-doc-2",
        publisherCode: "EMHS",
        publisher: "East Metropolitan Health Service",
        jurisdiction: "Australia/WA",
      }),
      governedSource(5, {
        documentId: "bmj-doc",
        publisherCode: "BMJ",
        publisher: "BMJ Best Practice",
        jurisdiction: "International",
        validation: "unverified",
      }),
    ];

    const selected = selectModelContextResults({
      routeMode: "strong",
      queryClass: "medication_dose_risk",
      crossDocument: false,
      results: highRiskResults,
    });

    expect(selected.map((result) => result.id)).toEqual(["chunk-1", "chunk-2", "chunk-3", "chunk-4"]);
    expect(new Set(selected.map((result) => result.document_id))).toEqual(new Set(["wa-doc-1", "wa-doc-2"]));
  });

  it("retains a direct supplementary passage when four Australian passages are only nearby", () => {
    const selected = selectModelContextResults({
      routeMode: "strong",
      queryClass: "medication_dose_risk",
      crossDocument: false,
      results: [
        withRelevance(bmjSupplementarySource(1), "direct"),
        withRelevance(waGovernedSource(2, "wa-doc-1"), "nearby"),
        withRelevance(waGovernedSource(3, "wa-doc-2"), "nearby"),
        withRelevance(waGovernedSource(4, "wa-doc-1"), "nearby"),
        withRelevance(waGovernedSource(5, "wa-doc-2"), "nearby"),
      ],
    });

    expect(selected.map((result) => result.id)).toEqual(["chunk-1", "chunk-2", "chunk-3", "chunk-4", "chunk-5"]);
  });

  it("excludes supplementary padding before a 3+1 Australian distribution is diversity-capped", () => {
    const selected = selectModelContextResults({
      routeMode: "strong",
      queryClass: "medication_dose_risk",
      crossDocument: false,
      results: [
        withRelevance(waGovernedSource(1, "wa-doc-1"), "partial"),
        withRelevance(waGovernedSource(2, "wa-doc-1"), "partial"),
        withRelevance(waGovernedSource(3, "wa-doc-1"), "partial"),
        withRelevance(waGovernedSource(4, "wa-doc-2"), "partial"),
        withRelevance(bmjSupplementarySource(5), "partial"),
      ],
    });

    expect(selected.map((result) => result.id)).toEqual(["chunk-1", "chunk-2", "chunk-4"]);
  });

  it("uses Australian-only context when four passages match supplementary relevance", () => {
    const selected = selectModelContextResults({
      routeMode: "strong",
      queryClass: "table_threshold",
      crossDocument: false,
      results: [
        withRelevance(waGovernedSource(1, "wa-doc-1"), "direct"),
        withRelevance(waGovernedSource(2, "wa-doc-2"), "direct"),
        withRelevance(waGovernedSource(3, "wa-doc-1"), "direct"),
        withRelevance(waGovernedSource(4, "wa-doc-2"), "direct"),
        withRelevance(bmjSupplementarySource(5), "direct"),
      ],
    });

    expect(selected.map((result) => result.id)).toEqual(["chunk-1", "chunk-2", "chunk-3", "chunk-4"]);
  });

  it("keeps supplementary evidence when authoritative Australian coverage is not sufficient", () => {
    const selected = selectModelContextResults({
      routeMode: "strong",
      queryClass: "table_threshold",
      crossDocument: false,
      results: [
        governedSource(1, {
          documentId: "wa-doc",
          publisherCode: "WACHS",
          publisher: "WA Country Health Service",
          jurisdiction: "Australia/WA",
        }),
        governedSource(2, {
          documentId: "national-doc",
          publisherCode: "TGA",
          publisher: "Therapeutic Goods Administration",
          jurisdiction: "Australia/National",
          validation: "unverified",
        }),
        governedSource(3, {
          documentId: "bmj-doc",
          publisherCode: "BMJ",
          publisher: "BMJ Best Practice",
          jurisdiction: "International",
          validation: "unverified",
        }),
      ],
    });

    expect(selected.map((result) => result.id)).toEqual(["chunk-1", "chunk-2", "chunk-3"]);
  });

  it("does not promote a known international code with conflicting WA metadata", () => {
    const conflict = governedSource(1, {
      documentId: "conflict-doc",
      publisherCode: "BMJ",
      publisher: "BMJ Best Practice",
      jurisdiction: "Australia/WA",
    });
    const waSources = [2, 3, 4, 5].map((index) =>
      governedSource(index, {
        documentId: index % 2 === 0 ? "wa-doc-1" : "wa-doc-2",
        publisherCode: index % 2 === 0 ? "FSH" : "EMHS",
        publisher: index % 2 === 0 ? "Fiona Stanley Fremantle Hospitals Group" : "East Metropolitan Health Service",
        jurisdiction: "Australia/WA",
      }),
    );

    const selected = selectModelContextResults({
      routeMode: "strong",
      queryClass: "medication_dose_risk",
      crossDocument: false,
      results: [conflict, ...waSources],
    });

    expect(selected.map((result) => result.id)).toEqual(["chunk-2", "chunk-3", "chunk-4", "chunk-5"]);
  });

  it.each(["document_lookup", "comparison", "broad_summary", "unsupported_or_general"] as const)(
    "prefers equally relevant Australian passages for %s answers without dropping supplementary evidence",
    (queryClass) => {
      const selected = selectModelContextResults({
        routeMode: "strong",
        queryClass,
        crossDocument: queryClass === "comparison",
        results: [
          withRelevance(bmjSupplementarySource(1), "direct"),
          withRelevance(waGovernedSource(2, "wa-doc-1"), "direct"),
          withRelevance(waGovernedSource(3, "wa-doc-2"), "direct"),
        ],
      });

      expect(selected.map((result) => result.id)).toEqual(["chunk-2", "chunk-3", "chunk-1"]);
    },
  );

  it("keeps a more relevant international passage ahead of weaker Australian evidence", () => {
    const selected = selectModelContextResults({
      routeMode: "strong",
      queryClass: "broad_summary",
      crossDocument: false,
      results: [
        withRelevance(waGovernedSource(1, "wa-doc-1"), "partial"),
        withRelevance(bmjSupplementarySource(2), "direct"),
      ],
    });

    expect(selected.map((result) => result.id)).toEqual(["chunk-2", "chunk-1"]);
  });

  it("keeps a higher-ranked supplementary passage inside the routine fast budget", () => {
    const selected = selectModelContextResults({
      routeMode: "fast",
      queryClass: "document_lookup",
      crossDocument: false,
      results: [
        withRelevance(bmjSupplementarySource(1), "direct"),
        withRelevance(waGovernedSource(2, "wa-doc-1"), "direct"),
        withRelevance(waGovernedSource(3, "wa-doc-2"), "direct"),
        withRelevance(waGovernedSource(4, "wa-doc-1"), "direct"),
        withRelevance(waGovernedSource(5, "wa-doc-2"), "direct"),
      ],
    });

    expect(selected.map((result) => result.id)).toEqual(["chunk-2", "chunk-3", "chunk-4", "chunk-1"]);
  });

  it("applies the document crowding cap before fixing the routine fast budget", () => {
    const selected = selectModelContextResults({
      routeMode: "fast",
      queryClass: "document_lookup",
      crossDocument: false,
      results: [
        source(1, { document_id: "crowded-doc" }),
        source(2, { document_id: "crowded-doc" }),
        source(3, { document_id: "crowded-doc" }),
        source(4, { document_id: "crowded-doc" }),
        source(5, { document_id: "other-doc" }),
      ],
    });

    expect(selected.map((result) => result.id)).toEqual(["chunk-1", "chunk-2", "chunk-3", "chunk-5"]);
  });

  it("uses a stable context pack cache key for matching retry inputs", () => {
    const key = packedContextCacheKey(results, "broad_summary", { crossDocument: true });
    const sameInputs = packedContextCacheKey([...results], "broad_summary", { crossDocument: true });
    const differentInputs = packedContextCacheKey(results.slice(0, 6), "broad_summary", { crossDocument: true });

    expect(sameInputs).toBe(key);
    expect(differentInputs).not.toBe(key);
  });

  it("includes document-scope for stricter packed context reuse", () => {
    const keyA = packedContextCacheKey(results, "document_lookup", {
      crossDocument: false,
      documentIds: ["doc-1", "doc-2"],
    });
    const keyB = packedContextCacheKey(results, "document_lookup", {
      crossDocument: false,
      documentIds: ["doc-3"],
    });

    expect(keyA).not.toBe(keyB);
  });

  it("reuses packed context keys for the same document filter regardless of order", () => {
    const keyA = packedContextCacheKey(results, "document_lookup", {
      crossDocument: false,
      documentIds: ["doc-2", "doc-1", "doc-1"],
    });
    const keyB = packedContextCacheKey(results, "document_lookup", {
      crossDocument: false,
      documentIds: ["doc-1", "doc-2"],
    });

    expect(keyA).toBe(keyB);
  });
});

describe("coverage and source-role evidence merge", () => {
  it("keeps directly relevant current uploaded guidance primary while Australian evidence fills monitoring", () => {
    const plan = queryPlan([
      { id: "treatment", question: "lithium relapse treatment" },
      { id: "monitoring", question: "lithium renal monitoring interval", purpose: "monitoring" },
    ]);
    const local = governedEvidence({
      id: "local-treatment",
      corpusScope: "uploaded_local",
      content: "Lithium relapse treatment should continue after response.",
    });
    const australian = governedEvidence({
      id: "au-monitoring",
      corpusScope: "australian_public",
      content: "Lithium renal monitoring interval is every six months.",
      role: "clinical_guideline",
    });

    const selection = mergeEvidenceByCoverageAndSourceRole({
      plan,
      candidates: [local, australian],
      claimRole: "treatment",
    });

    expect(selection.find((item) => item.subquestionId === "treatment")?.orderedEvidence[0]?.id).toBe(
      "local-treatment",
    );
    expect(selection.find((item) => item.subquestionId === "monitoring")?.orderedEvidence[0]?.id).toBe("au-monitoring");
  });

  it("uses the matching current site record as primary only for an explicit Clinical KB product question", () => {
    const site = governedEvidence({
      id: "site-lithium",
      corpusScope: "clinical_kb_site",
      content: "The Clinical KB lithium medication record includes formulation and product navigation.",
      role: "clinical_reference",
      metadata: { site_content_logical_id: "medications:lithium" },
    });
    const plan = queryPlan(
      [{ id: "product", question: "Which Clinical KB lithium medication record is available?" }],
      ["medications"],
    );

    const [selection] = mergeEvidenceByCoverageAndSourceRole({ plan, candidates: [site], claimRole: "treatment" });

    expect(selection?.orderedEvidence.map((item) => item.id)).toEqual(["site-lithium"]);
    expect(selection?.coverageReason).toBe("direct");
  });

  it("collapses a derivative site summary into its uploaded guideline lineage family", () => {
    const lineageHash = "a".repeat(64);
    const uploaded = governedEvidence({
      id: "uploaded-guideline",
      corpusScope: "uploaded_local",
      content: "Clozapine treatment requires direct guideline review.",
      contentHash: lineageHash,
    });
    const site = governedEvidence({
      id: "site-summary",
      corpusScope: "clinical_kb_site",
      content: "Clozapine treatment summary derived from the uploaded guideline.",
      role: "clinical_reference",
      metadata: {
        site_content_logical_id: "medications:clozapine",
        site_content_lineage: [
          { sourceId: "uploaded-guideline", sourceHash: lineageHash, relationship: "derived_from" },
        ],
      },
    });

    const [selection] = mergeEvidenceByCoverageAndSourceRole({
      plan: queryPlan([{ id: "treatment", question: "clozapine treatment guideline" }]),
      candidates: [site, uploaded],
      claimRole: "treatment",
    });

    expect(selection?.orderedEvidence.map((item) => item.id)).toEqual(["uploaded-guideline"]);
    expect(selection?.collapsedEvidenceFamilyIds).toHaveLength(1);
  });

  it("rejects divergent legacy editor rows and collapses the canonical logical entity", () => {
    const canonical = governedEvidence({
      id: "canonical",
      corpusScope: "clinical_kb_site",
      content: "Canonical quetiapine product catalogue record.",
      role: "clinical_reference",
      contentHash: "b".repeat(64),
      metadata: { site_content_logical_id: "medications:quetiapine", explicitly_reconciled: true },
    });
    const duplicate = governedEvidence({
      id: "canonical-duplicate",
      corpusScope: "clinical_kb_site",
      content: "Canonical quetiapine product catalogue record.",
      role: "clinical_reference",
      contentHash: "b".repeat(64),
      metadata: { site_content_logical_id: "medications:quetiapine", explicitly_reconciled: true },
    });
    const legacy = governedEvidence({
      id: "legacy-owner-row",
      corpusScope: "clinical_kb_site",
      content: "Divergent quetiapine product catalogue record.",
      role: "clinical_reference",
      metadata: {
        site_content_logical_id: "medications:quetiapine",
        row_owner_id: "owner-a",
        explicitly_reconciled: false,
      },
    });

    const [selection] = mergeEvidenceByCoverageAndSourceRole({
      plan: queryPlan([{ id: "product", question: "Clinical KB quetiapine product catalogue" }], ["medications"]),
      candidates: [legacy, canonical, duplicate],
      claimRole: "treatment",
    });

    expect(selection?.orderedEvidence.map((item) => item.id)).toEqual(["canonical"]);
  });

  it("ranks directly relevant Australian evidence ahead of irrelevant uploaded evidence", () => {
    const irrelevantLocal = governedEvidence({
      id: "irrelevant-upload",
      corpusScope: "uploaded_local",
      content: "Olanzapine adverse effects are discussed here.",
    });
    const directAustralian = governedEvidence({
      id: "direct-australian",
      corpusScope: "australian_public",
      content: "Clozapine myocarditis monitoring includes troponin and CRP.",
    });

    const [selection] = mergeEvidenceByCoverageAndSourceRole({
      plan: queryPlan([{ id: "monitoring", question: "clozapine myocarditis troponin monitoring" }]),
      candidates: [irrelevantLocal, directAustralian],
      claimRole: "dose_or_monitoring",
    });

    expect(selection?.orderedEvidence.map((item) => item.id)).toEqual(["direct-australian"]);
  });

  it("keeps current local guidance primary and returns the canonical material conflict", () => {
    const local = governedEvidence({
      id: "local-monitoring",
      documentId: "local-doc",
      corpusScope: "uploaded_local",
      content: "Lithium monitoring interval is every six months.",
      role: "local_guideline",
      metadata: { publication_date: "2024-01-01", effective_date: "2024-01-01" },
    });
    const australian = governedEvidence({
      id: "au-monitoring-new",
      documentId: "au-doc",
      corpusScope: "australian_public",
      content: "Lithium monitoring interval is every three months.",
      role: "clinical_guideline",
      metadata: { publication_date: "2026-01-01", effective_date: "2026-01-01" },
    });

    const [selection] = mergeEvidenceByCoverageAndSourceRole({
      plan: queryPlan([{ id: "monitoring", question: "lithium monitoring interval" }]),
      candidates: [australian, local],
      claimRole: "dose_or_monitoring",
      verifiedDifferences: [
        {
          claimRole: "dose_or_monitoring",
          topicKey: "lithium-monitoring",
          overlapReason: "same_claim",
          materialDifferenceReason: "monitoring_differs",
          localChunkIds: [local.id],
          australianChunkIds: [australian.id],
        },
      ],
    });

    expect(selection?.orderedEvidence.map((item) => item.id).slice(0, 2)).toEqual([
      "local-monitoring",
      "au-monitoring-new",
    ]);
    expect(selection?.conflicts[0]).toMatchObject({
      local: {
        documentId: "local-doc",
        publicationDate: "2024-01-01",
        jurisdiction: "Australia/WA",
        sourceRole: "local_guideline",
      },
      australian: {
        documentId: "au-doc",
        publicationDate: "2026-01-01",
        jurisdiction: "Australia/WA",
        sourceRole: "clinical_guideline",
      },
      materialDifferenceReason: "monitoring_differs",
      localPrimaryDecision: { selected: "uploaded_local" },
      reviewTargetDocumentId: "local-doc",
    });
  });

  it("does not let subsidy, legal, link-only, directory, or tool sources satisfy treatment", () => {
    const roles: ClinicalSourceRole[] = ["subsidy", "legal", "service_directory", "tool_reference"];
    const candidates = roles.map((role, index) =>
      governedEvidence({
        id: `mismatch-${index}`,
        corpusScope: "australian_public",
        content: "Lithium relapse treatment evidence.",
        role,
      }),
    );
    candidates.push(
      governedEvidence({
        id: "link-only",
        corpusScope: "australian_public",
        content: "Lithium relapse treatment evidence.",
        role: "reference_link",
        metadata: { content_mode: "link_only" },
      }),
    );

    const [selection] = mergeEvidenceByCoverageAndSourceRole({
      plan: queryPlan([{ id: "treatment", question: "lithium relapse treatment" }]),
      candidates,
      claimRole: "treatment",
    });

    expect(selection?.orderedEvidence).toEqual([]);
    expect(selection?.coverageReason).toBe("source_role_mismatch");
  });

  it("reports partial coverage with direct IDs and a bounded absent reason without prompt question text", () => {
    const plan = queryPlan([
      { id: "treatment", question: "lithium relapse treatment" },
      { id: "monitoring", question: "rare serum osmolality surveillance", purpose: "monitoring" },
    ]);
    const selected = governedEvidence({
      id: "treatment-direct",
      corpusScope: "uploaded_local",
      content: "Lithium relapse treatment should continue after response.",
    });
    const merged = mergeEvidenceByCoverageAndSourceRole({ plan, candidates: [selected], claimRole: "treatment" });
    const coverage = evaluateAnswerCoverage({
      plan,
      selectedEvidence: [selected],
      evidenceBySubquestion: merged.map((item) => ({
        subquestionId: item.subquestionId,
        selectedChunkIds: item.orderedEvidence.map((result) => result.id),
        citedChunkIds: item.orderedEvidence.map((result) => result.id),
        eligibleChunkIds: item.orderedEvidence.map((result) => result.id),
        support: item.coverageReason === "direct" ? "direct" : "partial",
        reasonCodes: [item.coverageReason],
        insufficiencyReason:
          item.coverageReason === "direct" || item.coverageReason === "partial" ? null : item.coverageReason,
      })),
    });
    const promptLine = formatAnswerCoveragePromptLine(coverage);

    expect(coverage).toMatchObject({ overall: "partial" });
    expect(coverage.coverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ subquestionId: "treatment", chunkIds: ["treatment-direct"] }),
        expect.objectContaining({
          subquestionId: "monitoring",
          status: "absent",
          reasonCodes: expect.arrayContaining(["not_in_corpus"]),
        }),
      ]),
    );
    expect(promptLine).toContain("treatment:direct");
    expect(promptLine).toContain("monitoring:absent");
    expect(promptLine).not.toContain("rare serum osmolality surveillance");
  });

  it.each([
    ["updating", "site_content_updating"],
    ["stale", "site_content_stale"],
  ] as const)("maps an absent %s site partition to the exact bounded reason", (siteContentState, reason) => {
    const [selection] = mergeEvidenceByCoverageAndSourceRole({
      plan: queryPlan([{ id: "product", question: "Clinical KB lithium medication record" }], ["medications"]),
      candidates: [],
      claimRole: "treatment",
      siteContentState,
    });

    expect(selection?.coverageReason).toBe(reason);
  });

  it("suppresses international padding when Australian coverage is sufficient but uses it for a gap", () => {
    const australian = [1, 2, 3, 4].map((index) =>
      governedEvidence({
        id: `au-${index}`,
        documentId: index % 2 ? "au-doc-a" : "au-doc-b",
        corpusScope: "australian_public",
        content: "Lithium renal monitoring interval guidance.",
      }),
    );
    const international = governedEvidence({
      id: "international",
      corpusScope: "international_supplementary",
      content: "Lithium renal monitoring interval guidance.",
    });
    const complete = mergeEvidenceByCoverageAndSourceRole({
      plan: queryPlan([{ id: "monitoring", question: "lithium renal monitoring interval" }]),
      candidates: [...australian, international],
      claimRole: "dose_or_monitoring",
    });
    const gap = mergeEvidenceByCoverageAndSourceRole({
      plan: queryPlan([{ id: "monitoring", question: "lithium renal monitoring interval" }]),
      candidates: [international],
      claimRole: "dose_or_monitoring",
    });
    const sparseAustralian = mergeEvidenceByCoverageAndSourceRole({
      plan: queryPlan([{ id: "monitoring", question: "lithium renal monitoring interval" }]),
      candidates: [australian[0]!, international],
      claimRole: "dose_or_monitoring",
    });

    expect(complete[0]?.orderedEvidence.map((item) => item.id)).not.toContain("international");
    expect(gap[0]?.orderedEvidence.map((item) => item.id)).toEqual(["international"]);
    expect(sparseAustralian[0]?.orderedEvidence.map((item) => item.id)).toEqual(["au-1", "international"]);
  });

  it("preserves relevance order for candidates in one eligible corpus", () => {
    const candidates = ["first", "second", "third"].map((id) =>
      governedEvidence({
        id,
        corpusScope: "australian_public",
        content: "Clozapine myocarditis monitoring guidance.",
      }),
    );

    const [selection] = mergeEvidenceByCoverageAndSourceRole({
      plan: queryPlan([{ id: "monitoring", question: "clozapine myocarditis monitoring" }]),
      candidates,
      claimRole: "dose_or_monitoring",
    });

    expect(selection?.orderedEvidence.map((item) => item.id)).toEqual(["first", "second", "third"]);
  });
});
